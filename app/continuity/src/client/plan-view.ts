/* Change plan on the existing map: intent → analysis (authored example or the real AI) → preview on the same map positions →
 * choose what to hand over → request document (a snapshot, never a sent job) → results per requested item → back to the
 * current map with the selection, camera and folds the person left. The current project is never written; a saved project's
 * plan lives in its own key (plan-store), an example's only in this tab. */
import type { Project } from '../shared/types.js';
import type { StorageLike } from '../shared/storage.js';
import type { StudioView } from '../shared/studio.js';
import { createPlan, selectItems, requestSnapshot, compareResults, parseScopeReview, type ChangePlan, type Evidence, type PlanItem, type PlanPresentation, type ResultObservation, type RequestSnapshot } from '../shared/change-plan.js';
import { CONVERTER_HEADING, CONVERTER_INTENT, converterEvidence, converterExampleAnalysis, converterObservations } from '../shared/change-plan-example.js';
import { mapLead, type Box } from './map-layout.js';
import { AskError, ERROR_TEXT, type AiStatus } from './studio-api.js';
import { h, put, $, ago, fullTime, inspectorWidth, codeGate, codeNote, chevron } from './plan-dom.js';
import { CONVERTER_KEY, CONDITION_LABEL, EVIDENCE_LABEL, exampleInput, projectInput, mapReply, secretLike, scopeInput, type Condition, type PlanInput } from './plan-source.js';
import { requestPlan, requestScope } from './plan-request.js';
import { emptyBundle, loadBundle, saveBundle, setAside, planFile, readPlanFile, authoringOf, type PlanBundle } from './plan-store.js';
import { pinOnEdit, screenContext, resolveRef, authoringStale, legacyRecord, type Authoring, type ContextRef } from '../shared/authoring-context.js';
import { requestResults } from './request-results.js';
import { correctRequestMatch } from '../shared/request-return.js';
import { readingParts, type ReadingPart } from '../shared/request-reading.js';

export interface PlanOpened { key: string; kind: 'example' | 'saved' | 'legacy'; project: Project; view: StudioView; alias: { toId: Map<string, string> } | null }
export interface PlanReturn { selected: string | null; scope: string | null; camera: { x: number; y: number; k: number } }
export interface PlanHost {
  current(): PlanOpened | null;
  kv: StorageLike;
  status(): AiStatus;
  accessCode(): string; keepAccessCode(value: string): void;
  selected(): string | null;
  boxes(): Map<string, Box>;
  /** Temporarily expose only this target's ancestors in the current scope. Explicit focus may reopen its path; a normal
   * render keeps a manual fold. null releases the preview's layer without changing user folds or record peeks. */
  targetContext(id: string | null, explicit: boolean): void;
  /** The change lines each actual part's own row may show in the preview (null: none). The map makes room for them on those
   * parts only; nothing else changes size. */
  rows(lines: Map<string, string[]> | null): void;
  /** Select a part of the current project (null clears), staying in the current scope. */
  selectPart(id: string | null): void;
  /** Open a part's scope when it is not visible here (keeps the plan open). */
  showPart(id: string): void;
  reveal(partId: string): void;
  capture(): PlanReturn; restore(r: PlanReturn): void;
  /** The plan panel opened, closed or changed width: map insets and chrome follow. */
  chrome(): void;
  /** After every render of the plan: the map's area follows what now reads beside it (the strip on top, the panel or the
   * comparison on the right), also when nothing else on the map changed (the first opening of a plan with no analysis). */
  area(): void;
  notice(text: string, action?: { label: string; run: () => void }): void;
  /** The reading pane, about these parts: true brings them beside the pane by the smallest pan (a new target); 'refit' shows
   * new content without moving the camera; false re-renders the same reading in place. null closes it. */
  surface(content: Node[] | null, parts: string[], place: boolean | 'refit'): void;
  /** When a whole plan comes to read (opened, analysed, imported, another example condition): the parts it changes, together,
   * by the smallest pan when they fit at the current zoom; else the target being read (fallback) as for a new target. */
  frame(all: string[], fallback: string[]): void;
  /** Read what came back for this project in the return reading (the plan closes; its draft stays). */
  readReturn(): void;
  pasteReturn(): void;
  /** The provided code/check file form; the frozen request is the context it was opened from, nothing is written to it. */
  fileReturn(): void;
  readRequest(id: string): void;
  commitProject(project: Project): Promise<string | null>;
}

type Focus = { kind: 'item'; id: string } | { kind: 'impacts' } | { kind: 'part'; id: string } | null;
interface Session {
  key: string; projectId: string; example: boolean; condition: Condition;
  bundle: PlanBundle; unreadable: boolean; storeMsg: string | null;
  focus: Focus; mode: 'current' | 'preview'; editing: boolean;
  /** Reading choice only: each change remembers its actual target, independently of folded map representatives. */
  targets: Record<string, string>;
  /** The whole plan (writing, sources, every item, the request and results) in the right panel. The map, the plan's strip and
   * one comparison are the default reading. */
  detail: boolean; strip: 'conditions' | null;
  /** The pane shows the sources of this change in its place (the way back keeps the change, drafts and camera), opened at
   * evidenceRef when one source was asked for. */
  evidenceFor: string | null; evidenceRef: string | null;
  /** The wide workspace's right column: what this request takes (default), one source, the returned results, or every source
   * the analysis reads. A source opens there in its place; the comparison beside it stays as it was. */
  rail: 'request' | 'source' | 'results' | 'sources'; railSource: string | null;
  /** An analysis that proposed no change: where its material list was scrolled when another view (a source, the returned results,
   * the next analysis's material) opened in its place, and the control that opened it (this tab only), so coming back finds the
   * same list position and the same control; reading that view never writes them. */
  railAt: number | null; railEntry: string | null;
  /** The person went from the wide comparison to a part on the map: the pane offers the way back, to the same change and the
   * same scroll (workAt). */
  fromWork: boolean; workAt: { list: number; detail: number } | null;
  /** The analysis in flight: its reply becomes the plan only while it is still the one in flight and the sentence and material
   * are still those it read (inputKey). */
  pending: { controller: AbortController; input: PlanInput } | null; error: string | null;
  /** The one scope review of a request being made from an AI analysis, and why the last one did not produce a document. */
  scoping: { controller: AbortController; count: number } | null; scopeError: string | null;
  sheet: string | null;
  /** The control that opened the request document now read (this tab only, never stored): closing it returns there, or to the
   * nearest usable control of the same place when that one is gone or off. Only for that same document. */
  sheetFrom: { snap: string; entry: 'make' | 'last' } | null;
  /** How the open document is read in this opening (this tab only, never stored; a new opening starts afresh): by its sections or
   * as its text, which materials are unfolded, where each view was left, and whether the last copy here was blocked. */
  sheetRead: SheetRead | null;
  sources: boolean; adding: boolean; resultFor: string | null; addForm: boolean; copyMsg: string | null; fileMsg: string | null;
  ret: PlanReturn;
}

interface SheetRead { id: number; view: 'reading' | 'text'; open: string[]; at: { reading: number; text: number }; blocked: boolean }
let openings = 0;
const freshRead = (): SheetRead => ({ id: ++openings, view: 'reading', open: [], at: { reading: 0, text: 0 }, blocked: false });
/** Section names in the document's own reading. They name where a range sits; the words shown are always the text's own. */
const SECTION: Record<ReadingPart['kind'], { nav: string | null; tag: string | null }> = {
  head: { nav: null, tag: null },
  selected: { nav: '맡긴 일', tag: '이번에 맡기는 일' },
  excluded: { nav: '맡기지 않음', tag: '이번 요청 아님' },
  prerequisites: { nav: '전제 후보', tag: '자동으로 포함하지 않음' },
  preserve: { nav: '유지 조건', tag: '지켜야 할 조건' },
  unknowns: { nav: '확인할 것', tag: '추가 요청 아님' },
  'review-unknowns': { nav: '검토 미확인', tag: '확인되지 않음' },
  materials: { nav: '자료', tag: '자료 · 작업 지시 아님' },
  material: { nav: null, tag: null },
  closing: { nav: '결과 안내', tag: '결과를 돌려줄 때' },
};

/** An analysis' unknowns are one list: choices still open and checks still needed, as the analysis wrote them (an earlier one too).
 * Shown whole under one neutral name; never sorted into the person's decisions, filtered or reworded here. */
const UNKNOWNS_NOTE = '분석이 남긴 미정·확인 사항이에요. 모두 직접 정해야 하는 결정이라는 뜻은 아니에요.';

const MEMORY = new Map<string, PlanBundle>();
/** A sentence handed over from the return reading, per project, in this tab only. It enters the draft only when the person
 * says so (write it as the draft when there is none, else add it at the end); dismissing or closing leaves the draft as is. */
const PROPOSALS = new Map<string, { text: string; sources: Evidence[] }>();
const memoryKey = (o: PlanOpened, c: Condition) => (o.key === CONVERTER_KEY ? `${o.key}#${c}` : o.project.id);
/** Where the caret was left in each draft when the plan closed (this tab only, per draft as MEMORY keys it). It comes back on
 * reopening only to the same text: a draft replaced since (imported, accepted, another example material) starts as usual. */
const CARETS = new Map<string, { text: string; start: number; end: number; dir: 'forward' | 'backward' | 'none'; top: number }>();
const short = (text: string, n: number) => { const t = text.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
/** The first sentence (or line) of a text, whole: a title or a one-line finding, the rest read where there is room. */
/** Characters in a region's sizing hint: wider than any region head's room at 12px, so the layout reserves two lines. */
const REGION_HINT = 120;
const firstSentence = (text: string) => { const t = text.trim(), m = /^(.+?)(?:[.!?。](?=\s|$)|\n)/s.exec(t); return m ? t.slice(0, m[0].length).trim() : t; };

export function createPlanView(host: PlanHost) {
  let s: Session | null = null;
  let moveTarget = false;
  /** The whole plan just came to read: frame all its changed parts once (then the camera is the person's). */
  let frameWhole = false;

  /* ---------- bundles ---------- */
  function keysOf(o: PlanOpened): Record<string, string> { return Object.fromEntries(o.alias?.toId ?? []); }
  function exampleBundle(o: PlanOpened, c: Condition): PlanBundle {
    let plan = createPlan(o.project.id, `합성 예제 자료 · ${CONDITION_LABEL[c]} · main@S0`, CONVERTER_INTENT, converterEvidence(c), converterExampleAnalysis(keysOf(o), c));
    // Condition B's prerequisite is a separate item: first selection is what the person asked for directly.
    if (c === 'B') plan = selectItems(plan, plan.analysis.items.filter(i => i.id !== 'outcomes').map(i => i.id));
    // The authored sentence was not written on this screen: no context is taken for it, and editing it takes none.
    return { ...emptyBundle(CONVERTER_INTENT), plan, by: { kind: 'example' }, authoring: legacyRecord(true) };
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
      focus: firstFocus(bundle.plan), targets: {}, mode: bundle.plan ? 'preview' : 'current', editing: !bundle.plan, detail: false, strip: null, evidenceFor: null, evidenceRef: null, rail: 'request', railSource: null, railAt: null, railEntry: null, fromWork: false, workAt: null, pending: null, error: null, scoping: null, scopeError: null,
      sheet: null, sheetFrom: null, sheetRead: null, sources: false, adding: false, resultFor: bundle.snapshots.at(-1)?.id ?? null, addForm: false, copyMsg: null, fileMsg: null, ret: host.capture() };
    if (unreadable) s.storeMsg = null;
    moveTarget = true; frameWhole = true; host.chrome(); render();
    // Focus right after the render that made the field (never a frame later, when it can land in a field being typed in).
    (document.getElementById('plan-intent') ?? document.getElementById('plan-title'))?.focus();
    const area = document.getElementById('plan-intent') as HTMLTextAreaElement | null, left = CARETS.get(memoryKey(o, condition));
    if (area && left && left.text === area.value) { area.setSelectionRange(left.start, left.end, left.dir); area.scrollTop = left.top; }
  }
  /** Closing keeps the draft and the plan; the map goes back to the latest current view with the earlier selection and camera. */
  function close(restore = true) {
    if (!s) return;
    s.pending?.controller.abort(); s.scoping?.controller.abort();
    const area = document.getElementById('plan-intent') as HTMLTextAreaElement | null;
    const key = s.key === CONVERTER_KEY ? `${s.key}#${s.condition}` : s.projectId;
    if (area) CARETS.set(key, { text: area.value, start: area.selectionStart, end: area.selectionEnd, dir: area.selectionDirection, top: area.scrollTop });
    const ret = s.ret; s = null; host.rows(null); host.targetContext(null, false);
    $('plan-panel').hidden = true; $('plan-panel').replaceChildren(); $('plan-mode').hidden = true; $('plan-sheet').hidden = true;
    $('plan-strip').hidden = true; $('plan-strip').replaceChildren(); host.surface(null, [], false); lastFocusKey = ''; lastShown = ''; cover(false);
    host.chrome(); overlay();
    if (restore) { host.restore(ret); host.notice('변경 구상을 닫았어요. 초안과 변경안은 그대로 남아 있어요.', { label: '다시 열기', run: open }); }
  }
  /** A different project was opened: the plan of the previous one is kept, nothing to restore. */
  function projectChanged() { if (s && host.current()?.key !== s.key) close(false); }

  /* ---------- derived ---------- */
  /** The comparison opens on one change: the first one handed over, else the first. */
  function firstFocus(p: ChangePlan | null): Focus {
    const first = p?.analysis.items.find(i => p.selected.includes(i.id)) ?? p?.analysis.items[0];
    return first ? { kind: 'item', id: first.id } : null;
  }
  const plan = () => s?.bundle.plan ?? null;
  const items = () => plan()?.analysis.items ?? [];
  /** The analysis proposed no change (items=[]): not 'nothing needs to change' and not 'done'. It reads in the workspace only. */
  const noChange = () => !!plan() && plan()!.analysis.items.length === 0;
  const itemOf = (id: string) => items().find(i => i.id === id) ?? null;
  const partName = (id: string) => host.current()?.view.parts.find(p => p.id === id)?.name ?? null;
  function itemTargets(item: PlanItem): string[] {
    const parts = host.current()?.view.parts ?? [], ids = new Set(item.partIds);
    for (const id of [...ids]) for (let p = parts.find(x => x.id === id)?.parentId, g = 0; p && g < 64; p = parts.find(x => x.id === p)?.parentId, g++) ids.delete(p);
    // Presentation is optional per part: an excerpt enriches its target without dropping other explicit targets or
    // reordering them (the change's own order, as on the map).
    return [...new Set([...ids, ...(item.presentation ?? []).map(x => x.partId)])];
  }
  function activeTarget(item: PlanItem): string | null {
    const ids = itemTargets(item), previous = s!.targets[item.id];
    const id = previous && ids.includes(previous) ? previous : ids[0] ?? null;
    if (id) s!.targets[item.id] = id;
    return id;
  }
  function chooseTarget(item: PlanItem, id: string, keyboard = false) {
    if (!s) return;
    s.targets[item.id] = id; s.focus = { kind: 'item', id: item.id }; s.mode = 'preview'; s.evidenceFor = null;
    if (host.selected()) host.selectPart(null);
    moveTarget = true; render();
    const at = visibleRep(id, host.boxes());
    if (!at) host.showPart(id);
    requestAnimationFrame(() => {
      const tab = document.querySelector<HTMLElement>(`.ps-target[data-target="${CSS.escape(id)}"]`);
      tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); if (keyboard) tab?.focus({ preventScroll: true });
    });
  }
  /* What an analysis reads from the person: the sentence and the material they added. The plan keeps both as it read them (its
     intent, and the added material among its sources by their U ids). Records and the time in the basis are not part of it:
     newer records are announced beside the plan, never merged into it. */
  const material = (list: Evidence[]) => JSON.stringify(list.filter(e => /^U\d{2}$/.test(e.id)).map(e => [e.id, e.kind, e.title, e.text, e.basis]));
  /** Why the plan no longer answers what is written now (null: it does). Writing the earlier sentence back makes it current again.
   * context: the draft's authoring context is not the one the plan was analysed with (changed, removed, or set on an older draft);
   * missing: a part of that context is gone from the project. Moving around the map or a renamed part is neither. */
  type Why = 'sentence' | 'material' | 'context' | 'missing';
  function staleness(): Why | null {
    const p = plan(), o = host.current(); if (!p || !s) return null;
    return s.bundle.draft.trim() !== p.intent ? 'sentence' : material(s.bundle.extra) !== material(p.evidence) ? 'material'
      : o ? authoringStale(authoringOf(s.bundle), o.project.id, o.view.parts) : null;
  }
  const stale = () => !!staleness();
  const STALE_LINE: Record<Why, string> = { sentence: '고친 문장은 아직 살펴보지 않았어요. 아래 변경안은 앞 문장 기준이에요.', material: '바뀐 자료는 아직 살펴보지 않았어요. 아래 변경안은 앞 자료 기준이에요.',
    context: '바뀐 작성 맥락은 아직 살펴보지 않았어요. 아래 변경안은 앞 작성 맥락 기준이에요.', missing: '작성 맥락의 부분이 지금 지도에 없어요. 아래 변경안은 그 부분이 있던 때 기준이에요.' };
  const inputKey = (st: Session) => JSON.stringify([st.key, st.condition, st.bundle.draft.trim(), material(st.bundle.extra)]);
  /** A request document comes only from the analysis of what is written now, with nothing being analysed or reviewed. */
  const canRequest = () => { const p = plan(); return !!s && !!p && p.selected.length > 0 && !stale() && !s.pending && !s.scoping; };
  const requestTitle = () => {
    const why = staleness();
    return why === 'sentence' ? '고친 문장을 먼저 살펴본 뒤 만들 수 있어요' : why === 'material' ? '바뀐 자료로 먼저 살펴본 뒤 만들 수 있어요'
      : why === 'context' || why === 'missing' ? '지금 작성 맥락으로 먼저 살펴본 뒤 만들 수 있어요'
      : s?.pending ? '살펴보기가 끝난 뒤 만들 수 있어요' : noChange() ? '이 분석에는 제안된 변경이 없어 요청문을 만들지 않아요' : '만들고 복사해도 보내거나 실행하지 않아요';
  };
  /** Work in flight belongs to the bundle it started from: replacing the bundle (another example material, an imported file)
   * cancels it, so its reply can never land on the new one. */
  function cancelWork() {
    if (!s) return;
    s.pending?.controller.abort(); s.pending = null; s.scoping?.controller.abort(); s.scoping = null;
  }
  function input(): PlanInput | null {
    const o = host.current(); if (!o || !s || !s.bundle.draft.trim()) return null;
    const authoring = authoringOf(s.bundle).draft;
    return o.key === CONVERTER_KEY ? exampleInput(o, s.condition, s.bundle.draft, o.alias!.toId, s.bundle.extra, authoring) : projectInput(o, s.bundle.draft, s.bundle.extra, authoring);
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

  /* ---------- map overlay: same boxes, one mark per part ----------
   A part a change targets reads what is to change under its own name: the change's wanted text for exactly this part when the
   plan has one (presentation), else the change's name ('변경'). Several changes on one part: the one being read with '외 n건',
   otherwise their count and names; none is picked as the part's text. A part only named as an impact candidate reads '영향
   후보' with a dashed outline. A target folded inside a part marks that part with the inner name only: the inside changes,
   and its wanted text is not the parent's. */
  interface RowChange { item: PlanItem; text: string; pres: PlanPresentation | null }
  /** Per actual target part, every change that names it, with its own text: from the plan alone, independent of the layout. */
  function rowChanges(p: ChangePlan): Map<string, RowChange[]> {
    const out = new Map<string, RowChange[]>();
    for (const item of p.analysis.items) for (const id of itemTargets(item)) {
      const pres = item.presentation?.find(x => x.partId === id) ?? null;
      out.set(id, [...(out.get(id) ?? []), { item, text: pres ? pres.wanted.text : item.title, pres }]);
    }
    return out;
  }
  const kindWord = (c: RowChange) => (!c.pres ? '변경' : c.pres.origin === 'suggestion' ? '제안' : '');
  const manyLine = (list: RowChange[]) => list.map(c => c.item.title).join(', ');
  /** The impact candidates the map names for what is being read: near the focused change, or all when reading the impacts. */
  function shownImpacts(p: ChangePlan) {
    const focusItem = s?.focus?.kind === 'item' ? itemOf(s.focus.id) : null;
    return focusItem ? nearImpacts(focusItem) : s?.focus?.kind === 'impacts' ? p.analysis.impacts : [];
  }
  /** What the comparison scene shows on parts' rows (every target's change line, whichever change is being read, and the
   * candidates named for the current reading): the same set the overlay draws, so no row keeps an empty line. The map holds
   * these sizes in both the current view and the preview while the plan is open. */
  function rowLines(p: ChangePlan): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const [id, list] of rowChanges(p)) out.set(id, [...list.map(c => `${kindWord(c)} ${c.text}${list.length > 1 ? ` 외 ${list.length - 1}건` : ''}`), ...(list.length > 1 ? [`변경 ${list.length}건 ${manyLine(list)}`] : [])]);
    for (const x of shownImpacts(p)) if (!out.has(x.partId)) out.set(x.partId, ['영향 후보']);
    // An open region keeps what it is now (its note, one line, dimmed) and reads the change under it: two lines in its head.
    // The layout gives a head the larger of its note's room and its planned lines' room, so the region asks for two planned
    // lines (a sizing request only: the hint is never drawn, and what the head shows is the note and the change line).
    const o = host.current(), boxes = host.boxes();
    if (o) for (const [id, lines] of out) {
      const b = boxes.get(id), now = b?.kind === 'frame' && b.depth === 0 ? mapLead(o.view, id) : '';
      if (now) out.set(id, [...lines, regionHint(`${now} ${lines[0] ?? ''}`)]);
    }
    return out;
  }
  /** A text long enough to take two planned lines in any region head (regions are at most 380px wide). */
  const regionHint = (t: string) => (t.length >= REGION_HINT ? t : t.padEnd(REGION_HINT, ` ${t}`));
  /* Existing relations read as context of the change being read: lines already on the map between its actual targets and the
     candidates named here, and from those candidates to other parts the analysis names as candidates (a shared node's other
     users). They move above the group surfaces and keep their own kind and hover meaning; nothing is drawn or inferred, and
     no line is restyled as required or verified. */
  function contextEdges(p: ChangePlan, rep: (id: string) => string | null, targets: string[], shown: { partId: string }[]) {
    document.querySelectorAll<SVGGElement>('#world .edge.ctx').forEach(e => e.classList.remove('ctx'));
    document.querySelectorAll('#world .plan-ctx').forEach(e => e.classList.remove('plan-ctx'));
    const anchors = new Set([...targets, ...shown.map(x => x.partId)].map(rep).filter((x): x is string => !!x));
    const named = new Set(shown.map(x => rep(x.partId)).filter((x): x is string => !!x));
    const others = new Set(p.analysis.impacts.map(x => rep(x.partId)).filter((x): x is string => !!x));
    const top = document.querySelector('#world .edges-top');
    // Each stored relation's own line; a summary line of the overview (.sum, not drawn while the plan reads) is never context.
    document.querySelectorAll<SVGGElement>('#world .edge:not(.sum)').forEach(e => {
      const a = e.dataset.from!, b = e.dataset.to!;
      const ctx = a !== b && ((anchors.has(a) && anchors.has(b) && (named.has(a) || named.has(b))) || (named.has(a) && others.has(b)) || (named.has(b) && others.has(a)));
      if (!ctx) return;
      e.classList.add('ctx'); if (top && e.parentNode !== top) top.append(e);
      // Both ends stay readable (not dimmed with the rest); an end gets no label it does not already have.
      for (const id of [a, b]) document.querySelector(`#world [data-box="${CSS.escape(id)}"]`)?.classList.add('plan-ctx');
    });
    // Lines no longer in context go back under the groups unless the selection holds them.
    const base = document.querySelector('#world .edges:not(.edges-top)');
    document.querySelectorAll<SVGGElement>('#world .edges-top .edge:not(.ctx):not(.on):not(.inner)').forEach(e => base?.append(e));
  }
  function overlay() {
    document.querySelectorAll<HTMLElement>('.plan-direct,.plan-impact,.plan-focus,.plan-reading,.plan-reading-now').forEach(el => { el.classList.remove('plan-direct', 'plan-impact', 'plan-focus', 'plan-reading', 'plan-reading-now'); el.removeAttribute('data-plan-title'); });
    document.querySelectorAll<HTMLElement>('.plan-note').forEach(el => { el.replaceChildren(); el.removeAttribute('title'); el.className = 'plan-note'; });
    document.querySelectorAll('.plan-badge').forEach(el => el.remove());
    $('space').classList.toggle('planning', !!s);
    $('space').classList.toggle('preview', !!s && s.mode === 'preview' && !!plan());
    $('space').classList.toggle('focusing', !!s && s.mode === 'preview' && !!s.focus);
    const p = plan(); if (!s || !p) { document.querySelectorAll('#world .edge.ctx').forEach(e => e.classList.remove('ctx')); document.querySelectorAll('#world .plan-ctx').forEach(e => e.classList.remove('plan-ctx')); return; }
    const o = host.current()!, boxes = host.boxes(), rep = (id: string) => visibleRep(id, boxes);
    // Drawn part → its own changes (the part itself is the target) and the inner targets it stands for.
    const own = rowChanges(p), marks = new Map<string, { items: PlanItem[]; inner: string[] }>();
    for (const [id, list] of own) {
      const r = rep(id); if (!r) continue;
      const m = marks.get(r) ?? { items: [], inner: [] };
      for (const c of list) if (!m.items.includes(c.item)) m.items.push(c.item);
      if (r !== id) m.inner.push(id); marks.set(r, m);
    }
    const focusItem = s.focus?.kind === 'item' ? itemOf(s.focus.id) : null;
    const focused = new Set((focusItem ? itemTargets(focusItem) : []).map(rep).filter((x): x is string => !!x));
    const reading = focusItem ? rep(activeTarget(focusItem) ?? '') : null;
    const impacts = shownImpacts(p).filter(x => !marks.has(rep(x.partId) ?? ''));
    // Existing relations read the same in the current view and the preview; only the change marks below are the preview's.
    contextEdges(p, rep, focusItem ? itemTargets(focusItem) : [], impacts);
    const el = (id: string) => document.querySelector<HTMLElement>(`.node[data-box="${CSS.escape(id)}"], .frame[data-box="${CSS.escape(id)}"]`);
    // The current view keeps only where the pane is reading (a neutral mark, no change words): the comparison and the map stay
    // matched while the change itself is hidden.
    if (s.mode !== 'preview') { if (reading) el(reading)?.classList.add('plan-reading-now'); return; }
    const kind = (word: string) => (word ? h('span', { class: 'pn-k' }, word) : null), gap = (word: string) => (word ? ' ' : null);
    for (const [id, m] of marks) {
      const e = el(id); if (!e) continue;
      e.classList.add('plan-direct'); if (focused.has(id)) e.classList.add('plan-focus');
      if (reading === id) e.classList.add('plan-reading');
      e.dataset.planTitle = m.items.map(i => i.title).join('\n');
      const note = e.querySelector<HTMLElement>('.plan-note'); if (!note) continue;
      const list = own.get(id) ?? [];
      if (list.length) {
        const mine = list.length > 1 && focusItem ? list.find(c => c.item === focusItem) ?? null : list.length === 1 ? list[0]! : null;
        if (mine) put(note, kind(kindWord(mine)), gap(kindWord(mine)), mine.text, list.length > 1 ? h('span', { class: 'pn-more' }, ` 외 ${list.length - 1}건`) : null);
        else put(note, kind(`변경 ${list.length}건`), ' ', manyLine(list));
        note.title = list.map(c => `${c.item.title}${c.pres ? ` · ${c.pres.origin === 'suggestion' ? '분석 제안' : '바꿀 모습'}: ${c.text}` : ' (이 부분의 바꿀 모습 자료 없음)'}`).join('\n') + '\n아직 적용 안 됨';
        if (m.inner.length) note.title += `\n안쪽에도 변경: ${m.inner.map(partName).join(', ')}`;
      } else {
        note.classList.add('inner');
        put(note, kind('안쪽'), ' ', `‘${m.inner.map(partName).join('’, ‘')}’ 변경`);
        note.title = `안쪽 부분을 바꾸려는 변경(아직 적용 안 됨): ${m.items.map(i => i.title).join(', ')}\n이 부분 전체를 바꾸는 것은 아니에요.`;
      }
    }
    for (const x of impacts) {
      const r = rep(x.partId), e = r ? el(r) : null; if (!e || e.classList.contains('plan-impact')) continue;
      e.classList.add('plan-impact');
      const note = e.querySelector<HTMLElement>('.plan-note'); if (note) { note.classList.add('inner'); note.textContent = `${r !== x.partId ? `안쪽 ‘${partName(x.partId)}’ · ` : ''}영향 후보`; note.title = `영향 후보: ${x.reason}`; }
    }
  }

  /* ---------- one target of a change: what it is now, what is wanted there, why the change reads it ----------
     The same grammar in the pane beside the map and in the wide comparison, for the authored example and for any analysis.
     '지금' is the plan's quote for this part (the map's description or a cited excerpt, with where it comes from); without one
     it says the material does not tell, never an empty slot and never an invented current behaviour. '바라는 모습' only where
     the plan states it for this part ('분석 제안' when the analysis proposes it). '왜 이 부분을 보나' is the analysis's own
     reason about this part, else the part's role on the map, labelled as such. Sources open where the reading is. */
  /** The part's own description as its role on the map (first sentence), with where it comes from; never a current state. */
  function partRole(o: PlanOpened, id: string): { text: string; from: string; label: string } | null {
    const part = o.view.parts.find(x => x.id === id);
    return part?.note ? { text: firstSentence(part.note), from: '지도 설명', label: '이 부분의 역할' } : part?.summary ? { text: firstSentence(part.summary), from: '받은 정리', label: '이 부분의 맥락' } : null;
  }
  /** outcome: the change's own description as the wanted result beside '지금' when the plan has no presentation for the change
   * (read once there instead of above). */
  function partReading(o: PlanOpened, p: ChangePlan, item: PlanItem, partId: string, at: string, openRef: (id: string) => void, extra: Node | null = null, outcome = false): HTMLElement {
    const name = partName(partId) ?? '부분', pres = item.presentation?.find(x => x.partId === partId) ?? null;
    // The role is the fallback reason only where '지금' does not already quote the same map description.
    const reasons = p.analysis.impacts.filter(x => x.partId === partId), role = reasons.length || pres ? null : partRole(o, partId);
    const row = (cls: string, label: string, ...body: (Node | null)[]) => h('div', { class: `co-row ${cls}` }, h('h4', { class: 'co-label' }, label), h('div', { class: 'co-val' }, ...body));
    const now = pres
      ? row('now', '지금', h('p', {}, pres.current.text), pres.current.source === 'evidence' ? refLine(p, pres.current.refs, openRef, '자료에서') : h('p', { class: 'co-from' }, '지도 설명'))
      : row('now unknown', '지금', h('p', {}, '이 변경안의 자료로는 지금 어떻게 하는지 알 수 없어요.'));
    const want = pres ? row('want', pres.origin === 'suggestion' ? '분석 제안' : '바라는 모습', h('p', {}, pres.wanted.text), refLine(p, pres.wanted.refs, openRef))
      : outcome ? row('want outcome', '바라는 결과', h('p', {}, item.description), refLine(p, item.refs, openRef, '변경 설명 · 근거')) : null;
    const why = reasons.length ? row('why', '왜 이 부분을 보나', ...reasons.flatMap(x => [h('p', {}, x.reason), refLine(p, x.refs, openRef)]))
      : role ? row('why role', role.label, h('p', {}, role.text), h('p', { class: 'co-from' }, role.from)) : null;
    return h('div', { class: `callout${pres ? ` ${pres.origin}` : ' plain'}`, 'data-box': at, 'data-target': partId, role: 'group', 'aria-label': `${name} · ${item.title}` },
      h('div', { class: 'co-head' }, h('strong', {}, name), at !== partId ? h('small', {}, `‘${partName(at)}’ 안쪽`) : null, extra),
      h('div', { class: `co-pair${want ? ' two' : ''}` }, now, want), why);
  }
  /** Cited sources as small buttons that open them where the reading is (the pane, or the workspace's right column). */
  function refLine(p: ChangePlan, refs: string[], openRef: (id: string) => void, lead = '근거'): HTMLElement | null {
    const list = refs.map(id => p.evidence.find(e => e.id === id)).filter((e): e is Evidence => !!e); if (!list.length) return null;
    return h('p', { class: 'co-from' }, `${lead} `, ...list.flatMap((e, n) => [n ? ' · ' : '', h('button', { type: 'button', class: 'co-ref', title: `${e.title} · ${e.basis}`, onclick: () => openRef(e.id) }, `${e.id} ${EVIDENCE_LABEL[e.kind]}`)]));
  }
  /** The part itself when it is drawn in this view, else its nearest drawn ancestor; null outside the view. */
  function visibleRep(id: string, boxes: Map<string, Box>): string | null {
    const o = host.current()!;
    for (let cur: string | null = id, g = 0; cur && g < 64; cur = o.view.parts.find(x => x.id === cur)?.parentId ?? null, g++) { const b = boxes.get(cur); if (b && b.kind !== 'ghost') return cur; }
    return null;
  }
  /** Where the request's changes sit on the map: what opening frames at a readable size. */
  function changedParts(): string[] {
    const p = plan(); if (!p) return [];
    const chosen = p.analysis.items.filter(i => p.selected.includes(i.id)), from = chosen.length ? chosen : p.analysis.items, boxes = host.boxes();
    return [...new Set(from.flatMap(i => i.partIds).map(id => visibleRep(id, boxes)).filter((x): x is string => !!x))];
  }
  function focusItem(next: Focus) {
    if (!s) return;
    const same = JSON.stringify(s.focus) === JSON.stringify(next);
    if (next?.kind === 'item' && host.selected()) host.selectPart(null);
    s.focus = same ? null : next; s.evidenceFor = null;
    if (s.focus && plan()) s.mode = 'preview';
    moveTarget = !!s.focus;
    render();
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
    const controller = new AbortController(), session = s, key = inputKey(s);
    s.pending = { controller, input: inp }; render();
    // Only the analysis still in flight for this open plan may speak: a cancelled, superseded or closed one ends silently.
    const mine = () => s === session && session.pending?.controller === controller && !controller.signal.aborted;
    try {
      const res = await requestPlan(inp.ask, controller.signal, host.accessCode());
      if (!mine()) throw new AskError('CANCELLED');
      let analysis;
      try { analysis = mapReply(res.reply, inp); } catch { throw new AskError('INVALID_RESPONSE'); }
      // The reply answers the sentence and material it was asked from, in the project it was asked in; not what is there now.
      if (host.current()?.key !== session.key || inputKey(session) !== key) session.error = '살펴보는 동안 문장이나 자료가 바뀌어 이 결과는 쓰지 않았어요. 지금 문장과 자료로 다시 살펴보세요.';
      else {
        // The plan keeps the authoring context this request sent. A context changed or removed while it was in flight stays as the
        // person left it: the plan then reads as made from the earlier context (stale), and nothing is made from it until analysed again.
        const next = createPlan(o.project.id, inp.basis, inp.ask.intent, inp.evidence, analysis, inp.origins);
        session.bundle = { ...session.bundle, plan: next, by: { kind: 'ai', model: res.model, at: new Date().toISOString(), records: inp.records },
          authoring: { ...authoringOf(session.bundle), analyzed: inp.analyzed } };
        session.mode = 'preview'; session.focus = firstFocus(next); session.targets = {}; session.editing = false; session.detail = false; moveTarget = true; frameWhole = true;
        persist();
      }
    } catch (e) {
      const code = e instanceof AskError ? e.code : 'REQUEST_FAILED';
      if (code !== 'CANCELLED' && mine()) session.error = ERROR_TEXT[code] ?? `분석을 받지 못했어요 (${code}). 문장과 초안은 그대로예요.`;
    }
    if (session.pending?.controller !== controller) return;
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
    const p = plan(); if (!s || !p || !canRequest()) { syncStale(); return; }
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
    const mine = () => st.scoping?.controller === controller;
    try {
      const res = await requestScope(inp.ask, controller.signal, host.accessCode());
      if (controller.signal.aborted) throw new AskError('CANCELLED');
      let review;
      try { review = parseScopeReview(res.reply, p.evidence.map(e => e.id)); } catch { throw new AskError('INVALID_RESPONSE'); }
      // Apply only to the plan and view it was asked for: same open plan, same project, plan id, revision and basis, and still
      // the analysis of what is written now.
      if (!mine()) return;
      const now = s === st ? plan() : null;
      if (!now || host.current()?.key !== start.key || now.projectId !== start.projectId || now.id !== start.id || now.revision !== start.revision || now.basis !== start.basis || stale() || st.pending) {
        st.scopeError = '검토하는 동안 변경안이나 고른 항목이 바뀌어 이 검토는 쓰지 않았어요. 요청문을 다시 만들어 주세요.';
      } else { st.scoping = null; keepSnapshot(now, requestSnapshot(now, review), 'reviewed'); return; }
    } catch (e) {
      if (!mine()) return;
      const code = e instanceof AskError ? e.code : 'REQUEST_FAILED';
      st.scopeError = code === 'CANCELLED' ? `취소했어요. ${notMade}` : `${ERROR_TEXT[code] ?? `검토 응답을 받지 못했어요 (${code}).`} ${notMade}`;
    }
    st.scoping = null;
    if (s === st) render();
  }
  function keepSnapshot(p: ChangePlan, snap: RequestSnapshot, origin: 'example' | 'reviewed' = 'example') {
    if (!s || stale() || s.pending) return;
    s.bundle = { ...s.bundle, snapshots: [...s.bundle.snapshots, snap].slice(-60),
      labels: { ...s.bundle.labels, [snap.id]: Object.fromEntries(p.analysis.items.map(i => [i.id, i.title])) },
      origins: { ...s.bundle.origins, [snap.id]: origin } };
    // Keep the bundle within its limit: an observation goes with the snapshot it was read against.
    const kept = new Set(s.bundle.snapshots.map(x => x.id));
    for (const k of Object.keys(s.bundle.labels)) if (!kept.has(k)) delete s.bundle.labels[k];
    for (const k of Object.keys(s.bundle.origins)) if (!kept.has(k)) delete s.bundle.origins[k];
    s.bundle.observations = s.bundle.observations.filter(x => kept.has(s!.bundle.attached[x.id]!));
    for (const k of Object.keys(s.bundle.attached)) if (!kept.has(s.bundle.attached[k]!)) delete s.bundle.attached[k];
    s.sheet = snap.id; s.sheetFrom = { snap: snap.id, entry: 'make' }; s.sheetRead = freshRead(); s.resultFor = snap.id; s.copyMsg = null;
    persist(); render();
    document.getElementById('plan-copy')?.focus({ preventScroll: true });
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
  let copying = 0;
  /** How a copy went is told only to the open document it was asked from (same session, same opening, the latest attempt): one that
   * ends after the document closed, the plan closed or another copy started says nothing and touches nothing. The copy is always the
   * whole text, whichever view is read and whatever is folded. */
  async function copy(text: string) {
    const st = s; if (!st) return;
    const opened = st.sheetFrom, sheet = st.sheet, mine = ++copying;
    let ok = true;
    try { await navigator.clipboard.writeText(text); } catch { ok = false; }
    if (s !== st || st.sheet !== sheet || st.sheetFrom !== opened || mine !== copying) return;
    // Read by its sections, the screen does not hold the whole text to select: the text view does, and is selected on the way there.
    const sections = !!snapshotOf(sheet)?.reading && st.sheetRead?.view === 'reading';
    if (st.sheetRead) st.sheetRead.blocked = !ok;
    st.copyMsg = ok ? '복사했어요. 작업 AI에 붙여 넣어 전달하세요.' : sections ? '자동 복사가 막혀 있어요. ‘원문 그대로’를 누르면 원문 전체가 선택돼요. 그대로 직접 복사하세요.' : '자동 복사가 막혀 있어요. 글을 선택해 직접 복사하세요.';
    if (!ok && !sections) selectText();
    renderSheet();
  }
  function selectText() { const pre = document.querySelector('#plan-sheet pre'); if (pre) { const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r); } }
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
      cancelWork(); s.bundle = read; s.focus = firstFocus(read.plan); s.targets = {}; s.mode = read.plan ? 'preview' : 'current'; s.editing = !read.plan; s.resultFor = read.snapshots.at(-1)?.id ?? null; moveTarget = true; frameWhole = true;
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
    cancelWork(); MEMORY.set(memoryKey(o, s.condition), s.bundle);
    s.condition = c; s.bundle = bundleFor(o, c).bundle; s.focus = firstFocus(s.bundle.plan); s.targets = {}; s.error = null; s.mode = s.bundle.plan ? 'preview' : 'current'; moveTarget = true; frameWhole = true;
    s.resultFor = s.bundle.snapshots.at(-1)?.id ?? null; s.editing = !s.bundle.plan;
    render();
  }

  /* ---------- rendering ---------- */
  function render() {
    if (!s) return;
    const o = host.current(); if (!o) return;
    // The comparison scene (the target's path and the rows' sizes) is the same in the current view and the preview: switching
    // the mode shows or hides the change marks only. Closing the plan gives the map back its own folds and sizes.
    const item = s.focus?.kind === 'item' ? itemOf(s.focus.id) : null, p = plan();
    host.rows(p ? rowLines(p) : null);
    host.targetContext(item ? activeTarget(item) : null, moveTarget);
    // The target's context may have opened or folded a region: its head asks again for the room it now draws (no-op if same).
    if (p) host.rows(rowLines(p));
    renderMode(); renderStrip(o);
    if (panelOpen()) renderPanel(o); else if (workOpen()) renderWork(o); else { const pp = $('plan-panel'); pp.hidden = true; pp.classList.remove('work'); pp.replaceChildren(); }
    cover(workOpen());
    renderSheet(); overlay(); renderCompare(o);
    host.area();
  }
  /** What the workspace covers (the map, its controls, the strip, the pane and the part panel) is inert while it is open: out of
   * the tab order and the accessibility tree, but kept in place with its size, camera and scroll. The workspace itself, the
   * request sheet over it, the toast and the top bar stay as they are. */
  const UNCOVERED = new Set(['plan-panel', 'plan-sheet', 'toast', 'plan-import-file']);
  function cover(on: boolean) { for (const el of Array.from($('space').children) as HTMLElement[]) el.inert = on && !UNCOVERED.has(el.id); }
  /** The slim panel beside the map: writing the first sentence, before there is a plan. */
  const panelOpen = () => !!s && !plan();
  /** The wide workspace over the map: the whole plan read and edited (asked for, writing, a sentence or material ahead of the
   * plan, work in flight). Otherwise the plan reads on the map: its strip and one change in the pane. */
  const workOpen = () => !!s && !!plan() && (s.detail || s.editing || stale() || !!s.pending || !!s.scoping || noChange());
  /** The width the map gives up beside it: the slim panel only. The workspace covers the map without moving it. */
  const width = () => (s && panelOpen() ? inspectorWidth() : 0);

  /* ---------- the plan's strip: what is being tried, what the analysis found, the changes, the way to the wide workspace ----------
     The changes are a reading choice (aria-current), not what the request takes: that count reads apart, and is chosen with
     explicit boxes in the pane and the workspace. */
  function renderStrip(o: PlanOpened) {
    const strip = $('plan-strip'), st = s!, p = plan();
    strip.hidden = false;
    const close = h('button', { type: 'button', class: 'close ps-close', 'aria-label': '변경 구상 닫기', title: '변경 구상 닫기 (Esc) · 초안은 남아요', onclick: () => closePlan() }, '×');
    if (!p) { strip.replaceChildren(); put(strip, h('div', { class: 'ps-head' }, h('span', { class: 'ps-kicker' }, '변경 구상'), st.example ? h('span', { class: 'tag' }, '예제') : null, h('span', { class: 'ps-intent' }, '오른쪽에 바꾸고 싶은 모습을 적어 주세요')), close); return; }
    const by = st.bundle.by, basis = by?.kind === 'example' ? '작성된 예제 분석' : by?.kind === 'ai' ? `AI 분석 · ${ago(by.at)}` : '분석';
    const focusId = st.focus?.kind === 'item' ? st.focus.id : null;
    const conds = p.analysis.preserve.length + p.analysis.unknowns.length;
    strip.replaceChildren(); put(strip,
      h('div', { class: 'ps-head' }, h('span', { class: 'ps-kicker', title: by?.kind === 'ai' ? `${by.model} · ${fullTime(by.at)}` : '' }, '변경 구상', h('small', {}, basis)),
        h('button', { type: 'button', class: 'ps-intent', title: `${p.intent}\n\n넓게 비교에서 문장·근거·요청을 다뤄요`, onclick: () => openWork() }, p.intent)),
      h('p', { class: 'ps-find', title: p.analysis.summary }, h('span', { class: 'ps-find-k' }, '분석이 찾은 것'), firstSentence(p.analysis.summary)),
      h('div', { class: 'ps-row' },
        noChange() ? h('span', { class: 'ps-none' }, '제안된 변경 없음')
          : h('div', { class: 'ps-items', role: 'group', 'aria-label': '읽을 변경' }, ...p.analysis.items.map(i => h('button', { type: 'button', class: 'ps-item', 'aria-current': focusId === i.id ? 'true' : 'false', title: i.title, onclick: () => focusItem({ kind: 'item', id: i.id }) }, i.title))),
        noChange() ? null : h('span', { class: 'ps-inc', title: '이번 요청에 포함한 변경 수' }, `요청에 포함 ${p.selected.length}/${p.analysis.items.length}`),
        conds ? conditions(p) : null),
      h('div', { class: 'ps-acts' }, h('button', { type: 'button', class: 'link-button ps-edit', onclick: () => edit() }, '문장 고치기'),
        h('button', { type: 'button', class: 'ps-more', onclick: () => openWork(focusId ?? undefined) }, '넓게 비교')),
      close);
  }
  function targetNav(item: PlanItem): HTMLElement | null {
    const ids = itemTargets(item), active = activeTarget(item); if (ids.length < 2) return null;
    const tabs = h('div', { class: 'ps-target-tabs', role: 'tablist', 'aria-label': `‘${item.title}’에서 바뀌는 부분` }, ...ids.map(id =>
      h('button', { type: 'button', class: 'ps-target', role: 'tab', 'data-target': id, 'aria-selected': String(id === active), tabindex: id === active ? '0' : '-1',
        title: `${partName(id) ?? '부분'}${visibleRep(id, host.boxes()) !== id ? ' · 안쪽의 실제 부분' : ''}`, onclick: () => chooseTarget(item, id) }, partName(id) ?? '부분')));
    tabs.addEventListener('keydown', e => {
      const at = ids.indexOf(active ?? '');
      const next = e.key === 'ArrowRight' ? (at + 1) % ids.length : e.key === 'ArrowLeft' ? (at + ids.length - 1) % ids.length : e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : -1;
      if (next < 0) return; e.preventDefault(); chooseTarget(item, ids[next]!, true);
    });
    return h('nav', { class: 'ps-targets', 'aria-label': '읽을 변경 대상' }, h('span', { class: 'ps-target-label' }, `바뀌는 부분 ${ids.length}`), tabs);
  }
  /** The change being read: include it in this request (an explicit box), read it wide, open its sources. */
  function focusControls(p: ChangePlan, item: PlanItem) {
    const st = s!, refs = p.evidence.filter(e => item.refs.includes(e.id)).length, box = h('input', { type: 'checkbox', id: `ps-hand-${item.id}` }) as HTMLInputElement;
    box.checked = p.selected.includes(item.id); box.addEventListener('change', () => toggleItem(item.id, box.checked));
    return h('div', { class: 'ps-focus', role: 'group', 'aria-label': `‘${item.title}’` },
      h('label', { class: 'cmp-hand', for: `ps-hand-${item.id}` }, box, h('span', {}, '이번 요청에 포함')),
      h('button', { type: 'button', class: `ps-link ps-wide${st.fromWork ? ' back' : ''}`, onclick: () => openWork(item.id) }, st.fromWork ? '‹ 넓은 비교로' : '넓게 비교'),
      refs ? h('button', { type: 'button', class: 'ps-link', 'aria-pressed': String(st.evidenceFor === item.id), onclick: () => { st.evidenceFor = st.evidenceFor === item.id ? null : item.id; st.evidenceRef = null; render(); } }, `근거 ${refs}`) : null);
  }
  /** Conditions with no part of their own (to keep, to check): read here, never pinned to a part on the map. */
  function conditions(p: ChangePlan) {
    const st = s!, open = st.strip === 'conditions';
    const pop = open ? h('div', { class: 'ps-pop', role: 'dialog', 'aria-label': '대상을 정하지 않은 조건' },
      p.analysis.preserve.length ? h('section', {}, h('h3', {}, '지킬 것'), h('ul', {}, ...p.analysis.preserve.map(x => h('li', {}, x)))) : null,
      p.analysis.unknowns.length ? h('section', {}, h('h3', {}, '확인할 것'), h('p', { class: 'fine' }, UNKNOWNS_NOTE), h('ul', {}, ...p.analysis.unknowns.map(x => h('li', {}, x)))) : null,
      h('p', { class: 'fine' }, '특정 부분에 걸린 조건이 아니라 이 변경안 전체의 조건이에요.')) : null;
    return h('div', { class: 'ps-conds' }, h('button', { type: 'button', class: 'ps-cond-btn', 'aria-expanded': String(open), onclick: () => { st.strip = open ? null : 'conditions'; render(); } },
      `지킬 것 ${p.analysis.preserve.length} · 확인할 것 ${p.analysis.unknowns.length}`), pop);
  }

  /* ---------- the comparison in the reading pane: what a change wants next to what each of its parts is now ----------
     One place for the whole reading: the short pair for the target being read (current → wanted), the long reading on request,
     and the change's sources in its place. The pane stays the same in the current view and the preview; only the map's marks
     change with the mode. The words carry the roles: 지금 (the part's current description and where it comes from), 구상
     (what the change wants; not applied, not a result), 살펴볼 것 (an impact candidate's reason, on the part it names). */
  let lastFocusKey = '', lastShown = '';
  function renderCompare(o: PlanOpened) {
    const st = s!, p = plan();
    // Under the workspace the pane stays exactly as it was (content, scroll, the map beside it): coming back finds it in place.
    if (workOpen()) return;
    if (!p || !st.focus || st.focus.kind === 'impacts' || panelOpen() || st.sheet) { host.surface(null, [], false); lastFocusKey = ''; lastShown = ''; moveTarget = false; frameWhole = false; return; }
    const boxes = host.boxes(), rep = (id: string) => visibleRep(id, boxes), active = st.focus.kind === 'item' ? activeTarget(itemOf(st.focus.id)!) : st.focus.id;
    const key = `${JSON.stringify(st.focus)}|${active ?? ''}`;
    let content: Node[], parts: string[];
    const shown = `${key}|${st.evidenceFor ?? ''}|${st.evidenceRef ?? ''}`;
    if (st.focus.kind === 'item') {
      const item = itemOf(st.focus.id); if (!item) { host.surface(null, [], false); return; }
      content = st.evidenceFor === item.id ? itemEvidence(p, item) : itemBrief(o, p, item); parts = active && rep(active) ? [rep(active)!] : [];
    } else {
      const id = st.focus.id; content = partCompare(o, p, id); parts = [rep(id) ?? id];
    }
    // An explicit new target (opening the plan, another change, another named target) is brought beside the pane by the
    // smallest pan. The long reading, its sources and the way back only change the pane; they keep the person's camera.
    const place = moveTarget || (lastFocusKey && key !== lastFocusKey) ? true : shown !== lastShown ? 'refit' : false;
    const whole = frameWhole && place === true;
    moveTarget = false; frameWhole = false;
    host.surface(content, parts, whole ? 'refit' : place); lastFocusKey = key; lastShown = shown;
    if (whole) host.frame([...new Set([...changedParts(), ...parts])], parts);
  }
  /** The short reading of one change: its targets by name, the pair for the target being read, and what to do with it. */
  function itemBrief(o: PlanOpened, p: ChangePlan, item: PlanItem): Node[] {
    const st = s!, items = p.analysis.items, n = items.indexOf(item), boxes = host.boxes();
    const by = st.bundle.by, basis = by?.kind === 'example' ? '작성된 예제 분석' : by?.kind === 'ai' ? 'AI 분석' : '분석';
    const step = (d: number) => focusItem({ kind: 'item', id: items[(n + d + items.length) % items.length]!.id });
    const tools = [
      items.length > 1 ? h('button', { type: 'button', class: 'cmp-step', 'aria-label': '앞 변경', onclick: () => step(-1) }, '‹') : null,
      items.length > 1 ? h('span', { class: 'cmp-count' }, `${n + 1}/${items.length}`) : null,
      items.length > 1 ? h('button', { type: 'button', class: 'cmp-step', 'aria-label': '다음 변경', onclick: () => step(1) }, '›') : null,
      h('button', { type: 'button', class: 'close', 'aria-label': '이 변경 읽기 닫기', title: '닫기 (Esc)', onclick: () => { st.focus = null; render(); } }, '×')].filter((x): x is HTMLElement => !!x);
    const id = activeTarget(item), at = id ? visibleRep(id, boxes) : null;
    const open = (ref: string) => { st.evidenceFor = item.id; st.evidenceRef = ref; render(); };
    // A change without presentation reads its own description as the wanted result beside '지금'; with one, a short lead above.
    const bare = !item.presentation?.length;
    const note = id ? partReading(o, p, item, id, at ?? id, open, null, bare) : h('p', { class: 'cmp-none' }, '지금 지도에 없는 새 부분을 더하는 변경이에요.');
    return [
      compareHead(`변경 구상 · ${basis}`, item.title, tools),
      h('div', { class: 'lens-body cmp-body' }, bare && id ? null : h('p', { class: 'cmp-desc clamp3', title: item.description }, item.description), targetNav(item), note,
        at && at !== id ? h('p', { class: 'cmp-src' }, `지도에서는 ‘${partName(at)}’ 안에 접혀 있어요.`) : null),
      h('footer', { class: 'lens-foot' }, focusControls(p, item))];
  }
  /** A part's own descriptions as its context (its role in the map, a received summary), each with where it comes from. They
   * are not set against a change as its 'before': that needs presentation data on the same side. */
  function roleBlock(o: PlanOpened, id: string): Node[] {
    const part = o.view.parts.find(x => x.id === id);
    if (!part) return [h('p', { class: 'cmp-none' }, '지금 지도에 없는 부분이에요.')];
    const out: Node[] = [];
    if (part.note) out.push(h('h3', { class: 'cmp-label' }, '이 부분의 역할'), h('p', { class: 'cmp-text cmp-role' }, part.note), h('p', { class: 'cmp-src' }, '지도 설명'));
    if (part.summary) out.push(h('h3', { class: 'cmp-label' }, '받은 정리'), h('p', { class: 'cmp-text cmp-role' }, part.summary), h('p', { class: 'cmp-src' }, part.origin ?? '전달받은 정리'));
    return out;
  }
  const row = (label: string, cls: string, ...children: (Node | null)[]) => h('div', { class: `cmp-row ${cls}` }, h('span', { class: 'cmp-label' }, label), h('div', { class: 'cmp-val' }, ...children.filter((c): c is Node => !!c)));
  function compareHead(kicker: string, title: string, tools: Node[]) {
    return h('header', { class: 'lens-head cmp-head' }, h('div', { class: 'lens-path' }, h('span', {}, kicker)), h('h2', { id: 'lens-title' }, title), h('div', { class: 'head-tools' }, ...tools));
  }
  function impactList(o: PlanOpened, list: { partId: string; reason: string }[], named = true) {
    return list.length ? h('section', { class: 'cmp-impacts' }, h('h3', { class: 'cmp-label' }, '살펴볼 것 ', h('small', {}, '영향 후보 · 분석이 든 이유')),
      h('ul', {}, ...list.map(x => h('li', {}, named ? h('button', { type: 'button', class: 'link-button', onclick: () => locate(x.partId) }, partName(x.partId) ?? '부분') : null, h('span', {}, x.reason))))) : null;
  }
  /** The sources this change cites, read in the comparison's place: each original text with where it comes from. */
  function itemEvidence(p: ChangePlan, item: PlanItem): Node[] {
    const st = s!, by = st.bundle.by, asked = p.evidence.find(e => e.id === st.evidenceRef) ?? null;
    const refs = [...(asked ? [asked] : []), ...p.evidence.filter(e => item.refs.includes(e.id) && e !== asked)];
    const back = () => { st.evidenceFor = null; st.evidenceRef = null; render(); document.querySelector<HTMLElement>('#lens .cmp-hand input, #lens .lens-more, .ps-focus button')?.focus(); };
    return [
      compareHead(`근거 ${refs.length} · ${by?.kind === 'example' ? '예제 원자료' : '이 변경안이 읽은 자료'}`, item.title,
        [h('button', { type: 'button', class: 'close', 'aria-label': '비교로 돌아가기', title: '비교로 (Esc)', onclick: back }, '×')]),
      h('div', { class: 'lens-body cmp-body cmp-evidence' }, sourceList(refs, true)),
      h('footer', { class: 'lens-foot' }, h('button', { type: 'button', id: 'cmp-back', class: 'lens-more', onclick: back }, h('span', { 'aria-hidden': 'true' }, '‹ '), '변경 읽기로 돌아가기'))];
  }
  function partCompare(o: PlanOpened, p: ChangePlan, id: string): Node[] {
    const boxes = host.boxes(), r = visibleRep(id, boxes) ?? id;
    const touching = p.analysis.items.filter(i => i.partIds.some(x => x === id || visibleRep(x, boxes) === r));
    const impacts = p.analysis.impacts.filter(x => x.partId === id);
    return [
      compareHead('변경 구상 · 이 부분', partName(id) ?? '부분', [h('button', { type: 'button', class: 'close', 'aria-label': '선택 해제', title: '닫기 (Esc)', onclick: () => host.selectPart(null) }, '×')]),
      h('div', { class: 'lens-body cmp-body' },
        h('div', { class: 'cmp-main' }, h('div', { class: 'cmp-only' },
          touching.length ? h('h3', { class: 'cmp-label' }, '이 부분에 걸친 변경 ', h('small', {}, '적용 안 됨')) : null,
          ...touching.map(i => h('div', { class: 'cmp-item' },
            h('p', { class: 'cmp-name' }, h('button', { type: 'button', class: 'link-button', onclick: () => focusItem({ kind: 'item', id: i.id }) }, i.title), i.partIds.includes(id) ? null : h('small', {}, '이 부분 안쪽')),
            h('p', { class: 'cmp-text clamp3' }, i.description))),
          ...roleBlock(o, id), touching.length || impacts.length ? null : h('p', { class: 'cmp-none' }, '이 변경안이 바꾸거나 영향 후보로 본 부분은 아니에요.')),
        impactList(o, impacts, false))),
      // Opened from the wide comparison (a part to look at with a change): the way back to that change and its scroll.
      s!.fromWork ? h('footer', { class: 'lens-foot' }, h('button', { type: 'button', class: 'ps-link ps-wide back', onclick: () => openWork(lastWorkItem || undefined) }, '‹ 넓은 비교로')) : null].filter((x): x is HTMLElement => !!x);
  }
  function closePlan() { close(); }
  function renderMode() {
    const box = $('plan-mode'), p = plan();
    box.hidden = !s || !p;
    if (!s || !p) return;
    const b = (mode: 'current' | 'preview', label: string) => h('button', { type: 'button', 'aria-pressed': String(s!.mode === mode), onclick: () => { s!.mode = mode; moveTarget = false; render(); } }, label);
    box.replaceChildren(b('current', '현재'), b('preview', '변경 미리보기'));
  }

  /** The slim panel, before there is a plan: the sentence to try, what it would read, and the ask. */
  function renderPanel(o: PlanOpened) {
    const panel = $('plan-panel'), prev = panel.classList.contains('work') ? null : panel.querySelector('.pp-body'), keep = prev?.scrollTop ?? 0, st = s!;
    panel.hidden = false; panel.classList.remove('work');
    const head = h('header', { class: 'panel-head pp-head' },
      h('div', { class: 'panel-path' }, h('span', {}, '변경 구상'), st.example ? h('span', { class: 'tag' }, '예제') : null),
      h('h2', { id: 'plan-title', tabindex: '-1' }, '새 변경안'),
      h('p', { class: 'pp-basis' }, '적은 문장으로 같은 지도에서 달라질 곳을 살펴봐요.'),
      h('div', { class: 'head-tools' }, h('button', { type: 'button', class: 'close', 'aria-label': '변경 구상 닫고 현재 지도로', title: '닫기 (Esc) · 초안은 남아요', onclick: () => close() }, '×')));
    const body = h('div', { class: 'pp-body panel-body' });
    put(body, intentSection(o), st.bundle.snapshots.length ? resultSection() : null);
    panel.replaceChildren(head, body, footer(o));
    body.scrollTop = keep;
  }

  /* ---------- the wide workspace: the whole plan read and edited over the map ----------
     Entered from the change map ('넓게 비교', '문장 고치기', a change's '넓게 비교' in the pane). It covers the map without
     moving it: the camera, the preview, folds and the pane under it stay as they were, so '지도로 돌아가기' finds them again.
     Reading order: what is being tried → what the analysis found → the changes (one read at a time; each with its own
     '이번 요청에 포함' box) → for the one read: what differs, then each part it changes (now, wanted there, why it is read) and
     the parts to look at with it, each with '지도에서 보기'. The right column holds what this step needs: what the request
     takes and the way to make it. A source, the returned results or every source open there in its place. */
  let lastWorkItem = '';
  /** The person's whole sentence opened under the short heading (kept while the plan is open). */
  let sentenceOpen = false;
  function renderWork(o: PlanOpened) {
    const panel = $('plan-panel'), p = plan()!, st = s!, was = panel.classList.contains('work') && !panel.hidden;
    const back = st.workAt, prevDetail = was ? panel.querySelector('.pw-detail')?.scrollTop ?? 0 : 0, prevList = was ? panel.querySelector('.pw-list')?.scrollTop ?? 0 : 0;
    const prevRail = was ? panel.querySelector('.pw-rail-body')?.scrollTop ?? 0 : 0, prevView = panel.dataset.rail ?? '';
    st.workAt = null;
    if (st.focus?.kind !== 'item' || !itemOf(st.focus.id)) st.focus = firstFocus(p);
    // No proposed change: there is no change to read, so no focus (null) and its own body below.
    const item = st.focus?.kind === 'item' ? itemOf(st.focus.id) : null;
    panel.hidden = false; panel.classList.add('work'); panel.dataset.rail = st.rail;
    const by = st.bundle.by, origin = by?.kind === 'example' ? '작성된 예제 분석' : by?.kind === 'ai' ? `AI 분석 · ${by.model} · ${ago(by.at)}` : '분석';
    const writing = st.editing || stale() || !!st.pending;
    // A short heading: authored for the example's own sentence, otherwise what the plan holds (no invented summary).
    const heading = !item ? '제안된 변경 없음' : by?.kind === 'example' && st.key === CONVERTER_KEY && p.intent === CONVERTER_INTENT ? CONVERTER_HEADING : `변경안 · ${p.analysis.items.length}가지 변화`;
    const lead = firstSentence(p.analysis.summary), more = p.analysis.summary.trim().slice(lead.length).trim();
    const head = h('header', { class: 'pw-head' },
      h('p', { class: 'pw-kick' }, h('span', {}, '변경 구상'), st.example ? h('span', { class: 'tag' }, '예제') : null, h('span', { class: 'pw-origin', title: by?.kind === 'ai' ? `${fullTime(by.at)} · ${p.basis}` : p.basis }, origin)),
      h('div', { class: 'pw-title-row' }, h('h2', { id: 'plan-title', class: 'pw-title', tabindex: '-1' }, heading),
        writing ? null : h('button', { type: 'button', class: 'link-button quiet pw-said-btn', 'aria-expanded': String(sentenceOpen), 'aria-controls': 'pw-said', onclick: () => { sentenceOpen = !sentenceOpen; render(); } }, sentenceOpen ? '적은 문장 접기' : '적은 문장 펼쳐 읽기')),
      // The person's whole sentence, on request (it is also what the editor holds).
      !writing && sentenceOpen ? h('p', { id: 'pw-said', class: 'pw-said' }, p.intent) : null,
      newerNote(o, p),
      h('div', { class: 'pw-head-tools' },
        writing ? null : h('button', { type: 'button', class: 'secondary small', onclick: () => edit() }, '문장 고치기'),
        backButton(h('button', { type: 'button', id: 'pw-back', class: 'secondary small pw-back', onclick: () => (canLeave() ? leaveWork() : close()) }) as HTMLButtonElement)));
    // The analysis's first finding leads; the rest of its summary and what it is (not a run) open quietly.
    const found = h('section', { class: 'pw-found', 'aria-label': '분석이 찾은 것' }, h('p', { class: 'pw-lead' }, h('span', { class: 'pw-found-k' }, '분석이 찾은 것'), lead),
      h('details', { class: 'pw-found-more' }, h('summary', {}, more ? '분석 전체' : '이 정리는'), more ? h('p', {}, more) : null, h('p', { class: 'pw-note' }, '변경안을 읽은 정리예요. 실행해서 확인한 결과는 아니에요.')));
    const open = (ref: string) => { leaveList(`ref:${ref}`); st.rail = 'source'; st.railSource = ref; render(); document.getElementById('pw-rail-back')?.focus(); };
    const pick = (id: string) => { st.focus = { kind: 'item', id }; st.evidenceFor = null; render(); document.querySelector<HTMLElement>('.pw-pick[aria-current="true"]')?.focus(); };
    if (!item) {
      const main = h('div', { class: 'pw-main' }, head, writing ? intentSection(o) : null, h('div', { class: 'pw-body none' }, noChangeBody(p)));
      finishWork(panel, main, h('aside', { class: 'pw-rail', 'aria-label': '이번 분석에 넣은 자료' }, h('div', { class: 'pw-rail-body' }, ...railView(o, p, writing, open).filter((x): x is Node => !!x)), footer(o)),
        was, back, prevList, prevDetail, prevRail, prevView, '');
      return;
    }
    const list = h('nav', { class: 'pw-list', 'aria-label': '바뀌는 것' },
      h('div', { class: 'pw-list-head' }, h('span', {}, `바뀌는 것 ${p.analysis.items.length}`), h('span', { 'aria-hidden': 'true' }, '이번 요청에 포함')),
      h('ul', {}, ...p.analysis.items.map(i => {
        const on = i.id === item.id, box = h('input', { type: 'checkbox', id: `pw-inc-${i.id}`, 'aria-label': `‘${i.title}’ 이번 요청에 포함` }) as HTMLInputElement;
        box.checked = p.selected.includes(i.id); box.addEventListener('change', () => toggleItem(i.id, box.checked));
        const names = itemTargets(i).map(partName).filter(Boolean).join(' · ');
        return h('li', { class: `pw-item${on ? ' on' : ''}` },
          h('button', { type: 'button', class: 'pw-pick', 'aria-current': on ? 'true' : 'false', onclick: () => pick(i.id) },
            h('span', { class: 'pw-pick-title' }, i.title), h('span', { class: 'pw-pick-parts' }, names || '지금 지도에 없는 새 부분')), box);
      })),
      planConditions(p));
    const boxes = host.boxes(), targets = itemTargets(item), near = nearImpacts(item).filter(x => !targets.includes(x.partId));
    const bareOne = !item.presentation?.length && targets.length === 1;
    const path = (id: string) => { const names: string[] = []; for (let q = o.view.parts.find(x => x.id === id)?.parentId, g = 0; q && g < 64; q = o.view.parts.find(x => x.id === q)?.parentId, g++) names.unshift(partName(q) ?? ''); return names.join(' › '); };
    const toMap = (id: string, impact = false) => mapButton(h('button', { type: 'button', class: 'link-button pw-map', onclick: () => showOnMap(item, id, impact) }, '지도에서 보기') as HTMLButtonElement);
    const detail = h('article', { class: `pw-detail${stale() ? ' is-stale' : ''}`, 'aria-labelledby': 'pw-item-title' },
      h('p', { class: 'pw-stale', hidden: !stale() }, '아래는 앞 문장·자료·작성 맥락으로 만든 변경안이에요. 바뀐 내용은 아직 살펴보지 않았어요.'),
      h('h3', { id: 'pw-item-title', class: 'pw-item-title' }, item.title),
      // The change's description once: beside '지금' as the wanted result when the change has no pair of its own and one
      // target; otherwise a lead above the parts.
      bareOne ? null : h('section', { class: 'pw-what' }, h('p', {}, item.description), refLine(p, item.refs, open)),
      item.dependsOn.length && by?.kind === 'example' ? h('p', { class: 'pw-dep' }, h('span', {}, '전제'), item.dependsOn.map(d => itemOf(d)?.title ?? d).join(', ')) : null,
      targets.length ? h('section', { class: 'pw-parts' }, targets.length > 1 ? h('h4', {}, `바뀌는 부분 ${targets.length}`) : null, ...targets.map(id => {
        const where = path(id);
        return h('div', { class: 'pw-part' }, partReading(o, p, item, id, visibleRep(id, boxes) ?? id, open, h('span', { class: 'pw-part-tools' }, where ? h('span', { class: 'pw-path' }, `${where} 안`) : null, toMap(id)), bareOne));
      })) : h('p', { class: 'pw-none' }, '지금 지도에 없는 새 부분을 더하는 변경이에요. 바뀔 자리는 정해지지 않았어요.'),
      near.length ? h('section', { class: 'pw-near' }, h('h4', {}, '함께 볼 부분 ', h('small', {}, '영향 후보 · 분석이 든 이유')),
        h('ul', {}, ...near.map(x => h('li', {}, h('p', { class: 'pw-near-name' }, h('strong', {}, partName(x.partId) ?? '지금 지도에 없는 부분'), toMap(x.partId, true)), h('p', {}, x.reason), refLine(p, x.refs, open))))) : null);
    const main = h('div', { class: 'pw-main' }, head, writing ? intentSection(o) : null, found, h('div', { class: 'pw-body' }, list, detail));
    const rail = h('aside', { class: 'pw-rail', 'aria-label': '이번 요청' }, h('div', { class: 'pw-rail-body' }, ...railView(o, p, writing, open).filter((x): x is Node => !!x)), footer(o));
    finishWork(panel, main, rail, was, back, prevList, prevDetail, prevRail, prevView, item.id);
  }
  function finishWork(panel: HTMLElement, main: HTMLElement, rail: HTMLElement, was: boolean, back: Session['workAt'], prevList: number, prevDetail: number, prevRail: number, prevView: string, itemKey: string) {
    const typed = panel.querySelector<HTMLTextAreaElement>('#plan-intent'), caret = typed && was ? [typed.selectionStart, typed.selectionEnd, document.activeElement === typed, typed.selectionDirection, typed.value, typed.scrollTop] as const : null;
    panel.replaceChildren(main, rail);
    const area = panel.querySelector<HTMLTextAreaElement>('#plan-intent');
    if (area && caret) {
      area.setSelectionRange(caret[0], caret[1], caret[3]); if (caret[2]) area.focus({ preventScroll: true });
      // Where a long draft was being read, only for the very same text.
      if (area.value === caret[4]) area.scrollTop = caret[5];
    }
    // The same change keeps where the person was in it; another change starts at its top; back from the map: as left.
    const list = panel.querySelector('.pw-list'), detail = panel.querySelector('.pw-detail');
    if (list) list.scrollTop = back?.list ?? prevList;
    if (detail) detail.scrollTop = back ? back.detail : itemKey === lastWorkItem ? prevDetail : 0;
    const railBody = panel.querySelector('.pw-rail-body')!, st = s!;
    // Back from a source to the no-change material list: the list as it was left (the source's own scroll never replaces it).
    if (st.rail === 'request' && st.railAt !== null && noChange()) { railBody.scrollTop = st.railAt; st.railAt = null; }
    else if (prevView === st.rail) railBody.scrollTop = prevRail;
    lastWorkItem = itemKey;
  }
  /** An analysis that proposed no change, read whole: what it read (summary), what to keep, what is not known yet; the material
   * this analysis was given in the right column (analysisSources). It says nothing more than the analysis: not that no change is
   * needed, not that the goal is met. */
  function noChangeBody(p: ChangePlan): HTMLElement {
    const lines = (list: string[], none: string) => list.length ? h('ul', {}, ...list.map(x => h('li', {}, x))) : h('p', { class: 'pw-muted' }, none);
    return h('article', { class: `pw-detail pw-nochange${stale() ? ' is-stale' : ''}`, 'aria-labelledby': 'pw-nochange-h' },
      h('p', { class: 'pw-stale', hidden: !stale() }, '아래는 앞 문장·자료·작성 맥락으로 살펴본 분석이에요. 바뀐 내용은 아직 살펴보지 않았어요.'),
      h('h3', { id: 'pw-nochange-h', class: 'pw-item-title' }, '이번 분석에서 제안된 변경이 없어요'),
      h('p', { class: 'pw-nochange-note' }, '변경이 필요 없다고 확인했거나 바라는 결과가 이미 이루어졌다는 뜻은 아니에요. 요청에 넣을 변경이 없어 요청문은 만들지 않아요.'),
      h('section', { class: 'pw-what' }, h('h4', {}, '분석이 읽은 것'), h('p', {}, p.analysis.summary)),
      h('section', { class: 'pw-nochange-list' }, h('h4', {}, `지킬 것 ${p.analysis.preserve.length}`), lines(p.analysis.preserve, '제시된 유지 조건 없음')),
      h('section', { class: 'pw-nochange-list' }, h('h4', {}, `확인할 것 ${p.analysis.unknowns.length}`), p.analysis.unknowns.length ? h('p', { class: 'fine' }, UNKNOWNS_NOTE) : null, lines(p.analysis.unknowns, '제시된 확인할 것 없음')));
  }
  /** The no-change right column's own work: the material this analysis was given, as frozen with the plan (its ids, kinds, titles and
   * order), each opening its text in this column. Never what the next analysis would send (a draft or material edited since). */
  function analysisSources(p: ChangePlan, open: (ref: string) => void): HTMLElement {
    return h('section', { class: 'pw-srcs', 'aria-labelledby': 'pw-srcs-h' }, h('h3', { id: 'pw-srcs-h' }, `이번 분석에 넣은 자료 ${p.evidence.length}`),
      h('ol', {}, ...p.evidence.map(e => h('li', {}, h('button', { type: 'button', class: 'pw-src', 'data-ref': e.id, title: e.basis, onclick: () => open(e.id) },
        h('span', { class: 'pw-src-k' }, h('span', { class: `pp-kind k-${e.kind}` }, EVIDENCE_LABEL[e.kind]), h('span', { class: 'pw-src-id' }, e.id)),
        h('span', { class: 'pw-src-title' }, e.title))))),
      h('p', { class: 'fine' }, '이 분석에 보낸 자료예요. 문장마다 근거를 확인한 표시는 아니에요. 고친 문장이나 붙인 자료는 다시 살펴볼 때 들어가요.'));
  }
  /** Conditions of the whole plan (to keep, to check): once, under the list, folded; never pinned to a change. */
  function planConditions(p: ChangePlan): HTMLElement | null {
    const a = p.analysis.preserve.length, b = p.analysis.unknowns.length; if (!a && !b) return null;
    return h('details', { class: 'pw-conds' }, h('summary', {}, `지킬 것 ${a} · 확인할 것 ${b}`),
      a ? h('section', {}, h('h4', {}, '지킬 것'), h('ul', {}, ...p.analysis.preserve.map(x => h('li', {}, x)))) : null,
      b ? h('section', {}, h('h4', {}, '확인할 것'), h('p', { class: 'fine' }, UNKNOWNS_NOTE), h('ul', {}, ...p.analysis.unknowns.map(x => h('li', {}, x)))) : null,
      h('p', { class: 'fine' }, '특정 변경에 걸린 조건이 아니라 이 변경안 전체의 조건이에요.'));
  }
  /** The right column: by default what this request takes and the way to make it; a source, results or every source in its place. */
  function railView(o: PlanOpened, p: ChangePlan, writing: boolean, open: (ref: string) => void): (Node | null)[] {
    const st = s!, none = noChange();
    const top = (title: string) => h('header', { class: 'pw-rail-head' }, h('button', { type: 'button', class: 'link-button', id: 'pw-rail-back', onclick: railBack }, none ? '‹ 자료 목록으로' : '‹ 이번 요청으로'), h('h3', {}, title));
    if (st.rail === 'source') {
      const e = p.evidence.find(x => x.id === st.railSource);
      // No change proposed: it is a piece of the material the analysis was given, not the grounds of a change.
      if (e) return [top(`${none ? '자료' : '근거'} ${e.id}`), sourceList([e], true), h('p', { class: 'fine' }, '자료 원문이에요. 지시나 실행 결과로 읽지 않아요.')];
    }
    if (st.rail === 'results' && st.bundle.snapshots.length) return [top('돌아온 기록'), resultSection()];
    if (st.rail === 'sources') {
      const ev = (writing ? input()?.evidence : null) ?? p.evidence;
      return [top(`${st.example && st.key === CONVERTER_KEY ? '예제 원자료' : '읽는 자료'} ${ev.length}`), sourceList(ev.filter(e => o.kind !== 'saved' || !st.bundle.extra.some(x => x.id === e.id))), addSource(o)];
    }
    return none ? noChangeRail(o, p, writing, open) : requestRail(o, p, writing);
  }
  /** The no-change list gives its place to another view: keep where the list was and which control left it (only from the list). */
  function leaveList(entry: string) {
    const st = s; if (!st || !noChange() || st.rail !== 'request') return;
    st.railAt = document.querySelector('#plan-panel .pw-rail-body')?.scrollTop ?? 0; st.railEntry = entry;
  }
  /** The control that left the no-change list: a material's button, the returned results, or the editor's material count. */
  const entryOf = (entry: string | null): HTMLElement | null => !entry ? null
    : entry.startsWith('ref:') ? document.querySelector<HTMLElement>(`.pw-srcs [data-ref="${CSS.escape(entry.slice(4))}"]`)
    : entry === 'results' ? document.querySelector<HTMLElement>('.pw-earlier [data-entry="results"]')
    : entry === 'sources' ? document.querySelector<HTMLElement>('#plan-panel .pp-intent .pp-sources-count') : null;
  /** Back from a source (or another view) to the right column's default: the no-change list at the same place and control. */
  function railBack() {
    const st = s; if (!st) return;
    const entry = st.railEntry; st.railEntry = null;
    st.rail = 'request'; st.railSource = null; render();
    (noChange() ? entryOf(entry) : document.getElementById('plan-make'))?.focus({ preventScroll: true });
  }
  /** No change proposed: the material list is the column's work. Earlier requests, their returns and the return reading stay
   * reachable (quietly, after the list); no request can be made from this analysis, so there is no request button here. */
  function noChangeRail(o: PlanOpened, p: ChangePlan, writing: boolean, open: (ref: string) => void): (Node | null)[] {
    const st = s!, last = latestSnapshot(), n = st.bundle.snapshots.length;
    const earlier = last ? h('section', { class: 'pw-req pw-earlier', 'aria-labelledby': 'pw-earlier-h' }, h('h3', { id: 'pw-earlier-h' }, '이전 요청'),
      h('div', { class: 'pw-tools' },
        h('button', { type: 'button', class: 'link-button', 'data-sheet-entry': 'last', onclick: () => openSheet(last.id) }, `마지막 요청문 · ${ago(last.createdAt)}`),
        h('button', { type: 'button', class: 'link-button quiet', 'data-entry': 'results', onclick: () => { leaveList('results'); st.rail = 'results'; render(); } }, `돌아온 기록 · 요청문 ${n}개`),
        h('button', { type: 'button', class: 'link-button quiet', title: '돌아온 기록과 프로젝트 기록을 함께 읽어요. 변경 구상은 닫혀도 초안은 남아요.', onclick: () => host.readReturn() }, '돌아와 읽기')),
      h('p', { class: 'fine' }, '마지막 요청문 뒤로 다시 살펴봤어요. 이전 요청문과 돌아온 기록은 만든 때 그대로예요.')) : null;
    return [analysisSources(p, open), earlier, needsCode() ? accessField() : null, writing ? null : conditionSwitch(o)];
  }
  function requestRail(o: PlanOpened, p: ChangePlan, writing: boolean): (Node | null)[] {
    const st = s!, last = latestSnapshot(), chosen = p.analysis.items.filter(i => p.selected.includes(i.id)), why = staleness();
    const changed = last && (last.planId !== p.id || last.planRevision !== p.revision), authored = st.bundle.by?.kind === 'example';
    const warns = authored ? chosen.map(i => ({ i, missing: missingDeps(i) })).filter(x => x.missing.length).map(({ i, missing }) =>
      h('p', { class: 'pp-warn' }, `‘${missing.map(d => itemOf(d)?.title ?? d).join('’, ‘')}’이 ‘${i.title}’의 전제예요. `,
        h('button', { type: 'button', class: 'link-button', onclick: () => { s!.bundle = { ...s!.bundle, plan: selectItems(plan()!, [...plan()!.selected, ...missing]) }; persist(); render(); } }, '함께 포함'),
        h('span', {}, ' · 빼 두면 요청문에 포함하지 않은 전제로 적혀요.'))) : [];
    const tools = h('div', { class: 'pw-tools' },
      writing ? null : sourcesToggle(o),
      st.bundle.snapshots.length ? h('button', { type: 'button', class: 'link-button quiet', onclick: () => { st.rail = 'results'; render(); } }, `돌아온 기록 · 요청문 ${st.bundle.snapshots.length}개`) : null,
      st.bundle.snapshots.length ? h('button', { type: 'button', class: 'link-button quiet', title: '돌아온 기록과 프로젝트 기록을 함께 읽어요. 변경 구상은 닫혀도 초안은 남아요.', onclick: () => host.readReturn() }, '돌아와 읽기') : null);
    return [
      h('section', { class: 'pw-req', 'aria-labelledby': 'pw-req-h' },
        h('h3', { id: 'pw-req-h' }, '이번 요청', noChange() ? null : h('span', { class: 'pw-count' }, `${chosen.length}/${p.analysis.items.length} 포함`)),
        chosen.length ? h('ul', { class: 'pw-req-list' }, ...chosen.map(i => h('li', {}, i.title)))
          : h('p', { class: 'pw-muted' }, noChange() ? '이 분석에는 요청에 넣을 변경이 없어요. 요청문은 만들지 않아요.' : '포함한 변경이 없어요. 왼쪽 목록에서 ‘이번 요청에 포함’을 고르세요.'),
        ...warns,
        st.scoping
          ? h('div', { class: 'pending', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, `고른 변경 ${st.scoping.count}개의 전제를 살펴보는 중…`),
              h('button', { type: 'button', class: 'link-button', onclick: () => st.scoping?.controller.abort() }, '취소'))
          : h('div', { class: 'pp-row' }, h('button', { type: 'button', id: 'plan-make', class: 'primary small', disabled: !canRequest(), onclick: makeRequest, title: requestTitle() }, '요청문 만들기'),
              last ? h('button', { type: 'button', class: 'link-button', 'data-sheet-entry': 'last', onclick: () => openSheet(last.id) }, `마지막 요청문 · ${ago(last.createdAt)}`) : null),
        // Why the button is off while the sentence or material is ahead of the plan (kept in step as the person types).
        h('p', { class: 'fine pp-make-note', id: 'plan-make-note', role: 'status', hidden: !why }, why ? requestTitle() : ''),
        st.scopeError ? h('p', { class: 'pp-error', role: 'alert' }, st.scopeError) : null,
        !st.scoping && !st.scopeError && !why && !noChange() ? h('p', { class: 'fine' }, authored ? '만들고 복사해도 보내거나 실행하지 않아요.' : '만들 때 고른 변경의 전제를 AI가 한 번 살펴봐요. 보내거나 실행하지 않아요.') : null,
        changed && !st.scoping ? h('p', { class: 'fine' }, noChange() ? '마지막 요청문 뒤로 다시 살펴봤어요. 이전 요청문과 돌아온 기록은 만든 때 그대로예요.' : '마지막 요청문 뒤로 변경안이 바뀌었어요. 새로 만들어도 이전 것은 남아요.') : null),
      !authored && needsCode() ? accessField() : null,
      tools, writing ? null : conditionSwitch(o)];
  }
  function accessField(): HTMLElement {
    const code = h('input', { id: 'plan-access', type: 'password', placeholder: '접속 코드', autocomplete: 'off', value: host.accessCode() }) as HTMLInputElement;
    const keep = () => host.keepAccessCode(code.value);
    code.addEventListener('input', keep); code.addEventListener('change', keep);
    return h('div', { class: 'access' }, h('label', { for: 'plan-access' }, '접속 코드'), code);
  }
  function edit() {
    if (!s) return;
    s.editing = true; s.rail = 'request'; render();
    document.getElementById('plan-intent')?.focus();
  }
  function openWork(itemId?: string) {
    if (!s || !plan()) return;
    if (itemId && itemOf(itemId)) s.focus = { kind: 'item', id: itemId };
    s.detail = true; s.fromWork = false; s.evidenceFor = null; s.strip = null; render();
    document.querySelector<HTMLElement>('.pw-pick[aria-current="true"]')?.focus({ preventScroll: true });
  }
  /** The change map can be read again only when the plan answers what is written and nothing is in flight. */
  const canLeave = () => !!s && !stale() && !s.pending && !s.scoping;
  /** The header's way out: back to the change map as it was; while the sentence or material is ahead of the plan (or work is
   * in flight) the change map would show an earlier plan, so it closes the plan to the current map instead, the draft kept. */
  function backButton(b: HTMLButtonElement): HTMLButtonElement {
    const ok = canLeave();
    b.textContent = ok ? '지도로 돌아가기' : '현재 지도로 (초안 유지)';
    b.title = ok && noChange() ? '변경 구상을 닫고 지도로 가요. 초안과 이 분석은 그대로 남아요. (Esc)'
      : ok ? '지도로 (Esc) · 카메라와 읽던 변경은 그대로예요' : '변경 구상을 닫고 현재 지도로 가요. 고친 문장과 이전 변경안·요청문은 그대로 남아요. (Esc)';
    return b;
  }
  /** A part on the map reads this plan there: off while the plan is behind what is written (the stale notice says why). */
  function mapButton(b: HTMLButtonElement): HTMLButtonElement {
    const ok = canLeave(); b.disabled = !ok;
    b.title = ok ? '지도에서 이 부분과 이유를 읽어요' : '고친 문장이나 자료를 먼저 살펴본 뒤 지도에서 볼 수 있어요';
    return b;
  }
  /** Back to the change map as it was left: same camera, mode, folds and pane; nothing is re-framed. */
  function leaveWork() {
    if (!s || stale() || s.pending || s.scoping) return;
    // With no proposed change the change map has nothing of its own to read: the way back is the current map (draft and plan kept).
    if (noChange()) { close(); return; }
    s.detail = false; s.editing = false; s.rail = 'request'; s.railSource = null; s.fromWork = false;
    render();
    document.querySelector<HTMLElement>('#lens .ps-wide, #plan-strip .ps-more')?.focus();
  }
  /** From the wide comparison to one part on the map: the part brought beside the pane, the pane reading this change there
   * (or, for a part to look at with it, that part's reasons), and the way back to the same row and scroll. */
  function showOnMap(item: PlanItem, id: string, impact: boolean) {
    if (!s || !canLeave()) { syncStale(); return; }
    const panel = $('plan-panel');
    s.workAt = { list: panel.querySelector('.pw-list')?.scrollTop ?? 0, detail: panel.querySelector('.pw-detail')?.scrollTop ?? 0 };
    s.detail = false; s.editing = false; s.rail = 'request'; s.railSource = null; s.fromWork = true;
    if (impact) { s.focus = { kind: 'item', id: item.id }; render(); locate(id); }
    else chooseTarget(item, id);
    document.querySelector<HTMLElement>('#lens .ps-wide')?.focus({ preventScroll: true });
  }
  /** The plan's basis is fixed; newer records are announced, never merged into it. */
  function newerNote(o: PlanOpened, p: ChangePlan | null) {
    if (!p || o.kind !== 'saved') return null;
    const newer = o.view.records.filter(r => r.at > p.createdAt).length + o.project.pasted.filter(r => r.at > p.createdAt).length;
    return newer ? h('p', { class: 'pp-newer' }, `만든 뒤 새 기록 ${newer}개 · 이 안의 기준은 그대로예요`) : null;
  }
  function intentSection(o: PlanOpened) {
    const st = s!, p = plan(), sec = h('section', { class: 'pp-sec pp-intent' });
    const status = host.status(), canAsk = status.ai === 'deepseek';
    put(sec, proposalCard());
    if (p) sec.classList.add('pw-edit');
    const area = h('textarea', { id: 'plan-intent', rows: '3', maxlength: '6000', placeholder: '어떻게 바뀌면 좋을지 두세 줄로 적어 주세요. 예: 폴더째 변환하고, 실패한 파일은 모아서 보고 싶어.', 'aria-label': '바꾸고 싶은 모습', disabled: !!st.pending }) as HTMLTextAreaElement;
    area.value = st.bundle.draft;
    const staleLine = h('p', { class: 'pp-stale', id: 'plan-stale', role: 'status' });
    const why = staleness(); staleLine.textContent = why ? STALE_LINE[why] : ''; staleLine.hidden = !why;
    // Typing changes the draft in place (no re-render, the caret stays): everything that depends on it follows at once.
    area.addEventListener('input', () => { const was = st.bundle.authoring; st.bundle = withDraft(st.bundle, area.value); persist(); if (st.bundle.authoring !== was) syncContext(); syncStale(); });
    area.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); area.blur(); } if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void analyze(); } });
    sec.append(h('label', { for: 'plan-intent', class: 'pp-label' }, '바꾸고 싶은 모습'), area, ...contextLine(), staleLine,
      h('div', { class: 'pp-row' }, sourcesToggle(o), p && !stale() && !st.pending ? h('button', { type: 'button', class: 'link-button', onclick: () => { st.editing = false; render(); } }, '접기') : null));
    put(sec, conditionSwitch(o));
    // Added material is listed apart (with a way to remove it) only in a saved project; an example lists it with its sources.
    // In the workspace the list opens in the right column instead.
    if (st.sources && !p) put(sec, sourceList((input() ?? { evidence: [] }).evidence.filter(e => o.kind !== 'saved' || !st.bundle.extra.some(x => x.id === e.id))), addSource(o));
    put(sec, ...askLine(canAsk, p));
    return sec;
  }
  /* ---------- authoring context: one line under the draft ----------
     A new draft's first edit keeps the screen it was written on (the selected part and the scope being looked at); before that the
     line shows what would be kept. Opening, moving around, closing or reading sources never changes a kept context; only the
     person replaces it with the screen they are on or removes it. An older draft stays unrecorded until they choose. */
  const screenNow = (o: PlanOpened) => { const c = host.capture(); return screenContext(o.project.id, o.view.parts, { selected: c.selected, scope: c.scope }, 'explicit'); };
  /** The draft text changed: a new draft's first edit takes the screen's context, any other keeps the one it has. */
  function withDraft(b: PlanBundle, draft: string): PlanBundle {
    const r = authoringOf(b), o = host.current(), next = o ? pinOnEdit(r.draft, draft, () => ({ ...screenNow(o), how: 'first-edit' })) : r.draft;
    return next === r.draft ? { ...b, draft } : { ...b, draft, authoring: { ...r, draft: next } };
  }
  function setAuthoring(a: Authoring) {
    if (!s) return;
    // The draft is not touched: its caret, selection direction and scroll come back on the re-rendered field, and focus goes to a
    // control of the new line that can act (the same-screen replace is off), else to the draft.
    const was = document.getElementById('plan-intent') as HTMLTextAreaElement | null;
    const caret = was ? { start: was.selectionStart, end: was.selectionEnd, dir: was.selectionDirection, top: was.scrollTop } : null;
    // The editor the person was writing in stays open, also when this change makes the plan current again (it was open because
    // the plan was behind the draft): the plan is current, the draft is still being written.
    if (was && plan()) s.editing = true;
    s.bundle = { ...s.bundle, authoring: { ...authoringOf(s.bundle), draft: a } }; persist(); render();
    const area = document.getElementById('plan-intent') as HTMLTextAreaElement | null;
    if (area && caret) { area.setSelectionRange(caret.start, caret.end, caret.dir); area.scrollTop = caret.top; }
    (document.querySelector<HTMLElement>('#plan-ctx button:not(:disabled)') ?? area)?.focus({ preventScroll: true });
  }
  /** A part as kept: its name then, and what it is called now or that it is not in this project now (never another part by name). */
  function refText(o: PlanOpened, ref: ContextRef | null, ctxProject: string, none: string): (Node | string)[] {
    const r = resolveRef(ref, o.project.id, ctxProject, o.view.parts);
    if (!r) return [none];
    const note = r.status === 'renamed' ? h('span', { class: 'pc-note' }, ` → 지금 ‘${r.now}’`) : r.status === 'unresolved' ? h('span', { class: 'pc-note pc-missing' }, ' · 지금 지도에 없음') : null;
    return note ? [h('b', {}, r.ref.name), note] : [h('b', {}, r.ref.name)];
  }
  const CONTEXT_HINT = '‘이 부분’·‘여기’ 같은 말을 읽는 참고예요. 바꿀 범위가 아니며, 문장에 다른 부분이나 전체를 적으면 문장이 우선해요.';
  function contextBody(o: PlanOpened): (Node | string)[] {
    const st = s!, a = authoringOf(st.bundle).draft, now = screenNow(o);
    const btn = (label: string, run: () => void, extra: Record<string, string | boolean> = {}) => h('button', { type: 'button', class: 'link-button', onclick: run, ...extra }, label);
    const pair = (sel: (Node | string)[], scope: (Node | string)[]) => h('span', { class: 'pc-what' }, '선택 ', ...sel, ' · 보던 범위 ', ...scope);
    const nowRefs = () => pair(refText(o, now.selection, now.projectId, '없음'), refText(o, now.scope, now.projectId, '프로젝트 전체'));
    const sameAsNow = a.state === 'set' && a.context.projectId === o.project.id && a.context.selection?.id === now.selection?.id && a.context.scope?.id === now.scope?.id;
    const nowTitle = `지금 화면: 선택 ${now.selection?.name ?? '없음'} · 보던 범위 ${now.scope?.name ?? '프로젝트 전체'}`;
    const take = () => setAuthoring({ state: 'set', context: screenNow(o) });
    const remove = () => setAuthoring({ state: 'removed', at: new Date().toISOString() });
    if (a.state === 'open') return [h('span', { class: 'pc-k' }, '작성 맥락'), h('span', { class: 'pc-state' }, '쓰기 시작하면 고정'), nowRefs(), btn('없이 쓰기', remove)];
    if (a.state === 'set') return [h('span', { class: 'pc-k' }, '작성 맥락'),
      pair(refText(o, a.context.selection, a.context.projectId, '없음'), refText(o, a.context.scope, a.context.projectId, '프로젝트 전체')),
      btn('현재 화면으로 바꾸기', take, { disabled: sameAsNow, title: sameAsNow ? '지금 화면과 같아요' : nowTitle }), btn('없애기', remove)];
    const what = a.state === 'removed' ? '없음 · 없앤 뒤로 다시 잡지 않아요' : st.example && st.key === CONVERTER_KEY ? '없음 · 예제 문장' : '기록되지 않음 · 이전에 쓴 초안';
    return [h('span', { class: 'pc-k' }, '작성 맥락'), h('span', { class: 'pc-state' }, what), btn('현재 화면 맥락으로 지정', take, { title: nowTitle })];
  }
  /** The boundary in words, under a context that is or will be kept (the full hint stays in the line's tooltip). */
  const CONTEXT_NOTE = '변경할 범위는 쓴 문장을 따라요.';
  const noteHidden = () => !['open', 'set'].includes(authoringOf(s!.bundle).draft.state);
  function contextLine(): HTMLElement[] {
    const o = host.current()!;
    return [h('p', { class: 'pp-ctx', id: 'plan-ctx', title: CONTEXT_HINT }, ...contextBody(o)),
      h('p', { class: 'pp-ctx-note', id: 'plan-ctx-note', hidden: noteHidden() }, CONTEXT_NOTE)];
  }
  /** The first edit kept the context: the line follows in place (no re-render, the caret stays). */
  function syncContext() {
    const line = document.getElementById('plan-ctx'), note = document.getElementById('plan-ctx-note'), o = host.current();
    if (line && o && s) line.replaceChildren(...contextBody(o));
    if (note && s) note.hidden = noteHidden();
  }
  function proposalCard(): Node | null {
    const st = s!, pr = PROPOSALS.get(st.key); if (!pr) return null;
    const empty = !st.bundle.draft.trim(), fresh = pr.sources.filter(e => !st.bundle.extra.some(x => x.title === e.title && x.basis === e.basis));
    const adding = Math.min(20 - st.bundle.extra.length, fresh.length);
    return h('div', { class: 'pp-proposal', role: 'group', 'aria-label': '돌아와 읽기에서 가져온 문장' },
      h('p', { class: 'pp-proposal-head' }, '돌아와 읽기에서 가져온 문장 · 아직 초안에 넣지 않았어요'),
      h('blockquote', {}, pr.text),
      h('div', { class: 'pp-row' },
        h('button', { type: 'button', class: 'secondary small', disabled: !!st.pending, onclick: acceptProposal }, empty ? '초안으로 쓰기' : '초안 끝에 덧붙이기'),
        h('button', { type: 'button', class: 'link-button', onclick: () => { PROPOSALS.delete(st.key); render(); } }, '넣지 않기')),
      h('p', { class: 'fine' }, [empty ? '' : '지금 초안은 그대로 두고 끝에 이 문장을 더해요.', adding > 0 ? `결과 근거 ${adding}개도 이 구상의 자료로 붙어요.` : '',
        '사용자 기록·방향·변경안 자료는 원래 읽기에 남아요.'].filter(Boolean).join(' ')));
  }
  function acceptProposal() {
    const st = s!, pr = PROPOSALS.get(st.key); if (!pr || st.pending) return;
    const draft = st.bundle.draft.trim() ? `${st.bundle.draft.replace(/\s+$/, '')}\n${pr.text}` : pr.text;
    if (draft.length > 6000) { st.error = '초안이 6000자를 넘게 되어 덧붙이지 않았어요. 지금 초안은 그대로예요.'; render(); return; }
    const extra = [...st.bundle.extra];
    for (const e of pr.sources) {
      if (extra.length >= 20) break;
      if (extra.some(x => x.title === e.title && x.basis === e.basis)) continue;
      let n = 1; while (extra.some(x => x.id === `U${String(n).padStart(2, '0')}`)) n++;
      extra.push({ ...e, id: `U${String(n).padStart(2, '0')}` });
    }
    st.bundle = { ...withDraft(st.bundle, draft), extra }; PROPOSALS.delete(st.key); st.editing = true; st.error = null; persist(); render();
    // The new textarea is already in the DOM. Finish its caret placement in this click, before the person can select/type.
    // A deferred selection can collapse a subsequent select-all between selection and insertion, appending to the proposal.
    const a = document.getElementById('plan-intent') as HTMLTextAreaElement | null;
    if (a) { a.focus(); a.setSelectionRange(a.value.length, a.value.length); }
  }
  /** Progress, an error, the access code only when it is needed, and the ask with what it would read. */
  function askLine(canAsk: boolean, p: ChangePlan | null): (Node | null)[] {
    const st = s!, out: (Node | null)[] = [];
    if (st.pending) {
      out.push(h('div', { class: 'pending' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }),
        h('span', {}, `${host.status().model ?? 'AI'}가 자료 ${st.pending.input.evidence.length}개와 지도를 읽고 있어요…`),
        h('button', { type: 'button', class: 'link-button', onclick: () => st.pending?.controller.abort() }, '취소')));
      return out;
    }
    if (st.error) out.push(h('p', { class: 'pp-error', role: 'alert' }, st.error));
    if (host.status().access === 'code' && canAsk && (!host.accessCode() || st.error)) out.push(accessField());
    const reach = h('p', { class: 'fine', id: 'plan-reach' }, reachText());
    const ask = h('button', { type: 'button', id: 'plan-ask', onclick: () => void analyze() }) as HTMLButtonElement;
    askState(ask);
    out.push(h('div', { class: 'pp-row pp-ask' }, ask, codeNote(canAsk && host.status().access === 'code', !!host.accessCode()), reach));
    if (!canAsk) out.push(h('p', { class: 'fine' }, host.status().ai === 'off' ? '서버에 AI 키가 없어 살펴볼 수 없어요. 초안은 남아요.' : 'AI 서버가 연결된 주소에서 살펴볼 수 있어요. 초안은 남아요.'));
    return out;
  }
  /** What the next analysis would read, before anything is sent. */
  function reachText(): string {
    const inp = input(); if (!inp) return '';
    if (inp.problem === 'TOO_LARGE') return '자료가 요청 한도보다 커요';
    if (inp.problem) return `‘${inp.problem.secret}’에 키처럼 보이는 글이 있어요`;
    const added = s!.bundle.extra.length ? ` + 붙인 자료 ${s!.bundle.extra.length}개` : '';
    if (s!.example && s!.key === CONVERTER_KEY) return `예제 원자료 ${inp.evidence.filter(e => e.id !== 'INTENT' && !s!.bundle.extra.some(x => x.id === e.id)).length}개${inp.evidence.some(e => e.id === 'INTENT') ? ' + 고친 문장' : ''}${added} · 작성된 분석은 보내지 않아요`;
    return inp.records.total ? `이 문장${added} + 기록 ${inp.records.sent === inp.records.total ? `${inp.records.total}개` : `${inp.records.total}개 중 최신 ${inp.records.sent}개`}` : `${added ? `이 문장${added}` : '이 문장과 지도'} · 아직 기록 없음`;
  }
  function askState(btn: HTMLButtonElement) {
    const p = plan(), why = staleness();
    btn.textContent = p ? (why === 'sentence' ? '고친 문장으로 살펴보기' : why === 'material' ? '바뀐 자료로 살펴보기' : why ? '지금 작성 맥락으로 살펴보기' : 'AI로 다시 살펴보기') : 'AI로 살펴보기';
    btn.className = p && !why ? 'secondary small' : 'primary small';
    const st = host.status();
    codeGate(btn, st.ai === 'deepseek' && st.access === 'code', !!host.accessCode(), st.ai !== 'deepseek' || !s!.bundle.draft.trim());
  }
  /** The draft changed without a render: the stale line, the ask, what it would read and the request follow in place. */
  function syncStale() {
    if (!s) return;
    const why = staleness(), line = document.getElementById('plan-stale');
    if (line) { line.textContent = why ? STALE_LINE[why] : ''; line.hidden = !why; }
    const ask = document.getElementById('plan-ask') as HTMLButtonElement | null; if (ask) askState(ask);
    const reach = document.getElementById('plan-reach'); if (reach) reach.textContent = reachText();
    // The count of material follows the typing in place: no re-render, the caret stays.
    document.querySelectorAll('.pp-sources-count').forEach(el => { el.textContent = sourcesLabel(); });
    document.querySelector('#plan-panel .pp-plan')?.classList.toggle('is-stale', !!why);
    const make = document.getElementById('plan-make') as HTMLButtonElement | null;
    if (make) { make.disabled = !canRequest(); make.title = requestTitle(); }
    const note = document.getElementById('plan-make-note'); if (note) { note.textContent = why ? requestTitle() : ''; note.hidden = !why; }
    // The workspace's ways to the map follow too: no part reading of an earlier plan, and an honest way out.
    document.querySelectorAll<HTMLButtonElement>('#plan-panel .pw-map').forEach(mapButton);
    const back = document.getElementById('pw-back') as HTMLButtonElement | null; if (back) backButton(back);
    const detail = document.querySelector('#plan-panel .pw-detail'); detail?.classList.toggle('is-stale', !!why);
    const banner = detail?.querySelector<HTMLElement>('.pw-stale'); if (banner) banner.hidden = !why;
  }
  /** What the next analysis would read, counted before a sentence is written too (the material does not wait for the sentence). */
  function sourcesLabel(): string {
    const st = s!, p = plan(), o = host.current();
    let n = 0;
    if (p && !stale() && !st.editing) n = p.evidence.length;
    else if (o) n = (input() ?? (o.key === CONVERTER_KEY ? exampleInput(o, st.condition, '…', o.alias!.toId, st.bundle.extra) : projectInput(o, '…', st.bundle.extra))).evidence.length;
    return `${st.example && st.key === CONVERTER_KEY ? '예제 원자료' : '읽는 자료'} ${n}개`;
  }
  function sourcesToggle(_o: PlanOpened) {
    const st = s!, p = plan(), open = p ? st.rail === 'sources' : st.sources;
    // No change proposed: the material of the next analysis opens in the list's place and closes back to it (same place, same control).
    const toggle = () => { if (!p) st.sources = !st.sources; else if (noChange() && open) return railBack(); else { if (!open) leaveList('sources'); st.rail = open ? 'request' : 'sources'; } render(); };
    return h('button', { type: 'button', class: 'link-button quiet pp-sources-count', 'aria-expanded': String(open), onclick: toggle }, sourcesLabel());
  }
  function conditionSwitch(o: PlanOpened) {
    if (o.key !== CONVERTER_KEY) return null;
    const st = s!, b = (c: Condition, label: string) => h('button', { type: 'button', 'aria-pressed': String(st.condition === c), title: CONDITION_LABEL[c], disabled: !!st.pending, onclick: () => setCondition(c) }, label);
    return h('div', { class: 'pp-cond', role: 'group', 'aria-label': '예제 자료 바꾸기' }, h('span', {}, '자료 바꾸기 · 코드에 파일별 결과가'), b('A', '있음'), b('B', '없음'));
  }
  function sourceList(evidence: { id: string; kind: keyof typeof EVIDENCE_LABEL; title: string; text: string; basis: string }[], open = false) {
    return h('ol', { class: 'pp-sources' }, ...evidence.map(e => h('li', {}, h('details', { open },
      h('summary', {}, h('span', { class: `pp-kind k-${e.kind}` }, EVIDENCE_LABEL[e.kind]), h('span', {}, e.title)),
      h('p', {}, e.text), h('p', { class: 'pp-ref' }, `${e.id} · ${e.basis}`)))));
  }

  /** The person's own material for a project with few records: kept in the plan's sidecar, sent with the next analysis. */
  function addSource(o: PlanOpened) {
    if (o.kind !== 'saved') return null;
    const st = s!, extra = st.bundle.extra;
    const list = extra.length ? h('ul', { class: 'pp-extra' }, ...extra.map(e => h('li', {}, h('span', { class: `pp-kind k-${e.kind}` }, EVIDENCE_LABEL[e.kind]), h('span', {}, e.title),
      h('button', { type: 'button', class: 'link-button', 'aria-label': `‘${e.title}’ 자료 빼기`, onclick: () => { st.bundle = { ...st.bundle, extra: st.bundle.extra.filter(x => x.id !== e.id) }; persist(); render(); } }, '빼기')))) : null;
    if (!st.adding) return h('div', { class: 'pp-addsrc' }, list, extra.length < 20 ? h('button', { type: 'button', class: 'link-button', onclick: () => { st.adding = true; render(); document.getElementById('src-title')?.focus(); } }, '+ 자료 추가') : null);
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

  function locate(partId: string) { if (host.boxes().has(partId)) { host.reveal(partId); host.selectPart(partId); } else host.showPart(partId); }
  function resultSection() {
    const st = s!, snaps = st.bundle.snapshots, snap = snapshotOf(st.resultFor) ?? snaps.at(-1)!;
    const labels = st.bundle.labels[snap.id] ?? {}, origin = st.bundle.origins[snap.id];
    const mine = st.bundle.observations.filter(x => st.bundle.attached[x.id] === snap.id);
    const rows = compareResults(snap, mine);
    const sec = h('section', { class: 'pp-sec pp-results' }, h('div', { class: 'pp-sec-head' }, h('h3', {}, '돌아온 기록'),
      h('button', { type: 'button', class: 'link-button', title: '돌아온 기록과 프로젝트 기록을 함께 읽어요. 변경 구상은 닫혀도 초안은 남아요.', onclick: () => host.readReturn() }, '돌아와 읽기'),
      snaps.length > 1 ? (() => {
        const sel = h('select', { 'aria-label': '대조할 요청문' }) as HTMLSelectElement;
        snaps.slice().reverse().forEach((x, i) => sel.append(h('option', { value: x.id, selected: x.id === snap.id }, `${i === 0 ? '마지막 ' : ''}요청문 · ${fullTime(x.createdAt)} · ${x.itemIds.length}개`)));
        sel.addEventListener('change', () => { st.resultFor = sel.value; st.addForm = false; render(); });
        return sel;
      })() : h('span', { class: 'pp-muted' }, `요청문 · ${fullTime(snap.createdAt)}`)));
    const ul = h('ul', { class: 'pp-res' });
    const current = host.current();
    const projection = current ? requestResults(current.project, snap.scope ? [snap.scope] : [], { requestId: snap.id,
      correct: async (reading, index, target) => {
        const o = host.current(); if (!o) return '프로젝트가 열려 있지 않아요.';
        try { const error = await host.commitProject(correctRequestMatch(o.project, reading, index, target)); if (!error) render(); return error; }
        catch { return '대응을 고치지 못했어요. 원문은 그대로예요.'; }
      } }) : null;
    if (projection) sec.append(projection);
    for (const r of rows) {
      const all = [...r.reported, ...r.code, ...r.tests];
      if (projection && !all.length) continue;
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
    if (!st.example && snap.scope) actions.append(h('button', { type: 'button', class: 'link-button', onclick: () => host.pasteReturn() }, '보고 원문 붙여넣기'),
      h('button', { type: 'button', class: 'link-button', title: '코드나 검사 기록 파일 하나를 원문 그대로 자료로 보관해요. 이 요청문의 결과로 확정하지 않아요.', onclick: () => host.fileReturn() }, '코드·검사 자료 추가'),
      h('button', { type: 'button', class: 'link-button', title: '고른 이 요청문으로 아직 대조하지 않은 보고를 읽어요', onclick: () => host.readRequest(snap.id) }, '이 요청과 보고 읽기'));
    if ((!st.example && !snap.scope) || (st.example && origin !== 'example')) actions.append(h('button', { type: 'button', class: 'link-button', 'aria-expanded': String(st.addForm), onclick: () => { st.addForm = !st.addForm; render(); } }, st.addForm ? '붙이기 닫기' : '돌아온 기록 직접 붙이기'));
    if (actions.childElementCount) sec.append(actions);
    if (st.example && origin !== 'example') sec.append(h('p', { class: 'fine' }, '예제의 돌아온 기록은 작성된 예제 항목과만 대응해요. AI 분석 항목에는 받은 글을 직접 붙여 주세요.'));
    if (!st.example && !snap.scope) sec.append(h('p', { class: 'fine' }, '이전 형식 요청문이라 보고가 자동 대응되지 않아요. 요청문은 그대로 두고 항목에 직접 기록할 수 있어요.'));
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

  /* The request document reads in its own sheet over the map; closing it returns to the same panel place. A document made with a
   * reading opens on its sections (the text sliced, never rewritten); one made before reads as its whole text, as it always did. */
  function renderSheet() {
    const sheet = $('plan-sheet'), snap = s ? snapshotOf(s.sheet) : null;
    sheet.hidden = !snap;
    if (!s || !snap) { sheet.replaceChildren(); delete sheet.dataset.snap; delete sheet.dataset.opening; return; }
    fitSheet();
    const read = s.sheetRead ?? (s.sheetRead = freshRead()), parts = snap.reading ? readingParts(snap.text, snap.reading) : null;
    // Re-rendering in the same opening (a copy message, a fold, a view switch, any render while it is open) keeps where each view
    // was read and what had focus. Another opening, even of the same document, starts at its top.
    const same = sheet.dataset.snap === snap.id && sheet.dataset.opening === String(read.id), shown = sheet.dataset.view as SheetRead['view'] | undefined;
    const scroller = sheet.querySelector<HTMLElement>('[data-sheet-part="text"]');
    if (same && scroller && shown) read.at[shown] = scroller.scrollTop;
    const had = same && sheet.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.sheetPart ?? null : null;
    const view = parts ? read.view : 'text';
    sheet.dataset.snap = snap.id; sheet.dataset.opening = String(read.id); sheet.dataset.view = view;
    const labels = s.bundle.labels[snap.id] ?? {}, p = plan();
    const old = !p || snap.planId !== p.id || snap.planRevision !== p.revision;
    const total = Object.keys(labels).length || snap.itemIds.length;
    const materials = parts?.filter(x => x.material).length ?? 0;
    sheet.replaceChildren(
      h('header', {}, h('div', {}, h('div', { class: 'rq-titlebar' }, h('h2', { id: 'sheet-title' }, '요청문'), parts ? viewSwitch(read, view) : null), h('p', {}, `맡길 항목 ${snap.itemIds.length}/${total} · ${snap.itemIds.map(id => labels[id] ?? id).join(' · ')}`),
        h('p', { class: 'fine' }, `${fullTime(snap.createdAt)}에 만듦 · ${{ example: '작성된 예제 분석의 고정 전제', reviewed: 'AI가 고른 범위의 전제를 살펴봄', ai: '전제 검토 없이 만든 이전 요청문' }[s.bundle.origins[snap.id] ?? 'ai']}${old ? ' · 지금 변경안과 다른 판' : ''}`)),
        parts && view === 'reading' ? sectionNav(parts) : null,
        h('button', { type: 'button', class: 'close', 'data-sheet-part': 'x', 'aria-label': '요청문 닫기', title: '닫기 (Esc)', onclick: closeSheet }, '×')),
      parts && view === 'reading' ? readingBody(parts, read) : h('pre', { tabindex: '0', 'data-sheet-part': 'text' }, snap.text),
      h('footer', {}, h('button', { type: 'button', id: 'plan-copy', 'data-sheet-part': 'copy', class: 'primary small', onclick: () => void copy(snap.text),
        ...(parts ? { title: `접혀 있는 자료까지 원문 ${snap.text.length.toLocaleString('ko-KR')}자 전체를 복사해요` } : {}) }, parts ? `전체 복사 · 자료 ${materials}개 포함` : '복사'),
        h('span', { class: 'fine', role: 'status' }, s.copyMsg ?? '복사는 이 글을 옮기는 일이에요. 접수·실행·완료를 기록하지 않아요.'),
        h('button', { type: 'button', class: 'link-button', 'data-sheet-part': 'close', onclick: closeSheet }, '닫기')));
    const body = sheet.querySelector<HTMLElement>('[data-sheet-part="text"]')!; body.scrollTop = same ? read.at[view] : 0;
    if (had) sheet.querySelector<HTMLElement>(`[data-sheet-part="${had}"]`)?.focus({ preventScroll: true });
  }
  /** Reading by sections or as the text: a way of reading this opening, never a change to the document. */
  function viewSwitch(read: SheetRead, view: SheetRead['view']): HTMLElement {
    const switchTo = (next: SheetRead['view']) => () => {
      if (!s || read.view === next) return;
      read.view = next; renderSheet(); // the render keeps where the view being left was read
      if (next === 'text' && read.blocked) selectText();
    };
    return h('div', { class: 'rq-views', role: 'group', 'aria-label': '요청문 보기' },
      h('button', { type: 'button', 'data-sheet-part': 'view-reading', 'aria-pressed': String(view === 'reading'), onclick: switchTo('reading') }, '구간으로 읽기'),
      h('button', { type: 'button', 'data-sheet-part': 'view-text', 'aria-pressed': String(view === 'text'), onclick: switchTo('text') }, '원문 그대로'));
  }
  /** The moves within the document, one row above it (the reading keeps the sheet's whole width). */
  function sectionNav(parts: ReadingPart[]): HTMLElement {
    return h('nav', { class: 'rq-nav', 'aria-label': '요청문 안에서 이동' }, ...parts.filter(x => SECTION[x.kind].nav).map(x =>
      h('button', { type: 'button', class: 'rq-jump', 'data-sheet-part': `go-${x.kind}`, onclick: () => jump(x.kind) }, x.kind === 'materials' ? `자료 ${parts.filter(m => m.material).length}` : SECTION[x.kind].nav!)));
  }
  /** Moving to a section is reading, not editing: the view scrolls to its heading and the keyboard goes on from there. */
  function jump(kind: ReadingPart['kind']) {
    const body = document.querySelector<HTMLElement>('#plan-sheet .rq-read'), heading = body?.querySelector<HTMLElement>(`[data-sec="${kind}"] .rq-h`);
    if (!body || !heading) return;
    body.scrollTop = (heading.closest<HTMLElement>('[data-sec]')!.offsetTop) - 8;
    heading.focus({ preventScroll: true });
  }
  /** Every piece is a slice of the text in its order (data-at: where it starts): joined, they are the text. Material is listed by
   * its own id, title and kind and unfolds in place; folded, its text is still in the document and in every copy. */
  function readingBody(parts: ReadingPart[], read: SheetRead): HTMLElement {
    const slice = (tag: 'span' | 'div' | 'h3' | 'p', at: number, text: string, cls: string, extra: Record<string, string | boolean> = {}) => h(tag, { class: cls, 'data-at': String(at), ...extra }, text);
    const gap = (x: ReadingPart) => (x.gap ? slice('span', x.start + x.heading.length + x.body.length, x.gap, 'rq-gap', { hidden: true }) : null);
    const mats = parts.filter(x => x.material), allOpen = mats.length > 0 && mats.every(x => read.open.includes(x.material!.ref));
    const toggle = (refs: string[], on: boolean) => { read.open = on ? [...new Set([...read.open, ...refs])] : read.open.filter(r => !refs.includes(r)); renderSheet(); };
    const out = h('div', { class: 'rq-read', tabindex: '0', 'data-sheet-part': 'text', 'aria-label': '요청문 · 생성 당시 구간' });
    for (const x of parts) {
      const tag = SECTION[x.kind].tag ? h('span', { class: 'rq-tag' }, SECTION[x.kind].tag!) : null;
      if (x.material) {
        const ref = x.material.ref, open = read.open.includes(ref);
        out.append(h('div', { class: `rq-mat${open ? ' open' : ''}`, 'data-ref': ref },
          h('button', { type: 'button', class: 'rq-mat-head', 'aria-expanded': String(open), 'data-sheet-part': `mat-${ref}`, onclick: () => toggle([ref], !open) },
            chevron(open), slice('span', x.start, x.heading, 'rq-mat-name'), h('span', { class: 'rq-tag' }, '자료'), h('span', { class: 'rq-mat-size' }, `${x.body.length.toLocaleString('ko-KR')}자`)),
          slice('div', x.start + x.heading.length, x.body, 'rq-text', { hidden: !open }), gap(x)));
        continue;
      }
      const sec = h('section', { class: `rq-sec rq-${x.kind}`, 'data-sec': x.kind });
      if (x.kind === 'head') put(sec, slice('p', x.start, x.heading, 'rq-h rq-title', { tabindex: '-1', 'data-sheet-part': 'sec-head' }));
      else if (x.kind !== 'closing') put(sec, h('div', { class: 'rq-sec-head' }, slice('h3', x.start, x.heading, 'rq-h', { tabindex: '-1', 'data-sheet-part': `sec-${x.kind}` }), tag));
      else put(sec, h('div', { class: 'rq-sec-head' }, h('h3', { class: 'rq-h', tabindex: '-1', 'data-sheet-part': 'sec-closing' }, '결과 안내'), tag));
      if (x.kind === 'materials') put(sec, h('p', { class: 'rq-mat-note' }, `자료 ${mats.length}개 · 작업 지시가 아니라 읽을 자료예요. 접혀 있어도 전체 복사에 들어가요.`),
        mats.length ? h('button', { type: 'button', class: 'link-button rq-mat-all', 'data-sheet-part': 'mat-all', onclick: () => toggle(mats.map(m => m.material!.ref), !allOpen) }, allOpen ? '자료 모두 접기' : '자료 모두 펼치기') : null);
      if (x.body) put(sec, slice('div', x.start + x.heading.length, x.body, 'rq-text'));
      put(sec, gap(x));
      out.append(sec);
    }
    return out;
  }
  /** The sheet reads beside the inspector while the strip left of it is wide enough; otherwise it covers the window. */
  function fitSheet() { $('plan-sheet').classList.toggle('wide', $('space').getBoundingClientRect().width - width() - 48 < 420); }
  // A resized window changes the inspector width: keep the map's reference width and the sheet in step.
  window.addEventListener('resize', () => { if (!s) return; fitSheet(); });
  /** A kept document opened to read: reading starts in it (the keyboard goes on from there), nothing else changes. */
  function openSheet(id: string) {
    if (!s) return;
    s.sheet = id; s.sheetFrom = { snap: id, entry: 'last' }; s.sheetRead = freshRead(); s.copyMsg = null; render();
    document.querySelector<HTMLElement>('#plan-sheet [data-sheet-part="text"]')?.focus({ preventScroll: true });
  }
  /** Closing returns to the control that opened this document when it can take focus; otherwise to the same place's other way to
   * a request document, then the workspace heading. Never a disabled, hidden or covered control; nothing scrolls to reach it. */
  function closeSheet() {
    if (!s) return;
    const from = s.sheetFrom?.snap === s.sheet ? s.sheetFrom.entry : null;
    s.sheet = null; s.sheetFrom = null; s.sheetRead = null; s.copyMsg = null; render();
    const usable = (el: HTMLElement | null): el is HTMLElement => !!el && !(el as HTMLButtonElement).disabled && !el.closest('[hidden], [inert]') && el.getClientRects().length > 0;
    const last = '#plan-panel [data-sheet-entry="last"]', make = '#plan-panel #plan-make';
    const order = from === 'make' ? [make, last, '#plan-title'] : [last, make, '#plan-title'];
    order.map(q => document.querySelector<HTMLElement>(q)).find(usable)?.focus({ preventScroll: true });
  }

  /** Escape: the innermost open thing first; the plan itself last. Returns true when handled. */
  function escape(): boolean {
    if (!s) return false;
    if (s.sheet) { closeSheet(); return true; }
    if (s.addForm) { s.addForm = false; render(); return true; }
    if (s.strip) { s.strip = null; render(); return true; }
    if (workOpen()) {
      if (s.rail !== 'request') { if (noChange()) railBack(); else { s.rail = 'request'; s.railSource = null; render(); } return true; }
      if (s.editing && !stale() && !s.pending) { s.editing = false; render(); return true; }
      if (!stale() && !s.pending && !s.scoping) { leaveWork(); return true; }
      close(); return true;
    }
    if (s.evidenceFor) { s.evidenceFor = null; s.evidenceRef = null; render(); return true; }
    if (s.focus?.kind === 'part' && host.selected()) { host.selectPart(null); return true; }
    if (s.focus) { s.focus = null; render(); return true; }
    if (host.selected()) { host.selectPart(null); return true; }
    close(); return true;
  }

  return {
    isOpen: () => !!s,
    /** The right panel's width while the whole plan is open there; 0 while the plan reads on the map. */
    open, close, projectChanged, overlay, escape,
    openResults: () => { if (!s) open(); if (!s) return; s.detail = true; s.rail = 'results'; render(); },
    /** The selection changed on the map while planning: the panel reads it in place of the part panel. */
    selectionChanged: (changed = false) => {
      if (!s) return;
      const id = host.selected();
      if (id && plan()) {
        const boxes = host.boxes(), matches = (item: PlanItem) => itemTargets(item).filter(t => t === id || visibleRep(t, boxes) === id);
        const current = s.focus?.kind === 'item' ? itemOf(s.focus.id) : null;
        const item = current && matches(current).length ? current : items().find(i => matches(i).length);
        if (item) {
          const possible = matches(item), remembered = activeTarget(item);
          s.targets[item.id] = possible.includes(remembered ?? '') ? remembered! : possible[0]!;
          s.focus = { kind: 'item', id: item.id };
        } else s.focus = { kind: 'part', id };
        s.mode = 'preview'; s.strip = null;
        if (changed) { s.evidenceFor = null; moveTarget = true; }
      }
      else if (!id && s.focus?.kind === 'part') s.focus = firstFocus(plan());
      render();
      if (changed && id && s.focus?.kind === 'part') host.reveal(id);
    },
    statusChanged: () => { if (s) render(); },
    /** The project's change plan as kept, without opening it (null: none, or unreadable). */
    bundleOf: (): PlanBundle | null => {
      const o = host.current(); if (!o || o.kind === 'legacy') return null;
      if (s && s.key === o.key) return s.bundle;
      const loaded = bundleFor(o, 'A'); return loaded.unreadable ? null : loaded.bundle;
    },
    /** A sentence (and its sources) from the return reading, offered beside the draft; nothing enters it until accepted. */
    propose: (text: string, sources: Evidence[]) => {
      const o = host.current(); if (!o || o.kind === 'legacy') return;
      PROPOSALS.set(o.key, { text, sources });
      if (!s) open(); if (!s) return;
      if (plan()) { s.detail = true; s.editing = true; }
      render();
      document.querySelector<HTMLElement>('.pp-proposal button')?.focus();
    },
    /** Open on the change whose targets include one of these parts, in preview on the same map. */
    focusParts: (ids: string[]) => {
      if (!s) open(); if (!s) return;
      const item = items().find(i => itemTargets(i).some(t => ids.includes(t)));
      if (item) { s.focus = { kind: 'item', id: item.id }; s.targets[item.id] = itemTargets(item).find(t => ids.includes(t))!; s.mode = 'preview'; s.detail = false; s.evidenceFor = null; moveTarget = true; }
      render();
    },
    toggle: () => (s ? close() : open()),
    width,
    sheetOpen: () => !!s?.sheet,
  };
}
