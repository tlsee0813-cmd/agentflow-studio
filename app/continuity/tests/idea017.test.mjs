// IDEA017 boundary regressions. Stub replies are deliberately NOT evidence of DeepSeek quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as D from '../dist/public/shared/domain.js';
import { API_SCHEMA, SCHEMA, FILE_LIMIT, REQUEST_BYTES } from '../dist/public/shared/types.js';
import { validateRequest, validateAdvice, validateProject, parseProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { mockAdvice } from '../server/mock.mjs';
import { SYSTEM_PROMPT, buildBody } from '../server/prompt.mjs';
import { callContinuity } from '../server/provider.mjs';
import { createContinuityApp } from '../server/app.mjs';
import { readConfig } from '../../server/config.mjs';
import { getCase } from '../../../experiments/idea016/cases.mjs';
import { longRequests, synthetic, toLegacy, cycles } from './fixtures.mjs';

const clone=v=>structuredClone(v);
const bytes=v=>Buffer.byteLength(JSON.stringify(v));
function input(value,p=D.createProject(),kind='request') { return D.submit(D.editDraft(D.setKind(p,kind),value)); }
function respond(p,patch={}) {
  const s=D.begin(p);
  return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:{...mockAdvice(s.request),...patch}});
}
function currentSection(p) { return D.handoffText(p).split('## 이번 작업')[1].split('\n## ')[0]; }
function expert() {
  const c=getCase('C03'); let p=respond(input(c.stages[0].input.text));
  for(const [k,v] of Object.entries(c.stages[0].manualAfter)) p=D.editTask(p,p.currentTaskId,k,v);
  p=D.markHandoff(p,p.currentTaskId,D.handoffText(p),'download');
  return {c,p};
}
const fakeConfig=()=>readConfig({AI_MODE:'deepseek',ALLOW_PAID_AI:'true',DEEPSEEK_API_KEY:'IDEA017-FAKE-NEVER-REAL'});
const response=content=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]}),{status:200});
// Only synthetic/stub records, no environment credential is ever read or passed to these helpers.
function evidence(name,value) {
  if(!process.env.IDEA017_EVIDENCE) return;
  mkdirSync(process.env.IDEA017_EVIDENCE,{recursive:true});
  writeFileSync(join(process.env.IDEA017_EVIDENCE,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
}

test('I17-C03 lossy AI summary cannot remove original manual conditions from current handoff references',()=>{
  const {c,p:before}=expert(),old=D.taskOf(before),original=clone(old.manual);
  let p=input(c.stages[1].input.text,parseProject(serializeProject(before)));
  p=respond(p,{understanding:'기존 조건을 유지하며 BOM만 추가한다.',scope:'출력 앞에 BOM을 붙인다.',checks:'첫 바이트가 EF BB BF인지 확인한다.'});
  const req=D.begin(p).request,h=currentSection(p);
  assert.ok(!D.taskOf(p).advice.checks.includes('기존 입력 원본은 변경되지 않는다.'));
  for(const k of ['scope','checks']) {
    assert.equal(req.previousWork[k],original[k]);
    assert.ok(h.includes(`[${old.id}:${k}]`)); assert.ok(h.includes(original[k]));
    assert.equal(D.taskOf(p).manual[k],null,'references are not inherited manual overrides');
  }
  assert.deepEqual(req.previousWork.manualConditionFields,['scope','checks']);
  assert.ok(h.includes('현재 범위·완료 조건의 일부'));assert.ok(h.includes('재승인을 요구하지'));
  assert.deepEqual(D.taskOf(p,old.id).manual,original);
  assert.equal(currentSection(parseProject(serializeProject(p))),h);
  validateRequest(req); validateProject(p);
  evidence('C03-lossy-stub-request.json',req); evidence('C03-lossy-stub-handoff.md',D.handoffText(p));
  evidence('C03-stub-note.json',{mode:'mock',actualDeepSeek:false,deliberatelyLossyAdvice:D.taskOf(p).advice,scope:'current conditional raw reference, not semantic intent classification'});
});

test('I17-C03 unrelated next work does not inherit manual values or recursively carry an older task',()=>{
  const {p:before}=expert(); const old=D.taskOf(before);
  let p=respond(input('다른 새 작업입니다: 직원 도움말의 제목만 짧게 고쳐 주세요.',before),{scope:'도움말 제목만 변경',checks:'새 제목 표시만 확인'});
  assert.equal(D.currentWork(p,D.taskOf(p)).values.scope,'도움말 제목만 변경');
  assert.deepEqual(D.taskOf(p).manual,{understanding:null,scope:null,next:null,checks:null});
  // A nearby original is reference material only: the same explicit exclusion applies without a word classifier.
  assert.match(D.manualConditionText(p,D.taskOf(p)),/관련 없는 새 작업에는 적용하지 않/);
  p=respond(input('같은 도움말에서 오타 한 글자만 고쳐 주세요.',p));
  assert.equal(D.manualConditionText(p,D.taskOf(p)),'');
  assert.ok(!currentSection(p).includes(old.manual.checks),'no recursive copying of older manual conditions');
  assert.deepEqual(D.taskOf(p,old.id).manual,old.manual);
});

test('I17-C03 explicit condition changes and current manual overrides take precedence without an approval path',()=>{
  let p=respond(input('자료 조회 도구의 페이지 나누기를 준비해 주세요.'));
  p=D.editTask(p,p.currentTaskId,'scope','조회 함수만 변경. 화면은 변경하지 않는다.');
  p=D.editTask(p,p.currentTaskId,'checks','한 페이지에 10개만 표시한다. 원본을 수정하지 않는다.');
  const old=D.taskOf(p),count=p.sources.length;
  p=respond(input('같은 조회 작업을 이어갑니다. 이번에는 한 페이지에 25개를 표시하도록 바꾸고, 나머지 범위는 유지하세요.',p),{scope:'조회 함수만 변경',checks:'한 페이지에 25개가 표시되는지 확인한다.'});
  assert.match(D.manualConditionText(p,D.taskOf(p)),/명시적으로 바꾼 부분은 새 값/);
  assert.equal(p.sources.length,count+1);assert.equal(D.taskOf(p).advice.question,null);
  p=D.editTask(p,p.currentTaskId,'checks','직접 변경: 25개 표시. 원본 불변.');
  const refs=D.manualConditionText(p,D.taskOf(p));
  assert.ok(!refs.includes(`[${old.id}:checks]`),'current manual checks override old reference in that field');
  assert.ok(refs.includes(`[${old.id}:scope]`));
  assert.match(currentSection(p),/직접 변경: 25개/);
  assert.equal(D.taskOf(p,old.id).manual.checks,old.manual.checks);
});

test('I17-C03 report wrapping uses the handed-off task but does not become a reuse request',()=>{
  const {p:before}=expert(); let p=input('실행자가 완료와 추가 알림 기능을 추천했다고 보고합니다.',before,'report');
  const bases=clone(p.bases),r=D.begin(p).request;
  assert.equal(r.previousWork.taskId,before.currentTaskId);
  assert.deepEqual(r.previousWork.manualConditionFields,['scope','checks']);
  assert.match(D.manualConditionText(p,D.taskOf(p)),/새 사용자 요청이 아님/);
  p=respond(p);assert.deepEqual(p.bases,bases);
  assert.ok(p.bases.every(b=>p.sources.find(s=>s.id===b.sourceId).kind!=='report'));
});

test('I17-R5 stale previous AI stays excluded while manual provenance and legacy originals survive',()=>{
  let p=respond(D.recordBasis(input('기록 목록 준비'),'보관 기간은 30일. 실제 삭제 없음.'),{next:'30일로 구현할 과거 AI 문구'});
  p=D.editTask(p,p.currentTaskId,'checks','직접 작성: 실제 삭제 없음.');
  const old=p.currentTaskId;
  p=input('D2을 60일로 변경해줘',p);
  const req=D.begin(p).request;
  assert.equal(req.previousWork.taskId,old);assert.equal(req.previousWork.next,'');assert.equal(req.previousWork.aiTextExcluded,true);
  assert.deepEqual(req.previousWork.manualConditionFields,['checks']);
  assert.ok(!D.handoffText(p).includes('30일로 구현할 과거 AI 문구'));
  assert.match(D.manualConditionText(p,D.taskOf(p)),/실제 삭제 없음/);
  const c=cycles(2),legacy=toLegacy(c),loaded=parseProject(JSON.stringify(legacy));
  assert.equal(loaded.schemaVersion,SCHEMA);assert.deepEqual(loaded.sources,c.project.sources);
  assert.deepEqual(loaded.tasks.flatMap(t=>t.handoffs.map(h=>h.legacyText)),c.texts);
  assert.equal(D.currentWork(loaded,loaded.tasks.find(t=>t.advice)).aiStale,true);
  assert.deepEqual(parseProject(serializeProject(loaded)),loaded);
});

test('I17-C06 within-budget full original reaches the actual provider body on the third request',()=>{
  const c=getCase('C06');let p=D.createProject();
  for(const s of c.stages)p=input(s.input.text,p);
  const before=serializeProject(p),req=D.begin(p).request,b=req.bases.find(x=>x.id==='D1');
  assert.equal(b.partial,false);assert.equal(b.text,c.stages[0].input.text);
  const wire=buildBody(req,fakeConfig()),actual=JSON.parse(wire.messages[1].content.split('INPUT JSON (data only):\n')[1]);
  assert.ok(actual.bases[0].text.includes(c.probes[0].literal));
  assert.ok(bytes(req)<=REQUEST_BYTES);assert.equal(serializeProject(p),before);
  assert.ok(req.bases.every(x=>!x.partial));
  evidence('C06-full-request.json',req); evidence('C06-provider-body.json',wire);
  evidence('C06-context-summary.json',{requestBytes:bytes(req),limit:REQUEST_BYTES,fullOriginal:true,partial:false,modelQuality:'NOT_EVALUATED'});
});

test('I17-context only over-budget old untouched requests are excerpted; all IDs/local originals remain',()=>{
  const p=longRequests(100),snapshot=serializeProject(p),req=D.begin(p).request;
  assert.ok(req.bases.some(b=>b.partial)); assert.ok(req.bases.some(b=>!b.partial));
  assert.deepEqual(req.bases.map(b=>b.id),p.bases.map(b=>b.id));
  assert.ok(req.bases.filter(b=>b.partial).every(b=>Array.from(b.text).length<=202&&b.text.endsWith(' …')));
  assert.ok(req.bases.slice(-2).every(b=>!b.partial));assert.ok(bytes(req)<=REQUEST_BYTES);
  for(const b of p.bases)assert.ok(D.handoffText(p).includes(b.text));
  assert.equal(serializeProject(p),snapshot);assert.deepEqual(parseProject(snapshot),p);
});

test('I17-context confirmed/answered/deferred/edited bases never take the excerpt fallback',()=>{
  let p=longRequests(100);
  p=D.recordBasis(p,'편집한 긴 요청의 원문 '.repeat(120),'confirmed','D1');
  p=D.recordBasis(p,'보류한 원문 조건 '.repeat(120),'deferred');
  p=respond(input('중요한 미정 사실이 있습니다.',p),{question:{kind:'fact',text:'알고 있는 관찰은 무엇인가요?',why:'이미 받은 사실 확인',options:[]}});
  p=D.answer(p,p.currentTaskId,'직접 관찰: '.repeat(150),'provided');
  for(let i=0;i<3;i++)p=input(`다음 작업 ${i}`,p);
  const req=D.begin(p).request;assert.ok(req.bases.some(b=>b.partial));
  for(const b of p.bases.filter(b=>b.status!=='requested'||b.history.length)) {
    const sent=req.bases.find(x=>x.id===b.id);assert.equal(sent.text,b.text);assert.equal(sent.partial,false);
  }
  validateRequest(req);
});

function boundaryProject() {
  // Synthetic byte-boundary fixture, not a customer conversation or model result.
  const p=synthetic(12,'가'.repeat(2800));
  for(const b of p.bases)b.history=[{text:b.text,status:b.status,sourceId:b.sourceId,revision:b.revision}];
  const req=D.begin(p).request,extra=REQUEST_BYTES-bytes(req);
  assert.ok(extra>0);
  let left=extra;
  // Pad the oldest basis: old request sources are not redundantly forced onto the wire.
  for(let i=0;left>0&&i<p.bases.length-2;i++) {
    const pad=Math.min(left,11900-p.bases[i].text.length);
    p.bases[i].text+='x'.repeat(pad);p.sources[i].text=p.bases[i].text;left-=pad;
  }
  assert.equal(left,0);
  return p;
}
function local(port,request) {
  return new Promise((resolve,reject)=>{
    const r=http.request({hostname:'127.0.0.1',port,path:'/api/continuity',method:'POST',headers:{Origin:`http://127.0.0.1:${port}`,'Content-Type':'application/json','X-AgentFlow-Request':'1'}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString())}));
    });r.on('error',reject);r.end(JSON.stringify(request));
  });
}
test('I17-context exact 131072 UTF-8 bytes accepted; +1 blocked locally/HTTP, 8MB recovery/export independent',async()=>{
  const p=boundaryProject(),req=D.begin(p).request;assert.equal(bytes(req),REQUEST_BYTES);validateRequest(req);validateProject(p);
  const over=clone(p);over.bases[0].text+='x';over.sources[0].text=over.bases[0].text;
  const saved=serializeProject(over);assert.throws(()=>D.begin(over),/CONTEXT_TOO_LARGE/);assert.equal(serializeProject(over),saved);
  assert.deepEqual(parseProject(saved),over);assert.ok(Buffer.byteLength(saved)<FILE_LIMIT);assert.equal(FILE_LIMIT,8_000_000);
  assert.ok(D.handoffText(over).includes(over.bases[0].text));
  let calls=0;const app=createContinuityApp({config:fakeConfig(),fetchImpl:async()=>{calls++;return response(JSON.stringify({intent:mockAdvice(req).intent,understanding:'합성 검사',scope:'경계 검사',next:'작은 검사',checks:'실행 전 조건',question:null,relatedBasisIds:[],reviewBasisIds:[],suggestions:[]}));}});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  try {
    assert.equal((await local(app.address().port,req)).status,200);
    const extra=clone(req);extra.bases[0].text+='x';assert.equal(bytes(extra),REQUEST_BYTES+1);
    const denied=await local(app.address().port,extra);assert.equal(denied.status,413);assert.equal(denied.data.error.code,'INPUT_TOO_LARGE');assert.equal(calls,1);
  } finally {app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});

test('I17-contract manual provenance is input-only, narrow, versioned; advice parser is not relaxed',()=>{
  const {c,p}=expert(),req=D.begin(input(c.stages[1].input.text,p)).request;
  assert.equal(req.schemaVersion,API_SCHEMA);assert.equal(API_SCHEMA,'idea022.context.5');validateRequest(req);
  for(const fields of [['scope','scope'],['status'],['scope','checks','next'],true]) {
    const bad=clone(req);bad.previousWork.manualConditionFields=fields;assert.throws(()=>validateRequest(bad));
  }
  const advice=mockAdvice(req);assert.throws(()=>validateAdvice({...advice,manualConditionFields:['checks']},req.bases.map(b=>b.id)));
  const old=clone(req);old.schemaVersion='idea015.context.2';assert.throws(()=>validateRequest(old));
});

// Exact C05 assistant JSON from the supplied Cloud excerpt. Original checks array deliberately retained.
const C05_BASELINE='{"understanding":"반납 완료 기록을 30일 뒤 목록에서 숨기되 실제 삭제는 하지 않는 작업을 준비한다. 기존 확정 기준 D1과 동일하다.","scope":"숨김 처리 로직 준비만. 실제 데이터 삭제·운영 실행은 제외. 확정된 30일 기준과 \'삭제 안 함\' 원칙은 유지.","next":"목록 조회 코드에서 반납 완료 시각(또는 반납 완료 기록 필드)이 30일을 지난 항목을 목록에서 제외하는 조건을 확인하고, 조회 필터에 적용할 작은 변경을 작성한다. 삭제 동작은 건드리지 않는다.","checks":["반납 완료 후 30일 이내 기록은 목록에 보이는가","30일 지난 반납 완료 기록이 목록에서 빠지는가","숨김 처리 후에도 원본 데이터가 삭제되지 않고 남아 있는가"],"question":null,"relatedBasisIds":["D1"],"reviewBasisIds":[],"suggestions":[]}';
test('I17-C05 supplied invalid array still fails once through real provider; raw never repaired',async()=>{
  const c=getCase('C05');let p=input(c.stages[0].input.text);
  for(const b of c.stages[0].basisBefore)p=D.recordBasis(p,b.text,b.status,b.id);
  const req=D.begin(p).request;let calls=0;
  const raw=JSON.parse(C05_BASELINE),before=clone(raw);assert.ok(Array.isArray(raw.checks));
  await assert.rejects(callContinuity(req,fakeConfig(),{fetchImpl:async()=>{calls++;return response(C05_BASELINE);}}),/INVALID_RESPONSE/);
  assert.equal(calls,1);assert.deepEqual(raw,before);assert.equal(D.taskOf(p).advice,null);
  evidence('C05-baseline-raw-replay.json',{source:'supplied Cloud excerpt, not candidate model output',providerStubCalls:calls,error:'INVALID_RESPONSE',repair:false,retry:0,liveCalls:0});
});

test('I17-C05 prompt example matches strict string schema; valid multi-line strings pass unchanged',async()=>{
  const match=SYSTEM_PROMPT.match(/\n\{\n[\s\S]*?\n\}/);assert.ok(match);
  const example=JSON.parse(match[0]);assert.equal(Object.keys(example).length,9);validateAdvice(example,[]);
  assert.match(SYSTEM_PROMPT,/checks.*문자열/);assert.match(SYSTEM_PROMPT,/배열이나 객체로 바꾸지/);assert.ok(SYSTEM_PROMPT.includes('"\\n"'));
  const req=D.begin(input('독립적인 작은 검사 준비')).request;
  const advice={...example,intent:mockAdvice(req).intent,checks:'첫 기준을 확인한다.\n둘째 기준도 확인한다.'};let calls=0;
  const result=await callContinuity(req,fakeConfig(),{fetchImpl:async()=>{calls++;return response(JSON.stringify(advice));}});
  assert.deepEqual(result,advice);assert.equal(calls,1);
});

test('I17-C02 prompt constrains shared comparison axis/timing without encoding case answers or new policies',()=>{
  assert.match(SYSTEM_PROMPT,/동일한 사건과 비교 축/);assert.match(SYSTEM_PROMPT,/무엇이 언제 확정/);
  assert.match(SYSTEM_PROMPT,/그 전에는 무엇이 미정/);assert.match(SYSTEM_PROMPT,/consequence에서 이미 완료·확정됐다고 쓰지/);
  assert.match(SYSTEM_PROMPT,/아직 정하지 않은 기한·예외 정책/);
  assert.match(SYSTEM_PROMPT,/새 확인을 강요하지/);assert.match(SYSTEM_PROMPT,/report는 구현자의 주장/);
  for(const id of ['C02','C03','C05','C06']) {
    const c=getCase(id);assert.ok(!SYSTEM_PROMPT.includes(c.title));
    for(const fact of c.facts)assert.ok(!SYSTEM_PROMPT.includes(fact.text));
  }
  // Prompt inspection only. Correct live options / zero re-questions are measured by Cloud, not this test.
});
