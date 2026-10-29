// AF100 in real separate Node processes: the test-only smoke server (the real local app, studio handler and job store, with the
// stub provider of studio-smoke-server.mjs) is started, killed without warning and started again on the same job store. The stub
// holds each map call until the test lets it through (STUDIO_STUB_GATE): called-<n> counts provider calls, release-<n> answers.
// No model is called and no key is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as J from '../dist/public/shared/map-job.js';
import { studioView } from '../dist/public/shared/studio.js';
import { mapPromptId } from '../server/studio.mjs';

const SERVER = fileURLToPath(new URL('./studio-smoke-server.mjs', import.meta.url)), APP = fileURLToPath(new URL('../..', import.meta.url));
const tick = () => new Promise(r => setTimeout(r, 20));
const until = async (f, why, n = 1500) => { for (let i = 0; i < n; i++) { if (await f()) return; await tick(); } assert.fail(`timed out: ${why}`); };
const procs = new Set();
test.after(() => { for (const p of procs) p.kill('SIGKILL'); });

function start(dir, gate, stub = 'ok') {
  const proc = spawn(process.execPath, [SERVER], { cwd: APP, env: { ...process.env, STUDIO_STUB: stub, PORT: '0', STUDIO_JOBS_DIR: dir, STUDIO_STUB_GATE: gate }, stdio: ['ignore', 'pipe', 'inherit'] });
  procs.add(proc); proc.once('exit', () => procs.delete(proc));
  return new Promise((res, rej) => {
    let out = ''; proc.stdout.on('data', d => { out += d; const m = /READY (http:\/\/\S+)(?: jobs=(\S+))?/.exec(out); if (m) res({ proc, base: m[1], jobs: m[2] ?? null }); });
    proc.once('exit', c => rej(new Error(`server exit ${c}`)));
  });
}
const kill = proc => new Promise(r => { proc.once('exit', r); proc.kill('SIGKILL'); });
const calls = gate => readdirSync(gate).filter(f => f.startsWith('called-')).length;
const newCap = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
async function submission(text = '요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.', entryId = 'E_proc0000-01') {
  const p = D.pasteRecord(D.createProject(), text, null).project, inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), wire = J.encodeMapInput(inp);
  const binding = { entryId, projectId: p.id, lifecycle: 1, seq: 1, after: null, schemaVersion: inp.ask.schemaVersion, prompt: await mapPromptId(), model: 'stub-model', askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
  const id = `MJ_${crypto.randomUUID()}`;
  return { id, cap: newCap(), body: JSON.stringify({ version: 'map-job.1', id, binding, input: wire }) };
}
async function jcall(base, method, path, cap, body) {
  const res = await fetch(`${base}/api/studio/jobs${path}`, { method, headers: { 'X-AgentFlow-Request': '1', 'X-Studio-Operation': cap, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body } : {}) });
  return { status: res.status, ...(await res.json()) };
}
const dirs = () => ({ dir: mkdtempSync(join(tmpdir(), 'af100-store-')), gate: mkdtempSync(join(tmpdir(), 'af100-gate-')) });

test('100-P1 the server process is killed while a job runs: started again, the job reads as interrupted and nothing is sent again', async () => {
  const { dir, gate } = dirs(); let s = await start(dir, gate); assert.equal(s.jobs, 'durable');
  const x = await submission();
  assert.equal((await jcall(s.base, 'POST', '', x.cap, x.body)).status, 202);
  await until(() => calls(gate) === 1, 'the provider was called');
  await kill(s.proc);
  s = await start(dir, gate);
  const v = await jcall(s.base, 'GET', `/${x.id}`, x.cap);
  assert.deepEqual([v.state, v.remote, v.result], ['interrupted', 'unknown', undefined]);
  assert.equal(calls(gate), 1, 'no call from the new process');
  const file = JSON.parse(readFileSync(join(dir, 'ops', `${x.id}.json`), 'utf8')).body;
  assert.equal(file.input, undefined, 'its material is gone');
  // The same id is never a new job.
  assert.equal((await jcall(s.base, 'POST', '', x.cap, x.body)).state, 'interrupted'); assert.equal(calls(gate), 1);
  assert.equal((await jcall(s.base, 'POST', `/${x.id}/ack`, x.cap, '{"outcome":"seen"}')).acked, 'seen');
  await kill(s.proc);
});

test('100-P2 a ready result outlives the process and is fetched by its own capability from a server with no AI key', async () => {
  const { dir, gate } = dirs(); let s = await start(dir, gate);
  const x = await submission();
  assert.equal((await jcall(s.base, 'POST', '', x.cap, x.body)).status, 202);
  await until(() => calls(gate) === 1, 'called'); writeFileSync(join(gate, 'release-1'), '');
  let ready; await until(async () => (ready = await jcall(s.base, 'GET', `/${x.id}`, x.cap)).state === 'ready', 'ready');
  await kill(s.proc);
  s = await start(dir, gate, 'nokey');
  const status = await (await fetch(`${s.base}/api/studio/status`)).json();
  assert.equal(status.ai, 'off'); assert.deepEqual(status.jobs, { version: 'map-job.1', durable: true });
  const v = await jcall(s.base, 'GET', `/${x.id}`, x.cap);
  assert.equal(v.state, 'ready'); assert.deepEqual(v.result, ready.result, 'the same wire, model, prompt, hash and reading id/time'); assert.deepEqual(v.input, ready.input);
  assert.equal((await jcall(s.base, 'GET', `/${x.id}`, newCap())).status, 404);
  const y = await submission('요구: 다른 일.', 'E_proc0000-02');
  assert.equal((await jcall(s.base, 'POST', '', y.cap, y.body)).error.code, 'AI_NOT_CONFIGURED');
  assert.equal((await jcall(s.base, 'POST', `/${x.id}/ack`, x.cap, '{"outcome":"applied"}')).acked, 'applied');
  assert.equal(calls(gate), 1); await kill(s.proc);
});

test('100-P3 two processes on one store (also by another path to it): only the first owns it; the second says so and takes nothing', async () => {
  const { dir, gate } = dirs(), alias = join(mkdtempSync(join(tmpdir(), 'af100-alias-')), 'same-store');
  symlinkSync(dir, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const a = await start(dir, gate); assert.equal(a.jobs, 'durable');
  const x = await submission(); assert.equal((await jcall(a.base, 'POST', '', x.cap, x.body)).status, 202);
  await until(() => calls(gate) === 1, 'called'); writeFileSync(join(gate, 'release-1'), '');
  await until(async () => (await jcall(a.base, 'GET', `/${x.id}`, x.cap)).state === 'ready', 'ready');
  const before = readFileSync(join(dir, 'ops', `${x.id}.json`), 'utf8');
  for (const path of [dir, alias]) {
    const b = await start(path, gate); assert.equal(b.jobs, 'STORE_BUSY', path);
    const status = await (await fetch(`${b.base}/api/studio/status`)).json(); assert.deepEqual(status.jobs, { version: 'map-job.1', durable: false, problem: 'STORE_BUSY' });
    assert.equal((await jcall(b.base, 'GET', `/${x.id}`, x.cap)).error.code, 'JOB_STORE_UNAVAILABLE');
    const y = await submission('요구: 둘째 서버.', 'E_proc0000-03'); assert.equal((await jcall(b.base, 'POST', '', y.cap, y.body)).status, 503);
    await kill(b.proc);
  }
  assert.equal(readFileSync(join(dir, 'ops', `${x.id}.json`), 'utf8'), before, 'the second process changed nothing');
  assert.equal((await jcall(a.base, 'GET', `/${x.id}`, x.cap)).state, 'ready', 'the owner still serves');
  await kill(a.proc);
  const c = await start(alias, gate); assert.equal(c.jobs, 'durable', 'owned once the first is gone');
  assert.equal((await jcall(c.base, 'GET', `/${x.id}`, x.cap)).state, 'ready');
  assert.equal(calls(gate), 1); await kill(c.proc);
});

test('100-P4 a damaged or half-written journal: refused by id, never a new job, never repaired; the rest of the store reads as kept', async () => {
  const { dir, gate } = dirs(); let s = await start(dir, gate);
  const x = await submission(); assert.equal((await jcall(s.base, 'POST', '', x.cap, x.body)).status, 202);
  await until(() => calls(gate) === 1, 'called'); writeFileSync(join(gate, 'release-1'), '');
  await until(async () => (await jcall(s.base, 'GET', `/${x.id}`, x.cap)).state === 'ready', 'ready');
  await kill(s.proc);
  const ops = join(dir, 'ops'), bad = await submission('요구: 손상.', 'E_proc0000-04'), odd = await submission('요구: 바뀐 내용.', 'E_proc0000-05');
  const kept = JSON.parse(readFileSync(join(ops, `${x.id}.json`), 'utf8'));
  writeFileSync(join(ops, `${bad.id}.json`), '{"format":"agentflow.map-job.1","body":{"id":'); // cut off mid-write
  writeFileSync(join(ops, `${odd.id}.json`), JSON.stringify({ ...kept, body: { ...kept.body, id: odd.id, state: 'ready' } })); // hash no longer matches
  writeFileSync(join(ops, `${x.id}.json.partial.tmp`), '{"format":'); // a temporary file never renamed
  const badBytes = readFileSync(join(ops, `${bad.id}.json`), 'utf8'), oddBytes = readFileSync(join(ops, `${odd.id}.json`), 'utf8');
  s = await start(dir, gate);
  for (const j of [bad, odd]) {
    assert.equal((await jcall(s.base, 'GET', `/${j.id}`, j.cap)).error.code, 'OPERATION_DAMAGED');
    assert.equal((await jcall(s.base, 'POST', '', j.cap, j.body)).error.code, 'OPERATION_DAMAGED', 'never accepted as new');
    assert.equal((await jcall(s.base, 'POST', `/${j.id}/cancel`, j.cap, '{}')).error.code, 'OPERATION_DAMAGED');
  }
  assert.equal(readFileSync(join(ops, `${bad.id}.json`), 'utf8'), badBytes); assert.equal(readFileSync(join(ops, `${odd.id}.json`), 'utf8'), oddBytes);
  assert.ok(!existsSync(join(ops, `${x.id}.json.partial.tmp`)), 'the never-accepted temporary file is gone');
  assert.equal((await jcall(s.base, 'GET', `/${x.id}`, x.cap)).state, 'ready');
  assert.equal(calls(gate), 1); await kill(s.proc);
});
