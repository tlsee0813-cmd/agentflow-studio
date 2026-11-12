// Beauty v5 lanes review: the planned ports never crowd a side, and the port model's fallback keeps pins in the spread.
// LR-1 a planned port stands only PORT_MIN clear of the side's pins and of the planned ports kept before it; a side whose plan would
//      leave its ends under PORT_FLOOR apart drops the plan and spreads every end by the port model (the planned height orders them).
// LR-2 a recorded selection (a hub picked on a busy map; geometry only, names left out): its ends were 6 apart where a kept plan met
//      the selection's other strokes; now every side keeps PORT_FLOOR, with no more crossings.
// LR-3 sideSlots with no room even 6 apart round its pins spreads the free and the pinned ends together, never a free end on a pin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sideSlots, PORT_PITCH, PORT_FLOOR } from '../dist/public/client/port-slots.js';
import { routeEdges, PORT_MIN } from '../dist/public/client/map-route.js';

const box = (id, x, y, w = 224, h = 80) => ({ id, x, y, w, h, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { x, y }, head: 0, face: 'unit', contact: h / 2, pins: {} });
const edge = (from, to, b, a) => ({ key: `${from}|${to}|data`, from, to, kind: 'flow', notes: [], ids: [`${from}${to}`], agg: false, hint: { xs: [400], ys: [], ports: { ...(a !== undefined ? { a } : {}), b } } });
const sideOf = (b, p) => (Math.abs(p.x - b.x) < 0.6 ? 'l' : Math.abs(p.x - b.x - b.w) < 0.6 ? 'r' : Math.abs(p.y - b.y) < 0.6 ? 't' : Math.abs(p.y - b.y - b.h) < 0.6 ? 'b' : '?');
/** Each card side's ends (heights on a left or right side, x on a top or bottom), sorted. */
const endsOf = (boxes, edges, out) => {
  const m = new Map();
  for (const e of edges) { const r = out.get(e.key); if (!r) continue; for (const [id, q] of [[e.from, r.pts[0]], [e.to, r.pts.at(-1)]]) { const b = boxes.get(id), s = sideOf(b, q); if (s === '?') continue; (m.get(`${id}|${s}`) ?? m.set(`${id}|${s}`, []).get(`${id}|${s}`)).push(s === 'l' || s === 'r' ? q.y : q.x); } }
  for (const l of m.values()) l.sort((p, q) => p - q);
  return m;
};
const minGap = l => Math.min(Infinity, ...l.slice(1).map((y, i) => y - l[i]));
const crossings = out => {
  const segs = []; for (const r of out.values()) for (let i = 1; i < r.pts.length; i++) segs.push({ k: r.key, a: r.pts[i - 1], b: r.pts[i] });
  let n = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const s = segs[i], t = segs[j]; if (s.k === t.k) continue;
    const sh = Math.abs(s.a.y - s.b.y) < 0.5, th = Math.abs(t.a.y - t.b.y) < 0.5, sv = Math.abs(s.a.x - s.b.x) < 0.5, tv = Math.abs(t.a.x - t.b.x) < 0.5;
    if (!((sh && tv) || (sv && th))) continue;
    const H = sh ? s : t, V = sh ? t : s, y = H.a.y, x = V.a.x;
    if (x > Math.min(H.a.x, H.b.x) + 0.5 && x < Math.max(H.a.x, H.b.x) - 0.5 && y > Math.min(V.a.y, V.b.y) + 0.5 && y < Math.max(V.a.y, V.b.y) - 0.5) n++;
  }
  return n;
};

test('LR-1 planned ports kept only PORT_MIN apart; a side they would crowd under PORT_FLOOR spreads all its ends by the model', () => {
  // Three partners far above, level with and far below a hub; their lines arrive on the hub's left side.
  const H = box('H', 600, 0), P = [box('P0', 0, -300), box('P1', 0, 0), box('P2', 0, 300)];
  const boxes = new Map([H, ...P].map(b => [b.id, b]));
  // Planned 12 apart: each stands where it was planned.
  const kept = [edge('P0', 'H', 20), edge('P1', 'H', 32), edge('P2', 'H', 44)];
  const k = endsOf(boxes, kept, routeEdges(boxes, kept)).get('H|l');
  assert.deepEqual(k, [20, 32, 44], 'planned ports PORT_MIN apart stand as planned');
  // Planned 6 apart (a selection's strokes against a plan made for the summary): the middle one crowds both; one port 6 from a kept one
  // would leave the side under PORT_FLOOR, so the side drops the plan and spreads all three PORT_PITCH apart, in the planned order.
  const crowd = [edge('P0', 'H', 30), edge('P1', 'H', 36), edge('P2', 'H', 42)];
  const out = routeEdges(boxes, crowd), c = endsOf(boxes, crowd, out).get('H|l');
  assert.equal(c.length, 3);
  assert.ok(minGap(c) >= PORT_MIN, `ends ${c} keep PORT_MIN`);
  const at = key => out.get(key).pts.at(-1).y;
  assert.ok(at('P0|H|data') < at('P1|H|data') && at('P1|H|data') < at('P2|H|data'), 'the planned heights still order them');
  // Two planned 6 apart and one free: the second planned port is not kept (6 from the first); every end is PORT_FLOOR apart at least.
  const two = [edge('P0', 'H', 30), edge('P1', 'H', 36), { ...edge('P2', 'H', 0), hint: undefined }];
  const t = endsOf(boxes, two, routeEdges(boxes, two)).get('H|l');
  assert.ok(minGap(t) >= PORT_FLOOR, `ends ${t}`);
});

test('LR-2 a recorded hub selection: every side keeps PORT_FLOOR, no more crossings than before (27)', async () => {
  const cap = JSON.parse(await readFile(new URL('./fixtures/hub-selection-crowd.json', import.meta.url), 'utf8'));
  const boxes = new Map(cap.boxes.map(b => [b.id, b])), out = routeEdges(boxes, cap.edges, cap.opts);
  assert.equal(out.size, cap.edges.length);
  for (const [k, l] of endsOf(boxes, cap.edges, out)) assert.ok(minGap(l) >= PORT_FLOOR - 1e-9, `${k}: ${l}`);
  // The planned ports kept 4 apart left two ends 6 apart and 27 crossings on this selection.
  assert.ok(crossings(out) <= 27, `crossings ${crossings(out)}`);
  // Deterministic whatever the order of its input.
  const again = routeEdges(new Map([...boxes].reverse()), [...cap.edges].reverse(), cap.opts);
  for (const [key, r] of out) assert.deepEqual(again.get(key).pts, r.pts, key);
});

test('LR-3 no room round the pins: free and pinned ends spread together, the pins taking the slots nearest them', () => {
  // A 40-high side with two pins (10, 20) and six free ends: not even 6 apart fits round the pins.
  const ys = sideSlots(6, 0, 40, 20, [10, 20], 8);
  assert.equal(ys.length, 6);
  assert.equal(new Set(ys).size, 6, 'never two on one point');
  for (const y of ys) assert.ok(y >= 0 && y <= 40, `${y} on the side`);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] > ys[i - 1], 'in order');
  // The eight ends spread 4.5 apart; the pins took the slots nearest them, so no free end lies nearer a pin than half that (the spread
  // over the side that ignored the pins put one 1 from a pin).
  const near = Math.min(...ys.flatMap(y => [10, 20].map(p => Math.abs(y - p))));
  assert.ok(near >= 2.25, `nearest free end to a pin: ${near}`);
  // With room, nothing changes: PORT_PITCH apart clear of the pins.
  const roomy = sideSlots(3, 0, 112, 56, [56], 8);
  for (const y of roomy) assert.ok(Math.abs(y - 56) >= PORT_PITCH, `${y}`);
});
