import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, editDraft, submit, begin, receive, answer, taskOf, recordBasis, editBasisDraft, editTask, markHandoff, handoffText, setKind, editSuggestion, editAuxDraft, currentWork, rename } from '../dist/public/shared/domain.js';
import { stageOf, exportNeedsRefresh, taskTitle, sourceOf, sourceName, basisDraftChanged, workOrigin } from '../dist/public/client/presentation.js';
import { mockAdvice } from '../server/mock.mjs';
const request = (text='문구만 바꿔줘.') => submit(editDraft(createProject(),text));
function organised(p) {const started=begin(p);return receive(started.project,started.request,{mode:'mock',ticket:started.request.ticket,advice:mockAdvice(started.request)});}
const stage = p => stageOf(p,p.currentTaskId?taskOf(p):null);

test('UI001-P1 stage labels distinguish source preservation, API response waiting and prepared work; none claims execution',()=>{
  assert.equal(stage(createProject()).kind,'empty');const p=request();assert.equal(stage(p).kind,'saved');
  const started=begin(p);assert.equal(stage(started.project).kind,'pending');assert.match(stage(started.project).label,/응답/);
  const ready=organised(p);assert.equal(stage(ready).kind,'ready');assert.equal(stage(ready).step,2);
  assert.doesNotMatch(JSON.stringify(stage(ready)),/구현 완료|실행 중|연결됨/);
});
test('UI001-P2 an unanswered question is primary; recorded unknown is not a completion or confirmed policy',()=>{
  let p=organised(request('결제가 실패하는 오류가 있어요.'));assert.equal(stage(p).kind,'question');
  p=answer(p,p.currentTaskId,'지금은 모릅니다.','unknown');assert.notEqual(stage(p).kind,'question');
  p=organised(p);assert.equal(stage(p).kind,'ready');assert.equal(p.sources.at(-1).disposition,'unknown');
  assert.doesNotMatch(stage(p).label,/완료/);
});
test('UI001-P3 real export metadata changes next action; editing a work field asks for recopy, typing a separate draft does not',()=>{
  let p=organised(request());p=markHandoff(p,p.currentTaskId,handoffText(p),'download');
  assert.equal(stage(p).kind,'exported');assert.equal(stage(p).step,3);assert.equal(exportNeedsRefresh(p,taskOf(p)),false);
  p=editDraft(p,'아직 보내지 않은 다른 요청');
  p=editAuxDraft(p,'answerDraft','아직 기록하지 않은 답변');
  p=editAuxDraft(p,'basisDraft','아직 기록하지 않은 기준');
  p=editBasisDraft(p,p.bases[0].id,'아직 적용하지 않은 기준 수정');p=setKind(p,'evidence');
  assert.equal(stage(p).kind,'exported');assert.equal(exportNeedsRefresh(p,taskOf(p)),false);
  p=editTask(p,p.currentTaskId,'next','직접 고친 이번 작업');assert.equal(stage(p).kind,'ready');assert.match(stage(p).label,/수정/);
  assert.equal(exportNeedsRefresh(p,taskOf(p)),true);assert.match(workOrigin(taskOf(p)),/직접 수정 포함/);
});
test('UI001-P4 stale state remains explicit even with a saved handoff and a preserved manual instruction',()=>{
  let p=organised(request());p=editTask(p,p.currentTaskId,'next','사용자 직접 작업문');
  p=markHandoff(p,p.currentTaskId,handoffText(p),'download');p=recordBasis(p,'이번에는 다른 확정 조건');
  assert.equal(stage(p).kind,'stale');assert.equal(taskOf(p).manual.next,'사용자 직접 작업문');
});
test('UI001-P5 report/source labels stay attributed and titles derive from actual source rather than invented task names',()=>{
  let p=organised(request());p=markHandoff(p,p.currentTaskId,handoffText(p),'download');
  p=submit(editDraft(setKind(p,'report'),'구현자는 완료라고 보고함. 클릭 검사는 하지 않았음.'));p=organised(p);
  const t=taskOf(p);assert.equal(sourceOf(p,t).kind,'report');assert.match(sourceName.report,/미검증/);
  assert.equal(taskTitle(p,t),'구현자는 완료라고 보고함. 클릭 검사는 하지 않았음.');assert.match(stage(p).next,/판정은 아닙니다/);
});
test('UI001-P6 editing-draft indicators do not change confirmed values or mutate any project data',()=>{
  let p=recordBasis(organised(request()),'확정한 조건');const b=p.bases.at(-1);
  p=editBasisDraft(p,b.id,'아직 기록 버튼을 누르지 않은 문구');const before=JSON.stringify(p);
  assert.equal(basisDraftChanged(p,b),true);stage(p);workOrigin(taskOf(p));taskTitle(p,taskOf(p));
  assert.equal(JSON.stringify(p),before);assert.equal(p.bases.at(-1).text,'확정한 조건');
  p=editBasisDraft(p,b.id,b.text);assert.equal(basisDraftChanged(p,b),false);
});

test('UI001-P7 changed HTML/CSS and the new presentation module are served by the existing real local HTTP path',async()=>{
  const {createContinuityApp}=await import('../server/app.mjs');
  const {readConfig}=await import('../../server/config.mjs');
  const {get}=await import('node:http');
  const server=createContinuityApp({config:readConfig({AI_MODE:'mock',PORT:'0',ALLOW_PAID_AI:'false'}),fetchImpl:()=>assert.fail('No external requests allowed')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const port=server.address().port;
    for(const [path,marker,mime] of [['/','id="compose-panel"','text/html'],['/styles.css','.workspace','text/css'],['/client/app.js','./presentation.js','text/javascript'],['/client/presentation.js','stageOf','text/javascript']]){
      const result=await new Promise((resolve,reject)=>{get({hostname:'127.0.0.1',port,path},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString()}));}).on('error',reject);});
      assert.equal(result.status,200,path);assert.ok(result.headers['content-type'].startsWith(mime),path);assert.ok(result.text.includes(marker),path);
      assert.match(result.headers['content-security-policy'],/script-src 'self'/);
    }
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

// UI001 rev1: synthetic advice goes through the real receive path; no model calls.
function withSuggestion() {
  const started=begin(request());
  return receive(started.project,started.request,{mode:'mock',ticket:started.request.ticket,
    advice:{...mockAdvice(started.request),suggestions:[{text:'전달 전 문구를 한 번 더 읽어보세요.',why:'오탈자를 찾는 데 도움이 됩니다.'}]}});
}
const exported=p=>markHandoff(p,p.currentTaskId,handoffText(p),'download');
function expectFresh(p,message) {
  const before=JSON.stringify(p);
  assert.equal(exportNeedsRefresh(p,taskOf(p)),false,message);
  assert.equal(stage(p).kind,'exported',message);
  assert.equal(JSON.stringify(p),before,'UI projection must not mutate the project or its revision');
}

test('UI001-P8 rev1 full handoff detects suggestion text/why and inclusion changes, clears on re-export, ignores equal content',()=>{
  const initial=withSuggestion(),base=exported(initial),original=taskOf(base).advice.suggestions[0];
  expectFresh(base,'recording the export itself must not make it stale');
  for(const [key,value] of [['text','전달 전 바뀐 문구와 범위를 확인하세요.'],['why','누락된 조건을 전달 전에 발견할 수 있습니다.']]) {
    const changed=editSuggestion(base,base.currentTaskId,0,key,value);
    assert.deepEqual(currentWork(changed,taskOf(changed)).values,taskOf(base).handoffs.at(-1).work,'the four work fields did not change');
    assert.equal(exportNeedsRefresh(changed,taskOf(changed)),true,key);
    assert.equal(stage(changed).kind,'ready',key);assert.equal(stage(changed).label,'내보낸 뒤 수정됨',key);
    assert.ok(handoffText(changed).includes(value),key);
    expectFresh(editSuggestion(changed,changed.currentTaskId,0,key,original[key]),'reverting to identical delivered content is not stale');
    expectFresh(exported(changed),'re-exported '+key);
  }
  // Existing state contract: null uses advice; [] excludes suggestions. No new toggle/contract.
  const same=structuredClone(base);taskOf(same).suggestions=structuredClone(taskOf(same).advice.suggestions);
  expectFresh(same,'identical manual suggestions do not change the delivered content');
  const excluded=structuredClone(base);taskOf(excluded).suggestions=[];
  assert.equal(exportNeedsRefresh(excluded,taskOf(excluded)),true,'removing the included suggestion');
  assert.ok(!handoffText(excluded).includes(original.text));
  const without=exported(excluded);expectFresh(without,'re-export without suggestions');
  const included=structuredClone(without);taskOf(included).suggestions=null;
  assert.equal(exportNeedsRefresh(included,taskOf(included)),true,'including it again');
  expectFresh(exported(included),'re-export with suggestions');
  // Existing UI path: stale AI suggestions are excluded until the user edits one.
  const stale=exported(recordBasis(initial,'바뀐 기준: 문구만 수정한다.'));
  assert.deepEqual(currentWork(stale,taskOf(stale)).suggestions,[]);
  assert.equal(exportNeedsRefresh(stale,taskOf(stale)),false);
  const edited=editSuggestion(stale,stale.currentTaskId,0,'text',original.text);
  assert.equal(exportNeedsRefresh(edited,taskOf(edited)),true,'same text now included in the handoff');
  assert.equal(stage(edited).kind,'stale','existing stale-basis priority is unchanged');
  const reexported=exported(edited);assert.equal(exportNeedsRefresh(reexported,taskOf(reexported)),false);
});

test('UI001-P9 rev1 compares other delivered context as well, keeps legacy conservative, uses the selected task without writes',()=>{
  const base=exported(withSuggestion());
  const renamed=rename(base,'변경된 프로젝트 이름');
  assert.equal(exportNeedsRefresh(renamed,taskOf(renamed)),true,'project name is part of the handoff');expectFresh(exported(renamed));
  const reviewed=structuredClone(base);taskOf(reviewed).advice.reviewBasisIds=[base.bases[0].id];
  assert.equal(exportNeedsRefresh(reviewed,taskOf(reviewed)),true,'review references are part of the handoff');expectFresh(exported(reviewed));
  const legacy=structuredClone(base);taskOf(legacy).handoffs.at(-1).work=null;
  assert.equal(exportNeedsRefresh(legacy,taskOf(legacy)),true,'legacy handoff without work snapshot stays conservative');
  const parent=base.currentTaskId;
  let next=organised(submit(editDraft(setKind(base,'report'),'구현자 보고: 문구만 바꿨다고 함.')));
  next=exported(next);
  const oldTask=taskOf(next,parent);
  const before=JSON.stringify(next);
  assert.equal(exportNeedsRefresh(next,oldTask),false,'projection uses its task argument, not the current task');
  assert.equal(JSON.stringify(next),before);
  next=editTask(next,parent,'scope','직전 작업에 직접 기록한 전달 조건');
  assert.equal(exportNeedsRefresh(next,taskOf(next)),true,'previous work in the full handoff changed');
  expectFresh(exported(next));
});
