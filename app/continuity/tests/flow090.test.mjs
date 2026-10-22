// FLOW090: the user's plan space (purpose, areas, typed relations) lives beside the work records. Areas never
// rewrite sources/tasks/reports; a request belongs to the area it was written for, a report follows its task.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {parseProject} from '../dist/public/shared/validation.js';
import {serializeProject,WorkspaceStore,WORKSPACE_KEY} from '../dist/public/shared/storage.js';
import {mockAdvice} from '../server/mock.mjs';
const put=(p,text,kind='request',target,area)=>D.submit(D.editDraft(D.setKind(p,kind),text),target,area);
const respond=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});};
const exported=p=>D.markHandoff(p,p.currentTaskId,D.handoffText(p),'download');
const v3=p=>{const o=structuredClone(p);o.schemaVersion='idea015.project.3';delete o.space;for(const t of o.tasks){delete t.areaId;delete t.background;for(const h of t.handoffs){delete h.background;delete h.anchor;}}return JSON.stringify(o);};
// FLOW091-C: the unreleased first project.4 candidate is a project.4 file (no background copies).
const v4=p=>{const o=JSON.parse(serializeProject(p));o.schemaVersion='idea015.project.4';delete o.space.understanding;for(const t of o.tasks){delete t.background;for(const h of t.handoffs){delete h.background;delete h.anchor;}}return o;};
const planned=()=>{let p=D.setBrief(D.createProject(),'동네 미용실 예약 서비스');p=D.addArea(p,'예약','날짜와 시간을 골라 예약');p=D.addArea(p,'알림');
  const [booking,notify]=p.space.areas.map(a=>a.id);return {p,booking,notify};};

test('F090-1 a project.3 save opens unchanged with an empty space; space and areas survive save, backup and import',()=>{
  let p=exported(respond(put(D.createProject(),'예약 화면 만들기')));p=put(p,'보고: 화면을 만들었다고 주장','report');
  const old=v3(p),opened=parseProject(old);
  assert.equal(opened.schemaVersion,'idea015.project.6');assert.deepEqual(opened.space,{brief:null,areas:[],relations:[],draftTarget:null,layout:{version:'layout.1',positions:{}},understanding:{}});
  for(const k of ['sources','bases','currentTaskId','draft'])assert.deepEqual(opened[k],JSON.parse(old)[k],k);
  // FLOW091-C: older work gets background=null (task and export), never the current plan; nothing else changes.
  // AREA17: likewise every older export gets anchor=null (no plan or description revision is estimated for it).
  const strip=t=>{const {background,...rest}=t;assert.equal(background,null);return {...rest,handoffs:rest.handoffs.map(({background:b,anchor:a,...h})=>{assert.equal(b,null);assert.equal(a,null);return h;})};};
  assert.deepEqual(opened.tasks.map(strip),JSON.parse(old).tasks,'tasks');
  let q=D.addArea(opened,'예약','');q=D.placeTask(q,q.tasks[0].id,q.space.areas[0].id);
  const again=parseProject(serializeProject(q));assert.deepEqual(again.space,q.space);assert.equal(again.tasks[0].areaId,q.space.areas[0].id);
  assert.equal(D.areaOf(again,again.tasks[1]),q.space.areas[0].id,'the report follows its task into the area');
});

test('F090-2 areas: add (blank note = undecided), rename, archive/restore; typed relations, no self/duplicate links',()=>{
  let {p,booking,notify}=planned();
  assert.equal(p.space.areas[1].note,'');p=D.editArea(p,notify,'알림·문자','예약 확정 문자');assert.equal(p.space.areas[1].name,'알림·문자');
  assert.throws(()=>D.addArea(p,'   '));assert.throws(()=>D.editArea(p,'A_missing','x',''));
  p=D.addRelation(p,booking,notify,'flow','예약하면 알림');assert.equal(p.space.relations[0].kind,'flow');
  assert.throws(()=>D.addRelation(p,booking,notify,'flow',''),/RELATION_EXISTS/);assert.throws(()=>D.addRelation(p,booking,booking,'related',''));
  p=D.removeRelation(p,p.space.relations[0].id);assert.equal(p.space.relations.length,0);
  p=D.setAreaArchived(p,notify,true);assert.equal(p.space.areas[1].archived,true);p=D.setAreaArchived(p,notify,false);assert.equal(p.space.areas[1].archived,false);
});

test('F090-3 a request written for an area is placed there and continues that area, not the open work of another',()=>{
  let {p,booking,notify}=planned();
  p=respond(put(p,'예약 화면 만들기','request',undefined,booking));const b1=p.currentTaskId;assert.equal(D.taskOf(p).areaId,booking);
  p=respond(put(p,'알림 문자 보내기','request',undefined,notify));const n1=p.currentTaskId;
  assert.equal(D.taskOf(p).areaId,notify);assert.equal(D.taskOf(p).parentTaskId,null,'first in its area: not chained to the booking work');
  assert.ok(!D.handoffText(p).includes('직전에 넘긴 작업'),'no previous work carried over from the booking area');
  p=put(p,'예약 확인 버튼 문구','request',undefined,booking);assert.equal(D.taskOf(p).parentTaskId,b1,'continues the booking area');
  p=put(p,'버튼 색만 바꿔줘');assert.equal(D.taskOf(p).areaId,booking,'a follow-up keeps the area of the work it continues');
  p=put(p,'영역 없이 적는 메모','request',undefined,null);assert.equal(D.taskOf(p).areaId,undefined);
  assert.throws(()=>put(D.setAreaArchived(p,notify,true),'보관된 영역','request',undefined,notify),/AREA_MISSING/);
  assert.equal(p.tasks.find(t=>t.id===n1).areaId,notify);
});

test('F090-4 reports follow their task; validation refuses areas on returns, unknown areas and broken relations',()=>{
  let {p,booking}=planned();p=exported(respond(put(p,'예약 화면 만들기','request',undefined,booking)));
  p=put(p,'보고: 만들었다고 주장','report');const r=D.taskOf(p);assert.equal(r.areaId,undefined);assert.equal(D.areaOf(p,r),booking);
  assert.throws(()=>D.placeTask(p,r.id,booking),/RETURN_FOLLOWS_PARENT/);
  const bad=JSON.parse(serializeProject(p));bad.tasks.at(-1).areaId=booking;assert.throws(()=>parseProject(JSON.stringify(bad)));
  const unknown=JSON.parse(serializeProject(p));unknown.tasks[0].areaId='A_nope';assert.throws(()=>parseProject(JSON.stringify(unknown)));
  const rel=JSON.parse(serializeProject(p));rel.space.relations.push({id:'L_x',from:booking,to:'A_nope',kind:'flow',note:''});assert.throws(()=>parseProject(JSON.stringify(rel)));
});

// FLOW091-C changed the old policy: the purpose now goes out as a separated background copy (never as a request,
// source, basis or work instruction). The test keeps 'kept with earlier wording' and 'not a request/instruction'.
test('F090-5 the purpose text is kept (with earlier wording) and is not sent as a request or work instruction',()=>{
  let p=D.setBrief(D.createProject(),'예약 서비스');p=D.setBrief(p,'동네 미용실 예약 서비스');
  assert.deepEqual(p.space.brief.previous.map(x=>x.text),['예약 서비스']);assert.equal(D.setBrief(p,'동네 미용실 예약 서비스'),p);
  p=respond(put(p,'예약 화면 만들기'));
  const text=D.handoffText(p),block=text.indexOf('## 프로젝트 배경·영역 구상 — 이번 요청 범위와 구분'),work=text.indexOf('\n## 이번 작업');
  assert.ok(block>0&&text.indexOf('동네 미용실 예약 서비스')>block&&text.indexOf('동네 미용실 예약 서비스')<work,'only inside the background block');
  const req=D.begin(p).request;assert.equal(req.background.brief,'동네 미용실 예약 서비스');
  assert.ok(!JSON.stringify({...req,background:null}).includes('동네 미용실'),'not in sources, bases, facts or intent');
  assert.equal(p.sources.length,1);assert.ok(p.bases.every(b=>!b.text.includes('동네 미용실')));
});

test('F090-6 a stored project.3 entry opens through the workspace and the next save keeps its space',async()=>{
  class Memory{constructor(){this.map=new Map();}getItem(k){return this.map.get(k)??null;}setItem(k,v){this.map.set(k,String(v));}}
  class Locks{tail=Promise.resolve();request(n,cb){const run=this.tail.then(()=>cb());this.tail=run.catch(()=>{});return run;}}
  const old=JSON.parse(v3(respond(put(D.createProject(),'기존 요청')))),storage=new Memory();
  storage.setItem(WORKSPACE_KEY,JSON.stringify({version:'agentflow.workspace.1',migratedFromLegacy:true,entries:[{entryId:`E_${crypto.randomUUID()}`,state:'active',lifecycle:1,seq:1,createdAt:new Date().toISOString(),trashedAt:null,origin:'new',project:old}]}));
  const w=new WorkspaceStore(storage,new Locks());await w.init();assert.equal(w.readError,null);
  const e=w.entries()[0];assert.deepEqual(e.project.space,{brief:null,areas:[],relations:[],draftTarget:null,layout:{version:'layout.1',positions:{}},understanding:{}});assert.deepEqual(e.project.sources,old.sources);
  await w.save({entryId:e.entryId,lifecycle:e.lifecycle,seq:e.seq},D.addArea(e.project,'예약'));
  const saved=JSON.parse(storage.getItem(WORKSPACE_KEY)).entries[0].project;assert.equal(saved.schemaVersion,'idea015.project.6');assert.equal(saved.space.areas[0].name,'예약');
});

test('F090-7 returning to an area continues its latest request (and that request\'s returns), not a late old report',()=>{
  let {p,booking,notify}=planned();
  p=exported(respond(put(p,'A: 예약 화면 전체 변경','request',undefined,booking)));const A=p.currentTaskId;
  p=exported(respond(put(p,'B: 예약 버튼 문구만','request',undefined,booking)));const B=p.currentTaskId;
  p=exported(respond(put(p,'C: 알림 문자','request',undefined,notify)));const C=p.currentTaskId;
  p=put(p,'늦은 A 보고: 전체 화면을 고쳤다고 주장','report',A);assert.equal(p.currentTaskId,C,'receiving the report keeps C');
  const lateA=p.tasks.at(-1).id;
  let next=put(p,'예약 새 요청','request',undefined,booking);
  assert.equal(D.taskOf(next).parentTaskId,B,'the latest booking request, not the late A report');
  assert.ok(!D.handoffText(next).includes('늦은 A 보고'));
  // B's own returns stay with it.
  let q=put(p,'B 보고: 버튼 문구 바꿨다고 주장','report',B);const bReport=q.tasks.at(-1).id;
  q=put(q,'예약 새 요청','request',undefined,booking);assert.equal(D.taskOf(q).parentTaskId,bReport);
  // Explicitly continuing the old work is still the user's choice.
  let r=D.focusTask(p,lateA);r=put(r,'A 결과에서 이어가기','request',undefined,booking);assert.equal(D.taskOf(r).parentTaskId,lateA);
});

test('F090-8 the unsent request\'s area is saved with the draft; old formats default to following the current work',()=>{
  let {p,booking,notify}=planned();p=respond(put(p,'A: 예약 화면','request',undefined,booking));
  assert.equal(parseProject(v3(p)).space.draftTarget,null,'project.3 = follow the current work');
  const candidate=v4(p);delete candidate.space.draftTarget;assert.equal(parseProject(JSON.stringify(candidate)).space.draftTarget,null,'the first v4 candidate had none');
  p=D.setDraftTarget(D.editDraft(p,'알림 쪽 미제출 요청'),notify);
  const copy=parseProject(serializeProject(p));assert.deepEqual(copy.space.draftTarget,{area:notify});assert.equal(copy.draft,'알림 쪽 미제출 요청');
  const sent=D.submit(copy);assert.equal(D.taskOf(sent).areaId,notify);assert.equal(sent.space.draftTarget,null,'the target goes with the sent draft');
  assert.equal(D.taskOf(D.submit(D.setDraftTarget(D.editDraft(p,'영역 없이'),null))).areaId,undefined);
  const bad=JSON.parse(serializeProject(p));bad.space.draftTarget={area:'A_nope'};assert.throws(()=>parseProject(JSON.stringify(bad)));
  const parked=D.setAreaArchived(p,notify,true);assert.deepEqual(parked.space.draftTarget,{area:notify},'archiving never moves the draft');
  assert.throws(()=>D.submit(parked),/AREA_MISSING/);assert.throws(()=>D.setDraftTarget(parked,notify),/AREA_MISSING/);
});

test('F090-9 map positions: fixed defaults, free slots for new areas, one-field moves and a conditional undo',()=>{
  let {p,booking,notify}=planned();
  assert.deepEqual(parseProject(v3(D.createProject())).space.layout,{version:'layout.1',positions:{}});
  const candidate=v4(p);delete candidate.space.layout;delete candidate.space.draftTarget;
  const old=parseProject(JSON.stringify(candidate));assert.deepEqual(old.space.layout.positions,{},'unreleased candidate: defaults');
  const d0=D.areaPosition(old,old.space.areas[0]),d1=D.areaPosition(old,old.space.areas[1]);
  let q=D.setAreaArchived(D.addArea(old,'결제'),old.space.areas[0].id,true);q=D.setAreaArchived(q,old.space.areas[0].id,false);
  assert.deepEqual(D.areaPosition(q,q.space.areas[0]),d0);assert.deepEqual(D.areaPosition(q,q.space.areas[1]),d1,'adding/archiving moves nobody else');
  const placed=q.space.areas.map(a=>D.areaPosition(q,a));
  for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++)assert.ok(Math.abs(placed[i].x-placed[j].x)>=D.NODE_W||Math.abs(placed[i].y-placed[j].y)>=D.NODE_H,'new area does not overlap');
  const near=D.addArea(D.createProject(),'첫 영역','',{x:600,y:300});assert.deepEqual(Object.values(near.space.layout.positions)[0],{x:600,y:300});
  // One move changes one field; undo restores only it, keeping a report that arrived in between.
  p=exported(respond(put(p,'예약 화면','request',undefined,booking)));const from=D.areaPosition(p,p.space.areas[0]);
  const moved=D.moveArea(p,booking,{x:777.4,y:-12.6});assert.deepEqual(moved.space.layout.positions[booking],{x:777,y:-13});
  assert.deepEqual(moved.space.areas,p.space.areas);assert.deepEqual(moved.tasks,p.tasks);
  const withReport=put(moved,'보고: 화면 만들었다고 주장','report');
  const undone=D.undoMove(withReport,booking,from,{x:777,y:-13});
  assert.deepEqual(undone.space.layout.positions[booking],from);assert.equal(undone.tasks.length,withReport.tasks.length);assert.deepEqual(undone.sources,withReport.sources);
  assert.throws(()=>D.undoMove(D.moveArea(withReport,booking,{x:10,y:10}),booking,from,{x:777,y:-13}),/POSITION_CHANGED/,'moved again: not silently overwritten');
  assert.deepEqual(D.undoMove(D.moveArea(old,old.space.areas[0].id,{x:5,y:5}),old.space.areas[0].id,null,{x:5,y:5}).space.layout.positions,{},'back to the default slot');
  // Stored positions are checked and survive backup/import.
  assert.deepEqual(parseProject(serializeProject(moved)).space.layout,moved.space.layout);
  for(const bad of [{x:1.5,y:0},{x:0,y:999999},{x:'1',y:0}]){const b=JSON.parse(serializeProject(moved));b.space.layout.positions[booking]=bad;assert.throws(()=>parseProject(JSON.stringify(b)));}
  const stray=JSON.parse(serializeProject(moved));stray.space.layout.positions.A_nope={x:0,y:0};assert.throws(()=>parseProject(JSON.stringify(stray)));
  assert.throws(()=>D.moveArea(D.setAreaArchived(p,notify,true),notify,{x:0,y:0}),/AREA_MISSING/);
});

test('F090-10 automatic slots never land on an archived area or on another area at the coordinate limit',()=>{
  const overlap=(p,q)=>Math.abs(p.x-q.x)<D.NODE_W&&Math.abs(p.y-q.y)<D.NODE_H;
  let p=D.addArea(D.createProject(),'A');const A=p.space.areas[0].id,a0=D.areaPosition(p,p.space.areas[0]);
  p=D.setAreaArchived(p,A,true);p=D.addArea(p,'B');p=D.setAreaArchived(p,A,false);
  const [a,b]=p.space.areas.map(x=>D.areaPosition(p,x));assert.deepEqual(a,a0,'restored where it was');assert.ok(!overlap(a,b),'B did not take archived A\'s place');
  // Near the limit: each new area gets a distinct, in-range slot within a bounded search.
  let q=D.addArea(D.createProject(),'끝');q=D.moveArea(q,q.space.areas[0].id,{x:200000,y:0});
  for(let i=0;i<6;i++)q=D.addArea(q,`끝 ${i}`,'',{x:200000,y:0});
  const pts=q.space.areas.map(x=>D.areaPosition(q,x));
  for(const pt of pts)assert.ok(Math.abs(pt.x)<=200000&&Math.abs(pt.y)<=200000);
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)assert.ok(!overlap(pts[i],pts[j]),`slot ${i} and ${j} overlap`);
});

test('F090-11 fit shows every measured card inside the map, however far apart (no 0.4 floor)',async()=>{
  const {fitViewport}=await import('../dist/public/client/presentation.js');
  const inside=(w,h,boxes,v)=>boxes.every(b=>b.x*v.s+v.x>=0&&b.y*v.s+v.y>=0&&(b.x+b.w)*v.s+v.x<=w+1e-6&&(b.y+b.h)*v.s+v.y<=h+1e-6);
  for(const boxes of [[{x:0,y:0,w:240,h:132},{x:2000,y:0,w:240,h:132}],[{x:-200000,y:-200000,w:240,h:132},{x:200000,y:200000,w:240,h:310}],[{x:0,y:0,w:240,h:420}]]) {
    const v=fitViewport(320,400,boxes);assert.ok(v.s>0&&Number.isFinite(v.x)&&Number.isFinite(v.y));assert.ok(inside(320,400,boxes,v),JSON.stringify(v));
  }
  assert.equal(fitViewport(800,500,[{x:0,y:0,w:240,h:132}]).s,1.2,'a single card is not blown up past 120%');
});
