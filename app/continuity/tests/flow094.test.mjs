// FLOW094(-R1): the MOCK preview follows the request's own words. It adds no code edit, command run, reproduction, test run or
// deployment and does not assume an incident; it also takes nothing away: explicit implementation/reproduction asks and
// partial bans stay in the original text the executor reads. Checks read the final handoff text (what Markdown/clipboard
// export writes) and the question/stage, not the rule strings.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {stageOf} from '../dist/public/client/presentation.js';
import {mockAdvice} from '../server/mock.mjs';
const respond=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});};
const send=(p,text,kind='request',area)=>respond(D.submit(D.editDraft(D.setKind(p,kind),text),undefined,area));
/** The generated work part of the final text: understanding, scope, next, checks and any open question. */
const work=p=>{const t=D.handoffText(p);return t.slice(t.indexOf('\n## 이번 작업'),t.indexOf('\n## 관련 입력'));};
// Actions the preview must never add on its own (imperatives, not the words themselves).
const ADDED={edit:/위치를 찾고|수정하세요|고치세요/,run:/검사를 실행해|테스트를 실행/,repro:/현상을 재현|재현하고|재현하세요/,deploy:/배포하세요/,incident:/기대한 결과와 실제로 보인 결과/};
// Wording that would cancel what a request explicitly asks for.
const CANCELS=/수정하지 마세요|구현하지 마세요|재현하지 마세요|변경하지 마세요|아무것도 바꾸지/;
const added=text=>Object.entries(ADDED).filter(([,re])=>re.test(text)).map(([k])=>k);
// REUSE093-P, as typed into the app (fd82e964): a design review that forbids changes, and a split-of-work design.
const A='AgentFlow 공간지도의 향후 다중선택·그룹을 어떻게 다룰지 검토해 주세요. 이 요청에 붙은 현재 영역 구상 사본을 근거로, 지도부분 xyflow 도입과 현 제한 조작 유지의 선택조건·보류이유·다음에 확인할 것만 짧게 제안해 주세요. 이미 조사한 범위를 반복 조사하지 말고, 모르는 값은 미확인으로 두세요. 이번은 설계 검토이며 코드·설치·실행·저장소·배포 변경 없이 반환하세요. 채택·통합 완료를 선언하지 마세요.';
const B='AgentFlow 라이브러리 후보 정보확인의 분담을 검토해 주세요. 현재 영역 구상 사본을 근거로, 기존 조회에 맡길 항목과 AgentFlow가 보존할 프로젝트별 선택이유·통합결과를 나누고, 누락·오류·미확인을 어떻게 기록할지만 제안해 주세요. 이번은 문서 기반 설계 검토이며 추가 API 호출·설치·코드·DB·검색기·카탈로그·화면·저장소·배포 변경 없이 반환하세요. 정상응답·안전·채택·통합 완료를 선언하지 마세요.';
// Sol's counterexamples on e2881939 and the batch's additional ones.
const COUNTER=['결제 실패 원인을 조사해 주세요. 재현하지 마세요. 문서만 읽으세요.','코드 변경 없이 "수정 버튼"의 역할만 설명해 주세요.',
  '예약 페이지 구성은 어떤가요?','“결제 실패” 안내 화면을 만들어 주세요. 실제 결제는 실행하지 마세요.'];

test('F094-1 REUSE093 A/B and the four counterexamples: nothing added, no assumed incident, request and copies untouched',()=>{
  for(const [text,note] of [[A,'후보1 xyflow 지도부분 도입 · 구현/설치/배포 금지'],[B,'deps.dev v3 조회 후보 · 새 DB 금지'],...COUNTER.map(c=>[c,'구상 메모'])]) {
    let p=D.addArea(D.setBrief(D.createProject(),'재사용 판단 실험'),'영역',note);p=send(p,text,'request',p.space.areas[0].id);
    const t=D.taskOf(p),w=work(p);
    assert.deepEqual(added(w),[],`${text}\n${w}`);assert.equal(t.advice.question,null,text);assert.ok(!CANCELS.test(w),w);
    assert.equal(stageOf(p,t).kind,'ready','prepared, not asking and not reported as done');assert.equal(t.advice.intent.goal,text,'goal is the request itself');
    assert.equal(p.sources[0].text,text);assert.equal(p.bases[0].text,text);assert.equal(t.background.area.note,note);
    assert.ok(D.handoffText(p).includes(text),'the request goes out verbatim');
  }
});

test('F094-2 explicit implementation, explicit reproduction and a partial ban are not cancelled or widened',()=>{
  for(const text of ['예약 화면에 날짜 선택 칸을 만들어줘','결제 실패를 재현해서 원인을 찾아 주세요.','알림 문구는 수정하고 배포는 하지 마세요.']) {
    const p=send(D.createProject(),text),w=work(p);
    assert.ok(!CANCELS.test(w),`${text}\n${w}`);assert.match(w,/요청 원문이 요청한 행동만 하세요/);assert.deepEqual(added(w),[],w);
    assert.ok(D.handoffText(p).includes(`\n${text}`),'the explicit ask stays readable in the original');assert.equal(D.taskOf(p).advice.question,null);
  }
});

test('F094-3 a stated unknown cause still gets the fact question (question features); no reproduction is added',()=>{
  const p=send(D.createProject(),'결제가 실패하는 오류가 있어요. 원인은 아직 모르겠어요.'),w=work(p);
  assert.equal(D.taskOf(p).advice.question.kind,'fact');assert.equal(stageOf(p,D.taskOf(p)).kind,'question');
  assert.ok(!/현상을 재현|재현하고|재현하세요|위치를 찾고|검사를 실행해/.test(w),w);
  // A manual work value keeps priority over a re-run preview.
  let q=D.editTask(p,p.currentTaskId,'next','결제 로그만 읽고 보고하세요.');q=respond(q);assert.match(work(q),/결제 로그만 읽고 보고하세요\./);
});

test('F094-4 a returned report is compared and sorted; no fixes or test runs are added',()=>{
  for(const ask of [A,'예약 화면에 날짜 선택 칸을 만들어줘']) {
    let p=send(D.createProject(),ask);p=D.markHandoff(p,p.currentTaskId,D.handoffText(p),'download');
    p=send(p,'보고: 정리했다고 주장. 실제 확인 없음.','report');const w=work(p);
    assert.ok(!/필요한 수정 또는 검사를 진행/.test(w)&&added(w).length===0&&!CANCELS.test(w),w);assert.match(w,/아직 확인하지 못한 동작을 분리해 정리하세요/);
  }
});
