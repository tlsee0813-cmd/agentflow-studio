import test from 'node:test';
import assert from 'node:assert/strict';
import { questionState } from './helpers.mjs';
import { answerQuestion, reviseAnswer, decideRequirement, editBrief, beginRequest, applyResponse,
  previewSelectionResolution, confirmSelectionResolution } from '../dist/public/shared/project.js';
import { mockInterview } from '../server/providers/mock.mjs';
const reply = state => {
  const started = beginRequest(state);
  return applyResponse(started.state, started.request, {mode:'mock', result:mockInterview(started.request)});
};
const storage = state => state.requirements.find(r => r.id.endsWith(':REQ-storage'));
const tool = state => state.requirements.find(r => r.id.endsWith(':REQ-tools'));
const custom = text => ({optionId:null, disposition:'answered', text});
function lockedBrowser() {
  let state = reply(answerQuestion(questionState(), {optionId:'browser', disposition:'answered', text:'browser'}));
  return decideRequirement(state, storage(state).id, 'confirmed', storage(state).text);
}
function conflicted(input = custom('여러 기기에서 사용하고 싶다.')) {
  return reply(reviseAnswer(lockedBrowser(), input));
}
const resolve = (state, choice) => confirmSelectionResolution(state, previewSelectionResolution(state, storage(state).id, choice));

test('R5.1 exact old reproduction cannot confirm changed text with the stale browser-only acceptance', () => {
  const state = conflicted(); const before = structuredClone(state);
  assert.throws(() => decideRequirement(state, storage(state).id, 'confirmed', state.conflicts[0].expectedText), /SELECTION_CONFLICT/);
  assert.deepEqual(state, before);
  assert.match(storage(state).text, /이 브라우저/);
  assert.equal(storage(state).needsReview, true);
});
test('R5.2 custom answer resolution pairs text with TBD, stays reviewable, attaches new and old provenance', () => {
  const first = lockedBrowser(), old = storage(first), answer = first.answers[0];
  const state = reply(reviseAnswer(first, custom('여러 기기에서 사용하고 싶다.')));
  const preview = previewSelectionResolution(state, old.id, 'apply');
  assert.equal(preview.text, state.conflicts[0].expectedText);
  assert.match(preview.acceptance, /^TBD:/); assert.equal(preview.status, 'proposed');
  const resolved = resolve(state, 'apply'), req = storage(resolved);
  assert.equal(req.id, old.id); assert.equal(req.locked, true);
  assert.match(req.text, /여러 기기/); assert.doesNotMatch(req.acceptance, /기기 간 연결 기능은 요구하지/);
  assert.equal(req.status, 'proposed'); assert.equal(req.needsReview, true);
  assert.equal(resolved.conflicts.length, 0); assert.ok(req.version > old.version);
  assert.equal(resolved.answers[0].id, answer.id); assert.equal(resolved.answers[0].text, '여러 기기에서 사용하고 싶다.');
  assert.ok(old.sourceIds.every(id => req.sourceIds.includes(id)));
  assert.ok(req.sourceIds.includes(resolved.answers[0].sourceId));
  assert.deepEqual(resolved.sources.slice(0,state.sources.length), state.sources);
  const audit = resolved.sources.at(-1); assert.equal(audit.kind, 'customer-confirmation');
  assert.match(audit.text, /새 답변 반영/); assert.match(audit.text, /완료 조건: TBD/);
  assert.ok(req.sourceIds.includes(audit.id));
  assert.throws(() => decideRequirement(resolved, req.id, 'confirmed'), /UNRESOLVED_ACCEPTANCE/);
  const deferred = decideRequirement(resolved, req.id, 'deferred');
  assert.equal(storage(deferred).needsReview, true);
  assert.throws(() => decideRequirement(deferred, req.id, 'confirmed'), /UNRESOLVED_ACCEPTANCE/);
  const summarized = reply(resolved);
  assert.deepEqual(storage(summarized), req); assert.equal(summarized.conflicts.length, 0);
});
test('R5.3 canonical multi-device resolution changes the whole pair, confirms it and clears only its review', () => {
  const state = conflicted({optionId:'multi-device', disposition:'answered', text:'multi-device'});
  const resolved = resolve(state, 'apply'), req = storage(resolved);
  assert.match(req.text, /여러 기기/); assert.match(req.acceptance, /두 기기/);
  assert.equal(req.status, 'confirmed'); assert.equal(req.needsReview, false); assert.equal(req.locked, true);
  assert.equal(resolved.conflicts.length, 0);
  assert.deepEqual(storage(reply(resolved)), req);
});
test('R5.4 keep records an explicit rejection of the new selection without changing the saved answer', () => {
  const first = lockedBrowser(), old = storage(first);
  const state = reply(reviseAnswer(first, custom('여러 기기에서 사용하고 싶다.')));
  const resolved = resolve(state, 'keep'), req = storage(resolved);
  for (const field of ['text','acceptance','status','priority','locked','id']) assert.equal(req[field], old[field]);
  assert.equal(req.needsReview, false); assert.equal(resolved.conflicts.length, 0);
  assert.deepEqual(resolved.answers, state.answers);
  assert.ok(req.sourceIds.includes(state.answers[0].sourceId));
  assert.match(resolved.sources.at(-1).text, /기존 요구 유지.*새 선택을 이 요구에는 적용하지 않음/);
  assert.deepEqual(storage(reply(resolved)), req);
  const changed = reviseAnswer(resolved, custom('이번에는 휴대폰과 공유한다.'));
  assert.equal(changed.conflicts.length, 1); assert.equal(storage(changed).locked, true);
});
test('R5.5 preview/apply/keep cancellation is pure; later input and tampered pairs cannot use an old approval', () => {
  const state = conflicted(), before = structuredClone(state);
  for (const choice of ['apply','keep']) previewSelectionResolution(state, storage(state).id, choice);
  assert.deepEqual(state, before);
  const preview = previewSelectionResolution(state, storage(state).id, 'apply');
  assert.throws(() => confirmSelectionResolution(state, {...preview, acceptance:'남몰래 조건 변경'}), /STALE_RESOLUTION/);
  const changed = reviseAnswer(state, custom('새로운 답변'));
  assert.throws(() => confirmSelectionResolution(changed, preview), /STALE_RESOLUTION/);
  assert.deepEqual(state, before);
});
test('R5.6 resolving storage preserves other requirements, manual values, conflicts, answers and all previous sources', () => {
  let state = conflicted();
  state = {...state, requirements:state.requirements.map(r => r.id === storage(state).id ? {...r, priority:'could'} : r)};
  state = decideRequirement(state, tool(state).id, 'confirmed', '수동 Codex 도구 제약');
  state = editBrief(state, {...state.brief, tools:'claude-only'});
  const others = state.requirements.filter(r => r.id !== storage(state).id);
  const otherConflicts = state.conflicts.filter(c => c.requirementId !== storage(state).id);
  const resolved = resolve(state, 'apply');
  assert.equal(storage(resolved).priority, 'could');
  assert.deepEqual(resolved.requirements.filter(r => r.id !== storage(state).id), others);
  assert.deepEqual(resolved.conflicts, otherConflicts);
  assert.deepEqual(resolved.answers, state.answers);
  assert.deepEqual(resolved.sources.slice(0,state.sources.length), state.sources);
});
test('R5.7 keep tool selection survives repeat summaries; a different selection invalidates only that acknowledgement', () => {
  let state = lockedBrowser();
  state = decideRequirement(state, tool(state).id, 'confirmed', '수동 Codex 도구 제약');
  state = editBrief(state, {...state.brief, tools:'claude-only'});
  state = confirmSelectionResolution(state, previewSelectionResolution(state, tool(state).id, 'keep'));
  const saved = tool(state);
  for (let i=0;i<2;i++) { state=reply(state); assert.deepEqual(tool(state), saved); assert.equal(state.conflicts.length, 0); }
  state=editBrief(state,{...state.brief,tools:'mixed'});
  assert.equal(state.conflicts.length, 1); assert.match(state.conflicts[0].expectedText, /함께/);
  assert.equal(tool(state).text, saved.text); assert.equal(tool(state).locked, true);
});
test('R5.8 matching text/status with different completion criteria still protects the manual acceptance', () => {
  let state = lockedBrowser(); const old = storage(state);
  state = {...state, requirements:state.requirements.map(r => r.id === old.id ? {...r, acceptance:'고객이 수동으로 정한 완료 조건'} : r)};
  state = reviseAnswer(state, {optionId:'browser', disposition:'answered', text:'browser'});
  assert.equal(storage(state).text, old.text); assert.equal(storage(state).acceptance, '고객이 수동으로 정한 완료 조건');
  assert.equal(state.conflicts.length, 1); assert.equal(state.conflicts[0].expectedAcceptance, old.acceptance);
});
test('R5.9 deferred and unknown answers remain unconfirmed when selected for resolution', () => {
  for (const disposition of ['deferred','unknown']) {
    const state = conflicted({optionId:null, disposition, text:'아직 모름'});
    const resolved = resolve(state, 'apply');
    assert.equal(storage(resolved).status, 'deferred'); assert.equal(storage(resolved).needsReview, true);
    assert.match(storage(resolved).acceptance, /^TBD:/); assert.equal(resolved.conflicts.length, 0);
  }
});
