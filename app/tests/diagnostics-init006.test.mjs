import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, branch, config } from './helpers.mjs';
import { mockInterview } from '../server/providers/mock.mjs';
import { callDeepSeek } from '../server/providers/deepseek.mjs';
import { createApp } from '../server/app.mjs';
import { validateResult } from '../dist/public/shared/validation.js';
import { applyResponse, failRequest, cancelRequest, beginRequest, decideRequirement } from '../dist/public/shared/project.js';
import { safeDiagnostic, diagnosticSink, DIAGNOSTIC_VERSION } from '../dist/public/shared/diagnostics.js';
const SECRET='SYNTHETIC_PRIVATE_SENTINEL_006'; // Non-secret test canary; never a real key.
const msg=content=>({model:'deepseek-flash',usage:{prompt_tokens:123,completion_tokens:45,total_tokens:168},
  choices:[{finish_reason:'stop',message:{content,reasoning_content:SECRET}}]});
const response=content=>new Response(JSON.stringify(msg(content)));
const expected=(stage,path,rule,counts={})=>({schemaVersion:DIAGNOSTIC_VERSION,stage,path,rule,...counts});
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
async function rejectProvider(fetchImpl, want) {
  const b=initial(),records=[],telemetry=[];let calls=0;
  await assert.rejects(callDeepSeek(b.request,config({apiKey:SECRET}),{
    fetchImpl:async()=>{calls++;return fetchImpl(b.request);},onDiagnostic:d=>records.push(d),onTelemetry:t=>telemetry.push(t)
  }),{code:'INVALID_RESPONSE'});
  assert.equal(calls,1);assert.deepEqual(records,[want]);assert.equal(telemetry.length,1);
  assert.equal(telemetry[0].outcome,'INVALID_RESPONSE');assert.deepEqual(telemetry[0].diagnostic,want);
  assert.ok(!JSON.stringify([records,telemetry]).includes(SECRET));
}
const cases=[
  ['outer syntax',()=>new Response('{'+SECRET),expected('envelope_parse','provider.body','json_syntax',{length:SECRET.length+1})],
  ['inner syntax with HTTP200/stop',()=>response('{'+SECRET),expected('content_parse','provider.choices[].message.content','json_syntax',{length:SECRET.length+1})],
  ['missing body',()=>new Response(null),expected('response_body','provider.body','body_missing')],
  ['body limit',()=>new Response('x'.repeat(131073)),expected('response_body','provider.body','body_limit',{length:131073})],
  ['content shape',()=>response({private:SECRET}),expected('provider_envelope','provider.choices[].message.content','expected_string')],
  ['blank content',()=>response('  '),expected('provider_envelope','provider.choices[].message.content','non_blank',{length:2})],
  ['finish not stop',()=>{const x=msg(SECRET);x.choices[0].finish_reason=SECRET;return new Response(JSON.stringify(x));},expected('provider_envelope','provider.choices[].finish_reason','finish_not_stop')],
  ['tool call',()=>{const x=msg(SECRET);x.choices[0].message.tool_calls=[{arguments:SECRET}];return new Response(JSON.stringify(x));},expected('provider_envelope','provider.choices[].message.tool_calls','tool_calls_present')],
  ['body reader fails',()=>new Response(new ReadableStream({start(c){c.error(new Error(SECRET));}})),expected('response_body','provider.body','body_read_failed')]
];
for(const [name,fetch,want] of cases)test(`I6D provider ${name}`,()=>rejectProvider(fetch,want));

// Same validated HTTP envelope and finish=stop; each distinct contract failure is observable.
const mutations=[
  ['project mismatch',r=>r.projectId=SECRET,'result.projectId','value_mismatch'],
  ['version mismatch',r=>r.baseVersion=999,'result.baseVersion','value_mismatch'],
  ['request mismatch',r=>r.requestId=SECRET,'result.requestId','value_mismatch'],
  ['missing summary',r=>delete r.summary,'result.summary','required_field'],
  ['unknown field name',r=>r[SECRET]=SECRET,'result','unexpected_field',{count:1}],
  ['summary type',r=>r.summary={private:SECRET},'result.summary','expected_string'],
  ['summary length',r=>r.summary='x'.repeat(1601),'result.summary','max_length',{length:1601}],
  ['blank summary',r=>r.summary='\n','result.summary','non_blank',{length:1}],
  ['missing example',r=>delete r.question.example,'result.question.example','required_field'],
  ['question ID format',r=>r.question.id=SECRET+'!','result.question.id','id_format'],
  ['question enum',r=>r.question.topic=SECRET,'result.question.topic','enum_value'],
  ['known tools',r=>r.question.topic='tools','result.question.topic','tools_already_selected'],
  ['option minimum',r=>r.question.options=[],'result.question.options','min_count',{count:0}],
  ['option maximum',r=>r.question.options=Array(5).fill(r.question.options[0]),'result.question.options','max_count',{count:5}],
  ['duplicate option',r=>r.question.options[1].id=r.question.options[0].id,'result.question.options[].id','unique'],
  ['option label length',r=>r.question.options[0].label='x'.repeat(161),'result.question.options[].label','max_length',{length:161}],
  ['storage semantics',r=>r.question.options[0].id='other','result.question.options','storage_options',{count:2}],
  ['unknown recommendation',r=>r.question.recommendation={optionId:SECRET,reason:'test'},'result.question.recommendation.optionId','known_option'],
  ['proposal shape',r=>r.proposals[0]=null,'result.proposals[]','expected_object'],
  ['proposal status smuggling',r=>r.proposals[0].status='confirmed','result.proposals[]','unexpected_field',{count:1}],
  ['proposal count',r=>r.proposals=Array(9).fill(r.proposals[0]),'result.proposals','max_count',{count:9}],
  ['proposal key',r=>r.proposals[0].key=SECRET,'result.proposals[].key','key_format'],
  ['proposal duplicate',r=>r.proposals.push(r.proposals[0]),'result.proposals[].key','unique'],
  ['proposal text length',r=>r.proposals[0].text='x'.repeat(801),'result.proposals[].text','max_length',{length:801}],
  ['proposal acceptance',r=>r.proposals[0].acceptance=null,'result.proposals[].acceptance','expected_string'],
  ['foreign source',r=>r.proposals[0].sourceIds=[SECRET],'result.proposals[].sourceIds[]','known_source'],
  ['source minimum',r=>r.proposals[0].sourceIds=[],'result.proposals[].sourceIds','min_count',{count:0}],
  ['source array type',r=>r.proposals[0].sourceIds=SECRET,'result.proposals[].sourceIds','expected_array'],
  ['idea placement',r=>r.ideas[0].placement=SECRET,'result.ideas[].placement','enum_value'],
  ['open item type',r=>r.openItems=[{private:SECRET}],'result.openItems[]','expected_string']
];
for(const [name,mutate,path,rule,counts={}] of mutations) test(`I6D contract ${name}: precise diagnostic and atomic state rejection`,async()=>{
  const b=initial();freeze(b.state);const before=structuredClone(b.state);const result=mockInterview(b.request);mutate(result);
  const provider=[],state=[];
  await assert.rejects(callDeepSeek(b.request,config({apiKey:SECRET}),{
    fetchImpl:async()=>response(JSON.stringify(result)),onDiagnostic:d=>provider.push(d)
  }),{code:'INVALID_RESPONSE'});
  assert.deepEqual(provider,[expected('result_contract',path,rule,counts)]);
  const after=applyResponse(b.state,b.request,{mode:'deepseek',result},d=>state.push(d));
  assert.deepEqual(state,[expected('state_contract',path,rule,counts)]);
  assert.deepEqual(after,{...before,pending:null,error:'INVALID_RESPONSE'});assert.deepEqual(b.state,before);
  assert.ok(!JSON.stringify([provider,state]).includes(SECRET));
  assert.ok(!JSON.stringify(after).includes('diagnostic'),'no diagnostic is stored in project state');
});
test('I6D valid prefix plus invalid final proposal rejects the WHOLE change',()=>{
  const b=branch('multi-device'); const r=b.result; const before=structuredClone(b.state);
  r.proposals[0].text='Must not be partially applied';
  r.proposals.push({...r.proposals[0],key:'last-invalid',sourceIds:[SECRET]});
  const events=[];const after=applyResponse(freeze(b.state),b.request,{mode:'deepseek',result:r},d=>events.push(d));
  assert.deepEqual(after,{...before,pending:null,error:'INVALID_RESPONSE'});
  assert.deepEqual(events,[expected('state_contract','result.proposals[].sourceIds[]','known_source')]);
});
test('I6D summarize cannot re-open a question; no coercion to null',()=>{
  const b=branch();b.result.question=mockInterview(initial().request).question;const events=[];
  assert.throws(()=>validateResult(b.result,b.request,d=>events.push(d)),/INVALID_RESPONSE/);
  assert.deepEqual(events,[expected('result_contract','result.question','question_not_allowed')]);assert.ok(b.result.question);
});
test('I6D state envelope failure distinct from provider result contract',()=>{
  const b=initial(),events=[];const after=applyResponse(b.state,b.request,{mode:SECRET,result:mockInterview(b.request)},d=>events.push(d));
  assert.deepEqual(events,[expected('state_contract','envelope.mode','enum_value')]);assert.equal(after.error,'INVALID_RESPONSE');
});
test('I6D stale project/version/request are ignored, with identical state reference',()=>{
  const b=initial();
  for(const [state,path,rule] of [
    [{...b.state,id:'other'},'state.id','stale_project'],
    [cancelRequest(b.state),'state.version','stale_version'],
    [{...b.state,pending:{...b.request,requestId:'other'}},'state.pending.requestId','stale_request']]) {
    const before=structuredClone(state),events=[];
    assert.strictEqual(applyResponse(freeze(state),b.request,null,d=>events.push(d)),state);
    assert.deepEqual(events,[expected('state_guard',path,rule)]);assert.deepEqual(state,before);
  }
});
test('I6D state application exception emits no partial output; caller retains original data',()=>{
  const b=initial(),before=structuredClone(b.state),events=[];freeze(b.state);
  const broken={...b.state,ideas:null}; // Explicitly corrupt local state fixture, NOT an upstream response.
  assert.throws(()=>applyResponse(broken,b.request,{mode:'deepseek',result:mockInterview(b.request)},d=>events.push(d)));
  assert.deepEqual(events,[expected('state_apply','state','application_exception')]);
  assert.deepEqual(b.state,before);const failed=failRequest(b.state,b.request,'INVALID_RESPONSE');
  assert.deepEqual(failed,{...before,pending:null,error:'INVALID_RESPONSE'});
});
test('I6D valid response keeps fixed contract, canonical storage, confirmed locks, source IDs and values',async()=>{
  const first=branch('browser');let state=applyResponse(first.state,first.request,{mode:'mock',result:first.result});
  const req=state.requirements.find(r=>r.id.endsWith('REQ-proposal-core-flow'));
  state=decideRequirement(state,req.id,'confirmed','Locked customer wording');const b=beginRequest(state),events=[];
  const r=mockInterview(b.request);r.proposals[0].text='AI replacement attempt';
  const result=await callDeepSeek(b.request,config(),{fetchImpl:async()=>response(JSON.stringify(r)),onDiagnostic:d=>events.push(d)});
  const after=applyResponse(freeze(b.state),b.request,{mode:'deepseek',result},d=>events.push(d));
  assert.deepEqual(events,[]);assert.deepEqual(result,r);
  const old=b.state.requirements.find(x=>x.id===req.id),saved=after.requirements.find(x=>x.id===req.id);
  assert.deepEqual(saved,{...old,needsReview:true});assert.deepEqual(after.sources.slice(0,b.state.sources.length),b.state.sources);
});
test('I6D diagnostic allowlist rejects dynamic paths/rules, strips extras and limits numeric fields',()=>{
  const good=expected('result_contract','result.summary','max_length',{length:1601});
  assert.deepEqual(safeDiagnostic({...good,headers:SECRET,error:SECRET,content:SECRET,count:99}),good);
  for(const change of [{stage:SECRET},{path:'result.proposals[0].text'},{path:SECRET},{rule:SECRET},{schemaVersion:SECRET}]) assert.equal(safeDiagnostic({...good,...change}),null);
  for(const length of [SECRET,NaN,Infinity,-1,1.5]) assert.deepEqual(safeDiagnostic({...good,length}),expected('result_contract','result.summary','max_length'));
  const sink=diagnosticSink();sink.capture(good);sink.capture(expected('content_parse','provider.choices[].message.content','json_syntax'));
  assert.deepEqual(sink.value,good);assert.ok(Object.isFrozen(sink.value));
});
test('I6D throwing and async-rejecting observers cannot change success/failure or trigger retries',async()=>{
  const b=initial();let calls=0;
  for(const observe of [()=>{throw new Error(SECRET);},async()=>{throw new Error(SECRET);},d=>{d.path=SECRET;}]) {
    await assert.rejects(callDeepSeek(b.request,config(),{fetchImpl:async()=>{calls++;return response('{bad');},onTelemetry:observe,onDiagnostic:observe}),{code:'INVALID_RESPONSE'});
  }
  await new Promise(r=>setTimeout(r,0));assert.equal(calls,3);
});
test('I6D timeout is not relabelled as a parsing error; no late observer emissions',async()=>{
  const b=initial(),events=[],telemetry=[];
  await assert.rejects(callDeepSeek(b.request,config({timeoutMs:10}),{
    fetchImpl:async()=>{await new Promise(r=>setTimeout(r,30));return response('{bad');},
    onDiagnostic:d=>events.push(d),onTelemetry:t=>telemetry.push(t)
  }),{code:'AI_TIMEOUT'});
  await new Promise(r=>setTimeout(r,50));assert.deepEqual(events,[]);assert.equal(telemetry.length,1);
  assert.equal(telemetry[0].diagnostic,null);assert.equal(telemetry[0].outcome,'AI_TIMEOUT');
});
test('I6D actual local HTTP exposes ONLY original safe error, never internal diagnostic or canary',async t=>{
  const b=initial(),events=[];const result=mockInterview(b.request);result.proposals[0].sourceIds=[SECRET];
  const app=createApp({config:config({apiKey:SECRET}),fetchImpl:async()=>response(JSON.stringify(result)),onDiagnostic:d=>events.push(d)});
  await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{app.close(r);app.closeAllConnections();}));
  const url=`http://127.0.0.1:${app.address().port}`;
  const res=await fetch(url+'/api/interview',{method:'POST',headers:{Origin:url,'Content-Type':'application/json','X-AgentFlow-Request':'1'},body:JSON.stringify(b.request)});
  assert.equal(res.status,502);assert.equal(await res.text(),'{"error":{"code":"INVALID_RESPONSE"}}');
  assert.deepEqual(events,[expected('result_contract','result.proposals[].sourceIds[]','known_source')]);
});
