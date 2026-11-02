// Volatile progress only. All jobs, credentials, replies and transport are local test doubles; no model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openMapJobs } from '../server/map-jobs.mjs';
import { ApiError } from '../../server/errors.mjs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as J from '../dist/public/shared/map-job.js';
import { studioView } from '../dist/public/shared/studio.js';
import { SPAN_INDEX, textDigest } from '../dist/public/shared/evidence-span.js';
import { JobReservations, readJobProgress } from '../dist/public/client/map-jobs.js';
import { createMapRun } from '../dist/public/client/map-run.js';

const PROMPT = 'm6-000000000001', MODEL = 'stub-progress';
const empty = () => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] });
const project = () => D.pasteRecord(D.createProject(), '요구: 결과를 저장한다.', null).project;
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
async function until(fn, why) { for (let i = 0; i < 500; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 2)); } assert.fail(why); }
async function submission(p = project()) {
  const input = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), encoded = J.encodeMapInput(input), id = `MJ_${crypto.randomUUID()}`;
  return { id, cap: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),
    body: { version: J.MAP_JOB_VERSION, id, input: encoded, binding: { entryId: `E_${crypto.randomUUID()}`, projectId: p.id, lifecycle: 1, seq: 1,
      after: input.after, schemaVersion: input.ask.schemaVersion, prompt: PROMPT, model: MODEL, askHash: await J.jobHash(input.ask), inputHash: await J.jobHash(encoded) } } };
}
async function service() {
  const dir = mkdtempSync(join(tmpdir(), 'af-progress-')), jobs = await openMapJobs({ dir }), calls = [];
  const run = { configured: () => true, prompt: () => PROMPT, model: MODEL, acquire: () => () => {},
    call: async function(ask, signal, execution, report) {
      assert.equal(arguments.length, 4); assert.equal(execution, undefined);
      const gate = defer(); calls.push({ ask, signal, report, gate }); await gate.promise;
      return { model: MODEL, reply: empty(), evidence: { index: SPAN_INDEX, ask: textDigest(JSON.stringify(ask)) } };
    } };
  const call = (job, method = 'GET', suffix = '', body) => jobs.handle({ method, rest: method === 'POST' && suffix === '' ? [] : [job.id, ...suffix ? [suffix] : []],
    cap: job.cap, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, run);
  const submit = async job => { const out = await call(job, 'POST', '', job.body); await until(() => calls.some(c => c.ask.project.name === job.body.input.ask.project.name), 'provider stub started'); return out; };
  return { dir, jobs, calls, call, submit };
}
const invalidProgress = [null, [], { phase: 'PRIVATE_SOURCE', done: 0, total: 1 }, { phase: 'extract', done: -1, total: 2 },
  { phase: 'extract', done: 3, total: 2 }, { phase: 'extract', done: 0.5, total: 2 }, { phase: 'extract', done: '1', total: 2 },
  { phase: 'extract', done: 0, total: 0 }, { phase: 'extract', done: 0, total: 25 }, { phase: 'extract', done: 25, total: 25 }, { phase: 'extract', done: NaN, total: 2 }];

test('progress is bounded, sanitized, authenticated GET-only and volatile; ready and late callbacks reveal none', async () => {
  const s = await service(), job = await submission();
  try {
    const receipt = await s.submit(job); assert.equal(receipt.value.progress, undefined); const active = s.calls[0];
    active.report({ phase: 'extract', done: 2, total: 4, text: 'PRIVATE_SOURCE', apiKey: 'PRIVATE_KEY', model: 'PRIVATE_MODEL' });
    const status = await s.call(job); assert.deepEqual(status.value.progress, { phase: 'extract', done: 2, total: 4 });
    assert.ok(!JSON.stringify(status.value).includes('PRIVATE'));
    await assert.rejects(s.call({ ...job, cap: Buffer.alloc(32, 1).toString('base64url') }), error => error.code === 'OPERATION_NOT_FOUND');
    const duplicate = await s.call(job, 'POST', '', job.body); assert.equal(duplicate.value.progress, undefined);
    for (const value of invalidProgress) { active.report(value); assert.deepEqual((await s.call(job)).value.progress, { phase: 'extract', done: 2, total: 4 }); }
    active.report(new Proxy({}, { get() { throw Error('PRIVATE_GETTER'); } }));
    assert.deepEqual((await s.call(job)).value.progress, { phase: 'extract', done: 2, total: 4 });
    const saved = JSON.parse(readFileSync(join(s.dir, 'ops', `${job.id}.json`), 'utf8'));
    assert.equal(saved.body.progress, undefined); assert.ok(!JSON.stringify(saved).includes('PRIVATE'));
    active.gate.resolve(); await until(async () => (await s.call(job)).value.state === 'ready', 'ready');
    active.report({ phase: 'global', done: 1, total: 1 }); assert.equal((await s.call(job)).value.progress, undefined);
  } finally { s.calls.forEach(c => c.gate.resolve()); await s.jobs.close(); }
});

test('cancellation/failure fence progress immediately and callbacks remain tied to their own job', async () => {
  const s = await service(), a = await submission(), b = await submission();
  try {
    await s.submit(a); await s.submit(b); await until(() => s.calls.length === 2, 'both stubs');
    s.calls[0].report({ phase: 'plan', done: 0, total: 1, id: b.id }); s.calls[1].report({ phase: 'render', done: 1, total: 3 });
    assert.deepEqual((await s.call(a)).value.progress, { phase: 'plan', done: 0, total: 1 });
    assert.deepEqual((await s.call(b)).value.progress, { phase: 'render', done: 1, total: 3 });
    const cancelled = await s.call(a, 'POST', 'cancel', {}); assert.equal(cancelled.value.progress, undefined); assert.equal(s.calls[0].signal.aborted, true);
    s.calls[0].report({ phase: 'correction', done: 0, total: 1 }); assert.equal((await s.call(a)).value.progress, undefined);
    assert.deepEqual((await s.call(b)).value.progress, { phase: 'render', done: 1, total: 3 });
    s.calls[1].gate.reject(new ApiError('AI_TIMEOUT', 504)); await until(async () => (await s.call(b)).value.state === 'failed', 'failed');
    s.calls[1].report({ phase: 'global', done: 0, total: 1 }); assert.equal((await s.call(b)).value.progress, undefined);
    s.calls[0].gate.resolve(); await until(() => s.jobs.held().running === 0, 'cancelled late call ended');
    assert.equal((await s.call(a)).value.state, 'cancelled'); assert.equal((await s.call(a)).value.progress, undefined);
  } finally { s.calls.forEach(c => c.gate.resolve()); await s.jobs.close(); }
});

test('client progress parser discards arbitrary text and rejects invalid phases/counts without throwing', () => {
  for (const value of invalidProgress) assert.equal(readJobProgress(value), null);
  for (const phase of ['extract', 'plan', 'render', 'global', 'correction'])
    assert.deepEqual(readJobProgress({ phase, done: 0, total: 24, text: 'PRIVATE_SOURCE', model: 'PRIVATE_MODEL' }), { phase, done: 0, total: 24 });
  assert.equal(readJobProgress(new Proxy({}, { get() { throw Error('PRIVATE_GETTER'); } })), null);
});

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
function browserStorage() {
  const memory = new Map(), held = new Set();
  const kv = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const locks = { async request(name, options, callback) {
    const fn = typeof options === 'function' ? options : callback;
    if (options?.ifAvailable && held.has(name)) return fn(null);
    held.add(name); try { return await fn({ name }); } finally { held.delete(name); }
  } };
  return new JobReservations(kv, locks);
}

test('polling/reload restores only the bound entry progress; mismatch and cancellation clear it without applying a map', async () => {
  const server = new Map(), submitted = [], jobs = browserStorage(), changed = [];
  const a = { key: 'E_progress-entry-a', kind: 'saved', project: project(), ref: { lifecycle: 1, seq: 1 } };
  const b = { key: 'E_progress-entry-b', kind: 'saved', project: project(), ref: { lifecycle: 1, seq: 1 } };
  a.view = studioView(a.project); b.view = studioView(b.project); let current = a, commits = 0;
  const status = { ai: 'deepseek', model: MODEL, access: 'open', map: { model: MODEL, prompt: PROMPT }, jobs: { durable: true, problem: null } };
  globalThis.fetch = async (url, init) => {
    const payload = init.body ? JSON.parse(init.body) : null;
    if (url === '/api/studio/jobs' && init.method === 'POST') {
      submitted.push(payload); const record = { id: payload.id, binding: payload.binding, bindingHash: await J.jobHash(payload.binding), state: 'running', acked: null,
        error: null, remote: null, progress: { phase: 'plan', done: 0, total: 1 } };
      server.set(record.id, record); const { progress, ...receipt } = record; return new Response(JSON.stringify(receipt));
    }
    const id = url.split('/')[4], record = server.get(id); assert.ok(record, 'known fake server job');
    if (url.endsWith('/cancel')) record.state = 'cancelled';
    if (url.endsWith('/ack')) record.acked = payload.outcome;
    return new Response(JSON.stringify(record));
  };
  const makeRun = () => createMapRun({ current: () => current, status: () => status, jobs: () => jobs, accessCode: () => '', pollMs: 2,
    commit: async () => { commits++; return null; }, done: () => {}, changed: key => changed.push(key) });
  let run = makeRun();
  try {
    await run.run(); await until(() => run.detail().progress === '전체 조건 대조 중…', 'first GET progress');
    const aId = submitted[0].id; run.dispose(); run = makeRun(); run.resume();
    await until(() => run.detail().progress === '전체 조건 대조 중…', 'reload GET progress'); assert.equal(submitted.length, 1);
    current = b; assert.equal(run.detail().progress, null); assert.equal(run.detail(a.key).progress, '전체 조건 대조 중…');
    await run.run(); const bId = submitted[1].id;
    server.get(aId).progress = { phase: 'correction', done: 0, total: 1, text: 'PRIVATE_SOURCE' };
    server.get(bId).progress = { phase: 'render', done: 1, total: 3 };
    await until(() => run.detail(a.key).progress === '정리 결과를 바로잡는 중…' && run.detail().progress === '부분 정리 1/3', 'independent entries');
    assert.ok(!JSON.stringify(run.detail(a.key)).includes('PRIVATE')); assert.ok(!JSON.stringify(run.detail()).includes('PRIVATE'));
    server.get(aId).bindingHash = 'f'.repeat(64); server.get(aId).progress = { phase: 'extract', done: 24, total: 24 };
    await until(() => run.detail(a.key).progress === null, 'wrong binding rejected'); assert.equal(run.detail().progress, '부분 정리 1/3');
    server.get(bId).progress = { phase: 'extract', done: 2, total: 4 }; await until(() => run.detail().progress === '근거 읽기 2/4', 'extract label');
    server.get(bId).progress = { phase: 'global', done: 1, total: 1 }; await until(() => run.detail().progress === '관계·조건 마지막 확인 중…', 'global label');
    assert.ok(!run.detail().progress.includes('완료')); run.cancel();
    await until(() => !run.state().pending, 'cancelled'); assert.equal(run.detail().progress, null); assert.equal(commits, 0);
    assert.ok(changed.includes(a.key) && changed.includes(b.key));
  } finally { run.dispose(); }
});
