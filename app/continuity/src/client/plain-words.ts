/* v14 (spec item 5: words for everyone): the app's own control words at 쉽게 (the default), each in words a reader who is not a developer
 * understands at a glance; 자세히 keeps the earlier words, and every control's tip says the 자세히 word too, so both name one thing. The
 * functions behind the controls are the same at both levels. Only the app's own words change here: the record's words are never
 * reworded. Pure but for the level it is told (setPlainLevel, from the word switch). */
export type PlainLevel = 'easy' | 'detail';
let level: PlainLevel = 'easy';
/** The word switch's level, told by the app whenever it changes (syncWords). */
export function setPlainLevel(l: PlainLevel): void { level = l; }
export const plainLevel = (): PlainLevel => level;

/** The control words at 쉽게 by their 자세히 words. */
export const EASY_WORD: Readonly<Record<string, string>> = Object.freeze({
  '돌아와 읽기': '그동안 바뀐 것',
  '변경 구상': '바꿀 계획',
  '인수인계': '다음 AI에게 넘길 글',
  '인수인계 문서': '다음 AI에게 넘길 글',
  '먼저 볼 연결': '주 흐름',
  '먼저 볼 연결만': '주 흐름만',
  '전체 관계': '모든 연결',
  '근거 문장': '이 요약의 근거',
  '보기': '보기 방식',
});
/** The whole map's 보기 at 쉽게 (자세히: 흐름 · 층 · 구성). */
export const EASY_FORM_WORD: Readonly<Record<'flow' | 'layers' | 'compose', string>> = Object.freeze({ flow: '흐름 순서로', layers: '종류별로', compose: '연결 구조로' });
export const EASY_FORM_SWITCH = EASY_WORD['보기']!;
/** What each 보기 does, in plain words (the switch's tips at 쉽게). */
export const EASY_FORM_TIP: Readonly<Record<'flow' | 'layers' | 'compose', string>> = Object.freeze({
  flow: '기록이 말한 순서대로 한 줄에 놓아요',
  layers: '사람·처리·저장·외부 시스템처럼 종류마다 한 줄에 모아요',
  compose: '연결을 따라 왼쪽에서 오른쪽으로 놓아요',
});
/** A control's word at the level now (its 자세히 word when 쉽게 has none). */
export function easyWordOf(w: string): string { return level === 'easy' ? EASY_WORD[w] ?? w : w; }
/** The tip's line that names the 자세히 word beside a plain one (empty at 자세히, or when the word has no plain form). */
export function detailNote(w: string): string { return level === 'easy' && EASY_WORD[w] && EASY_WORD[w] !== w ? `자세히 보기의 이름: ${w}` : ''; }
/** A text that opens with a control's 자세히 word (「먼저 볼 연결: …」), with that word in its plain form at 쉽게. */
export function plainLead(text: string, w: string): string { return level === 'easy' && EASY_WORD[w] && text.startsWith(w) ? EASY_WORD[w] + text.slice(w.length) : text; }
