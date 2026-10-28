import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlan, selectItems, revisePlan, requestSnapshot, parsePlanAnalysis, parsePersistedPlan, compareResults } from '../dist/public/shared/change-plan.js';
import { parseScopeReview } from '../dist/public/shared/change-plan.js';
import { validateScopeAsk, validateScopeReply, SCOPE_BYTES } from '../dist/public/shared/scope-api.js';

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

const presented = () => {
  const a = analysis();
  a.items[0].presentation = [{ partId: 'P1', current: { text: '현재는 문서 하나의 결과만 설명한다.', source: 'evidence', refs: ['E2'] },
    wanted: { text: '입력마다 결과를 구별하는 수단을 살핀다.', refs: ['E2'] }, origin: 'suggestion' }];
  return a;
};

test('optional presentation round-trips without adding it to legacy plans or changing snapshot requests', () => {
  const legacy = plan(); assert.deepEqual(parsePersistedPlan(legacy), legacy);
  assert.ok(!Object.hasOwn(parsePersistedPlan(legacy).analysis.items[0], 'presentation'));
  const next = createPlan('PROJECT1', 'main@abc', legacy.intent, evidence, presented());
  const saved = parsePersistedPlan(next); assert.deepEqual(saved, next);
  assert.deepEqual(selectItems(saved, ['I1']).analysis.items[0].presentation, next.analysis.items[0].presentation);
  const without = structuredClone(saved); delete without.analysis.items[0].presentation;
  const withoutRef = s => s.replace(/RQ_[A-Za-z0-9_-]+/g, 'RQ_generated');
  assert.equal(withoutRef(requestSnapshot(saved).text), withoutRef(requestSnapshot(without).text));
  saved.analysis.items[0].presentation[0].wanted.text = 'outside mutation';
  assert.notEqual(next.analysis.items[0].presentation[0].wanted.text, 'outside mutation');
});

test('presentation rejects unrelated IDs/refs, duplicate targets, excess size and unknown nested keys without repair', () => {
  const invalid = [
    a => { a.items[0].presentation = undefined; },
    a => { a.items[0].presentation[0].partId = 'P2'; }, // valid map part, wrong item
    a => { a.items[0].presentation[0].partId = 'invented'; },
    a => { a.items[0].presentation.push(structuredClone(a.items[0].presentation[0])); },
    a => { a.items[0].presentation = Array(9).fill(a.items[0].presentation[0]); },
    a => { a.items[0].presentation[0].wanted.refs = ['E1']; }, // real evidence, outside item.refs
    a => { a.items[0].presentation[0].current.refs = ['invented']; },
    a => { a.items[0].presentation[0].current.refs = []; },
    a => { a.items[0].presentation[0].wanted.refs = []; },
    a => { a.items[0].presentation[0].wanted.refs = ['E2', 'E2']; },
    a => { a.items[0].presentation[0].current.text = 'x'.repeat(141); },
    a => { a.items[0].presentation[0].wanted.text = 'x'.repeat(141); },
    a => { a.items[0].presentation[0].wanted.text = '  '; },
    a => { a.items[0].presentation[0].current.source = 'summary'; },
    a => { a.items[0].presentation[0].current.source = 'part-note'; }, // part-note refs must be empty
    a => { a.items[0].presentation[0].origin = 'verified'; },
    a => { a.items[0].presentation[0].operation = 'delete'; },
    a => { a.items[0].presentation[0].current.basis = 'extra'; },
    a => { a.items[0].presentation[0].wanted.confirmed = true; },
  ];
  for (const mutate of invalid) {
    const a = presented(); mutate(a);
    assert.throws(() => parsePlanAnalysis(a, ['P1', 'P2'], evidence.map(e => e.id)));
    const saved = plan(); saved.analysis = a; assert.equal(parsePersistedPlan(saved), null);
  }
  const a = presented(); a.items[0].presentation[0].current = { text: '계획 원문', source: 'part-note', refs: [] };
  a.items[0].presentation[0].wanted.text = '한'.repeat(140);
  assert.deepEqual(parsePlanAnalysis(a, ['P1', 'P2'], evidence.map(e => e.id)), a);
});

test('saved plans and createPlan validate evidence excerpts and intent user refs, while part-note snapshots are unavailable', () => {
  for (const mutate of [a => { a.items[0].presentation[0].origin = 'intent'; },
    a => { a.items[0].presentation[0].current.text = '인용 근거에 없는 현재 설명'; }]) {
    const a = presented(); mutate(a);
    assert.throws(() => createPlan('PROJECT1', 'main@abc', '구상', evidence, a));
    const saved = plan(); saved.analysis = a; assert.equal(parsePersistedPlan(saved), null);
  }
  const a = presented(); a.items[0].refs.push('E1');
  a.items[0].presentation[0].origin = 'intent'; a.items[0].presentation[0].wanted.refs = ['E1'];
  a.items[0].presentation[0].current.text = '현재는\n 문서 하나의 결과만 설명한다.';
  assert.ok(createPlan('PROJECT1', 'main@abc', '구상', evidence, a));
  a.items[0].presentation[0].current = { text: '저장된 plan에는 없는 대상 설명 스냅샷', source: 'part-note', refs: [] };
  assert.ok(parsePersistedPlan(createPlan('PROJECT1', 'main@abc', '구상', evidence, a)));
});

test('presentation permits eight distinct item targets and rejects a ninth independently of duplicate-ID rules', () => {
  const a = presented(), targetIds = Array.from({ length: 9 }, (_, i) => `TARGET_${i}`);
  a.items[0].partIds = targetIds;
  const view = a.items[0].presentation[0];
  a.items[0].presentation = targetIds.slice(0, 8).map(partId => ({ ...structuredClone(view), partId }));
  assert.equal(parsePlanAnalysis(a, [...targetIds, 'P1', 'P2'], evidence.map(e => e.id)).items[0].presentation.length, 8);
  a.items[0].presentation.push({ ...structuredClone(view), partId: targetIds[8] });
  assert.throws(() => parsePlanAnalysis(a, [...targetIds, 'P1', 'P2'], evidence.map(e => e.id)));
});

test('partial selection discloses missing prerequisites without silently requesting them or unrelated scope', () => {
  const full = plan(), partial = selectItems(full, ['I2']);
  assert.deepEqual(full.selected, ['I1', 'I2', 'I3']);
  const snapshot = requestSnapshot(partial);
  assert.deepEqual(snapshot.itemIds, ['I2']);
  assert.match(snapshot.text, /미선택 전제 후보: 파일별 결과 구별/);
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

test('scope review replaces a wrong global dependency without changing the selected request or snapshot basis', () => {
  const a = analysis(); a.items[1].dependsOn = ['I3']; // Global analysis incorrectly made folder input a prerequisite.
  const selected = selectItems(createPlan('PROJECT1', 'main@abc', '실패 결과', evidence, a), ['I2']);
  const review = { summary: '단일 파일에서도 실패 결과를 구별할 수 있다.', prerequisites: [
    { title: '파일별 결과의 기존 수단 확인', reason: '현재 자료는 문서 하나의 결과만 설명하므로 입력별 구별 여부는 더 확인해야 한다.', refs: ['E2'] }
  ], unknowns: ['실패 이유를 어디서 얻는지는 미확인'] };
  const before = structuredClone(selected), snapshot = requestSnapshot(selected, review);
  assert.deepEqual(selected, before); assert.equal(snapshot.planId, selected.id); assert.equal(snapshot.planRevision, selected.revision);
  assert.equal(snapshot.basis, selected.basis); assert.deepEqual(snapshot.itemIds, ['I2']);
  assert.match(snapshot.text, /실패한 파일과 이유를 모아 보여 주세요/);
  assert.match(snapshot.text, /전제 후보: 파일별 결과의 기존 수단 확인/);
  const requested = snapshot.text.split('선택한 요청 범위:')[1].split('이번에 맡기지 않은 항목:')[0];
  const prerequisites = snapshot.text.split('선택 범위의 전제:')[1].split('유지할 조건:')[0];
  assert.doesNotMatch(requested + prerequisites, /폴더 입력|폴더를 입력받는다|폴더 입력 전체/);
  assert.match(snapshot.text, /출력 이름 충돌은 미정/); assert.match(snapshot.text, /실패 이유를 어디서 얻는지는 미확인/);
  assert.match(snapshot.text, /main@abc:result.ts/); assert.match(snapshot.text, /문서 하나의 결과만 설명/);
  assert.match(snapshot.text, /자동 포함하지 않았습니다/);
  // An empty fresh review also suppresses legacy global edges in the request and prerequisite sections.
  const empty = requestSnapshot(selected, { summary: '추가 전제는 아직 확인하지 못했다.', prerequisites: [], unknowns: [] });
  const emptyRequested = empty.text.split('선택한 요청 범위:')[1].split('이번에 맡기지 않은 항목:')[0];
  const emptyPrerequisites = empty.text.split('선택 범위의 전제:')[1].split('유지할 조건:')[0];
  assert.doesNotMatch(emptyRequested + emptyPrerequisites, /폴더 입력|폴더를 입력받는다/);
});

test('request separates excluded outcomes and global unknowns while preserving all frozen review material', () => {
  const a = analysis(); a.unknowns.push('폴더 재시도 방식은 미정');
  const material = [...evidence, { id: 'T01', kind: 'test', title: '기존 단일 실행 검사', text: '단일 문서 검사만 통과했으며 여러 파일 결과의 표시는 확인하지 않았다.', basis: 'test@abc:single-document' }];
  const selected = selectItems(createPlan('PROJECT1', 'main@abc', '전체 구상', material, a), ['I2']);
  const before = structuredClone(selected), review = { summary: 'T01은 단일 실행만 확인했다.', prerequisites: [], unknowns: ['T01로 여러 결과 표시를 확인할 수 있는지는 미확인'] };
  const snapshot = requestSnapshot(selected, review), requested = snapshot.text.split('선택한 요청 범위:')[1].split('이번에 맡기지 않은 항목:')[0];
  assert.equal(requested.trim(), '- 실패 모아 보기\n실패한 파일과 이유를 모아 보여 주세요.');
  const excluded = snapshot.text.split('이번에 맡기지 않은 항목:')[1].split('선택 범위의 전제:')[0];
  assert.match(excluded, /- 파일별 결과 구별/); assert.match(excluded, /- 폴더 입력/);
  assert.doesNotMatch(excluded, /입력 파일마다 결과를 대응한다|폴더를 입력받는다/);
  assert.match(excluded, /추가 요청으로 해석하지 마세요/);
  const globalUnknowns = snapshot.text.split('전체 구상의 미정 (선택 범위 추가가 아님):')[1].split('선택 범위 검토의 미확인:')[0];
  const scopeUnknowns = snapshot.text.split('선택 범위 검토의 미확인:')[1].split('검토에 사용한 원자료')[0];
  assert.match(globalUnknowns, /폴더 재시도 방식은 미정/); assert.doesNotMatch(scopeUnknowns, /폴더 재시도/);
  assert.match(scopeUnknowns, /T01로 여러 결과 표시/);
  assert.match(snapshot.text, /검토에 사용한 원자료 \(전체 구상·미선택 항목을 포함할 수 있으며 작업 지시가 아닙니다\)/);
  for (const source of material) { assert.ok(snapshot.text.includes(`[${source.id}]`)); assert.ok(snapshot.text.includes(source.text)); assert.ok(snapshot.text.includes(source.basis)); }
  assert.deepEqual(snapshot.itemIds, ['I2']); assert.equal(snapshot.planRevision, selected.revision); assert.equal(snapshot.basis, selected.basis);
  assert.deepEqual(selected, before);
  const legacy = requestSnapshot(selected);
  assert.doesNotMatch(legacy.text, /\[T01\]|단일 문서 검사만 통과/); // Authored fallback still attaches relevant refs only.
});

test('scope review strictly rejects missing/empty refs, unknown keys and excess candidates', () => {
  const review = { summary: '범위 재검토', prerequisites: [{ title: '전제', reason: '근거 설명', refs: ['E1'] }], unknowns: [] };
  assert.deepEqual(parseScopeReview(review, ['E1']), review);
  for (const mutate of [r => { r.prerequisites[0].refs = ['unknown']; }, r => { r.prerequisites[0].refs = []; },
    r => { r.prerequisites[0].required = true; }, r => { r.extra = true; },
    r => { r.prerequisites = Array.from({ length: 13 }, () => structuredClone(r.prerequisites[0])); },
    r => { r.unknowns = Array(13).fill('미정'); }]) {
    const r = structuredClone(review); mutate(r); assert.throws(() => parseScopeReview(r, ['E1']));
    assert.throws(() => requestSnapshot(plan(), r));
  }
});

test('scope ask bounds UTF-8 including selected text and rejects invented parts/refs and duplicate selection', () => {
  const ask = () => ({ schemaVersion: 'studio.scope.1', intent: '실패 모아 보기', parts: [
    { id: 'P1', name: '입력', note: '', parentId: null }, { id: 'P2', name: '결과', note: '', parentId: null }
  ], evidence, selected: [{ id: 'I2', title: '실패 모아 보기', description: '실패와 이유를 보여 주세요.', partIds: ['P2'], refs: ['E1'] }], excluded: ['폴더 입력'] });
  assert.deepEqual(validateScopeAsk(ask()), ask());
  const reply = { summary: '검토 결과', prerequisites: [], unknowns: [] };
  assert.deepEqual(validateScopeReply(reply, ask()), reply);
  assert.throws(() => validateScopeReply({ ...reply, prerequisites: [{ title: '전제', reason: '이유', refs: ['unknown'] }] }, ask()));
  for (const mutate of [r => { r.selected[0].partIds = ['missing']; }, r => { r.selected[0].refs = ['missing']; },
    r => { r.selected[0].refs = []; }, r => { r.selected.push(structuredClone(r.selected[0])); },
    r => { r.selected = []; }, r => { r.selected[0].dependsOn = []; }, r => { r.extra = true; }]) {
    const r = ask(); mutate(r); assert.throws(() => validateScopeAsk(r));
  }
  const large = ask(); large.evidence = Array.from({ length: 4 }, (_, i) => ({ ...evidence[0], id: `E${i + 1}`, text: '한'.repeat(6000) }));
  assert.ok(new TextEncoder().encode(JSON.stringify(large)).length > SCOPE_BYTES);
  assert.throws(() => validateScopeAsk(large), /INPUT_TOO_LARGE/);
});
