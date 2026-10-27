// POLISH67 map overview: boundary counts, summary lines at rest, lines kept off boxes they do not belong to, uniform default
// folding, verbs that do not pile up. Layout only; the browser checks are in the cycle's screenshots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildExample } from '../dist/public/shared/studio-examples.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope, edgePath, boundaryCounts, budgetFold, summaryEdges, resolveLabels, linkChipW, FRAME_GUTTER } from '../dist/public/client/map-layout.js';

const data = JSON.parse(await readFile(new URL('../../../docs/cycles/2026-10-26-visual-experience-58/OSS_CASES.json', import.meta.url), 'utf8'));
const viewOf = id => studioView(buildExample(data.cases.find(c => c.spec.id === id).spec));
const converter = async () => studioView((await import('../dist/public/client/plan-source.js')).buildConverterProject());
const open0 = (_id, depth) => depth === 0;
const SHOW_BUDGET = 28; // app.ts

/** Points along an edge path made of M, C, L and Q commands (what edgePath writes). */
function sample(d) {
  const t = d.match(/[MCLQ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g), pts = []; let i = 0, cur = null;
  const num = () => Number(t[i++]);
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M') { cur = { x: num(), y: num() }; pts.push(cur); continue; }
    const P = c === 'C' ? [cur, { x: num(), y: num() }, { x: num(), y: num() }, { x: num(), y: num() }] : c === 'Q' ? [cur, { x: num(), y: num() }, { x: num(), y: num() }] : [cur, { x: num(), y: num() }];
    for (let s = 1; s <= 20; s++) {
      const u = s / 20, v = 1 - u;
      pts.push(P.length === 4 ? { x: v ** 3 * P[0].x + 3 * v * v * u * P[1].x + 3 * v * u * u * P[2].x + u ** 3 * P[3].x, y: v ** 3 * P[0].y + 3 * v * v * u * P[1].y + 3 * v * u * u * P[2].y + u ** 3 * P[3].y }
        : P.length === 3 ? { x: v * v * P[0].x + 2 * v * u * P[1].x + u * u * P[2].x, y: v * v * P[0].y + 2 * v * u * P[1].y + u * u * P[2].y }
        : { x: v * P[0].x + u * P[1].x, y: v * P[0].y + u * P[1].y });
    }
    cur = P.at(-1);
  }
  return pts;
}
const under = (q, o, m = 2) => q.x > o.x + m && q.x < o.x + o.w - m && q.y > o.y + m && q.y < o.y + o.h - m;
const box = (id, x, y, w, h, extra = {}) => ({ id, x, y, w, h, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { x, y }, head: 0, face: 'unit', ...extra });
/** Is box o the box of id, or one of its frames (o holds it at any depth)? */
const holds = (l, o, id) => { for (let c = id, g = 0; c && g < 64; c = l.boxes.get(c)?.container, g++) if (c === o.id) return true; return false; };

test('POLISH67-E1 a line goes round a frame-sized obstacle on the rounded orthogonal route, never under it', () => {
  const a = box('a', 0, 100, 200, 40), b = box('b', 700, 100, 200, 40);
  const f = box('f', 300, 0, 300, 260, { kind: 'frame', head: 52, face: undefined });
  const inner = box('f1', 314, 60, 200, 38, { container: 'f', face: 'row', depth: 1 });
  const r = edgePath(a, b, [a, b, f, inner]);
  assert.ok(r.detour && r.clear, 'a detour that crosses nothing');
  assert.match(r.d, /Q/, 'rounded corners');
  for (const q of sample(r.d)) assert.ok(!under(q, f), `(${q.x}, ${q.y}) under the frame`);
});

test('POLISH67-E2 a line reaching a part inside a group does not cross that group\'s head, and a hairline between rows is no lane', () => {
  // A group of two columns: r1 on the left; c1 and c2 stacked on the right, 8px apart. r1's line goes to a part beyond them.
  const g = box('g', 300, 0, 500, 180, { kind: 'frame', head: 60, face: undefined });
  const row = (id, x, y) => box(id, x, y, 200, 31, { container: 'g', face: 'row', depth: 1 });
  const r1 = row('r1', 314, 60), c1 = row('c1', 560, 60), c2 = row('c2', 560, 99), far = box('far', 900, 92, 200, 31);
  const all = [g, r1, c1, c2, far], pts = sample(edgePath(r1, far, all).d).slice(1, -1);
  const head = { x: g.x, y: g.y, w: g.w, h: g.head };
  for (const q of pts) {
    assert.ok(!under(q, head), `(${q.x}, ${q.y}) over the group's head`);
    // The 8px between c1 and c2 leaves no lane that keeps clear of both.
    for (const o of [c1, c2]) assert.ok(!under(q, { x: o.x - 2.5, y: o.y - 2.5, w: o.w + 5, h: o.h + 5 }, 0), `(${q.x}, ${q.y}) brushes ${o.id}`);
  }
});

test('POLISH67-E3 Collector at 1280: no line passes under a box it is not attached to; "정적 실행본 대응" is crossed only by its own lines', () => {
  const v = viewOf('oss-collector'), l = layoutScope(v, null, open0, {}, undefined, undefined, 1280 / 668);
  const target = [...l.boxes.values()].find(b => v.parts.find(p => p.id === b.id)?.name === '정적 실행본 대응');
  assert.equal(target?.kind, 'frame');
  const sums = summaryEdges(l.boxes, l.edges);
  for (const e of [...l.edges, ...sums]) {
    const a = l.boxes.get(e.from), b = l.boxes.get(e.to), pts = sample(edgePath(a, b, l.boxes.values()).d);
    for (const o of l.boxes.values()) {
      if (holds(l, o, e.from) || holds(l, o, e.to)) continue; // the boxes of its ends and the groups around them
      if ((a.kind === 'frame' && holds(l, a, o.id)) || (b.kind === 'frame' && holds(l, b, o.id))) continue; // inside a group end
      const q = pts.find(p => under(p, o)); assert.ok(!q, `${e.key} under ${o.id} at (${q?.x}, ${q?.y})`);
    }
  }
  // At rest the overview reads two summary lines with their counts, every relation held once.
  assert.deepEqual(sums.map(s => s.ids.length).sort((x, y) => x - y), [12, 20]);
  assert.deepEqual(sums.flatMap(s => s.ids).sort(), v.relations.map(r => r.id).sort());
  assert.ok(sums.every(s => s.agg && l.boxes.get(s.from).depth === 0 && l.boxes.get(s.to).depth === 0));
});

test('POLISH67-C1 boundary counts come from the stored relations: one end inside (any depth), the other outside', async () => {
  const v = await converter(), c = boundaryCounts(v), name = id => v.parts.find(p => p.id === id).name;
  const byName = Object.fromEntries(v.roots.map(id => [name(id), c.get(id)?.all ?? 0]));
  for (const id of v.roots) {
    const inside = new Set([id]); for (let grew = true; grew;) { grew = false; for (const p of v.parts) if (p.parentId && inside.has(p.parentId) && !inside.has(p.id)) { inside.add(p.id); grew = true; } }
    const want = v.relations.filter(r => inside.has(r.from) !== inside.has(r.to));
    assert.equal(byName[name(id)], want.length, name(id));
    const k = c.get(id) ?? { in: 0, out: 0, plain: 0 };
    assert.equal(k.in + k.out + k.plain, want.length);
    assert.equal(k.out, want.filter(r => r.kind !== 'related' && inside.has(r.from)).length);
  }
  assert.equal(linkChipW(0), 0);
  // A group's head keeps room for its count beside the name.
  const l = layoutScope(v, null, open0, {}), f = l.boxes.get(v.roots.find(id => (c.get(id)?.all ?? 0) > 0));
  assert.equal(f.kind, 'frame');
});

test('POLISH67-F1 over the budget every group folds alike (VS Code: all 9 of 136 parts); the converter stays open', async () => {
  const fold = v => budgetFold(v.roots.map(id => ({ id, size: v.parts.find(p => p.id === id).childIds.length })), () => false, SHOW_BUDGET);
  const vs = viewOf('oss-vscode');
  assert.equal(vs.parts.length, 136); assert.equal(vs.roots.length, 9);
  assert.equal(fold(vs).size, 9, 'all nine groups start folded, the smallest too');
  const conv = await converter();
  assert.equal(conv.parts.length, 8); assert.equal(fold(conv).size, 0);
  // The person's own choice wins: a group they opened is not folded again.
  const mine = vs.roots[3];
  assert.ok(!budgetFold(vs.roots.map(id => ({ id, size: vs.parts.find(p => p.id === id).childIds.length })), id => id === mine, SHOW_BUDGET).has(mine));
});

test('POLISH67-G1 open groups beside or under a sibling keep a lane between them', () => {
  const v = viewOf('oss-collector'), l = layoutScope(v, null, () => true, {});
  const frames = [...l.boxes.values()].filter(b => b.kind === 'frame' && b.depth === 0).sort((a, b) => a.x - b.x);
  for (let i = 1; i < frames.length; i++) {
    const p = frames[i - 1], q = frames[i], apart = Math.max(q.x - (p.x + p.w), q.y - (p.y + p.h), p.x - (q.x + q.w));
    assert.ok(apart >= FRAME_GUTTER, `${p.id} ${q.id} ${apart}`);
  }
});

test('POLISH67-L1 two verbs that would touch: the one nearer its end keeps its place, the other moves or is left off', () => {
  const s = (key, x, y, dist) => ({ key, x, y, w: 50, h: 18, dist });
  // b's first place touches a's (within 6px): b takes its second place.
  let r = resolveLabels([s('a', 0, 0, 10), s('b', 52, 0, 12), s('b', 0, 40, 30)]);
  assert.deepEqual(r.kept.map(k => `${k.key}@${k.y}`), ['a@0', 'b@40']); assert.deepEqual(r.dropped, []);
  // No free place left for b: dropped.
  r = resolveLabels([s('a', 0, 0, 10), s('b', 30, 10, 12)]);
  assert.deepEqual(r.kept.map(k => k.key), ['a']); assert.deepEqual(r.dropped, ['b']);
  // The nearer one wins whatever the order given.
  r = resolveLabels([s('far', 0, 0, 40), s('near', 20, 4, 8)]);
  assert.deepEqual(r.kept.map(k => k.key), ['near']); assert.deepEqual(r.dropped, ['far']);
});
