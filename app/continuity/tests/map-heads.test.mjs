// Beauty v5 lanes review: every drawn line keeps its head. A map opened at nearly the zoom of the map before it (0.643 after 0.640)
// drew every head at the SVG default box: the redraw made new markers and one zoom cache, set by the old ones, skipped sizing them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HEAD_PX, MARK_STEP, markPx, markResize } from '../dist/public/client/line-grammar.js';

test('HEADS-1 an end mark is HEAD_PX screen pixels at every zoom', () => {
  for (const k of [0.3, 0.514, 0.64, 0.643, 1, 2.25]) for (const [h, px] of Object.entries(HEAD_PX)) {
    const w = Number(markPx(h, k));
    assert.ok(Math.abs(w * k - px) < 0.01, `${h} at ${k}: ${w * k}`);
  }
  assert.ok(Number.isFinite(Number(markPx('filled', 0))), 'no zoom of 0 makes an endless box');
});

test('HEADS-2 a marker never sized is sized whatever zoom another marker was sized at; a sized one only when the zoom moved', () => {
  // The failure: markers made by a redraw at 0.643 after the old ones were sized at 0.640 (within the step).
  assert.equal(markResize(null, 0.643), true, 'a new marker is sized');
  assert.equal(markResize(Number.NaN, 0.643), true);
  assert.equal(markResize(0.643, 0.643), false);
  assert.equal(markResize(0.640, 0.643), false, 'within the step: kept (it was sized at 0.640, near enough)');
  assert.equal(markResize(0.640, 0.640 + MARK_STEP), true);
});

test('HEADS-3 the client sizes each marker when it makes it and keeps no zoom cache shared across redraws', async () => {
  const app = await readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  const defs = app.slice(app.indexOf('function endMarkDefs('), app.indexOf('function syncMarks('));
  assert.match(defs, /markerWidth: px, markerHeight: px/, 'a marker carries its box from the start');
  assert.match(defs, /'data-k': String\(camera\.k\)/, 'and the zoom it was sized at');
  const sync = app.slice(app.indexOf('function syncMarks('), app.indexOf('function syncMarks(') + 700);
  assert.match(sync, /markResize\(at, k\)/, 'each marker by its own zoom');
  assert.doesNotMatch(app, /\bmarksAt\b/, 'no module-wide zoom cache');
  // Every marker is made by endMarkDefs (the one place sizing happens), and every redraw of the world puts it in.
  assert.equal((app.match(/svg\('marker', \{ id: `m-/g) ?? []).length, 1);
  assert.match(app, /edges\.append\(endMarkDefs\(\)\)/);
});
