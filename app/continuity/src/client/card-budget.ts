/* The text budget of a collapsed unit card (map spec 2.1): six lines at most. The head (the small type word with the name, one
 * or two name lines) and the operations line are always kept; under them, what the part takes (받는 것) and hands over (내는 것),
 * one structural line (ledger, loop, timer or actor) and one setting. When the name takes more lines, the region under it gives
 * way in a fixed order: the setting first, then the second port line (내는 것 folds into the 받는 것 line). The head, the
 * operations line and the structural line are never dropped. A card with an inside carries its group chips (연결 N, 안쪽 N)
 * at the end of its one name line, or, when the name does not keep one line beside them, on a line of their own under the body,
 * counted in the six lines and never dropped (they are the way in).
 * The map's three zoom levels (spec 4) keep less of the same card: 개요 the head and the operations line only, 중간 also the
 * port lines, 상세 everything. Pure: no DOM, so the rule is tested on its own. */

/** The lines a collapsed card holds at most. */
export const CARD_LINES = 6;

/** Where a card with an inside carries its group chips: none (no inside), at the end of the name line, or on a line of its own. */
export type ChipsAt = 'none' | 'name' | 'line';
/** io: the port lines kept: both on their own line ('both'), one of them alone ('in' / 'out', the other not recorded), 내는 것
 * folded into the 받는 것 line ('fold', one line), or none recorded. chips: where the group chips are drawn. lines: the text
 * lines the card then holds (the head's name lines, the operations line, the kept lines under them and a chips line). */
export interface CardBudget { io: 'both' | 'in' | 'out' | 'fold' | 'none'; body: boolean; set: boolean; chips: ChipsAt; lines: number }

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
 * card is drawn at; 개요 keeps no line under the operations line, 중간 only the port lines. */
export function typedBudget(nameLines: number, hasSet: boolean, hasIn: boolean, hasOut: boolean, body: boolean, chips: ChipsAt = 'none', level: ZoomLevel = 'detail'): CardBudget {
  const head = Math.max(1, Math.floor(nameLines) || 1), own = chips === 'line' ? 1 : 0, room = Math.max(0, CARD_LINES - head - 1 - own);
  let io: CardBudget['io'] = level === 'overview' ? 'none' : hasIn && hasOut ? 'both' : hasIn ? 'in' : hasOut ? 'out' : 'none', set = hasSet && level === 'detail';
  const keepBody = body && level === 'detail';
  const count = () => (io === 'both' ? 2 : io === 'none' ? 0 : 1) + (keepBody ? 1 : 0) + (set ? 1 : 0);
  if (count() > room && set) set = false;
  if (count() > room && io === 'both') io = 'fold';
  return { io, body: keepBody, set, chips, lines: head + 1 + count() + own };
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
  return out;
}
/** The room a budget's lines take under the operations line: the typed block after the card's own gap (3px on a unit), its
 * lines 2px apart, then the chips line after the same gap when the chips have a line of their own. */
export function typedPx(b: CardBudget, body: BodyKind, gap: number): number {
  const ls = typedLines(b, body);
  return (ls.length ? gap + ls.reduce((a, x) => a + x, 0) + (ls.length - 1) * LINE_GAP : 0) + (b.chips === 'line' ? gap + CHIPS_H : 0);
}
