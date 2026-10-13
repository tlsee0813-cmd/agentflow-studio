import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {validateAdvice,parseProject,validateRequest} from '../dist/public/shared/validation.js';
import {serializeProject} from '../dist/public/shared/storage.js';
import {fixtureAdvice} from './ai055-fixtures.mjs';
import {cases} from './ai055-cases.mjs';
import {fileFor} from './connect039-fixtures.mjs';
const put=(p,text)=>D.submit(D.editDraft(p,text));
const reply=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:fixtureAdvice(s.request)});};
test('AI055 hand-authored four-turn interpretation reaches next HTTP input, home projection and handoff; raw user history untouched',()=>{
 let p=D.createProject();
 for(const [i,text] of cases[0].turns.entries()) {
  p=put(p,text);const before=serializeProject(p),req=D.begin(p).request;validateRequest(req);
  if(i>1){assert.match(req.previousIntent.value.goal,/가입 없이/);assert.deepEqual(req.previousIntent.value.conditions,['환불은 이번 범위에서 제외한다.']);}
  p=reply(p);assert.deepEqual(p.bases,JSON.parse(before).bases);assert.deepEqual(p.sources,JSON.parse(before).sources);
 }
 assert.equal(D.currentIntent(p,D.taskOf(p)).value.relation,'continue');
 const h=D.handoffText(p),section=h.split('## 이어가는 목적')[1].split('##')[0];
 assert.match(section,/가입 없이/);assert.match(section,/환불은 이번 범위에서 제외/);assert.match(section,/대체된 지시 · 다시 실행하지 않음/);
 assert.deepEqual(parseProject(serializeProject(p)),p);assert.equal(p.sources[0].text,cases[0].turns[0]);
});
test('AI055 invalid version/source/revision/current-input omission is rejected atomically; stored legacy eight-key advice still readable',()=>{
 const p=put(D.createProject(),cases[0].turns[0]),s=D.begin(p),good=fixtureAdvice(s.request);
 for(const mutate of [a=>delete a.intent,a=>a.intent.version='intent.99',a=>a.intent.basisRefs[0].sourceId='S_wrong',a=>a.intent.basisRefs[0].revision++,a=>a.intent.basisRefs=[]]) {
  const bad=structuredClone(good);mutate(bad);assert.throws(()=>validateAdvice(bad,['D1'],s.request));
  const n=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:bad});assert.equal(D.taskOf(n).advice,null);assert.deepEqual(n.bases,p.bases);assert.deepEqual(n.sources,p.sources);
 }
 const old=structuredClone(good);delete old.intent;validateAdvice(old,['D1']);const legacy=reply(p);legacy.tasks[0].advice=old;assert.deepEqual(parseProject(serializeProject(legacy)),legacy);
});
test('AI055 separate purpose and uncertain interpretation do not turn parent linkage into a purpose or a decision',()=>{
 let p=reply(put(D.createProject(),cases[0].turns[0]));p=put(p,cases[3].turns[1]);let s=D.begin(p),a=fixtureAdvice(s.request);
 a.intent={...a.intent,relation:'separate',goal:'통계 화면 차트 색 변경',conditions:[],retired:[]};
 p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:a});assert.equal(D.currentIntent(p,D.taskOf(p)).value.goal,'통계 화면 차트 색 변경');
 assert.deepEqual(D.currentIntent(p,D.taskOf(p)).value.conditions,[]);assert.equal(p.sources[0].text,cases[0].turns[0]);
 p=put(p,'제한은 좀 풀어줘');s=D.begin(p);a=fixtureAdvice(s.request);a.intent.relation='uncertain';a.question={kind:'choice',text:'어느 제한을 바꾸려 하나요?',why:'변경 범위가 달라집니다.',options:[]};
 p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:a});assert.equal(D.questionApplicability(p,D.taskOf(p)),'active');assert.match(D.handoffText(p),/목적 관계 미정/);
 p=D.answer(p,p.currentTaskId,'지금은 정하지 않을게요.','deferred');s=D.begin(p);a=fixtureAdvice(s.request);a.intent.relation='uncertain';a.question=null;
 p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:a});assert.equal(D.currentIntent(p,D.taskOf(p)).value.relation,'uncertain');assert.equal(D.questionApplicability(p,D.taskOf(p)),'missing');assert.equal(p.sources.at(-1).disposition,'deferred');
});
test('AI055 manual correction/undo values survive regeneration; stale response and changed source cannot replace them',()=>{
 let p=reply(put(D.createProject(),cases[0].turns[0]));p=reply(put(p,cases[0].turns[1]));
 const previous=D.previousIntent(p,D.taskOf(p));D.taskOf(p).advice.question={kind:'fact',text:'합성 과거 질문',why:'보호 경계 fixture',options:[]};const before=serializeProject(p),pending=D.begin(p);
 p=D.correctIntent(p,p.currentTaskId,'가입 없이 링크로 취소; 12시간 만료','환불 제외');
 assert.throws(()=>D.answer(p,p.currentTaskId,'옛 질문 답'),/QUESTION_NOT_APPLICABLE/);assert.equal(D.currentWork(p,D.taskOf(p)).values.next,'');assert.equal(D.begin(p).request.previousIntent.manualGoal,'가입 없이 링크로 취소; 12시간 만료');
 const n=D.receive(p,pending.request,{mode:'mock',ticket:pending.request.ticket,advice:fixtureAdvice(pending.request)});assert.equal(D.taskOf(n).manual.understanding,'가입 없이 링크로 취소; 12시간 만료');
 p=reply(p);assert.notEqual(D.currentWork(p,D.taskOf(p)).values.next,'');assert.equal(D.currentIntent(p,D.taskOf(p)).manualGoal,'가입 없이 링크로 취소; 12시간 만료');assert.deepEqual(p.sources,JSON.parse(before).sources);
 const req=D.begin(put(p,'오타도 고쳐줘')).request;assert.equal(req.previousIntent.manualConditions,'환불 제외');
 const undone=D.correctIntent(p,p.currentTaskId,previous.value.goal,previous.value.conditions.join(' / '));assert.equal(D.currentIntent(undone,D.taskOf(undone)).manualGoal,previous.value.goal);assert.ok(!D.handoffText(undone).includes('대체된 지시 · 다시 실행하지 않음'));
 p=D.recordBasis(p,'가입 없이 링크로 취소; 6시간 만료','confirmed','D2');assert.equal(D.currentIntent(p,D.taskOf(p)),null);assert.equal(D.begin(put(p,'다음 문구')).request.previousIntent,null);
});
test('AI055 exact late return preserves manual purpose, raw file and independent branch; no semantic promotion from report',()=>{
 let p=reply(put(D.createProject(),cases[0].turns[0])),A=p.currentTaskId;
 p=D.markHandoff(p,A,D.handoffText(p,A,'H_ai055'),'download',p.revision,'H_ai055');
 p=D.correctIntent(p,A,'링크로 취소, 12시간 만료','환불 제외');p=reply(put(p,'별개 통계 차트'));
 const raw=JSON.stringify(fileFor(p,A,'H_ai055','합성 늦은 보고: 가입 제한을 구현했다고 주장. 실제 실행 증거 없음.',null));p=D.importResultFile(p,raw);
 const r=D.begin(p).request;assert.equal(r.previousIntent.taskId,A);assert.equal(r.previousIntent.manualGoal,'링크로 취소, 12시간 만료');
 assert.equal(D.taskOf(p).resultFile.rawText,raw);assert.deepEqual(parseProject(serializeProject(p)),p);assert.equal(p.bases[0].text,cases[0].turns[0]);
});
