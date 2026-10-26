import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlanAsk, validatePlanReply } from '../dist/public/shared/plan-api.js';
import { CONVERTER_PARTS, converterEvidence, CONVERTER_INTENT, converterExampleAnalysis } from '../dist/public/shared/change-plan-example.js';
import { createStudioHandler } from '../server/studio.mjs';
const parts = CONVERTER_PARTS.map(p => ({id:p.key, name:p.name, note:p.note, parentId:p.parent ?? null}));
const ask = condition => ({schemaVersion:'studio.plan.1',intent:CONVERTER_INTENT,parts:structuredClone(parts),evidence:converterEvidence(condition)});
const answer = condition => converterExampleAnalysis(Object.fromEntries(parts.map(p=>[p.id,p.id])),condition);
test('plan input is bounded by serialized UTF-8 bytes and rejects invented topology',()=>{
  assert.deepEqual(validatePlanAsk(ask('A')),ask('A'));
  const large=ask('A'); large.evidence=Array.from({length:10},(_,i)=>({id:'R'+i,kind:'report',title:'r',text:'한'.repeat(3000),basis:'S0'}));
  assert.throws(()=>validatePlanAsk(large),/INPUT_TOO_LARGE/);
  const cycle=ask('A'); cycle.parts[0].parentId='document'; assert.throws(()=>validatePlanAsk(cycle));
});
test('plan replies must cite actual sources and actual map parts',()=>{
  assert.deepEqual(validatePlanReply(answer('A'),ask('A')),answer('A'));
  assert.throws(()=>validatePlanReply(answer('B'),ask('B')), 'AI overview cannot establish mandatory dependencies');
  const wrong=answer('A'); wrong.impacts[0].refs=['INVENTED'];
  assert.throws(()=>validatePlanReply(wrong,ask('A')));
});
test('plan route uses the existing origin/access/key boundary and validates provider output',async()=>{
  let calls=0, sent;
  const handler=createStudioHandler({env:{DEEPSEEK_API_KEY:'server-only-test-key',STUDIO_ACCESS_CODE:'code'},fetchImpl:async(url,init)=>{
    calls++; sent=JSON.parse(init.body);
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer('A'))}}]});
  }});
  const req=(access='code',origin='https://app.test')=>new Request('https://app.test/api/studio/plan',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-AgentFlow-Request':'1','X-Studio-Access':access},body:JSON.stringify(ask('A'))});
  assert.equal((await handler(req('bad'))).status,401);
  assert.equal((await handler(req('code','https://other.test'))).status,403);
  assert.equal(calls,0);
  const result=await handler(req()); assert.equal(result.status,200); assert.deepEqual((await result.json()).reply,answer('A'));
  assert.equal(calls,1); assert.match(sent.messages[0].content,/변경안 정리 담당/);
  assert.ok(!JSON.stringify(sent).includes('server-only-test-key'));
});

