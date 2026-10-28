/* studio.map.1: reading records into the map. The browser sends the map as it is (parts by alias, the person's own words, what
 * earlier readings understood) and the records not yet read; the model answers with parts, claims and relations, each resting on
 * an exact quote of what was sent. applyReading is the only write: it adds parts and relations and keeps one MapReading with the
 * derived understanding. It never renames, moves, archives or re-describes an existing part, never writes Area.note and never
 * touches space.understanding (return.2 and its anchors). What is unclear stays a candidate; nothing asks for approval per part. */
import { CLAIM_KINDS, READINGS_LIMIT, isMapReading, type CandidateTarget, type ClaimKind, type MapReading, type Project, type ReadingCandidate, type ReadingClaim, type ReadingPart, type ReadingQuote, type ReadingRelation, type ReadingSkip, type RelationKind } from './types.js';
import { indexSpans, encodeSpans, decodeSpans, resolveRef, resolveRange, resolveEvidenceRange, textDigest, ANCHOR_QUOTE_MAX, SPANS_PER_RECORD, type Span, type SpanWire } from './evidence-span.js';
import type { StudioView, RecordView } from './studio.js';
import { addArea, addChildArea, addRelation, addReading } from './domain.js';
import { parseProject, sourceText } from './validation.js';
import { quoteAt } from './digest-api.js';
import { secretLike } from './secret.js';
import { validateFrozenRequest, validateRequestContext, requestContext, validateRequestMatch, requestMatches, hasTarget, sameTarget, canReplace, MATCH_STANCES, recordTexts, readInterval, type RequestContext, type FrozenRequest, type RequestMatch, type RequestMatch3, type StoredRequestMatch, type MatchKind, type MatchStance, type RequestTarget } from './request-return.js';

export const MAP_SCHEMA = 'studio.map.1' as const;
export const MAP2_SCHEMA = 'studio.map.2' as const;
/** studio.map.2 with a stance on each match and the explicit withdrawal of an earlier one (priors). map.2 stays readable. */
export const MAP3_SCHEMA = 'studio.map.3' as const;
/** studio.map.4: the same reading with its evidence named, never copied. Each record goes once as span.2 pieces (lead + spans,
 * which join back to the excerpt exactly); the reply cites a piece ('N01.07') or two adjacent ones ('N01.07-08') and says which
 * ranges it read as material inside the record (an example, a sample under test), which nothing of the map may rest on alone.
 * Every quote then keeps where it stands ([from, to) of the record) through the reply, the one write, storage and the mark. */
export const MAP4_SCHEMA = 'studio.map.4' as const;
/** studio.map.5: the same span.2 wire, with exact contiguous evidence ranges of at most 600 UTF-16 units, across any number
 * of pieces or paragraphs. map.1–4 retain their own contracts. Stored quotes still use map-reading.4 (exact slice and digest). */
export const MAP5_SCHEMA = 'studio.map.5' as const;
/** studio.map.6: the map.5 wire, with what each candidate leaves undecided stated (CandidateTarget) and a reply-local key
 * ('s1'…) on claims and on a candidate's undecided statement. A statement both settled (a claim) and undecided (a candidate),
 * the same target twice, a new part placed under the very parent its candidate leaves undecided, a wrong reference, or map
 * evidence inside the reply's own material refuse the whole reply before anything is applied (MapReplyError names the path).
 * A candidate never removes a claim: map.6 is applied without the overlap rule of map.1–5. Stored as map-reading.5. */
export const MAP6_SCHEMA = 'studio.map.6' as const;
/** A reply refused for a contradiction or a wrong reference it holds: where (path), which rule and what it names (an alias,
 * a key or a reference, never record text). The code stays INVALID_RESPONSE. */
export class MapReplyError extends Error {
  constructor(readonly path: string, readonly rule: 'settled-and-open' | 'duplicate-target' | 'duplicate-key' | 'material-evidence' | 'reference', readonly target: string) { super('INVALID_RESPONSE'); this.name = 'MapReplyError'; }
}
/** At most this many earlier matches go as priors, within PRIOR_BYTES (records keep the rest of MAP_BYTES). */
export const MAP_PRIORS = 24;
const PRIOR_BYTES = 12000;
/** The server reads at most this many bytes of a request (the studio routes share one limit). */
export const MAP_BYTES = 65536;
export const MAP_RECORDS = 4;
export const MAP_RECORD_CHARS = 12000;
const MIN_RECORD_CHARS = 1500, META_BYTES = 30000;
export const CLAIM_LABEL: Record<ClaimKind, string> = {
  // A report of work says what it says: it may say something was not built. Neither label reads as built.
  want: '원함', idea: '구상', reported: '작업 보고', checked: '확인 보고', describes: '설명', open: '남은 선택', differs: '다른 근거'
};
/** One short state for a part that has no request of its own yet, from what was read (never a verified status). */
export const STATE_LABEL: Partial<Record<ClaimKind, string>> = { reported: '작업 보고 있음', checked: '확인 보고 있음', want: '요구', idea: '구상', describes: '설명만 있음' };
/** The part's short state, saying when its current report took an earlier one back (the corrected report is read first). */
export const stateLabel = (u: Pick<PartUnderstanding, 'state' | 'revised'>): string | null => u.state ? (u.revised && (u.state === 'reported' || u.state === 'checked') ? '보고 정정됨' : STATE_LABEL[u.state] ?? null) : null;
const STATE_ORDER: ClaimKind[] = ['reported', 'checked', 'want', 'idea', 'describes'];
const RELS: RelationKind[] = ['flow', 'needs', 'shares', 'related'];

export interface MapAskPart { id: string; name: string; note: string; parentId: string | null; readAs: string | null; role: string; roleBy: 'reading' | 'person' | null; roleAbout: string | null; current: { key: string; kind: ClaimKind; text: string; about: string | null }[] }
/** text: studio.map.1–3. lead + spans: studio.map.4 (the same excerpt as span.2 pieces; never both). */
export interface MapAskRecord { id: string; kind: 'pasted' | RecordView['kind']; text?: string; lead?: string; spans?: SpanWire[]; note: string; basis: string; addedAt?: string }
/** studio.map.3: an earlier current match the records may explicitly take back, by alias (M01…), with what it said and the one
 * frozen item it answers. Material, never a new record. */
export interface MapAskPrior { key: string; quote: string; text: string; kind: MatchKind; stance: MatchStance | null; about: string | null; target: RequestTarget }
export interface MapAsk {
  schemaVersion: typeof MAP_SCHEMA | typeof MAP2_SCHEMA | typeof MAP3_SCHEMA | typeof MAP4_SCHEMA | typeof MAP5_SCHEMA | typeof MAP6_SCHEMA;
  project: { name: string; purpose: string | null };
  parts: MapAskPart[];
  relations: { from: string; to: string; kind: RelationKind; note: string }[];
  records: MapAskRecord[];
  requests?: (RequestContext | FrozenRequest)[];
  priors?: MapAskPrior[];
}
/** from/to (studio.map.4): where the quote stands in the excerpt that was sent (UTF-16 code units of it). */
export interface MapReplyQuote { record: string; quote: string; from?: number; to?: number }
export interface MapReplyClaim { kind: ClaimKind; text: string; record: string; quote: string; from?: number; to?: number; about: string | null; replaces: string | null;
  /** map.6: the reply-local key of this statement ('s1'…), required and unique in the reply. */
  key?: string | null }
/** map.6: the undecided statement a candidate keeps (attribution, holds), exact where it stands in the excerpt. */
export interface MapReplyStatement { key: string; kind: ClaimKind; text: string; about: string | null; record: string; quote: string; from: number; to: number }
export type MapReplyMatch = (RequestMatch | RequestMatch3) & { from?: number; to?: number };
/** studio.map.4: a range of the excerpt the reply read as material inside the record, not the project's own. */
export interface MapReplyMaterial { record: string; from: number; to: number; what: string }
export interface MapReplyPart { ref: string; name: string | null; parent: string | null; role: string | null; roleAbout: string | null; roleReplaces: MapReplyQuote | null; basis: MapReplyQuote[]; claims: MapReplyClaim[] }
export interface MapReply {
  summary: string;
  parts: MapReplyPart[];
  /** span (studio.map.4): where the quote stands in the excerpt (from/to here are the two parts). */
  relations: { from: string; to: string; kind: RelationKind; note: string; record: string; quote: string; span?: { from: number; to: number } }[];
  candidates: { text: string; parts: string[]; record: string | null; quote: string | null; at?: { from: number; to: number } | null; target?: CandidateTarget; statement?: MapReplyStatement | null }[];
  gaps: string[];
  matches?: MapReplyMatch[];
  material?: MapReplyMaterial[];
}
/** The excerpt each record of a request stands for: its text, and its span.2 pieces when it was sent as pieces. */
const askTexts = new WeakMap<MapAsk, Map<string, { text: string; spans: Span[] | null }>>();
export function askRecords(ask: MapAsk): Map<string, { text: string; spans: Span[] | null }> {
  const hit = askTexts.get(ask); if (hit) return hit;
  const out = new Map<string, { text: string; spans: Span[] | null }>();
  for (const r of ask.records) {
    if (r.spans) { const d = decodeSpans(r.id, { lead: r.lead ?? '', spans: r.spans }); if (d) out.set(r.id, d); }
    else if (typeof r.text === 'string') out.set(r.id, { text: r.text, spans: null });
  }
  askTexts.set(ask, out); return out;
}

const KEY = /^s\d{1,3}$/, PART = /^P\d{2,3}$/, NEW = /^new:[a-z0-9_-]{1,24}$/, RECORD = /^[NR]\d{2,3}$/, CLAIM = /^C\d{2,3}$/, PRIOR = /^M\d{2}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
/** Where a quote stands in a record, as the record's own text. Exactly (white space read loosely, as quoteAt); else, narrowly, when
 * the quote only leaves out the delimiters of paired Markdown strong emphasis ('**Error handling**', '__x__') that the record
 * really has: on one line, opening before a non-space and not after a word character, closing after a non-space and not before
 * one, outside fenced and inline code. Then the one place it matches with those delimiters set aside is returned as the record's
 * span with its marks. A single or unpaired '*' or '_' (a * b, *value, snake_case, 2 ** 3, a**b**c) is never set aside; two
 * places, changed characters or joined pieces give null. */
export function resolveQuote(text: string, quote: string): string | null {
  const q = quote.trim(); if (!q) return null;
  const at = quoteAt(text, q); if (at) return text.slice(at.at, at.at + at.length);
  const marks = (t: string): Set<number> => {
    const out = new Set<number>(); let pos = 0, fenced = false;
    for (const line of t.split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; pos += line.length + 1; continue; }
      if (!fenced) {
        // Inline code keeps its characters: masked so no delimiter is found inside it.
        const masked = line.replace(/`[^`]*`/g, m => ' '.repeat(m.length));
        for (const m of masked.matchAll(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g)) {
          const a = m.index!, b = a + m[0].length;
          if (/[\p{L}\p{N}]/u.test(masked[a - 1] ?? '') || /[\p{L}\p{N}]/u.test(masked[b] ?? '')) continue;
          for (const k of [a, a + 1, b - 2, b - 1]) out.add(pos + k);
        }
      }
      pos += line.length + 1;
    }
    return out;
  };
  const strip = (t: string) => { const drop = marks(t), keep: number[] = []; let plain = ''; for (let k = 0; k < t.length; k++) if (!drop.has(k)) { keep.push(k); plain += t[k]; } return { keep, plain }; };
  const { keep, plain } = strip(text), bare = strip(q).plain.trim(); if (!bare || plain === text) return null;
  const pattern = new RegExp(bare.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'g');
  // Unique counts every start, overlapping ones too ('very very' in 'very very very' is two places).
  const found: RegExpExecArray[] = [];
  for (let m = pattern.exec(plain); m && found.length < 2; m = pattern.exec(plain)) { found.push(m); pattern.lastIndex = m.index + 1; }
  if (found.length !== 1) return null;
  const m = found[0]!, start = keep[m.index!]!, end = keep[m.index! + m[0].length - 1]! + 1;
  return text.slice(start, end);
}
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
  const version = !!value && typeof value === 'object' ? (value as { schemaVersion?: unknown }).schemaVersion : null;
  const four = version === MAP4_SCHEMA || version === MAP5_SCHEMA || version === MAP6_SCHEMA, three = four || version === MAP3_SCHEMA, two = three || version === MAP2_SCHEMA;
  obj(value, ['schemaVersion', 'project', 'parts', 'relations', 'records', ...(two ? ['requests'] : []), ...(three ? ['priors'] : [])]);
  if (value.schemaVersion !== MAP_SCHEMA && !two) throw new Error('UNSUPPORTED_VERSION');
  if (bytes(value) > MAP_BYTES) throw new Error('INPUT_TOO_LARGE');
  obj(value.project, ['name', 'purpose']); str(value.project.name, 120); if (value.project.purpose !== null) str(value.project.purpose, 2000);
  arr(value.parts, 200);
  const parts = new Set<string>(), claims = new Set<string>();
  for (const p of value.parts) {
    obj(p, ['id', 'name', 'note', 'parentId', 'readAs', 'role', 'roleBy', 'roleAbout', 'current']); check(typeof p.id === 'string' && PART.test(p.id) && !parts.has(p.id)); parts.add(p.id);
    str(p.name, 60); str(p.note, 2000, true); if (p.readAs !== null) str(p.readAs, 60); str(p.role, 300, true);
    check(p.roleBy === null ? p.role === '' : (p.roleBy === 'reading' || p.roleBy === 'person') && !!(p.role as string).trim());
    if (p.roleAbout !== null) { str(p.roleAbout, 80); check(p.roleBy === 'reading'); }
    arr(p.current, 8); for (const c of p.current) { obj(c, ['key', 'kind', 'text', 'about']); if (c.about !== null) str(c.about, 80); check(typeof c.key === 'string' && CLAIM.test(c.key) && !claims.has(c.key)); claims.add(c.key); check(CLAIM_KINDS.includes(c.kind as ClaimKind)); str(c.text, 240); }
  }
  for (const p of value.parts as MapAskPart[]) check(p.parentId === null || (parts.has(p.parentId) && p.parentId !== p.id));
  arr(value.relations, 400);
  for (const r of value.relations) { obj(r, ['from', 'to', 'kind', 'note']); check(parts.has(r.from as string) && parts.has(r.to as string) && r.from !== r.to && RELS.includes(r.kind as RelationKind)); str(r.note, 200, true); }
  arr(value.records, MAP_RECORDS); check(value.records.length > 0);
  const records = new Set<string>();
  for (const r of value.records) {
    const hasTime = !!r && typeof r === 'object' && Object.hasOwn(r, 'addedAt');
    obj(r, ['id', 'kind', ...(four ? ['lead', 'spans'] : ['text']), 'note', 'basis', ...(hasTime ? ['addedAt'] : [])]); check(typeof r.id === 'string' && RECORD.test(r.id) && !records.has(r.id)); records.add(r.id);
    check(['pasted', 'request', 'report', 'evidence', 'answer', 'decision'].includes(r.kind as string)); str(r.note, 600, true); str(r.basis, 300);
    if (!four) str(r.text, MAP_RECORD_CHARS);
    else {
      // The pieces are exactly what span.2 makes of the text they join into: no other boundary, alias or mark.
      str(r.lead, MAP_RECORD_CHARS, true); check(!(r.lead as string).trim()); arr(r.spans, SPANS_PER_RECORD); check(r.spans.length > 0);
      for (const x of r.spans) {
        check(!!x && typeof x === 'object' && !Array.isArray(x)); const keys = Object.keys(x as object);
        check(keys.includes('s') && keys.includes('t') && keys.every(k => ['s', 't', 'k', 'q', 'more'].includes(k)));
        str((x as SpanWire).t, MAP_RECORD_CHARS); check(typeof (x as SpanWire).s === 'string');
      }
      const d = decodeSpans(r.id as string, { lead: r.lead as string, spans: r.spans as SpanWire[] });
      check(!!d); str(d!.text, MAP_RECORD_CHARS);
    }
    if (hasTime) { str(r.addedAt, 30); check(Number.isFinite(Date.parse(r.addedAt)) && new Date(r.addedAt).toISOString() === r.addedAt); }
  }
  const requests: { id: string; items: { id: string }[] }[] = [];
  if (two) { arr(value.requests, 8); const ids = new Set<string>(); for (const r of value.requests) { const req = r && typeof r === 'object' && (r as { version?: unknown }).version === 'request-scope.1' ? validateFrozenRequest(r) : validateRequestContext(r); check(!ids.has(req.id)); ids.add(req.id); requests.push(req); } }
  if (three) {
    arr(value.priors, MAP_PRIORS); const keys = new Set<string>();
    for (const x of value.priors) {
      obj(x, ['key', 'quote', 'text', 'kind', 'stance', 'about', 'target']); check(typeof x.key === 'string' && PRIOR.test(x.key) && !keys.has(x.key)); keys.add(x.key);
      str(x.quote, four ? ANCHOR_QUOTE_MAX : 300); str(x.text, 240); check(['reported', 'checked', 'code', 'test', 'open'].includes(x.kind as string)); check(x.stance === null || MATCH_STANCES.includes(x.stance as MatchStance));
      if (x.about !== null) str(x.about, 200);
      obj(x.target, ['requestId', 'itemId']); check(hasTarget(requests, x.target as unknown as RequestTarget));
    }
  }
  return structuredClone(value as unknown as MapAsk);
}

/** Exact keys and bounds; every part, claim and relation rests on a quote found in what was sent; known aliases only; new parts
 * named and grounded, with parents among known or new parts and no cycle; nothing in the reply looks like a key. Containment is
 * all this checks: not that a reading is right. */
export function validateMapReply(value: unknown, ask: MapAsk): MapReply {
  const code = 'INVALID_RESPONSE';
  const six = ask.schemaVersion === MAP6_SCHEMA, five = six || ask.schemaVersion === MAP5_SCHEMA, four = five || ask.schemaVersion === MAP4_SCHEMA, three = four || ask.schemaVersion === MAP3_SCHEMA, two = three || ask.schemaVersion === MAP2_SCHEMA;
  obj(value, ['summary', 'parts', 'relations', 'candidates', 'gaps', ...(two ? ['matches'] : []), ...(four ? ['material'] : [])], code);
  const parts = new Map(ask.parts.map(p => [p.id, p])), records = new Map(ask.records.map(r => [r.id, r])), texts = askRecords(ask);
  const quote = (rec: unknown, q: unknown): MapReplyQuote => {
    check(typeof rec === 'string' && records.has(rec), code); str(q, 300, false, code);
    const t = (q as string).trim(), span = t.length >= 6 ? resolveQuote(texts.get(rec)!.text, t) : null;
    check(!!span && span.length <= 300, code);
    return { record: rec, quote: span! };
  };
  // map.4 keeps its two-piece/paragraph contract; map.5 allows any exact contiguous range within the evidence length bound.
  // map.6: a reference that resolves to nothing in this request is refused with where it stands (path) and what it said.
  const cite = (v: unknown, path = ''): MapReplyQuote => {
    const bad = () => { throw six ? new MapReplyError(path, 'reference', typeof v === 'string' ? v.slice(0, 40) : String(v)) : new Error(code); };
    if (typeof v !== 'string') bad();
    const rec = /^([NR]\d{2,3})\./.exec(v as string)?.[1], got = rec ? texts.get(rec) : undefined;
    if (!got?.spans) bad();
    const at = (five ? resolveEvidenceRange : resolveRef)(v as string, rec!, got!.text, got!.spans!);
    if (!at || at.quote.length > ANCHOR_QUOTE_MAX) bad();
    return { record: rec!, quote: at!.quote, from: at!.from, to: at!.to };
  };
  // The evidence of an item, by its wire: a reference (map.4) or a record and a copied quote (map.1–3).
  const evidence = (o: Record<string, unknown>, path = ''): MapReplyQuote => four ? cite(o.at, path) : quote(o.record, o.quote);
  const evidenceKeys = four ? ['at'] : ['record', 'quote'];
  str(value.summary, 200, true, code);
  arr(value.parts, 24, code);
  const refs = new Set<string>(), news = new Map<string, string | null>();
  for (const p of value.parts) { obj(p, ['ref', 'name', 'parent', 'role', 'roleAbout', 'roleReplaces', 'basis', 'claims'], code); check(typeof p.ref === 'string' && (parts.has(p.ref) || NEW.test(p.ref)) && !refs.has(p.ref), code); refs.add(p.ref as string); if (NEW.test(p.ref as string)) news.set(p.ref as string, p.parent as string | null); }
  check(news.size <= 12, code);
  const outParts: MapReplyPart[] = (value.parts as Record<string, unknown>[]).map((p, pi) => {
    const ref = p.ref as string, fresh = news.has(ref);
    if (fresh) {
      str(p.name, 60, false, code);
      check(p.parent === null || (typeof p.parent === 'string' && (parts.has(p.parent) || (news.has(p.parent) && p.parent !== ref))), code);
    } else check(p.name === null && p.parent === null, code);
    if (p.role !== null) str(p.role, 300, false, code);
    if (p.roleAbout !== null) { check(p.role !== null, code); str(p.roleAbout, 80, false, code); }
    // Replacing the current description needs the record's own words that it supersedes it: only for a part with a description
    // read from records (never a new part, never the person's own correction).
    let roleReplaces: MapReplyQuote | null = null;
    if (p.roleReplaces !== null) {
      check(p.role !== null, code);
      let q: MapReplyQuote;
      if (four) q = cite(p.roleReplaces, `parts[${pi}].roleReplaces`); else { obj(p.roleReplaces, ['record', 'quote'], code); q = quote(p.roleReplaces.record, p.roleReplaces.quote); }
      // Nothing read to replace (a new part, a part without a read description, the person's own): the quote has no effect.
      roleReplaces = !fresh && parts.get(ref)?.roleBy === 'reading' ? q : null;
    }
    arr(p.basis, 4, code); check(!fresh || (p.basis as unknown[]).length > 0, code);
    const basis = (p.basis as unknown[]).map((b, j) => { if (four) return cite(b, `parts[${pi}].basis[${j}]`); obj(b, ['record', 'quote'], code); return quote(b.record, b.quote); });
    arr(p.claims, 4, code);
    const own = new Set(parts.get(ref)?.current.map(c => c.key) ?? []);
    const claims = (p.claims as unknown[]).map((c, j): MapReplyClaim => {
      obj(c, ['kind', 'text', ...evidenceKeys, 'about', 'replaces', ...(six ? ['key'] : [])], code);
      check(CLAIM_KINDS.includes(c.kind as ClaimKind), code); str(c.text, 240, false, code);
      const q = evidence(c, `parts[${pi}].claims[${j}].at`);
      if (c.about !== null) str(c.about, 80, false, code);
      check(c.replaces === null || (typeof c.replaces === 'string' && own.has(c.replaces)), code);
      // map.6: every claim names its statement with a key unique in the reply (a statement settled under one key and left open
      // under another is not caught by this; it only makes the settled/open clash of one key checkable).
      if (six && !(typeof c.key === 'string' && KEY.test(c.key))) throw new MapReplyError(`parts[${pi}].claims[${j}].key`, 'reference', String(c.key));
      return { kind: c.kind as ClaimKind, text: c.text.trim(), ...q, about: c.about === null ? null : (c.about as string).trim(), replaces: c.replaces as string | null, ...(six ? { key: c.key as string | null } : {}) };
    });
    // A description, new or changed, rests on its own quote: an existing part's role never comes in without one.
    check(fresh || p.role !== null || claims.length > 0, code);
    check(p.role === null || basis.length > 0, code);
    return { ref, name: fresh ? (p.name as string).trim() : null, parent: fresh ? p.parent as string | null : null, role: p.role === null ? null : (p.role as string).trim(),
      roleAbout: p.roleAbout === null ? null : (p.roleAbout as string).trim(), roleReplaces, basis, claims };
  });
  // New parts form a forest under known parts: no cycle among them.
  for (const ref of news.keys()) { const seen = new Set<string>(); for (let x: string | null | undefined = ref; x && news.has(x); x = news.get(x)) { check(!seen.has(x), code); seen.add(x); } }
  arr(value.relations, 12, code);
  const ends = new Set([...parts.keys(), ...news.keys()]);
  const relations = (value.relations as unknown[]).map((r, i) => {
    obj(r, ['from', 'to', 'kind', 'note', ...evidenceKeys], code);
    check(typeof r.from === 'string' && typeof r.to === 'string' && ends.has(r.from) && ends.has(r.to) && r.from !== r.to && RELS.includes(r.kind as RelationKind), code);
    str(r.note, 200, true, code); const q = evidence(r, `relations[${i}].at`);
    return { from: r.from, to: r.to, kind: r.kind as RelationKind, note: r.note.trim(), record: q.record, quote: q.quote, ...(q.from !== undefined ? { span: { from: q.from, to: q.to! } } : {}) };
  });
  arr(value.candidates, 6, code);
  const candidates = (value.candidates as unknown[]).map((c, i) => {
    obj(c, ['text', 'parts', ...evidenceKeys, ...(six ? ['target', 'statement'] : [])], code); str(c.text, 240, false, code);
    // A candidate names known parts or parts this same reply adds (new:...); nothing else.
    arr(c.parts, 2, code);
    for (const x of c.parts) if (!(typeof x === 'string' && ends.has(x))) { if (six) throw new MapReplyError(`candidates[${i}].parts`, 'reference', String(x).slice(0, 40)); check(false, code); }
    check(new Set(c.parts).size === c.parts.length, code);
    if (six) {
      // What it leaves undecided, and only that: a statement's part (attribution: 1–2 alternatives), two parts being one
      // (identity), a part inside a parent (parent: the part, then the parent), a statement holding for a part (holds).
      const target = c.target as CandidateTarget, n = (c.parts as unknown[]).length;
      if (!['attribution', 'identity', 'parent', 'holds'].includes(target as string)) throw new MapReplyError(`candidates[${i}].target`, 'reference', String(c.target));
      if (!(target === 'attribution' ? n >= 1 : target === 'holds' ? n === 1 : n === 2)) throw new MapReplyError(`candidates[${i}].parts`, 'reference', target);
      let statement: MapReplyStatement | null = null;
      if (target === 'attribution' || target === 'holds') {
        const st = c.statement; obj(st, ['key', 'kind', 'text', 'at', 'about'], code);
        if (typeof st.key !== 'string' || !KEY.test(st.key)) throw new MapReplyError(`candidates[${i}].statement.key`, 'reference', String(st.key));
        check(CLAIM_KINDS.includes(st.kind as ClaimKind), code); str(st.text, 240, false, code); if (st.about !== null) str(st.about, 80, false, code);
        const q = cite(st.at, `candidates[${i}].statement.at`);
        statement = { key: st.key, kind: st.kind as ClaimKind, text: st.text.trim(), about: st.about === null ? null : (st.about as string).trim(), record: q.record, quote: q.quote, from: q.from!, to: q.to! };
      } else if (c.statement !== null) throw new MapReplyError(`candidates[${i}].statement`, 'reference', target);
      const q = c.at === null ? null : cite(c.at, `candidates[${i}].at`);
      return { text: c.text.trim(), parts: [...c.parts as string[]], record: q?.record ?? null, quote: q?.quote ?? null, at: q ? { from: q.from!, to: q.to! } : null, target, statement };
    }
    if (four) {
      const q = c.at === null ? null : cite(c.at);
      return { text: c.text.trim(), parts: [...c.parts as string[]], record: q?.record ?? null, quote: q?.quote ?? null, at: q ? { from: q.from!, to: q.to! } : null };
    }
    check((c.record === null) === (c.quote === null), code);
    const q = c.record === null ? null : quote(c.record, c.quote);
    return { text: c.text.trim(), parts: [...c.parts as string[]], record: q?.record ?? null, quote: q?.quote ?? null };
  });
  arr(value.gaps, 2, code); const gaps = (value.gaps as unknown[]).map(g => { str(g, 160, false, code); return (g as string).trim(); });
  // What the reply read as material inside a record (an example, a sample under test): a range of whole pieces of one record.
  let material: MapReplyMaterial[] = [];
  if (four) {
    arr(value.material, 6, code);
    material = (value.material as unknown[]).map((x, i) => {
      obj(x, ['at', 'what'], code); str(x.what, 120, false, code); check(typeof x.at === 'string', code);
      const rec = /^([NR]\d{2,3})\./.exec(x.at as string)?.[1], got = rec ? texts.get(rec) : undefined;
      const at = got?.spans ? resolveRange(x.at as string, rec!, got.text, got.spans) : null;
      if (!at && six) throw new MapReplyError(`material[${i}].at`, 'reference', (x.at as string).slice(0, 40)); check(!!at, code);
      return { record: rec!, from: at!.from, to: at!.to, what: (x.what as string).trim() };
    });
  }
  let matches: MapReplyMatch[] = [];
  if (two) {
    arr(value.matches, 24, code);
    const priors = new Map((ask.priors ?? []).map(x => [x.key, x])), taken = new Set<string>();
    matches = value.matches.map((v, mi) => {
      // map.4: the passage is the cited one, exactly where it stands; then the same rules as a copied quote.
      let anchor: MapReplyQuote | null = null, wire = v;
      if (four) {
        check(!!v && typeof v === 'object' && !Array.isArray(v) && Object.hasOwn(v, 'at') && !Object.hasOwn(v, 'record') && !Object.hasOwn(v, 'quote'), code);
        const { at, ...rest } = v as Record<string, unknown>; anchor = cite(at, `matches[${mi}].at`); wire = { record: anchor.record, quote: anchor.quote, ...rest };
      }
      let m: RequestMatch; try { m = validateRequestMatch(wire, ask.requests!, three, four ? ANCHOR_QUOTE_MAX : 300); } catch { throw new Error(code); }
      // Request correspondence quotes the literal sent passage; it does not repair or join excerpts.
      const rec = records.get(m.record), text = rec ? texts.get(rec.id)!.text : '', at = anchor ? { at: anchor.from!, length: anchor.to! - anchor.from! } : rec ? quoteAt(text, m.quote) : null;
      check(rec && at && at.length >= (anchor ? 1 : 6) && at.length <= (anchor ? ANCHOR_QUOTE_MAX : 300), code);
      const explicit = new Set(text.match(/\bRQ_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi) ?? []);
      check(!explicit.size || m.targets.every(t => explicit.has(t.requestId)), code);
      check(!['code', 'test'].includes(m.kind) || rec!.kind === 'evidence', code);
      const about = m.about === null ? null : resolveQuote(text, m.about);
      check(m.about === null || about !== null, code);
      check(!secretLike(`${m.text}\n${m.why}`), code);
      // Identical frozen demands cannot be separated by arrival order. Retain all competing RQ targets, unless the report
      // explicitly names the request id (or the plan id AND revision) itself.
      const targets = [...m.targets];
      const eligible = (request: { createdAt: string }) => !rec!.addedAt || Date.parse(rec!.addedAt) >= Date.parse(request.createdAt);
      check(targets.every(t => eligible(ask.requests!.find(r => r.id === t.requestId)!)), code);
      for (const t of m.targets) {
        const req = ask.requests!.find(r => r.id === t.requestId)!, item = req.items.find(i => i.id === t.itemId)!;
        if (text.includes(req.id) || new RegExp(`${req.planId}\\s*/\\s*${req.planRevision}(?!\\d)`).test(text)) continue;
        for (const other of ask.requests!) for (const i of other.items) if (eligible(other) && other.id !== req.id && norm(i.title) === norm(item.title) && norm(i.description) === norm(item.description) && !targets.some(x => x.requestId === other.id && x.itemId === i.id)) targets.push({ requestId: other.id, itemId: i.id });
      }
      check(targets.length <= 8, code);
      const quoted = text.slice(at!.at, at!.at + at!.length), where = anchor ? { from: anchor.from!, to: anchor.to! } : {};
      if (!three) return { ...m, quote: quoted, about, targets };
      // A withdrawal names a prior that was sent, for the very item that prior answers: anything else was made up.
      const key = (v as { replaces: unknown }).replaces;
      check(key === null || (typeof key === 'string' && priors.has(key)), code);
      const prior = key === null ? null : priors.get(key as string)!;
      check(!prior || (m.targets.length === 1 && sameTarget(m.targets[0]!, prior.target)), code);
      // Doubtful ones keep the passage and drop the link (the two reports then read side by side): a remark that does not say
      // made or not made, another nature, the prior's own words, a second take-back of the same prior, a target widened to
      // identical items of other requests, or another named version the record never names.
      const holds = !!prior && !taken.has(prior.key) && targets.length === 1 && canReplace({ target: prior.target, excluded: false, replaced: false, kind: prior.kind, quote: prior.quote, about: prior.about }, { ...m, quote: quoted, about }, text);
      if (holds) taken.add(prior!.key);
      return { ...m, quote: quoted, about, targets, stance: m.stance!, replaces: holds ? prior!.key : null, ...where };
    });
  }
  if (six) contradictions(outParts, relations, candidates, matches, material);
  const reply: MapReply = { summary: value.summary.trim(), parts: outParts, relations, candidates, gaps, ...(two ? { matches } : {}), ...(four ? { material } : {}) };
  // Words the model wrote (never the quotes, which are the person's own records) must not look like a key.
  const written = [reply.summary, ...gaps, ...outParts.flatMap(p => [p.name ?? '', p.role ?? '', p.roleAbout ?? '', ...p.claims.flatMap(c => [c.text, c.about ?? ''])]), ...relations.map(r => r.note), ...candidates.map(c => c.text), ...material.map(x => x.what)];
  check(!written.some(w => w && secretLike(w)), code);
  return reply;
}

/** map.6: what one reply cannot hold at once. A statement key is one statement: settled (a claim) or undecided (a candidate),
 * never both, and never twice either way; one target is left undecided once; a new part is not placed under the very parent its
 * candidate leaves undecided (only that link is then null); nothing of the map rests on what the same reply read as material.
 * Positions are evidence, not the conflict key: two quotes of one statement are one statement, overlapping quotes of two are two. */
function contradictions(parts: MapReplyPart[], relations: MapReply['relations'], candidates: MapReply['candidates'], matches: MapReplyMatch[], material: MapReplyMaterial[]): void {
  const keys = new Map<string, string>();
  parts.forEach((p, i) => p.claims.forEach((c, j) => {
    if (!c.key) return; const path = `parts[${i}].claims[${j}].key`;
    if (keys.has(c.key)) throw new MapReplyError(path, 'duplicate-key', c.key); keys.set(c.key, path);
  }));
  const targets = new Set<string>();
  candidates.forEach((c, i) => {
    if (c.statement) {
      const path = `candidates[${i}].statement.key`, settled = keys.get(c.statement.key);
      if (settled?.startsWith('parts[')) throw new MapReplyError(`${path} = ${settled}`, 'settled-and-open', c.statement.key);
      if (settled) throw new MapReplyError(path, 'duplicate-key', c.statement.key);
      keys.set(c.statement.key, path);
    }
    const id = c.target === 'identity' ? `identity:${[...c.parts].sort().join('|')}` : c.target === 'parent' ? `parent:${c.parts[0]}>${c.parts[1]}` : `${c.target}:${c.statement?.key}`;
    if (targets.has(id)) throw new MapReplyError(`candidates[${i}]`, 'duplicate-target', id); targets.add(id);
    if (c.target === 'parent') {
      const k = parts.findIndex(p => p.ref === c.parts[0] && p.name !== null);
      if (k >= 0 && parts[k]!.parent === c.parts[1]) throw new MapReplyError(`parts[${k}].parent`, 'settled-and-open', `${c.parts[0]}>${c.parts[1]}`);
    }
  });
  const inside = (q: { record: string; from?: number; to?: number }) => q.from !== undefined && q.to !== undefined && material.some(m => m.record === q.record && m.from < q.to! && q.from! < m.to);
  const evidence: [string, { record: string; from?: number; to?: number }][] = [
    ...parts.flatMap((p, i) => [...p.basis.map((q, j) => [`parts[${i}].basis[${j}]`, q] as [string, MapReplyQuote]), ...p.claims.map((q, j) => [`parts[${i}].claims[${j}].at`, q] as [string, MapReplyQuote]), ...(p.roleReplaces ? [[`parts[${i}].roleReplaces`, p.roleReplaces] as [string, MapReplyQuote]] : [])]),
    ...relations.map((r, i) => [`relations[${i}].at`, { record: r.record, ...(r.span ?? {}) }] as [string, { record: string; from?: number; to?: number }]),
    ...matches.map((m, i) => [`matches[${i}].at`, m] as [string, MapReplyMatch]),
    ...candidates.flatMap((c, i) => c.statement ? [[`candidates[${i}].statement.at`, c.statement] as [string, MapReplyStatement]] : [])];
  for (const [path, q] of evidence) if (inside(q)) throw new MapReplyError(path, 'material-evidence', q.record);
}

/** How a stored candidate reads (map-reading.5): what it leaves undecided, the undecided statement itself (its kind, words and
 * version, never as a settled claim of a part), and the passages to open: the candidate's own and the statement's, once each
 * (one passage when both are the same place). A candidate of an earlier reading has no label or statement: it reads as before. */
export const CANDIDATE_LABEL: Record<CandidateTarget, string> = { attribution: '귀속 미정', holds: '성립 미정', identity: '같은 대상인지 미정', parent: '포함 미정' };
export function candidateReading(c: ReadingCandidate): { label: string | null; statement: { kind: string; text: string; about: string | null } | null; quotes: { which: 'at' | 'statement'; quote: ReadingQuote }[] } {
  const same = (a: ReadingQuote, b: ReadingQuote) => a.record === b.record && (a.from !== undefined && b.from !== undefined ? a.from === b.from && a.to === b.to : a.quote === b.quote);
  const quotes: { which: 'at' | 'statement'; quote: ReadingQuote }[] = c.quote ? [{ which: 'at', quote: c.quote }] : [];
  if (c.statement && !(c.quote && same(c.quote, c.statement.quote))) quotes.push({ which: 'statement', quote: c.statement.quote });
  return { label: c.target ? CANDIDATE_LABEL[c.target] : null, statement: c.statement ? { kind: CLAIM_LABEL[c.statement.kind], text: c.statement.text, about: c.statement.about } : null, quotes };
}

/* ---------- what earlier readings understood, per part ---------- */
export interface CurrentClaim extends ReadingClaim { reading: string; index: number; at: string }
export interface PartUnderstanding {
  /** The current description: the person's correction when there is one, else the first description read, replaced only by a
   * later one whose record says in its own words that it supersedes it (roleReplaces). Arrival order and differing version names
   * are never a reason: a v1 document arriving after v2 does not turn the description back. */
  role: string | null; roleAbout: string | null;
  /** The person corrected the description (it stays until they correct it again). */
  corrected: { id: string; at: string } | null;
  /** The quotes the current description rests on (none for the person's correction). */
  roleBasis: ReadingQuote[];
  /** Descriptions read later that did not replace the current one (another version, the same version, or none named), newest first. */
  others: { text: string; about: string | null; at: string }[];
  /** Current claims, newest reading first: superseded ones and repeats of the same words are left out. */
  claims: CurrentClaim[];
  /** Each reading that said something about this part, oldest first (the evidence history, apart from the current view). */
  history: { reading: string; at: string; role: string | null; claims: ReadingClaim[]; basis: ReadingQuote[] }[];
  /** The part was added by a reading: the name it was added with (the person may have renamed it since). */
  createdName: string | null;
  state: ClaimKind | null;
  /** A current report or check here replaced an earlier one of this part (the record said so). */
  revised: boolean;
  /** Every quote the current description (as read, never the person's) rests on lies inside a report a later record took back:
   * the description stays, but no longer reads as resting on current evidence. */
  roleBasisRevised: boolean;
}
const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
export function partUnderstanding(p: Project, areaId: string): PartUnderstanding | null {
  const history: PartUnderstanding['history'] = []; let createdName: string | null = null, role: string | null = null, roleAbout: string | null = null;
  const others: PartUnderstanding['others'] = []; let roleBasis: ReadingQuote[] = [];
  let corrected: PartUnderstanding['corrected'] = null;
  const all: CurrentClaim[] = [], replaced = new Set<string>();
  for (const r of p.readings) {
    if (!isMapReading(r)) { if (r.version === 'map-correction.1' && r.areaId === areaId) { role = r.text; roleAbout = null; roleBasis = []; corrected = { id: r.id, at: r.at }; } continue; }
    const part = r.parts.find(x => x.areaId === areaId); if (!part) continue;
    if (part.created) createdName = part.created.name;
    // A correction holds the description only: a later reading's description reads apart, its claims still come in.
    if (part.role) {
      if (!role || (!corrected && part.roleReplaces)) { if (role) others.unshift({ text: role, about: roleAbout, at: r.at }); role = part.role; roleAbout = part.roleAbout; roleBasis = part.basis; }
      else others.unshift({ text: part.role, about: part.roleAbout, at: r.at });
    }
    history.push({ reading: r.id, at: r.at, role: part.role, claims: part.claims, basis: part.basis });
    part.claims.forEach((c, index) => { all.push({ ...c, reading: r.id, index, at: r.at }); if (c.replaces) replaced.add(`${c.replaces.reading}:${c.replaces.index}`); });
  }
  if (!history.length) return null;
  const seen = new Set<string>(), claims: CurrentClaim[] = [];
  for (const c of all.reverse()) {
    // The same words about another version are another claim: never merged across versions.
    const key = `${c.kind}|${norm(c.text)}|${c.about ?? ''}`;
    if (replaced.has(`${c.reading}:${c.index}`) || seen.has(key)) continue;
    seen.add(key); claims.push(c);
  }
  const state = STATE_ORDER.find(k => claims.some(c => c.kind === k)) ?? null;
  const revised = claims.some(c => !!c.replaces && (c.kind === 'reported' || c.kind === 'checked'));
  const roleBasisRevised = !corrected && roleBasis.length > 0 && roleBasis.every(q => insideRevised(p, areaId, q));
  // The corrected report reads first (claims are newest first; a replacing one goes ahead of the rest).
  claims.sort((a, b) => Number(!!b.replaces) - Number(!!a.replaces));
  return { role, roleAbout, roleBasis, corrected, others: others.slice(0, 6), claims: claims.slice(0, 12), history, createdName, state, revised, roleBasisRevised };
}

/* ---------- evidence a later record took back ---------- */
interface RecordSpan { record: string; from: number; to: number }
const spanCache = new WeakMap<Project, Map<string, RecordSpan[]>>();
/** A record as it is read, quoted and marked (a returned report as received: sourceText), or null when there is none. */
const recordText = (p: Project, id: string) => { const pasted = p.pasted.find(r => r.id === id); if (pasted) return pasted.text; const s = p.sources.find(r => r.id === id); return s ? sourceText(p.tasks, s) : null; };
/** Where a quote stands in its record: where it was read (map-reading.4 keeps it), else only when it stands there once (otherwise
 * which passage is meant is not certain, and none is made up). */
function spanOnce(p: Project, q: ReadingQuote): RecordSpan | null {
  const t = recordText(p, q.record); if (t === null) return null;
  if (q.from !== undefined && q.to !== undefined) return t.slice(q.from, q.to) === q.quote ? { record: q.record, from: q.from, to: q.to } : null;
  const at = t.indexOf(q.quote); return at >= 0 && t.indexOf(q.quote, at + 1) < 0 ? { record: q.record, from: at, to: at + q.quote.length } : null;
}
/** Per part: passages of its reports and checks that no longer stand. A map claim of that part a later claim of the same part
 * replaced (a claim is named by reading, part and index: index alone repeats across parts), and a request match a later record
 * explicitly withdrew as not made, for the parts of the item it answered. A passage a current report or check of that same part
 * still rests on is not among them. Derived only; nothing is stored, removed or archived. */
export function revisedSpans(p: Project): Map<string, RecordSpan[]> {
  const hit = spanCache.get(p); if (hit) return hit;
  const replaced = new Set<string>(), maps = p.readings.filter(isMapReading), gone = new Map<string, RecordSpan[]>(), live = new Map<string, RecordSpan[]>();
  const add = (m: Map<string, RecordSpan[]>, area: string, s: RecordSpan) => { const l = m.get(area) ?? []; l.push(s); m.set(area, l); };
  for (const r of maps) for (const part of r.parts) for (const c of part.claims) if (c.replaces) replaced.add(`${c.replaces.reading}|${part.areaId}|${c.replaces.index}`);
  for (const r of maps) for (const part of r.parts) part.claims.forEach((c, i) => {
    if (c.kind !== 'reported' && c.kind !== 'checked') return;
    const s = spanOnce(p, c); if (s) add(replaced.has(`${r.id}|${part.areaId}|${i}`) ? gone : live, part.areaId, s);
  });
  for (const x of requestMatches(p)) if (x.replacedBy?.match.stance === 'not-made' && x.target) {
    const t = x.target, item = x.requests.find(q => q.id === t.requestId)?.items.find(i => i.id === t.itemId);
    for (const area of item?.partIds ?? []) add(gone, area, { record: x.match.record, from: x.match.from, to: x.match.to });
  }
  const out = new Map<string, RecordSpan[]>();
  for (const [area, spans] of gone) {
    const kept = spans.filter(s => !(live.get(area) ?? []).some(l => l.record === s.record && l.from < s.to && s.from < l.to));
    if (kept.length) out.set(area, kept);
  }
  spanCache.set(p, out); return out;
}
function insideRevised(p: Project, area: string, q: ReadingQuote): boolean {
  const spans = revisedSpans(p).get(area); if (!spans) return false;
  const s = spanOnce(p, q); return !!s && spans.some(x => x.record === s.record && s.from >= x.from && s.to <= x.to);
}
/** Relations a reading added on a quote that lies inside a report one of its two ends took back: the line stays (the person's
 * map), but it is not read as a current, confirmed connection. A relation the person drew has no quote and is never among them. */
const relationCache = new WeakMap<Project, Set<string>>();
export function revisedRelations(p: Project): Set<string> {
  const hit = relationCache.get(p); if (hit) return hit;
  const out = new Set<string>();
  if (revisedSpans(p).size) for (const r of p.readings) if (isMapReading(r)) for (const x of r.relations) if (insideRevised(p, x.from, x.quote) || insideRevised(p, x.to, x.quote)) out.add(x.relationId);
  relationCache.set(p, out); return out;
}

/* ---------- the request ---------- */
/** A record with what is still unread of it: characters from 'from' on (0 = never read; > 0 = the tail an earlier reading left). */
export interface MapRecordSource { id: string; kind: MapAskRecord['kind']; text: string; at: string; label: string; from: number }
export interface MapInput {
  ask: MapAsk;
  /** alias → area id, record id, earlier claim */
  parts: Map<string, string>; records: Map<string, { id: string; from: number; to: number; total: number; text: string }>; claims: Map<string, { reading: string; index: number }>;
  /** Records not yet read, how many go now, and how many go only in part. */
  coverage: { fresh: number; sent: number; partial: number };
  /** The last reading when this request was made: an answer is applied only on top of it. */
  after: string | null;
  problem: 'NOTHING_NEW' | 'TOO_LARGE' | 'REQUEST_CONTEXT_TOO_LARGE' | { secret: string } | null;
  requestCoverage?: { total: number; sent: number };
  /** Full scopes, captured before the call; the wire sends only requestContext(scope). */
  fullRequests?: FrozenRequest[];
  /** prior alias → the stored match it stands for, its item and the person's last correction of it when this was asked. */
  priors?: Map<string, { reading: string; index: number; target: RequestTarget; correction: string | null }>;
}
/** Records of a project with text no map reading has read yet, newest first: pasted records as pasted, and the project's own
 * records. A record sent only in part comes back with its unread tail (from the end of what was read). */
export function unreadRecords(p: Project, view: StudioView): MapRecordSource[] {
  const readTo = new Map<string, number>();
  const texts = recordTexts(p);
  for (const r of p.readings) if (isMapReading(r)) for (const x of r.records) { const i = readInterval(r, x, texts); readTo.set(x.id, Math.max(readTo.get(x.id) ?? 0, i.to)); }
  const pasted: MapRecordSource[] = p.pasted.map(r => ({ id: r.id, kind: 'pasted', text: r.text, at: r.at, label: '붙여넣은 기록', from: readTo.get(r.id) ?? 0 }));
  const own: MapRecordSource[] = view.records.map(r => ({ id: r.id, kind: r.kind, text: r.text, at: r.at, label: '프로젝트 기록', from: readTo.get(r.id) ?? 0 }));
  return [...pasted, ...own].filter(r => r.from < r.text.length).sort((a, b) => b.at.localeCompare(a.at));
}
/** anchored: true for m4, MAP5_SCHEMA for m5 (only after the server advertises that capability); records go as span.2 pieces, ending
 * where a piece ends (a cut excerpt never leaves its last sentence half sent), with requests and priors always present. */
export function buildMapAsk(p: Project, view: StudioView, requests: FrozenRequest[] = [], selectedRequestId?: string, anchored: boolean | typeof MAP5_SCHEMA | typeof MAP6_SCHEMA = false): MapInput {
  const anchoredSchema = anchored === MAP6_SCHEMA ? MAP6_SCHEMA : anchored === MAP5_SCHEMA ? MAP5_SCHEMA : MAP4_SCHEMA;
  const parts = new Map<string, string>(), alias = new Map<string, string>(), claims = new Map<string, { reading: string; index: number }>();
  view.parts.slice(0, 200).forEach((x, i) => { const a = `P${String(i + 1).padStart(2, '0')}`; parts.set(a, x.id); alias.set(x.id, a); });
  let c = 0;
  const askParts: MapAskPart[] = view.parts.slice(0, 200).map(x => {
    const u = partUnderstanding(p, x.id);
    const current = (u?.claims ?? []).slice(0, 6).map(cl => { const key = `C${String(++c).padStart(2, '0')}`; claims.set(key, { reading: cl.reading, index: cl.index }); return { key, kind: cl.kind, text: cut(cl.text, 240), about: cl.about }; });
    return { id: alias.get(x.id)!, name: x.name, note: cut(clean(x.note), 2000), parentId: x.parentId ? alias.get(x.parentId) ?? null : null,
      readAs: u?.createdName && normName(u.createdName) !== normName(x.name) ? u.createdName : null, role: cut(u?.role ?? '', 300), roleBy: u?.role ? (u.corrected ? 'person' : 'reading') : null, roleAbout: u?.role && !u.corrected ? u.roleAbout : null, current };
  });
  const ask: MapAsk = {
    schemaVersion: MAP_SCHEMA,
    project: { name: cut(p.name, 120), purpose: p.space.brief ? cut(clean(p.space.brief.text), 2000) : null },
    parts: askParts,
    relations: view.relations.filter(r => alias.has(r.from) && alias.has(r.to)).slice(0, 400).map(r => ({ from: alias.get(r.from)!, to: alias.get(r.to)!, kind: r.kind, note: cut(r.note, 200) })),
    records: [],
    ...(anchored ? { requests: [], priors: [] } : {})
  };
  if (anchored) ask.schemaVersion = anchoredSchema;
  let unread = unreadRecords(p, view);
  if (selectedRequestId) {
    if (!requests.some(r => r.id === selectedRequestId)) throw new Error('INVALID_REQUEST_SCOPE');
    // Explicit recovery may compare a report previously read without this RQ. Coverage is per RQ, from its contiguous
    // compared prefix, so an earlier map-only read or a sent tail does not hide an uncompared head forever.
    const texts = recordTexts(p), compared = p.readings.filter(isMapReading).filter(r => r.requests?.some(q => q.id === selectedRequestId)).flatMap(r => r.records.map(x => readInterval(r, x, texts)));
    const prefix = (id: string) => { let end = 0; for (const r of compared.filter(r => r.id === id).sort((a, b) => a.from - b.from)) if (r.from <= end) end = Math.max(end, r.to); return end; };
    unread = [...p.pasted.map(r => ({ id: r.id, kind: 'pasted' as const, text: r.text, at: r.at, label: '붙여넣은 기록', from: prefix(r.id) })),
      ...view.records.map(r => ({ id: r.id, kind: r.kind, text: r.text, at: r.at, label: '프로젝트 기록', from: prefix(r.id) }))].filter(r => r.from < r.text.length).sort((a, b) => b.at.localeCompare(a.at));
  }
  const records = new Map<string, { id: string; from: number; to: number; total: number; text: string }>();
  const input: MapInput = { ask, parts, records, claims, coverage: { fresh: unread.length, sent: 0, partial: 0 }, after: p.readings.filter(isMapReading).at(-1)?.id ?? null, problem: null };
  if (!unread.length) return { ...input, problem: 'NOTHING_NEW' };
  // All comparable contexts or a request the person explicitly chose. Full origins are never sent repeatedly per item.
  if (requests.length) {
    for (const r of requests) { validateFrozenRequest(r); if (r.projectId !== p.id) throw new Error('INVALID_REQUEST_SCOPE'); }
    const chosen = selectedRequestId ? requests.filter(r => r.id === selectedRequestId) : requests, contexts = chosen.map(requestContext);
    input.requestCoverage = { total: requests.length, sent: 0 };
    if (chosen.length > 8 || bytes(contexts) > 28000) return { ...input, problem: 'REQUEST_CONTEXT_TOO_LARGE' };
    ask.schemaVersion = anchored ? anchoredSchema : MAP3_SCHEMA; ask.requests = contexts; input.fullRequests = structuredClone(chosen);
    input.requestCoverage.sent = chosen.length;
    // What the records may take back: current matches of a single item of these requests, newest first, within their own budget.
    const ids = new Set(chosen.map(q => q.id)), priors: MapAskPrior[] = [], refs = new Map<string, { reading: string; index: number; target: RequestTarget; correction: string | null }>();
    for (const x of requestMatches(p)) {
      if (priors.length >= MAP_PRIORS) break;
      if (x.excluded || x.replacedBy || !x.target || !ids.has(x.target.requestId) || x.match.kind === 'open' || secretLike(`${x.match.quote}\n${x.match.text}`)) continue;
      const key = `M${String(priors.length + 1).padStart(2, '0')}`, prior: MapAskPrior = { key, quote: x.match.quote, text: x.match.text, kind: x.match.kind, stance: x.match.stance ?? null, about: x.match.about, target: { ...x.target } };
      if (bytes([...priors, prior]) > PRIOR_BYTES) break;
      priors.push(prior); refs.set(key, { reading: x.reading, index: x.index, target: { ...x.target }, correction: x.correction });
    }
    ask.priors = priors; input.priors = refs;
  }
  // Structure first, bounded: the earlier understanding of each part shrinks before any record is left out.
  const mapBytes = () => bytes({ ...ask, ...(ask.requests ? { requests: [] } : {}), ...(ask.priors ? { priors: [] } : {}) });
  if (mapBytes() > META_BYTES) for (const x of ask.parts) { x.current = x.current.slice(0, 2); x.role = cut(x.role, 120); if (mapBytes() <= META_BYTES) break; }
  if (mapBytes() > META_BYTES) return { ...input, problem: 'TOO_LARGE' };
  // Priors give way first (the oldest go): they never keep a report from being read.
  while (ask.priors?.length && bytes(ask) > MAP_BYTES - MIN_RECORD_CHARS * 3) input.priors!.delete(ask.priors.pop()!.key);
  if (bytes(ask) > MAP_BYTES - MIN_RECORD_CHARS * 3) return { ...input, problem: 'REQUEST_CONTEXT_TOO_LARGE' };
  let n = { N: 0, R: 0 };
  // A cut excerpt (anchored) ends with the last piece that ends there: at a line end, or before a cut nothing of it is sent past.
  const aligned = (rest: string, t: string) => {
    let end = t.length;
    const spans = indexSpans(t);
    const last = spans.at(-1);
    if (t.length < rest.length && last) {
      // The last piece is whole when its line ends, or its sentence ends, before what is left out; else it goes next time.
      const tail = rest.slice(last.to, t.length + 1), piece = t.slice(last.from, last.to);
      const whole = /[\r\n]/.test(tail) || (/^\s/.test(tail) && /[.!?。！？…][)\]"'”’」』]*$/.test(piece));
      end = whole ? last.to : spans.at(-2)?.to ?? t.length;
    }
    if (spans.length > SPANS_PER_RECORD) end = Math.min(end, spans[SPANS_PER_RECORD - 1]!.to);
    return t.slice(0, end);
  };
  const put = (rec: MapAskRecord, t: string) => { if (anchored) { const w = encodeSpans(rec.id, t); rec.lead = w.lead; rec.spans = w.spans; } else rec.text = t; };
  for (const r of unread) {
    if (ask.records.length >= MAP_RECORDS) break;
    const letter = r.kind === 'pasted' ? 'N' : 'R', id = `${letter}${String(++n[letter]).padStart(2, '0')}`;
    // Only the unread part goes: what is quoted is checked against exactly this excerpt.
    const rest = r.text.slice(r.from);
    // Records hold no control characters (they are refused on the way in), so the excerpt is the record's own text.
    let text = anchored ? aligned(rest, cut(rest, MAP_RECORD_CHARS)) : cut(clean(rest), MAP_RECORD_CHARS);
    const rec: MapAskRecord = { id, kind: r.kind, note: '', basis: `${r.label} · ${r.at} (가져온 시각이며 원문 작성·판본 시각이 아님)`, ...(ask.requests ? { addedAt: r.at } : {}) };
    put(rec, text);
    const earlier = ask.requests?.filter(q => Date.parse(r.at) < Date.parse(q.createdAt)).map(q => q.id) ?? [];
    const note = () => [r.from > 0 || text.length < rest.length ? `원문 ${r.text.length}자 중 ${r.from + 1}~${r.from + text.length}자 구간만 보냄${r.from > 0 ? ' (앞 구간은 앞선 정리에서 읽음)' : ''}` : '',
      earlier.length ? `다음 요청문 생성 전에 붙인 이전 자료이며 후속 반환 근거가 아님: ${earlier.join(', ')}` : ''].filter(Boolean).join(' · ');
    rec.note = note(); ask.records.push(rec);
    // A record takes the room that is left, down to a readable excerpt; one that cannot is left for the next reading.
    for (let g = 0; bytes(ask) > MAP_BYTES - 256 && text.length > MIN_RECORD_CHARS && g < 40; g++) { const shorter = cut(text, Math.floor(text.length * 0.9)); text = anchored ? aligned(rest, shorter) : shorter; put(rec, text); rec.note = note(); }
    if (bytes(ask) > MAP_BYTES - 256) { ask.records.pop(); n[letter]--; break; }
    records.set(id, { id: r.id, from: r.from, to: r.from + text.length, total: r.text.length, text });
  }
  input.coverage = { fresh: unread.length, sent: ask.records.length, partial: [...records.values()].filter(x => x.to < x.total || x.from > 0).length };
  if (!ask.records.length) return { ...input, problem: 'TOO_LARGE' };
  const leak = ask.records.find(x => secretLike(records.get(x.id)!.text));
  if (leak) return { ...input, problem: { secret: leak.id } };
  return input;
}

/* ---------- the one write ---------- */
export interface Applied { project: Project; reading: MapReading; created: string[]; touched: string[] }
/** Applies a validated reply on top of the project it was asked about, atomically: either every part, relation and the reading
 * are kept, or nothing is (the result is re-read by parseProject). Refused when another reading was applied meanwhile or a part
 * the reply names has gone; edits the person made meanwhile (names, notes, places, plans, records) are kept as they are. */
export function applyReading(project: Project, input: MapInput, reply: MapReply, meta: { id: string; at: string; model: string; prompt: string; hash: string }): Applied {
  if (input.problem) throw new Error(input.problem === 'REQUEST_CONTEXT_TOO_LARGE' ? 'REQUEST_CONTEXT_TOO_LARGE' : 'INVALID_INPUT');
  const six = input.ask.schemaVersion === MAP6_SCHEMA, withRequests = input.ask.schemaVersion !== MAP_SCHEMA, four = six || input.ask.schemaVersion === MAP4_SCHEMA || input.ask.schemaVersion === MAP5_SCHEMA, three = four || input.ask.schemaVersion === MAP3_SCHEMA;
  const frozen = withRequests ? input.fullRequests ?? input.ask.requests!.map(validateFrozenRequest) : [];
  if (frozen.some(r => r.projectId !== project.id) || JSON.stringify(frozen.map(requestContext)) !== JSON.stringify((input.ask.requests ?? []).map(r => r.version === 'request-scope.1' ? requestContext(r) : r))) throw new Error('INVALID_REQUEST_SCOPE');
  const done = project.readings.filter(isMapReading);
  if ((done.at(-1)?.id ?? null) !== input.after) throw new Error('MAP_CHANGED');
  if (done.some(r => r.hash === meta.hash)) throw new Error('ALREADY_APPLIED');
  if (project.readings.length >= READINGS_LIMIT) throw new Error('READINGS_FULL');
  // Anchored: every excerpt is still exactly the record's text where it was read (the record, its length and the interval).
  if (four) for (const r of input.records.values()) { const t = recordText(project, r.id); if (t === null || t.length !== r.total || t.slice(r.from, r.to) !== r.text) throw new Error('MAP_CHANGED'); }
  // And every passage of the reply is the excerpt's own text where it says it stands (a reply decoded for another request is not).
  if (four) {
    const at = (q: MapReplyQuote) => { const source = input.records.get(q.record); return !!source && q.from !== undefined && q.to !== undefined && source.text.slice(q.from, q.to) === q.quote; };
    const all = [...reply.parts.flatMap(x => [...x.basis, ...x.claims, ...(x.roleReplaces ? [x.roleReplaces] : [])]), ...reply.relations.map(r => ({ record: r.record, quote: r.quote, ...(r.span ?? {}) })),
      ...reply.candidates.flatMap(c => c.record ? [{ record: c.record, quote: c.quote!, ...(c.at ?? {}) }] : []), ...(reply.matches ?? [])];
    if (!all.every(at) || (reply.material ?? []).some(m => { const s = input.records.get(m.record); return !s || m.to > s.text.length; })) throw new Error('INVALID_RESPONSE');
  }
  const addedAt = new Map([...project.pasted.map(r => [r.id, r.at] as const), ...project.sources.map(r => [r.id, r.at] as const)]);
  for (const m of reply.matches ?? []) for (const t of m.targets) {
    const record = input.records.get(m.record), request = frozen.find(r => r.id === t.requestId);
    if (!record || !request || !addedAt.has(record.id) || Date.parse(addedAt.get(record.id)!) < Date.parse(request.createdAt)) throw new Error('INVALID_RESPONSE');
  }
  // A comparison may re-read an old interval. Only quotes containing previously unread bytes can change the map again.
  // Request matches still use the full reply below and are saved with their frozen context in the same write.
  const texts = recordTexts(project), covered = done.flatMap(r => r.records.map(x => readInterval(r, x, texts)));
  const freshQuote = (q: MapReplyQuote) => {
    const source = input.records.get(q.record), at = !source ? null : q.from !== undefined && q.to !== undefined ? { at: q.from, length: q.to - q.from } : quoteAt(source.text, q.quote);
    if (!source || !at) return false;
    let end = source.from + at.at; const limit = end + at.length;
    for (const r of covered.filter(r => r.id === source.id && r.to > end && r.from < limit).sort((a, b) => a.from - b.from)) {
      if (r.from > end) return true; end = Math.max(end, r.to); if (end >= limit) return false;
    }
    return end < limit;
  };
  // Material inside a record (map.4: an example, a sample under test, as the reply read it) grounds nothing of the map alone.
  const material = reply.material ?? [];
  const own = (q: MapReplyQuote) => !material.some(m => m.record === q.record && q.from !== undefined && q.to !== undefined && m.from < q.to && q.from < m.to);
  const usable = (q: MapReplyQuote) => freshQuote(q) && own(q);
  const asMaterial: ReadingSkip[] = [];
  const mapParts = reply.parts.flatMap(x => {
    const basis = x.basis.filter(usable), claims = x.claims.filter(usable), role = basis.length ? x.role : null;
    if (x.name !== null && !basis.length && x.basis.some(freshQuote)) asMaterial.push({ what: 'part', name: x.name, reason: 'material' });
    if (x.name !== null ? !basis.length : !role && !claims.length) return [];
    return [{ ...x, basis, claims, role, roleAbout: role ? x.roleAbout : null, roleReplaces: role && x.roleReplaces && usable(x.roleReplaces) ? x.roleReplaces : null }];
  });
  const lineQuote = (r: MapReply['relations'][number]): MapReplyQuote => ({ record: r.record, quote: r.quote, ...(r.span ?? {}) });
  for (const r of reply.relations) if (freshQuote(lineQuote(r)) && !own(lineQuote(r))) asMaterial.push({ what: 'relation', name: `${r.from}→${r.to}`, reason: 'material' });
  const mapRelations = reply.relations.filter(r => usable(lineQuote(r)));
  const comparisonOnly = frozen.length > 0 && [...input.records].every(([record, source]) => !freshQuote({ record, quote: source.text }));
  const active = (id: string) => project.space.areas.some(a => a.id === id && !a.archived);
  for (const id of input.parts.values()) if (!active(id)) throw new Error('MAP_CHANGED');
  // Anchored: the record's own passage where it was read, [from, to) of the record (the excerpt's offset added once).
  const real = (q: MapReplyQuote): ReadingQuote => {
    const source = input.records.get(q.record)!;
    if (q.from === undefined || q.to === undefined) return { record: source.id, quote: q.quote };
    return { record: source.id, quote: q.quote, from: source.from + q.from, to: source.from + q.to };
  };
  const claimOf = (c: MapReplyClaim): ReadingClaim => ({ kind: c.kind, text: c.text, ...real(c), about: c.about, replaces: c.replaces ? input.claims.get(c.replaces)! : null });
  let p = project;
  const ids = new Map(input.parts), skipped: ReadingSkip[] = [...asMaterial], candidates: ReadingCandidate[] = [], parts: ReadingPart[] = [], created: string[] = [];
  const parentOf = (id: string) => p.space.containment.parents[id] ?? null;
  const madeBefore = done.flatMap(r => r.parts.filter(x => x.created).map(x => ({ areaId: x.areaId, ...x.created! })));
  // New parts, parents first (the reply's own order otherwise).
  const queue = mapParts.filter(x => x.name !== null), dropped = new Set(reply.parts.filter(x => x.name !== null && !mapParts.some(p => p.ref === x.ref)).map(x => x.ref));
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
        candidates.push({ text: `‘${x.name}’: 같은 이름의 부분이 이미 있어 새로 만들지 않았어요. 같은 대상인지는 원문으로 확인해 주세요.`, areaIds: [same.id], quote: real(x.basis[0]!), ...(six ? { target: 'identity' as const, statement: null } : {}) });
        continue;
      }
      if (madeBefore.some(m => m.parentId === parentId && normName(m.name) === key && p.space.areas.some(a => a.id === m.areaId && a.archived))) {
        dropped.add(x.ref); skipped.push({ what: 'part', name: x.name!, reason: 'archived' }); continue;
      }
      p = parentId ? addChildArea(p, parentId, x.name!, '') : addArea(p, x.name!, '');
      const id = p.space.areas.at(-1)!.id; ids.set(x.ref, id); created.push(id);
      parts.push({ areaId: id, created: { name: p.space.areas.at(-1)!.name, parentId }, role: x.role, roleAbout: x.roleAbout, roleReplaces: null, basis: x.basis.map(real), claims: x.claims.map(claimOf) });
    }
  }
  // map.1–5: what the reply leaves undecided between parts is not also settled on one of them: a claim on a part a candidate
  // names, resting on the same quote as that candidate, stays with the candidate only. map.6 says what is undecided (target and
  // statement key) and refuses a reply that settles it too, so no claim is taken away for sharing a passage with a candidate.
  const unsure = reply.candidates.filter(c => c.quote && c.parts.length).map(c => ({ parts: new Set(c.parts.map(a => ids.get(a))), ...real({ record: c.record!, quote: c.quote!, ...(c.at ? c.at : {}) }) }));
  // Anchored passages overlap where they stand (a repeated sentence elsewhere is another passage); copied ones by their words.
  const overlaps = (a: ReadingQuote, b: ReadingQuote) => a.from !== undefined && b.from !== undefined ? a.from < b.to! && b.from < a.to! : a.quote.includes(b.quote) || b.quote.includes(a.quote);
  const settled = (areaId: string, c: ReadingClaim) => !unsure.some(u => u.parts.has(areaId) && u.record === c.record && overlaps(u, c));
  for (const x of mapParts) if (x.name === null) parts.push({ areaId: ids.get(x.ref)!, created: null, role: x.role, roleAbout: x.roleAbout, roleReplaces: x.roleReplaces ? real(x.roleReplaces) : null, basis: x.basis.map(real), claims: x.claims.map(claimOf) });
  if (!six) for (const part of parts) part.claims = part.claims.filter(c => settled(part.areaId, c));
  for (let i = parts.length - 1; i >= 0; i--) if (!parts[i]!.created && !parts[i]!.role && !parts[i]!.claims.length) parts.splice(i, 1);
  const relations: ReadingRelation[] = [];
  const madeRelations = done.flatMap(r => r.relations);
  for (const r of mapRelations) {
    const from = ids.get(r.from), to = ids.get(r.to), name = `${r.from}→${r.to}`;
    if (!from || !to) { skipped.push({ what: 'relation', name, reason: 'parent-skipped' }); continue; }
    if (p.space.relations.some(x => x.from === from && x.to === to && x.kind === r.kind)) { skipped.push({ what: 'relation', name, reason: 'exists' }); continue; }
    if (madeRelations.some(x => x.from === from && x.to === to && x.kind === r.kind && !p.space.relations.some(y => y.id === x.relationId))) { skipped.push({ what: 'relation', name, reason: 'removed' }); continue; }
    p = addRelation(p, from, to, r.kind, r.note);
    relations.push({ relationId: p.space.relations.at(-1)!.id, from, to, kind: r.kind, quote: real(lineQuote(r)) });
  }
  // A candidate naming a part this reply wanted to add but that was not added keeps its words, without that part.
  // map.6: it keeps what it leaves undecided, and an undecided statement itself (content, kind, version, exact place).
  for (const c of reply.candidates) candidates.push({ text: c.text, areaIds: c.parts.map(a => ids.get(a)).filter((x): x is string => !!x), quote: c.record ? real({ record: c.record, quote: c.quote!, ...(c.at ? c.at : {}) }) : null,
    ...(six ? { target: c.target!, statement: c.statement ? { kind: c.statement.kind, text: c.statement.text, about: c.statement.about, quote: real(c.statement) } : null } : {}) });
  // A withdrawal holds only for the match it was asked about as it still is: the person may have retargeted or excluded it (or
  // another record taken it back) while this was being read. Then the passage is kept and the link is not.
  const now = three ? requestMatches(project) : [];
  // Anchored: a passage of material is no report of this project's request, and none is kept as one.
  const matches: StoredRequestMatch[] = (reply.matches ?? []).filter(m => own(m)).map(({ from: rf, to: rt, ...m }) => {
    // An earlier version stores a returned report's place against its labelled Source.text (as such readings always were).
    const source = input.records.get(m.record)!, at = rf !== undefined && rt !== undefined ? { at: rf, length: rt - rf } : quoteAt(source.text, m.quote)!, shift = four ? 0 : texts.get(source.id)?.shift ?? 0, stored = { ...m, record: source.id, from: shift + source.from + at.at, to: shift + source.from + at.at + at.length };
    if (!three) return stored;
    const { replaces: key, ...rest } = stored as typeof stored & { replaces: string | null };
    const ref = key === null ? undefined : input.priors?.get(key), cur = ref && now.find(x => x.reading === ref.reading && x.index === ref.index);
    const holds = !!cur && !cur.excluded && !cur.replacedBy && !!cur.target && sameTarget(cur.target, ref!.target) && cur.correction === ref!.correction;
    return { ...rest, replaces: holds ? { reading: ref!.reading, index: ref!.index } : null };
  });
  const reading: MapReading = { version: six ? 'map-reading.5' : four ? 'map-reading.4' : three ? 'map-reading.3' : withRequests ? 'map-reading.2' : 'map-reading.1', id: meta.id, at: meta.at, model: meta.model, prompt: meta.prompt, hash: meta.hash,
    records: [...input.records.values()].map(r => { const shift = four ? 0 : texts.get(r.id)?.shift ?? 0;
      return shift ? { id: r.id, from: r.from + shift, to: r.to + shift, total: texts.get(r.id)!.raw.length } : { id: r.id, from: r.from, to: r.to, total: r.total, ...(four ? { digest: textDigest(r.text) } : {}) }; }),
    summary: comparisonOnly ? '이미 지도에 읽은 원문을 고른 요청과 다시 대조했어요.' : reply.summary, parts, relations, candidates: candidates.slice(0, 16), gaps: reply.gaps, skipped: skipped.slice(0, 64),
    ...(withRequests ? { requests: structuredClone(frozen), matches } : {}),
    ...(four ? { material: material.map(m => { const source = input.records.get(m.record)!; return { record: source.id, from: source.from + m.from, to: source.from + m.to, what: m.what }; }) } : {}) };
  // Anchored: a reply that gets nothing out of the records (no part, claim, line, candidate or match) and says why with gaps
  // (material it found lacking) is not kept: the records stay unread for the person to ask again (NOTHING_READ). A reply with
  // nothing to change and no such reason (the records add nothing to the map as it is) is a reading, kept as before.
  if (four && !parts.length && !relations.length && !candidates.length && !matches.length && reply.gaps.length) throw new Error('NOTHING_READ');
  p = addReading(p, reading);
  const next = parseProject(JSON.stringify(p));
  const corresponding = matches.filter(m => m.targets.length === 1).flatMap(m => {
    const target = m.targets[0]!, req = input.ask.requests?.find(q => q.id === target.requestId);
    return req?.items.find(i => i.id === target.itemId)?.partIds.filter(active) ?? [];
  });
  return { project: next, reading, created, touched: [...new Set([...parts.map(x => x.areaId), ...corresponding])] };
}
