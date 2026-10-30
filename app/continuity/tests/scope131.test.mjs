// AF131 the scope review takes the plan's budget and timer: 8192 tokens and planTimeoutMs (its fallback to timeoutMs kept), with
// thinking low, its own prompt, input and checks unchanged. Controlled fetch only: no provider is called and nothing here says a
// real review now finishes within 8192 tokens (that needs a separate observation). Timers are node:test mock timers, never a
// real wait.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createStudioHandler, callStudioModel } from '../server/studio.mjs';
import { PLAN3_PROMPT, SCOPE_PROMPT } from '../server/plan-prompt.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
const evidence = [{ id: 'E1', kind: 'user', title: '구상', text: '실패한 파일과 이유를 모아 보여 주세요.', basis: '작성 표본' }];
const scopeAsk = () => ({ schemaVersion: 'studio.scope.1', intent: '실패 모아 보기', parts: [{ id: 'P1', name: '결과', note: '', parentId: null }], evidence,
  selected: [{ id: 'I1', title: '실패 모아 보기', description: '실패와 이유를 보여 주세요.', partIds: ['P1'], refs: ['E1'] }], excluded: [] });
const review = { summary: '[작성 표본] 기존 결과를 재사용한다.', prerequisites: [], unknowns: [] };
const reply = (content, finish = 'stop') => Response.json({ choices: [{ finish_reason: finish, message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] });

test('131 scope route: the plan budget (8192, thinking low) with the same prompt, input and model; one call', async () => {
  assert.equal(sha(SCOPE_PROMPT), 'b56c507bda06cc1bdb052bc70546f77d427e066af84f5a6b7480428bf844a9db'); // 133: its evidence-time rule (131 sent 00cf7462)
  assert.equal(sha(PLAN3_PROMPT), 'aacb45c30be76c620da3503ed806c809a520c772c36412982d7dff8b69443a7a');
  const sent = [], body = scopeAsk();
  const handler = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'scope131-server-only-key', DEEPSEEK_PLAN_MODEL: 'plan-model-x' }, fetchImpl: async (url, init) => { sent.push(JSON.parse(init.body)); return reply(review); } });
  const r = await handler(new Request('https://app.test/api/studio/scope', { method: 'POST', headers: { Origin: 'https://app.test', 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' }, body: JSON.stringify(body) }));
  assert.equal(r.status, 200); assert.deepEqual((await r.json()).reply, review);
  assert.equal(sent.length, 1);
  const [b] = sent;
  assert.deepEqual(Object.keys(b).sort(), ['max_tokens', 'messages', 'model', 'reasoning_effort', 'response_format', 'stream', 'thinking']);
  assert.deepEqual([b.max_tokens, b.thinking, b.reasoning_effort, b.response_format, b.stream, b.model], [8192, { type: 'enabled' }, 'low', { type: 'json_object' }, false, 'plan-model-x']);
  assert.equal(b.messages[0].content, SCOPE_PROMPT);
  assert.equal(b.messages[1].content, `INPUT JSON (자료):\n${JSON.stringify(body)}`);
  assert.ok(!JSON.stringify(sent).includes('scope131-server-only-key'));
});

test('131 budgets of the other routes stay as they were: ask config.maxTokens unthinking, plan and digest 8192, map its own', async () => {
  const seen = async (schemaVersion, config = {}) => {
    let b; await callStudioModel({ schemaVersion }, { apiKey: 'scope131-test-key', model: 'm', maxTokens: 1200, ...config }, { fetchImpl: async (u, init) => { b = JSON.parse(init.body); return reply('', 'length'); } }).catch(() => {});
    return [b.max_tokens, b.thinking.type, b.reasoning_effort ?? null];
  };
  assert.deepEqual(await seen('studio.ask.1'), [1200, 'disabled', null]);
  for (const v of ['studio.plan.1', 'studio.plan.2', 'studio.plan.3', 'studio.digest.1', 'studio.digest.2', 'studio.scope.1']) assert.deepEqual(await seen(v), [8192, 'enabled', 'low'], v);
  assert.deepEqual(await seen('studio.map.1', { mapMaxTokens: 16384 }), [16384, 'enabled', 'low']);
});

test('131 scope waits for planTimeoutMs, not the general timeout; without one it falls back to timeoutMs as before', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    // A provider that never answers: only the timer (or a cancel) ends the call.
    const hanging = (u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }));
    const watch = (schemaVersion, config) => {
      const s = { done: null };
      s.promise = callStudioModel({ schemaVersion }, { apiKey: 'scope131-test-key', model: 'm', ...config }, { fetchImpl: hanging }).then(() => { s.done = 'resolved'; }, e => { s.done = `${e.code}/${e.status}`; });
      return s;
    };
    const settle = () => new Promise(r => setImmediate(r));
    const config = { timeoutMs: 1000, planTimeoutMs: 5000 };
    const scope = watch('studio.scope.1', config), ask = watch('studio.ask.1', config), plan = watch('studio.plan.3', config), digest = watch('studio.digest.2', config), bare = watch('studio.scope.1', { timeoutMs: 1000 });
    mock.timers.tick(999); await settle();
    assert.deepEqual([scope.done, ask.done, plan.done, digest.done, bare.done], [null, null, null, null, null]);
    mock.timers.tick(1); await ask.promise; await bare.promise; await settle();
    assert.deepEqual([ask.done, bare.done, scope.done, plan.done, digest.done], ['AI_TIMEOUT/504', 'AI_TIMEOUT/504', null, null, null], 'general timeout: ask, and scope without planTimeoutMs');
    mock.timers.tick(3999); await settle();
    assert.deepEqual([scope.done, plan.done, digest.done], [null, null, null]);
    mock.timers.tick(1); await Promise.all([scope.promise, plan.promise, digest.promise]);
    assert.deepEqual([scope.done, plan.done, digest.done], ['AI_TIMEOUT/504', 'AI_TIMEOUT/504', 'AI_TIMEOUT/504'], 'scope on the plan timer, as plan and digest');
  } finally { mock.timers.reset(); }
});

test('131 scope still takes only a finished, valid reply: length, unfinished, invalid and cancel are refused, one call each', async () => {
  const config = { apiKey: 'scope131-test-key', model: 'm', timeoutMs: 1000, planTimeoutMs: 60000 };
  for (const [response, code, status] of [
    [() => reply(review, 'length'), 'AI_RESPONSE_INCOMPLETE', 502],
    [() => reply(review, 'content_filter'), 'AI_RESPONSE_UNFINISHED', 502],
    [() => Response.json({ choices: [{ message: { content: JSON.stringify(review) } }] }), 'AI_RESPONSE_UNFINISHED', 502],
    [() => reply('{"summary":"잘림"'), 'INVALID_RESPONSE', 502],
    [() => reply({ ...review, prerequisites: [{ title: '전제', reason: '이유', refs: ['invented'] }] }), 'INVALID_RESPONSE', 502],
  ]) {
    let calls = 0;
    await assert.rejects(callStudioModel(scopeAsk(), config, { fetchImpl: async () => { calls++; return response(); } }), e => e.code === code && e.status === status, code);
    assert.equal(calls, 1, `${code}: no retry`);
  }
  const ctl = new AbortController();
  const pending = callStudioModel(scopeAsk(), config, { signal: ctl.signal, fetchImpl: (u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })) });
  ctl.abort(); await assert.rejects(pending, e => e.code === 'CANCELLED' && e.status === 499);
  const before = new AbortController(); before.abort(); let calls = 0;
  await assert.rejects(callStudioModel(scopeAsk(), config, { signal: before.signal, fetchImpl: async () => { calls++; return reply(review); } }), e => e.code === 'CANCELLED');
  assert.equal(calls, 0);
  assert.deepEqual(await callStudioModel(scopeAsk(), config, { fetchImpl: async () => reply(review) }), review);
});
