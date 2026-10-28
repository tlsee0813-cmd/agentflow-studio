// AF-EXPERIENCE77 contract counterexamples. Every reply below is written for the test: the kinds in it are the test's own
// answer, not a check of a model's reading. Records are short synthetic texts written here. Run after building app/continuity:
//   node --test docs/cycles/2026-10-29-first-reading-77/reading77.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../../../app/continuity/dist/public/shared/domain.js';
import * as M from '../../../app/continuity/dist/public/shared/map-reading.js';
import { studioView } from '../../../app/continuity/dist/public/shared/studio.js';
import { textDigest } from '../../../app/continuity/dist/public/shared/evidence-span.js';
import { makeAsk77, bindingOf77, validateReading77, parseReading77, decodeReading77, providerBody77, PROMPT77, PROVIDER77, KINDS77, Reading77Error } from './reading77.mjs';

const source = (...texts) => { let p = D.createProject(); for (const t of texts) p = D.pasteRecord(p, t, null).project; return M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA).ask; };
const freeze = v => { if (v && typeof v === 'object') { Object.freeze(v); for (const x of Object.values(v)) freeze(x); } return v; };
/** The alias of the sent piece that begins with these words (the nth such piece, in whichever record holds it). */
const piece = (ask, words, nth = 0) => { const hits = ask.records.flatMap(r => r.spans.filter(x => x.t.trimStart().startsWith(words))); assert.ok(hits.length > nth, words); return hits[nth].s; };
const range = (a, b) => `${a}-${b.split('.')[1]}`;
const item = (kind, text, refs) => ({ kind, text, refs });
const refused = (fn, rule, path) => assert.throws(fn, e => e instanceof Reading77Error && e.rule === rule && (!path || e.path === path), `expected ${rule}${path ? ` at ${path}` : ''}`);

const REPEAT = '## 판독 예문\n입력 처리를 바꿨습니다.\n\n## 실제 보고\n입력 처리를 바꿨습니다.';
const ORDER = '요구: 폴더 안의 마크다운 문서를 한 번에 변환한다.\n검사 예문: “폴더 입력을 구현했습니다. 모든 검사를 통과했습니다.”\n변환은 문서마다 PDF 하나를 만든다.\n\n단, 이번 판본에서는 폴더 입력을 아직 구현하지 않았습니다.';

test('77-A the ask copies only project and records of a map.6 ask, leaves the source as it was, and binds to what was sent', () => {
  const src = freeze(source(ORDER)), before = JSON.stringify(src), ask = makeAsk77(src);
  assert.deepEqual(Object.keys(ask), ['schemaVersion', 'project', 'records']); assert.equal(ask.schemaVersion, 'reading.77');
  assert.deepEqual(ask.records, src.records); assert.notEqual(ask.records, src.records);
  for (const gone of ['parts', 'relations', 'requests', 'priors']) assert.ok(!(gone in ask), gone);
  assert.equal(JSON.stringify(src), before);
  const b = bindingOf77(ask), text = ask.records[0].lead + ask.records[0].spans.map(x => x.t).join('');
  assert.deepEqual(b.records, [{ id: 'N01', length: ORDER.length, digest: textDigest(ORDER) }]); assert.equal(text, ORDER);
  assert.equal(b.ask, textDigest(JSON.stringify(ask))); assert.equal(b.index, 'span.2');
  // A map.1–3 ask (copied quotes, no pieces) or a piece table that is not span.2's is no source.
  let p = D.pasteRecord(D.createProject(), ORDER, null).project;
  refused(() => makeAsk77(M.buildMapAsk(p, studioView(p)).ask), 'source-not-map5-or-map6');
  const bad = structuredClone(src); bad.records[0].spans[0].t += 'x';
  refused(() => makeAsk77(bad), 'not-span2', '$.records[0]');
});

test('77-B the same sentence as an example and as the real report: each ref keeps its own place, the second exactly', () => {
  const ask = makeAsk77(source(REPEAT)), first = piece(ask, '입력 처리를 바꿨습니다.'), second = piece(ask, '입력 처리를 바꿨습니다.', 1);
  const out = validateReading77({ items: [item('example', '판독 예문 속 문장이다', [first]), item('report', '입력 처리를 바꿨다고 보고함', [second])] }, ask);
  const [ex, rep] = out.items.map(x => x.refs[0]);
  assert.equal(ex.quote, rep.quote); assert.notEqual(ex.from, rep.from);
  assert.equal(rep.from, REPEAT.lastIndexOf('입력 처리를 바꿨습니다.')); assert.equal(REPEAT.slice(rep.from, rep.to), rep.quote);
});

test('77-C a negation at the end and an example apart from the requirement stay where they stand (kinds written by the test)', () => {
  const ask = makeAsk77(source(ORDER)), req = piece(ask, '요구:'), exA = piece(ask, '“폴더 입력을'), exB = piece(ask, '모든 검사를'), not = piece(ask, '단, 이번 판본');
  const out = validateReading77({ items: [
    item('requirement', '폴더 안 마크다운 문서를 한 번에 변환하길 원한다', [req]),
    item('example', '폴더 입력 구현과 검사 통과는 검사 예문 속 문장이다', [range(exA, exB)]),
    item('report', '이번 판본에서는 폴더 입력을 아직 구현하지 않았다고 밝힘', [not])] }, ask);
  assert.deepEqual(out.items.map(x => x.kind), ['requirement', 'example', 'report']);
  assert.equal(out.items[2].refs[0].quote, '단, 이번 판본에서는 폴더 입력을 아직 구현하지 않았습니다.');
  assert.equal(out.items[1].refs[0].quote, '“폴더 입력을 구현했습니다. 모든 검사를 통과했습니다.”');
  for (const x of out.items) for (const r of x.refs) assert.equal(ORDER.slice(r.from, r.to), r.quote);
  // The exact passage is no proof of the kind: the contract would take the example's words as a report just the same.
  assert.equal(validateReading77({ items: [item('report', '폴더 입력을 구현했다', [exA])] }, ask).items[0].kind, 'report');
});

test('77-D one invalid item, a structural field, a wrong or too long reference, or a cut reply refuses the whole reply; nothing is mended', () => {
  const long = Array.from({ length: 20 }, (_, i) => `${i + 1}번째 문장은 원문 범위 길이 상한을 넘기기 위해 충분히 길게 쓴 합성 문장입니다.`).join(' ');
  const ask = makeAsk77(source(ORDER, long)), req = piece(ask, '요구:'), ok = item('requirement', '폴더를 한 번에 변환하길 원한다', [req]);
  const recLong = ask.records.find(r => r.spans.some(x => x.t.startsWith('1번째'))), firstL = recLong.spans[0].s, lastL = recLong.spans.at(-1).s;
  validateReading77({ items: [ok] }, ask);
  assert.ok(long.length > 600, 'the long record is longer than one reference may be');
  const cases = [
    [{ items: [ok, item('requirement', 'x', ['N09.01'])] }, 'unknown-record', '$.items[1].refs[0]'],
    [{ items: [ok, item('requirement', 'x', [`${req.split('.')[0]}.99`])] }, 'unresolved-or-too-long', '$.items[1].refs[0]'],
    [{ items: [item('requirement', 'x', [`${req.split('.')[0]}.03-01`])] }, 'unresolved-or-too-long', '$.items[0].refs[0]'],
    [{ items: [item('description', '긴 범위', [range(firstL, lastL)])] }, 'unresolved-or-too-long', '$.items[0].refs[0]'],
    [{ items: [ok, { ...ok, parent: null }] }, 'keys', '$.items[1]'],
    [{ items: [ok], relations: [] }, 'keys', '$'],
    [{ items: [ok], parts: [] }, 'keys', '$'],
    [{ items: [{ kind: 'requirement', text: 'x', refs: [req], key: 's1' }] }, 'keys', '$.items[0]'],
    [{ items: [item('part', 'x', [req])] }, 'unknown-kind', '$.items[0].kind'],
    [{ items: [item('requirement', 'x', [])] }, 'refs-count', '$.items[0].refs'],
    [{ items: [item('requirement', 'x', [req, req])] }, 'duplicate-ref', '$.items[0].refs'],
    [{ items: [item('requirement', 'x'.repeat(241), [req])] }, 'text', '$.items[0].text'],
    [{ items: [item('requirement', ' ', [req])] }, 'text', '$.items[0].text'],
    [{ items: Array.from({ length: 17 }, () => ok) }, 'too-many', '$.items'],
    [{ items: [item('requirement', 'sk-0123456789abcdefghij 키처럼 보임', [req])] }, 'key-like', '$.items[0].text'],
  ];
  for (const [reply, rule, path] of cases) refused(() => validateReading77(reply, ask), rule, path);
  const four = item('requirement', 'x', [req, piece(ask, '변환은'), piece(ask, '단, 이번'), piece(ask, '검사 예문')]);
  refused(() => validateReading77({ items: [four] }, ask), 'refs-count');
  // A reply cut by the provider is no JSON: refused as such, never completed.
  const raw = JSON.stringify({ items: [ok, ok] });
  refused(() => decodeReading77(raw.slice(0, raw.length - 3), ask), 'incomplete-json', '$');
  assert.equal(decodeReading77(raw, ask).items.length, 2);
});

test('77-E no item is an explicit empty result, not a success; the inputs are left as they were', () => {
  const src = freeze(source(ORDER)), ask = freeze(makeAsk77(src)), reply = freeze({ items: [] }), before = [JSON.stringify(src), JSON.stringify(ask)];
  assert.deepEqual(validateReading77(reply, ask), { schemaVersion: 'reading.77', empty: true, items: [] });
  const full = freeze({ items: [item('requirement', '폴더를 한 번에 변환하길 원한다', [piece(ask, '요구:')])] });
  assert.equal(validateReading77(full, ask).empty, false);
  assert.deepEqual([JSON.stringify(src), JSON.stringify(ask)], before);
});

test('77-F the provider body uses the digest settings and the short prompt; nothing here calls a provider', () => {
  const ask = makeAsk77(source(ORDER)), b = providerBody77(ask, 'deepseek-flash');
  assert.deepEqual([b.thinking, b.reasoning_effort, b.max_tokens, b.response_format], [{ type: 'enabled' }, 'low', 8192, { type: 'json_object' }]);
  assert.equal(PROVIDER77.timeoutMs, 60000); assert.equal(b.messages[0].content, PROMPT77); assert.equal(b.messages[1].content, `INPUT JSON (자료):\n${JSON.stringify(ask)}`);
  assert.deepEqual([...KINDS77], ['requirement', 'description', 'report', 'example', 'choice', 'uncertain']);
  for (const rule of ['원문이 이미 답한 것을 다시 묻지 않는다', '요구를 현재 구현으로 쓰지 않는다', '예문을 제품 사실로 쓰지 않는다', '항목 수를 채우지 않는다', '지도·부분·관계는 만들지 않는다']) assert.ok(PROMPT77.includes(rule), rule);
  assert.ok(PROMPT77.length < 2000, 'short, not a copy of the digest prompt');
});
