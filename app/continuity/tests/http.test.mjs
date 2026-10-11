import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createContinuityApp } from '../server/app.mjs';
import { readConfig } from '../../server/config.mjs';
import { callContinuity } from '../server/provider.mjs';
import { mockAdvice } from '../server/mock.mjs';
import * as D from '../dist/public/shared/domain.js';
const cfg=(extra={})=>({...readConfig({AI_MODE:'mock',PORT:'0',AI_REQUESTS_PER_MINUTE:'60',AI_PROCESS_CALL_CAP:'100'}),...extra});
function input(text='문구만 바꿔줘.') {return D.begin(D.submit(D.editDraft(D.createProject(),text))).request;}
function fakeUpstream(advice,finish='stop'){return new Response(JSON.stringify({choices:[{finish_reason:finish,message:{content:JSON.stringify(advice)}}]}),{status:200});}
async function withServer(config,fn,options={}) {
  const s=createContinuityApp({config,...options});await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
  try{return await fn(s.address().port);}finally{s.closeAllConnections();await new Promise(resolve=>s.close(resolve));}
}
function local(port,{method='POST',path='/api/continuity',request=input(),headers={}}={}) {
  return new Promise((resolve,reject)=>{
    const body=typeof request==='string'?request:JSON.stringify(request);
    const r=http.request({hostname:'127.0.0.1',port,path,method,headers:{Origin:`http://127.0.0.1:${port}`,'Content-Type':'application/json','X-AgentFlow-Request':'1',...headers}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const raw=Buffer.concat(chunks).toString();let data;try{data=JSON.parse(raw);}catch{data=null;}resolve({status:res.statusCode,headers:res.headers,raw,data});});
    });r.on('error',reject);r.end(method==='GET'||method==='HEAD'?undefined:body);
  });
}
test('I15-H01 real local HTTP -> mock -> typed envelope, safe config and static entry, no external fetch',async()=>{
  await withServer(cfg(),async port=>{
    const req=input(),r=await local(port,{request:req});assert.equal(r.status,200);assert.equal(r.data.mode,'mock');assert.deepEqual(r.data.ticket,req.ticket);assert.equal(r.data.advice.question,null);
    const c=await local(port,{method:'GET',path:'/api/config'});assert.equal(c.data.scope,'local-development-only');assert.equal(c.data.paidEnabled,false);assert.ok(!c.raw.includes('apiKey'));
    const page=await local(port,{method:'GET',path:'/'});assert.equal(page.status,200);assert.match(page.raw,/이어갈 기준/);assert.match(page.headers['content-security-policy'],/connect-src 'self'/);
    assert.equal((await local(port,{method:'GET',path:'/client/app.js'})).status,200);
  },{fetchImpl:()=>assert.fail('no external fetch')});
});
test('I15-H02 invalid origin/host/content-type/body rejected without mock or provider invocation',async()=>{
  let calls=0;await withServer(cfg(),async port=>{
    for(const headers of [{origin:'https://outside.invalid'},{host:'outside.invalid'},{'sec-fetch-site':'cross-site'},{'x-agentflow-request':''}])assert.equal((await local(port,{headers})).status,403);
    assert.equal((await local(port,{headers:{'content-type':'text/plain'}})).status,415);
    assert.equal((await local(port,{request:'{broken'})).status,400);
    assert.equal((await local(port,{request:{...input(),sourceKind:'confirmed'}})).status,400);
    assert.equal(calls,0);
  },{mockImpl:r=>{calls++;return mockAdvice(r);}});
});
test('I15-H03 oversized input is rejected without truncating or invoking provider; static traversal denied',async()=>{
  await withServer(cfg(),async port=>{
    assert.equal((await local(port,{request:'x'.repeat(131073)})).status,413);
    for(const path of ['/../package.json','/%2e%2e/package.json','/server/index.mjs','/.env','//index.html','/client/../../../package.json'])assert.equal((await local(port,{method:'GET',path})).status,404);
  },{fetchImpl:()=>assert.fail('no external fetch')});
});
test('I15-H04 missing key and paid opt-out prevent all outbound calls',async()=>{
  for(const c of [cfg({mode:'deepseek',apiKey:'',allowPaid:false}),cfg({mode:'deepseek',apiKey:'TEST-NOT-A-REAL-KEY',allowPaid:false})])
    await withServer(c,async port=>{const r=await local(port);assert.equal(r.status,503);assert.ok(['AI_NOT_CONFIGURED','PAID_CALLS_DISABLED'].includes(r.data.error.code));},{fetchImpl:()=>assert.fail('must not dispatch')});
});
test('I15-H05 request IDs and process cap cannot be silently retried through old interview endpoint',async()=>{
  await withServer(cfg({cap:1}),async port=>{
    const request=input();assert.equal((await local(port,{request})).status,200);
    assert.equal((await local(port,{request})).data.error.code,'DUPLICATE_REQUEST');
    assert.equal((await local(port)).data.error.code,'PROCESS_CALL_CAP');
    assert.equal((await local(port,{path:'/api/interview'})).status,405);
  });
});
test('I15-H06 malformed response over HTTP cannot patch a basis; response includes only fixed error code',async()=>{
  await withServer(cfg(),async port=>{const r=await local(port);assert.equal(r.status,502);assert.deepEqual(r.data,{error:{code:'INVALID_RESPONSE'}});},
    {mockImpl:r=>({...mockAdvice(r),status:'confirmed',sources:[]})});
});
test('I15-P01 exact DeepSeek adapter request uses server endpoint, disabled thinking, JSON and no retry',async()=>{
  const req=input(),advice=mockAdvice(req),config=cfg({mode:'deepseek',apiKey:'TEST-NOT-A-REAL-KEY',allowPaid:true});let count=0;
  const result=await callContinuity(req,config,{fetchImpl:async(url,init)=>{
    count++;assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(init.redirect,'error');
    const b=JSON.parse(init.body);assert.deepEqual(b.thinking,{type:'disabled'});assert.deepEqual(b.response_format,{type:'json_object'});assert.equal(b.max_tokens,config.maxTokens);assert.equal(b.model,'deepseek-flash');
    assert.ok(b.messages[1].content.includes(req.bases[0].text));return fakeUpstream(advice);
  }});assert.equal(count,1);assert.deepEqual(result,advice);
});
test('I15-P02 empty/non-JSON/truncated/authority-injection responses fail once, preserve model errors as codes',async()=>{
  const req=input(),c=cfg({mode:'deepseek',apiKey:'TEST-NOT-A-REAL-KEY',allowPaid:true}),a=mockAdvice(req);
  const doubles=[()=>new Response('not JSON'),()=>fakeUpstream(a,'length'),()=>fakeUpstream({...a,status:'confirmed'}),()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:''}}]})),()=>fakeUpstream({...a,next:c.apiKey})];
  for(const double of doubles){let count=0;await assert.rejects(callContinuity(req,c,{fetchImpl:async()=>{count++;return double();}}),/INVALID_RESPONSE/);assert.equal(count,1);}
});
test('I15-P03 provider errors never expose raw body or credentials and never retry',async()=>{
  const req=input(),c=cfg({mode:'deepseek',apiKey:'TEST-NOT-A-REAL-KEY',allowPaid:true});
  for(const [status,code] of [[401,'AI_AUTH_FAILED'],[402,'AI_BALANCE_REQUIRED'],[429,'AI_RATE_LIMIT'],[400,'AI_CONFIG_REJECTED'],[503,'AI_UNAVAILABLE']]){
    let count=0;await assert.rejects(callContinuity(req,c,{fetchImpl:async()=>{count++;return new Response('private raw exception',{status});}}),new RegExp(code));assert.equal(count,1);
  }
});
test('I15-P04 timeout and cancelled requests work even with a transport that ignores AbortSignal',async()=>{
  const req=input(),c=cfg({mode:'deepseek',apiKey:'TEST-NOT-A-REAL-KEY',allowPaid:true,timeoutMs:30});let count=0;
  await assert.rejects(callContinuity(req,c,{fetchImpl:async()=>{count++;return new Promise(()=>{});}}),/AI_TIMEOUT/);assert.equal(count,1);
  const ctl=new AbortController();ctl.abort();await assert.rejects(callContinuity(req,c,{signal:ctl.signal,fetchImpl:()=>assert.fail()}),/CANCELLED/);
});
test('I15-P05 real local HTTP -> DeepSeek adapter -> injected fake upstream uses the same route as live mode',async()=>{
  let count=0;const request=input();await withServer(cfg({mode:'deepseek',apiKey:'TEST-NOT-A-REAL-KEY',allowPaid:true}),async port=>{
    const r=await local(port,{request});assert.equal(r.status,200);assert.equal(r.data.mode,'deepseek');assert.deepEqual(r.data.advice,mockAdvice(request));
  },{fetchImpl:async()=>{count++;return fakeUpstream(mockAdvice(request));}});assert.equal(count,1);
});
