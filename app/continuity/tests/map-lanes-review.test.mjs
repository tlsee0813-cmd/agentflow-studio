// Beauty v5 lanes review: the planned ports never crowd a side, and the port model's fallback keeps pins in the spread.
// LR-1 a planned port stands only PORT_MIN clear of the side's pins and of the planned ports kept before it; a side whose plan would
//      leave its ends under PORT_FLOOR apart drops the plan and spreads every end by the port model (the planned height orders them).
// LR-2 a recorded selection (a hub picked on a busy map; geometry only, names left out): its ends were 6 apart where a kept plan met
//      the selection's other strokes; now every side keeps PORT_FLOOR, with no more crossings.
// LR-3 sideSlots with no room even 6 apart round its pins spreads the free and the pinned ends together, never a free end on a pin.
// LR-7 a face-heavy map (generated, geometry only): the pairs tried the other way round search again only their own lines; the whole
//      routing stays within 1.3 times one routing measured in the same run, with fewer crossings and the same routes either input order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sideSlots, PORT_PITCH, PORT_FLOOR } from '../dist/public/client/port-slots.js';
import { routeEdges, routeOnce, PORT_MIN } from '../dist/public/client/map-route.js';

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
  // Both ends planned (each partner's own port at its middle), so every end stays on its side as the layout planned it.
  const A = [-260, 40, 340];
  // Planned 12 apart: each stands where it was planned.
  const kept = [edge('P0', 'H', 20, A[0]), edge('P1', 'H', 32, A[1]), edge('P2', 'H', 44, A[2])];
  const k = endsOf(boxes, kept, routeEdges(boxes, kept)).get('H|l');
  assert.deepEqual(k, [20, 32, 44], 'planned ports PORT_MIN apart stand as planned');
  // Planned 6 apart (a selection's strokes against a plan made for the summary): the middle one crowds both; one port 6 from a kept one
  // would leave the side under PORT_FLOOR, so the side drops the plan and spreads all three PORT_PITCH apart, in the planned order.
  // Lanes review 2: the case the old greedy (planned ports kept 4 apart) failed: its ends stood 6 apart where the drawing is not nudged
  // (a drag's quick shape), and the full drawing stepped the middle line round its neighbours.
  const crowd = [edge('P0', 'H', 30, A[0]), edge('P1', 'H', 36, A[1]), edge('P2', 'H', 42, A[2])];
  for (const opts of [{ quick: true }, {}]) {
    const out = routeEdges(boxes, crowd, opts), c = endsOf(boxes, crowd, out).get('H|l');
    assert.equal(c.length, 3);
    assert.ok(minGap(c) >= PORT_MIN, `${opts.quick ? 'quick' : 'full'}: ends ${c} keep PORT_MIN`);
    const at = key => out.get(key).pts.at(-1).y;
    assert.ok(at('P0|H|data') < at('P1|H|data') && at('P1|H|data') < at('P2|H|data'), 'the planned heights still order them');
    // The middle partner is level with the hub: its line is one straight run.
    const mid = out.get('P1|H|data').pts;
    assert.ok(mid.every(p => Math.abs(p.y - mid[0].y) < 0.5), `middle line straight: ${JSON.stringify(mid)}`);
  }
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

// Lanes review 2.
// LR-4 a side crowded by its pins keeps its plan when dropping it leaves more gaps under PORT_FLOOR: a recorded hub (two pins on its
//      right side; geometry only, names left out) whose plan held a level line straight. As many either way, the side spreads: a
//      recorded hub selection whose three pins sit 8 apart crossed 4 more times with its plan kept.
// LR-5 the two lines of a pair running both ways through one card's face take its ports by the partner end's port, then start before
//      end, then key: the drawing never depends on the input's order.
// LR-6 two face lines between one pair of cards whose drawn routes cross are routed again the other way round (kept when the pair
//      crosses less and the set no more).
const tightOf = l => l.filter((y, i) => i > 0 && y - l[i - 1] < PORT_FLOOR - 0.01).length;

test('LR-4 pins crowding a side: the plan stays when dropping it is worse; level ends stay straight; as many either way, it spreads', async () => {
  const cap = JSON.parse(await readFile(new URL('./fixtures/hub-pins-straight.json', import.meta.url), 'utf8'));
  const boxes = new Map(cap.boxes.map(b => [b.id, b])), out = routeEdges(boxes, cap.edges, cap.opts);
  // The level line into the hub's right side, planned at 385 at both ends: one straight run (dropping the plan put it at 389 with a jog).
  assert.deepEqual(out.get('n10|n6|flow').pts.map(p => [p.x, p.y]), [[300, 385], [224, 385]]);
  // Every line whose two side ends are level is straight but the one summary line that already stepped round a card (as before).
  const sideAt = (b, p) => Math.abs(p.x - b.x) < 0.6 || Math.abs(p.x - b.x - b.w) < 0.6;
  const jogged = cap.edges.filter(e => { const r = out.get(e.key).pts, a = r[0], z = r.at(-1);
    return Math.abs(a.y - z.y) < 0.5 && sideAt(boxes.get(e.from), a) && sideAt(boxes.get(e.to), z) && r.some(p => Math.abs(p.y - a.y) >= 0.5); }).map(e => e.key);
  assert.deepEqual(jogged, ['sum:n7|n20|data|filled|sb9t834']);
  // Gaps under PORT_FLOOR: the hub's pinned side keeps the plan's 3 (the spread round the pins alone made 4), no side gains one.
  const ends = endsOf(boxes, cap.edges, out);
  assert.equal(tightOf(ends.get('n6|r')), 3, `${ends.get('n6|r')}`);
  assert.ok([...ends.values()].reduce((s, l) => s + tightOf(l), 0) <= 3);
  // Three pins 8 apart (2 gaps under PORT_FLOOR whatever the free ends do): the plan and the spread leave as many; the spread is taken,
  // and the selection crosses no more than it did when every crowded plan was dropped (30; 34 with the plan kept).
  const even = JSON.parse(await readFile(new URL('./fixtures/hub-pins-even.json', import.meta.url), 'utf8'));
  const eb = new Map(even.boxes.map(b => [b.id, b])), eo = routeEdges(eb, even.edges, even.opts), ee = endsOf(eb, even.edges, eo);
  assert.equal(tightOf(ee.get('n8|r')), 2, `${ee.get('n8|r')}`);
  assert.ok(crossings(eo) <= 30, `crossings ${crossings(eo)}`);
});

test('LR-5 a pair both ways through one face: ports by the partner end, start before end, key; never by the input order', () => {
  const X = box('X', 0, 0);
  for (const Y of [box('Y', 400, 300), box('Y', 60, 300), box('Y', -400, 300)]) {
    const boxes = new Map([[X.id, X], [Y.id, Y]]);
    for (const [fa, fb] of [['bottom', 'side'], ['bottom', 'top']]) {
      const E = [{ key: 'X|Y|control', from: 'X', to: 'Y', kind: 'control', notes: [], ids: ['xy'], agg: false, faces: { a: fa, b: fb } },
        { key: 'Y|X|control', from: 'Y', to: 'X', kind: 'control', notes: [], ids: ['yx'], agg: false, faces: { a: fb, b: fa } }];
      for (const opts of [{}, { quick: true }]) {
        const one = routeEdges(boxes, E, opts), two = routeEdges(new Map([...boxes].reverse()), [...E].reverse(), opts);
        for (const e of E) assert.deepEqual(two.get(e.key).pts, one.get(e.key).pts, `${Y.x} ${fa}/${fb} ${opts.quick ? 'quick' : 'full'} ${e.key}`);
        // Toward a partner off to one side, the full drawing never crosses the pair (a drag's quick shape has no face shape upward, and
        // a partner straight below is met at whichever side the route search finds: neither is ordered here).
        if (!opts.quick && Y.x !== 60) assert.equal(crossings(one), 0, `${Y.x} ${fa}/${fb}: the pair never crosses`);
      }
    }
  }
});

test('LR-6 a recorded pair on one face whose search turns one short of its port: the order whose routes cross less, either input order', async () => {
  // Geometry only, names left out: two lines from one card's top to one partner's side (ports 175 and 187); the one for 175 turns at 196
  // (the search keeps it off the partner's corner), so the order by the partner's ports alone crossed them twice.
  const cap = JSON.parse(await readFile(new URL('./fixtures/face-pair-flip.json', import.meta.url), 'utf8'));
  const boxes = new Map(cap.boxes.map(b => [b.id, b]));
  const one = routeEdges(boxes, cap.edges, cap.opts), two = routeEdges(new Map([...boxes].reverse()), [...cap.edges].reverse(), cap.opts);
  const pair = ['n0|n1|flow~data~0', 'n0|n1|flow~data~1'];
  for (const k of pair) { assert.equal(one.get(k).faces.a, 'top', k); assert.deepEqual(two.get(k).pts, one.get(k).pts, k); }
  // The one for 175 still steps up across the other's level run by the partner (once); the other order crossed them twice.
  assert.ok(crossings(new Map(pair.map(k => [k, one.get(k)]))) <= 1, 'the pair crosses at most once');
  // No more crossings in the whole set than the order with the pair apart (18).
  assert.ok(crossings(one) <= 18, `crossings ${crossings(one)}`);
});

test('LR-7 a face-heavy map: a pair tried the other way round searches again only its own lines, within 1.3 times one routing', async () => {
  // Geometry only (a generated map: control lines through tops and bottoms, pairs both ways and side by side). Each crossing pair tried
  // the other way round was a whole routing again (2 to 3 times the time on such maps); now the searches are kept through the call.
  const cap = JSON.parse(await readFile(new URL('./fixtures/face-heavy.json', import.meta.url), 'utf8'));
  const boxes = new Map(cap.boxes.map(b => [b.id, b]));
  const once = routeOnce(boxes, cap.edges), out = routeEdges(boxes, cap.edges, cap.opts);
  // The pair the other way round is kept: fewer crossings than one routing (34, now 33), and the same routes in either input order.
  assert.ok(crossings(out) < crossings(once), `crossings ${crossings(out)}, routed once ${crossings(once)}`);
  const two = routeEdges(new Map([...boxes].reverse()), [...cap.edges].reverse(), cap.opts);
  for (const [k, r] of out) assert.deepEqual(two.get(k).pts, r.pts, k);
  // The time against one routing (the cost before pairs were tried), measured together: medians of interleaved runs after a warm-up.
  for (let i = 0; i < 3; i++) { routeOnce(boxes, cap.edges); routeEdges(boxes, cap.edges, cap.opts); }
  const one = [], all = [], med = l => [...l].sort((p, q) => p - q)[l.length >> 1];
  for (let i = 0; i < 9; i++) {
    let t = performance.now(); routeOnce(boxes, cap.edges); one.push(performance.now() - t);
    t = performance.now(); routeEdges(boxes, cap.edges, cap.opts); all.push(performance.now() - t);
  }
  assert.ok(med(all) <= 1.3 * med(one), `${med(all).toFixed(1)} ms, routed once ${med(one).toFixed(1)} ms`);
});
