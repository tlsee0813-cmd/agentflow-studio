import { existsSync, mkdirSync, readFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../../app/continuity/dist/public/shared/domain.js';
import { parseProject } from '../../app/continuity/dist/public/shared/validation.js';
import { serializeProject } from '../../app/continuity/dist/public/shared/storage.js';
import { CASES, getCase } from './cases.mjs';
import { sha, readJSON, openTransport, ObservationProtectionError, SECRET_ECHO_ERROR } from './transport.mjs';
import { traceContext, renderTurn, renderRun } from './report.mjs';
export const MAX_CALLS = 3;
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export function identity() {
  const files = [
    ...['domain', 'types', 'validation', 'storage'].flatMap(n => [`app/continuity/src/shared/${n}.ts`, `app/continuity/dist/public/shared/${n}.js`]),
    ...['app', 'provider', 'prompt', 'mock'].map(n => `app/continuity/server/${n}.mjs`),
    ...['config', 'errors', 'limiter', 'static-files', 'providers/deepseek'].map(n => `app/server/${n}.mjs`),
    'app/dist/public/shared/diagnostics.js', 'app/package.json', 'app/package-lock.json',
    ...['cases', 'engine', 'transport', 'report', 'run'].map(n => `experiments/idea016/${n}.mjs`),
  ];
  const hashes = Object.fromEntries(files.map(f => [f, sha(readFileSync(join(ROOT, f)))]));
  return { sha256: sha(JSON.stringify(hashes)), files: hashes };
}
const saveCheckpoint = (dir, state, write) => write(join(dir, 'checkpoint.json'), state, { replace: true });
function fresh(c) {
  return { schemaVersion: 'idea016.checkpoint.1', caseId: c.id, phase: 'ready-stage', stageIndex: 0, turnCount: 0,
    project: D.rename(D.createProject(), `[합성 IDEA016] ${c.title}`), answerAction: null };
}
export function questionTemplate(c, state) {
  const question = D.taskOf(state.project).advice?.question;
  return { caseId: c.id, turn: state.turnCount, questionSha256: sha(JSON.stringify(question)), inReplyTo: question.text, factIds: [], relevance: '' };
}
export function applyAnswer(c, state, doc) {
  if (state.phase !== 'awaiting-answer' || state.turnCount >= MAX_CALLS) throw new Error('NOT_AWAITING_ANSWER');
  const t = D.taskOf(state.project), q = t.advice?.question;
  const keys = ['caseId', 'turn', 'questionSha256', 'inReplyTo', 'factIds', 'relevance'];
  if (!doc || Object.keys(doc).sort().join() !== keys.sort().join()) throw new Error('ANSWER_SHAPE');
  if (!q || doc.caseId !== c.id || doc.turn !== state.turnCount || doc.inReplyTo !== q.text || doc.questionSha256 !== sha(JSON.stringify(q))) throw new Error('ANSWER_QUESTION_MISMATCH');
  if (!Array.isArray(doc.factIds) || !doc.factIds.length || doc.factIds.length > 3 || new Set(doc.factIds).size !== doc.factIds.length ||
      typeof doc.relevance !== 'string' || !doc.relevance.trim() || doc.relevance.length > 1200) throw new Error('ANSWER_SELECTION_REQUIRED');
  const facts = doc.factIds.map(id => c.facts.find(f => f.id === id));
  if (facts.some(f => !f) || new Set(facts.map(f => f.disposition)).size !== 1) throw new Error('ANSWER_OUTSIDE_SCENARIO');
  const value = facts.map(f => f.text).join('\n'), disposition = facts[0].disposition;
  const project = D.answer(state.project, t.id, value, disposition, true);
  // Operator relevance is review evidence only, never extra facts in the prompt.
  return { ...state, project, phase: 'ready-answer', answerAction: { synthetic: true, actualQuestion: q, selection: doc, value, disposition } };
}
async function executeCase(transport, c, dir, state) {
  const write = transport.write; // Key-bound observation writer for every derived record.
  while (['ready-stage', 'ready-answer'].includes(state.phase) && state.turnCount < MAX_CALLS) {
    const stage = c.stages[state.stageIndex];
    let action;
    if (state.phase === 'ready-stage') {
      if (state.stageIndex > 0) state.project = D.restore(parseProject(serializeProject(state.project)));
      state.project = D.submit(D.editDraft(D.setKind(state.project, stage.input.kind), stage.input.text));
      for (const b of stage.basisBefore ?? []) state.project = D.recordBasis(state.project, b.text, b.status, b.id);
      action = { stage: stage.id, syntheticDayOffset: stage.day, input: stage.input, manualBasisBefore: stage.basisBefore ?? [],
        recoveryRoundTrip: state.stageIndex > 0, realDaysElapsed: false };
    } else action = state.answerAction;
    const before = structuredClone(state.project), started = D.begin(state.project);
    state.project = started.project; state.turnCount++; state.phase = 'inflight';
    const turnName = `turn-${String(state.turnCount).padStart(2, '0')}`, tdir = join(dir, turnName);
    mkdirSync(tdir);
    write(join(tdir, 'project-before.json'), before);
    write(join(tdir, 'request-app.json'), started.request);
    write(join(tdir, 'action.json'), action);
    saveCheckpoint(dir, state, write); // A crash here is NOT resumable/retried. Inspect actual dispatch evidence.
    let response, accepted = false, error = null;
    try {
      response = await transport.send(started.request, tdir);
      if (response.status !== 200) error = response.data?.error?.code ?? 'REQUEST_FAILED';
      else if (response.data?.mode !== transport.expectedEnvelopeMode) error = 'INVALID_RESPONSE';
      else {
        state.project = D.receive(state.project, started.request, response.data);
        accepted = D.taskOf(state.project).adviceRevision === started.request.ticket.revision && state.project.notice === null;
        if (!accepted) error = 'RESPONSE_NOT_APPLIED';
      }
    } catch (e) { error = e instanceof ObservationProtectionError ? SECRET_ECHO_ERROR : 'TRANSPORT_OR_RECORDING_FAILED'; }
    if (error) state.project = D.failed(state.project, started.request.ticket, `${error} · 자동 재시도 없음. ${error === SECRET_ECHO_ERROR ? '민감 반향은 관찰 기록에서 숨김.' : '원문 보존.'}`);
    write(join(tdir, 'project-after-receive.json'), state.project);
    const question = accepted ? D.taskOf(state.project).advice?.question : null;
    const repeatedQuestion = !!question && D.questionAnswered(state.project, D.taskOf(state.project));
    const needsAnswer = !!question && !repeatedQuestion;
    let exported = false;
    if (accepted && !needsAnswer) {
      for (const [key, value] of Object.entries(stage.manualAfter ?? {})) state.project = D.editTask(state.project, state.project.currentTaskId, key, value);
    }
    const handoff = D.handoffText(state.project);
    write(join(tdir, 'handoff.md'), handoff);
    if (accepted && !needsAnswer && stage.export !== false) {
      // A real file was written above. Record the same export event as the app; no CLI execution.
      state.project = D.markHandoff(state.project, state.project.currentTaskId, handoff, 'download'); exported = true;
    }
    const result = { mode: transport.mode, turn: state.turnCount, stageId: stage.id, action, accepted, error, question, repeatedQuestion,
      exported, manualAfter: accepted && !needsAnswer ? stage.manualAfter ?? {} : {}, quality: 'NOT_EVALUATED' };
    const providerFile = join(tdir, 'request-provider.raw.json');
    const trace = traceContext(c, before, started.request, state.project, existsSync(providerFile) ? readFileSync(providerFile, 'utf8') : '', handoff);
    write(join(tdir, 'context-trace.json'), trace);
    write(join(tdir, 'result.json'), result);
    write(join(tdir, 'project-after.json'), state.project);
    write(join(dir, 'final-handoff.md'), handoff, { replace: true });
    write(join(dir, 'project-final.json'), state.project, { replace: true });
    renderTurn(tdir, c, result, trace, write);
    if (error) state.phase = 'failed';
    else if (needsAnswer) {
      state.phase = state.turnCount < MAX_CALLS ? 'awaiting-answer' : 'budget-ended';
      write(join(tdir, 'pending-question.json'), { actualQuestion: question, allowedFacts: c.facts,
        note: '합성 답변만 허용. 실제 질문에서 답할 수 있는 fact만 선택한다. 맞는 값이 없으면 답을 만들어 넣지 말고 이 사례를 미응답으로 둔다.' });
      write(join(tdir, 'answer.template.json'), questionTemplate(c, state));
    } else {
      state.stageIndex++;
      state.phase = state.stageIndex >= c.stages.length ? 'complete' : state.turnCount >= MAX_CALLS ? 'budget-ended' : 'ready-stage';
    }
    state.answerAction = null;
    saveCheckpoint(dir, state, write);
    if (state.phase === 'failed') break;
  }
  return state;
}
export async function runBatch({ mode, out, caseIds = CASES.map(c => c.id), env, mockResponder }) {
  if (!caseIds.length || new Set(caseIds).size !== caseIds.length) throw new Error('CASE_SELECTION');
  const selected = caseIds.map(getCase), code = identity();
  if (existsSync(out)) throw new Error('OUTPUT_ALREADY_EXISTS');
  const transport = await openTransport({ mode, env, mockResponder });
  const write = transport.write;
  try {
    mkdirSync(out); // Parent must exist. Never merge into an old result folder.
    write(join(out, 'run.json'), { schemaVersion: 'idea016.run.1', mode, syntheticCustomers: true,
      startedAt: new Date().toISOString(), node: process.version, platform: process.platform, config: transport.config,
      maxCallsPerCase: MAX_CALLS, caseIds, identity: code, sourceAnswerPolicy: 'exact-question + operator-selected allowlisted synthetic facts',
      automaticRetry: false, liveMockFallback: false, quality: 'NOT_EVALUATED' });
    for (const c of selected) {
      const dir = join(out, c.id); mkdirSync(dir); write(join(dir, 'case.json'), c);
      const state = await executeCase(transport, c, dir, fresh(c));
      if (state.phase === 'failed') break; // Fail visibly; don't spend more calls on a failing provider.
    }
    return renderRun(out, write);
  } finally { await transport.close(); }
}
export async function resumeCase({ root, caseId, answer, env, mockResponder }) {
  const run = readJSON(join(root, 'run.json'));
  if (run.identity.sha256 !== identity().sha256) throw new Error('BASELINE_CHANGED');
  if (!run.caseIds.includes(caseId)) throw new Error('UNKNOWN_CASE');
  const dir = join(root, caseId), c = getCase(caseId);
  const lockPath = join(root, '.resume.lock');
  const lock = openSync(lockPath, 'wx', 0o600); // Local concurrent resume protection, not an approval ledger.
  let transport;
  try {
    let state = readJSON(join(dir, 'checkpoint.json'));
    state.project = parseProject(serializeProject(state.project));
    state = applyAnswer(c, state, answer); // Check before any provider or key access.
    transport = await openTransport({ mode: run.mode, env, mockResponder });
    if (JSON.stringify(run.config) !== JSON.stringify(transport.config)) throw new Error('RUNTIME_CONFIG_CHANGED');
    await executeCase(transport, c, dir, state);
    return renderRun(root, transport.write);
  } finally {
    if (transport) await transport.close(); closeSync(lock); unlinkSync(lockPath);
  }
}
