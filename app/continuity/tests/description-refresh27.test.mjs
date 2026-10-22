// All scenario text and returned reports are synthetic. Pure domain/transport boundaries only.
// No browser, server, paid model, semantic conflict resolution or automatic approval claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {mockAdvice} from '../dist/public/shared/mock.js';
import {parseProject,validateRequest,SUMMARY_LIMIT} from '../dist/public/shared/validation.js';

const copy=v=>structuredClone(v),request=(p,id)=>D.begin(p,id).request;
const ORIGINAL='[합성 외부 설명] ORIGINAL_7: 안내에는 7일이라고 적혀 있다.';
const CORRECTED='[합성 사용자 정정] DISPLAY_30: 현재 표시는 30일이다. 이 설명 정정은 새 보관 정책 지시가 아니다.';
const MANUAL={understanding:'[직접 U30] 표시 30일을 읽었다.',next:'[직접 N30] 표시 문구 30일을 확인한다.',scope:'[직접 S7] 기존 보관 동작 7일은 이번에 바꾸지 않는다. 배포하지 않는다.',checks:'[직접 C7] 기존 보관 동작 7일이 유지되는지 관찰한다. 배포하지 않았는지 확인한다.'};
const INITIAL={understanding:'[직접 U7] 표시 7일을 읽었다.',next:'[직접 N7] 표시 문구 7일을 확인한다.',scope:MANUAL.scope,checks:MANUAL.checks};
function fixture({heldOnly=false}={}){
  let p=D.setBrief(D.createProject(),'[합성27] 보관 안내의 표시와 동작을 구분한다. 새 정책을 정하지 않는다.');
  p=D.addArea(p,'A 안내','[합성] 현재 안내 자료를 읽는다.');const area=p.space.areas[0].id;
  p=D.addArea(p,'B 다른 부분','[합성] 별도 작업이다.');const other=p.space.areas[1].id;
  p=D.submit(D.editDraft(p,'[합성27] 안내의 현재 자료를 정리한다.'),undefined,area);const A=p.currentTaskId;
  const started=D.begin(p,A);p=D.receive(started.project,started.request,{mode:'mock',ticket:started.request.ticket,advice:mockAdvice(started.request)});
  for(const [key,value]of Object.entries(INITIAL))p=D.editTask(p,A,key,value);
  const H='H_REFRESH27',anchor=D.exportAnchor(p,D.taskOf(p,A)),text=D.handoffText(p,A,H);
  p=D.markHandoff(p,A,text,'clipboard',p.revision,H,anchor);
  const file={schemaVersion:'agentflow.return.2',projectId:p.id,taskId:A,returnId:H,report:'[합성 원보고] ORIGINAL_REPORT_7: 안내가 7일이라고 보고했다. 실제 검증 결과가 아니다.',evidence:null,
    understanding:{version:'understanding.1',areaId:area,basedOn:heldOnly?99:anchor.understanding,summary:ORIGINAL,changes:[],proposal:null,origin:'[합성27] 단위 검사 작성자가 구성한 외부 자료'}};
  p=D.importResultFile(p,JSON.stringify(file));return {p,area,other,A,H,file,report:p.currentTaskId};
}
function staleSample(){
  const s=fixture();let p=D.correctUnderstanding(s.p,s.area,CORRECTED);
  for(const key of ['understanding','next'])p=D.editTask(p,s.A,key,MANUAL[key]);
  assert.equal(D.taskOf(p,s.A).manual.scope,D.taskOf(s.p,s.A).manual.scope,'S7 is byte-identical; only U/N were edited');
  assert.equal(D.taskOf(p,s.A).manual.checks,D.taskOf(s.p,s.A).manual.checks,'C7 and no-deploy condition are byte-identical');
  assert.equal(D.areaDescription(p,s.area).current.valid,false,'direct work values remain in the broad fingerprint');
  return {...s,p};
}
function assertOnlyDescriptionChanged(before,after,area){
  const restored=copy(after);restored.space.understanding[area]=copy(before.space.understanding[area]);restored.revision=before.revision;restored.notice=before.notice;
  assert.deepEqual(restored,before,'tasks, original reports/H, manual four values, basis, idea, placement, current and draft are unchanged');
}
function rejectUnchanged(p,area,token){const before=copy(p);assert.equal(D.understandingReviewMatches(p,area,token),false);assert.throws(()=>D.recordUnderstandingReview(p,area,CORRECTED,token),/UNDERSTANDING_REVIEW_CHANGED/);assert.deepEqual(p,before);}

test('REFRESH27 stale U/N30 S/C7 requires an explicit new user revision and preserves original records through request/handoff',()=>{
  const s=staleSample(),before=copy(s.p),oldState=copy(s.p.space.understanding[s.area]),token=D.beginUnderstandingReview(s.p,s.area);
  assert.deepEqual(token,{projectId:s.p.id,areaId:s.area,revision:2,stamp:D.planStamp(s.p,s.area)});
  assert.throws(()=>D.correctUnderstanding(s.p,s.area,CORRECTED),/NOTHING_TO_CORRECT/,'ordinary correction keeps its valid-only policy');
  assert.deepEqual(s.p,before);assert.equal(request(s.p,s.A).currentAreaDescription,null);
  const p=D.recordUnderstandingReview(s.p,s.area,CORRECTED,token),d=D.areaDescription(p,s.area).current;
  assert.equal(d.valid,true);assert.equal(d.summary,CORRECTED);assert.equal(d.entry.by,'user');assert.equal(d.entry.revision,3);assert.equal(d.entry.corrects,2);
  assert.equal(d.entry.taskId,null);assert.equal(d.entry.returnId,null);assert.deepEqual(d.entry.stamp,D.planStamp(before,s.area));
  assert.deepEqual(p.space.understanding[s.area].entries.slice(0,-1),oldState.entries,'old stamps/history are never repaired in place');
  assertOnlyDescriptionChanged(before,p,s.area);assert.deepEqual(D.currentWork(p,D.taskOf(p,s.A)).values,MANUAL);
  const req=validateRequest(request(p,s.A));assert.deepEqual(req.currentAreaDescription,{taskId:s.A,areaId:s.area,revision:3,by:'user',corrects:2,source:null,text:CORRECTED});
  const handoff=D.handoffText(p,s.A);assert.ok(handoff.includes(CORRECTED));assert.ok(handoff.includes('사용자가 설명 r2을 직접 고친 값'));
  for(const text of Object.values(MANUAL))assert.ok(handoff.includes(text),'reference does not silently resolve the four work values');
  assert.equal(D.taskOf(p,s.report).resultFile.rawText,JSON.stringify(s.file));assert.deepEqual(D.taskOf(p,s.A).handoffs,D.taskOf(before,s.A).handoffs);
  assert.deepEqual(parseProject(JSON.stringify(p)),p);
  const next=D.submit(D.editDraft(p,'[합성27] 같은 부분의 다음 자료 확인'),undefined,s.area),C=next.currentTaskId;
  assert.equal(request(next,C).currentAreaDescription.taskId,C);assert.equal(request(next,C).currentAreaDescription.revision,3);assert.ok(D.handoffText(next,C).includes(CORRECTED));
});

test('REFRESH27 unchanged text still creates a fresh user revision; valid ordinary correction remains available',()=>{
  const s=fixture(),token=D.beginUnderstandingReview(s.p,s.area),before=copy(s.p);
  const p=D.recordUnderstandingReview(s.p,s.area,ORIGINAL,token),d=D.areaDescription(p,s.area).current;
  assert.equal(d.entry.revision,2);assert.equal(d.entry.corrects,1);assert.equal(d.entry.by,'user');assert.equal(d.summary,ORIGINAL);
  assert.equal(d.returnTask,null,'a user review is not attributed to the external report');assertOnlyDescriptionChanged(before,p,s.area);
  const ordinary=D.correctUnderstanding(s.p,s.area,CORRECTED);assert.equal(D.areaDescription(ordinary,s.area).current.valid,true);
  assert.equal(D.areaDescription(ordinary,s.area).current.entry.corrects,1);
});

test('REFRESH27 opening token rejects changed stamp/revision/project/area/archive without mutating either project',()=>{
  const s=staleSample(),token=D.beginUnderstandingReview(s.p,s.area),otherProject=staleSample();
  rejectUnchanged(D.editTask(s.p,s.A,'checks',MANUAL.checks+' [열린 뒤 변경]'),s.area,token);
  rejectUnchanged(D.editArea(s.p,s.area,'A 안내','[열린 뒤 구상 변경]'),s.area,token);
  const newer=D.recordUnderstandingReview(s.p,s.area,CORRECTED,token);rejectUnchanged(newer,s.area,token);
  rejectUnchanged(otherProject.p,otherProject.area,token);
  rejectUnchanged(s.p,s.other,token);
  rejectUnchanged(s.p,s.area,{...copy(token),projectId:'P_WRONG_CONTEXT'});
  rejectUnchanged(s.p,s.area,{...copy(token),areaId:s.other});
  rejectUnchanged(D.setAreaArchived(s.p,s.area,true),s.area,token);
  assert.deepEqual(token.stamp,D.planStamp(s.p,s.area),'opening context is captured by value, not advanced by another state');
});

test('REFRESH27 unrelated draft/current/other-area work does not invalidate exact A review or switch current B',()=>{
  const s=staleSample(),token=D.beginUnderstandingReview(s.p,s.area);
  let p=D.submit(D.editDraft(s.p,'[합성 B] 별도 요청'),undefined,s.other);const B=p.currentTaskId;
  p=D.editTask(p,B,'scope','[직접 B] A와 무관');p=D.editDraft(p,'[미전송 B 초안] 그대로 둔다.');
  const before=copy(p);assert.equal(D.understandingReviewMatches(p,s.area,token),true);
  p=D.recordUnderstandingReview(p,s.area,CORRECTED,token);assert.equal(p.currentTaskId,B);assert.equal(p.draft,before.draft);assertOnlyDescriptionChanged(before,p,s.area);
  assert.equal(request(p,B).currentAreaDescription,null,'A reference is never substituted for unrelated current B');
});

test('REFRESH27 held-only/archive cannot be adopted; later held report never becomes the reviewed text',()=>{
  const held=fixture({heldOnly:true}),before=copy(held.p);assert.equal(D.areaDescription(held.p,held.area).current,null);
  assert.throws(()=>D.beginUnderstandingReview(held.p,held.area),/NOTHING_TO_REVIEW/);assert.deepEqual(held.p,before);
  rejectUnchanged(held.p,held.area,{projectId:held.p.id,areaId:held.area,revision:0,stamp:D.planStamp(held.p,held.area)});
  const s=staleSample(),archived=D.setAreaArchived(s.p,s.area,true);assert.throws(()=>D.beginUnderstandingReview(archived,s.area),/AREA_MISSING/);
  const heldOpen=D.beginUnderstandingReview(s.p,s.area);
  const late={...s.file,report:'[합성 늦은 보고] 재검증 아님',understanding:{...s.file.understanding,summary:'HELD_MUST_NOT_BE_ADOPTED'}};
  const p=D.importResultFile(s.p,JSON.stringify(late)),state=D.areaDescription(p,s.area);assert.ok(state.held.length>0);assert.equal(state.current.summary,CORRECTED);
  assert.equal(D.understandingReviewMatches(p,s.area,heldOpen),true,'a held-only arrival does not advance the latest applied revision');
  const after=D.recordUnderstandingReview(p,s.area,state.current.summary,heldOpen);
  assert.equal(D.areaDescription(after,s.area).current.summary,CORRECTED);assert.deepEqual(D.areaDescription(after,s.area).held,state.held);
  assertOnlyDescriptionChanged(p,after,s.area);
});

test('REFRESH27 another work/idea edit makes the explicit revision stale again; old-H return cannot overwrite it',()=>{
  const s=staleSample(),p=D.recordUnderstandingReview(s.p,s.area,CORRECTED,D.beginUnderstandingReview(s.p,s.area)),entry=copy(p.space.understanding[s.area].entries.at(-1));
  const changed=D.editTask(p,s.A,'scope',MANUAL.scope+' [후속 실제 수정]');assert.equal(D.areaDescription(changed,s.area).current.valid,false);
  assert.equal(request(changed,s.A).currentAreaDescription,null);assert.deepEqual(changed.space.understanding[s.area].entries.at(-1),entry);
  const idea=D.editArea(p,s.area,'A 안내','[후속 구상 수정]');assert.equal(D.areaDescription(idea,s.area).current.valid,false);
  const late={...s.file,report:'[다른 원문] LATE_ORIGINAL_H',understanding:{...s.file.understanding,summary:'LATE_H_CANNOT_REPLACE_REVIEW'}};
  const received=D.importResultFile(p,JSON.stringify(late)),state=D.areaDescription(received,s.area);
  assert.equal(state.current.entry.revision,3);assert.equal(state.current.summary,CORRECTED);assert.equal(state.current.valid,true);
  assert.ok(state.held.some(x=>x.summary==='LATE_H_CANNOT_REPLACE_REVIEW'));assert.deepEqual(D.taskOf(received,s.A).handoffs,D.taskOf(p,s.A).handoffs);
  assert.equal(D.taskOf(received,s.report).resultFile.rawText,JSON.stringify(s.file));
});

test('REFRESH27 related work uses old/live stamp union, actual owners and unplaced work rather than current B',()=>{
  const s=fixture();let p=D.placeTask(s.p,s.A,s.other);
  p=D.submit(D.editDraft(p,'[합성 전역] 미지정 작업'),undefined,null);const G=p.currentTaskId;p=D.editTask(p,G,'checks','[직접 전역 조건]');
  p=D.submit(D.editDraft(p,'[합성 B] 현재 작업'),undefined,s.other);const B=p.currentTaskId;p=D.editTask(p,B,'next','[직접 B] 별도');
  const before=copy(p),work=D.understandingReviewWork(p,s.area),ids=work.map(x=>x.task.id);
  assert.ok(ids.includes(s.A),'old stamp task is retained even after moving to another area');assert.ok(ids.includes(G),'current global manual work is included');assert.equal(ids.includes(B),false);
  assert.equal(new Set(ids).size,ids.length);assert.equal(D.areaOf(p,work.find(x=>x.task.id===s.A).task),s.other);assert.equal(D.areaOf(p,work.find(x=>x.task.id===G).task),null);
  assert.ok(work.find(x=>x.task.id===s.A).changed);assert.ok(work.find(x=>x.task.id===G).changed);assert.deepEqual(p,before);assert.equal(p.currentTaskId,B);
});

test('REFRESH27 size/empty rejection preserves context; maximum existing description limit is not shortened',()=>{
  const s=staleSample(),token=D.beginUnderstandingReview(s.p,s.area),before=copy(s.p);
  for(const value of ['   ','x'.repeat(SUMMARY_LIMIT+1)]){assert.throws(()=>D.recordUnderstandingReview(s.p,s.area,value,token));assert.deepEqual(s.p,before);}
  const value='가'.repeat(SUMMARY_LIMIT),p=D.recordUnderstandingReview(s.p,s.area,value,token);
  assert.equal(D.areaDescription(p,s.area).current.summary,value);assert.equal(validateRequest(request(p,s.A)).currentAreaDescription.text,value);assert.deepEqual(parseProject(JSON.stringify(p)),p);
});
