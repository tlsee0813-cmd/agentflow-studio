// Written replies and HTTP model stubs: contract/storage/regression evidence, not real AI quality or browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as R from '../dist/public/shared/request-return.js';
import { studioView } from '../dist/public/shared/studio.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { emptyBundle, parseBundle, planFile, readPlanFile, loadBundle, PLANS_KEY } from '../dist/public/client/plan-store.js';
import { projectInput } from '../dist/public/client/plan-source.js';
import { createMapRun } from '../dist/public/client/map-run.js';
import { aiStatus } from '../dist/public/client/studio-api.js';
import { displayAbout, frozenRequests } from '../dist/public/client/request-results.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { MAP2_PROMPT, MAP3_PROMPT } from '../server/map-prompt.mjs';

let counter = 0;
const meta = () => ({ id: `R_t${++counter}`, at: new Date().toISOString(), model: 'stub', prompt: 'm2-000000000000', hash: String(counter).padStart(64, '0') });
const reply = matches => ({ summary: '폴더 입력의 부분 보고를 요청과 대조했어요.', parts: [], relations: [], candidates: [], gaps: [], matches });
const snapshotAt = (plan, at) => { const q = C.requestSnapshot(plan); q.createdAt = at; q.scope.createdAt = at; return q; };
function setup(report = 'feature/folder@abc1234: 폴더 안 파일을 받는 입력을 바꿨습니다. 단일 문서 검사 3개 통과. 실패 후 계속은 아직 확인하지 않았습니다.') {
  let p = D.addArea(D.createProject(), '문서 변환', '단일 문서를 변환한다.');
  const area = p.space.areas[0].id, evidence = [{ id: 'INTENT', kind: 'user', title: '원함', text: '폴더 입력, 실패 후 계속, 성공 유지와 실패 모음을 원합니다.', basis: '사용자 초안' }];
  const analysis = { summary: '폴더 변환', items: [
    { id: 'I1', title: '폴더 입력', description: '폴더 안 문서를 입력받는다.', partIds: [area], refs: ['INTENT'], dependsOn: [] },
    { id: 'I2', title: '실패 후 계속', description: '한 문서가 실패해도 나머지는 계속한다.', partIds: [area], refs: ['INTENT'], dependsOn: [] },
    { id: 'I3', title: '성공 유지·실패 모음', description: '성공 결과는 유지하고 실패를 모아 본다.', partIds: [area], refs: ['INTENT'], dependsOn: [] }
  ], impacts: [], preserve: ['기존 문서의 내용 보존'], unknowns: [] };
  const plan = C.createPlan(p.id, '기존 단일 문서 기준', evidence[0].text, evidence, analysis), snap = C.requestSnapshot(plan);
  p = D.pasteRecord(p, report, area).project;
  const bundle = { ...emptyBundle(), plan, snapshots: [snap], labels: { [snap.id]: Object.fromEntries(analysis.items.map(i => [i.id, i.title])) }, origins: { [snap.id]: 'reviewed' } };
  return { p, area, plan, snap, bundle };
}
// studio.map.3 matches: a change report says made unless told otherwise; anything else is unclear. No withdrawal by default.
const match = (q, opts = {}) => { const m = { record: 'N01', quote: '폴더 안 파일을 받는 입력을 바꿨습니다', text: '폴더 입력 변경 보고', kind: 'reported', about: 'feature/folder@abc1234', targets: [{ requestId: q.id, itemId: 'I1' }], why: '폴더 입력 요구와 받은 입력 변경 보고가 대응함', ...opts };
  return { stance: ['reported', 'code'].includes(m.kind) ? 'made' : 'unclear', replaces: null, ...m }; };
const input = (p, scopes) => M.buildMapAsk(p, studioView(p), scopes);
const apply = (p, inp, raw) => M.applyReading(p, inp, M.validateMapReply(raw, inp.ask), meta());

test('71 normal loop: one read saves frozen request + partial correspondence with exact origins, no automatic sidecar observations or fake returns', () => {
  const { p, snap, bundle } = setup(), before = JSON.stringify(bundle), inp = input(p, [snap.scope]);
  assert.equal(inp.ask.schemaVersion, 'studio.map.3'); M.validateMapAsk(inp.ask);
  const done = apply(p, inp, reply([match(snap), match(snap, { kind: 'checked', quote: '단일 문서 검사 3개 통과', text: '단일 문서 검사만 통과했다고 보고함' })]));
  assert.equal(done.reading.version, 'map-reading.3'); assert.deepEqual(done.reading.requests, [snap.scope]);
  const got = R.requestMatches(done.project); assert.equal(got.length, 2); assert.ok(got.every(x => x.target.itemId === 'I1'));
  assert.deepEqual(snap.scope.items.filter(i => !got.some(x => x.target.itemId === i.id)).map(i => i.id), ['I2', 'I3']);
  const source = p.pasted[0]; for (const x of got) { assert.equal(x.match.record, source.id); assert.equal(source.text.slice(x.match.from, x.match.to), x.match.quote); }
  assert.equal(JSON.stringify(bundle), before); assert.deepEqual(done.project.tasks, []); assert.deepEqual(done.project.sources, []);
  assert.equal(done.project.space.areas[0].note, p.space.areas[0].note);
  assert.equal(got[0].match.about, 'feature/folder@abc1234'); assert.deepEqual(parseProject(JSON.stringify(done.project)), done.project);
  snap.scope.items[0].title = '나중 변경'; assert.notEqual(done.reading.requests[0].items[0].title, snap.scope.items[0].title);
});

test('71 source-bound contracts reject fabricated ids, omitted quotes, borrowed scope, pasted code/test promotion, and unquoted branch', () => {
  const { p, snap } = setup(), inp = input(p, [snap.scope]);
  for (const m of [
    match(snap, { targets: [{ requestId: snap.id, itemId: 'unknown' }] }), match(snap, { record: 'N02' }),
    match(snap, { quote: '폴더 전체 변환을 확인했습니다' }), match(snap, { about: 'main' }),
    match(snap, { kind: 'code' }), match(snap, { kind: 'test' })
  ]) assert.throws(() => M.validateMapReply(reply([m]), inp.ask), /INVALID_RESPONSE/);
  assert.throws(() => M.validateMapAsk({ ...inp.ask, requests: [{ ...snap.scope, extra: true }] }));
  const done = apply(p, inp, reply([match(snap)]));
  for (const mutate of [x => x.readings[0].matches[0].to++, x => x.readings[0].requests[0].projectId = 'other', x => x.readings[0].matches[0].targets[0].itemId = 'bad', x => x.readings[0].matches[0].about = 'main', x => x.readings[0].matches[0].kind = 'test']) {
    const bad = structuredClone(done.project); mutate(bad); assert.throws(() => parseProject(JSON.stringify(bad)));
  }
});

test('71 two indistinguishable RQs stay ambiguous even if a model selects only the latest; explicit RQ and human correction can distinguish them', () => {
  const { p, snap, plan } = setup(), newer = snapshotAt(plan, snap.createdAt), inp = input(p, [snap.scope, newer.scope]);
  const validated = M.validateMapReply(reply([match(newer)]), inp.ask);
  assert.equal(validated.matches[0].targets.length, 2);
  let done = M.applyReading(p, inp, validated, meta()).project;
  let read = R.requestMatches(done)[0]; assert.equal(read.target, null); assert.equal(read.excluded, false);
  done = R.correctRequestMatch(done, read.reading, read.index, { requestId: snap.id, itemId: 'I1' });
  done = parseProject(JSON.stringify(done)); read = R.requestMatches(done)[0];
  assert.equal(read.target.requestId, snap.id); assert.equal(read.corrected, true);
  const named = D.pasteRecord(D.createProject(), `报告 ${snap.id}: 폴더 안 파일을 받는 입력을 바꿨습니다. feature/folder@abc1234`, null).project;
  // Keep the same project identity for the real request manifest in this synthetic input.
  named.id = p.id;
  const explicit = input(named, [snap.scope, newer.scope]);
  assert.equal(M.validateMapReply(reply([match(snap)]), explicit.ask).matches[0].targets.length, 1);
});

test('71 frozen RQ and manual corrections survive a changed demand, late report, another read and role correction; no role replacement by matching', () => {
  let { p, snap, plan, area } = setup();
  // Ground one role with the existing map contract first.
  let inp = M.buildMapAsk(p, studioView(p));
  p = M.applyReading(p, inp, M.validateMapReply({ summary: '', parts: [{ ref: 'P01', name: null, parent: null, role: '단일 문서를 변환함', roleAbout: null, roleReplaces: null, basis: [{ record: 'N01', quote: '폴더 안 파일을 받는 입력을 바꿨습니다' }], claims: [] }], relations: [], candidates: [], gaps: [] }, inp.ask), meta()).project;
  p = D.correctReadingRole(p, area, '사용자가 고친 현재 책임');
  p = D.pasteRecord(p, '늦게 받은 feature/folder@abc1234: 폴더 안 파일을 받는 입력을 바꿨습니다.', area).project;
  inp = input(p, [snap.scope]);
  const changed = C.revisePlan(plan, { ...plan.analysis, items: [{ ...plan.analysis.items[0], title: '새 요구', description: '전혀 다른 결과를 원함' }] });
  const nextRQ = C.requestSnapshot(changed);
  p = apply(p, inp, reply([match(snap)])).project;
  const got = R.requestMatches(p)[0]; p = R.correctRequestMatch(p, got.reading, got.index, null);
  assert.equal(R.requestMatches(p)[0].excluded, true); assert.equal(M.partUnderstanding(p, area).role, '사용자가 고친 현재 책임');
  assert.equal(p.readings.find(r => r.id === got.reading).requests[0].items[0].title, '폴더 입력');
  assert.notEqual(nextRQ.id, snap.id);
  // Re-reading the exact interval cannot undo the exclusion.
  const repeat = { ...inp, after: p.readings.filter(r => r.version.startsWith('map-reading.')).at(-1).id };
  p = apply(p, repeat, reply([match(snap)])).project;
  assert.equal(R.requestMatches(p)[0].excluded, true); parseProject(JSON.stringify(p));
});

test('71 migration: project9 unchanged readings, legacy sidecar text/manual observations; new snapshot scope stays frozen and exports round-trip', () => {
  const { p, snap, bundle } = setup();
  const v9 = { ...p, schemaVersion: 'idea015.project.9' }; assert.equal(parseProject(JSON.stringify(v9)).schemaVersion, 'idea015.project.13');
  // The legacy fixture is the bundle as earlier versions wrote it: its original nine keys, no authoring context (AF84).
  const legacy = structuredClone(bundle); delete legacy.snapshots[0].scope; delete legacy.authoring;
  legacy.observations.push({ id: 'O_legacy', itemId: 'I1', kind: 'report', text: '이전 수동 보고', basis: '직접 붙임', refs: [] }); legacy.attached.O_legacy = snap.id;
  assert.deepEqual(parseBundle(legacy, p.id), legacy);
  const raw = JSON.stringify({ version: 'studio.plans.1', projects: { [p.id]: legacy } });
  const loaded = loadBundle({ getItem: key => key === PLANS_KEY ? raw : null }, p.id); assert.equal(loaded.unreadable, false); assert.equal(loaded.bundle.snapshots[0].scope, undefined);
  assert.deepEqual(readPlanFile(planFile(bundle, p), p.id), bundle);
  const oldfile = JSON.parse(planFile(legacy, p)); oldfile.format = 'agentflow.change-plan-file.1'; assert.deepEqual(readPlanFile(JSON.stringify(oldfile), p.id), legacy);
  assert.equal(frozenRequests(p, [snap.scope])[0].id, snap.id);
});

test('71 long report: requests share the byte budget; unseen tail cannot support an item; too many RQs are never silently reduced to latest', () => {
  const { p, snap } = setup('처음 보고 구간입니다.\n' + '긴 원문 기록입니다.\n'.repeat(3000) + '꼬리에서만 검사 성공을 말합니다.');
  const inp = input(p, [snap.scope]); assert.equal(inp.ask.schemaVersion, 'studio.map.3'); assert.equal(inp.coverage.partial, 1); assert.ok(new TextEncoder().encode(JSON.stringify(inp.ask)).length <= M.MAP_BYTES);
  assert.throws(() => M.validateMapReply(reply([match(snap, { quote: '꼬리에서만 검사 성공을 말합니다', about: null })]), inp.ask), /INVALID_RESPONSE/);
  const many = Array.from({ length: 9 }, (_, i) => ({ ...snap.scope, id: `RQ_${i}` }));
  const crowded = input(p, many); assert.equal(crowded.problem, 'REQUEST_CONTEXT_TOO_LARGE'); assert.equal(crowded.requestCoverage.sent, 0); assert.equal(crowded.ask.requests, undefined);
  assert.throws(() => M.applyReading(p, crowded, { summary: '', parts: [], relations: [], candidates: [], gaps: [] }, meta()), /REQUEST_CONTEXT_TOO_LARGE/);
  assert.equal(p.readings.length, 0); assert.equal(M.unreadRecords(p, studioView(p)).length, 1);
  const selected = M.buildMapAsk(p, studioView(p), many, many[3].id); assert.equal(selected.problem, null); assert.equal(selected.ask.requests[0].id, many[3].id);
});

test('71 compact six-item/two-RQ contexts do not duplicate sources; full origins remain exactly frozen in the single reading', () => {
  const { p, area, plan } = setup(), record = p.pasted[0];
  const origins = { INTENT: Array.from({ length: 16 }, () => ({ record: record.id, reading: null, quote: record.text })) };
  const analysis = { ...plan.analysis, items: Array.from({ length: 6 }, (_, n) => ({ ...plan.analysis.items[n % 3], id: `I${n + 1}`, title: `요구 ${n + 1}`, description: `이 항목 ${n + 1}의 결과를 요청함`, partIds: [area] })) };
  const six = C.createPlan(p.id, plan.basis, plan.intent, plan.evidence, analysis, origins), first = C.requestSnapshot(six), second = C.requestSnapshot(six);
  const full = [first.scope, second.scope], before = JSON.stringify(full), inp = input(p, full);
  assert.ok(Buffer.byteLength(before) > 18000); assert.equal(inp.problem, null); assert.equal(inp.ask.requests.length, 2);
  assert.ok(Buffer.byteLength(JSON.stringify(inp.ask.requests)) < Buffer.byteLength(before) / 3);
  assert.ok(inp.ask.requests.every(q => q.items.every(i => !Object.hasOwn(i, 'sources'))));
  M.validateMapAsk(inp.ask);
  const done = apply(p, inp, reply([]));
  assert.equal(JSON.stringify(done.reading.requests), before); assert.equal(JSON.stringify(full), before);
  assert.ok(done.reading.requests.every(q => q.items.every(i => i.sources[0].origins.length === 16)));
});

test('71 explicit recompare recovers map-only material, keeps a correction on its original RQ, and leaves a conflicting new proposal undecided', () => {
  let { p, snap, plan } = setup();
  // A prior version consumed this report as a map-only read: the explicit RQ comparison still recovers it.
  const mapOnly = M.buildMapAsk(p, studioView(p));
  p = M.applyReading(p, mapOnly, M.validateMapReply({ summary: '', parts: [], relations: [], candidates: [], gaps: [] }, mapOnly.ask), meta()).project;
  assert.equal(M.buildMapAsk(p, studioView(p), [snap.scope]).problem, 'NOTHING_NEW');
  const next = snapshotAt(plan, snap.createdAt), both = [snap.scope, next.scope];
  let inp = M.buildMapAsk(p, studioView(p), both, snap.id);
  assert.equal(inp.problem, null); p = apply(p, inp, reply([match(snap)])).project;
  let old = R.requestMatches(p)[0]; p = R.correctRequestMatch(p, old.reading, old.index, { requestId: snap.id, itemId: 'I1' });
  inp = M.buildMapAsk(p, studioView(p), both, next.id); assert.equal(inp.problem, null);
  p = apply(p, inp, reply([match(next)])).project;
  const results = R.requestMatches(p), kept = results.find(x => x.reading === old.reading), fresh = results.find(x => x.reading !== old.reading);
  assert.equal(kept.corrected, true); assert.equal(kept.target.requestId, snap.id);
  assert.equal(fresh.target, null); assert.equal(fresh.corrected, false); assert.equal(fresh.prior.target.requestId, snap.id);
  assert.ok(fresh.requests.every(q => q.id === next.id)); parseProject(JSON.stringify(p));
  assert.equal(M.buildMapAsk(p, studioView(p), both, next.id).problem, 'NOTHING_NEW');
  // Choosing a comparison is not proof that a report explicitly naming RQ1 fulfils RQ2.
  const named = D.pasteRecord(p, `요청문 참조: ${snap.id}\nfeature/folder@abc1234: 폴더 안 파일을 받는 입력을 바꿨습니다.`, null).project;
  const narrowed = M.buildMapAsk(named, studioView(named), both, next.id);
  assert.throws(() => M.validateMapReply(reply([match(next)]), narrowed.ask), /INVALID_RESPONSE/);
  assert.deepEqual(M.validateMapReply(reply([match(next, { targets: [], why: '원문이 다른 요청문을 명시함' })]), narrowed.ask).matches[0].targets, []);
});

test('71 copied request carries its own real RQ and plan revision while legacy text stays untouched', () => {
  const { p, snap, plan, bundle } = setup();
  assert.ok(snap.text.includes(`요청문 참조: ${snap.id}`)); assert.ok(snap.text.includes(`변경안 판본: ${plan.id} / ${plan.revision}`));
  assert.ok(snap.text.includes(`결과에 이 요청문 참조 ${snap.id}를 함께 남겨 주세요`));
  const legacy = structuredClone(bundle); delete legacy.snapshots[0].scope; legacy.snapshots[0].text = '이전 복사 요청문 원문';
  assert.equal(parseBundle(legacy, p.id).snapshots[0].text, '이전 복사 요청문 원문');
});

test('71 pre-request material is labelled as earlier context and cannot be promoted to a later RQ return, even through recovery or a legacy wire ask', () => {
  const { p, snap, plan } = setup();
  const later = snapshotAt(plan, new Date(Date.parse(p.pasted[0].at) + 1000).toISOString());
  const inp = M.buildMapAsk(p, studioView(p), [later.scope], later.id);
  assert.equal(inp.problem, null); assert.equal(inp.ask.records[0].addedAt, p.pasted[0].at);
  assert.match(inp.ask.records[0].note, /요청문 생성 전에 붙인 이전 자료/);
  assert.throws(() => M.validateMapReply(reply([match(later)]), inp.ask), /INVALID_RESPONSE/);
  const legacyWire = structuredClone(inp.ask); delete legacyWire.records[0].addedAt;
  const superficiallyValid = M.validateMapReply(reply([match(later)]), legacyWire);
  assert.throws(() => M.applyReading(p, { ...inp, ask: legacyWire }, superficiallyValid, meta()), /INVALID_RESPONSE/);
  // The text is still legitimate evidence of the existing map, just not evidence of a return to this later request.
  const existing = { ref: 'P01', name: null, parent: null, role: '기존 입력 처리', roleAbout: null, roleReplaces: null, basis: [{ record: 'N01', quote: '폴더 안 파일을 받는 입력을 바꿨습니다' }], claims: [] };
  const done = apply(p, inp, { ...reply([match(later, { targets: [], why: '요청 생성 전에 보관한 자료' })]), parts: [existing] });
  assert.equal(M.partUnderstanding(done.project, p.space.areas[0].id).role, '기존 입력 처리');
  assert.equal(R.requestMatches(done.project)[0].target, null); assert.equal(done.project.pasted[0].text, p.pasted[0].text);
  // A report explicitly naming the original RQ cannot be forced onto a selected later RQ that omits that reference.
  const named = D.pasteRecord(p, `요청문 참조: ${snap.id}\nfeature/folder@abc1234: 폴더 안 파일을 받는 입력을 바꿨습니다.`, null).project;
  const selected = M.buildMapAsk(named, studioView(named), [later.scope], later.id);
  assert.throws(() => M.validateMapReply(reply([match(later)]), selected.ask), /INVALID_RESPONSE/);
});

test('71 comparison replay adds only matches for already-read intervals; fresh map evidence in a new record still applies', () => {
  let { p, snap, area } = setup(); p = D.addArea(p, '결과');
  const inputQuote = '폴더 안 파일을 받는 입력을 바꿨습니다', checkQuote = '단일 문서 검사 3개 통과';
  const part = (role, claims = []) => ({ ref: 'P01', name: null, parent: null, role, roleAbout: null, roleReplaces: null, basis: role ? [{ record: 'N01', quote: inputQuote }] : [], claims });
  const claim = text => ({ kind: 'reported', text, record: 'N01', quote: inputQuote, about: null, replaces: null });
  const mapOnly = M.buildMapAsk(p, studioView(p));
  p = M.applyReading(p, mapOnly, M.validateMapReply({ summary: '', parts: [part('기존 입력 역할', [claim('처음 받은 입력 보고')])], relations: [], candidates: [], gaps: [] }, mapOnly.ask), meta()).project;
  const before = JSON.stringify(p.space), beforeRole = M.partUnderstanding(p, area), inp = M.buildMapAsk(p, studioView(p), [snap.scope], snap.id);
  const oldReply = { ...reply([match(snap)]), parts: [part('재해석한 오래된 역할', [claim('재해석한 이전 입력 보고')]),
    { ref: 'new:replay', name: '재독으로 만든 별도 부분', parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [{ record: 'N01', quote: inputQuote }], claims: [] }],
    relations: [{ from: 'P01', to: 'P02', kind: 'needs', note: '같은 구절의 재해석', record: 'N01', quote: checkQuote }] };
  const done = apply(p, inp, oldReply); p = done.project;
  assert.equal(JSON.stringify(p.space), before); assert.deepEqual(done.reading.parts, []); assert.deepEqual(done.reading.relations, []); assert.deepEqual(done.created, []);
  assert.deepEqual(M.partUnderstanding(p, area), beforeRole); assert.equal(R.requestMatches(p).length, 1);
  assert.match(done.reading.summary, /이미 지도에 읽은 원문/);
  p = D.pasteRecord(p, '새 보고: 입력 규칙을 새 원문에서 덧붙였습니다.', null).project;
  const fresh = M.buildMapAsk(p, studioView(p), [snap.scope], snap.id);
  const newClaim = { kind: 'reported', text: '새 입력 규칙의 추가 보고', record: 'N01', quote: '입력 규칙을 새 원문에서 덧붙였습니다', about: null, replaces: null };
  p = apply(p, fresh, { ...reply([]), parts: [{ ...part(null), claims: [newClaim] }] }).project;
  assert.ok(M.partUnderstanding(p, area).claims.some(c => c.text === newClaim.text));
});

test('71 request-only replay of a long record does not consume the canonical effects of its unread tail', () => {
  let { p, snap } = setup('앞부분 입력 설명입니다.\n' + 'x'.repeat(13000) + '\n꼬리에서는 출력 규칙을 추가했습니다.');
  let inp = M.buildMapAsk(p, studioView(p));
  p = M.applyReading(p, inp, M.validateMapReply({ summary: '', parts: [], relations: [], candidates: [], gaps: [] }, inp.ask), meta()).project;
  inp = M.buildMapAsk(p, studioView(p), [snap.scope], snap.id);
  const replay = apply(p, inp, reply([])); p = replay.project; assert.deepEqual(replay.reading.parts, []);
  inp = M.buildMapAsk(p, studioView(p), [snap.scope], snap.id);
  assert.ok(inp.ask.records[0].text.includes('꼬리에서는 출력 규칙을 추가했습니다'));
  const role = { ref: 'P01', name: null, parent: null, role: '출력 규칙도 다룸', roleAbout: null, roleReplaces: null, basis: [{ record: 'N01', quote: '꼬리에서는 출력 규칙을 추가했습니다' }], claims: [] };
  const done = apply(p, inp, { ...reply([]), parts: [role] }); assert.equal(done.reading.parts[0].role, role.role);
});

test('71 an explicit map-only action unblocks an unrelated note past the RQ limit and still permits later selected comparison', async () => {
  const { p, snap } = setup(), many = Array.from({ length: 9 }, (_, i) => ({ ...snap.scope, id: `RQ_limit_${i}` }));
  const savedFetch = globalThis.fetch; let project = p, calls = [], committed = 0;
  globalThis.fetch = async (_url, options) => { const ask = JSON.parse(options.body); calls.push(ask); return new Response(JSON.stringify({ model: 'stub', reply: { summary: '설계 메모를 지도에서 읽음', parts: [], relations: [], candidates: [], gaps: [], ...(ask.schemaVersion !== 'studio.map.1' ? { matches: [] } : {}) } })); };
  try {
    const run = createMapRun({ current: () => ({ key: 'map-only-entry', kind: 'saved', project, view: studioView(project) }), requests: () => many,
      status: () => ({ ai: 'deepseek', access: 'open', map: { model: 'stub', prompt: awaitlessPrompt } }), accessCode: () => '',
      commit: async next => { project = next; committed++; return null; }, done: () => {}, changed: () => {} });
    await run.run(); assert.equal(calls.length, 0); assert.equal(committed, 0); assert.match(run.state().error, /읽지 않았어요/);
    await run.runMapOnly(); assert.equal(calls.length, 1); assert.equal(calls[0].schemaVersion, 'studio.map.1'); assert.equal(committed, 1);
    assert.equal(project.pasted[0].text, p.pasted[0].text); assert.equal(M.unreadRecords(project, studioView(project)).length, 0);
    await run.run(many[3].id); assert.equal(calls.length, 2); assert.equal(calls[1].schemaVersion, 'studio.map.3'); assert.deepEqual(calls[1].requests.map(q => q.id), [many[3].id]);
    assert.equal(project.readings.at(-1).requests[0].id, many[3].id);
  } finally { globalThis.fetch = savedFetch; }
});

test('71 return passages keep model order inside each reading and newer reading groups stay first', () => {
  let { p, snap } = setup('feature/folder@abc1234: 폴더 안 파일을 받는 입력을 바꿨습니다. main에는 병합하지 않았습니다. 단일 문서 검사 3개 통과.');
  const inp = input(p, [snap.scope]);
  const first = apply(p, inp, reply([match(snap), match(snap, { text: 'main에는 병합하지 않았다고 보고함', quote: 'main에는 병합하지 않았습니다' }),
    match(snap, { text: '단일 문서 검사 보고', kind: 'checked', quote: '단일 문서 검사 3개 통과' })])); p = first.project;
  assert.deepEqual(R.requestMatches(p).map(x => x.index), [0, 1, 2]);
  p = D.pasteRecord(p, 'feature/folder@abc1234 추가 보고: 폴더 안 파일을 받는 입력을 바꿨습니다.', null).project;
  const later = apply(p, input(p, [snap.scope]), reply([match(snap, { text: '더 나중의 입력 보고' })]));
  const order = R.requestMatches(later.project); assert.equal(order[0].reading, later.reading.id);
  assert.deepEqual(order.filter(x => x.reading === first.reading.id).map(x => x.index), [0, 1, 2]);
});

test('71/73 map.3 HTTP uses one combined prompt, an older tab\'s map.2 still gets its own; runner failed commit applies neither map nor correspondence', async () => {
  const { p, snap } = setup(), inp = input(p, [snap.scope]), raw = reply([match(snap)]);
  let calls = 0, sent;
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'not-a-real-test-api-key', DEEPSEEK_PLAN_MODEL: 'stub' }, fetchImpl: async (_url, init) => {
    calls++; sent = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(raw) } }] }), { status: 200 });
  } });
  const response = await handle(new Request('https://studio.example/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1', origin: 'https://studio.example' }, body: JSON.stringify(inp.ask) }));
  assert.equal(response.status, 200); assert.equal(calls, 1); assert.equal(sent.messages[0].content, MAP3_PROMPT);
  assert.equal((await response.json()).reply.matches.length, 1);
  // A tab built before studio.map.3 sends map.2 (no priors, matches without stance): answered as before, never as map.3.
  const { priors: _priors, ...old } = inp.ask, oldRaw = reply([(({ stance: _s, replaces: _r, ...m }) => m)(match(snap))]);
  const oldHandle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'not-a-real-test-api-key', DEEPSEEK_PLAN_MODEL: 'stub' }, fetchImpl: async (_url, init) => {
    sent = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(oldRaw) } }] }), { status: 200 }); } });
  const oldResponse = await oldHandle(new Request('https://studio.example/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1', origin: 'https://studio.example' }, body: JSON.stringify({ ...old, schemaVersion: 'studio.map.2' }) }));
  assert.equal(oldResponse.status, 200); assert.equal(sent.messages[0].content, MAP2_PROMPT); assert.equal(Object.hasOwn((await oldResponse.json()).reply.matches[0], 'stance'), false);
  // A map.2 ask cannot carry priors, and a map.3 ask needs them (an empty list is fine).
  for (const body of [{ ...inp.ask, schemaVersion: 'studio.map.2' }, old]) {
    const bad = await oldHandle(new Request('https://studio.example/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1', origin: 'https://studio.example' }, body: JSON.stringify(body) }));
    assert.equal(bad.status, 400);
  }
  const oldFetch = globalThis.fetch; let project = p, fails = true, doneCount = 0;
  globalThis.fetch = async () => new Response(JSON.stringify({ model: 'stub', reply: raw }), { status: 200 });
  try {
    const run = createMapRun({ current: () => ({ key: 'ENTRY1', kind: 'saved', project, view: studioView(project) }), requests: () => [snap.scope],
      status: () => ({ ai: 'deepseek', access: 'open', map: { model: 'stub', prompt: awaitlessPrompt } }), accessCode: () => '',
      commit: async next => { if (fails) return '저장 실패'; project = next; return null; }, done: () => doneCount++, changed: () => {} });
    await run.run(); assert.equal(project, p); assert.equal(project.readings.length, 0); assert.equal(doneCount, 0); assert.match(run.state().error, /저장 실패/);
    fails = false; await run.run(); assert.equal(project.readings.length, 1); assert.equal(R.requestMatches(project).length, 1); assert.equal(doneCount, 1);
  } finally { globalThis.fetch = oldFetch; }
});
const awaitlessPrompt = 'm3-000000000000';

test('71/73/74/76 actual server status stays usable through aiStatus for m6, retains m1–m5 compatibility, and rejects unknown prompt contracts', async () => {
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-status-not-real', DEEPSEEK_PLAN_MODEL: 'stub-model' }, fetchImpl: async () => { throw new Error('status must never call the model'); } });
  const serverStatus = await (await handle(new Request('https://studio.example/api/studio/status'))).json();
  assert.equal(serverStatus.map.prompt, await mapPromptId()); assert.match(serverStatus.map.prompt, /^m6-/);
  const oldFetch = globalThis.fetch;
  try {
    // The real handler's status response, through the actual client parser used by the UI.
    globalThis.fetch = async (_url, options) => { assert.equal(options.credentials, 'same-origin'); return handle(new Request('https://studio.example/api/studio/status')); };
    const status = await aiStatus(); assert.deepEqual(status.map, serverStatus.map);
    const { p } = setup();
    const run = createMapRun({ current: () => ({ key: 'status-entry', kind: 'saved', project: p, view: studioView(p) }), status: () => status, accessCode: () => '', commit: async () => null, done: () => {}, changed: () => {} });
    assert.equal(run.can(), true, 'the map action remains available after reading the real status contract');
    for (const prompt of ['m1-0123456789ab', 'm2-0123456789ab', 'm3-0123456789ab', 'm4-0123456789ab', 'm5-0123456789ab', 'm6-0123456789ab']) {
      globalThis.fetch = async () => new Response(JSON.stringify({ ...serverStatus, map: { ...serverStatus.map, prompt } }));
      assert.equal((await aiStatus()).map.prompt, prompt);
    }
    for (const prompt of ['m7-0123456789ab', 'm3-bad', 'm4-0123456789ab-extra', 'm6-0123456789ab-extra']) {
      globalThis.fetch = async () => new Response(JSON.stringify({ ...serverStatus, map: { ...serverStatus.map, prompt } }));
      assert.equal((await aiStatus()).map, null);
    }
  } finally { globalThis.fetch = oldFetch; }
});

test('71 display abbreviates only full SHA, while origins, branch and conditions remain full', () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';
  assert.equal(displayAbout(sha), sha.slice(0, 8)); assert.equal(displayAbout('feature/folder'), 'feature/folder'); assert.equal(displayAbout(`main@${sha}`), `main@${sha}`);
});
