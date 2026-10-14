// FIX058: purpose correction is stored apart from task work fields; AI interpretation cannot retire user decisions.
// Hand-authored semantic responses only. This checks wiring, not real-model interpretation quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {validateAdvice,parseProject,validateRequest} from '../dist/public/shared/validation.js';
import {serializeProject} from '../dist/public/shared/storage.js';
import {fixtureAdvice} from './ai055-fixtures.mjs';
import {cases} from './ai055-cases.mjs';
const put=(p,text)=>D.submit(D.editDraft(D.setKind(p,'request'),text));
const reply=(p,edit=a=>a,mode='deepseek')=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode,ticket:s.request.ticket,advice:edit(fixtureAdvice(s.request),s.request)});};
const section=(h,name)=>{const i=h.indexOf(name);if(i<0)return '';const j=h.indexOf('\n## ',i+3);return h.slice(i,j<0?undefined:j);};
// FLOW095: the current request's full text is shown once, in '이번 요청과 이전 맥락'; an exact copy elsewhere keeps its entry
// (ID/label/section) with a pointer to it. A section 'shows' a text when it holds it in full or holds such a pointer to it.
const shows=(h,name,text)=>{const s=section(h,name),req=section(h,'## 이번 요청과 이전 맥락');
  return s.includes(text)||req.includes(`\n${text}\n`)&&/글자 그대로 같은 본문 생략|본문은 위 ‘이번 요청과 이전 맥락’/.test(s);};
const [first,change,button,typo]=cases[0].turns;
const AI_GOAL='문자로 받은 링크로 가입 없이 예약을 취소한다.';
function threeTurns() {let p=D.createProject();for(const text of [first,change,button])p=reply(put(p,text));return p;}

test('F058-B1 editing this task\'s understanding/scope stays a work instruction; it never becomes the next turn\'s purpose',()=>{
  let p=threeTurns();const t=p.currentTaskId;
  p=D.editTask(p,t,'understanding','이번 작업은 CSS 한 줄만 바꾼다');p=D.editTask(p,t,'scope','버튼 스타일 파일만');
  const intent=D.currentIntent(p,D.taskOf(p,t));
  assert.equal(intent.manualGoal,null);assert.equal(intent.manualConditions,null);assert.equal(intent.value.goal,AI_GOAL);
  const h=D.handoffText(p,t),purpose=section(h,'## 이어가는 목적'),work=section(h,'## 이번 작업');
  assert.match(purpose,/AI 해석 \/ 원문과 구분/);assert.ok(purpose.includes(AI_GOAL));assert.ok(!purpose.includes('CSS 한 줄'));
  assert.ok(work.includes('이번 작업은 CSS 한 줄만 바꾼다'));assert.ok(work.includes('버튼 스타일 파일만'));
  const restored=parseProject(serializeProject(p));assert.deepEqual(restored,p);
  const next=D.begin(put(restored,typo)).request;validateRequest(next);
  assert.equal(next.previousIntent.taskId,t);assert.equal(next.previousIntent.manualGoal,null);assert.equal(next.previousIntent.manualConditions,null);
  assert.equal(next.previousIntent.value.goal,AI_GOAL);
});

test('F058-B2 purpose correction on a small task keeps that task narrow; stale AI action/question excluded; next turn carries the correction',()=>{
  let p=threeTurns();const t=p.currentTaskId;
  p=D.editTask(p,t,'scope','버튼 스타일 파일만');D.taskOf(p,t).advice.question={kind:'fact',text:'합성 과거 질문',why:'보호 경계 fixture',options:[]};
  const manualBefore=structuredClone(D.taskOf(p,t).manual),bases=structuredClone(p.bases),sources=structuredClone(p.sources);
  p=D.correctIntent(p,t,'문자 링크로 예약 취소, 링크는 24시간 유효','환불 제외(이번)');
  assert.deepEqual(D.taskOf(p,t).manual,manualBefore);assert.deepEqual(p.bases,bases);assert.deepEqual(p.sources,sources);
  assert.deepEqual(D.intentCorrection(D.taskOf(p,t)),{goal:'문자 링크로 예약 취소, 링크는 24시간 유효',conditions:'환불 제외(이번)'});
  assert.equal(D.questionApplicability(p,D.taskOf(p,t)),'stale');assert.throws(()=>D.answer(p,t,'옛 질문 답'),/QUESTION_NOT_APPLICABLE/);
  const h=D.handoffText(p,t),work=section(h,'## 이번 작업'),purpose=section(h,'## 이어가는 목적');
  assert.ok(!work.includes('24시간 유효'),'purpose must not replace this task\'s work');assert.ok(!work.includes('환불 제외(이번)'));
  assert.ok(work.includes('버튼 스타일 파일만'),'user-written narrow scope survives');assert.ok(!work.includes('취소 버튼 색만 빨간색으로 수정'),'stale AI next is withheld');
  assert.ok(shows(h,'## 관련 입력',button));
  assert.match(purpose,/사용자 직접 정정/);assert.ok(purpose.includes('24시간 유효'));assert.ok(!purpose.includes('대체된 지시'));
  assert.match(purpose,/정정 전 AI 해석 근거/);
  const restored=parseProject(serializeProject(p));assert.deepEqual(restored,p);
  const next=D.begin(put(restored,typo)).request;validateRequest(next);
  assert.equal(next.previousIntent.manualGoal,'문자 링크로 예약 취소, 링크는 24시간 유효');assert.equal(next.previousIntent.manualConditions,'환불 제외(이번)');
});

test('F058-B2 a correction stays visible after the AI interpretation goes stale; regeneration cannot overwrite it',()=>{
  let p=threeTurns();const t=p.currentTaskId;
  p=D.correctIntent(p,t,'문자 링크로 예약 취소','환불 제외');
  p=D.recordBasis(p,'링크는 SMS로만 보낸다','confirmed',null);
  assert.equal(D.currentIntent(p,D.taskOf(p,t)),null,'AI interpretation itself is stale');
  const purpose=section(D.handoffText(p,t),'## 이어가는 목적');
  assert.match(purpose,/사용자 직접 정정/);assert.ok(purpose.includes('문자 링크로 예약 취소'));assert.ok(!purpose.includes('해석 근거'));
  const regen=D.begin(p).request;validateRequest(regen);assert.equal(regen.previousIntent.manualGoal,'문자 링크로 예약 취소');assert.equal(regen.previousIntent.manualConditions,'환불 제외');
  p=reply(p);assert.equal(D.currentIntent(p,D.taskOf(p,t)).manualGoal,'문자 링크로 예약 취소');assert.equal(D.taskOf(p,t).manual.understanding,null);
});

test('F058-N1 AI retired wording cannot cancel a confirmed decision; precedence is consistent and requests-only flows are unchanged',()=>{
  let p=D.createProject();p=put(p,'포장 주문 10% 할인');p=D.recordBasis(p,'포장 주문은 10% 할인','confirmed',null);
  p=put(p,'할인은 현금결제만 해줘.');
  p=reply(p,a=>({...a,intent:{...a.intent,relation:'revise',goal:'현금결제 할인',conditions:['현금결제만 10%'],retired:['포장 주문 할인']}}));
  const confirmed=p.bases.find(b=>b.status==='confirmed'),h=D.handoffText(p),purpose=section(h,'## 이어가는 목적');
  assert.match(purpose,/대체된 지시 · 다시 실행하지 않음 \(AI 해석 · 이전 요청 원문의 표현에만 적용, 사용자 결정 기준은 대체하지 않음\): 포장 주문 할인/);
  assert.ok(purpose.includes(`사용자 결정 기준 ${confirmed.id}(사용자 확정)은 이 AI 해석보다 우선`));
  assert.ok(section(h,'## 나머지 보존 기준').includes('포장 주문은 10% 할인')||section(h,'## 이어갈 기준').includes('포장 주문은 10% 할인'));
  assert.equal(confirmed.text,'포장 주문은 10% 할인');
  let q=D.createProject();for(const text of [first,change,button])q=reply(put(q,text));
  const plain=section(D.handoffText(q),'## 이어가는 목적');assert.ok(!/사용자 결정 기준 D\d/.test(plain),'no decision line without user decisions');assert.match(plain,/대체된 지시 · 다시 실행하지 않음/);
});

test('F058-N2 new responses reject separate+retired and the same sentence kept and retired; stored advice still loads',()=>{
  const p=put(D.createProject(),first),s=D.begin(p),good=fixtureAdvice(s.request);
  validateAdvice(good,s.request.bases.map(b=>b.id),s.request);
  const separate=structuredClone(good);separate.intent={...separate.intent,relation:'separate',retired:['가입 필수']};
  const both=structuredClone(good);both.intent={...both.intent,conditions:['환불 제외 '],retired:[' 환불 제외']};
  for(const bad of [separate,both]) {
    assert.throws(()=>validateAdvice(bad,s.request.bases.map(b=>b.id),s.request));
    const n=D.receive(s.project,s.request,{mode:'deepseek',ticket:s.request.ticket,advice:bad});assert.equal(D.taskOf(n).advice,null);
  }
  const stored=reply(p);D.taskOf(stored).advice.intent={...D.taskOf(stored).advice.intent,relation:'separate',retired:['가입 필수']};
  assert.deepEqual(parseProject(serializeProject(stored)),stored);
});

test('F058-N5 explicit MOCK handoff is not labelled as an AI interpretation',()=>{
  const p=reply(put(D.createProject(),first),a=>a,'mock'),purpose=section(D.handoffText(p),'## 이어가는 목적');
  assert.match(purpose,/MOCK 정리 \/ 의미 이해 아님/);assert.ok(!purpose.includes('AI 해석'));
});

test('F058 intent-edit.1 from the earlier candidate stays readable with its original meaning',()=>{
  let p=threeTurns();const t=p.currentTaskId;
  const legacy=JSON.parse(serializeProject(p)),task=legacy.tasks.find(x=>x.id===t);
  task.manual.understanding='옛 후보의 정정 목적';task.manual.scope='옛 후보의 조건';task.intentEdit={version:'intent-edit.1',revision:legacy.revision};
  const loaded=parseProject(JSON.stringify(legacy));
  assert.deepEqual(D.intentCorrection(D.taskOf(loaded,t)),{goal:'옛 후보의 정정 목적',conditions:'옛 후보의 조건'});
  const bad=structuredClone(legacy);bad.tasks.find(x=>x.id===t).intentEdit={version:'intent-edit.2',revision:legacy.revision};
  assert.throws(()=>parseProject(JSON.stringify(bad)));
});

test('F059 first task: correction plus a new confirmed basis both reach the next request without a made-up AI intent',()=>{
  let p=reply(put(D.createProject(),first));const t=p.currentTaskId;
  p=D.correctIntent(p,t,'문자 링크로 예약 취소','환불 제외');p=D.recordBasis(p,'링크는 SMS로만 보낸다','confirmed',null);
  assert.equal(D.currentIntent(p,D.taskOf(p,t)),null,'the AI interpretation is stale and withdrawn');
  const r=D.begin(p).request;validateRequest(r);
  assert.deepEqual(r.previousIntent,{taskId:t,value:null,manualGoal:'문자 링크로 예약 취소',manualConditions:'환불 제외'});
  assert.ok(r.bases.some(b=>b.text==='링크는 SMS로만 보낸다'&&b.status==='confirmed'));
  const noCorrection=structuredClone(r);noCorrection.previousIntent.manualGoal=null;assert.throws(()=>validateRequest(noCorrection),'value=null needs a user correction');
  p=reply(p);assert.equal(D.currentIntent(p,D.taskOf(p,t)).manualGoal,'문자 링크로 예약 취소');assert.equal(D.taskOf(p,t).manual.understanding,null);
});

test('F059 intent-edit.1 restore -> ordinary work edit leaves the converted correction, handoff and next request unchanged',()=>{
  let p=threeTurns();const t=p.currentTaskId;
  const raw=JSON.parse(serializeProject(p)),task=raw.tasks.find(x=>x.id===t);
  task.manual.understanding='옛 정정: 문자 링크로 취소';task.manual.scope='환불 제외';task.intentEdit={version:'intent-edit.1',revision:raw.revision};
  let loaded=parseProject(JSON.stringify(raw));
  assert.deepEqual(D.taskOf(loaded,t).intentEdit,{version:'intent-edit.2',revision:raw.revision,goal:'옛 정정: 문자 링크로 취소',conditions:'환불 제외'});
  assert.equal(D.taskOf(loaded,t).manual.understanding,'옛 정정: 문자 링크로 취소','legacy work text is kept as written');
  loaded=D.editTask(loaded,t,'understanding','이번 작업은 CSS 한 줄만');loaded=D.editTask(loaded,t,'scope','버튼 스타일 파일만');
  assert.deepEqual(D.intentCorrection(D.taskOf(loaded,t)),{goal:'옛 정정: 문자 링크로 취소',conditions:'환불 제외'});
  const h=D.handoffText(loaded,t);assert.ok(section(h,'## 이어가는 목적').includes('옛 정정: 문자 링크로 취소'));assert.ok(!section(h,'## 이어가는 목적').includes('CSS 한 줄'));
  assert.ok(section(h,'## 이번 작업').includes('이번 작업은 CSS 한 줄만'));
  const next=D.begin(put(parseProject(serializeProject(loaded)),typo)).request;validateRequest(next);
  assert.equal(next.previousIntent.manualGoal,'옛 정정: 문자 링크로 취소');assert.equal(next.previousIntent.manualConditions,'환불 제외');
  const empty=structuredClone(raw);empty.tasks.find(x=>x.id===t).manual.understanding=null;
  const kept=D.taskOf(parseProject(JSON.stringify(empty)),t);
  assert.deepEqual(kept.intentEdit,{version:'intent-edit.2',revision:raw.revision,goal:null,conditions:null},'no goal is invented; the stale revision is kept');assert.equal(D.intentCorrection(kept),null);
});

test('F061 legacy intent-edit.1 without a non-blank goal keeps withholding old AI text, is never a purpose, and round-trips',()=>{
  let p=D.createProject();p=put(p,first);
  {const st=D.begin(p),a=fixtureAdvice(st.request);a.next='OLD_AI_NEXT';a.checks='OLD_AI_CHECKS';a.question={kind:'fact',text:'OLD_Q',why:'w',options:[]};
   p=D.receive(st.project,st.request,{mode:'deepseek',ticket:st.request.ticket,advice:a});}
  const t=p.currentTaskId,base=JSON.parse(serializeProject(p));
  for(const [understanding,scope] of [['',null],[' ',null],[null,'환불 제외'],['\t','환불 제외']]) {
    const raw=structuredClone(base),task=raw.tasks.find(x=>x.id===t);raw.revision+=1;
    task.manual.understanding=understanding;task.manual.scope=scope;task.intentEdit={version:'intent-edit.1',revision:raw.revision};
    let loaded=parseProject(JSON.stringify(raw));const once=serializeProject(loaded);
    assert.equal(serializeProject(parseProject(once)),once,'restore -> save -> restore is stable');
    const lt=D.taskOf(loaded,t);assert.deepEqual(lt.intentEdit,{version:'intent-edit.2',revision:raw.revision,goal:null,conditions:null});assert.deepEqual(lt.manual,task.manual,'manual input kept as written');
    const w=D.currentWork(loaded,lt);assert.equal(w.aiStale,true);assert.equal(w.values.next,'');assert.equal(w.values.checks,'');
    assert.equal(D.questionApplicability(loaded,lt),'stale');assert.throws(()=>D.answer(loaded,t,'옛 질문 답'),/QUESTION_NOT_APPLICABLE/);
    let h=D.handoffText(loaded,t);assert.ok(!h.includes('OLD_AI_NEXT')&&!h.includes('OLD_AI_CHECKS'));assert.ok(!h.includes('사용자 직접 정정'));
    if(scope)assert.ok(section(h,'## 이번 작업').includes(scope),'a legacy work-field value stays in this task');
    loaded=D.editTask(loaded,t,'understanding','이번 작업은 CSS 한 줄만');
    assert.equal(D.intentCorrection(D.taskOf(loaded,t)),null,'an ordinary work edit is not promoted to a purpose');
    h=D.handoffText(loaded,t);assert.ok(!h.includes('사용자 직접 정정'));assert.ok(!h.includes('OLD_AI_NEXT'));
    const next=D.begin(put(parseProject(serializeProject(loaded)),typo)).request;validateRequest(next);
    assert.ok(next.previousIntent===null||next.previousIntent.manualGoal===null,'re-parse after a work edit must not read manual.* as a purpose');
    const bad=structuredClone(raw);bad.tasks.find(x=>x.id===t).intentEdit={version:'intent-edit.2',revision:raw.revision,goal:null,conditions:'x'};assert.throws(()=>parseProject(JSON.stringify(bad)));
  }
});
