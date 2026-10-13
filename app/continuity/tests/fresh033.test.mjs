import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import { stageOf } from '../dist/public/client/presentation.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { mockAdvice } from '../server/mock.mjs';
import { toLegacy } from './fixtures.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REQUEST='빈자리가 생기면 대기자를 자동으로 예약해줘.';
const ORIGINAL='대기 순서는 먼저 신청한 사람 순으로 유지한다.';
const CHANGED='예약은 참여 확인 뒤에만 확정한다. 대기 순서는 먼저 신청한 사람 순으로 유지한다.';
const OLD_REPLY='바로 예약 확정 — 추가 응답 없이 예약이 성립합니다. 참여 의사를 별도로 확인하지 않습니다.';
const organised=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});};
const fresh=()=>organised(D.recordBasis(D.submit(D.editDraft(D.createProject(),REQUEST)),ORIGINAL));
const stale=()=>D.recordBasis(fresh(),CHANGED,'confirmed','D2');
const dump=(name,value)=>{if(process.env.FRESH033_EVIDENCE){mkdirSync(process.env.FRESH033_EVIDENCE,{recursive:true});writeFileSync(join(process.env.FRESH033_EVIDENCE,name),JSON.stringify(value,null,2));}};

test('F033-1 relay exact stale choice cannot create a source/basis or enter the next request',()=>{
  const original=fresh(),p=D.recordBasis(original,CHANGED,'confirmed','D2'),before=JSON.stringify(p),t=D.taskOf(p);
  assert.equal(t.adviceRevision,4);assert.equal(p.revision,6);assert.equal(p.bases[1].revision,6);
  assert.equal('questionId' in t.advice.question,false);assert.equal(D.currentWork(p,t).aiStale,true);
  let result=p,code=null;try{result=D.answer(p,t.id,OLD_REPLY);}catch(e){code=e.message;}
  const next=D.begin(result).request;
  dump('domain-relay.json',{before:p,after:result,code,nextRequest:next,nextRequestIncludesOldReply:JSON.stringify(next).includes(OLD_REPLY)});
  assert.equal(code,'QUESTION_NOT_APPLICABLE');
  assert.equal(JSON.stringify(p),before);assert.deepEqual(result,p);
  assert.equal(JSON.stringify(next).includes(OLD_REPLY),false);
  assert.equal(D.questionApplicability(p,t),'stale');
  assert.equal(stageOf(p,t).kind,'stale');assert.match(D.taskStatus(p,t),/이전 질문/);
  assert.match(D.handoffText(p),/이전 질문 · 참고 기록/);assert.doesNotMatch(D.handoffText(p),/### 남은 제품 선택/);
  assert.deepEqual(t.advice,original.tasks[0].advice);assert.equal(p.bases[1].history[0].text,ORIGINAL);
});

test('F033-2 fresh replies and existing duplicate precedence survive bookkeeping',()=>{
  let p=fresh();p=D.editDraft(p,'미제출 요청');p=D.rename(p,'이름 변경');p=D.editAuxDraft(p,'answerDraft','미제출 답');
  p=D.editAuxDraft(p,'basisDraft','미제출 기준');p=D.editBasisDraft(p,'D2','미제출 수정');p=D.markHandoff(p,p.currentTaskId,D.handoffText(p),'download');
  assert.equal(D.questionApplicability(p,D.taskOf(p)),'active');assert.equal(D.currentWork(p,D.taskOf(p)).aiStale,false);
  const before=structuredClone(p);p=D.answer(p,p.currentTaskId,OLD_REPLY);
  assert.equal(p.sources.length,before.sources.length+1);assert.equal(p.bases.length,before.bases.length+1);
  assert.deepEqual(p.bases.slice(0,-1),before.bases);assert.equal(D.questionApplicability(p,D.taskOf(p)),'answered');
  p=D.recordBasis(p,CHANGED,'confirmed','D2');const raw=JSON.stringify(p);
  assert.throws(()=>D.answer(p,p.currentTaskId,OLD_REPLY),/ALREADY_ANSWERED/);assert.equal(JSON.stringify(p),raw);
  assert.doesNotMatch(D.taskStatus(p,D.taskOf(p)),/항목 있음/);
});

test('F033-3 all dispositions and synthetic paths reject stale without input mutation; refreshed questions work',()=>{
  for(const request of [REQUEST,'결제가 실패하는 오류가 있어요.']) {
    let p=organised(D.recordBasis(D.submit(D.editDraft(D.createProject(),request)),ORIGINAL));
    p=D.recordBasis(p,CHANGED,'confirmed','D2');
    for(const disposition of ['provided','unknown','deferred'])for(const synthetic of [false,true]) {
      const before=JSON.stringify(p);assert.throws(()=>D.answer(p,p.currentTaskId,'답변 원문',disposition,synthetic),/QUESTION_NOT_APPLICABLE/);assert.equal(JSON.stringify(p),before);
    }
    const refreshed=organised(p);assert.equal(D.questionApplicability(refreshed,D.taskOf(refreshed)),'active');
    assert.deepEqual(refreshed.sources,p.sources);assert.deepEqual(refreshed.bases,p.bases);
    for(const disposition of ['provided','unknown','deferred'])assert.equal(D.answer(refreshed,refreshed.currentTaskId,'현재 질문 답변',disposition).sources.at(-1).disposition,disposition);
  }
});

test('F033-4 unknown advice revision and imported legacy remain read-only; current recovery preserves the boundary',()=>{
  for(const original of [stale(),parseProject(JSON.stringify(toLegacy({project:fresh(),texts:[]})))]) {
    const p=parseProject(serializeProject(original)),before=JSON.stringify(p);
    assert.throws(()=>D.answer(p,p.currentTaskId,OLD_REPLY),/QUESTION_NOT_APPLICABLE/);assert.equal(JSON.stringify(p),before);
    assert.equal(D.currentWork(p,D.taskOf(p)).aiStale,true);assert.equal(stageOf(p,D.taskOf(p)).kind,'stale');
    if(D.taskOf(p).adviceRevision===null){assert.equal(D.questionApplicability(p,D.taskOf(p)),'unknown');assert.match(D.handoffText(p),/시점 확인 불가/);}
    const refreshed=organised(p);assert.equal(D.questionApplicability(refreshed,D.taskOf(refreshed)),'active');
  }
  for(const revision of [null,undefined,-1,NaN,1.5,Number.MAX_SAFE_INTEGER]) {
    const p=fresh();D.taskOf(p).adviceRevision=revision;const before=structuredClone(p);
    assert.equal(D.changedSinceAdvice(p,D.taskOf(p)),'unknown');
    assert.throws(()=>D.answer(p,p.currentTaskId,OLD_REPLY),/QUESTION_NOT_APPLICABLE/);assert.deepEqual(p,before);
    if(revision!==null&&!Number.isNaN(revision))assert.throws(()=>parseProject(JSON.stringify(p)));
  }
  // Past history ambiguity alone does not invalidate a response covering every revision.
  const malformed=fresh(),b=malformed.bases[1];
  b.history=[{text:b.text,status:b.status,sourceId:b.sourceId,revision:b.revision}];
  const imported=parseProject(JSON.stringify(malformed)),before=JSON.stringify(imported);
  assert.deepEqual(D.changedSinceAdvice(imported,D.taskOf(imported)),[]);
  assert.equal(D.questionApplicability(imported,D.taskOf(imported)),'active');
  // Current revision <= advice is insufficient: a later history entry can cross it.
  const crossing=structuredClone(imported);crossing.bases[1].history[0].revision=crossing.revision;
  const unknown=parseProject(JSON.stringify(crossing)),raw=JSON.stringify(unknown);
  assert.equal(D.changedSinceAdvice(unknown,D.taskOf(unknown)),'unknown');
  assert.throws(()=>D.answer(unknown,unknown.currentTaskId,OLD_REPLY),/QUESTION_NOT_APPLICABLE/);
  assert.equal(JSON.stringify(unknown),raw);
  const refreshed=organised(unknown);
  assert.equal(D.questionApplicability(refreshed,D.taskOf(refreshed)),'active');
  assert.deepEqual(refreshed.bases,unknown.bases);assert.deepEqual(refreshed.sources,unknown.sources);
  assert.equal(D.answer(refreshed,refreshed.currentTaskId,'현재 질문에 대한 답변').sources.at(-1).kind,'answer');
  assert.equal(JSON.stringify(imported),before);
});

test('F033-5 rev1 history boundaries recover without repairs, while new same-task bases still reject old replies',()=>{
  let p=fresh();p=D.editTask(p,p.currentTaskId,'next','보존할 수동 작업문');
  const b=p.bases[1];b.history=[{text:'이전 값',status:b.status,sourceId:b.sourceId,revision:p.revision}];
  p=parseProject(JSON.stringify(p));const before=structuredClone(p);
  assert.equal(D.questionApplicability(p,D.taskOf(p)),'unknown');
  p=organised(p);assert.equal(D.questionApplicability(p,D.taskOf(p)),'active');
  assert.deepEqual(p.bases,before.bases);assert.deepEqual(p.sources,before.sources);assert.deepEqual(D.taskOf(p).manual,D.taskOf(before).manual);
  const next=organised(D.submit(D.editDraft(p,REQUEST)));
  assert.notEqual(next.currentTaskId,p.currentTaskId);assert.equal(D.questionApplicability(next,D.taskOf(next)),'active');
  assert.deepEqual(next.bases.slice(0,p.bases.length),p.bases);
  // A valid import may contain a history entry later than current, but never later than the project.
  const future=structuredClone(before);future.bases[1].history[0].revision=future.revision+1;
  assert.throws(()=>parseProject(JSON.stringify(future)));
  assert.equal(D.changedSinceAdvice(future,D.taskOf(future)),'unknown');
  // Recording a new basis on this task after its question must remain a real negative case.
  const added=D.recordBasis(fresh(),'참여 확인 없는 예약 확정은 하지 않는다.');const raw=JSON.stringify(added);
  assert.equal(D.questionApplicability(added,D.taskOf(added)),'stale');
  assert.throws(()=>D.answer(added,added.currentTaskId,OLD_REPLY),/QUESTION_NOT_APPLICABLE/);
  assert.equal(JSON.stringify(added),raw);
});
