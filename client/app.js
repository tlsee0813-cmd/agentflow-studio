import { FILE_LIMIT } from '../shared/types.js';
import { WorkspaceStore, storageErrorCode } from '../shared/storage.js';
import { parseProject } from '../shared/validation.js';
import { editArea, addArea, addChildArea, createProject, rename } from '../shared/domain.js';
import { studioView, subtreeRecords, partPath, buildAsk, STATUS_LABEL, STATUS_SHORT, RECORD_LABEL } from '../shared/studio.js';
import { EXAMPLES, buildExample, exampleKeys } from '../shared/studio-examples.js';
import { layoutScope, edgePath, lead, mapLead, isListGroup, ROOT, HEAD } from './map-layout.js';
import { aiStatus, askStudio, AskError, ERROR_TEXT } from './studio-api.js';
import { runtimeStorage } from './runtime.js';
import { $, h, put, svg, chevron, ago, fullTime, inspectorWidth } from './plan-dom.js';
import { CONVERTER_KEY, buildConverterProject, converterKeys } from './plan-source.js';
import { createPlanView } from './plan-view.js';
import { createReturnView } from './return-view.js';
import { UI62_KEY, buildUi62Project, ui62Keys } from '../shared/return-material.js';
/* ---------- small DOM helpers (shared with the change-plan view) ---------- */
const firstLine = (text, n = 90) => { const line = text.split('\n').find(l => l.trim())?.trim() ?? ''; return line.length > n ? `${line.slice(0, n)}…` : line; };
const recentAt = (at) => !!at && Date.now() - Date.parse(at) < 24 * 3600000;
let status = { ai: 'none', model: null, access: 'open' };
let statusReady = null;
let opened = null;
let selected = null;
let camera = { x: 0, y: 0, k: 1 };
let ask = null;
let editing = false;
/** The question box opens on demand; it stays open while there is a draft, a request in flight or an error. */
let composerOpen = false;
let recentAll = false;
/** Short note of what went to the AI when not everything fit (newest records first). null when everything went. */
function coverageText(c) {
    if (!c)
        return null;
    const out = [];
    if (c.records.sent < c.records.total)
        out.push(`기록 ${c.records.total}개 중 최신 ${c.records.sent}개`);
    if (c.records.cut)
        out.push(`${c.records.cut}개는 앞부분만`);
    if (c.links.sent < c.links.total)
        out.push(`연결 ${c.links.total}개 중 ${c.links.sent}개`);
    if (c.children.sent < c.children.total)
        out.push(`안의 부분 ${c.children.total}개 중 ${c.children.sent}개`);
    return out.length ? `${out.join(' · ')}만 보냄` : null;
}
/** Recent records open only on request (a popover above the map tools); they never reserve map room. While a part or the
 * plan is open the list folds; the person's own choice comes back on close. */
let recentOpen = false;
let recentPeek = false;
const recentShown = () => (selected || planView.isOpen() ? recentPeek : recentOpen);
/** One inspector width for a part and for the change plan (CSS: .inspector). Narrow windows: the whole width. */
const inspW = inspectorWidth;
const examples = new Map();
let store;
let storage = null;
try {
    storage = window.localStorage;
}
catch {
    storage = null;
}
const memoryStorage = new Map();
const kv = runtimeStorage({
    getItem: k => { try {
        return storage ? storage.getItem(k) : memoryStorage.get(k) ?? null;
    }
    catch {
        return null;
    } },
    setItem: (k, v) => { if (storage)
        storage.setItem(k, v);
    else
        memoryStorage.set(k, v); }
});
/* Answers: kept apart from the project (own key), so the saved project format is never touched. Examples stay in memory. */
const ANSWERS_KEY = 'agentflow.studio.answers.1';
const memoryAnswers = new Map();
function answersOf(o, partId) {
    const key = `${o.project.id}/${partId}`;
    if (o.kind === 'example')
        return memoryAnswers.get(key) ?? [];
    try {
        const all = JSON.parse(kv.getItem(ANSWERS_KEY) ?? '{}');
        return Array.isArray(all[key]) ? all[key] : [];
    }
    catch {
        return [];
    }
}
function addAnswer(o, partId, a) {
    const key = `${o.project.id}/${partId}`, list = [...answersOf(o, partId), a].slice(-6);
    if (o.kind === 'example') {
        memoryAnswers.set(key, list);
        return;
    }
    try {
        const all = JSON.parse(kv.getItem(ANSWERS_KEY) ?? '{}');
        all[key] = list;
        const keys = Object.keys(all);
        for (const k of keys.slice(0, Math.max(0, keys.length - 200)))
            delete all[k];
        kv.setItem(ANSWERS_KEY, JSON.stringify(all));
    }
    catch {
        memoryAnswers.set(key, list);
    }
}
/* Question drafts: kept per part across part/project switches; saved projects keep them across reloads (own key). */
const DRAFTS_KEY = 'agentflow.studio.drafts.1';
const memoryDrafts = new Map();
function getDraft(o, partId) {
    const key = `${o.project.id}/${partId}`;
    if (memoryDrafts.has(key))
        return memoryDrafts.get(key);
    if (o.kind !== 'saved')
        return '';
    try {
        const v = JSON.parse(kv.getItem(DRAFTS_KEY) ?? '{}')[key];
        return typeof v === 'string' ? v : '';
    }
    catch {
        return '';
    }
}
function setDraft(o, partId, value) {
    const key = `${o.project.id}/${partId}`;
    memoryDrafts.set(key, value);
    if (o.kind !== 'saved')
        return;
    try {
        const all = JSON.parse(kv.getItem(DRAFTS_KEY) ?? '{}');
        if (value.trim())
            all[key] = value.slice(0, 1000);
        else
            delete all[key];
        kv.setItem(DRAFTS_KEY, JSON.stringify(all));
    }
    catch { /* the in-memory draft still holds */ }
}
/* Map positions the person set by dragging: own key per project (saved projects only; examples stay in memory).
 * Kept apart from the stored layout.1 data, which the domain fills on every new area and so cannot tell a placed part
 * from an untouched one. Same browser only; a backup file does not carry them. */
const POSITIONS_KEY = 'agentflow.studio.positions.1';
const memoryPositions = new Map();
function cleanPositions(v) {
    const out = {};
    if (!v || typeof v !== 'object')
        return out;
    for (const [c, m] of Object.entries(v)) {
        if (!m || typeof m !== 'object')
            continue;
        for (const [id, p] of Object.entries(m)) {
            const x = p?.x, y = p?.y;
            if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 1e6 && Math.abs(y) < 1e6)
                (out[c] ??= {})[id] = { x, y };
        }
    }
    return out;
}
function positionsOf(o) {
    let p = memoryPositions.get(o.project.id);
    if (!p) {
        p = {};
        if (o.kind === 'saved') {
            try {
                p = cleanPositions(JSON.parse(kv.getItem(POSITIONS_KEY) ?? '{}')[o.project.id]);
            }
            catch {
                p = {};
            }
        }
        memoryPositions.set(o.project.id, p);
    }
    return p;
}
function savePositions(o) {
    if (o.kind !== 'saved')
        return;
    try {
        const all = JSON.parse(kv.getItem(POSITIONS_KEY) ?? '{}');
        all[o.project.id] = positionsOf(o);
        kv.setItem(POSITIONS_KEY, JSON.stringify(all));
    }
    catch { /* the in-memory positions still hold for this tab */ }
}
/* Scope = the part whose inside is shown (null = whole project). Each scope keeps its own camera for the way back. */
let scope = null;
let lay = { boxes: new Map(), edges: [], heads: [], bounds: { x: 0, y: 0, w: 0, h: 0 } };
const cameras = new Map();
const expandState = new Map();
const camKey = (o, s) => `${o.project.id}|${s ?? ''}`;
/** Direct children of the scope open as frames; deeper parts stay folded until opened. */
/** Unfolded only for the part being looked at (not the person's own fold choice). */
const tempExpand = new Set();
/** The preview owns only the ancestors needed to see its current actual target. User folds and record peeks stay separate. */
const previewExpand = new Set();
let previewTarget = null, previewScope = '';
const isExpanded = (o) => {
    const memo = new Map();
    const fn = (id, depth) => {
        const k = `${o.project.id}|${id}`;
        if (memo.has(k))
            return memo.get(k);
        let v;
        if (tempExpand.has(k) || previewExpand.has(k))
            v = true;
        else if (expandState.has(k))
            v = expandState.get(k);
        else
            v = defaultOpen(o, id, depth, fn);
        memo.set(k, v);
        return v;
    };
    return fn;
};
/** Without the person's own choice: the scope's direct children open, except rows of a list (they stay compact); and a part
 * that is the only child of an open part opens too, so a single-child path (a package with one source folder) shows what
 * it holds while every step of the path keeps its own head. */
function defaultOpen(o, id, depth, isOpen) {
    const p = partOf(o, id);
    if (!p || !p.childIds.length)
        return false;
    if (depth === 0)
        return !isListGroup(o.view, scope) && !budgetFolded(o).has(id);
    const parent = partOf(o, p.parentId);
    return !!parent && depth <= 3 && parent.childIds.length === 1 && isOpen(parent.id, depth - 1);
}
/** How many parts a first view of a scope shows unfolded, and how much room it may take. Past the count, the scope's
 * catalogue-like groups (a list by isListGroup: many leaves, few links among them) start folded, largest first, then the
 * other largest groups; past the room, the open group taking the most room. The overview keeps every group's name, count and
 * outside lines, and each opens at full size inside or in place. Decided once per scope, for its first view: the person's own
 * folds and places always win (expandState, positions), and a visited view keeps its camera. */
const SHOW_BUDGET = 28;
/** Per project and scope, for the life of the tab: an edit (a new view of the same project) or a later window size does not
 * decide the first view again. */
const foldMemo = new Map();
function budgetFolded(o) {
    const k = `${o.project.id}|${scope ?? ''}`, hit = foldMemo.get(k);
    if (hit)
        return hit;
    const ids = scope ? partOf(o, scope)?.childIds ?? [] : o.view.roots, out = new Set(), size = (id) => partOf(o, id)?.childIds.length ?? 0;
    let shown = ids.reduce((n, id) => n + 1 + size(id), 0);
    const bySize = (list) => list.filter(id => size(id) > 0).sort((a, b) => size(b) - size(a));
    const own = (id) => expandState.has(`${o.project.id}|${id}`); // the person's own fold or unfold is never decided again
    for (const id of [...bySize(ids.filter(id => isListGroup(o.view, id))), ...bySize(ids.filter(id => !isListGroup(o.view, id)))]) {
        if (shown <= SHOW_BUDGET)
            break;
        if (own(id))
            continue;
        out.add(id);
        shown -= size(id);
    }
    // Then the room it takes: the first view, its title included, must read at the opening scale (85%) in this window. Past
    // it, the open group taking the most room folds next, until it does or nothing is left to fold. Stored places count as
    // they are; a group opened or entered later may be larger than the window and is read by panning.
    const fits = (fold) => {
        const memo = new Map();
        const open = (id, depth) => {
            const hit = memo.get(id);
            if (hit !== undefined)
                return hit;
            const k = `${o.project.id}|${id}`, p = partOf(o, id);
            let v;
            if (expandState.has(k))
                v = expandState.get(k);
            else if (!p || !p.childIds.length)
                v = false;
            else if (depth === 0)
                v = !isListGroup(o.view, scope) && !fold.has(id);
            else {
                const parent = partOf(o, p.parentId);
                v = !!parent && depth <= 3 && parent.childIds.length === 1 && open(parent.id, depth - 1);
            }
            memo.set(id, v);
            return v;
        };
        const L = layoutScope(o.view, scope, open, positionsOf(o), measureName, undefined, mapAspect()), titleRoom = 100 + (scope ? 34 * relationGroups(scopeEnds(o)).length : 0);
        return { L, ok: (L.bounds.w + 40) * 0.85 <= window.innerWidth - 48 && (L.bounds.h + titleRoom + 40) * 0.85 <= window.innerHeight - 152 };
    };
    for (let g = 0; g < ids.length; g++) {
        const { L, ok } = fits(out);
        if (ok)
            break;
        const area = (id) => { const b = L.boxes.get(id); return b ? b.w * b.h : 0; };
        const next = ids.filter(id => size(id) > 0 && !out.has(id) && !own(id) && L.boxes.get(id)?.kind === 'frame').sort((a, b) => area(b) - area(a))[0];
        if (!next)
            break;
        out.add(next);
    }
    foldMemo.set(k, out);
    return out;
}
/** Marks every part between the scope and this part (exclusive) as unfolded in the given set or map. */
function expandPath(o, id, into) {
    for (let p = partOf(o, partOf(o, id)?.parentId ?? null), g = 0; p && p.id !== scope && g < 64; p = partOf(o, p.parentId), g++) {
        const k = `${o.project.id}|${p.id}`;
        if (into instanceof Set)
            into.add(k);
        else
            into.set(k, true);
    }
}
const partOf = (o, id) => (id ? o.view.parts.find(p => p.id === id) ?? null : null);
function insideScope(o, id) {
    if (!scope)
        return true;
    for (let p = partOf(o, id), g = 0; p && g < 64; p = partOf(o, p.parentId), g++)
        if (p.parentId === scope)
            return true;
    return false;
}
/** Explicit preview focus changes replace this path. Ordinary renders (sources, resize, manual pan, or a user fold) do not
 * rebuild it, so folding an ancestor while reading never immediately opens that ancestor again. */
function previewContext(id, explicit) {
    const o = opened, key = o ? camKey(o, scope) : '';
    if (id === previewTarget && key === previewScope && !explicit)
        return;
    previewTarget = id;
    previewScope = key;
    const next = new Set();
    if (o && id && id !== scope && partOf(o, id) && insideScope(o, id))
        expandPath(o, id, next);
    if (next.size === previewExpand.size && [...next].every(k => previewExpand.has(k)))
        return;
    previewExpand.clear();
    for (const k of next)
        previewExpand.add(k);
    if (o) {
        renderSpace('keep', false);
        markSelection(selected);
    }
}
/* ---------- routing: #/  ·  #/p/<key>[/in/<scope>][/<part>] ---------- */
function route() {
    const m = /^#\/p\/([^/]+)(?:\/in\/([^/]+))?(?:\/([^/]+))?$/.exec(location.hash);
    const d = (x) => (x ? decodeURIComponent(x) : null);
    return m ? { key: d(m[1]), scope: d(m[2]), part: d(m[3]) } : { key: null, scope: null, part: null };
}
/** Addresses use an example's stable part keys, so a copied or reloaded link opens the same part of a freshly built example. */
const addr = (key, id) => encodeURIComponent((opened?.key === key ? opened.alias?.toKey.get(id) : undefined) ?? id);
const hashFor = (key, part, s) => key ? `#/p/${encodeURIComponent(key)}${s ? `/in/${addr(key, s)}` : ''}${part ? `/${addr(key, part)}` : ''}` : '#/';
/** sc undefined = stay in the current scope of the same project. */
const go = (key, part = null, sc) => {
    const hash = hashFor(key, part, sc !== undefined ? sc : key === opened?.key ? scope : null);
    if (location.hash !== hash)
        location.hash = hash;
    else
        void render();
};
function projectFor(key) {
    if (opened?.key === key)
        return opened;
    let project = null, kind = 'saved', ref = null;
    if (key === CONVERTER_KEY) {
        if (!examples.has(key))
            examples.set(key, buildConverterProject());
        project = examples.get(key);
        kind = 'example';
    }
    else if (key === UI62_KEY) {
        if (!examples.has(key))
            examples.set(key, buildUi62Project());
        project = examples.get(key);
        kind = 'example';
    }
    else if (key.startsWith('ex-')) {
        const spec = EXAMPLES.find(e => `ex-${e.id}` === key);
        if (!spec)
            return null;
        if (!examples.has(key))
            examples.set(key, buildExample(spec));
        project = examples.get(key);
        kind = 'example';
    }
    else if (key === 'legacy') {
        project = store.legacy?.project ?? null;
        kind = 'legacy';
    }
    else {
        const e = store.entries().find(x => x.entryId === key && x.state === 'active');
        if (!e)
            return null;
        project = e.project;
        ref = { entryId: e.entryId, lifecycle: e.lifecycle, seq: e.seq };
    }
    if (!project)
        return null;
    let alias = null;
    if (kind === 'example') {
        const toId = key === CONVERTER_KEY ? converterKeys(project) : key === UI62_KEY ? ui62Keys(project) : exampleKeys(key.slice(3), project);
        alias = { toId, toKey: new Map([...toId].map(([k, id]) => [id, k])) };
    }
    return { key, kind, project, ref, view: studioView(project), alias };
}
/* ---------- rendering ---------- */
/** The address the last render read: a step between two history entries of the same address (A, then B, then A again) changes
 * no hash, so only popstate tells of it. */
let renderedHash = '';
async function render() {
    renderedHash = location.hash;
    const r = route();
    if (!r.key) {
        if (opened)
            cameras.set(camKey(opened, scope), { ...camera });
        planView.close(false);
        if (toastKey)
            dropToast();
        forgetVisits();
        opened = null;
        selected = null;
        scope = null;
        renderHome();
        return;
    }
    const next = projectFor(r.key);
    if (!next) {
        go(null);
        return;
    }
    const fresh = opened?.key !== next.key;
    if (fresh && toastKey && toastKey !== next.key)
        dropToast();
    // Which visit this arrival is: back to where a relation was followed from (this tab's own history entry, or the named way
    // back), forward again over it, or neither. Never told by the address alone: the same part can be two different visits.
    // Back or forward by any number of steps (the browser's menu, history.go(-2)): the entry names its own visit, and every
    // visit after it goes (or comes back) with it.
    const mark = visitMark(), leaving = !fresh && opened ? herePlace() : null;
    const backAt = !fresh && !pendingVisit ? visits.findIndex(v => v.id === (visitBack ?? mark.from)) : -1, back = backAt >= 0 ? visits[backAt] : null;
    const forwardAt = !fresh && !back && !pendingVisit && leaving && mark.to ? ahead.findIndex(v => v.id === mark.to) : -1;
    visitBack = null;
    if (back) {
        ahead.push(...visits.splice(backAt).reverse());
        returnCamera = back.from.camera;
    }
    if (fresh)
        forgetVisits();
    // A way back is not a move in or out of the composition: it lands where it left, with no travel.
    const travel = !fresh && !back && opened ? travelFrom(next) : null;
    const idOf = (x) => (x ? next.alias?.toId.get(x) ?? x : null), routeScope = idOf(r.scope), routePart = idOf(r.part);
    const nextScope = routeScope && next.view.parts.some(p => p.id === routeScope && p.childIds.length) ? routeScope : null;
    if (fresh || nextScope !== scope) {
        if (opened)
            cameras.set(camKey(opened, scope), { ...camera });
        if (fresh)
            scenes = [];
        else if (backing || (back && scenes.at(-1)?.scope === back.from.scope))
            scenes.pop();
        else
            scenes.push({ scope, selected });
        backing = false;
        // A scene equal to where we now are is not a way back (e.g. went inside, then up again).
        while (scenes.length && scenes.at(-1).scope === nextScope)
            scenes.pop();
        if (scenes.length > 12)
            scenes = scenes.slice(-12);
        opened = next;
        scope = nextScope;
        lastClick.id = '';
        if (fresh) {
            planView.projectChanged();
            returnView.projectChanged();
            readMarks = [];
            readingCamera = null;
        }
        // A new project starts with the map alone: the previous project's reading pane must not narrow its first view.
        if (fresh) {
            selected = null;
            ask = null;
            editing = false;
            partForm = null;
            composerOpen = false;
            sheetOpen = false;
            scopeReading = false;
            $('panel').hidden = true;
            $('panel').replaceChildren();
            hideLens();
        }
        tempExpand.clear();
        previewExpand.clear();
        previewTarget = null;
        previewScope = '';
        if (scopeReading) {
            scopeReading = false;
            if ($('lens').classList.contains('scope-read'))
                hideLens();
        }
        renderSpace('restore');
    }
    const travelling = !!travel && travel.to === scope;
    const o = opened;
    const part = routePart && o.view.parts.some(p => p.id === routePart) ? routePart : null;
    // Opening a folded part for reference unfolds its way down only while it is open; the person's own folds come back after.
    const before = [...tempExpand].join('|');
    tempExpand.clear();
    relayout(o);
    if (part && part !== scope && !lay.boxes.has(part)) {
        if (insideScope(o, part))
            expandPath(o, part, tempExpand);
        else {
            location.replace(hashFor(o.key, part, partOf(o, part).parentId));
            return;
        }
    }
    if ([...tempExpand].join('|') !== before)
        renderSpace('keep');
    else
        relayout(o);
    // Visits: kept only while the selection is the part a relation led to; any other way of moving on lets them go.
    if (pendingVisit) {
        if (pendingVisit.to === part && pendingVisit.from.key === o.key) {
            visits.push(pendingVisit);
            ahead = [];
            markEntry({ to: pendingVisit.id });
        }
        pendingVisit = null;
    }
    else if (forwardAt >= 0 && ahead[forwardAt].to === part && leaving) {
        const again = ahead.splice(forwardAt).reverse();
        again[0] = { ...again[0], from: leaving };
        visits.push(...again);
    }
    else if (!back && ahead.length && (part !== leaving?.selected || scope !== leaving?.scope))
        ahead = [];
    if (visits.length && visits.at(-1).to !== part)
        forgetVisits();
    if (visits.length > 12)
        visits = visits.slice(-12);
    select(part);
    setBar(o);
    if (returnCamera) {
        camera = returnCamera;
        returnCamera = null;
        applyCamera(true);
    }
    if (back)
        restoreSurface(back);
    if (travelling)
        playTravel(travel);
    rememberPlace();
    if (openPlanOnArrive) {
        openPlanOnArrive = false;
        if (!planView.isOpen() && o.kind !== 'legacy')
            planView.toggle();
    }
    // The development-material example opens on its reading (the material or a reading already made; never a call by itself).
    if (fresh && o.key === UI62_KEY && !part && !planView.isOpen() && !returnView.isOpen())
        returnView.open();
}
function travelFrom(next) {
    const r = route(), to = (r.scope ? next.alias?.toId.get(r.scope) ?? r.scope : null);
    if (to === scope)
        return null;
    if (to && lay.boxes.has(to) && lay.boxes.get(to).kind !== 'ghost')
        return { to, kind: 'in', rect: toScreen(lay.boxes.get(to)) };
    for (let c = partOf(next, scope), g = 0; c && g < 64; c = partOf(next, c.parentId), g++)
        if ((c.parentId ?? null) === to)
            return { to, kind: 'out', from: c.id };
    return null;
}
const reducedMotion = () => { try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
catch {
    return false;
} };
function playTravel(t) {
    if (reducedMotion())
        return;
    const world = $('world'), target = { ...camera }, vp = $('viewport').getBoundingClientRect();
    if (t.kind === 'in') {
        const B = core;
        if (!B.w || !B.h)
            return;
        const k = Math.min(t.rect.w / B.w, t.rect.h / B.h);
        camera = { k, x: t.rect.x - B.x * k + (t.rect.w - B.w * k) / 2, y: t.rect.y - B.y * k };
    }
    else {
        const b = lay.boxes.get(t.from);
        if (!b)
            return;
        const k = target.k * Math.min(2.2, Math.max(1.2, Math.min(vp.width * 0.6 / (b.w * target.k), vp.height * 0.6 / (b.h * target.k))));
        camera = { k, x: vp.width / 2 - (b.x + b.w / 2) * k, y: vp.height / 2 - (b.y + b.h / 2) * k };
        const el = world.querySelector(`[data-box="${CSS.escape(t.from)}"]`);
        if (el) {
            el.classList.remove('came-from');
            void el.offsetWidth;
            el.classList.add('came-from');
        }
    }
    world.classList.add('travel', t.kind === 'in' ? 'travel-in' : 'travel-out');
    applyCamera(false);
    void world.offsetWidth;
    requestAnimationFrame(() => { camera = target; world.classList.remove('travel-in', 'travel-out'); applyCamera(false); setTimeout(() => world.classList.remove('travel'), 360); });
}
/** Set when a change plan closes: the camera the person left, applied once the earlier selection and scope are back. */
let returnCamera = null;
/** The way back to earlier scenes (a scope and its selection), apart from the composition path: arriving from a side part, a
 * plan item or a record is not the same as the parent. Each scope keeps its own camera (cameras) and folds (expandState). */
let scenes = [];
let backing = false;
function sceneBack() {
    const o = opened, prev = scenes.at(-1);
    if (!o || !prev)
        return;
    if (visitScene(o)) {
        returnFromVisit();
        return;
    }
    backing = true;
    go(o.key, prev.selected && o.view.parts.some(p => p.id === prev.selected) ? prev.selected : null, prev.scope);
}
const visitTab = Math.random().toString(36).slice(2, 8);
let visits = [], ahead = [], pendingVisit = null, visitBack = null, visitSeq = 0;
function forgetVisits() { visits = []; ahead = []; pendingVisit = null; }
function herePlace() {
    const o = opened;
    if (!o)
        return null;
    const surface = selected ? (sheetOpen ? 'sheet' : 'lens') : scopeReading ? 'scope' : 'none';
    const body = surface === 'sheet' ? $('panel').querySelector('.panel-body') : surface === 'none' ? null : $('lens').querySelector('.lens-body');
    return { key: o.key, scope, selected, camera: { ...camera }, surface, sheetReturn, scroll: body?.scrollTop ?? 0 };
}
function visitMark() { const s = history.state; return { from: typeof s?.afVisitFrom === 'string' ? s.afVisitFrom : undefined, to: typeof s?.afVisitTo === 'string' ? s.afVisitTo : undefined }; }
function markEntry(m) {
    try {
        const s = history.state && typeof history.state === 'object' ? history.state : {};
        history.replaceState({ ...s, ...(m.from ? { afVisitFrom: m.from } : {}), ...(m.to ? { afVisitTo: m.to } : {}) }, '');
    }
    catch { /* the named way back still works in memory */ }
}
/** Called by a relation's own control just before it navigates (a modified click opening a new tab records nothing). */
function follow(far, r, e) {
    const from = herePlace();
    const m = e;
    if (!from || (m && (m.ctrlKey || m.metaKey || m.shiftKey || m.altKey || m.button)))
        return;
    const id = `${visitTab}.${++visitSeq}`;
    markEntry({ from: id });
    pendingVisit = { id, from, to: far, kind: r.kind, note: (r.note ?? '').trim() };
}
/** The visit the selection came by, when its way back is the same scene that the context row's back already names. */
function visitScene(o) {
    const v = visits.at(-1), prev = scenes.at(-1);
    return v && prev && v.from.key === o.key && v.to === selected && v.from.scope !== scope && v.from.scope === prev.scope && v.from.selected === prev.selected ? v : null;
}
function returnFromVisit() {
    const o = opened, v = visits.at(-1);
    if (!o || !v)
        return;
    // The entry the relation made is this one: step back in the browser's own history, so Back and Forward keep agreeing.
    if (visitMark().to === v.id) {
        history.back();
        return;
    }
    visitBack = v.id;
    go(o.key, v.from.selected, v.from.scope);
}
function restoreSurface(v) {
    const f = v.from;
    if (f.surface === 'sheet' && selected === f.selected) {
        sheetOpen = true;
        showReading(false, false);
    }
    // The same part read in another surface since (A0 summary -> B -> A1 sheet, then two steps back): the summary it left.
    else if (f.surface === 'lens' && selected === f.selected && sheetOpen) {
        sheetOpen = false;
        editing = false;
        showReading(false, false);
    }
    else if (f.surface === 'scope' && !selected) {
        scopeReading = true;
        renderScopeLens();
    }
    sheetReturn = f.surface === 'sheet' ? f.sheetReturn : null;
    const body = f.surface === 'sheet' ? $('panel').querySelector('.panel-body') : f.surface === 'none' ? null : $('lens').querySelector('.lens-body');
    if (body)
        body.scrollTop = f.scroll;
    // Keyboard: back on the relation it was followed by (without moving the restored reading). Now, while this arrival is the
    // page: never later, when the person may already be typing or reading somewhere else.
    // The surface just restored first (the map title also names a scope's relations); the map title only when nothing reads.
    const far = `[data-far="${CSS.escape(v.to)}"]`, own = f.surface === 'sheet' ? '#panel' : f.surface === 'none' ? null : '#lens';
    ((own && document.querySelector(`${own} ${far}`)) || document.querySelector(`#world .map-title ${far}`))?.focus({ preventScroll: true });
}
const REL_WHY = (v) => `‘${REL_LABEL[v.kind] ?? v.kind}’ 관계를 따라 왔어요${v.note ? ` · ${v.note}` : ''}`;
/** '로' or '으로' after a name; '(으)로' where its reading is not known from its last letter. */
function toParticle(name) {
    const c = name.trim().replace(/[^0-9A-Za-z\uac00-\ud7a3]+$/, '').slice(-1), code = c.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
        const jong = (code - 0xac00) % 28;
        return jong === 0 || jong === 8 ? '로' : '으로';
    }
    if (/[0-9]/.test(c))
        return '036'.includes(c) ? '으로' : '로';
    // Latin: a vowel, l/r and the endings read with a vowel ('-s' 스, '-x' 스) take 로; m, n, ng take 으로; a stop is unsure.
    if (/ng$/i.test(name.trim()) || /[mn]/i.test(c))
        return '으로';
    return /[aeiouylrsxzfhvw]/i.test(c) ? '로' : '(으)로';
}
/** The way back inside the reading pane, above the part's composition path: the name of the part it was followed from. Only
 * within one scene; a visit that changed the scene goes back by the context row's existing back (one way back, never two). */
function visitEntry(o) {
    const v = visits.at(-1);
    if (!v || v.to !== selected || v.from.key !== o.key || v.from.scope !== scope || !v.from.selected)
        return null;
    const name = partOf(o, v.from.selected)?.name;
    if (!name)
        return null;
    return h('button', { type: 'button', class: 'visit-back', 'aria-label': `${name}${toParticle(name)} 돌아가기`, title: `${name}${toParticle(name)} 돌아가기 · ${REL_WHY(v)}`, onclick: returnFromVisit }, h('span', { 'aria-hidden': 'true' }, '←'), h('strong', {}, name), h('span', {}, `${toParticle(name)} 돌아가기`));
}
/** One context row: the composition path (where this view sits), the scope's way up, the way back to the previous scene, and
 * whether the map reads the current state or a change preview. */
function setBar(o) {
    const sep = () => h('span', { class: 'sep', 'aria-hidden': 'true' }, '›');
    const crumbs = [h('a', { href: '#/' }, '프로젝트')];
    if (o) {
        const path = scope ? partPath(o.view, scope) : [];
        crumbs.push(sep(), path.length ? h('a', { href: hashFor(o.key, null, null), title: '전체 지도' }, o.project.name) : h('strong', { 'aria-current': 'location' }, o.project.name));
        path.forEach((p, i) => crumbs.push(sep(), i === path.length - 1
            ? h('button', { type: 'button', class: 'crumb-current', 'aria-current': 'location', title: `‘${p.name}’ 설명 보기`, onclick: () => go(o.key, p.id) }, p.name)
            : h('a', { href: hashFor(o.key, null, p.id) }, p.name)));
        if (o.key === UI62_KEY)
            crumbs.push(h('span', { class: 'tag', title: '공개 commit과 결과 문서에서 사후 편집한 실제 개발 자료예요. 지도는 자료집의 편집 분류이고, 이 탭에서만 남아요.' }, '예제 · 공개 자료'));
        else if (o.key === CONVERTER_KEY)
            crumbs.push(h('span', { class: 'tag', title: '공개 합성 예제예요. 지도는 작성한 구조이고, 변경 구상은 이 탭에서만 남아요.' }, '예제'));
        else if (o.kind !== 'saved')
            crumbs.push(h('span', { class: 'tag', title: o.kind === 'example' ? 'Codex·Claude에서 전달받았다고 가정하고 쓴 예제 기록이에요. 저장되지 않아요.' : '' }, o.kind === 'example' ? '예제' : '읽기 전용'));
    }
    $('crumbs').replaceChildren(...crumbs);
    // Scope: up one level of the composition (not the same as going back).
    const sp = o ? partOf(o, scope) : null, bar = $('scope-bar');
    bar.hidden = !sp;
    if (o && sp) {
        const up = sp.parentId ? partOf(o, sp.parentId) : null, upName = up?.name ?? o.project.name;
        bar.replaceChildren(h('button', { type: 'button', class: 'scope-up', onclick: () => go(o.key, null, sp.parentId), title: `구성 위로 · ${upName}`, 'aria-label': `${upName}(으)로 올라가기` }, h('span', { 'aria-hidden': 'true' }, '↑'), h('span', { class: 'scope-up-name' }, upName)));
    }
    else
        bar.replaceChildren();
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
        if (v)
            back.title = `${back.title} · ${REL_WHY(v)}`;
    }
    const entry = $('plan-entry'), planning = planView.isOpen();
    $('modebar').hidden = !o || o.kind === 'legacy';
    entry.setAttribute('aria-pressed', String(planning));
    entry.classList.toggle('on', planning);
    entry.textContent = '변경 구상';
    const ret = $('return-entry'), reading = returnView.isOpen() && !planView.isOpen();
    ret.setAttribute('aria-pressed', String(reading));
    ret.classList.toggle('on', reading);
    ret.title = reading ? '돌아와 읽기 닫기 (Esc)' : '무엇이 달라졌는지 자료로 읽어요';
    entry.title = planning ? '변경 구상 닫기 (Esc) · 초안은 남아요' : '현재 지도 위에서 바꿀 모습을 시험해요';
    document.title = o ? `${o.project.name} · AgentFlow Studio` : 'AgentFlow Studio';
}
/* ---------- home: back to the programs one is making ----------
 * Each program reads by its real composition: its top groups with the first parts inside (a cross-section of the same map it
 * opens to; nothing drawn that the project does not hold). Where this browser remembers the last scope or selection of a saved
 * project, a way to continue there. The model behind the AI is not shown here; it is named where it is used. */
const LAST_KEY = 'agentflow.studio.last.1';
function lastPlaces() { try {
    const v = JSON.parse(kv.getItem(LAST_KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
}
catch {
    return {};
} }
/** Saved projects only (examples are never stored): where the person was, apart from the project data. */
function rememberPlace() {
    const o = opened;
    if (!o || o.kind !== 'saved')
        return;
    try {
        const all = lastPlaces();
        all[o.project.id] = { scope, part: selected, at: new Date().toISOString() };
        const keys = Object.keys(all);
        for (const k of keys.slice(0, Math.max(0, keys.length - 100)))
            delete all[k];
        kv.setItem(LAST_KEY, JSON.stringify(all));
    }
    catch { /* a convenience only */ }
}
let openPlanOnArrive = false;
/** A package-like name ('@node-red/runtime') may break after its slashes rather than inside a word. */
const slashBreaks = (name) => name.split('/').flatMap((x, i, all) => (i < all.length - 1 ? [`${x}/`, document.createElement('wbr')] : [x]));
function programCard(key, p, example, keyOf) {
    const v = studioView(p), last = v.records[0];
    const changed = v.parts.filter(x => recentAt(x.lastAt)).length;
    const meta = [`부분 ${v.parts.length}`, v.records.length ? `기록 ${v.records.length}${last ? ` · ${ago(last.at)}` : ''}` : '기록 없음', changed ? `최근 바뀐 부분 ${changed}` : ''].filter(Boolean).join(' · ');
    const base = `#/p/${encodeURIComponent(key)}`, name = (id) => (id ? v.parts.find(x => x.id === id)?.name ?? null : null);
    // Continue: only a remembered place whose parts still exist.
    const at = example ? null : lastPlaces()[p.id];
    const cont = at && (at.scope || at.part) && (!at.scope || name(at.scope)) && (!at.part || name(at.part))
        ? h('a', { class: 'program-continue', href: `${base}${at.scope ? `/in/${encodeURIComponent(at.scope)}` : ''}${at.part ? `/${encodeURIComponent(at.part)}` : ''}` }, h('span', {}, '이어서'), h('strong', {}, name(at.part) ?? name(at.scope)), h('small', {}, at.part ? (at.scope ? `선택 · ${name(at.scope)} 안` : '선택') : '안쪽 보기'), h('span', { 'aria-hidden': 'true' }, '→')) : null;
    // Cross-section: the top groups in map order, each with the first parts inside; a part with no inside shows its own sentence.
    const roots = v.roots.map(id => v.parts.find(x => x.id === id)).filter(Boolean), MAX = 4;
    const section = roots.length ? h('ol', { class: 'program-section', 'aria-label': '최상위 구성' }, ...roots.slice(0, MAX).map(r => {
        const kids = r.childIds.map(id => v.parts.find(x => x.id === id)?.name).filter(Boolean);
        return h('li', {}, h('a', { href: `${base}/${encodeURIComponent(keyOf(r.id))}`, title: `‘${r.name}’ 선택해서 열기` }, h('strong', {}, ...slashBreaks(r.name)), kids.length ? h('span', {}, kids.slice(0, 3).join(' · '), kids.length > 3 ? h('small', {}, ` +${kids.length - 3}`) : null) : (mapLead(v, r.id) ? h('span', { class: 'quiet' }, mapLead(v, r.id)) : null)));
    }), roots.length > MAX ? h('li', { class: 'more' }, h('a', { href: base }, `+${roots.length - MAX}개 묶음`)) : null) : h('p', { class: 'program-empty' }, '아직 부분이 없어요 · 열어서 첫 부분을 적어요');
    const tryReturn = key === UI62_KEY ? h('a', { class: 'program-try', href: base }, h('strong', {}, '돌아와 읽기'), h('span', {}, '공개 개발 자료 10개 · 3단계로 늘려 읽기 · 사후 편집')) : null;
    const tryPlan = key === CONVERTER_KEY ? h('a', { class: 'program-try', href: base, onclick: () => { openPlanOnArrive = true; } }, h('strong', {}, '변경 구상 시험해 보기'), h('span', {}, '폴더째 변환 · 지금과 구상을 같은 자리에서 비교')) : null;
    return h('li', {}, h('article', { class: `program${example ? ' is-example' : ''}` }, h('a', { class: 'program-head', href: base }, h('strong', { class: 'program-name' }, p.name), h('span', { class: 'program-brief' }, p.space.brief?.text ?? '목적이 아직 적혀 있지 않아요.'), h('span', { class: 'program-meta' }, meta)), h('div', { class: 'program-body' }, section, cont, tryPlan, tryReturn)));
}
/** My programs lead; the examples show their real composition on a first visit and step back once there is work of one's own. */
function renderHome() {
    setBar(null);
    $('home').hidden = false;
    $('space').hidden = true;
    $('ai-pill').hidden = true;
    const invert = (m) => { const r = new Map([...m].map(([k, id]) => [id, k])); return (id) => r.get(id) ?? id; };
    let converter;
    try {
        if (!examples.has(CONVERTER_KEY))
            examples.set(CONVERTER_KEY, buildConverterProject());
        const c = examples.get(CONVERTER_KEY);
        converter = programCard(CONVERTER_KEY, c, true, invert(converterKeys(c)));
    }
    catch {
        converter = h('li', { class: 'message' }, '예제 ‘문서 변환기’를 만들지 못했어요.');
    }
    let material;
    try {
        if (!examples.has(UI62_KEY))
            examples.set(UI62_KEY, buildUi62Project());
        const m = examples.get(UI62_KEY);
        material = programCard(UI62_KEY, m, true, invert(ui62Keys(m)));
    }
    catch {
        material = h('li', { class: 'message' }, '예제 ‘AgentFlow UI62 개발 자료’를 만들지 못했어요.');
    }
    $('project-list').replaceChildren(converter, ...EXAMPLES.map(spec => {
        const key = `ex-${spec.id}`;
        try {
            if (!examples.has(key))
                examples.set(key, buildExample(spec));
            const ex = examples.get(key);
            return programCard(key, ex, true, invert(exampleKeys(spec.id, ex)));
        }
        catch {
            return h('li', { class: 'message' }, `예제 ‘${spec.name}’을 만들지 못했어요.`);
        }
    }), material);
    const saved = store.entries().filter(e => e.state === 'active');
    const cards = [];
    for (const e of saved) {
        try {
            cards.push(programCard(e.entryId, e.project, false, id => id));
        }
        catch {
            cards.push(h('li', { class: 'message' }, `‘${e.project.name}’을 읽지 못했어요.`));
        }
    }
    if (store.legacy?.project)
        cards.push(programCard('legacy', store.legacy.project, false, id => id));
    $('saved-list').replaceChildren(...cards);
    $('saved-empty').hidden = !!cards.length;
    $('home').classList.toggle('has-mine', !!cards.length);
    const msg = $('home-message');
    const problem = store.readError ? '이 브라우저의 저장 공간을 읽지 못해 저장된 프로젝트를 보여 드릴 수 없어요. 저장된 내용은 바꾸지 않았어요.' : null;
    if (problem) {
        msg.textContent = problem;
        msg.hidden = false;
    }
    else if (!msg.dataset.keep)
        msg.hidden = true;
}
/** Names measured in the page's own font (whatever the system falls back to), so card widths match what is drawn. */
const measureName = (() => {
    const cache = new Map();
    let ctx = null, family = '';
    return (text, kind) => {
        const key = `${kind}|${text}`, hit = cache.get(key);
        if (hit !== undefined)
            return hit;
        if (!ctx) {
            ctx = document.createElement('canvas').getContext('2d');
            family = getComputedStyle(document.body).fontFamily;
        }
        if (!ctx)
            return text.length * 9;
        ctx.font = kind === 'node' ? `600 13.5px ${family}` : kind === 'item' ? `550 13px ${family}` : kind === 'head' ? `650 15px ${family}` : kind === 'sub' ? `650 13px ${family}` : kind === 'plan' ? `600 12px ${family}` : `400 12.5px ${family}`;
        const w = ctx.measureText(text).width;
        cache.set(key, w);
        return w;
    };
})();
/* The map's title: the scope's purpose (the project's brief, or the note of the part whose inside is shown), above the map.
 * It belongs to the map, so it moves with it; the layout's bounds include it. */
const TITLE_GAP = 30;
let titleH = 0, core = { x: 0, y: 0, w: 0, h: 0 };
const titleRect = () => ({ x: core.x, y: core.y - titleH - TITLE_GAP, w: Math.min(640, Math.max(360, core.w)), h: titleH });
function withTitle() {
    if (!titleH)
        return;
    const t = titleRect(), B = core, x = Math.min(B.x, t.x), y = Math.min(B.y, t.y);
    lay.bounds = { x, y, w: Math.max(B.x + B.w, t.x + t.w) - x, h: Math.max(B.y + B.h, t.y + t.h) - y };
}
/** While a change preview reads on the map: the change lines each part's own row shows (plan-view decides; the layout only
 * makes room for them on those parts). null in the current view, so the current map keeps its own sizes. */
let planRows = null, planRowsKey = '';
/** The shape of the room a first view has for its parts (the window's map without the header, the title above the parts and
 * the margins; never the reading pane): what an unlinked block of parts is balanced against. */
const mapAspect = () => Math.max(1, Math.min(3, (window.innerWidth - 48) / Math.max(240, window.innerHeight - 252)));
const relayout = (o) => { lay = layoutScope(o.view, scope, isExpanded(o), positionsOf(o), measureName, planRows ?? undefined, mapAspect()); core = { ...lay.bounds }; withTitle(); };
/** Two real parts with one name under one parent ('Types' and 'Types'): told apart by the first clause of their own note, as
 * written ('원명 extHostTypes.ts'), only where the name is really ambiguous. Never merged, renamed or guessed: null when the name
 * is not shared, or when their own words do not tell them apart. */
function aliasOf(v, id) {
    const p = v.parts.find(x => x.id === id);
    if (!p)
        return null;
    const sibs = (p.parentId ? v.parts.find(x => x.id === p.parentId)?.childIds ?? [] : v.roots).filter(x => x !== id && v.parts.find(y => y.id === x)?.name === p.name);
    if (!sibs.length)
        return null;
    const clause = (t) => { const n = t.replace(/\s+/g, ' ').trim(), m = /^(.+?)(?:[:;：]|[.。](?=\s|$))/.exec(n); return (m ? m[1] : n).trim().slice(0, 60); };
    const mine = clause(p.note);
    return mine && !sibs.some(x => clause(v.parts.find(y => y.id === x)?.note ?? '') === mine) ? mine : null;
}
const REL_LABEL = { flow: '넘겨줌', needs: '필요로 함', shares: '함께 씀', related: '관련' };
/** A relation read from one end: the verb with that end as its subject ("이 부분이 필요로 함") or its object ("이 부분을 필요로
 * 함"). The kinds and their directions are the project's own; nothing here makes a relation more or less certain. */
function relLabel(kind, out, subject = '부분') {
    const it = `이 ${subject}`, verb = REL_LABEL[kind] ?? kind;
    if (kind === 'needs')
        return out ? `${it}${subject === '부분' ? '이' : '가'} 필요로 함` : `${it}${subject === '부분' ? '을' : '를'} 필요로 함`;
    if (kind === 'flow')
        return out ? `${it}${subject === '부분' ? '이' : '가'} 넘겨줌` : `${it}에 넘겨줌`;
    // A plain relation has no direction to read: one neutral verb, whichever end was recorded first.
    if (kind === 'related')
        return verb;
    return out ? `${verb} →` : `← ${verb}`;
}
/** Relations of one part (or one scope), grouped by verb and direction: what it uses before what uses it. */
function relationGroups(ends, subject = '부분') {
    const order = ['flow', 'needs', 'shares', 'related'], groups = new Map();
    const sorted = [...ends].sort((a, b) => Number(b.out) - Number(a.out) || order.indexOf(a.r.kind) - order.indexOf(b.r.kind));
    for (const x of sorted) {
        const k = `${x.r.kind === 'related' ? '' : x.out}|${x.r.kind}`;
        const g = groups.get(k) ?? { label: relLabel(x.r.kind, x.out, subject), list: [] };
        g.list.push(x);
        groups.set(k, g);
    }
    return [...groups.values()];
}
/** The direction mark of a relation row: from or to this end; none for a plain relation, which only says the two are related. */
const dirMark = (kind, out) => (kind === 'related' ? '–' : out ? '→' : '←');
const dirTitle = (kind, out) => (kind === 'related' ? '방향 없는 관련' : out ? '이 부분에서 나감' : '이 부분으로 들어옴');
/** A part's line on the map: the state only when it says something. 'plan' (no request yet) stays quiet here; the inspector
 * still tells "no records" apart from "a planned note only". */
function metaLine(p, last) {
    if (p.status === 'plan')
        return null;
    return `${STATUS_SHORT[p.status]}${last ? ` · ${ago(last)}` : ''}`;
}
/** camera: 'fit' (new view), 'restore' (a scope's own last camera, else fit), 'keep' (same view, structure changed). */
function renderSpace(cameraMode = 'fit', planOverlay = true) {
    const o = opened;
    setBar(o);
    $('home').hidden = true;
    $('space').hidden = false;
    $('ai-pill').hidden = false;
    relayout(o);
    const world = $('world'), view = o.view;
    world.replaceChildren();
    const edges = svg('svg', { class: 'edges', width: '1', height: '1', 'aria-hidden': 'true' });
    const defs = svg('defs', {});
    for (const id of ['arrow', 'arrow-on', 'arrow-near']) {
        const m = svg('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' });
        m.append(svg('path', { d: 'M0,1.5 L9,5 L0,8.5 z' }));
        defs.append(m);
    }
    // A selected line also marks where it starts, so both of its ends read on the map.
    // Every line marks the part it leaves from with a small dot, so the starting row reads without a label.
    for (const id of ['dot', 'dot-on']) {
        const d = svg('marker', { id, viewBox: '0 0 10 10', refX: '5', refY: '5', markerWidth: '6', markerHeight: '6' });
        d.append(svg('circle', { cx: '5', cy: '5', r: id === 'dot' ? '2.6' : '3.6' }));
        defs.append(d);
    }
    edges.append(defs);
    // A line between two parts of the same group belongs to that group: it reads above the group's surface (a line between
    // groups stays under them, so it never seems to end at a group it only passes).
    const frames = (id) => { const out = new Set(); for (let c = lay.boxes.get(id)?.container, g = 0; c && g < 64; c = lay.boxes.get(c)?.container, g++)
        if (lay.boxes.get(c)?.kind === 'frame')
            out.add(c); return out; };
    for (const e of lay.edges) {
        const fa = frames(e.from), inner = [...frames(e.to)].some(f => fa.has(f));
        const g = svg('g', { class: `edge k-${e.kind}${e.agg ? ' agg' : ''}${inner ? ' inner' : ''}`, 'data-from': e.from, 'data-to': e.to, 'data-key': e.key });
        // No text on the map: the meaning shows on hover (tip) and in the selected part's 관련 부분.
        // A plain relation ends in the same dot at both ends: it is drawn, not directed.
        g.append(svg('path', { class: 'edge-line', 'marker-end': e.kind === 'related' ? 'url(#dot)' : 'url(#arrow)', 'marker-start': 'url(#dot)' }), svg('path', { class: 'edge-hit' }));
        edges.append(g);
    }
    world.append(edges);
    const enterButton = (p) => h('button', { type: 'button', class: 'enter', title: `‘${p.name}’ 안으로 들어가기 · 부분 ${p.childIds.length}`, 'aria-label': `${p.name} 안으로 들어가기`, onclick: () => go(o.key, null, p.id) }, `${p.childIds.length}`, h('span', { 'aria-hidden': 'true' }, '›'));
    const toggleButton = (p, open) => h('button', { type: 'button', class: 'toggle', title: open ? '접기' : '여기서 펼치기', 'aria-label': `${p.name} ${open ? '접기' : '펼치기'}`, 'aria-expanded': String(open),
        onclick: () => { const k = `${o.project.id}|${p.id}`; expandState.set(k, !open); tempExpand.delete(k); previewExpand.delete(k); renderSpace('keep'); if (selected)
            select(selected); } }, chevron(open));
    const keySelect = (id) => (e) => { const k = e.key; if ((k === 'Enter' || k === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        go(o.key, id);
    } };
    const boxes = [...lay.boxes.values()].sort((a, b) => (a.kind === 'frame' ? 0 : 1) - (b.kind === 'frame' ? 0 : 1) || a.depth - b.depth);
    // Same names under different parents read with their parent beside them (only where a name repeats in this view).
    const seen = new Map();
    for (const b of boxes)
        if (b.kind !== 'ghost') {
            const n = partOf(o, b.id).name;
            seen.set(n, (seen.get(n) ?? 0) + 1);
        }
    const owner = (p) => (seen.get(p.name) > 1 && p.parentId ? partOf(o, p.parentId)?.name ?? null : null);
    // Reading levels: a region says why its parts belong together (the first sentence of its note); rows and list items carry a
    // name and, when there is one, a state. The full note and the reasons of relations are the selection's (the lens).
    for (const b of boxes) {
        if (b.kind === 'ghost') {
            const id = b.id.slice(6), p = partOf(o, id), path = partPath(view, id).map(x => x.name);
            // Its whole name (the layout sized the card for it); where it belongs reads once over its run (.ghost-head).
            world.append(h('button', { type: 'button', class: 'ghost', 'data-box': b.id, 'data-part-ref': id, title: `이 범위 밖 · ${path.join(' › ')}`, onclick: () => go(o.key, id, p.parentId) }, h('span', { class: 'ghost-name' }, p.name)));
            continue;
        }
        const p = partOf(o, b.id), of = owner(p);
        if (b.kind === 'frame') {
            const latest = subtreeRecords(view, p.id)[0]?.at ?? null, region = b.depth === 0, note = region ? mapLead(view, p.id) : '';
            world.append(h('div', { class: `frame ${region ? 'region' : 'group'} depth-${Math.min(b.depth, 2)}${b.depth % 2 ? ' tint' : ''}${b.list ? ' list' : ''}`, 'data-part': p.id, 'data-box': p.id }, h('div', { class: `frame-head s-${p.status}${b.head > HEAD ? ' tall' : ''}`, style: `height:${b.head}px`, 'data-part': p.id, 'data-drag': p.id, role: 'button', tabindex: '0', title: of ? `${of} › ${p.name}` : p.name, onkeydown: keySelect(p.id) }, toggleButton(p, true), 
            // A change line reads under the name (in the preview only), never beside it: the name keeps the whole head width.
            h('span', { class: 'frame-title' }, h('span', { class: 'frame-name' }, p.name), h('span', { class: 'plan-note' })), h('span', { class: 'frame-meta' }, latest ? h('span', { class: recentAt(latest) ? 'fresh' : '' }, ago(latest)) : null), enterButton(p), note ? h('span', { class: 'frame-note' }, note) : null)));
        }
        else {
            // A folded part reads its inside: latest record anywhere under it.
            const last = b.kids ? subtreeRecords(view, p.id)[0]?.at ?? null : p.lastAt, meta = metaLine(p, last), face = b.face ?? 'row';
            // A folded group reads by its name and its count (the way in); its note reads in the pane. A part without an inside keeps
            // its own first sentence.
            const note = face === 'unit' && !b.kids ? mapLead(view, p.id) : '', box = lay.boxes.get(b.container), onTint = box?.kind === 'frame' && box.depth % 2 === 1, alias = aliasOf(view, p.id);
            world.append(h('div', { class: `node ${face}${onTint ? ' on-tint' : ''} s-${p.status}${recentAt(last) ? ' fresh' : ''}${b.kids ? ' has-kids' : ''}${meta || of ? '' : ' bare'}`, 'data-part': p.id, 'data-box': p.id, 'data-drag': p.id, role: 'button', tabindex: '0',
                title: `${of ? `${of} › ` : ''}${p.name}${alias ? ` · ${alias}` : ''}`, onkeydown: keySelect(p.id) }, b.kids ? toggleButton(p, false) : null, h('span', { class: 'node-text' }, h('span', { class: 'node-name' }, p.name), note ? h('span', { class: 'node-note' }, note) : null, meta ? h('span', { class: 'node-meta' }, h('i', { class: 'dot', 'aria-hidden': 'true' }), meta) : alias ? h('span', { class: 'node-meta owner alias' }, alias) : of ? h('span', { class: 'node-meta owner' }, `${of} 안`) : null, h('span', { class: 'plan-note' })), b.kids ? enterButton(p) : null));
        }
    }
    // The title of this map: what the scope is for, in its own first sentence. The rest of that text (where it comes from, what
    // was checked) reads in full in the pane on request; nothing of it is cut or reworded. Inside a part, the scope's own
    // relations to the outside read under the title as the scope's, never drawn as lines from one of its children.
    const sp = partOf(o, scope), purpose = (sp ? sp.note : o.project.space.brief?.text ?? '').trim(), first = lead(purpose);
    const outside = scopeEnds(o), more = purpose.replace(/\s+/g, ' ').length > first.length + 1;
    const title = h('header', { class: 'map-title' }, h('h1', { class: 'map-name' }, sp ? sp.name : o.project.name), first ? h('p', { class: 'map-purpose' }, h('span', {}, first), more ? h('button', { type: 'button', class: 'map-more', title: '설명 전체와 출처', onclick: () => openScopeReading() }, '자세히') : null) : null, outside.length ? h('div', { class: 'scope-rels', role: 'list', 'aria-label': '이 범위의 바깥 관계' }, ...relationGroups(outside, '범위').map(g => h('p', { class: 'scope-rel', role: 'listitem' }, h('span', { class: 'sr-verb' }, g.label), ...g.list.map(x => h('button', { type: 'button', class: 'sr-part', title: `${partPath(o.view, x.far).map(q => q.name).join(' › ')}${x.r.note ? `\n${x.r.note}` : ''}`, 'data-far': x.far, onclick: (e) => { follow(x.far, x.r, e); go(o.key, x.far, null); } }, partOf(o, x.far)?.name ?? '부분'))))) : null);
    world.append(title);
    title.style.width = `${titleRect().w}px`;
    titleH = view.parts.length ? title.offsetHeight : 0;
    title.hidden = !titleH;
    $('scope-sticky').replaceChildren(h('strong', {}, sp ? sp.name : o.project.name), first ? h('span', {}, first) : '');
    lay.bounds = { ...core };
    withTitle();
    // Selected lines move to a layer above the group surfaces (below the parts), so a line that crosses a group is not read as
    // ending at it.
    const top = svg('svg', { class: 'edges edges-top', width: '1', height: '1', 'aria-hidden': 'true' });
    world.insertBefore(top, world.querySelector('.node, .ghost'));
    world.querySelectorAll('.edge.inner').forEach(g => top.append(g));
    positionWorld();
    $('space').classList.toggle('in-scope', !!scope);
    // Many lines on one view: those that go round other parts share the same gaps and would read as extra outlines of the
    // groups they pass; they step back until selected, hovered or read as a change's context (kind, direction and hover meaning
    // unchanged).
    $('space').classList.toggle('dense-lines', lay.edges.length >= 12);
    const empty = $('space-empty');
    empty.hidden = view.parts.length > 0 || o.kind === 'saved';
    empty.textContent = view.records.length ? `아직 부분으로 나뉘지 않은 프로젝트예요. 기록 ${view.records.length}개는 ‘최근 기록’에서 볼 수 있어요.` : '아직 부분도 기록도 없는 프로젝트예요.';
    $('add-part').hidden = o.kind !== 'saved';
    $('arrange').hidden = !view.parts.length;
    partForm = !view.parts.length && o.kind === 'saved' ? { parentId: null } : partForm && view.parts.length ? partForm : null;
    renderPartForm();
    renderRecent();
    const saved = cameraMode === 'restore' ? cameras.get(camKey(o, scope)) : undefined;
    if (cameraMode === 'keep')
        applyCamera();
    else if (saved) {
        camera = { ...saved };
        applyCamera();
    }
    else
        fitView(false);
    if (planOverlay)
        planView.overlay();
    applyReadMarks();
}
/** Geometry only (also during a drag): boxes and edge paths from the current layout. */
function positionWorld() {
    const world = $('world');
    // Heads of the outside partners' runs follow their layout (it can change while a part is dragged).
    const heads = new Map(lay.heads.map(x => [x.key, x]));
    world.querySelectorAll('.ghost-head').forEach(el => {
        const g = heads.get(el.dataset.head);
        el.hidden = !g;
        if (!g)
            return;
        el.style.left = `${g.x}px`;
        el.style.top = `${g.y}px`;
        el.style.width = `${g.w}px`;
    });
    for (const g of lay.heads)
        if (!world.querySelector(`.ghost-head[data-head="${CSS.escape(g.key)}"]`)) {
            const el = h('div', { class: 'ghost-head', 'data-head': g.key }, g.text);
            el.style.left = `${g.x}px`;
            el.style.top = `${g.y}px`;
            el.style.width = `${g.w}px`;
            world.append(el);
        }
    world.querySelectorAll('[data-box]').forEach(el => {
        const b = lay.boxes.get(el.dataset.box);
        if (!b)
            return;
        el.style.left = `${b.x}px`;
        el.style.top = `${b.y}px`;
        el.style.width = `${b.w}px`;
        el.style.height = `${b.h}px`;
    });
    const title = world.querySelector('.map-title');
    if (title) {
        const t = titleRect();
        title.style.left = `${t.x}px`;
        title.style.top = `${t.y}px`;
        title.style.width = `${t.w}px`;
    }
    world.querySelectorAll('.edge').forEach(g => {
        const a = lay.boxes.get(g.dataset.from), b = lay.boxes.get(g.dataset.to);
        if (!a || !b)
            return;
        const r = edgePath(a, b, lay.boxes.values());
        g.querySelectorAll('path').forEach(x => x.setAttribute('d', r.d));
        g.classList.toggle('detour', !!r.detour);
    });
    placeEdgeLabels();
}
/** Verbs on the map: on the lines of the selection, and on every line of a map that has only a few. Each sits at a free spot
 * along its own line; a verb that would cover a part, a group's head, the title or another verb is left off the map (the pane
 * lists every relation by its verb). Nothing is drawn for a relation the project does not hold. */
function placeEdgeLabels() {
    const world = $('world'), o = opened;
    if (!o)
        return;
    let box = world.querySelector('.edge-labels');
    if (!box) {
        box = h('div', { class: 'edge-labels', 'aria-hidden': 'true' });
        world.append(box);
    }
    box.replaceChildren();
    const few = !selected && !planView.isOpen() && lay.edges.length <= 6;
    // At rest, lines of one kind meeting the same part share one verb (the first of them carries it).
    const seenEnd = new Set();
    // The selection's lines of one kind and one direction that leave it on one side share one verb, set where they leave it;
    // every line stays its own (its tip and the pane keep each relation and its reason). The verb of such a fan carries no number:
    // a number on a verb reads as the relations one line holds, and the pane already counts the fan.
    const sel = selected ? lay.boxes.get(selected) : undefined;
    const side = (e) => { const far = lay.boxes.get(e.from === selected ? e.to : e.from); return !sel || !far ? '' : far.x + far.w / 2 < sel.x + sel.w / 2 ? 'l' : 'r'; };
    const selKey = (e) => `${e.kind}|${e.kind === 'related' ? '' : e.from === selected}|${side(e)}`;
    const fans = new Map(), seenSel = new Set();
    world.querySelectorAll('.edge.on').forEach(g => { const e = lay.edges.find(x => x.key === g.dataset.key); if (e)
        fans.set(selKey(e), (fans.get(selKey(e)) ?? 0) + 1); });
    const lines = [...world.querySelectorAll('.edge')].filter(g => {
        if (g.classList.contains('on'))
            return true;
        if (!few)
            return false;
        const e = lay.edges.find(x => x.key === g.dataset.key), k = e ? `${e.to}|${e.kind}` : '';
        if (!e || seenEnd.has(k))
            return false;
        seenEnd.add(k);
        return true;
    });
    if (!lines.length)
        return;
    const blocks = [...lay.boxes.values()].map(b => (b.kind === 'frame' ? { x: b.x, y: b.y, w: b.w, h: b.head } : b));
    if (titleH)
        blocks.push(titleRect());
    const clear = (r) => !blocks.some(b => r.x < b.x + b.w + 3 && b.x < r.x + r.w + 3 && r.y < b.y + b.h + 3 && b.y < r.y + r.h + 3);
    for (const g of lines) {
        const e = lay.edges.find(x => x.key === g.dataset.key), path = g.querySelector('.edge-line');
        if (!e || !path)
            continue;
        const on = g.classList.contains('on'), fan = on && (fans.get(selKey(e)) ?? 0) > 1;
        if (on && seenSel.has(selKey(e)))
            continue;
        const label = h('span', { class: `edge-label k-${e.kind}${on ? ' on' : ''}` }, `${REL_LABEL[e.kind] ?? e.kind}${!fan && e.ids.length > 1 ? ` ${e.ids.length}` : ''}`);
        box.append(label);
        const w = label.offsetWidth, hh = label.offsetHeight, len = path.getTotalLength();
        let spot = null;
        const near = e.to === selected ? [0.86, 0.8, 0.74, 0.68, 0.6, 0.5] : [0.14, 0.2, 0.26, 0.32, 0.4, 0.5];
        for (const t of fan ? near : [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78]) {
            const q = path.getPointAtLength(len * t), r = { x: q.x - w / 2, y: q.y - hh / 2, w, h: hh };
            if (clear(r)) {
                spot = r;
                break;
            }
        }
        if (!spot) {
            label.remove();
            continue;
        }
        label.style.left = `${spot.x}px`;
        label.style.top = `${spot.y}px`;
        blocks.push(spot);
        if (on)
            seenSel.add(selKey(e));
    }
}
function renderRecent() {
    const o = opened, sp = partOf(o, scope), all = sp ? subtreeRecords(o.view, sp.id) : o.view.records, LATEST = 7;
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
        return h('li', {}, h('button', { type: 'button', class: 'recent-item', disabled: !part, onclick: () => { if (part) {
                pendingRecord = r.id;
                go(o.key, part.id);
            } } }, h('span', { class: 'ri-top' }, h('strong', {}, part?.name ?? '부분 미지정'), h('span', { class: 'ri-kind' }, RECORD_LABEL[r.kind]), h('span', { class: 'ri-time' }, ago(r.at))), h('span', { class: 'ri-text' }, firstLine(r.text, 70))));
    }), ...(all.length > LATEST ? [h('li', { class: 'recent-more' }, h('button', { type: 'button', class: 'link-button', onclick: () => { recentAll = !recentAll; renderRecent(); } }, recentAll ? `최신 ${LATEST}개만 보기` : `전체 ${all.length}개 보기`))] : []));
}
/* ---------- camera ---------- */
const ZOOM_MIN = 0.4, ZOOM_MAX = 1.6;
/** The reading pane is a column of its own on the right: the map's viewport ends where the pane begins (syncMapArea), so nothing
 * the person reads is ever drawn under it and the geometry below needs no inset for it.
 * Width of the reading pane while anything reads there (a part, its sheet, a comparison or the whole plan); 0 otherwise. */
// The change plan's wide workspace covers the map without taking width from it: the map under it keeps its area and camera.
const paneWidth = () => (['lens', 'panel'].some(id => !$(id).hidden) || (!$('plan-panel').hidden && !$('plan-panel').classList.contains('work')) ? inspW() : 0);
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
    // Density follows the zoom: below 80% notes and state lines step back, below 60% names grow to stay readable. The selected
    // part, its partners and what is being dragged keep their full detail; nothing is removed from the page or its layout.
    const sp = $('space');
    sp.classList.toggle('z-mid', camera.k < 0.8);
    sp.classList.toggle('z-low', camera.k < 0.6);
    sp.style.setProperty('--grow', String(Math.min(1.6, Math.max(1, 0.85 / camera.k))));
    updateSticky();
}
/** Whole view in the free area. Opening never shrinks below 85%; only the explicit 전체 보기 button may go further. A map smaller
 * than the window sits near the top (a page is read from its top) and, while the pane is closed, leaves the pane's room free on
 * the right when there is enough of it, so opening a reading later rarely has to move the map. */
function fitView(explicit, animate = false) {
    const o = opened;
    if (!o)
        return;
    syncMapArea();
    const vp = $('viewport').getBoundingClientRect(), left = leftInset() + 8, right = 24, top = topInset() + 12, bottom = mapBottomInset() + 8;
    const w = Math.max(200, vp.width - left - right), hgt = Math.max(160, mapBottom() - top - bottom), B = lay.bounds;
    const fit = Math.min(1, w / Math.max(1, B.w + 40), hgt / Math.max(1, B.h + 40));
    const k = explicit ? Math.max(ZOOM_MIN, fit) : Math.max(0.85, fit);
    const mw = B.w * k, mh = B.h * k, free = w - mw, room = paneWidth() ? 0 : inspW();
    const xoff = free <= 0 ? 12 : free >= room + 96 ? Math.max(40, (free - room) / 2) : free / 2;
    const yoff = mh <= hgt ? Math.min((hgt - mh) / 2, 48) : 12;
    camera = { k, x: left + xoff - B.x * k, y: top + yoff - B.y * k };
    applyCamera(animate);
}
function zoomAt(k, cx, cy, animate = false) {
    const nk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));
    camera = { k: nk, x: cx - (cx - camera.x) * (nk / camera.k), y: cy - (cy - camera.y) * (nk / camera.k) };
    applyCamera(animate);
}
/** Smallest pan that brings a world rectangle into the free map area (left of the reading pane, above the tools); never a
 * zoom. Larger than the area: its top-left corner comes in. */
function revealRect(B, keepRight = 0, keepBottom = 0) {
    const vp = $('viewport').getBoundingClientRect(), left = leftInset() + 16, right = vp.width - 24 - keepRight, top = topInset() + 4, bottom = mapBottom() - mapBottomInset() - 12 - keepBottom;
    const sx = camera.x + B.x * camera.k, sy = camera.y + B.y * camera.k, sw = B.w * camera.k, sh = B.h * camera.k;
    let dx = 0, dy = 0;
    if (sx + sw > right)
        dx = right - (sx + sw);
    if (sx + dx < left)
        dx = left - sx;
    if (sy + sh > bottom)
        dy = bottom - (sy + sh);
    if (sy + dy < top)
        dy = top - sy;
    if (dx || dy) {
        camera = { ...camera, x: camera.x + dx, y: camera.y + dy };
        applyCamera(true);
    }
}
/** Keep the selected part visible beside the pane (a large frame: its head and first rows). When the part and the other ends
 * of its lines fit together at this zoom, they come into view together. */
function reveal(partId) {
    const b = lay.boxes.get(partId);
    if (!b)
        return;
    const ends = lay.edges.filter(e => e.from === partId || e.to === partId).map(e => lay.boxes.get(e.from === partId ? e.to : e.from)).filter((x) => !!x);
    const own = { x: b.x, y: b.y, w: Math.min(b.w, 420), h: Math.min(b.h, 300) };
    if (ends.length) {
        const all = [own, ...ends], x = Math.min(...all.map(r => r.x)), y = Math.min(...all.map(r => r.y));
        const B = { x, y, w: Math.max(...all.map(r => r.x + r.w)) - x, h: Math.max(...all.map(r => r.y + r.h)) - y };
        const area = mapArea();
        if (B.w * camera.k <= area.w - 24 && B.h * camera.k <= area.h - 24) {
            revealRect(B);
            return;
        }
    }
    revealRect(own);
}
/* ---------- selection & panel ---------- */
let pendingRecord = null;
/** One reading surface per selection, always in the pane: the lens (what the part is and how it is linked), or the reading sheet
 * (sources, records, questions, edits) in its place. Closing the sheet brings the same lens back with the same selection,
 * camera and drafts. */
let sheetOpen = false;
function select(partId) {
    const changed = selected !== partId;
    if (changed) {
        editing = false;
        composerOpen = false;
        if (ask && !ask.controller)
            ask = null;
        sheetOpen = !!pendingRecord;
    }
    if (!!selected !== !!partId)
        recentPeek = false;
    if (partId)
        scopeReading = false;
    selected = partId;
    if (opened)
        renderRecent();
    markSelection(partId);
    $('space').classList.toggle('dim', !!partId);
    const panel = $('panel');
    if (planView.isOpen()) {
        panel.hidden = true;
        panel.replaceChildren();
        clearHighlight();
        planView.selectionChanged(changed);
        return;
    }
    if (!partId) {
        panel.hidden = true;
        panel.replaceChildren();
        clearHighlight();
        if (returnView.isOpen()) {
            // Back from a part read beside the return reading: the same reading, and the camera it had unless the map was moved.
            if (readingCamera && !mapMoved) {
                camera = readingCamera;
                applyCamera(true);
            }
            readingCamera = null;
            returnView.render();
            return;
        }
        if (scopeReading)
            renderScopeLens();
        else
            hideLens();
        return;
    }
    if (returnView.isOpen()) {
        if (changed && !readingCamera) {
            readingCamera = { ...camera };
            mapMoved = false;
        }
        readMarks = [];
        applyReadMarks();
    }
    showReading(changed, changed);
    if (pendingRecord) {
        const id = pendingRecord;
        pendingRecord = null;
        openRecord(id);
    }
}
/** scrollTop: a new selection starts its sheet at the top. move: bring the part into view (a new selection or a new surface). */
function showReading(scrollTop, move) {
    const panel = $('panel');
    if (sheetOpen) {
        hideLens();
        panel.hidden = false;
        renderPanel(scrollTop);
        syncMapArea();
        if (move)
            reveal(selected);
        return;
    }
    panel.hidden = true;
    panel.replaceChildren();
    renderLens();
    syncMapArea();
    if (move)
        reveal(selected);
}
/** The camera before the sheet opened: closing the sheet comes back to it unless the person moved the map meanwhile. */
let sheetReturn = null, mapMoved = false;
function openSheet(then) { if (!selected)
    return; sheetReturn = { ...camera }; mapMoved = false; sheetOpen = true; showReading(true, true); then?.(); }
function closeSheet() {
    if (!selected || !sheetOpen)
        return;
    sheetOpen = false;
    editing = false;
    if (sheetReturn && !mapMoved) {
        camera = sheetReturn;
        applyCamera(true);
    }
    sheetReturn = null;
    showReading(false, false);
    requestAnimationFrame(() => $('lens').querySelector('.lens-more')?.focus());
}
/** Re-render whichever surface is open (after an answer, a status change or an edit). */
function refreshReading() { if (!opened || !selected || planView.isOpen())
    return; if (sheetOpen)
    renderPanel(false);
else
    renderLens(); }
/* ---------- the reading pane and the map area ----------
 * Selection, comparison, explanation and sources read in one place: the pane on the right, as wide as a column of text and no
 * wider. The map keeps the rest of the window. Opening the pane never re-fits or zooms the map; the part being read is brought
 * beside it by the smallest pan, and only when it would be hidden. */
/** Parts the open surface is about when it is not the selection (the parts of a change the comparison reads). */
let readingFor = [];
const toScreen = (b) => ({ x: camera.x + b.x * camera.k, y: camera.y + b.y * camera.k, w: b.w * camera.k, h: b.h * camera.k });
const union = (rs) => { const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y }; };
/** The change plan's strip takes the top of the map while it is open. */
const stripInset = () => { const strip = $('plan-strip'); return strip.hidden ? 16 : strip.offsetTop + strip.offsetHeight + 10; };
const topInset = () => stripInset() + (!$('plan-strip').hidden && !$('scope-sticky').hidden ? $('scope-sticky').offsetHeight + 8 : 0);
function mapArea() { const vp = $('viewport').getBoundingClientRect(), top = topInset(); return { x: 16, y: top, w: vp.width - 32, h: mapBottom() - top - mapBottomInset() }; }
function hideLens() { const l = $('lens'); l.hidden = true; l.replaceChildren(); l.classList.remove('compare', 'scope-read'); readingFor = []; syncMapArea(); }
const mapBottomInset = () => BOTTOM;
const mapBottom = () => $('viewport').offsetTop + $('viewport').clientHeight;
/** The map's viewport: below the plan's strip when it is open, left of the pane when it is open. Camera coordinates stay
 * relative to the space, so neither moves anything already drawn. */
function syncMapArea() {
    const vp = $('viewport'), world = $('world'), pane = paneWidth();
    $('space').style.setProperty('--plan-w', `${pane}px`);
    vp.style.right = pane + 'px';
    const top = $('plan-strip').hidden ? 0 : topInset();
    vp.style.top = top + 'px';
    vp.style.bottom = '0px';
    world.style.top = -top + 'px';
    vp.style.backgroundPosition = camera.x + 'px ' + (camera.y - top) + 'px';
    updateSticky();
}
/** A new target to read (or an explicit resize): the target, its line ends and the title together when they fit beside the
 * pane; a large frame still reveals its own heading and first rows. Never a zoom. */
function revealParts(ids) {
    const boxes = ids.map(id => lay.boxes.get(id)).filter((b) => !!b && b.kind !== 'ghost');
    if (!boxes.length)
        return;
    const own = union(boxes.map(b => ({ x: b.x, y: b.y, w: Math.min(b.w, 420), h: Math.min(b.h, 220) }))), area = mapArea(), set = new Set(boxes.map(b => b.id));
    const ends = lay.edges.filter(e => set.has(e.from) !== set.has(e.to)).map(e => lay.boxes.get(set.has(e.from) ? e.to : e.from)).filter((q) => !!q);
    const candidates = [[own, ...ends, ...(titleH ? [titleRect()] : [])], [own, ...ends], [own, ...(titleH ? [titleRect()] : [])], [own]];
    const fit = candidates.map(rs => union(rs)).find(r => r.w * camera.k <= area.w - 32 && r.h * camera.k <= area.h - 24) ?? own;
    revealRect(fit);
}
/** The scope's title belongs to the map; when a pan takes it out of view its name stays at the top left of the map. */
function updateSticky() {
    const st = $('scope-sticky'), o = opened;
    if (!o || !titleH) {
        st.hidden = true;
        return;
    }
    const vp = $('viewport').getBoundingClientRect(), t = toScreen(titleRect()), top = stripInset();
    st.style.top = `${top - 6}px`;
    st.hidden = t.y >= top - 8 && t.y + 24 * camera.k <= mapBottom() - mapBottomInset() && t.x + 120 >= 0 && t.x <= vp.width - 120;
    // One title at a time: the map's own title steps back while its name is pinned.
    document.querySelector('.map-title')?.classList.toggle('pinned', !st.hidden);
}
/** The state of a part as the source of what is said about it: a received summary, a written plan, or nothing yet. */
function stateText(part, records) {
    return part.status === 'plan' ? (records.length ? '요청 기록 없음' : part.note ? '계획 설명만 있음 · 기록 없음' : '기록 없음') : STATUS_LABEL[part.status];
}
/** The visible representative of a part in this view (itself or its nearest drawn ancestor), null outside the scope. */
function drawnRep(o, id) {
    for (let c = partOf(o, id), g = 0; c && g < 64; c = partOf(o, c.parentId), g++) {
        const b = lay.boxes.get(c.id);
        if (b && b.kind !== 'ghost')
            return c.id;
    }
    return null;
}
function relationEnds(o, partId) {
    const drawn = lay.boxes.has(partId), out = [];
    for (const r of o.view.relations) {
        const a = drawn ? drawnRep(o, r.from) : r.from, c = drawn ? drawnRep(o, r.to) : r.to;
        if (a === partId && c !== partId)
            out.push({ r, near: r.from, far: r.to, out: true });
        else if (c === partId && a !== partId)
            out.push({ r, near: r.to, far: r.from, out: false });
    }
    return out;
}
/** The scope's own relations to parts outside it (its inside's relations are drawn on the map, or as side entries). */
function scopeEnds(o) {
    if (!scope)
        return [];
    const inside = (id) => { for (let p = partOf(o, id), g = 0; p && g < 64; p = partOf(o, p.parentId), g++)
        if (p.id === scope)
            return true; return false; };
    return o.view.relations.flatMap((r) => r.from === scope && !inside(r.to) ? [{ r, near: r.from, far: r.to, out: true }] : r.to === scope && !inside(r.from) ? [{ r, near: r.to, far: r.from, out: false }] : []);
}
/** Reading the scope itself in the pane (the map's 자세히): its whole description as written, where it sits, its relations
 * to the outside and its parts with their sizes. Selecting a part replaces it. */
let scopeReading = false;
function openScopeReading() { const o = opened; if (!o)
    return; if (selected) {
    scopeReading = true;
    go(o.key);
    return;
} scopeReading = true; renderScopeLens(); }
function renderScopeLens() {
    const o = opened;
    if (!o)
        return;
    const l = $('lens'), sp = partOf(o, scope), text = (sp ? sp.note : o.project.space.brief?.text ?? '').trim();
    const kids = (sp ? sp.childIds : o.view.roots).map(id => partOf(o, id)).filter(Boolean);
    const outside = relationGroups(scopeEnds(o), '범위');
    const path = sp ? partPath(o.view, sp.id).slice(0, -1) : [];
    l.classList.remove('compare');
    l.classList.add('scope-read');
    readingFor = [];
    l.replaceChildren(h('header', { class: 'lens-head' }, h('div', { class: 'lens-path' }, h('span', {}, sp ? '이 범위' : '프로젝트'), ...path.flatMap(x => [h('span', { 'aria-hidden': 'true' }, '›'), h('a', { href: hashFor(o.key, null, x.id) }, x.name)])), h('h2', { id: 'lens-title' }, sp ? sp.name : o.project.name), h('div', { class: 'head-tools' }, h('button', { type: 'button', class: 'close', 'aria-label': '범위 설명 닫기', title: '닫기 (Esc)', onclick: closeScopeReading }, '×'))), h('div', { class: 'lens-body' }, h('div', { class: 'lens-desc' }, text ? h('p', { class: 'lens-text' }, text) : null, h('p', { class: 'lens-src' }, h('span', {}, sp ? '적어 둔 설명 · 원문 그대로' : '프로젝트 설명 · 원문 그대로'))), ...outside.map(g => h('section', { class: 'lens-ports' }, h('h3', {}, g.label, h('small', {}, String(g.list.length))), h('ul', {}, ...g.list.map(x => h('li', {}, h('button', { type: 'button', class: 'port', 'data-far': x.far, onclick: (e) => { follow(x.far, x.r, e); go(o.key, x.far, null); } }, h('span', { class: 'port-top' }, h('span', { class: 'port-dir', 'aria-hidden': 'true' }, dirMark(x.r.kind, x.out)), h('strong', {}, partOf(o, x.far)?.name ?? '부분')), x.r.note ? h('span', { class: 'port-note' }, x.r.note) : null)))))), kids.length ? h('section', { class: 'lens-ports' }, h('h3', {}, sp ? '안의 부분' : '최상위 구성', h('small', {}, String(kids.length))), h('ul', {}, ...kids.map(k => h('li', {}, h('button', { type: 'button', class: 'port', onclick: () => go(o.key, k.id) }, h('span', { class: 'port-top' }, h('strong', {}, k.name), k.childIds.length ? h('span', { class: 'port-count' }, `안쪽 ${k.childIds.length}`) : null), mapLead(o.view, k.id) ? h('span', { class: 'port-note' }, mapLead(o.view, k.id)) : null))))) : null));
    l.hidden = false;
    syncMapArea();
}
function closeScopeReading() { scopeReading = false; if ($('lens').classList.contains('scope-read'))
    hideLens(); }
/** The lens: what the selection is (its whole description as written, with where that description comes from; the map shows
 * only its first sentence), what it is linked to, by verb (each line's real ends), its inside, and the way to sources and
 * edits. */
function renderLens() {
    const o = opened, part = partOf(o, selected), l = $('lens'), b = lay.boxes.get(part.id);
    const records = subtreeRecords(o.view, part.id), path = partPath(o.view, part.id).slice(0, -1);
    const rest = part.note.replace(/\s+/g, ' ').trim();
    const dot = h('i', { class: `dot s-${part.status}`, 'aria-hidden': 'true' });
    const src = (text) => h('p', { class: `lens-src s-${part.status}` }, dot, h('span', {}, text));
    const recs = records.length ? `기록 ${records.length} · ${ago(records[0].at)}` : '기록 없음';
    const desc = h('div', { class: 'lens-desc' });
    if (part.summary) {
        const report = records.find(r => r.kind === 'report');
        put(desc, h('p', { class: 'lens-text' }, part.summary), src(`${STATUS_LABEL[part.status]} · ${part.origin ?? '전달받은 정리'}${report ? ` · ${ago(report.at)}` : ''}`), part.proposal ? h('p', { class: 'lens-proposal' }, h('strong', {}, '제안 · 아직 반영 안 됨 '), part.proposal) : null, rest ? h('p', { class: 'lens-plan' }, h('span', {}, '계획'), rest) : null);
    }
    else if (rest) {
        // The description is the person's written plan, not a received summary. A state line only when there is something to say
        // (records, a reported state); "no records yet" and where the text comes from read in the sheet (자세히).
        const state = part.status === 'plan' ? (records.length ? `받은 정리 없음 · 요청 기록 없음 · ${recs}` : '') : `${STATUS_LABEL[part.status]} · ${recs}`;
        put(desc, rest ? h('p', { class: 'lens-text' }, rest) : null, state ? src(`적어 둔 계획 설명 · ${state}`) : null);
    }
    else
        put(desc, src(part.status === 'plan' ? (records.length ? `설명 없음 · 요청 기록 없음 · ${recs}` : '아직 설명도 기록도 없어요') : `${STATUS_LABEL[part.status]} · ${recs} · 받은 정리 없음`));
    if (part.changes.length)
        desc.append(h('ul', { class: 'lens-changes' }, ...part.changes.slice(0, 2).map(c => h('li', {}, c))));
    // Lines: real ends, read by what they mean. One group per verb and direction ("이 부분이 필요로 함"), each row the real other
    // end; a line drawn from a folded part summarises its inside, so its row also names the inner end.
    const ends = relationEnds(o, part.id), entry = visitEntry(o), cameFrom = entry ? visits.at(-1).from.selected : null;
    const port = (x) => {
        const far = partOf(o, x.far), near = x.near !== part.id ? partOf(o, x.near)?.name : null, farRep = drawnRep(o, x.far);
        const where = farRep === x.far ? null : farRep ? `${partOf(o, farRep).name} 안` : partPath(o.view, x.far).slice(0, -1).map(q => q.name).join(' › ') || o.project.name;
        const came = x.far === cameFrom;
        return h('li', {}, h('button', { type: 'button', class: `port${came ? ' came' : ''}`, 'data-far': x.far, title: `${far.name}${toParticle(far.name)} 가기${came ? ' · 이 관계를 따라 여기로 왔어요' : ''}`, onclick: (e) => { follow(x.far, x.r, e); go(o.key, x.far); } }, h('span', { class: 'port-top' }, h('span', { class: 'port-dir', 'aria-hidden': 'true' }, dirMark(x.r.kind, x.out)), h('strong', {}, far.name), came ? h('span', { class: 'port-came' }, '출발') : null), near || where ? h('span', { class: 'port-where' }, [near ? `안쪽 ‘${near}’에서` : '', where ? `${where}` : ''].filter(Boolean).join(' · ')) : null, x.r.note ? h('span', { class: 'port-note' }, x.r.note) : null));
    };
    const ports = relationGroups(ends).map(g => h('section', { class: 'lens-ports' }, h('h3', {}, g.label, h('small', {}, String(g.list.length))), h('ul', {}, ...g.list.slice(0, 8).map(port)), g.list.length > 8 ? h('button', { type: 'button', class: 'link-button', onclick: () => openSheet() }, `${g.list.length - 8}개 더 · 자세히`) : null));
    // Inside: on the map already when the part is an open frame; else its names, and the explicit way in.
    const kids = part.childIds.map(id => partOf(o, id).name);
    const inside = kids.length && part.id !== scope ? h('div', { class: 'lens-inside' }, b?.kind === 'frame' ? null : h('p', {}, h('span', {}, `안쪽 ${kids.length}`), kids.join(' · ')), h('button', { type: 'button', class: 'go-in', onclick: () => go(o.key, null, part.id) }, `안으로 들어가기 · ${kids.length}`, h('span', { 'aria-hidden': 'true' }, ' ›'))) : null;
    const thread = answersOf(o, part.id).length;
    const menuItems = [
        o.kind !== 'legacy' ? h('button', { type: 'button', role: 'menuitem', onclick: () => { editing = true; openSheet(() => document.getElementById('edit-name')?.focus()); } }, '이름·설명 고치기') : null,
        o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', onclick: () => openPartForm(part.id) }, '안에 부분 추가') : null
    ].filter((x) => !!x);
    l.classList.remove('compare', 'scope-read');
    readingFor = [];
    l.replaceChildren();
    put(l, h('header', { class: 'lens-head' }, entry, path.length ? h('div', { class: 'lens-path' }, ...path.flatMap((x, i) => [i ? h('span', { 'aria-hidden': 'true' }, '›') : null, h('a', { href: hashFor(o.key, x.id, scope) }, x.name)])) : null, h('h2', { id: 'lens-title' }, part.name), aliasOf(o.view, part.id) ? h('p', { class: 'lens-alias' }, aliasOf(o.view, part.id)) : null, h('div', { class: 'head-tools' }, menuItems.length ? h('details', { class: 'more' }, h('summary', { 'aria-label': '이 부분 고치기', title: '고치기' }, '⋯'), h('div', { class: 'more-menu', role: 'menu', onclick: (e) => { e.currentTarget.parentElement.open = false; } }, ...menuItems)) : null, h('button', { type: 'button', class: 'close', 'aria-label': '선택 해제', title: '닫기 (Esc)', onclick: () => go(o.key) }, '×'))), h('div', { class: 'lens-body' }, desc, ...ports, inside), h('footer', { class: 'lens-foot' }, h('button', { type: 'button', class: 'lens-more', onclick: () => openSheet() }, records.length ? `근거·기록 ${records.length}` : '자세히', thread ? ` · 정리 ${thread}` : '', h('span', { 'aria-hidden': 'true' }, ' ›')), status.ai === 'deepseek' ? h('button', { type: 'button', class: 'link-button', onclick: () => { composerOpen = true; openSheet(() => document.getElementById(status.access === 'code' && !sessionCode() ? 'access-code' : 'ask-input')?.focus()); } }, '질문하기') : null));
    l.hidden = false;
}
/** Selection on the map: the part, its lines and the parts at their other ends (drawn representative or side ghost). */
function markSelection(partId) {
    const related = new Set(), base = document.querySelector('#world .edges:not(.edges-top)'), top = document.querySelector('#world .edges-top');
    document.querySelectorAll('.edge').forEach(el => {
        const on = !!partId && (el.dataset.from === partId || el.dataset.to === partId);
        // A line the change plan reads as context of its change (.ctx) stays above the groups as well.
        const layer = on || el.classList.contains('ctx') || el.classList.contains('inner') ? top : base;
        if (layer && el.parentNode !== layer)
            layer.append(el);
        el.classList.toggle('on', on);
        const line = el.querySelector('.edge-line'), plain = el.classList.contains('k-related');
        line.setAttribute('marker-end', plain ? (on ? 'url(#dot-on)' : 'url(#dot)') : on ? 'url(#arrow-on)' : 'url(#arrow)');
        line.setAttribute('marker-start', on ? 'url(#dot-on)' : 'url(#dot)');
        if (on)
            related.add(el.dataset.from === partId ? el.dataset.to : el.dataset.from);
    });
    placeEdgeLabels();
    document.querySelectorAll('.node[data-part],.frame,.ghost').forEach(el => {
        el.classList.toggle('selected', !!partId && el.dataset.part === partId);
        el.classList.toggle('related', related.has(el.dataset.box));
    });
}
function clearHighlight() { document.querySelectorAll('.node.cited,.frame.cited').forEach(el => el.classList.remove('cited')); }
function highlightParts(ids) {
    clearHighlight();
    document.querySelectorAll('.node[data-part],.frame[data-part]').forEach(el => { if (ids.has(el.dataset.part))
        el.classList.add('cited'); });
}
function recordItem(o, r, showPart) {
    const part = showPart && r.partId ? o.view.parts.find(x => x.id === r.partId)?.name : null;
    return h('li', { class: 'record', id: `rec-${r.id}` }, h('details', {}, h('summary', {}, h('span', { class: 'rec-top' }, h('span', { class: 'rec-kind' }, RECORD_LABEL[r.kind]), part ? h('span', { class: 'rec-part' }, part) : null, h('span', { class: 'rec-time', title: fullTime(r.at) }, ago(r.at))), h('span', { class: 'rec-line' }, firstLine(r.text, 120))), h('div', { class: 'rec-body' }, h('pre', {}, r.text), h('p', { class: 'rec-src' }, `${r.origin ?? (r.kind === 'request' ? '사용자가 개발 도구에 남긴 요청' : '전달받은 기록')} · ${fullTime(r.at)} · 받은 원문 그대로`))));
}
function openRecord(id) {
    const li = document.getElementById(`rec-${id}`);
    if (!li) {
        const more = document.querySelector('.records-more');
        if (more) {
            more.click();
            requestAnimationFrame(() => openRecord(id));
        }
        return;
    }
    const d = li.querySelector('details');
    if (d)
        d.open = true;
    li.scrollIntoView({ block: 'center', behavior: 'smooth' });
    li.classList.remove('flash');
    void li.offsetWidth;
    li.classList.add('flash');
}
/** The part inspector reads in one order: name → current description → related parts → what to do → sources. Edits sit in a
 * quiet menu; long sources open one at a time. */
function renderPanel(scrollTop) {
    const o = opened, part = o.view.parts.find(p => p.id === selected), panel = $('panel');
    const prevBody = panel.querySelector('.panel-body'), keep = scrollTop ? 0 : prevBody?.scrollTop ?? 0;
    const path = partPath(o.view, part.id).slice(0, -1), records = subtreeRecords(o.view, part.id);
    const state = part.status === 'plan' ? (records.length ? '요청 기록 없음' : part.note ? '계획 설명만 있음 · 기록 없음' : '기록 없음') : STATUS_LABEL[part.status];
    const menuItems = [
        o.kind !== 'legacy' ? h('button', { type: 'button', role: 'menuitem', onclick: () => { editing = !editing; renderPanel(false); } }, editing ? '고치기 닫기' : '이름·설명 고치기') : null,
        o.kind === 'saved' ? h('button', { type: 'button', role: 'menuitem', onclick: () => openPartForm(part.id) }, '안에 부분 추가') : null
    ].filter((x) => !!x);
    const head = h('header', { class: 'panel-head' }, visitEntry(o), h('div', { class: 'panel-path' }, ...path.flatMap((x, i) => [i ? h('span', { 'aria-hidden': 'true' }, '›') : null, h('a', { href: hashFor(o.key, x.id, scope) }, x.name)]), path.length ? null : h('span', {}, o.project.name)), h('h2', { id: 'panel-title', tabindex: '-1' }, part.name), h('div', { class: 'panel-chips' }, h('span', { class: `state s-${part.status}` }, h('i', { class: 'dot', 'aria-hidden': 'true' }), state), records.length ? h('span', { class: 'chip plain' }, `기록 ${records.length}${records[0] ? ` · ${ago(records[0].at)}` : ''}`) : null), h('div', { class: 'head-tools' }, menuItems.length ? h('details', { class: 'more' }, h('summary', { 'aria-label': '이 부분 고치기', title: '고치기' }, '⋯'), h('div', { class: 'more-menu', role: 'menu', onclick: (e) => { e.currentTarget.parentElement.open = false; } }, ...menuItems)) : null, h('button', { type: 'button', class: 'close', 'aria-label': '요약으로 돌아가기', title: '요약으로 (Esc)', onclick: closeSheet }, '×')));
    const body = h('div', { class: 'panel-body' });
    if (editing)
        body.append(editForm(o, part));
    // 현재 설명
    const now = h('section', { class: 'sec sec-now' });
    if (part.summary) {
        const report = records.find(r => r.kind === 'report');
        now.append(h('p', { class: 'summary' }, part.summary), h('p', { class: 'src' }, `${part.origin ?? '전달받은 정리'}${report ? ` · ${ago(report.at)}` : ''}`));
        if (part.proposal)
            now.append(h('div', { class: 'proposal' }, h('strong', {}, '제안 · 아직 반영 안 됨'), h('span', {}, part.proposal)));
        if (part.note)
            now.append(h('p', { class: 'note' }, h('span', {}, '계획'), part.note));
    }
    else if (part.note) {
        // The written plan reads as the description; the head's state line already says whether records exist.
        put(now, h('p', { class: 'lead' }, part.note), h('p', { class: 'src' }, '적어 둔 계획 설명 · 받은 정리 아님'), records.length ? h('p', { class: 'summary muted' }, part.childIds.length ? '이 부분 자체에 대한 정리는 아직 없어요. 안의 부분과 기록을 보세요.' : '요청 기록은 있고, 아직 받은 작업 보고는 없어요.') : null);
    }
    else {
        put(now, h('p', { class: 'summary muted' }, records.length ? (part.childIds.length ? '이 부분 자체에 대한 정리는 아직 없어요. 안의 부분과 기록을 보세요.' : '요청 기록은 있고, 아직 받은 작업 보고는 없어요.') : '아직 설명도 연결된 기록도 없어요.'));
    }
    body.append(now);
    if (part.changes.length)
        body.append(h('section', { class: 'sec' }, h('h3', {}, '최근 변화'), h('ul', { class: 'changes' }, ...part.changes.map(c => h('li', {}, c)))));
    // 관련 부분: its inside, then the recorded links with their meaning.
    const links = relationEnds(o, part.id);
    if (part.childIds.length || links.length) {
        const rel = h('section', { class: 'sec sec-related' }, h('h3', {}, '관련 부분'));
        if (part.childIds.length)
            rel.append(h('p', { class: 'sub' }, `안쪽 ${part.childIds.length}`), h('div', { class: 'kids' }, ...part.childIds.map(id => {
                const c = o.view.parts.find(x => x.id === id), m = metaLine(c, c.childIds.length ? subtreeRecords(o.view, c.id)[0]?.at ?? null : c.lastAt);
                return h('a', { class: `kid s-${c.status}`, href: hashFor(o.key, id, scope) }, h('span', {}, c.name), c.childIds.length ? h('small', {}, `안쪽 ${c.childIds.length}`) : null, m ? h('small', {}, m) : null);
            })));
        if (links.length)
            rel.append(h('p', { class: 'sub' }, `연결 ${links.length}`), h('ul', { class: 'links' }, ...links.map(({ r, out, near, far }) => {
                const other = o.view.parts.find(x => x.id === far), inner = near !== part.id ? partOf(o, near)?.name : null;
                const where = [inner ? `안쪽 ‘${inner}’에서` : '', insideScope(o, other.id) ? '' : `${partPath(o.view, other.id).slice(0, -1).map(x => x.name).join(' › ') || o.project.name} 안`].filter(Boolean).join(' · ');
                return h('li', {}, h('a', { href: hashFor(o.key, other.id, scope), 'data-far': other.id, onclick: (e) => follow(other.id, r, e) }, h('span', { class: 'dir', title: dirTitle(r.kind, out) }, dirMark(r.kind, out)), h('strong', {}, other.name), h('span', { class: 'rel-kind' }, REL_LABEL[r.kind] ?? r.kind)), where ? h('span', { class: 'link-where' }, where) : null, r.note ? h('span', { class: 'link-note' }, r.note) : null);
            })));
        body.append(rel);
    }
    // What to do next with this part: going inside is explicit, never a side effect of selecting.
    if (part.childIds.length && part.id !== scope)
        body.append(h('div', { class: 'sec-acts' }, h('button', { type: 'button', class: 'secondary go-in', onclick: () => go(o.key, null, part.id) }, `안으로 들어가기 · ${part.childIds.length}`, h('span', { 'aria-hidden': 'true' }, ' ›'))));
    if (records.length) {
        const showAll = records.length <= 5, list = h('ol', { class: 'records' }, ...records.slice(0, showAll ? records.length : 4).map(r => recordItem(o, r, r.partId !== part.id)));
        const sec = h('section', { class: 'sec' }, h('h3', {}, '근거 원문 ', h('small', {}, `개발 도구에서 받은 기록 ${records.length}`)), list);
        if (!showAll)
            sec.append(h('button', { type: 'button', class: 'records-more link-button', onclick: (e) => { list.replaceChildren(...records.map(r => recordItem(o, r, r.partId !== part.id))); e.target.remove(); } }, `기록 ${records.length - 4}개 더 보기`));
        body.append(sec);
    }
    const thread = answersOf(o, part.id);
    if (thread.length || (ask && ask.partId === part.id)) {
        const sec = h('section', { class: 'sec thread', 'aria-live': 'polite' }, h('h3', {}, '정리 결과'));
        for (const a of thread)
            sec.append(answerCard(o, a));
        if (ask && ask.partId === part.id)
            sec.append(ask.controller
                ? h('div', { class: 'pending' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, `${status.model ?? 'DeepSeek'}가 기록을 읽고 정리하고 있어요…`, coverageText(ask.coverage) ? h('small', { class: 'scope-note' }, coverageText(ask.coverage)) : null), h('button', { type: 'button', class: 'link-button', onclick: () => ask?.controller?.abort() }, '취소'))
                : h('div', { class: 'failed', role: 'alert' }, h('span', {}, ask.error ?? '응답을 받지 못했어요.'), h('button', { type: 'button', class: 'secondary small', onclick: () => send(ask.intent, ask.question) }, '다시 시도'), h('button', { type: 'button', class: 'link-button', onclick: () => { ask = null; renderPanel(false); } }, '닫기')));
        body.append(sec);
    }
    panel.replaceChildren(head, body, composer(o, part));
    if (scrollTop)
        body.scrollTop = 0;
    else
        body.scrollTop = keep;
}
/** The one write path for structure edits: saved projects through the workspace store, examples in memory only. */
async function commit(o, next) {
    if (o.kind === 'saved' && o.ref) {
        try {
            o.ref = await store.save(o.ref, next);
        }
        catch (err) {
            return storageErrorCode(err) === 'STORAGE_CONFLICT' ? '다른 탭에서 이 프로젝트가 바뀌어 저장하지 않았어요. 새로고침한 뒤 다시 해 주세요.' : '저장하지 못했어요. 바뀐 내용은 적용하지 않았어요.';
        }
    }
    else if (o.kind === 'example')
        examples.set(o.key, next);
    else
        return '이 프로젝트는 읽기 전용이에요.';
    o.project = next;
    o.view = studioView(next);
    return null;
}
/* Adding a part: the first part of a new project, another top part, or a part inside the selected one. */
let partForm = null;
function openPartForm(parentId) { partForm = { parentId }; renderPartForm(); }
function renderPartForm() {
    const box = $('part-form'), o = opened;
    if (!o || !partForm) {
        box.hidden = true;
        box.replaceChildren();
        return;
    }
    const parent = partForm.parentId ? o.view.parts.find(x => x.id === partForm.parentId) ?? null : null, first = !o.view.parts.length;
    const name = h('input', { id: 'part-name', maxlength: '60', placeholder: first ? '예: 예약하기' : '부분 이름', autocomplete: 'off' });
    const note = h('input', { id: 'part-note', maxlength: '2000', placeholder: '한 줄 설명 (선택)', autocomplete: 'off' });
    const msg = h('p', { class: 'form-msg', role: 'status' });
    const close = () => { partForm = null; renderPartForm(); };
    box.replaceChildren(h('form', { class: 'part-form-inner', onsubmit: async (e) => {
            e.preventDefault();
            let next;
            try {
                next = parent ? addChildArea(o.project, parent.id, name.value, note.value) : addArea(o.project, name.value, note.value);
            }
            catch {
                msg.textContent = '이름은 1~60자로 적어 주세요.';
                return;
            }
            const id = next.space.areas.at(-1).id, failed = await commit(o, next);
            if (failed) {
                msg.textContent = failed;
                return;
            }
            expandPath(o, id, expandState); // made here on purpose: keep its parent open
            partForm = null;
            renderPartForm();
            renderSpace('keep');
            go(o.key, id);
        } }, h('h3', {}, parent ? `‘${parent.name}’ 안에 부분 추가` : first ? '첫 부분 만들기' : '부분 추가'), first ? h('p', { class: 'hint' }, '프로젝트를 이루는 큰 부분 하나를 적어 주세요. 개발 기록은 이 부분들에 연결돼요.') : null, name, note, msg, h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary small' }, '만들기'), first ? null : h('button', { type: 'button', class: 'link-button', onclick: close }, '취소'))));
    box.hidden = false;
    name.focus();
}
function editForm(o, part) {
    const name = h('input', { id: 'edit-name', maxlength: '60', value: part.name });
    const note = h('textarea', { id: 'edit-note', rows: '3', maxlength: '2000' });
    note.value = part.note;
    const msg = h('p', { class: 'form-msg', role: 'status' }, o.kind === 'example' ? '예제는 저장되지 않아요. 이 탭에서만 바뀌어요.' : '');
    const form = h('form', { class: 'edit-form', onsubmit: async (e) => {
            e.preventDefault();
            let next;
            try {
                next = editArea(o.project, part.id, name.value, note.value);
            }
            catch {
                msg.textContent = '이름은 1~60자, 설명은 2,000자까지 쓸 수 있어요.';
                return;
            }
            const failed = await commit(o, next);
            if (failed) {
                msg.textContent = failed;
                return;
            }
            editing = false;
            renderSpace('keep');
            select(part.id);
        } }, h('label', { for: 'edit-name' }, '이름'), name, h('label', { for: 'edit-note' }, '설명 ', h('small', {}, '계획에 적힌 내 말')), note, msg, h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary small' }, '저장'), h('button', { type: 'button', class: 'link-button', onclick: () => { editing = false; renderPanel(false); } }, '취소')));
    return form;
}
function answerCard(o, a) {
    // The asked purpose leads: question → short direct answer; summary → current state; next → decisions. The rest folds.
    const label = a.intent === 'summary' ? '지금 상황 정리' : a.intent === 'next' ? '다음에 판단할 것' : a.question ?? '질문';
    const ul = (items) => h('ul', {}, ...items.map(x => h('li', {}, x)));
    const block = (title, items) => items.length ? h('div', { class: 'ans-block' }, h('h4', {}, title), ul(items)) : null;
    const sections = [['지금 상황', a.reply.situation], ['최근 변화', a.reply.changes], ['다음에 판단할 것', a.reply.next]];
    const main = a.intent === 'summary' ? '지금 상황' : a.intent === 'next' ? '다음에 판단할 것' : null;
    const lead = a.intent === 'question'
        ? h('p', { class: 'ans-text' }, a.reply.answer ?? a.reply.headline)
        : h('div', { class: 'ans-main' }, h('p', { class: 'ans-head' }, a.reply.headline), ul(sections.find(s => s[0] === main)[1].length ? sections.find(s => s[0] === main)[1] : a.reply.situation));
    const rest = sections.filter(s => s[0] !== main && s[1].length);
    const cited = a.reply.refs.map(ref => a.refs[ref]).filter((x) => !!x);
    const records = cited.map(id => o.view.records.find(r => r.id === id)).filter((r) => !!r);
    const partsCited = new Set(records.map(r => r.partId).filter((x) => !!x));
    return h('article', { class: 'answer' }, h('p', { class: 'ans-ask' }, h('span', {}, label), h('small', {}, `${ago(a.at)} · ${a.model}`)), coverageText(a.coverage) ? h('p', { class: 'ans-scope' }, coverageText(a.coverage)) : null, lead, records.length ? h('div', { class: 'ans-refs' }, h('span', {}, '근거'), ...records.map(r => {
        const pn = r.partId ? o.view.parts.find(x => x.id === r.partId)?.name : null;
        return h('button', { type: 'button', class: 'ref', title: firstLine(r.text, 120), onclick: () => openRecord(r.id) }, `${RECORD_LABEL[r.kind]}${pn ? ` · ${pn}` : ''} · ${ago(r.at)}`);
    }), partsCited.size ? h('button', { type: 'button', class: 'link-button', onclick: () => highlightParts(partsCited) }, '지도에서 보기') : null) : null, rest.length ? h('details', { class: 'ans-more' }, h('summary', {}, a.intent === 'question' ? '정리 상세' : '나머지 정리'), ...rest.map(([t, items]) => block(t, items))) : null);
}
function composer(o, part) {
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
    const quick = (intent) => () => (needsCode() ? openBox() : send(intent, null));
    const quickButtons = h('div', { class: 'quick' }, h('button', { type: 'button', class: 'secondary small', disabled: busy, onclick: quick('summary') }, '지금 상황 정리'), h('button', { type: 'button', class: 'secondary small', disabled: busy, onclick: quick('next') }, '다음에 판단할 것'));
    // Reading first: a small entry. The full box opens on demand and stays while there is a draft, a request or an error.
    if (!composerOpen && !busy && !failed && !draft.trim()) {
        box.classList.add('compact');
        box.append(h('div', { class: 'ask-entry' }, h('button', { type: 'button', class: 'ask-open', 'aria-label': `‘${part.name}’에 대해 질문하기`, onclick: openBox }, '질문하기…'), quickButtons));
        return box;
    }
    const input = h('textarea', { id: 'ask-input', rows: '2', maxlength: '1000', placeholder: `‘${part.name}’에 대해 물어보세요`, disabled: busy });
    input.value = draft;
    input.addEventListener('input', () => setDraft(o, part.id, input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        submitQuestion();
    } });
    const submitQuestion = () => { const q = input.value.trim(); if (q) {
        send('question', q);
    } };
    if (status.access === 'code') {
        const code = h('input', { id: 'access-code', type: 'password', placeholder: '접속 코드', autocomplete: 'off', value: sessionCode() });
        // input (not only change): typing, paste and autofill are all kept.
        const keep = () => keepAccessCode(code.value);
        code.addEventListener('input', keep);
        code.addEventListener('change', keep);
        box.append(h('div', { class: 'access' }, h('label', { for: 'access-code' }, '접속 코드'), code));
    }
    if (!busy && !failed)
        quickButtons.append(h('button', { type: 'button', class: 'link-button fold', onclick: () => { composerOpen = false; if (!input.value.trim())
                setDraft(o, part.id, ''); renderPanel(false); } }, '접기'));
    box.append(quickButtons, h('div', { class: 'ask-row' }, input, h('button', { type: 'button', class: 'primary send', disabled: busy, 'aria-label': '보내기', onclick: submitQuestion }, '보내기')), h('p', { class: 'fine' }, `${status.model ?? 'DeepSeek'}가 이 부분과 안의 부분 기록만 읽고 정리해요 · 개발을 실행하지 않아요`));
    return box;
}
let accessCodeMemory = '';
function keepAccessCode(value) { try {
    sessionStorage.setItem('agentflow.studio.access', value);
}
catch { /* memory only */ } accessCodeMemory = value; renderStatus(); }
/* ---------- change plan (plan-view.ts) on this map ---------- */
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
        if (key === planRowsKey)
            return;
        planRows = next;
        planRowsKey = key;
        if (opened) {
            renderSpace('keep', false);
            markSelection(selected);
        }
    },
    selectPart: id => { if (opened)
        go(opened.key, id); },
    showPart: id => { const o = opened; if (o)
        go(o.key, id, partOf(o, id)?.parentId ?? null); },
    reveal,
    capture: () => ({ selected, scope, camera: { ...camera } }),
    notice: (text, action) => toast(text, action),
    restore: r => { const o = opened; if (!o)
        return; returnCamera = r.camera; go(o.key, r.selected, r.scope); },
    surface: (content, parts, place) => {
        const l = $('lens');
        if (!content) {
            if (l.classList.contains('compare'))
                hideLens();
            return;
        }
        // The same reading keeps where the person was in it (a re-render of the same change); a new reading starts at its top.
        const keep = place === false ? l.querySelector('.lens-body')?.scrollTop ?? 0 : 0;
        l.replaceChildren(...content);
        l.hidden = false;
        l.classList.remove('scope-read');
        l.classList.add('compare');
        readingFor = parts;
        syncMapArea();
        const body = l.querySelector('.lens-body');
        if (body)
            body.scrollTop = keep;
        // Only an explicit new target moves the map (the smallest pan beside the pane); sources, the long reading and a mode
        // switch keep the person's camera, including a manual pan.
        if (place === true)
            revealParts(parts);
    },
    area: () => syncMapArea(),
    readReturn: () => { planView.close(); openReturn(); },
    frame: (all, fallback) => {
        // Once, when a whole plan comes to read: its changed parts together when they fit beside the pane at this zoom (no zoom,
        // no centring); else the target being read, as for any new target.
        const boxes = all.map(id => lay.boxes.get(id)).filter((b) => !!b && b.kind !== 'ghost'), area = mapArea();
        // With the map's title when that fits too, as any later target is shown (so reading the next change does not move again).
        for (const rs of boxes.length ? [[...boxes, ...(titleH ? [titleRect()] : [])], boxes] : []) {
            const U = union(rs);
            if (U.w * camera.k <= area.w - 32 && U.h * camera.k <= area.h - 24) {
                revealRect(U);
                return;
            }
        }
        revealParts(fallback);
    },
    chrome: () => {
        const o = opened;
        if (!o)
            return;
        setBar(o);
        renderRecent();
        if (planView.isOpen()) {
            scopeReading = false;
            $('panel').hidden = true;
            $('panel').replaceChildren();
            if (!$('lens').classList.contains('compare'))
                hideLens();
        }
        syncMapArea();
    }
});
/* ---------- coming back: the return reading in the pane ---------- */
/** Parts the return reading is about now: marked on the map (drawn representatives), never selected or restyled by status. */
let readMarks = [];
/** The camera when a part was opened from (or beside) the return reading; coming back restores it unless the map was moved. */
let readingCamera = null;
function applyReadMarks() {
    const o = opened, ids = new Set(o ? readMarks.map(id => drawnRep(o, id)).filter((x) => !!x) : []);
    document.querySelectorAll('.node[data-part],.frame[data-part]').forEach(el => el.classList.toggle('read-mark', ids.has(el.dataset.part)));
}
function openReturn() {
    const o = opened;
    if (!o || o.kind === 'legacy')
        return;
    if (planView.isOpen())
        planView.close(false);
    scopeReading = false;
    if (selected) {
        go(o.key);
    }
    returnView.open();
}
const returnView = createReturnView({
    current: () => opened,
    kv,
    status: () => status,
    accessCode: () => sessionCode(), keepAccessCode,
    bundle: () => planView.bundleOf(),
    show: content => {
        const l = $('lens');
        if (!content) {
            if (l.classList.contains('return-read'))
                hideLens();
            return;
        }
        if (selected || planView.isOpen())
            return;
        const same = l.classList.contains('return-read') && !l.hidden, keep = same ? l.querySelector('.lens-body')?.scrollTop ?? 0 : 0;
        l.replaceChildren(...content);
        l.classList.remove('compare', 'scope-read');
        l.classList.add('return-read');
        l.hidden = false;
        readingFor = [];
        syncMapArea();
        const body = l.querySelector('.lens-body');
        if (body && same)
            body.scrollTop = keep;
    },
    mark: ids => { readMarks = [...ids]; applyReadMarks(); },
    reveal: ids => { const o = opened; if (!o)
        return; revealParts([...new Set(ids.map(id => drawnRep(o, id)).filter((x) => !!x))]); },
    selectPart: id => { const o = opened; if (!o)
        return; readingCamera = { ...camera }; mapMoved = false; go(o.key, id); },
    trial: (text, sources) => { planView.propose(text, sources); },
    compare: ids => { planView.focusParts(ids); },
    chrome: () => { const o = opened; if (o)
        setBar(o); }
});
function sessionCode() { try {
    return sessionStorage.getItem('agentflow.studio.access') ?? accessCodeMemory;
}
catch {
    return accessCodeMemory;
} }
async function send(intent, question) {
    const o = opened, partId = selected;
    if (!o || !partId || ask?.controller)
        return;
    const { ask: payload, refs, coverage } = buildAsk(o.project, o.view, partId, intent, question);
    const controller = new AbortController();
    ask = { partId, intent, question, controller, error: null, coverage };
    if (intent === 'question')
        composerOpen = true; // asked from the box: keep it open for a follow-up
    renderPanel(false);
    scrollThread();
    try {
        const res = await askStudio(payload, controller.signal, sessionCode());
        addAnswer(o, partId, { at: new Date().toISOString(), intent, question, model: res.model, reply: res.reply, refs: Object.fromEntries(refs), coverage });
        ask = null;
        if (intent === 'question')
            setDraft(o, partId, '');
    }
    catch (e) {
        const code = e instanceof AskError ? e.code : 'REQUEST_FAILED';
        ask = code === 'CANCELLED' ? null : { partId, intent, question, controller: null, error: ERROR_TEXT[code] ?? `응답을 받지 못했어요 (${code}).`, coverage };
    }
    if (opened === o && selected === partId) {
        if (sheetOpen) {
            renderPanel(false);
            scrollThread();
        }
        else
            refreshReading();
    }
}
function scrollThread() {
    const body = document.querySelector('.panel-body'), last = body?.querySelector('.thread')?.lastElementChild;
    if (!body || !last)
        return;
    const top = body.scrollTop + last.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
    body.scrollTo({ top: Math.max(0, top) });
}
/* ---------- AI status pill ---------- */
function renderStatus() {
    const pill = $('ai-pill'), text = $('ai-text');
    // A server that asks for an access code is not ready to ask until the person has given one in this tab.
    const needsCode = status.ai === 'deepseek' && status.access === 'code' && !sessionCode();
    pill.dataset.state = needsCode ? 'code' : status.ai;
    text.textContent = status.ai === 'deepseek' ? (needsCode ? 'AI · 접속 코드 필요' : 'AI 정리 가능') : status.ai === 'off' ? 'AI 키 없음' : 'AI 서버 미연결';
    pill.title = status.ai === 'deepseek' ? `서버가 ${status.model ?? 'DeepSeek'}에 정리를 요청해요. 키는 서버에만 있어요.${needsCode ? ' 이 서버는 접속 코드를 받아요. 정리를 요청할 때 입력해 주세요.' : ''}` : status.ai === 'off' ? '서버는 연결됐지만 AI 키가 설정되지 않았어요.' : '이 페이지에는 AI 서버가 연결되어 있지 않아요.';
}
/* ---------- canvas interaction ----------
 * Empty space: drag pans. A node or frame head: click selects, drag moves (frames carry their children; a child moves
 * inside its parent frame, which grows around it), double-click goes inside. Wheel zooms at the cursor (also Ctrl/⌘). */
let toastTimer = 0;
/** Double-click = two clicks on the same part, same view, same spot. */
let lastClick = { id: '', at: 0, x: 0, y: 0, scope: null };
/** A toast speaks for the project it was made in: its action runs only there, and leaving that project takes it away. */
let toastKey = null;
function toast(text, action) {
    const t = $('toast'), key = opened?.key ?? null;
    clearTimeout(toastTimer);
    t.replaceChildren();
    toastKey = key;
    put(t, h('span', {}, text), action ? h('button', { type: 'button', class: 'link-button', onclick: () => { t.hidden = true; if (opened?.key === key)
            action.run(); } }, action.label) : null);
    t.hidden = false;
    toastTimer = window.setTimeout(() => { t.hidden = true; }, 8000);
}
function dropToast() { clearTimeout(toastTimer); $('toast').hidden = true; toastKey = null; }
/** Explicit only: resets the places in this view (the scope and its open frames); one undo. */
function arrange() {
    const o = opened;
    if (!o)
        return;
    const pos = positionsOf(o), containers = [scope ?? ROOT, ...[...lay.boxes.values()].filter(b => b.kind === 'frame').map(b => b.id)];
    const before = structuredClone(pos), had = containers.some(c => pos[c] && Object.keys(pos[c]).length);
    if (!had) {
        toast('이미 자동 배치 상태예요.');
        return;
    }
    for (const c of containers)
        delete pos[c];
    savePositions(o);
    renderSpace('keep');
    fitView(false, true);
    if (selected)
        select(selected);
    toast('이 화면을 자동 정렬했어요.', { label: '되돌리기', run: () => {
            for (const k of Object.keys(pos))
                delete pos[k];
            Object.assign(pos, before);
            savePositions(o);
            if (opened === o) {
                renderSpace('keep');
                if (selected)
                    select(selected);
            }
        } });
}
/* ---------- finding a part by name ----------
 * Every part stays reachable however the map is folded: names (and the descriptions that keep original names) are searched in
 * the project's own data, and a result opens the same part where it sits, inside its group when that group is folded here.
 * The previous scene keeps its way back. A navigation aid only: nothing is ranked, grouped or added. */
let findOpen = false;
function bindFind() {
    const tools = document.querySelector('.controls'), button = h('button', { type: 'button', id: 'find-toggle', class: 'find-toggle', 'aria-expanded': 'false', 'aria-controls': 'find', title: '부분 찾기 (/)' }, '찾기');
    tools.insertBefore(button, $('zoom-out').previousElementSibling);
    const input = h('input', { id: 'find-input', type: 'search', placeholder: '부분 이름이나 설명의 낱말', autocomplete: 'off', 'aria-label': '부분 찾기' });
    const count = h('p', { class: 'find-count', role: 'status' }), list = h('ol', { class: 'find-list' });
    const box = h('section', { id: 'find', class: 'find', 'aria-label': '부분 찾기', hidden: true }, input, count, list);
    $('space').append(box);
    const LIMIT = 60;
    const show = (on) => { findOpen = on; box.hidden = !on; button.setAttribute('aria-expanded', String(on)); button.classList.toggle('on', on); if (on) {
        input.select();
        input.focus();
        run();
    } };
    const open = (id) => {
        const o = opened, p = o ? partOf(o, id) : null;
        if (!o || !p)
            return;
        // Here when it is drawn in this view; else inside its own group (a list reads there at full size); a top part on the map.
        const sc = lay.boxes.has(id) && lay.boxes.get(id).kind !== 'ghost' ? scope : p.parentId;
        show(false);
        go(o.key, id, sc);
    };
    function run() {
        const o = opened;
        if (!o)
            return;
        const q = input.value.trim().toLowerCase();
        if (!q) {
            count.textContent = `부분 ${o.view.parts.length}개 · 이름을 적어 주세요`;
            list.replaceChildren();
            return;
        }
        const byName = o.view.parts.filter(p => p.name.toLowerCase().includes(q)), byNote = o.view.parts.filter(p => !byName.includes(p) && p.note.toLowerCase().includes(q));
        const all = [...byName, ...byNote];
        count.textContent = all.length ? (all.length > LIMIT ? `${all.length}개 중 ${LIMIT}개 · 더 좁혀 적어 주세요` : `${all.length}개`) : '찾은 부분이 없어요';
        list.replaceChildren(...all.slice(0, LIMIT).map(p => h('li', {}, h('button', { type: 'button', class: 'find-item', onclick: () => open(p.id) }, h('strong', {}, p.name), h('span', {}, [[...partPath(o.view, p.id).slice(0, -1).map(x => x.name)].join(' › ') || o.project.name, aliasOf(o.view, p.id)].filter(Boolean).join(' · '), byName.includes(p) ? '' : ' · 설명에서')))));
    }
    input.addEventListener('input', run);
    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            show(false);
            button.focus();
        }
        if (e.key === 'Enter') {
            const first = list.querySelector('.find-item');
            if (first) {
                e.preventDefault();
                first.click();
            }
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            list.querySelector('.find-item')?.focus();
        }
    });
    list.addEventListener('keydown', e => {
        const items = [...list.querySelectorAll('.find-item')], at = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' && at >= 0) {
            e.preventDefault();
            items[Math.min(items.length - 1, at + 1)]?.focus();
        }
        if (e.key === 'ArrowUp' && at >= 0) {
            e.preventDefault();
            (at === 0 ? input : items[at - 1]).focus();
        }
        if (e.key === 'Escape') {
            e.stopPropagation();
            show(false);
            button.focus();
        }
    });
    button.addEventListener('click', () => show(!findOpen));
    document.addEventListener('keydown', e => { if (e.key === '/' && opened && !$('space').hidden && !e.target.closest('textarea,input,select')) {
        e.preventDefault();
        show(true);
    } });
    $('viewport').addEventListener('pointerdown', () => { if (findOpen)
        show(false); });
    window.addEventListener('hashchange', () => { if (findOpen && !location.hash.startsWith('#/p/'))
        show(false); });
}
function bindCanvas() {
    const vp = $('viewport');
    let drag = null;
    vp.addEventListener('pointerdown', e => {
        if (e.button !== 0)
            return;
        const target = e.target;
        // The recent popover gives way to the map: working on the map closes it (opening a record from it keeps it for the way back).
        if (recentOpen || recentPeek) {
            recentOpen = recentPeek = false;
            if (opened)
                renderRecent();
        }
        if (target.closest('button,a,input,textarea'))
            return;
        const handle = target.closest('[data-drag]'), o = opened;
        if (handle && o) {
            const id = handle.dataset.drag, b = lay.boxes.get(id);
            if (!b)
                return;
            drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, mode: 'part', id, container: b.container, start: { ...b.rel } };
        }
        else
            drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, mode: 'pan', cx: camera.x, cy: camera.y };
        vp.setPointerCapture(e.pointerId);
    });
    vp.addEventListener('pointermove', e => {
        if (!drag || drag.pointer !== e.pointerId)
            return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4)
            return;
        if (!drag.moved) {
            drag.moved = true;
            vp.classList.add(drag.mode === 'pan' ? 'grabbing' : 'moving');
            if (drag.mode === 'part')
                document.querySelector(`[data-box="${CSS.escape(drag.id)}"]`)?.classList.add('dragging');
        }
        if (drag.mode === 'pan') {
            mapMoved = true;
            camera = { ...camera, x: drag.cx + dx, y: drag.cy + dy };
            applyCamera();
            return;
        }
        const o = opened;
        const pos = positionsOf(o);
        (pos[drag.container] ??= {})[drag.id] = { x: Math.round(drag.start.x + dx / camera.k), y: Math.round(drag.start.y + dy / camera.k) };
        relayout(o);
        positionWorld();
    });
    const end = (e) => {
        if (!drag || drag.pointer !== e.pointerId)
            return;
        const d = drag;
        drag = null;
        vp.classList.remove('grabbing', 'moving');
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        const o = opened;
        if (!o || e.type === 'pointercancel')
            return;
        if (d.mode === 'part' && d.moved) {
            savePositions(o);
            return;
        }
        if (d.mode === 'part') {
            const now = Date.now(), part = partOf(o, d.id);
            const twice = lastClick.id === d.id && lastClick.scope === scope && now - lastClick.at < 380 && Math.abs(lastClick.x - e.clientX) + Math.abs(lastClick.y - e.clientY) < 8;
            lastClick = { id: d.id, at: now, x: e.clientX, y: e.clientY, scope };
            if (twice && part?.childIds.length) {
                lastClick.id = '';
                go(o.key, null, d.id);
                return;
            }
            go(o.key, d.id);
            return;
        }
        if (!d.moved && selected)
            go(o.key);
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    vp.addEventListener('wheel', e => {
        e.preventDefault();
        const r = vp.getBoundingClientRect(), unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        const delta = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
        // Pinch (ctrlKey) sends small deltas; a mouse notch is about 100.
        mapMoved = true;
        zoomAt(camera.k * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top + vp.offsetTop);
    }, { passive: false });
    const center = () => { const r = vp.getBoundingClientRect(); return [r.width / 2, vp.offsetTop + r.height / 2]; };
    $('zoom-in').addEventListener('click', () => { mapMoved = true; const [x, y] = center(); zoomAt(camera.k + 0.15, x, y, true); });
    $('zoom-out').addEventListener('click', () => { mapMoved = true; const [x, y] = center(); zoomAt(camera.k - 0.15, x, y, true); });
    $('zoom-fit').addEventListener('click', () => { mapMoved = true; fitView(true, true); });
    $('arrange').addEventListener('click', arrange);
    const help = $('help'), helpButton = $('help-toggle');
    helpButton.addEventListener('click', () => { help.hidden = !help.hidden; helpButton.setAttribute('aria-expanded', String(!help.hidden)); });
    $('recent-toggle').addEventListener('click', () => { if (selected || planView.isOpen())
        recentPeek = !recentPeek;
    else
        recentOpen = !recentOpen; if (opened)
        renderRecent(); });
    $('scene-back').addEventListener('click', sceneBack);
    bindEdgeHints();
    document.addEventListener('pointerdown', e => {
        const menu = document.querySelector('details.more[open]');
        if (menu && !menu.contains(e.target))
            menu.open = false;
    });
    document.addEventListener('keydown', e => {
        if (e.target.closest('textarea,select,input:not([type=checkbox]):not([type=radio])'))
            return; // Esc still works from a checkbox
        // Innermost first: an open ⋯ menu closes before anything else, and focus goes back to its button.
        const menu = document.querySelector('details.more[open]');
        if (e.key === 'Escape' && menu) {
            menu.open = false;
            menu.querySelector('summary')?.focus();
            return;
        }
        if (e.key === 'Escape' && !help.hidden) {
            help.hidden = true;
            helpButton.setAttribute('aria-expanded', 'false');
            return;
        }
        if (e.key === 'Escape' && opened && recentShown() && !$('recent').classList.contains('collapsed')) {
            if (selected || planView.isOpen())
                recentPeek = false;
            else
                recentOpen = false;
            renderRecent();
            return;
        }
        if (e.key === 'Escape' && planView.isOpen()) {
            const part = selected;
            planView.escape();
            if (part && !selected)
                requestAnimationFrame(() => document.querySelector(`[data-drag="${CSS.escape(part)}"]`)?.focus());
            return;
        }
        if (e.key === 'Escape' && partForm && opened?.view.parts.length) {
            partForm = null;
            renderPartForm();
            return;
        }
        if (e.key === 'Escape' && opened && selected && sheetOpen) {
            closeSheet();
            return;
        }
        if (e.key === 'Escape' && opened && selected) {
            const key = opened.key, part = selected;
            go(key);
            requestAnimationFrame(() => document.querySelector(`[data-drag="${CSS.escape(part)}"]`)?.focus());
            return;
        }
        if (e.key === 'Escape' && opened && scopeReading && !selected) {
            closeScopeReading();
            return;
        }
        if (e.key === 'Escape' && opened && returnView.isOpen() && !selected) {
            returnView.escape();
            return;
        }
        if (e.key === 'Escape' && opened && scope) {
            const o = opened, from = scope;
            go(o.key, null, partOf(o, from)?.parentId ?? null);
            requestAnimationFrame(() => document.querySelector(`[data-drag="${CSS.escape(from)}"]`)?.focus());
        }
    });
    let resize = 0;
    window.addEventListener('resize', () => { cancelAnimationFrame(resize); resize = requestAnimationFrame(() => { syncMapArea(); if (opened && !selected && !planView.isOpen() && $('lens').hidden)
        fitView(false); }); });
}
/** Hover: a line shows what it means (ends, kind, recorded note) without selecting; a part lights its own lines. */
function bindEdgeHints() {
    const world = $('world'), tip = $('edge-tip'), space = $('space');
    const nameOf = (boxId) => { const o = opened; if (!o)
        return ''; return partOf(o, boxId.startsWith('ghost:') ? boxId.slice(6) : boxId)?.name ?? ''; };
    const place = (e) => { const r = space.getBoundingClientRect(); tip.style.left = `${Math.min(e.clientX - r.left + 14, r.width - 300)}px`; tip.style.top = `${e.clientY - r.top + 14}px`; };
    world.addEventListener('pointerover', e => {
        const t = e.target, g = t.closest('.edge');
        if (g && t.classList.contains('edge-hit')) {
            const edge = lay.edges.find(x => x.key === g.dataset.key);
            if (!edge)
                return;
            g.classList.add('near');
            tip.replaceChildren(h('strong', {}, `${nameOf(edge.from)} ${edge.kind === 'related' ? '—' : '→'} ${nameOf(edge.to)}`), h('span', { class: 'tip-kind' }, `${REL_LABEL[edge.kind] ?? edge.kind}${edge.agg ? ` · 안쪽 관계 ${edge.ids.length}개의 요약 · 선택하면 실제 끝점` : edge.ids.length > 1 ? ` · 관계 ${edge.ids.length}개를 한 선으로 묶음` : ''}`), ...edge.notes.slice(0, 3).map(n => h('span', {}, n)));
            tip.hidden = false;
            place(e);
            return;
        }
        const part = t.closest('.node[data-box], .frame-head[data-part], .ghost[data-box]');
        if (part) {
            const id = part.dataset.box ?? part.dataset.part;
            world.querySelectorAll('.edge').forEach(x => x.classList.toggle('near', x.dataset.from === id || x.dataset.to === id));
        }
    });
    world.addEventListener('pointermove', e => { if (!tip.hidden)
        place(e); });
    world.addEventListener('pointerout', e => {
        const t = e.target;
        if (t.classList.contains('edge-hit'))
            tip.hidden = true;
        const to = e.relatedTarget;
        if (!to || !to.closest?.('.node, .frame-head, .ghost, .edge'))
            world.querySelectorAll('.edge.near').forEach(x => x.classList.remove('near'));
    });
}
/* ---------- import (backup file → new saved copy; the file's bytes are validated as project data) ---------- */
function bindNewProject() {
    const name = $('new-name'), msg = $('home-message'), form = $('new-form'), openBtn = $('new-open');
    const show = (on) => { form.hidden = !on; openBtn.setAttribute('aria-expanded', String(on)); if (on)
        name.focus();
    else
        openBtn.focus(); };
    openBtn.addEventListener('click', () => show(form.hidden));
    $('new-cancel').addEventListener('click', () => { name.value = ''; show(false); });
    name.addEventListener('keydown', e => { if (e.key === 'Escape') {
        e.stopPropagation();
        name.value = '';
        show(false);
    } });
    $('new-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const value = name.value.trim();
        if (!value) {
            name.focus();
            return;
        }
        let project;
        try {
            project = rename(createProject(), value);
        }
        catch {
            msg.textContent = '이름은 120자까지 쓸 수 있어요.';
            msg.hidden = false;
            return;
        }
        if (!store.writable) {
            msg.textContent = '이 브라우저에서는 저장할 수 없어 새 프로젝트를 만들지 못했어요.';
            msg.hidden = false;
            msg.dataset.keep = '1';
            return;
        }
        try {
            const ref = await store.create(project, 'new');
            name.value = '';
            go(ref.entryId);
        }
        catch {
            msg.textContent = '새 프로젝트를 저장하지 못했어요.';
            msg.hidden = false;
            msg.dataset.keep = '1';
        }
    });
}
function bindImport() {
    const file = $('import-file'), msg = $('home-message');
    const say = (text) => { msg.textContent = text; msg.hidden = false; msg.dataset.keep = '1'; };
    $('import').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
        const f = file.files?.[0];
        file.value = '';
        if (!f)
            return;
        if (f.size > FILE_LIMIT) {
            say('파일이 너무 커요.');
            return;
        }
        let project;
        try {
            project = parseProject(await f.text());
        }
        catch {
            say('AgentFlow 프로젝트 백업 파일이 아니거나 읽을 수 없어요. 아무것도 바꾸지 않았어요.');
            return;
        }
        if (!store.writable) {
            say('이 브라우저에서는 저장할 수 없어 가져오지 못했어요.');
            return;
        }
        try {
            const ref = await store.create(project, 'import');
            say(`새 사본으로 가져왔어요 · ${project.name}`);
            go(ref.entryId);
        }
        catch {
            say('가져오지 못했어요. 저장된 프로젝트는 그대로예요.');
        }
    });
}
async function main() {
    store = new WorkspaceStore(kv, navigator.locks ?? null);
    try {
        await store.init();
    }
    catch {
        store.read();
    }
    bindCanvas();
    bindFind();
    bindImport();
    bindNewProject();
    $('add-part').addEventListener('click', () => openPartForm(scope));
    $('plan-entry').addEventListener('click', () => planView.toggle());
    $('return-entry').addEventListener('click', () => { if (returnView.isOpen() && !planView.isOpen())
        returnView.close();
    else
        openReturn(); });
    statusReady = aiStatus().then(s => { status = s; renderStatus(); planView.statusChanged(); refreshReading(); if (!selected && !planView.isOpen())
        returnView.render(); });
    window.addEventListener('hashchange', () => void render());
    window.addEventListener('popstate', () => { if (location.hash === renderedHash)
        void render(); });
    await render();
    await statusReady;
}
void main();
