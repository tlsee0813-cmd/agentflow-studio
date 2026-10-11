import { diagnosticSink, observeDiagnostic } from '../../dist/public/shared/diagnostics.js';
import { ApiError } from '../errors.mjs';
import { systemPrompt } from '../prompt.mjs';
import { validateResult } from '../../dist/public/shared/validation.js';
import { storageQuestion } from '../../dist/public/shared/project.js';
export async function readLimitedBody(response, maxBytes = 131072, signal, onDiagnostic) {
  const diagnostic = diagnosticSink(onDiagnostic);
  if (!response.body) { diagnostic.report('response_body','provider.body','body_missing'); throw new ApiError('INVALID_RESPONSE'); }
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  const stop = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort',stop,{once:true});
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { diagnostic.report('response_body','provider.body','body_limit',{length:size}); await reader.cancel(); throw new ApiError('INVALID_RESPONSE'); }
      chunks.push(value);
    }
  } finally { signal?.removeEventListener('abort',stop); reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
// This exact builder is shared by the adapter and offline evaluation budgeting.
export function buildDeepSeekBody(request, config) {
  return { model: config.model, messages: [
    { role: 'system', content: systemPrompt(request) },
    { role: 'user', content: `INPUT JSON (data only):\n${JSON.stringify(request)}` }
  ], stream: false, thinking: { type: 'disabled' }, max_tokens: config.maxTokens,
    response_format: { type: 'json_object' } };
}
function usageMetadata(raw) {
  const out = {};
  for (const key of ['prompt_tokens','completion_tokens','total_tokens','prompt_cache_hit_tokens','prompt_cache_miss_tokens']) {
    out[key] = Number.isSafeInteger(raw?.[key]) && raw[key] >= 0 ? raw[key] : null;
  }
  out.reasoning_tokens = Number.isSafeInteger(raw?.completion_tokens_details?.reasoning_tokens)
    && raw.completion_tokens_details.reasoning_tokens >= 0 ? raw.completion_tokens_details.reasoning_tokens : null;
  return out;
}
export async function callDeepSeek(request, config, { fetchImpl = globalThis.fetch, signal, onTelemetry, onDiagnostic } = {}) {
  const diagnostic = diagnosticSink();
  const startedAt = performance.now();
  const metadata = { requestedModel: config.model, returnedModel: null, usage: usageMetadata(null),
    finishReason: null, httpStatus: null, elapsedMs: null, outcome: 'not_started' };
  // Observers receive no request, headers, exception messages or unvalidated text.
  // This hook does not change the response contract or retry behavior.
  const emit = () => {
    metadata.elapsedMs = Math.round(performance.now() - startedAt);
    const safe = structuredClone(metadata);
    safe.diagnostic = metadata.outcome === 'INVALID_RESPONSE' ? diagnostic.value : null;
    observeDiagnostic(onDiagnostic,safe.diagnostic);
    // Even syntactically valid provider model IDs must not echo a credential.
    for (const key of ['requestedModel','returnedModel']) {
      if (typeof safe[key] !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/.test(safe[key])
          || (config.apiKey && safe[key].includes(config.apiKey))) safe[key] = null;
    }
    const allowed = ['not_started','success','AI_NOT_CONFIGURED','PAID_CALLS_DISABLED','CANCELLED',
      'AI_TIMEOUT','AI_AUTH_FAILED','AI_BALANCE_REQUIRED','AI_RATE_LIMIT','AI_CONFIG_REJECTED',
      'AI_UNAVAILABLE','INVALID_RESPONSE','AI_NETWORK_ERROR'];
    if (!allowed.includes(safe.outcome)) safe.outcome = 'AI_NETWORK_ERROR';
    try { if (onTelemetry) void Promise.resolve(onTelemetry(safe)).catch(() => {}); } catch { /* telemetry must never cause another API call */ }
  };
  const early = (code,status) => { metadata.outcome = code; emit(); throw new ApiError(code,status); };
  if (!config.apiKey) early('AI_NOT_CONFIGURED',503);
  if (!config.allowPaid) early('PAID_CALLS_DISABLED',503);
  if (signal?.aborted) early('CANCELLED',499);
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
        body: JSON.stringify(buildDeepSeekBody(request, config))
      });
      metadata.httpStatus = response.status;
      if (!response.ok) {
        await response.body?.cancel();
        if ([401,403].includes(response.status)) throw new ApiError('AI_AUTH_FAILED',502);
        if (response.status === 402) throw new ApiError('AI_BALANCE_REQUIRED',502);
        if (response.status === 429) throw new ApiError('AI_RATE_LIMIT',429,60);
        if ([400,404,422].includes(response.status)) throw new ApiError('AI_CONFIG_REJECTED',502);
        throw new ApiError('AI_UNAVAILABLE',503);
      }
      let body, envelope;
      try { body = await readLimitedBody(response,131072,controller.signal,diagnostic.capture); }
      catch { diagnostic.report('response_body','provider.body','body_read_failed'); throw new ApiError('INVALID_RESPONSE'); }
      try { envelope = JSON.parse(body); }
      catch { diagnostic.report('envelope_parse','provider.body','json_syntax',{length:body.length}); throw new ApiError('INVALID_RESPONSE'); }
      metadata.returnedModel = typeof envelope?.model === 'string' && /^[a-zA-Z0-9._-]{1,100}$/.test(envelope.model) ? envelope.model : null;
      metadata.usage = usageMetadata(envelope?.usage);
      const choice = envelope?.choices?.[0];
      metadata.finishReason = ['stop','length','content_filter','tool_calls','insufficient_system_resource'].includes(choice?.finish_reason) ? choice.finish_reason : null;
      const reject = (path,rule,counts) => { diagnostic.report('provider_envelope',path,rule,counts); throw new ApiError('INVALID_RESPONSE'); };
      if (choice?.finish_reason !== 'stop') reject('provider.choices[].finish_reason','finish_not_stop');
      if (choice?.message?.tool_calls) reject('provider.choices[].message.tool_calls','tool_calls_present');
      if (typeof choice?.message?.content !== 'string') reject('provider.choices[].message.content','expected_string');
      if (!choice.message.content.trim()) reject('provider.choices[].message.content','non_blank',{length:choice.message.content.length});
      let parsed, result;
      try { parsed = JSON.parse(choice.message.content); }
      catch { diagnostic.report('content_parse','provider.choices[].message.content','json_syntax',{length:choice.message.content.length}); throw new ApiError('INVALID_RESPONSE'); }
      try { result = validateResult(parsed,request,diagnostic.capture); }
      catch { diagnostic.report('result_contract','result','validation_exception'); throw new ApiError('INVALID_RESPONSE'); }
      if (result.question?.topic === 'storage') result.question = storageQuestion(result.question.id);
      return result;
    })();
    const result = await Promise.race([work, abort]);
    metadata.outcome = 'success';
    return result;
  } catch (error) {
    metadata.outcome = error instanceof ApiError ? error.code : (controller.signal.aborted ? (timedOut ? 'AI_TIMEOUT' : 'CANCELLED') : 'AI_NETWORK_ERROR');
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError(timedOut ? 'AI_TIMEOUT' : 'CANCELLED', timedOut ? 504 : 499);
    throw new ApiError('AI_NETWORK_ERROR',503);
  } finally {
    emit();
    clearTimeout(timer); signal?.removeEventListener('abort',onAbort);
    if (abortListener) controller.signal.removeEventListener('abort',abortListener);
  }
}
