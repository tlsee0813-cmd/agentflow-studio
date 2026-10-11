import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { join, resolve, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../../server/config.mjs';
import { buildDeepSeekBody } from '../../server/providers/deepseek.mjs';
import { validatePreflight } from '../init005/run.mjs';
import { safeCode } from '../init005/safety.mjs';
import { safeDiagnostic } from '../../dist/public/shared/diagnostics.js';
import { SCHEMA_VERSION } from '../../dist/public/shared/contracts.js';
import { SESSION_VERSION } from '../init007a/evaluator.mjs';
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const PURPOSE = 'INIT007-KO-DIALOGUE';
export const RUN_ID = 'INIT007-KO-20261011-01';
export const LIVE_DIR = '/workspace/validation/init007b/live/INIT007-KO-20261011-01';
export const CONTROL_DIR = '/workspace/validation/init007b/control';
export const LEGACY_ROOT = '/workspace/validation/init006/source';
export const MOCK_DIR = join(ROOT, 'eval-results/init007b-mock');
export const MODEL = 'deepseek-flash';
export const PRICE_URL = 'https://api-docs.deepseek.com/quick_start/pricing/';
export const MODEL_URL = 'https://api-docs.deepseek.com/api/create-chat-completion/';
export const LIMITS = Object.freeze({ slots:12, parallelism:1, retries:0, timeoutMs:15000, maxOutputTokens:4096,
  maxBodyBytes:32768, inputReservationTokens:40000, minIntervalMs:12000, rollingWindowMs:60000, rate:6,
  processCap:20, budgetNanoUsd:250000000 });
export const SNAPSHOT = Object.freeze({inputMiss:0.30,inputHit:0.006,output:1.20});
export const PERSONA_IDS = Object.freeze(['p01','p02','p03','p04','p05','p06']);
export const SLOTS = Object.freeze([1,2].flatMap(turn=>PERSONA_IDS.map(personaId=>Object.freeze({id:`${personaId}-${turn}`,personaId,turn}))));
const LOCAL = new Set(['ARGUMENTS','REVIEW_REQUIRED','REVIEW_HASH_MISMATCH','REVIEW_EXPIRED','REVIEW_INVALID',
  'CODE_FINGERPRINT_MISMATCH','FIXTURE_HASH_MISMATCH','STATE_VERSION_MISMATCH','LEGACY_EVIDENCE_REQUIRED','LEGACY_CHANGED',
  'LEDGER_INVALID','LEDGER_IDENTITY_MISMATCH','LEDGER_LOCKED','LEDGER_MISSING','LEDGER_EXISTS','OUTPUT_WRITE_FAILED',
  'UNSAFE_PATH','STATE_HASH_MISMATCH','STATE_INVARIANT_FAILED','STAGE_ALREADY_STARTED','STAGE_ORDER','GLOBAL_HALTED',
  'SLOT_CONSUMED','DISPATCH_MISSING','DISPATCH_REPEATED','CLOCK_ROLLBACK','BODY_MISMATCH','ANSWER_FILE_JSON',
  'ANSWER_FILE_CONTEXT','ANSWER_FILE_SHAPE','ANSWER_FILE_SIZE','ANSWER_FILE_READ','INVALID_ANSWER',
  'RESOLUTION_NOT_READY','NO_PREVIEW','INVALID_RESOLUTION','STALE_RESOLUTION','UNRESOLVED_PREVIEW',
  'ITEM_NOT_READY','INVALID_DECISION','UNRESOLVED_ACCEPTANCE','DECISIONS_CONTEXT','SECRET_CONTENT_BLOCKED',
  'FIXED_FACTS_INSUFFICIENT','FIRST_FAILED','QUESTION_ABSENT','LOCAL_RATE_LIMIT','PROCESS_CALL_CAP','FINISH_NOT_STOP','USAGE_INVALID','TRANSPORT_UNCERTAIN','HTTP_FAILED','MOCK_ONLY','RECOVERY_BLOCKED']);
export const fail = code => { throw new Error(code); };
export const errorCode = e => LOCAL.has(e?.message) ? e.message : safeCode(e);
export const equal = (a,b) => JSON.stringify(a)===JSON.stringify(b);
export const sha = value => createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const isHash = value => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
export function exact(value,keys,code='REVIEW_INVALID') {
  if(!value||typeof value!=='object'||Array.isArray(value)||!equal(Object.keys(value).sort(),[...keys].sort())) fail(code);
}
export function noSymlinks(path) {
  const absolute=resolve(path), parts=[]; let p=absolute;
  while(p!==parse(p).root){parts.unshift(p);p=dirname(p);}
  for(const item of parts) {
    let s;try{s=lstatSync(item);}catch(e){if(e.code==='ENOENT')continue;fail('UNSAFE_PATH');}
    if(s.isSymbolicLink()||(!s.isDirectory()&&(!s.isFile()||s.nlink!==1)))fail('UNSAFE_PATH');
  }
  return absolute;
}
export function readBytes(path,limit=16*1024*1024) {
  noSymlinks(path);const s=lstatSync(path);
  if(!s.isFile()||s.size>limit)fail('UNSAFE_PATH');return readFileSync(path);
}
export function readJson(path,code='LEDGER_INVALID',limit) {
  try{return JSON.parse(readBytes(path,limit).toString('utf8'));}catch(e){if(e.message==='UNSAFE_PATH')throw e;fail(code);}
}
function tree(root,prefix='') {
  return readdirSync(join(root,prefix),{withFileTypes:true}).flatMap(e=>{
    const p=prefix?`${prefix}/${e.name}`:e.name;
    if(e.isSymbolicLink())fail('UNSAFE_PATH');
    return e.isDirectory()?tree(root,p):[{path:p,sha256:sha(readBytes(join(root,p)))}];
  }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export function codeIdentity(root=ROOT) {
  // Closed source roots: no credentials, live evidence, node_modules or .git are inspected.
  const dirs=['.github','docs','fixtures','public','scripts','server','src','tests'];
  const files=dirs.flatMap(d=>tree(join(root,d)).map(f=>({...f,path:`${d}/${f.path}`})));
  for(const p of ['.gitignore','.nvmrc','README.md','THIRD_PARTY_NOTICES.md','package.json','package-lock.json','tsconfig.json'])
    files.push({path:p,sha256:sha(readBytes(join(root,p)))});
  files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const sourceFingerprint=sha(files.map(f=>`${f.sha256}  source/${f.path}\n`).join(''));
  const runtimeFiles=tree(join(root,'dist/public'));
  return {sourceFingerprint,runtimeFingerprint:sha(runtimeFiles),fixtureHash:sha(readBytes(join(root,'fixtures/init007a/personas.json'))),
    projectSchemaVersion:SCHEMA_VERSION,sessionSchemaVersion:SESSION_VERSION,node:process.version};
}
export function experimentConfig(key='INIT007B-SIMULATED-NOT-A-KEY') {
  return readConfig({AI_MODE:'deepseek',ALLOW_PAID_AI:'true',DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:MODEL,
    AI_TIMEOUT_MS:'15000',AI_MAX_TOKENS:'4096',AI_REQUESTS_PER_MINUTE:'6',AI_PROCESS_CALL_CAP:'20',AI_MAX_CONCURRENT:'1',PORT:'0'});
}
export function nanoCost(input,output,prices=SNAPSHOT) {
  return input*Math.round(prices.inputMiss*1000)+output*Math.round(prices.output*1000);
}
export function reserveRequest(request,config,prices) {
  const body=JSON.stringify(buildDeepSeekBody(request,config)), bytes=Buffer.byteLength(body);
  if(bytes>LIMITS.maxBodyBytes || Buffer.byteLength(JSON.stringify(request))>LIMITS.maxBodyBytes) fail('INPUT_TOO_LARGE');
  if(config.model!==MODEL||config.maxTokens!==4096||config.timeoutMs!==15000)fail('BODY_MISMATCH');
  return {bodySha256:sha(body),requestSha256:sha(request),requestBytes:bytes,inputReservationTokens:40000,
    outputReservationTokens:4096,reservedNanoUsd:nanoCost(40000,4096,prices)};
}
export function recentDate(value,now=Date.now()) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const ms=Date.parse(value);
  return Number.isFinite(ms)&&new Date(ms).toISOString()===value&&now>=ms&&now-ms<=86400000;
}
export function reviewTemplate(identity) {
  return {schemaVersion:'init007b.review.1',purpose:PURPOSE,runId:RUN_ID,...identity,
    model:MODEL,prices:SNAPSHOT,priceCheckedAt:null,pricingSource:PRICE_URL,modelSource:MODEL_URL,
    supportCheckedAt:null,supports:{thinkingDisabled:false,jsonObject:false,output4096:false},
    reservation:{inputTokens:40000,maxBodyBytes:32768,maxOutputTokens:4096,engineeringBasisAccepted:false},
    budgetNanoUsd:250000000,coordinatorReviewRef:null};
}
export function validateReview(review,expectedHash,identity,now=Date.now()) {
  if(!isHash(expectedHash)||sha(review)!==expectedHash)fail('REVIEW_HASH_MISMATCH');
  exact(review,Object.keys(reviewTemplate(identity)));
  if(review.schemaVersion!=='init007b.review.1'||review.purpose!==PURPOSE||review.runId!==RUN_ID||review.model!==MODEL
    ||review.pricingSource!==PRICE_URL||review.modelSource!==MODEL_URL||review.budgetNanoUsd!==LIMITS.budgetNanoUsd
    ||!isHash(review.coordinatorReviewRef))fail('REVIEW_INVALID');
  if(review.sourceFingerprint!==identity.sourceFingerprint||review.runtimeFingerprint!==identity.runtimeFingerprint)fail('CODE_FINGERPRINT_MISMATCH');
  if(review.fixtureHash!==identity.fixtureHash)fail('FIXTURE_HASH_MISMATCH');
  if(review.projectSchemaVersion!==SCHEMA_VERSION||review.sessionSchemaVersion!==SESSION_VERSION||review.node!=='v22.16.0')fail('STATE_VERSION_MISMATCH');
  if(!recentDate(review.priceCheckedAt,now)||!recentDate(review.supportCheckedAt,now))fail('REVIEW_EXPIRED');
  if(!equal(review.supports,{thinkingDisabled:true,jsonObject:true,output4096:true})
    ||!equal(review.reservation,{inputTokens:40000,maxBodyBytes:32768,maxOutputTokens:4096,engineeringBasisAccepted:true}))fail('REVIEW_INVALID');
  exact(review.prices,['inputMiss','inputHit','output']);
  for(const n of Object.values(review.prices)) if(!Number.isFinite(n)||n<=0||Math.abs(n*1000-Math.round(n*1000))>1e-6)fail('REVIEW_INVALID');
  if(review.prices.inputHit>review.prices.inputMiss)fail('REVIEW_INVALID');
  if(nanoCost(40000,4096,review.prices)*12>LIMITS.budgetNanoUsd)fail('BUDGET_EXCEEDED');
  return review;
}
export function authorizeEnvironment(env) {
  if(env.ALLOW_PAID_AI!=='true'||env.AFS_INIT007_ASSIGNMENT!==RUN_ID||env.AFS_INIT007_APPROVED_USD!=='0.25'
    ||env.AFS_INIT007_CREDENTIAL!=='network-secret')fail('LIVE_NOT_AUTHORIZED');
  if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0')fail('TLS_UNVERIFIED');
  if(process.version!=='v22.16.0')fail('LIVE_NOT_AUTHORIZED');
  if(!env.DEEPSEEK_API_KEY)fail('AI_NOT_CONFIGURED');
  if(!env.https_proxy&&!env.HTTPS_PROXY)fail('PROXY_REQUIRED');
}
export function readPreflight(path) {
  validatePreflight(path,'curl-proxy'); // Accepted INIT005 date/TLS/keyless contract, unchanged.
  return sha(readBytes(path));
}
/** Required real history is never manufactured. Test roots must contain explicitly synthetic legacy files. */
export function legacySnapshot(root=LEGACY_ROOT, syntheticBaseline=null) {
  const baseline=syntheticBaseline??readJson(fileURLToPath(new URL('../../fixtures/init007b/init006-source-hashes.json',import.meta.url)));
  const files=[];
  try {
    for(const [path,expected] of Object.entries(baseline)) {
      const digest=sha(readBytes(join(root,path)));if(digest!==expected)fail('LEGACY_CHANGED');
      files.push({path,sha256:digest});
    }
    for(const dir of ['init005-live','init006-c2-diagnostic']) {
      for(const name of ['run.lock','report.json'])readBytes(join(root,'eval-results',dir,name));
      for(const f of tree(join(root,'eval-results',dir))) files.push({path:`eval-results/${dir}/${f.path}`,sha256:f.sha256});
    }
  }catch(e){if(e.message==='LEGACY_CHANGED')throw e;fail('LEGACY_EVIDENCE_REQUIRED');}
  return {root:realpathSync(root),sha256:sha(files),files};
}
const count = value => Number.isSafeInteger(value)&&value>=0?value:null;
export function telemetry(t) {
  if(!t)return null;
  const usage={};for(const k of ['prompt_tokens','completion_tokens','total_tokens','prompt_cache_hit_tokens','prompt_cache_miss_tokens','reasoning_tokens'])usage[k]=count(t.usage?.[k]);
  return {outcome:t.outcome==='success'?'success':safeCode({code:t.outcome}),
    httpStatus:Number.isInteger(t.httpStatus)&&t.httpStatus>=100&&t.httpStatus<=599?t.httpStatus:null,
    requestedModel:t.requestedModel===MODEL?MODEL:null,returnedModel:t.returnedModel===MODEL?MODEL:null,
    modelMatch:t.returnedModel===MODEL?'expected':t.returnedModel!=null||t.modelMatch==='different'?'different':'missing',
    finishReason:['stop','length','content_filter','tool_calls','insufficient_system_resource'].includes(t.finishReason)?t.finishReason:null,
    usage,elapsedMs:count(t.elapsedMs),diagnostic:safeDiagnostic(t.diagnostic)};
}
export function telemetryHalt(t) {
  if(!t) return 'TELEMETRY_INCOMPLETE';
  if(t.httpStatus!==200) return t.outcome==='success'?'HTTP_FAILED':t.outcome;
  if(t.modelMatch!=='expected'||t.requestedModel!==MODEL)return 'MODEL_CHANGED';
  const u=t.usage;
  if(!u||!Number.isSafeInteger(u.prompt_tokens)||u.prompt_tokens<0||!Number.isSafeInteger(u.completion_tokens)||u.completion_tokens<0
    ||!Number.isSafeInteger(u.total_tokens)||u.total_tokens!==u.prompt_tokens+u.completion_tokens) return 'USAGE_INVALID';
  if(u.prompt_cache_hit_tokens!==null&&u.prompt_cache_miss_tokens!==null
    &&u.prompt_cache_hit_tokens+u.prompt_cache_miss_tokens!==u.prompt_tokens)return 'USAGE_INVALID';
  if(u.prompt_tokens>40000)return 'INPUT_RESERVE_EXCEEDED';if(u.completion_tokens>4096)return 'OUTPUT_CAP_EXCEEDED';
  if(t.finishReason!=='stop')return 'FINISH_NOT_STOP';
  if(!['success','INVALID_RESPONSE'].includes(t.outcome))return t.outcome;
  return null;
}
export function failurePolicy(t,diagnostic,code) {
  const halt=telemetryHalt(t);if(halt)return {scope:'global',code:halt};
  const d=safeDiagnostic(diagnostic??t.diagnostic);
  if(code==='INVALID_RESPONSE'&&d&&['provider_envelope','content_parse','result_contract','state_contract'].includes(d.stage))
    return {scope:'case',code:'INVALID_RESPONSE'};
  return {scope:'global',code:code==='INVALID_RESPONSE'?'STATE_INVARIANT_FAILED':code};
}
export function budgetAvailable(ledger,reserve) {
  const consumed=ledger.slots.filter(s=>s.reservation);
  if(consumed.length>=12)fail('CALL_CAP_EXCEEDED');
  const total=consumed.reduce((n,s)=>n+s.reservation.reservedNanoUsd,0)+reserve.reservedNanoUsd;
  if(!Number.isSafeInteger(total)||total>LIMITS.budgetNanoUsd||reserve.reservedNanoUsd<=0)fail('BUDGET_EXCEEDED');
}
export function rateDelay(slots,now) {
  const starts=slots.map(s=>s.startedAtMs).filter(n=>n!==null&&n!==undefined).sort((a,b)=>a-b);
  if(starts.some(n=>!Number.isSafeInteger(n)||n>now))fail('CLOCK_ROLLBACK');
  const recent=starts.filter(n=>now-n<LIMITS.rollingWindowMs);
  // The durable dispatch timestamp precedes fsync and upstream IO. A completed
  // response is an upper bound on actual send time, so use its persisted end
  // time as an additional conservative floor (also across process restarts).
  const ends=slots.filter(s=>s.startedAtMs!==null&&s.startedAtMs!==undefined&&s.endedAtMs!=null).map(s=>s.endedAtMs);
  if(ends.some(n=>!Number.isSafeInteger(n)||n>now))fail('CLOCK_ROLLBACK');
  const anchor=Math.max(...starts,...ends);
  return Math.max(0,Number.isFinite(anchor)?anchor+12000-now:0,recent.length>=6?recent[recent.length-6]+60000-now:0);
}
export function rejectSecretContent(value,secrets=[]) {
  const text=JSON.stringify(value);
  if(secrets.some(s=>s&&text.includes(s))||/\bsk-[A-Za-z0-9_-]{8,}|\bBearer\s+[A-Za-z0-9._-]{8,}/.test(text))fail('SECRET_CONTENT_BLOCKED');
}
