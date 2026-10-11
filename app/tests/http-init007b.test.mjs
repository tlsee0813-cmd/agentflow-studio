import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server/app.mjs';
import { beginRequest } from '../dist/public/shared/project.js';
import { openMockHttp, mockProviderResponse } from '../scripts/init007b/http.mjs';
import { openLedger } from '../scripts/init007b/ledger.mjs';
import { sessionFor, dispatchSlot, prepareAnswers } from '../scripts/init007b/engine.mjs';
import { SNAPSHOT, MODEL, experimentConfig, reserveRequest } from '../scripts/init007b/policy.mjs';
import { renderReport } from '../scripts/init007b/report.mjs';
import { identity, createStore, clone, fixedAnswers, CANARY } from './init007b-helpers.mjs';
const output=process.env.INIT007B_HTTP_TEST_OUTPUT;
const record=(name,data)=>{if(output){mkdirSync(output,{recursive:true});writeFileSync(join(output,name),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');}};
const diskText=root=>readdirSync(root,{withFileTypes:true}).map(e=>e.isDirectory()?diskText(join(root,e.name)):readFileSync(join(root,e.name),'utf8')).join('\n');
const options={prices:SNAPSHOT,guard:()=>{},now:Date.now,wait:ms=>new Promise(r=>setTimeout(r,ms)),secrets:[]};
function initialize(store) {
  const data=clone(store.data);data.stages.firsts='running';store.commit(data,{p01:sessionFor('p01','mock')});
}

test('BHTTP01 native createApp/provider-adapter HTTP p01 slot pair, reopen store/server, durable actual >=12s, 4096 observed; upstream MOCK',async()=>{
  const {root,store}=createStore();initialize(store);const upstreamStarts=[];
  const factory=async request=>{upstreamStarts.push(Date.now());return mockProviderResponse(request);};
  const first=await openMockHttp({factory});
  try {await dispatchSlot(store,'p01',1,first,options);}finally{await first.close();}
  assert.equal(store.data.slots[0].status,'succeeded');const initial=clone(store.sessions.p01),firstStart=store.data.slots[0].startedAtMs;
  store.close();
  const next=openLedger(root,identity),bundle=fixedAnswers(next),prepared=prepareAnswers(next,bundle),data=clone(next.data);
  data.slots.find(s=>s.id==='p01-2').answerHash=prepared.digests.p01;next.commit(data,prepared.changed);
  const followup=await openMockHttp({factory});
  try {await dispatchSlot(next,'p01',2,followup,options);}finally{await followup.close();}
  const slot=next.data.slots.find(s=>s.id==='p01-2');assert.equal(slot.status,'succeeded');assert.ok(slot.startedAtMs-firstStart>=12000);
  assert.equal(next.sessions.p01.state.id,initial.state.id);assert.deepEqual(next.sessions.p01.snapshots.first,initial.snapshots.first);
  assert.equal(slot.reservation.outputReservationTokens,4096);assert.equal(slot.telemetry.returnedModel,MODEL);
  assert.equal(slot.telemetry.usage.total_tokens,1500);assert.equal(slot.telemetry.finishReason,'stop');
  assert.equal(next.sessions.p01.state.responseMode,'mock');assert.equal(next.sessions.p01.quality.status,'human_review_pending');
  assert.equal(upstreamStarts.length,2);assert.ok(upstreamStarts[1]-upstreamStarts[0]>=12000);
  const observations=[...first.observations,...followup.observations];assert.equal(observations.length,2);assert.ok(observations.every(o=>o.httpStatus===200&&o.upstreamDispatched));
  record('native-slot-pair.json',{kind:'native loopback createApp + real provider adapter + mock upstream',
    note:'Two slot seams only; not a six-persona batch, CLI process E2E, live DeepSeek or browser test.',
    node:process.version,paidCalls:0,observations,actualGapMs:upstreamStarts[1]-upstreamStarts[0],upstreamStarts,durableDispatchGapMs:slot.startedAtMs-firstStart,
    slots:next.data.slots.filter(s=>s.personaId==='p01'),quality:'human_review_pending'});
  record('native-slot-pair-review.md',renderReport(next));next.close();
});
test('BHTTP02 native HTTP dispatch journal failure produces upstream send zero and leaves poisoned lock',async()=>{
  const {root,store}=createStore({beforeWrite:(path,value)=>{if(path.includes('journal')&&value.data?.slots[0].status==='dispatched')throw Error('SYNTHETIC_WRITE_FAILURE');}});
  initialize(store);let upstreamCalls=0;
  const transport=await openMockHttp({factory:async request=>{upstreamCalls++;return mockProviderResponse(request);}});
  try {await assert.rejects(dispatchSlot(store,'p01',1,transport,options),/OUTPUT_WRITE_FAILED/);}finally{await transport.close();}
  assert.equal(upstreamCalls,0);assert.equal(transport.observations.length,1);assert.equal(transport.observations[0].upstreamDispatched,false);
  assert.equal(store.poisoned,true);store.close();assert.throws(()=>openLedger(root,identity),/LEDGER_LOCKED/);
  record('native-dispatch-save-failure.json',{kind:'native local HTTP, simulated disk failure',paidCalls:0,
    localHttpRequests:transport.observations.length,upstreamCalls,poisoned:true,observations:transport.observations});
});
test('BHTTP03 healthy upstream 200 + malformed content is case failure; raw/reasoning/headers absent from every saved file',async()=>{
  const {root,store}=createStore();initialize(store);
  const transport=await openMockHttp({factory:async()=>new Response(JSON.stringify({model:MODEL,
    usage:{prompt_tokens:1000,completion_tokens:500,total_tokens:1500,prompt_cache_hit_tokens:0,prompt_cache_miss_tokens:1000},
    choices:[{finish_reason:'stop',message:{content:'{'+CANARY,reasoning_content:CANARY}}]}),{status:200,headers:{'X-Synthetic-Private':CANARY}})});
  try {await dispatchSlot(store,'p01',1,transport,options);}finally{await transport.close();}
  const slot=store.data.slots[0];assert.equal(slot.httpStatus,502);assert.equal(slot.telemetry.httpStatus,200);
  assert.deepEqual(slot.failure,{scope:'case',code:'INVALID_RESPONSE'});assert.equal(store.data.halt,null);
  assert.equal(slot.diagnostic.stage,'content_parse');assert.equal(store.data.slots.find(s=>s.id==='p01-2').status,'skipped');
  assert.equal(store.sessions.p01.generations[0].validatedEnvelope,undefined);assert.equal(store.sessions.p01.state.summary,'');
  assert.ok(!diskText(root).includes(CANARY));assert.ok(!renderReport(store).includes(CANARY));
  record('native-contract-rejection.json',{kind:'native loopback HTTP; mock provider 200; invalid content',paidCalls:0,
    rawCanaryStored:false,reasoningStored:false,headersStored:false,slot});store.close();
});
test('BHTTP04 optional app telemetry observer exception is contained; response contract unchanged',async()=>{
  const request=beginRequest(sessionFor('p01','mock').state).request;let telemetryCalls=0;
  const server=createApp({config:experimentConfig(),fetchImpl:async()=>mockProviderResponse(request),onTelemetry:()=>{telemetryCalls++;throw Error(CANARY);}});
  server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
  try {
    const response=await fetch(`${origin}/api/interview`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-AgentFlow-Request':'1'},body:JSON.stringify(request)});
    assert.equal(response.status,200);const body=await response.json();assert.deepEqual(Object.keys(body).sort(),['mode','result']);
    assert.equal(telemetryCalls,1);assert.ok(!JSON.stringify(body).includes(CANARY));
    record('native-observer-exception.json',{nativeHttpRequests:1,upstreamMockCalls:1,telemetryCalls,httpStatus:200,paidCalls:0,responseContractUnchanged:true});
  }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});

test('BHTTP05 actual body hash mismatch is blocked before dispatch callback/upstream IO',async()=>{
  let sends=0,dispatches=0;const transport=await openMockHttp({factory:async request=>{sends++;return mockProviderResponse(request);}});
  const request=beginRequest(sessionFor('p01','mock').state).request,reservation=reserveRequest(request,transport.config,SNAPSHOT);
  reservation.bodySha256='0'.repeat(64);
  try {
    const response=await transport.generate(request,{reservation,onDispatch:()=>{dispatches++;}});
    assert.equal(response.dispatchError,'BODY_MISMATCH');assert.equal(dispatches,0);assert.equal(sends,0);
    record('native-body-hash-guard.json',{nativeHttpRequests:1,dispatches,upstreamCalls:sends,paidCalls:0,error:'BODY_MISMATCH'});
  }finally{await transport.close();}
});
