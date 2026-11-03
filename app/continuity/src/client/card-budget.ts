/* The text budget of a collapsed unit card (map spec 2.1): six lines at most. The head (the small type word with the name, one
 * or two name lines) and the operations line are always kept; under them, what the part takes (받는 것) and hands over (내는 것),
 * one structural line (ledger, loop, timer or actor) and one setting. When the name takes more lines, the region under it gives
 * way in a fixed order: the setting first, then the second port line (내는 것 folds into the 받는 것 line). The head, the
 * operations line and the structural line are never dropped. A card with an inside carries its group chips (연결 N, 안쪽 N)
 * at the end of its one name line, or, when the name does not keep one line beside them, on a line of their own under the body,
 * counted in the six lines and never dropped (they are the way in).
 * Under them the entry line (spec 4, 열기): what the part holds past what the card shows, in totals ('구성 4 · 기록된 단계 7 ·
 * 설정 3 · 필드 12'), or '내부 미상' when its reading names nothing inside. It is the way into 동작 열기, so when the lines are
 * tight it takes the setting's place; it gives way only after 내는 것 has folded.
 * A part with rules, gates or withdrawals carries its sign tabs (spec 5: 규칙 N · 관문 M · 변경 K) at the card's bottom edge: at
 * the right of the entry line, or on that row alone when there is no entry line; they are never dropped for room.
 * The map's three zoom levels (spec 4) keep less of the same card: 개요 the head and the operations line only, 중간 also the
 * port lines, 상세 everything. Pure: no DOM, so the rule is tested on its own. */

/** The lines a collapsed card holds at most. */
export const CARD_LINES = 6;

/** Where a card with an inside carries its group chips: none (no inside), at the end of the name line, or on a line of its own. */
export type ChipsAt = 'none' | 'name' | 'line';
/** io: the port lines kept: both on their own line ('both'), one of them alone ('in' / 'out', the other not recorded), 내는 것
 * folded into the 받는 것 line ('fold', one line), or none recorded. chips: where the group chips are drawn. lines: the text
 * lines the card then holds (the head's name lines, the operations line, the kept lines under them and a chips line). */
export interface CardBudget { io: 'both' | 'in' | 'out' | 'fold' | 'none'; body: boolean; set: boolean; chips: ChipsAt; entry: boolean; signs?: SignsAt; lines: number }
/** Where a card's sign tabs (규칙 · 관문 · 변경, map spec 5) go: none (no signs, or 개요), at the right of the entry line ('entry'),
 * on a row of their own at the card's bottom edge ('line', counted in the six lines), or at the right of the group chips' own
 * line ('chips', when the bottom row gives way under a long name and the chips have a line of their own). A sign is never
 * dropped for room (a rule is not hidden because its anchor is unknown): it shares a row before it takes one. */
export type SignsAt = 'none' | 'entry' | 'line' | 'chips';

/** A card's entry line (spec 4): none (no reading, so an empty card; or a reading whose every list the card shows in full),
 * unknown ('내부 미상': the reading names no input, output, field, setting, part or step), or some (counts of what is inside). */
export type EntryKind = 'none' | 'unknown' | 'some';
/** What a part holds inside, as its reading and its composition give it. read: a reading spoke of the part at all. steps: the
 * recorded steps (map-reading.9 steps[]). state: the state it keeps (stateVars), which no card line names. loop: the record says
 * how it repeats, stops or resumes (a part with only that is not '내부 미상'). unplaced: its rules that stand at no precise step,
 * port or field (spec 5.1, 배치 미정: signs-view unplacedCount), which no card line places. conditions: its condition rows
 * (map-reading.12 conditions[]), which no card line names either. All optional for earlier callers. */
export interface EntryCounts { read: boolean; kids: number; steps: number; inputs: number; outputs: number; fields: number; config: number; state?: number; loop?: boolean; unplaced?: number; conditions?: number }
/** How many settings and fields the collapsed card can name (a setting line and a loop's or timer's beat; a ledger's cells). */
export interface EntryShown { config: number; fields: number }
/** The entry line's kind for a part, against what its card names at most. */
export function entryKind(c: EntryCounts, shown: EntryShown): EntryKind {
  if (!c.read) return 'none';
  if (!c.kids && !c.steps && !c.inputs && !c.outputs && !c.fields && !c.config && !c.state && !c.loop && !c.conditions) return 'unknown';
  return c.kids || c.steps || c.conditions || c.state || c.unplaced || c.config > shown.config || c.fields > shown.fields ? 'some' : 'none';
}
/** The entry line's words: '구성 N', '기록된 단계 M', '조건 K' (the condition rows), '유지 상태 S', then each list the card does not name in full, by its total
 * ('설정 K', '필드 F'), and last the rules placed nowhere precise ('배치 미정 U'); '내부 미상' for a reading that names nothing
 * inside (with '배치 미정 U' after it); '' when there is no entry. */
export function entryParts(c: EntryCounts, shown: EntryShown): string[] {
  const kind = entryKind(c, shown), unplaced = c.unplaced ? `배치 미정 ${c.unplaced}` : '';
  if (kind === 'unknown') return ['내부 미상', unplaced].filter(Boolean);
  if (kind === 'none') return [];
  return [c.kids ? `구성 ${c.kids}` : '', c.steps ? `기록된 단계 ${c.steps}` : '', c.conditions ? `조건 ${c.conditions}` : '', c.state ? `유지 상태 ${c.state}` : '', c.config > shown.config ? `설정 ${c.config}` : '', c.fields > shown.fields ? `필드 ${c.fields}` : '', unplaced].filter(Boolean);
}

/** A setting that reads as a beat or an interval: a loop's frame names one only when the record wrote it. */
export const CADENCE = /\d\s*(ms|s|sec|m|min|h|d)\b|\d\s*(초|분|시간|일)|간격|주기|마다|매\s?\S|interval|every|cadence|tick|cron|poll|period/i;
/** A loop card's one structural line (spec 2.1, 반복 단위를 머리에): the unit the record gives for its repeat (map-reading.9
 * loop.unit) first, else the first setting that reads as a beat ('반복 · 60 s'), else '반복 단위 ?'. used: the setting the line
 * already names (the setting line then shows another); none while the unit stands. Never a beat made up from a name. */
export function loopBody(unit: string | null | undefined, config: readonly string[]): { text: string; used: string | null } {
  if (unit) return { text: `반복 · ${unit}`, used: null };
  const used = config.find(c => CADENCE.test(c)) ?? null;
  return { text: used ? `반복 · ${used}` : '반복 단위 ?', used };
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

/** nameLines: the lines the name takes on the card (as the layout measured them; at least one). body: whether the card has
 * its one structural line. chips: where its group chips go (a chips line counts as one of the six). level: the zoom level the
 * card is drawn at; 개요 keeps no line under the operations line, 중간 only the port lines and the entry line. entry: the card's
 * entry line (entryKind), kept at 중간 and 상세 before the setting. signs: the card has sign tabs (규칙 · 관문 · 변경); they share
 * the entry line's row at its right, or take that row when there is no entry line; when the row has to give way they ride the
 * chips' own line. Never at 개요. The result names signs only for a card that has them (earlier callers read the same budget). */
export function typedBudget(nameLines: number, hasSet: boolean, hasIn: boolean, hasOut: boolean, body: boolean, chips: ChipsAt = 'none', level: ZoomLevel = 'detail', entry: EntryKind = 'none', signs = false): CardBudget {
  const head = Math.max(1, Math.floor(nameLines) || 1), own = chips === 'line' ? 1 : 0, room = Math.max(0, CARD_LINES - head - 1 - own);
  let io: CardBudget['io'] = level === 'overview' ? 'none' : hasIn && hasOut ? 'both' : hasIn ? 'in' : hasOut ? 'out' : 'none', set = hasSet && level === 'detail';
  const keepBody = body && level === 'detail';
  let ent = entry !== 'none' && level !== 'overview', sg = signs && level !== 'overview', onChips = false;
  // The bottom row holds the entry line, the sign tabs at its right, or both: one line either way.
  const count = () => (io === 'both' ? 2 : io === 'none' ? 0 : 1) + (keepBody ? 1 : 0) + (set ? 1 : 0) + (ent || sg ? 1 : 0);
  if (count() > room && set) set = false;
  if (count() > room && io === 'both') io = 'fold';
  if (count() > room && (ent || sg)) {
    // The row gives way: the entry line goes and the signs ride the chips' own line; with no such line the signs keep the row
    // (never dropped), and the entry line shares it as before.
    if (sg && own) { sg = false; onChips = true; ent = false; } else if (!sg) ent = false;
  }
  const at: SignsAt = onChips ? 'chips' : !sg ? 'none' : ent ? 'entry' : 'line';
  return { io, body: keepBody, set, chips, entry: ent, ...(signs ? { signs: at } : {}), lines: head + 1 + count() + own };
}

/** Heights as styles.css draws them: .node-type 15px; .node-io, .node-body and .node-set 17px each with 2px between; the
 * ledger's double rule adds 3 + 2px, the loop's frame 1px a side; the group chips' line is their 22px. */
export const TYPE_H = 15, LINE_H = 17, LINE_GAP = 2, CHIPS_H = 22;
/** The kind of a card's structural region, as far as its height goes. */
export type BodyKind = 'store' | 'loop' | 'timer' | 'actor' | null;
/** The heights of the typed lines a budget keeps under the operations line, in order (the chips line is not one of them). */
export function typedLines(b: CardBudget, body: BodyKind): number[] {
  const out: number[] = [];
  if (b.io !== 'none') out.push(LINE_H);
  if (b.io === 'both') out.push(LINE_H);
  if (b.body && body) out.push(LINE_H + (body === 'store' ? 5 : body === 'loop' ? 2 : 0));
  if (b.set) out.push(LINE_H);
  if (b.entry || b.signs === 'line') out.push(LINE_H);
  return out;
}
/** The room a budget's lines take under the operations line: the typed block after the card's own gap (3px on a unit), its
 * lines 2px apart, then the chips line after the same gap when the chips have a line of their own. */
export function typedPx(b: CardBudget, body: BodyKind, gap: number): number {
  const ls = typedLines(b, body);
  return (ls.length ? gap + ls.reduce((a, x) => a + x, 0) + (ls.length - 1) * LINE_GAP : 0) + (b.chips === 'line' ? gap + CHIPS_H : 0);
}
