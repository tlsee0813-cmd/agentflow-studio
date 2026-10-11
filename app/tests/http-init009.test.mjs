import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync,readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { mockInterview } from '../server/providers/mock.mjs';
import { MODEL,sha } from '../scripts/init009/policy.mjs';
import { openMockHttp } from '../scripts/init009/http.mjs';
import { readLedger } from '../scripts/init009/ledger.mjs';
import { preparePhase,executeStage } from '../scripts/init009/engine.mjs';
import { collect } from '../scripts/init009/report.mjs';
import { identity,makeStore,fakeClock,fixedAnswers,options } from './init009-helpers.mjs';
const NEVER=async()=>assert.fail('duplicate/skip must not open HTTP');
function upstream(req,{badSource=false,syntax=false,noUsage=false,finish='stop',model=MODEL}={}){
  const result=mockInterview(req);if(badSource)result.proposals[0].sourceIds=['S-INIT009-SYNTHETIC-NONEXISTENT'];
  return new Response(JSON.stringify({model,...(noUsage?{}:{usage:{prompt_tokens:1000,completion_tokens:500,total_tokens:1500,
    prompt_cache_hit_tokens:0,prompt_cache_miss_tokens:1000}}),choices:[{finish_reason:finish,message:{content:syntax?'{invalid':JSON.stringify(result)}}]}),{status:200});
}
function text(root){return readdirSync(root,{withFileTypes:true}).map(e=>e.isDirectory()?text(join(root,e.name)):readFileSync(join(root,e.name),'utf8')).join('\n');}
test('I9.H1 actual native localhost createApp HTTP/adapter: four synthetic dispatches, durable onDispatch, reviewed IDs, duplicate zero',async()=>{
  const {store,root}=makeStore(),clock=fakeClock();let calls=0;
  const factory=req=>{calls++;const disk=readLedger(root,identity);const slot=disk.data.slots.find(s=>s.requestIdHash===sha(req.requestId));
    assert.equal(slot.status,'dispatched');assert.ok(slot.stageReviewHash&&slot.stagePlanHash&&slot.reservation);return upstream(req);};
  try{
    const plan=preparePhase('firsts',identity),http=await openMockHttp({factory});http.clock=clock;
    const first=await executeStage(store,'firsts',options(plan,http));assert.equal(first.totalDispatched,2);assert.equal(first.halt,null);
    assert.ok(http.observations.every(r=>r.upstreamDispatched&&r.httpStatus===200));
    assert.equal((await executeStage(store,'firsts',{openTransport:NEVER})).dispatchesThisInvocation,0);
    const follow=preparePhase('followups',identity,store,fixedAnswers(store)),http2=await openMockHttp({factory});http2.clock=clock;
    const second=await executeStage(store,'followups',options(follow,http2));assert.equal(second.totalDispatched,4);assert.equal(second.halt,null);
    assert.equal((await executeStage(store,'followups',{openTransport:NEVER})).dispatchesThisInvocation,0);assert.equal(calls,4);
    const r=collect(store);assert.equal(r.cases[1].observations.finalDisposition,'deferred');assert.equal(r.cases[1].observations.sameAnswerId,true);
    assert.ok(r.cases.every(c=>c.humanContentQuality==='pending'));assert.equal(r.actualCustomerApproval,false);
  }finally{store.close();}
});
test('I9.H2 native HTTP healthy upstream200 known_source -> app502 preserves failure, p03 first still proceeds; no rejected raw',async()=>{
  const {store,root}=makeStore();let calls=0;
  const http=await openMockHttp({factory:req=>upstream(req,{badSource:++calls===1})});http.clock=fakeClock();
  try{
    const result=await executeStage(store,'firsts',options(preparePhase('firsts',identity),http));
    assert.equal(calls,2);assert.equal(result.halt,null);assert.equal(store.data.slots[0].httpStatus,502);
    assert.equal(store.data.slots[0].telemetry.httpStatus,200);assert.equal(store.data.slots[0].diagnostic.rule,'known_source');
    assert.equal(store.data.slots[2].status,'skipped');assert.equal(store.sessions.p01.generations[0].validatedEnvelope,undefined);
    assert.ok(!text(root).includes('S-INIT009-SYNTHETIC-NONEXISTENT'));
  }finally{store.close();}
});
for(const [name,setting,reason] of [
  ['content JSON syntax',{syntax:true},'STATE_INVARIANT_FAILED'],
  ['unknown usage',{noUsage:true},'USAGE_INVALID'],
  ['unexpected model',{model:'not-the-reviewed-model'},'MODEL_CHANGED'],
  ['finish not stop',{finish:'length'},'FINISH_NOT_STOP']]){
  test(`I9.H global halt on ${name}; one synthetic HTTP dispatch only, no second case/retry`,async()=>{
    const {store,root}=makeStore();let calls=0;
    const http=await openMockHttp({factory:req=>{calls++;return upstream(req,setting);}});http.clock=fakeClock();
    await executeStage(store,'firsts',options(preparePhase('firsts',identity),http));
    assert.equal(calls,1);assert.equal(store.data.halt.code,reason);assert.equal(store.data.slots[1].status,'pending');
    store.close();assert.ok(existsSync(join(root,'active.lock')));
  });
}
