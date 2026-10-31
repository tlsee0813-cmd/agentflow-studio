/* The authoring context of a change-plan draft: which part was selected and which scope was being looked at when the person
 * first wrote it, so a word like '이 부분' or '여기' can be read against what they were looking at. It is a reading aid only: never
 * the change's target or the request's scope, never a source (INTENT/evidence), and never inferred later from today's screen.
 * Parts are kept by their stable id and the name they had then; a request names them by that request's own alias (P01, or an
 * example's key), so an alias is never stored and a renamed, removed or same-named other part is never taken for the original. */
import { clip } from './studio.js';
export const AUTHORING_VERSION = 'authoring-context.1';
const NAME_MAX = 200;
const UNRECORDED = { state: 'unrecorded' };
/** A bundle saved before authoring contexts: its draft and plan are both unrecorded. */
export const legacyRecord = (hasPlan) => ({ version: AUTHORING_VERSION, draft: UNRECORDED, analyzed: hasPlan ? { authoring: UNRECORDED, missing: [] } : null });
export const openRecord = () => ({ version: AUTHORING_VERSION, draft: { state: 'open' }, analyzed: null });
function refOf(parts, id) {
    const p = id ? parts.find(x => x.id === id) : null;
    return p ? { id: p.id, name: clip(p.name, NAME_MAX) } : null;
}
/** The context of the screen as it is now. */
export function screenContext(projectId, parts, screen, how, at = new Date().toISOString()) {
    return { projectId, selection: refOf(parts, screen.selected), scope: refOf(parts, screen.scope), at, how };
}
/** The draft's first edit takes the context of the screen; any later edit, an emptied draft or a removed context keeps what is there. */
export function pinOnEdit(a, draft, take) {
    return a.state === 'open' && draft !== '' ? { state: 'set', context: take() } : a;
}
export function resolveRef(ref, projectId, ctxProject, parts) {
    if (!ref)
        return null;
    const p = ctxProject === projectId ? parts.find(x => x.id === ref.id) : undefined;
    if (!p)
        return { ref, status: 'unresolved', now: null };
    const now = clip(p.name, NAME_MAX);
    return { ref, status: now === ref.name ? 'same' : 'renamed', now };
}
/** The draft's context for one request: kept parts under this request's aliases (realId → alias), unresolved ones named as such.
 * missing: the slots that could not be named, kept with the plan so a later removal can be told from one already known. */
export function authoringAsk(a, projectId, parts, alias) {
    if (a.state === 'unrecorded')
        return { ask: { state: 'unrecorded' }, missing: [] };
    if (a.state !== 'set')
        return { ask: { state: 'none' }, missing: [] };
    const missing = [];
    const one = (slot) => {
        const r = resolveRef(a.context[slot], projectId, a.context.projectId, parts);
        if (!r)
            return null;
        const partId = r.status === 'unresolved' ? null : alias.get(r.ref.id) ?? null;
        if (!partId) {
            missing.push(slot);
            return { partId: null, nameThen: r.ref.name, status: 'unresolved' };
        }
        return { partId, nameThen: r.ref.name, status: r.status };
    };
    const selection = one('selection'), scope = one('scope');
    return { ask: { state: 'recorded', selection, scope }, missing };
}
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const keysAre = (v, keys) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const plain = (v, max) => typeof v === 'string' && v.length <= max && !!v.trim() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const idLike = (v) => plain(v, 100) && /^[A-Za-z0-9_-]+$/.test(v);
const isoTime = (v) => plain(v, 30) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
/** The request field against the request's own parts: an alias must be one of them and its status must match its name there. */
export function validAuthoringAsk(v, parts) {
    if (!isObj(v))
        return false;
    if (v.state === 'none' || v.state === 'unrecorded')
        return keysAre(v, ['state']);
    if (v.state !== 'recorded' || !keysAre(v, ['state', 'selection', 'scope']))
        return false;
    return [v.selection, v.scope].every(r => {
        if (r === null)
            return true;
        if (!isObj(r) || !keysAre(r, ['partId', 'nameThen', 'status']) || !plain(r.nameThen, NAME_MAX))
            return false;
        if (r.status === 'unresolved')
            return r.partId === null;
        const p = typeof r.partId === 'string' ? parts.find(x => x.id === r.partId) : undefined;
        return !!p && (r.status === 'same' ? p.name === r.nameThen : r.status === 'renamed' && p.name !== r.nameThen);
    });
}
/* ---------- stored form ---------- */
function parseRef(v) {
    if (v === null)
        return null;
    if (!isObj(v) || !keysAre(v, ['id', 'name']) || !idLike(v.id) || !plain(v.name, NAME_MAX))
        throw new Error('INVALID_AUTHORING');
    return { id: v.id, name: v.name };
}
function parseAuthoring(v) {
    const bad = () => new Error('INVALID_AUTHORING');
    if (!isObj(v))
        throw bad();
    if (v.state === 'open' || v.state === 'unrecorded') {
        if (!keysAre(v, ['state']))
            throw bad();
        return { state: v.state };
    }
    if (v.state === 'removed') {
        if (!keysAre(v, ['state', 'at']) || !isoTime(v.at))
            throw bad();
        return { state: 'removed', at: v.at };
    }
    if (v.state !== 'set' || !keysAre(v, ['state', 'context']))
        throw bad();
    const c = v.context;
    if (!isObj(c) || !keysAre(c, ['projectId', 'selection', 'scope', 'at', 'how']) || !idLike(c.projectId) || !isoTime(c.at) || !['first-edit', 'explicit'].includes(c.how))
        throw bad();
    return { state: 'set', context: { projectId: c.projectId, selection: parseRef(c.selection), scope: parseRef(c.scope), at: c.at, how: c.how } };
}
/** Exactly the stored keys; anything else is refused (the bundle is then unreadable and kept as it was). */
export function parseAuthoringRecord(v, hasPlan) {
    const bad = () => new Error('INVALID_AUTHORING');
    if (!isObj(v) || !keysAre(v, ['version', 'draft', 'analyzed']) || v.version !== AUTHORING_VERSION)
        throw bad();
    const draft = parseAuthoring(v.draft);
    let analyzed = null;
    if (v.analyzed !== null) {
        const x = v.analyzed;
        if (!isObj(x) || !keysAre(x, ['authoring', 'missing']) || !Array.isArray(x.missing) || x.missing.length > 2
            || !x.missing.every(m => m === 'selection' || m === 'scope') || new Set(x.missing).size !== x.missing.length)
            throw bad();
        analyzed = { authoring: parseAuthoring(x.authoring), missing: x.missing };
    }
    if (!hasPlan && analyzed)
        throw bad();
    return { version: AUTHORING_VERSION, draft, analyzed };
}
/* ---------- is the plan still the analysis of this context? ---------- */
/** What makes two contexts the same basis: the same state and the same stable ids (not the names then, the time or how). */
const basisOf = (a) => (a.state === 'set' ? JSON.stringify([a.context.projectId, a.context.selection?.id ?? null, a.context.scope?.id ?? null])
    : a.state === 'unrecorded' ? 'unrecorded' : 'none');
/** context: the draft's context is not the one the plan was analysed with (changed, removed, or set where there was none).
 * missing: a part the analysis could name is no longer in the project. A rename or moving around the map is neither. */
export function authoringStale(r, projectId, parts) {
    if (!r.analyzed)
        return null;
    if (basisOf(r.draft) !== basisOf(r.analyzed.authoring))
        return 'context';
    const a = r.analyzed.authoring;
    if (a.state !== 'set')
        return null;
    for (const slot of ['selection', 'scope']) {
        if (r.analyzed.missing.includes(slot))
            continue;
        if (resolveRef(a.context[slot], projectId, a.context.projectId, parts)?.status === 'unresolved')
            return 'missing';
    }
    return null;
}
