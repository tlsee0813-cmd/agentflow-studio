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

test('F049 long chain retains only starting request, not old answers/reports; stale question rejection remains atomic',()=>{
  let p=respond(put(D.createProject(),'빈자리가 생기면 대기자를 자동으로 예약해줘.'));const root=p.currentTaskId,origin=outcomeOf(p).origin;
  p=D.answer(p,root,'참여 확인 뒤 확정. 미응답은 보류.');
  p=D.markHandoff(p,root,D.handoffText(p),'download');p=put(p,'OLD_RETURN_NOT_CURRENT','report');
  for(let i=0;i<4;i++)p=put(p,`명확한 문구 변경 ${i}`);
  const r=D.begin(p).request;assert.ok(r.sources.some(s=>s.id===origin.id));assert.ok(!r.sources.some(s=>s.text==='OLD_RETURN_NOT_CURRENT'));
  assert.ok(r.bases.some(b=>b.text.includes('미응답은 보류')));
  let q=respond(put(D.createProject(),'빈자리가 생기면 대기자를 자동으로 예약해줘.'));
  q=D.recordBasis(q,'자동 확정은 하지 않는다.');const before=serializeProject(q);
  assert.equal(D.questionApplicability(q,D.taskOf(q)),'stale');assert.throws(()=>D.answer(q,q.currentTaskId,'바로 확정'),/QUESTION_NOT_APPLICABLE/);
  assert.equal(serializeProject(q),before);assert.equal(outcomeOf(q).originBases.length,1);
});
