/* The growing map (ruling F6 Q4, Q5): the same map, and time as something one chooses to look at.
 * - A map version is one map reading (1-based, 「지도 v07」): the readings are append-only, so version k is rebuilt from the prefix of the
 *   readings up to and including the k-th map reading, by the very functions that draw the map now (identityState, currentView,
 *   partUnderstanding). Parts made later are left out, a past name is the official name of the prefix unless the person named the part, and no
 *   later rename, retirement or fold is applied to the past (the prefix has none of them).
 * - The past is rebuilt from the records only. The person's edits made before the edit log started have no time and are never dated after
 *   the fact (left out, and counted so the view can say so); a logged edit (Project.edits) is applied when it came before the version.
 * - The change set between two versions comes from the two rebuilt versions themselves (both-ends difference: a part made and retired between
 *   them is in neither; a rename and back is no rename), each change with the reading, row and record that made it.
 * - 미반영: the rows of the records read up to a version that are not reflected (waiting, held, rejected), each with plain reason words.
 * Nothing here calls a model or changes a project. */
import { isMapReading, ROW_REASONS, type MapReading, type Project, type Relation, type RelationKind, type RowState, type ReadingIdentityRow, type GrowthMemo, type HumanEdit } from './types.js';
import { identityState, officialName, currentView, canonicalPart } from './map-identity.js';
import { studioView, type StudioView, type PartView } from './studio.js';
import { rowLedger, rowBindings, type LedgerRow } from './row-ledger.js';
import { v5Folds, type V5Fold } from './record-excerpt.js';

/* ---------- versions ---------- */
export interface MapVersion {
  /** 1-based. */
  n: number; id: string; at: string;
  /** 기록 대상 판본: the target version the reading's records name (as written), else the basis time they name, else null. */
  target: string | null;
  /** The readings slice end: readings.slice(0, end) is this version. */
  end: number }
export function mapVersions(p: Pick<Project, 'readings'>): MapVersion[] {
  const out: MapVersion[] = [];
  p.readings.forEach((r, i) => { if (isMapReading(r)) out.push({ n: out.length + 1, id: r.id, at: r.at, target: r.basisVersion ?? r.basisAt ?? null, end: i + 1 }); });
  return out;
}
/** 「지도 v07」: two digits at least. */
export const versionLabel = (n: number): string => `지도 v${String(n).padStart(2, '0')}`;
/** The words of the growth view (ruling F6 Q4). */
export const GROWTH_WORDS = Object.freeze({ version: '지도 버전', history: '지도 이력', target: '기록 대상 판본', plan: '변경 계획', lastVisit: '이전 방문', now: '현재로' });

/* ---------- the baseline (ruling F6 Q4: fixed at the visit's start, the version actually shown as the next visit's baseline) ---------- */
/** A visit: page loads of the same map no more than this far apart (a reload is the same visit). */
export const VISIT_GAP_MS = 30 * 60 * 1000;
/** The baseline of the visit starting now, from the memo the last write left. No memo: a first visit (no baseline, no 「이전 방문」). Within
 * VISIT_GAP_MS of the last write the visit goes on, and its own baseline stays (a reload never moves it); after that, the version the last
 * visit showed is the baseline. */
export function visitBaseline(stored: GrowthMemo | null | undefined, now: number): { base: number | null; continuing: boolean } {
  if (!stored) return { base: null, continuing: false };
  const last = Date.parse(stored.at), continuing = Number.isFinite(last) && now - last < VISIT_GAP_MS && now - last > -VISIT_GAP_MS;
  return { base: continuing ? stored.base : stored.seen, continuing };
}
/** The memo to write while the map is looked at: the version shown now (the current map, never a past one being looked at), this
 * visit's baseline as fixed at its start, and the person's own pick. */
export const growthMemo = (base: number | null, shown: number, pick: number | null, now: number): GrowthMemo => ({ seen: Math.max(1, shown), at: new Date(now).toISOString(), base, pick });
/** The baseline to compare with: an earlier version that exists, else null (nothing to say). */
export const compareBase = (base: number | null, current: number): number | null => (base !== null && base >= 1 && base < current ? base : null);

/* ---------- a past version, rebuilt from the records ---------- */
export interface PastVersion { project: Project; view: StudioView;
  /** The person's edits applied (logged before the version, or a part the person made before it, which has its own time). */
  applied: number;
  /** The person's edits left out because they have no time (made before the log started): archives, parent moves, relations. */
  undated: number }
const pastCache = new WeakMap<Project, Map<number, PastVersion>>();
/** The value a logged attribute had at a time: the last change at or before it, else the value before the first change, else none. */
function loggedAt<T>(edits: readonly HumanEdit[], at: string, pick: (e: HumanEdit) => { before: T; after: T } | null): { value: T; dated: boolean } | null {
  const list = edits.map(e => ({ e, v: pick(e) })).filter((x): x is { e: HumanEdit; v: { before: T; after: T } } => !!x.v);
  if (!list.length) return null;
  const done = list.filter(x => x.e.at <= at);
  return { value: done.length ? done.at(-1)!.v.after : list[0]!.v.before, dated: done.length > 0 };
}
/** Version k of the map (1-based) as the records alone made it, with the person's dated edits. Throws for a version that does not exist. */
export function pastVersion(p: Project, k: number): PastVersion {
  const memo = pastCache.get(p) ?? pastCache.set(p, new Map()).get(p)!, hit = memo.get(k); if (hit) return hit;
  const v = mapVersions(p)[k - 1]; if (!v) throw new Error('VERSION_MISSING');
  const readings = p.readings.slice(0, v.end), at = v.at, full = identityState(p), edits = p.edits?.entries ?? [];
  const made = new Map<string, { name: string; parentId: string | null }>();
  for (const r of readings) if (isMapReading(r)) for (const x of r.parts) if (x.created && !made.has(x.areaId)) made.set(x.areaId, x.created);
  let applied = 0, undated = 0;
  const prefixSpace = { readings, space: p.space };
  const areas = p.space.areas.flatMap(a => {
    const byReading = full.created.has(a.id);
    if (byReading ? !made.has(a.id) : !(a.createdAt <= at)) return [];
    if (!byReading) applied++;
    // A past name: the official name of the prefix, unless the part's name is the person's own (it stays).
    const name = byReading && a.name === officialName(p, a.id) ? officialName(prefixSpace, a.id) : a.name;
    const arch = loggedAt<boolean>(edits, at, e => (e.kind === 'archive' && e.target === a.id ? e : null));
    if (arch) { if (arch.dated) applied++; } else if (a.archived) undated++;
    return [{ ...a, name, archived: arch?.value ?? false }];
  });
  const ids = new Set(areas.map(a => a.id)), parents: Record<string, string> = {}, revisions: Record<string, number> = {};
  for (const a of areas) {
    revisions[a.id] = 0;
    const first = made.get(a.id)?.parentId ?? (full.created.has(a.id) ? null : p.space.containment.parents[a.id] ?? null);
    const lg = loggedAt<string | null>(edits, at, e => (e.kind === 'parent' && e.target === a.id ? e : null));
    const now = p.space.containment.parents[a.id] ?? null;
    if (!lg && now !== first && full.created.has(a.id)) undated++;
    if (lg?.dated) applied++;
    const parent = lg ? lg.value : first;
    if (parent && ids.has(parent)) parents[a.id] = parent;
  }
  // Relations: every line a reading up to k made (its id, ends and kind as read; the note as it stands now when the line is still there),
  // with the logged additions and removals before k; a relation the person made with no log entry has no time and is left out.
  const byId = new Map(p.space.relations.map(r => [r.id, r])), rels = new Map<string, Relation>();
  for (const r of readings) if (isMapReading(r)) for (const x of r.relations) if (!x.also && !rels.has(x.relationId)) rels.set(x.relationId, { id: x.relationId, from: x.from, to: x.to, kind: x.kind, note: byId.get(x.relationId)?.note ?? '' });
  const readMade = new Set<string>(); for (const r of p.readings) if (isMapReading(r)) for (const x of r.relations) readMade.add(x.relationId);
  const logged = new Set<string>();
  for (const e of edits) {
    if (e.kind !== 'relation-add' && e.kind !== 'relation-remove') continue;
    logged.add(e.target); if (e.at > at) continue;
    if (e.kind === 'relation-add') { rels.set(e.target, { id: e.after.id, from: e.after.from, to: e.after.to, kind: e.after.kind, note: e.after.note }); applied++; }
    else if (rels.delete(e.target)) applied++;
  }
  for (const r of p.space.relations) if (!readMade.has(r.id) && !logged.has(r.id)) undated++;
  const { edits: _log, ...rest } = p; void _log;
  const project: Project = { ...rest, readings,
    pasted: pastedAt(p, readings, at),
    space: { ...p.space, areas, relations: [...rels.values()].filter(r => ids.has(r.from) && ids.has(r.to)), containment: { version: 'containment.1', parents, revisions } } };
  const out: PastVersion = { project, view: currentView(project, studioView(project)), applied, undated };
  memo.set(k, out); return out;
}
/** The records as they stood for a version: every pasted text a reading up to it read, and any other pasted no later than it that no later
 * reading read (a text pasted after it, or read only later, is not yet there). */
function pastedAt(p: Project, readings: Project['readings'], at: string) {
  const readBy = (rs: Project['readings']) => new Set(rs.flatMap(r => (isMapReading(r) ? r.records.map(x => x.id) : [])));
  const now = readBy(readings), ever = readBy(p.readings);
  return p.pasted.filter(x => now.has(x.id) || (!ever.has(x.id) && x.at <= at));
}

/* ---------- the change set between two versions ---------- */
export const CHANGE_KINDS = ['new', 'rename', 'reimpl', 'desc', 'correct', 'dedupe', 'merge', 'succeed', 'retire'] as const;
export type ChangeKind = typeof CHANGE_KINDS[number];
/** The tab words (ruling F6 Q4). A description update is 설명, never 정정; a fold the map made is 중복 정리, never 합침 or 통합 (통합 is a
 * record's own 합침, which the readings keep as written and never apply: it is never counted until one is). */
export const CHANGE_WORD: Readonly<Record<ChangeKind, string>> = Object.freeze({ new: '새', rename: '이름', reimpl: '구현', desc: '설명', correct: '정정', dedupe: '중복 정리', merge: '통합', succeed: '승계', retire: '은퇴' });
/** Which word a changed card's tab shows first (the others count in its 「+N」). */
export const TAB_ORDER: readonly ChangeKind[] = ['succeed', 'new', 'rename', 'reimpl', 'dedupe', 'merge', 'correct', 'desc', 'retire'];
/** The order of the summary line's items. */
export const SUMMARY_ORDER: readonly ChangeKind[] = ['new', 'rename', 'reimpl', 'dedupe', 'merge', 'succeed', 'retire', 'correct'];
export interface IdentityCite { reading: string; at: string; record: string; row: string; when: string | null;
  /** The record's own part row the identity row names (B…), null when none. */
  part: string | null; evidence: string[]; place: { record: string; from: number; to: number } | null }
export interface PartChange {
  kind: ChangeKind;
  /** The part the change is marked on: the new, renamed, re-described or corrected part; the canonical part of a 중복 정리; the successor of
   * a 승계; the retired part itself for 은퇴 (it is on the earlier version only). */
  part: string;
  /** Its name at the later version (for 은퇴: at the earlier one). */
  name: string;
  /** Before → after as the change has them: names (이름), implementations (구현), descriptions (설명, 정정). */
  before?: string | null; after?: string | null;
  /** 중복 정리: the duplicates folded onto the part. 승계: the retired predecessor. 은퇴: the successor (null: none). */
  others?: string[]; predecessor?: string; successor?: string | null;
  /** 설명: how the earlier description was taken over ('bound': a record that bound the part described it anew; 'stated': the record said
   * its description replaces it) and the 기준 시점 of the record that took over, when known. */
  replaced?: 'bound' | 'stated' | null; target?: string | null;
  /** 새: the version whose reading made the part. */
  since?: number | null;
  /** The identity row that made the change (이름, 구현, 중복 정리, 승계, 은퇴), with 바뀐 때 and its F/E cites. */
  cite?: IdentityCite | null }
export interface LineKey { id: string; from: string; to: string; kind: RelationKind }
export interface ChangeSet { from: number; to: number; changes: PartChange[];
  /** Per kind: how many changes (a 중복 정리 counts once per canonical part). */
  counts: Record<ChangeKind, number>;
  /** How many distinct parts changed (a part in two kinds counts once here, in both kinds above). */
  parts: number;
  /** Lines in the later version not in the earlier (by ends and kind, a folded end read as its canonical part), and the reverse. */
  added: LineKey[]; removed: LineKey[] }
const normText = (t: string) => t.replace(/\s+/g, ' ').trim();
const normName = (t: string) => t.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
function citeOf(p: Project, reading: string, record: string, row: string): IdentityCite | null {
  const r = p.readings.find((x): x is MapReading => isMapReading(x) && x.id === reading); if (!r) return null;
  const x = (r.identity ?? []).find((y: ReadingIdentityRow) => y.record === record && y.id === row);
  return { reading, at: r.at, record, row, when: x?.when ?? null, part: x?.part ?? null, evidence: [...x?.evidence ?? []], place: x ? { ...x.at } : null };
}
/** The changes from version a to version b (a < b, both 1-based; b may be the latest), from the two versions as rebuilt. */
export function changeSet(p: Project, a: number, b: number): ChangeSet {
  const A = pastVersion(p, a), B = pastVersion(p, b), vs = mapVersions(p), window = new Set(vs.slice(a, b).map(v => v.id));
  const sA = identityState(A.project), sB = identityState(B.project);
  const inA = new Map(A.view.parts.map(x => [x.id, x])), inB = new Map(B.view.parts.map(x => [x.id, x]));
  const changes: PartChange[] = [];
  const add = (c: PartChange) => changes.push(c);
  for (const [id, x] of inB) if (!inA.has(id)) {
    // A part on the later version only: new, unless it is a duplicate that was folded (it is then on neither).
    add({ kind: 'new', part: id, name: x.name, since: vs.find(v => v.n > a && v.n <= b && (p.readings[v.end - 1] as MapReading).parts.some(q => q.areaId === id && !!q.created))?.n ?? null });
  }
  for (const [id, y] of inB) {
    const x = inA.get(id); if (!x) continue;
    const renames = (sB.renames.get(id) ?? []).filter(r => window.has(r.reading));
    if (renames.length && normName(x.name) !== normName(y.name)) {
      const last = renames.at(-1)!;
      const row = (p.readings.find((r): r is MapReading => isMapReading(r) && r.id === last.reading)?.identity ?? []).find(q => q.op?.kind === 'rename' && q.op.areaId === id);
      add({ kind: 'rename', part: id, name: y.name, before: x.name, after: y.name, cite: row ? citeOf(p, last.reading, row.record, row.id) : null });
    }
    const re = (sB.reimplemented.get(id) ?? []).filter(r => window.has(r.reading));
    if (re.length) add({ kind: 'reimpl', part: id, name: y.name, before: re[0]!.from, after: re.at(-1)!.to, cite: citeOf(p, re.at(-1)!.reading, re.at(-1)!.record, re.at(-1)!.row) });
    const ux = x.reading, uy = y.reading;
    const corrected = (uy?.corrected?.id ?? null) !== (ux?.corrected?.id ?? null) && !!uy?.corrected;
    if (corrected) add({ kind: 'correct', part: id, name: y.name, before: ux?.role ?? null, after: uy?.role ?? null });
    else if (ux?.role && uy?.role && normText(ux.role) !== normText(uy.role)) {
      const was = uy.others.find(o => normText(o.text) === normText(ux.role!));
      add({ kind: 'desc', part: id, name: y.name, before: ux.role, after: uy.role, replaced: was?.replaced ?? null, target: was?.target ?? null });
    }
  }
  // 중복 정리: duplicates on the earlier version folded (between the two) onto a part on the later one, one change per canonical part.
  const folds = new Map<string, string[]>();
  for (const [dup] of sB.folded) if (inA.has(dup) && !inB.has(dup) && !sA.folded.has(dup)) { const c = canonicalPart(sB, dup); if (inB.has(c)) folds.set(c, [...folds.get(c) ?? [], dup]); }
  for (const [c, dups] of folds) add({ kind: 'dedupe', part: c, name: inB.get(c)!.name, others: dups });
  // 은퇴 and 승계: a part on the earlier version that a record retired between the two (its successor, when on the later version, 승계).
  for (const [id, r] of sB.retired) {
    if (!inA.has(id) || inB.has(id) || !window.has(r.reading)) continue;
    const cite = citeOf(p, r.reading, r.record, r.row), succ = r.successor && inB.has(canonicalPart(sB, r.successor)) ? canonicalPart(sB, r.successor) : null;
    add({ kind: 'retire', part: id, name: inA.get(id)!.name, successor: succ, cite });
    if (succ) add({ kind: 'succeed', part: succ, name: inB.get(succ)!.name, predecessor: id, cite });
  }
  const counts = Object.fromEntries(CHANGE_KINDS.map(k => [k, changes.filter(c => c.kind === k).length])) as Record<ChangeKind, number>;
  // Lines, by ends and kind; an earlier end that is now a folded duplicate reads as its canonical part (the same line).
  const keyOf = (from: string, to: string, kind: string) => `${from}\u0000${to}\u0000${kind}`;
  const linesB = new Map(B.view.relations.map(r => [keyOf(r.from, r.to, r.kind), r]));
  const linesA = new Map<string, LineKey>();
  for (const r of A.view.relations) { const from = sB.folded.has(r.from) ? canonicalPart(sB, r.from) : r.from, to = sB.folded.has(r.to) ? canonicalPart(sB, r.to) : r.to; if (from !== to) linesA.set(keyOf(from, to, r.kind), { id: r.id, from: r.from, to: r.to, kind: r.kind }); }
  const added = [...linesB].filter(([k]) => !linesA.has(k)).map(([, r]) => ({ id: r.id, from: r.from, to: r.to, kind: r.kind }));
  const removed = [...linesA].filter(([k]) => !linesB.has(k)).map(([, r]) => r);
  return { from: a, to: b, changes, counts, parts: new Set(changes.flatMap(c => [c.part, ...c.others ?? []])).size, added, removed };
}
/** The lines a change touched directly: the added and removed lines with an end at the part (or its predecessor, for 승계). */
export function directLines(cs: ChangeSet, c: PartChange): { added: LineKey[]; removed: LineKey[] } {
  const ends = new Set([c.part, ...(c.predecessor ? [c.predecessor] : []), ...c.others ?? []]);
  const at = (l: LineKey) => ends.has(l.from) || ends.has(l.to);
  return { added: cs.added.filter(at), removed: cs.removed.filter(at) };
}

/* ---------- 미반영: the rows not reflected, read up to a version ---------- */
export const ROW_STATE_WORD: Readonly<Record<Exclude<RowState, 'reflected'>, string>> = Object.freeze({ waiting: '대기', held: '보류', rejected: '거절' });
/** Plain words for every row reason (types.ts ROW_REASONS), by state. Never the code itself. */
export const ROW_REASON_WORDS: Readonly<Record<string, string>> = Object.freeze({
  'waiting:limit': '한 번에 넣을 수 있는 양을 넘어 다음 읽기로 미룸',
  'waiting:budget': '요청에 자리가 모자라 이번에는 보내지 않음',
  'waiting:unresolved-endpoint': '이어질 부품이 아직 지도에 없음',
  'waiting:transient': '보냈지만 아직 지도에 놓이지 않음 · 다시 보냄',
  'waiting:not-yet-sent': '아직 읽지 않음',
  'held:identity': '이미 있는 부품과 같은 것인지 정해지지 않음',
  'held:parent': '어느 부품 안에 들어가는지 정해지지 않음',
  'held:attribution': '어느 부품에 대한 말인지 정해지지 않음',
  'held:holds': '그 말이 맞는지 정해지지 않음',
  'held:depends': '이 행이 기대는 다른 행이 보류됨',
  'held:correction': '고쳐 달라고 한 것이 아직 채워지지 않음',
  'held:roster': '기록을 쓴 뒤 지도가 바뀌어 대응을 다시 봐야 함',
  'held:revision': '마지막 검토에서 다시 보기로 함',
  'rejected:material': '이 프로젝트의 것이 아닌 예시나 자료로 읽음',
  'rejected:depends': '이 행이 기대는 다른 행이 거절됨',
  'rejected:unplaced': '여러 번 보냈지만 지도에 놓이지 않음',
  'rejected:form': '표의 형식이 맞지 않음',
  'rejected:unknown-part': '지도에 없는 부품 번호를 가리킴',
  'rejected:other-project': '다른 프로젝트의 지도를 가리킴',
  'rejected:unsupported': '아직 지도에 반영하지 않는 종류의 행',
  'rejected:undecided': '기록이 대응을 모른다고 함',
  'rejected:planned': '계획만 있고 아직 바뀌지 않음',
  'rejected:partial': '일부만 바뀌어 통째로 바꾸지 않음',
  'rejected:unconfirmed': '바뀐 때나 대신하는 부품이 확인되지 않음',
  'rejected:revision': '다시 검토해도 보류되어 더 보내지 않음',
  'rejected:empty-group': '안에 아무것도 없는 묶음이라 만들지 않음' });
export const rowReasonWords = (state: RowState, reason: string | null): string => (reason ? ROW_REASON_WORDS[`${state}:${reason}`] ?? '이유가 적히지 않음' : '이유가 적히지 않음');
/** Every reason the ledger can give (for the words' completeness). */
export const allRowReasons = (): string[] => (Object.entries(ROW_REASONS) as [RowState, readonly string[]][]).flatMap(([s, rs]) => rs.map(r => `${s}:${r}`));
export interface Unreflected { state: Exclude<RowState, 'reflected'>; reason: string | null; words: string;
  /** The record (fold key), the table and the row's own ID. */
  record: string; table: string; id: string;
  /** What the row tried: its 이름 cell (a part row), else its cells as written, joined. */
  tried: string;
  /** The parts it is about (held with, bound, the parts its B ids are bound to), at that version. */
  parts: string[];
  /** The source line: the pasted text, [start, end) in it and its 1-based line number. */
  paste: string; start: number; end: number; line: number }
/** The columns that are references, not what the row says (its ID, its cites, the files it is filed under). */
const REF_COLS = new Set(['행 ID', 'F ID', 'E ID', '근거', '담당 F']);
/** A row's cells as plain words: a part row's ID (B…) reads as the record's own name for that part; any other code goes. */
export function plainCells(cells: readonly string[], partName: (id: string) => string | null): string {
  return cells.map(v => v.replace(/(?<![A-Za-z0-9])B\d{1,3}(?!\d)/g, b => partName(b) ?? '')
    .replace(/(?<![A-Za-z0-9])(?:ID|CH|[A-Z])\d{1,3}(?!\d)/g, '')
    .split(/\s*[·+,]\s*/).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ')).filter(Boolean).join(' · ');
}
/** The rows not reflected among the records read up to version k (each record's rows by the ledger as it stood then), waiting first, then
 * held, then rejected, each in record order. */
export function unreflectedAt(p: Project, k: number): Unreflected[] {
  const past = pastVersion(p, k).project, folds = v5Folds(past.pasted); if (!folds.length) return [];
  const read = new Set(past.readings.flatMap(r => (isMapReading(r) ? r.records.map(x => x.id) : [])));
  const ledger = rowLedger(past, folds), live = new Set(past.space.areas.map(a => a.id)), bound = rowBindings(ledger, id => live.has(id));
  const foldOf = new Map<string, V5Fold>(folds.map(f => [f.key, f])), text = new Map(past.pasted.map(x => [x.id, x.text]));
  const rank: Record<string, number> = { waiting: 0, held: 1, rejected: 2 };
  const out: Unreflected[] = [];
  for (const x of ledger.values() as Iterable<LedgerRow>) {
    if (x.state === 'reflected' || !read.has(x.paste)) continue;
    const row = foldOf.get(x.record)?.fold.rows.get(x.table)?.find(r => r.id === x.id);
    const cells = row ? Object.entries(row.row.byColumn).filter(([c, v]) => !REF_COLS.has(c) && v.trim() && !/^[—–-]+$/.test(v.trim())).map(([, v]) => v.trim()) : [];
    const names = new Map((foldOf.get(x.record)?.fold.rows.get('C-PART') ?? []).map(r => [r.id, (r.row.byColumn['이름'] ?? '').trim()]));
    const tried = (x.name ?? plainCells(cells, b => names.get(b) || null)).replace(/\s+/g, ' ').trim();
    const ends = x.ends.map(b => bound.get(`${x.record}\u0000C-PART\u0000${b}`)).filter((y): y is string => !!y);
    const parts = [...new Set([...x.with, ...(x.bound ? [x.bound] : []), ...ends])].filter(id => live.has(id));
    const t = text.get(x.paste) ?? '';
    out.push({ state: x.state, reason: x.reason, words: rowReasonWords(x.state, x.reason), record: x.record, table: x.table, id: x.id, tried: tried.length > 160 ? `${tried.slice(0, 159)}…` : tried,
      parts, paste: x.paste, start: x.start, end: x.end, line: t.slice(0, x.start).split('\n').length });
  }
  return out.sort((a, b) => rank[a.state]! - rank[b.state]! || (a.paste < b.paste ? -1 : a.paste > b.paste ? 1 : a.start - b.start));
}
/** The F and E cites of an identity row in its record, as written: the file (경로 · 역할) or the evidence (출처 · 자리 · 짧은 인용). */
export function citeLines(p: Pick<Project, 'pasted'>, record: string, ids: readonly string[]): { id: string; text: string }[] {
  const f = v5Folds(p.pasted).find(x => x.key === record); if (!f) return [];
  return ids.flatMap(id => {
    const row = [...f.fold.rows.get('C-EVID') ?? [], ...f.fold.rows.get('C-SRC') ?? []].find(r => r.id === id); if (!row) return [];
    const c = row.row.byColumn, cols = id.startsWith('E') ? ['출처', '자리', '짧은 인용'] : ['경로', '역할'];
    const text = cols.map(k => (c[k] ?? '').trim()).filter(v => v && !/^[—–-]+$/.test(v)).join(' · ');
    return text ? [{ id, text }] : [];
  });
}
/** Why the record says a change was made, only when it says so: a 변화 이력 (C-CHANGE) row of the same record about the same part row (its
 * 바뀐 부분 names it) with its 원한 것 written; the one whose 날짜 is in 바뀐 때 first. null: the record gives no reason. */
export function changeReason(p: Pick<Project, 'pasted'>, record: string, part: string | null, when: string | null): { id: string; text: string; date: string | null } | null {
  if (!part) return null;
  const f = v5Folds(p.pasted).find(x => x.key === record); if (!f) return null;
  const said = (v: string | undefined) => { const t = (v ?? '').trim(); return t && !/^[—–-]+$/.test(t) && !/^(모름|없음)$/.test(t) ? t : null; };
  const rows = (f.fold.rows.get('C-CHANGE') ?? []).filter(r => new RegExp(`(?<![A-Za-z0-9])${part}(?!\\d)`).test(r.row.byColumn['바뀐 부분'] ?? '') && said(r.row.byColumn['원한 것']));
  const date = (r: typeof rows[number]) => said(r.row.byColumn['날짜']);
  const best = rows.find(r => !!when && !!date(r) && when.includes(date(r)!)) ?? rows[0]; if (!best) return null;
  return { id: best.id, text: said(best.row.byColumn['원한 것'])!, date: date(best) };
}
/** The parts of a version, by id (for names and descriptions). */
export const partsOf = (v: StudioView): Map<string, PartView> => new Map(v.parts.map(x => [x.id, x]));
