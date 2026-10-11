import { type AppFacts, type BasisVersion, type PlanFact, type Project, BASIS_LABEL, SOURCE_LABEL } from './types.js';
import { ensure } from './validation.js';

/** Pure projection of the supplied, validated in-memory project, NOT a persistence receipt or an
 * execution log. Imports are unsigned. Compare only available snapshots; never parse request intent.
 * versionIndex locates a snapshot in history + current, not a new persistent identity. */
export function planFacts(p: Project, taskId = p.currentTaskId): AppFacts {
  const task=p.tasks.find(t=>t.id===taskId); ensure(task,'TASK_MISSING');
  const ids=new Set(task.sourceIds),sources=new Map(p.sources.map(s=>[s.id,s]));
  const inputs=p.sources.filter(s=>ids.has(s.id)).map(s=>({sourceId:s.id,kind:s.kind}));
  const records:PlanFact[]=[];
  for(const b of p.bases) {
    // Old imports may contain unordered/repeated revisions. Do not invent an ordered write chain.
    let ordered=true,last=-1;
    for(let i=0;i<=b.history.length;i++) {
      const v=i<b.history.length ? b.history[i]! : b;
      if(!Number.isSafeInteger(v.revision)||v.revision<=last||v.revision>p.revision) ordered=false;
      last=v.revision;
    }
    for(let i=0;i<=b.history.length;i++) {
      const v:BasisVersion=i<b.history.length ? b.history[i]! : b;
      if(!ids.has(v.sourceId)) continue;
      const s=sources.get(v.sourceId),previous=ordered&&i>0 ? b.history[i-1]! : null;
      let kind:PlanFact['kind']='version-only';
      if(ordered && s?.taskId===task.id) {
        if(s.kind==='manual_decision' && s.text===v.text && ['confirmed','deferred'].includes(v.status)) kind='basis-recorded';
        else if(s.kind==='request' && previous && v.status!=='answered') kind='basis-recorded';
        else if(!previous && ((s.kind==='request' && v.status==='requested' && s.text===v.text) || (s.kind==='answer' && v.status==='answered'))) kind='input-retained';
      }
      // null = no reliable predecessor comparison. [] = compared text/status are byte-identical.
      const compare=kind==='basis-recorded' ? previous : null;
      records.push({basisId:b.id,sourceId:v.sourceId,revision:v.revision,status:v.status,
        versionIndex:i,isCurrent:i===b.history.length,kind,previousRevision:compare?.revision??null,
        changedFields:compare ? (['text','status'] as const).filter(k=>compare[k]!==v[k]) : null});
    }
  }
  return {taskId:task.id,inputs,records};
}

/** The same projection feeds the handoff and AI input. No original text is repeated here. */
export function planFactsText(facts:AppFacts):string {
  const labels={ 'input-retained':'요청·답변 원문 보존', 'basis-recorded':'기준 기록', 'version-only':'버전 참조만 · 기록 경위/이력 비교 미확인' };
  const lines=['## Studio 기록 근거 — 현재 메모리의 항목별 기록',
    `작업 ${facts.taskId}의 입력: ${facts.inputs.map(s=>`[${s.sourceId}] ${SOURCE_LABEL[s.kind]}`).join('; ')||'없음'}.`];
  for(const f of facts.records) {
    const location=f.isCurrent?'현재 버전':`과거 history[${f.versionIndex}] · 현재 지시 아님`;
    const diff=f.changedFields===null?'전후 비교 없음':f.changedFields.length?`${f.changedFields.join(', ')} 필드 차이`:'text/status 동일값 재기록';
    lines.push(`[${f.basisId}] ${labels[f.kind]} / ${location} / r${f.revision} / [${f.sourceId}] / ${f.status} (${BASIS_LABEL[f.status]}) / ${f.previousRevision===null?'':`보존 r${f.previousRevision} 대비 `}${diff}.`);
  }
  if(!facts.records.length) lines.push('이 작업 입력에 연결된 기준 버전 기록은 없습니다. 보고·관찰 자료 자체를 기준 변경으로 읽지 마세요.');
  else if(!facts.records.some(f=>f.kind==='basis-recorded'&&f.previousRevision!==null)) lines.push('이 작업 입력에 연결된 비교 가능한 기존 기준 교체 기록은 없습니다. 요청 전체의 미완료 판정은 아닙니다.');
  lines.push('원문과 현재 값은 아래 입력·보존 기준을 함께 읽으세요. 일부 기록·동일값·requested의 존재/부재만으로 요청 전체 완료/미완료를 판정하지 않습니다. 이력 누락은 추정하지 않습니다. 이 표시는 브라우저 저장 성공·외부 구현/검증·서명된 실행 증거가 아닙니다.');
  return lines.join('\n');
}
