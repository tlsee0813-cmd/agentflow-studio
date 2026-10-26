/* Change plan on the existing map: intent → analysis (authored example or the real AI) → preview on the same map positions →
 * choose what to hand over → request document (a snapshot, never a sent job) → results per requested item → back to the
 * current map with the selection, camera and folds the person left. The current project is never written; a saved project's
 * plan lives in its own key (plan-store), an example's only in this tab. */
import type { Project } from '../shared/types.js';
import type { StorageLike } from '../shared/storage.js';
import type { StudioView } from '../shared/studio.js';
import { createPlan, selectItems, requestSnapshot, compareResults, parseScopeReview, type ChangePlan, type Evidence, type PlanItem, type ResultObservation, type RequestSnapshot } from '../shared/change-plan.js';
import { CONVERTER_INTENT, converterEvidence, converterExampleAnalysis, converterObservations } from '../shared/change-plan-example.js';
import type { Box } from './map-layout.js';
import { AskError, ERROR_TEXT, type AiStatus } from './studio-api.js';
import { h, put, $, ago, fullTime } from './plan-dom.js';
import { CONVERTER_KEY, CONDITION_LABEL, EVIDENCE_LABEL, exampleInput, projectInput, mapReply, secretLike, scopeInput, type Condition, type PlanInput } from './plan-source.js';
import { requestPlan, requestScope } from './plan-request.js';
import { emptyBundle, loadBundle, saveBundle, setAside, planFile, readPlanFile, type PlanBundle } from './plan-store.js';

export interface PlanOpened { key: string; kind: 'example' | 'saved' | 'legacy'; project: Project; view: StudioView; alias: { toId: Map<string, string> } | null }
export interface PlanReturn { selected: string | null; scope: string | null; camera: { x: number; y: number; k: number } }
export interface PlanHost {
  current(): PlanOpened | null;
  kv: StorageLike;
  status(): AiStatus;
  accessCode(): string; keepAccessCode(value: string): void;
  selected(): string | null;
  boxes(): Map<string, Box>;
  /** Select a part of the current project (null clears), staying in the current scope. */
  selectPart(id: string | null): void;
  /** Open a part's scope when it is not visible here (keeps the plan open). */
  showPart(id: string): void;
  reveal(partId: string): void;
  capture(): PlanReturn; restore(r: PlanReturn): void;
  /** The plan panel opened, closed or changed width: map insets and chrome follow. */
  chrome(): void;
  notice(text: string, action?: { label: string; run: () => void }): void;
  /** Once, when the plan opens: pan (never zoom) so the current view sits in the space beside the panel. */
  frame(): void;
}

type Focus = { kind: 'item'; id: string } | { kind: 'impacts' } | null;
interface Session {
  key: string; projectId: string; example: boolean; condition: Condition;
  bundle: PlanBundle; unreadable: boolean; storeMsg: string | null;
  focus: Focus; mode: 'current' | 'preview'; editing: boolean;
  pending: { controller: AbortController; input: PlanInput } | null; error: string | null;
  /** The one scope review of a request being made from an AI analysis, and why the last one did not produce a document. */
  scoping: { controller: AbortController; count: number } | null; scopeError: string | null;
  sheet: string | null; sources: boolean; adding: boolean; resultFor: string | null; addForm: boolean; copyMsg: string | null; fileMsg: string | null;
  ret: PlanReturn;
}

const MEMORY = new Map<string, PlanBundle>();
const memoryKey = (o: PlanOpened, c: Condition) => (o.key === CONVERTER_KEY ? `${o.key}#${c}` : o.project.id);
const short = (text: string, n: number) => { const t = text.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };

export function createPlanView(host: PlanHost) {
  let s: Session | null = null;

  /* ---------- bundles ---------- */
  function keysOf(o: PlanOpened): Record<string, string> { return Object.fromEntries(o.alias?.toId ?? []); }
  function exampleBundle(o: PlanOpened, c: Condition): PlanBundle {
    let plan = createPlan(o.project.id, `합성 예제 자료 · ${CONDITION_LABEL[c]} · main@S0`, CONVERTER_INTENT, converterEvidence(c), converterExampleAnalysis(keysOf(o), c));
    // Condition B's prerequisite is a separate item: first selection is what the person asked for directly.
    if (c === 'B') plan = selectItems(plan, plan.analysis.items.filter(i => i.id !== 'outcomes').map(i => i.id));
    return { ...emptyBundle(CONVERTER_INTENT), plan, by: { kind: 'example' } };
  }
  function bundleFor(o: PlanOpened, c: Condition): { bundle: PlanBundle; unreadable: boolean } {
    const k = memoryKey(o, c), cached = MEMORY.get(k);
    if (cached) return { bundle: cached, unreadable: false };
    if (o.kind === 'example') { const b = o.key === CONVERTER_KEY ? exampleBundle(o, c) : emptyBundle(); MEMORY.set(k, b); return { bundle: b, unreadable: false }; }
    const loaded = loadBundle(host.kv, o.project.id);
    if (!loaded.unreadable) MEMORY.set(k, loaded.bundle);
    return loaded;
  }
  /** Saved projects: every change goes to the plan key and is read back; a failed write stays visible until one succeeds. */
  function persist() {
    const o = host.current(); if (!s || !o) return;
    MEMORY.set(memoryKey(o, s.condition), s.bundle);
    if (o.kind !== 'saved') return;
    if (s.unreadable) { s.storeMsg = '읽지 못한 변경안이 있어 이 탭에서만 유지하고 저장하지 않아요.'; return; }
    s.storeMsg = saveBundle(host.kv, o.project.id, s.bundle);
  }

  /* ---------- open / close ---------- */
  function open() {
    const o = host.current(); if (!o || o.kind === 'legacy') return;
    if (s && s.key === o.key) return;
    const condition: Condition = 'A', { bundle, unreadable } = bundleFor(o, condition);
    s = { key: o.key, projectId: o.project.id, example: o.kind === 'example', condition, bundle, unreadable, storeMsg: null,
      focus: null, mode: bundle.plan ? 'preview' : 'current', editing: !bundle.plan, pending: null, error: null, scoping: null, scopeError: null,
      sheet: null, sources: false, adding: false, resultFor: bundle.snapshots.at(-1)?.id ?? null, addForm: false, copyMsg: null, fileMsg: null, ret: host.capture() };
    if (unreadable) s.storeMsg = null;
    host.chrome(); render(); host.frame();
    requestAnimationFrame(() => (document.getElementById('plan-intent') ?? document.getElementById('plan-title'))?.focus());
  }
  /** Closing keeps the draft and the plan; the map goes back to the latest current view with the earlier selection and camera. */
  function close(restore = true) {
    if (!s) return;
    s.pending?.controller.abort(); s.scoping?.controller.abort();
    const ret = s.ret; s = null;
    $('plan-panel').hidden = true; $('plan-panel').replaceChildren(); $('plan-mode').hidden = true; $('plan-sheet').hidden = true;
    $('space').style.setProperty('--plan-w', '0px');
    host.chrome(); overlay();
    if (restore) { host.restore(ret); host.notice('변경 구상을 닫았어요. 초안과 변경안은 그대로 남아 있어요.', { label: '다시 열기', run: open }); }
  }
  /** A different project was opened: the plan of the previous one is kept, nothing to restore. */
  function projectChanged() { if (s && host.current()?.key !== s.key) close(false); }

  /* ---------- derived ---------- */
  const plan = () => s?.bundle.plan ?? null;
  const items = () => plan()?.analysis.items ?? [];
  const itemOf = (id: string) => items().find(i => i.id === id) ?? null;
  const partName = (id: string) => host.current()?.view.parts.find(p => p.id === id)?.name ?? null;
  const stale = () => { const p = plan(); return !!p && !!s && s.bundle.draft.trim() !== p.intent; };
  function input(): PlanInput | null {
    const o = host.current(); if (!o || !s || !s.bundle.draft.trim()) return null;
    return o.key === CONVERTER_KEY ? exampleInput(o, s.condition, s.bundle.draft, o.alias!.toId) : projectInput(o, s.bundle.draft, s.bundle.extra);
  }
  /** Parts linked to an item's parts: same part, a recorded relation, or a parent/child. Used to show an item's impacts. */
  function nearImpacts(item: PlanItem) {
    const o = host.current()!, mine = new Set(item.partIds), rel = o.view.relations;
    const parentOf = (id: string) => o.view.parts.find(p => p.id === id)?.parentId ?? null;
    return (plan()?.analysis.impacts ?? []).filter(x => !mine.has(x.partId) && [...mine].some(m =>
      rel.some(r => (r.from === m && r.to === x.partId) || (r.to === m && r.from === x.partId)) || parentOf(m) === x.partId || parentOf(x.partId) === m));
  }
  const missingDeps = (item: PlanItem) => item.dependsOn.filter(d => !plan()!.selected.includes(d));
  const latestSnapshot = () => s?.bundle.snapshots.at(-1) ?? null;
  const snapshotOf = (id: string | null) => s?.bundle.snapshots.find(x => x.id === id) ?? null;

  /* ---------- map overlay: same boxes, extra classes and a short note in place of the status line ---------- */
  function overlay() {
    document.querySelectorAll<HTMLElement>('.plan-direct,.plan-impact,.plan-mark').forEach(el => { el.classList.remove('plan-direct', 'plan-impact', 'plan-mark'); el.removeAttribute('data-plan-title'); });
    document.querySelectorAll<HTMLElement>('.plan-note').forEach(el => { el.textContent = ''; el.removeAttribute('title'); });
    $('space').classList.toggle('planning', !!s);
    $('space').classList.toggle('preview', !!s && s.mode === 'preview' && !!plan());
    $('space').classList.toggle('focusing', !!s && s.mode === 'preview' && !!s.focus);
    const p = plan(); if (!s || s.mode !== 'preview' || !p) return;
    const o = host.current()!, boxes = host.boxes();
    const rep = (id: string): string | null => { for (let cur: string | null = id, g = 0; cur && g < 64; cur = o.view.parts.find(x => x.id === cur)?.parentId ?? null, g++) { const b = boxes.get(cur); if (b && b.kind !== 'ghost') return cur; } return null; };
    const marks = new Map<string, { role: 'plan-direct' | 'plan-impact' | 'plan-mark'; note: string; full: string }>();
    const mark = (partId: string, role: 'plan-direct' | 'plan-impact' | 'plan-mark', note: string, full: string) => {
      const r = rep(partId); if (!r) return;
      const inner = r !== partId ? `안쪽 ‘${partName(partId)}’ · ` : '';
      const prev = marks.get(r);
      if (prev && (prev.role === 'plan-direct' || role === 'plan-mark' || (prev.role === 'plan-impact' && role === 'plan-impact'))) return;
      marks.set(r, { role, note: inner + note, full });
    };
    const f = s.focus;
    if (f?.kind === 'item') {
      const item = itemOf(f.id);
      if (item) {
        for (const id of item.partIds) mark(id, 'plan-direct', `바꿀 곳 · ${item.title}`, `${item.title}\n${item.description}`);
        for (const x of nearImpacts(item)) mark(x.partId, 'plan-impact', `영향 후보 · ${x.reason}`, `영향 후보: ${x.reason}`);
      }
    } else if (f?.kind === 'impacts') {
      for (const x of p.analysis.impacts) mark(x.partId, 'plan-impact', `영향 후보 · ${x.reason}`, `영향 후보: ${x.reason}`);
    } else {
      const count = new Map<string, string[]>();
      for (const i of p.analysis.items) if (p.selected.includes(i.id)) for (const id of i.partIds) (count.get(id) ?? count.set(id, []).get(id)!).push(i.title);
      for (const [id, titles] of count) mark(id, 'plan-mark', '', `이번에 맡길 변경: ${titles.join(', ')}`);
    }
    // Outline only the innermost visible part: a frame whose own child carries the same mark stays plain.
    const parentOf = (id: string) => o.view.parts.find(x => x.id === id)?.parentId ?? null;
    for (const [id, m] of [...marks]) for (let up = parentOf(id), g = 0; up && g < 64; up = parentOf(up), g++) if (marks.get(up)?.role === m.role) marks.delete(up);
    for (const [id, m] of marks) {
      const el = document.querySelector<HTMLElement>(`.node[data-box="${CSS.escape(id)}"], .frame[data-box="${CSS.escape(id)}"]`); if (!el) continue;
      el.classList.add(m.role); el.dataset.planTitle = m.full;
      if (m.role === 'plan-mark') continue;
      const note = el.querySelector<HTMLElement>('.plan-note'); if (note) { note.textContent = m.note; note.title = m.full; }
    }
  }
  function focusItem(next: Focus) {
    if (!s) return;
    const same = JSON.stringify(s.focus) === JSON.stringify(next);
    s.focus = same ? null : next;
    if (s.focus && plan()) s.mode = 'preview';
    render();
    // Bring the first changed part into view with the smallest move; never a refit.
    if (s.focus?.kind === 'item') {
      const item = itemOf(s.focus.id), boxes = host.boxes(), o = host.current()!;
      const first = item?.partIds.map(id => { for (let cur: string | null = id, g = 0; cur && g < 64; cur = o.view.parts.find(x => x.id === cur)?.parentId ?? null, g++) if (boxes.has(cur)) return cur; return null; }).find(Boolean);
      if (first) host.reveal(first);
    }
  }

  /* ---------- actions ---------- */
  const needsCode = () => host.status().access === 'code' && !host.accessCode();
  async function analyze() {
    if (!s || s.pending) return;
    const o = host.current()!, inp = input();
    s.error = null;
    if (!inp) { s.error = '바꾸고 싶은 모습을 먼저 적어 주세요.'; render(); return; }
    if (inp.problem === 'TOO_LARGE') { s.error = '보낼 자료가 요청 한도보다 커서 보내지 않았어요. 문장과 초안은 그대로예요.'; render(); return; }
    if (inp.problem) { s.error = `‘${inp.problem.secret}’에 키나 토큰처럼 보이는 문자열이 있어 보내지 않았어요. 그 부분을 지운 뒤 다시 살펴보세요.`; render(); return; }
    if (host.status().ai !== 'deepseek') { s.error = host.status().ai === 'off' ? ERROR_TEXT.AI_NOT_CONFIGURED! : ERROR_TEXT.NO_SERVER!; render(); return; }
    if (needsCode()) { s.error = '접속 코드를 입력해 주세요.'; render(); document.getElementById('plan-access')?.focus(); return; }
    const controller = new AbortController(), session = s;
    s.pending = { controller, input: inp }; render();
    try {
      const res = await requestPlan(inp.ask, controller.signal, host.accessCode());
      let analysis;
      try { analysis = mapReply(res.reply, inp); } catch { throw new AskError('INVALID_RESPONSE'); }
      const next = createPlan(o.project.id, inp.basis, inp.ask.intent, inp.evidence, analysis);
      session.bundle = { ...session.bundle, plan: next, by: { kind: 'ai', model: res.model, at: new Date().toISOString(), records: inp.records } };
      session.mode = 'preview'; session.focus = null; session.editing = false;
      if (s === session) persist();
    } catch (e) {
      const code = e instanceof AskError ? e.code : 'REQUEST_FAILED';
      if (code !== 'CANCELLED') session.error = ERROR_TEXT[code] ?? `분석을 받지 못했어요 (${code}). 문장과 초안은 그대로예요.`;
    }
    session.pending = null;
    if (s === session) render();
  }
  function toggleItem(id: string, on: boolean) {
    const p = plan(); if (!s || !p) return;
    const next = on ? [...p.selected, id] : p.selected.filter(x => x !== id);
    s.bundle = { ...s.bundle, plan: selectItems(p, next) }; s.scopeError = null; persist(); render();
  }
  /** Authored example: its fixed, checked dependencies and the static document. AI analysis: the chosen scope is reviewed
   * once, here and only here; its global dependsOn is not treated as settled. */
  function makeRequest() {
    const p = plan(); if (!s || !p || !p.selected.length || s.scoping) return;
    s.scopeError = null;
    if (s.bundle.by?.kind === 'example') { keepSnapshot(p, requestSnapshot(p)); return; }
    void reviewScope(p);
  }
  async function reviewScope(p: ChangePlan) {
    const st = s!, o = host.current()!, notMade = '전제 검토를 마치지 못해 새 요청문은 만들지 않았어요. 초안과 이전 요청문은 그대로예요.';
    const say = (text: string) => { st.scopeError = text; render(); };
    if (host.status().ai !== 'deepseek') return say(`${host.status().ai === 'off' ? ERROR_TEXT.AI_NOT_CONFIGURED : ERROR_TEXT.NO_SERVER} ${notMade}`);
    if (needsCode()) { st.editing = false; say(`접속 코드를 입력한 뒤 다시 만들어 주세요. ${notMade}`); document.getElementById('plan-access')?.focus(); return; }
    const inp = scopeInput(o, p);
    if (inp.problem === 'TOO_LARGE') return say(`검토할 자료가 요청 한도보다 커요. ${notMade}`);
    if (inp.problem) return say(`‘${inp.problem.secret}’에 키나 토큰처럼 보이는 문자열이 있어 보내지 않았어요. ${notMade}`);
    const start = { key: st.key, projectId: p.projectId, id: p.id, revision: p.revision, basis: p.basis };
    const controller = new AbortController();
    st.scoping = { controller, count: p.selected.length }; render();
    try {
      const res = await requestScope(inp.ask, controller.signal, host.accessCode());
      let review;
      try { review = parseScopeReview(res.reply, p.evidence.map(e => e.id)); } catch { throw new AskError('INVALID_RESPONSE'); }
      // Apply only to the plan and view it was asked for: same open plan, same project, plan id, revision and basis.
      const now = s === st ? plan() : null;
      if (!now || host.current()?.key !== start.key || now.projectId !== start.projectId || now.id !== start.id || now.revision !== start.revision || now.basis !== start.basis || stale()) {
        st.scopeError = '검토하는 동안 변경안이나 고른 항목이 바뀌어 이 검토는 쓰지 않았어요. 요청문을 다시 만들어 주세요.';
      } else { st.scoping = null; keepSnapshot(now, requestSnapshot(now, review), 'reviewed'); return; }
    } catch (e) {
      const code = e instanceof AskError ? e.code : 'REQUEST_FAILED';
      st.scopeError = code === 'CANCELLED' ? `취소했어요. ${notMade}` : `${ERROR_TEXT[code] ?? `검토 응답을 받지 못했어요 (${code}).`} ${notMade}`;
    }
    st.scoping = null;
    if (s === st) render();
  }
  function keepSnapshot(p: ChangePlan, snap: RequestSnapshot, origin: 'example' | 'reviewed' = 'example') {
    if (!s) return;
    s.bundle = { ...s.bundle, snapshots: [...s.bundle.snapshots, snap].slice(-60),
      labels: { ...s.bundle.labels, [snap.id]: Object.fromEntries(p.analysis.items.map(i => [i.id, i.title])) },
      origins: { ...s.bundle.origins, [snap.id]: origin } };
    // Keep the bundle within its limit: an observation goes with the snapshot it was read against.
    const kept = new Set(s.bundle.snapshots.map(x => x.id));
    for (const k of Object.keys(s.bundle.labels)) if (!kept.has(k)) delete s.bundle.labels[k];
    for (const k of Object.keys(s.bundle.origins)) if (!kept.has(k)) delete s.bundle.origins[k];
    s.bundle.observations = s.bundle.observations.filter(x => kept.has(s!.bundle.attached[x.id]!));
    for (const k of Object.keys(s.bundle.attached)) if (!kept.has(s.bundle.attached[k]!)) delete s.bundle.attached[k];
    s.sheet = snap.id; s.resultFor = snap.id; s.copyMsg = null;
    persist(); render();
    requestAnimationFrame(() => document.getElementById('plan-copy')?.focus());
  }
  function attach(snapshot: RequestSnapshot, obs: ResultObservation[]) {
    if (!s) return;
    s.bundle = { ...s.bundle, observations: [...s.bundle.observations, ...obs], attached: { ...s.bundle.attached, ...Object.fromEntries(obs.map(x => [x.id, snapshot.id])) } };
    persist(); render();
  }
  /** Authored example results, for snapshots of the authored analysis only; matched by the authored item ids, nothing else. */
  function loadExampleResults(snapshot: RequestSnapshot) {
    const n = s!.bundle.snapshots.indexOf(snapshot) + 1;
    attach(snapshot, converterObservations().map(x => ({ ...x, id: `${x.id}-${n}` })));
  }
  async function copy(text: string) {
    if (!s) return;
    try { await navigator.clipboard.writeText(text); s.copyMsg = '복사했어요. 작업 AI에 붙여 넣어 전달하세요.'; }
    catch {
      s.copyMsg = '자동 복사가 막혀 있어요. 글을 선택해 직접 복사하세요.';
      const pre = document.querySelector('#plan-sheet pre'); if (pre) { const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }
    }
    renderSheet();
  }
  function exportPlan() {
    const o = host.current(); if (!s || !o) return;
    const blob = new Blob([planFile(s.bundle, o.project)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${o.project.name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'project'}-변경안.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    s.fileMsg = '변경안 파일을 내려받았어요. 프로젝트 백업과는 따로예요.'; render();
  }
  function importPlan() { $<HTMLInputElement>('plan-import-file').click(); }
  {
    const file = $<HTMLInputElement>('plan-import-file');
    file.addEventListener('change', async () => {
      const f = file.files?.[0]; file.value = ''; const o = host.current(); if (!f || !s || !o) return;
      if (f.size > 4_000_000) { s.fileMsg = '파일이 너무 커요. 아무것도 바꾸지 않았어요.'; render(); return; }
      const read = readPlanFile(await f.text(), o.project.id);
      if (typeof read === 'string') { s.fileMsg = read; render(); return; }
      if ((s.bundle.plan || s.bundle.snapshots.length) && !confirm('지금 변경안을 가져온 파일의 내용으로 바꿀까요? 지금 안을 남기려면 먼저 파일로 내보내 두세요.')) return;
      s.bundle = read; s.focus = null; s.mode = read.plan ? 'preview' : 'current'; s.editing = !read.plan; s.resultFor = read.snapshots.at(-1)?.id ?? null;
      persist(); s.fileMsg = s.storeMsg ? null : '변경안 파일을 가져왔어요.'; render();
    });
  }
  function startOver() {
    const o = host.current(); if (!s || !o) return;
    const failed = setAside(host.kv, o.project.id);
    if (failed) { s.storeMsg = failed; render(); return; }
    s.unreadable = false; persist(); render();
  }
  function setCondition(c: Condition) {
    const o = host.current(); if (!s || !o || s.condition === c) return;
    MEMORY.set(memoryKey(o, s.condition), s.bundle);
    s.condition = c; s.bundle = bundleFor(o, c).bundle; s.focus = null; s.error = null; s.mode = s.bundle.plan ? 'preview' : 'current';
    s.resultFor = s.bundle.snapshots.at(-1)?.id ?? null; s.editing = !s.bundle.plan;
    render();
  }

  /* ---------- rendering ---------- */
  function render() {
    if (!s) return;
    const o = host.current(); if (!o) return;
    renderMode(); renderPanel(o);
    $('space').style.setProperty('--plan-w', `${width()}px`);
    renderSheet(); overlay();
  }
  const width = () => (s ? $('plan-panel').getBoundingClientRect().width + 24 : 0);
  function renderMode() {
    const box = $('plan-mode'), p = plan();
    box.hidden = !s || !p;
    if (!s || !p) return;
    const b = (mode: 'current' | 'preview', label: string) => h('button', { type: 'button', 'aria-pressed': String(s!.mode === mode), onclick: () => { s!.mode = mode; if (mode === 'current') s!.focus = null; render(); } }, label);
    box.replaceChildren(b('current', '현재'), b('preview', '변경 미리보기'));
  }

  function renderPanel(o: PlanOpened) {
    const panel = $('plan-panel'), prev = panel.querySelector('.pp-body'), keep = prev?.scrollTop ?? 0, p = plan(), st = s!;
    panel.hidden = false;
    const title = p ? p.intent : '새 변경안';
    const head = h('header', { class: 'pp-head' },
      h('div', { class: 'pp-kicker' }, h('strong', {}, '변경 구상'), st.example ? h('span', { class: 'tag' }, '예제') : null),
      h('h2', { id: 'plan-title', tabindex: '-1', title: p?.intent ?? '' }, title),
      p ? h('p', { class: 'pp-basis', title: p.basis }, `기준 · ${short(p.basis, 70)}`) : null,
      newerNote(o, p),
      h('button', { type: 'button', class: 'close', 'aria-label': '변경 구상 닫고 현재 지도로', title: '닫기 (Esc) · 초안은 남아요', onclick: () => close() }, '×'));
    const body = h('div', { class: 'pp-body' });
    put(body, partContext(o), intentSection(o), p ? planSection(o, p) : null, st.bundle.snapshots.length ? resultSection() : null);
    // What goes into this request stays in view under the scrolling body, next to the button that makes it.
    panel.replaceChildren(head, body, ...(p ? [requestSection(p)] : []), footer(o));
    body.scrollTop = keep;
  }
  /** The plan's basis is fixed; newer records are announced, never merged into it. */
  function newerNote(o: PlanOpened, p: ChangePlan | null) {
    if (!p || o.kind !== 'saved') return null;
    const newer = o.view.records.filter(r => r.at > p.createdAt).length;
    return newer ? h('p', { class: 'pp-newer' }, `만든 뒤 새 기록 ${newer}개 · 이 안의 기준은 그대로예요`) : null;
  }
  function partContext(o: PlanOpened) {
    const id = host.selected(), p = plan(); if (!id || !p) return null;
    const part = o.view.parts.find(x => x.id === id); if (!part) return null;
    const touching = p.analysis.items.filter(i => i.partIds.includes(id)), impacts = p.analysis.impacts.filter(x => x.partId === id);
    return h('section', { class: 'pp-sec pp-part' },
      h('p', { class: 'pp-part-name' }, h('span', {}, '선택한 부분'), h('strong', {}, part.name), h('button', { type: 'button', class: 'link-button', onclick: () => host.selectPart(null) }, '해제')),
      touching.length ? h('p', {}, '바꾸는 항목 · ', ...touching.flatMap((i, n) => [n ? ', ' : '', h('button', { type: 'button', class: 'link-button', onclick: () => focusItem({ kind: 'item', id: i.id }) }, i.title)])) : null,
      impacts.map(x => h('p', { class: 'pp-muted clamp2', title: x.reason }, `영향 후보 · ${x.reason}`))[0] ?? null,
      !touching.length && !impacts.length ? h('p', { class: 'pp-muted' }, '이 변경안에서 직접 바꾸거나 영향 후보로 본 부분은 아니에요.') : null);
  }

  function intentSection(o: PlanOpened) {
    const st = s!, p = plan(), sec = h('section', { class: 'pp-sec pp-intent' });
    const status = host.status(), canAsk = status.ai === 'deepseek';
    if (p && !st.editing && !stale()) {
      sec.classList.add('compact');
      put(sec, h('div', { class: 'pp-row pp-acts' },
        h('button', { type: 'button', class: 'link-button', onclick: () => { st.editing = true; render(); requestAnimationFrame(() => document.getElementById('plan-intent')?.focus()); } }, '문장 고치기'),
        sourcesToggle(o),
        st.pending ? null : h('button', { type: 'button', class: 'link-button', disabled: !canAsk, title: canAsk ? reachText() : 'AI 서버가 연결된 주소에서 쓸 수 있어요', onclick: () => void analyze() }, 'AI로 다시 살펴보기')),
        conditionSwitch(o));
      if (st.sources) put(sec, sourceList(p.evidence.filter(e => !st.bundle.extra.some(x => x.id === e.id))), addSource(o));
      put(sec, ...askLine(canAsk, p, true));
      return sec;
    }
    const area = h('textarea', { id: 'plan-intent', rows: '3', maxlength: '6000', placeholder: '어떻게 바뀌면 좋을지 두세 줄로 적어 주세요. 예: 폴더째 변환하고, 실패한 파일은 모아서 보고 싶어.', 'aria-label': '바꾸고 싶은 모습', disabled: !!st.pending }) as HTMLTextAreaElement;
    area.value = st.bundle.draft;
    const staleLine = h('p', { class: 'pp-stale', role: 'status' });
    const setStale = () => { staleLine.textContent = stale() ? '고친 문장은 아직 살펴보지 않았어요. 아래 변경안은 앞 문장 기준이에요.' : ''; staleLine.hidden = !stale(); };
    area.addEventListener('input', () => { st.bundle = { ...st.bundle, draft: area.value }; persist(); setStale(); syncFoot(); });
    area.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); area.blur(); } if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void analyze(); } });
    setStale();
    sec.append(h('label', { for: 'plan-intent', class: 'pp-label' }, '바꾸고 싶은 모습'), area, staleLine,
      h('div', { class: 'pp-row' }, sourcesToggle(o), p ? h('button', { type: 'button', class: 'link-button', onclick: () => { st.editing = false; render(); } }, '접기') : null));
    put(sec, conditionSwitch(o));
    if (st.sources) put(sec, sourceList((input() ?? { evidence: [] }).evidence.filter(e => !st.bundle.extra.some(x => x.id === e.id))), addSource(o));
    put(sec, ...askLine(canAsk, p));
    return sec;
  }
  /** compact: the plan is shown and the ask is the small link above; only progress, errors and a needed code appear here. */
  function askLine(canAsk: boolean, p: ChangePlan | null, compact = false): (Node | null)[] {
    const st = s!, out: (Node | null)[] = [];
    if (st.pending) {
      out.push(h('div', { class: 'pending' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }),
        h('span', {}, `${host.status().model ?? 'AI'}가 자료 ${st.pending.input.evidence.length}개와 지도를 읽고 있어요…`),
        h('button', { type: 'button', class: 'link-button', onclick: () => st.pending?.controller.abort() }, '취소')));
      return out;
    }
    if (st.error) out.push(h('p', { class: 'pp-error', role: 'alert' }, st.error));
    if (host.status().access === 'code' && canAsk && (!compact || !host.accessCode() || st.error)) {
      const code = h('input', { id: 'plan-access', type: 'password', placeholder: '접속 코드', autocomplete: 'off', value: host.accessCode() }) as HTMLInputElement;
      const keep = () => host.keepAccessCode(code.value);
      code.addEventListener('input', keep); code.addEventListener('change', keep);
      out.push(h('div', { class: 'access' }, h('label', { for: 'plan-access' }, '접속 코드'), code));
    }
    if (compact) return out;
    const label = p ? (stale() ? '고친 문장으로 살펴보기' : 'AI로 다시 살펴보기') : 'AI로 살펴보기';
    const reach = h('p', { class: 'fine', id: 'plan-reach' }, reachText());
    out.push(h('div', { class: 'pp-row pp-ask' }, h('button', { type: 'button', class: p && !stale() ? 'secondary small' : 'primary small', disabled: !canAsk || !st.bundle.draft.trim(), onclick: () => void analyze() }, label), reach));
    if (!canAsk) out.push(h('p', { class: 'fine' }, host.status().ai === 'off' ? '서버에 AI 키가 없어 살펴볼 수 없어요. 초안은 남아요.' : 'AI 서버가 연결된 주소에서 살펴볼 수 있어요. 초안은 남아요.'));
    return out;
  }
  /** What the next analysis would read, before anything is sent. */
  function reachText(): string {
    const inp = input(); if (!inp) return '';
    if (inp.problem === 'TOO_LARGE') return '자료가 요청 한도보다 커요';
    if (inp.problem) return `‘${inp.problem.secret}’에 키처럼 보이는 글이 있어요`;
    if (s!.example) return `예제 원자료 ${inp.evidence.filter(e => e.id !== 'INTENT').length}개${inp.evidence.some(e => e.id === 'INTENT') ? ' + 고친 문장' : ''} · 작성된 분석은 보내지 않아요`;
    const added = s!.bundle.extra.length ? ` + 붙인 자료 ${s!.bundle.extra.length}개` : '';
    return inp.records.total ? `이 문장${added} + 기록 ${inp.records.sent === inp.records.total ? `${inp.records.total}개` : `${inp.records.total}개 중 최신 ${inp.records.sent}개`}` : `${added ? `이 문장${added}` : '이 문장과 지도'} · 아직 기록 없음`;
  }
  function syncFoot() { const r = document.getElementById('plan-reach'); if (r) r.textContent = reachText(); const btn = r?.previousElementSibling as HTMLButtonElement | null; if (btn) btn.disabled = host.status().ai !== 'deepseek' || !s!.bundle.draft.trim(); }
  function sourcesToggle(_o: PlanOpened) {
    const st = s!, n = (plan() && !stale() && !st.editing ? plan()!.evidence : input()?.evidence ?? []).length;
    return h('button', { type: 'button', class: 'link-button quiet', 'aria-expanded': String(st.sources), onclick: () => { st.sources = !st.sources; render(); } }, `${st.example ? '예제 원자료' : '읽는 자료'} ${n}개`);
  }
  function conditionSwitch(o: PlanOpened) {
    if (o.key !== CONVERTER_KEY) return null;
    const st = s!, b = (c: Condition, label: string) => h('button', { type: 'button', 'aria-pressed': String(st.condition === c), title: CONDITION_LABEL[c], disabled: !!st.pending, onclick: () => setCondition(c) }, label);
    return h('div', { class: 'pp-cond', role: 'group', 'aria-label': '예제 자료 바꾸기' }, h('span', {}, '자료 바꾸기 · 코드에 파일별 결과가'), b('A', '있음'), b('B', '없음'));
  }
  function sourceList(evidence: { id: string; kind: keyof typeof EVIDENCE_LABEL; title: string; text: string; basis: string }[]) {
    return h('ol', { class: 'pp-sources' }, ...evidence.map(e => h('li', {}, h('details', {},
      h('summary', {}, h('span', { class: `pp-kind k-${e.kind}` }, EVIDENCE_LABEL[e.kind]), h('span', {}, e.title)),
      h('p', {}, e.text), h('p', { class: 'pp-ref' }, `${e.id} · ${e.basis}`)))));
  }

  /** The person's own material for a project with few records: kept in the plan's sidecar, sent with the next analysis. */
  function addSource(o: PlanOpened) {
    if (o.kind !== 'saved') return null;
    const st = s!, extra = st.bundle.extra;
    const list = extra.length ? h('ul', { class: 'pp-extra' }, ...extra.map(e => h('li', {}, h('span', { class: `pp-kind k-${e.kind}` }, EVIDENCE_LABEL[e.kind]), h('span', {}, e.title),
      h('button', { type: 'button', class: 'link-button', 'aria-label': `‘${e.title}’ 자료 빼기`, onclick: () => { st.bundle = { ...st.bundle, extra: st.bundle.extra.filter(x => x.id !== e.id) }; persist(); render(); } }, '빼기')))) : null;
    if (!st.adding) return h('div', { class: 'pp-addsrc' }, list, extra.length < 20 ? h('button', { type: 'button', class: 'link-button', onclick: () => { st.adding = true; render(); requestAnimationFrame(() => document.getElementById('src-title')?.focus()); } }, '+ 자료 추가') : null);
    const kind = h('select', { id: 'src-kind', 'aria-label': '자료 종류' }) as HTMLSelectElement;
    for (const [v, l] of [['report', '받은 작업 보고'], ['code', '프로젝트 자료·코드'], ['test', '검사 기록']] as const) kind.append(h('option', { value: v }, l));
    const title = h('input', { id: 'src-title', maxlength: '120', placeholder: '제목 · 예: 변환 함수 발췌', autocomplete: 'off' }) as HTMLInputElement;
    const text = h('textarea', { id: 'src-text', rows: '4', maxlength: '12000', placeholder: '원문을 붙여 넣으세요' }) as HTMLTextAreaElement;
    const basis = h('input', { id: 'src-basis', maxlength: '200', placeholder: '자료 기준 · 예: main 브랜치 convert.ts, 10월 26일', autocomplete: 'off' }) as HTMLInputElement;
    const msg = h('p', { class: 'form-msg', role: 'status' });
    const strip = (t: string) => t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim();
    return h('form', { class: 'pp-add', onsubmit: (e: Event) => {
      e.preventDefault();
      const t = strip(title.value), x = strip(text.value), b = strip(basis.value).replace(/[\n\r\t]/g, ' ');
      if (!t || !x || !b) { msg.textContent = '제목, 원문, 자료 기준을 모두 적어 주세요.'; return; }
      if (secretLike(`${t}\n${x}\n${b}`)) { msg.textContent = '키나 토큰처럼 보이는 문자열이 있어 추가하지 않았어요. 그 부분을 지워 주세요.'; return; }
      let n = 1; while (st.bundle.extra.some(e => e.id === `U${String(n).padStart(2, '0')}`)) n++;
      const ev: Evidence = { id: `U${String(n).padStart(2, '0')}`, kind: kind.value as Evidence['kind'], title: t, text: x, basis: `사용자가 붙인 자료 · ${b}` };
      st.bundle = { ...st.bundle, extra: [...st.bundle.extra, ev] }; st.adding = false; persist(); render();
    } }, list, kind, title, text, basis, msg,
      h('div', { class: 'pp-row' }, h('button', { type: 'submit', class: 'primary small' }, '추가'), h('button', { type: 'button', class: 'link-button', onclick: () => { st.adding = false; render(); } }, '취소'),
        h('span', { class: 'fine' }, '붙인 자료는 다음 분석에 쓰여요. 실행해 확인한 결과로 보지 않아요.')));
  }

  function planSection(o: PlanOpened, p: ChangePlan) {
    const st = s!, by = st.bundle.by;
    const origin = by?.kind === 'example' ? h('span', { class: 'tag', title: '사람이 작성한 합성 예시 분석이에요. AI에 보낸 적이 없어요.' }, '작성된 예제 분석')
      : by?.kind === 'ai' ? h('span', { class: 'tag ai', title: `${fullTime(by.at)}${by.records.total ? ` · 기록 ${by.records.total}개 중 ${by.records.sent}개를 읽음` : ''}` }, `AI 분석 · ${by.model} · ${ago(by.at)}`) : null;
    const sec = h('section', { class: `pp-sec pp-plan${stale() ? ' is-stale' : ''}` },
      h('div', { class: 'pp-sec-head' }, h('h3', {}, '변경안'), origin),
      h('p', { class: 'pp-summary' }, p.analysis.summary));
    const list = h('ul', { class: 'pp-items' });
    for (const item of p.analysis.items) {
      const authored = st.bundle.by?.kind === 'example';
      const on = p.selected.includes(item.id), focused = st.focus?.kind === 'item' && st.focus.id === item.id, missing = on && authored ? missingDeps(item) : [];
      const parts = item.partIds.map(partName).filter(Boolean) as string[];
      const box = h('input', { type: 'checkbox', id: `pi-${item.id}`, 'aria-label': `‘${item.title}’ 이번에 맡기기` }) as HTMLInputElement;
      box.checked = on; box.addEventListener('change', () => toggleItem(item.id, box.checked));
      const li = h('li', { class: `pp-item${focused ? ' focused' : ''}${on ? ' on' : ''}` },
        h('div', { class: 'pp-item-row' }, box,
          h('button', { type: 'button', class: 'pp-item-title', 'aria-expanded': String(focused), onclick: () => focusItem({ kind: 'item', id: item.id }) },
            h('span', {}, item.title), h('small', {}, parts.length ? parts.join(' · ') : '새 부분'))));
      if (missing.length) li.append(h('p', { class: 'pp-warn' }, `‘${missing.map(d => itemOf(d)?.title ?? d).join('’, ‘')}’이 이 항목의 전제예요. `,
        h('button', { type: 'button', class: 'link-button', onclick: () => { s!.bundle = { ...s!.bundle, plan: selectItems(plan()!, [...plan()!.selected, ...missing]) }; persist(); render(); } }, '함께 맡기기'),
        h('span', {}, ' · 빼 두면 요청문에 미선택 전제로 적혀요.')));
      if (focused) li.append(itemDetail(o, item));
      list.append(li);
    }
    sec.append(list);
    const nImp = p.analysis.impacts.length;
    const folds = h('div', { class: 'pp-folds' },
      nImp ? h('button', { type: 'button', class: `pp-fold-btn${st.focus?.kind === 'impacts' ? ' on' : ''}`, 'aria-pressed': String(st.focus?.kind === 'impacts'), onclick: () => focusItem({ kind: 'impacts' }) }, `영향 후보 ${nImp}곳`) : null,
      p.analysis.preserve.length ? fold(`유지할 조건 ${p.analysis.preserve.length}`, p.analysis.preserve) : null,
      p.analysis.unknowns.length ? fold(`아직 정하지 않은 것 ${p.analysis.unknowns.length}`, p.analysis.unknowns) : null);
    sec.append(folds);
    if (st.focus?.kind === 'impacts') sec.append(h('ul', { class: 'pp-impacts' }, ...p.analysis.impacts.map(x => h('li', {}, h('button', { type: 'button', class: 'link-button', onclick: () => locate(x.partId) }, partName(x.partId) ?? '지금 지도에 없는 부분'), h('span', {}, x.reason)))));
    return sec;
  }
  const fold = (label: string, lines: string[]) => h('details', { class: 'pp-fold' }, h('summary', {}, label), h('ul', {}, ...lines.map(l => h('li', {}, l))));
  function locate(partId: string) { if (host.boxes().has(partId)) { host.reveal(partId); host.selectPart(partId); } else host.showPart(partId); }
  function itemDetail(o: PlanOpened, item: PlanItem) {
    const p = plan()!, impacts = nearImpacts(item), refs = p.evidence.filter(e => item.refs.includes(e.id));
    return h('div', { class: 'pp-detail' },
      h('p', {}, item.description),
      item.partIds.length ? h('p', { class: 'pp-line' }, h('span', {}, '바꿀 곳'), h('span', {}, ...item.partIds.flatMap((id, n) => [n ? ', ' : '', h('button', { type: 'button', class: 'link-button', onclick: () => locate(id) }, partName(id) ?? '지금 지도에 없는 부분')]))) : h('p', { class: 'pp-line' }, h('span', {}, '바꿀 곳'), '지금 지도에 없는 새 부분'),
      impacts.length ? h('div', { class: 'pp-line' }, h('span', {}, '함께 볼 곳'), h('ul', {}, ...impacts.map(x => h('li', {}, h('button', { type: 'button', class: 'link-button', onclick: () => locate(x.partId) }, partName(x.partId) ?? '부분'), ` — ${x.reason}`)))) : null,
      item.dependsOn.length ? (s!.bundle.by?.kind === 'example'
        ? h('p', { class: 'pp-line' }, h('span', {}, '전제'), item.dependsOn.map(d => itemOf(d)?.title ?? d).join(', '))
        : h('p', { class: 'pp-line' }, h('span', {}, '전제'), '요청문을 만들 때 고른 범위로 살펴봐요.')) : null,
      refs.length ? h('details', { class: 'pp-why' }, h('summary', {}, `근거 ${refs.length}개`), sourceList(refs)) : null
    );
  }

  function requestSection(p: ChangePlan) {
    const st = s!, last = latestSnapshot(), n = p.selected.length;
    const changed = last && (last.planId !== p.id || last.planRevision !== p.revision);
    const names = p.analysis.items.filter(i => p.selected.includes(i.id)).map(i => i.title);
    const sec = h('section', { class: 'pp-request', 'aria-label': '이번에 맡길 것' },
      h('p', { class: 'pp-chosen' }, h('strong', {}, `맡길 항목 ${n}/${p.analysis.items.length}`), h('span', { title: names.join('\n') }, names.length ? names.join(' · ') : '목록에서 이번에 맡길 항목에 체크하세요')),
      st.scoping
        ? h('div', { class: 'pending', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, `고른 항목 ${st.scoping.count}개의 전제를 살펴보는 중…`),
            h('button', { type: 'button', class: 'link-button', onclick: () => st.scoping?.controller.abort() }, '취소'))
        : h('div', { class: 'pp-row' }, h('button', { type: 'button', class: 'primary small', disabled: !n || stale(), onclick: makeRequest, title: stale() ? '고친 문장을 먼저 살펴본 뒤 만들 수 있어요' : '만들고 복사해도 보내거나 실행하지 않아요' }, '요청문 만들기'),
          last ? h('button', { type: 'button', class: 'link-button', onclick: () => { st.sheet = last.id; st.copyMsg = null; render(); } }, `마지막 요청문 · ${ago(last.createdAt)}`) : null),
      st.scopeError ? h('p', { class: 'pp-error', role: 'alert' }, st.scopeError) : null,
      !st.scoping && !st.scopeError && st.bundle.by?.kind === 'ai' ? h('p', { class: 'fine' }, '만들 때 고른 항목의 전제를 AI가 한 번 살펴봐요.') : null,
      changed && !st.scoping ? h('p', { class: 'fine' }, '마지막 요청문 뒤로 변경안이 바뀌었어요. 새로 만들어도 이전 것은 남아요.') : null);
    return sec;
  }

  function resultSection() {
    const st = s!, snaps = st.bundle.snapshots, snap = snapshotOf(st.resultFor) ?? snaps.at(-1)!;
    const labels = st.bundle.labels[snap.id] ?? {}, origin = st.bundle.origins[snap.id];
    const mine = st.bundle.observations.filter(x => st.bundle.attached[x.id] === snap.id);
    const rows = compareResults(snap, mine);
    const sec = h('section', { class: 'pp-sec pp-results' }, h('div', { class: 'pp-sec-head' }, h('h3', {}, '돌아온 기록'),
      snaps.length > 1 ? (() => {
        const sel = h('select', { 'aria-label': '대조할 요청문' }) as HTMLSelectElement;
        snaps.slice().reverse().forEach((x, i) => sel.append(h('option', { value: x.id, selected: x.id === snap.id }, `${i === 0 ? '마지막 ' : ''}요청문 · ${fullTime(x.createdAt)} · ${x.itemIds.length}개`)));
        sel.addEventListener('change', () => { st.resultFor = sel.value; st.addForm = false; render(); });
        return sel;
      })() : h('span', { class: 'pp-muted' }, `요청문 · ${fullTime(snap.createdAt)}`)));
    const ul = h('ul', { class: 'pp-res' });
    for (const r of rows) {
      const all = [...r.reported, ...r.code, ...r.tests];
      const counts = all.length ? `보고 ${r.reported.length} · 코드 자료 ${r.code.length} · 검사 ${r.tests.length}` : '받은 근거 없음';
      const li = h('li', { class: all.length ? 'has' : 'none' }, h('details', {},
        h('summary', {}, h('span', { class: 'pp-res-title' }, labels[r.itemId] ?? r.itemId), h('span', { class: 'pp-res-count' }, counts)),
        all.length ? h('ol', {}, ...all.map(x => h('li', {}, h('span', { class: `pp-kind k-${x.kind}` }, { report: '담당 보고', code: '코드 자료', test: '검사' }[x.kind]),
          h('p', {}, x.text), h('p', { class: 'pp-ref' }, x.basis)))) : h('p', { class: 'pp-muted' }, '이 항목에 대응하는 보고·코드·검사가 아직 없어요. 미구현이나 실패로 보지 않아요.')));
      ul.append(li);
    }
    sec.append(ul);
    const asked = new Set(snap.itemIds), outside = mine.filter(x => !asked.has(x.itemId)).length;
    if (outside) sec.append(h('p', { class: 'pp-muted' }, `요청하지 않은 항목에 대한 기록 ${outside}개는 대응하지 않았어요.`));
    const loaded = mine.some(x => /^(R07|P02|R08)-/.test(x.id));
    const actions = h('div', { class: 'pp-row' });
    if (st.example && origin === 'example' && !loaded) actions.append(h('button', { type: 'button', class: 'secondary small', onclick: () => loadExampleResults(snap) }, '돌아온 기록 살펴보기'));
    if (!st.example || origin !== 'example') actions.append(h('button', { type: 'button', class: 'link-button', 'aria-expanded': String(st.addForm), onclick: () => { st.addForm = !st.addForm; render(); } }, st.addForm ? '붙이기 닫기' : '돌아온 기록 붙이기'));
    if (actions.childElementCount) sec.append(actions);
    if (st.example && origin !== 'example') sec.append(h('p', { class: 'fine' }, '예제의 돌아온 기록은 작성된 예제 항목과만 대응해요. AI 분석 항목에는 받은 글을 직접 붙여 주세요.'));
    if (st.addForm) sec.append(addForm(snap, labels));
    return sec;
  }
  function addForm(snap: RequestSnapshot, labels: Record<string, string>) {
    const st = s!;
    const item = h('select', { id: 'obs-item' }) as HTMLSelectElement;
    for (const id of snap.itemIds) item.append(h('option', { value: id }, labels[id] ?? id));
    const kind = h('select', { id: 'obs-kind' }) as HTMLSelectElement;
    for (const [v, l] of [['report', '담당 보고'], ['code', '코드 자료'], ['test', '검사 기록']]) kind.append(h('option', { value: v! }, l!));
    const text = h('textarea', { id: 'obs-text', rows: '3', maxlength: '12000', placeholder: '작업 AI가 돌려준 글을 붙여 넣으세요' }) as HTMLTextAreaElement;
    const basis = h('input', { id: 'obs-basis', maxlength: '300', placeholder: '어디의 결과인가요? 예: feature/folder 브랜치 보고' }) as HTMLInputElement;
    const msg = h('p', { class: 'form-msg', role: 'status' });
    return h('form', { class: 'pp-add', onsubmit: (e: Event) => {
      e.preventDefault();
      if (!text.value.trim() || !basis.value.trim()) { msg.textContent = '받은 글과 그 결과의 위치를 함께 적어 주세요.'; return; }
      const obs: ResultObservation = { id: `O_${crypto.randomUUID()}`, itemId: item.value, kind: kind.value as ResultObservation['kind'],
        text: text.value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' '), basis: basis.value.trim().replace(/[\u0000-\u001f\u007f]/g, ' '), refs: [] };
      try { compareResults(snap, [...st.bundle.observations.filter(x => st.bundle.attached[x.id] === snap.id), obs]); } catch { msg.textContent = '이 글은 붙일 수 없어요(길이나 문자를 확인해 주세요).'; return; }
      st.addForm = false; attach(snap, [obs]);
    } }, h('div', { class: 'pp-row' }, h('label', { for: 'obs-item', class: 'sr-only' }, '항목'), item, h('label', { for: 'obs-kind', class: 'sr-only' }, '종류'), kind),
      h('label', { for: 'obs-text', class: 'sr-only' }, '받은 글'), text, h('label', { for: 'obs-basis', class: 'sr-only' }, '결과의 위치'), basis, msg,
      h('div', { class: 'pp-row' }, h('button', { type: 'submit', class: 'primary small' }, '붙이기'), h('span', { class: 'fine' }, '붙인 글만 대조해요. 완료로 표시하지 않아요.')));
  }

  function footer(o: PlanOpened) {
    const st = s!, foot = h('footer', { class: 'pp-foot' });
    if (st.unreadable) foot.append(h('p', { class: 'pp-error', role: 'alert' }, '이 브라우저에 저장된 변경안을 읽지 못했어요. 원래 내용은 지우지 않고 그대로 두었어요. ',
      h('button', { type: 'button', class: 'link-button', onclick: startOver }, '따로 보관하고 새로 시작')));
    if (st.storeMsg) foot.append(h('p', { class: 'pp-error', role: 'alert' }, st.storeMsg));
    if (st.fileMsg) foot.append(h('p', { class: 'pp-muted', role: 'status' }, st.fileMsg));
    const line = h('div', { class: 'pp-row' });
    if (o.kind === 'saved') {
      line.append(h('span', { class: 'fine' }, st.storeMsg || st.unreadable ? '저장 안 됨' : '이 브라우저에 저장 · 프로젝트 백업과 별도'), h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'link-button', disabled: !st.bundle.plan && !st.bundle.snapshots.length, onclick: exportPlan }, '파일로 내보내기'),
        h('button', { type: 'button', class: 'link-button', onclick: importPlan }, '가져오기'));
    } else line.append(h('span', { class: 'fine' }, '예제 · 이 탭에서만 남아요'));
    foot.append(line);
    return foot;
  }

  /* The request document reads in its own sheet over the map; closing it returns to the same panel place. */
  function renderSheet() {
    const sheet = $('plan-sheet'), snap = s ? snapshotOf(s.sheet) : null;
    sheet.hidden = !snap;
    if (!s || !snap) { sheet.replaceChildren(); return; }
    const labels = s.bundle.labels[snap.id] ?? {}, p = plan();
    const old = !p || snap.planId !== p.id || snap.planRevision !== p.revision;
    const total = Object.keys(labels).length || snap.itemIds.length;
    sheet.replaceChildren(
      h('header', {}, h('div', {}, h('h2', { id: 'sheet-title' }, '요청문'), h('p', {}, `맡길 항목 ${snap.itemIds.length}/${total} · ${snap.itemIds.map(id => labels[id] ?? id).join(' · ')}`),
        h('p', { class: 'fine' }, `${fullTime(snap.createdAt)}에 만듦 · ${{ example: '작성된 예제 분석의 고정 전제', reviewed: 'AI가 고른 범위의 전제를 살펴봄', ai: '전제 검토 없이 만든 이전 요청문' }[s.bundle.origins[snap.id] ?? 'ai']}${old ? ' · 지금 변경안과 다른 판' : ''}`)),
        h('button', { type: 'button', class: 'close', 'aria-label': '요청문 닫기', title: '닫기 (Esc)', onclick: closeSheet }, '×')),
      h('pre', { tabindex: '0' }, snap.text),
      h('footer', {}, h('button', { type: 'button', id: 'plan-copy', class: 'primary small', onclick: () => void copy(snap.text) }, '복사'),
        h('span', { class: 'fine', role: 'status' }, s.copyMsg ?? '복사는 이 글을 옮기는 일이에요. 접수·실행·완료를 기록하지 않아요.'),
        h('button', { type: 'button', class: 'link-button', onclick: closeSheet }, '닫기')));
  }
  function closeSheet() { if (!s) return; s.sheet = null; s.copyMsg = null; render(); document.querySelector<HTMLElement>('.pp-request .link-button, .pp-request .primary')?.focus(); }

  /** Escape: the innermost open thing first; the plan itself last. Returns true when handled. */
  function escape(): boolean {
    if (!s) return false;
    if (s.sheet) { closeSheet(); return true; }
    if (s.addForm) { s.addForm = false; render(); return true; }
    if (s.focus) { s.focus = null; render(); return true; }
    if (host.selected()) { host.selectPart(null); return true; }
    close(); return true;
  }

  return {
    isOpen: () => !!s,
    open, close, projectChanged, overlay, escape,
    /** The selection changed on the map while planning: the panel reads it in place of the part panel. */
    selectionChanged: () => { if (s) render(); },
    statusChanged: () => { if (s) render(); },
    toggle: () => (s ? close() : open()),
    width,
    sheetOpen: () => !!s?.sheet,
  };
}
