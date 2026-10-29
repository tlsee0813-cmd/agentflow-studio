// AF102: the local CLI preview executor behind the real studio handler and AF100 job store, in one process. The child is a
// harmless local Node script (fake-cli102.mjs: no network, no model, no key); a few cases use a fake ChildProcess to hold back the
// close event. What is checked is the new boundary: binding at acceptance, the exact ready wire, refusals (UTF-8, events, exit,
// final file, wire), the selection and verdict cutoffs, cancel and late replies, a close that never comes, one invocation per id,
// HTTP security and the unchanged default path. Separate processes (crash, restart, orphan) are in owned-cli102-process.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as J from '../dist/public/shared/map-job.js';
import { studioView } from '../dist/public/shared/studio.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import { MAP6_FIRST_PROMPT } from '../server/map-prompt.mjs';
import { openCliExecutor, wrap, readPolicy } from '../../../docs/cycles/2026-10-29-owned-cli-preview-102/preview/cli-executor.mjs';

export const FAKE = fileURLToPath(new URL('./fake-cli102.mjs', import.meta.url));
const NODE_SHA = createHash('sha256').update(readFileSync(process.execPath)).digest('hex');
const tick = () => new Promise(r => setTimeout(r, 5));
const until = async (f, why, n = 2000) => { for (let i = 0; i < n; i++) { if (await f()) return; await tick(); } assert.fail(`timed out: ${why}`); };
const newCap = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
export const policyFor = (ctl, o = {}) => ({ executor: 'codex-cli-preview.102', exe: process.execPath, binarySha256: NODE_SHA, version: 'fake-cli 102-test', versionArgs: [FAKE, '--version'],
  args: [FAKE, '--ctl', ctl, '--final', '{final}', '--cwd', '{cwd}', '--model', '{model}', '--reasoning', '{reasoning}'], model: 'fake-model-102', reasoning: 'high',
  selectionMs: 20000, verdictMs: 21000, wrapper: 'cli-wrapper.1', ...o });
const invocations = ctl => existsSync(join(ctl, 'invocations')) ? readFileSync(join(ctl, 'invocations'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const TEXT = '요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다. 한글 “따옴표”와 이모지 🙂도 그대로.';
const project = (text = TEXT) => D.pasteRecord(D.createProject(), text, null).project;
async function submission(p, { entryId = 'E_cli00000-01', model = 'fake-model-102', id = `MJ_${crypto.randomUUID()}` } = {}) {
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), wire = J.encodeMapInput(inp);
  const binding = { entryId, projectId: p.id, lifecycle: 1, seq: 1, after: inp.after, schemaVersion: inp.ask.schemaVersion, prompt: await mapPromptId(), model, askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
  return { id, cap: newCap(), binding, inp, body: JSON.stringify({ version: 'map-job.1', id, binding, input: wire }) };
}
const jcall = async (h, method, path, cap, body, extra = {}) => {
  const res = await h(new Request(`http://127.0.0.1/api/studio/jobs${path}`, { method, headers: { 'x-agentflow-request': '1', 'x-studio-operation': cap, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...extra }, ...(body !== undefined ? { body } : {}) }));
  return { status: res.status, ...(await res.json()) };
};
const statusOf = async h => (await h(new Request('http://127.0.0.1/api/studio/status'))).json();
const ended = async (h, x, extra) => { let v; await until(async () => !['accepted', 'running'].includes((v = await jcall(h, 'GET', `/${x.id}`, x.cap, undefined, extra)).state), `job ${x.id} ended`); return v; };
async function setup({ policy = {}, modes = ['ok'], spawnImpl, now, env = {}, termMs = 300, closeMs = 1500 } = {}) {
  const ctl = mkdtempSync(join(tmpdir(), 'af102-ctl-')), state = mkdtempSync(join(tmpdir(), 'af102-state-')), dir = mkdtempSync(join(tmpdir(), 'af102-jobs-'));
  writeFileSync(join(ctl, 'mode'), modes.join('\n'));
  const jobs = await openMapJobs({ dir });
  const executor = await openCliExecutor({ policy: policyFor(ctl, policy), stateDir: state, spawnImpl, now, termMs, closeMs });
  const handle = createStudioHandler({ env, jobs, mapExecutor: executor });
  return { ctl, state, dir, jobs, executor, handle, mode: m => writeFileSync(join(ctl, 'mode'), m), close: async () => { await jobs.close(); await executor.close(); } };
}

test('102-E1 normal child: the exact final wire is ready, bound at acceptance to the executor policy; status says the executor', async () => {
  const s = await setup(), x = await submission(project());
  const st = await statusOf(s.handle);
  assert.equal(st.ai, 'off', 'no DeepSeek key: the other AI features stay off');
  assert.deepEqual(st.map, { model: 'fake-model-102', prompt: await mapPromptId(), via: 'jobs' });
  assert.equal(st.map.prompt, 'm6-177d450624b5');
  assert.deepEqual({ ...st.jobs.executor, policy: undefined }, { id: 'codex-cli-preview.102', model: 'fake-model-102', state: 'ready', problem: null, policy: undefined });
  assert.equal((await jcall(s.handle, 'POST', '', x.cap, x.body)).status, 202);
  const v = await ended(s.handle, x);
  assert.equal(v.state, 'ready', JSON.stringify(v.error));
  const [inv] = invocations(s.ctl);
  assert.deepEqual([inv.model, inv.reasoning, inv.cwdEmpty, inv.sameCwd, inv.keyInEnv], ['fake-model-102', 'high', true, true, false]);
  // The child read exactly the wrapper of this ask: the FIRST map.6 prompt and the very input.
  assert.equal(readFileSync(join(s.ctl, 'stdin-1.sha'), 'utf8'), createHash('sha256').update(wrap(x.inp.ask)).digest('hex'));
  assert.ok(wrap(x.inp.ask).startsWith(MAP6_FIRST_PROMPT));
  assert.equal(v.result.model, 'fake-model-102'); assert.equal(v.result.prompt, await mapPromptId()); assert.equal(v.result.askHash, x.binding.askHash);
  assert.doesNotThrow(() => M.validateMapReply(v.result.wire, x.inp.ask));
  assert.equal(v.execution.observed.finalSha256, createHash('sha256').update(JSON.stringify(v.result.wire)).digest('hex'), 'the final bytes, unchanged');
  const file = JSON.parse(readFileSync(join(s.dir, 'ops', `${x.id}.json`), 'utf8')).body;
  assert.deepEqual(Object.keys(file.execution).sort(), ['binarySha256', 'executor', 'model', 'observed', 'permissions', 'policy', 'prompt', 'reasoning', 'selectionMs', 'verdictMs', 'version', 'wrapper']);
  assert.deepEqual([file.execution.executor, file.execution.binarySha256, file.execution.version, file.execution.selectionMs, file.execution.verdictMs], ['codex-cli-preview.102', NODE_SHA, 'fake-cli 102-test', 20000, 21000]);
  assert.equal(file.execution.observed.closed, true); assert.equal(file.execution.observed.exit, 0);
  assert.ok(!JSON.stringify(file.execution).includes(s.ctl) && !JSON.stringify(file.execution).includes('가짜 부분'), 'no path or output in the record');
  await until(() => s.executor.describe().state === 'ready', 'slot free');
  assert.ok(!existsSync(join(s.state, 'lease.json')) && readdirSync(join(s.state, 'released')).length === 1);
  assert.deepEqual(readdirSync(join(s.state, 'runs')), [], 'the run folder (final file) is removed');
  await s.close();
});

test('102-E2 UTF-8 and lines split across chunks are read whole: the same ready wire', async () => {
  const s = await setup({ modes: ['split'] }), x = await submission(project());
  assert.equal((await jcall(s.handle, 'POST', '', x.cap, x.body)).status, 202);
  const v = await ended(s.handle, x); assert.equal(v.state, 'ready', JSON.stringify(v.error));
  assert.ok(JSON.stringify(v.result.wire).includes('🙂') || JSON.stringify(v.result.wire).includes('가짜'));
  await s.close();
});

test('102-E3 refusals: invalid UTF-8, tool/error/unknown events, exit and signal, no turn end, missing or different final, JSON, wire', async () => {
  const cases = [['invalid-utf8', 'AI_RESPONSE_REJECTED', 'INVALID_UTF8'], ['tool', 'AI_RESPONSE_REJECTED', 'TOOL_USE'], ['error-event', 'AI_RESPONSE_REJECTED', 'ERROR_EVENT'],
    ['unknown-event', 'AI_RESPONSE_REJECTED', 'UNKNOWN_EVENT'], ['exit1', 'AI_RESPONSE_UNFINISHED', 'EXIT'], ['crash', 'AI_RESPONSE_UNFINISHED', 'EXIT'], ['no-turn', 'AI_RESPONSE_UNFINISHED', 'NO_TURN_COMPLETED'],
    ['no-final', 'AI_RESPONSE_UNFINISHED', 'NO_FINAL'], ['mismatch', 'AI_RESPONSE_REJECTED', 'FINAL_MISMATCH'], ['bad-json', 'INVALID_RESPONSE', 'JSON'], ['bad-wire', 'INVALID_RESPONSE', null]];
  const s = await setup({ modes: cases.map(c => c[0]), env: { STUDIO_REQUESTS_PER_MINUTE: '60' } });
  for (const [i, [mode, code, rule]] of cases.entries()) {
    const x = await submission(project(), { entryId: `E_cli00003-${String(i).padStart(2, '0')}` });
    assert.equal((await jcall(s.handle, 'POST', '', x.cap, x.body)).status, 202, mode);
    const v = await ended(s.handle, x);
    assert.deepEqual([v.state, v.error.code], ['failed', code], mode);
    if (rule) assert.equal(v.error.detail?.rule, rule, mode); else assert.ok(v.error.detail?.path, `${mode}: the wire rule that failed`);
    assert.equal(v.result, undefined);
    await until(() => s.executor.describe().state === 'ready', `${mode}: slot free once the child is gone`);
  }
  assert.equal(invocations(s.ctl).length, cases.length, 'one invocation each, no retry');
  await s.close();
});

test('102-E4 selection cutoff: a child still running at selectionMs is stopped and refused; one closing just before is kept', async () => {
  const s = await setup({ policy: { selectionMs: 900, verdictMs: 1000 }, modes: ['delay:200', 'delay:3000'] });
  const a = await submission(project(), { entryId: 'E_cli00004-01' }), b = await submission(project(), { entryId: 'E_cli00004-02' });
  assert.equal((await jcall(s.handle, 'POST', '', a.cap, a.body)).status, 202);
  assert.equal((await ended(s.handle, a)).state, 'ready');
  await until(() => s.executor.describe().state === 'ready', 'free');
  const t = performance.now();
  assert.equal((await jcall(s.handle, 'POST', '', b.cap, b.body)).status, 202);
  const v = await ended(s.handle, b);
  assert.deepEqual([v.state, v.error.code, v.execution.observed.reason], ['failed', 'AI_TIMEOUT', 'SELECTION_DEADLINE']);
  assert.ok(performance.now() - t < 2500, 'stopped at the cutoff, not when the child would have finished');
  await until(() => s.executor.describe().state === 'ready', 'the stopped child is gone');
  await s.close();
});

/** A clock that jumps by skew when the child's close event is emitted: before (closedAt counts it) or right after (only the verdict). */
function skewed(skew, when) {
  let off = 0;
  const now = () => performance.now() + off;
  const spawnImpl = (...a) => { const c = spawn(...a); if (!a[1].includes('--version')) c.once('close', () => { if (when === 'before') off = skew; else process.nextTick(() => { off = skew; }); }); return c; };
  return { now, spawnImpl };
}
test('102-E5 the same-tick races: a close counted after selectionMs is refused; a verdict after verdictMs is refused; just inside is kept', async () => {
  const run = async (skew, when) => {
    const s = await setup({ policy: { selectionMs: 10000, verdictMs: 15000 }, ...skewed(skew, when) }), x = await submission(project());
    assert.equal((await jcall(s.handle, 'POST', '', x.cap, x.body)).status, 202);
    const v = await ended(s.handle, x); await s.close(); return v;
  };
  const inside = await run(9000, 'before'); assert.equal(inside.state, 'ready', 'closed at ~9s of 10s');
  const late = await run(10500, 'before'); assert.deepEqual([late.state, late.error.code], ['failed', 'AI_TIMEOUT'], 'closed at ~10.5s: past selection');
  assert.ok(late.execution.observed.closedAtMs > 10000 && late.execution.observed.reason === null);
  const verdictIn = await run(14000, 'after'); assert.equal(verdictIn.state, 'ready', 'verdict at ~14s of 15s');
  const verdictOut = await run(15500, 'after'); assert.deepEqual([verdictOut.state, verdictOut.error.code], ['failed', 'AI_TIMEOUT'], 'verdict at ~15.5s');
  assert.ok(verdictOut.execution.observed.closedAtMs < 10000 && verdictOut.execution.observed.verdictAtMs > 15000);
});

test('102-E6 cancel: recorded first, the child is stopped (SIGTERM ignored → killed); a complete answer after the cancel is never ready', async () => {
  const s = await setup({ modes: ['hang', 'late', 'ok'], termMs: 2000 });
  const a = await submission(project(), { entryId: 'E_cli00006-01' });
  assert.equal((await jcall(s.handle, 'POST', '', a.cap, a.body)).status, 202);
  await until(() => existsSync(join(s.ctl, 'stdin-1.sha')), 'child running'); await new Promise(r => setTimeout(r, 100));
  const c = await jcall(s.handle, 'POST', `/${a.id}/cancel`, a.cap, '{}'); assert.deepEqual([c.state, c.remote], ['cancelled', 'unknown']);
  await until(() => s.executor.describe().state === 'ready', 'the ignoring child was killed and is gone', 1000);
  // late: on SIGTERM it still writes a whole valid answer and exits 0.
  const b = await submission(project(), { entryId: 'E_cli00006-02' });
  assert.equal((await jcall(s.handle, 'POST', '', b.cap, b.body)).status, 202);
  await until(() => existsSync(join(s.ctl, 'stdin-2.sha')), 'child running'); await new Promise(r => setTimeout(r, 100));
  assert.equal((await jcall(s.handle, 'POST', `/${b.id}/cancel`, b.cap, '{}')).state, 'cancelled');
  await until(() => s.executor.describe().state === 'ready', 'gone');
  await until(() => s.jobs.held().executing === 0, 'call ended');
  const v = await jcall(s.handle, 'GET', `/${b.id}`, b.cap); assert.deepEqual([v.state, v.result], ['cancelled', undefined]);
  assert.equal(invocations(s.ctl).length, 2);
  await s.close();
});

/** A child whose close never comes until the test says so (as a stuck pipe or an unkillable process would): kill() does nothing. */
function stuckSpawn() {
  const kids = [];
  const spawnImpl = (exe, args, o) => {
    if (args.includes('--version')) return spawn(exe, args, o);
    // A pid above Linux's PID_MAX_LIMIT (2^22) and any macOS pid: its "group" can never be a real one, so a stop signals nothing.
    const c = new EventEmitter(); Object.assign(c, { pid: 5_000_000 + kids.length, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true });
    c.stdin.resume(); kids.push(c); return c;
  };
  return { spawnImpl, kids };
}
test('102-E7 no close: the job fails at its cutoff, the executor stays closed to every new id until that child is gone', async () => {
  const { spawnImpl, kids } = stuckSpawn();
  const s = await setup({ policy: { selectionMs: 300, verdictMs: 400 }, spawnImpl, termMs: 50, closeMs: 200 });
  const a = await submission(project(), { entryId: 'E_cli00007-01' });
  assert.equal((await jcall(s.handle, 'POST', '', a.cap, a.body)).status, 202);
  const v = await ended(s.handle, a); assert.deepEqual([v.state, v.error.code, v.execution.observed.closed], ['failed', 'AI_TIMEOUT', false]);
  assert.deepEqual([s.executor.describe().state, s.executor.describe().problem], ['unsettled', 'CHILD_NOT_CLOSED']);
  const lease = JSON.parse(readFileSync(join(s.state, 'lease.json'), 'utf8')).lease; assert.equal(lease.state, 'running');
  const b = await submission(project('요구: 다른 프로젝트.'), { entryId: 'E_cli00007-02' });
  const r = await jcall(s.handle, 'POST', '', b.cap, b.body); assert.deepEqual([r.status, r.error.code], [503, 'EXECUTOR_UNSETTLED']);
  assert.equal((await statusOf(s.handle)).jobs.executor.state, 'unsettled');
  assert.equal(kids.length, 1, 'no second child');
  kids[0].emit('exit', null, 'SIGKILL'); kids[0].emit('close', null, 'SIGKILL'); // it finally ends
  if (process.platform === 'win32') await until(() => s.executor.describe().state === 'ready', 'freed by its close');
  else await until(() => s.executor.describe().state === 'ready', 'freed: closed and its (fake) group is empty');
  assert.ok(!existsSync(join(s.state, 'lease.json')));
  assert.equal((await jcall(s.handle, 'POST', '', b.cap, b.body)).status, 202);
  await s.close();
});

test('102-E8 duplicate POSTs of one id are one invocation; another id while it runs is refused, never queued', async () => {
  const s = await setup({ modes: ['delay:400'] }), x = await submission(project());
  const all = await Promise.all([1, 2, 3].map(() => jcall(s.handle, 'POST', '', x.cap, x.body)));
  assert.deepEqual(all.map(r => r.status).sort(), [200, 200, 202]);
  const y = await submission(project('요구: 둘째.'), { entryId: 'E_cli00008-02' });
  const busy = await jcall(s.handle, 'POST', '', y.cap, y.body); assert.deepEqual([busy.status, busy.error.code], [409, 'EXECUTOR_BUSY']);
  assert.equal((await ended(s.handle, x)).state, 'ready');
  assert.equal((await jcall(s.handle, 'POST', '', x.cap, x.body)).state, 'ready', 'again after it ended: still the same job');
  assert.equal(invocations(s.ctl).length, 1);
  assert.equal((await jcall(s.handle, 'GET', `/${y.id}`, y.cap)).status, 404, 'the refused one left nothing');
  await s.close();
});

test('102-E9 scope and binding: a later map is not run; a job runs only under the policy it was bound to; a changed binary or version closes it', async () => {
  const s = await setup();
  let p = project(); p = D.addArea(p, '이미 있는 부분', '');
  const later = await submission(p);
  assert.equal((await jcall(s.handle, 'POST', '', later.cap, later.body)).error.code, 'EXECUTOR_SCOPE');
  const x = await submission(project()), bound = await s.executor.prepare(x.inp.ask), release = s.executor.acquire('direct');
  await assert.rejects(s.executor.call(x.inp.ask, new AbortController().signal, { ...bound, policy: '0'.repeat(64) }), e => e.code === 'EXECUTOR_CHANGED');
  release(); assert.equal(s.executor.describe().state, 'ready'); assert.equal(invocations(s.ctl).length, 0);
  await s.close();
  for (const [policy, problem] of [[{ binarySha256: 'f'.repeat(64) }, 'BINARY_CHANGED'], [{ version: 'fake-cli 0.0-other' }, 'VERSION_CHANGED'], [{ exe: '/nonexistent/cli' }, 'BINARY_MISSING']]) {
    const t = await setup({ policy });
    assert.deepEqual([t.executor.describe().state, t.executor.describe().problem], ['unavailable', problem]);
    const st = await statusOf(t.handle); assert.equal(st.map, undefined, `${problem}: no map offered`); assert.equal(st.jobs.executor.state, 'unavailable');
    const y = await submission(project()); assert.equal((await jcall(t.handle, 'POST', '', y.cap, y.body)).status, 503);
    assert.equal(invocations(t.ctl).length, 0); await t.close();
  }
  assert.throws(() => readPolicy({ ...policyFor('/x'), args: ['--json'] }), /POLICY_INVALID/);
  assert.throws(() => readPolicy({ ...policyFor('/x'), verdictMs: 300001, selectionMs: 299000 }), /POLICY_INVALID/);
});

test('102-E10 HTTP security with the executor: origin, headers, access code, strict body, model binding; zero invocations', async () => {
  const s = await setup({ env: { STUDIO_ACCESS_CODE: 'code-102' } }), x = await submission(project()), code = { 'x-studio-access': 'code-102' };
  const post = (headers, body = x.body) => s.handle(new Request('http://127.0.0.1/api/studio/jobs', { method: 'POST', headers, body }));
  assert.equal((await post({ 'content-type': 'application/json', 'x-agentflow-request': '1', 'x-studio-operation': x.cap, origin: 'https://evil.example', ...code })).status, 403);
  assert.equal((await post({ 'content-type': 'application/json', 'x-agentflow-request': '1', 'x-studio-operation': x.cap, 'sec-fetch-site': 'cross-site', ...code })).status, 403);
  assert.equal((await post({ 'content-type': 'application/json', 'x-studio-operation': x.cap, ...code })).status, 403);
  assert.equal((await post({ 'content-type': 'text/plain', 'x-agentflow-request': '1', 'x-studio-operation': x.cap, ...code })).status, 415);
  assert.equal((await jcall(s.handle, 'POST', '', x.cap, x.body)).error.code, 'ACCESS_CODE_REQUIRED');
  const extra = JSON.stringify({ ...JSON.parse(x.body), exe: '/bin/sh', args: ['-c', 'id'] });
  assert.equal((await jcall(s.handle, 'POST', '', x.cap, extra, code)).error.code, 'INVALID_INPUT');
  const other = await submission(project(), { model: 'gpt-other' });
  assert.equal((await jcall(s.handle, 'POST', '', other.cap, other.body, code)).error.code, 'PROMPT_CHANGED');
  assert.equal(invocations(s.ctl).length, 0);
  assert.equal((await jcall(s.handle, 'POST', '', x.cap, x.body, code)).status, 202);
  assert.equal((await ended(s.handle, x, code)).state, 'ready');
  // Synchronous AI routes are not the executor's: without a key they stay off.
  const ask = await s.handle(new Request('http://127.0.0.1/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1', ...code }, body: JSON.stringify(x.inp.ask) }));
  assert.equal((await ask.json()).error.code, 'AI_NOT_CONFIGURED'); assert.equal(invocations(s.ctl).length, 1);
  await s.close();
});

test('102-E11 the default path is unchanged: no executor, the same status and DeepSeek job; an executor without a job store is ignored', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'af102-def-')), jobs = await openMapJobs({ dir });
  const prompt = await mapPromptId(), sent = [];
  const fetchImpl = async (url, init) => { sent.push(url); const ask = JSON.parse(JSON.parse(init.body).messages[1].content.replace(/^[^\n]*\n/, ''));
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ summary: '', parts: [], relations: [], candidates: [], gaps: ['[스텁] 없음'], matches: [], material: [] }) } }] })); };
  const h = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-102-not-real' }, jobs, fetchImpl });
  const st = await statusOf(h);
  assert.deepEqual(Object.keys(st), ['ai', 'model', 'access', 'digest', 'map', 'jobs']);
  assert.deepEqual([st.ai, st.map, st.jobs], ['deepseek', { model: 'deepseek-flash', prompt }, { version: 'map-job.1', durable: true }]);
  const x = await submission(project(), { model: 'deepseek-flash' });
  assert.equal((await jcall(h, 'POST', '', x.cap, x.body)).status, 202);
  const v = await ended(h, x); assert.equal(v.state, 'ready'); assert.equal(v.execution, undefined, 'a DeepSeek job carries no executor binding');
  assert.equal(JSON.parse(readFileSync(join(dir, 'ops', `${x.id}.json`), 'utf8')).body.execution, undefined);
  assert.deepEqual(sent, ['https://api.deepseek.com/chat/completions']);
  await jobs.close();
  const fakeExecutor = { ready: () => true, model: 'x', describe: () => ({}), prepare() { throw new Error('used'); }, acquire() { throw new Error('used'); }, call() { throw new Error('used'); } };
  const noStore = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-102-not-real' }, mapExecutor: fakeExecutor });
  const st2 = await statusOf(noStore); assert.deepEqual(st2.map, { model: 'deepseek-flash', prompt }); assert.equal(st2.jobs, undefined);
  // With a key and an executor: digest/ask stay DeepSeek's, the map is the executor's (jobs only).
  const ctl = mkdtempSync(join(tmpdir(), 'af102-ctl-')), j2 = await openMapJobs({ dir: mkdtempSync(join(tmpdir(), 'af102-jobs-')) });
  const ex = await openCliExecutor({ policy: policyFor(ctl), stateDir: mkdtempSync(join(tmpdir(), 'af102-state-')) });
  const both = await statusOf(createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-102-not-real' }, jobs: j2, mapExecutor: ex }));
  assert.deepEqual([both.ai, both.model, both.digest.model, both.map], ['deepseek', 'deepseek-flash', 'deepseek-flash', { model: 'fake-model-102', prompt, via: 'jobs' }]);
  await j2.close(); await ex.close();
});

test('102-E12 Worker and default imports never reach the executor or child_process', () => {
  const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');
  for (const f of ['../server/studio.mjs', '../server/worker.mjs', '../server/index.mjs']) {
    const src = read(f); assert.ok(!/owned-cli-preview-102|cli-executor|child_process/.test(src), f);
  }
  const studio = read('../server/studio.mjs'); assert.ok(![...studio.matchAll(/^import .* from '([^']+)'/gm)].some(m => m[1].startsWith('node:')), 'studio.mjs has no node: import');
});
