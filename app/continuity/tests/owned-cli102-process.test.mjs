// AF102 in real separate processes: this cycle's preview launcher (the real local app, studio handler, AF100 job store and the CLI
// executor) runs the harmless fake CLI (fake-cli102.mjs). The launcher is killed without warning, stopped in order, and started
// again on the same job store and executor state. What is checked is the lifetime boundary: an old child that may still live keeps
// every new id out; an unknown one too, until the operator attests; nothing is sent again; ready results survive restarts and keyoff.
// The orphan part (an old child surviving the killed launcher, then its group found empty) is POSIX; on Windows the executor cannot
// probe and stays closed until the attestation, which is what is asserted there. No model, no network, no key.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as J from '../dist/public/shared/map-job.js';
import { studioView } from '../dist/public/shared/studio.js';
import { mapPromptId } from '../server/studio.mjs';
import { groupAlive } from '../../../docs/cycles/2026-10-29-owned-cli-preview-102/preview/cli-capture.mjs';

const PREVIEW = fileURLToPath(new URL('../../../docs/cycles/2026-10-29-owned-cli-preview-102/preview/', import.meta.url));
const FAKE = fileURLToPath(new URL('./fake-cli102.mjs', import.meta.url)), APP = fileURLToPath(new URL('../..', import.meta.url));
const POSIX = process.platform !== 'win32';
const tick = () => new Promise(r => setTimeout(r, 20));
const until = async (f, why, n = 1500) => { for (let i = 0; i < n; i++) { if (await f()) return; await tick(); } assert.fail(`timed out: ${why}`); };
const procs = new Set(), strays = new Set();
/** The test's own fake CLI still leads this group (checked by its command line, Linux): only then is the group signalled. */
const ownFake = pid => { try { return readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes('fake-cli102.mjs'); } catch { return false; } };
const killOwn = pid => { if (ownFake(pid)) process.kill(-pid, 'SIGKILL'); };
// Every fake child ends itself once its control folder says stop-all (no pid needed: the Windows path), checked after each test.
const ctls = new Set();
test.after(() => { for (const p of procs) p.kill('SIGKILL'); for (const c of ctls) writeFileSync(join(c, 'stop-all'), ''); for (const g of strays) { try { killOwn(g); } catch { /* gone */ } } });
const NODE_SHA = createHash('sha256').update(readFileSync(process.execPath)).digest('hex');

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'af102-proc-')), ctl = join(root, 'ctl'), state = join(root, 'state'), store = join(root, 'jobs'), policy = join(root, 'policy.json');
  mkdirSync(ctl); ctls.add(ctl);
  writeFileSync(policy, JSON.stringify({ executor: 'codex-cli-preview.102', exe: process.execPath, binarySha256: NODE_SHA, version: 'fake-cli 102-test', versionArgs: [FAKE, '--version', '--ctl', ctl],
    args: [FAKE, '--ctl', ctl, '--final', '{final}', '--cwd', '{cwd}', '--model', '{model}', '--reasoning', '{reasoning}'], model: 'fake-model-102', reasoning: 'high',
    selectionMs: 60000, verdictMs: 61000 }));
  return { root, ctl, state, store, policy, mode: m => writeFileSync(join(ctl, 'mode'), m) };
}
function start(s, extra = []) {
  const args = [join(PREVIEW, 'serve-preview.mjs'), ...(extra.includes('off') ? ['--executor', 'off'] : ['--policy', s.policy]), '--state', s.state];
  const proc = spawn(process.execPath, args, { cwd: APP, env: { ...process.env, PORT: '0', STUDIO_JOBS_DIR: s.store, DEEPSEEK_API_KEY: '' }, stdio: ['ignore', 'pipe', 'inherit'] });
  procs.add(proc); proc.once('exit', () => procs.delete(proc));
  let out = ''; proc.stdout.on('data', d => { out += d; }); proc.output = () => out;
  return new Promise((res, rej) => {
    proc.stdout.on('data', () => { const m = /READY (http:\/\/\S+) jobs=(\S+) executor=(\S+)/.exec(out); if (m) res({ proc, base: m[1], jobs: m[2], executor: m[3] }); });
    proc.once('exit', c => rej(new Error(`launcher exit ${c}: ${out}`)));
  });
}
const kill = proc => new Promise(r => { proc.once('exit', r); proc.kill('SIGKILL'); });
const invocations = s => existsSync(join(s.ctl, 'invocations')) ? readFileSync(join(s.ctl, 'invocations'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const newCap = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
async function submission(text = '요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.', entryId = 'E_proc0102-01') {
  const p = D.pasteRecord(D.createProject(), text, null).project, inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), wire = J.encodeMapInput(inp);
  const binding = { entryId, projectId: p.id, lifecycle: 1, seq: 1, after: null, schemaVersion: inp.ask.schemaVersion, prompt: await mapPromptId(), model: 'fake-model-102', askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
  const id = `MJ_${crypto.randomUUID()}`;
  return { id, cap: newCap(), body: JSON.stringify({ version: 'map-job.1', id, binding, input: wire }) };
}
async function jcall(base, method, path, cap, body) {
  const res = await fetch(`${base}/api/studio/jobs${path}`, { method, headers: { 'X-AgentFlow-Request': '1', 'X-Studio-Operation': cap, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body } : {}) });
  return { status: res.status, ...(await res.json()) };
}
const status = async base => (await fetch(`${base}/api/studio/status`)).json();
const lease = s => existsSync(join(s.state, 'lease.json')) ? JSON.parse(readFileSync(join(s.state, 'lease.json'), 'utf8')).lease : null;
const running = async (s, n) => { await until(() => existsSync(join(s.ctl, `stdin-${n}.sha`)), `child ${n} running`); await until(() => lease(s)?.pid, 'lease has its pid'); await tick(); };

test('102-P1 the launcher is killed while its child runs: the child outlives it; after restart no new id starts until that child is gone', async () => {
  const s = setup(); s.mode('hang\nok\nok');
  let a = await start(s); assert.deepEqual([a.jobs, a.executor], ['durable', 'ready']);
  const x = await submission();
  assert.equal((await jcall(a.base, 'POST', '', x.cap, x.body)).status, 202);
  await running(s, 1); await until(() => existsSync(join(s.ctl, 'ready-1')), 'the child set its stop watch');
  const old = lease(s); assert.equal(old.state, 'running'); const pid = Number(readFileSync(join(s.ctl, 'pid-1'), 'utf8')); assert.equal(old.pid, pid);
  if (POSIX) { assert.equal(old.pgid, pid); strays.add(pid); }
  await kill(a.proc);
  if (POSIX) assert.ok(groupAlive(pid), 'the old child outlived the killed launcher');
  a = await start(s);
  assert.equal(a.executor, 'unsettled:CHILD_MAY_LIVE');
  const st = await status(a.base); assert.equal(st.map.via, 'jobs'); assert.deepEqual([st.jobs.executor.state, st.jobs.executor.problem], ['unsettled', 'CHILD_MAY_LIVE']);
  const v = await jcall(a.base, 'GET', `/${x.id}`, x.cap); assert.deepEqual([v.state, v.remote, v.execution.executor], ['interrupted', 'unknown', 'codex-cli-preview.102']);
  assert.equal((await jcall(a.base, 'POST', '', x.cap, x.body)).state, 'interrupted', 'the same id is never sent again');
  const y = await submission('요구: 재시작 뒤 다른 프로젝트.', 'E_proc0102-02');
  const r = await jcall(a.base, 'POST', '', y.cap, y.body); assert.deepEqual([r.status, r.error.code], [503, 'EXECUTOR_UNSETTLED']);
  assert.equal(invocations(s).length, 1, 'no second child while the first may live');
  if (process.platform !== 'linux') {
    // No probe here (P2 covers attestation). The original child either already ended with the killed launcher (Windows can end it
    // with the launcher's job) or ends itself on its control token. Without any pid: its exit marker, or its heartbeat stopped.
    await kill(a.proc); writeFileSync(join(s.ctl, 'stop-all'), '');
    const beat = () => { try { return Number(readFileSync(join(s.ctl, 'beat-1'), 'utf8')); } catch { return 0; } };
    let how = null;
    await until(() => { if (existsSync(join(s.ctl, 'exited-1'))) how = 'exited-on-token'; else if (Date.now() - beat() > 1500) how = 'no-heartbeat'; return how; }, 'the original fake child ended', 750);
    console.log(`102-P1 original child end on ${process.platform}: ${how}`);
    return;
  }
  assert.ok(process.platform !== 'linux' || ownFake(pid)); killOwn(pid); // the test's own fake child, by its command line
  await until(() => !groupAlive(pid), 'old group gone');
  const r2 = await jcall(a.base, 'POST', '', y.cap, y.body); assert.equal(r2.status, 202, 'proven gone (group empty): admitted');
  await until(async () => (await jcall(a.base, 'GET', `/${y.id}`, y.cap)).state === 'ready', 'ready');
  assert.equal(invocations(s).length, 2);
  await kill(a.proc);
});

test('102-P2 a lease with no child identity (crash between lease and spawn) stays closed until the operator attests it', async () => {
  const s = setup(); s.mode('ok');
  let a = await start(s); assert.equal(a.executor, 'ready'); await kill(a.proc);
  const leaseId = `L_${crypto.randomUUID()}`, body = { leaseId, job: 'MJ_x', policy: '0'.repeat(64), platform: process.platform, boot: null, pid: null, pgid: null, state: 'starting', at: new Date().toISOString() };
  writeFileSync(join(s.state, 'lease.json'), JSON.stringify({ format: 'agentflow.cli-lease.1', lease: body, sha256: createHash('sha256').update(JSON.stringify(body)).digest('hex') }));
  a = await start(s); assert.equal(a.executor, 'unsettled:CHILD_UNKNOWN');
  const y = await submission();
  assert.equal((await jcall(a.base, 'POST', '', y.cap, y.body)).error.code, 'EXECUTOR_UNSETTLED');
  const tool = args => spawnSync(process.execPath, [join(PREVIEW, 'reconcile-lease.mjs'), '--state', s.state, ...args], { cwd: APP, encoding: 'utf8' });
  assert.equal(tool(['--lease', leaseId, '--attest-closed']).status, 1, 'refused while an executor owns the state');
  await kill(a.proc);
  assert.equal(tool(['--lease', `L_${crypto.randomUUID()}`, '--attest-closed']).status, 1, 'only that lease');
  const ok = tool(['--lease', leaseId, '--attest-closed']); assert.equal(ok.status, 0, ok.stderr); assert.match(ok.stdout, /ATTESTED/);
  a = await start(s); assert.equal(a.executor, 'ready');
  assert.equal((await jcall(a.base, 'POST', '', y.cap, y.body)).status, 202);
  await until(async () => (await jcall(a.base, 'GET', `/${y.id}`, y.cap)).state === 'ready', 'ready');
  assert.equal(invocations(s).length, 1); await kill(a.proc);
});

test('102-P3 an orderly stop during a run: the child is stopped and gone before the launcher ends; restart reads interrupted and admits', { skip: !POSIX && 'SIGTERM to a launcher is not deliverable on Windows' }, async () => {
  const s = setup(); s.mode('hang\nok');
  let a = await start(s); const x = await submission();
  assert.equal((await jcall(a.base, 'POST', '', x.cap, x.body)).status, 202); await running(s, 1);
  const pid = Number(readFileSync(join(s.ctl, 'pid-1'), 'utf8')); strays.add(pid);
  await new Promise(r => { a.proc.once('exit', r); a.proc.kill('SIGTERM'); });
  assert.match(a.proc.output(), /STOPPED executor=\{"slot":null,"unsettled":null\}/);
  assert.ok(!groupAlive(pid), 'the ignoring child was killed with its group'); assert.equal(lease(s), null);
  a = await start(s); assert.equal(a.executor, 'ready');
  assert.equal((await jcall(a.base, 'GET', `/${x.id}`, x.cap)).state, 'interrupted');
  const y = await submission('요구: 다음.', 'E_proc0102-03'); assert.equal((await jcall(a.base, 'POST', '', y.cap, y.body)).status, 202);
  await until(async () => (await jcall(a.base, 'GET', `/${y.id}`, y.cap)).state === 'ready', 'ready');
  assert.equal(invocations(s).length, 2); await kill(a.proc);
});

test('102-P4 a ready result survives restarts with the executor off (keyoff) and on, with the binding it ran under', async () => {
  const s = setup(); s.mode('ok');
  let a = await start(s); const x = await submission();
  assert.equal((await jcall(a.base, 'POST', '', x.cap, x.body)).status, 202);
  let ready; await until(async () => (ready = await jcall(a.base, 'GET', `/${x.id}`, x.cap)).state === 'ready', 'ready');
  await kill(a.proc);
  a = await start(s, ['off']); assert.equal(a.executor, 'off');
  const st = await status(a.base); assert.deepEqual([st.ai, st.map, st.jobs], ['off', undefined, { version: 'map-job.1', durable: true }]);
  const v = await jcall(a.base, 'GET', `/${x.id}`, x.cap); assert.deepEqual([v.result, v.input, v.execution], [ready.result, ready.input, ready.execution]);
  const y = await submission('요구: 키 없이.', 'E_proc0102-04'); assert.equal((await jcall(a.base, 'POST', '', y.cap, y.body)).error.code, 'AI_NOT_CONFIGURED');
  await kill(a.proc);
  a = await start(s); assert.equal(a.executor, 'ready');
  assert.deepEqual((await jcall(a.base, 'GET', `/${x.id}`, x.cap)).execution, ready.execution, 'not rewritten from the current settings');
  assert.equal((await jcall(a.base, 'POST', `/${x.id}/ack`, x.cap, '{"outcome":"applied"}')).acked, 'applied');
  assert.equal(invocations(s).length, 1); await kill(a.proc);
});

test('102-P5 two launchers (two ports, two job stores) on one executor state: the second has no executor', async () => {
  const s = setup(), t = { ...s, store: join(s.root, 'jobs-2') };
  const a = await start(s), b = await start(t);
  assert.equal(a.executor, 'ready'); assert.equal(b.executor, 'unavailable:EXECUTOR_STATE_BUSY');
  assert.equal((await status(b.base)).map, undefined);
  await kill(a.proc); await kill(b.proc);
});
