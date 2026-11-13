/* The growing map (ruling F6 Q4, Q5): the same map, and time as something one chooses to look at.
 * - A map version is one map reading (1-based, 「지도 v07」): the readings are append-only, so version k is rebuilt from the prefix of the
 *   readings up to and including the k-th map reading, by the very functions that draw the map now (identityState, currentView,
 *   partUnderstanding). Parts made later are left out, a past name is the record's official name of the prefix and a past note is empty
 *   (the person's own name or note there is an edit with no time, unless the log dates it), and no later rename, retirement or fold is
 *   applied to the past (the prefix has none of them).
 * - The latest version is the live map: the project and the view as they stand (every reading, the person's corrections and every other
 *   entry after the last map reading, the archive state now), never a rebuild (versionAt).
 * - The past is rebuilt from the records only. The person's edits made before the edit log started have no time and are never dated after
 *   the fact (left out, and counted so the view can say so); a logged edit (Project.edits) is applied when it came before the version.
 * - The change set between two versions comes from the two rebuilt versions themselves (both-ends difference: a part made and retired between
 *   them is in neither; a rename and back is no rename), each change with the reading, row and record that made it.
 * - 기록 반영 상태 (ruling F7): the rows of the records read up to a version that are not reflected (waiting, held, rejected), each source
 *   row once with plain reason words, its item title and the one part group it shows in; a record no reading has read yet is never one of
 *   them (unreadRecords counts those apart).
 * - 구현 상태 (F7): only the records' structured implementation field of the same part (implementationAt), never a 구현 바뀜 answer.
 * Nothing here calls a model or changes a project. */
import { isMapReading, ROW_REASONS, type MapReading, type Project, type Relation, type RelationKind, type RowState, type ReadingIdentityRow, type GrowthMemo, type HumanEdit, type PartImplementation, type ReadingQuote } from './types.js';
import { identityState, officialName, currentView, canonicalPart } from './map-identity.js';
import { studioView, type StudioView, type PartView } from './studio.js';
import { rowLedger, rowBindings, type LedgerRow } from './row-ledger.js';
import { v5Folds, type V5Fold } from './record-excerpt.js';
import { V5_TABLE_DEFS } from './record-table.js';
import { claimTopic } from './claim-topic.js';
import { josa, josaPair } from './josa.js';

/* ---------- versions ---------- */
export interface MapVersion {
  /** 1-based. */
  n: number; id: string; at: string;
  /** 기록 대상 판본: the target version the reading's records name (as written), else the basis time they name, else null. */
  target: string | null;
  /** Review of v7: what target is: a version the records name ('version': 기록 대상 판본) or a basis time ('date': 기록 대상 날짜). */
  targetKind: 'version' | 'date' | null;
  /** The readings slice end: readings.slice(0, end) is this version. */
  end: number }
export function mapVersions(p: Pick<Project, 'readings'>): MapVersion[] {
  const out: MapVersion[] = [];
  p.readings.forEach((r, i) => { if (isMapReading(r)) out.push({ n: out.length + 1, id: r.id, at: r.at, target: r.basisVersion ?? r.basisAt ?? null, targetKind: r.basisVersion ? 'version' : r.basisAt ? 'date' : null, end: i + 1 }); });
  return out;
}
/** 「지도 v07」: two digits at least. */
export const versionLabel = (n: number): string => `지도 v${String(n).padStart(2, '0')}`;
/** What a 기록 대상 is called by its kind (review of v7: a version is never a date). */
export const targetWord = (kind: 'version' | 'date' | null): string => (kind === 'date' ? '기록 대상 날짜' : '기록 대상 판본');
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
  /** The person's edits left out because they have no time (made before the log started): names, notes, archives, parent moves, relations. */
  undated: number;
  /** The live map (the latest version as it stands), not a rebuild. */
  live?: boolean }
const liveCache = new WeakMap<Project, PastVersion>();
/** Version k as a comparison or the 미반영 panel reads it: the latest version is the live map (the project and its view now, every entry
 * after the last map reading and the archive state included), an earlier one is rebuilt (pastVersion). */
export function versionAt(p: Project, k: number): PastVersion {
  if (k !== mapVersions(p).length) return pastVersion(p, k);
  const hit = liveCache.get(p); if (hit) return hit;
  const out: PastVersion = { project: p, view: currentView(p, studioView(p)), applied: 0, undated: 0, live: true };
  liveCache.set(p, out); return out;
}
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
  // The record's official name at a time (the readings up to it): what a name the log found already there is measured against.
  const officialAt = (id: string, t: string) => officialName({ readings: p.readings.filter(r => r.at <= t), space: p.space }, id);
  const areas = p.space.areas.flatMap(a => {
    const byReading = full.created.has(a.id);
    if (byReading ? !made.has(a.id) : !(a.createdAt <= at)) return [];
    if (!byReading) applied++;
    // A past name and note: a logged value at or before the version; else, for a part a reading made, the record's official name of the
    // prefix and no note (a name or note of the person's own with no time is never dated after the fact: left out and counted). A part the
    // person made has its own time: its name and note are those logged for the version (a later logged edit reads as its before-value).
    const lgName = loggedAt<string>(edits, at, e => (e.kind === 'name' && e.target === a.id ? e : null));
    const lgNote = loggedAt<string>(edits, at, e => (e.kind === 'note' && e.target === a.id ? e : null));
    let name = a.name, note = a.note;
    if (lgName?.dated) { name = lgName.value; applied++; }
    // A part the person made: a name logged only after the version reads as it was then (the first logged change's before-value).
    else if (!byReading && lgName) name = lgName.value;
    else if (byReading) {
      const base = lgName ? lgName.value : a.name, first = lgName ? edits.find(e => e.kind === 'name' && e.target === a.id)!.at : null;
      name = officialName(prefixSpace, a.id);
      if (normName(base) !== normName(first ? officialAt(a.id, first) : officialName(p, a.id))) undated++;
    }
    if (lgNote?.dated) { note = lgNote.value; applied++; }
    else if (!byReading && lgNote) note = lgNote.value;
    else if (byReading) { if ((lgNote ? lgNote.value : a.note).trim()) undated++; note = ''; }
    // An archive: a logged one at or before the version; one with no time is left out (and counted).
    const arch = loggedAt<boolean>(edits, at, e => (e.kind === 'archive' && e.target === a.id ? e : null));
    if (arch?.dated) applied++; else if (arch ? arch.value : a.archived) undated++;
    return [{ ...a, name, note, archived: arch?.dated ? arch.value : false }];
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
export const CHANGE_KINDS = ['new', 'rename', 'reimpl', 'impl', 'desc', 'correct', 'dedupe', 'merge', 'succeed', 'retire'] as const;
export type ChangeKind = typeof CHANGE_KINDS[number];
/** The tab words (ruling F6 Q4; F7). A description update is 설명, never 정정; a fold the map made is 중복 정리, never 합침 or 통합 (통합 is a
 * record's own 합침, which the readings keep as written and never apply: it is never counted until one is). 구현 상태 (F7) is its own kind,
 * read only from the records' structured implementation field; 구현 바뀜 is a record's identity answer (another implementation of the same
 * part), never a 구현 상태. */
export const CHANGE_WORD: Readonly<Record<ChangeKind, string>> = Object.freeze({ new: '새', rename: '이름', reimpl: '구현 바뀜', impl: '구현 상태', desc: '설명', correct: '정정', dedupe: '중복 정리', merge: '통합', succeed: '승계', retire: '은퇴' });
/** Ruling F7 (먼저 보여주는 순서, never an importance): 정정 > 승계 > 후계 없는 은퇴 > 구현 상태 > 이름 > 설명 > 중복 정리 > 새. 구현 바뀜 stands
 * by 구현 상태 and 통합 by 중복 정리. A retirement inside a 승계 is that 승계's scene, never its own. */
export const SCENE_ORDER: readonly ChangeKind[] = ['correct', 'succeed', 'retire', 'impl', 'reimpl', 'rename', 'desc', 'dedupe', 'merge', 'new'];
/** Which word a changed card's tab shows first (the others count in its 「+N」): the scene order. */
export const TAB_ORDER: readonly ChangeKind[] = SCENE_ORDER;
/** The order of the summary line's items (the scene order; 설명 and 새 are the line's two filters, at its end). */
export const SUMMARY_ORDER: readonly ChangeKind[] = ['correct', 'succeed', 'retire', 'impl', 'reimpl', 'rename', 'dedupe', 'merge'];
/** The structured implementation words of a record (C-PART 구현 상태), as the growth view says them. */
export const IMPL_WORD: Readonly<Record<PartImplementation, string>> = Object.freeze({ built: '구현됨', partial: '일부 구현', unbuilt: '미구현', removed: '제거됨', unknown: '모름' });
/** A part's implementation as the readings of a project read it from the records' structured field (C-PART 구현 상태 of the part's own row,
 * the same part ID): the newest reading that gave one, with its quote. Never a 구현 바뀜 answer, a description or a status claim (가동·정지 is
 * 운영 상태). null: no reading gave one (정보 없음, never 미구현). */
export function implementationAt(p: Pick<Project, 'readings'>, areaId: string): { value: PartImplementation; quote: ReadingQuote; reading: string; at: string } | null {
  let out: { value: PartImplementation; quote: ReadingQuote; reading: string; at: string } | null = null;
  for (const r of p.readings) if (isMapReading(r)) for (const x of r.parts) if (x.areaId === areaId && x.implementation && x.implementationQuote) out = { value: x.implementation, quote: x.implementationQuote, reading: r.id, at: r.at };
  return out;
}
/** Ruling F7: what an implementation state difference is. Both explicit and different: 구현 상태 변경 (미구현 → 구현됨). Nothing known (or
 * 모름) before and an explicit state after: 구현 정보 추가 (정보 없음 → 구현됨). The same state, or nothing after: no change. */
export function implementationChange(before: PartImplementation | null, after: PartImplementation | null): 'change' | 'add' | null {
  if (!after || after === 'unknown') return null;
  if (!before || before === 'unknown') return 'add';
  return before === after ? null : 'change';
}
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
  /** 구현 상태 (F7): the structured implementation before (null: 정보 없음) and after, 'change' (both explicit) or 'add' (정보 없음 → explicit),
   * with the record quote that gave the later one. */
  impl?: { mode: 'change' | 'add'; from: PartImplementation | null; to: PartImplementation; quote: ReadingQuote; reading: string } | null;
  /** 새: who made the part (a reading, or the person by hand) and, for the person, when. 설명 (review of v7): 'person' when the person
   * wrote the description anew (a plain rewrite, never a 정정). 정정: 'person' (the person marked their correction as fixing an error) or
   * 'record' (the record's own 철회 rows). */
  by?: 'reading' | 'person' | 'record'; madeAt?: string;
  /** 정정 by the record (review of v7): the withdrawals a record wrote about the part between the two versions (철회·변경 rows read as
   * withdrawn claims), each with what stood before, what stands now and its quote. */
  withdrawn?: { before: string | null; text: string; quote: ReadingQuote; reading: string }[];
  /** 은퇴 (review of v7): the successor the record names when it is not on the later map (the change's successor is then null). */
  named?: string | null;
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
function normName(t: string) { return t.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase(); }
function citeOf(p: Project, reading: string, record: string, row: string): IdentityCite | null {
  const r = p.readings.find((x): x is MapReading => isMapReading(x) && x.id === reading); if (!r) return null;
  const x = (r.identity ?? []).find((y: ReadingIdentityRow) => y.record === record && y.id === row);
  return { reading, at: r.at, record, row, when: x?.when ?? null, part: x?.part ?? null, evidence: [...x?.evidence ?? []], place: x ? { ...x.at } : null };
}
/** The changes from version a to version b (a < b, both 1-based; b may be the latest), from the two versions: a rebuilt one, and the latest
 * as the live map (versionAt). */
export function changeSet(p: Project, a: number, b: number): ChangeSet {
  const A = versionAt(p, a), B = versionAt(p, b), vs = mapVersions(p), window = new Set(vs.slice(a, b).map(v => v.id));
  const sA = identityState(A.project), sB = identityState(B.project);
  const inA = new Map(A.view.parts.map(x => [x.id, x])), inB = new Map(B.view.parts.map(x => [x.id, x]));
  const changes: PartChange[] = [];
  const add = (c: PartChange) => changes.push(c);
  for (const [id, x] of inB) if (!inA.has(id)) {
    // A part on the later version only: new, unless it is a duplicate that was folded (it is then on neither). A part the person made is
    // new by the person, at its own time (no reading made it).
    const area = B.project.space.areas.find(q => q.id === id);
    if (!sB.created.has(id) && area) { add({ kind: 'new', part: id, name: x.name, since: null, by: 'person', madeAt: area.createdAt }); continue; }
    add({ kind: 'new', part: id, name: x.name, since: vs.find(v => v.n > a && v.n <= b && (p.readings[v.end - 1] as MapReading).parts.some(q => q.areaId === id && !!q.created))?.n ?? null, by: 'reading' });
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
    // 구현 상태 (F7): only the structured implementation field of the same part, at each end.
    const ia = implementationAt(A.project, id), ib = implementationAt(B.project, id), im = implementationChange(ia?.value ?? null, ib?.value ?? null);
    if (im && ib) add({ kind: 'impl', part: id, name: y.name, before: ia ? IMPL_WORD[ia.value] : null, after: IMPL_WORD[ib.value], impl: { mode: im, from: ia?.value ?? null, to: ib.value, quote: ib.quote, reading: ib.reading } });
    const ux = x.reading, uy = y.reading;
    // Review of v7 (ruling F7: 정정 = an error or a withdrawal said so): the record's own 철회 rows read between the two (withdrawn claims of
    // a reading in the range, not there before), or the person's correction they marked as fixing an error. The person's plain rewrite of
    // a description is a 설명 변경 by the person, never a 정정.
    const fixed = (uy?.corrected?.id ?? null) !== (ux?.corrected?.id ?? null) && !!uy?.corrected, error = fixed && uy!.corrected!.error === true;
    const had = new Set((ux?.claims ?? []).map(c => normText(c.text)));
    const withdrawn = (uy?.claims ?? []).filter(c => window.has(c.reading) && claimTopic(c) === 'withdrawn' && !had.has(normText(c.text)))
      .map(c => ({ before: c.before ?? null, text: c.text, quote: { record: c.record, quote: c.quote, ...(c.from !== undefined ? { from: c.from } : {}), ...(c.to !== undefined ? { to: c.to } : {}) } as ReadingQuote, reading: c.reading }));
    if (error || withdrawn.length) add({ kind: 'correct', part: id, name: y.name, before: error ? ux?.role ?? null : null, after: error ? uy?.role ?? null : null, by: error ? 'person' : 'record', withdrawn });
    if (fixed && !error) add({ kind: 'desc', part: id, name: y.name, before: ux?.role ?? null, after: uy?.role ?? null, by: 'person', replaced: null, target: null });
    else if (!fixed && ux?.role && uy?.role && normText(ux.role) !== normText(uy.role)) {
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
    // Review of v7: a successor the record names that is not on the later map is kept (named), never read as 「none in the record」.
    add({ kind: 'retire', part: id, name: inA.get(id)!.name, successor: succ, named: succ ? null : r.successor ?? null, cite });
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
  'waiting:budget': '이번 읽기에 자리가 모자라 다음 읽기로 미룸',
  'waiting:unresolved-endpoint': '이어질 부품이 아직 지도에 없음',
  // Review of v7 (first user, d): what happens next in plain words, never 「보냈지만 … 다시 보냄」.
  'waiting:transient': '지도에 아직 들어가지 않아 다음 읽기에 다시 넣음',
  // Review of v7: the row of a record already read that no reading has taken up yet (a record not read at all is never listed).
  'waiting:not-yet-sent': '읽은 기록에 있지만 아직 지도에 보내지 않음',
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
  'rejected:unplaced': '여러 번 읽었지만 지도에 들어가지 않아 더 넣지 않음',
  'rejected:form': '표의 형식이 맞지 않음',
  'rejected:unknown-part': '지도에 없는 부품 번호를 가리킴',
  'rejected:other-project': '다른 프로젝트의 지도를 가리킴',
  'rejected:unsupported': '아직 지도에 반영하지 않는 종류의 행',
  'rejected:undecided': '기록이 대응을 모른다고 함',
  'rejected:planned': '계획만 있고 아직 바뀌지 않음',
  'rejected:partial': '일부만 바뀌어 통째로 바꾸지 않음',
  'rejected:unconfirmed': '바뀐 때나 대신하는 부품이 확인되지 않음',
  'rejected:revision': '다시 검토해도 정해지지 않아 더 넣지 않음',
  'rejected:empty-group': '안에 아무것도 없는 묶음이라 만들지 않음' });
export const rowReasonWords = (state: RowState, reason: string | null): string => (reason ? ROW_REASON_WORDS[`${state}:${reason}`] ?? '이유가 적히지 않음' : '이유가 적히지 않음');
/** Every reason the ledger can give (for the words' completeness). */
export const allRowReasons = (): string[] => (Object.entries(ROW_REASONS) as [RowState, readonly string[]][]).flatMap(([s, rs]) => rs.map(r => `${s}:${r}`));
/** Ruling F7: a pasted record no map reading has read yet is not in 기록 반영 상태 at all (its rows are neither 대기 nor anything else): it
 * is counted apart as 「아직 읽지 않은 기록 N개」. */
export const UNREAD_WORDS = '아직 읽지 않은 기록';
/** The item kinds of 기록 반영 상태 (F7: 연결 · 보내는 → 받는 / 단계 · 원문 단계 이름 / 설명 · 해당 부품의 설명 / 부품 · 원문 이름); another table reads
 * by its own title. */
export const ROW_ITEM_WORD: Readonly<Record<string, string>> = Object.freeze({ 'C-LINK': '연결', 'C-STEP': '단계', 'C-PART': '부품', 'C-IDENT': '부품 대응', 'C-DESIGN': '설명' });
export interface Unreflected { state: Exclude<RowState, 'reflected'>; reason: string | null; words: string;
  /** The record (fold key), the table and the row's own ID. */
  record: string; table: string; id: string;
  /** What the row tried: its 이름 cell (a part row), else its cells as written, joined (whole: never cut, so no plan word goes). */
  tried: string;
  /** The item's kind word (연결, 단계, 부품, …) and its title as F7 has it (보내는 → 받는, the step's own name, the part's own name). */
  item: string; title: string;
  /** The parts it is about (its own part, the parts its B ids are bound to, held with) on the map of that version. */
  parts: string[];
  /** The one group it shows in (F7): the part it is first about (a part row's own part, a line's sender, else the first part it names, else
   * the one part it is held with), checked by part ID on the map of that version; null: none. related: the other parts it is about. */
  principal: string | null; related: string[];
  /** A part row whose part no part on the map of that version can be (「아직 지도에 놓이지 않음」, only then: review of v7). */
  unplaced: boolean;
  /** Review of v7: the record's own part the row is about (its C-PART row ID and the record's name for it) when no part on the map can be
   * it: the row's group is that part's. null: on the map, unknown, or about several. */
  pending: { b: string; name: string } | null;
  /** How many of the record's parts the row names (its own, its B ids): none is a row about the whole record. */
  named: number;
  /** The source line: the pasted text, [start, end) in it and its 1-based line number. */
  paste: string; start: number; end: number; line: number }
/** The columns that are references, not what the row says (its ID, its cites, the files it is filed under). */
const REF_COLS = new Set(['행 ID', 'F ID', 'E ID', '근거', '담당 F', '지도 부분(Pxx)']);
const escRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A row's cells as plain words (review of v7): only the record's own row IDs (ids: every row ID of its tables) go, and only where they
 * stand as a reference (a whole token): a part row's ID (B…) reads as the record's own name for that part, with the particle after it
 * chosen again for that name (이/가, 을/를, 은/는, 과/와, 으로/로); anything else as written (S3, H2, K8s, E2E stay). */
export function plainCells(cells: readonly string[], partName: (id: string) => string | null, ids: ReadonlySet<string> = new Set()): string {
  const list = [...ids].filter(Boolean).sort((a, b) => b.length - a.length);
  const ref = list.length ? new RegExp(`(?<![A-Za-z0-9_./-])(${list.map(escRe).join('|')})(?![A-Za-z0-9_])(?:(으로|로|이|가|을|를|은|는|와|과)(?![가-힣]))?`, 'g') : null;
  return cells.map(v => (ref ? v.replace(ref, (_m, id: string, particle: string | undefined) => {
    const name = /^B\d{1,3}$/.test(id) ? partName(id) : null;
    if (!name) return particle ?? '';
    const pair = particle ? josaPair(particle) : null;
    return `${name}${pair ? josa(name, pair) : ''}`;
  }) : v)
    .replace(/[(（]\s*[)）]/g, '').replace(/\s+([)）\]])/g, '$1').replace(/([(（[])\s+/g, '$1')
    .split(/\s*[·+,]\s*/).map(t => t.replace(/\s+/g, ' ').trim()).filter(t => /[가-힣A-Za-z0-9]/.test(t)).join(' · ')).filter(Boolean).join(' · ');
}
/** The pasted texts the map readings of a project read. */
const readPastes = (p: Pick<Project, 'readings'>) => new Set(p.readings.flatMap(r => (isMapReading(r) ? r.records.map(x => x.id) : [])));
const B_REF = /(?<![A-Za-z0-9])B\d{1,3}(?!\d)/g;
/** A name's core for matching a record's part row to a part (as row-ledger's nameCore): NFKC, case folded, bracketed qualifiers and spacing
 * left out. */
const nameCore = (n: string) => n.normalize('NFKC').toLowerCase().replace(/[(（[［][^()（）[\]［］]*[)）\]］]/g, ' ').replace(/\s+/g, '');
/** The rows not reflected among the records read up to version k (each record's rows by the ledger as it stood then), each source row
 * once (a row sent again is one row; a row about several parts is one row), waiting first, then held, then rejected, each in record
 * order. A record no reading has read is never here (unreadRecords).
 * Review of v7: a record's part row (B…) is a map part when a reading created that part on it (the ledger), when the record's own identity
 * row was reflected onto it, when a part a reading created bears the row's name (the one row of that record named so, the one such part),
 * or when every reflected row of that record standing on a map part names the same one B. A part row no map part can be (none bound, none
 * named so, none held with) is 「아직 지도에 놓이지 않음」, and a row about it alone shows in that part's group; unknown says neither. */
export function unreflectedAt(p: Project, k: number): Unreflected[] {
  const v = versionAt(p, k), past = v.project, folds = v5Folds(past.pasted); if (!folds.length) return [];
  const read = readPastes(past);
  const ledger = rowLedger(past, folds), live = new Set(past.space.areas.map(a => a.id)), bound = rowBindings(ledger, id => live.has(id));
  const onMap = new Map(v.view.parts.map(x => [x.id, x.name]));
  // A record's part row is a map part when a reading created it there, or when the record's own identity row (C-IDENT) was reflected onto
  // it (its 이 기록 부분 → that part, a folded duplicate read as its canonical part).
  const st = identityState(past);
  for (const r of past.readings) if (isMapReading(r)) for (const e of r.identity ?? []) if (e.state === 'reflected' && e.part && e.areaId) {
    const k = `${e.record}\u0000C-PART\u0000${e.part}`; if (!bound.has(k)) bound.set(k, canonicalPart(st, e.op?.kind === 'fold' && e.op.into ? e.op.into : e.areaId));
  }
  const foldOf = new Map<string, V5Fold>(folds.map(f => [f.key, f])), text = new Map(past.pasted.map(x => [x.id, x.text]));
  const partNames = new Map(folds.map(f => [f.key, new Map((f.fold.rows.get('C-PART') ?? []).map(r => [r.id, (r.row.byColumn['이름'] ?? '').trim()]))]));
  const rowIds = new Map(folds.map(f => [f.key, new Set([...f.fold.rows.values()].flatMap(rs => rs.map(r => r.id)))]));
  const keyOf = (record: string, b: string) => `${record}\u0000C-PART\u0000${b}`;
  const onMapId = (id: string) => { const c = canonicalPart(st, id); return onMap.has(c) ? c : null; };
  // Review of v7: more bindings, each only where it is the one answer (a row two parts could be binds to neither).
  const proposed = new Map<string, Set<string>>(), propose = (key: string, id: string) => { if (!bound.has(key)) (proposed.get(key) ?? proposed.set(key, new Set()).get(key)!).add(id); };
  // (1) A part by its name (the name a reading created it with, or its name on the map): the one row of a record named so, when no other
  // part on the map bears that name.
  const created = new Map<string, Set<string>>(), nameOn = (n: string, id: string | null) => { const c = nameCore(n); if (id && c) (created.get(c) ?? created.set(c, new Set()).get(c)!).add(id); };
  for (const r of past.readings) if (isMapReading(r)) for (const x of r.parts) if (x.created) nameOn(x.created.name, onMapId(x.areaId));
  for (const [id, n] of onMap) nameOn(n, id);
  for (const [record, rows] of partNames) {
    const byCore = new Map<string, string[]>(); for (const [b, n] of rows) { const c = nameCore(n); if (c) byCore.set(c, [...byCore.get(c) ?? [], b]); }
    for (const [c, bs] of byCore) { const ids = created.get(c); if (bs.length === 1 && ids?.size === 1) propose(keyOf(record, bs[0]!), [...ids][0]!); }
  }
  // (2) The one B every reflected row of a record standing on a map part names (a part row's own ID among them), for a part that record
  // has bound to none of its rows yet.
  const boundParts = new Set([...bound].map(([key, id]) => `${key.split('\u0000')[0]}\u0000${id}`));
  const standing = new Map<string, Set<string>[]>();
  for (const x of ledger.values()) {
    if (x.state !== 'reflected' || x.table === 'C-IDENT') continue;
    const bs = new Set([...(x.table === 'C-PART' ? [x.id] : []), ...x.ends]); if (!bs.size) continue;
    for (const id of new Set(x.to.filter(t => t.kind === 'part' || t.kind === 'claim').map(t => onMapId(t.id)).filter((y): y is string => !!y))) {
      const key = `${x.record}\u0000${id}`; if (!boundParts.has(key)) (standing.get(key) ?? standing.set(key, []).get(key)!).push(bs);
    }
  }
  for (const [key, sets] of standing) {
    const [record, id] = key.split('\u0000') as [string, string], shared = [...sets[0]!].filter(b => sets.every(s => s.has(b)));
    if (shared.length === 1 && partNames.get(record)?.has(shared[0]!)) propose(keyOf(record, shared[0]!), id);
  }
  for (const [key, ids] of proposed) if (ids.size === 1) bound.set(key, [...ids][0]!);
  // Whether a part on the map could be a record's part row: one bound to it, one held with it, or one whose name (now, or as a reading
  // made it) is the row's name. No: the row's part is not on the map.
  const madeNames = new Map<string, string[]>(); for (const r of past.readings) if (isMapReading(r)) for (const x of r.parts) if (x.created) { const id = onMapId(x.areaId); if (id) madeNames.set(id, [...madeNames.get(id) ?? [], x.created.name]); }
  const mapCores = new Set([...onMap].flatMap(([id, n]) => [n, ...madeNames.get(id) ?? []].map(nameCore)));
  const mayBe = (record: string, b: string): boolean => {
    if (bound.has(keyOf(record, b))) return true;
    const row = ledger.get(keyOf(record, b)); if (row?.with.some(id => !!onMapId(id))) return true;
    const c = nameCore(partNames.get(record)?.get(b) ?? ''); return !!c && mapCores.has(c);
  };
  const rank: Record<string, number> = { waiting: 0, held: 1, rejected: 2 };
  const out: Unreflected[] = [], seen = new Set<string>();
  for (const x of ledger.values() as Iterable<LedgerRow>) {
    if (x.state === 'reflected' || !read.has(x.paste)) continue;
    const key = `${x.record}\u0000${x.table}\u0000${x.id}`; if (seen.has(key)) continue; seen.add(key);
    const row = foldOf.get(x.record)?.fold.rows.get(x.table)?.find(r => r.id === x.id);
    const by: Record<string, string> = row?.row.byColumn ?? {};
    const cells = Object.entries(by).filter(([c, v]) => !REF_COLS.has(c) && v.trim() && !/^[—–-]+$/.test(v.trim())).map(([, v]) => v.trim());
    const names = partNames.get(x.record) ?? new Map<string, string>();
    const tried = (x.name ?? plainCells(cells, b => names.get(b) || null, rowIds.get(x.record))).replace(/\s+/g, ' ').trim();
    const boundOf = (b: string): string | null => { const id = bound.get(keyOf(x.record, b)); return id && onMap.has(id) ? id : null; };
    // The record's parts the row names: a part row its own, an identity row its 이 기록 부분, any other row the B ids in its cells.
    const refsOf = (col: string) => (by[col] ?? '').match(B_REF) ?? [];
    const own = x.table === 'C-PART' ? x.id : x.table === 'C-IDENT' ? refsOf('이 기록 부분(Bxx)')[0] ?? null : null;
    const bs = [...new Set([...(own ? [own] : []), ...x.ends])];
    const ownPart = own ? boundOf(own) : null, ends = x.ends.map(boundOf).filter((y): y is string => !!y);
    const held = x.with.filter(id => onMap.has(id));
    const parts = [...new Set([...(ownPart ? [ownPart] : []), ...ends, ...held])];
    const principal = ownPart ?? ends[0] ?? (held.length === 1 ? held[0]! : null);
    // A row about one part of the record that no map part can be: that part's group (its part row says 「아직 지도에 놓이지 않음」).
    const one = !principal && !held.length && bs.length === 1 && names.has(bs[0]!) && !mayBe(x.record, bs[0]!) ? bs[0]! : null;
    const pending = one ? { b: one, name: names.get(one) || '이름 없는 부분' } : null;
    // The title: a line's two ends (the map's name when the end is a part on the map, else the record's own name), a step's own name, a
    // part row's own name; any other row its words.
    const endName = (b: string | undefined) => (b ? (boundOf(b) ? onMap.get(boundOf(b)!)! : names.get(b) || '이름 없는 부분') : '모름');
    const title = x.table === 'C-LINK' ? `${endName(refsOf('보내는 부분')[0] ?? x.ends[0])} → ${endName(refsOf('받는 부분')[0] ?? x.ends[1])}`
      : x.table === 'C-STEP' ? ((by['단계 이름'] ?? '').trim() || tried)
      : x.table === 'C-PART' ? (x.name ?? tried)
      : x.table === 'C-IDENT' ? (names.get(own ?? '') || tried)
      : tried;
    const item = ROW_ITEM_WORD[x.table] ?? V5_TABLE_DEFS.get(x.table)?.title ?? '행';
    const t = text.get(x.paste) ?? '';
    out.push({ state: x.state, reason: x.reason, words: rowReasonWords(x.state, x.reason), record: x.record, table: x.table, id: x.id, tried, item, title: title.replace(/\s+/g, ' ').trim() || '내용 없는 행',
      parts, principal, related: parts.filter(id => id !== principal), unplaced: x.table === 'C-PART' && !!pending, pending, named: bs.length,
      paste: x.paste, start: x.start, end: x.end, line: t.slice(0, x.start).split('\n').length });
  }
  return out.sort((a, b) => rank[a.state]! - rank[b.state]! || (a.paste < b.paste ? -1 : a.paste > b.paste ? 1 : a.start - b.start));
}
/** Ruling F7: the pasted records no map reading has read yet (a text pasted after the last reading), each once, with how many rows they
 * hold. Never 대기, never in 기록 반영 상태's counts. */
export function unreadRecords(p: Project): { paste: string; rows: number }[] {
  const folds = v5Folds(p.pasted); if (!folds.length) return [];
  const read = readPastes(p), by = new Map<string, number>();
  for (const x of rowLedger(p, folds).values()) if (!read.has(x.paste)) by.set(x.paste, (by.get(x.paste) ?? 0) + 1);
  return p.pasted.filter(x => by.has(x.id)).map(x => ({ paste: x.id, rows: by.get(x.id)! }));
}
/** One group of 기록 반영 상태 (F7): the rows about one part on the map (its ID checked), the rows about one part of a record that is not on
 * the map (review of v7: that part's own group, by the record's name for it), the rows about several parts with none first, and the rows
 * whose part is not settled. */
export interface ReflectGroup { key: string; part: string | null; kind: 'part' | 'unplaced' | 'several' | 'unsettled' | 'whole'; rows: Unreflected[];
  /** 'unplaced': the record's name for the part not on the map. */
  name: string | null;
  /** 「연결 2행 · 단계 1행」: the rows by item kind, most first. */
  byItem: { item: string; n: number }[] }
/** The groups of some rows (each row in exactly one): parts first (most rows first, then by name), then the parts not yet on the map (most
 * rows first), the rows about several parts, the unsettled ones, and the rows that name no part (about the whole record). */
export function reflectGroups(rows: readonly Unreflected[], name: (id: string) => string): ReflectGroup[] {
  const by = new Map<string, ReflectGroup>();
  for (const x of rows) {
    const kind: ReflectGroup['kind'] = x.principal ? 'part' : x.pending ? 'unplaced' : x.parts.length > 1 ? 'several' : !x.named && !x.parts.length ? 'whole' : 'unsettled';
    const key = kind === 'part' ? `P\u0000${x.principal}` : kind === 'unplaced' ? `U\u0000${x.record}\u0000${x.pending!.b}` : kind;
    const g = by.get(key) ?? by.set(key, { key, part: x.principal, kind, rows: [], name: kind === 'unplaced' ? x.pending!.name : null, byItem: [] }).get(key)!;
    g.rows.push(x);
  }
  const rankK = { part: 0, unplaced: 1, several: 2, unsettled: 3, whole: 4 } as const;
  for (const g of by.values()) { const n = new Map<string, number>(); for (const x of g.rows) n.set(x.item, (n.get(x.item) ?? 0) + 1); g.byItem = [...n].map(([item, k]) => ({ item, n: k })).sort((a, b) => b.n - a.n); }
  return [...by.values()].sort((a, b) => rankK[a.kind] - rankK[b.kind] || b.rows.length - a.rows.length || (a.part && b.part ? name(a.part).localeCompare(name(b.part), 'ko') : (a.name ?? '').localeCompare(b.name ?? '', 'ko')));
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
