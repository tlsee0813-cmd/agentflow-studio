/* Cards v2 (spec cards v2 §1, §2, §5, §7): what a typed card's face says at rest and what moved off it. Pure: no DOM.
 * - The status dot: only for a recorded operations state (a C-STATUS 운영 상태 row or the reading's state), shape and colour together,
 *   never from file evidence alone, never 멈춤 from age, a conflict between records its own mark (never one of them picked).
 * - The role line: the first sentence of what the part does (the full text in the hover card and the pane).
 * - 「외 N」: a count always says what it counts (its noun in the tip, and in the text where there is room).
 * - The display settings: a global default and an explicit per-project override, read and written with fallback; lenses are
 *   temporary and never write them. */
import type { StorageLike } from '../shared/storage.js';
import { clipKeepPlan, planCutNeeded, textWidth, KEEP_WORD } from '../shared/studio.js';

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
/** A description's first sentence, whole (ruling F8 Q5: the card's role, drawn by roleFit), or null for none. */
export function firstSentence(text: string | null | undefined): string | null {
  const t = (text ?? '').replace(/\s+/g, ' ').trim(); if (!t) return null;
  const m = /^(.+?[.!?。])(?=\s|$)/.exec(t); return m ? m[1]! : t;
}
export function roleLine(text: string | null | undefined): string | null {
  const t = (text ?? '').replace(/\s+/g, ' ').trim(); if (!t) return null;
  const m = /^(.+?[.!?。])(?=\s|$)/.exec(t), first = m ? m[1]! : t;
  return planCutNeeded(first, ROLE_LINE_WIDTH, textWidth, KEEP_WORD) ? clipKeepPlan(first, ROLE_LINE_WIDTH, textWidth, false, KEEP_WORD) : first;
}

/* ---------- the role on the card (ruling F8 Q5) ----------
 * The card's 「하는 일」 at 13px on 18px lines in the card's 192px body, one line or two (the card's height says which, decided before the
 * map is laid out: 80 with one line, 104 with two); lines break between words only (never inside a noun or an identifier). Words two lines
 * do not hold: a short role phrase of the same words that reads on its own (a closing clause, or one of the phrases a 「·」 lists), never
 * one whose dropped words held a plan, a negation or a condition; else the way to the whole: 「역할 전문 보기」. Never an ending changed,
 * never words added. The same rule serves the name tag's second line at the overview (its own type and the rows its box gives). */
export const ROLE_PX = 13, ROLE_LH = 18, ROLE_BODY = 192, ROLE_LINES = 2, ROLE_MORE = '역할 전문 보기';
export interface RoleFit { text: string; lines: number; kind: 'whole' | 'phrase' | 'fold' }
/** A text's lines at width w, broken between words only (greedy); null when one word alone is wider than a line. */
export function wrapWords(text: string, w: number, measure: (s: string) => number): string[] | null {
  const words = text.trim().split(/\s+/).filter(Boolean), out: string[] = [];
  for (const word of words) {
    if (measure(word) > w + 0.5) return null;
    const last = out.at(-1), joined = last === undefined ? word : `${last} ${word}`;
    if (last !== undefined && measure(joined) <= w + 0.5) out[out.length - 1] = joined; else out.push(word);
  }
  return out;
}
/** Words a shorter phrase may never drop: a plan or a stopped use (KEEP_WORD), a negation, a condition (「…하면」, 「…때」, 「실패 시」; never
 * the noun 「화면」) or a guess. */
const IF_SRC = String.raw`(?:(?:으|하|이|되|있)면|(?<![화장측표전정평단방국내외후대])면)(?=[\s,]|$)`;
const COND_SRC = String.raw`${IF_SRC}|때|경우|조건|(?:^|\s)시(?=\s|$)`;
const IF = new RegExp(IF_SRC);
const ROLE_KEEPS = new RegExp(`${KEEP_WORD.source}|않|없|못|아니|${COND_SRC}|만\\s|추정(?!값|치)|모름|불명확|미상`);
/** v12: where a sentence's closing run may begin: right after a clause's link (「…하고」, 「…하며」, 「…생성해」, 「…를 받아」) or an
 * adverbial word (「…에서」, 「…에」, 「…으로」, 「…를 통해」), or the 「등」 that closes a list of examples; never after a noun that only
 * ends like one (「경고」, 「창고」, 「경로」, 「주로」). */
const LINK = /(?:고|며|면서|하여|해서|아서|어서|[가-힣]{2,}해|받아|거쳐|불러|모아|읽어|넘겨|맞춰|묶어|골라|담아|나눠|다뤄|만들어)$/;
const NOT_LINK = /(?:경고|참고|창고|광고|최고|재고|사고|원고|잔고|공고|보고|이해|방해|피해|손해|침해)$/;
const ADVERB = /(?:에서|에게|에|으로|로|통해|따라|위해|대해|의해|인해|향해|등)$/;
const NOT_ADVERB = /(?:경로|회로|통로|도로|미로|새로|주로|서로|따로|별로|스스로|대로)$/;
/** A first word that leans on the words a phrase would drop: an active verb's modifier form (「실행하는」, 「받는」, 「만든」), whose object
 * the dropped words held (never a noun that only ends like one: 「권한」, 「로그인」), or a joining word. */
const LEANS = /(?:[하있없받내주쓰읽보만들]는|[하했]던|[가-힣]한|[가-힣]할|든)$|^(?:또는|및|이나|혹은|그리고|거나)$/;
const NOT_LEANS = /(?:권한|제한|기한|무한|유한|간한)$/;
/** An action noun closing a role word (「목록 생성」, 「요청 분배」, 「파일 쓰기」): what makes a closing run a role phrase. */
const ACTION = /(?:생성|분배|실행|정리|처리|관리|갱신|검사|해석|결정|직렬화|전달|저장|수신|송신|배정|접수|감시|기록|조정|출력|변환|검증|병합|호출|등록|배포|빌드|계산|추출|수집|선택|표시|보관|제공|발행|구독|분석|게시|교체|감지|적재|예약|열람|조회|편집|작성|제출|승인|배달|복구|백업|정렬|측정|보고|판정|차단|인증|기|하기)$/;
/** A word that only relates the words before it (「인스턴스 사이」, 「유형별」, 「작업 중」): a phrase never starts on it (in a sentence, the
 * word standing alone: 「학습·검증용 파일」 relates to the words after it). */
const RELATES = /(?:사이|간|별|중|용|적|위|아래|안|밖|전|후|및|등)$/;
const RELATES_ALONE = /^(?:사이|간|별|중|용|위|아래|안|밖|전|후|및|등|따라|통해|위해|대해|의해|인해|향해|거쳐)$/;
/** A sentence's predicate with its own target: a copula (「…대상이다」, 「…배포처다」: an open syllable before 다). */
const copula = (w: string) => { const m = /([가-힣])다[.。]?$/.exec(w); return !!m && (/이다[.。]?$/.test(w) || (m[1]!.charCodeAt(0) - 0xac00) % 28 === 0 && !/[하되]다[.。]?$/.test(w)); };
/** The shorter phrases of a role, longest first. For a sentence (v12): each closing run that ends as the sentence does and begins right
 * after a clause's link or an adverbial word (LINK, ADVERB: 「…를 받아 | 실행과 결과를 제공한다.」, 「…화면에서 | 사용자 조작을 받아 …」),
 * two words or more, holding its object (a word with 을·를) or ending on a copula (「…대상이다」): the target and the action, the same words
 * in the same order (never an ending changed, never a word added). For a role word, each closing run of two words or more that ends on an
 * action noun (「벤치마크 명령 목록 생성」 → 「명령 목록 생성」, 「HTTP·WS 요청 분배」 → 「요청 분배」). Never one that breaks a list (no 「·」
 * in a role word's run, no comma in a sentence's, nothing dropped right after 「와 · 과 · 및 · 또는 · 이나」, never one side of 「…거나」),
 * starts on a word that only relates or leans on the dropped words (「사이 변경 신호」, 「실행하는 …」, 「바꾸고 …」), or whose dropped words
 * hold a plan, a negation, a condition or a guess (ROLE_KEEPS). */
export function rolePhrases(text: string): string[] {
  const t = text.trim(), out: string[] = [];
  const sentence = /[.。]$|(?:다|요|함|됨|음|임)$/.test(t);
  // A role phrase says what the part does: never one that opens on a clause that only denies or doubts (「흐름을 멈추지 않는다」, 「대상
  // 범위는 불명확하다」; a later clause of the run keeps its words whole) or opens on a 「…하면」 (its other half may be dropped), never one
  // that adds to dropped words (「구 보고서 경로도 처리한다」, 「노트북도 …」).
  const aside = (s: string) => /않|없|못|아니|불명확|모르|모름|추정(?!값|치)|미상/.test(s);
  const adds = (s: string) => /\S도(?:\s|$)/.test(s);
  const words = t.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const last = words[i - 1]!.replace(/[,，]$/, ''), head = words.slice(0, i).join(' '), run = words.slice(i), rest = run.join(' ');
    if (ROLE_KEEPS.test(head) || /(?:와|과|및|[·]|또는|이나|거나|든지)$/.test(last)) continue;
    if (sentence) {
      const linkAt = run.findIndex(w => LINK.test(w) && !NOT_LINK.test(w)), first = run.slice(0, linkAt < 0 ? run.length : linkAt + 1).join(' ');
      const cut = (LINK.test(last) && !NOT_LINK.test(last)) || (ADVERB.test(last) && !NOT_ADVERB.test(last));
      const target = run.slice(0, -1).some(w => /\S(?:을|를)$/.test(w)) || copula(run.at(-1)!);
      if (!cut || run.length < 2 || aside(first) || IF.test(first) || adds(rest) || RELATES_ALONE.test(run[0]!) || (LEANS.test(run[0]!) && !NOT_LEANS.test(run[0]!)) || linkAt === 0 || /[,，]/.test(rest) || !target) continue;
    } else if (run.length < 2 || aside(rest) || adds(rest) || RELATES.test(run[0]!) || rest.includes('·') || !ACTION.test(run.at(-1)!) || /[,，]$/.test(words[i - 1]!)) continue;
    out.push(rest);
  }
  return [...new Set(out)].filter(x => x !== t).sort((a, b) => b.length - a.length);
}
/** Ruling F8 Q5: the role as the card shows it in at most `lines` lines of width w (measure: the type it is drawn in). */
export function roleFit(text: string, w: number, lines: number, measure: (s: string) => number): RoleFit {
  const t = text.replace(/\s+/g, ' ').trim(), n = (s: string) => { const l = wrapWords(s, w, measure); return l && l.length <= lines ? l.length : 0; };
  const whole = n(t); if (whole) return { text: t, lines: whole, kind: 'whole' };
  for (const p of rolePhrases(t)) { const k = n(p); if (k) return { text: p, lines: k, kind: 'phrase' }; }
  return { text: ROLE_MORE, lines: 1, kind: 'fold' };
}

/** v12 (whole units): a kind line's words as a line too narrow for them shows them: the whole, else a phrase of the role word that reads on
 * its own (rolePhrases), else the leading whole units of a kind said in parts (「사람 · 실행 위치 · 안쪽 2」 → 「사람 · 실행 위치」,
 * 「사람」), else the record's family word (「처리」), else nothing (the card opens the whole). Never 「역할 전문 보기」 in place of words, never
 * a word or a unit cut. fits: whether a candidate stands whole in the line. */
export type KindShort = { text: string; how: 'whole' | 'phrase' | 'kind' | 'none' };
export function kindShort(kind: string, familyWord: string | null | undefined, fits: (s: string) => boolean): KindShort {
  const t = kind.trim(); if (!t || fits(t)) return { text: t, how: 'whole' };
  for (const p of rolePhrases(t)) if (fits(p)) return { text: p, how: 'phrase' };
  const units = t.split(' · '), lead: string[] = [];
  for (let i = units.length - 1; i >= 1; i--) lead.push(units.slice(0, i).join(' · '));
  for (const p of [...lead, familyWord ?? ''].filter(x => x && x !== t)) if (fits(p)) return { text: p, how: 'kind' };
  return { text: '', how: 'none' };
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
