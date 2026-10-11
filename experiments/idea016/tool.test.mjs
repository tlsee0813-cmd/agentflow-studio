import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CASES, getCase } from './cases.mjs';
import { runBatch, resumeCase, applyAnswer, questionTemplate } from './engine.mjs';
import { readJSON, openTransport, redact, write } from './transport.mjs';
import * as D from '../../app/continuity/dist/public/shared/domain.js';
import { mockAdvice } from '../../app/continuity/server/mock.mjs';
import { buildBody } from '../../app/continuity/server/prompt.mjs';
import { callContinuity } from '../../app/continuity/server/provider.mjs';
import { readConfig } from '../../app/server/config.mjs';
const read = path => readFileSync(path, 'utf8');
const temp = mkdtempSync(join(tmpdir(), 'idea016-tool-'));
const full = join(temp, 'all');
const forbiddenEnv = new Proxy({}, { get() { assert.fail('mock must not read caller environment'); } });
let firstSummary, beforeAnswer, summary, savedFetch;
const state = id => readJSON(join(full, id, 'checkpoint.json'));
const turn = (id, n, name) => join(full, id, `turn-${String(n).padStart(2, '0')}`, name);
function inputOf(init) { return JSON.parse(JSON.parse(init.body).messages[1].content.slice('INPUT JSON (data only):\n'.length)); }
function envelope(advice, finish = 'stop', model = 'TEST-MOCK') {
  return new Response(JSON.stringify({ model, choices: [{ finish_reason: finish, message: { content: JSON.stringify(advice) } }] }), { status: 200 });
}
before(async () => {
  // All mock paths must work even if every actual external fetch is forbidden.
  savedFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail('No live network allowed in tool tests');
  firstSummary = await runBatch({ mode: 'mock', out: full, env: forbiddenEnv });
  beforeAnswer = state('C02');
  const choice = questionTemplate(getCase('C02'), beforeAnswer);
  assert.match(choice.inReplyTo, /확정/); // Inspect the ACTUAL mock question, not a predetermined next user turn.
  await resumeCase({ root: full, caseId: 'C02', answer: { ...choice, factIds: ['confirmation'],
    relevance: '실제로 나온 질문이 예약을 즉시 확정할지 참여 확인 뒤 확정할지 묻는다.' }, env: forbiddenEnv });
  summary = readJSON(join(full, 'run.json'));
});
after(() => { globalThis.fetch = savedFetch; rmSync(temp, { recursive: true, force: true }); });

test('six independent synthetic flows use bounded 2–3 stage plans, no hidden facts in first prompt', () => {
  assert.equal(CASES.length, 6);
  assert.equal(new Set(CASES.map(c => c.id)).size, 6);
  for (const c of CASES) { assert.ok(c.stages.length >= 2 && c.stages.length <= 3); assert.equal(state(c.id).phase, 'complete'); }
  assert.equal(firstSummary.appRequests, 13); assert.equal(firstSummary.observedRealDispatches, 0);
  assert.equal(summary.mode, 'mock');
  assert.ok(!/\|\n\n\|/.test(read(join(full, 'REPORT.md'))));
  assert.ok(!/\|\n\n\|/.test(read(join(full, 'C02/report.md'))));
  const raw = read(turn('C02', 1, 'request-provider.raw.json'));
  for (const f of getCase('C02').facts) assert.ok(!raw.includes(f.text));
  assert.ok(!raw.includes('observe')); assert.ok(!raw.includes('probes')); assert.ok(!raw.includes('allowedFacts'));
});

test('actual buildBody bytes, HTTP provider envelope, receive state and handoffText match product functions', () => {
  const config = summary.config;
  for (const c of CASES) {
    for (let n = 1; n <= state(c.id).turnCount; n++) {
      const request = readJSON(turn(c.id, n, 'request-app.json'));
      assert.equal(read(turn(c.id, n, 'request-provider.raw.json')), JSON.stringify(buildBody(request, config)));
      const before = readJSON(turn(c.id, n, 'project-before.json'));
      const response = readJSON(turn(c.id, n, 'response-app.raw.json'));
      assert.equal(response.mode, 'deepseek'); // Provider route selector, NOT real model evidence in mock mode.
      const received = D.receive({ ...before, pending: request.ticket }, request, response);
      assert.deepEqual(received, readJSON(turn(c.id, n, 'project-after-receive.json')));
      let final = received;
      const result = readJSON(turn(c.id, n, 'result.json'));
      for (const [key, value] of Object.entries(result.manualAfter)) final = D.editTask(final, final.currentTaskId, key, value);
      assert.equal(D.handoffText(final), read(turn(c.id, n, 'handoff.md')));
      const trace = readJSON(turn(c.id, n, 'transport.json'));
      assert.equal(trace.transportMock, true); assert.equal(trace.realDispatches, 0); assert.equal(trace.providerDispatches, 1);
    }
  }
});

test('question-only resume records exact-question test_answer, no decision promotion or duplicate submit', () => {
  assert.equal(beforeAnswer.phase, 'awaiting-answer'); assert.equal(beforeAnswer.turnCount, 1);
  const after = state('C02'); assert.equal(after.turnCount, 3); assert.equal(after.project.tasks.length, 2);
  const source = after.project.sources.find(s => s.kind === 'test_answer');
  assert.equal(source.replyTo, D.taskOf(beforeAnswer.project).advice.question.text);
  assert.equal(source.text, getCase('C02').facts.find(f => f.id === 'confirmation').text);
  assert.ok(after.project.bases.every(b => b.sourceId !== source.id));
  const second = readJSON(turn('C02', 2, 'request-app.json'));
  assert.equal(second.ticket.taskId, readJSON(turn('C02', 1, 'request-app.json')).ticket.taskId);
  assert.ok(second.sources.some(s => s.id === source.id));
});

test('mismatched, stale, invented, unselected or mixed-disposition answers are rejected before dispatch', () => {
  const c = getCase('C02'), valid = { ...questionTemplate(c, beforeAnswer), factIds: ['confirmation'], relevance: '질문은 예약 확정 시점을 묻는다.' };
  for (const invalid of [{ ...valid, inReplyTo: '예정해 둔 다른 질문' }, { ...valid, questionSha256: 'wrong' },
    { ...valid, factIds: ['invented'] }, { ...valid, factIds: [] }, { ...valid, text: '자유 정답 주입' },
    { ...valid, factIds: ['confirmation', 'reply-window'] }]) assert.throws(() => applyAnswer(c, beforeAnswer, invalid));
  // Separate unit-only question for the unknown branch: do not pair a waiting-time reply with the confirmation question.
  const waitingState = structuredClone(beforeAnswer);
  D.taskOf(waitingState.project).advice.question = { kind: 'choice', text: '참여 응답을 얼마 동안 기다릴까요?', why: '응답을 기다리는 기간을 정하기 위한 질문', options: [] };
  const unknown = applyAnswer(c, waitingState, { ...questionTemplate(c, waitingState), factIds: ['reply-window'], relevance: '실제 단위 fixture 질문이 응답을 기다리는 기간을 물으며 이 값은 시나리오에서 모름이다.' });
  assert.equal(unknown.project.sources.at(-1).disposition, 'unknown');
  assert.equal(unknown.project.sources.at(-1).kind, 'test_answer');
  assert.throws(() => applyAnswer(c, { ...beforeAnswer, phase: 'inflight' }, valid), /NOT_AWAITING_ANSWER/);
  assert.throws(() => applyAnswer(c, { ...beforeAnswer, turnCount: 3 }, valid), /NOT_AWAITING_ANSWER/);
  // Relevance is an operator's semantic judgment, NOT falsely advertised as automatically verified.
});

test('expert manual scope/checks survive recovery and are sent as previousWork', () => {
  const c = getCase('C03'), req = readJSON(turn('C03', 2, 'request-app.json'));
  assert.equal(req.previousWork.scope, c.stages[0].manualAfter.scope);
  assert.equal(req.previousWork.checks, c.stages[0].manualAfter.checks);
  assert.ok(read(turn('C03', 2, 'handoff.md')).includes(c.stages[0].manualAfter.checks));
  assert.equal(readJSON(turn('C03', 2, 'action.json')).recoveryRoundTrip, true);
});

test('returned report remains report and next request does not create a report-derived basis', () => {
  const p = state('C04').project, report = p.sources.find(s => s.kind === 'report');
  assert.ok(report); assert.equal(p.bases.length, 2);
  assert.ok(p.bases.every(b => b.sourceId !== report.id));
  const request = readJSON(turn('C04', 3, 'request-app.json'));
  assert.ok(request.sources.some(s => s.id === report.id && s.kind === 'report'));
  assert.equal(request.previousWork.taskId, p.tasks[0].id);
});

test('explicit 30→60 change preserves ID/history, excludes old AI and retains manual values (R5)', () => {
  const p = state('C05').project, b = p.bases[0];
  assert.equal(p.bases.length, 1); assert.equal(b.id, 'D1'); assert.equal(b.status, 'confirmed');
  assert.match(b.text, /60일/); assert.match(b.history.at(-1).text, /30일/); assert.match(b.text, /삭제는 하지 않는다/);
  const request = readJSON(turn('C05', 2, 'request-app.json'));
  assert.equal(request.previousWork.aiTextExcluded, true);
  assert.equal(request.previousWork.next, '');
  assert.equal(request.previousWork.checks, getCase('C05').stages[0].manualAfter.checks);
});

test('IDEA017 within-budget old requested tail reaches provider verbatim and stays local/handoff; no quality claim', () => {
  const p = state('C06').project, b = p.bases[0];
  assert.equal(b.status, 'requested'); assert.equal(b.history.length, 0);
  const request = readJSON(turn('C06', 3, 'request-app.json')), basis = request.bases.find(x => x.id === b.id);
  assert.equal(basis.partial, false); assert.equal(basis.text, b.text);
  const trace = readJSON(turn('C06', 3, 'context-trace.json')), probe = trace.probes[0];
  assert.deepEqual(probe.localBasisIds, ['D1']); assert.equal(probe.literalInProviderMessages, true);
  assert.equal(probe.literalInHandoff, true); assert.equal(trace.meaningReview, 'NOT_PERFORMED');
  assert.ok(read(turn('C06', 1, 'request-provider.raw.json')).includes(probe.literal));
});

test('provider malformed/length/authority/status/network failures remain visible, once, without mock fallback', async () => {
  const failures = [
    ['syntax', () => new Response('{not-json'), 'INVALID_RESPONSE'],
    ['length', (_u, init) => envelope(mockAdvice(inputOf(init)), 'length'), 'INVALID_RESPONSE'],
    ['authority', (_u, init) => envelope({ ...mockAdvice(inputOf(init)), status: 'confirmed' }), 'INVALID_RESPONSE'],
    ['rate', () => new Response('upstream 429 diagnostic', { status: 429 }), 'AI_RATE_LIMIT'],
    ['network', () => { throw new Error('private network failure'); }, 'AI_NETWORK_ERROR'],
  ];
  for (const [name, responder, code] of failures) {
    let calls = 0; const out = join(temp, name);
    await runBatch({ mode: 'mock', out, mockResponder: (...args) => { calls++; return responder(...args); } });
    assert.equal(calls, 1); assert.equal(existsSync(join(out, 'C02')), false);
    const checkpoint = readJSON(join(out, 'C01/checkpoint.json'));
    assert.equal(checkpoint.phase, 'failed'); assert.equal(checkpoint.project.tasks[0].advice, null);
    assert.equal(checkpoint.project.bases.length, 1);
    assert.equal(readJSON(join(out, 'C01/turn-01/result.json')).error, code);
    assert.equal(readJSON(join(out, 'C01/turn-01/transport.json')).fallback, false);
    if (name === 'syntax') assert.equal(read(join(out, 'C01/turn-01/response-provider.raw.txt')), '{not-json');
    if (name === 'rate') assert.equal(read(join(out, 'C01/turn-01/response-provider.raw.txt')), 'upstream 429 diagnostic');
  }
});

test('observer bounds oversized capture and does not turn invalid provider bytes into accepted output', async () => {
  const out = join(temp, 'oversized'); let calls = 0;
  await runBatch({ mode: 'mock', out, caseIds: ['C01'], mockResponder: () => {
    calls++; return new Response('x'.repeat(150000));
  } });
  const trace = readJSON(join(out, 'C01/turn-01/transport.json'));
  assert.equal(calls, 1); assert.equal(trace.provider.capturedBytes, 131072); assert.equal(trace.provider.truncated, true);
  assert.equal(readJSON(join(out, 'C01/turn-01/result.json')).accepted, false);
});

test('literal echo is rejected by the product and recorded as an experiment protection error', async () => {
  const out = join(temp, 'echo'), secret = 'IDEA016-NOT-A-REAL-KEY';
  await runBatch({ mode: 'mock', out, caseIds: ['C01'], mockResponder: (_u, init) => envelope({ ...mockAdvice(inputOf(init)), next: secret }, 'stop', secret) });
  function scan(dir) { for (const ent of readdirSync(dir, { withFileTypes: true })) ent.isDirectory() ? scan(join(dir, ent.name)) : assert.ok(!read(join(dir, ent.name)).includes(secret)); }
  scan(out);
  assert.equal(readJSON(join(out, 'C01/turn-01/result.json')).error, 'EXPERIMENT_SECRET_ECHO');
  assert.equal(readJSON(join(out, 'C01/turn-01/transport.json')).httpStatus, 502);
  assert.equal(readJSON(join(out, 'C01/turn-01/transport.json')).provider.responseRedacted, true);
});

test('blank-key live and live/mock injection fail closed; existing result directories are not overwritten', async () => {
  await assert.rejects(runBatch({ mode: 'live', out: join(temp, 'blank-live'), env: { AI_MODE: 'deepseek', DEEPSEEK_API_KEY: '', ALLOW_PAID_AI: 'true' } }), /AI_NOT_CONFIGURED/);
  assert.equal(existsSync(join(temp, 'blank-live')), false);
  await assert.rejects(openTransport({ mode: 'live', mockResponder: () => {} }), /NO_LIVE_MOCK_INJECTION/);
  await assert.rejects(openTransport({ mode: 'live', env: { AI_MODE: 'mock' } }), /LIVE_REQUIRES_DEEPSEEK/);
  await assert.rejects(runBatch({ mode: 'mock', out: full }), /OUTPUT_ALREADY_EXISTS/);
  await assert.rejects(resumeCase({ root: full, caseId: 'C02', answer: {} }), /NOT_AWAITING_ANSWER/);
});


test('stalled provider body times out once; partial response is retained without a fake successful result', { timeout: 20000 }, async () => {
  const out = join(temp, 'timeout'); let calls = 0;
  await runBatch({ mode: 'mock', out, caseIds: ['C01'], mockResponder: () => {
    calls++;
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"choices":[')); } }));
  } });
  const trace = readJSON(join(out, 'C01/turn-01/transport.json'));
  assert.equal(calls, 1); assert.equal(trace.provider.complete, false);
  assert.equal(read(join(out, 'C01/turn-01/response-provider.raw.txt')), '{"choices":[');
  assert.equal(readJSON(join(out, 'C01/turn-01/result.json')).error, 'AI_TIMEOUT');
  assert.equal(readJSON(join(out, 'C01/checkpoint.json')).phase, 'failed');
});


// One focused regression, fake credentials only. Evidence contains flags, never key excerpts.
// The existing before hook still performs its mock-only fixture setup when this test is filtered.
test('IDEA016 rev1 secret echo is blocked before receive and cannot leak into evidence', async t => {
  const reviewFake = 'IDEA016-REVIEW-FAKE-KEY-NEVER-REAL';
  const mockFake = 'IDEA016-NOT-A-REAL-KEY'; // Fixed credential of the existing mock transport, not process.env.
  const escapeFirst = key => '\\u0049' + key.slice(1);
  const unicode = value => value.split('').map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const jsonString = value => JSON.stringify(value).slice(1, -1);
  const request = D.begin(D.submit(D.editDraft(D.createProject(), getCase('C01').stages[0].input.text))).request;
  const advice = { ...mockAdvice(request), next: reviewFake };
  const content = JSON.stringify(advice).replace(reviewFake, escapeFirst(reviewFake));
  assert.ok(!content.includes(reviewFake), 'fixture must bypass only the pre-parse literal check');
  let baselineCalls = 0;
  const baseline = await callContinuity(request, readConfig({ AI_MODE: 'deepseek', DEEPSEEK_API_KEY: reviewFake, ALLOW_PAID_AI: 'true' }), {
    fetchImpl: async () => { baselineCalls++; return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] })); },
  });
  const baselineProviderAccepted = baseline.next === reviewFake;
  assert.ok(baselineProviderAccepted, 'unchanged product provider must reproduce the reviewed decoded echo');
  assert.equal(baselineCalls, 1);
  t.diagnostic('baselineProviderAccepted=true; direct provider used one fake Response; no external fetch');

  const root = process.env.IDEA016_REV1_EVIDENCE ? resolve(process.env.IDEA016_REV1_EVIDENCE) : join(temp, 'rev1-secret');
  mkdirSync(root); // Never overwrite earlier evidence.
  const out = join(root, 'blocked-run'); let calls = 0, requestBytesUnchanged = false;
  await runBatch({ mode: 'mock', out, caseIds: ['C01', 'C02'], env: forbiddenEnv, mockResponder: (_url, init) => {
    calls++;
    const input = inputOf(init);
    requestBytesUnchanged = init.body === JSON.stringify(buildBody(input, readConfig({ AI_MODE: 'deepseek', DEEPSEEK_API_KEY: mockFake, ALLOW_PAID_AI: 'true' })));
    const next = `검사용 민감 반향: ${mockFake}`;
    const text = JSON.stringify({ ...mockAdvice(input), next }).replace(mockFake, escapeFirst(mockFake));
    assert.ok(!text.includes(mockFake), 'inner advice must have no literal mock credential');
    // Outer JSON adds JSON escaping. Metadata also exercises literal and fully Unicode-escaped observations.
    const body = JSON.stringify({ model: mockFake, choices: [{ finish_reason: 'stop', message: { content: text } }],
      usage: { diagnostic: unicode(mockFake) } });
    return new Response(body, { status: 200 });
  } });
  const dir = join(out, 'C01'), turnDir = join(dir, 'turn-01');
  const result = readJSON(join(turnDir, 'result.json'));
  assert.equal(result.error, 'EXPERIMENT_SECRET_ECHO');
  assert.equal(result.accepted, false);
  assert.equal(calls, 1);
  assert.ok(requestBytesUnchanged, 'same buildBody bytes must reach the existing provider');
  assert.equal(existsSync(join(out, 'C02')), false, 'batch must stop before the next case');
  const checkpoint = readJSON(join(dir, 'checkpoint.json'));
  assert.equal(checkpoint.phase, 'failed'); assert.equal(checkpoint.turnCount, 1);
  assert.equal(checkpoint.project.pending, null);
  assert.equal(D.taskOf(checkpoint.project).advice, null);
  assert.equal(D.taskOf(checkpoint.project).handoffs.length, 0);
  const before = readJSON(join(turnDir, 'project-before.json'));
  assert.deepEqual(checkpoint.project.sources, before.sources);
  assert.deepEqual(checkpoint.project.bases, before.bases);
  assert.deepEqual(checkpoint.project.tasks, before.tasks);
  for (const f of ['project-after-receive.json', 'project-after.json']) assert.equal(D.taskOf(readJSON(join(turnDir, f))).advice, null);
  assert.equal(D.taskOf(readJSON(join(dir, 'project-final.json'))).advice, null);
  const observed = readJSON(join(turnDir, 'transport.json'));
  assert.equal(observed.httpStatus, 200, 'product accepted; experiment alone must block the parsed echo');
  assert.equal(observed.observationProtection.error, 'EXPERIMENT_SECRET_ECHO');
  assert.equal(observed.observationProtection.parsedAppResponseEcho, true);
  assert.equal(observed.observationProtection.blockedBeforeReceive, true);
  assert.equal(observed.provider.responseRedacted, true);
  assert.equal(observed.providerDispatches, 1); assert.equal(observed.realDispatches, 0);
  assert.equal(observed.automaticRetry, false); assert.equal(observed.fallback, false);
  for (const f of ['response-provider.raw.txt', 'response-app.raw.json', 'assistant.raw.txt']) {
    assert.ok(read(join(turnDir, f)).includes('[REDACTED_API_KEY]'), 'captured echo must be masked');
  }
  await assert.rejects(resumeCase({ root: out, caseId: 'C01', answer: {}, env: forbiddenEnv }), /NOT_AWAITING_ANSWER/);
  assert.equal(calls, 1, 'failed case cannot be retried through resume');

  // The same key-bound writer used by engine/report also protects derived JSON and text defensively.
  const bound = await openTransport({ mode: 'mock', env: forbiddenEnv });
  const derived = join(root, 'writer-probes'); mkdirSync(derived);
  try {
    const value = { untouched: '정상 값은 그대로', text: [mockFake, escapeFirst(mockFake), unicode(mockFake), jsonString(unicode(mockFake))].join(' | ') };
    bound.write(join(derived, 'checkpoint.json'), value);
    bound.write(join(derived, 'handoff.md'), value.text);
    assert.equal(readJSON(join(derived, 'checkpoint.json')).untouched, value.untouched);
    assert.equal(bound.dispatches, 0);
  } finally { await bound.close(); }
  // A second fake with quotes/backslash/control characters makes JSON-escaped coverage nontrivial.
  const escapedFake = 'IDEA016-FAKE-"QUOTE"\\PATH\nEND';
  const forms = [escapedFake, jsonString(escapedFake), jsonString(jsonString(escapedFake)), unicode(escapedFake),
    escapeFirst(escapedFake), jsonString(unicode(escapedFake))];
  for (let i = 0; i < forms.length; i++) {
    const text = `before ${forms[i]} after`;
    assert.ok(redact(text, escapedFake) === 'before [REDACTED_API_KEY] after', 'whole known credential must be masked, not excerpts');
    write(join(derived, `escaped-${i}.txt`), text, { secret: escapedFake });
  }
  assert.equal(redact('safe \\u0041 JSON sample', mockFake), 'safe \\u0041 JSON sample');
  // Independent decoding scan; do not use the redactor itself as the leak oracle.
  let filesScanned = 0;
  function scan(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.isDirectory()) { scan(path); continue; }
      let text = read(path); filesScanned++;
      for (let layer = 0; layer < 6; layer++) {
        for (const key of [reviewFake, mockFake, escapedFake]) {
          assert.ok(!text.includes(key) && !text.includes(key.slice(1)), 'written evidence contains a credential or remainder');
        }
        text = text.replace(/\\(?:u([0-9a-fA-F]{4})|(["\\/bfnrt]))/g, (_m, hex, esc) => hex ? String.fromCharCode(parseInt(hex, 16)) :
          ({ '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' })[esc]);
      }
    }
  }
  scan(root);
  write(join(root, 'summary.json'), { test: 'IDEA016 rev1 secret echo', baselineProviderAccepted, requestBytesUnchanged,
    engineAppHttpStatus: observed.httpStatus, error: result.error, accepted: result.accepted, phase: checkpoint.phase,
    actualProductProvider: true, actualLoopbackHttp: true, receivedBeforeBlock: false, providerStubCalls: calls,
    directProviderStubCalls: baselineCalls, writerOnlyDispatches: 0, externalFetchCalls: 0, automaticRetries: 0, fallback: false,
    nextCaseStarted: false, filesScanned, credentialExcerptsRecorded: false,
    note: 'Fake Response only; no actual key access. Existing before hook runs its mock-only fixture setup. No live quality or exhaustive encoding audit.' });
});
