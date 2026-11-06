/* Beauty v3 (layout slice A): the map's layered placement, in-house and pure (no DOM, no randomness, no locale compare; every tie
 * broken by the record's order, then the id by code unit). Layers run left to right as the drawn arrows are read.
 * - Which relations decide the layers (A.2): data and control lines drive, in their direction; a reference joins softly only when
 *   it closes no cycle; shares and related set no layer. Every relation is still drawn (and given room) whatever it decides.
 * - Cycles (A.3): broken by turning the fewest, cheapest driving lines for the layout only (a line back to a participant is the
 *   cheaper); the drawn direction never changes (`reversed` lists them).
 * - Layers (A.4): network simplex, which makes the weighted total of line spans (the lines' horizontal length) least; a layer
 *   longer than the width bound is split in order into sub-layers.
 * - Long lines (A.5): a dummy point in every layer they pass, so their room is kept and they run straight through it.
 * - Order (A.6): weighted median sweeps with the card's pin order, adjacent swaps, the order with the fewest crossings kept.
 * - Heights (A.7): Brandes–Köpf on the cards' line-contact points (an 80- and a 104-high card keep their rows level), with the
 *   separations that make every corridor laneRoom of its lines wide (the room is the layout's own spacing).
 * - Blocks (A.8): each connected block on its own, the largest first, the others shelf-packed under it.
 * - Channels (C): each line's reserved route (its tracks in the gaps and its rows through the columns) for the router to try first.
 * Placement only: no relation's id, end, kind, direction or condition is read for anything but where the parts go, and nothing is
 * drawn as a region, a hull or a membership. */

export interface LNode { id: string; w: number; h: number;
  /** From the top: where side lines meet it (typed card: its contact point; frame: head / 2; else h / 2). */
  anchor: number;
  /** The record's order (every tie is broken by (order, id)). */
  order: number;
  /** Pins by relation end ('<relId>|in' / '|out'), from the top. */
  pins?: Record<string, number>;
  /** A participant or an external system (a hint only: a line back to a participant is the cheaper one to turn). */
  role?: 'outside' | 'external' | 'store' | null;
  /** Least room above and below it from another part (an open group keeps a lane for lines beside it). */
  gutter?: number }
/** drive: a data or control line; ref: a reference (uses, a need with no channel); plain: shares or related. */
export type LKind = 'drive' | 'ref' | 'plain';
export interface LEdge { key: string; from: string; to: string; kind: LKind; weight: number; relIds: string[] }
export interface LOptions { layerGap: number; rowGap: number; laneMargin: number; laneTrack: number;
  /** Target width / height of the drawing (F.3); spent only with `spend`. */
  aspect: number;
  /** Between the sub-layers of one split layer. */
  wrapGap?: number;
  /** Between packed blocks. */
  blockGap?: number;
  sweeps?: number;
  /** Spend the slack (F.3): grow row gaps on a drawing too wide for the aspect, column gaps on one too tall. */
  spend?: boolean;
  /** Caps of the slack spending. */
  maxRowGap?: number; maxLaneMargin?: number; maxLayerGap?: number }
/** A line's reserved route: port a → (xs[0], ya) → (xs[0], ys[0]) → (xs[1], ys[0]) → … → (xs[k], yb) → port b. */
export interface Channel { xs: number[]; ys: number[] }
export interface LResult {
  /** Top-left of each node, relative to the drawing's top-left (0, 0), on the 0.5 grid. */
  pos: Map<string, { x: number; y: number }>;
  /** Each node's column (over all blocks), and each column's nodes top to bottom. */
  layer: Map<string, number>; order: string[][];
  /** LEdge keys turned for the layout only (never drawn so). */
  reversed: Set<string>;
  channels: Map<string, Channel>;
  /** Width of each gap between the main block's columns. */
  gaps: number[];
  /** The main block's spine: its heaviest chain of driving lines, left to right. */
  spine: string[];
  size: { w: number; h: number };
  metrics: { crossings: number; length: number; dummies: number; ms: number; pivots: number; rowGap: number; layerGap: number } }

const cmpId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const half = (v: number) => Math.round(v * 2) / 2;
export const laneRoomOf = (n: number, margin: number, track: number) => (n <= 0 ? 0 : 2 * margin + (n - 1) * track + 2);
/** map-route's PORT_GAP: the ends on one side of a card are spread this far apart. */
const PORT_STEP = 12;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/* ---------- network simplex (Gansner et al.) on one connected acyclic graph, minlen 1 ---------- */
interface SEdge { s: number; t: number; w: number }
/** Ranks of n nodes (0..n-1) making Σ w·(rank t − rank s) least under rank t − rank s ≥ 1; deterministic; capped. */
export function networkSimplex(n: number, E: readonly SEdge[], cap = 4 * E.length + 100): { rank: number[]; pivots: number } {
  const rank = new Array<number>(n).fill(0);
  if (n <= 1) return { rank, pivots: 0 };
  const out: number[][] = Array.from({ length: n }, () => []), inn: number[][] = Array.from({ length: n }, () => []);
  E.forEach((e, i) => { out[e.s]!.push(i); inn[e.t]!.push(i); });
  // Longest path from the sources, in index order.
  const indeg = inn.map(l => l.length), queue: number[] = []; for (let v = 0; v < n; v++) if (!indeg[v]) queue.push(v);
  for (let q = 0; q < queue.length; q++) { const v = queue[q]!; for (const i of out[v]!) { const t = E[i]!.t; rank[t] = Math.max(rank[t]!, rank[v]! + 1); if (!--indeg[t]!) queue.push(t); } }
  const slack = (i: number) => rank[E[i]!.t]! - rank[E[i]!.s]! - 1;
  // A feasible tight spanning tree, grown from node 0.
  const inTree = new Array<boolean>(n).fill(false), treeE = new Array<boolean>(E.length).fill(false);
  inTree[0] = true; let size = 1;
  const grow = () => { let more = true; while (more) { more = false; for (let i = 0; i < E.length; i++) { if (treeE[i]) continue; const e = E[i]!, a = inTree[e.s]!, b = inTree[e.t]!; if (a !== b && slack(i) === 0) { treeE[i] = true; inTree[a ? e.t : e.s] = true; size++; more = true; } } } };
  grow();
  while (size < n) {
    let best = -1, bs = Infinity;
    for (let i = 0; i < E.length; i++) { const e = E[i]!; if (inTree[e.s] !== inTree[e.t] && slack(i) < bs) { bs = slack(i); best = i; } }
    if (best < 0) break; // not connected (the caller passes one component)
    const d = inTree[E[best]!.s] ? bs : -bs; for (let v = 0; v < n; v++) if (inTree[v]) rank[v]! += d;
    grow();
  }
  const tree = () => E.map((_, i) => i).filter(i => treeE[i]);
  // The tail side of a tree edge: the nodes reached from its tail without it.
  const tailSide = (cut: number): boolean[] => {
    const adj: number[][] = Array.from({ length: n }, () => []); for (const i of tree()) if (i !== cut) { adj[E[i]!.s]!.push(E[i]!.t); adj[E[i]!.t]!.push(E[i]!.s); }
    const seen = new Array<boolean>(n).fill(false), st = [E[cut]!.s]; seen[E[cut]!.s] = true;
    while (st.length) { const v = st.pop()!; for (const u of adj[v]!) if (!seen[u]) { seen[u] = true; st.push(u); } }
    return seen;
  };
  const rerank = () => {
    const adj: [number, number, number][][] = Array.from({ length: n }, () => []);
    for (const i of tree()) { const e = E[i]!; adj[e.s]!.push([e.t, 1, i]); adj[e.t]!.push([e.s, -1, i]); }
    const known = new Array<boolean>(n).fill(false), st = [0]; known[0] = true; rank[0] = 0;
    while (st.length) { const v = st.pop()!; for (const [u, d] of adj[v]!) if (!known[u]) { known[u] = true; rank[u] = rank[v]! + d; st.push(u); } }
  };
  let pivots = 0, from = 0;
  for (; pivots < cap; pivots++) {
    const T = tree(); let leave = -1, side: boolean[] = [];
    for (let k = 0; k < T.length && leave < 0; k++) {
      const i = T[(from + k) % T.length]!, S = tailSide(i);
      let cv = 0; for (const e of E) { if (S[e.s] && !S[e.t]) cv += e.w; else if (!S[e.s] && S[e.t]) cv -= e.w; }
      if (cv < 0) { leave = i; side = S; from = (from + k + 1) % T.length; }
    }
    if (leave < 0) break;
    let enter = -1, es = Infinity;
    for (let i = 0; i < E.length; i++) { if (treeE[i]) continue; const e = E[i]!; if (!side[e.s] && side[e.t] && slack(i) < es) { es = slack(i); enter = i; } }
    if (enter < 0) break;
    treeE[leave] = false; treeE[enter] = true; rerank();
  }
  const lo = Math.min(...rank); for (let v = 0; v < n; v++) rank[v]! -= lo;
  return { rank, pivots };
}

/* ---------- the layout ---------- */
type Seg = { u: number; v: number; w: number; pu: number; pv: number; key: string; spine: boolean };
interface Block { nodes: number[]; edges: number[] }

export function layered(nodesIn: readonly LNode[], edgesIn: readonly LEdge[], opt: LOptions): LResult {
  const t0 = now();
  const nodes = [...nodesIn].sort((a, b) => a.order - b.order || cmpId(a.id, b.id));
  const ix = new Map(nodes.map((n, i) => [n.id, i])), N = nodes.length;
  const edges = edgesIn.filter(e => ix.has(e.from) && ix.has(e.to) && e.from !== e.to)
    .sort((a, b) => ix.get(a.from)! - ix.get(b.from)! || ix.get(a.to)! - ix.get(b.to)! || cmpId(a.kind, b.kind) || cmpId(a.key, b.key));
  const from = edges.map(e => ix.get(e.from)!), to = edges.map(e => ix.get(e.to)!);
  // Connected blocks over every drawn line, the largest first (ties: the one whose first node comes first).
  const parent = nodes.map((_, i) => i), find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  edges.forEach((_, i) => { const a = find(from[i]!), b = find(to[i]!); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); });
  const byRoot = new Map<number, Block>();
  nodes.forEach((_, i) => { const r = find(i); (byRoot.get(r) ?? byRoot.set(r, { nodes: [], edges: [] }).get(r)!).nodes.push(i); });
  edges.forEach((_, i) => byRoot.get(find(from[i]!))!.edges.push(i));
  const blocks = [...byRoot.values()].sort((p, q) => q.nodes.length - p.nodes.length || p.nodes[0]! - q.nodes[0]!);

  const reversed = new Set<string>();
  let pivots = 0, dummies = 0;
  // Per block: ranks, then the layers with dummies, then the order. Coordinates come after (they depend on the spacing spent).
  type Laid = { layers: number[][]; segs: Seg[]; chains: Map<number, { path: number[]; rev: boolean }>; isDummy: boolean[]; h: number[]; anc: number[]; wd: number[]; spineSet: Set<number>; spine: number[]; wrapAfter: Set<number>; nodeOf: number[]; gut: number[] };
  const laid: Laid[] = [];
  for (const B of blocks) {
    const local = new Map(B.nodes.map((v, i) => [v, i])), n = B.nodes.length;
    const bes = B.edges;
    // Which lines drive (A.2): data and control; a block they reach too little of reads by its references (then its plain lines).
    const linked = new Set<number>(); for (const i of bes) { linked.add(from[i]!); linked.add(to[i]!); }
    const reach = (k: LKind) => { const s = new Set<number>(); for (const i of bes) if (edges[i]!.kind === k) { s.add(from[i]!); s.add(to[i]!); } return s; };
    let driveKinds: LKind[] = ['drive'];
    if (reach('drive').size < linked.size / 2) driveKinds = reach('ref').size ? ['drive', 'ref'] : ['drive', 'ref', 'plain'];
    const layW = (i: number) => { const k = edges[i]!.kind, w = edges[i]!.weight || 1; return driveKinds.includes(k) ? (k === 'drive' ? 2 : 1) * w : k === 'ref' ? 0.25 * w : 0; };
    const allDrives = bes.filter(i => driveKinds.includes(edges[i]!.kind));
    // Two parts that drive each other: the line back is decided by what the record says they are, before any count. A store read back
    // by the part that writes it sits after its writer (the read is the line turned); a part answering a participant sits after it
    // (the answer is turned). These lines take no part in choosing the order below; the order then turns them as it must.
    const pairOf = new Map<string, number[]>(); for (const i of allDrives) { const k = `${from[i]}|${to[i]}`; (pairOf.get(k) ?? pairOf.set(k, []).get(k)!).push(i); }
    const pre = new Set<number>();
    for (const i of allDrives) {
      const a = from[i]!, b = to[i]!; if (!pairOf.has(`${b}|${a}`)) continue;
      const ra = nodes[a]!.role, rb = nodes[b]!.role;
      if ((ra === 'store' && rb !== 'store') || (rb === 'outside' && ra !== 'outside')) pre.add(i);
    }
    const drives = allDrives.filter(i => !pre.has(i));
    // Cycle breaking (A.3, Eades–Lin–Smyth over the driving lines, weighted by what turning them costs).
    const cost = (i: number) => (nodes[to[i]!]!.role === 'outside' ? 1 : 2) * (edges[i]!.weight || 1);
    const seq = (() => {
      const alive = new Set(B.nodes), outs = new Map<number, number[]>(), ins = new Map<number, number[]>();
      for (const v of B.nodes) { outs.set(v, []); ins.set(v, []); }
      for (const i of drives) { outs.get(from[i]!)!.push(i); ins.get(to[i]!)!.push(i); }
      const deg = (v: number, l: Map<number, number[]>, end: number[]) => l.get(v)!.filter(i => alive.has(end[i]!)).reduce((a, i) => a + cost(i), 0);
      const left: number[] = [], right: number[] = [];
      while (alive.size) {
        let moved = true;
        while (moved) {
          moved = false;
          const sink = B.nodes.find(v => alive.has(v) && !outs.get(v)!.some(i => alive.has(to[i]!)));
          if (sink !== undefined) { right.unshift(sink); alive.delete(sink); moved = true; continue; }
          const src = B.nodes.find(v => alive.has(v) && !ins.get(v)!.some(i => alive.has(from[i]!)));
          if (src !== undefined) { left.push(src); alive.delete(src); moved = true; }
        }
        if (!alive.size) break;
        let best = -1, bd = -Infinity;
        for (const v of B.nodes) if (alive.has(v)) { const d = deg(v, outs, to) - deg(v, ins, from); if (d > bd) { bd = d; best = v; } }
        left.push(best); alive.delete(best);
      }
      return [...left, ...right];
    })();
    // The reading from the record's own starts: depth first from the parts nothing drives (in record order), then the participants,
    // then the rest; a line back to where the reading came from is the one turned. Kept when it turns no more than the greedy order
    // (a store written by one step and read by the next then sits between them, not before its writer).
    const dfsSeq = (() => {
      const outs = new Map<number, number[]>(B.nodes.map(v => [v, []])), hasIn = new Set<number>();
      for (const i of drives) { outs.get(from[i]!)!.push(to[i]!); hasIn.add(to[i]!); }
      for (const l of outs.values()) l.sort((p, q) => p - q);
      const starts = [...B.nodes.filter(v => !hasIn.has(v)), ...B.nodes.filter(v => hasIn.has(v) && nodes[v]!.role === 'outside'), ...B.nodes.filter(v => hasIn.has(v) && nodes[v]!.role !== 'outside')];
      const seen = new Set<number>(), post: number[] = [];
      for (const s of starts) {
        if (seen.has(s)) continue;
        const st: [number, number][] = [[s, 0]]; seen.add(s);
        while (st.length) { const top = st[st.length - 1]!, list = outs.get(top[0])!; if (top[1] < list.length) { const nx = list[top[1]++]!; if (!seen.has(nx)) { seen.add(nx); st.push([nx, 0]); } } else { post.push(top[0]); st.pop(); } }
      }
      return post.reverse();
    })();
    const turned = (sq: number[]) => { const p = new Map(sq.map((v, i) => [v, i])); return drives.reduce((a, i) => a + (p.get(from[i]!)! > p.get(to[i]!)! ? cost(i) : 0), 0); };
    const at = new Map((turned(dfsSeq) <= turned(seq) ? dfsSeq : seq).map((v, i) => [v, i]));
    // The acyclic driving graph (layout direction), merged per ordered pair.
    const dir = new Map<number, { s: number; t: number }>(); // per edge index: its layout direction
    const dag = new Map<string, number>();
    const succ = new Map<number, Set<number>>(B.nodes.map(v => [v, new Set<number>()]));
    for (const i of allDrives) {
      let s = from[i]!, t = to[i]!; if (at.get(s)! > at.get(t)!) { [s, t] = [t, s]; reversed.add(edges[i]!.key); }
      dir.set(i, { s, t }); const k = `${s}|${t}`; dag.set(k, (dag.get(k) ?? 0) + layW(i)); succ.get(s)!.add(t);
    }
    const reaches = (a: number, b: number) => { const seen = new Set<number>(), st = [a]; while (st.length) { const x = st.pop()!; if (x === b) return true; if (seen.has(x)) continue; seen.add(x); for (const y of succ.get(x)!) st.push(y); } return false; };
    // Soft references: in their direction, when they close no cycle.
    for (const i of bes) {
      if (driveKinds.includes(edges[i]!.kind) || edges[i]!.kind !== 'ref') continue;
      const s = from[i]!, t = to[i]!; if (reaches(t, s)) continue;
      dir.set(i, { s, t }); const k = `${s}|${t}`; dag.set(k, (dag.get(k) ?? 0) + layW(i)); succ.get(s)!.add(t);
    }
    // Network simplex per connected component of that graph; components and loose nodes are then set against each other.
    const rank = new Map<number, number>();
    const dEdges = [...dag].map(([k, w]) => { const [s, t] = k.split('|').map(Number) as [number, number]; return { s, t, w }; }).sort((p, q) => p.s - q.s || p.t - q.t);
    const cp = new Map(B.nodes.map(v => [v, v])), cf = (v: number): number => (cp.get(v) === v ? v : (cp.set(v, cf(cp.get(v)!)), cp.get(v)!));
    for (const e of dEdges) { const a = cf(e.s), b = cf(e.t); if (a !== b) cp.set(Math.max(a, b), Math.min(a, b)); }
    const comps = new Map<number, number[]>(); for (const v of B.nodes) (comps.get(cf(v)) ?? comps.set(cf(v), []).get(cf(v))!).push(v);
    const compList = [...comps.values()].sort((p, q) => q.length - p.length || p[0]! - q[0]!);
    const compRank = new Map<number, number>();
    for (const c of compList) {
      if (c.length === 1) { compRank.set(c[0]!, 0); continue; }
      const li = new Map(c.map((v, i) => [v, i])), E = dEdges.filter(e => li.has(e.s)).map(e => ({ s: li.get(e.s)!, t: li.get(e.t)!, w: e.w }));
      const r = networkSimplex(c.length, E); pivots += r.pivots;
      // Balance: a node pulled equally both ways goes to the feasible rank with the fewest nodes (ties: the lower).
      const inw = new Array<number>(c.length).fill(0), outw = new Array<number>(c.length).fill(0);
      for (const e of E) { outw[e.s]! += e.w; inw[e.t]! += e.w; }
      const count = new Map<number, number>(); for (const x of r.rank) count.set(x, (count.get(x) ?? 0) + 1);
      for (let v = 0; v < c.length; v++) {
        if (Math.abs(inw[v]! - outw[v]!) > 1e-9) continue;
        let lo = 0, hi = Math.max(...r.rank);
        for (const e of E) { if (e.t === v) lo = Math.max(lo, r.rank[e.s]! + 1); if (e.s === v) hi = Math.min(hi, r.rank[e.t]! - 1); }
        if (!E.some(e => e.s === v || e.t === v)) continue;
        let best = r.rank[v]!, bc = count.get(best)! - 1;
        for (let x = lo; x <= hi; x++) { const cnt = (count.get(x) ?? 0); if (cnt < bc) { bc = cnt; best = x; } }
        if (best !== r.rank[v]) { count.set(r.rank[v]!, count.get(r.rank[v]!)! - 1); count.set(best, (count.get(best) ?? 0) + 1); r.rank[v] = best; }
      }
      c.forEach((v, i) => compRank.set(v, r.rank[i]!));
    }
    // Components (and loose nodes) take the shift that makes their lines to what is already ranked shortest (weighted median).
    const want = (i: number, v: number): number | null => {
      // The rank v wants from edge i whose other end is ranked: a reference one layer after its source; a plain line beside.
      const k = edges[i]!.kind, other = from[i] === v ? to[i]! : from[i]!, r = rank.get(other); if (r === undefined) return null;
      const d = dir.get(i);
      if (d) return d.s === v ? r - 1 : r + 1;
      if (k === 'ref') return from[i] === v ? r - 1 : r + 1;
      return r;
    };
    const ordW = (i: number) => (edges[i]!.kind === 'drive' ? 1 : 0.5) * (edges[i]!.weight || 1);
    const pending = [...compList];
    while (pending.length) {
      let pick = 0;
      if (rank.size) { pick = pending.findIndex(c => c.some(v => bes.some(i => (from[i] === v || to[i] === v) && rank.has(from[i] === v ? to[i]! : from[i]!)))); if (pick < 0) pick = 0; }
      const c = pending.splice(pick, 1)[0]!, inC = new Set(c), opts: { d: number; w: number }[] = [];
      for (const v of c) for (const i of bes) { if (from[i] !== v && to[i] !== v) continue; const o = from[i] === v ? to[i]! : from[i]!; if (inC.has(o)) continue; const w = want(i, v); if (w !== null) opts.push({ d: w - compRank.get(v)!, w: ordW(i) * (dir.has(i) ? 2 : 1) }); }
      let shift = 0;
      if (opts.length) { opts.sort((p, q) => p.d - q.d); const tot = opts.reduce((a, o) => a + o.w, 0); let acc = 0; for (const o of opts) { acc += o.w; if (acc >= tot / 2 - 1e-9) { shift = o.d; break; } } }
      for (const v of c) rank.set(v, compRank.get(v)! + shift);
    }
    { const lo = Math.min(...B.nodes.map(v => rank.get(v)!)); for (const v of B.nodes) rank.set(v, rank.get(v)! - lo); }
    // Initial order (A.6): depth first from the sources in record order.
    const R = Math.max(0, ...B.nodes.map(v => rank.get(v)!)) + 1;
    const adjOut = new Map<number, number[]>(B.nodes.map(v => [v, []]));
    for (const i of bes) { const d = dir.get(i) ?? { s: from[i]!, t: to[i]! }; const [s, t] = rank.get(d.s)! <= rank.get(d.t)! ? [d.s, d.t] : [d.t, d.s]; adjOut.get(s)!.push(t); }
    for (const l of adjOut.values()) l.sort((p, q) => p - q);
    const dfs: number[] = [], seen = new Set<number>();
    const visit = (v: number) => { const st = [v]; while (st.length) { const x = st.pop()!; if (seen.has(x)) continue; seen.add(x); dfs.push(x); for (const y of [...adjOut.get(x)!].reverse()) if (!seen.has(y)) st.push(y); } };
    for (const v of [...B.nodes].sort((p, q) => rank.get(p)! - rank.get(q)! || p - q)) visit(v);
    // Width bound (A.4-6): a layer longer than maxPer is split in order into sub-layers.
    const maxPer = Math.max(4, Math.min(10, Math.round(Math.sqrt(n * Math.max(1, opt.aspect) / 1.6))));
    const byRank: number[][] = Array.from({ length: R }, () => []); for (const v of dfs) byRank[rank.get(v)!]!.push(v);
    const final = new Map<number, number>(), wrapAfter = new Set<number>(); let L = 0;
    for (let r = 0; r < R; r++) { const l = byRank[r]!, parts = Math.max(1, Math.ceil(l.length / maxPer)), per = Math.ceil(l.length / parts);
      for (let p = 0; p < parts; p++) { for (const v of l.slice(p * per, (p + 1) * per)) final.set(v, L); if (p < parts - 1) wrapAfter.add(L); L++; } }
    // Layers with dummies; segments between neighbouring layers.
    const layers: number[][] = Array.from({ length: L }, () => []);
    const isDummy: boolean[] = [], h: number[] = [], anc: number[] = [], wd: number[] = [];
    const nodeOf: number[] = []; // laid index → global node index (-1 for a dummy)
    const lid = new Map<number, number>();
    for (const v of dfs) { const k = isDummy.length; lid.set(v, k); isDummy.push(false); h.push(nodes[v]!.h); anc.push(nodes[v]!.anchor); wd.push(nodes[v]!.w); nodeOf.push(v); layers[final.get(v)!]!.push(k); }
    const segs: Seg[] = [], chains = new Map<number, { path: number[]; rev: boolean }>();
    const frac = (v: number, i: number, end: 'out' | 'in') => { const nd = nodes[v]!; let y: number | undefined; for (const id of edges[i]!.relIds) { y = nd.pins?.[`${id}|${end}`]; if (y !== undefined) break; } return (y ?? nd.anchor) / Math.max(1, nd.h); };
    for (const i of bes) {
      const a = from[i]!, b = to[i]!, la = final.get(a)!, lb = final.get(b)!; if (la === lb) continue;
      const rev = la > lb, s = rev ? b : a, t = rev ? a : b, ls = Math.min(la, lb), lt = Math.max(la, lb);
      const path = [lid.get(s)!];
      for (let l = ls + 1; l < lt; l++) { const k = isDummy.length; isDummy.push(true); h.push(0); anc.push(0); wd.push(0); nodeOf.push(-1); layers[l]!.push(k); path.push(k); dummies++; }
      path.push(lid.get(t)!);
      chains.set(i, { path, rev });
      const w = ordW(i), ps = frac(s, i, rev ? 'in' : 'out'), pt = frac(t, i, rev ? 'out' : 'in');
      for (let j = 0; j + 1 < path.length; j++) segs.push({ u: path[j]!, v: path[j + 1]!, w, pu: j === 0 ? ps : 0.5, pv: j + 2 === path.length ? pt : 0.5, key: edges[i]!.key, spine: false });
    }
    // The spine (the heaviest chain of driving lines, flows before needs): one straight line through the block.
    const spine: number[] = (() => {
      const best = new Map<number, { w: number; next: number | null }>();
      const walk = (v: number, g = 0): { w: number; next: number | null } => {
        const hit = best.get(v); if (hit) return hit;
        let r: { w: number; next: number | null } = { w: 0, next: null };
        if (g < 64) for (const i of allDrives) { const d = dir.get(i)!; if (d.s !== v || reversed.has(edges[i]!.key) || final.get(d.t)! <= final.get(v)!) continue; const w = layW(i) + 0.01 + walk(d.t, g + 1).w; if (w > r.w + 1e-9) r = { w, next: d.t }; }
        best.set(v, r); return r;
      };
      let head = -1, hw = 0; for (const v of [...B.nodes].sort((p, q) => p - q)) { const w = walk(v).w; if (w > hw + 1e-9) { hw = w; head = v; } }
      if (head < 0 || hw < 1) return [];
      const p = [head]; for (let c = best.get(head)!.next, g = 0; c !== null && g < 64; c = best.get(c)!.next, g++) p.push(c);
      return p;
    })();
    const spineSet = new Set(spine.map(v => lid.get(v)!));
    for (let j = 0; j + 1 < spine.length; j++) {
      const i = bes.find(e => dir.get(e)?.s === spine[j] && dir.get(e)?.t === spine[j + 1] && !reversed.has(edges[e]!.key));
      const ch = i !== undefined ? chains.get(i) : undefined; if (!ch) continue;
      for (const k of ch.path) spineSet.add(k);
      for (const s of segs) if (s.key === edges[i!]!.key) s.spine = true;
    }
    // Crossing reduction (A.6).
    orderLayers(layers, segs, opt.sweeps ?? 32, nodeOf, bes.filter(i => final.get(from[i]!) === final.get(to[i]!)).map(i => ({ a: lid.get(from[i]!)!, b: lid.get(to[i]!)!, w: ordW(i) })));
    laid.push({ layers, segs, chains, isDummy, h, anc, wd, spineSet, spine, wrapAfter, nodeOf, gut: nodeOf.map(v => (v >= 0 ? nodes[v]!.gutter ?? 0 : 0)) });
  }

  // Coordinates under one spacing; the slack spending tries wider spacings (F.3).
  const place = (rowGap: number, laneMargin: number, layerGap: number) => {
    const out: { ys: number[]; xs: number[]; colX: number[]; colW: number[]; gaps: number[]; tracks: Map<string, number>[]; w: number; h: number; y0: number }[] = [];
    for (const b of laid) {
      const sep = (u: number, v: number) => { const du = b.isDummy[u]!, dv = b.isDummy[v]!; const g = du && dv ? opt.laneTrack : du || dv ? laneMargin : Math.max(rowGap, b.gut[u]!, b.gut[v]!); return (b.h[u]! - b.anc[u]!) + g + b.anc[v]!; };
      const ys = brandesKoepf(b.layers, b.segs, b.isDummy, sep, b.spineSet);
      polish(b.layers, b.segs, ys, sep, b.isDummy, b.spineSet);
      for (let k = 0; k < ys.length; k++) ys[k] = half(ys[k]!);
      // Columns: as wide as their widest member, left-aligned; each gap as wide as the tracks its height-changing runs need.
      const colW = b.layers.map(l => Math.max(0, ...l.map(k => b.wd[k]!)));
      const tracks: Map<string, number>[] = [], gaps: number[] = [];
      for (let L = 0; L + 1 < b.layers.length; L++) {
        // Each run from its port as the router will set it: the ends on one side of a card spread PORT_GAP apart round its contact
        // point, in the order of where their lines go next (map-route assignPorts orders them so too, by the hint's first row).
        const inGap = b.segs.filter(s => b.layers[L]!.includes(s.u));
        const portY = new Map<Seg, { a: number; b: number }>(inGap.map(s => [s, { a: ys[s.u]!, b: ys[s.v]! }]));
        for (const end of ['u', 'v'] as const) {
          const by = new Map<number, Seg[]>(); for (const s of inGap) if (!b.isDummy[s[end]]) (by.get(s[end]) ?? by.set(s[end], []).get(s[end])!).push(s);
          for (const [k, list] of by) {
            if (list.length < 2) continue;
            list.sort((p, q) => ys[end === 'u' ? p.v : p.u]! - ys[end === 'u' ? q.v : q.u]! || cmpId(p.key, q.key));
            list.forEach((s, i) => { const y = ys[k]! + (i - (list.length - 1) / 2) * PORT_STEP; portY.get(s)![end === 'u' ? 'a' : 'b'] = y; });
          }
        }
        const runs = inGap.map(s => ({ key: s.key, ...portY.get(s)! })).filter(r => Math.abs(r.a - r.b) >= 1);
        const t = trackOf(runs); tracks.push(t.at);
        const base = b.wrapAfter.has(L) ? (opt.wrapGap ?? layerGap / 2) : layerGap;
        gaps.push(Math.max(base, laneRoomOf(t.n, laneMargin, opt.laneTrack)));
      }
      const colX: number[] = []; let x = 0; for (let L = 0; L < b.layers.length; L++) { colX.push(x); x += colW[L]! + (gaps[L] ?? 0); }
      const real = b.layers.flat().filter(k => !b.isDummy[k]);
      const top = Math.min(...real.map(k => ys[k]! - b.anc[k]!)), bot = Math.max(...real.map(k => ys[k]! - b.anc[k]! + b.h[k]!));
      out.push({ ys, xs: [], colX, colW, gaps, tracks, w: colX.at(-1)! + colW.at(-1)!, h: bot - top, y0: top });
    }
    // Shelf packing (A.8): the main block, then the others in rows under it no wider than it (or the widest block).
    const bg = opt.blockGap ?? rowGap * 2, rowW = Math.max(0, ...out.map(o => o.w));
    const off: { x: number; y: number }[] = []; let cx = 0, cy = 0, rowH = 0;
    out.forEach((o, i) => {
      if (i === 0) { off.push({ x: 0, y: 0 }); cy = o.h + bg; return; }
      if (cx > 0 && cx + o.w > rowW + 0.5) { cx = 0; cy += rowH + bg; rowH = 0; }
      off.push({ x: cx, y: cy }); cx += o.w + layerGap; rowH = Math.max(rowH, o.h);
    });
    const W = Math.max(0, ...out.map((o, i) => off[i]!.x + o.w)), Hh = Math.max(0, ...out.map((o, i) => off[i]!.y + o.h));
    return { out, off, W, H: Hh };
  };
  let rowGap = opt.rowGap, laneMargin = opt.laneMargin, layerGap = opt.layerGap;
  let P = place(rowGap, laneMargin, layerGap);
  if (opt.spend && laid.length && P.H > 0) {
    const asp = Math.max(0.5, opt.aspect), maxRow = opt.maxRowGap ?? 48, maxLane = opt.maxLaneMargin ?? 20, maxLayer = opt.maxLayerGap ?? 140;
    if (P.W / P.H > 1.15 * asp) {
      // The height grows about linearly with the row gap: the cap first, then the gap that meets the aspect (on the 2px grid).
      const lmOf = (g: number) => Math.min(maxLane, opt.laneMargin + ((g - opt.rowGap) / Math.max(1, maxRow - opt.rowGap)) * (maxLane - opt.laneMargin));
      const P0 = P, Pm = place(maxRow, lmOf(maxRow), layerGap);
      if (Pm.W / Pm.H >= asp || Pm.H <= P0.H) { P = Pm; rowGap = maxRow; laneMargin = lmOf(maxRow); }
      else { const g = Math.min(maxRow, Math.max(opt.rowGap, Math.ceil((opt.rowGap + ((P0.W / asp - P0.H) / (Pm.H - P0.H)) * (maxRow - opt.rowGap)) / 2) * 2)); P = place(g, lmOf(g), layerGap); rowGap = g; laneMargin = lmOf(g); }
    } else if (P.W / P.H < asp / 1.15) {
      const P0 = P, Pm = place(rowGap, laneMargin, maxLayer);
      if (Pm.W / Pm.H <= asp || Pm.W <= P0.W) { P = Pm; layerGap = maxLayer; }
      else { const g = Math.min(maxLayer, Math.max(opt.layerGap, Math.ceil((opt.layerGap + ((asp * P0.H - P0.W) / (Pm.W - P0.W)) * (maxLayer - opt.layerGap)) / 4) * 4)); P = place(rowGap, laneMargin, g); layerGap = g; }
    }
  }
  // Results.
  const pos = new Map<string, { x: number; y: number }>(), layer = new Map<string, number>(), order: string[][] = [], channels = new Map<string, Channel>();
  let colBase = 0, crossings = 0, length = 0;
  laid.forEach((b, bi) => {
    const o = P.out[bi]!, d = P.off[bi]!, nodeOf = b.nodeOf;
    b.layers.forEach((l, L) => {
      const col: string[] = [];
      for (const k of l) { if (b.isDummy[k]) continue; const nd = nodes[nodeOf[k]!]!; pos.set(nd.id, { x: half(d.x + o.colX[L]!), y: half(d.y + o.ys[k]! - b.anc[k]! - o.y0) }); layer.set(nd.id, colBase + L); col.push(nd.id); }
      order.push(col);
    });
    colBase += b.layers.length;
    crossings += totalCrossings(b.layers, b.segs, true);
    const L = new Map<number, number>(); b.layers.forEach((l, li) => l.forEach(k => L.set(k, li)));
    for (const [i, ch] of b.chains) {
      const p = ch.path; length += L.get(p.at(-1)!)! - L.get(p[0]!)!;
      const xs: number[] = [], ys: number[] = [];
      for (let j = 0; j + 1 < p.length; j++) {
        const Lj = L.get(p[j]!)!, gl = o.colX[Lj]! + o.colW[Lj]!, gw = o.gaps[Lj]!, t = o.tracks[Lj]!.get(edges[i]!.key);
        const n = o.tracks[Lj]!.get('#') ?? 0, mid = gl + gw / 2;
        xs.push(half(d.x + (t === undefined ? mid : mid - ((n - 1) * opt.laneTrack) / 2 + t * opt.laneTrack)));
        if (j + 2 < p.length) ys.push(half(d.y + o.ys[p[j + 1]!]! - o.y0));
      }
      channels.set(edges[i]!.key, ch.rev ? { xs: xs.reverse(), ys: ys.reverse() } : { xs, ys });
    }
  });
  const main = laid[0], spine = main ? main.spine.map(v => nodes[v]!.id) : [];
  return { pos, layer, order, reversed, channels, gaps: P.out[0]?.gaps ?? [], spine, size: { w: P.W, h: P.H },
    metrics: { crossings, length, dummies, ms: now() - t0, pivots, rowGap, layerGap } };
}

/** Tracks for the runs that change height in one gap (C.2): fewest tracks (left-edge interval colouring, runs on one track at least a
 * track apart), then ordered so they cross least (of two runs going down, the one starting higher further right; going up, the one
 * starting lower). at: '<key>|<hop>' → track index; '#' → the number of tracks. Keys of runs are their segment's key and hop. */
function trackOf(runs: { key: string; a: number; b: number }[]): { n: number; at: Map<string, number> } {
  const at = new Map<string, number>(); if (!runs.length) { at.set('#', 0); return { n: 0, at }; }
  // Of two runs, which goes left: the order whose turns cross the other run less (run i left of j: j's first run, coming from the
  // left at its start height, crosses i's vertical when that height is inside i's extent; i's last run, going right at its end
  // height, crosses j's vertical likewise). Pairwise, settled by passes; ties by start height, then key.
  const inside = (y: number, p: number, q: number) => y > Math.min(p, q) + 0.5 && y < Math.max(p, q) - 0.5;
  const cost = (i: { a: number; b: number }, j: { a: number; b: number }) => Number(inside(j.a, i.a, i.b)) + Number(inside(i.b, j.a, j.b));
  const ord = [...runs].sort((p, q) => p.a - q.a || p.b - q.b || cmpId(p.key, q.key));
  for (let pass = 0; pass < ord.length; pass++) { let sw = false; for (let i = 0; i + 1 < ord.length; i++) { const p = ord[i]!, q = ord[i + 1]!; if (cost(p, q) > cost(q, p)) { ord[i] = q; ord[i + 1] = p; sw = true; } } if (!sw) break; }
  // Tracks in that order: a run takes the track right of every earlier run whose extent it meets (fewest tracks the order allows).
  const tr: number[] = [];
  ord.forEach((r, i) => { let t = 0; for (let j = 0; j < i; j++) { const o = ord[j]!; if (Math.max(o.a, o.b) >= Math.min(r.a, r.b) - 6 && Math.min(o.a, o.b) <= Math.max(r.a, r.b) + 6) t = Math.max(t, tr[j]! + 1); } tr.push(t); at.set(r.key, t); });
  const n = Math.max(...tr) + 1; at.set('#', n);
  return { n, at };
}
/* ---------- ordering ---------- */
function orderLayers(layers: number[][], segs: Seg[], sweeps: number, nodeOf: number[], flat: { a: number; b: number; w: number }[]) {
  const pos = new Map<number, number>(); const index = () => layers.forEach(l => l.forEach((k, i) => pos.set(k, i)));
  index();
  const ins = new Map<number, Seg[]>(), outs = new Map<number, Seg[]>();
  for (const s of segs) { (outs.get(s.u) ?? outs.set(s.u, []).get(s.u)!).push(s); (ins.get(s.v) ?? ins.set(s.v, []).get(s.v)!).push(s); }
  const tie = (k: number) => nodeOf[k]! >= 0 ? nodeOf[k]! : 1e6 + k;
  const median = (vals: { p: number; w: number }[]): number => {
    vals.sort((a, b) => a.p - b.p); const tot = vals.reduce((a, v) => a + v.w, 0); let acc = 0;
    for (let i = 0; i < vals.length; i++) { acc += vals[i]!.w; if (Math.abs(acc - tot / 2) < 1e-9 && i + 1 < vals.length) return (vals[i]!.p + vals[i + 1]!.p) / 2; if (acc > tot / 2) return vals[i]!.p; }
    return vals.at(-1)!.p;
  };
  const sweep = (li: number, down: boolean) => {
    const l = layers[li]!, m = new Map<number, number>();
    for (const k of l) { const nb = down ? (ins.get(k) ?? []).map(s => ({ p: pos.get(s.u)! + s.pu, w: s.w })) : (outs.get(k) ?? []).map(s => ({ p: pos.get(s.v)! + s.pv, w: s.w })); if (nb.length) m.set(k, median(nb)); }
    const mov = l.filter(k => m.has(k)).sort((a, b) => m.get(a)! - m.get(b)! || pos.get(a)! - pos.get(b)! || tie(a) - tie(b));
    let j = 0; layers[li] = l.map(k => (m.has(k) ? mov[j++]! : k));
    layers[li]!.forEach((k, i) => pos.set(k, i));
  };
  // Crossings of two neighbours u (before) and v with the layers beside them (weighted, with their pins), plus in-layer spans.
  const pairCost = (u: number, v: number) => {
    let c = 0;
    for (const [list, end] of [[ins, 'u'], [outs, 'v']] as const) {
      const su = list.get(u) ?? [], sv = list.get(v) ?? [];
      for (const a of su) for (const b of sv) { const pa = pos.get(a[end])! + (end === 'u' ? a.pu : a.pv), pb = pos.get(b[end])! + (end === 'u' ? b.pu : b.pv); if (pa > pb + 1e-9) c += a.w * b.w; }
    }
    return c;
  };
  const flatCost = () => flat.reduce((a, f) => a + f.w * Math.max(0, Math.abs(pos.get(f.a)! - pos.get(f.b)!) - 1), 0);
  const transpose = () => {
    for (let pass = 0; pass < 4; pass++) {
      let improved = false;
      for (const l of layers) for (let i = 0; i + 1 < l.length; i++) {
        const u = l[i]!, v = l[i + 1]!, before = pairCost(u, v), fb = flat.length ? flatCost() : 0;
        const after = pairCost(v, u);
        l[i] = v; l[i + 1] = u; pos.set(v, i); pos.set(u, i + 1);
        const fa = flat.length ? flatCost() : 0;
        if (after + 0.25 * fa < before + 0.25 * fb - 1e-9) { improved = true; continue; }
        l[i] = u; l[i + 1] = v; pos.set(u, i); pos.set(v, i + 1);
      }
      if (!improved) break;
    }
  };
  const score = () => totalCrossings(layers, segs, false) + 0.25 * flatCost();
  let best = layers.map(l => [...l]), bs = score();
  let stale = 0;
  for (let it = 0; it < sweeps; it++) {
    const down = it % 2 === 0;
    if (down) for (let li = 1; li < layers.length; li++) sweep(li, true); else for (let li = layers.length - 2; li >= 0; li--) sweep(li, false);
    transpose();
    const s = score(); if (s < bs - 1e-9) { bs = s; best = layers.map(l => [...l]); stale = 0; } else stale++;
    // At least 24 sweeps (A.6); past them, stop once 8 sweeps in a row found nothing better, or nothing crosses.
    if (it + 1 >= 24 && (stale >= 8 || bs === 0)) break;
  }
  best.forEach((l, i) => { layers[i] = l; });
}
/** Crossings between the segments of each pair of neighbouring layers (weighted unless plain: each pair once). */
function totalCrossings(layers: number[][], segs: Seg[], plain: boolean): number {
  const pos = new Map<number, number>(), L = new Map<number, number>(); layers.forEach((l, li) => l.forEach((k, i) => { pos.set(k, i); L.set(k, li); }));
  const by = new Map<number, Seg[]>(); for (const s of segs) { const l = L.get(s.u)!; (by.get(l) ?? by.set(l, []).get(l)!).push(s); }
  let c = 0;
  for (const list of by.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i]!, b = list[j]!; if (a.u === b.u || a.v === b.v) { if (a.u === b.u && a.v === b.v) continue; }
    const ua = pos.get(a.u)! + a.pu, ub = pos.get(b.u)! + b.pu, va = pos.get(a.v)! + a.pv, vb = pos.get(b.v)! + b.pv;
    if ((ua - ub) * (va - vb) < -1e-9) c += plain ? 1 : a.w * b.w;
  }
  return c;
}

/* ---------- coordinates: Brandes–Köpf on anchors (y runs along a layer) ---------- */
function brandesKoepf(layers: number[][], segs: Seg[], isDummy: boolean[], sep: (u: number, v: number) => number, spine: Set<number>): number[] {
  const K = isDummy.length, preds: number[][] = Array.from({ length: K }, () => []), succs: number[][] = Array.from({ length: K }, () => []);
  const spineSeg = new Set<string>();
  for (const s of segs) { preds[s.v]!.push(s.u); succs[s.u]!.push(s.v); if (s.spine) spineSeg.add(`${s.u}|${s.v}`); }
  const order = new Array<number>(K).fill(0); layers.forEach(l => l.forEach((k, i) => { order[k] = i; }));
  // Type-1 conflicts: a segment touching a real node that crosses an inner segment (dummy to dummy) gives way.
  const conflict = new Set<string>(), mark = (a: number, b: number) => conflict.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  for (let li = 1; li < layers.length; li++) {
    const prev = layers[li - 1]!, layer = layers[li]!; let k0 = 0, scan = 0;
    layer.forEach((v, i) => {
      const w = isDummy[v] ? preds[v]!.find(u => isDummy[u]) : undefined, k1 = w !== undefined ? order[w]! : prev.length;
      if (w !== undefined || i === layer.length - 1) {
        for (const sn of layer.slice(scan, i + 1)) for (const u of preds[sn]!) { const up = order[u]!; if ((up < k0 || k1 < up) && !(isDummy[u] && isDummy[sn])) mark(u, sn); }
        scan = i + 1; k0 = k1;
      }
    });
  }
  const has = (a: number, b: number) => conflict.has(a < b ? `${a}|${b}` : `${b}|${a}`);
  const xss: number[][] = [];
  for (const vert of ['u', 'd'] as const) for (const horiz of ['l', 'r'] as const) {
    let L = vert === 'u' ? layers.map(l => [...l]) : [...layers].reverse().map(l => [...l]);
    if (horiz === 'r') L = L.map(l => [...l].reverse());
    const nb = vert === 'u' ? preds : succs, pos = new Array<number>(K).fill(0); L.forEach(l => l.forEach((k, i) => { pos[k] = i; }));
    const root = Array.from({ length: K }, (_, i) => i), align = Array.from({ length: K }, (_, i) => i);
    for (const layer of L) {
      let prevIdx = -1;
      for (const v of layer) {
        const ws = [...nb[v]!].sort((a, b) => pos[a]! - pos[b]!); if (!ws.length) continue;
        // The spine aligns first: a spine node takes its spine neighbour when it can.
        const sp = ws.find(w => spineSeg.has(vert === 'u' ? `${w}|${v}` : `${v}|${w}`));
        const cands = sp !== undefined ? [sp] : (() => { const mp = (ws.length - 1) / 2; return ws.slice(Math.floor(mp), Math.ceil(mp) + 1); })();
        for (const w of cands) if (align[v] === v && prevIdx < pos[w]! && !has(v, w)) { align[w] = v; align[v] = root[v] = root[w]!; prevIdx = pos[w]!; }
      }
    }
    // Compaction: block graph from neighbours within each layer, longest path, then pulled back toward the other side.
    const rev = horiz === 'r', bsucc = new Map<number, Map<number, number>>(), bpred = new Map<number, Map<number, number>>();
    const roots = new Set<number>(); for (let k = 0; k < K; k++) roots.add(root[k]!);
    for (const r of roots) { bsucc.set(r, new Map()); bpred.set(r, new Map()); }
    for (const layer of L) for (let i = 1; i < layer.length; i++) {
      const u = layer[i - 1]!, v = layer[i]!, ru = root[u]!, rv = root[v]!, s = rev ? sep(v, u) : sep(u, v);
      bsucc.get(ru)!.set(rv, Math.max(bsucc.get(ru)!.get(rv) ?? 0, s)); bpred.get(rv)!.set(ru, Math.max(bpred.get(rv)!.get(ru) ?? 0, s));
    }
    const deg = new Map([...roots].map(r => [r, bpred.get(r)!.size])), topo: number[] = [], q = [...roots].filter(r => !deg.get(r)).sort((a, b) => a - b);
    while (q.length) { const r = q.shift()!; topo.push(r); for (const t of [...bsucc.get(r)!.keys()].sort((a, b) => a - b)) { deg.set(t, deg.get(t)! - 1); if (!deg.get(t)) q.push(t); } }
    const xs = new Map<number, number>();
    for (const r of topo) { let x = 0; for (const [p, w] of bpred.get(r)!) x = Math.max(x, xs.get(p)! + w); xs.set(r, x); }
    for (const r of [...topo].reverse()) { let m = Infinity; for (const [t, w] of bsucc.get(r)!) m = Math.min(m, xs.get(t)! - w); if (m !== Infinity) xs.set(r, Math.max(xs.get(r)!, m)); }
    const out = new Array<number>(K).fill(0); for (let k = 0; k < K; k++) out[k] = (xs.get(root[k]!) ?? 0) * (rev ? -1 : 1);
    xss.push(out);
  }
  // Align to the narrowest; balance (the mean of the two middle candidates).
  const span = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
  let narrow = 0; for (let i = 1; i < 4; i++) if (span(xss[i]!) < span(xss[narrow]!) - 1e-9) narrow = i;
  const lo = Math.min(...xss[narrow]!), hi = Math.max(...xss[narrow]!);
  xss.forEach((xs, i) => { if (i === narrow) return; const d = i % 2 === 0 ? lo - Math.min(...xs) : hi - Math.max(...xs); for (let k = 0; k < K; k++) xs[k]! += d; });
  const ys = new Array<number>(K).fill(0);
  for (let k = 0; k < K; k++) { const v = xss.map(x => x[k]!).sort((a, b) => a - b); ys[k] = (v[1]! + v[2]!) / 2; }
  // The balance can bring two neighbours closer than their separation: push apart in order, keeping the layer's middle.
  for (const l of layers) {
    if (l.length < 2) continue;
    const want = l.map(k => ys[k]!), got = [...want];
    for (let i = 1; i < l.length; i++) got[i] = Math.max(got[i]!, got[i - 1]! + sep(l[i - 1]!, l[i]!));
    const shift = want.reduce((a, y, i) => a + (got[i]! - y), 0) / l.length;
    if (got.some((y, i) => Math.abs(y - want[i]!) > 1e-6)) { for (let i = 0; i < l.length; i++) got[i]! -= shift; for (let i = 1; i < l.length; i++) got[i] = Math.max(got[i]!, got[i - 1]! + sep(l[i - 1]!, l[i]!)); }
    l.forEach((k, i) => { ys[k] = got[i]!; });
  }
  return ys;
}
/** Priority polish (A.7-5): each real node (the spine's too: B–K already set it straight, and a hub on it pulled to its partners' middle
 * reads better than one held at the top) moves toward the weighted median of its neighbours' anchors, inside the room
 * its layer's order leaves. */
function polish(layers: number[][], segs: Seg[], ys: number[], sep: (u: number, v: number) => number, isDummy: boolean[], spine: Set<number>) {
  const nb = new Map<number, { k: number; w: number }[]>();
  // The spine's own steps weigh four times: the main flow stays one straight line unless most of a part's lines pull it away.
  for (const s of segs) { const w = s.spine ? 4 * s.w : s.w; (nb.get(s.u) ?? nb.set(s.u, []).get(s.u)!).push({ k: s.v, w }); (nb.get(s.v) ?? nb.set(s.v, []).get(s.v)!).push({ k: s.u, w }); }
  void spine;
  // A long line's dummy rows move as one row (a stair of rows would add turns): to the height of its source, else of its target, where
  // every row it passes leaves room; else it stays.
  const chains = new Map<string, { ds: number[]; a: number; b: number }>();
  for (const s of segs) { const c = chains.get(s.key) ?? chains.set(s.key, { ds: [], a: -1, b: -1 }).get(s.key)!; if (!isDummy[s.u]) c.a = s.u; else c.ds.push(s.u); if (!isDummy[s.v]) c.b = s.v; }
  const where = new Map<number, [number, number]>(); layers.forEach((l, li) => l.forEach((k, i) => where.set(k, [li, i])));
  const room = (k: number): [number, number] => { const [li, i] = where.get(k)!, l = layers[li]!; return [i > 0 ? ys[l[i - 1]!]! + sep(l[i - 1]!, k) : -Infinity, i + 1 < l.length ? ys[l[i + 1]!]! - sep(k, l[i + 1]!) : Infinity]; };
  const rows = () => { for (const c of chains.values()) {
    if (!c.ds.length || c.a < 0 || c.b < 0) continue;
    let lo = -Infinity, hi = Infinity; for (const d of c.ds) { const [p, q] = room(d); lo = Math.max(lo, p); hi = Math.min(hi, q); }
    const y = [ys[c.a]!, ys[c.b]!].find(t => t >= lo - 1e-6 && t <= hi + 1e-6); if (y !== undefined) for (const d of c.ds) ys[d] = y;
  } };
  for (let pass = 0; pass < 8; pass++) for (const l of (pass % 2 ? [...layers].reverse() : layers)) l.forEach((k, i) => {
    if (isDummy[k]) return;
    if (i === 0 && l === (pass % 2 ? layers[layers.length - 1] : layers[0])) rows();
    const list = nb.get(k); if (!list?.length) return;
    const v = list.map(x => ({ y: ys[x.k]!, w: x.w })).sort((a, b) => a.y - b.y), tot = v.reduce((a, x) => a + x.w, 0);
    let acc = 0, m = v[0]!.y; for (let j = 0; j < v.length; j++) { acc += v[j]!.w; if (Math.abs(acc - tot / 2) < 1e-9 && j + 1 < v.length) { m = (v[j]!.y + v[j + 1]!.y) / 2; break; } if (acc > tot / 2) { m = v[j]!.y; break; } }
    const lo = i > 0 ? ys[l[i - 1]!]! + sep(l[i - 1]!, k) : -Infinity, hi = i + 1 < l.length ? ys[l[i + 1]!]! - sep(k, l[i + 1]!) : Infinity;
    ys[k] = Math.min(hi, Math.max(lo, m));
  });
  rows();
}
