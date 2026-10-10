import { createProject, editBrief, beginRequest, applyResponse, failRequest, cancelRequest, answerQuestion, reviseAnswer, decideRequirement } from '../shared/project.js';
import { ANSWER_MAX_LENGTH, REQUIREMENT_MAX_LENGTH } from '../shared/contracts.js';
import type { ToolEnvironment, Requirement, Status } from '../shared/contracts.js';
const get = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id); if (!node) throw new Error('MISSING_UI_ELEMENT'); return node as T;
};
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => {
  const node = document.createElement(tag); node.textContent = text; if (cls) node.className = cls; return node;
};
const button = (label: string, action: () => void, cls = 'secondary') => {
  const node = el('button',label,cls); node.type = 'button'; node.addEventListener('click',action); return node;
};
let state = createProject();
let controller: AbortController | null = null;
let mode: 'mock' | 'deepseek' | null = null;
let editing: string | null = null;
let editingDraft = '';
let customAnswerDraft = '';
let editingAnswer = false;
let answerDraft = '';
const errors: Record<string,string> = {
  AI_NOT_CONFIGURED: '서버의 AI 연결이 아직 설정되지 않았습니다. 입력은 그대로 보관했습니다. 모의 응답으로 바꾸지 않았습니다.',
  PAID_CALLS_DISABLED: '서버에서 유료 AI 호출이 비활성화되어 있습니다. 입력을 유지했습니다.',
  AI_AUTH_FAILED: 'AI 서버 인증에 실패했습니다. 기존 입력과 요구는 변경하지 않았습니다.',
  AI_BALANCE_REQUIRED: 'AI 제공업체가 잔액 관련 오류를 반환했습니다. 자동 재시도하지 않았습니다.',
  AI_TIMEOUT: 'AI 응답 시간이 초과되었습니다. 입력은 그대로입니다. 다시 시도하면 별도 요청이 됩니다.',
  AI_RATE_LIMIT: 'AI 제공업체의 호출 제한에 도달했습니다. 자동 재시도하지 않습니다.',
  LOCAL_RATE_LIMIT: '개발 서버의 분당 호출 제한에 도달했습니다. 입력을 유지했습니다.',
  PROCESS_CALL_CAP: '개발 서버의 누적 호출 한도에 도달했습니다. 운영자가 사용량을 확인해야 합니다.',
  AI_BUSY: '현재 진행 중인 요청이 있습니다. 잠시 후 직접 다시 시도해 주세요.',
  INVALID_RESPONSE: 'AI 응답 형식이나 출처를 검증하지 못했습니다. 기존 요구를 덮어쓰지 않았습니다.',
  INVALID_ANSWER: '답변은 공백이 아닌 내용으로 1,500자 이하여야 합니다. 원문을 유지했으니 수정 후 다시 보내 주세요.',
  INVALID_INPUT: '입력 규격을 확인해 주세요. 기존 내용은 유지됩니다.',
  INPUT_TOO_LARGE: '입력 또는 이력이 이번 미리보기의 크기 제한을 넘었습니다. 내용을 유지했습니다.',
  AI_UNAVAILABLE: 'AI 제공업체가 요청을 처리하지 못했습니다. 입력을 유지했습니다.',
  AI_NETWORK_ERROR: 'AI 서버 연결에 실패했습니다. 입력을 유지했습니다.',
  AI_CONFIG_REJECTED: 'AI 제공업체가 모델 또는 연결 설정을 거절했습니다. 서버 설정을 확인해야 합니다.',
  CANCELLED: '요청을 취소했습니다. 이후 도착하는 응답은 반영하지 않습니다. 이미 전송된 요청의 과금 취소를 보장하지는 않습니다.',
  NETWORK_ERROR: '개발 서버에 연결하지 못했습니다. 입력은 현재 화면에 유지됩니다.',
  CONSENT_REQUIRED: 'DeepSeek로 입력·답변을 전송하기 전에 전송 동의를 확인해 주세요.'
};
const brief = () => ({ idea: get<HTMLTextAreaElement>('idea').value, tools: get<HTMLSelectElement>('tools').value as ToolEnvironment,
  constraints: get<HTMLTextAreaElement>('constraints').value });
function updateFromForm() {
  const next = editBrief(state,brief());
  if (next !== state) { controller?.abort(); controller = null; state = next; render(); }
}
for (const id of ['idea','tools','constraints']) get(id).addEventListener('input',updateFromForm);
get('brief-form').addEventListener('submit', event => { event.preventDefault(); updateFromForm(); void send(); });
get('cancel').addEventListener('click', () => { controller?.abort(); state = cancelRequest(state); render(); });
async function send() {
  if (state.pending || !mode || editingAnswer || editing !== null) return;
  if (mode === 'deepseek' && !get<HTMLInputElement>('consent').checked) { state = { ...state,error:'CONSENT_REQUIRED' }; render(); return; }
  let request;
  try { const started = beginRequest(state); state = started.state; request = started.request; }
  catch { state = { ...state,error:'INVALID_INPUT' }; render(); return; }
  controller = new AbortController(); const currentController = controller;
  render();
  let needsRender = false;
  try {
    const response = await fetch('/api/interview', { method:'POST', headers:{'Content-Type':'application/json','X-AgentFlow-Request':'1'},
      body:JSON.stringify(request), signal:currentController.signal });
    let data: unknown;
    try { data = await response.json(); }
    catch { const next = failRequest(state,request,'INVALID_RESPONSE'); needsRender = next !== state; state = next; return; }
    let next;
    if (!response.ok) {
      const errorCode = (data as {error?:{code?:unknown}})?.error?.code;
      next = failRequest(state,request,typeof errorCode === 'string' && /^[A-Z_]+$/.test(errorCode) ? errorCode : 'INVALID_RESPONSE');
    } else next = applyResponse(state,request,data);
    needsRender = next !== state; state = next;
  } catch (e) { const next = failRequest(state,request,(e as Error).name === 'AbortError' ? 'CANCELLED' : 'NETWORK_ERROR'); needsRender = next !== state; state = next; }
  finally { if (controller === currentController) controller = null; if (needsRender) render(); }
}
function answer(disposition: 'answered'|'unknown'|'deferred', optionId: string|null, text: string) {
  try { state = answerQuestion(state,{disposition,optionId,text}); customAnswerDraft = ''; render(); void send(); }
  catch { state = { ...state,error:'INVALID_ANSWER' }; render(); }
}
function saveAnswerEdit() {
  try {
    state = reviseAnswer(state,{disposition:'answered',optionId:null,text:answerDraft});
    editingAnswer = false; render(); void send();
  } catch { state = { ...state,error:'INVALID_ANSWER' }; render(); }
}

function renderQuestion() {
  const region = get('conversation'); region.replaceChildren();
  if (state.pending) { const waiting = el('div',mode === 'mock' ? '모의 응답을 처리하는 중입니다…' : 'AI 응답을 기다리는 중입니다. 입력을 수정하면 이 요청은 취소됩니다.','card reason'); region.append(waiting); return; }
  const q = state.question; if (!q) return;
  const card = el('div','','card');
  card.append(el('p',state.responseMode === 'mock' ? '02 / 모의 후속 질문 · 실제 AI 아님' : '02 / AI 후속 질문','section-tag'));
  card.append(el('h2',q.text),el('p',q.reason,'reason'),el('p',q.example,'choice-note'));
  if (q.topic === 'storage') card.append(el('p','저장 범위의 선택 문구는 혼동을 막기 위한 서비스 공통 문구입니다.','hint'));
  for (const option of q.options) {
    const b = button('', () => answer('answered',option.id,option.label), 'option');
    b.append(el('strong',option.label),el('small',option.consequence)); card.append(b);
  }
  if (q.recommendation) card.append(el('p',`추천 이유 (미확정): ${q.recommendation.reason}`,'choice-note'));
  const label = el('label','다른 생각이 있나요?'); label.htmlFor = 'custom-answer';
  const custom = el('textarea'); custom.id = 'custom-answer'; custom.rows = 2; custom.value = customAnswerDraft; custom.addEventListener('input',() => { customAnswerDraft = custom.value; }); custom.placeholder = '직접 답변을 적어 주세요.';
  const actions = el('div','','actions');
  actions.append(button('직접 답변하고 요약 보기',() => answer('answered',null,custom.value),'primary'),
    button('잘 모르겠어요',() => answer('unknown',null,'잘 모르겠음')),
    button('나중에 결정',() => answer('deferred',null,'나중에 결정')));
  card.append(label,custom,el('p',`최대 ${ANSWER_MAX_LENGTH.toLocaleString()}자. 긴 원문과 요구 요약을 별도로 보존합니다.`,'hint'),actions,el('p','이번 미리보기는 후속 질문 한 차례 뒤 미정 사항을 남긴 요약으로 이동합니다.','hint'));
  region.append(card);
}
const statusLabel: Record<Status,string> = {confirmed:'확정',proposed:'제안',deferred:'보류',rejected:'제외'};
function decide(req: Requirement, status: Status, text?: string) {
  controller?.abort();
  try { state = decideRequirement(state,req.id,status,text); editing = null; render(); }
  catch { state = { ...state,error:'INVALID_INPUT' }; render(); }
}
function requirement(req: Requirement) {
  const row = el('article','','req'); row.dataset.requirementId = req.id; row.dataset.status = req.status;
  const head = el('div'); head.append(el('span',statusLabel[req.status],`status ${req.status}`),
    el('small',req.origin === 'customer' ? '고객 발언 / 확인' : req.origin === 'mock' ? (req.status === 'confirmed' ? '모의 해석 · 고객 확인' : '모의 제안 · 고객 미확정') : (req.status === 'confirmed' ? 'AI 해석 · 고객 확인' : 'AI 제안 · 고객 미확정')));
  row.append(head,el('p',req.text));
  const conflict = state.conflicts.find(c => c.requirementId === req.id);
  if (conflict) row.append(el('p',`선택 충돌: 현재 고객 선택은 “${conflict.expectedText}”입니다. 수동 잠금 요구는 보존했습니다. 직접 수정하거나 도구 선택을 되돌려 일치시켜 주세요.`,'warning-text'));
  if (req.needsReview) row.append(el('p','입력이 바뀌어 재검토가 필요합니다. 이전 내용은 보존했습니다.','warning-text'));
  row.append(el('small',`관찰할 완료 조건: ${req.acceptance} · 중요도: ${req.priority === 'undecided' ? '미정' : req.priority}`));
  const trace = el('details'); trace.append(el('summary','출처와 버전 보기'),el('p',`${req.id} · 요구 v${req.version} · user-project${req.locked ? ' · 수동 수정 보존' : ''}`,'hint'));
  for (const id of req.sourceIds) {
    const s = state.sources.find(s => s.id === id);
    trace.append(el('p',s ? `${s.id} · ${s.kind} · v${s.atVersion}\n${s.text}` : `${id} (찾을 수 없음)`,'hint'));
  }
  row.append(trace);
  if (editing === req.id) {
    const label = el('label','요구 내용 수정'); const input = el('textarea'); input.value = editingDraft; input.addEventListener('input',() => {editingDraft = input.value;}); input.rows = 3; input.maxLength = REQUIREMENT_MAX_LENGTH;
    input.id = `edit-${req.id}`; label.htmlFor = input.id;
    const actions = el('div','','req-actions'); actions.append(button('수정 내용 확인',() => decide(req,'confirmed',input.value),'primary'),button('취소',() => {editing = null;render();}));
    row.append(label,input,actions);
  } else {
    const actions = el('div','','req-actions');
    if (req.status !== 'confirmed' || req.needsReview) actions.append(button('이 요구 확인',() => decide(req,'confirmed'),'primary'));
    actions.append(button('직접 수정',() => {controller?.abort(); state = cancelRequest(state); editingAnswer = false; editing = req.id; editingDraft = req.text; render();}));
    if (req.status !== 'deferred') actions.append(button('보류',() => decide(req,'deferred')));
    if (req.status !== 'rejected') actions.append(button('제외',() => decide(req,'rejected')));
    row.append(actions);
  }
  return row;
}
function renderSummary() {
  const region = get('summary'); region.replaceChildren();
  region.hidden = !state.summary && !state.answers.length; if (region.hidden) return;
  const card = el('div','','card');
  card.append(el('p','03 / 요구 확인','section-tag'),el('h2','여기까지, 이렇게 이해했어요.'),
    el('p','확정된 고객 답변과 AI·모의 해석은 별도입니다. 요구 확인은 외부 실행 권한 승인이 아닙니다.','reason'));
  if (state.summary) {
    card.append(el('h3',state.responseMode === 'mock' ? '모의 요약 · 실제 AI 분석 아님' : 'AI의 해석 · 검토 필요'),el('p',state.summary,'narrative'));
  }
  for (const status of ['confirmed','proposed','deferred','rejected'] as const) {
    const items = state.requirements.filter(r => r.status === status); if (!items.length) continue;
    const group = el('section'); group.dataset.group = status;
    group.append(el('h3',`${statusLabel[status]} ${items.length}`)); items.forEach(r => group.append(requirement(r))); card.append(group);
  }
  if (state.answers.length) {
    const answers = el('details'); answers.append(el('summary','고객 답변 원문 보기'));
    answers.open = Boolean(state.error) || editingAnswer;
    for (const a of state.answers) answers.append(el('p',`[${a.disposition}] ${a.text}`,'source-summary'));
    if (editingAnswer) {
      const label = el('label','고객 답변 수정'); label.htmlFor = 'edit-answer';
      const input = el('textarea'); input.id = 'edit-answer'; input.rows = 5; input.value = answerDraft;
      input.addEventListener('input',() => { answerDraft = input.value; });
      const actions = el('div','','actions');
      actions.append(button('답변 수정 후 요약 다시 요청',saveAnswerEdit,'primary'),button('답변 수정 취소',() => { editingAnswer = false; render(); }));
      answers.append(label,input,el('p',`최대 ${ANSWER_MAX_LENGTH.toLocaleString()}자. 이전 원문도 출처 이력에 유지됩니다. 별도 질문을 추가하는 것은 아닙니다.`,'hint'),actions);
    } else if (state.answeredQuestion) answers.append(button('답변 수정',() => {
      controller?.abort(); state = cancelRequest(state); editing = null; editingAnswer = true;
      answerDraft = state.answers.find(a => a.questionId === state.answeredQuestion?.id)?.text ?? ''; render();
    }));
    card.append(answers);
  }
  if (state.openItems.length) { card.append(el('h3','아직 정하지 않은 것')); for (const item of state.openItems) card.append(el('p',item,'open-item')); }
  if (state.ideas.length) {
    card.append(el('h3','고객 문제를 줄일 아이디어 · 미확정'));
    for (const idea of state.ideas) { const box = el('article','','idea');
      box.append(el('strong',idea.text),el('p',`문제: ${idea.problem}`),el('p',`기대 효과: ${idea.effect}`),
        el('span',idea.placement === 'future' ? '후속 후보 · 첫 범위에 자동 추가하지 않음' : '핵심 관련 제안 · 확인 전 요구로 추가하지 않음','badge')); card.append(box); }
  }
  card.append(el('p','이 요구는 방문자가 설계하는 서비스의 요구입니다. Studio 자체의 클라우드 동기화나 실제 코딩 실행을 구현한 것이 아닙니다.','hint'));
  region.append(card);
}
function render() {
  get<HTMLButtonElement>('start').disabled = Boolean(state.pending) || !mode || editing !== null || editingAnswer;
  get('start').textContent = state.pending ? '응답 기다리는 중…' : state.answers.length ? '현재 내용으로 요약 다시 요청' : '구상 구체화하기 →';
  get('cancel').hidden = !state.pending; get('revision').textContent = `프로젝트 v${state.version}`;
  get('error').hidden = !state.error;
  get('error').textContent = state.error ? errors[state.error] ?? '요청을 처리하지 못했습니다. 기존 내용을 유지했습니다.' : '';
  for (const step of ['basic','question','summary']) get(`step-${step}`).classList.toggle('current',state.phase === step);
  renderQuestion(); renderSummary();
}
async function init() {
  try {
    const response = await fetch('/api/config'); const config = await response.json() as {mode:unknown;configured:boolean;paidEnabled:boolean};
    if (!response.ok || !['mock','deepseek'].includes(config.mode as string)) throw new Error();
    mode = config.mode as 'mock'|'deepseek';
    get('mode').textContent = mode === 'mock'
      ? '모의 모드 · 한정된 예제 규칙으로 질문과 요약을 만듭니다. 실제 AI 호출·비용은 없습니다.'
      : `DeepSeek 서버 연결 경로 · ${!config.configured ? '서버 키 미설정' : !config.paidEnabled ? '유료 호출 비활성' : '호출 가능 설정 · 실응답 품질은 미검증'}. 오류 때 모의 응답으로 대체하지 않습니다.`;
    get('mode').classList.toggle('warn',mode === 'mock' || !config.configured || !config.paidEnabled);
    get('consent-area').hidden = mode !== 'deepseek';
  } catch { get('mode').textContent = '서버 연결을 확인하지 못했습니다. 입력을 유지하고 새로고침 전 내용을 별도로 보관해 주세요.'; get('mode').classList.add('warn'); }
  render();
}
void init();
