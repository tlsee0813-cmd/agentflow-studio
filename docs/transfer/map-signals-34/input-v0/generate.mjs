// Synthetic domain fixture only: no browser, provider, storage injection, or product source edits.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const args=process.argv.slice(2), arg=k=>args[args.indexOf(k)+1];
assert(args.includes('--module-root')&&args.includes('--outdir'),'--module-root and --outdir required');
const root=path.resolve(arg('--module-root')),out=path.resolve(arg('--outdir'));
fs.mkdirSync(out,{recursive:true});
const D=await import(pathToFileURL(path.join(root,'domain.js'))), V=await import(pathToFileURL(path.join(root,'validation.js'))), A=await import(pathToFileURL(path.join(root,'attention.js'))), {mockAdvice}=await import(pathToFileURL(path.join(root,'mock.js')));
const operations=[],ids={},questions=[];
let p=D.rename(D.setBrief(D.createProject(),'[명시 합성34] 자료 검토의 질문·설명 기록을 읽는 경계 입력. 실제 사용자 발언·실행·완료 기록이 아니다.'),'[명시 합성34] 긴 제목·소유·질문과 설명 상태');
const write=(n,v)=>fs.writeFileSync(path.join(out,n),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const record=(action,detail)=>operations.push({action,...detail});
function area(key,name,note,parent=null){p=parent?D.addChildArea(p,parent,name,note):D.addArea(p,name,note);const a=p.space.areas.at(-1);ids[key]=a.id;record('public addArea/addChildArea',{key,id:a.id,parent,name});return a.id}
const P=area('P','[합성34 공통머리말] 상위 구성 · 질문과 설명을 함께 보존하는 자료 검토의 긴 이름','[합성] 자기 기록과 두 실제 자식의 기록을 구별한다.');
const Q=area('Q','[합성34 공통머리말] 오류행 구분 · 실제 자식의 질문과 이전 기준 설명을 가진 긴 이름','[합성] 이전 구상: 오류행 안내의 질문 기록을 읽는다.',P);
const S=area('S','[합성34 공통머리말] 보류만 존재 · 실제 자식의 시험 문맥과 늦은 설명을 가진 긴 이름','[합성] 이전 구상: 늦은 설명은 현재 설명과 구별한다.',P);
const B=area('B','[합성34 공통머리말] 관계만 존재 · 포함되지 않은 다른 부분의 현재 작업용 긴 이름','[합성] 직접 관계는 있지만 상위 P의 자식이 아니다.');
p=D.addRelation(p,Q,B,'related','[합성] 직접 관계일 뿐 포함/질문 소유를 늘리지 않는다.');record('public addRelation',{from:Q,to:B,kind:'related'});
function request(key,owner,kind='request',syntheticQuestion=false){
 p=D.submit(D.editDraft(D.setKind(p,kind),`[명시 합성34 ${key}] 원인을 모른다. 사실을 단정하지 않고 질문 기록만 남긴다.`),undefined,owner);const id=p.currentTaskId;
 const begun=D.begin(p,id);let advice=mockAdvice(begun.request);
 if(syntheticQuestion)advice={...advice,question:{kind:'fact',text:'[합성 시험문맥 생성 질문] 이 문맥의 가정은 무엇인가요?',why:'실제 요구가 아닌 시험문맥에서 생성된 질문의 제외 경계.',options:[]}};
 p=D.receive(begun.project,begun.request,{mode:'mock',ticket:begun.request.ticket,advice});assert(D.taskOf(p,id).advice?.question);
 ids[key]=id;record('public submit/begin/receive',{key,id,owner,sourceKind:kind,response:syntheticQuestion?'explicit synthetic provider-shaped question; not a mock algorithm result':'existing deterministic mockAdvice'});return id;
}
const real=request('qRealAnswered',Q);p=D.answer(p,real,'[합성 실제답변 역할] 기대와 관측을 비교해 확인한다.','provided',false);record('public answer',{taskId:real,testOnly:false});
const trial=request('qExactTrial',Q);p=D.answer(p,trial,'[명시 합성 시험답변] 실제 답변으로 승격하지 않는다.','provided',true);record('public answer',{taskId:trial,testOnly:true,replyTo:D.taskOf(p,trial).advice.question.text});
const stale=request('qStaleOwn',P);p=D.correctIntent(p,stale,'[합성 직접 정정] 이미 요청 범위를 바꿨으므로 옛 질문을 현재 질문으로 쓰지 않는다.','실제 구현·배포는 범위 밖이다.');record('public correctIntent',{taskId:stale});
const excluded=request('qTrialContextExcluded',S,'test_answer',true);
const active=request('qActiveLeaf',Q);
const current=request('qOutsideCurrent',B);
function exported(key,id){
 const H='H_SYN34_'+key,anchor=D.exportAnchor(p,D.taskOf(p,id)),text=D.handoffText(p,id,H);
 const blocks=[...text.matchAll(/```json\s*([\s\S]*?)```/g)].flatMap(m=>{try{return [JSON.parse(m[1])]}catch{return []}});
 const file=blocks.find(x=>x.schemaVersion==='agentflow.return.2');assert(file&&file.projectId===p.id&&file.taskId===id&&file.returnId===H);
 p=D.markHandoff(p,id,text,'clipboard',p.revision,H,anchor);write('handoff-'+key+'.md',text);
 record('public handoffText/markHandoff',{key,taskId:id,returnId:H,areaId:anchor.areaId,basedOn:anchor.understanding});return {key,id,H,anchor,file};
}
function returned(e,summary){
 const raw=JSON.stringify({...e.file,report:`[명시 합성34 ${e.key}] 입력 구성용 보고이며 실제 실행/검증/AI 결과가 아니다.`,evidence:null,understanding:{version:'understanding.1',areaId:e.anchor.areaId,basedOn:e.anchor.understanding,summary,changes:[],proposal:null,origin:'[명시 합성34] domain fixture 생성자가 구성한 외부 설명'}},null,2)+'\n';
 V.parseResultFile(raw);p=D.importResultFile(p,raw);write('return-'+e.key+'.json',raw);record('public importResultFile',{key:e.key,taskId:e.id,returnId:e.H,summary});
}
const ep=exported('P_CURRENT',stale);returned(ep,'[합성 현재 설명] P 자기 질문과 실제 자식의 기록을 구별한다.');
const eq=exported('Q_STALE',active);returned(eq,'[합성 이전 설명] Q의 이전 구상을 대상으로 정리한 설명이다.');
p=D.editArea(p,Q,p.space.areas.find(a=>a.id===Q).name,'[합성 현재 사용자 구상] 이전 안내와 달리 오류행의 구분 표현을 대조한다.');record('public editArea invalidates previous Q stamp',{areaId:Q});
const es=exported('S_HELD_ONLY',excluded);
p=D.editArea(p,S,p.space.areas.find(a=>a.id===S).name,'[합성 현재 사용자 구상] 새 자료를 먼저 확인한다. 옛 인계 설명은 자동 적용하지 않는다.');record('public editArea before late return',{areaId:S});
returned(es,'[합성 늦은 설명] S의 수정 전 구상을 전제로 한 아직 반영하지 않은 설명이다.');
p=D.focusTask(p,current);p=D.setDraftTarget(p,Q);p=D.editDraft(p,'[명시 합성34 미전송] 다른 현재 작업 B를 유지하며 Q 기록을 읽는다. 아직 보내지 않는다.');
assert.equal(p.currentTaskId,current);assert.equal(p.space.draftTarget.area,Q);assert.equal(p.pending,null);
const expectedQuestions=[
 {key:'qRealAnswered',id:real,owner:Q,inN:true,inM:false,answered:true,applicability:'answered',meaning:'정확 실제답변 역할 기록; 구현/검증 성공 아님'},
 {key:'qExactTrial',id:trial,owner:Q,inN:true,inM:false,answered:true,applicability:'answered',meaning:'원실제request의 정확 test_answer: 전체 N 포함, 시험답변/실제답변 아님 표시'},
 {key:'qStaleOwn',id:stale,owner:P,inN:true,inM:false,answered:false,applicability:'stale',meaning:'직접 요청 정정 뒤 옛 질문; 부모 자기 기록 N 포함'},
 {key:'qTrialContextExcluded',id:excluded,owner:S,inN:false,inM:false,answered:false,applicability:'active',meaning:'test_answer 시험문맥에서 새로 생성된 질문: 기존 제외 정책'},
 {key:'qActiveLeaf',id:active,owner:Q,inN:true,inM:true,answered:false,applicability:'active',meaning:'말단 Q의 현재 답변 기록 없음'},
 {key:'qOutsideCurrent',id:current,owner:B,inN:true,inM:true,answered:false,applicability:'active',meaning:'관계만 있는 B의 현재 질문: P 집계에는 제외'}
];
const expectedAreas=[{key:'P',id:P,owners:[P,Q,S],N:4,M:1,descriptions:{current:1,stale:1,held:1}},{key:'Q',id:Q,owners:[Q],N:3,M:1,descriptions:{current:0,stale:1,held:0}},{key:'S',id:S,owners:[S],N:0,M:0,descriptions:{current:0,stale:0,held:1}},{key:'B',id:B,owners:[B],N:1,M:1,descriptions:{current:0,stale:0,held:0}}];
function check(project){
 for(const e of expectedQuestions){const rows=A.subtreeSignals(project,e.owner).flatMap(s=>s.questions),q=rows.find(q=>q.taskId===e.id);assert.equal(!!q,e.inN,e.key+' N');assert.equal(D.questionAnswered(project,D.taskOf(project,e.id)),e.answered,e.key+' answered');assert.equal(D.questionApplicability(project,D.taskOf(project,e.id)),e.applicability,e.key+' applicability');if(q)assert.equal(q.applicability==='active'&&!q.answered,e.inM,e.key+' M');}
 return expectedAreas.map(e=>{const rows=A.subtreeSignals(project,e.id),q=rows.flatMap(r=>r.questions),found={key:e.key,owners:rows.map(r=>r.areaId),N:q.length,M:q.filter(q=>q.applicability==='active'&&!q.answered).length,descriptions:{current:rows.filter(r=>r.description.current?.valid).length,stale:rows.filter(r=>r.description.current&&!r.description.current.valid).length,held:rows.reduce((n,r)=>n+r.description.held.length,0)},questionIds:q.map(q=>q.taskId),questionRows:q};assert.deepEqual(found.owners,e.owners);assert.equal(found.N,e.N);assert.equal(found.M,e.M);assert.deepEqual(found.descriptions,e.descriptions);return found;});
}
const actual=check(p),before=JSON.stringify(p),serialized=JSON.stringify(p,null,2)+'\n',reloaded=V.parseProject(serialized);assert.deepEqual(reloaded,p);assert.deepEqual(check(reloaded),actual);assert.equal(JSON.stringify(p),before,'read-only projections do not write state');
assert.equal(p.space.areas.length,4);assert.equal(p.tasks.length,9);assert.equal(p.space.relations.length,1);assert.equal(D.areaDescription(p,S).current,null);assert.equal(D.areaDescription(p,S).held[0].entry.held,'plan-changed');
const facts={label:'explicit synthetic boundary; no UI comparison or actual AI',schema:p.schemaVersion,projectId:p.id,ids,areas:p.space.areas.map(a=>({id:a.id,name:a.name,nameLength:a.name.length,parent:p.space.containment.parents[a.id]??null})),currentTaskId:p.currentTaskId,draftTarget:p.space.draftTarget,expectedQuestions,expectedAreas,actual,operations};
write('mixed-long-title.json',serialized);write('FACTS.json',facts);write('GENERATION.json',{node:process.version,createdUTC:new Date().toISOString(),areas:p.space.areas.length,tasks:p.tasks.length,questionTasks:6,receivedSyntheticReports:3,serializedBytes:Buffer.byteLength(serialized),serializedSHA256:crypto.createHash('sha256').update(serialized).digest('hex'),strictParseRoundtrip:true,readOnlyAggregationNoMutation:true,allLiteralExpectedChecks:true,UI:'NOT_RUN',providerCalls:0});
console.log(JSON.stringify({input:'mixed-long-title.json',areas:4,tasks:9,expected:expectedAreas.map(({key,N,M,descriptions})=>({key,N,M,descriptions})),roundtrip:true,node:process.version}));
