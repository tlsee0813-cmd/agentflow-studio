/* Cards v2 (spec cards v2 §1, §2, §5, §7): what a typed card's face says at rest and what moved off it. Pure: no DOM.
 * - The status dot: only for a recorded operations state (a C-STATUS 운영 상태 row or the reading's state), shape and colour together,
 *   never from file evidence alone, never 멈춤 from age, a conflict between records its own mark (never one of them picked).
 * - The role line: the first sentence of what the part does (the full text in the hover card and the pane).
 * - 「외 N」: a count always says what it counts (its noun in the tip, and in the text where there is room).
 * - The display settings: a global default and an explicit per-project override, read and written with fallback; lenses are
 *   temporary and never write them. */
import type { StorageLike } from '../shared/storage.js';
import { clipKeepPlan, planCutNeeded, textWidth } from '../shared/studio.js';

/* ---------- the status dot ---------- */
export type DotKind = 'running' | 'stopped' | 'waiting' | 'conflict';
/** The dot's words (also its accessible name): the state as a report, never a status the app saw. */
export const DOT_WORD: Readonly<Record<DotKind, string>> = { running: '가동 보고', stopped: '멈춤 보고', waiting: '대기 보고', conflict: '운영 기록 충돌' };
/** The legend's one line (구성 lens head and the legend note). */
export const DOT_LEGEND = '점: 기록된 운영 상태만 · 점 없음 = 상태 미확인';
export type Grade = 'file' | 'run' | 'report' | 'guess' | 'unknown';
export const GRADE_WORD: Readonly<Record<Grade, string>> = { file: '파일', run: '실행', report: '보고', guess: '추정', unknown: '모름' };
/** What the dot reads: the reading's state with its time and its quote's grade, and the record's 운영 상태 rows (a v4/v5 C-STATUS
 * row each: running · idle · stopped · failed · unknown, with its 적용 범위 and its own quote's grade). life: the card's lifecycle
 * chip (폐기 · 미구현 · 설계만), which a dot never doubles. */
export interface DotInput { state: string | null; when: string | null; grade: Grade | null; quote?: string | null; ops?: readonly { value: string; basis?: string | null; scope?: string | null; grade?: Grade | null }[]; life?: string | null }
export interface StatusDot { kind: DotKind; word: string;
  /** the dot's own answer (spec §7: 언제, 무엇을 근거로?): 「가동 보고 · 08:08Z · 보고 근거」 */
  line: string; grade: Grade | null }
const OP_KIND: Readonly<Record<string, DotKind | null>> = { running: 'running', stopped: 'stopped', failed: 'stopped', idle: 'waiting', unknown: null };
/** A 운영 상태 row's value in words (the pane's, the dot's tip and its accessible name): never the record's enum spelling. */
export const OP_VALUE_WORD: Readonly<Record<string, string>> = { running: '실행 중', idle: '유휴·대기', stopped: '정지', failed: '실패', unknown: '모름' };
/** A 작업 중 state is an operations state only when the record says so in so many words (review M5): 「운영 상태 … 대기」, 「운영 대기」,
 * 「유휴」, idle or standby; never a development wait such as 「코드 리뷰 대기」. */
const OPS_WAITING = /운영\s*(상태\s*[:：·]?\s*)?(대기|유휴)|유휴|\bidle\b|\bstandby\b/i;
/** The 운영 상태 rows that disagree, or null: rows are one claim only within one stated 적용 범위 (API running and batch idle are two
 * claims, each of its own range), and rows on file evidence alone never make a mark (a dot never comes from file evidence alone). */
export function opsConflict(ops: DotInput['ops']): { value: string; scope: string | null }[] | null {
  const by = new Map<string, { value: string; scope: string | null; grade: Grade | null }[]>();
  for (const o of ops ?? []) {
    if (!OP_KIND[o.value]) continue;
    const k = (o.scope ?? '').replace(/\s+/g, ' ').trim(); let l = by.get(k); if (!l) by.set(k, l = []);
    l.push({ value: o.value, scope: o.scope ?? null, grade: o.grade ?? null });
  }
  for (const l of by.values()) if (new Set(l.map(o => OP_KIND[o.value])).size > 1 && !l.every(o => o.grade === 'file')) return l.map(o => ({ value: o.value, scope: o.scope }));
  return null;
}
/** A conflict's rows in words: 「실행 중 · 정지」, each with its range when the record wrote one. */
export const conflictWords = (rows: readonly { value: string; scope: string | null }[]): string => rows.map(o => `${OP_VALUE_WORD[o.value] ?? o.value}${o.scope ? `(${o.scope})` : ''}`).join(' · ');
/** The dot for a card, or null (no dot means not confirmed: the legend says so). when: the time as the card shows it. */
export function statusDot(x: DotInput, when: string | null = x.when): StatusDot | null {
  if (x.life) return null;
  // Records that say different operations states for one range: their own mark, never one picked (the hover and the pane list them).
  const clash = opsConflict(x.ops);
  if (clash) return { kind: 'conflict', word: DOT_WORD.conflict, line: `${DOT_WORD.conflict} · ${conflictWords(clash)}`, grade: null };
  // The reading's own state only (review M1; record-reading 4.6: a 유휴·대기 row alone decides nothing, so it draws no dot either and
  // every surface says 「운영 기록 없음」 for it). 작업 중 is a ring only when the record calls it an operations state (review M5): an
  // idle 운영 상태 row beside it, or the words of its quote.
  const idleRow = (x.ops ?? []).some(o => o.value === 'idle');
  const kind: DotKind | null = x.state === 'running' ? 'running' : x.state === 'stopped' ? 'stopped'
    : x.state === 'working' && (idleRow || OPS_WAITING.test(x.quote ?? '')) ? 'waiting' : null;
  if (!kind) return null;
  // Never from file evidence alone: a state whose only grade is 'file' gets no dot (the hover and the pane still say it).
  if (x.grade === 'file') return null;
  const at = when?.trim() ? ` · ${when.trim()}` : '', basis = x.grade ? ` · ${GRADE_WORD[x.grade]} 근거` : ' · 근거 꼬리표 없음';
  return { kind, word: DOT_WORD[kind], line: `${DOT_WORD[kind]}${at}${basis}`, grade: x.grade };
}
/** The recorded state in words for the hover card (or null with no record: 「운영 기록 없음」 lives in the pane). */
export function opsSaid(word: string | null, when: string | null, grade: Grade | null): string | null {
  if (!word) return null;
  return [word, when?.trim() ? `기준 ${when.trim()}` : null, grade ? `${GRADE_WORD[grade]} 근거` : null].filter(Boolean).join(' · ');
}

/* ---------- the role line ---------- */
/** The first sentence of a description (the card's 「하는 일」 line), or null for none. Recipe .53 (ruling F6 Q1): a description that ends on a
 * plan word never goes missing from the line by a cut. Recipe .54 (review of .53): only the first sentence's own plan word counts (a later
 * sentence's never comes onto the line: no sentence the record did not write); a first sentence wider than ROLE_LINE_WIDTH whose plan word
 * sits after a clause boundary is cut at that boundary, 「head… clause」. Review of .54 (finding 3): any plan word (studio
 * PLAN_WORD), wherever it sits in the first sentence: a sentence whose plan word a plain cut to ROLE_LINE_WIDTH would leave out is cut by
 * studio clipKeepPlan (its clause, else the word with the word next to it); one whose plan word fits in that head is shown whole. */
export const ROLE_LINE_WIDTH = 15;
export function roleLine(text: string | null | undefined): string | null {
  const t = (text ?? '').replace(/\s+/g, ' ').trim(); if (!t) return null;
  const m = /^(.+?[.!?。])(?=\s|$)/.exec(t), first = m ? m[1]! : t;
  return planCutNeeded(first, ROLE_LINE_WIDTH, textWidth) ? clipKeepPlan(first, ROLE_LINE_WIDTH, textWidth) : first;
}

/* ---------- counted 「외 N」 ---------- */
/** A count past what a row shows: 「외 N」 in the text, its noun in the tip (「받는 것 2개 더」). */
export const moreText = (n: number): string => `외 ${n}`;
export const moreTip = (n: number, noun: string): string => `${noun} ${n}개 더`;
/** Up to k names and what is left: 「a · b 외 2」. */
export function namesOf(xs: readonly string[], k = 2): string {
  const shown = xs.slice(0, k).join(' · '), rest = xs.length - k;
  return rest > 0 ? `${shown} ${moreText(rest)}` : shown;
}
/** The hover card's key lines: up to two inputs and up to two outputs (each with 「외 N」), one labelled line each (names may hold
 * arrows of their own, so no arrow joins the two); null when the record names neither. */
export function ioLine(inputs: readonly string[], outputs: readonly string[]): string | null {
  if (!inputs.length && !outputs.length) return null;
  return `받는 것 ${inputs.length ? namesOf(inputs) : '미기록'}\n내는 것 ${outputs.length ? namesOf(outputs) : '미기록'}`;
}

/* ---------- display settings (§5) ---------- */
export const DISPLAY_KEY = 'agentflow.studio.display.1';
/** ops: the ops words on the card; values: 받는·내는 것 rows; labels: line labels; evidence: the evidence chip by the status dot. */
export interface DisplaySettings { ops: boolean; values: boolean; labels: boolean; evidence: boolean }
export const DISPLAY_DEFAULT: Readonly<DisplaySettings> = Object.freeze({ ops: false, values: false, labels: true, evidence: false });
export const DISPLAY_WORD: Readonly<Record<keyof DisplaySettings, string>> = { ops: '운영 상태 글자', values: '선 없는 받는·내는 것', labels: '선 이름표', evidence: '근거 꼬리표' };
export const DISPLAY_KEYS: readonly (keyof DisplaySettings)[] = ['ops', 'values', 'labels', 'evidence'];
/** The stored shape: the global default and each project's explicit override (at most PROJECTS_MAX projects, newest kept). */
interface DisplayStore { global?: Partial<DisplaySettings>; projects?: Record<string, Partial<DisplaySettings>> }
const PROJECTS_MAX = 200;
const clean = (x: unknown): Partial<DisplaySettings> => {
  const out: Partial<DisplaySettings> = {}; if (!x || typeof x !== 'object') return out;
  for (const k of DISPLAY_KEYS) { const v = (x as Record<string, unknown>)[k]; if (typeof v === 'boolean') out[k] = v; }
  return out;
};
function load(kv: StorageLike | null): DisplayStore {
  try { const raw = kv?.getItem(DISPLAY_KEY); if (!raw) return {}; const j = JSON.parse(raw) as DisplayStore;
    const projects: Record<string, Partial<DisplaySettings>> = {};
    if (j && typeof j.projects === 'object' && j.projects) for (const [k, v] of Object.entries(j.projects)) projects[k] = clean(v);
    return { global: clean(j?.global), projects };
  } catch { return {}; }
}
/** The settings a project reads: its override when it has one, else the global default, else the defaults; and whether the
 * override is set (the popover's 「이 프로젝트에서만」). Any unreadable store reads as the defaults. */
export function readDisplay(kv: StorageLike | null, project: string | null): { settings: DisplaySettings; own: boolean } {
  const s = load(kv), own = project ? s.projects?.[project] : undefined;
  return { settings: { ...DISPLAY_DEFAULT, ...s.global, ...(own ?? {}) }, own: !!own };
}
/** Writes the settings as the global default, or (only) as this project's override; only=false for a project also drops its
 * override, so the project reads the global default again. Returns false when the store refuses (the view keeps its state). */
export function writeDisplay(kv: StorageLike | null, project: string | null, settings: DisplaySettings, only: boolean): boolean {
  if (!kv) return false;
  const s = load(kv), projects = { ...(s.projects ?? {}) }, next: DisplayStore = { global: s.global ?? {}, projects };
  if (only && project) { delete projects[project]; projects[project] = { ...settings }; }
  else { next.global = { ...settings }; if (project) delete projects[project]; }
  const keys = Object.keys(projects); for (const k of keys.slice(0, Math.max(0, keys.length - PROJECTS_MAX))) delete projects[k];
  try { kv.setItem(DISPLAY_KEY, JSON.stringify(next)); return true; } catch { return false; }
}
/** Drops a project's override (it reads the global default again); the global default is not touched. */
export function clearDisplayOverride(kv: StorageLike | null, project: string): boolean {
  if (!kv) return false;
  const s = load(kv); if (!s.projects?.[project]) return true;
  const projects = { ...s.projects }; delete projects[project];
  try { kv.setItem(DISPLAY_KEY, JSON.stringify({ global: s.global ?? {}, projects })); return true; } catch { return false; }
}
/** What the map shows under a lens (lenses are temporary; the stored settings are never changed): the 상태·공백 lens shows every
 * card's ops word, 「운영 기록 없음」 included, so unknown reads apart from running or stopped. */
export function displayUnder(settings: DisplaySettings, lens: string | null): DisplaySettings & { opsAll: boolean } {
  return lens === 'state' ? { ...settings, ops: true, opsAll: true } : { ...settings, opsAll: false };
}
