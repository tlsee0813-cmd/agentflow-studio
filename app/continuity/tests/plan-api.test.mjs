import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlanAsk, validatePlanReply } from '../dist/public/shared/plan-api.js';
import { CONVERTER_PARTS, converterEvidence, CONVERTER_INTENT, converterExampleAnalysis } from '../dist/public/shared/change-plan-example.js';
import { createStudioHandler } from '../server/studio.mjs';
import { mapReply } from '../dist/public/client/plan-source.js';
const parts = CONVERTER_PARTS.map(p => ({id:p.key, name:p.name, note:p.note, parentId:p.parent ?? null}));
const ask = condition => ({schemaVersion:'studio.plan.1',intent:CONVERTER_INTENT,parts:structuredClone(parts),evidence:converterEvidence(condition)});
const answer = condition => converterExampleAnalysis(Object.fromEntries(parts.map(p=>[p.id,p.id])),condition);

test('source-bound presentation checks exact excerpts and intent attribution against the request, without normalizing output', () => {
  const input = ask('A'), reply = answer('A');
  reply.items[0].presentation[0].current.text = '현재 합성 자료에서는\n  한 번에 문서 하나를 받는다.';
  const before = structuredClone(reply); assert.deepEqual(validatePlanReply(reply, input), before);
  const invalid = [
    r => { r.items[0].presentation[0].current.text = '현재는 폴더를 받는다.'; },
    r => { r.items[0].presentation[0].current.text = '본문·표·문단 모양을 보존하며 변환한다.'; }, // another part's note
    r => { r.items[2].presentation[0].current.text = '파일별 결과를 모두 보여 준다.'; },
    r => { r.items[2].presentation[0].current.refs = ['T01']; }, // quote exists, but not in this cited source
    r => { r.items[2].presentation[0].wanted.refs = ['P03']; }, // intent cannot cite only code
    r => { r.items[2].presentation[0].wanted.refs = ['T01']; },
  ];
  for (const mutate of invalid) { const r = answer('A'); mutate(r); assert.throws(() => validatePlanReply(r, input)); }
  const suggestion = answer('A'); suggestion.items[2].presentation[0].origin = 'suggestion'; suggestion.items[2].presentation[0].wanted.refs = ['P03'];
  assert.equal(validatePlanReply(suggestion, input).items[2].presentation[0].origin, 'suggestion');
  const punctuation = answer('A'); punctuation.items[0].presentation[0].current.text += '…';
  assert.throws(() => validatePlanReply(punctuation, input), 'only whitespace differences are allowed');
  const legacy = answer('A'); legacy.items.forEach(i => { delete i.presentation; });
  assert.deepEqual(validatePlanReply(legacy, input), legacy);
});

test('authored A/B presentation keeps actual target identity, synthetic source scope and condition-specific current evidence', () => {
  for (const condition of ['A', 'B']) {
    const reply = answer(condition), input = ask(condition);
    // Examples may have explicit dependencies; the AI reply contract still forbids them.
    const aiShape = structuredClone(reply); aiShape.items.forEach(i => { i.dependsOn = []; });
    assert.deepEqual(validatePlanReply(aiShape, input), aiShape);
    for (const item of reply.items) {
      const shown = item.presentation ?? [];
      assert.equal(new Set(shown.map(p => p.partId)).size, shown.length);
      for (const p of shown) {
        assert.ok(item.partIds.includes(p.partId));
        assert.ok(p.current.text.length <= 48 && p.wanted.text.length <= 48);
        assert.ok(!shown.some(other => other.partId === parts.find(part => part.id === p.partId)?.parentId), 'do not duplicate a target into its parent');
        if (p.current.source === 'evidence') {
          const basis = input.evidence.find(e => e.id === p.current.refs[0]).basis;
          assert.match(basis, /합성.*main@S0/);
          if (p.current.refs.includes('P03')) assert.match(basis, new RegExp(`조건 ${condition}`));
        }
      }
    }
    // No same-side current text exists for failure continuation or for keeping outputs: those targets stay honest fallbacks
    // (no pair of a single input or a part's role with the wanted behaviour). Reading and result pairs remain.
    assert.ok(!Object.hasOwn(reply.items.find(i => i.id === 'continue'), 'presentation'));
    const failures = reply.items.find(i => i.id === 'failures').presentation;
    assert.deepEqual(failures.map(p => p.partId), ['results']);
    assert.equal(reply.items.find(i => i.id === 'folder').presentation[0].partId, 'document');
    if (condition === 'B') assert.equal(reply.items.find(i => i.id === 'outcomes').presentation[0].origin, 'suggestion');
  }
});

test('mapping reply aliases maps presentation targets too, keeps source aliases and rejects wrong-item targets', () => {
  const reply = answer('A'), input = { parts: new Map(parts.map((p, i) => [p.id, `REAL_${i}`])), evidence: converterEvidence('A') };
  const mapped = mapReply(reply, input);
  for (const [index, item] of reply.items.entries()) for (const [j, p] of (item.presentation ?? []).entries()) {
    assert.equal(mapped.items[index].presentation[j].partId, input.parts.get(p.partId));
    assert.deepEqual(mapped.items[index].presentation[j].current.refs, p.current.refs);
    assert.deepEqual(mapped.items[index].presentation[j].wanted.refs, p.wanted.refs);
  }
  assert.ok(!Object.hasOwn(mapped.items[1], 'presentation'), 'an item without presentation stays without it');
  const bad = answer('A'); bad.items[0].presentation[0].partId = 'results';
  assert.throws(() => mapReply(bad, input));
  const legacy = answer('A'); legacy.items.forEach(i => { delete i.presentation; });
  assert.ok(mapReply(legacy, input).items.every(i => !Object.hasOwn(i, 'presentation')));
});
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

