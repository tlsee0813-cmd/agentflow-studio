/* studio.map.1: reading records into the map. The browser sends the map as it is (parts by alias, the person's own words, what
 * earlier readings understood) and the records not yet read; the model answers with parts, claims and relations, each resting on
 * an exact quote of what was sent. applyReading is the only write: it adds parts and relations and keeps one MapReading with the
 * derived understanding. It never renames, moves, archives or re-describes an existing part, never writes Area.note and never
 * touches space.understanding (return.2 and its anchors). What is unclear stays a candidate; nothing asks for approval per part. */
import { CLAIM_KINDS, READINGS_LIMIT, isMapReading, type ClaimKind, type MapReading, type Project, type ReadingCandidate, type ReadingClaim, type ReadingPart, type ReadingQuote, type ReadingRelation, type ReadingSkip, type RelationKind } from './types.js';
import type { StudioView, RecordView } from './studio.js';
import { addArea, addChildArea, addRelation, addReading } from './domain.js';
import { parseProject } from './validation.js';
import { quoteAt } from './digest-api.js';
import { secretLike } from './secret.js';

export const MAP_SCHEMA = 'studio.map.1' as const;
/** The server reads at most this many bytes of a request (the studio routes share one limit). */
export const MAP_BYTES = 65536;
export const MAP_RECORDS = 4;
export const MAP_RECORD_CHARS = 12000;
const MIN_RECORD_CHARS = 1500, META_BYTES = 30000;
export const CLAIM_LABEL: Record<ClaimKind, string> = {
  want: '원함', idea: '구상', reported: '구현 보고', checked: '확인 보고', describes: '설명', open: '남은 선택', differs: '다른 근거'
};
/** One short state for a part that has no request of its own yet, from what was read (never a verified status). */
export const STATE_LABEL: Partial<Record<ClaimKind, string>> = { reported: '구현 보고 있음', checked: '확인 보고 있음', want: '요구', idea: '구상', describes: '설명만 있음' };
const STATE_ORDER: ClaimKind[] = ['reported', 'checked', 'want', 'idea', 'describes'];
const RELS: RelationKind[] = ['flow', 'needs', 'shares', 'related'];

export interface MapAskPart { id: string; name: string; note: string; parentId: string | null; readAs: string | null; role: string; roleBy: 'reading' | 'person' | null; current: { key: string; kind: ClaimKind; text: string }[] }
export interface MapAskRecord { id: string; kind: 'pasted' | RecordView['kind']; text: string; note: string; basis: string }
export interface MapAsk {
  schemaVersion: typeof MAP_SCHEMA;
  project: { name: string; purpose: string | null };
  parts: MapAskPart[];
  relations: { from: string; to: string; kind: RelationKind; note: string }[];
  records: MapAskRecord[];
}
export interface MapReplyQuote { record: string; quote: string }
export interface MapReplyClaim { kind: ClaimKind; text: string; record: string; quote: string; about: string | null; replaces: string | null }
export interface MapReplyPart { ref: string; name: string | null; parent: string | null; role: string | null; basis: MapReplyQuote[]; claims: MapReplyClaim[] }
export interface MapReply {
  summary: string;
  parts: MapReplyPart[];
  relations: { from: string; to: string; kind: RelationKind; note: string; record: string; quote: string }[];
  candidates: { text: string; parts: string[]; record: string | null; quote: string | null }[];
  gaps: string[];
}

const PART = /^P\d{2,3}$/, NEW = /^new:[a-z0-9_-]{1,24}$/, RECORD = /^[NR]\d{2,3}$/, CLAIM = /^C\d{2,3}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
const clean = (t: string) => t.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
const cut = (t: string, n: number) => { if (t.length <= n) return t; const c = t.charCodeAt(n - 1); return t.slice(0, c >= 0xd800 && c <= 0xdbff ? n - 1 : n); };
export const normName = (n: string) => n.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
function check(ok: unknown, code = 'INVALID_INPUT'): asserts ok { if (!ok) throw new Error(code); }
function obj(v: unknown, keys: string[], code?: string): asserts v is Record<string, unknown> {
  check(!!v && typeof v === 'object' && !Array.isArray(v), code);
  check(Object.keys(v as object).length === keys.length && keys.every(k => Object.hasOwn(v as object, k)), code);
}
function str(v: unknown, max: number, empty = false, code?: string): asserts v is string {
  check(typeof v === 'string' && v.length <= max && (empty || !!v.trim()) && !CONTROL.test(v), code);
}
function arr(v: unknown, max: number, code?: string): asserts v is unknown[] { check(Array.isArray(v) && v.length <= max, code); }

/** The whole request within MAP_BYTES of UTF-8 JSON; known aliases, parents and claim keys; nothing is clipped here. */
export function validateMapAsk(value: unknown): MapAsk {
  obj(value, ['schemaVersion', 'project', 'parts', 'relations', 'records']);
  if (value.schemaVersion !== MAP_SCHEMA) throw new Error('UNSUPPORTED_VERSION');
  if (bytes(value) > MAP_BYTES) throw new Error('INPUT_TOO_LARGE');
  obj(value.project, ['name', 'purpose']); str(value.project.name, 120); if (value.project.purpose !== null) str(value.project.purpose, 2000);
  arr(value.parts, 200);
  const parts = new Set<string>(), claims = new Set<string>();
  for (const p of value.parts) {
    obj(p, ['id', 'name', 'note', 'parentId', 'readAs', 'role', 'roleBy', 'current']); check(typeof p.id === 'string' && PART.test(p.id) && !parts.has(p.id)); parts.add(p.id);
    str(p.name, 60); str(p.note, 2000, true); if (p.readAs !== null) str(p.readAs, 60); str(p.role, 300, true);
    check(p.roleBy === null ? p.role === '' : (p.roleBy === 'reading' || p.roleBy === 'person') && !!(p.role as string).trim());
    arr(p.current, 8); for (const c of p.current) { obj(c, ['key', 'kind', 'text']); check(typeof c.key === 'string' && CLAIM.test(c.key) && !claims.has(c.key)); claims.add(c.key); check(CLAIM_KINDS.includes(c.kind as ClaimKind)); str(c.text, 240); }
  }
  for (const p of value.parts as MapAskPart[]) check(p.parentId === null || (parts.has(p.parentId) && p.parentId !== p.id));
  arr(value.relations, 400);
  for (const r of value.relations) { obj(r, ['from', 'to', 'kind', 'note']); check(parts.has(r.from as string) && parts.has(r.to as string) && r.from !== r.to && RELS.includes(r.kind as RelationKind)); str(r.note, 200, true); }
  arr(value.records, MAP_RECORDS); check(value.records.length > 0);
  const records = new Set<string>();
  for (const r of value.records) {
    obj(r, ['id', 'kind', 'text', 'note', 'basis']); check(typeof r.id === 'string' && RECORD.test(r.id) && !records.has(r.id)); records.add(r.id);
    check(['pasted', 'request', 'report', 'evidence', 'answer', 'decision'].includes(r.kind as string)); str(r.text, MAP_RECORD_CHARS); str(r.note, 600, true); str(r.basis, 300);
  }
  return structuredClone(value as unknown as MapAsk);
}

/** Exact keys and bounds; every part, claim and relation rests on a quote found in what was sent; known aliases only; new parts
 * named and grounded, with parents among known or new parts and no cycle; nothing in the reply looks like a key. Containment is
 * all this checks: not that a reading is right. */
export function validateMapReply(value: unknown, ask: MapAsk): MapReply {
  const code = 'INVALID_RESPONSE';
  obj(value, ['summary', 'parts', 'relations', 'candidates', 'gaps'], code);
  const parts = new Map(ask.parts.map(p => [p.id, p])), records = new Map(ask.records.map(r => [r.id, r]));
  const quote = (rec: unknown, q: unknown): MapReplyQuote => {
    check(typeof rec === 'string' && records.has(rec), code); str(q, 300, false, code);
    const t = (q as string).trim(); check(t.length >= 6 && !!quoteAt(records.get(rec)!.text, t), code);
    return { record: rec, quote: t };
  };
  str(value.summary, 200, true, code);
  arr(value.parts, 32, code);
  const refs = new Set<string>(), news = new Map<string, string | null>();
  for (const p of value.parts) { obj(p, ['ref', 'name', 'parent', 'role', 'basis', 'claims'], code); check(typeof p.ref === 'string' && (parts.has(p.ref) || NEW.test(p.ref)) && !refs.has(p.ref), code); refs.add(p.ref as string); if (NEW.test(p.ref as string)) news.set(p.ref as string, p.parent as string | null); }
  check(news.size <= 16, code);
  const outParts: MapReplyPart[] = (value.parts as Record<string, unknown>[]).map(p => {
    const ref = p.ref as string, fresh = news.has(ref);
    if (fresh) {
      str(p.name, 60, false, code);
      check(p.parent === null || (typeof p.parent === 'string' && (parts.has(p.parent) || (news.has(p.parent) && p.parent !== ref))), code);
    } else check(p.name === null && p.parent === null, code);
    if (p.role !== null) str(p.role, 300, false, code);
    arr(p.basis, 4, code); check(!fresh || (p.basis as unknown[]).length > 0, code);
    const basis = (p.basis as unknown[]).map(b => { obj(b, ['record', 'quote'], code); return quote(b.record, b.quote); });
    arr(p.claims, 6, code);
    const own = new Set(parts.get(ref)?.current.map(c => c.key) ?? []);
    const claims = (p.claims as unknown[]).map((c): MapReplyClaim => {
      obj(c, ['kind', 'text', 'record', 'quote', 'about', 'replaces'], code);
      check(CLAIM_KINDS.includes(c.kind as ClaimKind), code); str(c.text, 240, false, code);
      const q = quote(c.record, c.quote);
      if (c.about !== null) str(c.about, 80, false, code);
      check(c.replaces === null || (typeof c.replaces === 'string' && own.has(c.replaces)), code);
      return { kind: c.kind as ClaimKind, text: c.text.trim(), record: q.record, quote: q.quote, about: c.about === null ? null : (c.about as string).trim(), replaces: c.replaces as string | null };
    });
    check(fresh || p.role !== null || claims.length > 0, code);
    return { ref, name: fresh ? (p.name as string).trim() : null, parent: fresh ? p.parent as string | null : null, role: p.role === null ? null : (p.role as string).trim(), basis, claims };
  });
  // New parts form a forest under known parts: no cycle among them.
  for (const ref of news.keys()) { const seen = new Set<string>(); for (let x: string | null | undefined = ref; x && news.has(x); x = news.get(x)) { check(!seen.has(x), code); seen.add(x); } }
  arr(value.relations, 16, code);
  const ends = new Set([...parts.keys(), ...news.keys()]);
  const relations = (value.relations as unknown[]).map(r => {
    obj(r, ['from', 'to', 'kind', 'note', 'record', 'quote'], code);
    check(typeof r.from === 'string' && typeof r.to === 'string' && ends.has(r.from) && ends.has(r.to) && r.from !== r.to && RELS.includes(r.kind as RelationKind), code);
    str(r.note, 200, true, code); const q = quote(r.record, r.quote);
    return { from: r.from, to: r.to, kind: r.kind as RelationKind, note: r.note.trim(), record: q.record, quote: q.quote };
  });
  arr(value.candidates, 6, code);
  const candidates = (value.candidates as unknown[]).map(c => {
    obj(c, ['text', 'parts', 'record', 'quote'], code); str(c.text, 240, false, code);
    arr(c.parts, 2, code); for (const x of c.parts) check(typeof x === 'string' && parts.has(x), code); check(new Set(c.parts).size === c.parts.length, code);
    check((c.record === null) === (c.quote === null), code);
    const q = c.record === null ? null : quote(c.record, c.quote);
    return { text: c.text.trim(), parts: [...c.parts as string[]], record: q?.record ?? null, quote: q?.quote ?? null };
  });
  arr(value.gaps, 2, code); const gaps = (value.gaps as unknown[]).map(g => { str(g, 160, false, code); return (g as string).trim(); });
  const reply: MapReply = { summary: value.summary.trim(), parts: outParts, relations, candidates, gaps };
  // Words the model wrote (never the quotes, which are the person's own records) must not look like a key.
  const written = [reply.summary, ...gaps, ...outParts.flatMap(p => [p.name ?? '', p.role ?? '', ...p.claims.flatMap(c => [c.text, c.about ?? ''])]), ...relations.map(r => r.note), ...candidates.map(c => c.text)];
  check(!written.some(w => w && secretLike(w)), code);
  return reply;
}

/* ---------- what earlier readings understood, per part ---------- */
export interface CurrentClaim extends ReadingClaim { reading: string; index: number; at: string }
export interface PartUnderstanding {
  /** The current description: the person's correction when there is one, else the responsibility as read most recently. */
  role: string | null;
  /** The person corrected the description (it stays until they correct it again); a reading's later description reads apart. */
  corrected: { id: string; at: string } | null;
  laterRole: string | null;
  /** Current claims, newest reading first: superseded ones and repeats of the same words are left out. */
  claims: CurrentClaim[];
  /** Each reading that said something about this part, oldest first (the evidence history, apart from the current view). */
  history: { reading: string; at: string; role: string | null; claims: ReadingClaim[]; basis: ReadingQuote[] }[];
  /** The part was added by a reading: the name it was added with (the person may have renamed it since). */
  createdName: string | null;
  state: ClaimKind | null;
}
const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
export function partUnderstanding(p: Project, areaId: string): PartUnderstanding | null {
  const history: PartUnderstanding['history'] = []; let createdName: string | null = null, role: string | null = null, laterRole: string | null = null;
  let corrected: PartUnderstanding['corrected'] = null;
  const all: CurrentClaim[] = [], replaced = new Set<string>();
  for (const r of p.readings) {
    if (!isMapReading(r)) { if (r.areaId === areaId) { role = r.text; corrected = { id: r.id, at: r.at }; laterRole = null; } continue; }
    const part = r.parts.find(x => x.areaId === areaId); if (!part) continue;
    if (part.created) createdName = part.created.name;
    // A correction holds the description only: a later reading's description reads apart, its claims still come in.
    if (part.role) { if (corrected) laterRole = part.role; else role = part.role; }
    history.push({ reading: r.id, at: r.at, role: part.role, claims: part.claims, basis: part.basis });
    part.claims.forEach((c, index) => { all.push({ ...c, reading: r.id, index, at: r.at }); if (c.replaces) replaced.add(`${c.replaces.reading}:${c.replaces.index}`); });
  }
  if (!history.length) return null;
  const seen = new Set<string>(), claims: CurrentClaim[] = [];
  for (const c of all.reverse()) {
    const key = `${c.kind}|${norm(c.text)}`;
    if (replaced.has(`${c.reading}:${c.index}`) || seen.has(key)) continue;
    seen.add(key); claims.push(c);
  }
  const state = STATE_ORDER.find(k => claims.some(c => c.kind === k)) ?? null;
  return { role, corrected, laterRole, claims: claims.slice(0, 12), history, createdName, state };
}

/* ---------- the request ---------- */
export interface MapRecordSource { id: string; kind: MapAskRecord['kind']; text: string; at: string; label: string }
export interface MapInput {
  ask: MapAsk;
  /** alias → area id, record id, earlier claim */
  parts: Map<string, string>; records: Map<string, { id: string; sent: number; total: number; text: string }>; claims: Map<string, { reading: string; index: number }>;
  /** Records not yet read, how many go now, and how many go only in part. */
  coverage: { fresh: number; sent: number; partial: number };
  /** The last reading when this request was made: an answer is applied only on top of it. */
  after: string | null;
  problem: 'NOTHING_NEW' | 'TOO_LARGE' | { secret: string } | null;
}
/** Records of a project not yet read by any map reading, newest first: pasted records as pasted, and the project's own records. */
export function unreadRecords(p: Project, view: StudioView): MapRecordSource[] {
  const read = new Set(p.readings.filter(isMapReading).flatMap(r => r.records.map(x => x.id)));
  const pasted: MapRecordSource[] = p.pasted.map(r => ({ id: r.id, kind: 'pasted', text: r.text, at: r.at, label: '붙여넣은 기록' }));
  const own: MapRecordSource[] = view.records.map(r => ({ id: r.id, kind: r.kind, text: r.text, at: r.at, label: '프로젝트 기록' }));
  return [...pasted, ...own].filter(r => !read.has(r.id)).sort((a, b) => b.at.localeCompare(a.at));
}
export function buildMapAsk(p: Project, view: StudioView): MapInput {
  const parts = new Map<string, string>(), alias = new Map<string, string>(), claims = new Map<string, { reading: string; index: number }>();
  view.parts.slice(0, 200).forEach((x, i) => { const a = `P${String(i + 1).padStart(2, '0')}`; parts.set(a, x.id); alias.set(x.id, a); });
  let c = 0;
  const askParts: MapAskPart[] = view.parts.slice(0, 200).map(x => {
    const u = partUnderstanding(p, x.id);
    const current = (u?.claims ?? []).slice(0, 6).map(cl => { const key = `C${String(++c).padStart(2, '0')}`; claims.set(key, { reading: cl.reading, index: cl.index }); return { key, kind: cl.kind, text: cut(cl.text, 240) }; });
    return { id: alias.get(x.id)!, name: x.name, note: cut(clean(x.note), 2000), parentId: x.parentId ? alias.get(x.parentId) ?? null : null,
      readAs: u?.createdName && normName(u.createdName) !== normName(x.name) ? u.createdName : null, role: cut(u?.role ?? '', 300), roleBy: u?.role ? (u.corrected ? 'person' : 'reading') : null, current };
  });
  const ask: MapAsk = {
    schemaVersion: MAP_SCHEMA,
    project: { name: cut(p.name, 120), purpose: p.space.brief ? cut(clean(p.space.brief.text), 2000) : null },
    parts: askParts,
    relations: view.relations.filter(r => alias.has(r.from) && alias.has(r.to)).slice(0, 400).map(r => ({ from: alias.get(r.from)!, to: alias.get(r.to)!, kind: r.kind, note: cut(r.note, 200) })),
    records: []
  };
  const unread = unreadRecords(p, view), records = new Map<string, { id: string; sent: number; total: number; text: string }>();
  const input: MapInput = { ask, parts, records, claims, coverage: { fresh: unread.length, sent: 0, partial: 0 }, after: p.readings.filter(isMapReading).at(-1)?.id ?? null, problem: null };
  if (!unread.length) return { ...input, problem: 'NOTHING_NEW' };
  // Structure first, bounded: the earlier understanding of each part shrinks before any record is left out.
  for (const x of ask.parts) if (bytes(ask) > META_BYTES) { x.current = x.current.slice(0, 2); x.role = cut(x.role, 120); }
  if (bytes(ask) > META_BYTES) return { ...input, problem: 'TOO_LARGE' };
  let n = { N: 0, R: 0 };
  for (const r of unread) {
    if (ask.records.length >= MAP_RECORDS) break;
    const letter = r.kind === 'pasted' ? 'N' : 'R', id = `${letter}${String(++n[letter]).padStart(2, '0')}`;
    let text = cut(clean(r.text), MAP_RECORD_CHARS);
    const rec: MapAskRecord = { id, kind: r.kind, text, note: '', basis: `${r.label} · ${r.at} (가져온 시각이며 원문 작성·판본 시각이 아님)` };
    const note = () => (text.length < r.text.length ? `원문 ${r.text.length}자 중 앞 ${text.length}자만 보냄` : '');
    rec.note = note(); ask.records.push(rec);
    // A record takes the room that is left, down to a readable excerpt; one that cannot is left for the next reading.
    for (let g = 0; bytes(ask) > MAP_BYTES - 256 && text.length > MIN_RECORD_CHARS && g < 40; g++) { text = cut(text, Math.floor(text.length * 0.9)); rec.text = text; rec.note = note(); }
    if (bytes(ask) > MAP_BYTES - 256) { ask.records.pop(); n[letter]--; break; }
    records.set(id, { id: r.id, sent: text.length, total: r.text.length, text });
  }
  input.coverage = { fresh: unread.length, sent: ask.records.length, partial: [...records.values()].filter(x => x.sent < x.total).length };
  if (!ask.records.length) return { ...input, problem: 'TOO_LARGE' };
  const leak = ask.records.find(x => secretLike(x.text));
  if (leak) return { ...input, problem: { secret: leak.id } };
  return input;
}

/* ---------- the one write ---------- */
export interface Applied { project: Project; reading: MapReading; created: string[]; touched: string[] }
/** Applies a validated reply on top of the project it was asked about, atomically: either every part, relation and the reading
 * are kept, or nothing is (the result is re-read by parseProject). Refused when another reading was applied meanwhile or a part
 * the reply names has gone; edits the person made meanwhile (names, notes, places, plans, records) are kept as they are. */
export function applyReading(project: Project, input: MapInput, reply: MapReply, meta: { id: string; at: string; model: string; prompt: string; hash: string }): Applied {
  const done = project.readings.filter(isMapReading);
  if ((done.at(-1)?.id ?? null) !== input.after) throw new Error('MAP_CHANGED');
  if (done.some(r => r.hash === meta.hash)) throw new Error('ALREADY_APPLIED');
  if (project.readings.length >= READINGS_LIMIT) throw new Error('READINGS_FULL');
  const active = (id: string) => project.space.areas.some(a => a.id === id && !a.archived);
  for (const id of input.parts.values()) if (!active(id)) throw new Error('MAP_CHANGED');
  const real = (q: MapReplyQuote): ReadingQuote => ({ record: input.records.get(q.record)!.id, quote: q.quote });
  const claimOf = (c: MapReplyClaim): ReadingClaim => ({ kind: c.kind, text: c.text, ...real(c), about: c.about, replaces: c.replaces ? input.claims.get(c.replaces)! : null });
  let p = project;
  const ids = new Map(input.parts), skipped: ReadingSkip[] = [], candidates: ReadingCandidate[] = [], parts: ReadingPart[] = [], created: string[] = [];
  const parentOf = (id: string) => p.space.containment.parents[id] ?? null;
  const madeBefore = done.flatMap(r => r.parts.filter(x => x.created).map(x => ({ areaId: x.areaId, ...x.created! })));
  // New parts, parents first (the reply's own order otherwise).
  const queue = reply.parts.filter(x => x.name !== null), dropped = new Set<string>();
  for (let guard = 0; queue.length && guard < 64; guard++) {
    for (let i = 0; i < queue.length; i++) {
      const x = queue[i]!; if (x.parent && !ids.has(x.parent) && !dropped.has(x.parent)) continue;
      queue.splice(i--, 1);
      if (x.parent && dropped.has(x.parent)) { dropped.add(x.ref); skipped.push({ what: 'part', name: x.name!, reason: 'parent-skipped' }); continue; }
      const parentId = x.parent ? ids.get(x.parent)! : null, key = normName(x.name!);
      const same = p.space.areas.find(a => !a.archived && parentOf(a.id) === parentId && normName(a.name) === key)
        ?? madeBefore.map(m => p.space.areas.find(a => a.id === m.areaId && !a.archived && m.parentId === parentId && normName(m.name) === key)).find(Boolean);
      if (same) {
        // Not the same thing by its name alone: the new one is not added, and nothing is attached to the existing one.
        dropped.add(x.ref); skipped.push({ what: 'part', name: x.name!, reason: 'same-name' });
        candidates.push({ text: `‘${x.name}’: 같은 이름의 부분이 이미 있어 새로 만들지 않았어요. 같은 대상인지는 원문으로 확인해 주세요.`, areaIds: [same.id], quote: real(x.basis[0]!) });
        continue;
      }
      if (madeBefore.some(m => m.parentId === parentId && normName(m.name) === key && p.space.areas.some(a => a.id === m.areaId && a.archived))) {
        dropped.add(x.ref); skipped.push({ what: 'part', name: x.name!, reason: 'archived' }); continue;
      }
      p = parentId ? addChildArea(p, parentId, x.name!, '') : addArea(p, x.name!, '');
      const id = p.space.areas.at(-1)!.id; ids.set(x.ref, id); created.push(id);
      parts.push({ areaId: id, created: { name: p.space.areas.at(-1)!.name, parentId }, role: x.role, basis: x.basis.map(real), claims: x.claims.map(claimOf) });
    }
  }
  for (const x of reply.parts) if (x.name === null) parts.push({ areaId: ids.get(x.ref)!, created: null, role: x.role, basis: x.basis.map(real), claims: x.claims.map(claimOf) });
  const relations: ReadingRelation[] = [];
  const madeRelations = done.flatMap(r => r.relations);
  for (const r of reply.relations) {
    const from = ids.get(r.from), to = ids.get(r.to), name = `${r.from}→${r.to}`;
    if (!from || !to) { skipped.push({ what: 'relation', name, reason: 'parent-skipped' }); continue; }
    if (p.space.relations.some(x => x.from === from && x.to === to && x.kind === r.kind)) { skipped.push({ what: 'relation', name, reason: 'exists' }); continue; }
    if (madeRelations.some(x => x.from === from && x.to === to && x.kind === r.kind && !p.space.relations.some(y => y.id === x.relationId))) { skipped.push({ what: 'relation', name, reason: 'removed' }); continue; }
    p = addRelation(p, from, to, r.kind, r.note);
    relations.push({ relationId: p.space.relations.at(-1)!.id, from, to, kind: r.kind, quote: real(r) });
  }
  for (const c of reply.candidates) candidates.push({ text: c.text, areaIds: c.parts.map(a => ids.get(a)!), quote: c.record ? real({ record: c.record, quote: c.quote! }) : null });
  const reading: MapReading = { version: 'map-reading.1', id: meta.id, at: meta.at, model: meta.model, prompt: meta.prompt, hash: meta.hash,
    records: [...input.records.values()].map(r => ({ id: r.id, sent: r.sent, total: r.total })),
    summary: reply.summary, parts, relations, candidates: candidates.slice(0, 16), gaps: reply.gaps, skipped: skipped.slice(0, 64) };
  p = addReading(p, reading);
  const next = parseProject(JSON.stringify(p));
  return { project: next, reading, created, touched: parts.map(x => x.areaId) };
}
