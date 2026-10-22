import * as D from '../cycle19-candidate/app/continuity/dist/public/shared/domain.js';
import {checkItems} from '../cycle19-candidate/app/continuity/dist/public/shared/attention.js';
import {parseProject} from '../cycle19-candidate/app/continuity/dist/public/shared/validation.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';mkdirSync(new URL('./fixtures/',import.meta.url),{recursive:true});
for(const cid of ['powertoys','product13']){
 let base=JSON.parse(readFileSync(new URL('../cycle18-fix4-independent/fixtures/'+cid+'.json',import.meta.url))),meta=JSON.parse(readFileSync(new URL('../cycle18-fix4-independent/fixtures/'+cid+'-meta.json',import.meta.url)));let p=structuredClone(base),reports=[];
 for(const area of p.space.areas.filter(a=>!a.archived)){
  p=D.submit(D.editDraft(D.setKind(p,'request'),'[독립 합성 요청19] '+area.name+'의 기록 배선 확인'),undefined,area.id);let req=p.currentTaskId;
  p=D.markHandoff(p,req,D.handoffText(p,req),'download',p.revision);
  let text='[독립 합성 보고19] '+area.name+'의 자료를 읽었다는 시험 기록. 실제 구현·수용·완료 주장이 아니다. 고유끝-'+area.id;
  p=D.submit(D.editDraft(D.setKind(p,'report'),text),req);reports.push({area:area.id,request:req,report:p.tasks.at(-1).id,text});
 }
 const ra=reports.find(r=>r.area===meta.target);p=D.focusTask(p,ra.report);p=D.setKind(p,'request');parseProject(JSON.stringify(p));const items=checkItems(p),last=items.at(-1),rb=reports.find(r=>r.report===last.returnId);if(!rb||rb.area===meta.target||items.length<5)throw Error('invalid independent record fixture');
 const out={...meta,baseRecordItems:checkItems(base),recordItems:items,reports,reportA:ra,reportB:rb,setup:'Cycle18 bounded source-restated input reused unchanged; additional one request/report per actual area is explicitly synthetic via public domain APIs. No real external execution/acceptance claim.'};
 writeFileSync(new URL('./fixtures/'+cid+'-one.json',import.meta.url),JSON.stringify(base,null,2));writeFileSync(new URL('./fixtures/'+cid+'-many.json',import.meta.url),JSON.stringify(p,null,2));writeFileSync(new URL('./fixtures/'+cid+'-meta.json',import.meta.url),JSON.stringify(out,null,2));
 if(cid==='powertoys'){
  let long={...p,name:'같은접두사프로젝트'.repeat(4)+' 끝이름-19'};long=D.setBrief(long,'[합성 긴 목적] '+('https://example.invalid/longpathWITHOUTspaces1234567890 '.repeat(75))+' 목적의 마지막 조건-끝19');parseProject(JSON.stringify(long));writeFileSync(new URL('./fixtures/long.json',import.meta.url),JSON.stringify(long,null,2));
 }
 console.log(JSON.stringify({cid,one:checkItems(base).length,many:items.length,reportB:rb.report,reportA:ra.report}));
}
