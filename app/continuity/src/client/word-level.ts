/* v13 (spec item 4: words for everyone): the map's word level, 「쉽게 · 자세히」 (default 쉽게, remembered on this browser).
 * - 자세히: the v12 map exactly.
 * - 쉽게: a card says its name and what it does (its role, whole or a phrase of its own words), a person and an outside system marked as
 *   such; a line says plain words only; code expressions, record row IDs, technical kind words, port marks and counts move behind the cues
 *   that are already there (the ◇ of a condition, the ··· of a relation, the card's own hover and pane), which keep every word.
 * Nothing is removed or reworded from the record: a label is shown as written, or without a parenthetical that holds only code, or not at
 * all (its cue stays). Only the app's own words (lens and legend names) have plainer forms. Pure: no DOM. */
import type { StorageLike } from '../shared/storage.js';

export type WordLevel = 'easy' | 'detail';
export const WORDS_KEY = 'agentflow.studio.words.1';
export const WORDS_DEFAULT: WordLevel = 'easy';
export const WORDS_WORD: Readonly<Record<WordLevel, string>> = { easy: '쉽게', detail: '자세히' };
/** The switch's tips (what each level shows and where the rest is). */
export const WORDS_TIP: Readonly<Record<WordLevel, string>> = {
  easy: '쉽게 · 카드는 이름과 하는 일, 선은 쉬운 말만 보여요. 코드 식, 기록 행 번호, 기술 종류, 포트 표시, 개수는 ◇ · ··· 표시와 카드 안내, 읽기면에 그대로 있어요.',
  detail: '자세히 · 기록의 기술 낱말과 개수까지 지도에 모두 보여요.',
};
/** The level kept on this browser (the default when none was kept, or the browser refuses). */
export function readWords(kv: StorageLike | null | undefined): WordLevel {
  try { const v = kv?.getItem(WORDS_KEY); return v === 'easy' || v === 'detail' ? v : WORDS_DEFAULT; } catch { return WORDS_DEFAULT; }
}
/** Keeps the level; false when the browser refused (the switch still works for this visit). */
export function writeWords(kv: StorageLike | null | undefined, level: WordLevel): boolean {
  try { if (!kv) return false; kv.setItem(WORDS_KEY, level); return true; } catch { return false; }
}

/* ---------- what reads as code ---------- */
const HANGUL = /[가-힣]/;
/** A record row ID (「LN13」, 「F07」, 「C-STATUS」, 「A_ba0d62b0」, 「AF5-3c9a044b」). */
export const ROW_ID = /\b(?:[A-Z]{1,3}-?\d{2,}[a-z]?|[A-Z]{1,3}_[0-9a-f]{6,}|[A-Z]{1,3}\d*-[0-9a-f]{6,}|[A-Z]-[A-Z]{3,})\b/;
/** An operator a code expression is written with (「!=」, 「==」, 「&&」, 「=>」, 「<=」). */
const OPERATOR = /[!=<>]=|&&|\|\||=>|->|::/;
/** One run of Latin letters, digits and signs that reads as code: a call, a path, a quote, a brace, a sigil, a dotted, snake or camel name,
 * letters and digits run together (「oauth2」), an option (「--fix」), a constant in capitals (five letters or more: 「SIGTERM」), a joined
 * word (「auth-with-oauth2」). A plain word (「start」, 「Bootstrap」, 「PR」, 「HTTP」) is not. */
export function codeToken(t: string): boolean {
  return /[(){}[\]`'"$@#\\/=<>!&|;*]/.test(t) || /_/.test(t) || /\.[A-Za-z0-9]/.test(t) || /^[a-z]+[A-Z]/.test(t) || /[A-Za-z]\d|\d[A-Za-z]/.test(t)
    || /^-{1,2}[A-Za-z]/.test(t) || /^[A-Z]{5,}$/.test(t) || /[A-Za-z]-[A-Za-z]/.test(t)
    // v13 merge (umami's 흐름 showed 「build·build:docker 때」 at 쉽게): a script or a key named with a colon inside it (「build:docker」).
    || /[A-Za-z]:[A-Za-z0-9]|[0-9]:[A-Za-z]/.test(t);
}
/** Whether a text holds code (an operator, a code run) or a record row ID. */
export function hasCode(text: string): boolean {
  if (OPERATOR.test(text) || ROW_ID.test(text)) return true;
  return (text.match(/[A-Za-z0-9_.$@#\-/\\(){}[\]=<>!&|'"`:;*]+/g) ?? []).some(codeToken);
}
/** A line's label at 쉽게: as written when it holds plain words only; without a parenthetical that holds only code or an ID (「기본
 * 꺼짐(cloud.report)」 → 「기본 꺼짐」); null when no plain words are left (「load_meta」, 「npm run build」, 「Backups.Cron != ""」,
 * 「REDIS_URL 있을 때」): the line keeps its cue (◇ or ···), its words in its hover. */
export function plainLabel(text: string): string | null {
  const t = text.replace(/\s+/g, ' ').trim(); if (!t || !HANGUL.test(t)) return null;
  // Never a call's brackets (「run()」 is code, not a parenthetical): only one that follows a word's end or a space.
  const s = t.replace(/(^|[^A-Za-z0-9_$.])\s*[(（]([^()（）]+)[)）]/g, (m, pre: string, inner: string) => (HANGUL.test(inner) && !hasCode(inner) ? m : pre)).trim();
  // A parenthetical in plain words reads as words (its brackets are no code).
  const bare = s.replace(/[(（]([^()（）]*)[)）]/g, (m, inner: string) => (HANGUL.test(inner) ? ` ${inner} ` : m));
  if (!s || !HANGUL.test(s) || hasCode(bare)) return null;
  // Latin words with no Korean between them read as a command line (「npm run build 실행」): behind the cue too.
  if (/[A-Za-z]+(?:\s+[A-Za-z]+){2,}/.test(s)) return null;
  return s;
}

/* ---------- the app's own words at 쉽게 ---------- */
/** The lens buttons' names at 쉽게 (their tips keep the full names): a pair joined by 「·」 reads as two words of a list there. */
/** v13 fix 1 (review of v13: 「구성」 named both the whole map's 보기 and this lens, and both read pressed at once): the lens that colours the
 * cards by what part each plays is 「역할」 at 쉽게 (its tip keeps 「구성과 역할」). */
export const EASY_LENS: Readonly<Record<string, string>> = { compose: '역할', data: '데이터', start: '시작과 반복', state: '상태와 모름', scenario: '시나리오' };
/** The legend's family names at 쉽게. */
export const EASY_FAMILY: Readonly<Record<string, string>> = { '촉발·관문': '시작 신호와 관문', '상태·공백': '상태와 모름', '시작·반복': '시작과 반복' };
/** v13 merge (spec 3 × 4: 쉽게 in every 보기): the band words of 층 at 쉽게, each unit of a band's words (「저장 · 관문」) in the legend's
 * plain words (「촉발」 → 「시작 신호」, as 「촉발·관문」 reads 「시작 신호와 관문」 there); the record's family words stay in the band's tip. */
export const EASY_BAND: Readonly<Record<string, string>> = { '촉발': '시작 신호' };
export function easyBand(text: string): string { return text.split(' · ').map(u => EASY_BAND[u] ?? u).join(' · '); }
/** The legend chip at 쉽게: the lens and what it shows, the counts behind the chip (it opens the legend with them): 「구성 · 참여자 · 처리 ···」. */
export function easyLegendChip(lens: string, labels: readonly string[], max = 2): string {
  const shown = labels.slice(0, max).map(l => EASY_FAMILY[l] ?? l), more = labels.length > shown.length;
  return [EASY_LENS[lens] ?? lens, ...shown].join(' · ') + (more ? ' ···' : '');
}
/** A card's kind words at 쉽게 with its counts left to the card (「구성 · 안쪽 6」 → 「구성」; 「사람 · 실행 위치 · 안쪽 2」 → 「사람 · 실행 위치」). */
export function easyKind(kind: string): string {
  return kind.split(' · ').filter(u => !/\d/.test(u)).join(' · ');
}
/** The mark of a person or an outside system on a card at 쉽게 (null for any other part). */
export function partMark(type: string | null | undefined): string | null {
  return type === 'person' ? '사람' : type === 'external' ? '외부 시스템' : null;
}
/** A phrase that opens on a word leaning on the words left out (a modifier or a case ending: 「따른 이벤트 처리 체인을 실행한다」, 「위한
 * …」): no phrase for a name tag at 쉽게 (the card's kind word stands there instead, the whole role in its hover). */
export function leansBack(phrase: string): boolean {
  return /^[가-힣]*(?:는|른|던|운|은|한|된|난|할|을|를|의|와|과|에|로)(?=\s|$)/.test(phrase.trim());
}
