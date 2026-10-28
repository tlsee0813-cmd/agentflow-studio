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
import { displayAbout, frozenRequests } from '../dist/public/client/request-results.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { MAP2_PROMPT } from '../server/map-prompt.mjs';

let counter = 0;
const meta = () => ({ id: `R_t${++counter}`, at: new Date().toISOString(), model: 'stub', prompt: 'm2-000000000000', hash: String(counter).padStart(64, '0') });
const reply = matches => ({ summary: '폴더 입력의 부분 보고를 요청과 대조했어요.', parts: [], relations: [], candidates: [], gaps: [], matches });
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
const match = (q, opts = {}) => ({ record: 'N01', quote: '폴더 안 파일을 받는 입력을 바꿨습니다', text: '폴더 입력 변경 보고', kind: 'reported', about: 'feature/folder@abc1234', targets: [{ requestId: q.id, itemId: 'I1' }], why: '폴더 입력 요구와 받은 입력 변경 보고가 대응함', ...opts });
const input = (p, scopes) => M.buildMapAsk(p, studioView(p), scopes);
const apply = (p, inp, raw) => M.applyReading(p, inp, M.validateMapReply(raw, inp.ask), meta());

test('71 normal loop: one read saves frozen request + partial correspondence with exact origins, no automatic sidecar observations or fake returns', () => {
  const { p, snap, bundle } = setup(), before = JSON.stringify(bundle), inp = input(p, [snap.scope]);
  assert.equal(inp.ask.schemaVersion, 'studio.map.2'); M.validateMapAsk(inp.ask);
  const done = apply(p, inp, reply([match(snap), match(snap, { kind: 'checked', quote: '단일 문서 검사 3개 통과', text: '단일 문서 검사만 통과했다고 보고함' })]));
  assert.equal(done.reading.version, 'map-reading.2'); assert.deepEqual(done.reading.requests, [snap.scope]);
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
  const { p, snap, plan } = setup(), newer = C.requestSnapshot(plan), inp = input(p, [snap.scope, newer.scope]);
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
  const v9 = { ...p, schemaVersion: 'idea015.project.9' }; assert.equal(parseProject(JSON.stringify(v9)).schemaVersion, 'idea015.project.10');
  const legacy = structuredClone(bundle); delete legacy.snapshots[0].scope;
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
  const inp = input(p, [snap.scope]); assert.equal(inp.ask.schemaVersion, 'studio.map.2'); assert.equal(inp.coverage.partial, 1); assert.ok(new TextEncoder().encode(JSON.stringify(inp.ask)).length <= M.MAP_BYTES);
  assert.throws(() => M.validateMapReply(reply([match(snap, { quote: '꼬리에서만 검사 성공을 말합니다', about: null })]), inp.ask), /INVALID_RESPONSE/);
  const many = Array.from({ length: 9 }, (_, i) => ({ ...snap.scope, id: `RQ_${i}` }));
  const crowded = input(p, many); assert.equal(crowded.requestCoverage.sent, 0); assert.equal(crowded.ask.requests, undefined);
});

test('71 map.2 HTTP uses one combined prompt and rejects invented matching; runner failed commit applies neither map nor correspondence', async () => {
  const { p, snap } = setup(), inp = input(p, [snap.scope]), raw = reply([match(snap)]);
  let calls = 0, sent;
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'not-a-real-test-api-key', DEEPSEEK_PLAN_MODEL: 'stub' }, fetchImpl: async (_url, init) => {
    calls++; sent = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(raw) } }] }), { status: 200 });
  } });
  const response = await handle(new Request('https://studio.example/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1', origin: 'https://studio.example' }, body: JSON.stringify(inp.ask) }));
  assert.equal(response.status, 200); assert.equal(calls, 1); assert.equal(sent.messages[0].content, MAP2_PROMPT);
  assert.equal((await response.json()).reply.matches.length, 1);
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
const awaitlessPrompt = 'm2-000000000000';

test('71 display abbreviates only full SHA, while origins, branch and conditions remain full', () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';
  assert.equal(displayAbout(sha), sha.slice(0, 8)); assert.equal(displayAbout('feature/folder'), 'feature/folder'); assert.equal(displayAbout(`main@${sha}`), `main@${sha}`);
});
