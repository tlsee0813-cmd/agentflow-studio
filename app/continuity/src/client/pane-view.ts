/* The reading pane after cycle 5 (map spec 11.5, PART_READING 9절), its pure part. With the working structure on the map and the
 * detail view, the pane reads what the records said and why the map drew the part so: 원문 (the part's current claims grouped by
 * the record they quote, one rail per record, newest record first, each record's claims in topic order), 이력 (every claim a
 * reading said of the part, in time order, with whether it is still current), 출처 묶음 (the records that contributed, how many
 * claims each and the evidence grades present) and the person's 「이 해석이 틀림」 notes, kept apart from the project (a note never
 * edits a claim or a reading; the handover lists them). No DOM here; app.ts renders it.
 *
 * Grouping uses only the record a claim's own quote names: a claim is never moved to a neighbour's record, and a claim whose record
 * is not at hand still reads in a rail of its own (its record named as not found), never without one. */
import { TOPIC_ORDER, claimTopic, claimEvidence, claimWhen } from '../shared/claim-topic.js';
import type { ClaimKind, ClaimTopic, EvidenceGrade, ReadingQuote } from '../shared/types.js';

/** What the pane reads of a claim (a CurrentClaim or a history claim carries all of it). */
export interface PaneClaim {
  kind: ClaimKind; text: string; record: string; quote: string; about: string | null; from?: number; to?: number;
  topic?: ClaimTopic | null; evidence?: EvidenceGrade | null; when?: string | null; where?: string | null; before?: string | null;
}
/** A record's time (ISO, when it was taken in) or null when it is not at hand. */
export type RecordAt = (record: string) => string | null;

/* ---------- 원문: one rail per record ---------- */
export interface RecordRail<T> { record: string; at: string | null; topics: { topic: ClaimTopic; list: T[] }[]; claims: T[] }
/** The claims by the record they quote: newest record first (a record whose time is unknown after the dated ones; equal times
 * keep the order the claims came in), and within a record its claims in topic order (TOPIC_ORDER), each topic keeping the
 * claims' own order (the pane's: a correction first, newest reading first, as each reading said them). */
export function recordRails<T extends PaneClaim>(claims: readonly T[], recordAt: RecordAt): RecordRail<T>[] {
  const by = new Map<string, T[]>();
  for (const c of claims) { const l = by.get(c.record); if (l) l.push(c); else by.set(c.record, [c]); }
  const rails = [...by].map(([record, list], seen) => {
    const groups = new Map<ClaimTopic, T[]>();
    for (const c of list) { const t = claimTopic(c), g = groups.get(t); if (g) g.push(c); else groups.set(t, [c]); }
    const topics = TOPIC_ORDER.flatMap(topic => { const l = groups.get(topic); return l ? [{ topic, list: l }] : []; });
    return { record, at: recordAt(record), topics, claims: topics.flatMap(t => t.list), seen };
  });
  rails.sort((a, b) => (a.at === null ? 1 : 0) - (b.at === null ? 1 : 0) || (a.at && b.at ? b.at.localeCompare(a.at) : 0) || a.seen - b.seen);
  return rails.map(({ seen: _s, ...r }) => r);
}

/* ---------- 이력: every reading's words about the part, in time order ---------- */
export interface HistoryReading { reading: string; at: string; role: string | null; claims: readonly PaneClaim[]; basis: readonly ReadingQuote[] }
export interface HistoryEntry {
  /** 'reading:index' for a claim (the same key as a current claim's), 'reading:role' for a description. */
  key: string; reading: string; at: string; what: 'role' | 'claim'; index: number;
  text: string; before: string | null; when: string | null; where: string | null; topic: ClaimTopic | null; evidence: EvidenceGrade | null;
  quote: ReadingQuote | null;
  /** Still in the current reading (not replaced by a later record, not a repeat of the same words). */
  current: boolean;
}
/** The part's history as one list, oldest first by the reading's time (readings of the same time in the order they were made);
 * within a reading its description first, then its claims as it said them. current: the keys of the current claims, and the
 * current description's words. */
export function historyEntries(history: readonly HistoryReading[], current: ReadonlySet<string>, role: string | null): HistoryEntry[] {
  const out: (HistoryEntry & { n: number })[] = [];
  history.forEach((x, n) => {
    if (x.role) out.push({ key: `${x.reading}:role`, reading: x.reading, at: x.at, what: 'role', index: -1, text: x.role, before: null, when: null, where: null, topic: null, evidence: null,
      quote: x.basis[0] ?? null, current: x.role === role, n });
    x.claims.forEach((c, i) => {
      const t = claimTopic(c);
      out.push({ key: `${x.reading}:${i}`, reading: x.reading, at: x.at, what: 'claim', index: i, text: c.text, before: t === 'withdrawn' ? c.before ?? null : null,
        when: claimWhen(c), where: c.where ?? null, topic: t, evidence: claimEvidence(c),
        quote: { record: c.record, quote: c.quote, ...(c.from !== undefined ? { from: c.from } : {}), ...(c.to !== undefined ? { to: c.to } : {}) },
        current: current.has(`${x.reading}:${i}`), n });
    });
  });
  out.sort((a, b) => a.at.localeCompare(b.at) || a.n - b.n);
  return out.map(({ n: _n, ...e }) => e);
}
/** Beyond `limit` entries the history folds: the newest `limit` read, the earlier ones are counted until unfolded. */
export const HISTORY_SHOWN = 8;
export function foldHistory<T>(entries: readonly T[], open: boolean, limit = HISTORY_SHOWN): { shown: T[]; hidden: number } {
  if (open || entries.length <= limit) return { shown: [...entries], hidden: 0 };
  return { shown: entries.slice(entries.length - limit), hidden: entries.length - limit };
}
/** A reading's id, short enough for a line (the whole id in its title). */
export const shortReading = (id: string) => (id.length > 12 ? `${id.slice(0, 11)}…` : id);

/* ---------- 출처 묶음: the records that contributed ---------- */
export const GRADE_ORDER: readonly EvidenceGrade[] = ['file', 'run', 'report', 'guess', 'unknown'];
export interface SourceRow {
  record: string; at: string | null;
  /** Current claims quoting it (as 원문 reads them), and every claim any reading quoted it for (the history). */
  current: number; said: number;
  /** The authors' evidence tags among those claims, in GRADE_ORDER; untagged: claims with none. */
  grades: EvidenceGrade[]; untagged: number;
  /** The current description rests on it. */
  role: boolean;
}
/** Every record the part's reading rests on: its current claims, its history and its description's basis; newest record first
 * (as recordRails). A record only the history or the description quotes is listed too, with current 0. */
export function sourceRows(current: readonly PaneClaim[], history: readonly HistoryReading[], roleBasis: readonly ReadingQuote[], recordAt: RecordAt): SourceRow[] {
  const rows = new Map<string, SourceRow & { seen: number; tags: Set<EvidenceGrade> }>();
  const row = (record: string) => {
    let r = rows.get(record);
    if (!r) { r = { record, at: recordAt(record), current: 0, said: 0, grades: [], untagged: 0, role: false, seen: rows.size, tags: new Set() }; rows.set(record, r); }
    return r;
  };
  for (const c of current) row(c.record).current++;
  for (const x of history) for (const c of x.claims) { const r = row(c.record), g = claimEvidence(c); r.said++; if (g) r.tags.add(g); else r.untagged++; }
  // A current claim no history entry holds (never expected) still counts toward its record's grades.
  for (const c of current) { const r = rows.get(c.record)!; if (!r.said) { const g = claimEvidence(c); if (g) r.tags.add(g); else r.untagged++; } }
  for (const q of roleBasis) row(q.record).role = true;
  return [...rows.values()]
    .sort((a, b) => (a.at === null ? 1 : 0) - (b.at === null ? 1 : 0) || (a.at && b.at ? b.at.localeCompare(a.at) : 0) || a.seen - b.seen)
    .map(({ seen: _s, tags, ...r }) => ({ ...r, said: Math.max(r.said, r.current), grades: GRADE_ORDER.filter(g => tags.has(g)) }));
}

/* ---------- 「이 해석이 틀림」: the person's notes, apart from the project ---------- */
/** One person's disagreement with a claim (or the description, claimKey 'role'): when it was marked, why when they said, and
 * the words they disagreed with as they read then (so the handover can name them even after the reading changes). */
export interface DisputeNote { claimKey: string; at: string; text?: string; said?: string }
export const DISPUTE_KEY = 'agentflow.studio.disputes.1';
export const ROLE_KEY = 'role';
const DISPUTE_MAPS = 40, DISPUTE_NOTES = 200, NOTE_TEXT = 300, KEY_MAX = 200;
interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
function cleanNote(v: unknown): DisputeNote | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>, claimKey = str(o.claimKey, KEY_MAX), at = str(o.at, 40);
  if (!claimKey || !at) return null;
  const text = str(o.text, NOTE_TEXT), said = str(o.said, NOTE_TEXT);
  return { claimKey, at, ...(text ? { text } : {}), ...(said ? { said } : {}) };
}
function disputesAll(storage: StorageLike): Record<string, unknown> {
  try { const v = JSON.parse(storage.getItem(DISPUTE_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}; } catch { return {}; }
}
/** One map's notes by part; an unreadable record or note reads as none. */
export function readDisputes(storage: StorageLike, mapKey: string): Record<string, DisputeNote[]> {
  const out: Record<string, DisputeNote[]> = {};
  try {
    const all = disputesAll(storage), m = Object.hasOwn(all, mapKey) ? all[mapKey] : null;
    if (!m || typeof m !== 'object' || Array.isArray(m)) return out;
    for (const [part, list] of Object.entries(m as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      const notes = list.map(cleanNote).filter((x): x is DisputeNote => !!x);
      if (notes.length) out[part] = notes;
    }
  } catch { /* none */ }
  return out;
}
function writeMap(storage: StorageLike, mapKey: string, notes: Record<string, DisputeNote[]>): boolean {
  try {
    const all = disputesAll(storage); delete all[mapKey];
    // The newest DISPUTE_NOTES of the map are kept (by when they were marked); a part with none left goes.
    const flat = Object.entries(notes).flatMap(([part, l]) => l.map(n => ({ part, n }))).sort((a, b) => a.n.at.localeCompare(b.n.at));
    const kept: Record<string, DisputeNote[]> = {};
    for (const { part, n } of flat.slice(Math.max(0, flat.length - DISPUTE_NOTES))) (kept[part] ??= []).push(n);
    if (Object.keys(kept).length) all[mapKey] = kept;
    const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - DISPUTE_MAPS))) delete all[k];
    storage.setItem(DISPUTE_KEY, JSON.stringify(all)); return true;
  } catch { return false; }
}
/** Appends a note (a claim may be marked more than once); a note that is not well formed is refused (false). */
export function addDispute(storage: StorageLike, mapKey: string, part: string, note: DisputeNote): boolean {
  const n = cleanNote(note); if (!n || !part) return false;
  const all = readDisputes(storage, mapKey);
  all[part] = [...(all[part] ?? []), n];
  return writeMap(storage, mapKey, all);
}
/** Takes back every note on one claim of a part (the claim and the reading are untouched either way). */
export function dropDispute(storage: StorageLike, mapKey: string, part: string, claimKey: string): boolean {
  const all = readDisputes(storage, mapKey), left = (all[part] ?? []).filter(n => n.claimKey !== claimKey);
  if (left.length) all[part] = left; else delete all[part];
  return writeMap(storage, mapKey, all);
}
export const disputesOf = (all: Record<string, DisputeNote[]>, part: string, claimKey: string): DisputeNote[] => (all[part] ?? []).filter(n => n.claimKey === claimKey);
/** A note's time as a line reads it: '2026-11-04 10:20Z'. */
export const noteTime = (at: string) => (/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(at) ? `${at.slice(0, 10)} ${at.slice(11, 16)}Z` : at);
/** The chip's tooltip: each time it was marked, with the person's reason when they gave one. */
export function disputeTitle(notes: readonly DisputeNote[]): string {
  return ['사람이 이 해석을 틀렸다고 표시함 · 원문과 주장은 그대로', ...notes.map(n => `${noteTime(n.at)}${n.text ? ` · ${n.text}` : ''}`)].join('\n');
}

/* ---------- the handover lists them ---------- */
export interface DisputedItem { part: string; said: string | null; at: string; text?: string; role: boolean }
export const DISPUTE_HEAD = '## 사람이 틀렸다고 표시한 해석';
/** The handover's section: each disputed reading of a part, the words as the person saw them, when, and why when said. None: []. */
export function disputeSection(items: readonly DisputedItem[]): string[] {
  if (!items.length) return [];
  const one = (t: string, n: number) => { const s = t.replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
  return [DISPUTE_HEAD,
    '사용자가 Studio에서 아래 해석을 틀렸다고 표시했어요. 원문과 지도의 주장은 그대로이니, 이 해석에 기대기 전에 원문을 다시 확인하세요.',
    ...items.map(x => `- ${one(x.part, 80)} · ${x.role ? '설명' : '주장'}: ${x.said ? `“${one(x.said, 200)}”` : '(지금 읽기에 없는 해석)'} · ${noteTime(x.at)} 표시${x.text ? ` · 이유: ${one(x.text, 200)}` : ''}`), ''];
}
export const HANDOVER_END = '──────── 인수인계 문서 끝';
/** The document with the section before its end line (at the end when it has none). */
export function withDisputes(text: string, section: readonly string[]): string {
  if (!section.length) return text;
  const lines = text.split('\n'); let end = -1;
  for (let i = lines.length - 1; i >= 0 && end < 0; i--) if (lines[i]!.startsWith(HANDOVER_END)) end = i;
  if (end < 0) return [...lines, '', ...section].join('\n');
  return [...lines.slice(0, end), ...section, ...lines.slice(end)].join('\n');
}

/* ---------- one order for the lens and the full reading (cycle 5, PART_READING 9절) ---------- */
/** The pane's sections in reading order: 원문 → 이유 → 이력 → 출처 묶음 → 어디에. The lens and the full reading (전체 읽기) both lay
 * their sections out by this, so the two never drift apart. */
export type PaneSection = 'origin' | 'why' | 'history' | 'sources' | 'where';
export const PANE_ORDER: readonly PaneSection[] = ['origin', 'why', 'history', 'sources', 'where'];
export const PANE_TITLE: Record<PaneSection, string> = { origin: '원문', why: '이유', history: '이력', sources: '출처 묶음', where: '어디에' };
/** The given sections in PANE_ORDER, those absent (null) left out. */
export function paneSections<T>(by: Partial<Record<PaneSection, T | null | undefined>>): T[] {
  return PANE_ORDER.flatMap(k => { const v = by[k]; return v === null || v === undefined ? [] : [v]; });
}
/** 구조 (안의 단계 · 반복 · 유지 상태) under 이유 is folded: open only as the person left it for this part, or while one of its
 * steps is picked (in the detail view or the pane). */
export const structureOpen = (remembered: boolean, stepPicked: boolean): boolean => remembered || stepPicked;
