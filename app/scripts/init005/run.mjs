import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CASES, prepareCase } from './cases.mjs';
import { LIMITS, PRICING, reservation, costUsd, usageCost } from './cost.mjs';
import { authorizeLive, claimBatch, writePrivateJson, scrub, safeCode } from './safety.mjs';
import { createCurlFetch } from './curl-fetch.mjs';
import { callDeepSeek, buildDeepSeekBody } from '../../server/providers/deepseek.mjs';
import { readConfig } from '../../server/config.mjs';
import { mockInterview } from '../../server/providers/mock.mjs';
import { applyResponse, failRequest } from '../../dist/public/shared/project.js';
import { validateRequest } from '../../dist/public/shared/validation.js';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export function parseOptions(args) {
  const o={mode:'mock',limit:6,transport:'native',credential:'direct-secret'};
  let modes=0;
  for(const arg of args) {
    if(['--mock','--plan','--live'].includes(arg)){o.mode=arg.slice(2);modes++;}
    else if(arg.startsWith('--limit=')) o.limit=Number(arg.slice(8));
    else if(arg.startsWith('--approve=')) o.approve=arg.slice(10);
    else if(arg.startsWith('--transport=')) o.transport=arg.slice(12);
    else if(arg.startsWith('--credential=')) o.credential=arg.slice(13);
    else if(arg.startsWith('--output=')) o.output=arg.slice(9);
    else if(arg.startsWith('--preflight=')) o.preflight=arg.slice(12);
    else throw new Error('INVALID_EVAL_OPTIONS');
  }
  if(modes>1||!Number.isInteger(o.limit)||o.limit<1||o.limit>6||!['native','curl-proxy'].includes(o.transport)
    ||(o.mode==='live' && o.output)) throw new Error('INVALID_EVAL_OPTIONS');
  return o;
}
export function simulatedFetchFor(request) {
  return async () => new Response(JSON.stringify({model:'deepseek-flash',
    usage:{prompt_tokens:1000,completion_tokens:500,total_tokens:1500,prompt_cache_hit_tokens:0,prompt_cache_miss_tokens:1000},
    choices:[{finish_reason:'stop',message:{content:JSON.stringify(mockInterview(request))}}]}),{status:200});
}
const equality=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function inspectState(before,after,request,result) {
  const protectedFields=['id','text','acceptance','status','locked','priority'];
  const retained=before.requirements.filter(r=>r.locked||r.status!=='proposed').every(r=>{
    const next=after.requirements.find(n=>n.id===r.id);
    return next && protectedFields.every(k=>equality(next[k],r[k])) && r.sourceIds.every(s=>next.sourceIds.includes(s));
  });
  const fresh=after.requirements.filter(r=>!before.requirements.some(b=>b.id===r.id));
  const checks={inputPreserved:equality(before.brief,after.brief),answersPreserved:equality(before.answers,after.answers),
    protectedPairsPreserved:retained,conflictsPreserved:equality(before.conflicts,after.conflicts),
    suggestionsNotAutoConfirmed:fresh.every(r=>r.status==='proposed'),
    projectScope:after.requirements.every(r=>r.scope==='user-project'),
    boundedRequirements:after.requirements.every(r=>r.text.length<=800&&r.acceptance.length<=800),
    boundedTurn:request.stage!=='summarize'||result.question===null};
  const prior=before.requirements.find(r=>r.id.endsWith(':REQ-proposal-core-flow'));
  const next=after.requirements.find(r=>r.id.endsWith(':REQ-proposal-core-flow'));
  return {checks,pass:Object.values(checks).every(Boolean),
    refinementSignals:prior && next ? {sameId:prior.id===next.id,textChanged:prior.text!==next.text,
      acceptanceChanged:prior.acceptance!==next.acceptance,acceptanceStillTbd:next.acceptance.startsWith('TBD:'),
      newestAnswerCited:request.answers.length ? next.sourceIds.includes(request.answers.at(-1).sourceId):null}:null};
}
export function validatePreflight(path,transport) {
  let p;try{p=JSON.parse(readFileSync(path,'utf8'));}catch{throw new Error('NETWORK_PROBE_FAILED');}
  // Accept only the UTC millisecond format emitted by externalProbe(). Parsing
  // alone accepts ambiguous strings and normalizes some impossible calendar dates.
  if(!p || typeof p!=='object' || Array.isArray(p) || typeof p.checkedAt!=='string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.checkedAt)) throw new Error('NETWORK_PROBE_FAILED');
  const checkedAtMs=Date.parse(p.checkedAt);
  if(!Number.isFinite(checkedAtMs) || new Date(checkedAtMs).toISOString()!==p.checkedAt) throw new Error('NETWORK_PROBE_FAILED');
  const age=Date.now()-checkedAtMs;
  if(!Number.isFinite(age)) throw new Error('NETWORK_PROBE_FAILED');
  if(p.kind!=='keyless-external-probe'||p.transport!==transport||p.node!=='v22.16.0'
    ||p.target!=='https://api.deepseek.com/models'||!p.reachedHttp||age<0||age>86400000||p.authSent!==false) throw new Error('NETWORK_PROBE_FAILED');
  // A connectivity observation is NOT proof of authentication or placeholder replacement.
}
export function telemetryStopReason(telemetry,model) {
  if (!telemetry?.returnedModel || !Number.isSafeInteger(telemetry?.usage?.prompt_tokens)
      || !Number.isSafeInteger(telemetry?.usage?.completion_tokens)) return 'TELEMETRY_INCOMPLETE';
  if (telemetry.returnedModel !== model) return 'MODEL_CHANGED';
  if (telemetry.usage.prompt_tokens > LIMITS.inputReservationTokens) return 'INPUT_RESERVE_EXCEEDED';
  if (telemetry.usage.completion_tokens > LIMITS.maxOutputTokens) return 'OUTPUT_CAP_EXCEEDED';
  return null;
}
function codeFingerprint() {
  const paths=['server/providers/deepseek.mjs','server/prompt.mjs','src/shared/project.ts','src/shared/contracts.ts','src/shared/validation.ts',
    'scripts/init005/run.mjs','scripts/init005/cases.mjs','scripts/init005/cost.mjs','scripts/init005/safety.mjs','scripts/init005/curl-fetch.mjs'];
  const files=paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(join(ROOT,path))).digest('hex')}));
  return {sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),files};
}
export async function runEvaluation(options={}, {env=process.env, mockFactory=simulatedFetchFor}={}) {
  const mode=options.mode ?? 'mock', live=mode==='live', limit=options.limit ?? 6;
  if(!['mock','plan','live'].includes(mode)||!Number.isInteger(limit)||limit<1||limit>6) throw new Error('INVALID_EVAL_OPTIONS');
  let secret='', liveFetch;
  if(live) {
    authorizeLive({...options,live:true},env);
    if(process.version!=='v22.16.0') throw new Error('INVALID_EVAL_OPTIONS');
    validatePreflight(options.preflight,options.transport);
    secret=env.DEEPSEEK_API_KEY;
    liveFetch=options.transport==='curl-proxy' ? createCurlFetch({env,timeoutMs:LIMITS.timeoutMs}) : globalThis.fetch;
  }
  // In mock/plan ignore all key/model/provider env overrides. No accidental paid path.
  const config=readConfig({AI_MODE:'deepseek',DEEPSEEK_MODEL:'deepseek-flash',
    AI_MAX_TOKENS:String(LIMITS.maxOutputTokens),AI_TIMEOUT_MS:String(LIMITS.timeoutMs)});
  config.apiKey=live?secret:'INIT005-SIMULATED-NOT-A-KEY';config.allowPaid=true;
  const prepared=CASES.slice(0,limit).map(c=>{
    const fixture=prepareCase(c);validateRequest(fixture.request);
    const body=buildDeepSeekBody(fixture.request,config);
    return {c,fixture,body,reservation:reservation(body)};
  });
  const dir=live?join(ROOT,'eval-results','init005-live'):
    resolve(options.output || join(ROOT,'eval-results',`init005-${mode}-${Date.now()}`));
  if(live)claimBatch(dir);else mkdirSync(dir,{recursive:true,mode:0o700});
  const report={schemaVersion:'init005.eval.1',mode,simulated:!live,baseCommit:'4caa0914d4520c76cdd0380bbb1a3c1941ab0451',
    codeFingerprint:codeFingerprint(),node:process.version,startedAt:new Date().toISOString(),transport:live?options.transport:'injected-mock',limits:LIMITS,pricing:PRICING,rateRecheckDeclared:live,
    billedEndpointAttempts:0,simulatedAttempts:0,reservedUsd:0,actualChargeUsd:null,stopReason:null,
    scope:'Six single-call checkpoints. Prior turns explicitly fixture-generated; NOT a six-conversation live E2E or real-user study.',cases:[]};
  const save=()=>{try{writePrivateJson(join(dir,'report.json'),report,[secret]);}catch{throw new Error('OUTPUT_WRITE_FAILED');}};
  save();let attempts=0;
  for(const {c,fixture,body,reservation:reserve} of prepared) {
    const row={caseId:c.id,name:c.name,stage:fixture.request.stage,seededPriorTurns:fixture.seededPriorTurns,
      expected:c.expected,failureCriteria:c.failure,reservation:reserve,
      bodySha256:createHash('sha256').update(JSON.stringify(body)).digest('hex'),
      input:fixture.request,requirementsBefore:fixture.state.requirements,conflictsBefore:fixture.state.conflicts,
      status:'planned',telemetry:null,result:null,requirementsAfter:null,conflictsAfter:null,automatic:null,
      humanReview:{status:'pending',dimensions:{noRedundantQuestions:null,importantUnknownFirst:null,clearChoices:null,answerToRequirementAndAcceptance:null,statusSeparation:null},
        rationale:null,failures:[],note:'0=fail,1=partial,2=useful; use evidence and n/a where the checkpoint does not exercise a dimension. Mock never passes AI quality.'}};
    report.cases.push(row);if(mode==='plan'){save();continue;}
    if(attempts>=6){report.stopReason='CALL_CAP_EXCEEDED';break;}
    if(report.reservedUsd+reserve.reservedUsd>LIMITS.budgetUsd){report.stopReason='BUDGET_EXCEEDED';break;}
    report.reservedUsd=Number((report.reservedUsd+reserve.reservedUsd).toFixed(10));row.status='reserved';save(); // Persist before dispatch; uncertain calls never refunded/retried.
    const transport=live?liveFetch:mockFactory(fixture.request,c);
    let used=false;
    const metered=async (url,init)=>{
      if(used||attempts>=6)throw new Error('CALL_CAP_EXCEEDED');used=true;attempts++;
      if(live)report.billedEndpointAttempts++;else report.simulatedAttempts++;
      row.status='dispatched';save();return await transport(url,init);
    };
    try {
      const result=await callDeepSeek(fixture.request,config,{fetchImpl:metered,onTelemetry:t=>{row.telemetry=t;}});
      const after=applyResponse(fixture.state,fixture.request,{mode:live?'deepseek':'mock',result});
      if(after.error)throw new Error('INVALID_RESPONSE');
      row.result=result;row.questionPresentation=result.question?.topic==='storage'?'service-canonical-template':'provider-result';row.requirementsAfter=after.requirements;row.conflictsAfter=after.conflicts;
      row.automatic=inspectState(fixture.state,after,fixture.request,result);row.status=row.automatic.pass?'response_validated':'state_invariant_failed';
      row.tokenCostEstimate=live?usageCost(row.telemetry?.usage):null;
      if(!row.automatic.pass)report.stopReason='INVALID_RESPONSE';
      if(live) report.stopReason ||= telemetryStopReason(row.telemetry,config.model);
    } catch(e) {
      const code=safeCode(e); const after=failRequest(fixture.state,fixture.request,code);
      row.status='failed';row.error={code};row.requirementsAfter=after.requirements;row.conflictsAfter=after.conflicts;
      row.errorDataPreserved=equality(after.requirements,fixture.state.requirements)&&equality(after.answers,fixture.state.answers)&&equality(after.brief,fixture.state.brief);
      report.stopReason=code;
    }
    row.tokenCostEstimate=live?usageCost(row.telemetry?.usage):null;
    save();if(report.stopReason)break; // stop-on-first failure; never retry or silently substitute a mock.
  }
  report.finishedAt=new Date().toISOString();report.completedWithoutError=!report.stopReason;
  report.costCeilingReservationUsd=costUsd(LIMITS.inputReservationTokens*limit,LIMITS.maxOutputTokens*limit);
  report.unattemptedCases=CASES.slice(0,limit).filter(c=>!report.cases.some(r=>r.caseId===c.id&&['response_validated','failed','state_invariant_failed'].includes(r.status))).map(c=>c.id);
  save();return scrub({directory:dir,report},[secret]);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { const result=await runEvaluation(parseOptions(process.argv.slice(2)));console.log(JSON.stringify({mode:result.report.mode,
    cases:result.report.cases.length,paidAttempts:result.report.billedEndpointAttempts,simulatedAttempts:result.report.simulatedAttempts,
    stopReason:result.report.stopReason,quality:'UNASSESSED',report:join(result.directory,'report.json')}));
    if(result.report.stopReason)process.exitCode=1;
  }catch(e){console.error(JSON.stringify({error:safeCode(e),paidRunNotAssumed:true}));process.exitCode=1;}
}
