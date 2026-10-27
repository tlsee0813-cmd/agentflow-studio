// EXPERIENCE63: the studio.digest.1 boundary (request/reply contract, HTTP rules, prompt separation), the UI62 material
// example (areas only, the material's own stages), the saved-project adapter on the Node-RED plan with no returned result,
// and the reading cache. The provider is a stub here; no real model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDigestAsk, validateDigestReply, DIGEST_BYTES } from '../dist/public/shared/digest-api.js';
import { UI62_MATERIAL } from '../dist/public/shared/return-material-data.js';
import { buildUi62Project, ui62Keys, UI62_STAGES } from '../dist/public/shared/return-material.js';
import { buildExample } from '../dist/public/shared/studio-examples.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import { ui62Reading, savedReading, readingInput, mapDigest } from '../dist/public/client/digest-source.js';
import { digestStore, askHash, makeReading, DIGEST_KEY } from '../dist/public/client/digest-store.js';
import { parseBundle } from '../dist/public/client/plan-store.js';
import { requestSnapshot } from '../dist/public/shared/change-plan.js';
import { createStudioHandler, digestPromptId } from '../server/studio.mjs';
import { DIGEST_PROMPT } from '../server/digest-prompt.mjs';

const doc = p => new URL(`../../../docs/cycles/${p}`, import.meta.url);
const ui62 = stage => { const project = buildUi62Project(), view = studioView(project); return { project, view, input: readingInput({ project, view }, ui62Reading(project, stage), null) }; };
const okReply = { changes: [{ text: '선택하기 전에도 같은 이름의 두 부분을 원래 이름으로 구별해 볼 수 있게 바뀌었다.', partIds: ['P03'], refs: ['S05'] }],
  read: { partId: 'P03', why: '동명 구별과 행 높이 보정이 함께 있는 부분이다.', refs: ['S05', 'S09'] }, open: [], notCovered: [] };

test('UI62 material is the fixed document, read as three areas with no records, tasks, returns or anchors', () => {
  assert.deepEqual(UI62_MATERIAL, JSON.parse(readFileSync(doc('2026-10-27-return-experience-63/MATERIAL.json'), 'utf8')));
  const p = buildUi62Project();
  assert.deepEqual(p.space.areas.map(a => a.name), ['지도 곁의 읽기면', '현재와 변경 비교', '이름 구별과 화면 밀도']);
  assert.deepEqual([p.tasks.length, p.sources.length, p.space.relations.length, Object.keys(p.space.understanding).length], [0, 0, 0, 0]);
  assert.deepEqual(UI62_STAGES.map(s => s.sourceIds.length), [4, 8, 10]);
  const keys = ui62Keys(p), s9 = ui62Reading(p, 'reading_3').find(s => s.id === 'S09');
  assert.deepEqual(s9.partIds, [keys.get('names_density')]); assert.match(s9.basis, /bcf88bb/); assert.match(s9.url, /bcf88bbdcaa6/);
  // The quote and the editorial description stay apart.
  assert.equal(s9.text, UI62_MATERIAL.records[8].text.publicExcerpt); assert.equal(s9.note, UI62_MATERIAL.records[8].text.editorialDescription);
});

test('digest request: exact keys, known ids and parents, byte cap and version', () => {
  const { input } = ui62('reading_3');
  assert.deepEqual(validateDigestAsk(input.ask), input.ask);
  const bad = [
    a => { a.extra = 1; }, a => { a.schemaVersion = 'studio.digest.0'; }, a => { a.parts[0].id = 'X1'; }, a => { a.parts[1].parentId = 'P09'; },
    a => { a.sources[0].kind = 'receipt'; }, a => { a.sources[0].partIds = ['P09']; }, a => { a.sources[1].id = a.sources[0].id; },
    a => { a.sources[0].text = 'a\u0007'; }, a => { delete a.plan; }, a => { a.sources = []; }
  ];
  for (const mutate of bad) { const a = structuredClone(input.ask); mutate(a); assert.throws(() => validateDigestAsk(a)); }
  const big = structuredClone(input.ask); big.sources.forEach(s => { s.text = '가'.repeat(6000); });
  assert.throws(() => validateDigestAsk(big), /INPUT_TOO_LARGE/);
  assert.ok(JSON.stringify(input.ask).length < DIGEST_BYTES);
});

test('digest reply: every statement cites sent sources and only parts those sources are about', () => {
  const { input } = ui62('reading_3');
  assert.deepEqual(validateDigestReply(structuredClone(okReply), input.ask), okReply);
  const bad = [
    r => { r.changes[0].refs = ['S11']; }, r => { r.changes[0].refs = []; },
    r => { r.changes[0].partIds = ['P02']; },                     // S05 is about the reading surface and names, not the comparison
    r => { r.changes[0].refs = ['S07']; },                        // S07 is about comparison only; P03 is not grounded
    r => { r.changes[0].partIds = ['P01', 'P02', 'P03']; }, r => { r.read.partId = 'P02'; }, r => { r.open = [1, 2, 3]; },
    r => { r.changes = []; }, r => { r.status = 'done'; }, r => { r.changes[0].text = ''; }, r => { r.changes[0].text = 'x'.repeat(241); }
  ];
  const p01 = structuredClone(okReply); p01.changes[0].partIds = ['P01']; assert.doesNotThrow(() => validateDigestReply(p01, input.ask));
  const unlocated = structuredClone(okReply); unlocated.changes[0].partIds = []; assert.doesNotThrow(() => validateDigestReply(unlocated, input.ask));
  for (const mutate of bad) { const r = structuredClone(okReply); mutate(r); assert.throws(() => validateDigestReply(r, input.ask), /INVALID_RESPONSE/); }
  const noDecision = structuredClone(okReply); noDecision.read = null; assert.deepEqual(validateDigestReply(noDecision, input.ask).open, []);
  const mapped = mapDigest(validateDigestReply(structuredClone(okReply), input.ask), input);
  assert.deepEqual(mapped.changes[0].partIds, [input.parts.get('P03')]);
});

function nodeRed() {
  const cases = JSON.parse(readFileSync(doc('2026-10-26-visual-experience-58/OSS_CASES.json'), 'utf8'));
  const spec = cases.cases.find(c => c.id === 'oss-node-red').spec;
  const generated = buildExample(spec, Date.parse('2026-10-26T00:00:00.000Z'));
  let text = JSON.stringify(generated).replaceAll(generated.id, `P_visual58_${spec.id}`);
  generated.space.areas.forEach((a, i) => { text = text.replaceAll(a.id, `A_${spec.id}_${spec.parts[i].key}`); });
  const project = parseProject(text), file = JSON.parse(readFileSync(doc('2026-10-26-visual-experience-59/node-red-real-plan.json'), 'utf8'));
  return { project, view: studioView(project), bundle: parseBundle(file.bundle, project.id) };
}
test('Node-RED: an AI change plan with no returned result reads as plan material only; a change claim is refused', () => {
  const { project, view, bundle } = nodeRed();
  assert.equal(bundle.observations.length, 0); assert.equal(bundle.snapshots.length, 0);
  const sources = savedReading(view, bundle), input = readingInput({ project, view }, sources, bundle);
  assert.deepEqual(input.ask.sources.map(s => s.kind), ['plan', 'plan', 'plan']);
  assert.ok(input.ask.sources.slice(0, 2).every(s => s.partIds.length > 0), 'evidence cited by plan items is about their targets');
  const context = input.ask.sources[2];
  assert.deepEqual(context.partIds, [], 'plan-wide unknowns do not invent target bindings');
  assert.match(context.text, /UI 입력 단계/); assert.match(context.text, /기존 MQTT 노드/); assert.match(context.text, /HTTP 요청/);
  assert.match(input.ask.plan.intent, /MQTT/);
  validateDigestAsk(input.ask);
  const target = input.ask.sources[0].partIds[0];
  const claim = { changes: [{ text: 'MQTT TLS 선택이 바뀌었다.', partIds: [target], refs: [input.ask.sources[0].id] }], read: null, open: [], notCovered: [] };
  assert.throws(() => validateDigestReply(claim, input.ask), /INVALID_RESPONSE/);
  const mixed = structuredClone(input.ask); mixed.sources.push({ id: 'U01', kind: 'report', title: '다른 작업 보고', text: '다른 부분의 설명을 고쳤다.', note: '', basis: '별도 보고', partIds: [] });
  assert.throws(() => validateDigestReply(claim, mixed), /INVALID_RESPONSE/, 'an unrelated outcome does not license a plan-only change claim');
  assert.throws(() => validateDigestReply({ ...claim, changes: [{ ...claim.changes[0], refs: ['U01'], partIds: [] }, claim.changes[0]] }, mixed), /INVALID_RESPONSE/, 'every individual change needs its own cited outcome');
  const honest = { changes: [], read: { partId: target, why: '변경안이 바꾸려는 부분이다.', refs: [input.ask.sources[0].id] }, open: [],
    notCovered: ['이 변경안에 돌아온 결과 자료가 아직 없어 반영 여부는 말할 수 없다.'] };
  assert.deepEqual(validateDigestReply(honest, input.ask), honest);
  assert.throws(() => validateDigestReply({ ...honest, notCovered: [] }, input.ask), /INVALID_RESPONSE/);
});

test('saved result locations belong only to the exact plan and revision of the attached request', () => {
  const { view, bundle } = nodeRed(), item = bundle.plan.analysis.items[0], snap = requestSnapshot(bundle.plan);
  bundle.snapshots.push(snap); bundle.labels[snap.id] = { [item.id]: '요청 당시 제목' };
  bundle.observations.push({ id: 'OBS_1', itemId: item.id, kind: 'report', text: '요청한 설정 선택 처리를 추가했다.', basis: '원래 요청에 대한 보고', refs: [] });
  bundle.attached.OBS_1 = snap.id;
  const exact = savedReading(view, bundle)[0]; assert.deepEqual(exact.partIds, item.partIds); assert.match(exact.title, /요청 당시 제목/);
  for (const mutate of [b => { b.plan.revision++; }, b => { b.plan.id = 'CP_different'; }, b => { b.plan = null; }]) {
    const changed = structuredClone(bundle); mutate(changed);
    const result = savedReading(view, changed)[0];
    assert.deepEqual(result.partIds, []); assert.equal(result.text, exact.text); assert.equal(result.basis, exact.basis);
    assert.match(result.title, /요청 당시 제목/); assert.match(result.note, /현재 부분 연결은 추정하지 않음/);
  }
  const missing = structuredClone(bundle); missing.snapshots = []; missing.labels = {};
  assert.deepEqual(savedReading(view, missing)[0].partIds, []);
  assert.ok(!savedReading(view, missing)[0].title.includes(item.title), 'no fallback to a current item with the same id');
});

test('global reports and unattached extras can describe changes without fabricating a part; excerpts keep the whole cited source', async () => {
  const { project, view } = nodeRed(), full = '가'.repeat(6000) + '뒤에 남은 실제 원자료';
  const bundle = { extra: [{ id: 'U01', kind: 'report', title: '전역 작업 보고', text: full, basis: '범위 없는 보고' }], plan: null, observations: [], snapshots: [], attached: {}, labels: {} };
  const all = savedReading({ ...view, records: [] }, bundle), input = readingInput({ project, view: { ...view, parts: [] } }, all, bundle);
  assert.equal(all[0].text, full); assert.deepEqual(all[0].partIds, []);
  assert.equal(input.ask.sources[0].text, full.slice(0, 6000)); assert.match(input.ask.sources[0].note, /앞 6000자만/);
  validateDigestAsk(input.ask);
  const reply = { changes: [{ text: '전역 설정 처리를 추가했다는 보고가 있다.', refs: ['U01'], partIds: [] }], read: null, open: [], notCovered: [] };
  validateDigestReply(reply, input.ask); assert.deepEqual(mapDigest(reply, input).changes[0].partIds, []);
  const reading = makeReading(input, await askHash(input.ask), 'm', 'd1-example', reply);
  assert.equal(reading.cited.U01.text, full); assert.match(reading.cited.U01.note, /AI에는/);
  const kv = memoryKv(), store = digestStore(kv); store.keep(project.id, reading);
  assert.equal(digestStore(kv).previous(project.id, 'other').cited.U01.text, full, 'a reload does not silently substitute a 2000-character excerpt for the source');
  const global = savedReading({ ...view, records: [{ id: 'raw', kind: 'report', at: '2026-10-27T00:00:00Z', partId: null, taskId: 'task', text: full, origin: null }] }, null);
  assert.deepEqual(global[0].partIds, []); assert.equal(global[0].text, full);
  const many = { ...view, records: Array.from({ length: 120 }, (_, i) => ({ id: `raw-${i}`, kind: 'report', at: '2026-10-27T00:00:00Z', partId: null, taskId: 'task', text: `보고 ${i}`, origin: null })) };
  const counted = readingInput({ project, view: many }, savedReading(many, null), null);
  assert.deepEqual(counted.coverage, { total: 120, sent: 48 }, 'coverage includes records omitted by the transmission cap');
});

const STATUS = 'https://studio.example/api/studio/status';
const post = (body, headers = {}) => new Request('https://studio.example/api/studio/digest', { method: 'POST',
  headers: { 'content-type': 'application/json', 'x-agentflow-request': '1', origin: 'https://studio.example', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const provider = content => async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }), { status: 200 });

test('HTTP: digest keeps the studio boundary (origin, access code, byte cap, key) and separates instructions from material', async () => {
  const { input } = ui62('reading_3'), key = 'test-key-not-real-0123456789';
  let seen = null;
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: 'm-ask', DEEPSEEK_PLAN_MODEL: 'm-plan', STUDIO_ACCESS_CODE: 'c0de' },
    fetchImpl: async (url, init) => { seen = JSON.parse(init.body); return provider(okReply)(); } });
  const status = await (await handle(new Request(STATUS))).json();
  assert.deepEqual(status.digest, { model: 'm-plan', prompt: await digestPromptId() }); assert.match(status.digest.prompt, /^d1-[0-9a-f]{12}$/);
  assert.equal((await handle(post(input.ask))).status, 401);
  assert.equal((await handle(post(input.ask, { 'x-studio-access': 'c0de', origin: 'https://evil.example' }))).status, 403);
  assert.equal((await handle(post(input.ask, { 'x-studio-access': 'c0de', 'x-agentflow-request': '0' }))).status, 403);
  assert.equal((await handle(post('x'.repeat(DIGEST_BYTES + 1), { 'x-studio-access': 'c0de' }))).status, 413);
  assert.equal((await handle(post({ ...input.ask, extra: 1 }, { 'x-studio-access': 'c0de' }))).status, 400);
  assert.equal(seen, null, 'refused requests never reach the provider');
  const r = await handle(post(input.ask, { 'x-studio-access': 'c0de' })), text = await r.text();
  assert.equal(r.status, 200); assert.ok(!text.includes(key)); assert.deepEqual(JSON.parse(text), { model: 'm-plan', reply: okReply });
  assert.equal(seen.model, 'm-plan'); assert.equal(seen.thinking.type, 'enabled'); assert.equal(seen.messages[0].content, DIGEST_PROMPT);
  assert.deepEqual(JSON.parse(seen.messages[1].content.replace(/^[^\n]*\n/, '')), input.ask, 'material goes only as the user message, as data');
  for (const bad of [{ ...okReply, changes: [{ ...okReply.changes[0], refs: ['S99'] }] }, { ...okReply, read: { ...okReply.read, why: key } }, { ...okReply, open: undefined }]) {
    const h = createStudioHandler({ env: { DEEPSEEK_API_KEY: key }, fetchImpl: provider(bad) });
    const res = await h(post(input.ask)); assert.equal(res.status, 502); assert.deepEqual(await res.json(), { error: { code: 'INVALID_RESPONSE' } });
  }
  const off = createStudioHandler({ env: {}, fetchImpl: () => assert.fail('no provider call') });
  assert.deepEqual(await (await off(new Request(STATUS))).json(), { ai: 'off', model: null, access: 'open' });
  assert.equal((await off(post(input.ask))).status, 503);
});

function memoryKv() { const m = new Map(); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); } }; }
test('cache: found only for the same material, model and prompt; examples never stored', async () => {
  const kv = memoryKv(), store = digestStore(kv), { project, input } = ui62('reading_3');
  const hash = await askHash(input.ask), reading = makeReading(input, hash, 'm', 'd1-000000000000', okReply);
  assert.equal(store.keep(project.id, reading), null);
  assert.equal(store.find(project.id, hash, input.ask, 'm', 'd1-000000000000').hash, hash);
  assert.equal(digestStore(kv).find(project.id, hash, input.ask, 'm', 'd1-000000000000')?.hash, hash, 'kept across a reload');
  assert.equal(store.find(project.id, hash, input.ask, 'm2', 'd1-000000000000'), null, 'another model');
  assert.equal(store.find(project.id, hash, input.ask, 'm', 'd1-111111111111'), null, 'another prompt');
  const edited = structuredClone(input.ask); edited.sources[9].text += ' ';
  const other = await askHash(edited); assert.notEqual(other, hash, 'one changed character is other material');
  assert.equal(store.find(project.id, other, edited, 'm', 'd1-000000000000'), null);
  const based = structuredClone(input.ask); based.sources[9].basis = based.sources[9].basis.replace(/· [0-9a-f]{7} ·/, '· 0000000 ·');
  assert.notEqual(await askHash(based), hash, 'another basis is other material');
  assert.equal(store.previous(project.id, other).hash, hash, 'the earlier reading stays readable for the grown material');
  assert.ok(reading.cited.S05 && reading.cited.S09 && !reading.cited.S01, 'only cited sources are kept with a reading');
  const stage1 = ui62('reading_1'); assert.notEqual(await askHash(stage1.input.ask), hash);
  // A stored reading that no longer fits its request is not used.
  const stale = JSON.parse(kv.m.get(DIGEST_KEY)); stale.projects[project.id][0].reply.changes[0].refs = ['S42']; kv.m.set(DIGEST_KEY, JSON.stringify(stale));
  assert.equal(digestStore(kv).find(project.id, hash, input.ask, 'm', 'd1-000000000000'), null);
  assert.equal(digestStore(kv).previous(project.id, other), null, 'invalid frozen citations are also refused for an earlier reading');
  const example = digestStore(null); example.keep(project.id, reading);
  assert.equal(example.find(project.id, hash, input.ask, 'm', 'd1-000000000000').hash, hash); assert.equal(kv.m.size, 1);
});

test('cache: malformed earlier readings are skipped before source rendering or mapping', async () => {
  const { project, input } = ui62('reading_3'), reading = makeReading(input, await askHash(input.ask), 'm', 'd1-example', okReply);
  const bad = [r => { delete r.sourceVersion; }, r => { r.coverage.sent = -1; }, r => { r.coverage.total = 0; }, r => { r.parts.P03 = 2; },
    r => { r.cited.S05.text = {}; }, r => { r.cited.S05.kind = 'unknown'; }, r => { r.cited.S05.partIds = ['unmapped']; },
    r => { r.cited.S05.url = 'javascript:alert(1)'; }, r => { delete r.cited.S09; }, r => { r.reply.changes = {}; },
    r => { r.reply.read.partId = 'P02'; }, r => { r.reply.changes[0].refs = ['S99']; }];
  for (const mutate of bad) {
    const kv = memoryKv(), broken = structuredClone(reading); mutate(broken);
    kv.setItem(DIGEST_KEY, JSON.stringify({ version: 'studio.digest-cache.1', projects: { [project.id]: [broken, reading] } }));
    assert.deepEqual(digestStore(kv).previous(project.id, 'different'), reading, 'skip malformed entry and preserve the next readable one');
  }
});
