/* Map layout for one scope (the whole project, or the inside of one part), from the project's real containment and relations.
 * - Items are the scope's direct children. An expanded item is a frame around its own children; a collapsed one is a node.
 * - Positions are per container ('root' or a parent id): the arrangement of siblings is the same whether the parent is the
 *   scope itself or an expanded frame, so a place set in one view holds in the other. Missing positions use the automatic
 *   arrangement; nothing here overwrites a stored position.
 * - Reading levels: a direct child of the scope is a region (a frame with its name and the first sentence of its note) or a
 *   unit (a card with the same two lines); inside a region parts are compact rows, and a long run of siblings with few links
 *   among them reads as a list. Heights follow the lines a part really needs (two-line names, a state line); text never shrinks. */
import type { StudioView, RelationView } from '../shared/studio.js';

/** Frames are a little wider than a node so the head keeps its name beside the fold and go-inside controls. */
export const FRAME_MIN_W = 228;
/** NODE_W: a row's width (long names widen it). NODE_H: the least height of a unit card. */
export const NODE_W = 200, NODE_H = 52, UNIT_W = 240, PAD = 14, GAP = 8, COL_GAP = 76, ROW_GAP = 22, GHOST_W = 168, GHOST_H = 34;
/** Head of a group inside a region: one line, or two when the name needs them (names never shrink). */
export const HEAD = 34, HEAD_2 = 52;
/** A planned change line under a part's name in the preview (12px). */
export const PLAN_LINE = 15;
/** Between wrapped columns of one layer (no relation runs between them, so they sit closer than relation layers). */
export const WRAP_GAP = 36;
/** Between relation layers inside a group: room for converging lines to stay apart. */
export const FLOW_GAP = 44;
/** A list: columns of short rows. */
export const LIST_GAP = 18, LIST_ROW_GAP = 2;
export interface Point { x: number; y: number }
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
  list?: boolean }
/** agg: at least one end is drawn by a folded ancestor (a summary of inner relations, not a relation of that ancestor). */
export interface Edge { key: string; from: string; to: string; kind: RelationView['kind']; notes: string[]; ids: string[]; agg: boolean }
export interface ScopeLayout { boxes: Map<string, Box>; edges: Edge[]; bounds: { x: number; y: number; w: number; h: number } }

interface Measure { w: number; h: number; ox: number; oy: number; head: number }
export const ghostId = (id: string) => `ghost:${id}`;

/** Rough rendered width of a frame name (13px, semibold): wide for CJK, narrower for Latin. Only decides one or two head lines. */
export function textWidth(text: string): number {
  let w = 0; for (const ch of text) w += /[ᄀ-ᇿ⺀-꓏가-힯豈-﫿＀-￯]/.test(ch) ? 13.4 : /[A-Z@]/.test(ch) ? 8.8 : /[ .,:;'|il!]/.test(ch) ? 4.2 : 7.6;
  return w;
}

/** Rendered width of text: 'node' (13.5px semibold row name), 'head' (15px region or unit name), 'sub' (13px group name) or
 * 'note' (12.5px description). The browser passes a canvas measurement in the page's own font; without one, the estimate. */
export type TextMeasure = (text: string, kind: 'node' | 'head' | 'sub' | 'note' | 'plan') => number;
const SCALE = { node: 13.5 / 13, head: 15 / 13, sub: 1, note: 12.5 / 13 * 0.92, plan: 12 / 13 * 0.95 } as const;
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
const nodeChrome = (kids: boolean) => (kids ? 5 + 22 + 4 + 4 + 40 + 8 + 2 : 13 + 8 + 2);
export function nodeWidth(name: string, kids: boolean, measure: TextMeasure = estimate): number {
  // Lines break at word ends, not mid-word: leave a share of each line unused.
  const need = measure(name, 'node') * 1.12 + 8;
  if (need <= (NODE_W - nodeChrome(kids)) * 2) return NODE_W;
  return Math.min(NODE_MAX_W, Math.ceil(need / 2) + nodeChrome(kids));
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
 * as many columns as make their block closest to that shape, instead of one tall column. */
export function layoutScope(v: StudioView, scope: string | null, expanded: (id: string, depth: number) => boolean, pos: Positions, measureText: TextMeasure = estimate, planned?: ReadonlyMap<string, readonly string[]>, aspect = 1.6): ScopeLayout {
  const byId = new Map(v.parts.map(p => [p.id, p]));
  const kidsOf = (id: string | null) => (id ? byId.get(id)?.childIds ?? [] : v.roots);
  const open = (id: string, depth: number) => depth < 12 && kidsOf(id).length > 0 && expanded(id, depth);
  const memo = new Map<string, Measure & { face?: Face }>();
  const listMemo = new Map<string, boolean>();
  const listOf = (container: string | null) => { const k = container ?? ROOT; if (!listMemo.has(k)) listMemo.set(k, isListGroup(v, container)); return listMemo.get(k)!; };
  const names = new Map<string, number>(); for (const p of v.parts) names.set(p.name, (names.get(p.name) ?? 0) + 1);
  // Automatic arrangement of siblings: longest-path columns over relations lifted to the siblings; long columns wrap.
  const autoArrange = (container: string | null, sizes: Map<string, Measure>): Map<string, Point> => {
    const ids = kidsOf(container), set = new Set(ids);
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
    const out = new Map<string, Set<string>>(ids.map(i => [i, new Set<string>()]));
    const reaches = (a: string, b: string) => { const seen = new Set<string>(), st = [a]; while (st.length) { const x = st.pop()!; if (x === b) return true; if (seen.has(x)) continue; seen.add(x); st.push(...out.get(x)!); } return false; };
    for (const r of v.relations) { const a = lift(r.from), b = lift(r.to); if (a && b && a !== b && !reaches(b, a)) out.get(a)!.add(b); }
    const layer = new Map<string, number>();
    const depthOf = (id: string, guard = 0): number => {
      if (layer.has(id)) return layer.get(id)!;
      let d = 0; for (const [from, tos] of out) if (tos.has(id) && guard < 64) d = Math.max(d, depthOf(from, guard + 1) + 1);
      layer.set(id, d); return d;
    };
    ids.forEach(i => depthOf(i));
    // Parts linked to a sibling come first, by relation layer; siblings with no link here follow as their own block, so a line
    // never has to pass an unrelated part between its ends. Inside a group a plain chain (one part per layer) runs top to bottom.
    const linked = new Set<string>();
    for (const [x, tos] of out) if (tos.size) { linked.add(x); tos.forEach(t => linked.add(t)); }
    const layers: string[][] = [];
    for (const i of ids) if (linked.has(i)) (layers[layer.get(i)!] ??= []).push(i);
    const flow = layers.filter(Boolean), lone = ids.filter(i => !linked.has(i)), inFrame = container !== scope;
    const maxPer = Math.max(4, Math.min(8, Math.ceil(Math.sqrt(ids.length * 1.3))));
    const wrap = (c: string[]) => { if (c.length <= maxPer) return [c]; const per = Math.ceil(c.length / Math.ceil(c.length / maxPer)), o: string[][] = []; for (let i = 0; i < c.length; i += per) o.push(c.slice(i, i + per)); return o; };
    // Each column: its parts, the gap after it, and whether it is centred against the tallest relation column.
    const cols: { ids: string[]; gap: number; centre: boolean }[] = [];
    if (inFrame && flow.length && flow.every(l => l.length === 1)) cols.push(...wrap(flow.map(l => l[0]!)).map(c => ({ ids: c, gap: GAP, centre: false })));
    else flow.forEach(l => { const w = wrap(l); w.forEach((c, i) => cols.push({ ids: c, gap: i < w.length - 1 ? (inFrame ? GAP : WRAP_GAP) : inFrame ? FLOW_GAP : COL_GAP, centre: w.length === 1 })); });
    if (cols.length && lone.length) cols.at(-1)!.gap = inFrame ? (cols.at(-1)!.gap === GAP ? GAP : FLOW_GAP) : WRAP_GAP;
    // The scope's own unlinked parts: no order between them to keep, so they go where the whole block needs the least zoom in a
    // window of this shape: as columns beside the linked block, or in rows under it (never inside a relation layer, which would
    // read as a step). Parts inside a group keep their one readable column.
    const colW = (c: string[]) => Math.max(...c.map(i => sizes.get(i)!.w)), colH = (c: string[]) => c.reduce((a, i) => a + sizes.get(i)!.h, 0) + ROW_GAP * (c.length - 1);
    const flowCols = cols.length, flowW = cols.reduce((a, x) => a + colW(x.ids) + x.gap, 0), flowH = Math.max(0, ...cols.map(x => colH(x.ids)));
    const need = (W: number, H: number) => Math.max(W, H * aspect);
    let side = wrap(lone), below: string[][] | null = null;
    if (!inFrame && lone.length) {
      let score = Infinity;
      for (let per = 1; per <= lone.length; per++) {
        const cs: string[][] = []; for (let i = 0; i < lone.length; i += per) cs.push(lone.slice(i, i + per));
        const sc = need(flowW + cs.reduce((a, x) => a + colW(x), 0) + WRAP_GAP * (cs.length - 1), Math.max(flowH, ...cs.map(colH)));
        if (sc < score - 1e-6) { score = sc; side = cs; }
      }
      if (flowCols) {
        const room = Math.max(flowW - WRAP_GAP, ...lone.map(i => sizes.get(i)!.w)), rows: string[][] = [];
        let cur: string[] = [], w = 0;
        for (const i of lone) { const iw = sizes.get(i)!.w; if (cur.length && w + WRAP_GAP + iw > room) { rows.push(cur); cur = []; w = 0; } w += (cur.length ? WRAP_GAP : 0) + iw; cur.push(i); }
        if (cur.length) rows.push(cur);
        const rowH = (r: string[]) => Math.max(...r.map(i => sizes.get(i)!.h));
        const sc = need(Math.max(flowW - WRAP_GAP, room), flowH + ROW_GAP * 2 + rows.reduce((a, r) => a + rowH(r), 0) + ROW_GAP * (rows.length - 1));
        if (sc < score - 1e-6) below = rows;
      }
    }
    if (below) cols.at(-1)!.gap = inFrame ? FLOW_GAP : COL_GAP;
    else cols.push(...side.map(c => ({ ids: c, gap: inFrame ? GAP : WRAP_GAP, centre: false })));
    const gapY = inFrame ? GAP : ROW_GAP;
    // Relation layers centre against the tallest relation layer only: a tall block of unlinked parts beside them does not
    // push them down.
    const heights = cols.map(c => c.ids.reduce((acc, i) => acc + sizes.get(i)!.h, 0) + gapY * (c.ids.length - 1)), tallest = Math.max(0, ...heights.slice(0, flowCols));
    const at = new Map<string, Point>(); let x = 0;
    cols.forEach((c, ci) => {
      const w = Math.max(...c.ids.map(i => sizes.get(i)!.w));
      let y = c.centre ? (tallest - heights[ci]!) / 2 : 0;
      for (const i of c.ids) { const sz = sizes.get(i)!; at.set(i, { x: x - sz.ox, y: y - sz.oy }); y += sz.h + gapY; }
      x += w + c.gap;
    });
    if (below) {
      let y = tallest + ROW_GAP * 2;
      for (const r of below) {
        let rx = 0; for (const i of r) { const sz = sizes.get(i)!; at.set(i, { x: rx - sz.ox, y: y - sz.oy }); rx += sz.w + WRAP_GAP; }
        y += Math.max(...r.map(i => sizes.get(i)!.h)) + ROW_GAP;
      }
    }
    return at;
  };
  const anchors = (container: string | null, depth: number) => {
    const ids = kidsOf(container), sizes = new Map(ids.map(i => [i, measure(i, depth, container)]));
    const auto = autoArrange(container, sizes), stored = pos[container ?? ROOT] ?? {};
    return { sizes, at: new Map(ids.map(i => [i, stored[i] ? { ...stored[i]! } : auto.get(i)!])) };
  };
  const hasRecords = (id: string, guard = 0): boolean => { const p = byId.get(id); return !!p && guard < 64 && (!!p.lastAt || p.childIds.some(c => hasRecords(c, guard + 1))); };
  // Korean text breaks between words (keep-all): leave a share of each line unused.
  const lines = (text: string, kind: Parameters<TextMeasure>[1], room: number, max = 2) => (!text ? 0 : Math.min(max, Math.ceil((measureText(text, kind) * 1.15 + 6) / Math.max(40, room))));
  // Planned lines are short phrases measured in their own font: a smaller share is left for word ends than for notes.
  const plannedLines = (id: string, room: number) => Math.max(0, ...(planned?.get(id) ?? []).map(t => Math.min(2, Math.ceil((measureText(t, 'plan') * 1.06 + 4) / Math.max(40, room)))));
  // A folded part standing for a planned part inside it reads one line naming that inner part.
  const plannedInside = (id: string) => !!planned && [...planned.keys()].some(k => { for (let p = byId.get(k)?.parentId, g = 0; p && g < 64; p = byId.get(p)?.parentId, g++) if (p === id) return true; return false; });
  const nodeLines = (id: string, room: number) => plannedLines(id, room) || (plannedInside(id) ? 1 : 0);
  /** Region head: the name (one or two lines; a longer name widens the region rather than being cut) and the first sentence of
   * the note under it. Head row: toggle 28, go-inside ~44, paddings ~12, and the latest-record time ~52 when there is one. */
  const regionHead = (id: string, w: number): { w: number; head: number } => {
    const p = byId.get(id)!, room = (x: number) => x - 84 - (hasRecords(id) ? 52 : 0), chrome = w - room(w);
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
  /** Group head inside a region: its name only; a long name takes a second line or widens the group (up to 360px). */
  const groupHead = (id: string, w: number): { w: number; head: number } => {
    const need = measureText(byId.get(id)?.name ?? '', 'sub') * 1.08, room = (x: number) => x - 88 - (hasRecords(id) ? 52 : 0);
    if (need > room(w) * 2) w = Math.max(w, Math.min(360, Math.ceil(need / 2) + w - room(w) + 12));
    const pl = plannedLines(id, room(w));
    return { w, head: (need > room(w) ? HEAD_2 : HEAD) + (pl ? 3 + pl * PLAN_LINE : 0) };
  };
  function measure(id: string, depth: number, container: string | null): Measure & { face?: Face } {
    const cached = memo.get(id); if (cached) return cached;
    const p = byId.get(id)!, kids = kidsOf(id).length > 0, chrome = nodeChrome(kids);
    // The extra line under a name: the state when there is one, else the parent beside a name that repeats in the project.
    const extra = p.status !== 'plan' || (names.get(p.name) ?? 0) > 1 ? 1 : 0;
    let m: Measure & { face?: Face };
    if (open(id, depth)) {
      const { sizes, at } = anchors(id, depth + 1);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [k, q] of at) { const s = sizes.get(k)!; minX = Math.min(minX, q.x + s.ox); minY = Math.min(minY, q.y + s.oy); maxX = Math.max(maxX, q.x + s.ox + s.w); maxY = Math.max(maxY, q.y + s.oy + s.h); }
      const { w, head } = (depth === 0 ? regionHead : groupHead)(id, Math.max(maxX - minX + PAD * 2, FRAME_MIN_W));
      m = { ox: minX, oy: minY, w, h: maxY - minY + head + PAD, head };
    } else if (listOf(container)) {
      // Planned lines keep the item's own padding (7 above and below), for one line as for two.
      const w = nodeWidth(p.name, kids, measureText), nl = lines(p.name, 'node', w - chrome), pl = nodeLines(id, w - chrome);
      m = { w, h: Math.max(14 + (nl + extra) * 17, pl ? 14 + nl * 17 + 2 + pl * PLAN_LINE : 0), ox: 0, oy: 0, head: 0, face: 'item' };
    } else if (depth === 0) {
      // A folded group reads by its name and count; its note is the selection's. A part without an inside keeps its sentence.
      const note = kids ? '' : mapLead(v, id), need = measureText(p.name, 'head') * 1.1 + 6;
      let w = note ? UNIT_W : NODE_W;
      if (need > (w - chrome) * 2) w = Math.min(NODE_MAX_W + 40, Math.ceil(need / 2) + chrome);
      const nl = need > w - chrome ? 2 : 1, ll = lines(note, 'note', w - chrome), pl = nodeLines(id, w - chrome);
      m = { w, h: Math.max(NODE_H, 24 + nl * 20 + (ll ? 2 + ll * 17 : 0) + extra * 19, pl ? 24 + nl * 20 + 3 + pl * PLAN_LINE : 0), ox: 0, oy: 0, head: 0, face: 'unit' };
    } else {
      // Planned lines keep the row's own padding (10 above and below): this row only, for one line as for two.
      const w = nodeWidth(p.name, kids, measureText), nl = lines(p.name, 'node', w - chrome), pl = nodeLines(id, w - chrome);
      m = { w, h: Math.max(20 + (nl + extra) * 18, pl ? 20 + nl * 18 + 2 + pl * PLAN_LINE : 0), ox: 0, oy: 0, head: 0, face: 'row' };
    }
    memo.set(id, m); return m;
  }
  const boxes = new Map<string, Box>();
  const place = (id: string, anchor: Point, rel: Point, depth: number, container: string | null) => {
    const m = measure(id, depth, container), kids = kidsOf(id).length, isOpen = open(id, depth);
    boxes.set(id, { id, x: anchor.x + m.ox, y: anchor.y + m.oy, w: m.w, h: m.h, kind: isOpen ? 'frame' : 'node', depth, container: container ?? ROOT, kids, rel, head: m.head,
      ...(isOpen ? { list: listOf(id) } : { face: m.face ?? 'row' }) });
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
  const edges = new Map<string, Edge>(), ghostsIn: string[] = [], ghostsOut: string[] = [];
  for (const r of v.relations) {
    let a = rep(r.from), b = rep(r.to);
    if (!a && !b) continue;
    if (!a) { a = ghostId(r.from); if (!ghostsIn.includes(r.from)) ghostsIn.push(r.from); }
    if (!b) { b = ghostId(r.to); if (!ghostsOut.includes(r.to)) ghostsOut.push(r.to); }
    if (a === b) continue;
    const key = `${a}|${b}|${r.kind}`, e = edges.get(key) ?? { key, from: a, to: b, kind: r.kind, notes: [], ids: [], agg: false };
    if (r.note) e.notes.push(r.note); e.ids.push(r.id);
    if ((a !== r.from && a !== ghostId(r.from)) || (b !== r.to && b !== ghostId(r.to))) e.agg = true;
    edges.set(key, e);
  }
  const ghostColumn = (ids: string[], x: number) => ids.forEach((id, i) => boxes.set(ghostId(id), { id: ghostId(id), x, y: minY + i * (GHOST_H + 12), w: GHOST_W, h: GHOST_H, kind: 'ghost', depth: 0, container: '', kids: 0, rel: { x: 0, y: 0 }, head: 0 }));
  ghostColumn(ghostsIn.filter(id => !ghostsOut.includes(id)), minX - GHOST_W - 90);
  ghostColumn(ghostsOut, maxX + 90);
  let bx = Infinity, by = Infinity, bx2 = -Infinity, by2 = -Infinity;
  for (const b of boxes.values()) { bx = Math.min(bx, b.x); by = Math.min(by, b.y); bx2 = Math.max(bx2, b.x + b.w); by2 = Math.max(by2, b.y + b.h); }
  if (!boxes.size) { bx = by = bx2 = by2 = 0; }
  return { boxes, edges: [...edges.values()], bounds: { x: bx, y: by, w: bx2 - bx, h: by2 - by } };
}

/** Rounded orthogonal path through points (corners of radius up to r). */
function rounded(pts: Point[], r = 8): string {
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
 * The usual soft curve is kept when it crosses nothing; when it would pass under an unrelated part or group, the line takes an
 * outside corridor through the gaps (out from the side, along a free row gap, into the other side). */
export function edgePath(a: Box, b: Box, others: Iterable<Box> = []): { d: string; mx: number; my: number } {
  const all = [...others], byId = new Map(all.map(o => [o.id, o]));
  const within = (o: Box, f: Box) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
  // What a line must not cross: other parts and groups, except the groups around either end and the inside of a group end.
  const blocks = all.filter(o => o !== a && o !== b && !(o.kind === 'frame' && (within(a, o) || within(b, o))) && !(a.kind === 'frame' && within(o, a)) && !(b.kind === 'frame' && within(o, b)));
  const inside = (x: number, y: number) => blocks.some(o => x > o.x + 1 && x < o.x + o.w - 1 && y > o.y + 1 && y < o.y + o.h - 1);
  const segFree = (x1: number, y1: number, x2: number, y2: number) => !blocks.some(o => Math.max(x1, x2) > o.x + 1 && Math.min(x1, x2) < o.x + o.w - 1 && Math.max(y1, y2) > o.y + 1 && Math.min(y1, y2) < o.y + o.h - 1);
  const portY = (x: Box) => (x.kind === 'frame' ? x.y + x.head / 2 : x.y + x.h / 2);
  const acx = a.x + a.w / 2, bcx = b.x + b.w / 2, acy = portY(a), bcy = portY(b);
  const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
  if (overlapX) {
    const down = b.y + b.h / 2 > a.y + a.h / 2, y1 = down ? a.y + a.h : a.y, y2 = down ? b.y : b.y + b.h;
    const x1 = Math.max(a.x, b.x) + (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) / 2, k = Math.max(24, Math.abs(y2 - y1) / 2) * (down ? 1 : -1);
    if (segFree(x1, y1, x1, y2)) return { d: `M${x1},${y1} C${x1},${y1 + k} ${x1},${y2 - k} ${x1},${y2}`, mx: x1, my: (y1 + y2) / 2 };
    // A part between them in the same column would read as an end: go round the right side instead.
    const ax = a.x + a.w, bx = b.x + b.w, xs = Math.max(ax, bx) + 14;
    return { d: rounded([{ x: ax, y: acy }, { x: xs, y: acy }, { x: xs, y: bcy }, { x: bx, y: bcy }]), mx: xs, my: (acy + bcy) / 2 };
  }
  const right = bcx > acx, dir = right ? 1 : -1, x1 = right ? a.x + a.w : a.x, x2 = right ? b.x : b.x + b.w;
  const k = Math.max(40, Math.abs(x2 - x1) / 2) * dir;
  const curve = { d: `M${x1},${acy} C${x1 + k},${acy} ${x2 - k},${bcy} ${x2},${bcy}`, mx: (x1 + x2) / 2, my: (acy + bcy) / 2 };
  const at = (t: number) => { const u = 1 - t; return { x: u * u * u * x1 + 3 * u * u * t * (x1 + k) + 3 * u * t * t * (x2 - k) + t * t * t * x2, y: u * u * u * acy + 3 * u * u * t * acy + 3 * u * t * t * bcy + t * t * t * bcy }; };
  let crosses = false; for (let i = 1; i < 24 && !crosses; i++) { const q = at(i / 24); crosses = inside(q.x, q.y); }
  if (!crosses) return curve;
  // Half of the free gap beside an end (at most 14px): where the line turns.
  const room = (x: number, y: number, d: number) => Math.min(28, ...blocks.filter(o => y >= o.y && y <= o.y + o.h && (d > 0 ? o.x >= x : o.x + o.w <= x)).map(o => (d > 0 ? o.x - x : x - (o.x + o.w)))) / 2;
  const xa = x1 + dir * room(x1, acy, dir), xb = x2 - dir * room(x2, bcy, -dir);
  if ((xb - xa) * dir <= 0) return curve;
  const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
  const ys = [acy, bcy, ...blocks.filter(o => o.x < hi && lo < o.x + o.w).flatMap(o => [o.y - 6, o.y + o.h + 6])]
    .sort((p, q) => Math.abs(p - acy) + Math.abs(p - bcy) - (Math.abs(q - acy) + Math.abs(q - bcy)));
  for (const yc of ys) {
    if (!segFree(xa, acy, xa, yc) || !segFree(xa, yc, xb, yc) || !segFree(xb, yc, xb, bcy)) continue;
    return { d: rounded([{ x: x1, y: acy }, { x: xa, y: acy }, { x: xa, y: yc }, { x: xb, y: yc }, { x: xb, y: bcy }, { x: x2, y: bcy }]), mx: (xa + xb) / 2, my: yc };
  }
  return curve;
}
