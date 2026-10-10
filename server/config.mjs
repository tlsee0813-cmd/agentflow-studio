import { ApiError } from './errors.mjs';
function number(env, key, fallback, min, max) {
  const v = env[key] === undefined ? fallback : Number(env[key]);
  if (!Number.isInteger(v) || v < min || v > max) throw new ApiError('INVALID_SERVER_CONFIG', 500);
  return v;
}
export function readConfig(env = process.env) {
  const mode = env.AI_MODE ?? 'deepseek';
  if (!['deepseek','mock'].includes(mode)) throw new ApiError('INVALID_SERVER_CONFIG', 500);
  let base;
  try { base = new URL(env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'); }
  catch { throw new ApiError('INVALID_SERVER_CONFIG',500); }
  // No client-chosen URLs, credentials or redirects. Endpoint changes require server review.
  if (base.protocol !== 'https:' || base.hostname !== 'api.deepseek.com' || base.port || base.username || base.password || base.search || base.hash || !['/','/v1','/v1/'].includes(base.pathname)) {
    throw new ApiError('UNAPPROVED_PROVIDER_URL', 500);
  }
  const model = env.DEEPSEEK_MODEL || 'deepseek-flash';
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(model)) throw new ApiError('INVALID_SERVER_CONFIG', 500);
  return { mode, apiKey: env.DEEPSEEK_API_KEY || '', allowPaid: env.ALLOW_PAID_AI === 'true',
    endpoint: `${base.href.replace(/\/$/,'')}/chat/completions`, model,
    port: number(env,'PORT',3000,0,65535), host: '127.0.0.1',
    timeoutMs: number(env,'AI_TIMEOUT_MS',15000,100,60000),
    maxTokens: number(env,'AI_MAX_TOKENS',2048,256,4096),
    rate: number(env,'AI_REQUESTS_PER_MINUTE',6,1,60),
    cap: number(env,'AI_PROCESS_CALL_CAP',20,1,100),
    concurrency: number(env,'AI_MAX_CONCURRENT',2,1,4) };
}
