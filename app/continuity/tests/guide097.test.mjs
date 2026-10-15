// GUIDE097: selected area's one-line idea -> at most one question -> a reviewable request draft -> the area's existing request
// draft. Checked as a small contract, not a 200: two answers give different scope/completion, unknown/deferred leave the choice
// open, enough existing information skips the question, nothing is written before adoption, an unsent draft is never replaced,
// replies are bound to their area and material, and the provider path is exercised with a fake upstream (no real AI here).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as D from '../dist/public/shared/domain.js';
import * as G from '../dist/public/shared/guidance.js';
import { validateGuideReply, validateGuideEnvelope, validateGuideRequest } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { mockGuidance, mockAdvice } from '../server/mock.mjs';
import { createContinuityApp } from '../server/app.mjs';
import { GUIDE_PROMPT } from '../server/prompt.mjs';
import { GUIDE_SCHEMA } from '../dist/public/shared/types.js';
import { readConfig } from '../../server/config.mjs';
const PURPOSE='도자기 공방의 원데이 클래스를 온라인으로 예약받는 사이트';
const plan=(note='예약받기',name='예약')=>{const p=D.addArea(D.setBrief(D.createProject(),PURPOSE),name,note);return {p,area:p.space.areas[0].id};};
const ask=(p,area,answer=null)=>{const req=G.buildGuideRequest(p,area,answer);return {req,reply:validateGuideReply(mockGuidance(req),req)};};
const answered=(q,text,disposition='provided')=>({question:q,text,disposition});
const respond=p=>{const s=D.begin(p);return D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});};

test('G097-1 the same idea: one question, two answers give different scope and completion; unknown/deferred keep the choice open',()=>{
  const {p,area}=plan(),first=ask(p,area);
  assert.equal(first.reply.proposal,null);assert.equal(first.reply.question.kind,'choice');assert.equal(first.reply.question.options.length,2);
  assert.ok(G.readOf(first.req).includes('프로젝트 목적'),'the purpose is read');assert.equal(first.req.area.note,'예약받기');
  const q=first.reply.question,[instant,confirm]=q.options.map(o=>ask(p,area,answered(q,o.label)).reply.proposal);
  assert.notEqual(instant.scope,confirm.scope);assert.notEqual(instant.checks,confirm.checks);
  assert.match(instant.scope,/그 자리에서 예약이 확정/);assert.match(confirm.scope,/확인 대기/);assert.match(confirm.checks,/승인한 뒤에만/);
  for(const d of ['unknown','deferred']) {
    const open=ask(p,area,answered(q,d==='unknown'?'모름':'보류',d)).reply.proposal;
    assert.match(open.open.join(' '),new RegExp(`예약 확정 방식 — 사용자 ${d==='unknown'?'모름':'보류'}`));assert.match(open.scope,/접수까지만/);assert.ok(!/그 자리에서 예약이 확정|승인하면 확정/.test(open.scope));
  }
  // A free answer is followed as written, not mapped to an option.
  assert.match(ask(p,area,answered(q,'평일은 바로, 주말은 공방 확인')).reply.proposal.scope,/사용자 답변 원문을 따릅니다: ‘평일은 바로, 주말은 공방 확인’/);
  // The draft text carries the answer-dependent scope and completion.
  const text=G.proposalText('예약',confirm);assert.match(text,/^‘예약’ 영역의 첫 작업을 해 주세요\./);assert.match(text,/이번 범위: .*확인 대기/);assert.match(text,/완료 조건: /);
});

test('G097-2 enough existing information: note, a user decision or an earlier area request already answers it, so no question',()=>{
  // GUIDE097-R1 (R2): these used to assert a confirm/instant draft read out of the free sentence itself. That reading also turned
  // bans and deferrals into a positive choice, so MOCK now quotes the original with what it is (idea / decision) and defers to it.
  const byNote=ask(...Object.values(plan('예약받기 — 공방이 확인 후 확정'))).reply;assert.equal(byNote.question,null);
  assert.ok(byNote.proposal.scope.includes('[영역 구상] ‘예약받기 — 공방이 확인 후 확정’')&&!/확인 대기/.test(byNote.proposal.scope));
  let {p,area}=plan();p=D.recordBasis(D.submit(D.editDraft(p,'사이트 첫 화면 문구를 정해 주세요.'),undefined,null),'예약은 즉시 확정','confirmed');
  const r=ask(p,area);assert.equal(r.reply.question,null);assert.ok(r.reply.proposal.scope.includes('사용자 확정] ‘예약은 즉시 확정’'));assert.ok(!/그 자리에서 예약이 확정/.test(r.reply.proposal.scope));
  assert.ok(G.readOf(r.req).some(x=>x.startsWith('사용자 결정')));
  ({p,area}=plan());p=D.submit(D.editDraft(p,'예약은 공방 승인 후 확정되게 접수 화면을 만들어 주세요.'),undefined,area);
  const w=ask(p,area);assert.equal(w.reply.question,null);assert.equal(w.req.areaWork.length,1);assert.match(w.reply.proposal.open.join(' '),/이전 요청과 겹치는지/);
  assert.match(G.proposalText('예약',w.reply.proposal,!w.req.areaWork.length),/다음 작업/);
  // A non-reservation idea gets a neutral smallest first step from the user's own words, never a question.
  const other=plan('사진으로 작품 소개','작품');const o=ask(other.p,other.area);assert.equal(o.reply.question,null);assert.match(o.reply.proposal.scope,/‘사진으로 작품 소개’에 필요한 가장 작은/);
});

test('G097-3 one question at most: after an answer only a proposal is accepted; exactly one of question/proposal',()=>{
  const {p,area}=plan(),q=ask(p,area).reply.question,req=G.buildGuideRequest(p,area,answered(q,'보류','deferred'));
  assert.throws(()=>validateGuideReply({question:q,proposal:null},req));
  assert.throws(()=>validateGuideReply({question:null,proposal:null},G.buildGuideRequest(p,area,null)));
  assert.throws(()=>validateGuideReply({question:q,proposal:{goal:'g',scope:'s',checks:'c',open:[],defaults:[]}},G.buildGuideRequest(p,area,null)));
  assert.throws(()=>validateGuideReply({question:null,proposal:{goal:'g',scope:'s',checks:'c',open:[],defaults:[],status:'done'}},req),'no extra fields');
});

test('G097-4 nothing is written before adoption; adoption fills only the request draft and never replaces an unsent one',()=>{
  let {p,area}=plan();p=D.submit(D.editDraft(p,'예약 접수 화면을 만들어 주세요.'),undefined,area);p=D.editTask(p,p.currentTaskId,'scope','접수 화면만');
  const before=serializeProject(p),req=G.buildGuideRequest(p,area,null);mockGuidance(req);assert.equal(serializeProject(p),before,'asking writes nothing');
  assert.deepEqual(req.areaWork,[{taskId:p.currentTaskId,request:'예약 접수 화면을 만들어 주세요.',scope:'접수 화면만',checks:null}],'manual scope is read');
  const text='‘예약’ 영역의 다음 작업을 해 주세요.\n이번 범위: 공방 확인 뒤 확정 (사용자가 고침)';
  const n=G.adoptProposal(p,area,text);
  assert.equal(n.draft,text);assert.equal(n.draftKind,'request');assert.deepEqual(n.space.draftTarget,{area});
  for(const k of ['sources','bases','tasks','currentTaskId'])assert.deepEqual(n[k],p[k],k);
  assert.deepEqual(n.space.areas,p.space.areas,'area idea untouched');assert.deepEqual(n.space.brief,p.space.brief);
  const typing=D.editDraft(p,'작성 중인 다른 요청');assert.throws(()=>G.adoptProposal(typing,area,text),/DRAFT_IN_USE/);
  // The adopted draft goes through the existing path: placed in the area, background copy, organised, handed off once.
  const sent=respond(D.submit(n));const t=D.taskOf(sent);
  assert.equal(t.areaId,area);assert.equal(sent.sources.at(-1).text,text);assert.equal(t.background.area.note,'예약받기');
  const h=D.handoffText(sent);assert.equal(h.split(text).length-1,1);assert.ok(h.includes('## 프로젝트 배경·영역 구상'));
});

test('G097-5 a reply is bound to its material and area: purpose/area/decision/answer changes invalidate it, typing a request does not',()=>{
  const {p,area}=plan(),base=G.guideDigest(G.buildGuideRequest(p,area,null));
  assert.equal(G.guideDigest(G.buildGuideRequest(D.editDraft(p,'다른 영역 요청을 쓰는 중'),area,null)),base,'an unrelated draft keeps the reply');
  const q=ask(p,area).reply.question;
  for(const changed of [D.editArea(p,area,'예약','예약받기 — 바로 확정'),D.setBrief(p,`${PURPOSE} (수정)`),D.recordBasis(D.submit(D.editDraft(p,'x')),'예약은 즉시 확정')])
    assert.notEqual(G.guideDigest(G.buildGuideRequest(changed,area,null)),base);
  assert.notEqual(G.guideDigest(G.buildGuideRequest(p,area,answered(q,'바로 확정'))),base);
  // Area crossing: a reply carries its area's ticket; it is refused for another area's request.
  const two=D.addArea(p,'작품','사진으로 작품 소개'),other=two.space.areas[1].id;
  const reqA=G.buildGuideRequest(two,area,null),reqB=G.buildGuideRequest(two,other,null);
  const envA={mode:'mock',ticket:reqA.ticket,reply:mockGuidance(reqA)};
  assert.throws(()=>validateGuideEnvelope(envA,reqB));assert.equal(validateGuideEnvelope(envA,reqA).ticket.areaId,area);
  assert.throws(()=>G.buildGuideRequest(D.setAreaArchived(two,other,true),other,null),/AREA_MISSING/,'an archived area is not guided');
  // A forged request naming one area but carrying another's material is refused.
  assert.throws(()=>validateGuideRequest({...reqA,area:reqB.area}));
});

const cfg=(extra={})=>({...readConfig({AI_MODE:'mock',PORT:'0',AI_REQUESTS_PER_MINUTE:'60',AI_PROCESS_CALL_CAP:'100'}),...extra});
async function withServer(config,fn,options={}) {
  const s=createContinuityApp({config,...options});await new Promise(r=>s.listen(0,'127.0.0.1',r));
  try{return await fn(s.address().port);}finally{s.closeAllConnections();await new Promise(r=>s.close(r));}
}
function post(port,request,headers={}) {
  return new Promise((resolve,reject)=>{const r=http.request({hostname:'127.0.0.1',port,path:'/api/guidance',method:'POST',headers:{Origin:`http://127.0.0.1:${port}`,'Content-Type':'application/json','X-AgentFlow-Request':'1',...headers}},res=>{
    const c=[];res.on('data',x=>c.push(x));res.on('end',()=>{const raw=Buffer.concat(c).toString();resolve({status:res.statusCode,raw,data:JSON.parse(raw)});});});r.on('error',reject);r.end(JSON.stringify(request));});
}
const upstream=content=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]}),{status:200});
const KEY='TEST-NOT-A-REAL-KEY';

test('G097-6 HTTP: MOCK route, same origin checks; fake DeepSeek upstream gets the guidance prompt and the material only',async()=>{
  const {p,area}=plan();
  await withServer(cfg(),async port=>{
    const req=G.buildGuideRequest(p,area,null),r=await post(port,req);assert.equal(r.status,200);assert.equal(r.data.mode,'mock');assert.deepEqual(r.data.ticket,req.ticket);assert.equal(r.data.reply.question.kind,'choice');
    assert.equal((await post(port,G.buildGuideRequest(p,area,null),{origin:'https://outside.invalid'})).status,403);
    assert.equal((await post(port,{...G.buildGuideRequest(p,area,null),extra:1})).status,400);
  },{fetchImpl:()=>assert.fail('no external fetch in MOCK')});
  const calls=[],proposal={goal:'예약 접수',scope:'접수 화면만',checks:'접수 기록 확인',open:[],defaults:[]};
  await withServer(cfg({mode:'deepseek',apiKey:KEY,allowPaid:true}),async port=>{
    const req=G.buildGuideRequest(p,area,null),r=await post(port,req);
    assert.equal(r.status,200);assert.equal(r.data.mode,'deepseek');assert.deepEqual(r.data.reply,{question:null,proposal});assert.ok(!r.raw.includes(KEY));
    const body=JSON.parse(calls[0].init.body);assert.equal(body.messages[0].content,GUIDE_PROMPT);assert.ok(body.messages[1].content.includes(JSON.stringify(req)));
    assert.equal(calls[0].init.headers.Authorization,`Bearer ${KEY}`);assert.equal(body.response_format.type,'json_object');
  },{fetchImpl:async(url,init)=>{calls.push({url,init});return upstream({question:null,proposal});}});
});

test('G097-7 fake upstream failures map to fixed codes; a second question, extra keys or an echoed key are refused; paid off sends nothing',async()=>{
  const {p,area}=plan(),q=ask(p,area).reply.question;
  const cases=[[()=>upstream({question:q,proposal:null}),answered(q,'모름','unknown'),502,'INVALID_RESPONSE'],
    [()=>upstream({question:null,proposal:{goal:'g',scope:'s',checks:'c',open:[],defaults:[]},done:true}),null,502,'INVALID_RESPONSE'],
    [()=>upstream({question:null,proposal:{goal:KEY,scope:'s',checks:'c',open:[],defaults:[]}}),null,502,'INVALID_RESPONSE'],
    [()=>new Response('{}',{status:401}),null,502,'AI_AUTH_FAILED'],[()=>new Response('{}',{status:429}),null,429,'AI_RATE_LIMIT'],
    [()=>{throw new TypeError('network');},null,503,'AI_NETWORK_ERROR']];
  for(const [reply,answer,status,code] of cases)
    await withServer(cfg({mode:'deepseek',apiKey:KEY,allowPaid:true}),async port=>{const r=await post(port,G.buildGuideRequest(p,area,answer));assert.equal(r.status,status);assert.deepEqual(r.data,{error:{code}});assert.ok(!r.raw.includes(KEY));},{fetchImpl:async()=>reply()});
  await withServer(cfg({mode:'deepseek',apiKey:KEY,allowPaid:false}),async port=>{const r=await post(port,G.buildGuideRequest(p,area,null));assert.equal(r.status,503);assert.equal(r.data.error.code,'PAID_CALLS_DISABLED');},{fetchImpl:()=>assert.fail('must not dispatch')});
  // A slow upstream past the timeout is a fixed timeout code; the request is not retried.
  let n=0;await withServer(cfg({mode:'deepseek',apiKey:KEY,allowPaid:true,timeoutMs:100}),async port=>{const r=await post(port,G.buildGuideRequest(p,area,null));assert.equal(r.data.error.code,'AI_TIMEOUT');assert.equal(n,1);},
    {fetchImpl:(_u,init)=>{n++;return new Promise((_r,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));}});
});

// ---------- GUIDE097-R1 (independent review) ----------
const instantText=/그 자리에서 예약이 확정/;
test('G097-8 (R2) MOCK never turns a ban, a deferral, a quote or a free answer into a positive choice; status and wording are kept',()=>{
  const cases=[['예약은 자동 확정하지 않는다. 접수만 받는다.','confirmed','사용자 확정'],['예약 즉시 확정은 보류한다.','deferred','사용자 보류']];
  for(const [text,status,label] of cases) {
    let {p,area}=plan();p=D.recordBasis(D.submit(D.editDraft(p,'사이트 첫 화면 문구를 정해 주세요.'),undefined,null),text,status);
    const r=ask(p,area);assert.equal(r.reply.question,null,'existing material is respected, not asked again');
    const pr=r.reply.proposal,all=`${pr.scope}\n${pr.checks}\n${pr.open.join('\n')}`;
    assert.ok(!instantText.test(all)&&!/승인하면 확정/.test(all),`${text}\n${all}`);assert.ok(pr.scope.includes(`‘${text}’`),'the original wording is quoted as it is');assert.ok(pr.scope.includes(label),'with its status');
    if(status==='deferred')assert.match(pr.open.join(' '),/사용자 보류/);
  }
  // The area idea and an earlier request are quoted as what they are (idea / request), never read as a decision.
  const note=plan('예약받기 — 즉시 확정은 하지 않음'),n=ask(note.p,note.area).reply.proposal;
  assert.ok(!instantText.test(n.scope)&&n.scope.includes('영역 구상')&&n.scope.includes('‘예약받기 — 즉시 확정은 하지 않음’'));
  // A free or quoted answer is followed as written; only the MOCK's own option is mapped to its branch.
  const {p,area}=plan(),q=ask(p,area).reply.question;
  for(const said of ['바로 확정은 안 돼요','“바로 확정”이라고 하지 마세요','공방이 승인하지 않아도 확정']) {
    const pr=ask(p,area,answered(q,said)).reply.proposal;assert.ok(!instantText.test(pr.scope)&&!/확인 대기/.test(pr.scope),said);assert.ok(pr.scope.includes(`‘${said}’`));
  }
  assert.match(ask(p,area,answered(q,q.options[0].label)).reply.proposal.scope,instantText);assert.match(ask(p,area,answered(q,q.options[1].label)).reply.proposal.scope,/확인 대기/);
});

test('G097-9 (R3) blank manual scope/checks are valid as in task edits; length and character checks stay',async()=>{
  let {p,area}=plan();p=D.submit(D.editDraft(p,'예약 접수 화면을 만들어 주세요.'),undefined,area);
  p=D.editTask(D.editTask(p,p.currentTaskId,'scope',''),p.currentTaskId,'checks','   ');
  const req=G.buildGuideRequest(p,area,null);assert.deepEqual([req.areaWork[0].scope,req.areaWork[0].checks],['','   ']);
  await withServer(cfg(),async port=>{const r=await post(port,req);assert.equal(r.status,200);assert.ok(r.data.reply);});
  const w=req.areaWork[0];
  for(const bad of ['x'.repeat(6001),'a\u0001b'])assert.throws(()=>validateGuideRequest({...req,areaWork:[{...w,scope:bad}]}));
  assert.throws(()=>validateGuideRequest({...req,areaWork:[{...w,request:''}]}),'the request text itself is never blank');
});

// ---------- GUIDE097-R2 (narrow re-review) ----------
test('G097-10 (R2-1) many deferred confirmation decisions stay inside the reply contract (max 6 open) and all are named',()=>{
  for(const n of [6,7,40]) {
    let {p,area}=plan();p=D.submit(D.editDraft(p,'사이트 첫 화면 문구를 정해 주세요.'),undefined,null);
    for(let i=1;i<=n;i++)p=D.recordBasis(p,`예약 확정 방식 후보 ${i}는 보류한다.`,'deferred');
    const req=G.buildGuideRequest(p,area,null),reply=validateGuideReply(mockGuidance(req),req),pr=reply.proposal;
    assert.ok(pr.open.length<=6,`${n}: ${pr.open.length}`);
    const named=`${pr.scope}\n${pr.open.join('\n')}`;
    for(const d of req.decisions)assert.ok(new RegExp(`\\b${d.id}\\b`).test(named),`${n}: ${d.id} is named`);
    assert.ok(!instantText.test(named));
  }
});

const LONG=`${'주말 클래스는 인원이 적어서 공방 사정에 따라 시작 시간이 바뀔 수 있으니 고객에게 그 점을 예약 화면에서 충분히 알려 주세요. '.repeat(6)}예약 확정 처리는 금지하고 접수만 받으세요.`;
test('G097-11 (R2-2) a long free answer is kept whole through draft, adoption, request and handoff; its closing ban is never cut',()=>{
  assert.ok(LONG.length>400&&LONG.endsWith('예약 확정 처리는 금지하고 접수만 받으세요.'));
  let {p,area}=plan();const q=ask(p,area).reply.question,ans=answered(q,LONG);
  const req=G.buildGuideRequest(p,area,ans),pr=validateGuideReply(mockGuidance(req),req).proposal;
  assert.ok(!/원문은 기록에 그대로/.test(pr.scope),'no cut quote that claims a record');assert.ok(!instantText.test(pr.scope)&&!/확인 대기/.test(pr.scope));
  const draft=G.proposalText('예약',pr,true,ans);assert.ok(draft.includes(LONG),'the draft carries the whole answer');assert.ok(draft.includes(q.text),'with its question');
  const sent=respond(D.submit(G.adoptProposal(p,area,draft)));
  assert.ok(sent.sources.at(-1).text.includes(LONG),'the user request record holds it');assert.ok(D.handoffText(sent).includes('예약 확정 처리는 금지하고 접수만 받으세요.'));
  // A long existing decision is not cut either: it is named by the basis ID whose whole text every handoff carries.
  let d=D.recordBasis(D.submit(D.editDraft(plan().p,'첫 화면 문구'),undefined,null),LONG,'confirmed');const da=d.space.areas[0].id,did=d.bases.at(-1).id;
  const dp=validateGuideReply(mockGuidance(G.buildGuideRequest(d,da,null)),G.buildGuideRequest(d,da,null)).proposal;
  assert.ok(dp.scope.includes(`원문이 길어 기준 ${did}의 전문을 따름`)&&!/원문은 기록에 그대로/.test(dp.scope)&&!instantText.test(dp.scope));
  assert.ok(D.handoffText(respond(D.submit(G.adoptProposal(d,da,G.proposalText('예약',dp)))) ).includes('예약 확정 처리는 금지하고 접수만 받으세요.'),'the basis itself goes out whole');
  // Short option answers still map to their branch, and the draft names the answer too.
  const opt=answered(q,q.options[1].label),pr2=ask(p,area,opt).reply.proposal;assert.match(pr2.scope,/확인 대기/);assert.match(G.proposalText('예약',pr2,true,opt),/공방 확인 뒤 확정/);
});

// ---------- GUIDE098: reply contract after the actual-model run on fbdcbf1e (evidence commit f03e0594) ----------
// Contract and rendering only. Meaning quality is checked again with the real model by the cloud run, not by MOCK or these tests.
// Actual C2-INITIAL model content, unchanged: a fact question with two options. Still refused; nothing is relaxed.
const C2_ACTUAL="{\"question\":{\"kind\":\"fact\",\"text\":\"미리보기 결과를 어떤 형식으로 출력할까요? (예: 한 줄에 \\\"원래 이름 → 예정 이름\\\", 충돌은 따로 표시)\",\"why\":\"출력 형식에 따라 완료 조건(무엇을 화면에서 확인할지)이 달라집니다.\",\"options\":[{\"label\":\"이름 변경 없음 확인용 사람이 읽기 쉬운 목록\",\"consequence\":\"완료 조건이 '실행 시 각 파일의 원래/예정 이름과 충돌·빈 폴더 안내가 보기 좋게 출력됨'으로 정해집니다.\"},{\"label\":\"스크립트가 읽기 쉬운 단순 텍스트(파이프/탭 구분)\",\"consequence\":\"완료 조건이 '출력이 기계 파싱 가능한 고정 열 형식'으로 정해집니다.\"}]},\"proposal\":null}";
test('G098-1 strict reply contract: fact never has options (actual C2 content), defaults required and bounded, open/defaults never overlap',()=>{
  const {p,area}=plan(),req=G.buildGuideRequest(p,area,null),ok={goal:'g',scope:'s',checks:'c',open:['남길 행 규칙'],defaults:['결과는 화면에 표로 출력']};
  assert.equal(req.schemaVersion,'guidance.2');assert.equal(GUIDE_SCHEMA,'guidance.2');
  assert.throws(()=>validateGuideReply(JSON.parse(C2_ACTUAL),req),'actual fact+options reply refused');
  assert.deepEqual(validateGuideReply({question:null,proposal:ok},req).proposal.defaults,['결과는 화면에 표로 출력']);
  const {defaults:_d,...noDefaults}=ok;assert.throws(()=>validateGuideReply({question:null,proposal:noDefaults},req),'defaults is required (empty allowed)');
  assert.throws(()=>validateGuideReply({question:null,proposal:{...ok,defaults:Array(7).fill('x')}},req));
  assert.throws(()=>validateGuideReply({question:null,proposal:{...ok,defaults:['x'.repeat(501)]}},req));
  assert.throws(()=>validateGuideReply({question:null,proposal:{...ok,defaults:['   ']}},req),'a blank default is not a value');
  assert.throws(()=>validateGuideReply({question:null,proposal:{...ok,defaults:[' 남길 행 규칙 ']}},req),'undecided and defaulted at once');
  assert.ok(validateGuideReply(mockGuidance(req),req),'MOCK replies fit the new contract');
  for(const r of [mockGuidance(req),mockGuidance(G.buildGuideRequest(p,area,answered(ask(p,area).reply.question,'보류','deferred')))])if(r.proposal)assert.deepEqual(r.proposal.defaults,[],'MOCK fills in nothing');
});

test('G098-2 the draft shows AI defaults apart from user decisions (hidden when empty) and explains a changed basis without a re-approval step',()=>{
  const {p,area}=plan(),q=ask(p,area).reply.question;
  const base={goal:'예약 접수',scope:'접수 화면',checks:'접수 기록',open:['승인 기한'],defaults:[]};
  assert.ok(!G.proposalText('예약',base).includes('AI가 정한 기본값'),'no empty defaults line');
  const t=G.proposalText('예약',{...base,defaults:['날짜는 달력으로 고름','목록은 최신순']},true,answered(q,'기존 조건 하나를 바꿀게요'));
  assert.match(t,/AI가 정한 기본값 \(사용자 결정 아님 · 바꿀 수 있음\): 날짜는 달력으로 고름 \/ 목록은 최신순/);
  assert.ok(t.indexOf('아직 정하지 않은 것')<t.indexOf('AI가 정한 기본값'),'undecided and suggested are separate lines');
  assert.match(t,/저장된 기준은 기록으로 그대로 두고 이번 요청에서는 답이 명시적으로 바꾼 대상만 답을 따릅니다/);
  assert.match(t,/인용·가정·다른 사람의 제안은 변경 지시가 아니며, 바꾸지 않은 조건과 실행 권한은 그대로/);
  assert.ok(!/직접 (고쳐|수정)|재승인|다시 승인/.test(t),'no manual-edit or re-approval condition');
  assert.ok(!/이 답이 우선/.test(t),'no unconditional precedence');
});

test('G098-3 the guidance prompt separates fact and choice examples and states the general rules (no case answers)',()=>{
  assert.ok(!GUIDE_PROMPT.includes('"kind":"choice 또는 fact"'),'no combined example');
  assert.ok(GUIDE_PROMPT.includes('"kind":"fact","text":"질문","why":"답에 따라 초안이 어떻게 달라지는지","options":[]'));
  assert.ok(GUIDE_PROMPT.includes('"kind":"choice"')&&GUIDE_PROMPT.includes('"defaults":['));
  for(const rule of ['[최신 사용자 변경]','[선택지와 자유 답]','[모름·보류]','[완료 조건]','[open과 defaults]'])assert.ok(GUIDE_PROMPT.includes(rule),rule);
  // The four observed cases are regression material only: none of their domain words is written into the prompt.
  for(const w of ['식재료','재료','CSV','응답자','네트워크','공지','단말','rename','밑줄','파일 이름'])assert.ok(!GUIDE_PROMPT.includes(w),w);
});

test('G098-4 a stale guidance.1 request is refused plainly (400) instead of yielding a reply the old client cannot read',async()=>{
  const {p,area}=plan();
  await withServer(cfg(),async port=>{const r=await post(port,{...G.buildGuideRequest(p,area,null),schemaVersion:'guidance.1'});assert.equal(r.status,400);assert.deepEqual(r.data,{error:{code:'INVALID_INPUT'}});},{fetchImpl:()=>assert.fail('no call')});
});
