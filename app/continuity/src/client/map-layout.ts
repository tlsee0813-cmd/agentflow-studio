/* Map layout for one scope (the whole project, or the inside of one part), from the project's real containment and relations.
 * - Items are the scope's direct children. An expanded item is a frame around its own children; a collapsed one is a node.
 * - Positions are per container ('root' or a parent id): the arrangement of siblings is the same whether the parent is the
 *   scope itself or an expanded frame, so a place set in one view holds in the other. Missing positions use the automatic
 *   arrangement; nothing here overwrites a stored position.
 * - Node size is fixed: more children grow frames and the canvas, never shrink text. */
import type { StudioView, RelationView } from '../shared/studio.js';

/** Frames are a little wider than a node so the head keeps its name beside the fold and go-inside controls. */
export const FRAME_MIN_W = 228;
export const NODE_W = 200, NODE_H = 60, PAD = 14, HEAD = 38, GAP = 12, COL_GAP = 76, ROW_GAP = 22, GHOST_W = 168, GHOST_H = 34;
/** A frame head whose name needs two lines (estimated from the name and the frame width; names never shrink). */
export const HEAD_2 = 56;
/** Between wrapped columns of one layer (no relation runs between them, so they sit closer than relation layers). */
export const WRAP_GAP = 36;
/** Between relation layers inside a group: room for converging lines to stay apart. */
export const FLOW_GAP = 44;
export interface Point { x: number; y: number }
export type Positions = Record<string, Record<string, Point>>;
export const ROOT = 'root';
export interface Box { id: string; x: number; y: number; w: number; h: number; kind: 'node' | 'frame' | 'ghost'; depth: number; container: string; kids: number;
  /** Frames: height of the head row (HEAD, or HEAD_2 when the name takes two lines). */
  head: number;
  /** The container-relative place used for this box (stored, or automatic): what a drag starts from and stores. */
  rel: Point }
export interface Edge { key: string; from: string; to: string; kind: RelationView['kind']; notes: string[]; ids: string[] }
export interface ScopeLayout { boxes: Map<string, Box>; edges: Edge[]; bounds: { x: number; y: number; w: number; h: number } }

interface Measure { w: number; h: number; ox: number; oy: number; head: number }
export const ghostId = (id: string) => `ghost:${id}`;

/** Rough rendered width of a frame name (13px, semibold): wide for CJK, narrower for Latin. Only decides one or two head lines. */
export function textWidth(text: string): number {
  let w = 0; for (const ch of text) w += /[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/.test(ch) ? 13.4 : /[A-Z@]/.test(ch) ? 8.8 : /[ .,:;'|il!]/.test(ch) ? 4.2 : 7.6;
  return w;
}

/** Rendered width of a name: 'node' (13.5px semibold part name) or 'head' (13px group name). The browser passes a canvas
 * measurement in the page's own font; without one, the estimate below. */
export type TextMeasure = (text: string, kind: 'node' | 'head') => number;
const estimate: TextMeasure = (text, kind) => textWidth(text) * (kind === 'node' ? 13.5 / 13 : 1);
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

export function layoutScope(v: StudioView, scope: string | null, expanded: (id: string, depth: number) => boolean, pos: Positions, measureText: TextMeasure = estimate): ScopeLayout {
  const byId = new Map(v.parts.map(p => [p.id, p]));
  const kidsOf = (id: string | null) => (id ? byId.get(id)?.childIds ?? [] : v.roots);
  const open = (id: string, depth: number) => depth < 12 && kidsOf(id).length > 0 && expanded(id, depth);
  const memo = new Map<string, Measure>();
  // Automatic arrangement of siblings: longest-path columns over relations lifted to the siblings; long columns wrap.
  const autoArrange = (container: string | null, sizes: Map<string, Measure>): Map<string, Point> => {
    const ids = kidsOf(container), set = new Set(ids);
    const lift = (id: string) => { let cur = byId.get(id), guard = 0; while (cur && !set.has(cur.id) && guard++ < 64) cur = cur.parentId ? byId.get(cur.parentId) : undefined; return cur && set.has(cur.id) ? cur.id : null; };
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
    cols.push(...wrap(lone).map(c => ({ ids: c, gap: inFrame ? GAP : WRAP_GAP, centre: false })));
    const gapY = inFrame ? GAP : ROW_GAP;
    const heights = cols.map(c => c.ids.reduce((acc, i) => acc + sizes.get(i)!.h, 0) + gapY * (c.ids.length - 1)), tallest = Math.max(0, ...heights);
    const at = new Map<string, Point>(); let x = 0;
    cols.forEach((c, ci) => {
      const w = Math.max(...c.ids.map(i => sizes.get(i)!.w));
      let y = c.centre ? (tallest - heights[ci]!) / 2 : 0;
      for (const i of c.ids) { const sz = sizes.get(i)!; at.set(i, { x: x - sz.ox, y: y - sz.oy }); y += sz.h + gapY; }
      x += w + c.gap;
    });
    return at;
  };
  const anchors = (container: string | null, depth: number) => {
    const ids = kidsOf(container), sizes = new Map(ids.map(i => [i, measure(i, depth)]));
    const auto = autoArrange(container, sizes), stored = pos[container ?? ROOT] ?? {};
    return { sizes, at: new Map(ids.map(i => [i, stored[i] ? { ...stored[i]! } : auto.get(i)!])) };
  };
  // Head row: toggle 22 + paddings and gaps ~26 + go-inside ~40, and the latest-record time ~52 when there is one.
  const hasRecords = (id: string, guard = 0): boolean => { const p = byId.get(id); return !!p && guard < 64 && (!!p.lastAt || p.childIds.some(c => hasRecords(c, guard + 1))); };
  const headRoom = (id: string, w: number) => w - 88 - (hasRecords(id) ? 52 : 0);
  /** A name longer than two lines of a narrow group widens the group (up to 360px) rather than cutting the name. */
  const headFit = (id: string, w: number): { w: number; head: number } => {
    const need = measureText(byId.get(id)?.name ?? '', 'head') * 1.08;
    if (need > headRoom(id, w) * 2) w = Math.max(w, Math.min(360, Math.ceil(need / 2) + w - headRoom(id, w) + 12));
    return { w, head: need > headRoom(id, w) ? HEAD_2 : HEAD };
  };
  function measure(id: string, depth: number): Measure {
    const cached = memo.get(id); if (cached) return cached;
    let m: Measure = { w: nodeWidth(byId.get(id)?.name ?? '', kidsOf(id).length > 0, measureText), h: NODE_H, ox: 0, oy: 0, head: 0 };
    if (open(id, depth)) {
      const { sizes, at } = anchors(id, depth + 1);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [k, p] of at) { const s = sizes.get(k)!; minX = Math.min(minX, p.x + s.ox); minY = Math.min(minY, p.y + s.oy); maxX = Math.max(maxX, p.x + s.ox + s.w); maxY = Math.max(maxY, p.y + s.oy + s.h); }
      const { w, head } = headFit(id, Math.max(maxX - minX + PAD * 2, FRAME_MIN_W));
      m = { ox: minX, oy: minY, w, h: maxY - minY + head + PAD, head };
    }
    memo.set(id, m); return m;
  }
  const boxes = new Map<string, Box>();
  const place = (id: string, anchor: Point, rel: Point, depth: number, container: string) => {
    const m = measure(id, depth), kids = kidsOf(id).length, isOpen = open(id, depth);
    boxes.set(id, { id, x: anchor.x + m.ox, y: anchor.y + m.oy, w: m.w, h: m.h, kind: isOpen ? 'frame' : 'node', depth, container, kids, rel, head: m.head });
    if (!isOpen) return;
    const { at } = anchors(id, depth + 1);
    for (const [k, p] of at) place(k, { x: anchor.x + PAD + p.x, y: anchor.y + m.head + p.y }, p, depth + 1, id);
  };
  const top = anchors(scope, 0);
  for (const [k, p] of top.at) place(k, p, p, 0, scope ?? ROOT);

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
    const key = `${a}|${b}|${r.kind}`, e = edges.get(key) ?? { key, from: a, to: b, kind: r.kind, notes: [], ids: [] };
    if (r.note) e.notes.push(r.note); e.ids.push(r.id); edges.set(key, e);
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
