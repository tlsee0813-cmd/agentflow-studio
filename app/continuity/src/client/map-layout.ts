/* Map layout for one scope (the whole project, or the inside of one part), from the project's real containment and relations.
 * - Items are the scope's direct children. An expanded item is a frame around its own children; a collapsed one is a node.
 * - Positions are per container ('root' or a parent id): the arrangement of siblings is the same whether the parent is the
 *   scope itself or an expanded frame, so a place set in one view holds in the other. Missing positions use the automatic
 *   arrangement; nothing here overwrites a stored position.
 * - Reading levels: a direct child of the scope is a region (a frame with its name and the first sentence of its note) or a
 *   unit (a card with the same two lines); inside a region parts are compact rows, and a long run of siblings with few links
 *   among them reads as a list. Heights follow the lines a part really needs (two-line names, a state line); text never shrinks. */
import type { StudioView, RelationView } from '../shared/studio.js';
import { bandsOf, type Band } from './map-regions.js';
import { layered, type LNode, type LEdge, type LKind, type LResult, type Channel } from './layered.js';
export type { Channel } from './layered.js';

/** Frames are a little wider than a node so the head keeps its name beside the fold and go-inside controls. */
export const FRAME_MIN_W = 228;
/** NODE_W: a row's width (long names widen it). NODE_H: the least height of a unit card. */
export const NODE_W = 200, NODE_H = 52, UNIT_W = 240, CARD_W = 224, PAD = 14, GAP = 8, COL_GAP = 76, ROW_GAP = 22, GHOST_W = 168, GHOST_H = 34;
/** Head of a group inside a region: one line, or two when the name needs them (names never shrink). */
export const HEAD = 34, HEAD_2 = 52;
/** A planned change line under a part's name in the preview (12px). */
export const PLAN_LINE = 15;
/** Between wrapped columns of one layer (no relation runs between them, so they sit closer than relation layers). */
export const WRAP_GAP = 36;
/** The lane between the wrapped columns of one layer inside a group: room for two routed tracks (map-route's TRACK_GAP). */
export const WRAP_LANE = 24;
/** Between relation layers inside a group: room for converging lines to stay apart. */
export const FLOW_GAP = 44;
/** A list: columns of short rows. */
export const LIST_GAP = 18, LIST_ROW_GAP = 2;
/** Between an open group and a sibling: a lane wide enough for a line to pass between them. */
export const FRAME_GUTTER = 40;
/** Above the 실행 위치 미기록 shelf (map-regions bandsOf, map design v3 2.2): its caption's room. */
export const SHELF_GAP = 64;
/** Beauty v3 (F.3): the layout's target aspect is the window's, quantised so a small resize never lays the map out again. */
export const ASPECTS = [1.4, 1.6, 1.8, 2.0, 2.4] as const;
export const quantAspect = (a: number): number => ASPECTS.reduce((b, x) => (Math.abs(x - a) < Math.abs(b - a) - 1e-9 ? x : b), ASPECTS[0]);
/** The margin past the midpoint between two steps that a window must cross before the layout takes the next step. */
export const ASPECT_HYST = 0.06;
/** The step for a window aspect a, with hysteresis: the step in use (prev) is kept until a is ASPECT_HYST past the midpoint to a
 * neighbouring step, so a one-pixel resize across a midpoint never lays the map out again. */
export function stickyAspect(a: number, prev: number | null | undefined): number {
  const q = quantAspect(a), i = prev == null ? -1 : ASPECTS.indexOf(prev as (typeof ASPECTS)[number]);
  if (i < 0 || q === prev) return q;
  const lo = i > 0 ? (ASPECTS[i - 1]! + ASPECTS[i]!) / 2 - ASPECT_HYST : -Infinity, hi = i < ASPECTS.length - 1 ? (ASPECTS[i]! + ASPECTS[i + 1]!) / 2 + ASPECT_HYST : Infinity;
  return a >= lo && a <= hi ? ASPECTS[i]! : q;
}
/** Beauty v2 B3 (corridor room): a gap that n lines must pass is at least laneRoom(n) wide: LANE_MARGIN clear of the cards on each
 * side and LANE_TRACK between neighbouring lines (map units: at the least card-face zoom, 0.9, about 12.6 and 9 screen pixels; the
 * ruling's six strands need about 64px + stroke on screen). map-route's TRACK_GAP is LANE_TRACK. */
export const LANE_MARGIN = 14, LANE_TRACK = 10;
export const laneRoom = (n: number): number => (n <= 0 ? 0 : 2 * LANE_MARGIN + (n - 1) * LANE_TRACK + 2);
export interface Point { x: number; y: number }
/** layoutScope's extra for a part the readings typed (map design v3 3.3, 5.3): a card of CARD_W, as a unit and as a row inside a
 * group alike, whose name takes one line or two in nameRoom (the name's room beside the glyph, and the fold toggle when it has an
 * inside). shape(nameLines, planned) is its whole height for those lines (planned: the change preview's lines under the name),
 * once, at the near tier's content (the zoom never changes it), with its card-level contact point and its pins (from the card's
 * top; pins by '<relationId>|in' or '<relationId>|out', the relation ends a model portMap row ties to a pin). */
export interface CardShape { h: number; contact: number; pins: Record<string, number>;
  /** From the card's top: the head band's middle, where a reference's port-less ear sits (map design v3 3.6). */
  ear?: number }
export interface TypedCard { nameRoom: number; shape: (nameLines: number, planned: number) => CardShape }
export type Positions = Record<string, Record<string, Point>>;
export const ROOT = 'root';
export type Face = 'unit' | 'row' | 'item';
export interface Box { id: string; x: number; y: number; w: number; h: number; kind: 'node' | 'frame' | 'ghost'; depth: number; container: string; kids: number;
  /** Frames: height of the head row. */
  head: number;
  /** The container-relative place used for this box (stored, or automatic): what a drag starts from and stores. */
  rel: Point;
  /** Nodes: unit (a direct child of the scope), row (inside a group) or item (in a list). Frames: depth 0 is a region. */
  face?: Face;
  /** Frames whose children read as a list. */
  list?: boolean;
  /** A typed card (TypedCard): from its top, where a line meets it when no pin is tied to that line's end (the card-level contact
   * point), and the pins tied to relation ends ('<relationId>|in' / '|out'). */
  contact?: number; pins?: Record<string, number>;
  /** From the box's top: where a reference line's port-less ear sits on the side it leaves (the head band; 3.6). */
  ear?: number }
/** Which face of a card a line end takes (line-grammar portFaces): a side, the top (a control line coming in), the bottom (a
 * control line going out) or the ear (a reference's port-less start on the head band of its side). */
export type PortFace = 'side' | 'top' | 'bottom' | 'ear';
/** agg: at least one end is drawn by a folded ancestor (a summary of inner relations, not a relation of that ancestor). */
export interface Edge { key: string; from: string; to: string; kind: RelationView['kind']; notes: string[]; ids: string[]; agg: boolean;
  /** A line of the scope's spine: the longest directed chain of its parts, drawn on one line (see layoutScope). */
  spine?: boolean;
  /** The faces its two ends take (absent: both sides). The router keeps a top or a bottom only for a route of few turns. */
  faces?: { a: PortFace; b: PortFace };
  /** Beauty v3 review: the ends that took a face only because their side was over its budget (map-route faceOverflow): they meet the
   * face's right two-thirds, so the head's left third stays the control lines' (3.6). */
  overflow?: { a?: boolean; b?: boolean };
  /** A summary stroke that holds both directions between its two ends (line-grammar pairWays, S8): a head at each end; back: the
   * relations that run from its 'to' to its 'from'. */
  both?: boolean; back?: string[];
  /** Beauty v2 B2: the marks at its two ends (line-grammar Head: the head where it arrives, the start where it leaves), so a side with
   * more ends than it has room for may share one port between ends that arrive (or leave) with the same mark. */
  marks?: { head: string; start: string };
  /** Beauty v3 (C): the route the layered layout reserved for this stroke (its tracks in the gaps and its rows through the columns),
   * which the router tries first from the ports it assigns; absent: the router searches. */
  hint?: Channel }
/** heads: over each run of outside partners that belong to the same place, that place once ('밖 · 확장 실행과 연결'). */
export interface GhostHead { key: string; x: number; y: number; w: number; h: number; text: string }
export interface ScopeLayout { boxes: Map<string, Box>; edges: Edge[]; heads: GhostHead[]; bounds: { x: number; y: number; w: number; h: number };
  /** The scope's spine: the longest chain of its direct parts along flows and needs, left to right; the arrangement keeps it
   * on one line. Empty when no two parts are so linked. */
  spine: string[];
  /** The scope's own parts by band (map-regions bandsOf): the 참여자 band on the left, the system boundary on the right, the
   * 실행 위치 미기록 shelf at the bottom; each in its order. Empty lists when nothing is banded. */
  bands: Record<Band, string[]>;
  /** Beauty v3 (C): each scope line's reserved route, keyed '<from>|<to>|<grain>' (siblings of the scope only); empty when the scope's
   * parts were not laid out in layers (a list). */
  channels: Map<string, Channel>;
  /** The scope's columns, each top to bottom (its parts in layers; the unlinked and the shelf are not in them). */
  layers: string[][];
  /** Beauty v4 (P2): each laid part's connected block, and the layout roles the record gives the scope's parts (a participant: the
   * 참여자 band or the record's family 참여; an external system: the boundary band or the type 외부 시스템). */
  blocks: Map<string, number>; roles: Map<string, 'outside' | 'external'> }

interface Measure { w: number; h: number; ox: number; oy: number; head: number; contact?: number; pins?: Record<string, number>; ear?: number }
export const ghostId = (id: string) => `ghost:${id}`;
/** The head over the scope's own boundary end (see placeEnds). */
export const SELF_HEAD = '이 범위';
const GHOST_GAP = 8, RUN_GAP = 14, GHOST_MIN_W = 112, GHOST_MAX_W = 300;
/** Where a partner outside the scope belongs, as the map says it under its name: its own ancestors that are not the scope's
 * (outermost first), else the parent it shares with the scope, else the top of the project (''). Read from the structure only. */
export function ghostContext(v: StudioView, scope: string | null, id: string): string {
  const byId = new Map(v.parts.map(p => [p.id, p])), mine = new Set<string>();
  for (let c = scope ? byId.get(scope) : undefined, g = 0; c && g < 64; c = c.parentId ? byId.get(c.parentId) : undefined, g++) mine.add(c.id);
  const up: string[] = [];
  for (let c = byId.get(byId.get(id)?.parentId ?? ''), g = 0; c && g < 64; c = c.parentId ? byId.get(c.parentId) : undefined, g++) up.unshift(c.id);
  const own = up.filter(x => !mine.has(x));
  return (own.length ? own : up.slice(-1)).map(x => byId.get(x)!.name).join(' › ');
}
/** Lines a text takes in a box of this room: one when it fits whole, else as many as it needs, with the share left for word ends
 * that the other wrapped texts of the map keep. Never capped: the box is as tall as what the browser draws. */
const wrapLines = (need: number, room: number) => (need <= room ? 1 : Math.ceil((need * 1.12 + 6) / Math.max(40, room)));
/** An outside partner's card: its whole name, as wide as the name (at least GHOST_MIN_W, so a short name keeps a target) up to
 * 300px, then wrapping (an identifier may break anywhere), so it is never cut. 12.5px name lines of 17px; padding 6+7, borders 2.
 * Where it belongs reads once over its run (GhostHead). */
export function ghostSize(name: string, measure: TextMeasure = estimate): { w: number; h: number } {
  const need = measure(name, 'item') * 1.02 + 2, chrome = 22, w = Math.min(GHOST_MAX_W, Math.max(GHOST_MIN_W, Math.ceil(need) + chrome));
  return { w, h: Math.max(GHOST_H, 15 + wrapLines(need, w - chrome) * 17) };
}
/** The head over a run of outside partners as styles.css draws it (.ghost-head: 600 11px, 16px lines, letter-spacing .04em = 0.44px
 * after every character), with 4px under it; as wide as its column, wrapping as it needs. Measured in that font and tracking,
 * never through another text's proxy: a proxy that happens to match one system font wraps in another (two lines drawn where one
 * was kept). */
export const HEAD_TRACK = 0.44;
export const headNeed = (text: string, measure: TextMeasure) => measure(text, 'where') + HEAD_TRACK * [...text].length + 2;
const CJK = 'ᄀ-ᇿ㄰-㆏가-힯一-鿿';
const UNITS = new RegExp(`\\s+|[${CJK}]|[^\\s${CJK}]+`, 'g');
/** Lines a caption takes in a column of this width, broken as the browser breaks it (.ghost-head: normal word-break, overflow-wrap
 * anywhere): after spaces and between Hangul or CJK characters, a run longer than a whole line anywhere; greedy, line by line.
 * A total width over the column misses the room left at the end of each line (two long words that do not share a line), so the
 * lines are counted where they really break. A line is full a pixel early, so a measuring tie keeps a line more, never one less. */
export function captionLines(text: string, room: number, measure: TextMeasure = estimate): number {
  const width = (t: string) => (t ? measure(t, 'where') + HEAD_TRACK * [...t].length : 0), fits = (t: string) => width(t.trimEnd()) <= room - 1;
  let lines = 1, line = '';
  for (const unit of text.match(UNITS) ?? []) {
    if (fits(line + unit) || /^\s+$/.test(unit)) { line += unit; continue; } // spaces hang at a line's end
    if (line.trim()) { lines++; line = ''; }
    let rest = unit;
    while (!fits(rest) && rest.length > 1) { let n = 1; while (n < rest.length - 1 && fits(rest.slice(0, n + 1))) n++; lines++; rest = rest.slice(n); }
    line = rest;
  }
  return lines;
}
const headSize = (text: string, w: number, measure: TextMeasure) => 4 + captionLines(text, w, measure) * 16;

/** Rough rendered width of a frame name (13px, semibold): wide for CJK, narrower for Latin. Only decides one or two head lines. */
export function textWidth(text: string): number {
  let w = 0; for (const ch of text) w += /[ᄀ-ᇿ⺀-꓏가-힯豈-﫿＀-￯]/.test(ch) ? 13.4 : /[A-Z@]/.test(ch) ? 8.8 : /[ .,:;'|il!]/.test(ch) ? 4.2 : 7.6;
  return w;
}

/** Rendered width of text: 'node' (13.5px semibold row name), 'head' (15px region or unit name), 'sub' (13px group name),
 * 'note' (12.5px description) or 'where' (600 11px, where outside partners belong; tracking is added by headNeed). The browser
 * passes a canvas measurement in the page's own font; without one, the estimate. */
export type TextMeasure = (text: string, kind: 'node' | 'item' | 'head' | 'sub' | 'note' | 'plan' | 'where' | 'meta') => number;
const SCALE = { node: 13.5 / 13, item: 0.98, head: 15 / 13, sub: 1, note: 12.5 / 13 * 0.92, plan: 12 / 13 * 0.95, where: 11 / 13, meta: 12 / 13 * 0.95 } as const;
const estimate: TextMeasure = (text, kind) => textWidth(text) * SCALE[kind];
/** The first sentence of a note: what a region or unit says about itself on the map. The rest belongs to the selection. */
export function lead(note: string): string {
  const t = note.replace(/\s+/g, ' ').trim(), m = /^(.+?[.!?。])(?=\s|$)/.exec(t);
  return m ? m[1]! : t;
}
/** The note's first sentence as the map shows it: empty when a sibling says the very same sentence (a shared label such as
 * "a real source file" read once per sibling is noise); the full note stays with the selection. */
export function mapLead(v: StudioView, id: string): string {
  const p = v.parts.find(x => x.id === id); if (!p) return '';
  const own = lead(p.note); if (!own) return '';
  const sibs = p.parentId ? v.parts.find(x => x.id === p.parentId)?.childIds ?? [] : v.roots;
  return sibs.some(s => s !== id && lead(v.parts.find(x => x.id === s)?.note ?? '') === own) ? '' : own;
}
/** Long part names widen their card (never the short ones) so the name fits two lines: room beside the name is the card
 * minus its paddings, and with an inside also the fold toggle and the go-inside count. */
export const NODE_MAX_W = 320;
/** A list item's horizontal padding and border without an inside (styles.css .node.item). */
const ITEM_SIDES = 10 + 8 + 2;
const nodeChrome = (kids: boolean, extra = 0) => (kids ? 5 + 22 + 4 + 4 + 58 + 8 + 2 + extra : 13 + 8 + 2);
/** extra: room a part with an inside gives its boundary count beside the name (linkChipW). */
export function nodeWidth(name: string, kids: boolean, measure: TextMeasure = estimate, extra = 0): number {
  // Lines break at word ends, not mid-word: leave a share of each line unused.
  const need = measure(name, 'node') * 1.12 + 8, one = measure(name, 'node') + 2;
  // A name that reads on one line beside the toggle and the way in keeps its one line beside the count too: the card widens.
  if (extra && one <= NODE_W - nodeChrome(kids)) return Math.min(NODE_MAX_W, Math.max(NODE_W, Math.ceil(one) + nodeChrome(kids, extra)));
  const w = need <= (NODE_W - nodeChrome(kids, extra)) * 2 ? NODE_W : Math.min(NODE_MAX_W, Math.ceil(need / 2) + nodeChrome(kids, extra));
  // A name on two lines keeps its longest word whole ('JSContext.eval', never 'JSContext.eva|l'), up to NODE_MAX_W.
  const word = Math.max(0, ...name.split(/\s+/).map(x => measure(x, 'node') + 2));
  return one > w - nodeChrome(kids, extra) && word > w - nodeChrome(kids, extra) ? Math.min(NODE_MAX_W, Math.ceil(word) + nodeChrome(kids, extra) + 4) : w;
}
/** Relations crossing a part's boundary: one end is the part or anything under it (any depth), the other is outside it.
 * Counted from the stored relations only; a plain relation has no direction, so it is neither in nor out. */
export interface Crossing { all: number; in: number; out: number; plain: number }
export function boundaryCounts(v: StudioView): Map<string, Crossing> {
  const byId = new Map(v.parts.map(p => [p.id, p])), m = new Map<string, Crossing>();
  const up = (id: string) => { const out: string[] = []; for (let c = byId.get(id), g = 0; c && g < 64; c = c.parentId ? byId.get(c.parentId) : undefined, g++) out.push(c.id); return out; };
  for (const r of v.relations) {
    const a = up(r.from), b = up(r.to), sa = new Set(a), sb = new Set(b);
    const bump = (id: string, side: 'in' | 'out') => { const c = m.get(id) ?? { all: 0, in: 0, out: 0, plain: 0 }; c.all++; if (r.kind === 'related') c.plain++; else c[side]++; m.set(id, c); };
    for (const id of a) if (!sb.has(id)) bump(id, 'out');
    for (const id of b) if (!sa.has(id)) bump(id, 'in');
  }
  return m;
}
/** The boundary count beside a head's name ('↔ 12', 11px with its border and padding) and the gap before it; 0 when none. */
export const linkChipW = (n: number) => (n > 0 ? 4 + 46 + 6 * String(n).length : 0);
/** A first view over its count budget folds every group with an inside alike (the person's own fold or unfold excepted), so
 * no group reads as singled out by its size; each folded head still says how many relations cross it. */
export function budgetFold(groups: { id: string; size: number }[], own: (id: string) => boolean, budget: number): Set<string> {
  const shown = groups.reduce((n, g) => n + 1 + g.size, 0);
  return new Set(shown <= budget ? [] : groups.filter(g => g.size > 0 && !own(g.id)).map(g => g.id));
}

/** Siblings (direct children of a container) that a relation between their subtrees links to another sibling. */
function linkedSiblings(v: StudioView, ids: string[]): Set<string> {
  const byId = new Map(v.parts.map(p => [p.id, p])), set = new Set(ids), out = new Set<string>();
  const lift = (id: string) => { let cur = byId.get(id), g = 0; while (cur && !set.has(cur.id) && g++ < 64) cur = cur.parentId ? byId.get(cur.parentId) : undefined; return cur && set.has(cur.id) ? cur.id : null; };
  for (const r of v.relations) { const a = lift(r.from), b = lift(r.to); if (a && b && a !== b) { out.add(a); out.add(b); } }
  return out;
}
/** A long run of siblings, mostly without an inside and rarely linked to each other, reads as a list (rows in columns):
 * a command catalogue, a folder of files. Decided from the structure alone. */
export function isListGroup(v: StudioView, container: string | null): boolean {
  const byId = new Map(v.parts.map(p => [p.id, p])), ids = container ? byId.get(container)?.childIds ?? [] : v.roots;
  if (ids.length < 8) return false;
  const leaves = ids.filter(id => !(byId.get(id)?.childIds.length)).length;
  return leaves >= ids.length * 0.7 && linkedSiblings(v, ids).size <= Math.floor(ids.length / 5);
}

/** planned: only while a change preview reads on the map, the lines a part's own row will show under its name (each text it can
 * show; the longest, up to two lines, decides). Only these parts take that room; every other box keeps its current size.
 * aspect: width/height of the window's map (not of what a reading pane leaves of it): the scope's own unlinked parts are set in
 * as many columns as make their block closest to that shape, instead of one tall column.
 * extra: the pixels a unit or row card needs below its own lines for what the readings say of it (its type word, operations
 * line and typed body, drawn by the client); list items never take it. Absent, every card keeps the height its lines give.
 * A unit the readings typed may answer with a TypedCard instead: it is drawn at UNIT_W with its typed lines in place of its
 * note (map spec 2.1: the note reads on selection), and its room is asked with the lines its name takes there. */
export function layoutScope(v: StudioView, scope: string | null, expanded: (id: string, depth: number) => boolean, pos: Positions, measureText: TextMeasure = estimate, planned?: ReadonlyMap<string, readonly string[]>, aspect = 1.6, extra?: (id: string, face: Face) => number | TypedCard, lineOf?: (relationId: string, kind: RelationView['kind']) => string | null): ScopeLayout {
  const more = (id: string, face: Face) => { const x = extra?.(id, face); return typeof x === 'number' ? Math.max(0, x) : 0; };
  const typedCard = (id: string, face: Face = 'unit') => { const x = extra?.(id, face); return x && typeof x === 'object' ? x : null; };
  const byId = new Map(v.parts.map(p => [p.id, p]));
  const kidsOf = (id: string | null) => (id ? byId.get(id)?.childIds ?? [] : v.roots);
  const open = (id: string, depth: number) => depth < 12 && kidsOf(id).length > 0 && expanded(id, depth);
  const memo = new Map<string, Measure & { face?: Face }>();
  const listMemo = new Map<string, boolean>();
  const spines = new Map<string, string[]>();
  const listOf = (container: string | null) => { const k = container ?? ROOT; if (!listMemo.has(k)) listMemo.set(k, isListGroup(v, container)); return listMemo.get(k)!; };
  const names = new Map<string, number>(); for (const p of v.parts) names.set(p.name, (names.get(p.name) ?? 0) + 1);
  // A part with an inside keeps room beside its name for its boundary count.
  const cross = boundaryCounts(v), chip = (id: string) => (kidsOf(id).length ? linkChipW(cross.get(id)?.all ?? 0) : 0);
  // Automatic arrangement of siblings: layered placement over the relations lifted to the siblings (beauty v3, layered.ts).
  const bandOf = new Map<string, Band>();
  let scopeLaid: LResult | null = null; const scopeRoles = new Map<string, 'outside' | 'external'>();
  const autoArrange = (container: string | null, sizes: Map<string, Measure>): Map<string, Point> => {
    // The scope's own outside roles, external systems and lifecycle groups keep to their bands (map-regions): the middle is
    // arranged without them, then they are set beside and under it. A list keeps its own order whole.
    const band = container === scope && !listOf(container) ? bandsOf(v, kidsOf(container)) : new Map<string, Band>();
    for (const [i, b] of band) bandOf.set(i, b);
    const ids = kidsOf(container).filter(i => band.get(i) !== 'shelf'), set = new Set(ids);
    const lift = (id: string) => { let cur = byId.get(id), guard = 0; while (cur && !set.has(cur.id) && guard++ < 64) cur = cur.parentId ? byId.get(cur.parentId) : undefined; return cur && set.has(cur.id) ? cur.id : null; };
    if (listOf(container)) {
      // A list keeps its own order in columns. Rows linked outward sit in the last column and rows linked from outside in the
      // first, so their lines leave the list at its edge instead of running under other rows.
      const outward = new Set<string>(), inward = new Set<string>();
      for (const r of v.relations) { const a = lift(r.from), b = lift(r.to); if (a && !b) outward.add(a); if (b && !a) inward.add(b); }
      const order = [...ids.filter(i => inward.has(i) && !outward.has(i)), ...ids.filter(i => !inward.has(i) && !outward.has(i)), ...ids.filter(i => outward.has(i))];
      const cols = Math.min(4, Math.max(1, Math.ceil(order.length / 8))), per = Math.ceil(order.length / cols);
      const at = new Map<string, Point>(); let x = 0;
      for (let c = 0; c < cols; c++) {
        const col = order.slice(c * per, (c + 1) * per); if (!col.length) break;
        let y = 0; const w = Math.max(...col.map(i => sizes.get(i)!.w));
        for (const i of col) { const sz = sizes.get(i)!; at.set(i, { x: x - sz.ox, y: y - sz.oy }); y += sz.h + LIST_ROW_GAP; }
        x += w + LIST_GAP;
      }
      return at;
    }
    // Beauty v3 (A): the relations lifted to these siblings, one line per pair, direction and stroke grain (lineOf: the channel the
    // map draws the relation in, with its signature), placed by the in-house layered layout (layered.ts). Data and control lines
    // decide the layers in their direction; a reference joins softly; shares and related set no layer but keep their ends near.
    // Participants and external systems are ordinary parts here (B): they sit next to what they link to, with their kind marks.
    const grain = (r: RelationView) => (r.kind === 'shares' || r.kind === 'related' ? r.kind : lineOf?.(r.id, r.kind) ?? (r.kind === 'flow' ? 'data' : 'uses'));
    const lk = new Map<string, LEdge>();
    for (const r of v.relations) {
      const a = lift(r.from), b = lift(r.to); if (!a || !b || a === b) continue;
      const g = grain(r), key = `${a}|${b}|${g}`, ch = g.split(/[~^]/)[0];
      const kind: LKind = r.kind === 'shares' || r.kind === 'related' ? 'plain' : ch === 'data' || ch === 'control' ? 'drive' : 'ref';
      (lk.get(key) ?? lk.set(key, { key, from: a, to: b, kind, weight: 1, relIds: [], ...(ch === 'control' ? { control: true } : {}) }).get(key)!).relIds.push(r.id);
    }
    const lines = [...lk.values()], linked = new Set(lines.flatMap(e => [e.from, e.to]));
    // A part the scope's outside refers to and nothing inside links (a shared definition) opens the scope's order, as rows linked
    // from outside open a list: its outside partners then sit beside it. The order is the scope's own; nothing here depends on
    // what is selected, and a stored position still wins.
    const fromOut = container !== null && container === scope ? ids.filter(i => !linked.has(i) && v.relations.some(r => lift(r.to) === i && !lift(r.from))) : [];
    const lone = ids.filter(i => !linked.has(i) && !fromOut.includes(i)), inFrame = container !== scope;
    const maxPer = Math.max(4, Math.min(8, Math.ceil(Math.sqrt(ids.length * 1.3))));
    const wrap = (c: string[]) => { if (c.length <= maxPer) return [c]; const per = Math.ceil(c.length / Math.ceil(c.length / maxPer)), o: string[][] = []; for (let i = 0; i < c.length; i += per) o.push(c.slice(i, i + per)); return o; };
    const colW = (c: string[]) => Math.max(...c.map(i => sizes.get(i)!.w)), colH = (c: string[]) => c.reduce((a, i) => a + sizes.get(i)!.h, 0) + ROW_GAP * (c.length - 1);
    const gapY = inFrame ? GAP : ROW_GAP, colGap = inFrame ? FLOW_GAP : COL_GAP;
    // An open group beside or under another sibling keeps a lane (FRAME_GUTTER) so lines can pass between them instead of under one.
    const isFrame = (i: string) => sizes.get(i)!.head > 0, pairGap = (p: string, q: string) => (isFrame(p) || isFrame(q) ? Math.max(gapY, FRAME_GUTTER) : gapY);
    const at = new Map<string, Point>();
    const put = (i: string, x: number, y: number) => { const sz = sizes.get(i)!; at.set(i, { x: x - sz.ox, y: y - sz.oy }); };
    const rank = new Map(ids.map((i, k) => [i, k]));
    // A store as the record says it (its family, else its type): read back by the part that writes it, it sits after that part.
    const isStore = (i: string) => { const r = byId.get(i)?.reading; return (r?.familyRead?.family ?? (r?.typeRead?.type === 'store' ? 'store' : null)) === 'store'; };
    // Beauty v4 (P1, P2): a participant as the record says it (the 참여자 band, or its family 참여 in the record) reads before what it calls;
    // an external system (the boundary band, or its type 외부 시스템) sits past the system's last layer.
    const familyOf = (i: string) => byId.get(i)?.reading?.familyRead?.family ?? null, typeOf = (i: string) => byId.get(i)?.reading?.typeRead?.type ?? null;
    const roleOf = (i: string, b: Band | undefined): 'outside' | 'external' | 'store' | null => (b === 'boundary' || (container === scope && typeOf(i) === 'external' && !kidsOf(i).length) ? 'external'
      : b === 'outside' || familyOf(i) === 'participant' ? 'outside' : isStore(i) ? 'store' : null);
    const lnodes: LNode[] = ids.filter(i => linked.has(i)).map(i => {
      const s = sizes.get(i)!, b = band.get(i);
      return { id: i, w: s.w, h: s.h, order: rank.get(i)!, anchor: s.head > 0 ? s.head / 2 : s.contact ?? s.h / 2, ...(s.pins ? { pins: s.pins } : {}), role: roleOf(i, b), ...(s.head > 0 ? { gutter: FRAME_GUTTER, side: s.head } : {}) };
    });
    let flowW = 0, flowH = 0, lastFrame = false;
    if (lnodes.length) {
      const L = layered(lnodes, lines, { layerGap: colGap, rowGap: gapY, laneMargin: LANE_MARGIN, laneTrack: LANE_TRACK, aspect: quantAspect(aspect), wrapGap: inFrame ? WRAP_LANE : WRAP_GAP, blockGap: inFrame ? GAP * 2 : ROW_GAP * 2, spend: !inFrame });
      // Inside a group a plain chain (one part per layer, all of them linked into one) runs top to bottom, as a list of steps; separate
      // chains keep their own blocks (never read as one list).
      const root = new Map(lnodes.map(n => [n.id, n.id])), find = (i: string): string => { let r = i; while (root.get(r) !== r) r = root.get(r)!; return r; };
      for (const e of lines) if (root.has(e.from) && root.has(e.to)) root.set(find(e.from), find(e.to));
      const oneChain = new Set(lnodes.map(n => find(n.id))).size === 1;
      if (inFrame && oneChain && L.order.every(c => c.length === 1)) {
        let x = 0;
        for (const c of wrap(L.order.map(c => c[0]!))) { let y = 0; c.forEach((i, k) => { if (k) y += pairGap(c[k - 1]!, i); put(i, x, y); y += sizes.get(i)!.h; }); x += colW(c) + GAP; flowW = Math.max(flowW, x - GAP); flowH = Math.max(flowH, y); }
      } else {
        for (const [i, p] of L.pos) put(i, p.x, p.y);
        flowW = L.size.w; flowH = L.size.h; lastFrame = (L.order.at(-1) ?? []).some(isFrame);
        if (container === scope) { scopeLaid = L; for (const n of lnodes) if (n.role === 'outside' || n.role === 'external') scopeRoles.set(n.id, n.role); }
      }
      if (container === scope || container === null) spines.set(container ?? ROOT, L.spine);
    }
    if (fromOut.length) {
      // Left of the arranged block, in the scope's order.
      const w = colW(fromOut); let y = 0;
      for (const i of fromOut) { put(i, -colGap - w, y); y += sizes.get(i)!.h + gapY; }
    }
    const need = (W: number, H: number) => Math.max(W, H * aspect);
    let side = wrap(lone), below: string[][] | null = null;
    if (!inFrame && lone.length) {
      let score = Infinity;
      for (let per = 1; per <= lone.length; per++) {
        const cs: string[][] = []; for (let i = 0; i < lone.length; i += per) cs.push(lone.slice(i, i + per));
        const sc = need(flowW + cs.reduce((a, x) => a + colW(x), 0) + WRAP_GAP * (cs.length - 1), Math.max(flowH, ...cs.map(colH)));
        if (sc < score - 1e-6) { score = sc; side = cs; }
      }
      if (lnodes.length) {
        // Rows under the linked block are a grid: one cell width (the widest unlinked part), so the rows' left edges line up.
        const cell = Math.max(...lone.map(i => sizes.get(i)!.w)), room = Math.max(flowW - WRAP_GAP, cell), rows: string[][] = [];
        const per = Math.max(1, Math.floor((room + WRAP_GAP) / (cell + WRAP_GAP)));
        for (let i = 0; i < lone.length; i += per) rows.push(lone.slice(i, i + per));
        const rowH = (r: string[]) => Math.max(...r.map(i => sizes.get(i)!.h));
        const sc = need(Math.max(flowW - WRAP_GAP, room), flowH + ROW_GAP * 2 + rows.reduce((a, r) => a + rowH(r), 0) + ROW_GAP * (rows.length - 1));
        if (sc < score - 1e-6) below = rows;
      }
    }
    // The scope's own unlinked parts: no order between them to keep, so they go where the whole block needs the least zoom in a
    // window of this shape: as columns beside the linked blocks, or in rows under them (never inside a relation layer, which
    // would read as a step). Parts inside a group keep their one readable column.
    if (below) {
      let y = flowH + ROW_GAP * 2;
      for (const r of below) {
        const cell = Math.max(...lone.map(i => sizes.get(i)!.w));
        let rx = 0; for (const i of r) { put(i, rx, y); rx += cell + WRAP_GAP; }
        y += Math.max(...r.map(i => sizes.get(i)!.h)) + ROW_GAP;
      }
    } else if (lone.length) {
      let x = lnodes.length ? flowW + colGap : 0;
      // A side column beside an open group keeps the lane too.
      if (lnodes.length && (lastFrame || side[0]!.some(isFrame))) x += Math.max(0, FRAME_GUTTER - colGap);
      side.forEach(c => {
        const w = colW(c); let y = 0;
        c.forEach((i, k) => { if (k) y += pairGap(c[k - 1]!, i); put(i, x, y); y += sizes.get(i)!.h; });
        x += w + (inFrame ? GAP : WRAP_GAP);
      });
    }
    if (band.size) placeBands(band, at, sizes);
    return at;
  };
  /** The 실행 위치 미기록 shelf (map design v3 2.2): the lifecycle groups in a row under everything, in the scope's order. Beauty v3 (B):
   * the 참여자 band and the system boundary are no longer columns of their own; their parts sit next to what they link to. */
  const placeBands = (band: Map<string, Band>, at: Map<string, Point>, sizes: Map<string, Measure>) => {
    const box = (i: string) => { const p = at.get(i)!, z = sizes.get(i)!; return { x: p.x + z.ox, y: p.y + z.oy, w: z.w, h: z.h }; };
    const shelf = kidsOf(scope).filter(i => band.get(i) === 'shelf'); if (!shelf.length) return;
    const all = [...at.keys()].map(box), bottom = all.length ? Math.max(...all.map(b => b.y + b.h)) : 0, left = all.length ? Math.min(...all.map(b => b.x)) : 0;
    let x = left; for (const i of shelf) { const z = sizes.get(i)!; at.set(i, { x: x - z.ox, y: bottom + SHELF_GAP - z.oy }); x += z.w + WRAP_GAP; }
  };
  const autoMemo = new Map<string, Map<string, Point>>();
  const anchors = (container: string | null, depth: number) => {
    const ids = kidsOf(container), sizes = new Map(ids.map(i => [i, measure(i, depth, container)]));
    const mk = container ?? ROOT, auto = autoMemo.get(mk) ?? autoMemo.set(mk, autoArrange(container, sizes)).get(mk)!, stored = pos[container ?? ROOT] ?? {};
    return { sizes, at: new Map(ids.map(i => [i, stored[i] ? { ...stored[i]! } : auto.get(i)!])) };
  };
  const hasRecords = (id: string, guard = 0): boolean => { const p = byId.get(id); return !!p && guard < 64 && (!!p.lastAt || p.childIds.some(c => hasRecords(c, guard + 1))); };
  // Korean text breaks between words (keep-all): leave a share of each line unused.
  // A text that fits whole on one line, as measured in its own font, takes one line (the browser lays it out with the same
  // measure; they agree to within hundredths of a pixel). Only a text that must wrap keeps the share left for word ends.
  const lines = (text: string, kind: Parameters<TextMeasure>[1], room: number, max = 2) => {
    if (!text) return 0;
    const w = measureText(text, kind);
    if (w + 0.25 <= room) return 1;
    return Math.min(max, Math.max(2, Math.ceil((w * 1.15 + 6) / Math.max(40, room))));
  };
  // Planned lines are short phrases measured in their own font: a smaller share is left for word ends than for notes.
  const plannedLines = (id: string, room: number) => Math.max(0, ...(planned?.get(id) ?? []).map(t => Math.min(2, Math.ceil((measureText(t, 'plan') * 1.06 + 4) / Math.max(40, room)))));
  // A folded part standing for a planned part inside it reads one line naming that inner part.
  const plannedInside = (id: string) => !!planned && [...planned.keys()].some(k => { for (let p = byId.get(k)?.parentId, g = 0; p && g < 64; p = byId.get(p)?.parentId, g++) if (p === id) return true; return false; });
  const nodeLines = (id: string, room: number) => plannedLines(id, room) || (plannedInside(id) ? 1 : 0);
  /** Region head: the name (one or two lines; a longer name widens the region rather than being cut) and the first sentence of
   * the note under it. Head row: toggle 28, go-inside ~44, paddings ~12, and the latest-record time ~52 when there is one. */
  const regionHead = (id: string, w: number): { w: number; head: number } => {
    const p = byId.get(id)!, room = (x: number) => x - 102 - (hasRecords(id) ? 52 : 0) - chip(id), chrome = w - room(w);
    // A region keeps its name on one line when it can (up to 320px), and on two lines otherwise (up to 380px).
    const need = measureText(p.name, 'head') * 1.08 + 4;
    if (need > room(w)) w = Math.max(w, Math.min(320, Math.ceil(need) + chrome));
    if (need > room(w) * 2) w = Math.max(w, Math.min(380, Math.ceil(need / 2) + chrome + 12));
    // The note runs under the whole head row; a region widens (up to 340px) rather than cut its sentence after two lines.
    const note = mapLead(v, id), noteNeed = note ? measureText(note, 'note') * 1.15 + 6 : 0;
    if (noteNeed > (w - 44) * 2) w = Math.max(w, Math.min(340, Math.ceil(noteNeed / 2) + 44));
    const nl = need > room(w) ? 2 : 1, ll = lines(note, 'note', w - 44), pl = plannedLines(id, room(w));
    // In a preview the planned lines sit under the name in place of the note (hidden there); the head never shrinks.
    return { w, head: 12 + nl * 22 + Math.max(ll ? 3 + ll * 17 : 0, pl ? 3 + pl * PLAN_LINE : 0) + 14 };
  };
  /** Group head inside a region: its name only. A name keeps one line when the group can widen to hold it (up to 300px, as a
   * region keeps its own up to 320px); else it takes a second line, broken between words (styles.css: keep-all), the group
   * widening (up to 360px) so its longest word fits a line and no last letter is left alone. */
  const groupHead = (id: string, w: number): { w: number; head: number } => {
    const name = byId.get(id)?.name ?? '', need = measureText(name, 'sub') * 1.08, room = (x: number) => x - 88 - (hasRecords(id) ? 52 : 0) - chip(id), chrome = w - room(w);
    if (need > room(w) && need + chrome <= 300) w = Math.ceil(need + chrome);
    if (need > room(w) * 2) w = Math.max(w, Math.min(360, Math.ceil(need / 2) + chrome + 12));
    const word = Math.max(0, ...name.split(/\s+/).map(x => measureText(x, 'sub') * 1.08));
    if (need > room(w) && word > room(w)) w = Math.max(w, Math.min(360, Math.ceil(word) + chrome + 4));
    const pl = plannedLines(id, room(w));
    return { w, head: (need > room(w) ? HEAD_2 : HEAD) + (pl ? 3 + pl * PLAN_LINE : 0) };
  };
  function measure(id: string, depth: number, container: string | null): Measure & { face?: Face } {
    const cached = memo.get(id); if (cached) return cached;
    const p = byId.get(id)!, kids = kidsOf(id).length > 0, extraW = chip(id), chrome = nodeChrome(kids, extraW);
    // The extra line under a name: the state when there is one, else the parent beside a name that repeats in the project.
    const extra = p.status !== 'plan' || !!p.reading?.state || (names.get(p.name) ?? 0) > 1 ? 1 : 0;
    let m: Measure & { face?: Face };
    if (open(id, depth)) {
      const { sizes, at } = anchors(id, depth + 1);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [k, q] of at) { const s = sizes.get(k)!; minX = Math.min(minX, q.x + s.ox); minY = Math.min(minY, q.y + s.oy); maxX = Math.max(maxX, q.x + s.ox + s.w); maxY = Math.max(maxY, q.y + s.oy + s.h); }
      const { w, head } = (depth === 0 ? regionHead : groupHead)(id, Math.max(maxX - minX + PAD * 2, FRAME_MIN_W));
      m = { ox: minX, oy: minY, w, h: maxY - minY + head + PAD, head };
    } else if (listOf(container)) {
      // Planned lines keep the item's own padding (7 above and below), for one line as for two.
      // A list item's own sides (styles.css .node.item: 10 + 8 padding, 1 + 1 border) are narrower than a row's: its name's
      // room is measured with them, so a name that fits on one line is not given a second, empty one.
      const w = nodeWidth(p.name, kids, measureText, extraW), room = w - (kids ? chrome : ITEM_SIDES), nl = lines(p.name, 'item', room, 3), pl = nodeLines(id, room);
      m = { w, h: Math.max(14 + (nl + extra) * 17, pl ? 14 + nl * 17 + 2 + pl * PLAN_LINE : 0), ox: 0, oy: 0, head: 0, face: 'item' };
    } else if (typedCard(id, depth === 0 ? 'unit' : 'row')) {
      // A typed card (unit or row alike): CARD_W wide, its name on one line or two, its height its near content's (fixed).
      const face: Face = depth === 0 ? 'unit' : 'row', t = typedCard(id, face)!, need = measureText(p.name, 'head') * 1.06 + 2;
      const nl = need > t.nameRoom ? 2 : 1, pl = nodeLines(id, t.nameRoom), s = t.shape(nl, pl ? 3 + pl * PLAN_LINE : 0);
      m = { w: CARD_W, h: s.h, ox: 0, oy: 0, head: 0, face, contact: s.contact, pins: s.pins, ...(s.ear !== undefined ? { ear: s.ear } : {}) };
    } else if (depth === 0) {
      // A folded group reads by its name and count; its note is the selection's. A part without an inside keeps its sentence.
      const note = kids ? '' : mapLead(v, id), need = measureText(p.name, 'head') * 1.1 + 6;
      let w = note ? UNIT_W : NODE_W;
      // A folded group's name keeps one line when a card up to NODE_MAX_W holds it beside its count and the way in.
      if (kids && need > w - chrome && need <= NODE_MAX_W - chrome) w = Math.ceil(need) + chrome;
      if (need > (w - chrome) * 2) w = Math.min(NODE_MAX_W + 40, Math.ceil(need / 2) + chrome);
      // Lines break between words: a name on two lines keeps its longest word whole ('JSContext.eval', never 'JSContext.eva|l').
      const word = Math.max(0, ...p.name.split(/\s+/).map(x => measureText(x, 'head') * 1.1));
      if (need > w - chrome && word > w - chrome) w = Math.min(NODE_MAX_W + 40, Math.max(w, Math.ceil(word) + chrome + 4));
      const nl = need > w - chrome ? (need > (w - chrome) * 2 ? 3 : 2) : 1, ll = lines(note, 'note', w - chrome), pl = nodeLines(id, w - chrome);
      m = { w, h: Math.max(NODE_H, 24 + nl * 20 + (ll ? 2 + ll * 17 : 0) + extra * 19, pl ? 24 + nl * 20 + 3 + pl * PLAN_LINE : 0) + more(id, 'unit'), ox: 0, oy: 0, head: 0, face: 'unit' };
    } else {
      // Planned lines keep the row's own padding (10 above and below): this row only, for one line as for two.
      const w = nodeWidth(p.name, kids, measureText, extraW), nl = lines(p.name, 'node', w - chrome, 3), pl = nodeLines(id, w - chrome);
      m = { w, h: Math.max(20 + (nl + extra) * 18, pl ? 20 + nl * 18 + 2 + pl * PLAN_LINE : 0) + more(id, 'row'), ox: 0, oy: 0, head: 0, face: 'row' };
    }
    memo.set(id, m); return m;
  }
  const boxes = new Map<string, Box>();
  const place = (id: string, anchor: Point, rel: Point, depth: number, container: string | null) => {
    const m = measure(id, depth, container), kids = kidsOf(id).length, isOpen = open(id, depth);
    boxes.set(id, { id, x: anchor.x + m.ox, y: anchor.y + m.oy, w: m.w, h: m.h, kind: isOpen ? 'frame' : 'node', depth, container: container ?? ROOT, kids, rel, head: m.head,
      ...(isOpen ? { list: listOf(id) } : { face: m.face ?? 'row', ...(m.contact !== undefined ? { contact: m.contact, pins: m.pins ?? {} } : {}), ...(m.ear !== undefined ? { ear: m.ear } : {}) }) });
    if (!isOpen) return;
    const { at } = anchors(id, depth + 1);
    // One column of rows fills the group's width, so a region widened for its name or note keeps an even edge.
    const single = !listOf(id) && new Set([...at.values()].map(q => q.x)).size === 1;
    for (const [k, p] of at) {
      place(k, { x: anchor.x + PAD + p.x, y: anchor.y + m.head + p.y }, p, depth + 1, id);
      const kb = boxes.get(k)!; if (single && kb.kind === 'node') kb.w = Math.max(kb.w, m.w - PAD * 2);
    }
  };
  const top = anchors(scope, 0);
  for (const [k, p] of top.at) place(k, p, p, 0, scope);

  // Visible representative of any part: itself or its nearest visible ancestor; null when outside this scope.
  const rep = (id: string): string | null => { let cur = byId.get(id), guard = 0; while (cur && guard++ < 64) { if (boxes.has(cur.id)) return cur.id; cur = cur.parentId ? byId.get(cur.parentId) : undefined; } return null; };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes.values()) { minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
  if (!boxes.size) { minX = minY = 0; maxX = maxY = 0; }
  // Relations: drawn between representatives; a partner outside the scope is a small ghost at the side (incoming left, outgoing right).
  const spine = spines.get(scope ?? ROOT) ?? [], spineIdx = new Map(spine.map((id, i) => [id, i]));
  const spineStep = (a: string, b: string, kind: RelationView['kind']) => { const i = spineIdx.get(a), j = spineIdx.get(b); return i !== undefined && j !== undefined && (kind === 'flow' || kind === 'needs') && j === i + 1; };
  const edges = new Map<string, Edge>(), ghostsIn: string[] = [], ghostsOut: string[] = [];
  for (const r of v.relations) {
    let a = rep(r.from), b = rep(r.to);
    if (!a && !b) continue;
    if (!a) { a = ghostId(r.from); if (!ghostsIn.includes(r.from)) ghostsIn.push(r.from); }
    if (!b) { b = ghostId(r.to); if (!ghostsOut.includes(r.to)) ghostsOut.push(r.to); }
    if (a === b) continue;
    const key = `${a}|${b}|${r.kind}`, e = edges.get(key) ?? { key, from: a, to: b, kind: r.kind, notes: [], ids: [], agg: false };
    if (r.note) e.notes.push(r.note); e.ids.push(r.id);
    // The spine's own steps: a flow or a need between two of its neighbours.
    if (spineStep(a, b, r.kind)) e.spine = true;
    if ((a !== r.from && a !== ghostId(r.from)) || (b !== r.to && b !== ghostId(r.to))) e.agg = true;
    edges.set(key, e);
  }
  // A partner outside the scope reads by its own name under where it belongs, and sits next to the parts it actually meets, on
  // the free side nearest to them (outgoing to the right first, incoming to the left first). Placing it never moves a part;
  // without a free lane beside them it keeps the scope's edge as before.
  const size = new Map(ghostsIn.concat(ghostsOut).map(id => [id, ghostSize(byId.get(id)?.name ?? '', measureText)]));
  const heads: GhostHead[] = [];
  const placeEnds = (list: string[], out: boolean, fallbackX: number) => {
    if (!list.length) return;
    // Partners that belong to the same place run together under one head, in the order the place first appears.
    // The scope itself (the end of a relation between it and one of its own parts) is this scope's boundary, not a part outside
    // it: it reads as '이 범위', in a run of its own. Decided by id: another part with the same name stays outside.
    const where = new Map(list.map(id => [id, id === scope ? SELF_HEAD : `밖 · ${ghostContext(v, scope, id) || '최상위'}`])), runs = [...new Set(where.values())];
    const ids = runs.flatMap(t => list.filter(id => where.get(id) === t));
    const near = [...new Set([...edges.values()].filter(e => ids.some(g => (out ? e.to : e.from) === ghostId(g))).map(e => (out ? e.from : e.to)))].map(id => boxes.get(id)).filter((b): b is Box => !!b);
    const colW = Math.max(...ids.map(id => size.get(id)!.w), ...runs.map(t => Math.min(GHOST_MAX_W, Math.ceil(headNeed(t, measureText)))));
    const headH = new Map(runs.map(t => [t, headSize(t, colW, measureText)]));
    const colH = ids.reduce((a, id) => a + size.get(id)!.h + GHOST_GAP, 0) - GHOST_GAP + runs.reduce((a, t) => a + headH.get(t)!, 0) + RUN_GAP * (runs.length - 1);
    const cy = near.length ? (Math.min(...near.map(b => b.y)) + Math.max(...near.map(b => b.y + Math.min(b.h, 120)))) / 2 : minY + colH / 2;
    const y = Math.max(minY, cy - colH / 2);
    // Every box placed so far (the other side's column of outside partners included) and the heads over those columns.
    const col = endColumnX({ out, near, colW, y, colH, taken: [...boxes.values(), ...heads], fallbackX });
    const x = col.x, leftOf = near.length > 0 && x < near[0]!.x;
    let at = col.found ? y : minY;
    for (const t of runs) {
      heads.push({ key: `${out ? 'out' : 'in'}|${t}`, x, y: at, w: colW, h: headH.get(t)!, text: t }); at += headH.get(t)!;
      for (const id of ids.filter(i => where.get(i) === t)) {
        const { w, h } = size.get(id)!; // a column left of its parts keeps its lines' ends even
        boxes.set(ghostId(id), { id: ghostId(id), x: leftOf ? x + colW - w : x, y: at, w, h, kind: 'ghost', depth: 0, container: '', kids: 0, rel: { x: 0, y: 0 }, head: 0 });
        at += h + GHOST_GAP;
      }
      at += RUN_GAP - GHOST_GAP;
    }
  };
  placeEnds(ghostsIn.filter(id => !ghostsOut.includes(id)), false, minX - 90);
  placeEnds(ghostsOut, true, maxX + 90);
  let bx = Infinity, by = Infinity, bx2 = -Infinity, by2 = -Infinity;
  for (const b of [...boxes.values(), ...heads]) { bx = Math.min(bx, b.x); by = Math.min(by, b.y); bx2 = Math.max(bx2, b.x + b.w); by2 = Math.max(by2, b.y + b.h); }
  if (!boxes.size) { bx = by = bx2 = by2 = 0; }
  const bands: Record<Band, string[]> = { outside: [], boundary: [], shelf: [] };
  for (const id of kidsOf(scope)) { const b = bandOf.get(id); if (b && boxes.has(id)) bands[b].push(id); }
  // A reserved route belongs to the automatic arrangement: a line with an end the person has placed (stored or held away from where
  // the arrangement put it) searches its own route.
  const own = scope ?? ROOT, autoAt = autoMemo.get(own), placed = pos[own] ?? {};
  const moved = (id: string | undefined) => { const s = id ? placed[id] : undefined, a = id ? autoAt?.get(id) : undefined; return !!s && (!a || Math.abs(s.x - a.x) > 0.5 || Math.abs(s.y - a.y) > 0.5); };
  const channels = new Map([...((scopeLaid as LResult | null)?.channels ?? new Map<string, Channel>())].filter(([k]) => { const [a, b] = k.split('|'); return !moved(a) && !moved(b); }));
  return { boxes, edges: [...edges.values()], heads, bounds: { x: bx, y: by, w: bx2 - bx, h: by2 - by }, spine, bands, channels, layers: (scopeLaid as LResult | null)?.order ?? [], blocks: (scopeLaid as LResult | null)?.block ?? new Map(), roles: scopeRoles };
}

/** Where a column of outside partners goes (the parts it meets: near): beside them on the free side nearest to them (outgoing to
 * the right first, incoming to the left first). Free: no box or head already placed (the other side's column included) within 24px
 * across and 12px along. With neither side free, the column goes past everything placed on its own side (outgoing: 90px right of
 * the rightmost thing placed, at least fallbackX; incoming: 90px left of the leftmost, at most fallbackX − its width), so two
 * columns never share an x; found: false then (the column starts at the top). */
export function endColumnX(c: { out: boolean; near: readonly { x: number; y: number; w: number; h: number }[]; colW: number; y: number; colH: number;
  taken: readonly { x: number; y: number; w: number; h: number }[]; fallbackX: number }): { x: number; found: boolean } {
  const { out, near, colW, y, colH, taken } = c;
  const free = (x: number) => taken.every(b => b.x > x + colW + 24 || b.x + b.w < x - 24 || b.y > y + colH + 12 || b.y + b.h < y - 12);
  const right = near.length ? Math.max(...near.map(b => b.x + b.w)) + 90 : NaN, left = near.length ? Math.min(...near.map(b => b.x)) - 90 - colW : NaN;
  const found = (out ? [right, left] : [left, right]).find(x => Number.isFinite(x) && free(x));
  if (found !== undefined) return { x: found, found: true };
  if (!taken.length) return { x: c.fallbackX - (out ? 0 : colW), found: false };
  return out ? { x: Math.max(c.fallbackX, Math.max(...taken.map(b => b.x + b.w)) + 90), found: false }
    : { x: Math.min(c.fallbackX - colW, Math.min(...taken.map(b => b.x)) - 90 - colW), found: false };
}
/** The union of rectangles (null for none): what is drawn, measured, for 전체 보기. */
export function unionRect(rs: readonly { x: number; y: number; w: number; h: number }[]): { x: number; y: number; w: number; h: number } | null {
  const ok = rs.filter(r => [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w >= 0 && r.h >= 0);
  if (!ok.length) return null;
  const x = Math.min(...ok.map(r => r.x)), y = Math.min(...ok.map(r => r.y));
  return { x, y, w: Math.max(...ok.map(r => r.x + r.w)) - x, h: Math.max(...ok.map(r => r.y + r.h)) - y };
}

/** Rounded orthogonal path through points (corners of radius up to r). */
export function rounded(pts: Point[], r = 8): string {
  const p = pts.filter((q, i) => i === 0 || Math.abs(q.x - pts[i - 1]!.x) + Math.abs(q.y - pts[i - 1]!.y) > 0.5);
  let d = `M${p[0]!.x},${p[0]!.y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const A = p[i - 1]!, B = p[i]!, C = p[i + 1]!;
    const r1 = Math.min(r, Math.hypot(B.x - A.x, B.y - A.y) / 2, Math.hypot(C.x - B.x, C.y - B.y) / 2);
    const u = (P: Point, Q: Point) => { const l = Math.hypot(Q.x - P.x, Q.y - P.y) || 1; return { x: (Q.x - P.x) / l, y: (Q.y - P.y) / l }; };
    const ua = u(B, A), uc = u(B, C);
    d += ` L${B.x + ua.x * r1},${B.y + ua.y * r1} Q${B.x},${B.y} ${B.x + uc.x * r1},${B.y + uc.y * r1}`;
  }
  const last = p[p.length - 1]!; return `${d} L${last.x},${last.y}`;
}

/** Edge path between two boxes. A group end meets the group at its head row (the group's port), never beside an inner part.
 * The plain line (out of a side, along the middle of the gap, into the other side) is kept when it crosses nothing; when it
 * would pass under an unrelated part or group, the line takes an outside corridor through the gaps (out from the side, along a
 * free row gap, into the other side).
 * Frames are obstacles like parts, except the frames around either end (the line has to reach inside them, but not across their
 * heads) and the inside of a frame end. A corridor keeps LANE_CLEAR from every obstacle, so the hairline between two stacked
 * rows is not a lane. clear: the path crosses no obstacle (the plain line kept when no way round is found is not clear). */
export const LANE_CLEAR = 3;
/** The y where a line meets a side of either end (its port), set by the router so lines meeting one part spread along its side;
 * without one, the middle of the part (of a group's head). */
export interface Ports { a?: number; b?: number }
/** pts: the corners of an orthogonal route (every route is one, apart from the straight vertical between stacked neighbours,
 * whose two points are given as well), for the router to nudge parallel runs apart. */
export interface Route { d: string; mx: number; my: number; detour?: boolean; clear: boolean; pts: Point[] }
export function edgePath(a: Box, b: Box, others: Iterable<Box> = [], ports: Ports = {}): Route {
  const all = [...others], byId = new Map(all.map(o => [o.id, o]));
  const within = (o: Box, f: Box) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
  // What a line must not cross: other parts and groups, except the groups around either end and the inside of a group end.
  // The head of a group around an end still is one: a line reaches its part through the group's body, never over its name.
  type Rect = { x: number; y: number; w: number; h: number };
  const blocks: Rect[] = all.filter(o => o !== a && o !== b && !(o.kind === 'frame' && (within(a, o) || within(b, o))) && !(a.kind === 'frame' && within(o, a)) && !(b.kind === 'frame' && within(o, b)));
  for (const o of all) if (o.kind === 'frame' && o !== a && o !== b && o.head > 0 && (within(a, o) || within(b, o))) blocks.push({ x: o.x, y: o.y, w: o.w, h: o.head });
  // The groups around either end are not in the way (the line reaches its part through them), but their edges are: a run laid
  // along a group's border reads as that border, so a corridor keeps LANE_CLEAR off it (crossing it is fine). The plain line
  // (m < 0) is not held to it: going round would read worse than a short run on the edge.
  const rims: Rect[] = all.filter(o => o.kind === 'frame' && o !== a && o !== b && (within(a, o) || within(b, o)));
  const segFree = (x1: number, y1: number, x2: number, y2: number, m = LANE_CLEAR) => !blocks.some(o => Math.max(x1, x2) > o.x - m && Math.min(x1, x2) < o.x + o.w + m && Math.max(y1, y2) > o.y - m && Math.min(y1, y2) < o.y + o.h + m) && (m < 0 || offRims(rims, x1, y1, x2, y2, m));
  const free = (pts: Point[]) => pts.every((p, i) => !i || segFree(pts[i - 1]!.x, pts[i - 1]!.y, p.x, p.y, -1));
  const portY = (x: Box, p?: number) => p ?? (x.kind === 'frame' ? x.y + x.head / 2 : x.contact !== undefined ? x.y + x.contact : x.y + x.h / 2);
  // One end holds the other (a group and a part or group inside it): the line leaves the group under its head and runs down the
  // group's own margin to the side of the inner end (its head row when it is a group), so it never crosses a head or the parts
  // between them. Reversed when the inner end is where the line starts.
  // What lies between them inside the group is in the way: every box inside it but the inner end and the groups that hold the
  // inner end, whose heads are in the way all the same. When that margin route would cross one, the line takes the gaps inside
  // the group instead (from under its head, into a side of the inner end, or a part's top or bottom).
  const outer = a.kind === 'frame' && within(b, a) ? a : b.kind === 'frame' && within(a, b) ? b : null;
  if (outer) {
    const inner = outer === a ? b : a, lx = outer.x + PAD / 2, top = outer.y + outer.head, iy = Math.max(top + 10, portY(inner));
    const holds = (o: Box) => o.kind === 'frame' && within(inner, o), inGroup = all.filter(o => o !== outer && o !== inner && within(o, outer));
    const stop: Rect[] = [...inGroup.filter(o => !holds(o)), ...inGroup.filter(o => holds(o) && o.head > 0).map(o => ({ x: o.x, y: o.y, w: o.w, h: o.head }))];
    const open = (x1: number, y1: number, x2: number, y2: number, m = LANE_CLEAR) => !stop.some(o => Math.max(x1, x2) > o.x - m && Math.min(x1, x2) < o.x + o.w + m && Math.max(y1, y2) > o.y - m && Math.min(y1, y2) < o.y + o.h + m);
    const draw = (pts: Point[], mid: Point): Route => { const p = outer === a ? pts : [...pts].reverse(); return { d: rounded(p), pts: p, mx: mid.x, my: mid.y, detour: true, clear: true }; };
    const lane = [{ x: lx, y: top }, { x: lx, y: iy }, { x: inner.x, y: iy }];
    if (lane.every((p, i) => !i || open(lane[i - 1]!.x, lane[i - 1]!.y, p.x, p.y, -1))) return draw(lane, { x: lx, y: (top + iy) / 2 });
    const LEAD = 12, starts = new Set([lx, outer.x + outer.w - PAD / 2, inner.x + inner.w / 2, inner.x - PAD / 2, inner.x + inner.w + PAD / 2]);
    const from: Port[] = [...starts].filter(x => x > outer.x && x < outer.x + outer.w).map(x => ({ at: { x, y: top }, lead: { x, y: top + LEAD }, cost: 0 }));
    const icx = inner.x + inner.w / 2, to: Port[] = [{ at: { x: inner.x, y: iy }, lead: { x: inner.x - LEAD, y: iy }, cost: 0 }, { at: { x: inner.x + inner.w, y: iy }, lead: { x: inner.x + inner.w + LEAD, y: iy }, cost: 0 },
      ...(inner.kind === 'frame' ? [] : [{ at: { x: icx, y: inner.y }, lead: { x: icx, y: inner.y - LEAD }, cost: 0 }, { at: { x: icx, y: inner.y + inner.h }, lead: { x: icx, y: inner.y + inner.h + LEAD }, cost: 0 }])];
    const seg = (x1: number, y1: number, x2: number, y2: number) => open(x1, y1, x2, y2);
    const r = searchRoute(from.filter(p => seg(p.at.x, p.at.y + 1, p.lead.x, p.lead.y)), to.filter(p => seg(p.at.x + Math.sign(p.lead.x - p.at.x), p.at.y + Math.sign(p.lead.y - p.at.y), p.lead.x, p.lead.y)),
      stop, seg, { x0: outer.x + 2, x1: outer.x + outer.w - 2, y0: top, y1: outer.y + outer.h - 2 }, true);
    if (r) return draw(r.pts, r.mid);
    // No free way inside the group: the margin route, said to cross (never claimed clear).
    return { ...draw(lane, { x: lx, y: (top + iy) / 2 }), clear: false };
  }
  const acx = a.x + a.w / 2, bcx = b.x + b.w / 2, acy = portY(a, ports.a), bcy = portY(b, ports.b);
  const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
  if (overlapX) {
    const down = b.y + b.h / 2 > a.y + a.h / 2, y1 = down ? a.y + a.h : a.y, y2 = down ? b.y : b.y + b.h;
    const x1 = Math.max(a.x, b.x) + (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) / 2;
    if (segFree(x1, y1, x1, y2, -1)) { const pts = [{ x: x1, y: y1 }, { x: x1, y: y2 }]; return { d: rounded(pts), pts, mx: x1, my: (y1 + y2) / 2, clear: true }; }
    // A part between them in the same column would read as an end: go round the right side instead.
    const ax = a.x + a.w, bx = b.x + b.w, xs = Math.max(ax, bx) + 14, pts = [{ x: ax, y: acy }, { x: xs, y: acy }, { x: xs, y: bcy }, { x: bx, y: bcy }];
    return { d: rounded(pts), pts, mx: xs, my: (acy + bcy) / 2, detour: true, clear: free(pts) };
  }
  const right = bcx > acx, dir = right ? 1 : -1, x1 = right ? a.x + a.w : a.x, x2 = right ? b.x : b.x + b.w;
  // The plain line: out of a's side, along the middle of the gap, into b's side (a straight line when the ports are level).
  // Every line on the map is this orthogonal shape, so a part moved by hand changes its lines' places, never their kind.
  const xm = (x1 + x2) / 2, level = Math.abs(acy - bcy) < 1;
  const z = level ? [{ x: x1, y: acy }, { x: x2, y: acy }] : [{ x: x1, y: acy }, { x: xm, y: acy }, { x: xm, y: bcy }, { x: x2, y: bcy }];
  const plain: Route = { d: rounded(z), pts: z, mx: xm, my: (acy + bcy) / 2, clear: false };
  if (free(z)) return { ...plain, clear: true };
  // Half of the free gap beside an end (at most 14px): where the line turns.
  const room = (x: number, y: number, d: number) => Math.min(28, ...blocks.filter(o => y >= o.y && y <= o.y + o.h && (d > 0 ? o.x >= x : o.x + o.w <= x)).map(o => (d > 0 ? o.x - x : x - (o.x + o.w)))) / 2;
  const xa = x1 + dir * room(x1, acy, dir), xb = x2 - dir * room(x2, bcy, -dir);
  // Past the one-corridor routes, the line goes through the gaps with more turns, or into a part from above or below.
  const around = (): Route => { const r = gapRoute(a, b, dir, blocks, segFree, ports, rims); return r ? { d: rounded(r.pts), pts: r.pts, mx: r.mid.x, my: r.mid.y, detour: true, clear: true } : plain; };
  if ((xb - xa) * dir <= 0) return around();
  const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
  // The corridor's row: the ends' own rows, then beside each card in the way at the middle of its gap to the next card (at most
  // ROW_CLEAR off it), so a corridor never squeezes along a card's edge while the gap has room (map hygiene review); a row 6px
  // off a card only when no such row is free.
  const near = blocks.filter(o => o.x < hi && lo < o.x + o.w), ROW_CLEAR = 18;
  const offRow = (o: Rect, up: boolean) => {
    const e = up ? o.y : o.y + o.h, gap = Math.min(ROW_CLEAR * 2, ...near.filter(p => p !== o && (up ? p.y + p.h <= e : p.y >= e)).map(p => (up ? e - (p.y + p.h) : p.y - e)));
    return up ? e - Math.max(6, gap / 2) : e + Math.max(6, gap / 2);
  };
  const byDist = (p: number, q: number) => Math.abs(p - acy) + Math.abs(p - bcy) - (Math.abs(q - acy) + Math.abs(q - bcy));
  const ys = [...[acy, bcy, ...near.flatMap(o => [offRow(o, true), offRow(o, false)])].sort(byDist), ...near.flatMap(o => [o.y - 6, o.y + o.h + 6]).sort(byDist)];
  for (const yc of ys) {
    if (!segFree(xa, acy, xa, yc) || !segFree(xa, yc, xb, yc) || !segFree(xb, yc, xb, bcy)) continue;
    // The corridor at an end's own height leaves a repeated point there: only the corners are kept, since the router moves
    // runs by their points and a run of no length would be moved both ways (a slanted line).
    const pts = corners([{ x: x1, y: acy }, { x: xa, y: acy }, { x: xa, y: yc }, { x: xb, y: yc }, { x: xb, y: bcy }, { x: x2, y: bcy }]);
    // A corridor out past both ends (round the outside of what lies between them) competes with the way through the gaps,
    // under the search's own cost model (map hygiene H1); the gap way is taken only when it really stays nearer the ends (a
    // route along the same outside row is no better, and the corridor's shape is kept).
    const lo = Math.min(acy, bcy), hi = Math.max(acy, bcy), reach = (ps: Point[]) => Math.max(0, ...ps.map(p => Math.max(lo - p.y, p.y - hi)));
    if (reach(pts) > 40) { const g = around(); if (g.clear && reach(g.pts) < reach(pts) - 24 && routeCost(g.pts) < routeCost(pts)) return g; }
    return { d: rounded(pts), pts, mx: (xa + xb) / 2, my: yc, detour: true, clear: true };
  }
  return around();
}

/** Beauty v3 (C.4): the route the layered layout reserved for a line (its hint), from the ports the router assigned: out of a's side to
 * its first track, along its rows through the columns, into b's side. null when one end holds the other, when the first or last track
 * does not lie beyond its end's side, or when any run would come within LANE_CLEAR of a box it does not belong to or cross its own
 * cards (a part moved since the arrangement): the router then searches as before. */
export function hintPath(a: Box, b: Box, others: Iterable<Box>, ports: Ports, hint: Channel): Route | null {
  const all = [...others], byId = new Map(all.map(o => [o.id, o]));
  const within = (o: Box, f: Box) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
  if ((a.kind === 'frame' && within(b, a)) || (b.kind === 'frame' && within(a, b)) || !hint.xs.length || hint.xs.length !== hint.ys.length + 1) return null;
  type Rect = { x: number; y: number; w: number; h: number };
  const blocks: Rect[] = all.filter(o => o !== a && o !== b && !(o.kind === 'frame' && (within(a, o) || within(b, o))) && !(a.kind === 'frame' && within(o, a)) && !(b.kind === 'frame' && within(o, b)));
  for (const o of all) if (o.kind === 'frame' && o !== a && o !== b && o.head > 0 && (within(a, o) || within(b, o))) blocks.push({ x: o.x, y: o.y, w: o.w, h: o.head });
  const rims: Rect[] = all.filter(o => o.kind === 'frame' && o !== a && o !== b && (within(a, o) || within(b, o)));
  const hitBox = (o: Rect, x1: number, y1: number, x2: number, y2: number, m: number) => Math.max(x1, x2) > o.x - m && Math.min(x1, x2) < o.x + o.w + m && Math.max(y1, y2) > o.y - m && Math.min(y1, y2) < o.y + o.h + m;
  const x0 = hint.xs[0]!, x1 = hint.xs[hint.xs.length - 1]!;
  const sa = x0 >= a.x + a.w + 4 ? a.x + a.w : x0 <= a.x - 4 ? a.x : null, sb = x1 <= b.x - 4 ? b.x : x1 >= b.x + b.w + 4 ? b.x + b.w : null;
  if (sa === null || sb === null) return null;
  const portY = (x: Box, p?: number) => p ?? (x.kind === 'frame' ? x.y + x.head / 2 : x.contact !== undefined ? x.y + x.contact : x.y + x.h / 2);
  const ya = portY(a, ports.a), yb = portY(b, ports.b), raw: Point[] = [{ x: sa, y: ya }, { x: x0, y: ya }];
  hint.ys.forEach((y, i) => { raw.push({ x: hint.xs[i]!, y }, { x: hint.xs[i + 1]!, y }); });
  raw.push({ x: x1, y: yb }, { x: sb, y: yb });
  const pts = corners(raw);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1]!, q = pts[i]!;
    if (blocks.some(o => hitBox(o, p.x, p.y, q.x, q.y, LANE_CLEAR)) || !offRims(rims, p.x, p.y, q.x, q.y, LANE_CLEAR)) return null;
    // Its own cards: only the first and last runs touch them, at their ports.
    const own = [i === 1 ? null : a, i === pts.length - 1 ? null : b].filter((x): x is Box => !!x && x.kind !== 'frame');
    if (own.some(o => hitBox(o, p.x, p.y, q.x, q.y, -1))) return null;
  }
  const m = Math.floor((pts.length - 1) / 2), mid = { x: (pts[m]!.x + pts[m + 1]!.x) / 2, y: (pts[m]!.y + pts[m + 1]!.y) / 2 };
  // A reserved route with several bends is no detour; one far longer than the way between its ports is (styles: .edge.detour).
  const len = pts.reduce((s, q, i) => (i ? s + Math.abs(q.x - pts[i - 1]!.x) + Math.abs(q.y - pts[i - 1]!.y) : 0), 0), way = Math.abs(pts[0]!.x - pts.at(-1)!.x) + Math.abs(pts[0]!.y - pts.at(-1)!.y);
  return { d: rounded(pts), pts, mx: mid.x, my: mid.y, ...(len > 1.5 * way + 40 ? { detour: true } : {}), clear: true };
}

/** A route through a card's top or bottom (map design v3 3.6, S4b): a control line leaves its card's bottom and comes in at the
 * top at the given x (the head's left third, spread by the router); an end on a side keeps its port's y. The path keeps
 * LANE_CLEAR off every other box and off its own two cards past their ports, and its first bend at least 16 from each port.
 * null when no free path is found (the caller keeps the side route). */
export function faceRoute(a: Box, b: Box, others: Iterable<Box>, fa: { face: PortFace; at: number }, fb: { face: PortFace; at: number }): Route | null {
  const all = [...others], byId = new Map(all.map(o => [o.id, o]));
  const within = (o: Box, f: Box) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
  type Rect = { x: number; y: number; w: number; h: number };
  const blocks: Rect[] = all.filter(o => o !== a && o !== b && !(o.kind === 'frame' && (within(a, o) || within(b, o))));
  for (const o of all) if (o.kind === 'frame' && o !== a && o !== b && o.head > 0 && (within(a, o) || within(b, o))) blocks.push({ x: o.x, y: o.y, w: o.w, h: o.head });
  const rims: Rect[] = all.filter(o => o.kind === 'frame' && o !== a && o !== b && (within(a, o) || within(b, o)));
  const stop: Rect[] = [...blocks, a, b];
  const segFree = (x1: number, y1: number, x2: number, y2: number, m = LANE_CLEAR) => !stop.some(o => Math.max(x1, x2) > o.x - m && Math.min(x1, x2) < o.x + o.w + m && Math.max(y1, y2) > o.y - m && Math.min(y1, y2) < o.y + o.h + m) && offRims(rims, x1, y1, x2, y2, m);
  const LEAD = 16, port = (x: Box, f: { face: PortFace; at: number }, toward: Box): Port => {
    if (f.face === 'top') return { at: { x: f.at, y: x.y }, lead: { x: f.at, y: x.y - LEAD }, cost: 0 };
    if (f.face === 'bottom') return { at: { x: f.at, y: x.y + x.h }, lead: { x: f.at, y: x.y + x.h + LEAD }, cost: 0 };
    const right = toward.x + toward.w / 2 > x.x + x.w / 2, sx = right ? x.x + x.w : x.x;
    return { at: { x: sx, y: f.at }, lead: { x: sx + (right ? LEAD : -LEAD), y: f.at }, cost: 0 };
  };
  const pa = port(a, fa, b), pb = port(b, fb, a);
  // Each lead is free from just past its own card's edge (the card itself is in the way of every other run).
  const leadFree = (p: Port) => segFree(p.at.x + Math.sign(p.lead.x - p.at.x) * (LANE_CLEAR + 1), p.at.y + Math.sign(p.lead.y - p.at.y) * (LANE_CLEAR + 1), p.lead.x, p.lead.y);
  if (!leadFree(pa) || !leadFree(pb)) return null;
  const x0 = Math.min(a.x, b.x) - 120, x1 = Math.max(a.x + a.w, b.x + b.w) + 120, y0 = Math.min(a.y, b.y) - 120, y1 = Math.max(a.y + a.h, b.y + b.h) + 120;
  const r = searchRoute([pa], [pb], stop, segFree, { x0, x1, y0, y1 }, false, rims);
  return r ? { d: rounded(r.pts), pts: r.pts, mx: r.mid.x, my: r.mid.y, clear: true } : null;
}

/** Whether a straight run keeps m off the edges of these groups where it runs along them (a run across an edge is fine, and a
 * run of no length is a point, not a run along anything). */
export function offRims(rims: { x: number; y: number; w: number; h: number }[], x1: number, y1: number, x2: number, y2: number, m: number): boolean {
  if (Math.abs(x1 - x2) + Math.abs(y1 - y2) < 0.5) return true;
  return rims.every(o => {
    if (Math.abs(x1 - x2) < 0.01) return Math.max(y1, y2) <= o.y || Math.min(y1, y2) >= o.y + o.h || (Math.abs(x1 - o.x) >= m && Math.abs(x1 - o.x - o.w) >= m);
    if (Math.abs(y1 - y2) < 0.01) return Math.max(x1, x2) <= o.x || Math.min(x1, x2) >= o.x + o.w || (Math.abs(y1 - o.y) >= m && Math.abs(y1 - o.y - o.h) >= m);
    return true;
  });
}
/** The corners of an orthogonal polyline: repeated points and points on a straight run between two others dropped. */
function corners(raw: Point[]): Point[] {
  const p = raw.filter((q, n) => n === 0 || Math.abs(q.x - raw[n - 1]!.x) + Math.abs(q.y - raw[n - 1]!.y) > 0.01);
  return p.filter((q, n) => n === 0 || n === p.length - 1 || !((Math.abs(p[n - 1]!.x - q.x) < 0.01 && Math.abs(q.x - p[n + 1]!.x) < 0.01) || (Math.abs(p[n - 1]!.y - q.y) < 0.01 && Math.abs(q.y - p[n + 1]!.y) < 0.01)));
}

/** The last route before a curve that would cross: an orthogonal path through the gaps near both ends (fewest turns, then
 * shortest), kept LANE_CLEAR from every obstacle. It leaves a by the side facing b (or, failing that, its top or bottom) and
 * meets b on the side facing a, or on its top or bottom when that side is shut in; a group end only at its head row, as
 * everywhere. Only boxes near the two ends are searched; null when no such path is found, and the crossing curve stays. */
function gapRoute(a: Box, b: Box, dir: number, blocks: { x: number; y: number; w: number; h: number }[], segFree: (x1: number, y1: number, x2: number, y2: number) => boolean, given: Ports = {}, rims: { x: number; y: number; w: number; h: number }[] = []): { pts: Point[]; mid: Point } | null {
  // The first bend keeps 16 from its port (map design v3 9.9-5); a gap too tight for that takes the old 12 rather than a crossing.
  return gapRouteAt(a, b, dir, blocks, segFree, given, rims, 16) ?? gapRouteAt(a, b, dir, blocks, segFree, given, rims, 12);
}
function gapRouteAt(a: Box, b: Box, dir: number, blocks: { x: number; y: number; w: number; h: number }[], segFree: (x1: number, y1: number, x2: number, y2: number) => boolean, given: Ports, rims: { x: number; y: number; w: number; h: number }[], LEAD: number): { pts: Point[]; mid: Point } | null {
  const SIDE = 0, END = 34, END_FAR = 600;
  // A part's top or bottom is a cheap way in only from an end that really lies above or below it; from an end beside it, a
  // line into the top reads as coming from nowhere, so that way costs more than a turn (600 > a ROUTE_TURN turn).
  // Each face on its own: the top is cheap only toward an end above, the bottom only toward an end below (a top port toward an
  // end below sent the line up over the map and down again: a perimeter run, map hygiene H1).
  const above = (x: Box, o: Box) => o.y + o.h < x.y - 8, below = (x: Box, o: Box) => o.y > x.y + x.h + 8;
  const ports = (x: Box, face: number, other: Box, port?: number): Port[] => {
    const cy = port ?? (x.kind === 'frame' ? x.y + x.head / 2 : x.y + x.h / 2), cx = x.x + x.w / 2, sx = face > 0 ? x.x + x.w : x.x;
    const out: Port[] = [{ at: { x: sx, y: cy }, lead: { x: sx + face * LEAD, y: cy }, cost: SIDE }];
    if (x.kind !== 'frame') out.push({ at: { x: cx, y: x.y + x.h }, lead: { x: cx, y: x.y + x.h + LEAD }, cost: below(x, other) ? END : END_FAR }, { at: { x: cx, y: x.y }, lead: { x: cx, y: x.y - LEAD }, cost: above(x, other) ? END : END_FAR });
    return out.filter(p => segFree(p.at.x + (p.lead.x - p.at.x) / LEAD, p.at.y + (p.lead.y - p.at.y) / LEAD, p.lead.x, p.lead.y));
  };
  // The side ports the router assigned (lines meeting one side spread along it) hold for the search too, so a line that goes
  // round other parts still leaves and arrives where its neighbours expect it.
  const from = ports(a, dir, b, given.a), to = ports(b, -dir, a, given.b);
  if (!from.length || !to.length) return null;
  const x0 = Math.min(a.x, b.x) - 160, x1 = Math.max(a.x + a.w, b.x + b.w) + 160, y0 = Math.min(a.y, b.y) - 160, y1 = Math.max(a.y + a.h, b.y + b.h) + 160;
  return searchRoute(from, to, blocks, segFree, { x0, x1, y0, y1 }, false, rims);
}
type Port = { at: Point; lead: Point; cost: number };
/** The route search's cost model (map hygiene H1): a turn costs ROUTE_TURN px of run; run outside the span of the two ends
 * (their leads' box grown by ROUTE_SPAN_PAD) costs ROUTE_OUT more per px. With a 400 turn and free length, a two-turn run
 * round the outside of the map beat a four-turn way through the gaps; now length counts and leaving the span counts double. */
export const ROUTE_TURN = 140, ROUTE_OUT = 1, ROUTE_SPAN_PAD = 24, ROUTE_SPAN_RAMP = 48;
/** A run nearer a card's edge than ROUTE_HUG (outside it) costs ROUTE_HUG_COST more per px it runs beside the card. */
export const ROUTE_HUG = 12, ROUTE_HUG_COST = 1.5;
type Span = { x0: number; x1: number; y0: number; y1: number };
function spanOf(from: Port[], to: Port[]): Span {
  // The ports each end prefers (its cheapest): a dear top or bottom port far from the other end must not widen the span.
  const best = (ps: Port[]) => { const c = Math.min(...ps.map(p => p.cost)); return ps.filter(p => p.cost === c); };
  const ps = [...best(from), ...best(to)].map(p => p.lead);
  return { x0: Math.min(...ps.map(p => p.x)) - ROUTE_SPAN_PAD, x1: Math.max(...ps.map(p => p.x)) + ROUTE_SPAN_PAD, y0: Math.min(...ps.map(p => p.y)) - ROUTE_SPAN_PAD, y1: Math.max(...ps.map(p => p.y)) + ROUTE_SPAN_PAD };
}
/** How much of a straight (orthogonal) run lies outside the span: the part past either end of it along the run, and a run
 * beside the span by how far it lies off it (in full from ROUTE_SPAN_RAMP out, so a run just past a port's row costs little and
 * a run round the outside of the map costs its whole length). */
export function outside(s: Span, xa: number, ya: number, xb: number, yb: number): number {
  const part = (lo: number, hi: number, s0: number, s1: number) => Math.max(0, Math.min(hi, s0) - lo) + Math.max(0, hi - Math.max(lo, s1));
  const off = (v: number, s0: number, s1: number) => Math.min(1, Math.max(0, s0 - v, v - s1) / ROUTE_SPAN_RAMP);
  if (Math.abs(ya - yb) < 0.01) { const lo = Math.min(xa, xb), hi = Math.max(xa, xb), o = off(ya, s.y0, s.y1); return o * (hi - lo) + (1 - o) * part(lo, hi, s.x0, s.x1); }
  const lo = Math.min(ya, yb), hi = Math.max(ya, yb), o = off(xa, s.x0, s.x1); return o * (hi - lo) + (1 - o) * part(lo, hi, s.y0, s.y1);
}
/** The cost of a whole route under the same model (turns, length, run outside the span of its two ends). */
export function routeCost(pts: Point[]): number {
  if (pts.length < 2) return 0;
  const a = pts[0]!, b = pts[pts.length - 1]!, pad = ROUTE_SPAN_PAD + 16, s: Span = { x0: Math.min(a.x, b.x) - pad, x1: Math.max(a.x, b.x) + pad, y0: Math.min(a.y, b.y) - pad, y1: Math.max(a.y, b.y) + pad };
  let c = 0; for (let i = 1; i < pts.length; i++) { const p = pts[i - 1]!, q = pts[i]!; c += Math.abs(q.x - p.x) + Math.abs(q.y - p.y) + outside(s, p.x, p.y, q.x, q.y) * ROUTE_OUT; }
  return c + Math.max(0, pts.length - 2) * ROUTE_TURN;
}
/** The search behind gapRoute: an orthogonal path from one of the from ports to one of the to ports through the lanes between
 * the blocks near the bounds (fewest turns, then shortest), every step tested with segFree. null when none is found. clip: no
 * lane past the bounds (a line kept inside its group); gapRoute's lanes are never clipped (a lane just past its search edge
 * may be the free way round). */
function searchRoute(from: Port[], to: Port[], blocks: { x: number; y: number; w: number; h: number }[], segFree: (x1: number, y1: number, x2: number, y2: number) => boolean, bounds: { x0: number; x1: number; y0: number; y1: number }, clip = false, rims: { x: number; y: number; w: number; h: number }[] = []): { pts: Point[]; mid: Point } | null {
  const { x0, x1, y0, y1 } = bounds;
  // The edges of the groups around the ends give lanes too (just inside and outside them), now that a run may not lie on them.
  const near = [...blocks, ...rims].filter(o => o.x < x1 && x0 < o.x + o.w && o.y < y1 && y0 < o.y + o.h);
  // Lanes: just outside each nearby box, the middle of every gap between box edges and the ports' own lines. The search edge is
  // a lane only inside a group (clip: the group's own margin); on the open map it is not, so no line is drawn round the map
  // along the edge of its search window (a perimeter bus).
  const lanes = (edges: number[], extra: number[], lo: number, hi: number) => {
    const e = [...new Set(edges)].sort((p, q) => p - q), out = new Set(extra), half = (v: number) => Math.round(v * 2) / 2;
    for (let i = 0; i < e.length; i++) { out.add(e[i]! - 8); out.add(e[i]! + 8); if (i) out.add((e[i - 1]! + e[i]!) / 2); }
    return [...new Set([...out].map(half))].filter(v => !clip || (v >= lo && v <= hi)).sort((p, q) => p - q);
  };
  const xs = lanes(near.flatMap(o => [o.x, o.x + o.w]), [...(clip ? [x0, x1] : []), ...from.map(p => p.lead.x), ...to.map(p => p.lead.x)], x0, x1);
  const ys = lanes(near.flatMap(o => [o.y, o.y + o.h]), [...(clip ? [y0, y1] : []), ...from.map(p => p.lead.y), ...to.map(p => p.lead.y)], y0, y1);
  const X = xs.length, Y = ys.length, N = X * Y, ix = new Map(xs.map((v, i) => [v, i])), iy = new Map(ys.map((v, i) => [v, i]));
  const key = (p: Point) => { const i = ix.get(Math.round(p.x * 2) / 2), j = iy.get(Math.round(p.y * 2) / 2); return i === undefined || j === undefined ? -1 : j * X + i; };
  // Free steps between neighbouring lane crossings (right: 0, down: 1), each tested once.
  const step = new Uint8Array(N * 2);
  for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++) {
    if (i + 1 < X && segFree(xs[i]!, ys[j]!, xs[i + 1]!, ys[j]!)) step[(j * X + i) * 2] = 1;
    if (j + 1 < Y && segFree(xs[i]!, ys[j]!, xs[i]!, ys[j + 1]!)) step[(j * X + i) * 2 + 1] = 1;
  }
  // Dijkstra over (crossing, heading). A turn costs ROUTE_TURN of run, and run that leaves the span of the two ends' leads
  // costs ROUTE_OUT more per px: a way through the gaps between cards beats a two-turn run round the outside of the map.
  // Run that lies along a card's edge (outside it, nearer than ROUTE_HUG) costs ROUTE_HUG_COST more per px of the card it runs
  // beside: a line takes the middle of a gap rather than squeezing along a card (map hygiene review).
  const hug = (xa: number, ya: number, xb: number, yb: number) => {
    const hz = ya === yb, v = hz ? ya : xa, lo = hz ? Math.min(xa, xb) : Math.min(ya, yb), hi = hz ? Math.max(xa, xb) : Math.max(ya, yb);
    let c = 0;
    for (const o of blocks) {
      const e0 = hz ? o.y : o.x, e1 = hz ? o.y + o.h : o.x + o.w, s0 = hz ? o.x : o.y, s1 = hz ? o.x + o.w : o.y + o.h;
      if ((v > e0 && v < e1) || Math.min(Math.abs(v - e0), Math.abs(v - e1)) >= ROUTE_HUG) continue;
      const ov = Math.min(hi, s1) - Math.max(lo, s0); if (ov > 0) c += ov;
    }
    return c * ROUTE_HUG_COST;
  };
  // Each free step's hugging cost, worked out once (indexed as step).
  const hc = new Float32Array(N * 2);
  for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++) {
    if (step[(j * X + i) * 2]) hc[(j * X + i) * 2] = hug(xs[i]!, ys[j]!, xs[i + 1]!, ys[j]!);
    if (step[(j * X + i) * 2 + 1]) hc[(j * X + i) * 2 + 1] = hug(xs[i]!, ys[j]!, xs[i]!, ys[j + 1]!);
  }
  const TURN = ROUTE_TURN, span = spanOf(from, to), out = (xa: number, ya: number, xb: number, yb: number) => outside(span, xa, ya, xb, yb) * ROUTE_OUT, dist = new Float64Array(N * 4).fill(Infinity), prev = new Int32Array(N * 4).fill(-1), heap: [number, number][] = [];
  const push = (d: number, s: number) => { heap.push([d, s]); for (let c = heap.length - 1; c > 0;) { const q = (c - 1) >> 1; if (heap[q]![0] <= heap[c]![0]) break; [heap[q], heap[c]] = [heap[c]!, heap[q]!]; c = q; } };
  const pop = () => { const top = heap[0]!, last = heap.pop()!; if (heap.length) { heap[0] = last; for (let c = 0; ;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l; if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c]!, heap[m]!]; c = m; } } return top; };
  const heading = (p: Port) => (p.lead.x > p.at.x ? 0 : p.lead.x < p.at.x ? 2 : p.lead.y > p.at.y ? 1 : 3); // 0 right, 1 down, 2 left, 3 up
  for (const p of from) { const k = key(p.lead); if (k >= 0) { const s = k * 4 + heading(p); if (p.cost < dist[s]!) { dist[s] = p.cost; push(p.cost, s); } } }
  const goal = new Map<number, Port>(); for (const p of to) { const k = key(p.lead); if (k >= 0) goal.set(k, p); }
  let best = Infinity, bestState = -1, bestPort: Port | null = null;
  while (heap.length) {
    const [d, s] = pop(); if (d > dist[s]! || d >= best) continue;
    const k = s >> 2, hd = s & 3, i = k % X, j = (k - i) / X, g = goal.get(k);
    if (g) { const into = (g.at.x > g.lead.x ? 0 : g.at.x < g.lead.x ? 2 : g.at.y > g.lead.y ? 1 : 3), c = d + g.cost + (into === hd ? 0 : TURN); if (c < best) { best = c; bestState = s; bestPort = g; } }
    const moves: [number, number, boolean, number][] = [[0, k + 1, i + 1 < X && !!step[k * 2], k * 2], [1, k + X, j + 1 < Y && !!step[k * 2 + 1], k * 2 + 1], [2, k - 1, i > 0 && !!step[(k - 1) * 2], (k - 1) * 2], [3, k - X, j > 0 && !!step[(k - X) * 2 + 1], (k - X) * 2 + 1]];
    for (const [h, n, ok, si] of moves) {
      if (!ok || (h + 2) % 4 === hd) continue;
      const nx = xs[n % X]!, ny = ys[(n - (n % X)) / X]!, len = Math.abs(nx - xs[i]!) + Math.abs(ny - ys[j]!), nd = d + len + out(xs[i]!, ys[j]!, nx, ny) + hc[si]! + (h === hd ? 0 : TURN), ns = n * 4 + h;
      if (nd < dist[ns]!) { dist[ns] = nd; prev[ns] = s; push(nd, ns); }
    }
  }
  if (bestState < 0 || !bestPort) return null;
  const mids: Point[] = [];
  for (let s = bestState; s >= 0; s = prev[s]!) { const k = s >> 2, i = k % X; mids.push({ x: xs[i]!, y: ys[(k - i) / X]! }); }
  mids.reverse();
  const start = from.find(p => key(p.lead) === key(mids[0]!))!;
  // Only the corners: points on a straight run between two others are dropped.
  const raw = [start.at, ...mids, bestPort.at], pts = raw.filter((q, n) => n === 0 || n === raw.length - 1 || !((raw[n - 1]!.x === q.x && q.x === raw[n + 1]!.x) || (raw[n - 1]!.y === q.y && q.y === raw[n + 1]!.y)));
  const m = Math.floor((pts.length - 1) / 2), mid = { x: (pts[m]!.x + pts[m + 1]!.x) / 2, y: (pts[m]!.y + pts[m + 1]!.y) / 2 };
  return { pts, mid };
}

/** The overview of a busy map at rest: each relation drawn once between the outermost drawn boxes that hold its ends below the
 * group they share (two groups side by side, a group and an outside partner), merged by kind. Ids and notes are the relations'
 * own; a line that stands for relations of inner parts is agg, as a folded group's line is. */
export function summaryEdges(boxes: Map<string, Box>, edges: Edge[]): Edge[] {
  const chain = (id: string) => { const out = [id]; for (let c = boxes.get(id)?.container, g = 0; c && boxes.has(c) && g < 64; c = boxes.get(c)!.container, g++) out.push(c); return out; };
  const out = new Map<string, Edge>();
  for (const e of edges) {
    const ca = chain(e.from), cb = chain(e.to), sb = new Set(cb), common = ca.find(x => sb.has(x));
    // One end holds the other (a group and a part inside it): drawn as it is.
    const a = common === e.from || common === e.to ? e.from : common ? ca[ca.indexOf(common) - 1]! : ca.at(-1)!;
    const b = common === e.from || common === e.to ? e.to : common ? cb[cb.indexOf(common) - 1]! : cb.at(-1)!;
    const key = `sum:${a}|${b}|${e.kind}`, s = out.get(key) ?? { key, from: a, to: b, kind: e.kind, notes: [], ids: [], agg: false };
    s.notes.push(...e.notes); s.ids.push(...e.ids); s.agg ||= e.agg || a !== e.from || b !== e.to;
    out.set(key, s);
  }
  return [...out.values()];
}

/** The summary beside a selection: the same lines over the relations that are not drawn one by one (own: the selection's), each
 * holding only those. Every relation reads once, on its own line or in one summary; a line left with none is not returned. */
export function restSummary(boxes: Map<string, Box>, edges: Edge[], own: (e: Edge) => boolean): Edge[] {
  return summaryEdges(boxes, edges.filter(e => !own(e)));
}

/** A verb's place on the map and how far it sits from the end it is read at. */
export interface LabelSpot { key: string; x: number; y: number; w: number; h: number; dist: number;
  /** The label's place in the protected order (map design v3 6.3, line-grammar labelRank): lower wins; absent ranks first. */
  rank?: number }
/** Verbs that would touch (one box grown by pad): the one higher in the protected order keeps its place, then the one nearer
 * its own end; the other takes its next free place (spots may hold several per key, nearest first wins) or, with none left, is
 * left off the map. */
export function resolveLabels<T extends LabelSpot>(spots: T[], pad = 6): { kept: T[]; dropped: string[] } {
  const kept: T[] = [], done = new Set<string>();
  for (const s of [...spots].sort((p, q) => (p.rank ?? 0) - (q.rank ?? 0) || p.dist - q.dist)) {
    if (done.has(s.key) || kept.some(k => s.x - pad < k.x + k.w && k.x < s.x + s.w + pad && s.y - pad < k.y + k.h && k.y < s.y + s.h + pad)) continue;
    kept.push(s); done.add(s.key);
  }
  return { kept, dropped: [...new Set(spots.map(s => s.key))].filter(k => !done.has(k)) };
}
