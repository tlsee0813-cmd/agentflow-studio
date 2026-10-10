import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { initial, config, upstream } from './helpers.mjs';
import { applyResponse, answerQuestion, beginRequest } from '../dist/public/shared/project.js';
import { mockInterview } from '../server/providers/mock.mjs';
async function server(t,options={}) {
  const app=createApp({config:config({mode:'mock'}),...options});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{app.close(resolve);app.closeAllConnections();}));
  const url=`http://127.0.0.1:${app.address().port}`;
  const post=(data,headers={})=>fetch(`${url}/api/interview`,{method:'POST',headers:{Origin:url,'Content-Type':'application/json','X-AgentFlow-Request':'1',...headers},body:JSON.stringify(data)});
  return {url,post};
}
test('H01 real local HTTP UI -> mock provider -> domain summary, both storage branches',async t=>{
  const s=await server(t);
  for(const optionId of ['browser','multi-device']) {
    const first=initial(); const res=await s.post(first.request);assert.equal(res.status,200);
    const envelope=await res.json();assert.equal(envelope.mode,'mock');
    let state=applyResponse(first.state,first.request,envelope);
    state=answerQuestion(state,{optionId,text:'test choice',disposition:'answered'});
    const second=beginRequest(state); const final=await s.post(second.request);assert.equal(final.status,200);
    state=applyResponse(second.state,second.request,await final.json());
    assert.equal(state.phase,'summary');assert.equal(state.answers[0].optionId,optionId);
    assert.equal(state.requirements.find(r=>r.topic==='storage').status,'confirmed');
  }
});
test('H02 missing key returns no fallback, no provider call and no secrets in config',async t=>{
  let calls=0;const s=await server(t,{config:config({apiKey:''}),fetchImpl:()=>{calls++;throw new Error();}});
  const response=await s.post(initial().request);assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:{code:'AI_NOT_CONFIGURED'}});assert.equal(calls,0);
  const data=await (await fetch(s.url+'/api/config')).json();assert.equal(data.mode,'deepseek');assert.equal(data.configured,false);
  assert.ok(!JSON.stringify(data).includes('apiKey'));
});
test('H03 real local HTTP with simulated upstream reports deepseek mode (not live verification)',async t=>{
  const first=initial();const s=await server(t,{config:config(),fetchImpl:async()=>upstream(mockInterview(first.request))});
  const response=await s.post(first.request);assert.equal(response.status,200);assert.equal((await response.json()).mode,'deepseek');
});
test('H04 cross-site, missing custom header, non-JSON and invalid input fail before provider',async t=>{
  const s=await server(t);
  assert.equal((await s.post(initial().request,{Origin:'https://evil.example'})).status,403);
  assert.equal((await s.post(initial().request,{'X-AgentFlow-Request':''})).status,403);
  assert.equal((await s.post(initial().request,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await s.post({model:'rogue'})).status,400);
});
test('H05 oversized body rejected; server sources, dotfiles and traversal not served',async t=>{
  const s=await server(t);
  assert.equal((await s.post({large:'a'.repeat(33000)})).status,413);
  for(const path of ['/server/config.mjs','/.env','/package.json','/..%2f..%2fserver%2fconfig.mjs']) assert.equal((await fetch(s.url+path)).status,404);
  const ui=await fetch(s.url+'/');assert.equal(ui.status,200);assert.match(ui.headers.get('content-security-policy'),/connect-src 'self'/);
  assert.ok((await ui.text()).includes('아이디어와 핵심 사용 장면'));
});
test('H06 duplicate and rate limit enforced by HTTP route',async t=>{
  const s=await server(t,{config:config({mode:'mock',rate:1})});const first=initial();
  assert.equal((await s.post(first.request)).status,200);
  assert.equal((await s.post(first.request)).status,409);
  const res=await s.post(initial().request);assert.equal(res.status,429);assert.equal(res.headers.get('retry-after'),'60');
});
test('H07 simulated upstream auth body never leaks through HTTP',async t=>{
  const s=await server(t,{config:config(),fetchImpl:async()=>new Response('secret provider error',{status:401})});
  const response=await s.post(initial().request);assert.equal(response.status,502);
  assert.equal(await response.text(),'{"error":{"code":"AI_AUTH_FAILED"}}');
});
