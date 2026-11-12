/* Beauty v5 (hub lanes): one port model, shared by the layered layout (layered.ts place(), which plans each line's tracks from the
 * ports) and the router (map-route.ts assignPorts, which sets them). Before it the layout spread a side's ends PORT_PITCH apart with no
 * clamp (a 10-end side modelled as a 108px run on an 80px card), so the tracks it planned rested on ports the router never made.
 * - Capacity: a side of length L takes C = 1 + floor((L - 2 * inset) / PORT_PITCH) ends PORT_PITCH apart inside its corners.
 * - Slots: centred on the contact point (where the side's lines gather), PORT_PITCH apart, the run kept inside the corners; only a side
 *   over its capacity spreads closer (PORT_FLOOR at the least inside the corners, then over the corners' room), never two on one point.
 * - Pins: ends tied to one pin meet it side by side PORT_FLOOR apart across it; the side's free ends take slots clear of them.
 * Pure: no DOM; every value on the 0.5 grid the route search keeps its lanes on. */
export const PORT_PITCH = 12, PORT_FLOOR = 9, PORT_INSET = 8, FRAME_INSET = 7;
/** How many ends a side of length len takes PORT_PITCH apart inside its corners (an 80-high card: 6; a 104-high one: 8). */
export const sideCapacity = (len: number, inset = PORT_INSET): number => Math.max(1, 1 + Math.floor((len - 2 * inset) / PORT_PITCH));
const grid = (v: number) => Math.round(v * 2) / 2;
/** The ys of n ends tied to one pin (at y), in their order: PORT_FLOOR apart across the pin. */
export function pinSlots(y: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => grid(y + (i - (n - 1) / 2) * PORT_FLOOR));
}
/** The ys, top to bottom, of n free ends on one side: top (the side's first y), len (its length), at (where its lines gather: the
 * contact point), fixed (the ys already taken by ends tied to pins), inset (the corners: 8 on a card, 7 on a group's head). A lone end
 * keeps `at` exactly. Beauty v5 (hub lanes): with gates (where each free end's line leaves the card's neighbourhood, in the ends' order)
 * and fixedGates (the pinned ends'), the run round the pins is the one that puts the fewest free ends on the wrong side of a pin for
 * where their lines go (a line held at a pin otherwise crosses every free line that passes it), then the nearest the contact point. */
export function sideSlots(n: number, top: number, len: number, at: number, fixed: readonly number[] = [], inset = PORT_INSET, gates: readonly number[] = [], fixedGates: readonly number[] = []): number[] {
  if (n <= 0) return [];
  if (fixed.length) {
    // Round the pins: the free ends take slots PORT_PITCH (else PORT_FLOOR) clear of every pin and of each other, in their order: the n
    // slots that put the fewest of them on the wrong side of a pin, then the nearest their places in a run centred on the contact point
    // (chosen by dynamic programming over the slots); PORT_FLOOR only where it saves a wrong side or PORT_PITCH has no room; 6 apart only
    // when neither has.
    const ordered = gates.length === n && fixedGates.length === fixed.length;
    const listOf = (g: number) => { const sl: number[] = []; for (let y = Math.ceil((top + inset) * 2) / 2; y <= top + len - inset + 1e-6; y += 0.5) if (fixed.every(f => Math.abs(f - y) >= g) && (!sl.length || y - sl.at(-1)! >= g)) sl.push(y); return sl; };
    let pick: number[] | null = null, bd = Infinity;
    for (const [g, cost] of [[PORT_PITCH, 0], [PORT_FLOOR, 3000], [6, 6000]] as const) {
      if (g === 6 && pick) break;
      const sl = listOf(g); if (sl.length < n) continue;
      // cost of end r at slot j: its wrong sides (1e4 each) and its distance from its place in the centred run.
      const m = sl.length, at1 = (r: number, j: number) => { let c = 0; if (ordered) for (let p = 0; p < fixed.length; p++) { const x = gates[r]!, h = fixedGates[p]!; if (Math.abs(x - h) > 0.5 && (x < h) !== (sl[j]! < fixed[p]!)) c++; } return c * 1e4 + Math.abs(sl[j]! - (at + (r - (n - 1) / 2) * g)); };
      // D[r][j]: the least cost of ends 0..r with end r at slot j.
      const D: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(Infinity)), W: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(-1));
      for (let j = 0; j < m; j++) D[0]![j] = at1(0, j);
      for (let r = 1; r < n; r++) { let bi = -1, bv = Infinity; for (let j = r; j < m; j++) { const pv = D[r - 1]![j - 1]!; if (pv < bv - 1e-9) { bv = pv; bi = j - 1; } if (bi >= 0) { D[r]![j] = bv + at1(r, j); W[r]![j] = bi; } } }
      let end = -1, ev = Infinity; for (let j = n - 1; j < m; j++) if (D[n - 1]![j]! < ev - 1e-9) { ev = D[n - 1]![j]!; end = j; }
      if (end >= 0 && ev + cost < bd - 1e-9) { bd = ev + cost; const out: number[] = []; for (let r = n - 1, j = end; r >= 0; j = W[r]![j]!, r--) out.unshift(sl[j]!); pick = out; }
    }
    if (pick) return pick;
    // Beauty v5 lanes review: no room even 6 apart round the pins: the free ends and the pinned ones spread together over the side (the
    // run below for all of them), the pinned ones taking the slots nearest their own heights in order, the free ends the rest in order.
    const F = [...fixed].sort((p, q) => p - q), m = n + F.length, U = sideSlots(m, top, len, at, [], inset);
    // E[j][i]: the least distance of the first j pins over the first i slots, the j-th at slot i - 1.
    const E: number[][] = Array.from({ length: F.length + 1 }, () => new Array<number>(m + 1).fill(Infinity)); E[0]!.fill(0);
    for (let j = 1; j <= F.length; j++) for (let i = j; i <= m; i++) E[j]![i] = Math.min(E[j]![i - 1]!, E[j - 1]![i - 1]! + Math.abs(U[i - 1]! - F[j - 1]!));
    const taken = new Set<number>(); for (let j = F.length, i = m; j > 0; i--) { if (E[j]![i]! === E[j]![i - 1]!) continue; taken.add(i - 1); j--; }
    return U.filter((_, i) => !taken.has(i));
  }
  if (n < 2) return [at];
  const room = len - 2 * inset;
  // PORT_PITCH apart while the side holds them (n within its capacity); over it, closer, PORT_FLOOR at the least inside the corners, then
  // over the corners' room too (4 from the ends) before closer still.
  const gap = Math.max(4, room / (n - 1) >= PORT_FLOOR ? Math.min(PORT_PITCH, room / (n - 1)) : Math.min(PORT_FLOOR, (len - 8) / (n - 1)));
  const span = (n - 1) * gap, start = span > room ? top + (len - span) / 2 : Math.min(Math.max(at - span / 2, top + inset), top + len - inset - span);
  const s2 = grid(start), g2 = Math.floor(gap * 2) / 2;
  return Array.from({ length: n }, (_, i) => s2 + i * g2);
}

/** Beauty v5 (hub lanes): the tracks of the runs that change height in one gap, by precedence (the ordered strip). Runs are taken in
 * port order (a: the height at the gap's left side, b: at its right; ties by b, then key). For i before j:
 *   - b_j < a_i + rho (j ends above where i starts, going up past it): i turns first (x_i + rho <= x_j);
 *   - b_i > a_j - rho (i ends below where j starts, going down past it): j turns first (x_j + rho <= x_i);
 *   - one arriving within rho of the height another leaves at (b_i ~ a_j): the one leaving turns first (their level runs would
 *     otherwise lie on one line between the two tracks);
 *   - both rules (the two must cross) or neither: the order whose level runs cross the other's track less, then the port order.
 * Only runs whose extents come within `near` of each other need tracks apart (others may share one x, never overlapping along it). A
 * cycle of precedences is broken at the run whose waiting precedences weigh least (a level pair 2.5, a saved crossing 1 more each, a
 * rule alone 1, the port order 0.5), ties by port order. The x of each is the longest path over the precedences (fewest tracks the
 * order allows), so the result is deterministic whatever the input order. at: '<key>' → track (0 leftmost); '#' → the count. */
export function laneTracks(runs: readonly { key: string; a: number; b: number }[], rho = 10, near = 16): { n: number; at: Map<string, number> } {
  const at = new Map<string, number>(); if (!runs.length) { at.set('#', 0); return { n: 0, at }; }
  const cmp = (p: string, q: string) => (p < q ? -1 : p > q ? 1 : 0);
  const R = [...runs].sort((p, q) => p.a - q.a || p.b - q.b || cmp(p.key, q.key)), k = R.length;
  const lo = R.map(r => Math.min(r.a, r.b)), hi = R.map(r => Math.max(r.a, r.b));
  const meets = (i: number, j: number) => lo[i]! < hi[j]! + near && lo[j]! < hi[i]! + near;
  const inside = (y: number, r: { a: number; b: number }) => y > Math.min(r.a, r.b) + 0.5 && y < Math.max(r.a, r.b) - 0.5;
  // Precedence edges (i before j: i's track left of j's).
  const out: number[][] = Array.from({ length: k }, () => []), indeg = new Array<number>(k).fill(0), wIn: Map<number, number>[] = Array.from({ length: k }, () => new Map());
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    if (!meets(i, j)) continue;
    // One run's last height level with the other's first (within rho): the one arriving there turns after the one leaving, or their
    // two level runs would lie on one line between the two tracks.
    const lvJI = Math.abs(R[i]!.b - R[j]!.a) < rho, lvIJ = Math.abs(R[i]!.a - R[j]!.b) < rho;
    const up = R[j]!.b < R[i]!.a + rho, down = R[i]!.b > R[j]!.a - rho;
    // Where the two rules say nothing or contradict each other, the order whose level runs cross the other's track less.
    const cost = (p: { a: number; b: number }, q: { a: number; b: number }) => Number(inside(p.b, q)) + Number(inside(q.a, p));
    const ci = cost(R[i]!, R[j]!), cj = cost(R[j]!, R[i]!);
    const jFirst = lvJI !== lvIJ ? lvJI : ci !== cj ? cj < ci : up !== down ? down : false;
    // How much the precedence weighs when a cycle must drop one: a level pair most, then the crossings it saves, then the rules alone.
    const w = lvJI !== lvIJ ? 2.5 : ci !== cj ? 1 + Math.abs(ci - cj) : up !== down ? 1 : 0.5;
    if (jFirst) { out[j]!.push(i); indeg[i]!++; wIn[i]!.set(j, w); } else { out[i]!.push(j); indeg[j]!++; wIn[j]!.set(i, w); }
  }
  // A stable topological order (the first in port order among the free ones); a cycle is broken at the run whose precedences still
  // waiting weigh least (ties: the first in port order).
  const done = new Array<boolean>(k).fill(false), topo: number[] = [];
  while (topo.length < k) {
    let pick = -1; for (let i = 0; i < k; i++) if (!done[i] && !indeg[i]) { pick = i; break; }
    if (pick < 0) { let bw = Infinity; for (let i = 0; i < k; i++) { if (done[i]) continue; let w = 0; for (const [u, x] of wIn[i]!) if (!done[u]) w += x; if (w < bw - 1e-9) { bw = w; pick = i; } } }
    done[pick] = true; topo.push(pick); for (const j of out[pick]!) indeg[j]!--;
  }
  // Longest path: each run one track right of every run before it in that order whose extent it meets.
  const tr = new Array<number>(k).fill(0);
  for (let t = 0; t < k; t++) { const v = topo[t]!; let x = 0; for (let s = 0; s < t; s++) { const u = topo[s]!; if (meets(u, v)) x = Math.max(x, tr[u]! + 1); } tr[v] = x; }
  R.forEach((r, i) => at.set(r.key, tr[i]!));
  const n = Math.max(...tr) + 1; at.set('#', n);
  return { n, at };
}
