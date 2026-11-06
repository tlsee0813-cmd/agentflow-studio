// Recipe .50 step 2 (Astra F5 Q1, Q5, Q7(2)): a later plan's correction obligation must rest on evidence that states a change, and one still
// unmet after the semantic re-render is held with its dependents as one unit while the rest of the reading applies; no refusal replays.
// Model-free: hand-written asks and replies, and, when the growth run's artefacts are on this machine (AF_GROWTH_DIR), its stored stages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeSpans, resolveRange } from '../dist/public/shared/evidence-span.js';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as T from '../dist/public/shared/record-table.js';
import * as X from '../dist/public/shared/record-excerpt.js';
import * as L from '../dist/public/shared/row-ledger.js';
import * as J from '../dist/public/shared/map-job.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import * as B from '../server/map-blueprint.mjs';
import { LATER_PIPELINE_RECIPE } from '../server/map-pipeline.mjs';
import { storedRun, replayPipeline, replayStore, emptyGlobal } from './containment50-replay.mjs';

const pad = n => String(n).padStart(2, '0');
const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
const HEAD = '〔기록 AF5-50c2c2c2 · 쪽 1 · 기준 50c0de2 · 앞 쪽 —〕 봉쇄 시험 기록 v5 (시험 세션, 2026-11-06 11:00)';
const TEXT = [HEAD,
  table('C-PART', [['B01', '저장', '처리 · 저장', '문서를 저장한다', 'F01', '구현됨', 'F01'], ['B02', '알림', '처리 · 알림', '결과를 알린다', 'F01', '구현됨', 'F01']]),
  table('C-ISSUE', [['IS01', 'B01', '사후 스크립트가 없으면 저장 뒤 실패를 보낸다', '모름', 'F01'], ['IS02', 'B01', '사후 스크립트 설정은 제거됨, 저장만 남음', '모름', 'F01']]),
  table('C-WITHDRAW', [['WD01', 'B01', '사후 스크립트로 실패 처리', '저장 단계에서 직접 실패 처리', '옮김', '—', 'F01'], ['WD02', 'B02', '메일 알림', '웹 알림', '옮김', '—', 'F01']]),
  '정정: 사후 스크립트로 실패를 처리한다는 앞 보고를 철회합니다.',
  '저장은 결과를 알림에 넘긴다.'].join('\n');
/** A later ask by hand: two existing parts, the first with two current claims, and one v5 page with prose after it. */
function laterAsk() {
  return M.validateMapAsk({ schemaVersion: 'studio.map.7', project: { name: '봉쇄 시험', purpose: null }, relations: [], requests: [], priors: [],
    parts: [{ id: 'P01', name: '저장', note: '', parentId: null, readAs: null, role: '문서를 저장한다.', roleBy: 'reading', roleAbout: null,
      current: [{ key: 'C01', kind: 'describes', text: '사후 스크립트가 없으면 건너뛰고 오류면 실패 처리한다.', about: null }, { key: 'C02', kind: 'describes', text: '저장은 한 번만 한다.', about: null }] },
    { id: 'P02', name: '알림', note: '', parentId: null, readAs: null, role: '결과를 알린다.', roleBy: 'reading', roleAbout: null, current: [] }],
    records: [{ id: 'N01', kind: 'pasted', note: '', basis: '봉쇄 시험', ...encodeSpans('N01', TEXT) }] }, { route: 'divided' });
}
const at = (ask, words) => { for (const r of ask.records) { const s = r.spans.find(x => x.t.replace(/\s+/g, '').includes(words.replace(/\s+/g, ''))); if (s) return s.s; } throw new Error(`no piece ${words}`); };
const ob = (ask, ...rows) => ({ part: 'P01', claim: 'C01', at: rows.map(w => at(ask, w)) });

test('C50-1 an obligation rests on what its evidence says changed, not on the table it stands in', () => {
  const ask = laterAsk(), J1 = o => B.correctionJustified(o, ask);
  assert.equal(J1(ob(ask, '|IS01|')), false, 'a defect row states no change: no withdrawal obligation');
  assert.equal(J1(ob(ask, '|IS02|')), true, 'a defect row that says what was removed, of the same subject, can');
  assert.equal(J1(ob(ask, '|WD01|')), true, 'a withdrawal row on the claim\'s subject');
  assert.equal(J1(ob(ask, '|WD02|')), false, 'a withdrawal row about something else (no shared target word)');
  assert.equal(J1(ob(ask, '정정: 사후')), true, 'prose keeps the planner\'s reading (the program cannot judge it)');
  assert.equal(J1(ob(ask, '|IS01|', '|WD01|')), true, 'any one justifying line is enough');
  const plan = { parts: [{ ref: 'P01', name: '저장', parent: null, at: [at(ask, '|B01|')], focus: '저장 책임' }], global: [],
    corrections: [ob(ask, '|IS01|'), { part: 'P01', claim: 'C02', at: [at(ask, '|WD01|')] }] };
  B.validateMapBlueprint(plan, ask);
  assert.deepEqual(B.unjustifiedCorrections(plan, ask), [0]);
  assert.deepEqual(B.correctionSetAside(plan, ask), [{ path: 'corrections[0]', rule: 'contract', category: 'correction-unjustified' }]);
  const effective = B.justifiedBlueprint(plan, ask);
  assert.deepEqual(effective.corrections, [plan.corrections[1]]); assert.equal(plan.corrections.length, 2, 'the plan as written is not changed');
});

/* ---------- the pipeline: one semantic pass, then the unmet unit is held and the rest applies ---------- */
const receipt = input => ({ covered: input.partition.records.flatMap(r => r.core), candidates: input.partition.records.map(r => ({ kind: 'part', text: '저장 책임', at: [r.core[0]] })) });
function answers(ask, { obligations, semanticReplaces = null }) {
  const withdraw = at(ask, '정정: 사후'), other = at(ask, '저장은 결과를'), b1 = at(ask, '|B01|');
  return ({ stage, input }) => {
    if (stage === 'extract') return receipt(input);
    if (stage === 'plan') return { parts: [{ ref: 'P01', name: '저장', parent: null, at: [b1], focus: '저장 책임과 정정' }, { ref: 'P02', name: '알림', parent: null, at: [b1], focus: '알림 책임' }], global: [], corrections: obligations };
    if (stage === 'render') {
      let key = input.assignment.keyStart;
      const parts = input.assignment.parts.map(a => ({ ref: a.ref, name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [],
        claims: a.ref === 'P01' ? [{ key: `s${key++}`, kind: 'reported', text: '사후 스크립트 실패 처리 보고를 철회했다고 보고함', at: withdraw, aboutAt: null, replaces: input.semanticReview ? semanticReplaces : null },
          { key: `s${key++}`, kind: 'describes', text: '저장은 결과를 알림에 넘긴다.', at: other, aboutAt: null, replaces: null }] : [] }));
      return { summary: '', parts, relations: [], candidates: [], gaps: [], matches: [], material: [] };
    }
    return { ...emptyGlobal(), summary: '저장과 알림을 읽었다.', relations: [
      { from: 'P01', to: 'P02', kind: 'flow', note: '정정된 실패 처리 결과', at: withdraw, payload: null, payloadFields: [], cadence: null, mode: null, channel: null },
      { from: 'P01', to: 'P02', kind: 'flow', note: '저장 결과', at: other, payload: null, payloadFields: [], cadence: null, mode: null, channel: null }] };
  };
}

test('C50-2 an unmet justified obligation is held with the claim and line on its lines; the rest applies, and a second press replays it at no cost', async () => {
  const ask = laterAsk(), obligation = ob(ask, '정정: 사후');
  const { pipeline, calls, store } = replayPipeline({}, answers(ask, { obligations: [obligation] }));
  const out = await pipeline.read(ask);
  assert.deepEqual(calls.map(c => c.stage).filter(s => s !== 'extract'), ['plan', 'render', 'render', 'global'], 'one semantic pass and one final review, no refusal');
  assert.ok(calls.at(-1).input.semanticReview, 'the paid review is global-final');
  assert.deepEqual(calls.at(-1).input.blueprint.corrections, [], 'global-final checks only the kept obligations');
  assert.deepEqual(store.extra.get('global-final').setAside, [{ path: 'corrections[0]', rule: 'contract', category: 'correction-unmet' }]);
  assert.deepEqual(out.exclusions.map(x => [x.path, x.category]), [['parts[0].claims', 'correction-unmet'], ['parts[0].claims[0]', 'correction-held'], ['relations[0]', 'correction-held']]);
  for (const x of out.exclusions) assert.equal(x.explanation, M.explainExclusion(x.path, 'contract', x.category));
  assert.deepEqual(out.wire.parts[0].claims.map(c => c.text), ['저장은 결과를 알림에 넘긴다.'], 'the claim on the obligation\'s line is held, the other applies');
  assert.deepEqual(out.wire.relations.map(r => r.note), ['저장 결과']);
  const reply = M.validateMapReply(structuredClone(out.wire), ask); M.attachExclusions(reply, out.exclusions, ask);
  assert.ok(M.readingExclusions(reply).some(x => x.category === 'correction-unmet'));
  // The same ask again: every stage comes from the store, nothing is called and the same reading comes back (never a cached refusal).
  const count = calls.length, again = await pipeline.read(ask);
  assert.equal(calls.length, count); assert.deepEqual(again, out);
});

test('C50-3 a met obligation still applies its replacement; an unjustified one never asks for a semantic pass and is named', async () => {
  const ask = laterAsk();
  const met = replayPipeline({}, answers(ask, { obligations: [ob(ask, '정정: 사후')], semanticReplaces: 'C01' }));
  const done = await met.pipeline.read(ask);
  assert.equal(done.exclusions.length, 0); assert.equal(done.wire.parts[0].claims[0].replaces, 'C01'); assert.equal(done.wire.relations.length, 2);
  const unjust = replayPipeline({}, answers(ask, { obligations: [ob(ask, '|IS01|')] }));
  const out = await unjust.pipeline.read(ask);
  assert.deepEqual(unjust.calls.map(c => c.stage).filter(s => s !== 'extract'), ['plan', 'render', 'global'], 'no semantic pass for an obligation the evidence does not support');
  assert.deepEqual(unjust.calls.find(c => c.stage === 'render').input.blueprint.corrections, [], 'the renderer is not asked for that replacement');
  assert.deepEqual(unjust.store.extra.get('plan').setAside, [{ path: 'corrections[0]', rule: 'contract', category: 'correction-unjustified' }]);
  assert.deepEqual(out.exclusions.map(x => [x.path, x.category]), [['parts[0].claims', 'correction-unjustified']]);
  assert.equal(out.wire.parts[0].claims.length, 2); assert.equal(out.wire.relations.length, 2, 'nothing is held for it');
  // Gate 2 still guards a kept obligation: a combine told to keep it, with no replacement, refuses.
  const plan = { parts: [{ ref: 'P01', name: '저장', parent: null, at: [at(ask, '|B01|')], focus: '저장' }], global: [], corrections: [ob(ask, '정정: 사후')] };
  const fragment = { summary: '', parts: [{ ref: 'P01', name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [], claims: [] }], relations: [], candidates: [], gaps: [], matches: [], material: [] };
  assert.throws(() => B.combineRenderedReading([fragment], emptyGlobal(), ask, plan));
});

test('C50-4 the later recipe names its containment rules and reading contract (the key of a cached run changes with them)', () => {
  const { pipeline } = replayPipeline({});
  assert.equal(B.CONTAINMENT_VERSION, 'later-containment.2'); assert.equal(M.READING_CONTRACT, 'map-reading.20');
  assert.equal(pipeline.describe().laterVersion, LATER_PIPELINE_RECIPE);
  assert.match(pipeline.laterIdentity, /^[0-9a-f]{64}$/);
  assert.notEqual(pipeline.laterIdentity, replayPipeline({}).pipeline.identity);
});

/* ---------- the ledger: a held unit's rows are not sent again until their target changes ---------- */
const meta = (n) => ({ id: `R_${crypto.randomUUID()}`, at: '2026-11-06T02:00:00.000Z', model: 'stub', prompt: 'm7-000000000050', hash: String(n).repeat(64) });
test('C50-5 rows under a held unit are held (correction) with their part, are not sent again, and wait again once that part changes', () => {
  const page = [HEAD, table('C-PART', [['B01', '저장', '처리 · 저장', '문서를 저장한다', 'F01', '구현됨', 'F01']]),
    table('C-ISSUE', [['IS01', 'B01', '사후 스크립트가 없으면 저장 뒤 실패를 보낸다', '모름', 'F01']]), table('C-END', [['C-PART', '끝남', 'B01', '—', '—'], ['C-ISSUE', '끝남', 'IS01', '—', '—']])].join('\n');
  let p = D.addArea({ ...D.createProject(), name: '봉쇄 시험' }, '저장', '사람이 만든 부분');
  p = parseProject(JSON.stringify(D.pasteRecord(p, page, null).project));
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA), ask = inp.ask, own = ask.parts[0];
  const b01 = at(ask, '|B01|'), is01 = at(ask, '|IS01|');
  const wire = { summary: '', parts: [{ ref: own.id, name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [b01],
    claims: [{ key: 's1', kind: 'describes', text: '저장은 문서를 저장한다.', at: b01, aboutAt: null, replaces: null }] }], relations: [], candidates: [], gaps: [], matches: [], material: [] };
  const reply = M.validateMapReply(structuredClone(wire), ask), texts = M.askRecords(ask), record = is01.slice(0, 3), range = resolveRange(is01, record, texts.get(record).text, texts.get(record).spans);
  M.attachExclusions(reply, [{ path: 'parts[0].claims', rule: 'contract', category: 'correction-unmet', explanation: M.explainExclusion('parts[0].claims', 'contract', 'correction-unmet'), record, from: range.from, to: range.to }], ask);
  const applied = M.applyReading(p, inp, reply, meta(1)), area = inp.parts.get(own.id);
  const led = L.rowLedger(applied.project, X.v5Folds(applied.project.pasted)), row = [...led.values()].find(x => x.table === 'C-ISSUE' && x.id === 'IS01');
  assert.deepEqual([row.state, row.reason, row.detail, row.with], ['held', 'correction', 'correction-unmet', [area]]);
  assert.equal([...led.values()].find(x => x.table === 'C-PART').state, 'reflected');
  const next = M.buildMapAsk(applied.project, studioView(applied.project), [], undefined, M.MAP7_SCHEMA);
  assert.ok(!next.ask.records.some(r => (r.note ?? '').includes('IS01')), 'the held row is not asked about again');
  // A later reading writes a claim on that part (its target state changed): the row waits again and goes with the next ask.
  p = parseProject(JSON.stringify(D.pasteRecord(applied.project, '저장은 이제 사후 스크립트 없이 바로 실패를 기록한다.', null).project));
  const inp2 = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA), at2 = inp2.ask.records.find(r => r.spans.some(s => s.t.includes('이제 사후'))).spans.find(s => s.t.includes('이제 사후')).s;
  const reply2 = M.validateMapReply({ summary: '', parts: [{ ref: inp2.ask.parts[0].id, name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [],
    claims: [{ key: 's1', kind: 'describes', text: '저장은 사후 스크립트 없이 실패를 기록한다.', at: at2, aboutAt: null, replaces: null }] }], relations: [], candidates: [], gaps: [], matches: [], material: [] }, inp2.ask);
  const after = M.applyReading(p, inp2, reply2, meta(2)).project;
  const led2 = L.rowLedger(after, X.v5Folds(after.pasted)), row2 = [...led2.values()].find(x => x.table === 'C-ISSUE' && x.id === 'IS01');
  assert.deepEqual([row2.state, row2.reason, row2.detail], ['waiting', 'transient', 'correction-unmet']);
  const third = M.buildMapAsk(after, studioView(after), [], undefined, M.MAP7_SCHEMA);
  assert.ok(third.ask.records.some(r => (r.note ?? '').includes('IS01')), 'it goes again, named');
});

/* ---------- replay of the stored growth run (AF_GROWTH_DIR): stage4-r4 and stage4-r6 refused at render-semantic under .49 ---------- */
const GROWTH = process.env.AF_GROWTH_DIR ?? '';
const have = run => !!GROWTH && existsSync(join(GROWTH, 'runs', run, 'jobs/first-map/pipeline.json'));
const C162 = '사후 스크립트 설정이 없으면 건너뛰고', S123 = '사후 스크립트가 없거나 실행 오류가 나면';
const baseProject = () => parseProject(readFileSync(join(GROWTH, 'project/state-after-4.json'), 'utf8'));
const claimsOf = (p, area) => M.partUnderstanding(p, area).claims.map(c => c.text);
for (const run of ['stage4-r4', 'stage4-r6']) {
  test(`C50-R ${run}: the stored stages now give a reading: the plan's obligation on a defect row is set aside, nothing else is lost`, { skip: !have(run) }, async () => {
    const { stages, input, ask } = storedRun(GROWTH, run), plan = stages.plan.value;
    assert.deepEqual(plan.corrections.map(o => [o.part, o.claim, o.at.join()]), [['P46', 'C162', 'N02.63']]);
    const { pipeline, calls } = replayPipeline(stages);
    const out = await pipeline.read(ask);
    assert.deepEqual(calls.map(c => c.stage), ['global'], 'only the stage those runs never reached; no semantic pass');
    assert.deepEqual(out.exclusions.map(x => [x.path, x.category, x.record]), [[`parts[${out.wire.parts.findIndex(p => p.ref === 'P46')}].claims`, 'correction-unjustified', 'N02']]);
    const inp = J.decodeMapInput(input), p = baseProject(), reply = M.validateMapReply(structuredClone(out.wire), inp.ask);
    M.attachExclusions(reply, out.exclusions, inp.ask);
    const applied = M.applyReading(p, inp, reply, meta(4)), area = inp.parts.get('P46');
    const now = claimsOf(applied.project, area);
    assert.ok(now.some(t => t.includes(C162)), 'C162 stays current'); assert.ok(now.some(t => t.includes(S123)), 's123 (the defect) applies');
    assert.ok(applied.reading.exclusions.some(x => x.category === 'correction-unjustified'));
  });
  test(`C50-R ${run}: taken as justified, exactly the unit (the obligation and s123) is held and the rest applies`, { skip: !have(run) }, () => {
    const { stages, input, ask } = storedRun(GROWTH, run), plan = stages.plan.value;
    const fragments = B.splitBlueprintParts(plan).map((_, i) => ['-semantic-correction', '-semantic', '-correction', ''].map(s => stages[`render-${i + 1}${s}`]).find(s => s?.state === 'complete').value);
    const parts = { summary: '', parts: fragments.flatMap(f => f.parts), relations: [], candidates: [], gaps: [], matches: [], material: [] };
    const held = B.missingMapCorrections(parts, ask, plan);
    assert.deepEqual(held, plan.corrections, 'the renderer did not write the replacement (both passes)');
    const kept = { ...plan, corrections: [] }, combined = B.combineRenderedReading(fragments, emptyGlobal(), ask, kept).wire;
    const out = B.holdCorrectionUnits(combined, ask, kept, held), i = combined.parts.findIndex(p => p.ref === 'P46');
    assert.deepEqual(out.exclusions.map(x => [x.path, x.category]), [[`parts[${i}].claims`, 'correction-unmet'], [`parts[${i}].claims[0]`, 'correction-held']]);
    assert.equal(combined.parts[i].claims[0].key, 's123');
    assert.deepEqual(out.wire.parts[i].claims.map(c => c.key), combined.parts[i].claims.slice(1).map(c => c.key), 'only s123 is held');
    assert.deepEqual(out.wire.parts.filter((_, k) => k !== i), combined.parts.filter((_, k) => k !== i), 'every other part as written');
    const inp = J.decodeMapInput(input), p = baseProject(), reply = M.validateMapReply(structuredClone(out.wire), inp.ask);
    M.attachExclusions(reply, out.exclusions, inp.ask);
    const applied = M.applyReading(p, inp, reply, meta(5)), area = inp.parts.get('P46'), now = claimsOf(applied.project, area);
    assert.ok(now.some(t => t.includes(C162)), 'C162 stays current'); assert.ok(!now.some(t => t.includes(S123)), 's123 waits with its unit');
    const led = L.rowLedger(applied.project, X.v5Folds(applied.project.pasted));
    const issue = [...led.values()].filter(x => x.table === 'C-ISSUE' && x.reading === applied.reading.id && x.state === 'held');
    assert.deepEqual(issue.map(x => [x.id, x.reason, x.with]), [['IS02', 'correction', [area]]]);
  });
}

test('C50-7 a claim meeting a kept obligation on the same line is never held with an unmet one; a port-map row follows its held line', () => {
  const ask = laterAsk(), line = at(ask, '정정: 사후'), other = at(ask, '저장은 결과를');
  const plan = { parts: [{ ref: 'P01', name: '저장', parent: null, at: [line], focus: '저장' }, { ref: 'P02', name: '알림', parent: null, at: [line], focus: '알림' }], global: [],
    corrections: [{ part: 'P01', claim: 'C01', at: [line] }, { part: 'P01', claim: 'C02', at: [line] }] };
  const wire = { ...emptyGlobal(), parts: [{ ref: 'P01', name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [],
    claims: [{ key: 's1', kind: 'reported', text: '앞 보고를 철회함', at: line, aboutAt: null, replaces: 'C02' }, { key: 's2', kind: 'reported', text: '철회 줄의 다른 진술', at: line, aboutAt: null, replaces: null }] }],
    relations: [{ from: 'P01', to: 'P02', kind: 'flow', note: '저장 결과', at: other }, { from: 'P02', to: 'P01', kind: 'flow', note: '철회된 결과', at: line }],
    portMap: [{ relation: 0, at: other }, { relation: 1, at: line }] };
  const out = B.holdCorrectionUnits(wire, ask, plan, [plan.corrections[0]]);
  assert.deepEqual(out.exclusions.map(x => [x.path, x.category]), [['parts[0].claims', 'correction-unmet'], ['parts[0].claims[1]', 'correction-held'], ['relations[1]', 'correction-held'], ['portMap[1]', 'correction-held']]);
  assert.deepEqual(out.wire.parts[0].claims.map(c => c.key), ['s1']);
  assert.deepEqual(out.wire.relations.map(r => r.note), ['저장 결과']); assert.deepEqual(out.wire.portMap, [{ relation: 0, at: other }]);
  assert.equal(wire.parts[0].claims.length, 2, 'the wire as written is not changed');
});

test('C50-6 the replay store answers only completed stored stages', () => {
  const s = replayStore({ a: { state: 'complete', value: { x: 1 } }, b: { state: 'failed' } });
  assert.deepEqual(s.get('k', 'a'), { x: 1 }); assert.equal(s.get('k', 'b'), null); assert.equal(s.get('k', 'c'), null);
});
