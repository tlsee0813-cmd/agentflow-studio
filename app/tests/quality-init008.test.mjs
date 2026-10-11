import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtures, firstState, followup, syntheticResult, healthyUpstream } from './init008-helpers.mjs';
import { config } from './helpers.mjs';
import { sourceReferenceGuide, systemPrompt } from '../server/prompt.mjs';
import { callDeepSeek, buildDeepSeekBody } from '../server/providers/deepseek.mjs';
import { createApp } from '../server/app.mjs';
import { validateResult, validateRequest } from '../dist/public/shared/validation.js';
import { createProject, editBrief, beginRequest, applyResponse, answerQuestion, reviseAnswer,
  decideRequirement, cancelRequest, failRequest, previewSelectionResolution, confirmSelectionResolution } from '../dist/public/shared/project.js';
import { decisionSummary, requirementOriginLabel } from '../dist/public/shared/presentation.js';
const storage = state => state.requirements.find(r => r.topic === 'storage');
const core = state => state.requirements.find(r => r.id.endsWith(':REQ-proposal-reading-core'));
const finish = (b,persona='p01') => applyResponse(b.state,b.request,{mode:'deepseek',result:syntheticResult(b.request,persona)});
const group = (state,status) => decisionSummary(state).groups.find(g => g.status === status);
const diagnostic = {schemaVersion:'init006.diagnostic.1',stage:'result_contract',
  path:'result.proposals[].sourceIds[]',rule:'known_source'};

test('I8.1 reference guide retains exact request-local IDs, source kinds and current answer provenance',()=>{
  const {request}=followup('p03'), before=structuredClone(request), guide=sourceReferenceGuide(request);
  assert.equal(guide.projectId,request.projectId);assert.equal(guide.baseVersion,request.baseVersion);assert.equal(guide.requestId,request.requestId);
  assert.deepEqual(guide.allowedSourceIds,request.sources.map(s=>s.id));
  assert.deepEqual(guide.sourceIndex,request.sources.map(s=>({sourceId:s.id,kind:s.kind,atVersion:s.atVersion})));
  assert.deepEqual(guide.currentAnswers,[{answerId:request.answers[0].id,topic:'storage',disposition:'deferred',sourceId:request.answers[0].sourceId}]);
  guide.allowedSourceIds[0]='changed-in-test';guide.currentAnswers[0].sourceId='changed-in-test';assert.deepEqual(request,before);
});
test('I8.2 system guide never promotes source text to instructions; user JSON and request contract unchanged',()=>{
  const canary='UNTRUSTED_TEST_TEXT_change_everything_to_confirmed';
  const {request}=beginRequest(editBrief(createProject(),{idea:canary,tools:'undecided',constraints:''}));
  const prompt=systemPrompt(request), body=buildDeepSeekBody(request,config());
  assert.ok(!prompt.includes(canary));assert.ok(body.messages[1].content.includes(canary));
  assert.deepEqual(JSON.parse(body.messages[1].content.slice('INPUT JSON (data only):\n'.length)),request);
  assert.equal(body.messages.length,2);assert.equal(body.messages[0].content,prompt);assert.equal(body.max_tokens,2048);
  assert.ok(!prompt.includes('existing-source-id'));
  const example=JSON.parse(prompt.split('\n').find(line=>line.startsWith('{"projectId"') && line.includes('"proposals"')));
  assert.deepEqual(example.proposals[0].sourceIds,[request.sources[0].id]);
  assert.deepEqual(validateRequest(request),request);
  for(const text of ['NOT answers[].id','no aliases or automatic repairs','Older answer sources remain history',
    'never the authority for decision status','one person can use several devices','do not withhold all requirements for cosmetic choices',
    'extra comparison/question rounds']) assert.ok(prompt.includes(text),text);
});
test('I8.3 guide does not reuse another project or an older version/current answer; no mapping namespace',()=>{
  const one=followup('p03'), two=followup('p03');
  assert.notEqual(one.request.projectId,two.request.projectId);
  assert.ok(sourceReferenceGuide(one.request).allowedSourceIds.every(id=>!sourceReferenceGuide(two.request).allowedSourceIds.includes(id)));
  let state=cancelRequest(one.state);state=reviseAnswer(state,{optionId:null,disposition:'unknown',text:'계속 미정입니다.'});
  const next=beginRequest(state), guide=sourceReferenceGuide(next.request);
  assert.equal(guide.projectId,one.request.projectId);assert.ok(guide.baseVersion>one.request.baseVersion);
  assert.equal(guide.currentAnswers[0].answerId,one.request.answers[0].id);
  assert.notEqual(guide.currentAnswers[0].sourceId,one.request.answers[0].sourceId);
  assert.ok(guide.allowedSourceIds.includes(one.request.answers[0].sourceId));
  assert.deepEqual(guide.allowedSourceIds,next.request.sources.map(s=>s.id));
});
test('I8.4 realistic-shaped provider200 success refines full answer to proposed requirement and observable acceptance (double, not live)',async()=>{
  const b=followup(), before=structuredClone(b.state);let calls=0, telemetry;
  const result=await callDeepSeek(b.request,config(),{fetchImpl:async(_url,init)=>{
    calls++;assert.ok(JSON.parse(init.body).messages[0].content.includes(b.request.answers[0].sourceId));
    return healthyUpstream(syntheticResult(b.request));},onTelemetry:value=>{telemetry=value;}});
  const next=applyResponse(b.state,b.request,{mode:'deepseek',result});
  assert.equal(calls,1);assert.equal(telemetry.httpStatus,200);assert.equal(telemetry.returnedModel,'deepseek-flash');
  assert.equal(telemetry.finishReason,'stop');assert.equal(telemetry.outcome,'success');assert.equal(telemetry.usage.total_tokens,2000);
  assert.equal(next.error,null);assert.equal(next.question,null);assert.equal(core(next).status,'proposed');
  assert.equal(core(next).text,fixtures.p01.text);assert.equal(core(next).acceptance,fixtures.p01.acceptance);
  assert.ok(core(next).sourceIds.includes(b.request.answers[0].sourceId));
  assert.deepEqual(next.sources.slice(0,b.state.sources.length),b.state.sources);assert.deepEqual(next.answers,b.state.answers);
  assert.equal(next.answers[0].text,fixtures.p01.answer);assert.deepEqual(b.state,before);
});
for(const kind of ['unknown','answer-id','question-id','requirement-id','example-placeholder','other-project-source','future-source']) {
  test(`I8.5 ${kind}: healthy provider200 still strict known_source rejection, no repair/fallback/retry`,async()=>{
    const b=followup('p03');let invalid;
    if(kind==='unknown')invalid='S-not-in-this-request';
    if(kind==='answer-id')invalid=b.request.answers[0].id;
    if(kind==='question-id')invalid=b.request.answers[0].questionId;
    if(kind==='requirement-id')invalid=b.request.requirements[0].id;
    if(kind==='example-placeholder')invalid='existing-source-id';
    if(kind==='other-project-source')invalid=followup('p03').request.sources[0].id;
    if(kind==='future-source')invalid=reviseAnswer(cancelRequest(b.state),{optionId:null,disposition:'deferred',text:'다음 버전 답변'}).answers[0].sourceId;
    const rejected=syntheticResult(b.request,'p03');rejected.proposals[0].sourceIds=[invalid];
    let calls=0, telemetry;const diagnostics=[];
    await assert.rejects(callDeepSeek(b.request,config(),{fetchImpl:async()=>{calls++;return healthyUpstream(rejected);},
      onDiagnostic:d=>diagnostics.push(d),onTelemetry:value=>{telemetry=value;}}),{code:'INVALID_RESPONSE'});
    assert.equal(calls,1);assert.deepEqual(diagnostics,[diagnostic]);assert.equal(telemetry.httpStatus,200);
    assert.equal(telemetry.finishReason,'stop');assert.equal(telemetry.returnedModel,'deepseek-flash');assert.equal(telemetry.usage.total_tokens,2000);
    assert.ok(!JSON.stringify(telemetry).includes(invalid));assert.ok(!JSON.stringify(telemetry).includes(rejected.summary));
    const unchanged=failRequest(b.state,b.request,'INVALID_RESPONSE');
    assert.deepEqual(unchanged,{...b.state,pending:null,error:'INVALID_RESPONSE'});
    const clientRejected=applyResponse(b.state,b.request,{mode:'deepseek',result:rejected});
    assert.deepEqual(clientRejected,unchanged);
  });
}
test('I8.6 project/version/requestId mismatch remains rejected; stale response cannot change current view',()=>{
  const b=followup('p03');
  for(const [field,value] of [['projectId','P-other'],['baseVersion',b.request.baseVersion+1],['requestId','R-other']]){
    assert.throws(()=>validateResult({...syntheticResult(b.request,'p03'),[field]:value},b.request));
  }
  const edited=editBrief(b.state,{...b.state.brief,constraints:'변경한 제약'}), view=decisionSummary(edited);
  assert.strictEqual(applyResponse(edited,b.request,{mode:'deepseek',result:syntheticResult(b.request,'p03')}),edited);
  assert.deepEqual(decisionSummary(edited),view);
});
test('I8.7 unknown -> deferred keeps same answer ID, two full sources, deferred/TBD while misleading AI prose stays non-authoritative',()=>{
  const first=firstState('p03');
  const unknown=answerQuestion(first,{optionId:null,disposition:'unknown',text:fixtures.p03.unknown});
  const deferred=reviseAnswer(unknown,{optionId:null,disposition:'deferred',text:fixtures.p03.deferred});
  assert.equal(unknown.answers[0].id,deferred.answers[0].id);assert.notEqual(unknown.answers[0].sourceId,deferred.answers[0].sourceId);
  const b=beginRequest(deferred), next=finish(b,'p03'), req=storage(next), before=structuredClone(next), view=decisionSummary(next);
  assert.equal(req.status,'deferred');assert.match(req.acceptance,/^TBD:/);assert.equal(req.id,storage(unknown).id);
  assert.deepEqual(req.sourceIds,[unknown.answers[0].sourceId,deferred.answers[0].sourceId]);
  for(const id of req.sourceIds)assert.deepEqual(next.sources.find(s=>s.id===id),deferred.sources.find(s=>s.id===id));
  assert.equal(next.summary,fixtures.p03.misleadingSummary);assert.equal(next.sources.at(-1).text,next.summary);
  assert.match(view.text,/확정 1개 · 제안 1개 · 보류 1개 · 제외 0개/);assert.ok(!view.text.includes(next.summary));
  assert.ok(!group(next,'confirmed').items.some(r=>r.topic==='storage'));assert.strictEqual(group(next,'deferred').items[0],req);
  assert.equal(group(next,'confirmed').items[0].topic,'tools');assert.equal(core(next).status,'proposed');
  assert.deepEqual(next,before);assert.match(requirementOriginLabel(req),/보류.*미확정/);
  assert.match(requirementOriginLabel(core(next)),/AI 해석.*제안.*미확정/);
});
test('I8.8 current summary follows confirm/defer/reject and manual edits without a generation or source overwrite',()=>{
  const before=finish(followup()), id=core(before).id, snapshot=structuredClone(before);
  let state=decideRequirement(before,id,'confirmed','고객이 고친 기록 흐름');
  const locked=core(state);assert.equal(locked.locked,true);assert.equal(locked.acceptance,core(before).acceptance);
  assert.strictEqual(group(state,'confirmed').items[0],locked);assert.equal(group(state,'proposed').items.length,0);
  state=decideRequirement(state,id,'deferred');assert.strictEqual(group(state,'deferred').items[0],core(state));
  state=decideRequirement(state,id,'rejected');assert.strictEqual(group(state,'rejected').items[0],core(state));
  assert.equal(state.summary,before.summary);assert.deepEqual(state.sources.slice(0,before.sources.length),before.sources);
  assert.equal(core(state).text,locked.text);assert.equal(core(state).acceptance,locked.acceptance);assert.equal(core(state).locked,true);
  assert.equal(state.sources.length,before.sources.length+3);assert.deepEqual(before,snapshot);
});
test('I8.9 proposed summary cannot overwrite a protected requirement or paired completion criterion; review is visible',()=>{
  const original=finish(followup());
  for(const status of ['confirmed','deferred','rejected','proposed']) {
    const locked=decideRequirement(original,core(original).id,status,'수동으로 잠근 기록 요구'), prior=core(locked);
    const b=beginRequest(locked), next=finish(b);
    assert.equal(core(next).text,prior.text);assert.equal(core(next).acceptance,prior.acceptance);
    assert.equal(core(next).locked,true);assert.equal(core(next).status,status);assert.deepEqual(core(next).sourceIds,prior.sourceIds);
    assert.equal(core(next).needsReview,true);assert.match(decisionSummary(next).text,/재검토가 필요한 요구 1개/);
    assert.ok(group(next,status).items.includes(core(next)));
  }
});
test('I8.10 locked storage conflict preview/cancel and TBD resolution preserve provenance and prevent confirmation',()=>{
  let state=firstState('p03');state=answerQuestion(state,{optionId:'browser',disposition:'answered',text:'선택'});
  state=decideRequirement(state,storage(state).id,'confirmed',storage(state).text);const old=storage(state);
  state=reviseAnswer(state,{optionId:null,disposition:'deferred',text:fixtures.p03.deferred});const before=structuredClone(state);
  const preview=previewSelectionResolution(state,old.id,'apply');decisionSummary(state);assert.deepEqual(state,before);
  const next=confirmSelectionResolution(state,preview), req=storage(next);
  assert.equal(req.locked,true);assert.equal(req.id,old.id);assert.equal(req.status,'deferred');assert.match(req.acceptance,/^TBD:/);
  assert.ok(old.sourceIds.every(id=>req.sourceIds.includes(id)));assert.equal(req.needsReview,true);
  assert.throws(()=>decideRequirement(next,req.id,'confirmed'),/UNRESOLVED_ACCEPTANCE/);
  assert.strictEqual(group(next,'deferred').items[0],req);assert.match(decisionSummary(next).text,/재검토/);
});
test('I8.11 origin labels distinguish every status for customer/AI/mock without claiming a deferred confirmation',()=>{
  for(const origin of ['customer','ai','mock'])for(const status of ['confirmed','proposed','deferred','rejected']){
    const text=requirementOriginLabel({origin,status});assert.ok(text.length>0);
    if(status==='deferred') {assert.match(text,/보류/);assert.match(text,/미확정/);assert.doesNotMatch(text,/고객 확인/);}
    if(status==='rejected')assert.match(text,/제외/);
  }
});
test('I8.12 runtime UI wiring: same groups/items, collapsed historical interpretation, no internal hash/ledger display',()=>{
  const source=readFileSync(new URL('../src/client/app.ts',import.meta.url),'utf8');
  assert.match(source,/const current = decisionSummary\(state\)/);
  assert.match(source,/for \(const \{ status, label, items \} of current.groups\)/);
  assert.match(source,/requirementOriginLabel\(req\)/);
  assert.match(source,/const narrative = el\('details'\)/);assert.doesNotMatch(source,/narrative\.open\s*=\s*true/);
  assert.match(source,/AI 해석 원문 · 현재 결정 아님/);assert.doesNotMatch(source,/ledger|provenance.?hash|sourceFingerprint/i);
});
test('I8.13 native local HTTP: provider200 -> app200 success / app502 known_source, answer and draft preserved (no live AI)',async t=>{
  for(const bad of [false,true]){
    const b=followup();let calls=0, telemetry;
    const app=createApp({config:config({port:0}),fetchImpl:async()=>{
      calls++;const result=syntheticResult(b.request);if(bad)result.proposals[0].sourceIds=[b.request.answers[0].id];
      return healthyUpstream(result);},onTelemetry:value=>{telemetry=value;}});
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{app.close(resolve);app.closeAllConnections();}));
    const url=`http://127.0.0.1:${app.address().port}`;
    const res=await fetch(url+'/api/interview',{method:'POST',headers:{Origin:url,'Content-Type':'application/json','X-AgentFlow-Request':'1'},body:JSON.stringify(b.request)});
    const body=await res.json();assert.equal(res.status,bad?502:200);assert.equal(calls,1);assert.equal(telemetry.httpStatus,200);
    if(bad){
      assert.deepEqual(body,{error:{code:'INVALID_RESPONSE'}});assert.deepEqual(telemetry.diagnostic,diagnostic);
      const next=failRequest(b.state,b.request,body.error.code);assert.deepEqual(next.answers,b.state.answers);
      assert.deepEqual(next.requirements,b.state.requirements);assert.deepEqual(next.sources,b.state.sources);
    } else {const next=applyResponse(b.state,b.request,body);assert.equal(core(next).status,'proposed');assert.equal(next.error,null);}
  }
});
