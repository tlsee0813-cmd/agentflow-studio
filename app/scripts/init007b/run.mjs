import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, LIVE_DIR, CONTROL_DIR, MOCK_DIR, LEGACY_ROOT, PURPOSE, RUN_ID, LIMITS, SNAPSHOT,
  sha, fail, errorCode, codeIdentity, reviewTemplate, validateReview, authorizeEnvironment,
  readPreflight, readJson, readBytes, legacySnapshot, equal, nanoCost } from './policy.mjs';
import { openLedger, readLedger, newIdentity } from './ledger.mjs';
import { executeStage, stageGate, answerBundleTemplate, itemReviewTemplate, applyItemReview, inputFailure } from './engine.mjs';
import { openMockHttp, openLiveHttp } from './http.mjs';
import { questions, renderReport } from './report.mjs';
const COMMANDS=['--plan','--mock','--mock-firsts','--mock-followups','--mock-questions','--mock-answer-template',
  '--mock-items-template','--mock-review-items','--mock-collect','--firsts','--followups','--questions','--answer-template',
  '--items-template','--review-items','--collect'];
export function parseCommand(args) {
  if(args.length===0)return '--plan';
  if(args.length!==1||!COMMANDS.includes(args[0]))fail('ARGUMENTS');
  return args[0]==='--mock'?'--mock-firsts':args[0];
}
function storedIdentity(root,code,mode) {
  const row=readJson(join(root,'journal/000001.json'),'LEDGER_MISSING'),old=row?.data?.identity;
  if(!old||old.mode!==mode||old.purpose!==PURPOSE||old.runId!==RUN_ID)fail('LEDGER_IDENTITY_MISMATCH');
  return {...old,...code}; // readLedger compares every fixed source/runtime/fixture/version field.
}
export function readAnswerDocument(store,file) {
  let bytes;
  try {bytes=readBytes(file,524288);return JSON.parse(bytes);}
  catch(e) {
    const code=e instanceof SyntaxError?'ANSWER_FILE_JSON':'ANSWER_FILE_READ';
    inputFailure(store,code,bytes?sha(bytes):null);fail(code);
  }
}
export function makePlan() {
  const identity=codeIdentity();
  return {mode:'plan',paid:false,generationRequests:0,purpose:PURPOSE,runId:RUN_ID,identity,
    limits:LIMITS,liveDirectory:LIVE_DIR,controlDirectory:CONTROL_DIR,legacySource:LEGACY_ROOT,
    mockDirectory:MOCK_DIR,snapshot:{prices:SNAPSHOT,verification:'historical snapshot; fresh review required before live'},
    reservationExample:{oneUsd:nanoCost(40000,4096)/1e9,twelveUsd:nanoCost(40000,4096)*12/1e9,accountBillingHardCap:false},
    coordinatorReviewTemplate:reviewTemplate(identity),commands:COMMANDS,
    automaticApproval:false,liveLedgerCreated:false,quality:'human_review_pending'};
}
/** CLI is the production entry point: no output/id/limit/retry/reset/URL/key/transport switches. */
export async function runCommand(command,{env=process.env}={}) {
  if(!COMMANDS.includes(command))fail('ARGUMENTS');
  if(command==='--mock')command='--mock-firsts';
  if(command==='--plan')return makePlan();
  const mock=command.startsWith('--mock'),mode=mock?'mock':'live';
  const op=command.replace(/^--mock-/,'').replace(/^--/,'');
  const root=mock?MOCK_DIR:LIVE_DIR,control=mock?join(ROOT,'eval-results/init007b-mock-control'):CONTROL_DIR;
  const code=codeIdentity();
  if(!['firsts','followups'].includes(op)) {
    const identity=storedIdentity(root,code,mode),snapshot=readLedger(root,identity);
    if(op==='collect')return renderReport(snapshot);
    if(op==='questions')return questions(snapshot);
    if(op==='answer-template')return answerBundleTemplate(snapshot);
    if(op==='items-template')return itemReviewTemplate(snapshot);
    if(op==='review-items') {
      const store=openLedger(root,identity);
      try {return applyItemReview(store,readJson(join(control,'items.json'),'DECISIONS_CONTEXT',524288));}
      finally {store.close();}
    }
    fail('ARGUMENTS');
  }
  let identity,prices=SNAPSHOT,guard,secret='',preflightHash=null;
  if(mock) {
    identity=newIdentity(code,{mode:'mock',reviewHash:sha({kind:'synthetic-mock-review-only',prices:SNAPSHOT}),
      legacyHash:sha('SYNTHETIC_LEGACY_NOT_REAL_005_OR_006_EVIDENCE')});
    guard=()=>{if(!equal(codeIdentity(),code))fail('CODE_FINGERPRINT_MISMATCH');};
  } else {
    authorizeEnvironment(env);if(process.platform!=='linux')fail('LIVE_NOT_AUTHORIZED');
    const review=readJson(join(CONTROL_DIR,'review.json'),'REVIEW_REQUIRED',32768);
    validateReview(review,env.AFS_INIT007_REVIEW_SHA256,code);
    const legacy=legacySnapshot();
    preflightHash=readPreflight(join(ROOT,'eval-results/preflight-curl-proxy.json'));
    identity=newIdentity(code,{mode:'live',reviewHash:sha(review),legacyHash:legacy.sha256});
    secret=env.DEEPSEEK_API_KEY;prices=review.prices;
    guard=()=>{
      if(!equal(codeIdentity(),code))fail('CODE_FINGERPRINT_MISMATCH');
      const current=readJson(join(CONTROL_DIR,'review.json'),'REVIEW_REQUIRED',32768);
      validateReview(current,identity.reviewHash,code);
      if(readPreflight(join(ROOT,'eval-results/preflight-curl-proxy.json'))!==preflightHash)fail('NETWORK_PROBE_FAILED');
      if(legacySnapshot().sha256!==identity.legacyHash)fail('LEGACY_CHANGED');
    };
  }
  guard();
  // No live directory or ledger exists until all paid/review/preflight/legacy gates above pass.
  const store=openLedger(root,identity,{initialize:op==='firsts',secrets:secret?[secret]:[]});
  try {
    if(stageGate(store,op)==='skip')return await executeStage(store,op,{});
    let answers;
    if(op==='followups') answers=readAnswerDocument(store,join(control,'answers.json'));
    if(preflightHash) {
      const data=structuredClone(store.data);data.events.push({kind:'keyless_preflight_checked',code:null,digest:preflightHash,atMs:Date.now()});store.commit(data);
    }
    let result;
    try {result=await executeStage(store,op,{prices,guard,answers,secrets:secret?[secret]:[],
      openTransport:()=>mock?openMockHttp():openLiveHttp(env)});}
    catch(e) {
      if(!store.poisoned&&['ANSWER_FILE_CONTEXT','ANSWER_FILE_SHAPE','INVALID_ANSWER','UNRESOLVED_PREVIEW',
        'INVALID_RESOLUTION','STALE_RESOLUTION','NO_PREVIEW'].includes(errorCode(e))) inputFailure(store,errorCode(e),sha(answers));
      throw e;
    }
    try {guard();}catch(e) {
      if(!store.poisoned) {
        const data=structuredClone(store.data);data.halt??={code:errorCode(e),atMs:Date.now(),automaticRetry:false};store.commit(data);
      }
      throw e;
    }
    return result;
  }finally {secret='';store.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const result=await runCommand(parseCommand(process.argv.slice(2)));
    console.log(typeof result==='string'?result:JSON.stringify(result,null,2));
    if(result?.halt)process.exitCode=1;
  }catch(e){console.error(JSON.stringify({error:errorCode(e),automaticRetry:false,paidExecutionNotAssumed:true}));process.exitCode=1;}
  finally {delete process.env.ALLOW_PAID_AI;} // Only this assigned child; never exports/publishes parent secrets.
}
