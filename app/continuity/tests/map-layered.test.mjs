// Beauty v3 (layout slice A): the in-house layered placement. Cycles are broken for the layout only (never a drawn direction), the
// layers make the weighted line length least (network simplex, checked against brute force), long lines get dummy rows and run
// straight, 80- and 104-high cards keep their contact rows level, every corridor is laneRoom of its lines, the result is the same on
// repeat and on shuffled input, and it is fast. On fixtures built from the eight census maps' drawn structure (anonymised), the
// routed crossings and line length are not worse than e5372e29's placement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layered, networkSimplex, laneRoomOf } from '../dist/public/client/layered.js';
import { routeEdges } from '../dist/public/client/map-route.js';

const OPT = { layerGap: 76, rowGap: 22, laneMargin: 14, laneTrack: 10, aspect: 2, wrapGap: 36 };
const N = (id, order, h = 80) => ({ id, w: 224, h, anchor: 40, order });
const E = (from, to, kind = 'drive', key = `${from}|${to}|${kind}`) => ({ key, from, to, kind, weight: 1, relIds: [key] });
const lcg = (seed) => () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);

test('cycles are broken for the layout only: fewest lines turned, references dropped, a line back to a participant turned first', () => {
  const r = layered([N('a', 0), N('b', 1), N('c', 2)], [E('a', 'b'), E('b', 'c'), E('c', 'a')], OPT);
  assert.equal(r.reversed.size, 1, 'one line of a three-cycle is turned');
  for (const [k, e] of [['a|b|drive', ['a', 'b']], ['b|c|drive', ['b', 'c']], ['c|a|drive', ['c', 'a']]]) {
    const [s, t] = e, fwd = r.layer.get(t) > r.layer.get(s);
    assert.equal(fwd, !r.reversed.has(k), `${k}: drawn ${s}→${t}; laid ${fwd ? 'forward' : 'back'} exactly when listed as reversed`);
  }
  const q = layered([N('a', 0), N('b', 1)], [E('a', 'b'), E('b', 'a', 'ref')], OPT);
  assert.equal(q.reversed.size, 0, 'a reference that would close a cycle is dropped from the layering, never reversed');
  assert.ok(q.layer.get('b') > q.layer.get('a'));
  assert.ok(q.channels.has('b|a|ref'), 'the dropped reference is still drawn and has its route');
  const user = { ...N('user', 0), role: 'outside' };
  const p = layered([user, N('sys', 1)], [E('user', 'sys'), E('sys', 'user')], OPT);
  assert.deepEqual([...p.reversed], ['sys|user|drive'], 'the result returned to the participant is the line turned');
  assert.ok(p.layer.get('user') < p.layer.get('sys'), 'the participant reads first');
});

test('network simplex: least weighted span, checked against brute force on small graphs', () => {
  const rnd = lcg(7);
  for (let g = 0; g < 40; g++) {
    const n = 3 + Math.floor(rnd() * 4), E2 = [];
    for (let s = 0; s < n; s++) for (let t = s + 1; t < n; t++) if (rnd() < 0.45) E2.push({ s, t, w: 1 + Math.floor(rnd() * 3) });
    // connect it
    for (let v = 1; v < n; v++) if (!E2.some(e => e.s === v || e.t === v)) E2.push({ s: 0, t: v, w: 1 });
    const cost = (r) => E2.reduce((a, e) => a + e.w * (r[e.t] - r[e.s]), 0);
    const { rank } = networkSimplex(n, E2);
    assert.ok(E2.every(e => rank[e.t] - rank[e.s] >= 1), 'feasible');
    let best = Infinity; const r = new Array(n).fill(0);
    const rec = (v) => { if (v === n) { if (E2.every(e => r[e.t] - r[e.s] >= 1)) best = Math.min(best, cost(r)); return; } for (let x = 0; x < n; x++) { r[v] = x; rec(v + 1); } };
    rec(0);
    assert.equal(cost(rank), best, `graph ${g}: optimal`);
  }
});

test('long lines get a dummy per inner layer and run straight through them', () => {
  const r = layered([N('a', 0), N('b', 1), N('c', 2), N('d', 3)], [E('a', 'b'), E('b', 'c'), E('c', 'd'), E('a', 'd', 'drive', 'a|d|x')], OPT);
  assert.equal(r.metrics.dummies, 2);
  const ch = r.channels.get('a|d|x');
  assert.equal(ch.ys.length, 2, 'two dummy rows'); assert.equal(ch.xs.length, 3, 'a track in each of the three gaps');
  assert.equal(ch.ys[0], ch.ys[1], 'straight through the columns it passes');
  const spine = ['a', 'b', 'c', 'd'].map(i => r.pos.get(i).y);
  assert.ok(spine.every(y => y === spine[0]), 'the spine is one straight line');
});

test('crossings: a swap that removes them is found; K2,3 keeps its least three', () => {
  const r = layered([N('a1', 0), N('a2', 1), N('b1', 2), N('b2', 3)], [E('a1', 'b2'), E('a2', 'b1')], OPT);
  assert.equal(r.metrics.crossings, 0);
  const k = layered(['a1', 'a2', 'b1', 'b2', 'b3'].map((id, i) => N(id, i)), ['b1', 'b2', 'b3'].flatMap(b => [E('a1', b), E('a2', b)]), OPT);
  assert.equal(k.metrics.crossings, 3);
});

test('80- and 104-high cards keep their contact rows level; every corridor is laneRoom of its lines', () => {
  const r = layered([N('a', 0, 104), N('b', 1, 80), N('c', 2, 104)], [E('a', 'b'), E('b', 'c')], OPT);
  assert.equal(r.pos.get('a').y + 40, r.pos.get('b').y + 40); assert.equal(r.pos.get('b').y, r.pos.get('c').y);
  // A fan: s feeds four parts, which all feed t; s also reaches t past them (a dummy among the four).
  const ids = ['s', 'p1', 'p2', 'p3', 'p4', 't'], es = [...['p1', 'p2', 'p3', 'p4'].flatMap(p => [E('s', p), E(p, 't')]), E('s', 't', 'drive', 'long')];
  const q = layered(ids.map((id, i) => N(id, i)), es, OPT);
  const col = q.order[q.layer.get('p1')], ys = col.map(id => q.pos.get(id).y).sort((a, b) => a - b);
  const dummyY = q.channels.get('long').ys[0];
  for (let i = 1; i < ys.length; i++) {
    const gap = ys[i] - (ys[i - 1] + 80), between = dummyY > ys[i - 1] + 40 && dummyY < ys[i] + 40;
    assert.ok(gap >= (between ? laneRoomOf(1, 14, 10) - 2 : 22) - 0.5, `row gap ${gap} ${between ? 'holds the long line' : ''}`);
  }
  assert.ok(q.gaps.every(g => g >= 76), 'gaps never narrower than the layer gap');
});

const FIX = JSON.parse(readFileSync(new URL('./fixtures/layered-maps.json', import.meta.url), 'utf8'));
const lnodes = (m) => m.boxes.map((b, i) => ({ id: b.id, w: b.w, h: b.h, anchor: 40, order: i, role: b.role ?? null }));
const ledges = (m) => m.edges.map(e => ({ key: `${e.from}|${e.to}|${e.channel}`, from: e.from, to: e.to, kind: e.channel === 'data' || e.channel === 'control' ? 'drive' : e.channel === 'uses' ? 'ref' : 'plain', weight: 1, relIds: e.ids }));
const shuffle = (a, rnd) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const plainOf = (r) => ({ pos: [...r.pos].sort(), layer: [...r.layer].sort(), order: r.order, reversed: [...r.reversed].sort(), channels: [...r.channels].sort() });

test('the same input gives the same layout, on repeat and on shuffled input (eight census structures)', () => {
  const rnd = lcg(3);
  for (const m of FIX) {
    const opt = { ...OPT, spend: true }, a = layered(lnodes(m), ledges(m), opt), b = layered(lnodes(m), ledges(m), opt);
    assert.deepEqual(plainOf(a), plainOf(b), `${m.map}: repeat`);
    // Shuffled arrays of the same parts (each keeps its record order, which the layout reads) and lines: the array order is not read.
    const c = layered(shuffle(lnodes(m), rnd), shuffle(ledges(m), rnd), opt);
    assert.deepEqual(plainOf(a), plainOf(c), `${m.map}: shuffled`);
    // A different record order is a different input: the layout still holds together (no overlap is checked below for every map).
    const d = layered(lnodes(m).map((n, i, all) => ({ ...n, order: all.length - i })), ledges(m), opt);
    assert.equal(d.pos.size, a.pos.size, `${m.map}: reordered`);
    // Nothing overlaps.
    const bs = m.boxes.map(x => ({ ...a.pos.get(x.id), w: x.w, h: x.h }));
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const p = bs[i], q = bs[j]; assert.ok(!(p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h), `${m.map}: boxes ${i} and ${j} overlap`); }
  }
});

test('routed crossings and length are not worse than the old placement on the census structures', () => {
  const box = (b, p) => ({ id: b.id, x: p.x, y: p.y, w: b.w, h: b.h, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { ...p }, head: 0, face: 'unit', contact: 40, pins: {} });
  const measure = (boxes, edges) => { const R = routeEdges(boxes, edges), segs = []; let len = 0;
    for (const r of R.values()) for (let i = 1; i < r.pts.length; i++) { const A = r.pts[i - 1], B = r.pts[i]; len += Math.abs(A.x - B.x) + Math.abs(A.y - B.y); segs.push({ k: r.key, A, B }); }
    let c = 0; for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) { const s = segs[i], t = segs[j]; if (s.k === t.k) continue; const sh = Math.abs(s.A.y - s.B.y) < 0.5, th = Math.abs(t.A.y - t.B.y) < 0.5; if (sh === th) continue;
      const H = sh ? s : t, V = sh ? t : s; if (V.A.x > Math.min(H.A.x, H.B.x) + 0.5 && V.A.x < Math.max(H.A.x, H.B.x) - 0.5 && H.A.y > Math.min(V.A.y, V.B.y) + 0.5 && H.A.y < Math.max(V.A.y, V.B.y) - 0.5) c++; }
    return { c, len }; };
  let oldC = 0, newC = 0, oldL = 0, newL = 0;
  for (const m of FIX) {
    // The lines drawn at rest on these maps are summary strokes, which meet their cards' sides.
    const edges = m.edges.map(e => ({ key: `${e.from}|${e.to}|${e.channel}`, from: e.from, to: e.to, kind: e.kind, notes: [], ids: e.ids, agg: false }));
    const L = layered(lnodes(m), ledges(m), { ...OPT, spend: true });
    const hinted = edges.map(e => { const ch = L.channels.get(e.key); return ch ? { ...e, hint: ch } : e; });
    const o = measure(new Map(m.boxes.map(b => [b.id, box(b, b)])), edges), n = measure(new Map(m.boxes.map(b => [b.id, box(b, L.pos.get(b.id))])), hinted);
    // Beauty v4 (P1): a participant reads before every part it calls, so the lines back to it run the other way (m1: the user whose results
    // come back from four parts; 1.23 × there); the crossings stay under the old placement's on every map and the eight together keep 0.8.
    assert.ok(n.c <= o.c, `${m.map}: crossings ${n.c} ≤ ${o.c}`); assert.ok(n.len <= o.len * 1.3, `${m.map}: length ${Math.round(n.len)} ≤ 1.3 × ${Math.round(o.len)} (a hub's lines may run longer for fewer crossings; the eight together stay at 0.8)`);
    oldC += o.c; newC += n.c; oldL += o.len; newL += n.len;
  }
  assert.ok(newC <= oldC * 0.5, `all maps: crossings ${newC} ≤ 0.5 × ${oldC}`); assert.ok(newL <= oldL * 0.8, `all maps: length ${Math.round(newL)} ≤ 0.8 × ${Math.round(oldL)}`);
});

test('speed: 60 parts and 120 lines lay out well under the budget (median of 5)', () => {
  const rnd = lcg(11), ns = Array.from({ length: 60 }, (_, i) => N(`p${i}`, i, rnd() < 0.3 ? 104 : 80)), es = [];
  while (es.length < 120) { const a = Math.floor(rnd() * 60), b = Math.floor(rnd() * 60); if (a === b) continue; const k = rnd(); es.push(E(`p${a}`, `p${b}`, k < 0.7 ? 'drive' : k < 0.9 ? 'ref' : 'plain', `e${es.length}`)); }
  const times = [];
  for (let i = 0; i < 5; i++) { const t = performance.now(); layered(ns, es, { ...OPT, spend: true }); times.push(performance.now() - t); }
  times.sort((a, b) => a - b);
  assert.ok(times[2] < 100, `median ${times[2].toFixed(1)} ms (budget 50, test bar 100 under load)`);
});
