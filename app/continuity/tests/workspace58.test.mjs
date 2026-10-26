// UI58 workspace layout on the pinned OSS cases (docs/cycles/2026-10-26-visual-experience-58): long sibling lists wrap into a
// readable block, relation layers stay apart, and records-less parts read as such. Layout only; no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildExample } from '../dist/public/shared/studio-examples.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope, NODE_W, NODE_H, COL_GAP } from '../dist/public/client/map-layout.js';

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
