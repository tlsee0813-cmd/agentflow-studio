// Fixed INIT009 adaptation of B stage/dispatch; A answer/state helpers remain in use.
import { setTimeout as sleep } from 'node:timers/promises';
import { beginRequest, applyResponse, failRequest, answerQuestion, reviseAnswer } from '../../dist/public/shared/project.js';
import { validateEnvelope, validateRequest } from '../../dist/public/shared/validation.js';
import { diagnosticSink } from '../../dist/public/shared/diagnostics.js';
import { createSession, answerTemplate, submitAnswers, reviewItem } from '../init007a/evaluator.mjs';
import { inspectState } from '../init005/run.mjs';
import { buildDeepSeekBody } from '../../server/providers/deepseek.mjs';
import { PURPOSE, RUN_ID, PERSONA_IDS, LIMITS, fail, equal, exact, sha, isHash, errorCode, reserveRequest,
  budgetAvailable, rateDelay, nanoCost, telemetryHalt, telemetry as safeTelemetry, failurePolicy,
  rejectSecretContent, personaById, experimentConfig, validNow, recentDate } from './policy.mjs';
const copy=v=>structuredClone(v);
const slotFor=(data,id,turn)=>data.slots.find(s=>s.personaId===id&&s.turn===turn);
const codeFields=['sourceFingerprint','runtimeFingerprint','fixtureHash','projectSchemaVersion','sessionSchemaVersion','node'];
const codeOnly=i=>Object.fromEntries(codeFields.map(k=>[k,i[k]]));
export function sessionFor(id,mode){
  if(!PERSONA_IDS.includes(id))fail('ARGUMENTS');
  const s=createSession(id);
  if(!equal(s.persona,personaById(id))||s.persona.lockedRequirements.length)fail('FIXTURE_HASH_MISMATCH');
  s.mode=mode==='live'?'deepseek':'mock';
  s.evidenceKind=mode==='live'?'SYNTHETIC fixed persona; real provider; not real customer approval':'SYNTHETIC fixed persona; mock upstream; no paid calls';
  return s;
}
function bundleHeader(store,version){
  const i=store.data.identity;
  return {schemaVersion:version,purpose:PURPOSE,runId:RUN_ID,codeFingerprint:i.sourceFingerprint,
    runtimeFingerprint:i.runtimeFingerprint,fixtureHash:i.fixtureHash};
}
function checkBundleHeader(document,store,version,keys){
  exact(document,keys,'ANSWER_FILE_CONTEXT');
  for(const [k,v] of Object.entries(bundleHeader(store,version)))if(document[k]!==v)fail('ANSWER_FILE_CONTEXT');
}
function factRows(persona){
  const ids=persona.id==='p01'?['F-core']:['F-unknown','F-defer'];
  return ids.map((id,index)=>({factIds:[id],optionId:null,disposition:persona.id==='p01'?'answered':index===0?'unknown':'deferred',
    text:persona.facts.find(f=>f.id===id).text}));
}
export function answerBundleTemplate(store){
  return {...bundleHeader(store,'init009.answers.1'),ledgerHead:store.head,cases:PERSONA_IDS.flatMap(id=>{
    const s=store.sessions[id],slot=slotFor(store.data,id,2);
    if(!s||s.phase!=='awaiting_answer'||slot.status!=='pending')return [];
    const q=s.snapshots.first.question,eligible=q.topic===(id==='p01'?'core-scene':'storage');
    const answerDocument=eligible?{...answerTemplate(s),answers:factRows(s.persona)}:null;
    return [{personaId:id,firstStateHash:sha(s.snapshots.first),firstQuestionHash:sha(q),
      action:eligible?'answer':'skip',questionFactMatchReviewed:false,answerDocument}];
  })};
}
function validateAnswerBundle(store,document){
  const template=answerBundleTemplate(store);
  checkBundleHeader(document,store,'init009.answers.1',Object.keys(template));
  if(document.ledgerHead!==store.head)fail('ANSWER_FILE_CONTEXT');
  if(!Array.isArray(document.cases)||document.cases.length!==template.cases.length)fail('ANSWER_FILE_SHAPE');
  const expected=template.cases.map(r=>r.personaId),seen=new Set();
  for(const row of document.cases){
    exact(row,['personaId','firstStateHash','firstQuestionHash','action','questionFactMatchReviewed','answerDocument'],'ANSWER_FILE_SHAPE');
    if(!expected.includes(row.personaId)||seen.has(row.personaId))fail('ANSWER_FILE_CONTEXT');seen.add(row.personaId);
    const s=store.sessions[row.personaId],q=s.snapshots.first?.question;
    if(!q||row.firstStateHash!==sha(s.snapshots.first)||row.firstQuestionHash!==sha(q)||!equal(s.state,s.snapshots.first))fail('ANSWER_FILE_CONTEXT');
    if(row.action==='skip'){
      if(row.answerDocument!==null||row.questionFactMatchReviewed!==false)fail('ANSWER_FILE_SHAPE');continue;
    }
    if(row.action!=='answer'||q.topic!==(row.personaId==='p01'?'core-scene':'storage'))fail('FIXED_FACTS_INSUFFICIENT');
    if(row.questionFactMatchReviewed!==true)fail('FACT_REVIEW_REQUIRED');
    const expectedDocument={...answerTemplate(s),answers:factRows(s.persona)};
    if(!equal(row.answerDocument,expectedDocument))fail('FIXED_FACTS_INSUFFICIENT');
  }
}
export function prepareAnswers(store,document){
  validateAnswerBundle(store,document);
  const changed={},skips=[],digests={};
  for(const row of document.cases){
    digests[row.personaId]=sha(row);
    if(row.action==='skip'){skips.push(row.personaId);continue;}
    const s=copy(store.sessions[row.personaId]);submitAnswers(s,row.answerDocument);
    rejectSecretContent(s);changed[row.personaId]=s;
  }
  return {changed,skips,digests,documentHash:sha(document)};
}
/** Generation-free preparation fixes fresh product-generated IDs and exact final bodies BEFORE review.
 * Never rerun beginRequest/submitAnswers after approving this plan; doing so changes IDs/body. */
export function preparePhase(stage,identity,store=null,answers=null){
  if(!['firsts','followups'].includes(stage)||!['mock','live'].includes(identity.mode))fail('ARGUMENTS');
  let changed,skips=[],digests={};
  if(stage==='firsts'){
    if(store)fail('STAGE_ORDER');changed=Object.fromEntries(PERSONA_IDS.map(id=>[id,sessionFor(id,identity.mode)]));
  }else{
    if(!store||stageGate(store,stage)!=='ready')fail('STAGE_ORDER');
    ({changed,skips,digests}=prepareAnswers(store,answers));
  }
  return {schemaVersion:'init009.phase-plan.1',purpose:PURPOSE,runId:RUN_ID,stage,mode:identity.mode,
    identity:codeOnly(identity),ledgerHead:store?.head??null,answers,answersHash:answers?sha(answers):null,skips,digests,
    rows:PERSONA_IDS.filter(id=>changed[id]).map(id=>{
      const session=changed[id],started=beginRequest(session.state),body=buildDeepSeekBody(started.request,experimentConfig());
      if(Buffer.byteLength(JSON.stringify(body))>32768||Buffer.byteLength(JSON.stringify(started.request))>32768)fail('INPUT_TOO_LARGE');
      return {personaId:id,beforeSessionHash:store?sha(store.sessions[id]):null,session,started,body,bodySha256:sha(body)};
    })};
}
// Re-execute pure product transitions for validation only. Map newly generated IDs to the
// already-reviewed IDs, never replace the reviewed plan/body or persist these throwaway IDs.
function sameTransition(actual,expected){
  const fromSources=expected.sources.filter(s=>!actual.sources.some(a=>a.id===s.id));
  const toSources=actual.sources.filter(s=>!expected.sources.some(a=>a.id===s.id));
  if(fromSources.length!==toSources.length||fromSources.length>1)fail('PLAN_MISMATCH');
  const mapping=new Map(fromSources.map((s,i)=>[s.id,toSources[i].id]));
  if(expected.pending&&actual.pending)mapping.set(expected.pending.requestId,actual.pending.requestId);
  if(expected.answers.at(-1)&&actual.answers.at(-1))mapping.set(expected.answers.at(-1).id,actual.answers.at(-1).id);
  const remap=v=>typeof v==='string'?(mapping.get(v)??v):Array.isArray(v)?v.map(remap):v&&typeof v==='object'?
    Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remap(x)])):v;
  if(!equal(actual,remap(expected)))fail('PLAN_MISMATCH');
}
export function validatePhase(plan,identity,stage,store=null){
  exact(plan,['schemaVersion','purpose','runId','stage','mode','identity','ledgerHead','answers','answersHash','skips','digests','rows'],'PLAN_MISMATCH');
  if(plan.schemaVersion!=='init009.phase-plan.1'||plan.purpose!==PURPOSE||plan.runId!==RUN_ID||plan.stage!==stage
    ||plan.mode!==identity.mode||!equal(plan.identity,codeOnly(identity)))fail('PLAN_MISMATCH');
  if(stage==='firsts'){
    if(plan.ledgerHead!==null||plan.answers!==null||plan.answersHash!==null||plan.skips.length||Object.keys(plan.digests).length)fail('PLAN_MISMATCH');
  }else{
    if(!store||plan.ledgerHead!==store.head||sha(plan.answers)!==plan.answersHash)fail('PLAN_MISMATCH');
    validateAnswerBundle(store,plan.answers);
    const skips=plan.answers.cases.filter(r=>r.action==='skip').map(r=>r.personaId);
    const digests=Object.fromEntries(plan.answers.cases.map(r=>[r.personaId,sha(r)]));
    if(!equal(skips,plan.skips)||!equal(digests,plan.digests))fail('PLAN_MISMATCH');
  }
  const expected=stage==='firsts'?PERSONA_IDS:PERSONA_IDS.filter(id=>plan.answers.cases.some(r=>r.personaId===id&&r.action==='answer'));
  if(!Array.isArray(plan.rows)||!equal(plan.rows.map(r=>r.personaId),expected))fail('PLAN_MISMATCH');
  for(const r of plan.rows){
    exact(r,['personaId','beforeSessionHash','session','started','body','bodySha256'],'PLAN_MISMATCH');
    const s=r.session,{state,request}=r.started;
    if(!equal(s.persona,personaById(r.personaId))||s.phase!==(stage==='firsts'?'ready_first':'ready_second')||s.preview
      ||(stage==='firsts'?(r.beforeSessionHash!==null||s.generations.length||s.inputEvents.length||s.state.sources.length):r.beforeSessionHash!==sha(store.sessions[r.personaId]))
      ||s.state.id!==s.snapshots.initial.id||state.id!==s.state.id||state.version!==s.state.version+1||!equal(state.pending,request)
      ||request.projectId!==state.id||request.baseVersion!==state.version||!equal(request.sources,state.sources)
      ||!equal(request.answers,s.state.answers)||!equal(request.requirements,state.requirements)
      ||!equal(request.brief,s.persona.brief)||request.stage!==(stage==='firsts'?'discover':'summarize'))fail('PLAN_MISMATCH');
    if(s.mode!==(identity.mode==='live'?'deepseek':'mock')||s.quality?.status!=='human_review_pending'
      ||!Array.isArray(s.quality.rubric)||s.quality.rubric.some(r=>r.status!=='human_review_pending'))fail('PLAN_MISMATCH');
    if(stage==='firsts'&&(!equal(s.snapshots.initial,s.state)||s.state.question!==null||s.state.pending!==null
      ||s.state.answers.length||s.state.requirements.length||s.state.version!==2||s.state.phase!=='basic'
      ||s.itemDecisions.length||s.resolutionEvents.length))fail('PLAN_MISMATCH');
    sameTransition(state,beginRequest(s.state).state);
    validateRequest(request);
    if(stage==='followups'){
      const original=store.sessions[r.personaId],events=s.inputEvents;
      if(!equal(s.generations,original.generations)||!equal(s.snapshots.first,original.snapshots.first)
        ||!equal(s.snapshots.initial,original.snapshots.initial)||!equal(events.map(e=>e.submitted),factRows(s.persona))
        ||!equal(events[0]?.before,original.state)||!equal(events.at(-1)?.after,s.state))fail('PLAN_MISMATCH');
      for(const event of events){
        const expected=event.before.question?answerQuestion(event.before,event.submitted):reviseAnswer(event.before,event.submitted);
        sameTransition(event.after,expected);
      }
      const answer=s.state.answers.at(-1);
      if(events.some((e,i)=>!equal(e.before,i?events[i-1].after:original.state)||e.after.answers.at(-1)?.id!==answer?.id))fail('PLAN_MISMATCH');
      if(r.personaId==='p03'&&(events.length!==2||answer?.disposition!=='deferred'||s.state.brief.tools!=='claude-only'
        ||new Set(events.map(e=>e.after.answers.at(-1)?.sourceId)).size!==2))fail('PLAN_MISMATCH');
    }
    const body=buildDeepSeekBody(request,experimentConfig());
    if(!equal(body,r.body)||sha(body)!==r.bodySha256||Buffer.byteLength(JSON.stringify(body))>32768
      ||Buffer.byteLength(JSON.stringify(request))>32768)fail('BODY_MISMATCH');
    rejectSecretContent(r);
  }
  if(new Set(plan.rows.map(r=>r.started.request.projectId)).size!==plan.rows.length)fail('PLAN_MISMATCH');
  return plan;
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
  now=Date.now,wait=sleep,secrets=[],phasePlan,phaseReviewHash}={}) {
  const startCount=store.data.slots.filter(s=>s.startedAtMs!==null).length;
  if(stageGate(store,stage)==='skip')return summary(store,startCount);
  validNow(now());
  validatePhase(phasePlan,store.data.identity,stage,stage==='followups'?store:null);
  if(!isHash(phaseReviewHash))fail('REVIEW_REQUIRED');
  guard();
  let data=copy(store.data);
  const sessions=Object.fromEntries(phasePlan.rows.map(r=>[r.personaId,copy(r.session)]));
  if(stage==='followups') {
    for(const [id,digest] of Object.entries(phasePlan.digests))slotFor(data,id,2).answerHash=digest;
    for(const id of phasePlan.skips){const slot=slotFor(data,id,2);slot.status='skipped';slot.failure={scope:'skip',code:'FIXED_FACTS_INSUFFICIENT'};}
    data.events.push({kind:'answers_validated',code:null,digest:phasePlan.answersHash,atMs:now()});
  }
  data.events.push({kind:'phase_reviewed',code:null,digest:phaseReviewHash,atMs:now()});
  store.commit(data,sessions);
  data=copy(store.data);data.stages[stage]='running';store.commit(data);
  let transport;
  try {
    // Lazy: a generation-zero stage/no-op does not even open the HTTP/provider transport.
    if(store.data.slots.some(s=>s.turn===(stage==='firsts'?1:2)&&s.status==='pending'))transport=await openTransport();
    for(const id of PERSONA_IDS) {
      const turn=stage==='firsts'?1:2;
      if(slotFor(store.data,id,turn).status!=='pending')continue;
      await dispatchSlot(store,id,turn,transport,{prices,guard,now,wait,secrets,phasePlan,phaseReviewHash});
      if(store.data.halt)break;
    }
    if(!store.data.halt){data=copy(store.data);data.stages[stage]='done';store.commit(data);}
  }catch(e) {
    if(store.poisoned)throw e;
    data=copy(store.data);markHalt(data,errorCode(e),now);store.commit(data);
  }finally{await transport?.close();}
  return summary(store,startCount);
}
export async function dispatchSlot(store,id,turn,transport,{prices,guard,now,wait,secrets,phasePlan,phaseReviewHash}) {
  guard();
  const session=copy(store.sessions[id]);
  if(session.phase!==(turn===1?'ready_first':'ready_second')||session.preview||session.generations.some(g=>g.turn===turn))fail('STATE_INVARIANT_FAILED');
  const row=phasePlan.rows.find(r=>r.personaId===id);
  if(!row||!equal(row.session,session))fail('PLAN_MISMATCH');
  const {state,request}=copy(row.started);
  const reserve=reserveRequest(request,transport.config,prices);budgetAvailable(store.data,reserve);
  const generation={turn,transport:transport.kind,request:copy(request),status:'reserved',diagnostics:[]};
  session.state=state;session.phase='in_flight';session.generations.push(generation);
  let data=copy(store.data),slot=slotFor(data,id,turn);
  Object.assign(slot,{status:'reserved',reservation:reserve,stagePlanHash:sha(phasePlan),stageReviewHash:phaseReviewHash,requestIdHash:sha(request.requestId),baseVersion:request.baseVersion,reservedAtMs:now()});
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
  return {schemaVersion:'init009.items.1',purpose:PURPOSE,runId:RUN_ID,
    codeFingerprint:store.data.identity.sourceFingerprint,runtimeFingerprint:store.data.identity.runtimeFingerprint,
    fixtureHash:store.data.identity.fixtureHash,ledgerHead:store.head,generationFree:true,reviewedAt:null,coordinatorReviewRef:null,items:[]};
}
export function applyItemReview(store,document,expectedHash,now=Date.now) {
  checkBundleHeader(document,store,'init009.items.1',Object.keys(itemReviewTemplate(store)));
  if(!isHash(expectedHash)||sha(document)!==expectedHash||!isHash(document.coordinatorReviewRef)
    ||!recentDate(document.reviewedAt,now())||document.generationFree!==true)fail('ITEM_REVIEW_REQUIRED');
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
