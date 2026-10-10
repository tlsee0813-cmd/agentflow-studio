import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, questionState, branch } from './helpers.mjs';
import { mockInterview } from '../server/providers/mock.mjs';
import { applyResponse, answerQuestion, editBrief, beginRequest, decideRequirement, failRequest, cancelRequest } from '../dist/public/shared/project.js';
import { validateRequest, validateResult } from '../dist/public/shared/validation.js';

test('D01 customer tool choice is confirmed; mock proposals are not', () => {
  const state = questionState();
  assert.equal(state.requirements.find(r => r.topic === 'tools').status,'confirmed');
  assert.equal(state.requirements.find(r => r.origin === 'mock').status,'proposed');
  assert.equal(state.question.topic,'storage');
  assert.ok(state.requirements.every(r => r.scope === 'user-project'));
});
test('D02 local and multi-device answers change actual requirements and open decisions', () => {
  const local = branch('browser'), multi = branch('multi-device');
  const a = applyResponse(local.state,local.request,{mode:'mock',result:local.result});
  const b = applyResponse(multi.state,multi.request,{mode:'mock',result:multi.result});
  assert.match(a.requirements.find(r => r.topic === 'storage').text,/동기화는 첫 범위에서 제외/);
  assert.match(b.requirements.find(r => r.topic === 'storage').text,/여러 기기/);
  assert.ok(b.openItems.some(s => s.includes('접근 제어')));
  assert.ok(b.requirements.every(r => r.scope === 'user-project'));
  assert.equal(b.question,null); assert.equal(b.phase,'summary');
});
for (const disposition of ['unknown','deferred']) test(`D03 ${disposition} does not silently choose local storage`, () => {
  const b = branch(null,disposition,'아직 정하지 않음');
  const state = applyResponse(b.state,b.request,{mode:'mock',result:b.result});
  const r = state.requirements.find(r => r.topic === 'storage');
  assert.equal(r.status,'deferred'); assert.doesNotMatch(r.text,/한 곳에만/);
});
test('D04 custom storage answer remains interpretation pending', () => {
  const state = answerQuestion(questionState(),{optionId:null,disposition:'answered',text:'회사에서는 공유하지만 집에서는 오프라인 사용'});
  assert.equal(state.requirements.find(r => r.topic === 'storage').status,'proposed');
  assert.match(state.answers[0].text,/오프라인/);
});
test('D05 confirmation is per requirement and keeps stable IDs and provenance', () => {
  const state = questionState(), req = state.requirements.find(r => r.origin === 'mock');
  const updated = decideRequirement(state,req.id,'confirmed');
  const confirmed = updated.requirements.find(r => r.id === req.id);
  assert.equal(confirmed.status,'confirmed'); assert.equal(confirmed.id,req.id);
  assert.equal(confirmed.sourceIds.length,req.sourceIds.length+1);
  assert.equal(updated.sources.at(-1).kind,'customer-confirmation');
  assert.equal(updated.ideas.length,state.ideas.length);
});
test('D06 manual edits / ID / locked values survive another AI proposal with the same key', () => {
  let state = questionState(); const req = state.requirements.find(r => r.origin === 'mock');
  state = decideRequirement(state,req.id,'confirmed','고객이 직접 고친 중요한 내용');
  const begun = beginRequest(state); const result = mockInterview(begun.request); result.proposals[0].text = 'AI가 덮어쓰려는 내용';
  const next = applyResponse(begun.state,begun.request,{mode:'deepseek',result});
  assert.equal(next.requirements.find(r => r.id === req.id).text,'고객이 직접 고친 중요한 내용');
  assert.equal(next.requirements.find(r => r.id === req.id).locked,true);
  assert.ok(next.openItems.some(s => s.includes('보존')));
});
test('D07 malformed response is atomic: no inputs, answers or requirements lost', () => {
  const b = branch('multi-device'); const before = structuredClone(b.state);
  const invalid = {...b.result, proposals:[...b.result.proposals,{key:'bad',text:'partial'}]};
  const next = applyResponse(b.state,b.request,{mode:'mock',result:invalid});
  assert.equal(next.error,'INVALID_RESPONSE'); assert.deepEqual(next.requirements,before.requirements);
  assert.deepEqual(next.brief,before.brief); assert.deepEqual(next.answers,before.answers); assert.deepEqual(next.sources,before.sources);
});
test('D08 response after customer edits is ignored by request ID AND version', () => {
  const b = initial(), response = {mode:'mock',result:mockInterview(b.request)};
  const edited = editBrief(b.state,{...b.state.brief,idea:'새로 수정한 독서 기록 서비스'});
  assert.strictEqual(applyResponse(edited,b.request,response),edited);
  assert.strictEqual(failRequest(edited,b.request,'AI_TIMEOUT'),edited);
});
test('D09 old response cannot overwrite a newer in-flight request', () => {
  const b = initial(); const canceled = cancelRequest(b.state); const current = beginRequest(canceled);
  assert.strictEqual(applyResponse(current.state,b.request,{mode:'mock',result:mockInterview(b.request)}),current.state);
});
test('D10 confirmation during a pending response invalidates the response', () => {
  const state = questionState(), started = beginRequest(state);
  const edited = decideRequirement(started.state,state.requirements[0].id,'deferred');
  assert.strictEqual(applyResponse(edited,started.request,{mode:'mock',result:mockInterview(started.request)}),edited);
});
test('D11 proposal cannot smuggle confirmed status, foreign sources or project ID', () => {
  const b = initial();
  for (const mutate of [r=>r.proposals[0].status='confirmed',r=>r.proposals[0].sourceIds=['foreign-source'],r=>r.projectId='other-project']) {
    const result = mockInterview(b.request); mutate(result);
    assert.throws(()=>validateResult(result,b.request));
  }
});
test('D12 >3 ideas, duplicate keys, invalid options and repeated tool question rejected', () => {
  const b = initial();
  for (const mutate of [r=>r.ideas=[r.ideas[0],r.ideas[0],r.ideas[0],r.ideas[0]],r=>r.proposals.push(r.proposals[0]),r=>r.question.options.push(r.question.options[0]),r=>r.question.topic='tools']) {
    const result = mockInterview(b.request); mutate(result); assert.throws(()=>validateResult(result,b.request));
  }
});
test('D13 second interview turn must summarize, not ask endlessly', () => {
  const b = branch(); b.result.question = questionState().question;
  assert.throws(()=>validateResult(b.result,b.request));
});
test('D14 mock skips known storage input; unknown ideas do not all get technical storage questions', () => {
  let b = initial('개인 할 일은 여러 기기에서 사용할 예정이다.'); assert.equal(mockInterview(b.request).question,null);
  b = initial('독서를 돕는 서비스를 만들고 싶다.'); assert.equal(mockInterview(b.request).question.topic,'core-scene');
});
test('D15 AI data-scope suggestions cannot replace explicit storage choice', () => {
  const b = branch('browser'); b.result.proposals.push({...b.result.proposals[0],key:'wrong-storage',topic:'storage',text:'모든 자료를 클라우드로 전송한다'});
  const next = applyResponse(b.state,b.request,{mode:'deepseek',result:b.result});
  assert.equal(next.requirements.filter(r=>r.topic==='storage').length,1);
  assert.doesNotMatch(JSON.stringify(next.requirements),/클라우드로 전송/);
});
test('D16 malformed client requests and duplicate source IDs are rejected', () => {
  const b = initial(); assert.throws(()=>validateRequest({...b.request,providerUrl:'https://example.invalid'}));
  b.request.sources.push(b.request.sources[0]); assert.throws(()=>validateRequest(b.request));
});
test('D17 AI cannot redefine canonical storage option consequences', () => {
  const b = initial(); const result = mockInterview(b.request);
  result.question.options[0].label = '여러 기기로 보내기'; result.question.options[0].consequence = '동기화';
  const next = applyResponse(b.state,b.request,{mode:'deepseek',result});
  assert.equal(next.question.options[0].label,'이 브라우저 한 곳에서만');
});
test('D18 improvement proposals carry stable IDs, source, version and proposed state', () => {
  const first = questionState(), started=beginRequest(first);
  const next=applyResponse(started.state,started.request,{mode:'mock',result:mockInterview(started.request)});
  assert.equal(next.ideas[0].id,first.ideas[0].id);
  assert.equal(next.ideas[0].status,'proposed');
  assert.ok(next.ideas[0].sourceIds.every(id=>next.sources.some(s=>s.id===id)));
  assert.equal(next.requirements.find(r=>r.origin==='mock').priority,'undecided');
});
