import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlan, selectItems, revisePlan, requestSnapshot, parsePlanAnalysis, parsePersistedPlan, compareResults } from '../dist/public/shared/change-plan.js';

const evidence = [
  { id: 'E1', kind: 'user', title: '사용자 요구', text: '성공은 유지하고 실패 파일을 모아 보고 싶다.', basis: '기록 1' },
  { id: 'E2', kind: 'code', title: '현재 결과', text: '현재는 문서 하나의 결과만 설명한다.', basis: 'main@abc:result.ts' },
  { id: 'E3', kind: 'user', title: '독립 요구', text: '폴더 입력 전체를 추가하고 싶다.', basis: '기록 3' }
];
const analysis = () => ({ summary: '파일별 결과를 구별하고 실패를 모아 본다.', items: [
  { id: 'I1', title: '파일별 결과 구별', description: '입력 파일마다 결과를 대응한다.', partIds: ['P1'], refs: ['E2'], dependsOn: [] },
  { id: 'I2', title: '실패 모아 보기', description: '실패한 파일과 이유를 모아 보여 주세요.', partIds: ['P2'], refs: ['E1'], dependsOn: ['I1'] },
  { id: 'I3', title: '폴더 입력', description: '폴더를 입력받는다.', partIds: ['P1'], refs: ['E3'], dependsOn: [] }
], impacts: [{ partId: 'P1', reason: '파일별 대응 여부를 살핀다.', refs: ['E2'] }], preserve: ['성공 결과 유지'], unknowns: ['출력 이름 충돌은 미정'] });
const plan = () => createPlan('PROJECT1', 'main@abc', '폴더 변환과 실패 보고', evidence, analysis());

test('partial selection discloses missing prerequisites without silently requesting them or unrelated scope', () => {
  const full = plan(), partial = selectItems(full, ['I2']);
  assert.deepEqual(full.selected, ['I1', 'I2', 'I3']);
  const snapshot = requestSnapshot(partial);
  assert.deepEqual(snapshot.itemIds, ['I2']);
  assert.match(snapshot.text, /미선택 전제: 파일별 결과 구별/);
  assert.match(snapshot.text, /요청 범위에 포함하지 않았습니다/);
  assert.doesNotMatch(snapshot.text, /입력 파일마다 결과를 대응한다|폴더를 입력받는다|폴더 입력 전체/);
  assert.match(snapshot.text, /성공 결과 유지/); assert.match(snapshot.text, /출력 이름 충돌은 미정/);
  assert.match(snapshot.text, /main@abc:result.ts/); assert.match(snapshot.text, /문서 하나의 결과/);
  assert.match(snapshot.text, /전달·접수·실행 여부는 확인하지 않음/);
});

test('snapshot and prior plan remain unchanged across selection, editing and external mutation', () => {
  const original = plan(), selected = selectItems(original, ['I2']), snapshot = requestSnapshot(selected), before = structuredClone(snapshot);
  const edit = analysis(); edit.items[1].description = '실패 파일을 날짜별로 구별한다.';
  const revised = revisePlan(selected, edit); edit.items[1].description = '외부 변조';
  assert.equal(original.revision, 1); assert.equal(selected.revision, 2); assert.equal(revised.revision, 3);
  assert.equal(revised.analysis.items[1].description, '실패 파일을 날짜별로 구별한다.');
  assert.deepEqual(snapshot, before); assert.match(snapshot.text, /실패한 파일과 이유/);
  assert.doesNotMatch(requestSnapshot(revised).text, /실패한 파일과 이유/);
  assert.deepEqual(selectItems(revised, ['I2']).revision, 3);
});

test('analysis rejects invented refs and parts, empty refs, invalid dependencies, cycles and extra fields', () => {
  const invalid = [
    a => { a.items[0].refs = ['missing']; }, a => { a.items[0].refs = []; },
    a => { a.impacts[0].refs = []; }, a => { a.impacts[0].refs = ['missing']; },
    a => { a.items[0].partIds = ['missing']; }, a => { a.impacts[0].partId = 'missing'; },
    a => { a.items[0].dependsOn = ['missing']; }, a => { a.items[0].dependsOn = ['I2']; },
    a => { a.items[1].id = 'I1'; }, a => { a.items[0].complete = true; },
    a => { a.items[0].description = 'x'.repeat(4001); }
  ];
  for (const mutate of invalid) { const a = analysis(); mutate(a); assert.throws(() => parsePlanAnalysis(a, ['P1', 'P2'], ['E1', 'E2', 'E3'])); }
  const a = analysis(), parsed = parsePlanAnalysis(a, ['P1', 'P2'], ['E1', 'E2', 'E3']);
  a.items[0].title = 'changed'; assert.equal(parsed.items[0].title, '파일별 결과 구별');
});

test('storage parsing validates the whole object without repair or losing detached ownership', () => {
  const saved = plan(), parsed = parsePersistedPlan(saved); assert.deepEqual(parsed, saved);
  saved.analysis.items[0].title = 'outside'; assert.notEqual(parsed.analysis.items[0].title, 'outside');
  for (const mutate of [p => { p.selected = ['missing']; }, p => { p.revision = 0; }, p => { p.createdAt = 'yesterday'; },
    p => { p.evidence[0].kind = 'observed'; }, p => { p.evidence[0].id = 'E2'; }, p => { p.analysis.items[0].refs = ['missing']; },
    p => { p.sent = true; }, p => { p.analysis.impacts = null; }]) {
    const p = plan(); mutate(p); assert.equal(parsePersistedPlan(p), null);
  }
  assert.equal(parsePersistedPlan(null), null); assert.equal(parsePersistedPlan('{invalid}'), null);
});

test('partial observations preserve report/code/test and branch distinctions; silence is an empty list', () => {
  const snapshot = requestSnapshot(plan());
  const observation = (id, kind, basis, itemId = 'I1') => ({ id, itemId, kind, basis, text: `${kind} 내용`, refs: ['E1'] });
  const input = [observation('O1', 'report', '담당 보고'), observation('O2', 'code', 'feature@def'), observation('O3', 'test', 'main@abc:single-file'), observation('O4', 'report', 'other', 'other-item')];
  const results = compareResults(snapshot, input);
  assert.deepEqual(results.map(r => [r.itemId, r.reported.length, r.code.length, r.tests.length]), [['I1', 1, 1, 1], ['I2', 0, 0, 0], ['I3', 0, 0, 0]]);
  assert.equal(results[0].code[0].basis, 'feature@def'); assert.equal(results[0].tests[0].basis, 'main@abc:single-file');
  assert.deepEqual(Object.keys(results[0]), ['itemId', 'reported', 'code', 'tests']);
  input[0].text = 'mutated'; assert.notEqual(results[0].reported[0].text, 'mutated');
  assert.throws(() => compareResults(snapshot, [observation('same', 'report', 'a'), observation('same', 'code', 'b')]));
});
