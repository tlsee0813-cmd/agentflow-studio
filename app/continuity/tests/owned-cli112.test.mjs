// AF112: the 102 preview executor's explicit opt-in for later studio.map.6 readings. Behind the real studio handler and AF100 job
// store, with the harmless fake CLI (no network, no model, no key). What is checked is the new boundary only: the policy scope
// (default first, opt-in map6-later, nothing else), the instructions actually selected and the ask bound at acceptance and checked
// again before a start, and a full later case (part, claim, prior with its target, frozen request with sources, an evidence record)
// travelling job submit -> ready -> the browser's own decode and apply without losing anything. The reply is author-written for
// that ask (later112-case.mjs); it is not a model's reading. Lifecycle, cancel, deadline and lease are 102's (owned-cli102*).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as J from '../dist/public/shared/map-job.js';
import * as R from '../dist/public/shared/request-return.js';
import { studioView } from '../dist/public/shared/studio.js';
import { SPAN_INDEX, textDigest } from '../dist/public/shared/evidence-span.js';
import { aiStatus } from '../dist/public/client/studio-api.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import { MAP6_FIRST_PROMPT, MAP6_PROMPT } from '../server/map-prompt.mjs';
import { openCliExecutor, readPolicy, wrap, WRAPPER_PREFIX, WRAPPER_SUFFIX } from '../../../docs/cycles/2026-10-29-owned-cli-preview-102/preview/cli-executor.mjs';
import { laterCase } from './later112-case.mjs';

const FAKE = fileURLToPath(new URL('./fake-cli102.mjs', import.meta.url));
const NODE_SHA = createHash('sha256').update(readFileSync(process.execPath)).digest('hex');
const sha = t => createHash('sha256').update(t).digest('hex');
const tick = () => new Promise(r => setTimeout(r, 5));
const until = async (f, why, n = 2000) => { for (let i = 0; i < n; i++) { if (await f()) return; await tick(); } assert.fail(`timed out: ${why}`); };
const newCap = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const policyFor = (ctl, o = {}) => ({ executor: 'codex-cli-preview.102', exe: process.execPath, binarySha256: NODE_SHA, version: 'fake-cli 102-test', versionArgs: [FAKE, '--version', '--ctl', ctl],
  args: [FAKE, '--ctl', ctl, '--final', '{final}', '--cwd', '{cwd}', '--model', '{model}', '--reasoning', '{reasoning}'], model: 'fake-model-102', reasoning: 'high',
  selectionMs: 20000, verdictMs: 21000, ...o });
const invocations = ctl => existsSync(join(ctl, 'invocations')) ? readFileSync(join(ctl, 'invocations'), 'utf8').split('\n').filter(Boolean).length : 0;
const opened = new Set();
test.afterEach(async () => { for (const close of opened) await close().catch(() => {}); opened.clear(); });
async function setup({ policy = {}, modes = ['ok'], dir = mkdtempSync(join(tmpdir(), 'af112-jobs-')), ctl = mkdtempSync(join(tmpdir(), 'af112-ctl-')) } = {}) {
  const state = mkdtempSync(join(tmpdir(), 'af112-state-'));
  writeFileSync(join(ctl, 'mode'), modes.join('\n'));
  const jobs = await openMapJobs({ dir }), executor = await openCliExecutor({ policy: policyFor(ctl, policy), stateDir: state });
  const handle = createStudioHandler({ env: {}, jobs, mapExecutor: executor });
  let closed = null; const close = () => (closed ??= (async () => { opened.delete(close); await jobs.close(); await executor.close(); })()); opened.add(close);
  return { ctl, state, dir, jobs, executor, handle, close };
}
async function submission(inp, p, { entryId = 'E_cli00112-01', id = `MJ_${crypto.randomUUID()}` } = {}) {
  const wire = J.encodeMapInput(inp);
  const binding = { entryId, projectId: p.id, lifecycle: 1, seq: 1, after: inp.after, schemaVersion: inp.ask.schemaVersion, prompt: await mapPromptId(), model: 'fake-model-102', askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
  return { id, cap: newCap(), binding, body: JSON.stringify({ version: 'map-job.1', id, binding, input: wire }) };
}
const jcall = async (h, method, path, cap, body) => {
  const res = await h(new Request(`http://127.0.0.1/api/studio/jobs${path}`, { method, headers: { 'x-agentflow-request': '1', 'x-studio-operation': cap, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body } : {}) }));
  return { status: res.status, ...(await res.json()) };
};
const ended = async (h, x) => { let v; await until(async () => !['accepted', 'running'].includes((v = await jcall(h, 'GET', `/${x.id}`, x.cap)).state), `job ${x.id} ended`); return v; };
const statusOf = async h => (await h(new Request('http://127.0.0.1/api/studio/status'))).json();
const first = () => { const p = D.pasteRecord(D.createProject(), '요구: 폴더 안의 문서를 한 번에 변환한다.\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.', null).project; return { p, inp: M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA) }; };
/** applyReading with the same ids each time (new parts and corrections take random ids), so two applies can be compared whole. */
function seeded(fn) { const orig = crypto.randomUUID; let i = 0; crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++i).padStart(12, '0')}`; try { return fn(); } finally { crypto.randomUUID = orig; } }

test('112-1 the policy scope: absent is first (its policy hash as before), map6-later is opted in and hashed, anything else is refused', async () => {
  assert.equal(readPolicy(policyFor('/x')).scope, 'first');
  assert.equal(readPolicy(policyFor('/x', { scope: 'map6-later' })).scope, 'map6-later');
  for (const scope of ['later', 'all', 'map6', '', null, 1]) assert.throws(() => readPolicy(policyFor('/x', { scope })), e => e.message === 'POLICY_INVALID' && e.field === 'scope', String(scope));
  // The same policy file but for its scope (the control folder is part of the arguments, so it is shared here).
  const ctl = mkdtempSync(join(tmpdir(), 'af112-ctl-'));
  const a = await setup({ ctl }), b = await setup({ ctl, policy: { scope: 'first' } }), c = await setup({ ctl, policy: { scope: 'map6-later' } });
  const pa = a.executor.describe().policy;
  // The pre-AF112 formula over the same file (no scope field then): unchanged, so a first policy keeps its identity.
  const old = readPolicy(policyFor(ctl)), { scope: _s, ...fields } = old, canon = v => JSON.stringify(v, Object.keys(v).sort());
  assert.equal(pa, sha(canon({ ...fields, limits: canon(old.limits), wrapper: sha(JSON.stringify([WRAPPER_PREFIX, WRAPPER_SUFFIX])) })).slice(0, 12));
  assert.equal(b.executor.describe().policy, pa, 'naming first changes nothing');
  assert.notEqual(c.executor.describe().policy, pa, 'the opt-in is part of the policy');
  assert.deepEqual([a.executor.describe().scope, c.executor.describe().scope], ['first', 'map6-later']);
  assert.equal((await statusOf(c.handle)).jobs.executor.scope, 'map6-later');
});

test('112-2 the default (first) policy refuses a later ask before acceptance: no record, no child', async () => {
  const s = await setup(), c = laterCase(), x = await submission(c.a72, c.s);
  const r = await jcall(s.handle, 'POST', '', x.cap, x.body);
  assert.deepEqual([r.status, r.error.code], [409, 'EXECUTOR_SCOPE']);
  assert.equal(invocations(s.ctl), 0); assert.ok(!existsSync(join(s.dir, 'ops', `${x.id}.json`)));
  assert.equal((await statusOf(s.handle)).jobs.executor.scope, 'first');
  const f = first(), y = await submission(f.inp, f.p, { entryId: 'E_cli00112-02' });
  assert.equal((await jcall(s.handle, 'POST', '', y.cap, y.body)).status, 202, 'a first map still runs');
  const v = await ended(s.handle, y); assert.equal(v.state, 'ready');
  assert.deepEqual([v.execution.scope, v.execution.promptKind, v.execution.prompt], ['first', 'first', sha(MAP6_FIRST_PROMPT).slice(0, 12)]);
});

test('112-3 opted in: a later ask runs with its own selected instructions; the whole later reading survives job, ready, keyoff and the browser apply', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'af112-jobs-'));
  const s = await setup({ policy: { scope: 'map6-later' }, modes: ['file'], dir }), c = laterCase(), x = await submission(c.a72, c.s);
  writeFileSync(join(s.ctl, 'reply-1.json'), JSON.stringify(c.reply));
  const all = await Promise.all([1, 2].map(() => jcall(s.handle, 'POST', '', x.cap, x.body)));
  assert.deepEqual(all.map(r => r.status).sort(), [200, 202]);
  const v = await ended(s.handle, x); assert.equal(v.state, 'ready', JSON.stringify(v.error));
  assert.equal(invocations(s.ctl), 1, 'one child for the job, none for the repeated POST');
  // The child read the AF96 wrapper around the later instructions and the very ask; the job is bound to exactly those.
  const sent = `${WRAPPER_PREFIX}${MAP6_PROMPT}${WRAPPER_SUFFIX}${JSON.stringify(c.a72.ask)}`;
  assert.equal(wrap(c.a72.ask), sent); assert.notEqual(MAP6_PROMPT, MAP6_FIRST_PROMPT);
  assert.equal(readFileSync(join(s.ctl, 'stdin-1.sha'), 'utf8'), sha(sent));
  assert.deepEqual([v.execution.scope, v.execution.promptKind, v.execution.promptSha256, v.execution.prompt, v.execution.askSha256],
    ['map6-later', 'later', sha(MAP6_PROMPT), sha(MAP6_PROMPT).slice(0, 12), sha(JSON.stringify(c.a72.ask))]);
  assert.notEqual(v.execution.prompt, sha(MAP6_FIRST_PROMPT).slice(0, 12), 'a later run is not recorded as a first one');
  assert.deepEqual(v.result.wire, c.reply, 'the wire as the child wrote it');
  // Key off, executor off: the same ready result from the same store.
  await s.close();
  const jobs = await openMapJobs({ dir }); opened.add(() => jobs.close());
  const keyless = createStudioHandler({ env: {}, jobs }), again = await jcall(keyless, 'GET', `/${x.id}`, x.cap);
  assert.deepEqual([again.state, again.result, again.input, again.execution], ['ready', v.result, v.input, v.execution]);
  // The browser's own checks (map-run load) and apply, against the direct apply of the same reply to the original input.
  const inp = J.decodeMapInput(again.input), r = again.result;
  assert.equal(await J.jobHash(again.input), x.binding.inputHash); assert.equal(await J.jobHash(inp.ask), x.binding.askHash);
  assert.deepEqual([r.askHash, r.prompt, r.evidence.index, r.evidence.ask], [x.binding.askHash, x.binding.prompt, SPAN_INDEX, textDigest(JSON.stringify(inp.ask))]);
  assert.deepEqual(inp.fullRequests, c.a72.fullRequests, 'the frozen request with its sources'); assert.deepEqual([...inp.priors], [...c.a72.priors], 'the prior with its target');
  assert.deepEqual([...inp.claims], [...c.a72.claims]); assert.deepEqual([...inp.records], [...c.a72.records]); assert.deepEqual([...inp.parts], [...c.a72.parts]);
  const meta = { id: r.reading.id, at: r.reading.at, model: r.model, prompt: r.prompt, hash: r.askHash };
  const viaJob = seeded(() => M.applyReading(c.s, inp, M.validateMapReply(r.wire, inp.ask), meta));
  const direct = seeded(() => M.applyReading(c.s, c.a72, M.validateMapReply(c.reply, c.a72.ask), meta));
  assert.deepEqual(viaJob, direct, 'nothing lost or changed on the way');
  const got = R.requestMatches(viaJob.project).filter(m => m.reading === r.reading.id);
  assert.deepEqual(got.map(m => [m.match.kind, m.match.stance, m.target?.itemId, !!m.replaces]).sort(),
    [['code', 'unclear', 'change_2', false], ['reported', 'not-made', 'change_1', true], ['test', 'unclear', 'change_2', false]].sort());
  const withdrawn = R.requestMatches(viaJob.project).find(m => m.reading === 'R_71' && m.replacedBy);
  assert.ok(withdrawn && withdrawn.replacedBy.reading === r.reading.id, 'the earlier report is withdrawn by this reading, kept as history');
  const claims = viaJob.reading.parts[0].claims; assert.deepEqual(claims.map(x => x.kind), ['reported', 'open']); assert.ok(claims[0].replaces, 'the claim replaces C01');
  for (const m of got) { const src = viaJob.project.pasted.find(p => p.id === m.match.record) ?? null; if (src) assert.equal(src.text.slice(m.match.from, m.match.to), m.match.quote); }
});

test('112-4 bound to its own ask and instructions: another ask, prompt, kind or scope under the binding starts nothing', async () => {
  const s = await setup({ policy: { scope: 'map6-later' } }), c = laterCase(), f = first();
  const bound = await s.executor.prepare(c.a72.ask);
  assert.deepEqual([bound.scope, bound.promptKind], ['map6-later', 'later']);
  const cases = [[f.inp.ask, bound, 'another ask'], [c.a72.ask, { ...bound, promptSha256: sha(MAP6_FIRST_PROMPT) }, 'the first instructions'],
    [c.a72.ask, { ...bound, prompt: sha(MAP6_FIRST_PROMPT).slice(0, 12) }, 'the first prompt id'], [c.a72.ask, { ...bound, promptKind: 'first' }, 'kind'],
    [c.a72.ask, { ...bound, askSha256: '0'.repeat(64) }, 'ask hash'], [c.a72.ask, { ...bound, scope: 'first' }, 'scope'],
    [{ ...c.a72.ask, records: c.a72.ask.records.slice(0, 1) }, bound, 'the ask cut down']];
  for (const [ask, b, why] of cases) {
    const release = s.executor.acquire(`direct-${why}`);
    await assert.rejects(s.executor.call(ask, new AbortController().signal, b), e => e.code === 'EXECUTOR_CHANGED', why);
    release(); assert.equal(s.executor.describe().state, 'ready', why);
  }
  assert.equal(invocations(s.ctl), 0); assert.ok(!existsSync(join(s.state, 'lease.json')));
  assert.ok(!existsSync(join(s.state, 'released')) || readdirSync(join(s.state, 'released')).every(n => JSON.parse(readFileSync(join(s.state, 'released', n), 'utf8')).lease.kind === 'probe'), 'no job lease was even written');
  // A first ask under the opt-in is bound to the first instructions; a non-map.6 ask is refused by its own reason.
  assert.deepEqual([(await s.executor.prepare(f.inp.ask)).promptKind, (await s.executor.prepare(f.inp.ask)).prompt], ['first', sha(MAP6_FIRST_PROMPT).slice(0, 12)]);
  await assert.rejects(s.executor.prepare({ ...c.a72.ask, schemaVersion: 'studio.map.5' }), e => e.code === 'EXECUTOR_SCHEMA');
  const d = await setup();
  await assert.rejects(d.executor.prepare(c.a72.ask), e => e.code === 'EXECUTOR_SCOPE');
});

test('112-5 a first ready result kept under the old policy is read the same by an opted-in executor (nothing rebound)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'af112-jobs-')), a = await setup({ dir }), f = first(), x = await submission(f.inp, f.p);
  assert.equal((await jcall(a.handle, 'POST', '', x.cap, x.body)).status, 202);
  const v = await ended(a.handle, x); assert.equal(v.state, 'ready'); await a.close();
  const b = await setup({ dir, policy: { scope: 'map6-later' } }), again = await jcall(b.handle, 'GET', `/${x.id}`, x.cap);
  assert.deepEqual([again.result, again.execution], [v.result, v.execution]); assert.equal(again.execution.scope, 'first');
});

test('112-6 the browser reads the executor scope from status; an unknown value is not shown as a scope', async () => {
  const saved = globalThis.fetch;
  try {
    for (const [scope, want] of [['map6-later', 'map6-later'], ['first', 'first'], ['everything', undefined]]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ ai: 'off', model: null, access: 'open', map: { model: 'fake-model-102', prompt: await mapPromptId(), via: 'jobs' },
        jobs: { version: 'map-job.1', durable: true, executor: { id: 'codex-cli-preview.102', model: 'fake-model-102', scope, state: 'ready', problem: null, policy: 'x' } } }));
      const st = await aiStatus(); assert.equal(st.jobs.executor.scope, want, scope); assert.equal(st.ai, 'off', 'the other AI features stay as ai says');
    }
  } finally { globalThis.fetch = saved; }
});
