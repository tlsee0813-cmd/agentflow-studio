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
  assert.throws(()=>validateGuideReply({question:q,proposal:{goal:'g',scope:'s',checks:'c',open:[]}},G.buildGuideRequest(p,area,null)));
  assert.throws(()=>validateGuideReply({question:null,proposal:{goal:'g',scope:'s',checks:'c',open:[],status:'done'}},req),'no extra fields');
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
  const calls=[],proposal={goal:'예약 접수',scope:'접수 화면만',checks:'접수 기록 확인',open:[]};
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
    [()=>upstream({question:null,proposal:{goal:'g',scope:'s',checks:'c',open:[]},done:true}),null,502,'INVALID_RESPONSE'],
    [()=>upstream({question:null,proposal:{goal:KEY,scope:'s',checks:'c',open:[]}}),null,502,'INVALID_RESPONSE'],
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
