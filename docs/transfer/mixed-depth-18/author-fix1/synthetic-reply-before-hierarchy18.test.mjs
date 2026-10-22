import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as H from '../dist/public/shared/hierarchy.js';
import {subtreeSignals} from '../dist/public/shared/attention.js';
import {parseProject,parseResultFile} from '../dist/public/shared/validation.js';
import {createHash} from 'node:crypto';
import {mockAdvice} from '../server/mock.mjs';
import {hierarchyCases,hierarchySample} from './hierarchy18-fixtures.mjs';
import {readFileSync} from 'node:fs';
const round=p=>parseProject(JSON.stringify(p)),bring=(p,f)=>D.importResultFile(p,JSON.stringify(f)),current=(p,a)=>D.areaDescription(p,a).current;
function tree(){let p=D.createProject();const ids=[];for(const name of ['A','A1','A2','A21','B']){p=D.addArea(p,name,`${name}구상`);ids.push(p.space.areas.at(-1).id);}const [a,a1,a2,a21,b]=ids;p=D.setAreaParent(p,a1,a);p=D.setAreaParent(p,a2,a);p=D.setAreaParent(p,a21,a2);return {p,a,a1,a2,a21,b};}
test('H18 one inclusion forest is separate from Task continuation, relations and absolute positions',()=>{
 let {p,a,a1,a2,a21,b}=tree();const coords=structuredClone(p.space.layout),areas=structuredClone(p.space.areas);p=D.addRelation(p,a1,b,'needs','actual endpoint');p=D.submit(D.editDraft(p,'자식 요청'),undefined,a21);const task=D.taskOf(p);
 assert.deepEqual(H.areaPath(p,a21).map(a=>a.id),[a,a2,a21]);assert.equal(H.parentArea(p,a21).id,a2);assert.deepEqual(H.childrenOf(p,a).map(a=>a.id),[a1,a2]);assert.deepEqual(H.descendantAreas(p,a).map(a=>a.id),[a1,a2,a21]);
 const n=D.setAreaParent(p,a2,b);assert.equal(D.areaOf(n,task),a21);assert.deepEqual(n.tasks,p.tasks);assert.deepEqual(n.space.relations,p.space.relations);assert.deepEqual(n.space.layout,coords);assert.deepEqual(n.space.areas,areas);assert.deepEqual(round(n),n);
});
test('H18 self/cycle/missing/cross-project/archived parents are rejected atomically; archived history and active-child rule survive restore',()=>{
 let {p,a,a1,a2,a21,b}=tree();const raw=JSON.stringify(p);
 for(const [child,parent]of [[a,a],[a,a21],[a,'A_other_project'],['A_missing',b]])assert.throws(()=>D.setAreaParent(p,child,parent));
 assert.equal(JSON.stringify(p),raw);assert.throws(()=>D.setAreaArchived(p,a,true),/ACTIVE_CHILDREN/);
 p=D.setAreaArchived(p,b,true);assert.throws(()=>D.setAreaParent(p,a1,b),/PARENT_MISSING/);assert.throws(()=>D.addChildArea(p,b,'새 부분'),/PARENT_MISSING/);
 p=D.setAreaArchived(p,a21,true);p=D.setAreaArchived(p,a2,true);assert.throws(()=>D.setAreaArchived(p,a21,false),/PARENT_ARCHIVED/);assert.deepEqual(round(p),p);
 for(const corrupt of [q=>q.space.containment.parents[a]=a21,q=>q.space.containment.parents[a1]='A_missing',q=>q.space.containment.revisions.extra=0,q=>delete q.space.containment.revisions[a],q=>q.space.containment.version='wrong',q=>q.space.containment.parents[a1]=b]){const q=structuredClone(p);corrupt(q);assert.throws(()=>round(q));}
});
test('H18 child creation is near its parent without moving any existing position or work',()=>{
 let {p,a}=tree();p=D.moveArea(p,a,{x:1200,y:800});const before=structuredClone(p);p=D.addChildArea(p,a,'새 하위 부분','구상');const child=p.space.areas.at(-1);
 assert.equal(H.parentArea(p,child.id).id,a);for(const old of before.space.areas)assert.deepEqual(p.space.layout.positions[old.id],before.space.layout.positions[old.id]);assert.deepEqual(p.tasks,before.tasks);assert.ok(Math.abs(p.space.layout.positions[child.id].x-1200)<=600);
 const point=p.space.layout.positions[child.id];for(const old of before.space.areas){const at=D.areaPosition(p,old);assert.ok(Math.abs(at.x-point.x)>=240+20||Math.abs(at.y-point.y)>=180+20,'new slot respects bounded180px card footprint without moving an old area');}assert.deepEqual(round(p),p);
});
test('H18 branch fold uses the outermost representative and never mutates model, scale or actual edges',()=>{
 let {p,a,a1,a2,a21,b}=tree();p=D.addRelation(p,a,b,'flow','direct');p=D.addRelation(p,a1,b,'flow','inside A');p=D.addRelation(p,a21,b,'flow','inside A2');p=D.addRelation(p,b,a21,'flow','opposite');p=D.addRelation(p,a21,b,'needs','other kind');p=D.addRelation(p,a1,a21,'related','internal');const original=JSON.stringify(p);
 const closed=new Set([a,a2]);assert.deepEqual(H.visibleAreas(p,closed).map(a=>a.id),[a,b]);assert.equal(H.visibleRepresentative(p,a21,closed),a);assert.equal(H.visibleRepresentative(p,a21,new Set([a2])),a2);
 const bundles=H.bundleRelations(p,closed),flow=bundles.find(x=>x.from===a&&x.to===b&&x.kind==='flow');assert.equal(flow.directIds.length,1);assert.equal(flow.hiddenIds.length,2);assert.equal(flow.relations.length,3);assert.ok(bundles.some(x=>x.from===b&&x.to===a));assert.ok(bundles.some(x=>x.kind==='needs'));assert.equal(bundles.find(x=>x.internal).relations[0].note,'internal');
 assert.equal(H.bundleRelations(p,new Set()).length,p.space.relations.length);assert.equal(JSON.stringify(p),original);assert.equal(H.visibleRepresentative(p,'missing',closed),null);
});
for(const c of hierarchyCases)test(`H18 ${c.id}: real-source reconstruction survives update, exact leaf request/handoff, collapse projection and recovery`,()=>{
 let {p,ids,area,task,file,text,metadata}=hierarchySample(c);const positions=structuredClone(p.space.layout),before=structuredClone(D.taskOf(p,task).background);p=bring(p,file);
 assert.equal(current(p,area).valid,true);assert.equal(current(p,area).summary,c.summary);assert.deepEqual(D.taskOf(p,task).background,before);assert.deepEqual(p.space.layout,positions);assert.equal(D.areaOf(p,D.taskOf(p)),area);
 const closed=new Set([ids[c.parent]]);assert.equal(H.visibleRepresentative(p,area,closed),ids[c.parent]);assert.equal(subtreeSignals(p,ids[c.parent]).find(s=>s.areaId===area).description.current.summary,c.summary);
 p=D.submit(D.editDraft(p,'[합성 후속 요청] 이 자식의 버튼 문구만 확인한다.'),undefined,area);const handoff=D.handoffText(p);assert.ok(handoff.includes(c.summary));assert.ok(handoff.includes('자식의 명시 범위·조건을 조상 참고로 확대·축소·대체하지 않습니다'));assert.ok(handoff.includes('미채택 제안'));assert.ok(text.includes('포함 맥락 참고'));assert.ok(metadata.links.every(l=>l.startsWith('https://github.com/')));assert.deepEqual(round(p),p);
});
for(const kind of ['parent note','parent name','parent A-B-A','parent note restore','self A-B-A'])test(`H18 ${kind}: reference changes hold late descriptions and stale current/correction/handoff consistently`,()=>{
 let {p,ids,area,task,file}=hierarchySample();p=bring(p,file);const root=ids.editor,search=ids.search,other=ids.hook,old=structuredClone(p.space.areas.find(a=>a.id===root));
 if(kind==='parent note')p=D.editArea(p,root,old.name,'새 부모 참고');
 if(kind==='parent name')p=D.editArea(p,root,'새 부모 이름',old.note);
 if(kind==='parent A-B-A'){p=D.setAreaParent(p,search,other);p=D.setAreaParent(p,search,root);}
 if(kind==='parent note restore'){p=D.editArea(p,root,old.name,'임시 구상');p=D.editArea(p,root,old.name,old.note);}
 if(kind==='self A-B-A'){p=D.setAreaParent(p,area,other);p=D.setAreaParent(p,area,search);}
 assert.equal(current(p,area).valid,false);assert.throws(()=>D.correctUnderstanding(p,area,'단순 재저장'),/NOTHING_TO_CORRECT/);
 const revised={...file,understanding:{...file.understanding,summary:'늦은 설명'}};p=bring(p,revised);assert.equal(D.areaDescription(p,area).held[0].entry.held,'plan-changed');assert.ok(!D.handoffText(p,task).includes(file.understanding.summary));assert.ok(D.handoffText(p,task).includes('현재 설명으로 쓰지 않습니다'));assert.deepEqual(round(p),p);
});
test('H18 unrelated branches, layout and derived parent description do not change child reference basis',()=>{
 let {p,ids,area,file}=hierarchySample();const other=p.space.areas.find(a=>a.id===ids.hook);p=D.editArea(p,other.id,'다른 이름','다른 구상');p=D.moveArea(p,ids.editor,{x:900,y:150});p=bring(p,file);assert.equal(current(p,area).valid,true);
 p=D.submit(D.editDraft(p,'[합성] 부모의 설명을 정리할 요청'),undefined,ids.editor);const task=p.currentTaskId,Hid='H_parent_derived',anchor=D.exportAnchor(p,D.taskOf(p));p=D.markHandoff(p,task,D.handoffText(p,task,Hid),'download',p.revision,Hid);
 p=bring(p,{...file,taskId:task,returnId:Hid,understanding:{...file.understanding,areaId:ids.editor,basedOn:anchor.understanding,summary:'[합성] 부모의 파생 설명만 갱신'}});assert.equal(current(p,ids.editor).valid,true);assert.equal(current(p,area).valid,true);assert.deepEqual(round(p),p);
});
test('H18 legacy anchor.1/current root remain readable; adding then removing a parent never invents old ancestry',()=>{
 let {p,a,a1,b}=tree();p=D.setAreaParent(p,a1,null);p=D.submit(D.editDraft(p,'평면 요청'),undefined,b);const task=p.currentTaskId,Hid='H_legacy';const stamp=D.planStamp(p,b),legacy={...stamp};delete legacy.version;delete legacy.revision;delete legacy.ancestors;
 p=D.markHandoff(p,task,D.handoffText(p,task,Hid),'download',p.revision,Hid);D.taskOf(p,task).handoffs.at(-1).anchor={version:'anchor.1',areaId:b,understanding:0,stamp:legacy};
 const file={schemaVersion:'agentflow.return.2',projectId:p.id,taskId:task,returnId:Hid,report:'과거 보고',evidence:null,understanding:{version:'understanding.1',areaId:b,basedOn:0,summary:'이전 평면 설명',changes:[],proposal:null,origin:'합성 호환 경계'}};
 p=bring(p,file);assert.equal(current(p,b).valid,true);const anchor=structuredClone(D.taskOf(p,task).handoffs.at(-1).anchor);p=D.setAreaParent(p,b,a);assert.equal(current(p,b).valid,false);p=D.setAreaParent(p,b,null);assert.equal(current(p,b).valid,false);assert.deepEqual(D.taskOf(p,task).handoffs.at(-1).anchor,anchor);assert.deepEqual(round(p),p);
});
test('H18 v6 migration preserves exact legacy stamps, raw return files, ids and positions without ancestor backfill',()=>{
 let {p,b}=tree();p=D.submit(D.editDraft(p,'과거 루트'),undefined,b);const t=p.currentTaskId,Hid='H_migrated';p=D.markHandoff(p,t,D.handoffText(p,t,Hid),'download',p.revision,Hid);
 const old=structuredClone(p);old.schemaVersion='idea015.project.6';delete old.space.containment;for(const task of old.tasks)for(const h of task.handoffs)if(h.anchor){h.anchor.version='anchor.1';delete h.anchor.stamp.version;delete h.anchor.stamp.revision;delete h.anchor.stamp.ancestors;}
 const migrated=round(old);assert.equal(migrated.schemaVersion,'idea015.project.7');assert.deepEqual(migrated.space.containment.parents,{});assert.ok(Object.values(migrated.space.containment.revisions).every(v=>v===0));assert.deepEqual(migrated.tasks,old.tasks);assert.deepEqual(migrated.space.layout,old.space.layout);assert.deepEqual(round(migrated),migrated);
 const extra=structuredClone(migrated);extra.space.containment.parents.foo='missing';assert.throws(()=>round(extra));const mixed=structuredClone(migrated);mixed.tasks[0].handoffs[0].anchor.version='anchor.2';assert.throws(()=>round(mixed));
});
test('H18 recorded synthetic question/report/description signals retain exact area owners; relations never duplicate them',()=>{
 let {p,ids,area,file}=hierarchySample();p=D.submit(D.editDraft(p,'[합성 경계] 답 기록 여부를 확인할 별도 질문 요청'),undefined,area);const before=D.begin(p);const advice=mockAdvice(before.request);advice.question={kind:'fact',text:'[합성 경계] 실제 자료에 없는 질문',why:'질문 신호 검사용이며 실제 사용자 미결 아님',options:[]};p=D.receive(before.project,before.request,{mode:'mock',ticket:before.request.ticket,advice});p=bring(p,file);p=D.addRelation(p,ids.hook,area,'needs','합성 추가 관계');
 const signals=subtreeSignals(p,ids.editor),leaf=signals.find(s=>s.areaId===area);assert.equal(leaf.questions.length,1);assert.equal(leaf.questions[0].answered,false);assert.equal(leaf.reports.length,1);assert.equal(leaf.description.current.valid,true);assert.equal(signals.flatMap(s=>s.questions).length,1);assert.equal(subtreeSignals(p,ids.hook).flatMap(s=>s.questions).length,0);
 const questionTask=leaf.questions[0].taskId;p=D.answer(p,questionTask,'[합성 경계] 질문에 대한 실제 입력 경로의 답변');assert.equal(D.questionAnswered(p,D.taskOf(p,questionTask)),true);
 const after=subtreeSignals(p,ids.editor).flatMap(s=>s.questions);assert.equal(after.filter(q=>!q.answered).length,0,'a recorded reply is never promoted to an outstanding question');assert.deepEqual(round(p),p);
});
test('H18 fixed actual project.6 state paths migrate without rewriting valid/held/user history, then parent attach-detach stays stale after reload',()=>{
 const raw=readFileSync(new URL('./fixtures/hierarchy18/project6-accepted.json',import.meta.url),'utf8'),origin=JSON.parse(readFileSync(new URL('./fixtures/hierarchy18/project6-origin.json',import.meta.url),'utf8')),old=JSON.parse(raw);
 assert.equal(old.schemaVersion,'idea015.project.6');assert.equal(origin.sourceCommit,'7bea120983c3571b26164d6acd40f350611a7213');let p=parseProject(raw);
 assert.equal(createHash('sha256').update(raw).digest('hex'),origin.fixtureSha256);assert.equal(Buffer.byteLength(raw),origin.fixtureBytes);
 assert.deepEqual(p.tasks,old.tasks);assert.deepEqual(p.space.understanding,old.space.understanding);
 for(const [area,expected]of Object.entries(origin.expected)){const d=D.areaDescription(p,area);assert.deepEqual({valid:d.current?.valid??null,summary:d.current?.summary??null,by:d.current?.entry.by??null,held:d.held.map(x=>x.entry.held)},expected);}
 const area=origin.areaIds['유효한 기존 설명'],parent=origin.areaIds['사용자 정정된 기존 설명'];const request=p.tasks.find(t=>t.areaId===area&&!D.isReturnTask(p,t));assert.ok(D.handoffText(p,request.id).includes('유효한 기존 설명의 전달 설명'));
 const anchors=structuredClone(p.tasks.map(t=>t.handoffs));p=D.setAreaParent(p,area,parent);p=D.setAreaParent(p,area,null);p=round(p);assert.equal(current(p,area).valid,false);assert.ok(!D.handoffText(p,request.id).includes('유효한 기존 설명의 전달 설명'));assert.deepEqual(p.tasks.map(t=>t.handoffs),anchors);
 const bad=JSON.parse(raw);bad.space.containment={version:'containment.1',parents:{},revisions:{}};assert.throws(()=>round(bad));
 const mixed=JSON.parse(raw);const h=mixed.tasks.find(t=>t.handoffs.length).handoffs[0];h.anchor.version='anchor.2';assert.throws(()=>round(mixed));
 const forbidden=JSON.parse(raw);forbidden.tasks.find(t=>t.handoffs.length).handoffs[0].anchor.stamp.revision=0;assert.throws(()=>round(forbidden),'legacy stamp never carried a new context revision');
 const first=old.tasks.find(t=>t.resultFile).resultFile;const result=JSON.parse(first.rawText),one={...result,schemaVersion:'agentflow.return.1'};assert.throws(()=>parseResultFile(JSON.stringify(one)),'return.1 never permits an understanding key');delete one.understanding;assert.equal(parseResultFile(JSON.stringify(one)).schemaVersion,'agentflow.return.1');
 const missing={...result};delete missing.understanding;assert.throws(()=>parseResultFile(JSON.stringify(missing)),'return.2 requires the optional block key');assert.equal(parseResultFile(JSON.stringify({...result,understanding:null})).understanding,null);
});
test('H18 project.5 export has no invented anchor: late return.2 report/raw kept and only description held',()=>{
 const raw=JSON.parse(readFileSync(new URL('./fixtures/hierarchy18/project6-accepted.json',import.meta.url),'utf8'));raw.schemaVersion='idea015.project.5';delete raw.space.understanding;for(const t of raw.tasks)for(const h of t.handoffs)delete h.anchor;
 let p=round(raw);const task=p.tasks.find(t=>t.handoffs.length),h=task.handoffs[0],area=task.areaId;
 const file={schemaVersion:'agentflow.return.2',projectId:p.id,taskId:task.id,returnId:h.returnId,report:'[합성] 옛export에온새보고',evidence:null,understanding:{version:'understanding.1',areaId:area,basedOn:0,summary:'없는 옛기준을 추측하지 않는다',changes:[],proposal:null,origin:'합성 호환 경계'}};
 p=bring(p,file);assert.equal(D.areaDescription(p,area).held[0].entry.held,'no-anchor');assert.equal(p.tasks.at(-1).resultFile.rawText,JSON.stringify(file));assert.deepEqual(round(p),p);
 const illegal=structuredClone(raw);illegal.tasks.find(t=>t.handoffs.length).handoffs[0].anchor=null;assert.throws(()=>round(illegal));
});
test('H18 handoff never hides an active recorded question, and its later answer stays a reply record rather than an obligation',()=>{
 let {p,ids,area}=hierarchySample();p=D.submit(D.editDraft(p,'[합성 경계] 인계 뒤에도 남아야 할 질문을 포함하는 요청'),undefined,area);const task=p.currentTaskId,s=D.begin(p),advice=mockAdvice(s.request);
 advice.question={kind:'fact',text:'[합성 경계] 실제 표본에 없는 기록 질문',why:'인계와 답변 경계 검사',options:[]};p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice});
 const questions=()=>subtreeSignals(p,ids.editor).find(x=>x.areaId===area).questions;assert.equal(questions().length,1);assert.equal(D.questionApplicability(p,D.taskOf(p,task)),'active');
 p=D.markHandoff(p,task,D.handoffText(p,task),'clipboard');assert.equal(D.questionApplicability(p,D.taskOf(p,task)),'active');assert.equal(questions().length,1,'export changes work presentation, not the recorded question');assert.equal(questions()[0].answered,false);
 p=D.answer(p,task,'[합성 경계] 실제 입력 경로로 답 기록');assert.equal(questions().length,1);assert.equal(questions()[0].answered,true);assert.equal(questions()[0].applicability,'answered');assert.deepEqual(round(p),p);
});
test('H18 test-only questions remain excluded from real recorded-question signals',()=>{
 let {p,ids,area}=hierarchySample();p=D.submit(D.setKind(D.editDraft(p,'[합성 경계] 시험 문맥에만 있는 질문'), 'test_answer'),undefined,area);const task=p.currentTaskId,s=D.begin(p),advice=mockAdvice(s.request);
 advice.question={kind:'fact',text:'시험 전용 질문',why:'실제 요구 신호에 합산하지 않음',options:[]};p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice});
 assert.equal(D.taskStatus(p,D.taskOf(p,task)),'시험 문맥 · 실제 요구 아님');assert.equal(D.questionApplicability(p,D.taskOf(p,task)),'active');assert.equal(subtreeSignals(p,ids.editor).flatMap(x=>x.questions).length,0);assert.deepEqual(round(p),p);
});
test('H18 parent-recorded common and local decisions keep their authority and verbatim scope, without automatic child inheritance',()=>{
 let {p,a,a1}=tree();p=D.submit(D.editDraft(p,'[합성 경계] 부모 관리 화면의 조건을 기록한다'),undefined,a);const ownerTask=p.currentTaskId;
 for(const text of ['모든 하위 화면은 키보드로 조작 가능해야 한다.','부모 관리 화면만 읽기 전용으로 유지한다.'])p=D.recordBasis(p,text);
 const decisions=structuredClone(p.bases.filter(b=>b.status==='confirmed'));p=D.submit(D.editDraft(p,'[합성 경계] 자식 화면의 입력 버튼 문구만 바꾼다'),undefined,a1);const s=D.begin(p);p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});
 const before=structuredClone(p),text=D.handoffText(p),section=text.split('## 다른 영역에서 기록한 사용자 기준')[1].split('\n## ')[0];
 for(const b of decisions){assert.ok(section.includes(`[${b.id}] 사용자 확정 / r${b.revision} / ${b.sourceId}\n${b.text}`));assert.ok(!text.split('## 이어갈 기준')[1].split('## 다른 영역에서 기록한 사용자 기준')[0].includes(b.text));}
 assert.ok(section.includes(`기록 소유 영역: A [${a}] / 기록 작업: ${ownerTask}`));assert.match(section,/source.taskId나 기록 위치로 실제 적용 범위를 판정하지 않으며/);assert.match(section,/자식의 실행 범위로 자동 상속하지 않습니다/);assert.match(section,/공통 조건은 해당 범위에서 유지/);assert.match(text,/각 원문이 명시한 범위에서 아래 현재 값 그대로 유효/);
 assert.deepEqual(p,before);assert.deepEqual(round(p),p);const childTask=p.currentTaskId,Hid='H_scoped';const anchor=D.exportAnchor(p,D.taskOf(p));p=D.markHandoff(p,childTask,D.handoffText(p,childTask,Hid),'clipboard',p.revision,Hid,anchor);assert.deepEqual(p.bases,before.bases);assert.deepEqual(D.taskOf(p,childTask).handoffs.at(-1).anchor,anchor);
});
