// Recipe .51 (Astra F5: no deadlock): a final review asking for a second revision never refuses the reading. Review of .51: on the parts it
// names that the program's own check backs, what is missing (the rows of the missing plan units and the cited lines no item quotes) is held
// (revision-held) and every rendered item applies; a semantic render or final review that fails on the revision path is that revision's
// verdict; the held rows go once more and then end rejected, and the next ask differs. Model-free: hand-written asks and replies, and the two stored growth-run refusals (anonymised
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
import { parseProject, validateProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';
import { latestMapSummary } from '../dist/public/shared/types.js';
import { buildLedger } from '../dist/public/shared/report-ask.js';
import * as B from '../server/map-blueprint.mjs';
import { PIPELINE_RECIPE, LATER_PIPELINE_RECIPE } from '../server/map-pipeline.mjs';
import { replayPipeline, emptyGlobal } from './containment50-replay.mjs';
import { ApiError } from '../../server/errors.mjs';
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

test('D51-1 a second revision verdict the program backs holds what is missing on that part; every rendered item applies, and a replay costs nothing', async () => {
  const ask = laterAsk(), { pipeline, calls, store } = replayPipeline({}, answers(ask, { quotes: { P01: ['저장은 결과를'], P02: ['저장은 결과를'] } }));
  const out = await pipeline.read(ask);
  assert.deepEqual(calls.map(c => c.stage).filter(s => s !== 'extract'), ['plan', 'render', 'global', 'render', 'global'], 'one semantic pass and one final review, never a third');
  assert.deepEqual(out.wire.parts.map(p => [p.ref, p.claims.length]), [['P01', 1], ['P02', 1]], 'nothing leaves the wire: P01 keeps its claim');
  // P01's missing units are its IS01 and IS02 rows (no item quotes them; the verdict cites IS01): one place, the two adjacent rows.
  const is01 = placeOf(ask, at(ask, '|IS01|')), is02 = placeOf(ask, at(ask, '|IS02|'));
  assert.deepEqual(out.exclusions.map(x => [x.path, x.category, x.record, x.from, x.to]), [['parts[0]', 'revision-held', 'N01', is01.from, is02.to]]);
  for (const x of out.exclusions) assert.equal(x.explanation, M.explainExclusion(x.path, 'contract', 'revision-held'));
  const diag = store.extra.get('global-final').diagnostics;
  assert.equal(diag[0].rule, 'revision'); assert.deepEqual([diag[0].expected, diag[0].actual], [1, 1]); assert.match(diag[0].names[0], /^확인 P01: /);
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

test('D51-3 revisionHolds names only places no item quotes, adjacent ones of a part as one, within the room it is given; the wire is untouched', () => {
  const ask = laterAsk(), b1 = placeOf(ask, at(ask, '|B01|')), b2 = placeOf(ask, at(ask, '|B02|')), is01 = placeOf(ask, at(ask, '|IS01|')), is02 = placeOf(ask, at(ask, '|IS02|'));
  const wire = { ...emptyGlobal(), parts: [{ ...empty('P02'), claims: [{ key: 's1', kind: 'describes', text: '알린다', at: at(ask, '|B02|'), aboutAt: null, replaces: null }] }, { ...empty('P01'), claims: [] }] };
  const before = structuredClone(wire), row = p => ({ record: p.record, from: p.from, to: p.to });
  const backing = { backed: ['P01'], units: [{ ref: 'P01', rows: [row(is01)] }, { ref: 'P01', rows: [row(is02)] }, { ref: 'P01', rows: [row(b2)] }, { ref: 'P02', rows: [row(b1)] }] };
  const holds = B.revisionHolds(wire, ask, backing, { reviseParts: ['P01'], reason: '빠졌다', at: [at(ask, '|B01|')] });
  // IS01 and IS02 as one place (only a line break between); B02 is P02's claim's (an item stands on it); P02 is not backed (its unit is not
  // held); the cited B01 line, quoted by nothing, is held with the first backed part.
  assert.deepEqual(holds.map(x => [x.path, x.from, x.to]), [['parts[1]', b1.from, b1.to], ['parts[1]', is01.from, is02.to]]);
  assert.deepEqual(wire, before, 'the wire as written is not changed');
  assert.equal(B.revisionHolds(wire, ask, backing, null, 1).length, 1, 'never more than the room left');
  assert.deepEqual(B.revisionHolds(wire, ask, backing, null, 0), []);
  assert.deepEqual(B.revisionHolds(wire, ask, { backed: [], unbacked: ['P01'], units: [] }, { reviseParts: ['P01'], at: [at(ask, '|B01|')] }), [], 'an unbacked verdict holds nothing');
  assert.deepEqual(B.revisionHolds(wire, ask, { backed: ['P09'], units: [{ ref: 'P09', rows: [row(is01)] }] }).map(x => x.path), ['parts'], 'a part the wire has no entry of: no index');
});

/* ---------- review of .51: a stage that fails on the revision path is the revision's verdict, never a refusal ---------- */
const failing = (ask, how) => { const base = answers(ask, { quotes: { P01: ['저장은 결과를'], P02: ['저장은 결과를'] }, second: null });
  return c => { const r = how(c); return r === undefined ? base(c) : r; }; };
const overCap = () => { throw new ApiError('AI_RESPONSE_INCOMPLETE', 502); };
for (const [name, how, finalCalls, semanticCalls] of [
  ['a semantic render refused after its one correction', c => c.stage === 'render' && c.input.semanticReview ? { summary: '', parts: [] } : undefined, 1, 2],
  ['a semantic render cut at its output cap', c => c.stage === 'render' && c.input.semanticReview ? overCap() : undefined, 1, 1],
  ['a final review naming a part outside the plan on both passes', c => c.stage === 'global' && c.input.semanticReview ? { reviseParts: ['P77'], reason: '다시', at: [] } : undefined, 2, 1],
  ['a final review cut at its output cap', c => c.stage === 'global' && c.input.semanticReview ? overCap() : undefined, 1, 1]]) {
  test(`D51-11 ${name}: the first fragments stand under the revision as verdict and the reading applies`, async () => {
    const ask = laterAsk(), { pipeline, calls } = replayPipeline({}, failing(ask, how));
    const out = await pipeline.read(ask);
    assert.deepEqual(out.wire.parts.map(p => [p.ref, p.claims.length]), [['P01', 1], ['P02', 1]], 'every first-rendered item applies');
    const is01 = placeOf(ask, at(ask, '|IS01|')), is02 = placeOf(ask, at(ask, '|IS02|'));
    assert.deepEqual(out.exclusions.map(x => [x.path, x.category, x.from, x.to]), [['parts[0]', 'revision-held', is01.from, is02.to]], 'what the revision found missing is held');
    assert.equal(calls.filter(c => c.stage === 'global' && c.input.semanticReview).length, finalCalls);
    assert.equal(calls.filter(c => c.stage === 'render' && c.input.semanticReview).length, semanticCalls, 'one semantic render and at most its one correction');
    const reply = M.validateMapReply(structuredClone(out.wire), ask); M.attachExclusions(reply, out.exclusions, ask);
  });
}
test('D51-12 a network fault on the revision path still refuses (it is no answer of the model)', async () => {
  const ask = laterAsk(), { pipeline } = replayPipeline({}, failing(ask, c => { if (c.stage === 'render' && c.input.semanticReview) throw new ApiError('AI_NETWORK_ERROR', 502); }));
  await assert.rejects(pipeline.read(ask), e => e.code === 'AI_NETWORK_ERROR');
});
test('D51-13 a verdict on the only part with content never empties the wire: the reading applies', async () => {
  // P01 quotes one line (its IS rows go unquoted: backed); P02 is assigned but writes nothing new (an empty entry, set aside by the browser).
  const ask = laterAsk(), { pipeline, calls } = replayPipeline({}, answers(ask, { quotes: { P01: ['저장은 결과를'] } }));
  const out = await pipeline.read(ask), reply = M.validateMapReply(structuredClone(out.wire), ask); M.attachExclusions(reply, out.exclusions, ask);
  assert.deepEqual(reply.parts.map(p => p.ref), ['P01']);
  assert.ok(M.readingExclusions(reply).some(x => x.category === 'revision-held'));
  const count = calls.length; await pipeline.read(ask); assert.equal(calls.length, count, 'replayed from cache, nothing bought again');
});

/* ---------- the ledger (M2): held once, sent again once, then rejected; the next ask differs ---------- */
const meta = n => ({ id: `R_${crypto.randomUUID()}`, at: `2026-11-06T0${n}:00:00.000Z`, model: 'stub', prompt: 'm7-000000000051', hash: createHash('sha256').update(`d51-${n}-${Math.random()}`).digest('hex') });
const pageOf = () => [HEAD, table('C-PART', [['B01', '저장', '처리 · 저장', '문서를 저장한다', 'F01', '구현됨', 'F01']]),
  table('C-ISSUE', [['IS01', 'B01', '파서가 없으면 저장 전에 거부한다', '모름', 'F01']]), table('C-END', [['C-PART', '끝남', 'B01', '—', '—'], ['C-ISSUE', '끝남', 'IS01', '—', '—']])].join('\n');
/** One reading of the project's next ask: the part's C-PART row reflected, and a revision hold on the IS01 row when `hold`, or a claim on it
 * when `place`. */
function readOnce(p, n, hold, place = false) {
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA);
  if (inp.problem) return { inp, project: p };
  const ask = inp.ask, own = ask.parts[0], b01 = ask.records.flatMap(r => r.spans).find(s => s.t.includes('|B01|저장|'))?.s ?? null;
  const alias = ask.records.flatMap(r => r.spans).find(s => s.t.includes('|IS01|'))?.s;
  const claims = [...b01 ? [{ key: 's1', kind: 'describes', text: '저장은 문서를 저장한다.', at: b01, aboutAt: null, replaces: null }] : [], ...place && alias ? [{ key: 's2', kind: 'describes', text: '파서가 없으면 저장 전에 거부한다.', at: alias, aboutAt: null, replaces: null }] : []];
  const wire = { summary: '', parts: claims.length ? [{ ...empty(own.id), basis: b01 ? [b01] : [], claims }] : [], relations: [], candidates: [], gaps: [], matches: [], material: [] };
  const reply = M.validateMapReply(structuredClone(wire), ask);
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
  assert.deepEqual(r1.with, [first.project.space.areas[0].id], 'held with the part the verdict named');
  const next = M.buildMapAsk(first.project, studioView(first.project), [], undefined, M.MAP7_SCHEMA);
  assert.notEqual(JSON.stringify(next.ask), JSON.stringify(first.inp.ask), 'the next ask differs');
  assert.ok(sends(next), 'the held row goes again once');
  const second = readOnce(first.project, 2, true), r2 = rowOf(second.project);
  assert.deepEqual([r2.state, r2.reason, r2.detail], ['rejected', 'revision', 'revision-held'], 'held so again: rejected with its reason');
  const third = M.buildMapAsk(second.project, studioView(second.project), [], undefined, M.MAP7_SCHEMA);
  assert.ok(!sends(third), 'never sent a third time'); assert.equal(third.problem, 'NOTHING_NEW', 'no deadlock: nothing is left to ask');
  // Held once and then placed: the row is reflected (a later reading's item on it wins).
  const back = readOnce(first.project, 3, false, true), r3 = rowOf(back.project);
  assert.deepEqual([r3.state, r3.reason, r3.to[0]?.kind], ['reflected', null, 'claim']);
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
  assert.equal(all.missing.length, 2, 'IS01 and IS02 go unquoted');
  const backing = B.revisionBacking(verdict, parts, ask, plan, aside);
  assert.deepEqual([backing.backed, backing.unbacked, backing.units.length], [['P01'], [], 1], 'IS02 still missing backs P01 (IS01 was set aside)');
  assert.deepEqual(B.revisionBacking(verdict, parts, ask, plan, [placeOf(ask, at(ask, '|IS01|')), placeOf(ask, at(ask, '|IS02|'))]).backed, [], 'nothing missing that survived: unbacked');
});

test('D51-6 the recipes name .51 and the later containment rules later-containment.4', () => {
  assert.deepEqual([PIPELINE_RECIPE, LATER_PIPELINE_RECIPE, B.CONTAINMENT_VERSION], ['first-map-divided.54', 'later-map-divided.54', 'later-containment.4']);
});

/* ---------- the two stored refusals, replayed offline ---------- */
test('D51-F the growth fixtures are anonymised (no project or person name of the source repository)', () => {
  // sha256 of the folded source words (the repository's name, its short form and two maintainers' surnames), by length; every run of that
  // length inside a letter-only token of the fixtures is compared, so a source word joined to others is found too.
  const SOURCE = new Map([[9, ['3aabed2fdda7ceef39fbc0a23b8a586d536973e32c27f462646a1daab496832c']], [7, ['40c6a5e1bfbbae8b26530e847a82b2c7d2396ba8dba0f535b907aa8e657f6563', 'fabc5a74e8d14a054e62cb6e6fbe148bfa7d09268068bd2776ca6987832bc397']],
    [3, ['0ebc372fd12cf0359c467c5231a0a61528f2c0d10572b15b273919a2972f56f5']]]);
  const digest = w => createHash('sha256').update(w).digest('hex');
  const dir = new URL('./fixtures/growth51/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const tokens = new Set(gunzipSync(readFileSync(new URL(f, dir))).toString('utf8').toLowerCase().match(/[a-z]+/g) ?? []);
    for (const token of tokens) for (const [n, sums] of SOURCE) {
      // The three-letter short form is matched as a whole token only (any word holds three letters).
      const runs = n === 3 ? (token.length === 3 ? [token] : []) : Array.from({ length: Math.max(0, token.length - n + 1) }, (_, i) => token.slice(i, i + n));
      for (const run of runs) assert.ok(!sums.includes(digest(run)), `${f}: a source name inside 「${token.slice(0, 3)}…」`);
    }
  }
});

test('D51-R1 track A stage 3 r3: the reading now applies whole, the verdict a diagnostic its rendered steps answer, and the next ask differs', async () => {
  const fx = growthFixture('track-a'), inp = fixtureInput(fx), ask = inp.ask, calls = [];
  const { pipeline, store } = replayRefusal(fx, c => calls.push(c.stage));
  const out = await pipeline.read(ask);
  assert.deepEqual(calls, ['global'], 'only the final review is answered (the stored verdict); every other stage is the stored one');
  assert.deepEqual(fx.final.reviseParts, ['P06']);
  // Nothing lost: the wire is the fragments combined without a global rewrite, P06 included with every step it rendered.
  const plan = fx.stages.plan.value, groups = B.splitBlueprintParts(plan);
  const fragments = groups.map((_, i) => ['-semantic-correction', '-semantic', '-correction', ''].map(s => fx.stages[`render-${i + 1}${s}`]).find(Boolean).value);
  const combined = B.combineRenderedReading(fragments, emptyGlobal(), ask, plan).wire;
  assert.deepEqual(out.wire.parts, combined.parts);
  // The program backs the verdict (P06's plan items on its ConsumerError steps hold no claim or condition), but each of those rows is a step P06
  // rendered: an item stands on every one, so nothing is held (before this review, P06 and its 20 step rows were held for it).
  const diag = store.extra.get('global-final').diagnostics[0];
  assert.deepEqual([diag.rule, diag.actual], ['revision', 1]); assert.match(diag.names[0], /^확인 P06: /);
  assert.deepEqual(out.exclusions, []);
  // Applied to the state the ask was built from: no row ends held for the verdict, every row has a reason, and the next ask is not the refused one.
  const before = fixtureProject(fx);
  assert.equal(JSON.stringify(appAsk(before).ask), JSON.stringify(ask), 'the fixture state rebuilds the refused ask exactly');
  const reply = M.validateMapReply(structuredClone(out.wire), ask); M.attachExclusions(reply, out.exclusions, ask);
  const applied = M.applyReading(before, inp, reply, meta(5));
  const ledger = L.rowLedger(applied.project, X.v5Folds(applied.project.pasted));
  assert.equal([...ledger.values()].filter(x => x.reason === 'revision').length, 0);
  const steps = [...ledger.values()].filter(x => x.table === 'C-STEP' && /^B13:/.test(x.id));
  assert.ok(steps.length >= 20 && steps.every(x => x.state === 'reflected'), 'P06\'s step rows are on the map');
  for (const x of ledger.values()) assert.ok(x.state === 'reflected' ? x.reason === null : !!x.reason, `${x.table} ${x.id} has a reason`);
  const next = appAsk(applied.project);
  assert.equal(next.problem, null); assert.notEqual(JSON.stringify(next.ask), JSON.stringify(ask), 'the next ask differs: no deadlock');
  // The summary the reading did not write leaves the newest one an earlier reading wrote (never 「no description」).
  assert.equal(applied.reading.summary, '');
  assert.equal(latestMapSummary(applied.project.readings), latestMapSummary(before.readings)); assert.ok(latestMapSummary(before.readings));
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

/* ---------- M4 and M5: a second line between two parts, a bound 구현됨 row, no empty group card, files alike ---------- */
const pad2 = n => String(n).padStart(2, '0');
const REC = 'AF5-51b1b2b3', BASE = '51c0de2';
const head51 = (n, rec = REC) => `〔기록 ${rec} · 쪽 ${n} · 기준 ${BASE} · 앞 쪽 ${n > 1 ? n - 1 : '—'}〕 지도 시험 기록 v5 (시험 세션, 2026-11-06 16:0${n})`;
const partRow = (id, name, impl = '구현됨', f = 'F01') => [id, name, '처리 · 계산', `${name}의 일`, f, impl, 'F01'];
const linkRow = (id, a, b, what) => [id, a, b, what, '호출마다', '—', '같은 프로세스', '정의된 관계', 'F01'];
function page51({ names = ['수집기', '정리기'], impl = () => '구현됨', links = [['LN01', 'B01', 'B02', '원문 묶음']], groups = [], files = () => 'F01', rec = REC } = {}) {
  const parts = names.map((n, k) => partRow(`B${pad2(k + 1)}`, n, impl(k), files(k)));
  return [head51(1, rec), table('C-SRC', [['F01', 'src/collect.py', 'B01', '읽음', '코드'], ['F02', 'src/log.py', 'B02', '읽음', '코드']]), table('C-EVID', [['E01', '파일', 'F01', 'main()', '연다']]),
    table('C-HEAD', T.HEAD_ITEMS.map((item, k) => [item, `값 ${k + 1}`, 'F01'])), 'C-SUMMARY 요약\n지도 시험 서비스 (F01).', table('C-PART', parts),
    ...(links.length ? [table('C-LINK', links.map(l => linkRow(...l)))] : []), ...(groups.length ? [table('C-GROUP', groups)] : []),
    table('C-ISSUE', [['IS01', 'B01', '수집이 가끔 늦음', '모름', 'F01']]),
    table('C-END', [['C-HEAD', '끝남', '—', '—', '—'], ['C-PART', '끝남', `B01–B${pad2(names.length)}`, '—', '—'], ...(links.length ? [['C-LINK', '끝남', links.map(l => l[0]).join('·'), '—', '—']] : []), ['C-ISSUE', '끝남', 'IS01', '—', '—']]), '완료 단계: 첫 구조 완료'].join('\n');
}
const project51 = (...pages) => { let p = D.addArea({ ...D.createProject(), name: '지도 시험' }, '기존 부분', '사람이 만든 부분'); for (const t of pages) p = D.pasteRecord(p, t, null).project; return parseProject(JSON.stringify(p)); };
const paste51 = (p, t) => parseProject(JSON.stringify(D.pasteRecord(p, t, null).project));
const ask51 = p => M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA);
const atStart = (ask, words, rec) => { for (const r of ask.records) { if (rec && r.id !== rec) continue; const s = r.spans.find(x => x.t.trimStart().startsWith(words)); if (s) return s.s; } throw new Error(`no piece ${words}`); };
const newPart = (ref, name, basis, o = {}) => ({ ref, name, parent: null, role: `${name}의 일을 맡는다.`, roleAboutAt: null, roleReplaces: null, basis: [basis], claims: [], ...o });
const oldPart = (ref, o = {}) => ({ ref, name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [], claims: [], ...o });
const reply7 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const areaOf = (p, name) => p.space.areas.find(a => a.name === name && !a.archived)?.id;
const aliasOf = (inp, id) => [...inp.parts].find(([, v]) => v === id)?.[0];
let readings = 0;
const apply51 = (p, inp, wire) => M.applyReading(p, inp, M.validateMapReply(wire, inp.ask), meta(++readings % 9 + 1));
/** The first reading: both parts on their C-PART rows and the line on LN01. */
function first51(p, extra = {}) {
  const inp = ask51(p), ask = inp.ask;
  return apply51(p, inp, reply7({ parts: [newPart('new:a', '수집기', atStart(ask, '|B01|'), extra.a ?? {}), newPart('new:b', '정리기', atStart(ask, '|B02|'), extra.b ?? {})],
    relations: [{ from: 'new:a', to: 'new:b', kind: 'flow', note: '원문 묶음', at: atStart(ask, '|LN01|'), ...extra.line ?? {} }] }));
}

test('D51-7 (6b) a second relation between the same two parts on its own C-LINK row is kept under that line beside the first, never over it', () => {
  const one = first51(project51(page51()), { line: { payload: '원문 묶음', cadence: '호출마다' } }), line = one.project.space.relations[0].id;
  const p = paste51(one.project, page51({ links: [['LN01', 'B01', 'B02', '원문 묶음'], ['LN02', 'B01', 'B02', '오류 보고']] }));
  const inp = ask51(p), ask = inp.ask, a = aliasOf(inp, areaOf(p, '수집기')), b = aliasOf(inp, areaOf(p, '정리기'));
  const two = apply51(p, inp, reply7({ relations: [{ from: a, to: b, kind: 'flow', note: '오류 보고', at: atStart(ask, '|LN02|'), payload: '오류 보고', cadence: '실패할 때' }, { from: a, to: b, kind: 'flow', note: '원문 묶음', at: atStart(ask, '|LN01|') }] }));
  assert.equal(two.project.space.relations.length, 1, 'still one line per pair and kind on the map');
  assert.deepEqual(two.reading.relations.map(r => [r.relationId, r.payload, r.also]), [[line, '오류 보고', true]], 'the second relation is kept, under that line, marked as another relation');
  assert.deepEqual(two.reading.skipped, [{ what: 'relation', name: `${a}→${b}`, reason: 'exists' }], 'the line on LN01 again is the same line');
  const rows = Object.fromEntries(two.reading.rows.map(x => [x.id, x]));
  assert.deepEqual([rows.LN02.state, rows.LN02.to[0]], ['reflected', { kind: 'relation', id: line, index: null }], 'its row is reflected, never unplaced');
  // What the line hands over stays the first relation's (the other is said beside it).
  const view = studioView(two.project), ledger = buildLedger(view, two.project.readings);
  assert.ok(ledger.items.some(x => x.line.includes('원문 묶음')) && !ledger.items.some(x => x.line.includes('오류 보고')), 'the line still hands over 원문 묶음');
  assert.deepEqual(validateProject(JSON.parse(serializeProject(two.project))), JSON.parse(serializeProject(two.project)), 'the entry stores and loads');
  // A line drawn again on prose (no C-LINK row of its own) is the same line: skipped, no entry on every reading.
  const q = paste51(two.project, page51({ links: [['LN01', 'B01', 'B02', '원문 묶음'], ['LN02', 'B01', 'B02', '오류 보고']] }) + '\n수집기는 정리기에 원문을 넘긴다.');
  const inq = ask51(q), prose = atStart(inq.ask, '수집기는 정리기에');
  const three = apply51(q, inq, reply7({ relations: [{ from: aliasOf(inq, areaOf(q, '수집기')), to: aliasOf(inq, areaOf(q, '정리기')), kind: 'flow', note: '원문', at: prose }] }));
  assert.deepEqual([three.reading.relations.length, three.reading.skipped.map(x => x.reason)], [0, ['exists']]);
});

test('D51-8 (6c) a bound C-PART row that now says 구현됨 ends the part\'s 미구현 even when the record renamed it; a row still 미구현 does not', () => {
  const one = first51(project51(page51({ impl: k => k === 0 ? '미구현' : '구현됨' }))), area = areaOf(one.project, '수집기');
  assert.equal(M.partUnderstanding(one.project, area).stateRead.state, 'unbuilt');
  // The record is pasted again: B01 (bound to 수집기 by its creation) is now 「수집 서비스」 and 구현됨; the reply writes a claim on another row.
  const p = paste51(one.project, page51({ names: ['수집 서비스', '정리기'] })), inp = ask51(p), ask = inp.ask, ref = aliasOf(inp, area);
  assert.ok(ask.records.some(r => (r.partRows ?? []).some(x => x.id === 'B01' && x.part === ref)), 'the ask binds B01 to the part');
  const wire = reply7({ parts: [oldPart(ref, { claims: [{ key: 's1', kind: 'describes', text: '수집이 가끔 늦다.', at: atStart(ask, '|IS01|'), aboutAt: null, replaces: null }] })] });
  const reply = M.validateMapReply(structuredClone(wire), ask);
  assert.equal(reply.parts[0].implementation, 'built'); assert.ok(reply.parts[0].implementationQuote.quote.includes('|B01|'));
  const two = M.applyReading(p, inp, reply, meta(7));
  assert.equal(M.partUnderstanding(two.project, area).stateRead, null, 'the old 미구현 ends (built says nothing of running)');
  // A row still 미구현: nothing changes.
  const q = paste51(one.project, page51({ names: ['수집 서비스', '정리기'], impl: k => k === 0 ? '미구현' : '구현됨' })), inq = ask51(q);
  const still = M.validateMapReply(reply7({ parts: [oldPart(aliasOf(inq, area), { claims: [{ key: 's1', kind: 'describes', text: '수집이 가끔 늦다.', at: atStart(inq.ask, '|IS01|'), aboutAt: null, replaces: null }] })] }), inq.ask);
  assert.notEqual(still.parts[0].implementation, 'built');
});

test('D51-9 (6d) a group card with no member is never made; a group with a member is', () => {
  const groups = [['GR01', '사람 참여자', '—', '참여자', 'F01']], p = project51(page51({ groups })), inp = ask51(p), ask = inp.ask, gr = atStart(ask, '|GR01|');
  const made = apply51(p, inp, reply7({ parts: [newPart('new:a', '수집기', atStart(ask, '|B01|')), newPart('new:g', '사람 참여자', gr)] }));
  assert.ok(!made.project.space.areas.some(a => a.name === '사람 참여자'), 'no empty group card');
  assert.deepEqual(made.reading.skipped, [{ what: 'part', name: '사람 참여자', reason: 'empty-group' }]);
  // Its row ends with that reason (never sent again to end unplaced), and the person reads why where it stood.
  const gr01 = made.reading.rows.find(x => x.table === 'C-GROUP' && x.id === 'GR01');
  assert.deepEqual([gr01.state, gr01.reason], ['rejected', 'empty-group']);
  const why = made.reading.exclusions.filter(x => x.category === 'empty-group');
  assert.equal(why.length, 1); assert.equal(why[0].explanation, M.explainExclusion('parts', 'contract', 'empty-group'));
  assert.ok(!sendsRow(ask51(made.project), '|GR01|'), 'not sent again');
  assert.ok(made.project.space.areas.some(a => a.name === '수집기'));
  const kept = apply51(p, inp, reply7({ parts: [newPart('new:g', '사람 참여자', gr), newPart('new:a', '수집기', atStart(ask, '|B01|'), { parent: 'new:g' })] }));
  assert.ok(kept.project.space.areas.some(a => a.name === '사람 참여자'), 'a group with a member stays');
  assert.deepEqual(validateProject(JSON.parse(serializeProject(made.project))), JSON.parse(serializeProject(made.project)));
});

const sendsRow = (inp, words) => !inp.problem && inp.ask.records.some(r => r.spans.some(s => s.t.includes(words)));
const FILES2 = ['src/log.py', 'src/log_util.py'];
test('D51-10 (6a) with no C-IDENT table, a new part with the very files of a live part is an identity candidate, held and never merged', () => {
  const one = first51(project51(page51()), { b: { files: FILES2 } }), log = areaOf(one.project, '정리기');
  assert.deepEqual(M.partUnderstanding(one.project, log).files, FILES2);
  // Another record of the project names a 「로그 파일」 with those very two files, and gives the live 정리기 no row of its own there.
  const p = paste51(one.project, page51({ names: ['수집기', '로그 파일'], links: [], rec: 'AF5-51b1b2c4' })), inp = ask51(p), ask = inp.ask;
  const count = p.space.areas.length, b02 = atStart(ask, '|B02|', ask.records.find(r => r.spans.some(s => s.t.includes('AF5-51b1b2c4'))).id);
  const two = apply51(p, inp, reply7({ parts: [newPart('new:l', '로그 파일', b02, { files: ['./SRC/log.py', 'src/log_util.py'] })] }));
  assert.equal(two.project.space.areas.length, count, 'not created, and nothing merged');
  assert.deepEqual(two.reading.skipped, [{ what: 'part', name: '로그 파일', reason: 'same-files' }]);
  const [c] = two.reading.candidates;
  assert.ok(c.target === 'identity' && c.areaIds[0] === log && /담당 파일/.test(c.text), 'the person sees the candidate');
  // Other files: a part of its own.
  const three = apply51(p, inp, reply7({ parts: [newPart('new:l', '로그 파일', b02, { files: ['src/other.py'] })] }));
  assert.ok(three.project.space.areas.some(a => a.name === '로그 파일'));
});

test('D51-14 (M5) the record tells two parts of one file apart: a row of its own beside the live part\'s row, or one shared file, never holds', () => {
  // The same record gives 정리기 its B02 row and the new 「재시도 큐」 its own B03 row: two rows, two parts, though the files are the same.
  const one = first51(project51(page51()), { b: { files: FILES2 } });
  const p = paste51(one.project, page51({ names: ['수집기', '정리기', '재시도 큐'], links: [] })), inp = ask51(p), ask = inp.ask;
  const two = apply51(p, inp, reply7({ parts: [newPart('new:q', '재시도 큐', atStart(ask, '|B03|'), { files: FILES2 })] }));
  assert.ok(two.project.space.areas.some(a => a.name === '재시도 큐') && !two.reading.skipped.length, 'created: the record keeps them apart');
  // A single shared file is no evidence for a part on a row of its own (several parts of one file are common).
  const single = first51(project51(page51()), { b: { files: ['src/log.py'] } });
  const q = paste51(single.project, page51({ names: ['수집기', '재시도 큐'], links: [], rec: 'AF5-51b1b2c5' })), inq = ask51(q);
  const b02 = atStart(inq.ask, '|B02|', inq.ask.records.find(r => r.spans.some(s => s.t.includes('AF5-51b1b2c5'))).id);
  const three = apply51(q, inq, reply7({ parts: [newPart('new:q', '재시도 큐', b02, { files: ['src/log.py'] })] }));
  assert.ok(three.project.space.areas.some(a => a.name === '재시도 큐'), 'one shared file: created');
});
