// 동작 열기 (map spec 4): the app decides the scale. The short expansion opens in place only when its content, laid out
// beforehand at the default size, fits within 420×280, uses only the card's place and the empty space beside it, and covers no
// other part, label, drawn line or group boundary; otherwise the detail view. The open state outlives a reload, and the way
// back (이전 읽기 위치) keeps a bounded stack of reading positions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decideExpansion, placeExpansion, lineCovers, groupBody, actionSections, pushPlace, readOpenState, writeOpenState, cleanOpenState, OPEN_MAP, OPEN_KEY, SHORT_W, SHORT_H, BACK_MAX } from '../dist/public/client/expansion.js';

const card = { x: 100, y: 100, w: 240, h: 120 };
const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('fits: content within 420×280 on an open map opens in place, from the card\'s own corner', () => {
  assert.equal(SHORT_W, 420); assert.equal(SHORT_H, 280);
  assert.equal(decideExpansion({ w: 330, h: 200 }, card, [OPEN_MAP], []), 'short');
  assert.deepEqual(placeExpansion({ w: 330, h: 200 }, card, [OPEN_MAP], []), { x: 100, y: 100, w: 330, h: 200 });
  // Never smaller than the card: a short content keeps the card's own size.
  assert.deepEqual(placeExpansion({ w: 200, h: 60 }, card, [OPEN_MAP], []), card);
  // Exactly at the bound still fits.
  assert.equal(decideExpansion({ w: 420, h: 280 }, card, [OPEN_MAP], []), 'short');
});

test('too tall or too wide: past 420×280 it is the detail view, never a shrunk expansion', () => {
  assert.equal(decideExpansion({ w: 420, h: 281 }, card, [OPEN_MAP], []), 'detail');
  assert.equal(decideExpansion({ w: 421, h: 200 }, card, [OPEN_MAP], []), 'detail');
  assert.equal(decideExpansion([{ w: 240, h: 360 }, { w: 330, h: 300 }, { w: 420, h: 290 }], card, [OPEN_MAP], []), 'detail');
  // A wider layout of the same content that fits is taken when the narrow one is too tall.
  assert.deepEqual(placeExpansion([{ w: 240, h: 340 }, { w: 420, h: 250 }], card, [OPEN_MAP], []), { x: 100, y: 100, w: 420, h: 250 });
  assert.equal(decideExpansion([], card, [OPEN_MAP], []), 'detail', 'nothing measured: not in place');
});

test('covers a neighbour: it grows from another corner when that one is clear, else the detail view', () => {
  const right = { x: 360, y: 100, w: 240, h: 120 }; // a part to the right of the card
  // Growing right would cover it; growing left from the card's right corner is clear.
  assert.deepEqual(placeExpansion({ w: 330, h: 200 }, card, [OPEN_MAP], [right]), { x: 10, y: 100, w: 330, h: 200 });
  const left = { x: -150, y: 100, w: 240, h: 120 }, below = { x: 100, y: 240, w: 240, h: 120 }, above = { x: 100, y: -40, w: 240, h: 120 };
  assert.equal(decideExpansion({ w: 330, h: 200 }, card, [OPEN_MAP], [right, left]), 'detail', 'both sides taken: wider does not fit');
  assert.equal(decideExpansion({ w: 240, h: 200 }, card, [OPEN_MAP], [below, above]), 'detail', 'above and below taken: taller does not fit');
  // The clearance counts: a neighbour two pixels away from where it would end is covered.
  assert.equal(decideExpansion({ w: 240, h: 200 }, card, [OPEN_MAP], [{ x: 100, y: 302, w: 240, h: 60 }, above]), 'detail');
  assert.equal(decideExpansion({ w: 240, h: 200 }, card, [OPEN_MAP], [{ x: 100, y: 310, w: 240, h: 60 }]), 'short');
});

test('covers a label: a line\'s verb in the way sends it elsewhere or to the detail view', () => {
  const label = { x: 380, y: 140, w: 60, h: 18 };
  assert.deepEqual(placeExpansion({ w: 330, h: 200 }, card, [OPEN_MAP], [label]), { x: 10, y: 100, w: 330, h: 200 });
  assert.equal(decideExpansion({ w: 330, h: 200 }, card, [OPEN_MAP], [label, { x: 40, y: 150, w: 50, h: 18 }]), 'detail');
});

test('covers a drawn line: a line passing beside the card counts; its own line counts only past the card\'s edge', () => {
  const passing = [{ x: 400, y: 0 }, { x: 400, y: 500 }]; // a vertical line 60px right of the card
  assert.equal(lineCovers(passing, { x: 100, y: 100, w: 330, h: 200 }, card), true);
  assert.deepEqual(placeExpansion({ w: 330, h: 200 }, card, [OPEN_MAP], [], [passing]), { x: 10, y: 100, w: 330, h: 200 });
  // The card's own line ending at its left edge: growing right and down covers nothing of it.
  const own = [{ x: -200, y: 160 }, { x: 100, y: 160 }];
  assert.equal(lineCovers(own, { x: 100, y: 100, w: 330, h: 200 }, card), false);
  assert.equal(lineCovers(own, { x: 10, y: 100, w: 330, h: 200 }, card), true, 'growing left would cover the line it comes in on');
  // Lines on both sides and under: the detail view.
  const under = [{ x: 220, y: 220 }, { x: 220, y: 600 }], over = [{ x: 220, y: -300 }, { x: 220, y: 100 }], out = [{ x: 340, y: 160 }, { x: 700, y: 160 }];
  assert.equal(decideExpansion([{ w: 240, h: 240 }, { w: 330, h: 200 }], card, [OPEN_MAP], [], [own, out, under, over]), 'detail');
  assert.equal(decideExpansion({ w: 240, h: 240 }, card, [OPEN_MAP], [], [own, out, under]), 'short', 'with the top clear it grows upward from its lower corner');
});

test('a group boundary: inside a group it stays within the group\'s body, past its head', () => {
  const group = { x: 80, y: 40, w: 300, h: 260, head: 44 }, body = groupBody(group);
  assert.deepEqual(body, { x: 84, y: 88, w: 292, h: 208 });
  assert.equal(decideExpansion({ w: 280, h: 150 }, { x: 96, y: 100, w: 240, h: 120 }, [body], []), 'short');
  assert.equal(decideExpansion({ w: 330, h: 150 }, { x: 96, y: 100, w: 240, h: 120 }, [body], []), 'detail', 'wider than the group: it would cross its boundary');
  assert.equal(decideExpansion({ w: 240, h: 220 }, { x: 96, y: 100, w: 240, h: 120 }, [body], []), 'detail', 'taller than the group');
});

test('actionSections: every list whole, in reading order; nothing for an empty list; steps once the contract carries them', () => {
  const fields = Array.from({ length: 12 }, (_, i) => `f${i + 1}`);
  const s = actionSections({ inputs: ['a', 'b'], outputs: ['c'], fields, config: ['x 5 s', 'y'], state: '돌고 있음 · 07:46Z 기준' });
  assert.deepEqual(s.map(x => x.key), ['inputs', 'outputs', 'fields', 'config', 'state']);
  assert.deepEqual(s.find(x => x.key === 'fields').items, fields, 'all twelve fields, none cut');
  assert.equal(s.find(x => x.key === 'fields').kind, 'cells');
  assert.deepEqual(actionSections({ inputs: [], outputs: [], fields: [], config: [], state: null }), []);
  const st = actionSections({ inputs: [], outputs: [], fields: [], config: [], state: null, steps: [{ id: 'S1', name: '행 읽기' }, { id: 'S2', name: '판단' }] });
  assert.deepEqual(st, [{ key: 'steps', title: '기록된 단계', kind: 'lines', items: ['행 읽기', '판단'] }]);
});

test('the open state round-trips per map and survives a reload; malformed values read as nothing open', () => {
  const kv = store();
  assert.equal(readOpenState(kv, 'E1'), null);
  assert.equal(writeOpenState(kv, 'E1', { part: 'A7', mode: 'detail' }), true);
  writeOpenState(kv, 'E2', { part: 'B2', mode: 'short' });
  // A reload reads the same record back (a fresh reader over the same storage).
  const again = { getItem: k => kv.getItem(k), setItem: () => { throw new Error('read only'); } };
  assert.deepEqual(readOpenState(again, 'E1'), { part: 'A7', mode: 'detail' });
  assert.deepEqual(readOpenState(again, 'E2'), { part: 'B2', mode: 'short' });
  writeOpenState(kv, 'E1', null);
  assert.equal(readOpenState(kv, 'E1'), null, 'closing writes nothing open');
  assert.deepEqual(readOpenState(kv, 'E2'), { part: 'B2', mode: 'short' }, 'another map keeps its own');
  // Malformed records and storage read as nothing open; a refused write is only a lost convenience.
  kv.setItem(OPEN_KEY, JSON.stringify({ E3: { part: 'C', mode: 'wide' }, E4: { part: '', mode: 'short' }, E5: 'x', __proto__: { part: 'P', mode: 'short' } }));
  for (const k of ['E3', 'E4', 'E5', '__proto__']) assert.equal(readOpenState(kv, k), null, k);
  kv.setItem(OPEN_KEY, '{not json'); assert.equal(readOpenState(kv, 'E1'), null);
  assert.equal(writeOpenState({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, 'E1', { part: 'A', mode: 'short' }), false);
  assert.equal(cleanOpenState({ part: 'constructor', mode: 'short' }), null);
  // The newest sixty maps are kept.
  const many = store(); for (let i = 0; i < 70; i++) writeOpenState(many, `M${i}`, { part: 'p', mode: 'short' });
  assert.equal(Object.keys(JSON.parse(many.getItem(OPEN_KEY))).length, 60);
  assert.equal(readOpenState(many, 'M0'), null); assert.deepEqual(readOpenState(many, 'M69'), { part: 'p', mode: 'short' });
});

test('the way back keeps the newest reading positions, each with its camera, selection, level and open state', () => {
  let st = [];
  for (let i = 0; i < BACK_MAX + 3; i++) st = pushPlace(st, { camera: { x: i, y: 0, k: 1 }, scope: null, selected: `p${i}`, level: 'detail', open: i % 2 ? { part: `p${i}`, mode: 'short' } : null });
  assert.equal(st.length, BACK_MAX);
  assert.equal(st[0].selected, 'p3'); assert.equal(st.at(-1).selected, `p${BACK_MAX + 2}`);
  assert.equal(st.at(-1).open, null);
  assert.deepEqual(st.at(-2).open, { part: `p${BACK_MAX + 1}`, mode: 'short' });
});
