import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, config, upstream } from './helpers.mjs';
import { mockInterview } from '../server/providers/mock.mjs';
import { callDeepSeek } from '../server/providers/deepseek.mjs';
import { readConfig } from '../server/config.mjs';
import { createLimiter } from '../server/limiter.mjs';

test('P01 MOCK TRANSPORT: correct server endpoint, model, JSON, disabled thinking; no API key in prompt/body', async () => {
  const {request} = initial(); const cfg = config(); let calls=0;
  const result = await callDeepSeek(request,cfg,{fetchImpl:async(url,init)=>{
    calls++; assert.equal(url,'https://api.deepseek.com/chat/completions');
    const body=JSON.parse(init.body); assert.equal(body.model,'deepseek-flash'); assert.deepEqual(body.response_format,{type:'json_object'});
    assert.equal(body.thinking.type,'disabled'); assert.equal(body.stream,false); assert.equal(body.max_tokens,2048);
    assert.equal(init.headers.Authorization,`Bearer ${cfg.apiKey}`); assert.ok(!init.body.includes(cfg.apiKey));
    assert.equal(init.redirect,'error'); return upstream(mockInterview(request));
  }});
  assert.equal(calls,1); assert.equal(result.projectId,request.projectId);
});
for (const [status,code] of [[401,'AI_AUTH_FAILED'],[403,'AI_AUTH_FAILED'],[402,'AI_BALANCE_REQUIRED'],[429,'AI_RATE_LIMIT'],[400,'AI_CONFIG_REJECTED'],[422,'AI_CONFIG_REJECTED'],[500,'AI_UNAVAILABLE'],[503,'AI_UNAVAILABLE']]) {
  test(`P02 MOCK HTTP ${status} -> ${code}, sanitized and no retry`,async()=>{
    const {request}=initial();let calls=0;
    await assert.rejects(callDeepSeek(request,config(),{fetchImpl:async()=>{calls++;return new Response('upstream-sensitive-body',{status});}}),{code});
    assert.equal(calls,1);
  });
}
for (const [key,val,code] of [['apiKey','','AI_NOT_CONFIGURED'],['allowPaid',false,'PAID_CALLS_DISABLED']]) {
  test(`P03 ${code} makes zero fetch calls`,async()=>{
    const {request}=initial(); let calls=0;
    await assert.rejects(callDeepSeek(request,config({[key]:val}),{fetchImpl:()=>{calls++;throw new Error();}}),{code});
    assert.equal(calls,0);
  });
}
test('P04 MOCK timeout covers fetch that ignores AbortSignal',async()=>{
  const {request}=initial();
  await assert.rejects(callDeepSeek(request,config({timeoutMs:20}),{fetchImpl:()=>new Promise(()=>{})}),{code:'AI_TIMEOUT'});
});
test('P05 MOCK timeout also covers a stalled response body',async()=>{
  const {request}=initial();
  await assert.rejects(callDeepSeek(request,config({timeoutMs:20}),{fetchImpl:async()=>new Response(new ReadableStream({start(){}}))}),{code:'AI_TIMEOUT'});
});
test('P06 MOCK network errors cannot leak exception messages',async()=>{
  const {request}=initial();
  await assert.rejects(callDeepSeek(request,config(),{fetchImpl:async()=>{throw new Error('credential secret diagnostic');}}),e=>e.code==='AI_NETWORK_ERROR'&&!e.message.includes('credential'));
});
test('P07 client cancellation aborts the provider path',async()=>{
  const {request}=initial();const controller=new AbortController();controller.abort(); let calls=0;
  await assert.rejects(callDeepSeek(request,config(),{signal:controller.signal,fetchImpl:async()=>{calls++;throw new Error('abort');}}),{code:'CANCELLED'});
  assert.equal(calls,0);
});
for (const kind of ['invalid-json','empty-content','truncated','unknown-source','wrong-project','huge-body','tool-call']) {
  test(`P08 MOCK ${kind} rejected`,async()=>{
    const {request}=initial(); const r=mockInterview(request);
    let data={choices:[{finish_reason:'stop',message:{content:JSON.stringify(r)}}]};
    if(kind==='empty-content') data.choices[0].message.content='';
    if(kind==='truncated') data.choices[0].finish_reason='length';
    if(kind==='unknown-source') {r.proposals[0].sourceIds=['made-up'];data.choices[0].message.content=JSON.stringify(r);}
    if(kind==='wrong-project') {r.projectId='wrong';data.choices[0].message.content=JSON.stringify(r);}
    if(kind==='tool-call') data.choices[0].message.tool_calls=[{id:'unapproved'}];
    const text=kind==='invalid-json'?'not-json':kind==='huge-body'?'x'.repeat(131073):JSON.stringify(data);
    await assert.rejects(callDeepSeek(request,config(),{fetchImpl:async()=>new Response(text)}),{code:'INVALID_RESPONSE'});
  });
}
test('P09 endpoint override cannot exfiltrate key to an unapproved host',()=>{
  for(const url of ['http://api.deepseek.com','https://evil.example','https://api.deepseek.com@evil.example','https://api.deepseek.com/?redirect=evil']){
    assert.throws(()=>readConfig({DEEPSEEK_BASE_URL:url}));
  }
  assert.equal(readConfig({DEEPSEEK_BASE_URL:'https://api.deepseek.com/v1',DEEPSEEK_MODEL:'replacement-model'}).model,'replacement-model');
});
test('P10 limiter enforces concurrency, duplicate ID, minute and process caps',()=>{
  let clock=0; const limiter=createLimiter({rate:2,cap:3,concurrency:1},()=>clock);
  const release=limiter.acquire('one');assert.throws(()=>limiter.acquire('two'),{code:'AI_BUSY'});release();release();
  assert.throws(()=>limiter.acquire('one'),{code:'DUPLICATE_REQUEST'});limiter.acquire('two')();
  assert.throws(()=>limiter.acquire('three'),{code:'LOCAL_RATE_LIMIT'});
  clock=60001;limiter.acquire('three')();assert.throws(()=>limiter.acquire('four'),{code:'PROCESS_CALL_CAP'});
});
