// SPATIAL102: '확인할 일' is computed from existing records only (never stored). It counts an open question and a
// returned report the user has not acted on yet; a report that was followed up is not counted again just because it exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {checkItems} from '../dist/public/shared/attention.js';
import {serializeProject} from '../dist/public/shared/storage.js';
import {mockAdvice} from '../server/mock.mjs';
const put=(p,text,kind='request',target,area)=>D.submit(D.editDraft(D.setKind(p,kind),text),target,area);
const respond=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});};
const exported=(p,id=p.currentTaskId)=>D.markHandoff(p,id,D.handoffText(p,id),'download');
const planned=()=>{let p=D.setBrief(D.createProject(),'공방 원데이 클래스 예약');p=D.addArea(p,'예약','');p=D.addArea(p,'알림','');
  const [booking,notify]=p.space.areas.map(a=>a.id);return {p,booking,notify};};
const CHOICE='빈자리가 나면 대기자에게 자동으로 예약을 이어 주세요';
const kinds=p=>checkItems(p).map(i=>`${i.kind}:${i.taskId}:${i.returnId??''}`);

test('S102-1 nothing to check without evidence: no tasks, a kept input, a prepared or exported request',()=>{
  let {p,booking}=planned();assert.deepEqual(checkItems(p),[]);
  p=put(p,'예약 화면 만들기',undefined,undefined,booking);assert.equal(D.taskStatus(p,D.taskOf(p)),'입력 보존됨');assert.deepEqual(checkItems(p),[]);
  p=respond(p);assert.deepEqual(checkItems(p),[]);p=exported(p);assert.equal(D.taskStatus(p,D.taskOf(p)),'작업문 내보냄 · 실행 여부 모름');
  assert.deepEqual(checkItems(p),[],'an exported request is not a check item: whether it ran is unknown');
});

test('S102-2 an open product choice waits for the user until answered, or until the user continues from that request',()=>{
  let {p,booking}=planned();p=respond(put(p,CHOICE,undefined,undefined,booking));const t=D.taskOf(p);
  assert.equal(D.taskStatus(p,t),'제품 선택 항목 있음');
  assert.deepEqual(checkItems(p),[{kind:'decision',taskId:t.id,returnId:null,areaId:booking,status:'제품 선택 항목 있음'}]);
  const answered=D.answer(p,t.id,'참여 확인 뒤 확정');assert.deepEqual(checkItems(answered),[],'answered');
  const moved=put(p,'대기 순서 화면만 먼저 만들기');assert.equal(D.taskStatus(moved,moved.tasks[0]),'제품 선택 항목 있음','the request keeps its own status');
  assert.deepEqual(checkItems(moved),[],'the user continued from that request: not listed as waiting');
});

test('S102-3 a returned report is listed until the user acts on it (a follow-up request or a follow-up handoff)',()=>{
  let {p,booking}=planned();p=exported(respond(put(p,'예약 화면 만들기',undefined,undefined,booking)));const t=p.tasks[0];
  p=put(p,'보고: 예약 화면을 만들었다고 주장','report');const r=p.tasks.at(-1);
  assert.deepEqual(checkItems(p),[{kind:'report',taskId:t.id,returnId:r.id,areaId:booking,status:'구현 보고 도착 · 앱 미검증'}]);
  const followed=put(p,'확인 대기 문구 고치기');assert.equal(followed.tasks.at(-1).parentTaskId,r.id);assert.deepEqual(checkItems(followed),[],'a request continued from the report');
  const handed=exported(respond(p),r.id);assert.deepEqual(checkItems(handed),[],'a follow-up handoff was exported from the report');
  // The task's own status text still says a report arrived; only the check list treats it as handled.
  assert.equal(D.taskStatus(followed,followed.tasks[0]),'구현 보고 도착 · 앱 미검증');
});

test('S102-4 only the latest return of a task counts; an older report is never counted again',()=>{
  let {p,booking}=planned();p=exported(respond(put(p,'예약 화면 만들기',undefined,undefined,booking)));const t=p.tasks[0];
  p=put(p,'보고 1: 일부만 만들었다고 주장','report');p=put(p,'자료: 화면 캡처 설명','evidence');const [r1,r2]=p.tasks.slice(1);
  assert.equal(r1.parentTaskId,t.id);assert.equal(r2.parentTaskId,t.id);
  assert.deepEqual(kinds(p),[`report:${t.id}:${r2.id}`]);assert.equal(checkItems(p)[0].status,'관찰·검사 자료 있음 · 앱 미검증');
  p=put(p,'남은 부분 이어서 만들기');assert.equal(p.tasks.at(-1).parentTaskId,r2.id);
  assert.deepEqual(checkItems(p),[],'acting on the latest report clears the task; the older untouched report is not listed again');
});

test('S102-5 a report returning to a follow-up handoff opens the original request; items keep their area; pure and unsaved',()=>{
  let {p,booking,notify}=planned();p=exported(respond(put(p,'예약 화면 만들기',undefined,undefined,booking)));const t=p.tasks[0];
  p=put(p,'보고: 만들었다고 주장','report');const r1=p.tasks.at(-1);p=exported(respond(p),r1.id);
  p=put(p,'보고: 후속 확인 결과','report');const r2=p.tasks.at(-1);assert.equal(r2.parentTaskId,r1.id);
  assert.deepEqual(kinds(p),[`report:${t.id}:${r2.id}`]);
  p=respond(put(p,CHOICE,undefined,undefined,notify));const q=p.tasks.at(-1);
  assert.deepEqual(checkItems(p).map(i=>[i.kind,i.areaId]),[['decision',notify],['report',booking]],'newest first, each with its area');
  const before=serializeProject(p);checkItems(p);assert.equal(serializeProject(p),before,'computing never changes the project');
  assert.deepEqual(Object.keys(JSON.parse(before)).sort(),Object.keys(JSON.parse(serializeProject(D.createProject()))).sort(),'no new stored field');
  assert.equal(q.areaId,notify);
});
