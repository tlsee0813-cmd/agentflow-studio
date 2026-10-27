// UI62 arrangement of a scope's own unlinked parts on the pinned OSS cases (docs/cycles/2026-10-26-visual-experience-58):
// balanced against the window's shape instead of one tall column, never placed inside a relation layer, and relation layers
// keep their own centring. Layout only; no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildExample } from '../dist/public/shared/studio-examples.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope } from '../dist/public/client/map-layout.js';

const data = JSON.parse(await readFile(new URL('../../../docs/cycles/2026-10-26-visual-experience-58/OSS_CASES.json', import.meta.url), 'utf8'));
const viewOf = id => studioView(buildExample(data.cases.find(c => c.spec.id === id).spec));
const byName = (v, name) => v.parts.find(p => p.name === name);
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('UI62-L1 four unlinked parts inside the desktop app sit in balanced columns, not one tall column', () => {
  const v = viewOf('oss-joplin'), desktop = byName(v, '@joplin/app-desktop');
  const l = layoutScope(v, desktop.id, (_id, depth) => depth === 0, {}, undefined, undefined, 1280 / 668);
  const top = [...l.boxes.values()].filter(b => b.container === desktop.id);
  assert.equal(top.length, 4);
  assert.ok(new Set(top.map(b => b.x)).size >= 2, 'more than one column');
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) assert.ok(!overlaps(top[i], top[j]));
  // The same parts in a tall window may take one column: the shape follows the window, not a fixed grid.
  const tall = layoutScope(v, desktop.id, (_id, depth) => depth === 0, {}, undefined, undefined, 0.5);
  assert.ok(tall.bounds.w < l.bounds.w);
});

test('UI62-L2 relation layers centre against each other only; unlinked parts never join a relation layer', () => {
  const v = viewOf('oss-scikit-learn');
  const l = layoutScope(v, null, (_id, depth) => depth === 0, {}, undefined, undefined, 1280 / 668);
  const input = l.boxes.get(byName(v, '입력과 분할').id), named = l.boxes.get(byName(v, '이름으로 열 선택').id), shared = l.boxes.get(byName(v, '공용 전처리 정의').id);
  // The unlinked input group is beside the linked block or under it, never in a column between relation layers.
  assert.ok(input.x >= shared.x + shared.w || input.y >= Math.max(named.y + named.h, shared.y + shared.h), JSON.stringify({ input, shared }));
  // The first relation layer starts at the top: a block of unlinked parts does not push it down.
  assert.equal(named.y, Math.min(...[...l.boxes.values()].filter(b => b.depth === 0).map(b => b.y)));
});

test('UI62-L3 stored places still win over the balanced arrangement', () => {
  const v = viewOf('oss-joplin'), desktop = byName(v, '@joplin/app-desktop'), list = byName(v, 'NoteList');
  const stored = { [desktop.id]: { [list.id]: { x: 700, y: 20 } } };
  const l = layoutScope(v, desktop.id, (_id, depth) => depth === 0, stored, undefined, undefined, 1280 / 668);
  assert.equal(l.boxes.get(list.id).x, 700);
  assert.equal(l.boxes.get(list.id).y, 20);
});
