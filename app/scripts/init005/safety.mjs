import { mkdirSync, openSync, writeFileSync, closeSync, fsyncSync } from 'node:fs';
import { join } from 'node:path';
export const SAFE_CODES = new Set(['AI_NOT_CONFIGURED','PAID_CALLS_DISABLED','CANCELLED','AI_TIMEOUT','AI_AUTH_FAILED','AI_BALANCE_REQUIRED','AI_RATE_LIMIT','AI_CONFIG_REJECTED','AI_UNAVAILABLE','INVALID_RESPONSE','AI_NETWORK_ERROR','INTERNAL_ERROR','INVALID_EVAL_OPTIONS','LIVE_NOT_AUTHORIZED','BATCH_ALREADY_STARTED','INPUT_TOO_LARGE','BUDGET_EXCEEDED','CALL_CAP_EXCEEDED','TELEMETRY_INCOMPLETE','INPUT_RESERVE_EXCEEDED','OUTPUT_CAP_EXCEEDED','MODEL_CHANGED','OUTPUT_WRITE_FAILED','PROXY_REQUIRED','CURL_NOT_AVAILABLE','PROXY_CONFIG_INVALID','TLS_UNVERIFIED','NETWORK_PROBE_FAILED']);
export const safeCode = e => SAFE_CODES.has(e?.code ?? e?.message) ? (e.code ?? e.message) : 'INTERNAL_ERROR';
export function scrub(value, secrets=[]) {
  if (typeof value === 'string') {
    let s=value;
    for (const secret of secrets.filter(s=>typeof s==='string' && s.length>0)) s=s.split(secret).join('[REDACTED]');
    return s.replace(/\bBearer\s+[^\s"\\]+/gi,'Bearer [REDACTED]').replace(/\bsk-[A-Za-z0-9_-]{8,}/g,'[REDACTED]');
  }
  if (Array.isArray(value)) return value.map(v=>scrub(v,secrets));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k])=>!['authorization','proxy-authorization','apikey','api_key','headers'].includes(k.toLowerCase())).map(([k,v])=>[k,scrub(v,secrets)]));
  return value;
}
export function writePrivateJson(path, data, secrets=[]) {
  // No caller-provided raw exception/response headers. Mode 0600 on POSIX.
  const fd=openSync(path,'w',0o600);
  try { writeFileSync(fd,JSON.stringify(scrub(data,secrets),null,2)+'\n'); fsyncSync(fd); } finally {closeSync(fd);}
}
export function claimBatch(dir) {
  mkdirSync(dir,{recursive:true,mode:0o700});
  try { const fd=openSync(join(dir,'run.lock'),'wx',0o600); closeSync(fd); }
  catch { throw new Error('BATCH_ALREADY_STARTED'); }
  // Intentionally persistent. No automatic resume/retry after an uncertain failure.
}
export function authorizeLive(options,env) {
  if (options.live !== true || options.approve !== 'INIT005-SIX-CALLS' || env.ALLOW_PAID_AI !== 'true'
      || env.AFS_EVAL_APPROVED_USD !== '0.12' || env.AFS_PRICE_RECHECKED !== 'true') throw new Error('LIVE_NOT_AUTHORIZED');
  if (!env.DEEPSEEK_API_KEY) throw new Error('AI_NOT_CONFIGURED');
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('TLS_UNVERIFIED');
  if (!['direct-secret','network-secret'].includes(options.credential)) throw new Error('INVALID_EVAL_OPTIONS');
  if (options.credential==='network-secret' && options.transport!=='curl-proxy') throw new Error('PROXY_REQUIRED');
}
