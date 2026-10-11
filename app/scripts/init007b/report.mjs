import { branchEvidence } from '../init007a/evaluator.mjs';
import { PERSONA_IDS, PURPOSE, RUN_ID, sha } from './policy.mjs';
function block(value) {
  const text=JSON.stringify(value,null,2),length=Math.max(2,...[...text.matchAll(/`+/g)].map(m=>m[0].length));
  const fence='`'.repeat(length+1);return `${fence}json\n${text}\n${fence}`;
}
export function questions(store) {
  return {purpose:PURPOSE,runId:RUN_ID,identity:store.data.identity,ledgerHead:store.head,
    evidenceKind:'SYNTHETIC — not real customer research or approval',cases:PERSONA_IDS.map(id=>{
      const s=store.sessions[id];return {personaId:id,persona:s?.persona??null,phase:s?.phase??'not_started',
        firstStateHash:s?.snapshots.first?sha(s.snapshots.first):null,firstState:s?.snapshots.first??null,
        question:s?.snapshots.first?.question??null,followupSlot:store.data.slots.find(r=>r.id===`${id}-2`)?.status,
        quality:'human_review_pending'};
    })};
}
export function renderReport(store) {
  const parts=['# INIT007-KO-DIALOGUE — 합성 고객 대화 품질 검토 자료',
    `고정 run ID: ${RUN_ID}. 모드: ${store.data.identity.mode}.`,
    store.data.identity.mode==='live'?'실제 provider를 사용한 SYNTHETIC persona 실험입니다. 실제 고객 조사·실제 고객 승인·내용 품질 합격이 아닙니다.':'실제 createApp/HTTP/provider adapter와 모의 upstream을 연결한 무상 모드입니다. DeepSeek 실호출·실청구가 없습니다.',
    '**모든 persona: quality human_review_pending.** HTTP·protocol·state 검증과 사람이 판단할 내용 품질을 구별합니다.',
    '원장은 로컬 고정 디렉터리의 기록입니다. 다른 작업공간 전체의 동시 실행 차단이나 계정 청구 강제 상한을 보장하지 않습니다.',
    '## 고정 정체성·한도·단계·중단 원인',block({identity:store.data.identity,limits:store.data.limits,stages:store.data.stages,
      halt:store.data.halt,ledgerHead:store.head,actualChargeUsd:null}),
    '## 슬롯·비용 예약·관측 metadata (raw provider/error/headers/reasoning 없음)',block(store.data.slots),
    '예약과 dispatch 후 프로세스가 끊겼다면 해당 슬롯은 불확실하며 재호출하지 않습니다. 예약 비용도 자동 반환하지 않습니다.'];
  for(const id of PERSONA_IDS) {
    const s=store.sessions[id];parts.push(`## ${id}`);
    if(!s){parts.push('미실행. 분기 unevaluated, 내용 검토 대기.');continue;}
    parts.push('### 고정 사실·선택·미정·잠금',block(s.persona),'### 분기 관측',block(branchEvidence(s)),
      '### 첫 요청 전 상태 (fixture seed는 이전 HTTP 대화 아님)',block(s.snapshots.initial));
    for(const g of s.generations) {
      parts.push(`### ${g.turn}차 protocol 결과: ${g.status}`,block({httpStatus:g.httpStatus??null,diagnostics:g.diagnostics,errorCode:g.errorCode??null}));
      if(g.validatedEnvelope)parts.push('검증된 합성 응답 — 질문·이유·예시·선택 효과·요약',block(g.validatedEnvelope));
    }
    parts.push('### 첫 응답의 실제 적용 상태',block(s.snapshots.first??null),
      '### 합성 답변·수정 원문 / 전후 요구·완료 조건·출처',block(s.inputEvents),
      '### 충돌 preview / 취소 / 명시 확인 (합성 작업자)',block(s.resolutionEvents),
      '### 후속 응답 직후 상태',block(s.snapshots.second??null),
      '### 항목 확인 기록 (내용 품질 판정 아님)',block(s.itemDecisions),
      '### 현재 상태',block(s.state),'### 내용 품질 rubric',block(s.quality));
  }
  parts.push('## 입력 교정·항목 확인의 안전 metadata',block(store.data.events),
    '발생하지 않은 분기는 unevaluated입니다. 질문을 주입하거나 새 사례·추가 생성으로 슬롯을 채우지 않습니다. 실제 청구액은 알 수 없어 null입니다.');
  return parts.join('\n\n')+'\n';
}
