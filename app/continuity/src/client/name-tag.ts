/* The far view's name tag (beauty v2, 「읽히는 첫 전체 화면」 A3). A card's face is one of two: the card itself (its name at 15px on the
 * map, so on screen 15·k) or, where that name would read under 12px on screen, a compact name tag in the same box: the kind icon and
 * the part's identifiable name at a fixed screen size (no rows, no buttons). The box, its id, its lines' ends and the selection never
 * change with the face: only what is drawn inside the box. Pure: no DOM, so the rules are tested on their own. */
import { nameBreaks } from './card-family.js';

/** The card's name on the map (styles.css: 15px) and the least it may read on screen. */
export const CARD_NAME_PX = 15, NAME_FLOOR_PX = 12;
/** Below this scale the card's name would read under the floor: the face turns to the name tag. */
export const FACE_K = NAME_FLOOR_PX / CARD_NAME_PX;
/** The way back to the card needs 12% more zoom than the way out (10–15% hysteresis), so a wheel that settles near the edge does
 * not flicker; the name reads at the floor or more on both sides of it. */
export const FACE_HYST = 1.12;
export type CardFace = 'card' | 'tag';
/** The face at camera scale k; prev: the face shown now (null for a first view, read without hysteresis). */
export function cardFace(k: number, prev: CardFace | null = null): CardFace {
  if (prev === 'tag') return k >= FACE_K * FACE_HYST ? 'card' : 'tag';
  return k < FACE_K ? 'tag' : 'card';
}

/** The tag's type on screen (px): the name 12.5 on lines of 14 and the kind line 12 on 14; where a box is too low for the lines a name
 * needs, the compact type (the name at the floor, 12 on lines of 13, 1px inside the box's top and bottom). The padding at the sides,
 * the icon (it gives way below minIconW: the name comes first), at most three name lines. */
export const TAG = { name: 12.5, nameLh: 14, kind: 12, kindLh: 14, padX: 6, padL: 7, padY: 3, icon: 12, iconGap: 4, minIconW: 92, maxLines: 3 } as const;
export const TAG_COMPACT = { name: 12, nameLh: 13, padY: 1 } as const;
/** What a tag of a box (on screen) holds: the name's width and lines, the icon, the kind line, and the compact type. */
export interface TagRoom { width: number; lines: number; icon: boolean; kind: boolean; compact: boolean }
/** The room a box of w × h screen px gives a tag. need(width, px): the lines the name takes at that width and type size. mustKind: a
 * lifecycle word must read (it sits in the kind line, kept before a name's last line when two or more lines are left). */
export function tagRoom(w: number, h: number, need: (width: number, px: number) => number, mustKind = false): TagRoom {
  const icon = w >= TAG.minIconW, width = Math.max(8, w - TAG.padL - TAG.padX - (icon ? TAG.icon + TAG.iconGap : 0));
  const at = (lh: number, pad: number) => Math.max(1, Math.floor((h - 2 * pad + 0.5) / lh));
  let rows = at(TAG.nameLh, TAG.padY), want = need(width, TAG.name), compact = false;
  // The compact type only when it gives the name a line it lacked.
  if (rows < Math.min(want, TAG.maxLines) + (mustKind ? 1 : 0)) {
    const cr = at(TAG_COMPACT.nameLh, TAG_COMPACT.padY);
    if (cr > rows) { rows = cr; want = need(width, TAG_COMPACT.name); compact = true; }
  }
  if (mustKind && rows >= 2) return { width, lines: Math.min(want, rows - 1, TAG.maxLines), icon, kind: true, compact };
  const lines = Math.min(want, rows, TAG.maxLines);
  return { width, lines, icon, kind: rows > lines, compact };
}

/** The pieces a name breaks into on a tag: after its separators (card-family nameBreaks), at its spaces (the space kept with the
 * piece before it) and before an opening bracket (「메인테이너|(Yota Hamada)」, never 「메인테이너(Y|ota」). */
function pieces(name: string): string[] {
  return nameBreaks(name).flatMap(p => p.split(/(?<=\s)(?=\S)|(?<=\S)(?=[([{])/)).filter(Boolean);
}
/** How many lines a name takes at width w (no line cut). */
export function linesNeeded(name: string, w: number, measure: (s: string) => number): number {
  return wrap(name, w, measure).length;
}
/** The name wrapped greedily at its breaks; a piece wider than the line breaks between characters. */
function wrap(name: string, w: number, measure: (s: string) => number): string[] {
  const out: string[] = []; let cur = '';
  for (const p of pieces(name)) {
    if (measure((cur + p).trimEnd()) <= w) { cur += p; continue; }
    if (cur) { out.push(cur.trimEnd()); cur = ''; }
    if (measure(p.trimEnd()) <= w) { cur = p; continue; }
    // A piece too long for a line: by characters.
    for (const ch of [...p]) { if (cur && measure((cur + ch).trimEnd()) > w) { out.push(cur.trimEnd()); cur = ''; } cur += ch; }
  }
  if (cur.trim()) out.push(cur.trimEnd());
  return out.length ? out : [''];
}
/** The longest start of s (by characters) that fits w with an ellipsis after it. */
function cutEnd(s: string, w: number, measure: (s: string) => number): string {
  const cs = [...s]; let n = cs.length;
  while (n > 0 && measure(`${cs.slice(0, n).join('').trimEnd()}…`) > w) n--;
  return `${cs.slice(0, Math.max(n, 1)).join('').trimEnd()}…`;
}
/** A name in at most `lines` lines of width w, cut at the end with 「…」 (its start reads). full: nothing was cut. */
export function fitTag(name: string, w: number, lines: number, measure: (s: string) => number): { lines: string[]; full: boolean } {
  const all = wrap(name.trim(), w, measure), n = Math.max(1, lines);
  if (all.length <= n) return { lines: all, full: true };
  return { lines: [...all.slice(0, n - 1), cutEnd(all.slice(n - 1).join(' '), w, measure)], full: false };
}
/** The part of a name that tells it from others that start alike: its first word (at most 8 characters) and 「…」, then the name from
 * where it first differs from them (back to that word's start): 「Hugging…datasets openwebtext」 beside 「Hugging…GPT-2 가중치」. */
export function distinguishing(name: string, others: readonly string[]): string {
  const cs = [...name];
  let p = 0;
  for (const o of others) { const os = [...o]; let i = 0; while (i < cs.length && i < os.length && cs[i] === os[i]) i++; p = Math.max(p, i); }
  if (p < 4) return name;
  // Back to the start of the word the difference falls in.
  while (p > 0 && !/[\s·/._\-:,(]/.test(cs[p - 1]!)) p--;
  const first = (name.match(/^[^\s·/._\-:,(]+/)?.[0] ?? name).slice(0, 8);
  return p <= first.length ? name : `${first}…${cs.slice(p).join('')}`;
}
/** The tags' texts for a set of names at their rooms, each identifiable: parts whose cut names would read the same keep their
 * distinguishing part instead (distinguishing); a pair still alike after that (the same name twice) is left as it is. */
export function fitTags(items: readonly { id: string; name: string; width: number; lines: number; measure?: (s: string) => number }[], measure: (s: string) => number): Map<string, { lines: string[]; full: boolean }> {
  const out = new Map<string, { lines: string[]; full: boolean }>(), m = (x: (typeof items)[number]) => x.measure ?? measure;
  for (const x of items) out.set(x.id, fitTag(x.name, x.width, x.lines, m(x)));
  const by = new Map<string, (typeof items)[number][]>();
  for (const x of items) { const k = out.get(x.id)!.lines.join('\n'); by.set(k, [...(by.get(k) ?? []), x]); }
  for (const xs of by.values()) {
    if (xs.length < 2 || new Set(xs.map(x => x.name)).size < 2) continue;
    for (const x of xs) {
      if (out.get(x.id)!.full) continue;
      const f = fitTag(distinguishing(x.name, xs.filter(y => y.name !== x.name).map(y => y.name)), x.width, x.lines, m(x));
      out.set(x.id, { lines: f.lines, full: false });
    }
  }
  return out;
}
