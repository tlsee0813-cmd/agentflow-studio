import { diagnosticSink, type DiagnosticObserver } from './diagnostics.js';
import { SCHEMA_VERSION, ANSWER_MAX_LENGTH, REQUIREMENT_MAX_LENGTH, type Project, type Brief, type RequestPayload, type Question, type Answer, type Requirement, type Status, type SelectionResolutionPreview } from './contracts.js';
import { validateEnvelope, validateRequest, ContractError } from './validation.js';
const uid = (prefix: string) => `${prefix}-${globalThis.crypto.randomUUID()}`;
export function createProject(): Project {
  return { schemaVersion: SCHEMA_VERSION, id: uid('P'), version: 1,
    brief: { idea: '', tools: 'undecided', constraints: '' }, sources: [], answers: [], requirements: [],
    question: null, answeredQuestion: null, conflicts: [], selectionResolutions: [], summary: '', ideas: [], openItems: [], phase: 'basic', pending: null, error: null, responseMode: null };
}
export function storageQuestion(id = 'Q-storage'): Question {
  return { id, topic: 'storage', text: '만들 서비스의 데이터, 어디에서 이어서 사용하나요?',
    reason: '데이터 보관 범위와 기기 간 연결 요구가 달라집니다. Studio 자체의 저장 설정을 묻는 질문은 아닙니다.',
    example: '예: 집 PC에서 적은 할 일을 휴대폰에서도 이어서 보는 경우는 여러 기기에 해당해요.',
    options: [
      { id: 'browser', label: '이 브라우저 한 곳에서만', consequence: '이 브라우저에만 보관하고 기기 간 동기화는 첫 범위에서 제외합니다.' },
      { id: 'multi-device', label: '여러 기기에서 이어서', consequence: '기기 간 데이터 연속성이 필요합니다. 계정·접근 제어 방식은 아직 정하지 않습니다.' }
    ], recommendation: null };
}
export function editBrief(state: Project, brief: Brief): Project {
  if (JSON.stringify(state.brief) === JSON.stringify(brief)) return state;
  let next: Project = { ...state, version: state.version + 1, brief: { ...brief }, pending: null,
    question: null, phase: 'basic', error: null,
    requirements: state.requirements.map(r => ({ ...r, needsReview: true })) };
  // Once a tool requirement exists, reflect a changed selection immediately, even
  // before a retry. Typing in other fields does not create a source per keystroke.
  if (brief.tools !== state.brief.tools && state.requirements.some(r => r.id === `${state.id}:REQ-tools`)) {
    const added = currentInputSource(next); next = syncTools(added.state, added.source.id);
  }
  return next;
}
function withSource(state: Project, kind: Project['sources'][number]['kind'], text: string) {
  const source = { id: uid('S'), kind, text, atVersion: state.version };
  return { state: { ...state, sources: [...state.sources, source] }, source };
}
function currentInputSource(state: Project) {
  const text = JSON.stringify(state.brief);
  const source = state.sources.find(s => s.kind === 'customer-input' && s.text === text);
  return source ? { state, source } : withSource(state, 'customer-input', text);
}
const sourcesTogether = (...lists: string[][]): string[] => [...new Set(lists.flat())];
function applySelection(state: Project, desired: Requirement, sourceId: string): Project {
  // Repeated summaries must respect an explicit decision about this exact input.
  // A different input clears only this requirement's acknowledgement.
  if (state.selectionResolutions.some(r => r.requirementId === desired.id && r.sourceId === sourceId)) return state;
  state = { ...state, selectionResolutions: state.selectionResolutions.filter(r => r.requirementId !== desired.id) };
  const prior = state.requirements.find(r => r.id === desired.id);
  const conflicts = state.conflicts.filter(c => c.requirementId !== desired.id);
  if (prior?.locked && (prior.text !== desired.text || prior.status !== desired.status || prior.acceptance !== desired.acceptance)) {
    // A different direct choice is visible as a conflict, never a silent unlock.
    return { ...state, conflicts: [...conflicts, { requirementId: prior.id,
      topic: desired.topic as 'tools' | 'storage', expectedText: desired.text, sourceId,
      expectedAcceptance: desired.acceptance, expectedStatus: desired.status }],
      requirements: state.requirements.map(r => r.id === prior.id ? { ...r, needsReview: true } : r) };
  }
  const next = { ...desired, locked: prior?.locked ?? false,
    sourceIds: sourcesTogether(prior?.sourceIds ?? [], [sourceId]) };
  const unchanged = prior && prior.text === next.text && prior.status === next.status
    && prior.acceptance === next.acceptance && !prior.needsReview
    && JSON.stringify(prior.sourceIds) === JSON.stringify(next.sourceIds);
  return { ...state, conflicts, requirements: prior
    ? state.requirements.map(r => r.id === prior.id ? (unchanged ? prior : next) : r)
    : [...state.requirements, next] };
}
function syncTools(state: Project, sourceId: string): Project {
  const undecided = state.brief.tools === 'undecided';
  if (undecided && !state.requirements.some(r => r.id === `${state.id}:REQ-tools`)) return state;
  const labels = { 'codex-only': 'Codex만', 'claude-only': 'Claude만', mixed: 'Codex와 Claude를 함께', undecided: '미정' };
  return applySelection(state, { id: `${state.id}:REQ-tools`, scope: 'user-project', topic: 'tools', kind: 'constraint',
    text: undecided ? '개발 도구는 미정이다. 이전 도구 선택을 현재 확정 제약으로 적용하지 않는다.'
      : `개발 도구로 ${labels[state.brief.tools]} 사용한다.`,
    acceptance: undecided ? '도구가 결정되기 전에는 특정 도구를 필수로 요구하지 않는다.' : '선택하지 않은 도구를 필수로 요구하지 않는다.',
    priority: undecided ? 'undecided' : 'must', status: undecided ? 'deferred' : 'confirmed', origin: 'customer',
    sourceIds: [sourceId], version: state.version, locked: false, needsReview: false }, sourceId);
}
export function beginRequest(state: Project): { state: Project; request: RequestPayload } {
  if (state.pending) throw new ContractError('REQUEST_IN_FLIGHT');
  const added = currentInputSource({ ...state, version: state.version + 1, error: null });
  // Source deduplication does not decide whether the current selection is applied.
  const next = syncTools(added.state, added.source.id);
  const request = validateRequest({ schemaVersion: SCHEMA_VERSION, projectId: next.id, baseVersion: next.version,
    requestId: uid('R'), stage: next.answers.length > 0 ? 'summarize' : 'discover', brief: next.brief,
    sources: next.sources, answers: next.answers, requirements: next.requirements });
  return { state: { ...next, pending: request }, request };
}
export function isCurrent(state: Project, request: RequestPayload): boolean {
  return state.id === request.projectId && state.version === request.baseVersion && state.pending?.requestId === request.requestId;
}
export function failRequest(state: Project, request: RequestPayload, code: string): Project {
  return isCurrent(state, request) ? { ...state, pending: null, error: code } : state;
}
export function cancelRequest(state: Project): Project {
  return state.pending ? { ...state, version: state.version + 1, pending: null, error: 'CANCELLED' } : state;
}
export function applyResponse(state: Project, request: RequestPayload, raw: unknown, onDiagnostic?: DiagnosticObserver): Project {
  const diagnostic = diagnosticSink(onDiagnostic);
  if (!isCurrent(state, request)) {
    if (state.id !== request.projectId) diagnostic.report('state_guard','state.id','stale_project');
    else if (state.version !== request.baseVersion) diagnostic.report('state_guard','state.version','stale_version');
    else diagnostic.report('state_guard','state.pending.requestId','stale_request');
    return state;
  }
  let envelope;
  try { envelope = validateEnvelope(raw, request, diagnostic.capture); }
  catch { return failRequest(state, request, 'INVALID_RESPONSE'); }
  try {
  const { result, mode } = envelope;
  let next: Project = { ...state, version: state.version + 1, pending: null, error: null };
  const added = withSource(next, mode === 'mock' ? 'mock-response' : 'ai-response', result.summary);
  next = added.state;
  const requirements = [...next.requirements];
  const openItems = [...result.openItems];
  for (const p of result.proposals) {
    // Customer-selected data scope remains authoritative. AI cannot substitute it.
    if (p.topic === 'storage' && next.answers.some(a => a.topic === 'storage')) continue;
    if (p.topic === 'tools' && next.brief.tools !== 'undecided') continue;
    const id = `${state.id}:REQ-proposal-${p.key}`;
    const prior = requirements.find(r => r.id === id);
    if (prior) {
      const changed = prior.text !== p.text || prior.acceptance !== p.acceptance;
      const sameIntent = prior.topic === p.topic && prior.kind === p.kind;
      if (prior.status === 'proposed' && !prior.locked && sameIntent) {
        // The same stable key may refine an unconfirmed draft, not a decision.
        // Keep earlier evidence and attach the new answer and response source.
        if (changed || p.sourceIds.some(id => !prior.sourceIds.includes(id))) {
          requirements[requirements.indexOf(prior)] = { ...prior, text: p.text, acceptance: p.acceptance,
            sourceIds: sourcesTogether(prior.sourceIds, p.sourceIds, [added.source.id]),
            origin: mode === 'mock' ? 'mock' : 'ai', version: next.version, needsReview: false };
        }
      } else if (changed || !sameIntent) {
        requirements[requirements.indexOf(prior)] = { ...prior, needsReview: true };
        openItems.push(`기존 요구 ${prior.id}는 보존했습니다. 확정·잠금·보류·제외 또는 다른 의도의 해석은 직접 재검토해야 합니다.`);
      }
      continue;
    }
    requirements.push({ id, scope: 'user-project', topic: p.topic, kind: p.kind, text: p.text,
      acceptance: p.acceptance, sourceIds: [...p.sourceIds, added.source.id], priority: 'undecided', status: 'proposed',
      origin: mode === 'mock' ? 'mock' : 'ai', version: next.version, locked: false, needsReview: false });
  }
  const storage = next.answers.find(a => a.topic === 'storage');
  if (storage?.optionId === 'multi-device') openItems.push('여러 기기의 데이터 접근 제어·동기화 충돌·연결 실패 처리 방식은 미정입니다.');
  if (storage && storage.disposition !== 'answered') openItems.push('데이터 보관 범위가 미정입니다. 보류를 브라우저 저장 동의로 처리하지 않았습니다.');
  const question = result.question?.topic === 'storage' ? storageQuestion(result.question.id) : result.question;
  return { ...next, requirements, summary: result.summary, question,
    ideas: result.ideas.map(idea => next.ideas.find(old => old.text === idea.text && old.problem === idea.problem && old.effect === idea.effect && old.placement === idea.placement)
      ?? { ...idea, id: uid('I'), sourceIds: [added.source.id], status: 'proposed', version: next.version }), openItems: [...new Set(openItems)], responseMode: mode, phase: question ? 'question' : 'summary' };
  } catch (error) { diagnostic.report('state_apply','state','application_exception'); throw error; }
}
/** Store full answer text separately from the bounded requirement summary. */
function storeAnswer(state: Project, q: Question, input: Pick<Answer, 'optionId' | 'text' | 'disposition'>,
  previous?: Answer): Project {
  if (!['answered', 'unknown', 'deferred'].includes(input.disposition)
      || !input.text.trim() || input.text.length > ANSWER_MAX_LENGTH) throw new ContractError('INVALID_ANSWER');
  const option = q.options.find(o => o.id === input.optionId);
  if (input.optionId !== null && !option) throw new ContractError('INVALID_ANSWER');
  if (input.disposition !== 'answered' && input.optionId !== null) throw new ContractError('INVALID_ANSWER');
  // Do not trim custom input: it is source material, not a generated summary.
  const text = option ? `${option.label} — ${option.consequence}` : input.text;
  if (text.length > ANSWER_MAX_LENGTH) throw new ContractError('INVALID_ANSWER');
  let next: Project = { ...state, version: state.version + 1, pending: null, error: null };
  const added = withSource(next, 'customer-answer', `${q.text}\n${text}`); next = added.state;
  const answer: Answer = { id: previous?.id ?? uid('A'), questionId: q.id, topic: q.topic, sourceId: added.source.id,
    optionId: input.optionId, disposition: input.disposition, text };
  next.answers = previous ? next.answers.map(a => a.id === previous.id ? answer : a) : [...next.answers, answer];
  if (previous) next.requirements = next.requirements.map(r => r.sourceIds.includes(previous.sourceId) ? { ...r, needsReview: true } : r);
  if (q.topic === 'storage') {
    const direct = `데이터 보관 범위: ${text}`;
    const content = option?.id === 'browser'
      ? '설계할 서비스의 데이터는 이 브라우저 한 곳에만 보관한다. 여러 기기 동기화는 첫 범위에서 제외한다.'
      : option?.id === 'multi-device'
        ? '설계할 서비스는 여러 기기에서 같은 데이터를 이어서 사용할 수 있어야 한다.'
        : direct.length <= REQUIREMENT_MAX_LENGTH ? direct
          : `데이터 보관 범위: 긴 직접 답변의 해석이 필요하다. 원문 ${text.length}자는 출처 ${added.source.id}에 전체 보존했으며 아직 요약·확정하지 않았다.`;
    next = applySelection(next, {
      id: `${state.id}:REQ-storage`, scope: 'user-project', topic: 'storage', kind: 'constraint', text: content,
      acceptance: option?.id === 'browser' ? '브라우저를 새로 열어도 같은 기기에서 데이터를 확인한다. 기기 간 연결 기능은 요구하지 않는다.'
        : option?.id === 'multi-device' ? '두 기기에서 같은 데이터를 확인할 수 있다. 접근 제어와 실패 흐름은 추가 확인한다.' : 'TBD: 보관 범위와 관찰 조건 확인 필요.',
      priority: 'undecided', status: option && input.disposition === 'answered' ? 'confirmed' : input.disposition === 'answered' ? 'proposed' : 'deferred',
      origin: 'customer', sourceIds: [added.source.id], version: next.version, locked: false, needsReview: false
    }, added.source.id);
  }
  return { ...next, question: null, answeredQuestion: q, phase: 'summary' };
}
export function answerQuestion(state: Project, input: Pick<Answer, 'optionId' | 'text' | 'disposition'>): Project {
  if (!state.question || state.pending) throw new ContractError('NO_OPEN_QUESTION');
  return storeAnswer(state, state.question, input);
}
/** Correct this slice's existing answer; not an additional interview turn. */
export function reviseAnswer(state: Project, input: Pick<Answer, 'optionId' | 'text' | 'disposition'>): Project {
  const q = state.answeredQuestion;
  const previous = state.answers.find(a => a.questionId === q?.id);
  if (!q || !previous) throw new ContractError('NO_SAVED_ANSWER');
  return storeAnswer(state, q, input, previous);
}
export function decideRequirement(state: Project, id: string, status: Status, editedText?: string): Project {
  const prior = state.requirements.find(r => r.id === id);
  if (!prior || (editedText !== undefined && (!editedText.trim() || editedText.length > REQUIREMENT_MAX_LENGTH))) throw new ContractError('INVALID_DECISION');
  // A text-only edit cannot resolve a selection conflict or confirm an unknown
  // completion condition. The paired preview is the explicit resolution path.
  if (editedText !== undefined && state.conflicts.some(c => c.requirementId === id)) throw new ContractError('SELECTION_CONFLICT');
  const unresolvedAcceptance = prior.acceptance.startsWith('TBD:')
    && (prior.needsReview || state.selectionResolutions.some(r => r.requirementId === id));
  if (status === 'confirmed' && unresolvedAcceptance) throw new ContractError('UNRESOLVED_ACCEPTANCE');
  let next: Project = { ...state, version: state.version + 1, pending: null, error: null };
  const added = withSource(next, 'customer-confirmation', `${id}: ${status}: ${editedText ?? prior.text}`); next = added.state;
  return { ...next, requirements: next.requirements.map(r => r.id !== id ? r : { ...r,
    text: editedText?.trim() ?? r.text, status, version: next.version, locked: editedText !== undefined || r.locked,
    needsReview: unresolvedAcceptance || next.conflicts.some(c => c.requirementId === id), sourceIds: [...r.sourceIds, added.source.id] }) };
}

/** Pure preview: choosing an option or cancelling it does not change the project. */
export function previewSelectionResolution(state: Project, id: string, choice: 'apply' | 'keep'): SelectionResolutionPreview {
  const prior = state.requirements.find(r => r.id === id);
  const conflict = state.conflicts.find(c => c.requirementId === id);
  if (!prior || !conflict || !['apply','keep'].includes(choice)) throw new ContractError('INVALID_RESOLUTION');
  const candidate = choice === 'apply' ? { text: conflict.expectedText, acceptance: conflict.expectedAcceptance,
    status: conflict.expectedStatus } : prior;
  const uncertain = candidate.acceptance.startsWith('TBD:');
  return { requirementId: id, sourceId: conflict.sourceId, baseVersion: state.version, choice,
    text: candidate.text, acceptance: candidate.acceptance, priority: prior.priority,
    status: uncertain && candidate.status === 'confirmed' ? 'proposed' : candidate.status,
    needsReview: uncertain || state.conflicts.some(c => c.requirementId === id && c.sourceId !== conflict.sourceId) };
}

/** Atomically apply only a current, reviewed pair; never unlock or replace IDs. */
export function confirmSelectionResolution(state: Project, preview: SelectionResolutionPreview): Project {
  if (state.version !== preview.baseVersion) throw new ContractError('STALE_RESOLUTION');
  const current = previewSelectionResolution(state, preview.requirementId, preview.choice);
  if (JSON.stringify(current) !== JSON.stringify(preview)) throw new ContractError('STALE_RESOLUTION');
  const prior = state.requirements.find(r => r.id === preview.requirementId)!;
  let next: Project = { ...state, version: state.version + 1, pending: null, error: null };
  const added = withSource(next, 'customer-confirmation', `${prior.id}: 선택 충돌 해결\n${preview.choice === 'apply' ? '새 답변 반영' : '기존 요구 유지 (새 선택을 이 요구에는 적용하지 않음)'}\n요구: ${preview.text}\n완료 조건: ${preview.acceptance}\n상태: ${preview.status}\n검토한 출처: ${preview.sourceId}`);
  next = added.state;
  return { ...next,
    conflicts: next.conflicts.filter(c => !(c.requirementId === prior.id && c.sourceId === preview.sourceId)),
    selectionResolutions: [...next.selectionResolutions.filter(r => r.requirementId !== prior.id),
      { requirementId: prior.id, sourceId: preview.sourceId }],
    requirements: next.requirements.map(r => r.id !== prior.id ? r : { ...r,
      text: preview.text, acceptance: preview.acceptance, status: preview.status, priority: preview.priority,
      version: next.version, needsReview: preview.needsReview,
      sourceIds: sourcesTogether(r.sourceIds, [preview.sourceId, added.source.id]) }) };
}
