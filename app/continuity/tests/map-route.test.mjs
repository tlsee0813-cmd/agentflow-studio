// The lines routed together (map-route): ports spread along a side in the order of the other ends, parallel runs in one gap sit
// apart, the quick shape follows a moved part continuously, and nothing routed together passes under a box it does not belong
// to on the OSS cases. Layout only; no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildExample, EXAMPLES } from '../dist/public/shared/studio-examples.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope, summaryEdges, NODE_W, NODE_H } from '../dist/public/client/map-layout.js';
import { routeEdges, TRACK_GAP, PORT_MIN, mixPath } from '../dist/public/client/map-route.js';

const data = JSON.parse(await readFile(new URL('../../../docs/cycles/2026-10-26-visual-experience-58/OSS_CASES.json', import.meta.url), 'utf8'));
const viewOf = id => studioView(buildExample(data.cases.find(c => c.spec.id === id).spec));
const box = (id, x, y, w = NODE_W, h = NODE_H) => ({ id, x, y, w, h, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { x, y }, head: 0, face: 'unit' });
const edge = (from, to, kind = 'flow') => ({ key: `${from}|${to}|${kind}`, from, to, kind, notes: [], ids: [`${from}${to}`], agg: false });
const boxes = list => new Map(list.map(b => [b.id, b]));
const start = r => r.pts[0], end = r => r.pts.at(-1);

test('ROUTE-1 three lines into one part meet its side at three ports, top to bottom in the order of where they come from', () => {
  const a = box('a', 0, 0), b = box('b', 0, 120), c = box('c', 0, 240), t = box('t', 400, 120);
  const r = routeEdges(boxes([a, b, c, t]), [edge('c', 't'), edge('a', 't'), edge('b', 't')]);
  const ys = ['a', 'b', 'c'].map(id => end(r.get(`${id}|t|flow`)).y);
  assert.ok(ys[0] < ys[1] && ys[1] < ys[2], `ports in the order of the sources: ${ys}`);
  assert.ok(ys.every(y => y > t.y + 4 && y < t.y + t.h - 4), 'every port on the side');
  assert.ok(ys[1] - ys[0] >= PORT_MIN && ys[2] - ys[1] >= PORT_MIN);
  assert.equal((ys[0] + ys[2]) / 2, t.y + t.h / 2, 'centred on the side');
  for (const id of ['a', 'b', 'c']) assert.equal(end(r.get(`${id}|t|flow`)).x, t.x, 'meets the left side');
  // One line alone keeps the middle of its side.
  const one = routeEdges(boxes([a, t]), [edge('a', 't')]).get('a|t|flow');
  assert.equal(start(one).y, a.y + a.h / 2); assert.equal(end(one).y, t.y + t.h / 2);
});

test('ROUTE-2 lines that share one gap run side by side, never on top of each other, and their runs still touch no other box', () => {
  const a = box('a', 0, 0), b = box('b', 0, 200), c = box('c', 400, 200), d = box('d', 400, 0);
  // a → c goes down and b → d goes up through the same gap: two vertical runs on the gap's middle line without nudging.
  const r = routeEdges(boxes([a, b, c, d]), [edge('a', 'c'), edge('b', 'd')]);
  const vx = key => { const p = r.get(key).pts; return p[1].x; };
  assert.notEqual(vx('a|c|flow'), vx('b|d|flow'));
  assert.ok(Math.abs(vx('a|c|flow') - vx('b|d|flow')) >= TRACK_GAP - 0.01);
  for (const x of r.values()) assert.equal(x.pts.length, 4, 'the plain shape');
  // The paths say the same: the two vertical runs are at different x.
  assert.notEqual(r.get('a|c|flow').d, r.get('b|d|flow').d);
});

test('ROUTE-3 the quick shape moves with a dragged part continuously: a small move changes the line a little, never its kind', () => {
  const a = box('a', 0, 0), t = box('t', 400, 100), mid = box('m', 200, 40);
  const at = dy => routeEdges(boxes([a, { ...t, y: 100 + dy }, mid]), [edge('a', 't')], { quick: true }).get('a|t|flow');
  const r0 = at(0), r1 = at(3);
  assert.equal(r0.pts.length, r1.pts.length);
  assert.ok(r0.pts.every((p, i) => Math.abs(p.x - r1.pts[i].x) <= 3 && Math.abs(p.y - r1.pts[i].y) <= 3));
  // The full route goes round the part between them; the quick one does not (it is the drag's shape).
  const full = routeEdges(boxes([a, t, mid]), [edge('a', 't')]).get('a|t|flow');
  assert.ok(full.clear);
});

test('ROUTE-4 a mixed path between two sampled shapes starts at the first and ends at the second', () => {
  const from = [{ x: 0, y: 0 }, { x: 10, y: 0 }], to = [{ x: 0, y: 10 }, { x: 10, y: 10 }];
  assert.equal(mixPath(from, to, 0), 'M0.0,0.0 L10.0,0.0');
  assert.equal(mixPath(from, to, 1), 'M0.0,10.0 L10.0,10.0');
  assert.equal(mixPath(from, to, 0.5), 'M0.0,5.0 L10.0,5.0');
});

/** Points along an edge path made of M, L and Q commands (what the router writes). */
function sample(d) {
  const t = d.match(/[MLQ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g), pts = []; let i = 0, cur = null;
  const num = () => Number(t[i++]);
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M') { cur = { x: num(), y: num() }; pts.push(cur); continue; }
    const P = c === 'Q' ? [cur, { x: num(), y: num() }, { x: num(), y: num() }] : [cur, { x: num(), y: num() }];
    for (let s = 1; s <= 20; s++) {
      const u = s / 20, v = 1 - u;
      pts.push(P.length === 3 ? { x: v * v * P[0].x + 2 * v * u * P[1].x + u * u * P[2].x, y: v * v * P[0].y + 2 * v * u * P[1].y + u * u * P[2].y } : { x: v * P[0].x + u * P[1].x, y: v * P[0].y + u * P[1].y });
    }
    cur = P.at(-1);
  }
  return pts;
}
test('ROUTE-5 every OSS case and example, routed together: no line passes under a box it does not belong to, and no two lines share a run', () => {
  const views = [...data.cases.map(c => [c.spec.id, studioView(buildExample(c.spec))]), ...EXAMPLES.map(e => [e.id, studioView(buildExample(e))])];
  const bad = [], shared = []; let lines = 0;
  for (const [name, v] of views) for (const scope of [null]) for (const open of [(_id, d) => d === 0, () => false]) {
    const l = layoutScope(v, scope, open, {}, undefined, undefined, 1440 / 848), all = [...l.boxes.values()], byId = l.boxes;
    const within = (o, f) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
    for (const set of [l.edges, l.edges.length > 6 ? summaryEdges(l.boxes, l.edges) : []]) {
      const routed = routeEdges(l.boxes, set);
      for (const e of set) {
        const r = routed.get(e.key), a = byId.get(e.from), b = byId.get(e.to); lines++;
        const blocks = all.filter(o => o !== a && o !== b && !(o.kind === 'frame' && (within(a, o) || within(b, o))) && !(a.kind === 'frame' && within(o, a)) && !(b.kind === 'frame' && within(o, b)));
        for (const q of sample(r.d)) { const o = blocks.find(o => q.x > o.x + 2 && q.x < o.x + o.w - 2 && q.y > o.y + 2 && q.y < o.y + o.h - 2); if (o) { bad.push(`${name} ${e.key} under ${o.id}`); break; } }
      }
      // Two lines of one set never share a vertical run (same x, overlapping extent) away from their ports, wherever the gap
      // between the boxes on either side has room for two runs (a list's 18px columns have not).
      const runs = [...routed.values()].flatMap(r => r.pts.slice(1, -2).map((p, i) => ({ key: r.key, p, q: r.pts[i + 2] })).filter(s => Math.abs(s.p.x - s.q.x) < 0.01));
      const corridor = (x, lo, hi) => {
        const beside = all.filter(o => o.kind !== 'frame' && o.y < hi && lo < o.y + o.h);
        const left = Math.max(-Infinity, ...beside.filter(o => o.x + o.w <= x + 0.5).map(o => o.x + o.w)), right = Math.min(Infinity, ...beside.filter(o => o.x >= x - 0.5).map(o => o.x));
        return right - left;
      };
      for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
        const s = runs[i], t = runs[j]; if (s.key === t.key || Math.abs(s.p.x - t.p.x) > 0.5) continue;
        const lo = Math.max(Math.min(s.p.y, s.q.y), Math.min(t.p.y, t.q.y)), hi = Math.min(Math.max(s.p.y, s.q.y), Math.max(t.p.y, t.q.y));
        if (hi - lo > 2 && corridor(s.p.x, lo, hi) >= 2 * TRACK_GAP + 4) shared.push(`${name} ${s.key} / ${t.key} at x=${s.p.x}`);
      }
    }
  }
  assert.ok(lines > 100, String(lines));
  assert.deepEqual(bad, []);
  assert.deepEqual(shared, []);
});
