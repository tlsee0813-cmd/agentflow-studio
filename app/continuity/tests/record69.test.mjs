// EXPERIENCE69: a record pasted as it came, kept in the project (project.8) and read with the rest of the material
// (studio.digest.2). Samples: A the Node-RED PR6019 author's own text on the fixed OSS part map (unedited, no part ids added;
// Node-RED itself is not run), B a synthetic record mixing PC and device calibration under one name, C repeats, late and
// key-like input, copies and reloads, D maps with no parts or duplicate names. The provider is a stub: these check the
// contract, storage and transmission, not reading quality; the stub replies below are written for the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import { parseProject, parseBackup } from '../dist/public/shared/validation.js';
import { serializeProject, serializeBackup, WorkspaceStore, importCopy } from '../dist/public/shared/storage.js';
import { buildExample } from '../dist/public/shared/studio-examples.js';
import { studioView } from '../dist/public/shared/studio.js';
import { validateDigestAsk, validateDigestReply, quoteAt, DIGEST_BYTES, RECORD_SENT_MAX } from '../dist/public/shared/digest-api.js';
import { savedReading, readingInput, partLabel } from '../dist/public/client/digest-source.js';
import { digestStore, askHash, makeReading, DIGEST_KEY } from '../dist/public/client/digest-store.js';
import { secretLike } from '../dist/public/client/plan-source.js';
import { createStudioHandler, digestPromptId } from '../server/studio.mjs';
import { DIGEST_PROMPT, DIGEST2_PROMPT } from '../server/digest-prompt.mjs';

const fixture = name => readFileSync(new URL(`./fixtures/record69/${name}`, import.meta.url), 'utf8');
const PR6019 = fixture('node-red-pr6019.txt'), SYNTH = fixture('synthetic-calibration.txt');
const OSS = JSON.parse(readFileSync(new URL('../../../docs/cycles/2026-10-26-visual-experience-58/OSS_CASES.json', import.meta.url), 'utf8'));
const nodeRed = () => {
  const spec = OSS.cases.find(c => c.id === 'oss-node-red').spec, p = buildExample(spec, Date.parse('2026-10-26T00:00:00.000Z'));
  return { p, key: new Map(spec.parts.map((part, i) => [part.key, p.space.areas[i].id])) };
};
const input = (p, bundle = null) => { const view = studioView(p); return readingInput({ project: p, view }, savedReading(view, bundle, p.pasted), bundle); };
const recordOf = inp => inp.ask.sources.find(s => s.kind === 'record');
const alias = (inp, id) => [...inp.parts].find(([, real]) => real === id)?.[0];
function memoryKv() { const m = new Map(); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); } }; }

test('R69 project.8: a pasted record is kept exactly, once; project.7 reads as none; a mislabeled project.7 is refused', () => {
  let p = D.addArea(D.createProject(), '예약');
  const area = p.space.areas[0].id, text = '  보고\r\n\t탭과 앞뒤 공백 그대로  ';
  const first = D.pasteRecord(p, text, area);
  assert.equal(first.duplicate, false); assert.equal(first.project.revision, p.revision + 1);
  assert.deepEqual(first.project.pasted.map(r => [r.text, r.context]), [[text, area]]); assert.match(first.record.id, /^N_/);
  // The same text again is that record: nothing added, revision kept. Another whitespace is another record, never merged.
  const again = D.pasteRecord(first.project, text, null);
  assert.equal(again.duplicate, true); assert.equal(again.project, first.project); assert.equal(again.record.id, first.record.id);
  const other = D.pasteRecord(first.project, text.trim(), null);
  assert.equal(other.duplicate, false); assert.equal(other.project.pasted.length, 2);
  assert.throws(() => D.pasteRecord(p, 'x', 'A_missing')); assert.throws(() => D.pasteRecord(p, '벨\u0007', null)); assert.throws(() => D.pasteRecord(p, '   ', null));
  // Persisted bytes round-trip; ids, times and contexts survive.
  const kept = parseProject(serializeProject(other.project)); assert.deepEqual(kept.pasted, other.project.pasted);
  // project.7 (no key) migrates to none; a project.7 that already has the key is not repaired.
  const v7 = JSON.parse(serializeProject(p)); v7.schemaVersion = 'idea015.project.7'; delete v7.pasted;delete v7.readings;
  const read = parseProject(JSON.stringify(v7)); assert.equal(read.schemaVersion, 'idea015.project.13'); assert.deepEqual(read.pasted, []);
  assert.deepEqual(read.readings, []);
  assert.deepEqual({ ...read, schemaVersion: v7.schemaVersion, pasted: undefined, readings: undefined }, { ...v7, pasted: undefined, readings: undefined }, 'nothing else changes');
  assert.throws(() => parseProject(JSON.stringify({ ...v7, pasted: [] })));
  const dup = JSON.parse(serializeProject(other.project)); dup.pasted[1].text = dup.pasted[0].text;
  assert.throws(() => parseProject(JSON.stringify(dup)), 'two records with one text are refused');
  const ctx = JSON.parse(serializeProject(other.project)); ctx.pasted[0].context = 'A_nope';
  assert.throws(() => parseProject(JSON.stringify(ctx)));
});

test('R69 backup: records and places go in the existing format and come back as a new copy with its own entry', async () => {
  const { p: base, key } = nodeRed();
  const { project } = D.pasteRecord(base, PR6019, key.get('10-mqtt'));
  const places = { __root__: { [key.get('nodes')]: { x: 40, y: 80 } } };
  const raw = serializeBackup(project, places), back = parseBackup(raw);
  assert.deepEqual(back.project.pasted, project.pasted); assert.equal(back.project.pasted[0].text, PR6019); assert.deepEqual(back.positions, places);
  assert.ok(!raw.includes('studio.digest'), 'readings are not part of a backup');
  const kv = memoryKv(), locks = { request: async (_n, cb) => cb() }, store = new WorkspaceStore(kv, locks);
  await store.init();
  const original = await store.create(project, 'new'), copy = await importCopy(store, kv, back.project, back.positions);
  assert.notEqual(copy.ref.entryId, original.entryId);
  const entries = store.entries();
  assert.equal(entries[0].project.id, entries[1].project.id, 'the copy keeps its project id (and area ids): history stays intact');
  assert.deepEqual(entries.map(e => e.origin), ['new', 'import']);
  assert.deepEqual(entries[1].project.pasted, project.pasted);
});

test('R69 sample A material: the unedited PR6019 text leads, whole, unlocated, under digest.2', () => {
  const { p: base, key } = nodeRed();
  assert.ok(!/\bP\d{2}\b|A_/.test(PR6019), 'the record carries no part ids');
  const { project } = D.pasteRecord(base, PR6019, key.get('10-mqtt'));
  const inp = input(project), rec = recordOf(inp);
  assert.equal(inp.ask.schemaVersion, 'studio.digest.2'); assert.deepEqual(validateDigestAsk(inp.ask), inp.ask);
  assert.equal(inp.ask.sources[0], rec, 'the newest record is first');
  assert.equal(rec.text, PR6019.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' '), 'sent whole: it fits');
  assert.deepEqual(rec.partIds, [], 'the part looked at is context, not a location');
  assert.match(rec.note, /붙일 때 보던 부분: 10-mqtt\.js \(읽기 맥락일 뿐/); assert.match(rec.basis, /원문 작성·판본 시각 아님/);
  assert.equal(inp.sources.get(rec.id).sent, PR6019.length); assert.equal(inp.sources.get(rec.id).recordId, project.pasted[0].id);
  for (const fact of ['4 passing, 28 pending', 'only covers the editor-client sources', 'I have run `npm run test`', 'mqtt://-:1883']) assert.ok(rec.text.includes(fact), fact);
  // Without a record the same project reads exactly as digest.1 (its cached readings stay valid).
  assert.equal(input(base).ask.schemaVersion, 'studio.digest.1');
});

test('R69 material: a new record is never pushed out by a large project; a long one goes as an excerpt that says so', () => {
  let p = D.createProject();
  for (let i = 0; i < 60; i++) p = D.addArea(p, `부분 ${i}`, '설'.repeat(100));
  for (let i = 0; i < 40; i++) p = D.submit(D.editDraft(p, `요청 ${i} ${'가'.repeat(3000)}`), undefined, p.space.areas[i].id);
  const long = `첫 줄\n${'나'.repeat(30000)}\n마지막 결론`;
  p = D.pasteRecord(p, long, null).project;
  const inp = input(p), rec = recordOf(inp);
  assert.ok(rec, 'the record went'); assert.equal(inp.ask.sources[0].id, rec.id);
  assert.ok(rec.text.length <= RECORD_SENT_MAX && rec.text.length >= 1500 && long.startsWith(rec.text));
  assert.match(rec.note, new RegExp(`원자료 ${long.length}자 중 앞 ${rec.text.length}자만 보냄`));
  assert.equal(inp.sources.get(rec.id).sent, rec.text.length);
  assert.ok(new TextEncoder().encode(JSON.stringify(inp.ask)).length <= DIGEST_BYTES);
  assert.ok(inp.coverage.sent < inp.coverage.total, 'the rest is counted as not sent');
  // Many records: the newest three lead, older ones follow the project's own material.
  let q = D.createProject(); for (let i = 0; i < 5; i++) q = D.pasteRecord(q, `기록 ${i}`, null).project;
  q = D.submit(D.editDraft(q, '요청'), undefined, undefined);
  assert.deepEqual(input(q).ask.sources.map(s => s.title), ['기록 4', '기록 3', '기록 2', '요청', '기록 1', '기록 0']);
});

const readingA = (inp, mqtt, rec) => ({ changes: [], read: null, open: [], notCovered: [], recordReadings: [
  { kind: 'change', text: '같은 connect 동작을 반복해도 동작에 적힌 url로 다시 연결되도록 고쳤다.', ref: rec, quote: 'Now a `url` in the action is always used', related: [{ partId: mqtt, quote: 'The broker node only applied `msg.broker.url`', why: 'MQTT broker 노드의 연결 url 처리' }] },
  { kind: 'check', text: 'MQTT 테스트 파일만 실행해 4개 통과·28개 보류였고 전체 npm test는 실행하지 않았다. lint는 editor-client만 덮는다.', ref: rec, quote: 'with the fix: 4 passing, 28 pending', related: [] }
] });

test('R69 contract: readings quote what was sent; candidates are known parts; changes still need outcome material', () => {
  const { p: base, key } = nodeRed();
  const { project } = D.pasteRecord(base, PR6019, null), inp = input(project), rec = recordOf(inp).id, mqtt = alias(inp, key.get('10-mqtt'));
  const ok = readingA(inp, mqtt, rec);
  assert.deepEqual(validateDigestReply(structuredClone(ok), inp.ask), ok, 'record readings alone are a reply: no mechanical "no result" line');
  const bad = [
    r => { r.recordReadings[0].quote = 'Now a url in the action is always used'; },         // not in the text (backticks dropped)
    r => { r.recordReadings[0].quote = PR6019; },                                             // the whole text is not a quote
    r => { r.recordReadings[0].quote = 'url'; },                                              // too short to ground anything
    r => { r.recordReadings[0].related[0].partId = 'P99'; },                                  // unknown part
    r => { r.recordReadings[0].related[0].quote = '없는 구절입니다'; },
    r => { r.recordReadings[0].related.push({ ...r.recordReadings[0].related[0] }); },      // the same candidate twice
    r => { r.recordReadings[0].ref = 'R01'; },                                                // not a sent record
    r => { r.recordReadings[0].kind = 'done'; }, r => { r.recordReadings.push(...r.recordReadings, r.recordReadings[0]); },
    r => { r.changes = [{ text: '연결 url 처리가 바뀌었다.', partIds: [], refs: [rec] }]; },     // a record is not outcome material
    r => { r.changes = [{ text: '연결 url 처리가 바뀌었다.', partIds: [mqtt], refs: [rec] }]; }, // and never locates a change
    r => { r.read = { partId: mqtt, why: '이유', refs: [rec] }; },
    r => { delete r.recordReadings; }, r => { r.recordReadings = []; }                       // empty everything is no reply
  ];
  for (const mutate of bad) { const r = structuredClone(ok); mutate(r); assert.throws(() => validateDigestReply(r, inp.ask), /INVALID_RESPONSE/, JSON.stringify(r).slice(0, 120)); }
  // Rewrapped white space in a quote still finds the passage; the stored quote is what the model gave.
  const wrapped = structuredClone(ok); wrapped.recordReadings[0].quote = 'Now a `url`  in the\naction is always used';
  assert.equal(validateDigestReply(wrapped, inp.ask).recordReadings[0].quote, wrapped.recordReadings[0].quote.trim());
  assert.ok(quoteAt(PR6019, wrapped.recordReadings[0].quote));
  // digest.1 never takes a record nor returns record readings.
  const one = structuredClone(inp.ask); one.schemaVersion = 'studio.digest.1'; assert.throws(() => validateDigestAsk(one));
  const located = structuredClone(inp.ask); recordOf({ ask: located }).partIds = [mqtt]; assert.throws(() => validateDigestAsk(located));
  assert.throws(() => validateDigestReply(ok, { ...input(base).ask }), /INVALID_RESPONSE/);
});

test('R69 contract: a quote must sit in the excerpt that was sent, not in the unsent rest of the record', () => {
  let p = D.createProject(); for (let i = 0; i < 30; i++) p = D.addArea(p, `부분 ${i}`, '설'.repeat(300));
  const tail = '끝부분에만 있는 결론 문장';
  p = D.pasteRecord(p, `시작 문장입니다\n${'다'.repeat(20000)}\n${tail}`, null).project;
  const inp = input(p), rec = recordOf(inp);
  assert.ok(!rec.text.includes(tail));
  const reply = q => ({ changes: [], read: null, open: [], notCovered: [], recordReadings: [{ kind: 'check', text: '읽은 내용', ref: rec.id, quote: q, related: [] }] });
  assert.ok(validateDigestReply(reply('시작 문장입니다'), inp.ask));
  assert.throws(() => validateDigestReply(reply(tail), inp.ask), /INVALID_RESPONSE/);
});

test('R69 sample B (synthetic) and D: same-named parts, no parts; the looked-at part is never evidence', () => {
  assert.match(SYNTH, /^\[합성 표본 · 실제 보고 아님\]/);
  let p = D.addArea(D.addArea(D.createProject(), 'PC 앱'), '장치 펌웨어');
  const [pc, dev] = p.space.areas.map(a => a.id);
  p = D.addChildArea(D.addChildArea(p, pc, '보정', '측정값 입력 화면'), dev, '보정', '영점 오프셋 계산');
  const [pcCal, devCal] = p.space.areas.slice(2).map(a => a.id);
  p = D.pasteRecord(p, SYNTH, pcCal).project;
  const inp = input(p), rec = recordOf(inp);
  assert.deepEqual(rec.partIds, []); assert.match(rec.note, /붙일 때 보던 부분: PC 앱 · 보정 \(읽기 맥락일 뿐/);
  // Same-named parts read with their parent wherever they are named beside the map (chips, candidates, context); others plain.
  const view = studioView(p);
  assert.deepEqual([pcCal, devCal, pc].map(id => partLabel(view, id)), ['PC 앱 · 보정', '장치 펌웨어 · 보정', 'PC 앱']);
  let deep = D.addArea(D.addArea(D.createProject(), 'A'), 'B');
  const [ra, rb] = deep.space.areas.map(x => x.id);
  deep = D.addChildArea(D.addChildArea(deep, ra, '설정'), rb, '설정');
  const [sa, sb] = deep.space.areas.slice(2).map(x => x.id);
  deep = D.addChildArea(D.addChildArea(deep, sa, '보정'), sb, '보정');
  const dv = studioView(deep), [ca, cb] = deep.space.areas.slice(4).map(x => x.id);
  assert.deepEqual([partLabel(dv, ca), partLabel(dv, cb)], ['A · 설정 · 보정', 'B · 설정 · 보정'], 'up to two parents until they differ');
  assert.equal(inp.ask.parts.filter(x => x.name === '보정').length, 2, 'both same-named parts go with their parents');
  // The contract checks only that a candidate is a known part with a quote in the text: it cannot tell PC from device. That is
  // the model's (and the person's) reading; the screen shows such links as candidates only. A real model is checked apart.
  const both = { changes: [], read: null, open: [], notCovered: [], recordReadings: [
    { kind: 'change', text: '장치의 영점 오프셋 계산식이 0.5% 보정 계수로 바뀌었고 실제 장치가 아닌 시뮬레이터에서만 확인했다.', ref: rec.id, quote: '영점 오프셋 계산식을 0.5% 보정 계수로 바꿨습니다', related: [{ partId: alias(inp, devCal), quote: "장치 펌웨어의 '보정'", why: '장치 쪽 보정 계산' }] },
    { kind: 'open', text: '새 계수를 기존 출고분에도 적용할지 새 장치에만 적용할지 정해야 한다.', ref: rec.id, quote: '기존 출고분에도 적용할지', related: [] }] };
  assert.ok(validateDigestReply(both, inp.ask));
  // D: a project with no parts still reads; any candidate is refused rather than invented.
  const empty = D.pasteRecord(D.createProject(), PR6019, null).project, ei = input(empty), er = recordOf(ei).id;
  assert.deepEqual(ei.ask.parts, []);
  const plain = { changes: [], read: null, open: [], notCovered: [], recordReadings: [{ kind: 'check', text: '전체 npm test는 실행하지 않았다.', ref: er, quote: 'I ran the MQTT spec rather than the full `npm run test`', related: [] }] };
  assert.ok(validateDigestReply(plain, ei.ask));
  const invented = structuredClone(plain); invented.recordReadings[0].related = [{ partId: 'P01', quote: 'I ran the MQTT spec', why: '테스트' }];
  assert.throws(() => validateDigestReply(invented, ei.ask), /INVALID_RESPONSE/);
});

test('R69 sample C: key-like text is caught before saving; late and older-version reports stay what they are', () => {
  for (const fake of ['sk-' + 'A'.repeat(24), 'ghp_' + 'b'.repeat(30), '-----BEGIN RSA PRIVATE KEY-----']) assert.ok(secretLike(`보고 끝\n${fake}`), fake);
  assert.ok(!secretLike(PR6019));
  // Every way in refuses it: the domain (paste box) and a backup that carries one (nothing is stored; see the import path).
  const fakeKey = `API_KEY=sk-${'A'.repeat(24)}`;
  assert.throws(() => D.pasteRecord(D.createProject(), `보고\n${fakeKey}`, null), /SECRET_LIKE/);
  const carried = JSON.parse(serializeProject(D.pasteRecord(D.createProject(), '평범한 보고', null).project));
  carried.pasted[0].text = `평범한 보고\n${fakeKey}`;
  const back = parseBackup(JSON.stringify(carried));
  assert.equal(D.secretPasted(back.project).length, 1, 'the import path sees it before importCopy (app.ts bindImport)');
  assert.equal(D.secretPasted(D.pasteRecord(D.createProject(), PR6019, null).project).length, 0);
  // A report about an older version arriving after the person corrected the part: the part's own note stays canonical.
  let p = D.addArea(D.createProject(), '알림', '처음 요구: 문자로 알림');
  const area = p.space.areas[0].id;
  p = D.editArea(p, area, '알림', '정정: 문자 대신 앱 푸시만');
  const before = structuredClone(p.space);
  p = D.pasteRecord(p, '판본 3f2a91c 기준 보고: 문자 알림을 붙였습니다.', area).project;
  assert.deepEqual(p.space, before, 'pasting never rewrites a part, its note, its relations or the structure');
  assert.deepEqual([p.sources.length, p.tasks.length], [0, 0], 'no fake request, task or return is made');
  const inp = input(p);
  assert.equal(inp.ask.parts[0].note, '정정: 문자 대신 앱 푸시만', 'the reading reads the current note beside the late report');
});

test('R69 cache: per entry; an imported copy never shows its original\'s readings; digest.2 readings are re-checked on reload', async () => {
  const { p: base, key } = nodeRed();
  const { project } = D.pasteRecord(base, PR6019, null), inp = input(project), hash = await askHash(inp.ask);
  const mqtt = alias(inp, key.get('10-mqtt')), reply = validateDigestReply(readingA(inp, mqtt, recordOf(inp).id), inp.ask);
  const reading = makeReading(inp, hash, 'm', 'd2-000000000000', reply);
  assert.equal(reading.cited.N01.recordId, project.pasted[0].id); assert.equal(reading.cited.N01.sent, PR6019.length);
  const kv = memoryKv();
  // A reading kept under the project id before entries had their own (what the original showed).
  kv.setItem(DIGEST_KEY, JSON.stringify({ version: 'studio.digest-cache.1', projects: { [project.id]: [reading] } }));
  const store = digestStore(kv);
  assert.equal(store.find('E_original-0001', project.id, hash, inp.ask, 'm', 'd2-000000000000')?.hash, hash, 'an existing entry still reads its earlier reading');
  // The copy has the same project id, but reads only its own list (its host passes no project id).
  assert.equal(store.find('E_copy-00000001', null, hash, inp.ask, 'm', 'd2-000000000000'), null);
  assert.equal(store.previous('E_copy-00000001', null, 'other'), null, 'nor as an earlier reading with its quoted sources');
  // A copy without the record (an older backup) reads digest.1 material: nothing of the original's record is shown either.
  assert.equal(store.previous('E_copy-00000001', null, await askHash(input(base).ask)), null);
  // Keeping writes under the entry; the project-id list is never written again.
  assert.equal(store.keep('E_original-0001', project.id, reading), null);
  const all = JSON.parse(kv.getItem(DIGEST_KEY)).projects;
  assert.deepEqual(Object.keys(all).sort(), ['E_original-0001', project.id].sort());
  assert.equal(digestStore(kv).find('E_original-0001', project.id, hash, inp.ask, 'm', 'd2-000000000000')?.hash, hash, 'kept across a reload');
  // A stored quote that is not in the sent excerpt (tampered, or beyond it) makes the entry unreadable, never repaired.
  for (const tamper of [r => { r.reply.recordReadings[0].quote = '바뀐 인용'; }, r => { r.cited.N01.sent = 20; }, r => { r.cited.N01.partIds = [key.get('10-mqtt')]; }]) {
    const k2 = memoryKv(), bad = structuredClone(reading); tamper(bad);
    k2.setItem(DIGEST_KEY, JSON.stringify({ version: 'studio.digest-cache.1', projects: { E_x: [bad] } }));
    assert.equal(digestStore(k2).previous('E_x', null, 'other'), null);
  }
});

test('R69 HTTP: digest.2 on the same endpoint with its own prompt; digest.1 untouched', async () => {
  const { p: base, key } = nodeRed();
  const { project } = D.pasteRecord(base, PR6019, null), inp = input(project);
  const reply = readingA(inp, alias(inp, key.get('10-mqtt')), recordOf(inp).id);
  let seen = null;
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-key-not-real-0123456789' },
    fetchImpl: async (_u, init) => { seen = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply) } }] }), { status: 200 }); } });
  const res = await handle(new Request('https://s.example/api/studio/digest', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1' }, body: JSON.stringify(inp.ask) }));
  assert.equal(res.status, 200); assert.deepEqual((await res.json()).reply, reply);
  assert.equal(seen.messages[0].content, DIGEST2_PROMPT);
  assert.ok(DIGEST2_PROMPT.startsWith(DIGEST_PROMPT.slice(0, 200)) && DIGEST2_PROMPT.includes('recordReadings') && !DIGEST_PROMPT.includes('recordReadings'));
  assert.ok(DIGEST2_PROMPT.includes('changes와 recordReadings가 모두 비어 있으면 notCovered'));
  // A record's own description of what is already there is a note, never a change or a check by default.
  assert.ok(DIGEST2_PROMPT.includes('note(원문이 설명하는 기존 동작·배경·맥락)') && DIGEST2_PROMPT.includes('change로 단정하지 않고 note로 쓴다'));
  // Candidates: matched against a part's name, note and parent, never by a shared name or a generic word; no sample's answer
  // is written into the instructions, and none has to be given.
  assert.ok(DIGEST2_PROMPT.includes('name·note·부모(parentId) 맥락과 대조한 추정') && DIGEST2_PROMPT.includes('후보를 채워야 하는 것은 아니며'));
  assert.ok(!/mqtt|broker|node-red|21-mqtt/i.test(DIGEST2_PROMPT), 'no sample answer in the prompt');
  // Metadata in a record is material (merged, checked out and deployed kept apart); nothing sent is called missing; a gap
  // already read in recordReadings is not listed again.
  assert.ok(DIGEST2_PROMPT.includes('보낸 원문에 이미 있는 정보를 자료에 없다고 쓰지 않는다') && DIGEST2_PROMPT.includes('보고된 병합·검사와, 지금 받은 코드(checkout)에 들어 있는지·배포됐는지는 다른 범위다'));
  assert.ok(DIGEST2_PROMPT.includes('recordReadings에서 이미 읽은 확인 범위·실행하지 않은 확인·한계는 notCovered에 다시 쓰지 않는다'));
  // Reported changes, checks and merges read alike as what the record reports; not checking them oneself is no absence, and a
  // checkout or deployment gap is listed only when the material says why it matters now. digest.1 is untouched.
  assert.ok(DIGEST2_PROMPT.includes('네가 직접 확인하지 않았다는 이유만으로 그것을 자료에 없는 정보나 미상으로 바꾸지 않는다'));
  assert.ok(DIGEST2_PROMPT.includes('그 부재를 notCovered에 쓰거나 일반적인 단서를 덧붙이지 않는다') && !DIGEST_PROMPT.includes('checkout'));
  assert.ok(!/[0-9a-f]{7,40}/.test(DIGEST2_PROMPT.replace(DIGEST_PROMPT, '')), 'no particular commit in the record rules');
  const note = structuredClone(reply); note.recordReadings[0].kind = 'note';
  assert.equal(validateDigestReply(note, inp.ask).recordReadings[0].kind, 'note');
  assert.notEqual(await digestPromptId(1), await digestPromptId(2));
});
