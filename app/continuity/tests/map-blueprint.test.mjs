// Model-free blueprint/render contracts. These author-written wires are not evidence of model-generation quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { ApiError } from '../../server/errors.mjs';
import { validateMapBlueprint, splitBlueprintParts, validateRenderedFragment, combineRenderedMaps, mapStageIssues,
  BLUEPRINT_PARTS_MAX, BLUEPRINT_NEW_PARTS_MAX, BLUEPRINT_GLOBAL_MAX, BLUEPRINT_ANCHORS_MAX } from '../server/map-blueprint.mjs';

function fixture(existing = 0) {
  let project = D.createProject(); for (let i = 0; i < existing; i++) project = D.addArea(project, `사용자 부분 ${i + 1}`, '직접 쓴 설명');
  project = D.pasteRecord(project, Array.from({ length: 12 }, (_, i) => `원문 😀 책임 ${i + 1}의 조건과 범위를 설명한다.`).join('\r\n'), null).project;
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP7_SCHEMA);
  assert.equal(input.problem, null);
  return { project, input, ask: input.ask, at: input.ask.records[0].spans.map(span => span.s) };
}
const planned = (f, count = 1) => ({ parts: Array.from({ length: count }, (_, i) => ({ ref: `new:p${i + 1}`, name: `책임 ${i + 1}`,
  parent: null, focus: '원문의 책임과 조건을 보존한다.', at: [f.at[i % f.at.length]] })), global: [] });
const empty = () => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] });
const refused = fn => assert.throws(fn, error => error instanceof ApiError && error.code === 'INVALID_RESPONSE' && error.status === 502);
function rendered(f, blueprint) {
  return splitBlueprintParts(blueprint).map((group, index) => ({ ...empty(), parts: group.parts.map((part, i) => ({ ref: part.ref,
    name: part.ref.startsWith('new:') ? part.name : null, parent: part.ref.startsWith('new:') ? part.parent : null,
    role: part.ref.startsWith('new:') ? '원문에서 정의한 책임을 다룬다.' : null,
    ...(f.ask.schemaVersion === M.MAP7_SCHEMA ? { roleAboutAt: null } : { roleAbout: null }),
    roleReplaces: null, basis: part.ref.startsWith('new:') ? part.at : [], claims: [{ key: `s${index * 100 + i + 1}`,
      kind: 'describes', text: '원문이 정의한 동작을 설명한다.', at: part.at[0],
      ...(f.ask.schemaVersion === M.MAP7_SCHEMA ? { aboutAt: null } : { about: null }), replaces: null }] })) }));
}

test('blueprint preserves exact user names/parents and original aliases and returns an independent deep copy', () => {
  const f = fixture(1), blueprint = planned(f);
  blueprint.parts.unshift({ ref: f.ask.parts[0].id, name: f.ask.parts[0].name, parent: f.ask.parts[0].parentId, at: [f.at[1]], focus: '기존 사용자의 부분' });
  blueprint.global.push({ kind: 'correction', text: '원문의 정정 범위를 유지한다.', at: [f.at[0], f.at[2]] });
  const before = structuredClone(blueprint), result = validateMapBlueprint(blueprint, f.ask);
  assert.deepEqual(result, before); result.parts[0].at.push(f.at[3]); result.global[0].text = 'changed'; assert.deepEqual(blueprint, before);
  for (const mutate of [p => { p.parts[0].name += ' 변경'; }, p => { p.parts[0].parent = 'new:p1'; },
    p => { p.parts[0].ref = 'P99'; }, p => { p.parts[1].ref = 'new:BadKey'; }, p => { p.parts[1].ref = p.parts[0].ref; },
    p => { p.parts[1].at = ['C01']; }, p => { p.parts[1].at = ['N99.01']; }, p => { p.parts[1].at = [`${f.at[0]}-02`]; },
    p => { p.parts[1].at = [f.at[0], f.at[0]]; }, p => { p.parts[1].at = []; }, p => { delete p.parts[1].parent; },
    p => { p.parts[1].focus = '\u0000'; }, p => { p.global[0].kind = 'checked'; }, p => { p.extra = []; }]) {
    const invalid = structuredClone(before); mutate(invalid); refused(() => validateMapBlueprint(invalid, f.ask));
  }
});

test('blueprint bounds are exact: 24 total, 12 new, 24 global, 8 anchors, 60-unit name and 240-unit focus/text', () => {
  assert.deepEqual([BLUEPRINT_PARTS_MAX, BLUEPRINT_NEW_PARTS_MAX, BLUEPRINT_GLOBAL_MAX, BLUEPRINT_ANCHORS_MAX], [24, 12, 24, 8]);
  const f = fixture(12), blueprint = planned(f, 12);
  blueprint.parts.unshift(...f.ask.parts.map(part => ({ ref: part.id, name: part.name, parent: part.parentId, at: [f.at[0]], focus: '기존 책임' })));
  blueprint.parts.at(-1).name = '가'.repeat(60); blueprint.parts.at(-1).focus = '가'.repeat(240); blueprint.parts.at(-1).at = f.at.slice(0, 8);
  blueprint.global = Array.from({ length: 24 }, () => ({ kind: 'condition', text: '가'.repeat(240), at: f.at.slice(0, 8) }));
  assert.deepEqual(validateMapBlueprint(blueprint, f.ask), blueprint);
  refused(() => validateMapBlueprint(planned(f, 13), f.ask));
  const f25 = fixture(25), old25 = { parts: f25.ask.parts.map(part => ({ ref: part.id, name: part.name, parent: part.parentId, at: [f25.at[0]], focus: '기존 책임' })), global: [] };
  refused(() => validateMapBlueprint(old25, f25.ask));
  for (const mutate of [p => p.global.push(p.global[0]), p => p.parts.at(-1).at.push(f.at[8]),
    p => { p.parts.at(-1).name += '가'; }, p => { p.parts.at(-1).focus += '가'; }, p => { p.global[0].text += '가'; }]) {
    const bad = structuredClone(blueprint); mutate(bad); refused(() => validateMapBlueprint(bad, f.ask));
  }
});

test('parent choices reject unknown parents/self/cycles and preserve existing containment', () => {
  const f = fixture(1), blueprint = planned(f, 3);
  blueprint.parts[0].parent = f.ask.parts[0].id; blueprint.parts[1].parent = blueprint.parts[0].ref; blueprint.parts[2].parent = blueprint.parts[1].ref;
  validateMapBlueprint(blueprint, f.ask);
  for (const parent of ['P99', 'new:unplanned', blueprint.parts[0].ref]) {
    const bad = structuredClone(blueprint); bad.parts[0].parent = parent; refused(() => validateMapBlueprint(bad, f.ask));
  }
  const cycle = structuredClone(blueprint); cycle.parts[0].parent = cycle.parts[2].ref; refused(() => validateMapBlueprint(cycle, f.ask));
  let p = D.addChildArea(f.project, f.project.space.areas[0].id, '사용자 하위 부분', '직접 쓴 하위 설명');
  const input = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA), child = input.ask.parts.find(part => part.parentId !== null);
  const old = { parts: [{ ref: child.id, name: child.name, parent: child.parentId, at: [input.ask.records[0].spans[0].s], focus: '기존 하위 책임' }], global: [] };
  validateMapBlueprint(old, input.ask); old.parts[0].parent = null; refused(() => validateMapBlueprint(old, input.ask));
});

test('split is deterministic, at most three parts per group and eight groups; each group is an independent copy', () => {
  const f = fixture(12), blueprint = planned(f, 12);
  blueprint.parts.push(...f.ask.parts.map(part => ({ ref: part.id, name: part.name, parent: part.parentId, at: [f.at[0]], focus: '기존 책임' })));
  const groups = splitBlueprintParts(blueprint);
  assert.equal(groups.length, 8); assert.ok(groups.every(group => group.parts.length === 3));
  assert.deepEqual(groups.map(group => group.id), Array.from({ length: 8 }, (_, i) => `parts-${i + 1}`));
  assert.deepEqual(groups.flatMap(group => group.parts), blueprint.parts);
  groups[0].parts[0].at.push(f.at[1]); assert.equal(blueprint.parts[0].at.length, 1);
  assert.deepEqual(splitBlueprintParts({ parts: [], global: [] }), []);
});

test('fragment validation supports cross-group parents without changing raw parents, names, anchors or original ask', () => {
  const f = fixture(), blueprint = planned(f, 4); blueprint.parts[0].parent = blueprint.parts[3].ref;
  const fragments = rendered(f, blueprint), groups = splitBlueprintParts(blueprint), before = structuredClone({ fragments, ask: f.ask });
  const validated = validateRenderedFragment(fragments[0], groups[0], f.ask, blueprint);
  assert.deepEqual(validated, fragments[0]); assert.equal(validated.parts[0].parent, 'new:p4');
  const global = { ...empty(), summary: '원문이 정의한 책임과 흐름을 설명한다.', relations: [{ from: 'new:p1', to: 'new:p4', kind: 'needs', note: '원문의 책임을 사용한다', at: f.at[0] }] };
  const combined = combineRenderedMaps(fragments, global, f.ask, blueprint);
  assert.deepEqual(combined, { ...global, parts: fragments.flatMap(fragment => fragment.parts) });
  assert.deepEqual({ fragments, ask: f.ask }, before);
  const decoded = M.validateMapReply(combined, f.ask), applied = M.applyReading(f.project, f.input, decoded,
    { id: 'R_blueprint-apply', at: '2026-11-02T00:00:00.000Z', model: 'stub', prompt: 'm6-000000000001', hash: 'a'.repeat(64) });
  assert.equal(applied.created.length, 4); assert.equal(applied.reading.relations.length, 1);
  const quote = decoded.parts[0].basis[0], original = M.askRecords(f.ask).get(quote.record).text;
  assert.equal(original.slice(quote.from, quote.to), quote.quote);
});

test('fragments cannot take another group, rename/reparent, omit/duplicate a ref, populate globals, or use another statement key range', () => {
  const f = fixture(), blueprint = planned(f, 4), fragments = rendered(f, blueprint), group = splitBlueprintParts(blueprint)[0];
  for (const mutate of [x => { x.parts[0].ref = 'new:p4'; }, x => { x.parts[0].name = '바꾼 이름'; }, x => { x.parts[0].parent = 'new:p4'; },
    x => x.parts.pop(), x => { x.parts[0] = x.parts[1]; }, x => { x.summary = '조각 요약'; }, x => { x.gaps = ['조각 공백']; },
    x => { x.relations = [{}]; }, x => { x.candidates = [{}]; }, x => { x.matches = [{}]; }, x => { x.material = [{}]; },
    x => { x.parts[0].basis = ['N99.01']; }, x => { x.parts[0].claims[0].key = 's101'; }, x => { x.parts[0].claims[0].key = 's0'; },
    x => { x.parts[0].claims[0].key = 's001'; }, x => { delete x.matches; }, x => { x.extra = true; }]) {
    const bad = structuredClone(fragments[0]); mutate(bad); refused(() => validateRenderedFragment(bad, group, f.ask, blueprint));
  }
  for (const [index, key] of [[0, 's99'], [1, 's199']]) {
    const good = structuredClone(fragments[index]); good.parts[0].claims[0].key = key;
    validateRenderedFragment(good, splitBlueprintParts(blueprint)[index], f.ask, blueprint);
  }
  for (const key of ['s100', 's200', 's801']) {
    const bad = structuredClone(fragments[1]); bad.parts[0].claims[0].key = key;
    refused(() => validateRenderedFragment(bad, splitBlueprintParts(blueprint)[1], f.ask, blueprint));
  }
});

test('existing fragment names and parent stay null on map wire while original blueprint names stay exact', () => {
  const f = fixture(1), part = f.ask.parts[0], blueprint = { parts: [{ ref: part.id, name: part.name, parent: part.parentId, focus: '기존 책임', at: [f.at[0]] }], global: [] };
  const fragments = rendered(f, blueprint), group = splitBlueprintParts(blueprint)[0];
  validateRenderedFragment(fragments[0], group, f.ask, blueprint);
  const bad = structuredClone(fragments[0]); bad.parts[0].name = part.name; refused(() => validateRenderedFragment(bad, group, f.ask, blueprint));
});

test('global owns summary/gaps and cross-group facts; whole-map contradictions and map.6 bad evidence fail without repair', () => {
  const f = fixture(), blueprint = planned(f, 4), fragments = rendered(f, blueprint);
  const global = { ...empty(), summary: '원문의 설명이다.', gaps: ['추가 책임의 정의가 필요하다.'], candidates: [{ target: 'holds', text: '이 책임의 선택은 미정이다.',
    parts: ['new:p4'], at: f.at[4], statement: { key: 's801', kind: 'idea', text: '다른 출력을 구상한다.', at: f.at[4], about: null } }] };
  const result = combineRenderedMaps(fragments, global, f.ask, blueprint);
  assert.deepEqual(result.gaps, global.gaps); assert.deepEqual(result.candidates, global.candidates);
  const badGlobal = structuredClone(global); badGlobal.parts = fragments[0].parts; refused(() => combineRenderedMaps(fragments, badGlobal, f.ask, blueprint));
  refused(() => combineRenderedMaps(fragments.slice(1), global, f.ask, blueprint));
  const conflict = structuredClone(global); conflict.material = [{ at: f.at[0], what: '내포 예문' }];
  refused(() => combineRenderedMaps(fragments, conflict, f.ask, blueprint));
  const unknown = structuredClone(global); unknown.relations = [{ from: 'new:p1', to: 'new:missing', kind: 'needs', note: '', at: f.at[0] }];
  refused(() => combineRenderedMaps(fragments, unknown, f.ask, blueprint));
});

test('map.7 keeps original anchored-condition and soft-exclusion policy; combiner returns raw wire without silently deleting items', () => {
  const f = fixture(1), blueprint = planned(f), fragments = rendered(f, blueprint), group = splitBlueprintParts(blueprint)[0];
  fragments[0].parts[0].claims[0].aboutAt = 'N99.99';
  const checked = validateRenderedFragment(fragments[0], group, f.ask, blueprint);
  assert.deepEqual(checked, fragments[0]);
  const combined = combineRenderedMaps(fragments, empty(), f.ask, blueprint);
  assert.equal(combined.parts[0].claims[0].aboutAt, 'N99.99');
  const decoded = M.validateMapReply(combined, f.ask);
  assert.equal(decoded.parts[0].claims.length, 0); assert.ok(M.setAside(decoded).some(error => error.path.includes('aboutAt')));
  assert.equal(fragments[0].parts[0].claims.length, 1, 'original renderer wire remains intact for existing diagnostics');
});

test('correction feedback identifies all three five-basis parts without copying source, aliases, target, or error message', () => {
  const f = fixture(), blueprint = planned(f, 3), fragment = rendered(f, blueprint)[0];
  fragment.parts.forEach(part => { part.basis = f.at.slice(0, 5); });
  const before = structuredClone(fragment); let failure;
  try { validateRenderedFragment(fragment, splitBlueprintParts(blueprint)[0], f.ask, blueprint); } catch (error) { failure = error; }
  assert.equal(failure.code, 'INVALID_RESPONSE');
  Object.assign(failure, { target: 'PRIVATE_TARGET_SOURCE', message: 'PRIVATE_FAILURE_SOURCE' });
  const issues = mapStageIssues(fragment, failure);
  assert.deepEqual(issues, [0, 1, 2].map(i => ({ path: `parts[${i}].basis`, rule: 'count', expected: 4, actual: 5 })));
  assert.deepEqual(fragment, before); assert.equal(failure.message, 'PRIVATE_FAILURE_SOURCE');
  const encoded = JSON.stringify(issues);
  assert.ok(!encoded.includes('PRIVATE')); assert.ok(!encoded.includes('N01.')); assert.ok(!encoded.includes('원문'));
});

test('feedback limits mirror the validator, use UTF-16 length, and are capped at twelve fixed diagnostics', () => {
  const value = { ...empty(), summary: '😀'.repeat(100), parts: [{ basis: Array(4).fill(null), claims: Array(4).fill(null), name: '가'.repeat(60), role: '가'.repeat(300) }],
    relations: Array(12).fill(null), candidates: Array(6).fill(null), gaps: Array(2).fill(null), matches: Array(24).fill(null), material: Array(6).fill(null) };
  assert.deepEqual(mapStageIssues(value), []);
  value.summary += '가'; value.parts[0].basis.push(null); value.parts[0].claims.push(null); value.parts[0].name += '가'; value.parts[0].role += '가';
  for (const field of ['relations', 'candidates', 'gaps', 'matches', 'material']) value[field].push(null);
  assert.deepEqual(mapStageIssues(value), [
    { path: 'summary', rule: 'length', expected: 200, actual: 201 },
    { path: 'parts[0].basis', rule: 'count', expected: 4, actual: 5 }, { path: 'parts[0].claims', rule: 'count', expected: 4, actual: 5 },
    { path: 'parts[0].name', rule: 'length', expected: 60, actual: 61 }, { path: 'parts[0].role', rule: 'length', expected: 300, actual: 301 },
    { path: 'relations', rule: 'count', expected: 12, actual: 13 }, { path: 'candidates', rule: 'count', expected: 6, actual: 7 },
    { path: 'gaps', rule: 'count', expected: 2, actual: 3 }, { path: 'matches', rule: 'count', expected: 24, actual: 25 },
    { path: 'material', rule: 'count', expected: 6, actual: 7 },
  ]);
  const many = mapStageIssues({ ...empty(), parts: Array.from({ length: 24 }, () => ({ basis: Array(5).fill(null) })) });
  assert.equal(many.length, 12); assert.equal(many.at(-1).path, 'parts[11].basis');
});

test('final validation preserves only safe internal MapReplyError path/rule and keeps the existing public error code', () => {
  const f = fixture(), blueprint = planned(f), fragments = rendered(f, blueprint), global = { ...empty(),
    relations: [{ from: 'new:p1', to: 'new:p1', kind: 'needs', note: '', at: f.at[0] }] };
  // Use two real endpoints so the final check reaches the bad evidence anchor rather than the endpoint guard.
  const plan2 = planned(f, 2), rendered2 = rendered(f, plan2);
  global.relations[0].to = 'new:p2'; global.relations[0].at = 'N99.99'; let failure;
  try { combineRenderedMaps(rendered2, global, f.ask, plan2); } catch (error) { failure = error; }
  assert.deepEqual([failure.code, failure.status, failure.detail], ['INVALID_RESPONSE', 502, undefined]);
  assert.deepEqual(failure.validation, { path: 'relations[0].at', rule: 'reference' });
  assert.deepEqual(mapStageIssues(global, failure), [{ path: 'relations[0].at', rule: 'reference', expected: null, actual: null }]);
  const badFragment = structuredClone(fragments[0]); badFragment.parts[0].basis = ['N99.99']; let fragmentFailure;
  try { validateRenderedFragment(badFragment, splitBlueprintParts(blueprint)[0], f.ask, blueprint); } catch (error) { fragmentFailure = error; }
  assert.deepEqual(fragmentFailure.validation, { path: 'parts[0].basis[0]', rule: 'reference' });
});

test('unsafe paths/rules and failing diagnostic accessors never leak or alter the failed stage outcome', () => {
  for (const path of ['PRIVATE_SOURCE', 'parts[0].basis PRIVATE_SOURCE', 'parts[0].unknown_source', 'parts[0].basis\nPRIVATE_SOURCE', 'parts[1000].basis']) {
    assert.deepEqual(mapStageIssues(empty(), new M.MapReplyError(path, 'reference', 'PRIVATE_TARGET')), []);
  }
  assert.deepEqual(mapStageIssues(empty(), { name: 'MapReplyError', path: 'parts[0].basis', rule: 'PRIVATE_RULE', target: 'PRIVATE_TARGET' }), []);
  const targetTrap = new M.MapReplyError('parts[0].basis', 'reference', 'PRIVATE_TARGET');
  Object.defineProperty(targetTrap, 'target', { get: () => assert.fail('diagnostics must never read error.target') });
  assert.deepEqual(mapStageIssues(empty(), targetTrap), [{ path: 'parts[0].basis', rule: 'reference', expected: null, actual: null }]);
  const valueTrap = new Proxy({}, { get() { throw new Error('PRIVATE_VALUE_TRAP'); } });
  const errorTrap = new Proxy({}, { get() { throw new Error('PRIVATE_ERROR_TRAP'); } });
  assert.deepEqual(mapStageIssues(valueTrap, errorTrap), []);
  const f = fixture(), blueprint = planned(f), invalidFragment = rendered(f, blueprint)[0];
  invalidFragment.parts[0].basis = Array(5).fill(f.at[0]);
  refused(() => validateRenderedFragment(invalidFragment, splitBlueprintParts(blueprint)[0], f.ask, blueprint));
  mapStageIssues(valueTrap, errorTrap);
  refused(() => validateRenderedFragment(invalidFragment, splitBlueprintParts(blueprint)[0], f.ask, blueprint));
});
