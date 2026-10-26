/* AgentFlow Studio client: entry → map → focused part. Reads project.7 data (saved projects and built examples) and never
 * rewrites records; the only project write is the user's own part name/note through the domain's editArea. */
import type { Project } from '../shared/types.js';
import { FILE_LIMIT } from '../shared/types.js';
import { WorkspaceStore, type EntryRef, storageErrorCode } from '../shared/storage.js';
import { parseProject } from '../shared/validation.js';
import { editArea, addArea, addChildArea, createProject, rename } from '../shared/domain.js';
import { studioView, subtreeRecords, partPath, buildAsk, STATUS_LABEL, STATUS_SHORT, RECORD_LABEL, type AskCoverage, type StudioView, type PartView, type RecordView, type AskIntent, type StudioReply } from '../shared/studio.js';
import { EXAMPLES, buildExample, exampleKeys } from '../shared/studio-examples.js';
import { layoutScope, edgePath, ROOT, HEAD, type ScopeLayout, type Positions, type Point } from './map-layout.js';
import { aiStatus, askStudio, AskError, ERROR_TEXT, type AiStatus } from './studio-api.js';
import { runtimeStorage } from './runtime.js';
import { $, h, put, svg, chevron, ago, fullTime, inspectorWidth } from './plan-dom.js';
import { CONVERTER_KEY, buildConverterProject, converterKeys } from './plan-source.js';
import { createPlanView } from './plan-view.js';

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

/* Map positions the person set by dragging: own key per project (saved projects only; examples stay in memory).
 * Kept apart from the stored layout.1 data, which the domain fills on every new area and so cannot tell a placed part
 * from an untouched one. Same browser only; a backup file does not carry them. */
const POSITIONS_KEY = 'agentflow.studio.positions.1';
const memoryPositions = new Map<string, Positions>();
function cleanPositions(v: unknown): Positions {
  const out: Positions = {};
  if (!v || typeof v !== 'object') return out;
  for (const [c, m] of Object.entries(v as Record<string, unknown>)) {
    if (!m || typeof m !== 'object') continue;
    for (const [id, p] of Object.entries(m as Record<string, unknown>)) {
      const x = (p as Point)?.x, y = (p as Point)?.y;
      if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 1e6 && Math.abs(y) < 1e6) (out[c] ??= {})[id] = { x, y };
    }
  }
  return out;
}
function positionsOf(o: Opened): Positions {
  let p = memoryPositions.get(o.project.id);
  if (!p) {
    p = {};
    if (o.kind === 'saved') { try { p = cleanPositions((JSON.parse(kv.getItem(POSITIONS_KEY) ?? '{}') as Record<string, unknown>)[o.project.id]); } catch { p = {}; } }
    memoryPositions.set(o.project.id, p);
  }
  return p;
}
function savePositions(o: Opened) {
  if (o.kind !== 'saved') return;
  try {
    const all = JSON.parse(kv.getItem(POSITIONS_KEY) ?? '{}') as Record<string, Positions>;
    all[o.project.id] = positionsOf(o); kv.setItem(POSITIONS_KEY, JSON.stringify(all));
  } catch { /* the in-memory positions still hold for this tab */ }
}

/* Scope = the part whose inside is shown (null = whole project). Each scope keeps its own camera for the way back. */
let scope: string | null = null;
let lay: ScopeLayout = { boxes: new Map(), edges: [], bounds: { x: 0, y: 0, w: 0, h: 0 } };
const cameras = new Map<string, { x: number; y: number; k: number }>();
const expandState = new Map<string, boolean>();
const camKey = (o: Opened, s: string | null) => `${o.project.id}|${s ?? ''}`;
/** Direct children of the scope open as frames; deeper parts stay folded until opened. */
/** Unfolded only for the part being looked at (not the person's own fold choice). */
const tempExpand = new Set<string>();
const isExpanded = (o: Opened) => (id: string, depth: number) => tempExpand.has(`${o.project.id}|${id}`) || (expandState.get(`${o.project.id}|${id}`) ?? depth === 0);
/** Marks every part between the scope and this part (exclusive) as unfolded in the given set or map. */
function expandPath(o: Opened, id: string, into: Set<string> | Map<string, boolean>) {
  for (let p = partOf(o, partOf(o, id)?.parentId ?? null), g = 0; p && p.id !== scope && g < 64; p = partOf(o, p.parentId), g++) {
    const k = `${o.project.id}|${p.id}`; if (into instanceof Set) into.add(k); else into.set(k, true);
  }
}
const partOf = (o: Opened, id: string | null) => (id ? o.view.parts.find(p => p.id === id) ?? null : null);
function insideScope(o: Opened, id: string): boolean {
  if (!scope) return true;
  for (let p = partOf(o, id), g = 0; p && g < 64; p = partOf(o, p.parentId), g++) if (p.parentId === scope) return true;
  return false;
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
  if (kind === 'example') { const toId = key === CONVERTER_KEY ? converterKeys(project) : exampleKeys(key.slice(3), project); alias = { toId, toKey: new Map([...toId].map(([k, id]) => [id, k])) }; }
  return { key, kind, project, ref, view: studioView(project), alias };
}

/* ---------- rendering ---------- */
async function render() {
  const r = route();
  if (!r.key) { if (opened) cameras.set(camKey(opened, scope), { ...camera }); planView.close(false); opened = null; selected = null; scope = null; renderHome(); return; }
  const next = projectFor(r.key);
  if (!next) { go(null); return; }
  const fresh = opened?.key !== next.key;
  const idOf = (x: string | null) => (x ? next.alias?.toId.get(x) ?? x : null), routeScope = idOf(r.scope), routePart = idOf(r.part);
  const nextScope = routeScope && next.view.parts.some(p => p.id === routeScope && p.childIds.length) ? routeScope : null;
  if (fresh || nextScope !== scope) {
    if (opened) cameras.set(camKey(opened, scope), { ...camera });
    if (fresh) scenes = [];
    else if (backing) scenes.pop();
    else scenes.push({ scope, selected });
    backing = false;
    // A scene equal to where we now are is not a way back (e.g. went inside, then up again).
    while (scenes.length && scenes.at(-1)!.scope === nextScope) scenes.pop();
    if (scenes.length > 12) scenes = scenes.slice(-12);
    opened = next; scope = nextScope; lastClick.id = '';
    if (fresh) planView.projectChanged();
    if (fresh) { selected = null; ask = null; editing = false; partForm = null; composerOpen = false; }
    tempExpand.clear();
    renderSpace('restore');
  }
  const o = opened!;
  const part = routePart && o.view.parts.some(p => p.id === routePart) ? routePart : null;
  // Opening a folded part for reference unfolds its way down only while it is open; the person's own folds come back after.
  const before = [...tempExpand].join('|');
  tempExpand.clear(); relayout(o);
  if (part && part !== scope && !lay.boxes.has(part)) {
    if (insideScope(o, part)) expandPath(o, part, tempExpand);
    else { location.replace(hashFor(o.key, part, partOf(o, part)!.parentId)); return; }
  }
  if ([...tempExpand].join('|') !== before) renderSpace('keep'); else relayout(o);
  select(part);
  if (returnCamera) { camera = returnCamera; returnCamera = null; applyCamera(true); }
}
/** Set when a change plan closes: the camera the person left, applied once the earlier selection and scope are back. */
let returnCamera: { x: number; y: number; k: number } | null = null;
/** The way back to earlier scenes (a scope and its selection), apart from the composition path: arriving from a side part, a
 * plan item or a record is not the same as the parent. Each scope keeps its own camera (cameras) and folds (expandState). */
let scenes: { scope: string | null; selected: string | null }[] = [];
let backing = false;
function sceneBack() {
  const o = opened, prev = scenes.at(-1); if (!o || !prev) return;
  backing = true; go(o.key, prev.selected && o.view.parts.some(p => p.id === prev.selected) ? prev.selected : null, prev.scope);
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
    if (o.key === CONVERTER_KEY) crumbs.push(h('span', { class: 'tag', title: '공개 합성 예제예요. 지도는 작성한 구조이고, 변경 구상은 이 탭에서만 남아요.' }, '예제'));
    else if (o.kind !== 'saved') crumbs.push(h('span', { class: 'tag', title: o.kind === 'example' ? 'Codex·Claude에서 전달받았다고 가정하고 쓴 예제 기록이에요. 저장되지 않아요.' : '' }, o.kind === 'example' ? '예제' : '읽기 전용'));
  }
  $('crumbs').replaceChildren(...crumbs);
  // Scope: up one level of the composition (not the same as going back).
  const sp = o ? partOf(o, scope) : null, bar = $('scope-bar');
  bar.hidden = !sp;
  if (o && sp) {
    const up = sp.parentId ? partOf(o, sp.parentId) : null, upName = up?.name ?? o.project.name;
    bar.replaceChildren(h('button', { type: 'button', class: 'scope-up', onclick: () => go(o.key, null, sp.parentId), title: `구성 위로 · ${upName}`, 'aria-label': `${upName}(으)로 올라가기` },
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
  }
  const entry = $('plan-entry'), planning = planView.isOpen();
  $('modebar').hidden = !o || o.kind === 'legacy';
  entry.setAttribute('aria-pressed', String(planning)); entry.classList.toggle('on', planning);
  entry.textContent = '변경 구상';
  entry.title = planning ? '변경 구상 닫기 (Esc) · 초안은 남아요' : '현재 지도 위에서 바꿀 모습을 시험해요';
  document.title = o ? `${o.project.name} · AgentFlow Studio` : 'AgentFlow Studio';
}

function projectCard(key: string, p: Project, example: boolean, lead?: string): HTMLElement {
  const v = studioView(p), last = v.records[0], lastPart = last?.partId ? v.parts.find(x => x.id === last.partId) : null;
  const changed = v.parts.filter(x => recentAt(x.lastAt)).length;
  const meta = [`부분 ${v.parts.length}`, v.records.length ? `기록 ${v.records.length}` : '기록 없음', changed ? `최근 바뀐 부분 ${changed}` : ''].filter(Boolean).join(' · ');
  return h('li', {}, h('a', { class: `project-card${example ? ' is-example' : ''}`, href: `#/p/${encodeURIComponent(key)}` },
    h('span', { class: 'card-top' }, h('strong', { class: 'card-name' }, p.name), last ? h('span', { class: 'card-time' }, ago(last.at)) : null),
    h('span', { class: 'card-purpose' }, p.space.brief?.text ?? '목적이 아직 적혀 있지 않아요.'),
    last ? h('span', { class: 'card-latest' }, h('span', { class: 'card-latest-part' }, lastPart?.name ?? '부분 미지정'), h('span', { class: 'card-latest-text' }, firstLine(last.text, 60)))
      : lead ? h('span', { class: 'card-latest' }, h('span', { class: 'card-latest-text' }, lead)) : null,
    h('span', { class: 'card-meta' }, meta)));
}

/** My projects lead; the examples are a tidy way in on a first visit and step back once there is work of one's own. */
function renderHome() {
  setBar(null);
  $('home').hidden = false; $('space').hidden = true;
  let converter: HTMLElement;
  try { if (!examples.has(CONVERTER_KEY)) examples.set(CONVERTER_KEY, buildConverterProject()); converter = projectCard(CONVERTER_KEY, examples.get(CONVERTER_KEY)!, true, '변경 구상 예제 · 폴더째 변환을 시험해요'); }
  catch { converter = h('li', { class: 'message' }, '예제 ‘문서 변환기’를 만들지 못했어요.'); }
  $('project-list').replaceChildren(...EXAMPLES.map(spec => {
    const key = `ex-${spec.id}`;
    try { if (!examples.has(key)) examples.set(key, buildExample(spec)); return projectCard(key, examples.get(key)!, true); }
    catch { return h('li', { class: 'message' }, `예제 ‘${spec.name}’을 만들지 못했어요.`); }
  }), converter);
  const saved = store.entries().filter(e => e.state === 'active');
  const cards: HTMLElement[] = [];
  for (const e of saved) { try { cards.push(projectCard(e.entryId, e.project, false)); } catch { cards.push(h('li', { class: 'message' }, `‘${e.project.name}’을 읽지 못했어요.`)); } }
  if (store.legacy?.project) cards.push(projectCard('legacy', store.legacy.project, false));
  $('saved-list').replaceChildren(...cards);
  $('saved-empty').hidden = !!cards.length;
  $('home').classList.toggle('has-mine', !!cards.length);
  const msg = $('home-message');
  const problem = store.readError ? '이 브라우저의 저장 공간을 읽지 못해 저장된 프로젝트를 보여 드릴 수 없어요. 저장된 내용은 바꾸지 않았어요.' : null;
  if (problem) { msg.textContent = problem; msg.hidden = false; } else if (!msg.dataset.keep) msg.hidden = true;
}

const relayout = (o: Opened) => { lay = layoutScope(o.view, scope, isExpanded(o), positionsOf(o)); };

const REL_LABEL: Record<string, string> = { flow: '넘겨줌', needs: '필요로 함', shares: '함께 씀', related: '관련' };
/** A part's line on the map: the state only when it says something. 'plan' (no request yet) stays quiet here; the inspector
 * still tells "no records" apart from "a planned note only". */
function metaLine(p: PartView, last: string | null): string | null {
  if (p.status === 'plan') return null;
  return `${STATUS_SHORT[p.status]}${last ? ` · ${ago(last)}` : ''}`;
}

/** camera: 'fit' (new view), 'restore' (a scope's own last camera, else fit), 'keep' (same view, structure changed). */
function renderSpace(cameraMode: 'fit' | 'restore' | 'keep' = 'fit') {
  const o = opened!; setBar(o);
  $('home').hidden = true; $('space').hidden = false;
  relayout(o);
  const world = $('world'), view = o.view;
  world.replaceChildren();
  const edges = svg('svg', { class: 'edges', width: '1', height: '1', 'aria-hidden': 'true' });
  const defs = svg('defs', {});
  for (const id of ['arrow', 'arrow-on', 'arrow-near']) {
    const m = svg('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' });
    m.append(svg('path', { d: 'M0,1.5 L9,5 L0,8.5 z' })); defs.append(m);
  }
  edges.append(defs);
  for (const e of lay.edges) {
    const g = svg('g', { class: `edge k-${e.kind}`, 'data-from': e.from, 'data-to': e.to, 'data-key': e.key });
    // No text on the map: the meaning shows on hover (tip) and in the selected part's 관련 부분.
    g.append(svg('path', { class: 'edge-line', 'marker-end': 'url(#arrow)' }), svg('path', { class: 'edge-hit' }));
    edges.append(g);
  }
  world.append(edges);
  const enterButton = (p: PartView) => h('button', { type: 'button', class: 'enter', title: `‘${p.name}’ 안으로 들어가기 · 부분 ${p.childIds.length}`, 'aria-label': `${p.name} 안으로 들어가기`, onclick: () => go(o.key, null, p.id) }, `${p.childIds.length}`, h('span', { 'aria-hidden': 'true' }, '›'));
  const toggleButton = (p: PartView, open: boolean) => h('button', { type: 'button', class: 'toggle', title: open ? '접기' : '여기서 펼치기', 'aria-label': `${p.name} ${open ? '접기' : '펼치기'}`, 'aria-expanded': String(open),
    onclick: () => { const k = `${o.project.id}|${p.id}`; expandState.set(k, !open); tempExpand.delete(k); renderSpace('keep'); if (selected) select(selected); } }, chevron(open));
  const keySelect = (id: string) => (e: Event) => { const k = (e as KeyboardEvent).key; if ((k === 'Enter' || k === ' ') && e.target === e.currentTarget) { e.preventDefault(); go(o.key, id); } };
  const boxes = [...lay.boxes.values()].sort((a, b) => (a.kind === 'frame' ? 0 : 1) - (b.kind === 'frame' ? 0 : 1) || a.depth - b.depth);
  // Same names under different parents read with their parent beside them (only where a name repeats in this view).
  const seen = new Map<string, number>();
  for (const b of boxes) if (b.kind !== 'ghost') { const n = partOf(o, b.id)!.name; seen.set(n, (seen.get(n) ?? 0) + 1); }
  const owner = (p: PartView) => (seen.get(p.name)! > 1 && p.parentId ? partOf(o, p.parentId)?.name ?? null : null);
  for (const b of boxes) {
    if (b.kind === 'ghost') {
      const id = b.id.slice(6), p = partOf(o, id)!, path = partPath(view, id).map(x => x.name);
      world.append(h('button', { type: 'button', class: 'ghost', 'data-box': b.id, 'data-part-ref': id, title: `이 범위 밖 · ${path.join(' › ')}`, onclick: () => go(o.key, id, p.parentId) }, h('span', { class: 'ghost-tag' }, '밖'), h('span', { class: 'ghost-name' }, p.name)));
      continue;
    }
    const p = partOf(o, b.id)!, of = owner(p);
    if (b.kind === 'frame') {
      const latest = subtreeRecords(view, p.id)[0]?.at ?? null;
      world.append(h('div', { class: `frame depth-${Math.min(b.depth, 2)}`, 'data-part': p.id, 'data-box': p.id },
        h('div', { class: `frame-head s-${p.status}${b.head > HEAD ? ' tall' : ''}`, 'data-part': p.id, 'data-drag': p.id, role: 'button', tabindex: '0', title: of ? `${of} › ${p.name}` : p.name, onkeydown: keySelect(p.id) },
          toggleButton(p, true), h('span', { class: 'frame-name' }, p.name),
          h('span', { class: 'plan-note' }), h('span', { class: 'frame-meta' }, latest ? h('span', { class: recentAt(latest) ? 'fresh' : '' }, ago(latest)) : null),
          enterButton(p))));
    } else {
      // A folded part reads its inside: latest record anywhere under it.
      const last = b.kids ? subtreeRecords(view, p.id)[0]?.at ?? null : p.lastAt, meta = metaLine(p, last);
      world.append(h('div', { class: `node s-${p.status}${recentAt(last) ? ' fresh' : ''}${b.kids ? ' has-kids' : ''}${meta || of ? '' : ' bare'}`, 'data-part': p.id, 'data-box': p.id, 'data-drag': p.id, role: 'button', tabindex: '0',
        title: `${of ? `${of} › ` : ''}${p.name}${p.note ? ` — ${p.note}` : ''}`, onkeydown: keySelect(p.id) },
        b.kids ? toggleButton(p, false) : null,
        h('span', { class: 'node-text' }, h('span', { class: 'node-name' }, p.name),
          meta ? h('span', { class: 'node-meta' }, h('i', { class: 'dot', 'aria-hidden': 'true' }), meta) : of ? h('span', { class: 'node-meta owner' }, `${of} 안`) : null,
          h('span', { class: 'plan-note' })),
        b.kids ? enterButton(p) : null));
    }
  }
  // Selected lines move to a layer above the group surfaces (below the parts), so a line that crosses a group is not read as
  // ending at it.
  const top = svg('svg', { class: 'edges edges-top', width: '1', height: '1', 'aria-hidden': 'true' });
  world.insertBefore(top, world.querySelector('.node, .ghost'));
  positionWorld();
  $('space').classList.toggle('in-scope', !!scope);
  const empty = $('space-empty');
  empty.hidden = view.parts.length > 0 || o.kind === 'saved';
  empty.textContent = view.records.length ? `아직 부분으로 나뉘지 않은 프로젝트예요. 기록 ${view.records.length}개는 ‘최근 기록’에서 볼 수 있어요.` : '아직 부분도 기록도 없는 프로젝트예요.';
  $('add-part').hidden = o.kind !== 'saved';
  $('arrange').hidden = !view.parts.length;
  partForm = !view.parts.length && o.kind === 'saved' ? { parentId: null } : partForm && view.parts.length ? partForm : null;
  renderPartForm();
  renderRecent();
  const saved = cameraMode === 'restore' ? cameras.get(camKey(o, scope)) : undefined;
  if (cameraMode === 'keep') applyCamera();
  else if (saved) { camera = { ...saved }; applyCamera(); }
  else fitView(false);
  planView.overlay();
}

/** Geometry only (also during a drag): boxes and edge paths from the current layout. */
function positionWorld() {
  const world = $('world');
  world.querySelectorAll<HTMLElement>('[data-box]').forEach(el => {
    const b = lay.boxes.get(el.dataset.box!); if (!b) return;
    el.style.left = `${b.x}px`; el.style.top = `${b.y}px`; el.style.width = `${b.w}px`; el.style.height = `${b.h}px`;
  });
  world.querySelectorAll<SVGGElement>('.edge').forEach(g => {
    const a = lay.boxes.get(g.dataset.from!), b = lay.boxes.get(g.dataset.to!); if (!a || !b) return;
    const d = edgePath(a, b, lay.boxes.values()).d; g.querySelectorAll('path').forEach(x => x.setAttribute('d', d));
  });
}

function renderRecent() {
  const o = opened!, sp = partOf(o, scope), all = sp ? subtreeRecords(o.view, sp.id) : o.view.records, LATEST = 7;
  const items = recentAll ? all : all.slice(0, LATEST), partial = items.length < all.length;
  // No records here: no entry and no reserved room.
  const none = !all.length, shown = recentShown() && !none;
  $('recent-toggle').hidden = none; $('recent-toggle').nextElementSibling!.toggleAttribute('hidden', none);
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
const ZOOM_MIN = 0.4, ZOOM_MAX = 1.6;
const PANEL_W = () => (planView.isOpen() || (selected && !$('panel').hidden) ? inspW() : 0);
const leftInset = () => 16;
/** Map tools sit at the bottom left; the map keeps clear of them only below this line. */
const BOTTOM = 64;
function applyCamera(animate = false) {
  const world = $('world'), vp = $('viewport');
  world.classList.toggle('animate', animate);
  world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`;
  vp.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
  vp.style.backgroundSize = `${20 * camera.k}px ${20 * camera.k}px`;
  $('zoom-level').textContent = `${Math.round(camera.k * 100)}%`;
}
/** Whole view in the free area. Opening never shrinks below 85%; only the explicit 전체 보기 button may go further. */
function fitView(explicit: boolean, animate = false) {
  const o = opened; if (!o) return;
  const vp = $('viewport').getBoundingClientRect(), left = leftInset() + 8, right = PANEL_W() + 24, top = 28, bottom = BOTTOM + 8;
  const w = Math.max(200, vp.width - left - right), hgt = Math.max(160, vp.height - top - bottom), B = lay.bounds;
  const fit = Math.min(1, w / Math.max(1, B.w + 40), hgt / Math.max(1, B.h + 40));
  const k = explicit ? Math.max(ZOOM_MIN, fit) : Math.max(0.85, fit);
  const mw = B.w * k, mh = B.h * k;
  camera = { k, x: left + (mw <= w ? (w - mw) / 2 : 12) - B.x * k, y: top + (mh <= hgt ? (hgt - mh) / 2 : 12) - B.y * k };
  applyCamera(animate);
}
function zoomAt(k: number, cx: number, cy: number, animate = false) {
  const nk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));
  camera = { k: nk, x: cx - (cx - camera.x) * (nk / camera.k), y: cy - (cy - camera.y) * (nk / camera.k) };
  applyCamera(animate);
}
/** Smallest pan that brings a world rectangle into the free map area (left of the inspector, above the tools); never a zoom.
 * Larger than the area: its top-left corner comes in. */
function revealRect(B: { x: number; y: number; w: number; h: number }) {
  const vp = $('viewport').getBoundingClientRect(), left = leftInset() + 16, right = vp.width - PANEL_W() - 24, top = 20, bottom = vp.height - BOTTOM - 12;
  const sx = camera.x + B.x * camera.k, sy = camera.y + B.y * camera.k, sw = B.w * camera.k, sh = B.h * camera.k;
  let dx = 0, dy = 0;
  if (sx + sw > right) dx = right - (sx + sw);
  if (sx + dx < left) dx = left - sx;
  if (sy + sh > bottom) dy = bottom - (sy + sh);
  if (sy + dy < top) dy = top - sy;
  if (dx || dy) { camera = { ...camera, x: camera.x + dx, y: camera.y + dy }; applyCamera(true); }
}
/** Keep the selected part visible beside the inspector (a large frame: its head and first rows). When the part and the other
 * ends of its lines fit together at this zoom, they come into view together. */
function reveal(partId: string) {
  const b = lay.boxes.get(partId); if (!b) return;
  const ends = lay.edges.filter(e => e.from === partId || e.to === partId).map(e => lay.boxes.get(e.from === partId ? e.to : e.from)).filter((x): x is NonNullable<typeof x> => !!x);
  const own = { x: b.x, y: b.y, w: Math.min(b.w, 420), h: Math.min(b.h, 300) };
  if (ends.length) {
    const all = [own, ...ends], x = Math.min(...all.map(r => r.x)), y = Math.min(...all.map(r => r.y));
    const B = { x, y, w: Math.max(...all.map(r => r.x + r.w)) - x, h: Math.max(...all.map(r => r.y + r.h)) - y };
    const vp = $('viewport').getBoundingClientRect();
    if (B.w * camera.k <= vp.width - PANEL_W() - 56 && B.h * camera.k <= vp.height - BOTTOM - 40) { revealRect(B); return; }
  }
  revealRect(own);
}

/* ---------- selection & panel ---------- */
let pendingRecord: string | null = null;
function select(partId: string | null) {
  const changed = selected !== partId;
  if (changed) { editing = false; composerOpen = false; if (ask && !ask.controller) ask = null; }
  if (!!selected !== !!partId) recentPeek = false;
  selected = partId;
  if (opened) renderRecent();
  markSelection(partId);
  $('space').classList.toggle('dim', !!partId);
  const panel = $('panel');
  if (planView.isOpen()) { panel.hidden = true; panel.replaceChildren(); clearHighlight(); planView.selectionChanged(); if (partId) reveal(partId); return; }
  if (!partId) { panel.hidden = true; panel.replaceChildren(); clearHighlight(); return; }
  panel.hidden = false;
  renderPanel(changed);
  reveal(partId);
  if (pendingRecord) { const id = pendingRecord; pendingRecord = null; openRecord(id); }
}

/** Selection on the map: the part, its lines and the parts at their other ends (drawn representative or side ghost). */
function markSelection(partId: string | null) {
  const related = new Set<string>(), base = document.querySelector('#world .edges:not(.edges-top)'), top = document.querySelector('#world .edges-top');
  document.querySelectorAll<SVGGElement>('.edge').forEach(el => {
    const on = !!partId && (el.dataset.from === partId || el.dataset.to === partId);
    const layer = on ? top : base; if (layer && el.parentNode !== layer) layer.append(el);
    el.classList.toggle('on', on); el.querySelector('.edge-line')!.setAttribute('marker-end', on ? 'url(#arrow-on)' : 'url(#arrow)');
    if (on) related.add(el.dataset.from === partId ? el.dataset.to! : el.dataset.from!);
  });
  document.querySelectorAll<HTMLElement>('.node[data-part],.frame,.ghost').forEach(el => {
    el.classList.toggle('selected', !!partId && el.dataset.part === partId);
    el.classList.toggle('related', related.has(el.dataset.box!));
  });
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
  const path = partPath(o.view, part.id).slice(0, -1), records = subtreeRecords(o.view, part.id);
  const state = part.status === 'plan' ? (records.length ? '요청 기록 없음' : part.note ? '계획 설명만 있음 · 기록 없음' : '기록 없음') : STATUS_LABEL[part.status];
  const menuItems = [
    o.kind !== 'legacy' ? h('button', { type: 'button', role: 'menuitem', onclick: () => { editing = !editing; renderPanel(false); } }, editing ? '고치기 닫기' : '이름·설명 고치기') : null,
    o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', onclick: () => openPartForm(part.id) }, '안에 부분 추가') : null
  ].filter((x): x is HTMLButtonElement => !!x);
  const head = h('header', { class: 'panel-head' },
    h('div', { class: 'panel-path' }, ...path.flatMap((x, i) => [i ? h('span', { 'aria-hidden': 'true' }, '›') : null, h('a', { href: hashFor(o.key, x.id, scope) }, x.name)]), path.length ? null : h('span', {}, o.project.name)),
    h('h2', { id: 'panel-title', tabindex: '-1' }, part.name),
    h('div', { class: 'panel-chips' }, h('span', { class: `state s-${part.status}` }, h('i', { class: 'dot', 'aria-hidden': 'true' }), state),
      records.length ? h('span', { class: 'chip plain' }, `기록 ${records.length}${records[0] ? ` · ${ago(records[0].at)}` : ''}`) : null),
    h('div', { class: 'head-tools' },
      menuItems.length ? h('details', { class: 'more' }, h('summary', { 'aria-label': '이 부분 고치기', title: '고치기' }, '⋯'), h('div', { class: 'more-menu', role: 'menu', onclick: (e: Event) => { ((e.currentTarget as HTMLElement).parentElement as HTMLDetailsElement).open = false; } }, ...menuItems)) : null,
      h('button', { type: 'button', class: 'close', 'aria-label': '닫고 지도로', title: '닫기 (Esc)', onclick: () => go(o.key) }, '×')));
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
  } else {
    put(now, h('p', { class: 'summary muted' }, records.length ? (part.childIds.length ? '이 부분 자체에 대한 정리는 아직 없어요. 안의 부분과 기록을 보세요.' : '요청 기록은 있고, 아직 받은 작업 보고는 없어요.') : '아직 설명도 연결된 기록도 없어요.'));
  }
  body.append(now);
  if (part.changes.length) body.append(h('section', { class: 'sec' }, h('h3', {}, '최근 변화'), h('ul', { class: 'changes' }, ...part.changes.map(c => h('li', {}, c)))));
  // 관련 부분: its inside, then the recorded links with their meaning.
  const links = o.view.relations.filter(r => r.from === part.id || r.to === part.id);
  if (part.childIds.length || links.length) {
    const rel = h('section', { class: 'sec sec-related' }, h('h3', {}, '관련 부분'));
    if (part.childIds.length) rel.append(h('p', { class: 'sub' }, `안쪽 ${part.childIds.length}`), h('div', { class: 'kids' }, ...part.childIds.map(id => {
      const c = o.view.parts.find(x => x.id === id)!, m = metaLine(c, c.childIds.length ? subtreeRecords(o.view, c.id)[0]?.at ?? null : c.lastAt);
      return h('a', { class: `kid s-${c.status}`, href: hashFor(o.key, id, scope) }, h('span', {}, c.name), c.childIds.length ? h('small', {}, `안쪽 ${c.childIds.length}`) : null, m ? h('small', {}, m) : null);
    })));
    if (links.length) rel.append(h('p', { class: 'sub' }, `연결 ${links.length}`), h('ul', { class: 'links' }, ...links.map(r => {
      const out = r.from === part.id, other = o.view.parts.find(x => x.id === (out ? r.to : r.from))!;
      const where = insideScope(o, other.id) ? null : partPath(o.view, other.id).slice(0, -1).map(x => x.name).join(' › ') || o.project.name;
      return h('li', {}, h('a', { href: hashFor(o.key, other.id, scope) },
        h('span', { class: 'dir', title: out ? '이 부분에서 나감' : '이 부분으로 들어옴' }, out ? '→' : '←'), h('strong', {}, other.name), h('span', { class: 'rel-kind' }, REL_LABEL[r.kind] ?? r.kind)),
        where ? h('span', { class: 'link-where' }, `${where} 안`) : null,
        r.note ? h('span', { class: 'link-note' }, r.note) : null);
    })));
    body.append(rel);
  }
  // What to do next with this part: going inside is explicit, never a side effect of selecting.
  if (part.childIds.length && part.id !== scope) body.append(h('div', { class: 'sec-acts' },
    h('button', { type: 'button', class: 'secondary go-in', onclick: () => go(o.key, null, part.id) }, `안으로 들어가기 · ${part.childIds.length}`, h('span', { 'aria-hidden': 'true' }, ' ›'))));
  if (records.length) {
    const showAll = records.length <= 5, list = h('ol', { class: 'records' }, ...records.slice(0, showAll ? records.length : 4).map(r => recordItem(o, r, r.partId !== part.id)));
    const sec = h('section', { class: 'sec' }, h('h3', {}, '근거 원문 ', h('small', {}, `개발 도구에서 받은 기록 ${records.length}`)), list);
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
  panel.replaceChildren(head, body, composer(o, part));
  if (scrollTop) body.scrollTop = 0; else body.scrollTop = keep;
}

/** The one write path for structure edits: saved projects through the workspace store, examples in memory only. */
async function commit(o: Opened, next: Project): Promise<string | null> {
  if (o.kind === 'saved' && o.ref) {
    try { o.ref = await store.save(o.ref, next); }
    catch (err) { return storageErrorCode(err) === 'STORAGE_CONFLICT' ? '다른 탭에서 이 프로젝트가 바뀌어 저장하지 않았어요. 새로고침한 뒤 다시 해 주세요.' : '저장하지 못했어요. 바뀐 내용은 적용하지 않았어요.'; }
  } else if (o.kind === 'example') examples.set(o.key, next);
  else return '이 프로젝트는 읽기 전용이에요.';
  o.project = next; o.view = studioView(next);
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
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary small' }, '만들기'), first ? null : h('button', { type: 'button', class: 'link-button', onclick: close }, '취소'))));
  box.hidden = false; name.focus();
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
    h('p', { class: 'ans-ask' }, h('span', {}, label), h('small', {}, `${ago(a.at)} · ${a.model}`)),
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
  const submitQuestion = () => { const q = input.value.trim(); if (q) { send('question', q); } };
  if (status.access === 'code') {
    const code = h('input', { id: 'access-code', type: 'password', placeholder: '접속 코드', autocomplete: 'off', value: sessionCode() }) as HTMLInputElement;
    // input (not only change): typing, paste and autofill are all kept.
    const keep = () => keepAccessCode(code.value);
    code.addEventListener('input', keep); code.addEventListener('change', keep);
    box.append(h('div', { class: 'access' }, h('label', { for: 'access-code' }, '접속 코드'), code));
  }
  if (!busy && !failed) quickButtons.append(h('button', { type: 'button', class: 'link-button fold', onclick: () => { composerOpen = false; if (!input.value.trim()) setDraft(o, part.id, ''); renderPanel(false); } }, '접기'));
  box.append(quickButtons,
    h('div', { class: 'ask-row' }, input, h('button', { type: 'button', class: 'primary send', disabled: busy, 'aria-label': '보내기', onclick: submitQuestion }, '보내기')),
    h('p', { class: 'fine' }, `${status.model ?? 'DeepSeek'}가 이 부분과 안의 부분 기록만 읽고 정리해요 · 개발을 실행하지 않아요`));
  return box;
}
let accessCodeMemory = '';
function keepAccessCode(value: string) { try { sessionStorage.setItem('agentflow.studio.access', value); } catch { /* memory only */ } accessCodeMemory = value; }

/* ---------- change plan (plan-view.ts) on this map ---------- */
const planView = createPlanView({
  current: () => opened,
  kv,
  status: () => status,
  accessCode: () => sessionCode(), keepAccessCode,
  selected: () => selected,
  boxes: () => lay.boxes,
  selectPart: id => { if (opened) go(opened.key, id); },
  showPart: id => { const o = opened; if (o) go(o.key, id, partOf(o, id)?.parentId ?? null); },
  reveal,
  capture: () => ({ selected, scope, camera: { ...camera } }),
  notice: (text, action) => toast(text, action),
  frame: parts => {
    // No zoom on opening: the person's camera stays; only the changed parts are brought beside the inspector by the smallest
    // pan (their first part when they do not fit together).
    const boxes = parts.map(id => lay.boxes.get(id)).filter((b): b is NonNullable<typeof b> => !!b); if (!boxes.length) return;
    const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
    const B = { x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y };
    // Too large to fit: revealRect keeps its top-left in view, so the most of it shows that a pan can show.
    revealRect(B);
  },
  restore: r => { const o = opened; if (!o) return; returnCamera = r.camera; go(o.key, r.selected, r.scope); },
  chrome: () => {
    const o = opened; if (!o) return;
    setBar(o); renderRecent();
    if (planView.isOpen()) { $('panel').hidden = true; $('panel').replaceChildren(); }
  }
});
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
    if (intent === 'question') setDraft(o, partId, '');
  } catch (e) {
    const code = e instanceof AskError ? e.code : 'REQUEST_FAILED';
    ask = code === 'CANCELLED' ? null : { partId, intent, question, controller: null, error: ERROR_TEXT[code] ?? `응답을 받지 못했어요 (${code}).`, coverage };
  }
  if (opened === o && selected === partId) { renderPanel(false); scrollThread(); }
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
  pill.dataset.state = status.ai;
  text.textContent = status.ai === 'deepseek' ? `AI 정리 · ${status.model ?? 'DeepSeek'}` : status.ai === 'off' ? 'AI 키 없음' : 'AI 서버 미연결';
  pill.title = status.ai === 'deepseek' ? '서버가 DeepSeek에 정리를 요청해요. 키는 서버에만 있어요.' : status.ai === 'off' ? '서버는 연결됐지만 AI 키가 설정되지 않았어요.' : '이 페이지에는 AI 서버가 연결되어 있지 않아요.';
}

/* ---------- canvas interaction ----------
 * Empty space: drag pans. A node or frame head: click selects, drag moves (frames carry their children; a child moves
 * inside its parent frame, which grows around it), double-click goes inside. Wheel zooms at the cursor (also Ctrl/⌘). */
let toastTimer = 0;
/** Double-click = two clicks on the same part, same view, same spot. */
let lastClick = { id: '', at: 0, x: 0, y: 0, scope: null as string | null };
function toast(text: string, action?: { label: string; run: () => void }) {
  const t = $('toast'); clearTimeout(toastTimer); t.replaceChildren();
  put(t, h('span', {}, text), action ? h('button', { type: 'button', class: 'link-button', onclick: () => { action.run(); t.hidden = true; } }, action.label) : null);
  t.hidden = false; toastTimer = window.setTimeout(() => { t.hidden = true; }, 8000);
}
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

function bindCanvas() {
  const vp = $('viewport');
  type Drag = { pointer: number; x: number; y: number; moved: boolean; mode: 'pan'; cx: number; cy: number }
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
    } else drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, mode: 'pan', cx: camera.x, cy: camera.y };
    vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener('pointermove', e => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    if (!drag.moved) { drag.moved = true; vp.classList.add(drag.mode === 'pan' ? 'grabbing' : 'moving'); if (drag.mode === 'part') document.querySelector(`[data-box="${CSS.escape(drag.id)}"]`)?.classList.add('dragging'); }
    if (drag.mode === 'pan') { camera = { ...camera, x: drag.cx + dx, y: drag.cy + dy }; applyCamera(); return; }
    const o = opened!; const pos = positionsOf(o);
    (pos[drag.container] ??= {})[drag.id] = { x: Math.round(drag.start.x + dx / camera.k), y: Math.round(drag.start.y + dy / camera.k) };
    relayout(o); positionWorld();
  });
  const end = (e: PointerEvent) => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const d = drag; drag = null; vp.classList.remove('grabbing', 'moving');
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    const o = opened; if (!o || e.type === 'pointercancel') return;
    if (d.mode === 'part' && d.moved) { savePositions(o); return; }
    if (d.mode === 'part') {
      const now = Date.now(), part = partOf(o, d.id);
      const twice = lastClick.id === d.id && lastClick.scope === scope && now - lastClick.at < 380 && Math.abs(lastClick.x - e.clientX) + Math.abs(lastClick.y - e.clientY) < 8;
      lastClick = { id: d.id, at: now, x: e.clientX, y: e.clientY, scope };
      if (twice && part?.childIds.length) { lastClick.id = ''; go(o.key, null, d.id); return; }
      go(o.key, d.id); return;
    }
    if (!d.moved && selected) go(o.key);
  };
  vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
  vp.addEventListener('wheel', e => {
    e.preventDefault();
    const r = vp.getBoundingClientRect(), unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const delta = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    // Pinch (ctrlKey) sends small deltas; a mouse notch is about 100.
    zoomAt(camera.k * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  const center = () => { const r = vp.getBoundingClientRect(); return [(r.width - PANEL_W()) / 2, r.height / 2] as const; };
  $('zoom-in').addEventListener('click', () => { const [x, y] = center(); zoomAt(camera.k + 0.15, x, y, true); });
  $('zoom-out').addEventListener('click', () => { const [x, y] = center(); zoomAt(camera.k - 0.15, x, y, true); });
  $('zoom-fit').addEventListener('click', () => fitView(true, true));
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
    if ((e.target as HTMLElement).closest('textarea,input')) return;
    // Innermost first: an open ⋯ menu closes before anything else, and focus goes back to its button.
    const menu = document.querySelector<HTMLDetailsElement>('details.more[open]');
    if (e.key === 'Escape' && menu) { menu.open = false; menu.querySelector<HTMLElement>('summary')?.focus(); return; }
    if (e.key === 'Escape' && !help.hidden) { help.hidden = true; helpButton.setAttribute('aria-expanded', 'false'); return; }
    if (e.key === 'Escape' && opened && recentShown() && !$('recent').classList.contains('collapsed')) { if (selected || planView.isOpen()) recentPeek = false; else recentOpen = false; renderRecent(); return; }
    if (e.key === 'Escape' && planView.isOpen()) { const part = selected; planView.escape(); if (part && !selected) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag="${CSS.escape(part)}"]`)?.focus()); return; }
    if (e.key === 'Escape' && partForm && opened?.view.parts.length) { partForm = null; renderPartForm(); return; }
    if (e.key === 'Escape' && opened && selected) { const key = opened.key, part = selected; go(key); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag="${CSS.escape(part)}"]`)?.focus()); return; }
    if (e.key === 'Escape' && opened && scope) { const o = opened, from = scope; go(o.key, null, partOf(o, from)?.parentId ?? null); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-drag="${CSS.escape(from)}"]`)?.focus()); }
  });
  let resize = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resize); resize = requestAnimationFrame(() => { if (opened && !selected && !planView.isOpen()) fitView(false); }); });
}

/** Hover: a line shows what it means (ends, kind, recorded note) without selecting; a part lights its own lines. */
function bindEdgeHints() {
  const world = $('world'), tip = $('edge-tip'), space = $('space');
  const nameOf = (boxId: string) => { const o = opened; if (!o) return ''; return partOf(o, boxId.startsWith('ghost:') ? boxId.slice(6) : boxId)?.name ?? ''; };
  const place = (e: PointerEvent) => { const r = space.getBoundingClientRect(); tip.style.left = `${Math.min(e.clientX - r.left + 14, r.width - 300)}px`; tip.style.top = `${e.clientY - r.top + 14}px`; };
  world.addEventListener('pointerover', e => {
    const t = e.target as Element, g = t.closest<SVGGElement>('.edge');
    if (g && t.classList.contains('edge-hit')) {
      const edge = lay.edges.find(x => x.key === g.dataset.key); if (!edge) return;
      g.classList.add('near');
      tip.replaceChildren(h('strong', {}, `${nameOf(edge.from)} → ${nameOf(edge.to)}`), h('span', { class: 'tip-kind' }, `${REL_LABEL[edge.kind] ?? edge.kind}${edge.ids.length > 1 ? ` · 관계 ${edge.ids.length}개를 한 선으로 묶음` : ''}`),
        ...edge.notes.slice(0, 3).map(n => h('span', {}, n)));
      tip.hidden = false; place(e as PointerEvent); return;
    }
    const part = t.closest<HTMLElement>('.node[data-box], .frame-head[data-part], .ghost[data-box]');
    if (part) { const id = part.dataset.box ?? part.dataset.part!; world.querySelectorAll<SVGGElement>('.edge').forEach(x => x.classList.toggle('near', x.dataset.from === id || x.dataset.to === id)); }
  });
  world.addEventListener('pointermove', e => { if (!tip.hidden) place(e); });
  world.addEventListener('pointerout', e => {
    const t = e.target as Element;
    if (t.classList.contains('edge-hit')) tip.hidden = true;
    const to = e.relatedTarget as Element | null;
    if (!to || !to.closest?.('.node, .frame-head, .ghost, .edge')) world.querySelectorAll('.edge.near').forEach(x => x.classList.remove('near'));
  });
}

/* ---------- import (backup file → new saved copy; the file's bytes are validated as project data) ---------- */
function bindNewProject() {
  const name = $<HTMLInputElement>('new-name'), msg = $('home-message');
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
    let project: Project;
    try { project = parseProject(await f.text()); } catch { say('AgentFlow 프로젝트 백업 파일이 아니거나 읽을 수 없어요. 아무것도 바꾸지 않았어요.'); return; }
    if (!store.writable) { say('이 브라우저에서는 저장할 수 없어 가져오지 못했어요.'); return; }
    try { const ref = await store.create(project, 'import'); say(`‘${project.name}’을 새 사본으로 가져왔어요.`); go(ref.entryId); }
    catch { say('가져오지 못했어요. 저장된 프로젝트는 그대로예요.'); }
  });
}

async function main() {
  store = new WorkspaceStore(kv, (navigator as Navigator & { locks?: { request(name: string, cb: () => unknown): Promise<unknown> } }).locks ?? null);
  try { await store.init(); } catch { store.read(); }
  bindCanvas(); bindImport(); bindNewProject();
  $('add-part').addEventListener('click', () => openPartForm(scope));
  $('plan-entry').addEventListener('click', () => planView.toggle());
  statusReady = aiStatus().then(s => { status = s; renderStatus(); planView.statusChanged(); if (opened && selected && !planView.isOpen()) renderPanel(false); });
  window.addEventListener('hashchange', () => void render());
  await render();
  await statusReady;
}
void main();
