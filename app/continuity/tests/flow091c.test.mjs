// FLOW091-C: the saved plan (project purpose + the request's own area) reaches the work text as a fixed background copy.
// Captured only by an explicit new request; returns carry the copy of the exact task/export they return to; older work
// stays null. Background is material apart from the request: never a source, basis, decision or intent.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as D from '../dist/public/shared/domain.js';
import {API_SCHEMA,SCHEMA,REQUEST_BYTES,FILE_LIMIT} from '../dist/public/shared/types.js';
import {parseProject,validateRequest} from '../dist/public/shared/validation.js';
import {serializeProject} from '../dist/public/shared/storage.js';
import {mockAdvice} from '../server/mock.mjs';
import {SYSTEM_PROMPT} from '../server/prompt.mjs';
import {createContinuityApp} from '../server/app.mjs';
import {readConfig} from '../../server/config.mjs';
import {fileFor} from './connect039-fixtures.mjs';
const put=(p,text,kind='request',target,area)=>D.submit(D.editDraft(D.setKind(p,kind),text),target,area);
const respond=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});};
const exported=(p,returnId=null)=>D.markHandoff(p,p.currentTaskId,D.handoffText(p,p.currentTaskId,returnId),'download',p.revision,returnId);
const BRIEF='동네 미용실 손님이 휴대폰으로 날짜와 시간을 골라 예약하는 서비스';
const planned=()=>{let p=D.setBrief(D.createProject(),BRIEF);p=D.addArea(p,'예약','날짜와 시간을 골라 예약 · 추가 아이디어: 쿠폰 · 아직 못 정함: 결제 방식');p=D.addArea(p,'알림','문자 알림 · 밤에는 보내지 않기');
  const [booking,notify]=p.space.areas.map(a=>a.id);return {p,booking,notify};};
const block='## 프로젝트 배경·영역 구상 — 이번 요청 범위와 구분';
const section=text=>{const i=text.indexOf(block);if(i<0)return '';const j=text.indexOf('\n## ',i+block.length);return text.slice(i,j<0?undefined:j);};
const roundtrip=p=>parseProject(serializeProject(p));
function post(port,body) {
  return new Promise((resolve,reject)=>{
    const r=http.request({hostname:'127.0.0.1',port,path:'/api/continuity',method:'POST',headers:{Origin:`http://127.0.0.1:${port}`,'Content-Type':'application/json','X-AgentFlow-Request':'1'}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString())}));
    });r.on('error',reject);r.end(JSON.stringify(body));
  });
}
async function serve(app,run){await new Promise(r=>app.listen(0,'127.0.0.1',r));try{return await run(app.address().port);}finally{app.closeAllConnections();await new Promise(r=>app.close(r));}}

test('F091C-a the request\'s own area goes out the same way in the AI input, preview/Markdown and export record; other areas never',()=>{
  let {p,booking,notify}=planned();
  // The map selection is UI state; the area is what submit decided (saved draft target here).
  p=D.setDraftTarget(D.editDraft(p,'예약 화면에서 날짜와 시간을 고르게 해줘'),booking);p=D.submit(p);
  const t=D.taskOf(p),bg=t.background;
  assert.deepEqual(bg,{version:'background.1',revision:p.revision-1,brief:BRIEF,area:{id:booking,name:'예약',note:'날짜와 시간을 골라 예약 · 추가 아이디어: 쿠폰 · 아직 못 정함: 결제 방식'}});
  const req=D.begin(p).request;assert.equal(req.schemaVersion,API_SCHEMA);assert.equal(API_SCHEMA,'idea022.context.7');
  assert.deepEqual(req.background,bg);validateRequest(req);
  const text=D.handoffText(p),bgText=section(text);
  assert.ok(bgText.includes(BRIEF)&&bgText.includes('예약 ['+booking+']')&&bgText.includes('추가 아이디어: 쿠폰'));
  assert.match(bgText,/이번 요청이 실행 범위를 정합니다/);assert.match(bgText,/임의로 확정하지 마세요/);
  for(const s of [text,JSON.stringify(req)]){assert.ok(!s.includes('알림')&&!s.includes(notify)&&!s.includes('밤에는'),'no other area, relation or note');}
  p=respond(p);p=exported(p);const rec=D.taskOf(p).handoffs.at(-1);assert.deepEqual(rec.background,bg,'the export keeps the copy it sent');
  assert.equal(section(D.handoffText(p)),bgText,'preview and Markdown use the same text');
  // A follow-up without a target continues the current work's area and captures that area.
  p=put(p,'버튼 문구만 바꿔줘');assert.equal(D.taskOf(p).background.area.id,booking);
  p=put(p,'알림 문자 보내기','request',undefined,notify);assert.equal(D.taskOf(p).background.area.name,'알림');
  p=put(p,'영역 없이 메모','request',undefined,null);assert.deepEqual(D.taskOf(p).background.area,null);assert.equal(D.taskOf(p).background.brief,BRIEF);
});

test('F091C-b later plan edits, moves, re-organising and repeated exports never change A; only the next explicit request (B) is current',()=>{
  let {p,booking,notify}=planned();p=put(p,'A: 예약 화면 만들기','request',undefined,booking);const A=p.currentTaskId,bgA=structuredClone(D.taskOf(p).background);
  p=exported(respond(p));const textA=section(D.handoffText(p,A));
  p=D.setBrief(p,'미용실과 네일숍 예약 서비스');p=D.editArea(p,booking,'예약하기','날짜만 고르기');p=D.moveArea(p,booking,{x:900,y:500});
  p=D.setAreaArchived(p,notify,true);p=D.placeTask(p,A,null);p=respond(p);p=exported(p);p=exported(p);p=D.focusTask(p,A);
  p=roundtrip(p);
  assert.deepEqual(D.taskOf(p,A).background,bgA);assert.equal(section(D.handoffText(p,A)),textA);
  assert.ok(D.taskOf(p,A).handoffs.every(h=>JSON.stringify(h.background)===JSON.stringify(bgA)));
  assert.deepEqual(D.begin(p,A).request.background,bgA,'a re-organisation of A still sends A\'s copy');
  p=put(p,'B: 예약 확인 화면','request',undefined,booking);const B=D.taskOf(p).background;
  assert.equal(B.brief,'미용실과 네일숍 예약 서비스');assert.deepEqual(B.area,{id:booking,name:'예약하기',note:'날짜만 고르기'});
  assert.deepEqual(D.taskOf(p,A).background,bgA);
});

test('F091C-c A export -> B -> late A report (paste and exact file returnId): A\'s copy, B\'s focus/request/copy unchanged',()=>{
  let {p,booking,notify}=planned();p=put(p,'A: 예약 화면 전체 정리','request',undefined,booking);const A=p.currentTaskId;
  p=respond(p);const H='H_c091';p=exported(p,H);p=exported(p);const bgA=structuredClone(D.taskOf(p,A).background);
  p=D.setBrief(p,'바뀐 목적');p=D.editArea(p,booking,'예약','바뀐 구상');
  p=exported(respond(put(p,'B: 알림 문구만','request',undefined,notify)));const B=p.currentTaskId,bgB=structuredClone(D.taskOf(p).background);
  assert.equal(bgB.brief,'바뀐 목적');
  const pasted=put(p,'A 보고: 전체 정리를 했다고 주장','report',A);const ra=pasted.tasks.at(-1);
  assert.equal(ra.parentTaskId,A);assert.deepEqual(ra.background,bgA,'the report carries the task it returns to');
  assert.equal(pasted.currentTaskId,B);assert.deepEqual(D.taskOf(pasted,B).background,bgB);assert.equal(pasted.sources.find(s=>s.id===D.taskOf(pasted,B).sourceIds[0]).text,'B: 알림 문구만');
  const filed=D.importResultFile(p,JSON.stringify(fileFor(p,A,H)));const rf=filed.tasks.at(-1);
  assert.deepEqual(rf.background,D.taskOf(p,A).handoffs.find(h=>h.returnId===H).background);assert.deepEqual(rf.background,bgA);
  assert.equal(filed.currentTaskId,B);assert.deepEqual(D.taskOf(filed,B).background,bgB);
  // The report's own re-organisation sends A's copy; the next explicit request captures the latest plan.
  const opened=D.focusTask(filed,rf.id);assert.deepEqual(D.begin(opened).request.background,bgA);
  assert.equal(section(D.handoffText(opened)).includes('이 보고가 돌아간 작업의 요청을 쓸 때'),true);
  const next=put(opened,'C: 새 요청','request',undefined,booking);assert.equal(D.taskOf(next).background.area.note,'바뀐 구상');
  // An older export without a stored copy stays null; the current plan is never used to fill it.
  const old=JSON.parse(serializeProject(p));old.schemaVersion='idea015.project.4';for(const t of old.tasks){delete t.background;for(const h of t.handoffs)delete h.background;}
  const migrated=parseProject(JSON.stringify(old));assert.equal(migrated.schemaVersion,SCHEMA);
  const legacyFile=D.importResultFile(migrated,JSON.stringify(fileFor(migrated,A,H))).tasks.at(-1);assert.equal(legacyFile.background,null);
  assert.equal(put(migrated,'A 보고 붙여넣기','report',A).tasks.at(-1).background,null);
  assert.equal(section(D.handoffText(D.focusTask(migrated,A))),'','no block for work without a copy');
});

test('F091C-d ideas and undecided points in the background never become bases, sources, intent or decisions; manual edits keep priority',()=>{
  let {p,booking}=planned();p=put(p,'예약 화면에서 날짜만 고르게 해줘','request',undefined,booking);
  p=respond(p);const t=D.taskOf(p);
  for(const s of [JSON.stringify(p.bases),JSON.stringify(p.sources),JSON.stringify(t.advice)])assert.ok(!s.includes('쿠폰')&&!s.includes('결제 방식')&&!s.includes(BRIEF),'not promoted');
  assert.equal(p.bases.length,1);assert.equal(p.bases[0].status,'requested');
  p=D.editTask(p,t.id,'next','날짜 선택 칸만 추가하세요. 쿠폰과 결제는 하지 않습니다.');p=D.editTask(p,t.id,'scope','날짜 선택만');
  p=D.setBrief(p,'완전히 다른 목적');p=respond(p);
  const text=D.handoffText(p),work=text.slice(text.indexOf('\n## 이번 작업'));
  assert.ok(work.includes('날짜 선택 칸만 추가하세요. 쿠폰과 결제는 하지 않습니다.')&&work.includes('날짜 선택만'),'manual values stay');
  assert.ok(!text.includes('완전히 다른 목적'),'the prepared task is not updated to the new plan');assert.ok(section(text).includes(BRIEF));
  assert.equal(p.bases.length,1);assert.ok(p.bases.every(b=>b.status==='requested'));
  // The provider is told background is material, not a basis or decision.
  assert.match(SYSTEM_PROMPT,/background는 이 작업의 요청을 쓸 때/);assert.match(SYSTEM_PROMPT,/아직 정하지 않은 점을 확정하거나/);assert.match(SYSTEM_PROMPT,/basisRefs에는 bases만 인용/);
});

test('F091C-e old formats, reload, backup, empty values, maximum Unicode and byte limits: null, exact, refused (never cut)',()=>{
  // Older formats: every task and export null (no backfill even when the plan exists).
  let {p,booking}=planned();p=exported(respond(put(p,'예약','request',undefined,booking)));
  const v4=JSON.parse(serializeProject(p));v4.schemaVersion='idea015.project.4';for(const t of v4.tasks){delete t.background;for(const h of t.handoffs)delete h.background;}
  const m=parseProject(JSON.stringify(v4));assert.ok(m.tasks.every(t=>t.background===null&&t.handoffs.every(h=>h.background===null)));
  assert.equal(D.begin(m,m.tasks[0].id).request.background,null);
  const keyed=structuredClone(v4);keyed.tasks[0].background=null;assert.throws(()=>parseProject(JSON.stringify(keyed)),'a project.4 file never had the key');
  const missing=JSON.parse(serializeProject(p));delete missing.tasks[0].background;assert.throws(()=>parseProject(JSON.stringify(missing)),'project.5 requires it');
  // Reload and backup copies keep the exact copy.
  assert.deepEqual(roundtrip(p),p);
  // Empty values are null; no placeholder text is generated.
  let e=put(D.createProject(),'첫 요청');assert.deepEqual(D.taskOf(e).background,{version:'background.1',revision:e.revision-1,brief:null,area:null});
  assert.equal(section(D.handoffText(e)),'');
  e=D.addArea(D.setBrief(D.createProject(),'목적'),'빈 영역','');e=put(e,'요청','request',undefined,e.space.areas[0].id);
  assert.deepEqual(D.taskOf(e).background.area,{id:e.space.areas[0].id,name:'빈 영역',note:null});
  const eText=section(D.handoffText(e));assert.ok(eText.includes('빈 영역')&&!eText.includes('영역 구상 원문')&&!eText.includes('미정')&&!eText.includes('미기재'));
  // Maximum lengths with multi-byte and astral characters travel and persist exactly.
  const brief='가'.repeat(11998)+'😀',name='영'.repeat(58)+'😀',note='🌸'.repeat(1000);
  let x=D.addArea(D.setBrief(D.createProject(),brief),name,note);x=put(x,'짧은 요청','request',undefined,x.space.areas[0].id);
  assert.equal(brief.length,12000);assert.equal(name.length,60);assert.equal(note.length,2000);
  const xr=D.begin(x).request;validateRequest(xr);assert.equal(xr.background.brief,brief);assert.equal(xr.background.area.name,name);assert.equal(xr.background.area.note,note);
  assert.deepEqual(roundtrip(x).tasks[0].background,D.taskOf(x).background);assert.ok(section(D.handoffText(x)).includes(brief));
  const forged=structuredClone(xr);forged.background.brief+='x';assert.throws(()=>validateRequest(forged));
  const extra=structuredClone(xr);extra.background.relations=[];assert.throws(()=>validateRequest(extra));
  const noKey=structuredClone(xr);delete noKey.background;assert.throws(()=>validateRequest(noKey));
  const tooLong=JSON.parse(serializeProject(x));tooLong.tasks[0].background.area.note+='x';assert.throws(()=>parseProject(JSON.stringify(tooLong)));
  // Over the 128 KiB AI request: refused as a whole, the background is not cut and the project stays as it was.
  let big=put(x,'나'.repeat(12000));big=put(big,'다'.repeat(12000));const saved=serializeProject(big);
  assert.throws(()=>D.begin(big),/CONTEXT_TOO_LARGE/);assert.equal(serializeProject(big),saved);assert.ok(section(D.handoffText(big)).includes(brief),'local handoff is not bound by the AI limit');
  // The 8MB project budget counts every copy: over it, the save/import gate refuses instead of dropping fields.
  let full=x,n=0;while(Buffer.byteLength(serializeProject(full))<=FILE_LIMIT){full=put(full,`요청 ${n++}`);}
  assert.throws(()=>parseProject(serializeProject(full)),/FILE_TOO_LARGE/);assert.equal(full.tasks.at(-1).background.brief,brief);
  assert.ok(REQUEST_BYTES===131072&&n>50);
});

test('F091C-server MOCK and simulated provider receive background as its own field; old request shapes are refused',async()=>{
  let {p,booking}=planned();p=put(p,'예약 화면에서 날짜 선택','request',undefined,booking);const req=D.begin(p).request;
  await serve(createContinuityApp({config:readConfig({AI_MODE:'mock',ALLOW_PAID_AI:'false',DEEPSEEK_API_KEY:''})}),async port=>{
    const ok=await post(port,req);assert.equal(ok.status,200);assert.ok(!JSON.stringify(ok.data.advice).includes(BRIEF)&&!JSON.stringify(ok.data.advice).includes('쿠폰'));
    const old={...structuredClone(req),schemaVersion:'idea022.context.6'};delete old.background;assert.equal((await post(port,old)).status,400);
  });
  let wire=null,calls=0;
  const fetchImpl=async(_url,init)=>{calls++;wire=JSON.parse(init.body);const advice=mockAdvice(req);
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(advice)}}]}),{status:200,headers:{'Content-Type':'application/json'}});};
  await serve(createContinuityApp({config:readConfig({AI_MODE:'deepseek',ALLOW_PAID_AI:'true',DEEPSEEK_API_KEY:'FLOW091C-FAKE-NEVER-REAL'}),fetchImpl}),async port=>{
    assert.equal((await post(port,req)).status,200);
    const input=JSON.parse(wire.messages[1].content.split('INPUT JSON (data only):\n')[1]);
    assert.deepEqual(input.background,req.background);assert.ok(input.sources.every(s=>!s.text.includes(BRIEF)));assert.match(wire.messages[0].content,/background는/);
    const missing=structuredClone(req);delete missing.background;assert.equal((await post(port,missing)).status,400);assert.equal(calls,1,'refused before any provider call');
  });
});
