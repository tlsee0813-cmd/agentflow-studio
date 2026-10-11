import { setTimeout as sleep } from 'node:timers/promises';
import { beginRequest, applyResponse, failRequest } from '../../dist/public/shared/project.js';
import { validateEnvelope } from '../../dist/public/shared/validation.js';
import { diagnosticSink } from '../../dist/public/shared/diagnostics.js';
import { createSession, answerTemplate, submitAnswers, previewResolution, cancelResolution, confirmResolution, reviewItem } from '../init007a/evaluator.mjs';
import { inspectState } from '../init005/run.mjs';
import { PURPOSE, RUN_ID, PERSONA_IDS, LIMITS, fail, equal, exact, sha, errorCode, reserveRequest,
  budgetAvailable, rateDelay, nanoCost, telemetryHalt, telemetry as safeTelemetry, failurePolicy, rejectSecretContent } from './policy.mjs';
const copy=v=>structuredClone(v);
const slotFor=(data,id,turn)=>data.slots.find(s=>s.personaId===id&&s.turn===turn);
export function sessionFor(id,mode) {
  const session=createSession(id);session.mode=mode==='live'?'deepseek':'mock';
  session.evidenceKind=mode==='live'?'SYNTHETIC persona; real provider; not real customer approval':'SYNTHETIC persona; mock upstream; no paid calls';
  return session;
}
export function answerBundleTemplate(store) {
  return {schemaVersion:'init007b.answers.1',purpose:PURPOSE,runId:RUN_ID,
    codeFingerprint:store.data.identity.sourceFingerprint,runtimeFingerprint:store.data.identity.runtimeFingerprint,
    fixtureHash:store.data.identity.fixtureHash,cases:PERSONA_IDS.flatMap(id=>{
      const s=store.sessions[id],slot=slotFor(store.data,id,2);
      if(!s||s.phase!=='awaiting_answer'||slot.status!=='pending')return [];
      return [{personaId:id,firstStateHash:sha(s.snapshots.first),firstQuestionHash:sha(s.snapshots.first.question),
        action:'answer',answerDocument:answerTemplate(s),resolutionActions:[]}];
    })};
}
function checkBundleHeader(document,store,version,keys) {
  exact(document,keys,'ANSWER_FILE_CONTEXT');
  const i=store.data.identity;
  if(document.schemaVersion!==version||document.purpose!==PURPOSE||document.runId!==RUN_ID
    ||document.codeFingerprint!==i.sourceFingerprint||document.runtimeFingerprint!==i.runtimeFingerprint||document.fixtureHash!==i.fixtureHash)fail('ANSWER_FILE_CONTEXT');
}
export function prepareAnswers(store,document) {
  const template=answerBundleTemplate(store);
  checkBundleHeader(document,store,'init007b.answers.1',Object.keys(template));
  if(!Array.isArray(document.cases)||document.cases.length!==template.cases.length)fail('ANSWER_FILE_SHAPE');
  const expected=template.cases.map(c=>c.personaId),seen=new Set(),changed={},skips=[],digests={};
  for(const row of document.cases) {
    exact(row,['personaId','firstStateHash','firstQuestionHash','action','answerDocument','resolutionActions'],'ANSWER_FILE_SHAPE');
    if(!expected.includes(row.personaId)||seen.has(row.personaId))fail('ANSWER_FILE_CONTEXT');seen.add(row.personaId);
    const s=copy(store.sessions[row.personaId]);
    if(row.firstStateHash!==sha(s.snapshots.first)||row.firstQuestionHash!==sha(s.snapshots.first.question)
      ||!s.snapshots.first.question||!equal(s.state,s.snapshots.first))fail('ANSWER_FILE_CONTEXT');
    if(!Array.isArray(row.resolutionActions)||row.resolutionActions.length>8)fail('ANSWER_FILE_SHAPE');
    digests[row.personaId]=sha(row);
    if(row.action==='skip') {
      if(row.answerDocument!==null||row.resolutionActions.length)fail('ANSWER_FILE_SHAPE');skips.push(row.personaId);continue;
    }
    if(row.action!=='answer')fail('ANSWER_FILE_SHAPE');
    submitAnswers(s,row.answerDocument); // All A file/context/1500/revision/source/atomic guards remain in use.
    for(const action of row.resolutionActions) {
      if(action.action==='preview') {
        exact(action,['action','requirementId','choice'],'ANSWER_FILE_SHAPE');
        if(!['apply','keep'].includes(action.choice))fail('ANSWER_FILE_SHAPE');
        previewResolution(s,action.requirementId,action.choice);
      } else {
        exact(action,['action'],'ANSWER_FILE_SHAPE');
        if(action.action==='cancel')cancelResolution(s);
        else if(action.action==='confirm')confirmResolution(s);
        else fail('ANSWER_FILE_SHAPE');
      }
    }
    if(s.preview)fail('UNRESOLVED_PREVIEW');
    rejectSecretContent(s);
    changed[row.personaId]=s;
  }
  return {changed,skips,digests,documentHash:sha(document)};
}
export function inputFailure(store,code,digest,now=Date.now) {
  const data=copy(store.data);data.events.push({kind:'input_rejected',code,digest,atMs:now()});store.commit(data);
}
function markHalt(data,code,now) {
  data.halt??={code,atMs:now(),automaticRetry:false};
}
function summary(store,startedCount=0) {
  const slots=store.data.slots;
  return {purpose:PURPOSE,runId:RUN_ID,mode:store.data.identity.mode,stages:store.data.stages,halt:store.data.halt,
    dispatchesThisInvocation:slots.filter(s=>s.startedAtMs!==null).length-startedCount,
    totalDispatched:slots.filter(s=>s.startedAtMs!==null).length,reservedSlots:slots.filter(s=>s.reservation).length,
    reservedUsd:slots.reduce((n,s)=>n+(s.reservation?.reservedNanoUsd??0),0)/1e9,actualChargeUsd:null,
    quality:'human_review_pending',ledgerHead:store.head};
}
/** Persistent stage gates precede construction of any transport. Re-entering a
 * completed stage is a generation-zero no-op; a started/incomplete stage is refused. */
export function stageGate(store,stage) {
  if(!['firsts','followups'].includes(stage))fail('ARGUMENTS');
  if(store.data.halt)fail('GLOBAL_HALTED');
  if(store.data.stages[stage]==='done')return 'skip';
  if(Object.values(store.data.stages).includes('running'))fail('STAGE_ALREADY_STARTED');
  if(stage==='followups'&&store.data.stages.firsts!=='done')fail('STAGE_ORDER');
  if(store.data.slots.some(s=>['reserved','dispatched'].includes(s.status)))fail('RECOVERY_BLOCKED');
  return 'ready';
}
export async function executeStage(store,stage,{openTransport,prices,guard=()=>{},answers,
  now=Date.now,wait=sleep,secrets=[]}={}) {
  const startCount=store.data.slots.filter(s=>s.startedAtMs!==null).length;
  if(stageGate(store,stage)==='skip')return summary(store,startCount);
  let prepared;
  if(stage==='followups')prepared=prepareAnswers(store,answers); // Entire input bundle is atomic, before slots or HTTP.
  guard();
  let data=copy(store.data);
  if(stage==='firsts') {
    const sessions=Object.fromEntries(PERSONA_IDS.map(id=>[id,sessionFor(id,data.identity.mode)]));
    store.commit(data,sessions);
  } else {
    for(const [id,digest] of Object.entries(prepared.digests))slotFor(data,id,2).answerHash=digest;
    for(const id of prepared.skips){const slot=slotFor(data,id,2);slot.status='skipped';slot.failure={scope:'skip',code:'FIXED_FACTS_INSUFFICIENT'};}
    data.events.push({kind:'answers_validated',code:null,digest:prepared.documentHash,atMs:now()});
    store.commit(data,prepared.changed);
  }
  data=copy(store.data);data.stages[stage]='running';store.commit(data);
  let transport;
  try {
    // Lazy: a generation-zero stage/no-op does not even open the HTTP/provider transport.
    if(store.data.slots.some(s=>s.turn===(stage==='firsts'?1:2)&&s.status==='pending'))transport=await openTransport();
    for(const id of PERSONA_IDS) {
      const turn=stage==='firsts'?1:2;
      if(slotFor(store.data,id,turn).status!=='pending')continue;
      await dispatchSlot(store,id,turn,transport,{prices,guard,now,wait,secrets});
      if(store.data.halt)break;
    }
    if(!store.data.halt){data=copy(store.data);data.stages[stage]='done';store.commit(data);}
  }catch(e) {
    if(store.poisoned)throw e;
    data=copy(store.data);markHalt(data,errorCode(e),now);store.commit(data);
  }finally{await transport?.close();}
  return summary(store,startCount);
}
export async function dispatchSlot(store,id,turn,transport,{prices,guard,now,wait,secrets}) {
  guard();
  const session=copy(store.sessions[id]);
  if(session.phase!==(turn===1?'ready_first':'ready_second')||session.preview||session.generations.some(g=>g.turn===turn))fail('STATE_INVARIANT_FAILED');
  const {state,request}=beginRequest(session.state);
  const reserve=reserveRequest(request,transport.config,prices);budgetAvailable(store.data,reserve);
  const generation={turn,transport:transport.kind,request:copy(request),status:'reserved',diagnostics:[]};
  session.state=state;session.phase='in_flight';session.generations.push(generation);
  let data=copy(store.data),slot=slotFor(data,id,turn);
  Object.assign(slot,{status:'reserved',reservation:reserve,requestIdHash:sha(request.requestId),baseVersion:request.baseVersion,reservedAtMs:now()});
  store.commit(data,{[id]:session}); // No local HTTP and no upstream dispatch before durable reservation + state.
  let raw;
  try {
    for(let delay=rateDelay(store.data.slots,now());delay>0;delay=rateDelay(store.data.slots,now()))await wait(delay);
    guard();
    raw=await transport.generate(request,{reservation:reserve,onDispatch:()=>{
      guard();
      if(slotFor(store.data,id,turn).status!=='reserved')fail('SLOT_CONSUMED');
      if(rateDelay(store.data.slots,now())>0)fail('CLOCK_ROLLBACK');
      // Body and budget were reserved; the reservation is never refunded, including on timeout.
      const d=copy(store.data),s=slotFor(d,id,turn);s.status='dispatched';s.startedAtMs=now();
      generation.status='in_flight';store.commit(d,{[id]:session});
    }});
  }catch(e){if(store.poisoned)throw e;raw={status:null,body:null,telemetry:null,dispatchError:errorCode(e)};}
  if(store.poisoned)fail('OUTPUT_WRITE_FAILED');
  data=copy(store.data);slot=slotFor(data,id,turn);
  slot.endedAtMs=now();slot.httpStatus=Number.isInteger(raw.status)?raw.status:null;slot.telemetry=safeTelemetry(raw.telemetry);
  const diagnostic=diagnosticSink();let failure=null,envelope,next;
  if(raw.dispatchError)failure={scope:'global',code:errorCode(new Error(raw.dispatchError))};
  else if(slot.startedAtMs===null) {
    const safeLocal=['LOCAL_RATE_LIMIT','PROCESS_CALL_CAP','AI_NOT_CONFIGURED','PAID_CALLS_DISABLED','INPUT_TOO_LARGE'];
    const code=raw.body?.error?.code;failure={scope:'global',code:safeLocal.includes(code)?code:'DISPATCH_MISSING'};
  }
  else {
    const halt=telemetryHalt(slot.telemetry);
    if(halt)failure={scope:'global',code:halt};
    else if(raw.status!==200)failure=failurePolicy(slot.telemetry,slot.telemetry.diagnostic,
      slot.telemetry.outcome==='INVALID_RESPONSE'?'INVALID_RESPONSE':'HTTP_FAILED');
    else {
      try {
        envelope=validateEnvelope(raw.body,request,diagnostic.capture);
        if(envelope.mode!==(data.identity.mode==='live'?'deepseek':'mock'))fail('STATE_INVARIANT_FAILED');
        rejectSecretContent(envelope,secrets);
        next=applyResponse(state,request,envelope,diagnostic.capture);
        if(next.error||next.pending||next===state)fail('INVALID_RESPONSE');
        const checked=inspectState(state,next,request,envelope.result);
        if(!checked.pass||!equal(next.sources.slice(0,state.sources.length),state.sources))fail('STATE_INVARIANT_FAILED');
      }catch(e){failure=failurePolicy(slot.telemetry,diagnostic.value,errorCode(e));}
    }
  }
  slot.diagnostic=diagnostic.value??slot.telemetry?.diagnostic??null;
  if(slot.diagnostic)generation.diagnostics.push(slot.diagnostic);
  generation.httpStatus=raw.status;
  const usage=slot.telemetry?.usage;
  if(slot.telemetry?.httpStatus===200&&slot.telemetry?.modelMatch==='expected'&&usage
    &&[usage.prompt_tokens,usage.completion_tokens,usage.total_tokens].every(n=>Number.isSafeInteger(n)&&n>=0)
    &&usage.total_tokens===usage.prompt_tokens+usage.completion_tokens) {
    const estimate=nanoCost(usage.prompt_tokens,usage.completion_tokens,prices);
    if(Number.isSafeInteger(estimate))slot.conservativeCostNanoUsd=estimate; // Includes failed/truncated but measurable usage; never refunds reservation.
  }
  if(failure) {
    slot.status='failed';slot.failure=failure;generation.status='rejected';generation.errorCode=failure.code;
    session.state=failRequest(state,request,failure.code);session.phase='failed';
    if(failure.scope==='global')markHalt(data,failure.code,now);
  } else {
    slot.status='succeeded';generation.status='succeeded';generation.validatedEnvelope=copy(envelope);session.state=next;
    if(turn===1){session.snapshots.first=copy(next);session.phase=next.question?'awaiting_answer':'question_absent';}
    else{session.snapshots.second=copy(next);session.phase='completed';}
  }
  if(turn===1&&(failure||session.phase==='question_absent')) {
    const followup=slotFor(data,id,2);followup.status='skipped';followup.failure={scope:'skip',code:failure?'FIRST_FAILED':'QUESTION_ABSENT'};
  }
  store.commit(data,{[id]:session});
}
export function itemReviewTemplate(store) {
  return {schemaVersion:'init007b.items.1',purpose:PURPOSE,runId:RUN_ID,
    codeFingerprint:store.data.identity.sourceFingerprint,runtimeFingerprint:store.data.identity.runtimeFingerprint,
    fixtureHash:store.data.identity.fixtureHash,ledgerHead:store.head,items:[]};
}
export function applyItemReview(store,document,now=Date.now) {
  checkBundleHeader(document,store,'init007b.items.1',Object.keys(itemReviewTemplate(store)));
  const digest=sha(document);
  if(store.data.decisionsHash===digest)return {alreadyRecorded:true};
  if(store.data.decisionsHash||store.data.halt||store.data.stages.followups!=='done'||document.ledgerHead!==store.head)fail('DECISIONS_CONTEXT');
  if(!Array.isArray(document.items)||document.items.length<1||document.items.length>48)fail('DECISIONS_CONTEXT');
  const changed={},seen=new Set();
  for(const row of document.items) {
    exact(row,['personaId','stateHash','requirementId','status'],'DECISIONS_CONTEXT');
    const original=store.sessions[row.personaId];
    if(!original||row.stateHash!==sha(original.state))fail('DECISIONS_CONTEXT');
    const pair=`${row.personaId}/${row.requirementId}`;if(seen.has(pair))fail('DECISIONS_CONTEXT');seen.add(pair);
    const s=changed[row.personaId]??copy(original);reviewItem(s,row.requirementId,row.status);changed[row.personaId]=s;
  }
  const data=copy(store.data);data.decisionsHash=digest;
  data.events.push({kind:'synthetic_item_decisions',code:null,digest,atMs:now()});store.commit(data,changed);
  return {recorded:document.items.length,quality:'human_review_pending',actualCustomerApproval:false};
}
