// Research inputs: Korean restatements of bounded public records, not original user speech or extraction results.
// Proposal/conflict wording is explicitly synthetic. The surrounding project and second area are test scaffolding.
import * as D from '../dist/public/shared/domain.js';
export const cases=[{
  id:'powertoys',title:'PowerToys 키 편집기의 제한된 두 동작',area:'키 검색·선택',
  brief:'키 매핑 편집기에서 검색한 키를 고르고 키 입력을 녹화한다. 공개 기록 일부의 한국어 재서술이다.',
  note:'Enter를 누르면 제출한 검색어로 선택한다. 녹화 종료는 Tab 누름으로만 판단하고 정상 key-up 처리는 유지한다.',
  request:'[표본 재서술] 제출한 검색어로 키를 고르는 동작을 확인한다. 녹화 종료의 별도 유지 조건도 보존한다.',
  report:'[공개 고정 코드의 재서술 · 실제 실행 미검증] a964f08은 QuerySubmitted에서 args.QueryText를 FilterKeyList로 전달한다. 녹화 종료에는 isKeyDown 조건을 추가하고 공통 훅은 이벤트 종류를 전달한다. 두 별도 리뷰 요구를 같은 수정에서 다뤘다.',
  summary:'검색·선택은 Enter로 제출한 검색어를 바로 필터링해 첫 결과를 고른다. 녹화 종료와 공통 입력 훅은 별도 부분이며, 이 설명은 코드 수정 기록을 정리한 것이다.',
  changes:['이전 화면 목록 대신 제출된 검색어로 선택 대상을 계산한다.'],
  proposal:'[합성 경계 · 실제 제안 아님] 모든 key-up 처리를 생략하자는 구상 변경 제안.',
  conflict:'[합성 반례 · 실제 발언 아님] 모든 key-up을 무시하므로 정상 키 해제 처리도 하지 않는다.',
  origin:'공개 리뷰·고정 코드 일부의 한국어 재서술 · 자동 추출 아님',
  links:['https://github.com/microsoft/PowerToys/pull/51150#discussion_r4255501266','https://github.com/microsoft/PowerToys/pull/51150#discussion_r4255501287','https://github.com/microsoft/PowerToys/commit/a964f08cc6fbecb3b9f9d4fe6c1d7481330c7938'],
  limits:'User 계정 리뷰의 요구와 작성자 코드 변경을 구별한다. 실행·출시·인계 수락은 검증하지 않았다. 두 동작 사이 인과선을 만들지 않는다.'
},{
  id:'product13',title:'AgentFlow 전체 공간의 PC 읽기',area:'영역 지도와 선택상세',
  brief:'목적과 영역 구상을 기본에서 읽고 필요한 기록·추가 조작을 펼친다. 제품13 AI 배정의 제한된 재서술이다.',
  note:'사용자 목적·영역 구상과 안내·오류를 보존한다. 상세 개폐로 자동 맞춤·재배치를 하지 않는다.',
  request:'[총괄 AI 배정 재서술 · 사람 원발화 아님] 기존 공간 읽기를 유지하면서 PC에서 지도와 조작을 읽기 쉽게 한다.',
  report:'[제품13 fix1 고정 diff·작성자 반환 재서술] PC 폭의 지도 조작부를 아래 오른쪽에서 위 오른쪽으로 옮겼다. app.ts는 이 fix1 diff에서 바뀌지 않았으며 선택 카드 가림은 기존 한계로 남았다. 작성자 검사는 독립 판정과 구별한다.',
  summary:'영역 지도와 선택상세는 기존 역할을 유지한다. PC 확대·축소·전체 맞춤 조작부는 지도 위 오른쪽에 배치됐다. 선택 카드 가림의 기존 한계는 남는다.',
  changes:['지도 조작부를 위 오른쪽으로 옮겼다. 목적·기록 읽기·영역 추가의 기능을 새 변경으로 표시하지 않는다.'],
  proposal:'[합성 경계 · 실제 제안 아님] 공간을 더 확보하려고 사용자 목적과 가져오기 안내를 숨기자는 제안.',
  conflict:'[합성 반례 · 실제 발언 아님] 목적과 영역 구상, 가져오기 안내를 숨겼다.',
  origin:'총괄 AI 배정·고정 fix1 반환의 한국어 재서술 · 사람 원발화 아님',
  links:['https://github.com/tlsee0813-cmd/agentflow-studio/blob/dbd034e05e9679f588a7170eed230299ea216dd8/docs/cycles/2026-10-16-pc-map-space-13/IMPLEMENTATION.md#L22','https://github.com/tlsee0813-cmd/agentflow-studio/blob/827f029e0dab79b48ebe8818fb15d32db7ed8d06/docs/transfer/pc-map-space-13/author-fix1/v0-9aeb459-to-fix1.diff','https://github.com/tlsee0813-cmd/agentflow-studio/blob/827f029e0dab79b48ebe8818fb15d32db7ed8d06/docs/transfer/pc-map-space-13/author-fix1/REPORT.md'],
  limits:'내부 제품 개발 표본의 편향이 있다. 구성 묶음은 AI 해석이고 내부 3영역·요청 이력은 합성 검사 자료였다. 실제 고객 요구·의미 정리 품질 수용이 아니다.'
}];
export function sample(which=cases[0]){
  let p=D.setBrief(D.createProject(),which.brief);p=D.addArea(p,which.area,which.note);p=D.addArea(p,'비교 영역 · 합성','변경이 번지지 않는지 확인하는 합성 영역');
  const [area,other]=p.space.areas.map(a=>a.id);p=D.submit(D.editDraft(p,which.request),undefined,area);
  const task=p.currentTaskId,returnId=`H_sample_${which.id}`,anchor=D.exportAnchor(p,D.taskOf(p,task));
  const text=D.handoffText(p,task,returnId);p=D.markHandoff(p,task,text,'clipboard',p.revision,returnId,anchor);
  const file={schemaVersion:'agentflow.return.2',projectId:p.id,taskId:task,returnId,report:which.report,evidence:null,
    understanding:{version:'understanding.1',areaId:area,basedOn:anchor.understanding,summary:which.summary,changes:which.changes,proposal:which.proposal,origin:which.origin}};
  return {p,area,other,task,returnId,file,text,metadata:{links:which.links,limits:which.limits,conflict:which.conflict}};
}
