// The one route decision (shared/map-route.ts) the browser and the PC server share. All credentials below are inert test values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as J from '../dist/public/shared/map-job.js';
import * as R from '../dist/public/shared/map-route.js';
import { studioView } from '../dist/public/shared/studio.js';
import { aiStatus } from '../dist/public/client/studio-api.js';
import { createMapRun } from '../dist/public/client/map-run.js';
import { JobReservations } from '../dist/public/client/map-jobs.js';
import { createStudioHandler, mapPromptId, map7PromptId } from '../server/studio.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import { openFirstMapPipeline } from '../server/map-pipeline-host.mjs';
import { createFirstMapPipeline } from '../server/map-pipeline.mjs';
import { openMapPipelineStore } from '../server/map-pipeline-store.mjs';
import { planMapPartitions } from '../server/map-partition.mjs';

const inert = 'route-test-not-a-real-credential';
const baseModel = 'deepseek-flash', dividedModel = 'deepseek-flash_gpt-6.1-sol_gpt-6.1-terra';
const firstPrompt = `m6-${'a'.repeat(12)}`, laterPrompt = `m7-${'b'.repeat(12)}`;
const offer = (prompt, extra = {}) => ({ model: dividedModel, prompt, ready: true, method: 'divided', monthlyUsd: 20, runUsd: 1, deepseekMaxCalls: 12, ...extra });

const pasted = (p, text) => D.pasteRecord(p, text, null).project;
const fresh = () => pasted(D.createProject(), '요구: 결과를 파일로 저장한다.\n아직 구현하지 않았다.');
/** Parts added by hand ('부분 직접 추가'), then a record pasted: the case that is neither an empty first map nor read before. */
const handPart = () => pasted(D.addArea(D.createProject(), '저장', '사람이 남긴 설명'), '저장 기능을 구현했다고 보고했다. 검사는 아직이다.');
const ask = (p, anchored) => M.buildMapAsk(p, studioView(p), [], undefined, anchored).ask;

/* The two rules this module replaced, kept verbatim as the oracle: the browser's (map-run.ts dividedFirst/dividedOf/promptOf/
 * modelOf) and the server's (map-pipeline.mjs isFirstMap/eligible, studio.mjs jobPrompt/jobModel). */
const oldClient = (a, map) => {
  const dividedFirst = a.schemaVersion === M.MAP6_SCHEMA && !a.parts.length && !(a.requests ?? []).length && !(a.priors ?? []).length;
  const divided = dividedFirst ? map.first : a.schemaVersion === M.MAP7_SCHEMA ? map.later : undefined;
  return { divided: !!divided, ready: divided ? divided.ready : true, prompt: divided?.prompt ?? (a.schemaVersion === M.MAP7_SCHEMA ? map.laterPrompt : map.prompt), model: divided?.model ?? map.model };
};
const oldServer = (a, pipeline, ids) => {
  const isFirstMap = a?.schemaVersion === 'studio.map.6' && a.parts.length === 0 && !(a.requests ?? []).length && !(a.priors ?? []).length;
  const divided = !!pipeline && (isFirstMap || a?.schemaVersion === 'studio.map.7');
  return { divided, prompt: divided ? (a.schemaVersion === 'studio.map.7' ? ids.later : ids.first) : (a.schemaVersion === 'studio.map.7' ? ids.m7 : ids.m6), model: divided ? pipeline.model : baseModel };
};

test('mapRoute chooses the very prompt ids and models the browser and the server chose before, for every supported ask shape', async () => {
  const m6 = await mapPromptId(), m7 = await map7PromptId();
  const first = ask(fresh(), M.MAP7_SCHEMA), later = ask(handPart(), M.MAP7_SCHEMA), legacy = ask(handPart(), M.MAP6_SCHEMA);
  const asks = { first, later, legacy, requestsOnly: { ...first, requests: [{ id: 'RQ_x' }] }, priorsOnly: { ...first, priors: [{ key: 'M01' }] },
    map5: ask(fresh(), M.MAP5_SCHEMA), map4: ask(fresh(), true) };
  assert.deepEqual([first.schemaVersion, later.schemaVersion, legacy.schemaVersion, asks.map5.schemaVersion, asks.map4.schemaVersion],
    [M.MAP6_SCHEMA, M.MAP7_SCHEMA, M.MAP6_SCHEMA, M.MAP5_SCHEMA, M.MAP4_SCHEMA], 'a hand-added part makes the next reading a later map.7');
  const statuses = {
    divided: { model: baseModel, prompt: m6, laterPrompt: m7, first: offer(firstPrompt), later: offer(laterPrompt) },
    unready: { model: baseModel, prompt: m6, laterPrompt: m7, first: offer(firstPrompt, { ready: false }), later: offer(laterPrompt, { ready: false }) },
    single: { model: baseModel, prompt: m6, laterPrompt: m7 },
  };
  const expected = { first: 'divided-first', later: 'divided-later', legacy: 'single', requestsOnly: 'single', priorsOnly: 'single', map5: 'single', map4: 'single' };
  for (const [s, map] of Object.entries(statuses)) for (const [name, a] of Object.entries(asks)) {
    const route = R.mapRoute(a, map), was = oldClient(a, map);
    assert.deepEqual([route.route !== 'single', route.ready, route.promptId, route.model], [was.divided, was.ready, was.prompt, was.model], `client ${s}/${name}`);
    assert.equal(route.route, s === 'single' ? 'single' : expected[name], `${s}/${name}`);
    assert.equal(route.schema, a.schemaVersion);
    // The server's offer always names both single recipes; its divided families are those of its pipeline.
    const pipeline = s === 'single' ? null : { model: dividedModel }, server = oldServer(a, pipeline, { m6, m7, first: firstPrompt, later: laterPrompt });
    assert.deepEqual([route.route !== 'single', route.promptId, route.model], [server.divided, server.prompt, server.model], `server ${s}/${name}`);
    assert.equal(R.dividedKind(a) !== null && !!pipeline, server.divided);
  }
  // An old server with no later recipe: a first map still goes; a map.7 (never built for it) has no route instead of an undefined id.
  assert.equal(R.mapRoute(first, { model: baseModel, prompt: m6 }).promptId, m6);
  assert.equal(R.mapRoute(later, { model: baseModel, prompt: m6 }), null);
  assert.deepEqual([R.isFirstMap(null), R.isFirstMap({ schemaVersion: 'studio.plan.3' }), R.dividedKind(undefined), R.dividedKind({ schemaVersion: 'studio.ask.1' })], [false, false, null, null]);
});

test('the pipeline scope is the shared rule: a first map.6 and every map.7, never a map.6 with parts', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'af-route-scope-'));
  const store = await openMapPipelineStore({ dir });
  t.after(async () => { await store.close(); await rm(dir, { recursive: true, force: true }); });
  const pipeline = createFirstMapPipeline({ store, deepseekKey: inert, openaiKey: inert, renderModel: 'gpt-6.1-terra' });
  const first = M.validateMapAsk(ask(fresh(), M.MAP7_SCHEMA)), later = M.validateMapAsk(ask(handPart(), M.MAP7_SCHEMA)), legacy = M.validateMapAsk(ask(handPart(), M.MAP6_SCHEMA));
  assert.deepEqual([pipeline.eligible(first), pipeline.eligible(later), pipeline.eligible(legacy)], [true, true, false]);
  await assert.rejects(pipeline.call(legacy), error => error.code === 'MAP_PIPELINE_SCOPE');
  const info = pipeline.describe();
  assert.deepEqual([info.maxPartitions, info.targetChars, info.deepseekMaxCalls, info.parallel], [R.DIVIDED_PARTITIONS, R.DIVIDED_PARTITION_CHARS, 24, R.DIVIDED_PARALLEL]);
});

const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const request = (path, value, cap) => new Request(`http://127.0.0.1/api/studio/${path}`, {
  method: value === undefined ? 'GET' : 'POST',
  headers: { 'x-agentflow-request': '1', ...(value === undefined ? {} : { 'content-type': 'application/json' }), ...(cap ? { 'x-studio-operation': cap } : {}) },
  ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
const invoke = async (handle, path, value, cap) => { const r = await handle(request(path, value, cap)); return { status: r.status, ...await r.json() }; };
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

test('the PC host advertises its real partition limits; the browser binds jobs to the route the server admits and runs', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'af-route-host-')), jobsDir = mkdtempSync(join(tmpdir(), 'af-route-jobs-'));
  const jobs = await openMapJobs({ dir: jobsDir });
  const pipeline = await openFirstMapPipeline({ dir, env: { DEEPSEEK_API_KEY: inert, OPENAI_API_KEY: inert }, fetchImpl: async () => assert.fail('no provider call') });
  t.after(async () => { await pipeline.close(); await jobs.close(); await rm(dir, { recursive: true, force: true }); await rm(jobsDir, { recursive: true, force: true }); });
  const ran = [];
  // The server reads through read() (the wire with its set-aside reasons); call() stays for callers that take the wire alone.
  pipeline.read = async a => { ran.push(a.schemaVersion); return { wire: { summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] }, exclusions: [] }; };
  pipeline.call = async (...args) => (await pipeline.read(...args)).wire;
  const providerCalls = [];
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: inert, STUDIO_REQUESTS_PER_MINUTE: '120' }, jobs, firstMapPipeline: pipeline,
    fetchImpl: async (_url, init) => { providerCalls.push(JSON.parse(init.body).model); return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] }) } }] }); } });
  const status = await invoke(handle, 'status');
  for (const family of ['first', 'later']) assert.deepEqual([status.map[family].partitions, status.map[family].partitionChars, status.map[family].deepseekMaxCalls], [12, 3500, 24]); // 12 extractions, each with one correction under OpenAI rendering
  globalThis.fetch = async () => json(status);
  const parsed = await aiStatus();
  assert.deepEqual(parsed.map.first, status.map.first); assert.deepEqual(parsed.map.later, status.map.later);
  const lines = R.mapBatchLines(R.mapRoute(ask(fresh(), M.MAP7_SCHEMA), parsed.map));
  assert.match(lines[0], /최대 4개를 최대 12구간\(구간당 3,500자 안팎\)으로 나눠 동시에 2개씩/);
  assert.match(lines[1], /정리당 \$1, 월 \$20\. .*최대 24회/);
  assert.doesNotMatch(lines[0], /기존 지도/, 'a first map has no existing map to check');
  assert.match(R.mapBatchLines(R.mapRoute(ask(handPart(), M.MAP7_SCHEMA), parsed.map))[0], /기존 지도와 직접 고친 내용/);
  for (const [p, anchored, way] of [[fresh(), M.MAP7_SCHEMA, 'divided-first'], [handPart(), M.MAP7_SCHEMA, 'divided-later'], [handPart(), M.MAP6_SCHEMA, 'single']]) {
    const input = M.buildMapAsk(p, studioView(p), [], undefined, anchored), route = R.mapRoute(input.ask, parsed.map), encoded = J.encodeMapInput(input), id = `MJ_${crypto.randomUUID()}`;
    assert.equal(route.route, way);
    const cap = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
    const body = { version: J.MAP_JOB_VERSION, id, input: encoded, binding: { entryId: `E_${crypto.randomUUID()}`, projectId: p.id, lifecycle: 1, seq: 1,
      after: input.after, schemaVersion: input.ask.schemaVersion, prompt: route.promptId, model: route.model, askHash: await J.jobHash(input.ask), inputHash: await J.jobHash(encoded) } };
    assert.equal((await invoke(handle, 'jobs', body, cap)).status, 202, `${way} binding admitted`);
    for (let i = 0; i < 500; i++) { const out = await invoke(handle, `jobs/${id}`, undefined, cap); if (out.state === 'ready') { assert.equal(out.result.model, route.model); break; } await new Promise(r => setTimeout(r, 2)); }
  }
  assert.deepEqual(ran, [M.MAP6_SCHEMA, M.MAP7_SCHEMA]); assert.deepEqual(providerCalls, [baseModel], 'the later map.6 went the single way, with the plan model');
});

/** A project whose four records are long and dense in ASCII (code, English logs): its whole ask fits MAP_BYTES, its partitions do not. */
const longProject = () => {
  let p = D.createProject();
  const unit = 'The export step writes the file to disk and the check ran green. ';
  for (let i = 0; i < 4; i++) p = pasted(p, Array.from({ length: 400 }, (_, k) => `${i}-${k}. ${unit}${unit}${unit}`).join('\n').slice(0, 15000));
  return p;
};

test('partition planning and the browser count share one grouping, so the browser knows what the server will cut', () => {
  for (const p of [fresh(), handPart(), longProject()]) {
    const a = ask(p, M.MAP7_SCHEMA);
    for (const target of [200, 1000, 3500]) {
      let planned; try { planned = planMapPartitions(a, { targetChars: target, maxPartitions: 1000 }).length; } catch (e) { planned = e.message; }
      assert.equal(R.partitionCount(a, target), planned);
    }
  }
  assert.deepEqual(R.partitionGroups([2, 2, 2, 5, 1], 4), [[0, 1], [2], [3], [4]]);
  assert.deepEqual(R.partitionGroups([], 4), []);
});

test('a divided reading leaves for the next reading the records its partitions cannot hold, instead of a refusal every time', () => {
  const p = longProject(), built = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA);
  assert.equal(built.ask.records.length, 4);
  assert.throws(() => planMapPartitions(built.ask), /MAP_PARTITION_LIMIT/, 'today the whole ask is refused');
  const status = { model: baseModel, prompt: `m6-${'c'.repeat(12)}`, laterPrompt: `m7-${'d'.repeat(12)}`, first: offer(firstPrompt), later: offer(laterPrompt) };
  const route = R.mapRoute(built.ask, status), fitted = R.fitMapInput(built, route);
  assert.equal(route.route, 'divided-first');
  assert.ok(fitted.ask.records.length < 4 && fitted.ask.records.length >= 1);
  assert.ok(planMapPartitions(fitted.ask).length <= 12);
  assert.deepEqual(fitted.ask.records, built.ask.records.slice(0, fitted.ask.records.length), 'whole records from the end go, the rest is as built');
  assert.deepEqual([fitted.coverage.fresh, fitted.coverage.sent], [built.coverage.fresh, fitted.ask.records.length]);
  assert.deepEqual([...fitted.records.keys()], fitted.ask.records.map(r => r.id));
  M.validateMapAsk(JSON.parse(JSON.stringify(fitted.ask)));
  assert.deepEqual(J.decodeMapInput(JSON.parse(JSON.stringify(J.encodeMapInput(fitted)))).ask, fitted.ask);
  assert.equal(built.ask.records.length, 4, 'the built input is not changed');
  // Single routes, inputs that fit and inputs with a problem come back as they were.
  assert.equal(R.fitMapInput(built, R.mapRoute(built.ask, { model: baseModel, prompt: status.prompt, laterPrompt: status.laterPrompt })), built);
  const small = M.buildMapAsk(fresh(), studioView(fresh()), [], undefined, M.MAP7_SCHEMA);
  assert.equal(R.fitMapInput(small, R.mapRoute(small.ask, status)), small);
  assert.equal(R.fitMapInput({ ...built, problem: 'TOO_LARGE' }, route).ask.records.length, 4);
  assert.equal(R.fitMapInput(built, null), built);
});

test('the browser sends the fitted ask under its route binding and says beforehand what waits for the next reading', async () => {
  const p = longProject(), sent = [], memory = new Map();
  const reservations = new JobReservations({ getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) },
    { request: (name, options, callback) => Promise.resolve((typeof options === 'function' ? options : callback)({ name })) });
  globalThis.fetch = async (url, init) => { sent.push({ url, body: init.body ? JSON.parse(init.body) : null }); return new Response(JSON.stringify({ error: { code: 'PROMPT_CHANGED' } }), { status: 409 }); };
  const status = { ai: 'deepseek', model: baseModel, access: 'open', jobs: { durable: true, problem: null },
    map: { model: baseModel, prompt: await mapPromptId(), laterPrompt: await map7PromptId(), first: offer(firstPrompt), later: offer(laterPrompt) } };
  const current = { key: 'E_route-client', kind: 'saved', project: p, view: studioView(p), ref: { lifecycle: 1, seq: 1 } };
  const run = createMapRun({ current: () => current, status: () => status, jobs: () => reservations, accessCode: () => '', commit: async () => null, done: () => {}, changed: () => {}, pollMs: 2 });
  try {
    const preview = run.preview();
    assert.equal(preview.route.route, 'divided-first'); assert.equal(run.route().promptId, firstPrompt);
    assert.ok(preview.inp.coverage.sent < preview.inp.coverage.fresh);
    await run.run();
    assert.equal(sent.length, 1); assert.equal(sent[0].url, '/api/studio/jobs');
    assert.deepEqual([sent[0].body.binding.prompt, sent[0].body.binding.model], [firstPrompt, dividedModel]);
    assert.deepEqual(sent[0].body.input.ask, preview.inp.ask);
  } finally { run.dispose(); }
});

test('the batch and waiting lines follow the route: one call on a host without the divided pipeline, stages on the PC', () => {
  const single = R.mapRoute(ask(fresh(), M.MAP7_SCHEMA), { model: baseModel, prompt: `m6-${'c'.repeat(12)}`, laterPrompt: `m7-${'d'.repeat(12)}` });
  assert.equal(single.reason, 'no-divided');
  assert.match(R.mapBatchLines(single)[0], /AI 요청 한 번으로 읽어요\. 한 번에 기록 최대 4개\(기록마다 12,000자까지\)/);
  assert.match(R.mapBatchLines(single)[0], /PC 실행기에서만/);
  const legacy = R.mapRoute(ask(handPart(), M.MAP6_SCHEMA), { model: baseModel, prompt: `m6-${'c'.repeat(12)}`, first: offer(firstPrompt), later: offer(laterPrompt) });
  assert.deepEqual([legacy.route, legacy.reason], ['single', 'not-divided-schema']);
  assert.match(R.mapBatchLines(legacy)[0], /이 요청 형식은 나눠 읽지 않고/);
  assert.deepEqual(R.mapBatchLines(null), []);
  // A server that does not state its DeepSeek bound is read with the largest a PC host can have.
  const unstated = R.mapRoute(ask(fresh(), M.MAP7_SCHEMA), { model: baseModel, prompt: 'm6-x', first: { ...offer(firstPrompt), deepseekMaxCalls: undefined } });
  assert.equal(unstated.limits.deepseekMaxCalls, R.DEEPSEEK_CALLS_UNSTATED);
  assert.match(R.mapBatchLines(unstated)[1], /최대 48회/);
  assert.equal(R.mapPendingText('divided-later'), R.mapPendingText('divided-first'));
  assert.notEqual(R.mapPendingText('single'), R.mapPendingText('divided-first'));
  assert.equal(R.routeOfPrompt(firstPrompt, { model: baseModel, prompt: 'm6-x', first: offer(firstPrompt) }), 'divided-first');
  assert.equal(R.routeOfPrompt('m6-x', { model: baseModel, prompt: 'm6-x' }), 'single');
  assert.equal(R.routeOfPrompt('m6-y', null), null);
});
