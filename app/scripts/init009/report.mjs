import { decisionSummary, requirementOriginLabel } from '../../dist/public/shared/presentation.js';
import { PURPOSE,RUN_ID,PERSONA_IDS,sha,equal } from './policy.mjs';
function observations(s){
  const events=s.inputEvents,latest=events.at(-1)?.after.answers.at(-1),ids=events.map(e=>e.after.answers.at(-1)?.id);
  const sourceIds=events.map(e=>e.after.answers.at(-1)?.sourceId),storage=s.state.requirements.find(r=>r.topic==='storage');
  const beforeTools=s.snapshots.first?.requirements.find(r=>r.topic==='tools'),afterTools=s.state.requirements.find(r=>r.topic==='tools');
  return {branch:events.length?'observed':'unevaluated',sameAnswerId:events.length?ids.every(id=>id===ids[0]):null,
    answerSourceIds:sourceIds,preservedAnswerSources:events.length?sourceIds.every(id=>s.state.sources.some(src=>src.id===id)):null,
    dispositions:events.map(e=>e.submitted.disposition),finalDisposition:latest?.disposition??null,
    storageStatus:storage?.status??null,storageAcceptance:storage?.acceptance??null,
    claudeOnlyPreserved:s.persona.id==='p03'?s.state.brief.tools==='claude-only':null,
    priorToolsRequirementUnchanged:beforeTools?equal(beforeTools,afterTools):null,
    structuralChecksAreNotContentQuality:true,humanContentQuality:'pending'};
}
export function questions(store){
  return {purpose:PURPOSE,runId:RUN_ID,identity:store.data.identity,ledgerHead:store.head,
    evidenceKind:'fixed SYNTHETIC personas; validated actual app response; not actual customer approval',
    storageQuestionNote:'storage questions are normalized by the unchanged product adapter, not unfiltered provider text',
    cases:PERSONA_IDS.map(id=>{const s=store.sessions[id];return {personaId:id,persona:s?.persona??null,
      phase:s?.phase??'not_started',firstStateHash:s?.snapshots.first?sha(s.snapshots.first):null,
      firstQuestionHash:s?.snapshots.first?sha(s.snapshots.first.question):null,question:s?.snapshots.first?.question??null,
      requirements:s?.snapshots.first?.requirements??[],followupSlot:store.data.slots.find(r=>r.id===`${id}-2`)?.status,
      humanContentQuality:'pending'};})};
}
export function collect(store){
  return {schemaVersion:'init009.safe-report.1',purpose:PURPOSE,runId:RUN_ID,identity:store.data.identity,
    evidenceKind:store.data.identity.mode==='live'?'real provider + fixed synthetic persona; not actual customer research':'mock upstream over actual createApp HTTP; not real AI compliance',
    ledgerHead:store.head,limits:store.data.limits,stages:store.data.stages,halt:store.data.halt,slots:store.data.slots,
    totalDispatched:store.data.slots.filter(s=>s.startedAtMs!==null).length,
    actualChargeUsd:null,accountBillingHardCap:false,humanContentQuality:'pending',actualCustomerApproval:false,
    sourceIdExistenceIsNotSemanticSupport:true,previousP01InvalidIdAndCause:'unknown',
    cases:PERSONA_IDS.map(id=>{const s=store.sessions[id];if(!s)return {personaId:id,status:'unevaluated',humanContentQuality:'pending'};
      return {personaId:id,persona:s.persona,stateHash:sha(s.state),phase:s.phase,
        generations:s.generations.map(g=>({turn:g.turn,status:g.status,httpStatus:g.httpStatus??null,errorCode:g.errorCode??null,
          diagnostics:g.diagnostics,validatedEnvelope:g.validatedEnvelope??null})),
        firstQuestion:s.snapshots.first?.question??null,
        requirementProgression:{first:s.snapshots.first?.requirements??null,answered:s.snapshots.answered?.requirements??null,second:s.snapshots.second?.requirements??null},
        answerEvents:s.inputEvents.map(e=>({kind:e.kind,submitted:e.submitted,factIds:e.factIds,
          beforeStateHash:sha(e.before),afterStateHash:sha(e.after),answers:e.after.answers,
          addedSources:e.after.sources.filter(src=>!e.before.sources.some(old=>old.id===src.id)),factFidelity:'pending'})),
        currentDecisionView:decisionSummary(s.state),
        aiInterpretation:{authoritative:false,uiDefault:'collapsed',summary:s.state.summary,ideas:s.state.ideas,openItems:s.state.openItems},
        currentRequirements:s.state.requirements.map(r=>({...r,originLabel:requirementOriginLabel(r),
          sourceIdsExist:r.sourceIds.every(sid=>s.state.sources.some(src=>src.id===sid)),semanticSupport:'pending',answerReflection:'pending'})),
        sourceEvidence:s.state.sources,observations:observations(s),itemDecisions:s.itemDecisions,
        humanContentQuality:'pending',rubric:s.quality,actualCustomerApproval:false};}),
    events:store.data.events,automaticRetry:false};
}
export const renderReport=store=>JSON.stringify(collect(store),null,2)+'\n';
