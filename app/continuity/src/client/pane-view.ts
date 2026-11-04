/* The reading pane, its pure part. Map design v3 (slice S1) lays it out in three tabs (구조 | 근거 | 이력, below): what the part does
 * and how first, what that rests on and how the reading changed one click away. The evidence pieces from cycle 5 stay: 원문 (the part's current claims grouped by
 * the record they quote, one rail per record, newest record first, each record's claims in topic order), 이력 (every claim a
 * reading said of the part, in time order, with whether it is still current), 출처 묶음 (the records that contributed, how many
 * claims each and the evidence grades present) and the person's 「이 해석이 틀림」 notes, kept apart from the project (a note never
 * edits a claim or a reading; the handover lists them). No DOM here; app.ts renders it.
 *
 * Grouping uses only the record a claim's own quote names: a claim is never moved to a neighbour's record, and a claim whose record
 * is not at hand still reads in a rail of its own (its record named as not found), never without one. */
import { TOPIC_ORDER, EVIDENCE_LABEL, claimTopic, claimEvidence, claimWhen } from '../shared/claim-topic.js';
import { cellTexts } from '../shared/record-table.js';
import type { ClaimKind, ClaimTopic, EvidenceGrade, ReadingQuote } from '../shared/types.js';
import { conditionPlacement, conditionLines, conditionOfQuote, type ConditionLike, type ChainStep, type QuoteLike } from './steps-view.js';
import { loopSegments, isProgram, type LoopLike, type ConditionLike as LineCondition } from './line-view.js';

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
export interface DisputeNote { claimKey: string; at: string; text?: string; said?: string; reason?: DisputeReason }
/** Why the person says the reading is wrong (map design v3 8.6): one of four, optional (notes kept before S2 have none). */
export type DisputeReason = 'meaning' | 'target' | 'time' | 'record';
export const DISPUTE_REASONS: readonly DisputeReason[] = ['meaning', 'target', 'time', 'record'];
export const DISPUTE_REASON_LABEL: Record<DisputeReason, string> = { meaning: '원문과 다른 뜻으로 해석함', target: '다른 대상·구간을 근거로 연결함', time: '시점·판본·조건을 잘못 적용함', record: '원문 기록 자체가 사실과 다름' };
export const DISPUTE_KEY = 'agentflow.studio.disputes.1';
export const ROLE_KEY = 'role';
const DISPUTE_MAPS = 40, DISPUTE_NOTES = 200, NOTE_TEXT = 300, KEY_MAX = 200;
interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
function cleanNote(v: unknown): DisputeNote | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>, claimKey = str(o.claimKey, KEY_MAX), at = str(o.at, 40);
  if (!claimKey || !at) return null;
  const text = str(o.text, NOTE_TEXT), said = str(o.said, NOTE_TEXT), reason = DISPUTE_REASONS.find(r => r === o.reason) ?? null;
  return { claimKey, at, ...(text ? { text } : {}), ...(said ? { said } : {}), ...(reason ? { reason } : {}) };
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
  return ['사람이 이 해석을 틀렸다고 표시함 · 원문과 주장은 그대로', ...notes.map(n => `${noteTime(n.at)}${n.reason ? ` · ${DISPUTE_REASON_LABEL[n.reason]}` : ''}${n.text ? ` · ${n.text}` : ''}`)].join('\n');
}

/* ---------- the handover lists them ---------- */
export interface DisputedItem { part: string; said: string | null; at: string; text?: string; role: boolean; reason?: DisputeReason }
export const DISPUTE_HEAD = '## 사람이 틀렸다고 표시한 해석';
/** The handover's section: each disputed reading of a part, the words as the person saw them, when, and why when said. None: []. */
export function disputeSection(items: readonly DisputedItem[]): string[] {
  if (!items.length) return [];
  const one = (t: string, n: number) => { const s = t.replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
  return [DISPUTE_HEAD,
    '사용자가 Studio에서 아래 해석을 틀렸다고 표시했어요. 원문과 지도의 주장은 그대로이니, 이 해석에 기대기 전에 원문을 다시 확인하세요.',
    ...items.map(x => `- ${one(x.part, 80)} · ${x.role ? '설명' : '주장'}: ${x.said ? `“${one(x.said, 200)}”` : '(지금 읽기에 없는 해석)'} · ${noteTime(x.at)} 표시${x.reason || x.text ? ` · 이유: ${[x.reason ? DISPUTE_REASON_LABEL[x.reason] : '', x.text ? one(x.text, 200) : ''].filter(Boolean).join(' · ')}` : ''}`), ''];
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

/* ---------- the panel's three tabs (map design v3 8.1–8.3, slice S1) ----------
 * 구조 (what the part does and how: a short chain first, then its contract, behaviour, rules and gates, links and where it lives),
 * 근거 (what the drawing rests on: the records' words by claim or by record, then the records), 이력 (how the reading changed:
 * withdrawals 이전 → 지금 newest first, every reading's words, the requests' results). The tab set is data: a later 개요 | 동작 |
 * 근거 | 이력 is a change to PANE_TABS and ENTRY_TAB plus a builder per tab. The lens and its wide mode (넓게 읽기) read the same
 * tabs in the same order; the wide mode only adds what needs room (the records whole, the answers, the question box). */
export type PaneTab = 'structure' | 'evidence' | 'history';
/** counted: the tab's head carries its count ('근거 18': the distinct quoted spans; '이력 6': the readings that spoke of the part). */
export interface PaneTabDef { key: PaneTab; label: string; hint: string; counted: boolean }
export const PANE_TABS: readonly PaneTabDef[] = [
  { key: 'structure', label: '구조', hint: '하는 일 · 계약 · 동작 · 규칙과 관문 · 연결 · 어디에', counted: false },
  { key: 'evidence', label: '근거', hint: '지금 그린 것이 기대는 기록의 말과 기록 목록 · 수는 인용된 구간 수', counted: true },
  { key: 'history', label: '이력', hint: '읽기가 바뀌어 온 길: 철회 이전 → 지금, 정리마다 읽은 말 · 수는 이 부분을 읽은 정리 수', counted: true }];
/** A tab's head: its label, with its count when it has one above zero. */
export const tabLabel = (t: PaneTabDef, count: number): string => (t.counted && count > 0 ? `${t.label} ${count}` : t.label);
/** How the panel was reached decides its first tab (8.1): a card → 구조; a card's rule or gate tab → 구조 with 규칙과 관문 focused;
 * a change tab or a history entry → 이력; a citation → 근거; asking about the part → 근거 (where the answers read). */
export type PaneEntry = 'card' | 'sign' | 'change' | 'history' | 'cite' | 'ask';
const ENTRY_TAB: Record<PaneEntry, PaneTab> = { card: 'structure', sign: 'structure', change: 'history', history: 'history', cite: 'evidence', ask: 'evidence' };
export const entryTab = (e: PaneEntry): PaneTab => ENTRY_TAB[e];
/** The ARIA tabs keys: ← and → move to the previous and next tab (wrapping), Home and End to the first and last; else null. */
export function tabKeyMove(current: PaneTab, key: string, tabs: readonly PaneTab[] = PANE_TABS.map(t => t.key)): PaneTab | null {
  const i = tabs.indexOf(current); if (i < 0 || !tabs.length) return null;
  if (key === 'ArrowRight') return tabs[(i + 1) % tabs.length]!;
  if (key === 'ArrowLeft') return tabs[(i - 1 + tabs.length) % tabs.length]!;
  if (key === 'Home') return tabs[0]!;
  if (key === 'End') return tabs[tabs.length - 1]!;
  return null;
}

/* ---------- 구조: its sections in order (8.3) ---------- */
/** 하는 일 and 확인 필요 read in the first-screen chain (하는 일 → 받는 것 → 동작 요약 → 내는 것 → 확인 필요); the rest follow it. */
export type StructureSection = 'role' | 'caution' | 'contract' | 'behaviour' | 'rules' | 'links' | 'where';
export const STRUCTURE_ORDER: readonly StructureSection[] = ['role', 'caution', 'contract', 'behaviour', 'rules', 'links', 'where'];
export const STRUCTURE_TITLE: Record<StructureSection, string> = { role: '하는 일', caution: '확인 필요', contract: '계약', behaviour: '동작', rules: '규칙과 관문', links: '연결', where: '어디에' };
const CHIP_WORD: Record<StructureSection, string> = { role: '하는 일', caution: '확인', contract: '계약', behaviour: '동작', rules: '규칙', links: '연결', where: '어디에' };
/** The given sections in STRUCTURE_ORDER, those absent (null) left out. */
export function structureSections<T>(by: Partial<Record<StructureSection, T | null | undefined>>): T[] {
  return STRUCTURE_ORDER.flatMap(k => { const v = by[k]; return v === null || v === undefined ? [] : [v]; });
}
/** The jump chips over 구조: one per section that is there (true, or its count), in order, a count only above zero
 * ('하는 일 · 확인 2 · 계약 8 · 동작 7 · 규칙 2 · 연결 · 어디에'). */
export function jumpChips(present: Partial<Record<StructureSection, number | true>>): { key: StructureSection; text: string }[] {
  return STRUCTURE_ORDER.flatMap(key => { const v = present[key]; if (v === undefined) return [];
    return [{ key, text: typeof v === 'number' && v > 0 ? `${CHIP_WORD[key]} ${v}` : CHIP_WORD[key] }]; });
}
/** How many rows a list shows before 「N개 더」: the chain's ports and checks, the contract's rows per direction, the steps and
 * the other behaviour lists, the rules, the files. */
export const PANE_SHOWN = { chain: 3, chainSteps: 4, caution: 3, contract: 8, steps: 8, list: 8, rules: 3, where: 4 } as const;
/** A list folded to max rows unless open; a row keep() holds (the picked line, the picked rule) is shown wherever it stands. */
export function foldRows<T>(rows: readonly T[], max: number, open: boolean, keep: (x: T) => boolean = () => false): { shown: T[]; hidden: number } {
  if (open || rows.length <= max) return { shown: [...rows], hidden: 0 };
  const shown = [...rows.slice(0, max), ...rows.slice(max).filter(keep)];
  return { shown, hidden: rows.length - shown.length };
}
/** 동작 요약 in the chain: the loop's unit and stop (each with whether the program filled it), up to four step names in the record's
 * row order (not an execution order) with how many more, or '단계 기록 없음' when the reading names no step. */
export function behaviourSummary(loop: LoopLike | null | undefined, steps: readonly { name: string; program?: boolean }[], config: readonly string[], conditions: readonly LineCondition[],
  unsaid = '미상', max: number = PANE_SHOWN.chainSteps): { loop: { text: string; program: boolean }[] | null; steps: { name: string; program: boolean }[]; more: number; blank: string | null } {
  return { loop: loop ? loopSegments(loop, config, conditions, unsaid).filter(x => x.key !== 'resume').map(({ text, program }) => ({ text, program })) : null,
    steps: steps.slice(0, max).map(s => ({ name: s.name, program: s.program === true })), more: Math.max(0, steps.length - max), blank: steps.length ? null : '단계 기록 없음' };
}

/** 확인 필요 (8.3 읽기 주의): only what changes how this part reads, from what the reading holds: a claim the record left unknown,
 * a description whose report was later taken back, lines resting only on reports taken back, another record's description that does
 * not replace the current one, a report that replaced an earlier one here. Nothing is guessed (a conflict the reading does not say is
 * not made up here). */
export type CautionKind = 'unknown' | 'revised-basis' | 'revised-line' | 'other-role' | 'revised';
export interface CautionRow<T> { key: string; kind: CautionKind; label: string; text: string; hint: string; about: string | null; claim: T | null }
export function cautionRows<T extends PaneClaim>(u: { claims: readonly T[]; roleBasisRevised: boolean; revised: boolean; corrected?: unknown; others: readonly { text: string; about: string | null }[] }, revisedLines: number): CautionRow<T>[] {
  const out: CautionRow<T>[] = [];
  u.claims.forEach((c, i) => { if (claimTopic(c) === 'unknown') out.push({ key: `unknown:${i}`, kind: 'unknown', label: '모름', text: c.text, hint: '기록이 확인하지 못했다고 남긴 것', about: null, claim: c }); });
  if (u.roleBasisRevised && !u.corrected) out.push({ key: 'revised-basis', kind: 'revised-basis', label: '정정됨', text: '설명의 근거였던 보고는 이후 정정됨', hint: '설명은 그대로 두었지만, 지금의 근거에 기대지 않아요', about: null, claim: null });
  if (revisedLines > 0) out.push({ key: 'revised-line', kind: 'revised-line', label: '정정됨', text: `선 ${revisedLines}개는 이후 정정된 보고에서만 읽음`, hint: '선은 그대로 그렸지만, 그 근거였던 보고를 뒤의 기록이 거뒀어요', about: null, claim: null });
  u.others.forEach((x, i) => out.push({ key: `other-role:${i}`, kind: 'other-role', label: '다른 설명', text: x.text, hint: '다른 기록의 설명 · 현재 설명을 대체한다는 근거 없음', about: x.about, claim: null }));
  if (u.revised) out.push({ key: 'revised', kind: 'revised', label: '정정', text: '이 부분의 앞 보고를 뒤 기록이 대체함', hint: '기록이 앞의 말을 대체한다고 적은 정정이 있어요 · 이력에서 이전 → 지금', about: null, claim: null });
  return out;
}

/* ---------- 항목 근거 미연결 추출값: list values without a line of their own ---------- */
/** inputs · outputs · fields · config are lists of names (types.ts), and stateVars carry no quote: a reading keeps no source line per
 * item (contract map-reading.16). They read under this quiet head in the section they belong to, never as a cited row. */
export const UNLINKED_HEAD = '항목 근거 미연결 추출값';
export const UNLINKED_HINT = '정리가 목록 칸으로 적은 값이에요 · 항목마다 원문 줄을 저장하지 않아 근거가 항목에 연결되지 않아요 (계약 map-reading.16) · 원문은 근거 탭의 기록에서';
const nameKey = (s: string) => s.replace(/`/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
/** The names no line carries: a name a line's payload says the same way (case, backquotes and spacing aside) is cited by that line. */
export function unlinkedNames(names: readonly string[], payloads: readonly (string | null | undefined)[]): string[] {
  const said = new Set(payloads.flatMap(p => (p ? [nameKey(p)] : [])));
  return names.filter(n => !said.has(nameKey(n)));
}
/** The words a kind gives its lists (8.3: an AI judgement's 맥락 · 기준 · 반환, a store's 보관하는 칸, a person's 받는 요청, an outside
 * system's 우리가 보내는 것 · 우리에게 오는 것); a kind without its own words reads 받는 것 · 내는 것 · 필드 · 설정. */
export function listLabels(type: string | null): { inputs: string; outputs: string; fields: string; config: string } {
  const base = { inputs: '받는 것', outputs: '내는 것', fields: '필드', config: '설정' };
  if (type === 'ai') return { ...base, inputs: '맥락', outputs: '반환', config: '기준' };
  if (type === 'store') return { ...base, fields: '보관하는 칸' };
  if (type === 'person') return { ...base, inputs: '받는 요청' };
  if (type === 'external') return { ...base, inputs: '우리가 보내는 것', outputs: '우리에게 오는 것' };
  if (type === 'timer') return { ...base, config: '일정·설정' };
  return base;
}
/** The rows a kind reads first in 계약 (8.3), only from what is there: an outside system's inside lies outside the records; a
 * person's rules kept by hand (devices of kind person); an AI judgement's exits (its condition rows' then); a timer's targets (the
 * parts its outgoing control lines start). Each rests on rows shown with their own lines elsewhere (or is the fixed scope note). */
export interface LeadRow { key: string; label: string; text: string; hint: string }
export function kindLead(type: string | null, d: { exits: readonly string[]; manualRules: number; targets: readonly string[] }): LeadRow[] {
  const few = (xs: readonly string[]) => { const u = [...new Set(xs)]; return `${u.slice(0, 4).join(' · ')}${u.length > 4 ? ` +${u.length - 4}` : ''}`; };
  if (type === 'external') return [{ key: 'inside', label: '내부', text: '기록 범위 밖', hint: '외부 시스템의 안은 이 기록들이 다루지 않아요 · 단계가 기록돼 있어도 수만 읽어요' }];
  if (type === 'person' && d.manualRules) return [{ key: 'manual', label: '손으로 지키는 규칙', text: String(d.manualRules), hint: '보장 장치가 사람인 규칙 · 규칙과 관문에서 각 규칙의 원문 줄' }];
  if (type === 'ai' && d.exits.length) return [{ key: 'exits', label: '판정 출구', text: few(d.exits), hint: '조건 행의 그때 결과 · 동작의 조건에서 각 행의 원문 줄' }];
  if (type === 'timer' && d.targets.length) return [{ key: 'targets', label: '기동하는 것', text: few(d.targets), hint: '이 부분에서 나가는 제어 선의 상대 · 계약의 내는 것에서 각 선' }];
  return [];
}

/* ---------- 근거: the evidence list (S2 numbers it) ---------- */
/** What each piece of the drawing rests on, grouped under 구조's section heads in 구조's order (하는 일 → 확인 필요 → 계약 → 동작 →
 * 규칙과 관문 → 어디에), then the current claims 구조 does not use (그 밖의 기록된 말, in the claims' own order). S2 numbers the
 * entries (〔등급·n〕, the same span one number) and links 구조's rows to them; this is the seam: one entry per cited thing. */
export type EvidenceKind = 'role' | 'state' | 'type' | 'relation' | 'loop' | 'step' | 'condition' | 'portmap' | 'fileRole' | 'rule' | 'claim';
export type EvidenceSection = Exclude<StructureSection, 'links'> | 'other';
export const EVIDENCE_ORDER: readonly EvidenceSection[] = ['role', 'caution', 'contract', 'behaviour', 'rules', 'where', 'other'];
export const EVIDENCE_TITLE: Record<EvidenceSection, string> = { role: '하는 일', caution: '확인 필요', contract: '계약', behaviour: '동작', rules: '규칙과 관문', where: '어디에', other: '그 밖의 기록된 말' };
export interface EvidenceEntry<C> { key: string; section: EvidenceSection; kind: EvidenceKind; label: string; quote: QuoteLike | null; claim: C | null }
export interface EvidenceGroup<C> { section: EvidenceSection; entries: EvidenceEntry<C>[] }
export interface EvidenceSource<C> {
  roleBasis: readonly QuoteLike[]; state: { label: string; quote: QuoteLike | null } | null; type: { label: string; quote: QuoteLike | null } | null;
  relations: readonly { id: string; label: string; quote: QuoteLike | null }[];
  loop: { quote: QuoteLike } | null; steps: readonly { name: string; quote: QuoteLike }[]; conditions: readonly { when: string; quote: QuoteLike }[];
  portMap: readonly { port: string; step: string; direction: 'in' | 'out'; quote: QuoteLike }[]; fileRoles: readonly { path: string; quote: QuoteLike }[];
  /** The current claims in the pane's order, and those 규칙과 관문 reads (rules, gates, withdrawals). */
  claims: readonly C[]; rules: readonly C[];
}
export function evidenceList<C extends PaneClaim>(s: EvidenceSource<C>): EvidenceGroup<C>[] {
  const by = new Map<EvidenceSection, EvidenceEntry<C>[]>();
  const add = (section: EvidenceSection, kind: EvidenceKind, key: string, label: string, quote: QuoteLike | null, claim: C | null = null) => {
    const l = by.get(section) ?? []; l.push({ key, section, kind, label, quote, claim }); by.set(section, l); };
  s.roleBasis.forEach((q, i) => add('role', 'role', `role:${i}`, s.roleBasis.length > 1 ? `설명의 원문 ${i + 1}` : '설명의 원문', q));
  if (s.state) add('role', 'state', 'state', s.state.label, s.state.quote);
  if (s.type) add('role', 'type', 'type', s.type.label, s.type.quote);
  const ruled = new Set<C>(s.rules);
  s.claims.forEach((c, i) => { if (!ruled.has(c) && claimTopic(c) === 'unknown') add('caution', 'claim', `claim:${i}`, c.text, claimQuote(c), c); });
  for (const r of s.relations) add('contract', 'relation', `relation:${r.id}`, r.label, r.quote);
  if (s.loop) add('behaviour', 'loop', 'loop', '반복', s.loop.quote);
  s.steps.forEach((x, i) => add('behaviour', 'step', `step:${i}`, `단계 ${x.name}`, x.quote));
  s.conditions.forEach((x, i) => add('behaviour', 'condition', `condition:${i}`, `조건 ${x.when}`, x.quote));
  s.portMap.forEach((x, i) => add('behaviour', 'portmap', `portmap:${i}`, x.direction === 'in' ? `포트 대응 ${x.port} ⇥ ${x.step}` : `포트 대응 ${x.step} ⇤ ${x.port}`, x.quote));
  s.rules.forEach((c, i) => add('rules', 'rule', `rule:${i}`, c.text, claimQuote(c), c));
  s.fileRoles.forEach((x, i) => add('where', 'fileRole', `file:${i}`, `파일 ${x.path}`, x.quote));
  s.claims.forEach((c, i) => { if (!ruled.has(c) && claimTopic(c) !== 'unknown') add('other', 'claim', `claim:${i}`, c.text, claimQuote(c), c); });
  return EVIDENCE_ORDER.flatMap(section => { const entries = by.get(section); return entries?.length ? [{ section, entries }] : []; });
}
const claimQuote = (c: PaneClaim): QuoteLike => ({ record: c.record, quote: c.quote, ...(c.from !== undefined ? { from: c.from } : {}), ...(c.to !== undefined ? { to: c.to } : {}) });
/** A quoted span: the record and its place when the reading kept one, else the record and the words (spacing aside). */
export const spanKey = (q: QuoteLike): string => (q.from !== undefined && q.to !== undefined ? `${q.record}|${q.from}|${q.to}` : `${q.record}|${q.quote.replace(/\s+/g, ' ').trim()}`);
/** The 근거 tab's count: the distinct quoted spans among the entries (the same span cited twice is one; an entry without a line none). */
export const evidenceCount = (groups: readonly EvidenceGroup<unknown>[]): number => new Set(groups.flatMap(g => g.entries.flatMap(e => (e.quote ? [spanKey(e.quote)] : [])))).size;

/* ---------- 근거 numbered (map design v3 8.4–8.5, slice S2) ----------
 * One item per cited span, numbered once in 구조's reading order: the head (the kind word, the operations line) → 하는 일 (the
 * description's passages) → the chain's 받는 것 (its first rows) → 동작 요약 (the loop, the first steps) → 내는 것 → 확인 필요 →
 * 계약 (every line in, then out) → 동작 (the loop, steps, condition rows, port rows) → 규칙과 관문 (each rule's words, its places and
 * what keeps it; gates; withdrawals) → 연결 → 어디에 (파일 지도 rows), then the current claims 구조 does not use (그 밖의 기록된 말, in
 * topic order). The same span is one item and one number wherever it is cited (its uses: 「이 구간을 인용한 주장 N」); an item's
 * section is where it is first cited. The numbers depend only on the reading (what it holds and in which order), never on the lens,
 * the tab, the 근거 view, a fold or the picked line; storage keys (a dispute, a way back) use the span and the row, never n.
 * A value with no line of its own (inputs · outputs · fields · config, state kept) is never an item: no number, no footnote. */
export type ItemSection = StructureSection | 'other';
export const ITEM_ORDER: readonly ItemSection[] = ['role', 'caution', 'contract', 'behaviour', 'rules', 'links', 'where', 'other'];
export const ITEM_TITLE: Record<ItemSection, string> = { ...STRUCTURE_TITLE, other: '그 밖의 기록된 말' };
/** One cited thing: a row, a sentence or a field of 구조 (thing: the row's key in this drawing, as 구조 looks it up), what it says
 * (label), the claim when it is one, and ref: the stable key a person's 「이 해석이 틀림」 note is kept under (a claim's own key, the
 * description's 'role', else the row's kind and identity). said: the words the note keeps. */
export interface EvidenceUse<C> { thing: string; section: ItemSection; kind: EvidenceKind; label: string; claim: C | null; ref: string; said: string;
  /** The time of the reading that read it, when the source says (a claim's own reading's). */
  at: string | null }
export interface EvidenceItem<C> {
  /** The span (spanKey): the same record and place, or the same words where the reading kept no place. */
  key: string; n: number; section: ItemSection; kind: EvidenceKind; label: string; quote: QuoteLike;
  /** The author's tag on the line (a claim's own, else one written in the words), or null: never the app's check. */
  grade: EvidenceGrade | null;
  uses: EvidenceUse<C>[];
}
export interface EvidenceBook<C> {
  items: EvidenceItem<C>[];
  /** The items by the section they are first cited in, in ITEM_ORDER, each in number order. */
  groups: { section: ItemSection; items: EvidenceItem<C>[] }[];
  /** A thing's item (null-free: a thing without a line is in unquoted instead). */
  thing: Map<string, EvidenceItem<C>>;
  span: Map<string, EvidenceItem<C>>;
  claim: Map<C, EvidenceItem<C>>;
  /** Things 구조 reads that carry no line (a line a person drew, a kind word with no passage): never numbered. */
  unquoted: EvidenceUse<C>[];
}
export interface ItemsSource<C> {
  roleBasis: readonly QuoteLike[]; roleText?: string | null; roleAt?: (q: QuoteLike) => string | null;
  state: { label: string; quote: QuoteLike | null; at?: string | null } | null; type: { label: string; quote: QuoteLike | null; at?: string | null } | null;
  /** The lines, each direction in the pane's own order: in (to the part), out (from it), with (needs · shares · related). */
  relations: readonly { id: string; label: string; quote: QuoteLike | null; dir: 'in' | 'out' | 'with'; at?: string | null }[];
  loop: { quote: QuoteLike; at?: string | null } | null; steps: readonly { name: string; quote: QuoteLike; at?: string | null }[]; conditions: readonly { when: string; quote: QuoteLike; at?: string | null }[];
  portMap: readonly { port: string; step: string; direction: 'in' | 'out'; quote: QuoteLike; at?: string | null }[];
  /** In 어디에's order (whereRows roles). */
  fileRoles: readonly { path: string; quote: QuoteLike; at?: string | null }[];
  /** The current claims in the pane's order; the claims 확인 필요 reads (default: the unknown ones not under 규칙과 관문); the claims
   * 규칙과 관문 reads (rules, gates, withdrawals) with each one's other passages (its places, what keeps it). */
  claims: readonly C[]; cautions?: readonly C[]; rules: readonly C[];
  ruleQuotes?: (c: C) => readonly { key: string; label: string; quote: QuoteLike }[];
  claimRef?: (c: C) => string;
  /** How many rows the first-screen chain shows (PANE_SHOWN.chain, .chainSteps). */
  chain?: { ports: number; steps: number };
}
const REF_MAX = 200;
const clipRef = (s: string) => (s.length > REF_MAX ? s.slice(0, REF_MAX) : s);
export function evidenceItems<C extends PaneClaim>(s: ItemsSource<C>): EvidenceBook<C> {
  const items: EvidenceItem<C>[] = [], span = new Map<string, EvidenceItem<C>>(), thing = new Map<string, EvidenceItem<C>>(), claim = new Map<C, EvidenceItem<C>>();
  const unquoted: EvidenceUse<C>[] = [], seen = new Set<string>();
  const ports = s.chain?.ports ?? PANE_SHOWN.chain, chainSteps = s.chain?.steps ?? PANE_SHOWN.chainSteps;
  const refOf = (c: C) => clipRef(s.claimRef ? s.claimRef(c) : `claim:${c.record}|${c.from ?? ''}|${c.to ?? ''}|${c.text.slice(0, 80)}`);
  const cite = (key: string, section: ItemSection, kind: EvidenceKind, label: string, quote: QuoteLike | null, ref: string, said: string, c: C | null = null, at: string | null = null) => {
    if (seen.has(key)) return; seen.add(key);
    const own = c && typeof (c as { at?: unknown }).at === 'string' ? (c as { at?: string }).at! : null;
    const use: EvidenceUse<C> = { thing: key, section, kind, label, claim: c, ref: clipRef(ref), said, at: at ?? own };
    if (!quote) { unquoted.push(use); return; }
    const k = spanKey(quote), grade = c ? claimEvidence(c) : claimEvidence({ quote: quote.quote });
    let it = span.get(k);
    if (!it) { it = { key: k, n: items.length + 1, section, kind, label, quote, grade, uses: [] }; items.push(it); span.set(k, it); }
    else if (!it.grade && grade) it.grade = grade;
    it.uses.push(use); thing.set(key, it);
    if (c && !claim.has(c)) claim.set(c, it);
  };
  const claimIndex = new Map<C, number>(); s.claims.forEach((c, i) => { if (!claimIndex.has(c)) claimIndex.set(c, i); });
  const claimThing = (c: C, fallback: string) => { const i = claimIndex.get(c); return i === undefined ? fallback : `claim:${i}`; };
  const quoteOf = (c: C): QuoteLike => ({ record: c.record, quote: c.quote, ...(c.from !== undefined ? { from: c.from } : {}), ...(c.to !== undefined ? { to: c.to } : {}) });
  // The head: the kind word, then the operations line; then the description's passages.
  if (s.type) cite('type', 'role', 'type', s.type.label, s.type.quote, 'type', s.type.label, null, s.type.at ?? null);
  if (s.state) cite('state', 'role', 'state', s.state.label, s.state.quote, 'state', s.state.label, null, s.state.at ?? null);
  s.roleBasis.forEach((q, i) => cite(`role:${i}`, 'role', 'role', s.roleBasis.length > 1 ? `설명의 원문 ${i + 1}` : '설명의 원문', q, ROLE_KEY, s.roleText ?? '', null, s.roleAt?.(q) ?? null));
  const rel = (x: ItemsSource<C>['relations'][number], section: ItemSection) => cite(`relation:${x.id}`, section, 'relation', x.label, x.quote, `relation:${x.id}`, x.label, null, x.at ?? null);
  const ins = s.relations.filter(x => x.dir === 'in'), outs = s.relations.filter(x => x.dir === 'out');
  // The chain: 받는 것 → 동작 요약 → 내는 것 → 확인 필요 (its rows are 계약's and 동작's: they are filed there).
  ins.slice(0, ports).forEach(x => rel(x, 'contract'));
  const loop = () => { if (s.loop) cite('loop', 'behaviour', 'loop', '반복', s.loop.quote, 'loop', '반복', null, s.loop.at ?? null); };
  const step = (x: ItemsSource<C>['steps'][number], i: number) => cite(`step:${i}`, 'behaviour', 'step', `단계 ${x.name}`, x.quote, `step:${x.name}`, `단계 ${x.name}`, null, x.at ?? null);
  loop(); s.steps.slice(0, chainSteps).forEach(step);
  outs.slice(0, ports).forEach(x => rel(x, 'contract'));
  const ruled = new Set<C>(s.rules);
  const cautions = s.cautions ?? s.claims.filter(c => !ruled.has(c) && claimTopic(c) === 'unknown');
  for (const c of cautions) cite(claimThing(c, `caution:${refOf(c)}`), 'caution', 'claim', c.text, quoteOf(c), refOf(c), c.text, c);
  // 계약, 동작, 규칙과 관문, 연결, 어디에.
  ins.forEach(x => rel(x, 'contract')); outs.forEach(x => rel(x, 'contract'));
  loop(); s.steps.forEach(step);
  s.conditions.forEach((x, i) => cite(`condition:${i}`, 'behaviour', 'condition', `조건 ${x.when}`, x.quote, `condition:${x.when}`, `조건 ${x.when}`, null, x.at ?? null));
  s.portMap.forEach((x, i) => { const label = x.direction === 'in' ? `포트 대응 ${x.port} ⇥ ${x.step}` : `포트 대응 ${x.step} ⇤ ${x.port}`;
    cite(`portmap:${i}`, 'behaviour', 'portmap', label, x.quote, `portmap:${x.direction}:${x.port}:${x.step}`, label, null, x.at ?? null); });
  s.rules.forEach((c, j) => {
    const t = claimThing(c, `rule:${j}`), ref = refOf(c);
    cite(t, 'rules', 'rule', c.text, quoteOf(c), ref, c.text, c);
    const own = typeof (c as { at?: unknown }).at === 'string' ? (c as { at?: string }).at! : null;
    for (const x of s.ruleQuotes?.(c) ?? []) cite(`${t}|${x.key}`, 'rules', 'rule', x.label, x.quote, `${ref}|${x.key}`, `${c.text} · ${x.label}`, null, own);
  });
  s.relations.filter(x => x.dir === 'with').forEach(x => rel(x, 'links'));
  s.fileRoles.forEach(x => cite(`file:${pathKey(x.path)}`, 'where', 'fileRole', `파일 ${x.path}`, x.quote, `file:${pathKey(x.path)}`, `파일 ${x.path}`, null, x.at ?? null));
  // The rest of the current claims, in topic order (as the pane reads claims).
  const rest = s.claims.filter(c => !ruled.has(c) && !claim.has(c) && !cautions.includes(c));
  const groupsByTopic = new Map<ClaimTopic, C[]>(); for (const c of rest) { const t = claimTopic(c), g = groupsByTopic.get(t); if (g) g.push(c); else groupsByTopic.set(t, [c]); }
  for (const t of TOPIC_ORDER) for (const c of groupsByTopic.get(t) ?? []) cite(claimThing(c, `other:${refOf(c)}`), 'other', 'claim', c.text, quoteOf(c), refOf(c), c.text, c);
  const groups = ITEM_ORDER.flatMap(section => { const l = items.filter(x => x.section === section); return l.length ? [{ section, items: l }] : []; });
  return { items, groups, thing, span, claim, unquoted };
}
/** A footnote's words: the author's tag and the number ('〔보고·7〕'), the number alone when the line carries no tag ('〔7〕'). */
export const footText = (it: { n: number; grade: EvidenceGrade | null }): string => (it.grade ? `〔${EVIDENCE_LABEL[it.grade]}·${it.n}〕` : `〔${it.n}〕`);
/** The marks after one sentence or row: each item once in number order; two read side by side ('〔보고·3〕〔파일·4〕'), more fold to
 * the first with how many more ('〔보고·3 +2〕', its preview and its click are the first's). */
export function footMarks<T extends { n: number; grade: EvidenceGrade | null }>(list: readonly (T | null | undefined)[]): { text: string; item: T; more: number }[] {
  const u = [...new Map(list.filter((x): x is T => !!x).map(x => [x.n, x] as const)).values()].sort((a, b) => a.n - b.n);
  if (u.length <= 2) return u.map(item => ({ text: footText(item), item, more: 0 }));
  const first = u[0]!, more = u.length - 1;
  return [{ text: first.grade ? `〔${EVIDENCE_LABEL[first.grade]}·${first.n} +${more}〕` : `〔${first.n} +${more}〕`, item: first, more }];
}
/** Footnotes of one group of rows (a list under one heading): an item cited by two rows or more is marked once, at the group's
 * heading ('〔파일·2〕' once, not on eight rows); a row keeps the items only it cites. head: the hoisted numbers in number order;
 * rows: what each row keeps, in its own order. A group of one row keeps its marks where they are. */
export function hoistMarks(rows: readonly (readonly number[])[]): { head: number[]; rows: number[][] } {
  const seen = new Map<number, number>();
  for (const r of rows) for (const n of new Set(r)) seen.set(n, (seen.get(n) ?? 0) + 1);
  const head = [...seen].filter(([, k]) => k >= 2).map(([n]) => n).sort((a, b) => a - b), up = new Set(head);
  return { head, rows: rows.map(r => r.filter(n => !up.has(n))) };
}
/** 근거 분류 (8.5): the author's tag in words, kept apart from the app's own check (there is none: a tag is what the writing session
 * marked, never verified here). */
const GRADE_WORDS: Record<EvidenceGrade, string> = { file: '작성 세션이 파일을 읽었다고 표시', run: '작성 세션이 직접 실행했다고 표시', report: '작성 세션이 다른 세션·문서·사람의 말을 옮겼다고 표시', guess: '작성 세션의 판단이라고 표시', unknown: '작성 세션이 모른다고 남김' };
export const gradeLine = (g: EvidenceGrade | null): string => (g ? `근거 분류: ${EVIDENCE_LABEL[g]} (${GRADE_WORDS[g]} · 앱 확인 없음)` : '근거 분류: 꼬리표 없음 (작성 세션이 분류를 달지 않음 · 앱 확인 없음)');
/** Where a quote stands in its record, when the record says it: the nearest heading above it (a '#' line) and, when the quote's line
 * is a table row ('| … |'), that row's first cell. The words must be at that place (from, else the first place they stand); else nothing. */
export function quotePlace(text: string, q: QuoteLike): { heading: string | null; row: string | null } {
  const none = { heading: null, row: null };
  let at = q.from !== undefined && q.to !== undefined && text.slice(q.from, q.to) === q.quote ? q.from : -1;
  if (at < 0) { const w = q.quote.trim(); at = w ? text.indexOf(w) : -1; }
  if (at < 0) return none;
  const lineStart = text.lastIndexOf('\n', at - 1) + 1, lineEnd = text.indexOf('\n', at), line = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd).trim();
  let heading: string | null = null;
  // Pipeline .43: a 기록 v4 table's title line (「C-PART 부분」) is its heading too.
  for (const l of text.slice(0, lineStart).split('\n').reverse()) { const m = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(l) ?? /^\s*(?:C-[A-Z]{2,12}|P\d-\d{2})\s+(\S.*?)\s*$/.exec(l); if (m) { heading = m[1]!.trim(); break; } }
  // Pipeline .43: the one cell splitter (「&#124;」 and 「\|」 stay in their cell).
  const cell = line.startsWith('|') ? cellTexts(line).map(x => x.replace(/`/g, '').trim()).find(Boolean) ?? null : null;
  const clip = (s: string | null, n: number) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);
  return { heading: clip(heading, 48), row: /^:?-{3,}:?$/.test(cell ?? '') ? null : clip(cell, 40) };
}
/** The way back from 근거 to where a footnote was opened (8.4-3): the first point is kept while the reader opens other passages,
 * up to five are held (the strip always returns to the first); a new point past five is not kept. */
export const RETURN_MAX = 5;
export function pushReturn<T>(stack: readonly T[], point: T, max = RETURN_MAX): T[] { return stack.length >= max ? [...stack] : [...stack, point]; }
/** Two names are the same name (case, backquotes and spacing aside): a candidate only, never a citation. */
export const sameName = (a: string, b: string): boolean => nameKey(a) === nameKey(b);

/* ---------- the panel's width (8.8) ---------- */
/** clamp(384px, 29vw, 448px) by default (styles.css --insp-w); dragged by the left edge between 360 and 600, kept per browser. A
 * dragged width gives way first when the map would be left under 480px (never below the default). Below 720px: the whole window. */
export const PANE_WIDTH_KEY = 'agentflow.studio.paneWidth.1';
export const PANE_MIN = 360, PANE_MAX = 600, MAP_MIN = 480, PANE_NARROW = 720;
export const paneDefault = (vw: number): number => Math.min(448, Math.max(384, vw * 0.29));
export function paneWidthFor(saved: number | null, vw: number): number {
  if (vw < PANE_NARROW) return vw;
  if (saved === null || !Number.isFinite(saved)) return paneDefault(vw);
  const w = Math.min(PANE_MAX, Math.max(PANE_MIN, Math.round(saved)));
  return Math.min(w, Math.max(paneDefault(vw), vw - MAP_MIN));
}
/** The width while the edge is dragged: the start width plus how far the pointer moved left, within 360–600. */
export const dragWidth = (start: number, startX: number, x: number): number => Math.round(Math.min(PANE_MAX, Math.max(PANE_MIN, start + startX - x)));
interface WidthStorage { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem?(k: string): void }
/** The saved width, or null (none, unreadable, or storage blocked). */
export function readPaneWidth(storage: WidthStorage | null): number | null {
  try { const v = storage?.getItem(PANE_WIDTH_KEY); if (!v) return null; const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(PANE_MAX, Math.max(PANE_MIN, Math.round(n))) : null; } catch { return null; }
}
/** Keeps a width (null: back to the default); false when the browser refused. */
export function writePaneWidth(storage: WidthStorage | null, w: number | null): boolean {
  try { if (!storage) return false; if (w === null) { if (storage.removeItem) storage.removeItem(PANE_WIDTH_KEY); else storage.setItem(PANE_WIDTH_KEY, ''); } else storage.setItem(PANE_WIDTH_KEY, String(Math.round(w))); return true; } catch { return false; }
}

/** 동작's head: '단계 N · 조건 K · 반복 · 유지 상태 S', each only when the reading names one. */
export function structureSummary(c: { steps: number; conditions: number; loop: boolean; vars: number }): string {
  return [c.steps ? `단계 ${c.steps}` : '', c.conditions ? `조건 ${c.conditions}` : '', c.loop ? '반복' : '', c.vars ? `유지 상태 ${c.vars}` : ''].filter(Boolean).join(' · ');
}
/** 구조's 조건 rows (map-reading.12 conditions[]), in the part's order: each row's words ('조건 {when} → {then} · 아니면 → {else}'),
 * the step it stands on by the detail view's rule (steps-view conditionPlacement) or null (단계 미상), and its index (the key a
 * rule's 「조건」 chip and the detail view use). */
export interface StructureCondition<T> { index: number; condition: T; text: string; step: string | null }
export function structureConditions<T extends ConditionLike>(conditions: readonly T[], steps: readonly Pick<ChainStep, 'name' | 'uses'>[]): StructureCondition<T>[] {
  const at = new Map<number, number>();
  for (const [k, list] of conditionPlacement(conditions, steps).steps) for (const x of list) at.set(x.index, k);
  return conditions.map((condition, index) => { const k = at.get(index);
    return { index, condition, text: conditionLines(condition).join(' · '), step: k === undefined ? null : steps[k]!.name }; });
}
/** 구조's 반복 and 유지 상태 (map-reading.9, with map-reading.13's program marks): the loop line in its three parts, each with whether
 * the program filled it (line-view loopSegments), and each kept state with what reads and changes it ('미상' when not said) and
 * whether the program put it there (a program state names nothing but itself). */
export interface StructureKeep { loop: { key: 'unit' | 'stop' | 'resume'; text: string; program: boolean }[] | null; vars: { name: string; scope: string | null; rw: string; program: boolean }[] }
export function structureKeep(loop: LoopLike | null | undefined, vars: readonly { name: string; scope: string | null; readBy: readonly string[]; changedBy: readonly string[]; program?: boolean }[],
  config: readonly string[], conditions: readonly LineCondition[], unsaid = '미상'): StructureKeep {
  return { loop: loop ? loopSegments(loop, config, conditions, unsaid) : null,
    vars: vars.map(v => ({ name: v.name, scope: v.scope, rw: `읽음 ${v.readBy.length ? v.readBy.join(', ') : unsaid} · 바꿈 ${v.changedBy.length ? v.changedBy.join(', ') : unsaid}`, program: isProgram(v) })) };
}

/* ---------- 어디에 with the 파일 지도 (map-reading.14 fileRoles) ----------
 * A part's 「파일 지도」 rows give a file its role (역할 한 줄): 어디에 lists each such file as '경로 · 역할' with its row's quote, and
 * the files and places without a role as chips, as before. A path is the same path with backquotes, the spacing around it, a leading './', a
 * trailing '/' and the slash direction aside (case kept). The detail view's step box shows on hover the role of a file its uses
 * name; a rule's 보장 line whose code enforcement rests on a 파일 지도 row names that file as its place. Never matched by guess. */
export interface FileRoleLike { path: string; role: string; quote: QuoteLike }
export const pathKey = (p: string): string => p.replace(/`/g, '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
/** At most this many files and places without a role read as chips (as before). */
export const WHERE_SHOWN = 8;
/** The 어디에 rows: roles (the files a 파일 지도 row gives a role: the part's files and places in their order first, then the other
 * rows in theirs) and plain (the files and places without a role, each once, up to max, as before). */
export function whereRows<T extends FileRoleLike>(places: readonly (string | null | undefined)[], fileRoles: readonly T[], max = WHERE_SHOWN): { roles: T[]; plain: string[] } {
  const byKey = new Map<string, T>();
  for (const f of fileRoles) { const k = pathKey(f.path); if (k && !byKey.has(k)) byKey.set(k, f); }
  const roles: T[] = [], plain: string[] = [];
  for (const p of places) {
    if (!p) continue;
    const f = byKey.get(pathKey(p));
    if (f) { if (!roles.includes(f)) roles.push(f); } else if (!plain.includes(p)) plain.push(p);
  }
  for (const f of byKey.values()) if (!roles.includes(f)) roles.push(f);
  return { roles, plain: plain.slice(0, max) };
}
/** The 파일 지도 row a step's uses item names: the item is the path, or holds it whole (not as a piece of a longer name: no letter,
 * digit, '_', '-', '/' or '.' joined to it, a sentence's closing '.' aside); the longest path wins. null when none. */
export function fileRoleOf<T extends FileRoleLike>(item: string, fileRoles: readonly T[]): T | null {
  const w = pathKey(item); let best: T | null = null, len = 2;
  const joined = (c: string) => /[\w\-/.]/.test(c);
  for (const f of fileRoles) {
    const k = pathKey(f.path); if (k.length <= len) continue;
    if (w === k) { best = f; len = k.length; continue; }
    for (let at = w.indexOf(k); at >= 0; at = w.indexOf(k, at + 1)) {
      const before = at > 0 ? w[at - 1]! : '', after = w[at + k.length] ?? '', next = w[at + k.length + 1] ?? '';
      if (before && joined(before)) continue;
      if (after && joined(after) && !(after === '.' && !joined(next))) continue;
      best = f; len = k.length; break;
    }
  }
  return best;
}
/** The place of a rule's 보장 line: a code enforcement whose quote is one of the part's 파일 지도 rows (the same record and words,
 * spacing aside, and the same span when both carry one) names that row's file. null otherwise (another kind, or no such row). */
export function enforcePlace<T extends FileRoleLike>(e: { kind: string; quote: QuoteLike | null }, fileRoles: readonly T[]): T | null {
  if (e.kind !== 'code' || !e.quote) return null;
  return fileRoles[conditionOfQuote(e.quote, fileRoles)] ?? null;
}
