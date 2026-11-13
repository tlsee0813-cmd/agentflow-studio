// Beauty v2 part B (「읽히는 첫 전체 화면」, the binding ruling): lines, ports, corridors and the lens contract, the pure parts.
// B1 data solid + filled head, control SOLID + open head, a reference a faint long dash; widths by the reading focus.
// B2 the ends on one side in the order of their other ends, PORT_MIN apart, never two marks on one point (a side with more ends than
//    room shares a port only between ends with the same mark).
// B3 room for the lines counted before routing (laneRoom), and strips opened where routed lines still crowd (openCorridors).
// B4 one stroke holds one direction, one kind and one signature of condition, timing and status; every relation restorable.
// B5 a lens's foreground and background (lensLineFg), the background visible (BG_LINE). No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lineStyle, lineWidth, mergeByChannel, relationSig, sigKey, LINE_W } from '../dist/public/client/line-grammar.js';
import { laneRoom, LANE_MARGIN, LANE_TRACK, layoutScope } from '../dist/public/client/map-layout.js';
import { routeEdges, openCorridors, applyStrips, crowdedAt, stripShift, CROWD, PORT_MIN, PORT_FLOOR, PORT_INSET, TRACK_GAP } from '../dist/public/client/map-route.js';
import { lensLook, lensLineFg, BG_LINE } from '../dist/public/client/view-lens.js';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const box = (id, x, y, w = 224, h = 80, extra = {}) => ({ id, x, y, w, h, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { x, y }, head: 0, face: 'unit', contact: 40, pins: {}, ...extra });
const boxes = list => new Map(list.map(b => [b.id, b]));
const edge = (from, to, n = 1, marks = { head: 'filled', start: 'none' }) => ({ key: `${from}|${to}|flow|${n}`, from, to, kind: 'flow', notes: [], ids: [`${from}${to}${n}`], agg: false, marks });

test('BV2B-1 control is a solid line with an open head, a reference a long dash; open and filled heads differ, no dashed control rule', () => {
  const data = lineStyle('flow', 'data'), control = lineStyle('flow', 'control'), ref = lineStyle('needs', 'uses');
  assert.equal(control.stroke, 'solid'); assert.deepEqual(control.dash, []); assert.equal(control.head, 'open');
  assert.equal(data.stroke, 'solid'); assert.equal(data.head, 'filled');
  assert.equal(ref.stroke, 'long'); assert.equal(ref.head, 'ref', 'a reference keeps its direction');
  assert.ok(!/\n\.edge\.s-dashed \.edge-line \{/.test(css), 'no dashed line rule left');
  assert.match(css, /\.space \.world \.edge \.edge-line \{ stroke-width: calc\(var\(--bw\) \* var\(--u, 1\) \* 1px\); \}/, 'one width declaration, in screen pixels');
  assert.deepEqual({ ...LINE_W }, { bg: 1.15, fg: 2.25, hover: 2.5, selected: 3 });
  assert.equal(lineWidth('far', 'rest'), 1.15); assert.equal(lineWidth('near', 'fg'), 2.25); assert.equal(lineWidth(null, 'selected'), 3);
});

test('BV2B-2 one stroke never covers relations with different conditions, timing or status; the same signature still shares one', () => {
  const sigs = { r1: relationSig({ when: 'wandb_log' }), r2: relationSig({}), r3: relationSig({ cadence: '호출마다' }), r4: relationSig({}), r5: relationSig({ planned: true }) };
  assert.equal(sigs.r2, ''); assert.notEqual(sigs.r1, sigs.r3); assert.notEqual(sigs.r5, '');
  const e = { key: 'a|b|flow', from: 'a', to: 'b', kind: 'flow', notes: [], ids: ['r1', 'r2', 'r3', 'r4', 'r5'], agg: false };
  const out = mergeByChannel([e], () => 'data', () => null, false, id => sigs[id]);
  assert.equal(out.length, 4, 'r2 and r4 share one stroke; r1, r3, r5 each their own');
  assert.deepEqual(out.map(x => x.ids.join(',')).sort(), ['r1', 'r2,r4', 'r3', 'r5']);
  assert.equal(new Set(out.map(x => x.key)).size, 4);
  for (const x of out) assert.ok(x.from === 'a' && x.to === 'b' && x.kind === 'flow', 'ends, direction and kind kept');
  // Every relation is in exactly one stroke (restorable).
  assert.deepEqual(out.flatMap(x => x.ids).sort(), ['r1', 'r2', 'r3', 'r4', 'r5']);
  // Stable (summary) keys carry the signature, so the same relations keep the same stroke.
  const st = mergeByChannel([{ ...e, key: 'sum:a|b|flow' }], () => 'data', () => null, true, id => sigs[id]);
  assert.ok(st.some(x => x.key === `sum:a|b|data|filled|${sigKey(sigs.r1)}`)); assert.ok(st.some(x => x.key === 'sum:a|b|data|filled'));
});

test('BV2B-3 corridor room: laneRoom gives 12px-ish margins and 8px-ish centres at the least card-face zoom; six strands ~64px + stroke', () => {
  assert.equal(TRACK_GAP, LANE_TRACK);
  assert.ok(LANE_MARGIN * 0.9 >= 12 && LANE_TRACK * 0.9 >= 8);
  assert.equal(laneRoom(0), 0); assert.ok(laneRoom(6) * 0.9 >= 64);
  assert.ok(CROWD * 0.9 >= 7.99 && CROWD * 0.9 <= 8.01);
});

test('BV2B-4 ports: the ends on one side are spread PORT_MIN or more apart in the order of their other ends, never stacked', () => {
  const b = boxes([box('m', 400, 200), box('a', 0, 0), box('b', 0, 120), box('c', 0, 240), box('d', 0, 360), box('e', 0, 480)]);
  const es = ['a', 'b', 'c', 'd', 'e'].map(id => edge(id, 'm'));
  const r = routeEdges(b, es), ys = es.map(e => r.get(e.key).pts.at(-1).y);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= PORT_MIN - 1e-6, `port ${i} ${ys[i] - ys[i - 1]}`);
  assert.deepEqual([...ys].sort((p, q) => p - q), ys, 'in the order of their other ends');
  for (const y of ys) assert.ok(y > 200 && y < 280, 'on the side');
});

// Beauty v2 review (H2): no port is shared any more (two lines out of one point ran together and forked: a bus the ruling forbids).
// A side with more ends than fit PORT_MIN apart spreads them PORT_FLOOR apart, inside the card's corners where it can.
test('BV2B-5 a side with more ends than room gives each end its own port, PORT_FLOOR apart, in order; never two ends on one point', () => {
  for (let n of [7, 8, 9]) {
    const sources = Array.from({ length: n }, (_, i) => box(`s${i}`, 0, i * 100));
    const b = boxes([box('m', 400, 400), ...sources]);
    const es = sources.map((s, i) => edge(s.id, 'm', i, { head: i < 5 ? 'filled' : 'open', start: 'none' }));
    // Beauty v3 (D.3): ends past the side's budget whose partner lies wholly above (below) take the card's top (bottom) face; the rest stay on the side.
    const r = routeEdges(b, es), onSide = es.filter(e => Math.abs(r.get(e.key).pts.at(-1).x - 400) < 0.5), ys = onSide.map(e => r.get(e.key).pts.at(-1).y);
    const top = es.filter(e => !onSide.includes(e)).map(e => r.get(e.key).pts.at(-1));
    assert.ok(top.every(q => Math.abs(q.y - 400) < 0.5 || Math.abs(q.y - 480) < 0.5), `${n}: the others meet the top or bottom face`);
    assert.equal(new Set(top.map(q => `${q.x.toFixed(2)},${q.y}`)).size, top.length, `${n}: each its own place on the face`);
    n = onSide.length;
    assert.equal(new Set(ys.map(y => y.toFixed(2))).size, n, `${n}: every end its own port`);
    const sorted = [...ys].sort((p, q) => p - q);
    for (let i = 1; i < n; i++) assert.ok(sorted[i] - sorted[i - 1] >= PORT_FLOOR - 1e-6, `${n}: ${sorted[i] - sorted[i - 1]}`);
    for (const y of ys) assert.ok(y >= 400 + 4 - 1e-6 && y <= 480 - 4 + 1e-6, 'on the side');
    if (n <= 8) for (const y of ys) assert.ok(y >= 400 + PORT_INSET - 1e-6 && y <= 480 - PORT_INSET + 1e-6, 'inside the corners');
  }
});

test('BV2B-6 openCorridors: strips only where they part crowded lines, boxes keep their order and never overlap; positions only', () => {
  // Two long lines forced through one narrow street between two rows of cards.
  const list = [box('a1', 0, 0), box('a2', 0, 100), box('m1', 300, 0, 224, 80), box('m2', 300, 96, 224, 80), box('z1', 700, 0), box('z2', 700, 100)];
  const b = boxes(list), es = [edge('a1', 'z2'), edge('a2', 'z1')];
  const before = new Map([...b].map(([k, v]) => [k, { ...v }]));
  const strips = openCorridors(b, es);
  const after = crowdedAt(routeEdges(b, es), es);
  const len = c => c.reduce((s, x) => s + x.len, 0);
  assert.ok(len(after) <= len(crowdedAt(routeEdges(new Map([...before].map(([k, v]) => [k, { ...v }])), es), es)));
  const bs = [...b.values()];
  for (const p of bs) for (const q of bs) if (p !== q) assert.ok(!(p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h), `${p.id} over ${q.id}`);
  for (const [k, v] of b) { assert.ok(v.x >= before.get(k).x && v.y >= before.get(k).y, 'boxes only move away (down or right)'); assert.equal(v.w, before.get(k).w); }
  assert.deepEqual(stripShift(strips, 0, -10), { x: 0, y: -10 }, 'nothing before a strip moves');
});

test('BV2B-7 the lens contract: each lens names its foreground lines; the background stays visible; selection lifts its lines', () => {
  const l = (channel, from = 'a', to = 'b') => ({ key: `${from}${to}${channel}`, channel, from, to });
  assert.equal(lensLineFg('data', l('data')), true); assert.equal(lensLineFg('data', l('control')), false);
  assert.equal(lensLineFg('start', l('control')), true); assert.equal(lensLineFg('start', l('data')), false);
  assert.equal(lensLineFg('compose', l('data')), false); assert.equal(lensLineFg('compose', l('data'), { selected: 'a' }), true);
  assert.equal(lensLineFg('state', l('data')), false, '상태·공백: ordinary relations are background');
  assert.equal(lensLineFg('scenario', l('data')), false); assert.equal(lensLineFg('scenario', l('data'), { path: new Set(['abdata']) }), true);
  assert.equal(lensLineFg('state', l('control'), { picked: new Set(['abcontrol']) }), true, 'a selected relation is always foreground');
  for (const id of ['compose', 'data', 'start', 'state', 'scenario']) for (const v of Object.values(lensLook(id).lines)) assert.ok(v >= BG_LINE, `${id}: background never fainter than ${BG_LINE}`);
  assert.match(css, /\.space \.world \.edge\.lf-fg \{ --bw: 2\.25; \}/);
});

test('BV2B-8 layout: a gap that lines must pass is widened before routing (columns apart by laneRoom of the lines through them)', () => {
  // One source, six targets in the next layer: six lines turn in the one gap between the two columns.
  const parts = [{ id: 's', name: 'S', note: '', status: 'plan', parentId: null, childIds: [], records: [] },
    ...Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, name: `T${i}`, note: '', status: 'plan', parentId: null, childIds: [], records: [] }))];
  const v = { parts, roots: parts.map(p => p.id), relations: parts.slice(1).map((p, i) => ({ id: `r${i}`, from: 's', to: p.id, kind: 'flow', note: '' })) };
  const L = layoutScope(v, null, () => false, {});
  const s = L.boxes.get('s'), t = [...L.boxes.values()].filter(b => b.id !== 's');
  const gap = Math.min(...t.map(b => b.x)) - (s.x + s.w);
  // (a line level with its partner turns nowhere, so five or six of them need a track)
  assert.ok(gap >= laneRoom(5) - 0.5, `gap ${gap} >= ${laneRoom(5)}`);
});

// Beauty v2 review (H1, H4): the strips belong to the automatic arrangement. Laid again (applyStrips) on the same parts they give the
// same places; a part the person placed keeps the place it was put at, and the others stand where they stood before the drag.
test('BV2B-9 strips laid again give the automatic places; a placed part is kept and the others do not move; found once per arrangement', () => {
  const list = () => [box('a1', 0, 0), box('a2', 0, 100), box('m1', 300, 0, 224, 80), box('m2', 300, 96, 224, 80), box('z1', 700, 0), box('z2', 700, 100)];
  const es = [edge('a1', 'z2'), edge('a2', 'z1')];
  const auto = boxes(list()), strips = openCorridors(auto, es);
  const again = boxes(list()); applyStrips(again, strips);
  for (const [k, v] of auto) assert.deepEqual([again.get(k).x, again.get(k).y, again.get(k).rel], [v.x, v.y, v.rel], `${k} as the automatic arrangement`);
  // The person dragged z2 after the strips had moved it: its stored place is in the opened map's coordinates and is kept as it is.
  const placed = boxes(list().map(b => (b.id === 'z2' ? { ...b, x: auto.get('z2').x + 30, y: auto.get('z2').y + 24, rel: { x: auto.get('z2').x + 30, y: auto.get('z2').y + 24 } } : b)));
  applyStrips(placed, strips, new Set(['z2']));
  for (const [k, v] of auto) if (k !== 'z2') assert.deepEqual([placed.get(k).x, placed.get(k).y], [v.x, v.y], `${k} stands where it stood`);
  assert.deepEqual([placed.get('z2').x, placed.get('z2').y], [auto.get('z2').x + 30, auto.get('z2').y + 24], 'the placed part is where it was put');
  const app = readFileSync(new URL('../src/client/app.ts', import.meta.url), 'utf8'), room = app.slice(app.indexOf('function openRoom('), app.indexOf('function openRoom(') + 1800);
  assert.ok(room.includes('applyStrips(lay.boxes, strips, mine)') && room.includes('roomMemo?.sig === sig'), 'openRoom lays the arrangement\'s strips, found once per arrangement');
  assert.ok(!/if \(dragQuick \|\| Object\.keys\(held/.test(room), 'a place of the person\'s no longer turns the strips off');
});

// Beauty v2 review (H3, visual 4): the lines seen beside a selection are routed together, and a picked line is singled out.
test('BV2B-10 a selection\'s lines and the summary beside it are routed as one set; a picked line is 3px in the accent, the others step back', () => {
  const app = readFileSync(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  const shown = app.slice(app.indexOf('function routeShown('), app.indexOf('function routeShown(') + 3200);
  assert.ok(shown.includes('routeEdges(lay.boxes, set)') && shown.includes("'sel-sum'"), 'one routing for what is seen');
  assert.ok(/function markSelection[\s\S]*?routeShown\(\);[\s\S]*?markPicked\(\);/.test(app));
  assert.match(css, /\.space \.world \.edge\.picked \{ --bw: 3; \}/);
  assert.match(css, /\.space\.line-picked \.world \.edge\.on:not\(\.picked\) \{ --bw: 2\.25; \}/);
});
