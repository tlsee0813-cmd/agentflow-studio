// FLOW095: in the full handoff text the current request's full text appears once (under '이번 요청과 이전 맥락'). A text that
// is exactly the same string elsewhere (goal echo, earlier identical request, its basis) keeps its entry, ID, label, revision
// and section with a pointer. Nothing else changes: different texts (even by one space), edits, corrections, reports and the
// background copy print as before; stored data and the AI request are untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {serializeProject} from '../dist/public/shared/storage.js';
import {mockAdvice} from '../server/mock.mjs';
const respond=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});};
const send=(p,text,kind='request',area)=>respond(D.submit(D.editDraft(D.setKind(p,kind),text),undefined,area));
const exported=p=>D.markHandoff(p,p.currentTaskId,D.handoffText(p),'download');
const count=(h,text)=>h.split(text).length-1;
const section=(h,name)=>{const i=h.indexOf(name);if(i<0)return '';const j=h.indexOf('\n## ',i+3);return h.slice(i,j<0?undefined:j);};
const POINTER='글자 그대로 같은 본문 생략';
const REQ='지도 다중선택·그룹 처리 방식을 검토해 주세요. 코드·실행·배포 변경 없이 선택조건과 보류이유만 제안해 주세요.';
const NOTE='후보1 xyflow 지도부분 도입 · 후보2 현 제한 조작 유지 · 구현/설치/배포 금지';

test('F095-1 the same request sent twice (REUSE093 shape): one full copy, every entry keeps its ID, role and order',()=>{
  let p=D.addArea(D.setBrief(D.createProject(),'재사용 판단 실험'),'A',NOTE);const area=p.space.areas[0].id;
  p=exported(send(p,REQ,'request',area));p=send(p,REQ,'request',area);
  const before=serializeProject(p),h=D.handoffText(p),[s1,s2]=p.sources,[d1,d2]=p.bases;
  assert.equal(count(h,REQ),1,'the request text appears once');assert.equal(count(h,NOTE),1,'the background copy is untouched');
  const now=section(h,'## 이번 요청과 이전 맥락');assert.ok(now.includes(`이번 요청 원문 [${s2.id}]`)&&now.includes(`\n${REQ}\n`));
  const inputs=section(h,'## 관련 입력');assert.ok(inputs.indexOf(`[${s1.id}] 사용자 요청 원문`)<inputs.indexOf(`[${s2.id}] 사용자 요청 원문`),'both sources, in order');
  assert.ok(inputs.includes(`[${s2.id}] 사용자 요청 원문\n(본문은 위 ‘이번 요청과 이전 맥락’`));
  assert.match(section(h,'## 이어갈 기준'),new RegExp(`\\[${d2.id}\\] 요청 원문 · 해석 미확정 / r\\d+ / ${s2.id}\\n\\(${POINTER}`));
  assert.match(section(h,'## 이전 요청 원문 참조'),new RegExp(`\\[${d1.id}\\] 요청 원문 · 해석 미확정 / r\\d+ / ${s1.id}\\n\\(${POINTER}`),'the earlier one stays a past reference');
  assert.ok(section(h,'## 이어가는 목적').includes(POINTER),'the MOCK goal echo points back');
  assert.equal(serializeProject(p),before,'rendering stores nothing');
  const req=D.begin(p).request;assert.equal(req.sources.filter(s=>s.text===REQ).length,2,'the AI request keeps every source in full');
});

test('F095-2 no normalisation: a different space or line break is a different text and prints in full',()=>{
  for(const other of [REQ+' ',REQ.replace('검토해 주세요. ','검토해 주세요.\n')]) {
    let p=exported(send(D.createProject(),other));p=send(p,REQ);const h=D.handoffText(p);
    assert.equal(count(h,`\n${other}\n`),2,'its source and basis keep their own full text');assert.equal(count(h,`\n${REQ}\n`),1);
  }
});

test('F095-3 edits, corrections, reports and decisions are never folded into the request',()=>{
  // An explicitly replaced basis, a confirmed decision and a manual work value differ from the request: all print in full.
  let p=D.recordBasis(send(D.createProject(),'탈퇴 유예 기간을 정리해 주세요.'),'탈퇴 유예는 30일','confirmed');const d=p.bases.at(-1).id;
  p=send(p,`${d}을 60일로 변경해줘`);p=D.editTask(p,p.currentTaskId,'next','유예 기간 상수만 고치세요.');
  let h=D.handoffText(p);assert.ok(h.includes('탈퇴 유예는 60일')&&h.includes('유예 기간 상수만 고치세요.')&&h.includes('탈퇴 유예 기간을 정리해 주세요.'));
  // A purpose correction differs from the request and prints in full; the request itself still appears once.
  p=D.correctIntent(p,p.currentTaskId,'유예 기간만 60일로 바꾼다','다른 정책 유지');h=D.handoffText(p);
  assert.ok(section(h,'## 이어가는 목적').includes('유예 기간만 60일로 바꾼다'));assert.equal(count(h,`${d}을 60일로 변경해줘`),1);
  // A report returning to the request is its own text; the request it returns to is shown once.
  let r=exported(send(D.createProject(),REQ));r=send(r,'보고: 선택조건 표를 정리했다고 주장. 실제 확인 없음.','report');h=D.handoffText(r);
  assert.equal(count(h,'보고: 선택조건 표를 정리했다고 주장. 실제 확인 없음.'),1);assert.equal(count(h,REQ),1);
  assert.ok(section(h,'## 이번 요청과 이전 맥락').includes(`\n${REQ}\n`),'the request a report returns to is the one shown in full');
});
