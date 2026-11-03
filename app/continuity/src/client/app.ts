/* AgentFlow Studio client: entry → map → focused part. Reads project.7 data (saved projects and built examples) and never
 * rewrites records; the only project write is the user's own part name/note through the domain's editArea. */
import { isMapReading, isScenarioReading, type Project, type ScenarioReading } from '../shared/types.js';
import { FILE_LIMIT, PASTED_LIMIT } from '../shared/types.js';
import { WorkspaceStore, type EntryRef, storageErrorCode, serializeProject, readViewState, readEntryView, writeViewState, readEntryPositions, writeEntryPositions, importCopy, serializeBackup } from '../shared/storage.js';
import { parseBackup, cleanPositions } from '../shared/validation.js';
import { editArea, addArea, addChildArea, createProject, rename, pasteRecord, removePastedRecord, provideRecord, secretPasted, correctReadingRole, recordReadIntoMap } from '../shared/domain.js';
import { parseScenarioRecord, applyScenario, scenarioUnderstanding, projectLedger, type ScenarioUnderstanding } from '../shared/scenario-record.js';
import { scenarioRecordLike, badgePlaces, pathRelations, visitLinks, brokenPlace, headTexts, scenarioLabel, scenarioResultLine, saidText, visitNumber, linkTitle, LINK_WORD, LINK_GLYPH, KIND_WORD, type BrokenPlace } from './scenario-view.js';
import { CLAIM_LABEL, stateLabel, revisedRelations, candidateReading, type Applied, type CurrentClaim, type PartUnderstanding } from '../shared/map-reading.js';
import { roleEvidence } from './role-evidence.js';
import type { Channel, ClaimTopic, ReadingQuote, ReadingRelation, SavedCamera } from '../shared/types.js';
import { TOPIC_LABEL, TOPIC_HINT, EVIDENCE_LABEL, EVIDENCE_HINT, STATE_WORD, MODE_LABEL, TYPE_LABEL, FAMILY_OF, CHANNEL_LABEL, claimEvidence, claimWhen, claimsByTopic, type PartFamily } from '../shared/claim-topic.js';
import { recordTitle } from './digest-source.js';
import { createMapRun, sendLine, JOB_NOTE, type MapRunState } from './map-run.js';
import { mapBatchLines, mapPendingText } from '../shared/map-route.js';
import { JobReservations, JOBS_KEY, type JobLocks } from './map-jobs.js';
import { requestResults, frozenRequests, displayAbout, captureRequestReading, restoreRequestReading, createWideReading } from './request-results.js';
import { correctRequestMatch, unlinkReplacement, requestComparison } from '../shared/request-return.js';
import { studioView, subtreeRecords, partPath, buildAsk, draftAfterAnswer, STATUS_LABEL, STATUS_SHORT, RECORD_LABEL, type AskCoverage, type StudioView, type PartView, type RecordView, type RelationView, type AskIntent, type StudioReply } from '../shared/studio.js';
import { EXAMPLES, buildExample, exampleKeys } from '../shared/studio-examples.js';
import { layoutScope, lead, mapLead, isListGroup, boundaryCounts, budgetFold, summaryEdges, restSummary, resolveLabels, ROOT, HEAD, type Box, type Edge, type Face, type TypedCard, type LabelSpot, type TextMeasure, type ScopeLayout, type Positions, type Point } from './map-layout.js';
import { aiStatus, askStudio, AskError, ERROR_TEXT, RELEASE_TEXT, PUBLIC_EDITION, connectorRecords, publishHandover, type AiStatus } from './studio-api.js';
import { RUNTIME, runtimeStorage } from './runtime.js';
import { $, h, put, svg, chevron, ago, fullTime, inspectorWidth, codeGate, codeNote, syncCodeGates } from './plan-dom.js';
import { routeEdges, samplePath, mixPath, type Routed } from './map-route.js';
import { typedBudget, typedLines, typedPx, zoomLevel, entryKind, entryParts, loopBody, TYPE_H, LINE_H, type CardBudget, type ChipsAt, type BodyKind, type ZoomLevel, type EntryKind, type EntryCounts, type EntryShown } from './card-budget.js';
import { placeExpansion, actionSections, pushPlace, readOpenState, writeOpenState, groupBody, loopLine, stateVarLine, UNSAID, OPEN_MAP, SHORT_W, type OpenState, type ReadPlace, type ActionStep } from './expansion.js';
import { detailChain, stepConsumers, unmappedMark, type ChainLink, type OutLine } from './steps-view.js';
import { labelSpots, polylineHitsRect, portSpots } from './map-labels.js';
import { opsLines } from './ops-line.js';
import { PROJECT_REPORT_ASK, CHAT_REPORT_ASK, DESIGN_RECORD_ASK, RECORD_ASK_EXPLAIN, deltaReportAsk, reflectAsk, scenarioAskWithLedger, plannedNote } from '../shared/report-ask.js';
import { modelLabel } from '../shared/model-label.js';
import { CONVERTER_KEY, buildConverterProject, converterKeys } from './plan-source.js';
import { createPlanView } from './plan-view.js';
import { AUTO_SENDS, createReturnView, mapExclusionHistory, type Scene, type ReadingContext } from './return-view.js';
import { createAutoSync } from './auto-sync.js';
import { createSessionSources } from './session-source.js';
import { createHandoverView } from './handover-view.js';
import { createCloudLink } from './cloud-link.js';
import { partSessions, originLabel, handoverDoc, handoverCode } from '../shared/handover.js';
import { UI62_KEY, buildUi62Project, ui62Keys } from '../shared/return-material.js';
import { REL_LABEL, relationGroups, relLabel, dirMark, dirTitle, insideEnds } from '../shared/relation-groups.js';

/* ---------- small DOM helpers (shared with the change-plan view) ---------- */
const firstLine = (text: string, n = 90) => { const line = text.split('\n').find(l => l.trim())?.trim() ?? ''; return line.length > n ? `${line.slice(0, n)}…` : line; };
const recentAt = (at: string | null) => !!at && Date.now() - Date.parse(at) < 24 * 3600000;

/* ---------- state ---------- */
/** alias: stable address keys of an example's parts (spec key → id) and back; null for saved projects, whose ids are stable. */
interface Opened { key: string; kind: 'example' | 'saved' | 'legacy'; project: Project; ref: EntryRef | null; view: StudioView; alias: { toId: Map<string, string>; toKey: Map<string, string> } | null }
interface Answer { at: string; intent: AskIntent; question: string | null; model: string; reply: StudioReply; refs: Record<string, string>; coverage?: AskCoverage }
interface Ask { partId: string; intent: AskIntent; question: string | null; controller: AbortController | null; error: string | null; coverage?: AskCoverage }

let status: AiStatus = { ai: 'none', model: null, access: 'open' };
let statusReady: Promise<void> | null = null;
let opened: Opened | null = null;
let selected: string | null = null;
let camera = { x: 0, y: 0, k: 1 };
let ask: Ask | null = null;
let editing = false;
/** The question box opens on demand; it stays open while there is a draft, a request in flight or an error. */
let composerOpen = false;
let recentAll = false;
/** Short note of what went to the AI when not everything fit (newest records first). null when everything went. */
function coverageText(c: AskCoverage | undefined): string | null {
  if (!c) return null;
  const out: string[] = [];
  if (c.records.sent < c.records.total) out.push(`기록 ${c.records.total}개 중 최신 ${c.records.sent}개`);
  if (c.records.cut) out.push(`${c.records.cut}개는 앞부분만`);
  if (c.links.sent < c.links.total) out.push(`연결 ${c.links.total}개 중 ${c.links.sent}개`);
  if (c.children.sent < c.children.total) out.push(`안의 부분 ${c.children.total}개 중 ${c.children.sent}개`);
  return out.length ? `${out.join(' · ')}만 보냄` : null;
}
/** Recent records open only on request (a popover above the map tools); they never reserve map room. While a part or the
 * plan is open the list folds; the person's own choice comes back on close. */
let recentOpen = false;
let recentPeek = false;
const recentShown = () => (selected || planView.isOpen() ? recentPeek : recentOpen);
/** One inspector width for a part and for the change plan (CSS: .inspector). Narrow windows: the whole width. */
const inspW = inspectorWidth;
const examples = new Map<string, Project>();
let store: WorkspaceStore;
let storage: Storage | null = null;
try { storage = window.localStorage; } catch { storage = null; }
const memoryStorage = new Map<string, string>();
const kv = runtimeStorage({
  getItem: k => { try { return storage ? storage.getItem(k) : memoryStorage.get(k) ?? null; } catch { return null; } },
  setItem: (k, v) => { if (storage) storage.setItem(k, v); else memoryStorage.set(k, v); }
});

/* Answers: kept apart from the project (own key), so the saved project format is never touched. Examples stay in memory. */
const ANSWERS_KEY = 'agentflow.studio.answers.1';
const memoryAnswers = new Map<string, Answer[]>();
function answersOf(o: Opened, partId: string): Answer[] {
  const key = `${o.project.id}/${partId}`;
  if (o.kind === 'example') return memoryAnswers.get(key) ?? [];
  try { const all = JSON.parse(kv.getItem(ANSWERS_KEY) ?? '{}') as Record<string, Answer[]>; return Array.isArray(all[key]) ? all[key]! : []; } catch { return []; }
}
function addAnswer(o: Opened, partId: string, a: Answer) {
  const key = `${o.project.id}/${partId}`, list = [...answersOf(o, partId), a].slice(-6);
  if (o.kind === 'example') { memoryAnswers.set(key, list); return; }
  try {
    const all = JSON.parse(kv.getItem(ANSWERS_KEY) ?? '{}') as Record<string, Answer[]>; all[key] = list;
    const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete all[k];
    kv.setItem(ANSWERS_KEY, JSON.stringify(all));
  } catch { memoryAnswers.set(key, list); }
}

/* Question drafts: kept per part across part/project switches; saved projects keep them across reloads (own key). */
const DRAFTS_KEY = 'agentflow.studio.drafts.1';
const memoryDrafts = new Map<string, string>();
function getDraft(o: Opened, partId: string): string {
  const key = `${o.project.id}/${partId}`;
  if (memoryDrafts.has(key)) return memoryDrafts.get(key)!;
  if (o.kind !== 'saved') return '';
  try { const v = (JSON.parse(kv.getItem(DRAFTS_KEY) ?? '{}') as Record<string, unknown>)[key]; return typeof v === 'string' ? v : ''; } catch { return ''; }
}
function setDraft(o: Opened, partId: string, value: string) {
  const key = `${o.project.id}/${partId}`; memoryDrafts.set(key, value);
  if (o.kind !== 'saved') return;
  try {
    const all = JSON.parse(kv.getItem(DRAFTS_KEY) ?? '{}') as Record<string, string>;
    if (value.trim()) all[key] = value.slice(0, 1000); else delete all[key];
    kv.setItem(DRAFTS_KEY, JSON.stringify(all));
  } catch { /* the in-memory draft still holds */ }
}

/* Map positions the person set by dragging: own record per opened map (a saved project by its workspace entry, so an imported
 * copy and its original keep their own places; examples stay in memory). Kept apart from the stored layout.1 data, which the
 * domain fills on every new area and so cannot tell a placed part from an untouched one. A backup file carries them beside the
 * project (serializeBackup); importing one gives the new copy those places. */
const memoryPositions = new Map<string, Positions>();
function positionsOf(o: Opened): Positions {
  let p = memoryPositions.get(o.key);
  if (!p) { p = o.kind === 'saved' ? readEntryPositions(kv, o.key, o.project.id) : cleanPositions(null); memoryPositions.set(o.key, p); }
  return p;
}
/** Before a part is dragged: every automatically placed box in its container, and in each container above, keeps the place it
 * has now (held, not stored). Otherwise the layout, run again for each move with the container's new size, would shift the
 * dragged part's siblings and the regions beside them while the hand moves and once more on the drop. The hold lasts until
 * the next redraw of the structure (a fold, a new part, 자동 배치), when the automatic arrangement takes over again. */
function holdPlaces(o: Opened, container: string) {
  const pos = positionsOf(o), out: Positions = held ?? {};
  for (let c: string | undefined = container, g = 0; c && g < 64; c = lay.boxes.get(c)?.container, g++) {
    const here = (out[c] ??= {});
    for (const b of lay.boxes.values()) if (b.container === c && b.kind !== 'ghost' && !pos[c]?.[b.id] && !here[b.id]) here[b.id] = { x: Math.round(b.rel.x), y: Math.round(b.rel.y) };
  }
  held = out;
}
function savePositions(o: Opened) { if (o.kind === 'saved') writeEntryPositions(kv, o.key, positionsOf(o)); } // a refused write: the in-memory places still hold for this tab

/* Scope = the part whose inside is shown (null = whole project). Each scope keeps its own camera for the way back. */
let scope: string | null = null;
let lay: ScopeLayout = { boxes: new Map(), edges: [], heads: [], bounds: { x: 0, y: 0, w: 0, h: 0 }, spine: [] };
const cameras = new Map<string, { x: number; y: number; k: number; win?: [number, number] }>();
const winSize = (): [number, number] => [window.innerWidth, window.innerHeight];
/** Whether a camera saved in a window of that size still fits this one: both sides within a quarter. An unknown size is taken. */
const sameWindow = (win?: [number, number]) => !win || (Math.abs(win[0] - window.innerWidth) <= window.innerWidth / 4 && Math.abs(win[1] - window.innerHeight) <= window.innerHeight / 4);
const expandState = new Map<string, boolean>();
const camKey = (o: Opened, s: string | null) => `${o.key}|${s ?? ''}`;
/* Folds and per-scope cameras outlive a reload: own record per opened map (a saved project by its workspace entry, like its
 * places; an example by its address key and stable part keys, so a freshly built example reads the same), written shortly
 * after a change and when the page goes away. Never the project data. */
const viewKeyOf = (o: Opened) => o.key;
const stableId = (o: Opened, id: string) => o.alias?.toKey.get(id) ?? id;
const liveId = (o: Opened, key: string) => o.alias?.toId.get(key) ?? key;
function loadView(o: Opened) {
  const v = o.kind === 'example' ? readViewState(kv, viewKeyOf(o)) : readEntryView(kv, viewKeyOf(o), o.project.id);
  for (const [k, open] of Object.entries(v.folds)) { const id = liveId(o, k); if (partOf(o, id)) expandState.set(`${o.key}|${id}`, open); }
  for (const [k, c] of Object.entries(v.cameras)) {
    const id = k ? liveId(o, k) : null; if (id && !partOf(o, id)?.childIds.length) continue;
    if (!cameras.has(camKey(o, id))) cameras.set(camKey(o, id), { x: c.x, y: c.y, k: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, c.scale)), ...(c.win ? { win: c.win } : {}) });
  }
}
let viewTimer = 0, viewFor: Opened | null = null;
function saveViewSoon() { const o = opened; if (!o) return; if (viewFor && viewFor !== o) flushView(); viewFor = o; clearTimeout(viewTimer); viewTimer = window.setTimeout(flushView, 400); }
function flushView() {
  clearTimeout(viewTimer); const o = viewFor; viewFor = null; if (!o) return;
  if (opened === o) cameras.set(camKey(o, scope), { ...camera, win: winSize() });
  const prefix = `${o.key}|`, folds: Record<string, boolean> = {}, cams: Record<string, SavedCamera> = {};
  for (const [k, v] of expandState) if (k.startsWith(prefix)) folds[stableId(o, k.slice(prefix.length))] = v;
  for (const [k, c] of cameras) if (k.startsWith(prefix)) { const sc = k.slice(prefix.length); cams[sc ? stableId(o, sc) : ''] = { x: c.x, y: c.y, scale: c.k, ...(c.win ? { win: c.win } : {}) }; }
  writeViewState(kv, viewKeyOf(o), { folds, cameras: cams });
}
/** Direct children of the scope open as frames; deeper parts stay folded until opened. */
/** Unfolded only for the part being looked at (not the person's own fold choice). */
const tempExpand = new Set<string>();
/** The preview owns only the ancestors needed to see its current actual target. User folds and record peeks stay separate. */
const previewExpand = new Set<string>();
let previewTarget: string | null = null, previewScope = '';
const isExpanded = (o: Opened) => {
  const memo = new Map<string, boolean>();
  const fn = (id: string, depth: number): boolean => {
    const k = `${o.key}|${id}`; if (memo.has(k)) return memo.get(k)!;
    let v: boolean;
    if (tempExpand.has(k) || previewExpand.has(k)) v = true;
    else if (expandState.has(k)) v = expandState.get(k)!;
    else v = defaultOpen(o, id, depth, fn);
    memo.set(k, v); return v;
  };
  return fn;
};
/** Without the person's own choice: the scope's direct children open, except rows of a list (they stay compact); and a part
 * that is the only child of an open part opens too, so a single-child path (a package with one source folder) shows what
 * it holds while every step of the path keeps its own head. */
function defaultOpen(o: Opened, id: string, depth: number, isOpen: (id: string, depth: number) => boolean): boolean {
  const p = partOf(o, id); if (!p || !p.childIds.length) return false;
  if (depth === 0) return !isListGroup(o.view, scope) && !budgetFolded(o).has(id);
  const parent = partOf(o, p.parentId);
  return !!parent && depth <= 3 && parent.childIds.length === 1 && isOpen(parent.id, depth - 1);
}
/** How many parts a first view of a scope shows unfolded, and how much room it may take. Past the count, every group with an
 * inside starts folded alike (budgetFold: folding the largest first left the smallest open alone, which read as emphasis);
 * past the room, the open group taking the most room. The overview keeps every group's name, count, boundary count and
 * outside lines, and each opens at full size inside or in place. Decided once per scope, for its first view: the person's own
 * folds and places always win (expandState, positions), and a visited view keeps its camera. */
const SHOW_BUDGET = 28;
/** Per project and scope, for the life of the tab: an edit (a new view of the same project) or a later window size does not
 * decide the first view again. */
const foldMemo = new Map<string, Set<string>>();
function budgetFolded(o: Opened): Set<string> {
  const k = `${o.key}|${scope ?? ''}`, hit = foldMemo.get(k); if (hit) return hit;
  const ids = scope ? partOf(o, scope)?.childIds ?? [] : o.view.roots, size = (id: string) => partOf(o, id)?.childIds.length ?? 0;
  const own = (id: string) => expandState.has(`${o.key}|${id}`); // the person's own fold or unfold is never decided again
  const out = budgetFold(ids.map(id => ({ id, size: size(id) })), own, SHOW_BUDGET);
  // Then the room it takes: the first view, its title included, must read at the opening scale (85%) in this window. Past
  // it, the open group taking the most room folds next, until it does or nothing is left to fold. Stored places count as
  // they are; a group opened or entered later may be larger than the window and is read by panning.
  const fits = (fold: Set<string>) => {
    const memo = new Map<string, boolean>();
    const open = (id: string, depth: number): boolean => {
      const hit = memo.get(id); if (hit !== undefined) return hit;
      const k = `${o.key}|${id}`, p = partOf(o, id); let v: boolean;
      if (expandState.has(k)) v = expandState.get(k)!;
      else if (!p || !p.childIds.length) v = false;
      else if (depth === 0) v = !isListGroup(o.view, scope) && !fold.has(id);
      else { const parent = partOf(o, p.parentId); v = !!parent && depth <= 3 && parent.childIds.length === 1 && open(parent.id, depth - 1); }
      memo.set(id, v); return v;
    };
    const L = layoutScope(o.view, scope, open, positionsOf(o), measureName, undefined, mapAspect(), typedRoom(o.view)), titleRoom = 100 + (scope ? 34 * relationGroups(scopeEnds(o)).length : 0);
    return { L, ok: (L.bounds.w + 40) * 0.85 <= window.innerWidth - 48 && (L.bounds.h + titleRoom + 40) * 0.85 <= window.innerHeight - 152 };
  };
  for (let g = 0; g < ids.length; g++) {
    const { L, ok } = fits(out); if (ok) break;
    const area = (id: string) => { const b = L.boxes.get(id); return b ? b.w * b.h : 0; };
    const next = ids.filter(id => size(id) > 0 && !out.has(id) && !own(id) && L.boxes.get(id)?.kind === 'frame').sort((a, b) => area(b) - area(a))[0];
    if (!next) break;
    out.add(next);
  }
  foldMemo.set(k, out); return out;
}
/** Marks every part between the scope and this part (exclusive) as unfolded in the given set or map. */
function expandPath(o: Opened, id: string, into: Set<string> | Map<string, boolean>) {
  for (let p = partOf(o, partOf(o, id)?.parentId ?? null), g = 0; p && p.id !== scope && g < 64; p = partOf(o, p.parentId), g++) {
    const k = `${o.key}|${p.id}`; if (into instanceof Set) into.add(k); else into.set(k, true);
  }
}
const partOf = (o: Opened, id: string | null) => (id ? o.view.parts.find(p => p.id === id) ?? null : null);
function insideScope(o: Opened, id: string): boolean {
  if (!scope) return true;
  for (let p = partOf(o, id), g = 0; p && g < 64; p = partOf(o, p.parentId), g++) if (p.parentId === scope) return true;
  return false;
}
/** Explicit preview focus changes replace this path. Ordinary renders (sources, resize, manual pan, or a user fold) do not
 * rebuild it, so folding an ancestor while reading never immediately opens that ancestor again. */
function previewContext(id: string | null, explicit: boolean) {
  const o = opened, key = o ? camKey(o, scope) : '';
  if (id === previewTarget && key === previewScope && !explicit) return;
  previewTarget = id; previewScope = key;
  const next = new Set<string>();
  if (o && id && id !== scope && partOf(o, id) && insideScope(o, id)) expandPath(o, id, next);
  if (next.size === previewExpand.size && [...next].every(k => previewExpand.has(k))) return;
  previewExpand.clear(); for (const k of next) previewExpand.add(k);
  if (o) { renderSpace('keep', false); markSelection(selected); }
}

/* ---------- routing: #/  ·  #/p/<key>[/in/<scope>][/<part>] ---------- */
function route(): { key: string | null; scope: string | null; part: string | null } {
  const m = /^#\/p\/([^/]+)(?:\/in\/([^/]+))?(?:\/([^/]+))?$/.exec(location.hash);
  const d = (x: string | undefined) => (x ? decodeURIComponent(x) : null);
  return m ? { key: d(m[1])!, scope: d(m[2]), part: d(m[3]) } : { key: null, scope: null, part: null };
}
/** Addresses use an example's stable part keys, so a copied or reloaded link opens the same part of a freshly built example. */
const addr = (key: string, id: string) => encodeURIComponent((opened?.key === key ? opened.alias?.toKey.get(id) : undefined) ?? id);
const hashFor = (key: string | null, part: string | null, s: string | null) =>
  key ? `#/p/${encodeURIComponent(key)}${s ? `/in/${addr(key, s)}` : ''}${part ? `/${addr(key, part)}` : ''}` : '#/';
/** sc undefined = stay in the current scope of the same project. */
const go = (key: string | null, part: string | null = null, sc?: string | null) => {
  const hash = hashFor(key, part, sc !== undefined ? sc : key === opened?.key ? scope : null);
  if (location.hash !== hash) location.hash = hash; else void render();
};

function projectFor(key: string): Opened | null {
  if (opened?.key === key) return opened;
  let project: Project | null = null, kind: Opened['kind'] = 'saved', ref: EntryRef | null = null;
  if (key === CONVERTER_KEY) {
    if (!examples.has(key)) examples.set(key, buildConverterProject());
    project = examples.get(key)!; kind = 'example';
  } else if (key === UI62_KEY) {
    if (!examples.has(key)) examples.set(key, buildUi62Project());
    project = examples.get(key)!; kind = 'example';
  } else if (key.startsWith('ex-')) {
    const spec = EXAMPLES.find(e => `ex-${e.id}` === key); if (!spec) return null;
    if (!examples.has(key)) examples.set(key, buildExample(spec));
    project = examples.get(key)!; kind = 'example';
  } else if (key === 'legacy') {
    project = store.legacy?.project ?? null; kind = 'legacy';
  } else {
    const e = store.entries().find(x => x.entryId === key && x.state === 'active'); if (!e) return null;
    project = e.project; ref = { entryId: e.entryId, lifecycle: e.lifecycle, seq: e.seq };
  }
  if (!project) return null;
  let alias: Opened['alias'] = null;
  if (kind === 'example') { const toId = key === CONVERTER_KEY ? converterKeys(project) : key === UI62_KEY ? ui62Keys(project) : exampleKeys(key.slice(3), project); alias = { toId, toKey: new Map([...toId].map(([k, id]) => [id, k])) }; }
  return { key, kind, project, ref, view: studioView(project), alias };
}

/* ---------- rendering ---------- */
/** The address the last render read: a step between two history entries of the same address (A, then B, then A again) changes
 * no hash, so only popstate tells of it. */
let renderedHash = '';
async function render() {
  renderedHash = location.hash;
  // The wide reading belongs to the place it was opened from: another address closes it, restoring nothing.
  wide.drop();
  const r = route();
  if (!r.key) { quoteBack = null; if (opened) cameras.set(camKey(opened, scope), { ...camera, win: winSize() }); flushView(); planView.close(false); if (toastKey) dropToast(); forgetVisits(); opened = null; selected = null; scope = null; openState = null; backStack = []; hideDetail(); renderHome(); autoSync.render(); return; }
  const next = projectFor(r.key);
  if (!next) { go(null); return; }
  const fresh = opened?.key !== next.key;
  if (fresh && toastKey && toastKey !== next.key) dropToast();
  // Which visit this arrival is: back to where a relation was followed from (this tab's own history entry, or the named way
  // back), forward again over it, or neither. Never told by the address alone: the same part can be two different visits.
  // Back or forward by any number of steps (the browser's menu, history.go(-2)): the entry names its own visit, and every
  // visit after it goes (or comes back) with it.
  const mark = visitMark(), leaving = !fresh && opened ? herePlace() : null;
  const backAt = !fresh && !pendingVisit ? visits.findIndex(v => v.id === (visitBack ?? mark.from)) : -1, back = backAt >= 0 ? visits[backAt]! : null;
  const forwardAt = !fresh && !back && !pendingVisit && leaving && mark.to ? ahead.findIndex(v => v.id === mark.to) : -1;
  visitBack = null;
  if (back) { ahead.push(...visits.splice(backAt).reverse()); returnCamera = back.from.camera; }
  if (fresh) forgetVisits();
  // A way back is not a move in or out of the composition: it lands where it left, with no travel.
  const travel = !fresh && !back && opened ? travelFrom(next) : null;
  const idOf = (x: string | null) => (x ? next.alias?.toId.get(x) ?? x : null), routeScope = idOf(r.scope), routePart = idOf(r.part);
  const nextScope = routeScope && next.view.parts.some(p => p.id === routeScope && p.childIds.length) ? routeScope : null;
  if (fresh || nextScope !== scope) {
    if (opened) cameras.set(camKey(opened, scope), { ...camera, win: winSize() });
    if (fresh) { flushView(); scenes = []; }
    else if (backing || (back && scenes.at(-1)?.scope === back.from.scope)) scenes.pop();
    else scenes.push({ scope, selected });
    backing = false;
    // A scene equal to where we now are is not a way back (e.g. went inside, then up again).
    while (scenes.length && scenes.at(-1)!.scope === nextScope) scenes.pop();
    if (scenes.length > 12) scenes = scenes.slice(-12);
    opened = next; scope = nextScope; lastClick.id = '';
    if (fresh) { planView.projectChanged(); returnView.projectChanged(); readMarks = []; readingCamera = null; loadView(next); autoSync.opened(); }
    if (fresh) { openState = null; backStack = []; pendingAction = null; hideDetail(); dropShort(); restoreOpen = storedOpen(next); scOn = null; scVisit = null; scView = null; }
    // A new project starts with the map alone: the previous project's reading pane must not narrow its first view.
    if (fresh) { selected = null; ask = null; editing = false; partForm = null; composerOpen = false; sheetOpen = false; scopeReading = false; $('panel').hidden = true; $('panel').replaceChildren(); hideLens(); }
    tempExpand.clear();
    previewExpand.clear(); previewTarget = null; previewScope = '';
    if (scopeReading) { scopeReading = false; if ($('lens').classList.contains('scope-read')) hideLens(); }
    renderSpace('restore');
  }
  const travelling = !!travel && travel.to === scope;
  const o = opened!;
  const part = routePart && o.view.parts.some(p => p.id === routePart) ? routePart : null;
  // Opening a folded part for reference unfolds its way down only while it is open; the person's own folds come back after.
  const before = [...tempExpand].join('|');
  tempExpand.clear(); readOpen = null; relayout(o);
  if (part && part !== scope && !lay.boxes.has(part)) {
    if (insideScope(o, part)) expandPath(o, part, tempExpand);
    else { location.replace(hashFor(o.key, part, partOf(o, part)!.parentId)); return; }
  }
  if ([...tempExpand].join('|') !== before) renderSpace('keep'); else relayout(o);
  // Visits: kept only while the selection is the part a relation led to; any other way of moving on lets them go.
  if (pendingVisit) { if (pendingVisit.to === part && pendingVisit.from.key === o.key) { visits.push(pendingVisit); ahead = []; markEntry({ to: pendingVisit.id }); } pendingVisit = null; }
  else if (forwardAt >= 0 && ahead[forwardAt]!.to === part && leaving) { const again = ahead.splice(forwardAt).reverse(); again[0] = { ...again[0]!, from: leaving }; visits.push(...again); }
  else if (!back && ahead.length && (part !== leaving?.selected || scope !== leaving?.scope)) ahead = [];
  if (visits.length && visits.at(-1)!.to !== part) forgetVisits();
  if (visits.length > 12) visits = visits.slice(-12);
  select(part);
  setBar(o);
  if (returnCamera) { camera = returnCamera; returnCamera = null; applyCamera(true); }
  if (back) restoreSurface(back);
  if (quoteBack) { const from = quoteBack; quoteBack = null; restoreReading(from); }
  if (travelling) playTravel(travel!);
  rememberPlace();
  if (openPlanOnArrive) { openPlanOnArrive = false; if (!planView.isOpen() && o.kind !== 'legacy') planView.toggle(); }
  // The development-material example opens on its reading (the material or a reading already made; never a call by itself).
  if (fresh && o.key === UI62_KEY && !part && !planView.isOpen() && !returnView.isOpen()) returnView.open();
  afterRenderOpen(o);
}

/* ---------- going inside and back out: a short move from where one came from ----------
 * In: the new scope starts at the place of the part one entered and grows to its view. Out: the view starts zoomed on the
 * part one left and settles; that part flashes once. Only on an explicit way in or out; never with reduced motion. */
type Travel = { to: string | null; kind: 'in'; rect: Rect } | { to: string | null; kind: 'out'; from: string };
function travelFrom(next: Opened): Travel | null {
  const r = route(), to = (r.scope ? next.alias?.toId.get(r.scope) ?? r.scope : null);
  if (to === scope) return null;
  if (to && lay.boxes.has(to) && lay.boxes.get(to)!.kind !== 'ghost') return { to, kind: 'in', rect: toScreen(lay.boxes.get(to)!) };
  for (let c = partOf(next, scope), g = 0; c && g < 64; c = partOf(next, c.parentId), g++) if ((c.parentId ?? null) === to) return { to, kind: 'out', from: c.id };
  return null;
}
const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
function playTravel(t: Travel) {
  if (reducedMotion()) return;
  const world = $('world'), target = { ...camera }, vp = $('viewport').getBoundingClientRect();
  if (t.kind === 'in') {
    const B = core; if (!B.w || !B.h) return;
    const k = Math.min(t.rect.w / B.w, t.rect.h / B.h);
    camera = { k, x: t.rect.x - B.x * k + (t.rect.w - B.w * k) / 2, y: t.rect.y - B.y * k };
  } else {
    const b = lay.boxes.get(t.from); if (!b) return;
    const k = target.k * Math.min(2.2, Math.max(1.2, Math.min(vp.width * 0.6 / (b.w * target.k), vp.height * 0.6 / (b.h * target.k))));
    camera = { k, x: vp.width / 2 - (b.x + b.w / 2) * k, y: vp.height / 2 - (b.y + b.h / 2) * k };
    const el = world.querySelector<HTMLElement>(`[data-box="${CSS.escape(t.from)}"]`);
    if (el) { el.classList.remove('came-from'); void el.offsetWidth; el.classList.add('came-from'); }
  }
  world.classList.add('travel', t.kind === 'in' ? 'travel-in' : 'travel-out'); applyCamera(false);
  void world.offsetWidth;
  requestAnimationFrame(() => { camera = target; world.classList.remove('travel-in', 'travel-out'); applyCamera(false); setTimeout(() => world.classList.remove('travel'), 360); });
}
/** Set when a change plan closes: the camera the person left, applied once the earlier selection and scope are back. */
let returnCamera: { x: number; y: number; k: number } | null = null;
/** The way back to earlier scenes (a scope and its selection), apart from the composition path: arriving from a side part, a
 * plan item or a record is not the same as the parent. Each scope keeps its own camera (cameras) and folds (expandState). */
let scenes: { scope: string | null; selected: string | null }[] = [];
let backing = false;
function sceneBack() {
  const o = opened, prev = scenes.at(-1); if (!o || !prev) return;
  if (visitScene(o)) { returnFromVisit(); return; }
  backing = true; go(o.key, prev.selected && o.view.parts.some(p => p.id === prev.selected) ? prev.selected : null, prev.scope);
}

/* ---------- following a relation: a named way back to where it was followed from ----------
 * Only an explicit relation (a port in the lens, a link in the reading sheet, a scope's own outside relation) records where it
 * was followed from: the scope, the selection, the camera, which surface was reading (lens, sheet, scope) and how far it was
 * scrolled. Selecting on the map, finding, going in or up record nothing. Folds, places and drafts are never taken back: what
 * the person folded or moved meanwhile stays; only the path unfolded to show the visited part closes again (it follows the
 * route). Each visit marks this tab's own history entries, so the browser's Back and the named way back are one and the same,
 * and the same part reached twice is two visits. Memory only: a reload or another project starts with none. */
type Place = ReadingContext & { key: string; scope: string | null; selected: string | null; camera: { x: number; y: number; k: number } };
let quoteBack: Place | null = null;
type Visit = { id: string; from: Place; to: string; kind: string; note: string };
const visitTab = Math.random().toString(36).slice(2, 8);
let visits: Visit[] = [], ahead: Visit[] = [], pendingVisit: Visit | null = null, visitBack: string | null = null, visitSeq = 0;
function forgetVisits() { visits = []; ahead = []; pendingVisit = null; }
function herePlace(): Place | null {
  const o = opened; if (!o) return null;
  const surface = selected ? (sheetOpen ? 'sheet' : 'lens') : scopeReading ? 'scope' : 'none';
  const body = surface === 'sheet' ? $('panel').querySelector('.panel-body') : surface === 'none' ? null : $('lens').querySelector('.lens-body');
  const active = body?.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
  return { key: o.key, scope, selected, camera: { ...camera }, surface, sheetReturn, scroll: body?.scrollTop ?? 0,
    requests: body ? captureRequestReading(body) : null, claimFocus: active?.dataset.claimFocus ?? null };
}
function readingScene(): Scene | null {
  const p = selected ? herePlace() : null;
  return p ? { key: p.key, selected: p.selected, scope: p.scope, camera: p.camera, reading: p } : null;
}
function visitMark(): { from: string | undefined; to: string | undefined } { const s = history.state as { afVisitFrom?: unknown; afVisitTo?: unknown } | null; return { from: typeof s?.afVisitFrom === 'string' ? s.afVisitFrom : undefined, to: typeof s?.afVisitTo === 'string' ? s.afVisitTo : undefined }; }
function markEntry(m: { from?: string; to?: string }) {
  try { const s = history.state && typeof history.state === 'object' ? history.state : {}; history.replaceState({ ...s, ...(m.from ? { afVisitFrom: m.from } : {}), ...(m.to ? { afVisitTo: m.to } : {}) }, ''); } catch { /* the named way back still works in memory */ }
}
/** Called by a relation's own control just before it navigates (a modified click opening a new tab records nothing). */
function follow(far: string, r: { kind: string; note?: string | null | undefined }, e?: Event) {
  const from = herePlace(); const m = e as MouseEvent | undefined; if (!from || (m && (m.ctrlKey || m.metaKey || m.shiftKey || m.altKey || m.button))) return;
  const id = `${visitTab}.${++visitSeq}`;
  markEntry({ from: id });
  pendingVisit = { id, from, to: far, kind: r.kind, note: (r.note ?? '').trim() };
}
/** The visit the selection came by, when its way back is the same scene that the context row's back already names. */
function visitScene(o: Opened): Visit | null {
  const v = visits.at(-1), prev = scenes.at(-1);
  return v && prev && v.from.key === o.key && v.to === selected && v.from.scope !== scope && v.from.scope === prev.scope && v.from.selected === prev.selected ? v : null;
}
function returnFromVisit() {
  const o = opened, v = visits.at(-1); if (!o || !v) return;
  // The entry the relation made is this one: step back in the browser's own history, so Back and Forward keep agreeing.
  if (visitMark().to === v.id) { history.back(); return; }
  visitBack = v.id; go(o.key, v.from.selected, v.from.scope);
}
function restoreReading(f: Place): boolean {
  if (f.key !== opened?.key || f.selected !== selected || f.scope !== scope) return false;
  // AF140: while the change plan is open it owns the pane, as select() has it: a part's lens or sheet is never laid back over it.
  if (planView.isOpen()) return false;
  if (f.surface === 'sheet' && selected === f.selected) { sheetOpen = true; showReading(false, false); }
  // The same part read in another surface since (A0 summary -> B -> A1 sheet, then two steps back): the summary it left.
  else if (f.surface === 'lens' && selected === f.selected && sheetOpen) { sheetOpen = false; editing = false; showReading(false, false); }
  else if (f.surface === 'scope' && !selected) { scopeReading = true; renderScopeLens(); }
  sheetReturn = f.surface === 'sheet' ? f.sheetReturn : null;
  const body = f.surface === 'sheet' ? $('panel').querySelector('.panel-body') : f.surface === 'none' ? null : $('lens').querySelector('.lens-body');
  if (body) {
    const requests = !f.requests || restoreRequestReading(body, f.requests);
    // The same still-current claim in fresh data, never another citation with the same words or list position. Request folds
    // keep their own identities; a changed request does not prevent returning to an unchanged part claim beside it.
    const claim = f.claimFocus ? [...body.querySelectorAll<HTMLButtonElement>('button[data-claim-focus]')].find(b => b.dataset.claimFocus === f.claimFocus) : null;
    if (requests || claim) body.scrollTop = f.scroll;
    claim?.focus({ preventScroll: true });
  }
  return true;
}
function restoreSurface(v: Visit) {
  const f = v.from;
  if (!restoreReading(f)) return;
  // Keyboard: back on the relation it was followed by (without moving the restored reading). Now, while this arrival is the
  // page: never later, when the person may already be typing or reading somewhere else.
  // The surface just restored first (the map title also names a scope's relations); the map title only when nothing reads.
  const far = `[data-far="${CSS.escape(v.to)}"]`, own = f.surface === 'sheet' ? '#panel' : f.surface === 'none' ? null : '#lens';
  ((own && document.querySelector<HTMLElement>(`${own} ${far}`)) || document.querySelector<HTMLElement>(`#world .map-title ${far}`))?.focus({ preventScroll: true });
}
const REL_WHY = (v: Visit) => `‘${REL_LABEL[v.kind] ?? v.kind}’ 관계를 따라 왔어요${v.note ? ` · ${v.note}` : ''}`;
/** '로' or '으로' after a name; '(으)로' where its reading is not known from its last letter. */
function toParticle(name: string): string {
  const c = name.trim().replace(/[^0-9A-Za-z\uac00-\ud7a3]+$/, '').slice(-1), code = c.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) { const jong = (code - 0xac00) % 28; return jong === 0 || jong === 8 ? '로' : '으로'; }
  if (/[0-9]/.test(c)) return '036'.includes(c) ? '으로' : '로';
  // Latin: a vowel, l/r and the endings read with a vowel ('-s' 스, '-x' 스) take 로; m, n, ng take 으로; a stop is unsure.
  if (/ng$/i.test(name.trim()) || /[mn]/i.test(c)) return '으로';
  return /[aeiouylrsxzfhvw]/i.test(c) ? '로' : '(으)로';
}
/** The way back where the reader is looking: one line at the top of the reading pane, after any followed relation (in the
 * same scope or across scopes): the part it was followed from (or the scope, when followed from the scope's own relations) and
 * the scene it sits in. It returns exactly as the context row's back does (scope, selection, camera, surface, scroll); that
 * header back stays for a scene change. */
function visitEntry(o: Opened): HTMLElement | null {
  const v = visits.at(-1); if (!v || v.to !== selected || v.from.key !== o.key) return null;
  const sceneName = (s: string | null) => (s ? partOf(o, s)?.name ?? null : '전체 지도');
  const name = v.from.selected ? partOf(o, v.from.selected)?.name : v.from.scope ? partOf(o, v.from.scope)?.name : o.project.name; if (!name) return null;
  const where = v.from.selected ? sceneName(v.from.scope) : null;
  return h('button', { type: 'button', class: 'visit-line', 'aria-label': `${name}${toParticle(name)} 돌아가기`, title: `${name}${toParticle(name)} 돌아가기 · ${REL_WHY(v)}`, onclick: returnFromVisit },
    h('span', { class: 'vl-arrow', 'aria-hidden': 'true' }, '←'), h('strong', {}, name), h('span', { class: 'vl-came' }, '에서 따라옴'), where ? h('span', { class: 'vl-where' }, where) : null);
}

/** One context row: the composition path (where this view sits), the scope's way up, the way back to the previous scene, and
 * whether the map reads the current state or a change preview. */
function setBar(o: Opened | null) {
  const sep = () => h('span', { class: 'sep', 'aria-hidden': 'true' }, '›');
  const crumbs: Node[] = [h('a', { href: '#/' }, '프로젝트')];
  if (o) {
    const path = scope ? partPath(o.view, scope) : [];
    crumbs.push(sep(), path.length ? h('a', { href: hashFor(o.key, null, null), title: '전체 지도' }, o.project.name) : h('strong', { 'aria-current': 'location' }, o.project.name));
    path.forEach((p, i) => crumbs.push(sep(), i === path.length - 1
      ? h('button', { type: 'button', class: 'crumb-current', 'aria-current': 'location', title: `‘${p.name}’ 설명 보기`, onclick: () => go(o.key, p.id) }, p.name)
      : h('a', { href: hashFor(o.key, null, p.id) }, p.name)));
    if (o.key === UI62_KEY) crumbs.push(h('span', { class: 'tag', title: '공개 commit과 결과 문서에서 사후 편집한 실제 개발 자료예요. 지도는 자료집의 편집 분류이고, 이 탭에서만 남아요.' }, '예제 · 공개 자료'));
    else if (o.key === CONVERTER_KEY) crumbs.push(h('span', { class: 'tag', title: '공개 합성 예제예요. 지도는 작성한 구조이고, 변경 구상은 이 탭에서만 남아요.' }, '예제'));
    else if (o.kind !== 'saved') crumbs.push(h('span', { class: 'tag', title: o.kind === 'example' ? 'Codex·Claude에서 전달받았다고 가정하고 쓴 예제 기록이에요. 저장되지 않아요.' : '' }, o.kind === 'example' ? '예제' : '읽기 전용'));
  }
  $('crumbs').replaceChildren(...crumbs);
  // Scope: up one level of the composition (not the same as going back).
  const sp = o ? partOf(o, scope) : null, bar = $('scope-bar');
  bar.hidden = !sp;
  if (o && sp) {
    const up = sp.parentId ? partOf(o, sp.parentId) : null, upName = up?.name ?? o.project.name;
    bar.replaceChildren(h('button', { type: 'button', class: 'scope-up', onclick: () => go(o.key, null, sp.parentId), title: `구성 위로 · ${upName}`, 'aria-label': `${upName}${toParticle(upName)} 올라가기` },
        h('span', { 'aria-hidden': 'true' }, '↑'), h('span', { class: 'scope-up-name' }, upName)));
  } else bar.replaceChildren();
  // Back: only when the previous scene is not simply the parent.
  const back = $('scene-back'), prev = scenes.at(-1);
  const showBack = !!o && !!prev && prev.scope !== (sp?.parentId ?? null) && !planView.isOpen();
  back.hidden = !showBack;
  if (o && prev && showBack) {
    const name = prev.scope ? partOf(o, prev.scope)?.name ?? o.project.name : '전체 지도';
    back.replaceChildren(h('span', { 'aria-hidden': 'true' }, '←'), h('span', {}, name));
    back.title = `직전 장면으로 · ${name}${prev.selected ? ` · ${partOf(o, prev.selected)?.name ?? ''} 선택` : ''}`;
    // Came here by a relation from that scene: the same one way back, now naming why (and restoring the reading it left).
    const v = visitScene(o);
    if (v) back.title = `${back.title} · ${REL_WHY(v)}`;
  }
  const entry = $('plan-entry'), planning = planView.isOpen();
  $('modebar').hidden = !o || o.kind === 'legacy';
  entry.setAttribute('aria-pressed', String(planning)); entry.classList.toggle('on', planning);
  entry.textContent = '변경 구상';
  const ret = $('return-entry'), reading = returnView.isOpen() && !planView.isOpen();
  ret.setAttribute('aria-pressed', String(reading)); ret.classList.toggle('on', reading);
  ret.title = reading ? '돌아와 읽기 닫기 (Esc)' : '무엇이 달라졌는지 자료로 읽어요';
  entry.title = planning ? '변경 구상 닫기 (Esc) · 초안은 남아요' : '현재 지도 위에서 바꿀 모습을 시험해요';
  document.title = o ? `${o.project.name} · AgentFlow Studio` : 'AgentFlow Studio';
}

/* ---------- home: back to the programs one is making ----------
 * Each program reads by its real composition: its top groups with the first parts inside (a cross-section of the same map it
 * opens to; nothing drawn that the project does not hold). Where this browser remembers the last scope or selection of a saved
 * project, a way to continue there. The model behind the AI is not shown here; it is named where it is used. */
const LAST_KEY = 'agentflow.studio.last.1';
type LastPlace = { scope: string | null; part: string | null; at: string };
function lastPlaces(): Record<string, LastPlace> { try { const v = JSON.parse(kv.getItem(LAST_KEY) ?? '{}'); return v && typeof v === 'object' ? v as Record<string, LastPlace> : {}; } catch { return {}; } }
/** Saved projects only (examples are never stored): where the person was, apart from the project data. */
function rememberPlace() {
  const o = opened; if (!o || o.kind !== 'saved') return;
  try {
    const all = lastPlaces(); all[o.key] = { scope, part: selected, at: new Date().toISOString() };
    const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - 100))) delete all[k];
    kv.setItem(LAST_KEY, JSON.stringify(all));
  } catch { /* a convenience only */ }
}
let openPlanOnArrive = false;
/** A package-like name ('@node-red/runtime') may break after its slashes rather than inside a word. */
const slashBreaks = (name: string): (string | HTMLElement)[] => name.split('/').flatMap((x, i, all) => (i < all.length - 1 ? [`${x}/`, document.createElement('wbr')] : [x]));
/** A quiet monogram for a project card: its first letter on one of six tints, chosen from the name so it stays the same. */
/** Region hues (the map and the home miniature): blue, teal, amber, violet, rose, green, told apart at a faint wash. */
const HUES = [214, 158, 32, 268, 345, 96];
/** A miniature of the project's map on its home card: the top-level parts and regions (one level open), their lines, the spine
 * stronger, drawn as SVG from the very layout the map opens with, so the card shows the map's shape before it is opened. */
function miniMap(v: StudioView): SVGSVGElement | null {
  if (!v.parts.length) return null;
  let L: ScopeLayout;
  try { L = layoutScope(v, null, (_id, depth) => depth < 1, {}, measureName); } catch { return null; }
  const boxes = [...L.boxes.values()].filter(b => b.kind !== 'ghost');
  if (!boxes.length) return null;
  const B = L.bounds, W = 300, H = 120, PAD = 12;
  const k = Math.min((W - 2 * PAD) / Math.max(1, B.w), (H - 2 * PAD) / Math.max(1, B.h), 0.42);
  const ox = PAD + (W - 2 * PAD - B.w * k) / 2 - B.x * k, oy = PAD + (H - 2 * PAD - B.h * k) / 2 - B.y * k;
  const X = (x: number) => (ox + x * k).toFixed(1), Y = (y: number) => (oy + y * k).toFixed(1), S = (n: number) => Math.max(1.5, n * k).toFixed(1);
  const el = (tag: string, attrs: Record<string, string>) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [a, val] of Object.entries(attrs)) e.setAttribute(a, val); return e; };
  const root = el('svg', { class: 'mini-map', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false' }) as SVGSVGElement;
  const hues = new Map<string, number>(); v.roots.forEach((id, i) => hues.set(id, HUES[i % HUES.length]!));
  const byId = new Map(v.parts.map(p => [p.id, p]));
  // Regions under everything, lines over them, cards on top.
  for (const b of boxes.filter(x => x.kind === 'frame').sort((p, q) => p.depth - q.depth)) {
    const hue = hues.get(b.id);
    root.append(el('rect', { class: 'mm-frame', x: X(b.x), y: Y(b.y), width: S(b.w), height: S(b.h), rx: '6', ...(hue !== undefined ? { style: `--hue: ${hue}` } : {}) }));
  }
  for (const e of L.edges) {
    const a = L.boxes.get(e.from), b = L.boxes.get(e.to); if (!a || !b) continue;
    const forward = b.x >= a.x + a.w;
    const x1 = forward ? a.x + a.w : a.x, y1 = a.y + Math.min(a.h, 48) / 2, x2 = forward ? b.x : b.x + b.w, y2 = b.y + Math.min(b.h, 48) / 2;
    const mid = (x1 + x2) / 2;
    root.append(el('path', { class: `mm-edge${e.spine ? ' spine' : ''}`, d: `M${X(x1)} ${Y(y1)} H${X(mid)} V${Y(y2)} H${X(x2)}` }));
  }
  for (const b of boxes.filter(x => x.kind === 'node')) {
    const p = byId.get(b.id), l = p ? ladderOf(v, p) : null, state = l?.check ? 'check' : l?.report ? 'report' : l?.ask ? 'ask' : 'none';
    const g = el('g', { class: `mm-node st-${state}` });
    const hh = Math.min(b.h, 48);
    g.append(el('rect', { x: X(b.x), y: Y(b.y), width: S(b.w), height: S(hh), rx: '3' }));
    g.append(el('rect', { class: 'mm-state', x: (ox + b.x * k + 1.5).toFixed(1), y: (oy + b.y * k + 2).toFixed(1), width: '2', height: Math.max(2, hh * k - 4).toFixed(1), rx: '1' }));
    root.append(g);
  }
  return root;
}
/** The card's one line about the project: its written brief; without one, what the latest map reading said of the whole
 * (marked as the AI's reading, since nobody wrote it); without either, that nothing was written yet. */
function briefLine(p: Project): HTMLElement {
  if (p.space.brief?.text) return h('span', { class: 'program-brief' }, p.space.brief.text);
  const last = [...p.readings].reverse().find(isMapReading);
  if (last?.summary) return h('span', { class: 'program-brief ai', title: 'AI가 기록을 읽고 쓴 요약이에요. 설명은 지도 제목 옆에서 직접 쓸 수 있어요.' }, h('span', { class: 'program-brief-tag' }, 'AI 정리 ·'), ' ', last.summary);
  return h('span', { class: 'program-brief' }, '아직 설명이 없어요.');
}
function programCard(key: string, p: Project, example: boolean, keyOf: (id: string) => string): HTMLElement {
  const v = studioView(p), pasted = p.pasted.at(-1)?.at ?? null, lastAt = [v.records[0]?.at ?? null, pasted].filter((x): x is string => !!x).sort().at(-1) ?? null;
  const changed = v.parts.filter(x => recentAt(x.lastAt)).length;
  // One span per item: the stylesheet draws the separators between them. Pasted records count apart from work records.
  const meta = [`부분 ${v.parts.length}`, v.records.length ? `기록 ${v.records.length}` : '', p.pasted.length ? `붙인 기록 ${p.pasted.length}` : '',
    v.records.length || p.pasted.length ? '' : '기록 없음', lastAt ? ago(lastAt) : '', changed ? `최근 바뀐 부분 ${changed}` : ''].filter(Boolean).map(t => h('span', {}, t));
  const base = `#/p/${encodeURIComponent(key)}`, name = (id: string | null) => (id ? v.parts.find(x => x.id === id)?.name ?? null : null);
  // Continue: only a remembered place whose parts still exist.
  // Old project-id memory cannot identify an imported copy. Its first own visit starts an entry-id memory instead.
  const places = lastPlaces(), imported = store.entries().find(e => e.entryId === key)?.origin === 'import';
  const at = example ? null : places[key] ?? (imported ? null : places[p.id]);
  const cont = at && (at.scope || at.part) && (!at.scope || name(at.scope)) && (!at.part || name(at.part))
    ? h('a', { class: 'program-continue', href: `${base}${at.scope ? `/in/${encodeURIComponent(at.scope)}` : ''}${at.part ? `/${encodeURIComponent(at.part)}` : ''}` },
      h('span', {}, '이어서'), h('strong', {}, name(at.part) ?? name(at.scope)!), h('small', {}, at.part ? (at.scope ? `선택 · ${name(at.scope)} 안` : '선택') : '안쪽 보기'), h('span', { 'aria-hidden': 'true' }, '→')) : null;
  // Cross-section: the top groups in map order, each with the first parts inside; a part with no inside shows its own sentence.
  const roots = v.roots.map(id => v.parts.find(x => x.id === id)!).filter(Boolean);
  const tryReturn = key === UI62_KEY ? h('a', { class: 'program-try', href: base }, h('strong', {}, '돌아와 읽기'), h('span', {}, '공개 개발 자료 10개 · 3단계로 늘려 읽기 · 사후 편집')) : null;
  const tryPlan = key === CONVERTER_KEY ? h('a', { class: 'program-try', href: base, onclick: () => { openPlanOnArrive = true; } }, h('strong', {}, '변경 구상 시험해 보기'), h('span', {}, '폴더째 변환 · 지금과 구상을 같은 자리에서 비교')) : null;
  // The top-level parts in one quiet line (the miniature has no text).
  const rootLine = roots.length ? h('span', { class: 'program-roots', title: roots.map(r => r.name).join(' · ') }, roots.slice(0, 4).map(r => r.name).join(' · '), roots.length > 4 ? ` +${roots.length - 4}` : '') : null;
  const mini = miniMap(v);
  const backup = !example && key !== 'legacy' ? h('button', { type: 'button', class: 'link-button quiet program-backup', title: '붙여넣은 원문 기록과 옮긴 위치를 함께 담은 백업 파일을 내려받아요', onclick: () => saveBackup(key, p) }, '백업 저장') : null;
  return h('li', {}, h('article', { class: `program${example ? ' is-example' : ''}` },
    h('a', { class: 'program-head', href: base, 'aria-label': `‘${p.name}’ 열기` },
      h('span', { class: 'program-mini' }, mini ?? h('span', { class: 'program-mini-empty' }, '아직 지도가 비어 있어요')),
      h('span', { class: 'program-text' }, h('strong', { class: 'program-name' }, p.name), briefLine(p), rootLine, h('span', { class: 'program-meta' }, ...meta)),
      !example && key !== 'legacy' ? runBadgeFor(key) : null),
    cont || tryPlan || tryReturn || backup ? h('div', { class: 'program-foot' }, cont, tryPlan, tryReturn, backup) : null));
}
/** A backup file of a saved entry: the project as kept (pasted records included) and this entry's own manual places, in the
 * existing backup format; ‘백업 가져오기’ reads it back as a new copy. Readings and drafts are not part of it. */
function saveBackup(entryId: string, p: Project) {
  const msg = $('home-message');
  let raw: string;
  try { raw = serializeBackup(p, memoryPositions.get(entryId) ?? readEntryPositions(kv, entryId, p.id)); }
  catch { msg.textContent = '백업 파일을 만들지 못했어요.'; msg.hidden = false; msg.dataset.keep = '1'; return; }
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  a.href = url; a.download = `${p.name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'project'}-백업.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* AF124: a limited release (status.release) says what this version is for and the three ways in, each only on the person's own
 * action: the examples here, a backup file they choose, or the earlier public site at its own address (nothing is sent there or
 * synchronised with it). Drawn in place when the status comes, so a draft or the focus on the home page stays. */
let examplesWanted = false;
function showExamples() {
  if (route().key) { examplesWanted = true; go(null); return; }
  $('examples-title').scrollIntoView({ block: 'start' });
  $('project-list').querySelector<HTMLElement>('a[href]')?.focus({ preventScroll: true });
}
function chooseBackup() { if (route().key) go(null); $<HTMLInputElement>('import-file').click(); }
function releaseActions(first: string): HTMLElement[] {
  return [h('button', { type: 'button', class: first, onclick: () => showExamples() }, '예제로 살펴보기'),
    h('button', { type: 'button', class: 'secondary small', title: '이 브라우저에 새 사본으로 가져와요. 원래 파일은 바뀌지 않아요.', onclick: () => chooseBackup() }, '지도 백업 가져오기'),
    h('a', { class: 'link-button rn-public', href: PUBLIC_EDITION, target: '_blank', rel: 'noopener noreferrer' }, '기존 공개판 열기')];
}
function renderRelease() {
  const box = $('release-note'); if (!box) return;
  if (status.release !== 'existing-map') { box.hidden = true; box.replaceChildren(); return; }
  box.replaceChildren(h('p', { class: 'rn-intro' }, RELEASE_TEXT.intro), h('p', {}, RELEASE_TEXT.limit),
    h('div', { class: 'rn-acts' }, ...releaseActions('primary small')), h('p', { class: 'fine' }, RELEASE_TEXT.move), h('p', { class: 'fine' }, RELEASE_TEXT.apart));
  box.hidden = false;
}

const runBadgeFor = (key: string) => { const el = h('span', { class: 'program-run', 'data-run-entry': key, role: 'status' }); runBadge(el); return el; };
const PC_GUIDE = 'https://github.com/tlsee0813-cmd/agentflow-studio/blob/work/experience142-reading-delivery/docs/USE_STUDIO_KO.md';
const pcGuide = (style = 'link-button') => h('a', { class: style, href: PC_GUIDE, target: '_blank', rel: 'noopener noreferrer' }, 'PC에서 사용하는 방법');
/** The serverless static build is known before status arrives. Its first screen offers a reading example, without promising an
 * AI map from a folder connection. Builds explicitly connected to a Studio API retain their normal entry. */
function renderStaticHome() {
  if (RUNTIME.apiBase !== null) return;
  document.querySelector<HTMLElement>('#home .home-title')!.textContent = '프로젝트 · 정적 체험판';
  document.querySelector<HTMLElement>('#home .home-lede')!.replaceChildren('예제 지도와 근거를 둘러보는 체험판이에요. 이 주소에는 AI가 연결되지 않아 기록을 AI로 정리하지 않아요. 내 세션과 AI를 연결하려면 ', pcGuide(), '을 확인하세요.');
  $('new-open').className = 'secondary';
  const actions = document.querySelector<HTMLElement>('#home .home-actions')!;
  if (!document.getElementById('static-examples')) actions.prepend(h('button', { id: 'static-examples', type: 'button', class: 'primary', onclick: () => showExamples() }, '예제로 살펴보기'));
  document.querySelector<HTMLElement>('#saved-empty .he-title')!.textContent = '예제에서 먼저 살펴보세요';
  document.querySelector<HTMLElement>('#saved-empty .he-lede')!.textContent = '작성된 지도에서 부분·관계·원문 근거를 읽을 수 있어요. 내 기록을 AI로 정리하려면 PC용 Studio를 사용하세요.';
  const example = $('empty-examples'), create = $('empty-new'), acts = document.querySelector<HTMLElement>('#saved-empty .he-acts')!;
  example.className = 'primary small'; create.className = 'secondary small';
  if (!acts.querySelector('a')) acts.append(pcGuide('link-button small'));
  if (acts.firstElementChild !== example) acts.prepend(example);
  const steps = document.querySelectorAll<HTMLElement>('#saved-empty .he-steps li');
  const staticSteps: [string, string][] = [
    ['예제 지도 읽기', '미리 작성된 지도에서 부분과 연결을 둘러봐요.'],
    ['근거와 요청 살펴보기', '부분의 설명에서 원문과 요청문을 오가며 읽어요.'],
    ['내 PC에서 이어가기', 'PC용 Studio에서 내 세션과 AI를 연결해 사용해요.']
  ];
  for (const [i, [title, body]] of staticSteps.entries()) {
    steps[i]!.querySelector('strong')!.textContent = title;
    steps[i]!.querySelector('span:last-child')!.textContent = body;
  }
  document.querySelector<HTMLElement>('#home .home-foot p:last-child')!.replaceChildren('이 정적 체험판은 AI 요청을 보내지 않아요. 내 기록으로 사용하려면 ', pcGuide(), '을 확인하세요. 프로젝트는 이 브라우저·주소에만 저장돼요.');
}
/** My programs lead; the examples show their real composition on a first visit and step back once there is work of one's own. */
function renderHome() {
  setBar(null);
  renderStaticHome();
  $('home').hidden = false; $('space').hidden = true; $('ai-pill').hidden = true;
  const invert = (m: Map<string, string>) => { const r = new Map([...m].map(([k, id]) => [id, k])); return (id: string) => r.get(id) ?? id; };
  let converter: HTMLElement;
  try { if (!examples.has(CONVERTER_KEY)) examples.set(CONVERTER_KEY, buildConverterProject()); const c = examples.get(CONVERTER_KEY)!; converter = programCard(CONVERTER_KEY, c, true, invert(converterKeys(c))); }
  catch { converter = h('li', { class: 'message' }, '예제 ‘문서 변환기’를 만들지 못했어요.'); }
  let material: HTMLElement;
  try { if (!examples.has(UI62_KEY)) examples.set(UI62_KEY, buildUi62Project()); const m = examples.get(UI62_KEY)!; material = programCard(UI62_KEY, m, true, invert(ui62Keys(m))); }
  catch { material = h('li', { class: 'message' }, '예제 ‘AgentFlow UI62 개발 자료’를 만들지 못했어요.'); }
  $('project-list').replaceChildren(converter, ...EXAMPLES.map(spec => {
    const key = `ex-${spec.id}`;
    try { if (!examples.has(key)) examples.set(key, buildExample(spec)); const ex = examples.get(key)!; return programCard(key, ex, true, invert(exampleKeys(spec.id, ex))); }
    catch { return h('li', { class: 'message' }, `‘${spec.name}’ 예제를 만들지 못했어요.`); }
  }), material);
  const saved = store.entries().filter(e => e.state === 'active');
  const cards: HTMLElement[] = [];
  for (const e of saved) { try { cards.push(programCard(e.entryId, e.project, false, id => id)); } catch { cards.push(h('li', { class: 'message' }, `‘${e.project.name}’ 프로젝트를 읽지 못했어요.`)); } }
  if (store.legacy?.project) cards.push(programCard('legacy', store.legacy.project, false, id => id));
  $('saved-list').replaceChildren(...cards);
  $('saved-empty').hidden = !!cards.length;
  $('home').classList.toggle('has-mine', !!cards.length);
  if (examplesWanted) { examplesWanted = false; showExamples(); }
  const msg = $('home-message');
  const problem = store.readError ? '이 브라우저의 저장 공간을 읽지 못해 저장된 프로젝트를 보여 드릴 수 없어요. 저장된 내용은 바꾸지 않았어요.' : null;
  if (problem) { msg.textContent = problem; msg.hidden = false; } else if (!msg.dataset.keep) msg.hidden = true;
}

/** Names measured in the page's own font (whatever the system falls back to), so card widths match what is drawn. */
const measureCache = new Map<string, number>();
const measureName: TextMeasure = (() => {
  const cache = measureCache; let ctx: CanvasRenderingContext2D | null = null, family = '';
  return (text, kind) => {
    const key = `${kind}|${text}`, hit = cache.get(key); if (hit !== undefined) return hit;
    if (!ctx) { ctx = document.createElement('canvas').getContext('2d'); family = getComputedStyle(document.body).fontFamily; }
    if (!ctx) return text.length * 9;
    // The weights of styles.css (--fw-name 590 for names, --fw-body 420 for notes). 'head' serves a region's name (680 14px) and
    // a card's name in a region (590 14.5px): measured at the wider of the two, so neither is given too little room.
    ctx.font = kind === 'node' ? `590 13.5px ${family}` : kind === 'item' ? `590 13px ${family}` : kind === 'head' ? `680 14.5px ${family}` : kind === 'sub' ? `590 13px ${family}` : kind === 'plan' ? `590 12px ${family}` : kind === 'where' ? `590 11px ${family}` : kind === 'meta' ? `500 12px ${family}` : `420 12.5px ${family}`;
    const w = ctx.measureText(text).width; cache.set(key, w); return w;
  };
})();
/* The map's title: the scope's purpose (the project's brief, or the note of the part whose inside is shown), above the map.
 * It belongs to the map, so it moves with it; the layout's bounds include it. */
const TITLE_GAP = 30;
let titleH = 0, core = { x: 0, y: 0, w: 0, h: 0 };
const titleRect = () => ({ x: core.x, y: core.y - titleH - TITLE_GAP, w: Math.min(640, Math.max(360, core.w)), h: titleH });
function withTitle() {
  if (!titleH) return;
  const t = titleRect(), B = core, x = Math.min(B.x, t.x), y = Math.min(B.y, t.y);
  lay.bounds = { x, y, w: Math.max(B.x + B.w, t.x + t.w) - x, h: Math.max(B.y + B.h, t.y + t.h) - y };
}
/** While a change preview reads on the map: the change lines each part's own row shows (plan-view decides; the layout only
 * makes room for them on those parts). null in the current view, so the current map keeps its own sizes. */
let planRows: Map<string, string[]> | null = null, planRowsKey = '';
/** The shape of the room a first view has for its parts (the window's map without the header, the title above the parts and
 * the margins; never the reading pane): what an unlinked block of parts is balanced against. */
const mapAspect = () => Math.max(1, Math.min(3, (window.innerWidth - 48) / Math.max(240, window.innerHeight - 252)));
/** Places held for the view at hand (holdPlaces): the automatically placed boxes keep where they are while a part is dragged
 * and until the next redraw, over the stored places but never written to them. */
let held: Positions | null = null;
const heldPositions = (o: Opened): Positions => {
  const pos = positionsOf(o); if (!held) return pos;
  const out: Positions = {};
  for (const c of new Set([...Object.keys(held), ...Object.keys(pos)])) out[c] = { ...(held[c] ?? {}), ...(pos[c] ?? {}) };
  return out;
};
const relayout = (o: Opened) => { const budgets = new Map<string, CardBudget>(); lay = layoutScope(o.view, scope, isExpanded(o), heldPositions(o), measureName, planRows ?? undefined, mapAspect(), typedRoom(o.view, budgets)); cardBudgets = budgets; core = { ...lay.bounds }; withTitle(); };

/** Two real parts with one name under one parent ('Types' and 'Types'): told apart by the first clause of their own note, as
 * written ('원명 extHostTypes.ts'), only where the name is really ambiguous. Never merged, renamed or guessed: null when the name
 * is not shared, or when their own words do not tell them apart. */
function aliasOf(v: StudioView, id: string): string | null {
  const p = v.parts.find(x => x.id === id); if (!p) return null;
  const sibs = (p.parentId ? v.parts.find(x => x.id === p.parentId)?.childIds ?? [] : v.roots).filter(x => x !== id && v.parts.find(y => y.id === x)?.name === p.name);
  if (!sibs.length) return null;
  const clause = (t: string) => { const n = t.replace(/\s+/g, ' ').trim(), m = /^(.+?)(?:[:;：]|[.。](?=\s|$))/.exec(n); return (m ? m[1]! : n).trim().slice(0, 60); };
  const mine = clause(p.note);
  return mine && !sibs.some(x => clause(v.parts.find(y => y.id === x)?.note ?? '') === mine) ? mine : null;
}
/** The ladder a part's records climb, lit as far as they go: a request recorded, a report of work, a check (a test or an
 * inspection, or a reading that found the thing checked). Read over the part and everything under it. "Reported" is not
 * "checked": the two rungs differ in colour. */
function ladderOf(view: StudioView, p: PartView): { ask: boolean; report: boolean; check: boolean } {
  const recs = subtreeRecords(view, p.id), claims = p.reading?.claims ?? [];
  const ask = recs.some(r => r.kind === 'request') || claims.some(c => c.kind === 'want'), report = recs.some(r => r.kind === 'report' || r.kind === 'answer') || claims.some(c => c.kind === 'reported');
  const check = recs.some(r => r.kind === 'evidence') || claims.some(c => c.kind === 'checked');
  return { ask, report, check };
}
function ladder(view: StudioView, p: PartView): HTMLElement {
  const { ask, report, check } = ladderOf(view, p);
  const steps: [string, string, boolean][] = [['요청', 'ask', ask], ['보고', 'report', report], ['확인', 'check', check]];
  const said = steps.map(([n, , on]) => `${n} ${on ? '있음' : '없음'}`).join(' · ');
  return h('span', { class: 'ladder', role: 'img', 'aria-label': said, title: said }, ...steps.map(([, k, on]) => h('i', { class: `rung r-${k}${on ? ' on' : ''}` })));
}
/** The ladder read in words beside the rungs (the lens head): how far the records of this part go. */
function ladderLine(view: StudioView, p: PartView): HTMLElement {
  const el = ladder(view, p), lit = [...el.querySelectorAll('.rung.on')].map(r => r.className);
  const check = lit.some(c => c.includes('r-check')), report = lit.some(c => c.includes('r-report')), ask = lit.some(c => c.includes('r-ask'));
  const words = check ? (report ? '요청 · 보고 · 확인까지 있음' : '확인한 기록이 있음') : report ? (ask ? '요청과 보고가 있음 · 아직 확인 전' : '했다는 보고가 있음 · 아직 확인 전') : ask ? '요청만 있음 · 보고 전' : '요청·보고·확인 기록이 아직 없음';
  return h('p', { class: 'lens-ladder' }, el, h('span', {}, words));
}
/** The lens head's state line (map-reading.7): the state the newest reading that gave one reads for the part, in the record's own
 * word, the grade of the line that says it (the author's tag in that line, when it has one) and when the record says so (else
 * when the reading was made). Never a status the app verified; null when no reading gave one (the ladder line stands instead). */
function stateLine(p: PartView): HTMLElement | null {
  const s = p.reading?.stateRead; if (!s) return null;
  const ev = claimEvidence({ quote: s.quote?.quote ?? '' });
  const words = [STATE_WORD[s.state], ev ? EVIDENCE_LABEL[ev] : null, s.when ? `${s.when} 기준` : `정리 ${ago(s.at)}`].filter(Boolean).join(' · ');
  return h('p', { class: `lens-state st-${s.state}`, ...(s.quote ? { title: `기록의 말 · “${s.quote.quote}”` } : {}) },
    h('i', { class: 'dot', 'aria-hidden': 'true' }), h('span', {}, words));
}
/** A part's line on the map: the state only when it says something. 'plan' (no request yet) stays quiet here; the inspector
 * still tells "no records" apart from "a planned note only". */
function metaLine(p: PartView, last: string | null): string | null {
  // No request of its own yet: what the records said about it (one short state), never a verified status.
  if (p.status === 'plan') return p.reading ? stateLabel(p.reading) : null;
  return `${STATUS_SHORT[p.status]}${last ? ` · ${ago(last)}` : ''}`;
}

/* ---------- a card's typed body (map spec 2.1): the record's type word over the name, one operations line, what the part
 * takes and hands over, one structural region by family and one setting. Only what readings said; a blank says so in place. */
/** The operations line (ops-line): the newest reading's state for the part, as a report with the time the record gives, short
 * where the day is the map's basis day ('가동 보고 · 08:49Z · 현재 미확인'), in plain text; its brief form for a narrow card
 * and its tip (the time as written). Never a status the app saw, never made from "built" or "designed". */
function opsOf(r: PartUnderstanding): { full: string; brief: string; tip: string } {
  const s = r.stateRead;
  return opsLines(s?.state ?? null, s?.when ?? null, opsRef);
}
/** The day an operations line's time is read against: the newest map reading's basis time, else today (UTC, as records write Z). */
let opsRef: string | null = null;
const opsDay = (o: Opened) => [...o.project.readings].reverse().find(isMapReading)?.basisAt ?? new Date().toISOString().slice(0, 10);
/** Each drawn operations line's two forms: fitOps keeps the full one unless it overflows its card. */
const opsFit = new WeakMap<HTMLElement, { full: string; brief: string }>();
/** After the cards have their widths: an operations line that does not fit reads '현재 ?' (its tip keeps the whole line). */
function fitOps(world: HTMLElement) {
  const rows = [...world.querySelectorAll<HTMLElement>('.node .meta-text.ops')].map(el => {
    const meta = el.parentElement!, lad = meta.querySelector<HTMLElement>('.ladder');
    return { el, room: meta.clientWidth - (lad ? lad.offsetWidth + 6 : 0) };
  });
  for (const { el, room } of rows) { const f = opsFit.get(el); if (f && room > 0) el.textContent = measureName(f.full, 'meta') > room ? f.brief : f.full; }
}
/* The map's zoom levels (card-budget zoomLevel, spec 4): 개요 keeps a typed card's head and operations line, 중간 its port
 * lines too, 상세 everything. Below Z_MID names read on one line (styles.css z-mid), so such a card is as high as one name
 * line. The layout is made for the level at hand (relayout records it); a zoom that changes it draws the map again. */
const Z_MID = 0.705;
const levelKey = (k: number) => `${zoomLevel(k)}|${k < Z_MID ? 1 : 0}`;
let cardLevel: ZoomLevel = 'detail', cardOneLine = false, laidKey = '', relevel = 0, lastFresh = 0;
type BodyRegion = { kind: 'store'; fields: string[] } | { kind: 'loop' | 'timer' | 'actor'; mark: string | null; text: string };
/** used: the setting the family's region already names (a loop's beat, a timer's schedule); the setting line shows another. */
interface Typed { family: PartFamily | 'neutral'; body: BodyRegion | null; setting: string | null; used: string | null }
function typedOf(r: PartUnderstanding): Typed {
  const t = r.typeRead?.type ?? null, family = t ? FAMILY_OF[t] : 'neutral', cfg = r.config;
  let body: BodyRegion | null = null, used: string | null = null;
  if (family === 'store') body = { kind: 'store', fields: r.fields };
  // A loop's frame names the unit the record gives for its repeat (map-reading.9), else its beat among the settings.
  else if (family === 'loop') { const lb = loopBody(r.loop?.unit, cfg); used = lb.used; body = { kind: 'loop', mark: null, text: lb.text }; }
  else if (family === 'timer') { used = cfg[0] ?? null; body = { kind: 'timer', mark: '⏱︎', text: used ?? '일정 ?' }; }
  else if (t === 'actor') body = { kind: 'actor', mark: null, text: r.outputs[0] ? `효과 ▸ ${r.outputs[0]}` : '효과 ?' };
  // Other kinds draw no region of their own: their first setting reads on the setting line instead.
  return { family, body, setting: cfg.find(c => c !== used) ?? null, used };
}
/** What a unit's typed lines are before the six-line budget (card-budget) decides which of them the card keeps, at the zoom
 * level the layout is made for. The name is drawn on two lines at most (.node-name), so a longer measure counts as two. */
const budgetOf = (t: Typed, r: PartUnderstanding, nameLines: number, chips: ChipsAt = 'none', level: ZoomLevel = cardLevel, entry: EntryKind = 'none'): CardBudget =>
  typedBudget(Math.min(2, nameLines), !!t.setting, r.inputs.length > 0, r.outputs.length > 0, !!t.body, chips, level, entry);
const bodyKind = (t: Typed): BodyKind => t.body?.kind ?? null;
/** The budgets of the units the last layout typed (relayout): such a card is drawn with the lines its budget kept and without
 * its note (map spec 2.1: the note reads in the pane). A unit missing here draws as before. */
let cardBudgets = new Map<string, CardBudget>();
/** The room a card's typed lines need past what map-layout already counts (layoutScope's extra): the type word over the name,
 * the operations line where the layout kept no state line, and on a unit the typed lines (each run after the card's own gap,
 * 3px on a unit and 2px on a row). A unit with a type word or typed lines answers as a typed card: its lines are kept within
 * the six-line budget for the lines its name takes (budgets records what each kept). A part no reading spoke of takes none; a
 * list item keeps its one line. */
function typedRoom(v: StudioView, budgets?: Map<string, CardBudget>): (id: string, face: Face) => number | TypedCard {
  const byId = new Map(v.parts.map(p => [p.id, p])), names = new Map<string, number>();
  for (const p of v.parts) names.set(p.name, (names.get(p.name) ?? 0) + 1);
  return (id, face) => {
    const p = byId.get(id), r = p?.reading; if (!p || !r || face === 'item') return 0;
    const t = typedOf(r), gap = face === 'unit' ? 3 : 2;
    let px = r.typeRead ? TYPE_H + gap : 0;
    // map-layout keeps a state line only for a part with a status, a state or a repeated name (its measure's extra).
    if (p.status === 'plan' && !r.state && (names.get(p.name) ?? 0) < 2) px += gap + (face === 'unit' ? 2 : 0) + LINE_H;
    // Whether the card is typed does not change with the zoom level (its width stays UNIT_W); only its lines do.
    if (face !== 'unit' || (!r.typeRead && !typedLines(budgetOf(t, r, 1, 'none', 'detail'), bodyKind(t)).length)) return px;
    const kids = p.childIds.length > 0, entry = entryKind(entryCountsOf(p, r), shownMost(t, r));
    return { oneLine: cardOneLine, room: (nameLines, chipsLine) => {
      const b = budgetOf(t, r, nameLines, kids ? (chipsLine ? 'line' : 'name') : 'none', cardLevel, entry); budgets?.set(id, b);
      return px + typedPx(b, bodyKind(t), gap);
    } };
  };
}
/** Lists drawn on one line: as many names as the card's inner width holds (two, three on a ledger), then '+N'. Fitted once the
 * card has its width (fitTyped), so a name is cut only when not even one fits. A folded port line (outs) carries 내는 것 after
 * 받는 것 on the same line ('⇥ a · b  ⇤ c'); short of room it gives up 내는 것's names first ('⇤ +N'), then 받는 것's. */
interface FitList { names: string[]; max: number; cells: boolean; outs?: string[] }
const fitLists = new WeakMap<HTMLElement, FitList>();
const listText = (names: string[], k: number) => { const rest = names.length - k; return [...names.slice(0, k), ...(rest > 0 ? [`+${rest}`] : [])].join(' · '); };
const foldText = (ins: string[], k: number, outs: string[], ko: number) => `${listText(ins, k)}  ⇤ ${ko ? listText(outs, ko) : `+${outs.length}`}`;
function fillNames(el: HTMLElement, names: string[], k: number, cells: boolean) {
  const rest = names.length - k;
  if (cells) el.replaceChildren(...names.slice(0, k).map(n => h('span', { class: 'ledger-cell' }, n)), ...(rest > 0 ? [h('span', { class: 'ledger-more' }, `+${rest}`)] : []));
  else el.textContent = listText(names, k);
}
function fitList(el: HTMLElement, names: string[], max: number, cells: boolean): HTMLElement {
  const k = Math.min(max, names.length); fitLists.set(el, { names, max: k, cells }); fillNames(el, names, k, cells); return el;
}
/** The arrow mark's column (.io-mark 14px + 4px gap) and a ledger cell's sides (6px padding a side + its 1px rule). */
const MARK_W = 18, CELL_SIDES = 13;
function namesWidth(f: { names: string[]; cells: boolean }, k: number): number {
  const rest = f.names.length - k, more = rest > 0 ? `+${rest}` : '';
  if (f.cells) return f.names.slice(0, k).reduce((a, n) => a + measureName(n, 'note') + CELL_SIDES, 0) + (more ? measureName(more, 'note') + CELL_SIDES : 0);
  return measureName(listText(f.names, k), 'note');
}
/** After the cards have their widths: every card's inner width read first, then each list refilled (one layout pass). */
function fitTyped(world: HTMLElement) {
  const cards = [...world.querySelectorAll<HTMLElement>('.node-typed')].map(el => {
    const b = lay.boxes.get(el.closest<HTMLElement>('.node')?.dataset.box ?? '');
    return { el, w: el.closest<HTMLElement>('.node-text')?.clientWidth || (b ? b.w - 30 : 0) };
  });
  for (const { el, w } of cards) el.querySelectorAll<HTMLElement>('.io-text, .ledger').forEach(t => {
    const f = fitLists.get(t); if (!f || !w) return;
    const room = w - (f.cells ? 0 : MARK_W);
    if (f.outs) {
      const outs = f.outs; let k = f.max, ko = Math.min(2, outs.length);
      while (measureName(foldText(f.names, k, outs, ko), 'note') > room) { if (ko > 0) ko--; else if (k > 1) k--; else break; }
      t.textContent = foldText(f.names, k, outs, ko); return;
    }
    let k = f.max; while (k > 1 && namesWidth(f, k) > room) k--;
    fillNames(t, f.names, k, f.cells);
  });
}
const ioLine = (cls: string, mark: string, what: string, names: string[]) => h('span', { class: `node-io ${cls}`, title: `${what} · ${names.join(' · ')}` },
  h('span', { class: 'io-mark', 'aria-hidden': 'true' }, mark), h('span', { class: 'sr-only' }, `${what} `), fitList(h('span', { class: 'io-text' }), names, 2, false));
/** 받는 것 and 내는 것 on one line (a long name left room for one port line): ⇥ what it takes, then ⇤ what it hands over. */
function foldLine(ins: string[], outs: string[]): HTMLElement {
  const text = h('span', { class: 'io-text' }), k = Math.min(2, ins.length), ko = Math.min(2, outs.length);
  fitLists.set(text, { names: ins, max: k, cells: false, outs }); text.textContent = foldText(ins, k, outs, ko);
  return h('span', { class: 'node-io io-in io-fold', title: `받는 것 · ${ins.join(' · ')}\n내는 것 · ${outs.join(' · ')}` },
    h('span', { class: 'io-mark', 'aria-hidden': 'true' }, '⇥'), h('span', { class: 'sr-only' }, `받는 것 ${ins.join(', ')} · 내는 것 ${outs.join(', ')} `), text);
}
/** A unit's typed lines under its operations line: 받는 것, 내는 것, the family's region, one setting; with a budget (the
 * layout's six-line budget for this card), only the lines it kept. */
function typedBlock(t: Typed, r: PartUnderstanding, budget?: CardBudget, entry?: HTMLElement | null): HTMLElement | null {
  const lines: HTMLElement[] = [], io = budget?.io ?? (r.inputs.length && r.outputs.length ? 'both' : r.inputs.length ? 'in' : r.outputs.length ? 'out' : 'none');
  if (io === 'fold') lines.push(foldLine(r.inputs, r.outputs));
  else if (io !== 'none') { // 'none': no port line recorded, or none kept at this zoom level (개요)
    if (r.inputs.length && io !== 'out') lines.push(ioLine('io-in', '⇥', '받는 것', r.inputs));
    if (r.outputs.length && io !== 'in') lines.push(ioLine('io-out', '⇤', '내는 것', r.outputs));
  }
  const b = budget && !budget.body ? null : t.body;
  // A store reads as a ledger: a double rule over the names of its rows' fields (never a count of rows it does not know).
  if (b?.kind === 'store') lines.push(h('span', { class: 'node-body b-store', ...(b.fields.length ? { title: `행의 필드 · ${b.fields.join(' · ')}` } : {}) },
    b.fields.length ? fitList(h('span', { class: 'ledger' }), b.fields, 3, true) : h('span', { class: 'ledger blank' }, '행 형식 ?')));
  else if (b) lines.push(h('span', { class: `node-body b-${b.kind}`, title: b.text }, b.mark ? h('span', { class: 'body-mark', 'aria-hidden': 'true' }, b.mark) : null, h('span', { class: 'body-text' }, b.text)));
  if (t.setting && (budget?.set ?? true)) lines.push(h('span', { class: 'node-set', title: `설정 · ${t.setting}` }, `설정 · ${t.setting}`));
  if (entry) lines.push(entry);
  return lines.length ? h('span', { class: 'node-typed' }, ...lines) : null;
}

/* ---------- 동작 열기 (map spec 4): one action, a scale the app decides, three moves back ----------
 * A double-click on a card a reading spoke of, Enter on the selected card or the entry line's 열기 opens what the part holds.
 * The short expansion opens it over the card and the empty space beside it (expansion.ts placeExpansion: the whole content within
 * 420×280 at the default size, covering no other part, label, drawn line or group boundary); no other box moves and the camera
 * stays. Otherwise the detail view: the part's boundary in the middle of the workspace, what it takes on the left and hands over
 * on the right, its outside partners as small reference cards (the same parts; opening one opens its own detail). Nothing is
 * shrunk, left out, moved aside or rerouted to make the short expansion fit. */
/** The steps a part records (map-reading.9 steps[], newest reading first by name; none before .9). The one place that reads
 * them: the entry line ('기록된 단계 M'), the content both openings measure and show, the detail view's chain and the pane. */
const stepsOf = (r: PartUnderstanding): ActionStep[] => r.steps ?? [];
const entryCountsOf = (p: PartView, r: PartUnderstanding): EntryCounts => ({ read: true, kids: p.childIds.length, steps: stepsOf(r).length, inputs: r.inputs.length, outputs: r.outputs.length, fields: r.fields.length, config: r.config.length, state: r.stateVars?.length ?? 0, loop: !!r.loop });
/** The most a collapsed card names of each list: its setting line and its region's beat or schedule; three ledger cells. */
const shownMost = (t: Typed, r: PartUnderstanding): EntryShown => ({ config: (t.setting ? 1 : 0) + (t.used ? 1 : 0), fields: t.body?.kind === 'store' ? Math.min(3, r.fields.length) : 0 });
/** What the card names under the budget it was drawn with (the setting and the region kept or not at this level). */
const shownBy = (t: Typed, r: PartUnderstanding, b: CardBudget): EntryShown => ({ config: (b.set && t.setting ? 1 : 0) + (b.body && t.used ? 1 : 0), fields: b.body && t.body?.kind === 'store' ? Math.min(3, r.fields.length) : 0 });
/** The entry line under a typed card's body: '구성 N' (the way into its composition, as the 안쪽 chip is), '기록된 단계 M', each
 * list the card does not name in full by its total, and 열기; '내부 미상' when its reading names nothing inside. */
function entryLine(o: Opened, p: PartView, r: PartUnderstanding, t: Typed, b: CardBudget): HTMLElement | null {
  const c = entryCountsOf(p, r), words = entryParts(c, shownBy(t, r, b)); if (!words.length) return null;
  if (words[0] === '내부 미상') return h('span', { class: 'node-entry unknown', title: '기록이 이 부분의 받는 것·내는 것·필드·설정·구성·단계를 하나도 말하지 않았다' }, '내부 미상');
  const parts: HTMLElement[] = [];
  words.forEach((w, i) => {
    if (i) parts.push(h('span', { class: 'entry-sep', 'aria-hidden': 'true' }, ' · '));
    parts.push(c.kids && i === 0 ? h('button', { type: 'button', class: 'entry-kids', title: `구성 열기 · ‘${p.name}’의 실제 하위 부분 ${c.kids}`, 'aria-label': `${p.name} 구성 열기 · 하위 부분 ${c.kids}`, onclick: () => go(o.key, null, p.id) }, w) : h('span', { class: 'entry-part' }, w));
  });
  return h('span', { class: 'node-entry' }, h('span', { class: 'entry-text' }, ...parts),
    h('button', { type: 'button', class: 'entry-open', title: '동작 열기 · 제자리에 들어가면 펼치고, 들어가지 않으면 내부 상세로 연다 (두 번 누르기 · 선택 후 Enter)', 'aria-label': `${p.name} 동작 열기`, onclick: () => openAction(p.id) }, '열기'));
}
/** Which part is open and how; the way back (이전 읽기 위치); an opening waiting for its selection; one read back after a reload. */
let openState: OpenState | null = null, backStack: ReadPlace[] = [], pendingAction: string | null = null, restoreOpen: OpenState | null = null;
/** The short expansion's place on the map (labels keep off it), and what the detail view was last drawn for. */
let shortRect: Rect | null = null, detailFor: { part: string; view: StudioView; back: number } | null = null, syncTimer = 0;
const openable = (o: Opened, id: string) => { const b = lay.boxes.get(id); return !!b && b.kind === 'node' && !!partOf(o, id)?.reading; };
function saveOpen() { const o = opened; if (o) writeOpenState(kv, viewKeyOf(o), openState ? { part: stableId(o, openState.part), mode: openState.mode } : null); }
function storedOpen(o: Opened): OpenState | null { const s = readOpenState(kv, viewKeyOf(o)); return s ? { part: liveId(o, s.part), mode: s.mode } : null; }
const herePlaceRead = (): ReadPlace => ({ camera: { x: camera.x, y: camera.y, k: camera.k }, scope, selected, level: zoomLevel(camera.k), open: openState ? { ...openState } : null });
function openAction(id: string) {
  const o = opened; if (!o || !openable(o, id)) return;
  if (selected !== id) { pendingAction = id; go(o.key, id); return; }
  if (openState?.part === id && openState.mode === 'short' && shortRect) return;
  const at = shortFit(id);
  if (at) { openState = { part: id, mode: 'short' }; saveOpen(); hideDetail(); drawShort(id, at, true); }
  else { openDetail(id, true); const v = document.getElementById('detail'); if (v) v.dataset.measured = lastMeasured.map(x => `${x.w}x${x.h}`).join(' '); }
}
/** The words of one stored relation's line, as lineWord reads a drawn one: data what it hands over, control what starts it. */
function relWord(r: RelationView, ch: Channel | null, s: LineSaid | undefined): string {
  if (ch === 'data') return s?.payload ?? REL_LABEL[r.kind] ?? r.kind;
  if (ch === 'control') { const c = s?.cadence ?? s?.payload; return c ? `기동 · ${c}` : '제어'; }
  if (ch === 'uses') return '참조';
  return REL_LABEL[r.kind] ?? r.kind;
}
const stateWords = (r: PartUnderstanding) => { const s = r.stateRead; return s ? [STATE_WORD[s.state], s.when ? `${s.when} 기준` : null].filter(Boolean).join(' · ') : null; };
/** An opened part's sections (expansion actionSections), each list whole. In the detail view 받는 것 and 내는 것 are its ports, and
 * its steps, loop and kept state read in the boundary's own chain (renderDetail), so they are not repeated here. The short
 * expansion numbers the steps, one line each: the name, then what it does in the secondary colour, cut with an ellipsis (the
 * whole step in its title); the loop line and the kept state as lines. */
function actionBody(p: PartView, detail: boolean): HTMLElement[] {
  const r = p.reading; if (!r) return [];
  return actionSections({ inputs: detail ? [] : r.inputs, outputs: detail ? [] : r.outputs, fields: r.fields, config: r.config, state: detail ? stateWords(r) : null,
    steps: detail ? [] : stepsOf(r), loop: detail ? null : r.loop, stateVars: detail ? [] : r.stateVars ?? [] }).map(sec =>
    h('section', { class: `xp-sec x-${sec.key}` }, h('h4', { class: 'xp-title' }, sec.title, sec.key === 'loop' ? null : h('small', {}, String(sec.items.length))),
      sec.kind === 'steps' ? h('ol', { class: 'xp-steps' }, ...sec.items.map((x, i) => { const does = sec.subs?.[i] ?? null;
        return h('li', { title: does ? `${x} — ${does}` : x }, h('span', { class: 'xp-n', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'xp-step' }, x), does ? h('span', { class: 'xp-does' }, does) : null); }))
      : sec.kind === 'cells' ? h('div', { class: 'xp-cells' }, ...sec.items.map(x => h('span', { class: 'ledger-cell' }, x)))
        : sec.kind === 'words' ? h('p', { class: 'xp-words' }, ...sec.items.flatMap((x, i) => [i ? h('span', { class: 'xp-dot', 'aria-hidden': 'true' }, ' · ') : null, h('span', { class: 'xp-word' }, x)]).filter((x): x is HTMLElement => !!x))
          : h('ul', { class: 'xp-lines' }, ...sec.items.map(x => h('li', {}, x)))));
}
/** The short expansion's content: the type word and the name as on the card, its operations line, then every list whole. */
function shortContent(p: PartView): HTMLElement[] {
  const r = p.reading!, ops = opsOf(r);
  return [h('div', { class: 'xp-head' }, r.typeRead ? h('span', { class: 'node-type' }, TYPE_LABEL[r.typeRead.type]) : null,
    h('div', { class: 'xp-headline' }, h('strong', { class: 'xp-name' }, p.name), h('button', { type: 'button', class: 'xp-close', title: '닫기 (Esc)', 'aria-label': `${p.name} 펼침 닫기`, onclick: () => closeOpen(true) }, '×')),
    h('span', { class: 'xp-ops', title: ops.tip }, ops.full)), ...actionBody(p, false)];
}
/** Where the short expansion of a drawn card goes, or null (the detail view instead). Its content is laid out beforehand at the
 * default size, at the card's width and wider up to 420px; the obstacles are every other box, the ghosts' heads, the title, every
 * placed label and the lone parts' caption; the lines are the drawn ones; it stays inside the group it sits in. */
function shortFit(id: string): Rect | null {
  const o = opened, b = lay.boxes.get(id), p = o ? partOf(o, id) : null; if (!o || !b || b.kind !== 'node' || !p?.reading) return null;
  const world = $('world'), host = h('div', { class: 'expansion measuring', 'aria-hidden': 'true' }, ...shortContent(p));
  world.append(host);
  const sizes: { w: number; h: number }[] = [];
  for (const w of [...new Set([Math.ceil(b.w), 330, SHORT_W])].filter(x => x >= b.w && x <= SHORT_W)) {
    host.style.width = `${w}px`; if (host.scrollWidth <= w + 1) sizes.push({ w, h: host.offsetHeight });
  }
  host.remove();
  lastMeasured = sizes;
  const anc = new Set<string>(); for (let c: string | undefined = b.container, g = 0; c && g < 64; c = lay.boxes.get(c)?.container, g++) anc.add(c);
  const obstacles: Rect[] = [...lay.boxes.values()].filter(x => x.id !== id && !anc.has(x.id)).map(x => ({ x: x.x, y: x.y, w: x.w, h: x.h }));
  for (const x of lay.heads) obstacles.push({ x: x.x, y: x.y, w: x.w, h: x.h });
  if (titleH) obstacles.push(titleRect());
  const inv = labelInv();
  world.querySelectorAll<HTMLElement>('.edge-labels > *, .lone-head').forEach(el => {
    if (!el.offsetWidth) return; const k = el.classList.contains('lone-head') ? 1 : inv;
    obstacles.push({ x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0, w: el.offsetWidth * k, h: el.offsetHeight * k });
  });
  const box = lay.boxes.get(b.container), free = [box?.kind === 'frame' ? groupBody(box) : OPEN_MAP];
  const shown = shownLines(), lines = [...lastRouted.values()].filter(r => shown.has(r.key)).map(r => r.pts);
  return placeExpansion(sizes, b, free, obstacles, lines);
}
/** The sizes the last opening measured (read in a browser check through the expansion's data-measured). */
let lastMeasured: { w: number; h: number }[] = [];
function dropShort() { document.querySelectorAll('#world .expansion').forEach(el => el.remove()); shortRect = null; }
/** The short expansion over the card: from the card's own rectangle to its place in 200ms (none with reduced motion). */
function drawShort(id: string, at: Rect, animate: boolean) {
  const o = opened, p = o ? partOf(o, id) : null, b = lay.boxes.get(id); if (!o || !p || !b) return;
  document.querySelectorAll('#world .expansion').forEach(el => el.remove());
  const fam = p.reading?.typeRead ? FAMILY_OF[p.reading.typeRead.type] : 'neutral';
  const el = h('div', { class: `expansion f-${fam}`, role: 'region', 'aria-label': `${p.name} 펼침`, tabindex: '-1', 'data-open': id, 'data-measured': lastMeasured.map(s => `${s.w}x${s.h}`).join(' ') }, ...shortContent(p));
  const put = (r: Rect) => { el.style.left = `${r.x}px`; el.style.top = `${r.y}px`; el.style.width = `${r.w}px`; el.style.height = `${r.h}px`; };
  // Reading it never pans the map, starts a drag or clears the selection.
  el.addEventListener('pointerdown', e => e.stopPropagation());
  const motion = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  shortRect = at; put(motion ? b : at); $('world').append(el);
  if (motion) { void el.offsetWidth; el.classList.add('grow'); put(at); window.setTimeout(() => el.classList.remove('grow'), 260); }
  if (animate) el.focus({ preventScroll: true });
}
function openDetail(id: string, push: boolean) {
  const o = opened; if (!o || !partOf(o, id)) return;
  if (push) backStack = pushPlace(backStack, herePlaceRead());
  openState = { part: id, mode: 'detail' }; saveOpen(); dropShort();
  if (selected === id) { renderDetail(id); return; }
  // The map under it selects the same part (the reading pane reads it), in this view when it is drawn or inside it.
  go(o.key, id, id === scope || insideScope(o, id) ? scope : partOf(o, id)!.parentId);
}
/** 이전 읽기 위치: the camera, scope, selection, zoom level and open state before the last opening of a detail view. */
function goBackPlace() {
  const o = opened, pl = backStack.at(-1); if (!o || !pl) return;
  backStack = backStack.slice(0, -1);
  openState = pl.open ? { ...pl.open } : null; saveOpen(); detailFor = null;
  if (!openState) hideDetail();
  returnCamera = { ...pl.camera };
  go(o.key, pl.selected, pl.scope);
}
/** 상위 구성: the detail view of the part that really holds this one (containment), when there is one. */
function goUp() { const o = opened, p = o && openState ? partOf(o, openState.part) : null; if (p?.parentId) openDetail(p.parentId, true); }
/** 닫기: the opening only (the short expansion or the detail view); the selection, the camera and the way back stay. */
function closeOpen(focus = false) {
  const st = openState; openState = null; saveOpen(); dropShort(); hideDetail();
  if (focus && st) window.setTimeout(() => document.querySelector<HTMLElement>(`#world [data-drag="${CSS.escape(st.part)}"]`)?.focus({ preventScroll: true }), 0);
}
function hideDetail() {
  const v = document.getElementById('detail'); detailFor = null;
  if (v && !v.hidden) { v.hidden = true; v.replaceChildren(); }
  $('space').classList.remove('detail-open');
  const vp = $('viewport');
  if (vp.dataset.detailInert) { delete vp.dataset.detailInert; if (!vp.dataset.readingInert && !($('plan-panel').classList.contains('work') && !$('plan-panel').hidden)) vp.inert = false; }
}
/** After a redraw or an arrival: the opening drawn again where it belongs (a timer, so the selection's lines and labels are
 * placed first, and a hidden page still draws). A short expansion that no longer fits closes; it never becomes the detail view
 * by itself, nor does a zoom open anything. */
function syncOpenSoon() { clearTimeout(syncTimer); syncTimer = window.setTimeout(syncOpen, 0); }
function syncOpen() {
  const o = opened, st = openState;
  if (!o || !st || !partOf(o, st.part)) { if (o && st) { openState = null; saveOpen(); } dropShort(); hideDetail(); return; }
  if (st.mode === 'detail') { dropShort(); if (!detailFor || detailFor.part !== st.part || detailFor.view !== o.view || detailFor.back !== backStack.length) renderDetail(st.part); return; }
  hideDetail();
  if (selected !== st.part) { closeOpen(false); return; }
  const had = shortRect; shortRect = null;
  const at = shortFit(st.part); if (!at) { closeOpen(false); return; }
  if (!had || had.x !== at.x || had.y !== at.y || had.w !== at.w || had.h !== at.h || !document.querySelector('#world .expansion')) drawShort(st.part, at, false); else shortRect = at;
}
/** At the end of an arrival: an open state read back after a reload, then an opening that waited for its selection. */
function afterRenderOpen(o: Opened) {
  const st = restoreOpen; restoreOpen = null;
  if (st && !openState && partOf(o, st.part)) {
    if (st.mode === 'detail') { openState = st; if (selected !== st.part) { go(o.key, st.part, st.part === scope || insideScope(o, st.part) ? scope : partOf(o, st.part)!.parentId); return; } }
    else if (selected === st.part && openable(o, st.part)) openState = st;
  }
  const id = pendingAction; pendingAction = null;
  if (id && id === selected) { openAction(id); return; }
  if (openState) syncOpenSoon(); else { dropShort(); hideDetail(); }
}
function detailEl(): HTMLElement {
  let v = document.getElementById('detail');
  if (!v) { v = h('section', { id: 'detail', class: 'detail-view', tabindex: '-1', 'aria-label': '내부 상세', hidden: true }); $('space').append(v); }
  return v;
}
/** The detail view (내부 상세): the part's boundary in the middle, its ports on its edges (받는 것 left, 내는 것 right; a relation
 * the record gave no port name stays on the edge by its own words), its outside partners as reference cards beyond them, joined
 * by lines in the map's own language. The rest of the map is not shown; the three moves are in its head. */
function renderDetail(id: string) {
  const o = opened, p = o ? partOf(o, id) : null; if (!o || !p) return;
  const v = detailEl(), r = p.reading, said = relationLines(o.project), again = detailFor?.part === id && !v.hidden;
  const holds = (x: string) => { for (let q = partOf(o, x), g = 0; q && g < 64; q = partOf(o, q.parentId), g++) if (q.id === id) return true; return false; };
  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  type DEnd = { rel: RelationView; out: boolean; far: string; near: string; ch: Channel | null; word: string; port: string };
  const ends: DEnd[] = o.view.relations.flatMap(rel => {
    const a = holds(rel.from), b = holds(rel.to); if (a === b) return [];
    const s = said.get(rel.id), ch: Channel | null = rel.kind === 'related' ? null : s?.channel ?? (rel.kind === 'flow' ? 'data' : 'uses'), word = relWord(rel, ch, s);
    const names = (a ? r?.outputs : r?.inputs) ?? [], keys = [s?.payload, rel.note].filter((x): x is string => !!x).map(norm);
    // The record's explicit correspondence of this line to a port (map-reading.9 portMap) comes first; else its words name one.
    const mapped = (r?.portMap ?? []).find(m => m.relationId === rel.id && m.direction === (a ? 'out' : 'in') && names.includes(m.port));
    const named = mapped?.port ?? names.find(n => keys.includes(norm(n)));
    return [{ rel, out: a, far: a ? rel.to : rel.from, near: a ? rel.from : rel.to, ch, word, port: named ? `n:${named}` : `w:${word}` }];
  });
  const portList = (out: boolean) => {
    const names = (out ? r?.outputs : r?.inputs) ?? [], mine = ends.filter(e => e.out === out);
    const list = names.map(n => ({ key: `n:${n}`, name: n, unnamed: false }));
    for (const e of mine) if (!list.some(x => x.key === e.port)) list.push({ key: e.port, name: e.word, unnamed: true });
    return list;
  };
  const ins = portList(false), outs = portList(true);
  // The inside (spec 4): the steps in the record's row order, each port with the steps the record maps it to, or its blank.
  const steps = r ? stepsOf(r) : [];
  const chain = detailChain(steps, r?.portMap ?? [], ins.filter(x => !x.unnamed).map(x => x.name), outs.filter(x => !x.unnamed).map(x => x.name));
  const portEl = (x: { key: string; name: string; unnamed: boolean }, out: boolean) => {
    const via = ends.filter(e => e.out === out && e.port === x.key && e.near !== id).map(e => partOf(o, e.near)?.name).filter(Boolean);
    const cp = x.unnamed ? null : (out ? chain.ports.out : chain.ports.in).find(q => q.port === x.name);
    // With steps recorded, a port the record maps to none ends here, on the boundary; without steps the body says it once.
    const mark = steps.length ? (cp ? cp.mark : unmappedMark(out ? 'out' : 'in')) : null;
    const to = cp?.steps.map(k => chain.rows[k]!.name) ?? [];
    return h('li', { class: `dv-port${x.unnamed ? ' unnamed' : ''}${mark ? ' unmapped' : ''}`, 'data-port': `${out ? 'o' : 'i'}|${x.key}`,
      title: `${out ? '내는 것' : '받는 것'} · ${x.name}${x.unnamed ? '\n기록이 이 관계에 포트 이름을 주지 않았다 (관계의 말)' : ''}${via.length ? `\n안쪽 ‘${via.join('’, ‘')}’에서` : ''}${to.length ? `\n${out ? '나오는 단계' : '들어가는 단계'} · ${to.join(', ')}` : ''}${mark ? `\n${mark} · 기록이 이 포트와 단계를 잇지 않았다` : ''}` },
      h('span', { class: 'io-mark', 'aria-hidden': 'true' }, out ? '⇤' : '⇥'), h('span', { class: 'dv-port-name' }, x.name),
      mark ? h('span', { class: 'dv-unmapped' }, mark) : null);
  };
  const stepBox = (s: (typeof chain.rows)[number]) => {
    const on = pickedStep?.part === id && pickedStep.name === s.name;
    return h('li', {}, h('button', { type: 'button', class: `dv-step${on ? ' on' : ''}`, 'data-step': String(s.index), 'aria-pressed': String(on),
      title: [`${s.index + 1}. ${s.name}`, s.does, s.uses.length ? `씀 · ${s.uses.join(', ')}` : null, s.ins.length ? `들어오는 포트 · ${s.ins.join(', ')}` : null, s.outs.length ? `나가는 포트 · ${s.outs.join(', ')}` : null, '눌러서 읽기면에 이 단계'].filter(Boolean).join('\n'),
      onclick: () => pickStep(id, s.name) },
      h('span', { class: 'dv-step-head' }, h('span', { class: 'dv-step-n', 'aria-hidden': 'true' }, String(s.index + 1)), h('span', { class: 'dv-step-name' }, s.name)),
      s.does ? h('span', { class: 'dv-step-does' }, s.does) : null,
      s.uses.length ? h('span', { class: 'dv-uses' }, ...s.uses.map(u => h('span', { class: 'dv-use', title: u }, u))) : null));
  };
  const loop = r?.loop ?? null, vars = r?.stateVars ?? [];
  const chainEl = steps.length ? h('section', { class: 'xp-sec x-steps dv-chain' },
    h('h4', { class: 'xp-title', title: '기록 표의 행 순서. 단계 사이의 순서·분기는 기록에서 읽지 않아 단계끼리 잇지 않는다.' }, '기록된 단계', h('small', {}, String(steps.length))),
    h('ol', { class: 'dv-steps' }, ...chain.rows.map(stepBox)),
    chain.stray.length ? h('p', { class: 'dv-none', title: chain.stray.map(m => `${m.port} · ${m.step}`).join('\n') }, `포트·단계를 찾지 못한 대응 ${chain.stray.length}`) : null) : null;
  const keepEl = loop || vars.length ? h('section', { class: 'xp-sec dv-keep' },
    h('h4', { class: 'xp-title' }, loop && vars.length ? '반복 · 유지 상태' : loop ? '반복' : '유지 상태'),
    loop ? h('p', { class: 'dv-loop' }, loopLine(loop)) : null,
    vars.length ? h('ul', { class: 'xp-lines dv-vars' }, ...vars.map(v => h('li', { ...(v.scope ? { title: `범위 · ${v.scope}` } : {}) }, stateVarLine(v)))) : null) : null;
  const refCard = (far: string, out: boolean) => {
    const q = partOf(o, far), qr = q?.reading, mine = ends.filter(e => e.far === far && e.out === out);
    return h('button', { type: 'button', class: 'dv-ref', role: 'listitem', 'data-part-ref': far, 'data-ref': `${out ? 'o' : 'i'}|${far}`,
      title: `${partPath(o.view, far).map(x => x.name).join(' › ')}\n이 부분의 상세 열기`, 'aria-label': `${q?.name ?? '부분'} 상세 열기 · ${mine.map(e => e.word).join(', ')}`, onclick: () => openDetail(far, true) },
      qr?.typeRead ? h('span', { class: 'node-type' }, TYPE_LABEL[qr.typeRead.type]) : null, h('span', { class: 'dv-ref-name' }, q?.name ?? '부분'),
      h('span', { class: 'dv-ref-rel' }, [...new Set(mine.map(e => e.word))].join(' · ')));
  };
  const order = (out: boolean) => { const ports = out ? outs : ins, seen: string[] = []; for (const pt of ports) for (const e of ends) if (e.out === out && e.port === pt.key && !seen.includes(e.far)) seen.push(e.far); return seen; };
  const path = partPath(o.view, id).slice(0, -1).map(x => x.name), parent = partOf(o, p.parentId), ops = r ? opsOf(r) : null;
  const move = (k: string, label: string, key: string, aria: string, on: boolean, title: string, run: () => void) =>
    h('button', { type: 'button', class: `dv-move m-${k}`, title, 'aria-keyshortcuts': aria, disabled: !on, onclick: run }, h('span', {}, label), h('kbd', {}, key));
  const kids = p.childIds.map(c => partOf(o, c)).filter((x): x is PartView => !!x);
  const inner = h('div', { class: 'dv-body' },
    !r ? h('p', { class: 'dv-none' }, '이 부분을 말한 기록이 없다 · 빈 카드') : null,
    r && !r.inputs.length && !r.outputs.length && !r.fields.length && !r.config.length && !kids.length && !steps.length && !loop && !vars.length ? h('p', { class: 'dv-none' }, '내부 미상 · 기록이 안쪽을 말하지 않았다') : null,
    chainEl,
    r && !steps.length ? h('section', { class: 'xp-sec x-steps' }, h('h4', { class: 'xp-title' }, '단계'), h('p', { class: 'dv-none', title: '받는 것에서 내는 것까지의 단계를 기록이 아직 말하지 않았다. 포트와 단계는 잇지 않는다.' }, '기록된 단계 없음 · 진입 단계 미상')) : null,
    keepEl,
    ...actionBody(p, true),
    kids.length ? h('section', { class: 'xp-sec x-kids' }, h('h4', { class: 'xp-title' }, '구성', h('small', {}, String(kids.length))),
      h('div', { class: 'dv-kids' }, ...kids.map(k => h('button', { type: 'button', class: 'dv-kid', 'data-part-ref': k.id, title: `‘${k.name}’ 상세 열기`, onclick: () => openDetail(k.id, true) }, k.reading?.typeRead ? h('span', { class: 'node-type' }, TYPE_LABEL[k.reading.typeRead.type]) : null, h('span', {}, k.name))))) : null);
  const fam = r?.typeRead ? FAMILY_OF[r.typeRead.type] : 'neutral';
  v.replaceChildren(
    h('header', { class: 'dv-head' },
      h('div', { class: 'dv-title' }, h('span', { class: 'dv-kind' }, '내부 상세'), path.length ? h('span', { class: 'dv-where' }, `${path.join(' › ')} ›`) : null, h('h2', { class: 'dv-name' }, p.name)),
      h('div', { class: 'dv-moves', role: 'toolbar', 'aria-label': '내부 상세에서 나가기' },
        move('close', '닫기', 'Esc', 'Escape', true, '닫기 · 이 상세만 닫고 지도의 같은 선택으로', () => closeOpen(true)),
        move('back', '이전 읽기 위치', 'Alt ←', 'Alt+ArrowLeft', backStack.length > 0, backStack.length ? '이전 읽기 위치 · 이 상세를 열기 전의 카메라·선택·확대 단계·열림으로' : '이전 읽기 위치 없음', goBackPlace),
        move('up', parent ? `상위 구성 · ${parent.name}` : '상위 구성', 'Alt ↑', 'Alt+ArrowUp', !!parent, parent ? `상위 구성 · 이 부분을 실제로 담은 ‘${parent.name}’의 상세` : '상위 구성 없음 · 맨 위의 부분', goUp))),
    h('div', { class: 'dv-stage' }, h('div', { class: `dv-grid${steps.length ? ' has-steps' : ''}` },
      svg('svg', { class: 'dv-lines', 'aria-hidden': 'true' }),
      h('div', { class: 'dv-side s-in', role: 'list', 'aria-label': '들어오는 쪽의 바깥 부분' }, ...order(false).map(f => refCard(f, false))),
      h('div', { class: `dv-bound f-${fam}`, role: 'group', 'aria-label': `${p.name}의 경계` },
        svg('svg', { class: 'dv-lines dv-inlines', 'aria-hidden': 'true' }),
        h('div', { class: 'dv-bhead' }, r?.typeRead ? h('span', { class: 'node-type' }, TYPE_LABEL[r.typeRead.type]) : null, h('strong', { class: 'dv-bname' }, p.name), ops ? h('span', { class: 'xp-ops', title: ops.tip }, ops.full) : null),
        h('div', { class: `dv-inner${steps.length ? ' has-steps' : ''}` },
          h('ul', { class: 'dv-ports p-in', 'aria-label': '받는 것' }, ...(ins.length ? ins.map(x => portEl(x, false)) : [h('li', { class: 'dv-port blank' }, '받는 것 미기재')])),
          inner,
          h('ul', { class: 'dv-ports p-out', 'aria-label': '내는 것' }, ...(outs.length ? outs.map(x => portEl(x, true)) : [h('li', { class: 'dv-port blank' }, '내는 것 미기재')])))),
      h('div', { class: 'dv-side s-out', role: 'list', 'aria-label': '나가는 쪽의 바깥 부분' }, ...order(true).map(f => refCard(f, true))))));
  detailLinks = ends.map(e => ({ ref: `${e.out ? 'o' : 'i'}|${e.far}`, port: `${e.out ? 'o' : 'i'}|${e.port}`, out: e.out, ch: e.ch, plain: e.rel.kind === 'related' }));
  // Inside the boundary, only where the record maps a line to a port and a step: the port to the step (in), the step to the port
  // (out), in the channel of the line it maps (the first one when several reach the same port and step).
  stepLinks = chain.links.map((l: ChainLink) => {
    const e = ends.find(x => l.relationIds.includes(x.rel.id));
    return { port: `${l.direction === 'out' ? 'o' : 'i'}|n:${l.port}`, step: l.step, out: l.direction === 'out', ch: e ? e.ch : 'data' as Channel | null, plain: e?.rel.kind === 'related' };
  });
  v.hidden = false; $('space').classList.add('detail-open');
  const vp = $('viewport'); if (!vp.inert) { vp.inert = true; vp.dataset.detailInert = '1'; }
  detailFor = { part: id, view: o.view, back: backStack.length };
  drawDetailLines();
  if (!again) v.focus({ preventScroll: true });
}
/** The detail view's lines, from each reference card to its port on the boundary: data ends in a filled head, control and
 * reference in an open V (reference dotted), a plain relation in dots; drawn again when the window changes. */
let detailLinks: { ref: string; port: string; out: boolean; ch: Channel | null; plain: boolean }[] = [];
function drawDetailLines() {
  const v = document.getElementById('detail'); if (!v || v.hidden) return;
  const grid = v.querySelector<HTMLElement>('.dv-grid'), lines = v.querySelector<SVGSVGElement>('.dv-grid > .dv-lines'), bound = v.querySelector<HTMLElement>('.dv-bound'); if (!grid || !lines || !bound) return;
  const G = grid.getBoundingClientRect(), B = bound.getBoundingClientRect();
  lines.setAttribute('width', String(Math.ceil(G.width))); lines.setAttribute('height', String(Math.ceil(G.height)));
  const defs = svg('defs', {});
  const mk = (idm: string, d: string, filled: boolean) => { const m = svg('marker', { id: idm, viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '9', markerHeight: '9', orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' }); m.append(svg('path', { d, class: filled ? 'fill' : 'open' })); defs.append(m); };
  mk('dv-arrow', 'M0,0 L10,5 L0,10 L3,5 z', true); mk('dv-open', 'M1,1 L8,5 L1,9', false);
  lines.replaceChildren(defs);
  for (const l of detailLinks) {
    const card = v.querySelector<HTMLElement>(`.dv-ref[data-ref="${CSS.escape(l.ref)}"]`), port = v.querySelector<HTMLElement>(`.dv-port[data-port="${CSS.escape(l.port)}"]`); if (!card || !port) continue;
    // A port meets its line at its name line (a port mapped to no step carries its blank under the name).
    const C = card.getBoundingClientRect(), P = port.getBoundingClientRect(), py = P.top + Math.min(P.height / 2, 12) - G.top, cy = C.top + C.height / 2 - G.top;
    const [x1, y1, x2, y2] = l.out ? [B.right - G.left, py, C.left - G.left, cy] : [C.right - G.left, cy, B.left - G.left, py];
    const mx = (x1 + x2) / 2;
    lines.append(svg('path', { class: `dv-line${l.ch ? ` c-${l.ch}` : ''}${l.plain ? ' plain' : ''}`, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, ...(l.plain ? {} : { 'marker-end': l.ch === 'data' ? 'url(#dv-arrow)' : 'url(#dv-open)' }) }));
    lines.append(svg('circle', { class: 'dv-pin', cx: String(l.out ? x1 : x2), cy: String(py), r: '3.5' }));
  }
  // Inside the boundary: a port to the step the record maps it to (in), a step to its port (out), with the same heads.
  const inl = bound.querySelector<SVGSVGElement>(':scope > .dv-inlines'); if (!inl) return;
  inl.setAttribute('width', String(Math.ceil(B.width))); inl.setAttribute('height', String(Math.ceil(B.height)));
  inl.replaceChildren();
  // The svg sits in the boundary's padding box (inside its border).
  const bx = B.left + bound.clientLeft, by = B.top + bound.clientTop;
  for (const l of stepLinks) {
    const port = bound.querySelector<HTMLElement>(`.dv-port[data-port="${CSS.escape(l.port)}"]`), step = bound.querySelector<HTMLElement>(`.dv-step[data-step="${l.step}"]`); if (!port || !step) continue;
    // A step's line meets it at its name line (the first 28px), whatever its height.
    const P = port.getBoundingClientRect(), S = step.getBoundingClientRect(), py = P.top + Math.min(P.height / 2, 12) - by, sy = S.top + Math.min(S.height / 2, 14) - by;
    const [x1, y1, x2, y2] = l.out ? [S.right - bx, sy, P.left - bx, py] : [P.right - bx, py, S.left - bx, sy];
    const mx = (x1 + x2) / 2;
    inl.append(svg('path', { class: `dv-line in-step${l.ch ? ` c-${l.ch}` : ''}${l.plain ? ' plain' : ''}`, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, ...(l.plain ? {} : { 'marker-end': l.ch === 'data' ? 'url(#dv-arrow)' : 'url(#dv-open)' }) }));
  }
}
/** The detail view's links inside the boundary (steps-view detailChain): port key, step index, direction and channel. */
let stepLinks: { port: string; step: number; out: boolean; ch: Channel | null; plain: boolean }[] = [];
/** The step read in the pane (a click on a step box in the detail view or on a step in the pane), for one part; another
 * selection clears it. */
let pickedStep: { part: string; name: string } | null = null;
function pickStep(part: string, name: string) {
  pickedStep = pickedStep?.part === part && pickedStep.name === name ? null : { part, name };
  document.querySelectorAll<HTMLElement>('#detail .dv-step').forEach(b => {
    const on = !!pickedStep && pickedStep.part === part && b.querySelector('.dv-step-name')?.textContent === pickedStep.name;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  });
  if (opened && selected === part && !sheetOpen && !planView.isOpen()) {
    renderLens();
    requestAnimationFrame(() => $('lens').querySelector<HTMLElement>('.stp-step.on')?.scrollIntoView({ block: 'nearest' }));
  }
}

/** camera: 'fit' (new view), 'restore' (a scope's own last camera, else fit), 'keep' (same view, structure changed). */
function renderSpace(cameraMode: 'fit' | 'restore' | 'keep' = 'fit', planOverlay = true) {
  const o = opened!; setBar(o);
  $('home').hidden = true; $('space').hidden = false; $('ai-pill').hidden = false;
  // A redraw of the structure ends the places held for a drag (holdPlaces) and the hover's peek.
  held = null; $('space').classList.remove('peek', 'state-peek');
  // The zoom level the cards are drawn at: every relayout until the next redraw keeps it (a drag never changes their lines).
  opsRef = opsDay(o); laidKey = levelKey(camera.k); cardLevel = zoomLevel(camera.k); cardOneLine = camera.k < Z_MID;
  relayout(o);
  const world = $('world'), view = o.view;
  // Same view, new structure (a fold, a new part, 자동 배치): where every box and line was, so each slides to its new place.
  // (Not when the zoom level a view just opened at redraws it: the cards then take their level's height in place.)
  const was = cameraMode === 'keep' && !world.hidden && performance.now() - lastFresh > 600 ? beforeRedraw(world) : null;
  if (cameraMode !== 'keep') lastFresh = performance.now();
  world.replaceChildren();
  const edges = svg('svg', { class: 'edges', width: '1', height: '1', 'aria-hidden': 'true' });
  const defs = svg('defs', {});
  for (const id of ['arrow', 'arrow-on', 'arrow-near']) {
    const m = svg('marker', { id, viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
    m.append(svg('path', { d: 'M0,0 L10,5 L0,10 L3,5 z' })); defs.append(m);
  }
  // A control or reference line ends in an open V (no base, never filled, so it stays open on a selected line): ten pixels of
  // the map whatever the line's width, its tip where the line ends.
  for (const id of ['arrow-open', 'arrow-open-on', 'arrow-open-near']) {
    const m = svg('marker', { id, viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '10', markerHeight: '10', markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
    m.append(svg('path', { d: 'M1,1 L8,5 L1,9' })); defs.append(m);
  }
  // A selected line also marks where it starts, so both of its ends read on the map.
  // Every line carries a start dot; styles.css shows it only on a line being read (hovered or selected) and on a plain relation.
  for (const id of ['dot', 'dot-on']) { const d = svg('marker', { id, viewBox: '0 0 10 10', refX: '5', refY: '5', markerWidth: '6', markerHeight: '6' }); d.append(svg('circle', { cx: '5', cy: '5', r: id === 'dot' ? '2.6' : '3.6' })); defs.append(d); }
  edges.append(defs);
  // A line between two parts of the same group belongs to that group: it reads above the group's surface (a line between
  // groups stays under them, so it never seems to end at a group it only passes).
  const frames = (id: string) => { const out = new Set<string>(); for (let c = lay.boxes.get(id)?.container, g = 0; c && g < 64; c = lay.boxes.get(c)?.container, g++) if (lay.boxes.get(c)?.kind === 'frame') out.add(c); return out; };
  // A busy map at rest reads as its summary (summaryEdges: one line per pair of groups and kind, with its count); a selection,
  // the change plan or a map of a few lines draws each line. Both sets are drawn; .rest-sum on the space shows one of them.
  restSums = sums = lay.edges.length > 6 ? summaryEdges(lay.boxes, lay.edges) : [];
  const relInfo = relationLines(o.project), present = new Set<Channel>();
  lineWords = new Map(); lineChans = new Map();
  for (const e of [...lay.edges, ...sums]) {
    const fa = frames(e.from), inner = [...frames(e.to)].some(f => fa.has(f)), sum = e.key.startsWith('sum:'), ch = edgeChannel(e, relInfo);
    if (ch) present.add(ch);
    lineWords.set(e.key, lineWord(e, ch, relInfo)); lineChans.set(e.key, ch);
    const g = svg('g', { class: `edge${sum ? ' sum' : ''} k-${e.kind}${ch ? ` c-${ch}` : ''}${e.agg ? ' agg' : ''}${inner ? ' inner' : ''}${!sum && edgeRevised(e) ? ' revised' : ''}${e.spine ? ' spine' : ''}${!sum && e.notes.length && e.notes.every(plannedNote) ? ' planned' : ''}`, 'data-from': e.from, 'data-to': e.to, 'data-key': e.key });
    // No text on the map: the meaning shows on hover (tip) and in the selected part's 관련 부분.
    // A plain relation ends in the same dot at both ends: it is drawn, not directed. Data ends in a filled head, control and
    // reference in an open V.
    g.append(svg('path', { class: 'edge-line', 'marker-end': e.kind === 'related' ? 'url(#dot)' : ch === 'data' ? 'url(#arrow)' : 'url(#arrow-open)', 'marker-start': 'url(#dot)' }), svg('path', { class: 'edge-hit' }));
    edges.append(g);
  }
  world.append(edges);
  renderLineKey(present);
  // Each group's head says how many relations cross its boundary (stored relations, any depth inside): where it connects, before
  // anything is selected. Part of the head, so clicking it selects the group and the head's own button role reads it.
  const crossing = boundaryCounts(view);
  const linksChip = (id: string) => {
    const c = crossing.get(id); if (!c?.all) return null;
    const how = [c.in ? `들어옴 ${c.in}` : '', c.out ? `나감 ${c.out}` : '', c.plain ? `방향 없음 ${c.plain}` : ''].filter(Boolean).join(' · ');
    return h('span', { class: 'frame-links', title: `바깥과 이어진 관계 ${c.all}개${how ? ` · ${how}` : ''}` }, h('span', { 'aria-hidden': 'true' }, `연결 ${c.all}`), h('span', { class: 'sr-only' }, `바깥 관계 ${c.all}`));
  };
  const enterButton = (p: PartView) => h('button', { type: 'button', class: 'enter', title: `‘${p.name}’ 안으로 들어가기 · 부분 ${p.childIds.length}`, 'aria-label': `${p.name} 안으로 들어가기`, onclick: () => go(o.key, null, p.id) }, `안쪽 ${p.childIds.length}`, h('span', { 'aria-hidden': 'true' }, '›'));
  const toggleButton = (p: PartView, open: boolean) => h('button', { type: 'button', class: 'toggle', title: open ? '접기' : '여기서 펼치기', 'aria-label': `${p.name} ${open ? '접기' : '펼치기'}`, 'aria-expanded': String(open),
    onclick: () => { const k = `${o.key}|${p.id}`; expandState.set(k, !open); tempExpand.delete(k); previewExpand.delete(k); renderSpace('keep'); if (selected) select(selected); } }, chevron(open));
  // Enter on the selected card opens it (동작 열기); otherwise Enter and Space select.
  const keySelect = (id: string) => (e: Event) => { const k = (e as KeyboardEvent).key; if ((k === 'Enter' || k === ' ') && e.target === e.currentTarget) { e.preventDefault(); if (k === 'Enter' && selected === id && openable(o, id)) openAction(id); else go(o.key, id); } };
  const boxes = [...lay.boxes.values()].sort((a, b) => (a.kind === 'frame' ? 0 : 1) - (b.kind === 'frame' ? 0 : 1) || a.depth - b.depth);
  // Each region (an open group directly in the scope) takes a hue of its own, by its place in the scope's order.
  const hueOf = new Map<string, number>(); (scope ? partOf(o, scope)?.childIds ?? [] : view.roots).forEach((id, i) => hueOf.set(id, HUES[i % HUES.length]!));
  // Same names under different parents read with their parent beside them (only where a name repeats in this view).
  const seen = new Map<string, number>();
  for (const b of boxes) if (b.kind !== 'ghost') { const n = partOf(o, b.id)!.name; seen.set(n, (seen.get(n) ?? 0) + 1); }
  const owner = (p: PartView) => (seen.get(p.name)! > 1 && p.parentId ? partOf(o, p.parentId)?.name ?? null : null);
  // Reading levels: a region says why its parts belong together (the first sentence of its note); rows and list items carry a
  // name and, when there is one, a state. The full note and the reasons of relations are the selection's (the lens).
  for (const b of boxes) {
    if (b.kind === 'ghost') {
      const id = b.id.slice(6), p = partOf(o, id)!, path = partPath(view, id).map(x => x.name);
      // Its whole name (the layout sized the card for it); where it belongs reads once over its run (.ghost-head).
      // The scope itself, as the end of its relations with its own parts, is this scope's boundary: it selects the scope part in
      // place (its reading as any part's: description, claims, their sources), never a move out of the scope. Any other id (the
      // same name included) is a part outside.
      if (id === scope) {
        world.append(h('button', { type: 'button', class: 'ghost self', 'data-box': b.id, 'data-part-ref': id, title: `지금 들어와 있는 부분 · ${path.join(' › ')} · 읽기`, 'aria-label': `지금 들어와 있는 부분 ${p.name} 읽기`, onclick: () => go(o.key, id) },
          h('span', { class: 'ghost-name' }, p.name)));
        continue;
      }
      world.append(h('button', { type: 'button', class: 'ghost', 'data-box': b.id, 'data-part-ref': id, title: `다른 곳의 부분 · ${path.join(' › ')} · 그곳으로 가기`, onclick: () => go(o.key, id, p.parentId) },
        h('span', { class: 'ghost-name' }, p.name)));
      continue;
    }
    const p = partOf(o, b.id)!, of = owner(p);
    if (b.kind === 'frame') {
      const latest = subtreeRecords(view, p.id)[0]?.at ?? null, region = b.depth === 0, note = region ? mapLead(view, p.id) : '';
      world.append(h('div', { class: `frame ${region ? 'region' : 'group'} depth-${Math.min(b.depth, 2)}${b.depth % 2 ? ' tint' : ''}${b.list ? ' list' : ''}`, 'data-part': p.id, 'data-box': p.id, ...(region && hueOf.has(p.id) ? { style: `--hue:${hueOf.get(p.id)}` } : {}) },
        h('div', { class: `frame-head s-${p.status}${b.head > HEAD ? ' tall' : ''}`, style: `height:${b.head}px`, 'data-part': p.id, 'data-drag': p.id, role: 'button', tabindex: '0', title: of ? `${of} › ${p.name}` : p.name, onkeydown: keySelect(p.id) },
          toggleButton(p, true),
          // A change line reads under the name (in the preview only), never beside it: the name keeps the whole head width.
          h('span', { class: 'frame-title' }, h('span', { class: 'frame-name' }, p.name), h('span', { class: 'plan-note' })),
          h('span', { class: 'frame-meta' }, latest ? h('span', { class: recentAt(latest) ? 'fresh' : '' }, ago(latest)) : null),
          linksChip(p.id), enterButton(p), note ? h('span', { class: 'frame-note' }, note) : null)));
    } else {
      // A folded part reads its inside: latest record anywhere under it.
      const last = b.kids ? subtreeRecords(view, p.id)[0]?.at ?? null : p.lastAt, meta = metaLine(p, last), face = b.face ?? 'row';
      // A folded group reads by its name and its count (the way in); its note reads in the pane. A part without an inside keeps
      // its own first sentence.
      const note = face === 'unit' && !b.kids && !cardBudgets.has(p.id) ? mapLead(view, p.id) : '', box = lay.boxes.get(b.container), onTint = box?.kind === 'frame' && box.depth % 2 === 1, alias = aliasOf(view, p.id);
      // What readings said the part is (units and rows; a list item keeps its one line): the operations line takes the state
      // line's place (the records' own status stays in its tip), the ladder beside it as before.
      const r = face === 'item' ? null : p.reading, typed = r ? typedOf(r) : null, ops = r ? opsOf(r) : null, said = ops?.full ?? meta;
      // A typed card with an inside carries its group chips at the end of its name line, or on a line of their own under the
      // body (card-budget chips); never beside the operations line, which keeps the card's width.
      const chipsAt: ChipsAt = b.kids && face === 'unit' ? cardBudgets.get(p.id)?.chips ?? 'none' : 'none';
      // The entry line (spec 4) under the body: a card with an inside reads its way in there ('구성 N'); its chips keep the rest.
      const budget = cardBudgets.get(p.id), entryEl = face === 'unit' && typed && r && budget?.entry ? entryLine(o, p, r, typed, budget) : null, kidsIn = !!entryEl?.querySelector('.entry-kids');
      const chips = (cls: string) => h('span', { class: `node-chips ${cls}` }, linksChip(p.id), kidsIn ? null : enterButton(p)), nameEl = h('span', { class: 'node-name' }, p.name);
      const opsEl = ops ? h('span', { class: 'meta-text ops', title: `${ops.tip}${meta ? `
기록 · ${meta}` : ''}` }, ops.full) : null;
      if (opsEl && ops) opsFit.set(opsEl, ops);
      world.append(h('div', { class: `node ${face}${onTint ? ' on-tint' : ''} s-${p.status}${p.status === 'plan' && p.reading?.state ? ` rs-${p.reading.state}` : ''}${recentAt(last) ? ' fresh' : ''}${b.kids ? ' has-kids' : ''}${typed ? ` typed f-${typed.family}` : ''}${said || of ? '' : ' bare'}`, 'data-part': p.id, 'data-box': p.id, 'data-drag': p.id, role: 'button', tabindex: '0',
        title: `${of ? `${of} › ` : ''}${p.name}${alias ? ` · ${alias}` : ''}`, onkeydown: keySelect(p.id) },
        b.kids ? toggleButton(p, false) : null,
        h('span', { class: 'node-text' }, r?.typeRead ? h('span', { class: 'node-type' }, TYPE_LABEL[r.typeRead.type]) : null,
          chipsAt === 'name' ? h('span', { class: 'node-headline' }, nameEl, chips('at-name')) : nameEl,
          note ? h('span', { class: 'node-note' }, note) : null,
          said ? h('span', { class: 'node-meta' }, ladder(view, p), opsEl ?? h('span', { class: 'meta-text' }, said)) : alias ? h('span', { class: 'node-meta owner alias' }, h('span', { class: 'meta-text' }, alias)) : of ? h('span', { class: 'node-meta owner' }, h('span', { class: 'meta-text' }, `${of} 안`)) : null,
          face === 'unit' && typed && r ? typedBlock(typed, r, budget, entryEl) : null,
          chipsAt === 'line' ? chips('own-line') : null,
          h('span', { class: 'plan-note' })),
        b.kids && chipsAt === 'none' ? linksChip(p.id) : null, b.kids && chipsAt === 'none' ? enterButton(p) : null));
    }
  }
  // The title of this map: what the scope is for, in its own first sentence. The rest of that text (where it comes from, what
  // was checked) reads in full in the pane on request; nothing of it is cut or reworded. Inside a part, the scope's own
  // relations to the outside read under the title as the scope's, never drawn as lines from one of its children.
  const sp = partOf(o, scope), purpose = (sp ? sp.note : o.project.space.brief?.text ?? '').trim(), first = lead(purpose);
  const outside = scopeEnds(o), more = purpose.replace(/\s+/g, ' ').length > first.length + 1, basis = basisLine(o);
  // The basis line reads under the purpose; with no purpose the reading's sentence stands in its place, and the basis under it.
  const title = h('header', { class: 'map-title' }, h('h1', { class: 'map-name' }, sp ? sp.name : o.project.name),
    first ? h('p', { class: 'map-purpose' }, h('span', {}, first), more ? h('button', { type: 'button', class: 'map-more', title: '설명 전체와 출처', onclick: () => openScopeReading() }, '설명 전체') : null) : null,
    first ? basis : null,
    sp ? null : understoodLine(o),
    first ? null : basis,
    flowStrip(o), scenarioStrip(o), stateStrip(o),
    outside.length ? h('div', { class: 'scope-rels', role: 'list', 'aria-label': '이 범위의 바깥 관계' }, ...relationGroups(outside, '범위').map(g => h('p', { class: 'scope-rel', role: 'listitem' },
      h('span', { class: 'sr-verb' }, g.label), ...g.list.map(x => h('button', { type: 'button', class: 'sr-part', title: `${partPath(o.view, x.far).map(q => q.name).join(' › ')}${x.r.note ? `\n${x.r.note}` : ''}`, 'data-far': x.far, onclick: (e: Event) => { follow(x.far, x.r, e); go(o.key, x.far, null); } }, partOf(o, x.far)?.name ?? '부분'))))) : null);
  world.append(title);
  placeLoneHead(crossing);
  title.style.width = `${titleRect().w}px`;
  titleH = view.parts.length ? title.offsetHeight : 0; title.hidden = !titleH;
  $('scope-sticky').replaceChildren(h('strong', {}, sp ? sp.name : o.project.name), first ? h('span', {}, first) : '');
  lay.bounds = { ...core }; withTitle();
  // Selected lines move to a layer above the group surfaces (below the parts), so a line that crosses a group is not read as
  // ending at it.
  const top = svg('svg', { class: 'edges edges-top', width: '1', height: '1', 'aria-hidden': 'true' });
  world.insertBefore(top, world.querySelector('.node, .ghost'));
  world.querySelectorAll('.edge.inner').forEach(g => top.append(g));
  if (was) morphFrom = was.lines;
  positionWorld();
  fitTyped(world); fitOps(world);
  morphFrom = null;
  if (was) afterRedraw(world, was);
  drawScenario();
  $('space').classList.toggle('in-scope', !!scope);
  // Many lines on one view: those that go round other parts share the same gaps and would read as extra outlines of the
  // groups they pass; they step back until selected, hovered or read as a change's context (kind, direction and hover meaning
  // unchanged).
  syncLineMode();
  $('add-part').hidden = o.kind !== 'saved';
  $('arrange').hidden = !view.parts.length;
  renderPartForm();
  renderMapEntry();
  renderRecent();
  // A camera saved in a window of another size (a quarter or more each way) is not restored: the map is fitted here instead.
  const kept = cameraMode === 'restore' ? cameras.get(camKey(o, scope)) : undefined, saved = kept && sameWindow(kept.win) ? kept : undefined;
  if (cameraMode === 'keep') applyCamera();
  else if (saved) { camera = { ...saved }; applyCamera(); }
  else fitView(false);
  if (planOverlay) planView.overlay();
  applyReadMarks();
  if (openState) syncOpenSoon();
}

/** The scope's own parts that no line touches, under one caption: not a flow that lost its lines, just parts apart. Drawn
 * when the scope has such parts beside linked ones; placed above the topmost-leftmost of them and moved with them. */
let loneIds: string[] = [];
function placeLoneHead(crossing?: Map<string, { all: number }>) {
  const world = $('world'), here = scope ?? ROOT, touched = new Set(lay.edges.flatMap(e => [e.from, e.to]));
  const own = [...lay.boxes.values()].filter(b => b.container === here && b.kind !== 'ghost');
  loneIds = crossing ? own.filter(b => !touched.has(b.id) && !(crossing.get(b.id)?.all)).map(b => b.id) : loneIds;
  world.querySelector('.lone-head')?.remove();
  if (!loneIds.length || loneIds.length === own.length) return;
  const el = h('div', { class: 'lone-head', 'aria-hidden': 'true' }, `연결 없음 · ${loneIds.length}`);
  world.append(el); moveLoneHead();
}
function moveLoneHead() {
  const el = $('world').querySelector<HTMLElement>('.lone-head'); if (!el) return;
  const bs = loneIds.map(id => lay.boxes.get(id)).filter((b): b is Box => !!b); if (!bs.length) { el.remove(); return; }
  const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y));
  el.style.left = `${x}px`; el.style.top = `${y - 20}px`;
}
/** Before a redraw that keeps the view: each box's place and size and each line's shape, and the focused toggle's part. */
type Redraw = { boxes: Map<string, { l: string; t: string; w: string; h: string }>; lines: Map<string, string>; focus: string | null };
let arrangeTimer = 0;
function beforeRedraw(world: HTMLElement): Redraw {
  const boxes = new Map<string, { l: string; t: string; w: string; h: string }>(), moving = world.classList.contains('arranging');
  // While an earlier slide still runs, where a box is drawn now (computed), not where it was heading.
  world.querySelectorAll<HTMLElement>('[data-box]').forEach(el => { const cs = moving ? getComputedStyle(el) : el.style; boxes.set(el.dataset.box!, { l: cs.left, t: cs.top, w: cs.width, h: cs.height }); });
  const lines = new Map([...world.querySelectorAll<SVGGElement>('.edge')].map(g => [g.dataset.key!, g.querySelector('.edge-line')?.getAttribute('d') ?? '']));
  const focus = document.activeElement?.closest<HTMLElement>('[data-box] .toggle, .frame-head .toggle')?.closest<HTMLElement>('[data-part]')?.dataset.part ?? null;
  return { boxes, lines, focus };
}
/** After it: a box that was drawn before starts from its old place and slides (.arranging: left/top/width/height transition);
 * the lines morph from their old shapes (positionWorld, morphFrom). The toggle that had focus gets it back on its new element. */
function afterRedraw(world: HTMLElement, was: Redraw) {
  const moved: [HTMLElement, { l: string; t: string; w: string; h: string }][] = [];
  world.querySelectorAll<HTMLElement>('[data-box]').forEach(el => {
    const b = was.boxes.get(el.dataset.box!); if (!b || (b.l === el.style.left && b.t === el.style.top && b.w === el.style.width && b.h === el.style.height)) return;
    moved.push([el, { l: el.style.left, t: el.style.top, w: el.style.width, h: el.style.height }]);
    el.style.left = b.l; el.style.top = b.t; el.style.width = b.w; el.style.height = b.h;
  });
  if (moved.length) {
    void world.offsetWidth; // the old places take hold before the transition starts
    world.classList.add('arranging');
    for (const [el, to] of moved) { el.style.left = to.l; el.style.top = to.t; el.style.width = to.w; el.style.height = to.h; }
    clearTimeout(arrangeTimer); arrangeTimer = window.setTimeout(() => world.classList.remove('arranging'), 320);
  }
  if (was.focus) world.querySelector<HTMLElement>(`[data-part="${CSS.escape(was.focus)}"] .toggle`)?.focus({ preventScroll: true });
}
/** Geometry only (also during a drag): boxes and edge paths from the current layout. */
function positionWorld() {
  const world = $('world');
  moveLoneHead();
  // Heads of the outside partners' runs follow their layout (it can change while a part is dragged).
  const heads = new Map(lay.heads.map(x => [x.key, x]));
  world.querySelectorAll<HTMLElement>('.ghost-head').forEach(el => {
    const g = heads.get(el.dataset.head!); el.hidden = !g; if (!g) return;
    el.style.left = `${g.x}px`; el.style.top = `${g.y}px`; el.style.width = `${g.w}px`;
  });
  for (const g of lay.heads) if (!world.querySelector(`.ghost-head[data-head="${CSS.escape(g.key)}"]`)) {
    const el = h('div', { class: 'ghost-head', 'data-head': g.key }, g.text); el.style.left = `${g.x}px`; el.style.top = `${g.y}px`; el.style.width = `${g.w}px`; world.append(el);
  }
  world.querySelectorAll<HTMLElement>('[data-box]').forEach(el => {
    const b = lay.boxes.get(el.dataset.box!); if (!b) return;
    el.style.left = `${b.x}px`; el.style.top = `${b.y}px`; el.style.width = `${b.w}px`; el.style.height = `${b.h}px`;
  });
  const title = world.querySelector<HTMLElement>('.map-title');
  if (title) { const t = titleRect(); title.style.left = `${t.x}px`; title.style.top = `${t.y}px`; title.style.width = `${t.w}px`; }
  // The lines of each drawn set routed together (ports and nudging among themselves); while a part is dragged, their plain
  // shapes, so they follow the hand continuously; after the drop, the full routes, each morphing from the shape it had.
  const routed = new Map([...routeEdges(lay.boxes, lay.edges, { quick: dragQuick }), ...routeEdges(lay.boxes, sums, { quick: dragQuick })]);
  lastRouted = routed;
  world.querySelectorAll<SVGGElement>('.edge').forEach(g => {
    const r = routed.get(g.dataset.key!); if (!r) return;
    const from = morphFrom?.get(g.dataset.key!) ?? null;
    g.querySelectorAll('path').forEach(x => x.setAttribute('d', r.d));
    if (from && from !== r.d) morphEdge(g, from, r.d);
    g.classList.toggle('detour', !!r.detour);
    // A line that crosses nothing it does not belong to reads above the group surfaces, so its run inside the groups of its own
    // ends is seen up to its part; one that has to cross another box stays under them.
    g.classList.toggle('clear', r.clear); layerEdge(g);
  });
  placeScenarioHeads();
  placeEdgeLabels();
}
/** While a part is dragged: lines keep their plain shape (map-route quick). morphFrom: the shapes the lines had before a drop,
 * for the morph into their full routes. */
let dragQuick = false, morphFrom: Map<string, string> | null = null;
const MORPH_MS = 200;
const morphing = new Map<SVGGElement, number>();
/** A line's path from the shape it had to its new route: both sampled at even steps and mixed, ease-out, then the exact route. */
function morphEdge(g: SVGGElement, fromD: string, toD: string) {
  const probe = (d: string) => { const p = svg('path', { d }) as SVGPathElement; return samplePath(p, 48); };
  let a: Point[], b: Point[];
  try { a = probe(fromD); b = probe(toD); } catch { return; }
  const paths = [...g.querySelectorAll('path')], started = performance.now();
  const prior = morphing.get(g); if (prior) cancelAnimationFrame(prior);
  const step = (now: number) => {
    const t = Math.min(1, (now - started) / MORPH_MS), e = 1 - (1 - t) * (1 - t) * (1 - t);
    if (t >= 1) { paths.forEach(p => p.setAttribute('d', toD)); morphing.delete(g); return; }
    const d = mixPath(a, b, e); paths.forEach(p => p.setAttribute('d', d));
    morphing.set(g, requestAnimationFrame(step));
  };
  morphing.set(g, requestAnimationFrame(step));
}
/** Map lines at rest on a busy map: the summary lines (see renderSpace). With a selection, sums holds what each of them still
 * holds beside the selection's own lines (restSummary, set by markSelection); the drawn lines are restSums'. */
let restSums: Edge[] = [], sums: Edge[] = [];
const edgeOf = (key: string | undefined) => (key?.startsWith('sum:') ? sums : lay.edges).find(x => x.key === key);
/** A summary line that, beside the selection, holds fewer relations than at rest. */
const restOf = (e: Edge) => e.key.startsWith('sum:') && sums !== restSums && (restSums.find(x => x.key === e.key)?.ids.length ?? 0) > e.ids.length;
function syncLineMode() {
  const sp = $('space'), rest = !selected && !scView && !planView.isOpen() && restSums.length > 0;
  sp.classList.toggle('rest-sum', rest);
  // A selection on a busy map: its own lines one by one, the rest as the dimmed summary (see .sel-sum).
  sp.classList.toggle('sel-sum', (!!selected || !!scView) && !planView.isOpen() && restSums.length > 0);
  // Many lines on one view: those that go round other parts step back (see .dense-lines); a summary line never does.
  sp.classList.toggle('dense-lines', lay.edges.length >= 12);
}
/** Selected lines, a change's context lines, lines inside one group and lines that cross nothing else read above the groups. */
function layerEdge(el: Element) {
  const top = document.querySelector('#world .edges-top'), base = document.querySelector('#world .edges:not(.edges-top)');
  const layer = ['on', 'ctx', 'inner', 'clear', 'sc-path'].some(c => el.classList.contains(c)) ? top : base;
  if (layer && el.parentNode !== layer) layer.append(el);
}
/** The routes drawn last (positionWorld): the polylines the verbs and counts are placed on. */
let lastRouted = new Map<string, Routed>();
const edgePts = (key: string, path: SVGPathElement) => lastRouted.get(key)?.pts ?? samplePath(path, 24);
/** Keys of the lines drawn now (the space's line mode hides the single lines under a summary, or the summary's). */
function shownLines(): Set<string> {
  return new Set([...$('world').querySelectorAll<SVGGElement>('.edge')].filter(g => getComputedStyle(g).display !== 'none').map(g => g.dataset.key!));
}
/** Whether another drawn line passes under a chip's rectangle. */
function lineUnder(r: Rect, key: string, shown: Set<string>): boolean {
  for (const o of lastRouted.values()) if (o.key !== key && shown.has(o.key) && polylineHitsRect(o.pts, r, 2)) return true;
  return false;
}
/** Chips keep a readable size at low zoom: scaled up by --inv (applyCamera), so their measured size is scaled here too. */
const labelInv = () => parseFloat($('space').style.getPropertyValue('--inv')) || 1;
/** The head of a relation's note for the line it is drawn on: its first clause, at most 30 characters. */
function noteHead(n: string): string {
  const t = n.replace(/\s+/g, ' ').trim(), m = /^(.{8,40}?)(?:[,.;](?=\s|$)|$)/.exec(t), c = (m ? m[1]! : t).trim();
  return c.length > 30 ? `${c.slice(0, 29)}…` : c;
}
/** Labels on the map (spec 2.3): at rest every drawn line carries its one-line label (placeRestLabels); with a selection, the
 * selection's lines carry theirs. Each sits at a free spot along its own line; a label that would cover a part, a group's
 * head, the title or another label is left off the map (the pane lists every relation by its verb). Nothing is drawn for a
 * relation the project does not hold. */
function placeEdgeLabels() {
  const world = $('world'), o = opened; if (!o) return;
  let box = world.querySelector<HTMLElement>('.edge-labels');
  if (!box) { box = h('div', { class: 'edge-labels', 'aria-hidden': 'true' }); world.append(box); }
  box.replaceChildren();
  placedInv = labelInv();
  syncLineMode();
  world.querySelectorAll('.edge.label-hidden').forEach(g => g.classList.remove('label-hidden'));
  world.dataset.labelsHidden = '0';

  // The selection's lines of one kind and one direction that leave it on one side share one verb, set where they leave it;
  // every line stays its own (its tip and the pane keep each relation and its reason). The verb of such a fan carries no number:
  // a number on a verb reads as the relations one line holds, and the pane already counts the fan.
  const sel = selected ? lay.boxes.get(selected) : undefined;
  const side = (e: { from: string; to: string }) => { const far = lay.boxes.get(e.from === selected ? e.to : e.from); return !sel || !far ? '' : far.x + far.w / 2 < sel.x + sel.w / 2 ? 'l' : 'r'; };
  // A line resting only on a withdrawn report never shares its verb with ordinary lines (nor they its mark).
  const selKey = (e: Edge) => `${e.kind}|${e.kind === 'related' ? '' : e.from === selected}|${side(e)}|${edgeRevised(e) ? 'r' : ''}`;
  const fans = new Map<string, number>(), seenSel = new Set<string>();
  world.querySelectorAll<SVGGElement>('.edge.on').forEach(g => { const e = lay.edges.find(x => x.key === g.dataset.key); if (e) fans.set(selKey(e), (fans.get(selKey(e)) ?? 0) + 1); });
  // The selection's corrected lines are placed first, so other verbs never take the room their mark needs.
  const firstRevised = (g: SVGGElement) => g.classList.contains('on') && g.classList.contains('revised') ? 0 : 1;
  const lines = [...world.querySelectorAll<SVGGElement>('.edge')].sort((a, b) => firstRevised(a) - firstRevised(b)).filter(g => g.classList.contains('on'));
  // Where outside partners belong (their heads) is text on the map as well: a verb never covers it.
  const blocks: Rect[] = [...lay.boxes.values()].map(b => (b.kind === 'frame' ? { x: b.x, y: b.y, w: b.w, h: b.head } : b)).concat(lay.heads);
  if (titleH) blocks.push(titleRect());
  if (shortRect) blocks.push(shortRect); // an open short expansion reads where it is: no verb or count is set under it
  const clear = (r: Rect) => !blocks.some(b => r.x < b.x + b.w + 3 && b.x < r.x + r.w + 3 && r.y < b.y + b.h + 3 && b.y < r.y + r.h + 3);
  // At rest: every line drawn now (on a busy map its summary lines, each with its count) carries its label. Lines of one kind
  // meeting the same part share one label only when theirs would read the same (the first of them carries it).
  if (!selected && !planView.isOpen()) {
    const drawn = shownLines(), seenEnd = new Set<string>();
    const rest = [...world.querySelectorAll<SVGGElement>('.edge')].filter(g => drawn.has(g.dataset.key!) && !g.classList.contains('hit')).filter(g => {
      const e = edgeOf(g.dataset.key); if (!e) return false;
      const k = `${e.to}|${e.kind}|${lineChans.get(e.key) ?? ''}|${restWord(e)}`; if (seenEnd.has(k)) return false;
      seenEnd.add(k); return true;
    });
    if (rest.length) placeRestLabels(box, rest, clear);
    return;
  }
  if (!selected) { if (lines.length) placeRestLabels(box, lines, clear); return; }
  const shown = shownLines();
  for (const g of lines) {
    const e = lay.edges.find(x => x.key === g.dataset.key), path = g.querySelector<SVGPathElement>('.edge-line'); if (!e || !path) continue;
    const on = g.classList.contains('on'), fan = on && (fans.get(selKey(e)) ?? 0) > 1;
    if (on && seenSel.has(selKey(e))) continue;
    const verb = `${wordOf(e)}${!fan && e.ids.length > 1 ? ` ${e.ids.length}` : ''}${edgeRevised(e) ? REVISED_EDGE : ''}`;
    // The selection's line says what it hands over (the head of its note) where its runs have room; the verb alone otherwise.
    // (Not when the line's own label already says the same words, as a payload often does.)
    const head = on && !fan && e.notes.length === 1 && !plannedNote(e.notes[0]!) ? noteHead(e.notes[0]!) : '', said = head === wordOf(e) ? '' : head;
    const label = h('span', { class: `edge-label k-${e.kind}${on ? ' on' : ''}${edgeRevised(e) ? ' revised' : ''}` }, verb);
    box.append(label);
    const inv = labelInv(), pts = edgePts(e.key, path), len = path.getTotalLength(), prefer = fan ? (e.to === selected ? 'end' : 'start') : 'long';
    let spot: Rect | null = null;
    const tryAt = (text: string) => { label.textContent = text; const tw = label.offsetWidth * inv, th = label.offsetHeight * inv; return labelSpots(pts, tw, th, prefer).find(r => clear(r) && !lineUnder(r, e.key, shown)) ?? null; };
    if (said) { label.classList.add('said'); spot = tryAt(`${verb} · ${said}`); if (!spot) label.classList.remove('said'); }
    if (!spot) spot = tryAt(verb);
    // A payload or a beat too long for its line gives way to the channel's short word ('제어', the verb), on the same places.
    const brief = `${shortOf(e)}${!fan && e.ids.length > 1 ? ` ${e.ids.length}` : ''}${edgeRevised(e) ? REVISED_EDGE : ''}`;
    if (!spot && brief !== verb) spot = tryAt(brief);
    const w = label.offsetWidth * inv, hh = label.offsetHeight * inv;
    // A selected corrected line keeps its meaning on the map: more room along its line (beside it too), then only the short
    // mark, along the line, then beside the selected card or the other end. Never over a part, a head, the title or a verb.
    if (!spot && on && edgeRevised(e)) {
      const along = (wd: number, ht: number) => Array.from({ length: 17 }, (_, i) => 0.1 + i * 0.05).flatMap(t => {
        const q = path.getPointAtLength(len * t); return [[0, 0], [0, -(ht + 4)], [0, ht + 4], [-(wd / 2 + 6), 0], [wd / 2 + 6, 0]].map(([dx, dy]) => ({ x: q.x - wd / 2 + dx!, y: q.y - ht / 2 + dy!, w: wd, h: ht }));
      });
      const beside = (wd: number, ht: number) => [lay.boxes.get(selected!), lay.boxes.get(e.from === selected ? e.to : e.from)].flatMap(b => !b ? [] : [
        { x: b.x, y: b.y - ht - 6 }, { x: b.x + b.w - wd, y: b.y - ht - 6 }, { x: b.x, y: b.y + b.h + 6 }, { x: b.x + b.w - wd, y: b.y + b.h + 6 },
        { x: b.x - wd - 6, y: b.y + b.h / 2 - ht / 2 }, { x: b.x + b.w + 6, y: b.y + b.h / 2 - ht / 2 }].map(r => ({ ...r, w: wd, h: ht })));
      spot = along(w, hh).find(clear) ?? null;
      if (!spot) {
        label.textContent = REVISED_SHORT; label.classList.add('short');
        const sw = label.offsetWidth * inv, sh = label.offsetHeight * inv;
        spot = along(sw, sh).find(clear) ?? beside(sw, sh).find(clear) ?? null;
      }
    }
    if (!spot) { label.remove(); continue; }
    label.style.left = `${spot.x}px`; label.style.top = `${spot.y}px`; blocks.push(spot);
    if (on) seenSel.add(selKey(e));
  }
  // The dimmed summary beside the selection keeps its counts (what each line still holds), after the selection's verbs.
  if ($('space').classList.contains('sel-sum')) placeCounts(box, clear, blocks, true, shown);
}
/** How many relations a summary line holds, on the line where it reads clear of parts (a line of one relation has none).
 * Beside a selection (dimmed, .beside) a count that finds no clear place is left off rather than set over a part or a verb. */
function placeCounts(box: HTMLElement, clear: (r: Rect) => boolean, blocks: Rect[], beside = false, shown = shownLines()) {
  // Beside a selection a count also keeps off the selection's own lines, where it would read as theirs.
  const onPts = beside ? [...$('world').querySelectorAll<SVGPathElement>('.edge.on .edge-line')].flatMap(p => { const n = p.getTotalLength(); return Array.from({ length: Math.ceil(n / 6) + 1 }, (_, i) => p.getPointAtLength(Math.min(n, i * 6))); }) : [];
  const off = (r: Rect) => clear(r) && !onPts.some(q => q.x > r.x - 4 && q.x < r.x + r.w + 4 && q.y > r.y - 4 && q.y < r.y + r.h + 4);
  for (const g of $('world').querySelectorAll<SVGGElement>('.edge.sum:not(.hit)')) {
    const e = edgeOf(g.dataset.key), path = g.querySelector<SVGPathElement>('.edge-line'); if (!e || !path || e.ids.length < 2) continue;
    // The verb with the count ('넘겨줌 3'): a bare number on a line reads as nothing in particular.
    const chip = h('span', { class: `edge-count k-${e.kind}${beside ? ' beside' : ''}` }, `${REL_LABEL[e.kind] ?? e.kind} ${e.ids.length}`); box.append(chip);
    const inv = labelInv(), w = chip.offsetWidth * inv, hh = chip.offsetHeight * inv;
    // On a straight run of its own line, clear of corners, parts and other lines; a count with no such place is left off.
    const spot = labelSpots(edgePts(e.key, path), w, hh, 'long').find(r => off(r) && !lineUnder(r, e.key, shown)) ?? null;
    if (!spot) { chip.remove(); continue; }
    chip.style.left = `${spot.x}px`; chip.style.top = `${spot.y}px`; blocks.push(spot);
  }
}
/** A line's label at rest (spec 2.3): data says what it hands over (its payload, else the head of its one note), control what
 * starts it ('기동 · …', else '제어'), a reference '참조'; a line holding several relations says how many. */
function restWord(e: Edge): string {
  let w = wordOf(e);
  if (lineChans.get(e.key) === 'data' && w === (REL_LABEL[e.kind] ?? e.kind) && e.notes.length === 1 && !plannedNote(e.notes[0]!)) w = noteHead(e.notes[0]!) || w;
  return `${w}${e.ids.length > 1 ? ` ${e.ids.length}` : ''}${edgeRevised(e) ? REVISED_EDGE : ''}`;
}
/** Labels at rest: each on a straight run of its own line with room for it and 8px of line on each side (the longest level
 * run first), else beside the line just short of the part it points to; never on a corner, over another line (where lines
 * cross), a part, a head or the title. Two that would touch keep the one with the better place (the first line on a tie),
 * the other takes its next place; a label with none left is hidden until its line is selected (.label-hidden, still hovered
 * for its meaning), counted in the map's data-labels-hidden. Fonts never shrink to make room. */
const REST_PAD = 8;
function placeRestLabels(box: HTMLElement, lines: SVGGElement[], clear: (r: Rect) => boolean) {
  const spots: (LabelSpot & { el: HTMLElement })[] = [], hidden: SVGGElement[] = [], shown = shownLines(), inv = labelInv();
  for (const g of lines) {
    const e = edgeOf(g.dataset.key), path = g.querySelector<SVGPathElement>('.edge-line'); if (!e || !path) continue;
    const label = h('span', { class: `edge-label k-${e.kind}${edgeRevised(e) ? ' revised' : ''}` }, restWord(e));
    box.append(label);
    const w = label.offsetWidth * inv, hh = label.offsetHeight * inv, pts = edgePts(e.key, path);
    const free = (r: Rect) => clear(r) && !lineUnder(r, e.key, shown);
    const run = labelSpots(pts, w, hh, 'long', REST_PAD).filter(free).slice(0, 10);
    const port = portSpots(pts, w, hh).filter(r => free(r) && !polylineHitsRect(pts, r, 1));
    const mine = [...run, ...port];
    if (!mine.length) { label.remove(); hidden.push(g); continue; }
    // Better places first, across all labels: every label's first place before any label's second.
    mine.forEach((r, i) => spots.push({ key: e.key, ...r, dist: i, el: label }));
  }
  const { kept, dropped } = resolveLabels(spots, 6);
  for (const s of kept) { s.el.style.left = `${s.x}px`; s.el.style.top = `${s.y}px`; }
  for (const s of spots) if (dropped.includes(s.key)) s.el.remove();
  for (const g of lines) if (dropped.includes(g.dataset.key!) || hidden.includes(g)) g.classList.add('label-hidden');
  $('world').dataset.labelsHidden = String(dropped.length + hidden.length);
}

function renderRecent() {
  const o = opened!, sp = partOf(o, scope), all = sp ? subtreeRecords(o.view, sp.id) : o.view.records, LATEST = 7;
  const items = recentAll ? all : all.slice(0, LATEST), partial = items.length < all.length;
  // No records here: no entry and no reserved room.
  const none = !all.length, shown = recentShown() && !none;
  $('recent-toggle').hidden = none;
  $('recent-badge').textContent = String(all.length);
  $('recent-title').textContent = sp ? `최근 기록 · ${sp.name}` : '최근 기록';
  $('recent-count').textContent = partial ? `최신 ${items.length} / ${all.length}` : String(all.length);
  $('recent').classList.toggle('collapsed', !shown);
  $('recent-toggle').setAttribute('aria-expanded', String(shown));
  $('recent-toggle').classList.toggle('on', shown);
  $('recent-list').replaceChildren(...items.map(r => {
    const part = r.partId ? o.view.parts.find(x => x.id === r.partId) : null;
    return h('li', {}, h('button', { type: 'button', class: 'recent-item', disabled: !part, onclick: () => { if (part) { pendingRecord = r.id; go(o.key, part.id); } } },
      h('span', { class: 'ri-top' }, h('strong', {}, part?.name ?? '부분 미지정'), h('span', { class: 'ri-kind' }, RECORD_LABEL[r.kind]), h('span', { class: 'ri-time' }, ago(r.at))),
      h('span', { class: 'ri-text' }, firstLine(r.text, 70))));
  }), ...(all.length > LATEST ? [h('li', { class: 'recent-more' }, h('button', { type: 'button', class: 'link-button', onclick: () => { recentAll = !recentAll; renderRecent(); } }, recentAll ? `최신 ${LATEST}개만 보기` : `전체 ${all.length}개 보기`))] : []));
}

/* ---------- camera ---------- */
const ZOOM_MIN = 0.4, ZOOM_MAX = 1.6, OPEN_MIN = 0.6;
/** The chip scale the verbs were last placed at, and the frame that re-places them after a zoom. */
let placedInv = 1, relabel = 0;
/** The reading pane is a column of its own on the right: the map's viewport ends where the pane begins (syncMapArea), so nothing
 * the person reads is ever drawn under it and the geometry below needs no inset for it.
 * Width of the reading pane while anything reads there (a part, its sheet, a comparison or the whole plan); 0 otherwise. */
// The change plan's wide workspace covers the map without taking width from it: the map under it keeps its area and camera.
const paneWidth = () => (!$('lens').hidden && $('panel').hidden && $('lens').classList.contains('railed') ? RAIL_W : ['lens', 'panel'].some(id => !$(id).hidden) || (!$('plan-panel').hidden && !$('plan-panel').classList.contains('work')) ? inspW() : 0);
const leftInset = () => 16;
/** Map tools sit at the bottom left; the map keeps clear of them only below this line. */
const BOTTOM = 64;
function applyCamera(animate = false) {
  const world = $('world'), vp = $('viewport');
  world.classList.toggle('animate', animate);
  world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`;
  vp.style.backgroundPosition = `${camera.x}px ${camera.y - vp.offsetTop}px`;
  vp.style.backgroundSize = `${28 * camera.k}px ${28 * camera.k}px`;
  $('zoom-level').textContent = `${Math.round(camera.k * 100)}%`;
  // Density follows the zoom: below 70% notes and state lines go and names read on one line across the card, a little larger
  // (never past 1.25×, so a name is cut only when it truly does not fit); below 60% that is all a box shows. Nothing is
  // removed from the page or its layout.
  const sp = $('space');
  sp.classList.toggle('z-mid', camera.k < Z_MID); sp.classList.toggle('z-low', camera.k < 0.6); // z-mid: 70% as shown and below
  // The zoom level (개요 · 중간 · 상세): what a typed card keeps. The cards take their level's height and the lines their new
  // routes in one redraw, once the zoom has crossed a level's edge (never on every step of a wheel).
  const lv = zoomLevel(camera.k);
  sp.classList.toggle('lv-overview', lv === 'overview'); sp.classList.toggle('lv-mid', lv === 'mid'); sp.classList.toggle('lv-detail', lv === 'detail');
  if (opened && laidKey && levelKey(camera.k) !== laidKey && !relevel) relevel = window.setTimeout(() => {
    relevel = 0;
    if (!opened || $('space').hidden || levelKey(camera.k) === laidKey) return;
    renderSpace('keep'); if (selected) markSelection(selected);
  }, 120); // a timer, not a frame: a wheel settles first, and a hidden page still redraws
  sp.style.setProperty('--grow', String(Math.min(1.25, Math.max(1, 0.85 / camera.k))));
  // Chips on the lines (verbs, counts) grow as the map shrinks, up to 1.5×, so they stay readable; their places are found
  // again when the scale changed enough to matter.
  const inv = Math.min(1.5, Math.max(1, 0.8 / camera.k));
  sp.style.setProperty('--inv', inv.toFixed(3));
  if (Math.abs(inv - placedInv) > 0.1 && opened && !relabel) { relabel = requestAnimationFrame(() => { relabel = 0; placedInv = inv; placeEdgeLabels(); }); }
  updateSticky();
  saveViewSoon();
}
/** Whole view in the free area. Opening shrinks to 60% at most, so a large map opens whole (names stay readable on one line
 * there, see applyCamera); only the explicit 전체 보기 button may go further. A map smaller
 * than the window sits near the top (a page is read from its top) and, while the pane is closed, leaves the pane's room free on
 * the right when there is enough of it, so opening a reading later rarely has to move the map. */
function fitView(explicit: boolean, animate = false) {
  const o = opened; if (!o) return;
  syncMapArea();
  const vp = $('viewport').getBoundingClientRect(), left = leftInset() + 8, right = 24, top = topInset() + 12, bottom = mapBottomInset() + 8;
  const w = Math.max(200, vp.width - left - right), hgt = Math.max(160, mapBottom() - top - bottom), B = lay.bounds;
  const fit = Math.min(1, w / Math.max(1, B.w + 40), hgt / Math.max(1, B.h + 40));
  const k = explicit ? Math.max(ZOOM_MIN, fit) : Math.max(OPEN_MIN, fit);
  // The whole view sits in the middle of the free area, both ways: the title and the parts together. A reading pane opened
  // later pans the map by the least amount that keeps the selected part in view (reveal), so no room is kept for it here.
  const mw = B.w * k, mh = B.h * k, free = w - mw;
  const xoff = free <= 0 ? 12 : free / 2;
  const yoff = mh <= hgt ? (hgt - mh) / 2 : 12;
  camera = { k, x: left + xoff - B.x * k, y: top + yoff - B.y * k };
  applyCamera(animate);
}
function zoomAt(k: number, cx: number, cy: number, animate = false) {
  const nk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));
  camera = { k: nk, x: cx - (cx - camera.x) * (nk / camera.k), y: cy - (cy - camera.y) * (nk / camera.k) };
  applyCamera(animate);
}
/** Smallest pan that brings a world rectangle into the free map area (left of the reading pane, above the tools); never a
 * zoom. Larger than the area: its top-left corner comes in. */
function revealRect(B: { x: number; y: number; w: number; h: number }, keepRight = 0, keepBottom = 0) {
  const vp = $('viewport').getBoundingClientRect(), left = leftInset() + 16, right = vp.width - 24 - keepRight, top = topInset() + 4, bottom = mapBottom() - mapBottomInset() - 12 - keepBottom;
  const sx = camera.x + B.x * camera.k, sy = camera.y + B.y * camera.k, sw = B.w * camera.k, sh = B.h * camera.k;
  let dx = 0, dy = 0;
  if (sx + sw > right) dx = right - (sx + sw);
  if (sx + dx < left) dx = left - sx;
  if (sy + sh > bottom) dy = bottom - (sy + sh);
  if (sy + dy < top) dy = top - sy;
  if (dx || dy) { camera = { ...camera, x: camera.x + dx, y: camera.y + dy }; applyCamera(true); }
}
/** Keep the selected part visible beside the pane (a large frame: its head and first rows). When the part and the other ends
 * of its lines fit together at this zoom, they come into view together. */
function reveal(partId: string) {
  const b = lay.boxes.get(partId); if (!b) return;
  const ends = lay.edges.filter(e => e.from === partId || e.to === partId).map(e => lay.boxes.get(e.from === partId ? e.to : e.from)).filter((x): x is NonNullable<typeof x> => !!x);
  const own = { x: b.x, y: b.y, w: Math.min(b.w, 420), h: Math.min(b.h, 300) };
  if (ends.length) {
    const all = [own, ...ends], x = Math.min(...all.map(r => r.x)), y = Math.min(...all.map(r => r.y));
    const B = { x, y, w: Math.max(...all.map(r => r.x + r.w)) - x, h: Math.max(...all.map(r => r.y + r.h)) - y };
    const area = mapArea();
    if (B.w * camera.k <= area.w - 24 && B.h * camera.k <= area.h - 24) { revealRect(B); return; }
  }
  revealRect(own);
}

/* ---------- selection & panel ---------- */
let pendingRecord: string | null = null;
/** One reading surface per selection, always in the pane: the lens (what the part is and how it is linked), or the reading sheet
 * (sources, records, questions, edits) in its place. Closing the sheet brings the same lens back with the same selection,
 * camera and drafts. */
let sheetOpen = false;
function select(partId: string | null) {
  if (openState && openState.part !== partId) closeOpen(false); // an opening belongs to its part: another selection closes it
  const changed = selected !== partId;
  if (changed) { editing = false; composerOpen = false; if (ask && !ask.controller) ask = null; sheetOpen = !!pendingRecord; pickedStep = null; }
  if (!!selected !== !!partId) recentPeek = false;
  if (partId) scopeReading = false;
  selected = partId;
  if (opened) renderRecent();
  markSelection(partId);
  $('space').classList.toggle('dim', !!partId || !!scView);
  if (partId && scVisit) { scVisit = null; markVisit(); }
  const panel = $('panel');
  if (planView.isOpen()) { panel.hidden = true; panel.replaceChildren(); clearHighlight(); planView.selectionChanged(changed); return; }
  if (!partId) {
    panel.hidden = true; panel.replaceChildren(); clearHighlight();
    if (scVisit && scView) { renderVisitLens(); return; }
    if ($('lens').classList.contains('scenario-read')) hideLens();
    if (returnView.isOpen()) {
      // Back from a part read beside the return reading: the same reading, and the camera it had unless the map was moved.
      if (readingCamera && !mapMoved) { camera = readingCamera; applyCamera(true); }
      readingCamera = null; returnView.render(); return;
    }
    if (scopeReading) renderScopeLens(); else hideLens(); return;
  }
  if (returnView.isOpen()) { if (changed && !readingCamera) { readingCamera = { ...camera }; mapMoved = false; } readMarks = []; applyReadMarks(); }
  showReading(changed, changed);
  if (pendingRecord) { const id = pendingRecord; pendingRecord = null; openRecord(id); }
}
/** scrollTop: a new selection starts its sheet at the top. move: bring the part into view (a new selection or a new surface). */
function showReading(scrollTop: boolean, move: boolean) {
  const panel = $('panel');
  // AF140: the explicit full reading is the reading surface over the map (its own width, a paragraph's column); the lens stays as it
  // was. The map's area (paneWidth) is the same either way, so opening it moves the camera exactly as before and no more.
  panel.classList.toggle('reading', sheetOpen);
  if (sheetOpen) { hideLens(); panel.hidden = false; renderPanel(scrollTop); syncMapArea(); if (move) reveal(selected!); return; }
  panel.hidden = true; panel.replaceChildren();
  renderLens(); syncMapArea();
  if (move) reveal(selected!);
}
/** The camera before the sheet opened: closing the sheet comes back to it unless the person moved the map meanwhile. */
let sheetReturn: { x: number; y: number; k: number } | null = null, mapMoved = false;
function openSheet(then?: () => void) { if (!selected) return; sheetReturn = { ...camera }; mapMoved = false; sheetOpen = true; showReading(true, true); then?.(); }
function closeSheet() {
  if (!selected || !sheetOpen) return;
  sheetOpen = false; editing = false;
  if (sheetReturn && !mapMoved) { camera = sheetReturn; applyCamera(true); }
  sheetReturn = null;
  showReading(false, false);
  requestAnimationFrame(() => $('lens').querySelector<HTMLElement>('.lens-more')?.focus());
}
/** Re-render whichever surface is open (after an answer, a status change or an edit). */
function refreshReading() { if (!opened || !selected || planView.isOpen()) return; if (sheetOpen) renderPanel(false); else renderLens(); }

/* ---------- the reading pane and the map area ----------
 * Selection, comparison, explanation and sources read in one place: the pane on the right, as wide as a column of text and no
 * wider. The map keeps the rest of the window. Opening the pane never re-fits or zooms the map; the part being read is brought
 * beside it by the smallest pan, and only when it would be hidden. */
/** Parts the open surface is about when it is not the selection (the parts of a change the comparison reads). */
let readingFor: string[] = [];
type Rect = { x: number; y: number; w: number; h: number };
const toScreen = (b: { x: number; y: number; w: number; h: number }): Rect => ({ x: camera.x + b.x * camera.k, y: camera.y + b.y * camera.k, w: b.w * camera.k, h: b.h * camera.k });
const union = <T extends Rect>(rs: T[]): Rect => { const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y }; };
/** The change plan's strip takes the top of the map while it is open. */
const stripInset = () => { const strip = $('plan-strip'); return strip.hidden ? 16 : strip.offsetTop + strip.offsetHeight + 10; };
const topInset = () => stripInset() + (!$('plan-strip').hidden && !$('scope-sticky').hidden ? $('scope-sticky').offsetHeight + 8 : 0);
function mapArea(): Rect { const vp = $('viewport').getBoundingClientRect(), top = topInset(); return { x: 16, y: top, w: vp.width - 32, h: mapBottom() - top - mapBottomInset() }; }
function hideLens() { const l = $('lens'); l.hidden = true; l.replaceChildren(); l.classList.remove('compare', 'scope-read', 'railed', 'scenario-read'); readingFor = []; syncMapArea(); }
const mapBottomInset = () => BOTTOM;
const mapBottom = () => $('viewport').offsetTop + $('viewport').clientHeight;
/** The map's viewport: below the plan's strip when it is open, left of the pane when it is open. Camera coordinates stay
 * relative to the space, so neither moves anything already drawn. */
function syncMapArea() {
  const vp = $('viewport'), world = $('world'), pane = paneWidth();
  // AF140: behind the full reading the map is shown, not used: no pan, zoom, selection, drag or focus reaches it until it closes.
  // Only the lock this reading set is its to lift (marked); one already there (the change plan's wide comparison covers the same
  // map: plan-view cover) is never taken over or released here, nor one the comparison took while the reading's mark was on (the
  // mark goes, the lock stays while the comparison is open: the very state cover(workOpen()) locks under).
  const reading = !$('panel').hidden && $('panel').classList.contains('reading');
  const planCover = !$('plan-panel').hidden && $('plan-panel').classList.contains('work');
  for (const el of [vp, document.querySelector<HTMLElement>('#space > .controls')]) {
    if (!el) continue;
    if (reading && !el.inert) { el.inert = true; el.dataset.readingInert = '1'; }
    else if (!reading && el.dataset.readingInert) { delete el.dataset.readingInert; if (!planCover) el.inert = false; }
  }
  $('space').classList.toggle('sheet-read', reading);
  $('space').style.setProperty('--plan-w', `${pane}px`);
  vp.style.right = pane + 'px';
  const top = $('plan-strip').hidden ? 0 : topInset();
  vp.style.top = top + 'px'; vp.style.bottom = '0px';
  world.style.top = -top + 'px'; vp.style.backgroundPosition = camera.x + 'px ' + (camera.y - top) + 'px';
  updateSticky();
}
/** A new target to read (or an explicit resize): the target, its line ends and the title together when they fit beside the
 * pane; a large frame still reveals its own heading and first rows. Never a zoom. */
function revealParts(ids: string[]) {
  const boxes = ids.map(id => lay.boxes.get(id)).filter((b): b is Box => !!b && b.kind !== 'ghost'); if (!boxes.length) return;
  const own = union(boxes.map(b => ({ x: b.x, y: b.y, w: Math.min(b.w, 420), h: Math.min(b.h, 220) }))), area = mapArea(), set = new Set(boxes.map(b => b.id));
  const ends = lay.edges.filter(e => set.has(e.from) !== set.has(e.to)).map(e => lay.boxes.get(set.has(e.from) ? e.to : e.from)).filter((q): q is Box => !!q);
  const candidates = [[own, ...ends, ...(titleH ? [titleRect()] : [])], [own, ...ends], [own, ...(titleH ? [titleRect()] : [])], [own]];
  const fit = candidates.map(rs => union(rs)).find(r => r.w * camera.k <= area.w - 32 && r.h * camera.k <= area.h - 24) ?? own;
  revealRect(fit);
}
/** The scope's title belongs to the map; when a pan takes it out of view its name stays at the top left of the map. */
function updateSticky() {
  const st = $('scope-sticky'), o = opened;
  if (!o || !titleH) { st.hidden = true; return; }
  const vp = $('viewport').getBoundingClientRect(), t = toScreen(titleRect()), top = stripInset();
  st.style.top = `${top - 6}px`;
  st.hidden = t.y >= top - 8 && t.y + 24 * camera.k <= mapBottom() - mapBottomInset() && t.x + 120 >= 0 && t.x <= vp.width - 120;
  // One title at a time: the map's own title steps back while its name is pinned.
  document.querySelector('.map-title')?.classList.toggle('pinned', !st.hidden);
}
/** The state of a part as the source of what is said about it: a received summary, a written plan, or nothing yet. */
function stateText(part: PartView, records: RecordView[]): string {
  return part.status === 'plan' ? (records.length ? '요청 기록 없음' : part.note ? '계획 설명만 있음 · 기록 없음' : '기록 없음') : STATUS_LABEL[part.status];
}
/** The visible representative of a part in this view (itself or its nearest drawn ancestor), null outside the scope. */
function drawnRep(o: Opened, id: string): string | null {
  for (let c = partOf(o, id), g = 0; c && g < 64; c = partOf(o, c.parentId), g++) { const b = lay.boxes.get(c.id); if (b && b.kind !== 'ghost') return c.id; }
  return null;
}
/** A part's relations by their real ends. A part drawn folded stands for its inside: a relation of an inner part counts,
 * with that inner part as its near end. The lens and the reading sheet list the same relations. */
interface End { r: StudioView['relations'][number]; near: string; far: string; out: boolean }
function relationEnds(o: Opened, partId: string): End[] {
  const drawn = lay.boxes.has(partId), out: End[] = [];
  for (const r of o.view.relations) {
    const a = drawn ? drawnRep(o, r.from) : r.from, c = drawn ? drawnRep(o, r.to) : r.to;
    if (a === partId && c !== partId) out.push({ r, near: r.from, far: r.to, out: true });
    else if (c === partId && a !== partId) out.push({ r, near: r.to, far: r.from, out: false });
  }
  return out;
}
/** The scope's own relations to parts outside it (its inside's relations are drawn on the map, or as side entries). */
function scopeEnds(o: Opened): End[] {
  if (!scope) return [];
  const inside = (id: string) => { for (let p = partOf(o, id), g = 0; p && g < 64; p = partOf(o, p.parentId), g++) if (p.id === scope) return true; return false; };
  return o.view.relations.flatMap((r): End[] => r.from === scope && !inside(r.to) ? [{ r, near: r.from, far: r.to, out: true }] : r.to === scope && !inside(r.from) ? [{ r, near: r.to, far: r.from, out: false }] : []);
}
/** Reading the scope itself in the pane (the map title's 범위 설명): its whole description as written, where it sits, its relations
 * to the outside and its parts with their sizes. Selecting a part replaces it. */
let scopeReading = false;
function openScopeReading() { const o = opened; if (!o) return; if (selected) { scopeReading = true; go(o.key); return; } scopeReading = true; renderScopeLens(); }
function renderScopeLens() {
  const o = opened; if (!o) return;
  const l = $('lens'), sp = partOf(o, scope), text = (sp ? sp.note : o.project.space.brief?.text ?? '').trim();
  const kids = (sp ? sp.childIds : o.view.roots).map(id => partOf(o, id)!).filter(Boolean);
  const outside = relationGroups(scopeEnds(o), '범위');
  const path = sp ? partPath(o.view, sp.id).slice(0, -1) : [];
  l.classList.remove('compare', 'railed'); l.classList.add('scope-read'); readingFor = [];
  l.replaceChildren(
    h('header', { class: 'lens-head' },
      h('div', { class: 'lens-path' }, h('span', {}, sp ? '들어와 있는 곳' : '프로젝트'), ...path.flatMap(x => [h('span', { 'aria-hidden': 'true' }, '›'), h('a', { href: hashFor(o.key, null, x.id), title: x.name }, x.name)])),
      h('h2', { id: 'lens-title' }, sp ? sp.name : o.project.name),
      h('div', { class: 'head-tools' }, h('button', { type: 'button', class: 'close', 'aria-label': '범위 설명 닫기', title: '닫기 (Esc)', onclick: closeScopeReading }, '×'))),
    h('div', { class: 'lens-body' },
      h('div', { class: 'lens-desc' }, text ? h('p', { class: 'lens-text' }, text) : null, h('p', { class: 'lens-src' }, h('span', {}, sp ? '적어 둔 설명 · 원문 그대로' : '프로젝트 설명 · 원문 그대로'))),
      ...outside.map(g => h('section', { class: 'lens-ports' }, h('h3', {}, g.label, h('small', {}, String(g.list.length))),
        h('ul', {}, ...g.list.map(x => h('li', {}, h('button', { type: 'button', class: 'port', 'data-far': x.far, onclick: (e: Event) => { follow(x.far, x.r, e); go(o.key, x.far, null); } },
          h('span', { class: 'port-top' }, h('span', { class: 'port-dir', 'aria-hidden': 'true' }, dirMark(x.r.kind, x.out)), h('strong', {}, partOf(o, x.far)?.name ?? '부분')),
          x.r.note ? h('span', { class: 'port-note' }, x.r.note) : null)))))),
      kids.length ? h('section', { class: 'lens-ports' }, h('h3', {}, sp ? '안의 부분' : '최상위 구성', h('small', {}, String(kids.length))),
        h('ul', {}, ...kids.map(k => h('li', {}, h('button', { type: 'button', class: 'port', onclick: () => go(o.key, k.id) },
          h('span', { class: 'port-top' }, h('strong', {}, k.name), k.childIds.length ? h('span', { class: 'port-count' }, `안쪽 ${k.childIds.length}`) : null),
          mapLead(o.view, k.id) ? h('span', { class: 'port-note' }, mapLead(o.view, k.id)) : null))))) : null));
  l.hidden = false; syncMapArea();
}
function closeScopeReading() { scopeReading = false; if ($('lens').classList.contains('scope-read')) hideLens(); }

/* ---------- the scenario on the map (spec §3, cycle 3): one foreground scenario at a time ----------
 * Entering it changes no selection and no camera: each visit's badge sits at its part's card (top-left, never moving a card),
 * the links light the existing lines between the visits' parts, parts the path does not visit step back (the space's dim),
 * the start head stands above the first visit and the end head below the last confirmed one. Escape leaves it. */
/** The scenario reading shown (its id), the visit chosen on it, and the scenario as resolved against the project now. */
let scOn: string | null = null, scVisit: string | null = null, scView: ScenarioUnderstanding | null = null, scBroken: BrokenPlace | null = null;
const scenarioReadings = (o: Opened): ScenarioReading[] => o.project.readings.filter(isScenarioReading);
const scenarioEntry = (o: Opened, id: string) => scenarioReadings(o).find(r => r.id === id) ?? null;
/** The record a scenario reading read, as pasted (empty when it is not there). */
const scenarioText = (o: Opened, e: ScenarioReading) => o.project.pasted.find(r => r.id === e.record)?.text ?? '';
/** The title's scenario line: every stored scenario (name · kind · pathStatus); choosing one shows it on the map, again leaves it. */
function scenarioStrip(o: Opened): HTMLElement | null {
  const all = scenarioReadings(o); if (!all.length) return null;
  const el = h('div', { class: 'map-flow map-scenarios', role: 'group', 'aria-label': '시나리오' }, h('span', { class: 'mf-verb' }, '시나리오'));
  all.forEach(e => {
    const c = e.scenario.scenario, on = scOn === e.id, label = scenarioLabel(c?.name, c?.kind, e.pathStatus);
    el.append(h('button', { type: 'button', class: `mf-step sc-pick${on ? ' on' : ''}`, 'data-scenario': e.id, 'aria-pressed': String(on),
      title: `${c?.id ?? '시나리오'} · ${label} · 방문 ${e.scenario.visits.length} · 이어짐 ${e.scenario.links.length}${e.diagnostics.length ? ` · 제외 ${e.diagnostics.length}` : ''}\n${on ? '다시 누르거나 Esc: 시나리오 보기 끝내기' : '지도에서 이 경로 보기'}`,
      onclick: () => { if (scOn === e.id) leaveScenario(); else enterScenario(e.id); } }, label));
  });
  // What has no place on this map: visits whose part is gone (끊긴 자리), visits outside this view, a rejected path's statements.
  const u = scOn ? scenarioUnderstanding(o.project, scOn) : null;
  if (u) {
    const lay0 = badgePlaces(u, id => drawnRep(o, id)), notes: HTMLElement[] = [];
    if (u.pathStatus === 'rejected') notes.push(h('p', { class: 'sc-note sc-problem' }, h('strong', {}, '경로 거절'), ' · 시나리오의 기준이 맞지 않아 길을 그리지 않았어요.',
      ...u.statements.map(s => h('span', { class: 'sc-statement' }, ` ${s.kind === 'produced' ? '설계가 내놓는 결과' : s.kind === 'desired' ? '바라는 결과' : '이탈 결과'}: ${s.text}`))));
    if (lay0.gone.length) notes.push(h('p', { class: 'sc-note sc-problem' }, h('strong', {}, '끊긴 자리'), ` · 지도에 없는 부분의 방문 ${lay0.gone.length}: `,
      lay0.gone.map(v => `${visitNumber(v.id)} ${v.partName}`).join(' · ')));
    if (lay0.outside.length) notes.push(h('p', { class: 'sc-note' }, h('strong', {}, '이 범위 밖'), ` · 방문 ${lay0.outside.length}: `, lay0.outside.map(v => `${visitNumber(v.id)} ${v.partName}`).join(' · ')));
    if (notes.length) el.append(h('div', { class: 'sc-notes' }, ...notes));
  }
  return el;
}
function enterScenario(id: string) {
  const o = opened; if (!o || !scenarioEntry(o, id)) return;
  scOn = id; scVisit = null; redrawScenario();
  if ($('lens').classList.contains('scenario-read')) hideLens();
  if (selected) refreshReading(); // the selected part's lens says whether the path visits it
}
function leaveScenario() {
  const o = opened; if (!o || !scOn) return;
  const focusPart = document.activeElement?.closest<HTMLElement>('.sc-badge')?.closest<HTMLElement>('[data-part]')?.dataset.part ?? null;
  scOn = null; scVisit = null; redrawScenario();
  if ($('lens').classList.contains('scenario-read')) hideLens();
  if (selected) refreshReading();
  if (focusPart) document.querySelector<HTMLElement>(`[data-drag="${CSS.escape(focusPart)}"]`)?.focus({ preventScroll: true });
}
/** The map again in place (the title's scenario line changes its height): same camera, same selection. */
function redrawScenario() {
  const o = opened; if (!o) return;
  renderSpace('keep'); markSelection(selected);
}
/** The scenario's marks on the map drawn now (after every redraw): badges, path lines, dimmed parts, heads, the broken place. */
function drawScenario() {
  const o = opened, world = $('world'), sp = $('space');
  world.querySelectorAll('.sc-badge, .sc-head').forEach(el => el.remove());
  world.querySelectorAll('.sc-visit').forEach(el => el.classList.remove('sc-visit'));
  world.querySelectorAll('.edge.sc-path').forEach(el => el.classList.remove('sc-path', 'sc-back'));
  const entry = o && scOn ? scenarioEntry(o, scOn) : null;
  scView = o && entry ? scenarioUnderstanding(o.project, entry.id) : null;
  if (!scView) { scOn = null; scVisit = null; scBroken = null; }
  scBroken = o && entry && scView ? brokenPlace(scView, entry.diagnostics, scenarioText(o, entry)) : null;
  sp.classList.toggle('scenario', !!scView);
  sp.classList.toggle('dim', !!selected || !!scView);
  if (!o || !scView) return;
  const u = scView, places = badgePlaces(u, id => drawnRep(o, id));
  for (const p of places.places) {
    const card = world.querySelector<HTMLElement>(`.node[data-box="${CSS.escape(p.box)}"], .frame[data-box="${CSS.escape(p.box)}"]`); if (!card) continue;
    card.classList.add('sc-visit');
    const badge = h('span', { class: 'sc-badge', role: 'group', 'aria-label': `방문 ${p.visits.map(v => v.n).join(', ')}` });
    p.shown.forEach((v, i) => {
      if (i) badge.append(h('span', { class: 'sc-sep', 'aria-hidden': 'true' }, '·'));
      badge.append(h('button', { type: 'button', class: `sc-v${scVisit === v.id ? ' on' : ''}`, 'data-visit': v.id, 'aria-pressed': String(scVisit === v.id), title: v.title,
        'aria-label': `${v.title.replace(/\n/g, ' · ')} · 방문 선택`, onclick: (e: Event) => { e.stopPropagation(); selectVisit(scVisit === v.id ? null : v.id); } },
        h('span', { class: 'sc-n' }, v.n), ...v.glyphs.map(g => h('span', { class: `sc-glyph k-${g.kind}`, 'aria-hidden': 'true' }, g.glyph))));
    });
    // Past two: the rest by count, never as a range (03–07); the first of them is chosen from it, the pane lists all.
    if (p.more) { const rest = p.visits.slice(2); badge.append(h('span', { class: 'sc-sep', 'aria-hidden': 'true' }, '·'), h('button', { type: 'button', class: `sc-v sc-more${rest.some(v => v.id === scVisit) ? ' on' : ''}`, 'data-visit': rest[0]!.id,
      title: rest.map(v => v.title).join('\n\n'), 'aria-label': `방문 ${rest.map(v => v.n).join(', ')} 더 · 첫 방문 선택`, onclick: (e: Event) => { e.stopPropagation(); selectVisit(rest[0]!.id); } }, `+${p.more}`)); }
    if (scBroken && scBroken.visit && p.visits.some(v => v.id === scBroken!.visit))
      badge.append(h('span', { class: 'sc-broken', title: `${scBroken.kind === 'visit' ? `방문 ${scBroken.ref ?? `${(scBroken.row ?? 0) + 1}번째 행`} 제외` : scBroken.kind === 'link' ? `이어짐 ${scBroken.ref ?? `${(scBroken.row ?? 0) + 1}번째 행`} 제외` : '끝에 닿지 않음'} · ${scBroken.explanation}` }, '여기서 끊김'));
    card.append(badge);
  }
  // The path: the existing lines the links cite, in the accent (with their heads); nothing new is drawn.
  const rels = new Set(pathRelations(u));
  world.querySelectorAll<SVGGElement>('.edge:not(.sum)').forEach(g => {
    const e = edgeOf(g.dataset.key); if (!e || !e.ids.some(id => rels.has(id))) return;
    g.classList.add('sc-path'); layerEdge(g);
  });
  markVisit();
  placeScenarioHeads();
}
/** The heads above the first visit and below the last confirmed one, in map coordinates (they follow a drag, positionWorld). */
function placeScenarioHeads() {
  const o = opened, world = $('world'); world.querySelectorAll('.sc-head').forEach(el => el.remove());
  if (!o || !scView) return;
  const heads = headTexts(scView), boxOf = (id: string | null) => { const v = id ? scView!.visits.find(x => x.id === id) : null, rep = v ? drawnRep(o, v.areaId) : null; return rep ? lay.boxes.get(rep) ?? null : null; };
  const line = (x: { label: string; text: string }) => h('p', { class: 'sc-head-line' }, h('span', { class: 'sc-head-label' }, x.label), h('span', { class: 'sc-head-text', title: x.text }, x.text));
  const a = boxOf(heads.startVisit), z = boxOf(heads.endVisit);
  if (a) {
    const head = h('div', { class: 'sc-head sc-start', role: 'note', 'aria-label': '시나리오의 시작' }, ...heads.start.map(line),
      scBroken && !scBroken.visit ? h('p', { class: 'sc-head-line sc-problem' }, h('span', { class: 'sc-head-label' }, '여기서 끊김'), h('span', { class: 'sc-head-text', title: scBroken.explanation }, scBroken.explanation)) : null);
    head.style.left = `${a.x}px`; head.style.top = `${a.y - 14}px`; world.append(head);
  }
  if (z) {
    const head = h('div', { class: 'sc-head sc-end', role: 'note', 'aria-label': '시나리오의 끝' }, ...heads.end.map(line), heads.short ? h('p', { class: 'sc-head-line sc-short' }, heads.short) : null);
    head.style.left = `${z.x}px`; head.style.top = `${z.y + z.h + 10}px`; world.append(head);
  }
}
/** The chosen visit on its badge, and its links in and out (the path's other lines step back to the accent's light tone). */
function markVisit() {
  const world = $('world'), u = scView;
  world.querySelectorAll<HTMLElement>('.sc-v').forEach(b => { const on = !!scVisit && (b.dataset.visit === scVisit || (b.classList.contains('sc-more') && !!u && badgeHolds(b, scVisit))); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  const mine = new Set(u && scVisit ? [...visitLinks(u, scVisit).into, ...visitLinks(u, scVisit).out].filter(l => l.relation && l.relationOnMap).map(l => l.relation!.relationId) : []);
  world.querySelectorAll<SVGGElement>('.edge.sc-path').forEach(g => { const e = edgeOf(g.dataset.key); g.classList.toggle('sc-back', !!scVisit && !e?.ids.some(id => mine.has(id))); });
  markLines();
}
/** Whether a '+N' button stands for this visit. */
function badgeHolds(b: HTMLElement, id: string): boolean { return (b.getAttribute('title') ?? '').includes(`(${id})`); }
/** Each line's ends as it reads now: a selected line or a line of the scenario's path carries the accent's head and start dot. */
function markLines() {
  document.querySelectorAll<SVGGElement>('#world .edge').forEach(el => {
    const lit = el.classList.contains('on') || el.classList.contains('sc-path'), line = el.querySelector('.edge-line'); if (!line) return;
    const plain = el.classList.contains('k-related'), head = el.classList.contains('c-data') ? 'arrow' : 'arrow-open';
    line.setAttribute('marker-end', plain ? (lit ? 'url(#dot-on)' : 'url(#dot)') : lit ? `url(#${head}-on)` : `url(#${head})`);
    line.setAttribute('marker-start', lit ? 'url(#dot-on)' : 'url(#dot)');
  });
}
/** A badge chosen: that visit in the pane (a part selected before steps back, as choosing another part would), the map unmoved. */
function selectVisit(id: string | null) {
  const o = opened; if (!o || !scView) return;
  scVisit = id && scView.visits.some(v => v.id === id) ? id : null;
  markVisit();
  if (planView.isOpen()) return;
  if (selected && scVisit) { go(o.key); return; } // select(null) shows the visit
  if (scVisit) renderVisitLens(); else if ($('lens').classList.contains('scenario-read')) hideLens();
}
/** The chosen visit in the pane: its part, step, port, what it takes and hands over, its event, its evidence rows (their quotes as
 * citation chips) and its links in and out with their kind and condition. */
function renderVisitLens() {
  const o = opened, u = scView, entry = o && scOn ? scenarioEntry(o, scOn) : null; if (!o || !u || !entry || !scVisit) return;
  const v = u.visits.find(x => x.id === scVisit); if (!v) return;
  const l = $('lens'), ev = new Map(entry.scenario.evidence.map(e => [e.id, e])), text = scenarioText(o, entry);
  const MATERIAL: Record<string, string> = { file: '파일', run: '실행', report: '보고' }, STANCE: Record<string, string> = { stated: '명시적 내용', report: '보고', guess: '보고자 추정' };
  const row = (label: string, value: Node | string | null) => value === null ? null : h('div', { class: 'sc-row' }, h('dt', {}, label), h('dd', {}, value));
  const current = (now: boolean) => h('small', { class: now ? 'sc-now' : 'sc-gone' }, now ? ' · 지금 지도와 같음' : ' · 지금 지도에 없음');
  const step = v.step === 'unknown' ? '모름' : v.step === null ? '없음' : h('span', {}, `${v.step.ref} ${v.step.name}`, current(v.step.current));
  const port = v.port === 'unknown' ? '모름' : v.port === null ? '없음' : h('span', {}, `${v.port.ref} ${v.port.direction === 'in' ? '받음' : '냄'}: ${v.port.name}`, current(v.port.current));
  const arts = (a: typeof v.in) => a === 'unknown' ? '모름' : a.length ? a.map(x => `${x.ref} ${x.name}`).join(' · ') : '없음';
  const evidence = (ids: string[], word: string | null, key: string) => {
    const items = ids.map(id => ev.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
    if (!items.length && !word) return h('p', { class: 'fine' }, '근거 E가 없어요');
    return h('ul', { class: 'sc-evidence' }, ...items.map(e => {
      const at = e.quote ? text.indexOf(e.quote) : -1;
      return h('li', {}, h('span', { class: 'sc-ev-id' }, e.id), ` ${MATERIAL[e.material]} · ${saidText(e.source)} · 판본 ${saidText(e.versionOrRun)} · ${STANCE[e.stance]}`,
        e.quote ? (at >= 0 ? h('span', {}, ' ', quoteCite(`${key}:${e.id}`, { record: entry.record, quote: e.quote, from: at }, `${e.id} 인용`)) : h('q', { class: 'sc-quote' }, e.quote)) : h('small', {}, ' · 원문 미제공'));
    }), word ? h('li', { class: 'fine' }, word === 'report' ? 'E 대신 ‘보고’로 적음' : 'E 대신 ‘추정’으로 적음') : null);
  };
  const { into, out } = visitLinks(u, v.id);
  const linkRow = (x: (typeof into)[number], far: string) => {
    const fv = u.visits.find(y => y.id === far);
    return h('li', {}, h('button', { type: 'button', class: 'port sc-link', 'data-visit': far, title: linkTitle(x), onclick: () => selectVisit(far) },
      h('span', { class: 'port-top' }, h('span', { class: 'port-dir', 'aria-hidden': 'true' }, x.to === v.id ? '←' : '→'), h('strong', {}, `${visitNumber(far)} ${fv?.partName ?? far}`),
        h('span', { class: 'port-kind' }, `${LINK_WORD[x.kind]}${LINK_GLYPH[x.kind] ? ` ${LINK_GLYPH[x.kind]}` : ''}`)),
      h('span', { class: 'port-note' }, [x.id, x.relation ? `${x.relation.ref}${x.relationOnMap ? '' : ' · 지금 지도에 없는 연결'}` : '투어 읽기 순서',
        x.condition !== null ? `조건: ${saidText(x.condition)}` : '', x.policy !== null ? saidText(x.policy) : x.kind === 'wait' ? '재개 조건 미상' : ''].filter(Boolean).join(' · '))));
  };
  const links = (label: string, list: typeof into, far: (x: (typeof into)[number]) => string) => h('section', { class: 'lens-ports' }, h('h3', {}, label, h('small', {}, String(list.length))),
    list.length ? h('ul', {}, ...list.map(x => linkRow(x, far(x)))) : h('p', { class: 'fine' }, label === '들어오는 이어짐' ? '기록된 이어짐이 없어요(여기서 시작하거나 앞이 끊김)' : '기록된 이어짐이 없어요(여기서 멈추거나 뒤가 끊김)'));
  const broken = scBroken && scBroken.visit === v.id ? h('p', { class: 'sc-note sc-problem' }, h('strong', {}, '여기서 끊김'), ` · ${scBroken.explanation}`) : null;
  const c = entry.scenario.scenario;
  l.classList.remove('compare', 'railed', 'scope-read', 'return-read'); l.classList.add('scenario-read'); readingFor = [];
  l.replaceChildren(
    h('header', { class: 'lens-head' },
      h('div', { class: 'lens-path' }, h('span', {}, `시나리오 ${c?.id ?? ''} · ${scenarioLabel(c?.name, c?.kind, entry.pathStatus)}`)),
      h('h2', { id: 'lens-title' }, `방문 ${visitNumber(v.id)} · ${v.partName}`),
      h('div', { class: 'head-tools' }, h('button', { type: 'button', class: 'close', 'aria-label': '방문 선택 해제', title: '닫기 (Esc: 시나리오 보기 끝내기)', onclick: () => selectVisit(null) }, '×'))),
    h('div', { class: 'lens-body' },
      broken,
      h('dl', { class: 'sc-visit-facts' },
        row('부분', v.partOnMap ? h('button', { type: 'button', class: 'link-button', title: '이 부분 선택', onclick: () => go(o.key, v.areaId) }, `${v.part.ref} ${v.partName}`) : h('span', { class: 'sc-gone' }, `${v.part.ref} ${v.part.name} · 지금 지도에 없는 부분`)),
        row('단계', step), row('포트', port), row('필요한 입력', arts(v.in)), row('내놓는 출력', arts(v.out)), row('사건', saidText(v.event))),
      h('section', { class: 'lens-ports' }, h('h3', {}, '근거', h('small', {}, String(v.evidence.length))), evidence(v.evidence, v.evidenceWord, v.id)),
      links('들어오는 이어짐', into, x => x.from), links('나가는 이어짐', out, x => x.to),
      h('p', { class: 'fine' }, `${KIND_WORD[c?.kind ?? 'designed'] ?? ''} · 방문 번호는 기록이 붙인 그대로예요. 이어짐은 기록에 근거가 있는 것만 지도의 기존 연결 위에 밝혀요.`)));
  l.hidden = false; syncMapArea();
}
/** The paste result for a scenario record: 시나리오 C01 · 방문 N · 이어짐 M · pathStatus, with what was set aside in the
 * exclusion list's form, and the way to see it on the map. null when the record was not read as a scenario. */
function scenarioResult(recordId: string): HTMLElement | null {
  const o = opened; if (!o) return null;
  const e = [...scenarioReadings(o)].reverse().find(r => r.record === recordId); if (!e) return null;
  const c = e.scenario.scenario;
  return h('section', { class: 'rr-sec sc-result' },
    h('p', { class: e.pathStatus === 'rejected' ? 'pp-error' : 'pp-ok', role: 'status' }, scenarioResultLine(c?.id, e.scenario.visits.length, e.scenario.links.length, e.pathStatus)),
    h('p', { class: 'fine' }, `AI 없이 앱이 ID 대장 ${e.ledgerVersion ?? '(지도 읽기 없음)'}과 맞춰 읽었어요 · ${fullTime(e.at)}`),
    e.pathStatus !== 'rejected' ? h('button', { type: 'button', class: 'link-button', onclick: () => enterScenario(e.id) }, '지도에서 이 경로 보기') : null,
    e.diagnostics.length ? h('details', { class: 'rm-exclusions' }, h('summary', {}, `시나리오 읽기에서 제외한 내용 · 사유 ${e.diagnostics.length}건`),
      h('p', { class: 'fine' }, '제외한 행·칸은 길에 넣지 않았고 원문은 붙인 그대로 보관돼요. 번호는 다시 매기지 않고, 빠진 방문 양쪽을 잇지 않아요.'),
      h('ol', {}, ...e.diagnostics.map(d => h('li', {}, h('p', {}, d.explanation),
        h('details', { class: 'rm-exclusion-debug' }, h('summary', {}, '검사 정보'), h('small', {}, `${d.path} · ${d.rule}${d.category ? ` / ${d.category}` : ''}`)))))) : null);
}

/* The lens folds to a narrow rail on request, for this tab (memory only): the map's area takes the window back (paneWidth), the
 * rail keeps the selection's name and the way to open the reading again. Selection, Esc and the sheet work as before. */
let lensRail = false;
const RAIL_W = 44;
const railIcon = (open: boolean) => { const el = svg('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' }); el.append(svg('path', { d: open ? 'M3.5 4l4 4-4 4M8.5 4l4 4-4 4' : 'M12.5 4l-4 4 4 4M7.5 4l-4 4 4 4' })); return el; };
function setRail(on: boolean) {
  lensRail = on; if (!opened || !selected || sheetOpen || planView.isOpen()) return;
  renderLens(); syncMapArea();
  if (!on) reveal(selected);
  $('lens').querySelector<HTMLElement>('.rail-toggle')?.focus();
}
/** The lens: what the selection is (its whole description as written, with where that description comes from; the map shows
 * only its first sentence), what it is linked to, by verb (each line's real ends), its inside, and the way to sources and
 * edits. */
function renderLens() {
  const o = opened!, part = partOf(o, selected)!, l = $('lens'), b = lay.boxes.get(part.id);
  if (lensRail) {
    // Folded to a rail: the selection's name, read top to bottom, and the way to open the reading again.
    l.classList.remove('compare', 'scope-read', 'return-read'); l.classList.add('railed'); readingFor = [];
    l.replaceChildren(h('button', { type: 'button', class: 'rail-toggle', 'aria-label': '읽기면 펼치기', 'aria-expanded': 'false', title: `읽기면 펼치기 · ${part.name}`, onclick: () => setRail(false) }, railIcon(false)),
      h('span', { class: 'rail-name', id: 'lens-title', title: part.name, onclick: () => setRail(false) }, part.name));
    l.hidden = false; return;
  }
  l.classList.remove('railed');
  const records = subtreeRecords(o.view, part.id), path = partPath(o.view, part.id).slice(0, -1);
  const rest = part.note.replace(/\s+/g, ' ').trim();
  const dot = h('i', { class: `dot s-${part.status}`, 'aria-hidden': 'true' });
  const src = (text: string) => h('p', { class: `lens-src s-${part.status}` }, dot, h('span', {}, text));
  const recs = records.length ? `기록 ${records.length} · ${ago(records[0]!.at)}` : '기록 없음';
  const desc = h('div', { class: 'lens-desc' });
  if (part.summary) {
    const report = records.find(r => r.kind === 'report');
    put(desc, h('p', { class: 'lens-text' }, part.summary), src(`${STATUS_LABEL[part.status]} · ${part.origin ?? '전달받은 정리'}${report ? ` · ${ago(report.at)}` : ''}`),
      part.proposal ? h('p', { class: 'lens-proposal' }, h('strong', {}, '제안 · 아직 반영 안 됨 '), part.proposal) : null,
      rest ? h('p', { class: 'lens-plan' }, h('span', {}, '계획'), rest) : null);
  } else if (rest) {
    // The description is the person's written plan, not a received summary. A state line only when there is something to say
    // (records, a reported state); "no records yet" and where the text comes from read in the sheet (전체 읽기).
    const state = part.status === 'plan' ? (records.length ? `받은 정리 없음 · 요청 기록 없음 · ${recs}` : '') : `${STATUS_LABEL[part.status]} · ${recs}`;
    put(desc, rest ? h('p', { class: 'lens-text' }, rest) : null, state ? src(`적어 둔 계획 설명 · ${state}`) : null);
  } else if (part.reading?.role) {
    // Read from records (or corrected by the person): one description, with where it comes from.
    const u = part.reading;
    put(desc, h('p', { class: 'lens-text' }, u.role), src(u.corrected ? '직접 바로잡은 설명' : `기록에서 읽은 설명${u.roleAbout ? ` · ${displayAbout(u.roleAbout)} 기준` : ''}${u.roleBasisRevised ? REVISED_BASIS : ''}`));
    if (u.roleAbout) desc.lastElementChild?.setAttribute('title', u.roleAbout);
    const basis = roleBasisBlock(o, part.id, u, 'lens'); if (basis) desc.append(basis);
  } else put(desc, src(part.status === 'plan' ? (records.length ? `설명 없음 · 요청 기록 없음 · ${recs}` : part.reading ? '기록에서 읽은 말만 있어요' : '아직 설명도 기록도 없어요') : `${STATUS_LABEL[part.status]} · ${recs} · 받은 정리 없음`));
  if (part.changes.length) desc.append(h('ul', { class: 'lens-changes' }, ...part.changes.slice(0, 2).map(c => h('li', {}, c))));
  // Read the current statements together: a later limitation may qualify an earlier description.
  const claims = part.reading?.claims.length ? lensClaims(part.id, part.reading) : null;
  const requested = currentRequestResults(o, part.id);
  // Lines: real ends, read as what the part takes in and what it hands on (its flows, in then out), then what it is with (needs,
  // shares, related; each row says its verb). Each row is the real other end and what goes along the line: what a reading said is
  // handed over (its payload, how often, designed or seen), else the stored note (the reason of that relation); a line drawn from
  // a folded part summarises its inside, so its row also names the inner end. A row and its line on the map light each other.
  const ends = relationEnds(o, part.id), entry = visitEntry(o), cameFrom = entry ? visits.at(-1)!.from.selected : null;
  const handed = relationPayloads(o.project);
  const port = (x: End) => {
    const far = partOf(o, x.far)!, near = x.near !== part.id ? partOf(o, x.near)?.name : null, farRep = drawnRep(o, x.far);
    // The scope itself is this scope's boundary, not a place outside it.
    const where = farRep === x.far ? null : x.far === scope ? '이 범위' : farRep ? `${partOf(o, farRep)!.name} 안` : partPath(o.view, x.far).slice(0, -1).map(q => q.name).join(' › ') || o.project.name;
    const came = x.far === cameFrom, read = handed.get(x.r.id), revised = revisedLine(o, x.r.id), verb = x.r.kind === 'flow' ? null : relLabel(x.r.kind, x.out);
    const line = read?.payload ? `${read.payload}${read.cadence ? ` (${read.cadence})` : ''}${read.mode ? ` · ${MODE_LABEL[read.mode]}` : ''}` : x.r.note;
    return h('li', {}, h('button', { type: 'button', class: `port${came ? ' came' : ''}`, 'data-far': x.far, 'data-rel': x.r.id, title: `${far.name}${toParticle(far.name)} 가기${verb ? ` · ${verb}` : ''}${came ? ' · 이 관계를 따라 여기로 왔어요' : ''}`, onclick: (e: Event) => { follow(x.far, x.r, e); go(o.key, x.far); }, ...lightOn([x.r.id], x.far) },
      h('span', { class: 'port-top' }, h('span', { class: 'port-dir', 'aria-hidden': 'true' }, dirMark(x.r.kind, x.out)), h('strong', {}, far.name),
        verb ? h('span', { class: 'port-kind' }, REL_LABEL[x.r.kind] ?? x.r.kind) : null, came ? h('span', { class: 'port-came' }, '출발') : null),
      near || where ? h('span', { class: 'port-where' }, [near ? `안쪽 ‘${near}’에서` : '', where ? `${where}` : ''].filter(Boolean).join(' · ')) : null,
      line || revised ? h('span', { class: 'port-note', 'data-rel-note': x.r.id, ...(read?.payload && x.r.note ? { title: x.r.note } : {}) }, `${line}${revised ? REVISED_BASIS : ''}`.replace(/^ · /, '')) : null));
  };
  const portGroup = (label: string, hint: string, list: End[]) => list.length ? h('section', { class: 'lens-ports' }, h('h3', { title: hint }, label, h('small', {}, String(list.length))),
    h('ul', {}, ...list.slice(0, 8).map(port)), list.length > 8 ? h('button', { type: 'button', class: 'link-button', onclick: () => openSheet() }, `${list.length - 8}개 더 · 전체 읽기`) : null) : null;
  const ports = [portGroup('받는 것', '다른 부분이 이 부분에 넘겨주는 것', ends.filter(x => x.r.kind === 'flow' && !x.out)),
    portGroup('내는 것', '이 부분이 다른 부분에 넘겨주는 것', ends.filter(x => x.r.kind === 'flow' && x.out)),
    portGroup('함께', '필요로 함 · 함께 씀 · 관련', relationGroups(ends.filter(x => x.r.kind !== 'flow')).flatMap(g => g.list))];
  // A group drawn open: the lines that touch its frame belong to its inner parts. They read here from those parts, by verb and
  // direction, each row naming the inner part, the outside part and where that one belongs; following one records a visit.
  // Relations between two of its inner parts are drawn inside it and only counted.
  const inner = b?.kind === 'frame' ? insideEnds(o.view, part.id) : null;
  const innerRow = (x: End) => {
    const near = partOf(o, x.near), far = partOf(o, x.far); if (!near || !far) return null;
    const where = partPath(o.view, x.far).slice(0, -1).map(q => q.name).join(' › ') || o.project.name, came = x.far === cameFrom;
    return h('li', {}, h('button', { type: 'button', class: `port fr-port${came ? ' came' : ''}`, 'data-far': x.far, 'data-rel': x.r.id, title: `${far.name}${toParticle(far.name)} 가기 · ${REL_LABEL[x.r.kind] ?? x.r.kind}${came ? ' · 이 관계를 따라 여기로 왔어요' : ''}`, onclick: (e: Event) => { follow(x.far, x.r, e); go(o.key, x.far); }, ...lightOn([x.r.id], x.far) },
      h('span', { class: 'port-top' }, h('span', { class: 'fr-near' }, near.name), h('span', { class: 'port-dir', 'aria-hidden': 'true' }, dirMark(x.r.kind, x.out)), h('strong', {}, far.name), came ? h('span', { class: 'port-came' }, '출발') : null),
      h('span', { class: 'port-where' }, `${where} 안`),
      x.r.note ? h('span', { class: 'port-note', 'data-rel-note': x.r.id }, x.r.note) : null));
  };
  const innerSection = inner && (inner.outside.length || inner.within) ? h('section', { class: 'lens-ports frame-rels', 'aria-label': '안쪽 부분의 바깥 연결' },
    inner.outside.length ? h('h3', {}, '안쪽 부분의 바깥 연결', h('small', {}, String(inner.outside.length))) : null,
    ...relationGroups(inner.outside, '안쪽').flatMap(g => {
      const list = h('ul', {}, ...g.list.slice(0, 8).map(innerRow));
      return [h('h4', { class: 'fr-verb' }, g.label, h('small', {}, String(g.list.length))), list,
        g.list.length > 8 ? h('button', { type: 'button', class: 'link-button', onclick: (e: Event) => { list.replaceChildren(...g.list.map(innerRow).filter((x): x is HTMLLIElement => !!x)); (e.currentTarget as HTMLElement).remove(); clampNotes(list, o, part.id); } }, `${g.list.length - 8}개 더 보기`) : null];
    }),
    inner.within ? h('p', { class: 'fr-within' }, `안에서 서로 ${inner.within}`) : null) : null;
  // Inside: on the map already when the part is an open frame; else its names, and the explicit way in.
  const kids = part.childIds.map(id => partOf(o, id)!.name);
  const inside = kids.length && part.id !== scope ? h('div', { class: 'lens-inside' },
    b?.kind === 'frame' ? null : h('p', {}, h('span', {}, `안쪽 ${kids.length}`), kids.join(' · ')),
    h('button', { type: 'button', class: 'go-in', onclick: () => go(o.key, null, part.id) }, `안으로 들어가기 · ${kids.length}`, h('span', { 'aria-hidden': 'true' }, ' ›'))) : null;
  const thread = answersOf(o, part.id).length;
  const menuItems = [
    o.kind !== 'legacy' ? h('button', { type: 'button', role: 'menuitem', onclick: () => { editing = true; openSheet(() => document.getElementById('edit-name')?.focus()); } }, '이름·설명 고치기') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', onclick: () => openPartForm(part.id) }, '안에 부분 추가') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', title: '이 부분을 보던 맥락으로 원문을 붙여 넣어요', onclick: () => openPaste(part.id) }, '기록 붙여넣기') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', title: '코드나 검사 기록 파일 하나를 원문 그대로 자료로 보관해요 (이 부분은 읽기 맥락일 뿐이에요)', onclick: () => openFile(part.id) }, '코드·검사 자료 추가') : null,
    o.kind !== 'legacy' ? h('button', { type: 'button', role: 'menuitem', title: '이 부분을 새 세션에 넘길 문서를 만들어요', onclick: () => handover.open(part.id, document.querySelector<HTMLElement>('#lens details.more summary')) }, '이 부분 인수인계 문서') : null
  ].filter((x): x is HTMLButtonElement => !!x);
  l.classList.remove('compare', 'scope-read', 'scenario-read'); readingFor = [];
  // In scenario mode a part the path does not visit is said to be outside it; the path is not extended to it.
  const scHere = scView ? scView.visits.filter(v => drawnRep(o, v.areaId) === part.id || v.areaId === part.id) : null;
  const scLine = scView && scHere ? h('p', { class: `sc-note${scHere.length ? '' : ' sc-out'}` }, ...(scHere.length
    ? [h('strong', {}, '시나리오의 방문'), ' · ', ...scHere.flatMap((v, i) => [i ? ' · ' : '', h('button', { type: 'button', class: 'link-button', onclick: () => selectVisit(v.id) }, `방문 ${visitNumber(v.id)}`)])]
    : [h('strong', {}, '현재 시나리오 밖의 요소'), ' · 이 경로는 이 부분을 지나지 않아요'])) : null;
  l.replaceChildren(); put(l, entry,
    h('header', { class: 'lens-head' },
      path.length ? h('div', { class: 'lens-path' }, ...path.flatMap((x, i) => [i ? h('span', { 'aria-hidden': 'true' }, '›') : null, h('a', { href: hashFor(o.key, x.id, scope), title: x.name }, x.name)])) : null,
      h('h2', { id: 'lens-title' }, part.name),
      aliasOf(o.view, part.id) ? h('p', { class: 'lens-alias' }, aliasOf(o.view, part.id)) : null,
      stateLine(part) ?? ladderLine(o.view, part),
      storeLine(o, part), scLine,
      h('div', { class: 'head-tools' },
        menuItems.length ? h('details', { class: 'more' }, h('summary', { 'aria-label': '이 부분 고치기', title: '고치기' }, '⋯'), h('div', { class: 'more-menu', role: 'menu', onclick: (e: Event) => { ((e.currentTarget as HTMLElement).parentElement as HTMLDetailsElement).open = false; } }, ...menuItems)) : null,
        h('button', { type: 'button', class: 'rail-toggle', 'aria-label': '읽기면 접기', 'aria-expanded': 'true', title: '읽기면 접기 · 지도를 넓게 봐요', onclick: () => setRail(true) }, railIcon(true)),
        h('button', { type: 'button', class: 'close', 'aria-label': '선택 해제', title: '닫기 (Esc)', onclick: () => go(o.key) }, '×'))),
    // What it does, what it takes in and hands on, what the records say about it (by topic), where it lives and who worked on it.
    h('div', { class: 'lens-body' }, desc, ...ports, ...insideSections(o, part), claims, whereSection(o.project, part), requested, innerSection, inside),
    h('footer', { class: 'lens-foot' },
      h('button', { type: 'button', class: 'lens-more', onclick: () => openSheet() }, records.length ? `기록 전체 읽기 · ${records.length}` : '전체 읽기', thread ? ` · 정리 ${thread}` : '', h('span', { 'aria-hidden': 'true' }, ' ›')),
      status.ai === 'deepseek' ? h('button', { type: 'button', class: 'link-button', onclick: () => { composerOpen = true; openSheet(() => document.getElementById(status.access === 'code' && !sessionCode() ? 'access-code' : 'ask-input')?.focus()); } }, '이 부분에 대해 묻기') : null));
  l.hidden = false;
  clampNotes(l, o, part.id);
}

/** The AI sessions behind a part, in one line under what was read (the full reading lists them with their folder and branch). */
function sessionsLine(project: Project, partId: string): HTMLElement | null {
  const list = partSessions(project, partId); if (!list.length) return null;
  return h('p', { class: 'lens-sessions', title: '이 부분의 근거가 된 기록을 남긴 세션, 또는 인수인계 문서로 이 부분을 이어받은 세션' },
    h('span', { class: 'lens-sessions-label' }, '다룬 세션'), list.slice(0, 3).map(x => `${originLabel(x)}${x.tookOver ? ' · 인수인계로 이어받음' : ''}`).join(', '), list.length > 3 ? h('small', {}, ` 외 ${list.length - 3}`) : null);
}
/** A quote a section rests on, as a claim's citation reads (claimItem): a small chip that shows the passage and the record's name on
 * hover or focus and opens the passage in its record on a click; the way back comes to the same chip (data-claim-focus). */
function quoteCite(key: string, q: ReadingQuote, what: string): HTMLElement {
  const cite: HTMLElement = h('span', { class: 'cite q-cite', onmouseenter: () => placeCite(cite), onfocusin: () => placeCite(cite) },
    h('button', { type: 'button', class: 'cl-cite', 'data-claim-focus': key, 'aria-label': `${what} · 원문에서 보기`, title: `원문에서 보기 · “${q.quote}”`, onclick: () => showQuote(q.record, q.quote, q.from) }, '원문'),
    h('span', { class: 'cite-pop', role: 'tooltip' }, h('q', {}, popLine(q.quote)), h('span', { class: 'cite-src' }, recordName(q.record))));
  return cite;
}
/** The lines leaving a part (from it or from inside it to a part outside it), each once: what its steps may hand over along. */
function outLines(o: Opened, id: string): OutLine[] {
  const holds = (x: string) => { for (let q = partOf(o, x), g = 0; q && g < 64; q = partOf(o, q.parentId), g++) if (q.id === id) return true; return false; };
  return o.view.relations.filter(r => r.kind === 'flow' && holds(r.from) && !holds(r.to)).map(r => ({ relationId: r.id, far: r.to }));
}
/** The pane's inside (map-reading.9), between the ports and the topics (PART_READING order): 안의 단계 M, each step with what it
 * does, what it uses and its row's citation; the picked step (a click here or on its box in the detail view) also reads who takes
 * what it hands over (spec 7, 소비자: the lines the record maps out of it, else every line leaving the part, said so) and how the
 * part stops and resumes; then 반복 (one line) and 유지 상태. Nothing when the readings gave none of them. */
function insideSections(o: Opened, part: PartView): HTMLElement[] {
  const r = part.reading; if (!r) return [];
  const steps = stepsOf(r), loop = r.loop ?? null, vars = r.stateVars ?? [], out: HTMLElement[] = [];
  const pm = r.portMap ?? [];
  if (steps.length) {
    const lines = outLines(o, part.id);
    const item = (s: (typeof r.steps)[number], i: number) => {
      const on = pickedStep?.part === part.id && pickedStep.name === s.name;
      const ins = pm.filter(m => m.direction === 'in' && m.step === s.name).map(m => m.port), outsTo = pm.filter(m => m.direction === 'out' && m.step === s.name).map(m => m.port);
      const cons = on ? stepConsumers(s.name, pm, lines) : null;
      return h('li', { class: `stp-step${on ? ' on' : ''}` },
        h('div', { class: 'stp-top' },
          h('button', { type: 'button', class: 'stp-pick', 'aria-expanded': String(on), title: on ? '이 단계 접기' : '이 단계 읽기 · 소비자와 실패·재개', onclick: () => pickStep(part.id, s.name) },
            h('span', { class: 'stp-n', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'stp-name' }, s.name)),
          quoteCite(JSON.stringify(['step', part.id, s.at, s.name]), s.quote, `단계 ${s.name}`)),
        s.does ? h('p', { class: 'stp-does' }, s.does) : null,
        s.uses.length ? h('ul', { class: 'where-chips stp-uses', 'aria-label': '쓰는 것' }, ...s.uses.map(u => h('li', { class: 'wh', title: u }, u))) : null,
        on ? h('div', { class: 'stp-more' },
          ins.length || outsTo.length ? h('p', { class: 'stp-ports' }, [ins.length ? `⇥ ${[...new Set(ins)].join(', ')}` : '', outsTo.length ? `⇤ ${[...new Set(outsTo)].join(', ')}` : ''].filter(Boolean).join('  ')) : null,
          h('p', { class: 'stp-label' }, cons!.mapped ? '소비자 · 이 단계에서 나가는 선' : '소비자 · 이 부분에서 나가는 선 (이 단계와의 대응은 기록에 없음)'),
          cons!.list.length ? h('ul', { class: 'stp-cons' }, ...cons!.list.map(c => h('li', {}, h('button', { type: 'button', class: 'link-button', title: `${partOf(o, c.far)?.name ?? '부분'}${toParticle(partOf(o, c.far)?.name ?? '부분')} 가기`, onclick: () => go(o.key, c.far) },
            partOf(o, c.far)?.name ?? '부분'), c.port ? h('small', {}, ` · ${c.port}`) : null))) : h('p', { class: 'stp-blank' }, '나가는 선 없음'),
          h('p', { class: 'stp-label' }, '실패·재개'),
          h('p', { class: loop?.stop || loop?.resume ? 'stp-line' : 'stp-blank' }, loop?.stop || loop?.resume ? `정지 ${loop.stop ?? UNSAID} · 재개 ${loop.resume ?? UNSAID}` : '실패 대응 미제공')) : null);
    };
    out.push(h('section', { class: 'lens-ports lens-steps' }, h('h3', { title: '기록의 단계 표, 행의 순서대로. 단계 사이의 순서·분기는 읽지 않았다.' }, '안의 단계', h('small', {}, String(steps.length))),
      h('ol', { class: 'stp-list' }, ...r.steps.map(item))));
  }
  if (loop) out.push(h('section', { class: 'lens-ports lens-loop' }, h('h3', {}, '반복'),
    h('p', { class: 'stp-line' }, h('span', {}, loopLine(loop)), quoteCite(JSON.stringify(['loop', part.id, loop.at]), loop.quote, '반복'))));
  if (vars.length) out.push(h('section', { class: 'lens-ports lens-vars' }, h('h3', {}, '유지 상태', h('small', {}, String(vars.length))),
    h('ul', { class: 'stp-vars' }, ...vars.map(v => h('li', {}, h('span', { class: 'stp-var' }, v.name, v.scope ? h('small', {}, ` · ${v.scope}`) : null),
      h('span', { class: 'stp-var-rw' }, `읽음 ${v.readBy.length ? v.readBy.join(', ') : UNSAID} · 바꿈 ${v.changedBy.length ? v.changedBy.join(', ') : UNSAID}`))))));
  return out;
}
/** Where the part lives, as the records name it: the files, folders or units readings gave it and the places its current claims
 * name (each once, up to eight, written as the record wrote them), then the sessions behind it. Left out when there is nothing. */
function whereSection(project: Project, part: PartView): HTMLElement | null {
  const places: string[] = [];
  for (const f of [...(part.reading?.files ?? []), ...(part.reading?.claims ?? []).map(c => c.where)]) if (f && !places.includes(f)) places.push(f);
  const sessions = sessionsLine(project, part.id);
  if (!places.length && !sessions) return null;
  return h('section', { class: 'lens-where' }, h('h3', {}, '어디에'),
    places.length ? h('ul', { class: 'where-chips' }, ...places.slice(0, 8).map(f => h('li', { class: 'wh', title: f }, f))) : null, sessions);
}
/** What readings said each relation hands over (map-reading.7): per relation, the newest reading's line that names a payload. */
function relationPayloads(project: Project): Map<string, ReadingRelation> {
  const out = new Map<string, ReadingRelation>();
  for (const r of project.readings) if (isMapReading(r)) for (const x of r.relations) if (x.payload) out.set(x.relationId, x);
  return out;
}
/** What each relation's line carries and says (map-reading.7–8): per relation, the channel, payload and cadence of the newest
 * reading that names each (readings are oldest first); chAt orders the channels of different relations by their reading. */
interface LineSaid { channel: Channel | null; chAt: number; payload: string | null; cadence: string | null }
function relationLines(project: Project): Map<string, LineSaid> {
  const out = new Map<string, LineSaid>();
  project.readings.forEach((r, i) => {
    if (isMapReading(r)) for (const x of r.relations) {
      const cur = out.get(x.relationId) ?? { channel: null, chAt: -1, payload: null, cadence: null };
      out.set(x.relationId, { channel: x.channel ?? cur.channel, chAt: x.channel ? i : cur.chAt, payload: x.payload ?? cur.payload, cadence: x.cadence ?? cur.cadence });
    }
  });
  return out;
}
/** A line's channel: the newest reading's for any relation it draws; else by kind (a flow hands data over; a need or a shared
 * use refers). A plain relation has no direction, so it keeps its dots and no channel. */
function edgeChannel(e: Edge, said: Map<string, LineSaid>): Channel | null {
  if (e.kind === 'related') return null;
  let best: LineSaid | null = null;
  for (const id of e.ids) { const s = said.get(id); if (s?.channel && (!best || s.chAt > best.chAt)) best = s; }
  return best?.channel ?? (e.kind === 'flow' ? 'data' : 'uses');
}
/** The one-line label of a line: data says what it hands over, control what starts it, a reference only that it is one. A
 * line drawing several relations says a payload or a beat only when all of them name the same. */
function lineWord(e: Edge, ch: Channel | null, said: Map<string, LineSaid>): string {
  const one = (k: 'payload' | 'cadence') => { const v = new Set(e.ids.map(id => said.get(id)?.[k] ?? null)); return v.size === 1 ? [...v][0] ?? null : null; };
  const clip = (t: string) => (t.length > 30 ? `${t.slice(0, 29)}…` : t);
  if (ch === 'data') { const p = one('payload'); return p ? clip(p) : REL_LABEL[e.kind] ?? e.kind; }
  if (ch === 'control') { const c = one('cadence') ?? one('payload'); return c ? `기동 · ${clip(c)}` : '제어'; }
  if (ch === 'uses') return '참조';
  return REL_LABEL[e.kind] ?? e.kind;
}
/** The labels of the lines drawn now (renderSpace), by line key; a line drawn later (a summary beside a selection) says its verb. */
let lineWords = new Map<string, string>();
const wordOf = (e: Edge) => lineWords.get(e.key) ?? REL_LABEL[e.kind] ?? e.kind;
/** The short word of a line's channel (its label without a payload or a beat). */
let lineChans = new Map<string, Channel | null>();
const shortOf = (e: Edge) => { const c = lineChans.get(e.key); return c === 'control' || c === 'uses' ? CHANNEL_LABEL[c] : REL_LABEL[e.kind] ?? e.kind; };
/** The small fixed key in the map's lower left: one row for each kind of line this map draws, none when it draws no line. */
function renderLineKey(present: Set<Channel>) {
  let key = document.getElementById('line-key');
  if (!key) { key = h('div', { id: 'line-key', class: 'line-key', role: 'list', 'aria-label': '선의 종류' }); $('space').append(key); }
  const sample = (c: Channel) => {
    const s = svg('svg', { viewBox: '0 0 28 10', width: '28', height: '10', 'aria-hidden': 'true' });
    s.append(svg('path', { class: 'lk-line', d: c === 'data' ? 'M1 5H21' : 'M1 5H25' }), svg('path', { class: c === 'data' ? 'lk-head filled' : 'lk-head', d: c === 'data' ? 'M19 1.5L26 5L19 8.5z' : 'M20 1.5L26 5L20 8.5' }));
    return s;
  };
  key.replaceChildren(...(['data', 'control', 'uses'] as const).filter(c => present.has(c)).map(c => h('span', { class: `lk-row lk-${c}`, role: 'listitem' }, sample(c), h('span', {}, CHANNEL_LABEL[c]))));
  key.hidden = !present.size;
}
/** The map head's basis line (spec 6): what the newest reading's records give as their basis time and target version, as
 * written, and that every state is a reported one; a blank says it is unknown, never the time a record arrived. */
function basisLine(o: Opened): HTMLElement | null {
  const last = [...o.project.readings].reverse().find(isMapReading); if (!last) return null;
  return h('p', { class: 'map-basis' }, `설계 근거 · ${last.basisAt ?? '작성 시각 미상'} 작성 보고 · 대상 판본 ${last.basisVersion ?? '미상'} · 운영: 보고된 상태 (기록 없음은 제공된 자료 기준)`);
}
/** The AI sessions behind a part in the full reading: the ones whose records the map quotes for it, and the ones that took it over
 * by a handover. */
function sessionsSection(project: Project, partId: string): HTMLElement | null {
  const list = partSessions(project, partId); if (!list.length) return null;
  return h('section', { class: 'sec sec-sessions' }, h('h3', {}, '다룬 세션 ', h('small', {}, `${list.length}`)),
    h('ul', { class: 'part-sessions' }, ...list.slice(0, 6).map(x => h('li', {},
      h('strong', {}, originLabel(x)), x.tookOver ? h('span', { class: 'chip plain' }, '인수인계로 이어받음') : null,
      // No time: a record's is when it was taken in (a folder's past sessions all at once), not when its session ran.
      h('small', {}, [x.cwd ? x.cwd.split(/[\\/]/).filter(Boolean).at(-1) : null, x.branch].filter(Boolean).join(' · '))))));
}
/** A session record kept while a part is read (the automatic connection): only its sessions are drawn again, so the scroll, the
 * focus and a form open there stay. A part that had none yet is read again whole. */
function refreshSessions() {
  const o = opened; if (!o || !selected || planView.isOpen() || (!sheetOpen && lensRail)) return;
  const cur = document.querySelector(sheetOpen ? '#panel .sec-sessions' : '#lens .lens-sessions'), next = sheetOpen ? sessionsSection(o.project, selected) : sessionsLine(o.project, selected);
  if (cur && next) cur.replaceWith(next); else if (cur || next) refreshReading();
}
/** A part the newest reading types as a store (its card reads as a ledger). */
function isStorePart(o: Opened, id: string): boolean {
  const p = partOf(o, id.startsWith('ghost:') ? id.slice(6) : id);
  return !!p?.reading?.typeRead && FAMILY_OF[p.reading.typeRead.type] === 'store';
}
/** A store's path (map spec 2.3, "비동기 저장소는 세 관계로 그린다"), read on the lines already drawn: with the store selected,
 * its own data lines are the selection's, and the control lines that start its readers join them (each reader consumes on
 * its own trigger); with a part selected whose data line goes into or out of a store, the store's other data lines join, with
 * the parts at their ends. Never a new line, never a line from writer to reader. */
function storePath(me: string | null): { lines: Set<string>; ends: Set<string> } {
  const out = { lines: new Set<string>(), ends: new Set<string>() }, o = opened;
  if (!o || !me) return out;
  const data = (e: Edge) => !e.key.startsWith('sum:') && lineChans.get(e.key) === 'data', other = (e: Edge, x: string) => (e.from === x ? e.to : e.from);
  const mine = lay.edges.filter(e => e.from === me || e.to === me);
  if (isStorePart(o, me)) {
    const readers = new Set(mine.filter(e => data(e) && e.from === me).map(e => e.to));
    for (const e of lay.edges) if (lineChans.get(e.key) === 'control' && readers.has(e.to) && e.from !== me) { out.lines.add(e.key); out.ends.add(e.from); }
    return out;
  }
  for (const e of mine) {
    if (!data(e)) continue;
    const s = other(e, me); if (!isStorePart(o, s)) continue;
    for (const x of lay.edges) if (x !== e && data(x) && (x.from === s || x.to === s) && x.from !== me && x.to !== me) { out.lines.add(x.key); out.ends.add(other(x, s)); }
  }
  return out;
}
/** A store's writers and readers, counted from the adopted relations (never stored as lists): the parts whose data relation
 * ends at it, and the parts its data relations go to. A relation's channel is the newest reading's, else its kind's (a flow
 * hands data over). */
function storeCounts(o: Opened, id: string): { writers: number; readers: number } {
  const said = relationLines(o.project), writers = new Set<string>(), readers = new Set<string>();
  for (const r of o.project.space.relations) {
    if (r.kind === 'related' || (said.get(r.id)?.channel ?? (r.kind === 'flow' ? 'data' : 'uses')) !== 'data') continue;
    if (r.to === id && r.from !== id) writers.add(r.from);
    if (r.from === id && r.to !== id) readers.add(r.to);
  }
  return { writers: writers.size, readers: readers.size };
}
/** The lens head's store line: '쓰기 N · 읽기 M', from storeCounts. null for any other part. */
function storeLine(o: Opened, p: PartView): HTMLElement | null {
  if (!isStorePart(o, p.id)) return null;
  const { writers, readers } = storeCounts(o, p.id);
  return h('p', { class: 'lens-store', title: '채택된 관계에서 센, 이 보관소에 쓰는 부분과 읽는 부분의 수' }, `쓰기 ${writers} · 읽기 ${readers}`);
}
/** Selection on the map: the part, its lines and the parts at their other ends (drawn representative or side ghost). */
function markSelection(partId: string | null) {
  // The scope itself, selected in place, is drawn as its own boundary card (the '이 범위' end of its lines).
  const me = partId && partId === scope ? `ghost:${partId}` : partId;
  const related = new Set<string>();
  document.querySelectorAll<SVGGElement>('.edge').forEach(el => {
    if (el.classList.contains('sum')) return; // summary lines read only at rest, never as a selection's own lines
    const on = !!me && (el.dataset.from === me || el.dataset.to === me);
    // A line the change plan reads as context of its change (.ctx) stays above the groups as well.
    el.classList.toggle('on', on); layerEdge(el);
    if (on) related.add(el.dataset.from === me ? el.dataset.to! : el.dataset.from!);
  });
  // The rest of a store's path reads with the selection (.path keeps .near while the pointer moves elsewhere); nothing moves and
  // no line is added.
  const path = storePath(me);
  document.querySelectorAll<SVGGElement>('.edge.path').forEach(el => el.classList.remove('path', 'near'));
  document.querySelectorAll<SVGGElement>('.edge').forEach(el => { if (path.lines.has(el.dataset.key!)) el.classList.add('path', 'near'); });
  for (const end of path.ends) related.add(end);
  // The summary beside a selection holds every other relation: a line that held some of the selection's relations keeps the
  // rest (its count drops by those, which are drawn one by one), and gives way (.hit, hidden by .sel-sum) only when none is left.
  const scLines = new Set([...document.querySelectorAll<SVGGElement>('#world .edge.sc-path')].map(g => g.dataset.key!));
  sums = me || scLines.size ? restSummary(lay.boxes, lay.edges, e => (!!me && (e.from === me || e.to === me)) || path.lines.has(e.key) || scLines.has(e.key)) : restSums;
  markLines();
  document.querySelectorAll<SVGGElement>('.edge.sum').forEach(el => { const e = edgeOf(el.dataset.key); el.classList.toggle('hit', !e); el.classList.toggle('agg', !!e?.agg); });
  syncLineMode();
  placeEdgeLabels();
  document.querySelectorAll<HTMLElement>('.node[data-part],.frame,.ghost').forEach(el => {
    el.classList.toggle('selected', !!partId && (el.dataset.part === partId || (me !== partId && el.dataset.box === me)));
    el.classList.toggle('related', related.has(el.dataset.box!));
  });
  // The step of the main flow that is selected reads as such in the title's flow line.
  document.querySelectorAll<HTMLElement>('#world .mf-step').forEach(el => el.classList.toggle('on', !!partId && el.dataset.part === partId));
  endNotes(partId);
}
/** The selection's own relations, read where they end: a card at the other end of one of them says that relation's stored note
 * on its state line (one line; the whole note reads in the pane, on the same row). Only a relation whose two ends are the two
 * drawn cards: an end drawn as a group, outside the scope, or standing for an inner part (a summarised line) says nothing here,
 * so no note ever reads as another part's. Cards keep their size and place; the state line comes back when the selection goes. */
function endNotes(partId: string | null) {
  const world = $('world'), o = opened;
  world.querySelectorAll('.node-rel').forEach(el => el.remove());
  world.querySelectorAll('.node.has-rel').forEach(el => el.classList.remove('has-rel'));
  if (!o || !partId || planView.isOpen()) return;
  const sel = partOf(o, partId), byFar = new Map<string, End[]>();
  for (const x of relationEnds(o, partId)) if (x.near === partId && x.r.note && lay.boxes.get(x.far)?.kind === 'node') byFar.set(x.far, [...(byFar.get(x.far) ?? []), x]);
  for (const [far, list] of byFar) {
    const card = world.querySelector<HTMLElement>(`.node[data-box="${CSS.escape(far)}"]`), meta = card?.querySelector('.node-meta');
    // Only in the room the card already gives its state line: never a line it does not have.
    if (!card || !meta) continue;
    const x = list[0]!, name = partOf(o, far)?.name ?? '';
    meta.after(h('span', { class: `node-rel k-${x.r.kind}`, title: list.map(y => `${y.r.kind === 'related' ? `${sel?.name} — ${name}` : y.out ? `${sel?.name} → ${name}` : `${name} → ${sel?.name}`} · ${REL_LABEL[y.r.kind] ?? y.r.kind}\n${y.r.note}`).join('\n\n') },
      h('i', { class: 'rel-dot', 'aria-hidden': 'true' }), h('span', { class: 'rel-text' }, x.r.note), list.length > 1 ? h('small', {}, ` 외 ${list.length - 1}`) : null));
    card.classList.add('has-rel');
  }
}
/** A relation row in the pane and its line and other end on the map light together while one of them is pointed at or
 * focused; the map's own hover lights the rows of the same relations. Nothing moves and nothing is selected. */
function lightOn(ids: string[], far: string): Record<string, (e: Event) => void> {
  const on = () => lightRelations(ids, far), off = () => lightRelations([], null);
  return { onpointerenter: on, onpointerleave: off, onfocus: on, onblur: off };
}
function lightRelations(ids: string[], far: string | null) {
  const o = opened, world = $('world'), set = new Set(ids);
  world.querySelectorAll('.lit').forEach(el => el.classList.remove('lit'));
  if (!o || !set.size) return;
  world.querySelectorAll<SVGGElement>('.edge').forEach(g => { if (edgeOf(g.dataset.key)?.ids.some(id => set.has(id))) { g.classList.add('lit'); layerEdge(g); } });
  const box = far ? drawnRep(o, far) ?? (lay.boxes.has(`ghost:${far}`) ? `ghost:${far}` : null) : null;
  if (box) world.querySelector(`[data-box="${CSS.escape(box)}"]`)?.classList.add('lit');
}
/** The map's hover, read back in the pane: rows of these relations light (none when nothing is hovered). */
function lightRows(ids: string[]) {
  const set = new Set(ids);
  document.querySelectorAll<HTMLElement>('#lens .port[data-rel]').forEach(el => el.classList.toggle('lit', set.has(el.dataset.rel!)));
}
function clearHighlight() { document.querySelectorAll('.node.cited,.frame.cited').forEach(el => el.classList.remove('cited')); }
function highlightParts(ids: Set<string>) {
  clearHighlight();
  document.querySelectorAll<HTMLElement>('.node[data-part],.frame[data-part]').forEach(el => { if (ids.has(el.dataset.part!)) el.classList.add('cited'); });
}

function recordItem(o: Opened, r: RecordView, showPart: boolean): HTMLElement {
  const part = showPart && r.partId ? o.view.parts.find(x => x.id === r.partId)?.name : null;
  return h('li', { class: 'record', id: `rec-${r.id}` }, h('details', {},
    h('summary', {}, h('span', { class: 'rec-top' }, h('span', { class: 'rec-kind' }, RECORD_LABEL[r.kind]), part ? h('span', { class: 'rec-part' }, part) : null, h('span', { class: 'rec-time', title: fullTime(r.at) }, ago(r.at))),
      h('span', { class: 'rec-line' }, firstLine(r.text, 120))),
    h('div', { class: 'rec-body' }, h('pre', {}, r.text), h('p', { class: 'rec-src' }, `${r.origin ?? (r.kind === 'request' ? '사용자가 개발 도구에 남긴 요청' : '전달받은 기록')} · ${fullTime(r.at)} · 받은 원문 그대로`))));
}
function openRecord(id: string) {
  const li = document.getElementById(`rec-${id}`);
  if (!li) { const more = document.querySelector<HTMLButtonElement>('.records-more'); if (more) { more.click(); requestAnimationFrame(() => openRecord(id)); } return; }
  const d = li.querySelector('details'); if (d) d.open = true;
  li.scrollIntoView({ block: 'center', behavior: 'smooth' });
  li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash');
}

/** The part inspector reads in one order: name → current description → related parts → what to do → sources. Edits sit in a
 * quiet menu; long sources open one at a time. */
function renderPanel(scrollTop: boolean) {
  const o = opened!, part = o.view.parts.find(p => p.id === selected)!, panel = $('panel');
  const prevBody = panel.querySelector('.panel-body'), keep = scrollTop ? 0 : prevBody?.scrollTop ?? 0;
  // The same part read again (an answer, a status, a save): the control that had focus keeps it, a field its caret and selection.
  const same = panel.dataset.read === `${o.key}|${part.id}` && !scrollTop, had = same && panel.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
  const field = had instanceof HTMLTextAreaElement || had instanceof HTMLInputElement ? had : null;
  const caret = field && field.id ? { id: field.id, start: field.selectionStart, end: field.selectionEnd, dir: field.selectionDirection, top: field.scrollTop } : null;
  const mark = had && !caret ? (['claimFocus', 'requestFocus', 'far'] as const).map(k => [k, had.dataset[k]] as const).find(([, v]) => v !== undefined) ?? null : null;
  // What is written in a form whose words live nowhere else until saved (name/description, the description correction: rebuilt from
  // the saved part). The question box is not among them: its draft is kept apart (getDraft/setDraft) and is the authority, e.g.
  // emptied once the question is answered.
  const typed = same ? (['edit-name', 'edit-note', 'fix-role'] as const).map(id => document.getElementById(id)).filter((f): f is HTMLInputElement | HTMLTextAreaElement => (f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) && panel.contains(f)).map(f => [f.id, f.value] as const) : [];
  const path = partPath(o.view, part.id).slice(0, -1), records = subtreeRecords(o.view, part.id);
  const state = part.status === 'plan' ? (part.reading?.state ? stateLabel(part.reading) ?? '기록에서 읽음' : records.length ? '요청 기록 없음' : part.note ? '계획 설명만 있음 · 기록 없음' : '기록 없음') : STATUS_LABEL[part.status];
  const menuItems = [
    o.kind !== 'legacy' ? h('button', { type: 'button', role: 'menuitem', onclick: () => { editing = !editing; renderPanel(false); } }, editing ? '고치기 닫기' : '이름·설명 고치기') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', onclick: () => openPartForm(part.id) }, '안에 부분 추가') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', title: '이 부분을 보던 맥락으로 원문을 붙여 넣어요', onclick: () => openPaste(part.id) }, '기록 붙여넣기') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', title: '코드나 검사 기록 파일 하나를 원문 그대로 자료로 보관해요 (이 부분은 읽기 맥락일 뿐이에요)', onclick: () => openFile(part.id) }, '코드·검사 자료 추가') : null
  ].filter((x): x is HTMLButtonElement => !!x);
  const head = h('header', { class: 'panel-head' },
    h('div', { class: 'panel-path' }, ...path.flatMap((x, i) => [i ? h('span', { 'aria-hidden': 'true' }, '›') : null, h('a', { href: hashFor(o.key, x.id, scope) }, x.name)]), path.length ? null : h('span', {}, o.project.name)),
    h('h2', { id: 'panel-title', tabindex: '-1' }, part.name),
    h('div', { class: 'panel-chips' }, h('span', { class: `state s-${part.status}` }, h('i', { class: 'dot', 'aria-hidden': 'true' }), state),
      records.length ? h('span', { class: 'chip plain' }, `기록 ${records.length}${records[0] ? ` · ${ago(records[0].at)}` : ''}`) : null),
    h('div', { class: 'head-tools' },
      menuItems.length ? h('details', { class: 'more' }, h('summary', { 'aria-label': '이 부분 고치기', title: '고치기' }, '⋯'), h('div', { class: 'more-menu', role: 'menu', onclick: (e: Event) => { ((e.currentTarget as HTMLElement).parentElement as HTMLDetailsElement).open = false; } }, ...menuItems)) : null,
      h('button', { type: 'button', class: 'link-button sheet-back', title: '전체 읽기를 닫고 지도와 요약으로 (Esc)', onclick: closeSheet }, '요약으로'),
      h('button', { type: 'button', class: 'close', 'aria-label': '요약으로 돌아가기', title: '요약으로 (Esc)', onclick: closeSheet }, '×')));
  const body = h('div', { class: 'panel-body' });
  if (editing) body.append(editForm(o, part));
  // 현재 설명
  const now = h('section', { class: 'sec sec-now' });
  if (part.summary) {
    const report = records.find(r => r.kind === 'report');
    now.append(h('p', { class: 'summary' }, part.summary), h('p', { class: 'src' }, `${part.origin ?? '전달받은 정리'}${report ? ` · ${ago(report.at)}` : ''}`));
    if (part.proposal) now.append(h('div', { class: 'proposal' }, h('strong', {}, '제안 · 아직 반영 안 됨'), h('span', {}, part.proposal)));
    if (part.note) now.append(h('p', { class: 'note' }, h('span', {}, '계획'), part.note));
  } else if (part.note) {
    // The written plan reads as the description; the head's state line already says whether records exist.
    put(now, h('p', { class: 'lead' }, part.note), h('p', { class: 'src' }, '적어 둔 계획 설명 · 받은 정리 아님'),
      records.length ? h('p', { class: 'summary muted' }, part.childIds.length ? '이 부분 자체에 대한 정리는 아직 없어요. 안의 부분과 기록을 보세요.' : '요청 기록은 있고, 아직 받은 작업 보고는 없어요.') : null);
  } else if (!part.reading) {
    put(now, h('p', { class: 'summary muted' }, records.length ? (part.childIds.length ? '이 부분 자체에 대한 정리는 아직 없어요. 안의 부분과 기록을 보세요.' : '요청 기록은 있고, 아직 받은 작업 보고는 없어요.') : '아직 설명도 연결된 기록도 없어요.'));
  }
  if (now.childNodes.length) body.append(now);
  const understood = understoodSection(o, part); if (understood) body.append(understood);
  if (part.changes.length) body.append(h('section', { class: 'sec' }, h('h3', {}, '최근 변화'), h('ul', { class: 'changes' }, ...part.changes.map(c => h('li', {}, c)))));
  // 관련 부분: its inside, then the recorded links with their meaning.
  const links = relationEnds(o, part.id);
  if (part.childIds.length || links.length) {
    const rel = h('section', { class: 'sec sec-related' }, h('h3', {}, '관련 부분'));
    if (part.childIds.length) rel.append(h('p', { class: 'sub' }, `안쪽 ${part.childIds.length}`), h('div', { class: 'kids' }, ...part.childIds.map(id => {
      const c = o.view.parts.find(x => x.id === id)!, m = metaLine(c, c.childIds.length ? subtreeRecords(o.view, c.id)[0]?.at ?? null : c.lastAt);
      return h('a', { class: `kid s-${c.status}`, href: hashFor(o.key, id, scope) }, h('span', {}, c.name), c.childIds.length ? h('small', {}, `안쪽 ${c.childIds.length}`) : null, m ? h('small', {}, m) : null);
    })));
    if (links.length) rel.append(h('p', { class: 'sub' }, `연결 ${links.length}`), h('ul', { class: 'links' }, ...links.map(({ r, out, near, far }) => {
      const other = o.view.parts.find(x => x.id === far)!, inner = near !== part.id ? partOf(o, near)?.name : null;
      const where = [inner ? `안쪽 ‘${inner}’에서` : '', insideScope(o, other.id) ? '' : `${partPath(o.view, other.id).slice(0, -1).map(x => x.name).join(' › ') || o.project.name} 안`].filter(Boolean).join(' · ');
      return h('li', {}, h('a', { href: hashFor(o.key, other.id, scope), 'data-far': other.id, onclick: (e: Event) => follow(other.id, r, e) },
        h('span', { class: 'dir', title: dirTitle(r.kind, out) }, dirMark(r.kind, out)), h('strong', {}, other.name), h('span', { class: 'rel-kind' }, REL_LABEL[r.kind] ?? r.kind)),
        where ? h('span', { class: 'link-where' }, where) : null,
        r.note || revisedLine(o, r.id) ? h('span', { class: 'link-note' }, `${r.note}${revisedLine(o, r.id) ? REVISED_BASIS : ''}`.replace(/^ · /, '')) : null);
    })));
    body.append(rel);
  }
  const sessions = sessionsSection(o.project, part.id); if (sessions) body.append(sessions);
  // What to do next with this part: going inside is explicit, never a side effect of selecting.
  if (part.childIds.length && part.id !== scope) body.append(h('div', { class: 'sec-acts' },
    h('button', { type: 'button', class: 'secondary go-in', onclick: () => go(o.key, null, part.id) }, `안으로 들어가기 · ${part.childIds.length}`, h('span', { 'aria-hidden': 'true' }, ' ›'))));
  if (records.length) {
    const showAll = records.length <= 5, list = h('ol', { class: 'records' }, ...records.slice(0, showAll ? records.length : 4).map(r => recordItem(o, r, r.partId !== part.id)));
    const sec = h('section', { class: 'sec' }, h('h3', {}, '기록 원문 ', h('small', {}, `개발 도구에서 받은 기록 ${records.length}`)), list);
    if (!showAll) sec.append(h('button', { type: 'button', class: 'records-more link-button', onclick: (e: Event) => { list.replaceChildren(...records.map(r => recordItem(o, r, r.partId !== part.id))); (e.target as HTMLElement).remove(); } }, `기록 ${records.length - 4}개 더 보기`));
    body.append(sec);
  }
  const thread = answersOf(o, part.id);
  if (thread.length || (ask && ask.partId === part.id)) {
    const sec = h('section', { class: 'sec thread', 'aria-live': 'polite' }, h('h3', {}, '정리 결과'));
    for (const a of thread) sec.append(answerCard(o, a));
    if (ask && ask.partId === part.id) sec.append(ask.controller
      ? h('div', { class: 'pending' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, `${status.model ?? 'DeepSeek'}가 기록을 읽고 정리하고 있어요…`, coverageText(ask.coverage) ? h('small', { class: 'scope-note' }, coverageText(ask.coverage)!) : null), h('button', { type: 'button', class: 'link-button', onclick: () => ask?.controller?.abort() }, '취소'))
      : h('div', { class: 'failed', role: 'alert' }, h('span', {}, ask.error ?? '응답을 받지 못했어요.'), h('button', { type: 'button', class: 'secondary small', onclick: () => send(ask!.intent, ask!.question) }, '다시 시도'), h('button', { type: 'button', class: 'link-button', onclick: () => { ask = null; renderPanel(false); } }, '닫기')));
    body.append(sec);
  }
  panel.replaceChildren(...[visitEntry(o), head, body, composer(o, part)].filter((x): x is HTMLElement => !!x));
  panel.dataset.read = `${o.key}|${part.id}`;
  for (const [id, v] of typed) { const f = document.getElementById(id); if ((f instanceof HTMLTextAreaElement || f instanceof HTMLInputElement) && panel.contains(f) && f.value !== v) f.value = v; }
  if (scrollTop) body.scrollTop = 0; else body.scrollTop = keep;
  if (caret) {
    const f = document.getElementById(caret.id);
    if ((f instanceof HTMLTextAreaElement || f instanceof HTMLInputElement) && panel.contains(f) && !f.disabled) { f.focus({ preventScroll: true }); try { f.setSelectionRange(caret.start, caret.end, caret.dir ?? 'none'); } catch { /* not a text field */ } f.scrollTop = caret.top; }
  } else if (mark) [...panel.querySelectorAll<HTMLElement>(`[data-${mark[0].replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}]`)].find(x => x.dataset[mark[0]] === mark[1])?.focus({ preventScroll: true });
}

/** AF100: the saves this page made itself (entry and the save number each made), so a job's result is applied on top of this
 * page's own edits only, never on a save another tab made meanwhile. */
const ownSaves = new Set<string>();
/** Why the last save was refused (storageErrorCode), for a caller that says more than commit's own text. */
let saveFailure: string | null = null;
/** The one write path for structure edits: saved projects through the workspace store, examples in memory only. */
async function commit(o: Opened, next: Project): Promise<string | null> {
  if (o.kind === 'saved' && o.ref) {
    try { o.ref = await store.save(o.ref, next); ownSaves.add(`${o.ref.entryId}:${o.ref.seq}`); }
    catch (err) { saveFailure = storageErrorCode(err); return saveFailure === 'STORAGE_CONFLICT' ? '다른 탭에서 이 프로젝트가 바뀌어 저장하지 않았어요. 새로고침한 뒤 다시 해 주세요.' : '저장하지 못했어요. 바뀐 내용은 적용하지 않았어요.'; }
  } else if (o.kind === 'example') examples.set(o.key, next);
  else return '이 프로젝트는 읽기 전용이에요.';
  o.project = next; o.view = studioView(next);
  // A wide reading open over this project reads the saved data again (said there), keeping its place.
  wide.render();
  return null;
}

/* Adding a part: the first part of a new project, another top part, or a part inside the selected one. */
let partForm: { parentId: string | null } | null = null;
function openPartForm(parentId: string | null) { partForm = { parentId }; renderPartForm(); }
function renderPartForm() {
  const box = $('part-form'), o = opened;
  if (!o || !partForm) { box.hidden = true; box.replaceChildren(); return; }
  const parent = partForm.parentId ? o.view.parts.find(x => x.id === partForm!.parentId) ?? null : null, first = !o.view.parts.length;
  const name = h('input', { id: 'part-name', maxlength: '60', placeholder: first ? '예: 예약하기' : '부분 이름', autocomplete: 'off' }) as HTMLInputElement;
  const note = h('input', { id: 'part-note', maxlength: '2000', placeholder: '한 줄 설명 (선택)', autocomplete: 'off' }) as HTMLInputElement;
  const msg = h('p', { class: 'form-msg', role: 'status' });
  const close = () => { partForm = null; renderPartForm(); };
  box.replaceChildren(h('form', { class: 'part-form-inner', onsubmit: async (e: Event) => {
    e.preventDefault();
    let next: Project;
    try { next = parent ? addChildArea(o.project, parent.id, name.value, note.value) : addArea(o.project, name.value, note.value); }
    catch { msg.textContent = '이름은 1~60자로 적어 주세요.'; return; }
    const id = next.space.areas.at(-1)!.id, failed = await commit(o, next);
    if (failed) { msg.textContent = failed; return; }
    expandPath(o, id, expandState); // made here on purpose: keep its parent open
    partForm = null; renderPartForm(); renderSpace('keep'); go(o.key, id);
  } },
    h('h3', {}, parent ? `‘${parent.name}’ 안에 부분 추가` : first ? '첫 부분 만들기' : '부분 추가'),
    first ? h('p', { class: 'hint' }, '프로젝트를 이루는 큰 부분 하나를 적어 주세요. 개발 기록은 이 부분들에 연결돼요.') : null,
    name, note, msg,
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary small' }, '만들기'), h('button', { type: 'button', class: 'link-button', onclick: () => { close(); renderMapEntry(); } }, '취소'))));
  box.hidden = false; name.focus(); renderMapEntry();
}

function editForm(o: Opened, part: PartView): HTMLElement {
  const name = h('input', { id: 'edit-name', maxlength: '60', value: part.name }) as HTMLInputElement;
  const note = h('textarea', { id: 'edit-note', rows: '3', maxlength: '2000' }) as HTMLTextAreaElement; note.value = part.note;
  const msg = h('p', { class: 'form-msg', role: 'status' }, o.kind === 'example' ? '예제는 저장되지 않아요. 이 탭에서만 바뀌어요.' : '');
  const form = h('form', { class: 'edit-form', onsubmit: async (e: Event) => {
    e.preventDefault();
    let next: Project;
    try { next = editArea(o.project, part.id, name.value, note.value); } catch { msg.textContent = '이름은 1~60자, 설명은 2,000자까지 쓸 수 있어요.'; return; }
    const failed = await commit(o, next); if (failed) { msg.textContent = failed; return; }
    // Saved; read again only where it was asked (another project or part since keeps its own reading).
    if (opened !== o) return;
    if (selected !== part.id) { renderSpace('keep'); return; }
    editing = false;
    renderSpace('keep'); select(part.id);
  } },
    h('label', { for: 'edit-name' }, '이름'), name, h('label', { for: 'edit-note' }, '설명 ', h('small', {}, '계획에 적힌 내 말')), note, msg,
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary small' }, '저장'), h('button', { type: 'button', class: 'link-button', onclick: () => { editing = false; renderPanel(false); } }, '취소')));
  return form;
}

function answerCard(o: Opened, a: Answer): HTMLElement {
  // The asked purpose leads: question → short direct answer; summary → current state; next → decisions. The rest folds.
  const label = a.intent === 'summary' ? '지금 상황 정리' : a.intent === 'next' ? '다음에 판단할 것' : a.question ?? '질문';
  const ul = (items: string[]) => h('ul', {}, ...items.map(x => h('li', {}, x)));
  const block = (title: string, items: string[]) => items.length ? h('div', { class: 'ans-block' }, h('h4', {}, title), ul(items)) : null;
  const sections: [string, string[]][] = [['지금 상황', a.reply.situation], ['최근 변화', a.reply.changes], ['다음에 판단할 것', a.reply.next]];
  const main = a.intent === 'summary' ? '지금 상황' : a.intent === 'next' ? '다음에 판단할 것' : null;
  const lead = a.intent === 'question'
    ? h('p', { class: 'ans-text' }, a.reply.answer ?? a.reply.headline)
    : h('div', { class: 'ans-main' }, h('p', { class: 'ans-head' }, a.reply.headline), ul(sections.find(s => s[0] === main)![1].length ? sections.find(s => s[0] === main)![1] : a.reply.situation));
  const rest = sections.filter(s => s[0] !== main && s[1].length);
  const cited = a.reply.refs.map(ref => a.refs[ref]).filter((x): x is string => !!x);
  const records = cited.map(id => o.view.records.find(r => r.id === id)).filter((r): r is RecordView => !!r);
  const partsCited = new Set(records.map(r => r.partId).filter((x): x is string => !!x));
  return h('article', { class: 'answer' },
    h('p', { class: 'ans-ask' }, h('span', {}, label), h('small', { title: a.model }, `${ago(a.at)} · ${modelLabel(a.model)}`)),
    coverageText(a.coverage) ? h('p', { class: 'ans-scope' }, coverageText(a.coverage)!) : null,
    lead,
    records.length ? h('div', { class: 'ans-refs' }, h('span', {}, '근거'), ...records.map(r => {
      const pn = r.partId ? o.view.parts.find(x => x.id === r.partId)?.name : null;
      return h('button', { type: 'button', class: 'ref', title: firstLine(r.text, 120), onclick: () => openRecord(r.id) }, `${RECORD_LABEL[r.kind]}${pn ? ` · ${pn}` : ''} · ${ago(r.at)}`);
    }), partsCited.size ? h('button', { type: 'button', class: 'link-button', onclick: () => highlightParts(partsCited) }, '지도에서 보기') : null) : null,
    rest.length ? h('details', { class: 'ans-more' }, h('summary', {}, a.intent === 'question' ? '정리 상세' : '나머지 정리'), ...rest.map(([t, items]) => block(t, items))) : null);
}

function composer(o: Opened, part: PartView): HTMLElement {
  const box = h('div', { class: 'composer' });
  if (status.ai !== 'deepseek') {
    box.append(h('p', { class: 'ai-off' }, status.ai === 'off'
      ? '서버에 AI 키가 설정되지 않아 정리 요청을 보낼 수 없어요. 지도와 기록은 그대로 볼 수 있어요.'
      : 'AI 서버에 연결되지 않은 페이지예요. 지도와 기록은 그대로 볼 수 있고, 정리 요청은 서버가 연결된 주소에서 쓸 수 있어요.'));
    return box;
  }
  const busy = !!ask?.controller, failed = !!ask && ask.partId === part.id && !ask.controller, draft = getDraft(o, part.id);
  const needsCode = () => status.access === 'code' && !sessionCode(); // read at click time: the code may just have been typed
  const openBox = () => { composerOpen = true; renderPanel(false); document.getElementById(needsCode() ? 'access-code' : 'ask-input')?.focus(); };
  const quick = (intent: AskIntent) => () => (needsCode() ? openBox() : send(intent, null));
  const quickButtons = h('div', { class: 'quick' },
    h('button', { type: 'button', class: 'secondary small', disabled: busy, onclick: quick('summary') }, '지금 상황 정리'),
    h('button', { type: 'button', class: 'secondary small', disabled: busy, onclick: quick('next') }, '다음에 판단할 것'));
  // Reading first: a small entry. The full box opens on demand and stays while there is a draft, a request or an error.
  if (!composerOpen && !busy && !failed && !draft.trim()) {
    box.classList.add('compact');
    box.append(h('div', { class: 'ask-entry' }, h('button', { type: 'button', class: 'ask-open', 'aria-label': `‘${part.name}’에 대해 질문하기`, onclick: openBox }, '질문하기…'), quickButtons));
    return box;
  }
  const input = h('textarea', { id: 'ask-input', rows: '2', maxlength: '1000', placeholder: `‘${part.name}’에 대해 물어보세요`, disabled: busy }) as HTMLTextAreaElement;
  input.value = draft;
  input.addEventListener('input', () => setDraft(o, part.id, input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitQuestion(); } });
  const submitQuestion = () => { if (needsCode()) { document.getElementById('access-code')?.focus(); return; } const q = input.value.trim(); if (q) { send('question', q); } };
  if (status.access === 'code') {
    const code = h('input', { id: 'access-code', type: 'password', placeholder: '접속 코드', autocomplete: 'off', value: sessionCode() }) as HTMLInputElement;
    // input (not only change): typing, paste and autofill are all kept.
    const keep = () => keepAccessCode(code.value);
    code.addEventListener('input', keep); code.addEventListener('change', keep);
    box.append(h('div', { class: 'access' }, h('label', { for: 'access-code' }, '접속 코드'), code));
  }
  if (!busy && !failed) quickButtons.append(h('button', { type: 'button', class: 'link-button fold', onclick: () => { composerOpen = false; if (!input.value.trim()) setDraft(o, part.id, ''); renderPanel(false); } }, '접기'));
  // With the code field in view, every way to send waits for a code (and says so beside the send button).
  const gated = status.access === 'code', hasCode = !!sessionCode();
  quickButtons.querySelectorAll<HTMLButtonElement>('button.secondary').forEach(b => codeGate(b, gated, hasCode, busy));
  put(box, quickButtons,
    h('div', { class: 'ask-row' }, input, codeGate(h('button', { type: 'button', class: 'primary send', 'aria-label': '보내기', onclick: submitQuestion }, '보내기'), gated, hasCode, busy)),
    codeNote(gated, hasCode),
    h('p', { class: 'fine' }, `${status.model ?? 'DeepSeek'}가 이 부분과 안의 부분 기록만 읽고 정리해요 · 개발을 실행하지 않아요`));
  return box;
}
let accessCodeMemory = '';
function keepAccessCode(value: string) { try { sessionStorage.setItem('agentflow.studio.access', value); } catch { /* memory only */ } accessCodeMemory = value; renderStatus(); syncCodeGates(!!value); }

/* ---------- change plan (plan-view.ts) on this map ---------- */
/** The returned results of one exact request, read over the whole window (opened from the map's return pane, a part or the plan). */
const wide = createWideReading({ current: () => (opened ? { key: opened.key, project: opened.project } : null) });
const planView = createPlanView({
  current: () => opened,
  kv,
  status: () => status,
  accessCode: () => sessionCode(), keepAccessCode,
  selected: () => selected,
  boxes: () => lay.boxes,
  targetContext: previewContext,
  rows: next => {
    const key = next ? JSON.stringify([...next].sort(([a], [b]) => (a < b ? -1 : 1))) : '';
    if (key === planRowsKey) return;
    planRows = next; planRowsKey = key;
    if (opened) { renderSpace('keep', false); markSelection(selected); }
  },
  selectPart: id => { if (opened) go(opened.key, id); },
  showPart: id => { const o = opened; if (o) go(o.key, id, partOf(o, id)?.parentId ?? null); },
  reveal,
  capture: () => ({ selected, scope, camera: { ...camera } }),
  notice: (text, action) => toast(text, action),
  restore: r => { const o = opened; if (!o) return; returnCamera = r.camera; go(o.key, r.selected, r.scope); },
  surface: (content, parts, place) => {
    const l = $('lens');
    if (!content) { if (l.classList.contains('compare')) hideLens(); return; }
    // The same reading keeps where the person was in it (a re-render of the same change); a new reading starts at its top.
    const keep = place === false ? l.querySelector('.lens-body')?.scrollTop ?? 0 : 0;
    l.replaceChildren(...content); l.hidden = false; l.classList.remove('scope-read', 'railed'); l.classList.add('compare'); readingFor = parts;
    syncMapArea();
    const body = l.querySelector('.lens-body'); if (body) body.scrollTop = keep;
    // Only an explicit new target moves the map (the smallest pan beside the pane); sources, the long reading and a mode
    // switch keep the person's camera, including a manual pan.
    if (place === true) revealParts(parts);
  },
  area: () => syncMapArea(),
  readReturn: () => { planView.close(); openReturn(); },
  readWide: (at, opener) => wide.open(at, opener),
  pasteReturn: () => { planView.close(); openPaste(selected); },
  fileReturn: () => { planView.close(); openFile(selected); },
  readRequest: id => { planView.close(); void mapRun.run(id); },
  commitProject: next => { const o = opened; return o ? commit(o, next) : Promise.resolve('프로젝트가 열려 있지 않아요.'); },
  frame: (all, fallback) => {
    // Once, when a whole plan comes to read: its changed parts together when they fit beside the pane at this zoom (no zoom,
    // no centring); else the target being read, as for any new target.
    const boxes = all.map(id => lay.boxes.get(id)).filter((b): b is Box => !!b && b.kind !== 'ghost'), area = mapArea();
    // With the map's title when that fits too, as any later target is shown (so reading the next change does not move again).
    for (const rs of boxes.length ? [[...boxes, ...(titleH ? [titleRect()] : [])], boxes] : []) {
      const U = union(rs); if (U.w * camera.k <= area.w - 32 && U.h * camera.k <= area.h - 24) { revealRect(U); return; }
    }
    revealParts(fallback);
  },
  chrome: () => {
    const o = opened; if (!o) return;
    setBar(o); renderRecent();
    if (planView.isOpen()) { scopeReading = false; $('panel').hidden = true; $('panel').replaceChildren(); if (!$('lens').classList.contains('compare')) hideLens(); }
    syncMapArea(); placeEdgeLabels(); // the change plan draws each line: the rest summary and its counts give way
  }
});
/* ---------- coming back: the return reading in the pane ---------- */
/** Parts the return reading is about now: marked on the map (drawn representatives), never selected or restyled by status. */
let readMarks: string[] = [];
/** The camera when a part was opened from (or beside) the return reading; coming back restores it unless the map was moved. */
let readingCamera: { x: number; y: number; k: number } | null = null;
function applyReadMarks() {
  const o = opened, ids = new Set(o ? readMarks.map(id => drawnRep(o, id)).filter((x): x is string => !!x) : []);
  document.querySelectorAll<HTMLElement>('.node[data-part],.frame[data-part]').forEach(el => el.classList.toggle('read-mark', ids.has(el.dataset.part!)));
}
/** The related part a return reading's chosen candidate names, opened to be seen: only the path down to it unfolds, as a
 * reference (tempExpand, as for a part opened by its address); the person's own folds, places and camera are left as they are,
 * and choosing another candidate, letting it go or closing the reading folds that path again. Nothing unfolds before a choice.
 * A part outside the scope is reached the way any explicit move is: up to the scope that holds it (the scene back stays). */
let readOpen: string | null = null;
function openForReading(id: string | null) {
  const o = opened; if (!o || selected || id === readOpen) return;
  readOpen = id;
  if (id && partOf(o, id) && !insideScope(o, id) && id !== scope) { go(o.key, null, partOf(o, id)!.parentId); return; }
  const before = [...tempExpand].join('|');
  tempExpand.clear();
  if (id && id !== scope && partOf(o, id)) expandPath(o, id, tempExpand);
  if ([...tempExpand].join('|') !== before) { renderSpace('keep'); markSelection(selected); }
}
function openReturn() {
  const o = opened; if (!o || o.kind === 'legacy') return;
  if (planView.isOpen()) planView.close(false);
  scopeReading = false;
  if (selected) { go(o.key); }
  returnView.open();
}
/** The same paste box from a selected part: the part is the reading's context, and closing the pane comes back to this scene
 * (selection, scope, camera; folds were never touched). Captured here, before opening the pane clears the selection. */
function openPaste(partId: string | null) {
  const o = opened; if (!o || o.kind !== 'saved') return;
  const scene = readingScene();
  openReturn();
  returnView.openPaste(partId, scene);
}
/** The provided-file form from the map, a part or a request: the same scene discipline as the paste box. */
function openFile(partId: string | null) {
  const o = opened; if (!o || o.kind !== 'saved') return;
  const scene = readingScene();
  openReturn();
  returnView.openFile(partId, scene);
}
/** Where AI session records come from: the local server when it reads this PC's sessions, else folders picked in this browser. */
const sessionSources = createSessionSources({ status: () => status, accessCode: () => sessionCode() });
const returnView = createReturnView({
  current: () => opened,
  kv,
  autoConnected: () => autoSync.connected(),
  sources: sessionSources,
  status: () => status,
  accessCode: () => sessionCode(), keepAccessCode,
  bundle: () => planView.bundleOf(),
  show: content => {
    const l = $('lens');
    if (!content) { if (l.classList.contains('return-read')) hideLens(); return; }
    if (selected || planView.isOpen()) return;
    const same = l.classList.contains('return-read') && !l.hidden, keep = same ? l.querySelector('.lens-body')?.scrollTop ?? 0 : 0;
    l.replaceChildren(...content); l.classList.remove('compare', 'scope-read', 'railed'); l.classList.add('return-read'); l.hidden = false; readingFor = [];
    syncMapArea();
    const body = l.querySelector('.lens-body'); if (body && same) body.scrollTop = keep;
  },
  mark: ids => { readMarks = [...ids]; applyReadMarks(); },
  open: openForReading,
  reveal: ids => { const o = opened; if (!o) return; revealParts([...new Set(ids.map(id => drawnRep(o, id)).filter((x): x is string => !!x))]); },
  selectPart: id => { const o = opened; if (!o) return; readingCamera = { ...camera }; mapMoved = false; go(o.key, id); },
  trial: (text, sources) => { planView.propose(text, sources); },
  compare: ids => { planView.focusParts(ids); },
  chrome: () => { const o = opened; if (o) setBar(o); },
  paste: async (texts, context) => {
    const o = opened; if (!o || o.kind !== 'saved') return '이 프로젝트에는 기록을 저장할 수 없어요.';
    let next = o.project, id = '', fresh = false, scenario: string | null = null, scenarioError = false;
    try { for (const t of texts) { const r = pasteRecord(next, t, context && partOf(o, context) ? context : null); next = r.project; id = r.record.id; fresh ||= !r.duplicate;
      // A scenario record (시나리오 기록 v2) is read by the app alone against the current map's ID ledger, once per record.
      if (scenarioRecordLike(r.record.text) && !next.readings.some(x => isScenarioReading(x) && x.record === r.record.id)) {
        try { next = applyScenario(next, r.record.id, parseScenarioRecord(r.record.text, projectLedger(next))); scenario = r.record.id; fresh = true; } catch { scenarioError = true; }
      } } }
    catch { return '이 글은 저장할 수 없어요(너무 길거나 쓸 수 없는 문자).'; }
    if (!fresh) return { id, duplicate: true, scenarioError };
    const failed = await commit(o, next);
    // A saved record is now a record to read into the map (nothing was sent): the map's own entries say so. A scenario read from it
    // joins the title's scenario line.
    if (!failed) { renderMapEntry(); refreshUnderstood(); if (scenario && opened === o) redrawScenario(); }
    return failed ?? { id, duplicate: false, scenario, scenarioError };
  },
  provide: async (key, text, evidence, context) => {
    // Only the entry the file was chosen in: after a switch nothing is written to the project open now.
    const o = opened; if (!o || o.kind !== 'saved' || o.key !== key) return '다른 프로젝트가 열려 있어 저장하지 않았어요. 고른 파일은 원래 프로젝트의 양식에 남아 있어요.';
    let r: ReturnType<typeof provideRecord>;
    try { r = provideRecord(o.project, text, evidence, context && partOf(o, context) ? context : null); } catch { return '이 자료는 저장할 수 없어요(너무 길거나 쓸 수 없는 문자, 또는 이름·판본·출처의 길이나 문자).'; }
    if (r.duplicate) return { id: r.record.id, duplicate: true };
    const failed = await commit(o, r.project);
    if (!failed && opened === o) { renderMapEntry(); refreshUnderstood(); }
    return failed ?? { id: r.record.id, duplicate: false };
  },
  legacyKey: () => {
    const o = opened; if (!o || o.kind !== 'saved') return null;
    return store.entries().find(e => e.entryId === o.key)?.origin === 'import' ? null : o.project.id;
  },
  restoreScene: scene => {
    const o = opened; if (!o || (scene.key && scene.key !== o.key)) return;
    returnCamera = scene.camera;
    quoteBack = scene.reading ? { ...scene.reading, key: o.key, selected: scene.selected, scope: scene.scope, camera: scene.camera } : null;
    go(o.key, scene.selected && partOf(o, scene.selected) ? scene.selected : null, scene.scope && partOf(o, scene.scope) ? scene.scope : null);
  },
  mapBlock: () => mapBlock(),
  mapRead: () => {
    const o = opened; if (!o || o.kind !== 'saved') return null;
    const maps = o.project.readings.filter(isMapReading);
    return maps.length ? { records: new Set(maps.flatMap(r => r.records.map(x => x.id))).size } : null;
  },
  mapMarks: () => { const o = opened; return o && justRead?.key === o.key ? justRead.parts : []; },
  readIntoMap: id => !!opened && recordReadIntoMap(opened.project, id),
  scenarioResult: id => scenarioResult(id),
  ledgerLine: () => { const o = opened; return o && o.view.parts.length ? projectLedger(o.project).versionLine : null; },
  removeRecord: async id => {
    const o = opened; if (!o || o.kind !== 'saved') return '이 프로젝트에서는 기록을 지울 수 없어요.';
    // A reading under way (or one waiting to be applied) may hold this record: nothing is taken out from under it.
    const st = mapRun.state(); if (st.pending || st.ready || st.committing) return '지도 정리가 진행 중이라 지금은 지울 수 없어요. 끝나거나 취소한 뒤 다시 해 주세요.';
    let next: Project;
    try { next = removePastedRecord(o.project, id); }
    catch (err) { return (err as Error)?.message === 'RECORD_READ' ? '지도 정리에 이미 읽힌 기록이라 지울 수 없어요. 지도의 근거가 이 기록을 가리켜요.' : '이 기록을 찾지 못했어요.'; }
    const failed = await commit(o, next);
    if (!failed && opened === o) { renderMapEntry(); refreshUnderstood(); }
    return failed;
  },
  mapPrimary: () => { const inp = mapRun.input(); return !!inp && !inp.problem && mapRun.can(); }
});

/* ---------- reading records into the map (studio.map.1) ---------- */
/** The parts the last map reading of this visit added or said something about (marked while the pane reads it). */
let justRead: { key: string; parts: string[] } | null = null;
const mapRun = createMapRun({
  current: () => opened,
  // Each opening of a project is its own visit (projectFor keeps the object while the same project stays open).
  visit: () => opened,
  status: () => status,
  accessCode: () => sessionCode(),
  requests: () => opened ? frozenRequests(opened.project, (planView.bundleOf()?.snapshots ?? []).flatMap(s => s.scope ? [s.scope] : [])) : [],
  commit: async next => {
    const o = opened; if (!o) return '프로젝트가 열려 있지 않아요.';
    const base = o.ref ? { ...o.ref } : null, failed = await commit(o, next), now = opened;
    // Left and came back while it was saved: this visit may have read the entry just before the save landed. It takes the saved
    // project only when it read the very state this save replaced (same lifecycle and save number), so it is not left stale.
    if (!failed && now && now !== o && now.key === o.key && base && now.ref && now.ref.lifecycle === base.lifecycle && now.ref.seq === base.seq) {
      now.ref = o.ref; now.project = o.project; now.view = o.view; renderSpace('keep'); if (selected) refreshReading(); wide.render();
    }
    return failed;
  },
  done: applied => mapApplied(applied),
  changed: key => mapChanged(key),
  // A reading the person called off is not started again by the automatic connection until a new record comes in.
  withdrawn: key => autoSync.hold(key),
  // AF100: reservations of durable jobs, apart from projects and backups (under their own lock); used when the server keeps jobs.
  jobs: () => jobReservations,
  ownSave: (key, seq) => ownSaves.has(`${key}:${seq}`),
  stored: key => { const fresh = new WorkspaceStore(kv, null); fresh.read(); const e = fresh.entries().find(x => x.entryId === key); return e ? { project: e.project, lifecycle: e.lifecycle } : null; }
});
let jobReservations: JobReservations | null = null;

/* ---------- automatic connection to a working folder's Claude Code / Codex sessions (auto-sync.ts) ---------- */
const handover = createHandoverView({ current: () => opened, cloud: () => cloudLink, requests: () => opened ? frozenRequests(opened.project, (planView.bundleOf()?.snapshots ?? []).flatMap(s => s.scope ? [s.scope] : [])) : [] });
const utf8 = (t: string) => new TextEncoder().encode(t).length;
/** Why these records cannot be added to the project (a project keeps at most PASTED_LIMIT of them and FILE_LIMIT bytes in all), or
 * null. With none, whether even a small one still fits. */
function recordRoom(p: Project, texts: string[]): string | null {
  const more = ' 새 대화는 더 들어오지 않아요. 새 프로젝트를 만들어 연결해 주세요.';
  if (p.pasted.length + Math.max(1, texts.length) > PASTED_LIMIT) return `이 프로젝트에 기록이 가득 찼어요(${PASTED_LIMIT}개까지).${more}`;
  // Each record is also its id, time and part in the saved file.
  const adds = texts.length ? texts.reduce((n, t) => n + utf8(JSON.stringify(t)) + 120, 0) : 4096;
  return utf8(serializeProject(p)) + adds > FILE_LIMIT ? `이 프로젝트에 담을 수 있는 기록의 양(${FILE_LIMIT / 1e6}MB)이 다 찼어요.${more}` : null;
}
/** Keeps texts (one session's, or a web AI session's through the connector) as pasted records of the entry open now. */
async function saveRecords(key: string, texts: string[]): Promise<{ error: string; refused: boolean } | null> {
    // Only the entry the sessions were looked at for: after a switch nothing is written to the project open now.
    const o = opened; if (!o || o.kind !== 'saved' || o.key !== key) return { error: '다른 프로젝트가 열려 있어 저장하지 않았어요.', refused: false };
    const full = recordRoom(o.project, texts); if (full) return { error: full, refused: false };
    let next = o.project;
    try { for (const t of texts) next = pasteRecord(next, t, null).project; } catch { return { error: '세션 기록 하나를 저장하지 못했어요(쓸 수 없는 문자나 키처럼 보이는 글). 다른 세션은 계속 들어와요.', refused: true }; }
    if (next === o.project) return null;
    const failed = await commit(o, next);
    if (!failed) { renderMapEntry(); refreshUnderstood(); if (!planView.isOpen()) { if (!selected) returnView.render(); else refreshSessions(); } return null; }
    // Nothing more is tried until the person asks: said so, and for a full browser storage, why.
    return { error: saveFailure === 'QUOTA' ? '이 브라우저의 저장 공간이 가득 차서 세션 기록을 저장하지 못했어요. 자동으로 다시 하지 않아요.' : `${failed} 자동으로 다시 하지 않아요.`, refused: false };
  }
/** The AgentFlow connector (an MCP server an AI session runs beside it, connector/agentflow-mcp.mjs) through the local server: the
 * records sessions leave come in with the automatic connection, and the open project's handover document is left for a session
 * that asks for it, made again only when the project changed (one code per project while this page is open). */
const handoverLeft = new Map<string, { revision: number; folders: string; code: string }>();
/** The whole project's handover document with this code, with the change requests made for it. */
function handoverFor(p: Project, code: string): string | null {
  try { return handoverDoc(p, { scope: null, code, at: new Date().toISOString(), requests: frozenRequests(p, (planView.bundleOf()?.snapshots ?? []).flatMap(s => s.scope ? [s.scope] : [])) }).text; } catch { return null; }
}
/** The web AI connector of this site, when it has one (cloud-link.ts): records of web chats come in for a linked project. */
const cloudCodes = new Map<string, string>();
const cloudLink = createCloudLink({
  current: () => opened, kv,
  save: async (key, texts) => { const no = await saveRecords(key, texts); return no ? { error: no.error } : null; },
  handover: () => { const o = opened; if (!o) return null; const code = cloudCodes.get(o.key) ?? handoverCode(); cloudCodes.set(o.key, code); return handoverFor(o.project, code); },
  changed: () => { if (handover.isOpen()) handover.refresh(); }
});
const connectorHost = {
  records: (after: number, folders: string[], project: string) => connectorRecords(sessionCode(), after, folders, project),
  publish: async (key: string, folders: string[]) => {
    const o = opened; if (!o || o.kind !== 'saved' || o.key !== key || !folders.length) return;
    const was = handoverLeft.get(key), joined = folders.join('\n');
    if (was && was.revision === o.project.revision && was.folders === joined) return;
    const code = was?.code ?? handoverCode();
    const text = handoverFor(o.project, code); if (!text) return;
    await publishHandover(sessionCode(), { key, code, name: o.project.name, folders, text });
    handoverLeft.set(key, { revision: o.project.revision, folders: joined, code });
  }
};
const autoSync = createAutoSync({
  current: () => opened,
  sources: sessionSources,
  kv,
  save: saveRecords,
  full: () => { const o = opened; return o && o.kind === 'saved' ? recordRoom(o.project, []) : null; },
  canRead: () => { const inp = mapRun.input(), st = mapRun.state(); return !!inp && !inp.problem && mapRun.can() && !st.pending && !st.ready && !st.committing; },
  read: () => void mapRun.run(),
  bound: () => renderMapEntry(),
  connector: () => (status.connector && status.sessions ? connectorHost : null),
  readBlocked: () => (status.release === 'existing-map' ? RELEASE_TEXT.limit : mapRun.can() ? null : mapRun.blocked() ?? '지도 정리에 쓸 AI가 이 서버에 연결되어 있지 않아요.')
});
/** AF100: while a reading runs as a job, the person is told it goes on without this window but not without the PC's Studio.
 * Until the server reports a stage, the text says how the reading goes (its route); the map title's short line may say less. */
/** When the reading now pending was first seen, and the ticker that writes how long it has run (a reading takes minutes; a
 * spinner alone says nothing about whether it is still going). Cleared when no reading is pending. */
let runSeen = 0, runTick = 0;
function elapsedText(): string {
  const s = Math.max(0, Math.round((Date.now() - runSeen) / 1000)), m = Math.floor(s / 60);
  return `${m ? `${m}분 ` : ''}${s % 60}초째 · 보통 3–5분`;
}
function tickElapsed() {
  if (!mapRun.state().pending && !mapRun.state().committing) { clearInterval(runTick); runTick = 0; runSeen = 0; return; }
  document.querySelectorAll<HTMLElement>('.mu-elapsed').forEach(el => { el.textContent = elapsedText(); });
}
function pendingLine(cls: string, cancelClass: string, short?: string): HTMLElement[] {
  const d = mapRun.detail();
  if (!runSeen) runSeen = Date.now();
  if (!runTick) runTick = window.setInterval(tickElapsed, 1000);
  return [h('span', { class: 'mu-pending' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), d.cancelling ? '취소하는 중…' : d.progress ?? short ?? mapPendingText(d.route), d.cancelling ? null : h('span', { class: 'mu-elapsed' }, elapsedText())),
    d.cancelling ? null : h('button', { type: 'button', class: cancelClass, onclick: () => mapRun.cancel() }, '취소'),
    d.durable ? h('span', { class: `fine mu-durable ${cls}` }, JOB_NOTE.durable) : null].filter((x): x is HTMLElement => !!x);
}
/** A short notice beside a reading's state (a cancel and what it cannot promise, a job not reachable). */
function runNotice(): HTMLElement | null { const n = mapRun.detail().notice; return n ? h('span', { class: 'fine mu-notice', role: 'status' }, n) : null; }
/** Only what belongs to the entry whose reading changed: its home card, or its own map and panes while it is the one open. Another
 * project open now (its paste, selection, scroll and focus) is never redrawn by it. */
function mapChanged(key: string) {
  const o = opened;
  if (!o) { document.querySelectorAll<HTMLElement>('#saved-list [data-run-entry]').forEach(el => { if (el.dataset.runEntry === key) runBadge(el); }); return; }
  if (o.key !== key) return;
  renderMapEntry(); refreshUnderstood();
  if (returnView.isOpen() && !selected) returnView.render();
  wide.render();
}
/** A project's map reading on its home card, said in place: the home page is not drawn again, so a draft or the focus there stays. */
function runBadge(el: HTMLElement) {
  const st = mapRun.stateOf(el.dataset.runEntry!);
  el.textContent = st.committing ? '지도에 반영하는 중…' : st.ready ? '지도 정리 결과 도착 · 열어서 보기' : st.pending ? (mapRun.detail(el.dataset.runEntry!).durable ? '지도 정리 중… · 창을 닫아도 PC에서 계속' : '지도 정리 중…') : st.error ? '지도 정리 안 됨 · 열어서 확인' : '';
  el.hidden = !el.textContent;
}
/** A reading being saved (no longer cancellable), or a reply waiting for this project: in place of the way to start a reading. */
function runReady(st: MapRunState, primary: string, link: string): HTMLElement[] {
  if (st.committing) return [h('span', { class: 'mu-pending mu-committing', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), '지도에 반영하는 중…')];
  return [h('span', { class: 'mu-ready', role: 'status' }, st.error ? '정리 결과가 아직 지도에 저장되지 않았어요.' : '지도 정리 결과가 도착했어요. 아직 지도에 반영하지 않았어요.'),
    h('button', { type: 'button', class: `${primary} mu-apply`, title: '다시 요청하지 않고 도착한 결과를 지금 지도와 대조해 반영해요', onclick: () => void mapRun.applyReady() }, st.error ? '다시 반영' : '정리 결과 보기'),
    h('button', { type: 'button', class: `${link} mu-discard`, onclick: () => mapRun.discard() }, '버리기')];
}
/** Applied and saved: the map shows what came in where it is (a first map fits the view), and the pane says what was understood. */
function mapApplied(a: Applied) {
  const o = opened; if (!o) return;
  const first = a.created.length > 0 && o.view.parts.length === a.created.length;
  justRead = { key: o.key, parts: [...new Set([...a.created, ...a.touched])] };
  // The map is what one reads now: the pane the reading was asked from closes (its long record steps back), the title line says
  // what was understood and opens the evidence on request; the parts it touched are marked where they are. Only a first map
  // (nothing was on the map) fits the view; otherwise the camera and places stay as the person left them.
  if (returnView.isOpen()) { returnView.mapApplied(); returnView.close(); }
  renderSpace(first ? 'fit' : 'keep');
  readMarks = justRead.parts; applyReadMarks();
  if (selected) refreshReading();
  // The pane it may have been opened from has just closed: the wide reading says so and closes to the map.
  wide.render();
}
/** The scope's main flow under the title: its spine (the longest chain of flows and needs among its parts, map-layout) as
 * steps the reader can follow and select. It says what the map is about before any line is read; pointing at a step lights
 * that part and its spine lines on the map, and the map draws the same chain darker. Only a chain of three steps or more. */
function flowStrip(o: Opened): HTMLElement | null {
  const ids = lay.spine; if (ids.length < 3) return null;
  const spineEdges = lay.edges.filter(e => e.spine), edgeIds = (id: string) => spineEdges.filter(e => e.from === id || e.to === id).flatMap(e => e.ids);
  const el = h('p', { class: 'map-flow', 'aria-label': '주 흐름' }, h('span', { class: 'mf-verb' }, '주 흐름'));
  ids.forEach((id, i) => {
    const p = partOf(o, id); if (!p) return;
    if (i) el.append(h('span', { class: 'mf-arrow', 'aria-hidden': 'true' }, '→'));
    el.append(h('button', { type: 'button', class: 'mf-step', 'data-part': id, title: `${p.name} · 흐름의 ${i + 1}번째 · 선택해 읽기`, onclick: () => go(o.key, id), ...lightOn(edgeIds(id), id) }, p.name));
  });
  return el;
}
/** The scope's parts counted by how far their records go (checked · reported but not checked · asked only · nothing yet): the
 * state of the whole map in one line over its structure. Pointing at a count lights those parts; the others step back. A click
 * holds that until the next click or Escape. */
let stateHold: string | null = null;
function stateStrip(o: Opened): HTMLElement | null {
  const cards = [...lay.boxes.values()].filter(b => b.kind === 'node').map(b => partOf(o, b.id)).filter((p): p is PartView => !!p);
  if (cards.length < 2) return null;
  const stage = (p: PartView) => { const l = ladderOf(o.view, p); return l.check ? 'check' : l.report ? 'report' : l.ask ? 'ask' : 'none'; };
  const groups = new Map<string, string[]>(); for (const p of cards) { const k = stage(p); groups.set(k, [...(groups.get(k) ?? []), p.id]); }
  const WORDS: Record<string, [string, string]> = { check: ['확인됨', '검사나 자료로 확인한 기록이 있는 부분'], report: ['보고됨', '했다는 보고만 있고 아직 확인되지 않은 부분'], ask: ['요청만', '요청만 있고 보고가 없는 부분'], none: ['기록 없음', '요청·보고·확인 기록이 아직 없는 부분'] };
  const el = h('p', { class: 'map-states', 'aria-label': '부분의 상태' });
  const show = (k: string | null) => {
    const ids = new Set(k ? groups.get(k) ?? [] : []), sp = $('space');
    sp.classList.toggle('state-peek', ids.size > 0);
    document.querySelectorAll<HTMLElement>('#world .node[data-part]').forEach(n => n.classList.toggle('state-on', ids.has(n.dataset.part!)));
    el.querySelectorAll('.ms').forEach(b => b.classList.toggle('on', !!k && b.classList.contains(`ms-${k}`)));
  };
  stateHold = null; $('space').classList.remove('state-peek');
  for (const k of ['check', 'report', 'ask', 'none']) {
    const ids = groups.get(k); if (!ids?.length) continue;
    el.append(h('button', { type: 'button', class: `ms ms-${k}`, title: WORDS[k]![1], 'aria-pressed': 'false',
      onpointerenter: () => { if (!stateHold) show(k); }, onpointerleave: () => { if (!stateHold) show(null); }, onfocus: () => { if (!stateHold) show(k); }, onblur: () => { if (!stateHold) show(null); },
      onclick: (e: Event) => { stateHold = stateHold === k ? null : k; show(stateHold); el.querySelectorAll('.ms').forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('on')))); (e.currentTarget as HTMLElement).blur(); } },
      h('i', { class: `rung r-${k}`, 'aria-hidden': 'true' }), `${WORDS[k]![0]} ${ids.length}`));
  }
  return el;
}
/** The map title's line: what the records made understandable (the last reading's sentence), new records to read, the way to it. */
function understoodLine(o: Opened): HTMLElement | null {
  if (o.kind !== 'saved' || !o.view.parts.length) return null;
  const last = mapRun.last(), inp = mapRun.input(), st = mapRun.state(), fresh = inp && inp.problem !== 'NOTHING_NEW' ? inp.coverage.fresh : 0;
  const waiting = st.committing || st.ready;
  if (!last && !fresh && !st.pending && !st.error && !waiting && !mapRun.detail().notice) return null;
  const line = h('p', { class: 'map-understood' });
  if (last?.summary) line.append(h('span', { class: 'mu-text' }, last.summary));
  const comparison = last ? requestComparison(o.project, last) : null;
  if (comparison) line.append(h('button', { type: 'button', class: 'map-more mu-comparison', onclick: () => openReturn() }, comparison));
  if (st.pending) line.append(...pendingLine('mu-durable-line', 'map-more', '기록을 읽고 지도를 갱신하는 중…'));
  else if (waiting) line.append(...runReady(st, 'map-more', 'map-more'));
  else if (fresh && mapRun.can() && !inp!.problem) line.append(h('button', { type: 'button', class: 'map-more mu-run', title: sendLine(inp!), onclick: () => void mapRun.run() }, `새 기록 ${fresh}개 읽고 지도 갱신`));
  else if (fresh) line.append(h('span', { class: 'mu-fresh' }, `아직 지도에 읽지 않은 기록 ${fresh}개`), ...(mapRun.blocked() ? [h('span', { class: 'fine mu-blocked' }, mapRun.blocked()!)] : []));
  // AF124: a limited release reads no report against a request, so it offers no request to choose for one (stored comparisons stay).
  const limited = status.release === 'existing-map';
  if (inp?.problem === 'REQUEST_CONTEXT_TOO_LARGE' && !limited) line.append(h('button', { type: 'button', class: 'map-more', title: sendLine(inp), onclick: () => { if (returnView.isOpen()) returnView.close(); planView.openResults(); } }, '요청문을 골라 대조'));
  if (inp?.problem === 'REQUEST_CONTEXT_TOO_LARGE' && mapRun.can() && !st.pending && !waiting) line.append(h('button', { type: 'button', class: 'map-more mu-map-only', title: '요청과 대조하지 않고 지도만 정리해요. 원문은 보존되며 나중에 요청문을 골라 대조할 수 있어요.', onclick: () => void mapRun.runMapOnly() }, '요청 대조 없이 지도만 정리'));
  if (last?.version === 'map-reading.1' && !limited && frozenRequests(o.project, (planView.bundleOf()?.snapshots ?? []).flatMap(s => s.scope ? [s.scope] : [])).length) line.append(h('button', { type: 'button', class: 'map-more', title: '지도에 읽힌 원문도 고른 요청과 나중에 대조할 수 있어요', onclick: () => { if (returnView.isOpen()) returnView.close(); planView.openResults(); } }, '나중에 요청문을 골라 대조'));
  // What this reading left open reads beside its summary: the gaps (conditions the records do not answer) and the unsettled
  // statements, counted, opening the reading of the return where each is listed.
  if (last) {
    const open = [last.gaps.length ? `답 없는 조건 ${last.gaps.length}` : '', last.candidates.length ? `미정 ${last.candidates.length}` : ''].filter(Boolean);
    line.append(h('button', { type: 'button', class: `map-more${open.length ? ' mu-open' : ''}`, title: [`이번 정리가 무엇을 읽었고 어떤 조건에 기록이 답하지 않는지`, ...last.gaps.map(g => `답 없는 조건: ${g}`)].join(String.fromCharCode(10)), onclick: () => openReturn() }, open.length ? `AI가 읽은 것 · ${open.join(' · ')}` : 'AI가 읽은 것'));
  }
  if (st.error) line.append(h('span', { class: 'mu-error', role: 'alert' }, st.error));
  const note = runNotice(); if (note) line.append(note);
  return line;
}
function refreshUnderstood() {
  const o = opened, title = document.querySelector('#world .map-title'); if (!o || !title || scope) return;
  const next = understoodLine(o), cur = title.querySelector('.map-understood');
  if (cur && next) cur.replaceWith(next); else if (cur) cur.remove(); else if (next) title.append(next);
  const t = title as HTMLElement, hBefore = titleH;
  titleH = o.view.parts.length ? t.offsetHeight : 0;
  if (titleH !== hBefore) { lay.bounds = { ...core }; withTitle(); positionWorld(); }
}
/** The server's status (or the session folders this browser can read) came after the open project was drawn: its empty map's entry
 * and the title's line say now what a reading can do and whether sessions can be connected (the same mapRun.can/input/blocked as a click; nothing starts or moves). Only the project open now, in place: a focus
 * inside them stays on the same action, and its selection, panes and camera are not touched. */
function statusArrived() {
  const a = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const near = a?.closest<HTMLElement>('#space-empty, #world .map-title') ?? null, text = a?.textContent ?? '';
  renderMapEntry(); refreshUnderstood();
  if (near?.isConnected && a && !a.isConnected) [...near.querySelectorAll<HTMLElement>('button')].find(x => x.textContent === text)?.focus();
}
/** An empty saved map: records are the first way in (pasting saves only; reading sends, and says so), adding a part by hand is
 * the other. A project with records already can start from them without pasting again. */
function renderMapEntry() {
  const o = opened, box = $('space-empty'); if (!o) return;
  if (o.view.parts.length || partForm) { box.hidden = true; box.replaceChildren(); return; }
  if (o.kind !== 'saved') { box.replaceChildren(h('p', {}, o.view.records.length ? `아직 부분으로 나뉘지 않은 프로젝트예요. 기록 ${o.view.records.length}개는 ‘최근 기록’에서 볼 수 있어요.` : '아직 부분도 기록도 없는 프로젝트예요.')); box.hidden = false; return; }
  const next = mapRun.preview(), inp = next?.inp ?? null, st = mapRun.state(), last = mapRun.last(), can = mapRun.can();
  const fresh = inp && inp.problem !== 'NOTHING_NEW' ? inp.coverage.fresh : 0;
  if (status.release === 'existing-map') {
    // AF124: no first map here. Records can still be kept and parts added by hand; the ways in are the release's own.
    box.replaceChildren(); put(box, h('h2', {}, '기존 지도 작업용 버전이에요'), h('p', { class: 'se-lead' }, RELEASE_TEXT.limit),
      h('div', { class: 'se-acts' }, ...releaseActions('primary small')),
      h('p', { class: 'fine' }, fresh ? `기록 ${fresh}개는 이 프로젝트에 보관돼 있어요. 기록은 붙여 넣어 보관하고, 부분은 직접 추가할 수 있어요.` : '기록은 붙여 넣어 보관하고, 부분은 직접 추가할 수 있어요.'),
      h('div', { class: 'se-acts' }, h('button', { type: 'button', class: 'secondary small', onclick: () => openPaste(null) }, '기록 붙여넣기'),
        h('button', { type: 'button', class: 'secondary small se-file', title: '코드나 검사 기록 파일 하나를 원문 그대로 자료로 보관해요', onclick: () => openFile(null) }, '코드·검사 자료 추가')),
      st.error ? h('p', { class: 'pp-error', role: 'alert' }, st.error) : null,
      h('button', { type: 'button', class: 'link-button se-direct', onclick: () => openPartForm(null) }, '부분 직접 추가'));
    box.hidden = false; return;
  }
  if (RUNTIME.apiBase === null) {
    box.replaceChildren(h('h2', {}, 'AI가 연결되지 않은 정적 체험판이에요'),
      h('p', { class: 'se-lead' }, '예제나 가져온 지도를 읽고 직접 고칠 수 있어요. 기록을 보관할 수 있지만, 이 주소에서는 AI로 첫 지도를 만들거나 갱신하지 않아요.'),
      h('div', { class: 'se-acts' }, h('button', { type: 'button', class: 'primary small', onclick: () => showExamples() }, '예제로 살펴보기'), pcGuide('secondary small')),
      h('div', { class: 'se-acts' }, h('button', { type: 'button', class: 'link-button', onclick: () => openPaste(null) }, '기록만 보관하기'),
        h('button', { type: 'button', class: 'link-button se-direct', onclick: () => openPartForm(null) }, '부분 직접 추가')));
    box.hidden = false; return;
  }
  const paste = (primary: boolean) => h('button', { type: 'button', class: primary ? 'primary small' : 'secondary small', onclick: () => openPaste(null) }, '기록 붙여넣기');
  const file = () => h('button', { type: 'button', class: 'secondary small se-file', title: '코드나 검사 기록 파일 하나를 원문 그대로 자료로 보관해요', onclick: () => openFile(null) }, '코드·검사 자료 추가');
  const acts = h('div', { class: 'se-acts' }), waiting = st.committing || st.ready;
  // Sessions this page can read, in a project not connected yet: the automatic connection is the first way in, pasting the other.
  const linked = !!autoSync.bindingOf(o.key), offerSync = !linked && sessionSources.offered();
  if (st.pending) put(acts, ...pendingLine('se-durable', 'link-button'));
  else if (waiting) put(acts, ...runReady(st, 'primary small', 'link-button'));
  else if (fresh && can && !inp!.problem) put(acts, h('button', { type: 'button', class: 'primary small se-run', onclick: () => void mapRun.run() }, '기록으로 지도 정리'), paste(false), file());
  else if (offerSync) put(acts, h('button', { type: 'button', class: 'primary small se-sync', onclick: () => autoSync.toggle() }, '내 AI 세션 자동 연결'), paste(false), file());
  else put(acts, paste(true), file());
  const note = st.pending || waiting ? null : fresh && can && !inp!.problem ? sendLine(inp!) : fresh && !can ? mapRun.blocked() ?? `기록 ${fresh}개가 있어요. AI 서버가 연결된 주소에서 지도로 정리할 수 있어요.` : fresh && inp!.problem ? '보낼 수 없는 기록이 있어요(너무 크거나 키처럼 보이는 글).' : linked && can ? AUTO_SENDS : '붙여 넣어 저장만 해서는 AI에 보내지 않아요. 지도로 정리할 때 보내요.';
  box.replaceChildren(); put(box, h('h2', {}, '기록으로 첫 지도를 만들어요'),
    h('p', { class: 'se-lead' }, offerSync ? '이미 진행한 프로젝트는 이전 대화나 현황 기록으로 시작하세요. 이 PC의 Claude Code·Codex 작업 폴더를 연결하면 새 기록도 이어서 가져와요. 다른 PC의 기록은 파일로 가져오거나 붙여 넣을 수 있어요.'
      : '이미 진행한 프로젝트는 이전 대화나 현황 기록을, 새 프로젝트는 처음 나눈 요구부터 넣으세요. 원문을 근거로 지도를 만들고 이후 기록을 이어서 읽어요.'),
    last && !last.parts.length ? h('p', { class: 'se-gap' }, last.gaps.length ? last.gaps.join(' ') : '앞서 읽은 기록에서는 프로그램의 부분을 찾지 못했어요.') : null,
    acts, note ? h('p', { class: 'fine' }, note) : null,
    // A project an AI session already knows: that session writes the report the map reads best. The words are copied here and
    // carried by the person; nothing is sent.
    // Three records the spec names (§8.1): the status report, the design record, and the scenario record with the map's ledger
    // (only once a map exists; the app reads it as a path against that ledger when it is pasted back).
    fresh ? null : h('p', { class: 'fine se-ask' }, '진행 중인 AI 대화가 있다면 ', askCopy('현황 보고 요청', PROJECT_REPORT_ASK, 'link-button', RECORD_ASK_EXPLAIN.status), ' · ',
      askCopy('설계 기록 요청', DESIGN_RECORD_ASK, 'link-button', RECORD_ASK_EXPLAIN.design),
      ...(o.view.parts.length ? [' · ', askCopy('시나리오 기록 요청(대장 포함)', scenarioAskWithLedger(o.view, o.project.readings), 'link-button', RECORD_ASK_EXPLAIN.scenario)] : []),
      ' 문구를 복사해 그 대화에 붙여 넣으세요(파일을 못 보는 대화면 ', askCopy('대화용 현황 요청', CHAT_REPORT_ASK, 'link-button', RECORD_ASK_EXPLAIN.status),
      '). 나온 답을 하나씩 ‘기록 붙여넣기’에 넣으면 부분·연결·상태·안의 단계·모르는 것이 지도가 돼요.'),
    // How this reading is batched and bounded: the route the very next reading takes (shared/map-route.ts), not a guess from status.
    // How the reading is batched and bounded (shared/map-route.ts): folded, for the first time a person reads this card.
    mapBatchLines(next?.route ?? null).length ? h('details', { class: 'se-more' }, h('summary', {}, '어떻게 읽는지 · 비용 상한'), ...mapBatchLines(next?.route ?? null).map(t => h('p', { class: 'fine se-batch' }, t))) : null,
    st.error ? h('p', { class: 'pp-error', role: 'alert' }, st.error) : null, runNotice(),
    h('button', { type: 'button', class: 'link-button se-direct', onclick: () => openPartForm(null) }, '부분 직접 추가'));
  box.hidden = false;
}
/** The map row in the reading pane: records to read into the map, and what the last map reading understood, its candidates and gaps. */
function mapBlock(): HTMLElement | null {
  const o = opened; if (!o || o.kind !== 'saved') return null;
  const last = mapRun.last(), next = mapRun.preview(), inp = next?.inp ?? null, st = mapRun.state(), can = mapRun.can();
  const fresh = inp && inp.problem !== 'NOTHING_NEW' ? inp.coverage.fresh : 0;
  const waiting = st.committing || st.ready;
  if (!last && !fresh && !st.pending && !st.error && !waiting && !mapRun.detail().notice) return null;
  const sec = h('section', { class: 'rr-sec rr-map' }, h('h3', {}, '지도 정리', last ? h('small', {}, fullTime(last.at)) : null));
  if (st.pending) sec.append(h('div', { class: 'pending' }, ...pendingLine('rm-durable', 'link-button')));
  else if (waiting) sec.append(h('div', { class: 'pp-row rm-ready' }, ...runReady(st, 'primary small', 'link-button')));
  else if (fresh) sec.append(h('div', { class: 'pp-row' },
    can && !inp!.problem ? h('button', { type: 'button', class: 'primary small', onclick: () => void mapRun.run() }, o.view.parts.length ? '기록 읽고 지도 갱신' : '기록으로 지도 정리') : null,
    h('span', { class: 'fine' }, can && !inp!.problem ? `읽지 않은 기록 ${fresh}개 · ${sendLine(inp!)}` : !can ? `읽지 않은 기록 ${fresh}개 · ${mapRun.blocked() ?? 'AI 서버가 연결된 주소에서 정리할 수 있어요'}` : '보낼 수 없는 기록이 있어요(너무 크거나 키처럼 보이는 글).')),
    ...(can && !inp!.problem ? mapBatchLines(next?.route ?? null).map(t => h('p', { class: 'fine rm-batch' }, t)) : []));
  if (st.error) sec.append(h('p', { class: 'pp-error', role: 'alert' }, st.error));
  { const note = runNotice(); if (note) sec.append(note); }
  // A map that exists: the next report asks only for what changed, by the names this map holds.
  if (o.view.parts.length && !st.pending) sec.append(h('p', { class: 'fine rm-ask' }, askCopy('변경 보고 요청 문구 복사', deltaReportAsk(o.view, o.project.readings), 'link-button'),
    ' — 지도의 부분 이름을 넣은 문구예요. 프로젝트를 보고 있는 AI 대화에 붙여 넣고, 나온 답을 기록으로 붙여 넣으세요. ',
    askCopy('이렇게 이해했다 확인 문구 복사', reflectAsk(o.view, o.project.readings), 'link-button'), ' — 지도가 읽은 것을 번호 줄로 보내 틀린 줄만 고쳐 받아요.'),
    // The design record and the scenario record (with this map's ID ledger): pasted back like any other record; the scenario
    // record is read as a path by the app alone (scenario-record.ts) when it is pasted.
    h('p', { class: 'fine rm-ask rm-records' }, askCopy('설계 기록 요청', DESIGN_RECORD_ASK, 'link-button', RECORD_ASK_EXPLAIN.design), ' · ',
      askCopy('시나리오 기록 요청(대장 포함)', scenarioAskWithLedger(o.view, o.project.readings), 'link-button', RECORD_ASK_EXPLAIN.scenario),
      ' — 설계 기록은 카드의 안쪽(산출물·단계·조건)을, 시나리오 기록은 동작 경로 하나를 써 받아요. 둘 다 다른 기록처럼 붙여 넣어요. 시나리오 기록은 붙이면 앱이 AI 없이 지금 지도의 ID 대장과 맞춰 길로 읽어, 제목 아래 ‘시나리오’ 줄에서 지도 위에 보여요.'));
  const limited = status.release === 'existing-map';
  if (inp?.problem === 'REQUEST_CONTEXT_TOO_LARGE' && !limited) sec.append(h('p', { class: 'fine' }, sendLine(inp)), h('button', { type: 'button', class: 'link-button', onclick: () => { returnView.close(); planView.openResults(); } }, '요청문을 골라 대조'));
  if (inp?.problem === 'REQUEST_CONTEXT_TOO_LARGE' && can && !st.pending && !waiting) sec.append(h('button', { type: 'button', class: 'link-button rm-map-only', onclick: () => void mapRun.runMapOnly() }, '요청 대조 없이 지도만 정리'), h('p', { class: 'fine' }, '원문을 보존하며 나중에 요청문을 골라 대조할 수 있어요.'));
  if (last?.version === 'map-reading.1' && frozenRequests(o.project, (planView.bundleOf()?.snapshots ?? []).flatMap(s => s.scope ? [s.scope] : [])).length) sec.append(h('p', { class: 'fine' }, limited ? '이 읽기는 요청 대조 없이 지도에 정리했어요.' : '이 읽기는 요청 대조 없이 지도에 정리했어요. 원문은 나중에 요청문을 골라 대조할 수 있어요.'));
  if (last) {
    const name = (id: string) => partOf(o, id)?.name ?? null;
    if (last.summary) sec.append(h('p', { class: 'rm-summary' }, last.summary));
    const made = last.parts.filter(x => x.created && name(x.areaId)).map(x => x.areaId), said = last.parts.filter(x => !x.created && name(x.areaId)).map(x => x.areaId);
    const chip = (id: string) => h('button', { type: 'button', class: 'rr-part', title: `‘${name(id)}’ 선택`, onclick: () => go(o.key, id) }, h('i', { 'aria-hidden': 'true' }), name(id)!);
    if (made.length) sec.append(h('div', { class: 'rr-chips' }, h('span', { class: 'rr-cand-label' }, '새 부분'), ...made.slice(0, 12).map(chip)));
    if (said.length) sec.append(h('div', { class: 'rr-chips' }, h('span', { class: 'rr-cand-label' }, '이해가 갱신된 부분'), ...said.slice(0, 12).map(chip)));
    const cands = last.candidates.map((c, i) => [c, i] as const).filter(([c]) => c.areaIds.every(id => name(id)));
    // A candidate reads with what it leaves undecided and, for a statement whose part or truth is open, that statement itself
    // (kind, words, version) beside the open label, never as a settled claim; each of its passages opens exactly, and the way
    // back comes to this same passage button (kept by its identity, with the pane's scroll and request folds).
    const cite = (q: ReadingQuote, which: 'at' | 'statement', i: number) => h('button', { type: 'button', class: 'rr-ref rr-cite', 'data-request-focus': JSON.stringify(['candidate', last.id, i, which]),
      title: which === 'statement' ? '미정 진술의 원문에서 보기' : '원문에서 보기', onclick: () => { if (returnView.isOpen()) returnView.keepReading(); returnView.openQuote(q.record, q.quote, null, q.from); } },
      `“${q.quote.slice(0, 40)}${q.quote.length > 40 ? '…' : ''}”`);
    if (cands.length) sec.append(h('div', { class: 'rm-cands' }, h('h4', {}, '확인할 것', h('small', {}, String(cands.length))),
      h('ul', {}, ...cands.map(([c, i]) => { const v = candidateReading(c);
        return h('li', {}, h('span', {}, v.label ? `${v.label} · ` : '', c.text),
          v.statement ? h('p', { class: 'fine' }, `${v.label ?? '미정'} 진술 · ${v.statement.kind} · ${v.statement.text}${v.statement.about ? ` · ${displayAbout(v.statement.about)}` : ''}`) : null,
          h('span', { class: 'rr-chips' }, ...c.areaIds.map(chip), ...v.quotes.map(x => cite(x.quote, x.which, i)))); }))));
    if (last.gaps.length) sec.append(h('ul', { class: 'rm-gaps' }, ...last.gaps.map(g => h('li', {}, g))));
    const cut = last.records.filter(r => r.to < r.total || r.from > 0).length;
    sec.append(h('p', { class: 'rr-prov' }, h('span', { class: 'tag ai', title: last.model }, `AI 정리 · ${modelLabel(last.model)}`), h('span', {}, `기록 ${last.records.length}개${cut ? ` (${cut}개는 일부 구간만)` : ''} · 인용 원문에 근거 · 앱이 확인한 사실 아님`)));
  }
  const excluded = mapExclusionHistory(o.project, (record, quote, from) => {
    if (returnView.isOpen()) returnView.keepReading();
    returnView.openQuote(record, quote, null, from);
  });
  if (excluded) sec.append(excluded);
  const requested = currentRequestResults(o); if (requested) sec.append(requested);
  return sec;
}
function currentRequestResults(o: Opened, partId?: string): HTMLElement | null {
  const scopes = (planView.bundleOf()?.snapshots ?? []).flatMap(s => s.scope ? [s.scope] : []);
  return requestResults(o.project, scopes, {
    ...(partId ? { partId } : {}), compact: true, quote: showQuote,
    wide: (at, opener) => wide.open({ ...at, scopes, label: partId ? partOf(o, partId)?.name ?? '부분' : '돌아와 읽기' }, opener),
    correct: async (reading, index, target) => {
      try {
        const error = await commit(o, correctRequestMatch(o.project, reading, index, target));
        if (!error) { renderSpace('keep'); if (selected) refreshReading(); else returnView.render(); }
        return error;
      } catch { return '대응을 고치지 못했어요. 원문은 그대로예요.'; }
    },
    unlink: async (reading, index) => {
      try {
        const error = await commit(o, unlinkReplacement(o.project, reading, index));
        if (!error) { renderSpace('keep'); if (selected) refreshReading(); else returnView.render(); }
        return error;
      } catch { return '연결을 풀지 못했어요. 원문은 그대로예요.'; }
    }
  });
}
/** A passage as the full reading shows it under its line: its first stretch, whole when short. */
const QUOTE_SHOW = 120;
const quoteLine = (q: string) => { const t = q.replace(/\s+/g, ' ').trim(); return t.length > QUOTE_SHOW ? `${t.slice(0, QUOTE_SHOW - 1)}…` : t; };
/** A passage in a citation's preview: its first 160 characters. */
const POP_SHOW = 160;
const popLine = (q: string) => { const t = q.replace(/\s+/g, ' ').trim(); return t.length > POP_SHOW ? `${t.slice(0, POP_SHOW - 1)}…` : t; };
/** Said once, where a description or a line rests only on a report a later record took back (it stays; it is not current evidence). */
const REVISED_BASIS = ' · 근거였던 보고는 이후 정정됨';
/** The record a quote comes from, in a citation's preview: a provided file by its declared name, a pasted record by its first
 * line, a project source by its kind; with when it was taken in. */
function recordName(id: string): string {
  const o = opened; if (!o) return '기록';
  const pasted = o.project.pasted.find(r => r.id === id);
  if (pasted) return [pasted.evidence?.name || recordTitle(pasted.text, 40) || '붙여넣은 기록', ago(pasted.at)].filter(Boolean).join(' · ');
  const r = o.view.records.find(x => x.id === id);
  return r ? [RECORD_LABEL[r.kind], ago(r.at)].filter(Boolean).join(' · ') : '기록';
}
/** A citation's preview opens below its number, toward the pane's inside: from the number's right edge when it would cross the
 * pane's right, above the number when it would cross the pane's bottom. */
function placeCite(cite: HTMLElement) {
  const pane = cite.closest('.lens-body, .panel-body') ?? document.body, box = pane.getBoundingClientRect(), at = cite.getBoundingClientRect();
  cite.classList.toggle('pop-r', at.left + 300 > box.right - 8);
  cite.classList.toggle('pop-up', at.bottom + 140 > box.bottom && at.top - 140 > box.top);
}
/** Claims of a part as short lines under what they are about (claim-topic.ts: the reading's own topic, else one read from the
 * kind and the words), in the order a person asks about a part. A report correcting an earlier one reads first in its topic;
 * otherwise claims keep their reading's own order (newest reading first; within a reading, as it said them), so a sequence a
 * reading wrote (parse, compile, run) is never read backwards. Each line: its words, then when, the author's own evidence tag,
 * the place it names and its numbered citation (the passage in a preview on hover or focus; a click opens it in the record).
 * The full reading also shows the passage's first stretch under the line. */
function claimList(part: string, claims: CurrentClaim[], history: PartUnderstanding['history'], surface: 'lens' | 'sheet'): HTMLElement {
  const fresh = new Map<string, number>(); for (const c of claims) if (!fresh.has(c.reading)) fresh.set(c.reading, fresh.size);
  const sorted = [...claims].sort((a, b) => Number(!!b.replaces) - Number(!!a.replaces) || fresh.get(a.reading)! - fresh.get(b.reading)! || a.index - b.index);
  const box = h('div', { class: 'claim-groups' }); let n = 0;
  for (const { topic, list } of claimsByTopic(sorted)) {
    box.append(h('section', { class: `cg t-${topic}` },
      h('h4', { title: TOPIC_HINT[topic] }, TOPIC_LABEL[topic], h('small', {}, String(list.length))),
      h('ul', { class: 'claims' }, ...list.map(c => claimItem(part, c, topic, history, ++n, surface)))));
  }
  return box;
}
function claimItem(part: string, c: CurrentClaim, topic: ClaimTopic, history: PartUnderstanding['history'], n: number, surface: 'lens' | 'sheet'): HTMLElement {
  // A correction names the claim it replaces: its old words struck through, when that reading is still at hand.
  const was = c.replaces ? history.find(x => x.reading === c.replaces!.reading)?.claims[c.replaces.index]?.text ?? null : null;
  const before = topic === 'withdrawn' && c.before ? c.before : null;
  // The version line is read only for what the time and the place do not already say ("618df374, 10-31 16:03:59Z" beside both is noise).
  const when = claimWhen(c), ev = claimEvidence(c), shown = new Set([when, c.where].filter(Boolean));
  const about = c.about && !c.about.split(/s*[,·]s*/).every(piece => shown.has(piece)) ? c.about : null;
  const cite: HTMLElement = h('span', { class: 'cite', onmouseenter: () => placeCite(cite), onfocusin: () => placeCite(cite) },
    h('button', { type: 'button', class: 'cl-cite', 'data-claim-focus': JSON.stringify([part, c.reading, c.index, c.record, c.from ?? null, c.to ?? null]), 'aria-label': `근거 ${n} · 원문에서 보기`, title: `원문에서 보기 · “${c.quote}”`, onclick: () => showQuote(c.record, c.quote, c.from) }, String(n)),
    h('span', { class: 'cite-pop', role: 'tooltip' }, h('q', {}, popLine(c.quote)), h('span', { class: 'cite-src' }, recordName(c.record))));
  return h('li', { class: `claim k-${c.kind}${c.replaces ? ' replaces' : ''}` },
    h('span', { class: 'cl-line' },
      c.replaces ? h('span', { class: 'cl-tag', title: '기록이 앞의 말을 대체한다고 적은 정정' }, '정정') : null,
      before ? h('s', { class: 'cl-before', title: `철회 전: ${before}` }, before) : null, before ? h('span', { class: 'cl-arrow', 'aria-hidden': 'true' }, ' → ') : null,
      h('span', { class: 'cl-text' }, c.text)),
    was ? h('s', { class: 'cl-was', title: `정정 전: ${was}` }, was) : null,
    h('span', { class: 'cl-meta' },
      when ? h('span', { class: 'cl-when' }, when) : null,
      ev ? h('span', { class: `ev ev-${ev}`, title: EVIDENCE_HINT[ev] }, EVIDENCE_LABEL[ev]) : null,
      c.where ? h('span', { class: 'cl-where', title: c.where }, c.where) : null,
      about ? h('small', { class: 'cl-about', title: about }, displayAbout(about)) : null,
      cite),
    surface === 'sheet' ? h('q', { class: 'cl-quote', title: c.quote }, quoteLine(c.quote)) : null);
}
/** What the person unfolded in the lens, per part (memory, this tab): long relation notes.
 * Reading a quote or following a relation and coming back keeps them as they were, like the scroll and the focused citation. */
const lensOpen = new Set<string>();
/** Under the description as read: the passages it rests on (its own basis only; none for the person's correction), folded to a
 * count. Each opens its passage exactly; the way back comes to the same part, the same button and the fold as it was left. */
function roleBasisBlock(o: Opened, part: string, u: PartUnderstanding, surface: 'lens' | 'sheet'): HTMLElement | null {
  const ev = roleEvidence(part, u); if (!ev) return null;
  const key = `${o.key}|${part}|role-basis|${surface}`;
  const fold = h('details', { class: 'role-basis', open: lensOpen.has(key) }, h('summary', {}, `이 설명의 원문 ${ev.count}`),
    h('ul', {}, ...ev.items.map(x => h('li', {}, h('button', { type: 'button', class: 'cl-cite', 'data-claim-focus': x.key, title: `원문에서 보기 · “${x.quote.quote}”`,
      onclick: () => showQuote(x.quote.record, x.quote.quote, x.quote.from) }, x.label)))));
  fold.addEventListener('toggle', () => { if (fold.open) lensOpen.add(key); else lensOpen.delete(key); });
  return fold;
}
/** Current statements stay in one continuous reading, including qualifications late in the source. The pane scrolls normally;
 * position alone cannot make a statement optional. Evidence history still reads in the sheet. */
function lensClaims(part: string, u: PartUnderstanding): HTMLElement {
  const list = claimList(part, u.claims, u.history, 'lens');
  list.id = 'lens-claims';
  return h('section', { class: 'lens-claims', 'aria-label': `기록이 말하는 것 ${u.claims.length}개` }, h('h3', {}, '기록에서 읽은 것', h('small', {}, String(u.claims.length))), list);
}
/** A relation note longer than its three lines reads whole on request, in place (the row itself goes to the other end). Safe to
 * run again over the same pane (rows shown later, e.g. after '더 보기'): a row that has its control keeps it. */
function clampNotes(root: HTMLElement, o: Opened, part: string) {
  root.querySelectorAll<HTMLElement>('.port-note[data-rel-note]').forEach(note => {
    const key = `${o.key}|${part}|note|${note.dataset.relNote}`, li = note.closest('li');
    if (!li || li.querySelector(':scope > .note-more') || note.classList.contains('whole') || note.scrollHeight <= note.clientHeight + 1) return;
    const sync = () => { const open = lensOpen.has(key); note.classList.toggle('whole', open); more.textContent = open ? '접기' : '전체'; more.setAttribute('aria-expanded', String(open)); };
    const more = h('button', { type: 'button', class: 'link-button note-more', 'aria-label': '관계 설명 전체', onclick: () => { if (lensOpen.has(key)) lensOpen.delete(key); else lensOpen.add(key); sync(); } });
    li.append(more); sync();
  });
}
/** A quote from the selection: the record in the pane, marked where it was read (from, when the reading kept it; else where the
 * words stand); closing the pane comes back to this part. */
function showQuote(record: string, quote: string, from?: number) {
  const o = opened; if (!o || o.kind !== 'saved') return;
  const scene = readingScene();
  // Nothing selected: the quote comes from the pane's own reading (the map's root), kept before reopening it re-renders it.
  if (!scene && returnView.isOpen()) returnView.keepReading();
  openReturn(); returnView.openQuote(record, quote, scene, from);
}
/** In the sheet: the part as read from records (the description and the person's correction of it, the current claims), then the
 * evidence history apart, folded. Correcting the description never touches the name, the note or the claims. */
/** The description being corrected: this entry's part (an imported copy shares part ids, so the entry is part of it). Each opening
 * of the form is its own session (its own object): a save ends only the session it was submitted from. */
let fixingRole: { key: string; part: string } | null = null;
function understoodSection(o: Opened, part: PartView): HTMLElement | null {
  const u = part.reading; if (!u) return null;
  const sec = h('section', { class: 'sec sec-understood' }, h('h3', {}, '기록에서 읽은 것'));
  if (fixingRole?.key === o.key && fixingRole.part === part.id && o.kind === 'saved') {
    const area = h('textarea', { id: 'fix-role', rows: '3', maxlength: '300' }) as HTMLTextAreaElement; area.value = u.role ?? '';
    const msg = h('p', { class: 'form-msg', role: 'status' });
    sec.append(h('form', { class: 'edit-form', onsubmit: async (e: Event) => {
      e.preventDefault();
      let next: Project;
      try { next = correctReadingRole(o.project, part.id, area.value); } catch { msg.textContent = '설명은 1~300자로 적어 주세요.'; return; }
      const session = fixingRole;
      const failed = await commit(o, next); if (failed) { msg.textContent = failed; return; }
      // This session is done; one begun meanwhile (on another part or entry, or this part's form closed and opened again) is its
      // own and stays open with what is written in it.
      if (fixingRole === session) fixingRole = null;
      if (opened !== o) return;
      renderSpace('keep'); if (selected === part.id) select(part.id);
    } }, h('label', { for: 'fix-role' }, '설명 바로잡기 ', h('small', {}, '이름·내 설명·기록의 주장은 그대로예요')), area, msg,
      h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary small' }, '저장'), h('button', { type: 'button', class: 'link-button', onclick: () => { fixingRole = null; renderPanel(false); } }, '취소'))));
  } else if (u.role) {
    sec.append(h('p', { class: 'und-role' }, u.role), h('p', { class: 'src', title: u.roleAbout ?? '' }, u.corrected ? `직접 바로잡은 설명 · ${fullTime(u.corrected.at)}` : `기록에서 읽은 설명${u.roleAbout ? ` · ${displayAbout(u.roleAbout)} 기준` : ''}${u.roleBasisRevised ? REVISED_BASIS : ''}`,
      o.kind === 'saved' ? h('button', { type: 'button', class: 'link-button quiet', onclick: () => { fixingRole = { key: o.key, part: part.id }; renderPanel(false); requestAnimationFrame(() => document.getElementById('fix-role')?.focus()); } }, ' 설명 바로잡기') : null));
    const basis = roleBasisBlock(o, part.id, u, 'sheet'); if (basis) sec.append(basis);
    // Descriptions read later that did not replace this one (no record said it supersedes it) read apart, with their version.
    for (const x of u.others.slice(0, 2)) sec.append(h('p', { class: 'und-later' }, h('span', { title: x.about ?? '' }, `다른 기록의 설명${x.about ? ` · ${displayAbout(x.about)}` : ''} · 현재 설명을 대체한다는 근거 없음`), x.text));
  }
  // The full reading reads every current claim, as the lens does (claimList takes them all).
  if (u.claims.length) sec.append(claimList(part.id, u.claims, u.history, 'sheet'));
  const requested = currentRequestResults(o, part.id); if (requested) sec.append(requested);
  // The history fold and its quotes keep their identity (this entry and part; each quote by its stored reading, index and place):
  // back from an original the fold is open again and the same quote has focus, also between two readings with the same time.
  const histKey = `${o.key}|${part.id}|history`;
  const hist = h('details', { class: 'und-history', open: lensOpen.has(histKey) }, h('summary', {}, `읽은 이력 · 정리 ${u.history.length}회`),
    h('ol', {}, ...[...u.history].reverse().map(x => h('li', {}, h('span', { class: 'uh-at' }, fullTime(x.at)),
      x.role ? h('span', { class: 'uh-role' }, x.role) : null,
      ...x.claims.map((c, j) => h('span', { class: 'uh-claim' }, h('span', { class: 'cl-kind' }, CLAIM_LABEL[c.kind]), c.text, ' ',
        h('button', { type: 'button', class: 'cl-cite', 'data-claim-focus': JSON.stringify([part.id, 'history', x.reading, j, c.record, c.from ?? null]), title: `원문에서 보기 · “${c.quote}”`, onclick: () => showQuote(c.record, c.quote, c.from) }, '근거')))))));
  hist.addEventListener('toggle', () => { if (hist.open) lensOpen.add(histKey); else lensOpen.delete(histKey); });
  sec.append(hist);
  return sec;
}

/** A relation a reading added on a report a later record took back (revisedRelations): still drawn, read apart. */
function revisedLine(o: Opened, relationId: string): boolean { return revisedRelations(o.project).has(relationId); }
/** A drawn line all of whose relations rest on withdrawn reports: its own dash and a short title, selected or not. */
function edgeRevised(e: Edge): boolean { return !!opened && !e.agg && e.ids.length > 0 && e.ids.every(id => revisedLine(opened!, id)); }
const REVISED_EDGE = ' · 보고 정정됨', REVISED_SHORT = '보고 정정됨';

function sessionCode(): string { try { return sessionStorage.getItem('agentflow.studio.access') ?? accessCodeMemory; } catch { return accessCodeMemory; } }

async function send(intent: AskIntent, question: string | null) {
  const o = opened, partId = selected; if (!o || !partId || ask?.controller) return;
  const { ask: payload, refs, coverage } = buildAsk(o.project, o.view, partId, intent, question);
  const controller = new AbortController();
  ask = { partId, intent, question, controller, error: null, coverage };
  if (intent === 'question') composerOpen = true; // asked from the box: keep it open for a follow-up
  renderPanel(false); scrollThread();
  try {
    const res = await askStudio(payload, controller.signal, sessionCode());
    addAnswer(o, partId, { at: new Date().toISOString(), intent, question, model: res.model, reply: res.reply, refs: Object.fromEntries(refs), coverage });
    ask = null;
    // A retried question can succeed after the person has typed another one: only the question that went out leaves the box.
    if (intent === 'question' && question !== null) setDraft(o, partId, draftAfterAnswer(getDraft(o, partId), question));
  } catch (e) {
    const code = e instanceof AskError ? e.code : 'REQUEST_FAILED';
    ask = code === 'CANCELLED' ? null : { partId, intent, question, controller: null, error: ERROR_TEXT[code] ?? `응답을 받지 못했어요 (${code}).`, coverage };
  }
  if (opened === o && selected === partId) { if (sheetOpen) { renderPanel(false); scrollThread(); } else refreshReading(); }
}
function scrollThread() {
  const body = document.querySelector<HTMLElement>('.panel-body'), last = body?.querySelector('.thread')?.lastElementChild as HTMLElement | null;
  if (!body || !last) return;
  const top = body.scrollTop + last.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
  body.scrollTo({ top: Math.max(0, top) });
}

/* ---------- AI status pill ---------- */
function renderStatus() {
  const pill = $('ai-pill'), text = $('ai-text');
  // A server that asks for an access code is not ready to ask until the person has given one in this tab.
  const needsCode = status.ai === 'deepseek' && status.access === 'code' && !sessionCode();
  // AF102: a server whose map readings are made only by its own map executor (a local preview) says so; the rest stays as ai says.
  const mapOnly = status.ai !== 'deepseek' && status.map?.via === 'jobs';
  const later = status.jobs?.executor?.scope === 'map6-later' || status.jobs?.executor?.scope === 'map7-later';
  const mapNote = status.release === 'existing-map' ? ` ${RELEASE_TEXT.limit}` : status.map?.via === 'jobs' ? ` 지도 정리는 이 PC의 지도 실행기(${status.map.model}, 미리보기)가 ${later ? '첫 지도와 이후 기록·요청 대조까지' : '첫 지도만'} 해요.` : '';
  pill.dataset.state = needsCode ? 'code' : mapOnly ? 'map' : status.ai;
  text.textContent = status.ai === 'deepseek' ? (needsCode ? 'AI · 접속 코드 필요' : 'AI 정리 가능') : mapOnly ? '지도 정리만 가능' : status.ai === 'off' ? 'AI 키 없음' : 'AI 서버 미연결';
  pill.title = (status.ai === 'deepseek' ? `서버가 ${status.model ?? 'DeepSeek'}에 정리를 요청해요. 키는 서버에만 있어요.${needsCode ? ' 이 서버는 접속 코드를 받아요. 정리를 요청할 때 입력해 주세요.' : ''}` : mapOnly ? '질문·계획·결과 정리는 서버에 AI 키가 없어 꺼져 있어요.' : status.ai === 'off' ? '서버는 연결됐지만 AI 키가 설정되지 않았어요.' : '이 페이지에는 AI 서버가 연결되어 있지 않아요.') + mapNote;
}

/* ---------- canvas interaction ----------
 * Empty space: drag pans. A node or frame head: click selects, drag moves (frames carry their children; a child moves
 * inside its parent frame, which grows around it), double-click goes inside. Wheel zooms at the cursor (also Ctrl/⌘). */
let toastTimer = 0;
/** Double-click = two clicks on the same part, same view, same spot. */
let lastClick = { id: '', at: 0, x: 0, y: 0, scope: null as string | null };
/** A toast speaks for the project it was made in: its action runs only there, and leaving that project takes it away. */
let toastKey: string | null = null;
/** A request-text copy button: the words go to the clipboard (a toast says so), or, when copying is blocked, into a
 * read-only box under the button to copy by hand. The title says what the person gets. */
function askCopy(label: string, text: string, cls: string, title: string = RECORD_ASK_EXPLAIN.status): HTMLElement {
  const b = h('button', { type: 'button', class: cls, title, onclick: async () => {
    let ok = true; try { await navigator.clipboard.writeText(text); } catch { ok = false; }
    if (ok) { toast('요청 문구를 복사했어요. 프로젝트를 보고 있는 AI 대화에 붙여 넣고, 나온 보고서를 기록 붙여넣기에 넣으세요.'); return; }
    const old = b.parentElement?.querySelector('.ask-manual'); old?.remove();
    const box = h('textarea', { class: 'ask-manual', readonly: true, rows: '6', spellcheck: 'false', 'aria-label': label }, text) as HTMLTextAreaElement;
    b.parentElement?.append(box); box.focus(); box.select();
  } }, label);
  return b;
}
function toast(text: string, action?: { label: string; run: () => void }) {
  const t = $('toast'), key = opened?.key ?? null; clearTimeout(toastTimer); t.replaceChildren(); toastKey = key;
  put(t, h('span', {}, text), action ? h('button', { type: 'button', class: 'link-button', onclick: () => { t.hidden = true; if (opened?.key === key) action.run(); } }, action.label) : null,
    h('button', { type: 'button', class: 'toast-close', 'aria-label': '닫기', onclick: () => dropToast() }, '×'));
  t.hidden = false; toastTimer = window.setTimeout(() => { t.hidden = true; }, 8000);
}
function dropToast() { clearTimeout(toastTimer); $('toast').hidden = true; toastKey = null; }
/** Explicit only: resets the places in this view (the scope and its open frames); one undo. */
function arrange() {
  const o = opened; if (!o) return;
  const pos = positionsOf(o), containers = [scope ?? ROOT, ...[...lay.boxes.values()].filter(b => b.kind === 'frame').map(b => b.id)];
  const before = structuredClone(pos), had = containers.some(c => pos[c] && Object.keys(pos[c]!).length);
  if (!had) { toast('이미 자동 배치 상태예요.'); return; }
  for (const c of containers) delete pos[c];
  savePositions(o); renderSpace('keep'); fitView(false, true); if (selected) select(selected);
  toast('이 화면을 자동 정렬했어요.', { label: '되돌리기', run: () => {
    for (const k of Object.keys(pos)) delete pos[k]; Object.assign(pos, before);
    savePositions(o); if (opened === o) { renderSpace('keep'); if (selected) select(selected); }
  } });
}

/* ---------- finding a part by name ----------
 * Every part stays reachable however the map is folded: names (and the descriptions that keep original names) are searched in
 * the project's own data, and a result opens the same part where it sits, inside its group when that group is folded here.
 * The previous scene keeps its way back. A navigation aid only: nothing is ranked, grouped or added. */
let findOpen = false;
function bindFind() {
  const tools = document.querySelector('.controls')!, button = h('button', { type: 'button', id: 'find-toggle', class: 'find-toggle', 'aria-expanded': 'false', 'aria-controls': 'find', title: '부분 찾기 (/)' }, '찾기');
  tools.insertBefore(button, $('zoom-out').previousElementSibling);
  const input = h('input', { id: 'find-input', type: 'search', placeholder: '부분 이름이나 설명의 낱말', autocomplete: 'off', 'aria-label': '부분 찾기' }) as HTMLInputElement;
  const count = h('p', { class: 'find-count', role: 'status' }), list = h('ol', { class: 'find-list' });
  const box = h('section', { id: 'find', class: 'find', 'aria-label': '부분 찾기', hidden: true }, input, count, list);
  $('space').append(box);
  const LIMIT = 60;
  const show = (on: boolean) => { findOpen = on; box.hidden = !on; button.setAttribute('aria-expanded', String(on)); button.classList.toggle('on', on); if (on) { input.select(); input.focus(); run(); } };
  const open = (id: string) => {
    const o = opened, p = o ? partOf(o, id) : null; if (!o || !p) return;
    // Here when it is drawn in this view; else inside its own group (a list reads there at full size); a top part on the map.
    const sc = lay.boxes.has(id) && lay.boxes.get(id)!.kind !== 'ghost' ? scope : p.parentId;
    show(false); go(o.key, id, sc);
  };
  function run() {
    const o = opened; if (!o) return;
    const q = input.value.trim().toLowerCase();
    if (!q) { count.textContent = `부분 ${o.view.parts.length}개 · 이름을 적어 주세요`; list.replaceChildren(); return; }
    const byName = o.view.parts.filter(p => p.name.toLowerCase().includes(q)), byNote = o.view.parts.filter(p => !byName.includes(p) && p.note.toLowerCase().includes(q));
    const all = [...byName, ...byNote];
    count.textContent = all.length ? (all.length > LIMIT ? `${all.length}개 중 ${LIMIT}개 · 더 좁혀 적어 주세요` : `${all.length}개`) : '찾은 부분이 없어요';
    list.replaceChildren(...all.slice(0, LIMIT).map(p => h('li', {}, h('button', { type: 'button', class: 'find-item', onclick: () => open(p.id) },
      h('strong', {}, p.name), h('span', {}, [[...partPath(o.view, p.id).slice(0, -1).map(x => x.name)].join(' › ') || o.project.name, aliasOf(o.view, p.id)].filter(Boolean).join(' · '), byName.includes(p) ? '' : ' · 설명에서')))));
  }
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); show(false); button.focus(); }
    if (e.key === 'Enter') { const first = list.querySelector<HTMLButtonElement>('.find-item'); if (first) { e.preventDefault(); first.click(); } }
    if (e.key === 'ArrowDown') { e.preventDefault(); list.querySelector<HTMLElement>('.find-item')?.focus(); }
  });
  list.addEventListener('keydown', e => {
    const items = [...list.querySelectorAll<HTMLElement>('.find-item')], at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' && at >= 0) { e.preventDefault(); items[Math.min(items.length - 1, at + 1)]?.focus(); }
    if (e.key === 'ArrowUp' && at >= 0) { e.preventDefault(); (at === 0 ? input : items[at - 1]!).focus(); }
    if (e.key === 'Escape') { e.stopPropagation(); show(false); button.focus(); }
  });
  button.addEventListener('click', () => show(!findOpen));
  document.addEventListener('keydown', e => { if (e.key === '/' && opened && !$('space').hidden && !wide.isOpen() && !$('space').classList.contains('sheet-read') && !(e.target as HTMLElement).closest('textarea,input,select')) { e.preventDefault(); show(true); } });
  $('viewport').addEventListener('pointerdown', () => { if (findOpen) show(false); });
  window.addEventListener('hashchange', () => { if (findOpen && !location.hash.startsWith('#/p/')) show(false); });
  // Zoom from the keyboard (not in a field): + / = in, - out, 0 the whole map, 1 100%; arrows walk the parts (focus moves to
  // the nearest part in that direction).
  document.addEventListener('keydown', e => {
    if (!opened || $('space').hidden || wide.isOpen() || openState?.mode === 'detail' || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('textarea,input,select,[contenteditable]')) return;
    const vp = $('viewport'), r = vp.getBoundingClientRect(), cx = r.width / 2, cy = vp.offsetTop + r.height / 2;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); mapMoved = true; zoomAt(camera.k * 1.2, cx, cy, true); }
    else if (e.key === '-') { e.preventDefault(); mapMoved = true; zoomAt(camera.k / 1.2, cx, cy, true); }
    else if (e.key === '0') { e.preventDefault(); mapMoved = true; fitView(true, true); }
    else if (e.key === '1') { e.preventDefault(); mapMoved = true; zoomAt(1, cx, cy, true); }
    else if (e.key.startsWith('Arrow')) {
      const from = (e.target as HTMLElement).closest<HTMLElement>('#world [data-box]'); if (!from) return;
      const next = nearestBox(from.dataset.box!, e.key.slice(5) as 'Up' | 'Down' | 'Left' | 'Right'); if (!next) return;
      e.preventDefault();
      const el = document.querySelector<HTMLElement>(`#world [data-box="${CSS.escape(next)}"]`), head = el?.classList.contains('frame') ? el.querySelector<HTMLElement>('.frame-head') : el;
      head?.focus({ preventScroll: true }); if (el) revealRect(lay.boxes.get(next)!);
    }
  });
}
/** The nearest drawn box in a direction from a box (centre to centre, the sideways offset weighted double): the arrow keys walk
 * the map the way the eye does. A part's own children and a child's parent are skipped (Enter and Escape go in and out). */
function nearestBox(id: string, dir: 'Up' | 'Down' | 'Left' | 'Right'): string | null {
  const me = lay.boxes.get(id); if (!me) return null;
  const within = (box: string, holder: string) => { for (let c = lay.boxes.get(box)?.container, g = 0; c && g < 64; c = lay.boxes.get(c)?.container, g++) if (c === holder) return true; return false; };
  const c = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + (b.kind === 'frame' ? b.head / 2 : b.h / 2) }), m = c(me);
  let best: string | null = null, score = Infinity;
  for (const b of lay.boxes.values()) {
    if (b.id === id || b.kind === 'ghost' || within(b.id, id) || within(id, b.id)) continue;
    const q = c(b), dx = q.x - m.x, dy = q.y - m.y;
    const ahead = dir === 'Right' ? dx : dir === 'Left' ? -dx : dir === 'Down' ? dy : -dy, side = dir === 'Right' || dir === 'Left' ? Math.abs(dy) : Math.abs(dx);
    if (ahead < 8) continue;
    const s = ahead + side * 2; if (s < score) { score = s; best = b.id; }
  }
  return best;
}
function bindCanvas() {
  const vp = $('viewport');
  type Drag = { pointer: number; x: number; y: number; moved: boolean; mode: 'pan'; cx: number; cy: number; edge?: string }
    | { pointer: number; x: number; y: number; moved: boolean; mode: 'part'; id: string; container: string; start: Point };
  let drag: Drag | null = null;
  vp.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // The recent popover gives way to the map: working on the map closes it (opening a record from it keeps it for the way back).
    if (recentOpen || recentPeek) { recentOpen = recentPeek = false; if (opened) renderRecent(); }
    if (target.closest('button,a,input,textarea')) return;
    const handle = target.closest<HTMLElement>('[data-drag]'), o = opened;
    if (handle && o) {
      const id = handle.dataset.drag!, b = lay.boxes.get(id); if (!b) return;
      drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, mode: 'part', id, container: b.container, start: { ...b.rel } };
    } else drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, mode: 'pan', cx: camera.x, cy: camera.y, ...(target.classList.contains('edge-hit') ? { edge: target.closest<SVGGElement>('.edge')?.dataset.key ?? '' } : {}) };
    vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener('pointermove', e => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    if (!drag.moved) {
      drag.moved = true; vp.classList.add(drag.mode === 'pan' ? 'grabbing' : 'moving');
      if (drag.mode === 'part') { if (openState?.mode === 'short') closeOpen(false); document.querySelector(`[data-box="${CSS.escape(drag.id)}"]`)?.classList.add('dragging'); holdPlaces(opened!, drag.container); }
    }
    if (drag.mode === 'pan') { mapMoved = true; camera = { ...camera, x: drag.cx + dx, y: drag.cy + dy }; applyCamera(); return; }
    const o = opened!; const pos = positionsOf(o);
    (pos[drag.container] ??= {})[drag.id] = { x: Math.round(drag.start.x + dx / camera.k), y: Math.round(drag.start.y + dy / camera.k) };
    dragQuick = true; relayout(o); positionWorld();
  });
  const end = (e: PointerEvent) => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const d = drag; drag = null; vp.classList.remove('grabbing', 'moving');
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    const o = opened; if (!o || e.type === 'pointercancel') { dragQuick = false; return; }
    if (d.mode === 'part' && d.moved) {
      // The drop: lines take their full routes, each from the plain shape it followed the hand with.
      morphFrom = new Map([...$('world').querySelectorAll<SVGGElement>('.edge')].map(g => [g.dataset.key!, g.querySelector('.edge-line')?.getAttribute('d') ?? '']));
      dragQuick = false; relayout(o); positionWorld(); morphFrom = null;
      savePositions(o); return;
    }
    if (d.mode === 'part') {
      const now = Date.now(), part = partOf(o, d.id);
      const twice = lastClick.id === d.id && lastClick.scope === scope && now - lastClick.at < 380 && Math.abs(lastClick.x - e.clientX) + Math.abs(lastClick.y - e.clientY) < 8;
      lastClick = { id: d.id, at: now, x: e.clientX, y: e.clientY, scope };
      // A double-click opens what a card a reading spoke of holds (동작 열기); on any other card with an inside it goes in.
      if (twice && openable(o, d.id)) { lastClick.id = ''; openAction(d.id); return; }
      if (twice && part?.childIds.length) { lastClick.id = ''; go(o.key, null, d.id); return; }
      go(o.key, d.id); return;
    }
    // A click on a line (no move) selects the part the line leaves; on empty canvas it clears the selection.
    if (!d.moved && d.mode === 'pan' && d.edge) {
      const edge = edgeOf(d.edge), from = edge && (edge.from.startsWith('ghost:') ? edge.from.slice(6) : edge.from);
      if (edge && from && from !== selected) go(o.key, from, edge.from.startsWith('ghost:') ? partOf(o, from)?.parentId ?? null : scope);
      return;
    }
    if (!d.moved && selected) go(o.key);
  };
  vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
  vp.addEventListener('wheel', e => {
    e.preventDefault();
    const r = vp.getBoundingClientRect(), unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const delta = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    // Pinch (ctrlKey) sends small deltas; a mouse notch is about 100.
    mapMoved = true; zoomAt(camera.k * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top + vp.offsetTop);
  }, { passive: false });
  const center = () => { const r = vp.getBoundingClientRect(); return [r.width / 2, vp.offsetTop + r.height / 2] as const; };
  $('zoom-in').addEventListener('click', () => { mapMoved = true; const [x, y] = center(); zoomAt(camera.k * 1.2, x, y, true); });
  $('zoom-out').addEventListener('click', () => { mapMoved = true; const [x, y] = center(); zoomAt(camera.k / 1.2, x, y, true); });
  $('zoom-level').addEventListener('click', () => { mapMoved = true; const [x, y] = center(); zoomAt(1, x, y, true); });
  $('zoom-fit').addEventListener('click', () => { mapMoved = true; fitView(true, true); });
  $('arrange').addEventListener('click', arrange);
  const help = $('help'), helpButton = $('help-toggle');
  helpButton.addEventListener('click', () => { help.hidden = !help.hidden; helpButton.setAttribute('aria-expanded', String(!help.hidden)); });
  $('recent-toggle').addEventListener('click', () => { if (selected || planView.isOpen()) recentPeek = !recentPeek; else recentOpen = !recentOpen; if (opened) renderRecent(); });
  $('scene-back').addEventListener('click', sceneBack);
  bindEdgeHints();
  document.addEventListener('pointerdown', e => {
    const menu = document.querySelector<HTMLDetailsElement>('details.more[open]');
    if (menu && !menu.contains(e.target as Node)) menu.open = false;
  });
  document.addEventListener('keydown', e => {
    if ((e.target as HTMLElement).closest('textarea,select,input:not([type=checkbox]):not([type=radio])')) return; // Esc still works from a checkbox
    if (handover.isOpen()) return; // the handover document is modal: its own Esc closes it and nothing under it
    if (e.key === 'Escape' && autoSync.isOpen()) { autoSync.close(); return; } // the sync panel is a popover over everything below
    // The wide reading is over everything (its own keys handle Esc inside it; this is focus left on the page).
    if (wide.isOpen()) { if (e.key === 'Escape') wide.escape(); return; }
    // The detail view's other two moves: 이전 읽기 위치 (Alt+←) and 상위 구성 (Alt+↑); 닫기 is Escape, below.
    if (e.altKey && openState?.mode === 'detail' && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) { e.preventDefault(); if (e.key === 'ArrowLeft') goBackPlace(); else goUp(); return; }
    // Innermost first: an open ⋯ menu closes before anything else, and focus goes back to its button.
    const menu = document.querySelector<HTMLDetailsElement>('details.more[open]');
    if (e.key === 'Escape' && menu) { menu.open = false; menu.querySelector<HTMLElement>('summary')?.focus(); return; }
    if (e.key === 'Escape' && !help.hidden) { help.hidden = true; helpButton.setAttribute('aria-expanded', 'false'); return; }
    if (e.key === 'Escape' && opened && openState) { e.preventDefault(); closeOpen(true); return; } // 닫기: the opening only
    if (e.key === 'Escape' && opened && recentShown() && !$('recent').classList.contains('collapsed')) { if (selected || planView.isOpen()) recentPeek = false; else recentOpen = false; renderRecent(); return; }
    if (e.key === 'Escape' && planView.isOpen()) { const part = selected; planView.escape(); if (part && !selected) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag="${CSS.escape(part)}"]`)?.focus()); return; }
    if (e.key === 'Escape' && partForm && opened?.view.parts.length) { partForm = null; renderPartForm(); return; }
    if (e.key === 'Escape' && opened && stateHold) { stateHold = null; $('space').classList.remove('state-peek'); document.querySelectorAll('#world .state-on, .map-states .ms.on').forEach(el => { el.classList.remove('state-on', 'on'); el.setAttribute('aria-pressed', 'false'); }); return; }
    if (e.key === 'Escape' && opened && scOn) { e.preventDefault(); leaveScenario(); return; }
    if (e.key === 'Escape' && opened && selected && sheetOpen) { closeSheet(); return; }
    if (e.key === 'Escape' && opened && selected) { const key = opened.key, part = selected; go(key); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag="${CSS.escape(part)}"]`)?.focus()); return; }
    if (e.key === 'Escape' && opened && scopeReading && !selected) { closeScopeReading(); return; }
    if (e.key === 'Escape' && opened && returnView.isOpen() && !selected) { returnView.escape(); return; }
    if (e.key === 'Escape' && opened && scope) { const o = opened, from = scope; go(o.key, null, partOf(o, from)?.parentId ?? null); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag="${CSS.escape(from)}"]`)?.focus()); }
  });
  let resize = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resize); resize = requestAnimationFrame(() => { syncMapArea(); if (openState?.mode === 'detail') drawDetailLines(); if (opened && !selected && !planView.isOpen() && $('lens').hidden && !mapMoved) fitView(false); }); });
}

/** Hover: a line shows what it means (ends, kind, recorded note) without selecting; a part lights its own lines. */
function bindEdgeHints() {
  const world = $('world'), tip = $('edge-tip'), space = $('space');
  const nameOf = (boxId: string) => { const o = opened; if (!o) return ''; return partOf(o, boxId.startsWith('ghost:') ? boxId.slice(6) : boxId)?.name ?? ''; };
  const place = (e: PointerEvent) => { const r = space.getBoundingClientRect(), y = e.clientY - r.top; tip.style.left = `${Math.max(8, Math.min(e.clientX - r.left + 14, r.width - 300))}px`; tip.style.top = `${y + 14 + tip.offsetHeight > r.height - 8 ? Math.max(8, y - tip.offsetHeight - 10) : y + 14}px`; };
  const boxInside = (box: string, holder: string) => { for (let c = lay.boxes.get(box)?.container, g = 0; c && g < 64; c = lay.boxes.get(c)?.container, g++) if (c === holder) return true; return false; };
  /** Pointing at (or focusing) a part: its lines light, the parts at their other ends with them, and the rest of the map
   * steps back (.peek), so a part's neighbourhood reads without a click. Nothing moves and nothing is selected. */
  const nearPart = (id: string) => {
    // A summary line also lights for a part inside one of its ends whose own relations it holds.
    const mine = new Set(lay.edges.filter(x => x.from === id || x.to === id).flatMap(x => x.ids)), ends = new Set<string>();
    world.querySelectorAll<SVGGElement>('.edge').forEach(x => {
      const near = x.dataset.from === id || x.dataset.to === id || (x.classList.contains('sum') && !!edgeOf(x.dataset.key)?.ids.some(r => mine.has(r)));
      // A store's path lines (markSelection's .path) stay near while another part is pointed at.
      x.classList.toggle('near', near || x.classList.contains('path'));
      if (near && getComputedStyle(x).display !== 'none') ends.add(x.dataset.from === id || boxInside(id, x.dataset.from!) ? x.dataset.to! : x.dataset.from!);
    });
    world.querySelectorAll('.near-end, .near-self').forEach(el => el.classList.remove('near-end', 'near-self'));
    for (const far of ends) world.querySelector(`[data-box="${CSS.escape(far)}"]`)?.classList.add('near-end');
    world.querySelector(`[data-box="${CSS.escape(id)}"]`)?.classList.add('near-self');
    space.classList.toggle('peek', ends.size > 0);
    // An end of the selection's lines: the pane's rows of those relations light too.
    lightRows(selected && id !== selected ? lay.edges.filter(x => (x.from === id && x.to === selected) || (x.to === id && x.from === selected)).flatMap(x => x.ids) : []);
  };
  const clearNear = () => { world.querySelectorAll('.edge.near:not(.path)').forEach(x => x.classList.remove('near')); world.querySelectorAll('.near-end, .near-self').forEach(el => el.classList.remove('near-end', 'near-self')); space.classList.remove('peek'); lightRows([]); };
  world.addEventListener('pointerover', e => {
    const t = e.target as Element, g = t.closest<SVGGElement>('.edge');
    if (g && t.classList.contains('edge-hit')) {
      const edge = edgeOf(g.dataset.key); if (!edge) return;
      // While the map or a part is dragged, no tooltip: it would chase the hand.
      if ($('viewport').classList.contains('grabbing') || $('viewport').classList.contains('moving')) return;
      g.classList.add('near');
      tip.replaceChildren(h('strong', {}, `${nameOf(edge.from)} ${edge.kind === 'related' ? '—' : '→'} ${nameOf(edge.to)}`), h('span', { class: 'tip-kind' }, `${REL_LABEL[edge.kind] ?? edge.kind}${restOf(edge) ? ` · 선택한 부분의 관계를 뺀 나머지 ${edge.ids.length}개` : edge.agg ? ` · 안쪽 관계 ${edge.ids.length}개의 요약 · 선택하면 실제 끝점` : edge.ids.length > 1 ? ` · 관계 ${edge.ids.length}개를 한 선으로 묶음` : ''}`),
        ...edge.notes.slice(0, 3).map(n => h('span', {}, n)), ...(edge.notes.length > 3 ? [h('span', { class: 'tip-kind' }, `설명 ${edge.notes.length - 3}개 더 · 선택하면 모두 읽힘`)] : []), ...(edge.notes.length && edge.notes.every(plannedNote) ? [h('span', { class: 'tip-kind' }, '계획된 연결 · 아직 돌지 않음')] : []), ...(edgeRevised(edge) ? [h('span', { class: 'tip-revised' }, REVISED_BASIS.replace(/^ · /, ''))] : []));
      tip.hidden = false; place(e as PointerEvent);
      if (g.classList.contains('on')) lightRows(edge.ids);
      return;
    }
    const part = t.closest<HTMLElement>('.node[data-box], .frame-head[data-part], .ghost[data-box]');
    if (part) nearPart(part.dataset.box ?? part.dataset.part!);
  });
  world.addEventListener('focusin', e => { const part = (e.target as Element).closest<HTMLElement>('.node[data-box], .frame-head[data-part], .ghost[data-box]'); if (part) nearPart(part.dataset.box ?? part.dataset.part!); });
  world.addEventListener('focusout', e => { if (!(e.relatedTarget as Element | null)?.closest?.('.node, .frame-head, .ghost')) clearNear(); });
  world.addEventListener('pointermove', e => { if (!tip.hidden) place(e); });
  world.addEventListener('pointerout', e => {
    const t = e.target as Element;
    if (t.classList.contains('edge-hit')) tip.hidden = true;
    const to = e.relatedTarget as Element | null;
    if (!to || !to.closest?.('.node, .frame-head, .ghost, .edge')) clearNear();
  });
}

/* ---------- import (backup file → new saved copy; the file's bytes are validated as project data) ---------- */
function bindNewProject() {
  const name = $<HTMLInputElement>('new-name'), msg = $('home-message'), form = $('new-form'), openBtn = $('new-open');
  const show = (on: boolean) => { form.hidden = !on; openBtn.setAttribute('aria-expanded', String(on)); if (on) name.focus(); else openBtn.focus(); };
  openBtn.addEventListener('click', () => show(form.hidden));
  $('empty-new').addEventListener('click', () => show(true));
  $('empty-examples').addEventListener('click', () => showExamples());
  $('new-cancel').addEventListener('click', () => { name.value = ''; show(false); });
  name.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); name.value = ''; show(false); } });
  $('new-form').addEventListener('submit', async e => {
    e.preventDefault();
    const value = name.value.trim(); if (!value) { name.focus(); return; }
    let project: Project;
    try { project = rename(createProject(), value); } catch { msg.textContent = '이름은 120자까지 쓸 수 있어요.'; msg.hidden = false; return; }
    if (!store.writable) { msg.textContent = '이 브라우저에서는 저장할 수 없어 새 프로젝트를 만들지 못했어요.'; msg.hidden = false; msg.dataset.keep = '1'; return; }
    try { const ref = await store.create(project, 'new'); name.value = ''; go(ref.entryId); }
    catch { msg.textContent = '새 프로젝트를 저장하지 못했어요.'; msg.hidden = false; msg.dataset.keep = '1'; }
  });
}
function bindImport() {
  const file = $<HTMLInputElement>('import-file'), msg = $('home-message');
  const say = (text: string) => { msg.textContent = text; msg.hidden = false; msg.dataset.keep = '1'; };
  $('import').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0]; file.value = ''; if (!f) return;
    if (f.size > FILE_LIMIT) { say('파일이 너무 커요.'); return; }
    let project: Project, places: Positions | null;
    try { ({ project, positions: places } = parseBackup(await f.text())); } catch { say('AgentFlow 프로젝트 백업 파일이 아니거나 읽을 수 없어요. 아무것도 바꾸지 않았어요.'); return; }
    // A pasted record holding something like a key never comes in by a backup either (the paste box refuses it the same way).
    if (secretPasted(project).length) { say(`백업의 붙여넣은 기록 ${secretPasted(project).length}개에 키나 토큰처럼 보이는 글이 있어 가져오지 않았어요. 저장된 프로젝트는 그대로예요.`); return; }
    if (!store.writable) { say('이 브라우저에서는 저장할 수 없어 가져오지 못했어요.'); return; }
    try {
      // The new copy has places of its own (the file's, or none: automatic layout) and an empty view, kept before it is added;
      // never another entry's of the same project id. A refused write adds nothing and says so.
      const { ref, positions: own } = await importCopy(store, kv, project, places);
      memoryPositions.set(ref.entryId, own);
      say(`새 사본으로 가져왔어요 · ${project.name}`); go(ref.entryId);
    }
    catch { say('가져오지 못했어요. 저장된 프로젝트는 그대로예요.'); }
  });
}

async function main() {
  const locks = (navigator as Navigator & { locks?: { request(name: string, cb: () => unknown): Promise<unknown> } }).locks ?? null;
  store = new WorkspaceStore(kv, locks);
  // AF100: reservations only in the real persistent storage, with its failures as they are (the memory fallback and the
  // read-as-empty of kv above are for the rest of the page, never for a job that must outlive it).
  const durableStore = storage;
  jobReservations = new JobReservations(runtimeStorage({ getItem: k => durableStore!.getItem(k), setItem: (k, v) => durableStore!.setItem(k, v) }), locks as JobLocks | null, !!durableStore);
  try { await store.init(); } catch { store.read(); }
  bindCanvas(); bindFind(); bindImport(); bindNewProject();
  $('add-part').addEventListener('click', () => openPartForm(scope));
  $('plan-entry').addEventListener('click', () => planView.toggle());
  $('handover-open').addEventListener('click', e => handover.open(scope, e.currentTarget as HTMLElement));
  $('return-entry').addEventListener('click', () => { if (returnView.isOpen() && !planView.isOpen()) returnView.close(); else openReturn(); });
  statusReady = aiStatus().then(s => { status = s; renderStatus(); renderRelease(); planView.statusChanged(); refreshReading(); statusArrived(); if (!selected && !planView.isOpen()) returnView.render(); mapRun.resume(); autoSync.opened(); autoSync.start(); cloudLink.start();
    void sessionSources.load().then(() => { autoSync.sourcesChanged(); statusArrived(); if (opened && autoSync.bindingOf(opened.key)) void autoSync.tick(); if (!selected && !planView.isOpen()) returnView.render(); }); });
  $('sync-pill').addEventListener('click', () => autoSync.toggle());
  // AF100: a reservation another tab of this address made (or ended) is looked at now, not at this page's next click.
  window.addEventListener('storage', e => { if (e.key?.endsWith(JOBS_KEY)) void statusReady?.then(() => mapRun.resume()); });
  window.addEventListener('hashchange', () => void render());
  window.addEventListener('pagehide', flushView);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushView(); });
  window.addEventListener('popstate', () => { if (location.hash === renderedHash) void render(); });
  // The bundled UI font: the map measures its names in it, so the first layout waits for it briefly (it is on this origin,
  // so normally at once). If it comes later, names are measured again and the open map is laid out once more.
  const fontFace = '600 13.5px "Pretendard Variable"';
  try {
    if (!document.fonts.check(fontFace)) {
      let late = false;
      await Promise.race([document.fonts.load(fontFace), new Promise(r => setTimeout(() => { late = true; r(null); }, 2500))]);
      if (late) void document.fonts.load(fontFace).then(() => { measureCache.clear(); if (opened && !$('space').hidden) renderSpace('keep'); });
    }
  } catch { /* the system font stays */ }
  await render();
  await statusReady;
}
void main();
