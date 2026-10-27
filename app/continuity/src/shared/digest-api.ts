/* studio.digest.1: a read-only reading of already prepared material across several parts of one map. The browser sends the
 * parts and the sources (each with its own basis and the parts it is about); the model answers with a few statements, each
 * bound to the sources it rests on and to at most two parts those sources are about. Nothing here writes a project, a plan,
 * a record or a return; a reply is a reading aid and never becomes a part's status or description. */

export const DIGEST_SCHEMA = 'studio.digest.1' as const;
/** studio.digest.2: digest.1 plus material the person pasted as it came (kind 'record') and, in the reply, recordReadings: a few
 * readings of that material, each resting on an exact quote of what was sent, with related parts only as candidates. A record
 * is never outcome material and never located (partIds []), so the checks of changes, read and open stay exactly as in digest.1. */
export const DIGEST2_SCHEMA = 'studio.digest.2' as const;
/** A pasted record may go longer than other material; the whole request still has to fit DIGEST_BYTES. */
export const RECORD_SENT_MAX = 12000;
export const DIGEST_BYTES = 65536;
/** Kinds of material. Only the outcome kinds can carry a statement that something changed in the program. */
export type DigestKind = 'user' | 'direction' | 'plan' | 'authored' | 'report' | 'code' | 'test' | 'review' | 'result' | 'record';
export const DIGEST_KINDS: readonly DigestKind[] = ['user', 'direction', 'plan', 'authored', 'report', 'code', 'test', 'review', 'result', 'record'];
export const OUTCOME_KINDS: readonly DigestKind[] = ['authored', 'report', 'code', 'test', 'review', 'result'];
export const DIGEST_KIND_LABEL: Record<DigestKind, string> = {
  user: '사용자 기록', direction: '방향 기록', plan: '변경안 자료', authored: '작성자 설명', report: '작업 보고', code: '코드', test: '검사 기록', review: '검토·검사 기록', result: '돌아온 기록', record: '붙여넣은 기록'
};

export interface DigestPart { id: string; name: string; note: string; parentId: string | null }
/** text is the material itself (a quote, a report, a record); note is what an editor or the app says about it. */
export interface DigestSource { id: string; kind: DigestKind; title: string; text: string; note: string; basis: string; partIds: string[] }
export interface DigestAsk {
  schemaVersion: typeof DIGEST_SCHEMA | typeof DIGEST2_SCHEMA;
  project: { name: string; purpose: string | null };
  parts: DigestPart[];
  sources: DigestSource[];
  /** An open change plan of the project: what the person wanted to try, as context only. */
  plan: { intent: string; items: { title: string; partIds: string[] }[] } | null;
}
export interface DigestStatement { text: string; partIds: string[]; refs: string[] }
/** One reading of a pasted record: what it says changed, what it says was and was not checked, or what it leaves to decide.
 * quote is text of the record as it was sent; related parts are candidates the model connected, each with its own quote. */
export type RecordReadingKind = 'change' | 'check' | 'open';
export const RECORD_READING_KINDS: readonly RecordReadingKind[] = ['change', 'check', 'open'];
export interface RecordCandidate { partId: string; quote: string; why: string }
export interface RecordReading { kind: RecordReadingKind; text: string; ref: string; quote: string; related: RecordCandidate[] }
export interface DigestReply {
  changes: DigestStatement[];
  read: { partId: string; why: string; refs: string[] } | null;
  open: DigestStatement[];
  notCovered: string[];
  /** digest.2 only. */
  recordReadings?: RecordReading[];
}

const PART_ID = /^P\d{2,3}$/, SOURCE_ID = /^[A-Z]{1,2}\d{2,3}$/;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
function check(ok: unknown, code = 'INVALID_INPUT'): asserts ok { if (!ok) throw new Error(code); }
function obj(v: unknown, keys: string[], code?: string): asserts v is Record<string, unknown> {
  check(!!v && typeof v === 'object' && !Array.isArray(v), code);
  check(Object.keys(v as object).length === keys.length && keys.every(k => Object.hasOwn(v as object, k)), code);
}
function str(v: unknown, max: number, empty = false, code?: string): asserts v is string {
  check(typeof v === 'string' && v.length <= max && (empty || !!v.trim()) && !CONTROL.test(v), code);
}
function idList(v: unknown, max: number, pattern: RegExp, allowed: Set<string>, min: number, code?: string): asserts v is string[] {
  check(Array.isArray(v) && v.length >= min && v.length <= max, code);
  for (const x of v as unknown[]) check(typeof x === 'string' && pattern.test(x) && allowed.has(x), code);
  check(new Set(v as string[]).size === (v as string[]).length, code);
}
export const digestBytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
/** Where a quote sits in a text: exactly, or with runs of white space read as one (a model may rewrap a line); null if nowhere. */
export function quoteAt(text: string, quote: string): { at: number; length: number } | null {
  const q = quote.trim(); if (!q) return null;
  const at = text.indexOf(q); if (at >= 0) return { at, length: q.length };
  const pattern = q.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const m = new RegExp(pattern).exec(text);
  return m ? { at: m.index, length: m[0].length } : null;
}

/** The whole request within DIGEST_BYTES of UTF-8 JSON; nothing is clipped here. */
export function validateDigestAsk(value: unknown): DigestAsk {
  obj(value, ['schemaVersion', 'project', 'parts', 'sources', 'plan']);
  if (value.schemaVersion !== DIGEST_SCHEMA && value.schemaVersion !== DIGEST2_SCHEMA) throw new Error('UNSUPPORTED_VERSION');
  const two = value.schemaVersion === DIGEST2_SCHEMA;
  if (digestBytes(value) > DIGEST_BYTES) throw new Error('INPUT_TOO_LARGE');
  obj(value.project, ['name', 'purpose']); str(value.project.name, 120);
  if (value.project.purpose !== null) str(value.project.purpose, 2000);
  check(Array.isArray(value.parts) && value.parts.length <= 200);
  const parts = new Set<string>();
  for (const p of value.parts as unknown[]) {
    obj(p, ['id', 'name', 'note', 'parentId']); check(typeof p.id === 'string' && PART_ID.test(p.id) && !parts.has(p.id));
    parts.add(p.id); str(p.name, 120); str(p.note, 2000, true);
  }
  for (const p of value.parts as DigestPart[]) check(p.parentId === null || (parts.has(p.parentId) && p.parentId !== p.id));
  check(Array.isArray(value.sources) && value.sources.length >= 1 && value.sources.length <= 48);
  const sources = new Set<string>();
  for (const s of value.sources as unknown[]) {
    obj(s, ['id', 'kind', 'title', 'text', 'note', 'basis', 'partIds']);
    check(typeof s.id === 'string' && SOURCE_ID.test(s.id) && !sources.has(s.id)); sources.add(s.id);
    // A record comes only in digest.2, and is never located: the part the person was looking at goes in its note as context.
    const record = s.kind === 'record'; check(DIGEST_KINDS.includes(s.kind as DigestKind) && (two || !record));
    str(s.title, 200); str(s.text, record ? RECORD_SENT_MAX : 6000); str(s.note, 2000, true); str(s.basis, 600);
    idList(s.partIds, record ? 0 : 32, PART_ID, parts, 0);
  }
  if (value.plan !== null) {
    obj(value.plan, ['intent', 'items']); str(value.plan.intent, 6000);
    check(Array.isArray(value.plan.items) && value.plan.items.length <= 32);
    for (const item of value.plan.items as unknown[]) { obj(item, ['title', 'partIds']); str(item.title, 200); idList(item.partIds, 32, PART_ID, parts, 0); }
  }
  return structuredClone(value as unknown as DigestAsk);
}

/** Exact keys, bounded text, refs only to sent sources, and parts only among the parts the cited sources are about.
 * Each change must cite outcome material; a source without a known location can support an unlocated statement. */
export function validateDigestReply(value: unknown, ask: DigestAsk): DigestReply {
  const code = 'INVALID_RESPONSE', two = ask.schemaVersion === DIGEST2_SCHEMA;
  obj(value, ['changes', 'read', 'open', 'notCovered', ...(two ? ['recordReadings'] : [])], code);
  const sources = new Map(ask.sources.map(s => [s.id, s])), sourceIds = new Set(sources.keys()), partIds = new Set(ask.parts.map(p => p.id));
  const grounded = (refs: string[]) => new Set(refs.flatMap(r => sources.get(r)!.partIds));
  const statement = (v: unknown, minParts: number): DigestStatement => {
    obj(v, ['text', 'partIds', 'refs'], code); str(v.text, 240, false, code);
    idList(v.refs, 8, SOURCE_ID, sourceIds, 1, code); idList(v.partIds, 2, PART_ID, partIds, minParts, code);
    const about = grounded(v.refs); check(v.partIds.every(p => about.has(p)), code);
    return { text: v.text.trim(), partIds: [...v.partIds], refs: [...v.refs] };
  };
  check(Array.isArray(value.changes) && value.changes.length <= 3, code);
  const changes = (value.changes as unknown[]).map(x => statement(x, 0));
  for (const change of changes) check(change.refs.some(r => OUTCOME_KINDS.includes(sources.get(r)!.kind)), code);
  let read: DigestReply['read'] = null;
  if (value.read !== null) {
    obj(value.read, ['partId', 'why', 'refs'], code); str(value.read.why, 240, false, code);
    idList(value.read.refs, 8, SOURCE_ID, sourceIds, 1, code);
    check(typeof value.read.partId === 'string' && grounded(value.read.refs).has(value.read.partId), code);
    read = { partId: value.read.partId, why: value.read.why.trim(), refs: [...value.read.refs] };
  }
  check(Array.isArray(value.open) && value.open.length <= 2, code);
  const open = (value.open as unknown[]).map(x => statement(x, 0));
  check(Array.isArray(value.notCovered) && value.notCovered.length <= 3, code);
  const notCovered = (value.notCovered as unknown[]).map(x => { str(x, 240, false, code); return (x as string).trim(); });
  if (!two) { check(changes.length + notCovered.length > 0, code); return { changes, read, open, notCovered }; }
  // Each reading quotes a record as sent (never the whole of it, never text beyond the excerpt); its parts are candidates among
  // the known parts, each with its own quote and a short reason. Containment is all this checks: not that the reading is right.
  const quote = (v: unknown, text: string): string => {
    str(v, 300, false, code); const q = (v as string).trim(); check(q.length >= 6 && q.length < text.trim().length && !!quoteAt(text, q), code); return q;
  };
  check(Array.isArray(value.recordReadings) && value.recordReadings.length <= 3, code);
  const recordReadings = (value.recordReadings as unknown[]).map((v): RecordReading => {
    obj(v, ['kind', 'text', 'ref', 'quote', 'related'], code);
    check(RECORD_READING_KINDS.includes(v.kind as RecordReadingKind), code); str(v.text, 240, false, code);
    const src = typeof v.ref === 'string' ? sources.get(v.ref) : undefined; check(!!src && src.kind === 'record', code);
    check(Array.isArray(v.related) && v.related.length <= 2, code);
    const related = (v.related as unknown[]).map((c): RecordCandidate => {
      obj(c, ['partId', 'quote', 'why'], code); check(typeof c.partId === 'string' && partIds.has(c.partId), code); str(c.why, 120, false, code);
      return { partId: c.partId, quote: quote(c.quote, src!.text), why: c.why.trim() };
    });
    check(new Set(related.map(c => c.partId)).size === related.length, code);
    return { kind: v.kind as RecordReadingKind, text: v.text.trim(), ref: v.ref as string, quote: quote(v.quote, src!.text), related };
  });
  check(changes.length + notCovered.length + recordReadings.length > 0, code);
  return { changes, read, open, notCovered, recordReadings };
}
