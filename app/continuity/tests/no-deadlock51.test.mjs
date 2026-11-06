// Recipe .51 (Astra F5: no deadlock): a final review asking for a second revision never refuses the reading. The parts it names that the
// program's own check backs are held as one unit (revision-held) with what stands on them, the rest applies, the held rows go once more and
// then end rejected, and the next ask differs. Model-free: hand-written asks and replies, and the two stored growth-run refusals (anonymised
// fixtures, tests/fixtures/growth51) replayed with their stored stages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { encodeSpans, resolveRange } from '../dist/public/shared/evidence-span.js';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as T from '../dist/public/shared/record-table.js';
import * as X from '../dist/public/shared/record-excerpt.js';
import * as L from '../dist/public/shared/row-ledger.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import * as B from '../server/map-blueprint.mjs';
import { PIPELINE_RECIPE, LATER_PIPELINE_RECIPE } from '../server/map-pipeline.mjs';
import { replayPipeline, emptyGlobal } from './containment50-replay.mjs';
import { growthFixture, replayRefusal, fixtureInput, fixtureProject, appAsk } from './growth51-replay.mjs';

const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
const HEAD = '〔기록 AF5-51d0d0d0 · 쪽 1 · 기준 51c0de1 · 앞 쪽 —〕 보류 시험 기록 v5 (시험 세션, 2026-11-06 15:00)';
const TEXT = [HEAD,
  table('C-PART', [['B01', '저장', '처리 · 저장', '문서를 저장한다', 'F01', '구현됨', 'F01'], ['B02', '알림', '처리 · 알림', '결과를 알린다', 'F01', '구현됨', 'F01']]),
  table('C-ISSUE', [['IS01', 'B01', '파서가 없으면 저장 전에 거부한다', '모름', 'F01'], ['IS02', 'B01', '파일이 아니면 저장 전에 거부한다', '모름', 'F01']]),
  '저장은 결과를 알림에 넘긴다.'].join('\n');
function laterAsk() {
  return M.validateMapAsk({ schemaVersion: 'studio.map.7', project: { name: '보류 시험', purpose: null }, relations: [], requests: [], priors: [],
    parts: [{ id: 'P01', name: '저장', note: '', parentId: null, readAs: null, role: '문서를 저장한다.', roleBy: 'reading', roleAbout: null, current: [] },
      { id: 'P02', name: '알림', note: '', parentId: null, readAs: null, role: '결과를 알린다.', roleBy: 'reading', roleAbout: null, current: [] }],
    records: [{ id: 'N01', kind: 'pasted', note: '', basis: '보류 시험', ...encodeSpans('N01', TEXT) }] }, { route: 'divided' });
}
/** Where an alias stands in its record of the ask ({ record, from, to }). */
const placeOf = (ask, alias) => { const record = alias.slice(0, alias.indexOf('.')), t = M.askRecords(ask).get(record), r = resolveRange(alias, record, t.text, t.spans); return { record, from: r.from, to: r.to }; };
const at = (ask, words) => { for (const r of ask.records) { const s = r.spans.find(x => x.t.replace(/\s+/g, '').includes(words.replace(/\s+/g, ''))); if (s) return s.s; } throw new Error(`no piece ${words}`); };
const receipt = input => ({ covered: input.partition.records.flatMap(r => r.core), candidates: input.partition.records.map(r => ({ kind: 'part', text: '저장 책임', at: [r.core[0]] })) });
const empty = ref => ({ ref, name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [], claims: [] });
/** A later reading whose global stage asks for a revision of `named`, and whose final review asks again (`second`), the parts' claims quoting
 * the lines `quotes` gives for each part (the other plan rows of P01 then go unquoted). */
function answers(ask, { named = ['P01'], second = named, quotes = { P01: ['저장은 결과를'] }, relation = true }) {
  const b1 = at(ask, '|B01|'), other = at(ask, '저장은 결과를');
  return ({ stage, input }) => {
    if (stage === 'extract') return receipt(input);
    if (stage === 'plan') return { parts: [{ ref: 'P01', name: '저장', parent: null, at: [b1], focus: '저장 책임과 거부 조건' }, { ref: 'P02', name: '알림', parent: null, at: [b1], focus: '알림 책임' }], global: [], corrections: [] };
    if (stage === 'render') {
      let key = input.assignment.keyStart;
      const parts = input.assignment.parts.map(a => ({ ...empty(a.ref), claims: (quotes[a.ref] ?? []).map(w => ({ key: `s${key++}`, kind: 'describes', text: `${a.ref === 'P01' ? '저장' : '알림'}: ${w}`, at: at(ask, w), aboutAt: null, replaces: null })) }));
      return { summary: '', parts, relations: [], candidates: [], gaps: [], matches: [], material: [] };
    }
    const verdict = refs => ({ reviseParts: refs, reason: '거부 조건이 이 부분에서 빠졌다.', at: [at(ask, '|IS01|')] });
    if (!input.semanticReview) return verdict(named);
    if (second) return verdict(second);
    return { ...emptyGlobal(), summary: '저장과 알림을 읽었다.', relations: relation ? [{ from: 'P01', to: 'P02', kind: 'flow', note: '저장 결과', at: other, payload: null, payloadFields: [], cadence: null, mode: null, channel: null }] : [] };
  };
}

test('D51-1 a second revision verdict the program backs holds that part with what stands on it; the rest applies, and a replay costs nothing', async () => {
  const ask = laterAsk(), { pipeline, calls, store } = replayPipeline({}, answers(ask, { quotes: { P01: ['저장은 결과를'], P02: ['저장은 결과를'] } }));
  const out = await pipeline.read(ask);
  assert.deepEqual(calls.map(c => c.stage).filter(s => s !== 'extract'), ['plan', 'render', 'global', 'render', 'global'], 'one semantic pass and one final review, never a third');
  assert.deepEqual(out.wire.parts.map(p => p.ref), ['P02'], 'P01 is held, P02 applies');
  assert.ok(out.exclusions.length > 0 && out.exclusions.every(x => x.category === 'revision-held' && x.path === 'parts[0]'));
  for (const x of out.exclusions) assert.equal(x.explanation, M.explainExclusion(x.path, 'contract', 'revision-held'));
  const is01 = placeOf(ask, at(ask, '|IS01|'));
  assert.ok(out.exclusions.some(x => x.record === is01.record && x.from === is01.from && x.to === is01.to), 'the verdict\'s own line is held too');
  const diag = store.extra.get('global-final').diagnostics;
  assert.equal(diag[0].rule, 'revision'); assert.deepEqual([diag[0].expected, diag[0].actual], [1, 1]); assert.match(diag[0].names[0], /^보류 P01: /);
  const reply = M.validateMapReply(structuredClone(out.wire), ask); M.attachExclusions(reply, out.exclusions, ask);
  const count = calls.length, again = await pipeline.read(ask);
  assert.equal(calls.length, count); assert.deepEqual(again, out, 'the cached verdict replays the same reading');
});

test('D51-2 a verdict the program backs on no part (the model\'s opinion alone) is a diagnostic only: nothing is held', async () => {
  const ask = laterAsk(), { pipeline, store } = replayPipeline({}, answers(ask, { named: ['P02'], quotes: { P01: ['|IS01|', '|IS02|', '저장은 결과를'], P02: ['저장은 결과를'] } }));
  const out = await pipeline.read(ask);
  assert.deepEqual(out.wire.parts.map(p => p.ref), ['P01', 'P02']); assert.deepEqual(out.exclusions, []);
  const diag = store.extra.get('global-final').diagnostics;
  assert.deepEqual([diag[0].rule, diag[0].expected, diag[0].actual], ['revision', 1, 0]); assert.match(diag[0].names[0], /^판정만 P02: /);
  M.validateMapReply(structuredClone(out.wire), ask);
});

test('D51-3 holdRevisionParts leaves out the part, a new part under a held new part, their lines, port rows and candidates; nothing else', () => {
  const ask = laterAsk(), b1 = at(ask, '|B01|'), other = at(ask, '저장은 결과를'), is02 = at(ask, '|IS02|');
  const wire = { ...emptyGlobal(), parts: [{ ...empty('P01'), claims: [{ key: 's1', kind: 'describes', text: '저장한다', at: other, aboutAt: null, replaces: null }] },
    { ...empty('new:a'), name: '새 저장', parent: 'P01', role: '새 저장 책임', basis: [b1] }, { ...empty('new:b'), name: '새 하위', parent: 'new:a', role: '하위 책임', basis: [is02] }, { ...empty('P02'), claims: [] }],
    relations: [{ from: 'P02', to: 'new:b', kind: 'flow', note: '하위로', at: other }, { from: 'P02', to: 'P01', kind: 'flow', note: '저장으로', at: other }],
    portMap: [{ relation: 0, at: other }, { relation: 1, at: other }], candidates: [{ target: 'identity', parts: ['new:a', 'P02'], statement: null }] };
  const held = B.holdRevisionParts(wire, ask, ['new:a']);
  assert.deepEqual(held.held, ['new:a', 'new:b'], 'a new part under a held new part stands on it; one under an existing part does not');
  assert.deepEqual(held.wire.parts.map(p => p.ref), ['P01', 'P02']);
  assert.deepEqual(held.wire.relations.map(r => r.note), ['저장으로']); assert.deepEqual(held.wire.portMap, [{ relation: 0, at: other }]);
  assert.deepEqual(held.wire.candidates, []);
  assert.deepEqual(held.exclusions.map(x => x.path), ['parts[1]', 'parts[2]', 'relations[0]', 'portMap[0]', 'candidates[0]']);
  assert.equal(wire.parts.length, 4, 'the wire as written is not changed');
  assert.deepEqual(B.holdRevisionParts(wire, ask, ['P09']).exclusions, [], 'a part the wire does not hold holds nothing');
});

/* ---------- the ledger (M2): held once, sent again once, then rejected; the next ask differs ---------- */
const meta = n => ({ id: `R_${crypto.randomUUID()}`, at: `2026-11-06T0${n}:00:00.000Z`, model: 'stub', prompt: 'm7-000000000051', hash: createHash('sha256').update(`d51-${n}-${Math.random()}`).digest('hex') });
const pageOf = () => [HEAD, table('C-PART', [['B01', '저장', '처리 · 저장', '문서를 저장한다', 'F01', '구현됨', 'F01']]),
  table('C-ISSUE', [['IS01', 'B01', '파서가 없으면 저장 전에 거부한다', '모름', 'F01']]), table('C-END', [['C-PART', '끝남', 'B01', '—', '—'], ['C-ISSUE', '끝남', 'IS01', '—', '—']])].join('\n');
/** One reading of the project's next ask: the part's C-PART row reflected, and a revision hold on the IS01 row when `hold`. */
function readOnce(p, n, hold) {
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA);
  if (inp.problem) return { inp, project: p };
  const ask = inp.ask, own = ask.parts[0], b01 = ask.records.flatMap(r => r.spans).find(s => s.t.includes('|B01|'))?.s ?? null;
  const wire = { summary: '', parts: b01 ? [{ ...empty(own.id), basis: [b01], claims: [{ key: 's1', kind: 'describes', text: '저장은 문서를 저장한다.', at: b01, aboutAt: null, replaces: null }] }] : [], relations: [], candidates: [], gaps: [], matches: [], material: [] };
  const reply = M.validateMapReply(structuredClone(wire), ask);
  const alias = ask.records.flatMap(r => r.spans).find(s => s.t.includes('|IS01|'))?.s;
  if (hold && alias) M.attachExclusions(reply, [{ path: 'parts[0]', rule: 'contract', category: 'revision-held', explanation: M.explainExclusion('parts[0]', 'contract', 'revision-held'), ...placeOf(ask, alias) }], ask);
  return { inp, project: M.applyReading(p, inp, reply, meta(n)).project };
}
const rowOf = p => [...L.rowLedger(p, X.v5Folds(p.pasted)).values()].find(x => x.table === 'C-ISSUE' && x.id === 'IS01');
const sends = inp => !inp.problem && inp.ask.records.some(r => r.spans.some(s => s.t.includes('|IS01|')));

test('D51-4 a revision-held row is held (revision), goes with the next ask once, and is rejected (revision) when held so again', () => {
  let p = D.addArea({ ...D.createProject(), name: '보류 시험' }, '저장', '사람이 만든 부분');
  p = parseProject(JSON.stringify(D.pasteRecord(p, pageOf(), null).project));
  const first = readOnce(p, 1, true), r1 = rowOf(first.project);
  assert.deepEqual([r1.state, r1.reason, r1.detail], ['held', 'revision', 'revision-held']);
  const next = M.buildMapAsk(first.project, studioView(first.project), [], undefined, M.MAP7_SCHEMA);
  assert.notEqual(JSON.stringify(next.ask), JSON.stringify(first.inp.ask), 'the next ask differs');
  assert.ok(sends(next), 'the held row goes again once');
  const second = readOnce(first.project, 2, true), r2 = rowOf(second.project);
  assert.deepEqual([r2.state, r2.reason, r2.detail], ['rejected', 'revision', 'revision-held'], 'held so again: rejected with its reason');
  const third = M.buildMapAsk(second.project, studioView(second.project), [], undefined, M.MAP7_SCHEMA);
  assert.ok(!sends(third), 'never sent a third time'); assert.equal(third.problem, 'NOTHING_NEW', 'no deadlock: nothing is left to ask');
  // Held once and then placed: the row is reflected (a later reading's item on it wins).
  const back = readOnce(first.project, 3, false), r3 = rowOf(back.project);
  assert.notEqual(r3.state, 'held');
  const counts = L.ledgerCounts(L.rowLedger(second.project, X.v5Folds(second.project.pasted)));
  assert.equal(counts.reasons['rejected:revision'], 1);
  for (const x of L.rowLedger(second.project, X.v5Folds(second.project.pasted)).values()) assert.ok(x.state === 'reflected' ? x.reason === null : !!x.reason, 'every row ends with a state and a reason');
});

/* ---------- the cascade (M3) ---------- */
test('D51-5 a revision verdict is never told its summary is unbacked; plan units on rows set aside in this reading are not expected', () => {
  const ask = laterAsk(), parts = [{ ...empty('P01'), claims: [{ key: 's1', kind: 'describes', text: '저장은 결과를 알림에 넘긴다', at: at(ask, '저장은 결과를'), aboutAt: null, replaces: null }] }];
  const plan = { parts: [{ ref: 'P01', name: '저장', parent: null, at: [at(ask, '|B01|')], focus: '저장' }], global: [], corrections: [] };
  const verdict = { reviseParts: ['P01'], reason: '조건이 빠졌다.', at: [at(ask, '|IS01|')] };
  const issues = B.mapStageIssues(verdict, null, { ask, parts, blueprint: plan });
  assert.ok(!issues.some(i => i.rule === 'unbacked'), 'a verdict writes no summary to judge');
  const all = B.planClaims(ask, plan, parts), aside = [placeOf(ask, at(ask, '|IS01|'))];
  const survived = B.planClaims(ask, plan, parts, aside, { survived: true });
  assert.equal(survived.items, all.items - 1, 'the set-aside row is not expected'); assert.equal(survived.missing.length, all.missing.length - 1);
  assert.equal(B.planClaims(ask, plan, parts, aside).items, all.items, 'the default count is unchanged');
  assert.deepEqual(B.revisionBacking(verdict, parts, ask, plan, aside).backed, all.missing.length > 1 ? ['P01'] : []);
});

test('D51-6 the recipes name .51 and the later containment rules later-containment.3', () => {
  assert.deepEqual([PIPELINE_RECIPE, LATER_PIPELINE_RECIPE, B.CONTAINMENT_VERSION], ['first-map-divided.51', 'later-map-divided.51', 'later-containment.3']);
});

/* ---------- the two stored refusals, replayed offline ---------- */
test('D51-F the growth fixtures are anonymised (no project or person name of the source repository)', () => {
  const dir = new URL('./fixtures/growth51/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const text = gunzipSync(readFileSync(new URL(f, dir))).toString('utf8');
    for (const word of ['paper' + 'less', 'win' + 'kler', 'sha' + 'moon']) assert.ok(!new RegExp(word, 'i').test(text), `${f}: ${word}`);
  }
});

test('D51-R1 track A stage 3 r3: the reading now applies with the named part held, nothing else lost, and the next ask differs', async () => {
  const fx = growthFixture('track-a'), inp = fixtureInput(fx), ask = inp.ask, calls = [];
  const { pipeline, store } = replayRefusal(fx, c => calls.push(c.stage));
  const out = await pipeline.read(ask);
  assert.deepEqual(calls, ['global'], 'only the final review is answered (the stored verdict); every other stage is the stored one');
  assert.deepEqual(fx.final.reviseParts, ['P06']);
  assert.ok(out.exclusions.length > 0 && out.exclusions.every(x => x.category === 'revision-held'));
  // Nothing else lost: the wire is the fragments combined without a global rewrite, less P06's entry.
  const plan = fx.stages.plan.value, groups = B.splitBlueprintParts(plan);
  const fragments = groups.map((_, i) => ['-semantic-correction', '-semantic', '-correction', ''].map(s => fx.stages[`render-${i + 1}${s}`]).find(Boolean).value);
  const combined = B.combineRenderedReading(fragments, emptyGlobal(), ask, plan).wire;
  assert.deepEqual(out.wire.parts, combined.parts.filter(p => p.ref !== 'P06'));
  assert.equal(store.extra.get('global-final').diagnostics[0].rule, 'revision');
  // Applied to the state the ask was built from: P06's rows are held (revision) and the next ask is not the refused one.
  const before = fixtureProject(fx);
  assert.equal(JSON.stringify(appAsk(before).ask), JSON.stringify(ask), 'the fixture state rebuilds the refused ask exactly');
  const reply = M.validateMapReply(structuredClone(out.wire), ask); M.attachExclusions(reply, out.exclusions, ask);
  const applied = M.applyReading(before, inp, reply, meta(5));
  const ledger = L.rowLedger(applied.project, X.v5Folds(applied.project.pasted));
  const held = [...ledger.values()].filter(x => x.reason === 'revision');
  assert.ok(held.length > 0 && held.every(x => x.state === 'held' && x.detail === 'revision-held'));
  for (const x of ledger.values()) assert.ok(x.state === 'reflected' ? x.reason === null : !!x.reason, `${x.table} ${x.id} has a reason`);
  const next = appAsk(applied.project);
  assert.equal(next.problem, null); assert.notEqual(JSON.stringify(next.ask), JSON.stringify(ask), 'the next ask differs: no deadlock');
  // The same refused input replayed again gives the same reading at no cost.
  const count = calls.length; assert.deepEqual(await pipeline.read(ask), out); assert.equal(calls.length, count);
});

test('D51-R2 track R r4: a verdict with no machine issue is only a diagnostic; the whole reading applies', async () => {
  const fx = growthFixture('track-r'), ask = fixtureInput(fx).ask;
  const { pipeline, store } = replayRefusal(fx);
  const out = await pipeline.read(ask);
  assert.deepEqual(out.exclusions, []);
  const plan = fx.stages.plan.value, groups = B.splitBlueprintParts(plan);
  const fragments = groups.map((_, i) => ['-semantic-correction', '-semantic', '-correction', ''].map(s => fx.stages[`render-${i + 1}${s}`]).find(Boolean).value);
  assert.deepEqual(out.wire.parts, B.combineRenderedReading(fragments, emptyGlobal(), ask, plan).wire.parts, 'every rendered part applies');
  const diag = store.extra.get('global-final').diagnostics[0];
  assert.deepEqual([diag.rule, diag.expected, diag.actual], ['revision', 1, 0]);
  M.validateMapReply(structuredClone(out.wire), ask);
});
