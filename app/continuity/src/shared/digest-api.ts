/* studio.digest.1: a read-only reading of already prepared material across several parts of one map. The browser sends the
 * parts and the sources (each with its own basis and the parts it is about); the model answers with a few statements, each
 * bound to the sources it rests on and to at most two parts those sources are about. Nothing here writes a project, a plan,
 * a record or a return; a reply is a reading aid and never becomes a part's status or description. */

export const DIGEST_SCHEMA = 'studio.digest.1' as const;
export const DIGEST_BYTES = 65536;
/** Kinds of material. Only the outcome kinds can carry a statement that something changed in the program. */
export type DigestKind = 'user' | 'direction' | 'plan' | 'authored' | 'report' | 'code' | 'test' | 'review' | 'result';
export const DIGEST_KINDS: readonly DigestKind[] = ['user', 'direction', 'plan', 'authored', 'report', 'code', 'test', 'review', 'result'];
export const OUTCOME_KINDS: readonly DigestKind[] = ['authored', 'report', 'code', 'test', 'review', 'result'];
export const DIGEST_KIND_LABEL: Record<DigestKind, string> = {
  user: '사용자 기록', direction: '방향 기록', plan: '변경안 자료', authored: '작성자 설명', report: '작업 보고', code: '코드', test: '검사 기록', review: '검토·검사 기록', result: '돌아온 기록'
};

export interface DigestPart { id: string; name: string; note: string; parentId: string | null }
/** text is the material itself (a quote, a report, a record); note is what an editor or the app says about it. */
export interface DigestSource { id: string; kind: DigestKind; title: string; text: string; note: string; basis: string; partIds: string[] }
export interface DigestAsk {
  schemaVersion: typeof DIGEST_SCHEMA;
  project: { name: string; purpose: string | null };
  parts: DigestPart[];
  sources: DigestSource[];
  /** An open change plan of the project: what the person wanted to try, as context only. */
  plan: { intent: string; items: { title: string; partIds: string[] }[] } | null;
}
export interface DigestStatement { text: string; partIds: string[]; refs: string[] }
export interface DigestReply {
  changes: DigestStatement[];
  read: { partId: string; why: string; refs: string[] } | null;
  open: DigestStatement[];
  notCovered: string[];
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

/** The whole request within DIGEST_BYTES of UTF-8 JSON; nothing is clipped here. */
export function validateDigestAsk(value: unknown): DigestAsk {
  obj(value, ['schemaVersion', 'project', 'parts', 'sources', 'plan']);
  if (value.schemaVersion !== DIGEST_SCHEMA) throw new Error('UNSUPPORTED_VERSION');
  if (digestBytes(value) > DIGEST_BYTES) throw new Error('INPUT_TOO_LARGE');
  obj(value.project, ['name', 'purpose']); str(value.project.name, 120);
  if (value.project.purpose !== null) str(value.project.purpose, 2000);
  check(Array.isArray(value.parts) && value.parts.length >= 1 && value.parts.length <= 200);
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
    check(DIGEST_KINDS.includes(s.kind as DigestKind)); str(s.title, 200); str(s.text, 6000); str(s.note, 2000, true); str(s.basis, 600);
    idList(s.partIds, 32, PART_ID, parts, 0);
  }
  if (value.plan !== null) {
    obj(value.plan, ['intent', 'items']); str(value.plan.intent, 6000);
    check(Array.isArray(value.plan.items) && value.plan.items.length <= 32);
    for (const item of value.plan.items as unknown[]) { obj(item, ['title', 'partIds']); str(item.title, 200); idList(item.partIds, 32, PART_ID, parts, 0); }
  }
  return structuredClone(value as unknown as DigestAsk);
}

/** Exact keys, bounded text, refs only to sent sources, and parts only among the parts the cited sources are about.
 * Without any outcome material the reply may not claim a change. Anything else refuses the whole reply. */
export function validateDigestReply(value: unknown, ask: DigestAsk): DigestReply {
  const code = 'INVALID_RESPONSE';
  obj(value, ['changes', 'read', 'open', 'notCovered'], code);
  const sources = new Map(ask.sources.map(s => [s.id, s])), sourceIds = new Set(sources.keys()), partIds = new Set(ask.parts.map(p => p.id));
  const grounded = (refs: string[]) => new Set(refs.flatMap(r => sources.get(r)!.partIds));
  const statement = (v: unknown, minParts: number): DigestStatement => {
    obj(v, ['text', 'partIds', 'refs'], code); str(v.text, 240, false, code);
    idList(v.refs, 8, SOURCE_ID, sourceIds, 1, code); idList(v.partIds, 2, PART_ID, partIds, minParts, code);
    const about = grounded(v.refs); check(v.partIds.every(p => about.has(p)), code);
    return { text: v.text.trim(), partIds: [...v.partIds], refs: [...v.refs] };
  };
  check(Array.isArray(value.changes) && value.changes.length <= 3, code);
  const changes = (value.changes as unknown[]).map(x => statement(x, 1));
  if (!ask.sources.some(s => OUTCOME_KINDS.includes(s.kind))) check(changes.length === 0, code);
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
  check(changes.length + notCovered.length > 0, code);
  return { changes, read, open, notCovered };
}
