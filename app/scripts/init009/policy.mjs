// Fixed INIT009 policy. Shared leaf functions are imported; no old gate is changed.
import * as B from '../init007b/policy.mjs';
import { join } from 'node:path';
import { safeDiagnostic } from '../../dist/public/shared/diagnostics.js';
import { PURPOSE,RUN_ID,LIMITS,PERSONA_IDS,SLOTS,LIVE_DIR,CONTROL_DIR,fixture,fixtureHash,
  LEGACY_SOURCE_FINGERPRINT,LEGACY_RUNTIME_FINGERPRINT } from './contract.mjs';
export { PURPOSE,RUN_ID,LIMITS,PERSONA_IDS,SLOTS,LIVE_DIR,CONTROL_DIR,fixture,fixtureHash,LEGACY_SOURCE_FINGERPRINT,LEGACY_RUNTIME_FINGERPRINT };
export const {ROOT,MODEL,PRICE_URL,MODEL_URL,sha,isHash,fail,exact,equal,noSymlinks,readBytes,readJson,
  rejectSecretContent,telemetry}=B;
export function experimentConfig(key='INIT009-SIMULATED-NOT-A-KEY'){return B.experimentConfig(key);}
export const MOCK_DIR=join(ROOT,'eval-results/init009-mock');
export const MOCK_CONTROL=join(ROOT,'eval-results/init009-mock-control');
// Deliberately synthetic engineering numbers, never official/live defaults.
export const MOCK_PRICES=Object.freeze({inputMiss:0.2,inputHit:0.02,output:0.8});
const CODES=new Set(['PLAN_MISMATCH','PLAN_REQUIRED','FACT_REVIEW_REQUIRED','FRESH_EVIDENCE_REQUIRED','PRICE_UNKNOWN',
  'LEGACY_INVENTORY_REQUIRED','ITEM_REVIEW_REQUIRED','CLOCK_INVALID','REVIEW_ONLY','BASELINE_CHANGED']);
export const errorCode=e=>CODES.has(e?.message)?e.message:B.errorCode(e);
export function validNow(now){if(!Number.isSafeInteger(now)||now<0)fail('CLOCK_INVALID');return now;}
export function recentDate(value,now=Date.now()){
  return Number.isSafeInteger(now)&&now>=0&&B.recentDate(value,now);
}
export function codeIdentity(root=ROOT){
  const manifest=readBytes(join(root,'fixtures/init009/init008-source.sha256')).toString('utf8');
  if(sha(manifest)!==LEGACY_SOURCE_FINGERPRINT)fail('BASELINE_CHANGED');
  for(const line of manifest.trimEnd().split('\n')){
    const match=/^([a-f0-9]{64})  source\/(.+)$/.exec(line);
    if(!match||sha(readBytes(join(root,match[2])))!==match[1])fail('BASELINE_CHANGED');
  }
  const result=B.codeIdentity(root);
  if(result.runtimeFingerprint!==LEGACY_RUNTIME_FINGERPRINT)fail('CODE_FINGERPRINT_MISMATCH');
  return {...result,fixtureHash:sha(readBytes(join(root,'fixtures/init009/experiment.json')))};
}
export function personaById(id){
  const p=fixture.personas.find(p=>p.id===id);if(!p)fail('ARGUMENTS');return structuredClone(p);
}
export function validatePrices(prices){
  if(!prices)fail('PRICE_UNKNOWN');exact(prices,['inputMiss','inputHit','output']);
  for(const n of Object.values(prices))if(!Number.isFinite(n)||n<=0||n>1000||Math.abs(n*1000-Math.round(n*1000))>1e-6)fail('PRICE_UNKNOWN');
  if(prices.inputHit>prices.inputMiss)fail('PRICE_UNKNOWN');return prices;
}
export function nanoCost(input,output,prices){validatePrices(prices);return B.nanoCost(input,output,prices);}
export function reserveRequest(request,config,prices){
  validatePrices(prices);
  if(config.endpoint!=='https://api.deepseek.com/chat/completions'||config.rate!==6||config.cap!==20||config.concurrency!==1)fail('BODY_MISMATCH');
  const r=B.reserveRequest(request,config,prices);
  if(!Number.isSafeInteger(r.reservedNanoUsd)||r.reservedNanoUsd<=0)fail('BUDGET_EXCEEDED');return r;
}
export function budgetAvailable(ledger,reserve){
  const consumed=ledger.slots.filter(s=>s.reservation);
  if(consumed.length>=4)fail('CALL_CAP_EXCEEDED');
  const total=consumed.reduce((n,s)=>n+s.reservation.reservedNanoUsd,0)+reserve.reservedNanoUsd;
  if(!Number.isSafeInteger(total)||total>LIMITS.budgetNanoUsd||reserve.reservedNanoUsd<=0)fail('BUDGET_EXCEEDED');
}
// Same accepted B conservative end-time floor/12s/rolling6 behavior; finite-now guard is new.
export function rateDelay(slots,now){validNow(now);return B.rateDelay(slots,now);}
export function telemetryHalt(t){
  const halt=B.telemetryHalt(t);if(halt)return halt;
  const u=t.usage;
  if(!Number.isSafeInteger(u.prompt_cache_hit_tokens)||!Number.isSafeInteger(u.prompt_cache_miss_tokens)
    ||u.prompt_cache_hit_tokens<0||u.prompt_cache_miss_tokens<0
    ||u.prompt_cache_hit_tokens+u.prompt_cache_miss_tokens!==u.prompt_tokens)return 'USAGE_INVALID';
  return null;
}
export function failurePolicy(t,diagnostic,code){
  const halt=telemetryHalt(t);if(halt)return {scope:'global',code:halt};
  const d=safeDiagnostic(diagnostic??t.diagnostic);
  if(code==='INVALID_RESPONSE'&&d?.stage==='result_contract'&&d.path==='result.proposals[].sourceIds[]'&&d.rule==='known_source')
    return {scope:'case',code:'INVALID_RESPONSE'};
  return {scope:'global',code:code==='INVALID_RESPONSE'?'STATE_INVARIANT_FAILED':code};
}
export function authorizeAssignment(env){
  // No credential read here: readiness must pass before opening the credential path.
  if(env.ALLOW_PAID_AI!=='true'||env.AFS_INIT009_ASSIGNMENT!==RUN_ID||env.AFS_INIT009_APPROVED_USD!=='0.12'
    ||env.AFS_INIT009_CREDENTIAL!=='network-secret'||process.platform!=='linux'||process.version!=='v22.16.0')fail('LIVE_NOT_AUTHORIZED');
  if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0')fail('TLS_UNVERIFIED');
}
export function authorizeEnvironment(env){
  authorizeAssignment(env);
  if(!env.https_proxy&&!env.HTTPS_PROXY)fail('PROXY_REQUIRED');
  if(!env.DEEPSEEK_API_KEY)fail('AI_NOT_CONFIGURED');
}
