// AF120: the later map.7 instructions say the new part id vocabulary exactly as the validator reads it (^new:[a-z0-9_-]{1,24}$,
// references spelled as parts[].ref wrote them), and a map.7 reply refused at its parts first pass says where and a fixed category
// (never the ref). What is accepted, the order of checks and whole refusal are as before; map1–6 keep their plain refusal. The base
// MAP7 text, map1–6/FIRST6 and the 118 guidance are byte for byte as before; the recipe (map7-recipe.3) and the rendered prompt name
// the new part. Model-free; author-written synthetic replies on the 116 case (no 119 wire is used or repaired).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as S from '../dist/public/shared/storage.js';
import * as J from '../dist/public/shared/map-job.js';
import * as G from '../dist/public/shared/condition-guidance.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import { emptyBundle } from '../dist/public/client/plan-store.js';
import { createStudioHandler, mapPromptId, map7PromptId } from '../server/studio.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import * as P from '../server/map-prompt.mjs';
import * as K from './condition116-case.mjs';

const mods = { D, M, C, S, studioView, emptyBundle };
const sha = t => createHash('sha256').update(t).digest('hex');
const later = (anchored = M.MAP7_SCHEMA) => { const c = K.conditionProject(mods), p = parseProject(JSON.stringify(c.project)); return { ...c, p, inp: M.buildMapAsk(p, studioView(p), [c.rq], c.rq.id, anchored) }; };
const KEY24 = 'a'.repeat(10) + '0123456789' + '_-ab';
/** The lawful 116 reply with new parts under the given ids: a chain of parents, a relation and a candidate naming them. */
function withIds(ask, records, ids) {
  const w = K.replyFor7(ask, records), basis = [K.piece(ask, K.aliases(ask, records).report, '썸네일 생성기를')];
  ids.forEach((ref, i) => w.parts.push(K.part7(ref, { name: `새 부분 ${i + 1}`, parent: i === 0 ? 'P01' : ids[i - 1], basis })));
  w.relations.push({ from: ids[0], to: 'P01', kind: 'needs', note: '썸네일 생성에 쓰임', at: basis[0] });
  w.candidates.push({ text: '두 부분이 같은 대상인지 아직 정해지지 않았어요.', target: 'identity', parts: [ids.at(-1), 'P01'], at: null, statement: null });
  return w;
}
// A map.7 item set aside (PCRUN100) is its refusal too: the same path, rule and category, the rest of the reply read.
const refusal = f => { let r; try { r = f(); } catch (e) { return e; } const a = M.setAside(r)[0]; if (a) return a; assert.fail('not refused'); };

test('120-1 lowercase ids of 1–24 units with digits, _ and - are accepted; parent, relation and candidate spell them as written', () => {
  const { p, inp } = later(), ids = ['new:a', 'new:label_guide', 'new:label-guide', 'new:a0', `new:${KEY24}`];
  assert.equal(KEY24.length, 24);
  const reply = M.validateMapReply(withIds(inp.ask, inp.records, ids), inp.ask);
  assert.deepEqual(reply.parts.slice(2).map(x => [x.ref, x.parent]), ids.map((x, i) => [x, i === 0 ? 'P01' : ids[i - 1]]));
  assert.deepEqual([reply.relations[0].from, reply.candidates.at(-1).parts], [ids[0], [ids.at(-1), 'P01']]);
  const applied = M.applyReading(p, inp, reply, { id: 'R_120', at: new Date().toISOString(), model: 'm', prompt: 'm7-000000000120', hash: sha('R_120') });
  const saved = parseProject(S.serializeProject(applied.project)), names = saved.space.areas.map(a => a.name);
  for (let i = 1; i <= ids.length; i++) assert.ok(names.includes(`새 부분 ${i}`)); assert.deepEqual(saved.pasted, p.pasted, 'records untouched');
});

test('120-2 map.7 refusals at parts[i].ref: one fixed category each, never the ref; the wire is not changed; check order kept', () => {
  const { inp } = later(), ask = inp.ask;
  const cases = [['new:labelGuide', 'invalid-new-key'], ['new:', 'invalid-new-key'], [`new:${KEY24}x`, 'invalid-new-key'], ['new:라벨', 'invalid-new-key'], ['new:label guide', 'invalid-new-key'],
    ['NEW:label', 'unknown-part'], [' new:label', 'unknown-part'], ['P99', 'unknown-part'], ['labelGuide', 'unknown-part'], [7, 'invalid-ref'], [null, 'invalid-ref']];
  for (const [ref, target] of cases) {
    const w = withIds(ask, inp.records, ['new:x']); w.parts[2].ref = ref; const before = JSON.stringify(w);
    const e = refusal(() => M.validateMapReply(w, ask));
    assert.deepEqual([e.name, e.message, e.path, e.rule, e.target], ['MapReplyError', 'INVALID_RESPONSE', 'parts[2].ref', 'reference', target], String(ref));
    assert.equal(JSON.stringify(w), before, 'no lowercasing or reassignment');
  }
  const dup = withIds(ask, inp.records, ['new:x']); dup.parts.push(K.part7('new:x', { name: '다시', parent: null, basis: dup.parts[2].basis }));
  assert.deepEqual([refusal(() => M.validateMapReply(dup, ask)).path, refusal(() => M.validateMapReply(dup, ask)).target], ['parts[3].ref', 'duplicate-part']);
  // A reference spelled otherwise than its part is refused as before (no alias repair).
  for (const change of [w => { w.parts[3].parent = 'new:X'; }, w => { w.relations.at(-1).from = 'new:Label'; }, w => { w.candidates.at(-1).parts[0] = 'new:y'; }]) {
    const w = withIds(ask, inp.records, ['new:x', 'new:y2']); change(w); assert.equal(refusal(() => M.validateMapReply(w, ask)).message, 'INVALID_RESPONSE');
  }
  // Order: the old about form, then the exact keys, then the ref (each refusal is the one it was).
  const both = withIds(ask, inp.records, ['new:x']); both.parts[2].ref = 'new:Bad'; both.parts[2].roleAbout = null; delete both.parts[2].roleAboutAt;
  assert.deepEqual([refusal(() => M.validateMapReply(both, ask)).rule, refusal(() => M.validateMapReply(both, ask)).path], ['condition-form', 'parts[2].roleAbout']);
  const extra = withIds(ask, inp.records, ['new:x']); extra.parts[2].ref = 'new:Bad'; delete extra.parts[2].claims;
  const ek = refusal(() => M.validateMapReply(extra, ask));
  assert.deepEqual([ek.path, ek.rule, ek.target], ['parts[2]', 'contract', 'keys'], 'the exact-key check comes first (AF137: now said with its path and category)');
});

test('120-3 map.1–6 keep their plain refusal and the same accepted set', () => {
  const six = later(M.MAP6_SCHEMA).inp;
  const reply6 = ref => { const w = K.replyFor6(six.ask, six.records); w.parts.push({ ref, name: '새 부분', parent: 'P01', role: null, roleAbout: null, roleReplaces: null, basis: [K.piece(six.ask, K.aliases(six.ask, six.records).report, '썸네일 생성기를')], claims: [] }); return w; };
  assert.equal(M.validateMapReply(reply6('new:label_guide'), six.ask).parts[1].ref, 'new:label_guide');
  for (const ref of ['new:labelGuide', 'P99']) { const e = refusal(() => M.validateMapReply(reply6(ref), six.ask)); assert.deepEqual([e.name, e.message], ['Error', 'INVALID_RESPONSE'], ref); }
});

test('120-4 instructions: base MAP7, map1–6/FIRST6 and the guidance frame as before; the vocabulary is the validator\'s own grammar; new recipe', async () => {
  const { inp } = later(), prompt = P.map7Prompt(inp.ask);
  assert.equal(prompt, P.MAP7_PROMPT + P.MAP7_VOCABULARY + P.map7Guidance(inp.ask));
  assert.equal(sha(P.MAP7_PROMPT), '73286f8b79e80c132aaa5e891d7955748e30fd21bf9e3e7f641ec37b6e480f4b');
  assert.equal(sha(JSON.stringify(P.MAP7_GUIDANCE_FRAME)), '9d497d4cb2021b0cdfcc833e5798675a3d8556ed72e45f45a1111cf41f5487ca', 'the 118 guidance frame (pre120)');
  assert.deepEqual(JSON.parse(P.map7Guidance(inp.ask).replace(/^[\s\S]*?\n\[\n/, '[\n').replace(/\n\][\s\S]*$/, '\n]')), G.conditionGuidance(inp.ask), 'the same rows');
  const h = t => sha(t).slice(0, 16);
  assert.deepEqual([P.MAP_PROMPT, P.MAP2_PROMPT, P.MAP3_PROMPT, P.MAP4_PROMPT, P.MAP4_FIRST_PROMPT, P.MAP5_PROMPT, P.MAP5_FIRST_PROMPT, P.MAP6_PROMPT, P.MAP6_FIRST_PROMPT].map(h),
    ['a15660a3a3e7bbe2', '53ef9b4d18d8c6b3', '6ad411b7e893733f', '5317421405406135', '4c8523a1402ca9fa', '6ce308f841f5851c', '37a8237254d69607', '24b6596338d073fa', 'cef94b26c23e8c3c']);
  assert.equal(await mapPromptId(), 'm6-6859b864664f');
  const v = P.MAP7_VOCABULARY, NEW = /^new:[a-z0-9_-]{1,24}$/;
  assert.ok(v.includes('^new:[a-z0-9_-]{1,24}$') && v.includes('철자 그대로') && v.includes('name은 사용자의 언어로'));
  const quoted = [...v.matchAll(/"(new:[^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(quoted.map(x => NEW.test(x)), [true, true, true, false], `examples: ${quoted.join(' ')}`);
  assert.ok(P.MAP7_RECIPE.startsWith('map7-recipe.3:') && P.MAP7_RECIPE.includes('part-id-vocabulary.1') && P.MAP7_RECIPE.includes(G.CONDITION_GUIDANCE));
  const m7 = await map7PromptId(); assert.match(m7, /^m7-[0-9a-f]{12}$/);
  assert.ok(!['m7-82631aa43efc', 'm7-1a2625a62324'].includes(m7), 'not the pre120 (recipe.2) nor the pre118 (recipe.1) id');
  assert.ok(!P.MAP6_PROMPT.includes('part-id-vocabulary') && !P.MAP6_FIRST_PROMPT.includes('part-id-vocabulary'), 'map.6 asks keep their text');
});

test('120-5 the provider sends the one rendering; a job under the pre120 m7 id is refused as changed with no call', async () => {
  const seen = [], dir = mkdtempSync(`${tmpdir()}/af120-jobs-`), jobs = await openMapJobs({ dir });
  const fetchImpl = async (url, init) => { const b = JSON.parse(init.body), ask = JSON.parse(b.messages[1].content.replace(/^INPUT JSON \(자료\):\n/, '')); seen.push(b.messages[0].content); return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(K.replyFor7(ask, M.askRecords(ask))) } }] }), { status: 200 }); };
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-120', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl, jobs });
  try {
    const { p, inp } = later();
    const r = await handle(new Request('http://127.0.0.1/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1' }, body: JSON.stringify(inp.ask) }));
    assert.equal(r.status, 200); assert.equal(seen[0], P.map7Prompt(inp.ask)); assert.ok(seen[0].includes(P.MAP7_VOCABULARY));
    const wire = J.encodeMapInput(inp), cap = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'), id = `MJ_${crypto.randomUUID()}`;
    const binding = { entryId: 'E_vocab0120-1', projectId: p.id, lifecycle: 1, seq: 1, after: inp.after, schemaVersion: 'studio.map.7', prompt: 'm7-82631aa43efc', model: 'deepseek-flash', askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
    const res = await handle(new Request('http://127.0.0.1/api/studio/jobs', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1', 'x-studio-operation': cap }, body: JSON.stringify({ version: 'map-job.1', id, binding, input: wire }) }));
    assert.deepEqual([res.status, (await res.json()).error.code], [409, 'PROMPT_CHANGED']); assert.equal(seen.length, 1, 'no call');
  } finally { await jobs.close(); }
});
