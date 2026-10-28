// AF-EXPERIENCE75: a nested group's name and the lines that meet it, on the real micro-javascript backup (a d971d0c reading of a
// public OSS excerpt, as imported; not an execution of that project). The parent structure is the stored one: nothing is
// flattened or moved. Geometry is the layout's own estimate; the browser scene was checked by eye.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBackup } from '../dist/public/shared/validation.js';
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
