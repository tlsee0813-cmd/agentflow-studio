import fs from 'node:fs';import assert from 'node:assert/strict';
import * as D from './candidate/app/continuity/dist/public/shared/domain.js';
import * as V from './candidate/app/continuity/dist/public/shared/validation.js';
import {mockAdvice} from './candidate/app/continuity/dist/public/shared/mock.js';
const out=new URL('./sample/',import.meta.url);fs.mkdirSync(out,{recursive:true});const put=(n,v)=>fs.writeFileSync(new URL(n,out),JSON.stringify(v,null,2)+'\n');
let p=D.rename(D.setBrief(D.createProject(),'[명시 합성36] 질문·설명 없는 보고의 기록 입구만 확인한다. 실제 사용자·AI·개발 결과가 아니다.'),'[합성36] 보고만 있는 기록');const ids={},tasks={};
p=D.addArea(p,'부모 P','[합성] 실제 자식 L의 기록만 포함한다.');ids.P=p.space.areas.at(-1).id;
p=D.addChildArea(p,ids.P,'보고 소유 말단 L','[합성] 질문과 설명 없이 보고만 받는다.');ids.L=p.space.areas.at(-1).id;
p=D.addArea(p,'관계만 연결된 바깥 O','[합성] P의 소유 범위 밖이다.');ids.O=p.space.areas.at(-1).id;
for(const [k,x,y] of [['P',0,0],['L',0,230],['O',330,0]])p=D.moveArea(p,ids[k],{x,y});p=D.addRelation(p,ids.L,ids.O,'related','포함이 아닌 관계만 연결');
function request(k){p=D.submit(D.editDraft(p,`[명시 합성36 ${k}] 표시 문장 한 줄을 읽기 자료로 정리해 주세요.`),undefined,ids[k]);tasks[k]=p.currentTaskId;let s=D.begin(p,tasks[k]);let advice=mockAdvice(s.request);assert.equal(advice.question,null);p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice});for(const f of ['understanding','scope','next','checks'])p=D.editTask(p,tasks[k],f,`[합성36 ${k}/${f}] 원래 직접 입력값 · 배포 없음`);}
for(const k of ['L','O','P'])request(k);
for(const k of ['L','O']){let H='H_SYN36_REPORT_ONLY_'+k;let a=D.exportAnchor(p,D.taskOf(p,tasks[k]));let text=D.handoffText(p,tasks[k],H);p=D.markHandoff(p,tasks[k],text,'clipboard',p.revision,H,a);let f=JSON.parse([...text.matchAll(/```json\s*([\s\S]*?)```/g)].find(m=>m[1].includes('schemaVersion'))[1]);assert.equal(f.understanding,null);f.report=`[명시 합성36 ${k} 보고원문 고유표지] 후속 작업문은 아직 없고 실제 실행·개발·검증을 뜻하지 않는다.`;put('return-'+k+'.json',f);}
assert.equal(p.currentTaskId,tasks.P);assert.deepEqual(V.parseProject(JSON.stringify(p)),p);put('project.json',p);put('FACTS.json',{nature:'public domain API fixture; original unmodified reports arrive only through native UI file import',ids,tasks,current:tasks.P,expected:{leafOwners:[ids.L],parentOwners:[ids.P,ids.L],outsideExcluded:ids.O,questions:0,descriptions:0}});console.log(JSON.stringify({project:p.id,ids,tasks}));
