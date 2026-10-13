// FIX066: input/handoff structure behind the AI060 real-model observations (docs/evidence/AI060-semantic-failures.md @ c417c2a).
// Responses below are hand-authored in the SHAPE of those observations. They check what the app sends and prints,
// not what a real model will answer; no assertion fixes "membership removed" as the right meaning.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {validateRequest} from '../dist/public/shared/validation.js';
import {SYSTEM_PROMPT} from '../server/prompt.mjs';
import {mockAdvice} from '../dist/public/shared/mock.js';
const put=(p,text)=>D.submit(D.editDraft(D.setKind(p,'request'),text));
const section=(h,name)=>{const i=h.indexOf(name);if(i<0)return '';const j=h.indexOf('\n## ',i+3);return h.slice(i,j<0?undefined:j);};
function reply(p,intent,extraRefs=[]) {
  const s=D.begin(p);validateRequest(s.request);
  const ids=new Set([...s.request.bases.filter(b=>s.request.appFacts.inputs.some(i=>i.sourceId===b.sourceId)).map(b=>b.id),...extraRefs]);
  const basisRefs=s.request.bases.filter(b=>ids.has(b.id)).map(b=>({basisId:b.id,sourceId:b.sourceId,revision:b.revision}));
  return {project:D.receive(s.project,s.request,{mode:'deepseek',ticket:s.request.ticket,advice:{understanding:'u',scope:'s',next:'n',checks:'c',
    question:null,relatedBasisIds:[],reviewBasisIds:[],suggestions:[],intent:{version:'intent.1',conditions:[],retired:[],...intent,basisRefs}}}),request:s.request};
}
const P1=['가입한 고객만 예약을 취소할 수 있게 해줘.','가입이 번거로우니 SMS 링크로 예약을 취소하게 해줘. 환불은 이번에 제외해.','취소 버튼 색만 빨강으로 바꿔줘.','SMS 문구만 짧게 해줘.'];
function p1(thirdRelation='separate') {
  let p=reply(put(D.createProject(),P1[0]),{relation:'start',goal:'가입한 고객만 예약을 취소할 수 있게 한다.'}).project;
  p=reply(put(p,P1[1]),{relation:'revise',goal:'가입 없이 SMS 링크로 예약을 취소할 수 있게 한다.',conditions:['환불은 이번 범위에서 제외한다.'],retired:[P1[0]]},['D1']).project;
  const revised=p.currentTaskId;
  p=reply(put(p,P1[2]),{relation:thirdRelation,goal:'취소 버튼을 빨강으로 표시한다.'}).project;
  return {p:put(p,P1[3]),revised};
}

test('F066-P1 a separate detail task no longer erases the earlier maintained/replaced reading from the next request',()=>{
  const {p,revised}=p1('separate'),r=D.begin(p).request;validateRequest(r);
  assert.equal(r.previousIntent.value.relation,'separate');
  assert.equal(r.purposeIntent.taskId,revised);assert.equal(r.purposeIntent.value.relation,'revise');
  assert.deepEqual(r.purposeIntent.value.retired,[P1[0]],'carried as an AI interpretation, not a basis change');
  assert.ok(r.bases.find(b=>b.id==='D1').status==='requested','no basis is retired by the app');
  const cont=D.begin(p1('continue').p).request;assert.equal(cont.purposeIntent,null,'only next to a separate interpretation');
});

test('F066-P1 the purpose chain never jumps over a stale interpretation; the contract rejects inconsistent purposeIntent',()=>{
  let {p}=p1('separate');
  p=D.recordBasis(p,'가입이 번거로우니 SMS 링크로 예약을 취소하게 해줘.','confirmed','D2');
  const r=D.begin(p).request;validateRequest(r);assert.equal(r.purposeIntent,null);
  const good=D.begin(p1('separate').p).request;
  const notSeparate=structuredClone(good);notSeparate.previousIntent.value.relation='continue';assert.throws(()=>validateRequest(notSeparate));
  const separatePurpose=structuredClone(good);separatePurpose.purposeIntent.value.relation='separate';assert.throws(()=>validateRequest(separatePurpose));
  const staleRef=structuredClone(good);staleRef.purposeIntent.value.basisRefs[0].revision+=1;assert.throws(()=>validateRequest(staleRef));
  validateRequest({...good,purposeIntent:null});
  assert.equal(mockAdvice(good).intent.version,'intent.1','explicit MOCK still answers the new contract');
});

test('F066-P2 a purpose correction is attributed to this task; its pre-correction request is not printed as a current value',()=>{
  let p=reply(put(D.createProject(),P1[0]),{relation:'start',goal:'가입한 고객만 예약을 취소할 수 있게 한다.'}).project;const t=p.currentTaskId;
  const before=D.handoffText(p,t);assert.ok(section(before,'## 이어갈 기준').includes(P1[0])||section(before,'## 나머지 보존 기준').includes(P1[0]),'without a correction nothing changes');
  p=D.correctIntent(p,t,'문자 링크로 예약 취소','환불 제외');p=D.recordBasis(p,'링크는 SMS로만 보낸다','confirmed',null);
  const r=D.begin(p).request;validateRequest(r);
  assert.equal(r.previousIntent.taskId,r.ticket.taskId);assert.equal(r.previousIntent.value,null);assert.equal(r.previousIntent.manualGoal,'문자 링크로 예약 취소');
  const h=D.handoffText(p,t),pre=section(h,'## 정정 전 이 작업의 요청 원문');
  assert.ok(pre.includes(P1[0]),'kept and visible');assert.match(pre,/양립하는 조건은 유지/);assert.match(pre,/불명확하면 확정하지 말고 확인/);
  for(const name of ['## 이어갈 기준','## 나머지 보존 기준'])assert.ok(!section(h,name).includes(P1[0]),`${name} must not present it as current`);
  assert.ok(section(h,'## 이어갈 기준').includes('링크는 SMS로만 보낸다')||section(h,'## 나머지 보존 기준').includes('링크는 SMS로만 보낸다'),'the user decision stays current');
  assert.equal(p.bases.find(b=>b.id==='D1').status,'requested','nothing is deleted or retired');
});

test('F066-P2 regenerating a corrected follow-up task names this task even when the AI value comes from its predecessor',()=>{
  let p=reply(put(D.createProject(),P1[0]),{relation:'start',goal:'가입한 고객만 예약을 취소할 수 있게 한다.'}).project;const parent=p.currentTaskId;
  p=put(p,P1[3]);const t=p.currentTaskId;p=D.correctIntent(p,t,'문자 링크로 예약 취소','환불 제외');
  const r=D.begin(p).request;validateRequest(r);
  assert.equal(r.previousIntent.taskId,t);assert.equal(r.previousIntent.value.goal,'가입한 고객만 예약을 취소할 수 있게 한다.');assert.ok(parent!==t);
});

test('F066 prompt states the correction, preserve, continuing-purpose and no-invention rules',()=>{
  assert.match(SYSTEM_PROMPT,/previousIntent\.taskId가 ticket\.taskId와 같고 manualGoal이 있으면/);
  assert.match(SYSTEM_PROMPT,/정정이 그 조건을 유지하는지 불명확해 결과가 달라지면/);
  assert.match(SYSTEM_PROMPT,/'그대로 유지'로 단정하지 않는다/);
  assert.match(SYSTEM_PROMPT,/purposeIntent는 previousIntent가 separate일 때만/);
  assert.match(SYSTEM_PROMPT,/이미 next에서 실행 도구가 확인하도록 넘긴 사실은 question으로 다시 묻지 않는다/);
  assert.match(SYSTEM_PROMPT,/원문·기준에 없는 동작 시점·발생 조건·대상을 next\/checks에 새로 만들지 않는다/);
});

// FIX069 (AI068): the small current edit and the still-valid earlier purpose are different axes.
test('F069 a separate small edit is printed next to the earlier purpose it does not change; nothing is retired or invented',()=>{
  let {p}=p1('separate');p=reply(p,{relation:'separate',goal:'SMS 문구를 더 짧게 만든다.'}).project;const t=p.currentTaskId;
  const purpose=section(D.handoffText(p,t),'## 이어가는 목적');
  assert.ok(purpose.includes('SMS 문구를 더 짧게 만든다.'),'this task stays this task');
  assert.match(purpose,/계속 유효한 앞선 목적 · 이번 작업이 바꾸지 않음 \(AI 해석\): 가입 없이 SMS 링크로 예약을 취소할 수 있게 한다\./);
  assert.match(purpose,/그 목적의 유지 조건: 환불은 이번 범위에서 제외한다\./);
  assert.ok(purpose.includes(`그 목적에서 대체된 이전 요청 표현 (AI 해석 · 사용자 결정은 대체하지 않음): ${P1[0]}`));
  assert.equal(D.continuingIntent(p,D.taskOf(p,t)).value.relation,'revise');
  assert.ok(p.bases.every(b=>b.status==='requested'),'display only; no basis state changes');
});

test('F069 no earlier-purpose line for continue, for a user correction, or across a stale interpretation',()=>{
  let cont=reply(p1('separate').p,{relation:'continue',goal:'SMS 링크 취소의 문구를 짧게 한다.'}).project;
  assert.ok(!section(D.handoffText(cont),'## 이어가는 목적').includes('계속 유효한 앞선 목적'));
  let corr=reply(p1('separate').p,{relation:'separate',goal:'SMS 문구를 더 짧게 만든다.'}).project;
  corr=D.correctIntent(corr,corr.currentTaskId,'문구만 짧게','환불 제외');assert.equal(D.continuingIntent(corr,D.taskOf(corr)),null);
  assert.ok(!section(D.handoffText(corr),'## 이어가는 목적').includes('계속 유효한 앞선 목적'));
  // The earlier (revise) interpretation goes stale before this task's own fresh interpretation is received.
  let stale=D.recordBasis(p1('separate').p,'가입이 번거로우니 SMS 링크로 예약을 취소하게 해줘.','confirmed','D2');
  stale=reply(stale,{relation:'separate',goal:'SMS 문구를 더 짧게 만든다.'}).project;
  assert.ok(D.currentIntent(stale,D.taskOf(stale)),'this task\'s own interpretation is valid');
  assert.equal(D.continuingIntent(stale,D.taskOf(stale)),null,'a stale earlier interpretation is not shown as continuing');
});

test('F069 prompt separates the purpose relation from the size of this edit',()=>{
  assert.match(SYSTEM_PROMPT,/relation은 고객 결과\(목적\)의 관계이지 이번 수정 범위의 크기가 아니다/);
  assert.match(SYSTEM_PROMPT,/separate는 사용자가 다른 고객 결과를 새로 시작했을 때만 쓴다/);
  assert.match(SYSTEM_PROMPT,/'적용하지 않는다'거나 '무관하다'고 쓰지 않는다/);
  assert.match(SYSTEM_PROMPT,/그 목적과 조건이 끝났거나 폐기됐다고 쓰지 않는다/);
});
