// Beauty v5 (hub lanes): calm lines round busy cards without ever joining two relations on one stroke.
// HL-1 one port model for the layout and the router (capacity C = 1 + floor((L - 2*8) / 12), slots PORT_GAP apart round the contact
//      point, closer only past the capacity, never two on one point); the router meets the ports the layout planned its tracks from.
// HL-2 gate order: the ends on a hub's side in the order their lines leave its neighbourhood (a long line's first row, else its
//      partner's port), carried to the router (Channel.ports); every stroke of a hub keeps its reserved track (no reshuffle).
// HL-3 the precedence solver for a gap's tracks (the ordered strip): its rules, its level pairs, shared x only far apart, the same
//      answer whatever the input order. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sideSlots, sideCapacity, laneTracks, PORT_PITCH, PORT_FLOOR, PORT_INSET } from '../dist/public/client/port-slots.js';
import { layered } from '../dist/public/client/layered.js';
import { routeEdges, sideBudget, TRACK_GAP } from '../dist/public/client/map-route.js';

const OPT = { layerGap: 76, rowGap: 22, laneMargin: 14, laneTrack: 10, aspect: 1.6 };
const N = (id, order, h = 80) => ({ id, w: 224, h, anchor: 40, order });
const E = (from, to, key = `${from}|${to}|data`) => ({ key, from, to, kind: 'drive', weight: 1, relIds: [`${from}${to}`] });
const boxOf = (n, p) => ({ id: n.id, x: p.x, y: p.y, w: n.w, h: n.h, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { ...p }, head: 0, face: 'unit', contact: n.anchor, pins: {} });
const edgeOf = (e, L) => ({ key: e.key, from: e.from, to: e.to, kind: 'flow', notes: [], ids: e.relIds, agg: false, hint: L.channels.get(e.key) });
const lcg = seed => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = (a, rnd) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

test('HL-1 the shared port model: capacity from the side, PORT_GAP apart round the contact point, closer only past it', () => {
  assert.equal(sideCapacity(80), 6, 'an 80-high card: 1 + floor((80 - 16) / 12)');
  assert.equal(sideCapacity(104), 8); assert.equal(sideCapacity(136), 11);
  // The router's budget is the same capacity (the old fixed 5 / 6 is gone: an 80-high side holds 6 ends PORT_GAP apart).
  assert.equal(sideBudget({ h: 80 }), 6); assert.equal(sideBudget({ h: 104 }), 8);
  for (let n = 1; n <= 6; n++) {
    const ys = sideSlots(n, 100, 80, 140);
    assert.equal(ys.length, n);
    for (let i = 1; i < n; i++) assert.equal(ys[i] - ys[i - 1], PORT_PITCH, `${n}: PORT_GAP apart within the capacity`);
    assert.equal((ys[0] + ys[n - 1]) / 2, 140, `${n}: centred on the contact point`);
    for (const y of ys) assert.ok(y >= 100 + PORT_INSET && y <= 180 - PORT_INSET, `${n}: inside the corners`);
  }
  // A contact point near the top: the run stays inside the corners, still PORT_GAP apart.
  const hi = sideSlots(5, 0, 80, 20); assert.ok(hi[0] >= PORT_INSET && hi.every((y, i) => !i || y - hi[i - 1] === PORT_PITCH));
  // Past the capacity: closer, never under PORT_FLOOR while the corners hold them, never two on one point.
  for (const n of [7, 8]) { const ys = sideSlots(n, 0, 80, 40); for (let i = 1; i < n; i++) assert.ok(ys[i] - ys[i - 1] >= PORT_FLOOR - 1e-9 && ys[i] - ys[i - 1] < PORT_PITCH, `${n}: ${ys}`); }
  const many = sideSlots(14, 0, 80, 40); assert.equal(new Set(many).size, 14, 'every end its own point');
});

test('HL-1 the layout plans the ports the router makes: a hub card with eight lines meets them at its planned ports, inside its side', () => {
  // A hub with four parts before it and four after it, the parts at many heights (three of them a column further: long lines).
  const nodes = [N('hub', 0), ...['a', 'b', 'c', 'd'].map((id, i) => N(id, i + 1)), ...['p', 'q', 'r', 's'].map((id, i) => N(id, i + 5)), N('far1', 9), N('far2', 10)];
  const edges = [E('a', 'hub'), E('b', 'hub'), E('c', 'hub'), E('d', 'hub'), E('hub', 'p'), E('hub', 'q'), E('hub', 'r'), E('hub', 's'), E('p', 'far1'), E('hub', 'far1'), E('hub', 'far2'), E('s', 'far2')];
  const L = layered(nodes, edges, { ...OPT, spend: true });
  const boxes = new Map(nodes.map(n => [n.id, boxOf(n, L.pos.get(n.id))])), routed = routeEdges(boxes, edges.map(e => edgeOf(e, L)));
  const hub = boxes.get('hub');
  for (const e of edges) {
    const ch = L.channels.get(e.key), r = routed.get(e.key); assert.ok(ch && r, e.key);
    // Each planned port lies on its side, and the router meets it there (a straightened line meets its partner's height instead).
    for (const [end, id, q] of [['a', e.from, r.pts[0]], ['b', e.to, r.pts.at(-1)]]) {
      const y = ch.ports?.[end], b = boxes.get(id); if (y === undefined) continue;
      assert.ok(y >= b.y + PORT_INSET - 1e-9 && y <= b.y + b.h - PORT_INSET + 1e-9, `${e.key} ${end}: planned on the side`);
      if (r.pts.length > 2) assert.equal(q.y, y, `${e.key} ${end}: routed at the planned port`);
    }
  }
  // The hub's ports on each side: distinct, PORT_FLOOR apart at the least.
  for (const side of [hub.x, hub.x + hub.w]) {
    const ys = [...routed.values()].flatMap(r => [r.pts[0], r.pts.at(-1)]).filter(q => Math.abs(q.x - side) < 0.5 && q.y >= hub.y && q.y <= hub.y + hub.h).map(q => q.y).sort((p, q) => p - q);
    for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= PORT_FLOOR - 1e-9, `hub side ${side}: ${ys}`);
  }
});

test('HL-2 gate order: a hub side\'s ends stand in the order their lines leave it (a long line\'s first row, else its partner\'s port)', () => {
  const rnd = lcg(5);
  for (let t = 0; t < 6; t++) {
    // A hub feeding seven parts in the next columns at shuffled record orders; some through a column between (long lines).
    const ids = ['p', 'q', 'r', 's', 'u', 'v', 'w'], order = shuffle(ids, rnd);
    const nodes = [N('hub', 0), N('mid', 1), ...order.map((id, i) => N(id, i + 2))];
    const edges = [E('hub', 'mid'), ...ids.map(id => E('hub', id)), E('mid', 'p'), E('mid', 'u')];
    const L = layered(nodes, edges, { ...OPT, spend: true });
    const out = edges.filter(e => e.from === 'hub').map(e => ({ e, ch: L.channels.get(e.key) })).filter(x => x.ch?.ports?.a !== undefined);
    // The gate: the first row of its reserved route, else (no row) the partner's planned port.
    const gate = x => (x.ch.ys.length ? x.ch.ys[0] : x.ch.ports.b);
    const byPort = [...out].sort((p, q) => p.ch.ports.a - q.ch.ports.a).map(gate);
    assert.deepEqual(byPort, [...byPort].sort((p, q) => p - q), `round ${t}: ports in gate order ${JSON.stringify(byPort)}`);
    // Routed, the hub's lines keep their reserved tracks (the nudging moves others round them, never them).
    const boxes = new Map(nodes.map(n => [n.id, boxOf(n, L.pos.get(n.id))])), routed = routeEdges(boxes, edges.map(e => edgeOf(e, L)));
    for (const { e, ch } of out) {
      const r = routed.get(e.key); if (!r.lane) continue;
      const xs = r.pts.slice(1).filter((q, i) => Math.abs(q.x - r.pts[i].x) < 0.01 && Math.abs(q.y - r.pts[i].y) > 0.5).map(q => q.x);
      for (const x of xs) assert.ok(ch.xs.some(c => Math.abs(c - x) < 0.01), `${e.key}: its vertical runs on its planned tracks ${xs} / ${ch.xs}`);
    }
    // No two lines share a stroke: no collinear overlap between different lines.
    const segs = [...routed.values()].flatMap(r => r.pts.slice(1).map((q, i) => ({ k: r.key, a: r.pts[i], b: q })));
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i], u = segs[j]; if (s.k === u.k) continue;
      const sv = Math.abs(s.a.x - s.b.x) < 0.01, uv = Math.abs(u.a.x - u.b.x) < 0.01, sh = Math.abs(s.a.y - s.b.y) < 0.01, uh = Math.abs(u.a.y - u.b.y) < 0.01;
      const along = (p, q, P, Q) => Math.min(Math.max(p, q), Math.max(P, Q)) - Math.max(Math.min(p, q), Math.min(P, Q));
      if (sv && uv && Math.abs(s.a.x - u.a.x) < 0.5) assert.ok(along(s.a.y, s.b.y, u.a.y, u.b.y) <= 0.5, `${s.k} / ${u.k} share a vertical stroke`);
      if (sh && uh && Math.abs(s.a.y - u.a.y) < 0.5) assert.ok(along(s.a.x, s.b.x, u.a.x, u.b.x) <= 0.5, `${s.k} / ${u.k} share a level stroke`);
    }
  }
});

test('HL-3 the precedence solver: the ordered strip\'s rules, level pairs apart, one x only far apart', () => {
  const x = (T, k) => T.at.get(k);
  // Two runs going up (i above j at the left, j ending above where i starts): i turns first, so neither crosses the other.
  const up = laneTracks([{ key: 'i', a: 100, b: 0 }, { key: 'j', a: 110, b: 10 }]);
  assert.ok(x(up, 'i') < x(up, 'j'));
  // Two going down: j turns first.
  const down = laneTracks([{ key: 'i', a: 100, b: 200 }, { key: 'j', a: 110, b: 210 }]);
  assert.ok(x(down, 'j') < x(down, 'i'));
  // One arriving at a height another leaves at (within a track): the one leaving turns first, so their level runs never lie on one line.
  const level = laneTracks([{ key: 'arrive', a: 140, b: 274 }, { key: 'leave', a: 274, b: -3 }]);
  assert.ok(x(level, 'leave') < x(level, 'arrive'));
  // Runs far apart along the gap may share an x; runs that come near never do.
  const far = laneTracks([{ key: 'top', a: 0, b: 40 }, { key: 'low', a: 300, b: 340 }]);
  assert.equal(far.n, 1);
  const near = laneTracks([{ key: 'm', a: 0, b: 40 }, { key: 'n', a: 50, b: 90 }]);
  assert.equal(near.n, 2, 'extents 10 apart: tracks apart');
  // A fan of six from one side's ports (PORT_GAP apart) to partners far above and below: every pair that meets apart, no crossing.
  const fan = [0, 1, 2, 3, 4, 5].map(i => ({ key: `f${i}`, a: 100 + i * 12, b: -200 + i * 100 + (i > 2 ? 200 : 0) }));
  const T = laneTracks(fan), crossings = (runs, T) => { let c = 0; for (const p of runs) for (const q of runs) { if (p === q) continue; const xp = T.at.get(p.key), xq = T.at.get(q.key), inQ = y => y > Math.min(q.a, q.b) + 0.5 && y < Math.max(q.a, q.b) - 0.5; if (xq < xp && inQ(p.a)) c++; if (xq > xp && inQ(p.b)) c++; } return c; };
  assert.equal(crossings(fan, T), 0, 'a fan in gate order crosses nothing');
  for (const p of fan) for (const q of fan) if (p !== q && Math.min(Math.max(p.a, p.b), Math.max(q.a, q.b)) > Math.max(Math.min(p.a, p.b), Math.min(q.a, q.b)) - 16) assert.notEqual(x(T, p.key), x(T, q.key));
  assert.equal(T.at.get('#'), T.n);
});

test('HL-3 the precedence solver gives the same tracks whatever the input order, and never more crossings than the rules allow', () => {
  const rnd = lcg(17);
  for (let t = 0; t < 200; t++) {
    const k = 2 + Math.floor(rnd() * 8), used = new Set(), runs = [];
    for (let i = 0; i < k; i++) { let a; do a = Math.round(rnd() * 30) * 12; while (used.has(a)); used.add(a); runs.push({ key: `r${i}`, a, b: Math.round(rnd() * 30) * 12 + 3 }); }
    const T = laneTracks(runs, TRACK_GAP);
    for (let s = 0; s < 3; s++) assert.deepEqual([...laneTracks(shuffle(runs, rnd), TRACK_GAP).at].sort(), [...T.at].sort(), `case ${t}: shuffled input`);
    // Runs whose extents come within 16 of each other never share an x; the count is the widest track plus one.
    for (const p of runs) for (const q of runs) if (p !== q && Math.min(Math.max(p.a, p.b), Math.max(q.a, q.b)) > Math.max(Math.min(p.a, p.b), Math.min(q.a, q.b)) - 16) assert.notEqual(T.at.get(p.key), T.at.get(q.key), `case ${t}`);
    assert.equal(T.n, Math.max(...runs.map(r => T.at.get(r.key))) + 1);
  }
});
