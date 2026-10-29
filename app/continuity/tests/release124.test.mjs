// AF124 the limited existing-map release: one policy named by the trusted assembly (worker-existing-map.mjs). Its status keeps
// ai/plan/scope/digest and names the release instead of map/jobs; every map schema (legacy, first and later map.6, map.7) and
// every jobs path is refused before the provider, limiter or a job store is touched. The default handler and Worker are unchanged.
// Stubbed provider only: no real AI call.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as S from '../dist/public/shared/storage.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView, buildAsk } from '../dist/public/shared/studio.js';
import { emptyBundle } from '../dist/public/client/plan-store.js';
import { projectInput } from '../dist/public/client/plan-source.js';
import { CONVERTER_PARTS, converterEvidence, CONVERTER_INTENT, converterExampleAnalysis } from '../dist/public/shared/change-plan-example.js';
import { buildUi62Project } from '../dist/public/shared/return-material.js';
import { ui62Reading, readingInput } from '../dist/public/client/digest-source.js';
import { createStudioHandler, RELEASE_POLICIES } from '../server/studio.mjs';
import * as K from './condition116-case.mjs';

const KEY = 'release124-server-only-key';
const counting = () => { const sent = []; return { sent, fetchImpl: async (url, init) => { sent.push(JSON.parse(init.body)); return new Response('{}', { status: 500 }); } }; };
const post = (path, body, headers = {}) => new Request(`https://studio.example${path}`, { method: 'POST',
  headers: { 'content-type': 'application/json', 'x-agentflow-request': '1', origin: 'https://studio.example', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const status = h => h(new Request('https://studio.example/api/studio/status')).then(r => r.json());

function mapAsks() {
  const later = K.conditionProject({ D, M, C, S, studioView, emptyBundle }), p = parseProject(JSON.stringify(later.project)), v = studioView(p);
  const first = D.pasteRecord(D.createProject(), '요청: 사진 정리기는 가져온 사진마다 썸네일을 만든다.\n보고: 썸네일 생성기를 추가했다.', null).project, fv = studioView(first);
  const asks = {
    'legacy map.1 (first)': M.buildMapAsk(first, fv, [], undefined, false).ask,
    'map.4 (first)': M.buildMapAsk(first, fv, [], undefined, true).ask,
    'map.5 (first)': M.buildMapAsk(first, fv, [], undefined, M.MAP5_SCHEMA).ask,
    'map.6 FIRST': M.buildMapAsk(first, fv, [], undefined, M.MAP6_SCHEMA).ask,
    'map.6 later': M.buildMapAsk(p, v, [later.rq], later.rq.id, M.MAP6_SCHEMA).ask,
    'map.7 later (return against a request)': M.buildMapAsk(p, v, [later.rq], later.rq.id, M.MAP7_SCHEMA).ask
  };
  return { asks, later: { p, v } };
}
const parts = CONVERTER_PARTS.map(p => ({ id: p.key, name: p.name, note: p.note, parentId: p.parent ?? null }));
function otherAsks(later) {
  const plan1 = { schemaVersion: 'studio.plan.1', intent: CONVERTER_INTENT, parts: structuredClone(parts), evidence: converterEvidence('A') };
  const items = converterExampleAnalysis(Object.fromEntries(parts.map(p => [p.id, p.id])), 'A').items;
  const project = buildUi62Project(), view = studioView(project);
  return {
    '/api/studio/plan': projectInput({ project: later.p, view: later.v }, '썸네일을 WebP로 저장하고 싶다.').ask,
    '/api/studio/scope': { ...plan1, schemaVersion: 'studio.scope.1', selected: items.slice(0, 1).map(({ id, title, description, partIds, refs }) => ({ id, title, description, partIds, refs })), excluded: items.slice(1).map(i => i.title) },
    '/api/studio/digest': readingInput({ project, view }, ui62Reading(project, 'reading_3'), null).ask,
    '/api/studio/ask': buildAsk(later.p, later.v, later.v.parts[0].id, 'summary', null).ask
  };
}

test('124 policy: only the named release; a limited release takes no jobs or executor', () => {
  assert.deepEqual(RELEASE_POLICIES, ['existing-map']);
  assert.throws(() => createStudioHandler({ env: {}, policy: 'map-only' }), /Unknown release policy/);
  assert.throws(() => createStudioHandler({ env: {}, policy: 'existing-map', jobs: { handle() {}, describe: () => ({}) } }), /no map jobs/);
  assert.throws(() => createStudioHandler({ env: {}, policy: 'existing-map', mapExecutor: {} }), /no map jobs/);
});

test('124 status: ai, access and digest as the default handler; map and jobs replaced by the release reason', async () => {
  for (const env of [{ DEEPSEEK_API_KEY: KEY, DEEPSEEK_PLAN_MODEL: 'm-plan' }, { DEEPSEEK_API_KEY: KEY, STUDIO_ACCESS_CODE: 'c0de' }, {}]) {
    const plain = await status(createStudioHandler({ env })), limited = await status(createStudioHandler({ env, policy: 'existing-map' }));
    const { map, ...rest } = plain;
    assert.equal(!!map, !!env.DEEPSEEK_API_KEY, 'the default handler still offers map with a key');
    assert.deepEqual(limited, { ...rest, release: 'existing-map' });
    assert.ok(!('map' in limited) && !('jobs' in limited));
  }
});

test('124 every map schema and every jobs path is refused before the provider; the same asks reach it on the default handler', async () => {
  const { asks } = mapAsks(), limitedCalls = counting(), plainCalls = counting();
  const limited = createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY, STUDIO_REQUESTS_PER_MINUTE: '120' }, policy: 'existing-map', fetchImpl: limitedCalls.fetchImpl });
  const plain = createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY, STUDIO_REQUESTS_PER_MINUTE: '120' }, fetchImpl: plainCalls.fetchImpl });
  for (const [label, ask] of Object.entries(asks)) {
    const r = await limited(post('/api/studio/map', ask));
    assert.deepEqual([r.status, await r.json()], [403, { error: { code: 'MAP_WITHHELD' } }], label);
    const n = plainCalls.sent.length, control = await plain(post('/api/studio/map', ask));
    assert.equal(control.status, 503, `${label}: valid and sent on the default handler`); assert.equal(plainCalls.sent.length, n + 1, label);
  }
  assert.deepEqual(new Set(Object.values(asks).map(a => a.schemaVersion)), new Set(['studio.map.1', 'studio.map.4', 'studio.map.5', 'studio.map.6', 'studio.map.7']));
  // An older tab, a hand-made request: no header, a wrong body, a GET, a too-large body, jobs and their sub-paths.
  const raw = [post('/api/studio/map', 'not json'), post('/api/studio/map', 'x'.repeat(600000)), new Request('https://studio.example/api/studio/map'),
    new Request('https://studio.example/api/studio/map', { method: 'POST', body: '{}' }), post('/api/studio/jobs', { version: 'map-job.1' }, { 'x-studio-operation': 'x'.repeat(43) }),
    new Request('https://studio.example/api/studio/jobs/MJ_1'), post('/api/studio/jobs/MJ_1/cancel', {}), post('/api/studio/jobs/MJ_1/ack', {}),
    new Request('https://studio.example/api/studio/jobs', { method: 'OPTIONS', headers: { origin: 'https://studio.example' } })];
  for (const req of raw) { const r = await limited(req); assert.deepEqual([r.status, (await r.json()).error.code], [403, 'MAP_WITHHELD'], `${req.method} ${req.url}`); }
  assert.equal(limitedCalls.sent.length, 0, 'no provider call');
  // The limiter is not touched: a release with one call a minute still serves its first plan call afterwards.
  const one = counting(), tight = createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY, STUDIO_REQUESTS_PER_MINUTE: '1' }, policy: 'existing-map', fetchImpl: one.fetchImpl });
  for (const ask of Object.values(asks)) assert.equal((await tight(post('/api/studio/map', ask))).status, 403);
  assert.equal((await tight(post('/api/studio/plan', otherAsks(mapAsks().later)['/api/studio/plan']))).status, 503); assert.equal(one.sent.length, 1);
});

test('124 origin and access boundaries stay: a foreign origin is refused as before; an allowed one gets its CORS header', async () => {
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: KEY, STUDIO_ACCESS_CODE: 'c0de', STUDIO_ALLOWED_ORIGINS: 'https://ui.example' }, policy: 'existing-map', fetchImpl: counting().fetchImpl });
  const { asks, later } = mapAsks(), ask = asks['map.6 FIRST'];
  assert.equal((await (await handle(post('/api/studio/map', ask, { origin: 'https://evil.example' }))).json()).error.code, 'FORBIDDEN_ORIGIN');
  assert.equal((await (await handle(post('/api/studio/map', ask, { origin: 'https://studio.example', 'sec-fetch-site': 'cross-site' }))).json()).error.code, 'FORBIDDEN_ORIGIN');
  const cors = await handle(post('/api/studio/map', ask, { origin: 'https://ui.example' }));
  assert.deepEqual([cors.status, cors.headers.get('access-control-allow-origin')], [403, 'https://ui.example']);
  const plan = otherAsks(later)['/api/studio/plan'];
  assert.equal((await handle(post('/api/studio/plan', plan))).status, 401, 'the access code is still asked for the routes the release keeps');
  const pre = await handle(new Request('https://studio.example/api/studio/plan', { method: 'OPTIONS', headers: { origin: 'https://ui.example' } }));
  assert.equal(pre.status, 204); assert.ok(!pre.headers.get('access-control-allow-headers').includes('X-Studio-Operation'));
});

test('124 plan3, scope, digest and ask send the very same provider request as the default handler', async () => {
  const { later } = mapAsks(), others = otherAsks(later);
  assert.equal(others['/api/studio/plan'].schemaVersion, 'studio.plan.3');
  const a = counting(), b = counting();
  const env = { DEEPSEEK_API_KEY: KEY, DEEPSEEK_PLAN_MODEL: 'm-plan', STUDIO_REQUESTS_PER_MINUTE: '120' };
  const limited = createStudioHandler({ env, policy: 'existing-map', fetchImpl: a.fetchImpl }), plain = createStudioHandler({ env, fetchImpl: b.fetchImpl });
  for (const [path, ask] of Object.entries(others)) {
    const [x, y] = [await limited(post(path, ask)), await plain(post(path, ask))];
    assert.deepEqual([x.status, y.status], [503, 503], path);
  }
  assert.equal(a.sent.length, 4); assert.deepEqual(a.sent, b.sent, 'same model, prompt, budget and material');
});

test('124 Workers: the release entry names the policy in code; the default Worker is as before', async () => {
  const limited = (await import('../server/worker-existing-map.mjs')).default, plain = (await import('../server/worker.mjs')).default;
  const env = { DEEPSEEK_API_KEY: KEY };
  const s = await (await limited.fetch(new Request('https://w.example/api/studio/status'), env)).json();
  assert.equal(s.release, 'existing-map'); assert.equal(s.ai, 'deepseek'); assert.ok(s.digest && !s.map && !s.jobs);
  const p = await (await plain.fetch(new Request('https://w.example/api/studio/status'), env)).json();
  assert.ok(p.map && !('release' in p));
  // The binding cannot turn the policy off or on.
  const viaEnv = await (await plain.fetch(new Request('https://w.example/api/studio/status'), { ...env, STUDIO_RELEASE: 'existing-map', policy: 'existing-map' })).json();
  assert.ok(viaEnv.map && !('release' in viaEnv));
  const r = await limited.fetch(post('/api/studio/map', mapAsks().asks['map.6 FIRST']).clone(), env);
  assert.deepEqual([r.status, (await r.json()).error.code], [403, 'MAP_WITHHELD']);
  const assets = { ASSETS: { fetch: () => new Response('asset') } };
  assert.equal(await (await limited.fetch(new Request('https://w.example/index.html'), { ...env, ...assets })).text(), 'asset');
});
