// AF-EXPERIENCE76: a candidate says what it leaves undecided (studio.map.6, map-reading.5, project.13), and no longer takes away
// a claim for sharing a passage with it. The replies below are written for the test (a stub, not a model): they check the
// contract, the one write and what is refused, never a model's reading quality. Samples: the record76 Zephyr reel board public
// excerpts (doc and DTS), the record69 synthetic PC/device calibration record, and short synthetic texts written here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { parseProject, parseBackup } from '../dist/public/shared/validation.js';
import { serializeBackup } from '../dist/public/shared/storage.js';
import { createMapRun } from '../dist/public/client/map-run.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { MAP5_PROMPT, MAP5_FIRST_PROMPT, MAP6_PROMPT, MAP6_FIRST_PROMPT, map6Prompt } from '../server/map-prompt.mjs';

const ZEPHYR = JSON.parse(readFileSync(new URL('./fixtures/record76/zephyr-reel-board.json', import.meta.url), 'utf8'));
const CAL = readFileSync(new URL('./fixtures/record69/synthetic-calibration.txt', import.meta.url), 'utf8');
let n = 0;
const meta = () => ({ id: `R_u76_${++n}`, at: new Date().toISOString(), model: 'stub', prompt: 'm6-000000000000', hash: String(n).padStart(64, 'f') });
const ask = (p, schema = M.MAP6_SCHEMA) => M.buildMapAsk(p, studioView(p), [], undefined, schema);
const reply = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const part = (ref, o = {}) => ({ ref, name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: [], ...o });
const claim = (kind, text, at, o = {}) => ({ kind, text, at, about: null, replaces: null, key: null, ...o });
const cand = (target, parts, o = {}) => ({ text: '미정 사항', target, parts, at: null, statement: null, ...o });
const said = (key, text, at, o = {}) => ({ key, kind: 'describes', text, at, about: null, ...o });
const apply = (p, inp, r) => M.applyReading(p, inp, M.validateMapReply(r, inp.ask), meta());
/** The alias of the sent piece that begins with these words (in whichever record holds it). */
function piece(inp, words, nth = 0) {
  const hits = inp.ask.records.flatMap(r => r.spans.filter(x => x.t.trimStart().startsWith(words)));
  assert.ok(hits.length > nth, `no piece starting with ${words}`); return hits[nth].s;
}
/** The alias of the sent piece that holds these words (a code block may hold several lines). */
function holding(inp, words) { const hit = inp.ask.records.flatMap(r => r.spans).find(x => x.t.includes(words)); assert.ok(hit, `no piece holds ${words}`); return hit.s; }
const range = (a, b) => (a === b ? a : `${a}-${b.split('.')[1]}`);
/** The refusal of a map.6 reply: its path, rule and target (the code stays INVALID_RESPONSE). */
function refused(fn, rule, path) {
  assert.throws(fn, e => e.message === 'INVALID_RESPONSE' && e.name === 'MapReplyError' && e.rule === rule && (!path || path.test(e.path)), `expected ${rule}`);
}
const lastReading = p => p.readings.filter(r => r.version.startsWith('map-reading.')).at(-1);
const claimsOf = (p, areaId) => M.partUnderstanding(p, areaId)?.claims.map(c => `${c.kind}:${c.text}`).sort() ?? [];

/* ---------- Zephyr: an undecided bus use, an undecided separate display node; the declared facts stay ---------- */
function zephyr(dts = ZEPHYR.dts) { let p = D.pasteRecord(D.createProject(), ZEPHYR.doc, null).project; p = D.pasteRecord(p, dts, null).project; return p; }
function busReply(inp, legacy = false) {
  const clock = holding(inp, 'clock-frequency = <I2C_BITRATE_FAST>'), pins = holding(inp, 'pinctrl-names = "default", "sleep"'), node = piece(inp, 'arduino_i2c: &i2c0 {');
  const k = (key, c) => legacy ? (({ key: _k, ...rest }) => rest)(c) : { ...c, key };
  const r = reply({ parts: [part('new:i2c', { name: 'I2C 버스(i2c0)', role: 'i2c0을 TWIM 컨트롤러로 정의한다.', basis: [node], claims: [
    k('s1', claim('describes', 'i2c0은 FAST 비트레이트로 설정된다', clock)), k('s2', claim('describes', '핀 설정은 default와 sleep 두 상태를 둔다', pins))] })] });
  if (legacy) r.candidates = [{ text: '이 버스를 Arduino 헤더용으로 볼지 원문만으로 정할 수 없어요', parts: ['new:i2c'], at: range(node, pins) }];
  else r.candidates = [cand('holds', ['new:i2c'], { text: '이 버스를 Arduino 헤더용으로 볼지 원문만으로 정할 수 없어요', at: range(node, pins), statement: said('s3', 'i2c0은 Arduino 헤더 확장용 버스다', node) })];
  return r;
}
test('76-Z1 an undecided bus use leaves the FAST clock and default/sleep facts of the same node as they are (map.5 took them away)', () => {
  const p = zephyr(), inp = ask(p), { project, reading } = apply(p, inp, busReply(inp));
  const bus = project.space.areas.find(a => a.name === 'I2C 버스(i2c0)').id;
  assert.deepEqual(claimsOf(project, bus), ['describes:i2c0은 FAST 비트레이트로 설정된다', 'describes:핀 설정은 default와 sleep 두 상태를 둔다']);
  const c = reading.candidates[0];
  assert.equal(reading.version, 'map-reading.5'); assert.equal(c.target, 'holds'); assert.deepEqual(c.areaIds, [bus]);
  assert.equal(c.statement.text, 'i2c0은 Arduino 헤더 확장용 버스다'); assert.equal(c.statement.quote.quote, 'arduino_i2c: &i2c0 {');
  assert.ok(!claimsOf(project, bus).some(x => x.includes('Arduino')), 'the undecided statement is in no part');
  assert.deepEqual(parseProject(JSON.stringify(project)), project); assert.deepEqual(parseBackup(serializeBackup(project, null)).project, project);
  // The same reading on the map.5 wire: the overlap rule takes both declared facts away, without a trace (kept as it was).
  const p5 = zephyr(), inp5 = ask(p5, M.MAP5_SCHEMA), old = apply(p5, inp5, busReply(inp5, true));
  assert.equal(old.reading.version, 'map-reading.4'); assert.deepEqual(claimsOf(old.project, old.created[0]), []);
});

test('76-Z2 whether GDEH0213B72 is a node of its own stays open; that B72 uses SSD1675A/ssd16xx and builds as reel_board@2 is kept', () => {
  const p = zephyr(), inp = ask(p);
  const intro = piece(inp, 'GDEH0213B1 is the display'), now = piece(inp, 'Currently the board is delivered'), b72 = piece(inp, '| Good Display | HINK-E0213A22'), b72end = piece(inp, '| GDEH0213B72');
  const { project, reading, created } = apply(p, inp, reply({ parts: [
    part('new:display', { name: '전자잉크 디스플레이', role: '보드의 EPD 표시와 판본별 빌드 지정을 정한다.', basis: [intro], claims: [
      claim('describes', 'GDEH0213B1은 단종되어 지금은 GDEH0213B72로 출고된다', range(intro, now), { key: 's1' }),
      claim('describes', 'GDEH0213B72는 SSD1675A/ssd16xx 드라이버를 쓰고 reel_board@2로 빌드한다', range(b72, b72end), { key: 's2' })] }),
    part('new:b72', { name: 'GDEH0213B72 표시', basis: [b72] })],
  candidates: [cand('parent', ['new:b72', 'new:display'], { text: 'B72를 디스플레이 아래의 판본으로 둘지, 별도 부분으로 둘지 원문만으로 정할 수 없어요', at: range(b72, b72end) })] }));
  const display = created[0], node = created[1];
  assert.ok(claimsOf(project, display).includes('describes:GDEH0213B72는 SSD1675A/ssd16xx 드라이버를 쓰고 reel_board@2로 빌드한다'));
  assert.equal(project.space.containment.parents[node], undefined, 'only that parent link is open');
  assert.deepEqual(reading.candidates.map(c => [c.target, c.areaIds]), [['parent', [node, display]]]);
});

/* ---------- calibration: an unattributed report, its settled duplicate, and an independent PC fact ---------- */
function calibration() {
  let p = D.addArea(D.createProject(), 'PC 앱', '사용자 PC에서 쓰는 설정 앱'); p = D.addArea(p, '장치 펌웨어', '측정 장치에 들어가는 펌웨어');
  const [pc, dev] = p.space.areas.map(a => a.id);
  p = D.addChildArea(p, pc, '보정', '측정값 입력 화면'); p = D.addChildArea(p, dev, '보정', '영점 오프셋 계산');
  const [pcCal, devCal] = p.space.areas.slice(2).map(a => a.id);
  p = D.pasteRecord(p, CAL, null).project;
  const inp = ask(p), alias = id => [...inp.parts].find(([, x]) => x === id)[0];
  return { p, inp, pcCal, devCal, a: alias(pcCal), b: alias(devCal) };
}
test('76-C1 an unattributed report is kept as such; settling the same statement on the PC part too is refused; an independent PC fact stays', () => {
  const { p, inp, pcCal, devCal, a, b } = calibration(), intro = piece(inp, '보정 작업 정리입니다.'), pcLine = piece(inp, "1) PC 앱의 '보정' 화면"), devLine = piece(inp, "2) 장치 펌웨어의 '보정'");
  const open = cand('attribution', [a, b], { text: '어느 보정의 정리인지 원문만으로 가를 수 없어요', statement: said('s1', '보정 작업을 정리했다', intro, { kind: 'reported' }) });
  // Unattributed only: accepted, attached to no part, kept with its alternatives.
  const only = apply(p, inp, reply({ candidates: [open] }));
  assert.equal(M.partUnderstanding(only.project, pcCal), null); assert.deepEqual(only.reading.candidates[0].areaIds, [pcCal, devCal]);
  assert.equal(only.reading.candidates[0].statement.kind, 'reported');
  // The same statement settled on the PC part as well: refused before anything is applied, with where and what.
  refused(() => M.validateMapReply(reply({ parts: [part(a, { claims: [claim('reported', '보정 작업을 정리했다', intro, { key: 's1' })] })], candidates: [open] }), inp.ask), 'settled-and-open', /candidates\[0\]\.statement\.key = parts\[0\]\.claims\[0\]\.key/);
  // ...also when the settled copy cites another place of the record: the key, not the position, is the statement.
  refused(() => M.validateMapReply(reply({ parts: [part(a, { claims: [claim('reported', '보정 작업을 정리했다', pcLine, { key: 's1' })] })], candidates: [open] }), inp.ask), 'settled-and-open');
  // An independent PC fact of the same record, even with the open statement over the whole of it, stays on the PC part.
  const wide = { ...open, at: range(intro, devLine), statement: { ...open.statement, at: range(intro, pcLine) } };
  const kept = apply(p, inp, reply({ parts: [part(a, { claims: [claim('reported', '측정값 입력란이 소수점 둘째 자리까지 받도록 바꿨다고 보고함', pcLine, { key: 's2' })] })], candidates: [wide] }));
  assert.deepEqual(claimsOf(kept.project, pcCal), ['reported:측정값 입력란이 소수점 둘째 자리까지 받도록 바꿨다고 보고함']);
  assert.equal(kept.reading.candidates[0].statement.text, '보정 작업을 정리했다');
});

/* ---------- parent, identity, material, references ---------- */
test('76-P1 a new part under the very parent its candidate leaves open is refused; with that link null it is applied and nothing else moves', () => {
  const p = D.pasteRecord(D.createProject(), '평가 API는 코드를 파싱하고 실행한다.\n파서는 문자열을 AST로 바꾼다.\n실행기는 바이트코드를 돌린다.', null).project, inp = ask(p);
  const api = piece(inp, '평가 API'), parser = piece(inp, '파서는'), run = piece(inp, '실행기는');
  const parts = parent => [part('new:api', { name: '평가 API', basis: [api] }), part('new:parse', { name: '파서', parent, basis: [parser], claims: [claim('describes', '문자열을 AST로 바꾼다', parser)] }), part('new:run', { name: '실행기', parent: 'new:api', basis: [run] })];
  const open = cand('parent', ['new:parse', 'new:api'], { text: '파서가 평가 API 안의 단계인지 원문만으로 정할 수 없어요' });
  refused(() => M.validateMapReply(reply({ parts: parts('new:api'), candidates: [open] }), inp.ask), 'settled-and-open', /^parts\[1\]\.parent$/);
  const { project, created } = apply(p, inp, reply({ parts: parts(null), candidates: [open] }));
  const [apiId, parseId, runId] = created;
  assert.equal(project.space.containment.parents[parseId], undefined); assert.equal(project.space.containment.parents[runId], apiId);
  assert.deepEqual(claimsOf(project, parseId), ['describes:문자열을 AST로 바꾼다']);
  // Two parts being one stays open: nothing is merged and neither gets the other's evidence.
  const same = apply(p, inp, reply({ parts: parts(null), candidates: [cand('identity', ['new:parse', 'new:run'])] }));
  assert.equal(same.created.length, 3); assert.deepEqual(claimsOf(same.project, same.created[2]), []);
});

test('76-R1 wrong references and contradictions in one reply refuse all of it, each with its path; a reply cannot take back earlier facts', () => {
  const p = D.pasteRecord(D.createProject(), '첫째 사실입니다. 둘째 사실입니다.\n\n예문: “이 문장은 예문입니다. 둘째 예문입니다.”', null).project, inp = ask(p);
  const one = piece(inp, '첫째'), two = piece(inp, '둘째 사실'), ex = piece(inp, '“이 문장은');
  const base = () => reply({ parts: [part('new:a', { name: 'A', basis: [one], claims: [claim('describes', '첫째', one, { key: 's1' }), claim('describes', '둘째', two, { key: 's2' })] }), part('new:b', { name: 'B', basis: [two] })] });
  M.validateMapReply(base(), inp.ask);
  const cases = [
    [r => { r.parts[0].claims[1].key = 's1'; }, 'duplicate-key', /^parts\[0\]\.claims\[1\]\.key$/],
    [r => { r.candidates = [cand('identity', ['new:a', 'new:b']), cand('identity', ['new:b', 'new:a'])]; }, 'duplicate-target', /^candidates\[1\]$/],
    [r => { r.candidates = [cand('holds', ['new:a', 'new:b'], { statement: said('s3', 'x', one) })]; }, 'reference', /^candidates\[0\]\.parts$/],
    [r => { r.candidates = [cand('identity', ['new:a', 'new:b'], { statement: said('s3', 'x', one) })]; }, 'reference', /^candidates\[0\]\.statement$/],
    [r => { r.candidates = [cand('attribution', ['new:a', 'P09'], { statement: said('s3', 'x', one) })]; }, 'reference', /^candidates\[0\]\.parts$/],
    [r => { r.candidates = [cand('attribution', ['new:a'], { statement: said('k1', 'x', one) })]; }, 'reference', /statement\.key$/],
    [r => { r.candidates = [cand('attribution', ['new:a'], { statement: said('s3', 'x', 'N01.99') })]; }, 'reference', /^candidates\[0\]\.statement\.at$/],
    [r => { r.candidates = [cand('merge', ['new:a', 'new:b'])]; }, 'reference', /^candidates\[0\]\.target$/],
    [r => { r.parts[0].claims[0].at = 'N01.02-01'; }, 'reference', /^parts\[0\]\.claims\[0\]\.at$/],
    // Material and map evidence at once: refused, never filtered down to what is left.
    [r => { r.material = [{ at: range(piece(inp, '예문:'), ex), what: '예문' }]; r.parts[1].claims = [claim('describes', '예문', ex)]; }, 'material-evidence', /^parts\[1\]\.claims\[0\]\.at$/],
    [r => { r.material = [{ at: ex, what: '예문' }]; r.candidates = [cand('holds', ['new:b'], { statement: said('s3', '예문', ex) })]; }, 'material-evidence', /^candidates\[0\]\.statement\.at$/],
  ];
  for (const [change, rule, path] of cases) { const r = base(); change(r); refused(() => M.validateMapReply(r, inp.ask), rule, path); }
  // A candidate names no earlier claim: holds and attribution keep a statement of this reply, never a current claim key.
  const first = apply(p, inp, base()).project, later = ask(D.pasteRecord(first, '셋째 사실입니다.', null).project);
  const c = later.ask.parts.flatMap(x => x.current.map(y => y.key))[0];
  refused(() => M.validateMapReply(reply({ candidates: [cand('holds', ['P01'], { statement: said(c, 'x', 'N01.01') })] }), later.ask), 'reference', /statement\.key$/);
});

/* ---------- the same result whatever the paragraphs, line breaks or order of parts ---------- */
test('76-L1 paragraphs, line breaks and the order of parts change nothing kept: the open statement and both declared facts', () => {
  const tight = ZEPHYR.dts.replace(/;\n\n\tpinctrl-0/, ';\n\tpinctrl-0');
  assert.notEqual(tight, ZEPHYR.dts);
  const read = (dts, reverse) => {
    const p = zephyr(dts), inp = ask(p), r = busReply(inp); if (reverse) r.parts.reverse();
    const out = apply(p, inp, r); return { claims: claimsOf(out.project, out.created[0]), open: out.reading.candidates.map(c => [c.target, c.statement.text]) };
  };
  const a = read(ZEPHYR.dts, false), b = read(tight, false), c = read(ZEPHYR.dts, true);
  assert.deepEqual(a, b); assert.deepEqual(a, c); assert.equal(a.claims.length, 2);
  // In the tight text both facts rest on one code piece; still two statements, both kept.
  const p = zephyr(tight), inp = ask(p); assert.equal(holding(inp, 'clock-frequency'), holding(inp, 'pinctrl-names'));
});

/* ---------- wire, prompt, capability, storage ---------- */
test('76-W1 m6 is advertised and sent; m5 and older stay served; a contradiction returns its path from the server; map-reading.5 stays in project.13', async () => {
  assert.match(await mapPromptId(), /^m6-[0-9a-f]{12}$/);
  const p = zephyr(), inp = ask(p), sent = [];
  const bad = busReply(inp); bad.parts[0].claims[0].key = 's3';
  for (const [r, status, detail] of [[busReply(inp), 200, null], [bad, 502, { path: 'candidates[0].statement.key = parts[0].claims[0].key', rule: 'settled-and-open', target: 's3' }]]) {
    const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-76-not-real' }, fetchImpl: async (_u, init) => { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(r) } }] })); } });
    const res = await handle(new Request('https://studio.example/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1' }, body: JSON.stringify(inp.ask) }));
    assert.equal(res.status, status); if (detail) assert.deepEqual((await res.json()).error, { code: 'INVALID_RESPONSE', detail });
  }
  assert.equal(sent[0].messages[0].content, MAP6_FIRST_PROMPT); assert.equal(map6Prompt({ ...inp.ask, parts: [{}] }), MAP6_PROMPT);
  for (const t of [MAP6_PROMPT, MAP6_FIRST_PROMPT]) {
    for (const rule of ['target 하나로 밝힌다', '원문이 이미 답한 것을 다시 묻지 않는다', '요구·계획을 현재 구현으로 확정하거나', '근거 위치(at)가 겹친다는 것은 같은 진술이라는 뜻이 아니다', '응답 전체가 거절된다', '"key":null']) assert.ok(t.includes(rule), rule);
    assert.ok(!t.includes('지도 근거가 되지 않는다'), 'material overlap is refused, not dropped');
  }
  assert.ok(MAP5_PROMPT.includes('지도 근거가 되지 않는다') && !MAP5_PROMPT.includes('target 하나로'), 'the map.5 prompt is as it was'); assert.ok(!MAP5_FIRST_PROMPT.includes('target 하나로'));
  // The client reads the advertised wire: m6 → map.6, m5 → map.5.
  const oldFetch = globalThis.fetch, bodies = [];
  try {
    globalThis.fetch = async (_u, o) => { bodies.push(JSON.parse(o.body)); return new Response('{"error":{"code":"AI_UNAVAILABLE"}}', { status: 503 }); };
    for (const prompt of ['m6-0123456789ab', 'm5-0123456789ab']) await createMapRun({ current: () => ({ key: prompt, kind: 'saved', project: p, view: studioView(p) }), status: () => ({ ai: 'deepseek', model: 'm', access: 'open', map: { model: 'm', prompt } }), accessCode: () => '', commit: async () => null, done: () => {}, changed: () => {} }).run();
  } finally { globalThis.fetch = oldFetch; }
  assert.deepEqual(bodies.map(b => b.schemaVersion), ['studio.map.6', 'studio.map.5']);
  // Storage: map-reading.5 is checked as stored; it never rides in a project.12; a project.12 reads as it was.
  const done = apply(p, inp, busReply(inp)).project, tamper = f => { const x = JSON.parse(JSON.stringify(done)); f(lastReading(x)); return JSON.stringify(x); };
  for (const raw of [tamper(r => { r.candidates[0].target = 'merge'; }), tamper(r => { r.candidates[0].statement = null; }), tamper(r => { r.candidates[0].statement.quote.from += 1; }),
    tamper(r => { r.candidates[0].target = 'identity'; }), JSON.stringify({ ...done, schemaVersion: 'idea015.project.12' })]) assert.throws(() => parseProject(raw));
  const p12 = D.pasteRecord(D.createProject(), CAL, null).project, inp5 = ask(p12, M.MAP5_SCHEMA);
  const v12 = apply(p12, inp5, reply({ candidates: [{ text: '어느 보정인지', parts: [], at: piece(inp5, '보정 작업 정리입니다.') }] })).project;
  const legacy = JSON.stringify({ ...v12, schemaVersion: 'idea015.project.12' });
  assert.deepEqual(parseProject(legacy).readings, v12.readings); assert.equal(lastReading(v12).version, 'map-reading.4'); assert.ok(!('target' in lastReading(v12).candidates[0]));
});
