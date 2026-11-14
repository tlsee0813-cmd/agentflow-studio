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
 * piece before it) and before an opening bracket (「메인테이너|(Yota Hamada)」, never 「메인테이너(Y|ota」): never inside a word. v14 fix 1
 * (verify of v14: 「Postgre|SQL」, 「GPT|Researcher」, 「런처(Pocket|Base)」 at rest): an identifier is one word, never broken where its
 * capitals meet (beauty v2 review M4 broke it there). */
function pieces(name: string, ext: boolean | 'camel' = false): string[] {
  const ps0 = nameBreaks(name).flatMap(p => p.split(/(?<=\s)(?=\S)|(?<=\S)(?=[([{])/)).filter(Boolean);
  // v14 fix 1: only as the last way to a whole name (camel; 「WebSocketManager·run_agent」 kept none of it at 43% without it), an identifier may
  // break where a lower-case run meets a capitalised word (「WebSocket|Manager」), never inside a run of capitals (「PostgreSQL」, 「GPTResearcher」).
  const ps = ext === 'camel' ? ps0.flatMap(p => p.split(/(?<=[a-z]{2})(?=[A-Z][a-z]{2})/)).filter(Boolean) : ps0;
  // v14 A (spec 2), only when nothing else keeps the name whole: a file name may also break before its extension (「presetloader|.py」).
  return ext ? ps.flatMap(p => p.split(/(?<=[A-Za-z0-9_])(?=\.[A-Za-z0-9]{1,4}(?:\s|$))/)).filter(Boolean) : ps;
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
function wrapAt(name: string, w: number, measure: (s: string) => number, ext: boolean | 'camel' = false): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = []; let cur = '', start = 0, at = 0;
  const push = (text: string) => { out.push({ text: text.trimEnd(), start }); };
  for (const p of pieces(name, ext)) {
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
/* ---------- v14 A (spec 2): whole names at every width ---------- */
/** The least a tag's type goes to (screen px) to keep a name whole rather than cut it: a whole name (the smaller face), and a first whole
 * word standing for a name that does not fit (the page's text floor, map hygiene H3: nothing on the map reads under 10px). */
export const WHOLE_MIN_PX = 10, WORD_MIN_PX = 10;
/** A tag's text: its lines, whether the name is there whole, and the share of the tag's type it is drawn at (1 when absent). tight: it
 * takes the tag's side room too (its padding down to 2px, no icon). none: not even one whole word fits; the tag shows 「⋯」 alone (its
 * name in the card's hover and keyboard name). */
export interface TagFit { lines: string[]; full: boolean; scale?: number; tight?: boolean; none?: boolean; gloss?: boolean }
/** The words of a name for leaving its end out: split at its spaces, after 「·」 「/」 「,」 and before an opening bracket. Never where an
 * identifier's words meet (「Flash|House」 is one word), never inside a hyphenated, dotted or snake_case word, never between the syllables of a
 * Hangul word: what stands before 「…」 is always whole words of the name. */
export function nameWords(name: string): string[] {
  return name.trim().split(/(?<=\s)(?=\S)|(?<=[·/,，、])(?=\S)|(?<=\S)(?=[([{])/).filter(Boolean);
}
/** A name in at most `lines` lines of width w, never cut at its start or inside a word (v14 spec 2; v12 had 「…래스터」 and a long word cut at its end):
 * 1. whole at the tag's type, then at a smaller type down to WHOLE_MIN_PX (the smaller face), a file name broken before its extension
 * only when nothing else keeps it whole; 2. its first whole words with 「…」 after them (the full name in the card's hover and keyboard
 * name), at the tag's type, then smaller down to WORD_MIN_PX; 3. its first word alone, whole, in the tag's side room too (slack: the width
 * its padding and icon give back, tight); 4. 「⋯」. px: the type the measure measures at. */
export function fitTag(name: string, w: number, lines: number, measure: (s: string) => number, px: number = TAG.name, slack = 0): TagFit {
  const nm = name.trim(), n = Math.max(1, lines);
  const bare = (t: string) => t.replace(/\s+/g, '');
  // Laid out whole: every line within w, nothing cut by wrap and every line starting where a piece starts (a Hangul word is never broken
  // between its syllables either).
  const whole = (t: string, m: (s: string) => number, ext: boolean | 'camel' = false, ww = w): string[] | null => {
    const at = wrapAt(t, ww, m, ext), ls = at.map(l => l.text), starts = new Set<number>(); let o = 0; for (const p of pieces(t, ext)) { starts.add(o); o += p.length; }
    return ls.length <= n && bare(ls.join('')) === bare(t) && ls.every(l => m(l) <= ww + 0.01) && at.every(l => starts.has(l.start)) ? ls : null;
  };
  const scaled = (s: number) => (t: string) => measure(t) * s;
  const steps = (least: number) => { const out: number[] = [1]; for (let s = 0.96; s * px >= least - 1e-9; s -= 0.04) out.push(Math.round(s * 100) / 100); return out; };
  const at = (s: number) => (s < 1 ? { scale: s } : {});
  for (const ext of [false, true]) for (const s of steps(WHOLE_MIN_PX)) { const ls = whole(nm, scaled(s), ext); if (ls) return { lines: ls, full: true, ...at(s) }; }
  // v14 fix 1: the whole name in the tag's side room too (its padding down to 2px, no icon) before any part of it alone: an identifier that
  // was broken where its capitals meet (「ReadWrite|Proxy·압축 워커」) now reads whole there.
  if (slack > 0) for (const ext of [false, true]) for (const s of steps(WHOLE_MIN_PX)) { const ls = whole(nm, scaled(s), ext, w + slack); if (ls) return { lines: ls, full: true, tight: true, ...at(s) }; }
  // v14 fix 1 (verify of v14: 「작업 큐·실행기…」, 「REST API…」, 「프로젝트 전환…」 at rest): a name that ends in a bracket (「정기 일정(django_q
  // Schedule)」, 「Weights & Biases(외부, 선택)」) reads as its own words before it, whole, with no 「…」: the bracket is the name's gloss, read in
  // the card's hover and keyboard name; the tag's dotted underline (gloss) says there is more, as a code name in brackets reads under the pane's title.
  const g = glossHead(nm);
  if (g) for (const ww of slack > 0 ? [w, w + slack] : [w]) for (const ext of [false, true]) for (const s of steps(WHOLE_MIN_PX)) { const ls = whole(g, scaled(s), ext, ww); if (ls) return { lines: ls, full: false, gloss: true, ...(ww > w ? { tight: true } : {}), ...at(s) }; }
  const trim = (t: string) => t.replace(/[\s·/,，、_:;.-]+$/u, '');
  const words = nameWords(nm);
  // The most whole words first, each at the largest type that holds it (「프로젝트 전환…」 a little smaller before 「프로젝트…」); never a
  // bracket left open (「REST API…」, never 「REST API (Django…」): the words before a bracket are the name's own short form.
  const open = (t: string) => (t.match(/[([{]/g) ?? []).length > (t.match(/[)\]}]/g) ?? []).length;
  for (let k = words.length - 1; k >= 1; k--) { const head = trim(words.slice(0, k).join('')); if (!head || open(head)) continue; for (const s of steps(WORD_MIN_PX)) { const ls = whole(`${head}…`, scaled(s)); if (ls) return { lines: ls, full: false, ...at(s) }; } }
  const first = trim(words[0] ?? nm), more = words.length > 1;
  // In the side room too: with its 「…」 (the cue that the rest of the name is in the hover) before the bare word.
  if (slack > 0) for (const t of more ? [`${first}…`, first] : [first]) for (const s of steps(WORD_MIN_PX)) if (whole(t, scaled(s), true, w + slack)) return { lines: whole(t, scaled(s), true, w + slack)!, full: !more, tight: true, ...at(s) };
  if (more) for (const s of steps(WORD_MIN_PX)) if (scaled(s)(first) <= w + 0.01) return { lines: [first], full: false, ...at(s) };
  // v14 fix 1: the whole name broken where an identifier's words meet (camel), in the side room too, before 「⋯」.
  for (const ww of slack > 0 ? [w, w + slack] : [w]) for (const s of steps(WHOLE_MIN_PX)) { const ls = whole(nm, scaled(s), 'camel', ww); if (ls) return { lines: ls, full: true, ...(ww > w ? { tight: true } : {}), ...at(s) }; }
  return { lines: ['⋯'], full: false, none: true };
}
/** v14 fix 1: a name's own words before the bracket that ends it (「정기 일정(django_q Schedule)」 → 「정기 일정」); null when no bracket ends
 * the name, or nothing of its own (no letter or digit, or a bracket left open) stands before it. */
export function glossHead(name: string): string | null {
  const m = /^(.*?\S)\s*[(（][^()（）]*[)）]\s*$/.exec(name.trim()); if (!m) return null;
  const head = m[1]!.trim(), opens = (head.match(/[([{（]/g) ?? []).length, closes = (head.match(/[)\]}）]/g) ?? []).length;
  return opens === closes && /[\p{L}\p{N}]/u.test(head) ? head : null;
}
/** v12's way of telling alike names apart (a name with its middle left out): kept for what reads it, never drawn on a tag since v14 (it
 * cut a name in its middle). */
export function distinguishing(name: string, others: readonly string[]): string {
  const cs = [...name];
  let p = 0;
  for (const o of others) { const os = [...o]; let i = 0; while (i < cs.length && i < os.length && cs[i] === os[i]) i++; p = Math.max(p, i); }
  if (p < 4) return name;
  while (p > 0 && !/[\s·/._\-:,(]/.test(cs[p - 1]!)) p--;
  const first = (name.match(/^[^\s·/._\-:,(]+/)?.[0] ?? name).slice(0, 8);
  return p <= first.length ? name : `${first}…${cs.slice(p).join('')}`;
}
/** The tags' texts for a set of names at their rooms. v14: each name whole where it can be, else its first whole words (fitTag); two cut
 * names that read alike stay alike (the full name of each in its card's hover and keyboard name): never a middle cut to tell them apart. */
export function fitTags(items: readonly { id: string; name: string; width: number; lines: number; measure?: (s: string) => number; px?: number; slack?: number }[], measure: (s: string) => number): Map<string, TagFit> {
  const out = new Map<string, TagFit>();
  for (const x of items) out.set(x.id, fitTag(x.name, x.width, x.lines, x.measure ?? measure, x.px ?? TAG.name, x.slack ?? 0));
  return out;
}
