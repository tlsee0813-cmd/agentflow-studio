// Map design v3 4 (S6), the pure part: a loop container is a capability made only from a recorded loop with recorded steps (never
// from a type word, a name or step names alone); its well keeps a visible budget of 5 (first, last, a loop end, a failure branch and
// a port-mapped step always kept, up to 8; past that one '분기 단계 N' row), folds the rest as '중간 단계 N 접힘' with nothing across
// a fold, reads one deeper than two as '내부 반복 · 단계 N ›', keeps the state in its own compartment, and an explicit expansion grows
// the card from its top-left edge, moving only the siblings it overlaps; collapsing returns every box. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isContainer, containerBody, foldText, nestedText, branchText, stateText, makeRoom, wellHeight, WELL_BUDGET, WELL_MAX } from '../dist/public/client/container-view.js';
import { cardTemplate, cardHeights } from '../dist/public/client/card-family.js';
import { layoutScope, CARD_W } from '../dist/public/client/map-layout.js';

const steps = n => Array.from({ length: n }, (_, i) => ({ name: `단계${i + 1}` }));
const LOOP = { unit: '명령마다', stop: null, resume: null };
const shown = w => w.rows.filter(r => r.kind === 'step').map(r => r.name);

test('CONT-1 a container only from a recorded loop with recorded steps; never from a type word, a name or step names', () => {
  assert.equal(isContainer(steps(3), LOOP), true);
  assert.equal(isContainer(steps(3), null), false, 'no loop row: no container (a "loop" step name or type word is not one)');
  assert.equal(isContainer([{ name: 'warmup 루프' }, { name: '측정 루프' }], null), false);
  assert.equal(isContainer([], LOOP), false, 'a loop with no steps keeps its card');
  assert.equal(isContainer([{ name: 'a', program: true }], LOOP), false, 'only the program\'s cut steps: not the record\'s');
  const facts = x => ({ type: 'loop', config: [], inputs: [], outputs: [], fields: [], loop: null, steps: [], conditions: [], ...x });
  assert.equal(cardTemplate(facts({ steps: steps(11) })).well, null, 'hyperfine Benchmark: type loop, 11 steps, no loop row');
  const t = cardTemplate(facts({ loop: LOOP, steps: steps(13), stateVars: 3 }));
  assert.ok(t.well); assert.equal(t.family, 'process', 'a container keeps its family'); assert.equal(t.innerLine.text, '단계 13 · 명령마다', 'the inner line stays for the far tiers');
});

test('CONT-2 the visible budget: five rows, the rest folded in the record\'s order; nothing crosses a fold', () => {
  const w = containerBody(steps(9), LOOP);
  assert.equal(WELL_BUDGET, 5);
  assert.deepEqual(shown(w), ['단계1', '단계2', '단계3', '단계4', '단계9']);
  assert.deepEqual(w.rows.map(r => r.kind), ['step', 'step', 'step', 'step', 'fold', 'step']);
  assert.deepEqual(w.rows[4], { kind: 'fold', count: 4, from: 4, to: 7 });
  assert.equal(foldText(4), '중간 단계 4 접힘'); assert.equal(w.folded, 4);
  assert.equal(containerBody(steps(5), LOOP).folded, 0, 'within the budget: every step');
  // The fold is a row of its own between steps: no step row stands for it and no row joins the steps around it.
  assert.ok(w.rows.every(r => r.kind !== 'fold' || (r.count > 0 && !('name' in r))));
});

test('CONT-3 always kept: the last row, the step the loop\'s stop names, a failure branch\'s step, a port-mapped step; a sixth that ends the loop stays', () => {
  const s = steps(9);
  const w = containerBody(s, { unit: '반복마다', stop: '단계7에서 round_no > max_rounds', resume: null });
  assert.ok(shown(w).includes('단계7'), 'the loop end is kept');
  assert.equal(w.rows.find(r => r.name === '단계7').keep.join(), 'stop');
  const b = containerBody(s, LOOP, { conditions: [{ then: '단계6 → 중단', else: null }] });
  assert.ok(shown(b).includes('단계6') && b.rows.find(r => r.name === '단계6').keep.includes('branch'));
  const p = containerBody(s, LOOP, { portSteps: ['단계8'] });
  assert.ok(shown(p).includes('단계8'));
  // Kept rows beyond the budget widen it (up to 8), never dropping one.
  const many = containerBody(steps(12), LOOP, { conditions: [2, 4, 6, 8, 10].map(i => ({ then: `단계${i}`, else: null })) });
  assert.equal(shown(many).length, 7); for (const i of [1, 2, 4, 6, 8, 10, 12]) assert.ok(shown(many).includes(`단계${i}`), String(i));
  // Past 8 kept rows the kept middle reads as one row, between the first and the last.
  const over = containerBody(steps(14), LOOP, { conditions: [2, 3, 4, 5, 6, 7, 8, 9].map(i => ({ then: `단계${i}`, else: null })) });
  assert.equal(WELL_MAX, 8);
  assert.deepEqual(over.rows.map(r => r.kind), ['step', 'branches', 'fold', 'step']);
  assert.equal(branchText(over.rows[1].count), '분기 단계 8');
  // A one-letter step name is never matched in a text.
  assert.equal(containerBody([...steps(8), { name: 'x' }, { name: 'y' }], { unit: null, stop: 'x가 끝나면', resume: null }).rows.find(r => r.name === 'x'), undefined);
});

test('CONT-4 explicit expansion shows every step; past depth 2 one nested row; the state compartment', () => {
  assert.equal(containerBody(steps(12), LOOP, { open: true }).rows.length, 12);
  const deep = containerBody(steps(6), LOOP, { depth: 3 });
  assert.deepEqual(deep.rows, [{ kind: 'nested', count: 6 }]); assert.equal(nestedText(6), '내부 반복 · 단계 6 ›');
  assert.equal(containerBody(steps(6), LOOP, { depth: 2 }).rows[0].kind, 'step', 'depth 2 still shows its steps');
  const st = containerBody(steps(3), LOOP, { stateVars: 3 }).state;
  assert.deepEqual(st, { count: 3, linked: 0 }); assert.equal(stateText(st), '유지 상태 3', 'no per-item evidence yet: one muted line, no chips; 「항목 근거 미연결」 only in its tip (0.1)');
  assert.equal(containerBody(steps(3), LOOP).state, null);
  // The well's height is its rows' and the card's near-tier height follows it (fixed for zoom, grown only by an expansion).
  const f = x => ({ type: 'loop', config: [], inputs: [], outputs: [], fields: [], loop: LOOP, steps: steps(12), conditions: [], ...x });
  const shut = cardHeights(cardTemplate(f({})), 1), open = cardHeights(cardTemplate(f({ wellOpen: true })), 1);
  assert.equal(shut.inner, wellHeight(cardTemplate(f({})).well)); assert.ok(open.total > shut.total);
  assert.equal(open.contact, shut.contact, 'the contact point (above the well) does not move');
});

test('CONT-5 making room: only the siblings the grown box overlaps move, the least way right or down; others never move', () => {
  const grown = { id: 'g', x: 0, y: 0, w: 272, h: 600 };
  const below = { id: 'b', x: 0, y: 300, w: 272, h: 200 }, right = { id: 'r', x: 340, y: 0, w: 272, h: 200 }, far = { id: 'f', x: 900, y: 900, w: 100, h: 100 }, under = { id: 'u', x: 0, y: 520, w: 272, h: 100 };
  const m = makeRoom(grown, [below, right, far, under]);
  // The smaller of the two ways: right by 272 + 24 rather than down by 600 + 24 − 300.
  assert.deepEqual(m.get('b'), { dx: 272 + 24, dy: 0 });
  assert.deepEqual(m.get('u'), { dx: 0, dy: 600 + 24 - 520 }, 'down when that is shorter');
  assert.equal(m.has('r'), false, 'clear of the grown box by more than 24: stays');
  assert.equal(m.has('f'), false);
  // Every moved box clears the grown one and each other.
  const at = [below, right, far, under].map(b => ({ ...b, x: b.x + (m.get(b.id)?.dx ?? 0), y: b.y + (m.get(b.id)?.dy ?? 0) }));
  const ov = (p, q, k = 0) => p.x < q.x + q.w + k && q.x < p.x + p.w + k && p.y < q.y + q.h + k && q.y < p.y + p.h + k;
  for (const b of at) assert.ok(!ov(grown, b, 23.5), b.id);
  for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) assert.ok(!ov(at[i], at[j]), `${at[i].id} ${at[j].id}`);
  // A sibling pushed into another pushes it in turn.
  const chain = makeRoom({ id: 'g', x: 0, y: 0, w: 100, h: 300 }, [{ id: 'p', x: 0, y: 250, w: 300, h: 50 }, { id: 'q', x: 0, y: 380, w: 300, h: 50 }]);
  assert.deepEqual(chain.get('p'), { dx: 0, dy: 74 }); assert.deepEqual(chain.get('q'), { dx: 0, dy: 18 }, 'clear of the grown box, moved only by p');
  // Beside the grown box within the margin: moved right.
  const close = makeRoom(grown, [{ id: 'c', x: 280, y: 100, w: 200, h: 100 }]);
  assert.deepEqual(close.get('c'), { dx: 272 + 24 - 280, dy: 0 });
});

test('CONT-6 expanding in the layout keeps the top-left edge, moves only overlapping neighbours; collapsing restores every box', () => {
  // Three typed cards in one column under the root: the first is a container; its expansion grows it by 200.
  const parts = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id, parentId: null, childIds: [], note: '', status: 'none', records: [] }));
  const v = { parts, roots: ['a', 'b', 'c', 'd'], relations: [{ id: 'r1', from: 'a', to: 'b', kind: 'flow', note: '' }, { id: 'r2', from: 'a', to: 'c', kind: 'flow', note: '' }, { id: 'r3', from: 'a', to: 'd', kind: 'flow', note: '' }], records: [] };
  let open = false;
  const extra = id => ({ nameRoom: 212, shape: () => ({ h: id === 'a' && open ? 600 : 208, contact: 80, pins: {} }) });
  const lay0 = layoutScope(v, null, () => false, {}, undefined, undefined, 1.6, extra);
  const before = new Map([...lay0.boxes].map(([k, b]) => [k, { x: b.x, y: b.y, w: b.w, h: b.h }]));
  // Hold every box of the container (the app's toggleWell), grow, then make room among the siblings.
  const hold = { root: Object.fromEntries([...lay0.boxes.values()].map(b => [b.id, { x: b.rel.x, y: b.rel.y }])) };
  open = true;
  const lay1 = layoutScope(v, null, () => false, hold, undefined, undefined, 1.6, extra), a1 = lay1.boxes.get('a');
  assert.equal(a1.x, before.get('a').x); assert.equal(a1.y, before.get('a').y, 'the top-left edge stays'); assert.equal(a1.h, 600);
  const moves = makeRoom(a1, [...lay1.boxes.values()].filter(b => b.id !== 'a'));
  const push = { root: Object.fromEntries([...moves].map(([id, m]) => { const b = lay1.boxes.get(id); return [id, { x: b.rel.x + m.dx, y: b.rel.y + m.dy }]; })) };
  const lay2 = layoutScope(v, null, () => false, { root: { ...hold.root, ...push.root } }, undefined, undefined, 1.6, extra);
  const A = lay2.boxes.get('a'), overlap = (p, q, m = 0) => p.x < q.x + q.w + m && q.x < p.x + p.w + m && p.y < q.y + q.h + m && q.y < p.y + p.h + m;
  for (const b of lay2.boxes.values()) if (b.id !== 'a') assert.ok(!overlap(A, b, 23.5), `${b.id} clears the grown card`);
  for (const [id, b0] of before) if (id !== 'a' && !moves.has(id)) assert.deepEqual({ x: lay2.boxes.get(id).x, y: lay2.boxes.get(id).y }, { x: b0.x, y: b0.y }, `${id} did not move`);
  // Collapse: the overlays go, the card shrinks, every box is where it was.
  open = false;
  const lay3 = layoutScope(v, null, () => false, {}, undefined, undefined, 1.6, extra);
  for (const [id, b0] of before) assert.deepEqual({ x: lay3.boxes.get(id).x, y: lay3.boxes.get(id).y, w: lay3.boxes.get(id).w, h: lay3.boxes.get(id).h }, b0, id);
  assert.equal(CARD_W, 272);
});
