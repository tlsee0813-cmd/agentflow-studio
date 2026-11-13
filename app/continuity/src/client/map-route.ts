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
import { sideSlots, pinSlots, sideCapacity, PORT_PITCH, PORT_FLOOR as FLOOR, PORT_INSET as INSET, FRAME_INSET } from './port-slots.js';

/** faces: the faces the route really takes (a control line's top or bottom kept only for a route of few turns). lane: it keeps the route
 * its layout reserved (beauty v5: the nudging moves the other lines round it). */
export interface Routed extends Route { key: string; faces?: { a: PortFace; b: PortFace }; lane?: boolean }
/** Space between lines that run side by side in one gap (6.7: 12), and the least space between ports on one side. */
/** Beauty v2 B2/B3: runs side by side in one gap sit LANE_TRACK (10) apart, ports on one side PORT_GAP (12) apart and never closer than
 * PORT_MIN (11.5): at the least card-face zoom (0.9) about 9, 10.8 and 10.4 screen pixels. */
export const TRACK_GAP = LANE_TRACK, PORT_GAP = PORT_PITCH, PORT_MIN = 11.5;
/** Beauty v2 review (H2): a side with more ends than fit PORT_MIN apart spreads them no closer than PORT_FLOOR (8.1 screen px at 0.9,
 * the least card-face zoom) rather than sharing a port; ports stay PORT_INSET inside a card's top and bottom (its 10px corners). */
export const PORT_FLOOR = FLOOR, PORT_INSET = INSET;
/** The room a spread run keeps off every card when its gap has it (map hygiene review: no run squeezed along a card's edge). */
const RUN_CLEAR = 10;
/** Where a reference's ear sits on a box without one of its own (an untyped card): the head band, at most halfway down. */
export const earY = (b: Box): number => (b.kind === 'node' ? b.y + (b.ear ?? Math.min(20, b.h / 2)) : b.kind === 'frame' ? b.y + b.head / 2 : b.y + b.h / 2);
/** The x where a control line meets a card's top or bottom: the head's left third (the wedge's place, 3.6), lines of one face
 * spread PORT_GAP apart round it in the order of their other ends, kept 8 inside the card's corners. */
function facePorts(boxes: Map<string, Box>, edges: Edge[], sidePorts: ReadonlyMap<string, { a?: number; b?: number }> = new Map(), pairGap = 0): Map<string, { a?: number; b?: number }> {
  const byKey = new Map(edges.map(e => [e.key, e]));
  const at = new Map<string, { key: string; end: 'a' | 'b'; far: number; fy: number; pp: number }[]>(), out = new Map<string, { a?: number; b?: number }>();
  for (const e of edges) {
    const f = e.faces; if (!f) continue;
    for (const end of ['a', 'b'] as const) {
      const face = f[end]; if (face !== 'top' && face !== 'bottom') continue;
      const me = boxes.get(end === 'a' ? e.from : e.to), far = boxes.get(end === 'a' ? e.to : e.from); if (!me || !far || me.kind !== 'node') continue;
      // An end over its side's budget gathers apart from the control lines' (at the face's right two-thirds, not the head's left third).
      // Beauty v5 lanes review 2: the partner end's port (its side port, else its planned one, else the partner's contact point) parts
      // the two lines of a pair running both ways, which otherwise tie (one partner) and stood in the input's order.
      const fy = far.kind === 'frame' ? far.y + far.head / 2 : far.y + (far.contact ?? far.h / 2), o = end === 'a' ? 'b' : 'a';
      const k = `${me.id}|${face}${e.overflow?.[end] ? '|over' : ''}`; (at.get(k) ?? at.set(k, []).get(k)!).push({ key: e.key, end, far: far.x + far.w / 2, fy, pp: sidePorts.get(e.key)?.[o] ?? e.hint?.ports?.[o] ?? fy });
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
    // Ties (one partner): by the partner end's port in the same nesting, then the line's start before its end (toward a partner on the
    // right; its end first toward one on the left: two lines face to face both ways turn near their targets, and so nest without
    // crossing), then the key, so the order never depends on the input's.
    list.sort((p, q) => dirOf(p) - dirOf(q) || yKey(p) - yKey(q) || p.far - q.far || yKey({ far: p.far, fy: p.pp }) - yKey({ far: q.far, fy: q.pp })
      || (p.end === q.end ? 0 : (p.end === 'a') === (dirOf(p) === 1) ? -1 : 1) || (p.key < q.key ? -1 : p.key > q.key ? 1 : 0));
    // Beauty v2 B2: the run of ports is moved whole to stay inside the corners (clamping each port alone stacked them on one point).
    // v13 fix 1 (review of v13: umami 방문자 브라우저 ↔ API 라우트 met API 라우트's top 6 screen pixels apart and read as one line with two
    // heads): the two ends of a pair running opposite ways on one face stand pairGap apart (the side rule's), as far as the face holds.
    const gaps = faceGaps(list.map(p => byKey.get(p.key)!), pairGap, box.w - 16);
    const span = gaps.reduce((a, b) => a + b, 0), start = Math.max(box.x + 8, Math.min(box.x + box.w - 8 - span, x0 - span / 2));
    // On the half-pixel grid the route search keeps its lanes on (a port off it would leave its first run slanted).
    let gx = start; list.forEach((p, i) => { gx += gaps[i]!; const x = Math.round(gx * 2) / 2; const port = out.get(p.key) ?? {}; port[p.end] = x; out.set(p.key, port); });
  }
  return out;
}

/** v13 fix 1: the gaps (the first 0) between the ends of one face, left to right: PORT_GAP, and pairGap across the two ends of a pair
 * running opposite ways between the same two cards (the gaps between them widened evenly); room: the most the run may span (the face
 * inside its corners). Past the room the widened gaps take what is left, never less than PORT_GAP. Pure. */
export function faceGaps(es: readonly Pick<Edge, 'from' | 'to'>[], pairGap: number, room: number, step: number = PORT_GAP): number[] {
  const g: number[] = es.map((_, i) => (i ? step : 0)); if (pairGap <= PORT_GAP || es.length < 2) return g;
  const need = [...g];
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
    const a = es[i]!, b = es[j]!; if (a.from !== b.to || a.to !== b.from || a.from === a.to) continue;
    const d = need.slice(i + 1, j + 1).reduce((x, y) => x + y, 0); if (d >= pairGap) continue;
    const add = (pairGap - d) / (j - i); for (let q = i + 1; q <= j; q++) need[q] = need[q]! + add;
  }
  const base = g.reduce((x, y) => x + y, 0), want = need.reduce((x, y) => x + y, 0);
  if (want <= room + 0.01 || want - base <= 0.01) return need;
  const f = Math.max(0, Math.min(1, (room - base) / (want - base)));
  return need.map((v, i) => g[i]! + (v - g[i]!) * f);
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
/** Beauty v5 (hub lanes): the sides a line's two ends meet: a line with a reserved route meets the sides its first and last tracks lie
 * beyond (hintPath takes them so; on a folded drawing its second-row end is met from the side its track stands, whatever the centres
 * say), else the sides facing each other (sideOf). null when no side is met (one end holds the other, or stacked neighbours). */
function endSides(a: Box, b: Box, e: Edge, byId: Map<string, Box>): { a: 'l' | 'r'; b: 'l' | 'r' } | null {
  const side = sideOf(a, b, byId); if (side === 'in') return null;
  const beyond = (x: Box, at: number | undefined): 'l' | 'r' | null => (at === undefined ? null : at >= x.x + x.w + 4 ? 'r' : at <= x.x - 4 ? 'l' : null);
  const ha = e.hint ? beyond(a, e.hint.xs[0]) : null, hb = e.hint ? beyond(b, e.hint.xs[e.hint.xs.length - 1]) : null;
  if (ha && hb) return { a: ha, b: hb };
  if (side === 'v') return null;
  return { a: side, b: side === 'r' ? 'l' : 'r' };
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
/** v13: how near a side's corners a run of ends may stand when a pair running opposite ways needs the room (map units). */
export const PAIR_INSET = 3;
/** v13: how close the side's other ends may close up for a pair's gap (map units; PORT_FLOOR elsewhere): never two on one point. */
export const PAIR_SQUEEZE = 6.5;
/** v13 (review of v12): the gaps (top to bottom, the first 0) of a side's ends when some must widen to `need` (a pair's two ends pairGap
 * apart): the widened gaps whole when the side holds them; else the side's other gaps close toward PAIR_SQUEEZE (never wider than they were) and the
 * run may reach PAIR_INSET from the corners; only past that do the widened ones take less, sharing what is left. null: nothing to widen. */
export function pairSpread(gaps: readonly number[], need: readonly number[], len: number, inset: number): number[] | null {
  const wide = need.map((g, i) => i > 0 && g > gaps[i]! + 0.01), extra = need.reduce((a, b) => a + b, 0) - gaps.reduce((a, b) => a + b, 0);
  if (extra <= 0.01 || !wide.some(Boolean)) return null;
  const sum = (f: (i: number) => number) => need.reduce((a, _, i) => a + (i ? f(i) : 0), 0);
  const want = sum(i => (wide[i] ? need[i]! : 0)), cur = sum(i => (wide[i] ? 0 : gaps[i]!)), least = sum(i => (wide[i] ? 0 : Math.min(gaps[i]!, PAIR_SQUEEZE)));
  const full = len - 2 * inset, most = len - 2 * Math.min(inset, PAIR_INSET);
  if (want + cur <= full + 0.01) return need.map((g, i) => (i ? (wide[i] ? g : gaps[i]!) : 0));
  if (want + least <= most + 0.01) {
    // The others close only as much as the widened gaps need (within the corners' room first, then into it).
    const room = Math.max(full, Math.min(most, want + least)) - want, a = cur - least > 0.01 ? Math.max(0, Math.min(1, (room - least) / (cur - least))) : 1;
    return need.map((g, i) => (i ? (wide[i] ? g : Math.min(gaps[i]!, PAIR_SQUEEZE) + (gaps[i]! - Math.min(gaps[i]!, PAIR_SQUEEZE)) * a) : 0));
  }
  const base = sum(i => (wide[i] ? gaps[i]! : 0)), f = want - base > 0.01 ? Math.max(0, Math.min(1, (most - least - base) / (want - base))) : 0;
  return need.map((g, i) => (i ? (wide[i] ? gaps[i]! + (g - gaps[i]!) * f : Math.min(gaps[i]!, PAIR_SQUEEZE)) : 0));
}
function assignPorts(boxes: Map<string, Box>, edges: Edge[], faced: ReadonlyMap<string, { a: PortFace; b: PortFace }> = new Map(), pairGap = 0, pitch = PORT_GAP): Map<string, { a?: number; b?: number }> {
  type End = { key: string; end: 'a' | 'b'; far: number; d: number };
  const out = new Map<string, { a?: number; b?: number }>(), at = new Map<string, End[]>(), sides = new Map<string, { a: string; b: string; e: Edge }>();
  for (const e of edges) {
    const a = boxes.get(e.from), b = boxes.get(e.to); if (!a || !b) continue;
    const sd = endSides(a, b, e, boxes); if (!sd) continue;
    const side = sd.a, other = sd.b, sa = `${a.id}|${side}`, sb = `${b.id}|${other}`, f = faced.get(e.key);
    // An end that keeps a card's top or bottom (a control line) takes no place on a side.
    // Beauty v3 (C): a line with a reserved route is ordered by where it goes next (its first or last row through the columns).
    // Beauty v5 (hub lanes): an end whose port the layout planned (the shared port model, Channel.ports) is ordered by that port, so the
    // side's ends stand as its tracks were planned.
    const ha = e.hint?.ports?.a ?? e.hint?.ys[0], hb = e.hint?.ports?.b ?? e.hint?.ys[e.hint.ys.length - 1];
    // Beauty v4 (P5): how far from the side its reserved track stands, for ends that go the same way (below).
    const da = e.hint ? Math.abs(e.hint.xs[0]! - (side === 'r' ? a.x + a.w : a.x)) : 0, db = e.hint ? Math.abs(e.hint.xs[e.hint.xs.length - 1]! - (other === 'r' ? b.x + b.w : b.x)) : 0;
    if (f?.a !== 'top' && f?.a !== 'bottom') (at.get(sa) ?? at.set(sa, []).get(sa)!).push({ key: e.key, end: 'a', far: ha ?? mid(b), d: da });
    if (f?.b !== 'top' && f?.b !== 'bottom') (at.get(sb) ?? at.set(sb, []).get(sb)!).push({ key: e.key, end: 'b', far: hb ?? mid(a), d: db });
    sides.set(e.key, { a: sa, b: sb, e });
  }
  const put = (key: string, end: 'a' | 'b', y: number) => { const port = out.get(key) ?? {}; port[end] = y; out.set(key, port); };
  // An end tied to a pin stands at the pin and never moves; so does a reference's ear (the head band, 3.6: no port, no spread).
  // The side's other lines spread round its contact point.
  const pinned = new Set<string>(), pinnedAt = new Map<string, number[]>(), plannedAt = new Map<string, { key: string; y: number; far: number; p: End }[]>(), pinnedFar = new Map<string, number[]>();
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
    const fars: number[] = [];
    for (const [y, ps] of tied) {
      ps.sort((p, q) => p.far - q.far);
      // v13 fix 1 (review of v13: nanogpt's picked 체크포인트 met train.py's port mark with both lines of its pair, 3.5px apart at 1280): two
      // ends of a pair at one pin stand pairGap apart across it (as far as the side holds), the others PORT_FLOOR apart as before.
      const len = box.kind === 'frame' ? box.head : box.h, gs = faceGaps(ps.map(p => sides.get(p.key)!.e), pairGap, Math.max(0, len - 2 * PAIR_INSET), PORT_FLOOR);
      const span = gs.reduce((a, b) => a + b, 0), lo = box.y + PAIR_INSET, hi = box.y + len - PAIR_INSET;
      let at2 = span > PORT_FLOOR * (ps.length - 1) + 0.01 ? Math.min(Math.max(y - span / 2, lo), Math.max(lo, hi - span)) : NaN;
      const slots = Number.isNaN(at2) ? pinSlots(y, ps.length) : gs.map(g => (at2 += g, Math.round(at2 * 2) / 2));
      slots.forEach((v, i) => { put(ps[i]!.key, ps[i]!.end, v); ys.push(v); fars.push(ps[i]!.far); });
    }
    if (ys.length) { pinnedAt.set(k, ys); pinnedFar.set(k, fars); }
    // Beauty v5 (hub lanes): an end whose port the layout planned (Channel.ports, the shared port model) stands at it, so its tracks meet
    // the ports they were planned from even where this drawn set has fewer ends on the side (a summary stroke holding both ways); the
    // side's other ends spread round them as round pins. Beauty v5 lanes review: a planned port stands only PORT_MIN clear of the side's
    // pins and of the planned ports kept before it (by planned height); one crowding them spreads with the side's free ends (a selection
    // draws other strokes than the plan's, and a kept plan put ends 6 apart: nanogpt, shapez).
    const len = box.kind === 'frame' ? box.head : box.h, mine: { key: string; y: number; far: number; p: End }[] = [];
    const plan = (p: End) => sides.get(p.key)!.e.hint?.ports?.[p.end];
    for (const p of free.filter(q => plan(q) !== undefined).sort((q, r) => plan(q)! - plan(r)! || (q.key < r.key ? -1 : q.key > r.key ? 1 : 0))) {
      const y = plan(p)!;
      if (y < box.y + 4 || y > box.y + len - 4 || [...ys, ...mine.map(m => m.y)].some(o => Math.abs(o - y) < PORT_MIN - 0.01)) continue;
      mine.push({ key: p.key, y, far: p.far, p }); free.splice(free.indexOf(p), 1);
    }
    if (mine.length) plannedAt.set(k, mine);
    if (free.length) at.set(k, free); else at.delete(k);
  }
  for (const [k, ms] of plannedAt) if (!at.has(k)) for (const m of ms) put(m.key, m.p.end, m.y);
  for (const [k, list] of at) {
    const box = boxes.get(k.split('|')[0]!)!, side = box.kind === 'frame' ? box.head : box.h;
    const fixedFar = [...pinnedFar.get(k) ?? [], ...(plannedAt.get(k) ?? []).map(m => m.far)];
    // Beauty v4 (P5): ends that go the same way (one partner's height: two lines of one pair, both ways) take the order their reserved
    // tracks need not to cross at the side: going down, the end whose track stands further off sits higher; going up, lower. Beauty v4
    // review: the two lines of a pair running both ways to a partner level with the card (within a pixel) keep their own order at both
    // cards; read as up at one end and down at the other, they twisted across each other at the port (hyperfine, dagu). Beauty v5 lanes
    // review 2: ties go by key (the same at both cards, so the pair keeps one order at both), never by the input's order.
    list.sort((p, q) => p.far - q.far || (p.end !== q.end && Math.abs(p.far - mid(box)) <= 1 ? 0 : p.far > mid(box) ? q.d - p.d : p.d - q.d) || (p.key < q.key ? -1 : p.key > q.key ? 1 : 0));
    // Beauty v5 (hub lanes): the shared port model (port-slots.ts, as the layout planned them): PORT_GAP apart round the contact point
    // inside the corners while the side holds them, closer only past its capacity (PORT_FLOOR at the least), never two on one point; a
    // side with ends tied to pins spreads its free ends round them (beauty v2 review H2/H3).
    const inset = box.kind === 'frame' ? FRAME_INSET : PORT_INSET, pins = pinnedAt.get(k) ?? [], planned = plannedAt.get(k) ?? [];
    let slots = sideSlots(list.length, box.y, side, mid(box), [...pins, ...planned.map(m => m.y)], inset, list.map(p => p.far), fixedFar, pitch);
    // Beauty v5 lanes review: a side whose planned ports leave its ends less than PORT_FLOOR apart, or push a free end past a planned one
    // against the order of where their lines go (its line would cross the planned one's at the side), may drop the plan: every end of it
    // spreads by the port model (its planned height only orders it: far), round the pins alone. Beauty v5 lanes review 2: only when the
    // spread leaves no more gaps under PORT_FLOOR than the plan (pins can crowd a side either way: a recorded hub with two pins, whose
    // plan kept a line straight, kept 3 where the spread left 4). As many either way, the spread (a hub selection whose three pins sit 8
    // apart crossed 4 more times with the plan kept).
    const tight = (ys: number[]) => { const s = [...ys].sort((p, q) => p - q); return s.filter((y, i) => i > 0 && y - s[i - 1]! < PORT_FLOOR - 0.01).length; };
    const byY = [...planned.map(m => ({ y: m.y, far: m.far })), ...slots.map((y, i) => ({ y, far: list[i]!.far }))].sort((p, q) => p.y - q.y);
    const tAll = planned.length ? tight([...pins, ...planned.map(m => m.y), ...slots]) : 0, tripped = byY.some((p, i) => i > 0 && p.far < byY[i - 1]!.far - 0.5);
    let drop = false;
    if (planned.length && (tAll > 0 || tripped)) {
      const every = [...list, ...planned.map(m => m.p)].sort((p, q) => p.far - q.far || (p.end !== q.end && Math.abs(p.far - mid(box)) <= 1 ? 0 : p.far > mid(box) ? q.d - p.d : p.d - q.d) || (p.key < q.key ? -1 : p.key > q.key ? 1 : 0));
      const spread = sideSlots(every.length, box.y, side, mid(box), pins, inset, every.map(p => p.far), pinnedFar.get(k) ?? [], pitch), tSpread = tight([...pins, ...spread]);
      if (tSpread <= tAll) { drop = true; list.splice(0, list.length, ...every); slots = spread; plannedAt.delete(k); }
    }
    if (!drop) for (const m of planned) put(m.key, m.p.end, m.y);
    slots.forEach((y, i) => put(list[i]!.key, list[i]!.end, y));
  }
  // v12 (review of v11: umami 분배 계층 ↔ PostgreSQL, gpt-researcher 백엔드 ↔ WebSocketManager, axios 요청 조정 ↔ 상태 판정: two lines of one
  // pair running opposite ways stood a port pitch apart, 6 screen pixels at the fit, and read as one line with two heads): the two ends of
  // such a pair on one side stand pairGap apart (the caller's: 12 screen pixels at the fit), the side's other ends kept in their order and
  // spacing and the run kept inside its corners (as much of the gap as the side has room for). A side with an end tied to a pin keeps its
  // ports. Each end's twin is kept so the straightening below and the nudging never bring the two back together.
  // v13 fix 1 (review of v13: shapez's 플레이어 ↔ Application held two lines one way and one the other; only the first pair was parted): an
  // end may have several twins (every line of the other way between the same two cards), each kept pairGap apart.
  const twin = new Map<string, { key: string; end: 'a' | 'b' }[]>();
  const addTwin = (k: string, t: { key: string; end: 'a' | 'b' }) => { const l = twin.get(k) ?? twin.set(k, []).get(k)!; if (!l.some(x => x.key === t.key && x.end === t.end)) l.push(t); };
  const isTwin = (p: { key: string; end: 'a' | 'b' }, q: { key: string; end: 'a' | 'b' }) => !!twin.get(`${p.key}|${p.end}`)?.some(t => t.key === q.key && t.end === q.end) || !!twin.get(`${q.key}|${q.end}`)?.some(t => t.key === p.key && t.end === p.end);
  if (pairGap > PORT_PITCH) {
    const byPair = new Map<string, Edge[]>();
    for (const { e } of sides.values()) { const k = `${e.from}\u0000${e.to}`; (byPair.get(k) ?? byPair.set(k, []).get(k)!).push(e); }
    for (const { a: sa, b: sb, e } of sides.values()) for (const r of byPair.get(`${e.to}\u0000${e.from}`) ?? []) {
      const s2 = sides.get(r.key)!, pe = out.get(e.key), pr = out.get(r.key); if (s2.b !== sa || s2.a !== sb) continue;
      // v13 fix 1: each end with its twin on its own (a pair whose other ends meet a face, as umami's 방문자 브라우저 ↔ API 라우트 at the
      // route's top, still parts on the side it meets).
      if (pe?.a !== undefined && pr?.b !== undefined) addTwin(`${e.key}|a`, { key: r.key, end: 'b' });
      if (pe?.b !== undefined && pr?.a !== undefined) addTwin(`${e.key}|b`, { key: r.key, end: 'a' });
    }
    const ends = new Map<string, { key: string; end: 'a' | 'b' }[]>();
    for (const { a: sa, b: sb, e } of sides.values()) {
      const p = out.get(e.key);
      if (p?.a !== undefined) (ends.get(sa) ?? ends.set(sa, []).get(sa)!).push({ key: e.key, end: 'a' });
      if (p?.b !== undefined) (ends.get(sb) ?? ends.set(sb, []).get(sb)!).push({ key: e.key, end: 'b' });
    }
    for (const [k, list] of ends) {
      if (!list.some(x => twin.has(`${x.key}|${x.end}`))) continue;
      const box = boxes.get(k.split('|')[0]!)!, len = box.kind === 'frame' ? box.head : box.h, inset = box.kind === 'frame' ? FRAME_INSET : PORT_INSET;
      const ys = list.map(x => ({ ...x, y: out.get(x.key)![x.end]! })).sort((p, q) => p.y - q.y || (p.key < q.key ? -1 : p.key > q.key ? 1 : 0));
      const gaps = ys.map((p, i) => (i ? p.y - ys[i - 1]!.y : 0)), need = [...gaps];
      for (let i = 0; i < ys.length; i++) for (let j = i + 1; j < ys.length; j++) {
        if (!isTwin(ys[i]!, ys[j]!)) continue;
        const d = need.slice(i + 1, j + 1).reduce((a, b) => a + b, 0); if (d >= pairGap) continue;
        const add = (pairGap - d) / (j - i); for (let q = i + 1; q <= j; q++) need[q] = need[q]! + add;
      }
      const used = gaps.reduce((a, b) => a + b, 0), extra = need.reduce((a, b) => a + b, 0) - used;
      if (extra <= 0.01) continue;
      // v13 fix 1 (review of v13: a picked card's side with ends tied to its port marks kept every end where it stood, and a pair on it 3px
      // apart): the tied ends stay at their pins; the free ends between two of them (or a pin and the side's end) spread as a side does.
      if (list.some(x => pinned.has(`${x.key}|${x.end}`))) {
        const fix = ys.map(p => pinned.has(`${p.key}|${p.end}`)), topB = box.y + PAIR_INSET, botB = box.y + len - PAIR_INSET;
        let a = -1;
        for (let i = 0; i <= ys.length; i++) {
          if (i < ys.length && !fix[i]) continue;
          const free: number[] = []; for (let q = a + 1; q < i; q++) free.push(q);
          if (free.length) {
            const lo = a < 0 ? Math.min(topB, ys[free[0]!]!.y) : ys[a]!.y, hi = i >= ys.length ? Math.max(botB, ys[free.at(-1)!]!.y) : ys[i]!.y;
            const g = [0, ...free.map((q, n) => (n === 0 && a < 0 ? ys[q]!.y - lo : gaps[q]!)), i < ys.length ? gaps[i]! : hi - ys[free.at(-1)!]!.y];
            const nd = [0, ...free.map((q, n) => (n === 0 && a < 0 ? 0 : need[q]!)), i < ys.length ? need[i]! : 0];
            const fin = pairSpread(g, nd, hi - lo, 0);
            if (fin) { let y = lo; free.forEach((q, n) => { y += fin[n + 1]!; put(ys[q]!.key, ys[q]!.end, Math.round(y * 2) / 2); }); }
          }
          a = i;
        }
        continue;
      }
      // v13 (review of v12: 14 pairs 4–11px apart at 1280, each on a side whose other ends filled it a pitch apart): a crowded side gives the
      // pair its gap first: the side's other gaps close to PAIR_SQUEEZE and the run may reach PAIR_INSET from the corners, before the pair
      // takes less than pairGap (and only what is left then).
      const fin = pairSpread(gaps, need, len, inset); if (!fin) continue;
      const span = fin.reduce((a, b) => a + b, 0), ins = Math.min(inset, Math.max(PAIR_INSET, (len - span) / 2));
      const start = Math.min(Math.max((ys[0]!.y + ys[ys.length - 1]!.y) / 2 - span / 2, box.y + ins), box.y + len - ins - span);
      let y = start; ys.forEach((p, i) => { y += i ? fin[i]! : 0; put(p.key, p.end, Math.round(y * 2) / 2); });
    }
  }
  /** Moving an end to `to` keeps it at least as far from its twin as pairGap (or as it already stands, when the side had no room). */
  const twinOk = (key: string, end: 'a' | 'b', to: number) => (twin.get(`${key}|${end}`) ?? []).every(t => twinOk1(key, end, to, t));
  const twinOk1 = (key: string, end: 'a' | 'b', to: number, t: { key: string; end: 'a' | 'b' }) => { const ty = out.get(t.key)?.[t.end], from = out.get(key)?.[end];
    return ty === undefined || from === undefined || Math.abs(ty - to) >= Math.min(pairGap, Math.abs(ty - from)) - 0.01; };
  const within =(o: Box, f: Box) => { for (let c = o.container, g = 0; c && g < 64; c = boxes.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
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
    && (pinnedAt.get(k) ?? []).every(y => clearOf(y, from, to)) && (plannedAt.get(k) ?? []).every(m => m.key === key || clearOf(m.y, from, to));
  // Beauty v5 (hub lanes): the reserved tracks' vertical runs (from the planned ports through the hint's rows): a line made straight
  // across one of them would cross it where the planned route did not.
  const laneRuns: { key: string; x: number; lo: number; hi: number }[] = [];
  for (const e of edges) {
    const h = e.hint; if (!h || h.xs.length !== h.ys.length + 1) continue;
    const ys = [h.ports?.a, ...h.ys, h.ports?.b];
    h.xs.forEach((x, i) => { const p = ys[i], q = ys[i + 1]; if (p !== undefined && q !== undefined && Math.abs(p - q) > 0.5) laneRuns.push({ key: e.key, x, lo: Math.min(p, q), hi: Math.max(p, q) }); });
  }
  const acrossLanes = (key: string, A: Box, B: Box, y: number) => { const x1 = Math.min(A.x + A.w, B.x + B.w), x2 = Math.max(A.x, B.x); return laneRuns.some(r => r.key !== key && r.x > x1 && r.x < x2 && y > r.lo + 0.5 && y < r.hi - 0.5); };
  const order = [...sides.values()].filter(s => out.get(s.e.key)?.a !== undefined && out.get(s.e.key)?.b !== undefined).sort((p, q) => Number(!!q.e.spine) - Number(!!p.e.spine) || Math.abs(out.get(p.e.key)!.a! - out.get(p.e.key)!.b!) - Math.abs(out.get(q.e.key)!.a! - out.get(q.e.key)!.b!));
  for (const { a: sa, b: sb, e } of order) {
    const port = out.get(e.key)!, ya = port.a!, yb = port.b!; if (Math.abs(ya - yb) < 0.5) continue;
    const A = boxes.get(e.from)!, B = boxes.get(e.to)!;
    // The end on the quieter side moves first (a lone line's port is free to move); else the line's target.
    const tries: ['a' | 'b', string, number, number][] = [['b', sb, yb, ya], ['a', sa, ya, yb]];
    if ((at.get(sa)?.length ?? 0) < (at.get(sb)?.length ?? 0)) tries.reverse();
    const hit = tries.find(([end, k, from, to]) => !pinned.has(`${e.key}|${end}`) && canMove(k, e.key, from, to) && twinOk(e.key, end, to) && straightFree(A, B, to) && !acrossLanes(e.key, A, B, to));
    if (hit) port[hit[0]] = hit[3];
  }
  return out;
}

/** How many times two routes cross (a level run through the inside of an upright one, ends and touches left out). */
function crossCount(p: readonly Point[], q: readonly Point[]): number {
  let n = 0;
  for (let i = 1; i < p.length; i++) for (let j = 1; j < q.length; j++) {
    const s = { a: p[i - 1]!, b: p[i]! }, t = { a: q[j - 1]!, b: q[j]! };
    const sh = Math.abs(s.a.y - s.b.y) < 0.5, th = Math.abs(t.a.y - t.b.y) < 0.5, sv = Math.abs(s.a.x - s.b.x) < 0.5, tv = Math.abs(t.a.x - t.b.x) < 0.5;
    if (!((sh && tv) || (sv && th))) continue;
    const H = sh ? s : t, V = sh ? t : s, y = H.a.y, x = V.a.x;
    if (x > Math.min(H.a.x, H.b.x) + 0.5 && x < Math.max(H.a.x, H.b.x) - 0.5 && y > Math.min(V.a.y, V.b.y) + 0.5 && y < Math.max(V.a.y, V.b.y) - 0.5) n++;
  }
  return n;
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

type Seg = { key: string; i: number; pts: Point[]; lo: number; hi: number; at: number; fixed: boolean; lane?: boolean };
/** Runs of one direction (vertical: same x; horizontal: same y) that lie on one line and overlap or nearly touch, moved apart.
 * A run that starts or ends at a port (the first or last run) keeps its place: moving it would move the port. */
function nudge(routes: Map<string, Routed>, blocks: (key: string) => Box[], vertical: boolean, rims: (key: string) => Box[] = () => [], portFree: (s: Seg, at: number, vertical: boolean) => boolean = () => false, owns: (key: string) => Box[] = () => [], lanes: ReadonlySet<string> = new Set()) {
  // Beauty v2 B3: a moved run (and the runs it joins) never enters the inside of the line's own end cards either (only their ports
  // touch them).
  // Beauty v5 (hub lanes): never a joining run left shorter than 2 (a sliver of a turn by a port reads as a kink; ROUTE-7).
  const sliver = (s: Seg, at: number) => [s.pts[s.i - 1], s.pts[s.i + 2]].some(q => { if (!q) return false; const d = Math.abs((vertical ? q.x : q.y) - at); return d > 0.01 && d < 2; });
  const fitsAt = (s: Seg, at: number, m: number) => !sliver(s, at) && fits(s, at, blocks(s.key), vertical, rims(s.key), m) && fits(s, at, owns(s.key).map(o => ({ ...o, x: o.x + 0.5, y: o.y + 0.5, w: o.w - 1, h: o.h - 1 })), vertical, [], -1);
  const segs: Seg[] = [];
  for (const r of routes.values()) {
    // Beauty v2 B3: a straight line takes part too (its one run is at both its ports; splitRun gives it a middle run when it must move).
    const p = r.pts; if (p.length < 2) continue;
    for (let i = 0; i + 1 < p.length; i++) {
      const A = p[i]!, B = p[i + 1]!, same = vertical ? Math.abs(A.x - B.x) < 0.01 : Math.abs(A.y - B.y) < 0.01;
      // A run of no length (a repeated point) lies both ways: moving it as either would pull its neighbours off the grid.
      if (!same || Math.abs(A.x - B.x) + Math.abs(A.y - B.y) < 0.5) continue;
      const u = vertical ? [A.y, B.y] : [A.x, B.x];
      segs.push({ key: r.key, i, pts: p, lo: Math.min(u[0]!, u[1]!), hi: Math.max(u[0]!, u[1]!), at: vertical ? A.x : A.y, fixed: i === 0 || i + 2 === p.length, ...(lanes.has(r.key) ? { lane: true } : {}) });
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
    // Beauty v5 (hub lanes): a run of a reserved route (its lane) stays where the layout planned it; the others are placed round it.
    for (const s of c.filter(x => x.lane)) placed.push(s);
    for (const s of c.filter(x => x.fixed && !x.lane)) {
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
      // Beauty v5 (hub lanes): a reserved route's run keeps its track unless another line lies on it (then it is placed as any run).
      if (s.fixed || (s.lane && apart(s, s.at, CROWD))) return;
      if (s.lane) placed.splice(placed.indexOf(s), 1);
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
    // Beauty v5 (hub lanes): a reserved route's run at a port gives way the same, only where another line still lies on it (the planned
    // tracks never do; a line the layout did not plan, or planned elsewhere, can): first along its side, else by a stub.
    for (const s of [...placed.filter(x => x.fixed && !x.lane), ...placed.filter(x => x.fixed && x.lane)]) {
      const clash = placed.some(o => o !== s && o.key !== s.key && Math.abs(o.at - s.at) < CROWD && Math.min(o.hi, s.hi) - Math.max(o.lo, s.lo) > 4);
      if (!clash) continue;
      if (s.lane && s.pts.length > 2) {
        const tries: number[] = []; for (let k = 1; k <= 30; k += 1) tries.push(s.at + k, s.at - k);
        const at = tries.find(x => portFree(s, x, vertical) && fitsAt(s, x, -1) && apart(s, x, CROWD));
        if (at !== undefined) { move(s, at, vertical); continue; }
      }
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
export const sideBudget = (b: Box): number => sideCapacity(b.h, PORT_INSET);
/** Beauty v3 (D.3): a card side over its budget sends its ends whose partner lies wholly above it (or below it, 24 clear) to its top (or
 * bottom) face, the steepest first, until the side is within budget. Only where the geometry is real; the line keeps its stroke and
 * head (the face carries no meaning), its end never shares a port, and no trunk joins it to another line. Returns the faces to take. */
export function faceOverflow(boxes: Map<string, Box>, edges: readonly Edge[], pairGap = 0): Map<string, { a?: PortFace; b?: PortFace }> {
  const ways = new Set(edges.map(e => `${e.from}\u0000${e.to}`));
  type End = { key: string; end: 'a' | 'b'; me: Box; other: Box; laid: boolean };
  const by = new Map<string, End[]>(), out = new Map<string, { a?: PortFace; b?: PortFace }>(), tied = new Map<string, number>();
  for (const e of edges) {
    const a = boxes.get(e.from), b = boxes.get(e.to); if (!a || !b) continue;
    const sd = endSides(a, b, e, boxes); if (!sd) continue;
    const side = sd.a, other = sd.b, fa = e.faces?.a, fb = e.faces?.b;
    if (fa !== 'top' && fa !== 'bottom' && pinOf(a, e, 'a') !== undefined) tied.set(`${a.id}|${side}`, (tied.get(`${a.id}|${side}`) ?? 0) + 1);
    if (fb !== 'top' && fb !== 'bottom' && pinOf(b, e, 'b') !== undefined) tied.set(`${b.id}|${other}`, (tied.get(`${b.id}|${other}`) ?? 0) + 1);
    if (fa !== 'top' && fa !== 'bottom' && !pinOf(a, e, 'a')) (by.get(`${a.id}|${side}`) ?? by.set(`${a.id}|${side}`, []).get(`${a.id}|${side}`)!).push({ key: e.key, end: 'a', me: a, other: b, laid: !!e.hint?.ports && e.hint.ports.a === undefined });
    if (fb !== 'top' && fb !== 'bottom' && !pinOf(b, e, 'b')) (by.get(`${b.id}|${other}`) ?? by.set(`${b.id}|${other}`, []).get(`${b.id}|${other}`)!).push({ key: e.key, end: 'b', me: b, other: a, laid: !!e.hint?.ports && e.hint.ports.b === undefined });
  }
  for (const [sk, list] of by) {
    const me = list[0]!.me; if (me.kind !== 'node') continue;
    // Beauty v5 lanes review: an end the layout sent to a face takes it toward a partner whose middle lies past that face (the face route's
    // own test; the layout's 24 clear may differ by the drawing's rounding), so the side holds the ends its tracks were planned from;
    // another end only toward a partner wholly past it by 24.
    const face = (x: End): PortFace | null => (x.laid ? (x.other.y + x.other.h / 2 < me.y ? 'top' : x.other.y + x.other.h / 2 > me.y + me.h ? 'bottom' : null) : x.other.y + x.other.h < me.y - 24 ? 'top' : x.other.y > me.y + me.h + 24 ? 'bottom' : null);
    const steep = (x: End) => Math.abs((x.other.y + x.other.h / 2) - (me.y + me.h / 2)) / Math.max(1, Math.abs((x.other.x + x.other.w / 2) - (me.x + me.w / 2)));
    // Beauty v5 (hub lanes): the ends the layout sent to a face (its planned ports leave them out) go first, so the side holds the ends its
    // tracks were planned from.
    // Beauty v5 lanes review: and every end the layout sent to a face goes there, so the router keeps the side the layout planned.
    const cands = list.filter(x => face(x)).sort((p, q) => Number(q.laid) - Number(p.laid) || steep(q) - steep(p) || (p.key < q.key ? -1 : 1));
    // v13 fix 1 (review of v13: umami's API 라우트 picked held eight ends on one 80-high side, two tied to its port marks, and its pair with
    // 방문자 브라우저 stood 3px apart): the ends tied to pins count toward the side's budget too (they take its room), so the free ends over
    // it go to the face toward their partners as on any other full side.
    // Only where the routing parts pairs (pairGap) and the side holds an end of one: elsewhere the plan round the pins stays as it was.
    const paired = pairGap > PORT_PITCH && list.some(x => ways.has(`${x.other.id}\u0000${x.me.id}`) && ways.has(`${x.me.id}\u0000${x.other.id}`));
    const n = Math.max(list.length + (paired ? tied.get(sk) ?? 0 : 0) - sideBudget(me), cands.filter(x => x.laid).length); if (n <= 0) continue;
    for (const x of cands.slice(0, n)) out.set(x.key, { ...out.get(x.key), [x.end]: face(x)! });
  }
  return out;
}

type FaceTie = [string, 'a' | 'b', string, 'a' | 'b'];
/** quick: the plain shapes (a drag). pairGap (v12): how far apart, in map units, the two ends of a pair of lines running opposite ways
 * between the same two cards stand on a side (the caller's 12 screen pixels at the fit; at most the side's room). */
export interface RouteOpts { quick?: boolean; pairGap?: number;
  /** v13 fix 1 (review of v13: in 층 and 흐름 the ends on one side stood PORT_PITCH apart, 6–7 screen pixels at the fit, and each head touched
   * its neighbour's line): the pitch a side's free ends take while the side holds it (map units; PORT_PITCH when not given). */
  pitch?: number | undefined }
/** Every crossing among a drawn set's routes. */
const allCrossings = (out: ReadonlyMap<string, Routed>): number => { const rs = [...out.values()]; let n = 0; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) n += crossCount(rs[i]!.pts, rs[j]!.pts); return n; };
/** Every line of one drawn set (the map's lines, or its summary lines), routed together. Beauty v5 lanes review 2: two face lines between
 * one pair of cards side by side on one face are ordered by their other ends' ports, which assumes each turns at its port; where the
 * drawn pair crosses itself (the search or the nudging turned one short of it), the set is routed again with the two the other way
 * round, kept when the pair crosses less and the set no more. Ties are tried in the order of their keys (never the input's).
 * Beauty v5 lanes review 3: the searches are kept through one call (the boxes stay put), so a set routed again searches only the lines
 * whose ends moved (the swapped pair, and any line whose side port moved with it); the rest of a try is the port spread and the nudging.
 * At most FACE_TIE_TRIES ties are tried (a face-heavy map tried every crossing pair, each a whole routing: up to 3 times the time). */
export function routeEdges(boxes: Map<string, Box>, edgesIn: Edge[], opts: RouteOpts = {}): Map<string, Routed> {
  const ties: FaceTie[] = [], memo: Searched = { face: new Map(), line: new Map(), ports: new Map() };
  let out = routeSet(boxes, edgesIn, opts, [], memo, ties);
  if (opts.quick || !ties.length) return out;
  const flips: FaceTie[] = [];
  let total = -1, tried = 0;
  for (const t of ties) {
    const ri = out.get(t[0]), rj = out.get(t[2]); if (!ri || !rj) continue;
    const was = crossCount(ri.pts, rj.pts); if (!was) continue;
    if (++tried > FACE_TIE_TRIES) break;
    if (total < 0) total = allCrossings(out);
    const next = routeSet(boxes, edgesIn, opts, [...flips, t], memo), si = next.get(t[0]), sj = next.get(t[2]);
    if (!si || !sj || crossCount(si.pts, sj.pts) >= was) continue;
    const nt = allCrossings(next); if (nt > total) continue;
    flips.push(t); out = next; total = nt;
  }
  return out;
}
/** The most face pairs one routing tries the other way round (400 generated face-heavy maps and the eight sample maps try two at most). */
export const FACE_TIE_TRIES = 4;
/** The set routed once, no face pair tried the other way round (the routing's cost before lanes review 2): the time guard's measure. */
export const routeOnce = (boxes: Map<string, Box>, edges: Edge[]): Map<string, Routed> => routeSet(boxes, edges, {}, [], { face: new Map(), line: new Map(), ports: new Map() });
/** The searches made in one routeEdges call: a face line's route by the two cards and the ends searched between (two lines of one pair
 * swapping their ends search the same ways), null when it turned too often; another line's reserved route (lane) or searched one, by
 * the line and its ports. What no swap changes is kept too: the lines with their faces over a side's budget (edges), the side ports with
 * every face line on its face (ports0) and the face ports from them (fx, copied before a swap), and the side ports by the face lines kept. */
type SidePorts = Map<string, { a?: number; b?: number }>;
interface Searched { face: Map<string, Route | null>; line: Map<string, { r: Route; lane: boolean }>; ports: Map<string, SidePorts>; edges?: Edge[]; ports0?: SidePorts; fx?: SidePorts }
function routeSet(boxes: Map<string, Box>, edgesIn: Edge[], opts: RouteOpts, flips: readonly FaceTie[], memo: Searched, ties?: FaceTie[]): Map<string, Routed> {
  // Beauty v3 (D): ends over a side's budget take the top or bottom face toward a partner that really lies above or below.
  const edges = memo.edges ??= (() => {
    const over = opts.quick ? new Map<string, { a?: PortFace; b?: PortFace }>() : faceOverflow(boxes, edgesIn, opts.pairGap ?? 0);
    return over.size ? edgesIn.map(e => { const o = over.get(e.key); return o ? { ...e, faces: { a: o.a ?? e.faces?.a ?? 'side', b: o.b ?? e.faces?.b ?? 'side' }, overflow: { a: !!o.a, b: !!o.b } } : e; }) : edgesIn;
  })();
  // A control line read as such leaves its card's bottom and comes in at the top (map design v3 3.6): routed first, kept only
  // when its route turns at most FACE_TURNS times (else it meets the sides, told by its dash and open head alone). Only cards
  // have those faces; a group, an outside partner or an end that holds the other keeps its side.
  const faceKept = new Map<string, { a: PortFace; b: PortFace }>(), faceRoutes = new Map<string, Route>();
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
    const fa = at(c.a, c.fa, px.a, pt.a), fb = at(c.b, c.fb, px.b, pt.b), k = `${c.a.id}\u0000${c.b.id}\u0000${fa.face}:${fa.at}\u0000${fb.face}:${fb.at}`;
    if (!opts.quick && memo.face.has(k)) return memo.face.get(k)!;
    const r = opts.quick ? quickFace(c.a, c.b, fa, fb) : faceRoute(c.a, c.b, boxes.values(), fa, fb), kept = r && turnsOf(r.pts) <= FACE_TURNS ? r : null;
    if (!opts.quick) memo.face.set(k, kept);
    return kept;
  };
  const ports0 = memo.ports0 ??= cands.length ? assignPorts(boxes, edges, new Map([...faceKept, ...candFaces]), opts.pairGap ?? 0, opts.pitch) : new Map();
  // The face ports, ordered by where the lines' other ends stand (ports0: their side ports with every face line on its face).
  const fx0 = memo.fx ??= cands.length ? facePorts(boxes, edges, ports0, opts.pairGap ?? 0) : new Map(), fx = flips.length ? new Map([...fx0].map(([k, v]) => [k, { ...v }])) : fx0;
  for (const [ki, ei, kj, ej] of flips) { const pi = fx.get(ki), pj = fx.get(kj), xi = pi?.[ei], xj = pj?.[ej]; if (pi && pj && xi !== undefined && xj !== undefined) { pi[ei] = xj; pj[ej] = xi; } }
  for (const c of cands) { const r = faceRun(ports0, c); if (r) { faceKept.set(c.e.key, { a: c.fa, b: c.fb }); faceRoutes.set(c.e.key, r); } }
  // Beauty v5 lanes review 2: the ends of two face lines between one pair of cards meeting one face (tied in facePorts' order: one
  // partner), in the order of their keys; routeEdges tries each such pair the other way round where their drawn routes cross.
  const faceEnds = (c: (typeof cands)[number]) => (['a', 'b'] as const).filter(end => { const f = end === 'a' ? c.fa : c.fb; return f === 'top' || f === 'bottom'; });
  const byKey = cands.filter(c => faceRoutes.has(c.e.key)).sort((p, q) => (p.e.key < q.e.key ? -1 : p.e.key > q.e.key ? 1 : 0));
  for (let i = 0; i < byKey.length; i++) for (let j = i + 1; j < byKey.length; j++) {
    const ci = byKey[i]!, cj = byKey[j]!;
    if (!((ci.e.from === cj.e.from && ci.e.to === cj.e.to) || (ci.e.from === cj.e.to && ci.e.to === cj.e.from))) continue;
    for (const ei of faceEnds(ci)) for (const ej of faceEnds(cj)) {
      const bi = ei === 'a' ? ci.e.from : ci.e.to, bj = ej === 'a' ? cj.e.from : cj.e.to;
      if (bi === bj && (ei === 'a' ? ci.fa : ci.fb) === (ej === 'a' ? cj.fa : cj.fb)) ties?.push([ci.e.key, ei, cj.e.key, ej]);
    }
  }
  const kept = [...faceKept.keys()].join('\u0000'), ports = memo.ports.get(kept) ?? memo.ports.set(kept, assignPorts(boxes, edges, faceKept, opts.pairGap ?? 0, opts.pitch)).get(kept)!;
  const out = new Map<string, Routed>(), lanes = new Set<string>();
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
    const p = ports.get(e.key) ?? {}, fr = faceRoutes.get(e.key), lk = `${e.key}\u0000${p.a ?? ''}\u0000${p.b ?? ''}`;
    let got = fr || opts.quick ? undefined : memo.line.get(lk);
    if (!fr && !opts.quick && !got) { const h = e.hint ? hintPath(a, b, boxes.values(), p, e.hint) : null; got = { r: h ?? edgePath(a, b, boxes.values(), p), lane: !!h }; memo.line.set(lk, got); }
    const hp = got?.lane ? got.r : null;
    const r = fr ?? (opts.quick ? quickRoute(a, b, p.a, p.b, boxes) : got!.r);
    // Beauty v5 (hub lanes): a line on its reserved route keeps it: the nudging moves the others round it, never it.
    if (hp) lanes.add(e.key);
    // The faces the line really takes: its kept top or bottom, else its sides (an ear stays an ear).
    const f = fr ? faceKept.get(e.key) : e.faces ? { a: e.faces.a === 'ear' ? 'ear' : 'side', b: e.faces.b === 'ear' ? 'ear' : 'side' } as const : undefined;
    out.set(e.key, { key: e.key, ...r, pts: r.pts.map(q => ({ ...q })), ...(f ? { faces: f } : {}), ...(hp ? { lane: true } : {}) });
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
  // v12: two lines of one pair running opposite ways keep their ends pairGap apart while their runs at the ports are nudged.
  const opposite = new Set<string>(); if ((opts.pairGap ?? 0) > PORT_PITCH) for (const e of edges) for (const r of edges) if (e.from === r.to && e.to === r.from) opposite.add(`${e.key}|${r.key}`);
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
      const least = opposite.has(`${s.key}|${r.key}`) ? Math.max(PORT_MIN, Math.min(opts.pairGap ?? 0, Math.abs(v - along)) - 0.01) : PORT_MIN;
      if (Math.abs(v - at) < least || (v - along) * (v - at) < 0) return false;
    }
    return true;
  };
  const owns = (key: string) => { const e = edges.find(x => x.key === key); return e ? [boxes.get(e.from), boxes.get(e.to)].filter((b): b is Box => !!b && b.kind !== 'frame') : []; };
  nudge(out, blocks, true, rims, portFree, owns, lanes); nudge(out, blocks, false, rims, portFree, owns, lanes);
  // Beauty v2 B3: the horizontal pass lengthens or adds vertical runs (its moves and jogs); one more vertical pass parts them.
  if (!opts.quick) nudge(out, blocks, true, rims, portFree, owns, lanes);
  // Beauty v2 review (H3): that vertical pass moves the turns of level runs, so two level runs can come to overlap where they did not
  // (a run reaching 17 past the turn of another, 4 apart); one more level pass and one more vertical pass part them.
  if (!opts.quick) { nudge(out, blocks, false, rims, portFree, owns, lanes); nudge(out, blocks, true, rims, portFree, owns, lanes); }
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

/* ---------- F8 Q3: the foreground's room on screen ----------
 * The routing keeps its pitches in map units (ports PORT_PITCH apart, runs LANE_TRACK apart), so at a fit of about half size two lines
 * of one pair run 6 screen pixels apart and one's head touches the other. The few lines a static focus draws (its own, every other
 * relation folded) are routed with their room counted on screen: the cards as if drawn at scale c (c < 1), the routes read back at
 * full size, so every pitch is 1/c times as wide in map units. Cards never move; only the drawn lines' routes change. */
/** The scale the focus lines are routed at: one fixed scale (never the camera's: a route that followed the zoom would move the fit that
 * reads it), so their pitches are twice the map's, about 12–14 screen pixels at a fit of 0.5–0.6. */
export const FOCUS_ROUTE_SCALE = 0.5;
export function routeAtScale(boxes: Map<string, Box>, edges: Edge[], c: number, opts: RouteOpts = {}): Map<string, Routed> {
  if (!(c > 0) || c >= 0.999) return routeEdges(boxes, edges, opts);
  const s = (v: number) => v * c, u = (v: number) => v / c;
  const sb = new Map([...boxes].map(([id, b]) => [id, { ...b, x: s(b.x), y: s(b.y), w: s(b.w), h: s(b.h), head: s(b.head),
    ...(b.contact !== undefined ? { contact: s(b.contact) } : {}), ...(b.ear !== undefined ? { ear: s(b.ear) } : {}),
    ...(b.pins ? { pins: Object.fromEntries(Object.entries(b.pins).map(([k, v]) => [k, s(v)])) } : {}) } as Box]));
  const out = routeEdges(sb, edges, { ...opts, ...(opts.pairGap ? { pairGap: opts.pairGap * c } : {}), ...(opts.pitch ? { pitch: opts.pitch * c } : {}) });
  return new Map([...out].map(([k, r]) => { const pts = r.pts.map(p => ({ x: u(p.x), y: u(p.y) })); return [k, { ...r, pts, mx: u(r.mx), my: u(r.my), d: rounded(pts) }]; }));
}
/** The focus lines' routes: at FOCUS_ROUTE_SCALE when that is no worse a drawing than the map's own pitch (no more crossings, no more
 * detours, at most FOCUS_ROUTE_LONGER times the length: a wider pitch that sends a line round the map is no gain); else the map's own. */
export const FOCUS_ROUTE_LONGER = 1.15;
export function focusRoutes(boxes: Map<string, Box>, edges: Edge[], c: number = FOCUS_ROUTE_SCALE, opts: RouteOpts = {}): Map<string, Routed> {
  const own = routeEdges(boxes, edges, opts); if (!(c > 0) || c >= 0.999) return own;
  const wide = routeAtScale(boxes, edges, c, opts);
  const len = (m: Map<string, Routed>) => [...m.values()].reduce((a, r) => a + r.pts.reduce((s, p, i) => (i ? s + Math.abs(p.x - r.pts[i - 1]!.x) + Math.abs(p.y - r.pts[i - 1]!.y) : 0), 0), 0);
  const detours = (m: Map<string, Routed>) => [...m.values()].filter(r => r.detour).length;
  return allCrossings(wide) <= allCrossings(own) && detours(wide) <= detours(own) && len(wide) <= FOCUS_ROUTE_LONGER * len(own) ? wide : own;
}
