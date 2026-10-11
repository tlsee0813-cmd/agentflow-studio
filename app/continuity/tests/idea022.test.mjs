// IDEA022: record projection and transport boundaries, not model-quality assertions.
// All customer data are synthetic. The B05 reply below is the supplied stored Cloud excerpt,
// replayed as data; no new model call or UUID/timestamp-exact Cloud run reproduction is claimed.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as D from '../dist/public/shared/domain.js';
import { API_SCHEMA, SCHEMA, FILE_LIMIT, REQUEST_BYTES } from '../dist/public/shared/types.js';
import { validateProject, parseProject, validateRequest, validateAdvice } from '../dist/public/shared/validation.js';
import { ProjectStore, STORAGE_KEY, serializeProject } from '../dist/public/shared/storage.js';
import { mockAdvice } from '../server/mock.mjs';
import { buildBody } from '../server/prompt.mjs';
import { createContinuityApp } from '../server/app.mjs';
import { readConfig } from '../../server/config.mjs';
import { getCase } from '../../../experiments/idea016/cases.mjs';
import { synthetic, longRequests, cycles, toLegacy } from './fixtures.mjs';

const clone=v=>structuredClone(v), bytes=v=>Buffer.byteLength(JSON.stringify(v));
const submit=(p,text,kind='request')=>D.submit(D.editDraft(D.setKind(p,kind),text));
const facts=p=>D.planFacts(p), current=p=>facts(p).records.filter(f=>f.isCurrent);
const record=(p,id)=>current(p).find(f=>f.basisId===id);
const state=()=>D.createProject();
function respond(p,patch={}) {
  const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:{...mockAdvice(s.request),...patch}});
}
let savedFetch;
before(()=>{savedFetch=globalThis.fetch;globalThis.fetch=()=>assert.fail('External fetch forbidden; inject a synthetic response explicitly');});
after(()=>{globalThis.fetch=savedFetch;});
function freeze(v) {if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function evidence(name,p,extra={}) {
  const dir=process.env.IDEA022_EVIDENCE;if(!dir)return;
  mkdirSync(join(dir,name),{recursive:true});
  const s=D.begin(p),items={
    'project.json':p,'request-app.json':s.request,'app-facts.json':facts(p),
    'handoff.md':D.handoffText(p),'observation.json':{synthetic:true,liveCalls:0,...extra}
  };
  for(const [file,value] of Object.entries(items))writeFileSync(join(dir,name,file),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
}
const PHOTO_OLD='촬영 사이 준비 간격은 8분이다. 기존 예약 일괄 변경과 외부 배포는 하지 않는다.';
const PHOTO_REQUEST='사진관 촬영 사이 준비 간격을 8분에서 26분으로 계획에서만 바꿔 주세요. 이번에는 기준 문구만 수정하는 요청이며 예약 가능 시간 계산 코드나 기존 예약은 바꾸지 않습니다. 외부 배포도 요청하지 않습니다.';
function frozenCase(basis,request,name) {
  let p=D.rename(state(),name);
  p=submit(p,'합성 고객의 기존 계획 기록입니다. '+basis);
  p=D.recordBasis(p,basis,'confirmed','D1');
  return submit(p,request);
}
const b05=()=>frozenCase(PHOTO_OLD,PHOTO_REQUEST,'[합성 IDEA019-B] 사진관/현재8분/명시변경미반영');
const B05_ADVICE={
  understanding:'현재 요청은 사진관 촬영 사이 준비 간격을 계획 문구에서 8분→26분으로 바꾸는 것만이며, 코드·기존 예약·외부 배포는 범위 밖이다.',
  scope:'이번 범위: 기준 문구의 준비 간격 값을 26분으로 수정. 유지: 기존 예약 일괄 변경 금지, 외부 배포 금지, 예약 가능 시간 계산 코드는 손대지 않음.',
  next:'계획값 반영 자체는 앱 기준(D2)으로 요청된 문구 수정 범위이며, 이 요청 범위에서 남은 필수 작업은 없다. 코드·예약·배포 변경은 요청되지 않았으므로 진행하지 않는다.',
  checks:'계획 문구의 준비 간격이 26분으로 표시되는지 확인한다.\n기존 예약 일괄 변경이나 외부 배포가 발생하지 않았는지 확인한다.\n예약 가능 시간 계산 코드가 변경되지 않았는지 확인한다.',
  question:null,relatedBasisIds:['D1','D2'],reviewBasisIds:['D1'],suggestions:[]
};

test('I22-C05 real narrow submit records 60 days before AI; status, history and manual checks survive',()=>{
  const c=getCase('C05');let p=submit(state(),c.stages[0].input.text);
  for(const b of c.stages[0].basisBefore)p=D.recordBasis(p,b.text,b.status,b.id);
  p=respond(p,{next:'30일로 구현할 과거 합성 AI 문구'});
  for(const [k,v] of Object.entries(c.stages[0].manualAfter))p=D.editTask(p,p.currentTaskId,k,v);
  const old=clone(p.bases[0]);
  p=submit(p,c.stages[1].input.text);
  const f=record(p,'D1');
  assert.deepEqual(f,{basisId:'D1',sourceId:p.sources.at(-1).id,revision:p.revision,status:'confirmed',versionIndex:2,isCurrent:true,kind:'basis-recorded',previousRevision:old.revision,changedFields:['text']});
  assert.equal(p.bases[0].text,'반납 완료 기록은 60일 뒤 목록에서 숨긴다. 실제 데이터 삭제는 하지 않는다.');
  assert.deepEqual(p.bases[0].history.at(-1),{text:old.text,status:old.status,sourceId:old.sourceId,revision:old.revision});
  const r=D.begin(p).request;assert.deepEqual(r.appFacts,facts(p));validateRequest(r);
  assert.equal(r.previousWork.aiTextExcluded,true);assert.equal(r.previousWork.next,'');
  assert.equal(r.previousWork.checks,c.stages[0].manualAfter.checks);
  assert.ok(D.handoffText(p).includes(D.planFactsText(r.appFacts)));
  assert.equal(D.begin(p).project.notice,null,'facts survive begin clearing transient notice');
  evidence('C05',p,{boundary:'narrow command recorded before AI, not external execution'});
});

test('I22-B05 supplied exact prose and domain assembly retain confirmed D1 r6 / requested D2 r9',()=>{
  const p=b05(),r=D.begin(p).request,f=facts(p);
  assert.equal(p.bases[0].text,PHOTO_OLD);assert.equal(p.bases[0].status,'confirmed');assert.equal(p.bases[0].revision,6);
  assert.equal(p.bases[1].text,PHOTO_REQUEST);assert.equal(p.bases[1].status,'requested');assert.equal(p.bases[1].revision,9);
  assert.equal(f.records.length,1);assert.equal(f.records[0].basisId,'D2');assert.equal(f.records[0].kind,'input-retained');
  assert.equal(f.records[0].changedFields,null);assert.equal(f.records[0].previousRevision,null);
  assert.equal(r.bases[0].previousVersions,1);assert.equal(r.bases[1].previousVersions,0);validateProject(p);validateRequest(r);
  evidence('B05-before',p,{source:'supplied freeze-b.mjs API sequence and exact request; generated IDs/times, no stored-run replay'});
});

test('I22-B05 no-work next AND D1 review coexist; receive never promotes or replaces bases',()=>{
  const p=b05(),s=D.begin(p),before=serializeProject(p),f=facts(p);
  validateAdvice(B05_ADVICE,['D1','D2']);
  const after=D.receive(s.project,s.request,{mode:'deepseek',ticket:s.request.ticket,advice:B05_ADVICE});
  assert.deepEqual(after.bases,p.bases);assert.deepEqual(after.sources,p.sources);assert.deepEqual(facts(after),f);
  assert.equal(serializeProject(p),before);assert.equal(D.taskOf(after).advice.next,B05_ADVICE.next);
  assert.deepEqual(D.taskOf(after).advice.reviewBasisIds,['D1']);
  const h=D.handoffText(after);assert.ok(h.includes(B05_ADVICE.next));assert.match(h,/재검토 제안 \(자동 폐기 아님\): D1/);
  assert.ok(h.includes(PHOTO_OLD));assert.ok(h.includes(D.planFactsText(f)));
  assert.ok(!JSON.stringify(f).includes('done'));assert.ok(!JSON.stringify(f).includes('applied'));
  evidence('B05-stored-reply',after,{replyOrigin:'supplied IDEA019 assistant excerpt replayed as data, not a fresh model result'});
});

test('I22-B03 matching current goal plus requested record is not an automatic incomplete/complete decision',()=>{
  const title='온라인 강좌 확인서의 제목은 “강좌 참여 확인서”다. 자동 발송과 기존 확인서 재발급은 하지 않는다.';
  const request='온라인 강좌 확인서 제목을 “학습 확인서”에서 “강좌 참여 확인서”로 계획에서만 바꿔 주세요. 이번에는 기준 문구만 수정하며 실제 문서 템플릿 수정, 자동 발송, 기존 확인서 재발급은 요청하지 않습니다.';
  const p=frozenCase(title,request,'[합성] 강좌 확인서'),f=facts(p);
  assert.equal(p.bases[0].text,title);assert.equal(p.bases[0].status,'confirmed');assert.equal(p.bases[1].status,'requested');
  assert.equal(f.records.length,1);assert.equal(f.records[0].kind,'input-retained');
  assert.deepEqual(Object.keys(f).sort(),['inputs','records','taskId']);
  assert.deepEqual(Object.keys(f.records[0]).sort(),['basisId','changedFields','isCurrent','kind','previousRevision','revision','sourceId','status','versionIndex']);
  const b=clone(p.bases);
  const after=respond(p,{scope:'이번 범위는 확인서 제목 기준 문구 변경뿐이다. 실제 문서 템플릿 수정, 자동 발송, 기존 확인서 재발급은 하지 않는다.',
    checks:"D1의 문구가 '강좌 참여 확인서'로 유지되는지, 자동 발송·재발급 관련 언급이 기준에 남아 있지 않은지 확인한다. 실제 문서 템플릿·발송·재발급 상태는 이번 입력 근거로 확인되지 않았으므로 미확인으로 둔다."});
  assert.deepEqual(after.bases,b);assert.deepEqual(facts(after),f);
  evidence('B03',after,{scopeAndChecks:'supplied field excerpts, remaining mock fields are developer-written; contradictory wording is not repaired'});
});

test('I22-partial composite request preserves other bases, full request and manual checks while only D1 is recorded',()=>{
  let p=submit(state(),'공유 작업실 장비 점검 도구를 준비해 주세요.');
  p=D.recordBasis(p,'점검 간격은 12시간이다. 운영 장비는 건드리지 않는다.','confirmed','D1');
  p=D.recordBasis(p,'목록 제목은 장비 기록이다.','confirmed');
  const unchanged=clone(p.bases[1]);
  const prose='점검 간격은 18시간, 제목은 작업실 점검으로 바꾸고 실제 화면 수정 작업문도 준비해 주세요. 운영 장비는 건드리지 않습니다.';
  p=submit(p,prose);p=D.editTask(p,p.currentTaskId,'checks','내 조건: 실제 장비 제어 없음. 빈 목록에도 제목이 보임.');
  const before=clone(p),manual=clone(D.taskOf(p).manual);
  p=D.recordBasis(p,'점검 간격은 18시간이다. 운영 장비는 건드리지 않는다.','confirmed','D1');
  assert.deepEqual(p.bases[1],unchanged);assert.deepEqual(p.bases[2],before.bases[2]);assert.deepEqual(D.taskOf(p).manual,manual);
  const f=facts(p);assert.equal(f.records.length,2);assert.equal(record(p,'D1').kind,'basis-recorded');assert.equal(record(p,'D3').kind,'input-retained');
  assert.deepEqual(record(p,'D1').changedFields,['text']);assert.equal(record(p,'D2'),undefined);
  assert.ok(D.handoffText(p).includes(prose));assert.ok(D.handoffText(p).includes(manual.checks));validateRequest(D.begin(p).request);
  evidence('partial',p,{boundary:'one basis record, remaining request and manual checks unchanged'});
});

test('I22-same-values/status-only recordings report actual fields, not semantic completion',()=>{
  let p=submit(state(),'편집 모음 도구 시작');p=D.recordBasis(p,'기록은 지우지 않는다.','confirmed','D1');
  p=D.recordBasis(p,p.bases[0].text,'confirmed','D1');
  let f=record(p,'D1');assert.equal(f.kind,'basis-recorded');assert.deepEqual(f.changedFields,[]);assert.ok(f.previousRevision<f.revision);
  assert.match(D.planFactsText(facts(p)),/text\/status 동일값 재기록/);
  p=D.recordBasis(p,p.bases[0].text,'deferred','D1');f=record(p,'D1');assert.equal(f.status,'deferred');assert.deepEqual(f.changedFields,['status']);
  p=D.recordBasis(p,'기록은 지우지 않고 별도 목록으로 이동한다.','confirmed','D1');assert.deepEqual(record(p,'D1').changedFields,['text','status']);
  const r=D.begin(p).request;validateRequest(r);
  for(const f of r.appFacts.records)assert.equal(f.isCurrent,f.versionIndex===p.bases[0].history.length);
  evidence('same-values',p);
});

test('I22-new manual basis records a value without pretending there was a replaced predecessor',()=>{
  let p=submit(state(),'방문 기록 목록을 준비해 주세요.');
  p=D.recordBasis(p,'원본 방문 기록은 삭제하지 않는다.','confirmed');
  const r=D.begin(p).request,f=record(p,'D2');
  assert.equal(f.kind,'basis-recorded');assert.equal(f.previousRevision,null);assert.equal(f.changedFields,null);
  assert.equal(f.versionIndex,0);assert.equal(f.isCurrent,true);assert.equal(f.status,'confirmed');
  assert.equal(facts(p).inputs.at(-1).kind,'manual_decision');assert.equal(record(p,'D1').kind,'input-retained');
  validateRequest(r);const bad=clone(r);bad.appFacts.records.find(x=>x.basisId==='D2').changedFields=[];
  assert.throws(()=>validateRequest(bad));
});

test('I22-narrow modification of an answered record keeps the existing answered-to-requested rule',()=>{
  let p=respond(submit(state(),'방송 전 대기 화면을 준비해 주세요.'),{question:{kind:'choice',text:'얼마 동안 기다릴까요?',why:'사용자 선택',options:[]}});
  p=D.answer(p,p.currentTaskId,'13초','provided');assert.equal(record(p,'D2').kind,'input-retained');
  p=submit(p,'D2를 21초로 변경해줘');
  const f=record(p,'D2');assert.equal(f.kind,'basis-recorded');assert.equal(f.status,'requested');
  assert.deepEqual(f.changedFields,['text','status']);validateRequest(D.begin(p).request);
});

test('I22-old-task facts reference historical versions and cannot replace current bases',()=>{
  let p=submit(state(),'녹음 연습 도구 시작');p=D.recordBasis(p,'예고음 대기는 17초다. 저장된 녹음은 건드리지 않는다.','confirmed','D1');
  const oldTask=p.currentTaskId;p=submit(p,'D1을 23초로 바꿔줘');
  const f=D.planFacts(p,oldTask);assert.ok(f.records.length===2&&f.records.every(x=>!x.isCurrent));
  const old=D.begin(p,oldTask).request;assert.deepEqual(old.appFacts,f);validateRequest(old);
  assert.equal(old.bases[0].text,p.bases[0].text);assert.match(old.bases[0].text,/23초/);
  assert.ok(D.handoffText(p,oldTask).includes(D.planFactsText(f)));assert.match(D.planFactsText(f),/과거 history\[1\]/);
  assert.ok(!D.planFactsText(f).includes(p.bases[0].history[1].text),'no second copy of original text in summary');
  evidence('novel-audio',p);
});

test('I22-quoted wording change on requested basis keeps requested status, no inference of confirmation',()=>{
  let p=submit(state(),'실험 노트 목록의 제목은 입고 검사이다. 원본 노트는 보존한다.');
  p=submit(p,"D1의 '입고 검사'를 '검수 메모'로 바꿔줘");
  assert.equal(p.bases.length,1);assert.equal(p.bases[0].text,'실험 노트 목록의 제목은 검수 메모이다. 원본 노트는 보존한다.');
  const f=record(p,'D1');assert.equal(f.status,'requested');assert.equal(f.kind,'basis-recorded');assert.deepEqual(f.changedFields,['text']);
  assert.deepEqual(D.begin(p).request.appFacts,facts(p));evidence('novel-notebook',p);
});

test('I22-missing or unordered history stays reference-only; absent provenance is not silently reconstructed',()=>{
  let p=submit(state(),'간격은 3분이다.');p=submit(p,'D1을 9분으로 수정해줘');
  const lost=clone(p);lost.bases[0].history=[];validateProject(lost);
  let f=record(lost,'D1');assert.equal(f.kind,'version-only');assert.equal(f.previousRevision,null);assert.equal(f.changedFields,null);
  assert.equal(f.isCurrent,true);assert.equal(f.status,'requested');validateRequest(D.begin(lost).request);
  const broken=clone(p);broken.bases[0].history[0].revision=broken.bases[0].revision;validateProject(broken);
  f=record(broken,'D1');assert.equal(f.kind,'version-only');validateRequest(D.begin(broken).request);
  validateRequest(D.begin(broken,broken.tasks[0].id).request);
  const first=submit(state(),'추가 이력이 보이지 않는 원문');assert.equal(record(first,'D1').kind,'input-retained');
  // A deleted earlier history which leaves an otherwise indistinguishable first snapshot cannot be detected.
  assert.equal(record(first,'D1').previousRevision,null);evidence('missing-history',lost);
});

test('I22-answer and test_answer retain their existing provenance; synthetic answers never become basis facts',()=>{
  const question={kind:'fact',text:'현재 들리는 안내음은 무엇인가요?',why:'이미 관찰한 사실만 연결',options:[]};
  for(const trial of [false,true]) {
    let p=respond(submit(state(),'안내음이 예상과 달라요.'),{question});
    p=D.answer(p,p.currentTaskId,'지금은 모르겠습니다.','unknown',trial);
    const f=facts(p),s=p.sources.at(-1);assert.equal(s.kind,trial?'test_answer':'answer');assert.equal(s.disposition,'unknown');
    assert.equal(f.inputs.at(-1).kind,s.kind);
    const r=f.records.find(x=>x.sourceId===s.id);
    if(trial)assert.equal(r,undefined);else {assert.equal(r.kind,'input-retained');assert.equal(r.status,'answered');assert.equal(r.changedFields,null);}
    validateRequest(D.begin(p).request);
  }
});

test('I22-report/evidence-only input is visible as input, never a record of external execution or a new basis',()=>{
  let p=respond(submit(state(),'직원 안내 목록의 오타를 고치는 작업문을 준비해 주세요.'));
  p=D.markHandoff(p,p.currentTaskId,D.handoffText(p),'download');const b=clone(p.bases);
  for(const kind of ['report','evidence']) {
    p=submit(p,'담당자 제공: 수정과 검사 완료, 다음에는 알림 기능도 추천함.',kind);
    const f=facts(p);assert.deepEqual(f.records,[]);assert.equal(f.inputs[0].kind,kind);
    const r=D.begin(p).request;assert.deepEqual(r.appFacts,f);validateRequest(r);
    p=respond(p,{next:'개발자가 이미 완료했다고 보고했으므로 남은 일이 없습니다.'});
    assert.deepEqual(p.bases,b);assert.deepEqual(facts(p),f);assert.match(D.handoffText(p),/앱 미검증/);
  }
  evidence('report-only',p);
});

test('I22-pure projection, handoff and request neither mutate nor share writable objects with project',()=>{
  const p=freeze(b05()),snapshot=serializeProject(p);
  const f=D.planFacts(p),r=D.begin(p).request,h=D.handoffText(p);
  assert.deepEqual(r.appFacts,f);assert.ok(h.includes(D.planFactsText(f)));
  f.inputs[0].kind='evidence';f.records[0].status='confirmed';r.appFacts.records[0].changedFields=['status'];
  assert.equal(serializeProject(p),snapshot);assert.equal(record(p,'D2').status,'requested');
  assert.ok(!Object.hasOwn(p,'appFacts'));assert.equal(p.schemaVersion,SCHEMA);
  assert.deepEqual(D.planFacts(parseProject(snapshot)),D.planFacts(p));
});

test('I22-write failure leaves current-memory facts separate from last persisted snapshot and recovery bytes',()=>{
  const data=new Map();let fail=false;
  const storage={getItem:k=>data.get(k)??null,setItem(k,v){if(fail)throw Object.assign(new Error('quota'),{name:'QuotaExceededError'});data.set(k,v);}};
  const store=new ProjectStore(storage);store.load();
  let p=submit(state(),'연속 표시 간격은 7초입니다.');p=D.recordBasis(p,'표시 간격은 7초다. 원본 파일은 보존한다.','confirmed','D1');
  store.save(p);const saved=data.get(STORAGE_KEY),oldFacts=facts(p);
  p=submit(p,'D1을 11초로 변경해줘');const currentFacts=facts(p),raw=serializeProject(p);fail=true;
  assert.throws(()=>store.save(p),/quota/);assert.equal(data.get(STORAGE_KEY),saved);assert.deepEqual(facts(parseProject(saved)),oldFacts);
  assert.deepEqual(facts(p),currentFacts);assert.deepEqual(facts(parseProject(raw)),currentFacts);assert.equal(serializeProject(p),raw);
  assert.notDeepEqual(oldFacts,currentFacts);assert.ok(!Object.hasOwn(currentFacts,'saved'));
  assert.match(D.planFactsText(currentFacts),/브라우저 저장 성공.*아닙니다/);evidence('storage-failed-memory',p,{storageWrite:'failed',previousSavedBytesRetained:true});
});

test('I22-input API is strict, cross-linked, copy-safe and rejects old/missing/forged shape without repairing it',()=>{
  let p=submit(state(),'대기 간격은 4초다.');p=submit(p,'D1을 8초로 변경해줘');
  const r=D.begin(p).request;assert.equal(API_SCHEMA,'idea022.context.4');validateRequest(r);
  const mutations=[
    v=>v.schemaVersion='idea017.context.3',v=>delete v.appFacts,v=>v.appFacts.complete=true,v=>v.appFacts.taskId='T_other',
    v=>v.appFacts.inputs=[],v=>v.appFacts.inputs.push(clone(v.appFacts.inputs[0])),v=>v.appFacts.inputs[0].kind='manual_decision',
    v=>v.appFacts.records=[],v=>v.appFacts.records.push(clone(v.appFacts.records[0])),
    v=>v.appFacts.records[0].basisId='D999',v=>v.appFacts.records[0].sourceId='S_missing',
    v=>v.appFacts.records[0].status='confirmed',v=>v.appFacts.records[0].isCurrent=false,
    v=>v.appFacts.records[0].versionIndex=100,v=>v.appFacts.records[0].revision=v.ticket.revision+1,
    v=>v.appFacts.records[0].previousRevision=v.appFacts.records[0].revision,
    v=>v.appFacts.records[0].changedFields=['period'],v=>v.appFacts.records[0].changedFields=['text','text'],
    v=>v.appFacts.records[0].changedFields=null,v=>v.appFacts.records[0].kind='applied',
    v=>v.appFacts.records[0].kind='input-retained',v=>v.appFacts.records[0].kind='version-only',
    v=>v.appFacts.records[0].done=true,
  ];
  for(const mutate of mutations){const bad=clone(r);mutate(bad);const unchanged=clone(bad);assert.throws(()=>validateRequest(bad));assert.deepEqual(bad,unchanged);}
  const c=validateRequest(r);c.appFacts.records[0].changedFields=[];assert.deepEqual(r.appFacts.records[0].changedFields,['text']);
  const a=mockAdvice(r);assert.equal(Object.keys(a).length,8);assert.throws(()=>validateAdvice({...a,appFacts:r.appFacts},['D1']));
});

test('I22-reference validation is not authentication of imported history or semantic completion',()=>{
  let p=submit(state(),'기록 갱신 간격은 3분이다.');p=submit(p,'D1을 9분으로 변경해줘');
  const req=D.begin(p).request,unverifiable=clone(req);
  // Prior texts are deliberately not copied to the wire; the server cannot recompute this delta.
  unverifiable.appFacts.records[0].changedFields=[];assert.doesNotThrow(()=>validateRequest(unverifiable));
  assert.deepEqual(record(p,'D1').changedFields,['text'],'local calculator still derives actual available-field differences');
  assert.equal(facts(p).records[0].revision,p.bases[0].revision);
});

function boundaryProject() {
  // Use protected edited snapshots so the exact bound cannot be met by dropping current facts.
  const p=synthetic(12,'가'.repeat(2700));
  for(const b of p.bases)b.history=[{text:b.text,status:b.status,sourceId:b.sourceId,revision:b.revision}];
  let left=REQUEST_BYTES-bytes(D.begin(p).request);assert.ok(left>0);
  for(let i=0;left>0&&i<p.bases.length-2;i++) {const n=Math.min(left,11900-p.bases[i].text.length);p.bases[i].text+='x'.repeat(n);p.sources[i].text=p.bases[i].text;left-=n;}
  assert.equal(left,0);return p;
}
test('I22-all facts count toward exact 128KiB; +1 fails, while marked excerpts and local 8MB boundary remain separate',()=>{
  const p=boundaryProject(),req=D.begin(p).request;assert.equal(bytes(req),REQUEST_BYTES);validateRequest(req);
  const without=clone(req);delete without.appFacts;assert.ok(bytes(without)<REQUEST_BYTES);
  const over=clone(p);over.bases[0].text+='x';over.sources[0].text=over.bases[0].text;
  const raw=serializeProject(over);assert.throws(()=>D.begin(over),/CONTEXT_TOO_LARGE/);assert.deepEqual(parseProject(raw),over);
  assert.ok(Buffer.byteLength(raw)<FILE_LIMIT);assert.equal(FILE_LIMIT,8_000_000);assert.ok(D.handoffText(over).includes(over.bases[0].text));
  const oversized=clone(req);oversized.projectName+='x';assert.equal(bytes(oversized),REQUEST_BYTES+1);assert.throws(()=>validateRequest(oversized),/CONTEXT_TOO_LARGE/);
  const long=longRequests(100),before=serializeProject(long),r=D.begin(long).request;
  assert.ok(r.bases.some(b=>b.partial));assert.ok(r.bases.slice(-2).every(b=>!b.partial));assert.ok(bytes(r)<=REQUEST_BYTES);
  assert.deepEqual(r.appFacts,facts(long));assert.equal(serializeProject(long),before);validateRequest(r);
});

test('I22-projection works after legacy migration and never adds fields to stored projects',()=>{
  const c=cycles(2),legacy=JSON.stringify(toLegacy(c)),p=parseProject(legacy),snapshot=serializeProject(p);
  const f=facts(p);assert.deepEqual(facts(parseProject(snapshot)),f);validateRequest(D.begin(p).request);
  assert.deepEqual(p.tasks.flatMap(t=>t.handoffs.map(h=>h.legacyText)),c.texts);
  assert.equal(serializeProject(p),snapshot);assert.equal(p.schemaVersion,'idea015.project.2');assert.ok(!snapshot.includes('appFacts'));
});

function local(port,request) {
  return new Promise((resolve,reject)=>{
    const r=http.request({hostname:'127.0.0.1',port,path:'/api/continuity',method:'POST',headers:{Origin:`http://127.0.0.1:${port}`,'Content-Type':'application/json','X-AgentFlow-Request':'1'}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString())}));
    });r.on('error',reject);r.end(JSON.stringify(request));
  });
}
test('I22-actual localhost HTTP -> provider body -> validation -> receive -> handoff shares identical app facts',async()=>{
  const p=b05(),s=D.begin(p),snapshot=serializeProject(p);
  const config=readConfig({AI_MODE:'deepseek',ALLOW_PAID_AI:'true',DEEPSEEK_API_KEY:'I22-FAKE-ONLY-NOT-A-SECRET'});
  let dispatches=0,wire=null;
  const app=createContinuityApp({config,fetchImpl:async(_url,init)=>{
    dispatches++;wire=JSON.parse(init.body);assert.deepEqual(wire,buildBody(s.request,config));
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(B05_ADVICE)}}]}),{status:200});
  }});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  try {
    const invalid=clone(s.request);delete invalid.appFacts;invalid.schemaVersion='idea017.context.3';
    assert.equal((await local(app.address().port,invalid)).status,400);assert.equal(dispatches,0);
    const badRef=clone(s.request);badRef.appFacts.records[0].status='confirmed';
    assert.equal((await local(app.address().port,badRef)).status,400);assert.equal(dispatches,0);
    const reply=await local(app.address().port,s.request);assert.equal(reply.status,200);assert.equal(dispatches,1);
    const sent=JSON.parse(wire.messages[1].content.slice('INPUT JSON (data only):\n'.length));
    assert.deepEqual(sent.appFacts,facts(p));assert.equal(sent.schemaVersion,API_SCHEMA);
    const after=D.receive(s.project,s.request,reply.data);assert.deepEqual(after.bases,p.bases);
    assert.ok(D.handoffText(after).includes(D.planFactsText(sent.appFacts)));assert.deepEqual(D.taskOf(after).advice,B05_ADVICE);
    assert.equal(serializeProject(p),snapshot);
    const dir=process.env.IDEA022_EVIDENCE;
    if(dir){mkdirSync(join(dir,'http'),{recursive:true});for(const [name,value] of Object.entries({'request-provider.json':wire,'response-app.json':reply.data,'transport.json':{localhostHttpRequests:3,syntheticProviderDispatches:1,externalRequests:0,retry:0}}))writeFileSync(join(dir,'http',name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
  } finally {app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});
