// Labels at rest (map spec 2.3) and the operations line (spec 2.2), the pure parts: where a label may sit on its line (a straight
// run with 8px of line each side, else beside the line just short of its end port) and how the operations line writes its time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { labelSpots, portSpots, polylineHitsRect } from '../dist/public/client/map-labels.js';
import { opsWhen, opsText, opsLines, opsHead } from '../dist/public/client/ops-line.js';

test('S1 the panel head\'s operations line: the full form with the record\'s month-day and time, 현재 가동 여부 미확인, 보고 kept in the words', () => {
  assert.equal(opsHead('running', '2026-10-31T16:03:59Z'), '가동 보고 · 10-31 16:03Z · 현재 가동 여부 미확인');
  assert.equal(opsHead('running', null), '가동 보고 · 현재 가동 여부 미확인');
  assert.equal(opsHead('stopped', '11-01 09:00Z'), '멈춤 보고 · 11-01 09:00Z');
  assert.equal(opsHead('working', '어제 저녁'), '작업 중 보고 · 어제 저녁', 'a time written another way reads as written');
  assert.equal(opsHead(null, null), '운영 기록 없음');
  assert.equal(opsHead('odd', null), '운영 기록 모름');
  assert.equal(opsText('running', '08:01Z'), '가동 보고 · 08:01Z · 현재 미확인', 'the card keeps its own words');
});

test('a label at rest needs its width and 8px of line on each side past the corners; a run without that room gives none', () => {
  const run = len => [{ x: 0, y: 0 }, { x: len, y: 0 }];
  // A single run (ports at both ends, no corner): the label (60px) needs 60 + 4 + 16.
  assert.equal(labelSpots(run(79), 60, 16, 'long', 8).length, 0);
  assert.ok(labelSpots(run(80), 60, 16, 'long', 8).length > 0);
  assert.ok(labelSpots(run(64), 60, 16, 'long').length > 0, 'without the pad the old rule holds');
  // Every place keeps 8px of its run free at each end.
  for (const r of labelSpots(run(140), 60, 16, 'long', 8)) { assert.ok(r.x >= 2 + 8 - 0.5); assert.ok(r.x + r.w <= 140 - 2 - 8 + 0.5); }
  // Between two bends the corners' clearance comes on top.
  const mid = [{ x: 0, y: -40 }, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }];
  assert.ok(labelSpots(mid, 60, 16, 'long', 8).some(r => r.y === -8 && r.x >= 8 + 2 + 8 - 0.5 && r.x + r.w <= 100 - 8 - 2 - 8 + 0.5));
  assert.equal(labelSpots(mid, 70, 16, 'long', 8).filter(r => r.y === -8).length, 0, '70 + 2·8 + 2·8 + 4 > 100');
});

test('beside the end port: above and below a level arrival, on both sides of an upright one, clear of the arrowhead and of the line', () => {
  const level = [{ x: 0, y: 100 }, { x: 0, y: 50 }, { x: 40, y: 50 }];
  const [a, b] = portSpots(level, 50, 16);
  assert.deepEqual(a, { x: 40 - 12 - 50, y: 50 - 16 - 3, w: 50, h: 16 });
  assert.deepEqual(b, { x: 40 - 12 - 50, y: 53, w: 50, h: 16 });
  const left = portSpots([{ x: 200, y: 0 }, { x: 100, y: 0 }], 50, 16);
  assert.equal(left[0].x, 112, 'arriving leftwards, the label sits right of the tip');
  const down = portSpots([{ x: 10, y: 0 }, { x: 10, y: 80 }], 50, 16);
  assert.deepEqual(down, [{ x: 14, y: 80 - 12 - 16, w: 50, h: 16 }, { x: 10 - 50 - 4, y: 52, w: 50, h: 16 }]);
  // The level spots never touch their own last run; one that reaches back past its bend does (the app drops it).
  assert.equal(polylineHitsRect([{ x: 0, y: 50 }, { x: 200, y: 50 }], portSpots([{ x: 0, y: 50 }, { x: 200, y: 50 }], 50, 16)[0], 1), false);
  assert.equal(polylineHitsRect(level, a, 1), false, 'above: clear of the run that rises to the bend');
  assert.equal(polylineHitsRect(level, b, 1), true, 'below a 40px last run, a 50px label reaches the upright run before it');
  assert.deepEqual(portSpots([{ x: 0, y: 0 }], 10, 10), []);
});

test('the operations line writes the time alone on the basis day, month-day and time on any other', () => {
  assert.equal(opsWhen('11-03 07:46Z', '2026-11-03T09:01:03Z'), '07:46Z');
  assert.equal(opsWhen('2026-11-03T07:46:00.000Z', '2026-11-03T09:01:03Z'), '07:46Z');
  assert.equal(opsWhen('2026-11-03 07:46 UTC', '11-03 08:49Z'), '07:46Z');
  assert.equal(opsWhen('11-02 23:10Z', '2026-11-03T09:01:03Z'), '11-02 23:10Z');
  assert.equal(opsWhen('2026-11-03T07:46Z', null), '11-03 07:46Z', 'no reference: the day stays');
  assert.equal(opsWhen('2025-11-03T07:46Z', '2026-11-03'), '2025-11-03 07:46Z', 'another year says so');
  assert.equal(opsWhen('11-3 7:46', '2026-11-03'), '7:46');
  for (const asWritten of ['08:49Z', '11-02', '어제 저녁', '2026-11-03']) assert.equal(opsWhen(asWritten, '2026-11-03'), asWritten);
});

test('the operations line: its words, the brief form only shortens 현재 미확인, and the tip keeps the time as written', () => {
  assert.equal(opsText('running', '07:46Z'), '가동 보고 · 07:46Z · 현재 미확인');
  assert.equal(opsText('running', '07:46Z', true), '가동 보고 · 07:46Z · 현재 ?');
  assert.equal(opsText('stopped', null), '멈춤 보고');
  assert.equal(opsText(null, null), '운영 기록 없음');
  assert.equal(opsText('unknown', '07:46Z'), '운영 기록 모름');
  assert.deepEqual(opsLines('running', '11-03 07:46Z', '2026-11-03T09:01:03Z'), { full: '가동 보고 · 07:46Z · 현재 미확인', brief: '가동 보고 · 07:46Z · 현재 ?', tip: '가동 보고 · 11-03 07:46Z · 현재 미확인' });
  // Nothing but 현재 미확인 is ever shortened: other states read the same in both forms.
  for (const st of ['working', 'stopped', 'unbuilt', 'retired']) { const l = opsLines(st, '11-02 07:46Z', '2026-11-03'); assert.equal(l.full, l.brief); }
});
