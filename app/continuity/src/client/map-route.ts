/* The map's lines, routed together (map-layout's edgePath routes one line at a time).
 * - Ports: the lines meeting one side of a part spread along that side, in the order of their other ends, so no two lines
 *   enter a part at the same point and none cross each other right at the part.
 * - Nudging: vertical runs that share a gap (and horizontal runs that share a row gap) sit side by side, ordered so that their
 *   horizontal runs cross as few of the others as possible, instead of one on top of another. A run is moved only where the
 *   moved line still touches no box it does not belong to.
 * - quick: while a part is dragged, every line is the plain shape from its ports (no search round other boxes), so lines follow
 *   the hand continuously; the full routing (and a morph from the quick shape) comes when the part is dropped. */
import { edgePath, rounded, type Box, type Edge, type Point, type Route } from './map-layout.js';

export interface Routed extends Route { key: string }
/** Space between lines that run side by side in one gap, and the least space between ports on one side. */
export const TRACK_GAP = 9, PORT_GAP = 12, PORT_MIN = 7;

type Side = 'l' | 'r' | 'v' | 'in';
/** Which side of a a line to b leaves (edgePath decides the same way): 'in' when one end holds the other (the margin route),
 * 'v' for stacked neighbours (top or bottom), else the side facing b. */
function sideOf(a: Box, b: Box, byId: Map<string, Box>): Side {
  const within = (o: Box, f: Box) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
  if ((a.kind === 'frame' && within(b, a)) || (b.kind === 'frame' && within(a, b))) return 'in';
  if (a.x < b.x + b.w && b.x < a.x + a.w) return 'v';
  return b.x + b.w / 2 > a.x + a.w / 2 ? 'r' : 'l';
}
const mid = (x: Box) => (x.kind === 'frame' ? x.y + x.head / 2 : x.y + x.h / 2);

/** Ports for every line end: on each side of each box, the lines that leave there, spread along the side (a group's head row)
 * by their other end's height, centred on the side's middle. One line keeps the middle. */
function assignPorts(boxes: Map<string, Box>, edges: Edge[]): Map<string, { a?: number; b?: number }> {
  const out = new Map<string, { a?: number; b?: number }>(), at = new Map<string, { key: string; end: 'a' | 'b'; far: number }[]>();
  for (const e of edges) {
    const a = boxes.get(e.from), b = boxes.get(e.to); if (!a || !b) continue;
    const side = sideOf(a, b, boxes); if (side !== 'l' && side !== 'r') continue;
    const other = side === 'r' ? 'l' : 'r';
    (at.get(`${a.id}|${side}`) ?? at.set(`${a.id}|${side}`, []).get(`${a.id}|${side}`)!).push({ key: e.key, end: 'a', far: mid(b) });
    (at.get(`${b.id}|${other}`) ?? at.set(`${b.id}|${other}`, []).get(`${b.id}|${other}`)!).push({ key: e.key, end: 'b', far: mid(a) });
  }
  for (const [k, list] of at) {
    if (list.length < 2) continue;
    const box = boxes.get(k.split('|')[0]!)!, room = (box.kind === 'frame' ? box.head : box.h) - 14, n = list.length;
    const gap = Math.max(PORT_MIN, Math.min(PORT_GAP, room / (n - 1)));
    list.sort((p, q) => p.far - q.far);
    list.forEach((p, i) => { const port = out.get(p.key) ?? {}; port[p.end] = mid(box) + (i - (n - 1) / 2) * gap; out.set(p.key, port); });
  }
  return out;
}

/** The plain shape of a line from its ports, with no regard to what lies between (the drag's continuous shape). */
function quickRoute(a: Box, b: Box, pa: number | undefined, pb: number | undefined, byId: Map<string, Box>): Route {
  const side = sideOf(a, b, byId);
  if (side === 'v') {
    const down = b.y + b.h / 2 > a.y + a.h / 2, y1 = down ? a.y + a.h : a.y, y2 = down ? b.y : b.y + b.h;
    const x1 = Math.max(a.x, b.x) + (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) / 2, pts = [{ x: x1, y: y1 }, { x: x1, y: y2 }];
    return { d: rounded(pts), pts, mx: x1, my: (y1 + y2) / 2, clear: true };
  }
  if (side === 'in') return edgePath(a, b, byId.values());
  const right = side === 'r', x1 = right ? a.x + a.w : a.x, x2 = right ? b.x : b.x + b.w, ay = pa ?? mid(a), by = pb ?? mid(b);
  const xm = (x1 + x2) / 2, pts = Math.abs(ay - by) < 1 ? [{ x: x1, y: ay }, { x: x2, y: ay }] : [{ x: x1, y: ay }, { x: xm, y: ay }, { x: xm, y: by }, { x: x2, y: by }];
  return { d: rounded(pts), pts, mx: xm, my: (ay + by) / 2, clear: true };
}

type Seg = { key: string; i: number; pts: Point[]; lo: number; hi: number; at: number; fixed: boolean };
/** Runs of one direction (vertical: same x; horizontal: same y) that lie on one line and overlap or nearly touch, moved apart.
 * A run that starts or ends at a port (the first or last run) keeps its place: moving it would move the port. */
function nudge(routes: Map<string, Routed>, blocks: (key: string) => Box[], vertical: boolean) {
  const segs: Seg[] = [];
  for (const r of routes.values()) {
    const p = r.pts; if (p.length < 3) continue;
    for (let i = 0; i + 1 < p.length; i++) {
      const A = p[i]!, B = p[i + 1]!, same = vertical ? Math.abs(A.x - B.x) < 0.01 : Math.abs(A.y - B.y) < 0.01;
      if (!same) continue;
      const u = vertical ? [A.y, B.y] : [A.x, B.x];
      segs.push({ key: r.key, i, pts: p, lo: Math.min(u[0]!, u[1]!), hi: Math.max(u[0]!, u[1]!), at: vertical ? A.x : A.y, fixed: i === 0 || i + 2 === p.length });
    }
  }
  // Clusters: runs on one line (within 1.5px) whose extents overlap or come within 6px of each other.
  segs.sort((p, q) => p.at - q.at || p.lo - q.lo);
  const clusters: Seg[][] = [];
  for (const s of segs) {
    const c = clusters.find(c => Math.abs(c[0]!.at - s.at) < 1.5 && c.some(o => s.lo < o.hi + 6 && o.lo < s.hi + 6));
    if (c) c.push(s); else clusters.push([s]);
  }
  for (const c of clusters) {
    if (c.length < 2 || c.every(s => s.fixed)) continue;
    order(c, vertical);
    const centre = c.reduce((a, s) => a + s.at, 0) / c.length, n = c.length, placed: Seg[] = c.filter(s => s.fixed);
    // Each run in its order takes the place nearest its slot (the slots TRACK_GAP apart, centred on the cluster's line) at
    // which it touches no box it does not belong to and keeps its distance from the runs already placed beside it; a run that
    // finds none stays where it was. A run that hugs a box has its room on the other side, so the search goes both ways.
    const apart = (s: Seg, at: number, least: number) => placed.every(o => Math.abs(o.at - at) >= least || o.hi < s.lo - 2 || s.hi < o.lo - 2);
    c.forEach((s, i) => {
      if (s.fixed) return;
      const slot = centre + (i - (n - 1) / 2) * TRACK_GAP, tries = [slot]; for (let k = 2; k <= 48; k += 2) tries.push(slot + k, slot - k);
      // A gap too narrow for the full spacing (a list's columns) still keeps its runs a hairline apart where it can.
      const at = tries.find(x => fits(s, x, blocks(s.key), vertical) && apart(s, x, TRACK_GAP - 1)) ?? tries.find(x => fits(s, x, blocks(s.key), vertical) && apart(s, x, 3));
      if (at !== undefined) move(s, at, vertical);
      placed.push(s);
    });
  }
}
/** The moved run and the two runs it joins, tested against the boxes the line does not belong to (its own ends may be touched). */
function fits(s: Seg, at: number, blocks: Box[], vertical: boolean): boolean {
  const p = s.pts, before = p[s.i - 1]!, after = p[s.i + 2]!;
  const runs: [number, number, number, number][] = vertical
    ? [[at, s.lo, at, s.hi], [before.x, before.y, at, before.y], [at, after.y, after.x, after.y]]
    : [[s.lo, at, s.hi, at], [before.x, before.y, before.x, at], [after.x, at, after.x, after.y]];
  return runs.every(([x1, y1, x2, y2]) => !blocks.some(o => Math.max(x1, x2) > o.x + 1 && Math.min(x1, x2) < o.x + o.w - 1 && Math.max(y1, y2) > o.y + 1 && Math.min(y1, y2) < o.y + o.h - 1));
}
function move(s: Seg, at: number, vertical: boolean) {
  const p = s.pts; if (vertical) { p[s.i]!.x = at; p[s.i + 1]!.x = at; } else { p[s.i]!.y = at; p[s.i + 1]!.y = at; }
  s.at = at;
}
/** The order of the runs in one cluster, lowest coordinate first: of two runs, the one on the lower side is the one whose
 * joining runs, reaching across the other, would cross it less (a run's joining horizontal crosses the other vertical when it
 * reaches past it at a height inside the other's extent). Pairwise, settled by passes, since the preference is not always
 * transitive; ties keep the order of the runs' first ends. */
function order(c: Seg[], vertical: boolean) {
  // A run at a port (fixed) has no joining run on that side: its own end stands in, reaching nowhere.
  const reach = (s: Seg) => { const p = s.pts, b = p[s.i - 1] ?? p[s.i]!, a = p[s.i + 2] ?? p[s.i + 1]!; return vertical ? [{ to: b.x, at: b.y }, { to: a.x, at: a.y }] : [{ to: b.y, at: b.x }, { to: a.y, at: a.x }]; };
  const cost = (lo: Seg, hi: Seg) => reach(lo).filter(r => r.to > hi.at && r.at > hi.lo && r.at < hi.hi).length + reach(hi).filter(r => r.to < lo.at && r.at > lo.lo && r.at < lo.hi).length;
  const prefer = (p: Seg, q: Seg) => { const a = cost(p, q), b = cost(q, p); return a !== b ? a - b : reach(p)[0]!.at - reach(q)[0]!.at; };
  for (let pass = 0; pass < c.length; pass++) { let swapped = false; for (let i = 0; i + 1 < c.length; i++) if (prefer(c[i]!, c[i + 1]!) > 0) { [c[i], c[i + 1]] = [c[i + 1]!, c[i]!]; swapped = true; } if (!swapped) break; }
}

/** Every line of one drawn set (the map's lines, or its summary lines), routed together. */
export function routeEdges(boxes: Map<string, Box>, edges: Edge[], opts: { quick?: boolean } = {}): Map<string, Routed> {
  const ports = assignPorts(boxes, edges), out = new Map<string, Routed>();
  for (const e of edges) {
    const a = boxes.get(e.from), b = boxes.get(e.to); if (!a || !b) continue;
    const p = ports.get(e.key) ?? {}, r = opts.quick ? quickRoute(a, b, p.a, p.b, boxes) : edgePath(a, b, boxes.values(), p);
    out.set(e.key, { key: e.key, ...r, pts: r.pts.map(q => ({ ...q })) });
  }
  // What a line must keep off while it is nudged: every box but its own two ends and the groups around them.
  const byId = boxes, within = (o: Box, f: Box) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
  const blocksOf = new Map<string, Box[]>();
  const blocks = (key: string) => {
    const hit = blocksOf.get(key); if (hit) return hit;
    const e = edges.find(x => x.key === key)!, a = boxes.get(e.from)!, b = boxes.get(e.to)!;
    const list = opts.quick ? [] : [...boxes.values()].filter(o => o !== a && o !== b && !(o.kind === 'frame' && (within(a, o) || within(b, o))) && !(a.kind === 'frame' && within(o, a)) && !(b.kind === 'frame' && within(o, b)));
    blocksOf.set(key, list); return list;
  };
  nudge(out, blocks, true); nudge(out, blocks, false);
  for (const r of out.values()) if (r.pts.length >= 3) { r.d = rounded(r.pts); const m = Math.floor((r.pts.length - 1) / 2); r.mx = (r.pts[m]!.x + r.pts[m + 1]!.x) / 2; r.my = (r.pts[m]!.y + r.pts[m + 1]!.y) / 2; }
  return out;
}

/** Points along a path at even steps, for a morph between two routes of any shape. */
export function samplePath(path: SVGPathElement, n: number): Point[] {
  const len = path.getTotalLength(), out: Point[] = [];
  for (let i = 0; i <= n; i++) { const q = path.getPointAtLength((len * i) / n); out.push({ x: q.x, y: q.y }); }
  return out;
}
/** The polyline through sampled points, mixed between two samplings (t from 0 to 1). */
export function mixPath(from: Point[], to: Point[], t: number): string {
  let d = '';
  for (let i = 0; i < to.length; i++) { const a = from[i] ?? to[i]!, b = to[i]!; d += `${i ? ' L' : 'M'}${(a.x + (b.x - a.x) * t).toFixed(1)},${(a.y + (b.y - a.y) * t).toFixed(1)}`; }
  return d;
}
