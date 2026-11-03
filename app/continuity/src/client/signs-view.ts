/* Signs on the map (map spec 5, cycle 4), the client's pure part: which of a part's current claims are rules, gates and
 * withdrawals (a card's tabs '규칙 N' · '관문 M' · '변경 K'), what a rule row and a change row read as in the pane, the since-time
 * filter (spec 5.3/6: '기준 시각 이후 작성된 기록', a condition on time, never a comparison of two snapshots), and the failure and
 * recovery blanks of the detail view (spec 7). Nothing here changes a claim; nothing is invented: a field the record does not
 * carry reads as its explicit blank.
 *
 * Provisional until the contract carries them (map-reading scopeRef · anchors · enforcedBy · withdrawal kind): a gate is told by
 * its words (a plan with '관문' or a condition '…되면/…이면'), a change's nature by its evidence tag ([파일] design, [실행]
 * implementation, [보고] report), and the since filter reads the claim's own time (when) for the time it was written. Pure: no
 * DOM, so each rule is tested on its own. */
import { claimTopic, claimEvidence, claimWhen, EVIDENCE_LABEL } from '../shared/claim-topic.js';
import type { ClaimKind, ClaimTopic, EvidenceGrade, PartType } from '../shared/types.js';

/** What a sign reads from a claim (a CurrentClaim carries all of it). */
export interface SignClaim {
  kind: ClaimKind; text: string; quote: string; about: string | null;
  topic?: ClaimTopic | null; evidence?: EvidenceGrade | null; when?: string | null; where?: string | null; before?: string | null;
}
export type SignKind = 'rule' | 'gate' | 'change';
export const SIGN_LABEL: Record<SignKind, string> = { rule: '규칙', gate: '관문', change: '변경' };

/* ---------- which claims are signs ---------- */
/** A gate's own word ('다음 관문', '운영 관문'). */
export const GATE_WORD = /관문/;
/** A condition phrase: '…되면' or '…이면' ending a word ('검증되면', 'CALM이면'); not '이면서', '되면서'. */
export const CONDITION = /(?:되|이)면(?![가-힣])/;
/** Provisional (until the contract's enforcedBy and gate kind): a plan that names a gate or states a condition is a gate. */
export function isGate(c: Pick<SignClaim, 'kind' | 'text' | 'topic'>): boolean {
  return claimTopic(c) === 'plan' && (GATE_WORD.test(c.text) || CONDITION.test(c.text));
}
/** The sign a claim is, or null: a rule (topic rule), a gate (isGate), a change (topic withdrawn: before → now). */
export function signKind(c: Pick<SignClaim, 'kind' | 'text' | 'topic'>): SignKind | null {
  const t = claimTopic(c);
  if (t === 'rule') return 'rule';
  if (t === 'withdrawn') return 'change';
  return isGate(c) ? 'gate' : null;
}
export interface PartSigns<T> { rules: T[]; gates: T[]; changes: T[] }
/** A part's signs, each list in the claims' own order. */
export function partSigns<T extends Pick<SignClaim, 'kind' | 'text' | 'topic'>>(claims: readonly T[]): PartSigns<T> {
  const out: PartSigns<T> = { rules: [], gates: [], changes: [] };
  for (const c of claims) { const k = signKind(c); if (k === 'rule') out.rules.push(c); else if (k === 'gate') out.gates.push(c); else if (k === 'change') out.changes.push(c); }
  return out;
}
export const hasSigns = (s: PartSigns<unknown>) => s.rules.length + s.gates.length + s.changes.length > 0;
/** The tabs a card carries, in this order: '규칙 N', '관문 M', '변경 K' (only those with a count). */
export function signTabs(s: PartSigns<unknown>): { kind: SignKind; count: number; text: string }[] {
  return (['rule', 'gate', 'change'] as const).flatMap(kind => {
    const count = (kind === 'rule' ? s.rules : kind === 'gate' ? s.gates : s.changes).length;
    return count ? [{ kind, count, text: `${SIGN_LABEL[kind]} ${count}` }] : [];
  });
}

/* ---------- a rule row (spec 5.1: 범위 · 적용 위치 · 설계 대응 · 확인 검사, shown together) ---------- */
/** The three fields the contract does not carry yet: shown as blanks, never made up. */
export const RULE_BLANKS = { anchors: '적용 위치 미해결', design: '설계 대응 미상', check: '확인 검사 미상' } as const;
export const RULE_BLANK_HINT = {
  anchors: '기록이 이 규칙이 작용하는 정확한 단계·필드·포트를 지정하지 않았다 (지금은 이 부분 전체 범위로만 읽음)',
  design: '이 규칙을 지키는 설계 장치(검사·보장 단계)를 기록이 연결하지 않았다',
  check: '이 규칙을 확인하는 검사와 그 결과를 기록이 연결하지 않았다'
} as const;
export const GATE_BLANK = '관문 종류 미상';
export const GATE_BLANK_HINT = '실행 관문(경로 위 판정)인지 개발·검증 관문(운영 전 조건)인지 기록이 구별하지 않았다 · 잠정: 계획 문장의 ‘관문’·조건(…되면/…이면)으로 고름';
/** Who said it and where, as the record wrote it: its time, its place and its evidence tag; blanks say so. */
export function ruleSaid(c: SignClaim): { when: string; where: string; evidence: string | null } {
  const when = claimWhen(c), ev = claimEvidence(c);
  return { when: when ?? '시각 미기재', where: c.where ?? '자리 미기재', evidence: ev ? EVIDENCE_LABEL[ev] : null };
}

/* ---------- a change row (spec 5.3: 같은 자리의 이전 → 지금, the head keeps its nature and version) ---------- */
export type ChangeNature = 'design' | 'implementation' | 'report';
export const NATURE_LABEL: Record<ChangeNature, string> = { design: '설계 변경', implementation: '구현 변화', report: '보고 정정' };
export const NATURE_UNKNOWN = '변경 성격 미상';
export const NATURE_HINT = '잠정: 계약에 철회 종류가 들어오기 전까지 근거 표시로 추정한 성격 ([파일] 설계 변경 · [실행] 구현 변화 · [보고] 보고 정정)';
/** Provisional (until the contract's withdrawal kind): the nature by the line's evidence tag; null when it says none. */
export function changeNature(c: Pick<SignClaim, 'quote' | 'evidence'>): ChangeNature | null {
  const ev = claimEvidence(c);
  return ev === 'file' ? 'design' : ev === 'run' ? 'implementation' : ev === 'report' ? 'report' : null;
}
/** The comparison's head: '{성격} · {판본} · {시각}', each as the record wrote it; '판본·시각 미상' when it wrote neither. */
export function changeHead(c: SignClaim): string {
  const n = changeNature(c), when = claimWhen(c), about = c.about && c.about !== when ? c.about : null;
  const at = [about ? `판본 ${about}` : null, when].filter(Boolean).join(' · ') || '판본·시각 미상';
  return `${n ? NATURE_LABEL[n] : NATURE_UNKNOWN} · ${at}`;
}
export const BEFORE_BLANK = '이전 문장 미기재';
/** One withdrawal as two columns: what stood before (as written, or its blank) and what stands now. */
export function changeRow(c: SignClaim): { head: string; before: string; now: string; beforeSaid: boolean } {
  return { head: changeHead(c), before: c.before?.trim() || BEFORE_BLANK, now: c.text, beforeSaid: !!c.before?.trim() };
}

/* ---------- the since-time filter ---------- */
/** A time as records write it: '2026-11-03T08:49Z', '2026-11-03 08:49:12Z', '11-03 08:49Z', '11-03', '08:49Z', with an
 * optional offset ('+09:00'); a time without a zone is read as UTC (records write Z). */
const FULL = /^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})(?:(?:T|\s+)(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|UTC|[+-]\d{2}:?\d{2})?$/i;
const CLOCK = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|UTC|[+-]\d{2}:?\d{2})?$/i;
const offsetMs = (z: string | undefined) => { if (!z || /^(Z|UTC)$/i.test(z)) return 0; const m = /^([+-])(\d{2}):?(\d{2})$/.exec(z)!; return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60000; };
/** The stretch of time a written time stands for, in ms: a minute (or a second when seconds are written), a whole day for a
 * date alone. ref: the reading's basis time, which gives a time without a day its day and a date without a year its year
 * (else the current UTC year). null when the words are not a time. */
export function timeSpan(s: string | null | undefined, ref: string | null = null, now = new Date()): { from: number; to: number } | null {
  const t = s?.trim(); if (!t) return null;
  const r = ref ? FULL.exec(ref.trim()) : null;
  const year = (y: string | undefined) => Number(y ?? r?.[1] ?? now.getUTCFullYear());
  let m = FULL.exec(t);
  if (m) {
    const [, y, mo, d, hh, mm, ss, z] = m, Y = year(y), M = Number(mo), D = Number(d);
    if (M < 1 || M > 12 || D < 1 || D > 31) return null;
    if (hh === undefined) { const from = Date.UTC(Y, M - 1, D); return { from, to: from + 86400000 }; }
    const from = Date.UTC(Y, M - 1, D, Number(hh), Number(mm), Number(ss ?? 0)) - offsetMs(z);
    return { from, to: from + (ss !== undefined ? 1000 : 60000) };
  }
  m = CLOCK.exec(t);
  if (m && r) {
    const [, hh, mm, ss, z] = m, from = Date.UTC(year(r[1]), Number(r[2]) - 1, Number(r[3]), Number(hh), Number(mm), Number(ss ?? 0)) - offsetMs(z);
    return { from, to: from + (ss !== undefined ? 1000 : 60000) };
  }
  return null;
}
/** Where a claim's time stands against the filter's time: 'after' when the whole of it is later, 'before' when it is at or
 * before, 'unknown' when it gives no time (작성 시각 미상) or overlaps the filter's time (a date alone on that day). */
export type SinceMatch = 'after' | 'before' | 'unknown';
export function sinceMatch(when: string | null | undefined, since: { from: number; to: number }, ref: string | null = null): SinceMatch {
  const s = timeSpan(when, ref); if (!s) return 'unknown';
  if (s.from >= since.to) return 'after';
  if (s.to <= since.to) return 'before';
  return 'unknown';
}
/** The claims of one list that are after the filter's time, and how many give no time to read. */
export function sinceCount(claims: readonly Pick<SignClaim, 'about' | 'when'>[], since: { from: number; to: number }, ref: string | null = null): { after: number; unknown: number } {
  let after = 0, unknown = 0;
  for (const c of claims) { const m = sinceMatch(claimWhen(c), since, ref); if (m === 'after') after++; else if (m === 'unknown') unknown++; }
  return { after, unknown };
}
/** The filter's summary in the title: '조건에 맞는 기록 N' or '조건에 맞는 기록 없음' (never "변경 없음"), and the claims
 * whose time could not be read apart ('작성 시각 미상 K'). */
export function sinceSummary(after: number, unknown: number): string {
  return [after ? `조건에 맞는 기록 ${after}` : '조건에 맞는 기록 없음', unknown ? `작성 시각 미상 ${unknown}` : null].filter(Boolean).join(' · ');
}

/** The filter's state outlives a reload: one record per opened map, by the same key as its folds, cameras and open state, kept
 * apart from the project data. at: the time as the person typed it, or null for the reading's basis time. The newest SINCE_MAPS
 * are kept; an unreadable value reads as off; a refused write is only a lost convenience. */
export interface SinceState { on: boolean; at: string | null }
export const SINCE_KEY = 'agentflow.studio.since.1';
const SINCE_MAPS = 60;
interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }
export const SINCE_OFF: SinceState = { on: false, at: null };
export function cleanSince(v: unknown): SinceState {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return SINCE_OFF;
  const { on, at } = v as Record<string, unknown>;
  return { on: on === true, at: typeof at === 'string' && at.trim() && at.length <= 40 ? at.trim() : null };
}
function sinceAll(storage: StorageLike): Record<string, unknown> {
  try { const v = JSON.parse(storage.getItem(SINCE_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}; } catch { return {}; }
}
export function readSince(storage: StorageLike, mapKey: string): SinceState {
  try { const all = sinceAll(storage); return Object.hasOwn(all, mapKey) ? cleanSince(all[mapKey]) : SINCE_OFF; } catch { return SINCE_OFF; }
}
/** Writes one map's filter (off with no time of its own: the record goes); this map becomes the newest. */
export function writeSince(storage: StorageLike, mapKey: string, state: SinceState): boolean {
  try {
    const all = sinceAll(storage); delete all[mapKey];
    const clean = cleanSince(state); if (clean.on || clean.at) all[mapKey] = clean;
    const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - SINCE_MAPS))) delete all[k];
    storage.setItem(SINCE_KEY, JSON.stringify(all)); return true;
  } catch { return false; }
}

/* ---------- failure and recovery blanks (spec 7) ---------- */
/** Words that say what happens on a failure, and how the part comes back. */
export const FAILURE = /실패|재시도/;
export const RECOVERY = /복구|재개/;
export const FAILURE_BLANK = '실패 대응 미제공', RECOVERY_BLANK = '복구 설명 미제공';
/** Where the blanks go, and which: only at an actor's effect exit ('exit', its 내는 것) and a store's write ports ('write', its
 * 받는 것) — never on another part. texts: what the records say of the part (its claims' words, its steps, its loop's stop and
 * resume). A blank is shown when none of them speaks of it; it says "not provided", never "none". */
export function failureBlanks(type: PartType | null | undefined, texts: readonly (string | null | undefined)[]): { at: 'exit' | 'write'; failure: boolean; recovery: boolean } | null {
  const at = type === 'actor' ? 'exit' : type === 'store' ? 'write' : null; if (!at) return null;
  const said = texts.filter((t): t is string => !!t);
  const failure = !said.some(t => FAILURE.test(t)), recovery = !said.some(t => RECOVERY.test(t));
  return failure || recovery ? { at, failure, recovery } : null;
}
