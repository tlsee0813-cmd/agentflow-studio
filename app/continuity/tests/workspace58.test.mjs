// UI58 workspace layout on the pinned OSS cases (docs/cycles/2026-10-26-visual-experience-58): long sibling lists wrap into a
// readable block, relation layers stay apart, and records-less parts read as such. Layout only; no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildExample } from '../dist/public/shared/studio-examples.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope, edgePath, textWidth, NODE_W, NODE_H, COL_GAP, HEAD_2 } from '../dist/public/client/map-layout.js';

const data = JSON.parse(await readFile(new URL('../../../docs/cycles/2026-10-26-visual-experience-58/OSS_CASES.json', import.meta.url), 'utf8'));
const viewOf = id => studioView(buildExample(data.cases.find(c => c.spec.id === id).spec));
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('UI58-L1 twenty restic commands wrap into a block that fits a 1280 map at 100%, not a strip', () => {
  const v = viewOf('oss-restic'), root = v.roots.map(id => v.parts.find(p => p.id === id)).find(p => p.childIds.length >= 20);
  const l = layoutScope(v, root.id, () => false, {});
  const nodes = [...l.boxes.values()].filter(b => b.kind === 'node');
  assert.ok(nodes.length >= 20);
  for (const b of nodes) { assert.equal(b.w, NODE_W); assert.equal(b.h, NODE_H); }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) assert.ok(!overlaps(nodes[i], nodes[j]), 'no overlap');
  const rows = new Set(nodes.map(b => b.y)).size, cols = new Set(nodes.map(b => b.x)).size;
  assert.ok(rows <= 8 && cols <= 5, `${cols} columns × ${rows} rows`);
  // 1280 wide window, inspector closed: about 1230 × 600 of map at 100%.
  assert.ok(l.bounds.w <= 1230 && l.bounds.h <= 600, JSON.stringify(l.bounds));
});

test('UI58-L2 wrapped columns of one layer sit closer than a relation layer', () => {
  const v = viewOf('oss-restic');
  const l = layoutScope(v, null, (_id, depth) => depth === 0, {});
  const nodes = [...l.boxes.values()].filter(b => b.kind === 'node' && b.depth === 1);
  const xs = [...new Set(nodes.map(b => b.x))].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] - NODE_W < COL_GAP, 'siblings inside one frame keep a small gap');
});

test('UI58-L3 records-less OSS parts stay plan without invented records; repeated names keep separate identities', () => {
  const v = studioView(buildExample({ ...data.cases.find(c => c.spec.id === 'oss-node-red').spec,
    parts: [...data.cases.find(c => c.spec.id === 'oss-node-red').spec.parts, ...data.derivedStress.find(d => d.id === 'repeated-subparts').appendParts] }));
  assert.equal(v.records.length, 0);
  assert.ok(v.parts.every(p => p.status === 'plan'));
  const settings = v.parts.filter(p => p.name === '설정');
  assert.equal(settings.length, 3);
  assert.equal(new Set(settings.map(p => p.parentId)).size, 3);
});

test('UI58-L4 parts inside a group run top to bottom; the converter plan map fits beside the inspector at 1280 and 100%', async () => {
  const { buildConverterProject } = await import('../dist/public/client/plan-source.js');
  const v = studioView(buildConverterProject());
  const l = layoutScope(v, null, (_id, depth) => depth === 0, {});
  for (const f of [...l.boxes.values()].filter(b => b.kind === 'frame')) {
    const kids = [...l.boxes.values()].filter(b => b.container === f.id);
    assert.equal(new Set(kids.map(b => b.x)).size, 1, 'one column inside the group');
  }
  // 1280 window − 384 inspector − 16 + 24 side margins.
  assert.ok(l.bounds.w <= 1280 - 384 - 40, `bounds ${l.bounds.w}`);
});

test('UI58-L5 a long group name gets a second head line and room for it; stored places are kept', () => {
  const spec = data.cases.find(c => c.spec.id === 'oss-node-red').spec;
  const long = '@node-red/nodes 기본 제공 노드 묶음 · 네트워크·데이터·파일 처리';
  const v = studioView(buildExample({ ...spec, parts: spec.parts.map(p => p.name === '@node-red/nodes' ? { ...p, name: long } : p) }));
  const f = v.parts.find(p => p.name === long);
  const l = layoutScope(v, null, (_id, depth) => depth === 0, {});
  const box = l.boxes.get(f.id);
  assert.equal(box.kind, 'frame'); assert.equal(box.head, HEAD_2); assert.ok(box.w <= 360);
  assert.ok(textWidth(long) <= (box.w - 88) * 2, 'two lines are enough');
  const kid = [...l.boxes.values()].find(b => b.container === f.id);
  assert.equal(kid.y - box.y, HEAD_2, 'children start under the taller head');
  const stored = { root: { [f.id]: { x: 900, y: 40 } } };
  assert.equal(layoutScope(v, null, (_id, depth) => depth === 0, stored).boxes.get(f.id).x, 900);
});

test('UI58-L6 a line between two parts of one column goes round a part between them instead of through it', () => {
  const box = (id, y) => ({ id, x: 0, y, w: NODE_W, h: NODE_H, kind: 'node', depth: 1, container: 'g', kids: 0, rel: { x: 0, y }, head: 0 });
  const a = box('a', 0), b = box('b', 72), c = box('c', 144);
  assert.match(edgePath(a, c, [a, b, c]).d, new RegExp(`^M${NODE_W},`), 'leaves from the side');
  assert.match(edgePath(a, b, [a, b, c]).d, new RegExp(`^M${NODE_W / 2},${NODE_H}`), 'neighbours keep the short vertical line');
});

/** Points along an edge path made of M, C, L and Q commands (what edgePath writes). */
function sample(d) {
  const t = d.match(/[MCLQ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g), pts = []; let i = 0, cur = null;
  const num = () => Number(t[i++]);
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M') { cur = { x: num(), y: num() }; continue; }
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
function crossings(l) {
  const boxes = [...l.boxes.values()], byId = new Map(boxes.map(b => [b.id, b]));
  const within = (o, f) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
  const bad = [];
  for (const e of l.edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    const blocks = boxes.filter(o => o !== a && o !== b && !(o.kind === 'frame' && (within(a, o) || within(b, o))) && !(a.kind === 'frame' && within(o, a)) && !(b.kind === 'frame' && within(o, b)));
    for (const q of sample(edgePath(a, b, boxes).d)) {
      const o = blocks.find(o => q.x > o.x + 2 && q.x < o.x + o.w - 2 && q.y > o.y + 2 && q.y < o.y + o.h - 2);
      if (o) { bad.push(`${e.from} → ${e.to} under ${o.id}`); break; }
    }
  }
  return bad;
}

test('UI58-L7 no relation line passes under an unrelated part or group (Joplin, Node-RED core, converter, salon)', async () => {
  const { buildConverterProject } = await import('../dist/public/client/plan-source.js');
  const { EXAMPLES } = await import('../dist/public/shared/studio-examples.js');
  const open0 = (_id, depth) => depth === 0;
  const nr = viewOf('oss-node-red'), core = nr.parts.find(p => p.name === 'core');
  for (const [name, l] of [
    ['joplin', layoutScope(viewOf('oss-joplin'), null, open0, {})],
    ['node-red', layoutScope(nr, null, open0, {})],
    ['node-red core', layoutScope(nr, core.id, open0, {})],
    ['converter', layoutScope(studioView(buildConverterProject()), null, open0, {})],
    ['salon', layoutScope(studioView(buildExample(EXAMPLES.find(e => e.id === 'salon'))), null, open0, {})]
  ]) assert.deepEqual(crossings(l), [], name);
});

test('UI58-L8 a group end meets the group at its head row, not beside an inner part', () => {
  const v = viewOf('oss-joplin'), l = layoutScope(v, null, (_id, depth) => depth === 0, {});
  const groupEdges = l.edges.filter(e => l.boxes.get(e.from).kind === 'frame' || l.boxes.get(e.to).kind === 'frame');
  assert.ok(groupEdges.length > 0);
  for (const e of groupEdges) {
    const a = l.boxes.get(e.from), b = l.boxes.get(e.to), pts = sample(edgePath(a, b, l.boxes.values()).d), first = pts[0], last = pts.at(-1);
    for (const [box, p] of [[a, first], [b, last]]) if (box.kind === 'frame') assert.ok(p.y >= box.y && p.y <= box.y + box.head, `${box.id} port at y ${p.y}`);
  }
});
