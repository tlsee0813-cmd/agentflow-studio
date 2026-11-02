import test from 'node:test';
import assert from 'node:assert/strict';
import { callMapProvider, MAP_PROVIDER_MAX_RESPONSE_BYTES } from '../server/map-provider.mjs';
import { ApiError } from '../../server/errors.mjs';

const key = 'sk-test-private-key';
const options = { provider: 'deepseek', apiKey: key, model: 'configured-model', system: 'Extract facts.', input: 'source', timeoutMs: 1000 };
const deepseek = (patch = {}) => ({
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"nodes":[]}' } }],
  usage: { prompt_tokens: 20, completion_tokens: 8, prompt_cache_hit_tokens: 3 }, ...patch,
});
const openai = (patch = {}) => ({
  status: 'completed', incomplete_details: null,
  output: [{ type: 'reasoning', summary: [] }, { type: 'message', role: 'assistant', status: 'completed',
    content: [{ type: 'output_text', text: '{"nodes":' }, { type: 'output_text', text: '[]}' }] }],
  usage: { input_tokens: 30, output_tokens: 18, input_tokens_details: { cached_tokens: 5 }, output_tokens_details: { reasoning_tokens: 10 } }, ...patch,
});
const response = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const code = expected => error => error instanceof ApiError && error.code === expected && error.message === expected;
const invoke = (raw, extra = {}) => callMapProvider({ ...options, fetchImpl: async () => response(raw), ...extra });

test('DeepSeek uses a fixed official endpoint, JSON mode, disabled thinking and a dispatch reservation', async () => {
  const events = [];
  const result = await callMapProvider({ ...options, maxOutputTokens: 1234,
    onDispatch: async details => { assert.equal(details.maxOutputTokens, 1234); events.push('dispatch'); },
    onUsage: usage => { assert.equal(usage.inputTokens, 20); events.push('usage'); },
    fetchImpl: async (url, init) => {
      events.push('fetch');
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(init.redirect, 'manual');
      assert.equal(init.headers.Authorization, `Bearer ${key}`);
      const body = JSON.parse(init.body);
      assert.equal(body.model, options.model);
      assert.deepEqual(body.thinking, { type: 'disabled' });
      assert.equal(body.reasoning_effort, undefined);
      assert.deepEqual(body.response_format, { type: 'json_object' });
      assert.equal(body.max_tokens, 1234);
      assert.match(body.messages[0].content, /JSON/);
      assert.equal(body.messages[1].content, options.input);
      return response(deepseek());
    },
  });
  assert.deepEqual(events, ['dispatch', 'fetch', 'usage']);
  assert.deepEqual(result, { value: { nodes: [] }, usage: { inputTokens: 20, outputTokens: 8, cachedInputTokens: 3 }, provider: 'deepseek', model: options.model });
});

test('DeepSeek thinking is enabled only by explicit low reasoning', async () => {
  for (const reasoning of ['low', 'high', undefined]) {
    await invoke(deepseek(), { reasoning, fetchImpl: async (_, init) => {
      const body = JSON.parse(init.body);
      assert.deepEqual(body.thinking, { type: reasoning === 'low' ? 'enabled' : 'disabled' });
      assert.equal(body.reasoning_effort, reasoning === 'low' ? 'low' : undefined);
      return response(deepseek());
    } });
  }
});

test('OpenAI Responses uses configured model, high reasoning, no storage and output_text blocks', async () => {
  const result = await invoke(openai(), { provider: 'openai', maxOutputTokens: 4000, fetchImpl: async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(init.redirect, 'manual');
    const body = JSON.parse(init.body);
    assert.equal(body.model, options.model);
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 4000);
    assert.deepEqual(body.reasoning, { effort: 'high' });
    assert.deepEqual(body.text, { format: { type: 'json_object' } });
    assert.equal(body.input, `Return JSON for this input:\n${options.input}`);
    return response(openai());
  } });
  assert.deepEqual(result.value, { nodes: [] });
  assert.deepEqual(result.usage, { inputTokens: 30, outputTokens: 18, cachedInputTokens: 5, reasoningTokens: 10 });
});

test('onDispatch can reject before any request and is never retried', async () => {
  let calls = 0;
  await assert.rejects(invoke(deepseek(), { onDispatch: () => { throw new ApiError('MAP_BUDGET_EXCEEDED', 429); }, fetchImpl: () => { calls++; } }), code('MAP_BUDGET_EXCEEDED'));
  assert.equal(calls, 0);
});

test('DeepSeek length and non-stop output remain incomplete even with valid JSON and billing usage', async () => {
  for (const finish_reason of ['length', 'content_filter', null]) {
    const billed = [];
    await assert.rejects(invoke(deepseek({ choices: [{ finish_reason, message: { role: 'assistant', content: '{}' } }] }), { onUsage: usage => billed.push(usage) }), code('AI_RESPONSE_INCOMPLETE'));
    assert.equal(billed.length, 1);
  }
});

test('Responses incomplete status/details/message status cannot be repaired by valid JSON', async () => {
  for (const raw of [openai({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }),
    openai({ status: 'in_progress' }), openai({ incomplete_details: { reason: 'content_filter' } }),
    openai({ output: [{ ...openai().output[1], status: 'incomplete' }] })]) {
    let billed = 0;
    await assert.rejects(invoke(raw, { provider: 'openai', onUsage: () => { billed++; } }), code('AI_RESPONSE_INCOMPLETE'));
    assert.equal(billed, 1);
  }
});

test('missing usage on incomplete output does not hide the incomplete error', async () => {
  let billed = 0;
  await assert.rejects(invoke(openai({ status: 'incomplete', usage: undefined }), { provider: 'openai', onUsage: () => { billed++; } }), code('AI_RESPONSE_INCOMPLETE'));
  assert.equal(billed, 0);
});

test('usage hook failures cannot hide provider validation errors', async () => {
  await assert.rejects(invoke(deepseek({ choices: [{ finish_reason: 'length' }] }), { onUsage: () => { throw new Error('billing unavailable'); } }), code('AI_RESPONSE_INCOMPLETE'));
  await assert.rejects(invoke(deepseek({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'bad' } }] }), { onUsage: () => { throw new Error('billing unavailable'); } }), code('INVALID_RESPONSE'));
});

test('missing or invalid usage refuses completed output rather than inventing zero usage', async () => {
  for (const usage of [undefined, {}, { prompt_tokens: -1, completion_tokens: 8 },
    { prompt_tokens: 2, completion_tokens: 8, prompt_cache_hit_tokens: 3 }, { prompt_tokens: 20, completion_tokens: 1.5 }]) {
    await assert.rejects(invoke(deepseek({ usage })), code('INVALID_RESPONSE'));
  }
});

test('Responses requires exactly one completed assistant message and refuses tools/refusals', async () => {
  const message = openai().output[1];
  for (const output of [[], [message, message], [{ type: 'function_call', arguments: '{}' }, message],
    [{ ...message, role: 'user' }], [{ ...message, content: [{ type: 'refusal', refusal: 'no' }] }],
    [{ ...message, content: [] }], [{ ...message, content: [{ type: 'output_text', text: '{}' }, { type: 'refusal', refusal: 'no' }] }]]) {
    await assert.rejects(invoke(openai({ output }), { provider: 'openai' }), code('INVALID_RESPONSE'));
  }
  await assert.rejects(invoke(openai({ status: undefined }), { provider: 'openai' }), code('INVALID_RESPONSE'));
});

test('DeepSeek refuses multiple choices, tools, refusals, and non-object or non-JSON content', async () => {
  const choice = deepseek().choices[0];
  for (const choices of [[], [choice, choice], [{ ...choice, message: { ...choice.message, tool_calls: [{ id: 'x' }] } }],
    [{ ...choice, message: { ...choice.message, refusal: 'no' } }], ...['[]', 'null', '42', '```json\n{}\n```', '{} {}', ' ']
      .map(content => [{ ...choice, message: { role: 'assistant', content } }])]) {
    await assert.rejects(invoke(deepseek({ choices })), code('INVALID_RESPONSE'));
  }
});

test('raw and escaped API key echoes are rejected without response details', async () => {
  const escaped = [...key].map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
  for (const content of [JSON.stringify({ leaked: key }), `{"leaked":"${escaped}"}`, `{"${escaped}":"value"}`]) {
    await assert.rejects(invoke(deepseek({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }] })), error => {
      assert.equal(error.code, 'INVALID_RESPONSE');
      assert.equal(error.message.includes(key), false);
      return true;
    });
  }
});

test('redirect and HTTP errors cancel bodies and do not retry, follow, or expose their contents', async () => {
  for (const [status, expected] of [[302, 'AI_CONFIG_REJECTED'], [401, 'AI_AUTH_FAILED'], [402, 'AI_BALANCE_REQUIRED'], [429, 'AI_RATE_LIMIT'], [500, 'AI_UNAVAILABLE']]) {
    let calls = 0, cancels = 0;
    await assert.rejects(callMapProvider({ ...options, fetchImpl: async (_, init) => {
      calls++; assert.equal(init.redirect, 'manual');
      return new Response(new ReadableStream({ cancel() { cancels++; } }), { status, headers: { location: 'https://untrusted.example' } });
    } }), code(expected));
    assert.equal(calls, 1); assert.equal(cancels, 1);
  }
});

test('OpenAI JSON mode includes JSON in the input message and preserves the original source bytes after the prefix', async () => {
  const input = '한국어 원문\r\n공백  보존\n🙂 끝 철회';
  await invoke(openai(), { provider: 'openai', input, fetchImpl: async (_, init) => {
    const body = JSON.parse(init.body), prefix = 'Return JSON for this input:\n';
    assert.equal(body.input.startsWith(prefix), true);
    assert.deepEqual(new TextEncoder().encode(body.input.slice(prefix.length)), new TextEncoder().encode(input));
    return response(openai());
  } });
});

test('definite HTTP pre-execution rejections report zero usage once without parsing or leaking the provider body', async () => {
  for (const provider of ['openai', 'deepseek']) for (const [status, expected] of [
    [400, 'AI_CONFIG_REJECTED'], [401, 'AI_AUTH_FAILED'], [403, 'AI_AUTH_FAILED'], [404, 'AI_CONFIG_REJECTED'],
    [422, 'AI_CONFIG_REJECTED'], [429, 'AI_RATE_LIMIT'],
  ]) {
    const billed = []; let cancels = 0;
    await assert.rejects(callMapProvider({ ...options, provider, onUsage: usage => billed.push(usage),
      fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancels++; } }), { status }),
    }), code(expected));
    assert.deepEqual(billed, [{ inputTokens: 0, outputTokens: 0 }]);
    assert.equal(cancels, 1);
  }
});

test('server errors, redirects, and network failures retain unknown usage', async () => {
  for (const status of [302, 402, 500, 502, 503, 504]) {
    let billed = 0;
    await assert.rejects(callMapProvider({ ...options, onUsage: () => { billed++; }, fetchImpl: async () => new Response('private upstream details', { status }) }));
    assert.equal(billed, 0);
  }
  let billed = 0;
  await assert.rejects(callMapProvider({ ...options, onUsage: () => { billed++; }, fetchImpl: () => { throw new Error('private upstream details'); } }), code('AI_NETWORK_ERROR'));
  assert.equal(billed, 0);
});

test('zero-usage callback failures do not hide a definite provider rejection', async () => {
  await assert.rejects(callMapProvider({ ...options, onUsage: () => { throw new Error('accounting failure'); },
    fetchImpl: async () => new Response(`private ${key}`, { status: 400 }),
  }), code('AI_CONFIG_REJECTED'));
});

test('body size is bounded on streamed bytes even without content-length', async () => {
  let cancels = 0;
  await assert.rejects(callMapProvider({ ...options, fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(MAP_PROVIDER_MAX_RESPONSE_BYTES)); controller.enqueue(new Uint8Array(1)); },
    cancel() { cancels++; },
  })) }), code('INVALID_RESPONSE'));
  assert.equal(cancels, 1);
});

test('oversized content-length is refused before the body is read', async () => {
  let cancels = 0, reads = 0;
  await assert.rejects(callMapProvider({ ...options, fetchImpl: async () => ({ ok: true, status: 200,
    headers: new Headers({ 'content-length': String(MAP_PROVIDER_MAX_RESPONSE_BYTES + 1) }),
    body: { cancel() { cancels++; }, getReader() { reads++; throw new Error(); } },
  }) }), code('INVALID_RESPONSE'));
  assert.equal(cancels, 1); assert.equal(reads, 0);
});

test('malformed wire JSON and UTF-8 are INVALID_RESPONSE', async () => {
  for (const body of ['not JSON', new Uint8Array([0xc3, 0x28])]) {
    await assert.rejects(callMapProvider({ ...options, fetchImpl: async () => new Response(body) }), code('INVALID_RESPONSE'));
  }
});

test('pre-cancelled requests do not dispatch', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await assert.rejects(invoke(deepseek(), { signal: controller.signal, onDispatch: () => { calls++; } }), code('CANCELLED'));
  assert.equal(calls, 0);
});

test('caller cancellation settles promptly even when fetch ignores abort', async () => {
  const controller = new AbortController();
  let upstreamSignal;
  const pending = callMapProvider({ ...options, signal: controller.signal, fetchImpl: (_, init) => {
    upstreamSignal = init.signal; return new Promise(() => {});
  } });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, code('CANCELLED'));
  assert.equal(upstreamSignal.aborted, true);
});

test('deadline settles promptly even when fetch ignores abort', async () => {
  let upstreamSignal;
  await assert.rejects(callMapProvider({ ...options, timeoutMs: 15, fetchImpl: (_, init) => {
    upstreamSignal = init.signal; return new Promise(() => {});
  } }), code('AI_TIMEOUT'));
  assert.equal(upstreamSignal.aborted, true);
});

test('deadline also covers a stalled response body and cancels its reader', async () => {
  let cancels = 0;
  await assert.rejects(callMapProvider({ ...options, timeoutMs: 15, fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel() { cancels++; },
  })) }), code('AI_TIMEOUT'));
  assert.equal(cancels, 1);
});

test('a late fetch response after timeout is cancelled and never billed or validated', async () => {
  let resolveFetch, cancels = 0, billed = 0;
  const pending = callMapProvider({ ...options, timeoutMs: 15, onUsage: () => { billed++; },
    fetchImpl: () => new Promise(resolve => { resolveFetch = resolve; }),
  });
  await assert.rejects(pending, code('AI_TIMEOUT'));
  resolveFetch(new Response(new ReadableStream({ cancel() { cancels++; } })));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cancels, 1); assert.equal(billed, 0);
});

test('timeout during an asynchronous reservation never dispatches a late paid request', async () => {
  let release, calls = 0;
  const pending = callMapProvider({ ...options, timeoutMs: 15,
    onDispatch: () => new Promise(resolve => { release = resolve; }),
    fetchImpl: () => { calls++; return response(deepseek()); },
  });
  await assert.rejects(pending, code('AI_TIMEOUT'));
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 0);
});

test('a billing hook failure on valid output propagates so the caller cannot assume accounting succeeded', async () => {
  await assert.rejects(invoke(deepseek(), { onUsage: () => { throw new ApiError('MAP_BUDGET_EXCEEDED', 429); } }), code('MAP_BUDGET_EXCEEDED'));
});

test('caller abort during a stalled body preserves CANCELLED', async () => {
  const controller = new AbortController(); let cancels = 0;
  const pending = callMapProvider({ ...options, signal: controller.signal, fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancels++; } })) });
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  await assert.rejects(pending, code('CANCELLED'));
  assert.equal(cancels, 1);
});

test('network errors are safe and are not retried', async () => {
  let calls = 0;
  await assert.rejects(callMapProvider({ ...options, fetchImpl: () => { calls++; throw new Error(`secret ${key}`); } }), code('AI_NETWORK_ERROR'));
  assert.equal(calls, 1);
});

test('invalid provider configuration is refused before dispatch', async () => {
  let calls = 0;
  for (const extra of [{ provider: 'unknown' }, { model: '' }, { maxOutputTokens: 0 }, { timeoutMs: 0 }, { reasoning: 'automatic' }]) {
    await assert.rejects(invoke(deepseek(), { ...extra, onDispatch: () => { calls++; } }), code('AI_CONFIG_REJECTED'));
  }
  await assert.rejects(invoke(deepseek(), { apiKey: '' }), code('AI_NOT_CONFIGURED'));
  assert.equal(calls, 0);
});
