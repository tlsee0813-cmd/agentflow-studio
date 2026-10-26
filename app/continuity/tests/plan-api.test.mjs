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

const scopeAsk = () => {
  const base = ask('A'), items = answer('A').items;
  return { ...base, schemaVersion: 'studio.scope.1', selected: items.slice(0, 1).map(({ id, title, description, partIds, refs }) => ({ id, title, description, partIds, refs })), excluded: items.slice(1).map(item => item.title) };
};
const scopeRequest = (body = scopeAsk(), access = 'code', origin = 'https://app.test') => new Request('https://app.test/api/studio/scope', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-AgentFlow-Request': '1', 'X-Studio-Access': access }, body: JSON.stringify(body)
});

test('scope route sends only the selected scope to its own prompt behind access/origin/input boundaries', async () => {
  const body = scopeAsk(), review = { summary: '선택한 결과의 기존 수단을 재사용할 수 있다.', prerequisites: [], unknowns: ['조건별 실행은 아직 확인하지 않았다.'] };
  let calls = 0, sent;
  const handler = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'scope-server-only-key', STUDIO_ACCESS_CODE: 'code' }, fetchImpl: async (url, init) => {
    calls++; sent = JSON.parse(init.body);
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer scope-server-only-key');
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(review) } }] });
  } });
  assert.equal((await handler(scopeRequest(body, 'bad'))).status, 401);
  assert.equal((await handler(scopeRequest(body, 'code', 'https://other.test'))).status, 403);
  const invented = structuredClone(body); invented.selected[0].partIds = ['invented'];
  assert.equal((await handler(scopeRequest(invented))).status, 400);
  assert.equal(calls, 0);
  const result = await handler(scopeRequest(body));
  assert.equal(result.status, 200); assert.deepEqual((await result.json()).reply, review); assert.equal(calls, 1);
  assert.match(sent.messages[0].content, /선택 범위의 근거 검토자/);
  const input = JSON.parse(sent.messages[1].content.slice(sent.messages[1].content.indexOf('\n') + 1));
  assert.deepEqual(input, body); assert.equal(input.schemaVersion, 'studio.scope.1');
  assert.ok(!JSON.stringify(sent).includes('scope-server-only-key'));
});

test('scope route rejects unknown evidence refs and provider failures without returning substitute reviews', async () => {
  const cases = [
    { response: () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ summary: '근거 오류', prerequisites: [{ title: '전제', reason: '이유', refs: ['invented'] }], unknowns: [] }) } }] }), status: 502, code: 'INVALID_RESPONSE' },
    { response: () => new Response('{}', { status: 503 }), status: 503, code: 'AI_UNAVAILABLE' }
  ];
  for (const entry of cases) {
    const handler = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'scope-server-only-key', STUDIO_ACCESS_CODE: 'code' }, fetchImpl: async () => entry.response() });
    const result = await handler(scopeRequest()); assert.equal(result.status, entry.status);
    assert.deepEqual(await result.json(), { error: { code: entry.code } });
  }
  const off = createStudioHandler({ env: {}, fetchImpl: async () => assert.fail('without a key the scope route must not call the provider') });
  const result = await off(scopeRequest()); assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { error: { code: 'AI_NOT_CONFIGURED' } });
});

