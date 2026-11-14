// v13 fix round 1 (review of v13-merged bbc44677): the opening walks only an order the record states, the rest recedes and lines wait for
// their cards, versions passed over read as passed over, an input that ends the opening does nothing else, the budget counts from the ask;
// 다시 보기 only where it plays; a crowded side and a face part every opposite pair; a 보기's ends stand a head apart; a condition's mark
// slides along its line before it steps back; a ◇ looks for a place no line crosses first; a picked card keeps its own runs in view; the
// switch flies before anything heavy runs; 쉽게 calls the lens 「역할」; a tag line that repeats the name is left off.
// Each test fails on v13-merged (bbc44677). Fictional strings only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as O from '../dist/public/client/opening.js';
import * as R from '../dist/public/client/map-route.js';
import * as S from '../dist/public/client/port-slots.js';
import * as W from '../dist/public/client/word-level.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf('\n}\n', i)); };

/* A fictional bakery: a frame "kitchen" with oven and mixer, a till, a shelf, a courier. */
const boxes = [{ id: 'kitchen', container: null }, { id: 'oven', container: 'kitchen' }, { id: 'mixer', container: 'kitchen' }, { id: 'till', container: null }, { id: 'shelf', container: null }, { id: 'courier', container: null }];
const edges = [{ key: 'e1', ids: ['r1'], from: 'mixer', to: 'oven' }, { key: 'e2', ids: ['r2'], from: 'oven', to: 'shelf' }, { key: 'e3', ids: ['r3'], from: 'till', to: 'courier' }, { key: 'e4', ids: ['r9'], from: 'shelf', to: 'till' }];
const drawn = new Set(boxes.map(b => b.id));
const base = { boxes, edges, rep: id => (drawn.has(id) ? id : null), names: new Map(), versions: [] };

test('V13X-1 the opening walks only an order 보기 calls a flow (three steps or more); two steps are no recorded order (v14: they grow in the record\'s order)', async () => {
  const two = O.openingPlan({ ...base, chain: [['mixer'], ['oven']], chainRels: ['r1'] });
  assert.equal(two.kind, 'order'); assert.ok(two.beats.every(b => b.caption !== O.CHAIN_CAPTION));
  assert.equal(O.CHAIN_MIN_STEPS, 3);
  const three = O.openingPlan({ ...base, chain: [['mixer'], ['oven'], ['shelf']], chainRels: ['r1', 'r2'] });
  assert.equal(three.kind, 'chain');
  // The app hands it 보기's recorded order (map-forms recordedChain), never the first view's drawn chain.
  const a = await app();
  assert.match(a, /const chain = formInfo && formInfo\.view === o\.view \? formInfo\.chain : null;/);
  assert.doesNotMatch(a, /const f = ffNow\?\.flow \?\? null;\n\s*return \{ boxes, edges, names, versions/);
});

test('V13X-2 after the chain the rest comes in receded (cards and their lines) and reaches full strength as the map lands', async () => {
  const p = O.openingPlan({ ...base, chain: [['mixer'], ['oven'], ['shelf']], chainRels: ['r1', 'r2'] });
  const rest = p.beats.at(-1);
  assert.deepEqual(new Set(rest.dim), new Set(['till', 'courier']), 'the chain\'s cards (and the frame they sit in) stay lit');
  assert.deepEqual(new Set(rest.dimLines), new Set(['e3', 'e4']), 'the chain\'s own lines stay lit');
  const c = await css();
  assert.match(c, /#space #world > \.node\.op-dim, #space #world > \.frame\.op-dim \{ opacity: \.42; filter: saturate\(\.4\); \}/);
  const src = await readFile(new URL('../src/client/opening.ts', import.meta.url), 'utf8');
  assert.match(src, /host\.world\(\)\.querySelectorAll\('\.op-dim'\)\.forEach\(el => el\.classList\.remove\('op-dim'\)\);/, 'removed as it lands');
});

test('V13X-3 lines draw once their cards have come in, inside the beat; the cards come in faster while it plays', async () => {
  assert.ok(O.CARD_IN_MS >= 180 && O.CARD_IN_MS + O.LINE_MS <= O.BEAT_MIN_MS, `${O.CARD_IN_MS}`);
  const src = await readFile(new URL('../src/client/opening.ts', import.meta.url), 'utf8');
  assert.match(src, /if \(g\) drawLine\(g\); \} \}, CARD_IN_MS\)\);/);
  assert.match(await css(), /#space\.op-run #world > \.node, #space\.op-run #world > \.frame \{ transition-duration: [^}]*\.2s, \.2s/);
});

test('V13X-4 a version passed over stays a hollow tick, never one that was shown', async () => {
  const shown = new Set([1, 3, 7]);
  assert.equal(O.tickState(2, 7, shown), 'skip');
  assert.equal(O.tickState(3, 7, shown), 'past');
  assert.equal(O.tickState(7, 7, shown), 'now');
  assert.equal(O.tickState(9, 7, new Set([1, 7, 9])), 'ahead');
  assert.match(await css(), /\.op-tick\.skip \{[^}]*background: var\(--surface\)/);
});

test('V13X-5 an input that ends the opening does nothing else on the map: no zoom, no pick; the header\'s controls and modified keys still act', async () => {
  assert.equal(O.skipTake('wheel', true, false), 'eat');
  assert.equal(O.skipTake('pointerdown', true, false), 'eat');
  assert.equal(O.skipTake('pointerdown', false, false), 'pass');
  assert.equal(O.skipTake('keydown', false, false), 'eat');
  assert.equal(O.skipTake('keydown', false, true), 'pass');
  const src = await readFile(new URL('../src/client/opening.ts', import.meta.url), 'utf8');
  assert.match(src, /window\.addEventListener\(t, h, \{ capture: true, passive: false \}\)/);
  assert.match(src, /e\.stopImmediatePropagation\(\); if \(e\.cancelable\) e\.preventDefault\(\);/);
  assert.match(src, /tails = \['pointerup', 'mouseup', 'click', 'dblclick'\]/, 'the press\'s release and click are taken too');
});

test('V13X-6 the 4.5 s count from when the map was asked for; the typing keeps to its share', async () => {
  const a = await app();
  assert.match(a, /const askedAt = performance\.now\(\);/);
  assert.match(a, /opening\.arrive\(o\.key, openingVersion\(o\), askedAt\)/);
  const src = await readFile(new URL('../src/client/opening.ts', import.meta.url), 'utf8');
  assert.match(src, /const t0 = since !== undefined && since <= performance\.now\(\) \? since : performance\.now\(\);/);
  assert.ok(O.typeLength(500) <= O.TYPE_MAX_MS && O.typeLength(10) === 10 * O.TYPE_CHAR_MS);
  // 17 versions on a budget cut by a 1.1 s draw still land within 4.5 s from the ask.
  const many = []; for (let n = 1; n <= 17; n++) many.push({ n, parts: [{ id: 'kitchen', name: '주방' }, ...(n >= 3 ? [{ id: 'oven', name: '오븐' }] : []), ...(n >= 9 ? [{ id: 'shelf', name: '진열대' }] : [])], rels: n >= 5 ? ['r1'] : [], retired: [] });
  const p = O.growthPlan({ ...base, versions: many }, O.OPEN_TOTAL_MS - 1100);
  assert.ok(O.openingLength(p) + 1100 <= O.OPEN_TOTAL_MS + 1, `${O.openingLength(p) + 1100}`);
});

test('V13X-7 다시 보기 is not offered while comparing or in a past version (it does nothing there)', async () => {
  assert.match(await app(), /opening\.offer\(!scope && !o\.past && !growthCmp && !growthPast && o\.view\.parts\.length > 0\)/);
});

test('V13X-8 a face parts an opposite pair pairGap apart; an end with two lines the other way keeps both apart', () => {
  assert.deepEqual(R.faceGaps([{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }], 24, 200), [0, 24]);
  assert.deepEqual(R.faceGaps([{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }], 24, 200), [0, 12]);
  // Past the face's room the pair takes what is left, never less than the pitch.
  const g = R.faceGaps([{ from: 'a', to: 'b' }, { from: 'x', to: 'y' }, { from: 'b', to: 'a' }], 40, 30);
  assert.ok(g[1] >= 12 && g[2] >= 12 && g[1] + g[2] <= 30 + 1e-9);
  // A card with two lines in from its neighbour and one out to it, all on facing sides: every opposite pair stands pairGap apart at both.
  const B = (id, x) => ({ id, x, y: 0, w: 224, h: 104, kind: 'node', container: '__root__', depth: 0, rel: { x, y: 0 }, head: 0 });
  const bx = new Map([['p', B('p', 0)], ['q', B('q', 420)]]);
  const E = (key, from, to) => ({ key, from, to, ids: [key], kind: 'flow', notes: [] });
  const out = R.routeEdges(bx, [E('q1', 'q', 'p'), E('q2', 'q', 'p'), E('p1', 'p', 'q')], { pairGap: 26 });
  const atP = { q1: out.get('q1').pts.at(-1).y, q2: out.get('q2').pts.at(-1).y, p1: out.get('p1').pts[0].y };
  assert.ok(Math.abs(atP.p1 - atP.q1) >= 26 - 0.6 && Math.abs(atP.p1 - atP.q2) >= 26 - 0.6, JSON.stringify(atP));
});

test('V13X-9 in a 보기 a side\'s ends stand a head apart on screen while the side holds them; 구성 keeps its pitch', async () => {
  const wide = S.sideSlots(3, 0, 104, 52, [], 8, [], [], 20);
  assert.deepEqual(wide.map((y, i) => (i ? y - wide[i - 1] : 0)), [0, 20, 20]);
  const plain = S.sideSlots(3, 0, 104, 52);
  assert.deepEqual(plain.map((y, i) => (i ? y - plain[i - 1] : 0)), [0, 12, 12]);
  const crowd = S.sideSlots(7, 0, 80, 40, [], 8, [], [], 20);
  assert.ok(crowd.every((y, i) => !i || y - crowd[i - 1] <= 12 + 1e-9), 'a crowded side spreads as before');
  const a = await app();
  assert.match(a, /const formPitch = \(\): number \| undefined => \(formPlace \? pairGapNow \* \(FORM_PORT_PX \/ PAIR_PX\) : undefined\);/);
  assert.match(a, /routeKept\(lay\.boxes, lay\.edges, \{ quick: dragQuick, pairGap: pairGapNow, pitch: formPitch\(\) \}\)/);
});

test('V13X-10 a condition\'s mark the map\'s edge would cut slides along its own line into view before it steps back', async () => {
  const a = await app(), c = fn(a, 'clipAtEdge'), s = fn(a, 'slideMark');
  assert.match(c, /if \(cut && \/\\b\(\?:b-condition\|q-condition\|fit-cond\)\\b\/\.test\(el\.className\) && slideMark\(el, r, vp, sr,/);
  assert.match(c, /if \(el\.dataset\.slid === `\$\{el\.style\.left\}\|\$\{el\.style\.top\}`\)/, 'only a mark still where it was slid goes back');
  assert.match(s, /cards\(\)\.some\(c => hits\(box, c\)\) \|\| marks\(\)\.some\(c => hits\(box, c\)\)/, 'never onto a card or another mark');
  // A picked card brings its own lines' runs beside it into view (never their far ends).
  assert.match(fn(a, 'reveal'), /p\.x <= b\.x \+ b\.w \+ REVEAL_RUN/);
});

test('V13X-11 a ◇ looks along its whole line and just beside it for a place no line crosses before it takes one a line crosses', async () => {
  const p = fn(await app(), 'placeCue');
  const i1 = p.indexOf('ex.along.find(r => base(r) && offLines(r)) ?? ex.beside.find(r => base(r) && offLines(r))'), i2 = p.indexOf('spot ??= all.find(r => base(r) && offLabels(r)) ?? all.find(base)');
  assert.ok(i1 > 0 && i2 > i1, 'line-free places first');
});

test('V13X-12 the switch flies at once in a layer of its own; the new form is drawn after the flight, not before it', async () => {
  const a = await app(), s = fn(a, 'setMapForm'), l = fn(a, 'landFormFlight');
  const fly = s.slice(s.indexOf('const fly = () => {'));
  assert.ok(fly.indexOf("layer.classList.add('flying')") < fly.indexOf("renderSpace('keep')"), 'the cards fly before the heavy redraw');
  assert.match(fly, /formSwitching = true; try \{ relayout\(o\); \} finally \{ formSwitching = false; \}/, 'only the layout is read before the flight');
  assert.match(fly, /\}, FORM_FLY_MS \+ 20\)\);/, 'the redraw waits for the landing');
  assert.match(l, /f\.layer\.remove\(\);/); assert.match(l, /world\.classList\.add\('animate', 'form-cam'\); writeCamera\(camera\);/);
  assert.match(await css(), /\.world\.form-flight\.flying > \[data-box\] \{ transition: transform \.52s/);
  assert.match(fn(a, 'pairRoute'), /formFitK\.set\(formFitKey\(opened, formNow\), \{ x: camera\.x, y: camera\.y, k: camera\.k \}\)/, 'a switch back flies to its frame and routes its lines once');
  assert.match(fly, /const fitted = formFitK\.get\(formFitKey\(o, next\)\);\n\s+const cam1 = fitted \?\? \{/);
});

test('V13X-13 쉽게 names the lens 「역할」 (「구성」 is the whole map\'s 보기); a tag line that only repeats the name is left off', async () => {
  assert.equal(W.EASY_LENS.compose, '역할');
  assert.notEqual(W.EASY_LENS.compose, '구성');
  const a = await app(), f = fn(a, 'fitTagKind');
  assert.match(f, /const k = k0\.text && tagName && same\(k0\.text, tagName\) \? \{ text: '', how: 'none' \} : k0/);
  assert.match(a, /h\('strong', \{\}, \(easy\(\) \? EASY_LENS\[a\.lens\] : null\) \?\? FIRST_LENS_NAME\[a\.lens\]\)/);
});

test('V13X-14 a line with no mark seen under the lens shown keeps the cue another lens placed for it', async () => {
  const a = await app(), f = fn(a, 'lensCueFallback');
  assert.match(f, /if \(k && !seen\.has\(k\) && \$\('world'\)\.querySelector\(`\.edge\[data-key="\$\{CSS\.escape\(k\)\}"\]`\)\) \{ c\.classList\.add\('lens-any'\); seen\.add\(k\); \}/);
  assert.match(fn(a, 'placeEdgeLabels'), /applyLegendMarks\(\); lensCueFallback\(\);/);
  assert.match(fn(a, 'applyLens'), /applyLegendMarks\(\); lensCueFallback\(\);/, 'a lens change looks again');
  assert.match(await css(), /\.edge-labels > \.edge-cue\.q-detail\[data-lens\]\.lens-any \{ display: block; \}/);
});

test('V13X-15 a side with an end tied to a port mark still parts an opposite pair among its free ends; tied ends count toward its budget', async () => {
  const B = (id, x, pins) => ({ id, x, y: 0, w: 224, h: 104, kind: 'node', container: '__root__', depth: 0, rel: { x, y: 0 }, head: 0, ...(pins ? { pins } : {}) });
  const bx = new Map([['p', B('p', 0, { 'rp|out': 80 })], ['q', B('q', 420)]]);
  const E = (key, from, to, ids) => ({ key, from, to, ids, kind: 'flow', notes: [] });
  const out = R.routeEdges(bx, [E('tied', 'p', 'q', ['rp']), E('back', 'q', 'p', ['x1']), E('fwd', 'p', 'q', ['x2'])], { pairGap: 26 });
  assert.equal(out.get('tied').pts[0].y, 80, 'the tied end stays at its pin');
  const gap = Math.abs(out.get('back').pts.at(-1).y - out.get('fwd').pts[0].y);
  assert.ok(gap >= 26 - 0.6, `${gap}`);
  const src = await readFile(new URL('../src/client/map-route.ts', import.meta.url), 'utf8');
  assert.match(src, /const n = Math\.max\(list\.length \+ \(paired \? tied\.get\(sk\) \?\? 0 : 0\) - sideBudget\(me\), cands\.filter\(x => x\.laid\)\.length\);/);
  assert.match(src, /const paired = pairGap > PORT_PITCH && list\.some\(/, 'only where pairs are parted');
});

test('V13X-16 comparing in the map\'s own frame, a card cut by the area\'s bottom edge comes up whole when nothing goes under the guide', async () => {
  const a = await app(), g = fn(a, 'growthClearGuide'), t = fn(a, 'cmpEdgeTidy');
  assert.match(g, /if \(!hits\(0, 0\)\) \{ if \(!still\) cmpEdgeTidy\(cards, view, hits\); return; \}/);
  assert.match(t, /c\.y \+ c\.h - bottom <= c\.h \* 0\.6/, 'only a card that mostly reads');
  assert.match(t, /if \(hits\(0, dy\)\) return;/, 'nothing under the guide');
  assert.match(t, /c\.y \+ dy < view\.y\)\) return;/, 'no whole card cut at the top');
});

test('V13X-17 a condition\'s mark wholly out of view on a line that runs in view comes into view along its line; a focus routed at its wider scale scales the 보기 pitch too', async () => {
  const c = fn(await app(), 'clipAtEdge');
  assert.match(c, /if \(!r\.width \|\| !\(r\.right <= vp\.left \|\| r\.left >= vp\.right \|\| r\.bottom <= vp\.top \|\| r\.top >= vp\.bottom\)\) continue;/);
  assert.match(c, /if \(!g \|\| getComputedStyle\(g\)\.display === 'none' \|\| g\.classList\.contains\('stub'\)\) continue;\n\s*slideMark\(el, r, vp, sr,/);
  const src = await readFile(new URL('../src/client/map-route.ts', import.meta.url), 'utf8');
  assert.match(src, /\.\.\.\(opts\.pitch \? \{ pitch: opts\.pitch \* c \} : \{\}\)/);
});

test('V13X-18 the two lines of a pair tied to one port mark stand pairGap apart across it (others PORT_FLOOR apart as before)', () => {
  const B = (id, x, pins) => ({ id, x, y: 0, w: 224, h: 104, kind: 'node', container: '__root__', depth: 0, rel: { x, y: 0 }, head: 0, ...(pins ? { pins } : {}) });
  const bx = new Map([['p', B('p', 0, { 'ra|out': 52, 'rb|in': 52 })], ['q', B('q', 420)]]);
  const E = (key, from, to, ids) => ({ key, from, to, ids, kind: 'flow', notes: [] });
  const out = R.routeEdges(bx, [E('go', 'p', 'q', ['ra']), E('back', 'q', 'p', ['rb'])], { pairGap: 30 });
  const gap = Math.abs(out.get('go').pts[0].y - out.get('back').pts.at(-1).y);
  assert.ok(gap >= 30 - 0.6, `${gap}`);
  const plain = R.routeEdges(bx, [E('go', 'p', 'q', ['ra']), E('back', 'q', 'p', ['rb'])], {});
  assert.equal(Math.abs(plain.get('go').pts[0].y - plain.get('back').pts.at(-1).y), 9, 'without a pair gap: PORT_FLOOR across the pin');
});
