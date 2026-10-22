// Same AREA18 renderer inputs: bounded analyst reconstructions, not original user plans or external execution proof.
// Additional reports, handoffs, changing conditions, current B and drafts below are explicit synthetic wiring probes.
import * as D from '../dist/public/shared/domain.js';
import {parseProject} from '../dist/public/shared/validation.js';
import {hierarchyCases,hierarchySample} from './hierarchy18-fixtures.mjs';

export function received20Fixture(cid='powertoys',{draft=true,archived=false}={}) {
 const c=hierarchyCases.find(x=>x.id===cid);if(!c)throw Error('Unknown bounded case');
 const s=hierarchySample(c);let p=D.rename(s.p,`[합성20 배선] ${cid}`);const A=s.task,area=s.area,other=s.ids[c.other];
 // A legitimate pasted report has no resultFile or export snapshot. Do not fabricate an invalid H with work:null.
 p=D.submit(D.editDraft(D.setKind(p,'report'),'[합성20 붙여넣기] 내보내기 판본을 알 수 없는 보고. W20-PASTED-END'),A);
 const pasted=p.tasks.at(-1).id;
 // Product13 also exercises export-task != root-request: the file returns to a report's follow-up handoff.
 const exported=cid==='product13'?pasted:A;
 const work1={understanding:`[합성 당시1] ${cid} 제한한 이해`,scope:`[합성 당시1] ${cid} 이 범위만 유지 W20-H1-SCOPE`,next:`[합성 당시1] ${cid} 첫 작업문 W20-H1-NEXT`,checks:`[합성 당시1] ${cid} 첫 확인조건 W20-H1-CHECKS`};
 for(const [key,value]of Object.entries(work1))p=D.editTask(p,exported,key,value);
 const H1=`H_received20_${cid}_first`,H2=`H_received20_${cid}_second`,HB=`H_received20_${cid}_B`;
 const firstText=D.handoffText(p,exported,H1);p=D.markHandoff(p,exported,firstText,'download',p.revision,H1);
 for(const key of Object.keys(work1))p=D.editTask(p,exported,key,`[합성 당시2] ${cid} ${key} W20-H2-${key}`);
 p=D.markHandoff(p,exported,D.handoffText(p,exported,H2),'download',p.revision,H2);
 for(const key of Object.keys(work1))p=D.editTask(p,exported,key,`[합성 현재] ${cid} ${key} W20-CURRENT-${key}`);
 if(exported!==A)p=D.editTask(p,A,'next','[합성 root현재] 받은 결과의 당시작업문으로 쓰면 안 된다. W20-ROOT-CURRENT');
 const a=p.space.areas.find(x=>x.id===area),idea=`${a.note}\n[합성 사용자 현재 구상] 받은 외부보고를 승인하지 않는다. W20-CURRENT-IDEA`;
 p=D.editArea(p,area,a.name,idea);
 p=D.submit(D.editDraft(D.setKind(p,'request'),'[합성20 B] 별개 부분의 현재 작업. A 수신만으로 바꾸지 않는다.'),undefined,other);
 const B=p.currentTaskId;p=D.editTask(p,B,'next','[합성20] B 작업문 보존 W20-B-NEXT');p=D.markHandoff(p,B,D.handoffText(p,B,HB),'download',p.revision,HB);
 const originFile={schemaVersion:'agentflow.return.1',projectId:p.id,taskId:B,returnId:HB,report:'[합성20 출발기록R] B에 받은 앞선 보고. A receipt와 혼합하지 않는다. W20-ORIGIN-R',evidence:null};
 p=D.importResultFile(p,JSON.stringify(originFile));const originR=p.tasks.at(-1).id;p=D.focusTask(p,B);
 if(archived)p=D.setAreaArchived(p,area,true);
 if(draft)p=D.editDraft(p,'[합성20 B 미전송] A 결과를 읽는 동안 이 요청과 대상은 유지한다. W20-B-DRAFT');
 p=D.editAuxDraft(p,'answerDraft','[합성20] 답변 초안 보존');p=D.editAuxDraft(p,'basisDraft','[합성20] 기준 초안 보존');
 const h=p.tasks.find(x=>x.id===exported).handoffs.find(x=>x.returnId===H1);
 const file={schemaVersion:cid==='powertoys'?'agentflow.return.1':'agentflow.return.2',projectId:p.id,taskId:exported,returnId:H1,
  report:`[합성 수신20 보고 · ${cid}] A의 보고이며 B의 최신 작업 보고가 아니다.\n`+'실행 성공이나 채택을 뜻하지 않는 합성 원문이다. '.repeat(130)+`\nW20-REPORT-${cid}-END`,
  evidence:`[합성 수신20 근거] 실제 외부도구 검사가 아니다. W20-EVIDENCE-${cid}-END`};
 if(file.schemaVersion==='agentflow.return.2')file.understanding={version:'understanding.1',areaId:area,basedOn:h.anchor.understanding,summary:c.summary,changes:c.changes,proposal:'[합성 제안 · 미채택] 실제 사용자 조건을 바꾸지 않는다.',origin:c.origin};
 const variant={...file,report:`[합성20 같은H 다른보고] 최신 task/마지막 배열로 추정하면 틀린다. W20-SAME-H-DIFFERENT-${cid}`};
 const currentExport=p.tasks.find(x=>x.id===exported).manual;
 return {p:parseProject(JSON.stringify(p)),c,ids:s.ids,area,other,A,B,exported,pasted,originR,H1,H2,HB,work1,currentExport,idea,file,variant,raw:JSON.stringify(file,null,2),firstText,
  metadata:s.metadata,synthetic:'A/B와 모든 추가요청·보고·인계·변경조건·긴본문은 합성 배선검사. AREA18의 출처있는 분석자 재서술은 실제사용자 발언/계층 정답/외부실행성공으로 제시하지 않는다.'};
}
