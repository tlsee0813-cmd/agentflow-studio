/* Signs on the map (map spec 5, cycle 4), the client's pure part: which of a part's current claims are rules, gates and
 * withdrawals (a card's tabs '규칙 N' · '관문 M' · '변경 K'), what a rule row and a change row read as in the pane, the since-time
 * filter (spec 5.3/6: '기준 시각 이후 작성된 기록', a condition on time, never a comparison of two snapshots), and the failure and
 * recovery blanks of the detail view (spec 7). Nothing here changes a claim; nothing is invented: a field the record does not
 * carry reads as its explicit blank.
 *
 * The contract first (map-reading.10): a gate is a plan claim whose gate is said (실행 관문 run / 개발 관문 dev), a change's nature
 * its withdrawalKind, a rule's reach its scope and scopeName, its places its anchors and what keeps it its enforcedBy. Only a claim
 * an earlier reading wrote (none of those keys) is read by the provisional heuristics, and says so (추정): a gate by its words (a
 * plan with '관문' or a condition '…되면/…이면'), a change's nature by its evidence tag ([파일] design, [실행] implementation,
 * [보고] report); a .10 claim whose withdrawalKind is null falls back to the tag the same way. The since filter reads the claim's
 * own time (when) for the time it was written. Where a rule's sign goes (rulePlacement) is matched by name only: a step, a port or
 * a field of the part whose name equals the scope's name or an anchor's text (of the scope's own kind for a step, port or field
 * rule; spacing, case and quote marks aside, a kind word like '단계' before or after it aside); an anchor naming none of
 * them reads '자리 없음' and is never placed by guess. Pure: no
 * DOM, so each rule is tested on its own. */
import { claimTopic, claimEvidence, claimWhen, EVIDENCE_LABEL } from '../shared/claim-topic.js';
import { isProgram, PROGRAM_LABEL } from './line-view.js';
import type { ClaimKind, ClaimTopic, EvidenceGrade, PartType, RuleScope, ReadingAnchor, ReadingEnforcer, ReadingQuote, WithdrawalKind, GateKind, AnchorKind, EnforcerKind } from '../shared/types.js';

/** What a sign reads from a claim (a CurrentClaim carries all of it). */
export interface SignClaim {
  kind: ClaimKind; text: string; quote: string; about: string | null;
  topic?: ClaimTopic | null; evidence?: EvidenceGrade | null; when?: string | null; where?: string | null; before?: string | null;
  /** map-reading.10 (absent on a claim an earlier reading wrote). */
  scope?: RuleScope | null; scopeName?: string | null; anchors?: ReadingAnchor[]; enforcedBy?: ReadingEnforcer[]; withdrawalKind?: WithdrawalKind | null; gate?: GateKind | null;
}
/** A claim a map-reading.10 reading wrote: it carries the contract's keys (each claim of such a reading carries all of them). */
export const fromContract = (c: Pick<SignClaim, 'gate' | 'anchors' | 'scope' | 'withdrawalKind'>): boolean =>
  c.gate !== undefined || c.anchors !== undefined || c.scope !== undefined || c.withdrawalKind !== undefined;
export type SignKind = 'rule' | 'gate' | 'change';
export const SIGN_LABEL: Record<SignKind, string> = { rule: '규칙', gate: '관문', change: '변경' };

/* ---------- which claims are signs ---------- */
/** A gate's own word ('다음 관문', '운영 관문'). */
export const GATE_WORD = /관문/;
/** A condition phrase: '…되면' or '…이면' ending a word ('검증되면', 'CALM이면'); not '이면서', '되면서'. */
export const CONDITION = /(?:되|이)면(?![가-힣])/;
type GateClaim = Pick<SignClaim, 'kind' | 'text' | 'topic'> & Partial<Pick<SignClaim, 'gate' | 'anchors' | 'scope' | 'withdrawalKind'>>;
/** A gate: a plan claim whose gate the contract says (run or dev); for a claim an earlier reading wrote only, a plan that names a
 * gate or states a condition (추정). A .10 plan claim with gate null is not a gate, whatever its words. */
export function isGate(c: GateClaim): boolean {
  if (claimTopic(c) !== 'plan') return false;
  if (fromContract(c)) return !!c.gate;
  return GATE_WORD.test(c.text) || CONDITION.test(c.text);
}
/** A gate's kind as the contract says it, or null with guessed true when the gate was told by its words (an earlier reading). */
export function gateKind(c: GateClaim): { kind: GateKind | null; guessed: boolean } {
  return c.gate ? { kind: c.gate, guessed: false } : { kind: null, guessed: true };
}
export const GATE_LABEL: Record<GateKind, string> = { run: '실행 관문', dev: '개발 관문' };
export const GATE_HINT: Record<GateKind, string> = { run: '실행 관문 · 경로 위의 판정: 통과·거절·대기·중단의 출구가 있는 운영 조건', dev: '개발 관문 · 운영 전 확인이나 다음 개발 조건: 실행 경로 밖' };
/** The gates split by kind: 실행 (run), 개발 (dev) and those told by their words only (추정, kind unknown). */
export function gateSplit<T extends GateClaim>(gates: readonly T[]): { run: T[]; dev: T[]; guessed: T[] } {
  const out = { run: [] as T[], dev: [] as T[], guessed: [] as T[] };
  for (const g of gates) { const k = gateKind(g); (k.kind === 'run' ? out.run : k.kind === 'dev' ? out.dev : out.guessed).push(g); }
  return out;
}
/** The gate section's split line: '실행 M₁ · 개발 M₂', and '종류 미상 K (추정)' for gates told by their words. */
export function gateSplitLine(s: { run: unknown[]; dev: unknown[]; guessed: unknown[] }): string {
  return [`실행 ${s.run.length}`, `개발 ${s.dev.length}`, s.guessed.length ? `종류 미상 ${s.guessed.length} (추정)` : null].filter(Boolean).join(' · ');
}
/** The sign a claim is, or null: a rule (topic rule), a gate (isGate), a change (topic withdrawn: before → now). */
export function signKind(c: GateClaim): SignKind | null {
  const t = claimTopic(c);
  if (t === 'rule') return 'rule';
  if (t === 'withdrawn') return 'change';
  return isGate(c) ? 'gate' : null;
}
export interface PartSigns<T> { rules: T[]; gates: T[]; changes: T[] }
/** A part's signs, each list in the claims' own order. */
export function partSigns<T extends GateClaim>(claims: readonly T[]): PartSigns<T> {
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

/* ---------- a rule row (spec 5.1: 범위 · 적용 위치 · 보장, shown together) ---------- */
/** The fields a rule leaves unsaid: shown as blanks, never made up. */
export const RULE_BLANKS = { anchors: '적용 위치 미해결', design: '설계 대응 미상', check: '확인 검사 미상', enforce: '보장 위치 미확인', scope: '범위 미정', nowhere: '자리 없음' } as const;
export const RULE_BLANK_HINT = {
  anchors: '기록이 이 규칙이 작용하는 정확한 단계·필드·포트를 지정하지 않았다',
  design: '이 규칙을 지키는 설계 장치(코드·조건 행)를 기록이 연결하지 않았다',
  check: '이 규칙을 확인하는 검사(관문)와 그 결과를 기록이 연결하지 않았다',
  enforce: '이 규칙을 무엇이 지키는지 읽기가 아무것도 말하지 않았다 (비어 있음: 장치 미상·기록상 미설계와 다름)',
  scope: '기록이 이 규칙이 어디까지 미치는지(부분·단계·포트·필드·프로젝트) 말하지 않았다',
  nowhere: '이 이름의 단계·포트·필드가 이 부분에 없다 · 추측으로 다른 자리에 놓지 않음',
  legacy: '이전 판(map-reading.10 전) 읽기: 계약이 범위·적용 위치·보장을 싣지 않아 이 부분 전체 범위로만 읽음'
} as const;
export const GATE_BLANK = '관문 종류 미상';
export const GATE_BLANK_HINT = '실행 관문(경로 위 판정)인지 개발·검증 관문(운영 전 조건)인지 기록이 구별하지 않았다 · 추정: 이전 판 읽기라 계획 문장의 ‘관문’·조건(…되면/…이면)으로 고름';

/* ---------- where a rule's sign goes (spec 5.1: 적용 위치, matched by name only) ---------- */
/** A place of a part a sign can stand on: a step box, an input or output port, a ledger cell (a field). */
export type PlaceKind = 'step' | 'in' | 'out' | 'field';
export interface PlaceRef { kind: PlaceKind; name: string }
export const PLACE_LABEL: Record<PlaceKind, string> = { step: '단계', in: '받는 포트', out: '내는 포트', field: '필드' };
/** The places of a part, as its reading names them (steps by name, ports by name, fields). */
export interface PartPlaces { steps: readonly string[]; inputs: readonly string[]; outputs: readonly string[]; fields: readonly string[] }
export const placeId = (p: PlaceRef) => `${p.kind}|${p.name}`;
/** A name as compared: quote marks, spacing and case aside, and one kind word ('단계', '포트', '필드', 'step', 'port', 'field')
 * before or after it aside. Nothing else is taken away: '판단' and '판단 결과' are two names. */
export function placeName(s: string | null | undefined): string {
  const t = (s ?? '').normalize('NFC').replace(/[‘’'"“”`「」『』]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const bare = t.replace(/^(?:단계|포트|필드|step|port|field)\s*[:·]?\s+/, '').replace(/\s+(?:단계|포트|필드|step|port|field)$/, '').trim();
  return bare || t;
}
/** The places whose name equals the text (placeName), of the kinds given (all by default), in the part's own order. */
export function matchPlaces(text: string | null | undefined, places: PartPlaces, kinds: readonly PlaceKind[] = ['step', 'in', 'out', 'field']): PlaceRef[] {
  const key = placeName(text); if (!key) return [];
  const lists: Record<PlaceKind, readonly string[]> = { step: places.steps, in: places.inputs, out: places.outputs, field: places.fields };
  return kinds.flatMap(kind => [...new Set(lists[kind])].filter(n => placeName(n) === key).map(name => ({ kind, name })));
}
const SCOPE_KINDS: Record<'step' | 'port' | 'field', PlaceKind[]> = { step: ['step'], port: ['in', 'out'], field: ['field'] };
export type RuleClaim = Pick<SignClaim, 'scope' | 'scopeName' | 'anchors' | 'enforcedBy'>;
/** Where a rule's sign goes. places: the precise places, each once (the scope's name among the places of its kind, then each
 * anchor's text among the places of that same kind: a port rule's anchor never lands on a step of the same name; for a part,
 * project or unsaid scope among all places). anchors: the places each anchor names ([]: 자리 없음). scopeFound: whether a step, port or
 * field scope's name is one of the part's (null for another scope). head: the whole-scope sign: the boundary head for a part
 * rule (and for a rule an earlier reading wrote, read part-wide as before), the view head for a project rule, 'unplaced' for a
 * rule drawn nowhere else (no scope said, or a named scope found nowhere). unplaced: drawn at no precise place and not a project
 * rule (the card's '배치 미정'). legacy: written before the contract (no scope, places or devices said). */
export interface RulePlacement { legacy: boolean; places: PlaceRef[]; anchors: { anchor: ReadingAnchor; places: PlaceRef[] }[]; scopeFound: boolean | null; head: 'boundary' | 'project' | 'unplaced' | null; unplaced: boolean }
export function rulePlacement(c: RuleClaim, places: PartPlaces): RulePlacement {
  const legacy = c.scope === undefined && c.anchors === undefined && c.enforcedBy === undefined;
  const scope = c.scope ?? null, out: PlaceRef[] = [], add = (ps: PlaceRef[]) => { for (const p of ps) if (!out.some(q => q.kind === p.kind && q.name === p.name)) out.push(p); };
  let scopeFound: boolean | null = null;
  if (scope === 'step' || scope === 'port' || scope === 'field') { const found = matchPlaces(c.scopeName, places, SCOPE_KINDS[scope]); scopeFound = found.length > 0; add(found); }
  const kinds = scope === 'step' || scope === 'port' || scope === 'field' ? SCOPE_KINDS[scope] : undefined;
  const anchors = (c.anchors ?? []).map(anchor => { const ps = matchPlaces(anchor.text, places, kinds); add(ps); return { anchor, places: ps }; });
  const head = legacy || scope === 'part' ? 'boundary' : scope === 'project' ? 'project' : out.length ? null : 'unplaced';
  return { legacy, places: out, anchors, scopeFound, head, unplaced: scope !== 'project' && !out.length };
}
/** The rules of a part by where the detail view draws them: at each precise place (by placeId), at the boundary head, at the
 * view head (project), or among the unplaced (배치 미정). A part rule with places is at both. */
export function ruleSigns<T extends RuleClaim>(rules: readonly T[], places: PartPlaces): { at: Map<string, T[]>; boundary: T[]; project: T[]; unplaced: T[] } {
  const at = new Map<string, T[]>(), boundary: T[] = [], project: T[] = [], unplaced: T[] = [];
  for (const r of rules) {
    const p = rulePlacement(r, places);
    for (const q of p.places) { const k = placeId(q), l = at.get(k); if (l) l.push(r); else at.set(k, [r]); }
    if (p.head === 'boundary') boundary.push(r); else if (p.head === 'project') project.push(r); else if (p.head === 'unplaced') unplaced.push(r);
  }
  return { at, boundary, project, unplaced };
}
/** How many of a part's rules stand at no precise place (the card's '배치 미정 K'; a project rule is placed at the head). */
export const unplacedCount = (rules: readonly RuleClaim[], places: PartPlaces) => rules.filter(r => rulePlacement(r, places).unplaced).length;

/* ---------- what a rule row reads ---------- */
export const ANCHOR_LABEL: Record<AnchorKind, string> = { stated: '명시', inferred: '해석' };
export const ANCHOR_HINT: Record<AnchorKind, string> = { stated: '명시 · 기록의 그 줄이 직접 이 자리를 말함', inferred: '해석 · 규칙과 자리를 기록의 다른 줄에서 이어 읽음' };
export const ENFORCER_LABEL: Record<EnforcerKind, string> = { code: '코드', gate: '관문', person: '사람', none: '기록상 미설계', unknown: '장치 미상' };
export const ENFORCER_HINT: Record<EnforcerKind, string> = {
  code: '코드 · 조건 행이 이 규칙을 지킴 (설계 대응)', gate: '관문 · 관문 줄이 이 규칙을 확인함 (확인 검사)', person: '사람 · 사람이 스스로 지키는 규칙',
  none: '기록상 미설계 · 기록이 이 규칙을 위한 장치가 설계되지 않았다고 명시함', unknown: '장치 미상 · 기록이 장치를 이름 대지 않음'
};
export interface RuleView {
  legacy: boolean;
  scope: { text: string; blank: boolean; hint: string };
  /** program (map-reading.11): the program put this place there (a condition row sharing words with the rule); its label is then
   * 「프로그램」, never 명시/해석 (the model did not say it). */
  anchors: { text: string; kind: AnchorKind; label: string; quote: ReadingQuote; places: PlaceRef[]; nowhere: boolean; program: boolean }[];
  /** '적용 위치 미해결' when the rule carries no anchor (or an earlier reading wrote it). */
  anchorsBlank: string | null;
  enforce: { kind: EnforcerKind; text: string; line: string; quote: ReadingQuote | null }[];
  /** '보장 위치 미확인' when the reading said nothing of what keeps it. */
  enforceBlank: string | null;
  /** '설계 대응 미상' unless a code device (or the record's own 기록상 미설계) answers it; '확인 검사 미상' unless a gate does. */
  design: string | null; check: string | null;
}
/** One rule's row: its scope ('범위 · 부분 전체', '범위 · 단계 ‘X’', '범위 · 포트 ‘X’', '범위 · 필드 ‘X’', '범위 · 프로젝트 전체', or
 * '범위 미정'; a named scope found nowhere adds '자리 없음'), its places (each anchor with 명시/해석 and its quote; '자리 없음' for one
 * that names no place of the part) and what keeps it ('코드 · …', '관문 · …', '사람 · …', '기록상 미설계', '장치 미상'). partName:
 * for a rule an earlier reading wrote, which keeps its old part-wide line and its three blanks. */
export function ruleView(c: RuleClaim, places: PartPlaces, partName = '이 부분'): RuleView {
  const p = rulePlacement(c, places);
  if (p.legacy) return { legacy: true, scope: { text: `범위 · ‘${partName}’ 전체 · 세부 접점 미정`, blank: false, hint: RULE_BLANK_HINT.legacy }, anchors: [], anchorsBlank: RULE_BLANKS.anchors,
    enforce: [], enforceBlank: null, design: RULE_BLANKS.design, check: RULE_BLANKS.check };
  const scope = c.scope ?? null, name = c.scopeName?.trim() ?? '';
  const named = scope === 'step' ? '단계' : scope === 'port' ? '포트' : '필드';
  const sc = scope === null ? { text: RULE_BLANKS.scope, blank: true, hint: RULE_BLANK_HINT.scope }
    : scope === 'part' ? { text: '범위 · 부분 전체', blank: false, hint: '이 부분 전체에 미치는 규칙' }
      : scope === 'project' ? { text: '범위 · 프로젝트 전체', blank: false, hint: '프로젝트 전체 원칙 (기록이 그렇게 말함)' }
        : { text: `범위 · ${named} ‘${name}’${p.scopeFound ? '' : ` · ${RULE_BLANKS.nowhere}`}`, blank: !p.scopeFound, hint: p.scopeFound ? `이 부분의 ${named} ‘${name}’에 미치는 규칙` : RULE_BLANK_HINT.nowhere };
  const anchors = p.anchors.map(({ anchor: a, places: ps }) => ({ text: a.text, kind: a.kind, label: isProgram(a) ? PROGRAM_LABEL : ANCHOR_LABEL[a.kind], quote: a.quote, places: ps, nowhere: !ps.length, program: isProgram(a) }));
  const devices = c.enforcedBy ?? [];
  const enforce = devices.map(e => ({ kind: e.kind, text: e.text, line: e.kind === 'none' || e.kind === 'unknown' ? ENFORCER_LABEL[e.kind] : `${ENFORCER_LABEL[e.kind]} · ${e.text}`, quote: e.quote }));
  return { legacy: false, scope: sc, anchors, anchorsBlank: anchors.length ? null : RULE_BLANKS.anchors, enforce, enforceBlank: devices.length ? null : RULE_BLANKS.enforce,
    design: devices.some(e => e.kind === 'code' || e.kind === 'none') ? null : RULE_BLANKS.design, check: devices.some(e => e.kind === 'gate') ? null : RULE_BLANKS.check };
}
/** Who said it and where, as the record wrote it: its time, its place and its evidence tag; blanks say so. */
export function ruleSaid(c: SignClaim): { when: string; where: string; evidence: string | null } {
  const when = claimWhen(c), ev = claimEvidence(c);
  return { when: when ?? '시각 미기재', where: c.where ?? '자리 미기재', evidence: ev ? EVIDENCE_LABEL[ev] : null };
}

/* ---------- a change row (spec 5.3: 같은 자리의 이전 → 지금, the head keeps its nature and version) ---------- */
export type ChangeNature = 'design' | 'implementation' | 'report';
export const NATURE_LABEL: Record<ChangeNature, string> = { design: '설계 변경', implementation: '구현 변화', report: '보고 정정' };
export const NATURE_UNKNOWN = '변경 성격 미상';
export const NATURE_HINT = '추정: 철회 종류를 기록이 말하지 않아 근거 표시로 고른 성격 ([파일] 설계 변경 · [실행] 구현 변화 · [보고] 보고 정정)';
type ChangeClaim = Pick<SignClaim, 'quote' | 'evidence'> & Partial<Pick<SignClaim, 'withdrawalKind'>>;
/** The nature as the contract says it (withdrawalKind); only when it does not (an earlier reading, or null), by the line's
 * evidence tag (추정); null when neither says one. */
export function changeNature(c: ChangeClaim): ChangeNature | null {
  if (c.withdrawalKind) return c.withdrawalKind;
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
/** The nature was told by the evidence tag, not by the contract (shown with the 추정 tip). */
export const changeGuessed = (c: ChangeClaim): boolean => !c.withdrawalKind && changeNature(c) !== null;
export function changeRow(c: SignClaim): { head: string; before: string; now: string; beforeSaid: boolean; guessed: boolean } {
  return { head: changeHead(c), before: c.before?.trim() || BEFORE_BLANK, now: c.text, beforeSaid: !!c.before?.trim(), guessed: changeGuessed(c) };
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

/* ---------- the map title's '전체 규칙 N · 배치 미정 K' (spec 5.1: 지도 안 프로젝트 머리의 전체 규칙 · 고정된 배치 미정 입구) ----------
 * N counts the project rules (scope project) of every part, K the rules of every part that stand at no precise place (unplaced,
 * as each card's own count). The list it opens holds, part by part in the map's order, each part's rules whose sign is a head
 * (project, part-wide, an earlier reading's part-wide reading) or unplaced; a rule placed at a step, port or field is read
 * there. Each row names its kind; nothing is regrouped across parts. */
export type RuleRowKind = 'project' | 'part' | 'unplaced';
export const RULE_ROW_LABEL: Record<RuleRowKind, string> = { project: '프로젝트 전체', part: '부분 전체', unplaced: '배치 미정' };
export interface ProjectRuleGroup<T> { part: string; name: string; rows: { claim: T; kind: RuleRowKind }[] }
export function projectRuleList<T extends RuleClaim>(parts: readonly { id: string; name: string; rules: readonly T[]; places: PartPlaces }[]): { project: number; unplaced: number; groups: ProjectRuleGroup<T>[] } {
  let project = 0, unplaced = 0; const groups: ProjectRuleGroup<T>[] = [];
  for (const p of parts) {
    const rows: { claim: T; kind: RuleRowKind }[] = [];
    for (const c of p.rules) {
      const pl = rulePlacement(c, p.places);
      if (pl.head === 'project') project++;
      if (pl.unplaced) unplaced++;
      const kind: RuleRowKind | null = pl.head === 'project' ? 'project' : pl.head === 'boundary' ? 'part' : pl.unplaced ? 'unplaced' : null;
      if (kind) rows.push({ claim: c, kind });
    }
    if (rows.length) groups.push({ part: p.id, name: p.name, rows });
  }
  return { project, unplaced, groups };
}
/** The title entry's words: '전체 규칙 N · 배치 미정 K' (K only when there is one). */
export const projectRuleEntry = (n: { project: number; unplaced: number }): string => `전체 규칙 ${n.project}${n.unplaced ? ` · 배치 미정 ${n.unplaced}` : ''}`;
