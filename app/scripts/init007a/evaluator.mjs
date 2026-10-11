import { beginRequest, applyResponse, failRequest, answerQuestion, reviseAnswer,
  previewSelectionResolution, confirmSelectionResolution, decideRequirement } from '../../dist/public/shared/project.js';
import { validateEnvelope } from '../../dist/public/shared/validation.js';
import { safeDiagnostic } from '../../dist/public/shared/diagnostics.js';
import { personaById, initialState } from './personas.mjs';
export const SESSION_VERSION = 'init007a.session.1';
const copy = value => structuredClone(value);
const err = code => { throw new Error(code); };
const safeCodes = new Set(['INVALID_INPUT','INVALID_RESPONSE','INPUT_TOO_LARGE','LOCAL_RATE_LIMIT','PROCESS_CALL_CAP',
  'DUPLICATE_REQUEST','AI_BUSY','AI_TIMEOUT','AI_UNAVAILABLE','AI_NOT_CONFIGURED','PAID_CALLS_DISABLED','FORBIDDEN_ORIGIN']);
export const RUBRIC = Object.freeze(['기존 정보 재질문 안 함','핵심 구체화','쉬운 질문과 답변 부담',
  '답변의 실제 요구·완료 조건 반영','제안·확정·미정 구별','보류·잠금·출처 보존','도구·고객 서비스 저장 범위 일관성']);
export function createSession(personaId) {
  const persona = personaById(personaId), state = initialState(persona);
  return {schemaVersion:SESSION_VERSION,mode:'mock',evidenceKind:'synthetic; no real customer or model evaluation',persona,
    phase:'ready_first',state,generations:[],snapshots:{initial:copy(state)},inputEvents:[],resolutionEvents:[],
    itemDecisions:[],preview:null,quality:{status:'human_review_pending',rubric:RUBRIC.map(item=>({item,status:'human_review_pending'}))}};
}
/** Small transport seam. 007A accepts only the mock-http implementation or an explicitly named test double.
 * Future real-provider authorization/credentials/recovery belong to 007B, not this adapter. */
export async function generate(session, transport, persist = async()=>{}) {
  if (!['ready_first','ready_second'].includes(session.phase)) err('GENERATION_NOT_READY');
  if (session.preview) err('UNRESOLVED_PREVIEW');
  if (!['mock-http','mock-test-double'].includes(transport.kind)) err('MOCK_ONLY');
  const turn = session.phase === 'ready_first' ? 1 : 2;
  if (session.generations.some(g=>g.turn===turn)) err('GENERATION_ALREADY_ATTEMPTED');
  const started = beginRequest(session.state);
  session.state = started.state;
  const record = {turn,transport:transport.kind,request:copy(started.request),status:'in_flight',diagnostics:[]};
  session.generations.push(record); session.phase = 'in_flight';
  // A failed pre-send save never sends; an uncertain attempt can never auto-replay.
  await persist(session);
  let raw;
  try { raw = await transport.generate(started.request); }
  catch { record.status='transport_failed'; session.state=failRequest(session.state,started.request,'AI_UNAVAILABLE');session.phase='failed';await persist(session);return session; }
  record.httpStatus = Number.isInteger(raw?.status) ? raw.status : null;
  if (raw?.status !== 200) {
    const code = safeCodes.has(raw?.body?.error?.code) ? raw.body.error.code : 'AI_UNAVAILABLE';
    record.status='http_failed';record.errorCode=code;
    session.state=failRequest(session.state,started.request,code);session.phase='failed';
  } else {
    let next;
    try { next=applyResponse(session.state,started.request,raw.body,d=>{const safe=safeDiagnostic(d);if(safe)record.diagnostics.push(safe);}); }
    catch { next=failRequest(session.state,started.request,'INVALID_RESPONSE'); }
    if (next.error || next.pending || next===session.state) {
      record.status='rejected';record.errorCode='INVALID_RESPONSE';session.state=failRequest(session.state,started.request,'INVALID_RESPONSE');session.phase='failed';
    } else {
      const envelope=validateEnvelope(raw.body,started.request);
      if (envelope.mode !== 'mock') { // Do not store mislabeled AI output in a mock evaluation.
        record.status='rejected';record.errorCode='MOCK_ONLY';session.state=failRequest(session.state,started.request,'INVALID_RESPONSE');session.phase='failed';
      } else {
        session.state=next;record.status='succeeded';record.validatedEnvelope=copy(envelope);
        if (turn===1) {
          session.snapshots.first=copy(next);session.phase=next.question?'awaiting_answer':'question_absent';
        } else {session.snapshots.second=copy(next);session.phase='completed';}
      }
    }
  }
  await persist(session);
  return session;
}
const object = (value, keys) => value && typeof value==='object' && !Array.isArray(value)
  && Object.keys(value).length===keys.length && keys.every(k=>Object.hasOwn(value,k));
export function answerTemplate(session) {
  const q=session.snapshots.first?.question;
  return {schemaVersion:'init007a.answer.1',personaId:session.persona.id,projectId:session.state.id,
    baseVersion:session.state.version,questionId:q?.id??null,
    answers:[{factIds:[],optionId:null,disposition:'answered',text:''}]};
}
/** Validate the entire file and simulate all revisions atomically before committing. No generation here. */
export function submitAnswers(session, document) {
  if (!['awaiting_answer','ready_second'].includes(session.phase)) err('ANSWER_NOT_EXPECTED');
  if (!object(document,['schemaVersion','personaId','projectId','baseVersion','questionId','answers'])
      || document.schemaVersion!=='init007a.answer.1' || document.personaId!==session.persona.id
      || document.projectId!==session.state.id || document.baseVersion!==session.state.version
      || document.questionId!==session.snapshots.first?.question?.id) err('ANSWER_FILE_CONTEXT');
  if (!Array.isArray(document.answers)||document.answers.length<1||document.answers.length>3) err('ANSWER_FILE_SHAPE');
  const facts=new Set(session.persona.facts.map(f=>f.id));
  let state=session.state;const accepted=[];
  for (const row of document.answers) {
    if (!object(row,['factIds','optionId','disposition','text']) || !Array.isArray(row.factIds) || !row.factIds.length
        || row.factIds.some(id=>!facts.has(id)) || new Set(row.factIds).size!==row.factIds.length
        || typeof row.text!=='string' || !(row.optionId===null||typeof row.optionId==='string')) err('ANSWER_FILE_SHAPE');
    const before=state;
    try {state=state.question?answerQuestion(state,row):reviseAnswer(state,row);} catch {err('INVALID_ANSWER');}
    accepted.push({kind:before.question?'answer':'revision',factIds:copy(row.factIds),submitted:copy(row),
      before:copy(before),after:copy(state),factFidelity:'human_review_pending'});
  }
  session.state=state;session.inputEvents.push(...accepted);session.snapshots.answered=copy(state);session.phase='ready_second';session.preview=null;
  return session;
}
export function previewResolution(session, requirementId, choice) {
  if(session.phase!=='ready_second') err('RESOLUTION_NOT_READY');
  const preview=previewSelectionResolution(session.state,requirementId,choice);
  session.preview=preview;session.resolutionEvents.push({action:'preview',preview:copy(preview),state:copy(session.state)});
  return preview;
}
export function cancelResolution(session) {
  if(!session.preview) err('NO_PREVIEW');
  session.resolutionEvents.push({action:'cancel',preview:copy(session.preview),state:copy(session.state)});session.preview=null;
}
export function confirmResolution(session) {
  if(!session.preview) err('NO_PREVIEW');
  const preview=session.preview;
  const next=confirmSelectionResolution(session.state,preview);
  session.resolutionEvents.push({action:'confirm',preview:copy(preview),before:copy(session.state),after:copy(next)});
  session.state=next;session.preview=null;
}
/** Explicit item decision is a test-operator action, never a model quality pass. */
export function reviewItem(session,id,status) {
  if(!['completed','question_absent'].includes(session.phase)||!['proposed','confirmed','deferred','rejected'].includes(status)) err('ITEM_NOT_READY');
  const next=decideRequirement(session.state,id,status);
  session.itemDecisions.push({id,status,before:copy(session.state),after:copy(next),actor:'synthetic-test-operator'});
  session.state=next;
}
export function branchEvidence(session) {
  const storage=session.inputEvents.some(e=>e.after.answers.some(a=>a.topic==='storage'));
  const conflict=session.inputEvents.some(e=>e.after.conflicts.length>0);
  return {storage:storage?'observed':'unevaluated',conflict:conflict?'observed':'unevaluated',
    secondGeneration:session.generations.find(g=>g.turn===2)?.status??'not_called',quality:'human_review_pending'};
}
