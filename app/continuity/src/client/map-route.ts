/* The map's lines, routed together (map-layout's edgePath routes one line at a time).
 * - Ports: the lines meeting one side of a part spread along that side, in the order of their other ends, so no two lines
 *   enter a part at the same point and none cross each other right at the part.
 * - Nudging: vertical runs that share a gap (and horizontal runs that share a row gap) sit side by side, ordered so that their
 *   horizontal runs cross as few of the others as possible, instead of one on top of another. A run is moved only where the
 *   moved line still touches no box it does not belong to.
 * - quick: while a part is dragged, every line is the plain shape from its ports (no search round other boxes), so lines follow
 *   the hand continuously; the full routing (and a morph from the quick shape) comes when the part is dropped. */
import { edgePath, faceRoute, hintPath, rounded, offRims, LANE_CLEAR, LANE_TRACK, type Box, type Edge, type Point, type Route, type PortFace } from './map-layout.js';
import { FACE_TURNS, turnsOf } from './line-grammar.js';

/** faces: the faces the route really takes (a control line's top or bottom kept only for a route of few turns). */
export interface Routed extends Route { key: string; faces?: { a: PortFace; b: PortFace } }
/** Space between lines that run side by side in one gap (6.7: 12), and the least space between ports on one side. */
/** Beauty v2 B2/B3: runs side by side in one gap sit LANE_TRACK (10) apart, ports on one side PORT_GAP (12) apart and never closer than
 * PORT_MIN (11.5): at the least card-face zoom (0.9) about 9, 10.8 and 10.4 screen pixels. */
export const TRACK_GAP = LANE_TRACK, PORT_GAP = 12, PORT_MIN = 11.5;
/** Beauty v2 review (H2): a side with more ends than fit PORT_MIN apart spreads them no closer than PORT_FLOOR (8.1 screen px at 0.9,
 * the least card-face zoom) rather than sharing a port; ports stay PORT_INSET inside a card's top and bottom (its 10px corners). */
export const PORT_FLOOR = 9, PORT_INSET = 8;
/** The room a spread run keeps off every card when its gap has it (map hygiene review: no run squeezed along a card's edge). */
const RUN_CLEAR = 10;
/** Where a reference's ear sits on a box without one of its own (an untyped card): the head band, at most halfway down. */
export const earY = (b: Box): number => (b.kind === 'node' ? b.y + (b.ear ?? Math.min(20, b.h / 2)) : b.kind === 'frame' ? b.y + b.head / 2 : b.y + b.h / 2);
/** The x where a control line meets a card's top or bottom: the head's left third (the wedge's place, 3.6), lines of one face
 * spread PORT_GAP apart round it in the order of their other ends, kept 8 inside the card's corners. */
function facePorts(boxes: Map<string, Box>, edges: Edge[]): Map<string, { a?: number; b?: number }> {
  const at = new Map<string, { key: string; end: 'a' | 'b'; far: number; fy: number }[]>(), out = new Map<string, { a?: number; b?: number }>();
  for (const e of edges) {
    const f = e.faces; if (!f) continue;
    for (const end of ['a', 'b'] as const) {
      const face = f[end]; if (face !== 'top' && face !== 'bottom') continue;
      const me = boxes.get(end === 'a' ? e.from : e.to), far = boxes.get(end === 'a' ? e.to : e.from); if (!me || !far || me.kind !== 'node') continue;
      // An end over its side's budget gathers apart from the control lines' (at the face's right two-thirds, not the head's left third).
      const k = `${me.id}|${face}${e.overflow?.[end] ? '|over' : ''}`; (at.get(k) ?? at.set(k, []).get(k)!).push({ key: e.key, end, far: far.x + far.w / 2, fy: far.kind === 'frame' ? far.y + far.head / 2 : far.y + (far.contact ?? far.h / 2) });
    }
  }
  for (const [k, list] of at) {
    // Overflow ends sit beside the control lines' run on the side their partners mostly lie (left of it toward the left, right of it
    // toward the right), so their bends never cross the control lines'.
    const over = k.endsWith('|over'), box = boxes.get(k.split('|')[0]!)!, cx = box.x + box.w / 2, leftward = list.filter(p => p.far < cx).length * 2 > list.length;
    const x0 = box.x + (over ? (leftward ? box.w / 6 : (2 * box.w) / 3) : box.w / 3), n = list.length, top = k.includes('|top');
    // Beauty v3 (D.3): the ends whose partners lie to the left first, then those to the right; within each, the order in which their
    // one-bend lines (out of the face, up or down, one turn into the partner's side) nest without crossing: going right, the farther
    // partner takes the x farther from the partner's side.
    const dirOf = (p: { far: number }) => (p.far < cx ? 0 : 1), yKey = (p: { far: number; fy: number }) => ((top ? 1 : -1) * (dirOf(p) ? 1 : -1)) * p.fy;
    list.sort((p, q) => dirOf(p) - dirOf(q) || yKey(p) - yKey(q) || p.far - q.far);
    // Beauty v2 B2: the run of ports is moved whole to stay inside the corners (clamping each port alone stacked them on one point).
    const span = (n - 1) * PORT_GAP, start = Math.max(box.x + 8, Math.min(box.x + box.w - 8 - span, x0 - span / 2));
    // On the half-pixel grid the route search keeps its lanes on (a port off it would leave its first run slanted).
    list.forEach((p, i) => { const x = Math.round((start + i * PORT_GAP) * 2) / 2; const port = out.get(p.key) ?? {}; port[p.end] = x; out.set(p.key, port); });
  }
  return out;
}

type Side = 'l' | 'r' | 'v' | 'in';
/** Which side of a a line to b leaves (edgePath decides the same way): 'in' when one end holds the other (the margin route),
 * 'v' for stacked neighbours (top or bottom), else the side facing b. */
function sideOf(a: Box, b: Box, byId: Map<string, Box>): Side {
  const within = (o: Box, f: Box) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
  if ((a.kind === 'frame' && within(b, a)) || (b.kind === 'frame' && within(a, b))) return 'in';
  if (a.x < b.x + b.w && b.x < a.x + a.w) return 'v';
  return b.x + b.w / 2 > a.x + a.w / 2 ? 'r' : 'l';
}
/** Where a side's lines gather: a group's head row, a typed card's card-level contact point (map design v3 3.6: the contract
 * area's middle), else the box's middle. */
const mid = (x: Box) => (x.kind === 'frame' ? x.y + x.head / 2 : x.contact !== undefined ? x.y + x.contact : x.y + x.h / 2);
/** The pin a line's end is tied to (map design v3 3.6, principle 9): only a model-written portMap row ties a relation end to a pin
 * (the card's pins by '<relationId>|out' at the line's start, '|in' at its end). A port that only shares the payload's name is
 * never a pin for the line. A line drawing several relations takes the pin when one of them is tied. */
export function pinOf(box: Box, e: Edge, end: 'a' | 'b'): number | undefined {
  if (!box.pins || e.key.startsWith('sum:')) return undefined;
  for (const id of e.ids) { const y = box.pins[`${id}|${end === 'a' ? 'out' : 'in'}`]; if (y !== undefined) return box.y + y; }
  return undefined;
}

/** Ports for every line end: on each side of each box, the lines that leave there, spread along the side (a group's head row)
 * by their other end's height, centred on the side's middle. One line keeps the middle.
 * Then a line whose two ends face each other is made straight where it can be: spreading the ports of a busy side moves its
 * line off the middle while the other end keeps its own, and the line would step by a few pixels halfway (on the spine, every
 * step a stair, and no straight run long enough for its verb). One end's port moves to the other's height when that height
 * lies on its side, passes no other port of that side (the order that keeps lines from crossing at the part holds) and the
 * straight run between them crosses no box. The spine's steps go first, then the smallest steps. */
function assignPorts(boxes: Map<string, Box>, edges: Edge[], faced: ReadonlyMap<string, { a: PortFace; b: PortFace }> = new Map()): Map<string, { a?: number; b?: number }> {
  type End = { key: string; end: 'a' | 'b'; far: number };
  const out = new Map<string, { a?: number; b?: number }>(), at = new Map<string, End[]>(), sides = new Map<string, { a: string; b: string; e: Edge }>();
  for (const e of edges) {
    const a = boxes.get(e.from), b = boxes.get(e.to); if (!a || !b) continue;
    const side = sideOf(a, b, boxes); if (side !== 'l' && side !== 'r') continue;
    const other = side === 'r' ? 'l' : 'r', sa = `${a.id}|${side}`, sb = `${b.id}|${other}`, f = faced.get(e.key);
    // An end that keeps a card's top or bottom (a control line) takes no place on a side.
    // Beauty v3 (C): a line with a reserved route is ordered by where it goes next (its first or last row through the columns).
    const ha = e.hint?.ys[0], hb = e.hint?.ys[e.hint.ys.length - 1];
    if (f?.a !== 'top' && f?.a !== 'bottom') (at.get(sa) ?? at.set(sa, []).get(sa)!).push({ key: e.key, end: 'a', far: ha ?? mid(b) });
    if (f?.b !== 'top' && f?.b !== 'bottom') (at.get(sb) ?? at.set(sb, []).get(sb)!).push({ key: e.key, end: 'b', far: hb ?? mid(a) });
    sides.set(e.key, { a: sa, b: sb, e });
  }
  const put = (key: string, end: 'a' | 'b', y: number) => { const port = out.get(key) ?? {}; port[end] = y; out.set(key, port); };
  // An end tied to a pin stands at the pin and never moves; so does a reference's ear (the head band, 3.6: no port, no spread).
  // The side's other lines spread round its contact point.
  const pinned = new Set<string>(), pinnedAt = new Map<string, number[]>();
  for (const [k, list] of [...at]) {
    const box = boxes.get(k.split('|')[0]!)!, free: End[] = [], tied = new Map<number, End[]>();
    for (const p of list) {
      // Beauty v2 B2: a reference's ear takes its place in the side's order like any other end (it was set at the head band, where
      // every reference leaving one side stood on one point).
      const e = sides.get(p.key)!.e, y = pinOf(box, e, p.end);
      if (y === undefined) free.push(p); else { (tied.get(y) ?? tied.set(y, []).get(y)!).push(p); pinned.add(`${p.key}|${p.end}`); }
    }
    // Beauty v2 review (H2/H3): lines tied to one pin meet it side by side, PORT_FLOOR apart across its dot (in the order of their other
    // ends), never on one point (they ran together out of it as one line).
    const ys: number[] = [];
    for (const [y, ps] of tied) { ps.sort((p, q) => p.far - q.far); ps.forEach((p, i) => { const at2 = Math.round((y + (i - (ps.length - 1) / 2) * PORT_FLOOR) * 2) / 2; put(p.key, p.end, at2); ys.push(at2); }); }
    if (ys.length) pinnedAt.set(k, ys);
    if (free.length) at.set(k, free); else at.delete(k);
  }
  for (const [k, list] of at) {
    const box = boxes.get(k.split('|')[0]!)!, side = box.kind === 'frame' ? box.head : box.h;
    list.sort((p, q) => p.far - q.far);
    // Beauty v2 review (H3): a side that also has ends tied to pins spreads its free ends round them (they were spread over the side as
    // if the pins' lines were not there, and a free end met the card a pixel or two from a pinned one).
    const fixedYs = pinnedAt.get(k) ?? [];
    if (fixedYs.length) {
      const inset = box.kind === 'frame' ? 7 : PORT_INSET, n = list.length;
      let slots: number[] = [];
      for (const g of [PORT_GAP, PORT_FLOOR, 6]) {
        slots = [];
        for (let y = Math.ceil((box.y + inset) * 2) / 2; y <= box.y + side - inset + 1e-6; y += 0.5) if (fixedYs.every(f => Math.abs(f - y) >= g) && (!slots.length || y - slots.at(-1)! >= g)) slots.push(y);
        if (slots.length >= n) break;
      }
      if (slots.length >= n) {
        let best = 0, bd = Infinity;
        for (let i = 0; i + n <= slots.length; i++) { const m = (slots[i]! + slots[i + n - 1]!) / 2, d = Math.abs(m - mid(box)); if (d < bd) { bd = d; best = i; } }
        list.forEach((p, i) => put(p.key, p.end, slots[best + i]!));
        continue;
      }
    }
    if (list.length < 2) { put(list[0]!.key, list[0]!.end, mid(box)); continue; }
    // Beauty v2 review (H2): every end has a port of its own. Two lines out of one point ran together and forked further on (a shared
    // bus the ruling forbids: 다른 끝점의 선을 공통 버스에 접합하지 않음), so a busy side spreads its ends closer (PORT_FLOOR at the least)
    // instead of sharing one. PORT_GAP apart while the side has room inside its corners (PORT_INSET: a card's 10px corner is not a
    // port); a side too short even for PORT_FLOOR spreads over its whole room (never two ends on one point). The run is centred on
    // the contact point and kept on the side.
    const n = list.length, inset = box.kind === 'frame' ? 7 : PORT_INSET, room = side - 2 * inset;
    // Under PORT_FLOOR inside the corners, the run takes the corners' room too (4 from the ends) before it goes closer.
    const gap = Math.max(4, room / (n - 1) >= PORT_FLOOR ? Math.min(PORT_GAP, room / (n - 1)) : Math.min(PORT_FLOOR, (side - 8) / (n - 1)));
    const span = (n - 1) * gap, start = span > room ? box.y + (side - span) / 2 : Math.min(Math.max(mid(box) - span / 2, box.y + inset), box.y + side - inset - span);
    // On the half-pixel grid the route search keeps its lanes on (a port off it would leave its last run slanted).
    const s2 = Math.round(start * 2) / 2, g2 = Math.floor(gap * 2) / 2;
    list.forEach((p, i) => put(p.key, p.end, s2 + i * g2));
  }
  const within = (o: Box, f: Box) => { for (let c = o.container, g = 0; c && g < 64; c = boxes.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
  // The boxes a straight run between a and b must not cross (as edgePath reckons them): every box but the two ends, the groups
  // around them and the inside of a group end; the heads of the groups around them do count.
  const straightFree = (a: Box, b: Box, y: number) => {
    const x1 = Math.min(a.x + a.w, b.x + b.w), x2 = Math.max(a.x, b.x);
    return [...boxes.values()].every(o => {
      if (o === a || o === b || (a.kind === 'frame' && within(o, a)) || (b.kind === 'frame' && within(o, b))) return true;
      const h = o.kind === 'frame' && (within(a, o) || within(b, o)) ? o.head : o.h; if (h <= 0) return true;
      return !(x2 > o.x - 1 && x1 < o.x + o.w + 1 && y > o.y - 1 && y < o.y + h + 1);
    });
  };
  const onSide = (k: string, y: number) => { const box = boxes.get(k.split('|')[0]!)!, h = box.kind === 'frame' ? box.head : box.h; return y >= box.y + PORT_MIN && y <= box.y + h - PORT_MIN; };
  // Moving one end from y to to keeps clear of the side's other ports: none between the two heights or within PORT_MIN of to.
  const clearOf = (y: number, from: number, to: number) => y < Math.min(from, to) - PORT_MIN + 0.01 || y > Math.max(from, to) + PORT_MIN - 0.01;
  const canMove = (k: string, key: string, from: number, to: number) => onSide(k, to) && (at.get(k) ?? []).every(p => p.key === key || clearOf(out.get(p.key)![p.end]!, from, to))
    && (pinnedAt.get(k) ?? []).every(y => clearOf(y, from, to));
  const order = [...sides.values()].filter(s => out.get(s.e.key)?.a !== undefined && out.get(s.e.key)?.b !== undefined).sort((p, q) => Number(!!q.e.spine) - Number(!!p.e.spine) || Math.abs(out.get(p.e.key)!.a! - out.get(p.e.key)!.b!) - Math.abs(out.get(q.e.key)!.a! - out.get(q.e.key)!.b!));
  for (const { a: sa, b: sb, e } of order) {
    const port = out.get(e.key)!, ya = port.a!, yb = port.b!; if (Math.abs(ya - yb) < 0.5) continue;
    const A = boxes.get(e.from)!, B = boxes.get(e.to)!;
    // The end on the quieter side moves first (a lone line's port is free to move); else the line's target.
    const tries: ['a' | 'b', string, number, number][] = [['b', sb, yb, ya], ['a', sa, ya, yb]];
    if ((at.get(sa)?.length ?? 0) < (at.get(sb)?.length ?? 0)) tries.reverse();
    const hit = tries.find(([end, k, from, to]) => !pinned.has(`${e.key}|${end}`) && canMove(k, e.key, from, to) && straightFree(A, B, to));
    if (hit) port[hit[0]] = hit[3];
  }
  return out;
}

/** The drag's plain shape of a line through a top or bottom: straight down (or up) to halfway between the two faces, across, and
 * into the other face; null when the faces do not look at each other (the side shape is drawn instead). */
function quickFace(a: Box, b: Box, fa: { face: PortFace; at: number }, fb: { face: PortFace; at: number }): Route | null {
  if (fa.face !== 'bottom' || fb.face !== 'top' || b.y < a.y + a.h + 32) return null;
  const y1 = a.y + a.h, y2 = b.y, ym = (y1 + y2) / 2, pts = Math.abs(fa.at - fb.at) < 1 ? [{ x: fa.at, y: y1 }, { x: fa.at, y: y2 }] : [{ x: fa.at, y: y1 }, { x: fa.at, y: ym }, { x: fb.at, y: ym }, { x: fb.at, y: y2 }];
  return { d: rounded(pts), pts, mx: (fa.at + fb.at) / 2, my: ym, clear: true };
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
function nudge(routes: Map<string, Routed>, blocks: (key: string) => Box[], vertical: boolean, rims: (key: string) => Box[] = () => [], portFree: (s: Seg, at: number, vertical: boolean) => boolean = () => false, owns: (key: string) => Box[] = () => []) {
  // Beauty v2 B3: a moved run (and the runs it joins) never enters the inside of the line's own end cards either (only their ports
  // touch them).
  const fitsAt = (s: Seg, at: number, m: number) => fits(s, at, blocks(s.key), vertical, rims(s.key), m) && fits(s, at, owns(s.key).map(o => ({ ...o, x: o.x + 0.5, y: o.y + 0.5, w: o.w - 1, h: o.h - 1 })), vertical, [], -1);
  const segs: Seg[] = [];
  for (const r of routes.values()) {
    // Beauty v2 B3: a straight line takes part too (its one run is at both its ports; splitRun gives it a middle run when it must move).
    const p = r.pts; if (p.length < 2) continue;
    for (let i = 0; i + 1 < p.length; i++) {
      const A = p[i]!, B = p[i + 1]!, same = vertical ? Math.abs(A.x - B.x) < 0.01 : Math.abs(A.y - B.y) < 0.01;
      // A run of no length (a repeated point) lies both ways: moving it as either would pull its neighbours off the grid.
      if (!same || Math.abs(A.x - B.x) + Math.abs(A.y - B.y) < 0.5) continue;
      const u = vertical ? [A.y, B.y] : [A.x, B.x];
      segs.push({ key: r.key, i, pts: p, lo: Math.min(u[0]!, u[1]!), hi: Math.max(u[0]!, u[1]!), at: vertical ? A.x : A.y, fixed: i === 0 || i + 2 === p.length });
    }
  }
  // Clusters: runs on one line (within 1.5px) whose extents overlap or come within 6px of each other.
  segs.sort((p, q) => p.at - q.at || p.lo - q.lo);
  const clusters: Seg[][] = [];
  for (const s of segs) {
    // Cards v2 review: runs a few pixels apart (closer than half a track) are one cluster too, so they are spread or joined, never
    // left as a striped band.
    // Beauty v2 B3: closer than CROWD (under 8 screen pixels at the least card-face zoom) is one cluster.
    const c = clusters.find(c => c.some(o => Math.abs(o.at - s.at) < CROWD && s.lo < o.hi + 6 && o.lo < s.hi + 6));
    if (c) c.push(s); else clusters.push([s]);
  }
  for (const c of clusters) {
    if (c.length < 2) continue;
    order(c, vertical);
    const centre = c.reduce((a, s) => a + s.at, 0) / c.length, n = c.length, placed: Seg[] = [];
    // Each run in its order takes the place nearest its slot (the slots TRACK_GAP apart, centred on the cluster's line) at
    // which it touches no box it does not belong to and keeps its distance from the runs already placed beside it; a run that
    // finds none stays where it was. A run that hugs a box has its room on the other side, so the search goes both ways.
    // Beauty v2 B3: apart from the runs already placed in this cluster and from every run of another line outside it (a run moved
    // here must not land on a run of the next cluster).
    const inC = new Set(c);
    const apart = (s: Seg, at: number, least: number) => [...placed, ...segs.filter(o => !inC.has(o))].every(o => o.key === s.key || Math.abs(o.at - at) >= least || o.hi < s.lo - 2 || s.hi < o.lo - 2);
    // Beauty v2 B2/B3: a run at a port keeps its place unless it lies on another line's run; then its port moves along its side (to
    // a place on the side PORT_MIN clear of the side's other ends: portFree), so two lines never share one track by their ports.
    for (const s of c.filter(x => x.fixed)) {
      if (!apart(s, s.at, CROWD)) {
        const tries: number[] = []; for (let k = 1; k <= 30; k += 1) tries.push(s.at + k, s.at - k);
        const at = s.pts.length > 2 ? tries.find(x => portFree(s, x, vertical) && fitsAt(s, x, -1) && apart(s, x, CROWD)) : undefined;
        if (at !== undefined) move(s, at, vertical);
        else {
          // Beauty v2 B3: no room at the port: the run keeps a stub of STUB at its port and the rest takes its own track (a small jog
          // by the port), so two lines never share one track because one of them leaves a port there.
          const rest = splitRun(s, segs, vertical, routes);
          if (rest) {
            const near: number[] = []; for (let k = 1; k <= 48; k += 1) near.push(rest.at + k, rest.at - k);
            const to = near.find(x => fitsAt(rest, x, RUN_CLEAR) && apart(rest, x, CROWD)) ?? near.find(x => fitsAt(rest, x, LANE_CLEAR) && apart(rest, x, CROWD));
            if (to !== undefined) { move(rest, to, vertical); placed.push(rest); }
          }
        }
      }
      placed.push(s);
    }
    c.forEach((s, i) => {
      if (s.fixed) return;
      const slot = centre + (i - (n - 1) / 2) * TRACK_GAP, tries = [slot]; for (let k = 2; k <= 48; k += 2) tries.push(slot + k, slot - k);
      // Off the edges of boxes first; a gap too narrow for that lets a run touch an edge rather than lie on another line.
      const ok = (x: number, clear: number) => fitsAt(s, x, clear);
      // Map hygiene review: a place RUN_CLEAR off every card first (within a few px of its slot), so spreading a bundle never
      // pushes a run along a card's edge while the gap has room.
      // Beauty v2 B3: never onto another line's track (the old trunk join) nor a hairline beside it: a run with no room keeps its
      // place, and a port run it lies on moves its rest away (below), or a strip of room is opened (openCorridors).
      // Beauty v2 review (H3): a run with no place apart within 48 looks further (to 96) before it stays on another line: with a
      // selection's own lines drawn one by one a lane holds more lines than the room opened for the map at rest.
      const far: number[] = []; for (let k = 50; k <= 96; k += 2) far.push(slot + k, slot - k);
      const at = tries.slice(0, 9).find(x => ok(x, RUN_CLEAR) && apart(s, x, CROWD)) ?? tries.find(x => ok(x, LANE_CLEAR) && apart(s, x, CROWD)) ?? tries.find(x => ok(x, -1) && apart(s, x, CROWD))
        ?? (apart(s, s.at, CROWD) ? undefined : far.find(x => ok(x, LANE_CLEAR) && apart(s, x, CROWD)));
      if (at !== undefined) move(s, at, vertical);
      placed.push(s);
    });
    // Beauty v2 B3: a run at a port still lying on another line's run (the other had no room to go) keeps its stub and moves the
    // rest of its length to a track of its own.
    for (const s of placed.filter(x => x.fixed)) {
      const clash = placed.some(o => o !== s && o.key !== s.key && Math.abs(o.at - s.at) < CROWD && Math.min(o.hi, s.hi) - Math.max(o.lo, s.lo) > 4);
      if (!clash) continue;
      const rest = splitRun(s, segs, vertical, routes); if (!rest) continue;
      const near: number[] = []; for (let k = 1; k <= 48; k += 1) near.push(rest.at + k, rest.at - k);
      const to = near.find(x => fitsAt(rest, x, RUN_CLEAR) && apart(rest, x, CROWD)) ?? near.find(x => fitsAt(rest, x, LANE_CLEAR) && apart(rest, x, CROWD));
      if (to !== undefined) move(rest, to, vertical);
      placed.push(rest);
    }
  }
}
/** The moved run and the two runs it joins, tested against the boxes the line does not belong to (its own ends may be touched),
 * kept m from them (LANE_CLEAR, as the routes themselves are: a run moved onto a card's edge reads as that card's border) and
 * from the edges of the groups around its ends; m < 0 only keeps the run out of the boxes. */
function fits(s: Seg, at: number, blocks: Box[], vertical: boolean, rims: Box[] = [], m = LANE_CLEAR): boolean {
  // A run at a port (beauty v2 B2) has no joining run on its port's side.
  const p = s.pts, before = p[s.i - 1], after = p[s.i + 2];
  const runs: [number, number, number, number][] = vertical
    ? [[at, s.lo, at, s.hi], ...(before ? [[before.x, before.y, at, before.y] as [number, number, number, number]] : []), ...(after ? [[at, after.y, after.x, after.y] as [number, number, number, number]] : [])]
    : [[s.lo, at, s.hi, at], ...(before ? [[before.x, before.y, before.x, at] as [number, number, number, number]] : []), ...(after ? [[after.x, at, after.x, after.y] as [number, number, number, number]] : [])];
  return runs.every(([x1, y1, x2, y2]) => !blocks.some(o => Math.max(x1, x2) > o.x - m && Math.min(x1, x2) < o.x + o.w + m && Math.max(y1, y2) > o.y - m && Math.min(y1, y2) < o.y + o.h + m) && (m < 0 || offRims(rims, x1, y1, x2, y2, m)));
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

/** Beauty v3 (D.2): the most line ends one side of a card takes: 5 on an 80-high card, 6 on a 104-high one (PORT_GAP apart inside its
 * PORT_INSET corners). */
export const sideBudget = (b: Box): number => (b.h >= 100 ? 6 : 5);
/** Beauty v3 (D.3): a card side over its budget sends its ends whose partner lies wholly above it (or below it, 24 clear) to its top (or
 * bottom) face, the steepest first, until the side is within budget. Only where the geometry is real; the line keeps its stroke and
 * head (the face carries no meaning), its end never shares a port, and no trunk joins it to another line. Returns the faces to take. */
export function faceOverflow(boxes: Map<string, Box>, edges: readonly Edge[]): Map<string, { a?: PortFace; b?: PortFace }> {
  type End = { key: string; end: 'a' | 'b'; me: Box; other: Box };
  const by = new Map<string, End[]>(), out = new Map<string, { a?: PortFace; b?: PortFace }>();
  for (const e of edges) {
    const a = boxes.get(e.from), b = boxes.get(e.to); if (!a || !b) continue;
    const side = sideOf(a, b, boxes); if (side !== 'l' && side !== 'r') continue;
    const other = side === 'r' ? 'l' : 'r', fa = e.faces?.a, fb = e.faces?.b;
    if (fa !== 'top' && fa !== 'bottom' && !pinOf(a, e, 'a')) (by.get(`${a.id}|${side}`) ?? by.set(`${a.id}|${side}`, []).get(`${a.id}|${side}`)!).push({ key: e.key, end: 'a', me: a, other: b });
    if (fb !== 'top' && fb !== 'bottom' && !pinOf(b, e, 'b')) (by.get(`${b.id}|${other}`) ?? by.set(`${b.id}|${other}`, []).get(`${b.id}|${other}`)!).push({ key: e.key, end: 'b', me: b, other: a });
  }
  for (const list of by.values()) {
    const me = list[0]!.me; if (me.kind !== 'node' || list.length <= sideBudget(me)) continue;
    const face = (x: End): PortFace | null => (x.other.y + x.other.h < me.y - 24 ? 'top' : x.other.y > me.y + me.h + 24 ? 'bottom' : null);
    const steep = (x: End) => Math.abs((x.other.y + x.other.h / 2) - (me.y + me.h / 2)) / Math.max(1, Math.abs((x.other.x + x.other.w / 2) - (me.x + me.w / 2)));
    const cands = list.filter(x => face(x)).sort((p, q) => steep(q) - steep(p) || (p.key < q.key ? -1 : 1));
    for (const x of cands.slice(0, list.length - sideBudget(me))) out.set(x.key, { ...out.get(x.key), [x.end]: face(x)! });
  }
  return out;
}

/** Every line of one drawn set (the map's lines, or its summary lines), routed together. */
export function routeEdges(boxes: Map<string, Box>, edgesIn: Edge[], opts: { quick?: boolean } = {}): Map<string, Routed> {
  // Beauty v3 (D): ends over a side's budget take the top or bottom face toward a partner that really lies above or below.
  const over = opts.quick ? new Map<string, { a?: PortFace; b?: PortFace }>() : faceOverflow(boxes, edgesIn);
  const edges = over.size ? edgesIn.map(e => { const o = over.get(e.key); return o ? { ...e, faces: { a: o.a ?? e.faces?.a ?? 'side', b: o.b ?? e.faces?.b ?? 'side' }, overflow: { a: !!o.a, b: !!o.b } } : e; }) : edgesIn;
  // A control line read as such leaves its card's bottom and comes in at the top (map design v3 3.6): routed first, kept only
  // when its route turns at most FACE_TURNS times (else it meets the sides, told by its dash and open head alone). Only cards
  // have those faces; a group, an outside partner or an end that holds the other keeps its side.
  const fx = facePorts(boxes, edges), faceKept = new Map<string, { a: PortFace; b: PortFace }>(), faceRoutes = new Map<string, Route>();
  const cands: { e: Edge; a: Box; b: Box; fa: PortFace; fb: PortFace }[] = [], candFaces = new Map<string, { a: PortFace; b: PortFace }>();
  for (const e of edges) {
    const f = e.faces, a = boxes.get(e.from), b = boxes.get(e.to); if (!f || !a || !b) continue;
    // A face is taken only toward where the other end lies: a bottom when the other end's middle is below this card, a top when
    // it is above. Into the top of a card on the same row the line had to climb over the map and come down again (map hygiene
    // H1: no perimeter runs); such an end keeps its side.
    const toward = (x: Box, o: Box, face: PortFace) => face === 'bottom' ? o.y + o.h / 2 > x.y + x.h : face === 'top' ? o.y + o.h / 2 < x.y : true;
    const fa: PortFace = (f.a === 'top' || f.a === 'bottom') && a.kind === 'node' && toward(a, b, f.a) ? f.a : f.a === 'ear' ? 'ear' : 'side';
    const fb: PortFace = (f.b === 'top' || f.b === 'bottom') && b.kind === 'node' && toward(b, a, f.b) ? f.b : f.b === 'ear' ? 'ear' : 'side';
    if ((fa !== 'top' && fa !== 'bottom' && fb !== 'top' && fb !== 'bottom') || sideOf(a, b, boxes) === 'in') { if (fa === 'ear' || fb === 'ear') faceKept.set(e.key, { a: fa, b: fb }); continue; }
    cands.push({ e, a, b, fa, fb }); candFaces.set(e.key, { a: fa, b: fb });
  }
  // Beauty v3: a face line's side end takes its own port on that side (spread with the side's other ends), never the side's middle
  // where another line already meets it. Ports are spread with every face line first; when some fall back to their sides, again.
  const faceRun = (pp: Map<string, { a?: number; b?: number }>, c: (typeof cands)[number]) => {
    const px = fx.get(c.e.key) ?? {}, pt = pp.get(c.e.key) ?? {}, at = (box: Box, face: PortFace, x: number | undefined, side: number | undefined) => ({ face, at: face === 'top' || face === 'bottom' ? x ?? box.x + box.w / 3 : side ?? mid(box) });
    const r = opts.quick ? quickFace(c.a, c.b, at(c.a, c.fa, px.a, pt.a), at(c.b, c.fb, px.b, pt.b)) : faceRoute(c.a, c.b, boxes.values(), at(c.a, c.fa, px.a, pt.a), at(c.b, c.fb, px.b, pt.b));
    return r && turnsOf(r.pts) <= FACE_TURNS ? r : null;
  };
  const ports0 = cands.length ? assignPorts(boxes, edges, new Map([...faceKept, ...candFaces])) : new Map<string, { a?: number; b?: number }>();
  for (const c of cands) { const r = faceRun(ports0, c); if (r) { faceKept.set(c.e.key, { a: c.fa, b: c.fb }); faceRoutes.set(c.e.key, r); } }
  const ports = assignPorts(boxes, edges, faceKept), out = new Map<string, Routed>();
  if (cands.some(c => !faceRoutes.has(c.e.key))) for (const c of cands) {
    if (!faceRoutes.has(c.e.key)) continue;
    const was = ports0.get(c.e.key) ?? {}, now = ports.get(c.e.key) ?? {};
    if (was.a === now.a && was.b === now.b) continue;
    const r = faceRun(ports, c); if (r) faceRoutes.set(c.e.key, r);
  }
  for (const e of edges) {
    const a = boxes.get(e.from), b = boxes.get(e.to); if (!a || !b) continue;
    // Beauty v3 (C.4): a line with a reserved route (its hint from the layered layout) takes it when every run of it is free; else the
    // search as before.
    const p = ports.get(e.key) ?? {}, fr = faceRoutes.get(e.key), r = fr ?? (opts.quick ? quickRoute(a, b, p.a, p.b, boxes) : (e.hint && hintPath(a, b, boxes.values(), p, e.hint)) || edgePath(a, b, boxes.values(), p));
    // The faces the line really takes: its kept top or bottom, else its sides (an ear stays an ear).
    const f = fr ? faceKept.get(e.key) : e.faces ? { a: e.faces.a === 'ear' ? 'ear' : 'side', b: e.faces.b === 'ear' ? 'ear' : 'side' } as const : undefined;
    out.set(e.key, { key: e.key, ...r, pts: r.pts.map(q => ({ ...q })), ...(f ? { faces: f } : {}) });
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
  // The groups around a line's ends are not in its way, but their edges are (edgePath keeps its corridors off them too).
  const rimsOf = new Map<string, Box[]>();
  const rims = (key: string) => {
    const hit = rimsOf.get(key); if (hit) return hit;
    const e = edges.find(x => x.key === key)!, a = boxes.get(e.from)!, b = boxes.get(e.to)!;
    const list = opts.quick ? [] : [...boxes.values()].filter(o => o.kind === 'frame' && o !== a && o !== b && (within(a, o) || within(b, o)));
    rimsOf.set(key, list); return list;
  };
  // Beauty v2 B2: where a run at a port may move: along its own side, inside the side's corners, PORT_MIN clear of the other line
  // ends on that side (the side's order kept).
  const portFree = (s: Seg, at: number, vertical: boolean): boolean => {
    if (opts.quick) return false;
    const e = edges.find(x => x.key === s.key), first = s.i === 0, box = e ? boxes.get(first ? e.from : e.to) : undefined; if (!e || !box) return false;
    const p = first ? s.pts[0]! : s.pts[s.pts.length - 1]!, along = vertical ? p.x : p.y;
    if (vertical ? at < box.x + 8 || at > box.x + box.w - 8 : at < box.y + 7 || at > box.y + (box.kind === 'frame' ? box.head : box.h) - 7) return false;
    for (const r of out.values()) for (const q of [r.pts[0]!, r.pts[r.pts.length - 1]!]) {
      if (r.key === s.key) continue;
      const sameSide = vertical ? Math.abs(q.y - p.y) < 0.6 && q.x >= box.x && q.x <= box.x + box.w : Math.abs(q.x - p.x) < 0.6 && q.y >= box.y && q.y <= box.y + box.h;
      if (!sameSide) continue;
      const v = vertical ? q.x : q.y;
      if (Math.abs(v - at) < PORT_MIN || (v - along) * (v - at) < 0) return false;
    }
    return true;
  };
  const owns = (key: string) => { const e = edges.find(x => x.key === key); return e ? [boxes.get(e.from), boxes.get(e.to)].filter((b): b is Box => !!b && b.kind !== 'frame') : []; };
  nudge(out, blocks, true, rims, portFree, owns); nudge(out, blocks, false, rims, portFree, owns);
  // Beauty v2 B3: the horizontal pass lengthens or adds vertical runs (its moves and jogs); one more vertical pass parts them.
  if (!opts.quick) nudge(out, blocks, true, rims, portFree, owns);
  // Beauty v2 review (H3): that vertical pass moves the turns of level runs, so two level runs can come to overlap where they did not
  // (a run reaching 17 past the turn of another, 4 apart); one more level pass and one more vertical pass part them.
  if (!opts.quick) { nudge(out, blocks, false, rims, portFree, owns); nudge(out, blocks, true, rims, portFree, owns); }
  for (const r of out.values()) {
    r.pts = cleanPts(r.pts);
    if (r.pts.length >= 3 || !opts.quick) { r.d = rounded(r.pts); const m = Math.floor((r.pts.length - 1) / 2); r.mx = (r.pts[m]!.x + r.pts[m + 1]!.x) / 2; r.my = (r.pts[m]!.y + r.pts[m + 1]!.y) / 2; }
  }
  return out;
}

/** The stub a run at a port keeps when the rest of it moves to a track of its own (splitRun), and the least run that is split. */
const STUB = 16, PORT_RUN = 40;
/** Splits a run at a port (s, fixed) longer than PORT_RUN into its stub (STUB long, kept at the port, still s) and the rest (a
 * middle run, returned, which the caller may move): a repeated point between them, so moving the rest makes a jog by the stub. A
 * straight line keeps a stub at each end. The other runs of the same route keep their places (their indices follow). null when the
 * run is too short to split. */
function splitRun(s: Seg, all: Seg[], vertical: boolean, routes: ReadonlyMap<string, Routed> = new Map()): Seg | null {
  const p = s.pts, len = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const toward = (a: Point, b: Point, d: number): Point => { const l = len(a, b) || 1; return { x: a.x + ((b.x - a.x) / l) * d, y: a.y + ((b.y - a.y) / l) * d }; };
  const A = p[s.i]!, B = p[s.i + 1]!; if (len(A, B) <= PORT_RUN) return null;
  // The jog's place: STUB from the port, or a track further when another line already runs across there (the jogs of lines leaving
  // neighbouring ports would otherwise lie on one line).
  const free = (q: Point) => { for (const r of routes.values()) { if (r.key === s.key) continue; for (let i = 0; i + 1 < r.pts.length; i++) {
    const u = r.pts[i]!, v = r.pts[i + 1]!, across = vertical ? Math.abs(u.y - v.y) < 0.01 : Math.abs(u.x - v.x) < 0.01; if (!across) continue;
    const at = vertical ? u.y : u.x, lo = vertical ? Math.min(u.x, v.x) : Math.min(u.y, v.y), hi = vertical ? Math.max(u.x, v.x) : Math.max(u.y, v.y);
    if (Math.abs(at - (vertical ? q.y : q.x)) < CROWD && lo < s.at + 30 && hi > s.at - 30) return false; } } return true; };
  const stubFrom = (port: Point, other: Point) => { for (let d = STUB; d <= len(port, other) - STUB; d += TRACK_GAP) if (free(toward(port, other, d))) return d; return STUB; };
  const extent = (a: Point, b: Point) => (vertical ? [Math.min(a.y, b.y), Math.max(a.y, b.y)] : [Math.min(a.x, b.x), Math.max(a.x, b.x)]) as [number, number];
  const bump = (from: number, by: number) => { for (const o of all) if (o.pts === p && o !== s && o.i >= from) o.i += by; };
  let restI: number;
  if (p.length === 2) {
    const a = toward(A, B, stubFrom(A, B)), b = toward(B, A, stubFrom(B, A));
    p.splice(1, 0, a, { ...a }, { ...b }, b); restI = 2; // [A, a, a', b', b, B]: s is the stub A–a
  } else if (s.i === 0) {
    const a = toward(A, B, stubFrom(A, B)); p.splice(1, 0, a, { ...a }); bump(1, 2); restI = 2; // [A, a, a', B, ...]
  } else {
    const b = toward(B, A, stubFrom(B, A)); p.splice(s.i + 1, 0, { ...b }, b); restI = s.i; s.i = s.i + 2; // [..., A, b', b, B]: s is the stub b–B
  }
  [s.lo, s.hi] = extent(p[s.i]!, p[s.i + 1]!);
  const ra = p[restI]!, rb = p[restI + 1]!, [lo, hi] = extent(ra, rb);
  const rest: Seg = { key: s.key, i: restI, pts: p, lo, hi, at: s.at, fixed: false }; all.push(rest);
  return rest;
}
/** Repeated points and points on a straight run between two others dropped (the corners of the route). */
function cleanPts(raw: Point[]): Point[] {
  const p = raw.filter((q, n) => n === 0 || Math.abs(q.x - raw[n - 1]!.x) + Math.abs(q.y - raw[n - 1]!.y) > 0.01);
  return p.filter((q, n) => n === 0 || n === p.length - 1 || !((Math.abs(p[n - 1]!.x - q.x) < 0.01 && Math.abs(q.x - p[n + 1]!.x) < 0.01) || (Math.abs(p[n - 1]!.y - q.y) < 0.01 && Math.abs(q.y - p[n + 1]!.y) < 0.01)));
}

/* ---------- beauty v2 B3: corridors opened where the routed lines still crowd ---------- */
/** Runs of two different lines closer than this (map units) crowd: at the least card-face zoom (0.9) under 8 screen pixels. */
export const CROWD = 8 / 0.9;
/** A strip opened across the map: every top-level box wholly past `at` (below it for 'y', right of it for 'x') moves by d. */
export interface Strip { axis: 'x' | 'y'; at: number; d: number }
/** Where routed lines crowd: parallel runs of two different lines that overlap along their length (more than 4) closer than CROWD.
 * Beauty v2 review (H2): two runs out of one shared point are a crowd too (no port is shared any more). Each place once (within 24). */
export function crowdedAt(routes: ReadonlyMap<string, Routed>, _edges: readonly Edge[] = []): { axis: 'x' | 'y'; at: number; lo: number; hi: number; len: number }[] {
  type S = { key: string; hz: boolean; at: number; lo: number; hi: number; A: Point; B: Point; first: boolean; last: boolean };
  const segs: S[] = [];
  for (const r of routes.values()) {
    const p = r.pts;
    for (let i = 0; i + 1 < p.length; i++) {
      const A = p[i]!, B = p[i + 1]!, hz = Math.abs(A.y - B.y) < 0.5, vt = Math.abs(A.x - B.x) < 0.5; if (!hz && !vt) continue;
      if (Math.abs(A.x - B.x) + Math.abs(A.y - B.y) < 3) continue;
      segs.push({ key: r.key, hz, at: hz ? A.y : A.x, lo: hz ? Math.min(A.x, B.x) : Math.min(A.y, B.y), hi: hz ? Math.max(A.x, B.x) : Math.max(A.y, B.y), A, B, first: i === 0, last: i + 2 === p.length });
    }
  }
  const out: { axis: 'x' | 'y'; at: number; lo: number; hi: number; len: number }[] = [];
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const a = segs[i]!, b = segs[j]!; if (a.key === b.key || a.hz !== b.hz) continue;
    const ov = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo); if (ov <= 4 || Math.abs(a.at - b.at) >= CROWD) continue;
    const at = (a.at + b.at) / 2, axis = a.hz ? 'y' : 'x', lo = Math.max(a.lo, b.lo), hi = Math.min(a.hi, b.hi);
    const same = out.find(o => o.axis === axis && Math.abs(o.at - at) < 24 && lo < o.hi && o.lo < hi);
    if (same) same.len += ov; else out.push({ axis, at, lo, hi, len: ov });
  }
  return out;
}
/** Opens strips where the lines crowd (beauty v2 B3, the ruling's 국소 재배치): routes the lines, finds the crowded places and moves
 * every top-level box wholly past each place (and everything inside it) by two tracks, so the gap there widens across the whole map
 * (the order of the parts, and left to right, are kept; nothing overlaps); again, up to `rounds` times or until no place crowds. A
 * place inside a group's box, or that no top-level box lies past, is left (the group keeps its own arrangement). Mutates the boxes
 * (their place and their stored-relative place alike); returns the strips opened, in order, for whatever else is placed by the
 * same coordinates (the outside partners' heads). Positions only: no id, end, kind or relation changes. */
export function openCorridors(boxes: Map<string, Box>, edges: readonly Edge[], rounds = 6): Strip[] {
  const strips: Strip[] = [];
  const top = (b: Box): Box => { let c: Box = b; for (let g = 0; g < 64; g++) { const up = boxes.get(c.container); if (!up) return c; c = up; } return c; };
  const crowd = () => crowdedAt(routeEdges(boxes, [...edges]), edges);
  const shift = (ids: Set<string>, axis: 'x' | 'y', d: number) => shiftTops(boxes, ids, axis, d);
  // How badly the lines crowd: the length they run crowded, summed.
  const worse = (c: { len: number }[]) => c.reduce((a, x) => a + x.len, 0);
  let now = crowd(), tried = 0;
  for (let round = 0; round < rounds && now.length; round++) {
    const tops = [...boxes.values()].filter(b => top(b) === b);
    let moved = false;
    // From the far end back, so each strip's place is still where it was found. A strip is kept only when the lines crowd in fewer
    // places with it (a crowd it cannot part, two lines held at one height by their ports, is left to the nudging).
    for (const p of [...now].sort((a, b) => (a.axis === b.axis ? b.at - a.at : a.axis < b.axis ? -1 : 1))) {
      if (tried++ > 40) break;
      const lo = (b: Box) => (p.axis === 'y' ? b.y : b.x), hi = (b: Box) => (p.axis === 'y' ? b.y + b.h : b.x + b.w);
      if (tops.some(b => b.kind === 'frame' && lo(b) < p.at && p.at < hi(b))) continue;
      const past = new Set(tops.filter(b => lo(b) >= p.at).map(b => b.id)); if (!past.size) continue;
      // Two tracks first, then four (a street too narrow for the router to choose two rows in it).
      for (const d of [TRACK_GAP * 2, TRACK_GAP * 4]) {
        shift(past, p.axis, d);
        const next = crowd();
        if (worse(next) < worse(now) - 0.5) { strips.push({ axis: p.axis, at: p.at, d }); now = next; moved = true; break; }
        shift(past, p.axis, -d);
      }
    }
    if (!moved) break;
  }
  return strips;
}
/** The top-level box holding b (b itself at the top). */
function topOf(boxes: ReadonlyMap<string, Box>, b: Box): Box { let c: Box = b; for (let g = 0; g < 64; g++) { const up = boxes.get(c.container); if (!up) return c; c = up; } return c; }
/** Moves the top-level boxes ids (and everything inside them) by d along axis: their place and their stored-relative place alike. */
function shiftTops(boxes: Map<string, Box>, ids: ReadonlySet<string>, axis: 'x' | 'y', d: number) {
  for (const b of boxes.values()) { const t = topOf(boxes, b); if (!ids.has(t.id)) continue;
    if (axis === 'y') { b.y += d; if (t === b) b.rel = { x: b.rel.x, y: b.rel.y + d }; } else { b.x += d; if (t === b) b.rel = { x: b.rel.x + d, y: b.rel.y }; } }
}
/** Beauty v2 review (H1): the strips openCorridors opened on the automatic arrangement, laid again on a layout of the same parts: in
 * their order, each moves the top-level boxes wholly past it, as openCorridors did, except the boxes in `keep` (a place of the
 * person's, stored or held: it is where the person put it, already in the opened map's coordinates). So the parts the person did not
 * place stand where they stood before a drag, whatever the person placed. Positions only. */
export function applyStrips(boxes: Map<string, Box>, strips: readonly Strip[], keep: ReadonlySet<string> = new Set()) {
  for (const s of strips) {
    const past = new Set([...boxes.values()].filter(b => topOf(boxes, b) === b && !keep.has(b.id) && (s.axis === 'y' ? b.y : b.x) >= s.at).map(b => b.id));
    if (past.size) shiftTops(boxes, past, s.axis, s.d);
  }
}
/** A point moved by the strips opened (in their order), as the boxes past them were. */
export function stripShift(strips: readonly Strip[], x: number, y: number): { x: number; y: number } {
  for (const s of strips) { if (s.axis === 'y' && y >= s.at) y += s.d; if (s.axis === 'x' && x >= s.at) x += s.d; }
  return { x, y };
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
