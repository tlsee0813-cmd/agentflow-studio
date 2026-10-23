// MAP36 fix1: a reports-only boundary built only through public domain APIs. Not user records, AI output or completed work.
import * as D from '../dist/public/shared/domain.js';
import {mockAdvice} from '../dist/public/shared/mock.js';

/** G contains L. L has one ordinary request (advice without a question) whose exported work got a report back with
 * understanding:null, so L owns only a report with no follow-up: no question, no description, none of the four reasons. */
export function reportsOnlyFixture() {
  let p=D.rename(D.setBrief(D.createProject(),'[합성36] 보고만 있는 부분의 기록 입구를 확인한다. 실제 개발 자료가 아니다.'),'합성36 보고만 있는 부분');
  const ids={};
  for(const [k,name,note] of [['G','[합성36] 보고만 있는 자식을 포함한 부모','[합성36 구상] G는 자기 기록이 없다.'],['L','[합성36] 보고만 있는 말단','[합성36 구상] L에는 질문도 설명도 없다.']]){
    p=D.addArea(p,name,note);ids[k]=p.space.areas.at(-1).id;}
  p=D.setAreaParent(p,ids.L,ids.G);
  for(const [k,x,y] of [['G',0,0],['L',0,220]])p=D.moveArea(p,ids[k],{x,y});
  p=D.submit(D.editDraft(p,'[합성36 요청] L 부분의 안내 문구를 정리해 주세요.'),undefined,ids.L);const task=p.currentTaskId,s=D.begin(p,task),advice=mockAdvice(s.request);
  advice.question=null;p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice});
  for(const f of ['understanding','scope','next','checks'])p=D.editTask(p,task,f,`[합성36 L] ${f} · 배포하지 않는다.`);
  const H='H36_L',a=D.exportAnchor(p,D.taskOf(p,task));p=D.markHandoff(p,task,D.handoffText(p,task,H),'clipboard',p.revision,H,a);
  p=D.importResultFile(p,JSON.stringify({schemaVersion:'agentflow.return.2',projectId:p.id,taskId:task,returnId:H,report:'[합성36 보고] H36_L · 실제 실행 아님',evidence:null,understanding:null}));
  const report=p.tasks.find(t=>t.resultFile?.returnId===H).id;
  return {p,ids,task,report,returnId:H,metadata:{nature:'공개 domain API로 만든 합성 경계; 정상 복구 가져오기로 준비',owners:'G > L. L은 질문 없는 요청 1개와 그 보고 1개(understanding:null)만 가진다.'}};
}
