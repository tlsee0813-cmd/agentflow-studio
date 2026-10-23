// MAP34: synthetic card-signal boundaries built only through public domain APIs. Not user records, AI output or completed work.
import * as D from '../dist/public/shared/domain.js';
import {mockAdvice} from '../dist/public/shared/mock.js';

/** P contains A/B/S/T; R is outside P and only related to B. current picks the open work (P or B); stale makes S's
 * description an older-basis one; note gives P an idea line (otherwise '구상 미기재'). late holds the two results received later in the open tab (B, then P). */
export function map34Fixture({current='P',stale=true,note=false}={}) {
  let p=D.rename(D.setBrief(D.createProject(),'[합성34] 카드 기록 신호의 소유 범위와 공존 상태를 확인한다. 실제 개발 자료가 아니다.'),'합성34 카드 신호 경계');
  const ids={},tasks={};
  for(const [k,name,idea] of [['P','[합성34] 아주 긴 상위 부분 이름이 카드 두 줄을 채우는 경계',note?'[합성34 구상] P는 하위 기록을 모은다.':''],['A','[합성34] 답변 기록 질문','[합성34 구상] A는 답변 기록이 있는 질문과 현재 설명을 가진다.'],
    ['B','[합성34] 긴 이름의 말단 부분 · 현재 작업과 이번 탭 갱신',''],['S','[합성34] 이전 기준 질문과 설명','[합성34 구상] S의 질문과 설명은 나중 변경 전 기준이다.'],
    ['T','[합성34] 시험 답변 질문','[합성34 구상] T의 질문에는 시험 답변만 있다.'],['R','[합성34] 연결만 받은 독립 부분','[합성34 구상] R은 연결로 P의 기록 범위를 넓히지 않는다.']]){
    p=D.addArea(p,name,idea);ids[k]=p.space.areas.at(-1).id;}
  for(const k of ['A','B','S','T'])p=D.setAreaParent(p,ids[k],ids.P);
  for(const [k,x,y] of [['P',0,0],['A',0,220],['B',280,220],['S',0,440],['T',280,440],['R',620,220]])p=D.moveArea(p,ids[k],{x,y});
  p=D.addRelation(p,ids.B,ids.R,'flow','[합성34] 연결은 기록 소유를 복제하지 않는다.');
  const task=(k,question)=>{p=D.submit(D.editDraft(p,`[합성34 요청] ${k} 부분의 표시를 정리해 주세요.`),undefined,ids[k]);const id=p.currentTaskId,s=D.begin(p,id),advice=mockAdvice(s.request);
    advice.question=question?{kind:'choice',text:`[합성34 질문] ${k} 표시 방식을 고를까요?`,why:'합성 경계 기록',options:[{label:'가',consequence:'가로 표시'},{label:'나',consequence:'나로 표시'}]}:null;
    p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice});
    for(const f of ['understanding','scope','next','checks'])p=D.editTask(p,id,f,`[합성34 ${k}] ${f} · 배포하지 않는다.`);tasks[k]=id;};
  const exported=(k,H)=>{const a=D.exportAnchor(p,D.taskOf(p,tasks[k]));p=D.markHandoff(p,tasks[k],D.handoffText(p,tasks[k],H),'clipboard',p.revision,H,a);return a;};
  const file=(k,H,a,held=false)=>({schemaVersion:'agentflow.return.2',projectId:p.id,taskId:tasks[k],returnId:H,report:`[합성34 보고] ${H} · 실제 실행 아님`,evidence:null,
    understanding:{version:'understanding.1',areaId:a.areaId,basedOn:held?99:a.understanding,summary:`[합성34 ${k} 설명] ${H}`,changes:[],proposal:null,origin:'합성34 검사 작성자 구성 · 앱/실행 검증 아님'}});
  const bring=f=>{p=D.importResultFile(p,JSON.stringify(f));};
  // S first: its question becomes an older-basis one only through a later change of S's own basis.
  task('S',true);p=D.recordBasis(p,'[합성34 S 기준 변경] 표시 기준을 바꾼다.','confirmed',p.bases.at(-1).id);
  bring(file('S','H34_S',exported('S','H34_S')));if(stale)p=D.editTask(p,tasks.S,'next','[합성34 명시 변경] S 설명을 현재로 재사용하지 않는다.');
  task('A',true);p=D.answer(p,tasks.A,'[합성34 답변] 가로 표시해 주세요.');bring(file('A','H34_A',exported('A','H34_A')));
  task('T',true);p=D.answer(p,tasks.T,'[합성34 시험 답변] 실제 답이 아니다.','provided',true);
  task('R',true);
  task('B',true);bring(file('B','H34_B_HELD',exported('B','H34_B_HELD'),true));
  task('P',false);
  const late={B:file('B','H34_B',exported('B','H34_B')),P:file('P','H34_P',exported('P','H34_P'))};
  p=D.focusTask(p,tasks[current]);
  return {p,ids,tasks,late,metadata:{nature:'공개 domain API로 만든 합성 경계; 정상 복구 가져오기와 결과 파일 선택으로 준비',
    owners:'P > A/B/S/T; R은 B와 연결만. A 답변 기록, B 현재 답변 기록 없음+보류(+이번 탭 현재), S 이전 기준 질문(+이전 기준 설명), T 시험 답변, R 범위 밖 현재 질문.'}};
}
