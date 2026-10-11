import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ROOT,PURPOSE,RUN_ID,LIVE_DIR,CONTROL_DIR,MOCK_DIR,MOCK_CONTROL,MOCK_PRICES,sha,equal,fail,errorCode,
  readJson,readBytes,codeIdentity,authorizeAssignment,noSymlinks } from './policy.mjs';
import { writeOnce,syncDirectory,newIdentity,openLedger,readLedger } from './ledger.mjs';
import { preparePhase,validatePhase,executeStage,stageGate,answerBundleTemplate,itemReviewTemplate,applyItemReview } from './engine.mjs';
import { loadArtifacts,reviewTemplate,evidenceTemplates,validateReview } from './gates.mjs';
import { openMockHttp,openLiveHttp } from './http.mjs';
import { collect,questions } from './report.mjs';
function stored(root,code,mode){
  const row=readJson(join(root,'journal/000001.json'),'LEDGER_MISSING'),identity=row?.data?.identity;
  if(!identity||identity.mode!==mode||identity.purpose!==PURPOSE||identity.runId!==RUN_ID)fail('LEDGER_IDENTITY_MISMATCH');
  for(const [k,v] of Object.entries(code))if(identity[k]!==v)fail('CODE_FINGERPRINT_MISMATCH');
  return readLedger(root,identity);
}
function controlDirectory(path){noSymlinks(path);mkdirSync(path,{recursive:true,mode:0o700});syncDirectory(path);syncDirectory(dirname(path));}
function phaseFile(control,stage){return join(control,`${stage}-plan.json`);}
function readPlan(control,stage){return readJson(phaseFile(control,stage),'PLAN_REQUIRED',1024*1024);}
function prepare(control,stage,identity,snapshot){
  const path=phaseFile(control,stage);
  if(existsSync(path))return validatePhase(readPlan(control,stage),identity,stage,snapshot);
  const answers=stage==='followups'?readJson(join(control,'answers.json'),'ANSWER_FILE_JSON',524288):null;
  const plan=preparePhase(stage,identity,snapshot,answers);validatePhase(plan,identity,stage,snapshot);
  controlDirectory(control);writeOnce(path,plan);return plan;
}
function reviewed(control,stage,code,expectedHash,snapshot=null){
  const now=Date.now(),plan=readPlan(control,stage),identity={...code,mode:'live'};
  const review=readJson(join(control,`${stage}-review.json`),'REVIEW_REQUIRED',65536);
  const artifacts=loadArtifacts(control,now);
  const result=validateReview(review,expectedHash,plan,identity,artifacts,snapshot,now);
  if(snapshot&&result.legacyHash!==snapshot.data.identity.legacyHash)fail('LEGACY_CHANGED');
  return {plan,review,...result};
}
/** Fixed CLI paths only. Source and reviewed plan are checked again before every durable dispatch. */
export async function operate(command,env){
  const mock=command.startsWith('--mock-'),mode=mock?'mock':'live',root=mock?MOCK_DIR:LIVE_DIR,control=mock?MOCK_CONTROL:CONTROL_DIR;
  const op=command.replace(/^--mock-/,'').replace(/^--/,''),code=codeIdentity();
  if(op==='prepare-firsts'||op==='prepare-followups'){
    const stage=op.slice(8),snapshot=stage==='followups'?stored(root,code,mode):null;
    if(stage==='firsts'&&existsSync(root))fail('LEDGER_EXISTS');
    const plan=prepare(control,stage,{...code,mode},snapshot);
    return {readiness:'prepared-not-authorized',paid:false,generationRequests:0,phasePlanHash:sha(plan),
      phasePlanFile:phaseFile(control,stage),reviewTemplate:reviewTemplate(plan),freshEvidenceTemplates:evidenceTemplates()};
  }
  if(op==='review-only'||op==='review-followups'){
    const stage=op==='review-only'?'firsts':'followups';
    try{
      const snapshot=stage==='followups'?stored(root,code,mode):null;
      const r=reviewed(control,stage,code,env.AFS_INIT009_REVIEW_SHA256,snapshot);
      return {readiness:'keyless-artifacts-valid; Cloud assignment and credential path not checked',paid:false,generationRequests:0,
        phasePlanHash:sha(r.plan),reviewHash:r.reviewHash,allFourReservedUsd:r.allFourReservedNanoUsd/1e9};
    }catch(e){return {readiness:'blocked',blocker:errorCode(e),paid:false,generationRequests:0,credentialRead:false};}
  }
  if(!['firsts','followups'].includes(op)){
    const snapshot=stored(root,code,mode);
    if(op==='collect')return collect(snapshot);
    if(op==='questions')return questions(snapshot);
    if(op==='answer-draft')return answerBundleTemplate(snapshot);
    if(op==='items-draft')return itemReviewTemplate(snapshot);
    if(op==='record-items'){
      const store=openLedger(root,snapshot.data.identity);
      try{return applyItemReview(store,readJson(join(control,'items.json'),'DECISIONS_CONTEXT',524288),
        env.AFS_INIT009_ITEMS_SHA256);}finally{store.close();}
    }
    fail('ARGUMENTS');
  }
  let snapshot=existsSync(root)?stored(root,code,mode):null;
  // Re-entering a done stage does not open transport or inspect credentials/review files.
  if(snapshot&&stageGate(snapshot,op)==='skip')return executeStage(snapshot,op,{});
  if(op==='followups'&&!snapshot)fail('STAGE_ORDER');
  let identity,plan,prices,phaseReviewHash,guard,secret='';
  if(mock){
    identity=snapshot?.data.identity??newIdentity(code,{mode,reviewHash:sha('INIT009 SYNTHETIC MOCK REVIEW'),legacyHash:sha('INIT009 SYNTHETIC LEGACY NO ACTUAL HISTORY')});
    plan=prepare(control,op,identity,snapshot);prices=MOCK_PRICES;phaseReviewHash=sha({synthetic:true,phasePlanHash:sha(plan),prices});
    guard=()=>{if(!equal(codeIdentity(),code)||sha(readPlan(control,op))!==sha(plan))fail('CODE_FINGERPRINT_MISMATCH');};
  }else{
    authorizeAssignment(env); // Does not read key. Fresh artifacts precede credential access.
    const r=reviewed(control,op,code,env.AFS_INIT009_REVIEW_SHA256,snapshot);
    identity=snapshot?.data.identity??newIdentity(code,{mode,reviewHash:r.reviewHash,legacyHash:r.legacyHash});
    plan=r.plan;prices=r.review.prices;phaseReviewHash=r.reviewHash;
    guard=()=>{
      if(!equal(codeIdentity(),code))fail('CODE_FINGERPRINT_MISMATCH');
      const current=reviewed(control,op,code,phaseReviewHash,op==='followups'?snapshot:null);
      if(sha(current.plan)!==sha(plan)||current.legacyHash!==identity.legacyHash)fail('REVIEW_HASH_MISMATCH');
    };
    guard();secret=env.DEEPSEEK_API_KEY;if(!secret)fail('AI_NOT_CONFIGURED');
  }
  guard();
  const store=openLedger(root,identity,{initialize:op==='firsts',secrets:secret?[secret]:[]});
  try{
    const result=await executeStage(store,op,{phasePlan:plan,phaseReviewHash,prices,guard,secrets:secret?[secret]:[],
      openTransport:()=>mock?openMockHttp():openLiveHttp(env)});
    try{guard();}catch(e){
      if(!store.poisoned){const data=structuredClone(store.data);data.halt??={code:errorCode(e),atMs:Date.now(),automaticRetry:false};store.commit(data);}
      throw e;
    }
    return result;
  }finally{secret='';store.close();}
}
