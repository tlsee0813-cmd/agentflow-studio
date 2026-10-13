import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import {outcomeOf} from '../dist/public/shared/outcome.js';
import {parseProject,validateRequest} from '../dist/public/shared/validation.js';
import {serializeProject,ProjectStore} from '../dist/public/shared/storage.js';
import {mockAdvice} from '../server/mock.mjs';
import {fixture,fileFor,v1,v2} from './connect039-fixtures.mjs';
const put=(p,text,kind='request')=>D.submit(D.editDraft(D.setKind(p,kind),text));
const respond=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});};

test('F049 purpose identity survives handoff, exact return, changed direction and storage without a second state store',()=>{
  let p=respond(put(D.createProject(),'参加者が予定を見て申し込める小さなサービスを考えたい。まず案を出して。'));
  const origin=outcomeOf(p).origin,root=p.currentTaskId;
  p=D.recordBasis(p,'決済は追加しない。');p=D.editTask(p,root,'scope','まず案を比較する。実装はまだ依頼していない。');
  const text=D.handoffText(p,root,'H_flow049');p=D.markHandoff(p,root,text,'download',p.revision,'H_flow049');
  const previous=structuredClone(p),raw=JSON.stringify(fileFor(p,root,'H_flow049','案を二つ報告。ファイルの変更・実行なし。',null));
  p=D.importResultFile(p,raw);assert.equal(outcomeOf(p).id,origin.id);assert.deepEqual(p.bases,previous.bases);
  p=put(p,'今回は申込だけを先に作って。決済は不要のまま。');
  const view=outcomeOf(p);assert.equal(view.id,origin.id);assert.equal(view.request.text,p.sources.at(-1).text);assert.equal(view.reports.length,1);
  assert.equal(D.taskOf(p,root).manual.scope,previous.tasks[0].manual.scope);
  const request=D.begin(p).request;validateRequest(request);assert.ok(request.sources.some(s=>s.id===origin.id));
  assert.ok(request.bases.some(b=>b.text==='決済は追加しない。'));
  assert.ok(D.handoffText(p).includes(view.request.text));
  assert.equal(p.tasks.find(t=>t.resultFile)?.resultFile.rawText,raw);
  const memory=new Map(),store=new ProjectStore({getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)});store.load();store.save(p);
  const restored=store.load();assert.deepEqual(restored,p);assert.equal(outcomeOf(restored).id,origin.id);
  assert.deepEqual(p.sources.slice(0,previous.sources.length),previous.sources);
});

test('F049 revised origin basis is current, immutable origin stays attributed; home projection never mutates data',()=>{
  let p=put(D.createProject(),'응답 시간을 줄이고 오류율은 유지해줘.');const origin=outcomeOf(p).origin;
  p=D.recordBasis(p,'응답 시간보다 메모리 사용량을 먼저 줄여줘. 오류율은 유지한다.','confirmed','D1');
  const before=serializeProject(p),view=outcomeOf(p);
  assert.equal(view.id,origin.id);assert.equal(view.origin.text,origin.text);assert.equal(view.originBases[0].text,p.bases[0].text);
  assert.equal(view.originBases[0].history[0].sourceId,origin.id);assert.match(D.handoffText(p),/이 원문은 기록이며 현재 지시가 아닙니다/);
  assert.equal(serializeProject(p),before);
});

test('F049 late A return is scoped; latest B request is flagged and A report never leaks into B handoff',()=>{
  const {p,A,B,H1,HB,raw}=fixture();const returned=D.importResultFile(p,raw),view=outcomeOf(returned);
  assert.equal(view.request.taskId,A);assert.equal(view.otherLatestRequest.taskId,B);assert.equal(view.reports.length,2);
  const n=put(D.importResultFile(returned,JSON.stringify(fileFor(returned,B,HB,'B_ONLY_RESULT',null))),'B 다음 작업');
  for(const body of [D.handoffText(n),JSON.stringify(D.begin(n).request)]){assert.ok(body.includes('B_ONLY_RESULT'));assert.ok(!body.includes('합성 A 보고'));}
  assert.equal(outcomeOf(n).reports.some(s=>s.text.includes('합성 A 보고')),false);
  assert.equal(outcomeOf(n).id,outcomeOf(p,A).id);
  assert.equal(D.taskOf(returned).resultFile.returnId,H1);
});

test('F049 empty/report-only/legacy projects do not acquire an invented goal; existing IDs survive migration',()=>{
  assert.equal(outcomeOf(D.createProject()).origin,null);
  assert.equal(outcomeOf(put(D.createProject(),'확인하지 않은 구현 보고','report')).id,null);
  const {p}=fixture();for(const legacy of [v1(p),v2(p)]){
    const migrated=parseProject(JSON.stringify(legacy));assert.equal(outcomeOf(migrated).id,outcomeOf(p).id);
    assert.deepEqual(migrated.sources,p.sources);assert.deepEqual(migrated.bases.map(b=>b.history),p.bases.map(b=>b.history));
  }
});

test('F049 sibling report and evidence match the existing adjacent return group, without unrelated B reports',()=>{
  let p=put(D.createProject(),'A 문구 수정');const A=p.currentTaskId;
  p=D.markHandoff(p,A,D.handoffText(p),'download');
  p=put(p,'A_REPORT','report');p=put(p,'A_EVIDENCE','evidence');
  for(const value of [p,put(p,'A 다음 변경')]){
    assert.deepEqual(outcomeOf(value).reports.map(s=>s.text),['A_REPORT','A_EVIDENCE']);
    const sources=D.begin(value).request.sources;assert.ok(sources.some(s=>s.text==='A_REPORT'));assert.ok(sources.some(s=>s.text==='A_EVIDENCE'));
  }
  p=put(p,'B 범위');const B=p.currentTaskId;p=D.markHandoff(p,B,D.handoffText(p),'download');
  p=D.submit(D.editDraft(D.setKind(p,'report'),'B_REPORT'),B);
  const late=D.submit(D.editDraft(D.setKind(p,'evidence'),'A_MORE'),A);
  assert.deepEqual(outcomeOf(late).reports.map(s=>s.text),['A_REPORT','A_EVIDENCE','A_MORE']);
  assert.ok(!D.handoffText(late).includes('B_REPORT'));
});

test('F049 long chain retains old requests as bases, not duplicate sources; stale question rejection remains atomic',()=>{
  let p=respond(put(D.createProject(),'빈자리가 생기면 대기자를 자동으로 예약해줘.'));const root=p.currentTaskId,origin=outcomeOf(p).origin;
  p=D.answer(p,root,'참여 확인 뒤 확정. 미응답은 보류.');
  p=D.markHandoff(p,root,D.handoffText(p),'download');p=put(p,'OLD_RETURN_NOT_CURRENT','report');
  for(let i=0;i<4;i++)p=put(p,`명확한 문구 변경 ${i}`);
  const r=D.begin(p).request;assert.ok(!r.sources.some(s=>s.id===origin.id));assert.equal(r.bases.find(b=>b.sourceId===origin.id).text,origin.text);assert.ok(!r.sources.some(s=>s.text==='OLD_RETURN_NOT_CURRENT'));
  assert.ok(r.bases.some(b=>b.text.includes('미응답은 보류')));
  let q=respond(put(D.createProject(),'빈자리가 생기면 대기자를 자동으로 예약해줘.'));
  q=D.recordBasis(q,'자동 확정은 하지 않는다.');const before=serializeProject(q);
  assert.equal(D.questionApplicability(q,D.taskOf(q)),'stale');assert.throws(()=>D.answer(q,q.currentTaskId,'바로 확정'),/QUESTION_NOT_APPLICABLE/);
  assert.equal(serializeProject(q),before);assert.equal(outcomeOf(q).originBases.length,1);
});


test('FIX051 direction remains visible through a small request; correction uses one basis and retains original history',()=>{
  const first='회원가입한 고객만 예약을 취소할 수 있게 해줘';
  const direction='방향을 바꿀게: 회원가입 없이도 예약 링크로 취소할 수 있게 해줘';
  const small='취소 버튼 색만 빨간색으로 바꿔줘';
  let p=put(put(put(D.createProject(),first),direction),small);
  const before=structuredClone(p),view=outcomeOf(p);
  assert.equal(view.requestBasis.text,small);assert.equal(view.directionBasis.text,direction);
  const handoff=D.handoffText(p),reference=handoff.indexOf('## 이전 요청 원문 참조');
  assert.ok(reference>0);assert.ok(handoff.indexOf(first)>reference,'old request is a reference, not a current instruction');
  assert.ok(!handoff.includes('## 목적과 이어지는 요청'));
  p=D.recordBasis(p,'예약 링크로 취소하되 만료 기간은 변경하지 않는다.','confirmed',view.directionBasis.id);
  assert.equal(outcomeOf(p).directionBasis.text,p.bases[1].text);
  assert.equal(p.bases[1].history[0].text,direction);assert.deepEqual(p.sources.slice(0,3),before.sources);
  assert.deepEqual(p.bases[0],before.bases[0],'no invented semantic deletion of unmentioned clauses');
  assert.equal(outcomeOf(parseProject(serializeProject(p))).directionBasis.text,p.bases[1].text);
  assert.equal(D.begin(p).request.bases.find(b=>b.id===view.directionBasis.id).text,p.bases[1].text);
});

test('FIX051 two 11000-character requests fit; no root duplication or invented global purpose for unrelated scope',()=>{
  let p=put(put(put(D.createProject(),'가'.repeat(11000)),'짧은 중간 요청'),'나'.repeat(11000));
  const stored=serializeProject(p),r=D.begin(p).request;
  assert.ok(Buffer.byteLength(JSON.stringify(r))<=131072);validateRequest(r);
  assert.equal(r.sources.some(s=>s.id===p.sources[0].id),false);assert.equal(r.bases[0].text,p.sources[0].text);
  assert.equal(serializeProject(p),stored);
  p=put(put(put(D.createProject(),'예약 취소 정책을 조사해줘'),'확인할 항목만 정리해줘'),'별도 통계 차트의 색만 바꿔줘');
  assert.equal(outcomeOf(p).request.text,p.sources[2].text);assert.equal(outcomeOf(p).directionDeclared,false);assert.equal(outcomeOf(p).direction.text,p.sources[1].text);
  assert.equal(D.begin(p).request.sources.some(s=>s.id===p.sources[0].id),false);
  const h=D.handoffText(p);assert.ok(h.indexOf(p.sources[0].text)>h.indexOf('## 이전 요청 원문 참조'));
});

test('FIX051 off-path B remains visible after late A return and next request, without report mixing',()=>{
  let p=put(D.createProject(),'A 요청');const A=p.currentTaskId;p=D.markHandoff(p,A,D.handoffText(p),'download');
  p=put(p,'B 요청');const B=p.currentTaskId;p=D.markHandoff(p,B,D.handoffText(p),'download');
  p=D.submit(D.editDraft(D.setKind(p,'report'),'늦은 A 보고'),A);
  p=put(p,'A 다음 요청');const view=outcomeOf(p);
  assert.deepEqual(view.otherRequests.map(s=>s.taskId),[B]);assert.equal(D.taskOf(p).parentTaskId,p.tasks[2].id);
  assert.ok(D.begin(p).request.sources.some(s=>s.text==='늦은 A 보고'));
  assert.ok(!D.begin(p).request.sources.some(s=>s.taskId===B));
  assert.deepEqual(outcomeOf(parseProject(serializeProject(p))).otherRequests,view.otherRequests);
});

test('FIX053 return work keeps its effective request and exclusion in current bases, not past-only references',()=>{
  const original='예약 취소 기능을 만들어줘. 환불은 이번 범위 아님';
  const report='테스트 2개 실패, 남은 일: 실패 수정';
  let source=put(D.createProject(),original);const taskId=source.currentTaskId,requestId=source.sources[0].id,basisId=source.bases[0].id;
  source=D.markHandoff(source,taskId,D.handoffText(source,taskId,'H_fix053'),'download',source.revision,'H_fix053');
  for(const kind of ['report','evidence','file']) {
    const p=kind==='file'?D.importResultFile(source,JSON.stringify(fileFor(source,taskId,'H_fix053',report,null))):put(source,report,kind);
    const snapshot=serializeProject(p),wire=D.begin(p).request,handoff=D.handoffText(p);
    assert.equal(D.taskOf(p).parentTaskId,taskId);
    assert.ok(handoff.includes(`이번 요청 [${requestId}]이 실행 범위를 정합니다`));
    const start=handoff.indexOf('## 이어갈 기준'),past=handoff.indexOf('## 이전 요청 원문 참조');
    const current=handoff.slice(start,past<0?handoff.indexOf('## 결과를 가져올 때'):past);
    assert.ok(current.includes(`[${basisId}]`),`${kind}: effective request must remain a current basis`);
    assert.ok(current.includes(original),`${kind}: preserve both requested work and refund exclusion`);
    assert.ok(past<0||!handoff.slice(past).includes(original),`${kind}: do not also classify it as past-only`);
    assert.ok(handoff.includes(report));
    assert.deepEqual(D.buildRequest(p,wire.ticket),wire,'handoff classification must not alter transport');
    assert.equal(serializeProject(p),snapshot);
  }
});
