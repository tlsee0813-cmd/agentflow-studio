import { ApiError } from '../../server/errors.mjs';
import { abortError, providerHttpError } from './provider-errors.mjs';

// Deliberately no endpoint option, retries, model substitution, or provider fallback.
const ENDPOINTS = Object.freeze({
  deepseek: 'https://api.deepseek.com/chat/completions',
  openai: 'https://api.openai.com/v1/responses',
});
export const MAP_PROVIDER_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
/** An OpenAI call allowed longer than this runs in the Responses API's background mode: one paid POST that returns at once with
 * the response id (status queued/in_progress), then free GET /v1/responses/{id} polls every MAP_POLL_MS until a terminal status.
 * A single connection held open past ~300 s was dropped from this machine (the astra plan at 330 s, AI_NETWORK_ERROR, billed blind). */
export const MAP_BACKGROUND_AFTER_MS = 180000;
export const MAP_POLL_MS = 6000;
// After a deadline or a cancellation the running response is stopped with POST /v1/responses/{id}/cancel, bounded on its own.
const CANCEL_TIMEOUT_MS = 15000;
const RESPONSE_ID = /^[A-Za-z0-9_-]{1,200}$/;
const PENDING = Object.freeze(['queued', 'in_progress']);
const TERMINAL = Object.freeze(['completed', 'failed', 'cancelled', 'incomplete']);
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

/** .35: one bounded GET of a kept background response (a free read, never a generation, never retried): its usage ({ inputTokens,
 * outputTokens, … } as a call reports it) when the response has reached a terminal status and reports one; null for anything else
 * (still running, no usage, an HTTP or network failure, a time-out, another id). The ledger's reconciliation of lost attempts. */
export async function readResponseUsage({ apiKey, responseId, fetchImpl = globalThis.fetch, timeoutMs = CANCEL_TIMEOUT_MS, signal } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || typeof responseId !== 'string' || !RESPONSE_ID.test(responseId)
    || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || signal?.aborted) return null;
  const bound = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetchImpl(`${ENDPOINTS.openai}/${responseId}`, { method: 'GET', redirect: 'manual', signal: bound, headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok || response.redirected) { cancelBody(response.body); return null; }
    const raw = JSON.parse(await readBody(response, bound));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || (raw.id !== undefined && raw.id !== responseId) || !TERMINAL.includes(raw.status)) return null;
    return usageOf(raw, 'openai');
  } catch { return null; }
}

/** One bounded, credential-safe JSON call. Hooks run once; onDispatch can refuse before any paid request.
 * An OpenAI call whose timeout exceeds MAP_BACKGROUND_AFTER_MS (or that resumes a kept response id) runs in background mode:
 * POST (the one paid request) → onQueued({ id }) → GET polls → the same strict parse as a direct reply. Polls are free reads of
 * the same response, never a second generation: a dropped or 429/5xx poll is simply asked again at the next interval, within the
 * same deadline. On the deadline or a cancellation the response is cancelled and the cancel's own usage, when it reports one, is
 * charged; otherwise nothing is charged here and the caller keeps its reservation. There is still no automatic re-dispatch. */
export async function callMapProvider({ provider, apiKey, model, reasoning, system, input,
  maxOutputTokens = 8192, timeoutMs = 120000, signal, fetchImpl = globalThis.fetch, onUsage, onDispatch, onQueued,
  resume, pollMs = MAP_POLL_MS } = {}) {
  if (!Object.hasOwn(ENDPOINTS, provider) || typeof model !== 'string' || !model.trim() ||
      typeof system !== 'string' || typeof input !== 'string' ||
      !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens <= 0 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647 ||
      !Number.isSafeInteger(pollMs) || pollMs < 0 || pollMs > 60000 ||
      (resume !== undefined && (provider !== 'openai' || typeof resume !== 'string' || !RESPONSE_ID.test(resume))) ||
      (reasoning !== undefined && !['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(reasoning))) {
    throw new ApiError('AI_CONFIG_REJECTED', 502);
  }
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new ApiError('AI_NOT_CONFIGURED', 503);
  if (signal?.aborted) throw abortError(false);
  const background = provider === 'openai' && (timeoutMs > MAP_BACKGROUND_AFTER_MS || resume !== undefined);
  const body = provider === 'deepseek' ? {
    model, messages: [{ role: 'system', content: `${system}\nReturn exactly one JSON object.` }, { role: 'user', content: input }],
    response_format: { type: 'json_object' }, max_tokens: maxOutputTokens, stream: false,
    thinking: { type: reasoning === 'low' ? 'enabled' : 'disabled' },
    ...(reasoning === 'low' ? { reasoning_effort: 'low' } : {}),
  } : {
    model, instructions: `${system}\nReturn exactly one JSON object.`, input: `Return JSON for this input:\n${input}`,
    store: false, stream: false, reasoning: { effort: reasoning ?? 'high' },
    text: { format: { type: 'json_object' } }, max_output_tokens: maxOutputTokens,
    // Privacy: background mode needs store: true, so OpenAI keeps this response (the person's own records, already sent to
    // OpenAI by every map call, and the reply) under the project's retention instead of discarding it after the reply. Only
    // calls longer than MAP_BACKGROUND_AFTER_MS (today the plan stage) take this path; every shorter call keeps store: false.
    ...(background ? { store: true, background: true } : {}),
  };
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let abortListener, grace = null;
  const cancelled = new Promise((_, reject) => {
    // A background call observes the abort itself (it cancels the response and charges what the cancel reports); here it is
    // only bounded against a transport that ignores the abort, once the cancel has had its own bound.
    abortListener = () => { if (background) grace = setTimeout(() => reject(abortError(timedOut)), CANCEL_TIMEOUT_MS + 1000); else reject(abortError(timedOut)); };
    controller.signal.addEventListener('abort', abortListener, { once: true });
  });
  cancelled.catch(() => {});
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const authorization = { Authorization: `Bearer ${apiKey}` };
  const wait = ms => new Promise((resolve, reject) => {
    if (controller.signal.aborted) { reject(abortError(timedOut)); return; }
    const done = () => { clearTimeout(pause); reject(abortError(timedOut)); };
    const pause = setTimeout(() => { controller.signal.removeEventListener('abort', done); resolve(); }, ms);
    controller.signal.addEventListener('abort', done, { once: true });
  });
  // The cancel has its own short bound (the call's own signal is already aborted on a deadline). Its usage, if any, is returned.
  async function cancelRemote(id) {
    const bound = AbortSignal.timeout(CANCEL_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${ENDPOINTS.openai}/${id}/cancel`, { method: 'POST', redirect: 'manual', signal: bound, headers: authorization });
      if (!response.ok || response.redirected) { cancelBody(response.body); return null; }
      return usageOf(JSON.parse(await readBody(response, bound)), 'openai');
    } catch { return null; }
  }
  async function poll(id, waitFirst) {
    try {
      for (let first = true; ; first = false) {
        if (waitFirst || !first) await wait(pollMs);
        let response;
        try { response = await fetchImpl(`${ENDPOINTS.openai}/${id}`, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: authorization }); }
        catch { if (controller.signal.aborted) throw abortError(timedOut); continue; } // a dropped poll is asked again
        if (controller.signal.aborted) { cancelBody(response.body); throw abortError(timedOut); }
        if (!response.ok || response.redirected) {
          cancelBody(response.body);
          if (!response.redirected && (response.status === 429 || response.status >= 500)) continue;
          throw response.redirected || (response.status >= 300 && response.status < 400)
            ? new ApiError('AI_CONFIG_REJECTED', 502) : providerHttpError(response.status, 60);
        }
        let raw;
        try { raw = JSON.parse(await readBody(response, controller.signal)); }
        catch (error) {
          if (controller.signal.aborted) throw abortError(timedOut);
          if (error instanceof ApiError) throw error;
          if (error instanceof SyntaxError) throw invalid();
          continue; // the connection dropped while reading this poll
        }
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) || (raw.id !== undefined && raw.id !== id)) throw invalid();
        if (TERMINAL.includes(raw.status)) return raw;
        if (!PENDING.includes(raw.status)) throw invalid();
      }
    } catch (error) {
      // The response may still be running and billing: stop it, and charge the usage the cancel reports, when it reports one.
      const usage = await cancelRemote(id);
      if (usage) { try { await onUsage?.(usage); } catch { /* the call's own error is the outcome */ } }
      throw error;
    }
  }
  const work = (async () => {
    await onDispatch?.({ provider, model, maxOutputTokens, ...(resume !== undefined ? { resume } : {}) });
    if (controller.signal.aborted) throw abortError(timedOut);
    let raw;
    if (resume !== undefined) raw = await poll(resume, false);
    else {
      let response;
      try {
        response = await fetchImpl(ENDPOINTS[provider], {
          method: 'POST', redirect: 'manual', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...authorization },
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
      try { raw = JSON.parse(await readBody(response, controller.signal)); }
      catch (error) {
        if (controller.signal.aborted) throw abortError(timedOut);
        if (error instanceof ApiError) throw error;
        throw invalid();
      }
      if (controller.signal.aborted) throw abortError(timedOut);
      if (background && PENDING.includes(raw?.status)) {
        // Without an id the running response can be neither read nor cancelled: the reservation stays as charged (lost).
        if (typeof raw.id !== 'string' || !RESPONSE_ID.test(raw.id)) throw invalid();
        // Kept before the first poll so a re-run can read this response instead of paying for a new one.
        try { await onQueued?.({ id: raw.id }); } catch { /* the store reports its own failure at completion */ }
        raw = await poll(raw.id, true);
      }
    }
    if (controller.signal.aborted) throw abortError(timedOut);
    const usage = usageOf(raw, provider);
    let value, validationError;
    try {
      // A background response that ended failed is the provider's failure (its error object never surfaces), charged by its usage.
      if (background && raw?.status === 'failed') throw new ApiError('AI_UNAVAILABLE', 503);
      value = parseValue(raw, provider, apiKey); if (!usage) throw invalid();
    }
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
    clearTimeout(timer); clearTimeout(grace);
    signal?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', abortListener);
  }
}
