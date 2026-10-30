// AF128: an optional local PC entry that runs map readings with the Codex CLI already installed (and signed in) on this PC, under
// the fixed policy accepted in AF121/122 — no policy file to write. It is a thin host around the existing pieces: the local app
// (server/app.mjs, localhost only), the studio handler, the AF100 job store and the AF102 CLI executor. The default server
// (server/index.mjs, DeepSeek), the Worker and the public builds never load it. Nothing here installs, updates, downloads or signs
// in to anything, and starting, checking or stopping makes no generation (the executor's --version probe is not one).
//   node continuity/scripts/pc-entry.mjs check [--port 4327] [--codex <codex.exe>]   what a start would do (JSON)
//   node continuity/scripts/pc-entry.mjs serve --codex <codex.exe> [--port 4327]       the server (start-pc.ps1 runs it hidden)
//   node continuity/scripts/pc-entry.mjs stop [--port 4327] [--interrupt-running]      an orderly stop of this entry's own server
// Keys: none are read or written here; an optional DeepSeek key for the other features comes only from the env file Node is given.
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile, rename } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../../server/config.mjs';
import { createContinuityApp } from '../server/app.mjs';
import { createStudioHandler } from '../server/studio.mjs';
import { openMapJobs, own } from '../server/map-jobs.mjs';
import { openCliExecutor, policyHash, readPolicy, EXECUTOR_ID } from '../../../docs/cycles/2026-10-29-owned-cli-preview-102/preview/cli-executor.mjs';

export const DEFAULT_PORT = 4327;
const DATA = fileURLToPath(new URL('../.studio-data/', import.meta.url));
/** The AF121 accepted policy (docs/cycles/2026-10-30-pc-entry-128/ACCEPTED_POLICY.json) without its executable path. */
export const FIXED_POLICY = Object.freeze({
  executor: EXECUTOR_ID, binarySha256: '5c1b55966bf9f757dcbf00065c9a6cb862ead55d34b015f1be1939ff18e43943', version: 'codex-cli 0.165.0-alpha.1.2', versionArgs: ['--version'],
  args: ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--model', '{model}', '-c', 'model_reasoning_effort="{reasoning}"',
    '-c', 'web_search="disabled"', '-c', 'hide_agent_reasoning=true', '--disable', 'shell_tool', '--disable', 'apps', '--disable', 'plugins', '--disable', 'remote_plugin',
    '--disable', 'computer_use', '--disable', 'browser_use', '--disable', 'multi_agent', '--disable', 'multi_agent_v2', '--disable', 'hooks', '--disable', 'memories',
    '--disable', 'skill_search', '--disable', 'skill_mcp_dependency_install', '--disable', 'unified_exec', '--disable', 'view_image', '--disable', 'image_generation',
    '--disable', 'workspace_dependencies', '--disable', 'sleep_tool', '-c', 'project_doc_max_bytes=0', '-c', 'approval_policy="never"', '--json', '--color', 'never',
    '--cd', '{cwd}', '--output-last-message', '{final}', '-'],
  model: 'gpt-6.1-sol', reasoning: 'high', selectionMs: 299000, verdictMs: 300000, scope: 'map7-later'
});
/** Where this entry keeps things: the job store per address (as the local server does), one executor state for every port (so one
 * child at a time, as the AF102 launcher), and this entry's own run file per port. */
export const placesFor = (port, data = DATA) => ({ store: join(data, `map-jobs-${port}`), state: join(data, 'cli-preview-102'), run: join(data, `pc-entry-${port}`) });

const hashFile = file => new Promise(res => { const h = createHash('sha256'); createReadStream(file).on('data', d => h.update(d)).on('error', () => res(null)).on('end', () => res(h.digest('hex'))); });
const isFile = f => { try { return statSync(f).isFile(); } catch { return false; } };
/** The places an installed Codex executable is looked for, narrowly: the executable named on PATH, and the npm global package's
 * own binaries (Windows: %APPDATA%\npm). Nothing is searched beyond them; another place is named with --codex. */
export function candidates({ env = process.env, platform = process.platform } = {}) {
  const name = platform === 'win32' ? 'codex.exe' : 'codex', out = [];
  for (const d of String(env.PATH ?? env.Path ?? '').split(platform === 'win32' ? ';' : delimiter).filter(Boolean)) out.push(join(d, name));
  if (platform === 'win32' && env.APPDATA) {
    const vendor = join(env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'vendor');
    try { for (const t of readdirSync(vendor)) out.push(join(vendor, t, 'codex', name)); } catch { /* not installed by npm */ }
  }
  return [...new Set(out)].filter(isFile);
}
/** The executable to run: the one named (--codex) or the first candidate whose bytes are exactly the accepted binary. Hashing is
 * not running: no candidate is started here. found: what was looked at (path and whether it matched), for the message. */
export async function findCodex({ explicit = null, expectedSha = FIXED_POLICY.binarySha256, ...where } = {}) {
  const list = explicit ? [resolve(explicit)] : candidates(where), found = [];
  for (const path of list) {
    const sha = isFile(path) ? await hashFile(path) : null; found.push({ path, matches: sha === expectedSha, missing: sha === null });
    if (sha === expectedSha) return { exe: path, found };
  }
  return { exe: null, found };
}

async function heldBySomeone(dir) {
  // Only a folder that already is a store can be someone's: nothing is created here (own() would write store.json otherwise).
  if (!existsSync(join(dir, 'store.json'))) return false;
  const o = await own(dir); if (o.busy) return true; await o.release?.(); return false;
}
/** What answers on the port: nothing (free), this entry's own server (ours: the same executor, scope, model and policy identity,
 * a durable job store, and this entry's job store and executor state held by a running owner), or anything else (other). */
export async function probePort({ port, policy, places = placesFor(port), timeoutMs = 1500 }) {
  let st;
  try { const res = await fetch(`http://127.0.0.1:${port}/api/studio/status`, { signal: AbortSignal.timeout(timeoutMs) }); st = await res.json(); }
  catch (e) { const code = e?.cause?.code ?? e?.code; return code === 'ECONNREFUSED' ? { port: 'free' } : { port: 'other', why: 'NOT_STUDIO' }; }
  const x = st?.jobs?.executor, want = policyHash(policy).slice(0, 12);
  const same = st?.jobs?.durable === true && x?.id === EXECUTOR_ID && x?.scope === policy.scope && x?.model === policy.model && x?.policy === want && st?.map?.via === 'jobs';
  if (!same) return { port: 'other', why: x ? 'DIFFERENT_EXECUTOR' : 'NO_EXECUTOR' };
  if (!(await heldBySomeone(places.store)) || !(await heldBySomeone(places.state))) return { port: 'other', why: 'NOT_THIS_STATE' };
  return { port: 'ours', executor: { state: x.state, problem: x.problem ?? null } };
}

const EXECUTOR_TEXT = { ready: '지도 정리를 시작할 수 있어요.', unverified: '지도 정리를 시작할 수 있어요(첫 요청 때 실행 파일 판본을 다시 확인해요).', busy: '지도 정리가 실행 중이에요.',
  unsettled: '이전 지도 실행이 끝났는지 확인되지 않아 새 지도 정리는 막혀 있어요. 이미 받은 결과는 읽을 수 있어요.', unavailable: '지도 실행기를 쓸 수 없어 새 지도 정리는 막혀 있어요.' };
/** Korean, one line or two, for the person who started it. */
export function sayCheck(r) {
  if (r.binary === 'unknown') return `허용된 Codex 실행 파일을 찾지 못해 시작하지 않았어요. 이 입구는 codex-cli 0.165.0-alpha.1.2(SHA-256 ${FIXED_POLICY.binarySha256.slice(0, 12)}…)만 써요. 업데이트·다운로드·로그인은 하지 않아요.${r.found?.length ? ` 확인한 파일 ${r.found.length}개는 판본이 달라요.` : ' 설치 경로를 -CodexPath로 알려 주세요.'}`;
  if (r.port === 'other') return `포트 ${r.portNumber}에서 이 입구가 아닌 서버(${r.why})가 실행 중이라 시작하지 않았어요. 그 서버(예: 기본 start-local.ps1)를 먼저 종료하거나 -Port로 다른 포트를 고르세요.`;
  if (r.port === 'ours') return `이미 실행 중인 이 입구를 다시 열어요. ${EXECUTOR_TEXT[r.executor?.state] ?? ''}${r.executor?.problem ? ` (${r.executor.problem})` : ''}`;
  return '시작할 수 있어요.';
}

/** check: which binary, and what is on the port. Exit 0 free or ours, 3 unknown binary, 4 other server. */
/** fixed: the policy without its executable (FIXED_POLICY; a test passes its own fake one, the command line cannot). */
export async function check({ port = DEFAULT_PORT, explicit = null, data = DATA, fixed = FIXED_POLICY, ...where } = {}) {
  const found = await findCodex({ explicit, expectedSha: fixed.binarySha256, ...where });
  if (!found.exe) { const r = { binary: 'unknown', found: found.found, portNumber: port }; return { ...r, message: sayCheck(r), exit: 3 }; }
  const policy = { ...fixed, exe: found.exe }, p = await probePort({ port, policy, places: placesFor(port, data) });
  const r = { binary: 'accepted', exe: found.exe, portNumber: port, ...p };
  return { ...r, message: sayCheck(r), exit: p.port === 'other' ? 4 : 0 };
}

const RUN_FORMAT = 'agentflow.pc-entry.1';
/** serve: the server. Refuses (closing what it opened) unless the job store and the executor state are its own. The run file names
 * this run (a random nonce); a stop request carrying that nonce, or SIGINT/SIGTERM, ends it in order: the store is fenced and
 * its calls aborted, the child waited for (its lease removed once it is gone), then the store and the state let go. */
export async function serve({ port = DEFAULT_PORT, exe, policy: given = null, data = DATA, env = process.env, log = m => console.log(m), pollMs = 500, exit = code => process.exit(code), executorOptions = {} } = {}) {
  const policy = given ?? { ...FIXED_POLICY, exe }; readPolicy(policy);
  const places = placesFor(port, data);
  const jobs = await openMapJobs({ dir: places.store, log });
  if (!jobs.describe().durable) { log(`REFUSED store=${jobs.describe().problem}`); await jobs.close(); return exit(5); }
  const executor = await openCliExecutor({ policy, stateDir: places.state, log, ...executorOptions });
  if (executor.describe().problem === 'EXECUTOR_STATE_BUSY') { log('REFUSED executor=EXECUTOR_STATE_BUSY'); await jobs.close(); await executor.close(); return exit(5); }
  const studio = createStudioHandler({ env, jobs, mapExecutor: executor });
  const config = readConfig({ ...env, PORT: String(port) });
  const nonce = randomBytes(16).toString('hex'), runFile = join(places.run, 'host.json'), stopFile = join(places.run, 'stop.json');
  let stopping = false, timer = null;
  const server = createContinuityApp({ config, studio });
  const stop = async () => {
    if (stopping) return; stopping = true; clearInterval(timer); server.close();
    await jobs.close(); await executor.close();
    for (const f of [stopFile, runFile]) { try { if (JSON.parse(await readFile(f, 'utf8')).nonce === nonce) await unlink(f); } catch { /* not ours or gone */ } }
    log(`STOPPED executor=${JSON.stringify(executor.held())}`); return exit(0);
  };
  await new Promise(res => {
    server.once('error', async e => { log(`REFUSED port=${e?.code ?? 'error'}`); await jobs.close(); await executor.close(); res(); exit(6); });
    server.listen(config.port, config.host, async () => {
      await mkdir(places.run, { recursive: true, mode: 0o700 });
      const tmp = `${runFile}.${nonce}.tmp`; await writeFile(tmp, JSON.stringify({ format: RUN_FORMAT, pid: process.pid, port, nonce, policy: policyHash(policy).slice(0, 12), startedAt: new Date().toISOString() }), { mode: 0o600 }); await rename(tmp, runFile);
      timer = setInterval(async () => { try { if (JSON.parse(await readFile(stopFile, 'utf8')).nonce === nonce) await stop(); } catch { /* no request */ } }, pollMs);
      const x = executor.describe(); log(`READY http://127.0.0.1:${port} executor=${x.state}${x.problem ? `:${x.problem}` : ''}`); res();
    });
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => void stop());
  return { stop, server, jobs, executor };
}

/** stop: asks this entry's own server on the port to stop, and waits for it to say so. It never signals or kills a process: the
 * request is a file only that run can match (its nonce). A run in progress is not interrupted unless asked. */
export async function stop({ port = DEFAULT_PORT, explicit = null, interruptRunning = false, data = DATA, waitMs = 30000, fixed = FIXED_POLICY, ...where } = {}) {
  const c = await check({ port, explicit, data, fixed, ...where });
  if (c.binary !== 'accepted') return { stopped: false, why: 'BINARY', message: c.message, exit: c.exit };
  if (c.port === 'free') return { stopped: true, why: 'NOT_RUNNING', message: '실행 중인 이 입구가 없어요.', exit: 0 };
  if (c.port !== 'ours') return { stopped: false, why: 'NOT_OURS', message: `포트 ${port}의 서버는 이 입구가 아니라 종료 요청을 보내지 않았어요.`, exit: 4 };
  if (c.executor.state === 'busy' && !interruptRunning) return { stopped: false, why: 'BUSY', message: '지도 정리가 실행 중이라 종료하지 않았어요. 끝난 뒤 다시 종료하거나, 중단해도 되면 -InterruptRunning을 붙이세요(그 정리는 결과 없이 중단돼요).', exit: 7 };
  const places = placesFor(port, data); let run;
  try { run = JSON.parse(await readFile(join(places.run, 'host.json'), 'utf8')); if (run.format !== RUN_FORMAT || !/^[0-9a-f]{32}$/.test(run.nonce) || run.port !== port) throw new Error(); }
  catch { return { stopped: false, why: 'NO_RUN_FILE', message: '이 입구의 실행 기록을 읽지 못해 종료 요청을 보내지 않았어요.', exit: 8 }; }
  await writeFile(join(places.run, 'stop.json'), JSON.stringify({ nonce: run.nonce, at: new Date().toISOString() }), { mode: 0o600 });
  const end = Date.now() + waitMs;
  while (Date.now() < end) {
    if ((await probePort({ port, policy: { ...fixed, exe: c.exe }, places, timeoutMs: 500 })).port === 'free' && !existsSync(join(places.run, 'host.json'))) return { stopped: true, why: 'STOPPED', message: '종료했어요. 다시 열려면 같은 명령을 실행하세요.', exit: 0 };
    await new Promise(r => setTimeout(r, 250));
  }
  return { stopped: false, why: 'TIMEOUT', message: '종료 요청을 보냈지만 아직 끝나지 않았어요. 잠시 뒤 다시 확인하세요(강제로 끝내지 않았어요).', exit: 9 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2), opt = n => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  const port = opt('--port') === undefined ? DEFAULT_PORT : Number(opt('--port'));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) { console.error('port must be 1024-65535'); process.exit(2); }
  const known = { check: ['--port', '--codex'], serve: ['--port', '--codex'], stop: ['--port', '--codex', '--interrupt-running'] }[cmd];
  for (let i = 0; known && i < rest.length; i++) { if (!known.includes(rest[i])) { known.length = 0; break; } if (rest[i] !== '--interrupt-running') i++; }
  if (!known?.length) { console.error('usage: pc-entry.mjs check|serve|stop [--port N] [--codex <path>] [--interrupt-running]'); process.exit(2); }
  if (cmd === 'serve') {
    const found = await findCodex({ explicit: opt('--codex') ?? null });
    if (!found.exe) { console.log('REFUSED binary=unknown'); process.exit(3); }
    await serve({ port, exe: found.exe });
  } else {
    const r = cmd === 'check' ? await check({ port, explicit: opt('--codex') ?? null }) : await stop({ port, explicit: opt('--codex') ?? null, interruptRunning: rest.includes('--interrupt-running') });
    console.log(JSON.stringify(r)); process.exit(r.exit);
  }
}
