// Explicit ONE-case diagnostic experiment. Not an INIT-005 batch resume.
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CASES, prepareCase } from '../init005/cases.mjs';
import { LIMITS, PRICING, reservation, usageCost } from '../init005/cost.mjs';
import { claimBatch, writePrivateJson, safeCode } from '../init005/safety.mjs';
import { validatePreflight, inspectState, telemetryStopReason, simulatedFetchFor } from '../init005/run.mjs';
import { createCurlFetch } from '../init005/curl-fetch.mjs';
import { callDeepSeek, buildDeepSeekBody } from '../../server/providers/deepseek.mjs';
import { readConfig } from '../../server/config.mjs';
import { applyResponse, failRequest } from '../../dist/public/shared/project.js';
import { validateRequest } from '../../dist/public/shared/validation.js';
import { diagnosticSink, safeDiagnostic } from '../../dist/public/shared/diagnostics.js';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const PURPOSE='INIT006-C2-DIAGNOSTIC';
export const EXPERIMENT_ID='INIT006-C2-20261011-01'; // Fixed reviewed identity; no --id/reset/resume.
export const BUDGET_USD=0.02; // Proposed sub-limit; must be explicitly declared again by Cloud operator.
const LIVE_DIR=join(ROOT,'eval-results','init006-c2-diagnostic');
const LOCAL_CODES=new Set(['CODE_FINGERPRINT_MISMATCH','LEGACY_EVIDENCE_REQUIRED','LEGACY_CHANGED','STATE_INVARIANT_FAILED']);
export const diagnosticErrorCode=e=>LOCAL_CODES.has(e?.code ?? e?.message)?(e.code ?? e.message):safeCode(e);
export function parseDiagnosticOptions(args) {
  const out={mode:'plan',transport:'native',credential:'direct-secret'};
  const seen=new Set();
  for(const arg of args) {
    const [flag,...parts]=arg.split('=');
    const key=['--plan','--mock','--live'].includes(flag)?'mode':flag;
    if(seen.has(key)) throw new Error('INVALID_EVAL_OPTIONS'); seen.add(key);
    if(key==='mode' && parts.length===0) out.mode=flag.slice(2);
    else if(['--transport','--credential','--approve','--preflight','--code-sha256','--output'].includes(flag) && parts.length>0) out[flag.slice(2)]=parts.join('=');
    else throw new Error('INVALID_EVAL_OPTIONS');
  }
  validateOptions(out); return out;
}
function validateOptions(o) {
  if(!['plan','mock','live'].includes(o.mode)||!['native','curl-proxy'].includes(o.transport)
    ||!['direct-secret','network-secret'].includes(o.credential)
    ||Object.keys(o).some(k=>!['mode','transport','credential','approve','preflight','code-sha256','output'].includes(k))
    ||(o.mode==='live'&&o.output!==undefined)) throw new Error('INVALID_EVAL_OPTIONS');
}
// Includes actually loaded compiled modules, not only TypeScript source. The expected
// digest must come from the reviewed package, not be auto-approved from this plan.
export function codeFingerprint() {
  const paths=['package.json','package-lock.json','tsconfig.json','scripts/build.mjs',
    'server/app.mjs','server/config.mjs','server/errors.mjs','server/providers/deepseek.mjs','server/prompt.mjs','server/providers/mock.mjs',
    'src/shared/contracts.ts','src/shared/project.ts','src/shared/validation.ts','src/shared/diagnostics.ts',
    'dist/public/shared/contracts.js','dist/public/shared/project.js','dist/public/shared/validation.js','dist/public/shared/diagnostics.js',
    'scripts/init005/cases.mjs','scripts/init005/cost.mjs','scripts/init005/safety.mjs','scripts/init005/run.mjs',
    'scripts/init005/preflight.mjs','scripts/init005/curl-fetch.mjs','scripts/init006/run.mjs'];
  const files=paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(join(ROOT,path))).digest('hex')}));
  return {sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),files};
}
export function authorizeDiagnostic(o,env,fingerprint) {
  validateOptions(o);
  if(o.mode!=='live'||o.approve!=='INIT006-C2-ONCE'||env.ALLOW_PAID_AI!=='true'
    ||env.AFS_INIT006_APPROVED_USD!==String(BUDGET_USD)||env.AFS_PRICE_RECHECKED!=='true') throw new Error('LIVE_NOT_AUTHORIZED');
  if(!env.DEEPSEEK_API_KEY) throw new Error('AI_NOT_CONFIGURED');
  if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0') throw new Error('TLS_UNVERIFIED');
  if(o.credential==='network-secret'&&o.transport!=='curl-proxy') throw new Error('PROXY_REQUIRED');
  if(typeof o['code-sha256']!=='string'||!/^[a-f0-9]{64}$/.test(o['code-sha256'])
    ||o['code-sha256']!==fingerprint.sha256) throw new Error('CODE_FINGERPRINT_MISMATCH');
  if(process.version!=='v22.16.0') throw new Error('INVALID_EVAL_OPTIONS');
}
/** Read-only guard; no raw old report is parsed, copied, or logged. */
export function legacyGuard(root=ROOT) {
  const paths=['run.lock','report.json'].map(p=>join(root,'eval-results','init005-live',p));
  const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
  let before; try {before=paths.map(hash);} catch {throw new Error('LEGACY_EVIDENCE_REQUIRED');}
  return () => {try{return paths.every((p,i)=>hash(p)===before[i]);}catch{return false;}};
}
export function checkBudget(reserve) {
  if(!Number.isFinite(reserve?.reservedUsd)||reserve.reservedUsd<=0||reserve.reservedUsd>BUDGET_USD
    ||reserve.inputReservationTokens!==LIMITS.inputReservationTokens
    ||!Number.isSafeInteger(reserve.requestBytes)||reserve.requestBytes<1||reserve.requestBytes>LIMITS.maxInputBytes) throw new Error('BUDGET_EXCEEDED');
}
/** One dispatch slot, consumed BEFORE IO; transport or persistence failure never refunds it. */
export function onceTransport(transport,beforeDispatch) {
  let used=false;
  return async (url,init) => {
    if(used) throw new Error('CALL_CAP_EXCEEDED'); used=true;
    beforeDispatch(); return await transport(url,init);
  };
}
const count=n=>Number.isSafeInteger(n)&&n>=0?n:null;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function safeTelemetry(t) {
  if(!t) return null;
  const usage={};
  for(const k of ['prompt_tokens','completion_tokens','total_tokens','prompt_cache_hit_tokens','prompt_cache_miss_tokens','reasoning_tokens']) usage[k]=count(t.usage?.[k]);
  return {outcome:t.outcome==='success'?'success':safeCode({code:t.outcome}),
    httpStatus:Number.isInteger(t.httpStatus)&&t.httpStatus>=100&&t.httpStatus<=599?t.httpStatus:null,
    modelMatch:t.returnedModel===PRICING.model?'expected':t.returnedModel===null?'missing':'different',
    finishReason:['stop','length','content_filter','tool_calls','insufficient_system_resource'].includes(t.finishReason)?t.finishReason:null,
    usage,elapsedMs:count(t.elapsedMs),diagnostic:safeDiagnostic(t.diagnostic)};
}
export async function runDiagnostic(options={}, {env=process.env,mockFactory=simulatedFetchFor}={}) {
  const o={mode:'plan',transport:'native',credential:'direct-secret',...options}; validateOptions(o);
  const live=o.mode==='live',fingerprint=codeFingerprint(); let secret='',transport,legacyUnchanged=()=>true;
  if(live) {
    authorizeDiagnostic(o,env,fingerprint);
    validatePreflight(o.preflight,o.transport); // Reuse accepted date/TLS preflight gate.
    legacyUnchanged=legacyGuard();
    secret=env.DEEPSEEK_API_KEY;
    transport=o.transport==='curl-proxy'?createCurlFetch({env,timeoutMs:LIMITS.timeoutMs}):globalThis.fetch;
  }
  // Free modes never read ambient credentials/config, nor select a live transport.
  const config=readConfig({AI_MODE:'deepseek',DEEPSEEK_MODEL:PRICING.model,AI_MAX_TOKENS:String(LIMITS.maxOutputTokens),AI_TIMEOUT_MS:String(LIMITS.timeoutMs)});
  config.apiKey=live?secret:'INIT006-SIMULATED-NOT-A-KEY'; config.allowPaid=true;
  const fixture=prepareCase(CASES.find(c=>c.id==='C2')); validateRequest(fixture.request);
  const reserve=reservation(buildDeepSeekBody(fixture.request,config)); checkBudget(reserve);
  const dir=live?LIVE_DIR:resolve(o.output??join(ROOT,'eval-results',`init006-c2-${o.mode}`));
  if(o.mode==='plan') mkdirSync(dir,{recursive:true,mode:0o700}); else claimBatch(dir);
  const report={schemaVersion:'init006.eval.1',purpose:PURPOSE,experimentId:EXPERIMENT_ID,caseId:'C2',mode:o.mode,
    codeFingerprint:fingerprint,limits:{calls:1,retries:0,parallelism:1,timeoutMs:LIMITS.timeoutMs,maxOutputTokens:LIMITS.maxOutputTokens,budgetUsd:BUDGET_USD},
    pricingSnapshot:PRICING,priceRecheckDeclared:live,reservation:{requestBytes:reserve.requestBytes,inputReservationTokens:reserve.inputReservationTokens,reservedUsd:reserve.reservedUsd},
    reservationBasis:'ENGINEERING_RESERVE_NOT_ACCOUNT_BILLING_CAP',
    status:'planned',paidAttempts:0,simulatedAttempts:0,reservedUsd:0,telemetry:null,diagnostic:null,error:null,
    stateChecks:null,errorDataPreserved:null,legacyEvidenceUnchanged:live?true:null,tokenCostEstimate:null,actualChargeUsd:null,quality:'NOT_ASSESSED'};
  const save=()=>{try{writePrivateJson(join(dir,o.mode==='plan'?'plan.json':'report.json'),report,[secret]);}catch{throw new Error('OUTPUT_WRITE_FAILED');}};
  save(); if(o.mode==='plan')return report;
  const diagnostic=diagnosticSink(); let telemetry;
  report.reservedUsd=reserve.reservedUsd; report.status='reserved'; save();
  const fetchImpl=onceTransport(live?transport:mockFactory(fixture.request),()=>{
    checkBudget(reserve);
    if(!legacyUnchanged()) throw new Error('LEGACY_CHANGED');
    if(live)report.paidAttempts++;else report.simulatedAttempts++;
    report.status='dispatched'; save();
  });
  try {
    const result=await callDeepSeek(fixture.request,config,{fetchImpl,onTelemetry:t=>{telemetry=t;},onDiagnostic:diagnostic.capture});
    const after=applyResponse(fixture.state,fixture.request,{mode:live?'deepseek':'mock',result},diagnostic.capture);
    if(after.error||after===fixture.state) throw new Error('INVALID_RESPONSE');
    const checked=inspectState(fixture.state,after,fixture.request,result);
    report.stateChecks={...checked.checks,previousSourcesPreserved:equal(after.sources.slice(0,fixture.state.sources.length),fixture.state.sources)};
    if(!Object.values(report.stateChecks).every(Boolean)) { diagnostic.report('state_apply','state','invariant_failed'); throw new Error('STATE_INVARIANT_FAILED'); }
    report.status='validated';
    if(live){const stop=telemetryStopReason(telemetry,config.model);if(stop)throw new Error(stop);}
  } catch(error) {
    report.error=diagnosticErrorCode(error);report.status='failed';
    const after=failRequest(fixture.state,fixture.request,report.error);
    report.errorDataPreserved=equal({...after,pending:fixture.state.pending,error:fixture.state.error},fixture.state);
  }
  report.telemetry=safeTelemetry(telemetry); report.diagnostic=diagnostic.value;
  report.tokenCostEstimate=live?usageCost(report.telemetry?.usage):null;
  if(live){report.legacyEvidenceUnchanged=legacyUnchanged();if(!report.legacyEvidenceUnchanged){report.error='LEGACY_CHANGED';report.status='failed';}}
  save(); return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {const report=await runDiagnostic(parseDiagnosticOptions(process.argv.slice(2)));
    console.log(JSON.stringify({purpose:PURPOSE,caseId:'C2',mode:report.mode,status:report.status,paidAttempts:report.paidAttempts,
      simulatedAttempts:report.simulatedAttempts,error:report.error}));if(report.error)process.exitCode=1;
  }catch(error){console.error(JSON.stringify({error:diagnosticErrorCode(error),automaticRetry:false}));process.exitCode=1;}
}
