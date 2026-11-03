// Model-free blueprint/render contracts. These author-written wires are not evidence of model-generation quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { ApiError } from '../../server/errors.mjs';
import { validateMapBlueprint, splitBlueprintParts, validateRenderedFragment, combineRenderedMaps, combineRenderedReading, mapStageIssues, blueprintStageIssues,
  isMapRevision, validateMapRevision, revisionGroups,
  missingMapCorrections, mapCorrectionRevision, MAP_BLUEPRINT_PROMPT, LATER_BLUEPRINT_PROMPT,
  BLUEPRINT_PARTS_MAX, BLUEPRINT_NEW_PARTS_MAX, BLUEPRINT_GLOBAL_MAX, BLUEPRINT_ANCHORS_MAX } from '../server/map-blueprint.mjs';

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

test('blueprint bounds are exact: 24 total, 12 new, 32 global, 8 anchors, 60-unit name, 400-unit focus and 240-unit text', () => {
  assert.deepEqual([BLUEPRINT_PARTS_MAX, BLUEPRINT_NEW_PARTS_MAX, BLUEPRINT_GLOBAL_MAX, BLUEPRINT_ANCHORS_MAX], [24, 12, 32, 8]);
  const f = fixture(12), blueprint = planned(f, 12);
  blueprint.parts.unshift(...f.ask.parts.map(part => ({ ref: part.id, name: part.name, parent: part.parentId, at: [f.at[0]], focus: '기존 책임' })));
  blueprint.parts.at(-1).name = '가'.repeat(60); blueprint.parts.at(-1).focus = '가'.repeat(400); blueprint.parts.at(-1).at = f.at.slice(0, 8);
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
  for (const [index, key] of [[0, 's99'], [1, 's199']]) {
    const good = structuredClone(fragments[index]); good.parts[0].claims[0].key = key;
    validateRenderedFragment(good, splitBlueprintParts(blueprint)[index], f.ask, blueprint);
  }
  for (const key of ['s100', 's200', 's801']) {
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
  const value = { ...empty(), summary: '😀'.repeat(100), parts: [{ basis: Array(4).fill(null), claims: Array(6).fill(null), name: '가'.repeat(60), role: '가'.repeat(300) }],
    relations: Array(16).fill(null), candidates: Array(6).fill(null), gaps: Array(2).fill(null), matches: Array(24).fill(null), material: Array(6).fill(null) };
  assert.deepEqual(mapStageIssues(value), []);
  value.summary += '가'; value.parts[0].basis.push(null); value.parts[0].claims.push(null); value.parts[0].name += '가'; value.parts[0].role += '가';
  for (const field of ['relations', 'candidates', 'gaps', 'matches', 'material']) value[field].push(null);
  assert.deepEqual(mapStageIssues(value), [
    { path: 'summary', rule: 'length', expected: 200, actual: 201 },
    { path: 'parts[0].basis', rule: 'count', expected: 4, actual: 5 }, { path: 'parts[0].claims', rule: 'count', expected: 6, actual: 7 },
    { path: 'parts[0].name', rule: 'length', expected: 60, actual: 61 }, { path: 'parts[0].role', rule: 'length', expected: 300, actual: 301 },
    { path: 'relations', rule: 'count', expected: 16, actual: 17 }, { path: 'candidates', rule: 'count', expected: 6, actual: 7 },
    { path: 'gaps', rule: 'count', expected: 2, actual: 3 }, { path: 'matches', rule: 'count', expected: 24, actual: 25 },
    { path: 'material', rule: 'count', expected: 6, actual: 7 },
  ]);
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
  fragments[0].parts[0].claims.unshift({ ...fragments[0].parts[0].claims[0], key: 's50', at: 'N01.99' });
  fragments[0].parts[0].claims.push({ ...fragments[0].parts[0].claims[1], key: 's51', text: '두 번째 유지 주장' });
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
  assert.deepEqual(plain.parts[0].claims.map(c => c.key), ['s1', 's51']);
  assert.throws(() => M.validateMapReply(raw, f.ask), 'the single-call map.6 path still refuses the raw wire whole');
});

test('plan feedback names fixed paths, rules and counts only, for anchors, bounds, existing names and parents', () => {
  const f = fixture(1), blueprint = planned(f, 2), own = f.ask.parts[0];
  blueprint.parts.push({ ref: own.id, name: `${own.name} 변경`, parent: 'new:p1', at: [f.at[0]], focus: '기존 책임' });
  blueprint.parts[0].at = ['N99.01']; blueprint.parts[1].at = f.at.slice(0, 9); blueprint.parts[1].focus = '가'.repeat(401);
  blueprint.global = [{ kind: 'checked', text: '원문', at: [`${f.at[0]}-02`] }];
  refused(() => validateMapBlueprint(blueprint, f.ask));
  const issues = blueprintStageIssues(blueprint, f.ask);
  assert.deepEqual(issues, [
    { path: 'parts[0].at', rule: 'reference', expected: null, actual: null },
    { path: 'parts[1].focus', rule: 'length', expected: 400, actual: 401 }, { path: 'parts[1].at', rule: 'count', expected: 8, actual: 9 },
    { path: 'parts[2].name', rule: 'name-mismatch', expected: null, actual: null }, { path: 'parts[2].parent', rule: 'parent-mismatch', expected: null, actual: null },
    { path: 'global[0].kind', rule: 'kind', expected: null, actual: null }, { path: 'global[0].at', rule: 'reference', expected: null, actual: null }]);
  const encoded = JSON.stringify(issues);
  for (const leak of ['N0', 'N99', own.name, '가가']) assert.ok(!encoded.includes(leak));
  assert.deepEqual(blueprintStageIssues(planned(f, 2), f.ask), []);
  assert.deepEqual(blueprintStageIssues(null, f.ask), [{ path: 'reply', rule: 'shape', expected: null, actual: null }]);
  const trap = new Proxy({}, { get() { throw new Error('PRIVATE_TRAP'); } });
  assert.deepEqual(blueprintStageIssues(trap, f.ask), [{ path: 'reply', rule: 'keys', expected: null, actual: null }], 'a failing accessor ends the feedback quietly');
});
