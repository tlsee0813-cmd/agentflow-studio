// AF85 zero change: an analysis that proposes no change, on the real micro-javascript backup (a stored reading of public OSS
// excerpts, as imported; the OSS itself was not run). The reply below is written by the reviewer, not by a model, and no provider is
// called: the server tests use a stubbed fetch. Not real model effect and not browser evidence (the PC screen is checked separately).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseBackup } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import { validatePlanAsk, validatePlanReply, allowsNoChange } from '../dist/public/shared/plan-api.js';
import { parsePlanAnalysis, createPlan, selectItems, requestSnapshot, compareResults, parsePersistedPlan } from '../dist/public/shared/change-plan.js';
import { pinOnEdit, screenContext } from '../dist/public/shared/authoring-context.js';
import { projectInput, mapReply } from '../dist/public/client/plan-source.js';
import { emptyBundle, loadBundle, saveBundle, planFile, readPlanFile, parseBundle, PLANS_KEY } from '../dist/public/client/plan-store.js';
import { PLAN_PROMPT, PLAN2_PROMPT, PLAN3_PROMPT } from '../server/plan-prompt.mjs';
import { createStudioHandler } from '../server/studio.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
const RAW = readFileSync(new URL('./fixtures/context75/micro-javascript-backup.json', import.meta.url), 'utf8');
const PROJECT_ID = 'P_6a74a281-f0dd-4dd8-8e00-d5b013112326', PIPE = 'A_49bad1f8-971b-4bff-8030-a62d8a470c16';
const SENTENCE = '이 부분에서 메모리 제한과 시간 제한으로 끝난 이유를 호출자가 구별해 설명할 수 있게 하고 싶다. 기존 eval 실행 순서와 전역 객체 공유 동작은 유지한다.';
const kv = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), m }; };

function micro() {
  assert.equal(sha(RAW), 'aaffb3764afc68f054d05ff54f4e2b5bf72b5b0abfc259d0bfc1deda666f8065');
  const { project } = parseBackup(RAW), view = studioView(project);
  // The draft written on the pipeline (selection and the scope being looked at); the project's own id, never the screen's E_ entry.
  const authoring = pinOnEdit({ state: 'open' }, SENTENCE, () => screenContext(project.id, view.parts, { selected: PIPE, scope: PIPE }, 'first-edit'));
  return { project, view, inp: projectInput({ project, view }, SENTENCE, [], authoring) };
}
/** Reviewer-written (not a model reply): the docstring already names both errors; what callers are told is not in the material. */
const EMPTY = {
  summary: '제공된 eval docstring(N01)은 메모리 초과에 MemoryLimitError, 시간 초과에 TimeLimitError를 이미 구별해 명명한다. 호출자가 두 경우를 어떻게 안내받는지는 제공된 자료로 확인되지 않음.',
  items: [], impacts: [],
  preserve: ['eval의 parse→compile→VM 실행 순서', '전역 객체를 복사하지 않고 공유하는 동작'],
  unknowns: ['두 예외의 구체 메시지와 생성자: 제공된 자료로 확인되지 않음', '호출자 쪽 안내·처리: 제공된 자료로 확인되지 않음']
};
const positive = (part = 'P06') => ({ summary: '두 예외 이름을 재사용해 호출자 안내를 더한다.', items: [{ id: 'c1', title: '제한 종류별 안내', description: '두 예외를 구별해 호출자에게 알린다.', partIds: [part], refs: ['INTENT', 'N01'], dependsOn: [] }],
  impacts: [{ partId: 'P04', reason: '같은 제한을 다룬다.', refs: ['N01'] }], preserve: [], unknowns: [] });

test('85 contract: items=[] reads only with impacts=[]; every real item/impact keeps its id, ref and part checks', () => {
  const parts = ['P1'], refs = ['E1'];
  assert.deepEqual(parsePlanAnalysis({ summary: 's', items: [], impacts: [], preserve: [], unknowns: [] }, parts, refs).items, []);
  const bad = [
    a => { a.impacts = [{ partId: 'P1', reason: 'r', refs: ['E1'] }]; }, // no grounds-only impact without a change
    a => { delete a.unknowns; }, a => { a.outcome = 'none'; }, a => { a.items = null; },
    a => { a.items = [{ id: 'x', title: 't', description: 'd', partIds: ['P1'], refs: ['missing'], dependsOn: [] }]; },
    a => { a.items = [{ id: 'x', title: 't', description: 'd', partIds: ['P9'], refs: ['E1'], dependsOn: [] }]; },
    a => { a.items = [{ id: 'x', title: 't', description: 'd', partIds: ['P1'], refs: [], dependsOn: [] }]; }
  ];
  for (const mutate of bad) { const a = { summary: 's', items: [], impacts: [], preserve: [], unknowns: [] }; mutate(a); assert.throws(() => parsePlanAnalysis(a, parts, refs)); }
});

test('85 request versions: only studio.plan.3 may be answered with no change; .1/.2 still need an item; .3 keeps the five keys', () => {
  const { inp } = micro();
  assert.equal(inp.ask.schemaVersion, 'studio.plan.3'); validatePlanAsk(inp.ask); assert.ok(allowsNoChange(inp.ask));
  const v2 = { ...inp.ask, schemaVersion: 'studio.plan.2' }, v1 = { schemaVersion: 'studio.plan.1', intent: inp.ask.intent, parts: inp.ask.parts, evidence: inp.ask.evidence };
  for (const old of [v1, v2]) { validatePlanAsk(old); assert.throws(() => validatePlanReply(structuredClone(EMPTY), old)); assert.equal(validatePlanReply(positive(), old).items.length, 1); }
  assert.deepEqual(validatePlanReply(structuredClone(EMPTY), inp.ask), EMPTY);
  assert.throws(() => mapReply(structuredClone(EMPTY), { ...inp, ask: v2 }), 'a .2 request never reads as an empty plan in the app either');
  // studio.plan.3 is the studio.plan.2 request: authoring required and checked, nothing else added.
  const { authoring, ...four } = inp.ask;
  assert.throws(() => validatePlanAsk({ ...four, schemaVersion: 'studio.plan.3' }));
  assert.throws(() => validatePlanAsk({ ...inp.ask, outcome: 'none' }));
  assert.throws(() => validatePlanAsk({ ...inp.ask, authoring: { ...authoring, selection: { ...authoring.selection, partId: 'P99' } } }));
});

test('85 prompts: .1/.2 byte for byte as before; .3 adds the neutral zero rule and drops the 2–6 count', () => {
  assert.equal(sha(PLAN_PROMPT), '9b856ef85e59ab1b9fb80f66cf1c8c8a3507f5300f025225fc427df0cd5aec81');
  assert.equal(sha(PLAN2_PROMPT), 'c7c0228a981491f2e6a8703cea5466c2b524f78dcaa14e829510ea800d179e87');
  assert.ok(PLAN2_PROMPT.includes('items는 보통 2~6개') && !PLAN3_PROMPT.includes('보통 2~6'));
  for (const rule of ["'이번 분석에서 제안된 변경 없음'", '변경이 필요 없다고 검증됐다거나 목표가 이미 이루어졌다는 뜻이 아니다', '그때 impacts도 []다', '미확인을 item으로 올리거나', '0~32개'])
    assert.ok(PLAN3_PROMPT.includes(rule), rule);
  const at = PLAN2_PROMPT.indexOf('\n정확히 다음 JSON 키만 반환한다(');
  assert.ok(PLAN3_PROMPT.startsWith(PLAN2_PROMPT.slice(0, at)), 'the authoring rule and everything before it unchanged');
  assert.ok(!PLAN3_PROMPT.includes('outcome'));
});

test('85 server: .3 goes to the same plan route with its own prompt and the same budget; an empty reply is refused for .1/.2', async () => {
  const { inp } = micro(), sent = []; let answer = EMPTY;
  const handler = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'zero85-server-only-key' }, fetchImpl: async (url, init) => {
    sent.push(JSON.parse(init.body)); return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }] });
  } });
  const post = body => handler(new Request('https://app.test/api/studio/plan', { method: 'POST', headers: { Origin: 'https://app.test', 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' }, body: JSON.stringify(body) }));
  const r3 = await post(inp.ask); assert.equal(r3.status, 200); assert.deepEqual((await r3.json()).reply, EMPTY);
  assert.equal(sent[0].messages[0].content, PLAN3_PROMPT);
  assert.deepEqual([sent[0].max_tokens, sent[0].thinking, sent[0].reasoning_effort], [8192, { type: 'enabled' }, 'low']);
  const v2 = { ...inp.ask, schemaVersion: 'studio.plan.2' }, v1 = { schemaVersion: 'studio.plan.1', intent: inp.ask.intent, parts: inp.ask.parts, evidence: inp.ask.evidence };
  for (const [ask, prompt] of [[v2, PLAN2_PROMPT], [v1, PLAN_PROMPT]]) {
    const r = await post(ask); assert.equal(r.status, 502); assert.equal((await r.json()).error.code, 'INVALID_RESPONSE');
    assert.equal(sent.at(-1).messages[0].content, prompt);
  }
  answer = positive(); assert.equal((await post(inp.ask)).status, 200); assert.equal((await post(v2)).status, 200);
  assert.equal(sent.length, 5, 'one provider call per request: no retry'); assert.ok(!JSON.stringify(sent).includes('zero85-server-only-key'));
});

test('85 real micro material: the reviewer-written empty reply becomes a plan with nothing to request; the request material stays as sent', () => {
  const { project, view, inp } = micro();
  assert.equal(project.id, PROJECT_ID); assert.equal(inp.problem, null);
  assert.equal(inp.ask.parts.length, 6); assert.equal(inp.ask.evidence.length, 9);
  assert.equal(inp.parts.get(inp.ask.authoring.selection.partId), PIPE); assert.equal(inp.parts.get(inp.ask.authoring.scope.partId), PIPE);
  assert.equal(view.parts.find(p => p.id === PIPE).name, '평가 실행 파이프라인');
  const analysis = mapReply(structuredClone(EMPTY), inp), plan = createPlan(project.id, inp.basis, inp.ask.intent, inp.evidence, analysis, inp.origins);
  assert.deepEqual(plan.selected, []); assert.deepEqual(plan.analysis, EMPTY);
  assert.deepEqual(plan.evidence.map(e => e.id), ['INTENT', 'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'N01', 'N02']);
  assert.equal(plan.evidence.find(e => e.id === 'N01').text, inp.ask.evidence.find(e => e.id === 'N01').text, 'source text kept as it was sent');
  assert.throws(() => requestSnapshot(plan)); assert.throws(() => selectItems(plan, ['c1']));
  assert.deepEqual(selectItems(plan, []), plan, 'nothing to choose; no revision');
  assert.deepEqual(parsePersistedPlan(structuredClone(plan)), plan);
});

test('85 storage: an empty analysis saves, reloads and round-trips as a .3 file; older versions never carried one', () => {
  const { project, inp } = micro();
  const plan = createPlan(project.id, inp.basis, inp.ask.intent, inp.evidence, mapReply(structuredClone(EMPTY), inp), inp.origins);
  // No authoring key, so the same bundle can also stand for what a .1/.2 writer could have kept.
  const bundle = { ...emptyBundle(SENTENCE), plan, by: { kind: 'ai', model: 'stub-model', at: plan.createdAt, records: inp.records } };
  delete bundle.authoring;
  const store = kv(); assert.equal(saveBundle(store, project.id, bundle), null);
  const loaded = loadBundle(store, project.id); assert.equal(loaded.unreadable, false); assert.deepEqual(loaded.bundle, bundle);
  const file = planFile(bundle, project); assert.equal(JSON.parse(file).format, 'agentflow.change-plan-file.3');
  assert.deepEqual(readPlanFile(file, project.id), bundle);
  // .1/.2 writers never kept an empty analysis: such an entry is not what they wrote (refused, raw kept); their positive ones still read.
  const legacyEmpty = JSON.stringify({ version: 'studio.plans.2', projects: { [project.id]: bundle } }), old = kv({ [PLANS_KEY]: legacyEmpty });
  assert.equal(loadBundle(old, project.id).unreadable, true); assert.equal(old.m.get(PLANS_KEY), legacyEmpty);
  assert.equal(typeof readPlanFile(JSON.stringify({ ...JSON.parse(file), format: 'agentflow.change-plan-file.2' }), project.id), 'string');
  const pos = createPlan(project.id, inp.basis, inp.ask.intent, inp.evidence, mapReply(positive(), inp), inp.origins), posBundle = { ...bundle, plan: pos };
  assert.deepEqual(loadBundle(kv({ [PLANS_KEY]: JSON.stringify({ version: 'studio.plans.2', projects: { [project.id]: posBundle } }) }), project.id).bundle, posBundle);
  assert.deepEqual(readPlanFile(JSON.stringify({ ...JSON.parse(planFile(posBundle, project)), format: 'agentflow.change-plan-file.2' }), project.id), posBundle);
  assert.throws(() => parseBundle(posBundle, 'P_other'));
});

test('85 an empty re-analysis after a request: earlier request text, labels, origins and returns stay as made; no new request', () => {
  const { project, inp } = micro();
  const first = createPlan(project.id, inp.basis, inp.ask.intent, inp.evidence, mapReply(positive(), inp), inp.origins);
  const snap = requestSnapshot(first, { summary: '두 예외 이름을 재사용한다.', prerequisites: [], unknowns: [] });
  const obs = { id: 'O_1', itemId: 'c1', kind: 'report', text: '보고 원문', basis: '작업 보고', refs: [] };
  let bundle = { ...emptyBundle(SENTENCE), plan: first, by: { kind: 'ai', model: 'stub-model', at: first.createdAt, records: inp.records },
    snapshots: [snap], labels: { [snap.id]: { c1: '제한 종류별 안내' } }, origins: { [snap.id]: 'reviewed' }, observations: [obs], attached: { O_1: snap.id } };
  delete bundle.authoring;
  const frozen = structuredClone({ snapshots: bundle.snapshots, labels: bundle.labels, origins: bundle.origins, observations: bundle.observations, attached: bundle.attached });
  // What analyze() does with a reply: a new plan from this request, the bundle's requests and returns untouched.
  const next = createPlan(project.id, inp.basis, inp.ask.intent, inp.evidence, mapReply(structuredClone(EMPTY), inp), inp.origins);
  bundle = { ...bundle, plan: next };
  const store = kv(); assert.equal(saveBundle(store, project.id, bundle), null);
  const back = loadBundle(store, project.id).bundle;
  assert.deepEqual({ snapshots: back.snapshots, labels: back.labels, origins: back.origins, observations: back.observations, attached: back.attached }, frozen);
  assert.equal(back.snapshots[0].text, snap.text); assert.deepEqual(back.snapshots[0].scope, snap.scope);
  assert.ok(back.snapshots[0].text.includes('제한 종류별 안내') && back.snapshots[0].text.includes('[N01]'));
  assert.equal(compareResults(back.snapshots[0], back.observations)[0].reported.length, 1);
  assert.deepEqual(back.plan.selected, []); assert.throws(() => requestSnapshot(back.plan));
  assert.notEqual(back.plan.id, snap.planId, 'the empty plan is not rebuilt from the earlier request, nor the other way round');
});
