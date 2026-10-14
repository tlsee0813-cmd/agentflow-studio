// FLOW094: the MOCK preview keeps the action the request asked for. A review/research/design request, or one that forbids
// changing or running things, never gets code edits, command runs, reproduction or deployment added to its final work text.
// A mentioned incident or code path is a topic; real implementation and real reproduction requests keep their work.
// Checks read the final handoff text (the same text the Markdown/clipboard export writes), not the rule strings.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {stageOf} from '../dist/public/client/presentation.js';
import {mockAdvice} from '../server/mock.mjs';
const respond=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});};
const send=(p,text,kind='request',area)=>respond(D.submit(D.editDraft(D.setKind(p,kind),text),undefined,area));
/** The generated work part of the final text: understanding, scope, next, checks and any open question. */
const work=p=>{const t=D.handoffText(p);return t.slice(t.indexOf('\n## 이번 작업'),t.indexOf('\n## 관련 입력'));};
const ADDS={edit:/위치를 찾고[^.]*수정하세요|수정하세요/,run:/검사를 실행/,repro:/재현하고|재현하세요/,ask:/기대한 결과와 실제로 보인 결과/,deploy:/배포하세요/};
const added=text=>Object.entries(ADDS).filter(([,re])=>re.test(text)).map(([k])=>k);
// REUSE093-P, as typed into the app (fd82e964): a design review that forbids changes, and a split-of-work design.
const A='AgentFlow 공간지도의 향후 다중선택·그룹을 어떻게 다룰지 검토해 주세요. 이 요청에 붙은 현재 영역 구상 사본을 근거로, 지도부분 xyflow 도입과 현 제한 조작 유지의 선택조건·보류이유·다음에 확인할 것만 짧게 제안해 주세요. 이미 조사한 범위를 반복 조사하지 말고, 모르는 값은 미확인으로 두세요. 이번은 설계 검토이며 코드·설치·실행·저장소·배포 변경 없이 반환하세요. 채택·통합 완료를 선언하지 마세요.';
const B='AgentFlow 라이브러리 후보 정보확인의 분담을 검토해 주세요. 현재 영역 구상 사본을 근거로, 기존 조회에 맡길 항목과 AgentFlow가 보존할 프로젝트별 선택이유·통합결과를 나누고, 누락·오류·미확인을 어떻게 기록할지만 제안해 주세요. 이번은 문서 기반 설계 검토이며 추가 API 호출·설치·코드·DB·검색기·카탈로그·화면·저장소·배포 변경 없이 반환하세요. 정상응답·안전·채택·통합 완료를 선언하지 마세요.';

test('F094-1 REUSE093 A/B: review requests keep their scope; originals, background copy and sources are untouched',()=>{
  for(const [text,note] of [[A,'후보1 xyflow 지도부분 도입 · 후보2 현 제한 조작 유지 · 구현/설치/배포 금지'],[B,'deps.dev v3 조회 후보 · 새 DB/검색기/연동 금지']]) {
    let p=D.addArea(D.setBrief(D.createProject(),'재사용 판단 실험'),'영역',note);p=send(p,text,'request',p.space.areas[0].id);
    const t=D.taskOf(p),w=work(p);
    assert.deepEqual(added(w),[],w);assert.equal(t.advice.question,null,'no forced fact question');
    assert.match(w,/요청 원문이 요구한 항목만/);assert.notEqual(stageOf(p,t).kind,'question');assert.notEqual(stageOf(p,t).kind,'exported','prepared, not reported as done');
    assert.equal(p.sources[0].text,text);assert.equal(p.bases[0].text,text);assert.equal(t.background.area.note,note);
    assert.ok(D.handoffText(p).includes(text),'the request itself still goes out verbatim');
  }
});

test('F094-2 other phrasings of review-only, prohibitions and a quoted incident do not widen the work',()=>{
  for(const text of [
    '알림 흐름의 설계안 두 가지를 비교해서 장단점만 정리해 주세요.',
    '예약 화면 구조를 살펴보되 코드는 고치지 말고 문제점만 알려 주세요.',
    '지난주 "결제 실패" 오류 공지를 근거로 알림 문구 정책을 검토만 해 주세요.',
    '결제 오류 처리 방식에 대한 설계 메모를 작성해 주세요. 구현/배포 금지.',
  ]) {const p=send(D.createProject(),text),w=work(p);assert.deepEqual(added(w),[],`${text}\n${w}`);assert.equal(D.taskOf(p).advice.question,null,text);}
});

test('F094-3 ordinary implementation requests and real problem reports keep their existing work',()=>{
  for(const text of ['예약 화면에 날짜 선택 칸을 만들어줘','검토해 보고 날짜 형식이 틀리면 고쳐줘','알림 문구는 수정하고 배포는 하지 마세요.']) {
    const w=work(send(D.createProject(),text));assert.ok(added(w).includes('edit'),`${text}\n${w}`);
  }
  const bug=send(D.createProject(),'결제가 실패하는 오류가 있어요. 원인은 아직 모르겠어요.'),bw=work(bug);
  assert.ok(added(bw).includes('repro')&&added(bw).includes('ask'),bw);assert.equal(D.taskOf(bug).advice.question.kind,'fact');
  // A requested reproduction with a change ban: reproduce and compare, but no code change and no 'is the change visible' check.
  const inv=work(send(D.createProject(),'결제 실패 원인을 재현해서 조사해 주세요. 코드는 수정하지 말고요.'));
  assert.ok(added(inv).includes('repro'),inv);assert.ok(!/요청한 변화가 보이는지|위치를 찾고/.test(inv),inv);assert.match(inv,/코드 수정·자동 복구·삭제·결제는 실행하지 마세요/);
});

test('F094-4 a report returning to a review-only request is sorted against it, not turned into fixes or test runs',()=>{
  let p=send(D.createProject(),A);p=D.markHandoff(p,p.currentTaskId,D.handoffText(p),'download');
  p=send(p,'보고: 선택조건 표를 정리했다고 주장. 코드는 보지 않았음.','report');
  const w=work(p);assert.ok(!/필요한 수정 또는 검사를 진행/.test(w)&&added(w).length===0,w);assert.match(w,/확인된 것과 미확인을 나눠/);
  let q=send(D.createProject(),'예약 화면에 날짜 선택 칸을 만들어줘');q=D.markHandoff(q,q.currentTaskId,D.handoffText(q),'download');q=send(q,'보고: 만들었다고 주장','report');
  assert.match(work(q),/필요한 수정 또는 검사를 진행/,'an implementation return keeps its follow-up');
});
