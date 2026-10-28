// AF84 DELTA3: an analysis of a saved project whose map readings quote anchored passages over 300 characters. The real
// context75 micro-javascript backup (as imported) and the synthetic boundary83 long-context copy are run apart. Handwritten
// analyses citing the readings: plan/request/storage contracts only, no model and no claim about reading quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBackup } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as R from '../dist/public/shared/request-return.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as D from '../dist/public/shared/domain.js';
import { ANCHOR_QUOTE_MAX } from '../dist/public/shared/evidence-span.js';
import { projectInput, mapReply } from '../dist/public/client/plan-source.js';
import { emptyBundle, parseBundle, planFile, readPlanFile } from '../dist/public/client/plan-store.js';

const load = name => parseBackup(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')).project;
const FIXTURES = { 'context75 micro-javascript (real backup)': 'context75/micro-javascript-backup.json', 'boundary83 long-context (synthetic copy)': 'boundary83/long-context.json' };
const roundTrip = v => JSON.parse(JSON.stringify(v));

for (const [label, file] of Object.entries(FIXTURES)) test(`84 ${label}: a valid analysis keeps reading quotes over 300 whole through plan, request and storage`, () => {
  const p = load(file), view = studioView(p), inp = projectInput({ project: p, view }, '이 부분은 실패해도 다음 단계로 넘어가게 해줘');
  assert.equal(inp.problem, null);
  const long = Object.entries(inp.origins).flatMap(([ref, list]) => list.filter(o => o.quote && o.quote.length > 300).map(o => ({ ref, o })));
  assert.deepEqual(long.map(x => x.o.quote.length).sort((a, b) => a - b), [336, 336, 479, 490, 567, 567].filter(n => long.some(x => x.o.quote.length === n)).sort((a, b) => a - b));
  assert.ok(long.length >= 1 && long.every(x => x.o.quote.length <= ANCHOR_QUOTE_MAX));
  // Each long quote is the reading's own passage, as the map reading stored it.
  const claims = p.readings.flatMap(r => (r.parts ?? []).flatMap(x => [...(x.claims ?? []), ...(x.basis ?? [])]));
  for (const { o } of long) assert.ok(claims.some(c => c.quote === o.quote && c.record === o.record), 'quote carried as stored');
  const refs = [...new Set(long.map(x => x.ref))], part = inp.ask.parts[0].id;
  const analysis = mapReply({ summary: '긴 인용 근거를 그대로 쓰는 변경.', items: [
    { id: 'c1', title: '실패 후 계속', description: '한 단계가 실패해도 다음 단계로.', partIds: [part], refs: ['INTENT'], dependsOn: [] },
    { id: 'c2', title: '읽은 이해 근거', description: '긴 인용이 있는 읽은 이해를 근거로 든다.', partIds: [part], refs, dependsOn: [] }
  ], impacts: [], preserve: [], unknowns: [] }, inp);
  const plan = C.createPlan(p.id, inp.basis, inp.ask.intent, inp.evidence, analysis, inp.origins);
  for (const { ref, o } of long) assert.ok(plan.evidenceOrigins[ref].some(x => x.quote === o.quote));
  assert.deepEqual(C.parsePersistedPlan(roundTrip(plan)), plan);
  // The frozen request made from it carries the same origins, whole.
  const snap = C.requestSnapshot(plan), frozen = snap.scope.items.find(i => i.id === 'c2').sources;
  for (const { ref, o } of long) assert.ok(frozen.find(s => s.id === ref).origins.some(x => x.quote === o.quote && x.quote.length === o.quote.length));
  assert.deepEqual(R.validateFrozenRequest(roundTrip(snap.scope)), snap.scope);
  // Saved and exported with the plan: read back unchanged.
  const bundle = { ...emptyBundle(inp.ask.intent), plan, snapshots: [snap], labels: { [snap.id]: { c1: '실패 후 계속', c2: '읽은 이해 근거' } }, origins: { [snap.id]: 'reviewed' } };
  assert.deepEqual(parseBundle(roundTrip(bundle), p.id), bundle);
  assert.deepEqual(readPlanFile(planFile(bundle, p), p.id), bundle);
  // A later map reading of a new report can take that request (the stored reading keeps it whole; its wire carries no sources).
  const later = D.pasteRecord(p, '보고: 실패한 단계 뒤에도 다음 단계를 실행하도록 바꿨습니다.', null).project;
  const mapInput = M.buildMapAsk(later, studioView(later), [snap.scope], undefined, M.MAP6_SCHEMA);
  assert.equal(mapInput.problem ?? null, null); M.validateMapAsk(mapInput.ask);
  assert.deepEqual(mapInput.fullRequests, [snap.scope]); assert.equal(mapInput.ask.requests[0].id, snap.id);
  assert.ok(!JSON.stringify(mapInput.ask).includes(long[0].o.quote));
});

test('84 origin quote limit is the anchored passage limit: 600 kept, 601 refused; other origin rules and the copied 300 unchanged', () => {
  const origin = (quote, record = 'N01', reading = 'R_1') => ({ record, reading, quote });
  R.validateOrigins([origin('가'.repeat(ANCHOR_QUOTE_MAX))]);
  assert.equal(ANCHOR_QUOTE_MAX, 600);
  for (const bad of [[origin('가'.repeat(601))], [origin('가', null)], [origin(' ')], [{ ...origin('가'), extra: 1 }], Array.from({ length: 17 }, () => origin('가')), [origin('가', 'N 01')]])
    assert.throws(() => R.validateOrigins(bad));
  R.validateOrigins([{ record: null, reading: 'R_1', quote: null }, { record: 'N01', reading: null, quote: null }]);
  // A copied (non-anchored) request match keeps its 300; only an anchored one goes to 600, as before.
  const scope = [{ id: 'RQ_1', items: [{ id: 'I1' }] }];
  const match = quote => ({ record: 'N01', quote, text: '보고', kind: 'reported', about: null, targets: [{ requestId: 'RQ_1', itemId: 'I1' }], why: '대응', stance: 'made', replaces: null });
  R.validateRequestMatch(match('가'.repeat(300)), scope, true);
  assert.throws(() => R.validateRequestMatch(match('가'.repeat(301)), scope, true));
  R.validateRequestMatch(match('가'.repeat(600)), scope, true, ANCHOR_QUOTE_MAX);
  assert.throws(() => R.validateRequestMatch(match('가'.repeat(601)), scope, true, ANCHOR_QUOTE_MAX));
});
