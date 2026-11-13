/* The far view's name tag (beauty v2, 「읽히는 첫 전체 화면」 A3). A card's face is one of two: the card itself (its name at 15px on the
 * map, so on screen 15·k) or, where that name would read under 12px on screen, a compact name tag in the same box: the kind icon and
 * the part's identifiable name at a fixed screen size (no rows, no buttons). The box, its id, its lines' ends and the selection never
 * change with the face: only what is drawn inside the box. Pure: no DOM, so the rules are tested on their own. */
import { nameBreaks } from './card-family.js';

/** The card's name on the map (styles.css: 15px) and the least it may read on screen. */
export const CARD_NAME_PX = 15, NAME_FLOOR_PX = 12;
/** Below this scale the face turns to the name tag. Beauty v2 review (H3): 0.9, not the 0.8 where the card's 15px name would reach the
 * floor: the card face draws its lines at the middle view's spacing (map-route CROWD and PORT_FLOOR, 8 screen px at 0.9), so it is
 * never drawn further out than that; the tag (12.5px) reads there instead, and the lines fold as the far view does. */
export const FACE_K = 0.9;
/** The way back to the card needs 10% more zoom than the way out (10–15% hysteresis), so a wheel that settles near the edge does
 * not flicker; the name reads at the floor or more on both sides of it (13.5px at 0.9). */
export const FACE_HYST = 1.1;
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
 * lifecycle word must read (it sits in the kind line, kept before a name's last line when two or more lines are left). cut(width,
 * px): whether a word of the name is wider than a line at that type size (beauty v2 review M4: the compact type is taken when it
 * keeps such a word whole). */
export function tagRoom(w: number, h: number, need: (width: number, px: number) => number, mustKind = false, cut: (width: number, px: number) => boolean = () => false): TagRoom {
  const icon = w >= TAG.minIconW, width = Math.max(8, w - TAG.padL - TAG.padX - (icon ? TAG.icon + TAG.iconGap : 0));
  const at = (lh: number, pad: number) => Math.max(1, Math.floor((h - 2 * pad + 0.5) / lh));
  let rows = at(TAG.nameLh, TAG.padY), want = need(width, TAG.name), compact = false;
  // The compact type only when it gives the name a line it lacked, or keeps whole a word the tag's type would cut.
  const whole = cut(width, TAG.name) && !cut(width, TAG_COMPACT.name);
  if (rows < Math.min(want, TAG.maxLines) + (mustKind ? 1 : 0) || whole) {
    const cr = at(TAG_COMPACT.nameLh, TAG_COMPACT.padY);
    if (cr > rows || whole) { rows = Math.max(rows, cr); want = need(width, TAG_COMPACT.name); compact = true; }
  }
  if (mustKind && rows >= 2) return { width, lines: Math.min(want, rows - 1, TAG.maxLines), icon, kind: true, compact };
  const lines = Math.min(want, rows, TAG.maxLines);
  return { width, lines, icon, kind: rows > lines, compact };
}

/** The pieces a name breaks into on a tag: after its separators (card-family nameBreaks), at its spaces (the space kept with the
 * piece before it), before an opening bracket (「메인테이너|(Yota Hamada)」, never 「메인테이너(Y|ota」) and, beauty v2 review M4, where
 * the words of an identifier meet (「GPT|Researcher」, 「WebSocket|Manager」): never inside a word. */
function pieces(name: string): string[] {
  return nameBreaks(name).flatMap(p => p.split(/(?<=\s)(?=\S)|(?<=\S)(?=[([{])|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z]{2})/)).filter(Boolean);
}
/** Hangul breaks between its syllables (Korean is set that way); a Latin word, an identifier or a number never breaks inside. */
const HANGUL = /[ㄱ-ㆎ가-힣]/;
/** Whether a word of the name is wider than a line of width w (on its line it would be cut with 「…」). */
export function cutsWord(name: string, w: number, measure: (s: string) => number): boolean {
  return pieces(name.trim()).some(p => !HANGUL.test(p) && measure(p.trimEnd()) > w);
}
/** How many lines a name takes at width w (no line cut). */
export function linesNeeded(name: string, w: number, measure: (s: string) => number): number {
  return wrap(name, w, measure).length;
}
/** The name wrapped greedily at its breaks. A piece wider than the line: Hangul breaks between its syllables; any other word takes a
 * line of its own, cut at its end with 「…」, and the name goes on on the next line (beauty v2 review M4: 「tinyshakesp…」, never
 * 「tinyshakesp|eare」). */
function wrap(name: string, w: number, measure: (s: string) => number): string[] {
  return wrapAt(name, w, measure).map(l => l.text);
}
/** wrap, each line with the offset in the name where it starts (so the rest of a name is read from the name itself, as written). */
function wrapAt(name: string, w: number, measure: (s: string) => number): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = []; let cur = '', start = 0, at = 0;
  const push = (text: string) => { out.push({ text: text.trimEnd(), start }); };
  for (const p of pieces(name)) {
    if (measure((cur + p).trimEnd()) <= w) { cur += p; at += p.length; continue; }
    if (cur) { push(cur); cur = ''; start = at; }
    if (measure(p.trimEnd()) <= w) { cur = p; at += p.length; continue; }
    if (!HANGUL.test(p)) { push(cutEnd(p.trimEnd(), w, measure)); at += p.length; start = at; continue; }
    for (const ch of [...p]) { if (cur && measure((cur + ch).trimEnd()) > w) { push(cur); cur = ''; start = at; } cur += ch; at += ch.length; }
  }
  if (cur.trim()) push(cur);
  return out.length ? out : [{ text: '', start: 0 }];
}
/** The longest start of s (by characters) that fits w with an ellipsis after it. */
function cutEnd(s: string, w: number, measure: (s: string) => number): string {
  const cs = [...s]; let n = cs.length;
  while (n > 0 && measure(`${cs.slice(0, n).join('').trimEnd()}…`) > w) n--;
  return `${cs.slice(0, Math.max(n, 1)).join('').trimEnd()}…`;
}
/** A name in at most `lines` lines of width w. v12 (first user of v11, 8: 「문서 소비…」 and a parser's name cut inside its first word at 1280): what does not fit is left out
 * in whole units only, the way the plain map shortens a label (line-grammar cutUnits: never inside a word, a Hangul word included): its
 * first whole units with 「…」 after them; when not even its first unit fits, 「…」 and its last whole units; only a name of one word wider
 * than every line keeps that word's start with 「…」. full: nothing was left out. */
export function fitTag(name: string, w: number, lines: number, measure: (s: string) => number): { lines: string[]; full: boolean } {
  const nm = name.trim(), n = Math.max(1, lines), all = wrapAt(nm, w, measure).map(l => l.text);
  const bare = (t: string) => t.replace(/\s+/g, '');
  // Laid out whole: every line within w, nothing cut by wrap (it cuts a word wider than a line) and every line starting where a unit starts
  // (a Hangul word is not broken between its syllables either).
  const whole = (t: string): string[] | null => {
    const at = wrapAt(t, w, measure), ls = at.map(l => l.text), starts = new Set<number>(); let o = 0; for (const p of pieces(t)) { starts.add(o); o += p.length; }
    return ls.length <= n && bare(ls.join('')) === bare(t) && ls.every(l => measure(l) <= w + 0.01) && at.every(l => starts.has(l.start)) ? ls : null;
  };
  const fit = whole(nm); if (fit) return { lines: fit, full: true };
  // The units after a cut: a tail never starts inside a bracket it does not open (「…Ellis)」 is left out).
  const trim = (t: string) => t.replace(/[\s·/,_:;.-]+$/u, '').replace(/^[\s·/,_:;.-]+/u, '');
  const closeTail = (t: string) => { let x = t; while ((x.match(/[)\]}]/g) ?? []).length > (x.match(/[([{]/g) ?? []).length) { const i = Math.min(...[')', ']', '}'].map(c => x.indexOf(c)).filter(j => j >= 0)); x = trim(x.slice(i + 1)); } return x; };
  const units = pieces(nm);
  for (let k = units.length - 1; k >= 1; k--) { const head = trim(units.slice(0, k).join('')); if (!head) continue; const ls = whole(`${head}…`); if (ls) return { lines: ls, full: false }; }
  for (let k = 1; k < units.length; k++) { const tail = closeTail(trim(units.slice(k).join(''))); if (!tail) continue; const ls = whole(`…${tail}`); if (ls) return { lines: ls, full: false }; }
  // One word wider than every line: its start, cut at its end (nothing whole can stand for it).
  if (all.length <= n) return { lines: all, full: !all.some(l => l.endsWith('…')) };
  const at = wrapAt(nm, w, measure);
  return { lines: [...all.slice(0, n - 1), cutEnd(nm.slice(at[n - 1]!.start).trim(), w, measure)], full: false };
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
