import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as D from '../product18-author/app/continuity/dist/public/shared/domain.js';
import * as H from '../product18-author/app/continuity/dist/public/shared/hierarchy.js';
import {subtreeSignals} from '../product18-author/app/continuity/dist/public/shared/attention.js';
import {mockAdvice} from '../product18-author/app/continuity/dist/public/shared/mock.js';
import {parseProject} from '../product18-author/app/continuity/dist/public/shared/validation.js';
import {hierarchyCases,hierarchySample} from '../product18-author/app/continuity/tests/hierarchy18-fixtures.mjs';
const results=[];
for(const c of hierarchyCases)for(const mode of ['ordinary-reply','synthetic-reply-to-real-question','synthetic-question']){
 let {p,ids,area}=hierarchySample(c);p=D.editDraft(p,'[합성 검사] 실제 요청 경로에 생성되는 원래 질문의 답변 경계를 검사한다.');if(mode==='synthetic-question')p=D.setKind(p,'test_answer');p=D.submit(p,undefined,area);
 const task=p.currentTaskId,b=D.begin(p),advice=mockAdvice(b.request);advice.question={kind:'fact',text:'[검사 전용 질문] 기록의 표시를 유지하는가?',why:'의미 품질 판단이 아닌 상태 경계 재현',options:[]};p=D.receive(b.project,b.request,{mode:'mock',ticket:b.request.ticket,advice});
 const parent=ids[c.parent],get=project=>subtreeSignals(project,parent).find(s=>s.areaId===area).questions,original=structuredClone(p),before=get(p);
 if(mode!=='synthetic-question')p=D.answer(p,task,'[합성 검사 답변] 원래 질문에 대한 답변 기록','provided',mode==='synthetic-reply-to-real-question');
 const t=D.taskOf(p,task),after=get(p),restored=parseProject(JSON.stringify(p)),expected=mode==='synthetic-question'?0:1;
 const record={case:c.id,mode,task,area,parent,question:t.advice.question,before,after,questionAnswered:D.questionAnswered(p,t),applicability:D.questionApplicability(p,t),taskStatus:D.taskStatus(p,t),sources:t.sourceIds.map(id=>p.sources.find(s=>s.id===id)),foldedRepresentative:H.visibleRepresentative(p,area,new Set([parent])),reloadedQuestions:get(restored),expectedQuestionCount:expected,pass:after.length===expected,original,afterProject:p};
 results.push(record);console.log(JSON.stringify({...record,original:undefined,afterProject:undefined},null,2));
}
const out=resolve(import.meta.dirname,process.argv[2]??'question-synthetic-reply-probe.json');writeFileSync(out,JSON.stringify({boundary:'Public domain APIs, synthetic labelled question and reply; source reconstructions not actual user questions; before/after run labels distinguish product state',results},null,2)+'\n');
const failures=results.filter(r=>!r.pass);console.log(JSON.stringify({output:out,tests:results.length,pass:results.length-failures.length,fail:failures.length}));if(failures.length)process.exitCode=1;
