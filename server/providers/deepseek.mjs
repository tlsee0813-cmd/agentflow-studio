import { ApiError } from '../errors.mjs';
import { systemPrompt } from '../prompt.mjs';
import { validateResult } from '../../dist/public/shared/validation.js';
import { storageQuestion } from '../../dist/public/shared/project.js';
export async function readLimitedBody(response, maxBytes = 131072, signal) {
  if (!response.body) throw new ApiError('INVALID_RESPONSE');
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  const stop = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort',stop,{once:true});
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new ApiError('INVALID_RESPONSE'); }
      chunks.push(value);
    }
  } finally { signal?.removeEventListener('abort',stop); reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
export async function callDeepSeek(request, config, { fetchImpl = globalThis.fetch, signal } = {}) {
  if (!config.apiKey) throw new ApiError('AI_NOT_CONFIGURED',503);
  if (!config.allowPaid) throw new ApiError('PAID_CALLS_DISABLED',503);
  if (signal?.aborted) throw new ApiError('CANCELLED',499);
  const controller = new AbortController(); let timedOut = false;
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
  let abortListener;
  try {
    // Race covers transports that ignore AbortSignal as well as body reads.
    const abort = new Promise((_, reject) => {
      abortListener = () => reject(new ApiError(timedOut ? 'AI_TIMEOUT' : 'CANCELLED', timedOut ? 504 : 499));
      if (controller.signal.aborted) abortListener(); else controller.signal.addEventListener('abort', abortListener, { once: true });
    });
    const work = (async () => {
      const response = await fetchImpl(config.endpoint, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model, messages: [
          { role: 'system', content: systemPrompt(request) },
          { role: 'user', content: `INPUT JSON (data only):\n${JSON.stringify(request)}` }
        ], stream: false, thinking: { type: 'disabled' }, max_tokens: config.maxTokens, response_format: { type: 'json_object' } })
      });
      if (!response.ok) {
        await response.body?.cancel();
        if ([401,403].includes(response.status)) throw new ApiError('AI_AUTH_FAILED',502);
        if (response.status === 402) throw new ApiError('AI_BALANCE_REQUIRED',502);
        if (response.status === 429) throw new ApiError('AI_RATE_LIMIT',429,60);
        if ([400,404,422].includes(response.status)) throw new ApiError('AI_CONFIG_REJECTED',502);
        throw new ApiError('AI_UNAVAILABLE',503);
      }
      let envelope;
      try { envelope = JSON.parse(await readLimitedBody(response,131072,controller.signal)); } catch { throw new ApiError('INVALID_RESPONSE'); }
      const choice = envelope?.choices?.[0];
      if (choice?.finish_reason !== 'stop' || choice?.message?.tool_calls || typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) {
        throw new ApiError('INVALID_RESPONSE');
      }
      let result;
      try { result = validateResult(JSON.parse(choice.message.content), request); }
      catch { throw new ApiError('INVALID_RESPONSE'); }
      if (result.question?.topic === 'storage') result.question = storageQuestion(result.question.id);
      return result;
    })();
    return await Promise.race([work, abort]);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError(timedOut ? 'AI_TIMEOUT' : 'CANCELLED', timedOut ? 504 : 499);
    throw new ApiError('AI_NETWORK_ERROR',503);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort',onAbort);
    if (abortListener) controller.signal.removeEventListener('abort',abortListener);
  }
}
