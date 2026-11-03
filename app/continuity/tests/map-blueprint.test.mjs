// Model-free blueprint/render contracts. These author-written wires are not evidence of model-generation quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { validateProject } from '../dist/public/shared/validation.js';
import { ApiError } from '../../server/errors.mjs';
import { validateMapBlueprint, splitBlueprintParts, validateRenderedFragment, fragmentSetAside, combineRenderedMaps, combineRenderedReading, mapStageIssues, blueprintStageIssues,
  isMapRevision, validateMapRevision, revisionGroups,
  missingMapCorrections, mapCorrectionRevision, MAP_BLUEPRINT_PROMPT, LATER_BLUEPRINT_PROMPT,
  BLUEPRINT_PARTS_MAX, BLUEPRINT_NEW_PARTS_MAX, BLUEPRINT_LATER_NEW_PARTS_MAX, BLUEPRINT_GLOBAL_MAX, BLUEPRINT_FIRST_GLOBAL_MAX, BLUEPRINT_RELATION_ITEMS_MAX,
  BLUEPRINT_LATER_RELATION_ITEMS_MAX, BLUEPRINT_ANCHORS_MAX, blueprintCoverage, readingDiagnostics, sectionRows,
  BLUEPRINT_LATER_PARTS_MAX, blueprintPartsMax, fragmentKeys, factRows, uncitedFacts, planClaims, payloadParts, finalDiagnostics, FINAL_DIAGNOSTICS, FRAGMENT_KEYS } from '../server/map-blueprint.mjs';

function fixture(existing = 0) {
  let project = D.createProject(); for (let i = 0; i < existing; i++) project = D.addArea(project, `사용자 부분 ${i + 1}`, '직접 쓴 설명');
  project = D.pasteRecord(project, Array.from({ length: 12 }, (_, i) => `원문 😀 책임 ${i + 1}의 조건과 범위를 설명한다.`).join('\r\n'), null).project;
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP7_SCHEMA);
  assert.equal(input.problem, null);
  return { project, input, ask: input.ask, at: input.ask.records[0].spans.map(span => span.s) };
}
const planned = (f, count = 1) => ({ parts: Array.from({ length: count }, (_, i) => ({ ref: `new:p${i + 1}`, name: `책임 ${i + 1}`,
  parent: null, focus: '원문의 책임과 조건을 보존한다.', at: [f.at[i % f.at.length]] })), global: [],
  ...(f.ask.schemaVersion === M.MAP7_SCHEMA ? { corrections: [] } : {}) });
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

test('blueprint bounds are exact: 36 total and 36 new for a first map, 24 total and 12 new for a later one, 32 global, 8 anchors, 60-unit name, 480-unit focus and 240-unit text', () => {
  assert.deepEqual([BLUEPRINT_PARTS_MAX, BLUEPRINT_NEW_PARTS_MAX, BLUEPRINT_LATER_NEW_PARTS_MAX, BLUEPRINT_GLOBAL_MAX, BLUEPRINT_ANCHORS_MAX], [36, 36, 12, 32, 8]);
  // This fixture is a later map (map.7, existing parts): twelve new parts are its bound.
  const f = fixture(12), blueprint = planned(f, 12);
  blueprint.parts.unshift(...f.ask.parts.map(part => ({ ref: part.id, name: part.name, parent: part.parentId, at: [f.at[0]], focus: '기존 책임' })));
  blueprint.parts.at(-1).name = '가'.repeat(60); blueprint.parts.at(-1).focus = '가'.repeat(480); blueprint.parts.at(-1).at = f.at.slice(0, 8);
  blueprint.global = Array.from({ length: 32 }, () => ({ kind: 'condition', text: '가'.repeat(240), at: f.at.slice(0, 8) }));
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
  const old = { parts: [{ ref: child.id, name: child.name, parent: child.parentId, at: [input.ask.records[0].spans[0].s], focus: '기존 하위 책임' }], global: [], corrections: [] };
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
  // .32: 48 keys a fragment (s1-s48, s101-s148 …).
  for (const [index, key] of [[0, 's48'], [1, 's148']]) {
    const good = structuredClone(fragments[index]); good.parts[0].claims[0].key = key;
    validateRenderedFragment(good, splitBlueprintParts(blueprint)[index], f.ask, blueprint);
  }
  for (const key of ['s100', 's149', 's199', 's200', 's801']) {
    const bad = structuredClone(fragments[1]); bad.parts[0].claims[0].key = key;
    refused(() => validateRenderedFragment(bad, splitBlueprintParts(blueprint)[1], f.ask, blueprint));
  }
  // .21: a claim over 240 characters refuses the first pass (so the correction rewrites it) and names its path and length (the
  // correction's reply is read as before: a first map sets the item aside, a later map refuses it as its contract says).
  const f0 = fixture(), b0 = planned(f0, 4), fr0 = rendered(f0, b0), g0 = splitBlueprintParts(b0)[0];
  const long = structuredClone(fr0[0]); long.parts[0].claims[0].text = '상태'.repeat(121);
  assert.ok(long.parts[0].claims[0].text.length > 240);
  // .23: between 220 and 240 the first pass is refused too (the correction rewrites with room), while the lenient read stands.
  const mid = structuredClone(fr0[0]); mid.parts[0].claims[0].text = '상태'.repeat(115);
  assert.equal(mid.parts[0].claims[0].text.length, 230);
  refused(() => validateRenderedFragment(mid, group, f.ask, blueprint, true));
  validateRenderedFragment(mid, group, f.ask, blueprint, false);
  const error = refused(() => validateRenderedFragment(long, g0, f0.ask, b0, true));
  assert.deepEqual(mapStageIssues(long, error).find(x => x.rule === 'length' && x.path === 'parts[0].claims[0].text'), { path: 'parts[0].claims[0].text', rule: 'length', expected: 220, actual: long.parts[0].claims[0].text.length });
  refused(() => validateRenderedFragment(long, g0, f0.ask, b0, false));
});

test('existing fragment names and parent stay null on map wire while original blueprint names stay exact', () => {
  const f = fixture(1), part = f.ask.parts[0], blueprint = { parts: [{ ref: part.id, name: part.name, parent: part.parentId, focus: '기존 책임', at: [f.at[0]] }], global: [], corrections: [] };
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
  // first-map-divided.6 (changed on purpose): a material range over adopted evidence and a relation with an unknown end are single
  // items. Each is left out of the applicable wire with its fixed reason instead of refusing the whole map; nothing else changes.
  const conflict = structuredClone(global); conflict.material = [{ at: f.at[0], what: '내포 예문' }];
  const dropped = combineRenderedReading(fragments, conflict, f.ask, blueprint);
  assert.deepEqual(dropped.wire, result); assert.deepEqual(dropped.exclusions.map(x => [x.path, x.rule, x.category]), [['material[0]', 'material-evidence', null]]);
  const unknown = structuredClone(global); unknown.relations = [{ from: 'new:p1', to: 'new:missing', kind: 'needs', note: '', at: f.at[0] }];
  const kept = combineRenderedReading(fragments, unknown, f.ask, blueprint);
  assert.deepEqual(kept.wire.relations, []); assert.deepEqual(kept.exclusions.map(x => [x.path, x.rule, x.category]), [['relations[0]', 'contract', 'ends']]);
  // A contradiction between statements still refuses the whole wire: a candidate leaving open what a claim already states.
  const settled = structuredClone(global); settled.candidates[0].statement.key = 's1';
  refused(() => combineRenderedMaps(fragments, settled, f.ask, blueprint));
  const twice = structuredClone(global); twice.candidates.push(structuredClone(twice.candidates[0]));
  refused(() => combineRenderedMaps(fragments, twice, f.ask, blueprint));
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
  // first-map-divided.6: five basis quotes alone no longer refuse a fragment (the fifth is set aside); a fragment that also
  // breaks a whole-fragment rule (here its summary) still fails and its feedback still names every over-count basis.
  validateRenderedFragment(fragment, splitBlueprintParts(blueprint)[0], f.ask, blueprint);
  fragment.summary = '조각 요약';
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
  const value = { ...empty(), summary: '😀'.repeat(100), parts: [{ basis: Array(4).fill(null), claims: Array(16).fill(null), name: '가'.repeat(60), role: '가'.repeat(300) }],
    relations: Array(48).fill(null), candidates: Array(6).fill(null), gaps: Array(2).fill(null), matches: Array(24).fill(null), material: Array(6).fill(null) };
  assert.deepEqual(mapStageIssues(value), []);
  value.summary += '가'; value.parts[0].basis.push(null); value.parts[0].claims.push(null); value.parts[0].name += '가'; value.parts[0].role += '가';
  for (const field of ['relations', 'candidates', 'gaps', 'matches', 'material']) value[field].push(null);
  assert.deepEqual(mapStageIssues(value), [
    { path: 'summary', rule: 'length', expected: 200, actual: 201 },
    { path: 'parts[0].basis', rule: 'count', expected: 4, actual: 5 }, { path: 'parts[0].claims', rule: 'count', expected: 16, actual: 17 },
    { path: 'parts[0].name', rule: 'length', expected: 60, actual: 61 }, { path: 'parts[0].role', rule: 'length', expected: 300, actual: 301 },
    { path: 'relations', rule: 'count', expected: 48, actual: 49 }, { path: 'candidates', rule: 'count', expected: 6, actual: 7 },
    { path: 'gaps', rule: 'count', expected: 2, actual: 3 }, { path: 'matches', rule: 'count', expected: 24, actual: 25 },
    { path: 'material', rule: 'count', expected: 6, actual: 7 },
  ]);
  // .32: a later map's feedback keeps six claims per part (its render correction says later; its global one the map.7 ask).
  const seven = { ...empty(), parts: [{ claims: Array(7).fill(null) }] };
  assert.deepEqual(mapStageIssues(seven, null, { later: true }), [{ path: 'parts[0].claims', rule: 'count', expected: 6, actual: 7 }]);
  assert.deepEqual(mapStageIssues(seven), []);
  const many = mapStageIssues({ ...empty(), parts: Array.from({ length: 24 }, () => ({ basis: Array(5).fill(null) })) });
  assert.equal(many.length, 12); assert.equal(many.at(-1).path, 'parts[11].basis');
});

test('final validation preserves only safe internal MapReplyError path/rule and keeps the existing public error code', () => {
  const f = fixture(), blueprint = planned(f), fragments = rendered(f, blueprint), global = { ...empty(),
    relations: [{ from: 'new:p1', to: 'new:p2', kind: 'needs', note: '', at: 'N99.99' }] };
  const plan2 = planned(f, 2), rendered2 = rendered(f, plan2);
  // first-map-divided.6 (changed on purpose): one relation citing an unknown alias is set aside with its fixed reason.
  const aside = combineRenderedReading(rendered2, global, f.ask, plan2);
  assert.deepEqual(aside.wire.relations, []); assert.deepEqual(aside.exclusions.map(x => [x.path, x.rule]), [['relations[0].at', 'reference']]);
  // A contradiction still refuses the whole wire and keeps its safe path/rule: the same target left open twice.
  const identity = { text: '같은 대상인지 미정이다.', parts: ['new:p1', 'new:p2'], at: null, target: 'identity', statement: null };
  global.candidates = [identity, structuredClone(identity)]; let failure;
  try { combineRenderedMaps(rendered2, global, f.ask, plan2); } catch (error) { failure = error; }
  assert.deepEqual([failure.code, failure.status, failure.detail], ['INVALID_RESPONSE', 502, undefined]);
  assert.deepEqual(failure.validation, { path: 'candidates[1]', rule: 'duplicate-target' });
  assert.deepEqual(mapStageIssues(global, failure), [{ path: 'candidates[1]', rule: 'duplicate-target', expected: null, actual: null }]);
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
  // A new part left without any resolvable basis quote is refused whole (five repeated valid quotes would now keep the first four).
  invalidFragment.parts[0].basis = Array(5).fill('N99.99');
  refused(() => validateRenderedFragment(invalidFragment, splitBlueprintParts(blueprint)[0], f.ask, blueprint));
  mapStageIssues(valueTrap, errorTrap);
  refused(() => validateRenderedFragment(invalidFragment, splitBlueprintParts(blueprint)[0], f.ask, blueprint));
});

test('semantic revision sentinel is separate from normal map wire and preserves exact raw-source pointers as untrusted review data', () => {
  const f = fixture(1), blueprint = planned(f, 4), revision = { reviseParts: ['new:p4', 'new:p1'],
    reason: '현재 구현 보고의 명시적 철회가 부분 주장에 빠져 원문으로 다시 대조해야 한다.', at: [f.at[0], f.at[3]] };
  const before = structuredClone(revision), checked = validateMapRevision(revision, f.ask, blueprint);
  assert.equal(isMapRevision(revision), true); assert.equal(isMapRevision(empty()), false); assert.equal(isMapRevision(null), false);
  assert.equal(isMapRevision({ reviseParts: null }), true, 'malformed sentinel must reach its own validator');
  assert.deepEqual(checked, before); checked.at.push(f.at[4]); checked.reason = 'changed'; assert.deepEqual(revision, before);
  const groups = revisionGroups(revision, blueprint);
  assert.deepEqual(groups.map(group => group.id), ['parts-1', 'parts-2']);
  assert.deepEqual(groups.flatMap(group => group.parts.map(part => part.ref)), ['new:p1', 'new:p2', 'new:p3', 'new:p4']);
  groups[0].parts[0].name = 'changed'; assert.equal(blueprint.parts[0].name, '책임 1');
  refused(() => combineRenderedMaps(rendered(f, blueprint), revision, f.ask, blueprint));
});

test('revision validation requires unique planned refs and actual sent aliases; metadata, copied quotes and invented basis cannot stand in', () => {
  const f = fixture(1), blueprint = planned(f, 4), revision = { reviseParts: ['new:p4'], reason: '원문의 철회 범위를 다시 대조한다.', at: [f.at[0]] };
  for (const mutate of [v => { v.reviseParts = []; }, v => { v.reviseParts = ['new:p4', 'new:p4']; },
    v => { v.reviseParts = ['new:unplanned']; }, v => { v.reviseParts = [f.ask.parts[0].id]; },
    v => { v.reviseParts = ['P99']; }, v => { v.reviseParts = [null]; }, v => { v.reason = ''; },
    v => { v.reason = ' '; }, v => { v.reason = '가'.repeat(241); }, v => { v.reason = '원문\u0000명령'; },
    v => { v.at = []; }, v => { v.at = ['N99.99']; }, v => { v.at = [`${f.at[0]}-02`]; },
    v => { v.at = [f.at[0], f.at[0]]; }, v => { v.at = ['basis:사용자 기재']; }, v => { v.at = ['원문 인용 그대로']; },
    v => { v.at = f.at.slice(0, 9); }, v => { v.basis = [f.at[0]]; }, v => { delete v.at; }, v => { v.parts = []; }]) {
    const bad = structuredClone(revision); mutate(bad); refused(() => validateMapRevision(bad, f.ask, blueprint));
  }
  const boundary = { ...revision, reason: '가'.repeat(240), at: f.at.slice(0, 8) };
  assert.deepEqual(validateMapRevision(boundary, f.ask, blueprint), boundary);
  const onlySecond = revisionGroups(revision, blueprint); assert.deepEqual(onlySecond.map(group => group.id), ['parts-2']);
  for (const reviseParts of [[], ['new:p4', 'new:p4'], ['new:unplanned']]) refused(() => revisionGroups({ reviseParts }, blueprint));
});

test('revision sentinel accepts all 24 planned refs and selects at most the original eight groups', () => {
  const f = fixture(12), blueprint = planned(f, 12);
  blueprint.parts.unshift(...f.ask.parts.map(part => ({ ref: part.id, name: part.name, parent: part.parentId, at: [f.at[0]], focus: '기존 책임' })));
  const revision = { reviseParts: blueprint.parts.map(part => part.ref), reason: '현재 주장과 명시적 철회를 부분별로 대조한다.', at: [f.at[0]] };
  validateMapRevision(revision, f.ask, blueprint); assert.equal(revisionGroups(revision, blueprint).length, 8);
  refused(() => validateMapRevision({ ...revision, reviseParts: [...revision.reviseParts, 'new:extra'] }, f.ask, blueprint));
});

test('a later explicit withdrawal must be rendered with replaces to retire the current report; summary-only does not change it', () => {
  let p = D.pasteRecord(D.createProject(), '작업 보고: 파일 저장을 구현했다고 보고합니다.', null).project;
  const initial = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), at = initial.ask.records[0].spans[0].s;
  const meta = n => ({ id: `R_${crypto.randomUUID()}`, at: '2026-11-02T00:00:00.000Z', model: 'stub', prompt: 'm6-000000000001', hash: String(n).repeat(64) });
  p = M.applyReading(p, initial, M.validateMapReply({ ...empty(), parts: [{ ref: 'new:save', name: '파일 저장', parent: null,
    role: '파일 저장을 맡는다.', roleAbout: null, roleReplaces: null, basis: [at],
    claims: [{ key: 's1', kind: 'reported', text: '파일 저장을 구현했다고 보고함', at, about: null, replaces: null }] }] }, initial.ask), meta(1)).project;
  const area = p.space.areas[0].id;
  p = D.pasteRecord(p, '정정: 앞 보고의 파일 저장 구현 주장을 철회합니다. 실제로는 아직 파일 저장을 구현하지 않았습니다.\n저장 위치 설정은 계속 파일 경로를 받습니다.', null).project;
  const input = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA), part = input.ask.parts[0], spans = input.ask.records[0].spans;
  const correctionAt = spans[0].s, notMadeAt = spans.find(span => span.t.includes('실제로는')).s, otherAt = spans.find(span => span.t.includes('저장 위치 설정')).s;
  const blueprint = { parts: [{ ref: part.id, name: part.name, parent: part.parentId, focus: '저장 책임과 명시적 철회', at: [correctionAt, otherAt] }],
    global: [{ kind: 'correction', text: '앞 구현 보고를 철회했다.', at: [correctionAt] }], corrections: [] };
  const fragment = { ...empty(), parts: [{ ref: part.id, name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [],
    claims: [{ key: 's1', kind: 'describes', text: '저장 위치 설정은 파일 경로를 받는다.', at: otherAt, aboutAt: null, replaces: null }] }] };
  const global = { ...empty(), summary: '앞선 파일 저장 구현 보고가 철회되었고 아직 구현하지 않았다.' };
  const summaryOnly = combineRenderedMaps([fragment], global, input.ask, blueprint);
  const stale = M.applyReading(p, input, M.validateMapReply(summaryOnly, input.ask), meta(2)).project;
  assert.ok(M.partUnderstanding(stale, area).claims.some(claim => claim.text === '파일 저장을 구현했다고 보고함'));
  assert.equal(M.unreadRecords(stale, studioView(stale)).length, 0, 'the summary-only failure consumes the source');
  blueprint.corrections = [{ part: part.id, claim: part.current[0].key, at: [correctionAt, notMadeAt] }];
  refused(() => combineRenderedMaps([fragment], global, input.ask, blueprint));
  assert.deepEqual(missingMapCorrections({ ...empty(), parts: fragment.parts }, input.ask, blueprint), blueprint.corrections);
  const revision = validateMapRevision({ reviseParts: [part.id], reason: '현재 구현 주장을 철회하는 구조화된 정정이 빠졌다.', at: [correctionAt, notMadeAt] }, input.ask, blueprint);
  assert.deepEqual(revisionGroups(revision, blueprint).map(group => group.id), ['parts-1']);
  const fixed = structuredClone(fragment);
  fixed.parts[0].claims.push({ key: 's2', kind: 'reported', text: '앞 구현 보고를 철회했으며 파일 저장은 아직 구현하지 않았다고 보고함',
    at: `${correctionAt}-${notMadeAt.split('.')[1]}`, aboutAt: null, replaces: part.current[0].key });
  const goodWire = combineRenderedMaps([fixed], global, input.ask, blueprint);
  const next = M.applyReading(p, input, M.validateMapReply(goodWire, input.ask), meta(3)).project;
  assert.ok(!M.partUnderstanding(next, area).claims.some(claim => claim.text === '파일 저장을 구현했다고 보고함'));
  assert.ok(M.partUnderstanding(next, area).claims.some(claim => claim.replaces));
});

function correctionFixture(parts = 1, claimsPerPart = 2) {
  const f = fixture(parts); let index = 0;
  for (const part of f.ask.parts) part.current = Array.from({ length: claimsPerPart }, () => ({ key: `C${String(++index).padStart(2, '0')}`,
    kind: 'reported', text: '이 부분을 구현했다고 보고함', about: null }));
  const blueprint = { parts: f.ask.parts.map(part => ({ ref: part.id, name: part.name, parent: part.parentId, at: [f.at[0]], focus: '기존 현재 주장의 명시적 정정' })),
    global: [], corrections: f.ask.parts.flatMap(part => part.current.map((claim, i) => ({ part: part.id, claim: claim.key, at: [f.at[i]] }))) };
  return { ...f, blueprint };
}

test('later blueprints require corrections while first-map shape/prompt remain unchanged; empty current permits only an empty ledger', () => {
  const first = fixture(), firstPlan = planned(first);
  assert.deepEqual(Object.keys(firstPlan), ['parts', 'global']); validateMapBlueprint(firstPlan, first.ask);
  refused(() => validateMapBlueprint({ ...firstPlan, corrections: [] }, first.ask));
  assert.ok(LATER_BLUEPRINT_PROMPT.startsWith(MAP_BLUEPRINT_PROMPT)); assert.ok(!MAP_BLUEPRINT_PROMPT.includes('corrections'));
  assert.ok(LATER_BLUEPRINT_PROMPT.includes('같은 대상·범위'));
  assert.ok(LATER_BLUEPRINT_PROMPT.includes('다른 판본·브랜치') && LATER_BLUEPRINT_PROMPT.includes('roleBy=person'));
  const later = fixture(1), part = later.ask.parts[0], plan = { parts: [{ ref: part.id, name: part.name, parent: part.parentId,
    at: [later.at[0]], focus: '사용자 부분' }], global: [], corrections: [] };
  validateMapBlueprint(plan, later.ask);
  const missing = structuredClone(plan); delete missing.corrections; refused(() => validateMapBlueprint(missing, later.ask));
  refused(() => validateMapBlueprint({ ...plan, corrections: [{ part: part.id, claim: 'C01', at: [later.at[0]] }] }, later.ask));
});

test('correction obligations have exact bounds, unique own current targets, planned existing refs, and only actual original aliases', () => {
  const f = correctionFixture(6, 4); assert.equal(f.blueprint.corrections.length, 24); validateMapBlueprint(f.blueprint, f.ask);
  const valid = structuredClone(f.blueprint); valid.corrections[0].at = f.at.slice(0, 8); validateMapBlueprint(valid, f.ask);
  const copy = validateMapBlueprint(valid, f.ask); copy.corrections[0].at.push(f.at[8]); assert.equal(valid.corrections[0].at.length, 8);
  const tooManyForPart = correctionFixture(1, 5); refused(() => validateMapBlueprint(tooManyForPart.blueprint, tooManyForPart.ask));
  for (const mutate of [p => p.corrections.push(p.corrections[0]), p => { p.corrections[1] = { ...p.corrections[0], at: [f.at[1]] }; },
    p => { p.corrections[0].claim = f.ask.parts[1].current[0].key; }, p => { p.corrections[0].claim = 'C99'; },
    p => { p.corrections[0].part = 'new:invented'; }, p => { p.parts.shift(); }, p => { p.corrections[0].at = ['N99.01']; },
    p => { p.corrections[0].at = [`${f.at[0]}-02`]; }, p => { p.corrections[0].at = ['원문 복사']; },
    p => { p.corrections[0].at = f.at.slice(0, 9); }, p => { p.corrections[0].at = [f.at[0], f.at[0]]; },
    p => { p.corrections[0].basis = [f.at[0]]; }, p => { p.corrections = null; }]) {
    const bad = structuredClone(f.blueprint); mutate(bad); refused(() => validateMapBlueprint(bad, f.ask));
  }
});

test('only surviving normalized claim replacements satisfy registered obligations; summaries/candidates and soft-dropped raw claims cannot', () => {
  const f = correctionFixture(), fragments = rendered(f, f.blueprint), raw = { ...empty(), summary: '앞선 구현 주장을 모두 철회했다고 요약함', parts: fragments.flatMap(fragment => fragment.parts),
    candidates: [{ text: '이 보고의 성립은 미정이다.', target: 'holds', parts: [f.ask.parts[0].id], at: f.at[0],
      statement: { key: 's801', kind: 'reported', text: '앞선 구현 보고를 철회했다고 보고함', at: f.at[0], aboutAt: null } }] };
  raw.parts[0].claims.push({ key: 's2', kind: 'reported', text: '앞선 구현 보고를 철회했다고 보고함', at: f.at[0], aboutAt: 'N99.99', replaces: f.ask.parts[0].current[0].key });
  const before = structuredClone(raw), missing = missingMapCorrections(raw, f.ask, f.blueprint);
  assert.deepEqual(missing, f.blueprint.corrections); assert.deepEqual(raw, before);
  missing[0].at.push(f.at[8]); assert.equal(f.blueprint.corrections[0].at.length, 1);
  refused(() => combineRenderedMaps([{ ...empty(), parts: raw.parts }], empty(), f.ask, f.blueprint));
  raw.parts[0].claims.at(-1).aboutAt = null;
  assert.deepEqual(missingMapCorrections(raw, f.ask, f.blueprint), [f.blueprint.corrections[1]]);
  raw.parts[0].claims.push({ key: 's3', kind: 'reported', text: '다른 현재 구현 보고도 철회했다고 보고함', at: f.at[1], aboutAt: null, replaces: f.ask.parts[0].current[1].key });
  assert.deepEqual(missingMapCorrections(raw, f.ask, f.blueprint), []); assert.equal(mapCorrectionRevision(raw, f.ask, f.blueprint), null);
  const result = combineRenderedMaps([{ ...empty(), parts: raw.parts }], empty(), f.ask, f.blueprint);
  assert.equal(result.parts[0].claims.length, 3, 'the combiner does not edit original claims');
});

test('machine correction revision covers every affected planned ref with at most eight original pointers while retaining the full ledger', () => {
  const f = correctionFixture(6, 4);
  f.blueprint.corrections.forEach((obligation, i) => { obligation.at = [f.at[i % f.at.length]]; });
  const raw = { ...empty(), parts: rendered(f, f.blueprint).flatMap(fragment => fragment.parts) }, before = structuredClone(f.blueprint);
  const revision = mapCorrectionRevision(raw, f.ask, f.blueprint);
  assert.deepEqual(revision.reviseParts, f.ask.parts.map(part => part.id)); assert.deepEqual(revision.at, f.at.slice(0, 8));
  assert.equal(revision.at.length, 8); validateMapRevision(revision, f.ask, f.blueprint);
  assert.deepEqual(f.blueprint, before); assert.equal(f.blueprint.corrections.length, 24);
  assert.deepEqual(raw.parts, rendered(f, f.blueprint).flatMap(fragment => fragment.parts));
});

// ---- first-map-divided.6: isolated items are set aside; parts, assignment, key ranges and contradictions stay whole ----
test('first-map fragments set aside isolated bad items but still refuse parts left empty, duplicate keys and foreign key ranges', () => {
  const f = fixture(), blueprint = planned(f, 3), group = splitBlueprintParts(blueprint)[0], base = rendered(f, blueprint)[0];
  assert.equal(f.ask.schemaVersion, M.MAP6_SCHEMA);
  const soft = structuredClone(base);
  soft.parts[0].claims.push({ ...soft.parts[0].claims[0], key: 's9', at: 'N01.99' });
  soft.parts[1].claims.push({ ...soft.parts[1].claims[0], key: 's8', text: '가'.repeat(241) });
  soft.parts[2].basis = [...soft.parts[2].basis, 'N99.01'];
  assert.deepEqual(validateRenderedFragment(soft, group, f.ask, blueprint), soft, 'the raw fragment is cached untouched');
  for (const mutate of [
    x => { x.parts[0].basis = ['N99.01', 'N99.02']; },                       // a new part without any surviving basis
    x => { x.parts[0].claims = [{ ...x.parts[0].claims[0], at: 'N99.01' }]; }, // a part whose every claim is set aside
    x => { x.parts[1].claims[0].key = 's1'; },                                // a duplicate statement key (contradiction)
    x => { x.parts[0].claims.push({ ...x.parts[0].claims[0], key: 's150', at: 'N99.01' }); }, // a key outside the range, even on a bad claim
    x => { x.parts[0].name = '이름 변경'; }, x => { x.parts[0].role = '가'.repeat(301); }, x => { x.parts.pop(); },
  ]) { const bad = structuredClone(base); mutate(bad); refused(() => validateRenderedFragment(bad, group, f.ask, blueprint)); }
  let failure; const lost = structuredClone(base); lost.parts[0].basis = ['N99.01', 'N99.02'];
  try { validateRenderedFragment(lost, group, f.ask, blueprint); } catch (error) { failure = error; }
  assert.deepEqual(failure.validation, { path: 'parts[0].basis[0]', rule: 'reference' }, 'refused with the first set-aside quote');
});

test('the combined first-map wire only omits set-aside items: no quote clipped, key renamed, item reordered or field rewritten', () => {
  const f = fixture(), blueprint = planned(f, 4), fragments = rendered(f, blueprint);
  fragments[0].parts[0].claims.unshift({ ...fragments[0].parts[0].claims[0], key: 's40', at: 'N01.99' });
  fragments[0].parts[0].claims.push({ ...fragments[0].parts[0].claims[1], key: 's41', text: '두 번째 유지 주장' });
  fragments[1].parts[0].basis = [f.at[3], f.at[4], f.at[5], f.at[6], f.at[7], f.at[8]];
  const statement = key => ({ key, kind: 'idea', text: '다른 출력을 구상한다.', at: f.at[4], about: null });
  const global = { ...empty(), summary: '원문의 설명이다.', gaps: ['하나', '둘', '셋'],
    relations: [{ from: 'new:p1', to: 'new:p9', kind: 'needs', note: '', at: f.at[0] }, { from: 'new:p1', to: 'new:p4', kind: 'needs', note: '사용', at: f.at[0] }],
    candidates: [{ target: 'checked', text: '잘못된 대상', parts: ['new:p4'], at: null, statement: statement('s801') },
      { target: 'holds', text: '이 책임의 선택은 미정이다.', parts: ['new:p4'], at: f.at[4], statement: statement('s802') }],
    material: [{ at: f.at[0], what: '보고서 머리말' }, { at: f.at[11], what: '내포 예문' }] };
  const before = structuredClone({ fragments, global }), { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, blueprint);
  assert.deepEqual({ fragments, global }, before, 'inputs are never changed');
  const raw = { ...global, parts: fragments.flatMap(x => x.parts) }, expected = structuredClone(raw);
  expected.parts[0].claims.splice(0, 1); expected.parts[3].basis = expected.parts[3].basis.slice(0, 4);
  expected.relations.splice(0, 1); expected.candidates.splice(0, 1); expected.gaps = expected.gaps.slice(0, 2); expected.material.splice(0, 1);
  assert.deepEqual(wire, expected);
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.category]), [
    ['parts[0].claims[0].at', 'reference', null], ['parts[3].basis', 'contract', 'count'], ['relations[0]', 'contract', 'ends'],
    ['candidates[0].target', 'reference', null], ['gaps', 'contract', 'count'], ['material[0]', 'material-evidence', null]]);
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  assert.deepEqual(plain.parts[0].claims.map(c => c.key), ['s1', 's41']);
  assert.throws(() => M.validateMapReply(raw, f.ask), 'the single-call map.6 path still refuses the raw wire whole');
});

test('.25: a wrong map-reading.7 field leaves out its claim or relation and only a part\'s state; first passes are refused with the fixed path and category', () => {
  const f = fixture(), blueprint = planned(f, 2), fragments = rendered(f, blueprint), group = splitBlueprintParts(blueprint)[0];
  Object.assign(fragments[0].parts[0], { state: 'running', stateAt: 'N01.99', stateWhen: '11-02 22:10Z', files: ['server/engine.mjs'] });
  fragments[0].parts[1].claims[0].topic = 'status';
  fragments[0].parts[1].claims.push({ ...fragments[0].parts[1].claims[0], key: 's20', text: '두 번째 주장', topic: 'nope' });
  const global = { ...empty(), summary: '원문의 설명이다.', relations: [{ from: 'new:p1', to: 'new:p2', kind: 'flow', note: '', at: f.at[0], mode: 'x' },
    { from: 'new:p2', to: 'new:p1', kind: 'flow', note: '', at: f.at[1], payload: '행', cadence: '매 박자', mode: 'observed' }] };
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, blueprint);
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.category]), [['parts[0].stateAt', 'reference', null], ['parts[1].claims[1].topic', 'contract', 'topic'], ['relations[0].mode', 'contract', 'mode']]);
  assert.deepEqual([wire.parts[0].state, wire.parts[0].stateAt, wire.parts[0].stateWhen, wire.parts[0].files], [null, null, null, ['server/engine.mjs']]);
  assert.deepEqual(wire.parts[1].claims.map(c => c.key), ['s2']); assert.deepEqual(wire.relations, [global.relations[1]]);
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0); assert.deepEqual(plain.parts[0].files, ['server/engine.mjs']);
  assert.deepEqual(plain.relations.map(x => [x.payload, x.cadence, x.mode]), [['행', '매 박자', 'observed']]);
  // .30: a first map's first pass sets these items aside as its correction does (no refusal, no paid correction); the stage keeps which.
  assert.deepEqual(validateRenderedFragment(fragments[0], group, f.ask, blueprint, true), fragments[0]);
  assert.deepEqual(fragmentSetAside(fragments[0], group, f.ask, blueprint), [{ path: 'parts[0].stateAt', rule: 'reference', category: null }, { path: 'parts[1].claims[1].topic', rule: 'contract', category: 'topic' }]);
  assert.deepEqual(combineRenderedMaps(fragments, global, f.ask, blueprint, true), wire);
  assert.deepEqual(mapStageIssues(global), [{ path: 'relations[0].mode', rule: 'contract', category: 'mode', expected: null, actual: null }]);
  // A later map (map.7) still refuses its first pass for the field, so its one correction rewrites it.
  const later = fixture(1), laterPlan = planned(later, 2), laterFragments = rendered(later, laterPlan);
  Object.assign(laterFragments[0].parts[0], { state: 'running', stateAt: 'N01.99' });
  validateRenderedFragment(laterFragments[0], splitBlueprintParts(laterPlan)[0], later.ask, laterPlan);
  let failure; try { validateRenderedFragment(laterFragments[0], splitBlueprintParts(laterPlan)[0], later.ask, laterPlan, true); } catch (error) { failure = error; }
  assert.deepEqual(failure?.validation, { path: 'parts[0].stateAt', rule: 'reference' });
  assert.deepEqual(mapStageIssues(fragments[0]), [{ path: 'parts[1].claims[1].topic', rule: 'contract', category: 'topic', expected: null, actual: null }]);
  const long = structuredClone(fragments[0]); long.parts[0].stateAt = f.at[0]; long.parts[0].files = Array(7).fill('a'); long.parts[1].claims[0].before = '옛것';
  assert.deepEqual(mapStageIssues(long).map(x => [x.path, x.rule, x.category ?? null, x.expected]), [['parts[0].files', 'count', null, 6],
    ['parts[1].claims[0].before', 'contract', 'before', null], ['parts[1].claims[1].topic', 'contract', 'topic', null]]);
});

test('.28: a wrong map-reading.8 field leaves out only that field of its part, its relation, or the basis; first passes are refused with the fixed path and category', () => {
  const f = fixture(), blueprint = planned(f, 2), fragments = rendered(f, blueprint), group = splitBlueprintParts(blueprint)[0];
  const io = { inputs: ['review 행'], outputs: ['e=1 행'], fields: ['watch', 'allowed_side'], config: ['24 h 만료'] };
  Object.assign(fragments[0].parts[0], { type: 'store', typeAt: f.at[0], ...io });
  Object.assign(fragments[0].parts[1], { type: 'engine', typeAt: f.at[1], inputs: Array(9).fill('a'), outputs: ['결과 행'] });
  const global = { ...empty(), summary: '원문의 설명이다.', relations: [{ from: 'new:p1', to: 'new:p2', kind: 'flow', note: '', at: f.at[0], channel: 'wire' },
    { from: 'new:p2', to: 'new:p1', kind: 'flow', note: '', at: f.at[1], channel: 'data' }], basisAt: '가'.repeat(61), basisVersion: '라이브 618df374' };
  const before = structuredClone({ fragments, global }), { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, blueprint);
  assert.deepEqual({ fragments, global }, before, 'inputs are never changed');
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.category]), [['parts[1].type', 'contract', 'type'], ['parts[1].inputs', 'contract', 'inputs'],
    ['relations[0].channel', 'contract', 'channel'], ['basisAt', 'contract', 'basis-at']]);
  // Only the wrong fields are written not said; the good part, the other list and the version stand as they came.
  assert.deepEqual([wire.parts[1].type, wire.parts[1].typeAt, wire.parts[1].inputs, wire.parts[1].outputs], [null, null, null, ['결과 행']]);
  assert.deepEqual([wire.parts[0].type, wire.parts[0].typeAt, wire.parts[0].inputs, wire.parts[0].outputs, wire.parts[0].fields, wire.parts[0].config],
    ['store', f.at[0], ...Object.values(io)]);
  assert.deepEqual(wire.relations, [global.relations[1]]);
  assert.deepEqual([wire.basisAt, wire.basisVersion], [null, '라이브 618df374']);
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  assert.deepEqual([plain.parts[0].type, plain.parts[0].inputs, plain.parts[0].fields], ['store', ['review 행'], ['watch', 'allowed_side']]);
  assert.deepEqual([plain.parts[1].type, plain.parts[1].inputs, plain.parts[1].outputs], [null, [], ['결과 행']]);
  assert.deepEqual([plain.relations.map(x => x.channel), plain.basisAt, plain.basisVersion], [['data'], null, '라이브 618df374']);
  // .30: a first map's first pass sets these items aside as its correction does (no refusal, no paid correction); the stage keeps which.
  assert.deepEqual(validateRenderedFragment(fragments[0], group, f.ask, blueprint, true), fragments[0]);
  assert.deepEqual(fragmentSetAside(fragments[0], group, f.ask, blueprint).map(x => x.category), ['type', 'inputs']);
  assert.deepEqual(combineRenderedMaps(fragments, global, f.ask, blueprint, true), wire);
  assert.deepEqual(mapStageIssues(global), [{ path: 'relations[0].channel', rule: 'contract', category: 'channel', expected: null, actual: null },
    { path: 'basisAt', rule: 'length', expected: 60, actual: 61 }]);
  assert.deepEqual(mapStageIssues(fragments[0]), [{ path: 'parts[1].type', rule: 'contract', category: 'type', expected: null, actual: null },
    { path: 'parts[1].inputs', rule: 'count', expected: 8, actual: 9 }]);
  // A wrong basis alone is left null on the first pass too (one field, not the reply's structure).
  const basisOnly = { ...structuredClone(global), relations: [global.relations[1]] };
  assert.deepEqual([combineRenderedMaps(fragments, basisOnly, f.ask, blueprint, true).basisAt, combineRenderedReading(fragments, basisOnly, f.ask, blueprint).exclusions.map(x => x.path)], [null, ['parts[1].type', 'parts[1].inputs', 'basisAt']]);
  // Beside the seven keys only the basis time and version are allowed on the global wire.
  refused(() => combineRenderedReading(fragments, { ...global, foo: 1 }, f.ask, blueprint));
});

test('plan feedback names fixed paths, rules and counts only, for anchors, bounds, existing names and parents', () => {
  const f = fixture(1), blueprint = planned(f, 2), own = f.ask.parts[0];
  blueprint.parts.push({ ref: own.id, name: `${own.name} 변경`, parent: 'new:p1', at: [f.at[0]], focus: '기존 책임' });
  blueprint.parts[0].at = ['N99.01']; blueprint.parts[1].at = f.at.slice(0, 9); blueprint.parts[1].focus = '가'.repeat(481);
  blueprint.global = [{ kind: 'checked', text: '원문', at: [`${f.at[0]}-02`] }];
  refused(() => validateMapBlueprint(blueprint, f.ask));
  const issues = blueprintStageIssues(blueprint, f.ask);
  assert.deepEqual(issues, [
    { path: 'parts[0].at', rule: 'reference', expected: null, actual: null },
    { path: 'parts[1].focus', rule: 'length', expected: 480, actual: 481 }, { path: 'parts[1].at', rule: 'count', expected: 8, actual: 9 },
    { path: 'parts[2].name', rule: 'name-mismatch', expected: null, actual: null }, { path: 'parts[2].parent', rule: 'parent-mismatch', expected: null, actual: null },
    { path: 'global[0].kind', rule: 'kind', expected: null, actual: null }, { path: 'global[0].at', rule: 'reference', expected: null, actual: null }]);
  const encoded = JSON.stringify(issues);
  for (const leak of ['N0', 'N99', own.name, '가가']) assert.ok(!encoded.includes(leak));
  assert.deepEqual(blueprintStageIssues(planned(f, 2), f.ask), []);
  assert.deepEqual(blueprintStageIssues(null, f.ask), [{ path: 'reply', rule: 'shape', expected: null, actual: null }]);
  const trap = new Proxy({}, { get() { throw new Error('PRIVATE_TRAP'); } });
  assert.deepEqual(blueprintStageIssues(trap, f.ask), [{ path: 'reply', rule: 'keys', expected: null, actual: null }], 'a failing accessor ends the feedback quietly');
});

// ---- first-map-divided.29 (from the blind judging of the .28 KORU map): stores are parts, a table row belongs to the part its
// first cell names, a relation's sender is the one its line names, versions stay out of config, a first map plans 24 new parts.
// Author-written wires on a small KORU-shaped record; no model quality is claimed. ----
const KORU = ['1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|', '| 카드 러너 | AI 판단 | 세 팔 카드 |', '| 엔진 | 루프·엔진 | 행 셋 → 주문 |', '| 기분 층 | 계산 | 미구현 |',
  '2. 산출물', '| 이름 | 필드 | 만드는 부분 | 읽는 부분 | 있는 곳 |', '|---|---|---|---|---|', '| review.jsonl 행 | watch·allowed_side | 카드 러너 | 엔진 | /var/lib/koru-desk/race/review.jsonl |',
  '3. 연결', '| 보내는 부분 | 받는 부분 | 넘기는 것 |', '|---|---|---|', '| 카드 러너 | 엔진 | review.jsonl watch·allowed_side |', '| 기분 층 | 엔진 | 공포 z |',
  '6. 철회·변경', '| 부분 이름 | 옛 결정 | 지금 | 근거·날짜 |', '|---|---|---|---|', '| 엔진 | 매일 FLAT 재시작 | 채택 안 함 | [보고] |', '| 카드 러너 | review 작성기 FIX3 | FIX1을 OVERRIDE로 | [보고] |',
  '10. 모르는 것', '| 부분 이름 | 무엇을 | 어떻게 확인할 수 있나 |', '|---|---|---|', '| 엔진 | 08:49Z 뒤 실제 상태 | STATUS 첫 줄 |'].join('\n');
function koru() {
  const project = D.pasteRecord(D.createProject(), KORU, null).project;
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records[0].spans;
  assert.ok(M.firstAsk(input.ask));
  return { project, input, ask: input.ask, at: head => spans.find(span => span.t.startsWith(head)).s };
}
const koruPlan = f => ({ global: [], parts: [
  { ref: 'new:card', name: '카드 러너', parent: null, at: [f.at('| 카드 러너 | AI')], focus: '세 팔 카드' },
  { ref: 'new:review', name: 'review.jsonl 행', parent: null, at: [f.at('| review.jsonl 행')], focus: '저장소: watch·allowed_side' },
  { ref: 'new:mood', name: '기분 층', parent: null, at: [f.at('| 기분 층 | 계산')], focus: '미구현' },
  { ref: 'new:engine', name: '엔진', parent: null, at: [f.at('| 엔진 | 루프')], focus: '행 셋 → 주문' }] });
function koruFragments(f) {
  const claim = (key, head, extra = {}) => ({ key, kind: 'reported', text: '원문 행의 사실을 옮긴다.', at: f.at(head), about: null, replaces: null, ...extra });
  const part = (ref, name, head, claims, extra = {}) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [f.at(head)], claims, ...extra });
  return [{ ...empty(), parts: [
    // s2 quotes the engine's withdrawal row: the engine is planned in the other fragment.
    part('new:card', '카드 러너', '| 카드 러너 | AI', [claim('s1', '| 카드 러너 | review', { topic: 'withdrawn', before: 'review 작성기 FIX3' }), claim('s2', '| 엔진 | 매일')]),
    part('new:review', 'review.jsonl 행', '| review.jsonl 행', [claim('s3', '| review.jsonl 행')],
      { type: 'store', typeAt: f.at('| review.jsonl 행'), outputs: ['review.jsonl 행'], fields: ['watch', 'allowed_side'], files: ['/var/lib/koru-desk/race/review.jsonl'] }),
    part('new:mood', '기분 층', '| 기분 층 | 계산', [claim('s4', '| 기분 층 | 계산')], { state: 'unbuilt', stateAt: f.at('| 기분 층 | 계산') })] },
  { ...empty(), parts: [
    // s102 quotes a connection row whose second cell names the engine: the engine's own.
    part('new:engine', '엔진', '| 엔진 | 루프', [claim('s101', '| 엔진 | 매일', { topic: 'withdrawn', before: '매일 FLAT 재시작' }), claim('s102', '| 카드 러너 | 엔진 |')],
      { config: ['레버리지 20', '618df374'] })] }];
}
const koruGlobal = f => ({ ...empty(), summary: '엔진은 매일 FLAT 재시작을 채택하지 않았다.', relations: [
  // 0: the file line drawn straight from producer to reader (no end is the file's store).
  { from: 'new:card', to: 'new:engine', kind: 'flow', note: '', at: f.at('| 카드 러너 | 엔진 |'), payload: 'review.jsonl watch·allowed_side', channel: 'data', mode: 'observed' },
  // 1-2: producer to store (the store's own row names the producer) and store to reader (the reader's row names the store's file).
  { from: 'new:card', to: 'new:review', kind: 'flow', note: '', at: f.at('| review.jsonl 행'), payload: 'review.jsonl 행', channel: 'data' },
  { from: 'new:review', to: 'new:engine', kind: 'flow', note: '', at: f.at('| 카드 러너 | 엔진 |'), payload: 'review.jsonl 행', channel: 'data' },
  // 3: an unbuilt part sending what was observed; 4: the line's sender reversed; 5: the unbuilt part's designed flow stands.
  { from: 'new:mood', to: 'new:engine', kind: 'flow', note: '', at: f.at('| 기분 층 | 엔진'), payload: '공포 z', channel: 'data', mode: 'observed' },
  { from: 'new:engine', to: 'new:card', kind: 'flow', note: '', at: f.at('| 카드 러너 | 엔진 |'), channel: 'control' },
  { from: 'new:mood', to: 'new:engine', kind: 'needs', note: '', at: f.at('| 기분 층 | 엔진'), payload: '공포 z', mode: 'design' }] });

test('.29: a file line skipping its store, a claim on another part row, a sender its line does not name and a version in config are set aside alone', () => {
  const f = koru(), plan = koruPlan(f), fragments = koruFragments(f), global = koruGlobal(f), groups = splitBlueprintParts(plan);
  assert.equal(validateMapBlueprint(plan, f.ask).parts.length, 4);
  const before = structuredClone({ fragments, global }), { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual({ fragments, global }, before, 'inputs are never changed');
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.category]), [['parts[0].claims[1]', 'contract', 'wrong-part'], ['parts[3].config', 'contract', 'config'],
    ['relations[0]', 'contract', 'via-store'], ['relations[3]', 'contract', 'sender'], ['relations[4]', 'contract', 'sender']]);
  assert.match(exclusions[0].explanation, /다른 부분의 표 행/); assert.match(exclusions[2].explanation, /보관소 부분을 거치지 않아/); assert.match(exclusions[3].explanation, /보내는 쪽/);
  assert.deepEqual(wire.parts.map(p => p.claims.map(c => c.key)), [['s1'], ['s3'], ['s4'], ['s101', 's102']]);
  assert.equal(wire.parts[3].config, null);
  assert.deepEqual(wire.relations, [global.relations[1], global.relations[2], global.relations[5]]);
  // The browser reads what is left with plain map.6: nothing set aside, the store and its two lines in place.
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  assert.deepEqual([plain.parts[1].type, plain.parts[1].fields, plain.parts[3].config], ['store', ['watch', 'allowed_side'], []]);
  assert.deepEqual(plain.relations.map(r => [r.from, r.to]), [['new:card', 'new:review'], ['new:review', 'new:engine'], ['new:mood', 'new:engine']]);
  // .30: a first map's first pass sets these items aside as its correction does (no refusal, no paid correction); the stage keeps which.
  // A render still sees the row owner planned in another fragment.
  assert.deepEqual(validateRenderedFragment(fragments[0], groups[0], f.ask, plan, true), fragments[0]);
  assert.deepEqual(validateRenderedFragment(fragments[1], groups[1], f.ask, plan, true), fragments[1]);
  assert.deepEqual([fragmentSetAside(fragments[0], groups[0], f.ask, plan), fragmentSetAside(fragments[1], groups[1], f.ask, plan)],
    [[{ path: 'parts[0].claims[1]', rule: 'contract', category: 'wrong-part' }], [{ path: 'parts[0].config', rule: 'contract', category: 'config' }]]);
  assert.deepEqual(mapStageIssues(fragments[1]), [{ path: 'parts[0].config', rule: 'contract', category: 'config', expected: null, actual: null }]);
  assert.deepEqual(combineRenderedMaps(fragments, global, f.ask, plan, true), wire);
  // A refusal of the global stage for another reason still names its own path first, then the diagnostics of its context.
  const failure = Object.assign(new Error('x'), { validation: { path: 'relations[0]', rule: 'contract', category: 'via-store' } });
  assert.deepEqual(mapStageIssues(global, failure), [{ path: 'relations[0]', rule: 'contract', category: 'via-store', expected: null, actual: null }]);
  // With the global stage context the diagnostics follow: no claim backs the summary; one unknown row, no unknown claim.
  assert.deepEqual(mapStageIssues(global, failure, { ask: f.ask, parts: fragments.flatMap(x => x.parts) }), [
    { path: 'relations[0]', rule: 'contract', category: 'via-store', expected: null, actual: null },
    { path: 'summary', rule: 'unbacked', expected: 0, actual: 1 }, { path: 'parts', rule: 'unknown-count', expected: 1, actual: 0 }]);
  // With no store part at all the file line is set aside the same way.
  const bare = koruGlobal(f); bare.relations = [bare.relations[0]];
  const noStore = koruFragments(f); noStore[0].parts[1].type = null; noStore[0].parts[1].typeAt = null;
  assert.deepEqual(combineRenderedReading(noStore, bare, f.ask, plan).exclusions.filter(x => x.path.startsWith('relations')).map(x => [x.path, x.category]), [['relations[0]', 'via-store']]);
  // Plain map.6 never runs the divided checks (the browser reads the wire the server left).
  assert.equal(M.validateMapReply({ ...structuredClone(wire), relations: [global.relations[0], global.relations[4]] }, f.ask).relations.length, 2);
});

test('.29: a first map plans (.31) 36 new parts (a later map 12) in twelve fragments; plan and global feedback count rows, unbacked sentences and unknowns', () => {
  assert.deepEqual([BLUEPRINT_NEW_PARTS_MAX, BLUEPRINT_LATER_NEW_PARTS_MAX, M.MAP6_NEW_PARTS], [36, 12, 36]);
  // A store is two lines: a first map takes (.30) 48 relations (plan relation items, a global list of 64); a later map keeps 32 and 16.
  assert.deepEqual([M.MAP6_RELATIONS, BLUEPRINT_RELATION_ITEMS_MAX, BLUEPRINT_LATER_RELATION_ITEMS_MAX, BLUEPRINT_FIRST_GLOBAL_MAX, BLUEPRINT_GLOBAL_MAX], [48, 48, 16, 64, 32]);
  assert.ok(MAP_BLUEPRINT_PROMPT.includes('global은64개 이하(그중 relation 항목 48개까지)') && MAP_BLUEPRINT_PROMPT.includes('relation 항목은 48개까지만 쓴다'));
  assert.ok(LATER_BLUEPRINT_PROMPT.includes('global은 32개 이하, 그중 relation 항목은 16개까지다'));
  const f = koru(), many = n => ({ global: [], parts: Array.from({ length: n }, (_, i) => ({ ref: `new:u${i + 1}`, name: `단위 ${i + 1}`, parent: null, at: [f.at('| 엔진 | 루프')], focus: '원문의 책임' })) });
  assert.equal(validateMapBlueprint(many(36), f.ask).parts.length, 36);
  assert.equal(splitBlueprintParts(many(36)).length, 12);
  refused(() => validateMapBlueprint(many(37), f.ask));
  const items = n => Array.from({ length: n }, (_, i) => ({ kind: 'relation', text: `new:u${i % 24 + 1} → new:u${(i + 1) % 24 + 1}: 행`, at: [f.at('| 카드 러너 | 엔진 |')] }));
  assert.equal(validateMapBlueprint({ ...many(24), global: items(64) }, f.ask).global.length, 64);
  refused(() => validateMapBlueprint({ ...many(24), global: items(65) }, f.ask));
  assert.deepEqual(blueprintStageIssues({ ...many(24), global: items(65) }, f.ask).filter(x => x.path === 'global'), [{ path: 'global', rule: 'count', expected: 64, actual: 65 }]);
  // The global stage of a first map reads 48 relations whole; the 49th is set aside past the count (plain map.6 refuses it).
  const fragments = koruFragments(f), line = koruGlobal(f).relations[1];
  const wide = { ...koruGlobal(f), relations: Array.from({ length: 49 }, () => structuredClone(line)) };
  const read = combineRenderedReading(fragments, { ...wide, relations: wide.relations.slice(0, 48) }, f.ask, koruPlan(f));
  assert.equal(read.wire.relations.length, 48);
  assert.ok(read.exclusions.every(x => !x.path.startsWith('relations')));
  assert.equal(M.validateMapReply(read.wire, f.ask).relations.length, 48);
  const over = combineRenderedReading(fragments, wide, f.ask, koruPlan(f));
  assert.equal(over.wire.relations.length, 48);
  assert.deepEqual(over.exclusions.filter(x => x.path === 'relations').map(x => [x.rule, x.category]), [['contract', 'count']]);
  assert.throws(() => M.validateMapReply({ ...structuredClone(read.wire), relations: wide.relations }, f.ask));
  assert.deepEqual(mapStageIssues(wide).filter(x => x.path === 'relations'), [{ path: 'relations', rule: 'count', expected: 48, actual: 49 }]);
  const laterAsk = fixture(1).ask;
  assert.deepEqual(mapStageIssues({ ...wide, relations: wide.relations.slice(0, 17) }, null, { ask: laterAsk, parts: [] }).filter(x => x.path === 'relations'),
    [{ path: 'relations', rule: 'count', expected: 16, actual: 17 }], 'a later map keeps its feedback bound');
  assert.deepEqual(blueprintStageIssues(many(13), f.ask).filter(x => x.rule === 'new-count'), []);
  // Coverage of the records' part tables: a diagnostic only (the plan stays valid).
  assert.deepEqual(sectionRows(f.ask, /^부분/).map(cells => cells[0]), ['카드 러너', '엔진', '기분 층']);
  assert.deepEqual(blueprintCoverage(koruPlan(f), f.ask), { rows: 3, covered: 3, absorbed: [], missing: [] });
  assert.deepEqual(blueprintStageIssues(koruPlan(f), f.ask), []);
  const missing = koruPlan(f); missing.parts.splice(2, 1);
  validateMapBlueprint(missing, f.ask);
  assert.deepEqual(blueprintStageIssues(missing, f.ask), [{ path: 'parts', rule: 'coverage', expected: 3, actual: 2 }]);
  missing.parts[0].focus = '세 팔 카드. 기분 층: 미구현';
  // .30: absorbed into a focus, but the unit has a connection row of its own: its line is lost (named by the record's own cell).
  assert.deepEqual(blueprintStageIssues(missing, f.ask), [{ path: 'parts', rule: 'absorbed-connection', expected: 0, actual: 1, names: ['기분 층'] }], 'a unit named in a focus is absorbed');
  const plain = fixture();
  assert.equal(blueprintCoverage(planned(plain, 2), plain.ask), null, 'a record without a part table says nothing');
  // Each summary sentence shares an 8-character run with some claim; withdrawal and unknown rows against their claims.
  const parts = koruFragments(f).flatMap(x => x.parts);
  parts[3].claims[0].text = '엔진은 매일 FLAT 재시작을 채택 안 함.';
  assert.deepEqual(readingDiagnostics({ ask: f.ask, summary: '엔진은 매일 FLAT 재시작을 채택하지 않았다. 카드는 내일 다시 본다고 했다.', parts }),
    [{ path: 'summary', rule: 'unbacked', expected: 0, actual: 1 }, { path: 'parts', rule: 'unknown-count', expected: 1, actual: 0 }]);
  parts[0].claims[0].topic = 'status'; parts[3].claims[1].topic = 'unknown';
  assert.deepEqual(readingDiagnostics({ ask: f.ask, summary: '엔진은 매일 FLAT 재시작을 채택하지 않았다.', parts }),
    [{ path: 'parts', rule: 'withdrawn-count', expected: 2, actual: 1 }]);
});

// ---- first-map-divided.30 (map-reading.9 and the blind judging of the .29 KORU map): a part's steps, loop and kept state, the
// reply's port map, a claim restating its state row, a store sending to the reader whose row quotes it, and the diagnostics of
// connection rows, absorbed units and renamed parts. Author-written wires on the small KORU-shaped record; no quality is claimed. ----
const meta30 = id => ({ id, at: '2026-11-04T00:00:00.000Z', model: 'stub', prompt: 'm6-000000000030', hash: id.length.toString(16).padStart(2, '0').repeat(32) });
function koru30(f) {
  const fragments = koruFragments(f);
  fragments[0].parts[0].claims.splice(1, 1); // the wrong-part claim of .29 is not this test's
  Object.assign(fragments[1].parts[0], { config: ['레버리지 20'], inputs: ['review.jsonl 행'], steps: [
    { name: 'review 읽기', does: '마지막 행·나이', uses: ['row_read', 'row_live'], at: f.at('| 엔진 | 루프') },
    { name: '없는 행', at: 'N01.99' },
    { name: '기하', at: f.at('| 엔진 | 매일') }],
  loop: { unit: '0.2 s', stop: '가'.repeat(61), resume: null, at: f.at('| 엔진 | 루프') },
  stateVars: [{ name: '재진입 간격', scope: '계획', readBy: ['기하'], changedBy: [] }, { name: '' }] });
  const global = koruGlobal(f);
  global.relations = [global.relations[0], global.relations[1], global.relations[2]];
  global.portMap = [{ relation: 2, port: 'review.jsonl 행', step: 'review 읽기', direction: 'in', at: f.at('| 카드 러너 | 엔진 |') },
    { relation: 0, port: 'review.jsonl 행', step: 'review 읽기', direction: 'in', at: f.at('| 카드 러너 | 엔진 |') },
    { relation: 2, port: 'review.jsonl 행', step: '없는 행', direction: 'in', at: f.at('| 카드 러너 | 엔진 |') }];
  return { fragments, global };
}

test('.30: a wrong step, loop item, kept state or port-map row is set aside alone on the combined wire; a row keeps naming its relation', () => {
  const f = koru(), plan = koruPlan(f), groups = splitBlueprintParts(plan), { fragments, global } = koru30(f);
  const before = structuredClone({ fragments, global }), { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual({ fragments, global }, before, 'inputs are never changed');
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.category]), [['parts[3].steps[1]', 'contract', 'step'], ['parts[3].loop.stop', 'contract', 'loop'],
    ['parts[3].stateVars[1]', 'contract', 'state-var'], ['relations[0]', 'contract', 'via-store'], ['portMap[1]', 'contract', 'port-map'], ['portMap[2]', 'contract', 'port-map']]);
  // Only the set-aside items are out; the loop keeps its other items; the kept row is renumbered past the relation left out.
  const engine = wire.parts[3];
  assert.deepEqual([engine.steps.map(s => s.name), engine.loop, engine.stateVars.map(s => s.name)],
    [['review 읽기', '기하'], { ...fragments[1].parts[0].loop, stop: null }, ['재진입 간격']]);
  assert.deepEqual(wire.relations, [global.relations[1], global.relations[2]]);
  assert.deepEqual(wire.portMap, [{ ...global.portMap[0], relation: 1 }]);
  // The browser reads the wire whole with plain map.6, attaches the reasons and stores the row on its relation and the engine.
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  assert.deepEqual(plain.portMap.map(m => [m.relation, m.port, m.step, m.direction]), [[1, 'review.jsonl 행', 'review 읽기', 'in']]);
  M.attachExclusions(plain, exclusions, f.ask);
  const applied = M.applyReading(f.project, f.input, plain, meta30('R_koru30'));
  const stored = applied.reading.portMap[0], line = applied.reading.relations.find(x => x.relationId === stored.relationId);
  const engineId = applied.reading.parts[3].areaId;
  assert.deepEqual([applied.reading.portMap.length, stored.areaId, line.to, stored.step], [1, engineId, engineId, 'review 읽기']);
  assert.deepEqual(applied.reading.exclusions.map(x => x.path), exclusions.map(x => x.path));
  assert.deepEqual(M.partUnderstanding(applied.project, engineId).steps.map(s => s.name), ['review 읽기', '기하']);
  assert.deepEqual(validateProject(applied.project), applied.project);
  // .30: a first map's first pass sets these items aside as its correction does (no refusal, no paid correction); the stage keeps which.
  assert.deepEqual(validateRenderedFragment(fragments[1], groups[1], f.ask, plan, true), fragments[1]);
  assert.deepEqual(fragmentSetAside(fragments[1], groups[1], f.ask, plan).map(x => [x.path, x.category]), [['parts[0].steps[1]', 'step'], ['parts[0].loop.stop', 'loop'], ['parts[0].stateVars[1]', 'state-var']]);
  const rowsOnly = { ...structuredClone(global), relations: [global.relations[1], global.relations[2]], portMap: [{ ...global.portMap[0], relation: 1 }, { ...global.portMap[2], relation: 1 }] };
  assert.deepEqual(combineRenderedMaps(fragments, rowsOnly, f.ask, plan, true).portMap, [rowsOnly.portMap[0]]);
  assert.deepEqual(combineRenderedReading(fragments, rowsOnly, f.ask, plan).wire.portMap, [rowsOnly.portMap[0]]);
  // A render fragment holds no port map; the global wire holds nothing else new.
  refused(() => validateRenderedFragment({ ...fragments[1], portMap: [global.portMap[0]] }, groups[1], f.ask, plan));
  validateRenderedFragment({ ...fragments[1], portMap: [] }, groups[1], f.ask, plan);
  refused(() => combineRenderedReading(fragments, { ...global, steps: [] }, f.ask, plan));
  // The feedback names each item by its own bound and category.
  assert.deepEqual(mapStageIssues(fragments[1]).map(x => [x.path, x.rule, x.category ?? null]), [['parts[0].stateVars[1]', 'contract', 'state-var'], ['parts[0].loop.stop', 'contract', 'loop']]);
  const wrongRows = { ...rowsOnly, portMap: [{ ...rowsOnly.portMap[0], relation: 9 }, { ...rowsOnly.portMap[0], direction: 'up' }, rowsOnly.portMap[0]] };
  assert.deepEqual(mapStageIssues(wrongRows).filter(x => x.path.startsWith('portMap')).map(x => [x.path, x.category]), [['portMap[0]', 'port-map'], ['portMap[1]', 'port-map']]);
  const overSteps = structuredClone(fragments[1]); overSteps.parts[0].steps = Array.from({ length: 13 }, (_, i) => ({ name: `s${i}`, at: f.at('| 엔진 | 루프') }));
  overSteps.parts[0].fields = Array(25).fill('f'); overSteps.parts[0].config = Array(9).fill('c');
  assert.deepEqual(mapStageIssues(overSteps).filter(x => x.rule === 'count').map(x => [x.path, x.expected, x.actual]), [['parts[0].fields', 24, 25], ['parts[0].config', 8, 9], ['parts[0].steps', 12, 13]]);
  assert.deepEqual(mapStageIssues({ ...rowsOnly, portMap: Array(13).fill(rowsOnly.portMap[0]) }).filter(x => x.path === 'portMap'), [{ path: 'portMap', rule: 'count', expected: 12, actual: 13 }]);
});

test('.30: a claim restating its state row is set aside where the part has a change, defect or withdrawal row; a store sends to the reader whose row quotes it', () => {
  const f = koru(), plan = koruPlan(f), groups = splitBlueprintParts(plan), fragments = koruFragments(f), global = koruGlobal(f);
  fragments[0].parts[0].claims.splice(1, 1); fragments[1].parts[0].config = ['레버리지 20'];
  const status = (key, head, text) => ({ key, kind: 'reported', text, at: f.at(head), about: null, replaces: null, topic: 'status' });
  // The engine has a withdrawal row: its claim saying its state row again goes. The mood layer has none: its claim stays.
  Object.assign(fragments[1].parts[0], { state: 'running', stateAt: f.at('| 엔진 | 루프') });
  fragments[1].parts[0].claims.push(status('s103', '| 엔진 | 루프', '엔진이 11-03 08:49Z 기준 돌고 있다고 보고됐다.'), status('s104', '| 엔진 | 루프', '엔진은 행 셋을 주문으로 바꾼다.'));
  fragments[0].parts[2].claims = [status('s4', '| 기분 층 | 계산', '기분 층은 미구현이다.')];
  // review.jsonl 행 → 엔진 quoting the engine's own row is placed; 카드 러너 → 엔진 on that row is not (the card is no store).
  global.relations = [global.relations[1], { ...global.relations[2], at: f.at('| 엔진 | 루프') }, { from: 'new:card', to: 'new:engine', kind: 'flow', note: '', at: f.at('| 엔진 | 루프'), channel: 'control' }];
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['parts[3].claims[2]', 'restate'], ['relations[2]', 'sender']]);
  assert.match(exclusions[0].explanation, /상태 칸을 되풀이한 주장/);
  assert.deepEqual([wire.parts[3].claims.map(c => c.key), wire.parts[2].claims.map(c => c.key)], [['s101', 's102', 's104'], ['s4']]);
  assert.deepEqual(wire.relations.map(r => [r.from, r.to]), [['new:card', 'new:review'], ['new:review', 'new:engine']]);
  assert.equal(M.setAside(M.validateMapReply(wire, f.ask)).length, 0);
  // .30: a first map's first pass sets these items aside as its correction does (no refusal, no paid correction); the stage keeps which.
  assert.deepEqual(validateRenderedFragment(fragments[1], groups[1], f.ask, plan, true), fragments[1]);
  assert.deepEqual(fragmentSetAside(fragments[1], groups[1], f.ask, plan), [{ path: 'parts[0].claims[2]', rule: 'contract', category: 'restate' }]);
  // A part whose only claim restates its row stands with none.
  const lone = structuredClone(fragments); lone[1].parts[0].claims = [lone[1].parts[0].claims[2]];
  const read = combineRenderedReading(lone, { ...global, relations: global.relations.slice(0, 2) }, f.ask, plan);
  assert.deepEqual([read.wire.parts[3].claims, read.exclusions.map(x => x.category)], [[], ['restate']]);
});

test('.30 diagnostics: connection rows without a line, an absorbed unit with a connection row, a part renamed after what it hands over', () => {
  const f = koru(), parts = koruFragments(f).flatMap(x => x.parts);
  // Both connection rows drawn: card → engine through the review store, mood → engine directly.
  const lines = [{ from: 'new:card', to: 'new:review' }, { from: 'new:review', to: 'new:engine' }, { from: 'new:mood', to: 'new:engine' }];
  const own = list => list.filter(x => ['connections', 'name'].includes(x.rule));
  assert.deepEqual(own(readingDiagnostics({ ask: f.ask, summary: '', parts, relations: lines })), []);
  assert.deepEqual(own(readingDiagnostics({ ask: f.ask, summary: '', parts, relations: lines.slice(0, 2) })), [{ path: 'relations', rule: 'connections', expected: 2, actual: 1, names: ['기분 층 → 엔진'] }]);
  assert.deepEqual(own(readingDiagnostics({ ask: f.ask, summary: '', parts, relations: lines.slice(1) })), [{ path: 'relations', rule: 'connections', expected: 2, actual: 1, names: ['카드 러너 → 엔진'] }], 'a store line alone does not draw its producer');
  const renamed = structuredClone(parts); renamed[2].name = 'calendar.json';
  assert.deepEqual(own(readingDiagnostics({ ask: f.ask, summary: '', parts: renamed, relations: lines })), [{ path: 'relations', rule: 'connections', expected: 2, actual: 1, names: ['기분 층 → 엔진'] },
    { path: 'parts[2].name', rule: 'name', expected: null, actual: null }]);
  assert.deepEqual(mapStageIssues({ ...koruGlobal(f), relations: lines.slice(0, 2) }, null, { ask: f.ask, parts }).filter(x => x.rule === 'connections'), [{ path: 'relations', rule: 'connections', expected: 2, actual: 1, names: ['기분 층 → 엔진'] }]);
  // The plan: a new part named after no part or artifact row (diagnostic only; the plan stays valid).
  const plan = koruPlan(f); plan.parts[2].name = 'calendar.json';
  validateMapBlueprint(plan, f.ask);
  assert.deepEqual(blueprintStageIssues(plan, f.ask), [{ path: 'parts', rule: 'coverage', expected: 3, actual: 2 }, { path: 'parts[2].name', rule: 'name', expected: null, actual: null }]);
  const plain = fixture();
  assert.deepEqual(readingDiagnostics({ ask: plain.ask, summary: '', parts: [{ ref: 'new:x', name: '아무 이름' }], relations: [] }), [], 'a record without tables says nothing');
});

// ---- first-map-divided.31 (from the .30 run and its blind judging): 36 parts in twelve fragments, the relations the global stage
// wrote all accounted for, the plan's undrawn relation items and the uncited fact rows named, one list item set aside alone, and
// the loop rules. Author-written wires on the small KORU-shaped record; no model quality is claimed. ----
function koruText(text) {
  const project = D.pasteRecord(D.createProject(), text, null).project;
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records[0].spans;
  return { project, input, ask: input.ask, at: head => spans.find(span => span.t.startsWith(head)).s };
}

test('.31: a first map plans 36 parts in twelve fragments (.32: 48 keys each, the last four in the upper halves), a later map 24', () => {
  const f = koru();
  assert.deepEqual([BLUEPRINT_PARTS_MAX, BLUEPRINT_LATER_PARTS_MAX, blueprintPartsMax(f.ask), blueprintPartsMax(fixture(1).ask)], [36, 24, 36, 24]);
  assert.deepEqual(Array.from({ length: 12 }, (_, i) => [fragmentKeys(i).keyStart, fragmentKeys(i).keyEnd]),
    [[1, 48], [101, 148], [201, 248], [301, 348], [401, 448], [501, 548], [601, 648], [701, 748], [51, 98], [151, 198], [251, 298], [351, 398]]);
  // .32: three parts of sixteen claims fit every range, no two ranges meet and none reaches the global stage's s801-s899.
  const keys = Array.from({ length: 12 }, (_, i) => fragmentKeys(i)).flatMap(({ keyStart, keyEnd }) => Array.from({ length: keyEnd - keyStart + 1 }, (_, k) => keyStart + k));
  assert.equal(keys.length, 12 * 3 * M.MAP6_CLAIMS); assert.equal(new Set(keys).size, keys.length); assert.ok(keys.every(k => k >= 1 && k < 801));
  const big = { global: [], parts: Array.from({ length: 36 }, (_, i) => ({ ref: `new:u${i + 1}`, name: `단위 ${i + 1}`, parent: null, at: [f.at('| 엔진 | 루프')], focus: '원문의 책임' })) };
  const groups = splitBlueprintParts(validateMapBlueprint(big, f.ask));
  assert.equal(groups.length, 12);
  const fragment = (index, key) => ({ ...empty(), parts: groups[index].parts.map((part, i) => ({ ref: part.ref, name: part.name, parent: null, role: '원문의 책임', roleAbout: null,
    roleReplaces: null, basis: part.at, claims: [{ key: `s${key + i}`, kind: 'describes', text: '원문이 정의한 동작을 설명한다.', at: part.at[0], about: null, replaces: null }] })) });
  validateRenderedFragment(fragment(7, 746), groups[7], f.ask, big);
  validateRenderedFragment(fragment(8, 51), groups[8], f.ask, big);
  validateRenderedFragment(fragment(11, 396), groups[11], f.ask, big);
  refused(() => validateRenderedFragment(fragment(8, 801), groups[8], f.ask, big)); // the global stage's candidate keys
  refused(() => validateRenderedFragment(fragment(8, 97), groups[8], f.ask, big)); // s99 is past the ninth fragment's range
  refused(() => validateRenderedFragment(fragment(7, 747), groups[7], f.ask, big)); // s749 is past the eighth fragment's range
  refused(() => validateRenderedFragment(fragment(11, 901), groups[11], f.ask, big)); // the .31 range is gone
  const over = { ...big, parts: [...big.parts, { ...big.parts[0], ref: 'new:u37' }] };
  refused(() => validateMapBlueprint(over, f.ask));
  assert.deepEqual(blueprintStageIssues(over, f.ask).filter(x => x.rule === 'count'), [{ path: 'parts', rule: 'count', expected: 36, actual: 37 }]);
  // A later map keeps 24 parts.
  const later = fixture(13), wide = planned(later, 12);
  wide.parts.unshift(...later.ask.parts.map(part => ({ ref: part.id, name: part.name, parent: part.parentId, at: [later.at[0]], focus: '기존 책임' })));
  refused(() => validateMapBlueprint(wide, later.ask));
  assert.equal(validateMapBlueprint({ ...wide, parts: wide.parts.slice(1) }, later.ask).parts.length, 24);
  assert.deepEqual(blueprintStageIssues(wide, later.ask).filter(x => x.path === 'parts' && x.rule === 'count'), [{ path: 'parts', rule: 'count', expected: 24, actual: 25 }]);
});

test('.31: every relation the global stage wrote reaches the wire or leaves its exclusion; the plan relation items no line draws are named', () => {
  const f = koru(), plan = koruPlan(f), fragments = koruFragments(f), global = koruGlobal(f);
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  const out = new Set(exclusions.flatMap(x => { const m = /^relations\[(\d+)\]/.exec(x.path); return m ? [Number(m[1])] : []; }));
  assert.ok(exclusions.filter(x => x.path.startsWith('relations')).every(x => x.category), 'each with its category');
  assert.deepEqual(wire.relations, global.relations.filter((_, i) => !out.has(i)), 'nothing else is dropped');
  // The .30 run: the plan listed 39 relation items and the global stage wrote 34; combine set none aside. The model left out five,
  // each carrying a file whose store part the 24-part plan had no room for. The feedback now names such items by their refs.
  const item = text => ({ kind: 'relation', text, at: [f.at('| 카드 러너 | 엔진 |')] });
  const withItems = { ...plan, global: [item('new:card → new:review: review.jsonl 행'), item('from new:review → to new:engine: review.jsonl 행'),
    item('new:card → new:engine: review.jsonl watch·allowed_side'), item('new:card → new:engine: cards-{CX,CL,DS}.jsonl'), item('new:mood → new:engine: 공포 z'),
    item('new:engine → new:card: 지시'), item('new:card → new:gone: 행')] };
  validateMapBlueprint(withItems, f.ask);
  const parts = fragments.flatMap(x => x.parts), lines = [global.relations[1], global.relations[2]];
  const named = context => mapStageIssues({ ...global, relations: lines }, null, context).filter(x => x.rule === 'plan-relations');
  // review.jsonl reaches the engine through its store; cards-*.jsonl has no store between them; a part not rendered is passed over.
  assert.deepEqual(named({ ask: f.ask, parts, blueprint: withItems }), [{ path: 'relations', rule: 'plan-relations', expected: 6, actual: 3,
    names: ['new:card → new:engine', 'new:mood → new:engine', 'new:engine → new:card'] }]);
  assert.deepEqual(named({ ask: f.ask, parts }), [], 'without the blueprint nothing is said');
  assert.deepEqual(named({ ask: f.ask, parts, blueprint: { ...withItems, global: withItems.global.slice(0, 3) } }), []);
});

test('.31: the change, defect and withdrawal rows no claim quotes are named by their part (global: all; a render fragment: its own)', () => {
  const f = koruText([KORU, '5. 최근 소유자 요청과 실제 변화', '| 날짜 | 원한 것 | 바뀐 부분 이름 | 실제로 바뀐 것 | 확인 방법 |', '|---|---|---|---|---|',
    '| 11-03 | 「켰어」 | 엔진 | 역순 복원, 재ARM 07:25Z | [보고] |', '8. 오류·미해결·할 일', '| 부분 이름 | 무엇이 | 언제부터·근거 |', '|---|---|---|',
    '| 카드 러너 | DS 팔 형식 위반 INVALID | 11-02 [보고] |'].join('\n'));
  assert.deepEqual(factRows(f.ask).map(row => row.name), ['엔진', '카드 러너', '엔진', '카드 러너'], 'the change table names its part in 「바뀐 부분 이름」');
  const fragments = koruFragments(f), parts = structuredClone(fragments.flatMap(x => x.parts));
  assert.deepEqual(uncitedFacts(f.ask, parts), { rows: 4, uncited: ['엔진', '카드 러너'] });
  assert.deepEqual(readingDiagnostics({ ask: f.ask, summary: '', parts }).filter(x => x.rule === 'uncited'), [{ path: 'parts', rule: 'uncited', expected: 4, actual: 2, names: ['엔진', '카드 러너'] }]);
  parts[3].claims.push({ key: 's103', kind: 'reported', text: '「켰어」에 역순 복원했다.', at: f.at('| 11-03'), about: null, replaces: null });
  assert.deepEqual(uncitedFacts(f.ask, parts).uncited, ['카드 러너'], 'a claim on the row cites it');
  // The global correction's feedback carries it with the names; a render correction's names its own parts' rows only.
  assert.deepEqual(mapStageIssues(koruGlobal(f), null, { ask: f.ask, parts }).filter(x => x.rule === 'uncited'), [{ path: 'parts', rule: 'uncited', expected: 4, actual: 3, names: ['카드 러너'] }]);
  assert.deepEqual(mapStageIssues(fragments[1], null, { ask: f.ask, fragment: true }).filter(x => x.rule === 'uncited'), [{ path: 'parts', rule: 'uncited', expected: 2, actual: 1, names: ['엔진'] }]);
  assert.deepEqual(mapStageIssues(fragments[0], null, { ask: f.ask, fragment: true }).filter(x => x.rule === 'uncited'), [{ path: 'parts', rule: 'uncited', expected: 2, actual: 1, names: ['카드 러너'] }]);
  assert.deepEqual(uncitedFacts(koru().ask, []), { rows: 2, uncited: ['엔진', '카드 러너'] });
  assert.deepEqual(readingDiagnostics({ ask: fixture().ask, summary: '', parts: [] }), [], 'a record without tables says nothing');
});

test('.31: one list item or one used name of a step that is too long or blank is set aside alone; a field item takes 60', () => {
  const f = koru(), plan = koruPlan(f), groups = splitBlueprintParts(plan), fragments = koruFragments(f), global = { ...koruGlobal(f) };
  const event = 'event(CYCLE·ARM_CYCLE·CALL·INVALID·REVIEW_ROW·TRIGGER·PULL…)';
  assert.ok(event.length > 40 && event.length <= 60, String(event.length));
  fragments[0].parts[0].claims.splice(1, 1); fragments[1].parts[0].config = ['레버리지 20'];
  fragments[0].parts[1].fields = ['watch', event, '가'.repeat(61), ' '];
  fragments[1].parts[0].steps = [{ name: 'review 읽기', does: null, uses: ['row_read', '가'.repeat(61)], at: f.at('| 엔진 | 루프') }];
  global.relations = [global.relations[1], global.relations[2]];
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.category]), [['parts[1].fields[2]', 'contract', 'fields'], ['parts[1].fields[3]', 'contract', 'fields'],
    ['parts[3].steps[0].uses[1]', 'contract', 'step']]);
  assert.match(exclusions[0].explanation, /항목 하나만/); assert.match(exclusions[2].explanation, /단계는 남겼어요/);
  assert.deepEqual([wire.parts[1].fields, wire.parts[3].steps[0].uses], [['watch', event], ['row_read']]);
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  assert.deepEqual([plain.parts[1].fields, plain.parts[3].steps[0].uses], [['watch', event], ['row_read']]);
  M.attachExclusions(plain, exclusions, f.ask);
  const applied = M.applyReading(f.project, f.input, plain, meta30('R_koru31'));
  assert.deepEqual(applied.reading.exclusions.map(x => x.path), exclusions.map(x => x.path));
  assert.deepEqual(validateProject(applied.project), applied.project, 'storage takes the item paths and a 60-character field');
  // The first pass sets them aside (no refusal); the feedback names each item at its own index.
  assert.deepEqual(validateRenderedFragment(fragments[0], groups[0], f.ask, plan, true), fragments[0]);
  assert.deepEqual(fragmentSetAside(fragments[0], groups[0], f.ask, plan).map(x => x.path), ['parts[1].fields[2]', 'parts[1].fields[3]']);
  assert.deepEqual(mapStageIssues(fragments[0]).map(x => [x.path, x.rule, x.expected, x.actual]), [['parts[1].fields[2]', 'length', 60, 61], ['parts[1].fields[3]', 'contract', null, null]]);
  assert.deepEqual(mapStageIssues(fragments[1]).map(x => [x.path, x.category]), [['parts[0].steps[0].uses[1]', 'step']]);
  // A list that is not one or runs past its bound is still left out whole; a version still leaves config out whole.
  const whole = structuredClone(fragments); whole[0].parts[1].fields = Array(25).fill('f'); whole[1].parts[0].config = ['레버리지 20', '618df374'];
  assert.deepEqual(combineRenderedReading(whole, global, f.ask, plan).exclusions.map(x => x.path).filter(p => /fields|config/.test(p)), ['parts[1].fields', 'parts[3].config']);
  // Plain map.6 (the browser and the single call) refuses such an item as before.
  const blank = structuredClone(wire); blank.parts[1].fields = ['watch', ' '];
  assert.throws(() => M.validateMapReply(blank, f.ask));
});

test('.31: a timer loop at a clock time is left out, a loop unit repeating a setting is left null; another clock-like unit stays', () => {
  const f = koru(), plan = koruPlan(f), groups = splitBlueprintParts(plan), fragments = koruFragments(f), global = { ...koruGlobal(f) };
  fragments[0].parts[0].claims.splice(1, 1); global.relations = [global.relations[1], global.relations[2]];
  fragments[0].parts[0].loop = { unit: '15:00Z 뒤 분마다', stop: null, resume: null, at: f.at('| 카드 러너 | AI') };
  Object.assign(fragments[0].parts[2], { type: 'timer', typeAt: f.at('| 기분 층 | 계산'), loop: { unit: '매일 00:15Z', stop: null, resume: null, at: f.at('| 기분 층 | 계산') } });
  Object.assign(fragments[1].parts[0], { config: ['레버리지 20', 'j1_cadence 60 s'], loop: { unit: ' j1_cadence 60 s ', stop: 'kill 파일', resume: null, at: f.at('| 엔진 | 루프') } });
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['parts[2].loop', 'loop'], ['parts[3].loop.unit', 'loop']]);
  assert.deepEqual([wire.parts[0].loop.unit, wire.parts[2].loop, wire.parts[3].loop.unit, wire.parts[3].loop.stop], ['15:00Z 뒤 분마다', null, null, 'kill 파일']);
  const plain = M.validateMapReply(wire, f.ask);
  assert.deepEqual([plain.parts[0].loop.unit, plain.parts[2].loop, plain.parts[3].loop.unit, plain.parts[3].loop.stop], ['15:00Z 뒤 분마다', null, null, 'kill 파일']);
  assert.deepEqual(fragmentSetAside(fragments[0], groups[0], f.ask, plan).map(x => x.path), ['parts[2].loop']);
  assert.deepEqual(mapStageIssues(fragments[0]).filter(x => x.category === 'loop').map(x => x.path), ['parts[2].loop']);
  assert.deepEqual(mapStageIssues(fragments[1]).filter(x => x.category === 'loop').map(x => x.path), ['parts[0].loop.unit']);
  // A loop whose only item was the setting is no loop at all.
  const only = structuredClone(fragments); only[1].parts[0].loop.stop = null;
  assert.equal(M.validateMapReply(combineRenderedReading(only, global, f.ask, plan).wire, f.ask).parts[3].loop, null);
  // A timer whose unit holds no clock time keeps its loop.
  const kept = structuredClone(fragments); kept[0].parts[2].loop.unit = '하루 한 번';
  assert.equal(combineRenderedReading(kept, global, f.ask, plan).wire.parts[2].loop.unit, '하루 한 번');
});

// ---- first-map-divided.32 (from the blind judging of the .31 KORU maps): sixteen claims a part, the plan items assigned to a part
// named when no claim quotes their rows (plan-claims), the hedge rows uncited reads, a payload part left out whole, a payload file
// the artifact table does not list kept on its one line, and the final wire's diagnostics in fixed shapes. Author-written wires on
// the small KORU-shaped record; no model quality is claimed. ----
const KORU32 = [KORU, '7. 지켜야 할 것과 하지 않기로 한 것', '| 부분 이름 | 규칙 한 줄 | 누가 정했나·언제 |', '|---|---|---|',
  '| 엔진 | 돈 안전 = 보유 중 스탑 상주 하나 | 소유자 10-22 [보고] |', '| 엔진 | 게이트는 코드: TESTS rc 0 + VERIFY GO | 감독자 09-26 [보고] |',
  '11. 가장 자신 없는 것', '| 부분 이름 | 내용 |', '|---|---|', '| 엔진 | 「돌고 있음」은 인용이고, 08:49Z 뒤는 직접 보지 않음 [추정] |'].join('\n');
const plan32 = f => {
  const plan = koruPlan(f);
  plan.parts[0].at.push(f.at('| 카드 러너 | review')); // the card runner's own withdrawal row
  plan.parts[3].at.push(f.at('| 엔진 | 매일')); // the engine's own withdrawal row
  plan.global.push(
    { kind: 'condition', text: '소유자 요구: 보유 중 스탑 상주 하나, 게이트는 코드(TESTS rc 0 + VERIFY GO) → new:engine', at: [f.at('| 엔진 | 돈 안전'), f.at('| 엔진 | 게이트는')] },
    // misassigned by the plan (the row's 부분 이름 is 엔진): a claim of any part quoting the row lands it.
    { kind: 'correction', text: '매일 FLAT 재시작은 채택하지 않음 → new:mood', at: [f.at('| 엔진 | 매일')] },
    { kind: 'uncertain', text: '08:49Z 뒤 엔진 실제 상태는 모름 → new:engine', at: [f.at('| 엔진 | 08:49Z')] },
    { kind: 'relation', text: 'new:card → new:engine: review.jsonl 행 → new:engine', at: [f.at('| 카드 러너 | 엔진 |')] });
  return plan;
};

test('.32: the plan items assigned to a part that no claim quotes are named by ref and their first 40 characters (plan-claims); uncited reads the hedge rows', () => {
  const f = koruText(KORU32), plan = plan32(f), fragments = koruFragments(f), parts = structuredClone(fragments.flatMap(x => x.parts));
  validateMapBlueprint(plan, f.ask);
  const name = (ref, text) => `${ref}: ${text.slice(0, 40)}`;
  // Five items: three global (the relation item is not one) and the two parts' own withdrawal rows; the condition and the unknown
  // are not quoted (both the engine's, in the plan's part order); the misassigned FLAT item is quoted by the engine's s101.
  assert.deepEqual(planClaims(f.ask, plan, parts), { items: 5, missing: [name('new:engine', plan.global[0].text), name('new:engine', plan.global[2].text)] });
  // An item pointing at two rule rows lands only when both are quoted.
  const claim = (key, head) => ({ key, kind: 'reported', text: '원문 행의 규칙이다.', at: f.at(head), about: null, replaces: null, topic: 'rule' });
  parts[3].claims.push(claim('s103', '| 엔진 | 돈 안전'));
  assert.equal(planClaims(f.ask, plan, parts).missing.length, 2, 'one of its two rows is not enough');
  parts[3].claims.push(claim('s104', '| 엔진 | 게이트는'));
  assert.deepEqual(planClaims(f.ask, plan, parts).missing, [name('new:engine', plan.global[2].text)]);
  // A part's own focus row is an item of its own: the card runner's withdrawal row goes missing without s1.
  const bare = structuredClone(parts); bare[0].claims.splice(0, 1);
  assert.ok(planClaims(f.ask, plan, bare).missing.some(n => n.startsWith('new:card: 카드 러너 | review 작성기 FIX3')));
  // The global correction hears it with its names (readingDiagnostics given the plan); a render correction its own parts' items only.
  assert.deepEqual(readingDiagnostics({ ask: f.ask, summary: '', parts, blueprint: plan }).filter(x => x.rule === 'plan-claims'),
    [{ path: 'parts', rule: 'plan-claims', expected: 5, actual: 4, names: [name('new:engine', plan.global[2].text)] }]);
  assert.deepEqual(mapStageIssues(fragments[1], null, { ask: f.ask, fragment: true, blueprint: plan }).filter(x => x.rule === 'plan-claims'),
    [{ path: 'parts', rule: 'plan-claims', expected: 3, actual: 1, names: [name('new:engine', plan.global[0].text), name('new:engine', plan.global[2].text)] }]);
  assert.deepEqual(mapStageIssues(fragments[0], null, { ask: f.ask, fragment: true, blueprint: plan }).filter(x => x.rule === 'plan-claims'), [], 'the mood item is quoted in its fragment');
  assert.deepEqual(mapStageIssues(fragments[1], null, { ask: f.ask, fragment: true }).filter(x => x.rule === 'plan-claims'), [], 'no plan, no plan-claims');
  // .32: uncited also reads the 「가장 자신 없는 것」 rows (the record's own hedge about after its basis time).
  assert.deepEqual(factRows(f.ask).map(row => row.name), ['엔진', '카드 러너', '엔진']);
  assert.deepEqual(uncitedFacts(f.ask, parts), { rows: 3, uncited: ['엔진'] });
  assert.deepEqual(planClaims(fixture().ask, plan32(koruText(KORU32)), []), { items: 0, missing: [] }, 'refs of no given part are not items');
});

test('.32: a part made of a payload token (no table row, no type, no line) is left out whole as payload-part; a payload file no artifact row lists stays on its one line', () => {
  const text = KORU.replace('| 기분 층 | 계산 | 미구현 |', '| 기분 층 | 계산 | 미구현 |\n| facts-refresh | 타이머 | 매일 00:15Z |')
    .replace('| 기분 층 | 엔진 | 공포 z |', '| 기분 층 | 엔진 | 공포 z |\n| facts-refresh | 엔진 | fee_policy·calendar.json |');
  const f = koruText(text), plan = koruPlan(f);
  plan.parts.splice(3, 0, { ref: 'new:calendar', name: 'calendar.json', parent: null, at: [f.at('| facts-refresh | 엔진')], focus: '넘기는 것' });
  plan.parts.push({ ref: 'new:facts', name: 'facts-refresh', parent: null, at: [f.at('| facts-refresh | 타이머')], focus: '매일 00:15Z' });
  const fragments = koruFragments(f), engine = fragments[1].parts[0];
  const part = (ref, name, head, key) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [f.at(head)],
    claims: [{ key, kind: 'reported', text: '원문 행의 사실을 옮긴다.', at: f.at(head), about: null, replaces: null }] });
  fragments[1].parts = [part('new:calendar', 'calendar.json', '| facts-refresh | 엔진', 's101'), { ...engine, claims: engine.claims.map((c, i) => ({ ...c, key: `s${102 + i}` })) },
    part('new:facts', 'facts-refresh', '| facts-refresh | 타이머', 's104')];
  const base = koruGlobal(f), line = { from: 'new:facts', to: 'new:engine', kind: 'flow', note: '', at: f.at('| facts-refresh | 엔진'), payload: 'fee_policy·calendar.json', channel: 'data', mode: 'design' };
  const global = { ...base, relations: [base.relations[0], base.relations[1], base.relations[2], line] };
  assert.deepEqual(payloadParts({ ...global, parts: fragments.flatMap(x => x.parts) }, f.ask), [3]);
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  // The payload part is out whole at its combined index; every other reason keeps naming the combined wire (the engine is parts[4]).
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.category]), [['parts[3]', 'contract', 'payload-part'], ['parts[0].claims[1]', 'contract', 'wrong-part'],
    ['parts[4].config', 'contract', 'config'], ['relations[0]', 'contract', 'via-store']]);
  assert.equal(exclusions[0].explanation, M.explainExclusion('parts[3]', 'contract', 'payload-part'));
  assert.match(exclusions[0].explanation, /넘기는 것의 이름을 떼어 만든 부분/);
  assert.equal(exclusions[0].record, 'N01');
  assert.deepEqual(wire.parts.map(p => p.ref), ['new:card', 'new:review', 'new:mood', 'new:engine', 'new:facts']);
  assert.equal(wire.parts[3].config, null, 'the engine\'s config left out where the engine stands in the wire');
  // calendar.json has no artifact row and no store: the line keeps its whole payload; review.jsonl has a row: its direct line is out.
  assert.deepEqual(wire.relations.map(r => [r.from, r.to, r.payload]), [['new:card', 'new:review', 'review.jsonl 행'], ['new:review', 'new:engine', 'review.jsonl 행'], ['new:facts', 'new:engine', 'fee_policy·calendar.json']]);
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  // Not a payload part: a store, a part with a line, or a part the tables name.
  const typed = structuredClone(fragments); Object.assign(typed[1].parts[0], { type: 'store', typeAt: f.at('| facts-refresh | 엔진') });
  assert.deepEqual(payloadParts({ ...global, parts: typed.flatMap(x => x.parts) }, f.ask), []);
  assert.deepEqual(payloadParts({ ...global, relations: [...global.relations, { ...line, from: 'new:calendar' }], parts: fragments.flatMap(x => x.parts) }, f.ask), []);
  const named = structuredClone(fragments); named[1].parts[0].name = 'facts-refresh';
  assert.deepEqual(payloadParts({ ...global, parts: named.flatMap(x => x.parts) }, f.ask), []);
  // A file the artifact table lists still asks its store: with review.jsonl's store untyped its line is out as before (.29), and a
  // record with no artifact table keeps that rule for every file (map-exclusions' .29 reading).
  const noStore = structuredClone(fragments); noStore[0].parts[1].type = null; noStore[0].parts[1].typeAt = null;
  assert.ok(combineRenderedReading(noStore, global, f.ask, plan).exclusions.some(x => x.path === 'relations[2]' && x.category === 'via-store'));
});

test('.32: the final wire\'s diagnostics come in fixed shapes for the global stage record (eight rules, at most sixteen)', () => {
  const f = koruText(KORU32), plan = plan32(f), fragments = koruFragments(f), global = { ...koruGlobal(f), summary: '어느 주장도 받치지 않는 요약 문장이다.' };
  const found = finalDiagnostics(fragments, global, f.ask, plan);
  assert.deepEqual(FINAL_DIAGNOSTICS, ['connections', 'plan-relations', 'coverage', 'uncited', 'plan-claims', 'unbacked', 'withdrawn-count', 'unknown-count']);
  assert.ok(found.length >= 1 && found.length <= 16);
  for (const x of found) {
    assert.deepEqual(Object.keys(x), ['path', 'rule', 'expected', 'actual', 'names']);
    assert.ok(FINAL_DIAGNOSTICS.includes(x.rule)); assert.ok(Array.isArray(x.names) && x.names.length <= 24);
  }
  const by = rule => found.find(x => x.rule === rule);
  assert.deepEqual(by('unbacked'), { path: 'summary', rule: 'unbacked', expected: 0, actual: 1, names: [] });
  assert.deepEqual(by('uncited'), { path: 'parts', rule: 'uncited', expected: 3, actual: 2, names: ['엔진'] });
  assert.equal(by('plan-claims').names.length, 2);
  assert.deepEqual(by('unknown-count'), { path: 'parts', rule: 'unknown-count', expected: 1, actual: 0, names: [] });
  // Read on the final wire: the engine's claim on the withdrawal row is kept there, the card runner's wrong-part claim is not.
  assert.equal(found.map(x => x.rule).join(','), FINAL_DIAGNOSTICS.filter(rule => found.some(x => x.rule === rule)).join(','), 'in the fixed order');
  assert.deepEqual(finalDiagnostics(fragments, { nope: true }, f.ask, plan), [], 'a reply that does not combine says nothing');
  assert.equal(FRAGMENT_KEYS, 3 * M.MAP6_CLAIMS);
});
