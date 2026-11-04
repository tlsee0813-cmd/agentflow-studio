/* What a card names past its kind rows (map design v3 3.3): the entry words (구성 N · 기록된 단계 M · 조건 K · 유지 상태 S · …),
 * which read in the bottom line's 내부 보기 tip and in the panel; the loop's repeat unit as the record or a beat-like setting gives
 * it; and the map's zoom levels. The card's own template and heights are card-family's. Pure: no DOM, so the rules are tested on
 * their own. */

/** A card's entry (spec 4): none (no reading, so an empty card; or a reading whose every list the card shows in full), unknown
 * ('내부 미상': the reading names no input, output, field, setting, part or step), or some (counts of what is inside). */
export type EntryKind = 'none' | 'unknown' | 'some';
/** What a part holds inside, as its reading and its composition give it. read: a reading spoke of the part at all. steps: the
 * recorded steps (map-reading.9 steps[]). state: the state it keeps (stateVars), which no card line names. loop: the record says
 * how it repeats, stops or resumes (a part with only that is not '내부 미상'). unplaced: its rules that stand at no precise step,
 * port or field (spec 5.1, 배치 미정: signs-view unplacedCount), which no card line places. conditions: its condition rows
 * (map-reading.12 conditions[]), which no card line names either. programSteps (map-reading.14): the steps the program cut from
 * the part's 3절 arrow chain, counted apart from the recorded ones (steps then counts only the record's own rows). All optional for
 * earlier callers. */
export interface EntryCounts { read: boolean; kids: number; steps: number; programSteps?: number; inputs: number; outputs: number; fields: number; config: number; state?: number; loop?: boolean; unplaced?: number; conditions?: number }
/** How many settings and fields the card names in full. */
export interface EntryShown { config: number; fields: number }
/** The entry's kind for a part, against what its card names at most. */
export function entryKind(c: EntryCounts, shown: EntryShown): EntryKind {
  if (!c.read) return 'none';
  if (!c.kids && !c.steps && !c.programSteps && !c.inputs && !c.outputs && !c.fields && !c.config && !c.state && !c.loop && !c.conditions) return 'unknown';
  return c.kids || c.steps || c.programSteps || c.conditions || c.state || c.unplaced || c.config > shown.config || c.fields > shown.fields ? 'some' : 'none';
}
/** The entry words: '구성 N', '기록된 단계 M' ('기록된 단계 M (+P 프로그램)' when the program cut P more from the 3절 chain), '조건 K' (the condition rows), '유지 상태 S', then each list the card does not name in full, by its total
 * ('설정 K', '필드 F'), and last the rules placed nowhere precise ('배치 미정 U'); '내부 미상' for a reading that names nothing
 * inside (with '배치 미정 U' after it); '' when there is no entry. */
export function entryParts(c: EntryCounts, shown: EntryShown): string[] {
  const kind = entryKind(c, shown), unplaced = c.unplaced ? `배치 미정 ${c.unplaced}` : '';
  if (kind === 'unknown') return ['내부 미상', unplaced].filter(Boolean);
  if (kind === 'none') return [];
  return [c.kids ? `구성 ${c.kids}` : '', c.steps || c.programSteps ? `기록된 단계 ${c.steps}${c.programSteps ? ` (+${c.programSteps} 프로그램)` : ''}` : '', c.conditions ? `조건 ${c.conditions}` : '', c.state ? `유지 상태 ${c.state}` : '', c.config > shown.config ? `설정 ${c.config}` : '', c.fields > shown.fields ? `필드 ${c.fields}` : '', unplaced].filter(Boolean);
}

/** A setting that reads as a beat or an interval: a loop's repeat row names one only when the record wrote it. */
export const CADENCE = /\d\s*(ms|s|sec|m|min|h|d)\b|\d\s*(초|분|시간|일)|간격|주기|마다|매\s?\S|interval|every|cadence|tick|cron|poll|period/i;
/** A loop card's repeat (spec 2.1, 반복 단위를 머리에): the unit the record gives for its repeat (map-reading.9 loop.unit) first,
 * else the first setting that reads as a beat ('반복 · 60 s'), else '반복 단위 ?'. used: the setting the line already names; none
 * while the unit stands. Never a beat made up from a name. program (map-reading.13): the unit is the program's (line-view
 * programLoopItems); the row then carries the 「프로그램」 chip. A beat the card itself takes from the settings is never marked: it
 * is the setting as written, not a loop the reading gave. */
export function loopBody(unit: string | null | undefined, config: readonly string[], program = false): { text: string; used: string | null; program: boolean } {
  if (unit) return { text: `반복 · ${unit}`, used: null, program };
  const used = config.find(c => CADENCE.test(c)) ?? null;
  return { text: used ? `반복 · ${used}` : '반복 단위 ?', used, program: false };
}

/* ---------- zoom tiers (map design v3 5.1–5.4) ----------
 * The tier is the map's, one for every card, decided by the card's projected width on screen p = 272 × k (what a card can really
 * hold is its screen width): 점 지도 below 82 (k < 0.30: glyphs, and names only of what is selected or focused), 개요 82–159
 * (title, kind and short status only: 54% is here, p = 147), 중간 160–239 (the head, one or two kind rows that fit, the inner line
 * and the bottom line), 가까이 from 240 (everything). Crossing an edge needs 6px more on screen than the edge (and leaving it 6px
 * less), so a wheel that settles near an edge does not flicker; the first view's tier is read without it. The card's box never
 * changes with the tier (5.3): the tier and the scale only choose what is shown inside it (tierFit). */
export type ZoomTier = 'dots' | 'far' | 'mid' | 'near';
/** The base card width the tiers are read against, and the edges on the screen card width, with their hysteresis. */
export const TIER_W = 272, TIER_DOTS = 82, TIER_FAR = 160, TIER_NEAR = 240, TIER_HYST = 6;
const TIERS: readonly ZoomTier[] = ['dots', 'far', 'mid', 'near'], EDGES = [TIER_DOTS, TIER_FAR, TIER_NEAR] as const;
/** The tier at camera scale k; prev: the tier shown now (null for a first view, read without hysteresis). */
export function zoomTier(k: number, prev: ZoomTier | null = null): ZoomTier {
  const p = TIER_W * k;
  let i = prev ? TIERS.indexOf(prev) : -1;
  if (i < 0) return p < TIER_DOTS ? 'dots' : p < TIER_FAR ? 'far' : p < TIER_NEAR ? 'mid' : 'near';
  while (i < 3 && p >= EDGES[i]! + TIER_HYST) i++;
  while (i > 0 && p < EDGES[i - 1]! - TIER_HYST) i--;
  return TIERS[i]!;
}
/** The map's zoom levels as the way back and the tests name them: 개요 (dots and far), 중간 and 상세 (near), on the same edges. */
export type ZoomLevel = 'overview' | 'mid' | 'detail';
export function zoomLevel(k: number): ZoomLevel {
  const t = zoomTier(k);
  return t === 'near' ? 'detail' : t === 'mid' ? 'mid' : 'overview';
}

/** The sizes a tier draws a card's text at, in map pixels (5.2): the name max(15, 14/k) on lines of max(20, 18/k), the kind word
 * and a row's label max(12, 12/k) on lines of max(16, 16/k), a row's value max(13, 12/k) on rows of max(20, 16/k): so on screen a
 * title is never under 14px on 18px lines, body text never under 12px on 16px lines. At 가까이 the lines keep their own heights
 * (the scale is at least 0.88 there, the type grows a hair inside them). The glyph tile reads 24px on screen at 개요. */
export interface TierText { title: number; titleLh: number; kind: number; kindLh: number; row: number; rowLh: number; label: number; bottom: number; glyph: number; gap: number }
export function tierText(k: number, tier: ZoomTier): TierText {
  const at = (base: number, screen: number) => Math.max(base, screen / Math.max(k, 0.05)), near = tier === 'near';
  return { title: at(15, 14), titleLh: near ? 20 : at(20, 18), kind: at(12, 12), kindLh: near ? 16 : at(16, 16), row: at(13, 12), rowLh: near ? 20 : at(20, 16), label: at(12, 12),
    bottom: near ? 28 : at(28, 20), glyph: tier === 'far' || tier === 'dots' ? at(20, 24) : 20, gap: near ? 16 : 8 };
}
/** What a card holds at its near tier (card-family cardHeights): its name lines, kind rows, contract area, inner line, sign row
 * and whole height (map px). */
export interface CardShapeIn { nameLines: number; rows: number; contract: number; inner: number; signs: number; total: number;
  /** 1 when the card's short status reads on a line of its own at 개요 (a card with a lifecycle chip says it in the kind line). */
  status?: number;
  /** The rows of list values shown by name in the contract area (0 when the area holds pins, which hide below 가까이). */
  vals?: number;
  /** 1 when one of the kind rows is the defining blank 「?」 (drawn last; never shown below 가까이). */
  blank?: number;
  /** 1 when the first row is a group's 안에 row (S8): at 중간 it reads before the bottom line. */
  members?: number }
/** What a card shows at a tier: its name lines, the kind line, the short status line (개요), how many kind rows and value rows,
 * and whether the contract area, the inner line, the sign row and the bottom line are drawn. */
export interface CardFit { nameLines: number; kind: boolean; status: boolean; rows: number; vals: number; contract: boolean; inner: boolean; signs: boolean; bottom: boolean }
/** The card's padding above and below (map px), as card-family draws it. */
const FIT_PAD = 12 * 2 + 2;
/** What fits a card's fixed box at a tier and scale (5.2–5.4): what does not fit is hidden, never shrunk or overlapped. 가까이 shows
 * everything (the box was made for it). 중간 keeps the head, then the bottom line, the inner line, the kind rows (never the 「?」
 * blank), the value rows and the sign row, each only while its scaled lines fit, so the fixed box is used rather than left empty;
 * never pins (their names hide; the lines' ends stay). 개요 and the dot map keep the head only: two name lines, else one, and the
 * kind line with the short status when it fits. */
export function tierFit(c: CardShapeIn, k: number, tier: ZoomTier): CardFit {
  const nl = Math.min(2, Math.max(1, c.nameLines));
  if (tier === 'near') return { nameLines: nl, kind: true, status: false, rows: c.rows, vals: c.vals ?? 0, contract: true, inner: c.inner > 0, signs: c.signs > 0, bottom: true };
  const T = tierText(k, tier);
  let room = c.total - FIT_PAD;
  const take = (h: number) => { if (room >= h) { room -= h; return true; } return false; };
  // The head: one name line always; at 개요 then the kind line and the short status line (title, kind and short status, 5.4),
  // and a second name line when there is still room (a name that kept one line at 가까이 may need two at the larger type here).
  room -= T.titleLh;
  if (tier !== 'mid') {
    const kind = take(T.kindLh), status = !!c.status && take(T.kindLh), names = take(T.titleLh) ? 2 : 1;
    return { nameLines: names, kind, status, rows: 0, vals: 0, contract: false, inner: false, signs: false, bottom: false };
  }
  // 중간: the kind line, the bottom line (it says the status) under the head's gap, then a second name line, the inner line, the
  // kind rows but the blank, the value rows and the sign row, each while it fits.
  const kind = take(T.kindLh); room -= T.gap;
  // Each block of rows keeps its space after its last row (three quarters of the head gap: 12 at 가까이, 6 here, styles.css).
  const after = T.gap * 0.75, said = Math.max(0, c.rows - (c.blank ? 1 : 0));
  // A group's 안에 row (S8, its first row) reads before the bottom line: what belongs to the group is what a folded group says.
  let rows = c.members && said > 0 && take(T.rowLh + after) ? 1 : 0;
  // A name that took two lines at 가까이 keeps its second line first; one that kept one line there takes a second (the larger type
  // here may wrap it) only with the room the rows leave, so the body is never left empty for a line the name may not need.
  const bottom = take(T.bottom); let names = nl >= 2 && take(T.titleLh) ? 2 : 1;
  const inner = c.inner > 0 && take(Math.max(24, T.rowLh + 4));
  while (rows < said && take(T.rowLh + (rows ? 0 : after))) rows++;
  let vals = 0; const all = c.vals ?? 0; while (rows === said && vals < all && take(T.rowLh + (vals ? 0 : after))) vals++;
  const signs = c.signs > 0 && take(Math.max(24, T.rowLh + 4));
  if (names === 1 && take(T.titleLh)) names = 2;
  return { nameLines: names, kind, status: false, rows, vals, contract: vals > 0, inner, signs, bottom };
}
