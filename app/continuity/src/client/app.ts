/* AgentFlow Studio client: entry → map → focused part. Reads project.7 data (saved projects and built examples) and never
 * rewrites records; the only project write is the user's own part name/note through the domain's editArea. */
import { isMapReading, isScenarioReading, type Project, type ScenarioReading } from '../shared/types.js';
import { FILE_LIMIT, PASTED_LIMIT } from '../shared/types.js';
import { WorkspaceStore, type EntryRef, storageErrorCode, serializeProject, readViewState, readEntryView, writeViewState, readEntryPositions, writeEntryPositions, importCopy, serializeBackup } from '../shared/storage.js';
import { parseBackup, cleanPositions } from '../shared/validation.js';
import { editArea, addArea, addChildArea, createProject, rename, pasteRecord, removePastedRecord, provideRecord, secretPasted, correctReadingRole, recordReadIntoMap } from '../shared/domain.js';
import { parseScenarioRecord, applyScenario, scenarioUnderstanding, projectLedger, type ScenarioUnderstanding } from '../shared/scenario-record.js';
import { scenarioRecordLike, badgePlaces, pathRelations, visitLinks, brokenPlace, headTexts, scenarioLabel, scenarioResultLine, saidText, visitNumber, linkTitle, LINK_WORD, LINK_GLYPH, KIND_WORD, type BrokenPlace,
  grammarMarks, linkDirection, fromSource, pointAlong, diamondMark, parallelBar, loopFrame, frameLabelSpots, waitDash, conditionChoice, conditionPath, gateVisits, type GrammarMark } from './scenario-view.js';
import { CLAIM_LABEL, stateLabel, revisedRelations, candidateReading, projectVariantGloss, glossVariants, type Applied, type CurrentClaim, type PartUnderstanding } from '../shared/map-reading.js';
import { recordRails, historyEntries, foldHistory, sourceRows, shortReading, readDisputes, addDispute, dropDispute, disputesOf, disputeTitle, disputeSection, withDisputes, ROLE_KEY, HISTORY_SHOWN, structureSummary, structureConditions, structureKeep, whereRows, fileRoleOf, enforcePlace, type DisputedItem, type HistoryEntry,
  PANE_TABS, tabLabel, entryTab, tabKeyMove, STRUCTURE_TITLE, structureSections, jumpChips, PANE_SHOWN, foldRows, behaviourSummary, cautionRows, unlinkedNames, listLabels, kindLead, UNLINKED_HEAD, UNLINKED_HINT,
  evidenceItems, footMarks, pathKey, footText, gradeLine, quotePlace, pushReturn, sameName, spanKey, ITEM_TITLE, DISPUTE_REASONS, DISPUTE_REASON_LABEL, type EvidenceBook, type EvidenceItem, type EvidenceUse, type DisputeReason,
  PANE_MIN, PANE_MAX, PANE_NARROW, hoistMarks, paneWidthFor, dragWidth, readPaneWidth, writePaneWidth, type PaneTab, type StructureSection, type CautionRow } from './pane-view.js';
import { recordTexts } from '../shared/request-return.js';
import type { MapReading, ReadingExclusion } from '../shared/types.js';
import { recordLabel } from '../shared/record-source.js';
import type { Channel, ClaimTopic, ReadingQuote, ReadingRelation, RelationMode, SavedCamera } from '../shared/types.js';
import { TOPIC_LABEL, TOPIC_HINT, EVIDENCE_LABEL, EVIDENCE_HINT, STATE_WORD, MODE_LABEL, TYPE_LABEL, FAMILY_OF, CHANNEL_LABEL, claimEvidence, claimWhen, claimsByTopic, claimTopic } from '../shared/claim-topic.js';
import { recordTitle } from './digest-source.js';
import { createMapRun, sendLine, JOB_NOTE, type MapRunState } from './map-run.js';
import { mapBatchLines, mapPendingText } from '../shared/map-route.js';
import { JobReservations, JOBS_KEY, type JobLocks } from './map-jobs.js';
import { requestResults, frozenRequests, displayAbout, captureRequestReading, restoreRequestReading, createWideReading } from './request-results.js';
import { correctRequestMatch, unlinkReplacement, requestComparison } from '../shared/request-return.js';
import { studioView, subtreeRecords, partPath, buildAsk, draftAfterAnswer, STATUS_LABEL, STATUS_SHORT, RECORD_LABEL, type AskCoverage, type StudioView, type PartView, type RecordView, type RelationView, type AskIntent, type StudioReply } from '../shared/studio.js';
import { EXAMPLES, buildExample, exampleKeys } from '../shared/studio-examples.js';
import { groupAxis, filedUnder, AXIS_WORD, SHELF_TITLE, SHELF_TIP, OUTSIDE_TITLE, OUTSIDE_TIP, BOUNDARY_TITLE, BOUNDARY_TIP } from './map-regions.js';
import { layoutScope, lead, mapLead, isListGroup, boundaryCounts, budgetFold, summaryEdges, restSummary, resolveLabels, unionRect, ROOT, HEAD, type Box, type Edge, type Face, type TypedCard, type LabelSpot, type TextMeasure, type ScopeLayout, type Positions, type Point } from './map-layout.js';
import { aiStatus, askStudio, AskError, ERROR_TEXT, RELEASE_TEXT, PUBLIC_EDITION, connectorRecords, publishHandover, type AiStatus } from './studio-api.js';
import { RUNTIME, runtimeStorage } from './runtime.js';
import { $, h, put, svg, chevron, ago, fullTime, inspectorWidth, setInspectorWidth, codeGate, codeNote, syncCodeGates } from './plan-dom.js';
import { routeEdges, samplePath, mixPath, type Routed } from './map-route.js';
import { zoomLevel, zoomTier, tierText, tierFit, entryParts, type EntryCounts, type ZoomTier } from './card-budget.js';
import { cardTemplate, cardHeights, lifecycleOf, maintenanceOf, kindLabel, structuralOf, nameBreaks, FAMILY_WORD, NAME_ROOM, TOGGLE_W, UNLINKED_TIP, type CardFacts, type CardTemplate } from './card-family.js';
import { glyphSvg } from './card-glyphs.js';
import { placeExpansion, actionSections, pushPlace, readOpenState, writeOpenState, groupBody, loopLine, stateVarLine, UNSAID, OPEN_MAP, SHORT_W, type OpenState, type ReadPlace, type ActionStep } from './expansion.js';
import { detailChain, detailSigns, stepConsumers, unmappedMark, decisionStep, conditionPlacement, conditionLines, conditionOfQuote, stepFace, linkFace, stepPorts, stepCounts, EXIT_BLANK, CONDITION_BLANK, CONDITION_UNPLACED, PROGRAM_STEP_HINT, PROGRAM_PORT_LABEL, PROGRAM_PORT_HINT, type ChainLink, type OutLine, type DecisionStep, type DecisionExit, type PlacedCondition } from './steps-view.js';
import { labelSpots, polylineHitsRect, portSpots } from './map-labels.js';
import { isContainer, makeRoom, foldText, nestedText, branchText, stateText as wellStateText, type Well, type WellRow } from './container-view.js';
import { lineStyle, lineBadge, badgeForms, isRelativeRef, overflowMark, restLabels, restLabelShown, shortLabel, labelPx, BADGE_GLYPH, labelRank, mergeByChannel, multiWord, portFaces, HEAD_PX, type Head, type LineBadge } from './line-grammar.js';
import { LENSES, DEFAULT_LENS, NO_FILTER, LENS_KEY, lensDef, lensLook, lensClasses, legendItems, legendApply, legendHead, legendMarks, legendChip, covers, lensKey, readLensRecord, writeLensRecord, type LensId, type LensPart, type LensLine, type LegendItem, type LegendState, type LegendAction, type Sample } from './view-lens.js';
import { PROGRAM_LABEL, PROGRAM_HINT, isProgram, ruleHasProgram, ruleHasProgramEnforce, programLoopItems, loopSegments, typeChipForms, chipText, edgeFields, contractList, lineFacts, type ChipForm } from './line-view.js';
import { opsLines, opsHead, opsCard } from './ops-line.js';
import { projectRuleList, projectRuleEntry, RULE_ROW_LABEL, partSigns, hasSigns, signTabs, ruleSaid, ruleView, unplacedCount, gateKind, gateSplit, gateSplitLine, changeRow, failureBlanks, sinceMatch, sinceSummary, timeSpan, readSince, writeSince, SIGN_LABEL, RULE_BLANKS, RULE_BLANK_HINT, RULE_DESIGN_PROGRAM_HINT, GATE_BLANK, GATE_BLANK_HINT, GATE_LABEL, GATE_HINT, ANCHOR_HINT, ENFORCER_HINT, PLACE_LABEL, NATURE_HINT, FAILURE_BLANK, RECOVERY_BLANK, SINCE_OFF, type PartSigns, type PartPlaces, type SignKind, type SinceState } from './signs-view.js';
import { CHAT_REPORT_ASK, RECORD_ASK_EXPLAIN, deltaReportAsk, reflectAsk, scenarioAskWithLedger, plannedNote } from '../shared/report-ask.js';
import { recordAskNodes, continuationNode } from './record-asks.js';
import { splitRecordChunks } from '../shared/record-table.js';
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
let lay: ScopeLayout = { boxes: new Map(), edges: [], heads: [], bounds: { x: 0, y: 0, w: 0, h: 0 }, spine: [], bands: { outside: [], boundary: [], shelf: [] } };
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
    const L = layoutScope(o.view, scope, open, positionsOf(o), measureName, undefined, mapAspect(), typedRoom(o)), titleRoom = 100 + (scope ? 34 * relationGroups(scopeEnds(o)).length : 0);
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
    if (fresh) { openState = null; backStack = []; pendingAction = null; hideDetail(); dropShort(); restoreOpen = storedOpen(next); scOn = null; scVisit = null; scView = null; signOpen = null; signFocus = false; since = readSince(kv, viewKeyOf(next)); }
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
/** tab: the panel's tab it was read in (map design v3 8.1); the way back comes to the same tab. */
type Place = ReadingContext & { key: string; scope: string | null; selected: string | null; camera: { x: number; y: number; k: number }; tab?: PaneTab };
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
    requests: body ? captureRequestReading(body) : null, claimFocus: active?.dataset.claimFocus ?? null, ...(selected ? { tab: paneTab } : {}) };
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
  // The tab it was read in comes back first, so the scroll and the focused citation below are that tab's.
  const retab = !!f.tab && f.tab !== paneTab && selected === f.selected && (f.surface === 'lens' || f.surface === 'sheet'); if (retab) paneTab = f.tab!;
  if (f.surface === 'sheet' && selected === f.selected) { sheetOpen = true; showReading(false, false); }
  // The same part read in another surface since (A0 summary -> B -> A1 sheet, then two steps back): the summary it left.
  else if (f.surface === 'lens' && selected === f.selected && sheetOpen) { sheetOpen = false; editing = false; showReading(false, false); }
  else if (f.surface === 'scope' && !selected) { scopeReading = true; renderScopeLens(); }
  else if (retab && f.surface === 'lens') renderLens();
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
  const byId = new Map(v.parts.map(p => [p.id, p]));
  // Regions under everything (one neutral surface: a colour by order says nothing, map design v3 2.1), lines over them, cards on top.
  for (const b of boxes.filter(x => x.kind === 'frame').sort((p, q) => p.depth - q.depth))
    root.append(el('rect', { class: 'mm-frame', x: X(b.x), y: Y(b.y), width: S(b.w), height: S(b.h), rx: '6' }));
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
  const pos = positionsOf(o), ov = wellOverlays(o); if (!held && !ov) return pos;
  // An open well's held places stand under everything; the moves made for it over the stored places (map design v3 4.5).
  const out: Positions = {};
  for (const c of new Set([...Object.keys(held ?? {}), ...Object.keys(pos), ...Object.keys(ov?.hold ?? {}), ...Object.keys(ov?.push ?? {})]))
    out[c] = { ...(ov?.hold[c] ?? {}), ...(held?.[c] ?? {}), ...(pos[c] ?? {}), ...(ov?.push[c] ?? {}) };
  return out;
};
const relayout = (o: Opened) => { const tpls = new Map<string, CardTemplate>(); lay = layoutScope(o.view, scope, isExpanded(o), heldPositions(o), measureName, planRows ?? undefined, mapAspect(), typedRoom(o, tpls)); lay.edges = grammarEdges(o, lay.edges); cardTpls = tpls; core = { ...lay.bounds }; withTitle(); };
/** The map's lines in the line grammar (map design v3 6.5, 3.6): one stroke per pair, direction and channel (data and control
 * never share one), each with the faces its ends take (a control line the reading called so: out of its card's bottom, in at
 * the top; a reference: from its ear). */
function grammarEdges(o: Opened, edges: Edge[]): Edge[] {
  const said = relationLines(o.project), notes = new Map(o.view.relations.map(r => [r.id, r.note]));
  return mergeByChannel(edges, (id, kind) => said.get(id)?.channel ?? (kind === 'flow' ? 'data' : 'uses'), id => notes.get(id)).map(e => {
    const ch = edgeChannel(e, said), f = portFaces(e.kind, ch, e.ids.some(id => !!said.get(id)?.channel));
    return f.a === 'side' && f.b === 'side' ? e : { ...e, faces: f };
  });
}

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
/* The panel head's state line (map-reading.7) is kindLine (map design v3 8.2): the type word, the operations line in its full
 * form and the author's tag of the line that says it; never a status the app verified. */
/** A part's line on the map: the state only when it says something. 'plan' (no request yet) stays quiet here; the inspector
 * still tells "no records" apart from "a planned note only". */
function metaLine(p: PartView, last: string | null): string | null {
  // No request of its own yet: what the records said about it (one short state), never a verified status.
  if (p.status === 'plan') return p.reading ? stateLabel(p.reading) : null;
  return `${STATUS_SHORT[p.status]}${last ? ` · ${ago(last)}` : ''}`;
}

/** The operations line (ops-line) as the short expansion and the detail view read it: the newest reading's state for the part, as
 * a report with the time the record gives, in plain text, and its tip (the time as written). Never a status the app saw, never
 * made from "built" or "designed". A card's own bottom line is ops-line opsCard. */
function opsOf(r: PartUnderstanding): { full: string; brief: string; tip: string } {
  const s = r.stateRead;
  return opsLines(s?.state ?? null, s?.when ?? null, opsRef);
}
/** The day an operations line's time is read against: the newest map reading's basis time, else today (UTC, as records write Z). */
let opsRef: string | null = null;
const opsDay = (o: Opened) => [...o.project.readings].reverse().find(isMapReading)?.basisAt ?? new Date().toISOString().slice(0, 10);
/* The map's zoom tiers (card-budget zoomTier, map design v3 5): one for the whole map, by the card's projected width with ±6px of
 * hysteresis. A typed card's box, its contact point and its pins never change with the tier or the scale (5.3): no relayout on a
 * zoom; the tier and the scale only choose what is shown inside each box (tierFit, fitCards) and the type's on-screen floors
 * (tierText, the --t-* sizes). Below Z_MID an untyped card's name reads on one line (styles.css z-mid). */
const Z_MID = 0.705;
let tier: ZoomTier | null = null, fitFrame = 0, lastFresh = 0;
/** Every typed card shows what fits its own box at the tier and scale (card-budget tierFit): writes only (each card's shape was
 * written on it when drawn), so it runs once per frame of a zoom. */
function fitCards() {
  fitFrame = 0;
  const t = tier ?? zoomTier(camera.k), k = camera.k;
  document.querySelectorAll<HTMLElement>('#world .node.card[data-shape]').forEach(el => {
    const [nameLines = 1, rows = 0, contract = 0, inner = 0, signs = 0, total = 0, status = 0, vals = 0, blank = 0] = el.dataset.shape!.split(',').map(Number);
    const f = tierFit({ nameLines, rows, contract, inner, signs, total, status, vals, blank }, k, t);
    el.style.setProperty('--nl', String(f.nameLines)); el.dataset.fitRows = String(f.rows); el.dataset.fitVals = String(f.vals);
    el.classList.toggle('fit-nokind', !f.kind); el.classList.toggle('fit-nocontract', !f.contract); el.classList.toggle('fit-noinner', !f.inner);
    el.classList.toggle('fit-nosigns', !f.signs); el.classList.toggle('fit-nobottom', !f.bottom); el.classList.toggle('fit-status', f.status);
  });
}
/** The 「프로그램」 chip (line-view): a value the program carried over from the record, never the model's answer; the style of 명시/해석. */
const progChip = (what?: string) => h('span', { class: 'sg-chip prog-chip', title: what ? `${PROGRAM_HINT} · ${what}` : PROGRAM_HINT }, PROGRAM_LABEL);
/** map-reading.14: a step the program cut from the 3절 chain (steps-view stepFace), and a port → step correspondence it made. */
const stepChip = () => h('span', { class: 'sg-chip prog-chip', title: PROGRAM_STEP_HINT }, PROGRAM_LABEL);
const portChip = (side: 'step' | 'pane', port: string) => h('span', { class: `sg-chip prog-chip${side === 'step' ? ' dv-prog-port' : ''}`, title: `포트 ‘${port}’ · ${PROGRAM_PORT_HINT}` }, side === 'step' ? PROGRAM_LABEL : PROGRAM_PORT_LABEL);
/** The loop line in its parts (line-view loopSegments), joined by ' · ', each item the program filled followed by its chip. */
const loopNodes = (segs: { text: string; program: boolean }[]): (string | HTMLElement)[] =>
  segs.flatMap((x, i) => [...(i ? [' · '] : []), x.text, ...(x.program ? [' ', progChip()] : [])]);
const loopSegs = (r: PartUnderstanding) => (r.loop ? loopSegments(r.loop, r.config, r.conditions ?? [], UNSAID) : []);
/* ---------- signs (map spec 5): 규칙 · 관문 · 변경 tabs at a card's bottom edge, their pane sections, the since-time filter ----------
 * signs-view.ts decides which claims are rules, gates and withdrawals (gates and a change's nature are provisional heuristics
 * until the contract carries scopeRef · anchors · enforcedBy · the withdrawal kind). A tab opens its section in the pane; the
 * map itself never changes for it (no neighbour moves). */
const signMemo = new WeakMap<PartUnderstanding, PartSigns<CurrentClaim>>();
/** In the order the pane reads claims (claimList): a correcting one first, then newest reading first, each reading as it said them. */
function signsOf(r: PartUnderstanding): PartSigns<CurrentClaim> {
  let v = signMemo.get(r); if (v) return v;
  const fresh = new Map<string, number>(); for (const c of r.claims) if (!fresh.has(c.reading)) fresh.set(c.reading, fresh.size);
  v = partSigns([...r.claims].sort((a, b) => Number(!!b.replaces) - Number(!!a.replaces) || fresh.get(a.reading)! - fresh.get(b.reading)! || a.index - b.index));
  signMemo.set(r, v); return v;
}
/** The sign section open in the pane (its part and the tab it was opened from); focus goes to it once after it is drawn. */
let signOpen: { part: string; kind: SignKind } | null = null, signFocus = false;
/** The one rule a sign chip in the detail view was opened from ('reading:index'), marked and scrolled to in the section. */
let signPick: string | null = null;
const claimKey = (c: CurrentClaim) => `${c.reading}:${c.index}`;
/** The places of a part a rule's sign can stand on (signs-view rulePlacement): its steps, its named ports and its fields. */
const placesOf = (r: PartUnderstanding): PartPlaces => ({ steps: (r.steps ?? []).map(s => s.name), inputs: r.inputs, outputs: r.outputs, fields: r.fields });
/** The since-time filter of the opened map (signs-view readSince/writeSince, by the map's view key); at null: the basis time. */
let since: SinceState = SINCE_OFF;
/** The newest map reading's basis time (the filter's default and the day a time without a day is read on), or null. */
const basisOf = (o: Opened) => [...o.project.readings].reverse().find(isMapReading)?.basisAt ?? null;
/** The filter's time as a span when it is on and reads as a time; else null (nothing is emphasised or dimmed). */
function sinceSpan(o: Opened | null): { span: { from: number; to: number }; ref: string | null } | null {
  if (!o || !since.on) return null;
  const ref = basisOf(o), span = timeSpan(since.at ?? ref, ref); return span ? { span, ref } : null;
}
const sinceHit = (c: { about: string | null; when?: string | null }, f: { span: { from: number; to: number }; ref: string | null }) => sinceMatch(claimWhen(c), f.span, f.ref) === 'after';
function saveSince() { const o = opened; if (o) writeSince(kv, viewKeyOf(o), since); }
/** The map dims everything not selected, visited or (with the filter on) written after its time. */
const dimNow = () => !!selected || !!scView || !!sinceSpan(opened);
/** A card's sign tabs: each a button ('규칙 2', '관문 1', '변경 1') that opens its section in the pane; with the since filter on,
 * a tab citing a claim after its time carries the accent ring. */
function signTabsEl(o: Opened, p: PartView, r: PartUnderstanding): HTMLElement | null {
  const sg = signsOf(r), tabs = signTabs(sg); if (!tabs.length) return null;
  const f = sinceSpan(o), split = gateSplit(sg.gates), unplaced = unplacedCount(sg.rules, placesOf(r));
  // spec 5.2: a run gate stands on the path, so the card carries a tiny 관문 mark at its bottom-right; a dev gate reads in the
  // section only (beside the path, never on it).
  const mark = split.run.length ? h('span', { class: 'gate-mark', role: 'img', 'aria-label': `실행 관문 ${split.run.length}`, title: `실행 관문 ${split.run.length} · 경로 위의 판정 (읽기면의 관문에서)` }, '관문') : null;
  return h('span', { class: 'node-signs', role: 'group', 'aria-label': `${p.name}의 표지` }, ...tabs.map(t => {
    const list = t.kind === 'rule' ? sg.rules : t.kind === 'gate' ? sg.gates : sg.changes, hit = !!f && list.some(c => sinceHit(c, f));
    const tip = t.kind === 'rule' ? `이 부분의 규칙 · 범위·적용 위치·보장을 읽기면에서 함께${unplaced ? `\n배치 미정 ${unplaced} · 정확한 단계·포트·필드에 놓이지 않음` : ''}`
      : t.kind === 'gate' ? `이 부분의 관문 · ${gateSplitLine(split)} · 읽기면에서${split.guessed.length ? `\n${GATE_BLANK_HINT}` : ''}`
        : `이 부분의 이전 → 지금 비교 · 읽기면에서 (지도는 바뀌지 않음)${sg.changes.some(c => changeRow(c).guessed) ? `\n${NATURE_HINT}` : ''}`;
    return h('button', { type: 'button', class: `sign-tab k-${t.kind}${hit ? ' since-hit' : ''}${signOpen?.part === p.id && signOpen.kind === t.kind ? ' on' : ''}`, 'data-sign': t.kind,
      'aria-pressed': String(signOpen?.part === p.id && signOpen.kind === t.kind), 'aria-label': `${p.name} ${SIGN_LABEL[t.kind]} ${t.count}개 읽기${hit ? ' · 기준 시각 이후 기록 있음' : ''}`,
      title: `${tip}${hit ? '\n기준 시각 이후 작성된 기록이 있음' : ''}`, onclick: () => openSign(p.id, t.kind) }, t.text);
  }), mark);
}
/** pick: the one rule a detail-view chip stands for; opening from a chip never closes the section (another chip may pick another). */
function openSign(id: string, kind: SignKind, pick: string | null = null) {
  const o = opened; if (!o || !partOf(o, id)) return;
  if (!pick && signOpen?.part === id && signOpen.kind === kind && selected === id && !sheetOpen) { closeSign(false); return; }
  signOpen = { part: id, kind }; signFocus = true; signPick = pick;
  // map design v3 8.1/8.3: a rule or gate tab opens 구조 with 규칙과 관문 whole and focused; a change tab opens 이력's change summary.
  const tab = entryTab(kind === 'change' ? 'change' : 'sign');
  if (lensRail) lensRail = false;
  if (selected !== id) { pendingTab = tab; go(o.key, id); return; }
  paneTab = tab;
  if (sheetOpen) { sheetOpen = false; editing = false; showReading(false, false); } else renderLens();
  markSignTabs();
}
function closeSign(focus: boolean) {
  const st = signOpen; signOpen = null; signFocus = false; signPick = null; if (!st) return;
  if (selected && !sheetOpen && !planView.isOpen()) renderLens();
  markSignTabs();
  if (focus) document.querySelector<HTMLElement>(`#world [data-part="${CSS.escape(st.part)}"] .sign-tab[data-sign="${st.kind}"]`)?.focus({ preventScroll: true });
}
function markSignTabs() {
  document.querySelectorAll<HTMLElement>('#world .sign-tab').forEach(t => {
    const part = t.closest<HTMLElement>('[data-part]')?.dataset.part, on = !!signOpen && signOpen.part === part && signOpen.kind === t.dataset.sign;
    t.classList.toggle('on', on); t.setAttribute('aria-pressed', String(on));
  });
}
/** The since filter on the drawn map: a card with a claim written after the filter's time (a folded card: anywhere inside it)
 * stays lit, every other card dims by the map's own dim; the tabs' rings were drawn with the cards. */
function applySince() {
  const o = opened, f = sinceSpan(o), sp = $('space');
  sp.classList.toggle('since', !!f);
  sp.classList.toggle('dim', dimNow());
  const memo = new Map<string, boolean>();
  const hit = (id: string, deep: boolean): boolean => {
    const k = `${id}|${deep}`, m = memo.get(k); if (m !== undefined) return m;
    const p = o ? partOf(o, id) : null;
    const v = !!p && !!f && ((p.reading?.claims ?? []).some(c => sinceHit(c, f)) || (deep && p.childIds.some(c => hit(c, true))));
    memo.set(k, v); return v;
  };
  document.querySelectorAll<HTMLElement>('#world .node[data-part]').forEach(el => el.classList.toggle('since-hit', !!f && hit(el.dataset.part!, el.classList.contains('has-kids'))));
}
/** The title's filter: '기준 시각 이후만' (a toggle) and its time (the reading's basis time by default), with what it found. */
function sinceStrip(o: Opened): HTMLElement | null {
  const ref = basisOf(o), claims = o.view.parts.flatMap(p => p.reading?.claims ?? []); if (!claims.length) return null;
  const f = sinceSpan(o), value = since.at ?? ref ?? '';
  let after = 0, unknown = 0;
  if (f) for (const c of claims) { const m = sinceMatch(claimWhen(c), f.span, f.ref); if (m === 'after') after++; else if (m === 'unknown') unknown++; }
  const input = h('input', { type: 'text', class: 'since-at', value, 'aria-label': '기준 시각 (예: 2026-11-03T09:01Z, 11-03 09:01Z)', placeholder: ref ?? 'MM-DD HH:MMZ', spellcheck: 'false', size: '18',
    title: '이 시각보다 뒤에 작성된 주장·변경 표지만 강조 · 비우면 지도의 기준 시각' }) as HTMLInputElement;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } else if (e.key === 'Escape') { input.value = value; input.blur(); } });
  input.addEventListener('change', () => { const v = input.value.trim(); since = { ...since, at: v && v !== ref ? v : null }; saveSince(); redrawSince(); });
  const bad = since.on && !f;
  return h('div', { class: `map-flow map-since${f ? ' on' : ''}`, role: 'group', 'aria-label': '기준 시각 이후 필터' },
    h('button', { type: 'button', class: `mf-step since-toggle${since.on ? ' on' : ''}`, 'aria-pressed': String(since.on),
      title: '기준 시각 이후 작성된 기록만 강조 (작성 시각 조건이지 두 스냅샷 비교가 아님)\n잠정: 주장의 시각(when)을 작성 시각으로 읽음 · 계약에 작성 시각이 따로 오기 전까지',
      onclick: () => { since = { ...since, on: !since.on }; saveSince(); redrawSince(); } }, '기준 시각 이후만'),
    input,
    f ? h('span', { class: 'since-sum', role: 'status' }, sinceSummary(after, unknown)) : bad ? h('span', { class: 'since-sum bad', role: 'status' }, '시각을 읽지 못함 · 필터 꺼짐과 같음') : null);
}
/** The map again in place with the filter's marks (same camera, same selection); the time field keeps focus when it had it. */
function redrawSince() {
  const o = opened; if (!o) return;
  const had = document.activeElement?.classList.contains('since-at') ?? false;
  renderSpace('keep'); markSelection(selected);
  if (selected) refreshReading();
  if (had) document.querySelector<HTMLInputElement>('#world .since-at')?.focus({ preventScroll: true });
}
/** 규칙과 관문 (구조, map design v3 8.3 row 5): the rules with what each leaves blank and the gates (spec 5.1–5.2), each field one
 * line, a blank as its own words. A card's rule or gate tab opens this section in 구조 whole and focuses its group (it is no longer
 * laid over the pane's top, inventory 6.11); otherwise each group shows its first rows. The withdrawals read 이전 → 지금 in 이력
 * (changesSection); one line here leads there. With the since filter on, rows after its time are emphasised. */
function rulesSection(c: PaneCtx): HTMLElement | null {
  const o = c.o, part = c.part, r = c.u; if (!r) return null;
  const sg = signsOf(r); if (!sg.rules.length && !sg.gates.length && !sg.changes.length) return null;
  const f = sinceSpan(o), whole = signOpen?.part === part.id && signOpen.kind !== 'change';
  const mark = (x: CurrentClaim) => (f ? (sinceHit(x, f) ? ' since-hit' : ' since-off') : '');
  const cite = (x: CurrentClaim, _kind: SignKind) => fnMarks(c, [claimThing(c, x)], x.text);
  // Each field one line, the blank as its own explicit words ('적용 위치 미해결'), never an empty cell.
  const field = (text: string, hint: string, blank = true) => h('li', { class: blank ? 'sg-blank' : '', title: hint }, text);
  const said = (text: string, written: boolean, cls: string) => written ? h('span', { class: cls, title: text }, text) : h('span', { class: 'sg-blank' }, text);
  const head = (kind: SignKind, n: number) => h('h4', { tabindex: '-1', 'data-sign-focus': kind, 'data-sub': SIGN_LABEL[kind] }, SIGN_LABEL[kind], h('small', {}, String(n)));
  const places = placesOf(r), conds = conditionsOf(r);
  // An anchor whose row is one of the part's condition rows (the same record and words): 「조건」, opening that condition in the detail view.
  const condChip = (quote: ReadingQuote) => { const j = conditionOfQuote(quote, conds), cd = conds[j]; if (!cd) return null;
    return h('button', { type: 'button', class: 'sg-chip sg-cond', 'data-cond': String(j), title: `이 적용 위치의 원문 줄이 조건 행이다 · ${conditionLines(cd).join(' · ')}\n눌러서 내부 상세의 그 조건`,
      'aria-label': `조건 ${cd.when} 내부 상세에서 보기`, onclick: () => openCondition(part.id, j) }, '조건'); };
  const saidLine = (x: CurrentClaim, kind: SignKind) => { const rs = ruleSaid(x);
    return h('p', { class: 'sg-said' }, said(rs.when, !!claimWhen(x), 'cl-when'), h('span', { 'aria-hidden': 'true' }, '·'), said(rs.where, !!x.where, 'cl-where'), rs.evidence ? h('span', { class: 'ev' }, rs.evidence) : null, cite(x, kind)); };
  const q = (thing: string | null, what: string) => fnMarks(c, [thing], what);
  // map-reading.14: a code enforcement resting on a 파일 지도 row names that file as its place (pane-view enforcePlace).
  const enforceAt = (e: { kind: string; quote: ReadingQuote | null }) => { const fr = enforcePlace(e, r.fileRoles ?? []); if (!fr) return null;
    return h('span', { class: 'sg-chip sg-place', title: `보장 자리 · 파일 지도 행의 파일
${fr.path} · ${fr.role}` }, fr.path); };
  // A rule (spec 5.1): its reach, its places (each with 명시/해석 and its quote, '자리 없음' for one naming no place of this part)
  // and what keeps it, each field one line; a blank as its own words. A rule an earlier reading wrote keeps its old blanks.
  const ruleItem = (x: CurrentClaim) => { const v = ruleView(x, places, part.name), key = claimKey(x);
    const placeWords = (ps: { kind: keyof typeof PLACE_LABEL; name: string }[]) => ps.map(y => `${PLACE_LABEL[y.kind]} ‘${y.name}’`).join(', ');
    return h('li', { class: `sg-rule${mark(x)}${signPick === key ? ' sg-picked' : ''}`, 'data-sign-pick': key }, h('p', { class: 'sg-text' }, x.text), saidLine(x, 'rule'),
      h('ul', { class: 'sg-fields' },
        field(v.scope.text, v.scope.hint, v.scope.blank),
        ...(v.anchorsBlank ? [field(v.anchorsBlank, RULE_BLANK_HINT.anchors)] : v.anchors.map((a, i) => h('li', { class: `sg-anchor${a.nowhere ? ' sg-blank' : ''}`, title: a.nowhere ? RULE_BLANK_HINT.nowhere : `이 지도의 자리 · ${placeWords(a.places)}` },
          h('span', { class: 'sg-key' }, '적용 위치'), h('span', { class: `sg-chip${a.program ? ' prog-chip' : ''}`, title: a.program ? `${PROGRAM_HINT} · 규칙과 낱말을 나누는 조건 행에서 이은 자리 (후보)` : ANCHOR_HINT[a.kind] }, a.label),
          h('span', { class: 'sg-val' }, a.nowhere ? `${RULE_BLANKS.nowhere} · ${a.text}` : a.text), condChip(a.quote), q(`${claimThing(c, x)}|anchor:${i}`, `적용 위치 · ${a.text}`)))),
        ...(v.enforceBlank ? [field(v.enforceBlank, RULE_BLANK_HINT.enforce)] : v.enforce.map((e, i) => h('li', { class: `sg-enforce k-${e.kind}${e.kind === 'none' || e.kind === 'unknown' ? ' sg-blank' : ''}`, title: `${ENFORCER_HINT[e.kind]}${e.kind === 'none' || e.kind === 'unknown' ? `\n${e.text}` : ''}` },
          h('span', { class: 'sg-key' }, '보장'), h('span', { class: 'sg-val' }, e.line), e.program ? progChip('거부 조건 행의 코드 보장') : null, enforceAt(e), e.quote ? q(`${claimThing(c, x)}|enforce:${i}`, `보장 · ${e.line}`) : null))),
        // map-reading.15: only the program's code device answers 설계 대응 — the line says 「프로그램 대응」, never 설계 대응 미상 and never nothing.
        ...(v.designProgram ? [h('li', { class: 'sg-design-prog', title: RULE_DESIGN_PROGRAM_HINT }, h('span', { class: 'sg-key' }, '설계 대응'), h('span', { class: 'sg-chip prog-chip' }, v.designProgram))] : []),
        ...(v.design ? [field(v.design, RULE_BLANK_HINT.design)] : []), ...(v.check ? [field(v.check, RULE_BLANK_HINT.check)] : []))); };
  // A gate (spec 5.2): 실행 관문 or 개발 관문 as the contract says it; one an earlier reading wrote was told by its words (추정).
  const gateItem = (x: CurrentClaim) => { const g = gateKind(x);
    return h('li', { class: `sg-rule sg-gate${mark(x)}` }, h('p', { class: 'sg-text' }, x.text), saidLine(x, 'gate'),
      h('ul', { class: 'sg-fields' }, g.kind ? field(GATE_LABEL[g.kind], GATE_HINT[g.kind], false) : h('li', { class: 'sg-blank', title: GATE_BLANK_HINT }, GATE_BLANK, ' ', h('span', { class: 'sg-guess' }, '추정')))); };
  const groups: HTMLElement[] = [];
  const unplaced = unplacedCount(sg.rules, places), split = gateSplit(sg.gates);
  if (sg.rules.length) {
    const fr = folded(c, 'rules', sg.rules, whole ? Infinity : PANE_SHOWN.rules, x => signPick === claimKey(x));
    groups.push(h('div', { class: 'sg-group' }, head('rule', sg.rules.length),
      unplaced ? h('p', { class: 'sg-split sg-blank', title: '정확한 단계·포트·필드에 놓이지 않은 규칙 (범위가 부분 전체이고 적용 위치가 없거나, 범위 미정이거나, 이름이 이 부분의 자리와 맞지 않음)' }, `배치 미정 ${unplaced}`) : null,
      h('ul', { class: 'sg-list' }, ...fr.shown.map(ruleItem)), fr.more));
  }
  if (sg.gates.length) {
    const fg = folded(c, 'gates', [...split.run, ...split.dev, ...split.guessed], whole ? Infinity : PANE_SHOWN.rules);
    groups.push(h('div', { class: 'sg-group' }, head('gate', sg.gates.length),
      h('p', { class: 'sg-split', title: '실행 관문은 경로 위(지도 카드의 관문 표시), 개발 관문은 경로 밖(여기서만)' }, gateSplitLine(split)),
      h('ul', { class: 'sg-list' }, ...fg.shown.map(gateItem)), fg.more));
  }
  if (sg.changes.length) groups.push(h('p', { class: 'sg-to-history' }, h('button', { type: 'button', class: 'link-button', title: '철회의 이전 → 지금 비교는 이력 탭에서 · 새것부터', onclick: () => openChanges() },
    `변경 ${sg.changes.length} · 이력에서 이전 → 지금`, h('span', { 'aria-hidden': 'true' }, ' ›'))));
  const n = sg.rules.length + sg.gates.length;
  return secEl('rules', n ? String(n) : null, '', ...groups);
}
/** 이력's first part (map design v3 8.7): the part's withdrawals as 이전 | 지금 with their head line and quote, newest reading first
 * (a correction first, as the pane reads claims). A card's 변경 tab opens 이력 here. */
function changesSection(c: PaneCtx): HTMLElement | null {
  const r = c.u; if (!r) return null;
  const rows = signsOf(r).changes; if (!rows.length) return null;
  const f = sinceSpan(c.o), mark = (x: CurrentClaim) => (f ? (sinceHit(x, f) ? ' since-hit' : ' since-off') : '');
  return h('section', { class: 'pn-sec pn-changes', 'data-sec': 'changes', 'aria-labelledby': 'pn-h-changes' },
    h('h3', { id: 'pn-h-changes', tabindex: '-1', 'data-sign-focus': 'change', 'data-path': '변경 요약', title: '이 부분의 철회 · 이전 → 지금 · 새 정리부터' }, '변경 요약', h('small', {}, String(rows.length))),
    h('ul', { class: 'sg-list' }, ...rows.map(x => { const v = changeRow(x);
      return h('li', { class: `sg-change${mark(x)}` }, h('p', { class: 'sg-head', ...(v.guessed ? { title: NATURE_HINT } : { title: '변경 성격은 기록의 철회 종류 (계약)' }) }, v.head, v.guessed ? h('span', { class: 'sg-guess', title: NATURE_HINT }, '추정') : null),
        h('div', { class: 'sg-compare' },
          h('div', { class: 'sg-col sg-before' }, h('span', { class: 'sg-col-label' }, '이전'), h('p', { class: v.beforeSaid ? '' : 'sg-blank' }, v.before)),
          h('div', { class: 'sg-col sg-now' }, h('span', { class: 'sg-col-label' }, '지금'), h('p', {}, v.now))),
        h('p', { class: 'sg-cite' }, h('span', { class: 'lb-cite-k' }, '원문'), fnMarks(c, [claimThing(c, x)], v.now))); })));
}
/** 「변경 K · 이력에서」: 이력 with its change summary in view and focused. */
function openChanges() {
  setPaneTab('history');
  const at = paneBody()?.querySelector<HTMLElement>('[data-sec="changes"] > h3'); if (at) { scrollToHead(at); at.focus({ preventScroll: true }); }
}
/* ---------- a typed card (map design v3 3): the family's silhouette, a glyph per kind on its tile, the head, at most three kind
 * rows from the record's own fields with the kind's one defining blank, the contract area, the inner line, the sign row and the
 * bottom line ('가동 보고 · 08:01Z' with the author's tag). card-family decides the template and the heights; this draws them. A
 * card's box is the same at every zoom level: the level only chooses what is shown inside it. */
/** What a card is made from (card-family CardFacts): the part's reading and what its adopted relations say of it: the parts that
 * start it and that it starts (control), the parts whose data come in and their cadences, a store's writers and readers, the
 * ports a model-written portMap row ties to a relation end (pins) and the data lines no such row ties (the card-level contact). */
function cardFactsOf(o: Opened, p: PartView, r: PartUnderstanding, said: Map<string, LineSaid>): CardFacts {
  const name = (id: string) => partOf(o, id)?.name ?? '부분', uniq = (xs: string[]) => [...new Set(xs)];
  const pm = (r.portMap ?? []).filter(m => m.program !== true), tied = new Set(pm.map(m => `${m.relationId}|${m.direction}`));
  const controlIn: string[] = [], controlOut: string[] = [], dataIn: string[] = [], cadence: string[] = [], writers = new Set<string>(), readers = new Set<string>();
  let unmapped = 0;
  for (const rel of o.view.relations) {
    const out = rel.from === p.id, inn = rel.to === p.id; if (out === inn || rel.kind === 'related') continue;
    const ch = said.get(rel.id)?.channel ?? (rel.kind === 'flow' ? 'data' : 'uses'), far = out ? rel.to : rel.from;
    if (ch === 'control') (out ? controlOut : controlIn).push(name(far));
    else if (ch === 'data') {
      if (inn) { dataIn.push(name(far)); writers.add(far); const c = said.get(rel.id)?.cadence; if (c) cadence.push(c); } else readers.add(far);
      if (!tied.has(`${rel.id}|${out ? 'out' : 'in'}`)) unmapped++;
    }
  }
  const sg = signsOf(r), type = r.typeRead?.type ?? null, steps = stepsOf(r), conds = conditionsOf(r) ?? [];
  const fb = failureBlanks(type, [...r.claims.flatMap(c => [c.text, c.before]), ...steps.flatMap(s => [s.name, s.does]), r.loop?.stop, r.loop?.resume]);
  return { type, config: r.config, inputs: r.inputs, outputs: r.outputs, fields: r.fields, loop: r.loop ?? null, loopProgram: programLoopItems(r.loop, r.config, conds),
    steps, conditions: conds, stateVars: r.stateVars?.length ?? 0, fileRoles: r.fileRoles?.length ?? 0,
    personRules: sg.rules.filter(x => (x.enforcedBy ?? []).some(e => e.kind === 'person')).length, children: p.childIds.length,
    controlIn: uniq(controlIn), controlOut: uniq(controlOut), dataIn: uniq(dataIn), dataInCadence: uniq(cadence), writers: writers.size, readers: readers.size,
    pins: { in: pm.filter(m => m.direction === 'in').map(m => m.port), out: pm.filter(m => m.direction === 'out').map(m => m.port) }, unmapped,
    portSteps: [...new Set(pm.map(m => m.step))], wellOpen: wellOpen.has(`${o.key}|${p.id}`), wellDepth: wellDepthOf(o, p.id),
    signs: hasSigns(sg), failureSaid: !fb || !fb.failure };
}
/* ---------- loop containers (map design v3 4; container-view.ts) ----------
 * A container's well opens to every step only when the person asks (its 펼치기, a fold row, a nested row); the view keeps that as a
 * view record, never as a layout: the places held for it and the moves made for it are overlays, dropped on 접기. */
const wellOpen = new Set<string>();
const wells = new Map<string, { hold: Positions; push: Positions }>();
/** Whether a part's reading makes it a container (a recorded loop and recorded steps; never its name or step names). */
const isContainerPart = (o: Opened, id: string) => { const r = partOf(o, id)?.reading; return !!r && isContainer(stepsOf(r).map(s => ({ name: s.name, program: s.program === true })), r.loop ?? null); };
/** How deep a part sits among the containers drawn around it here (1: none; its ancestors below the scope that are containers). */
function wellDepthOf(o: Opened, id: string): number {
  let d = 1;
  for (let c = partOf(o, id)?.parentId ?? null, g = 0; c && c !== scope && g < 64; c = partOf(o, c)?.parentId ?? null, g++) if (isContainerPart(o, c)) d++;
  return d;
}
/** The overlays of the wells open on this map: places held for each, then the moves made for it (4.5). */
function wellOverlays(o: Opened): { hold: Positions; push: Positions } | null {
  const mine = [...wells].filter(([k]) => k.startsWith(`${o.key}|`)); if (!mine.length) return null;
  const hold: Positions = {}, push: Positions = {};
  for (const [, w] of mine) { for (const [c, m] of Object.entries(w.hold)) hold[c] = { ...(hold[c] ?? {}), ...m }; for (const [c, m] of Object.entries(w.push)) push[c] = { ...(push[c] ?? {}), ...m }; }
  return { hold, push };
}
/** 펼치기 / 접기 of a container's well (4.5): its top-left edge stays; every box of its container chain keeps its place while it
 * grows; then, level by level up from the card, only the siblings the grown box overlaps (with 24px) move the least way right
 * or down (container-view makeRoom). 접기 drops both, so every box is back where it was. */
function toggleWell(id: string) {
  const o = opened; if (!o) return;
  const k = `${o.key}|${id}`, keepSel = selected;
  if (wellOpen.has(k)) { wellOpen.delete(k); wells.delete(k); renderSpace('keep'); if (keepSel) select(keepSel); return; }
  const hold: Positions = {};
  for (let c = lay.boxes.get(id)?.container, g = 0; c && g < 64; c = lay.boxes.get(c)?.container, g++) {
    const here = (hold[c] ??= {});
    for (const b of lay.boxes.values()) if (b.container === c && b.kind !== 'ghost') here[b.id] = { x: Math.round(b.rel.x), y: Math.round(b.rel.y) };
  }
  const entry = { hold, push: {} as Positions }; wells.set(k, entry); wellOpen.add(k);
  relayout(o);
  for (let cur: string | undefined = id, g = 0; cur && g < 16; g++) {
    const b = lay.boxes.get(cur); if (!b) break;
    const c = b.container, moves = makeRoom(b, [...lay.boxes.values()].filter(x => x.container === c && x.kind !== 'ghost' && x.id !== cur));
    if (moves.size) {
      const here = (entry.push[c] ??= {});
      for (const [sid, m] of moves) { const s = lay.boxes.get(sid)!; here[sid] = { x: Math.round(s.rel.x + m.dx), y: Math.round(s.rel.y + m.dy) }; }
      relayout(o);
    }
    cur = lay.boxes.has(c) ? c : undefined;
  }
  renderSpace('keep'); if (keepSel) select(keepSel);
}
/** A container's well on its card (4.3): the loop's unit and stop as badges, the open rail beside the steps (a bracket, joined
 * to nothing), the steps within the budget with their folds, and the state compartment. */
function wellEl(o: Opened, p: PartView, r: PartUnderstanding, w: Well, blankShown = false): HTMLElement {
  const lp = programLoopItems(r.loop, r.config, conditionsOf(r) ?? []);
  // At most one quiet 「?」 a card (3.5-1): a blank badge reads only while the card's rows show none, and only the first of them;
  // a blank left out says so in the head's tip.
  const showUnit = !!w.unit || !blankShown, showStop = !!w.stop || (!blankShown && !!w.unit);
  const untold = [!showUnit ? '반복 단위' : '', !showStop ? '정지 조건' : ''].filter(Boolean);
  const why: Record<string, string> = { first: '기록의 첫 행', last: '기록의 마지막 행', stop: '반복의 정지가 부르는 단계', branch: '조건의 갈래가 부르는 단계', port: '포트 대응이 걸린 단계' };
  const row = (x: WellRow) => {
    if (x.kind === 'step') return h('li', { class: `w-step${x.keep.length ? ' kept' : ''}`, title: `${x.name}${x.keep.length ? `\n늘 남김 · ${x.keep.map(k => why[k]).join(' · ')}` : ''}\n기록의 행 순서 · 실행 순서 아님` },
      h('span', { class: 'w-dash', 'aria-hidden': 'true' }, '-'), h('span', { class: 'w-name' }, x.name), x.program ? stepChip() : null);
    if (x.kind === 'fold') return h('li', { class: 'w-fold' }, h('button', { type: 'button', class: 'w-open', title: `단계 ${x.from + 1}–${x.to + 1} · 접은 요약이며 앞뒤 단계를 잇지 않는다\n누르면 이 반복의 단계를 모두 펼친다 (주변의 겹치는 부분만 비킴, 접으면 그대로)`, onclick: (e: Event) => { e.stopPropagation(); toggleWell(p.id); } }, foldText(x.count)));
    if (x.kind === 'branches') return h('li', { class: 'w-fold' }, h('span', {}, branchText(x.count)));
    return h('li', { class: 'w-fold' }, h('button', { type: 'button', class: 'w-open', title: '지도 위 중첩은 두 겹까지 · 누르면 이 반복의 단계를 펼친다', onclick: (e: Event) => { e.stopPropagation(); toggleWell(p.id); } }, nestedText(x.count)));
  };
  return h('div', { class: `c-well${w.open ? ' open' : ''}`, role: 'group', 'aria-label': `${p.name} · 반복 · 단계 ${w.steps}` },
    h('div', { class: 'w-head', ...(untold.length ? { title: `기록에 없음 · ${untold.join(' · ')} (반복의 정의 빈칸)` } : {}) },
      !showUnit ? null : h('span', { class: `w-badge${w.unit ? '' : ' blank'}`, title: w.unit ? `반복 단위 · 기록의 글자 그대로${lp.unit ? ' · 프로그램이 옮긴 값' : ''}` : '반복 단위 · 기록에 없음' }, w.unit ?? '반복 단위 ?', lp.unit ? progChip('반복 단위') : null),
      !showStop ? null : h('span', { class: `w-badge stop${w.stop ? '' : ' blank'}`, title: w.stop ? `정지 · 기록의 글자 그대로${lp.stop ? ' · 프로그램이 옮긴 값' : ''}` : '정지 조건 · 기록에 없음 (반복의 정의 빈칸)' }, w.stop ? `정지 · ${w.stop}` : '정지 조건 ?', lp.stop ? progChip('정지') : null),
      w.open || w.folded ? h('button', { type: 'button', class: 'w-toggle', 'aria-expanded': String(w.open), title: w.open ? '접기 · 펼치기 전 배치 그대로' : `펼치기 · 단계 ${w.steps} 모두 (주변의 겹치는 부분만 비킴)`, onclick: (e: Event) => { e.stopPropagation(); toggleWell(p.id); } }, w.open ? '접기' : '펼치기') : null),
    h('div', { class: 'w-body' }, h('i', { class: 'w-rail', 'aria-hidden': 'true', title: '반복 범위 · 장식 괄호 (복귀 대상은 기록에 없음)' }),
      h('ol', { class: 'w-steps', 'aria-label': `단계 ${w.steps} · 기록의 행 순서` }, ...w.rows.map(row))),
    w.state ? h('div', { class: 'w-state', title: `유지 상태 · 이름은 패널 구조 탭에서 · 칩으로 그리지 않는다
${UNLINKED_TIP}` }, h('span', { class: 'unl' }, wellStateText(w.state))) : null);
}
/** The templates of the cards the last layout typed (relayout), by part id: renderSpace draws each with the template its box was
 * measured for. A part missing here draws as an untyped card. */
let cardTpls = new Map<string, CardTemplate>();
/** The lines a typed card's name takes (map-layout measures it the same way): two at most, cut with an ellipsis past them. */
const cardNameLines = (p: PartView) => (measureName(p.name, 'head') * 1.06 + 2 > NAME_ROOM - (p.childIds.length ? TOGGLE_W : 0) ? 2 : 1);
/** layoutScope's extra: every part a reading spoke of, as a unit and as a row in a group, is a typed card (card-family) of CARD_W
 * whose height is its near content's, once; its pins are the relation ends a model portMap row ties to a pin. A list item keeps its
 * one line; a part no reading spoke of keeps the untyped card. */
function typedRoom(o: Opened, tpls?: Map<string, CardTemplate>): (id: string, face: Face) => number | TypedCard {
  const said = relationLines(o.project);
  return (id, face) => {
    const p = partOf(o, id), r = p?.reading; if (!p || !r || face === 'item') return 0;
    const t = cardTemplate(cardFactsOf(o, p, r, said)); tpls?.set(id, t);
    const pm = (r.portMap ?? []).filter(m => m.program !== true);
    return { nameRoom: NAME_ROOM - (p.childIds.length ? TOGGLE_W : 0), shape: (nl, planned) => {
      const hs = cardHeights(t, nl, planned), pins: Record<string, number> = {};
      for (const m of pm) { const y = hs.pins[`${m.direction}:${m.port}`]; if (y !== undefined) pins[`${m.relationId}|${m.direction}`] = y; }
      return { h: hs.total, contact: hs.contact, pins, ear: hs.ear };
    } };
  };
}
const CONTACT_TIP = '포트 대응 미기록 · 이 선들은 카드 수준 접점에 붙는다 (모델이 적은 포트 대응 행이 있는 끝만 핀에)';
/** A name with a line break opportunity after each of its separators (card-family nameBreaks): it wraps at 'CancelToken·|signal'
 * or 'train.bin/|val.bin', never inside a word. */
const breakable = (name: string): (string | HTMLElement)[] => nameBreaks(name).flatMap((s, i) => (i ? [document.createElement('wbr'), s] : [s]));
/** A typed card's DOM (styles.css .node.card): the head (glyph tile · name · kind word with the lifecycle chip and, for the
 * overview, the short status), the kind rows, the contract area, the inner line, the sign row and the bottom line. */
function cardEl(o: Opened, p: PartView, r: PartUnderstanding, t: CardTemplate, face: Face, extra: { cls: string; title: string; onkeydown: (e: Event) => void; toggle: HTMLElement | null; links: HTMLElement | null; enter: HTMLElement | null; boxH: number; filed?: string | null }): HTMLElement {
  const s = r.stateRead, life = lifecycleOf(s?.state, s?.quote?.quote ?? ''), ops = opsCard(s?.state ?? null, s?.when ?? null, opsRef, life);
  const maint = life ? null : maintenanceOf(r.statusClaims), maintQuote = maint ? r.statusClaims.find(x => x.dimension === 'maintenance')?.quote.quote ?? null : null;
  const ev = s ? claimEvidence({ quote: s.quote?.quote ?? '' }) : null, kids = p.childIds.length;
  // The shape the box was measured for (its near content), written on the card so the zoom's fit reads it without measuring.
  const nl = cardNameLines(p), hs = cardHeights(t, nl);
  const tile = h('span', { class: `glyph-tile g-${t.family}`, title: `${FAMILY_WORD[t.family]} · ${t.kind}${t.inner === 'composition' || t.inner === 'both' ? ` · 내부 구성 ${kids}` : ''}` });
  tile.innerHTML = glyphSvg(t.glyph) + (t.inner === 'composition' || t.inner === 'both' ? `<span class="glyph-badge">${glyphSvg('composition')}</span>` : '');
  // A recorded loop on the card (a container's well, or a loop the record gives): the ↻ tab at the head's right, at every tier.
  const loopTab = r.loop ? h('span', { class: 'c-loop-tab', title: `반복 · 기록된 반복${r.loop.unit ? ` · 단위 ${r.loop.unit}` : ' · 단위 미상'}${r.loop.stop ? ` · 정지 ${r.loop.stop}` : ''}`, 'aria-label': '반복이 기록된 부분' }, '↻') : null;
  const neutralTip = t.structural ? `${t.kind} · 기록이 이 부분의 종류를 말하지 않았다 · 기록된 안쪽(단계·반복)만 구조로 그린다 (종류를 짐작하지 않음)` : '유형 미상 · 기록이 이 부분의 종류를 말하지 않았다 (패널 구조 탭에서)';
  const head = h('div', { class: 'c-head' }, tile,
    h('span', { class: 'c-title' }, h('span', { class: 'node-name c-name' }, ...breakable(p.name)),
      h('span', { class: 'c-kind' }, h('span', { class: `c-kind-word${t.family === 'neutral' ? ' unknown' : ''}`, ...(t.family === 'neutral' ? { title: neutralTip } : {}) }, `${t.kind}${kids ? ` · 구성 ${kids}` : ''}`),
        life ? h('span', { class: 'c-life', title: `생애 · 기록의 상태 단어 (${s?.quote ? `“${s.quote.quote}”` : '원문 줄 없음'})` }, life) : null,
        maint ? h('span', { class: 'c-life', title: `유지 방침 · 기록의 상태 표 (${maintQuote ? `“${maintQuote}”` : '원문 줄 없음'})` }, maint) : null,
        extra.filed ? h('span', { class: 'c-filed', title: `원문 분류 · 기록이 이 부분을 「${extra.filed}」 묶음 아래에만 두었다 (실행 위치의 근거가 아님)` }, `원문 분류: ${extra.filed}`) : null),
      // The short status (5.4) on a line of its own, read only at 개요 (the bottom line says it at 중간 and 가까이).
      life ? null : h('span', { class: 'c-short', title: ops.tip }, ops.short),
      h('span', { class: 'plan-note' })),
    loopTab, extra.toggle);
  // The kind's one defining blank reads last (it never shows below 가까이, so the rows above it keep their places when it hides).
  const ordered = [...t.rows.filter(x => !x.blank), ...t.rows.filter(x => x.blank)];
  const rows = ordered.length ? h('div', { class: 'c-rows' }, ...ordered.map(x => h('div', { class: `c-row${x.blank ? ' blank' : ''}`, title: x.blank ? `${x.label} · 기록에 없음 (이 종류를 정의하는 빈칸)` : `${x.label} · ${x.value}${x.unlinked ? `\n${UNLINKED_TIP}` : ''}` },
    h('span', { class: 'c-label' }, x.label), h('span', { class: `c-val${x.unlinked ? ' unl' : ''}` }, x.value), x.program ? progChip(`${x.label}은 기록에서 프로그램이 옮긴 값`) : null))) : null;
  const c = t.contract;
  // List values by name (0.1, the owner's decision): muted, each name under a dotted rule whose tip says it has no line of its own;
  // never a pin, never a line's end. A part whose record names none has no contract area here (the panel says so).
  const contract = c.kind === 'values'
    ? c.rows.length ? h('div', { class: 'c-contract vals' }, ...c.rows.map(v => h('div', { class: 'c-row c-vrow', title: `${v.label} · ${v.names.join(' · ')}${v.more ? ` 외 ${v.more}개` : ''}\n${UNLINKED_TIP}` },
      h('span', { class: 'c-label' }, v.label),
      h('span', { class: 'c-val c-names' }, ...v.names.flatMap((n, i) => [i ? h('span', { class: 'c-sep', 'aria-hidden': 'true' }, ' · ') : null, h('span', { class: 'unl' }, n)].filter((x): x is HTMLElement => !!x))),
      v.more ? h('span', { class: 'c-more' }, `+${v.more}`) : null))) : null
    : h('div', { class: 'c-contract pins', role: 'group', 'aria-label': `${p.name}의 포트 · 모델이 적은 포트 대응` },
      h('div', { class: 'c-pin-head' }, h('span', {}, c.ins.length ? c.inTitle : ''), h('span', {}, c.outs.length ? c.outTitle : '')),
      ...Array.from({ length: Math.max(c.ins.length, c.outs.length) }, (_, i) => h('div', { class: 'c-pin-row' },
        c.ins[i] ? h('span', { class: 'c-pin in', title: `${c.inTitle} · ${c.ins[i]} · 포트 대응 행(모델)이 이 포트에 선을 잇는다` }, h('i', { class: 'pin', 'aria-hidden': 'true' }), h('span', { class: 'c-pin-name' }, c.ins[i]!)) : h('span', { class: 'c-pin empty' }),
        c.outs[i] ? h('span', { class: 'c-pin out', title: `${c.outTitle} · ${c.outs[i]} · 포트 대응 행(모델)이 이 포트에 선을 잇는다` }, h('span', { class: 'c-pin-name' }, c.outs[i]!), h('i', { class: 'pin', 'aria-hidden': 'true' })) : h('span', { class: 'c-pin empty' }))),
      c.unmapped ? h('p', { class: 'c-cline', title: CONTACT_TIP }, `포트 대응 미기록 ${c.unmapped}`) : null);
  const words = entryParts(entryCountsOf(p, r), { config: 0, fields: 0 });
  // The inner line: '단계 N' and the first recorded steps' names (each step carries its quote), in the record's row order.
  const il = t.innerLine;
  const inner = il ? h('div', { class: 'c-inner', title: `${words.join(' · ')}${il.names.length ? `\n단계: ${il.names.join(' · ')}${il.more ? ` 외 ${il.more}개` : ''}` : ''}\n기록의 행 순서 · 지도에서는 실행 순서나 반복 범위를 그리지 않는다` }, h('span', { class: 'c-label c-inner-label' }, il.text),
    il.names.length ? h('span', { class: 'c-val c-inner-text' }, il.names.join(' · ')) : null, il.more && il.names.length ? h('span', { class: 'c-more' }, `+${il.more}`) : null,
    il.program ? h('span', { class: 'sg-chip prog-chip', title: PROGRAM_STEP_HINT }, `+${il.program} ${PROGRAM_LABEL}`) : null) : null;
  const well = t.well ? wellEl(o, p, r, t.well, t.rows.some(x => x.blank)) : null;
  const signs = t.signs ? signTabsEl(o, p, r) : null;
  const open = !kids && words.length && words[0] !== '내부 미상'
    ? h('button', { type: 'button', class: 'entry-open', title: `동작 열기 · ${words.join(' · ')}\n제자리에 들어가면 펼치고, 들어가지 않으면 내부 상세로 연다 (두 번 누르기 · 선택 후 Enter)`, 'aria-label': `${p.name} 내부 보기`, onclick: () => openAction(p.id) }, '내부 보기') : null;
  const bottom = h('div', { class: 'c-bottom' }, h('span', { class: 'c-ops', title: ops.tip }, ops.text),
    ev ? h('span', { class: `ev ev-${ev}`, title: `운영 한 줄의 근거 · 기록 작성자의 꼬리표 (${EVIDENCE_HINT[ev]}) · 앱의 판정 아님` }, EVIDENCE_LABEL[ev]) : null,
    h('span', { class: 'c-entry' }, extra.links, extra.enter, open));
  return h('div', { class: `node ${face} card typed f-${t.family} k-${r.typeRead?.type ?? 'neutral'}${t.structural ? ' structural' : ''}${t.well ? ' has-well' : ''}${r.loop ? ' has-loop' : ''}${life ? ' life' : ''}${kids ? ' has-kids' : ''} ${extra.cls}`, style: `--nl:${nl}`, 'data-shape': `${nl},${t.rows.length},${hs.contract},${hs.inner},${hs.signs},${extra.boxH},${life ? 0 : 1},${c.kind === 'values' ? c.rows.length : 0},${t.rows.some(x => x.blank) ? 1 : 0}`,
    'data-part': p.id, 'data-box': p.id, 'data-drag': p.id, role: 'button', tabindex: '0', title: extra.title, onkeydown: extra.onkeydown },
  head, rows, contract, inner, well, signs ? h('div', { class: 'c-signs' }, signs) : null, bottom);
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
/** The condition rows a part records (map-reading.12 conditions[]: 조건 · 거부 · 분기, newest reading first; none before .12). The one
 * place that reads them: the entry line ('조건 K'), the short expansion's 분기 출구, the detail view's step exits and the pane. */
// Pipeline .44: a variant ID a condition names (「then=X01」) reads with what the variant is (its C-VARIANT row: the implementing part and
// its choice condition); the stored words stay as written.
const conditionsOf = (r: PartUnderstanding): PartUnderstanding['conditions'] => {
  const list = r.conditions ?? [], g = opened ? projectVariantGloss(opened.project) : null;
  if (!g?.size || !list.some(c => /\bX\d{1,3}\b/.test(`${c.when} ${c.then} ${c.else ?? ''}`))) return list;
  return list.map(c => ({ ...c, when: glossVariants(c.when, g), then: glossVariants(c.then, g), else: c.else === null ? null : glossVariants(c.else, g) }));
};
/** Whether the part's gate exits come from its condition rows: the newest map reading that speaks of it carries them
 * (map-reading.12, [] when it said none); before .12 they come from the decision step's own words (참이면 / 거짓이면). */
function conditionsContract(project: Project, id: string): boolean {
  for (let i = project.readings.length - 1; i >= 0; i--) {
    const x = project.readings[i]!; if (!isMapReading(x)) continue;
    const part = x.parts.find(q => q.areaId === id); if (part) return part.conditions !== undefined;
  }
  return false;
}
// map-reading.14: the steps the program cut from the 3절 chain count apart ('기록된 단계 M (+P 프로그램)').
const entryCountsOf = (p: PartView, r: PartUnderstanding): EntryCounts => { const sc = stepCounts(stepsOf(r));
  return { read: true, kids: p.childIds.length, steps: sc.recorded, programSteps: sc.program, inputs: r.inputs.length, outputs: r.outputs.length, fields: r.fields.length, config: r.config.length, state: r.stateVars?.length ?? 0, loop: !!r.loop, unplaced: unplacedCount(signsOf(r).rules, placesOf(r)), conditions: conditionsOf(r).length }; };
const UNPLACED_TIP = '배치 미정 · 정확한 단계·포트·필드에 놓이지 않은 규칙 (규칙 탭에서 읽기)';
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
function actionBody(p: PartView, detail: boolean, cellSign: (field: string) => HTMLElement | null = () => null): HTMLElement[] {
  const r = p.reading; if (!r) return [];
  return actionSections({ inputs: detail ? [] : r.inputs, outputs: detail ? [] : r.outputs, fields: r.fields, config: r.config, state: detail ? stateWords(r) : null,
    steps: detail ? [] : stepsOf(r), loop: detail ? null : r.loop, stateVars: detail ? [] : r.stateVars ?? [], conditions: detail ? [] : conditionsOf(r) }).map(sec =>
    h('section', { class: `xp-sec x-${sec.key}`, ...(sec.key === 'exits' ? { title: '기록의 조건·거부·분기 행 · 조건 → 그때의 결과 · 전부와 아니면의 결과는 내부 상세에서' } : {}) },
      h('h4', { class: 'xp-title' }, sec.title, sec.key === 'loop' ? null : h('small', {}, String(sec.total ?? sec.items.length))),
      sec.kind === 'steps' ? h('ol', { class: 'xp-steps' }, ...sec.items.map((x, i) => { const does = sec.subs?.[i] ?? null, prog = sec.programs?.[i] === true;
        return h('li', { title: prog ? `${x}\n${PROGRAM_LABEL} · ${PROGRAM_STEP_HINT}` : does ? `${x} — ${does}` : x }, h('span', { class: 'xp-n', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'xp-step' }, x),
          prog ? stepChip() : null, does ? h('span', { class: 'xp-does' }, does) : null); }))
      : sec.kind === 'cells' ? h('div', { class: 'xp-cells' }, ...sec.items.map(x => { const sign = cellSign(x); return h('span', { class: `ledger-cell${sign ? ' has-sign' : ''}`, 'data-field': x }, x, sign); }))
        : sec.kind === 'words' ? h('p', { class: 'xp-words' }, ...sec.items.flatMap((x, i) => [i ? h('span', { class: 'xp-dot', 'aria-hidden': 'true' }, ' · ') : null, h('span', { class: 'xp-word' }, x)]).filter((x): x is HTMLElement => !!x))
          // The loop line and the kept state carry the 「프로그램」 chip on what the program filled (map-reading.13).
          : sec.key === 'loop' && r.loop ? h('ul', { class: 'xp-lines' }, h('li', {}, ...loopNodes(loopSegs(r))))
            : sec.key === 'stateVars' ? h('ul', { class: 'xp-lines' }, ...sec.items.map((x, i) => h('li', {}, x, isProgram((r.stateVars ?? [])[i]) ? ' ' : null, isProgram((r.stateVars ?? [])[i]) ? progChip('유지 상태의 이름만') : null)))
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
    if (!el.offsetWidth) return; const k = el.classList.contains('lone-head') ? 1 : el.classList.contains('edge-label') ? lineInv() : inv;
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
  // spec 7: at an actor's effect exit and a store's write ports only, what the records leave unsaid about failure and recovery.
  const fb = r ? failureBlanks(r.typeRead?.type, [...r.claims.flatMap(c => [c.text, c.before]), ...stepsOf(r).flatMap(s => [s.name, s.does]), r.loop?.stop, r.loop?.resume]) : null;
  const blankEls = (where: 'exit' | 'write') => !fb || fb.at !== where ? [] : [
    fb.failure ? h('li', { class: 'dv-port blank fr-blank', title: `${where === 'exit' ? '이 효과 출구' : '이 보관소의 쓰기 접점'}에서 실패했을 때의 대응을 기록이 말하지 않았다 (없다는 뜻이 아님)` }, FAILURE_BLANK) : null,
    fb.recovery ? h('li', { class: 'dv-port blank fr-blank', title: `${where === 'exit' ? '이 효과 출구' : '이 보관소의 쓰기 접점'}이 멈춘 뒤 어떻게 복구·재개하는지 기록이 말하지 않았다 (없다는 뜻이 아님)` }, RECOVERY_BLANK) : null].filter((x): x is HTMLLIElement => !!x);
  // The inside (spec 4): the steps in the record's row order, each port with the steps the record maps it to, or its blank.
  const steps = r ? stepsOf(r) : [], counts = stepCounts(steps), fileRoles = r?.fileRoles ?? [];
  // map-reading.12: each condition row on the step its when (else its then) names (steps-view conditionPlacement, the rule chips'
  // name rule), else apart under the steps (자리 없는 조건, 단계 미상); a run gate's exits come from them (before .12 from the step's
  // own words).
  const conds = r ? conditionsOf(r) : [], cp = conditionPlacement(conds, steps), contract = conditionsContract(o.project, id);
  const condTip = (x: PlacedCondition<(typeof conds)[number]>) => [`조건 행 · ${conditionLines(x.condition).join(' · ')}`,
    x.place ? `단계 ‘${steps[x.place.step]!.name}’ · ${x.place.by === 'when' ? '조건' : '결과'} 쪽 말이 이 단계의 ${x.place.key === 'name' ? '이름' : '쓰는 것'}${x.place.how === 'equal' ? '과 같음' : '을 담음'}`
      : `${CONDITION_BLANK} · 조건의 말이 이 부분의 어느 단계 이름·쓰는 것도 짚지 않음 · 추측으로 놓지 않음`, `원문: “${x.condition.quote.quote}”`].join('\n');
  const condEl = (x: PlacedCondition<(typeof conds)[number]>) => h('span', { class: `dv-cond${x.place ? '' : ' apart'}`, role: 'listitem', 'data-cond': String(x.index), title: condTip(x) },
    ...conditionLines(x.condition).map((t, k) => h('span', { class: k ? 'dv-cond-else' : 'dv-cond-if' }, t)), x.place ? null : h('small', { class: 'dv-cond-blank' }, CONDITION_BLANK));
  const condsApart = cp.unplaced.length ? h('div', { class: 'dv-conds-apart' },
    h('p', { class: 'dv-apart-head', title: '조건의 말이 이 부분의 어느 단계도 이름으로 짚지 않아 경계에 둔 조건 행 · 추측으로 단계에 잇지 않음' }, CONDITION_UNPLACED, h('small', {}, String(cp.unplaced.length))),
    h('span', { class: 'dv-conds', role: 'list', 'aria-label': CONDITION_UNPLACED }, ...cp.unplaced.map(condEl))) : null;
  const chain = detailChain(steps, r?.portMap ?? [], ins.filter(x => !x.unnamed).map(x => x.name), outs.filter(x => !x.unnamed).map(x => x.name));
  // spec 5.1: each rule at the step, port or ledger cell its scope's name or its anchors name (by name only), a part rule at the
  // boundary head, a project rule at the view head; one placed nowhere reads 배치 미정 there. A chip opens the rule in the pane.
  const ds = r ? detailSigns(chain, r.fields, signsOf(r).rules) : null;
  // spec 5.2: each run gate on its decision step (steps-view decisionStep: the step its words name, else the first, said so),
  // a diamond on that step and its exits as the record wrote them on it (참이면 / 거짓이면), else '출구 미상'.
  const runs = r ? gateSplit(signsOf(r).gates).run : [];
  const decisions = runs.flatMap(g => { const d = decisionStep({ text: g.text, quote: g.quote, ...(g.anchors ? { anchors: g.anchors } : {}) }, steps, contract ? conds : null); return d ? [{ g, d }] : []; });
  const exitEl = (e: DecisionExit) => e.branch
    ? h('span', { class: 'dv-exit', role: 'listitem', 'data-cond': String(e.condition), title: `${e.branch === 'then' ? `조건 ${e.when} → ${e.text}` : `아니면 → ${e.text}`} (기록의 조건 행)\n원문: “${conds[e.condition!]?.quote.quote ?? ''}”` },
      e.branch === 'then' ? `조건 ${e.when} → ${e.text}` : `아니면 → ${e.text}`)
    : h('span', { class: 'dv-exit', role: 'listitem', title: `${e.when} · ${e.text} (기록이 이 단계에 적은 출구)` }, `${e.when} → ${e.text}`);
  const gateAt = (x: { g: CurrentClaim; d: DecisionStep }) => h('div', { class: `dv-gate${x.d.matched === 'first' ? ' guessed' : ''}` },
    h('span', { class: 'dv-gate-chip', title: `실행 관문 · ${x.g.text}\n원문: “${x.g.quote}”${x.d.matched === 'first' ? '\n관문의 말이 이름으로 짚는 단계가 없어 첫 단계에 둠 (판정 단계 미확인)' : `\n판정 단계 ‘${x.d.name}’ · 관문의 말이 이 단계 이름을 짚음`}` },
      h('span', { class: 'dv-gate-k' }, '관문'), h('span', { class: 'dv-gate-t' }, x.g.text), x.d.matched === 'first' ? h('small', { class: 'dv-gate-guess' }, '판정 단계 미확인') : null),
    h('span', { class: 'dv-exits', role: 'list', 'aria-label': '출구' }, ...(x.d.exits.length
      ? x.d.exits.map(exitEl)
      : [h('span', { class: 'dv-exit blank', role: 'listitem', title: x.d.source === 'conditions' ? '이 판정 단계에 놓인 조건 행(조건·거부·분기)을 기록이 적지 않았다 · 추측으로 잇지 않음' : '이 판정 단계의 출구(참이면·거짓이면)를 기록이 적지 않았다 · 추측으로 잇지 않음' }, EXIT_BLANK)])));
  const signChip = (list: CurrentClaim[] | undefined, where: string, text = '규칙', cls = '') => !list?.length ? null
    : h('button', { type: 'button', class: `rule-sign${cls ? ` ${cls}` : ''}`, 'data-rule-sign': where, 'aria-label': `${where}의 규칙 ${list.length}개 읽기`,
      title: `${where}의 규칙 ${list.length}\n${list.map(c => `· ${c.text}`).join('\n')}\n눌러서 읽기면에서 범위·적용 위치·보장`,
      onclick: (e: Event) => { e.stopPropagation(); openSign(id, 'rule', claimKey(list[0]!)); } }, list.length > 1 && text === '규칙' ? `규칙 ${list.length}` : text);
  const portEl = (x: { key: string; name: string; unnamed: boolean }, out: boolean) => {
    const via = ends.filter(e => e.out === out && e.port === x.key && e.near !== id).map(e => partOf(o, e.near)?.name).filter(Boolean);
    const cp = x.unnamed ? null : (out ? chain.ports.out : chain.ports.in).find(q => q.port === x.name);
    // With steps recorded, a port the record maps to none ends here, on the boundary; without steps the body says it once.
    const mark = steps.length ? (cp ? cp.mark : unmappedMark(out ? 'out' : 'in')) : null;
    const to = cp?.steps.map(k => chain.rows[k]!.name) ?? [];
    const sign = x.unnamed ? null : signChip((out ? ds?.ports.out : ds?.ports.in)?.get(x.name), `${out ? '내는' : '받는'} 포트 ‘${x.name}’`);
    return h('li', { class: `dv-port${x.unnamed ? ' unnamed' : ''}${mark ? ' unmapped' : ''}${sign ? ' has-sign' : ''}`, 'data-port': `${out ? 'o' : 'i'}|${x.key}`,
      title: `${out ? '내는 것' : '받는 것'} · ${x.name}${x.unnamed ? '\n기록이 이 관계에 포트 이름을 주지 않았다 (관계의 말)' : ''}${via.length ? `\n안쪽 ‘${via.join('’, ‘')}’에서` : ''}${to.length ? `\n${out ? '나오는 단계' : '들어가는 단계'} · ${to.join(', ')}` : ''}${mark ? `\n${mark} · 기록이 이 포트와 단계를 잇지 않았다` : ''}` },
      h('span', { class: 'io-mark', 'aria-hidden': 'true' }, out ? '⇤' : '⇥'), h('span', { class: 'dv-port-name' }, x.name),
      mark ? h('span', { class: 'dv-unmapped' }, mark) : null, sign);
  };
  const stepBox = (s: (typeof chain.rows)[number]) => {
    const on = pickedStep?.part === id && pickedStep.name === s.name, sign = signChip(ds?.steps.get(s.index), `단계 ‘${s.name}’`), dec = decisions.filter(x => x.d.index === s.index);
    // A run gate that takes its exits from the condition rows lists this step's conditions itself (no second list on the box).
    const own = dec.some(x => x.d.source === 'conditions') ? [] : cp.steps.get(s.index) ?? [];
    // map-reading.14: a program step is a name only (stepFace: the chip, no does / uses area); a program port → step line ends at
    // the box with the chip (in at the head's start, out at its end); a uses item naming a 파일 지도 file shows its role on hover.
    const face = stepFace(s), progIn = chain.links.filter(l => l.step === s.index && l.direction === 'in' && linkFace(l).chipAt), progOut = chain.links.filter(l => l.step === s.index && l.direction === 'out' && linkFace(l).chipAt);
    const useRole = (u: string) => fileRoleOf(u, fileRoles);
    return h('li', { class: `${sign ? 'has-sign' : ''}${dec.length ? ' decision' : ''}`.trim() }, sign, h('button', { type: 'button', class: `dv-step${on ? ' on' : ''}${dec.length ? ' decision' : ''}${face.program ? ' program' : ''}`, 'data-step': String(s.index), 'aria-pressed': String(on),
      title: [`${s.index + 1}. ${s.name}`, face.hint ? `${PROGRAM_LABEL} · ${face.hint}` : null, face.does, face.uses.length ? `씀 · ${face.uses.map(u => { const f = useRole(u); return f ? `${u} (${f.role})` : u; }).join(', ')}` : null,
        s.ins.length ? `들어오는 포트 · ${s.ins.join(', ')}` : null, s.outs.length ? `나가는 포트 · ${s.outs.join(', ')}` : null,
        ...[...progIn, ...progOut].map(l => `포트 ‘${l.port}’ 대응 · ${PROGRAM_PORT_HINT}`), '눌러서 읽기면에 이 단계'].filter(Boolean).join('\n'),
      onclick: () => pickStep(id, s.name) },
      h('span', { class: 'dv-step-head' }, ...progIn.map(l => portChip('step', l.port)), h('span', { class: 'dv-step-n', 'aria-hidden': 'true' }, String(s.index + 1)), h('span', { class: 'dv-step-name' }, s.name),
        face.program ? stepChip() : null, dec.length ? h('span', { class: 'dv-diamond', role: 'img', 'aria-label': '판정 단계' }) : null,
        progOut.length ? h('span', { class: 'dv-prog-out' }, ...progOut.map(l => portChip('step', l.port))) : null),
      face.does ? h('span', { class: 'dv-step-does' }, face.does) : null,
      face.uses.length ? h('span', { class: 'dv-uses' }, ...face.uses.map(u => { const f = useRole(u);
        return h('span', { class: `dv-use${f ? ' has-role' : ''}`, title: f ? `${u}\n파일 지도 · ${f.path} · ${f.role}\n원문: “${f.quote.quote}”` : u }, u); })) : null,
      own.length ? h('span', { class: 'dv-conds', role: 'list', 'aria-label': '조건 출구' }, ...own.map(condEl)) : null), ...dec.map(gateAt));
  };
  const loop = r?.loop ?? null, vars = r?.stateVars ?? [];
  const chainEl = steps.length ? h('section', { class: 'xp-sec x-steps dv-chain' },
    h('h4', { class: 'xp-title', title: `기록 표의 행 순서. 단계 사이의 순서·분기는 기록에서 읽지 않아 단계끼리 잇지 않는다.${counts.program ? `\n+${counts.program} 프로그램 · ${PROGRAM_STEP_HINT}` : ''}` }, '기록된 단계',
      h('small', {}, counts.program ? `${counts.recorded} (+${counts.program} 프로그램)` : String(steps.length))),
    h('ol', { class: 'dv-steps' }, ...chain.rows.map(stepBox)), condsApart,
    chain.stray.length ? h('p', { class: 'dv-none', title: chain.stray.map(m => `${m.port} · ${m.step}`).join('\n') }, `포트·단계를 찾지 못한 대응 ${chain.stray.length}`) : null) : null;
  // Pipeline .44: every C-LOOP row of the part (the record's loop table), a nested one under the loop it runs in; the part's variants
  // (C-VARIANT rows: the implementing part, its choice condition and whether it goes beside the others).
  const recLoops = r?.recordLoops ?? [], variants = r?.variants ?? [];
  const loopRow = (l: (typeof recLoops)[number]) => `${recLoops.some(x => x.recordRef === l.parentRef) ? '└ ' : ''}${l.recordRef} · ${l.unit ?? '단위 미상'}${l.count ? ` · ${l.count}` : ''}${l.stop ? ` · 끝: ${l.stop}` : ''}`
    + (l.parentRef && !recLoops.some(x => x.recordRef === l.parentRef) ? ` · 안: ${l.parentRef}${l.parentPart ? ` ${l.parentPart}` : ''}` : '');
  const ordered: typeof recLoops = [], visit = (l: (typeof recLoops)[number]): void => { if (ordered.includes(l)) return; ordered.push(l); for (const x of recLoops) if (x.parentRef === l.recordRef) visit(x); };
  for (const l of recLoops) if (!recLoops.some(x => x.recordRef === l.parentRef)) visit(l);
  for (const l of recLoops) visit(l);
  const loopsEl = recLoops.length > 1 || (recLoops.length === 1 && !loop) ? h('ul', { class: 'xp-lines dv-loops', 'aria-label': '기록의 반복 표' },
    ...ordered.map(l => h('li', { title: `반복 표 ${l.recordRef}${l.body.length ? ` · 몸통 ${l.body.join(', ')}` : ''}\n원문: “${l.quote.quote}”` }, loopRow(l)))) : null;
  const TOGETHER: Record<string, string> = { exclusive: '배타', combined: '병용 가능', unknown: '병용 모름' };
  const variantsEl = variants.length ? h('section', { class: 'xp-sec dv-variants' }, h('h4', { class: 'xp-title' }, '변형', h('small', {}, String(variants.length))),
    h('ul', { class: 'xp-lines' }, ...variants.map(x => h('li', { title: `변형 표 ${x.recordRef} · 접점 ${x.interfaceRef}${x.selector.who ? ` · 고르는 이 ${x.selector.who}` : ''}${x.selector.when ? ` · ${x.selector.when}` : ''}\n원문: “${x.quote.quote}”` },
      `${x.recordRef} ${x.implementer === 'user' ? '사용자 지정' : x.implementer}${x.condition ? ` · ${x.condition}` : ''} · ${TOGETHER[x.together] ?? x.together}${x.togetherScope ? `(${x.togetherScope})` : ''}`)))) : null;
  const keepEl = loop || vars.length || recLoops.length ? h('section', { class: 'xp-sec dv-keep' },
    h('h4', { class: 'xp-title' }, (loop || recLoops.length) && vars.length ? '반복 · 유지 상태' : loop || recLoops.length ? '반복' : '유지 상태'),
    loop ? h('p', { class: 'dv-loop', title: loopLine(loop) }, ...loopNodes(loopSegs(r!))) : null, loopsEl,
    vars.length ? h('ul', { class: 'xp-lines dv-vars' }, ...vars.map(v => h('li', { ...(v.scope ? { title: `범위 · ${v.scope}` } : {}) }, stateVarLine(v), isProgram(v) ? ' ' : null, isProgram(v) ? progChip('유지 상태의 이름만') : null))) : null) : null;
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
    r && !r.inputs.length && !r.outputs.length && !r.fields.length && !r.config.length && !kids.length && !steps.length && !loop && !vars.length && !conds.length ? h('p', { class: 'dv-none' }, '내부 미상 · 기록이 안쪽을 말하지 않았다') : null,
    chainEl,
    r && !steps.length ? h('section', { class: 'xp-sec x-steps' }, h('h4', { class: 'xp-title' }, '단계'), h('p', { class: 'dv-none', title: '받는 것에서 내는 것까지의 단계를 기록이 아직 말하지 않았다. 포트와 단계는 잇지 않는다.' }, '기록된 단계 없음 · 진입 단계 미상'),
      runs.length ? h('p', { class: 'dv-none dv-gate-none', title: runs.map(g => `실행 관문 · ${g.text}`).join('\n') }, `실행 관문 ${runs.length} · 판정 단계 미상 · ${EXIT_BLANK}`) : null, condsApart) : null,
    keepEl, variantsEl,
    ...actionBody(p, true, x => signChip(ds?.cells.get(x), `필드 ‘${x}’`)),
    kids.length ? h('section', { class: 'xp-sec x-kids' }, h('h4', { class: 'xp-title' }, '구성', h('small', {}, String(kids.length))),
      h('div', { class: 'dv-kids' }, ...kids.map(k => h('button', { type: 'button', class: 'dv-kid', 'data-part-ref': k.id, title: `‘${k.name}’ 상세 열기`, onclick: () => openDetail(k.id, true) }, k.reading?.typeRead ? h('span', { class: 'node-type' }, TYPE_LABEL[k.reading.typeRead.type]) : null, h('span', {}, k.name))))) : null);
  const fam = r?.typeRead ? FAMILY_OF[r.typeRead.type] : 'neutral';
  v.replaceChildren(
    h('header', { class: 'dv-head' },
      h('div', { class: 'dv-title' }, h('span', { class: 'dv-kind' }, '내부 상세'), path.length ? h('span', { class: 'dv-where' }, `${path.join(' › ')} ›`) : null, h('h2', { class: 'dv-name' }, p.name),
        ds && (ds.project.length || ds.unplaced.length) ? h('span', { class: 'dv-view-signs' }, signChip(ds.project, '프로젝트 전체', `전체 규칙 ${ds.project.length}`),
          signChip(ds.unplaced, '배치 미정', `배치 미정 ${ds.unplaced.length}`, 'unplaced')) : null),
      h('div', { class: 'dv-moves', role: 'toolbar', 'aria-label': '내부 상세에서 나가기' },
        move('close', '닫기', 'Esc', 'Escape', true, '닫기 · 이 상세만 닫고 지도의 같은 선택으로', () => closeOpen(true)),
        move('back', '이전 읽기 위치', 'Alt ←', 'Alt+ArrowLeft', backStack.length > 0, backStack.length ? '이전 읽기 위치 · 이 상세를 열기 전의 카메라·선택·확대 단계·열림으로' : '이전 읽기 위치 없음', goBackPlace),
        move('up', parent ? `상위 구성 · ${parent.name}` : '상위 구성', 'Alt ↑', 'Alt+ArrowUp', !!parent, parent ? `상위 구성 · 이 부분을 실제로 담은 ‘${parent.name}’의 상세` : '상위 구성 없음 · 맨 위의 부분', goUp))),
    h('div', { class: 'dv-stage' }, h('div', { class: `dv-grid${steps.length ? ' has-steps' : ''}` },
      svg('svg', { class: 'dv-lines', 'aria-hidden': 'true' }),
      h('div', { class: 'dv-side s-in', role: 'list', 'aria-label': '들어오는 쪽의 바깥 부분' }, ...order(false).map(f => refCard(f, false))),
      h('div', { class: `dv-bound f-${fam}`, role: 'group', 'aria-label': `${p.name}의 경계` },
        svg('svg', { class: 'dv-lines dv-inlines', 'aria-hidden': 'true' }),
        h('div', { class: 'dv-bhead' }, r?.typeRead ? h('span', { class: 'node-type' }, TYPE_LABEL[r.typeRead.type]) : null, h('strong', { class: 'dv-bname' }, p.name), ops ? h('span', { class: 'xp-ops', title: ops.tip }, ops.full) : null,
          ds?.boundary.length ? h('span', { class: 'dv-scope-signs' }, signChip(ds.boundary, `‘${p.name}’ 전체`, `범위 규칙 ${ds.boundary.length}`),
            ds.open.length ? h('span', { class: 'sg-blank', title: '이 부분 전체에 미치는 규칙: 정확한 단계·포트·필드는 기록이 정하지 않았거나 이 지도에 그 자리가 없음' }, ds.open.length < ds.boundary.length ? `세부 접점 미정 ${ds.open.length}` : '세부 접점 미정') : null) : null),
        h('div', { class: `dv-inner${steps.length ? ' has-steps' : ''}` },
          h('ul', { class: 'dv-ports p-in', 'aria-label': '받는 것' }, ...(ins.length ? ins.map(x => portEl(x, false)) : [h('li', { class: 'dv-port blank' }, '받는 것 미기재')]), ...blankEls('write')),
          inner,
          h('ul', { class: 'dv-ports p-out', 'aria-label': '내는 것' }, ...(outs.length ? outs.map(x => portEl(x, true)) : [h('li', { class: 'dv-port blank' }, '내는 것 미기재')]), ...blankEls('exit')))),
      h('div', { class: 'dv-side s-out', role: 'list', 'aria-label': '나가는 쪽의 바깥 부분' }, ...order(true).map(f => refCard(f, true))))));
  detailLinks = ends.map(e => ({ ref: `${e.out ? 'o' : 'i'}|${e.far}`, port: `${e.out ? 'o' : 'i'}|${e.port}`, out: e.out, ch: e.ch, plain: e.rel.kind === 'related' }));
  // Inside the boundary, only where the record maps a line to a port and a step: the port to the step (in), the step to the port
  // (out), in the channel of the line it maps (the first one when several reach the same port and step).
  stepLinks = chain.links.map((l: ChainLink) => {
    const e = ends.find(x => l.relationIds.includes(x.rel.id));
    return { port: `${l.direction === 'out' ? 'o' : 'i'}|n:${l.port}`, step: l.step, out: l.direction === 'out', ch: e ? e.ch : 'data' as Channel | null, plain: e?.rel.kind === 'related', program: linkFace(l).dashed };
  });
  v.hidden = false; $('space').classList.add('detail-open');
  const vp = $('viewport'); if (!vp.inert) { vp.inert = true; vp.dataset.detailInert = '1'; }
  detailFor = { part: id, view: o.view, back: backStack.length };
  drawDetailLines();
  if (!again) v.focus({ preventScroll: true });
  // A rule chip's 「조건」 asked for one condition row: it is marked where it stands and brought into view.
  const pc = pendingCondition; if (pc?.part === id) { pendingCondition = null;
    const el = v.querySelector<HTMLElement>(`.dv-bound [data-cond="${pc.index}"]`);
    if (el) { el.classList.add('picked'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } }
}
/** The condition row a rule's 「조건」 chip opened (its part, its index in the part's conditions), waiting for the detail view. */
let pendingCondition: { part: string; index: number } | null = null;
/** 「조건」 on a rule's 적용 위치 (its anchor's row is a condition row of the part): the part's detail view with that condition marked. */
function openCondition(id: string, index: number) {
  const o = opened; if (!o || !partOf(o, id)) return;
  pendingCondition = { part: id, index };
  if (openState?.part === id && openState.mode === 'detail' && detailFor?.part === id) { renderDetail(id); return; }
  openDetail(id, true);
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
    inl.append(svg('path', { class: `dv-line in-step${l.ch ? ` c-${l.ch}` : ''}${l.plain ? ' plain' : ''}${l.program ? ' program' : ''}`, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, ...(l.plain ? {} : { 'marker-end': l.ch === 'data' ? 'url(#dv-arrow)' : 'url(#dv-open)' }) }));
  }
}
/** The detail view's links inside the boundary (steps-view detailChain): port key, step index, direction and channel. */
/** program (map-reading.14): the program made the correspondence: the line is dashed, its chip on the step box's end. */
let stepLinks: { port: string; step: number; out: boolean; ch: Channel | null; plain: boolean; program: boolean }[] = [];
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
    paneTab = 'structure'; // the steps read in 구조's 동작
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
  // A new view reads its first tier without hysteresis (card-budget zoomTier); the cards' boxes do not depend on it.
  opsRef = opsDay(o); if (cameraMode !== 'keep') tier = null;
  relayout(o);
  const world = $('world'), view = o.view;
  // Same view, new structure (a fold, a new part, 자동 배치): where every box and line was, so each slides to its new place.
  const was = cameraMode === 'keep' && !world.hidden && performance.now() - lastFresh > 600 ? beforeRedraw(world) : null;
  if (cameraMode !== 'keep') lastFresh = performance.now();
  world.replaceChildren();
  const edges = svg('svg', { class: 'edges', width: '1', height: '1', 'aria-hidden': 'true' });
  edges.append(endMarkDefs());
  // A line between two parts of the same group belongs to that group: it reads above the group's surface (a line between
  // groups stays under them, so it never seems to end at a group it only passes).
  const frames = (id: string) => { const out = new Set<string>(); for (let c = lay.boxes.get(id)?.container, g = 0; c && g < 64; c = lay.boxes.get(c)?.container, g++) if (lay.boxes.get(c)?.kind === 'frame') out.add(c); return out; };
  // A busy map at rest reads as its summary (summaryEdges: one line per pair of groups and kind, with its count); a selection,
  // the change plan or a map of a few lines draws each line. Both sets are drawn; .rest-sum on the space shows one of them.
  restSums = sums = lay.edges.length > 6 ? sumLines(o, summaryEdges(lay.boxes, lay.edges)) : [];
  const relInfo = relationLines(o.project), present = new Set<Channel>();
  lineWords = new Map(); lineChans = new Map(); lineTypes = new Map(); lineBadges = new Map(); lineMulti = new Set();
  for (const e of [...lay.edges, ...sums]) {
    const fa = frames(e.from), inner = [...frames(e.to)].some(f => fa.has(f)), sum = e.key.startsWith('sum:'), ch = edgeChannel(e, relInfo);
    if (ch) present.add(ch);
    if (ch !== 'uses' && new Set(e.ids.map(id => relInfo.get(id)?.payload).filter(Boolean)).size > 1) lineMulti.add(e.key);
    lineWords.set(e.key, lineWord(e, ch, relInfo)); lineChans.set(e.key, ch);
    const badge = lineBadge(e.ids.map(id => relInfo.get(id) ?? {})); if (badge) lineBadges.set(e.key, badge);
    // map-reading.13: a data line whose relations hand over one format artifact with its fields draws its label as a type chip.
    if (ch === 'data') { const fields = edgeFields(e.ids, relInfo); if (fields.length) lineTypes.set(e.key, { name: relInfo.get(e.ids[0]!)!.payload!, fields }); }
    // The line grammar (map design v3 6.1): the stroke and the head say the relation (data solid with a filled head, control
    // dashed with an open head, a reference dotted from its ear to a small V, a shared use dotted with ears, a plain relation
    // sparse dots with a dot at both ends); a planned, corrected or summary line keeps its kind's dash.
    const st = lineStyle(e.kind, ch);
    const g = svg('g', { class: `edge${sum ? ' sum' : ''} k-${e.kind}${ch ? ` c-${ch}` : ''} s-${st.stroke}${e.agg ? ' agg' : ''}${inner ? ' inner' : ''}${!sum && edgeRevised(e) ? ' revised' : ''}${e.spine ? ' spine' : ''}${!sum && e.notes.length && e.notes.every(plannedNote) ? ' planned' : ''}${badge ? ' badged' : ''}`, 'data-from': e.from, 'data-to': e.to, 'data-key': e.key, 'data-head': st.head, 'data-start': st.start });
    g.append(svg('path', { class: 'edge-line' }), svg('path', { class: 'edge-hit' }));
    edges.append(g);
  }
  world.append(edges);
  markLines();
  // The legend of the lens this map is read with (view-lens): what the map draws, counted.
  void present; loadLens(o); renderLegend();
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
  // Regions share one neutral surface (map design v3 2.1: a colour by order says nothing); what a group is reads in its head's
  // axis word (map-regions groupAxis), and a lifecycle group is the 실행 위치 미기록 shelf.
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
          h('span', { class: 'ghost-name' }, ...breakable(p.name))));
        continue;
      }
      world.append(h('button', { type: 'button', class: 'ghost', 'data-box': b.id, 'data-part-ref': id, title: `다른 곳의 부분 · ${path.join(' › ')} · 그곳으로 가기`, onclick: () => go(o.key, id, p.parentId) },
        h('span', { class: 'ghost-name' }, ...breakable(p.name))));
      continue;
    }
    const p = partOf(o, b.id)!, of = owner(p);
    if (b.kind === 'frame') {
      const latest = subtreeRecords(view, p.id)[0]?.at ?? null, region = b.depth === 0, axis = groupAxis(view, p.id), shelf = axis === 'lifecycle';
      const note = region && !shelf ? mapLead(view, p.id) : '', named = of ? `${of} › ${p.name}` : p.name;
      world.append(h('div', { class: `frame ${region ? 'region' : 'group'}${shelf ? ' shelf' : ''}${axis ? ` ax-${axis}` : ''} depth-${Math.min(b.depth, 2)}${b.depth % 2 ? ' tint' : ''}${b.list ? ' list' : ''}`, 'data-part': p.id, 'data-box': p.id },
        h('div', { class: `frame-head s-${p.status}${b.head > HEAD ? ' tall' : ''}`, style: `height:${b.head}px`, 'data-part': p.id, 'data-drag': p.id, role: 'button', tabindex: '0', title: shelf ? `${SHELF_TIP}\n원문 분류: ${p.name}` : named, onkeydown: keySelect(p.id) },
          toggleButton(p, true),
          // A change line reads under the name (in the preview only), never beside it: the name keeps the whole head width. The
          // axis word says what the group is when it is known; the shelf's title is exactly what the record did not say.
          // An open container keeps its own loop's badges on its head, after its name and giving way before it (4.1 'both', 4.3:
          // each layer its own); its steps read in 동작.
          h('span', { class: 'frame-title' }, isContainerPart(o, p.id) && p.reading?.loop && !shelf
            ? h('span', { class: 'frame-name-row' }, h('span', { class: 'frame-name' }, axis ? h('span', { class: 'frame-axis' }, AXIS_WORD[axis]) : null, p.name), h('span', { class: 'frame-loop', title: `반복 · 기록의 글자 그대로\n단위 ${p.reading.loop.unit ?? '미상'} · 정지 ${p.reading.loop.stop ?? '미상'}\n단계는 동작 열기에서 (구성과 동작은 다른 층)` },
              h('span', { class: `w-badge${p.reading.loop.unit ? '' : ' blank'}` }, p.reading.loop.unit ?? '반복 단위 ?'), h('span', { class: `w-badge stop${p.reading.loop.stop ? '' : ' blank'}` }, p.reading.loop.stop ? `정지 · ${p.reading.loop.stop}` : '정지 조건 ?')))
            : h('span', { class: 'frame-name' }, axis && !shelf ? h('span', { class: 'frame-axis' }, AXIS_WORD[axis]) : null, shelf ? SHELF_TITLE : p.name), h('span', { class: 'plan-note' })),
          h('span', { class: 'frame-meta' }, latest ? h('span', { class: recentAt(latest) ? 'fresh' : '' }, ago(latest)) : null),
          linksChip(p.id), enterButton(p), note ? h('span', { class: 'frame-note' }, note) : null)));
    } else {
      // A folded part reads its inside: latest record anywhere under it.
      const last = b.kids ? subtreeRecords(view, p.id)[0]?.at ?? null : p.lastAt, meta = metaLine(p, last), face = b.face ?? 'row';
      const box = lay.boxes.get(b.container), onTint = box?.kind === 'frame' && box.depth % 2 === 1, alias = aliasOf(view, p.id);
      const title = `${of ? `${of} › ` : ''}${p.name}${alias ? ` · ${alias}` : ''}`;
      // A part a reading spoke of, as a unit or as a row in a group: its typed card (map design v3 3), the box its template was
      // measured for. A list item keeps its one line.
      const tpl = face === 'item' ? undefined : cardTpls.get(p.id);
      if (tpl && p.reading) {
        world.append(cardEl(o, p, p.reading, tpl, face, { cls: `${onTint ? 'on-tint ' : ''}s-${p.status}${recentAt(last) ? ' fresh' : ''}`, title, onkeydown: keySelect(p.id),
          toggle: b.kids ? toggleButton(p, false) : null, links: b.kids ? linksChip(p.id) : null, enter: b.kids ? enterButton(p) : null, boxH: b.h, filed: filedUnder(view, p.id) }));
        continue;
      }
      // An untyped card (no reading): its name, its own first sentence on a unit without an inside, and its state line.
      const note = face === 'unit' && !b.kids ? mapLead(view, p.id) : '', nameEl = h('span', { class: 'node-name' }, p.name);
      world.append(h('div', { class: `node ${face}${onTint ? ' on-tint' : ''} s-${p.status}${recentAt(last) ? ' fresh' : ''}${b.kids ? ' has-kids' : ''}${meta || of ? '' : ' bare'}`, 'data-part': p.id, 'data-box': p.id, 'data-drag': p.id, role: 'button', tabindex: '0',
        title, onkeydown: keySelect(p.id) },
        b.kids ? toggleButton(p, false) : null,
        h('span', { class: 'node-text' }, nameEl,
          note ? h('span', { class: 'node-note' }, note) : null,
          meta ? h('span', { class: 'node-meta' }, ladder(view, p), h('span', { class: 'meta-text' }, meta)) : alias ? h('span', { class: 'node-meta owner alias' }, h('span', { class: 'meta-text' }, alias)) : of ? h('span', { class: 'node-meta owner' }, h('span', { class: 'meta-text' }, `${of} 안`)) : null,
          h('span', { class: 'plan-note' })),
        b.kids ? linksChip(p.id) : null, b.kids ? enterButton(p) : null));
    }
  }
  // The title of this map: what the scope is for, in its own first sentence. The rest of that text (where it comes from, what
  // was checked) reads in full in the pane on request; nothing of it is cut or reworded. Inside a part, the scope's own
  // relations to the outside read under the title as the scope's, never drawn as lines from one of its children.
  const sp = partOf(o, scope), purpose = (sp ? sp.note : o.project.space.brief?.text ?? '').trim(), first = lead(purpose);
  const outside = scopeEnds(o), more = purpose.replace(/\s+/g, ' ').length > first.length + 1, basis = basisLine(o);
  // The basis line reads under the purpose; with no purpose the reading's sentence stands in its place, and the basis under it.
  // A calm head (map design v3 9): the summary (two lines at most, with its way to more), one meta line, one row of chips (the main
  // flow, the rules, the since filter, the state counts); a chosen scenario's line under it.
  const chips = [flowStrip(o), rulesStrip(o), sinceStrip(o), stateStrip(o)].filter((x): x is HTMLElement => !!x);
  const title = h('header', { class: 'map-title' }, h('h1', { class: 'map-name' }, sp ? sp.name : o.project.name),
    first ? h('p', { class: 'map-purpose' }, h('span', {}, first), more ? h('button', { type: 'button', class: 'map-more', title: '설명 전체와 출처', onclick: () => openScopeReading() }, '설명 전체') : null) : null,
    sp ? null : understoodLine(o),
    basis,
    chips.length ? h('div', { class: 'map-chips' }, ...chips) : null, scenarioStrip(o),
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
  morphFrom = null;
  if (was) afterRedraw(world, was);
  drawScenario();
  applySince();
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
  // The legend opens unless it would cover a card here (then it starts as its chip, and the fit keeps cards clear of the chip).
  if (cameraMode !== 'keep' && syncLegendFold() && !saved) fitView(false);
  fitCards();
  if (planOverlay) planView.overlay();
  applyReadMarks();
  applyLens();
  if (openState) syncOpenSoon();
}

/** The scope's own parts that no line touches, under one caption: not a flow that lost its lines, just parts apart. Drawn
 * when the scope has such parts beside linked ones; placed above the topmost-leftmost of them and moved with them. */
let loneIds: string[] = [];
function placeLoneHead(crossing?: Map<string, { all: number }>) {
  const world = $('world'), here = scope ?? ROOT, touched = new Set(lay.edges.flatMap(e => [e.from, e.to]));
  const banded = new Set(Object.values(lay.bands).flat()), own = [...lay.boxes.values()].filter(b => b.container === here && b.kind !== 'ghost' && !banded.has(b.id));
  loneIds = crossing ? own.filter(b => !touched.has(b.id) && !(crossing.get(b.id)?.all)).map(b => b.id) : loneIds;
  world.querySelector('.lone-head')?.remove();
  if (!loneIds.length || loneIds.length === own.length) return;
  // A placement, not a group of the record: the caption says what the parts share (no line), in the band captions' quiet style.
  const el = h('div', { class: 'lone-head', 'aria-hidden': 'true' }, `이은 선 없음 · ${loneIds.length}`);
  world.append(el); moveLoneHead();
}
/** The scope's bands (map design v3 2.1, map-layout placeBands): the 참여자 caption over the outside roles' column (no outline, no
 * surface) and the quiet system boundary: a 1px solid line between the middle and the external systems, its caption at its top.
 * Placed from the boxes (a drag moves them with their parts); nothing is drawn for an empty band. */
function placeBands() {
  const world = $('world'); world.querySelectorAll('.band-head, .band-line').forEach(x => x.remove());
  const rect = (ids: string[]) => { const bs = ids.map(id => lay.boxes.get(id)).filter((b): b is Box => !!b); if (!bs.length) return null;
    const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y)); return { x, y, x2: Math.max(...bs.map(b => b.x + b.w)), y2: Math.max(...bs.map(b => b.y + b.h)) }; };
  const out = rect(lay.bands.outside), ext = rect(lay.bands.boundary);
  if (out) world.append(h('div', { class: 'band-head band-outside', title: OUTSIDE_TIP, style: `left:${out.x}px;top:${out.y - 22}px` }, OUTSIDE_TITLE));
  if (ext) {
    const banded = new Set(lay.bands.boundary), rest = [...lay.boxes.values()].filter(b => b.kind !== 'ghost' && !banded.has(b.id) && b.container === (scope ?? ROOT));
    const midR = rest.length ? Math.max(...rest.map(b => b.x + b.w)) : ext.x - 48, x = Math.round((Math.max(midR, ext.x - 96) + ext.x) / 2);
    const top = Math.min(ext.y, ...rest.map(b => b.y)) - 22, bottom = Math.max(ext.y2, ...rest.map(b => b.y + b.h));
    world.append(h('div', { class: 'band-line', 'aria-hidden': 'true', style: `left:${x}px;top:${top}px;height:${bottom - top}px` }),
      h('div', { class: 'band-head band-boundary', title: BOUNDARY_TIP, style: `left:${ext.x}px;top:${ext.y - 22}px` }, BOUNDARY_TITLE));
  }
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
  moveLoneHead(); placeBands();
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
/** Line labels (and type chips) follow the zoom a little (line-grammar labelPx: 11–14px on screen), by --linv: their scale. */
const lineInv = () => parseFloat($('space').style.getPropertyValue('--linv')) || labelInv();
/** The tier the labels were last placed for (a change of tier places them again: what the lines carry depends on it). */
let placedTier: ZoomTier | null = null;
/** The head of a relation's note for the line it is drawn on: its first clause, at most 30 characters. */
function noteHead(n: string): string {
  const t = n.replace(/\s+/g, ' ').trim(), m = /^(.{8,40}?)(?:[,.;](?=\s|$)|$)/.exec(t), c = (m ? m[1]! : t).trim();
  return c.length > 30 ? `${c.slice(0, 29)}…` : c;
}
/** Labels on the map (spec 2.3): at rest every drawn line carries its one-line label (placeRestLabels); with a selection, the
 * selection's lines carry theirs. Each sits at a free spot along its own line; a label that would cover a part, a group's
 * head, the title or another label is left off the map (the pane lists every relation by its verb). Nothing is drawn for a
 * relation the project does not hold. */
function placeEdgeLabels() { placeLineLabels(); placeScenarioMarks(); applyLegendMarks(); }
function placeLineLabels() {
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
  // A line's text badge (6.2–6.3) outranks every label but the selection's: at rest the badges go first, beside a selection
  // right after the selection's own labels. One badge per drawn line that has one is always set (never silently dropped).
  const drawnNow = shownLines(), badged = [...world.querySelectorAll<SVGGElement>('.edge.badged')].filter(g => drawnNow.has(g.dataset.key!) && !g.classList.contains('hit'));
  if (!selected && !planView.isOpen()) {
    const drawn = drawnNow, seenEnd = new Set<string>();
    placeBadges(box, badged, clear, blocks, drawn);
    // By zoom tier (map design v3 5.5, line-grammar restLabels): the overview keeps only counts and condition badges, the middle
    // tier short labels on the main flow and a scenario path, near every label in full. Labels only show or hide.
    const mode = restLabels(tier);
    placedTier = tier;
    if (mode === 'counts') { placeCounts(box, clear, blocks, false, drawn, true); return; }
    const rest = [...world.querySelectorAll<SVGGElement>('.edge')].filter(g => drawn.has(g.dataset.key!) && !g.classList.contains('hit'))
      .filter(g => restLabelShown(mode, { spine: g.classList.contains('spine'), path: g.classList.contains('sc-path') })).filter(g => {
        const e = edgeOf(g.dataset.key); if (!e) return false;
        const k = `${e.to}|${e.kind}|${lineChans.get(e.key) ?? ''}|${restWord(e)}`; if (seenEnd.has(k)) return false;
        seenEnd.add(k); return true;
      });
    if (rest.length) placeRestLabels(box, rest, clear, mode === 'short');
    return;
  }
  placedTier = tier;
  if (!selected) { placeBadges(box, badged, clear, blocks, drawnNow); if (lines.length) placeRestLabels(box, lines, clear); return; }
  const shown = shownLines();
  for (const g of lines) {
    const e = lay.edges.find(x => x.key === g.dataset.key), path = g.querySelector<SVGPathElement>('.edge-line'); if (!e || !path) continue;
    const on = g.classList.contains('on'), fan = on && (fans.get(selKey(e)) ?? 0) > 1;
    if (on && seenSel.has(selKey(e))) continue;
    // A line carrying a format artifact's fields reads as its type chip where one of its forms finds room; else as its verb.
    const tp = fan ? undefined : lineTypes.get(e.key);
    if (tp) { const at = placeTypeChip(box, e, tp, edgePts(e.key, path), 'long', r => clear(r) && !lineUnder(r, e.key, shown), on);
      if (at) { blocks.push(at); if (on) seenSel.add(selKey(e)); continue; } }
    const verb = `${wordOf(e)}${!fan ? countOf(e) : ''}${edgeRevised(e) ? REVISED_EDGE : ''}`;
    // The selection's line says what it hands over (the head of its note) where its runs have room; the verb alone otherwise.
    // (Not when the line's own label already says the same words, as a payload often does.)
    const head = on && !fan && e.notes.length === 1 && !plannedNote(e.notes[0]!) ? noteHead(e.notes[0]!) : '', said = head === wordOf(e) ? '' : head;
    const label = h('span', { class: `edge-label k-${e.kind}${on ? ' on' : ''}${edgeRevised(e) ? ' revised' : ''}`, 'data-key': e.key }, verb);
    box.append(label);
    const inv = lineInv(), pts = edgePts(e.key, path), len = path.getTotalLength(), prefer = fan ? (e.to === selected ? 'end' : 'start') : 'long';
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
  placeBadges(box, badged, clear, blocks, shown);
  // The dimmed summary beside the selection keeps its counts (what each line still holds), after the selection's verbs.
  if ($('space').classList.contains('sel-sum')) placeCounts(box, clear, blocks, true, shown);
}
/** The text badges of the drawn lines that have one (line-grammar lineBadge, map design v3 6.2): on the line's first runs from
 * the port it leaves, at the first place clear of parts, heads, the title, the labels set so far and other lines; with none, at
 * its first place all the same (.forced): a line whose record says when it flows never reads as one that always flows. A
 * selected line's badge reads whole and taller (its full words, the mode as read); its line's own badges are set first. */
function placeBadges(box: HTMLElement, lines: SVGGElement[], clear: (r: Rect) => boolean, blocks: Rect[], shown: Set<string>) {
  const parts: Rect[] = [...lay.boxes.values()].map(b => (b.kind === 'frame' ? { x: b.x, y: b.y, w: b.w, h: b.head } : b));
  const offParts = (r: Rect) => !parts.some(o => r.x < o.x + o.w + 2 && o.x < r.x + r.w + 2 && r.y < o.y + o.h + 2 && o.y < r.y + r.h + 2);
  const mine: Rect[] = [], inv = labelInv(), order = [...lines].sort((a, b) => Number(b.classList.contains('on') || b.classList.contains('sc-path')) - Number(a.classList.contains('on') || a.classList.contains('sc-path')));
  const apart = (r: Rect) => !mine.some(o => r.x < o.x + o.w + 2 && o.x < r.x + r.w + 2 && r.y < o.y + o.h + 2 && o.y < r.y + r.h + 2);
  const set = (el: HTMLElement, spot: Rect) => { mine.push(spot); el.style.left = `${spot.x}px`; el.style.top = `${spot.y}px`; blocks.push(spot); };
  const nameOf = (id: string) => (opened ? partOf(opened, id.startsWith('ghost:') ? id.slice(6) : id)?.name ?? '부분' : '부분');
  /** Badges with no place of their own, by the part their line leaves: they gather in one 「+N」 marker there. */
  const over = new Map<string, { e: Edge; b: LineBadge; path: SVGPathElement }[]>();
  for (const g of order) {
    const e = edgeOf(g.dataset.key), b = e && lineBadges.get(e.key), path = g.querySelector<SVGPathElement>('.edge-line'); if (!e || !b || !path) continue;
    const on = g.classList.contains('on') || g.classList.contains('sc-path'), beside = !!selected && !on;
    const el = h('span', { class: `edge-badge b-${b.kind}${on ? ' on' : ''}${beside ? ' beside' : ''}${b.unresolved ? ' unres' : ''}`, 'data-badge': e.key, title: b.tip });
    box.append(el);
    const pts = edgePts(e.key, path), len = path.getTotalLength();
    const find = () => { const w = el.offsetWidth * inv, hh = el.offsetHeight * inv;
      return { spots: labelSpots(pts, w, hh, 'start'), along: Array.from({ length: 13 }, (_, i) => path.getPointAtLength(len * (0.04 + i * 0.075))).map(p => ({ x: p.x - w / 2, y: p.y - hh / 2, w, h: hh })) }; };
    // The record's words first (selected: longer, with the mode), then clipped, then the rhythm glyph (a condition: 조건), each at
    // the line's first runs from the port it leaves, clear of parts, heads, the title, the labels and badges set so far (other
    // lines too when it can). Never the bare word 박자: the words read in the tip.
    const forms = badgeForms(b, on, tier);
    let spot: Rect | null = null;
    for (const text of forms) {
      el.textContent = text; el.classList.toggle('glyph', text === BADGE_GLYPH); el.classList.toggle('short', text !== forms[0]);
      const f = find(); spot = f.spots.find(r => clear(r) && !lineUnder(r, e.key, shown)) ?? f.spots.find(clear) ?? null;
      if (spot) break;
    }
    // Forced: its smallest form anywhere on its line off every part and every badge set so far, over other lines or labels if it
    // must (a line whose record says when it flows never reads as one that always flows). A part's name is never covered.
    if (!spot) { const f = find(); spot = [...f.spots, ...f.along].find(r => offParts(r) && apart(r)) ?? null; if (spot) el.classList.add('forced'); }
    if (!spot) { el.remove(); const k = e.from; (over.get(k) ?? over.set(k, []).get(k)!).push({ e, b, path }); continue; }
    set(el, spot);
  }
  // The overflow: one 「+N」 per part, its lines' words in the tip, on one of those lines or just outside the part, off every part and
  // every badge (never stacked on another).
  for (const [from, list] of over) {
    const el = h('span', { class: 'edge-badge b-more', 'data-badge-more': from, title: `자리가 없어 모은 배지 ${list.length}개 · 기록의 글자 그대로\n${list.map(x => `${nameOf(x.e.from)} → ${nameOf(x.e.to)} · ${x.b.short}`).join('\n')}` }, overflowMark(list.length));
    box.append(el);
    const w = el.offsetWidth * inv, hh = el.offsetHeight * inv, at = lay.boxes.get(from);
    const along = list.flatMap(x => { const n = x.path.getTotalLength(); return Array.from({ length: 9 }, (_, i) => x.path.getPointAtLength(n * (0.08 + i * 0.1))).map(p => ({ x: p.x - w / 2, y: p.y - hh / 2, w, h: hh })); });
    const around = at ? Array.from({ length: 8 }, (_, i) => [{ x: at.x + at.w + 6, y: at.y + i * (hh + 4), w, h: hh }, { x: at.x - w - 6, y: at.y + i * (hh + 4), w, h: hh }, { x: at.x + i * (w + 4), y: at.y + at.h + 6, w, h: hh }]).flat() : [];
    let spot = [...along, ...around].find(r => clear(r)) ?? [...along, ...around].find(r => offParts(r) && apart(r)) ?? null;
    // Last: down from under the part until it is apart from every badge (always found).
    for (let i = 0; !spot && at && i < 60; i++) { const r = { x: at.x, y: at.y + at.h + 6 + i * (hh + 4), w, h: hh }; if (apart(r)) spot = r; }
    if (!spot) { el.remove(); continue; }
    set(el, spot);
  }
}
/** How many relations a summary line holds, on the line where it reads clear of parts (a line of one relation has none).
 * Beside a selection (dimmed, .beside) a count that finds no clear place is left off rather than set over a part or a verb. */
function placeCounts(box: HTMLElement, clear: (r: Rect) => boolean, blocks: Rect[], beside = false, shown = shownLines(), every = false) {
  // Beside a selection a count also keeps off the selection's own lines, where it would read as theirs.
  const onPts = beside ? [...$('world').querySelectorAll<SVGPathElement>('.edge.on .edge-line')].flatMap(p => { const n = p.getTotalLength(); return Array.from({ length: Math.ceil(n / 6) + 1 }, (_, i) => p.getPointAtLength(Math.min(n, i * 6))); }) : [];
  const off = (r: Rect) => clear(r) && !onPts.some(q => q.x > r.x - 4 && q.x < r.x + r.w + 4 && q.y > r.y - 4 && q.y < r.y + r.h + 4);
  // every: the overview's counts (5.5): each drawn line holding several relations, a summary line or not.
  const gs = every ? [...$('world').querySelectorAll<SVGGElement>('.edge:not(.hit)')].filter(g => shown.has(g.dataset.key!)) : [...$('world').querySelectorAll<SVGGElement>('.edge.sum:not(.hit)')];
  for (const g of gs) {
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
  return `${w}${countOf(e)}${edgeRevised(e) ? REVISED_EDGE : ''}`;
}
/** How many relations a stroke holds, after its label: ' 3' when they hand over one thing (or name none); nothing when the label
 * already names them ('a · b +1', line-grammar multiWord). */
function countOf(e: Edge): string {
  return e.ids.length < 2 || lineMulti.has(e.key) ? '' : ` ${e.ids.length}`;
}
/** A line's type chip (map spec 2.4, 타입 칩 = 산출물 이름): the artifact's name and up to three of its fields, one cell each, '+N'
 * for the rest (line-view typeChipForms), in an accent outline; a click picks the line (its fields read in the pane under 데이터 계약). */
function typeChipEl(e: Edge, tp: { name: string; fields: string[] }, on = false): HTMLElement {
  return h('button', { type: 'button', tabindex: '-1', class: `edge-label type-chip k-${e.kind}${on ? ' on' : ''}${edgeRevised(e) ? ' revised' : ''}`, 'data-type-chip': e.key, 'data-key': e.key,
    title: `데이터 계약 · ${tp.name} · ${tp.fields.length} 필드
${tp.fields.join(' · ')}
눌러서 읽기면에 필드`, onclick: (ev: Event) => { ev.stopPropagation(); pickLine(e); } });
}
function fillTypeChip(chip: HTMLElement, f: ChipForm) {
  chip.setAttribute('aria-label', chipText(f));
  chip.replaceChildren(h('span', { class: 'tc-name' }, f.name), ...f.cells.map(c => h('span', { class: 'tc-cell' }, c)), ...(f.more ? [h('span', { class: 'tc-more' }, `+${f.more}`)] : []));
}
/** Places a line's type chip at the first place its widest fitting form finds (the verb's places and rules), or none (null: the
 * caller sets the plain verb instead). */
function placeTypeChip(box: HTMLElement, e: Edge, tp: { name: string; fields: string[] }, pts: Point[], prefer: 'long' | 'end' | 'start', free: (r: Rect) => boolean, on: boolean): Rect | null {
  const chip = typeChipEl(e, tp, on), inv = lineInv(); box.append(chip);
  for (const form of typeChipForms(tp.name, tp.fields)) {
    fillTypeChip(chip, form);
    const spot = labelSpots(pts, chip.offsetWidth * inv, chip.offsetHeight * inv, prefer).find(free);
    if (spot) { chip.style.left = `${spot.x}px`; chip.style.top = `${spot.y}px`; return spot; }
  }
  chip.remove(); return null;
}
/** A line picked on the map (its line or its type chip): the part it leaves is selected, and that relation's pane row reads its
 * whole block (넘기는 것 · 박자 · 방식 · 채널 · 데이터 계약 · 원문). */
function pickLine(e: Edge) {
  const o = opened; if (!o) return;
  const ghost = e.from.startsWith('ghost:'), from = ghost ? e.from.slice(6) : e.from;
  pickedLine = { rels: [...e.ids], part: from };
  // The line's block reads in 구조's 계약 (map design v3 8.3), open.
  if (from === selected) { paneTab = 'structure'; refreshReading(); } else go(o.key, from, ghost ? partOf(o, from)?.parentId ?? null : scope);
}
/** Labels at rest: each on a straight run of its own line with room for it and 8px of line on each side (the longest level
 * run first), else beside the line just short of the part it points to; never on a corner, over another line (where lines
 * cross), a part, a head or the title. Two that would touch keep the one with the better place (the first line on a tie),
 * the other takes its next place; a label with none left is hidden until its line is selected (.label-hidden, still hovered
 * for its meaning), counted in the map's data-labels-hidden. Fonts never shrink to make room. */
const REST_PAD = 8;
function placeRestLabels(box: HTMLElement, lines: SVGGElement[], clear: (r: Rect) => boolean, short = false) {
  const spots: (LabelSpot & { el: HTMLElement })[] = [], hidden: SVGGElement[] = [], shown = shownLines(), inv = lineInv();
  for (const g of lines) {
    const e = edgeOf(g.dataset.key), path = g.querySelector<SVGPathElement>('.edge-line'); if (!e || !path) continue;
    const pts = edgePts(e.key, path), free = (r: Rect) => clear(r) && !lineUnder(r, e.key, shown);
    const spotsFor = (el: HTMLElement) => { const w = el.offsetWidth * inv, hh = el.offsetHeight * inv;
      return [...labelSpots(pts, w, hh, 'long', REST_PAD).filter(free).slice(0, 10), ...portSpots(pts, w, hh).filter(r => free(r) && !polylineHitsRect(pts, r, 1))]; };
    // A type chip (map-reading.13) takes its widest form that has a place; with none it gives way to the plain label.
    let label: HTMLElement | null = null, mine: Rect[] = [];
    // short (the middle tier): the plain label cut to LABEL_SHORT characters, its whole words in its tip; no type chip.
    const tp = short ? undefined : lineTypes.get(e.key);
    if (tp) { const chip = typeChipEl(e, tp); box.append(chip);
      for (const form of typeChipForms(tp.name, tp.fields)) { fillTypeChip(chip, form); mine = spotsFor(chip); if (mine.length) break; }
      if (mine.length) label = chip; else chip.remove(); }
    if (!label) { const word = restWord(e), cutWord = short ? shortLabel(word) : word;
      label = h('span', { class: `edge-label k-${e.kind}${edgeRevised(e) ? ' revised' : ''}${short ? ' brief' : ''}`, 'data-key': e.key, ...(cutWord !== word ? { title: word } : {}) }, cutWord); box.append(label); mine = spotsFor(label); }
    if (!mine.length) { label.remove(); hidden.push(g); continue; }
    // The protected order first (6.3: a path's labels, the spine's, a line naming what it hands over or what starts it, the rest),
    // then better places across all labels: every label's first place before any label's second.
    const word = wordOf(e), said = word !== (REL_LABEL[e.kind] ?? e.kind) && word !== '제어' && word !== '참조';
    const rank = labelRank({ path: g.classList.contains('on') || g.classList.contains('sc-path'), spine: g.classList.contains('spine'), said });
    mine.forEach((r, i) => spots.push({ key: e.key, ...r, dist: i, rank, el: label }));
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
/** The wheel and the buttons zoom between ZOOM_MIN and ZOOM_MAX; only 전체 보기 goes further out, down to the dot map (FIT_MIN, map
 * design v3 5.1), and a zoom from there keeps on from where it is. */
const ZOOM_MIN = 0.4, ZOOM_MAX = 1.6, OPEN_MIN = 0.6, FIT_MIN = 0.2;
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
  // The zoom tier (점 지도 · 개요 · 중간 · 가까이, map design v3 5.1): what a typed card shows inside its box, and the on-screen
  // floors of its type (5.2). The boxes, the lines and their ends stay where they are: nothing is laid out again for a zoom.
  tier = zoomTier(camera.k, tier);
  for (const t of ['dots', 'far', 'mid', 'near'] as const) sp.classList.toggle(`tier-${t}`, tier === t);
  const T = tierText(camera.k, tier), px = (n: number) => `${n.toFixed(2)}px`;
  for (const [v, n] of [['title', T.title], ['title-lh', T.titleLh], ['kind', T.kind], ['kind-lh', T.kindLh], ['row', T.row], ['row-lh', T.rowLh], ['label', T.label], ['bottom', T.bottom], ['glyph', T.glyph], ['gap', T.gap]] as const) sp.style.setProperty(`--t-${v}`, px(n));
  if (!fitFrame) fitFrame = requestAnimationFrame(fitCards);
  sp.style.setProperty('--grow', String(Math.min(1.25, Math.max(1, 0.85 / camera.k))));
  // The line grammar is drawn in screen pixels (map design v3 6.1): --u is one screen pixel in map units, so widths, dashes and
  // the hit band keep their size on screen at every zoom, and the heads and ears with them (syncMarks).
  sp.style.setProperty('--u', (1 / camera.k).toFixed(4)); syncMarks(camera.k);
  // Chips on the lines (labels, badges, counts) keep their screen size (5.2: line labels 13px on screen, badges ≥16px high);
  // their places are found again when the scale changed enough to matter.
  const inv = Math.min(1 / 0.3, Math.max(0.625, 1 / camera.k));
  sp.style.setProperty('--inv', inv.toFixed(3));
  // Line labels follow the zoom a little (11–14px on screen, line-grammar labelPx): never heavier than a card's name far out.
  sp.style.setProperty('--linv', (labelPx(camera.k) / (13 * camera.k)).toFixed(3));
  if ((Math.abs(inv - placedInv) / placedInv > 0.08 || tier !== placedTier) && opened && !relabel) { relabel = requestAnimationFrame(() => { relabel = 0; placedInv = inv; placeEdgeLabels(); }); }
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
  const w = Math.max(200, vp.width - left - right), hgt = Math.max(160, mapBottom() - top - bottom), B = drawnBounds();
  const fit = Math.min(1, w / Math.max(1, B.w + 40), hgt / Math.max(1, B.h + 40));
  const k = explicit ? Math.max(FIT_MIN, fit) : Math.max(OPEN_MIN, fit);
  // The whole view sits in the middle of the free area, both ways: the title and the parts together. A reading pane opened
  // later pans the map by the least amount that keeps the selected part in view (reveal), so no room is kept for it here.
  const mw = B.w * k, mh = B.h * k, free = w - mw;
  const xoff = free <= 0 ? 12 : free / 2;
  const yoff = mh <= hgt ? (hgt - mh) / 2 : 12;
  camera = { k, x: left + xoff - B.x * k, y: top + yoff - B.y * k };
  applyCamera(animate);
}
/** What the map draws, in map px: the layout's bounds (boxes, heads, the title) with every drawn element that can reach past them
 * (the band captions and the boundary line, the outside partners' heads, a caption's own text, the lines' routes), so 전체 보기
 * shows all of it. */
function drawnBounds(): Rect {
  const world = $('world'), rs: Rect[] = [lay.bounds];
  world.querySelectorAll<HTMLElement>(':scope > [data-box], :scope > .ghost-head, :scope > .band-head, :scope > .band-line, :scope > .lone-head, :scope > .map-title').forEach(el => {
    if (el.hidden || getComputedStyle(el).display === 'none') return;
    const x = parseFloat(el.style.left), y = parseFloat(el.style.top); if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    rs.push({ x, y, w: Math.max(el.offsetWidth, el.scrollWidth), h: Math.max(el.offsetHeight, el.scrollHeight) });
  });
  for (const r of lastRouted.values()) if (r.pts.length) { const xs = r.pts.map(p => p.x), ys = r.pts.map(p => p.y); rs.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }); }
  return unionRect(rs) ?? lay.bounds;
}
function zoomAt(k: number, cx: number, cy: number, animate = false) {
  const nk = Math.min(ZOOM_MAX, Math.max(Math.min(ZOOM_MIN, camera.k), k));
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
  // The first tab follows the way in (map design v3 8.1): a card → 구조, a sign tab → 구조 or 이력, a record opened from the recent
  // list → 근거 (where the wide mode lists the records whole).
  if (changed) { paneTab = pendingRecord ? 'evidence' : pendingTab ?? entryTab('card'); pendingTab = null; evReturn = []; disputing = null; hidePreview(); }
  if (changed) { editing = false; composerOpen = false; if (ask && !ask.controller) ask = null; sheetOpen = !!pendingRecord; pickedStep = null; if (pickedLine && pickedLine.part !== partId) pickedLine = null; if (signOpen && signOpen.part !== partId) { signOpen = null; signFocus = false; markSignTabs(); } }
  if (!!selected !== !!partId) recentPeek = false;
  if (partId) scopeReading = false;
  selected = partId;
  if (opened) renderRecent();
  markSelection(partId);
  $('space').classList.toggle('dim', dimNow());
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
  if (pendingRecord) { const id = pendingRecord; pendingRecord = null; if (paneTab !== 'evidence' || !sheetOpen) { paneTab = 'evidence'; if (!sheetOpen) openSheet(); else renderPanel(false); } openRecord(id); }
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
const mapBottomInset = () => BOTTOM + legendInset();
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
/** 조건 선택 (spec §7): the branch condition chosen on a designed path, and the design path under it (scenario-view conditionPath:
 * its lit links and reached visits; the other branch and what follows only from it step back). null: every branch. */
let scCond: string | null = null, scCondPath: ReturnType<typeof conditionPath> | null = null;
/** How many run gates (spec 5.2: 실행 관문, on the path) a part's reading carries. */
const runGates = (o: Opened, areaId: string) => { const r = partOf(o, areaId)?.reading; return r ? gateSplit(signsOf(r).gates).run.length : 0; };
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
    // 조건 선택: a designed path's branch conditions as chips (one at a time; again: every branch); an observed run says it offers none.
    const cc = conditionChoice(u), cur = scCond && cc.conditions.includes(scCond) ? scCond : null;
    if (cc.offer) el.append(h('div', { class: 'sc-conds', role: 'group', 'aria-label': '조건 선택 · 그 조건일 때의 설계 경로' },
      h('span', { class: 'sc-conds-label', title: '그 조건일 때의 설계 경로만 밝혀요 · 관측 결과가 아니에요' }, '조건 선택'),
      ...cc.conditions.map(c => h('button', { type: 'button', class: `sc-cond${cur === c ? ' on' : ''}`, 'aria-pressed': String(cur === c),
        title: `조건: ${c}\n이 조건일 때의 설계 경로 · 다른 갈래는 흐리게 (관측 결과 아님)${cur === c ? '\n다시 누르면 모든 갈래' : ''}`,
        onclick: () => { scCond = scCond === c ? null : c; redrawScenario(); } }, c))));
    else if (cc.note) el.append(h('p', { class: 'sc-note sc-conds-none', title: '관측된 실행은 한 번 지나간 길이라, 조건을 바꿔 다른 갈래를 보여 주지 않아요' }, cc.note));
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
/** The title's '전체 규칙 N · 배치 미정 K' (spec 5.1, signs-view projectRuleList): the project rules of every part and the rules
 * that stand at no precise place, next to the scenario line. It opens (in the title, nothing on the map moves) the list of every
 * part's project, part-wide and unplaced rules, by part; a row opens that rule in the part's 규칙 section. */
let rulesOpen = false;
function rulesStrip(o: Opened): HTMLElement | null {
  const parts = o.view.parts.flatMap(p => p.reading ? [{ id: p.id, name: p.name, rules: signsOf(p.reading).rules, places: placesOf(p.reading) }] : []);
  const list = projectRuleList(parts); if (!list.groups.length && !list.project && !list.unplaced) return null;
  const rows = list.groups.reduce((n, g) => n + g.rows.length, 0);
  const el = h('div', { class: `map-flow map-rules${rulesOpen ? ' open' : ''}`, role: 'group', 'aria-label': '전체 규칙' },
    h('span', { class: 'mf-verb' }, '규칙'),
    h('button', { type: 'button', class: `mf-step rules-entry${rulesOpen ? ' on' : ''}`, 'aria-expanded': String(rulesOpen),
      title: `프로젝트 전체 원칙 ${list.project} · 정확한 단계·포트·필드에 놓이지 않은 규칙 ${list.unplaced}\n${rulesOpen ? '목록 접기' : `부분별 목록 ${rows}: 프로젝트 전체 · 부분 전체 · 배치 미정`}`,
      onclick: () => { rulesOpen = !rulesOpen; renderSpace('keep'); markSelection(selected); } },
      h('span', {}, `전체 규칙 ${list.project}`), list.unplaced ? h('span', { class: 'entry-unplaced', title: UNPLACED_TIP }, ` · 배치 미정 ${list.unplaced}`) : null));
  el.setAttribute('aria-description', projectRuleEntry(list));
  if (rulesOpen) el.append(h('div', { class: 'rules-list', role: 'list', 'aria-label': '부분별 규칙' }, ...list.groups.map(gr => h('div', { class: 'rules-group', role: 'listitem' },
    h('p', { class: 'rules-head' }, h('button', { type: 'button', class: 'link-button rules-part', title: `‘${gr.name}’ 선택`, onclick: () => goPart(o, gr.part) }, gr.name), h('small', {}, String(gr.rows.length))),
    h('ul', { class: 'rules-rows' }, ...gr.rows.map(x => h('li', {}, h('button', { type: 'button', class: `rules-row k-${x.kind}`, 'data-rule-part': gr.part,
      title: `${gr.name}의 규칙 · ${RULE_ROW_LABEL[x.kind]}\n${x.claim.text}\n눌러서 읽기면의 규칙에서 범위·적용 위치·보장`, onclick: () => openRuleAt(o, gr.part, claimKey(x.claim)) },
      h('span', { class: `rules-kind${x.kind === 'unplaced' ? ' entry-unplaced' : ''}` }, RULE_ROW_LABEL[x.kind]), h('span', { class: 'rules-text' }, x.claim.text),
      ruleHasProgram(x.claim) ? progChip('적용 위치') : null, ruleHasProgramEnforce(x.claim) ? progChip('보장 · 코드') : null))))))));
  return el;
}
/** A part chosen from the title (a rule's part may be outside the view): in this view when it is drawn or inside it, else in its parent's. */
function goPart(o: Opened, id: string) { const p = partOf(o, id); if (!p) return; go(o.key, id, id === scope || insideScope(o, id) ? scope : p.parentId); }
/** A rule chosen from the title's list: its part selected and its 규칙 section open at that rule. */
function openRuleAt(o: Opened, id: string, key: string) {
  if (selected === id) { openSign(id, 'rule', key); return; }
  signOpen = { part: id, kind: 'rule' }; signFocus = true; signPick = key; if (lensRail) lensRail = false;
  goPart(o, id);
}
function enterScenario(id: string) {
  const o = opened; if (!o || !scenarioEntry(o, id)) return;
  scOn = id; scVisit = null; scCond = null; redrawScenario();
  if ($('lens').classList.contains('scenario-read')) hideLens();
  if (selected) refreshReading(); // the selected part's lens says whether the path visits it
  // A path read on the map is the 시나리오 lens (map design v3 7.1).
  if (viewLens !== 'scenario') { viewLens = 'scenario'; legend = NO_FILTER; legendMenu = null; saveLens(); renderLegend(); applyLens(); }
}
function leaveScenario() {
  const o = opened; if (!o || !scOn) return;
  const focusPart = document.activeElement?.closest<HTMLElement>('.sc-badge')?.closest<HTMLElement>('[data-part]')?.dataset.part ?? null;
  scOn = null; scVisit = null; scCond = null; redrawScenario();
  if ($('lens').classList.contains('scenario-read')) hideLens();
  if (selected) refreshReading();
  if (viewLens === 'scenario') { viewLens = DEFAULT_LENS; legend = NO_FILTER; legendMenu = null; saveLens(); renderLegend(); applyLens(); }
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
  world.querySelectorAll('.edge.sc-path').forEach(el => el.classList.remove('sc-path', 'sc-back', 'sc-wait', 'sc-cond-off'));
  const entry = o && scOn ? scenarioEntry(o, scOn) : null;
  scView = o && entry ? scenarioUnderstanding(o.project, entry.id) : null;
  if (!scView) { scOn = null; scVisit = null; scBroken = null; }
  scBroken = o && entry && scView ? brokenPlace(scView, entry.diagnostics, scenarioText(o, entry)) : null;
  sp.classList.toggle('scenario', !!scView);
  sp.classList.toggle('dim', dimNow());
  if (!o || !scView) { scCondPath = null; placeScenarioMarks(); return; }
  const u = scView, places = badgePlaces(u, id => drawnRep(o, id));
  const cc = conditionChoice(u); if (scCond && (!cc.offer || !cc.conditions.includes(scCond))) scCond = null;
  scCondPath = scCond ? conditionPath(u, scCond) : null;
  const gates = gateVisits(u, areaId => runGates(o, areaId)), off = (id: string) => !!scCondPath && !scCondPath.visits.has(id);
  for (const p of places.places) {
    const card = world.querySelector<HTMLElement>(`.node[data-box="${CSS.escape(p.box)}"], .frame[data-box="${CSS.escape(p.box)}"]`); if (!card) continue;
    card.classList.add('sc-visit');
    const badge = h('span', { class: 'sc-badge', role: 'group', 'aria-label': `방문 ${p.visits.map(v => v.n).join(', ')}` });
    p.shown.forEach((v, i) => {
      if (i) badge.append(h('span', { class: 'sc-sep', 'aria-hidden': 'true' }, '·'));
      badge.append(h('button', { type: 'button', class: `sc-v${scVisit === v.id ? ' on' : ''}${off(v.id) ? ' sc-off' : ''}`, 'data-visit': v.id, 'aria-pressed': String(scVisit === v.id),
        title: `${v.title}${off(v.id) ? `\n조건 ‘${scCond}’일 때의 설계 경로 밖` : ''}`,
        'aria-label': `${v.title.replace(/\n/g, ' · ')} · 방문 선택`, onclick: (e: Event) => { e.stopPropagation(); selectVisit(scVisit === v.id ? null : v.id); } },
        h('span', { class: 'sc-n' }, v.n), ...v.glyphs.map(g => h('span', { class: `sc-glyph k-${g.kind}`, 'aria-hidden': 'true' }, g.glyph))));
    });
    // Past two: the rest by count, never as a range (03–07); the first of them is chosen from it, the pane lists all.
    if (p.more) { const rest = p.visits.slice(2); badge.append(h('span', { class: 'sc-sep', 'aria-hidden': 'true' }, '·'), h('button', { type: 'button', class: `sc-v sc-more${rest.some(v => v.id === scVisit) ? ' on' : ''}`, 'data-visit': rest[0]!.id,
      title: rest.map(v => v.title).join('\n\n'), 'aria-label': `방문 ${rest.map(v => v.n).join(', ')} 더 · 첫 방문 선택`, onclick: (e: Event) => { e.stopPropagation(); selectVisit(rest[0]!.id); } }, `+${p.more}`)); }
    // spec 5.2: a visit whose part carries a run gate stands at a decision on the path: a small 관문 mark on its badge, which opens
    // that part's detail view (its decision step and exits).
    const gv = p.visits.filter(v => gates.has(v.id));
    if (gv.length) {
      const area = u.visits.find(x => x.id === gv[0]!.id)!.areaId, n = gates.get(gv[0]!.id)!, who = gv.map(v => v.n).join(' · ');
      badge.append(h('button', { type: 'button', class: 'sc-gate', 'data-gate-part': area, 'aria-label': `실행 관문 ${n} · 방문 ${who} · 내부 상세에서 판정 단계 보기`,
        title: `실행 관문 ${n} · 방문 ${who}\n경로 위의 판정 · 눌러서 내부 상세의 판정 단계와 출구`, onclick: (e: Event) => { e.stopPropagation(); openDetail(area, true); } }, '관문'));
    }
    if (p.visits.every(v => off(v.id))) badge.classList.add('sc-off');
    if (scBroken && scBroken.visit && p.visits.some(v => v.id === scBroken!.visit))
      badge.append(h('span', { class: 'sc-broken', title: `${scBroken.kind === 'visit' ? `방문 ${scBroken.ref ?? `${(scBroken.row ?? 0) + 1}번째 행`} 제외` : scBroken.kind === 'link' ? `이어짐 ${scBroken.ref ?? `${(scBroken.row ?? 0) + 1}번째 행`} 제외` : '끝에 닿지 않음'} · ${scBroken.explanation}` }, '여기서 끊김'));
    card.append(badge);
  }
  // The path: the existing lines the links cite, in the accent (with their heads); nothing new is drawn.
  // A wait's line reads as a control line (open V head, dashed near its destination; placeScenarioMarks); under a chosen
  // condition, a line only the other branch runs on steps back.
  const rels = new Set(pathRelations(u)), relOf = (pick: (l: ScenarioUnderstanding['links'][number]) => boolean) => new Set(u.links.filter(l => pick(l) && l.relation && l.relationOnMap).map(l => l.relation!.relationId));
  const waits = relOf(l => l.kind === 'wait'), lit = scCondPath ? relOf(l => scCondPath!.links.has(l.id)) : null;
  world.querySelectorAll<SVGGElement>('.edge:not(.sum)').forEach(g => {
    const e = edgeOf(g.dataset.key); if (!e || !e.ids.some(id => rels.has(id))) return;
    g.classList.add('sc-path'); layerEdge(g);
    if (e.ids.some(id => waits.has(id))) g.classList.add('sc-wait');
    if (lit && !e.ids.some(id => lit.has(id))) g.classList.add('sc-cond-off');
  });
  markVisit();
  placeScenarioHeads();
  placeScenarioMarks();
}
/** The grammar of the path on its own lines (scenario-view grammarMarks, spec §3.3): a branch's diamond where its line leaves the
 * source card, its condition 8–16px from that exit; a parallel link's double bar across its line near the source; a loop's thin
 * frame round the cards it spans with its repeat unit at the frame's head; a wait's control line (open V head, dashed near the
 * destination) with what resumes it. A label takes a place clear of parts, heads, the title, the badges, other labels and lines
 * (map-labels' spots), else it reads on hover only (each mark's title). Nothing moves; drawn again after the labels. */
function placeScenarioMarks() {
  const world = $('world'), o = opened;
  world.querySelectorAll('.sc-marks, .sc-mark-labels').forEach(el => el.remove());
  world.querySelectorAll<SVGPathElement>('.edge .edge-line[data-wait-dash]').forEach(p => { p.style.removeProperty('stroke-dasharray'); p.removeAttribute('data-wait-dash'); });
  const top = world.querySelector<SVGSVGElement>('.edges-top');
  if (!o || !scView || !top) return;
  const u = scView, marks = grammarMarks(u); if (!marks.length) return;
  const g = svg('g', { class: 'sc-marks' }), box = h('div', { class: 'sc-mark-labels' });
  top.append(g); world.append(box);
  const inv = labelInv(), shown = shownLines(), k = camera.k || 1, W = world.getBoundingClientRect();
  const rectOf = (el: Element): Rect => { const r = el.getBoundingClientRect(); return { x: (r.left - W.left) / k, y: (r.top - W.top) / k, w: r.width / k, h: r.height / k }; };
  const blocks: Rect[] = [...lay.boxes.values()].map(b => (b.kind === 'frame' ? { x: b.x, y: b.y, w: b.w, h: b.head } : b)).concat(lay.heads);
  if (titleH) blocks.push(titleRect());
  if (shortRect) blocks.push(shortRect);
  world.querySelectorAll('.edge-labels > *, .sc-head, .sc-badge').forEach(el => blocks.push(rectOf(el)));
  const clear = (r: Rect) => !blocks.some(b => r.x < b.x + b.w + 3 && b.x < r.x + r.w + 3 && r.y < b.y + b.h + 3 && b.y < r.y + r.h + 3);
  const visit = new Map(u.visits.map(v => [v.id, v]));
  const repOf = (id: string) => { const v = visit.get(id); return v && v.partOnMap ? drawnRep(o, v.areaId) : null; };
  const off = (m: GrammarMark) => !!scCondPath && scCondPath.off.has(m.link);
  const lineOf = (m: GrammarMark) => {
    if (!m.relation) return null;
    const el = [...world.querySelectorAll<SVGGElement>('.edge.sc-path:not(.sum)')].find(x => edgeOf(x.dataset.key)?.ids.includes(m.relation!)); if (!el) return null;
    const e = edgeOf(el.dataset.key)!, pts = lastRouted.get(e.key)?.pts, dir = linkDirection(e.from, e.to, repOf(m.from), repOf(m.to));
    return pts && pts.length > 1 && dir ? { el, key: e.key, pts, dir, src: fromSource(pts, dir) } : null;
  };
  const label = (m: GrammarMark, cands: (w: number, hh: number) => Rect[]) => {
    const el = h('span', { class: `sc-mark-label k-${m.kind}${m.blank ? ' blank' : ''}${off(m) ? ' off' : ''}`, title: m.title, 'data-link': m.link }, m.label);
    box.append(el);
    const w = el.offsetWidth * inv, hh = el.offsetHeight * inv, spot = cands(w, hh).find(clear) ?? null;
    if (!spot) { el.remove(); return; }
    el.style.left = `${spot.x}px`; el.style.top = `${spot.y}px`; blocks.push(spot);
  };
  // Each mark a group with its title (its full words on hover) and a wide transparent stroke to hover it by.
  const group = (m: GrammarMark, cls: string, ...shapes: SVGElement[]) => {
    const el = svg('g', { class: `sc-mark k-${m.kind}${off(m) ? ' off' : ''} ${cls}`, 'data-link': m.link }), t = svg('title', {}); t.textContent = m.title;
    el.append(t, ...shapes); g.append(el);
  };
  let loops = 0;
  for (const m of marks) {
    if (m.kind === 'loop') {
      const rects = [...new Set(m.span.map(repOf).filter((x): x is string => !!x))].map(id => lay.boxes.get(id)).filter((b): b is Box => !!b);
      const f = loopFrame(rects, 14 + 6 * loops++); if (!f) continue;
      const at = { x: String(f.x), y: String(f.y), width: String(f.w), height: String(f.h), rx: '12' };
      group(m, 'sc-loop', svg('rect', { class: 'sc-loop-frame', ...at }), svg('rect', { class: 'sc-hit', ...at }));
      label(m, (w, hh) => frameLabelSpots(f, w, hh));
      continue;
    }
    const line = lineOf(m); if (!line) continue;
    const { el, pts, src, key } = line;
    // Beside the line (its ends' spots) a label keeps off the line itself; on a run of it (labelSpots) it sits on the line, as a
    // line's own label does. Either way no other line passes under it.
    const beside = (rs: Rect[]) => rs.filter(r => !lineUnder(r, key, shown) && !polylineHitsRect(pts, r, 1)), along = (rs: Rect[]) => rs.filter(r => !lineUnder(r, key, shown));
    if (m.kind === 'branch') {
      const d = diamondMark(src); if (!d) continue;
      group(m, 'sc-branch', svg('path', { class: 'sc-diamond', d: d.d }));
      blocks.push({ x: d.cx - 8, y: d.cy - 8, w: 16, h: 16 });
      // Beside the exit first (8–16px from it, spec §3.3), then round the diamond, then on a run of the line near the source.
      const round = (w: number, hh: number) => [[10, -hh - 10], [10, 10], [-w - 10, -hh - 10], [-w - 10, 10]].map(([dx, dy]) => ({ x: d.cx + dx!, y: d.cy + dy!, w, h: hh }));
      label(m, (w, hh) => [...beside(portSpots([...src].reverse(), w, hh, 12)), ...beside(round(w, hh)), ...along(labelSpots(src, w, hh, 'start'))]);
    } else if (m.kind === 'parallel') {
      const d = parallelBar(src); if (!d) continue;
      group(m, 'sc-parallel', svg('path', { class: 'sc-bar', d }), svg('path', { class: 'sc-hit', d }));
      const b = diamondMark(src, 16, 9); if (b) blocks.push({ x: b.cx - 9, y: b.cy - 9, w: 18, h: 18 });
      // The bar says 동시 by itself; a join policy the record wrote reads beside it.
      if (!m.blank) label(m, (w, hh) => [...beside(portSpots([...src].reverse(), w, hh, 28)), ...along(labelSpots(src, w, hh, 'start'))]);
    } else {
      const path = el.querySelector<SVGPathElement>('.edge-line');
      if (path) { path.style.strokeDasharray = waitDash(path.getTotalLength(), 26, line.dir === 'reverse'); path.setAttribute('data-wait-dash', '1'); }
      // Its dashed end hovers with what resumes it (the line's own hover keeps the rest of it).
      const tip = [...src].reverse(), a = pointAlong(tip, 0), b = pointAlong(tip, 26);
      if (a && b) group(m, 'sc-wait', svg('path', { class: 'sc-hit', d: `M${a.x},${a.y} L${b.x},${b.y}` }));
      label(m, (w, hh) => [...beside(portSpots(src, w, hh, 16)), ...along(labelSpots(src, w, hh, 'end'))]);
    }
  }
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
    // A wait on the path reads as a control line: its open head (placeScenarioMarks dashes its end).
    const head = (el.classList.contains('sc-wait') && el.dataset.head === 'filled' ? 'open' : el.dataset.head ?? 'filled') as Head, start = (el.dataset.start ?? 'none') as Head;
    const mark = (h: Head) => (h === 'none' ? 'none' : `url(#m-${h}${lit ? '-on' : ''})`);
    line.setAttribute('marker-end', mark(head));
    // A data or control line marks where it starts while it is read (styles.css shows that dot on a hovered or selected line); an
    // ear or a plain relation's dot is always drawn.
    line.setAttribute('marker-start', start === 'none' ? `url(#m-dot${lit ? '-on' : ''})` : mark(start));
  });
}
/** The end marks of the map's lines (map design v3 6.1, 9.6), each in three paints (rest, selected, pointed at): the filled
 * triangle (data), the open V (control), a reference's smaller V, the ear's ring and a dot. Sized in screen pixels by syncMarks. */
function endMarkDefs(): SVGElement {
  const defs = svg('defs', {});
  const shapes: Record<Exclude<Head, 'none'>, { ref: string; el: () => SVGElement }> = {
    filled: { ref: '9', el: () => svg('path', { class: 'mk-fill', d: 'M0,1 L10,5 L0,9 z' }) },
    open: { ref: '9', el: () => svg('path', { class: 'mk-open', d: 'M1,1 L9,5 L1,9' }) },
    ref: { ref: '9', el: () => svg('path', { class: 'mk-open', d: 'M1.5,1.5 L9,5 L1.5,8.5' }) },
    ear: { ref: '5', el: () => svg('circle', { class: 'mk-ring', cx: '5', cy: '5', r: '3.4' }) },
    dot: { ref: '5', el: () => svg('circle', { class: 'mk-fill', cx: '5', cy: '5', r: '4' }) } };
  for (const [k, s] of Object.entries(shapes)) for (const suf of ['', '-on', '-near']) {
    const m = svg('marker', { id: `m-${k}${suf}`, class: `mk mk-${k}${suf ? ` mk${suf}` : ''}`, viewBox: '0 0 10 10', refX: s.ref, refY: '5', markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse', 'data-px': String(HEAD_PX[k as keyof typeof HEAD_PX]) });
    m.append(s.el()); defs.append(m);
  }
  return defs;
}
/** Heads and ears keep their screen size whatever the zoom (6.1): each marker is HEAD_PX screen pixels, so 1/k of the map. */
let marksAt = 0;
function syncMarks(k: number) {
  if (Math.abs(k - marksAt) < 0.005) return; marksAt = k;
  document.querySelectorAll<SVGMarkerElement>('#world marker.mk').forEach(m => { const px = Number(m.dataset.px) / k; m.setAttribute('markerWidth', px.toFixed(2)); m.setAttribute('markerHeight', px.toFixed(2)); });
}
/** The summary lines of a busy map in the line grammar: one per pair of groups, direction and channel. */
function sumLines(o: Opened, list: Edge[]): Edge[] {
  const said = relationLines(o.project), notes = new Map(o.view.relations.map(r => [r.id, r.note]));
  return mergeByChannel(list, (id, kind) => said.get(id)?.channel ?? (kind === 'flow' ? 'data' : 'uses'), id => notes.get(id), true);
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

/* ---------- the panel (map design v3 8.1–8.10, slice S1): one fixed head, three tabs, one body ----------
 * The head (where the part sits, its name, its kind word and operations line, a store's or a scenario's line, the way back from a
 * followed line) and the tab row stay; one tab's body scrolls. 구조: a short chain first (하는 일 → 받는 것 → 동작 요약 → 내는 것 →
 * 확인 필요), then 계약, 동작, 규칙과 관문, 연결, 어디에. 근거: what the drawing rests on, under 구조's sections (주장 순) or by record
 * (기록별), then the records. 이력: the withdrawals 이전 → 지금 newest first, every reading's words, the requests' results. The lens
 * and its wide mode (넓게 읽기, #panel.reading) read the same tabs in the same order (pane-view PANE_TABS); the wide mode only adds
 * what needs room (the records whole and the answers under 근거, the question box at its foot). Values a reading lists without a
 * line of their own read apart, under 「항목 근거 미연결 추출값」, never as cited rows. */
let paneTab: PaneTab = 'structure';
/** The tab a way in chose before the selection changes (another card's sign tab); select() takes it once. */
let pendingTab: PaneTab | null = null;
/** 근거's view: 주장 순 (under 구조's sections) or 기록별 (one rail per record, cycle 5's 원문). Memory, this tab. */
let evidenceView: 'claims' | 'records' = 'claims';
/** Each tab's scroll per part and surface (memory): coming back to a tab comes back where it was left. */
const tabScroll = new Map<string, number>();
/** What one drawing of the panel reads, once: the part, its reading, the surface, its relations by their real ends, where the
 * selection came from, what the readings say each line carries, its records; cites numbers the claims of the body. */
interface PaneCtx { o: Opened; part: PartView; u: PartUnderstanding | null; wide: boolean; ends: End[]; cameFrom: string | null; handed: Map<string, ReadingRelation>; lineSaid: Map<string, LineSaid>; records: RecordView[];
  /** The part's evidence numbered once (pane-view evidenceItems): the same numbers in every tab, view and surface. */
  book: EvidenceBook<CurrentClaim> }
function paneCtx(o: Opened, part: PartView, wide: boolean): PaneCtx {
  const came = visitEntry(o) ? visits.at(-1)!.from.selected : null;
  const ends = relationEnds(o, part.id), handed = relationPayloads(o.project), lineSaid = relationLines(o.project);
  return { o, part, u: part.reading, wide, ends, cameFrom: came, handed, lineSaid, records: subtreeRecords(o.view, part.id), book: evidenceBook(o, part, ends, handed, lineSaid) };
}
/** The part's evidence items in 구조's order (map design v3 8.4): the kind word and the operations line, the description's passages,
 * the lines in and out (the chain's first rows first), the loop and steps, the condition and port rows, each rule's words with its
 * places and what keeps it, the gates and withdrawals, the other lines, the 파일 지도 rows, then the claims 구조 does not use. Built
 * from what the reading holds only: never from the lens, the tab, a fold or the picked line, so the numbers stay put. */
function evidenceBook(o: Opened, part: PartView, ends: End[], handed: Map<string, ReadingRelation>, lineSaid: Map<string, LineSaid>): EvidenceBook<CurrentClaim> {
  const u = part.reading;
  if (!u) return evidenceItems<CurrentClaim>({ roleBasis: [], state: null, type: null, relations: [], loop: null, steps: [], conditions: [], portMap: [], fileRoles: [], claims: [], rules: [] });
  const sg = signsOf(u), places = placesOf(u), ruled = new Set(sg.rules), split = gateSplit(sg.gates);
  const far = (x: End) => partOf(o, x.far)?.name ?? '부분';
  const flowLabel = (x: End) => { const pay = handed.get(x.r.id)?.payload; return `${x.out ? '내는 것' : '받는 것'} · ${far(x)}${pay ? ` · ${pay}` : ''}`; };
  const flows = ends.filter(x => x.r.kind === 'flow'), withs = relationGroups(ends.filter(x => x.r.kind !== 'flow')).flatMap(g => g.list);
  const relations = [...flows.map(x => ({ id: x.r.id, label: flowLabel(x), quote: lineSaid.get(x.r.id)?.quote ?? null, dir: x.out ? 'out' as const : 'in' as const, at: lineSaid.get(x.r.id)?.at ?? null })),
    ...withs.map(x => ({ id: x.r.id, label: `함께 · ${REL_LABEL[x.r.kind] ?? x.r.kind} · ${far(x)}`, quote: lineSaid.get(x.r.id)?.quote ?? null, dir: 'with' as const, at: lineSaid.get(x.r.id)?.at ?? null }))];
  const where = whereRows([...u.files, ...u.claims.map(x => x.where)], u.fileRoles ?? []);
  const basisAt = (q: ReadingQuote) => u.history.find(x => x.basis.some(b => spanKey(b) === spanKey(q)))?.at ?? null;
  return evidenceItems<CurrentClaim>({
    roleBasis: u.corrected ? [] : u.roleBasis, roleText: u.role, roleAt: basisAt,
    type: u.typeRead ? { label: `종류 · ${TYPE_LABEL[u.typeRead.type]}`, quote: u.typeRead.quote, at: u.typeRead.at } : null,
    state: u.stateRead ? { label: `운영 한 줄 · ${opsHead(u.stateRead.state, u.stateRead.when)}`, quote: u.stateRead.quote, at: u.stateRead.at } : null,
    relations, loop: u.loop ? { quote: u.loop.quote, at: u.loop.at } : null, steps: u.steps ?? [], conditions: conditionsOf(u), portMap: u.portMap ?? [], fileRoles: where.roles,
    claims: paneSorted(u.claims), cautions: cautionRows(u, 0).flatMap(x => (x.claim ? [x.claim] : [])),
    rules: [...sg.rules, ...split.run, ...split.dev, ...split.guessed, ...sg.changes],
    ruleQuotes: x => { if (!ruled.has(x)) return []; const v = ruleView(x, places, part.name);
      return [...(v.anchorsBlank ? [] : v.anchors.map((a, i) => ({ key: `anchor:${i}`, label: `적용 위치 · ${a.text}`, quote: a.quote }))),
        ...(v.enforceBlank ? [] : v.enforce.flatMap((e, i) => (e.quote ? [{ key: `enforce:${i}`, label: `보장 · ${e.line}`, quote: e.quote }] : [])))]; },
    claimRef: claimKey });
}
const flowsIn = (c: PaneCtx) => c.ends.filter(x => x.r.kind === 'flow' && !x.out);
const flowsOut = (c: PaneCtx) => c.ends.filter(x => x.r.kind === 'flow' && x.out);
const isControl = (c: PaneCtx, x: End) => c.lineSaid.get(x.r.id)?.channel === 'control';
const paneRoot = () => (sheetOpen ? $('panel') : $('lens'));
const paneBody = () => paneRoot().querySelector<HTMLElement>(sheetOpen ? '.panel-body' : '.lens-body');
const scrollKey = (o: Opened, part: string, tab: PaneTab) => `${o.key}|${part}|${sheetOpen ? 'wide' : 'lens'}|${tab}`;
/** Another tab: the one left keeps its scroll, the new one comes back where it was left; focus goes where asked (its tab). */
function setPaneTab(tab: PaneTab, focus: string | null = null) {
  const o = opened; if (!o || !selected) return;
  const body = paneBody(); if (body) tabScroll.set(scrollKey(o, selected, paneTab), body.scrollTop);
  paneTab = tab; hidePreview();
  // The way back from 근거 holds only while 근거 is read (8.4-3): another tab drops it.
  if (tab !== 'evidence') evReturn = [];
  if (sheetOpen) renderPanel(false); else renderLens();
  const next = paneBody(); if (next) next.scrollTop = tabScroll.get(scrollKey(o, selected, tab)) ?? 0;
  if (focus) paneRoot().querySelector<HTMLElement>(focus)?.focus();
}
/** A heading brought to the top of the panel's body (8px under it), moving only that body. */
function scrollToHead(el: HTMLElement) {
  const body = el.closest<HTMLElement>('.lens-body, .panel-body'); if (!body) return;
  body.scrollTop += el.getBoundingClientRect().top - body.getBoundingClientRect().top - 8;
}
/** A jump chip: its section's heading at the top of the body, and the focus on it. */
function jumpTo(key: StructureSection) {
  const head = paneBody()?.querySelector<HTMLElement>(`[data-sec="${key}"] > :is(h3, h4)`); if (!head) return;
  scrollToHead(head); head.focus({ preventScroll: true });
}
/** The tab row (ARIA tabs: ← → between them, Home and End; the selected one is the row's one stop for Tab). */
function tabRow(c: PaneCtx): HTMLElement {
  const counts: Record<PaneTab, number> = { structure: 0, evidence: c.book.items.length, history: c.u?.history.length ?? 0 };
  const row = h('div', { class: 'pane-tabs', role: 'tablist', 'aria-label': '읽기 탭' }, ...PANE_TABS.map(t => { const on = t.key === paneTab;
    return h('button', { type: 'button', role: 'tab', id: `pane-tab-${t.key}`, class: `pane-tab${on ? ' on' : ''}`, 'data-tab': t.key, 'aria-selected': String(on), 'aria-controls': 'pane-tabpanel', tabindex: on ? '0' : '-1', title: t.hint,
      onclick: () => { if (t.key !== paneTab) setPaneTab(t.key, `[role="tab"][data-tab="${t.key}"]`); } }, tabLabel(t, counts[t.key])); }));
  row.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const next = tabKeyMove(paneTab, e.key); if (!next) return;
    e.preventDefault(); if (next !== paneTab) setPaneTab(next, `[role="tab"][data-tab="${next}"]`);
  });
  return row;
}
/** The tab's body (the tab panel): 구조, 근거 or 이력. */
const tabBody = (c: PaneCtx): HTMLElement[] => (paneTab === 'evidence' ? evidenceTab(c) : paneTab === 'history' ? historyTab(c) : structureTab(c));
/** A list folded to its first rows, with its own 「N개 더」 · 「접기」 (per part, this tab's memory, as the other folds). */
const foldKey = (c: PaneCtx, what: string) => `${c.o.key}|${c.part.id}|fold|${what}`;
function folded<T>(c: PaneCtx, what: string, rows: readonly T[], max: number, keep?: (x: T) => boolean): { shown: T[]; more: HTMLElement | null } {
  const key = foldKey(c, what), open = lensOpen.has(key), f = foldRows(rows, max, open, keep);
  if (rows.length <= max || (!open && !f.hidden)) return { shown: f.shown, more: null };
  return { shown: f.shown, more: h('button', { type: 'button', class: 'link-button pn-more', 'data-more': what, 'aria-expanded': String(open),
    onclick: () => { if (lensOpen.has(key)) lensOpen.delete(key); else lensOpen.add(key); reread(`[data-more="${what}"]`); } }, open ? '접기' : `${f.hidden}개 더`) };
}
/** A 구조 section: its heading (a jump chip's and the sticky path's target) and its rows. */
function secEl(key: StructureSection, count: string | null, cls: string, ...children: (HTMLElement | null)[]): HTMLElement {
  return h('section', { class: `pn-sec pn-${key}${cls ? ` ${cls}` : ''}`, 'data-sec': key, 'aria-labelledby': `pn-h-${key}` },
    h('h3', { id: `pn-h-${key}`, tabindex: '-1', 'data-path': STRUCTURE_TITLE[key] }, STRUCTURE_TITLE[key], count ? h('small', {}, count) : null), ...children);
}
/** One line over the body while a long section scrolls past its heading: where the reader is ('동작 · 단계'). */
const stickyBar = () => h('div', { class: 'pn-sticky', 'aria-hidden': 'true', hidden: true });
function bindSticky(body: HTMLElement) {
  const bar = body.parentElement?.querySelector<HTMLElement>(':scope > .pn-sticky'); if (!bar) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const top = body.getBoundingClientRect().top; let sec: HTMLElement | null = null;
    for (const s of body.querySelectorAll<HTMLElement>('.pn-sec[data-sec], .pn-chain [data-sec]')) if (s.getBoundingClientRect().top < top + 1) sec = s;
    const head = sec?.querySelector<HTMLElement>(':scope > :is(h3, h4)');
    if (!sec || !head || head.getBoundingClientRect().top >= top) { bar.hidden = true; return; }
    let sub: string | null = null;
    for (const x of sec.querySelectorAll<HTMLElement>('[data-sub]')) if (x.getBoundingClientRect().top < top + 28) sub = x.dataset.sub ?? null;
    bar.textContent = [head.dataset.path ?? '', sub].filter(Boolean).join(' · ');
    bar.style.top = `${body.offsetTop}px`; bar.hidden = false;
  };
  body.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
}

/* The pane's width (8.8): the left edge drags between 360 and 600px (a double-click, or Home, back to the default), ← → move it by
 * 16px; kept per browser (pane-view PANE_WIDTH_KEY, try/catch there). A dragged width gives way first when the map would be left
 * under 480px. The map's area follows (syncMapArea); below 720px the pane takes the window as before. */
let paneW: number | null = readPaneWidth(kv);
setInspectorWidth(paneW);
function syncPaneWidth() {
  const root = document.documentElement;
  if (paneW === null || window.innerWidth < PANE_NARROW) root.style.removeProperty('--insp-w');
  else root.style.setProperty('--insp-w', `${paneWidthFor(paneW, window.innerWidth)}px`);
}
syncPaneWidth();
function setPaneWidth(w: number | null, save: boolean) {
  paneW = w; setInspectorWidth(w); syncPaneWidth(); syncMapArea();
  document.querySelectorAll<HTMLElement>('.pane-grip').forEach(g => g.setAttribute('aria-valuenow', String(Math.round(inspW()))));
  if (save) writePaneWidth(kv, w);
}
function paneGrip(): HTMLElement {
  const grip = h('div', { class: 'pane-grip', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': '읽기면 폭', 'aria-valuemin': String(PANE_MIN), 'aria-valuemax': String(PANE_MAX),
    'aria-valuenow': String(Math.round(inspW())), tabindex: '0', title: '끌어서 읽기면 폭 조절 · 두 번 누르면 기본 폭' });
  grip.addEventListener('pointerdown', e => {
    if (e.button !== 0 || window.innerWidth < PANE_NARROW) return;
    e.preventDefault();
    const start = inspW(), x0 = e.clientX; grip.setPointerCapture(e.pointerId); grip.classList.add('on');
    const move = (ev: PointerEvent) => setPaneWidth(dragWidth(start, x0, ev.clientX), false);
    const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); grip.classList.remove('on'); writePaneWidth(kv, paneW); };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  });
  grip.addEventListener('dblclick', () => setPaneWidth(null, true));
  grip.addEventListener('keydown', e => {
    if (e.key === 'Home') { e.preventDefault(); setPaneWidth(null, true); return; }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); setPaneWidth(Math.min(PANE_MAX, Math.max(PANE_MIN, Math.round(inspW()) + (e.key === 'ArrowLeft' ? 16 : -16))), true);
  });
  return grip;
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

/* ---------- the fixed head (8.2) ---------- */
/** The kind word and the operations line (8.2-3): the record's type word (or 유형 미상 when a reading names none), then the newest
 * reading's state in the panel's full form ('가동 보고 · 10-31 16:03Z · 현재 가동 여부 미확인', ops-line opsHead) with the author's
 * tag of the line that says it (the 근거 chip: a tag, never the app's verdict). No state given: the ladder line as before. A report
 * is not a status: no colour says more than the words. */
function kindLine(c: PaneCtx): HTMLElement {
  const u = c.u, t = u?.typeRead ?? null, s = u?.stateRead ?? null;
  const filed = filedUnder(c.o.view, c.part.id);
  const kind0 = t ? h('span', { class: 'lens-kind', ...(t.quote ? { title: `종류 · 기록의 말 “${t.quote.quote}”` } : {}) }, TYPE_LABEL[t.type])
    : u ? h('span', { class: 'lens-kind blank', title: structuralOf(null, stepsOf(u).length, !!u.loop) ? '기록이 이 부분의 종류를 말하지 않았어요 · 기록된 단계·반복만 있어요 (종류를 짐작하지 않음)' : '기록이 이 부분의 종류를 말하지 않았어요' }, kindLabel(null, stepsOf(u).length, !!u.loop)) : null;
  // 「원문 분류: 폐기」 (map design v3 2.2): the lifecycle group the record placed the part under, kept beside its kind word.
  const kind = kind0 && filed ? h('span', { class: 'lens-kind-wrap' }, kind0, h('span', { class: 'lens-filed', title: `${SHELF_TIP}` }, ` · 원문 분류: ${filed}`)) : kind0;
  const sep = () => h('span', { class: 'lk-sep', 'aria-hidden': 'true' }, '·');
  // map design v3 8.2-3 / 8.4: the kind word's and the operations line's footnotes in place of the evidence chip (the tag reads in the mark).
  const typeMark = t ? fnMarks(c, ['type'], '종류', false) : null;
  if (s) {
    return h('p', { class: `pane-state st-${s.state}`, ...(s.quote ? { title: `기록의 말 · “${s.quote.quote}”` } : {}) },
      h('i', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'lk-line' }, kind, typeMark, kind ? sep() : null, h('span', { class: 'lens-ops' }, opsHead(s.state, s.when)),
        s.when ? null : h('small', { class: 'lens-ops-at', title: fullTime(s.at) }, ` · 정리 ${ago(s.at)}`)),
      fnMarks(c, ['state'], '운영 한 줄', false));
  }
  const lad = ladderLine(c.o.view, c.part); if (kind) lad.prepend(kind, ...(typeMark ? [typeMark] : []), sep()); return lad;
}
function paneHead(c: PaneCtx, tools: HTMLElement): HTMLElement {
  const { o, part } = c, path = partPath(o.view, part.id).slice(0, -1), w = c.wide;
  // In scenario mode a part the path does not visit is said to be outside it; the path is not extended to it.
  const scHere = scView ? scView.visits.filter(v => drawnRep(o, v.areaId) === part.id || v.areaId === part.id) : null;
  const scLine = scView && scHere ? h('p', { class: `sc-note${scHere.length ? '' : ' sc-out'}` }, ...(scHere.length
    ? [h('strong', {}, '시나리오의 방문'), ' · ', ...scHere.flatMap((v, i) => [i ? ' · ' : '', h('button', { type: 'button', class: 'link-button', onclick: () => selectVisit(v.id) }, `방문 ${visitNumber(v.id)}`)])]
    : [h('strong', {}, '현재 시나리오 밖의 요소'), ' · 이 경로는 이 부분을 지나지 않아요'])) : null;
  const crumbs = path.flatMap((x, i) => [i ? h('span', { 'aria-hidden': 'true' }, '›') : null, h('a', { href: hashFor(o.key, x.id, scope), title: x.name }, x.name)]);
  return h('header', { class: `${w ? 'panel-head' : 'lens-head'} pane-head` },
    path.length ? h('div', { class: w ? 'panel-path' : 'lens-path' }, ...crumbs) : w ? h('div', { class: 'panel-path' }, h('span', {}, o.project.name)) : null,
    h('h2', { id: w ? 'panel-title' : 'lens-title', ...(w ? { tabindex: '-1' } : {}) }, part.name),
    aliasOf(o.view, part.id) ? h('p', { class: 'lens-alias' }, aliasOf(o.view, part.id)) : null,
    kindLine(c), storeLine(o, part), scLine, visitEntry(o), tools);
}

/* ---------- 구조 (8.3, with the design review's first-screen chain) ---------- */
function structureTab(c: PaneCtx): HTMLElement[] {
  const u = c.u, cautions = u ? cautionRows(u, new Set(c.ends.filter(x => revisedLine(c.o, x.r.id)).map(x => x.r.id)).size) : [];
  const contract = contractSection(c), behaviour = behaviourSection(c), rules = rulesSection(c), links = linksSection(c), where = whereSection(c);
  const present: Partial<Record<StructureSection, number | true>> = { role: true };
  if (cautions.length) present.caution = cautions.length;
  if (contract) present.contract = flowsIn(c).length + flowsOut(c).length || true;
  if (behaviour) present.behaviour = (u?.steps ?? []).length || true;
  if (rules && u) { const sg = signsOf(u); present.rules = sg.rules.length + sg.gates.length || true; }
  if (links) present.links = true;
  if (where) present.where = true;
  const out = [h('nav', { class: 'pn-jump', 'aria-label': '구조의 절로 가기' }, ...jumpChips(present).map(x => h('button', { type: 'button', class: 'pn-chip', 'data-jump': x.key, onclick: () => jumpTo(x.key) }, x.text))),
    pickedLineBlock(c), chainBlock(c, cautions, !!behaviour), ...structureSections({ contract, behaviour, rules, links, where }), unlinkedSection(c)].filter((x): x is HTMLElement => !!x);
  // One footnote per group for an item its rows all cite (pane-view hoistMarks): 〔파일·2〕 once at the group's head, not on eight rows.
  for (const el of out) mergeFootnotes(el);
  return out;
}
/** The rows of each list under one heading (the chain's 받는 것 · 내는 것, 계약's groups, the steps, conditions, port rows, rules,
 * files, 확인 필요): an item two rows or more cite moves to the heading as one mark (its preview and its click unchanged); a row
 * keeps the marks only it has; a row left with none drops its mark group (its ⋯ menu too: the same in 근거). */
function mergeFootnotes(root: HTMLElement) {
  // rows: each row's mark groups; heading: where the group's one mark goes.
  const hoist = (rows: HTMLElement[][], heading: HTMLElement | null) => {
    if (rows.length < 2 || !heading) return;
    const nums = rows.map(ms => ms.flatMap(m => [...m.querySelectorAll<HTMLElement>(':scope > .fn')].map(b => Number(b.dataset.fn))));
    const { head } = hoistMarks(nums); if (!head.length) return;
    const up = new Set(head), moved = new Map<number, HTMLElement>();
    for (const ms of rows) for (const m of ms) {
      for (const b of [...m.querySelectorAll<HTMLElement>(':scope > .fn')]) { const n = Number(b.dataset.fn); if (!up.has(n)) continue; if (!moved.has(n)) moved.set(n, b); b.remove(); }
      if (!m.querySelector(':scope > .fn')) { if (m.querySelector(':scope > .dispute-chip')) m.querySelector(':scope > .fn-more')?.remove(); else m.remove(); }
    }
    heading.querySelector(':scope > .fn-group')?.remove();
    heading.append(h('span', { class: 'fn-marks fn-group', title: '이 묶음의 행들이 같은 원문을 인용함 · 눌러서 근거 탭에서' }, ...head.map(n => moved.get(n)).filter((b): b is HTMLElement => !!b)));
  };
  for (const list of root.querySelectorAll<HTMLElement>('ul, ol')) {
    const rows = [...list.children].filter((x): x is HTMLElement => x.tagName === 'LI');
    const marksOf = (li: HTMLElement) => [...li.querySelectorAll<HTMLElement>('.fn-marks')].filter(m => m.closest('li') === li && !m.closest('.line-block, .pn-line'));
    const heading = (list.previousElementSibling?.matches('h3, h4') ? list.previousElementSibling : list.parentElement?.querySelector(':scope > h3, :scope > h4')) as HTMLElement | null;
    hoist(rows.map(marksOf), heading);
  }
  // The chain's step names read in one line ('인자 해석 〔파일·2〕 · validate… 〔파일·2〕'): each name is a row of that group.
  for (const p of root.querySelectorAll<HTMLElement>('.chain-steps')) hoist([...p.querySelectorAll<HTMLElement>(':scope > .fn-marks')].map(m => [m]), p.closest('.chain-row')?.querySelector<HTMLElement>(':scope > h4') ?? null);
}
/** 항목 근거 미연결 추출값 (8.3 B6), once per pane at the end, folded: the list values the reading keeps without a line of their own
 * (받는 것 · 내는 것 no line carries, fields, settings, the state kept), with what is missing one click away in 근거. */
function unlinkedSection(c: PaneCtx): HTMLElement | null {
  const u = c.u; if (!u) return null;
  const type = u.typeRead?.type ?? null, labels = listLabels(type);
  const keep = structureKeep(u.loop ?? null, u.stateVars ?? [], u.config, conditionsOf(u), UNSAID);
  const fv = folded(c, 'vars', keep.vars, PANE_SHOWN.list);
  const varsEl = keep.vars.length ? h('div', { class: 'lens-vars' }, h('p', { class: 'pu-sub' }, h('span', { class: 'why-key' }, '유지 상태'), h('small', {}, ` ${keep.vars.length}`)),
    h('ul', { class: 'stp-vars' }, ...fv.shown.map(v => h('li', {}, h('span', { class: 'stp-var' }, v.name, v.scope ? h('small', {}, ` · ${v.scope}`) : null, v.program ? ' ' : null, v.program ? progChip('유지 상태의 이름만 · 범위·읽음·바꿈은 기록에 없음') : null),
      h('span', { class: 'stp-var-rw' }, v.rw)))), fv.more) : null;
  const lists: [string, readonly string[]][] = [[labels.inputs, unlinkedNames(u.inputs, flowsIn(c).map(x => c.handed.get(x.r.id)?.payload))],
    [labels.outputs, unlinkedNames(u.outputs, flowsOut(c).map(x => c.handed.get(x.r.id)?.payload))], [labels.fields, u.fields], [labels.config, u.config]];
  return unlinkedGroup(c, lists, [varsEl]);
}
/** 「선택한 선」 (a line picked on the map or by its type chip): over 구조, what it is (its ends, its channel) and its block (넘기는 것 ·
 * 박자 · 방식 · 채널 · 데이터 계약, each only when the record says it; its quote one footnote away in 근거). The part it leaves reads
 * under it as before; a click on 선 선택 풀기 drops it. */
function pickedLineBlock(c: PaneCtx): HTMLElement | null {
  const pl = pickedLine; if (!pl || pl.part !== c.part.id) return null;
  const rels = c.ends.filter(x => pl.rels.includes(x.r.id)); if (!rels.length) return null;
  const name = (id: string) => partOf(c.o, id)?.name ?? '부분';
  return h('section', { class: 'pn-line', 'data-sec': 'line', 'aria-labelledby': 'pn-h-line' },
    h('div', { class: 'pl-head' }, h('h3', { id: 'pn-h-line', tabindex: '-1', 'data-path': '선택한 선' }, '선택한 선', rels.length > 1 ? h('small', {}, `관계 ${rels.length}`) : null),
      h('button', { type: 'button', class: 'link-button pl-clear', title: '선 선택을 풀고 이 부분의 구조만 읽어요', onclick: () => { pickedLine = null; reread(null); } }, '선 선택 풀기')),
    ...rels.map(x => { const ch = c.lineSaid.get(x.r.id)?.channel ?? null, from = x.out ? name(x.near) : name(x.far), to = x.out ? name(x.far) : name(x.near);
      return h('div', { class: 'pl-rel' }, h('p', { class: 'pl-title' }, h('strong', {}, ...breakable(from)), h('span', { class: 'pl-arrow', 'aria-hidden': 'true' }, x.r.kind === 'related' ? ' — ' : ' → '), h('strong', {}, ...breakable(to)),
        h('span', { class: 'pl-ch' }, ` · ${ch ? CHANNEL_LABEL[ch] : REL_LABEL[x.r.kind] ?? x.r.kind}`)), lineBlock(c, x.r.id)); }));
}
/** The first screen (design review): 하는 일 (its sentences, where they come from) → 받는 것 (three rows) → 동작 요약 (the loop's unit
 * and stop, the first four steps, or 단계 기록 없음) → 내는 것 (three rows) → 확인 필요 (three rows). Each row leads to its section. */
function chainBlock(c: PaneCtx, cautions: CautionRow<CurrentClaim>[], behaviour: boolean): HTMLElement {
  const u = c.u;
  const ports = (label: string, hint: string, list: End[]) => list.length ? h('div', { class: 'chain-row' }, h('h4', { title: hint }, label, h('small', {}, String(list.length))),
    h('ul', { class: 'chain-ports' }, ...list.slice(0, PANE_SHOWN.chain).map(x => chainPort(c, x))),
    list.length > PANE_SHOWN.chain ? h('button', { type: 'button', class: 'link-button pn-more', onclick: () => jumpTo('contract') }, `${list.length - PANE_SHOWN.chain}개 더 · 계약`) : null) : null;
  let act: HTMLElement | null = null;
  if (u) {
    const s = behaviourSummary(u.loop, stepsOf(u), u.config, conditionsOf(u), UNSAID);
    // Steps the program cut from the 3절 chain keep their 「프로그램」 chip; when every step shown is one, a single chip says so for all.
    const allProgram = stepsOf(u).length > 0 && stepsOf(u).every(x => x.program === true);
    act = h('div', { class: 'chain-row chain-act' }, h('h4', { title: '반복의 단위와 정지, 기록의 단계 표 첫 행들 · 행 순서이지 실행 순서가 아니에요' }, '동작 요약'),
      s.loop ? h('p', { class: 'stp-line' }, ...loopNodes(s.loop), fnMarks(c, ['loop'], '반복', false)) : null,
      s.blank ? h('p', { class: 'stp-blank' }, s.blank)
        : h('p', { class: 'chain-steps' }, ...s.steps.flatMap((x, i) => [i ? h('span', { class: 'cs-sep', 'aria-hidden': 'true' }, ' · ') : null, h('span', { class: 'cs-step' }, x.name), x.program && !allProgram ? ' ' : null, x.program && !allProgram ? stepChip() : null, fnMarks(c, [`step:${i}`], `단계 ${x.name}`, false)]),
          s.more ? h('small', {}, ` +${s.more}`) : null, allProgram ? ' ' : null, allProgram ? stepChip() : null),
      behaviour ? h('button', { type: 'button', class: 'link-button pn-more', onclick: () => jumpTo('behaviour') }, '동작 ›') : null);
  }
  const ins = ports('받는 것', '다른 부분이 이 부분에 넘겨주는 것 · 계약에서 전부', flowsIn(c)), outs = ports('내는 것', '이 부분이 다른 부분에 넘겨주는 것 · 계약에서 전부', flowsOut(c));
  return h('section', { class: 'pn-chain', 'aria-label': '이 부분 한눈에' }, roleBlock(c),
    ins || act || outs ? h('div', { class: 'chain-flow' }, ins, act, outs) : null, cautions.length ? cautionBlock(c, cautions) : null);
}
/** 확인 필요 (8.3 읽기 주의): three rows, the rest folded; a claim row keeps its quote. */
function cautionBlock(c: PaneCtx, rows: CautionRow<CurrentClaim>[]): HTMLElement {
  const f = folded(c, 'caution', rows, PANE_SHOWN.caution);
  const cite = (x: CurrentClaim) => fnMarks(c, [claimThing(c, x)], x.text);
  return h('div', { class: 'pn-caution', 'data-sec': 'caution' },
    h('h3', { id: 'pn-h-caution', tabindex: '-1', 'data-path': '확인 필요', title: '이 부분을 읽는 방식을 바꾸는 것 · 기록이 말한 것만' }, '확인 필요', h('small', {}, String(rows.length))),
    h('ul', { class: 'pn-cautions' }, ...f.shown.map(x => h('li', { class: `pc k-${x.kind}`, title: x.hint },
      h('span', { class: 'pc-tag' }, x.label), h('span', { class: 'pc-text' }, x.text), x.about ? h('small', { class: 'pc-about', title: x.about }, ` · ${displayAbout(x.about)}`) : null,
      x.claim ? cite(x.claim) : null))), f.more);
}
/** 하는 일: the description where it comes from (the lens's block, or the wide mode's with its correction), the person's dispute
 * chip when there is one (marking it wrong lives in 근거, beside the passages it rests on). */
function roleBlock(c: PaneCtx): HTMLElement {
  const u = c.u, desc = c.wide ? wideDesc(c) : lensDesc(c);
  const rd = u?.role && !u.corrected ? disputeBits(c.part.id, ROLE_KEY, u.role) : null;
  if (rd?.chip) desc.append(h('p', { class: 'why-dispute cl-meta' }, rd.chip));
  return h('div', { class: 'pn-role', 'data-sec': 'role' }, h('h3', { id: 'pn-h-role', tabindex: '-1', 'data-path': '하는 일' }, '하는 일'), desc);
}
/** The lens's description: its whole description as written, with where that description comes from (the map shows only its first
 * sentence); the description as records read it on its own line under a plan note or a received summary. */
function lensDesc(c: PaneCtx): HTMLElement {
  const { o, part, records } = c, u = part.reading;
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
    // (records, a reported state); "no records yet" and where the text comes from read in the wide mode.
    const state = part.status === 'plan' ? (records.length ? `받은 정리 없음 · 요청 기록 없음 · ${recs}` : '') : `${STATUS_LABEL[part.status]} · ${recs}`;
    put(desc, h('p', { class: 'lens-text' }, rest), state ? src(`적어 둔 계획 설명 · ${state}`) : null);
  } else if (u?.role) {
    // Read from records (or corrected by the person): one description, with where it comes from.
    // The description's passages as footnotes right after it (8.4: the reading keeps no sentence-by-sentence link, so after the whole).
    put(desc, h('p', { class: 'lens-text' }, u.role, roleMarks(c)), src(u.corrected ? '직접 바로잡은 설명' : `기록에서 읽은 설명${u.roleAbout ? ` · ${displayAbout(u.roleAbout)} 기준` : ''}${u.roleBasisRevised ? REVISED_BASIS : ''}`));
    if (u.roleAbout) desc.lastElementChild?.setAttribute('title', u.roleAbout);
  } else put(desc, src(part.status === 'plan' ? (records.length ? `설명 없음 · 요청 기록 없음 · ${recs}` : part.reading ? '기록에서 읽은 말만 있어요' : '아직 설명도 기록도 없어요') : `${STATUS_LABEL[part.status]} · ${recs} · 받은 정리 없음`));
  if (part.changes.length) desc.append(h('ul', { class: 'lens-changes' }, ...part.changes.slice(0, 2).map(x => h('li', {}, x))));
  // The description as records read it, on its own line when a plan note or a received summary stands above it.
  if (u?.role && (part.summary || part.note.trim())) desc.append(h('p', { class: 'why-role' }, h('span', { class: 'why-key' }, u.corrected ? '직접 바로잡은 설명' : '기록에서 읽은 설명'), ' ', h('span', {}, u.role), roleMarks(c)));
  return desc;
}
/** The description's footnotes: one per passage it rests on (none for the person's correction). */
const roleMarks = (c: PaneCtx): HTMLElement | null => (c.u && !c.u.corrected ? fnMarks(c, c.u.roleBasis.map((_, i) => `role:${i}`), '하는 일') : null);
/** The wide mode's description: the received summary or the written plan, then the description as records read it with its
 * correction form (understoodSection), and every recent change. */
function wideDesc(c: PaneCtx): HTMLElement {
  const { o, part, records } = c, now = h('div', { class: 'lens-desc sec-now' });
  if (part.summary) {
    const report = records.find(r => r.kind === 'report');
    now.append(h('p', { class: 'summary' }, part.summary), h('p', { class: 'src' }, `${part.origin ?? '전달받은 정리'}${report ? ` · ${ago(report.at)}` : ''}`));
    if (part.proposal) now.append(h('div', { class: 'proposal' }, h('strong', {}, '제안 · 아직 반영 안 됨'), h('span', {}, part.proposal)));
    if (part.note) now.append(h('p', { class: 'note' }, h('span', {}, '계획'), part.note));
  } else if (part.note) {
    // The written plan reads as the description; the head's line already says whether records exist.
    put(now, h('p', { class: 'lead' }, part.note), h('p', { class: 'src' }, '적어 둔 계획 설명 · 받은 정리 아님'),
      records.length ? h('p', { class: 'summary muted' }, part.childIds.length ? '이 부분 자체에 대한 정리는 아직 없어요. 안의 부분과 기록을 보세요.' : '요청 기록은 있고, 아직 받은 작업 보고는 없어요.') : null);
  } else if (!part.reading) {
    put(now, h('p', { class: 'summary muted' }, records.length ? (part.childIds.length ? '이 부분 자체에 대한 정리는 아직 없어요. 안의 부분과 기록을 보세요.' : '요청 기록은 있고, 아직 받은 작업 보고는 없어요.') : '아직 설명도 연결된 기록도 없어요.'));
  }
  const understood = understoodSection(o, part, roleMarks(c)); if (understood) now.append(understood);
  if (part.changes.length) now.append(h('div', { class: 'sheet-changes' }, h('p', { class: 'why-key' }, '최근 변화'), h('ul', { class: 'changes' }, ...part.changes.map(x => h('li', {}, x)))));
  return now;
}

/* ---------- a line's rows (계약, the chain, 연결) ---------- */
const isPicked = (c: PaneCtx, x: End) => pickedLine?.part === c.part.id && pickedLine.rels.includes(x.r.id);
/** The picked line's block (map-reading.13, line-view lineFacts): 넘기는 것, 박자 (or 박자 미기재), 방식, 채널, the format artifact's
 * fields under 데이터 계약 · N 필드 (one cell each, with the artifact's name), and the line of the record that read it. */
function lineBlock(c: PaneCtx, rel: string): HTMLElement {
  const s = c.lineSaid.get(rel);
  const facts = lineFacts({ payload: s?.payload ?? null, cadence: s?.cadence ?? null, mode: s?.mode ?? null, channel: s?.channel ?? null, fields: s?.fields ?? [] });
  const ct = contractList(s?.payload ?? null, s?.fields ?? []);
  // Only what the record says (a field it left out has no row; their names read in the list's tip). A cadence that points at another
  // row of the record ('위 두 줄과 같음') reads as written, muted, never resolved.
  const said = facts.filter(x => !x.blank), blanks = facts.filter(x => x.blank).map(x => x.text);
  const ref = (x: (typeof facts)[number]) => x.key === 'cadence' && !!s?.cadence && isRelativeRef(s.cadence);
  return h('div', { class: 'line-block', 'data-line-block': rel, role: 'group', 'aria-label': '이 선이 말하는 것' },
    said.length ? h('ul', { class: 'lb-facts', ...(blanks.length ? { title: `기록에 없음 · ${blanks.join(' · ')}` } : {}) }, ...said.map(x => h('li', { 'data-fact': x.key, ...(ref(x) ? { class: 'unres', title: '기록 안의 상대 참조 · 적힌 그대로 (풀지 않음)' } : {}) }, x.text))) : null,
    ct ? h('div', { class: 'lb-contract' }, h('p', { class: 'lb-head', title: '선이 나르는 형식 산출물의 필드 · 기록이 적은 그대로 (타입·단위·필수는 기록이 싣지 않음)' }, ct.head, h('small', {}, ` · ${ct.name}`)),
      h('div', { class: 'xp-cells' }, ...ct.cells.map(x => h('span', { class: 'ledger-cell' }, x)))) : null,
    s?.quote ? h('p', { class: 'lb-cite' }, h('span', { class: 'lb-cite-k' }, '이 선의 원문'), fnMarks(c, [`relation:${rel}`], '이 선', false)) : h('p', { class: 'lb-cite stp-blank' }, '읽은 원문 줄 없음 · 사람이 그린 선'));
}
/** A line's row: the real other end and what goes along the line (what a reading said is handed over: its payload, how often,
 * designed or seen; else the stored note); a line drawn from a folded part summarises its inside, so its row also names the inner
 * end. A row and its line on the map light each other; the picked line's row carries its block. */
function portRow(c: PaneCtx, x: End): HTMLElement {
  const o = c.o, part = c.part, far = partOf(o, x.far)!, near = x.near !== part.id ? partOf(o, x.near)?.name : null, farRep = drawnRep(o, x.far);
  // The scope itself is this scope's boundary, not a place outside it.
  const where = farRep === x.far ? null : x.far === scope ? '이 범위' : farRep ? `${partOf(o, farRep)!.name} 안` : partPath(o.view, x.far).slice(0, -1).map(q => q.name).join(' › ') || o.project.name;
  const came = x.far === c.cameFrom, read = c.handed.get(x.r.id), revised = revisedLine(o, x.r.id), verb = x.r.kind === 'flow' ? null : relLabel(x.r.kind, x.out);
  const picked = isPicked(c, x), line = read?.payload ? `${read.payload}${read.cadence ? ` (${read.cadence})` : ''}${read.mode ? ` · ${MODE_LABEL[read.mode]}` : ''}` : x.r.note;
  return h('li', { ...(picked ? { class: 'picked' } : {}) }, h('button', { type: 'button', class: `port${came ? ' came' : ''}${picked ? ' picked' : ''}`, 'data-far': x.far, 'data-rel': x.r.id, title: `${far.name}${toParticle(far.name)} 가기${verb ? ` · ${verb}` : ''}${came ? ' · 이 관계를 따라 여기로 왔어요' : ''}`, onclick: (e: Event) => { follow(x.far, x.r, e); go(o.key, x.far); }, ...lightOn([x.r.id], x.far) },
    h('span', { class: 'port-top' }, h('span', { class: 'port-dir', 'aria-hidden': 'true' }, dirMark(x.r.kind, x.out)), h('strong', {}, ...breakable(far.name)),
      verb ? h('span', { class: 'port-kind' }, REL_LABEL[x.r.kind] ?? x.r.kind) : null, came ? h('span', { class: 'port-came' }, '출발') : null),
    near || where ? h('span', { class: 'port-where' }, [near ? `안쪽 ‘${near}’에서` : '', where ? `${where}` : ''].filter(Boolean).join(' · ')) : null,
    line || revised ? h('span', { class: 'port-note', 'data-rel-note': x.r.id, ...(read?.payload && x.r.note ? { title: x.r.note } : {}) }, `${line}${revised ? REVISED_BASIS : ''}`.replace(/^ · /, '')) : null),
    // The picked line's block reads once, in 「선택한 선」 over 구조 (pickedLineBlock); its row here is marked.
    fnMarks(c, [`relation:${x.r.id}`], `${far.name}${line ? ` · ${line}` : ''}`));
}
/** A line's row in the chain (and 촉발): one line, the other end and what it carries; the full row reads in 계약. */
function chainPort(c: PaneCtx, x: End): HTMLElement {
  const o = c.o, far = partOf(o, x.far)!, read = c.handed.get(x.r.id), came = x.far === c.cameFrom, verb = x.r.kind === 'flow' ? null : relLabel(x.r.kind, x.out);
  const what = read?.payload ? `${read.payload}${read.cadence ? ` (${read.cadence})` : ''}` : null;
  const picked = isPicked(c, x);
  return h('li', { ...(picked ? { class: 'picked' } : {}) }, h('button', { type: 'button', class: `port chain-port${came ? ' came' : ''}${picked ? ' picked' : ''}`, 'data-far': x.far, 'data-rel': x.r.id,
    title: `${far.name}${toParticle(far.name)} 가기${verb ? ` · ${verb}` : ''}${came ? ' · 이 관계를 따라 여기로 왔어요' : ''}${x.r.note ? `\n${x.r.note}` : ''}`, onclick: (e: Event) => { follow(x.far, x.r, e); go(o.key, x.far); }, ...lightOn([x.r.id], x.far) },
    h('span', { class: 'port-top' }, h('span', { class: 'port-dir', 'aria-hidden': 'true' }, dirMark(x.r.kind, x.out)), h('strong', {}, ...breakable(far.name)),
      what ? h('span', { class: 'chain-what', title: what }, what) : null, came ? h('span', { class: 'port-came' }, '출발') : null)),
    fnMarks(c, [`relation:${x.r.id}`], `${far.name}${what ? ` · ${what}` : ''}`));
}
/** A group of rows per direction, folded at PANE_SHOWN.contract (the picked line always shown). */
function portGroup(c: PaneCtx, what: string, label: string, hint: string, list: End[]): HTMLElement | null {
  if (!list.length) return null;
  const f = folded(c, what, list, PANE_SHOWN.contract, x => isPicked(c, x));
  return h('div', { class: 'lens-ports why-group' }, h('h4', { title: hint, 'data-sub': label }, label, h('small', {}, String(list.length))),
    h('ul', {}, ...f.shown.map(x => portRow(c, x))), f.more);
}
/** 항목 근거 미연결 추출값: list values the reading keeps without a line of their own (pane-view UNLINKED_HEAD), under a quiet head
 * inside the section they belong to; never a cited row. */
function unlinkedGroup(c: PaneCtx, lists: [string, readonly string[]][], extra: (HTMLElement | null)[] = []): HTMLElement | null {
  const rows = lists.filter(([, l]) => l.length), more = extra.filter((x): x is HTMLElement => !!x);
  if (!rows.length && !more.length) return null;
  const n = rows.reduce((a, [, l]) => a + l.length, 0) + more.reduce((a, x) => a + x.querySelectorAll('li').length, 0);
  // Folded at the end of 구조 (it is a diagnostic, not what the part does); its open state is this tab's memory, as the other folds.
  const key = foldKey(c, 'unlinked'), d = h('details', { class: 'pn-unlinked', 'data-sec': 'unlinked', ...(lensOpen.has(key) ? { open: true } : {}) },
    h('summary', { title: UNLINKED_HINT }, h('span', { class: 'pu-head' }, UNLINKED_HEAD), h('small', {}, ` ${n}`)),
    // map design v3 8.4: no footnote here (there is no passage to go to); a text button opens what is missing, in 근거.
    h('p', { class: 'pu-diag' }, '항목마다의 원문 줄이 저장되지 않음 · 선·반복·실행 상태의 근거로 쓰지 않음 ',
      h('button', { type: 'button', class: 'link-button pu-go', 'data-fn-focus': 'unlinked', onclick: () => openEvidence(null, { thing: 'unlinked', label: UNLINKED_HEAD }, undefined, '[data-ev="unlinked"]') }, '진단 ›')),
    rows.length ? h('ul', { class: 'pu-list' }, ...rows.map(([label, l]) => h('li', {}, h('span', { class: 'why-key' }, label), h('span', { class: 'pu-vals' }, l.join(' · '))))) : null, ...more);
  d.addEventListener('toggle', () => { if ((d as HTMLDetailsElement).open) lensOpen.add(key); else lensOpen.delete(key); });
  return d;
}
/** 계약: the kind's first rows (pane-view kindLead), what the part takes in and hands on (each line's full row), then the names the
 * reading lists that no line carries (a name a line's payload says is that line's row), a store's kept cells first. */
function contractSection(c: PaneCtx): HTMLElement | null {
  const { o, u } = c, ins = flowsIn(c), outs = flowsOut(c), type = u?.typeRead?.type ?? null, sg = u ? signsOf(u) : null;
  const lead = kindLead(type, { exits: u ? conditionsOf(u).map(x => x.then) : [], manualRules: sg ? sg.rules.filter(x => (x.enforcedBy ?? []).some(e => e.kind === 'person')).length : 0,
    targets: outs.filter(x => isControl(c, x)).map(x => partOf(o, x.far)?.name ?? '').filter(Boolean) });
  const leadEl = lead.length ? h('ul', { class: 'pn-lead' }, ...lead.map(x => h('li', { title: x.hint }, h('span', { class: 'why-key' }, x.label), h('span', {}, x.text)))) : null;
  // 받는 것 · 내는 것 read once: the rows the first-screen chain shows are not repeated here (one line says so); the rest follow.
  const n = PANE_SHOWN.chain, restIn = ins.slice(n), restOut = outs.slice(n);
  const inG = portGroup(c, 'in', ins.length > n ? '그 밖의 받는 것' : '받는 것', '다른 부분이 이 부분에 넘겨주는 것 · 처음 몇 행은 위 동작 요약에', restIn);
  const outG = portGroup(c, 'out', outs.length > n ? '그 밖의 내는 것' : '내는 것', '이 부분이 다른 부분에 넘겨주는 것 · 처음 몇 행은 위 동작 요약에', restOut);
  const inChain = Math.min(n, ins.length), outChain = Math.min(n, outs.length);
  const above = inChain + outChain ? h('p', { class: 'pn-above' }, [inChain ? `받는 것 ${inChain}` : '', outChain ? `내는 것 ${outChain}` : ''].filter(Boolean).join(' · '), '은 위 동작 요약에', h('span', { 'aria-hidden': 'true' }, ' ↑')) : null;
  // The card says nothing when the record names no input or output (map design v3 0.1): the words read here, once.
  const noPorts = u && !u.inputs.length && !u.outputs.length && !(u.portMap ?? []).length
    ? h('p', { class: 'pn-blank-note', title: '기록이 이 부분이 받는 것·내는 것을 항목으로 말하지 않았다 · 관계선은 카드 수준 접점에 붙는다' }, '데이터 입력·출력 포트 미기록') : null;
  if (!leadEl && !inG && !outG && !noPorts) return null;
  const count = ins.length + outs.length ? `받는 것 ${ins.length} · 내는 것 ${outs.length}` : null;
  return secEl('contract', count, '', leadEl, noPorts, inG || outG ? above : null, inG, outG);
}
/** 연결: what the part is with (needs, shares, related; each row says its verb), an open group's inner parts' links to the outside,
 * and the explicit way in. */
function linksSection(c: PaneCtx): HTMLElement | null {
  const { o, part } = c, b = lay.boxes.get(part.id);
  const together = portGroup(c, 'with', '함께', '필요로 함 · 함께 씀 · 관련', relationGroups(c.ends.filter(x => x.r.kind !== 'flow')).flatMap(g => g.list));
  // A group drawn open: the lines that touch its frame belong to its inner parts. They read here from those parts, by verb and
  // direction, each row naming the inner part, the outside part and where that one belongs; following one records a visit.
  // Relations between two of its inner parts are drawn inside it and only counted.
  const inner = b?.kind === 'frame' ? insideEnds(o.view, part.id) : null;
  const innerRow = (x: End) => {
    const near = partOf(o, x.near), far = partOf(o, x.far); if (!near || !far) return null;
    const where = partPath(o.view, x.far).slice(0, -1).map(q => q.name).join(' › ') || o.project.name, came = x.far === c.cameFrom;
    return h('li', {}, h('button', { type: 'button', class: `port fr-port${came ? ' came' : ''}`, 'data-far': x.far, 'data-rel': x.r.id, title: `${far.name}${toParticle(far.name)} 가기 · ${REL_LABEL[x.r.kind] ?? x.r.kind}${came ? ' · 이 관계를 따라 여기로 왔어요' : ''}`, onclick: (e: Event) => { follow(x.far, x.r, e); go(o.key, x.far); }, ...lightOn([x.r.id], x.far) },
      h('span', { class: 'port-top' }, h('span', { class: 'fr-near' }, near.name), h('span', { class: 'port-dir', 'aria-hidden': 'true' }, dirMark(x.r.kind, x.out)), h('strong', {}, ...breakable(far.name)), came ? h('span', { class: 'port-came' }, '출발') : null),
      h('span', { class: 'port-where' }, `${where} 안`),
      x.r.note ? h('span', { class: 'port-note', 'data-rel-note': x.r.id }, x.r.note) : null));
  };
  const innerSection = inner && (inner.outside.length || inner.within) ? h('div', { class: 'lens-ports frame-rels', role: 'group', 'aria-label': '안쪽 부분의 바깥 연결' },
    inner.outside.length ? h('h4', { 'data-sub': '안쪽 부분의 바깥 연결' }, '안쪽 부분의 바깥 연결', h('small', {}, String(inner.outside.length))) : null,
    ...relationGroups(inner.outside, '안쪽').flatMap(g => {
      const f = folded(c, `inner-${g.label}`, g.list, PANE_SHOWN.list);
      return [h('h4', { class: 'fr-verb' }, g.label, h('small', {}, String(g.list.length))), h('ul', {}, ...f.shown.map(innerRow)), f.more];
    }),
    inner.within ? h('p', { class: 'fr-within' }, `안에서 서로 ${inner.within}`) : null) : null;
  // Inside: on the map already when the part is an open frame; else its names (the wide mode: each a link), and the explicit way in.
  const kids = part.childIds.map(id => partOf(o, id)!).filter(Boolean);
  const inside = kids.length && part.id !== scope ? h('div', { class: 'lens-inside' },
    c.wide ? h('div', { class: 'kids' }, ...kids.map(k => { const m = metaLine(k, k.childIds.length ? subtreeRecords(o.view, k.id)[0]?.at ?? null : k.lastAt);
      return h('a', { class: `kid s-${k.status}`, href: hashFor(o.key, k.id, scope) }, h('span', {}, k.name), k.childIds.length ? h('small', {}, `안쪽 ${k.childIds.length}`) : null, m ? h('small', {}, m) : null); }))
      : b?.kind === 'frame' ? null : h('p', {}, h('span', {}, `안쪽 ${kids.length}`), kids.map(k => k.name).join(' · ')),
    h('button', { type: 'button', class: 'go-in', onclick: () => go(o.key, null, part.id) }, `안으로 들어가기 · ${kids.length}`, h('span', { 'aria-hidden': 'true' }, ' ›'))) : null;
  if (!together && !innerSection && !inside) return null;
  return secEl('links', null, '', together, innerSection, inside);
}

/** The lens: the fixed head and tab row, one tab's body, the foot (asking first when the AI is connected, then the wide mode). */
function renderLens() {
  const o = opened!, part = partOf(o, selected)!, l = $('lens');
  if (lensRail) {
    // Folded to a rail: the selection's name, read top to bottom, and the way to open the reading again.
    l.classList.remove('compare', 'scope-read', 'return-read'); l.classList.add('railed'); readingFor = [];
    l.replaceChildren(h('button', { type: 'button', class: 'rail-toggle', 'aria-label': '읽기면 펼치기', 'aria-expanded': 'false', title: `읽기면 펼치기 · ${part.name}`, onclick: () => setRail(false) }, railIcon(false)),
      h('span', { class: 'rail-name', id: 'lens-title', title: part.name, onclick: () => setRail(false) }, part.name));
    l.hidden = false; return;
  }
  l.classList.remove('railed');
  const c = paneCtx(o, part, false), thread = answersOf(o, part.id).length;
  const menuItems = [
    o.kind !== 'legacy' ? h('button', { type: 'button', role: 'menuitem', onclick: () => { editing = true; paneTab = 'structure'; openSheet(() => document.getElementById('edit-name')?.focus()); } }, '이름·설명 고치기') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', onclick: () => openPartForm(part.id) }, '안에 부분 추가') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', title: '이 부분을 보던 맥락으로 원문을 붙여 넣어요', onclick: () => openPaste(part.id) }, '기록 붙여넣기') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', title: '코드나 검사 기록 파일 하나를 원문 그대로 자료로 보관해요 (이 부분은 읽기 맥락일 뿐이에요)', onclick: () => openFile(part.id) }, '코드·검사 자료 추가') : null,
    o.kind !== 'legacy' ? h('button', { type: 'button', role: 'menuitem', title: '이 부분을 새 세션에 넘길 문서를 만들어요', onclick: () => handover.open(part.id, document.querySelector<HTMLElement>('#lens details.more summary')) }, '이 부분 인수인계 문서') : null
  ].filter((x): x is HTMLButtonElement => !!x);
  l.classList.remove('compare', 'scope-read', 'scenario-read'); readingFor = [];
  const tools = h('div', { class: 'head-tools' },
    menuItems.length ? h('details', { class: 'more' }, h('summary', { 'aria-label': '이 부분 고치기', title: '고치기' }, '⋯'), h('div', { class: 'more-menu', role: 'menu', onclick: (e: Event) => { ((e.currentTarget as HTMLElement).parentElement as HTMLDetailsElement).open = false; } }, ...menuItems)) : null,
    h('button', { type: 'button', class: 'rail-toggle', 'aria-label': '읽기면 접기', 'aria-expanded': 'true', title: '읽기면 접기 · 지도를 넓게 봐요', onclick: () => setRail(true) }, railIcon(true)),
    h('button', { type: 'button', class: 'close', 'aria-label': '선택 해제', title: '닫기 (Esc)', onclick: () => go(o.key) }, '×'));
  const body = h('div', { class: 'lens-body', id: 'pane-tabpanel', role: 'tabpanel', 'aria-labelledby': `pane-tab-${paneTab}`, 'data-tab': paneTab }, ...tabBody(c));
  l.replaceChildren(paneGrip(), paneHead(c, tools), tabRow(c), stickyBar(), body,
    h('footer', { class: 'lens-foot' },
      status.ai === 'deepseek' ? h('button', { type: 'button', class: 'primary small lens-ask', onclick: () => { composerOpen = true; paneTab = entryTab('ask'); openSheet(() => document.getElementById(status.access === 'code' && !sessionCode() ? 'access-code' : 'ask-input')?.focus()); } }, '이 부분에 대해 묻기') : null,
      h('button', { type: 'button', class: 'lens-more', title: '같은 탭을 넓게 읽어요 · 근거 탭에 기록 원문과 정리 결과', onclick: () => openSheet() }, c.records.length ? `넓게 읽기 · 기록 ${c.records.length}` : '넓게 읽기', thread ? ` · 정리 ${thread}` : '', h('span', { 'aria-hidden': 'true' }, ' ›'))));
  l.hidden = false;
  clampNotes(l, o, part.id); bindSticky(body);
  if (pickedLine?.part === part.id && paneTab === 'structure') requestAnimationFrame(() => { const b = l.querySelector<HTMLElement>('.lens-body'); if (b) b.scrollTop = 0; });
  if (signFocus && signOpen?.part === part.id) {
    signFocus = false; const kind = signOpen.kind, pick = signPick;
    // Read at the frame from the lens as it then stands (the arrival may have drawn it again meanwhile).
    requestAnimationFrame(() => { const now = l.querySelector<HTMLElement>('.lens-body'), at = now?.querySelector<HTMLElement>(`[data-sign-focus="${kind}"]`); if (at) { scrollToHead(at); at.focus({ preventScroll: true }); }
      if (pick) now?.querySelector<HTMLElement>(`[data-sign-pick="${CSS.escape(pick)}"]`)?.scrollIntoView({ block: 'nearest' }); });
  }
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

/* ---------- footnotes (map design v3 8.4, slice S2) ----------
 * Right after a sentence or a row of 구조 (and of 이력): its items' marks 〔보고·7〕 (pane-view footMarks: the author's tag and the
 * item's number; 〔7〕 when the line has no tag; two side by side; more as 〔보고·3 +2〕), each a 24×24 target. Hover or focus (250 ms)
 * opens the one preview (the passage's first lines, the record, where in it, when; 「근거 탭에서 보기 ›」): it stays while the pointer
 * is over it and Esc closes it (WCAG 1.4.13). A click or Enter opens the item in 근거 (scrolled to, marked 1.6 s, then outlined until
 * the next action, its heading focused), with the strip back to where it was opened: the first such point is kept while other
 * passages are opened (up to five held), and dropped when 구조 is read again or another part is picked. A quiet ⋯ after the marks
 * holds 「근거에서 보기」 and 「이 해석이 틀림…」 (8.6, which opens the note's form beside the passage). */
const thingUse = (it: EvidenceItem<CurrentClaim>, thing: string): EvidenceUse<CurrentClaim> => it.uses.find(u => u.thing === thing) ?? it.uses[0]!;
/** A claim's thing (the key 구조 looks its item up by), or null when the claim is not in the book. */
function claimThing(c: PaneCtx, x: CurrentClaim): string | null { const it = c.book.claim.get(x); return it?.uses.find(u => u.claim === x)?.thing ?? null; }
function fnMarks(c: PaneCtx, things: readonly (string | null | undefined)[], label: string, menu = true): HTMLElement | null {
  const pairs = things.flatMap(t => { const it = t ? c.book.thing.get(t) : undefined; return it && t ? [{ t, it }] : []; });
  if (!pairs.length) return null;
  const first = pairs[0]!, use = thingUse(first.it, first.t), o = c.o;
  const notes = o.kind === 'legacy' ? [] : disputeNotes(o, c.part.id, use.ref, use.said);
  return h('span', { class: 'fn-marks' }, ...footMarks(pairs.map(p => p.it)).map(m => fnButton(c, m.item, m.text, pairs.find(p => p.it === m.item)!.t, label, m.more)),
    notes.length ? h('s', { class: 'dispute-chip', title: disputeTitle(notes) }, '틀림 표시') : null,
    menu ? fnMenu(c, first.it, first.t, label) : null);
}
function fnButton(c: PaneCtx, it: EvidenceItem<CurrentClaim>, text: string, thing: string, label: string, more = 0): HTMLElement {
  const b = h('button', { type: 'button', class: 'fn', 'data-fn': String(it.n), 'data-fn-focus': thing, 'data-fn-label': label,
    'aria-label': `근거 ${it.n}${it.grade ? ` · 작성자 꼬리표 ${EVIDENCE_LABEL[it.grade]}` : ' · 꼬리표 없음'}${more ? ` · 외 ${more}` : ''} · 근거 탭에서 보기`,
    onclick: () => openEvidence(it, { thing, label }) }, text);
  bindPreview(c, b, it, more);
  return b;
}
/** The row's ⋯ (8.6 보조 자리): 근거에서 보기 and 이 해석이 틀림… (the form opens in 근거, beside the passage). */
function fnMenu(c: PaneCtx, it: EvidenceItem<CurrentClaim>, thing: string, label: string): HTMLElement | null {
  if (c.o.kind === 'legacy') return null;
  const menu = h('details', { class: 'more fn-more' }, h('summary', { 'aria-label': `${label} · 더 보기`, title: '이 행의 근거 · 틀림 표시' }, '⋯'),
    h('div', { class: 'more-menu', role: 'menu', onclick: (e: Event) => { ((e.currentTarget as HTMLElement).parentElement as HTMLDetailsElement).open = false; } },
      h('button', { type: 'button', role: 'menuitem', onclick: () => openEvidence(it, { thing, label }) }, `근거에서 보기 · ${footText(it)}`),
      h('button', { type: 'button', role: 'menuitem', onclick: () => openEvidence(it, { thing, label }, thingUse(it, thing)) }, '이 해석이 틀림…')));
  return menu;
}
/* The one preview. */
let fnPopEl: HTMLElement | null = null, fnOwner: HTMLElement | null = null, fnTimer = 0, fnClose = 0;
function fnPop(): HTMLElement {
  if (fnPopEl?.isConnected) return fnPopEl;
  const el = h('div', { id: 'fn-pop', class: 'fn-pop', role: 'tooltip', hidden: true });
  el.addEventListener('pointerenter', () => window.clearTimeout(fnClose));
  el.addEventListener('pointerleave', () => closePreviewSoon());
  document.body.append(el); fnPopEl = el; return el;
}
const previewShown = () => !!fnPopEl && !fnPopEl.hidden;
function hidePreview() {
  window.clearTimeout(fnTimer); window.clearTimeout(fnClose);
  if (fnPopEl) fnPopEl.hidden = true;
  fnOwner?.removeAttribute('aria-describedby'); fnOwner = null;
}
function closePreviewSoon() { window.clearTimeout(fnClose); fnClose = window.setTimeout(hidePreview, 200); }
function bindPreview(c: PaneCtx, b: HTMLElement, it: EvidenceItem<CurrentClaim>, more: number) {
  const open = () => { window.clearTimeout(fnClose); window.clearTimeout(fnTimer); if (fnOwner === b && previewShown()) return; fnTimer = window.setTimeout(() => showPreview(c, b, it, more), 250); };
  b.addEventListener('pointerenter', open); b.addEventListener('focus', open);
  b.addEventListener('pointerleave', () => { window.clearTimeout(fnTimer); closePreviewSoon(); });
  b.addEventListener('blur', () => { window.clearTimeout(fnTimer); if (!fnPopEl?.matches(':hover')) closePreviewSoon(); });
}
/** The texts of the project's records, once per project object (where a quote stands: its heading and table row). */
const textsOf = new WeakMap<Project, ReturnType<typeof recordTexts>>();
function placeOf(o: Opened, q: ReadingQuote): string | null {
  let t = textsOf.get(o.project); if (!t) { t = recordTexts(o.project); textsOf.set(o.project, t); }
  const text = t.get(q.record)?.read; if (!text) return null;
  const p = quotePlace(text, q); return [p.heading, p.row ? `${p.row} 행` : null].filter(Boolean).join(' › ') || null;
}
/** The time the record names for what an item says (대상 시각): a claim's own when, the operations line's. */
function itemWhen(c: PaneCtx, it: EvidenceItem<CurrentClaim>): string | null {
  for (const u of it.uses) { const w = u.claim ? claimWhen(u.claim) : u.kind === 'state' ? c.u?.stateRead?.when ?? null : null; if (w) return w; }
  return null;
}
const mapReadings = (o: Opened): MapReading[] => o.project.readings.filter(isMapReading);
/** The records' own written time the reading that read an item gives (basisAt: one value for the reading's records). */
function itemWritten(c: PaneCtx, it: EvidenceItem<CurrentClaim>): string | null {
  const rs = mapReadings(c.o);
  for (const u of it.uses) { const r = u.claim ? rs.find(x => x.id === u.claim!.reading) : u.at ? rs.find(x => x.at === u.at) : undefined; if (r?.basisAt) return r.basisAt; }
  return null;
}
function showPreview(c: PaneCtx, b: HTMLElement, it: EvidenceItem<CurrentClaim>, more: number) {
  if (!b.isConnected || !opened) return;
  const el = fnPop(), info = recordInfo(c.o, it.quote.record), place = placeOf(c.o, it.quote), when = itemWhen(c, it);
  el.replaceChildren(
    h('p', { class: 'fp-head' }, h('span', { class: 'fp-title' }, '원문 인용'),
      it.grade ? h('span', { class: `ev ev-${it.grade}`, title: `${EVIDENCE_HINT[it.grade]} · 기록 작성자의 꼬리표 · 앱이 확인한 것 아님` }, EVIDENCE_LABEL[it.grade]) : h('span', { class: 'fp-untagged' }, '꼬리표 없음'),
      h('span', { class: 'fp-n' }, `근거 ${it.n}${more ? ` 외 ${more}` : ''}`)),
    h('q', { class: 'fp-quote' }, popLine(it.quote.quote)),
    h('p', { class: 'fp-src' }, [info.name, place, when ? `대상 ${when}` : info.at ? `가져옴 ${ago(info.at)}` : null].filter(Boolean).join(' · ')),
    h('button', { type: 'button', class: 'link-button fp-go', tabindex: '-1', onclick: () => openEvidence(it, { thing: b.dataset.fnFocus ?? '', label: b.dataset.fnLabel ?? '' }) }, '근거 탭에서 보기 ›'));
  el.hidden = false;
  const r = b.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 16);
  el.style.width = `${w}px`;
  el.style.left = `${Math.round(Math.min(Math.max(8, r.left - 12), window.innerWidth - w - 8))}px`;
  const ht = el.offsetHeight; let top = r.bottom + 6;
  if (top + ht > window.innerHeight - 8 && r.top - 6 - ht > 8) top = r.top - 6 - ht;
  el.style.top = `${Math.round(top)}px`;
  fnOwner?.removeAttribute('aria-describedby'); fnOwner = b; b.setAttribute('aria-describedby', 'fn-pop');
}
/** Where a footnote was opened from: the tab, its scroll, the mark (data-fn-focus) and the row's words for the strip. */
interface ReturnPoint { key: string; part: string; tab: PaneTab; scroll: number; thing: string; label: string }
let evReturn: ReturnPoint[] = [];
const evOpenKey = (o: Opened, part: string, span: string) => `${o.key}|${part}|ev-item|${span}`;
/** An item in 근거: unfolded, scrolled to, marked; with the note's form open when asked (8.6 보조 자리). Target: another place in 근거
 * to go to instead (항목 근거 미연결's group). */
function openEvidence(it: EvidenceItem<CurrentClaim> | null, from: { thing: string; label: string }, dispute?: EvidenceUse<CurrentClaim>, target?: string) {
  const o = opened; if (!o || !selected) return;
  hidePreview();
  const body = paneBody(), point: ReturnPoint = { key: o.key, part: selected, tab: paneTab, scroll: body?.scrollTop ?? 0, thing: from.thing, label: from.label };
  if (paneTab !== 'evidence') evReturn = [point];
  else if (evReturn.length) evReturn = pushReturn(evReturn, point);
  evidenceView = 'claims';
  if (it) { lensOpen.add(evOpenKey(o, selected, it.key)); if (it.section === 'other') lensOpen.add(`${o.key}|${selected}|ev-other`); }
  if (dispute && it) disputing = { part: selected, key: dispute.ref, span: it.key };
  if (paneTab !== 'evidence') setPaneTab('evidence'); else reread(null);
  const at = paneBody()?.querySelector<HTMLElement>(it ? `[data-ev-n="${it.n}"]` : target ?? ''); if (!at) return;
  scrollToHead(at);
  // The strip back stays over the top of 근거 (sticky): the item comes in under it, not behind it.
  const strip = paneBody()?.querySelector<HTMLElement>(':scope > .ev-return'), sb = paneBody(); if (strip && sb) sb.scrollTop -= strip.offsetHeight + 8;
  flashItem(at);
  const focus = dispute ? at.querySelector<HTMLElement>('.dispute-form input') : at.querySelector<HTMLElement>(':scope > .ev-head, :scope > h3');
  focus?.focus({ preventScroll: true });
}
/** 1.6 s of the mark colour, then a 2px outline until the next action (a pointer press or a key). */
function flashItem(el: HTMLElement) {
  el.classList.add('fn-flash'); let done = false;
  const off = () => { done = true; el.classList.remove('fn-flash', 'fn-ring'); document.removeEventListener('pointerdown', off, true); document.removeEventListener('keydown', off, true); };
  window.setTimeout(() => { if (done) return; el.classList.remove('fn-flash'); el.classList.add('fn-ring'); }, 1600);
  window.setTimeout(() => { document.addEventListener('pointerdown', off, true); document.addEventListener('keydown', off, true); }, 0);
}
/** The strip over 근거 while a way back is held: back to the first point (its tab, scroll, folds and the same mark focused). */
function returnStrip(c: PaneCtx): HTMLElement | null {
  const p = evReturn[0]; if (!p || p.part !== c.part.id || p.key !== c.o.key) return null;
  const where = p.tab === 'history' ? '이력' : '구조';
  return h('div', { class: 'ev-return' }, h('button', { type: 'button', class: 'link-button ev-back', title: `${where} 탭의 떠나온 자리로 · 스크롤·펼침·초점 그대로 (패널에 초점이 있을 때 Alt+←)`, onclick: () => goReturn() },
    h('span', { 'aria-hidden': 'true' }, '← '), `${where}${where === '이력' ? '으로' : '로'} 돌아가기`, p.label ? h('span', { class: 'ev-back-at' }, ` (‘${p.label.length > 40 ? `${p.label.slice(0, 39)}…` : p.label}’)`) : null));
}
function goReturn(): boolean {
  const o = opened, p = evReturn[0]; if (!o || !selected || !p || p.part !== selected || p.key !== o.key) return false;
  evReturn = []; hidePreview();
  const body = paneBody(); if (body) tabScroll.set(scrollKey(o, selected, paneTab), body.scrollTop);
  paneTab = p.tab;
  if (sheetOpen) renderPanel(false); else renderLens();
  const next = paneBody(); if (next) next.scrollTop = p.scroll;
  const mark = [...(next?.querySelectorAll<HTMLElement>('[data-fn-focus]') ?? [])].find(b => b.dataset.fnFocus === p.thing);
  (mark ?? paneRoot().querySelector<HTMLElement>(`[role="tab"][data-tab="${p.tab}"]`))?.focus({ preventScroll: true });
  return true;
}
/** The lines leaving a part (from it or from inside it to a part outside it), each once: what its steps may hand over along. */
function outLines(o: Opened, id: string): OutLine[] {
  const holds = (x: string) => { for (let q = partOf(o, x), g = 0; q && g < 64; q = partOf(o, q.parentId), g++) if (q.id === id) return true; return false; };
  return o.view.relations.filter(r => r.kind === 'flow' && holds(r.from) && !holds(r.to)).map(r => ({ relationId: r.id, far: r.to }));
}
/** 동작 (map design v3 8.3 row 4; map-reading.9–14): what starts the part (its incoming control lines), how it repeats, stops and
 * resumes (one line, 「프로그램」 where the program filled it), 안의 단계 (each step with what it does, what it uses and its row's
 * citation; the picked one also reads who takes what it hands over — spec 7, 소비자 — and how the part stops and resumes), the
 * condition rows with the step each stands on, the record's port → step correspondences; then, under 「항목 근거 미연결 추출값」, the
 * state it keeps and its settings (no line of their own). Open by default (cycle 5's fold is retired); long lists fold at eight.
 * Nothing when the readings gave none of them. */
function behaviourSection(c: PaneCtx): HTMLElement | null {
  const { o, part } = c, r = c.u; if (!r) return null;
  const steps = r.steps ?? [], loop = r.loop ?? null, vars = r.stateVars ?? [], conds = conditionsOf(r), pm = r.portMap ?? [];
  const keep = structureKeep(loop, vars, r.config, conds, UNSAID), fr = r.fileRoles ?? [];
  const triggers = flowsIn(c).filter(x => isControl(c, x));
  const blocks: (HTMLElement | null)[] = [];
  if (triggers.length) blocks.push(h('div', { class: 'bh-block bh-trigger' }, h('h4', { 'data-sub': '촉발', title: '이 부분을 기동하는 제어 선 (들어오는 것)' }, '촉발', h('small', {}, String(triggers.length))),
    h('ul', { class: 'chain-ports' }, ...triggers.map(x => chainPort(c, x)))));
  // map-reading.13: what the program filled carries 「프로그램」 (pane-view structureKeep), never read as the model's.
  if (loop) blocks.push(h('div', { class: 'bh-block lens-loop' }, h('h4', { 'data-sub': '반복' }, '반복'),
    h('p', { class: 'stp-line' }, h('span', {}, ...loopNodes(keep.loop!)), fnMarks(c, ['loop'], '반복'))));
  if (steps.length) {
    const lines = outLines(o, part.id);
    const item = (s: (typeof steps)[number]) => {
      const i = steps.indexOf(s), on = pickedStep?.part === part.id && pickedStep.name === s.name;
      // map-reading.14: a program step is a name only (stepFace), a port only the program mapped to it reads 「프로그램 대응」.
      const sp = stepPorts(s.name, pm), face = stepFace(s);
      const portWords = (m: string, list: typeof sp.ins) => list.length ? [h('span', { 'aria-hidden': 'true' }, `${m} `), ...list.flatMap((x, k) => [k ? ', ' : null, x.port, x.program ? ' ' : null, x.program ? portChip('pane', x.port) : null])] : [];
      const cons = on ? stepConsumers(s.name, pm, lines) : null;
      return h('li', { class: `stp-step${on ? ' on' : ''}` },
        h('div', { class: 'stp-top' },
          h('button', { type: 'button', class: 'stp-pick', 'aria-expanded': String(on), title: on ? '이 단계 접기' : '이 단계 읽기 · 소비자와 실패·재개', onclick: () => pickStep(part.id, s.name) },
            h('span', { class: 'stp-n', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'stp-name' }, s.name)),
          face.program ? stepChip() : null,
          fnMarks(c, [`step:${i}`], `단계 ${s.name}`)),
        face.does ? h('p', { class: 'stp-does' }, face.does) : null,
        face.uses.length ? h('ul', { class: 'where-chips stp-uses', 'aria-label': '쓰는 것' }, ...face.uses.map(u => { const f = fileRoleOf(u, fr); return h('li', { class: 'wh', title: f ? `${u}
파일 지도 · ${f.path} · ${f.role}` : u }, u); })) : null,
        on ? h('div', { class: 'stp-more' },
          sp.ins.length || sp.outs.length ? h('p', { class: 'stp-ports' }, ...portWords('⇥', sp.ins), sp.ins.length && sp.outs.length ? '  ' : null, ...portWords('⇤', sp.outs)) : null,
          h('p', { class: 'stp-label' }, cons!.mapped ? '소비자 · 이 단계에서 나가는 선' : '소비자 · 이 부분에서 나가는 선 (이 단계와의 대응은 기록에 없음)'),
          cons!.list.length ? h('ul', { class: 'stp-cons' }, ...cons!.list.map(x => h('li', {}, h('button', { type: 'button', class: 'link-button', title: `${partOf(o, x.far)?.name ?? '부분'}${toParticle(partOf(o, x.far)?.name ?? '부분')} 가기`, onclick: () => go(o.key, x.far) },
            partOf(o, x.far)?.name ?? '부분'), x.port ? h('small', {}, ` · ${x.port}`) : null))) : h('p', { class: 'stp-blank' }, '나가는 선 없음'),
          h('p', { class: 'stp-label' }, '실패·재개'),
          h('p', { class: loop?.stop || loop?.resume ? 'stp-line' : 'stp-blank' }, ...(loop?.stop || loop?.resume ? loopNodes(keep.loop!.slice(1)) : ['실패 대응 미제공']))) : null);
    };
    const f = folded(c, 'steps', steps, PANE_SHOWN.steps, s => pickedStep?.part === part.id && pickedStep.name === s.name), n = stepCounts(steps);
    blocks.push(h('div', { class: 'bh-block lens-steps' }, h('h4', { 'data-sub': '단계', title: '기록의 단계 표, 행의 순서대로. 단계 사이의 순서·분기는 읽지 않았다.' }, '안의 단계', h('small', {}, n.program ? `${n.recorded} (+${n.program} 프로그램)` : String(steps.length))),
      h('ol', { class: 'stp-list' }, ...f.shown.map(item)), f.more));
  }
  if (conds.length) {
    // map-reading.12: the condition rows, each with the step it stands on (the detail view's rule) or 단계 미상, and its row.
    const f = folded(c, 'conds', structureConditions(conds, steps), PANE_SHOWN.list);
    blocks.push(h('div', { class: 'bh-block lens-conds' }, h('h4', { 'data-sub': '조건', title: '기록의 조건·거부·분기 표, 행마다 · 조건 → 그때의 결과 · 아니면의 결과는 기록이 적은 때만' }, '조건', h('small', {}, String(conds.length))),
      h('ul', { class: 'stp-conds' }, ...f.shown.map(x => h('li', { 'data-cond': String(x.index) }, h('span', { class: 'stp-cond' }, x.text),
        h('small', { class: `stp-cond-at${x.step === null ? ' stp-blank' : ''}`, title: x.step === null ? '조건의 말이 이 부분의 어느 단계도 이름으로 짚지 않음' : '조건의 말이 이 단계를 이름으로 짚음' }, x.step === null ? CONDITION_BLANK : `단계 ‘${x.step}’`),
        fnMarks(c, [`condition:${x.index}`], `조건 ${x.condition.when}`)))), f.more));
  }
  if (pm.length) {
    // map-reading.9/14: the record's explicit line → port → step rows; a row only the program made reads 「프로그램 대응」.
    const f = folded(c, 'portmap', pm, PANE_SHOWN.list);
    blocks.push(h('div', { class: 'bh-block lens-portmap' }, h('h4', { 'data-sub': '포트 대응', title: '기록이 선을 이 부분의 포트와 단계에 이은 행 · 명시된 대응만' }, '포트 대응', h('small', {}, String(pm.length))),
      h('ul', { class: 'stp-conds' }, ...f.shown.map(m => h('li', {}, h('span', { class: 'stp-cond' }, m.direction === 'in' ? `⇥ ${m.port} → 단계 ‘${m.step}’` : `단계 ‘${m.step}’ → ${m.port} ⇤`),
        m.program ? portChip('pane', m.port) : null, fnMarks(c, [`portmap:${pm.indexOf(m)}`], `포트 대응 ${m.port}`)))), f.more));
  }
  // The state kept and the settings (no line of their own) read once, folded, at the end of 구조 (unlinkedSection).
  if (!blocks.length) return null;
  return secEl('behaviour', structureSummary({ steps: steps.length, conditions: conds.length, loop: !!loop, vars: vars.length }) || null, '', ...blocks);
}
/** 어디에: where the part lives, as the records name it: the 파일 지도 rows as '경로 · 역할' with their row (four, then folded), the
 * files, folders or units readings gave it and the places its current claims name (each once, up to eight, as written), then the
 * sessions behind it (one line; the wide mode lists them). Left out when there is nothing. */
function whereSection(c: PaneCtx): HTMLElement | null {
  const { o, part } = c;
  // map-reading.14: a file a 파일 지도 row gives a role reads '경로 · 역할' with its row (pane-view whereRows); the rest as chips.
  const w = whereRows([...(part.reading?.files ?? []), ...(part.reading?.claims ?? []).map(x => x.where)], part.reading?.fileRoles ?? []);
  const sessions = c.wide ? sessionsSection(o.project, part.id) : sessionsLine(o.project, part.id);
  if (!w.roles.length && !w.plain.length && !sessions) return null;
  const f = folded(c, 'where', w.roles, PANE_SHOWN.where);
  return secEl('where', null, 'lens-where',
    f.shown.length ? h('ul', { class: 'where-roles', 'aria-label': '파일 지도' }, ...f.shown.map(x => h('li', { class: 'wr', title: `파일 지도 · ${x.path}
역할 · ${x.role}` },
      h('span', { class: 'wh wr-path' }, x.path), h('span', { class: 'wr-sep', 'aria-hidden': 'true' }, '·'), h('span', { class: 'wr-role' }, x.role),
      fnMarks(c, [`file:${pathKey(x.path)}`], `파일 ${x.path}`)))) : null, f.more,
    w.plain.length ? h('ul', { class: 'where-chips' }, ...w.plain.map(x => h('li', { class: 'wh', title: x }, x))) : null, sessions);
}
/** What readings said each relation hands over (map-reading.7): per relation, the newest reading's line that names a payload. */
function relationPayloads(project: Project): Map<string, ReadingRelation> {
  const out = new Map<string, ReadingRelation>();
  for (const r of project.readings) if (isMapReading(r)) for (const x of r.relations) if (x.payload) out.set(x.relationId, x);
  return out;
}
/** What each relation's line carries and says (map-reading.7–8): per relation, the channel, payload and cadence of the newest
 * reading that names each (readings are oldest first); chAt orders the channels of different relations by their reading. */
/** map-reading.13: also how the record has it (mode), the fields of the format artifact it carries (the newest reading that names
 * any) and the line of the newest reading that read it (its quote). */
interface LineSaid { channel: Channel | null; chAt: number; payload: string | null; cadence: string | null; mode: RelationMode | null; fields: string[]; quote: ReadingQuote | null; at: string | null }
function relationLines(project: Project): Map<string, LineSaid> {
  const out = new Map<string, LineSaid>(), g = projectVariantGloss(project);
  // Pipeline .44: a line flowing for a variant (its C-LINK 조건·선택 「변형 X03」) says which variant, by what it is; any variant ID in
  // what it hands over reads the same way.
  const payloadOf = (x: ReadingRelation): string | null => {
    const own = x.payload ? glossVariants(x.payload, g) : null, v = x.variantRef ? `변형 ${glossVariants(x.variantRef, g)}` : null;
    return own && v && !own.includes(x.variantRef!) ? `${own} · ${v}` : own ?? v;
  };
  project.readings.forEach((r, i) => {
    if (isMapReading(r)) for (const x of r.relations) {
      const cur = out.get(x.relationId) ?? { channel: null, chAt: -1, payload: null, cadence: null, mode: null, fields: [], quote: null, at: null };
      out.set(x.relationId, { channel: x.channel ?? cur.channel, chAt: x.channel ? i : cur.chAt, payload: payloadOf(x) ?? cur.payload, cadence: x.cadence ?? cur.cadence,
        mode: x.mode ?? cur.mode, fields: x.payloadFields?.length ? [...x.payloadFields] : cur.fields, quote: x.quote ?? cur.quote, at: r.at });
    }
  });
  return out;
}
/** The type chip of each drawn line that carries a format artifact's fields (line-view edgeFields), by line key: its name and fields. */
let lineTypes = new Map<string, { name: string; fields: string[] }>();
/** The line picked on the map (its line or its type chip): its relations and the part selected for it; the pane's row of that
 * relation then reads its whole block (넘기는 것 · 박자 · 방식 · 채널 · 데이터 계약 · 원문). Another selection drops it. */
let pickedLine: { rels: string[]; part: string } | null = null;
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
  const clip = (t: string) => (t.length > 30 ? `${t.slice(0, 29)}…` : t), pays = e.ids.map(id => said.get(id)?.payload ?? null);
  // One stroke for several relations (6.5) names what they hand over: 'a · b +N'.
  const named = multiWord(pays, clip);
  // The record's cadence words read on the line's badge (line-grammar lineBadge), not in its label.
  if (ch === 'data') return named ?? REL_LABEL[e.kind] ?? e.kind;
  if (ch === 'control') return named ? `기동 · ${named}` : '제어';
  if (ch === 'uses') return '참조';
  return REL_LABEL[e.kind] ?? e.kind;
}
/** The labels of the lines drawn now (renderSpace), by line key; a line drawn later (a summary beside a selection) says its verb. */
let lineWords = new Map<string, string>();
/** The text badge of each drawn line whose relations' readings say when it flows (line-grammar lineBadge), by line key. */
let lineBadges = new Map<string, LineBadge>();
/** The strokes whose label names several things handed over ('a · b +N'): their count is in the label already. */
let lineMulti = new Set<string>();
const wordOf = (e: Edge) => lineWords.get(e.key) ?? REL_LABEL[e.kind] ?? e.kind;
/** The short word of a line's channel (its label without a payload or a beat). */
let lineChans = new Map<string, Channel | null>();
const shortOf = (e: Edge) => { const c = lineChans.get(e.key); return c === 'control' || c === 'uses' ? CHANNEL_LABEL[c] : REL_LABEL[e.kind] ?? e.kind; };
/** The small fixed key in the map's lower left: one row for each kind of line this map draws, none when it draws no line. */
function renderLineKey(present: Set<Channel>) {
  let key = document.getElementById('line-key');
  if (!key) { key = h('div', { id: 'line-key', class: 'line-key', role: 'list', 'aria-label': '선의 종류' }); $('space').append(key); }
  // Each sample as the map draws it (6.1): data solid with a filled head, control dashed with an open head, a reference dotted
  // from its ear to a small V.
  const sample = (c: Channel) => {
    const s = svg('svg', { viewBox: '0 0 28 10', width: '28', height: '10', 'aria-hidden': 'true' });
    if (c === 'uses') s.append(svg('circle', { class: 'lk-ear', cx: '3', cy: '5', r: '2.2' }));
    s.append(svg('path', { class: 'lk-line', d: c === 'data' ? 'M1 5H21' : c === 'uses' ? 'M7 5H24' : 'M1 5H25' }), svg('path', { class: c === 'data' ? 'lk-head filled' : 'lk-head', d: c === 'data' ? 'M19 1.5L26 5L19 8.5z' : c === 'uses' ? 'M21.5 2.5L26 5L21.5 7.5' : 'M20 1.5L26 5L20 8.5' }));
    return s;
  };
  key.replaceChildren(...(['data', 'control', 'uses'] as const).filter(c => present.has(c)).map(c => h('span', { class: `lk-row lk-${c}`, role: 'listitem' }, sample(c), h('span', {}, CHANNEL_LABEL[c]))));
  key.hidden = !present.size;
}
/* ---------- lenses and the legend (map design v3 7; view-lens.ts) ----------
 * The lens switch in the map's tools and the legend in its lower left. A lens only puts classes on the space; the legend's marks
 * only put classes on the parts, lines, labels and badges it stands for. Neither lays out, routes or places a label again. */
let viewLens: LensId = DEFAULT_LENS, legend: LegendState = NO_FILTER, legendFor = '', legendNow: LegendItem[] = [], legendMenu: string | null = null, legendHoverTimer = 0;
const lensStore = (): string | null => { try { return localStorage.getItem(LENS_KEY); } catch { return null; } };
function saveLens() { const o = opened; if (!o) return; try { localStorage.setItem(LENS_KEY, writeLensRecord(lensStore(), o.key, { lens: viewLens, legend })); } catch { /* a view record only: the map reads the same without it */ } }
const lensUsable = (id: LensId) => id !== 'scenario' || (!!opened && scenarioReadings(opened).length > 0);
/** The lens and legend kept for this map (read once per opened map). */
function loadLens(o: Opened) {
  if (legendFor === o.key) return;
  legendFor = o.key; const r = readLensRecord(lensStore(), o.key);
  viewLens = r.lens === 'scenario' && !scenarioReadings(o).length ? DEFAULT_LENS : r.lens; legend = r.legend; legendMenu = null;
}
function setLens(id: LensId) {
  const o = opened; if (!o || !lensUsable(id) || id === viewLens) return;
  const was = viewLens; viewLens = id; legend = NO_FILTER; legendMenu = null; // each lens reads its own legend
  if (id === 'scenario' && !scOn) { const first = scenarioReadings(o)[0]; if (first) enterScenario(first.id); }
  if (was === 'scenario' && scOn) leaveScenario();
  saveLens(); renderLegend(); applyLens();
}
/** What the legend counts of the drawn parts: family, type, the overview's short status, a loop, the card's gaps. */
function lensPartsOf(o: Opened): LensPart[] {
  const said = relationLines(o.project);
  return [...lay.boxes.values()].filter(b => b.kind === 'node').map(b => {
    const p = partOf(o, b.id)!, t = cardTpls.get(b.id), r = p.reading, s = r?.stateRead;
    const life = r ? lifecycleOf(s?.state, s?.quote?.quote ?? '') : null, ops = r ? opsCard(s?.state ?? null, s?.when ?? null, opsRef, life) : null;
    return { id: b.id, family: t?.family ?? 'neutral', type: r?.typeRead?.type ?? null, short: life ?? ops?.short ?? '운영 기록 없음', loop: !!r?.loop,
      unlinked: !!t && ((t.contract.kind === 'values' && t.contract.rows.length > 0) || t.rows.some(x => x.unlinked) || !!t.well?.state), unmapped: t && r ? cardFactsOf(o, p, r, said).unmapped ?? 0 : 0 };
  });
}
const lensLinesOf = (): LensLine[] => [...lay.edges.map(e => ({ e, sum: false })), ...restSums.map(e => ({ e, sum: true }))].map(({ e, sum }) => ({ key: e.key, channel: lineChans.get(e.key) ?? null, badge: lineBadges.has(e.key), from: e.from, to: e.to, sum }));
/** The lens's classes on the space and its line opacities (lensLook); the switch's state; the legend's marks. */
function applyLens() {
  const sp = $('space');
  for (const c of [...sp.classList]) if (c.startsWith('lens-')) sp.classList.remove(c);
  for (const c of lensClasses(viewLens)) sp.classList.add(c);
  for (const [k, v] of Object.entries(lensLook(viewLens).lines)) sp.style.setProperty(`--lo-${k}`, String(v));
  document.querySelectorAll<HTMLElement>('.lens-seg [data-lens]').forEach(b => { const on = b.dataset.lens === viewLens; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); (b as HTMLButtonElement).disabled = !lensUsable(b.dataset.lens as LensId); });
  applyLegendMarks();
}
/** The legend's marks: the picked item's targets outlined (.lg-pick), dimmed (.lg-dim) and hidden (.lg-hide, its room kept). */
function applyLegendMarks() {
  // Everything drawn the legend can mark: the cards and the outside partners, and the lines with their ends (solo hides what its
  // item does not stand for, a part no item lists included; a pick steps the rest back).
  const parts = [...lay.boxes.values()].filter(b => b.kind === 'node' || b.kind === 'ghost').map(b => b.id);
  const world = $('world'), m = legendMarks(legend, legendNow, { parts, lines: lensLinesOf() });
  world.querySelectorAll('.lg-pick, .lg-dim, .lg-hide, .lg-fade').forEach(el => el.classList.remove('lg-pick', 'lg-dim', 'lg-hide', 'lg-fade'));
  const mark = (set: Set<string>, cls: string) => { for (const x of set) {
    if (x.startsWith('line:')) { const k = CSS.escape(x.slice(5)); world.querySelectorAll(`.edge[data-key="${k}"], .edge-label[data-key="${k}"], .edge-badge[data-badge="${k}"]`).forEach(el => el.classList.add(cls)); }
    else world.querySelector(`[data-box="${CSS.escape(x)}"]`)?.classList.add(cls); } };
  mark(m.fade, 'lg-fade'); mark(m.dim, 'lg-dim'); mark(m.hide, 'lg-hide'); mark(m.picked, 'lg-pick');
  // A 「+N」 marker of gathered badges steps back or hides with the lines it gathers only when all of them do.
  world.querySelectorAll<HTMLElement>('.edge-badge.b-more').forEach(el => { const from = el.dataset.badgeMore ?? '';
    if (m.hide.has(from)) el.classList.add('lg-hide'); else if (m.fade.has(from) || m.dim.has(from)) el.classList.add('lg-fade'); });
}
/** Pointing at a legend item: after ~150 ms its parts and lines keep an outline until the pointer leaves (7.2: no blinking). */
function legendHover(item: LegendItem | null) {
  clearTimeout(legendHoverTimer);
  const world = $('world'); world.querySelectorAll('.lg-hover').forEach(el => el.classList.remove('lg-hover'));
  if (!item) return;
  legendHoverTimer = window.setTimeout(() => {
    for (const id of item.parts) world.querySelector(`[data-box="${CSS.escape(id)}"]`)?.classList.add('lg-hover');
    for (const k of item.lines) world.querySelectorAll(`.edge[data-key="${CSS.escape(k)}"]`).forEach(el => el.classList.add('lg-hover'));
  }, 150);
}
function legendAct(a: LegendAction, focusId?: string) {
  legend = legendApply(legend, a, legendNow); legendMenu = null; saveLens(); applyLegendMarks(); renderLegend();
  if (focusId) document.querySelector<HTMLElement>(`#line-key .lg-item[data-item="${CSS.escape(focusId)}"]`)?.focus();
}
const legendActive = () => !!legend.picked || !!legend.solo || Object.keys(legend.mode).length > 0;
/** The legend open or folded to its chip: the person's choice for this map (this tab's memory), else decided when the map is
 * fitted (syncLegendFold): folded when, opened, it would cover a card. Folding moves nothing on the map. */
let legendOpenNow = true;
const legendChoice = new Map<string, boolean>();
function setLegendOpen(open: boolean) {
  const o = opened; if (!o) return;
  legendChoice.set(o.key, open); legendOpenNow = open; legendMenu = null; renderLegend();
  document.querySelector<HTMLElement>(open ? '#line-key .lg-fold' : '#line-key .lg-chip')?.focus();
}
/** After a fit: the legend's state for this map (the person's choice, else open unless it would cover a card, then folded). true
 * when it changed. */
function syncLegendFold(): boolean {
  const o = opened; if (!o) return false;
  const was = legendOpenNow, chosen = legendChoice.get(o.key);
  if (chosen !== undefined) legendOpenNow = chosen;
  else {
    legendOpenNow = true; renderLegend();
    const key = document.getElementById('line-key'), r = key?.getBoundingClientRect();
    if (r && r.width) {
      // Where the cards are under the camera now (from the layout, not the screen: a fit may still be sliding there).
      const w = $('world'), pr = (w.offsetParent as HTMLElement | null)?.getBoundingClientRect(), ox = (pr?.left ?? 0) + w.offsetLeft, oy = (pr?.top ?? 0) + w.offsetTop, k = camera.k;
      const cards = [...lay.boxes.values()].filter(b => b.kind === 'node' || b.kind === 'ghost').map(b => ({ x: ox + camera.x + b.x * k, y: oy + camera.y + b.y * k, w: b.w * k, h: b.h * k }));
      legendOpenNow = !covers({ x: r.left, y: r.top, w: r.width, h: r.height }, cards);
    }
  }
  renderLegend();
  return was !== legendOpenNow;
}
/** The room the folded legend's chip keeps under the map (a fit keeps cards clear of it); none while open (it was opened over it). */
const legendInset = () => { const k = document.getElementById('line-key'); return k && !k.hidden && k.classList.contains('folded') ? k.offsetHeight + 8 : 0; };
const FAMILY_GLYPH: Record<string, string> = { participant: 'person', process: 'compute', store: 'store', trigger: 'timer', neutral: 'neutral' };
function legendSample(s: Sample): HTMLElement | SVGElement {
  if (s.kind === 'family') { const t = h('span', { class: `glyph-tile lg-tile g-${s.family}`, 'aria-hidden': 'true' }); t.innerHTML = glyphSvg((FAMILY_GLYPH[s.family] ?? 'neutral') as Parameters<typeof glyphSvg>[0]); return t; }
  if (s.kind === 'badge') return h('span', { class: 'lg-badge', 'aria-hidden': 'true' }, BADGE_GLYPH);
  if (s.kind === 'mark') return h('span', { class: 'lg-mark', 'aria-hidden': 'true' }, s.text);
  const c = s.channel, sv = svg('svg', { viewBox: '0 0 28 10', width: '28', height: '10', 'aria-hidden': 'true', class: `lg-line lk-${c}` });
  if (c === 'uses') sv.append(svg('circle', { class: 'lk-ear', cx: '3', cy: '5', r: '2.2' }));
  if (c === 'related') sv.append(svg('circle', { class: 'lk-dot', cx: '2.5', cy: '5', r: '1.8' }), svg('path', { class: 'lk-line', d: 'M7 5H21' }), svg('circle', { class: 'lk-dot', cx: '25.5', cy: '5', r: '1.8' }));
  else sv.append(svg('path', { class: 'lk-line', d: c === 'data' ? 'M1 5H21' : c === 'uses' ? 'M7 5H24' : 'M1 5H25' }), svg('path', { class: c === 'data' ? 'lk-head filled' : 'lk-head', d: c === 'data' ? 'M19 1.5L26 5L19 8.5z' : c === 'uses' ? 'M21.5 2.5L26 5L21.5 7.5' : 'M20 1.5L26 5L20 8.5' }));
  return sv;
}
/** The legend (7.2): the lens's name and question, '숨김 N · 흐림 N · 모두 보기' while anything is, and one row per item this map has
 * (sample, name, count) with its ⋯ menu. */
function renderLegend() {
  const o = opened;
  let key = document.getElementById('line-key');
  if (!key) { key = h('div', { id: 'line-key', class: 'line-key legend', role: 'group', 'aria-label': '범례' }); $('space').append(key); }
  key.classList.add('legend');
  if (!o) { key.hidden = true; return; }
  legendNow = legendItems(viewLens, lensPartsOf(o), lensLinesOf());
  // Marks of items this map no longer has are dropped (never a hidden count for nothing drawn).
  const ids = new Set(legendNow.map(i => i.id));
  legend = { picked: legend.picked && ids.has(legend.picked) ? legend.picked : null, mode: Object.fromEntries(Object.entries(legend.mode).filter(([k]) => ids.has(k))), solo: legend.solo && ids.has(legend.solo) ? legend.solo : null };
  const def = lensDef(viewLens), head = legendHead(legend, legendNow);
  // Folded (it starts so when it would cover cards, syncLegendFold): one chip, the lens and its first items; a click unfolds it.
  if (!legendOpenNow) {
    key.classList.add('folded');
    key.replaceChildren(h('button', { type: 'button', class: 'lg-chip', 'aria-expanded': 'false', title: `범례 펼치기 · ${def.name}${head ? ` · ${head}` : ''}`, onclick: () => setLegendOpen(true) },
      h('span', { class: 'lg-chip-text' }, legendChip(viewLens, legendNow)), head ? h('span', { class: 'lg-chip-state' }, head) : null, h('span', { class: 'lg-chip-v', 'aria-hidden': 'true' }, '▴')));
    key.hidden = false; return;
  }
  key.classList.remove('folded');
  const menuOf = (it: LegendItem) => h('div', { class: 'lg-menu', role: 'menu', 'aria-label': `${it.label} 보기` },
    ...([['dim', '흐리게', 'Shift+클릭'], ['hide', '숨김', ''], ['solo', '그것만', 'Ctrl+클릭'], ['all', '모두 보기', '']] as const).map(([d, word, kbd]) =>
      h('button', { type: 'button', role: 'menuitem', class: `lg-act${(d === 'dim' || d === 'hide') && legend.mode[it.id] === d ? ' on' : d === 'solo' && legend.solo === it.id ? ' on' : ''}`, onclick: () => legendAct(d === 'all' ? { do: 'all' } : { do: d, id: it.id }, it.id) }, word, kbd ? h('kbd', {}, kbd) : null)));
  const rows = legendNow.map(it => {
    const m = legend.solo === it.id ? 'solo' : legend.mode[it.id], picked = legend.picked === it.id, out = !!legend.solo && legend.solo !== it.id;
    return h('li', { class: `lg-row${picked ? ' picked' : ''}${m ? ` m-${m}` : ''}${out ? ' m-out' : ''}`, role: 'presentation' },
      h('button', { type: 'button', class: 'lg-item', role: 'option', 'aria-selected': String(picked), 'data-item': it.id, title: `${it.label} ${it.count}${picked ? ' · 선택됨 (다시 누르거나 Esc로 풀기)' : ' · 눌러서 지도에 표시'}${m === 'hide' ? ' · 숨김' : m === 'dim' ? ' · 흐림' : m === 'solo' ? ' · 그것만 보기' : ''}`,
        onclick: (ev: Event) => { const e = ev as MouseEvent; legendAct(e.shiftKey ? { do: 'dim', id: it.id } : e.ctrlKey || e.metaKey ? { do: 'solo', id: it.id } : { do: 'pick', id: it.id }, it.id); },
        onpointerenter: () => legendHover(it), onpointerleave: () => legendHover(null), onfocus: () => legendHover(it), onblur: () => legendHover(null) },
        legendSample(it.sample), h('span', { class: 'lg-label' }, it.label), h('span', { class: 'lg-count' }, String(it.count)), m ? h('span', { class: 'lg-mode' }, m === 'hide' ? '숨김' : m === 'dim' ? '흐림' : '그것만') : null),
      h('button', { type: 'button', class: 'lg-more', 'aria-haspopup': 'menu', 'aria-expanded': String(legendMenu === it.id), 'aria-label': `${it.label} 보기 메뉴`, title: '흐리게 · 숨김 · 그것만 · 모두 보기',
        onclick: () => { legendMenu = legendMenu === it.id ? null : it.id; renderLegend(); document.querySelector<HTMLElement>('#line-key .lg-menu .lg-act')?.focus(); } }, '⋯'),
      legendMenu === it.id ? menuOf(it) : null);
  });
  key.replaceChildren(...[
    h('div', { class: 'lg-head' }, h('strong', {}, def.name), h('span', { class: 'lg-asks' }, def.asks),
      h('button', { type: 'button', class: 'lg-fold', 'aria-expanded': 'true', 'aria-label': '범례 접기', title: '범례 접기 · 한 줄 칩으로', onclick: () => setLegendOpen(false) }, '▾')),
    head ? h('div', { class: 'lg-state' }, h('span', {}, head), h('button', { type: 'button', class: 'link-button lg-all', onclick: () => legendAct({ do: 'all' }) }, '모두 보기')) : null,
    rows.length ? h('ul', { class: 'lg-items', role: 'listbox', 'aria-label': `${def.name} 범례 · ↑↓ 이동 · Enter 선택 · Shift+F10 메뉴 · Esc 해제` }, ...rows)
      : h('p', { class: 'lg-none' }, viewLens === 'scenario' ? '경로와 방문은 제목 아래 시나리오 줄에서' : '이 지도에 해당하는 것 없음')].filter(<T,>(x: T | null): x is T => !!x));
  key.hidden = false;
}
/** Keys inside the legend (7.3): ↑↓ between items, Enter selects (the button's own), Shift+F10 or the menu key opens the item's
 * menu, Esc closes the menu, else clears the legend and goes back to the map. */
function bindLegendKeys() {
  document.addEventListener('keydown', e => {
    const key = document.getElementById('line-key'), t = e.target as HTMLElement; if (!key || !key.contains(t)) return;
    const items = [...key.querySelectorAll<HTMLElement>('.lg-item')], i = items.indexOf(t.closest('.lg-row')?.querySelector<HTMLElement>('.lg-item') ?? t);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); return; }
    if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') { e.preventDefault(); const id = items[i]?.dataset.item; if (id) { legendMenu = id; renderLegend(); key.querySelector<HTMLElement>('.lg-menu .lg-act')?.focus(); } return; }
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (legendMenu) { const id = legendMenu; legendMenu = null; renderLegend(); key.querySelector<HTMLElement>(`.lg-item[data-item="${CSS.escape(id)}"]`)?.focus(); return; }
      legendAct({ do: 'clear' }); $('world').querySelector<HTMLElement>('.node[tabindex], .frame-head[tabindex]')?.focus({ preventScroll: true });
    }
  }, true);
}
/** The map head's basis line (spec 6): what the newest reading's records give as their basis time and target version, as
 * written, and that every state is a reported one; a blank says it is unknown, never the time a record arrived. */
function basisLine(o: Opened): HTMLElement | null {
  const last = [...o.project.readings].reverse().find(isMapReading); if (!last) return null;
  // One line: a long commit id reads by its first seven characters (the whole line, as written, in the tip).
  const full = `설계 근거 · ${last.basisAt ?? '작성 시각 미상'} 작성 보고 · 대상 판본 ${last.basisVersion ?? '미상'} · 운영: 보고된 상태 (기록 없음은 제공된 자료 기준)`;
  const version = (last.basisVersion ?? '미상').replace(/\b([0-9a-f]{7})[0-9a-f]{9,}\b/g, '$1');
  return h('p', { class: 'map-basis', title: full }, `설계 근거 · ${last.basisAt ?? '작성 시각 미상'} 작성 보고 · 대상 판본 ${version} · 운영: 보고된 상태`);
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
  // The sessions read in 구조's 어디에; another tab has nothing to change.
  const o = opened; if (!o || !selected || planView.isOpen() || (!sheetOpen && lensRail) || paneTab !== 'structure') return;
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
  sums = me || scLines.size ? (opened ? sumLines(opened, restSummary(lay.boxes, lay.edges, e => (!!me && (e.from === me || e.to === me)) || path.lines.has(e.key) || scLines.has(e.key))) : []) : restSums;
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

/** The wide mode (넓게 읽기, map design v3 8.8): the same head, the same tabs in the same order, over the map at a reading width (its
 * text in one 720px column); only what needs room is added: the name·description form when editing, the description's correction,
 * the sessions in full, the records whole and the answers under 근거, the question box at the foot. Edits sit in a quiet menu. */
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
  const c = paneCtx(o, part, true);
  const menuItems = [
    o.kind !== 'legacy' ? h('button', { type: 'button', role: 'menuitem', onclick: () => { editing = !editing; if (editing) paneTab = 'structure'; renderPanel(false); } }, editing ? '고치기 닫기' : '이름·설명 고치기') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', onclick: () => openPartForm(part.id) }, '안에 부분 추가') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', title: '이 부분을 보던 맥락으로 원문을 붙여 넣어요', onclick: () => openPaste(part.id) }, '기록 붙여넣기') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', title: '코드나 검사 기록 파일 하나를 원문 그대로 자료로 보관해요 (이 부분은 읽기 맥락일 뿐이에요)', onclick: () => openFile(part.id) }, '코드·검사 자료 추가') : null
  ].filter((x): x is HTMLButtonElement => !!x);
  const tools = h('div', { class: 'head-tools' },
    menuItems.length ? h('details', { class: 'more' }, h('summary', { 'aria-label': '이 부분 고치기', title: '고치기' }, '⋯'), h('div', { class: 'more-menu', role: 'menu', onclick: (e: Event) => { ((e.currentTarget as HTMLElement).parentElement as HTMLDetailsElement).open = false; } }, ...menuItems)) : null,
    h('button', { type: 'button', class: 'link-button sheet-back', title: '넓게 읽기를 닫고 지도와 옆 창으로 (Esc)', onclick: closeSheet }, '요약으로'),
    h('button', { type: 'button', class: 'close', 'aria-label': '요약으로 돌아가기', title: '요약으로 (Esc)', onclick: closeSheet }, '×'));
  const body = h('div', { class: 'panel-body', id: 'pane-tabpanel', role: 'tabpanel', 'aria-labelledby': `pane-tab-${paneTab}`, 'data-tab': paneTab });
  if (editing) body.append(editForm(o, part));
  body.append(...tabBody(c));
  panel.replaceChildren(paneHead(c, tools), tabRow(c), stickyBar(), body, composer(o, part));
  panel.dataset.read = `${o.key}|${part.id}`;
  for (const [id, v] of typed) { const f = document.getElementById(id); if ((f instanceof HTMLTextAreaElement || f instanceof HTMLInputElement) && panel.contains(f) && f.value !== v) f.value = v; }
  if (scrollTop) body.scrollTop = 0; else body.scrollTop = keep;
  bindSticky(body);
  if (caret) {
    const f = document.getElementById(caret.id);
    if ((f instanceof HTMLTextAreaElement || f instanceof HTMLInputElement) && panel.contains(f) && !f.disabled) { f.focus({ preventScroll: true }); try { f.setSelectionRange(caret.start, caret.end, caret.dir ?? 'none'); } catch { /* not a text field */ } f.scrollTop = caret.top; }
  } else if (mark) [...panel.querySelectorAll<HTMLElement>(`[data-${mark[0].replace(/[A-Z]/g, ch => `-${ch.toLowerCase()}`)}]`)].find(x => x.dataset[mark[0]] === mark[1])?.focus({ preventScroll: true });
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
    // .43 (4.1): a 기록 v4 answer is kept as one record per chunk (split at its chunk heads).
    try { for (const t of texts.flatMap(x => splitRecordChunks(x))) { const r = pasteRecord(next, t, context && partOf(o, context) ? context : null); next = r.project; id = r.record.id; fresh ||= !r.duplicate;
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
const handover = createHandoverView({ current: () => opened, cloud: () => cloudLink, disputes: sc => (opened ? disputeLinesFor(opened, sc) : []), requests: () => opened ? frozenRequests(opened.project, (planView.bundleOf()?.snapshots ?? []).flatMap(s => s.scope ? [s.scope] : [])) : [] });
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
  try {
    const text = handoverDoc(p, { scope: null, code, at: new Date().toISOString(), requests: frozenRequests(p, (planView.bundleOf()?.snapshots ?? []).flatMap(s => s.scope ? [s.scope] : [])) }).text;
    return withDisputes(text, opened && opened.project === p ? disputeLinesFor(opened, null) : []);
  } catch { return null; }
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
  if (cur && next) cur.replaceWith(next); else if (cur) cur.remove(); else if (next) { const at = title.querySelector('.map-basis, .map-chips'); if (at) at.before(next); else title.append(next); }
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
    // .43: one record request (기록 요청 v4.1), the v3 status and v1 design requests behind 「이전 요청문」 (record-asks.ts).
    fresh ? null : h('p', { class: 'fine se-ask' }, '진행 중인 AI 대화가 있다면 ', ...recordAskNodes((label, text, title) => askCopy(label, text, 'link-button', title)),
      ...(o.view.parts.length ? [' · ', askCopy('시나리오 기록 요청(대장 포함)', scenarioAskWithLedger(o.view, o.project.readings), 'link-button', RECORD_ASK_EXPLAIN.scenario)] : []),
      ' 문구를 복사해 그 대화에 붙여 넣으세요(파일을 못 보는 대화면 ', askCopy('대화용 현황 요청', CHAT_REPORT_ASK, 'link-button', RECORD_ASK_EXPLAIN.status),
      '). 나온 답을 통째로 ‘기록 붙여넣기’에 넣으면 앱이 덩이를 나눠 읽고 부분·연결·상태·안의 단계·모르는 것이 지도가 돼요.'),
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
    // .43: a pasted 기록 v4 whose completion table leaves tables offers its continuation (record-asks.ts).
    ...[continuationNode(o.project.pasted.map(r => r.text), (label, text, title) => askCopy(label, text, 'link-button', title))].filter((x): x is HTMLElement => !!x),
    h('p', { class: 'fine rm-ask rm-records' }, ...recordAskNodes((label, text, title) => askCopy(label, text, 'link-button', title)), ' · ',
      askCopy('시나리오 기록 요청(대장 포함)', scenarioAskWithLedger(o.view, o.project.readings), 'link-button', RECORD_ASK_EXPLAIN.scenario),
      ' — 기록 요청은 지금 상태와 카드의 안쪽(산출물·단계·조건)을, 시나리오 기록은 동작 경로 하나를 써 받아요. 둘 다 다른 기록처럼 붙여 넣어요. 시나리오 기록은 붙이면 앱이 AI 없이 지금 지도의 ID 대장과 맞춰 길로 읽어, 제목 아래 ‘시나리오’ 줄에서 지도 위에 보여요.'));
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
      h('ul', { class: 'claims' }, ...list.map(c => (n++, claimItem(part, c, topic, history, null, surface))))));
  }
  return box;
}
function claimItem(part: string, c: CurrentClaim, topic: ClaimTopic, history: PartUnderstanding['history'], mark: HTMLElement | null, surface: 'lens' | 'sheet'): HTMLElement {
  // A correction names the claim it replaces: its old words struck through, when that reading is still at hand.
  const was = c.replaces ? history.find(x => x.reading === c.replaces!.reading)?.claims[c.replaces.index]?.text ?? null : null;
  const before = topic === 'withdrawn' && c.before ? c.before : null;
  // The version line is read only for what the time and the place do not already say ("618df374, 10-31 16:03:59Z" beside both is noise).
  const when = claimWhen(c), ev = claimEvidence(c), shown = new Set([when, c.where].filter(Boolean));
  const about = c.about && !c.about.split(/s*[,·]s*/).every(piece => shown.has(piece)) ? c.about : null;
  // map design v3 8.4: the claim's footnote (its stable number, the same in every view), or the plain passage chip outside the pane.
  const cite: HTMLElement = mark ?? h('span', { class: 'cite', onmouseenter: () => placeCite(cite), onfocusin: () => placeCite(cite) },
    h('button', { type: 'button', class: 'cl-cite', 'data-claim-focus': JSON.stringify([part, c.reading, c.index, c.record, c.from ?? null, c.to ?? null]), 'aria-label': '원문에서 보기', title: `원문에서 보기 · “${c.quote}”`, onclick: () => showQuote(c.record, c.quote, c.from) }, '원문'),
    h('span', { class: 'cite-pop', role: 'tooltip' }, h('q', {}, popLine(c.quote)), h('span', { class: 'cite-src' }, recordName(c.record))));
  const sf = sinceSpan(opened), dz = disputeBits(part, claimKey(c), c.text);
  return h('li', { class: `claim k-${c.kind}${c.replaces ? ' replaces' : ''}${sf ? (sinceHit(c, sf) ? ' since-hit' : ' since-off') : ''}${dz.chip ? ' disputed' : ''}` },
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
      dz.chip, cite, dz.control),
    dz.form,
    surface === 'sheet' ? h('q', { class: 'cl-quote', title: c.quote }, quoteLine(c.quote)) : null);
}
/** What the person unfolded in the lens, per part (memory, this tab): long relation notes.
 * Reading a quote or following a relation and coming back keeps them as they were, like the scroll and the focused citation. */
const lensOpen = new Set<string>();
/* ---------- the reading pane after cycle 5 (map spec 11.5, PART_READING 9절) ----------
 * With the working structure on the map and in the detail view, the pane reads 원문 (what each record said of the part, one rail
 * per record), 이유 (what the part does and why the map drew it so), 이력 (every reading's words in time order), 출처 묶음 (the
 * records that contributed) and the person's 「이 해석이 틀림」 notes (pane-view.ts decides; nothing here edits a reading). */
/** A record as a rail head and a source row read it: its name (a provided file by its declared name, a pasted record by its
 * first line, a project record by its first line), its kind and when it was taken in; a record not at hand says so. */
function recordInfo(o: Opened, id: string): { name: string; kind: string; at: string | null; found: boolean } {
  const pasted = o.project.pasted.find(r => r.id === id);
  if (pasted) return { name: pasted.evidence?.name || recordTitle(pasted.text, 40) || '붙여넣은 기록', kind: recordLabel(pasted), at: pasted.at, found: true };
  const r = o.view.records.find(x => x.id === id);
  return r ? { name: firstLine(r.text, 40) || RECORD_LABEL[r.kind], kind: RECORD_LABEL[r.kind], at: r.at, found: true } : { name: '찾을 수 없는 기록', kind: '기록', at: null, found: false };
}
/** The claims in the pane's own order: a correcting one first, then newest reading first, each reading as it said them. */
function paneSorted(claims: readonly CurrentClaim[]): CurrentClaim[] {
  const fresh = new Map<string, number>(); for (const c of claims) if (!fresh.has(c.reading)) fresh.set(c.reading, fresh.size);
  return [...claims].sort((a, b) => Number(!!b.replaces) - Number(!!a.replaces) || fresh.get(a.reading)! - fresh.get(b.reading)! || a.index - b.index);
}
/** 근거 · 기록별: the current claims by the record they quote (map spec 6): one vertical rail per record, its head (name, kind, time,
 * how many) once, the record's sentences in topic order under it, newest record first. Every claim keeps its evidence chip and its
 * footnote (the same number as in 주장 순 and 구조, map design v3 8.4); the rail's head opens the record whole. */
function originSection(c: PaneCtx, surface: 'lens' | 'sheet' = 'lens'): HTMLElement {
  const { o, u } = c, part = c.part.id, rails = recordRails(paneSorted(u!.claims), id => recordInfo(o, id).at);
  const box = h('div', { class: 'src-rails', id: 'lens-claims' }, ...rails.map(r => {
    const info = recordInfo(o, r.record);
    return h('section', { class: `src-rail${info.found ? '' : ' gone'}`, 'data-record': r.record, 'aria-label': `${info.name} · 이 기록의 말 ${r.claims.length}` },
      h('div', { class: 'rail-head' },
        h('button', { type: 'button', class: 'rail-rec', 'data-claim-focus': JSON.stringify([part, 'rail', r.record]), title: info.found ? `이 기록의 원문 열기 · ${info.name}` : '이 기록은 지금 프로젝트에 없어요', disabled: !info.found || o.kind !== 'saved',
          onclick: () => showQuote(r.record, '') }, info.name),
        h('span', { class: 'rail-kind' }, info.kind),
        info.at ? h('span', { class: 'rail-at', title: fullTime(info.at) }, ago(info.at)) : h('span', { class: 'rail-at blank' }, '시각 미상'),
        h('small', { class: 'rail-n', title: '이 기록에서 읽은 지금의 말' }, String(r.claims.length))),
      ...r.topics.map(({ topic, list }) => h('div', { class: `cg t-${topic}` },
        h('h4', { title: TOPIC_HINT[topic] }, TOPIC_LABEL[topic], h('small', {}, String(list.length))),
        h('ul', { class: 'claims' }, ...list.map(x => claimItem(part, x, topic, u!.history, fnMarks(c, [claimThing(c, x)], x.text, false), surface))))));
  }));
  return h('section', { class: 'lens-origin', 'aria-label': `원문 · 기록 ${rails.length}개의 말 ${u!.claims.length}개` },
    h('h3', { title: '기록마다 묶은, 이 부분에 대해 기록이 한 말 · 새 기록부터 · 묶음 머리를 누르면 그 기록 원문' }, '원문', h('small', {}, `기록 ${rails.length} · 말 ${u!.claims.length}`)), box);
}
/* ---------- 근거 (map design v3 8.5, slice S2) ---------- */
/** 근거: the way back (when a footnote led here), the view switch (주장 순 | 기록별) with the since filter, then the numbered items
 * under 구조's sections (or one rail per record), 항목 근거 미연결, 그 밖의 기록된 말, the records (기록 목록) and the part's 진단; the
 * wide mode adds the records whole (기록 원문) and the answers (정리 결과). No conflict group: a reading does not say that two claims
 * of the same target, version and time cannot both hold, and none is made up here. */
function evidenceTab(c: PaneCtx): HTMLElement[] {
  const { o, part, u } = c, out: HTMLElement[] = [];
  const back = returnStrip(c); if (back) out.push(back);
  if (u) {
    out.push(evidenceBar(c));
    if (evidenceView === 'records') out.push(u.claims.length ? originSection(c, c.wide ? 'sheet' : 'lens') : h('p', { class: 'stp-blank ev-none' }, '이 부분에 대해 기록이 한 지금의 말이 없어요'));
    else out.push(...evidenceByItem(c));
    const src = sourcesSection(o, part.id, u); if (src) out.push(src);
    const diag = diagnosisSection(c); if (diag) out.push(diag);
  } else out.push(h('p', { class: 'stp-blank ev-none' }, '이 부분은 아직 기록에서 읽은 말이 없어요'));
  if (c.wide) {
    const records = c.records;
    if (records.length) {
      const showAll = records.length <= 5, list = h('ol', { class: 'records' }, ...records.slice(0, showAll ? records.length : 4).map(r => recordItem(o, r, r.partId !== part.id)));
      const sec = h('section', { class: 'sec ev-records' }, h('h3', {}, '기록 원문 ', h('small', {}, `개발 도구에서 받은 기록 ${records.length}`)), list);
      if (!showAll) sec.append(h('button', { type: 'button', class: 'records-more link-button', onclick: (e: Event) => { list.replaceChildren(...records.map(r => recordItem(o, r, r.partId !== part.id))); (e.target as HTMLElement).remove(); } }, `기록 ${records.length - 4}개 더 보기`));
      out.push(sec);
    }
    const thread = answersOf(o, part.id);
    if (thread.length || (ask && ask.partId === part.id)) {
      const sec = h('section', { class: 'sec thread', 'aria-live': 'polite' }, h('h3', {}, '정리 결과 ', h('small', {}, 'AI 답 · 기록의 말이 아니에요')));
      for (const a of thread) sec.append(answerCard(o, a));
      if (ask && ask.partId === part.id) sec.append(ask.controller
        ? h('div', { class: 'pending' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, `${status.model ?? 'DeepSeek'}가 기록을 읽고 정리하고 있어요…`, coverageText(ask.coverage) ? h('small', { class: 'scope-note' }, coverageText(ask.coverage)!) : null), h('button', { type: 'button', class: 'link-button', onclick: () => ask?.controller?.abort() }, '취소'))
        : h('div', { class: 'failed', role: 'alert' }, h('span', {}, ask.error ?? '응답을 받지 못했어요.'), h('button', { type: 'button', class: 'secondary small', onclick: () => send(ask!.intent, ask!.question) }, '다시 시도'), h('button', { type: 'button', class: 'link-button', onclick: () => { ask = null; renderPanel(false); } }, '닫기')));
      out.push(sec);
    }
  }
  return out;
}
/** 보기: 주장 순 | 기록별, and 「기준 시각 이후」 (the map title's filter, the same state; its time is set on the map title). The
 * numbers stay whichever view reads them. */
function evidenceBar(c: PaneCtx): HTMLElement {
  const views = [['claims', '주장 순', '구조 탭의 절 순서로: 하는 일 · 확인 필요 · 계약 · 동작 · 규칙과 관문 · 연결 · 어디에 · 그 밖의 기록된 말'], ['records', '기록별', '기록마다 묶은 이 부분의 지금 말 · 새 기록부터 · 묶음 머리를 누르면 그 기록 원문']] as const;
  return h('div', { class: 'ev-bar' },
    h('div', { class: 'ev-view', role: 'group', 'aria-label': '근거 보기' }, ...views.map(([v, text, hint]) => h('button', { type: 'button', class: `ev-view-b${evidenceView === v ? ' on' : ''}`, 'aria-pressed': String(evidenceView === v), 'data-ev-view': v, title: hint,
      onclick: () => { if (evidenceView !== v) { evidenceView = v; reread(`[data-ev-view="${v}"]`); } } }, text))),
    c.u?.claims.length ? h('button', { type: 'button', class: `ev-since${since.on ? ' on' : ''}`, 'aria-pressed': String(since.on), title: '기준 시각 이후 작성된 말을 강조 (지도 제목의 같은 거름 · 시각은 지도 제목에서)',
      onclick: () => { since = { ...since, on: !since.on }; saveSince(); renderSpace('keep'); markSelection(selected); reread('.ev-since'); } }, '기준 시각 이후') : null);
}
/** 주장 순 (8.5-3): the items under 구조's section heads, each one line (its footnote and what it backs) until opened; the rows 구조
 * reads that carry no line, unnumbered, under their section; then 항목 근거 미연결 and 그 밖의 기록된 말 (folded, open when nothing
 * else is there). */
function evidenceByItem(c: PaneCtx): HTMLElement[] {
  const u = c.u!, part = c.part.id, book = c.book, out: HTMLElement[] = [];
  // The description as read heads 하는 일; its 「이 해석이 틀림」 is here when no passage of it is an item (else on its items).
  const roleItems = book.items.some(it => it.uses.some(x => x.kind === 'role'));
  const rd = u.role && !u.corrected ? disputeBits(part, ROLE_KEY, u.role) : null;
  const roleLine = u.role ? h('div', { class: 'ev-role' }, h('p', { class: 'ev-role-text' }, h('span', { class: 'ev-ai', title: '정리(AI)가 기록에서 읽은 설명 · 아래가 그 원문' }, u.corrected ? '직접 바로잡은 설명' : '정리가 읽은 설명'), ' ', u.role),
    rd && (!roleItems || rd.chip) ? h('p', { class: 'why-dispute cl-meta' }, rd.chip, roleItems ? null : rd.control) : null, roleItems ? null : rd?.form ?? null) : null;
  const quiet = (section: string) => book.unquoted.filter(x => x.section === section).map(x => h('li', { class: 'ev-quiet' }, h('span', { class: 'ev-label' }, x.label),
    h('small', { class: 'stp-blank' }, x.kind === 'relation' ? '읽은 원문 줄 없음 · 사람이 그린 선' : '원문 줄 없음 · 번호 없음')));
  const sections = ITEM_ORDER_SHOWN.filter(s => book.groups.some(g => g.section === s) || book.unquoted.some(x => x.section === s) || (s === 'role' && roleLine));
  for (const section of sections) {
    const items = book.groups.find(g => g.section === section)?.items ?? [];
    out.push(h('section', { class: `ev-group ev-${section}`, 'data-ev': section }, h('h3', { tabindex: '-1' }, ITEM_TITLE[section], items.length ? h('small', {}, String(items.length)) : null),
      section === 'role' ? roleLine : null,
      items.length || quiet(section).length ? h('ul', { class: 'ev-items' }, ...items.map(it => evidenceItemEl(c, it)), ...quiet(section)) : null));
  }
  const unlinked = unlinkedEvidence(c); if (unlinked) out.push(unlinked);
  const other = book.groups.find(g => g.section === 'other');
  if (other) {
    // In topic order (as the pane reads claims); the numbers were given in that order.
    const byTopic = claimsByTopic(other.items.map(it => it.uses.find(x => x.claim)!.claim!));
    const list = byTopic.map(({ topic, list: l }) => h('div', { class: `cg t-${topic}` }, h('h4', { title: TOPIC_HINT[topic] }, TOPIC_LABEL[topic], h('small', {}, String(l.length))),
      h('ul', { class: 'ev-items' }, ...l.map(x => evidenceItemEl(c, book.claim.get(x)!)))));
    const key = `${c.o.key}|${part}|ev-other`, fold = h('details', { class: 'ev-group ev-other', 'data-ev': 'other', open: lensOpen.has(key) || !out.length },
      h('summary', {}, ITEM_TITLE.other, h('small', {}, ` ${other.items.length}`), h('span', { class: 'ev-other-hint' }, ' · 구조 탭에 쓰이지 않은 지금의 말')), ...list);
    fold.addEventListener('toggle', () => { if (fold.open) lensOpen.add(key); else lensOpen.delete(key); });
    out.push(fold);
  }
  if (!out.length) out.push(h('p', { class: 'stp-blank ev-none' }, '이 부분의 읽기가 기댄 원문 줄이 없어요'));
  return out;
}
/** 구조's sections as 근거 groups them (그 밖의 기록된 말 folds after 항목 근거 미연결). */
const ITEM_ORDER_SHOWN = ['role', 'caution', 'contract', 'behaviour', 'rules', 'links', 'where'] as const;
/** One item: one line (its footnote, what it backs, how many cite it) until opened; opened (8.5-3): the passage as the record has it,
 * apart from the reading's words; the record, its kind, where in it, the written time the reading gives, the time the record names,
 * when it was taken in; the author's tag apart from any check by the app; every reading of that span (its uses), each with its own
 * 「이 해석이 틀림」; 원문에서 보기. */
function evidenceItemEl(c: PaneCtx, it: EvidenceItem<CurrentClaim>): HTMLElement {
  const o = c.o, part = c.part.id, key = evOpenKey(o, part, it.key), open = lensOpen.has(key);
  const marked = it.uses.some(x => disputeNotes(o, part, x.ref, x.said).length > 0) && o.kind !== 'legacy';
  const sf = sinceSpan(o), claims = it.uses.flatMap(x => (x.claim ? [x.claim] : []));
  const since = sf && claims.length ? (claims.some(x => sinceHit(x, sf)) ? ' since-hit' : ' since-off') : '';
  const head = h('button', { type: 'button', class: 'ev-head', 'aria-expanded': String(open), 'data-claim-focus': JSON.stringify(['ev', part, it.key]),
    title: open ? '접기' : '펼치기 · 원문 구절과 출처', onclick: () => { if (lensOpen.has(key)) lensOpen.delete(key); else lensOpen.add(key); reread(`[data-ev-n="${it.n}"] > .ev-head`); } },
    h('span', { class: 'fn-n' }, footText(it)), h('span', { class: 'ev-label' }, it.label),
    it.uses.length > 1 ? h('small', { class: 'ev-uses-n', title: '이 구간을 인용한 주장 수 · 독립 근거의 수가 아니에요' }, `인용 ${it.uses.length}`) : null,
    marked ? h('s', { class: 'dispute-chip', title: '이 구간의 읽기 가운데 틀림 표시한 것이 있어요' }, '틀림 표시') : null);
  return h('li', { class: `ev-item k-${it.kind}${open ? ' open' : ''}${since}`, 'data-ev-n': String(it.n), 'data-ev-key': it.key }, head, open ? evidenceItemBody(c, it) : null);
}
function evidenceItemBody(c: PaneCtx, it: EvidenceItem<CurrentClaim>): HTMLElement {
  const o = c.o, part = c.part.id, info = recordInfo(o, it.quote.record), place = placeOf(o, it.quote), written = itemWritten(c, it), when = itemWhen(c, it);
  const bits = it.uses.map(x => ({ x, d: disputeBits(part, x.ref, x.said, it.key, it.uses.length > 1 ? '틀림…' : '이 해석이 틀림…') }));
  const src = [info.name, info.kind, place, written ? `작성 기준 ${written}` : null, when ? `대상 시각 ${when}` : null, info.at ? `가져온 시각 ${fullTime(info.at)}` : '가져온 시각 미상'].filter((x): x is string => !!x);
  const useRow = ({ x, d }: (typeof bits)[number]) => h('li', { class: 'ev-use' },
    h('span', { class: 'ev-use-sec' }, ITEM_TITLE[x.section]), h('span', { class: 'ev-use-label' }, x.label),
    x.claim && claimWhen(x.claim) ? h('small', { class: 'cl-when' }, claimWhen(x.claim)!) : null, x.claim?.where ? h('small', { class: 'cl-where', title: x.claim.where }, x.claim.where) : null,
    d.chip, it.uses.length > 1 ? d.control : null);
  return h('div', { class: 'ev-body' },
    h('blockquote', { class: 'ev-quote', 'aria-label': '기록의 말 그대로' }, h('span', { class: 'ev-quote-k' }, '기록의 말 그대로'), h('span', { class: 'ev-quote-t' }, it.quote.quote)),
    h('p', { class: 'ev-src' }, src.join(' · ')),
    h('p', { class: 'ev-grade', title: '작성자의 꼬리표와 앱의 확인을 구별해요 · 이 앱은 기록의 말을 확인하지 않아요' }, gradeLine(it.grade)),
    h('div', { class: 'ev-uses' }, h('p', { class: 'ev-uses-head', title: '같은 구간을 여러 주장이 쓴다고 독립 근거가 여럿인 것은 아니에요' }, `이 구간을 인용한 주장 ${it.uses.length}`, h('small', {}, ' · 정리(AI)가 이 구간에서 읽은 것')),
      h('ul', {}, ...bits.map(useRow))),
    h('p', { class: 'ev-acts' }, h('button', { type: 'button', class: 'link-button ev-open', 'data-claim-focus': JSON.stringify(['ev-open', part, it.key]), disabled: !info.found || o.kind !== 'saved',
      title: info.found ? '기록 전체를 열고 이 구간에 표시해요' : '이 기록은 지금 프로젝트에 없어요', onclick: () => showQuote(it.quote.record, it.quote.quote, it.quote.from) }, '원문에서 보기'),
      it.uses.length === 1 ? bits[0]!.d.control : null),
    ...bits.map(b => b.d.form));
}
/** 항목 근거 미연결 (8.5-5): the values a reading lists without a line of their own, by field, with what is missing; a same-named line
 * is a candidate only (its footnote, never raised as this value's evidence). */
function unlinkedEvidence(c: PaneCtx): HTMLElement | null {
  const u = c.u!, labels = listLabels(u.typeRead?.type ?? null), ins = flowsIn(c), outs = flowsOut(c);
  const fields: [string, string, readonly string[], End[]][] = [[labels.inputs, 'inputs', u.inputs, ins], [labels.outputs, 'outputs', u.outputs, outs], [labels.fields, 'fields', u.fields, []],
    [labels.config, 'config', u.config, []], ['유지 상태', 'stateVars', (u.stateVars ?? []).map(v => v.name), []]];
  const rows = fields.filter(([, , l]) => l.length);
  if (!rows.length) return null;
  const n = rows.reduce((a, [, , l]) => a + l.length, 0);
  const value = (name: string, lines: End[]) => {
    const x = lines.find(e => { const p = c.handed.get(e.r.id)?.payload; return !!p && sameName(p, name); });
    const it = x ? c.book.thing.get(`relation:${x.r.id}`) : undefined;
    return h('li', {}, h('span', { class: 'pu-val' }, name),
      it ? h('small', { class: 'pu-cand', title: '이름이 같을 뿐이에요 · 이름 일치는 근거가 아니에요' }, ' · 후보: 관계 ', fnButton(c, it, footText(it), `relation:${x!.r.id}`, name), '의 넘기는 것과 이름 같음 · 근거로 올리지 않음') : null);
  };
  return h('section', { class: 'ev-group ev-unlinked-g', 'data-ev': 'unlinked' }, h('h3', { tabindex: '-1', title: UNLINKED_HINT }, '항목 근거 미연결', h('small', {}, String(n))),
    h('p', { class: 'pu-diag' }, '정리가 이 칸들에 항목마다의 원문 줄을 저장하지 않았어요 (계약 map-reading.16) · 그래서 핀·선·반복·상태의 근거로 쓰지 않고 번호도 달지 않아요'),
    h('ul', { class: 'pu-fields' }, ...rows.map(([label, field, list, lines]) => h('li', {}, h('p', { class: 'pu-field' }, h('span', { class: 'why-key' }, label), h('small', {}, ` ${list.length} · 정리 결과의 ${field} 목록`)),
      h('ul', { class: 'pu-vals-l' }, ...list.map(x => value(x, lines)))))));
}
/** 진단 (8.5-8, folded): the reasons a reading set something aside whose place overlaps a passage this part's items cite (the stored
 * diagnostics carry a place, not the part: overlapping this part's own passages is the only tie said here). None: nothing. */
function diagnosisSection(c: PaneCtx): HTMLElement | null {
  const spans = c.book.items.filter(it => it.quote.from !== undefined && it.quote.to !== undefined);
  const hits: { x: ReadingExclusion; r: MapReading }[] = [];
  for (const r of mapReadings(c.o)) for (const x of r.exclusions ?? []) {
    if (!x.record || x.from === null || x.to === null) continue;
    if (spans.some(s => s.quote.record === x.record && s.quote.from! < x.to! && x.from! < s.quote.to!)) hits.push({ x, r });
  }
  if (!hits.length) return null;
  const key = `${c.o.key}|${c.part.id}|ev-diag`, fold = h('details', { class: 'ev-group ev-diag', 'data-ev': 'diag', open: lensOpen.has(key) },
    h('summary', {}, '진단', h('small', {}, ` ${hits.length}`), h('span', { class: 'ev-other-hint' }, ' · 이 부분이 인용한 구간에 걸린 제외')),
    h('ol', { class: 'ev-diag-list' }, ...hits.map(({ x, r }) => h('li', {}, h('p', {}, x.explanation),
      h('small', { class: 'ev-diag-at' }, `정리 ${fullTime(r.at)} · ${x.path} · ${x.rule}${x.category ? ` / ${x.category}` : ''}`),
      c.o.kind === 'saved' ? h('button', { type: 'button', class: 'link-button', onclick: () => showQuote(x.record!, '', x.from ?? undefined) }, '원문에서 보기') : null))));
  fold.addEventListener('toggle', () => { if (fold.open) lensOpen.add(key); else lensOpen.delete(key); });
  return fold;
}


/* ---------- 이력 (map design v3 8.7) ---------- */
/** 이력: the change summary (withdrawals 이전 → 지금, newest first), every reading's words in time order (historySection), and the
 * change requests' results. */
function historyTab(c: PaneCtx): HTMLElement[] {
  const { o, part, u } = c;
  const out = [changesSection(c), u ? historySection(c) : null, currentRequestResults(o, part.id)].filter((x): x is HTMLElement => !!x);
  return out.length ? out : [h('p', { class: 'stp-blank ev-none' }, '이 부분을 읽은 정리가 아직 없어요')];
}
/** 이력: every reading's words about the part, oldest first; a withdrawal reads 이전 → 지금, each line its reading and time, and
 * a line the current reading no longer holds says so. Beyond HISTORY_SHOWN the earlier lines fold. */
function historySection(c: PaneCtx): HTMLElement | null {
  const { o } = c, part = c.part.id, u = c.u!;
  const all = historyEntries(u.history, new Set(u.claims.map(claimKey)), u.role); if (!all.length) return null;
  const readings = mapReadings(o);
  // map design v3 8.7-4: the three times apart, each only when known: the time the record names for the words (대상), the written
  // time the reading gives its records (작성 기준), when the record was taken in (가져온); the reading's own time heads the line.
  const times = (e: HistoryEntry) => { const r = readings.find(x => x.id === e.reading), rec = e.quote ? recordInfo(o, e.quote.record) : null;
    const list = [e.when ? `대상 시각 ${e.when}` : null, r?.basisAt ? `작성 기준 ${r.basisAt}` : null, rec?.at ? `가져온 시각 ${fullTime(rec.at)}` : null].filter((x): x is string => !!x);
    return list.length ? h('span', { class: 'hist-times', title: '대상 시각: 기록이 이 말에 적은 시각 · 작성 기준: 정리가 읽은 기록들이 스스로 적은 작성 시각 · 가져온 시각: 이 기록을 프로젝트에 들인 시각' }, list.join(' · ')) : null; };
  // A passage the current items cite reads by its footnote (the same number as in 구조 and 근거); one no item cites, as before.
  const cite = (e: HistoryEntry) => { if (!e.quote) return null; const it = c.book.span.get(spanKey(e.quote));
    return it ? fnButton(c, it, footText(it), `hist:${e.key}`, e.text) : quoteCite(JSON.stringify([part, 'hist', e.reading, e.index, e.quote.record, e.quote.from ?? null]), e.quote, '이력 근거'); };
  const key = `${o.key}|${part}|history-all`, open = lensOpen.has(key), { shown, hidden } = foldHistory(all, open);
  const item = (e: HistoryEntry) => h('li', { class: `hist-entry${e.current ? '' : ' gone'}` },
    h('span', { class: 'hist-top' },
      h('span', { class: 'hist-at', title: e.at }, fullTime(e.at)),
      h('span', { class: 'hist-reading', title: `정리 ${e.reading}` }, `정리 ${shortReading(e.reading)}`),
      h('span', { class: 'cl-tag' }, e.what === 'role' ? '설명' : TOPIC_LABEL[e.topic!]),
      e.current ? null : h('span', { class: 'hist-gone', title: e.what === 'role' ? '지금의 설명이 아니에요 (다른 설명이 서 있음)' : '지금 읽기에 없어요: 뒤의 기록이 대체했거나 같은 말이 다시 읽혔어요' }, '지금 읽기에 없음')),
    h('span', { class: 'cl-line' },
      e.before ? h('s', { class: 'cl-before', title: `이전: ${e.before}` }, e.before) : null, e.before ? h('span', { class: 'cl-arrow', 'aria-hidden': 'true' }, ' → ') : null,
      h('span', { class: 'cl-text' }, e.text)),
    h('span', { class: 'cl-meta' },
      times(e),
      e.evidence ? h('span', { class: `ev ev-${e.evidence}`, title: EVIDENCE_HINT[e.evidence] }, EVIDENCE_LABEL[e.evidence]) : null,
      e.where ? h('span', { class: 'cl-where', title: e.where }, e.where) : null,
      cite(e)));
  const toggle = all.length > HISTORY_SHOWN ? h('button', { type: 'button', class: 'link-button hist-more', 'aria-expanded': String(open), 'data-claim-focus': JSON.stringify([part, 'hist-more']),
    onclick: () => { if (open) lensOpen.delete(key); else lensOpen.add(key); reread('.hist-more'); } }, hidden ? `이전 ${hidden}개 펼치기` : `최근 ${HISTORY_SHOWN}개만 보기`) : null;
  return h('section', { class: 'lens-history', 'aria-label': `이력 ${all.length}` },
    h('h3', { title: '정리마다 이 부분에 대해 읽은 말, 오래된 것부터 · 철회는 이전 → 지금' }, '이력', h('small', {}, `정리 ${u.history.length} · 말 ${all.length}`)),
    h('p', { class: 'hist-note' }, '근거 번호는 지금 정리 기준이에요 · 새 정리가 들어오면 다시 매겨져요'), toggle, h('ol', { class: 'hist-list' }, ...shown.map(item)));
}
/** 출처 묶음: the records the part's reading rests on, newest first: each name opens the record, with how many of its words read
 * now (and in all the readings), whether the description rests on it, and the authors' evidence tags present (never the app's). */
function sourcesSection(o: Opened, part: string, u: PartUnderstanding): HTMLElement | null {
  const rows = sourceRows(u.claims, u.history, u.corrected ? [] : u.roleBasis, id => recordInfo(o, id).at); if (!rows.length) return null;
  return h('section', { class: 'lens-sources', 'aria-label': `기록 목록 · 기록 ${rows.length}` },
    h('h3', { title: '이 부분의 읽기가 기댄 기록 · 등급은 기록 작성자의 꼬리표 그대로' }, '기록 목록', h('small', {}, String(rows.length))),
    h('ul', { class: 'src-list' }, ...rows.map(x => { const info = recordInfo(o, x.record);
      return h('li', {},
        h('span', { class: 'src-top' },
          h('button', { type: 'button', class: 'link-button src-rec', 'data-claim-focus': JSON.stringify([part, 'src', x.record]), title: info.found ? `이 기록의 원문 열기 · ${info.name}` : '이 기록은 지금 프로젝트에 없어요', disabled: !info.found || o.kind !== 'saved',
            onclick: () => showQuote(x.record, '') }, info.name),
          h('span', { class: 'rail-kind' }, info.kind), info.at ? h('span', { class: 'rail-at', title: fullTime(info.at) }, ago(info.at)) : h('span', { class: 'rail-at blank' }, '시각 미상')),
        h('span', { class: 'src-meta cl-meta' },
          h('span', { class: 'src-count' }, `지금 ${x.current}${x.said > x.current ? ` · 이력 ${x.said}` : ''}`),
          x.role ? h('span', { class: 'cl-tag', title: '지금의 설명이 이 기록의 구절에 기대요' }, '설명 근거') : null,
          ...x.grades.map(g => h('span', { class: `ev ev-${g}`, title: EVIDENCE_HINT[g] }, EVIDENCE_LABEL[g])),
          x.untagged ? h('small', { class: 'src-untagged', title: '작성자의 꼬리표가 없는 말' }, `꼬리표 없음 ${x.untagged}`) : null));
    })));
}
/** The pane drawn again in place (a dispute marked, a fold toggled): the same scroll, and the focus on what had it (by selector). */
function reread(focus: string | null) {
  const o = opened; if (!o || !selected) return;
  if (sheetOpen) { renderPanel(false); if (focus) $('panel').querySelector<HTMLElement>(focus)?.focus({ preventScroll: true }); return; }
  const top = $('lens').querySelector('.lens-body')?.scrollTop ?? 0;
  renderLens();
  const body = $('lens').querySelector('.lens-body'); if (body) body.scrollTop = top;
  if (focus) $('lens').querySelector<HTMLElement>(`.lens-body ${focus}`)?.focus({ preventScroll: true });
}
/* 「이 해석이 틀림」 (map spec 6): the person marks a claim, or the description as read, wrong. The note goes to this map's own
 * view record (pane-view readDisputes/addDispute, by the map's view key and the part's stable key), never to the reading: the
 * claim stays as read, with a small struck chip 「틀림 표시」 whose title says when (and why, when said). The handover lists them. */
/** The claim whose note is being written (its part and key); one at a time. */
let disputing: { part: string; key: string; span?: string } | null = null;
function disputeNotes(o: Opened, part: string, key: string, said: string) {
  // A note on the description holds for the words it was given on: a later description is not marked by it.
  const notes = disputesOf(readDisputes(kv, viewKeyOf(o)), stableId(o, part), key);
  return key === ROLE_KEY ? notes.filter(n => !n.said || n.said === said.trim().slice(0, 300)) : notes;
}
/** A reading's 「이 해석이 틀림」 (8.6): the chip when marked, the control (open the form, or take the mark back) and the form: one of
 * the four reasons and an optional line; the claim, the span, the reading and the version go with it (the key and the words). span:
 * the 근거 item the form belongs to, when the same key is read in more than one place. */
function disputeBits(part: string, key: string, said: string, span?: string, word = '틀림'): { chip: HTMLElement | null; control: HTMLElement | null; form: HTMLElement | null } {
  const o = opened; if (!o || o.kind === 'legacy') return { chip: null, control: null, form: null };
  const notes = disputeNotes(o, part, key, said), sel = `[data-dispute="${CSS.escape(key)}"]${span ? `[data-dispute-at="${CSS.escape(span)}"]` : ''}`;
  const chip = notes.length ? h('s', { class: 'dispute-chip', title: disputeTitle(notes) }, '틀림 표시') : null;
  const writing = disputing?.part === part && disputing.key === key && (!disputing.span || !span || disputing.span === span);
  const control = h('button', { type: 'button', class: 'link-button dispute', 'data-dispute': key, ...(span ? { 'data-dispute-at': span } : {}), ...(notes.length ? {} : { 'aria-expanded': String(writing) }),
    title: notes.length ? '내 틀림 표시를 거둬요 (주장과 원문은 그대로)' : '이 해석이 틀림 · 원문과 주장은 그대로 두고, 틀렸다는 표시만 이 브라우저에 남겨요',
    onclick: () => {
      if (notes.length) { dropDispute(kv, viewKeyOf(o), stableId(o, part), key); disputing = null; }
      else disputing = writing ? null : { part, key, ...(span ? { span } : {}) };
      reread(disputing ? '.dispute-form input' : sel);
    } }, notes.length ? '표시 거두기' : word);
  let form: HTMLElement | null = null;
  if (writing && !notes.length) {
    const name = `df-${Math.random().toString(36).slice(2, 8)}`;
    const input = h('input', { type: 'text', maxlength: '300', placeholder: '덧붙일 말 (선택)', 'aria-label': '덧붙일 말 (선택)' }) as HTMLInputElement;
    const msg = h('p', { class: 'form-msg', role: 'status' });
    form = h('form', { class: 'dispute-form', 'aria-label': '이 해석이 틀림', onsubmit: (e: Event) => {
      e.preventDefault();
      const picked = (form!.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? '') as DisputeReason | '';
      if (!picked) { msg.textContent = '이유 넷 가운데 하나를 골라 주세요.'; form!.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.focus(); return; }
      const text = input.value.trim();
      addDispute(kv, viewKeyOf(o), stableId(o, part), { claimKey: key, at: new Date().toISOString(), reason: picked, ...(text ? { text: text.slice(0, 300) } : {}), said: said.trim().slice(0, 300) });
      disputing = null; reread(sel);
    } },
      h('fieldset', { class: 'df-reasons' }, h('legend', {}, '어떻게 틀렸나요'),
        ...DISPUTE_REASONS.map(r => h('label', { class: 'df-reason' }, h('input', { type: 'radio', name, value: r }), h('span', {}, DISPUTE_REASON_LABEL[r])))),
      input, msg,
      h('p', { class: 'df-foot' }, h('button', { type: 'submit', class: 'secondary small' }, '틀림 표시'),
        h('button', { type: 'button', class: 'link-button', onclick: () => { disputing = null; reread(sel); } }, '취소'),
        h('small', {}, '원문과 주장은 그대로 · 이 브라우저에만 남고 인수인계 문서에 실려요')));
    form.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); disputing = null; reread(sel); } });
  }
  return { chip, control, form };
}
/** The handover's 「사람이 틀렸다고 표시한 해석」: the notes of the parts in its range (the whole map when null), oldest first. */
function disputeLinesFor(o: Opened, scopeId: string | null): string[] {
  const all = readDisputes(kv, viewKeyOf(o)), items: (DisputedItem & { k: string })[] = [];
  for (const [k, notes] of Object.entries(all)) {
    const id = liveId(o, k), p = partOf(o, id); if (!p || (scopeId && !partPath(o.view, id).some(x => x.id === scopeId))) continue;
    for (const n of notes) {
      const now = n.claimKey === ROLE_KEY ? p.reading?.role ?? null : p.reading?.claims.find(c => claimKey(c) === n.claimKey)?.text ?? null;
      items.push({ part: p.name, said: n.said ?? now, at: n.at, ...(n.text ? { text: n.text } : {}), ...(n.reason ? { reason: n.reason } : {}), role: n.claimKey === ROLE_KEY, k: n.at });
    }
  }
  return disputeSection(items.sort((a, b) => a.k.localeCompare(b.k)).map(({ k: _k, ...x }) => x));
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
function understoodSection(o: Opened, part: PartView, marks: HTMLElement | null = null): HTMLElement | null {
  const u = part.reading; if (!u) return null;
  // The description as records read it, under the person's own description, in 이유's description block (the claims read in 원문,
  // the readings in 이력).
  const sec = h('div', { class: 'sec-understood' });
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
    sec.append(h('p', { class: 'und-role' }, u.role, marks), h('p', { class: 'src', title: u.roleAbout ?? '' }, u.corrected ? `직접 바로잡은 설명 · ${fullTime(u.corrected.at)}` : `기록에서 읽은 설명${u.roleAbout ? ` · ${displayAbout(u.roleAbout)} 기준` : ''}${u.roleBasisRevised ? REVISED_BASIS : ''}`,
      o.kind === 'saved' ? h('button', { type: 'button', class: 'link-button quiet', onclick: () => { fixingRole = { key: o.key, part: part.id }; renderPanel(false); requestAnimationFrame(() => document.getElementById('fix-role')?.focus()); } }, ' 설명 바로잡기') : null));
    // Descriptions read later that did not replace this one read in 구조's 확인 필요 (pane-view cautionRows), in both modes.
  }
  return sec.childNodes.length ? sec : null;
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
  paneTab = entryTab('ask'); // the answers read under 근거 (map design v3 8.8)
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
    else if (e.key === '0') { e.preventDefault(); mapMoved = true; fitView(true, true); if (syncLegendFold()) fitView(true, true); }
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
      const edge = edgeOf(d.edge); if (edge) pickLine(edge);
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
  $('zoom-fit').addEventListener('click', () => { mapMoved = true; fitView(true, true); if (syncLegendFold()) fitView(true, true); });
  document.querySelectorAll<HTMLElement>('.lens-seg [data-lens]').forEach(b => b.addEventListener('click', () => setLens(b.dataset.lens as LensId)));
  bindLegendKeys();
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
  // A footnote's preview (map design v3 8.4): Esc closes it first, wherever the focus is, and nothing else; a scroll elsewhere drops it.
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && previewShown()) { e.preventDefault(); e.stopImmediatePropagation(); hidePreview(); } }, true);
  document.addEventListener('scroll', e => { if (previewShown() && !(e.target instanceof Node && fnPopEl?.contains(e.target))) hidePreview(); }, true);
  document.addEventListener('keydown', e => {
    if ((e.target as HTMLElement).closest('textarea,select,input:not([type=checkbox]):not([type=radio])')) return; // Esc still works from a checkbox
    // 근거's way back (8.4-3): Alt+← only while the panel has the focus; elsewhere Alt+← is what it was.
    if (e.altKey && e.key === 'ArrowLeft' && selected && paneTab === 'evidence' && evReturn.length && paneRoot().contains(document.activeElement) && goReturn()) { e.preventDefault(); return; }
    if (handover.isOpen()) return; // the handover document is modal: its own Esc closes it and nothing under it
    if (e.key === 'Escape' && autoSync.isOpen()) { autoSync.close(); return; } // the sync panel is a popover over everything below
    // The wide reading is over everything (its own keys handle Esc inside it; this is focus left on the page).
    if (wide.isOpen()) { if (e.key === 'Escape') wide.escape(); return; }
    // Lenses (map design v3 7.3): Alt+1 … Alt+5 and [ ] pick one; L goes to the legend. On the map only, never inside a field.
    if (opened && !$('space').hidden && !$('space').classList.contains('sheet-read') && !openState) {
      const next = lensKey(e, viewLens, lensUsable);
      if (next) { e.preventDefault(); setLens(next); return; }
      if ((e.key === 'l' || e.key === 'L') && !e.altKey && !e.ctrlKey && !e.metaKey && !(e.target as HTMLElement).closest('#lens, #panel, [contenteditable]')) {
        const first = document.querySelector<HTMLElement>(`#line-key .lg-item${legend.picked ? `[data-item="${CSS.escape(legend.picked)}"]` : ''}`) ?? document.querySelector<HTMLElement>('#line-key .lg-item');
        if (first) { e.preventDefault(); first.focus(); return; }
      }
    }
    // The detail view's other two moves: 이전 읽기 위치 (Alt+←) and 상위 구성 (Alt+↑); 닫기 is Escape, below.
    if (e.altKey && openState?.mode === 'detail' && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) { e.preventDefault(); if (e.key === 'ArrowLeft') goBackPlace(); else goUp(); return; }
    // Innermost first: an open ⋯ menu closes before anything else, and focus goes back to its button.
    const menu = document.querySelector<HTMLDetailsElement>('details.more[open]');
    if (e.key === 'Escape' && menu) { menu.open = false; menu.querySelector<HTMLElement>('summary')?.focus(); return; }
    if (e.key === 'Escape' && !help.hidden) { help.hidden = true; helpButton.setAttribute('aria-expanded', 'false'); return; }
    if (e.key === 'Escape' && opened && openState) { e.preventDefault(); closeOpen(true); return; } // 닫기: the opening only
    if (e.key === 'Escape' && opened && signOpen && selected === signOpen.part && !sheetOpen) { e.preventDefault(); closeSign(true); return; } // the sign section only
    if (e.key === 'Escape' && opened && recentShown() && !$('recent').classList.contains('collapsed')) { if (selected || planView.isOpen()) recentPeek = false; else recentOpen = false; renderRecent(); return; }
    if (e.key === 'Escape' && planView.isOpen()) { const part = selected; planView.escape(); if (part && !selected) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag="${CSS.escape(part)}"]`)?.focus()); return; }
    if (e.key === 'Escape' && partForm && opened?.view.parts.length) { partForm = null; renderPartForm(); return; }
    if (e.key === 'Escape' && opened && stateHold) { stateHold = null; $('space').classList.remove('state-peek'); document.querySelectorAll('#world .state-on, .map-states .ms.on').forEach(el => { el.classList.remove('state-on', 'on'); el.setAttribute('aria-pressed', 'false'); }); return; }
    if (e.key === 'Escape' && opened && scOn) { e.preventDefault(); leaveScenario(); return; }
    if (e.key === 'Escape' && opened && selected && sheetOpen) { closeSheet(); return; }
    if (e.key === 'Escape' && opened && selected) { const key = opened.key, part = selected; go(key); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag="${CSS.escape(part)}"]`)?.focus()); return; }
    if (e.key === 'Escape' && opened && scopeReading && !selected) { closeScopeReading(); return; }
    if (e.key === 'Escape' && opened && returnView.isOpen() && !selected) { returnView.escape(); return; }
    if (e.key === 'Escape' && opened && scope) { const o = opened, from = scope; go(o.key, null, partOf(o, from)?.parentId ?? null); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag="${CSS.escape(from)}"]`)?.focus()); return; }
    // The end of the chain (7.3): the legend's selection and filters let go.
    if (e.key === 'Escape' && opened && legendActive()) legendAct({ do: 'clear' });
  });
  let resize = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resize); resize = requestAnimationFrame(() => { syncPaneWidth(); syncMapArea(); if (openState?.mode === 'detail') drawDetailLines(); if (opened && !selected && !planView.isOpen() && $('lens').hidden && !mapMoved) fitView(false); }); });
}

/** Hover: a line shows what it means (ends, kind, recorded note) without selecting; a part lights its own lines. */
let linePeek = 0;
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
      // Pointing at a line (6.4): it and its two ends light at once; after ~150 ms the rest of the map steps back (.peek), so
      // passing over lines on the way elsewhere never makes the map blink.
      world.querySelectorAll('.near-end, .near-self').forEach(el => el.classList.remove('near-end', 'near-self'));
      world.querySelectorAll('.edge.near:not(.path)').forEach(x => { if (x !== g) x.classList.remove('near'); });
      for (const end of [edge.from, edge.to]) world.querySelector(`[data-box="${CSS.escape(end)}"]`)?.classList.add('near-end');
      clearTimeout(linePeek); linePeek = window.setTimeout(() => { if (g.classList.contains('near')) space.classList.add('peek'); }, 150);
      const o = opened, said = o ? relationLines(o.project) : new Map<string, LineSaid>(), ch = lineChans.get(edge.key) ?? null;
      const modes = [...new Set(edge.ids.map(id => said.get(id)?.mode).filter((m): m is RelationMode => !!m))];
      const pays = [...new Set(edge.ids.map(id => said.get(id)?.payload).filter((p): p is string => !!p))];
      const facts = [ch ? `${CHANNEL_LABEL[ch]} · ${lineStyle(edge.kind, ch).stroke === 'solid' ? '실선 · 채운 머리' : lineStyle(edge.kind, ch).stroke === 'dashed' ? '파선 · 열린 머리' : '점렬 · 귀'}` : '', pays.length === 1 ? pays[0]! : pays.length ? `${pays.length}가지` : '', modes.length === 1 ? MODE_LABEL[modes[0]!] : ''].filter(Boolean).join(' · ');
      const badge = lineBadges.get(edge.key);
      tip.replaceChildren(h('strong', {}, `${nameOf(edge.from)} ${edge.kind === 'related' ? '—' : '→'} ${nameOf(edge.to)}`),
        ...(facts ? [h('span', { class: 'tip-kind' }, facts)] : []), ...(badge ? badge.tip.split('\n').map((t, i) => h('span', { class: i ? 'tip-badge-w' : 'tip-badge' }, t)) : []), h('span', { class: 'tip-kind' }, `${REL_LABEL[edge.kind] ?? edge.kind}${restOf(edge) ? ` · 선택한 부분의 관계를 뺀 나머지 ${edge.ids.length}개` : edge.agg ? ` · 안쪽 관계 ${edge.ids.length}개의 요약 · 선택하면 실제 끝점` : edge.ids.length > 1 ? ` · 관계 ${edge.ids.length}개를 한 선으로 묶음` : ''}`),
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
    if (t.classList.contains('edge-hit')) { tip.hidden = true; clearTimeout(linePeek); }
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
