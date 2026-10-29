// AF118: condition-length guidance in the map.7 instructions. The prompt actually sent for a later studio.map.7 ask is the
// unchanged MAP7_PROMPT plus rows computed from that ask: [start piece, last end within 80 | null, last end within 200 | null]. The
// ask, the wire, the validator and what is stored do not change. The rows are checked against an independent exact resolver (all
// ranges of every start) and against the validator itself; the standard provider and the CLI executor send the same rendering;
// map1–6/FIRST6 and the base MAP7 text are byte for byte as before; a ready7 job written by the pre118 producer (f91e9ee,
// docs/cycles/2026-10-30-condition-selection-118/make-ready7.mjs) is recovered under its own binding with no call. Model-free.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as S from '../dist/public/shared/storage.js';
import * as J from '../dist/public/shared/map-job.js';
import * as G from '../dist/public/shared/condition-guidance.js';
import { encodeSpans, resolveRange } from '../dist/public/shared/evidence-span.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import { emptyBundle } from '../dist/public/client/plan-store.js';
import { createMapRun } from '../dist/public/client/map-run.js';
import { JobReservations, JOBS_KEY } from '../dist/public/client/map-jobs.js';
import { createStudioHandler, callStudioModel, mapPromptId, map7PromptId } from '../server/studio.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import * as P from '../server/map-prompt.mjs';
import { openCliExecutor, wrap, WRAPPER_PREFIX, WRAPPER_SUFFIX } from '../../../docs/cycles/2026-10-29-owned-cli-preview-102/preview/cli-executor.mjs';
import * as K from './condition116-case.mjs';

const mods = { D, M, C, S, studioView, emptyBundle };
const sha = t => createHash('sha256').update(t).digest('hex');
const bytes = t => new TextEncoder().encode(t).length;
const tick = () => new Promise(r => setTimeout(r, 5));
const until = async (f, why, n = 3000) => { for (let i = 0; i < n; i++) { if (await f()) return; await tick(); } assert.fail(`timed out: ${why}`); };
/** The 117 diagnosis row (docs/cycles/2026-10-30-condition-return-117/evidence/diagnosis.json rawText): 204 units once trimmed. */
const ROW117 = JSON.parse(readFileSync(fileURLToPath(new URL('../../../docs/cycles/2026-10-30-condition-return-117/evidence/diagnosis.json', import.meta.url)), 'utf8')).rawText;
const line = (head, n) => (head + ' ' + '-'.repeat(n)).slice(0, n);
/** Synthetic boundary lines (one piece each unless said): 79/80/81/199/200/201, emoji (two units each), short lines that join. */
const L = { l79: line('조건79: release/3.0 · Node 22', 79), l80: line('조건80: release/3.0 · Node 22', 80), l81: line('조건81: release/3.0 · Node 22', 81),
  l199: line('배포199: staging · 태그 t-2411', 199), l200: line('배포200: staging · 태그 t-2411', 200), l201: line('배포201: staging · 태그 t-2411', 201),
  emoji: ('환경: 🙂🙂 ' + '='.repeat(80)).slice(0, 80), emoji81: ('환경: 🙂🙂🙂 ' + '='.repeat(80)).slice(0, 81) };
const BOUNDARY = ['경계 보고 118', L.l79, L.l80, L.l81, L.l199, L.l200, L.l201, '', L.emoji, L.emoji81, '',
  '  환경: Ubuntu 24.04  \r', '판본: v3.0.1   ', '', ROW117.replace(/\n$/, ''), '| 2 | 다른 행 | 결과 |', '', '```', 'const mode = "webp"; // 코드 줄', '```', '마지막 문단입니다. 두 번째 문장입니다.'].join('\n');
assert.equal(L.emoji.length, 80); assert.equal(L.emoji81.length, 81); assert.ok(/[\uD800-\uDBFF]$/.test(L.emoji81) === false && /[\uD800-\uDBFF]$/.test(L.emoji) === false, 'no lone surrogate at the cut');

function boundaryAsk() {
  const c = K.conditionProject(mods); let p = parseProject(JSON.stringify(c.project));
  p = D.pasteRecord(p, BOUNDARY, null).project;
  const inp = M.buildMapAsk(p, studioView(p), [c.rq], c.rq.id, M.MAP7_SCHEMA);
  assert.equal(inp.problem, null); assert.equal(inp.ask.schemaVersion, 'studio.map.7');
  return { ...c, p, inp, rec: inp.ask.records.find(r => inp.records.get(r.id).text === BOUNDARY).id };
}
const later = () => { const c = K.conditionProject(mods), p = parseProject(JSON.stringify(c.project)); return { ...c, p, inp: M.buildMapAsk(p, studioView(p), [c.rq], c.rq.id, M.MAP7_SCHEMA) }; };
/** Independent oracle: every range [a, b] of every record through the existing resolver, its trimmed length, no early stop. */
function oracle(ask) {
  const texts = M.askRecords(ask), out = [];
  for (const r of ask.records) {
    const t = texts.get(r.id), alias = i => r.spans[i].s;
    for (let a = 0; a < r.spans.length; a++) {
      const fits = max => { const ok = []; for (let b = a; b < r.spans.length; b++) { const ref = b === a ? alias(a) : `${alias(a)}-${alias(b).split('.')[1]}`, at = resolveRange(ref, r.id, t.text, t.spans), w = t.text.slice(at.from, at.to).trim(); if (w && w.length <= max) ok.push(b); } return ok; };
      const end = ok => { if (!ok.length) return null; assert.equal(ok[0], a, 'admitted ends start at the start'); assert.deepEqual(ok, ok.map((_, i) => a + i), 'admitted ends are contiguous'); return alias(ok.at(-1)); };
      out.push([alias(a), end(fits(80)), end(fits(200))]);
    }
  }
  return out;
}
const piece = (ask, rec, words) => K.piece(ask, rec, words);
const rowOf = (rows, alias) => rows.find(r => r[0] === alias);

test('118-1 rows equal the independent oracle and the boundaries 79/80/81, 199/200/201, emoji, CRLF/outer white space, the 204-unit table row', () => {
  const { inp, rec } = boundaryAsk(), rows = G.conditionGuidance(inp.ask);
  assert.deepEqual(rows, oracle(inp.ask), 'every start, both bounds, exactly the ranges the resolver admits');
  assert.equal(rows.length, inp.ask.records.reduce((n, r) => n + r.spans.length, 0), 'one row per sent piece, in order');
  assert.deepEqual(rows.map(r => r[0]), inp.ask.records.flatMap(r => r.spans.map(s => s.s)));
  const at = w => piece(inp.ask, rec, w), row = w => rowOf(rows, at(w));
  assert.equal(row('조건79:')[1], at('조건79:'), '79 fits 80, the next line does not join'); assert.equal(row('조건80:')[1], at('조건80:'), 'exactly 80');
  assert.equal(row('조건81:')[1], null, '81 is over'); assert.equal(row('조건81:')[2], at('조건81:'));
  assert.equal(row('배포199:')[2], at('배포199:')); assert.equal(row('배포200:')[2], at('배포200:'), 'exactly 200'); assert.deepEqual(row('배포201:').slice(1), [null, null]);
  assert.equal(row('환경: 🙂🙂 ')[1], at('환경: 🙂🙂 '), '80 units with surrogate pairs'); assert.equal(row('환경: 🙂🙂🙂')[1], null, '81 units');
  // Outer white space is trimmed, the CRLF inside is counted: the two short lines join within 80.
  const env = at('환경: Ubuntu'), ver = at('판본: v3.0.1'); assert.equal(row('환경: Ubuntu')[1], ver);
  const t = M.askRecords(inp.ask).get(rec), r2 = resolveRange(`${env}-${ver.split('.')[1]}`, rec, t.text, t.spans);
  assert.equal(t.text.slice(r2.from, r2.to).trim(), '환경: Ubuntu 24.04  \r\n판본: v3.0.1');
  assert.deepEqual(row('| 6d9c2ab').slice(1), [null, null], 'the 117 table row (204 units) fits neither slot');
  assert.equal(ROW117.trim().length, 204);
  assert.notEqual(row('| 2 | 다른 행')[1], null, 'a short table row is eligible (its end may reach later short pieces; the oracle fixes which)');
});

test('118-2 the validator agrees at every listed end and one past it; the rows never widen what it admits', () => {
  const { inp, rec } = boundaryAsk(), rows = G.conditionGuidance(inp.ask), r = inp.ask.records.find(x => x.id === rec), q = inp.ask.requests[0];
  const reply = (aboutAt, matchAt) => ({ summary: '', relations: [], candidates: [], gaps: [], material: [],
    parts: [{ ref: 'P01', name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [], claims: [{ kind: 'describes', text: '경계 검사', at: r.spans[0].s, aboutAt, replaces: null, key: 's1' }] }],
    matches: matchAt === undefined ? [] : [{ at: r.spans[0].s, text: '경계', kind: 'reported', stance: 'unclear', aboutAt: matchAt, targets: [{ requestId: q.id, itemId: 'change_1' }], why: '스텁', replaces: null }] });
  const ok = f => { try { f(); return true; } catch (e) { assert.ok(['condition-length', 'material-evidence'].includes(e.rule) || e.message === 'INVALID_RESPONSE', String(e.rule)); return false; } };
  const idx = alias => r.spans.findIndex(s => s.s === alias), ref = (a, b) => a === b ? r.spans[a].s : `${r.spans[a].s}-${r.spans[b].s.split('.')[1]}`;
  let checked = 0;
  for (const [start, e80, e200] of rows.filter(x => x[0].startsWith(`${rec}.`))) {
    const a = idx(start);
    for (const [end, slot] of [[e80, 'claim'], [e200, 'match']]) {
      const run = b => ok(() => M.validateMapReply(slot === 'claim' ? reply(ref(a, b)) : reply(null, ref(a, b)), inp.ask));
      if (end === null) assert.equal(run(a), false, `${start} ${slot}: even the start alone is refused`);
      else { const b = idx(end); assert.equal(run(b), true, `${start}-${end} ${slot}`); if (b + 1 < r.spans.length) assert.equal(run(b + 1), false, `${start} one past ${end} ${slot}`); }
      checked++;
    }
  }
  assert.ok(checked >= 20);
});

test('118-3 nothing of the ask changes; the rendering is deterministic, carries no record text, and the base texts are pre118 byte for byte', async () => {
  const { inp } = boundaryAsk(), before = JSON.stringify(inp.ask), one = P.map7Prompt(inp.ask), two = P.map7Prompt(JSON.parse(before));
  assert.equal(JSON.stringify(inp.ask), before); assert.equal(one, two); assert.ok(one.startsWith(P.MAP7_PROMPT)); assert.equal(one, P.MAP7_PROMPT + P.map7Guidance(inp.ask));
  const block = P.map7Guidance(inp.ask), json = block.slice(block.lastIndexOf('\n[\n') + 1, block.lastIndexOf('\n]') + 2);
  assert.deepEqual(JSON.parse(json), G.conditionGuidance(inp.ask));
  for (const v of JSON.parse(json).flat()) assert.ok(v === null || /^[NR]\d{2,3}\.\d{2,3}$/.test(v), 'aliases and nulls only');
  for (const t of ['release/2.4', '6d9c2ab', 'Ubuntu', K.CODE_META.version, K.CHECK_META.version, '배포200']) assert.ok(!block.includes(t), `no record or declaration text: ${t}`);
  assert.ok(block.startsWith(P.MAP7_GUIDANCE_FRAME.head) && block.endsWith(P.MAP7_GUIDANCE_FRAME.tail));
  const h = t => sha(t).slice(0, 16);
  assert.deepEqual([P.MAP_PROMPT, P.MAP2_PROMPT, P.MAP3_PROMPT, P.MAP4_PROMPT, P.MAP4_FIRST_PROMPT, P.MAP5_PROMPT, P.MAP5_FIRST_PROMPT, P.MAP6_PROMPT, P.MAP6_FIRST_PROMPT].map(h),
    ['a15660a3a3e7bbe2', '53ef9b4d18d8c6b3', '6ad411b7e893733f', '5317421405406135', '4c8523a1402ca9fa', '6ce308f841f5851c', '37a8237254d69607', '24b6596338d073fa', 'cef94b26c23e8c3c']);
  assert.deepEqual([P.MAP4_RECIPE, P.MAP5_RECIPE, P.MAP6_RECIPE].map(h), ['0340413adccd30ac', 'b432f60e7d61d502', '8071e83eafdae2cd']);
  assert.equal(sha(P.MAP7_PROMPT), '73286f8b79e80c132aaa5e891d7955748e30fd21bf9e3e7f641ec37b6e480f4b', 'the base map.7 text of pre118 (117 systemSha)');
  assert.equal(await mapPromptId(), 'm6-6859b864664f');
  assert.ok(P.MAP7_RECIPE.startsWith('map7-recipe.2:') && P.MAP7_RECIPE.includes(G.CONDITION_GUIDANCE));
  const m7 = await map7PromptId(); assert.match(m7, /^m7-[0-9a-f]{12}$/); assert.notEqual(m7, 'm7-1a2625a62324', 'a new recipe id (pre118 named m7-1a2625a62324)');
  assert.throws(() => G.conditionGuidance({ ...inp.ask, schemaVersion: 'studio.map.6' }), /INVALID_INPUT/, 'map.7 only');
});

test('118-4 the largest valid ask fits (1600 rows, block within 65536 bytes); an ask past it is refused before anything is sent', async () => {
  // Four records of 400 one-character lines each (three-digit piece aliases) with one part: the most rows a valid ask can have.
  const record = (id, n = 400) => { const w = encodeSpans(id, Array.from({ length: n }, (_, i) => `${i % 10}`).join('\n')); return { id, kind: 'pasted', lead: w.lead, spans: w.spans, note: '', basis: '붙여넣은 기록' }; };
  const ask = { schemaVersion: 'studio.map.7', project: { name: '최대 118', purpose: null }, relations: [], requests: [], priors: [],
    parts: [{ id: 'P01', name: '부분', note: '', parentId: null, readAs: null, role: '', roleBy: null, roleAbout: null, current: [] }], records: ['N01', 'N02', 'N03', 'N04'].map(id => record(id)) };
  M.validateMapAsk(JSON.parse(JSON.stringify(ask)));
  const rows = G.conditionGuidance(ask), block = P.map7Guidance(ask), prompt = P.map7Prompt(ask);
  assert.equal(rows.length, 1600); assert.ok(bytes(block) <= P.GUIDANCE_BYTES_MAX, `${bytes(block)}`);
  assert.deepEqual(rows.at(-1), ['N04.400', 'N04.400', 'N04.400']);
  const real = later().inp.ask, size = { maxRows: rows.length, maxBlockBytes: bytes(block), maxPromptBytes: bytes(prompt), baseBytes: bytes(P.MAP7_PROMPT), caseRows: G.conditionGuidance(real).length, caseBlockBytes: bytes(P.map7Guidance(real)) };
  test.diagnostic?.(JSON.stringify(size)); console.log(`# AF118 guidance size ${JSON.stringify(size)}`);
  // Past the bound (five records, not a valid ask): refused before any call, by the provider path and by the CLI.
  const over = { ...ask, records: [...ask.records, record('N05')] };
  assert.throws(() => P.map7Prompt(over), /INPUT_TOO_LARGE/);
  let calls = 0; await assert.rejects(callStudioModel(over, { apiKey: 'k', model: 'm', timeoutMs: 1000 }, { fetchImpl: async () => { calls++; throw new Error('no'); } }), e => e.code === 'INPUT_TOO_LARGE');
  assert.equal(calls, 0);
});

/* ---------- the same rendering on both routes ---------- */
const providerReply = content => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }), { status: 200 });
function provider() { const seen = []; return { seen, fetchImpl: async (url, init) => { const body = JSON.parse(init.body), ask = JSON.parse(body.messages[1].content.replace(/^INPUT JSON \(자료\):\n/, '')); seen.push({ system: body.messages[0].content, ask }); return providerReply(JSON.stringify(ask.schemaVersion === 'studio.map.7' ? K.replyFor7(ask, M.askRecords(ask)) : K.replyFor6(ask, M.askRecords(ask)))); } }; }
const jcall = async (h, method, path, cap, body) => {
  const res = await h(new Request(`http://127.0.0.1/api/studio/jobs${path}`, { method, headers: { 'x-agentflow-request': '1', 'x-studio-operation': cap, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body } : {}) }));
  return { status: res.status, ...(await res.json()) };
};
const newCap = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
async function submission(inp, p, prompt, model, entryId = 'E_cond0118-01') {
  const id = `MJ_${crypto.randomUUID()}`, wire = J.encodeMapInput(inp);
  const binding = { entryId, projectId: p.id, lifecycle: 1, seq: 1, after: inp.after, schemaVersion: inp.ask.schemaVersion, prompt, model, askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
  return { id, cap: newCap(), binding, body: JSON.stringify({ version: 'map-job.1', id, binding, input: wire }) };
}

test('118-5 standard provider: /map and the job send map7Prompt(ask); an old m7 binding is refused as changed, never rebound', async () => {
  const prov = provider(), dir = mkdtempSync(join(tmpdir(), 'af118-jobs-')), jobs = await openMapJobs({ dir });
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-118', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl: prov.fetchImpl, jobs });
  try {
    const st = await (await handle(new Request('http://127.0.0.1/api/studio/status'))).json();
    assert.deepEqual(st.map, { model: 'deepseek-flash', prompt: await mapPromptId(), laterPrompt: await map7PromptId() });
    const { p, inp } = boundaryAsk(), body = JSON.stringify(inp.ask);
    const res = await handle(new Request('http://127.0.0.1/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1' }, body }));
    assert.equal(res.status, 200); assert.equal(prov.seen[0].system, P.map7Prompt(inp.ask)); assert.deepEqual(prov.seen[0].ask, inp.ask, 'the ask as sent');
    const stale = await submission(inp, p, 'm7-1a2625a62324', 'deepseek-flash', 'E_cond0118-02');
    const r = await jcall(handle, 'POST', '', stale.cap, stale.body); assert.deepEqual([r.status, r.error.code], [409, 'PROMPT_CHANGED']); assert.equal(prov.seen.length, 1, 'no call');
    const x = await submission(inp, p, await map7PromptId(), 'deepseek-flash');
    assert.equal((await jcall(handle, 'POST', '', x.cap, x.body)).status, 202);
    let v; await until(async () => (v = await jcall(handle, 'GET', `/${x.id}`, x.cap)).state === 'ready', 'ready');
    assert.equal(prov.seen[1].system, P.map7Prompt(inp.ask)); assert.equal(sha(prov.seen[1].system), sha(prov.seen[0].system), 'one rendering for both');
    const back = J.decodeMapInput(v.input), applied = M.applyReading(p, back, M.validateMapReply(v.result.wire, back.ask), { id: 'R_118-job', at: new Date().toISOString(), model: 'm', prompt: v.result.prompt, hash: v.result.askHash });
    assert.equal(parseProject(S.serializeProject(applied.project)).readings.at(-1).version, 'map-reading.5');
    // A later map.6 (an old client) keeps the bare map.6 prompt.
    const six = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA); assert.equal(six.problem, null);
    await handle(new Request('http://127.0.0.1/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1' }, body: JSON.stringify(six.ask) }));
    assert.equal(prov.seen.at(-1).system, P.MAP6_PROMPT);
  } finally { await jobs.close(); }
});

const FAKE = fileURLToPath(new URL('./fake-cli102.mjs', import.meta.url)), NODE_SHA = sha(readFileSync(process.execPath));
async function cli(modes = ['file']) {
  const ctl = mkdtempSync(join(tmpdir(), 'af118-ctl-')), dir = mkdtempSync(join(tmpdir(), 'af118-cjobs-')), state = mkdtempSync(join(tmpdir(), 'af118-state-'));
  writeFileSync(join(ctl, 'mode'), modes.join('\n'));
  const policy = { executor: 'codex-cli-preview.102', exe: process.execPath, binarySha256: NODE_SHA, version: 'fake-cli 102-test', versionArgs: [FAKE, '--version', '--ctl', ctl],
    args: [FAKE, '--ctl', ctl, '--final', '{final}', '--cwd', '{cwd}', '--model', '{model}', '--reasoning', '{reasoning}'], model: 'fake-model-102', reasoning: 'high', selectionMs: 20000, verdictMs: 21000, scope: 'map7-later' };
  const jobs = await openMapJobs({ dir }), executor = await openCliExecutor({ policy, stateDir: state });
  return { ctl, state, jobs, executor, handle: createStudioHandler({ env: { STUDIO_REQUESTS_PER_MINUTE: '60' }, jobs, mapExecutor: executor }), close: async () => { await jobs.close(); await executor.close(); } };
}

test('118-6 CLI: prepare binds the rendered prompt by schema path; another ask or binding between prepare and spawn starts nothing; one run', async () => {
  const s = await cli(['file']);
  try {
    const { p, inp } = boundaryAsk(), other = later().inp.ask, f = D.pasteRecord(D.createProject(), K.REQUIREMENT, null).project, first6 = M.buildMapAsk(f, studioView(f), [], undefined, M.MAP6_SCHEMA).ask;
    const bound = await s.executor.prepare(inp.ask);
    assert.deepEqual([bound.promptKind, bound.promptSha256, bound.prompt, bound.askSha256], ['later7', sha(P.map7Prompt(inp.ask)), sha(P.map7Prompt(inp.ask)).slice(0, 12), sha(JSON.stringify(inp.ask))]);
    const b6 = await s.executor.prepare(first6); assert.deepEqual([b6.promptKind, b6.promptSha256], ['first', sha(P.MAP6_FIRST_PROMPT)], 'FIRST6 as before');
    assert.equal(wrap(inp.ask), WRAPPER_PREFIX + P.map7Prompt(inp.ask) + WRAPPER_SUFFIX + JSON.stringify(inp.ask), 'stdin is the wrapper around the rendering');
    const cases = [[other, bound, 'another later ask (other guidance)'], [inp.ask, { ...bound, promptSha256: sha(P.MAP7_PROMPT) }, 'the bare pre118 text'],
      [inp.ask, { ...bound, prompt: sha(P.MAP7_PROMPT).slice(0, 12) }, 'the bare prompt id'], [inp.ask, { ...bound, promptKind: 'later' }, 'kind']];
    for (const [ask, b, why] of cases) {
      const release = s.executor.acquire(`direct-${why}`);
      await assert.rejects(s.executor.call(ask, new AbortController().signal, b), e => e.code === 'EXECUTOR_CHANGED', why);
      release();
    }
    assert.ok(!existsSync(join(s.ctl, 'invocations')), 'no child for any of them');
    writeFileSync(join(s.ctl, 'reply-1.json'), JSON.stringify(K.replyFor7(inp.ask, inp.records)));
    const x = await submission(inp, p, await map7PromptId(), 'fake-model-102');
    assert.equal((await jcall(s.handle, 'POST', '', x.cap, x.body)).status, 202);
    let v; await until(async () => !['accepted', 'running'].includes((v = await jcall(s.handle, 'GET', `/${x.id}`, x.cap)).state), 'ended');
    assert.equal(v.state, 'ready', JSON.stringify(v.error)); assert.deepEqual([v.execution.promptKind, v.execution.promptSha256], ['later7', sha(P.map7Prompt(inp.ask))]);
    assert.equal(readFileSync(join(s.ctl, 'invocations'), 'utf8').split('\n').filter(Boolean).length, 1);
    // An ask whose guidance cannot be rendered is refused at prepare (no lease, no child).
    const rec = id => { const w = encodeSpans(id, Array.from({ length: 400 }, (_, i) => `${i % 10}`).join('\n')); return { id, kind: 'pasted', lead: w.lead, spans: w.spans, note: '', basis: 'b' }; };
    await assert.rejects(s.executor.prepare({ ...inp.ask, records: ['N01', 'N02', 'N03', 'N04', 'N05'].map(rec) }), e => e.code === 'INPUT_TOO_LARGE');
  } finally { await s.close(); }
});

/* ---------- an old ready7 of the pre118 producer ---------- */
function locks() {
  const chains = new Map(), held = new Set();
  return { request(name, a, b) {
    const opts = typeof a === 'function' ? {} : a, cb = typeof a === 'function' ? a : b;
    if (opts.ifAvailable && held.has(name)) return Promise.resolve(cb(null));
    const next = (chains.get(name) ?? Promise.resolve()).then(async () => { held.add(name); try { return await cb({ name }); } finally { held.delete(name); } });
    chains.set(name, next.catch(() => {})); return next;
  } };
}
let savedFetch;
test.before(() => { savedFetch = globalThis.fetch; });
test.afterEach(() => { globalThis.fetch = savedFetch; });

test('118-7 a lawful ready7 written by the pre118 producer is recovered with its own input and m7-1a2625a62324 binding: applied, no call', async () => {
  const fixture = fileURLToPath(new URL('./fixtures/ready7-118/', import.meta.url)), manifest = JSON.parse(readFileSync(join(fixture, 'manifest.json'), 'utf8'));
  assert.equal(manifest.producer.commit, 'f91e9ee99eb67a5c75864207e13feeae9565659f'); assert.equal(manifest.producer.status.laterPrompt, 'm7-1a2625a62324');
  assert.equal(manifest.producer.sentPromptSha256, sha(P.MAP7_PROMPT), 'it was asked with the bare pre118 text');
  for (const [f, h] of Object.entries(manifest.files)) assert.equal(sha(readFileSync(join(fixture, f))), h, `${f} as written`);
  const dir = mkdtempSync(join(tmpdir(), 'af118-ready7-')); cpSync(fixture, dir, { recursive: true });
  let calls = 0; const jobs = await openMapJobs({ dir });
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-118', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl: async () => { calls++; throw new Error('no call'); }, jobs });
  try {
    const st = await (await handle(new Request('http://127.0.0.1/api/studio/status'))).json();
    assert.notEqual(st.map.laterPrompt, manifest.job.prompt, 'the server now names the new m7');
    const v = await jcall(handle, 'GET', `/${manifest.job.id}`, manifest.job.cap);
    assert.deepEqual([v.state, v.binding.schemaVersion, v.binding.prompt, v.result.prompt], ['ready', 'studio.map.7', 'm7-1a2625a62324', 'm7-1a2625a62324']);
    const project = parseProject(JSON.stringify(manifest.project)), kv = (() => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, x) => m.set(k, x) }; })();
    kv.setItem(JOBS_KEY, JSON.stringify({ version: 'map-jobs.1', ops: [{ id: manifest.job.id, cap: manifest.job.cap, binding: v.binding, receipt: true, applied: null, outcome: null, reservedAt: new Date().toISOString() }] }));
    globalThis.fetch = async (url, o = {}) => handle(new Request(`http://127.0.0.1${url}`, o));
    const w = { cur: { key: manifest.job.entryId, kind: 'saved', project, view: studioView(project), ref: { lifecycle: 1, seq: 1 } }, done: [] }, store = new JobReservations(kv, locks());
    const run = createMapRun({ current: () => w.cur, visit: () => w.cur, status: () => ({ ...st, ai: 'deepseek', jobs: { durable: true, problem: null } }), accessCode: () => '', requests: () => [], pollMs: 2, jobs: () => store,
      stored: () => ({ project: w.cur.project, lifecycle: 1 }), ownSave: () => false, commit: async next => { Object.assign(w.cur, { project: next, view: studioView(next), ref: { lifecycle: 1, seq: w.cur.ref.seq + 1 } }); return null; }, done: a => w.done.push(a), changed: () => {} });
    run.resume(); await until(() => run.state().ready, 'found ready'); await run.applyReady(); await until(() => w.done.length === 1, 'applied');
    const reading = w.done[0].reading;
    assert.deepEqual([reading.version, reading.prompt, reading.hash], ['map-reading.5', 'm7-1a2625a62324', manifest.job.askHash], 'its own binding, never the current recipe');
    assert.equal(reading.parts.find(x => !x.created).claims[0].about, K.COND_CRLF);
    assert.equal(calls, 0, 'no call'); assert.deepEqual(parseProject(S.serializeProject(w.cur.project)), w.cur.project);
    await until(async () => (await jcall(handle, 'GET', `/${manifest.job.id}`, manifest.job.cap)).acked === 'applied', 'acknowledged');
    run.dispose();
  } finally { await jobs.close(); }
  for (const [f, h] of Object.entries(manifest.files)) assert.equal(sha(readFileSync(join(fixture, f))), h, 'the producer files untouched');
});
