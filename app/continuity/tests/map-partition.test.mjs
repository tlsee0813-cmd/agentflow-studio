// Model-free: ownership and advisory receipts never create map facts or consume original read coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planMapPartitions, validateExtraction, extractionStageIssues, EXTRACTION_KINDS, EXTRACTION_CANDIDATES_MAX } from '../server/map-partition.mjs';
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

test('receipt must acknowledge every core alias; duplicates and context in it are passed over; the shape stays exact', () => {
  const p = planMapPartitions(ask(record('N01', '하나다.\n둘이다.\n셋이다.')), { targetChars: 11 })[0], good = receipt(p);
  assert.ok(good.covered.length > 1);
  assert.deepEqual(validateExtraction({ ...good, covered: [...good.covered].reverse() }, p), good, 'read back in core order');
  invalid({ ...good, covered: good.covered.slice(1) }, p);
  invalid({ ...good, covered: [...good.covered.slice(1), good.covered[1]] }, p);
  // first-map-divided.7: a repeated core alias, a context alias or an unknown name beside the whole core is passed over, not refused.
  assert.deepEqual(validateExtraction({ ...good, covered: [...good.covered, good.covered[0]] }, p), good);
  assert.deepEqual(validateExtraction({ ...good, covered: [...good.covered, 'N99.99'] }, p), good);
  assert.deepEqual(validateExtraction({ ...good, covered: [p.records[0].context[0], ...good.covered] }, p), good);
  invalid({ ...good, covered: [p.records[0].context[0], ...good.covered.slice(1)] }, p);
  // An alias the model wrote without its zero padding, or as a range over the core, still acknowledges it.
  assert.deepEqual(validateExtraction({ ...good, covered: good.covered.map(a => a.replace(/\.0+(\d)/, '.$1')) }, p), good);
  const first = good.covered[0], last = good.covered.at(-1);
  assert.deepEqual(validateExtraction({ ...good, covered: [`${first}-${last.slice(last.indexOf('.') + 1)}`] }, p), good);
  invalid({ ...good, complete: true }, p); invalid({ covered: good.covered }, p); invalid({ ...good, candidates: 'x' }, p);
});

test('candidates are advisory: a malformed one or one outside the core is set aside alone; aliases are read back to their span names', () => {
  const partitions = planMapPartitions(ask(record('N01', '# 범위\n요구한다.\n예문이다.\n정정한다.\n조건이다.')), { targetChars: 8 });
  const p = partitions[1], good = receipt(p), core = good.covered[0], context = p.records[0].context[0];
  const candidate = { kind: 'condition', text: '원문의 조건을 보존한다.', at: [core, context] };
  for (const kind of EXTRACTION_KINDS) assert.equal(validateExtraction({ ...good, candidates: [{ ...candidate, kind }] }, p).candidates[0].kind, kind);
  // first-map-divided.7 (changed on purpose): each of these used to refuse the whole receipt; now that candidate alone is left out.
  for (const patch of [{ kind: 'checked' }, { text: '' }, { text: ' '.repeat(240) }, { text: '가'.repeat(241) }, { text: 'x\u0000y' },
    { at: [] }, { at: [context] }, { at: ['N99.99'] }, { at: 'quoted words' }]) {
    assert.deepEqual(validateExtraction({ ...good, candidates: [{ ...candidate, ...patch }, candidate] }, p).candidates, [candidate], JSON.stringify(patch));
  }
  // Read back, never invented: a repeated alias once, an unpadded alias as its span name, an extra key dropped, a range only over
  // spans this partition holds (a range running past them is cut to those; one over nothing is set aside).
  const bare = core.replace(/\.0+(\d)/, '.$1');
  assert.deepEqual(validateExtraction({ ...good, candidates: [{ ...candidate, at: [core, core] }] }, p).candidates[0].at, [core]);
  assert.deepEqual(validateExtraction({ ...good, candidates: [{ ...candidate, at: bare }] }, p).candidates[0].at, [core]);
  assert.deepEqual(validateExtraction({ ...good, candidates: [{ ...candidate, quote: 'invented' }] }, p).candidates, [candidate]);
  const index = Number(core.slice(core.indexOf('.') + 1));
  assert.deepEqual(validateExtraction({ ...good, candidates: [{ ...candidate, at: [`${core}-${String(index + 1).padStart(2, '0')}`] }] }, p).candidates[0].at,
    [core, ...(p.records[0].spans.some(s => s.s === `N01.${String(index + 1).padStart(2, '0')}`) ? [`N01.${String(index + 1).padStart(2, '0')}`] : [])]);
  assert.deepEqual(validateExtraction({ ...good, candidates: [{ ...candidate, at: ['N01.90-95'] }] }, p).candidates, []);
  const copy = validateExtraction({ ...good, candidates: [candidate] }, p); copy.candidates[0].at.push('changed'); assert.equal(candidate.at.length, 2);
});

test('24 advisory candidates are kept unchanged; past 24 the rest are left out rather than refusing the receipt', () => {
  assert.equal(EXTRACTION_CANDIDATES_MAX, 24);
  const p = planMapPartitions(ask(record('N01', '조건이다.\n정정한다.')))[0], good = receipt(p);
  const candidates = Array.from({ length: 24 }, (_, i) => ({ kind: i % 2 ? 'condition' : 'correction', text: `보존할 단서 ${i + 1}`, at: [good.covered[i % good.covered.length]] }));
  const input = { ...good, candidates }, before = structuredClone(input), kept = validateExtraction(input, p);
  assert.deepEqual(kept, before); assert.equal(kept.candidates.length, 24);
  assert.deepEqual(kept.candidates.at(-1), candidates.at(-1));
  assert.deepEqual(validateExtraction({ ...input, candidates: [...candidates, { kind: 'condition', text: '25번째 조건', at: [good.covered[0]] }] }, p), before);
  assert.deepEqual(validateExtraction({ ...input, candidates: candidates.map((c, i) => i === 23 ? { ...c, at: ['N99.99'] } : c) }, p).candidates, candidates.slice(0, 23));
  assert.deepEqual(validateExtraction({ ...input, candidates: candidates.map((c, i) => i === 23 ? { ...c, text: '가'.repeat(241) } : c) }, p).candidates, candidates.slice(0, 23));
  assert.deepEqual(input, before);
});

test('an extraction refusal keeps its code and says one coarse reason; correction feedback copies no alias or text', () => {
  const input = ask(record('N01', '요구: 파일을 읽는다.\n조건: 개발 판본만.\n철회: 앞 설명을 취소한다.\n모름: 배포 여부.'));
  const [partition] = planMapPartitions(input, { targetChars: 4000 }), core = partition.records[0].core;
  const reason = value => { try { validateExtraction(value, partition); } catch (error) { assert.equal(error.message, 'INVALID_EXTRACTION'); return error.reason; } return null; };
  const good = { covered: [...core], candidates: [{ kind: 'condition', text: '개발 판본만', at: [core[1]] }] };
  assert.equal(reason(good), null);
  assert.equal(reason([]), 'shape'); assert.equal(reason({ covered: core }), 'shape');
  assert.equal(reason({ ...good, covered: core.slice(1) }), 'coverage'); assert.equal(reason({ ...good, covered: [...core, 'N09.01'] }), null, 'an extra name beside the whole core is passed over');
  // first-map-divided.7: too many, outside-the-partition or malformed candidates are set aside, never a refusal of the receipt.
  for (const candidates of [Array(EXTRACTION_CANDIDATES_MAX + 1).fill(good.candidates[0]), [{ ...good.candidates[0], at: ['N09.01'] }], [{ ...good.candidates[0], kind: 'checked' }]]) assert.equal(reason({ ...good, candidates }), null);
  const bad = { covered: [core[0], core[0], 'N09.01'], candidates: [{ kind: 'checked', text: '가'.repeat(241), at: ['N09.01'] }, { kind: 'part' }] };
  const issues = extractionStageIssues(bad, partition);
  assert.deepEqual(issues, [
    { path: 'covered', rule: 'coverage', expected: core.length, actual: 1 }, { path: 'covered', rule: 'reference', expected: null, actual: null },
    { path: 'covered', rule: 'duplicate', expected: null, actual: null }, { path: 'candidates[0].kind', rule: 'kind', expected: null, actual: null },
    { path: 'candidates[0].text', rule: 'length', expected: 240, actual: 241 }, { path: 'candidates[0].at', rule: 'reference', expected: null, actual: null },
    { path: 'candidates[1]', rule: 'keys', expected: null, actual: null }]);
  assert.ok(!JSON.stringify(issues).includes('N0')); assert.ok(!JSON.stringify(issues).includes('가가'));
  assert.deepEqual(extractionStageIssues(good, partition), []);
  assert.deepEqual(extractionStageIssues('x', partition), [{ path: 'reply', rule: 'shape', expected: null, actual: null }]);
});
