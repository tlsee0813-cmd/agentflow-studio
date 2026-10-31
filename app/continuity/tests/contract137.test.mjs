// AF137: a map.7 reply refused by a generic guard of validateMapReply now says where (a static path) and which (rule 'contract', a
// fixed category) through the existing MapReplyError, executor detail and job receipt. The same conditions at the same places:
// accept/reject and the accepted value do not change (compared with the base build by docs/cycles/2026-10-30-contract-diagnostics-137/
// compare-base.mjs on this corpus); map.1–6 refuse as before; structured refusals that existed before are as they were. Synthetic
// and model-free; it says nothing of why the real 136 reply was refused (that reply was not kept).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as S from '../dist/public/shared/storage.js';
import * as J from '../dist/public/shared/map-job.js';
import * as R from '../dist/public/shared/request-return.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import { emptyBundle } from '../dist/public/client/plan-store.js';
import { createStudioHandler, map7PromptId } from '../server/studio.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import { openCliExecutor } from '../../../docs/cycles/2026-10-29-owned-cli-preview-102/preview/cli-executor.mjs';
import { corpus, outcome, MARKERS } from './contract137-corpus.mjs';

const mods = { D, M, C, S, studioView, emptyBundle, parseProject };
const sha = t => createHash('sha256').update(t).digest('hex');
const tick = () => new Promise(r => setTimeout(r, 5));
// PCRUN100: a map.7 item that breaks a rule of its own is set aside (the rest read), with the refusal it would have been: judged
// here as that refusal. What refuses the whole reply (its shape, the summary, …) is the outcome itself.
const judge = x => { const o = outcome(M.validateMapReply, x), a = o.ok && M.setAside(o.value)[0]; return a ? { ok: true, aside: true, value: o.value, name: a.name, message: a.message, path: a.path, rule: a.rule, target: a.target } : o; };
const until = async (f, why, n = 3000) => { for (let i = 0; i < n; i++) { if (await f()) return; await tick(); } assert.fail(`timed out: ${why}`); };

test('137-1 map.7 generic refusals: static path, rule contract, fixed category; no value, key, marker or message; the wire unchanged', () => {
  const cases = corpus(mods).filter(x => x.expect);
  assert.ok(cases.length >= 30);
  const paths = new Set();
  for (const x of cases) {
    const before = JSON.stringify(x.reply), o = judge(x);
    assert.deepEqual([!o.ok || o.aside, o.name, o.message], [true, 'MapReplyError', 'INVALID_RESPONSE'], x.name);
    if (o.aside) for (const m of MARKERS) assert.ok(!JSON.stringify(o.value).includes(m), `${x.name}: nothing set aside is kept (${m})`);
    assert.deepEqual([o.path, o.rule, o.target], x.expect, x.name);
    assert.match(o.path, /^(reply|summary|gaps|parts|relations|candidates|material|matches)(\[\d+\])?(\.(parent|name|basis|claims|kind|text|replaces|note|statement|what|at|targets|about|roleAboutAt))*(\[\d+\])?(\.(kind|text|replaces))?$/, `${x.name}: a static path`);
    for (const m of [...MARKERS, 'Error', 'at ', '\n']) assert.ok(!JSON.stringify([o.path, o.target]).includes(m), `${x.name}: ${m}`);
    assert.equal(JSON.stringify(x.reply), before, `${x.name}: wire not changed`);
    paths.add(o.path.replace(/\[\d+\]/g, '[]'));
  }
  assert.ok(paths.size >= 15, `several nested places (${paths.size})`);
});

test('137-2 the lawful reply is accepted the same way twice; map.6 refusals stay plain; refusals structured before 137 are unchanged', () => {
  const all = corpus(mods), lawful = all.filter(x => x.name.endsWith(':lawful'));
  for (const x of lawful) { const a = outcome(M.validateMapReply, x), b = outcome(M.validateMapReply, x); assert.ok(a.ok, x.name); assert.deepEqual(a.value, b.value); }
  for (const x of all.filter(x => x.schema === 6 && !x.name.includes('lawful') && !x.name.includes('kept'))) {
    const o = outcome(M.validateMapReply, x); assert.deepEqual([o.ok, o.name, o.message, o.path], [false, 'Error', 'INVALID_RESPONSE', undefined], x.name);
  }
  const kept = Object.fromEntries(all.filter(x => x.name.includes('kept')).map(x => [x.name, judge(x)]).map(([n, o]) => [n, [o.path, o.rule]]));
  assert.deepEqual(kept['7:kept: condition not-anchor'], ['matches[1].aboutAt', 'reference']); assert.deepEqual(kept['7:kept: invalid new key'], ['parts[0].ref', 'reference']);
  assert.deepEqual(kept['7:kept: condition-length'], ['parts[1].claims[0].aboutAt', 'condition-length']); assert.deepEqual(kept['7:kept: claim key'], ['parts[1].claims[0].key', 'reference']);
  assert.deepEqual(kept['6:kept: source-kind'], ['matches[1].kind', 'source-kind']);
});

test('137-3 the standard /map route and a CLI job carry the diagnosis to the client and the failed receipt (no model)', async () => {
  const fault = corpus(mods).find(x => x.name === '7:summary over 200'), FAKE = fileURLToPath(new URL('./fake-cli102.mjs', import.meta.url));
  // /map: the provider's reply refused with its detail.
  const handle0 = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-137', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(fault.reply) } }] }), { status: 200 }) });
  const r0 = await handle0(new Request('http://127.0.0.1/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1' }, body: JSON.stringify(fault.ask) }));
  assert.equal(r0.status, 502); assert.deepEqual((await r0.json()).error, { code: 'INVALID_RESPONSE', detail: { path: 'summary', rule: 'contract', target: 'text' } });
  // A CLI job (the 102 fake answers with the file as written): failed, its receipt keeping the detail, one child.
  const ctl = mkdtempSync(join(tmpdir(), 'af137-ctl-')), dir = mkdtempSync(join(tmpdir(), 'af137-jobs-')), state = mkdtempSync(join(tmpdir(), 'af137-state-'));
  writeFileSync(join(ctl, 'mode'), 'file');
  const policy = { executor: 'codex-cli-preview.102', exe: process.execPath, binarySha256: sha(readFileSync(process.execPath)), version: 'fake-cli 102-test', versionArgs: [FAKE, '--version', '--ctl', ctl],
    args: [FAKE, '--ctl', ctl, '--final', '{final}', '--cwd', '{cwd}', '--model', '{model}', '--reasoning', '{reasoning}'], model: 'fake-model-102', reasoning: 'high', selectionMs: 20000, verdictMs: 21000, scope: 'map7-later' };
  const jobs = await openMapJobs({ dir }), executor = await openCliExecutor({ policy, stateDir: state }), handle = createStudioHandler({ env: { STUDIO_REQUESTS_PER_MINUTE: '60' }, jobs, mapExecutor: executor });
  try {
    // A job carries its whole input (map-input.1), so the same fault is written for a freshly built ask of the same case.
    const K = await import('./condition116-case.mjs'), cp = K.conditionProject(mods), p = parseProject(JSON.stringify(cp.project)), inp = M.buildMapAsk(p, studioView(p), [cp.rq], cp.rq.id, M.MAP7_SCHEMA);
    const reply = K.replyFor7(inp.ask, inp.records); reply.summary = `SECRET_MARKER_137 ${'x'.repeat(200)}`;
    writeFileSync(join(ctl, 'reply-1.json'), JSON.stringify(reply));
    const wire = J.encodeMapInput(inp), cap = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'), id = `MJ_${crypto.randomUUID()}`;
    const binding = { entryId: 'E_diag00137-1', projectId: p.id, lifecycle: 1, seq: 1, after: inp.after, schemaVersion: 'studio.map.7', prompt: await map7PromptId(), model: 'fake-model-102', askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
    const call = async (method, path, body) => { const r = await handle(new Request(`http://127.0.0.1/api/studio/jobs${path}`, { method, headers: { 'x-agentflow-request': '1', 'x-studio-operation': cap, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body } : {}) })); return { status: r.status, ...(await r.json()) }; };
    assert.equal((await call('POST', '', JSON.stringify({ version: 'map-job.1', id, binding, input: wire }))).status, 202);
    let v; await until(async () => !['accepted', 'running'].includes((v = await call('GET', `/${id}`)).state), 'ended');
    assert.deepEqual([v.state, v.error], ['failed', { code: 'INVALID_RESPONSE', detail: { path: 'summary', rule: 'contract', target: 'text' } }]);
    const file = readdirSync(join(dir, 'ops')).find(f => f.startsWith(id)), kept = readFileSync(join(dir, 'ops', file), 'utf8');
    assert.ok(kept.includes('"rule":"contract"') && kept.includes('"path":"summary"') && !kept.includes('SECRET_MARKER_137'), 'the durable receipt keeps the diagnosis, not the value');
    assert.equal(readFileSync(join(ctl, 'invocations'), 'utf8').split('\n').filter(Boolean).length, 1, 'one child, no retry');
  } finally { await jobs.close(); await executor.close(); }
});

test('137-4 only the request-match rules\' own refusal is match-contract; an unexpected exception there stays the generic refusal', () => {
  const all = corpus(mods), stance = all.find(x => x.name === '7:match stance'), m0 = stance.reply.matches[0];
  // The refusal the tag stands for is validateRequestMatch's own (INVALID_REQUEST_SCOPE), on the very wire the validator hands it.
  const wire = { record: 'N01', quote: 'q', ...Object.fromEntries(Object.entries(m0).filter(([k]) => k !== 'at' && k !== 'aboutAt')), about: null };
  assert.throws(() => R.validateRequestMatch(wire, stance.ask.requests, true, 600), e => e.constructor === Error && e.message === 'INVALID_REQUEST_SCOPE');
  const o = judge(stance); assert.deepEqual([o.name, o.path, o.rule, o.target], ['MapReplyError', 'matches[0]', 'contract', 'match-contract']);
  // An exception that is not that refusal (injected: a target whose field throws when read) is the generic refusal, map.7 and map.6.
  for (const schema of [7, 6]) {
    const x = all.find(c => c.name === `${schema}:lawful`), reply = structuredClone(x.reply), t = reply.matches[0].targets[0]; let read = 0;
    reply.matches[0].targets[0] = { itemId: t.itemId, get requestId() { read++; throw new TypeError('INJECTED_137 unexpected'); } };
    const u = outcome(M.validateMapReply, { ...x, reply });
    assert.deepEqual([u.ok, u.name, u.message, u.path], [false, 'Error', 'INVALID_RESPONSE', undefined], `map.${schema}: not said as a contract guard`);
    assert.equal(read, 1, 'thrown at its first read, inside the request-match rules'); assert.ok(!JSON.stringify(u).includes('INJECTED_137'), 'no exception message carried');
  }
});
