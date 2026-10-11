import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { join } from 'node:path';
import { createContinuityApp } from '../../app/continuity/server/app.mjs';
import { readConfig } from '../../app/server/config.mjs';
import { mockAdvice } from '../../app/continuity/server/mock.mjs';

export const sha = value => createHash('sha256').update(value).digest('hex');
export const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
export const SECRET_ECHO_ERROR = 'EXPERIMENT_SECRET_ECHO';
export class ObservationProtectionError extends Error {
  constructor() { super(SECRET_ECHO_ERROR); this.name = 'ObservationProtectionError'; }
}
const regexLiteral = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function redact(text, secret = '') {
  if (!secret) return text;
  // Match the whole known credential, including mixed literal/JSON/Unicode forms.
  // Backslash runs cover the nested JSON string layers in provider content and traces.
  // This changes observation copies only; it never decodes/repairs a response for the app.
  const short = { '"': '"', '\\': '\\', '/': '/', '\b': 'b', '\f': 'f', '\n': 'n', '\r': 'r', '\t': 't' };
  const pattern = secret.split('').map(char => {
    const hex = char.charCodeAt(0).toString(16).padStart(4, '0').replace(/[a-f]/g, c => `[${c}${c.toUpperCase()}]`);
    const alternatives = [`\\\\+u${hex}`];
    if (char === '\\') alternatives.push('\\\\+');
    else {
      if (short[char]) alternatives.push(`\\\\+${regexLiteral(short[char])}`);
      alternatives.push(regexLiteral(char));
    }
    return `(?:${alternatives.join('|')})`;
  }).join('');
  return text.replace(new RegExp(pattern, 'g'), '[REDACTED_API_KEY]');
}
export function write(path, value, { replace = false, secret = '' } = {}) {
  const text = redact(typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, secret);
  if (!replace) writeFileSync(path, text, { flag: 'wx', mode: 0o600 });
  else {
    const temp = `${path}.tmp-${process.pid}`;
    writeFileSync(temp, text, { flag: 'wx', mode: 0o600 });
    renameSync(temp, path);
  }
}
export function safeConfig(c) {
  const { mode, endpoint, model, timeoutMs, maxTokens, rate, cap, concurrency } = c;
  return { mode, endpoint, model, timeoutMs, maxTokens, rate, cap, concurrency };
}
// Observer only: clone, bounded prefix, no parsing/repair before returning the original Response.
// Original provider timeout/body limit/error handling are untouched. No response headers are logged.
async function captureBody(response, signal) {
  const reader = response.body?.getReader();
  if (!reader) return { text: '', bytes: 0, complete: true, truncated: false };
  const chunks = []; let bytes = 0, complete = false, truncated = false, readError = false;
  const stop = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', stop, { once: true });
  if (signal?.aborted) stop();
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) { complete = !signal?.aborted; break; }
      const remaining = 131072 - bytes;
      chunks.push(Buffer.from(item.value.subarray(0, remaining)));
      bytes += Math.min(remaining, item.value.byteLength);
      if (item.value.byteLength > remaining) { truncated = true; stop(); break; }
    }
  } catch { readError = true; }
  finally { signal?.removeEventListener('abort', stop); reader.releaseLock(); }
  return { text: Buffer.concat(chunks).toString('utf8'), bytes, complete, truncated, readError };
}
function local(port, request) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/api/continuity', method: 'POST',
      headers: { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1' } }, response => {
      const chunks = [];
      response.on('data', c => chunks.push(c));
      response.on('error', () => reject(new Error('LOCAL_HTTP_FAILED')));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8'); let data = null;
        try { data = JSON.parse(raw); } catch { /* Preserve, never repair. */ }
        resolve({ status: response.statusCode, raw, data });
      });
    });
    req.on('error', () => reject(new Error('LOCAL_HTTP_FAILED')));
    req.end(JSON.stringify(request));
  });
}
function existingMockResponse(_url, init) {
  const body = JSON.parse(init.body);
  const request = JSON.parse(body.messages[1].content.slice('INPUT JSON (data only):\n'.length));
  // Not an oracle: exactly the product's explicitly rule-based mock. NEVER used in live mode.
  return new Response(JSON.stringify({ model: 'IDEA016-TRANSPORT-MOCK-NOT-DEEPSEEK', choices: [
    { finish_reason: 'stop', message: { content: JSON.stringify(mockAdvice(request)) } },
  ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
/** Same loopback HTTP app -> provider -> buildBody -> validators as the client.
 * mockResponder exists only for unit failure injection; the CLI exposes no transport/endpoint override.
 */
export async function openTransport({ mode, env, mockResponder } = {}) {
  if (!['mock', 'live'].includes(mode)) throw new Error('MODE_REQUIRED');
  if (mode === 'live' && mockResponder) throw new Error('NO_LIVE_MOCK_INJECTION');
  // mock never consults process.env, including any externally injected credential.
  const config = mode === 'mock' ? readConfig({ AI_MODE: 'deepseek', DEEPSEEK_API_KEY: 'IDEA016-NOT-A-REAL-KEY',
    ALLOW_PAID_AI: 'true', AI_REQUESTS_PER_MINUTE: '60', AI_PROCESS_CALL_CAP: '20' }) : readConfig(env ?? process.env);
  if (mode === 'live' && config.mode !== 'deepseek') throw new Error('LIVE_REQUIRES_DEEPSEEK');
  if (mode === 'live' && !config.apiKey) throw new Error('AI_NOT_CONFIGURED');
  if (mode === 'live' && !config.allowPaid) throw new Error('PAID_CALLS_DISABLED');
  const record = (path, value, options = {}) => write(path, value, { ...options, secret: config.apiKey });
  const echoes = text => redact(text, config.apiKey) !== text;
  let active = null, lastStart = 0, dispatches = 0;
  const server = createContinuityApp({ config, fetchImpl: async (url, init) => {
    if (!active) throw new Error('UNEXPECTED_DISPATCH');
    const call = active; // Bind this request across awaits; a timed-out late response cannot touch the next call.
    call.dispatches++;
    dispatches++;
    call.provider = { endpoint: url, requestSha256: sha(init.body), httpStatus: null };
    record(join(call.dir, 'request-provider.raw.json'), init.body);
    try {
      const response = mode === 'mock' ? await (mockResponder ?? existingMockResponse)(url, init) : await globalThis.fetch(url, init);
      call.provider.httpStatus = response.status;
      call.capture = captureBody(response.clone(), init.signal);
      return response; // No buffering, changed content, retry, or repaired JSON supplied to app.
    } catch { call.provider.networkFailure = true; throw new Error('PROVIDER_NETWORK_FAILED'); }
  } });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  return {
    mode, config: safeConfig(config), expectedEnvelopeMode: 'deepseek', write: record,
    get dispatches() { return dispatches; },
    async send(request, dir) {
      if (active) throw new Error('SERIAL_CALLS_ONLY');
      // Pacing before dispatch, not retry after failure. Existing runtime limits are not relaxed live.
      if (mode === 'live' && lastStart) await sleep(Math.max(0, 61000 / config.rate - (Date.now() - lastStart)));
      lastStart = Date.now();
      active = { dir, dispatches: 0, provider: null, capture: null };
      const started = performance.now();
      try {
        const response = await local(port, request);
        // Check the parsed app envelope before it can reach product receive(). Never sanitize-to-accept.
        const parsedAppResponseEcho = echoes(JSON.stringify(response.data));
        let sensitiveEchoDetected = parsedAppResponseEcho || echoes(response.raw);
        record(join(dir, 'response-app.raw.json'), response.raw);
        const observed = active.capture ? await active.capture : null;
        if (observed) {
          sensitiveEchoDetected ||= echoes(observed.text);
          record(join(dir, 'response-provider.raw.txt'), observed.text);
          Object.assign(active.provider, { capturedBytes: observed.bytes, complete: observed.complete, truncated: observed.truncated,
            readError: observed.readError ?? false, responseRedacted: echoes(observed.text) });
          try {
            const raw = JSON.parse(observed.text), choice = raw?.choices?.[0];
            Object.assign(active.provider, { returnedModel: raw?.model ?? null, finishReason: choice?.finish_reason ?? null, usage: raw?.usage ?? null });
            if (typeof choice?.message?.content === 'string') {
              sensitiveEchoDetected ||= echoes(choice.message.content);
              record(join(dir, 'assistant.raw.txt'), choice.message.content);
            }
          } catch { /* Raw provider text is the evidence even when parsing fails. */ }
        }
        const metadata = { mode, syntheticCustomer: true, transportMock: mode === 'mock',
          providerDispatches: active.dispatches, realDispatches: mode === 'live' ? active.dispatches : 0,
          httpStatus: response.status, elapsedMs: Math.round(performance.now() - started), provider: active.provider,
          automaticRetry: false, fallback: false, quality: 'NOT_EVALUATED',
          observationProtection: { boundary: 'experiment-only', error: sensitiveEchoDetected ? SECRET_ECHO_ERROR : null,
            parsedAppResponseEcho, blockedBeforeReceive: sensitiveEchoDetected } };
        record(join(dir, 'transport.json'), metadata);
        if (sensitiveEchoDetected) throw new ObservationProtectionError();
        // Safe response.data passes unchanged to product receive(), not reconstructed from redacted traces.
        return response;
      } finally { active = null; }
    },
    close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}
