/* AgentFlow Studio client: entry → map → focused part. Reads project.7 data (saved projects and built examples) and never
 * rewrites records; the only project write is the user's own part name/note through the domain's editArea. */
import type { Project } from '../shared/types.js';
import { FILE_LIMIT } from '../shared/types.js';
import { WorkspaceStore, type EntryRef, storageErrorCode } from '../shared/storage.js';
import { parseProject } from '../shared/validation.js';
import { editArea } from '../shared/domain.js';
import { studioView, subtreeRecords, partPath, buildAsk, STATUS_LABEL, RECORD_LABEL, type StudioView, type PartView, type RecordView, type AskIntent, type StudioReply } from '../shared/studio.js';
import { EXAMPLES, buildExample } from '../shared/studio-examples.js';
import { layoutMap, edgePath, type MapLayout } from './map-layout.js';
import { aiStatus, askStudio, AskError, ERROR_TEXT, type AiStatus } from './studio-api.js';
import { runtimeStorage } from './runtime.js';

/* ---------- small DOM helpers ---------- */
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | ((e: Event) => void)> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'style') el.style.cssText = v as string; // CSSOM: allowed under style-src 'self' (attributes are not)
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
const SVG = 'http://www.w3.org/2000/svg';
const put = (el: HTMLElement, ...children: Child[]) => { for (const c of children) if (c) el.append(c); };
const svg = (tag: string, attrs: Record<string, string>) => { const el = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };

function ago(at: string | null): string {
  if (!at) return '';
  const t = Date.parse(at); if (!Number.isFinite(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return '방금'; if (m < 60) return `${m}분 전`;
  const hr = Math.round(m / 60); if (hr < 24) return `${hr}시간 전`;
  const d = Math.round(hr / 24); if (d === 1) return '어제'; if (d < 7) return `${d}일 전`;
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(t));
}
const fullTime = (at: string) => { const t = new Date(at); return Number.isNaN(t.getTime()) ? '' : new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(t); };
const firstLine = (text: string, n = 90) => { const line = text.split('\n').find(l => l.trim())?.trim() ?? ''; return line.length > n ? `${line.slice(0, n)}…` : line; };
const recentAt = (at: string | null) => !!at && Date.now() - Date.parse(at) < 24 * 3600000;

/* ---------- state ---------- */
interface Opened { key: string; kind: 'example' | 'saved' | 'legacy'; project: Project; ref: EntryRef | null; view: StudioView; layout: MapLayout }
interface Answer { at: string; intent: AskIntent; question: string | null; model: string; reply: StudioReply; refs: Record<string, string> }
interface Ask { partId: string; intent: AskIntent; question: string | null; controller: AbortController | null; error: string | null }

let status: AiStatus = { ai: 'none', model: null, access: 'open' };
let statusReady: Promise<void> | null = null;
let opened: Opened | null = null;
let selected: string | null = null;
let camera = { x: 0, y: 0, k: 1 };
let ask: Ask | null = null;
let editing = false;
let recentOpen = window.innerWidth >= 1000;
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

/* ---------- routing: #/  ·  #/p/<key>  ·  #/p/<key>/<partId> ---------- */
function route(): { key: string | null; part: string | null } {
  const m = /^#\/p\/([^/]+)(?:\/([^/]+))?$/.exec(location.hash);
  return m ? { key: decodeURIComponent(m[1]!), part: m[2] ? decodeURIComponent(m[2]) : null } : { key: null, part: null };
}
const go = (key: string | null, part: string | null = null) => {
  const hash = key ? `#/p/${encodeURIComponent(key)}${part ? `/${encodeURIComponent(part)}` : ''}` : '#/';
  if (location.hash !== hash) location.hash = hash; else void render();
};

function projectFor(key: string): Opened | null {
  if (opened?.key === key) return opened;
  let project: Project | null = null, kind: Opened['kind'] = 'saved', ref: EntryRef | null = null;
  if (key.startsWith('ex-')) {
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
  const view = studioView(project);
  return { key, kind, project, ref, view, layout: layoutMap(view) };
}

/* ---------- rendering ---------- */
async function render() {
  const r = route();
  if (!r.key) { opened = null; selected = null; renderHome(); return; }
  const next = projectFor(r.key);
  if (!next) { go(null); return; }
  const fresh = opened?.key !== next.key;
  opened = next;
  if (fresh) { selected = null; ask = null; editing = false; renderSpace(); }
  select(r.part && next.view.parts.some(p => p.id === r.part) ? r.part : null);
}

function setBar(o: Opened | null) {
  $('crumb-sep').hidden = $('crumb-project').hidden = !o;
  $('crumb-project').textContent = o?.project.name ?? '';
  const tag = $('crumb-tag');
  tag.hidden = !o || o.kind === 'saved';
  tag.textContent = o?.kind === 'example' ? '예제 기록' : o?.kind === 'legacy' ? '이전 저장 · 읽기 전용' : '';
  tag.title = o?.kind === 'example' ? 'Codex·Claude에서 전달받았다고 가정하고 쓴 예제 기록이에요. 저장되지 않아요.' : '';
  document.title = o ? `${o.project.name} · AgentFlow Studio` : 'AgentFlow Studio';
}

function projectCard(key: string, p: Project, example: boolean): HTMLElement {
  const v = studioView(p), last = v.records[0], lastPart = last?.partId ? v.parts.find(x => x.id === last.partId) : null;
  const changed = v.parts.filter(x => recentAt(x.lastAt)).length;
  return h('li', {}, h('a', { class: 'project-card', href: `#/p/${encodeURIComponent(key)}` },
    h('span', { class: 'card-top' }, h('strong', { class: 'card-name' }, p.name), example ? h('span', { class: 'tag' }, '예제') : null),
    h('span', { class: 'card-purpose' }, p.space.brief?.text ?? '목적이 적혀 있지 않아요.'),
    last ? h('span', { class: 'card-latest' }, h('i', { class: `k-${last.kind}` }), h('span', {}, `${lastPart?.name ?? '부분 미지정'} · ${firstLine(last.text, 60)}`)) : null,
    h('span', { class: 'card-meta' }, `부분 ${v.parts.length} · 기록 ${v.records.length}${changed ? ` · 최근 바뀐 부분 ${changed}` : ''}`, last ? h('span', { class: 'card-time' }, ago(last.at)) : null)));
}

function renderHome() {
  setBar(null);
  $('home').hidden = false; $('space').hidden = true;
  const list = $('project-list');
  list.replaceChildren(...EXAMPLES.map(spec => {
    const key = `ex-${spec.id}`;
    try { if (!examples.has(key)) examples.set(key, buildExample(spec)); return projectCard(key, examples.get(key)!, true); }
    catch { return h('li', { class: 'message' }, `예제 ‘${spec.name}’을 만들지 못했어요.`); }
  }));
  const saved = store.entries().filter(e => e.state === 'active');
  const cards: HTMLElement[] = [];
  for (const e of saved) { try { cards.push(projectCard(e.entryId, e.project, false)); } catch { cards.push(h('li', { class: 'message' }, `‘${e.project.name}’을 읽지 못했어요.`)); } }
  if (store.legacy?.project) cards.push(projectCard('legacy', store.legacy.project, false));
  $('saved-list').replaceChildren(...cards);
  $('saved-title').hidden = !cards.length;
  const msg = $('home-message');
  const problem = store.readError ? '이 브라우저의 저장 공간을 읽지 못해 저장된 프로젝트를 보여 드릴 수 없어요. 저장된 내용은 바꾸지 않았어요.' : null;
  if (problem) { msg.textContent = problem; msg.hidden = false; } else if (!msg.dataset.keep) msg.hidden = true;
}

function renderSpace() {
  const o = opened!; setBar(o);
  $('home').hidden = true; $('space').hidden = false;
  const world = $('world'), { layout, view } = o;
  world.replaceChildren();
  world.style.width = `${layout.width}px`; world.style.height = `${layout.height}px`;
  const edges = svg('svg', { class: 'edges', width: String(layout.width + 2), height: String(layout.height + 2), 'aria-hidden': 'true' });
  const defs = svg('defs', {});
  for (const id of ['arrow', 'arrow-on']) {
    const m = svg('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
    m.append(svg('path', { d: 'M0,1 L9,5 L0,9 z' })); defs.append(m);
  }
  edges.append(defs);
  // Frames first (behind), deepest last so nested frames sit above their parents.
  const parts = [...view.parts].sort((a, b) => a.depth - b.depth);
  for (const p of parts) {
    const b = layout.boxes.get(p.id); if (!b?.group) continue;
    const inside = subtreeRecords(view, p.id), latest = inside[0]?.at ?? null;
    world.append(h('div', { class: `frame depth-${Math.min(p.depth, 2)}`, 'data-part': p.id, style: `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px` },
      h('button', { type: 'button', class: `frame-head s-${p.status}`, 'data-part': p.id, title: p.name, onclick: () => go(o.key, p.id) },
        h('span', { class: 'frame-name' }, p.name),
        h('span', { class: 'frame-meta' }, recentAt(latest) ? h('i', { class: 'new-dot', title: '최근 기록' }) : null, `${p.childIds.length}개 부분${latest ? ` · ${ago(latest)}` : ''}`))));
  }
  for (const r of view.relations) {
    const a = layout.boxes.get(r.from), b = layout.boxes.get(r.to); if (!a || !b) continue;
    const { d, mx, my } = edgePath(a, b), g = svg('g', { class: `edge k-${r.kind}`, 'data-from': r.from, 'data-to': r.to });
    g.append(svg('path', { d, 'marker-end': 'url(#arrow)' }));
    if (r.note) { const t = svg('text', { x: String(mx), y: String(my - 6), 'text-anchor': 'middle' }); t.textContent = r.note.length > 28 ? `${r.note.slice(0, 28)}…` : r.note; g.append(t); }
    edges.append(g);
  }
  world.prepend(edges);
  for (const p of view.parts) {
    const b = layout.boxes.get(p.id); if (!b || b.group) continue;
    world.append(h('button', { type: 'button', class: `node s-${p.status}${recentAt(p.lastAt) ? ' recent' : ''}`, 'data-part': p.id, title: `${p.name}${p.note ? ` — ${p.note}` : ''}`,
      style: `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`, onclick: () => go(o.key, p.id) },
      h('span', { class: 'node-name' }, p.name),
      h('span', { class: 'node-meta' }, h('i', { class: 'dot', 'aria-hidden': 'true' }), STATUS_LABEL[p.status], p.lastAt ? ` · ${ago(p.lastAt)}` : '')));
  }
  const empty = $('space-empty');
  empty.hidden = view.parts.length > 0;
  empty.textContent = view.records.length ? `아직 부분으로 나뉘지 않은 프로젝트예요. 기록 ${view.records.length}개는 왼쪽 ‘최근 변화’에서 볼 수 있어요.` : '아직 부분도 기록도 없는 프로젝트예요.';
  renderRecent();
  fitView(false);
}

function renderRecent() {
  const o = opened!, items = o.view.records.slice(0, 7);
  $('recent-count').textContent = String(o.view.records.length);
  $('recent').classList.toggle('collapsed', !recentOpen);
  $('recent-toggle').setAttribute('aria-expanded', String(recentOpen));
  $('recent-list').replaceChildren(...items.map(r => {
    const part = r.partId ? o.view.parts.find(x => x.id === r.partId) : null;
    return h('li', {}, h('button', { type: 'button', class: 'recent-item', disabled: !part, onclick: () => { if (part) { pendingRecord = r.id; go(o.key, part.id); } } },
      h('span', { class: 'ri-top' }, h('i', { class: `k-${r.kind}`, 'aria-hidden': 'true' }), h('strong', {}, part?.name ?? '부분 미지정'), h('span', { class: 'ri-kind' }, RECORD_LABEL[r.kind]), h('span', { class: 'ri-time' }, ago(r.at))),
      h('span', { class: 'ri-text' }, firstLine(r.text, 70))));
  }));
}

/* ---------- camera ---------- */
const PANEL_W = () => (selected && !$('panel').hidden ? Math.min(460, window.innerWidth - 24) + 24 : 0);
const leftInset = () => (recentOpen && window.innerWidth >= 900 ? 312 : 16);
function applyCamera(animate = false) {
  const world = $('world'), vp = $('viewport');
  world.classList.toggle('animate', animate);
  world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`;
  vp.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
  vp.style.backgroundSize = `${20 * camera.k}px ${20 * camera.k}px`;
  $('zoom-level').textContent = `${Math.round(camera.k * 100)}%`;
}
/** Whole map in the free area. Opening never shrinks below 85%; only the explicit 전체 보기 button may go further. */
function fitView(explicit: boolean, animate = false) {
  const o = opened; if (!o) return;
  const vp = $('viewport').getBoundingClientRect(), left = leftInset(), right = PANEL_W() + 16, top = 24, bottom = 72;
  const w = Math.max(200, vp.width - left - right), hgt = Math.max(160, vp.height - top - bottom);
  const fit = Math.min(1, w / Math.max(1, o.layout.width + 40), hgt / Math.max(1, o.layout.height + 40));
  const k = explicit ? Math.max(0.4, fit) : Math.max(0.85, fit);
  const mw = o.layout.width * k, mh = o.layout.height * k;
  camera = { k, x: left + (mw <= w ? (w - mw) / 2 : 12), y: top + (mh <= hgt ? (hgt - mh) / 2 : 12) };
  applyCamera(animate);
}
function zoomAt(k: number, cx: number, cy: number, animate = false) {
  const nk = Math.min(1.6, Math.max(0.4, k));
  camera = { k: nk, x: cx - (cx - camera.x) * (nk / camera.k), y: cy - (cy - camera.y) * (nk / camera.k) };
  applyCamera(animate);
}
/** Keep the selected part visible beside the panel. */
function reveal(partId: string) {
  const o = opened, b = o?.layout.boxes.get(partId); if (!o || !b) return;
  const vp = $('viewport').getBoundingClientRect(), left = leftInset(), right = vp.width - PANEL_W() - 16;
  const sx = camera.x + b.x * camera.k, sy = camera.y + b.y * camera.k, sw = Math.min(b.w, 420) * camera.k, sh = Math.min(b.h, 360) * camera.k;
  let dx = 0, dy = 0;
  if (sx < left || sx + sw > right) dx = (left + right) / 2 - (sx + sw / 2);
  if (sy < 16 || sy + sh > vp.height - 72) dy = vp.height / 2 - (sy + sh / 2);
  if (dx || dy) { camera = { ...camera, x: camera.x + dx, y: camera.y + dy }; applyCamera(true); }
}

/* ---------- selection & panel ---------- */
let pendingRecord: string | null = null;
function select(partId: string | null) {
  const o = opened!; const changed = selected !== partId;
  if (changed) { editing = false; if (ask && !ask.controller) ask = null; }
  selected = partId;
  document.querySelectorAll<HTMLElement>('[data-part]').forEach(el => el.classList.toggle('selected', el.dataset.part === partId && !el.classList.contains('frame')));
  document.querySelectorAll<HTMLElement>('.frame').forEach(el => el.classList.toggle('selected', el.dataset.part === partId));
  document.querySelectorAll<SVGGElement>('.edge').forEach(el => {
    const on = !!partId && (el.dataset.from === partId || el.dataset.to === partId);
    el.classList.toggle('on', on); el.querySelector('path')!.setAttribute('marker-end', on ? 'url(#arrow-on)' : 'url(#arrow)');
  });
  $('space').classList.toggle('dim', !!partId);
  const panel = $('panel');
  if (!partId) { panel.hidden = true; panel.replaceChildren(); clearHighlight(); return; }
  panel.hidden = false;
  renderPanel(changed);
  reveal(partId);
  if (pendingRecord) { const id = pendingRecord; pendingRecord = null; openRecord(id); }
}

function clearHighlight() { document.querySelectorAll('.node.cited,.frame.cited').forEach(el => el.classList.remove('cited')); }
function highlightParts(ids: Set<string>) {
  clearHighlight();
  document.querySelectorAll<HTMLElement>('.node[data-part],.frame[data-part]').forEach(el => { if (ids.has(el.dataset.part!)) el.classList.add('cited'); });
}

function recordItem(o: Opened, r: RecordView, showPart: boolean): HTMLElement {
  const part = showPart && r.partId ? o.view.parts.find(x => x.id === r.partId)?.name : null;
  return h('li', { class: 'record', id: `rec-${r.id}` }, h('details', {},
    h('summary', {}, h('span', { class: 'rec-top' }, h('i', { class: `k-${r.kind}`, 'aria-hidden': 'true' }), h('span', { class: 'rec-kind' }, RECORD_LABEL[r.kind]), part ? h('span', { class: 'rec-part' }, part) : null, h('span', { class: 'rec-time', title: fullTime(r.at) }, ago(r.at))),
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

function renderPanel(scrollTop: boolean) {
  const o = opened!, part = o.view.parts.find(p => p.id === selected)!, panel = $('panel');
  const prevBody = panel.querySelector('.panel-body'), keep = scrollTop ? 0 : prevBody?.scrollTop ?? 0;
  const draft = (panel.querySelector('#ask-input') as HTMLTextAreaElement | null)?.value ?? '';
  const path = partPath(o.view, part.id).slice(0, -1), records = subtreeRecords(o.view, part.id);
  const head = h('header', { class: 'panel-head' },
    h('div', { class: 'panel-path' }, ...path.flatMap((x, i) => [h('a', { href: `#/p/${encodeURIComponent(o.key)}/${encodeURIComponent(x.id)}` }, x.name), h('span', { 'aria-hidden': 'true' }, '›')]), path.length ? null : h('span', {}, o.project.name)),
    h('h2', { id: 'panel-title', tabindex: '-1' }, part.name),
    h('div', { class: 'panel-chips' }, h('span', { class: `chip s-${part.status}` }, h('i', { class: 'dot' }), STATUS_LABEL[part.status]),
      records.length ? h('span', { class: 'chip plain' }, `기록 ${records.length}${records[0] ? ` · ${ago(records[0].at)}` : ''}`) : null,
      o.kind !== 'legacy' ? h('button', { type: 'button', class: 'chip-button', onclick: () => { editing = !editing; renderPanel(false); } }, editing ? '고치기 닫기' : '이름·설명 고치기') : null),
    h('button', { type: 'button', class: 'close', 'aria-label': '닫고 지도로', title: '닫기 (Esc)', onclick: () => go(o.key) }, '×'));
  const body = h('div', { class: 'panel-body' });
  if (editing) body.append(editForm(o, part));
  // 지금 상황
  const now = h('section', { class: 'sec' }, h('h3', {}, '지금 상황'));
  if (part.summary) {
    now.append(h('p', { class: 'summary' }, part.summary), h('p', { class: 'src' }, `${part.origin ?? '전달받은 정리'}${records.find(r => r.kind === 'report') ? ` · ${ago(records.find(r => r.kind === 'report')!.at)}` : ''}`));
    if (part.proposal) now.append(h('div', { class: 'proposal' }, h('strong', {}, '제안 · 아직 반영 안 됨'), h('span', {}, part.proposal)));
  } else if (records.length) {
    put(now, h('p', { class: 'summary muted' }, part.childIds.length ? '이 부분 자체에 대한 정리는 아직 없어요. 안의 부분과 기록을 보세요.' : '요청은 전달됐고 아직 돌아온 작업 보고가 없어요.'), part.note ? h('p', { class: 'note' }, h('span', {}, '계획'), part.note) : null);
  } else {
    put(now, h('p', { class: 'summary muted' }, '아직 이 부분에 연결된 기록이 없어요.'), part.note ? h('p', { class: 'note' }, h('span', {}, '계획'), part.note) : null);
  }
  if (part.summary && part.note) now.append(h('p', { class: 'note' }, h('span', {}, '계획'), part.note));
  body.append(now);
  if (part.changes.length) body.append(h('section', { class: 'sec' }, h('h3', {}, '최근 변화'), h('ul', { class: 'changes' }, ...part.changes.map(c => h('li', {}, c)))));
  if (part.childIds.length) body.append(h('section', { class: 'sec' }, h('h3', {}, '안의 부분'), h('div', { class: 'kids' }, ...part.childIds.map(id => {
    const c = o.view.parts.find(x => x.id === id)!;
    return h('a', { class: `kid s-${c.status}`, href: `#/p/${encodeURIComponent(o.key)}/${encodeURIComponent(id)}` }, h('i', { class: 'dot' }), h('span', {}, c.name), h('small', {}, c.lastAt ? ago(c.lastAt) : STATUS_LABEL[c.status]));
  }))));
  const links = o.view.relations.filter(r => r.from === part.id || r.to === part.id);
  if (links.length) body.append(h('section', { class: 'sec' }, h('h3', {}, '연결'), h('ul', { class: 'links' }, ...links.map(r => {
    const out = r.from === part.id, other = o.view.parts.find(x => x.id === (out ? r.to : r.from))!;
    return h('li', {}, h('a', { href: `#/p/${encodeURIComponent(o.key)}/${encodeURIComponent(other.id)}` }, h('span', { class: 'dir' }, out ? '→' : '←'), h('strong', {}, other.name)), r.note ? h('span', { class: 'link-note' }, r.note) : null);
  }))));
  if (records.length) {
    const showAll = records.length <= 5, list = h('ol', { class: 'records' }, ...records.slice(0, showAll ? records.length : 4).map(r => recordItem(o, r, r.partId !== part.id)));
    const sec = h('section', { class: 'sec' }, h('h3', {}, '기록 ', h('small', {}, '개발 도구에서 받은 원문')), list);
    if (!showAll) sec.append(h('button', { type: 'button', class: 'records-more link-button', onclick: (e: Event) => { list.replaceChildren(...records.map(r => recordItem(o, r, r.partId !== part.id))); (e.target as HTMLElement).remove(); } }, `기록 ${records.length - 4}개 더 보기`));
    body.append(sec);
  }
  const thread = answersOf(o, part.id);
  if (thread.length || (ask && ask.partId === part.id)) {
    const sec = h('section', { class: 'sec thread', 'aria-live': 'polite' }, h('h3', {}, '정리 결과'));
    for (const a of thread) sec.append(answerCard(o, a));
    if (ask && ask.partId === part.id) sec.append(ask.controller
      ? h('div', { class: 'pending' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, `${status.model ?? 'DeepSeek'}가 기록을 읽고 정리하고 있어요…`), h('button', { type: 'button', class: 'link-button', onclick: () => ask?.controller?.abort() }, '취소'))
      : h('div', { class: 'failed', role: 'alert' }, h('span', {}, ask.error ?? '응답을 받지 못했어요.'), h('button', { type: 'button', class: 'secondary small', onclick: () => send(ask!.intent, ask!.question) }, '다시 시도'), h('button', { type: 'button', class: 'link-button', onclick: () => { ask = null; renderPanel(false); } }, '닫기')));
    body.append(sec);
  }
  panel.replaceChildren(head, body, composer(part, draft));
  if (scrollTop) body.scrollTop = 0; else body.scrollTop = keep;
}

function editForm(o: Opened, part: PartView): HTMLElement {
  const name = h('input', { id: 'edit-name', maxlength: '60', value: part.name }) as HTMLInputElement;
  const note = h('textarea', { id: 'edit-note', rows: '3', maxlength: '2000' }) as HTMLTextAreaElement; note.value = part.note;
  const msg = h('p', { class: 'form-msg', role: 'status' }, o.kind === 'example' ? '예제는 저장되지 않아요. 이 탭에서만 바뀌어요.' : '');
  const form = h('form', { class: 'edit-form', onsubmit: async (e: Event) => {
    e.preventDefault();
    let next: Project;
    try { next = editArea(o.project, part.id, name.value, note.value); } catch { msg.textContent = '이름은 1~60자, 설명은 2,000자까지 쓸 수 있어요.'; return; }
    if (o.kind === 'saved' && o.ref) {
      try { o.ref = await store.save(o.ref, next); }
      catch (err) { msg.textContent = storageErrorCode(err) === 'STORAGE_CONFLICT' ? '다른 탭에서 이 프로젝트가 바뀌어 저장하지 않았어요. 새로고침한 뒤 다시 고쳐 주세요.' : '저장하지 못했어요. 바뀐 내용은 적용하지 않았어요.'; return; }
    } else if (o.kind === 'example') examples.set(o.key, next);
    o.project = next; o.view = studioView(next); o.layout = layoutMap(o.view); editing = false;
    const keepCam = { ...camera }; renderSpace(); camera = keepCam; applyCamera(); select(part.id);
  } },
    h('label', { for: 'edit-name' }, '이름'), name, h('label', { for: 'edit-note' }, '설명 ', h('small', {}, '계획에 적힌 내 말')), note, msg,
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary small' }, '저장'), h('button', { type: 'button', class: 'link-button', onclick: () => { editing = false; renderPanel(false); } }, '취소')));
  return form;
}

function answerCard(o: Opened, a: Answer): HTMLElement {
  const label = a.intent === 'summary' ? '지금 상황 정리' : a.intent === 'next' ? '다음에 판단할 것' : a.question ?? '질문';
  const list = (title: string, items: string[]) => items.length ? h('div', { class: 'ans-block' }, h('h4', {}, title), h('ul', {}, ...items.map(x => h('li', {}, x)))) : null;
  const cited = a.reply.refs.map(ref => ({ ref, id: a.refs[ref] })).filter((x): x is { ref: string; id: string } => !!x.id);
  const records = cited.map(c => o.view.records.find(r => r.id === c.id)).filter((r): r is RecordView => !!r);
  const partsCited = new Set(records.map(r => r.partId).filter((x): x is string => !!x));
  return h('article', { class: 'answer' },
    h('p', { class: 'ans-ask' }, h('span', {}, label), h('small', {}, `${ago(a.at)} · ${a.model}`)),
    h('p', { class: 'ans-head' }, a.reply.headline),
    a.reply.answer ? h('p', { class: 'ans-text' }, a.reply.answer) : null,
    list('지금 상황', a.reply.situation), list('최근 변화', a.reply.changes), list('다음에 판단할 것', a.reply.next),
    records.length ? h('div', { class: 'ans-refs' }, h('span', {}, '근거'), ...records.map(r => {
      const pn = r.partId ? o.view.parts.find(x => x.id === r.partId)?.name : null;
      return h('button', { type: 'button', class: 'ref', title: firstLine(r.text, 120), onclick: () => openRecord(r.id) }, `${RECORD_LABEL[r.kind]}${pn ? ` · ${pn}` : ''} · ${ago(r.at)}`);
    }), partsCited.size ? h('button', { type: 'button', class: 'link-button', onclick: () => { highlightParts(partsCited); } }, '지도에서 보기') : null) : null);
}

function composer(part: PartView, draft: string): HTMLElement {
  const box = h('div', { class: 'composer' });
  if (status.ai !== 'deepseek') {
    box.append(h('p', { class: 'ai-off' }, status.ai === 'off'
      ? '서버에 AI 키(DEEPSEEK_API_KEY)가 설정되지 않아 정리 요청을 보낼 수 없어요. 지도와 기록은 그대로 볼 수 있어요.'
      : 'AI 서버에 연결되지 않은 페이지예요. 지도와 기록은 그대로 볼 수 있고, 정리 요청은 서버가 연결된 주소에서 쓸 수 있어요.'));
    return box;
  }
  const busy = !!ask?.controller;
  const input = h('textarea', { id: 'ask-input', rows: '2', maxlength: '1000', placeholder: `‘${part.name}’에 대해 물어보세요`, disabled: busy }) as HTMLTextAreaElement;
  input.value = draft;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitQuestion(); } });
  const submitQuestion = () => { const q = input.value.trim(); if (q) { send('question', q); } };
  if (status.access === 'code') {
    const code = h('input', { id: 'access-code', type: 'password', placeholder: '접속 코드', autocomplete: 'off', value: sessionCode() }) as HTMLInputElement;
    code.addEventListener('change', () => { try { sessionStorage.setItem('agentflow.studio.access', code.value); } catch { /* memory only */ } accessCodeMemory = code.value; });
    box.append(h('div', { class: 'access' }, h('label', { for: 'access-code' }, '접속 코드'), code));
  }
  box.append(
    h('div', { class: 'quick' },
      h('button', { type: 'button', class: 'secondary small', disabled: busy, onclick: () => send('summary', null) }, '지금 상황 정리'),
      h('button', { type: 'button', class: 'secondary small', disabled: busy, onclick: () => send('next', null) }, '다음에 판단할 것')),
    h('div', { class: 'ask-row' }, input, h('button', { type: 'button', class: 'primary send', disabled: busy, 'aria-label': '보내기', onclick: submitQuestion }, '보내기')),
    h('p', { class: 'fine' }, `${status.model ?? 'DeepSeek'}가 이 부분과 안의 부분 기록만 읽고 정리해요 · 개발을 실행하지 않아요`));
  return box;
}
let accessCodeMemory = '';
function sessionCode(): string { try { return sessionStorage.getItem('agentflow.studio.access') ?? accessCodeMemory; } catch { return accessCodeMemory; } }

async function send(intent: AskIntent, question: string | null) {
  const o = opened, partId = selected; if (!o || !partId || ask?.controller) return;
  const { ask: payload, refs } = buildAsk(o.project, o.view, partId, intent, question);
  const controller = new AbortController();
  ask = { partId, intent, question, controller, error: null };
  renderPanel(false); scrollThread();
  try {
    const res = await askStudio(payload, controller.signal, sessionCode());
    addAnswer(o, partId, { at: new Date().toISOString(), intent, question, model: res.model, reply: res.reply, refs: Object.fromEntries(refs) });
    ask = null;
    const input = document.getElementById('ask-input') as HTMLTextAreaElement | null; if (input && intent === 'question') input.value = '';
  } catch (e) {
    const code = e instanceof AskError ? e.code : 'REQUEST_FAILED';
    ask = code === 'CANCELLED' ? null : { partId, intent, question, controller: null, error: ERROR_TEXT[code] ?? `응답을 받지 못했어요 (${code}).` };
  }
  if (opened === o && selected === partId) { renderPanel(false); scrollThread(); }
}
function scrollThread() {
  const body = document.querySelector<HTMLElement>('.panel-body'), last = body?.querySelector('.thread')?.lastElementChild as HTMLElement | null;
  if (body && last) body.scrollTo({ top: Math.max(0, last.offsetTop - 12), behavior: 'smooth' });
}

/* ---------- AI status pill ---------- */
function renderStatus() {
  const pill = $('ai-pill'), text = $('ai-text');
  pill.dataset.state = status.ai;
  text.textContent = status.ai === 'deepseek' ? `AI 정리 · ${status.model ?? 'DeepSeek'}` : status.ai === 'off' ? 'AI 키 없음' : 'AI 서버 미연결';
  pill.title = status.ai === 'deepseek' ? '서버가 DeepSeek에 정리를 요청해요. 키는 서버에만 있어요.' : status.ai === 'off' ? '서버는 연결됐지만 DEEPSEEK_API_KEY가 없어요.' : '이 페이지에는 AI 서버가 연결되어 있지 않아요.';
}

/* ---------- canvas interaction ---------- */
function bindCanvas() {
  const vp = $('viewport');
  let drag: { id: number; x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
  vp.addEventListener('pointerdown', e => {
    if ((e.target as HTMLElement).closest('button,a')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y, moved: false };
    vp.setPointerCapture(e.pointerId); vp.classList.add('grabbing');
  });
  vp.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    camera = { ...camera, x: drag.cx + dx, y: drag.cy + dy }; applyCamera();
  });
  const end = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const clicked = !drag.moved; drag = null; vp.classList.remove('grabbing');
    if (clicked && selected && opened) go(opened.key);
  };
  vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
  vp.addEventListener('wheel', e => {
    e.preventDefault();
    const r = vp.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(camera.k * Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
    else { camera = { ...camera, x: camera.x - e.deltaX, y: camera.y - e.deltaY }; applyCamera(); }
  }, { passive: false });
  const center = () => { const r = vp.getBoundingClientRect(); return [(r.width - PANEL_W()) / 2, r.height / 2] as const; };
  $('zoom-in').addEventListener('click', () => { const [x, y] = center(); zoomAt(camera.k + 0.15, x, y, true); });
  $('zoom-out').addEventListener('click', () => { const [x, y] = center(); zoomAt(camera.k - 0.15, x, y, true); });
  $('zoom-fit').addEventListener('click', () => fitView(true, true));
  $('recent-toggle').addEventListener('click', () => { recentOpen = !recentOpen; if (opened) renderRecent(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && opened && selected && !(e.target as HTMLElement).closest('textarea,input')) { const key = opened.key, part = selected; go(key); requestAnimationFrame(() => document.querySelector<HTMLElement>(`.node[data-part="${part}"],.frame-head[data-part="${part}"]`)?.focus()); }
  });
  let resize = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resize); resize = requestAnimationFrame(() => { if (opened && !selected) fitView(false); }); });
}

/* ---------- import (backup file → new saved copy; the file's bytes are validated as project data) ---------- */
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
  bindCanvas(); bindImport();
  statusReady = aiStatus().then(s => { status = s; renderStatus(); if (opened && selected) renderPanel(false); });
  window.addEventListener('hashchange', () => void render());
  await render();
  await statusReady;
}
void main();
