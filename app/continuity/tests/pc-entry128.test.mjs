// AF128: the optional PC entry (scripts/pc-entry.mjs) around the existing app, studio handler, job store and CLI executor. Control
// fixtures only: a private copy of this Node binary stands in for codex.exe and the harmless fake CLI of the 102 tests answers
// (no network, no model, no key); the fixed policy's own hash, version and arguments are checked as data, never run here. What is
// checked is the entry's boundary: which binary it accepts, what it takes the port's server for, its own start/stop/reopen, and that
// an unsettled executor stays closed. The Windows launcher (start-pc.ps1) is not run here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as J from '../dist/public/shared/map-job.js';
import { studioView } from '../dist/public/shared/studio.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { createContinuityApp } from '../server/app.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import { readConfig } from '../../server/config.mjs';
import { FIXED_POLICY, DEFAULT_PORT, placesFor, findCodex, candidates, probePort, check, serve, stop } from '../scripts/pc-entry.mjs';
import { readPolicy, policyHash, openCliExecutor } from '../../../docs/cycles/2026-10-29-owned-cli-preview-102/preview/cli-executor.mjs';

const ENTRY = fileURLToPath(new URL('../scripts/pc-entry.mjs', import.meta.url)), APP = fileURLToPath(new URL('../..', import.meta.url));
const FAKE = fileURLToPath(new URL('./fake-cli102.mjs', import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex'), NODE_SHA = sha(readFileSync(process.execPath));
const tick = () => new Promise(r => setTimeout(r, 20));
const until = async (f, why, n = 1000) => { for (let i = 0; i < n; i++) { if (await f()) return; await tick(); } assert.fail(`timed out: ${why}`); };
const freePort = () => new Promise(r => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
/** The fixture's stand-in for the fixed policy: the same shape and scope, its own binary, version and (fake CLI) arguments. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'af128-')), ctl = join(root, 'ctl'), bin = join(root, 'bin'), data = join(root, 'data');
  for (const d of [ctl, bin, data]) mkdirSync(d);
  const exe = join(bin, process.platform === 'win32' ? 'codex.exe' : 'codex'); copyFileSync(process.execPath, exe);
  const fixed = { ...FIXED_POLICY, binarySha256: NODE_SHA, version: 'fake-cli 102-test', versionArgs: [FAKE, '--version', '--ctl', ctl],
    args: [FAKE, '--ctl', ctl, '--final', '{final}', '--cwd', '{cwd}', '--model', '{model}', '--reasoning', '{reasoning}'], selectionMs: 20000, verdictMs: 21000 };
  return { root, ctl, bin, data, exe, fixed, mode: m => writeFileSync(join(ctl, 'mode'), m) };
}
const invocations = f => existsSync(join(f.ctl, 'invocations')) ? readFileSync(join(f.ctl, 'invocations'), 'utf8').split('\n').filter(Boolean).length : 0;
const running = new Set();
test.afterEach(async () => { for (const r of running) await r().catch(() => {}); running.clear(); });
async function start(f, port, extra = {}) {
  let exited = null; const logs = [];
  const r = await serve({ port, policy: { ...f.fixed, exe: f.exe }, data: f.data, env: {}, log: m => logs.push(m), pollMs: 50, exit: code => { exited = code; }, ...extra });
  if (r?.stop) running.add(async () => { if (exited === null) await r.stop(); });
  return { ...r, logs, exited: () => exited };
}
const newCap = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
async function firstJob(base) {
  const p = D.pasteRecord(D.createProject(), '요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.', null).project;
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), wire = J.encodeMapInput(inp), id = `MJ_${crypto.randomUUID()}`, cap = newCap();
  const binding = { entryId: 'E_pc128000-01', projectId: p.id, lifecycle: 1, seq: 1, after: null, schemaVersion: inp.ask.schemaVersion, prompt: await mapPromptId(), model: FIXED_POLICY.model, askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
  const call = async (method, path, body) => { const res = await fetch(`${base}/api/studio/jobs${path}`, { method, headers: { 'X-AgentFlow-Request': '1', 'X-Studio-Operation': cap, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body } : {}) }); return { status: res.status, ...(await res.json()) }; };
  return { id, cap, call, submit: () => call('POST', '', JSON.stringify({ version: 'map-job.1', id, binding, input: wire })), get: () => call('GET', `/${id}`) };
}

test('128-1 the fixed policy is the accepted AF121 policy (all but the local executable path) and reads as a map7-later policy', () => {
  const accepted = JSON.parse(readFileSync(new URL('../../../docs/cycles/2026-10-30-pc-entry-128/ACCEPTED_POLICY.json', import.meta.url), 'utf8'));
  const { exe: _exe, _note, ...rest } = accepted;
  assert.deepEqual({ ...FIXED_POLICY }, rest);
  const p = readPolicy({ ...FIXED_POLICY, exe: 'C:\\codex\\codex.exe' });
  assert.deepEqual([p.scope, p.model, p.reasoning, p.selectionMs, p.verdictMs, p.version], ['map7-later', 'gpt-6.1-sol', 'high', 299000, 300000, 'codex-cli 0.165.0-alpha.1.2']);
  assert.equal(DEFAULT_PORT, 4327, 'not the default DeepSeek launcher port (4317)');
});

test('128-2 only the accepted binary is taken: named or found narrowly on PATH / npm global; anything else is refused unrun', async () => {
  const f = fixture(), wrong = join(f.root, 'other'); mkdirSync(wrong);
  const other = join(wrong, process.platform === 'win32' ? 'codex.exe' : 'codex'); copyFileSync(process.execPath, other); appendFileSync(other, '\n');
  assert.equal((await findCodex({ explicit: f.exe, expectedSha: NODE_SHA })).exe, f.exe);
  const refused = await findCodex({ explicit: other, expectedSha: NODE_SHA }); assert.equal(refused.exe, null); assert.deepEqual(refused.found.map(x => x.matches), [false]);
  const env = { PATH: [wrong, f.bin].join(process.platform === 'win32' ? ';' : ':') };
  assert.equal((await findCodex({ expectedSha: NODE_SHA, env })).exe, f.exe, 'the matching one, not the first one');
  // Windows: the npm global package's own binary (the .cmd shim is never a candidate).
  const appdata = join(f.root, 'AppData'), vendor = join(appdata, 'npm', 'node_modules', '@openai', 'codex', 'vendor', 'x86_64-pc-windows-msvc', 'codex');
  mkdirSync(vendor, { recursive: true }); copyFileSync(process.execPath, join(vendor, 'codex.exe')); writeFileSync(join(appdata, 'npm', 'codex.cmd'), '@echo off');
  assert.deepEqual(candidates({ env: { APPDATA: appdata, PATH: '' }, platform: 'win32' }), [join(vendor, 'codex.exe')]);
  const c = await check({ port: await freePort(), explicit: other, data: f.data, fixed: f.fixed });
  assert.deepEqual([c.binary, c.exit], ['unknown', 3]); assert.match(c.message, /업데이트·다운로드·로그인은 하지 않아요/);
  assert.ok(!existsSync(join(f.ctl, 'versions')) && invocations(f) === 0, 'nothing was started to decide');
  // The command line itself: the real fixed policy, no codex here, refused with exit 3 and no other output than its JSON.
  const r = spawnSync(process.execPath, [ENTRY, 'check', '--port', String(await freePort()), '--codex', other], { cwd: APP, encoding: 'utf8' });
  assert.equal(r.status, 3); assert.equal(JSON.parse(r.stdout).binary, 'unknown');
  for (const bad of [['serve', '--model', 'x'], ['check', '--policy', 'p.json'], ['stop', '--scope', 'all']]) assert.equal(spawnSync(process.execPath, [ENTRY, ...bad], { cwd: APP }).status, 2, bad.join(' '));
});

test('128-3 the port: free, this entry (same executor, scope, policy and its own state held), or another server — never taken for ours', async () => {
  const f = fixture(), port = await freePort(), policy = { ...f.fixed, exe: f.exe };
  assert.equal((await probePort({ port, policy, places: placesFor(port, f.data) })).port, 'free');
  const s = await start(f, port); assert.match(s.logs.at(-1), /^READY .* executor=ready$/);
  const ours = await check({ port, explicit: f.exe, data: f.data, fixed: f.fixed });
  assert.deepEqual([ours.port, ours.executor.state, ours.exit], ['ours', 'ready', 0]); assert.match(ours.message, /다시 열어요/);
  // The default local server (DeepSeek handler, no executor) on another port.
  const p2 = await freePort(), def = createContinuityApp({ config: readConfig({ PORT: String(p2) }), studio: createStudioHandler({ env: {}, jobs: await openMapJobs({ dir: join(f.root, 'def-store') }) }) });
  await new Promise(r => def.listen(p2, '127.0.0.1', r));
  // Same binary, another path: another policy identity.
  const exe2 = join(f.root, 'bin2', 'codex'); mkdirSync(join(f.root, 'bin2')); copyFileSync(process.execPath, exe2);
  // A server that answers with this entry's very status but holds none of its state.
  const st = await (await fetch(`http://127.0.0.1:${port}/api/studio/status`)).json(), p3 = await freePort();
  const mimic = createServer((q, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(st)); });
  await new Promise(r => mimic.listen(p3, '127.0.0.1', r));
  try {
    assert.deepEqual(await probePort({ port: p2, policy, places: placesFor(p2, f.data) }), { port: 'other', why: 'NO_EXECUTOR' });
    assert.deepEqual(await probePort({ port, policy: { ...f.fixed, exe: exe2 }, places: placesFor(port, f.data) }), { port: 'other', why: 'DIFFERENT_EXECUTOR' });
    assert.deepEqual(await probePort({ port: p3, policy, places: placesFor(p3, f.data) }), { port: 'other', why: 'NOT_THIS_STATE' });
    const c = await check({ port: p2, explicit: f.exe, data: f.data, fixed: f.fixed }); assert.equal(c.exit, 4); assert.match(c.message, /이 입구가 아닌 서버/);
  } finally { def.close(); mimic.close(); }
});

test('128-4 stop is an orderly request only this run can match; reopen on the same port reads what was kept; nothing was generated by any of it', async () => {
  const f = fixture(), port = await freePort(); f.mode('ok');
  let s = await start(f, port);
  const job = await firstJob(`http://127.0.0.1:${port}`); assert.equal((await job.submit()).status, 202);
  let ready; await until(async () => (ready = await job.get()).state === 'ready', 'ready');
  await until(async () => (await check({ port, explicit: f.exe, data: f.data, fixed: f.fixed })).executor?.state === 'ready', 'child let go');
  assert.equal(invocations(f), 1, 'the one job (the fixture asks for it here; starting asks for nothing)');
  const r = await stop({ port, explicit: f.exe, data: f.data, fixed: f.fixed });
  assert.deepEqual([r.stopped, r.why, r.exit], [true, 'STOPPED', 0]); assert.equal(s.exited(), 0); assert.match(s.logs.at(-1), /^STOPPED executor=\{"slot":null,"unsettled":null\}/);
  assert.ok(!existsSync(join(placesFor(port, f.data).run, 'host.json'))); assert.ok(!existsSync(join(placesFor(port, f.data).state, 'lease.json')));
  assert.equal((await stop({ port, explicit: f.exe, data: f.data, fixed: f.fixed })).why, 'NOT_RUNNING');
  s = await start(f, port); assert.match(s.logs.at(-1), /^READY/);
  const again = await job.get(); assert.deepEqual([again.state, again.result, again.execution], ['ready', ready.result, ready.execution]);
  assert.equal(invocations(f), 1, 'reopening generated nothing');
});

test('128-5 a run in progress is not stopped unless asked; asked, it ends in order and the next start reads it as interrupted', async () => {
  const f = fixture(), port = await freePort(); f.mode('hang');
  const s = await start(f, port, { executorOptions: { termMs: 200, closeMs: 1500 } }), job = await firstJob(`http://127.0.0.1:${port}`);
  assert.equal((await job.submit()).status, 202); await until(() => existsSync(join(f.ctl, 'stdin-1.sha')), 'child running');
  const busy = await stop({ port, explicit: f.exe, data: f.data, fixed: f.fixed });
  assert.deepEqual([busy.stopped, busy.why, busy.exit], [false, 'BUSY', 7]); assert.equal(s.exited(), null, 'still running');
  const r = await stop({ port, explicit: f.exe, data: f.data, fixed: f.fixed, interruptRunning: true }); assert.equal(r.why, 'STOPPED');
  assert.ok(!existsSync(join(placesFor(port, f.data).state, 'lease.json')), 'its child was stopped and its lease removed');
  await start(f, port); assert.equal((await job.get()).state, 'interrupted'); assert.equal(invocations(f), 1);
});

test('128-6 a stop request never reaches another run or another server: a stale run file is not matched, another port gets nothing', async () => {
  const f = fixture(), port = await freePort(), s = await start(f, port), run = placesFor(port, f.data).run;
  const mine = JSON.parse(readFileSync(join(run, 'host.json'), 'utf8'));
  writeFileSync(join(run, 'host.json'), JSON.stringify({ ...mine, nonce: 'f'.repeat(32) })); // as an earlier run would have left it
  const r = await stop({ port, explicit: f.exe, data: f.data, fixed: f.fixed, waitMs: 800 });
  assert.equal(r.why, 'TIMEOUT'); assert.equal(s.exited(), null, 'a request with another nonce is not this run');
  writeFileSync(join(run, 'host.json'), JSON.stringify(mine));
  const p2 = await freePort(), def = createContinuityApp({ config: readConfig({ PORT: String(p2) }), studio: createStudioHandler({ env: {} }) });
  await new Promise(x => def.listen(p2, '127.0.0.1', x));
  try { const o = await stop({ port: p2, explicit: f.exe, data: f.data, fixed: f.fixed }); assert.deepEqual([o.why, o.exit], ['NOT_OURS', 4]); assert.ok(!existsSync(placesFor(p2, f.data).run)); }
  finally { def.close(); }
});

test('128-7 an unsettled earlier child keeps new map readings closed at start, said so; nothing deletes its lease', async () => {
  const f = fixture(), port = await freePort(), state = placesFor(port, f.data).state; mkdirSync(state, { recursive: true });
  const lease = { leaseId: `L_${crypto.randomUUID()}`, job: 'MJ_x', kind: 'job', policy: '0'.repeat(64), platform: process.platform, boot: null, pid: null, pgid: null, state: 'starting', at: new Date().toISOString() };
  const text = JSON.stringify({ format: 'agentflow.cli-lease.1', lease, sha256: sha(JSON.stringify(lease)) }); writeFileSync(join(state, 'lease.json'), text);
  const s = await start(f, port); assert.match(s.logs.at(-1), /executor=unsettled:CHILD_UNKNOWN$/);
  const c = await check({ port, explicit: f.exe, data: f.data, fixed: f.fixed }); assert.deepEqual([c.port, c.executor.state], ['ours', 'unsettled']); assert.match(c.message, /막혀 있어요/);
  const job = await firstJob(`http://127.0.0.1:${port}`); assert.equal((await job.submit()).error.code, 'EXECUTOR_UNSETTLED');
  assert.equal(readFileSync(join(state, 'lease.json'), 'utf8'), text); assert.equal(invocations(f), 0);
});

test('128-8 a store or executor state already owned by another process: no second server is started on them', async () => {
  const f = fixture(), port = await freePort(), held = await openMapJobs({ dir: placesFor(port, f.data).store });
  try { const s = await start(f, port); assert.equal(s.exited(), 5); assert.match(s.logs.at(-1), /^REFUSED store=STORE_BUSY/); } finally { await held.close(); }
  const other = await openCliExecutor({ policy: { ...f.fixed, exe: f.exe }, stateDir: placesFor(port, f.data).state });
  try { const s = await start(f, port); assert.equal(s.exited(), 5); assert.match(s.logs.at(-1), /^REFUSED executor=EXECUTOR_STATE_BUSY/); } finally { await other.close(); }
  assert.equal(policyHash({ ...f.fixed, exe: f.exe }).slice(0, 12), other.describe().policy, 'the identity the entry compares is the executor own');
});

test('128-9 a server whose executor became unavailable (version changed) is still this entry: its kept results are read, it stops in order', async () => {
  const f = fixture(), port = await freePort(); f.mode('ok');
  let s = await start(f, port); const job = await firstJob(`http://127.0.0.1:${port}`);
  assert.equal((await job.submit()).status, 202); let ready; await until(async () => (ready = await job.get()).state === 'ready', 'ready');
  await until(async () => (await check({ port, explicit: f.exe, data: f.data, fixed: f.fixed })).executor?.state === 'ready', 'child let go');
  assert.equal((await stop({ port, explicit: f.exe, data: f.data, fixed: f.fixed })).why, 'STOPPED');
  // The same entry again, but the binary now answers another version: no new map reading, the same server identity.
  writeFileSync(join(f.ctl, 'version-mode'), 'ok'); const changed = { ...f.fixed, version: 'fake-cli 0.0-other' };
  s = await start({ ...f, fixed: changed }, port); assert.match(s.logs.at(-1), /executor=unavailable:VERSION_CHANGED$/);
  const c = await check({ port, explicit: f.exe, data: f.data, fixed: changed });
  assert.deepEqual([c.port, c.executor.state, c.executor.problem, c.exit], ['ours', 'unavailable', 'VERSION_CHANGED', 0]); assert.match(c.message, /쓸 수 없어/);
  assert.deepEqual([(await job.get()).state, (await job.get()).result], ['ready', ready.result], 'kept results are still read');
  const r = await stop({ port, explicit: f.exe, data: f.data, fixed: changed });
  assert.deepEqual([r.stopped, r.why], [true, 'STOPPED']); assert.equal(s.exited(), 0);
});

test('128-10 a default stop never ends a job admitted after its own check: the server decides, refuses while one runs, and says so', async () => {
  const f = fixture(), port = await freePort(); f.mode('delay:1500');
  // A slow poll makes the window between the stop request and the server's decision wide enough to admit a job in it.
  const s = await start(f, port, { pollMs: 1500 }), run = placesFor(port, f.data).run;
  const pending = stop({ port, explicit: f.exe, data: f.data, fixed: f.fixed, waitMs: 8000 });
  await until(() => existsSync(join(run, 'stop.json')), 'stop requested');
  const job = await firstJob(`http://127.0.0.1:${port}`); assert.equal((await job.submit()).status, 202, 'admitted after the stop check');
  const r = await pending;
  assert.deepEqual([r.stopped, r.why, r.exit], [false, 'BUSY', 7], 'the default stop is refused by the server, not a silent interruption');
  assert.equal(s.exited(), null, 'the server keeps running');
  await until(async () => (await job.get()).state === 'ready', 'the admitted job finished');
  assert.ok(!existsSync(join(run, 'stop.json')), 'the refused request is not left to act later');
  const later = await stop({ port, explicit: f.exe, data: f.data, fixed: f.fixed }); assert.equal(later.why, 'STOPPED');
});

