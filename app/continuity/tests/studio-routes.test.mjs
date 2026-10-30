// Studio handler structure: the schema table that picks prompt, budget and reply reading, the shared request rules (admit) on
// every route past status, and the job route's own body limit. A fake provider and a fake job service; nothing is sent anywhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioHandler, readStudioConfig, schemaOf, segmentsUnder, studioConfigProblems, JOB_BYTES, STUDIO_PROMPT } from '../server/studio.mjs';
import { PLAN_PROMPT, PLAN2_PROMPT, PLAN3_PROMPT, SCOPE_PROMPT } from '../server/plan-prompt.mjs';
import { DIGEST_PROMPT, DIGEST2_PROMPT } from '../server/digest-prompt.mjs';
import { MAP_PROMPT, MAP2_PROMPT, MAP3_PROMPT } from '../server/map-prompt.mjs';

test('ROUTES-S1 every schema the validators accept has its own entry; anything else reads as /ask', () => {
  const fixed = { 'studio.plan.1': PLAN_PROMPT, 'studio.plan.2': PLAN2_PROMPT, 'studio.plan.3': PLAN3_PROMPT, 'studio.scope.1': SCOPE_PROMPT,
    'studio.digest.1': DIGEST_PROMPT, 'studio.digest.2': DIGEST2_PROMPT, 'studio.map.1': MAP_PROMPT, 'studio.map.2': MAP2_PROMPT, 'studio.map.3': MAP3_PROMPT };
  for (const [schemaVersion, prompt] of Object.entries(fixed)) assert.equal(schemaOf({ schemaVersion }).system(), prompt, schemaVersion);
  const kinds = v => schemaOf({ schemaVersion: v }).kind;
  assert.deepEqual(['studio.plan.1', 'studio.scope.1', 'studio.digest.2', 'studio.map.7', 'studio.1'].map(kinds), ['plan', 'scope', 'digest', 'map', 'ask']);
  assert.deepEqual(['studio.map.3', 'studio.map.4', 'studio.map.5', 'studio.map.6', 'studio.map.7'].map(v => !!schemaOf({ schemaVersion: v }).anchored), [false, true, true, true, true]);
  assert.equal(schemaOf({ schemaVersion: 'studio.map.7' }).bounded, true);
  for (const odd of [undefined, null, {}, { schemaVersion: '__proto__' }, { schemaVersion: 'toString' }]) assert.equal(schemaOf(odd).system(), STUDIO_PROMPT);
});

test('ROUTES-S2 segmentsUnder matches a prefix and what is below it, never a longer name', () => {
  assert.deepEqual(segmentsUnder('/api/studio/jobs', '/api/studio/jobs'), []);
  assert.deepEqual(segmentsUnder('/api/studio/jobs/', '/api/studio/jobs'), []);
  assert.deepEqual(segmentsUnder('/api/studio/jobs/MJ_1/ack', '/api/studio/jobs'), ['MJ_1', 'ack']);
  assert.equal(segmentsUnder('/api/studio/jobsx', '/api/studio/jobs'), null);
  assert.equal(segmentsUnder('/api/studio/map', '/api/studio/jobs'), null);
});

const BASE = 'http://127.0.0.1:4317';
const fakeJobs = () => {
  const seen = [];
  return { seen, describe: () => ({ durable: true }), handle: async (op) => { seen.push(op); return { status: 200, value: { ok: true } }; } };
};
const jobRequest = (path, { method = 'POST', headers = {}, body } = {}) => new Request(`${BASE}${path}`, { method, body, duplex: 'half',
  headers: { 'x-agentflow-request': '1', ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), ...headers } });

test('ROUTES-J1 job routes share the request rules in order and pass the segments below /jobs', async () => {
  const jobs = fakeJobs(), handle = createStudioHandler({ env: { STUDIO_ACCESS_CODE: 'code-1' }, jobs });
  const code = { 'x-studio-access': 'code-1' };
  assert.equal((await handle(jobRequest('/api/studio/jobs', { method: 'PUT', headers: code }))).status, 405);
  assert.equal((await handle(jobRequest('/api/studio/jobs', { headers: { ...code, 'x-agentflow-request': '0' }, body: '{}' }))).status, 403);
  assert.equal((await handle(jobRequest('/api/studio/jobs', { headers: { ...code, 'content-type': 'text/plain' }, body: '{}' }))).status, 415);
  assert.equal((await handle(jobRequest('/api/studio/jobs', { body: '{}' }))).status, 401);
  assert.equal(jobs.seen.length, 0, 'nothing reaches the job service before the rules pass');
  assert.equal((await handle(jobRequest('/api/studio/jobs/MJ_x/ack', { headers: code, body: '{"outcome":"seen"}' }))).status, 200);
  assert.equal((await handle(jobRequest('/api/studio/jobs/MJ_x', { method: 'GET', headers: code }))).status, 200);
  assert.deepEqual(jobs.seen.map(o => [o.method, o.rest, o.body]), [['POST', ['MJ_x', 'ack'], '{"outcome":"seen"}'], ['GET', ['MJ_x'], null]]);
});

test('ROUTES-J2 a job body past JOB_BYTES is INPUT_TOO_LARGE, also when no Content-Length announces it', async () => {
  const jobs = fakeJobs(), handle = createStudioHandler({ jobs });
  const big = 'x'.repeat(JOB_BYTES + 1);
  const declared = await handle(jobRequest('/api/studio/jobs/MJ_x/ack', { headers: { 'content-length': String(big.length) }, body: big }));
  assert.equal(declared.status, 413);
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } });
  const streamed = await handle(jobRequest('/api/studio/jobs/MJ_x/ack', { body: stream }));
  assert.deepEqual([streamed.status, (await streamed.json()).error.code], [413, 'INPUT_TOO_LARGE']);
  assert.equal(jobs.seen.length, 0);
});

test('ROUTES-R1 reading routes refuse an unknown path, a wrong method and a missing key with stable codes', async () => {
  const handle = createStudioHandler({ env: {} });
  const ask = (path, method = 'POST') => handle(new Request(`${BASE}${path}`, { method, headers: { 'x-agentflow-request': '1', 'content-type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) }));
  assert.equal((await ask('/api/studio/nothing')).status, 404);
  assert.equal((await ask('/api/studio/__proto__')).status, 404);
  assert.equal((await ask('/api/studio/ask', 'GET')).status, 405);
  const r = await ask('/api/studio/plan');
  assert.deepEqual([r.status, (await r.json()).error.code], [400, 'INVALID_INPUT'], 'input is judged before the key');
});

test('ROUTES-X1 session routes: GET only, same origin only (even a listed one), then the shared rules', async () => {
  const seen = [], sessions = { describe: () => ({ readable: true }), list: async f => { seen.push(['list', f]); return { sessions: [] }; }, read: async (id, o) => { seen.push(['read', id, o.since]); return { id }; } };
  const handle = createStudioHandler({ env: { STUDIO_ALLOWED_ORIGINS: 'https://ui.example' }, sessions });
  const get = (path, headers = {}, method = 'GET') => handle(new Request(`${BASE}${path}`, { method, headers: { 'x-agentflow-request': '1', ...headers } }));
  assert.equal((await get('/api/studio/sessions', { origin: 'https://ui.example' }, 'POST')).status, 405, 'the method is judged first');
  assert.equal((await get('/api/studio/sessions', { origin: 'https://ui.example' })).status, 403, 'a listed other origin never reads these files');
  assert.equal((await get('/api/studio/sessions', { 'x-agentflow-request': '0' })).status, 403);
  assert.equal((await get('/api/studio/sessions/a/b')).status, 404);
  assert.equal((await get('/api/studio/sessions/%E0%A4%A')).status, 404);
  assert.equal((await get('/api/studio/sessions/s1?since=never')).status, 400);
  assert.equal((await get('/api/studio/sessions?folder=C%3A%5Cwork')).status, 200);
  assert.equal((await get('/api/studio/sessions/s%201?since=2026-10-30T00:00:00Z')).status, 200);
  assert.deepEqual(seen, [['list', 'C:\\work'], ['read', 's 1', '2026-10-30T00:00:00Z']]);
  assert.deepEqual((await (await get('/api/studio/status')).json()).sessions, { readable: true });
});

test('ROUTES-C1 settings that are set aside are named, fall back whole, and an unset one is never a problem', () => {
  const env = { STUDIO_TIMEOUT_MS: '500', STUDIO_MAX_TOKENS: '2048', DEEPSEEK_MODEL: 'bad model', DEEPSEEK_PLAN_MODEL: 'plan-1', STUDIO_ALLOWED_ORIGINS: 'https://a.example, https://b.example/path',
    STUDIO_MAP_THINKING: 'maybe', STUDIO_CALL_CAP: '', STUDIO_ACCESS_CODE: 'not a problem' };
  assert.deepEqual(studioConfigProblems(env).sort(), ['DEEPSEEK_MODEL', 'STUDIO_ALLOWED_ORIGINS', 'STUDIO_MAP_THINKING', 'STUDIO_TIMEOUT_MS']);
  const c = readStudioConfig(env);
  assert.deepEqual([c.timeoutMs, c.maxTokens, c.model, c.planModel, c.origins, c.mapThinking, c.cap], [30000, 2048, 'deepseek-flash', 'plan-1', ['https://a.example'], 'enabled', 300]);
  assert.deepEqual(studioConfigProblems({}), []);
  assert.deepEqual(readStudioConfig({}), readStudioConfig());
});
