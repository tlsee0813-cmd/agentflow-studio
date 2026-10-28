// AF-EXPERIENCE75: a nested group's name and the lines that meet it, on the real micro-javascript backup (a d971d0c reading of a
// public OSS excerpt, as imported; not an execution of that project). The parent structure is the stored one: nothing is
// flattened or moved. Geometry is the layout's own estimate; the browser scene was checked by eye.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBackup } from '../dist/public/shared/validation.js';
import * as D from '../dist/public/shared/domain.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope, edgePath, nodeWidth, linkChipW, textWidth, HEAD, PAD } from '../dist/public/client/map-layout.js';

const { project } = parseBackup(readFileSync(new URL('./fixtures/context75/micro-javascript-backup.json', import.meta.url), 'utf8'));
const view = studioView(project), id = name => project.space.areas.find(a => a.name === name).id;
const ROOT = id('micro-javascript'), API = id('JSContext.eval 평가 API'), PIPE = id('평가 실행 파이프라인'), LIMITS = id('메모리·시간 제한');
const corners = d => [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => ({ x: +m[1], y: +m[2] }));

test('E75-1 inside the engine, the nested pipeline group keeps its name on one head line; the stored nesting stays', () => {
  const L = layoutScope(view, ROOT, () => true, {});
  const api = L.boxes.get(API), pipe = L.boxes.get(PIPE), limits = L.boxes.get(LIMITS);
  assert.equal(api.kind, 'frame'); assert.equal(pipe.kind, 'frame'); assert.equal(pipe.container, API); assert.equal(limits.container, PIPE);
  assert.equal(pipe.head, HEAD, 'one head line: the group widened for its name instead of leaving a letter alone');
  assert.ok(pipe.x + pipe.w <= api.x + api.w - PAD + 0.5, 'the widened group still sits inside its parent');
});

test('E75-2 a line between a group and a part inside it runs down the group margin, never across a head or the parts between', () => {
  const L = layoutScope(view, ROOT, () => true, {}), all = [...L.boxes.values()];
  for (const [from, to] of [[API, PIPE], [PIPE, LIMITS]]) {
    const outer = L.boxes.get(from), inner = L.boxes.get(to), r = edgePath(outer, inner, all), pts = corners(r.d);
    assert.equal(r.clear, true);
    assert.deepEqual(pts[0], { x: outer.x + PAD / 2, y: outer.y + outer.head }, 'leaves under the head, in the margin');
    assert.equal(pts.at(-1).x, inner.x, 'meets the inner end on its side');
    assert.ok(pts.every(q => q.x <= inner.x + 0.5 && q.y >= outer.y + outer.head - 0.5), `stays left of the inner end and under the head: ${r.d}`);
    const back = corners(edgePath(inner, outer, all).d);
    assert.deepEqual(back[0], pts.at(-1), 'the reverse direction is the same route reversed');
  }
});

test('E75-3 a folded part whose name takes two lines keeps its longest word whole', () => {
  const m = (t, kind) => textWidth(t) * (kind === 'node' ? 13.5 / 13 : 1), chip = linkChipW(2);
  const w = nodeWidth('JSContext.eval 평가 API', true, m, chip), room = w - (5 + 22 + 4 + 4 + 40 + 8 + 2 + chip);
  assert.ok(room >= m('JSContext.eval', 'node'), `room ${room} for 'JSContext.eval'`);
  assert.equal(nodeWidth('Hardware', false, m), 200, 'a short name keeps the usual width');
});

// The review's counter-example: a group whose inner parts sit in two columns (A→B, A→C, A→D, so A is centred on C's row), and the
// group's own relation to C; then the same with a descendant two levels inside C (C → C1 → C2) as the group's other end. A route
// down the group's left margin would run through A in both. Kinds are flow.
function nested(deep) {
  let p = D.addArea(D.createProject(), 'outer');
  const pid = n => p.space.areas.find(a => a.name === n).id, names = deep ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];
  for (const n of names) p = D.addChildArea(p, pid('outer'), n);
  if (deep) { p = D.addChildArea(p, pid('C'), 'C1'); p = D.addChildArea(p, pid('C1'), 'C2'); }
  for (const n of names.slice(1)) p = D.addRelation(p, pid('A'), pid(n), 'flow');
  p = D.addRelation(p, pid('outer'), pid(deep ? 'C2' : 'C'), 'flow');
  return { view: studioView(p), pid, target: deep ? 'C2' : 'C', holders: deep ? ['C', 'C1'] : [] };
}
/** The path's corners (a rounded corner's control point is the corner itself) as straight runs. */
const runs = d => { const q = corners(d); return q.slice(1).map((b, i) => [q[i], b]); };
const crosses = ([p, q], r) => Math.max(p.x, q.x) > r.x + 0.5 && Math.min(p.x, q.x) < r.x + r.w - 0.5 && Math.max(p.y, q.y) > r.y + 0.5 && Math.min(p.y, q.y) < r.y + r.h - 0.5;

test('E75-4 a group\'s line to a part in a later column or deep inside a sibling goes round the parts between, never over a head', () => {
  for (const deep of [false, true]) {
    const { view, pid, target, holders } = nested(deep), L = layoutScope(view, null, () => true, {}), all = [...L.boxes.values()];
    const outer = L.boxes.get(pid('outer')), inner = L.boxes.get(pid(target)), A = L.boxes.get(pid('A')), hold = holders.map(n => L.boxes.get(pid(n)));
    const iy = inner.y + inner.h / 2, lane = [{ x: outer.x + PAD / 2, y: outer.y + outer.head }, { x: outer.x + PAD / 2, y: iy }, { x: inner.x, y: iy }];
    assert.ok(runs(`M${lane.map(q => `${q.x},${q.y}`).join(' L')}`).some(s => crosses(s, A)), `${target}: the margin route would cross A (the counter-example holds)`);
    const r = edgePath(outer, inner, all), seg = runs(r.d), pts = corners(r.d), end = pts.at(-1);
    assert.equal(r.clear, true, `${target}: a free way exists`);
    assert.ok(Math.abs(pts[0].y - (outer.y + outer.head)) < 0.5 && pts[0].x > outer.x && pts[0].x < outer.x + outer.w, `${target}: leaves from under the group's head`);
    assert.ok([end.x - inner.x, end.x - inner.x - inner.w, end.y - inner.y, end.y - inner.y - inner.h].some(v => Math.abs(v) < 0.5), `${target}: ends on its own end's edge: ${r.d}`);
    for (const b of all.filter(b => b !== outer && b !== inner && !hold.includes(b)))
      assert.ok(!seg.some(s => crosses(s, b)), `${target}: crosses ${view.parts.find(x => x.id === b.id)?.name}: ${r.d}`);
    for (const f of [outer, ...hold]) assert.ok(!seg.some(s => crosses(s, { x: f.x, y: f.y, w: f.w, h: f.head })), `${target}: crosses a head: ${r.d}`);
    const back = corners(edgePath(inner, outer, all).d);
    assert.deepEqual([back[0], back.at(-1)], [end, pts[0]], `${target}: the other direction is the same route, from the inner end`);
  }
});
