import { ApiError } from '../../server/errors.mjs';
import { abortError, providerHttpError } from './provider-errors.mjs';

// Deliberately no endpoint option, retries, model substitution, or provider fallback.
const ENDPOINTS = Object.freeze({
  deepseek: 'https://api.deepseek.com/chat/completions',
  openai: 'https://api.openai.com/v1/responses',
});
export const MAP_PROVIDER_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const invalid = () => new ApiError('INVALID_RESPONSE', 502);
const incomplete = () => new ApiError('AI_RESPONSE_INCOMPLETE', 502);
const count = value => Number.isSafeInteger(value) && value >= 0;

function usageOf(raw, provider) {
  const usage = raw?.usage;
  const inputTokens = provider === 'openai' ? usage?.input_tokens : usage?.prompt_tokens;
  const outputTokens = provider === 'openai' ? usage?.output_tokens : usage?.completion_tokens;
  if (!count(inputTokens) || !count(outputTokens)) return null;
  const cachedInputTokens = provider === 'openai'
    ? usage.input_tokens_details?.cached_tokens : usage.prompt_cache_hit_tokens;
  const reasoningTokens = provider === 'openai'
    ? usage.output_tokens_details?.reasoning_tokens : usage.completion_tokens_details?.reasoning_tokens;
  if ((cachedInputTokens !== undefined && (!count(cachedInputTokens) || cachedInputTokens > inputTokens)) ||
      (reasoningTokens !== undefined && (!count(reasoningTokens) || reasoningTokens > outputTokens))) return null;
  return { inputTokens, outputTokens,
    ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
    ...(reasoningTokens === undefined ? {} : { reasoningTokens }) };
}

function parseValue(raw, provider, apiKey) {
  if (!raw || typeof raw !== 'object' || raw.error) throw invalid();
  let content;
  if (provider === 'deepseek') {
    if (!Array.isArray(raw.choices) || raw.choices.length !== 1) throw invalid();
    const choice = raw.choices[0];
    if (choice?.finish_reason !== 'stop') throw incomplete();
    const message = choice.message;
    if (message?.role !== 'assistant' || message.refusal || message.function_call ||
        (message.tool_calls != null && (!Array.isArray(message.tool_calls) || message.tool_calls.length)) ||
        typeof message.content !== 'string') throw invalid();
    content = message.content;
  } else {
    if (typeof raw.status !== 'string') throw invalid();
    if (raw.status !== 'completed' || raw.incomplete_details != null) throw incomplete();
    if (!Array.isArray(raw.output)) throw invalid();
    const messages = raw.output.filter(item => item?.type === 'message');
    if (messages.length !== 1 || raw.output.some(item => !['message', 'reasoning'].includes(item?.type))) throw invalid();
    const message = messages[0];
    if (message.status !== 'completed') throw incomplete();
    if (message.role !== 'assistant' || !Array.isArray(message.content) || !message.content.length ||
        message.content.some(block => block?.type !== 'output_text' || typeof block.text !== 'string')) throw invalid();
    content = message.content.map(block => block.text).join('');
  }
  if (content.includes(apiKey)) throw invalid();
  let value;
  try { value = JSON.parse(content); } catch { throw invalid(); }
  // JSON mode is an object contract, and escaped credentials must be rejected too.
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const pending = [value];
  while (pending.length) {
    const next = pending.pop();
    if (typeof next === 'string' && next.includes(apiKey)) throw invalid();
    if (next && typeof next === 'object') {
      for (const [key, child] of Object.entries(next)) {
        if (key.includes(apiKey)) throw invalid();
        pending.push(child);
      }
    }
  }
  return value;
}

function cancelBody(body) {
  try { Promise.resolve(body?.cancel()).catch(() => {}); } catch { /* Never expose upstream errors. */ }
}

async function readBody(response, signal) {
  const declared = response.headers?.get?.('content-length');
  if (declared != null && /^\d+$/.test(declared) && Number(declared) > MAP_PROVIDER_MAX_RESPONSE_BYTES) {
    cancelBody(response.body);
    throw invalid();
  }
  if (!response.body || typeof response.body.getReader !== 'function') throw invalid();
  const reader = response.body.getReader();
  const cancel = () => { try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {} };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      if (signal.aborted) throw abortError(false);
      const { done, value } = await reader.read();
      if (signal.aborted) throw abortError(false);
      if (done) break;
      if (!(value instanceof Uint8Array)) throw invalid();
      length += value.byteLength;
      if (length > MAP_PROVIDER_MAX_RESPONSE_BYTES) { cancel(); throw invalid(); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw invalid(); }
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

/** One bounded, credential-safe JSON call. Hooks run once; onDispatch can refuse before any paid request. */
export async function callMapProvider({ provider, apiKey, model, reasoning, system, input,
  maxOutputTokens = 8192, timeoutMs = 120000, signal, fetchImpl = globalThis.fetch, onUsage, onDispatch } = {}) {
  if (!Object.hasOwn(ENDPOINTS, provider) || typeof model !== 'string' || !model.trim() ||
      typeof system !== 'string' || typeof input !== 'string' ||
      !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens <= 0 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647 ||
      (reasoning !== undefined && !['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(reasoning))) {
    throw new ApiError('AI_CONFIG_REJECTED', 502);
  }
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new ApiError('AI_NOT_CONFIGURED', 503);
  if (signal?.aborted) throw abortError(false);
  const body = provider === 'deepseek' ? {
    model, messages: [{ role: 'system', content: `${system}\nReturn exactly one JSON object.` }, { role: 'user', content: input }],
    response_format: { type: 'json_object' }, max_tokens: maxOutputTokens, stream: false,
    thinking: { type: reasoning === 'low' ? 'enabled' : 'disabled' },
    ...(reasoning === 'low' ? { reasoning_effort: 'low' } : {}),
  } : {
    model, instructions: `${system}\nReturn exactly one JSON object.`, input: `Return JSON for this input:\n${input}`,
    store: false, stream: false, reasoning: { effort: reasoning ?? 'high' },
    text: { format: { type: 'json_object' } }, max_output_tokens: maxOutputTokens,
  };
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let abortListener;
  const cancelled = new Promise((_, reject) => {
    abortListener = () => reject(abortError(timedOut));
    controller.signal.addEventListener('abort', abortListener, { once: true });
  });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const work = (async () => {
    await onDispatch?.({ provider, model, maxOutputTokens });
    if (controller.signal.aborted) throw abortError(timedOut);
    let response;
    try {
      response = await fetchImpl(ENDPOINTS[provider], {
        method: 'POST', redirect: 'manual', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
    } catch { throw controller.signal.aborted ? abortError(timedOut) : new ApiError('AI_NETWORK_ERROR', 503); }
    if (controller.signal.aborted) { cancelBody(response.body); throw abortError(timedOut); }
    if (!response.ok || response.redirected) {
      cancelBody(response.body);
      const error = response.redirected || (response.status >= 300 && response.status < 400)
        ? new ApiError('AI_CONFIG_REJECTED', 502) : providerHttpError(response.status, 60);
      // These HTTP rejections occur before model execution. Unknown transport/server failures retain their reservation.
      if (!response.redirected && [400, 401, 403, 404, 422, 429].includes(response.status)) {
        try { await onUsage?.({ inputTokens: 0, outputTokens: 0 }); }
        catch { /* Accounting failures must not hide the provider's definitive rejection. */ }
      }
      throw error;
    }
    let raw;
    try { raw = JSON.parse(await readBody(response, controller.signal)); }
    catch (error) {
      if (controller.signal.aborted) throw abortError(timedOut);
      if (error instanceof ApiError) throw error;
      throw invalid();
    }
    if (controller.signal.aborted) throw abortError(timedOut);
    const usage = usageOf(raw, provider);
    let value, validationError;
    try { value = parseValue(raw, provider, apiKey); if (!usage) throw invalid(); }
    catch (error) { validationError = error instanceof ApiError ? error : invalid(); }
    if (usage) {
      try { await onUsage?.(usage); }
      catch (error) { if (!validationError) throw error; }
    }
    if (validationError) throw validationError;
    return { value, usage, provider, model };
  })();
  try { return await Promise.race([work, cancelled]); }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', abortListener);
  }
}
