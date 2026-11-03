import test from 'node:test';
import assert from 'node:assert/strict';
import { callMapProvider, MAP_BACKGROUND_AFTER_MS } from '../server/map-provider.mjs';
import { ApiError } from '../../server/errors.mjs';

// Background mode: a call allowed longer than MAP_BACKGROUND_AFTER_MS POSTs once (background: true, store: true), then polls
// GET /v1/responses/{id}; on a deadline or a cancellation it POSTs /v1/responses/{id}/cancel. Only the first POST is paid.
const key = 'sk-test-private-key';
const RESPONSES = 'https://api.openai.com/v1/responses';
const id = 'resp_abc123';
const options = { provider: 'openai', apiKey: key, model: 'gpt-6.1-sol', system: 'Plan.', input: 'source', timeoutMs: 600000, pollMs: 0 };
const usageRaw = { input_tokens: 300, output_tokens: 1800, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 1500 } };
const pending = status => ({ id, object: 'response', status, background: true, output: [], usage: null, error: null, incomplete_details: null });
const completed = (patch = {}) => ({ id, object: 'response', status: 'completed', background: true, error: null, incomplete_details: null,
  output: [{ type: 'reasoning', summary: [] }, { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '{"parts":[]}' }] }],
  usage: usageRaw, ...patch });
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const code = expected => error => error instanceof ApiError && error.code === expected;
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise(resolve => setImmediate(resolve)); };

/** A scripted fetch: the POST answers `post`, each GET takes the next of `polls`, the cancel answers `cancel`. */
function scripted({ post = pending('queued'), polls = [], cancel = pending('cancelled') } = {}) {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, method: init.method, body: init.body === undefined ? undefined : JSON.parse(init.body), auth: init.headers.Authorization });
    if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (url === RESPONSES && init.method === 'POST') return typeof post === 'function' ? post() : json(post);
    if (url === `${RESPONSES}/${id}/cancel` && init.method === 'POST') return typeof cancel === 'function' ? cancel() : json(cancel);
    if (url === `${RESPONSES}/${id}` && init.method === 'GET') {
      const next = polls.shift();
      if (next === undefined) return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }));
      return typeof next === 'function' ? next() : json(next);
    }
    throw new Error(`unexpected ${init.method} ${url}`);
  };
  return { requests, fetchImpl };
}

test('a call over the background threshold POSTs background+store, polls queued → in_progress ×2 → completed, and charges its usage', async () => {
  const { requests, fetchImpl } = scripted({ polls: [pending('in_progress'), pending('in_progress'), completed()] });
  const events = [];
  const result = await callMapProvider({ ...options, fetchImpl,
    onDispatch: details => { events.push(['dispatch', details.resume]); },
    onQueued: ({ id: queued }) => { events.push(['queued', queued]); },
    onUsage: usage => { events.push(['usage', usage]); } });
  assert.deepEqual(result, { value: { parts: [] }, provider: 'openai', model: options.model,
    usage: { inputTokens: 300, outputTokens: 1800, cachedInputTokens: 0, reasoningTokens: 1500 } });
  assert.deepEqual(events, [['dispatch', undefined], ['queued', id], ['usage', result.usage]]);
  assert.deepEqual(requests.map(r => `${r.method} ${r.url}`), [`POST ${RESPONSES}`, ...Array(3).fill(`GET ${RESPONSES}/${id}`)]);
  const body = requests[0].body;
  assert.equal(body.background, true); assert.equal(body.store, true); assert.equal(body.stream, false);
  assert.deepEqual(body.reasoning, { effort: 'high' }); assert.equal(body.max_output_tokens, 8192);
  assert.ok(requests.every(r => r.auth === `Bearer ${key}`));
  assert.ok(requests.slice(1).every(r => r.body === undefined));
});

test('a call at or under the threshold keeps the direct non-background POST with store: false', async () => {
  const { requests, fetchImpl } = scripted({ post: completed() });
  await callMapProvider({ ...options, timeoutMs: MAP_BACKGROUND_AFTER_MS, fetchImpl });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.store, false); assert.equal(requests[0].body.background, undefined);
});

test('a background POST that already answers completed is parsed without polling', async () => {
  const { requests, fetchImpl } = scripted({ post: completed() });
  const queued = [];
  const result = await callMapProvider({ ...options, fetchImpl, onQueued: x => queued.push(x) });
  assert.deepEqual(result.value, { parts: [] }); assert.equal(requests.length, 1); assert.deepEqual(queued, []);
});

test('a poll that ends failed with usage raises AI_UNAVAILABLE and charges that usage; incomplete raises AI_RESPONSE_INCOMPLETE', async () => {
  for (const [status, expected] of [['failed', 'AI_UNAVAILABLE'], ['incomplete', 'AI_RESPONSE_INCOMPLETE'], ['cancelled', 'AI_RESPONSE_INCOMPLETE']]) {
    const end = { ...completed(), status, output: [], usage: { input_tokens: 300, output_tokens: 40 },
      ...(status === 'failed' ? { error: { code: 'server_error', message: 'private upstream text' } } : {}),
      ...(status === 'incomplete' ? { incomplete_details: { reason: 'max_output_tokens' } } : {}) };
    const { requests, fetchImpl } = scripted({ polls: [pending('in_progress'), end] });
    const charged = [];
    await assert.rejects(callMapProvider({ ...options, fetchImpl, onUsage: u => charged.push(u) }),
      error => code(expected)(error) && !String(error.message).includes('private'));
    assert.deepEqual(charged, [{ inputTokens: 300, outputTokens: 40 }]);
    assert.equal(requests.filter(r => r.url.endsWith('/cancel')).length, 0); // a terminal response needs no cancel
  }
});

test('a dropped or 5xx poll is asked again at the next interval, never re-sent; a definitive 401 poll cancels', async () => {
  let { requests, fetchImpl } = scripted({ polls: [() => { throw new TypeError('fetch failed'); }, () => new Response('busy', { status: 502 }), completed()] });
  const result = await callMapProvider({ ...options, fetchImpl });
  assert.deepEqual(result.value, { parts: [] });
  assert.equal(requests.filter(r => r.method === 'POST').length, 1);
  ({ requests, fetchImpl } = scripted({ polls: [() => new Response('no', { status: 401 })] }));
  const charged = [];
  await assert.rejects(callMapProvider({ ...options, fetchImpl, onUsage: u => charged.push(u) }), code('AI_AUTH_FAILED'));
  assert.deepEqual(requests.map(r => r.method + ' ' + r.url.slice(RESPONSES.length)), ['POST ', `GET /${id}`, `POST /${id}/cancel`]);
  assert.deepEqual(charged, []); // the generation may have run: no zero charge, the caller keeps its reservation
});

test('the deadline mid-poll sends the cancel POST and raises AI_TIMEOUT without charging when the cancel reports no usage', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { requests, fetchImpl } = scripted({ polls: [pending('in_progress')] });
  const charged = [];
  const call = callMapProvider({ ...options, pollMs: 5000, fetchImpl, onUsage: u => charged.push(u) });
  const outcome = call.then(() => 'resolved', error => error);
  await flush(); t.mock.timers.tick(5000); await flush();
  assert.deepEqual(requests.map(r => r.method + ' ' + r.url.slice(RESPONSES.length)), ['POST ', `GET /${id}`]);
  t.mock.timers.tick(5000); await flush(); // the second poll hangs until the deadline
  t.mock.timers.tick(options.timeoutMs); await flush(20);
  const error = await outcome;
  assert.ok(code('AI_TIMEOUT')(error), String(error));
  assert.deepEqual(requests.map(r => r.method + ' ' + r.url.slice(RESPONSES.length)), ['POST ', `GET /${id}`, `GET /${id}`, `POST /${id}/cancel`]);
  assert.equal(requests.at(-1).body, undefined); assert.equal(requests.at(-1).auth, `Bearer ${key}`);
  assert.deepEqual(charged, []);
});

test('a caller cancellation mid-poll cancels the response and charges the usage its cancel reports', async () => {
  const controller = new AbortController();
  const { requests, fetchImpl } = scripted({ cancel: { ...pending('cancelled'), usage: { input_tokens: 300, output_tokens: 900 } } });
  const charged = [];
  const call = callMapProvider({ ...options, signal: controller.signal, fetchImpl, onUsage: u => charged.push(u),
    onQueued: () => { setImmediate(() => controller.abort()); } });
  await assert.rejects(call, code('CANCELLED'));
  assert.equal(requests.at(-1).url, `${RESPONSES}/${id}/cancel`);
  assert.deepEqual(charged, [{ inputTokens: 300, outputTokens: 900 }]);
});

test('resume polls a kept response id at once with a GET and never POSTs a new response', async () => {
  const { requests, fetchImpl } = scripted({ polls: [completed()] });
  const dispatched = [];
  const result = await callMapProvider({ ...options, resume: id, fetchImpl, onDispatch: d => dispatched.push(d.resume) });
  assert.deepEqual(result.value, { parts: [] });
  assert.deepEqual(dispatched, [id]);
  assert.deepEqual(requests.map(r => `${r.method} ${r.url}`), [`GET ${RESPONSES}/${id}`]);
  for (const bad of ['../x', '', 'a b']) await assert.rejects(callMapProvider({ ...options, resume: bad, fetchImpl }), code('AI_CONFIG_REJECTED'));
  await assert.rejects(callMapProvider({ ...options, provider: 'deepseek', resume: id, fetchImpl }), code('AI_CONFIG_REJECTED'));
});

test('a queued POST without a usable id, or a poll for another id, is refused and never polled blind', async () => {
  let { requests, fetchImpl } = scripted({ post: { ...pending('queued'), id: 'bad id/..' } });
  await assert.rejects(callMapProvider({ ...options, fetchImpl }), code('INVALID_RESPONSE'));
  assert.equal(requests.length, 1);
  ({ requests, fetchImpl } = scripted({ polls: [{ ...completed(), id: 'resp_other' }] }));
  await assert.rejects(callMapProvider({ ...options, fetchImpl }), code('INVALID_RESPONSE'));
  assert.equal(requests.at(-1).url, `${RESPONSES}/${id}/cancel`);
});

test('a background call settles within the cancel bound even when the transport ignores the abort', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const controller = new AbortController(), requests = [];
  const fetchImpl = async (url, init) => {
    requests.push(`${init.method} ${url}`);
    if (init.method === 'POST' && url === RESPONSES) return json(pending('queued'));
    return new Promise(() => {}); // neither the poll nor the cancel ever answers or observes its signal
  };
  const outcome = callMapProvider({ ...options, signal: controller.signal, fetchImpl, onQueued: () => {} }).then(() => 'resolved', error => error);
  await flush(); controller.abort(); await flush();
  t.mock.timers.tick(16000); await flush();
  assert.ok(code('CANCELLED')(await outcome));
  assert.equal(requests.at(-1), `POST ${RESPONSES}/${id}/cancel`);
});
