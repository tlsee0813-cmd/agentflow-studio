// AF84 authoring context: request/storage/staleness contracts with written inputs and a stubbed provider. Not real model effect
// and not browser evidence (the PC screen is checked separately).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import { studioView } from '../dist/public/shared/studio.js';
import { validatePlanAsk, validatePlanReply, PLAN_BYTES } from '../dist/public/shared/plan-api.js';
import { pinOnEdit, screenContext, authoringAsk, authoringStale, resolveRef, legacyRecord, AUTHORING_VERSION } from '../dist/public/shared/authoring-context.js';
import { projectInput, exampleInput, buildConverterProject, converterKeys } from '../dist/public/client/plan-source.js';
import { emptyBundle, parseBundle, planFile, readPlanFile, loadBundle, saveBundle, authoringOf, PLANS_KEY } from '../dist/public/client/plan-store.js';
import * as C from '../dist/public/shared/change-plan.js';
import { converterExampleAnalysis } from '../dist/public/shared/change-plan-example.js';
import { PLAN_PROMPT, PLAN2_PROMPT } from '../server/plan-prompt.mjs';
import { createStudioHandler } from '../server/studio.mjs';

const SENTENCE = '이 부분은 실패해도 계속 진행했으면 좋겠어';
function project() {
  let p = D.addArea(D.createProject(), '입력', '파일을 받는다.');
  const input = p.space.areas[0].id;
  p = D.addArea(p, '출력', '결과를 쓴다.'); const output = p.space.areas[1].id;
  p = D.addChildArea(p, input, '파일 목록', '받은 파일을 나열한다.'); const list = p.space.areas[2].id;
  return { p, input, output, list };
}
const open = (p, screen, how = 'first-edit') => pinOnEdit({ state: 'open' }, SENTENCE, () => screenContext(p.id, studioView(p).parts, screen, how));
const kv = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), m }; };
const reply = (part, ref = 'INTENT') => ({ summary: '실패 후 계속을 살펴본다.', items: [{ id: 'c1', title: '실패 후 계속', description: '한 파일이 실패해도 나머지를 계속한다.', partIds: [part], refs: [ref], dependsOn: [] }], impacts: [], preserve: [], unknowns: [] });

test('84 same "이 부분" sentence on two real parts: different kept/sent context, every part sent, real ids kept, aliases only in the request', () => {
  const { p, input, output, list } = project(), view = studioView(p);
  const atInput = open(p, { selected: input, scope: null }), atList = open(p, { selected: list, scope: input });
  const a = projectInput({ project: p, view }, SENTENCE, [], atInput), b = projectInput({ project: p, view }, SENTENCE, [], atList);
  for (const x of [a, b]) { assert.equal(x.problem, null); assert.equal(x.ask.schemaVersion, 'studio.plan.2'); validatePlanAsk(x.ask); }
  // Whole parts, same sources: the context never filters the map and never enters INTENT/evidence.
  assert.equal(a.ask.parts.length, view.parts.length); assert.deepEqual(a.ask.parts, b.ask.parts); assert.deepEqual(a.ask.evidence, b.ask.evidence);
  assert.equal(a.ask.evidence.find(e => e.id === 'INTENT').text, SENTENCE);
  assert.ok(!JSON.stringify(a.ask.evidence).includes('작성 맥락') && !JSON.stringify(a.ask.evidence).includes('파일 목록 ·'));
  // Different context per real part; the request names them by its own aliases, which map back to the real ids.
  assert.notDeepEqual(a.ask.authoring, b.ask.authoring);
  assert.equal(a.parts.get(a.ask.authoring.selection.partId), input); assert.equal(a.ask.authoring.scope, null);
  assert.equal(b.parts.get(b.ask.authoring.selection.partId), list);
  assert.equal(b.parts.get(b.ask.authoring.scope.partId), input, 'scope=self keeps the real scope id under this request alias');
  assert.deepEqual(b.ask.authoring.selection, { partId: b.ask.authoring.selection.partId, nameThen: '파일 목록', status: 'same' });
  // What is kept with the plan is the stable id, never the request's alias.
  assert.equal(b.analyzed.authoring.context.selection.id, list); assert.equal(b.analyzed.authoring.context.scope.id, input);
  assert.ok(!/"P\d\d"/.test(JSON.stringify(b.analyzed)));
  // A sentence naming another part or the whole map: the request still carries every part and adds no limit.
  const other = projectInput({ project: p, view }, '입력 말고 출력 전체를 바꾸고 싶어', [], atInput);
  assert.deepEqual(other.ask.parts.map(x => other.parts.get(x.id)), view.parts.map(x => x.id)); assert.ok(other.parts.has(other.ask.parts.find(x => other.parts.get(x.id) === output).id));
  // The reply is checked against every part, not only the context's part.
  const outAlias = [...other.parts].find(([, id]) => id === output)[0];
  assert.equal(validatePlanReply(reply(outAlias), other.ask).items[0].partIds[0], outAlias);
});

test('84 first edit pins once; emptying, navigating, removal and older drafts never re-take a context', () => {
  const { p, input, output } = project(), parts = studioView(p).parts;
  let taken = 0; const take = screen => () => { taken++; return screenContext(p.id, parts, screen, 'first-edit'); };
  assert.deepEqual(pinOnEdit({ state: 'open' }, '', take({ selected: input, scope: null })), { state: 'open' });
  const set = pinOnEdit({ state: 'open' }, '이', take({ selected: input, scope: null }));
  assert.equal(set.state, 'set'); assert.equal(set.context.how, 'first-edit'); assert.equal(set.context.selection.id, input); assert.equal(taken, 1);
  for (const text of ['이 부분', '', '다시 씀']) assert.equal(pinOnEdit(set, text, take({ selected: output, scope: input })), set);
  const removed = { state: 'removed', at: new Date().toISOString() };
  assert.equal(pinOnEdit(removed, '맥락 없이 계속 씀', take({ selected: output, scope: null })), removed);
  assert.equal(pinOnEdit({ state: 'unrecorded' }, '예전 초안 고침', take({ selected: output, scope: null })).state, 'unrecorded');
  assert.equal(taken, 1, 'only the first edit of a new draft reads the screen');
  // A draft written without any context is sent as such, not as an empty selection.
  const none = projectInput({ project: p, view: studioView(p) }, SENTENCE, [], removed);
  assert.deepEqual(none.ask.authoring, { state: 'none' }); validatePlanAsk(none.ask);
  assert.deepEqual(projectInput({ project: p, view: studioView(p) }, SENTENCE, [], { state: 'unrecorded' }).ask.authoring, { state: 'unrecorded' });
  assert.equal(screenContext(p.id, parts, { selected: null, scope: null }, 'explicit').selection, null);
});

test('84 identity: rename shows the change; removal, a same-named new part, another project and a copied file never reconnect', () => {
  const { p, input } = project();
  const ctx = open(p, { selected: input, scope: input });
  // Renamed: same id, the name then is kept and the request says it was renamed.
  const renamed = D.editArea(p, input, '파일 입력', '파일을 받는다.');
  let x = projectInput({ project: renamed, view: studioView(renamed) }, SENTENCE, [], ctx);
  assert.equal(x.ask.authoring.selection.status, 'renamed'); assert.equal(x.ask.authoring.selection.nameThen, '입력'); assert.equal(x.parts.get(x.ask.authoring.selection.partId), input);
  validatePlanAsk(x.ask); assert.equal(authoringStale({ version: AUTHORING_VERSION, draft: ctx, analyzed: x.analyzed }, renamed.id, studioView(renamed).parts), null);
  // Removed, then a new part with the same name: unresolved, never the new part.
  let gone = D.setAreaArchived(D.setAreaArchived(p, p.space.areas[2].id, true), input, true); gone = D.addArea(gone, '입력', '새로 만든 다른 입력');
  const twin = gone.space.areas.at(-1).id; assert.notEqual(twin, input);
  x = projectInput({ project: gone, view: studioView(gone) }, SENTENCE, [], ctx);
  assert.deepEqual(x.ask.authoring.selection, { partId: null, nameThen: '입력', status: 'unresolved' });
  assert.deepEqual(x.ask.authoring.scope, { partId: null, nameThen: '입력', status: 'unresolved' });
  assert.deepEqual(x.analyzed.missing, ['selection', 'scope']); validatePlanAsk(x.ask);
  assert.ok(!Object.values(x.ask.authoring).some(r => r && x.parts.get(r.partId) === twin));
  // A context of another project, even with an id that exists here, is unresolved.
  const foreign = { state: 'set', context: { ...ctx.context, projectId: 'PRJ_other' } };
  assert.equal(resolveRef(foreign.context.selection, p.id, foreign.context.projectId, studioView(p).parts).status, 'unresolved');
  assert.equal(projectInput({ project: p, view: studioView(p) }, SENTENCE, [], foreign).ask.authoring.selection.partId, null);
  // A plan file is read only into its own project; its kept ids are resolved there, never by name.
  const bundle = { ...emptyBundle(SENTENCE), authoring: { version: AUTHORING_VERSION, draft: ctx, analyzed: null } };
  assert.match(readPlanFile(planFile(bundle, p), 'PRJ_other'), /다른 프로젝트/);
  assert.deepEqual(readPlanFile(planFile(bundle, p), p.id), bundle);
});

test('84 analysis keeps the context it sent: change, removal, re-take and a part gone; late replies read as the earlier basis', () => {
  const { p, input, output, list } = project(), view = studioView(p), ctx = open(p, { selected: input, scope: null });
  const sent = projectInput({ project: p, view }, SENTENCE, [], ctx).analyzed;
  const rec = draft => ({ version: AUTHORING_VERSION, draft, analyzed: sent });
  assert.equal(authoringStale(rec(ctx), p.id, view.parts), null, 'moving around the map changes nothing');
  // Removed or replaced while (or after) the analysis was in flight: the plan made from that request is the earlier basis.
  const removed = { state: 'removed', at: new Date().toISOString() };
  assert.equal(authoringStale(rec(removed), p.id, view.parts), 'context');
  assert.equal(pinOnEdit(removed, `${SENTENCE} 더`, () => assert.fail('a removed context is not re-taken')), removed);
  const toOutput = { state: 'set', context: screenContext(p.id, view.parts, { selected: output, scope: null }, 'explicit') };
  assert.equal(authoringStale(rec(toOutput), p.id, view.parts), 'context');
  // Taking the same screen again (another time, explicit) is the same basis, as writing the earlier sentence back is.
  const again = { state: 'set', context: screenContext(p.id, view.parts, { selected: input, scope: null }, 'explicit', '2030-01-01T00:00:00.000Z') };
  assert.equal(authoringStale(rec(again), p.id, view.parts), null);
  // A part the analysis could name is gone now: stale. One already unresolved when sent stays as it was read.
  const archived = D.setAreaArchived(D.setAreaArchived(p, list, true), input, true);
  assert.equal(authoringStale(rec(ctx), p.id, studioView(archived).parts), 'missing');
  const knownGone = projectInput({ project: archived, view: studioView(archived) }, SENTENCE, [], ctx).analyzed;
  assert.equal(authoringStale({ version: AUTHORING_VERSION, draft: ctx, analyzed: knownGone }, p.id, studioView(archived).parts), null);
  // An older draft and plan: unrecorded on both sides is current; a context set on it makes the older plan the earlier basis.
  assert.equal(authoringStale(legacyRecord(true), p.id, view.parts), null);
  assert.equal(authoringStale({ ...legacyRecord(true), draft: again }, p.id, view.parts), 'context');
  assert.equal(authoringStale({ ...legacyRecord(false), draft: again }, p.id, view.parts), null, 'no plan, nothing to be behind');
});

test('84 storage: older bundles/envelopes/files read losslessly and stay unrecorded; new ones carry an explicit version', () => {
  const { p, input } = project(), ctx = open(p, { selected: input, scope: null });
  const analysis = reply(input), plan = C.createPlan(p.id, '기준', SENTENCE, [{ id: 'INTENT', kind: 'user', title: '구상', text: SENTENCE, basis: '초안' }], analysis);
  const legacy = { ...emptyBundle(SENTENCE), plan }; delete legacy.authoring;
  assert.deepEqual(parseBundle(legacy, p.id), legacy); assert.equal(Object.hasOwn(parseBundle(legacy, p.id), 'authoring'), false);
  assert.deepEqual(authoringOf(legacy), legacyRecord(true)); assert.equal(authoringOf(legacy).draft.state, 'unrecorded');
  const otherRaw = { draft: '다른 프로젝트 초안', extra: [], plan: null, by: null, snapshots: [], labels: {}, origins: {}, observations: [], attached: {} };
  const store = kv({ [PLANS_KEY]: JSON.stringify({ version: 'studio.plans.2', projects: { [p.id]: legacy, PRJ_other: otherRaw } }) });
  const loaded = loadBundle(store, p.id); assert.equal(loaded.unreadable, false); assert.deepEqual(loaded.bundle, legacy);
  const next = { ...legacy, authoring: { version: AUTHORING_VERSION, draft: ctx, analyzed: { authoring: { state: 'unrecorded' }, missing: [] } } };
  assert.equal(saveBundle(store, p.id, next), null);
  const env = JSON.parse(store.m.get(PLANS_KEY)); assert.equal(env.version, 'studio.plans.3');
  assert.deepEqual(env.projects.PRJ_other, otherRaw, 'another project\'s older entry is written back as it was');
  assert.deepEqual(loadBundle(store, p.id).bundle, next);
  const file = JSON.parse(planFile(next, p)); assert.equal(file.format, 'agentflow.change-plan-file.3');
  assert.deepEqual(readPlanFile(JSON.stringify(file), p.id), next);
  for (const format of ['agentflow.change-plan-file.1', 'agentflow.change-plan-file.2']) {
    assert.deepEqual(readPlanFile(JSON.stringify({ ...JSON.parse(planFile(legacy, p)), format }), p.id), legacy);
    assert.equal(typeof readPlanFile(JSON.stringify({ ...file, format }), p.id), 'string', 'an older file version never claims a context');
  }
  // Exact stored keys only; an unreadable bundle is reported, never repaired.
  const broken = [
    b => { b.authoring.extra = 1; }, b => { b.authoring.version = 'authoring-context.0'; }, b => { b.authoring.draft.context.how = 'guessed'; },
    b => { b.authoring.draft.context.selection.alias = 'P01'; }, b => { b.authoring.draft.context.selection.id = 'P 01'; },
    b => { b.authoring.analyzed.missing = ['selection', 'selection']; }, b => { b.plan = null; },
    b => { b.authoring.draft = { state: 'removed' }; }, b => { b.authoring.draft = { state: 'open', at: 'x' }; }
  ];
  for (const breakIt of broken) { const b = structuredClone(next); breakIt(b); assert.throws(() => parseBundle(b, p.id)); }
  for (const version of ['studio.plans.1', 'studio.plans.2']) assert.equal(loadBundle(kv({ [PLANS_KEY]: JSON.stringify({ version, projects: { [p.id]: next } }) }), p.id).unreadable, true, 'an older envelope never claims a context');
  assert.equal(loadBundle(kv({ [PLANS_KEY]: JSON.stringify({ version: 'studio.plans.3', projects: { [p.id]: { ...next, authoring: { version: AUTHORING_VERSION } } } }) }), p.id).unreadable, true);
  assert.deepEqual(emptyBundle().authoring, { version: AUTHORING_VERSION, draft: { state: 'open' }, analyzed: null });
});

test('84 request contract: studio.plan.1 four keys still accepted; studio.plan.2 authoring checked against its own parts and size', () => {
  const { p, input } = project(), view = studioView(p), ctx = open(p, { selected: input, scope: null });
  const v2 = projectInput({ project: p, view }, SENTENCE, [], ctx).ask;
  const v1 = { schemaVersion: 'studio.plan.1', intent: v2.intent, parts: v2.parts, evidence: v2.evidence };
  assert.deepEqual(validatePlanAsk(v1), v1);
  const bad = [
    a => { a.schemaVersion = 'studio.plan.1'; }, a => { delete a.authoring; }, a => { a.authoring.selection.partId = 'P99'; },
    a => { a.authoring.selection.status = 'renamed'; }, a => { a.authoring.selection.nameThen = '다른 이름'; },
    a => { a.authoring.selection = { partId: a.authoring.selection.partId, nameThen: '입력', status: 'unresolved' }; },
    a => { a.authoring.selection.realId = input; }, a => { a.authoring.state = 'guessed'; }, a => { a.authoring = { state: 'none', selection: null }; },
    a => { a.authoring.selection.nameThen = '가'.repeat(201); }, a => { a.authoring.scope = { partId: null, nameThen: ' ', status: 'unresolved' }; }
  ];
  for (const mutate of bad) { const a = structuredClone(v2); mutate(a); assert.throws(() => validatePlanAsk(a)); }
  // The byte limit counts the authoring field too; nothing is cut silently.
  const big = structuredClone(v2); big.evidence[0].text = '가'.repeat(11000);
  for (let i = 0; i < 2; i++) big.evidence.push({ ...big.evidence[0], id: `X${i}` });
  big.authoring.selection = { partId: null, nameThen: '나'.repeat(200), status: 'unresolved' };
  assert.ok(new TextEncoder().encode(JSON.stringify(big)).length > PLAN_BYTES);
  assert.throws(() => validatePlanAsk(big), /INPUT_TOO_LARGE/);
  // A key-like name kept in the context is not sent.
  const keyed = D.editArea(p, input, 'sk-abcdefghijklmnopqrstuvwxyz0123456789', '');
  const sneaky = open(keyed, { selected: input, scope: null });
  assert.deepEqual(projectInput({ project: p, view }, SENTENCE, [], sneaky).problem, { secret: '작성 맥락' });
  // Example: the context names the example's own keys, as its parts do.
  const ex = buildConverterProject(), keys = converterKeys(ex), [key, real] = [...keys][1];
  const exCtx = pinOnEdit({ state: 'open' }, SENTENCE, () => screenContext(ex.id, studioView(ex).parts, { selected: real, scope: null }, 'first-edit'));
  const exAsk = exampleInput({ project: ex, view: studioView(ex) }, 'A', SENTENCE, keys, [], exCtx).ask;
  assert.equal(exAsk.authoring.selection.partId, key); validatePlanAsk(exAsk);
  assert.ok(converterExampleAnalysis(Object.fromEntries(keys), 'A'));
});

test('84 server: studio.plan.2 goes to the plan route with the authoring rule; studio.plan.1 keeps the earlier prompt byte for byte', async () => {
  const { p, input } = project(), view = studioView(p), inp = projectInput({ project: p, view }, SENTENCE, [], open(p, { selected: input, scope: null }));
  const inputAlias = inp.ask.authoring.selection.partId, sent = [];
  const handler = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'authoring-server-only-key' }, fetchImpl: async (url, init) => {
    sent.push(JSON.parse(init.body)); return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply(inputAlias)) } }] });
  } });
  const post = body => handler(new Request('https://app.test/api/studio/plan', { method: 'POST', headers: { Origin: 'https://app.test', 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' }, body: JSON.stringify(body) }));
  const r2 = await post(inp.ask); assert.equal(r2.status, 200); assert.deepEqual((await r2.json()).reply, reply(inputAlias));
  assert.equal(sent[0].messages[0].content, PLAN2_PROMPT); assert.equal(sent[0].max_tokens, 8192);
  assert.ok(sent[0].messages[1].content.includes('"authoring":{"state":"recorded"'));
  const v1 = { schemaVersion: 'studio.plan.1', intent: inp.ask.intent, parts: inp.ask.parts, evidence: inp.ask.evidence };
  assert.equal((await post(v1)).status, 200); assert.equal(sent[1].messages[0].content, PLAN_PROMPT); assert.ok(!PLAN_PROMPT.includes('authoring'));
  assert.equal((await post({ ...v1, authoring: inp.ask.authoring })).status, 400); assert.equal(sent.length, 2);
  // The v2 prompt is the v1 prompt with one rule before the same return format: reading aid, not target or scope, intent first.
  const at = PLAN_PROMPT.indexOf('\n정확히 다음 JSON 키만 반환한다(');
  assert.ok(PLAN2_PROMPT.startsWith(PLAN_PROMPT.slice(0, at)) && PLAN2_PROMPT.endsWith(PLAN_PROMPT.slice(at)));
  for (const rule of ['변경 대상이나 요청 범위가 아니다', 'intent가 우선한다', 'evidence가 아니므로', '이름이 같거나 비슷한 다른 부분으로 연결하지 않는다']) assert.ok(PLAN2_PROMPT.includes(rule), rule);
  assert.ok(!JSON.stringify(sent).includes('authoring-server-only-key'));
});
