// Independent host/client integration. All credentials, providers, and pipeline outputs below are inert test values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMapPipelineEnv, openFirstMapPipeline } from '../server/map-pipeline-host.mjs';
import { createStudioHandler, mapPromptId, map7PromptId } from '../server/studio.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as J from '../dist/public/shared/map-job.js';
import { studioView } from '../dist/public/shared/studio.js';
import { SPAN_INDEX, textDigest } from '../dist/public/shared/evidence-span.js';
import { aiStatus } from '../dist/public/client/studio-api.js';
import { createMapRun } from '../dist/public/client/map-run.js';
import { JobReservations } from '../dist/public/client/map-jobs.js';

const inert = 'host-test-not-a-real-credential';
const baseModel = 'deepseek-flash', dividedModel = 'deepseek-flash_gpt-6.1-sol';
const firstPrompt = `m6-${'a'.repeat(12)}`, laterPrompt = `m7-${'b'.repeat(12)}`;
const wire = () => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] });
const project = later => {
  let p = D.createProject(); if (later) p = D.addArea(p, '저장', '사람이 남긴 설명');
  return D.pasteRecord(p, '요구: 결과를 파일로 저장한다.\n아직 구현하지 않았다.', null).project;
};
const mapInput = (p, schema = M.MAP7_SCHEMA) => M.buildMapAsk(p, studioView(p), [], undefined, schema);
const pipeline = () => {
  const calls = [];
  return { calls, identity: 'a'.repeat(64), laterIdentity: 'b'.repeat(64), model: dividedModel,
    ready: () => true, describe: () => ({ monthlyUsd: 20, runUsd: 1, deepseekMaxCalls: 30 }),
    eligible: ask => !!ask && (ask.schemaVersion === M.MAP7_SCHEMA || ask.schemaVersion === M.MAP6_SCHEMA && M.firstAsk(ask)),
    call: async ask => { calls.push(structuredClone(ask)); return wire(); } };
};
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const request = (path, value, cap) => new Request(`http://127.0.0.1/api/studio/${path}`, {
  method: value === undefined ? 'GET' : 'POST',
  headers: { 'x-agentflow-request': '1', ...(value === undefined ? {} : { 'content-type': 'application/json' }), ...(cap ? { 'x-studio-operation': cap } : {}) },
  ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
async function invoke(handle, path, value, cap) {
  const response = await handle(request(path, value, cap)); return { status: response.status, ...await response.json() };
}
async function service() {
  const jobs = await openMapJobs({ dir: mkdtempSync(join(tmpdir(), 'af-pipeline-host-')) }), divided = pipeline(), providerCalls = [];
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: inert, STUDIO_REQUESTS_PER_MINUTE: '120' }, jobs, firstMapPipeline: divided,
    fetchImpl: async (_url, init) => { providerCalls.push(JSON.parse(init.body)); return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(wire()) } }] }); } });
  return { jobs, divided, providerCalls, handle };
}
async function submission(p, prompt, model, schema = M.MAP7_SCHEMA) {
  const input = mapInput(p, schema), encoded = J.encodeMapInput(input), id = `MJ_${crypto.randomUUID()}`;
  return { id, cap: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),
    body: { version: J.MAP_JOB_VERSION, id, input: encoded, binding: { entryId: `E_${crypto.randomUUID()}`, projectId: p.id, lifecycle: 1, seq: 1,
      after: input.after, schemaVersion: input.ask.schemaVersion, prompt, model, askHash: await J.jobHash(input.ask), inputHash: await J.jobHash(encoded) } } };
}
async function ended(handle, job) {
  for (let i = 0; i < 500; i++) {
    const out = await invoke(handle, `jobs/${job.id}`, undefined, job.cap);
    if (!['accepted', 'running'].includes(out.state)) return out;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  assert.fail('stub job did not finish');
}
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

test('local env loader imports only its whitelist, preserves existing and explicit empty values, and never mutates input', async () => {
  const env = { STUDIO_OPENAI_ENV: 'inert-test.env', OPENAI_API_KEY: inert, STUDIO_MAP_MERGE_MODEL: '', STUDIO_ACCESS_CODE: 'existing-code' }, before = { ...env };
  let reads = 0;
  const out = await loadMapPipelineEnv(env, async (path, encoding) => {
    reads++; assert.equal(path, 'inert-test.env'); assert.equal(encoding, 'utf8');
    return 'OPENAI_API_KEY=file-test-value\nSTUDIO_MAP_MERGE_MODEL=file-model\nSTUDIO_MAP_MONTHLY_USD=20\nSTUDIO_MAP_RUN_USD=1\nDEEPSEEK_API_KEY=ignored-test-value\nSTUDIO_ACCESS_CODE=ignored-code\nUNRELATED=ignored';
  });
  assert.equal(reads, 1); assert.deepEqual(env, before);
  assert.deepEqual(out, { ...before, STUDIO_MAP_MONTHLY_USD: '20', STUDIO_MAP_RUN_USD: '1' });
});

test('mock mode and missing paths never read credential files; explicit missing files fail with a static error', async () => {
  const mock = { AI_MODE: 'mock', STUDIO_OPENAI_ENV: 'must-not-read.env', OPENAI_API_KEY: inert };
  const never = async () => assert.fail('credential file must not be read');
  assert.deepEqual(await loadMapPipelineEnv(mock, never), mock);
  assert.deepEqual(await loadMapPipelineEnv({}, never), {});
  assert.equal(await openFirstMapPipeline({ env: mock }), null);
  const missing = async () => { throw Object.assign(new Error('private-path-detail'), { code: 'ENOENT' }); };
  assert.deepEqual(await loadMapPipelineEnv({ LOCALAPPDATA: 'inert-parent' }, missing), { LOCALAPPDATA: 'inert-parent' });
  await assert.rejects(loadMapPipelineEnv({ STUDIO_OPENAI_ENV: 'inert.env' }, missing), /^Error: OPENAI_ENV_UNREADABLE$/);
});

test('HTTP status and client parser preserve separate first m6/later m7 capabilities and the old provider metadata', async () => {
  const s = await service();
  try {
    const st = await invoke(s.handle, 'status');
    assert.deepEqual([st.map.model, st.map.prompt, st.map.laterPrompt], [baseModel, await mapPromptId(), await map7PromptId()]);
    assert.deepEqual(st.map.first, { model: dividedModel, prompt: firstPrompt, ready: true, method: 'divided', monthlyUsd: 20, runUsd: 1, deepseekMaxCalls: 30 });
    assert.deepEqual(st.map.later, { ...st.map.first, prompt: laterPrompt });
    globalThis.fetch = async () => json(st);
    const parsed = await aiStatus(); assert.deepEqual(parsed.map, st.map);
    globalThis.fetch = async () => json({ ...st, map: { ...st.map, first: { ...st.map.first, prompt: laterPrompt } } });
    const badFirst = await aiStatus(); assert.equal(badFirst.map.first, undefined); assert.deepEqual(badFirst.map.later, st.map.later);
    globalThis.fetch = async () => json({ ...st, map: { ...st.map, later: { ...st.map.later, prompt: firstPrompt } } });
    const badLater = await aiStatus(); assert.equal(badLater.map.later, undefined); assert.deepEqual(badLater.map.first, st.map.first);
    assert.equal(s.divided.calls.length + s.providerCalls.length, 0);
  } finally { await s.jobs.close(); }
});

test('direct first map.6 and later map.7 cannot bypass durable pipeline receipts', async () => {
  const s = await service();
  try {
    for (const later of [false, true]) {
      const input = mapInput(project(later)); assert.equal(input.ask.schemaVersion, later ? M.MAP7_SCHEMA : M.MAP6_SCHEMA);
      const out = await invoke(s.handle, 'map', input.ask);
      assert.deepEqual([out.status, out.error.code], [409, 'MAP_PIPELINE_JOBS_REQUIRED']);
    }
    assert.equal(s.divided.calls.length + s.providerCalls.length, 0);
  } finally { await s.jobs.close(); }
});

test('HTTP job polling carries sanitized pipeline progress through both callbacks and drops it on ready', async () => {
  const s = await service(); let finish, started = false;
  const gate = new Promise(resolve => { finish = resolve; });
  s.divided.call = async (ask, _signal, reportProgress) => {
    assert.equal(typeof reportProgress, 'function'); started = true; s.divided.calls.push(ask);
    reportProgress({ phase: 'extract', done: 2, total: 4, text: 'PRIVATE_SOURCE', model: 'PRIVATE_MODEL' });
    await gate; return wire();
  };
  try {
    const job = await submission(project(false), firstPrompt, dividedModel);
    const receipt = await invoke(s.handle, 'jobs', job.body, job.cap); assert.equal(receipt.status, 202); assert.equal(receipt.progress, undefined);
    for (let i = 0; !started && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 2));
    assert.equal(started, true);
    const active = await invoke(s.handle, `jobs/${job.id}`, undefined, job.cap);
    assert.deepEqual(active.progress, { phase: 'extract', done: 2, total: 4 }); assert.ok(!JSON.stringify(active).includes('PRIVATE'));
    finish(); const ready = await ended(s.handle, job); assert.equal(ready.state, 'ready'); assert.equal(ready.progress, undefined);
    assert.equal(s.divided.calls.length, 1); assert.equal(s.providerCalls.length, 0);
  } finally { finish(); await s.jobs.close(); }
});

test('durable admission chooses model and recipe from the actual ask; stale tabs and crossed bindings dispatch nothing', async () => {
  const s = await service();
  try {
    for (const [later, prompt, model] of [
      [false, await mapPromptId(), baseModel], [true, await map7PromptId(), baseModel],
      [false, firstPrompt, baseModel], [true, laterPrompt, baseModel],
      [false, laterPrompt, dividedModel], [true, firstPrompt, dividedModel],
    ]) {
      const job = await submission(project(later), prompt, model), out = await invoke(s.handle, 'jobs', job.body, job.cap);
      assert.deepEqual([out.status, out.error.code], [409, 'PROMPT_CHANGED']);
    }
    assert.equal(s.divided.calls.length + s.providerCalls.length, 0);
    for (const later of [false, true]) {
      const job = await submission(project(later), later ? laterPrompt : firstPrompt, dividedModel);
      assert.equal((await invoke(s.handle, 'jobs', job.body, job.cap)).status, 202);
      const out = await ended(s.handle, job);
      assert.equal(out.state, 'ready'); assert.equal(out.result.model, dividedModel); assert.equal(out.result.prompt, job.body.binding.prompt);
      assert.deepEqual(out.input.ask, job.body.input.ask); assert.deepEqual(s.divided.calls.at(-1), job.body.input.ask);
      assert.deepEqual(out.result.evidence, { index: SPAN_INDEX, ask: textDigest(JSON.stringify(job.body.input.ask)) });
      assert.equal((await invoke(s.handle, 'jobs', job.body, job.cap)).status, 200);
    }
    assert.deepEqual(s.divided.calls.map(ask => ask.schemaVersion), [M.MAP6_SCHEMA, M.MAP7_SCHEMA]); assert.equal(s.providerCalls.length, 0);
  } finally { await s.jobs.close(); }
});

test('a legacy later map.6 keeps its original provider contract and cannot borrow a divided first-map identity', async () => {
  const s = await service();
  try {
    const p = project(true), crossed = await submission(p, firstPrompt, dividedModel, M.MAP6_SCHEMA);
    const refused = await invoke(s.handle, 'jobs', crossed.body, crossed.cap);
    assert.deepEqual([refused.status, refused.error.code], [409, 'PROMPT_CHANGED']);
    const legacy = await submission(p, await mapPromptId(), baseModel, M.MAP6_SCHEMA);
    assert.equal((await invoke(s.handle, 'jobs', legacy.body, legacy.cap)).status, 202);
    const out = await ended(s.handle, legacy);
    assert.equal(out.state, 'ready'); assert.equal(out.result.model, baseModel); assert.equal(out.result.prompt, await mapPromptId());
    assert.equal(s.divided.calls.length, 0); assert.equal(s.providerCalls.length, 1);
    assert.equal(s.providerCalls[0].model, baseModel);
  } finally { await s.jobs.close(); }
});

test('an already ready first map.6 survives a newer pipeline status and repeated old-tab submission under its own binding', async () => {
  const s = await service(); let oldCalls = 0;
  const oldHost = createStudioHandler({ env: { DEEPSEEK_API_KEY: inert }, jobs: s.jobs,
    fetchImpl: async () => { oldCalls++; return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(wire()) } }] }); } });
  try {
    const job = await submission(project(false), await mapPromptId(), baseModel);
    assert.equal((await invoke(oldHost, 'jobs', job.body, job.cap)).status, 202);
    const original = await ended(oldHost, job); assert.equal(original.state, 'ready');
    const status = await invoke(s.handle, 'status'); assert.equal(status.map.first.prompt, firstPrompt);
    assert.equal((await invoke(s.handle, 'jobs', job.body, job.cap)).status, 200, 'same accepted job is idempotent, not rebound to the new pipeline');
    const recovered = await invoke(s.handle, `jobs/${job.id}`, undefined, job.cap);
    assert.deepEqual(recovered.binding, original.binding); assert.deepEqual(recovered.result, original.result);
    assert.deepEqual([recovered.result.model, recovered.result.prompt], [baseModel, await mapPromptId()]);
    assert.equal(oldCalls, 1); assert.equal(s.divided.calls.length + s.providerCalls.length, 0);
  } finally { await s.jobs.close(); }
});

function reservations() {
  const memory = new Map();
  const kv = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const locks = { request: (name, options, callback) => Promise.resolve((typeof options === 'function' ? options : callback)({ name })) };
  return new JobReservations(kv, locks);
}
async function clientRequest(p, status, respond) {
  const sent = [], jobs = reservations(), current = { key: 'E_pipeline-client', kind: 'saved', project: p, view: studioView(p), ref: { lifecycle: 1, seq: 1 } };
  globalThis.fetch = async (url, init) => {
    sent.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    return respond ? respond(sent.at(-1)) : new Response(JSON.stringify({ error: { code: 'PROMPT_CHANGED' } }), { status: 409 });
  };
  let commits = 0; const committed = [];
  const run = createMapRun({ current: () => current, status: () => status, jobs: () => jobs, accessCode: () => '',
    commit: async next => { commits++; committed.push(next); return null; }, done: () => {}, changed: () => {}, pollMs: 2 });
  await run.run(); return { sent, run, current, commits: () => commits, committed };
}

test('client reservations bind first/later models independently; old status stays old and unready capabilities send nothing', async () => {
  const base = { ai: 'deepseek', model: baseModel, access: 'open', jobs: { durable: true, problem: null },
    map: { model: baseModel, prompt: await mapPromptId(), laterPrompt: await map7PromptId(),
      first: { model: 'first-stub-model', prompt: firstPrompt, ready: true, method: 'divided', monthlyUsd: 20, runUsd: 1 },
      later: { model: 'later-stub-model', prompt: laterPrompt, ready: true, method: 'divided', monthlyUsd: 20, runUsd: 1 } } };
  for (const later of [false, true]) {
    const out = await clientRequest(project(later), base);
    try {
      assert.equal(out.sent.length, 1); assert.equal(out.sent[0].url, '/api/studio/jobs');
      assert.deepEqual([out.sent[0].body.binding.schemaVersion, out.sent[0].body.binding.model, out.sent[0].body.binding.prompt],
        [later ? M.MAP7_SCHEMA : M.MAP6_SCHEMA, later ? 'later-stub-model' : 'first-stub-model', later ? laterPrompt : firstPrompt]);
      assert.equal(out.commits(), 0);
    } finally { out.run.dispose(); }
  }
  const old = await clientRequest(project(true), { ...base, map: { model: baseModel, prompt: await mapPromptId() } });
  try { assert.deepEqual([old.sent[0].body.binding.schemaVersion, old.sent[0].body.binding.model, old.sent[0].body.binding.prompt], [M.MAP6_SCHEMA, baseModel, await mapPromptId()]); }
  finally { old.run.dispose(); }
  for (const later of [false, true]) {
    const capability = later ? 'later' : 'first';
    const out = await clientRequest(project(later), { ...base, map: { ...base.map, [capability]: { ...base.map[capability], ready: false } } });
    try { assert.equal(out.sent.length, 0); assert.ok(out.run.state().error); assert.equal(out.commits(), 0); } finally { out.run.dispose(); }
  }
});

test('client rejects a ready result whose model differs from its durable binding even with matching input, prompt and evidence', async () => {
  const status = { ai: 'deepseek', model: baseModel, access: 'open', jobs: { durable: true, problem: null },
    map: { model: baseModel, prompt: await mapPromptId(), first: { model: dividedModel, prompt: firstPrompt, ready: true, method: 'divided', monthlyUsd: 20, runUsd: 1 } } };
  const out = await clientRequest(project(false), status, async ({ body, url }) => {
    if (url.endsWith('/ack')) return json({ version: 'map-job.1', id: 'unused', state: 'ready' });
    assert.equal(url, '/api/studio/jobs');
    return json({ version: 'map-job.1', id: body.id, binding: body.binding, bindingHash: await J.jobHash(body.binding), state: 'ready', input: body.input, acked: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), error: null, remote: null,
      result: { model: 'wrong-later-model', prompt: body.binding.prompt, askHash: body.binding.askHash, wire: wire(),
        evidence: { index: SPAN_INDEX, ask: textDigest(JSON.stringify(body.input.ask)) }, reading: { id: `R_${crypto.randomUUID()}`, at: new Date().toISOString() } } });
  });
  try { assert.equal(out.commits(), 0); assert.ok(out.run.state().error); assert.ok(out.sent.some(x => x.url.endsWith('/ack') && x.body.outcome === 'discarded')); }
  finally { out.run.dispose(); }
});

test('the private env whitelist imports render-model choice and preserves process overrides without reading any real file', async () => {
  const fileText = 'STUDIO_MAP_RENDER_MODEL=gpt-6.1-terra\nDEEPSEEK_API_KEY=ignored\nSTUDIO_ACCESS_CODE=ignored';
  const fromFile = await loadMapPipelineEnv({ STUDIO_OPENAI_ENV: 'inert-render-test.env' }, async () => fileText);
  assert.deepEqual(fromFile, { STUDIO_OPENAI_ENV: 'inert-render-test.env', STUDIO_MAP_RENDER_MODEL: 'gpt-6.1-terra' });
  for (const renderModel of ['deepseek-flash', 'gpt-6.1-sol', '']) {
    const env = { STUDIO_OPENAI_ENV: 'inert-render-test.env', STUDIO_MAP_RENDER_MODEL: renderModel };
    assert.deepEqual(await loadMapPipelineEnv(env, async () => fileText), env);
  }
});

async function hostFixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'af-render-host-')), opened = [];
  t.after(async () => {
    for (const pipeline of opened) await pipeline.close();
    const { rm } = await import('node:fs/promises');
    await rm(dir, { recursive: true, force: true });
  });
  return {
    dir,
    async open(extra = {}) {
      const pipeline = await openFirstMapPipeline({ dir, env: { DEEPSEEK_API_KEY: inert, OPENAI_API_KEY: inert, ...extra },
        fetchImpl: async () => assert.fail('host configuration must never invoke a provider') });
      opened.push(pipeline); return pipeline;
    },
  };
}

// first-map-divided.6: with OpenAI rendering each extraction may be corrected once, so the bound is 2 x 12 = 24 DeepSeek calls.
test('Node host defaults rendering to Terra and reports the fixed-host 24-call DeepSeek bound', async t => {
  const host = await hostFixture(t), pipeline = await host.open(), info = pipeline.describe();
  assert.equal(info.renderModel, 'gpt-6.1-terra');
  assert.equal(info.renderProvider, 'openai');
  assert.equal(info.maxPartitions, 12);
  assert.equal(info.deepseekMaxCalls, 24);
  // Recipe .47: a first map's own bounds (a whole folded v5 record).
  assert.deepEqual([info.firstMaxPartitions, info.firstDeepseekMaxCalls], [24, 48]);
  assert.equal(pipeline.model, 'deepseek-flash_gpt-6.1-sol_gpt-6.1-terra');
  assert.equal(pipeline.ready(), true);
  assert.equal(info.durable, true);
});

test('explicit supported host render models select their provider and actual DeepSeek call allowance', async t => {
  const host = await hostFixture(t);
  for (const [renderModel, provider, maxCalls] of [
    ['deepseek-flash', 'deepseek', 64], ['gpt-6.1-sol', 'openai', 24], ['gpt-6-astra', 'openai', 24], ['gpt-6.1-terra', 'openai', 24],
  ]) {
    const pipeline = await host.open({ STUDIO_MAP_RENDER_MODEL: renderModel });
    const info = pipeline.describe();
    assert.deepEqual([info.renderModel, info.renderProvider, info.deepseekMaxCalls], [renderModel, provider, maxCalls]);
    assert.equal(info.durable, true);
    await pipeline.close();
  }
});

test('a host global model names the model of the global stages alone and is read from the private file too', async t => {
  const host = await hostFixture(t);
  const split = await host.open({ STUDIO_MAP_RENDER_MODEL: 'deepseek-flash', STUDIO_MAP_GLOBAL_MODEL: 'gpt-6.1-terra' }), info = split.describe();
  assert.deepEqual([info.renderModel, info.renderProvider, info.globalModel, info.globalProvider, info.deepseekMaxCalls], ['deepseek-flash', 'deepseek', 'gpt-6.1-terra', 'openai', 60]);
  assert.equal(split.model, 'deepseek-flash_gpt-6.1-sol_gpt-6.1-terra');
  await split.close();
  const env = await loadMapPipelineEnv({ STUDIO_OPENAI_ENV: 'inert-render-test.env' }, async () => 'STUDIO_MAP_RENDER_MODEL=deepseek-flash\nSTUDIO_MAP_GLOBAL_MODEL=gpt-6.1-sol');
  assert.deepEqual(env, { STUDIO_OPENAI_ENV: 'inert-render-test.env', STUDIO_MAP_RENDER_MODEL: 'deepseek-flash', STUDIO_MAP_GLOBAL_MODEL: 'gpt-6.1-sol' });
  const fromFile = await host.open(env);
  assert.deepEqual([fromFile.describe().globalModel, fromFile.describe().globalProvider], ['gpt-6.1-sol', 'openai']);
  await fromFile.close();
  await assert.rejects(host.open({ STUDIO_MAP_GLOBAL_MODEL: 'gpt-unknown' }), /^Error: Invalid map global model configuration$/);
  const again = await host.open(); assert.equal(again.ready(), true); await again.close();
});

test('unsupported host render configuration releases its exclusive store owner before a valid restart', async t => {
  const host = await hostFixture(t);
  for (const renderModel of ['gpt-unknown', 'deepseek-other']) {
    await assert.rejects(host.open({ STUDIO_MAP_RENDER_MODEL: renderModel }), /^Error: Invalid map render model configuration$/);
    const pipeline = await host.open();
    assert.equal(pipeline.ready(), true, 'invalid configuration must close the store owner instead of leaving STORE_BUSY');
    assert.equal(pipeline.describe().durable, true);
    await pipeline.close();
  }
});

test('render-model host choices bind separate first/later recipes and inherit private-file selection', async t => {
  const host = await hostFixture(t);
  const env = await loadMapPipelineEnv({ STUDIO_OPENAI_ENV: 'inert-render-test.env' }, async () => 'STUDIO_MAP_RENDER_MODEL=gpt-6.1-terra');
  const terra = await host.open(env), terraIds = [terra.identity, terra.laterIdentity];
  await terra.close();
  const deepseek = await host.open({ STUDIO_MAP_RENDER_MODEL: 'deepseek-flash' });
  assert.notEqual(deepseek.identity, terraIds[0]);
  assert.notEqual(deepseek.laterIdentity, terraIds[1]);
  assert.notEqual(terraIds[0], terraIds[1]);
});

test('actual host HTTP metadata and the client parser preserve the selected DeepSeek bound for first and later maps', async t => {
  const host = await hostFixture(t);
  const jobsDir = mkdtempSync(join(tmpdir(), 'af-render-status-'));
  const jobs = await openMapJobs({ dir: jobsDir });
  t.after(async () => { await jobs.close(); const { rm } = await import('node:fs/promises'); await rm(jobsDir, { recursive: true, force: true }); });
  // Recipe .47: a first map reads up to 24 partitions (a whole folded v5 record), a later map 12; each family says its own bound.
  for (const [renderModel, bound, first] of [['gpt-6.1-terra', 24, 48], ['deepseek-flash', 64, 76]]) {
    const pipeline = await host.open({ STUDIO_MAP_RENDER_MODEL: renderModel });
    const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: inert }, jobs, firstMapPipeline: pipeline,
      fetchImpl: async () => assert.fail('reading status must not call a provider') });
    const status = await invoke(handle, 'status');
    assert.equal(status.map.first.deepseekMaxCalls, first);
    assert.equal(status.map.later.deepseekMaxCalls, bound);
    assert.deepEqual([status.map.first.partitions, status.map.later.partitions], [24, 12]);
    globalThis.fetch = async () => json(status);
    const parsed = await aiStatus();
    assert.equal(parsed.map.first.deepseekMaxCalls, first);
    assert.equal(parsed.map.later.deepseekMaxCalls, bound);
    await pipeline.close();
  }
});

test('a missing or invalid optional DeepSeek bound keeps a safe legacy allowance', async () => {
  const s = await service();
  try {
    const original = await invoke(s.handle, 'status');
    for (const bound of [undefined, null, '12', -1, 0, 12.5, Infinity, 1000000]) {
      const status = structuredClone(original);
      for (const capability of ['first', 'later']) {
        delete status.map[capability].deepseekMaxCalls;
        if (bound !== undefined) status.map[capability].deepseekMaxCalls = bound;
      }
      globalThis.fetch = async () => json(status);
      const parsed = await aiStatus();
      assert.equal(parsed.map.first.deepseekMaxCalls, 76);
      assert.equal(parsed.map.later.deepseekMaxCalls, 76);
    }
  } finally { await s.jobs.close(); }
});

// ---- first-map-divided.6: set-aside reasons travel beside the applicable wire, from the pipeline to the saved reading ----
function dividedResult(ask) {
  const at = ask.records[0].spans.map(span => span.s);
  const raw = { ...wire(), summary: '저장 요구와 미구현을 읽었다.', parts: [{ ref: 'new:save', name: '저장', parent: null, role: '결과를 파일로 저장한다.', roleAbout: null, roleReplaces: null,
    basis: [at[0]], claims: [{ key: 's1', kind: 'want', text: '결과를 파일로 저장하기를 원함', at: at[0], about: null, replaces: null },
      { key: 's2', kind: 'describes', text: '없는 구간의 주장', at: 'N01.99', about: null, replaces: null }] }] };
  const exclusions = structuredClone(M.readingExclusions(M.validateMapReply(structuredClone(raw), ask, { setAside: true })));
  const clean = structuredClone(raw); clean.parts[0].claims.splice(1, 1);
  return { wire: clean, exclusions };
}

test('a divided first-map job keeps its set-aside reasons beside the wire in the ready result', async () => {
  const s = await service(); s.divided.read = async ask => { s.divided.calls.push(ask); return dividedResult(ask); };
  try {
    const job = await submission(project(false), firstPrompt, dividedModel, M.MAP6_SCHEMA);
    assert.equal((await invoke(s.handle, 'jobs', job.body, job.cap)).status, 202);
    const done = await ended(s.handle, job);
    assert.equal(done.state, 'ready'); assert.equal(s.divided.calls.length, 1);
    assert.deepEqual(done.result.exclusions.map(x => [x.path, x.rule]), [['parts[0].claims[1].at', 'reference']]);
    assert.equal(M.validateMapReply(done.result.wire, J.decodeMapInput(job.body.input).ask).parts[0].claims.length, 1);
  } finally { await s.jobs.close(); }
});

test('the browser applies a divided result under plain map.6, saves its checked reasons, and discards altered ones', async () => {
  const status = { ai: 'deepseek', model: baseModel, access: 'open', jobs: { durable: true, problem: null },
    map: { model: baseModel, prompt: await mapPromptId(), first: { model: dividedModel, prompt: firstPrompt, ready: true, method: 'divided', monthlyUsd: 20, runUsd: 1 } } };
  for (const tamper of [false, true]) {
    const out = await clientRequest(project(false), status, async ({ body, url }) => {
      if (url.endsWith('/ack')) return json({ version: 'map-job.1', id: 'unused', state: 'ready' });
      const ask = J.decodeMapInput(body.input).ask, result = dividedResult(ask);
      if (tamper) result.exclusions[0].explanation = '모델이 쓴 다른 설명';
      return json({ version: 'map-job.1', id: body.id, binding: body.binding, bindingHash: await J.jobHash(body.binding), state: 'ready', input: body.input, acked: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), error: null, remote: null,
        result: { model: dividedModel, prompt: body.binding.prompt, askHash: body.binding.askHash, ...result,
          evidence: { index: SPAN_INDEX, ask: textDigest(JSON.stringify(ask)) }, reading: { id: `R_${crypto.randomUUID()}`, at: new Date().toISOString() } } });
    });
    try {
      if (tamper) { assert.equal(out.commits(), 0); assert.ok(out.sent.some(x => x.url.endsWith('/ack') && x.body.outcome === 'discarded')); continue; }
      assert.equal(out.commits(), 1);
      const reading = out.committed[0].readings.at(-1);
      assert.equal(reading.parts[0].claims.length, 1);
      assert.deepEqual(reading.exclusions.map(x => [x.path, x.rule, x.explanation]), [['parts[0].claims[1].at', 'reference', '이번에 보낸 부분이나 원문 구간을 찾을 수 없어 제외했어요.']]);
      assert.match(out.run.detail().notice ?? '', /제외 사유 1건/);
    } finally { out.run.dispose(); }
  }
});
