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
  // A catalogue of commands with few links between them reads as a list: short rows, never narrower than a part.
  for (const b of nodes) { assert.equal(b.face, 'item'); assert.ok(b.w >= NODE_W && b.h >= 31 && b.h <= 48, `${b.id} ${b.w}×${b.h}`); }
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
  // 1280 window − 384 inspector − 16 + 24 side margins; each region's head also holds its boundary count (POLISH67: the
  // estimate font is wider than the page's, where the three regions still fit).
  const { linkChipW } = await import('../dist/public/client/map-layout.js');
  assert.ok(l.bounds.w <= 1280 - 384 - 40 + 3 * linkChipW(9), `bounds ${l.bounds.w}`);
});

test('UI58-L5 a long group name gets a second head line and room for it; stored places are kept', () => {
  const spec = data.cases.find(c => c.spec.id === 'oss-node-red').spec;
  const long = '@node-red/nodes 기본 제공 노드 묶음 · 네트워크·데이터·파일 처리';
  const v = studioView(buildExample({ ...spec, parts: spec.parts.map(p => p.name === '@node-red/nodes' ? { ...p, name: long } : p) }));
  const f = v.parts.find(p => p.name === long);
  const l = layoutScope(v, null, (_id, depth) => depth === 0, {});
  const box = l.boxes.get(f.id);
  // A region head: the name on up to two lines (15px) and the first sentence of its note; the region widens rather than cut.
  assert.equal(box.kind, 'frame'); assert.ok(box.head >= HEAD_2, `head ${box.head}`); assert.ok(box.w <= 380);
  assert.ok(textWidth(long) * 15 / 13 <= (box.w - 84) * 2, 'two lines are enough');
  const kid = [...l.boxes.values()].find(b => b.container === f.id);
  assert.equal(kid.y - box.y, box.head, 'children start under the taller head');
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

test('UI58-L9 only long part names widen their card, by measured width, with room for the go-inside count; capped', async () => {
  const { nodeWidth, NODE_MAX_W } = await import('../dist/public/client/map-layout.js');
  const wide = text => text.length * 8.6; // a wide fallback font (DejaVu Sans semibold at 13.5px is about this)
  assert.equal(nodeWidth('restic backup', false, wide), NODE_W);
  for (const name of ['restic repository review / restic repair index', 'restic repository review / restic repair snapshots']) {
    const w = nodeWidth(name, false, wide);
    assert.ok(w > NODE_W && w <= NODE_MAX_W, `${name}: ${w}`);
    assert.ok(wide(name) * 1.12 + 8 <= (w - 23) * 2, 'two lines are enough, with room for word breaks');
  }
  const name = 'restic repository review / restic repair index';
  assert.ok(nodeWidth(name, true, wide) > nodeWidth(name, false, wide), 'the fold toggle and go-inside count take room too');
  assert.equal(nodeWidth('x'.repeat(60), true, wide), NODE_MAX_W);
  const v = viewOf('oss-restic'), long = layoutScope(v, null, () => true, {}, wide);
  for (const b of long.boxes.values()) if (b.kind === 'node') assert.ok(b.w >= NODE_W);
});

test('UI61 a planned change line takes room only on its own part and never narrows a name; no plan keeps every box', () => {
  const v = viewOf('oss-joplin'), open = (_id, depth) => depth === 0;
  const desktop = v.parts.find(p => p.name === '@joplin/app-desktop'), row = v.parts.find(p => p.parentId === desktop.id && !p.childIds.length);
  const base = layoutScope(v, null, open, {}), same = layoutScope(v, null, open, {}, undefined, new Map());
  for (const [id, b] of base.boxes) assert.deepEqual(same.boxes.get(id), b, 'an empty plan changes nothing');
  const long = '편집과 미리보기를 같은 창에서 비교하고 작성 중인 내용과 표시 결과를 함께 확인하기';
  const planned = layoutScope(v, null, open, {}, undefined, new Map([[desktop.id, [long]], [row.id, [long]]]));
  const b0 = base.boxes.get(desktop.id), b1 = planned.boxes.get(desktop.id), r0 = base.boxes.get(row.id), r1 = planned.boxes.get(row.id);
  assert.ok(b1.head > b0.head && b1.w === b0.w, 'the region head grows under its name; its width (the name room) is kept');
  assert.ok(r1.h > r0.h && r1.w === r0.w, 'two planned lines add a line to that row only');
  for (const [id, b] of base.boxes) {
    if (id === desktop.id || id === row.id || b.container === desktop.id) continue;
    assert.deepEqual([planned.boxes.get(id).w, planned.boxes.get(id).h], [b.w, b.h], `${id} keeps its size`);
  }
});

test('UI61 one short planned line keeps the own padding of a list item or row; a folded part keeps room for its inner line', () => {
  const v = viewOf('oss-restic'), open = (_id, depth) => depth === 0, A = k => v.parts.find(p => p.name === `restic ${k.replace('-', ' ')}`).id;
  const base = layoutScope(v, null, open, {}), planned = layoutScope(v, null, open, {}, undefined, new Map([[A('backup'), ['백업 대상 먼저 보기']], [A('key-add'), ['추가할 키의 용도 먼저 적기']]]));
  const item = planned.boxes.get(A('backup')), folded = planned.boxes.get(A('key'));
  assert.equal(item.face, 'item'); assert.equal(base.boxes.get(A('backup')).h, 31, 'a plan-status item without a state line is 31 tall');
  assert.equal(item.h, 14 + 17 + 2 + 15, 'name 17 + gap 2 + one planned line 15, with the 7px padding above and below');
  assert.equal(folded.h, 14 + 17 + 2 + 15, 'the folded parent of a planned part reserves its one inner line');
  for (const [id, b] of base.boxes) if (![A('backup'), A('key')].includes(id) && planned.boxes.get(id).face === 'item') assert.equal(planned.boxes.get(id).h, b.h, `${id} keeps its height`);
  const c = studioView(buildExample(data.cases.find(x => x.spec.id === 'oss-node-red').spec)), mqtt = c.parts.find(p => p.name === '10-mqtt.js');
  const expand = id => { const out = new Set(); for (let p = c.parts.find(x => x.id === id)?.parentId; p; p = c.parts.find(x => x.id === p)?.parentId) out.add(p); return out; };
  const path = expand(mqtt.id), rows = layoutScope(c, null, x => path.has(x), {}, undefined, new Map([[mqtt.id, ['TLS 필수']]]));
  assert.equal(rows.boxes.get(mqtt.id).face, 'row'); assert.equal(rows.boxes.get(mqtt.id).h, 20 + 18 + 2 + 15, 'a row keeps its 10px padding for one line');
});
