import { FILE_LIMIT } from '../shared/types.js';
import { WorkspaceStore, storageErrorCode } from '../shared/storage.js';
import { parseProject } from '../shared/validation.js';
import { editArea, addArea, addChildArea, createProject, rename } from '../shared/domain.js';
import { studioView, subtreeRecords, partPath, buildAsk, STATUS_LABEL, STATUS_SHORT, RECORD_LABEL } from '../shared/studio.js';
import { EXAMPLES, buildExample, exampleKeys } from '../shared/studio-examples.js';
import { layoutScope, edgePath, ROOT } from './map-layout.js';
import { aiStatus, askStudio, AskError, ERROR_TEXT } from './studio-api.js';
import { runtimeStorage } from './runtime.js';
import { $, h, put, svg, chevron, ago, fullTime } from './plan-dom.js';
import { CONVERTER_KEY, buildConverterProject, converterKeys } from './plan-source.js';
import { createPlanView } from './plan-view.js';
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
let recentOpen = window.innerWidth >= 1000;
/** While a part is open the list folds to give the map room; the person's own choice comes back on close. */
let recentPeek = false;
const recentShown = () => (selected || planView.isOpen() ? recentPeek : recentOpen);
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
let lay = { boxes: new Map(), edges: [], bounds: { x: 0, y: 0, w: 0, h: 0 } };
const cameras = new Map();
const expandState = new Map();
const camKey = (o, s) => `${o.project.id}|${s ?? ''}`;
/** Direct children of the scope open as frames; deeper parts stay folded until opened. */
/** Unfolded only for the part being looked at (not the person's own fold choice). */
const tempExpand = new Set();
const isExpanded = (o) => (id, depth) => tempExpand.has(`${o.project.id}|${id}`) || (expandState.get(`${o.project.id}|${id}`) ?? depth === 0);
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
        const toId = key === CONVERTER_KEY ? converterKeys(project) : exampleKeys(key.slice(3), project);
        alias = { toId, toKey: new Map([...toId].map(([k, id]) => [id, k])) };
    }
    return { key, kind, project, ref, view: studioView(project), alias };
}
/* ---------- rendering ---------- */
async function render() {
    const r = route();
    if (!r.key) {
        if (opened)
            cameras.set(camKey(opened, scope), { ...camera });
        planView.close(false);
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
    const idOf = (x) => (x ? next.alias?.toId.get(x) ?? x : null), routeScope = idOf(r.scope), routePart = idOf(r.part);
    const nextScope = routeScope && next.view.parts.some(p => p.id === routeScope && p.childIds.length) ? routeScope : null;
    if (fresh || nextScope !== scope) {
        if (opened)
            cameras.set(camKey(opened, scope), { ...camera });
        opened = next;
        scope = nextScope;
        lastClick.id = '';
        if (fresh)
            planView.projectChanged();
        if (fresh) {
            selected = null;
            ask = null;
            editing = false;
            partForm = null;
            composerOpen = false;
        }
        tempExpand.clear();
        renderSpace('restore');
    }
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
    select(part);
    if (returnCamera) {
        camera = returnCamera;
        returnCamera = null;
        applyCamera(true);
    }
}
/** Set when a change plan closes: the camera the person left, applied once the earlier selection and scope are back. */
let returnCamera = null;
function setBar(o) {
    const crumbs = [h('a', { href: '#/' }, '프로젝트')];
    if (o) {
        const path = scope ? partPath(o.view, scope) : [];
        crumbs.push(h('span', { class: 'sep', 'aria-hidden': 'true' }, '/'), path.length ? h('a', { href: hashFor(o.key, null, null), title: '전체 지도' }, o.project.name) : h('strong', {}, o.project.name));
        path.forEach((p, i) => crumbs.push(h('span', { class: 'sep', 'aria-hidden': 'true' }, '/'), i === path.length - 1 ? h('strong', { 'aria-current': 'location' }, p.name) : h('a', { href: hashFor(o.key, null, p.id) }, p.name)));
        if (o.key === CONVERTER_KEY)
            crumbs.push(h('span', { class: 'tag', title: '공개 합성 예제예요. 지도는 작성한 구조이고, 변경 구상은 이 탭에서만 남아요.' }, '예제'));
        else if (o.kind !== 'saved')
            crumbs.push(h('span', { class: 'tag', title: o.kind === 'example' ? 'Codex·Claude에서 전달받았다고 가정하고 쓴 예제 기록이에요. 저장되지 않아요.' : '' }, o.kind === 'example' ? '예제 기록' : '이전 저장 · 읽기 전용'));
    }
    $('crumbs').replaceChildren(...crumbs);
    const entry = $('plan-entry'), planning = planView.isOpen();
    entry.hidden = !o || o.kind === 'legacy';
    entry.setAttribute('aria-pressed', String(planning));
    entry.classList.toggle('on', planning);
    entry.textContent = planning ? '변경 구상 중' : '변경 구상';
    entry.title = planning ? '변경 구상 닫기 (Esc) · 초안은 남아요' : '현재 지도 위에서 바꿀 모습을 시험해요';
    document.title = o ? `${o.project.name} · AgentFlow Studio` : 'AgentFlow Studio';
}
function projectCard(key, p, example, lead) {
    const v = studioView(p), last = v.records[0], lastPart = last?.partId ? v.parts.find(x => x.id === last.partId) : null;
    const changed = v.parts.filter(x => recentAt(x.lastAt)).length;
    return h('li', {}, h('a', { class: 'project-card', href: `#/p/${encodeURIComponent(key)}` }, h('span', { class: 'card-top' }, h('strong', { class: 'card-name' }, p.name), example ? h('span', { class: 'tag' }, '예제') : null), h('span', { class: 'card-purpose' }, p.space.brief?.text ?? '목적이 적혀 있지 않아요.'), last ? h('span', { class: 'card-latest' }, h('i', { class: `k-${last.kind}` }), h('span', {}, `${lastPart?.name ?? '부분 미지정'} · ${firstLine(last.text, 60)}`))
        : lead ? h('span', { class: 'card-latest plan-lead' }, h('i', { class: 'k-plan', 'aria-hidden': 'true' }), h('span', {}, lead)) : null, h('span', { class: 'card-meta' }, `부분 ${v.parts.length} · 기록 ${v.records.length}${changed ? ` · 최근 바뀐 부분 ${changed}` : ''}`, last ? h('span', { class: 'card-time' }, ago(last.at)) : null)));
}
function renderHome() {
    setBar(null);
    $('home').hidden = false;
    $('space').hidden = true;
    const list = $('project-list');
    let converter;
    try {
        if (!examples.has(CONVERTER_KEY))
            examples.set(CONVERTER_KEY, buildConverterProject());
        converter = projectCard(CONVERTER_KEY, examples.get(CONVERTER_KEY), true, '변경 구상 예제 · 폴더째 변환을 시험해요');
    }
    catch {
        converter = h('li', { class: 'message' }, '예제 ‘문서 변환기’를 만들지 못했어요.');
    }
    list.replaceChildren(converter, ...EXAMPLES.map(spec => {
        const key = `ex-${spec.id}`;
        try {
            if (!examples.has(key))
                examples.set(key, buildExample(spec));
            return projectCard(key, examples.get(key), true);
        }
        catch {
            return h('li', { class: 'message' }, `예제 ‘${spec.name}’을 만들지 못했어요.`);
        }
    }));
    const saved = store.entries().filter(e => e.state === 'active');
    const cards = [];
    for (const e of saved) {
        try {
            cards.push(projectCard(e.entryId, e.project, false));
        }
        catch {
            cards.push(h('li', { class: 'message' }, `‘${e.project.name}’을 읽지 못했어요.`));
        }
    }
    if (store.legacy?.project)
        cards.push(projectCard('legacy', store.legacy.project, false));
    $('saved-list').replaceChildren(...cards);
    $('saved-title').hidden = !cards.length;
    const msg = $('home-message');
    const problem = store.readError ? '이 브라우저의 저장 공간을 읽지 못해 저장된 프로젝트를 보여 드릴 수 없어요. 저장된 내용은 바꾸지 않았어요.' : null;
    if (problem) {
        msg.textContent = problem;
        msg.hidden = false;
    }
    else if (!msg.dataset.keep)
        msg.hidden = true;
}
const relayout = (o) => { lay = layoutScope(o.view, scope, isExpanded(o), positionsOf(o)); };
/** camera: 'fit' (new view), 'restore' (a scope's own last camera, else fit), 'keep' (same view, structure changed). */
function renderSpace(cameraMode = 'fit') {
    const o = opened;
    setBar(o);
    $('home').hidden = true;
    $('space').hidden = false;
    relayout(o);
    const world = $('world'), view = o.view;
    world.replaceChildren();
    const edges = svg('svg', { class: 'edges', width: '1', height: '1', 'aria-hidden': 'true' });
    const defs = svg('defs', {});
    for (const id of ['arrow', 'arrow-on']) {
        const m = svg('marker', { id, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
        m.append(svg('path', { d: 'M0,1 L9,5 L0,9 z' }));
        defs.append(m);
    }
    edges.append(defs);
    for (const e of lay.edges) {
        const g = svg('g', { class: `edge k-${e.kind}`, 'data-from': e.from, 'data-to': e.to, 'data-key': e.key });
        g.append(svg('path', { 'marker-end': 'url(#arrow)' }));
        // No text on the map: long notes crossed the nodes. The note is in the panel's 연결 list (and the line's title).
        if (e.notes.length) {
            const t = svg('title', {});
            t.textContent = e.notes.join('\n');
            g.append(t);
        }
        edges.append(g);
    }
    world.append(edges);
    const enterButton = (p) => h('button', { type: 'button', class: 'enter', title: `‘${p.name}’ 안으로 들어가기`, 'aria-label': `${p.name} 안으로 들어가기`, onclick: () => go(o.key, null, p.id) }, `${p.childIds.length}`, h('span', { 'aria-hidden': 'true' }, '›'));
    const toggleButton = (p, open) => h('button', { type: 'button', class: 'toggle', title: open ? '접기' : '여기서 펼치기', 'aria-label': `${p.name} ${open ? '접기' : '펼치기'}`, 'aria-expanded': String(open),
        onclick: () => { const k = `${o.project.id}|${p.id}`; expandState.set(k, !open); tempExpand.delete(k); renderSpace('keep'); if (selected)
            select(selected); } }, chevron(open));
    const keySelect = (id) => (e) => { const k = e.key; if ((k === 'Enter' || k === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        go(o.key, id);
    } };
    const boxes = [...lay.boxes.values()].sort((a, b) => (a.kind === 'frame' ? 0 : 1) - (b.kind === 'frame' ? 0 : 1) || a.depth - b.depth);
    for (const b of boxes) {
        if (b.kind === 'ghost') {
            const id = b.id.slice(6), p = partOf(o, id), path = partPath(view, id).map(x => x.name);
            world.append(h('button', { type: 'button', class: 'ghost', 'data-box': b.id, title: `바깥 부분 · ${path.join(' › ')}`, onclick: () => go(o.key, id, p.parentId) }, h('span', { class: 'ghost-tag' }, '바깥'), h('span', { class: 'ghost-name' }, p.name)));
            continue;
        }
        const p = partOf(o, b.id);
        if (b.kind === 'frame') {
            const latest = subtreeRecords(view, p.id)[0]?.at ?? null;
            world.append(h('div', { class: `frame depth-${Math.min(b.depth, 2)}`, 'data-part': p.id, 'data-box': p.id }, h('div', { class: `frame-head s-${p.status}`, 'data-part': p.id, 'data-drag': p.id, role: 'button', tabindex: '0', title: p.name, onkeydown: keySelect(p.id) }, toggleButton(p, true), h('span', { class: 'frame-name' }, p.name), h('span', { class: 'plan-note' }), h('span', { class: 'frame-meta' }, recentAt(latest) ? h('i', { class: 'new-dot', title: '최근 기록' }) : null, latest ? ago(latest) : STATUS_SHORT[p.status]), enterButton(p))));
        }
        else {
            // A folded part reads its inside: latest record anywhere under it.
            const last = b.kids ? subtreeRecords(view, p.id)[0]?.at ?? null : p.lastAt;
            world.append(h('div', { class: `node s-${p.status}${recentAt(last) ? ' fresh' : ''}${b.kids ? ' has-kids' : ''}`, 'data-part': p.id, 'data-box': p.id, 'data-drag': p.id, role: 'button', tabindex: '0',
                title: `${p.name}${p.note ? ` — ${p.note}` : ''}`, onkeydown: keySelect(p.id) }, b.kids ? toggleButton(p, false) : null, h('span', { class: 'node-text' }, h('span', { class: 'node-name' }, p.name), h('span', { class: 'node-meta' }, h('i', { class: 'dot', 'aria-hidden': 'true' }), STATUS_SHORT[p.status], last ? ` · ${ago(last)}` : ''), h('span', { class: 'plan-note' })), b.kids ? enterButton(p) : null));
        }
    }
    positionWorld();
    // Scope bar: where am I and how to go back up.
    const sp = partOf(o, scope), bar = $('scope-bar');
    bar.hidden = !sp;
    $('space').classList.toggle('in-scope', !!sp);
    if (sp) {
        const up = sp.parentId ? partOf(o, sp.parentId) : null;
        bar.replaceChildren(h('button', { type: 'button', class: 'scope-up', onclick: () => go(o.key, null, sp.parentId), title: `${up?.name ?? '전체 지도'}로 돌아가기` }, h('span', { 'aria-hidden': 'true' }, '‹'), up ? up.name : '전체'), h('span', { class: 'scope-label' }, h('strong', {}, sp.name), ` 안 · 부분 ${sp.childIds.length}`), h('button', { type: 'button', class: 'link-button', onclick: () => go(o.key, sp.id) }, '정보'));
    }
    const empty = $('space-empty');
    empty.hidden = view.parts.length > 0 || o.kind === 'saved';
    empty.textContent = view.records.length ? `아직 부분으로 나뉘지 않은 프로젝트예요. 기록 ${view.records.length}개는 왼쪽 ‘최근 변화’에서 볼 수 있어요.` : '아직 부분도 기록도 없는 프로젝트예요.';
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
    planView.overlay();
}
/** Geometry only (also during a drag): boxes and edge paths from the current layout. */
function positionWorld() {
    const world = $('world');
    world.querySelectorAll('[data-box]').forEach(el => {
        const b = lay.boxes.get(el.dataset.box);
        if (!b)
            return;
        el.style.left = `${b.x}px`;
        el.style.top = `${b.y}px`;
        el.style.width = `${b.w}px`;
        el.style.height = `${b.h}px`;
    });
    world.querySelectorAll('.edge').forEach(g => {
        const a = lay.boxes.get(g.dataset.from), b = lay.boxes.get(g.dataset.to);
        if (!a || !b)
            return;
        g.querySelector('path').setAttribute('d', edgePath(a, b).d);
    });
}
function renderRecent() {
    const o = opened, sp = partOf(o, scope), all = sp ? subtreeRecords(o.view, sp.id) : o.view.records, LATEST = 7;
    const items = recentAll ? all : all.slice(0, LATEST), partial = items.length < all.length;
    $('recent-title').textContent = sp ? `최근 기록 · ${sp.name}` : '최근 기록';
    $('recent-count').textContent = partial ? `최신 ${items.length} / ${all.length}` : String(all.length);
    $('recent').classList.toggle('collapsed', !recentShown());
    $('recent-toggle').setAttribute('aria-expanded', String(recentShown()));
    $('recent-list').replaceChildren(...items.map(r => {
        const part = r.partId ? o.view.parts.find(x => x.id === r.partId) : null;
        return h('li', {}, h('button', { type: 'button', class: 'recent-item', disabled: !part, onclick: () => { if (part) {
                pendingRecord = r.id;
                go(o.key, part.id);
            } } }, h('span', { class: 'ri-top' }, h('i', { class: `k-${r.kind}`, 'aria-hidden': 'true' }), h('strong', {}, part?.name ?? '부분 미지정'), h('span', { class: 'ri-kind' }, RECORD_LABEL[r.kind]), h('span', { class: 'ri-time' }, ago(r.at))), h('span', { class: 'ri-text' }, firstLine(r.text, 70))));
    }), ...(all.length > LATEST ? [h('li', { class: 'recent-more' }, h('button', { type: 'button', class: 'link-button', onclick: () => { recentAll = !recentAll; renderRecent(); } }, recentAll ? `최신 ${LATEST}개만 보기` : `전체 ${all.length}개 보기`))] : []));
}
/* ---------- camera ---------- */
const ZOOM_MIN = 0.4, ZOOM_MAX = 1.6;
const PANEL_W = () => (planView.isOpen() ? planView.width() : selected && !$('panel').hidden ? Math.min(460, window.innerWidth - 24) + 24 : 0);
const leftInset = () => (recentShown() && window.innerWidth >= 900 ? 312 : 16);
function applyCamera(animate = false) {
    const world = $('world'), vp = $('viewport');
    world.classList.toggle('animate', animate);
    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`;
    vp.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
    vp.style.backgroundSize = `${20 * camera.k}px ${20 * camera.k}px`;
    $('zoom-level').textContent = `${Math.round(camera.k * 100)}%`;
}
/** Whole view in the free area. Opening never shrinks below 85%; only the explicit 전체 보기 button may go further. */
function fitView(explicit, animate = false) {
    const o = opened;
    if (!o)
        return;
    const vp = $('viewport').getBoundingClientRect(), left = leftInset(), right = PANEL_W() + 16, top = scope ? 64 : 24, bottom = 72;
    const w = Math.max(200, vp.width - left - right), hgt = Math.max(160, vp.height - top - bottom), B = lay.bounds;
    const fit = Math.min(1, w / Math.max(1, B.w + 40), hgt / Math.max(1, B.h + 40));
    const k = explicit ? Math.max(ZOOM_MIN, fit) : Math.max(0.85, fit);
    const mw = B.w * k, mh = B.h * k;
    camera = { k, x: left + (mw <= w ? (w - mw) / 2 : 12) - B.x * k, y: top + (mh <= hgt ? (hgt - mh) / 2 : 12) - B.y * k };
    applyCamera(animate);
}
function zoomAt(k, cx, cy, animate = false) {
    const nk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));
    camera = { k: nk, x: cx - (cx - camera.x) * (nk / camera.k), y: cy - (cy - camera.y) * (nk / camera.k) };
    applyCamera(animate);
}
/** Keep the selected part visible beside the panel. */
function reveal(partId) {
    const b = lay.boxes.get(partId);
    if (!b)
        return;
    const vp = $('viewport').getBoundingClientRect(), left = leftInset(), right = vp.width - PANEL_W() - 16;
    const sx = camera.x + b.x * camera.k, sy = camera.y + b.y * camera.k, sw = Math.min(b.w, 420) * camera.k, sh = Math.min(b.h, 360) * camera.k;
    // Smallest move that brings it into view, so the surrounding structure stays where it was.
    let dx = 0, dy = 0;
    if (sx + sw > right)
        dx = right - 24 - (sx + sw);
    if (sx + dx < left)
        dx = left + 24 - sx;
    if (sy + sh > vp.height - 72)
        dy = vp.height - 96 - (sy + sh);
    if (sy + dy < 16)
        dy = 40 - sy;
    if (dx || dy) {
        camera = { ...camera, x: camera.x + dx, y: camera.y + dy };
        applyCamera(true);
    }
}
/* ---------- selection & panel ---------- */
let pendingRecord = null;
function select(partId) {
    const changed = selected !== partId;
    if (changed) {
        editing = false;
        composerOpen = false;
        if (ask && !ask.controller)
            ask = null;
    }
    if (!!selected !== !!partId)
        recentPeek = false;
    selected = partId;
    if (opened)
        renderRecent();
    document.querySelectorAll('.node[data-part],.frame').forEach(el => el.classList.toggle('selected', el.dataset.part === partId));
    document.querySelectorAll('.edge').forEach(el => {
        const on = !!partId && (el.dataset.from === partId || el.dataset.to === partId);
        el.classList.toggle('on', on);
        el.querySelector('path').setAttribute('marker-end', on ? 'url(#arrow-on)' : 'url(#arrow)');
    });
    $('space').classList.toggle('dim', !!partId);
    const panel = $('panel');
    if (planView.isOpen()) {
        panel.hidden = true;
        panel.replaceChildren();
        clearHighlight();
        planView.selectionChanged();
        if (partId)
            reveal(partId);
        return;
    }
    if (!partId) {
        panel.hidden = true;
        panel.replaceChildren();
        clearHighlight();
        return;
    }
    panel.hidden = false;
    renderPanel(changed);
    reveal(partId);
    if (pendingRecord) {
        const id = pendingRecord;
        pendingRecord = null;
        openRecord(id);
    }
}
function clearHighlight() { document.querySelectorAll('.node.cited,.frame.cited').forEach(el => el.classList.remove('cited')); }
function highlightParts(ids) {
    clearHighlight();
    document.querySelectorAll('.node[data-part],.frame[data-part]').forEach(el => { if (ids.has(el.dataset.part))
        el.classList.add('cited'); });
}
function recordItem(o, r, showPart) {
    const part = showPart && r.partId ? o.view.parts.find(x => x.id === r.partId)?.name : null;
    return h('li', { class: 'record', id: `rec-${r.id}` }, h('details', {}, h('summary', {}, h('span', { class: 'rec-top' }, h('i', { class: `k-${r.kind}`, 'aria-hidden': 'true' }), h('span', { class: 'rec-kind' }, RECORD_LABEL[r.kind]), part ? h('span', { class: 'rec-part' }, part) : null, h('span', { class: 'rec-time', title: fullTime(r.at) }, ago(r.at))), h('span', { class: 'rec-line' }, firstLine(r.text, 120))), h('div', { class: 'rec-body' }, h('pre', {}, r.text), h('p', { class: 'rec-src' }, `${r.origin ?? (r.kind === 'request' ? '사용자가 개발 도구에 남긴 요청' : '전달받은 기록')} · ${fullTime(r.at)} · 받은 원문 그대로`))));
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
function renderPanel(scrollTop) {
    const o = opened, part = o.view.parts.find(p => p.id === selected), panel = $('panel');
    const prevBody = panel.querySelector('.panel-body'), keep = scrollTop ? 0 : prevBody?.scrollTop ?? 0;
    const path = partPath(o.view, part.id).slice(0, -1), records = subtreeRecords(o.view, part.id);
    const head = h('header', { class: 'panel-head' }, h('div', { class: 'panel-path' }, ...path.flatMap((x, i) => [h('a', { href: hashFor(o.key, x.id, scope) }, x.name), h('span', { 'aria-hidden': 'true' }, '›')]), path.length ? null : h('span', {}, o.project.name)), h('h2', { id: 'panel-title', tabindex: '-1' }, part.name), h('div', { class: 'panel-chips' }, h('span', { class: `chip s-${part.status}` }, h('i', { class: 'dot' }), STATUS_LABEL[part.status]), records.length ? h('span', { class: 'chip plain' }, `기록 ${records.length}${records[0] ? ` · ${ago(records[0].at)}` : ''}`) : null, o.kind !== 'legacy' ? h('button', { type: 'button', class: 'chip-button', onclick: () => { editing = !editing; renderPanel(false); } }, editing ? '고치기 닫기' : '이름·설명 고치기') : null, o.kind === 'saved' ? h('button', { type: 'button', class: 'chip-button tight', onclick: () => openPartForm(part.id) }, '안에 부분 추가') : null, part.childIds.length && part.id !== scope ? h('button', { type: 'button', class: 'chip-button tight go-in', onclick: () => go(o.key, null, part.id) }, `안으로 들어가기 · ${part.childIds.length}`, h('span', { 'aria-hidden': 'true' }, ' ›')) : null), h('button', { type: 'button', class: 'close', 'aria-label': '닫고 지도로', title: '닫기 (Esc)', onclick: () => go(o.key) }, '×'));
    const body = h('div', { class: 'panel-body' });
    if (editing)
        body.append(editForm(o, part));
    // 지금 상황
    const now = h('section', { class: 'sec' }, h('h3', {}, '지금 상황'));
    if (part.summary) {
        now.append(h('p', { class: 'summary' }, part.summary), h('p', { class: 'src' }, `${part.origin ?? '전달받은 정리'}${records.find(r => r.kind === 'report') ? ` · ${ago(records.find(r => r.kind === 'report').at)}` : ''}`));
        if (part.proposal)
            now.append(h('div', { class: 'proposal' }, h('strong', {}, '제안 · 아직 반영 안 됨'), h('span', {}, part.proposal)));
    }
    else if (records.length) {
        put(now, h('p', { class: 'summary muted' }, part.childIds.length ? '이 부분 자체에 대한 정리는 아직 없어요. 안의 부분과 기록을 보세요.' : '요청 기록은 있고, 아직 받은 작업 보고는 없어요.'), part.note ? h('p', { class: 'note' }, h('span', {}, '계획'), part.note) : null);
    }
    else {
        put(now, h('p', { class: 'summary muted' }, '아직 이 부분에 연결된 기록이 없어요.'), part.note ? h('p', { class: 'note' }, h('span', {}, '계획'), part.note) : null);
    }
    if (part.summary && part.note)
        now.append(h('p', { class: 'note' }, h('span', {}, '계획'), part.note));
    body.append(now);
    if (part.changes.length)
        body.append(h('section', { class: 'sec' }, h('h3', {}, '최근 변화'), h('ul', { class: 'changes' }, ...part.changes.map(c => h('li', {}, c)))));
    if (part.childIds.length)
        body.append(h('section', { class: 'sec' }, h('h3', {}, '안의 부분'), h('div', { class: 'kids' }, ...part.childIds.map(id => {
            const c = o.view.parts.find(x => x.id === id);
            return h('a', { class: `kid s-${c.status}`, href: hashFor(o.key, id, scope) }, h('i', { class: 'dot' }), h('span', {}, c.name), h('small', {}, c.lastAt ? ago(c.lastAt) : STATUS_SHORT[c.status]));
        }))));
    const links = o.view.relations.filter(r => r.from === part.id || r.to === part.id);
    if (links.length)
        body.append(h('section', { class: 'sec' }, h('h3', {}, '연결'), h('ul', { class: 'links' }, ...links.map(r => {
            const out = r.from === part.id, other = o.view.parts.find(x => x.id === (out ? r.to : r.from));
            return h('li', {}, h('a', { href: hashFor(o.key, other.id, scope) }, h('span', { class: 'dir' }, out ? '→' : '←'), h('strong', {}, other.name)), r.note ? h('span', { class: 'link-note' }, r.note) : null);
        }))));
    if (records.length) {
        const showAll = records.length <= 5, list = h('ol', { class: 'records' }, ...records.slice(0, showAll ? records.length : 4).map(r => recordItem(o, r, r.partId !== part.id)));
        const sec = h('section', { class: 'sec' }, h('h3', {}, '기록 ', h('small', {}, '개발 도구에서 받은 원문')), list);
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
        box.append(h('div', { class: 'ask-entry' }, h('button', { type: 'button', class: 'ask-open', 'aria-label': `‘${part.name}’에 대해 질문하기`, onclick: openBox }, `‘${part.name}’에 묻기…`), quickButtons));
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
catch { /* memory only */ } accessCodeMemory = value; }
/* ---------- change plan (plan-view.ts) on this map ---------- */
const planView = createPlanView({
    current: () => opened,
    kv,
    status: () => status,
    accessCode: () => sessionCode(), keepAccessCode,
    selected: () => selected,
    boxes: () => lay.boxes,
    selectPart: id => { if (opened)
        go(opened.key, id); },
    showPart: id => { const o = opened; if (o)
        go(o.key, id, partOf(o, id)?.parentId ?? null); },
    reveal,
    capture: () => ({ selected, scope, camera: { ...camera } }),
    notice: (text, action) => toast(text, action),
    frame: parts => {
        // Readable first: about 100% (never smaller than the person's own zoom above that). The whole view is centred when it
        // fits; otherwise the changed parts are, and the rest is a pan or 전체 보기 away. The camera comes back on close.
        const vp = $('viewport').getBoundingClientRect(), left = leftInset(), right = vp.width - PANEL_W() - 16, top = scope ? 64 : 24, bottom = vp.height - 72;
        const w = right - left, hgt = bottom - top, all = lay.bounds, base = Math.min(ZOOM_MAX, Math.max(1, camera.k));
        // A view only a little too wide may come down to 90% to fit whole; anything wider stays readable and is panned.
        const fitK = Math.min((w - 16) / Math.max(1, all.w), (hgt - 32) / Math.max(1, all.h)), k = fitK < base && fitK >= 0.9 ? fitK : base;
        const boxes = parts.map(id => lay.boxes.get(id)).filter((b) => !!b);
        const B = all.w * k <= w && all.h * k <= hgt || !boxes.length ? all : (() => {
            const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
            return { x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y };
        })();
        const x = B.w * k <= w ? left + (w - B.w * k) / 2 - B.x * k : left + 24 - B.x * k;
        const y = B.h * k <= hgt ? top + (hgt - B.h * k) / 2 - B.y * k : top + 24 - B.y * k;
        camera = { k, x, y };
        applyCamera(true);
    },
    restore: r => { const o = opened; if (!o)
        return; returnCamera = r.camera; go(o.key, r.selected, r.scope); },
    chrome: () => {
        const o = opened;
        if (!o)
            return;
        setBar(o);
        renderRecent();
        if (planView.isOpen()) {
            $('panel').hidden = true;
            $('panel').replaceChildren();
        }
        $('space').style.setProperty('--left-w', `${leftInset()}px`);
    }
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
        renderPanel(false);
        scrollThread();
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
    pill.dataset.state = status.ai;
    text.textContent = status.ai === 'deepseek' ? `AI 정리 · ${status.model ?? 'DeepSeek'}` : status.ai === 'off' ? 'AI 키 없음' : 'AI 서버 미연결';
    pill.title = status.ai === 'deepseek' ? '서버가 DeepSeek에 정리를 요청해요. 키는 서버에만 있어요.' : status.ai === 'off' ? '서버는 연결됐지만 AI 키가 설정되지 않았어요.' : '이 페이지에는 AI 서버가 연결되어 있지 않아요.';
}
/* ---------- canvas interaction ----------
 * Empty space: drag pans. A node or frame head: click selects, drag moves (frames carry their children; a child moves
 * inside its parent frame, which grows around it), double-click goes inside. Wheel zooms at the cursor (also Ctrl/⌘). */
let toastTimer = 0;
/** Double-click = two clicks on the same part, same view, same spot. */
let lastClick = { id: '', at: 0, x: 0, y: 0, scope: null };
function toast(text, action) {
    const t = $('toast');
    clearTimeout(toastTimer);
    t.replaceChildren();
    put(t, h('span', {}, text), action ? h('button', { type: 'button', class: 'link-button', onclick: () => { action.run(); t.hidden = true; } }, action.label) : null);
    t.hidden = false;
    toastTimer = window.setTimeout(() => { t.hidden = true; }, 8000);
}
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
function bindCanvas() {
    const vp = $('viewport');
    let drag = null;
    vp.addEventListener('pointerdown', e => {
        if (e.button !== 0)
            return;
        const target = e.target;
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
        zoomAt(camera.k * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    const center = () => { const r = vp.getBoundingClientRect(); return [(r.width - PANEL_W()) / 2, r.height / 2]; };
    $('zoom-in').addEventListener('click', () => { const [x, y] = center(); zoomAt(camera.k + 0.15, x, y, true); });
    $('zoom-out').addEventListener('click', () => { const [x, y] = center(); zoomAt(camera.k - 0.15, x, y, true); });
    $('zoom-fit').addEventListener('click', () => fitView(true, true));
    $('arrange').addEventListener('click', arrange);
    const help = $('help'), helpButton = $('help-toggle');
    helpButton.addEventListener('click', () => { help.hidden = !help.hidden; helpButton.setAttribute('aria-expanded', String(!help.hidden)); });
    $('recent-toggle').addEventListener('click', () => { if (selected)
        recentPeek = !recentPeek;
    else
        recentOpen = !recentOpen; if (opened)
        renderRecent(); });
    document.addEventListener('keydown', e => {
        if (e.target.closest('textarea,input'))
            return;
        if (e.key === 'Escape' && !help.hidden) {
            help.hidden = true;
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
        if (e.key === 'Escape' && opened && selected) {
            const key = opened.key, part = selected;
            go(key);
            requestAnimationFrame(() => document.querySelector(`[data-drag="${CSS.escape(part)}"]`)?.focus());
            return;
        }
        if (e.key === 'Escape' && opened && scope) {
            const o = opened, from = scope;
            go(o.key, null, partOf(o, from)?.parentId ?? null);
            requestAnimationFrame(() => document.querySelector(`[data-drag="${CSS.escape(from)}"]`)?.focus());
        }
    });
    let resize = 0;
    window.addEventListener('resize', () => { cancelAnimationFrame(resize); resize = requestAnimationFrame(() => { if (opened && !selected && !planView.isOpen())
        fitView(false); }); });
}
/* ---------- import (backup file → new saved copy; the file's bytes are validated as project data) ---------- */
function bindNewProject() {
    const name = $('new-name'), msg = $('home-message');
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
            say(`‘${project.name}’을 새 사본으로 가져왔어요.`);
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
    bindImport();
    bindNewProject();
    $('add-part').addEventListener('click', () => openPartForm(scope));
    $('plan-entry').addEventListener('click', () => planView.toggle());
    statusReady = aiStatus().then(s => { status = s; renderStatus(); planView.statusChanged(); if (opened && selected && !planView.isOpen())
        renderPanel(false); });
    window.addEventListener('hashchange', () => void render());
    await render();
    await statusReady;
}
void main();
