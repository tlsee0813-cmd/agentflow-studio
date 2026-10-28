/* The authoring context of a change-plan draft: which part was selected and which scope was being looked at when the person
 * first wrote it, so a word like '이 부분' or '여기' can be read against what they were looking at. It is a reading aid only: never
 * the change's target or the request's scope, never a source (INTENT/evidence), and never inferred later from today's screen.
 * Parts are kept by their stable id and the name they had then; a request names them by that request's own alias (P01, or an
 * example's key), so an alias is never stored and a renamed, removed or same-named other part is never taken for the original. */
import { clip } from './studio.js';

export const AUTHORING_VERSION = 'authoring-context.1';
/** A part as it was when the context was taken: its stable id and its name then. */
export interface ContextRef { id: string; name: string }
export interface AuthoringContext {
  projectId: string;
  /** The selected part (null: nothing selected). */
  selection: ContextRef | null;
  /** The scope whose inside was shown (null: the whole project). */
  scope: ContextRef | null;
  at: string;
  /** first-edit: taken by the draft's first edit; explicit: the person chose the screen they were on. */
  how: 'first-edit' | 'explicit';
}
/** open: a new draft not written yet (its first edit takes the context); set; removed by the person (stays removed, the next edit
 * does not take one again); unrecorded: a draft from before contexts were kept (nothing is filled in from today's screen). */
export type Authoring = { state: 'open' } | { state: 'set'; context: AuthoringContext } | { state: 'removed'; at: string } | { state: 'unrecorded' };
export type RefSlot = 'selection' | 'scope';
/** What a plan was analysed with: the draft's context as sent, and which of its parts the request could not name then. */
export interface AnalyzedWith { authoring: Authoring; missing: RefSlot[] }
export interface AuthoringRecord { version: typeof AUTHORING_VERSION; draft: Authoring; analyzed: AnalyzedWith | null }

/** What the screen shows now: the app's selection and scope (null: none / the whole project). */
export interface Screen { selected: string | null; scope: string | null }
interface PartLike { id: string; name: string }
const NAME_MAX = 200;

const UNRECORDED: Authoring = { state: 'unrecorded' };
/** A bundle saved before authoring contexts: its draft and plan are both unrecorded. */
export const legacyRecord = (hasPlan: boolean): AuthoringRecord => ({ version: AUTHORING_VERSION, draft: UNRECORDED, analyzed: hasPlan ? { authoring: UNRECORDED, missing: [] } : null });
export const openRecord = (): AuthoringRecord => ({ version: AUTHORING_VERSION, draft: { state: 'open' }, analyzed: null });

function refOf(parts: PartLike[], id: string | null): ContextRef | null {
  const p = id ? parts.find(x => x.id === id) : null;
  return p ? { id: p.id, name: clip(p.name, NAME_MAX) } : null;
}
/** The context of the screen as it is now. */
export function screenContext(projectId: string, parts: PartLike[], screen: Screen, how: AuthoringContext['how'], at = new Date().toISOString()): AuthoringContext {
  return { projectId, selection: refOf(parts, screen.selected), scope: refOf(parts, screen.scope), at, how };
}
/** The draft's first edit takes the context of the screen; any later edit, an emptied draft or a removed context keeps what is there. */
export function pinOnEdit(a: Authoring, draft: string, take: () => AuthoringContext): Authoring {
  return a.state === 'open' && draft !== '' ? { state: 'set', context: take() } : a;
}

/** How a kept part reads in the project now. same/renamed: the same id is here (renamed: under another name). unresolved: no part
 * with that id here (removed, archived, or the context belongs to another project); a part with the same name is not it. */
export type RefStatus = 'same' | 'renamed' | 'unresolved';
export interface Resolved { ref: ContextRef; status: RefStatus; now: string | null }
export function resolveRef(ref: ContextRef | null, projectId: string, ctxProject: string, parts: PartLike[]): Resolved | null {
  if (!ref) return null;
  const p = ctxProject === projectId ? parts.find(x => x.id === ref.id) : undefined;
  if (!p) return { ref, status: 'unresolved', now: null };
  const now = clip(p.name, NAME_MAX);
  return { ref, status: now === ref.name ? 'same' : 'renamed', now };
}

/* ---------- the request field (studio.plan.2) ---------- */
export interface AskRef { partId: string | null; nameThen: string; status: RefStatus }
export type AuthoringAsk = { state: 'recorded'; selection: AskRef | null; scope: AskRef | null } | { state: 'none' } | { state: 'unrecorded' };
/** The draft's context for one request: kept parts under this request's aliases (realId → alias), unresolved ones named as such.
 * missing: the slots that could not be named, kept with the plan so a later removal can be told from one already known. */
export function authoringAsk(a: Authoring, projectId: string, parts: PartLike[], alias: Map<string, string>): { ask: AuthoringAsk; missing: RefSlot[] } {
  if (a.state === 'unrecorded') return { ask: { state: 'unrecorded' }, missing: [] };
  if (a.state !== 'set') return { ask: { state: 'none' }, missing: [] };
  const missing: RefSlot[] = [];
  const one = (slot: RefSlot): AskRef | null => {
    const r = resolveRef(a.context[slot], projectId, a.context.projectId, parts); if (!r) return null;
    const partId = r.status === 'unresolved' ? null : alias.get(r.ref.id) ?? null;
    if (!partId) { missing.push(slot); return { partId: null, nameThen: r.ref.name, status: 'unresolved' }; }
    return { partId, nameThen: r.ref.name, status: r.status };
  };
  const selection = one('selection'), scope = one('scope');
  return { ask: { state: 'recorded', selection, scope }, missing };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keysAre = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const plain = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max && !!v.trim() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const idLike = (v: unknown): v is string => plain(v, 100) && /^[A-Za-z0-9_-]+$/.test(v);
const isoTime = (v: unknown): v is string => plain(v, 30) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;

/** The request field against the request's own parts: an alias must be one of them and its status must match its name there. */
export function validAuthoringAsk(v: unknown, parts: PartLike[]): boolean {
  if (!isObj(v)) return false;
  if (v.state === 'none' || v.state === 'unrecorded') return keysAre(v, ['state']);
  if (v.state !== 'recorded' || !keysAre(v, ['state', 'selection', 'scope'])) return false;
  return [v.selection, v.scope].every(r => {
    if (r === null) return true;
    if (!isObj(r) || !keysAre(r, ['partId', 'nameThen', 'status']) || !plain(r.nameThen, NAME_MAX)) return false;
    if (r.status === 'unresolved') return r.partId === null;
    const p = typeof r.partId === 'string' ? parts.find(x => x.id === r.partId) : undefined;
    return !!p && (r.status === 'same' ? p.name === r.nameThen : r.status === 'renamed' && p.name !== r.nameThen);
  });
}

/* ---------- stored form ---------- */
function parseRef(v: unknown): ContextRef | null {
  if (v === null) return null;
  if (!isObj(v) || !keysAre(v, ['id', 'name']) || !idLike(v.id) || !plain(v.name, NAME_MAX)) throw new Error('INVALID_AUTHORING');
  return { id: v.id, name: v.name };
}
function parseAuthoring(v: unknown): Authoring {
  const bad = () => new Error('INVALID_AUTHORING');
  if (!isObj(v)) throw bad();
  if (v.state === 'open' || v.state === 'unrecorded') { if (!keysAre(v, ['state'])) throw bad(); return { state: v.state }; }
  if (v.state === 'removed') { if (!keysAre(v, ['state', 'at']) || !isoTime(v.at)) throw bad(); return { state: 'removed', at: v.at }; }
  if (v.state !== 'set' || !keysAre(v, ['state', 'context'])) throw bad();
  const c = v.context;
  if (!isObj(c) || !keysAre(c, ['projectId', 'selection', 'scope', 'at', 'how']) || !idLike(c.projectId) || !isoTime(c.at) || !['first-edit', 'explicit'].includes(c.how as string)) throw bad();
  return { state: 'set', context: { projectId: c.projectId, selection: parseRef(c.selection), scope: parseRef(c.scope), at: c.at, how: c.how as AuthoringContext['how'] } };
}
/** Exactly the stored keys; anything else is refused (the bundle is then unreadable and kept as it was). */
export function parseAuthoringRecord(v: unknown, hasPlan: boolean): AuthoringRecord {
  const bad = () => new Error('INVALID_AUTHORING');
  if (!isObj(v) || !keysAre(v, ['version', 'draft', 'analyzed']) || v.version !== AUTHORING_VERSION) throw bad();
  const draft = parseAuthoring(v.draft);
  let analyzed: AnalyzedWith | null = null;
  if (v.analyzed !== null) {
    const x = v.analyzed;
    if (!isObj(x) || !keysAre(x, ['authoring', 'missing']) || !Array.isArray(x.missing) || x.missing.length > 2
      || !x.missing.every(m => m === 'selection' || m === 'scope') || new Set(x.missing).size !== x.missing.length) throw bad();
    analyzed = { authoring: parseAuthoring(x.authoring), missing: x.missing as RefSlot[] };
  }
  if (!hasPlan && analyzed) throw bad();
  return { version: AUTHORING_VERSION, draft, analyzed };
}

/* ---------- is the plan still the analysis of this context? ---------- */
/** What makes two contexts the same basis: the same state and the same stable ids (not the names then, the time or how). */
const basisOf = (a: Authoring) => (a.state === 'set' ? JSON.stringify([a.context.projectId, a.context.selection?.id ?? null, a.context.scope?.id ?? null])
  : a.state === 'unrecorded' ? 'unrecorded' : 'none');
/** context: the draft's context is not the one the plan was analysed with (changed, removed, or set where there was none).
 * missing: a part the analysis could name is no longer in the project. A rename or moving around the map is neither. */
export function authoringStale(r: AuthoringRecord, projectId: string, parts: PartLike[]): 'context' | 'missing' | null {
  if (!r.analyzed) return null;
  if (basisOf(r.draft) !== basisOf(r.analyzed.authoring)) return 'context';
  const a = r.analyzed.authoring;
  if (a.state !== 'set') return null;
  for (const slot of ['selection', 'scope'] as const) {
    if (r.analyzed.missing.includes(slot)) continue;
    if (resolveRef(a.context[slot], projectId, a.context.projectId, parts)?.status === 'unresolved') return 'missing';
  }
  return null;
}
