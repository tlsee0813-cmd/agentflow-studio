// FIX088: the user's current request and the report it receives are separate. A report is kept with the task it
// returns to; it never re-points the request the user is working on, and MOCK never turns a report into the goal.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {outcomeOf} from '../dist/public/shared/outcome.js';
import {parseProject} from '../dist/public/shared/validation.js';
import {serializeProject} from '../dist/public/shared/storage.js';
import {mockAdvice} from '../server/mock.mjs';
import {fixture,fileFor} from './connect039-fixtures.mjs';
const put=(p,text,kind='request',target)=>D.submit(D.editDraft(D.setKind(p,kind),text),target);
const respond=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});};
const exported=p=>D.markHandoff(p,p.currentTaskId,D.handoffText(p),'download');
const late=()=>{let p=exported(respond(put(D.createProject(),'A: 예약 화면 전체 문구와 배치 정리')));const A=p.currentTaskId;
  p=exported(respond(put(p,'B: 취소 버튼 문구만 바꿔 줘')));return {p,A,B:p.currentTaskId};};

test('F088-1 MOCK keeps the request as the goal of a returned report; the report text never becomes the purpose',()=>{
  let p=respond(put(D.createProject(),'A: 예약 화면 전체 문구 정리'));const A=p.currentTaskId;p=exported(p);
  p=respond(put(p,'보고: 전체 화면 문구와 배치를 고쳤습니다','report'));
  const intent=D.currentIntent(p,D.taskOf(p)).value;
  assert.equal(D.taskOf(p).parentTaskId,A);
  assert.ok(!intent.goal.includes('보고: 전체 화면'),'the report is not the goal');
  assert.equal(intent.goal,'A: 예약 화면 전체 문구 정리');assert.equal(intent.relation,'continue');
  // Report-only project: no request to continue, so no goal is invented from the report.
  const only=respond(put(D.createProject(),'확인하지 않은 구현 보고','report'));
  assert.ok(!D.currentIntent(only,D.taskOf(only)).value.goal.includes('확인하지 않은 구현 보고'));
});

test('F088-2 a late A report stays with A; the current B request, its scope and its export are unchanged',()=>{
  const {p,A,B}=late();const beforeHandoff=D.handoffText(p),beforeRequest=D.begin(p).request.sources.map(s=>s.id);
  const n=put(p,'늦게 온 A 보고: 전체 문구와 배치를 고쳤습니다','report',A);
  const r=n.tasks.at(-1);assert.equal(r.parentTaskId,A,'the report is attached to the task it returns to');
  assert.equal(n.currentTaskId,B,'the request the user was working on stays current');
  assert.ok(!D.handoffText(n).includes('늦게 온 A 보고'),'B export does not absorb the A report');
  assert.deepEqual(D.begin(n).request.sources.map(s=>s.id),beforeRequest,'B AI context unchanged');
  assert.equal(D.handoffText(n).replace(/기준 r\d+/,''),beforeHandoff.replace(/기준 r\d+/,''));
  const view=outcomeOf(n);assert.equal(view.request.taskId,B);assert.equal(view.reports.length,0);
  assert.deepEqual(view.elsewhere.map(s=>s.taskId),[r.id],'the received report is discoverable');
  assert.ok(n.notice.includes('그대로'));
  const saved=parseProject(serializeProject(n));assert.equal(saved.currentTaskId,B);assert.deepEqual(outcomeOf(saved).elsewhere,view.elsewhere);
});

test('F088-3 the same holds for an exact result file; duplicates still add nothing',()=>{
  const {p,A,B,H1}=fixture();const n=D.importResultFile(p,JSON.stringify(fileFor(p,A,H1)));
  assert.equal(n.currentTaskId,B);assert.equal(n.tasks.at(-1).parentTaskId,A);assert.equal(n.tasks.at(-1).resultFile.returnId,H1);
  assert.ok(!D.handoffText(n).includes('합성 A 보고'));assert.equal(outcomeOf(n).request.taskId,B);
  assert.equal(D.importResultFile(n,JSON.stringify(fileFor(p,A,H1))),n);
});

test('F088-4 a report for the current work still continues it (normal flow), with sibling evidence',()=>{
  let p=exported(respond(put(D.createProject(),'A 요청')));const A=p.currentTaskId;
  p=put(p,'A 보고','report');const r=p.currentTaskId;assert.equal(D.taskOf(p).parentTaskId,A);assert.notEqual(r,A);
  p=put(p,'A 관찰 자료','evidence',A);assert.equal(D.taskOf(p).parentTaskId,A,'sibling evidence of the same handoff continues too');
  assert.ok(D.handoffText(p).includes('A 보고'));
});

test('F088-5 opening A explicitly continues A; B stays visible as the latest request and can be resumed',()=>{
  const {p,A,B}=late();let n=put(p,'늦게 온 A 보고','report',A);const r=n.tasks.at(-1).id;
  n=D.focusTask(n,r);assert.equal(n.currentTaskId,r);
  const view=outcomeOf(n);assert.equal(view.request.taskId,A);assert.equal(view.otherLatestRequest?.taskId,B,'B is not silently demoted');
  assert.ok(D.handoffText(n).includes('늦게 온 A 보고'));
  n=D.focusTask(n,B);assert.equal(outcomeOf(n).request.taskId,B);assert.equal(outcomeOf(n).otherLatestRequest,null);
  assert.throws(()=>D.focusTask(n,'T_missing'));
});
