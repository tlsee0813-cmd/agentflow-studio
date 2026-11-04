// Model-free blueprint/render contracts. These author-written wires are not evidence of model-generation quality.
import test from 'node:test';
import { stripEighteen } from './strip18.mjs';
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
  BLUEPRINT_LATER_PARTS_MAX, blueprintPartsMax, unknownRows, missingLines, fragmentKeys, factRows, uncitedFacts, planClaims, planShort, loopRows, payloadParts, finalDiagnostics, FINAL_DIAGNOSTICS, FRAGMENT_KEYS, planStoreFolds, storeDupParts, droppedItems, summarySentences, connectionPayloadRows, REFUSAL_OUTCOME, versionFacts } from '../server/map-blueprint.mjs';

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
    roleReplaces: null, basis: part.ref.startsWith('new:') ? part.at : [], claims: [{ key: `s${fragmentKeys(index).keyStart + i}`,
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
  // .33: 60 keys a fragment, one run after another (s1-s60, s61-s120 …).
  for (const [index, key] of [[0, 's60'], [1, 's61'], [1, 's120']]) {
    const good = structuredClone(fragments[index]); good.parts[0].claims[0].key = key;
    validateRenderedFragment(good, splitBlueprintParts(blueprint)[index], f.ask, blueprint);
  }
  for (const key of ['s60', 's121', 's148', 's200', 's801']) {
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
  // .34: the correction's reply sets the overlong claim aside even where it leaves its part with no claim (the run goes on).
  assert.deepEqual(validateRenderedFragment(long, g0, f0.ask, b0, false), long);
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
  // .42: a summary of 360 (map-reading.17).
  const value = { ...empty(), summary: '😀'.repeat(180), parts: [{ basis: Array(4).fill(null), claims: Array(20).fill(null), name: '가'.repeat(60), role: '가'.repeat(300) }],
    relations: Array(48).fill(null), candidates: Array(6).fill(null), gaps: Array(2).fill(null), matches: Array(24).fill(null), material: Array(6).fill(null) };
  assert.deepEqual(mapStageIssues(value), []);
  value.summary += '가'; value.parts[0].basis.push(null); value.parts[0].claims.push(null); value.parts[0].name += '가'; value.parts[0].role += '가';
  for (const field of ['relations', 'candidates', 'gaps', 'matches', 'material']) value[field].push(null);
  assert.deepEqual(mapStageIssues(value), [
    { path: 'summary', rule: 'length', expected: 360, actual: 361 },
    { path: 'parts[0].basis', rule: 'count', expected: 4, actual: 5 }, { path: 'parts[0].claims', rule: 'count', expected: 20, actual: 21 },
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
test('first-map fragments set aside isolated bad items but still refuse a part without basis, duplicate keys and foreign key ranges (.34: a part emptied of claims only on the first pass)', () => {
  const f = fixture(), blueprint = planned(f, 3), group = splitBlueprintParts(blueprint)[0], base = rendered(f, blueprint)[0];
  assert.equal(f.ask.schemaVersion, M.MAP6_SCHEMA);
  const soft = structuredClone(base);
  soft.parts[0].claims.push({ ...soft.parts[0].claims[0], key: 's9', at: 'N01.99' });
  soft.parts[1].claims.push({ ...soft.parts[1].claims[0], key: 's8', text: '가'.repeat(241) });
  soft.parts[2].basis = [...soft.parts[2].basis, 'N99.01'];
  assert.deepEqual(validateRenderedFragment(soft, group, f.ask, blueprint), soft, 'the raw fragment is cached untouched');
  for (const mutate of [
    x => { x.parts[0].basis = ['N99.01', 'N99.02']; },                       // a new part without any surviving basis
    x => { x.parts[1].claims[0].key = 's1'; },                                // a duplicate statement key (contradiction)
    x => { x.parts[0].claims.push({ ...x.parts[0].claims[0], key: 's150', at: 'N99.01' }); }, // a key outside the range, even on a bad claim
    x => { x.parts[0].name = '이름 변경'; }, x => { x.parts[0].role = '가'.repeat(301); }, x => { x.parts.pop(); },
  ]) { const bad = structuredClone(base); mutate(bad); refused(() => validateRenderedFragment(bad, group, f.ask, blueprint)); }
  // .34: a part whose every claim is set aside refuses the first pass only (with its first claim's reason); a correction's reply and
  // the combined wire keep the part, with no claim.
  const emptied = structuredClone(base); emptied.parts[0].claims = [{ ...emptied.parts[0].claims[0], at: 'N99.01' }];
  assert.deepEqual(validateRenderedFragment(emptied, group, f.ask, blueprint), emptied);
  let first; try { validateRenderedFragment(emptied, group, f.ask, blueprint, true); } catch (error) { first = error; }
  assert.deepEqual(first?.validation, { path: 'parts[0].claims[0].at', rule: 'reference' });
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
  // .38: a wrong channel word leaves the channel out alone (written null); the line stays.
  assert.deepEqual(wire.relations, [{ ...global.relations[0], channel: null }, global.relations[1]]);
  assert.deepEqual([wire.basisAt, wire.basisVersion], [null, '라이브 618df374']);
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  assert.deepEqual([plain.parts[0].type, plain.parts[0].inputs, plain.parts[0].fields], ['store', ['review 행'], ['watch', 'allowed_side']]);
  assert.deepEqual([plain.parts[1].type, plain.parts[1].inputs, plain.parts[1].outputs], [null, [], ['결과 행']]);
  assert.deepEqual([plain.relations.map(x => x.channel), plain.basisAt, plain.basisVersion], [[null, 'data'], null, '라이브 618df374']);
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
// .35: a part's own rows are plan-claims units (planClaims reads them by name): the engine's own 「모르는 것」 row unquoted under the cap
// refuses a render's first pass for its one correction, so a strict first pass here quotes it too (s120, the second fragment's last key).
const ownRows = (f, fragment) => {
  const out = structuredClone(fragment), engine = out.parts.find(p => p.ref === 'new:engine');
  const has = head => f.ask.records[0].spans.some(span => span.t.startsWith(head));
  engine.claims.push({ key: 's120', kind: 'reported', text: '08:49Z 뒤 실제 상태는 모른다고 적혀 있다.', at: f.at('| 엔진 | 08:49Z'), about: null, replaces: null, topic: 'unknown' });
  // KORU32 and KORU33 add the engine's own hedge row (가장 자신 없는 것).
  if (has('| 엔진 | 「돌고')) engine.claims.push({ key: 's119', kind: 'reported', text: '08:49Z 뒤는 직접 보지 않았다고 적혀 있다.', at: f.at('| 엔진 | 「돌고'), about: null, replaces: null, topic: 'unknown' });
  return out;
};
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
  const own1 = ownRows(f, fragments[1]);
  assert.deepEqual(validateRenderedFragment(own1, groups[1], f.ask, plan, true), own1);
  refused(() => validateRenderedFragment(fragments[1], groups[1], f.ask, plan, true)); // .35: its own 모르는 것 row unquoted under the cap
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
    { path: 'summary', rule: 'unbacked', expected: 0, actual: 1 }, { path: 'parts', rule: 'unknown-count', expected: 1, actual: 0, names: ['엔진 | 08:49Z 뒤 실제 상태 | STATUS 첫 줄'] }]);
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
  // .42: on the connection row (the artifact row's lines between the same two parts would merge into one, product-merge).
  const fragments = koruFragments(f), line = koruGlobal(f).relations[2];
  // .37: 49 lines of their own (the same ends, channel and payload twice would be one line read again, dup-line).
  const wide = { ...koruGlobal(f), relations: Array.from({ length: 49 }, (_, i) => ({ ...structuredClone(line), payload: `review.jsonl 행 ${i + 1}` })) };
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
    [{ path: 'summary', rule: 'unbacked', expected: 0, actual: 1 }, { path: 'parts', rule: 'unknown-count', expected: 1, actual: 0, names: ['엔진 | 08:49Z 뒤 실제 상태 | STATUS 첫 줄'] }]);
  parts[0].claims[0].topic = 'status'; parts[3].claims[1].topic = 'unknown';
  // .33: an unknown claim of the part answers the row only when it quotes that row (a count of unknown claims no longer does).
  assert.deepEqual(readingDiagnostics({ ask: f.ask, summary: '엔진은 매일 FLAT 재시작을 채택하지 않았다.', parts }).map(x => x.rule), ['withdrawn-count', 'unknown-count']);
  parts[3].claims[1].at = f.at('| 엔진 | 08:49Z');
  assert.deepEqual(readingDiagnostics({ ask: f.ask, summary: '엔진은 매일 FLAT 재시작을 채택하지 않았다.', parts }),
    [{ path: 'parts', rule: 'withdrawn-count', expected: 2, actual: 1 }]);
  // Nor does an unknown claim of another part quoting it, and a row naming no part of the reading is not counted.
  const other = structuredClone(parts); other[3].claims[1].topic = 'status'; other[0].claims.push({ ...other[3].claims[1], key: 's9', topic: 'unknown' });
  assert.deepEqual(unknownRows(f.ask, other), { rows: 1, missing: ['엔진 | 08:49Z 뒤 실제 상태 | STATUS 첫 줄'] });
  assert.deepEqual(unknownRows(f.ask, other.filter(p => p.name !== '엔진')), { rows: 0, missing: [] });
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
  const own1 = ownRows(f, fragments[1]);
  assert.deepEqual(validateRenderedFragment(own1, groups[1], f.ask, plan, true), own1);
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
  const overSteps = structuredClone(fragments[1]); // .41 (map-reading.16): twelve settings; .42 (map-reading.17): 24 steps.
  overSteps.parts[0].steps = Array.from({ length: 25 }, (_, i) => ({ name: `s${i}`, at: f.at('| 엔진 | 루프') }));
  overSteps.parts[0].fields = Array(25).fill('f'); overSteps.parts[0].config = Array(13).fill('c');
  assert.deepEqual(mapStageIssues(overSteps).filter(x => x.rule === 'count').map(x => [x.path, x.expected, x.actual]), [['parts[0].fields', 24, 25], ['parts[0].config', 12, 13], ['parts[0].steps', 24, 25]]);
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
  // .36: the store line on the engine's part-type row passes the sender rule but stands on no flow row of a record with a connection
  // table (unrecorded), as the .35 KORU owner → ARM on the owner's part row did.
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['parts[3].claims[2]', 'restate'], ['relations[1]', 'unrecorded'], ['relations[2]', 'sender']]);
  assert.match(exclusions[0].explanation, /상태 칸·단계·역할 문장을 되풀이한 주장/);
  assert.match(exclusions[1].explanation, /화살표 줄이 아닌 줄에서 만든 연결/);
  assert.deepEqual([wire.parts[3].claims.map(c => c.key), wire.parts[2].claims.map(c => c.key)], [['s101', 's102', 's104'], ['s4']]);
  assert.deepEqual(wire.relations.map(r => [r.from, r.to]), [['new:card', 'new:review']]);
  assert.equal(M.setAside(M.validateMapReply(wire, f.ask)).length, 0);
  // .30: a first map's first pass sets these items aside as its correction does (no refusal, no paid correction); the stage keeps which.
  const own1 = ownRows(f, fragments[1]);
  assert.deepEqual(validateRenderedFragment(own1, groups[1], f.ask, plan, true), own1);
  assert.deepEqual(fragmentSetAside(fragments[1], groups[1], f.ask, plan), [{ path: 'parts[0].claims[2]', rule: 'contract', category: 'restate' }]);
  // A part whose only claim restates its row stands with none.
  const lone = structuredClone(fragments); lone[1].parts[0].claims = [lone[1].parts[0].claims[2]];
  const read = combineRenderedReading(lone, { ...global, relations: global.relations.slice(0, 2) }, f.ask, plan);
  assert.deepEqual([read.wire.parts[3].claims, read.exclusions.map(x => x.category)], [[], ['restate', 'unrecorded']]);
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

test('.31: a first map plans 36 parts in twelve fragments (.33: 60 keys each, one run after another), a later map 24', () => {
  const f = koru();
  assert.deepEqual([BLUEPRINT_PARTS_MAX, BLUEPRINT_LATER_PARTS_MAX, blueprintPartsMax(f.ask), blueprintPartsMax(fixture(1).ask)], [36, 24, 36, 24]);
  assert.deepEqual(Array.from({ length: 12 }, (_, i) => [fragmentKeys(i).keyStart, fragmentKeys(i).keyEnd]),
    [[1, 60], [61, 120], [121, 180], [181, 240], [241, 300], [301, 360], [361, 420], [421, 480], [481, 540], [541, 600], [601, 660], [661, 720]]);
  assert.equal(M.MAP6_CLAIMS, 20);
  // .33: three parts of twenty claims fit every range, no two ranges meet and none reaches the global stage's s801-s899.
  const keys = Array.from({ length: 12 }, (_, i) => fragmentKeys(i)).flatMap(({ keyStart, keyEnd }) => Array.from({ length: keyEnd - keyStart + 1 }, (_, k) => keyStart + k));
  assert.equal(keys.length, 12 * 3 * M.MAP6_CLAIMS); assert.equal(new Set(keys).size, keys.length); assert.ok(keys.every(k => k >= 1 && k < 801));
  const big = { global: [], parts: Array.from({ length: 36 }, (_, i) => ({ ref: `new:u${i + 1}`, name: `단위 ${i + 1}`, parent: null, at: [f.at('| 엔진 | 루프')], focus: '원문의 책임' })) };
  const groups = splitBlueprintParts(validateMapBlueprint(big, f.ask));
  assert.equal(groups.length, 12);
  const fragment = (index, key) => ({ ...empty(), parts: groups[index].parts.map((part, i) => ({ ref: part.ref, name: part.name, parent: null, role: '원문의 책임', roleAbout: null,
    roleReplaces: null, basis: part.at, claims: [{ key: `s${key + i}`, kind: 'describes', text: '원문이 정의한 동작을 설명한다.', at: part.at[0], about: null, replaces: null }] })) });
  validateRenderedFragment(fragment(7, 478), groups[7], f.ask, big);
  validateRenderedFragment(fragment(8, 481), groups[8], f.ask, big);
  validateRenderedFragment(fragment(11, 718), groups[11], f.ask, big);
  refused(() => validateRenderedFragment(fragment(8, 801), groups[8], f.ask, big)); // the global stage's candidate keys
  refused(() => validateRenderedFragment(fragment(8, 539), groups[8], f.ask, big)); // s541 is past the ninth fragment's range
  refused(() => validateRenderedFragment(fragment(7, 479), groups[7], f.ask, big)); // s481 is past the eighth fragment's range
  refused(() => validateRenderedFragment(fragment(1, 119), groups[1], f.ask, big)); // s121 is the third fragment's (.32 gave the second s101-s148)
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
  // .36: (the mood layer is unbuilt: its loop goes on that alone; here it says no state) a unit with a unit word and no clock time stayed.
  // .40 (changed on purpose): a timer repeats nothing of its own (LOOP_TYPES): its schedule is its trigger, its loop is left out.
  const kept = structuredClone(fragments); Object.assign(kept[0].parts[2], { state: null, stateAt: null }); kept[0].parts[2].loop.unit = '6시간마다';
  assert.equal(combineRenderedReading(kept, global, f.ask, plan).wire.parts[2].loop, null);
  kept[0].parts[2].type = 'compute';
  assert.equal(combineRenderedReading(kept, global, f.ask, plan).wire.parts[2].loop.unit, '6시간마다', 'a compute part keeps it');
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

test('.32: the plan items assigned to a part that no claim quotes are named by ref and (.33) each of their rows as written (plan-claims); uncited reads the hedge rows', () => {
  const f = koruText(KORU32), plan = plan32(f), fragments = koruFragments(f), parts = structuredClone(fragments.flatMap(x => x.parts));
  validateMapBlueprint(plan, f.ask);
  // .33: each row of an item is its own unit, named by the row as written (up to 120 characters, never cut at 40).
  const money = 'new:engine: 엔진 | 돈 안전 = 보유 중 스탑 상주 하나 | 소유자 10-22 [보고]', gate = 'new:engine: 엔진 | 게이트는 코드: TESTS rc 0 + VERIFY GO | 감독자 09-26 [보고]';
  const hedge = 'new:engine: 엔진 | 08:49Z 뒤 실제 상태 | STATUS 첫 줄';
  // .35: and the engine's own 「가장 자신 없는 것」 row, a unit by the part's own name (no plan item assigns it).
  const doubt = 'new:engine: 엔진 | 「돌고 있음」은 인용이고, 08:49Z 뒤는 직접 보지 않음 [추정]';
  const named = x => ({ items: x.items, missing: x.missing });
  // Six units (.35: seven, with the hedge row): the condition's two rule rows, the correction's and the unknown's rows (the relation item is not one) and the two
  // parts' own withdrawal rows; the rule rows and the unknown are not quoted (all the engine's, in the plan's part order); the
  // misassigned FLAT item is quoted by the engine's s101.
  assert.deepEqual(named(planClaims(f.ask, plan, parts)), { items: 7, missing: [money, gate, hedge, doubt] });
  // An item pointing at two rule rows: each row lands on its own.
  const claim = (key, head) => ({ key, kind: 'reported', text: '원문 행의 규칙이다.', at: f.at(head), about: null, replaces: null, topic: 'rule' });
  parts[3].claims.push(claim('s103', '| 엔진 | 돈 안전'));
  assert.deepEqual(planClaims(f.ask, plan, parts).missing, [gate, hedge, doubt], 'the quoted row lands, the other is named');
  parts[3].claims.push(claim('s104', '| 엔진 | 게이트는'));
  assert.deepEqual(planClaims(f.ask, plan, parts).missing, [hedge, doubt]);
  // A part's own focus row is an item of its own: the card runner's withdrawal row goes missing without s1.
  const bare = structuredClone(parts); bare[0].claims.splice(0, 1);
  assert.ok(planClaims(f.ask, plan, bare).missing.some(n => n.startsWith('new:card: 카드 러너 | review 작성기 FIX3')));
  // The global correction hears it with its names (readingDiagnostics given the plan); a render correction its own parts' items only.
  assert.deepEqual(readingDiagnostics({ ask: f.ask, summary: '', parts, blueprint: plan }).filter(x => x.rule === 'plan-claims'),
    [{ path: 'parts', rule: 'plan-claims', expected: 7, actual: 5, names: [hedge, doubt] }]);
  assert.deepEqual(mapStageIssues(fragments[1], null, { ask: f.ask, fragment: true, blueprint: plan }).filter(x => x.rule === 'plan-claims'),
    [{ path: 'parts', rule: 'plan-claims', expected: 5, actual: 1, names: [money, gate, hedge, doubt] }]);
  assert.deepEqual(mapStageIssues(fragments[0], null, { ask: f.ask, fragment: true, blueprint: plan }).filter(x => x.rule === 'plan-claims'), [], 'the mood item is quoted in its fragment');
  assert.deepEqual(mapStageIssues(fragments[1], null, { ask: f.ask, fragment: true }).filter(x => x.rule === 'plan-claims'), [], 'no plan, no plan-claims');
  // .32: uncited also reads the 「가장 자신 없는 것」 rows (the record's own hedge about after its basis time).
  assert.deepEqual(factRows(f.ask).map(row => row.name), ['엔진', '카드 러너', '엔진']);
  assert.deepEqual(uncitedFacts(f.ask, parts), { rows: 3, uncited: ['엔진'] });
  assert.deepEqual(planClaims(fixture().ask, plan32(koruText(KORU32)), []), { items: 0, missing: [], missingUnits: [] }, 'refs of no given part are not items');
  // .35: the FLAT row the plan gave the mood layer (its 부분 이름 cell is 엔진, another plan part) stays the diagnostic's: written on the
  // mood layer it would only be set aside as wrong-part, so it never refuses a render; the engine's own unit of that row does.
  const unquoted = structuredClone(parts); unquoted[0].claims = unquoted[0].claims.filter(c => c.key !== 's2'); unquoted[3].claims = unquoted[3].claims.filter(c => c.key !== 's101');
  const flat = planClaims(f.ask, plan, unquoted).missingUnits.filter(u => u.name.includes('매일 FLAT')).map(u => [u.ref, u.trigger]);
  assert.deepEqual(flat, [['new:mood', false], ['new:engine', true]]);
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

test('.32: the final wire\'s diagnostics come in fixed shapes for the global stage record (eight rules, .35 ten, at most sixteen)', () => {
  const f = koruText(KORU32), plan = plan32(f), fragments = koruFragments(f), global = { ...koruGlobal(f), summary: '어느 주장도 받치지 않는 요약 문장이다.' };
  const found = finalDiagnostics(fragments, global, f.ask, plan);
  // .36: and store-dup, store-island after the lines. .37: and the lines the contract set aside (lines-set-aside), after the lines.
  // .38: and anchor-enforce and portmap-missing after anchor-kind. .40: and step-name after portmap-missing.
  assert.deepEqual(FINAL_DIAGNOSTICS, ['connections', 'plan-relations', 'lines-set-aside', 'product-lines', 'store-dup', 'store-island', 'coverage', 'uncited', 'loop-missing', 'plan-claims', 'anchor-kind', 'anchor-enforce', 'portmap-missing', 'step-name', 'steps-cut', 'unbacked', 'withdrawn-count', 'unknown-count']);
  assert.ok(found.length >= 1 && found.length <= 16);
  for (const x of found) {
    assert.deepEqual(Object.keys(x), ['path', 'rule', 'expected', 'actual', 'names']);
    assert.ok(FINAL_DIAGNOSTICS.includes(x.rule)); assert.ok(Array.isArray(x.names) && x.names.length <= 24);
  }
  const by = rule => found.find(x => x.rule === rule);
  assert.deepEqual(by('unbacked'), { path: 'summary', rule: 'unbacked', expected: 0, actual: 1, names: [] });
  assert.deepEqual(by('uncited'), { path: 'parts', rule: 'uncited', expected: 3, actual: 2, names: ['엔진'] });
  assert.equal(by('plan-claims').names.length, 4); // .35: with the engine's own hedge row
  assert.deepEqual(by('unknown-count'), { path: 'parts', rule: 'unknown-count', expected: 1, actual: 0, names: ['엔진 | 08:49Z 뒤 실제 상태 | STATUS 첫 줄'] });
  // Read on the final wire: the engine's claim on the withdrawal row is kept there, the card runner's wrong-part claim is not.
  assert.equal(found.map(x => x.rule).join(','), FINAL_DIAGNOSTICS.filter(rule => found.some(x => x.rule === rule)).join(','), 'in the fixed order');
  assert.deepEqual(finalDiagnostics(fragments, { nope: true }, f.ask, plan), [], 'a reply that does not combine says nothing');
  assert.equal(FRAGMENT_KEYS, 3 * M.MAP6_CLAIMS);
});

// ---- first-map-divided.33 (map-reading.10, the map design spec's fourth cycle): a rule claim's scope, places and devices, a
// withdrawal's kind and a gate's kind, each set aside alone on the combined wire (the claim stays), read whole by the browser, and
// named by the feedback. Author-written wires on the small KORU-shaped record with a design record's condition row and a next-gate
// row; no model quality is claimed. ----
const KORU33 = [KORU32, '5. 조건·거부·분기', '| 부분 이름 | 조건 | 참이면 | 거짓이면 | 꼬리표 |', '|---|---|---|---|---|', '| 엔진 | not 1 <= stop <= 250 | STOP_NOT_RESIDENT | J1 답 | [파일: R] |',
  '9. 다음 관문', '| 부분 이름 | 무엇이 확인되면 | 무엇을 한다 | 언제쯤 |', '|---|---|---|---|', '| 엔진 | 끄기 줄 결판 또는 −8 USDT | 해당 칸을 끈다 | 수시 [보고] |'].join('\n');
const signs33 = c => [c.scope ?? null, c.scopeName ?? null, (c.anchors ?? []).map(a => [a.kind, a.text]), (c.enforcedBy ?? []).map(e => [e.kind, e.text]), c.withdrawalKind ?? null, c.gate ?? null];
const SIGN_CATEGORIES = ['scope', 'anchor', 'enforced-by', 'withdrawal-kind', 'gate'];
function koru33(f) {
  const fragments = koruFragments(f), global = { ...koruGlobal(f) };
  fragments[0].parts[0].claims.splice(1, 1); fragments[1].parts[0].config = ['레버리지 20']; global.relations = [global.relations[1], global.relations[2]];
  const engine = fragments[1].parts[0], claim = (key, head, extra) => ({ key, kind: 'describes', text: `원문 행의 규칙을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null, ...extra });
  Object.assign(engine.claims[0], { text: '매일 FLAT 재시작은 채택하지 않는다.', withdrawalKind: 'design' });
  engine.claims.push(
    claim('s103', '| 엔진 | 돈 안전', { topic: 'rule', scope: 'phase', anchors: [{ kind: 'stated', text: '엔진 · not 1 <= stop <= 250', at: f.at('| 엔진 | not 1') }, { kind: 'stated', text: '없는 줄', at: 'N01.99' }],
      enforcedBy: [{ kind: 'code', text: 'STOP_NOT_RESIDENT', at: f.at('| 엔진 | not 1') }, { kind: 'unknown', text: '장치 미상', at: null }] }),
    claim('s104', '| 엔진 | 끄기', { kind: 'want', topic: 'plan', gate: 'ops' }),
    claim('s105', '| 엔진 | 게이트는', { topic: 'rule', scope: 'part', enforcedBy: [{ kind: 'gate', text: 'TESTS rc 0 + VERIFY GO', at: f.at('| 엔진 | 게이트는') }] }),
    // .39: a run gate names its threshold or operating state (the row's 「−8 USDT」).
    claim('s106', '| 엔진 | 끄기', { kind: 'want', topic: 'plan', gate: 'run', text: '끄기 줄이 결판나거나 −8 USDT이면 해당 칸을 끈다.' }));
  return { fragments, global };
}

test('.33: a wrong scope, place, device or gate is set aside alone on the combined wire; the claim stays and plain map.6 reads the same reply', () => {
  const f = koruText(KORU33), plan = koruPlan(f), groups = splitBlueprintParts(plan), { fragments, global } = koru33(f);
  const before = structuredClone({ fragments, global }), { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual({ fragments, global }, before, 'inputs are never changed');
  assert.deepEqual(exclusions.map(x => [x.path, x.rule, x.category]), [['parts[3].claims[2].scope', 'contract', 'scope'], ['parts[3].claims[2].anchors[1]', 'contract', 'anchor'],
    ['parts[3].claims[2].enforcedBy[1]', 'contract', 'enforced-by'], ['parts[3].claims[3].gate', 'contract', 'gate']]);
  assert.match(exclusions[1].explanation, /적용 위치 미해결/); assert.match(exclusions[2].explanation, /보장 위치는 미확인/);
  // Only the set-aside items are out: the scope is written null, the place and the device left out at their index, the gate null.
  const engine = wire.parts[3];
  assert.deepEqual(engine.claims.map(c => c.key), ['s101', 's102', 's103', 's104', 's105', 's106']);
  assert.deepEqual(engine.claims.map(signs33), [[null, null, [], [], 'design', null], [null, null, [], [], null, null],
    [null, null, [['stated', '엔진 · not 1 <= stop <= 250']], [['code', 'STOP_NOT_RESIDENT']], null, null], [null, null, [], [], null, null],
    ['part', null, [], [['gate', 'TESTS rc 0 + VERIFY GO']], null, null], [null, null, [], [], null, 'run']]);
  assert.deepEqual(engine.claims[0], { ...fragments[1].parts[0].claims[0] }, 'a claim with nothing set aside is untouched');
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  // .35: the wire keeps the reply's words; the reading takes the place as inferred (its line is the condition row, not the rule's own,
  // and the rule row writes none of its cells) and says so.
  const inferred = engine.claims.map(signs33); inferred[2][2] = [['inferred', '엔진 · not 1 <= stop <= 250']];
  assert.deepEqual(plain.parts[3].claims.map(signs33), inferred);
  assert.deepEqual(M.anchorDowngrades(plain), [{ ref: 'new:engine', key: 's103', text: '엔진 · not 1 <= stop <= 250' }]);
  M.attachExclusions(plain, exclusions, f.ask);
  const applied = M.applyReading(f.project, f.input, plain, meta30('R_koru33'));
  const engineId = applied.reading.parts[3].areaId, u = M.partUnderstanding(applied.project, engineId);
  assert.deepEqual([applied.reading.version, applied.reading.exclusions.map(x => x.path)], ['map-reading.19', exclusions.map(x => x.path)]);
  assert.deepEqual([u.rules.map(c => [c.scope, c.anchors.length, c.enforcedBy.map(e => e.kind)]), u.withdrawals.map(c => c.withdrawalKind), u.gates.map(c => c.gate)],
    [[['part', 0, ['gate']], [null, 1, ['code']]], ['design'], ['run']]);
  assert.deepEqual(validateProject(applied.project), applied.project);
  // A first map's first pass sets them aside (no refusal); the stage keeps which.
  const own1 = ownRows(f, fragments[1]);
  assert.deepEqual(validateRenderedFragment(own1, groups[1], f.ask, plan, true), own1);
  assert.deepEqual(fragmentSetAside(fragments[1], groups[1], f.ask, plan).map(x => [x.path, x.category]), [['parts[0].claims[2].scope', 'scope'], ['parts[0].claims[2].anchors[1]', 'anchor'],
    ['parts[0].claims[2].enforcedBy[1]', 'enforced-by'], ['parts[0].claims[3].gate', 'gate']]);
  // A list left out whole, a field off its topic and a withdrawal kind outside its words are written null on the wire.
  const whole = structuredClone(fragments); const [w0, w1, w2] = whole[1].parts[0].claims;
  Object.assign(w0, { withdrawalKind: 'policy' }); Object.assign(w1, { anchors: [{ kind: 'stated', text: '연결', at: f.at('| 카드 러너 | 엔진 |') }], gate: 'run' }); w2.enforcedBy = 'x';
  const out = combineRenderedReading(whole, global, f.ask, plan);
  assert.deepEqual(out.exclusions.map(x => [x.path, x.category]).slice(0, 5), [['parts[3].claims[0].withdrawalKind', 'withdrawal-kind'], ['parts[3].claims[1].anchors', 'anchor'],
    ['parts[3].claims[1].gate', 'gate'], ['parts[3].claims[2].scope', 'scope'], ['parts[3].claims[2].anchors[1]', 'anchor']]);
  assert.deepEqual(out.exclusions.map(x => x.path).slice(5), ['parts[3].claims[2].enforcedBy', 'parts[3].claims[3].gate']);
  assert.deepEqual(out.wire.parts[3].claims.slice(0, 3).map(signs33), [[null, null, [], [], null, null], [null, null, [], [], null, null], [null, null, [['stated', '엔진 · not 1 <= stop <= 250']], [], null, null]]);
  assert.equal(M.setAside(M.validateMapReply(out.wire, f.ask)).length, 0);
});

test('.33 feedback: a rule\'s scope, places and devices, a withdrawal\'s kind and a gate are named by their own bounds; a later map refuses its first pass for them', () => {
  const f = koruText(KORU33), { fragments } = koru33(f), signs = list => list.filter(x => SIGN_CATEGORIES.includes(x.category) || /\.(anchors|enforcedBy)$/.test(x.path)).map(x => [x.path, x.rule, x.category ?? null, x.expected ?? null, x.actual ?? null]);
  assert.deepEqual(signs(mapStageIssues(fragments[1])), [['parts[0].claims[2].scope', 'contract', 'scope', null, null], ['parts[0].claims[3].gate', 'contract', 'gate', null, null]]);
  const bad = structuredClone(fragments[1]), [c0, c1, c2, , c4] = bad.parts[0].claims;
  c0.withdrawalKind = 'policy'; c1.withdrawalKind = 'design'; c1.anchors = [{ kind: 'stated', text: '연결', at: f.at('| 카드 러너 | 엔진 |') }]; c1.anchors.length = 1;
  Object.assign(c2, { scope: 'step', scopeName: null, anchors: Array(5).fill(c2.anchors[0]), enforcedBy: [{ kind: 'code', text: 'X', at: null }, { kind: 'unknown', text: '장치 미상' }, { kind: 'auto', text: 'Y', at: f.at('| 엔진 | not 1') }] });
  c4.enforcedBy = 'x';
  assert.deepEqual(signs(mapStageIssues(bad)), [['parts[0].claims[0].withdrawalKind', 'contract', 'withdrawal-kind', null, null], ['parts[0].claims[1].anchors', 'contract', 'anchor', null, null],
    ['parts[0].claims[1].withdrawalKind', 'contract', 'withdrawal-kind', null, null], ['parts[0].claims[2].scope', 'contract', 'scope', null, null], ['parts[0].claims[2].anchors', 'count', null, 4, 5],
    ['parts[0].claims[2].enforcedBy[0]', 'contract', 'enforced-by', null, null], ['parts[0].claims[2].enforcedBy[2]', 'contract', 'enforced-by', null, null],
    ['parts[0].claims[3].gate', 'contract', 'gate', null, null], ['parts[0].claims[4].enforcedBy', 'contract', 'enforced-by', null, null]]);
  // Empty lists and nulls on a claim of another topic are not said and are never named.
  const quiet = structuredClone(fragments[1]); Object.assign(quiet.parts[0].claims[1], { scope: null, scopeName: null, anchors: [], enforcedBy: [], withdrawalKind: null, gate: null });
  quiet.parts[0].claims[2].scope = 'part'; quiet.parts[0].claims[3].gate = 'dev';
  assert.deepEqual(signs(mapStageIssues(quiet)), []);
  // A later map (map.7) still refuses its first pass for such a field, so its one correction rewrites it.
  const later = fixture(1), laterPlan = planned(later, 2), laterFragments = rendered(later, laterPlan), group = splitBlueprintParts(laterPlan)[0];
  Object.assign(laterFragments[0].parts[0].claims[0], { topic: 'rule', anchors: [{ kind: 'stated', text: '없는 줄', at: 'N01.99' }] });
  validateRenderedFragment(laterFragments[0], group, later.ask, laterPlan);
  let failure; try { validateRenderedFragment(laterFragments[0], group, later.ask, laterPlan, true); } catch (error) { failure = error; }
  assert.deepEqual(failure?.validation, { path: 'parts[0].claims[0].anchors[0]', rule: 'contract', category: 'anchor' });
  Object.assign(laterFragments[0].parts[0].claims[0], { anchors: [], gate: 'run' });
  failure = null; try { validateRenderedFragment(laterFragments[0], group, later.ask, laterPlan, true); } catch (error) { failure = error; }
  assert.deepEqual(failure?.validation, { path: 'parts[0].claims[0].gate', rule: 'contract', category: 'gate' });
});

test('.33: an input or output that is a store partner\'s field or a bare prefix of another item is set aside alone; a claim inside a step\'s does or the role is restate', () => {
  const f = koru(), plan = koruPlan(f), fragments = koruFragments(f), global = { ...koruGlobal(f) };
  fragments[0].parts[0].claims.splice(1, 1); fragments[1].parts[0].config = ['레버리지 20']; global.relations = [global.relations[1], global.relations[2]];
  // The card runner writes review.jsonl (its store partner, fields watch·allowed_side); the engine reads it.
  Object.assign(fragments[0].parts[0], { outputs: ['review 행', 'review', 'allowed_side', ' review '] });
  const engine = fragments[1].parts[0];
  Object.assign(engine, { inputs: ['review.jsonl 행', 'review.jsonl', 'kill 파일'], steps: [{ name: 'review 읽기', does: '마지막 행·나이를 본다', at: f.at('| 엔진 | 루프') }] });
  engine.claims.push({ key: 's103', kind: 'describes', text: '마지막 행·나이를 본다.', at: f.at('| 엔진 | 루프'), about: null, replaces: null },
    { key: 's104', kind: 'describes', text: '엔진의 책임', at: f.at('| 엔진 | 루프'), about: null, replaces: null },
    { key: 's105', kind: 'describes', text: '행 셋으로 주문한다.', at: f.at('| 엔진 | 루프'), about: null, replaces: null });
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  // The program's reading of a part's claims (restate) comes first, the lists after the lines are read (every raw copy of a name).
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['parts[3].claims[2]', 'restate'], ['parts[3].claims[3]', 'restate'], ['parts[0].outputs[1]', 'outputs'],
    ['parts[0].outputs[2]', 'outputs'], ['parts[0].outputs[3]', 'outputs'], ['parts[3].inputs[1]', 'inputs']]);
  assert.match(exclusions.find(x => x.path === 'parts[0].outputs[2]').explanation, /짝 저장소의 필드/);
  assert.match(exclusions.find(x => x.path === 'parts[3].claims[2]').explanation, /단계·역할 문장을 되풀이한 주장/);
  assert.deepEqual([wire.parts[0].outputs, wire.parts[3].inputs, wire.parts[3].claims.map(c => c.key)], [['review 행'], ['review.jsonl 행', 'kill 파일'], ['s101', 's102', 's105']]);
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  M.attachExclusions(plain, exclusions, f.ask);
  assert.deepEqual(validateProject(M.applyReading(f.project, f.input, plain, meta30('R_koru33_io')).project).readings.at(-1).exclusions.length, 6);
  // The store's own fields stay; a part with no store partner keeps a field-like name; plain map.6 never reads these checks.
  assert.deepEqual(wire.parts[1].fields, ['watch', 'allowed_side']);
  const lone = structuredClone(fragments); lone[0].parts[2].inputs = ['allowed_side'];
  assert.deepEqual(combineRenderedReading(lone, global, f.ask, plan).wire.parts[2].inputs, ['allowed_side'], 'the mood layer has no line to the store');
  const raw = structuredClone(wire); raw.parts[0].outputs = ['review 행', 'review'];
  assert.deepEqual(M.validateMapReply(raw, f.ask).parts[0].outputs, ['review 행', 'review']);
  // .33: the lines a global stage left out, as its first pass is refused for them (the connection row 기분 층 → 엔진, undrawn here).
  assert.deepEqual(missingLines(fragments, global, f.ask, plan), [{ path: 'relations', rule: 'connections', expected: 2, actual: 1, names: ['기분 층 → 엔진'] }]);
  assert.deepEqual(missingLines(fragments, { reviseParts: ['new:engine'], reason: 'x', at: [f.at('| 엔진 | 루프')] }, f.ask, plan), []);
});

// ---- first-map-divided.34 (from the blind judging of the .33 KORU map: 카드 러너 held ten claims of twenty and lost four condition
// rows, ARM its [모름] step, with no exclusion and no diagnostic): a first map's render first pass leaving unquoted a plan item of a
// part under its cap is refused for its one correction (plan-claims names it); at the cap the diagnostic stays alone. ----
test('.34: a render first pass that leaves a plan item of a part under twenty claims unquoted is refused for its one correction; at the cap only the diagnostic names it', () => {
  const f = koruText(KORU32), plan = plan32(f), groups = splitBlueprintParts(plan), fragments = koruFragments(f);
  fragments[1].parts[0].config = ['레버리지 20'];
  const engine = fragments[1].parts[0], missing = ['new:engine: 엔진 | 돈 안전 = 보유 중 스탑 상주 하나 | 소유자 10-22 [보고]',
    'new:engine: 엔진 | 게이트는 코드: TESTS rc 0 + VERIFY GO | 감독자 09-26 [보고]', 'new:engine: 엔진 | 08:49Z 뒤 실제 상태 | STATUS 첫 줄',
    // .35: and the engine's own hedge row, a unit by its name.
    'new:engine: 엔진 | 「돌고 있음」은 인용이고, 08:49Z 뒤는 직접 보지 않음 [추정]'];
  const read = value => { const projected = structuredClone(value); for (const part of projected.parts) part.parent = null; return M.validateMapReply(projected, f.ask, { setAside: true, owners: plan.parts.map(p => p.name) }); };
  // The engine holds two claims of twenty and quotes none of its three plan rows: the first pass is refused, the correction is read.
  assert.deepEqual(planShort(f.ask, plan, fragments[1].parts, read(fragments[1])), missing);
  refused(() => validateRenderedFragment(fragments[1], groups[1], f.ask, plan, true));
  assert.deepEqual(validateRenderedFragment(fragments[1], groups[1], f.ask, plan), fragments[1], 'the correction\'s reply is taken as it is');
  const issues = mapStageIssues(fragments[1], null, { ask: f.ask, fragment: true, blueprint: plan }).filter(x => x.rule === 'plan-claims');
  assert.deepEqual(issues.map(x => x.names), [missing], 'the correction hears the items by name');
  // A fragment whose parts quote their plan rows passes its first pass (the card runner's fragment).
  assert.deepEqual(validateRenderedFragment(fragments[0], groups[0], f.ask, plan, true), fragments[0]);
  // Once a row is quoted it is no longer named; with every row quoted the first pass passes.
  const quoting = structuredClone(fragments[1]), claim = (key, head) => ({ key, kind: 'reported', text: `원문 행을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null });
  quoting.parts[0].claims.push(claim('s103', '| 엔진 | 돈 안전'), claim('s104', '| 엔진 | 게이트는'));
  assert.deepEqual(planShort(f.ask, plan, quoting.parts, read(quoting)), [missing[2], missing[3]]);
  quoting.parts[0].claims.push({ ...claim('s105', '| 엔진 | 08:49Z'), topic: 'unknown' });
  assert.deepEqual(planShort(f.ask, plan, quoting.parts, read(quoting)), [missing[3]]);
  quoting.parts[0].claims.push({ ...claim('s106', '| 엔진 | 「돌고'), topic: 'unknown' });
  assert.deepEqual(validateRenderedFragment(quoting, groups[1], f.ask, plan, true), quoting);
  // At the cap (twenty claims read) the first pass passes and the diagnostic still names what is missing.
  const full = structuredClone(fragments[1]);
  for (let k = full.parts[0].claims.length; k < M.MAP6_CLAIMS; k++) full.parts[0].claims.push(claim(`s${101 + k}`, '| 카드 러너 | 엔진 |'));
  assert.equal(read(full).parts[0].claims.length, M.MAP6_CLAIMS);
  assert.deepEqual(planShort(f.ask, plan, full.parts, read(full)), []);
  assert.deepEqual(validateRenderedFragment(full, groups[1], f.ask, plan, true), full);
  assert.deepEqual(mapStageIssues(full, null, { ask: f.ask, fragment: true, blueprint: plan }).find(x => x.rule === 'plan-claims')?.names, missing);
  // A later map (map.7) keeps its own first pass: no plan-claims refusal.
  const later = fixture(1), laterPlan = planned(later, 2), laterFragments = rendered(later, laterPlan);
  laterPlan.global.push({ kind: 'condition', text: '조건 → new:p1', at: [later.at[5]] });
  assert.deepEqual(validateRenderedFragment(laterFragments[0], splitBlueprintParts(laterPlan)[0], later.ask, laterPlan, true), laterFragments[0]);
});

// ---- first-map-divided.35 (from the .34 run and the .33/.34 judging): a part's own rows are plan-claims units by its name, the
// render trigger leaves out a row another plan part owns, a stated place off the rule's own row is read inferred, the program's places
// read the part's file-map rows and settings cell, a bare io prefix of a design-cell item or a line's payload name is set aside, a
// status claim on a connection row a relation quotes is restate, and a part that repeats by its rows with no loop is named. The rows
// below are the real KORU records' rows (koru-orch-design-v1 §3-§6 and koru-orch-v3 §2-§7), copied as written; no model quality is
// claimed. ----
const DESIGN35 = ['KORU 설계 기록 v1 (검토 세션, 2026-11-03 09:xxZ; 코드는 git show로 라이브 sha를 읽음)',
  '3. 부분별 설계', '| 이름 | 받는 산출물 | 안의 단계 | 내는 산출물 | 설정 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| 엔진 | review·policy·state 행, 패킷 | 4절 | J1 답 → 주문 | 618df374, 레버리지 20, 동시 1, j1_cadence 60 s | [파일: R] |',
  '| 카드 러너 | 패킷 원천·plan·facts·posture | 4절 | cards·counter·review 행·LEDGER | 타이머 tick :00·dispatch :05·gate 01/16/31/46분 :02 | [파일: C/systemd/*.timer] |',
  '| ARM | precheck | [모름] | e=1.00 행 | 24 h 만료 | [보고: ops 세션 STATUS 11-03 07:27Z] |',
  '4. 안의 단계', '| 부분 이름 | 순번 | 단계 이름 | 하는 일 한 줄 | 쓰는 파일·함수·모델 | 조건·분기 | 꼬리표 |', '|---|---|---|---|---|---|---|',
  '| 엔진 | 10 | 집행 | 주문·HARD 상주 | engine.py(이번에 안 읽음) | [모름] | [모름] |',
  '| 카드 러너 | 4 | 팔 반복 | CX·CL·DS 각각 | ARMS | 팔당 16회/일 넘으면 DAILY_CAP | [파일: C/card_runner.py] |',
  '| 카드 러너 | 11 | tick | 매분 checkpoint·kill·만료·trigger·pull | tick·checkpoint·kill·pull_due | KILL/EXPIRED → review 갱신 | [파일: C/card_runner.py] |',
  '5. 조건·거부·분기', '| 부분 이름 | 조건 | 참이면 | 거짓이면 | 꼬리표 |', '|---|---|---|---|---|',
  '| 엔진 | not 1 <= stop <= 250 | STOP_NOT_RESIDENT | J1 답 | [파일: R] |',
  "| 카드 러너 | arm!='CX' or review_writer is not True | 카드 행만 | review 행도 씀 | [파일: C/card_runner.py] |",
  "| 카드 러너 | expiry<=stamp and side!='NONE' | REVIEW_EXPIRED_DIRECTION | NONE이면 30분 연장 | [파일: C/card_runner.py] |",
  '| 카드 러너 | not stamp+900000<=cp<=stamp+5400000 | CHECKPOINT_TIME | 다음 | [파일: C/card_runner.py] |',
  "| 카드 러너 | watch=='OFF'이고 그 시각에 TRADING_RESTRICTION 사건 없음 | INVALID | 다음 | [파일: C/card_runner.py] |",
  '6. 파일 지도', '| 경로 | 속한 부분 | 역할 한 줄 | 꼬리표 |', '|---|---|---|---|',
  '| C/calls.py | 카드 러너 | 모델 호출·지출 상한 CL 20·DS 5 USD | [파일: C/calls.py] |'].join('\n');
const STATUS35 = ['KORU 프로젝트 현황 보고서 (v3 표 형식, 검토 세션 작성, 2026-11-03 09:0xZ 기준)',
  '2. 부분', '| 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태 단어 | 상태의 기준 시각 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| 소유자 | 지시 한 줄·잔고 입출금으로 노출 조절·전원 관리 | — | 돌고 있음 | 11-03 07:1xZ | [보고: 감독자 세션 SUPERVISOR-LOG 11-03 07:13Z] |',
  '| 엔진 | 행 셋 합성 → J1 → 집행자 하나 → 주문·TP·HARD | koru-wt/d4/code/exec/live_direct/ (라이브 sha 618df374) | 돌고 있음 | 11-03 08:49Z | [보고: ops 세션 STATUS 11-03 08:49Z] |',
  '| ARM | e=1.00 노출 행 서명·24 h 만료 | 미니PC desk-redeploy·arm-loop | 돌고 있음 | 11-03 07:27Z | [보고: ops 세션 STATUS 11-03 07:27Z] |',
  '| 카드 러너 | 패킷 → 반대편 → 세 팔 카드 → review 행 | koru-hold/BUILD6/WORK/OPS/cardrunner/ (sha 2 5d31b880) | 돌고 있음 | 11-03 07:33Z | [보고: 감독자 세션 SUPERVISOR-LOG 11-03 07:33Z] |',
  '| 성적표 | 하루 장(읽기용, 판정 아님) | koru-hold/BUILD6/WORK/OPS/scorecard/·daysheet/ | 돌고 있음 | 11-03 07:33Z | [보고: 감독자 세션 SUPERVISOR-LOG 11-03 07:33Z] |',
  '4. 연결', '| 보내는 부분 | 받는 부분 | 넘기는 것 | 언제·얼마나 자주 | 설계/관찰 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| 카드 러너 | 엔진 | review.jsonl watch·allowed_side·valid_until | K 23:37Z·U 14:07Z·GAP 06:35Z/21:05Z·깨우기 | 관찰 | [보고: 감독자 세션 SUPERVISOR-LOG 11-02 14:14Z] |',
  '| 엔진 | 성적표 | journal·outcomes 경주 행 | 매일 02:15Z | 관찰 | [보고: 감독자 세션 SUPERVISOR-LOG 11-03 00:13Z] |',
  '6. 철회·변경', '| 부분 이름 | 옛 결정 | 지금 | 근거·날짜 |', '|---|---|---|---|',
  '| 카드 러너 | 일일 가드 CL 1.50·DS 0.40 | 철회(코드 상한과 같음) | [보고: 감독자 세션 SUPERVISOR-LOG 10-31 23:04Z] |',
  '7. 지켜야 할 것과 하지 않기로 한 것', '| 부분 이름 | 규칙 한 줄 | 누가 정했나·언제 |', '|---|---|---|',
  '| 엔진 | 돈 안전 = 보유 중 스탑 상주 하나, 게이트는 스탑·크기·방향만 | 소유자 10-22 [보고: 메모리 색인] |',
  '| ARM | 노출은 잔고로만, e=1.00 고정 | 소유자 10-18 [보고: 메모리 색인] |',
  '| 카드 러너 | 지출은 상한 있게, 감독자 세션 승인 | 소유자 10-22 [보고: 메모리 색인] |'].join('\n');
function koru35() {
  let project = D.pasteRecord(D.createProject(), DESIGN35, null).project;
  project = D.pasteRecord(project, STATUS35, null).project;
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records.flatMap(r => r.spans);
  assert.ok(M.firstAsk(input.ask));
  const at = head => { const hit = spans.filter(span => span.t.startsWith(head)); assert.equal(hit.length, 1, head); return hit[0].s; };
  return { project, input, ask: input.ask, at };
}
const plan35 = f => ({ parts: [
  { ref: 'new:owner', name: '소유자', parent: null, at: [f.at('| 소유자 | 지시')], focus: '지시·잔고·전원' },
  { ref: 'new:arm', name: 'ARM', parent: null, at: [f.at('| ARM | e=1.00')], focus: 'e=1.00 노출 행' },
  { ref: 'new:card', name: '카드 러너', parent: null, at: [f.at('| 카드 러너 | 패킷 →')], focus: '세 팔 카드' },
  { ref: 'new:engine', name: '엔진', parent: null, at: [f.at('| 엔진 | 행 셋')], focus: '행 셋 → 주문' },
  { ref: 'new:sheet', name: '성적표', parent: null, at: [f.at('| 성적표 | 하루')], focus: '하루 장' }],
  // The .34 plan gave ARM's rule row to the owner (the first .34 run's wrong-part claim of 소유자).
  global: [{ kind: 'condition', text: '노출은 잔고로만, e=1.00 고정 → new:owner', at: [f.at('| ARM | 노출은')] }] });
function fragments35(f) {
  const claim = (key, head, extra = {}) => ({ key, kind: 'reported', text: `원문 행을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null, ...extra });
  const part = (ref, name, head, claims, extra = {}) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [f.at(head)], claims, ...extra });
  return [{ ...empty(), parts: [
    part('new:owner', '소유자', '| 소유자 | 지시', [claim('s1', '| 소유자 | 지시', { topic: 'status' })]),
    part('new:arm', 'ARM', '| ARM | e=1.00', [claim('s2', '| ARM | e=1.00', { topic: 'status' })], { config: ['24 h 만료'] }),
    part('new:card', '카드 러너', '| 카드 러너 | 패킷 →', [claim('s3', '| 카드 러너 | 일일', { topic: 'withdrawn' }), claim('s4', '| 카드 러너 | 지출', { topic: 'rule' })],
      { config: ['타이머 tick :00', 'dispatch :05', 'gate 01/16/31/46분 :02'] })] },
  { ...empty(), parts: [
    part('new:engine', '엔진', '| 엔진 | 행 셋', [claim('s61', '| 엔진 | 돈 안전', { topic: 'rule' }), claim('s62', '| 엔진 | 10 |', { topic: 'unknown' }), claim('s64', '| 엔진 | not 1', { topic: 'how' })],
      { config: ['레버리지 20', '동시 1', 'j1_cadence 60 s'] }),
    part('new:sheet', '성적표', '| 성적표 | 하루', [claim('s63', '| 성적표 | 하루', { topic: 'status' })])] }];
}
const read35 = (f, plan, value) => { const projected = structuredClone(value); for (const part of projected.parts) part.parent = null; return M.validateMapReply(projected, f.ask, { setAside: true, owners: plan.parts.map(p => p.name) }); };

test('.35 plan-claims: a part\'s own rows count by its name (rules, withdrawals, condition rows, [모름] steps, settings items), each landing on a claim, an anchor, a step, a config item or an exclusion', () => {
  const f = koru35(), plan = plan35(f), groups = splitBlueprintParts(validateMapBlueprint(plan, f.ask)), fragments = fragments35(f);
  const card = ["new:card: 카드 러너 | arm!='CX' or review_writer is not True | 카드 행만 | review 행도 씀 | [파일: C/card_runner.py]",
    "new:card: 카드 러너 | expiry<=stamp and side!='NONE' | REVIEW_EXPIRED_DIRECTION | NONE이면 30분 연장 | [파일: C/card_runner.py]",
    'new:card: 카드 러너 | not stamp+900000<=cp<=stamp+5400000 | CHECKPOINT_TIME | 다음 | [파일: C/card_runner.py]',
    "new:card: 카드 러너 | watch=='OFF'이고 그 시각에 TRADING_RESTRICTION 사건 없음 | INVALID | 다음 | [파일: C/card_runner.py]"];
  const ownerArm = 'new:owner: ARM | 노출은 잔고로만, e=1.00 고정 | 소유자 10-18 [보고: 메모리 색인]';
  const armRule = 'new:arm: ARM | 노출은 잔고로만, e=1.00 고정 | 소유자 10-18 [보고: 메모리 색인]';
  const armStep = 'new:arm: ARM | precheck | [모름] | e=1.00 행 | 24 h 만료 | [보고: ops 세션 STATUS 11-03 07:27Z]';
  const first = planClaims(f.ask, plan, fragments[0].parts);
  // Units of the first fragment: the plan's item (ARM's rule row, given to the owner), ARM's own rule row, its [모름] design row and its
  // one setting, the card runner's withdrawal and rule rows, its four condition rows and its three settings items (the 11 tick step row
  // is no [모름] row and no unit). The card runner's 「팔당 16회/일」 is a step-table cell (not a 설정·상태 cell): no unit.
  assert.equal(first.items, 1 + 3 + 2 + 4 + 3);
  assert.deepEqual(first.missing, [ownerArm, armRule, armStep, ...card]);
  assert.deepEqual(first.missingUnits.map(u => [u.ref, u.trigger]), [['new:owner', false], ['new:arm', true], ['new:arm', true], ...card.map(() => ['new:card', true])]);
  // The render trigger: every missing unit of a part under the cap, but the owner's (its row names ARM, another plan part).
  assert.deepEqual(planShort(f.ask, plan, fragments[0].parts, read35(f, plan, fragments[0])), [armRule, armStep, ...card]);
  refused(() => validateRenderedFragment(fragments[0], groups[0], f.ask, plan, true));
  assert.deepEqual(validateRenderedFragment(fragments[0], groups[0], f.ask, plan), fragments[0], 'the correction\'s reply is taken as it is');
  assert.deepEqual(mapStageIssues(fragments[0], null, { ask: f.ask, fragment: true, blueprint: plan }).find(x => x.rule === 'plan-claims').names, first.missing);
  // Each lands its own way: a rule anchor on a condition row, a step on the [모름] design row, a claim on the rule row, and a claim set
  // aside on a row (here the owner's claim on a card condition row, wrong-part) by its exclusion.
  const landed = structuredClone(fragments[0]), [owner, arm, cardRunner] = landed.parts;
  cardRunner.claims[1].anchors = [{ kind: 'inferred', text: 'review_writer', at: f.at("| 카드 러너 | arm!='CX'") }];
  arm.steps = [{ name: 'precheck', does: null, uses: [], at: f.at('| ARM | precheck') }];
  arm.claims.push({ key: 's5', kind: 'want', text: '노출은 잔고로만 조절하고 e=1.00으로 고정한다.', at: f.at('| ARM | 노출은'), about: null, replaces: null, topic: 'rule' });
  cardRunner.claims.push({ key: 's6', kind: 'describes', text: '만료 방향을 본다.', at: f.at("| 카드 러너 | expiry"), about: null, replaces: null, topic: 'how' },
    { key: 's7', kind: 'describes', text: 'checkpoint 시각을 본다.', at: f.at('| 카드 러너 | not stamp'), about: null, replaces: null, topic: 'how' });
  owner.claims.push({ key: 's8', kind: 'describes', text: 'watch OFF는 INVALID다.', at: f.at("| 카드 러너 | watch=="), about: null, replaces: null, topic: 'how' });
  const read = read35(f, plan, landed);
  // .37: the card runner's withdrawal row says 철회 while its claim leaves the kind null: named on its row (the claim stays).
  assert.deepEqual(M.readingExclusions(read).map(x => [x.path, x.category]), [['parts[0].claims[1]', 'wrong-part'], ['parts[2].claims[0].withdrawalKind', 'withdrawal-kind']]);
  assert.deepEqual(planClaims(f.ask, plan, landed.parts.map(p => p.ref === 'new:owner' ? { ...p, claims: [p.claims[0]] } : p), M.readingExclusions(read)).missing, [], 'the exclusion on the row lands it');
  assert.deepEqual(planShort(f.ask, plan, landed.parts, read), []);
  assert.deepEqual(validateRenderedFragment(landed, groups[0], f.ask, plan, true), landed);
  // A missing setting item is a unit too; a version in the cell never is (the engine's 618df374).
  const unset = structuredClone(fragments[1]); unset.parts[0].config = ['레버리지 20'];
  assert.deepEqual(planClaims(f.ask, plan, unset.parts).missing, ['new:engine: 엔진 | 설정 | 동시 1', 'new:engine: 엔진 | 설정 | j1_cadence 60 s']);
  // The engine's [모름] step row lands on its unknown claim; the 「돈 안전」 rule on its claim.
  assert.deepEqual(planClaims(f.ask, plan, fragments[1].parts).missing, []);
  // Read on the combined wire, the global stage's record names what is still missing (the first fragment as written).
  assert.ok(readingDiagnostics({ ask: f.ask, summary: '', parts: fragments.flatMap(x => x.parts), blueprint: plan }).find(x => x.rule === 'plan-claims').names.includes(armStep));
});

test('.35 loop-missing: a part whose own design or step rows say it repeats (매분, 분마다, 폴링, 간격, tick) while its loop is null is named', () => {
  const f = koru35(), plan = plan35(f), parts = structuredClone(fragments35(f).flatMap(x => x.parts));
  // The step row that says how often (매분) names it before the design row's 「tick :00」, as written up to 120 characters.
  const row = '카드 러너 | 11 | tick | 매분 checkpoint·kill·만료·trigger·pull | tick·checkpoint·kill·pull_due | KILL/EXPIRED → review 갱신 | [파일: C/card_runner.py]';
  // .36: the engine's settings cell (j1_cadence 60 s) says how often it runs. .37: the program fills that loop when the wire is read
  // (programLoop: the setting stands in its own design row's 설정 cell), so it is no longer named; the card runner's 매분 row still is.
  assert.deepEqual(loopRows(f.ask, parts), { rows: 2, missing: [`카드 러너: ${row.slice(0, 120)}`] });
  assert.deepEqual(M.programLoop(f.ask, parts.find(p => p.ref === 'new:engine')), { unit: 'j1_cadence 60 s', at: f.at('| 엔진 | review') });
  assert.deepEqual(readingDiagnostics({ ask: f.ask, summary: '', parts, blueprint: plan }).find(x => x.rule === 'loop-missing'),
    { path: 'parts', rule: 'loop-missing', expected: 2, actual: 1, names: loopRows(f.ask, parts).missing });
  parts.find(p => p.ref === 'new:card').loop = { unit: '매분 tick', stop: null, resume: null, at: f.at('| 카드 러너 | 11') };
  parts.find(p => p.ref === 'new:engine').loop = { unit: '60 s', stop: null, resume: null, at: f.at('| 엔진 | review') };
  assert.deepEqual(loopRows(f.ask, parts), { rows: 2, missing: [] });
  // A render correction hears it for its own parts.
  const fragment = fragments35(f)[0];
  assert.deepEqual(mapStageIssues(fragment, null, { ask: f.ask, fragment: true, blueprint: plan }).find(x => x.rule === 'loop-missing')?.actual, 0);
});

test('.35 places: a stated place stays stated on the rule\'s own row or where the rule row writes its cell, else it is read inferred and named; the program also reads the file-map row and the settings cell', () => {
  const f = koru35(), plan = plan35(f), fragments = fragments35(f);
  const engine = fragments[1].parts[0], cardRunner = fragments[0].parts[2];
  // The .34 run's s129: the money rule placed stated on the STOP_NOT_RESIDENT row, which its own row does not write.
  engine.claims[0].anchors = [{ kind: 'stated', text: '엔진 · not 1 <= stop <= 250', at: f.at('| 엔진 | not 1') }, { kind: 'stated', text: '돈 안전 행', at: f.at('| 엔진 | 돈 안전') }];
  const global = { ...empty(), summary: '엔진은 돌고 있다.' };
  const { wire } = combineRenderedReading(fragments, global, f.ask, plan), read = M.validateMapReply(wire, f.ask);
  const places = c => (c.anchors ?? []).map(a => [a.kind, a.text, a.program === true]);
  const engineRead = read.parts.find(p => p.ref === 'new:engine'), cardRead = read.parts.find(p => p.ref === 'new:card');
  assert.deepEqual(places(engineRead.claims[0]), [['inferred', '엔진 · not 1 <= stop <= 250', false], ['stated', '돈 안전 행', false]]);
  assert.deepEqual(M.anchorDowngrades(read), [{ ref: 'new:engine', key: 's61', text: '엔진 · not 1 <= stop <= 250' }]);
  assert.deepEqual(wire.parts.find(p => p.ref === 'new:engine').claims[0].anchors[0].kind, 'stated', 'the wire keeps the reply\'s word');
  assert.deepEqual(finalDiagnostics(fragments, global, f.ask, plan).find(x => x.rule === 'anchor-kind'), { path: 'parts', rule: 'anchor-kind', expected: null, actual: 1, names: ['new:engine s61: 엔진 · not 1 <= stop <= 250'] });
  // The spending rule (the .34 run's s154, anchors 0): the program places it on the card runner's file-map row C/calls.py.
  assert.deepEqual(places(cardRead.claims[1]), [['inferred', 'C/calls.py', true]]);
  assert.equal(cardRead.claims[1].anchors[0].quote.quote, '| C/calls.py | 카드 러너 | 모델 호출·지출 상한 CL 20·DS 5 USD | [파일: C/calls.py] |');
  // A rule sharing two words with the settings cell (dispatch, gate) is placed there too, after the file-map row (the record's order).
  const beats = structuredClone(fragments);
  beats[0].parts[2].claims.push({ key: 's11', kind: 'want', text: 'dispatch와 gate 박자를 지킨다.', at: f.at('| 카드 러너 | 지출'), about: null, replaces: null, topic: 'rule' });
  const beatsRead = M.validateMapReply(combineRenderedReading(beats, global, f.ask, plan).wire, f.ask).parts.find(p => p.ref === 'new:card');
  assert.deepEqual(places(beatsRead.claims.at(-1)), [['inferred', 'C/calls.py', true], ['inferred', '타이머 tick :00·dispatch :05·gate 01/16/31/46분 :02', true]]);
});

test('.35 places: a rule row that writes a cell of the place row word for word keeps the place stated', () => {
  const f = koruText(['7. 지켜야 할 것과 하지 않기로 한 것', '| 부분 이름 | 규칙 한 줄 | 누가 정했나·언제 |', '|---|---|---|',
    '| 엔진 | 스탑이 없으면 STOP_NOT_RESIDENT로 쉰다 | 소유자 10-22 [보고] |', '| 엔진 | 동시 1 | 소유자 10-22 [보고] |',
    '5. 조건·거부·분기', '| 부분 이름 | 조건 | 참이면 | 거짓이면 | 꼬리표 |', '|---|---|---|---|---|', '| 엔진 | not 1 <= stop <= 250 | STOP_NOT_RESIDENT | J1 답 | [파일: R] |'].join('\n'));
  const rule = (key, head) => ({ key, kind: 'want', text: '규칙을 옮긴다.', at: f.at(head), about: null, replaces: null, topic: 'rule', anchors: [{ kind: 'stated', text: 'not 1 <= stop <= 250', at: f.at('| 엔진 | not 1') }] });
  const reply = { ...empty(), parts: [{ ref: 'new:engine', name: '엔진', parent: null, role: '엔진의 책임', roleAbout: null, roleReplaces: null, basis: [f.at('| 엔진 | 스탑이')],
    claims: [rule('s1', '| 엔진 | 스탑이'), rule('s2', '| 엔진 | 동시 1')] }] };
  const read = M.validateMapReply(reply, f.ask);
  assert.deepEqual(read.parts[0].claims.map(c => c.anchors.map(a => a.kind)), [['stated'], ['inferred']]);
  assert.deepEqual(M.anchorDowngrades(read), [{ ref: 'new:engine', key: 's2', text: 'not 1 <= stop <= 250' }]);
});

test('.35 io and restate: a bare prefix of an item of the part\'s own design cell (a shared noun on every 「·」 item) or of a line\'s payload name is set aside alone; a status claim on a connection row a relation quotes is restate', () => {
  const f = koru35(), plan = plan35(f), fragments = fragments35(f), engine = fragments[1].parts[0], cardRunner = fragments[0].parts[2];
  assert.deepEqual(M.sharedItems('review·policy·state 행, 패킷'), ['review 행', 'policy 행', 'state 행', '패킷']);
  // .38: a two-word unit phrase is shared whole.
  assert.deepEqual(M.sharedItems('journal·outcomes 경주 행'), ['journal 경주 행', 'outcomes 경주 행']);
  assert.deepEqual(M.sharedItems('원자료·σ·runner cards'), ['원자료', 'σ', 'runner cards'], 'a Latin tail belongs to the last name');
  assert.deepEqual(M.sharedItems('달력·지난 24 h LEDGER'), ['달력', '지난 24 h LEDGER']);
  assert.deepEqual(M.sharedItems('cards·counter·review 행·LEDGER'), ['cards', 'counter', 'review 행', 'LEDGER']);
  // The .34 engine: 「review」「policy」 of 「review·policy·state 행」 go; 「state 행」 and 「패킷」 stay. .37: its 「journal」 out to the
  // scorecard is a bare prefix of the line's first item again (.38: 「journal 경주 행」, the shared phrase whole) and goes.
  Object.assign(engine, { inputs: ['review', 'policy', 'state 행', '패킷'], outputs: ['J1 답 → 주문', 'journal'] });
  // The card runner's own cell items stay, a payload name they begin notwithstanding (plan of 「plan.jsonl …」 would not refuse it).
  Object.assign(cardRunner, { inputs: ['패킷 원천', 'plan', 'facts', 'posture'], outputs: ['cards', 'counter', 'review 행', 'LEDGER'] });
  // The card runner's status claim on its 연결 row says the line again; a change claim on the same row stays.
  cardRunner.claims.push({ key: 's9', kind: 'reported', text: 'review.jsonl의 watch·allowed_side·valid_until을 엔진에 넘긴다고 보고됐다.', at: f.at('| 카드 러너 | 엔진'), about: null, replaces: null, topic: 'status' },
    { key: 's10', kind: 'reported', text: '깨우기 박자가 더해졌다고 보고됐다.', at: f.at('| 카드 러너 | 엔진'), about: null, replaces: null, topic: 'change' });
  const global = { ...empty(), summary: '엔진은 돌고 있다.', relations: [
    { from: 'new:card', to: 'new:engine', kind: 'flow', note: '', at: f.at('| 카드 러너 | 엔진'), payload: 'review.jsonl watch·allowed_side·valid_until', mode: 'observed' },
    { from: 'new:engine', to: 'new:sheet', kind: 'flow', note: '', at: f.at('| 엔진 | 성적표'), payload: 'journal·outcomes 경주 행', mode: 'observed' }] };
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.category]).filter(([, c]) => ['inputs', 'outputs', 'restate'].includes(c)),
    [['parts[3].inputs[0]', 'inputs'], ['parts[3].inputs[1]', 'inputs'], ['parts[3].outputs[1]', 'outputs'], ['parts[2].claims[2]', 'restate']]);
  const engineOut = wire.parts.find(p => p.ref === 'new:engine'), cardOut = wire.parts.find(p => p.ref === 'new:card');
  assert.deepEqual([engineOut.inputs, engineOut.outputs], [['state 행', '패킷'], ['J1 답 → 주문']]);
  assert.deepEqual([cardOut.inputs, cardOut.outputs], [['패킷 원천', 'plan', 'facts', 'posture'], ['cards', 'counter', 'review 행', 'LEDGER']]);
  assert.deepEqual(cardOut.claims.map(c => c.key), ['s3', 's4', 's10']);
  assert.equal(M.setAside(M.validateMapReply(wire, f.ask)).length, 0);
  // Without the relation quoting the row, the status claim stays (nothing else says the line).
  assert.ok(combineRenderedReading(fragments, { ...global, relations: [global.relations[1]] }, f.ask, plan).wire.parts.find(p => p.ref === 'new:card').claims.some(c => c.key === 's9'));
});

// ---- first-map-divided.36 (map-reading.12, from the blind judging of the .35 maps: the web app's stores split per artifact row, its
// self-written stores left without a line, its HTTP lines read as control, a resume sentence as a loop unit and a retired timer's loop;
// the KORU engine's condition rows spending the claim cap, owner → ARM on a part row and the shared noun over-applied). The rows below
// are the real rows of both test sets (webapp-design-v1 §1-§5 and webapp-status-v3 §2 and §4; koru-orch-design-v1 §2-§5, koru-orch-v3
// §2 and §4 and the KORU record's flow line), copied as written; no model quality is claimed. ----
const WEB36_DESIGN = ['모아배송 설계 기록 v1 (검토 세션, 2026-11-04 02:0xZ; 코드는 git show로 라이브 sha 3e9a1c07을 읽음)',
  '1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|',
  '| 주문 API | 루프·엔진 | 요청마다 처리하는 express 서버 [파일: A/server.ts] |',
  '| 결제 웹훅 수신기 | 계산 | 서명 검사·상태 갱신·발행 [파일: H] |',
  '| 관리자 세션 | 행 파일·저장소 | Redis admin:sess:* [파일: A/lib/session.ts] |',
  '| orders 테이블 | 행 파일·저장소 | Postgres orders와 딸린 표 [파일: M/] |',
  '| events 큐 | 행 파일·저장소 | Redis 스트림 events·events:dlq [파일: A/lib/queue.ts] |',
  '| 작업자 | 루프·엔진 | 소비자 그룹 workers [파일: W/consume.ts] |',
  '| 택배 추적 수집기 | 수집기 | 600 s 주기 추적 조회 [파일: T] |',
  '| 웹 프런트 | [모름] | 화면(아홉 유형에 맞는 것 없음) [파일: F/] |',
  '| 결제사 | 외부 시스템 | PayOn [파일: A/lib/payon.ts] |',
  '| 택배사 API | 외부 시스템 | 주소 검증·송장·추적 [파일: W/carrier.ts] |',
  '| 기능 플래그 서비스 | 외부 시스템 | 플래그 SDK [파일: A/lib/flags.ts] |',
  '| 결제 폴링 동기화 | 타이머·일정 | 폐기(*/5 cron) [파일: scripts/old/poll-payments.ts] |',
  '2. 산출물', '| 이름 | 필드 | 만드는 부분 | 읽는 부분 | 있는 곳 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| orders 행 | id·shop_id·status·amount·items·address·phone·payment_id·paid_at·refunded_at·created_at·updated_at | 주문 API·결제 웹훅 수신기·작업자 | 작업자·정산 배치·관리자 화면 | orders 테이블 | [파일: M/0001_orders.sql] |',
  '| shipments 행 | order_id·carrier·tracking_no·status·last_polled_at·delivered_at | 작업자·택배 추적 수집기 | 웹 프런트·관리자 화면·택배 추적 수집기 | orders 테이블 | [파일: M/0003_shipments.sql] |',
  '| processed_events 행 | event_id·kind·received_at | 결제 웹훅 수신기 | 결제 웹훅 수신기 | orders 테이블 | [파일: M/0005_processed_events.sql] |',
  '| events 메시지 | type·order_id·attempt·ts | 결제 웹훅 수신기·택배 추적 수집기·작업자 | 작업자 | Redis 스트림 events | [파일: A/lib/queue.ts] |',
  '| events:dlq 메시지 | type·order_id·attempt·ts·error | 작업자 | [모름](재처리 화면 없음) | Redis 스트림 events:dlq | [파일: W/retry.ts] |',
  '| 결제 세션 요청 | order_id·amount·currency·success_url·cancel_url | 주문 API | 결제사 | HTTP | [파일: A/lib/payon.ts] |',
  '| 결제 웹훅 | id·type·data(payment_id·order_id·amount)·created | 결제사 | 결제 웹훅 수신기 | HTTP(PayOn-Signature 헤더) | [파일: H] |',
  '| 송장 요청 | order_id·receiver·address·phone·items_count | 작업자 | 택배사 API | HTTP | [파일: W/carrier.ts] |',
  '| 관리자 세션 키 | user_id·role·issued_at | 주문 API | 주문 API | 관리자 세션 | [파일: A/lib/session.ts] |',
  '| 플래그 값 | checkout_enabled·address_ai | 기능 플래그 서비스 | 주문 API·작업자 | 메모리(SDK 캐시) | [파일: A/lib/flags.ts] |',
  '3. 부분별 설계', '| 이름 | 받는 산출물 | 안의 단계 | 내는 산출물 | 설정 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| 주문 API | 주문 요청·관리자 요청·플래그 값·관리자 세션 키 | 4절 | orders 행·결제 세션 요청·관리자 세션 키 | PORT 8080, BODY_LIMIT 64kb, RATE_LIMIT 30/60 s/IP, SESSION_TTL 8h | [파일: A/config.ts] |',
  '| 결제 웹훅 수신기 | 결제 웹훅 | 4절 | orders 행·processed_events 행·events 메시지 | SIGNATURE_TOLERANCE_S 300 | [파일: H] |',
  '| 작업자 | events 메시지·orders 행·플래그 값 | 4절 | 송장 요청·shipments 행·알림 요청·events 메시지·events:dlq 메시지 | GROUP workers, BLOCK_MS 5000, COUNT 10, MAX_ATTEMPTS 5, BACKOFF_BASE_S 1 | [파일: W/config.ts] |',
  '| 택배 추적 수집기 | shipments 행·추적 응답 | 배송 중 송장 고르기 → 택배사 조회 → 단계 비교 → tracking_events·shipments 쓰기 → 바뀐 것만 shipment.updated | tracking_events 행·shipments 행·events 메시지 | INTERVAL_MS 600000, BATCH 200, DAILY_QUOTA 10000 | [파일: T] |',
  '| 웹 프런트 | shipments 행·tracking_events 행 | 주문서 → POST /api/orders → 결제사 이동 → 추적 페이지 폴링 | 주문 요청 | POLL_MS 30000 | [파일: F/track/[no]/page.tsx] |',
  '4. 안의 단계', '| 부분 이름 | 순번 | 단계 이름 | 하는 일 한 줄 | 쓰는 파일·함수·모델 | 조건·분기 | 꼬리표 |', '|---|---|---|---|---|---|---|',
  '| 주문 API | 1 | 요청 제한 | IP당 60 s | rateLimit | 넘으면 429 RATE_LIMITED | [파일: A/middleware/rate.ts] |',
  '| 주문 API | 9 | 관리자 인증 | 쿠키 → 세션 키 | session.read | 없거나 8 h 지나면 401 SESSION_EXPIRED | [파일: A/lib/session.ts] |',
  '| 결제 웹훅 수신기 | 2 | 서명 검사 | HMAC-SHA256·300 s 허용 | verifySignature | 실패면 400 SIGNATURE_INVALID | [파일: A/lib/payon.ts] |',
  '| 작업자 | 1 | 읽기 | XREADGROUP workers | consume | 없으면 다시 읽기 | [파일: W/consume.ts] |',
  '| 작업자 | 9 | 재시도 | attempt+1, 2^attempt s 뒤 XADD | retry | attempt가 5에 이르면 events:dlq | [파일: W/retry.ts] |',
  '5. 조건·거부·분기', '| 부분 이름 | 조건 | 참이면 | 거짓이면 | 꼬리표 |', '|---|---|---|---|---|',
  "| 주문 API | !flags.isOn('checkout_enabled') | 503 CHECKOUT_DISABLED | 다음 | [파일: O] |",
  '| 주문 API | !sess 또는 now - sess.issued_at > SESSION_TTL | 401 SESSION_EXPIRED | 다음 | [파일: A/lib/session.ts] |',
  "| 주문 API | action === 'refund' && !['ops','owner'].includes(sess.role) | 403 ROLE_REQUIRED | 다음 | [파일: A/routes/admin.ts] |",
  '| 작업자 | msg.attempt >= MAX_ATTEMPTS | events:dlq로 XADD, XACK | 2^attempt s 뒤 재시도 | [파일: W/retry.ts] |',
  '| 택배 추적 수집기 | quota.today >= DAILY_QUOTA | QUOTA_REACHED, 오늘 조회 멈춤 | 다음 | [파일: T] |'].join('\n');
const WEB36_STATUS = ['모아배송 프로젝트 현황 보고서 (v3 표 형식, 검토 세션 작성, 2026-11-04 02:0xZ 기준)',
  '2. 부분', '| 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태 단어 | 상태의 기준 시각 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| 운영 담당자 | 관리자 화면에서 환불·수동 처리·주소 제안 확인, 정산 대조 | — | 돌고 있음 | 11-03 23:50Z | [보고: 운영 담당자 11-03 23:50Z] |',
  '| 결제 폴링 동기화 | 5분마다 결제사에 결제 상태 조회 | 사본만 보관(scripts/old/poll-payments.ts) | 폐기 | 10-20 | [파일: docs/DECISIONS.md] |',
  '4. 연결', '| 보내는 부분 | 받는 부분 | 넘기는 것 | 언제·얼마나 자주 | 설계/관찰 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| 주문 API | orders 테이블 | 주문 행 INSERT(status received) | 주문 때 | 설계 | [파일: api/src/routes/orders.ts] |',
  '| 주문 API | 결제사 | 결제 세션 생성(금액은 서버 계산) | 주문 때 | 관찰 | [보고: 개발 세션 docs/STATUS.md 11-04 01:40Z] |',
  '| 결제사 | 결제 웹훅 수신기 | payment.succeeded·payment.failed(PayOn-Signature 헤더) | 결제 때 | 관찰 | [파일: docs/INCIDENT-1102.md] |',
  '| 결제 웹훅 수신기 | events 큐 | order.paid 메시지(XADD) | 결제 때 | 관찰 | [파일: docs/INCIDENT-1102.md] |',
  '| events 큐 | 작업자 | order.paid·shipment.updated(XREADGROUP workers) | 5 s 블록 읽기, 10개씩 | 설계 | [파일: worker/src/consume.ts] |',
  '| 작업자 | 택배사 API | 주소 검증·송장 발급 요청 | order.paid마다 | 관찰 | [보고: 개발 세션 docs/STATUS.md 11-02 09:15Z] |',
  '| 운영 담당자 | 기능 플래그 서비스 | checkout_enabled 끄기·켜기 | 사건 때 | 관찰 | [파일: docs/INCIDENT-1102.md] |'].join('\n');
function web36() {
  let project = D.pasteRecord(D.createProject(), WEB36_DESIGN, null).project;
  project = D.pasteRecord(project, WEB36_STATUS, null).project;
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records.flatMap(r => r.spans);
  assert.ok(M.firstAsk(input.ask));
  const at = head => { const hit = spans.filter(span => span.t.startsWith(head)); assert.equal(hit.length, 1, head); return hit[0].s; };
  return { project, input, ask: input.ask, at };
}
const webPart = (f, ref, name, head, extra = {}) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [f.at(head)], claims: [], ...extra });
const webClaim = (f, key, head, extra = {}) => ({ key, kind: 'reported', text: `원문 행을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null, ...extra });
const webLine = (f, from, to, head, extra = {}) => ({ from, to, kind: 'flow', note: '', at: f.at(head), channel: 'data', ...extra });
/** Fragments of three for the given parts, in order. */
const webFragments = parts => Array.from({ length: Math.ceil(parts.length / 3) }, (_, i) => ({ ...empty(), parts: parts.slice(i * 3, i * 3 + 3) }));
const webPlan = (f, parts) => ({ global: [], parts: parts.map(p => ({ ref: p.ref, name: p.name, parent: null, at: [p.basis[0]], focus: `${p.name}의 책임` })) });
const KORU36_ARTIFACTS = ['1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|', '| 카드 러너 | AI 판단 | tick·dispatch·gate 세 명령, 세 팔 카드 [파일: C/card_runner.py] |',
  '2. 산출물', '| 이름 | 필드 | 만드는 부분 | 읽는 부분 | 있는 곳 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| policy.jsonl 행 | row_id·valid_until·authors·reason·state_id·entry_mode·entry_params(wait_max_s·opp_close_q)·u_sigma·d_sigma·T_s | 정책 행 작성기 | 엔진 | /var/lib/koru-desk/race/policy.jsonl | [파일: O/policy-daily/policy-daily.sh] |',
  '| policy.jsonl 행(이어서) | on_gate_loss·races_per_episode·reentry_gap_s·evidence·ts_ms·charter_sha·seq | 정책 행 작성기 | 엔진 | 같은 곳 | [파일: R row_common] |',
  '| cards-{CX,CL,DS}.jsonl | schema·card_id·arm·beat·packet_sha·valid_until·card·answer·counter·anchor_mid·effective_side·checkpoint_result·extension_depth | 카드 러너 | 카드 러너·종이 생산자·성적표 | /var/lib/koru-desk/cards/ | [파일: C/card_runner.py] |',
  '| card(카드 안) | side·watch·horizon_h·checkpoint·kill_event·reason·sources | 카드 러너 | 카드 러너 | cards-*.jsonl 안 | [파일: C/schemas.json] |',
  '| counter.jsonl | ts_ms·arm·card_id·packet_sha·draft·counter | 카드 러너 | 카드 러너 | /var/lib/koru-desk/cards/ | [파일: C/card_runner.py] |',
  '| LEDGER.jsonl | ts_ms·event(CYCLE·ARM_CYCLE·CALL·INVALID·REVIEW_ROW·TRIGGER·PULL…) | 카드 러너 | 성적표·감독자 세션 | /var/lib/koru-desk/cards/ | [파일: C/card_runner.py] |',
  '| J1 답 | side·target_exposure_frac·valid_for_s·ttl_s·taker_fallback_after_s·stop_bp·tp_levels·hold_horizon_s·if_then·reason | 엔진 | 엔진 | 메모리 | [파일: R row_answer] |'].join('\n');

test('.36 places: one store place per 있는 곳 (a part-table store by its name or its cells, a folder by the row\'s own file); a line carries an artifact by its payload or its maker and reader', () => {
  const f = web36();
  assert.deepEqual([[...M.heldPlaces(f.ask, 'orders 테이블')], [...M.heldPlaces(f.ask, 'orders 행')], [...M.heldPlaces(f.ask, 'processed_events 행')]], [['orders 테이블'], ['orders 테이블'], ['orders 테이블']]);
  assert.deepEqual([...M.heldPlaces(f.ask, 'events 큐')].sort(), ['redis 스트림 events', 'redis 스트림 events:dlq'], 'the head words of 「Redis 스트림 events·events:dlq」 go on its second item');
  assert.deepEqual([[...M.heldPlaces(f.ask, 'events:dlq 메시지')], [...M.heldPlaces(f.ask, '관리자 세션')]], [['redis 스트림 events:dlq'], ['관리자 세션']]);
  assert.deepEqual(M.artifactRows(f.ask).filter(r => !r.store).map(r => r.name), ['결제 세션 요청', '결제 웹훅', '송장 요청', '플래그 값'], 'HTTP and memory are no store places');
  assert.deepEqual([...M.heldPlaces(f.ask, '결제 세션 요청'), ...M.heldPlaces(f.ask, '주문 API')], []);
  const key = M.artifactRows(f.ask).find(r => r.name === '관리자 세션 키');
  assert.deepEqual([key.makers, key.readers, key.where, key.place, key.store, key.makerCell, key.readerCell], [['주문 api'], ['주문 api'], '관리자 세션', '관리자 세션', true, '주문 API', '주문 API']);
  assert.deepEqual(M.artifactRows(f.ask).find(r => r.name === 'events:dlq 메시지').readers, [], 'a [모름] reader names no part');
  // The .35 lines read as control: by their maker and reader (the connection rows name what they hand over in other words).
  assert.deepEqual([['주문 API', '결제사', '결제 세션 생성(금액은 서버 계산)'], ['결제사', '결제 웹훅 수신기', 'payment.succeeded·payment.failed(PayOn-Signature 헤더)'], ['작업자', '택배사 API', '주소 검증·송장 발급 요청']]
    .map(([a, b, payload]) => M.carriesArtifact(f.ask, a, b, payload)), [true, true, true]);
  assert.equal(M.carriesArtifact(f.ask, '결제 웹훅 수신기', 'events 큐', 'order.paid 메시지(XADD)'), true, 'a maker and the store holding the row');
  assert.equal(M.carriesArtifact(f.ask, '고객', '웹 프런트', '송장 요청'), true, 'a payload naming a row');
  assert.equal(M.carriesArtifact(f.ask, '운영 담당자', '기능 플래그 서비스', 'checkout_enabled 끄기·켜기'), false, 'a switch carries no artifact');
  // KORU (koru-orch-design-v1 §2): a folder holds a store per file; 「같은 곳」 is the row above; 「cards-*.jsonl 안」 is the cards file.
  const k = koruText(KORU36_ARTIFACTS);
  assert.deepEqual(M.artifactRows(k.ask).map(r => [r.name, r.place, r.store]), [['policy.jsonl 행', 'policy.jsonl', true], ['policy.jsonl 행(이어서)', 'policy.jsonl', true],
    ['cards-{CX,CL,DS}.jsonl', 'cards.jsonl', true], ['card(카드 안)', 'cards.jsonl', true], ['counter.jsonl', 'counter.jsonl', true], ['LEDGER.jsonl', 'ledger.jsonl', true], ['J1 답', '메모리', false]]);
  const koruPlan36 = names => ({ global: [], parts: names.map((name, i) => ({ ref: `new:k${i}`, name, parent: null, at: [k.at('| 카드 러너')], focus: name })) });
  assert.deepEqual(planStoreFolds(koruPlan36(['policy.jsonl 행', 'cards-{CX,CL,DS}.jsonl', 'counter.jsonl', 'LEDGER.jsonl', '카드 러너']), k.ask), [], 'the KORU stores stay apart');
  assert.deepEqual(planStoreFolds(koruPlan36(['cards-{CX,CL,DS}.jsonl', 'card(카드 안)']), k.ask), ['card(카드 안) → cards-{CX,CL,DS}.jsonl']);
});

test('.36 store-dup: a plan standing two store parts on one place is named for its one correction; the combined wire leaves such a store part out with its lines and port-map rows, never re-pointed; self rows and an island are named', () => {
  const f = web36();
  const parts = [webPart(f, 'new:order_api', '주문 API', '| 주문 API | 루프'), webPart(f, 'new:webhook', '결제 웹훅 수신기', '| 결제 웹훅 수신기 | 계산'),
    webPart(f, 'new:worker', '작업자', '| 작업자 | 루프', { inputs: ['events 메시지', 'orders 행'], steps: [{ name: '읽기', does: 'XREADGROUP workers', uses: ['consume'], at: f.at('| 작업자 | 1 | 읽기') }] }),
    webPart(f, 'new:orders_table', 'orders 테이블', '| orders 테이블', { type: 'store', typeAt: f.at('| orders 테이블'), outputs: ['orders 행', 'shipments 행', 'processed_events 행'], fields: ['id', 'shop_id', 'status'] }),
    webPart(f, 'new:orders_rows', 'orders 행', '| orders 행', { type: 'store', typeAt: f.at('| orders 행'), fields: ['id', 'shop_id', 'status'] }),
    webPart(f, 'new:events_queue', 'events 큐', '| events 큐 | 행', { type: 'store', typeAt: f.at('| events 큐 | 행') }),
    webPart(f, 'new:event_messages', 'events 메시지', '| events 메시지', { type: 'store', typeAt: f.at('| events 메시지') }),
    webPart(f, 'new:admin_session', '관리자 세션', '| 관리자 세션 | 행', { type: 'store', typeAt: f.at('| 관리자 세션 | 행') }),
    webPart(f, 'new:provider', '결제사', '| 결제사 | 외부')];
  const plan = webPlan(f, parts), fragments = webFragments(parts);
  assert.deepEqual(planStoreFolds(plan, f.ask), ['orders 행 → orders 테이블', 'events 메시지 → events 큐']);
  assert.deepEqual(blueprintStageIssues(plan, f.ask).find(x => x.rule === 'store-dup'), { path: 'parts', rule: 'store-dup', expected: 0, actual: 2, names: ['orders 행 → orders 테이블', 'events 메시지 → events 큐'] });
  assert.deepEqual(validateMapBlueprint(plan, f.ask), plan, 'the plan is valid; only a first map\'s plan stage refuses its first pass for it');
  assert.deepEqual(storeDupParts({ parts: fragments.flatMap(x => x.parts) }, f.ask).map(x => [x.index, x.name, x.into]), [[4, 'orders 행', 'orders 테이블'], [6, 'events 메시지', 'events 큐']]);
  const global = { ...empty(), summary: '주문 API가 주문 행을 쓴다.', relations: [
    webLine(f, 'new:order_api', 'new:orders_table', '| 주문 API | orders 테이블', { payload: '주문 행 INSERT(status received)', cadence: '주문 때', mode: 'design' }),
    webLine(f, 'new:order_api', 'new:orders_rows', '| orders 행', { payload: 'orders 행' }), webLine(f, 'new:orders_rows', 'new:worker', '| orders 행', { payload: 'orders 행' }),
    webLine(f, 'new:webhook', 'new:events_queue', '| 결제 웹훅 수신기 | events 큐', { payload: 'order.paid 메시지(XADD)', cadence: '결제 때', mode: 'observed' }),
    webLine(f, 'new:webhook', 'new:event_messages', '| events 메시지', { payload: 'events 메시지' }), webLine(f, 'new:event_messages', 'new:worker', '| events 메시지', { payload: 'events 메시지' }),
    webLine(f, 'new:events_queue', 'new:worker', '| events 큐 | 작업자', { payload: 'order.paid·shipment.updated(XREADGROUP workers)', cadence: '5 s 블록 읽기, 10개씩', mode: 'design' })],
    portMap: [{ relation: 2, port: 'orders 행', step: '읽기', direction: 'in', at: f.at('| 작업자 | 1 | 읽기') }, { relation: 6, port: 'events 메시지', step: '읽기', direction: 'in', at: f.at('| 작업자 | 1 | 읽기') }] };
  const before = structuredClone({ fragments, global }), { wire, exclusions, folds } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual({ fragments, global }, before, 'inputs are never changed');
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['parts[4]', 'store-dup'], ['parts[6]', 'store-dup'], ['relations[1]', 'store-dup'], ['relations[2]', 'store-dup'],
    ['relations[4]', 'store-dup'], ['relations[5]', 'store-dup'], ['portMap[0]', 'store-dup']]);
  assert.match(exclusions[0].explanation, /겹친 저장소 부분과 그 연결을 제외했어요/);
  assert.ok(exclusions.every(x => x.record), 'each keeps where its line stands');
  assert.deepEqual(folds, ['orders 행 → orders 테이블', 'events 메시지 → events 큐']);
  assert.deepEqual(wire.parts.map(p => p.ref), ['new:order_api', 'new:webhook', 'new:worker', 'new:orders_table', 'new:events_queue', 'new:admin_session', 'new:provider']);
  assert.deepEqual(wire.relations.map(r => [r.from, r.to]), [['new:order_api', 'new:orders_table'], ['new:webhook', 'new:events_queue'], ['new:events_queue', 'new:worker']], 'nothing re-pointed to the kept store');
  assert.deepEqual(wire.portMap.map(m => [m.relation, m.port]), [[2, 'events 메시지']], 'the row keeps naming its very line');
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  M.attachExclusions(plain, exclusions, f.ask);
  const applied = M.applyReading(f.project, f.input, plain, { id: 'R_web36', at: '2026-11-04T03:00:00.000Z', model: 'stub', prompt: 'm6-000000000036', hash: '6'.repeat(64) });
  assert.deepEqual(applied.reading.exclusions.map(x => x.category), exclusions.map(x => x.category));
  assert.deepEqual(validateProject(applied.project), applied.project);
  // The final diagnostics name the folds, the store no line reaches with its artifact row, and every self row's write and read.
  const found = finalDiagnostics(fragments, global, f.ask, plan), by = rule => found.find(x => x.rule === rule);
  assert.deepEqual(by('store-dup'), { path: 'parts', rule: 'store-dup', expected: 0, actual: 2, names: ['orders 행 → orders 테이블', 'events 메시지 → events 큐'] });
  assert.deepEqual(by('store-island'), { path: 'relations', rule: 'store-island', expected: 3, actual: 2, names: ['관리자 세션: 관리자 세션 키 | 주문 API → 주문 API'] });
  assert.deepEqual(by('plan-relations'), { path: 'relations', rule: 'plan-relations', expected: 8, actual: 1, names: ['new:worker → new:orders_table', 'new:orders_table → new:worker',
    'new:webhook → new:orders_table', 'new:orders_table → new:webhook', 'new:worker → new:events_queue', 'new:order_api → new:admin_session', 'new:admin_session → new:order_api'] });
  assert.ok(missingLines(fragments, global, f.ask, plan).some(x => x.rule === 'plan-relations'), 'a first map\'s global first pass pays its one correction for them');
  // Drawn as the record writes them (each self row on its artifact row), nothing is named and the island is gone.
  const drawn = { ...global, relations: [...global.relations,
    webLine(f, 'new:order_api', 'new:admin_session', '| 관리자 세션 키', { payload: '관리자 세션 키' }), webLine(f, 'new:admin_session', 'new:order_api', '| 관리자 세션 키', { payload: '관리자 세션 키' }),
    webLine(f, 'new:webhook', 'new:orders_table', '| processed_events 행', { payload: 'processed_events 행' }), webLine(f, 'new:orders_table', 'new:webhook', '| processed_events 행', { payload: 'processed_events 행' }),
    webLine(f, 'new:worker', 'new:orders_table', '| orders 행', { payload: 'orders 행' }), webLine(f, 'new:orders_table', 'new:worker', '| orders 행', { payload: 'orders 행' }),
    webLine(f, 'new:worker', 'new:events_queue', '| events 메시지', { payload: 'events 메시지' })] };
  const again = finalDiagnostics(fragments, drawn, f.ask, plan);
  assert.deepEqual([again.find(x => x.rule === 'plan-relations'), again.find(x => x.rule === 'store-island')], [undefined, undefined]);
  assert.equal(M.setAside(M.validateMapReply(combineRenderedReading(fragments, drawn, f.ask, plan).wire, f.ask)).length, 0);
});

test('.36 channel and unrecorded: a control line carrying an artifact is set aside at its channel and named for the correction; a line on a part row is unrecorded where a record draws a connection table', () => {
  const f = web36();
  const parts = [webPart(f, 'new:order_api', '주문 API', '| 주문 API | 루프'), webPart(f, 'new:provider', '결제사', '| 결제사 | 외부'), webPart(f, 'new:webhook', '결제 웹훅 수신기', '| 결제 웹훅 수신기 | 계산'),
    webPart(f, 'new:worker', '작업자', '| 작업자 | 루프'), webPart(f, 'new:carrier', '택배사 API', '| 택배사 API'), webPart(f, 'new:operator', '운영 담당자', '| 운영 담당자 | 관리자'),
    webPart(f, 'new:flags', '기능 플래그 서비스', '| 기능 플래그 서비스 | 외부')];
  const plan = webPlan(f, parts), fragments = webFragments(parts), control = { channel: 'control', mode: 'observed' };
  const global = { ...empty(), summary: '', relations: [
    webLine(f, 'new:order_api', 'new:provider', '| 주문 API | 결제사', { payload: '결제 세션 생성(금액은 서버 계산)', cadence: '주문 때', ...control }),
    webLine(f, 'new:provider', 'new:webhook', '| 결제사 | 결제 웹훅 수신기', { payload: 'payment.succeeded·payment.failed(PayOn-Signature 헤더)', cadence: '결제 때', ...control }),
    webLine(f, 'new:worker', 'new:carrier', '| 작업자 | 택배사 API', { payload: '주소 검증·송장 발급 요청', cadence: 'order.paid마다', ...control }),
    webLine(f, 'new:operator', 'new:flags', '| 운영 담당자 | 기능 플래그 서비스', { payload: 'checkout_enabled 끄기·켜기', cadence: '사건 때', ...control }),
    // A line on the operator's own part row (「관리자 화면에서 환불·…」): no connection row draws it.
    webLine(f, 'new:operator', 'new:order_api', '| 운영 담당자 | 관리자', { payload: '환불', ...control })] };
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['relations[0].channel', 'channel'], ['relations[1].channel', 'channel'], ['relations[2].channel', 'channel'], ['relations[4]', 'unrecorded']]);
  // .38: only the channel is left out (written null); the line stays (the .37 web map lost its only refund line this way).
  assert.match(exclusions[0].explanation, /control로 적혀 그 칸만 비우고 연결은 남겼어요/);
  assert.match(exclusions[3].explanation, /화살표 줄이 아닌 줄에서 만든 연결/);
  assert.deepEqual(wire.relations.map(r => [r.from, r.to, r.channel]), [['new:order_api', 'new:provider', null], ['new:provider', 'new:webhook', null], ['new:worker', 'new:carrier', null],
    ['new:operator', 'new:flags', 'control']], 'a switch stays control');
  // The global correction hears the channel of each such line; the connection rows stay drawn (no line is lost for its channel).
  const issues = mapStageIssues(global, null, { ask: f.ask, parts: fragments.flatMap(x => x.parts), blueprint: plan });
  assert.deepEqual(issues.filter(x => x.category === 'channel').map(x => x.path), ['relations[0].channel', 'relations[1].channel', 'relations[2].channel']);
  const lost = missingLines(fragments, global, f.ask, plan).find(x => x.rule === 'connections')?.names ?? [];
  assert.ok(['주문 api → 결제사', '결제사 → 결제 웹훅 수신기', '작업자 → 택배사 api', '운영 담당자 → 기능 플래그 서비스'].every(n => !lost.includes(n)), String(lost));
  // Written data, the lines stand.
  const data = { ...global, relations: global.relations.slice(0, 3).map(r => ({ ...r, channel: 'data' })) };
  assert.deepEqual(combineRenderedReading(fragments, data, f.ask, plan).exclusions, []);
  // KORU (koru-orch-v3 §2 and §4): owner → ARM on the owner's part row (the .35 map's relation 45) is unrecorded; a connection row, a
  // design row and a step row back a line.
  const k = koru35(), kPlan = plan35(k), kFragments = fragments35(k);
  const kGlobal = { ...empty(), summary: '', relations: [
    { from: 'new:owner', to: 'new:arm', kind: 'flow', note: '', at: k.at('| 소유자 | 지시'), payload: '잔고 입출금으로 노출 조절', channel: 'control' },
    { from: 'new:card', to: 'new:engine', kind: 'flow', note: '', at: k.at('| 카드 러너 | 엔진'), payload: 'review.jsonl watch·allowed_side·valid_until', mode: 'observed' },
    { from: 'new:engine', to: 'new:sheet', kind: 'flow', note: '', at: k.at('| 엔진 | review·policy'), payload: 'J1 답 → 주문' },
    { from: 'new:card', to: 'new:sheet', kind: 'flow', note: '', at: k.at('| 카드 러너 | 11 | tick') }] };
  const kRead = combineRenderedReading(kFragments, kGlobal, k.ask, kPlan);
  assert.deepEqual(kRead.exclusions.filter(x => ['unrecorded', 'sender'].includes(x.category)).map(x => [x.path, x.category]), [['relations[0]', 'unrecorded']]);
  assert.deepEqual(kRead.wire.relations.map(r => [r.from, r.to]), [['new:card', 'new:engine'], ['new:engine', 'new:sheet'], ['new:card', 'new:sheet']]);
  // An arrow line backs a line too (the KORU record's flow line, beside the v3 connection table).
  const arrow = koruText([STATUS35, '', '카드 박자(K 23:37Z·U 14:07Z·GAP 06:35Z/21:05Z + 검문·깨우기) koru-card-* 타이머 → AI 세 팔(CX·CL·DS)이 카드 → review.jsonl 행(watch/allowed_side/valid_until)'].join('\n'));
  const line = { ...empty(), parts: [{ ref: 'new:card', name: '카드 러너', parent: null, role: '카드', roleAbout: null, roleReplaces: null, basis: [arrow.at('| 카드 러너 | 패킷')], claims: [] },
    { ref: 'new:engine', name: '엔진', parent: null, role: '엔진', roleAbout: null, roleReplaces: null, basis: [arrow.at('| 엔진 | 행 셋')], claims: [] }],
    relations: [{ from: 'new:card', to: 'new:engine', kind: 'flow', note: '', at: arrow.at('카드 박자') }, { from: 'new:engine', to: 'new:card', kind: 'flow', note: '', at: arrow.at('| 엔진 | 행 셋') }] };
  const lineRead = M.validateMapReply(line, arrow.ask, { setAside: true });
  assert.deepEqual([lineRead.relations.map(r => r.from), M.readingExclusions(lineRead).map(x => [x.path, x.category])], [['new:card'], [['relations[1]', 'unrecorded']]]);
});

test('.36 conditions: a part\'s own 「조건·거부·분기」 rows stand outside the claim cap; one on another part\'s row, on no condition row or with words its row lacks is set aside alone; a claim on a kept condition\'s row is restate; plan-claims lands the row on its condition', () => {
  const f = web36();
  const row = head => f.at(head), cond = (when, then, otherwise, head) => ({ when, then, else: otherwise, at: row(head) });
  const api = webPart(f, 'new:order_api', '주문 API', '| 주문 API | 루프', { config: ['PORT 8080', 'BODY_LIMIT 64kb', 'RATE_LIMIT 30/60 s/IP', 'SESSION_TTL 8h'],
    claims: [webClaim(f, 's1', "| 주문 API | !flags", { kind: 'describes', topic: 'how' }), webClaim(f, 's2', '| 주문 API | 1 | 요청', { kind: 'describes', topic: 'how' })],
    conditions: [cond("!flags.isOn('checkout_enabled')", '503 CHECKOUT_DISABLED', '다음', "| 주문 API | !flags"),
      cond('!sess 또는 now - sess.issued_at > SESSION_TTL', '401 SESSION_EXPIRED', null, '| 주문 API | !sess'),
      cond('msg.attempt >= MAX_ATTEMPTS', 'events:dlq로 XADD, XACK', '2^attempt s 뒤 재시도', '| 작업자 | msg.attempt'),
      cond('요청 제한', '429 RATE_LIMITED', null, '| 주문 API | 1 | 요청'),
      cond('flags 확인', '503 CHECKOUT_DISABLED', null, "| 주문 API | !flags"),
      cond("action === 'refund'", '403 FORBIDDEN', '다음', "| 주문 API | action")] });
  const worker = webPart(f, 'new:worker', '작업자', '| 작업자 | 루프', { config: ['GROUP workers', 'BLOCK_MS 5000', 'COUNT 10', 'MAX_ATTEMPTS 5', 'BACKOFF_BASE_S 1'], conditions: [cond('msg.attempt >= MAX_ATTEMPTS', 'events:dlq로 XADD, XACK', '2^attempt s 뒤 재시도', '| 작업자 | msg.attempt')] });
  const parts = [api, worker], plan = webPlan(f, parts), fragments = webFragments(parts), global = { ...empty(), summary: '' };
  assert.throws(() => M.validateMapReply(structuredClone({ ...empty(), parts: [api, worker] }), f.ask), undefined, 'plain map.6 refuses a wrong row whole');
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['parts[0].conditions[2]', 'condition'], ['parts[0].conditions[3]', 'condition'], ['parts[0].conditions[4]', 'condition'],
    ['parts[0].conditions[5]', 'condition'], ['parts[0].claims[0]', 'restate']]);
  assert.match(exclusions[0].explanation, /그 조건만 제외했어요/);
  assert.deepEqual(wire.parts.map(p => p.conditions.map(c => [c.when, c.then, c.else])), [[["!flags.isOn('checkout_enabled')", '503 CHECKOUT_DISABLED', '다음'], ['!sess 또는 now - sess.issued_at > SESSION_TTL', '401 SESSION_EXPIRED', null]],
    [['msg.attempt >= MAX_ATTEMPTS', 'events:dlq로 XADD, XACK', '2^attempt s 뒤 재시도']]]);
  assert.deepEqual(wire.parts[0].claims.map(c => c.key), ['s2'], 'the claim on a kept condition\'s row goes; the step row\'s stays');
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  M.attachExclusions(plain, exclusions, f.ask);
  const applied = M.applyReading(f.project, f.input, plain, { id: 'R_web36c', at: '2026-11-04T03:00:00.000Z', model: 'stub', prompt: 'm6-000000000036', hash: '7'.repeat(64) });
  assert.equal(applied.reading.version, 'map-reading.19');
  assert.deepEqual(applied.reading.parts.map(p => p.conditions.length), [2, 1]);
  assert.equal(WEB36_DESIGN.slice(applied.reading.parts[1].conditions[0].quote.from, applied.reading.parts[1].conditions[0].quote.to), applied.reading.parts[1].conditions[0].quote.quote);
  assert.deepEqual(validateProject(applied.project), applied.project);
  const u = M.partUnderstanding(applied.project, applied.reading.parts[0].areaId);
  assert.deepEqual(u.conditions.map(c => c.then), ['503 CHECKOUT_DISABLED', '401 SESSION_EXPIRED']);
  // plan-claims: each own condition row lands on its condition entry; the refund row, set aside here as written, lands by its exclusion
  // (the correction names it otherwise), and a part under the cap with none is refused for its one correction.
  const missing = planClaims(f.ask, plan, wire.parts).missing;
  assert.deepEqual(missing, ["new:order_api: 주문 API | action === 'refund' && !['ops','owner'].includes(sess.role) | 403 ROLE_REQUIRED | 다음 | [파일: A/routes/admin.ts]"]);
  assert.deepEqual(planClaims(f.ask, plan, wire.parts, exclusions).missing, []);
  const bare = webFragments([{ ...api, claims: [api.claims[1]], conditions: [] }, worker]);
  assert.ok(planShort(f.ask, plan, bare[0].parts, null).length === 3, 'every own condition row of a part under the cap counts');
  refused(() => validateRenderedFragment(bare[0], splitBlueprintParts(plan)[0], f.ask, plan, true));
  // The render correction hears a wrong row by its own bounds.
  const loud = structuredClone(fragments[0]); loud.parts[0].conditions.push({ when: '가'.repeat(81), then: 'x', else: null, at: row("| 주문 API | !flags") });
  assert.ok(mapStageIssues(loud).some(x => x.path === 'parts[0].conditions[6]' && x.category === 'condition'));
});

test('.36 loops: a resume sentence is no unit, a retired part repeats nothing now; loop-missing reads the period settings and the cadence words of both sets, never 간격 alone or a retired part', () => {
  const f = web36();
  const worker = webPart(f, 'new:worker', '작업자', '| 작업자 | 루프', { loop: { unit: '없으면 다시 읽기', stop: null, resume: null, at: f.at('| 작업자 | 1 | 읽기') } });
  const polling = webPart(f, 'new:polling', '결제 폴링 동기화', '| 결제 폴링 동기화 | 타이머', { type: 'timer', typeAt: f.at('| 결제 폴링 동기화 | 타이머'), state: 'retired', stateAt: f.at('| 결제 폴링 동기화 | 5분마다'),
    loop: { unit: '5분마다', stop: null, resume: null, at: f.at('| 결제 폴링 동기화 | 5분마다') } });
  const collector = webPart(f, 'new:collector', '택배 추적 수집기', '| 택배 추적 수집기 | 수집기', { loop: { unit: '600 s 주기 추적 조회', stop: 'QUOTA_REACHED, 오늘 조회 멈춤', resume: null, at: f.at('| 택배 추적 수집기 | 수집기') } });
  const front = webPart(f, 'new:front', '웹 프런트', '| 웹 프런트 | [모름]'), api = webPart(f, 'new:order_api', '주문 API', '| 주문 API | 루프'), webhook = webPart(f, 'new:webhook', '결제 웹훅 수신기', '| 결제 웹훅 수신기 | 계산');
  const parts = [worker, polling, collector, front, api, webhook], plan = webPlan(f, parts), fragments = webFragments(parts);
  const { wire, exclusions } = combineRenderedReading(fragments, { ...empty(), summary: '' }, f.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['parts[0].loop.unit', 'loop'], ['parts[1].loop', 'loop']]);
  assert.deepEqual(M.validateMapReply(wire, f.ask).parts.map(p => p.loop && [p.loop.unit, p.loop.stop]), [null, null, ['600 s 주기 추적 조회', 'QUOTA_REACHED, 오늘 조회 멈춤'], null, null, null]);
  assert.deepEqual(wire.parts[0].loop, { unit: null, stop: null, resume: null, at: f.at('| 작업자 | 1 | 읽기') }, 'the wire writes the unit null; a loop of nulls reads as none');
  assert.deepEqual(mapStageIssues(fragments[0]).filter(x => x.category === 'loop').map(x => x.path), ['parts[0].loop.unit', 'parts[1].loop']);
  // 작업자 (BLOCK_MS 5000) and 웹 프런트 (POLL_MS 30000, 추적 페이지 폴링) are named by their settings; 주문 API (RATE_LIMIT 30/60 s/IP,
  // IP당 60 s) and 결제 웹훅 수신기 (300 s 허용) say nothing of repeating; the retired polling is never named.
  assert.deepEqual(loopRows(f.ask, wire.parts), { rows: 3, missing: ['작업자: 설정 | BLOCK_MS 5000', '웹 프런트: 설정 | POLL_MS 30000'] });
  assert.equal(M.LOOP_UNIT.test('5 s 블록 읽기, 10개씩') && M.LOOP_UNIT.test('매분') && M.LOOP_UNIT.test('카드 박자') && !M.LOOP_UNIT.test('없으면 다시 읽기'), true);
});

test('.36 shared noun: one bare unit word after bare names is shared, nothing else; an io item adding a unit noun to a bare item of its own design cell is set aside', () => {
  assert.deepEqual(M.sharedItems('review·policy·state 행, 패킷'), ['review 행', 'policy 행', 'state 행', '패킷']);
  assert.deepEqual(M.sharedItems('cards·counter·review 행·LEDGER'), ['cards', 'counter', 'review 행', 'LEDGER']);
  assert.deepEqual(M.sharedItems('journal·outcomes 경주 행'), ['journal 경주 행', 'outcomes 경주 행'], '.38: a two-word unit phrase is shared whole');
  assert.deepEqual(M.sharedItems('A/server.ts·config.ts·middleware/rate.ts'), ['A/server.ts', 'config.ts', 'middleware/rate.ts']);
  assert.deepEqual(M.sharedItems('tracking_events 행·shipments 행·events 메시지'), ['tracking_events 행', 'shipments 행', 'events 메시지']);
  assert.deepEqual(M.sharedItems('orders 행·결제 세션 요청·관리자 세션 키'), ['orders 행', '결제 세션 요청', '관리자 세션 키']);
  assert.deepEqual(M.UNIT_NOUNS, ['행', '메시지', '스트림', '파일', '줄']);
  // The .35 card runner: 「cards 행」 and 「counter 행」 where its own cell says cards and counter (koru-orch-design-v1 §3).
  const f = koru35(), plan = plan35(f), fragments = fragments35(f), card = fragments[0].parts[2];
  Object.assign(card, { outputs: ['cards 행', 'counter 행', 'review 행', 'LEDGER'] });
  const { wire, exclusions } = combineRenderedReading(fragments, { ...empty(), summary: '' }, f.ask, plan);
  assert.deepEqual(exclusions.filter(x => x.category === 'outputs').map(x => x.path), ['parts[2].outputs[0]', 'parts[2].outputs[1]']);
  assert.deepEqual(wire.parts.find(p => p.ref === 'new:card').outputs, ['review 행', 'LEDGER']);
});

// ---- first-map-divided.37 (map-reading.13, from the blind judging of the .36 maps: KORU and the web app both 20/20 and design 18/18,
// whose global first passes paid their one correction for lines the contract itself set aside (the KORU owner → ARM, the web
// 알림톡 대행사 → 고객) and for a store the records give no line (ARM), whose engine kept its 설정 cadence as loop-missing, whose
// collector kept a null stop beside its QUOTA_REACHED row, whose admin-screen rule found no place in the order API's conditions,
// whose HTTP formats lost their fields, whose payment polling read 폐기 as implementation and whose render corrections dropped rows
// unseen). The rows are the real rows of both test sets (webapp-design-v1 §1-§5, webapp-status-v3 §2, §4, §6 and §7; koru-orch-design-v1
// §3-§5, koru-orch-v3 §2 and §4), copied as written; no model quality is claimed. ----
const WEB37_DESIGN = WEB36_DESIGN
  .replace('| 결제사 | 외부 시스템 | PayOn [파일: A/lib/payon.ts] |', ['| 결제사 | 외부 시스템 | PayOn [파일: A/lib/payon.ts] |',
    '| 관리자 화면 | [모름] | 화면(아홉 유형에 맞는 것 없음) [파일: F/admin/page.tsx] |', '| 알림톡 대행사 | 외부 시스템 | 알림톡 발송 [파일: W/notify.ts 이름만] |',
    '| 고객 | 사람 | 주문·결제·조회 [파일: F/order/page.tsx] |'].join('\n'))
  .replace('| 플래그 값 | checkout_enabled·address_ai | 기능 플래그 서비스 | 주문 API·작업자 | 메모리(SDK 캐시) | [파일: A/lib/flags.ts] |', ['| 플래그 값 | checkout_enabled·address_ai | 기능 플래그 서비스 | 주문 API·작업자 | 메모리(SDK 캐시) | [파일: A/lib/flags.ts] |',
    '| 추적 응답 | tracking_no·stage·occurred_at … | 택배사 API | 택배 추적 수집기 | HTTP | [파일: git 3e9a1c07:tracker/src/carrier-client.ts] |',
    '| 관리자 요청 | action·order_id·reason·amount | 관리자 화면 | 주문 API | HTTP(세션 쿠키) | [파일: A/routes/admin.ts] |', '| 알림 요청 | [모름] | 작업자 | 알림톡 대행사 | HTTP | [모름] |'].join('\n'));
const WEB37_STATUS = ['모아배송 프로젝트 현황 보고서 (v3 표 형식, 검토 세션 작성, 2026-11-04 02:0xZ 기준, 나머지 표)',
  '2. 부분', '| 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태 단어 | 상태의 기준 시각 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| 고객 | 주문서 입력·결제·배송 조회 | — | 돌고 있음 | 11-03 23:50Z | [보고: 운영 담당자 11-03 23:50Z] |',
  '| 관리자 화면 | 운영 담당자용 주문 목록·환불·제안 확인 | web/app/admin/ | 돌고 있음 | 11-04 01:40Z | [보고: 개발 세션 docs/STATUS.md 11-04 01:40Z] |',
  '| 알림톡 대행사 | 고객 알림톡 발송 | 외부 | 돌고 있음 | 11-03 23:50Z | [보고: 운영 담당자 11-03 23:50Z] |',
  '4. 연결', '| 보내는 부분 | 받는 부분 | 넘기는 것 | 언제·얼마나 자주 | 설계/관찰 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| 작업자 | 알림톡 대행사 | 주문 확인·발송 시작·배송 완료 알림 | 상태 바뀔 때 | 관찰 | [보고: 운영 담당자 11-03 01:20Z] |',
  '| 택배사 API | 택배 추적 수집기 | 송장별 추적 단계 | 10분마다 | 관찰 | [보고: 개발 세션 docs/STATUS.md 11-02 09:15Z] |',
  '| 관리자 화면 | 주문 API | /admin/api/* 요청(세션 쿠키) | 수시 | 설계 | [파일: api/src/routes/admin.ts] |',
  '6. 철회·변경', '| 부분 이름 | 옛 결정 | 지금 | 근거·날짜 |', '|---|---|---|---|',
  '| 결제 폴링 동기화 | 결제 확인은 5분마다 결제사 조회 | 폐기, 웹훅만 | [파일: docs/DECISIONS.md D-04 10-20] |',
  '| 주소 보정기 | 신뢰도 0.9 이상이면 orders.address에 자동 적용 | 철회, 운영 담당자 확인 뒤에만 적용 | [파일: docs/DECISIONS.md D-07 10-24] |',
  '| 정산 배치 | 00:05Z 실행, UTC 날짜 경계 | 15:30Z 실행, KST 날짜 경계 | [실행: git show 5d0c2e19 10-28] |',
  '| 작업자 | 재시도 지수 백오프 8회 뒤 버림 | 5회 뒤 events:dlq로 옮김 | [파일: docs/DECISIONS.md D-09 10-27] |',
  '| CI 관문 | 「e2e 전부 통과」(개발 세션 10-29 보고) | 정정: e2e 잡은 건너뛰어졌음, 10-31부터 필수 잡 | [보고: 개발 세션 docs/STATUS.md 10-31 08:02Z] |',
  '| events 큐 | 스트림 길이 제한 없음, maxmemory 1 GB | MAXLEN ~100000, maxmemory 2 GB | [파일: docs/INCIDENT-1102.md 11-02 12:20Z] |',
  '7. 지켜야 할 것과 하지 않기로 한 것', '| 부분 이름 | 규칙 한 줄 | 누가 정했나·언제 |', '|---|---|---|',
  '| 관리자 화면 | 환불은 운영 담당자·소유자만, 관리자 세션은 8 h 만료 | 소유자 10-16 [파일: docs/DECISIONS.md D-03] |'].join('\n');
function web37() {
  let project = D.pasteRecord(D.createProject(), WEB37_DESIGN, null).project;
  project = D.pasteRecord(project, WEB36_STATUS, null).project;
  project = D.pasteRecord(project, WEB37_STATUS, null).project;
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records.flatMap(r => r.spans);
  assert.ok(M.firstAsk(input.ask));
  const at = head => { const hit = spans.filter(span => span.t.startsWith(head)); assert.equal(hit.length, 1, head); return hit[0].s; };
  return { project, input, ask: input.ask, at };
}
const meta37 = (id, n) => ({ id, at: '2026-11-04T05:00:00.000Z', model: 'stub', prompt: 'm6-000000000037', hash: n.repeat(64) });

test('.37 lines set aside: a line the contract leaves out as unrecorded, or a plan item resting on no recorded line, is named under lines-set-aside and never as missing (no global correction); a store the records give no artifact row is no island', () => {
  const f = web37();
  const parts = [webPart(f, 'new:worker', '작업자', '| 작업자 | 루프'), webPart(f, 'new:notify', '알림톡 대행사', '| 알림톡 대행사 | 외부'), webPart(f, 'new:customer', '고객', '| 고객 | 사람')];
  const plan = { ...webPlan(f, parts), global: [
    { kind: 'relation', text: 'new:worker → new:notify: 주문 확인·발송 시작·배송 완료 알림', at: [f.at('| 작업자 | 알림톡 대행사')] },
    // The .36 web plan drew this from the vendor's part row (「고객 알림톡 발송」); no connection or artifact row backs it.
    { kind: 'relation', text: 'new:notify → new:customer: 고객 알림톡 발송', at: [f.at('| 알림톡 대행사 | 고객 알림톡')] }] };
  const fragments = webFragments(parts);
  const global = { ...empty(), summary: '', relations: [
    webLine(f, 'new:worker', 'new:notify', '| 작업자 | 알림톡 대행사', { payload: '주문 확인·발송 시작·배송 완료 알림', cadence: '상태 바뀔 때', mode: 'observed' }),
    webLine(f, 'new:notify', 'new:customer', '| 알림톡 대행사 | 고객 알림톡', { payload: '고객 알림톡' })] };
  const { exclusions, asideLines } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['relations[1]', 'unrecorded']]);
  assert.deepEqual(asideLines, [{ from: 'new:notify', to: 'new:customer', category: 'unrecorded' }]);
  const found = finalDiagnostics(fragments, global, f.ask, plan), by = rule => found.find(x => x.rule === rule);
  assert.equal(by('plan-relations'), undefined, 'the line the contract set aside is no missing line');
  assert.deepEqual(by('lines-set-aside'), { path: 'relations', rule: 'lines-set-aside', expected: null, actual: 1, names: ['new:notify → new:customer: unrecorded'] });
  assert.ok(!missingLines(fragments, global, f.ask, plan).some(x => x.rule === 'plan-relations'), 'the global first pass pays no correction for it');
  assert.ok(!by('connections').names.includes('작업자 → 알림톡 대행사'), 'the vendor\'s own connection row is drawn');
  // Left undrawn, the plan item on the part row alone is set aside the same way (the global correction's feedback says so too).
  const bare = { ...global, relations: [global.relations[0]] };
  assert.deepEqual(finalDiagnostics(fragments, bare, f.ask, plan).find(x => x.rule === 'lines-set-aside')?.names, ['new:notify → new:customer: unrecorded']);
  assert.deepEqual(mapStageIssues(bare, null, { ask: f.ask, parts: fragments.flatMap(x => x.parts), blueprint: plan }).filter(x => ['plan-relations', 'lines-set-aside'].includes(x.rule)).map(x => [x.rule, x.names]),
    [['lines-set-aside', ['new:notify → new:customer: unrecorded']]]);
  // KORU (koru-orch-v3 §2): owner → ARM rests on the owner's part row only (「잔고 입출금으로 노출 조절」); a plan item on a connection row
  // left undrawn is still missing.
  const k = koru35(), base = plan35(k), kPlan = { ...base, global: [...base.global,
    { kind: 'relation', text: 'new:owner → new:arm: 잔고 입출금으로 노출 조절', at: [k.at('| 소유자 | 지시')] },
    { kind: 'relation', text: 'new:card → new:engine: review.jsonl watch·allowed_side·valid_until', at: [k.at('| 카드 러너 | 엔진')] }] };
  const plainAsk = fixture(), kParts = fragments35(k).flatMap(x => x.parts), kFound = readingDiagnostics({ ask: k.ask, summary: '', parts: kParts, relations: [], blueprint: kPlan });
  assert.deepEqual(kFound.find(x => x.rule === 'plan-relations'), { path: 'relations', rule: 'plan-relations', expected: 1, actual: 0, names: ['new:card → new:engine'] });
  assert.deepEqual(kFound.find(x => x.rule === 'lines-set-aside').names, ['new:owner → new:arm: unrecorded']);
  assert.deepEqual([M.unrecordedAt(k.ask, [k.at('| 소유자 | 지시')]), M.unrecordedAt(k.ask, [k.at('| 소유자 | 지시'), k.at('| 카드 러너 | 엔진')]), M.unrecordedAt(plainAsk.ask, [plainAsk.at[0]])],
    [true, false, false], 'any recorded line backs an item; without a connection table nothing is unrecorded');
  // ARM as a store part (koru-orch-design-v1 §3 gives it no artifact row): no island is named; the web 관리자 세션 still is (.36).
  Object.assign(kParts.find(p => p.ref === 'new:arm'), { type: 'store', typeAt: k.at('| ARM | e=1.00') });
  assert.equal(readingDiagnostics({ ask: k.ask, summary: '', parts: kParts, relations: [], blueprint: kPlan }).find(x => x.rule === 'store-island'), undefined);
});

test('.37 program loop: a part with no loop whose cadence setting stands in its own design row gets that item as its unit, marked program; a loop takes a condition\'s stop or quota code as its stop; the model\'s own items never change', () => {
  // KORU (koru-orch-design-v1 §3, §5): the engine's 「j1_cadence 60 s」 (the .36 loop-missing) and its STOP_NOT_RESIDENT (a stop price).
  const k = koru35(), kPlan = plan35(k), kFragments = fragments35(k);
  kFragments[0].parts[2].loop = { unit: '매분', stop: null, resume: null, at: k.at('| 카드 러너 | 11') };
  kFragments[1].parts[0].conditions = [{ when: 'not 1 <= stop <= 250', then: 'STOP_NOT_RESIDENT', else: 'J1 답', at: k.at('| 엔진 | not 1') }];
  const { wire, exclusions } = combineRenderedReading(kFragments, { ...empty(), summary: '' }, k.ask, kPlan);
  assert.equal(wire.parts.find(p => p.ref === 'new:engine').loop ?? null, null, 'the wire keeps the reply as written');
  const read = M.validateMapReply(wire, k.ask), loopOf = ref => read.parts.find(p => p.ref === ref).loop;
  assert.deepEqual([loopOf('new:engine').unit, loopOf('new:engine').stop, loopOf('new:engine').resume, loopOf('new:engine').program], ['j1_cadence 60 s', null, null, true]);
  assert.ok(loopOf('new:engine').quote.quote.includes('| 엔진 | review·policy·state 행, 패킷 | 4절 |'), 'on the engine\'s own design row');
  assert.deepEqual([loopOf('new:card').unit, loopOf('new:card').program], ['매분', undefined]);
  assert.equal(loopOf('new:arm'), null, 'ARM (24 h 만료) holds no cadence setting');
  assert.equal(finalDiagnostics(kFragments, { ...empty(), summary: '' }, k.ask, kPlan).find(x => x.rule === 'loop-missing'), undefined, 'loop-missing names neither');
  M.attachExclusions(read, exclusions, k.ask);
  const applied = M.applyReading(k.project, k.input, read, meta37('R_loop37', '1'));
  const stored = ref => applied.reading.parts.find(p => p.areaId === applied.created[kPlan.parts.findIndex(x => x.ref === ref)]).loop;
  assert.equal(applied.reading.version, 'map-reading.19');
  assert.deepEqual([stored('new:engine').unit, stored('new:engine').program, stored('new:card').program], ['j1_cadence 60 s', true, false]);
  assert.deepEqual(validateProject(applied.project), applied.project);
  // The web app (webapp-design-v1 §3, §5): the collector's own unit stays and takes its QUOTA_REACHED row as its stop; the worker's
  // per-message dlq is no stop; the front's POLL_MS 30000 is its unit.
  const f = web37(), condition = (when, then, otherwise, head) => ({ when, then, else: otherwise, at: f.at(head) });
  const collector = webPart(f, 'new:collector', '택배 추적 수집기', '| 택배 추적 수집기 | 수집기', { config: ['INTERVAL_MS 600000', 'BATCH 200', 'DAILY_QUOTA 10000'],
    loop: { unit: '600 s 주기', stop: null, resume: null, at: f.at('| 택배 추적 수집기 | 수집기') }, conditions: [condition('quota.today >= DAILY_QUOTA', 'QUOTA_REACHED, 오늘 조회 멈춤', '다음', '| 택배 추적 수집기 | quota')] });
  const worker = webPart(f, 'new:worker', '작업자', '| 작업자 | 루프', { config: ['GROUP workers', 'BLOCK_MS 5000', 'COUNT 10', 'MAX_ATTEMPTS 5', 'BACKOFF_BASE_S 1'],
    loop: { unit: '5 s 블록 읽기, 10개씩', stop: null, resume: '없으면 다시 읽기', at: f.at('| 작업자 | 1 | 읽기') }, conditions: [condition('msg.attempt >= MAX_ATTEMPTS', 'events:dlq로 XADD, XACK', '2^attempt s 뒤 재시도', '| 작업자 | msg.attempt')] });
  const front = webPart(f, 'new:front', '웹 프런트', '| 웹 프런트 | [모름]', { config: ['POLL_MS 30000'] });
  const parts = [collector, worker, front], plan = webPlan(f, parts), web = combineRenderedReading(webFragments(parts), { ...empty(), summary: '' }, f.ask, plan);
  const webRead = M.validateMapReply(web.wire, f.ask), webLoop = ref => { const l = webRead.parts.find(p => p.ref === ref).loop; return [l.unit, l.stop, l.resume, l.program ?? false]; };
  assert.deepEqual([webLoop('new:collector'), webLoop('new:worker'), webLoop('new:front')],
    [['600 s 주기', 'QUOTA_REACHED, 오늘 조회 멈춤', null, true], ['5 s 블록 읽기, 10개씩', null, '없으면 다시 읽기', false], ['POLL_MS 30000', null, null, true]]);
  assert.ok(webRead.parts.find(p => p.ref === 'new:front').loop.quote.quote.startsWith('| 웹 프런트 | shipments 행·tracking_events 행 |'));
  assert.deepEqual(loopRows(f.ask, web.wire.parts).missing, [], 'the front is no longer named for its POLL_MS');
  assert.deepEqual([M.CADENCE_SETTING.test('j1_cadence 60 s'), M.CADENCE_SETTING.test('POLL_MS 30000'), M.CADENCE_SETTING.test('INTERVAL_MS 600000'), M.CADENCE_SETTING.test('600 s 주기'),
    M.CADENCE_SETTING.test('BLOCK_MS 5000'), M.CADENCE_SETTING.test('TIMEOUT_MS 8000'), M.CADENCE_SETTING.test('SESSION_TTL 8h')], [true, true, true, true, false, false, false]);
  assert.deepEqual([M.STOP_CODE.test('QUOTA_REACHED, 오늘 조회 멈춤'), M.STOP_CODE.test('STOP_NOT_RESIDENT'), M.STOP_CODE.test('events:dlq로 XADD, XACK'), M.STOP_CODE.test('CONCURRENCY_NOT_ONE 쉼')], [true, false, false, false]);
  // A program loop never stands on a retired part, and a loop item the model wrote on the wire as program is its own (the key is passed over).
  assert.equal(M.programLoop(f.ask, { name: '웹 프런트', config: ['POLL_MS 30000'], state: 'retired' }), null);
  const forged = structuredClone(web.wire); forged.parts[1].loop.program = true; forged.parts[1].stateVars = [{ name: 'msg.attempt', scope: null, readBy: [], changedBy: [], program: true }];
  const forgedRead = M.validateMapReply(forged, f.ask).parts[1];
  assert.deepEqual([forgedRead.loop.program, forgedRead.stateVars[0].program], [undefined, undefined]);
});

test('.37 program places and kept state: a rule its own part places nowhere takes the conditions of the part its line reaches; a condition variable the records call 키 is a kept state by name, marked program', () => {
  const f = web37(), condition = (when, then, otherwise, head) => ({ when, then, else: otherwise, at: f.at(head) });
  const admin = webPart(f, 'new:admin', '관리자 화면', '| 관리자 화면 | [모름]', { claims: [webClaim(f, 's1', '| 관리자 화면 | 환불은',
    { kind: 'want', topic: 'rule', text: '환불은 운영 담당자와 소유자만 할 수 있고 관리자 세션은 8 h 후 만료한다.', scope: 'part', enforcedBy: [{ kind: 'unknown', text: '장치 미상', at: null }] })] });
  const api = webPart(f, 'new:order_api', '주문 API', '| 주문 API | 루프', { conditions: [condition("!flags.isOn('checkout_enabled')", '503 CHECKOUT_DISABLED', '다음', '| 주문 API | !flags'),
    condition('!sess 또는 now - sess.issued_at > SESSION_TTL', '401 SESSION_EXPIRED', '다음', '| 주문 API | !sess'),
    condition("action === 'refund' && !['ops','owner'].includes(sess.role)", '403 ROLE_REQUIRED', '다음', '| 주문 API | action')] });
  const worker = webPart(f, 'new:worker', '작업자', '| 작업자 | 루프', { conditions: [condition('msg.attempt >= MAX_ATTEMPTS', 'events:dlq로 XADD, XACK', '2^attempt s 뒤 재시도', '| 작업자 | msg.attempt')] });
  const parts = [admin, api, worker], plan = webPlan(f, parts), fragments = webFragments(parts);
  const global = { ...empty(), summary: '', relations: [webLine(f, 'new:admin', 'new:order_api', '| 관리자 화면 | 주문 API', { payload: '/admin/api/* 요청(세션 쿠키)', cadence: '수시', mode: 'design' })] };
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual(exclusions, []);
  const read = M.validateMapReply(wire, f.ask), partOf = ref => read.parts.find(p => p.ref === ref);
  // 환불·소유자·세션 read as refund·owner·sess: the refund row shares three words, the session row two (sess, expir); most first.
  assert.deepEqual(partOf('new:admin').claims[0].anchors.map(a => [a.kind, a.text, a.program]),
    [['inferred', "action === 'refund' && !['ops','owner'].includes(sess.role)", true], ['inferred', '!sess 또는 now - sess.issued_at > SESSION_TTL', true]]);
  assert.equal(partOf('new:admin').claims[0].anchors[0].quote.quote, "| 주문 API | action === 'refund' && !['ops','owner'].includes(sess.role) | 403 ROLE_REQUIRED | 다음 | [파일: A/routes/admin.ts] |");
  // Without the line the admin screen's rule stays unplaced (its own part has no row).
  assert.deepEqual(M.validateMapReply(combineRenderedReading(fragments, { ...empty(), summary: '' }, f.ask, plan).wire, f.ask).parts[0].claims[0].anchors, []);
  // 「관리자 세션 키 | user_id·role·issued_at | 주문 API | 주문 API」 calls sess.issued_at and sess.role kept state; msg.attempt's row (events 메시지) does not.
  assert.deepEqual(partOf('new:order_api').stateVars, [{ name: 'sess.issued_at', scope: null, readBy: [], changedBy: [], program: true }, { name: 'sess.role', scope: null, readBy: [], changedBy: [], program: true }]);
  assert.deepEqual(partOf('new:worker').stateVars, []);
  assert.deepEqual(M.conditionVariables("action === 'refund' && !['ops','owner'].includes(sess.role) || flags.isOn('x') && evt.type === 'payment.succeeded'"), ['sess.role', 'evt.type']);
  const applied = M.applyReading(f.project, f.input, read, meta37('R_places37', '2'));
  const storedApi = applied.reading.parts.find(p => p.areaId === applied.created[1]);
  assert.deepEqual(storedApi.stateVars.map(s => [s.name, s.program]), [['sess.issued_at', true], ['sess.role', true]]);
  assert.deepEqual(applied.reading.parts.find(p => p.areaId === applied.created[0]).claims[0].anchors.map(a => a.program), [true, true]);
  assert.deepEqual(validateProject(applied.project), applied.project);
});

test('.37 format fields: a line carrying a format artifact (HTTP, 메모리, a request) keeps its fields as payloadFields; a field no row gives, a list on a line carrying none or a list past 24 is left out alone and the line stays', () => {
  const f = web37();
  const parts = [webPart(f, 'new:order_api', '주문 API', '| 주문 API | 루프'), webPart(f, 'new:provider', '결제사', '| 결제사 | 외부'), webPart(f, 'new:webhook', '결제 웹훅 수신기', '| 결제 웹훅 수신기 | 계산'),
    webPart(f, 'new:operator', '운영 담당자', '| 운영 담당자 | 관리자'), webPart(f, 'new:flags', '기능 플래그 서비스', '| 기능 플래그 서비스 | 외부')];
  const plan = webPlan(f, parts), fragments = webFragments(parts);
  const global = { ...empty(), summary: '', relations: [
    webLine(f, 'new:order_api', 'new:provider', '| 주문 API | 결제사', { payload: '결제 세션 생성(금액은 서버 계산)', cadence: '주문 때', payloadFields: ['order_id', 'amount', 'currency', 'success_url', 'cancel_url', 'memo'] }),
    webLine(f, 'new:provider', 'new:webhook', '| 결제사 | 결제 웹훅 수신기', { payload: 'payment.succeeded·payment.failed(PayOn-Signature 헤더)', cadence: '결제 때', payloadFields: ['id', 'type', 'data(payment_id·order_id·amount)', 'created'] }),
    webLine(f, 'new:operator', 'new:flags', '| 운영 담당자 | 기능 플래그 서비스', { payload: 'checkout_enabled 끄기·켜기', cadence: '사건 때', channel: 'control', payloadFields: ['checkout_enabled'] })] };
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['relations[0].payloadFields[5]', 'payload-fields'], ['relations[2].payloadFields', 'payload-fields']]);
  assert.match(exclusions[1].explanation, /그 칸\(또는 그 필드 하나\)만 빼고 연결은 남겼어요/);
  assert.deepEqual(wire.relations.map(r => r.payloadFields), [['order_id', 'amount', 'currency', 'success_url', 'cancel_url'], ['id', 'type', 'data(payment_id·order_id·amount)', 'created'], null]);
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  assert.deepEqual(plain.relations.map(r => r.payloadFields), [['order_id', 'amount', 'currency', 'success_url', 'cancel_url'], ['id', 'type', 'data(payment_id·order_id·amount)', 'created'], []]);
  M.attachExclusions(plain, exclusions, f.ask);
  const applied = M.applyReading(f.project, f.input, plain, meta37('R_fields37', '3'));
  assert.deepEqual(applied.reading.relations.map(r => r.payloadFields.length), [5, 4, 0]);
  assert.deepEqual(validateProject(applied.project), applied.project);
  assert.deepEqual(M.artifactRows(f.ask).filter(r => r.format).map(r => [r.name, r.fields.length]),
    [['결제 세션 요청', 5], ['결제 웹훅', 4], ['송장 요청', 5], ['플래그 값', 2], ['추적 응답', 3], ['관리자 요청', 4], ['알림 요청', 0]], 'HTTP and memory rows are formats; a [모름] cell has no field');
  // Past 24 the list is left out alone; plain map.6 refuses a field over 60; the global correction hears each by its own bound.
  const long = structuredClone(global); long.relations[0].payloadFields = Array.from({ length: 25 }, (_, i) => `f${i}`);
  assert.deepEqual(combineRenderedReading(fragments, long, f.ask, plan).exclusions.filter(x => x.category === 'payload-fields').map(x => x.path), ['relations[0].payloadFields', 'relations[2].payloadFields']);
  const loud = structuredClone(wire); loud.relations[0].payloadFields = ['가'.repeat(61)];
  assert.throws(() => M.validateMapReply(loud, f.ask));
  assert.deepEqual(mapStageIssues(loud).filter(x => x.path.startsWith('relations[0].payloadFields')), [{ path: 'relations[0].payloadFields[0]', rule: 'length', expected: 60, actual: 61 }]);
  assert.deepEqual(mapStageIssues(long).filter(x => x.path === 'relations[0].payloadFields'), [{ path: 'relations[0].payloadFields', rule: 'count', expected: 24, actual: 25 }]);
});

test('.37 cadence and duplicate lines: a line on a connection row that says when keeps that cadence (a wrong word or none leaves the cadence out alone, the line stays); a later line with the same ends, channel and payload is dup-line', () => {
  const f = web37();
  const parts = [webPart(f, 'new:events_queue', 'events 큐', '| events 큐 | 행', { type: 'store', typeAt: f.at('| events 큐 | 행') }), webPart(f, 'new:worker', '작업자', '| 작업자 | 루프'),
    webPart(f, 'new:webhook', '결제 웹훅 수신기', '| 결제 웹훅 수신기 | 계산'), webPart(f, 'new:carrier', '택배사 API', '| 택배사 API | 외부'), webPart(f, 'new:collector', '택배 추적 수집기', '| 택배 추적 수집기 | 수집기')];
  const plan = webPlan(f, parts), fragments = webFragments(parts);
  const global = { ...empty(), summary: '', relations: [
    // webapp-status-v3 §4 「5 s 블록 읽기, 10개씩」: the .36 map left it null (the worker's loop unit said it too).
    webLine(f, 'new:events_queue', 'new:worker', '| events 큐 | 작업자', { payload: 'order.paid·shipment.updated(XREADGROUP workers)', mode: 'design' }),
    webLine(f, 'new:webhook', 'new:events_queue', '| 결제 웹훅 수신기 | events 큐', { payload: 'order.paid 메시지(XADD)', cadence: '가'.repeat(81), mode: 'observed' }),
    webLine(f, 'new:webhook', 'new:events_queue', '| 결제 웹훅 수신기 | events 큐', { payload: 'order.paid 메시지(XADD)', cadence: '결제 때', mode: 'observed' }),
    webLine(f, 'new:carrier', 'new:collector', '| 택배사 API | 택배 추적 수집기', { payload: '송장별 추적 단계', cadence: '10분마다', mode: 'observed' })] };
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['relations[0].cadence', 'cadence'], ['relations[1].cadence', 'cadence'], ['relations[2]', 'dup-line']]);
  assert.match(exclusions[0].explanation, /그 칸을 진단에 남겼어요/);
  assert.match(exclusions[2].explanation, /뒤의 겹친 연결을 제외했어요/);
  assert.ok(exclusions[0].record, 'the cadence names its line\'s row');
  assert.deepEqual(wire.relations.map(r => [r.from, r.to, r.cadence ?? null]), [['new:events_queue', 'new:worker', null], ['new:webhook', 'new:events_queue', null], ['new:carrier', 'new:collector', '10분마다']]);
  const plain = M.validateMapReply(wire, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  assert.equal(plain.relations.length, 3);
  // Plain map.6 still refuses a wrong cadence word whole; a later map (map.7) still sets its line aside.
  assert.throws(() => M.validateMapReply({ ...structuredClone(wire), relations: [global.relations[1]] }, f.ask));
  // Written as the row says it, and once, nothing is set aside.
  const kept = { ...global, relations: [{ ...global.relations[0], cadence: '5 s 블록 읽기, 10개씩' }, global.relations[2], global.relations[3]] };
  assert.deepEqual(combineRenderedReading(fragments, kept, f.ask, plan).exclusions, []);
});

test('.37 withdrawal kind: a withdrawal whose row\'s 지금 cell says 폐기 or 철회 holds design (another kind is left null alone), and a kind left null beside 폐기·철회·롤백·되돌림 is named on its row', () => {
  const f = web37(), withdrawn = (key, head, extra = {}) => webClaim(f, key, head, { topic: 'withdrawn', ...extra });
  const parts = [webPart(f, 'new:polling', '결제 폴링 동기화', '| 결제 폴링 동기화 | 타이머', { claims: [withdrawn('s1', '| 결제 폴링 동기화 | 결제 확인은', { withdrawalKind: 'implementation' })] }),
    webPart(f, 'new:fixer', '주소 보정기', '| 주소 보정기 | 신뢰도', { claims: [withdrawn('s2', '| 주소 보정기 | 신뢰도')] }),
    webPart(f, 'new:events_queue', 'events 큐', '| events 큐 | 행', { claims: [withdrawn('s3', '| events 큐 | 스트림 길이')] }),
    webPart(f, 'new:ci', 'CI 관문', '| CI 관문 | 「e2e', { claims: [withdrawn('s61', '| CI 관문 | 「e2e', { withdrawalKind: 'report' })] }),
    webPart(f, 'new:worker', '작업자', '| 작업자 | 루프', { claims: [withdrawn('s62', '| 작업자 | 재시도 지수', { withdrawalKind: 'design' })] })];
  const plan = webPlan(f, parts), fragments = webFragments(parts);
  const { wire, exclusions } = combineRenderedReading(fragments, { ...empty(), summary: '' }, f.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['parts[0].claims[0].withdrawalKind', 'withdrawal-kind'], ['parts[1].claims[0].withdrawalKind', 'withdrawal-kind']]);
  assert.ok(exclusions.every(x => x.record), 'each names the withdrawal row');
  assert.deepEqual(M.validateMapReply(wire, f.ask).parts.map(p => p.claims[0].withdrawalKind), [null, null, null, 'report', 'design'], 'the claims stay; MAXLEN names no kind word');
  // KORU (koru-orch-v3 §6 「철회(코드 상한과 같음)」): design stays; implementation is left out.
  const k = koru35(), kPlan = plan35(k), kFragments = fragments35(k);
  kFragments[0].parts[2].claims[0].withdrawalKind = 'design';
  assert.equal(combineRenderedReading(kFragments, { ...empty(), summary: '' }, k.ask, kPlan).exclusions.filter(x => x.category === 'withdrawal-kind').length, 0);
  kFragments[0].parts[2].claims[0].withdrawalKind = 'implementation';
  assert.deepEqual(combineRenderedReading(kFragments, { ...empty(), summary: '' }, k.ask, kPlan).exclusions.filter(x => x.category === 'withdrawal-kind').map(x => x.path), ['parts[2].claims[0].withdrawalKind']);
});

test('.37 shared noun, final form: the last item\'s last Hangul word goes on every earlier item unless one holds it or ends in its own class word; the KORU 「전날 체결」 and 「GTX 진입」 are bare prefixes of their line\'s items', () => {
  assert.deepEqual(M.sharedItems('전날 체결·마크 원자료'), ['전날 체결 원자료', '마크 원자료']);
  assert.deepEqual(M.sharedItems('GTX 진입·HARD STOP_MARKET·TP GTX 주문'), ['GTX 진입 주문', 'HARD STOP_MARKET 주문', 'TP GTX 주문']);
  assert.deepEqual(M.sharedItems('aggTrade·markPrice@1s·forceOrder·bookTicker 스트림'), ['aggTrade 스트림', 'markPrice@1s 스트림', 'forceOrder 스트림', 'bookTicker 스트림']);
  assert.deepEqual(M.sharedItems('주소 검증·송장 발급 요청'), ['주소 검증 요청', '송장 발급 요청']);
  for (const whole of ['주문 요청·관리자 요청·플래그 값·관리자 세션 키', 'orders 행·결제 세션 요청·관리자 세션 키', 'tracking_events 행·shipments 행·events 메시지', 'shipments 행·tracking_events 행',
    'checkout_enabled 끄기·켜기', 'A/server.ts·config.ts·middleware/rate.ts', 'cards·counter·review 행·LEDGER', '원자료·σ·runner cards', 'events:dlq·x 메시지'])
    assert.deepEqual(M.sharedItems(whole), whole.split('·'), whole);
  assert.deepEqual(M.CLASS_NOUNS, ['행', '메시지', '스트림', '파일', '줄', '요청', '응답', '값', '키', '결과', '답']);
  // koru-orch-v3 §2 and §4: marketws's 「전날 체결」 and 바이낸스's 「GTX 진입」「HARD STOP_MARKET」 (the .36 regressions) go; the full names stay.
  const k = koruText(['2. 부분', '| 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태 단어 | 상태의 기준 시각 | 꼬리표 |', '|---|---|---|---|---|---|',
    '| 엔진 | 행 셋 합성 → J1 → 집행자 하나 → 주문·TP·HARD | koru-wt/d4/code/exec/live_direct/ (라이브 sha 618df374) | 돌고 있음 | 11-03 08:49Z | [보고: ops 세션 STATUS 11-03 08:49Z] |',
    '| 종이 생산자 | 전날 재생 경주 행 | 미니PC koru-paper/replay.py (8f9d3697) | 돌고 있음 | 11-03 02:47Z | [보고: 감독자 세션 SUPERVISOR-LOG 11-03 02:47Z] |',
    '| marketws 수집기 | KORU aggTrade·markPrice1s·forceOrder·bookTicker | 미니PC koru-shadow-marketws-koru(-public) | 돌고 있음 | 11-03 07:23Z | [보고: ops 세션 STATUS 11-03 07:23Z] |',
    '| 바이낸스 | 거래소(주문·체결·스트림) | 외부 | 돌고 있음 | 11-03 08:49Z | [보고: ops 세션 STATUS 11-03 08:49Z] |',
    '4. 연결', '| 보내는 부분 | 받는 부분 | 넘기는 것 | 언제·얼마나 자주 | 설계/관찰 | 꼬리표 |', '|---|---|---|---|---|---|',
    '| marketws 수집기 | 종이 생산자 | 전날 체결·마크 원자료 | 매일 02:10Z | 설계 | [파일: koru-hold/NOW/KICKOFF/KEEP-DELETE.md] |',
    '| 엔진 | 바이낸스 | GTX 진입·HARD STOP_MARKET·TP GTX 주문 | 카드가 쪽을 낼 때 | 관찰 | [보고: 감독자 세션 SUPERVISOR-LOG 11-02 14:20Z] |'].join('\n'));
  const part = (ref, name, head, extra) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [k.at(head)], claims: [], ...extra });
  const parts = [part('new:marketws', 'marketws 수집기', '| marketws 수집기 | KORU', { outputs: ['전날 체결', '마크 원자료'] }), part('new:paper', '종이 생산자', '| 종이 생산자 | 전날'),
    part('new:engine', '엔진', '| 엔진 | 행 셋'), part('new:binance', '바이낸스', '| 바이낸스 | 거래소', { inputs: ['GTX 진입', 'HARD STOP_MARKET', 'TP GTX 주문'] })];
  const plan = { global: [], parts: parts.map(p => ({ ref: p.ref, name: p.name, parent: null, at: [p.basis[0]], focus: p.name })) };
  const global = { ...empty(), summary: '', relations: [
    { from: 'new:marketws', to: 'new:paper', kind: 'flow', note: '', at: k.at('| marketws 수집기 | 종이'), payload: '전날 체결·마크 원자료', cadence: '매일 02:10Z', mode: 'design', channel: 'data' },
    { from: 'new:engine', to: 'new:binance', kind: 'flow', note: '', at: k.at('| 엔진 | 바이낸스'), payload: 'GTX 진입·HARD STOP_MARKET·TP GTX 주문', cadence: '카드가 쪽을 낼 때', mode: 'observed', channel: 'data' }] };
  const { wire, exclusions } = combineRenderedReading([{ ...empty(), parts: parts.slice(0, 3) }, { ...empty(), parts: parts.slice(3) }], global, k.ask, plan);
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [['parts[0].outputs[0]', 'outputs'], ['parts[3].inputs[0]', 'inputs'], ['parts[3].inputs[1]', 'inputs']]);
  assert.deepEqual([wire.parts[0].outputs, wire.parts[3].inputs], [['마크 원자료'], ['TP GTX 주문']]);
  const named = structuredClone(parts); named[0].outputs = ['전날 체결 원자료', '마크 원자료']; named[3].inputs = ['GTX 진입 주문', 'HARD STOP_MARKET 주문', 'TP GTX 주문'];
  assert.deepEqual(combineRenderedReading([{ ...empty(), parts: named.slice(0, 3) }, { ...empty(), parts: named.slice(3) }], global, k.ask, plan).exclusions, [], 'the shared names stand');
});

test('.37 dropped: what a render first pass held and its correction no longer does is named by part (steps, claims by their row, kept states); a row the correction still cites elsewhere is kept', () => {
  const k = koru35(), first = structuredClone(fragments35(k)[1]);
  first.parts[0].steps = [{ name: '집행', does: '주문·HARD 상주', uses: ['engine.py(이번에 안 읽음)'], at: k.at('| 엔진 | 10 |') }];
  first.parts[0].stateVars = [{ name: '재진입 카운터', scope: null, readBy: [], changedBy: [] }];
  const kept = structuredClone(first);
  kept.parts[0].steps = []; kept.parts[0].stateVars = [];
  // s64 (the engine's STOP_NOT_RESIDENT row) moved to its conditions: kept. The scorecard's 「읽기용, 판정 아님」 row (s63): dropped.
  kept.parts[0].conditions = [{ when: 'not 1 <= stop <= 250', then: 'STOP_NOT_RESIDENT', else: 'J1 답', at: k.at('| 엔진 | not 1') }];
  kept.parts[0].claims = kept.parts[0].claims.filter(c => c.key !== 's64'); kept.parts[1].claims = [];
  assert.deepEqual(droppedItems(first, kept), [{ path: 'parts', rule: 'dropped', expected: 6, actual: 3,
    names: ['new:engine step 「집행」', 'new:engine stateVar 「재진입 카운터」', `new:sheet claim ${k.at('| 성적표 | 하루')}: 원문 행을 옮긴다(s63).`] }]);
  assert.deepEqual([droppedItems(first, first), droppedItems(undefined, kept), droppedItems(first, null)], [[], [], []]);
});

// ---- first-map-divided.38 (map-reading.13; an io exclusion may carry its value), from the blind judging of the .37 maps (KORU 20/20
// and design 17/18, the web app 19/20 and design 16/18): the io checks set aside seven KORU and four web items the records write (the
// shared noun 필요·등록·조회·확인·대조 lengthened a cell's fragments and the fragments were then taken for prefixes), the cadence check
// named four right store → reader nulls, the web refund line was lost for its control channel, and the summary sentences, port-map rows,
// rule devices and a range claim went unseen. The rows below copy the KORU and web-app rows as written (koru-orch-v3 §1, §2, §4;
// webapp-status-v3 §4); no model quality is claimed. ----
const K38 = ['KORU 프로젝트 현황 보고서 (v3 표 형식, 검토 세션 작성, 2026-11-03 09:0xZ 기준)', '1. 한 줄 요약',
  '바이낸스 무기한 선물에서 경주를 층별 행 파일과 엔진 하나로 하는 단타 유기체다 [파일: koru-hold/NOW/KICKOFF/FLOW-DESIGN.md]. 11-02에 e=1.00 실거래를 켜 첫 사이클 −0.433 USDT였고 대기 중이다 [보고: 감독자 세션 SUPERVISOR-LOG 11-03 07:28Z].',
  '2. 부분', '| 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태 단어 | 상태의 기준 시각 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| 소유자 | 지시 한 줄·잔고 입출금으로 노출 조절·전원 관리 | — | 돌고 있음 | 11-03 07:1xZ | [보고: 감독자 세션 SUPERVISOR-LOG 11-03 07:13Z] |',
  '| 감독자 세션 | 세션 조율·결정·소유자 보고 | koru-hold/BUILD/SUPERVISOR-LOG.md | 돌고 있음 | 11-03 07:33Z | [파일: koru-hold/BUILD/SUPERVISOR-LOG.md] |',
  '| design 세션 | 매매 책임자, 명세·읽기 한 쪽 | koru-hold/NOW/KICKOFF/koru-design.md | 돌고 있음 | 11-03 00:58Z | [보고: 감독자 세션 SUPERVISOR-LOG 11-03 00:58Z] |',
  '| 검토 세션 | 감독자 보고 평가 | — | 돌고 있음 | 11-03 09:0xZ | [추정] |',
  '| 질감 v3 | σ·상태 행 | 미니PC koru-texture | 돌고 있음 | 11-03 07:23Z | [보고: ops 세션 STATUS 11-03 07:23Z] |',
  '| 엔진 | 행 셋 합성 → J1 → 집행자 하나 → 주문·TP·HARD | koru-wt/d4/code/exec/live_direct/ | 돌고 있음 | 11-03 08:49Z | [보고: ops 세션 STATUS 11-03 08:49Z] |',
  '4. 연결', '| 보내는 부분 | 받는 부분 | 넘기는 것 | 언제·얼마나 자주 | 설계/관찰 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| 감독자 세션 | 소유자 | 한 줄 보고·결정 필요 | 사건·결정 때 | 관찰 | [보고: 감독자 세션 SUPERVISOR-LOG 11-03 03:01Z] |',
  '| 소유자 | 검토 세션 | 감독자 보고 붙여 넣기·평가 요청 | 수시 | 관찰 | [추정] |',
  '| design 세션 | 감독자 세션 | 읽기 한 쪽·메모·사전 등록 | 하루 장 뒤 | 관찰 | [보고: 감독자 세션 SUPERVISOR-LOG 11-03 00:58Z] |',
  '| 질감 v3 | 엔진 | state.jsonl state_id·sigma_now_ticks | 분마다 | 관찰 | [파일: T ROW_KEYS] |',
  '5. 조건·거부·분기', '| 부분 이름 | 조건 | 참이면 | 거짓이면 | 꼬리표 |', '|---|---|---|---|---|',
  '| 엔진 | not 1 <= stop <= 250 | STOP_NOT_RESIDENT | J1 답 | [파일: R] |',
  '| 엔진 | 지난 계획 끝에서 간격 안 | 기다림 | J1 답 | [파일: R] |'].join('\n');
const k38 = () => {
  const f = koruText(K38);
  const parts = [webPart(f, 'new:owner', '소유자', '| 소유자 | 지시'), webPart(f, 'new:supervisor', '감독자 세션', '| 감독자 세션 | 세션'), webPart(f, 'new:design', 'design 세션', '| design 세션 | 매매'),
    webPart(f, 'new:review', '검토 세션', '| 검토 세션 | 감독자'), webPart(f, 'new:texture', '질감 v3', '| 질감 v3 | σ'),
    webPart(f, 'new:state', 'state.jsonl 행', '| 질감 v3 | 엔진', { type: 'store', typeAt: f.at('| 질감 v3 | 엔진') }), webPart(f, 'new:engine', '엔진', '| 엔진 | 행 셋')];
  return { f, parts };
};
const kLine = (f, from, to, head, extra = {}) => ({ from, to, kind: 'flow', note: '', at: f.at(head), channel: 'control', mode: 'observed', ...extra });

test('.38 shared noun: only an artifact or unit noun is shared (a two-word 「경주 행」 whole, a -기 act takes none, a time word stays on its item); 필요·등록·조회·확인·대조 share nothing', () => {
  assert.deepEqual(M.SHARED_NOUNS, ['행', '메시지', '스트림', '파일', '줄', '원자료', '주문', '요청', '결과', '이벤트', '응답', '경주 행', '체결 행', '카드 행', '알림톡']);
  // The .37 KORU and web cells, as written: nothing is shared.
  for (const whole of ['한 줄 보고·결정 필요', '읽기 한 쪽·메모·사전 등록', '감독자 보고 붙여 넣기·평가 요청', '주문서 입력·배송 조회', '환불·수동 상태 변경·주소 제안 확인',
    'CSV 내려받기·결제사 정산액 대조', '작업 진행·배포 실행', 'CSV 내려받기·정산 파일'])
    assert.deepEqual(M.sharedItems(whole), whole.split('·'), whole);
  assert.deepEqual(M.sharedItems('journal·outcomes 경주 행'), ['journal 경주 행', 'outcomes 경주 행'], 'the two-word unit phrase whole');
  assert.deepEqual(M.sharedItems('전날 체결·마크 원자료'), ['전날 체결 원자료', '마크 원자료'], 'the time word stays on its own item');
  assert.deepEqual(M.sharedItems('체결·전날 마크 원자료'), ['체결 원자료', '전날 마크 원자료'], 'and is never shared');
  assert.deepEqual(M.sharedItems('GTX 진입·HARD STOP_MARKET·TP GTX 주문'), ['GTX 진입 주문', 'HARD STOP_MARKET 주문', 'TP GTX 주문']);
  assert.deepEqual(M.sharedItems('주소 검증·송장 발급 요청'), ['주소 검증 요청', '송장 발급 요청']);
  assert.deepEqual(M.sharedItems('order.paid·shipment.updated 이벤트'), ['order.paid 이벤트', 'shipment.updated 이벤트']);
  assert.deepEqual(M.sharedItems('주문 확인·발송 시작 알림톡'), ['주문 확인 알림톡', '발송 시작 알림톡']);
  assert.deepEqual(M.sharedItems('journal·주문행'), ['journal', '주문행'], 'a one-word last item names itself');
  assert.deepEqual(M.sharedItems('journal·경주 체결행'), ['journal 체결행', '경주 체결행'], 'a word ending in 행 that is no act word');
});

test('.38 io: an item standing as written in its part\'s design cell or a connection row\'s 넘기는 것 cell is never a bare prefix; the KORU owner, supervisor and design session keep all seven items', () => {
  const { f, parts } = k38(), plan = webPlan(f, parts), byRef = new Map(parts.map(p => [p.ref, p]));
  Object.assign(byRef.get('new:owner'), { inputs: ['한 줄 보고', '결정 필요'], outputs: ['지시 한 줄', '감독자 보고 붙여 넣기', '평가 요청'] });
  Object.assign(byRef.get('new:supervisor'), { inputs: ['읽기 한 쪽', '메모', '사전 등록'], outputs: ['한 줄 보고', '결정 필요'] });
  Object.assign(byRef.get('new:design'), { outputs: ['읽기 한 쪽', '메모', '사전 등록'] });
  const global = { ...empty(), summary: '', relations: [
    // The model's own payload names a longer item (「한 줄 보고 묶음」): the row's 「한 줄 보고」 still stands.
    kLine(f, 'new:supervisor', 'new:owner', '| 감독자 세션 | 소유자', { payload: '한 줄 보고 묶음·결정 필요', cadence: '사건·결정 때' }),
    kLine(f, 'new:owner', 'new:review', '| 소유자 | 검토 세션', { payload: '감독자 보고 붙여 넣기·평가 요청', cadence: '수시' }),
    kLine(f, 'new:design', 'new:supervisor', '| design 세션 | 감독자 세션', { payload: '읽기 한 쪽·메모·사전 등록', cadence: '하루 장 뒤' })] };
  const fragments = webFragments(parts), { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  assert.deepEqual(exclusions.filter(x => ['inputs', 'outputs'].includes(x.category)), []);
  const of = ref => wire.parts.find(p => p.ref === ref);
  assert.deepEqual([of('new:owner').inputs, of('new:owner').outputs, of('new:supervisor').inputs, of('new:supervisor').outputs, of('new:design').outputs],
    [['한 줄 보고', '결정 필요'], ['지시 한 줄', '감독자 보고 붙여 넣기', '평가 요청'], ['읽기 한 쪽', '메모', '사전 등록'], ['한 줄 보고', '결정 필요'], ['읽기 한 쪽', '메모', '사전 등록']]);
  // A fragment no cell of the part holds is still checked: the review session's 「감독자 보고」 is a bare prefix of its line's
  // 「감독자 보고 붙여 넣기」; its exclusion carries the value and the 넘기는 것 cell it came from.
  byRef.get('new:review').inputs = ['감독자 보고', '평가 요청'];
  const cut = combineRenderedReading(webFragments(parts), global, f.ask, plan);
  const io = cut.exclusions.filter(x => ['inputs', 'outputs'].includes(x.category));
  assert.deepEqual(io.map(x => [x.path, x.value]), [['parts[3].inputs[0]', '감독자 보고']]);
  const text = M.askRecords(f.ask).get('N01').text;
  assert.equal(text.slice(io[0].from, io[0].to), '감독자 보고 붙여 넣기·평가 요청');
  assert.deepEqual(Object.keys(io[0]), ['path', 'rule', 'category', 'explanation', 'record', 'from', 'to', 'value']);
  assert.deepEqual(cut.wire.parts.find(p => p.ref === 'new:review').inputs, ['평가 요청']);
  // The shared noun's own fragment is still a bare prefix (koru-orch-v3 §4 「전날 체결·마크 원자료」: the .37 rule stands).
  assert.ok(!M.sharedItems('전날 체결·마크 원자료').includes('전날 체결'));
});

test('.38 io exclusions carry their value: stored exactly in map-reading.13 (only on an input or output, ≤60, never secret-like); others keep their shape', () => {
  const { f, parts } = k38(), plan = webPlan(f, parts);
  parts[3].inputs = ['감독자 보고', '평가 요청'];
  const global = { ...empty(), summary: '', relations: [kLine(f, 'new:owner', 'new:review', '| 소유자 | 검토 세션', { payload: '감독자 보고 붙여 넣기·평가 요청', cadence: '수시' })] };
  const { wire, exclusions } = combineRenderedReading(webFragments(parts), global, f.ask, plan);
  const read = M.validateMapReply(wire, f.ask);
  M.attachExclusions(read, exclusions, f.ask);
  const applied = M.applyReading(f.project, f.input, read, meta37('R_value38', '8'));
  assert.equal(applied.reading.version, 'map-reading.19');
  const stored = applied.reading.exclusions.find(x => x.path === 'parts[3].inputs[0]');
  assert.deepEqual([stored.value, stored.record !== null, Object.keys(stored).length], ['감독자 보고', true, 8]);
  assert.deepEqual(validateProject(applied.project), applied.project);
  assert.ok(applied.reading.exclusions.filter(x => x.path !== 'parts[3].inputs[0]').every(x => !Object.hasOwn(x, 'value')));
  // Storage refuses a value elsewhere, past 60 or secret-like; attaching refuses the same.
  const bad = mutate => { const p = structuredClone(applied.project); mutate(p.readings.at(-1).exclusions); return () => validateProject(p); };
  assert.throws(bad(xs => { xs.find(x => x.path === 'parts[3].inputs[0]').value = '가'.repeat(61); }));
  assert.throws(bad(xs => { xs.find(x => x.path === 'parts[3].inputs[0]').value = `sk-${'A'.repeat(24)}`; }));
  const other = applied.reading.exclusions.findIndex(x => x.path !== 'parts[3].inputs[0]');
  if (other >= 0) assert.throws(bad(xs => { xs[other].value = '값'; }));
  const io = exclusions.find(x => x.path === 'parts[3].inputs[0]');
  assert.throws(() => M.attachExclusions(M.validateMapReply(wire, f.ask), [{ ...io, value: `sk-${'A'.repeat(24)}` }], f.ask));
  assert.throws(() => M.attachExclusions(M.validateMapReply(wire, f.ask), [{ ...io, path: 'parts[3].claims[0]', value: '값' }], f.ask));
});

test('.38 cadence: only a line on its own connection row (its sender the row\'s, its receiver the row\'s or a store) is named for a null cadence; a store → reader line is not', () => {
  const { f, parts } = k38(), plan = webPlan(f, parts);
  const data = (from, to, extra) => kLine(f, from, to, '| 질감 v3 | 엔진', { payload: 'state.jsonl state_id·sigma_now_ticks', channel: 'data', ...extra });
  const read = relations => combineRenderedReading(webFragments(parts), { ...empty(), summary: '', relations }, f.ask, plan).exclusions.filter(x => x.category === 'cadence').map(x => x.path);
  // The .37 KORU state_rows → engine: the write line carries 「분마다」, the read line's null is right.
  assert.deepEqual(read([data('new:texture', 'new:state', { cadence: '분마다' }), data('new:state', 'new:engine', { cadence: null })]), []);
  // The write line through the store is the row's own: its null is named; so is the row's own direct line.
  assert.deepEqual(read([data('new:texture', 'new:state', { cadence: null })]), ['relations[0].cadence']);
  assert.deepEqual(read([data('new:texture', 'new:engine', { cadence: null, payload: 'state_id·sigma_now_ticks' })]), ['relations[0].cadence']);
});

test('.38 summary sentences: each 「한 줄 요약」 sentence naming a part is a plan-claims unit of that part (never refusing a render) and listed by uncited until a claim quotes it', () => {
  const { f, parts } = k38(), plan = webPlan(f, parts);
  const sentences = summarySentences(f.ask, parts.map(p => p.name));
  // The first names 엔진 outside its tag; the second names no part outside its tag (.39: the tag's 감독자 세션 is its reporter, never its
  // subject): a project sentence, no part's row.
  assert.deepEqual(sentences.map(s => [s.name, s.project, s.text.slice(0, 12)]), [['엔진', false, '바이낸스 무기한 선물에'], [null, true, '11-02에 e=1.0']]);
  const missing = planClaims(f.ask, plan, parts).missing;
  assert.ok(missing.some(n => n.startsWith('new:engine: 바이낸스 무기한 선물에서')) && !missing.some(n => n.includes('11-02에 e=1.00 실거래')), String(missing));
  assert.deepEqual(planShort(f.ask, plan, parts, null).filter(n => /바이낸스|11-02에/.test(n)), [], 'diagnostic only');
  const uncited = uncitedFacts(f.ask, parts);
  assert.deepEqual(uncited.uncited.filter(n => n.startsWith('한 줄 요약: ')).length, 1);
  assert.deepEqual(uncitedFacts(f.ask, parts, new Set(['엔진'])).uncited.filter(n => n.startsWith('한 줄 요약: ')).length, 1, 'a fragment hears its own');
  // A claim quoting the sentence lands it.
  const quoted = structuredClone(parts); quoted[6].claims = [{ key: 's1', kind: 'reported', text: '단타 유기체다.', at: f.at('바이낸스 무기한'), about: null, replaces: null }];
  assert.ok(!planClaims(f.ask, plan, quoted).missing.some(n => n.startsWith('new:engine: 바이낸스')));
  assert.equal(uncitedFacts(f.ask, quoted).uncited.filter(n => n.startsWith('한 줄 요약: ')).length, 0);
});

test('.38 portmap-missing and anchor-enforce: a store → stepped part data line with no port-map row, and a rule on a code condition row with no code device, are named (diagnostic only)', () => {
  const { f, parts } = k38(), list = structuredClone(parts), engine = list[6];
  engine.steps = [{ name: '봉투 검사', does: '동시·레버리지', uses: ['row_answer'], at: f.at('| 엔진 | not 1') }];
  const lines = [kLine(f, 'new:texture', 'new:state', '| 질감 v3 | 엔진', { channel: 'data', payload: 'state.jsonl' }), kLine(f, 'new:state', 'new:engine', '| 질감 v3 | 엔진', { channel: 'data', payload: 'state.jsonl' })];
  const rule = anchorAt => ({ key: 's9', kind: 'want', text: '스탑은 1~250 bp 안에 상주해야 한다.', at: f.at('| 엔진 | not 1'), about: null, replaces: null, topic: 'rule', scope: 'part', scopeName: null,
    anchors: [{ kind: 'inferred', text: '엔진 · not 1 <= stop <= 250', at: anchorAt, program: true }], enforcedBy: [{ kind: 'unknown', text: '장치 미상', at: null }] });
  engine.claims = [rule(f.at('| 엔진 | not 1'))];
  const diag = (portMap, ps = list) => readingDiagnostics({ ask: f.ask, summary: '', parts: ps, relations: lines, portMap });
  const named = (rule, xs) => xs.find(x => x.rule === rule) ?? null;
  // .39: the engine's one step uses row_answer, no use of the state store's stem: the records name no step for this line (information).
  assert.deepEqual(named('portmap-missing', diag([])), { path: 'portMap', rule: 'portmap-missing', expected: 0, actual: 0, names: ['원문이 단계를 대지 않음: new:state → new:engine: state.jsonl'] });
  assert.equal(named('portmap-missing', diag([{ relation: 1, direction: 'in', port: 'state 행', step: '봉투 검사', at: f.at('| 엔진 | not 1') }])), null);
  assert.deepEqual(named('anchor-enforce', diag([])).names, [`new:engine s9: ${f.at('| 엔진 | not 1')} not 1 <= stop <= 250 → STOP_NOT_RESIDENT`]);
  // A code device, or a place whose outcome is no code (「기다림」), names nothing.
  const coded = structuredClone(list); coded[6].claims[0].enforcedBy = [{ kind: 'code', text: 'STOP_NOT_RESIDENT', at: f.at('| 엔진 | not 1') }];
  assert.equal(named('anchor-enforce', diag([], coded)), null);
  const waiting = structuredClone(list); waiting[6].claims = [rule(f.at('| 엔진 | 지난 계획'))];
  assert.equal(named('anchor-enforce', diag([], waiting)), null);
  assert.ok(FINAL_DIAGNOSTICS.includes('portmap-missing') && FINAL_DIAGNOSTICS.includes('anchor-enforce'));
  // The program's places (a checked reply's anchors, each by its quote) are read too: finalDiagnostics passes the checked parts.
  const row = M.conditionRows(f.ask)[0];
  const readParts = [{ ref: 'new:engine', claims: [{ key: 's9', topic: 'rule', anchors: [{ kind: 'inferred', text: row.condition, quote: { record: row.record, quote: '', from: row.from, to: row.to }, program: true }], enforcedBy: [] }] }];
  assert.deepEqual(named('anchor-enforce', readingDiagnostics({ ask: f.ask, summary: '', parts, relations: [], readParts })).names, [`new:engine s9: ${row.at} not 1 <= stop <= 250 → STOP_NOT_RESIDENT`]);
});

test('.38 dropped by range: given the ask, a claim whose range a correction still cites (by another alias) is kept, and one whose range is gone is named by its quote\'s first 40 characters', () => {
  const { f, parts } = k38(), first = { ...empty(), parts: structuredClone(parts.slice(6)) }, at = f.at('| 엔진 | not 1'), next = f.at('| 엔진 | 지난 계획');
  first.parts[0].claims = [{ key: 's1', kind: 'want', text: '모델의 문장', at, about: null, replaces: null }];
  const kept = structuredClone(first); kept.parts[0].claims = [{ ...first.parts[0].claims[0], at: `${at}-${next.split('.')[1]}` }];
  assert.deepEqual(droppedItems(first, kept, f.ask), [], 'the range is still cited');
  assert.equal(droppedItems(first, kept).length, 1, 'without the ask the alias alone is compared (.37)');
  const lost = structuredClone(first); lost.parts[0].claims = [];
  assert.deepEqual(droppedItems(first, lost, f.ask)[0].names, [`new:engine claim ${at}: 「${'| 엔진 | not 1 <= stop <= 250 | STOP_NOT_RESIDENT | J1 답 | [파일: R] |'.slice(0, 40)}」`]);
});

// ---- first-map-divided.39 (map-reading.14), from the blind judging of the .38 maps (KORU 20/20, design 18/18, signs 10/10 with portMap
// 0 rows, the model's global having sent []; the web app 19/20 and design 18/18): the program's steps from a 3절 arrow chain and its
// port-map rows from the step table, file-map roles, one range one home, the 「한 줄 요약」 subject rule, refusal outcomes, merged
// payloads, query channels and run gates. The rows below copy the KORU and web-app records' rows as written (koru-orch-design-v1 §1-§6,
// koru-orch-v3 §1 and §10, webapp-design-v1 §1-§5, webapp-status-v3 §1, §4 and §9); no model quality is claimed. ----
const KORU39 = ['KORU 설계 기록 v1 (검토 세션, 2026-11-03 09:xxZ; 코드는 git show로 라이브 sha를 읽음)',
  '1. 한 줄 요약',
  '바이낸스 KORUUSDT 무기한 선물에서 경주를 층별 행 파일과 엔진 하나로 하는 단타 유기체다 [파일: koru-hold/NOW/KICKOFF/FLOW-DESIGN.md]. 11-02에 e=1.00 실거래를 켜 첫 사이클 −0.433 USDT였고 대기 중이다 [보고: 감독자 세션 SUPERVISOR-LOG 11-03 07:28Z]. 성적표는 첫 장 SHEET-2026-11-02를 냈다 [보고: 감독자 세션 SUPERVISOR-LOG 11-03 07:33Z].',
  '2. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|',
  '| 감독자 세션 | 세션 | 조율·결정·보고 [파일: koru-hold/BUILD/SUPERVISOR-LOG.md] |',
  '| 검토 세션 | 세션 | 평가·자문 [추정] |',
  '| 엔진 | 루프·엔진 | 행 셋 → J1 → 집행 [파일: R] |',
  '| 카드 러너 | AI 판단 | tick·dispatch·gate 세 명령, 세 팔 카드 [파일: C/card_runner.py] |',
  '| 편집장 | AI 판단 | 하루 계획 plan 행 [파일: C/card_runner.py] |',
  '| 정책 행 작성기 | 타이머·일정 | 00:30Z 정책 한 행 [파일: O/policy-daily/koru-policy-daily.timer] |',
  '| 질감 v3 | 계산 | 분마다 TX 라벨 [파일: T] |',
  '| 성적표 | 계산 | 하루 장 02:15Z [파일: O/daysheet/koru-daysheet.timer] |',
  '3. 산출물', '| 이름 | 필드 | 만드는 부분 | 읽는 부분 | 있는 곳 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| review.jsonl 행 | watch·allowed_side·reason·sources·ts_ms·valid_until·row_id·charter_sha·authors·seq | 카드 러너 | 엔진·종이 생산자 | /var/lib/koru-desk/race/review.jsonl | [파일: C/card_runner.py] |',
  '| policy.jsonl 행 | row_id·valid_until·authors·reason·state_id·entry_mode | 정책 행 작성기 | 엔진 | /var/lib/koru-desk/race/policy.jsonl | [파일: O/policy-daily/policy-daily.sh] |',
  '| state.jsonl 행 | row_id·ts_ms·seq·valid_until·charter_sha·state_id·side | 질감 v3 | 엔진 | /var/lib/koru-desk/race/state.jsonl | [파일: T ROW_KEYS] |',
  '| texture-events.jsonl | bar_close_ms·sigma_now_ticks·sigma_n·fill15 | 질감 v3 | 카드 러너·종이 생산자 | /var/lib/koru-desk/sidecar/texture-events.jsonl | [파일: T] |',
  '| cards-{CX,CL,DS}.jsonl | schema·card_id·arm·beat·packet_sha | 카드 러너 | 카드 러너·종이 생산자·성적표 | /var/lib/koru-desk/cards/ | [파일: C/card_runner.py] |',
  '| plan.jsonl | topics·pulls·wake_rules·card_questions·reason | 편집장 | 카드 러너 | /var/lib/koru-desk/cards/ | [파일: C/schemas.json] |',
  '| facts.jsonl | fact_id·value·observed_utc·source | 주문형 수집 | 카드 러너 | /var/lib/koru-desk/cards/ | [파일: C/schemas.json] |',
  '4. 부분별 설계', '| 이름 | 받는 산출물 | 안의 단계 | 내는 산출물 | 설정 | 꼬리표 |', '|---|---|---|---|---|---|',
  '| 엔진 | review·policy·state 행, 패킷 | 4절 | J1 답 → 주문 | 618df374, 레버리지 20, 동시 1, j1_cadence 60 s | [파일: R] |',
  '| 카드 러너 | 패킷 원천·plan·facts·posture | 4절 | cards·counter·review 행·LEDGER | 타이머 tick :00·dispatch :05·gate 01/16/31/46분 :02 | [파일: C/systemd/*.timer] |',
  '| 편집장 | 달력·지난 24 h LEDGER | 날짜 확인 → 1회 호출 → PLAN_FORBIDDEN 검사 → plan 행(실패면 FALLBACK) | plan.jsonl | CARD_EDITOR on(11-03 01:21Z) | [파일: C/card_runner.py editor] |',
  '| 정책 행 작성기 | — | 고정 값 JSON → row_append | policy.jsonl | 00:30Z, valid 24 h, TX:ACTIVE·MAKER_TOUCH 60·T 7200·u=d 1.0 | [파일: O/policy-daily/policy-daily.sh 4d27a6bc] |',
  '| 질감 v3 | marketws 흐름·baseline.json | 분 bar 열 계산 → classify → 행 append | state.jsonl·texture-events.jsonl | 명세 136feaf0, SIGMA_MIN_N | [파일: T] |',
  '| 성적표 | 경주 행·종이 행·cards | race_rows → aggregate → boot_se → render | SHEET-<날>.md | 02:15Z, seed 20261101, B 2000 | [파일: git 8f9d3697:code/tools/paper/sheet.py] |',
  '5. 안의 단계', '| 부분 이름 | 순번 | 단계 이름 | 하는 일 한 줄 | 쓰는 파일·함수·모델 | 조건·분기 | 꼬리표 |', '|---|---|---|---|---|---|---|',
  '| 엔진 | 4 | review 읽기 | 마지막 행·나이 | row_read·row_live(1800 s)·row_review | REVIEW_OFF·NONE_SIDE·LINE_STALE | [파일: R] |',
  '| 엔진 | 6 | policy·state | 상태별 정책 행과 신호 행 | row_policy·row_state | SIGNAL_STALE·ENTRY_NOT_IMPLEMENTED | [파일: R] |',
  '| 카드 러너 | 3 | 패킷 | 원천 스냅샷 → build | packet_sources.snapshot·build | 6,000자 넘으면 PACKET_OVER_6000 | [파일: C/card_runner.py] |',
  '| 카드 러너 | 9 | 카드 행 | cards-<팔>.jsonl append | card_append | — | [파일: C/card_runner.py] |',
  '| 카드 러너 | 10 | review 행 | CX만 review로 | card_append·rung.row_append | review_writer true일 때만 | [파일: C/card_runner.py] |',
  '| 카드 러너 | 11 | tick | 매분 checkpoint·kill·만료·trigger·pull | tick·checkpoint·kill·pull_due | KILL/EXPIRED → review 갱신 | [파일: C/card_runner.py] |',
  '| 질감 v3 | 1 | bar 열 | σ20·fill15·slots15·spread·liq | Minute 계산 | — | [파일: T] |',
  '| 질감 v3 | 2 | classify | BROKEN 사유 → CALM/ACTIVE | classify | 5절 | [파일: T] |',
  '6. 조건·거부·분기', '| 부분 이름 | 조건 | 참이면 | 거짓이면 | 꼬리표 |', '|---|---|---|---|---|',
  '| 엔진 | not 1 <= stop <= 250 | STOP_NOT_RESIDENT | J1 답 | [파일: R] |',
  '7. 파일 지도', '| 경로 | 속한 부분 | 역할 한 줄 | 꼬리표 |', '|---|---|---|---|',
  '| C/calls.py | 카드 러너 | 모델 호출·지출 상한 CL 20·DS 5 USD | [파일: C/calls.py] |',
  '| git ops/texture-v3:code/.texture-v3/make_baseline_v3.py | 질감 v3 | baseline.json 1회 생성 | [파일: git ls-tree] |',
  '| koru-hold/BUILD/SUPERVISOR-LOG.md | 감독자 세션 | 결정 이력 | [파일: koru-hold/BUILD/SUPERVISOR-LOG.md] |',
  '8. 모르는 것', '| 부분 이름 | 무엇을 | 어떻게 확인할 수 있나 |', '|---|---|---|',
  '| 엔진 | 라이브 618df374 race_rung.py 실제 코드 | koru-wt/d4에서 git show 618df374 |'].join('\n');
/** The KORU wire of .39: the engine's and the card runner's steps as their 안의 단계 rows write them, seven stores, eleven data lines. */
function koru39(text = KORU39) {
  const f = koruText(text), store = (ref, name, head, path) => webPart(f, ref, name, head, { type: 'store', typeAt: f.at(head), outputs: [name], files: [path] });
  const step = (name, does, uses, head) => ({ name, does, uses, at: f.at(head) });
  const parts = [
    webPart(f, 'new:supervisor', '감독자 세션', '| 감독자 세션 | 세션'), webPart(f, 'new:review', '검토 세션', '| 검토 세션 | 세션'),
    webPart(f, 'new:engine', '엔진', '| 엔진 | 루프', { inputs: ['review 행', 'policy 행', 'state 행', '패킷'], steps: [step('review 읽기', '마지막 행·나이', ['row_read', 'row_live(1800 s)', 'row_review'], '| 엔진 | 4 |'), step('policy·state', '상태별 정책 행과 신호 행', ['row_policy', 'row_state'], '| 엔진 | 6 |')] }),
    webPart(f, 'new:card', '카드 러너', '| 카드 러너 | AI', { inputs: ['패킷 원천', 'plan', 'facts', 'posture'], outputs: ['cards', 'counter', 'review 행', 'LEDGER'],
      steps: [step('패킷', '원천 스냅샷 → build', ['packet_sources.snapshot', 'build'], '| 카드 러너 | 3 |'), step('카드 행', 'cards-<팔>.jsonl append', ['card_append'], '| 카드 러너 | 9 |'),
        step('review 행', 'CX만 review로', ['card_append', 'rung.row_append'], '| 카드 러너 | 10 |'), step('tick', '매분 checkpoint·kill·만료·trigger·pull', ['tick', 'checkpoint', 'kill', 'pull_due'], '| 카드 러너 | 11 |')] }),
    webPart(f, 'new:editor', '편집장', '| 편집장 | AI'), webPart(f, 'new:policy_writer', '정책 행 작성기', '| 정책 행 작성기 | 타이머'),
    webPart(f, 'new:texture', '질감 v3', '| 질감 v3 | 계산', { steps: [step('bar 열', 'σ20·fill15·slots15·spread·liq', ['Minute 계산'], '| 질감 v3 | 1 |'), step('classify', 'BROKEN 사유 → CALM/ACTIVE', ['classify'], '| 질감 v3 | 2 |')] }),
    webPart(f, 'new:sheet', '성적표', '| 성적표 | 계산'),
    store('new:review_rows', 'review.jsonl 행', '| review.jsonl 행', '/var/lib/koru-desk/race/review.jsonl'), store('new:policy_rows', 'policy.jsonl 행', '| policy.jsonl 행', '/var/lib/koru-desk/race/policy.jsonl'),
    store('new:state_rows', 'state.jsonl 행', '| state.jsonl 행', '/var/lib/koru-desk/race/state.jsonl'), store('new:texture_events', 'texture-events.jsonl', '| texture-events.jsonl', '/var/lib/koru-desk/sidecar/texture-events.jsonl'),
    store('new:cards', 'cards-{CX,CL,DS}.jsonl', '| cards-{CX', '/var/lib/koru-desk/cards/'), store('new:plan', 'plan.jsonl', '| plan.jsonl', '/var/lib/koru-desk/cards/'),
    store('new:facts', 'facts.jsonl', '| facts.jsonl', '/var/lib/koru-desk/cards/')];
  const line = (from, to, head, payload) => ({ from, to, kind: 'flow', note: '', at: f.at(head), channel: 'data', payload });
  const relations = [line('new:state_rows', 'new:engine', '| state.jsonl 행', 'state.jsonl 행'), line('new:policy_rows', 'new:engine', '| policy.jsonl 행', 'policy.jsonl 행'),
    line('new:review_rows', 'new:engine', '| review.jsonl 행', 'review.jsonl 행'), line('new:card', 'new:review_rows', '| review.jsonl 행', 'review.jsonl 행'),
    line('new:card', 'new:cards', '| cards-{CX', 'cards-{CX,CL,DS}.jsonl'), line('new:plan', 'new:card', '| plan.jsonl', 'plan.jsonl'),
    line('new:texture_events', 'new:card', '| texture-events.jsonl', 'texture-events.jsonl'), line('new:cards', 'new:card', '| cards-{CX', 'cards-{CX,CL,DS}.jsonl'),
    line('new:facts', 'new:card', '| facts.jsonl', 'facts.jsonl'), line('new:texture', 'new:state_rows', '| state.jsonl 행', 'state.jsonl 행'), line('new:editor', 'new:plan', '| plan.jsonl', 'plan.jsonl')];
  return { f, parts, relations, plan: webPlan(f, parts), global: { ...empty(), summary: '', relations } };
}
const meta39 = (id, n) => ({ id, at: '2026-11-04T12:00:00.000Z', model: 'stub', prompt: 'm6-000000000039', hash: n.repeat(64) });
const createdOf = (applied, parts, ref) => applied.reading.parts.find(p => p.areaId === applied.created[parts.findIndex(x => x.ref === ref)]);

test('.39 program steps (R4): a part with no 4절 row and no step whose 3절 안의 단계 cell is an arrow chain takes one step per piece on that row, marked program; the model\'s own steps and a 「4절」 cell never change', () => {
  const k = koru39(), { wire, exclusions } = combineRenderedReading(webFragments(k.parts), k.global, k.f.ask, k.plan);
  assert.deepEqual(exclusions, []);
  assert.equal(wire.parts.find(p => p.ref === 'new:sheet').steps ?? null, null, 'the wire keeps the reply as written');
  const read = M.validateMapReply(wire, k.f.ask), stepsOf = ref => read.parts.find(p => p.ref === ref).steps ?? [];
  assert.deepEqual(stepsOf('new:sheet').map(s => [s.name, s.does, s.uses, s.program]), ['race_rows', 'aggregate', 'boot_se', 'render'].map(n => [n, null, [], true]));
  assert.ok(stepsOf('new:sheet').every(s => s.quote.quote.startsWith('| 성적표 | 경주 행·종이 행·cards |')), 'each on the part\'s own 3절 row');
  // .40: a piece's parenthesised tail goes to does (stepTail).
  assert.deepEqual(stepsOf('new:editor').map(s => [s.name, s.does]), [['날짜 확인', null], ['1회 호출', null], ['PLAN_FORBIDDEN 검사', null], ['plan 행', '실패면 FALLBACK']]);
  assert.deepEqual(stepsOf('new:policy_writer').map(s => s.name), ['고정 값 JSON', 'row_append']);
  assert.deepEqual([stepsOf('new:engine').map(s => [s.name, s.program]), stepsOf('new:texture').map(s => s.name)], [[['review 읽기', undefined], ['policy·state', undefined]], ['bar 열', 'classify']],
    'a 「4절」 cell and a part with its own 4절 rows keep the model\'s steps');
  assert.deepEqual([M.programSteps(k.f.ask, '엔진'), M.programSteps(k.f.ask, '질감 v3'), M.programSteps(k.f.ask, '감독자 세션')], [[], [], []]);
  // The web app's chains (webapp-design-v1 §3): the collector, the front; the worker has 4절 rows.
  const w = web36();
  assert.deepEqual(M.programSteps(w.ask, '택배 추적 수집기').map(s => s.name), ['배송 중 송장 고르기', '택배사 조회', '단계 비교', 'tracking_events·shipments 쓰기', '바뀐 것만 shipment.updated']);
  assert.deepEqual(M.programSteps(w.ask, '웹 프런트').map(s => s.name), ['주문서', 'POST /api/orders', '결제사 이동', '추적 페이지 폴링']);
  assert.deepEqual(M.programSteps(w.ask, '작업자'), []);
  // The model may write the chain itself (the prompt asks it to): then the program adds nothing; a forged program key is passed over.
  const own = structuredClone(wire); own.parts.find(p => p.ref === 'new:sheet').steps = [{ name: 'race_rows', does: null, uses: [], at: k.f.at('| 성적표 | 경주'), program: true }];
  assert.deepEqual(M.validateMapReply(own, k.f.ask).parts.find(p => p.ref === 'new:sheet').steps.map(s => [s.name, s.program]), [['race_rows', undefined]]);
  // Stored: every step says program; the reading reads back exactly.
  const applied = M.applyReading(k.f.project, k.f.input, read, meta39('R_steps39', '1'));
  assert.equal(applied.reading.version, 'map-reading.19');
  assert.deepEqual([createdOf(applied, k.parts, 'new:sheet').steps.map(s => s.program), createdOf(applied, k.parts, 'new:engine').steps.map(s => s.program)], [[true, true, true, true], [false, false]]);
  assert.deepEqual(validateProject(applied.project), applied.project);
});

test('.39 program portMap (R1–R3): the KORU records name five port rows (state·policy·review → the engine\'s steps, the card runner → review and cards); the four lines into the card runner stay empty; the diagnostic splits the model\'s blanks from lines no step names', () => {
  const k = koru39(), { wire } = combineRenderedReading(webFragments(k.parts), k.global, k.f.ask, k.plan);
  assert.equal((wire.portMap ?? []).length, 0, 'the model sent no row (the .38 global)');
  const read = M.validateMapReply(wire, k.f.ask), rows = read.portMap.map(m => [m.relation, m.direction, m.port, m.step, m.program]);
  assert.deepEqual(rows, [[0, 'in', 'state 행', 'policy·state', true], [1, 'in', 'policy 행', 'policy·state', true], [2, 'in', 'review 행', 'review 읽기', true],
    [3, 'out', 'review 행', 'review 행', true], [4, 'out', 'cards', '카드 행', true]]);
  assert.ok(read.portMap[0].quote.quote.startsWith('| 엔진 | 6 | policy·state |'), 'a program row stands on its step\'s own row');
  assert.ok(![5, 6, 7, 8].some(i => read.portMap.some(m => m.relation === i)), 'plan, texture-events, cards and facts → 카드 러너 stay empty');
  // Stored with program; the browser's reading of the same wire makes the same rows.
  const applied = M.applyReading(k.f.project, k.f.input, read, meta39('R_ports39', '2'));
  assert.deepEqual(applied.reading.portMap.map(m => [m.port, m.step, m.direction, m.program]), rows.map(([, d, p, s]) => [p, s, d, true]));
  assert.deepEqual(validateProject(applied.project), applied.project);
  assert.deepEqual(M.validateMapReply(structuredClone(wire), k.f.ask).portMap, read.portMap);
  // A model row on a side wins; the program adds none beside it. A forged program key is passed over.
  const own = structuredClone(wire); own.portMap = [{ relation: 0, port: 'state 행', step: 'review 읽기', direction: 'in', at: k.f.at('| 엔진 | 4 |'), program: true }];
  assert.deepEqual(M.validateMapReply(own, k.f.ask).portMap.filter(m => m.relation === 0).map(m => [m.step, m.program]), [['review 읽기', undefined]]);
  // The diagnostic (finalDiagnostics reads the checked reply): 「모델이 비움 · 프로그램이 채움」 and 「원문이 단계를 대지 않음」.
  const found = finalDiagnostics(webFragments(k.parts), k.global, k.f.ask, k.plan).find(x => x.rule === 'portmap-missing');
  assert.deepEqual([found.expected, found.actual], [5, 0]);
  assert.deepEqual(found.names.filter(n => n.startsWith('모델이 비움')), [0, 1, 2, 3, 4].map(i => `모델이 비움 · 프로그램이 채움: ${k.relations[i].from} → ${k.relations[i].to}: ${k.relations[i].payload}`));
  // .40: 「원문이 단계를 대지 않음」 only where no step is tied; texture's 3절 「행 append」 and the editor's 「plan 행」 (no output names
  // plan.jsonl here, so no port) are candidates.
  assert.deepEqual(found.names.filter(n => n.startsWith('원문이 단계를 대지 않음')), [5, 6, 7, 8].map(i => `원문이 단계를 대지 않음: ${k.relations[i].from} → ${k.relations[i].to}: ${k.relations[i].payload}`));
  assert.deepEqual(found.names.filter(n => n.startsWith('단계 후보 있음')), [[9, '3절 「행 append」'], [10, 'plan 행']].map(([i, c]) => `단계 후보 있음 · 모델이 비움: ${k.relations[i].from} → ${k.relations[i].to}: ${k.relations[i].payload} (후보: ${c})`));
  // Without the checked reply (the global stage's feedback) the program's rows are computed the same way.
  const bare = readingDiagnostics({ ask: k.f.ask, summary: '', parts: wire.parts, relations: wire.relations, portMap: [] }).find(x => x.rule === 'portmap-missing');
  assert.deepEqual([bare.expected, bare.actual, bare.names.filter(n => n.startsWith('모델이 비움')).length], [5, 0, 5]);
  // The web app (webapp-design-v1 §4, webapp-status-v3 §4): events 큐 → 작업자 by XREADGROUP, 작업자 → events 큐 by its XADD retry.
  const w = web36(), step = (name, does, uses, head) => ({ name, does, uses, at: w.at(head) });
  const parts = [webPart(w, 'new:events', 'events 큐', '| events 큐 | 행', { type: 'store', typeAt: w.at('| events 큐 | 행'), outputs: ['events 메시지', 'events:dlq 메시지'] }),
    webPart(w, 'new:worker', '작업자', '| 작업자 | 루프', { inputs: ['events 메시지', 'orders 행', '플래그 값'], outputs: ['송장 요청', 'shipments 행', 'events 메시지', 'events:dlq 메시지'],
      steps: [step('읽기', 'XREADGROUP workers', ['consume'], '| 작업자 | 1 | 읽기'), step('재시도', 'attempt+1, 2^attempt s 뒤 XADD', ['retry'], '| 작업자 | 9 | 재시도')] })];
  const lines = [{ from: 'new:events', to: 'new:worker', kind: 'flow', note: '', at: w.at('| events 큐 | 작업자'), channel: 'data', payload: 'order.paid·shipment.updated(XREADGROUP workers)', cadence: '5 s 블록 읽기, 10개씩' },
    { from: 'new:worker', to: 'new:events', kind: 'flow', note: '', at: w.at('| 작업자 | 9 | 재시도'), channel: 'data', payload: 'events 메시지' }];
  const web = combineRenderedReading(webFragments(parts), { ...empty(), summary: '', relations: lines }, w.ask, webPlan(w, parts));
  assert.deepEqual(web.exclusions, []);
  assert.deepEqual(M.validateMapReply(web.wire, w.ask).portMap.map(m => [m.relation, m.direction, m.port, m.step, m.program]), [[0, 'in', 'events 메시지', '읽기', true], [1, 'out', 'events 메시지', '재시도', true]]);
});

test('.39 file roles (R5): a part\'s 「파일 지도」 rows travel with their roles (fileRoles), set aside alone off their own part\'s rows; a rule placed on its part\'s file-map row with no code device is named by anchor-enforce, a code device citing that row keeps it', () => {
  const k = koru39(), parts = structuredClone(k.parts), byRef = new Map(parts.map(p => [p.ref, p]));
  byRef.get('new:card').fileRoles = [{ path: 'C/calls.py', role: '모델 호출·지출 상한 CL 20·DS 5 USD', at: k.f.at('| C/calls.py') }];
  byRef.get('new:supervisor').fileRoles = [{ path: 'koru-hold/BUILD/SUPERVISOR-LOG.md', role: '결정 이력', at: k.f.at('| koru-hold/BUILD') }];
  byRef.get('new:texture').fileRoles = [{ path: 'git ops/texture-v3:code/.texture-v3/make_baseline_v3.py', role: 'baseline.json 1회 생성', at: k.f.at('| git ops/texture-v3') },
    { path: 'C/calls.py', role: '모델 호출', at: k.f.at('| C/calls.py') }, { path: 'T', role: '분 라벨', at: k.f.at('| git ops/texture-v3') }];
  const { wire, exclusions } = combineRenderedReading(webFragments(parts), k.global, k.f.ask, k.plan);
  const texture = parts.findIndex(p => p.ref === 'new:texture');
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [[`parts[${texture}].fileRoles[1]`, 'file-role'], [`parts[${texture}].fileRoles[2]`, 'file-role']], 'another part\'s row, and words its row lacks');
  const read = M.validateMapReply(wire, k.f.ask), roles = ref => read.parts.find(p => p.ref === ref).fileRoles.map(x => [x.path, x.role]);
  assert.deepEqual([roles('new:card'), roles('new:supervisor'), roles('new:texture')], [[['C/calls.py', '모델 호출·지출 상한 CL 20·DS 5 USD']], [['koru-hold/BUILD/SUPERVISOR-LOG.md', '결정 이력']],
    [['git ops/texture-v3:code/.texture-v3/make_baseline_v3.py', 'baseline.json 1회 생성']]]);
  M.attachExclusions(read, exclusions, k.f.ask);
  const applied = M.applyReading(k.f.project, k.f.input, read, meta39('R_roles39', '3')), cardId = applied.created[k.parts.findIndex(x => x.ref === 'new:card')];
  assert.deepEqual(M.partUnderstanding(applied.project, cardId).fileRoles.map(x => x.role), ['모델 호출·지출 상한 CL 20·DS 5 USD']);
  assert.deepEqual(validateProject(applied.project), applied.project);
  assert.deepEqual(M.fileMapRows(k.f.ask).map(r => [r.part, r.path]), [['카드 러너', 'C/calls.py'], ['질감 v3', 'git ops/texture-v3:code/.texture-v3/make_baseline_v3.py'], ['감독자 세션', 'koru-hold/BUILD/SUPERVISOR-LOG.md']]);
  // anchor-enforce: the spending cap placed on C/calls.py (the .38 program place) with a person device only is named; a code device on the row keeps it.
  const rule = enforcedBy => ({ key: 's70', kind: 'want', text: '지출은 상한 있게, 감독자 세션 승인.', at: k.f.at('| C/calls.py'), about: null, replaces: null, topic: 'rule', scope: 'part', scopeName: null,
    anchors: [{ kind: 'inferred', text: 'C/calls.py', at: k.f.at('| C/calls.py') }], enforcedBy });
  const withRule = enforcedBy => parts.map(p => p.ref === 'new:card' ? { ...p, claims: [rule(enforcedBy)] } : p);
  const named = ps => readingDiagnostics({ ask: k.f.ask, summary: '', parts: ps, relations: [] }).find(x => x.rule === 'anchor-enforce')?.names ?? [];
  assert.deepEqual(named(withRule([{ kind: 'person', text: '감독자 세션 승인', at: k.f.at('| C/calls.py') }])), [`new:card s70: ${k.f.at('| C/calls.py')} C/calls.py → 모델 호출·지출 상한 CL 20·DS 5 USD`]);
  assert.deepEqual(named(withRule([{ kind: 'code', text: '지출 상한 CL 20·DS 5 USD', at: k.f.at('| C/calls.py') }])), []);
});

test('.39 one range, one home (R7): claims of two parts quoting the same range and saying the same stay only where the range resolves a 모르는 것 row (else on the row\'s first-cell part); different statements of one row both stay', () => {
  const k = koru39(), parts = structuredClone(k.parts), byRef = new Map(parts.map(p => [p.ref, p])), head = k.f.at('KORU 설계 기록');
  const claim = (key, text, at) => ({ key, kind: 'reported', text, at, about: null, replaces: null, topic: 'how' });
  byRef.get('new:review').claims = [claim('s4', '설계 기록에는 git show로 라이브 sha의 코드를 읽었다고 적혀 있다.', head)];
  const reviewRow = k.f.at('| review.jsonl 행');
  // Two statements of the review artifact row (its maker's and its reader's) are two claims and both stay.
  byRef.get('new:engine').claims = [claim('s7', '설계 기록은 코드를 git show로 라이브 sha에서 읽었다고 밝혔다.', head), claim('s8', '엔진은 review 행의 watch·allowed_side를 읽는다.', reviewRow)];
  byRef.get('new:card').claims = [claim('s61', '카드 러너가 review.jsonl에 행을 남긴다.', reviewRow)];
  const { wire, exclusions } = combineRenderedReading(webFragments(parts), k.global, k.f.ask, k.plan), review = parts.findIndex(p => p.ref === 'new:review');
  assert.deepEqual(exclusions.map(x => [x.path, x.category]), [[`parts[${review}].claims[0]`, 'dup-claim']], 'the engine holds the 모르는 것 row N01.01 resolves');
  assert.match(exclusions[0].explanation, /같은 원문 구간을 이미 인용/);
  assert.deepEqual([wire.parts[review].claims, wire.parts.find(p => p.ref === 'new:engine').claims.map(c => c.key), wire.parts.find(p => p.ref === 'new:card').claims.map(c => c.key)], [[], ['s7', 's8'], ['s61']]);
  assert.equal(M.setAside(M.validateMapReply(wire, k.f.ask)).length, 0, 'plain map.6 reads the combined wire whole');
  // With no row it resolves, a table row's statement stays with its first cell's part (the store review.jsonl 행).
  const row = structuredClone(parts); row.find(p => p.ref === 'new:card').claims = [];
  row.find(p => p.ref === 'new:engine').claims = [claim('s8', 'review.jsonl 행은 카드 러너가 쓰고 엔진이 읽는다고 적혀 있다.', reviewRow)];
  row.find(p => p.ref === 'new:review_rows').claims = [claim('s121', 'review.jsonl 행은 카드 러너가 쓰고 엔진이 읽는다.', reviewRow)];
  const engine = row.findIndex(p => p.ref === 'new:engine');
  assert.deepEqual(combineRenderedReading(webFragments(row), k.global, k.f.ask, k.plan).exclusions.filter(x => x.category === 'dup-claim').map(x => x.path), [`parts[${engine}].claims[0]`]);
});

test('.39 subject rule (R8, web R3): a 「한 줄 요약」 sentence\'s home is the one part named outside its tags; a sentence naming two parts, the project or none is the summary\'s, never the tag\'s reporter, and unbacked names it until the summary holds it', () => {
  const k = koru39(), names = k.parts.map(p => p.name), heads = list => list.map(s => [s.project, s.name, s.text.split(' ')[0]]);
  // Here the first sentence names one part outside its tag (엔진; 바이낸스 is no part of this wire); of the project 「KORU 구조 실험」 it
  // names the project itself (KORUUSDT): the project's, as is the second (no part outside its tag: 감독자 세션 is its reporter).
  assert.deepEqual(heads(summarySentences(k.f.ask, names)), [[false, '엔진', '바이낸스'], [true, null, '11-02에'], [false, '성적표', '성적표는']]);
  const ask = { ...k.f.ask, project: { name: 'KORU 구조 실험', purpose: null } };
  assert.deepEqual(heads(summarySentences(ask, names)), [[true, null, '바이낸스'], [true, null, '11-02에'], [false, '성적표', '성적표는']]);
  assert.deepEqual(heads(summarySentences(k.f.ask, [...names, '바이낸스'])).map(x => x[0]), [true, true, false], 'two parts outside the tags');
  const missing = planClaims(ask, k.plan, k.parts).missing.filter(n => / 바이낸스| 11-02에| 성적표는/.test(n));
  assert.deepEqual(missing.map(n => n.split(': ')[0]), ['new:sheet'], 'plan-claims counts the part sentence only');
  assert.deepEqual(uncitedFacts(ask, k.parts).uncited.filter(n => n.startsWith('한 줄 요약: ')).map(n => n.split(' ')[3]), ['성적표는']);
  const unbacked = summary => readingDiagnostics({ ask, summary, parts: k.parts, relations: [] }).find(x => x.rule === 'unbacked');
  const first = x => x.names.map(n => [n.split(': ')[0], n.split(': ')[1].split(' ')[0]]);
  assert.deepEqual(first(unbacked('')), [['한 줄 요약(프로젝트)', '바이낸스'], ['한 줄 요약(프로젝트)', '11-02에']]);
  assert.deepEqual(first(unbacked('e=1.00 실거래를 켜 첫 사이클 −0.433 USDT였고 대기 중이다.')), [['한 줄 요약(프로젝트)', '바이낸스']], 'the summary holds the second');
  // The web app (webapp-status-v3 §1): all three sentences are the project's (three parts; none outside the tags, twice).
  const web = koruText(['모아배송 프로젝트 현황 보고서', '1. 한 줄 요약',
    '동네 가게 14곳의 주문 접수·결제·배송 추적을 맡는 한국어 웹 서비스로, Next.js 화면·Node 주문 API·Postgres·Redis 큐·작업자·밤 정산 배치로 이루어져 있다 [파일: docs/ARCHITECTURE.md]. 10-14 베타를 열어 3주째 운영 중이고 누적 주문은 3,912건이다 [보고: 운영 담당자 11-03 23:50Z]. 11-02 Redis 메모리 사건 뒤 복구됐고, 지금은 중복 알림 수정(b71f2d40)의 배포 승인을 기다린다 [보고: 개발 세션 docs/STATUS.md 11-04 01:40Z].'].join('\n'));
  assert.deepEqual(summarySentences(web.ask, ['주문 API', '작업자', '정산 배치', '운영 담당자', '개발 세션']).map(s => [s.project, s.name]), [[true, null], [true, null], [true, null]]);
});

test('.39 refusal outcomes, merged payloads, query channels and run gates (web R2·R8·R9·R10): only a refusal expects a code device; a connection row whose 넘기는 것 no line carries is named; a query line is data; a run gate names a threshold or an operating state', () => {
  assert.deepEqual(['403 ROLE_REQUIRED', 'STOP_NOT_RESIDENT', 'POSITION_NOT_FLAT(J2로)', 'REVIEW_OFF 쉼', '503 CHECKOUT_DISABLED', '401 SESSION_EXPIRED', '기다림', 'QUOTA_REACHED, 오늘 조회 멈춤'].map(x => REFUSAL_OUTCOME.test(x)),
    [true, true, true, true, false, false, false, false]);
  // anchor-enforce: the web flag rule on 「503 CHECKOUT_DISABLED」 is a switch (no entry); the admin rule on 「403 ROLE_REQUIRED」 is named.
  const w = web36(), rule = (key, at) => ({ key, kind: 'want', text: '규칙', at, about: null, replaces: null, topic: 'rule', scope: 'part', scopeName: null,
    anchors: [{ kind: 'inferred', text: '조건', at }], enforcedBy: [{ kind: 'unknown', text: '장치 미상', at: null }] });
  const api = webPart(w, 'new:api', '주문 API', '| 주문 API | 루프', { claims: [rule('s1', w.at('| 주문 API | !flags')), rule('s2', w.at('| 주문 API | action'))] });
  assert.deepEqual(readingDiagnostics({ ask: w.ask, summary: '', parts: [api], relations: [] }).find(x => x.rule === 'anchor-enforce').names.map(n => n.split(': ')[0]), ['new:api s2']);
  // Merged payloads: two connection rows 주문 API → 결제사 with their own calls; a wire carrying only the first names the second.
  const m = koruText(['1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|', '| 주문 API | 루프·엔진 | 요청마다 처리 |', '| 결제사 | 외부 시스템 | PayOn |',
    '4. 연결', '| 보내는 부분 | 받는 부분 | 넘기는 것 | 언제·얼마나 자주 |', '|---|---|---|---|', '| 주문 API | 결제사 | 결제 세션 생성(금액은 서버 계산) | 주문 때 |', '| 주문 API | 결제사 | payon.refund 환불 요청 | 환불 때 |'].join('\n'));
  assert.deepEqual(connectionPayloadRows(m.ask), [['주문 api', '결제사', '결제 세션 생성(금액은 서버 계산)'], ['주문 api', '결제사', 'payon.refund 환불 요청']]);
  const mParts = [webPart(m, 'new:api', '주문 API', '| 주문 API | 루프'), webPart(m, 'new:payon', '결제사', '| 결제사 | 외부')];
  const conn = payload => readingDiagnostics({ ask: m.ask, summary: '', parts: mParts, relations: [{ from: 'new:api', to: 'new:payon', kind: 'flow', note: '', at: m.at('| 주문 API | 결제사 | 결제'), channel: 'data', payload }] }).find(x => x.rule === 'connections');
  assert.deepEqual(conn('결제 세션 생성(금액은 서버 계산)'), { path: 'relations', rule: 'connections', expected: 2, actual: 1, names: ['주문 api → 결제사: 넘기는 것 「payon.refund 환불 요청」 없음'] });
  assert.equal(conn('결제 세션 생성(금액은 서버 계산)·payon.refund 환불 요청'), undefined, 'both names on one line');
  // A query line (택배 추적 수집기 → 택배사 API 「택배사 조회」, the 추적 응답 row between them) written control loses its channel alone.
  const q = web37(), qParts = [webPart(q, 'new:tracker', '택배 추적 수집기', '| 택배 추적 수집기 | 수집기'), webPart(q, 'new:carrier', '택배사 API', '| 택배사 API | 외부')];
  const query = { from: 'new:tracker', to: 'new:carrier', kind: 'flow', note: '', at: q.at('| 택배 추적 수집기 | shipments'), channel: 'control', payload: '택배사 조회', mode: 'design' };
  const qOut = combineRenderedReading(webFragments(qParts), { ...empty(), summary: '', relations: [query] }, q.ask, webPlan(q, qParts));
  assert.deepEqual([qOut.exclusions.map(x => [x.path, x.category]), qOut.wire.relations[0].channel], [[['relations[0].channel', 'channel']], null]);
  assert.deepEqual([M.carriesQuery(q.ask, '택배 추적 수집기', '택배사 API', '택배사 조회'), M.carriesQuery(q.ask, '택배 추적 수집기', '택배사 API', '택배사 쓰기'), M.carriesQuery(q.ask, '고객', '택배사 API', '택배사 조회')], [true, false, false]);
  assert.ok(mapStageIssues({ ...empty(), relations: [query] }, null, { ask: q.ask, parts: qParts }).some(x => x.path === 'relations[0].channel' && x.category === 'channel'));
  // Run gates (webapp-status-v3 §9, koru-orch-v3 §9): 「XLEN이 80,000을 넘으면」, 「−8 USDT」 and 「만료」 hold run; reconciling three files or deploying does not.
  assert.deepEqual(['스트림 길이 XLEN이 80,000을 넘으면 운영 담당자가 checkout_enabled를 끈다.', '끄기 줄이 결판나거나 −8 USDT이면 해당 칸을 끈다.', '만료가 다가오면 11-04 07:25Z 전 재ARM 줄을 낸다.',
    '11-04~11-06 세 파일의 합계가 결제사 정산 보고와 모두 맞으면 11-07에 매일 대조를 주 1회로 줄인다.', 'b71f2d40이 CI 네 잡을 통과하고 승인되면 배포한다.'].map(t => M.RUN_GATE.test(t)), [true, true, true, false, false]);
  const gate = (key, text) => ({ key, kind: 'want', text, at: q.at('| 택배 추적 수집기 | shipments'), about: null, replaces: null, topic: 'plan', gate: 'run' });
  const gParts = [{ ...qParts[0], claims: [gate('s1', '11-04~11-06 세 파일의 합계가 결제사 정산 보고와 모두 맞으면 매일 대조를 주 1회로 줄인다.'), gate('s2', '스트림 길이 XLEN이 80,000을 넘으면 끈다.')] }, qParts[1]];
  const gOut = combineRenderedReading(webFragments(gParts), { ...empty(), summary: '' }, q.ask, webPlan(q, gParts));
  assert.deepEqual([gOut.exclusions.map(x => [x.path, x.category]), gOut.wire.parts[0].claims.map(c => c.gate)], [[['parts[0].claims[0].gate', 'gate']], [null, 'run']]);
});

// ---- first-map-divided.40 (map-reading.15), from the blind judging of the .39 maps (KORU and the web app both 20/20, design 18/18): the
// web admin rule kept 장치 미상 on two refusal rows, the program's port rows were none on both sets (twelve model rows filled the bound; a
// chain step uses nothing; 성적표 「render」 → SHEET), the diagnostic said 「원문이 단계를 대지 않음」 of lines a step names, CI 관문 looped
// 「PR마다」, the editor kept 「(실패면 FALLBACK)」 in a step name and policy-daily.sh's 4d27a6bc was lost. The rows below copy the KORU and
// web-app rows as written (koru-orch-design-v1 §2-§3, webapp-design-v1 §1-§4, webapp-status-v3 §2 and §7); no model quality is claimed. ----
const meta40 = (id, n) => ({ id, at: '2026-11-04T14:00:00.000Z', model: 'stub', prompt: 'm6-000000000040', hash: n.repeat(64) });
function admin40(enforcedBy, extra = {}) {
  const f = web37(), condition = (when, then, otherwise, head) => ({ when, then, else: otherwise, at: f.at(head) });
  const admin = webPart(f, 'new:admin', '관리자 화면', '| 관리자 화면 | [모름]', { claims: [webClaim(f, 's1', '| 관리자 화면 | 환불은',
    { kind: 'want', topic: 'rule', text: '환불은 운영 담당자와 소유자만 할 수 있고 관리자 세션은 8 h 후 만료한다.', scope: 'part', enforcedBy, ...extra })] });
  const api = webPart(f, 'new:order_api', '주문 API', '| 주문 API | 루프', { conditions: [condition("!flags.isOn('checkout_enabled')", '503 CHECKOUT_DISABLED', '다음', '| 주문 API | !flags'),
    condition('!sess 또는 now - sess.issued_at > SESSION_TTL', '401 SESSION_EXPIRED', '다음', '| 주문 API | !sess'),
    condition("action === 'refund' && !['ops','owner'].includes(sess.role)", '403 ROLE_REQUIRED', '다음', '| 주문 API | action')] });
  const parts = [admin, api], plan = webPlan(f, parts), fragments = webFragments(parts);
  const global = { ...empty(), summary: '', relations: [webLine(f, 'new:admin', 'new:order_api', '| 관리자 화면 | 주문 API', { payload: '/admin/api/* 요청(세션 쿠키)', cadence: '수시', mode: 'design' })] };
  const { wire, exclusions } = combineRenderedReading(fragments, global, f.ask, plan);
  return { f, parts, plan, fragments, global, wire, exclusions };
}
test('.40 program code device (web R1): a rule with no code device whose place stands on a refusal row takes that row\'s code device, marked program; unknown gives way, none and the model\'s own code stay; stored exactly as map-reading.15', () => {
  const k = admin40([{ kind: 'unknown', text: '장치 미상', at: null }]);
  assert.deepEqual(k.exclusions, []);
  const read = M.validateMapReply(k.wire, k.f.ask), devices = r => r.parts[0].claims[0].enforcedBy.map(e => [e.kind, e.text, e.program]);
  // The program places (.37: the refund row first, then the session row) stand on 403 ROLE_REQUIRED: its code device, 장치 미상 given way.
  assert.deepEqual(devices(read), [['code', '403 ROLE_REQUIRED', true]]);
  assert.equal(read.parts[0].claims[0].enforcedBy[0].quote.quote, "| 주문 API | action === 'refund' && !['ops','owner'].includes(sess.role) | 403 ROLE_REQUIRED | 다음 | [파일: A/routes/admin.ts] |");
  assert.equal(k.wire.parts[0].claims[0].enforcedBy[0].kind, 'unknown', 'the wire keeps the reply as written');
  // A person beside it stays and the code device comes after it; a none (기록상 미설계) and the model's own code device are never touched.
  // (plain map.6 reads the wire with its own devices: the divided reading's own rules on a person are not the point here)
  const withDevices = enforcedBy => { const w = structuredClone(k.wire); w.parts[0].claims[0].enforcedBy = enforcedBy; return M.validateMapReply(w, k.f.ask); };
  assert.deepEqual(devices(withDevices([{ kind: 'person', text: '운영 담당자 확인', at: k.f.at('| 관리자 화면 | 환불은') }])), [['person', '운영 담당자 확인', undefined], ['code', '403 ROLE_REQUIRED', true]]);
  assert.deepEqual(devices(withDevices([{ kind: 'none', text: '기록상 미설계', at: k.f.at('| 관리자 화면 | 환불은') }])), [['none', '기록상 미설계', undefined]]);
  assert.deepEqual(devices(withDevices([{ kind: 'code', text: '401 SESSION_EXPIRED', at: k.f.at('| 주문 API | !sess'), program: true }])), [['code', '401 SESSION_EXPIRED', undefined]], 'a forged program key is passed over');
  // A place on the feature-flag row (503 CHECKOUT_DISABLED: a switch, no refusal) adds nothing.
  const flag = structuredClone(k.wire); flag.parts[0].claims[0].anchors = [{ kind: 'inferred', text: "!flags.isOn('checkout_enabled')", at: k.f.at('| 주문 API | !flags') }];
  assert.deepEqual(devices(M.validateMapReply(flag, k.f.ask)), [['unknown', '장치 미상', undefined]]);
  // anchor-enforce names the program's device as filled (nothing left unkept).
  const found = finalDiagnostics(k.fragments, k.global, k.f.ask, k.plan).find(x => x.rule === 'anchor-enforce');
  assert.deepEqual([found.actual, found.names], [0, [`프로그램이 채움: new:admin s1: ${k.f.at('| 주문 API | action')} action === 'refund' && !['ops','owner'].includes(sess.role) → 403 ROLE_REQUIRED`]]);
  // Stored: every device says program; the reading reads back exactly; a device without program, a program person or a program code
  // without its row is refused; a .14 entry keeps its shape.
  const applied = M.applyReading(k.f.project, k.f.input, read, meta40('R_code40', '1'));
  assert.equal(applied.reading.version, 'map-reading.19');
  const stored = applied.reading.parts.find(p => p.areaId === applied.created[0]).claims[0];
  assert.deepEqual(stored.enforcedBy.map(e => [e.kind, e.text, e.program, e.quote?.quote.startsWith('| 주문 API | action')]), [['code', '403 ROLE_REQUIRED', true, true]]);
  assert.deepEqual(validateProject(applied.project), applied.project);
  const raw = JSON.stringify(applied.project), claimOf = p => p.readings.at(-1).parts.find(x => x.claims.length).claims[0];
  // .43 (map-reading.18): a program gate or none on its row stands (a v4 rule's 지키는 장치 column); a .17 entry holds neither (below).
  for (const mutate of [c => { delete c.enforcedBy[0].program; }, c => { c.enforcedBy[0].program = 'yes'; }, c => { c.enforcedBy[0].kind = 'unknown'; }]) {
    const bad = JSON.parse(raw); mutate(claimOf(bad));
    assert.throws(() => validateProject(bad), undefined, String(mutate));
  }
  const gated = JSON.parse(raw); claimOf(gated).enforcedBy[0].kind = 'gate';
  assert.deepEqual(validateProject(gated), gated);
  stripEighteen(gated.readings.at(-1)); gated.readings.at(-1).version = 'map-reading.17';
  assert.throws(() => validateProject(gated), undefined, 'a map-reading.17 program device is no gate');
  // map-reading.17 (pipeline .42): a program unknown with no passage stands (a rule whose decider was set aside); a .16 entry holds none.
  const unknown = JSON.parse(raw); Object.assign(claimOf(unknown).enforcedBy[0], { kind: 'unknown', text: '장치 미상', quote: null });
  assert.deepEqual(validateProject(unknown), unknown);
  stripEighteen(unknown.readings.at(-1)); unknown.readings.at(-1).version = 'map-reading.16'; for (const p of unknown.readings.at(-1).parts) for (const s of p.steps) delete s.when;
  assert.throws(() => validateProject(unknown), undefined, 'a map-reading.16 program device has its row');
  // map-reading.16 (pipeline .41): a program device may be a person on its row (a hand-kept rule); a .15 entry keeps code only.
  const person = JSON.parse(raw); claimOf(person).enforcedBy[0].kind = 'person';
  assert.deepEqual(validateProject(person), person);
  stripEighteen(person.readings.at(-1)); person.readings.at(-1).version = 'map-reading.15';
  assert.throws(() => validateProject(person), undefined, 'a map-reading.15 program device is code');
  const old = JSON.parse(raw); stripEighteen(old.readings.at(-1)); old.readings.at(-1).version = 'map-reading.14'; delete claimOf(old).enforcedBy[0].program; for (const p of old.readings.at(-1).parts) for (const s of p.steps) delete s.when;
  assert.deepEqual(validateProject(old), old, 'a map-reading.14 entry keeps its exact shape');
  const keyed = JSON.parse(raw); keyed.readings.at(-1).version = 'map-reading.14';
  assert.throws(() => validateProject(keyed), undefined, 'a .15 key on a .14 reading');
});

test('.40 plan and render input (web R2): a 「지켜야 할 것」 row of a part speaks of other parts\' condition rows sharing two content words (ruleConditionRows, marked with their owner); the plan prompt hands them to the rule\'s part too', () => {
  const f = web37();
  assert.deepEqual(M.ruleConditionRows(f.ask, '관리자 화면').map(r => [r.owner, r.at, r.then]),
    [['주문 API', f.at('| 주문 API | !sess'), '401 SESSION_EXPIRED'], ['주문 API', f.at('| 주문 API | action'), '403 ROLE_REQUIRED']]);
  assert.deepEqual([M.ruleConditionRows(f.ask, '주문 API'), M.ruleConditionRows(f.ask, '작업자'), M.ruleConditionRows(f.ask, '')], [[], [], []], 'its own rows, a part with no rule row, no name');
  assert.ok(MAP_BLUEPRINT_PROMPT.includes('그 규칙 행의 부분 at에도 넣는다(관리자 화면 「환불은 운영 담당자·소유자만, 관리자 세션은 8 h 만료」 ↔ 주문 API의 「403 ROLE_REQUIRED」·「401 SESSION_EXPIRED」 행)'));
});

/** The KORU wire of .40: .39's, with the 성적표's artifact row and store (koru-orch-design-v1 §2: 「SHEET-<날>.md」) and its line. */
const KORU40 = KORU39.replace('| facts.jsonl | fact_id·value·observed_utc·source | 주문형 수집 | 카드 러너 | /var/lib/koru-desk/cards/ | [파일: C/schemas.json] |',
  '| facts.jsonl | fact_id·value·observed_utc·source | 주문형 수집 | 카드 러너 | /var/lib/koru-desk/cards/ | [파일: C/schemas.json] |\n| SHEET-<날>.md | 하루 장 | 성적표 | design 세션·감독자 세션 | O/scorecard/day/ | [파일: ls O/scorecard/day] |');
function koru40() {
  const k = koru39(KORU40), f = k.f;
  assert.notEqual(KORU40, KORU39);
  const parts = k.parts.map(p => p.ref === 'new:sheet' ? { ...p, outputs: ['SHEET-<날>.md'] } : p.ref === 'new:editor' ? { ...p, outputs: ['plan.jsonl'] } : p);
  parts.push(webPart(f, 'new:sheet_store', 'SHEET-<날>.md', '| SHEET-<날>.md', { type: 'store', typeAt: f.at('| SHEET-<날>.md'), outputs: ['SHEET-<날>.md'], files: ['O/scorecard/day/'] }));
  const relations = [...k.relations, { from: 'new:sheet', to: 'new:sheet_store', kind: 'flow', note: '', at: f.at('| SHEET-<날>.md'), channel: 'data', payload: 'SHEET-<날>.md' }];
  return { f, parts, relations, plan: webPlan(f, parts), global: { ...empty(), summary: '', relations } };
}
test('.40 program portMap reads names, does and the store\'s rows (KORU R1·R3, web R3): 성적표 「render」 → SHEET from its 3절 chain; the web app\'s orders.cursor, 「orders 행 읽기」, 「shipments 행」, address_suggestions 행 and 「바뀐 것만 shipment.updated」; one step still', () => {
  const k = koru40(), { wire, exclusions } = combineRenderedReading(webFragments(k.parts), k.global, k.f.ask, k.plan);
  assert.deepEqual(exclusions, []);
  const read = M.validateMapReply(wire, k.f.ask), sheet = k.relations.length - 1;
  assert.deepEqual(read.portMap.filter(m => m.relation === sheet).map(m => [m.direction, m.port, m.step, m.program]), [['out', 'SHEET-<날>.md', 'render', true]]);
  // The editor's chain names plan.jsonl too: its last piece 「plan 행」 (its tail in does) is the writer step.
  assert.deepEqual(read.portMap.filter(m => m.relation === 10).map(m => [m.direction, m.port, m.step, m.program]), [['out', 'plan.jsonl', 'plan 행', true]]);
  // Texture's 「행 append」 is a 3절 piece and no step of it: no row, a candidate only.
  const sides = M.portSides(k.f.ask, read.parts, read.relations, ref => read.parts.find(p => p.ref === ref)?.name ?? '');
  assert.deepEqual(sides.find(s => s.relation === 9 && s.direction === 'out'), { relation: 9, direction: 'out', hits: [], chain: ['행 append'], port: null, crossed: [] });

  // The web app (webapp-design-v1 §1-§4): the stores' rows speak through the steps' names and does.
  const WEB40 = WEB37_DESIGN
    .replace('| 결제 폴링 동기화 | 타이머·일정 | 폐기(*/5 cron) [파일: scripts/old/poll-payments.ts] |', ['| 결제 폴링 동기화 | 타이머·일정 | 폐기(*/5 cron) [파일: scripts/old/poll-payments.ts] |',
      '| 주소 보정기 | AI 판단 | 보정 제안 1회 호출 [파일: W/address-fix.ts] |', '| 정산 배치 | 타이머·일정 | cron 30 15 * * * [파일: git 3e9a1c07:batch/crontab] |'].join('\n'))
    .replace('| processed_events 행 | event_id·kind·received_at | 결제 웹훅 수신기 | 결제 웹훅 수신기 | orders 테이블 | [파일: M/0005_processed_events.sql] |', ['| processed_events 행 | event_id·kind·received_at | 결제 웹훅 수신기 | 결제 웹훅 수신기 | orders 테이블 | [파일: M/0005_processed_events.sql] |',
      '| address_suggestions 행 | order_id·original·suggested·confidence·status·confirmed_by·confirmed_at | 주소 보정기 | 관리자 화면 | orders 테이블 | [파일: M/0006_address_suggestions.sql] |'].join('\n'))
    .replace('| 웹 프런트 | shipments 행·tracking_events 행 | 주문서 → POST /api/orders → 결제사 이동 → 추적 페이지 폴링 | 주문 요청 | POLL_MS 30000 | [파일: F/track/[no]/page.tsx] |', ['| 웹 프런트 | shipments 행·tracking_events 행 | 주문서 → POST /api/orders → 결제사 이동 → 추적 페이지 폴링 | 주문 요청 | POLL_MS 30000 | [파일: F/track/[no]/page.tsx] |',
      '| 주소 보정기 | orders 행 | 프롬프트 조립 → 모델 1회 호출 → 형식 검사 → address_suggestions 행(PENDING_REVIEW) | address_suggestions 행 | ADDRESS_MODEL(.env, 열지 않음), TIMEOUT_MS 8000 | [파일: W/address-fix.ts] |',
      '| 정산 배치 | orders 행 | kstYesterday → orders.cursor(1,000행씩) → aggregate → toCsv(BOM) → bucket.put → settle_runs INSERT | settlement-YYYYMMDD.csv | cron 30 15 * * *, DAY_TZ Asia/Seoul, CSV_BOM true, FEE_RATE 0.033 | [파일: S] |'].join('\n'))
    .replace('| 작업자 | 1 | 읽기 | XREADGROUP workers | consume | 없으면 다시 읽기 | [파일: W/consume.ts] |', ['| 작업자 | 1 | 읽기 | XREADGROUP workers | consume | 없으면 다시 읽기 | [파일: W/consume.ts] |',
      '| 작업자 | 3 | 주문 확인 | orders 행 읽기 | orders.get | paid 아니면 SKIP_NOT_PAID | [파일: K] |', '| 작업자 | 6 | shipments 행 | tracking_no INSERT, status shipping | shipments.insert | — | [파일: K] |'].join('\n'))
    .replace('| 결제 웹훅 수신기 | 2 | 서명 검사 | HMAC-SHA256·300 s 허용 | verifySignature | 실패면 400 SIGNATURE_INVALID | [파일: A/lib/payon.ts] |', ['| 결제 웹훅 수신기 | 2 | 서명 검사 | HMAC-SHA256·300 s 허용 | verifySignature | 실패면 400 SIGNATURE_INVALID | [파일: A/lib/payon.ts] |',
      '| 결제 웹훅 수신기 | 3 | 중복 검사 | event_id 조회 | seen | 있으면 200 DUPLICATE_IGNORED | [파일: H] |', '| 결제 웹훅 수신기 | 4 | 상태 갱신 | 한 트랜잭션으로 orders 갱신·processed_events INSERT | db.tx | payment.failed면 payment_failed | [파일: H] |'].join('\n'));
  const w = koruText(WEB40), step = (name, does, uses, head) => ({ name, does, uses, at: w.at(head) });
  const store = (ref, name, head, outputs) => webPart(w, ref, name, head, { type: 'store', typeAt: w.at(head), outputs });
  const parts = [store('new:orders', 'orders 테이블', '| orders 테이블 | 행', ['orders 행', 'shipments 행', 'processed_events 행', 'address_suggestions 행']),
    store('new:events', 'events 큐', '| events 큐 | 행', ['events 메시지', 'events:dlq 메시지']),
    webPart(w, 'new:worker', '작업자', '| 작업자 | 루프', { inputs: ['events 메시지', 'orders 행'], outputs: ['shipments 행', 'events 메시지'],
      steps: [step('읽기', 'XREADGROUP workers', ['consume'], '| 작업자 | 1 |'), step('주문 확인', 'orders 행 읽기', ['orders.get'], '| 작업자 | 3 |'), step('shipments 행', 'tracking_no INSERT, status shipping', ['shipments.insert'], '| 작업자 | 6 |')] }),
    webPart(w, 'new:webhook', '결제 웹훅 수신기', '| 결제 웹훅 수신기 | 계산', { inputs: ['결제 웹훅'], outputs: ['orders 행', 'processed_events 행'],
      steps: [step('중복 검사', 'event_id 조회', ['seen'], '| 결제 웹훅 수신기 | 3 |'), step('상태 갱신', '한 트랜잭션으로 orders 갱신·processed_events INSERT', ['db.tx'], '| 결제 웹훅 수신기 | 4 |')] }),
    webPart(w, 'new:tracker', '택배 추적 수집기', '| 택배 추적 수집기 | 수집기', { outputs: ['tracking_events 행', 'shipments 행', 'events 메시지'] }),
    webPart(w, 'new:batch', '정산 배치', '| 정산 배치 | 타이머', { inputs: ['orders 행'] }),
    webPart(w, 'new:fixer', '주소 보정기', '| 주소 보정기 | AI', { inputs: ['orders 행'], outputs: ['address_suggestions 행'] })];
  const line = (from, to, head, payload) => ({ from, to, kind: 'flow', note: '', at: w.at(head), channel: 'data', payload });
  const lines = [line('new:orders', 'new:worker', '| orders 행', 'orders 행'), line('new:worker', 'new:orders', '| shipments 행', 'shipments 행'), line('new:worker', 'new:orders', '| orders 행', 'orders 행'),
    line('new:orders', 'new:webhook', '| processed_events 행', 'processed_events 행'), line('new:tracker', 'new:events', '| events 메시지', 'shipment.updated'),
    line('new:orders', 'new:batch', '| orders 행', '전날(KST) paid·refunded 주문'), line('new:fixer', 'new:orders', '| address_suggestions 행', 'address_suggestions 행')];
  const web = combineRenderedReading(webFragments(parts), { ...empty(), summary: '', relations: lines }, w.ask, webPlan(w, parts));
  // .42: the worker's second artifact line into the same store (orders 행 beside shipments 행) joins the first as a payload list.
  assert.deepEqual(web.exclusions.map(x => [x.path, x.category]), [['relations[2]', 'product-merge']]);
  assert.equal(web.wire.relations[1].payload, 'shipments 행 · orders 행');
  const got = M.validateMapReply(web.wire, w.ask);
  assert.deepEqual(got.portMap.map(m => [m.relation, m.direction, m.port, m.step, m.program]), [[0, 'in', 'orders 행', '주문 확인', true], [1, 'out', 'shipments 행', 'shipments 행', true],
    [3, 'out', 'events 메시지', '바뀐 것만 shipment.updated', true], [4, 'in', 'orders 행', 'orders.cursor', true], [5, 'out', 'address_suggestions 행', 'address_suggestions 행', true]]);
  // The webhook's 「event_id 조회」 is the one reader but no input names the row (no port).
  const wsides = M.portSides(w.ask, got.parts, got.relations, ref => got.parts.find(p => p.ref === ref)?.name ?? '');
  assert.deepEqual([2].map(i => wsides.find(s => s.relation === i).hits), [[0]]);
  // The diagnostic tells the kinds apart; 「원문이 단계를 대지 않음」 only where no step is tied.
  const found = finalDiagnostics(webFragments(parts), { ...empty(), summary: '', relations: lines }, w.ask, webPlan(w, parts)).find(x => x.rule === 'portmap-missing');
  assert.deepEqual(found.names.filter(n => !n.startsWith('모델이 비움')), ['단계 후보 있음 · 모델이 비움: new:orders → new:webhook: processed_events 행 (후보: 중복 검사)']);
  assert.equal(found.names.filter(n => n.startsWith('모델이 비움 · 프로그램이 채움')).length, 5);
  // The bound: twelve model rows leave room for the program's (PORTMAP_MAX 24 in all).
  assert.deepEqual([M.PART_LIST_MAX.portMap, M.PORTMAP_MAX], [12, 24]);
  // A call the line names on the other end (「payon.refund」) ties only a step naming that very call (none here: no row).
  const pay = koruText(WEB37_DESIGN), api = webPart(pay, 'new:api', '주문 API', '| 주문 API | 루프', { outputs: ['결제 세션 요청'], steps: [{ name: '결제 세션', does: '결제사 세션 생성', uses: ['payon.createSession'], at: pay.at('| 주문 API | 1 |') }] });
  const payon = webPart(pay, 'new:payon', '결제사', '| 결제사 | 외부');
  const refund = { from: 'new:api', to: 'new:payon', kind: 'flow', note: '', at: pay.at('| 결제사 | 외부'), channel: 'data', payload: 'payon.refund' };
  assert.deepEqual(M.programPortMap(pay.ask, [api, payon], [refund]), []);
  assert.deepEqual(M.programPortMap(pay.ask, [api, payon], [{ ...refund, payload: '결제 세션 생성(금액은 서버 계산)' }]).map(r => r.step), ['결제 세션']);
});

test('.40 step names (KORU R3): a parenthesised tail goes to does where does is not said (the program\'s chain steps and the model\'s), port-map rows follow, step-name names them; a call keeps its parenthesis', () => {
  assert.deepEqual(['plan 행(실패면 FALLBACK)', 'address_suggestions 행(PENDING_REVIEW)', 'orders.cursor(1,000행씩)', 'toCsv(BOM)', 'row_live(1800 s)', 'a(b)', 'review 읽기', 'x(()'].map(M.stepTail),
    [{ name: 'plan 행', tail: '실패면 FALLBACK' }, { name: 'address_suggestions 행', tail: 'PENDING_REVIEW' }, { name: 'orders.cursor', tail: '1,000행씩' }, null, null, null, null, null]);
  const k = koru39();
  assert.deepEqual(M.programSteps(k.f.ask, '편집장').map(s => [s.name, s.does]), [['날짜 확인', null], ['1회 호출', null], ['PLAN_FORBIDDEN 검사', null], ['plan 행', '실패면 FALLBACK']]);
  // The model's own steps with does null, and its port-map row naming the step as written.
  const parts = structuredClone(k.parts), editor = parts.find(p => p.ref === 'new:editor'), chain = k.f.at('| 편집장 | 달력');
  Object.assign(editor, { outputs: ['plan.jsonl'], steps: ['날짜 확인', '1회 호출', 'PLAN_FORBIDDEN 검사', 'plan 행(실패면 FALLBACK)'].map(name => ({ name, does: null, uses: [], at: chain })) });
  const global = { ...k.global, portMap: [{ relation: 10, port: 'plan.jsonl', step: 'plan 행(실패면 FALLBACK)', direction: 'out', at: chain }] };
  const { wire, exclusions } = combineRenderedReading(webFragments(parts), global, k.f.ask, k.plan);
  assert.deepEqual(exclusions, []);
  const read = M.validateMapReply(wire, k.f.ask), steps = read.parts.find(p => p.ref === 'new:editor').steps;
  assert.deepEqual(steps.map(s => [s.name, s.does, s.program]).at(-1), ['plan 행', '실패면 FALLBACK', undefined]);
  assert.deepEqual(read.portMap.filter(m => m.relation === 10).map(m => [m.step, m.program]), [['plan 행', undefined]], 'the model\'s row follows its step');
  assert.deepEqual(M.stepRenames(read), [{ ref: 'new:editor', from: 'plan 행(실패면 FALLBACK)', to: 'plan 행' }]);
  assert.deepEqual(finalDiagnostics(webFragments(parts), global, k.f.ask, k.plan).find(x => x.rule === 'step-name'),
    { path: 'parts', rule: 'step-name', expected: null, actual: 1, names: ['new:editor 「plan 행(실패면 FALLBACK)」 → 「plan 행」'] });
  assert.ok(FINAL_DIAGNOSTICS.includes('step-name'));
  // The program's chain step stores its tail in does (map-reading.15; it still uses nothing).
  const prog = M.validateMapReply(combineRenderedReading(webFragments(k.parts), k.global, k.f.ask, k.plan).wire, k.f.ask);
  assert.deepEqual(prog.parts.find(p => p.ref === 'new:editor').steps.at(-1), { name: 'plan 행', does: '실패면 FALLBACK', uses: [], quote: prog.parts.find(p => p.ref === 'new:editor').steps[0].quote, program: true });
  const applied = M.applyReading(k.f.project, k.f.input, prog, meta40('R_tail40', '2'));
  assert.deepEqual(createdOf(applied, k.parts, 'new:editor').steps.at(-1).does, '실패면 FALLBACK');
  assert.deepEqual(validateProject(applied.project), applied.project);
  const old = JSON.parse(JSON.stringify(applied.project)); old.readings.at(-1).version = 'map-reading.14';
  for (const p of old.readings.at(-1).parts) for (const c of p.claims) for (const e of c.enforcedBy ?? []) delete e.program;
  assert.throws(() => validateProject(old), undefined, 'a .14 program step does nothing');
});

test('.40 loop honesty (web R6): a VCS or CI event unit (CI 관문 「PR마다」) is left null and a part whose type repeats nothing (a store, a timer, a gate) takes no loop; loop-missing never names such a part', () => {
  assert.deepEqual(['PR마다', '커밋마다', 'push 때', '배포 때', '10분마다', '5 s 블록 읽기, 10개씩', '600 s 주기', '매분'].map(u => M.VCS_EVENT.test(u)), [true, true, true, true, false, false, false, false]);
  assert.deepEqual(M.LOOP_TYPES, ['loop', 'collector', 'compute', 'ai', 'actor']);
  const f = koruText(['모아배송 현황 (일부)', '1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|', '| CI 관문 | 계산 | 네 잡 검사 [파일: .github/workflows/ci.yml] |',
    '| orders 테이블 | 행 파일·저장소 | Postgres orders와 딸린 표 [파일: M/] |', '2. 부분', '| 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태 단어 | 상태의 기준 시각 | 꼬리표 |', '|---|---|---|---|---|---|',
    '| CI 관문 | PR마다 lint·unit·migration-check·e2e | .github/workflows/ci.yml | 돌고 있음 | 11-04 01:12Z | [보고: 개발 세션 docs/STATUS.md 11-04 01:40Z] |'].join('\n'));
  const ci = webPart(f, 'new:ci', 'CI 관문', '| CI 관문 | 계산', { type: 'compute', typeAt: f.at('| CI 관문 | 계산'), loop: { unit: 'PR마다', stop: null, resume: null, at: f.at('| CI 관문 | PR마다') } });
  const orders = webPart(f, 'new:orders', 'orders 테이블', '| orders 테이블 | 행', { type: 'store', typeAt: f.at('| orders 테이블 | 행'), loop: { unit: '5분마다', stop: null, resume: null, at: f.at('| CI 관문 | PR마다') } });
  const wire = { ...empty(), summary: '', parts: [ci, orders] };
  const read = M.validateMapReply(wire, f.ask, { setAside: true });
  assert.deepEqual([read.parts[0].loop, read.parts[1].loop], [null, null]);
  assert.deepEqual(M.readingExclusions(read).map(x => [x.path, x.category]), [['parts[0].loop.unit', 'loop'], ['parts[1].loop', 'loop']]);
  assert.throws(() => M.validateMapReply(wire, f.ask), undefined, 'plain map.6 refuses');
  assert.equal(M.programLoop(f.ask, { name: 'CI 관문', config: ['POLL_MS 30000'], state: null, type: 'timer' }), null);
  assert.deepEqual(loopRows(f.ask, [{ name: 'orders 테이블', type: 'store', loop: null }]).missing, []);
});

test('.40 version facts (KORU c-3): a sha in a part\'s 3절 or 부분 table row that no claim, setting or file-map row carries is named by uncited as 「판본 …」', () => {
  const k = koru39();
  assert.deepEqual(versionFacts(k.f.ask, k.parts), { rows: 4, uncited: ['판본 618df374: 엔진', '판본 4d27a6bc: 정책 행 작성기', '판본 136feaf0: 질감 v3', '판본 8f9d3697: 성적표'] });
  const parts = structuredClone(k.parts), byRef = new Map(parts.map(p => [p.ref, p]));
  byRef.get('new:texture').claims = [webClaim(k.f, 's81', '| 질감 v3 | marketws', { topic: 'how', where: '명세 136feaf0' })];
  byRef.get('new:engine').roleAbout = '618df374';
  byRef.get('new:sheet').fileRoles = [{ path: 'git 8f9d3697:code/tools/paper/sheet.py', role: '하루 장', at: k.f.at('| 성적표 | 경주') }];
  assert.deepEqual(versionFacts(k.f.ask, parts), { rows: 4, uncited: ['판본 4d27a6bc: 정책 행 작성기'] });
  assert.deepEqual(versionFacts(k.f.ask, parts, new Set(['질감 v3'])), { rows: 1, uncited: [] }, 'a fragment hears its own parts');
  const uncited = uncitedFacts(k.f.ask, parts);
  assert.ok(uncited.uncited.includes('판본 4d27a6bc: 정책 행 작성기'));
});

test('.40 kept-state history (KORU R8): a program entry read later keeps the readers and changers an earlier model entry of the same name gave', () => {
  const k = admin40([{ kind: 'unknown', text: '장치 미상', at: null }]), read = M.validateMapReply(k.wire, k.f.ask);
  const applied = M.applyReading(k.f.project, k.f.input, read, meta40('R_state40', '3')), apiId = applied.created[1];
  const first = structuredClone(applied.reading), second = structuredClone(applied.reading);
  first.id = 'R_state40_a'; second.id = 'R_state40_b';
  first.parts.find(p => p.areaId === apiId).stateVars = [{ name: 'sess.role', scope: '세션', readBy: ['관리자 권한'], changedBy: ['관리자 인증'], program: false }];
  second.parts.find(p => p.areaId === apiId).stateVars = [{ name: 'sess.role', scope: null, readBy: [], changedBy: [], program: true }];
  const project = { ...applied.project, readings: [...applied.project.readings.slice(0, -1), first, second] };
  assert.deepEqual(M.partUnderstanding(project, apiId).stateVars, [{ name: 'sess.role', scope: null, readBy: ['관리자 권한'], changedBy: ['관리자 인증'], program: true }]);
  // The newest model entry stands as it is; a program entry with no earlier model entry names nothing else.
  const flipped = { ...project, readings: [...applied.project.readings.slice(0, -1), second, first] };
  assert.deepEqual(M.partUnderstanding(flipped, apiId).stateVars, [{ name: 'sess.role', scope: '세션', readBy: ['관리자 권한'], changedBy: ['관리자 인증'], program: false }]);
  assert.deepEqual(M.partUnderstanding({ ...project, readings: [...applied.project.readings.slice(0, -1), second] }, apiId).stateVars, [{ name: 'sess.role', scope: null, readBy: [], changedBy: [], program: true }]);
});
