// Beauty v3 review fixes: a reserved route belongs to the automatic arrangement (a placed part's lines search their own); the layout's
// aspect step keeps across a small resize (hysteresis); one long chain folds onto a second row, both read left to right; separate
// chains in a group never become one list; the fit labels of every lens are measured as drawn, carry one 「…」 at most, never say that
// the record lacks words, and the rest labels, counts and port marks give way under a lens only to that lens's labels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProject, addArea, addChildArea, addRelation } from '../dist/public/shared/domain.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope, stickyAspect, quantAspect, ASPECTS, ASPECT_HYST } from '../dist/public/client/map-layout.js';
import { layered } from '../dist/public/client/layered.js';

function chain(n) {
  let p = createProject();
  for (let i = 0; i < n; i++) p = addArea(p, `부분 ${i + 1}`, '');
  const ids = p.space.areas.map(a => a.id);
  for (let i = 0; i + 1 < n; i++) p = addRelation(p, ids[i], ids[i + 1], 'flow');
  return { p, ids };
}

test('a line with an end the person placed has no reserved route; the others keep theirs', () => {
  const { p, ids } = chain(4), v = studioView(p);
  const auto = layoutScope(v, null, () => true, {});
  const keyOf = (a, b) => [...auto.channels.keys()].find(k => k.startsWith(`${a}|${b}|`));
  assert.ok(keyOf(ids[0], ids[1]) && keyOf(ids[1], ids[2]) && keyOf(ids[2], ids[3]), 'the automatic arrangement reserves a route for each line');
  // Stored where the arrangement put it: nothing changes.
  const same = layoutScope(v, null, () => true, { root: { [ids[1]]: { ...auto.boxes.get(ids[1]).rel } } });
  assert.equal(same.channels.size, auto.channels.size);
  // Dragged away: its two lines search their own route; the third keeps its reserved one.
  const r = auto.boxes.get(ids[1]).rel, moved = layoutScope(v, null, () => true, { root: { [ids[1]]: { x: r.x - 300, y: r.y - 400 } } });
  assert.ok(!moved.channels.has(keyOf(ids[0], ids[1])) && !moved.channels.has(keyOf(ids[1], ids[2])), 'the moved part\'s lines drop the stale route');
  assert.ok(moved.channels.has(keyOf(ids[2], ids[3])), 'a line between two automatically placed parts keeps its route');
});

test('the aspect step keeps across a one-pixel resize over a midpoint, and changes once past it by the margin', () => {
  for (let i = 0; i + 1 < ASPECTS.length; i++) {
    const a = ASPECTS[i], b = ASPECTS[i + 1], mid = (a + b) / 2;
    assert.equal(stickyAspect(mid + 0.001, a), a, `kept at ${a} just past ${mid}`);
    assert.equal(stickyAspect(mid - 0.001, b), b, `kept at ${b} just under ${mid}`);
    assert.equal(stickyAspect(mid + ASPECT_HYST + 0.01, a), b);
    assert.equal(stickyAspect(mid - ASPECT_HYST - 0.01, b), a);
  }
  assert.equal(stickyAspect(2.15, null), quantAspect(2.15), 'with no step yet: the nearest');
  assert.equal(stickyAspect(3, 1.4), 2.4, 'far away: the nearest');
});

// Beauty v4 (P4): the line across the fold has a reserved route inside the drawing (out past the first row's end, along the space between
// the rows, back in at the second row's start, one lane in), never round the top or the bottom.
test('one long chain folds onto a second row under its first half; both rows read left to right; the line across turns inside the drawing', () => {
  const N = (id, order) => ({ id, w: 224, h: 80, anchor: 40, order });
  const ns = Array.from({ length: 10 }, (_, i) => N(`n${i}`, i)), es = ns.slice(1).map((n, i) => ({ key: `n${i}|${n.id}|d`, from: `n${i}`, to: n.id, kind: 'drive', weight: 1, relIds: [`r${i}`] }));
  const opt = { layerGap: 76, rowGap: 22, laneMargin: 14, laneTrack: 10, aspect: 2, wrapGap: 36 };
  const flat = layered(ns, es, opt), folded = layered(ns, es, { ...opt, spend: true });
  assert.ok(flat.size.w / flat.size.h > 8, 'unfolded: one row');
  assert.ok(folded.size.w <= flat.size.w * 0.6, `folded width ${folded.size.w} of ${flat.size.w}`);
  assert.ok(Math.abs(Math.log(folded.size.w / folded.size.h / 2)) < Math.abs(Math.log(flat.size.w / flat.size.h / 2)), 'nearer the window\'s shape');
  const ys = [...new Set(ns.map(n => folded.pos.get(n.id).y))].sort((a, b) => a - b);
  assert.equal(ys.length, 2, 'two rows');
  const rowOf = id => ys.indexOf(folded.pos.get(id).y), cut = ns.findIndex(n => rowOf(n.id) === 1);
  assert.ok(cut > 2 && cut < 8, `cut after ${cut}`);
  for (let i = 1; i < ns.length; i++) {
    assert.equal(rowOf(ns[i].id) >= rowOf(ns[i - 1].id), true, 'the first row first');
    if (i !== cut) assert.ok(folded.pos.get(ns[i].id).x > folded.pos.get(ns[i - 1].id).x, `left to right at ${i}`);
  }
  const lane = 30; // laneRoomOf(1, 14, 10): the second row starts one lane in, the line across turns down in that lane
  assert.equal(folded.pos.get(ns[cut].id).x, lane, 'the second row starts one lane in from the left edge');
  const across = folded.channels.get(es[cut - 1].key);
  assert.ok(across, 'the line across the fold has its reserved route');
  const y0 = Math.min(...ns.map(n => folded.pos.get(n.id).y)), y1 = Math.max(...ns.map(n => folded.pos.get(n.id).y + 80));
  assert.ok(across.ys.every(y => y > y0 && y < y1) && across.xs.every(x => x >= 0 && x <= folded.size.w), 'inside the drawing, never round it');
  assert.ok(across.ys.some(y => y > folded.pos.get(ns[cut - 1].id).y + 80 && y < folded.pos.get(ns[cut].id).y), 'along the space between the rows');
  assert.equal(folded.channels.size, es.length);
  // A drawing that already fits the window's shape never folds.
  const short = layered(ns.slice(0, 4), es.slice(0, 3), { ...opt, spend: true });
  assert.equal(new Set(ns.slice(0, 4).map(n => short.pos.get(n.id).y)).size, 1);
});

test('separate chains inside a group keep their own blocks (never one list of steps)', () => {
  let p = createProject();
  p = addArea(p, '묶음', ''); const g = p.space.areas[0].id;
  for (const n of ['a', 'b', 'c', 'd']) p = addChildArea(p, g, n);
  const id = n => p.space.areas.find(x => x.name === n).id;
  p = addRelation(p, id('a'), id('b'), 'flow'); p = addRelation(p, id('c'), id('d'), 'flow');
  const L = layoutScope(studioView(p), null, () => true, {}), at = n => L.boxes.get(id(n));
  // Each chain runs in its own direction (a beside b, c beside d), not as one column a, b, c, d.
  const xs = new Set(['a', 'b', 'c', 'd'].map(n => at(n).x));
  assert.ok(xs.size >= 2, 'not one column of four');
  assert.ok(at('b').x !== at('a').x || at('b').y > at('a').y, 'a then b');
});

test('fit labels: measured as drawn, one 「…」 at most, no note of missing words, and the rest give way under a lens only', async () => {
  const app = await readFile(new URL('../dist/public/client/app.js', import.meta.url), 'utf8'), css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const body = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(j, k + 1); } return ''; };
  const fit = body('placeFitLabels');
  assert.ok(fit.indexOf("style.display = 'block'") >= 0 && fit.indexOf("style.display = 'block'") < fit.indexOf('offsetWidth'), 'a label of a lens not on now is shown while it is measured (display:none measures 0 × 0)');
  assert.ok(fit.includes('COND_UNSAID'), 'the note that the record holds no words never becomes a label');
  assert.match(css, /\.edge-labels > \.edge-label\.fit\[data-full\]::after \{ content: none; \}/, 'a cut fit label carries its own 「…」 only');
  for (const l of ['data', 'start', 'scenario', 'compose']) assert.ok(css.includes(`.space.lens-${l} .edge-labels > .edge-label.fit[data-lens="${l}"]`) && css.includes(`[data-fit~="${l}"]`), `${l}: its own labels, and what gives way to them`);
  // The rest labels of a line labelled under some lens are still placed (구성 keeps them).
  const rest = body('placeLineLabels');
  assert.ok(!rest.includes('fitAny'), 'no line loses its rest label for a label of a lens that is not on');
});

test('port marks: apart from each other, off the labels and other lines when they can, at the source side', async () => {
  const app = await readFile(new URL('../dist/public/client/app.js', import.meta.url), 'utf8');
  const i = app.indexOf('function placeCue('), b = app.slice(i, app.indexOf('\n}', i));
  assert.ok(/apart\(r\)/.test(b) && /offLabels\(r\)/.test(b) && /offLines\(r\)/.test(b), 'the mark checks its neighbours');
  assert.ok(!/void apart/.test(b));
});
