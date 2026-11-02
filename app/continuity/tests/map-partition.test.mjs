// Model-free: ownership and advisory receipts never create map facts or consume original read coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planMapPartitions, validateExtraction, EXTRACTION_KINDS, EXTRACTION_CANDIDATES_MAX } from '../server/map-partition.mjs';
import { encodeSpans, indexSpans, resolveEvidenceRange } from '../dist/public/shared/evidence-span.js';

const record = (id, text, extra = {}) => ({ id, kind: 'pasted', basis: '사용자 기재 source/main', note: '발췌 표시', ...encodeSpans(id, text), ...extra });
const ask = (...records) => ({ records });
const allCore = partitions => partitions.flatMap(p => p.records.flatMap(r => r.core));
const receipt = partition => ({ covered: partition.records.flatMap(r => r.core), candidates: [] });
const invalid = (value, partition) => assert.throws(() => validateExtraction(value, partition), /^Error: INVALID_EXTRACTION$/);

test('all original aliases are owned exactly once, across records, without changing input or span bytes/marks', () => {
  const input = ask(record('N01', ' \r\n# 제목\r\n요구: 😀 파일을 읽는다.\r\n\r\n- 파일마다 저장한다.\r\n```js\r\nrun();\r\n```\r\n'),
    record('R01', '\t\r\n| 열 | 값 |\r\n| a | b |\r\n끝이다.', { kind: 'evidence' }));
  const before = structuredClone(input), partitions = planMapPartitions(input, { targetChars: 35 });
  const originals = input.records.flatMap(r => r.spans.map(s => s.s));
  assert.deepEqual(allCore(partitions), originals);
  assert.equal(new Set(allCore(partitions)).size, originals.length);
  assert.deepEqual(input, before); assert.ok(partitions.length > 1);
  for (const p of partitions) for (const r of p.records) {
    const source = input.records.find(x => x.id === r.id);
    assert.equal(r.lead, source.lead); assert.equal(r.kind, source.kind); assert.equal(r.basis, source.basis); assert.equal(r.note, source.note);
    assert.deepEqual(r.spans, source.spans.filter(s => [...r.core, ...r.context].includes(s.s)));
    assert.ok(r.core.every(s => !r.context.includes(s)));
    assert.ok(r.context.length <= 6, 'two neighbors on each side plus two previous headings');
    assert.deepEqual(validateExtraction(receipt(p), p), receipt(p));
  }
  // Returned packets cannot mutate the input (including nested original span marks).
  partitions[0].records[0].spans[0].t = 'changed'; assert.deepEqual(input, before);
});

test('original non-span lead survives every split; nearest headings and two neighbors retain source order', () => {
  const source = record('N01', '  \r\n# 범위\n## 판본\n하나다.\n둘이다.\n셋이다.\n넷이다.\n다섯이다.\n여섯이다.\n');
  const partitions = planMapPartitions(ask(source), { targetChars: 10 });
  const last = partitions.at(-1).records[0];
  assert.equal(source.lead, '  \r\n');
  assert.ok(partitions.every(p => p.records[0].lead === source.lead));
  assert.ok(last.context.includes(source.spans[0].s)); assert.ok(last.context.includes(source.spans[1].s));
  assert.deepEqual(last.spans.map(s => s.s), source.spans.filter(s => [...last.core, ...last.context].includes(s.s)).map(s => s.s));
});

test('later report arrival metadata survives each split exactly and absent timestamps are not invented', () => {
  const addedAt = '2026-11-02T05:06:07.000Z';
  const input = ask(record('R01', '조건이다.\n보고한다.\n정정한다.\n보류한다.', { kind: 'report', addedAt }),
    record('N01', '요구한다.'));
  const before = structuredClone(input), partitions = planMapPartitions(input, { targetChars: 8 });
  const reports = partitions.flatMap(p => p.records.filter(r => r.id === 'R01'));
  assert.ok(reports.length > 1);
  assert.ok(reports.every(r => Object.hasOwn(r, 'addedAt') && r.addedAt === addedAt));
  assert.ok(partitions.flatMap(p => p.records.filter(r => r.id === 'N01')).every(r => !Object.hasOwn(r, 'addedAt')));
  assert.deepEqual(input, before);
});

test('global packing can include multiple records, preserving source identities and all final anchor offsets', () => {
  const source = record('N01', '\r\n첫 😀 문장이다.\r\n\r\n둘째 문장이다.\r\n셋째 문장이다.');
  const input = ask(source, record('R01', '판본: feature/a\n아직 실행하지 않았다.', { kind: 'report' }));
  const one = planMapPartitions(input, { targetChars: 1000 }); assert.equal(one.length, 1); assert.equal(one[0].records.length, 2);
  const chunks = planMapPartitions(input, { targetChars: 18 });
  const text = source.lead + source.spans.map(s => s.t).join(''), spans = indexSpans(text);
  for (const p of chunks) for (const r of p.records.filter(r => r.id === 'N01')) for (const alias of r.core) {
    const cited = resolveEvidenceRange(alias, 'N01', text, spans);
    assert.ok(cited); assert.equal(text.slice(cited.from, cited.to), cited.quote);
  }
  assert.deepEqual(allCore(chunks), input.records.flatMap(r => r.spans.map(s => s.s)));
});

test('indivisible oversized spans and partition count overflow fail explicitly, with original input untouched', () => {
  const input = ask(record('N01', '첫 문장이다.\n둘째 문장이다.\n셋째 문장이다.'));
  const before = structuredClone(input);
  assert.throws(() => planMapPartitions(input, { targetChars: 2 }), /MAP_PARTITION_TOO_LARGE/);
  assert.throws(() => planMapPartitions(input, { targetChars: 10, maxPartitions: 1 }), /MAP_PARTITION_LIMIT/);
  assert.deepEqual(input, before);
  for (const targetChars of [0, -1, 1.1, Infinity]) assert.throws(() => planMapPartitions(input, { targetChars }), /INVALID_PARTITION_INPUT/);
});

test('receipt requires every core alias once; sparse empty candidates acknowledge reading but do not assert facts', () => {
  const p = planMapPartitions(ask(record('N01', '하나다.\n둘이다.\n셋이다.')), { targetChars: 11 })[0], good = receipt(p);
  assert.ok(good.covered.length > 1);
  assert.deepEqual(validateExtraction({ ...good, covered: [...good.covered].reverse() }, p).candidates, []);
  invalid({ ...good, covered: good.covered.slice(1) }, p);
  invalid({ ...good, covered: [...good.covered.slice(1), good.covered[1]] }, p);
  invalid({ ...good, covered: [...good.covered, 'N99.99'] }, p);
  invalid({ ...good, covered: [p.records[0].context[0], ...good.covered.slice(1)] }, p);
  invalid({ ...good, complete: true }, p); invalid({ covered: good.covered }, p);
});

test('candidate kinds and references are strict, context is advisory, ranges/quotes/unknown aliases cannot replace original aliases', () => {
  const partitions = planMapPartitions(ask(record('N01', '# 범위\n요구한다.\n예문이다.\n정정한다.\n조건이다.')), { targetChars: 8 });
  const p = partitions[1], good = receipt(p), core = good.covered[0], context = p.records[0].context[0];
  const candidate = { kind: 'condition', text: '원문의 조건을 보존한다.', at: [core, context] };
  for (const kind of EXTRACTION_KINDS) assert.equal(validateExtraction({ ...good, candidates: [{ ...candidate, kind }] }, p).candidates[0].kind, kind);
  for (const patch of [{ kind: 'checked' }, { text: '' }, { text: ' '.repeat(240) }, { text: '가'.repeat(241) }, { text: 'x\u0000y' },
    { at: [] }, { at: [context] }, { at: ['N99.99'] }, { at: [core, core] }, { at: [`${core}-99`] }, { quote: 'invented' }]) {
    invalid({ ...good, candidates: [{ ...candidate, ...patch }] }, p);
  }
  const copy = validateExtraction({ ...good, candidates: [candidate] }, p); copy.candidates[0].at.push('changed'); assert.equal(candidate.at.length, 2);
});

test('24 advisory candidates retain every condition/correction unchanged; 25 refuse without truncating or weakening anchor guards', () => {
  assert.equal(EXTRACTION_CANDIDATES_MAX, 24);
  const p = planMapPartitions(ask(record('N01', '조건이다.\n정정한다.')))[0], good = receipt(p);
  const candidates = Array.from({ length: 24 }, (_, i) => ({ kind: i % 2 ? 'condition' : 'correction', text: `보존할 단서 ${i + 1}`, at: [good.covered[i % good.covered.length]] }));
  const input = { ...good, candidates }, before = structuredClone(input), kept = validateExtraction(input, p);
  assert.deepEqual(kept, before); assert.equal(kept.candidates.length, 24);
  assert.deepEqual(kept.candidates.at(-1), candidates.at(-1));
  invalid({ ...input, candidates: [...candidates, { kind: 'condition', text: '25번째 조건', at: [good.covered[0]] }] }, p);
  invalid({ ...input, candidates: candidates.map((c, i) => i === 23 ? { ...c, at: ['N99.99'] } : c) }, p);
  invalid({ ...input, candidates: candidates.map((c, i) => i === 23 ? { ...c, text: '가'.repeat(241) } : c) }, p);
  assert.deepEqual(input, before);
});
