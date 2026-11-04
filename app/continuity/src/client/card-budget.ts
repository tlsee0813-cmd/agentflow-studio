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

/** The map's zoom levels (spec 4, 세 확대 단계): 개요 (overview), 중간 (mid) and 상세 (detail). */
export type ZoomLevel = 'overview' | 'mid' | 'detail';
/** The zoom shown in the map's tools (a whole percent) up to which each level holds: 개요 to 55%, 중간 to 85%, 상세 above. */
export const OVERVIEW_MAX = 55, MID_MAX = 85;
/** The level for a camera scale, read as the percent the zoom tool shows (70% is 중간, 55% is 개요, 86% is 상세). */
export function zoomLevel(k: number): ZoomLevel {
  const pct = Math.round(k * 100);
  return pct <= OVERVIEW_MAX ? 'overview' : pct <= MID_MAX ? 'mid' : 'detail';
}
