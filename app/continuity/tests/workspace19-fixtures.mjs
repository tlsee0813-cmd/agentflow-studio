// Reuse AREA18's bounded analyst reconstructions. All new tasks/reports/long strings below are explicit synthetic probes.
import * as D from '../dist/public/shared/domain.js';
import {hierarchyCases,hierarchySample} from './hierarchy18-fixtures.mjs';
export function workspace19Fixture(cid='powertoys',long=false){
 const c=hierarchyCases.find(c=>c.id===cid);if(!c)throw Error('Unknown source case');const s=hierarchySample(c);let p=s.p;
 const name=long?('[합성 긴 이름] '+'공간 읽기와 기록 보존 '.repeat(8)).slice(0,106)+' W19-NAME-END':`[합성 배선] 공간19 ${cid}`;
 const purpose=long?'[합성 긴 목적] '+('공백 없는 주소도 전체로 읽을 수 있어야 한다. https://example.invalid/'+'x'.repeat(110)+'\n').repeat(18)+' W19-PURPOSE-END':c.title;
 p=D.rename(p,name.slice(0,120));p=D.setBrief(p,purpose);
 p=D.submit(D.editDraft(p,'[합성 원요청] 이 부분의 버튼 문구만 검토하고 기록의 출처와 적용 범위를 보존한다.'),undefined,s.area);
 const task=p.currentTaskId,Hid=`H_workspace19_${cid}_main`;p=D.markHandoff(p,task,D.handoffText(p,task,Hid),'download',p.revision,Hid,D.exportAnchor(p,D.taskOf(p)));
 const file={schemaVersion:'agentflow.return.1',projectId:p.id,taskId:task,returnId:Hid,report:'[합성 배선 보고] 실제 도구를 실행하지 않았다. 원자료의 검증 결과로 사용하지 않는다. W19-REPORT-END',evidence:null};
 p=D.importResultFile(p,JSON.stringify(file));const report=p.tasks.at(-1).id,late=[];
 // Five real export targets exist before the UI reads the one arrived report. File receipts grow records from1 to6.
 for(const [index,area]of p.space.areas.slice(0,5).entries()){
  p=D.focusTask(p,task);p=D.submit(D.editDraft(p,`[합성 추가 요청 ${index+1}] ${area.name}의 제한된 확인만 준비한다.`),undefined,area.id);
  const tid=p.currentTaskId,rid=`H_workspace19_${cid}_${index}`;p=D.markHandoff(p,tid,D.handoffText(p,tid,rid),'download',p.revision,rid,D.exportAnchor(p,D.taskOf(p)));
  late.push({schemaVersion:'agentflow.return.1',projectId:p.id,taskId:tid,returnId:rid,report:`[합성 추가 보고 ${index+1}] 외부 실행 증거가 아니며 기록 공간의 실제 도달 검사용이다. `+'읽기 위치 보존. '.repeat(35)+`W19-LATE-${index+1}-END`,evidence:null});
 }
 p=D.focusTask(p,report);
 return {p,c,ids:s.ids,area:s.area,other:s.ids[c.other],task,report,returnId:Hid,mainFile:file,late,name:p.name,purpose,
  metadata:s.metadata,synthetic:'추가 요청·보고·긴 이름·목적은 실제 원자료 밖의 합성 검사. 원래 포함 구성은 AREA18 분석자 재서술을 재사용하며 실제 사용자 발언·실행 성공을 뜻하지 않는다.'};
}
