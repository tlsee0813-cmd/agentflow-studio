import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, editDraft, submit, begin, receive, answer, taskOf, recordBasis, editBasisDraft, editTask, markHandoff, handoffText, setKind, editSuggestion, editAuxDraft, currentWork, rename, returnTargetId } from '../dist/public/shared/domain.js';
import { stageOf, exportNeedsRefresh, taskTitle, sourceOf, sourceName, basisDraftChanged, workOrigin, returnPreview } from '../dist/public/client/presentation.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { ProjectStore, serializeProject } from '../dist/public/shared/storage.js';
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
  // FLOW094-R1: the MOCK asks the fact question only when the user says the cause is unknown (no incident assumed from a word).
  let p=organised(request('결제가 실패하는 오류가 있어요. 원인은 아직 모르겠어요.'));assert.equal(stage(p).kind,'question');
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
    for(const [path,marker,mime] of [['/','id="viewport"','text/html'],['/styles.css','.viewport','text/css'],['/client/app.js','./map-layout.js','text/javascript'],['/client/presentation.js','stageOf','text/javascript']]){
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

// RETURN032: immutable display projections over the existing records, never semantic verdicts.
const asReturn=(p,kind='report')=>setKind(p,kind);
function freeze(value) {
  if(value && typeof value==='object') {Object.freeze(value);for(const v of Object.values(value))freeze(v);}
  return value;
}
test('RETURN032-R1 array order remains the parent contract, including a later re-export of an older task',()=>{
  let p=exported(request('첫 번째 문구 수정'));
  const first=p.currentTaskId;
  p=exported(submit(editDraft(p,'두 번째 문구 수정')));
  const second=p.currentTaskId;
  p=markHandoff(p,first,handoffText(p,first),'download');
  // Distinct observed times make a mistaken timestamp-based selection detectable.
  taskOf(p,first).handoffs.at(-1).at='2026-10-13T03:00:00.000Z';
  taskOf(p,second).handoffs.at(-1).at='2026-10-13T02:00:00.000Z';
  p=submit(editDraft(p,'내보내지 않은 세 번째 요청'));
  const third=p.currentTaskId;
  const before=serializeProject(p);
  assert.equal(returnTargetId(freeze(p)),second);
  for(const kind of ['report','evidence','request','test_answer']) {
    const ready=editDraft(setKind(p,kind),'돌아온 원문 또는 다음 요청');
    const preview=returnPreview(freeze(ready)),result=submit(ready);
    assert.equal(taskOf(result).parentTaskId,['report','evidence'].includes(kind)?second:third);
    if(['report','evidence'].includes(kind)) {
      assert.equal(preview.targetTaskId,second);assert.equal(preview.targetTitle,'두 번째 문구 수정');
      assert.equal(preview.exportedAt,'2026-10-13T02:00:00.000Z');
    } else {assert.equal(preview.kind,'hidden');assert.equal(preview.targetTaskId,null);}
  }
  assert.equal(serializeProject(p),before);
});
test('RETURN032-R2 no prior task and no export stay distinct without blocking returned sources',()=>{
  for(const p of [createProject(),request('아직 내보내지 않은 요청')]) {
    const ready=editDraft(asReturn(p),'자유 형식 결과'),preview=returnPreview(freeze(ready));
    assert.equal(preview.kind,p.currentTaskId?'no-export':'no-target');
    assert.equal(preview.targetTaskId,p.currentTaskId);assert.equal(preview.exportedAt,null);
    assert.equal(preview.recordedBases,null);
    const saved=submit(ready);assert.equal(taskOf(saved).parentTaskId,p.currentTaskId);
    assert.equal(saved.sources.at(-1).kind,'report');assert.equal(saved.sources.at(-1).text,'자유 형식 결과');
  }
});
test('RETURN032-R3 drafts and bookkeeping are not basis records; same-value recording and re-export have exact boundaries',()=>{
  let p=recordBasis(request(),'기존 예약 순서 유지');
  const basisId=p.bases.at(-1).id;
  p=asReturn(exported(p));
  assert.deepEqual(returnPreview(p).recordedBases,[]);
  p=editDraft(p,'아직 제출하지 않은 결과');p=editAuxDraft(p,'basisDraft','새 기준 초안');
  p=editAuxDraft(p,'answerDraft','미제출 답');p=editBasisDraft(p,basisId,'수정 초안');p=rename(p,'새 이름');
  assert.deepEqual(returnPreview(p).recordedBases,[]);
  p=recordBasis(p,'기존 예약 순서 유지','confirmed',basisId);
  const preview=returnPreview(freeze(p));
  assert.equal(preview.kind,'comparable');assert.deepEqual(preview.recordedBases.map(b=>b.id),[basisId]);
  assert.equal(preview.recordedBases[0].text,p.bases.at(-1).history.at(-1).text,'identical text is still a recording');
  assert.equal(preview.recordedBases[0].status,'confirmed');
  p=exported(p);assert.deepEqual(returnPreview(p).recordedBases,[]);
  p=recordBasis(p,'순서 변경은 보류한다.','deferred',basisId);
  assert.deepEqual(returnPreview(p).recordedBases.map(b=>[b.id,b.status,b.text]),[[basisId,'deferred','순서 변경은 보류한다.']]);
});
test('RETURN032-R4 every basis status and all records are preserved without relevance selection or a small cap',()=>{
  let p=exported(organised(request('결제가 실패하는 오류가 있어요. 원인은 아직 모르겠어요.'))); // FLOW094-R1: same question fixture
  p=answer(p,p.currentTaskId,'관찰한 오류는 없습니다.','unknown'); // Fresh question, not the separate C investigation.
  p=recordBasis(p,'예약 순서 유지');p=recordBasis(p,'추가 정책은 보류','deferred');
  p=submit(editDraft(setKind(p,'request'),'다른 화면에 관한 새 요청'));
  for(let i=0;i<10;i++)p=recordBasis(p,`별개 기준 ${i}`);
  const preview=returnPreview(asReturn(p,'evidence'));
  assert.equal(preview.kind,'comparable');assert.equal(preview.recordedBases.length,14);
  assert.deepEqual(new Set(preview.recordedBases.map(b=>b.status)),new Set(['answered','confirmed','deferred','requested']));
  assert.ok(preview.recordedBases.some(b=>b.text==='다른 화면에 관한 새 요청'),'no inferred relevance filtering');
});
test('RETURN032-R5 legacy, missing work, invalid export revisions and unordered basis histories are unknown, never zero',()=>{
  let base=recordBasis(exported(request()),'기준 1');
  base=recordBasis(base,'기준 2','confirmed',base.bases.at(-1).id);
  base=recordBasis(base,'기준 3','confirmed',base.bases.at(-1).id);
  const mutations=[
    p=>{taskOf(p).handoffs.at(-1).legacyText='이전 작업문';},
    p=>{taskOf(p).handoffs.at(-1).work=null;},
    p=>{taskOf(p).handoffs.at(-1).revision=p.revision+1;},
    p=>{taskOf(p).handoffs.at(-1).revision=-1;},
    p=>{taskOf(p).handoffs.at(-1).revision=0.5;},
    p=>{p.bases.at(-1).history.reverse();},
    p=>{p.bases.at(-1).history[1].revision=p.bases.at(-1).history[0].revision;},
    p=>{p.bases.at(-1).revision=p.revision+1;}
  ];
  for(const mutate of mutations) {
    const p=asReturn(structuredClone(base));mutate(p);const before=serializeProject(p),preview=returnPreview(freeze(p));
    assert.equal(preview.kind,'unknown');assert.equal(preview.recordedBases,null);
    assert.equal(preview.targetTaskId,base.currentTaskId);assert.equal(serializeProject(p),before);
  }
  // The real old-schema parser owns migration. This feature only reads its migrated result.
  const old=JSON.parse(serializeProject(base));old.schemaVersion='idea015.project.1';delete old.pasted;delete old.space; // project.1 predates the plan space
  for(const b of old.bases)b.locked=false;
  for(const t of old.tasks) {delete t.adviceRevision;delete t.resultFile;delete t.background;t.handoffs=t.handoffs.map(h=>({at:h.at,method:h.method,revision:h.revision,text:'보존된 이전 작업문'}));}
  const migrated=parseProject(JSON.stringify(old));
  assert.equal(returnPreview(asReturn(migrated)).kind,'unknown');
  assert.equal(taskOf(migrated).handoffs.at(-1).legacyText,'보존된 이전 작업문');
});
test('RETURN032-R6 projection leaves handoff text, manual values, source bytes and recovery data untouched',()=>{
  let p=request('원문 <b>그대로</b> 보존');const target=p.currentTaskId;
  p=editTask(p,target,'scope','직접 쓴 범위 유지');p=editTask(p,target,'checks','직접 쓴 확인 조건 유지');
  p=exported(p);p=asReturn(recordBasis(p,'새 기준은 원문으로 보존'));
  const raw=serializeProject(p),handoff=handoffText(p),sources=structuredClone(p.sources),manual=structuredClone(taskOf(p).manual);
  const expected=returnPreview(freeze(p));
  assert.equal(serializeProject(p),raw);assert.equal(handoffText(p),handoff);
  const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  const store=new ProjectStore(storage);store.load();store.save(p);
  const reopened=new ProjectStore(storage).load(),imported=parseProject(raw);
  assert.deepEqual(returnPreview(reopened),expected);assert.deepEqual(returnPreview(imported),expected);
  assert.deepEqual(reopened.sources,sources);assert.deepEqual(taskOf(reopened).manual,manual);
  assert.equal(serializeProject(reopened),raw,'projection adds no persisted fields');
  const saved=submit(editDraft(reopened,'구현자가 완료라고 주장함. 실제 검사는 미실행.'));
  assert.equal(taskOf(saved).parentTaskId,target);assert.equal(sourceName[saved.sources.at(-1).kind],'구현자 보고 · 미검증');
  assert.deepEqual(saved.bases,p.bases);assert.deepEqual(taskOf(saved,target).manual,manual);
  assert.deepEqual(saved.sources.slice(0,sources.length),sources);
});
