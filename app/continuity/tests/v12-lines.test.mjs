// v12 lines (blind judges preferred every relation drawn over v11's static focus on 14 of 16 map votes): the opening view draws every
// relation with 먼저 볼 연결 over them, the static focus is a choice beside the count, every card with folded relations keeps its cue, the
// two lines of a pair running opposite ways stand apart, a label is whole or folds to its cue, a ◇ keeps its own target, a condition never
// gives way to a chip, one width for the background, a picked card's direct relations only, no pan for a card the pane does not cover.
// Each test fails on v11. Fictional strings only.
// No browser: the pure parts run as built; the DOM code that uses them is read from the source (the rendered pages are checked by the
// headless checker of this round).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as FF from '../dist/public/client/first-flow.js';
import * as R from '../dist/public/client/map-route.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));

test('V12-1 the focus view the person chooses gives every card with folded direct relations its own count, a focus card or not', () => {
  // The view: oven → shelf. A mixer feeds a till (no focus card on that line), the oven feeds the bin.
  const lines = [
    { key: 'v', from: 'oven', to: 'shelf', ids: ['r1'], flow: true },
    { key: 'b', from: 'oven', to: 'bin', ids: ['r2'], flow: false },
    { key: 'd', from: 'mixer', to: 'till', ids: ['r3', 'r4'], flow: false },
  ];
  const f = FF.focusFold(['oven', 'shelf'], lines, new Set(), true);
  assert.deepEqual([...f.hide].sort(), ['b', 'd']);
  assert.equal(f.byCard.get('mixer'), 2, 'v11: a hub off the view kept no line and no cue');
  assert.equal(f.byCard.get('till'), 2);
  assert.equal(f.byCard.get('bin'), 1);
  assert.equal(f.byCard.get('oven'), 1);
  assert.ok(!f.byCard.has('shelf'), 'a card with nothing folded carries no chip');
  // Any card's chip opens its lines in place.
  const o = FF.focusFold(['oven', 'shelf'], lines, new Set(['mixer']), true);
  assert.deepEqual([...o.hide], ['b']);
  assert.equal(o.opened.get('mixer'), 2);
  assert.deepEqual([o.shown, o.total], [3, 4]);
  assert.equal(FF.FOCUS_ONLY_WORD, '먼저 볼 연결만');
  assert.equal(FF.ALL_RELATIONS_WORD, '전체 관계');
});

test('V12-2 the opening view draws every relation; 「먼저 볼 연결만」 / 「전체 관계」 is a per-map choice never stored', async () => {
  const a = await app(), fold = fn(a, 'foldHubs'), top = fn(a, 'renderFocusTop'), only = fn(a, 'chooseOnly'), draw = fn(a, 'drawFocus');
  assert.match(fold, /if \(!o \|\| !f \|\| !ffActive\(\) \|\| ffLensPicked \|\| !ffOnly\(\)\) return;/, 'v11 folded at rest');
  assert.match(fold, /const fold = focusFold\(cards, ls, ffOpen, true\);/);
  assert.match(top, /btn\('ft-only', FOCUS_ONLY_WORD, [^\n]*\{ 'aria-pressed': String\(only\) \}\)/);
  assert.match(top, /btn\('ft-all', ALL_RELATIONS_WORD, [^\n]*\{ 'aria-pressed': String\(!only\) \}\)/);
  assert.match(top, /\.\.\.countEls\(\), choice\);/, 'beside the count (「표시 n/N」)');
  assert.match(a, /const ffOnlyMaps = new Set<string>\(\);/);
  assert.doesNotMatch(only, /saveFirstView|localStorage|writeFirstView/, 'never restored after a reload');
  assert.match(only, /if \(on\) ffOnlyMaps\.add\(o\.key\); else ffOnlyMaps\.delete\(o\.key\);/);
  assert.doesNotMatch(draw, /f\.soft \? 'ff-ctx' : 'ff-flow'/, 'v11 drew a recorded start\'s fan at 2.25 beside 3px lines');
});

test('V12-3 two lines of one pair running opposite ways stand pairGap apart at both cards, the side\'s other ends kept in order', () => {
  const box = (id, x, y, h = 80) => ({ id, x, y, w: 224, h, kind: 'node', depth: 0, container: '', kids: 0, head: 0, rel: { x, y } });
  const boxes = new Map([['a', box('a', 0, 0)], ['b', box('b', 400, 0)], ['c', box('c', 400, 200)]]);
  const e = (key, from, to) => ({ key, from, to, kind: 'flow', notes: [], ids: [key], agg: false });
  const edges = [e('ab', 'a', 'b'), e('ba', 'b', 'a'), e('ac', 'a', 'c')];
  const apart = (m, end) => Math.abs(m.get('ab').pts[end === 'a' ? 0 : m.get('ab').pts.length - 1].y - (end === 'a' ? m.get('ba').pts.at(-1).y : m.get('ba').pts[0].y));
  const plain = R.routeEdges(boxes, edges), wide = R.routeEdges(boxes, edges, { pairGap: 26 });
  assert.ok(apart(plain, 'a') < 20, `the map's own pitch: ${apart(plain, 'a')}`);
  assert.ok(apart(wide, 'a') >= 25.5 && apart(wide, 'b') >= 25.5, `v11 kept a port pitch (12, 6px at a half-size fit): ${apart(wide, 'a')} / ${apart(wide, 'b')}`);
  // Inside the cards' corners (8 from each end of the side).
  for (const k of ['ab', 'ba']) for (const p of [wide.get(k).pts[0], wide.get(k).pts.at(-1)]) assert.ok(p.y >= 8 - 0.01 && p.y <= 72 + 0.01, JSON.stringify(p));
  // A side with no room for the whole gap takes as much as it has (a 40-high card: 24 inside its corners; v13 C: 34 once the run may reach
  // PAIR_INSET from them).
  const small = new Map([['a', box('a', 0, 0, 40)], ['b', box('b', 400, 0, 40)]]);
  const s2 = R.routeEdges(small, edges.slice(0, 2), { pairGap: 40 });
  const d = Math.abs(s2.get('ab').pts[0].y - s2.get('ba').pts.at(-1).y);
  assert.ok(d >= 24 - 0.01 && d <= 40 - 2 * R.PAIR_INSET + 0.01, String(d));
  // The page asks for 12.5 screen pixels at the fit's zoom, and routes again once the fit knows it.
});

test('V12-4 the page routes for the fit: PAIR_PX on screen at the zoom the map fits at', async () => {
  const a = await app(), fit = fn(a, 'fitView'), pr = fn(a, 'pairRoute'), pw = fn(a, 'positionWorld');
  assert.match(a, /const PAIR_PX = 13\.5;/, 'v13 fix 1: a little over the 12');
  assert.match(pr, /const want = Math\.max\(PAIR_PX \/ Math\.max\(camera\.k, 0\.05\), 12\);/);
  assert.match(fit, /if \(pairRoute\(explicit, animate\)\) return;/);
  assert.match(pw, /routeKept\(lay\.boxes, lay\.edges, \{ quick: dragQuick, pairGap: pairGapNow, pitch: formPitch\(\) \}\)/, 'v13 fix 1: a 보기 asks its own pitch (v13 fix 2: kept by its input)');
});

test('V12-5 a line\'s label is its words whole or its relation-detail cue: never cut, never one side of an OR', async () => {
  const a = await app(), rest = fn(a, 'placeRestLabels'), fit = fn(a, 'placeFitLabels'), whole = fn(a, 'fillWhole'), lab = fn(a, 'placeLineLabels'), marks = fn(a, 'placeFocusMarks');
  assert.ok(whole.length > 0, 'v11 cut labels to 14 or 8 characters with 「…」 (「보고서 → pdf…」)');
  assert.match(whole, /!text\.includes\('…'\) && fillLabel\(el, text\) && el\.textContent === text && !\(el\.isConnected && el\.scrollWidth > el\.clientWidth \+ 1\)/);
  assert.doesNotMatch(rest, /wholeWords\(/, 'v11: 「Promise 이행 또는」 (the middle tier\'s whole-word cut)');
  assert.match(rest, /const shortWord = \(w: string\) => \{ if \(w\.length <= LABEL_SHORT\) return w;/);
  assert.match(rest, /const m = fillWhole\(el, f\) \? spotsFor\(el\) : \[\];/); // v14 fix 2: each form whole or none
  assert.doesNotMatch(fit, /fitCut\(/);
  assert.match(fit, /if \(!\(cond \? fillLabel\(el, text\) : fillWhole\(el, text\)\)\) return;/);
  assert.match(lab, /fits = fillWhole\(label, text\)/);
  assert.doesNotMatch(marks, /clipKeepPlan\(text, 48/, 'v11 clipped a note to 48 characters (「hyperfine <command>... (」)');
  assert.doesNotMatch(marks, /tokenCut\(t1, n\)/);
});

test('V12-6 each ◇ keeps its own 24 × 24 target clear of cards, heads and the other marks; else one 「조건 n」 mark lists them all', async () => {
  const a = await app(), cue = fn(a, 'placeCue'), acc = fn(a, 'foldAccess');
  assert.match(a, /const CUE_HIT = 24;/);
  assert.match(cue, /const hitFree = \(r: Rect\) => \{ const t = hitOf\(r\); return !parts\.some\(o => touch\(t, o\)\) && !others\.some\(o => touch\(t, o\.r\)\) && offHeads\(r\); \};/, 'v11: a ◇ 7px from another opened the wrong condition; four sat under cards');
  assert.match(cue, /same\.classList\.add\('q-stack'\)/);
  assert.match(cue, /`조건 \$\{n\}`/);
  assert.match(acc, /el\.classList\.contains\('q-stack'\) \?/, 'its keyboard name says every condition');
  assert.match(a, /if \(el\?\.classList\.contains\('q-stack'\)\) for \(const k of/, 'its tip lists every line');
  const s = await css();
  assert.match(s, /\.edge-labels > \.edge-cue::after \{ inset: -8px; \}/);
  assert.match(s, /\.edge-cue\.q-stack \.cue-n \{/);
});

test('V12-7 a condition never gives way to a chip; a chip never goes over another chip while a place free of chips is left', async () => {
  const marks = fn(await app(), 'placeFocusMarks');
  assert.match(marks, /const condMark = \(el: HTMLElement\) => el\.matches\('\.q-condition, \.fit-cond, \.b-condition, \.ff-branch'\);/);
  assert.match(marks, /if \(gave\) for \(const m of marks\) if \(!condMark\(m\.el\) && meets\(at, m\.r\)\) m\.el\.classList\.add\('ff-gave'\);/, 'v11: dagu at 1280, the ◇ of 스케줄러 → 코디네이터 under a chip');
  assert.match(marks, /all\.find\(r => noChip\(r\) && noCond\(r\) && \(!clean \|\| clean\(r\)\)\)/);
});

test('V12-8 one width at rest for every relation not of the view (1.15px), the view 3px; a picked card\'s direct relations only', async () => {
  const s = await css(), a = await app(), sel = fn(a, 'markSelection'), fold = fn(a, 'foldHubs');
  assert.match(s, /#space\.ff-even\.ff-rest \.world \.edge:not\(\.ff-flow\)[^{]*\{ --bw: 1\.15; \}/, 'v11 drew 2px lines under a lens beside 1.15px ones');
  assert.match(s, /#space\.sel-fold \.world \.edge:not\(\.on\) \{ display: none; \}/, 'v11 drew a picked card\'s neighbours\' lines faint');
  assert.match(a, /sp\.classList\.toggle\('ff-even', !!o && !ffLensPicked && !scope && !scView && !!o\.view\.parts\.length\);/);
  assert.match(sel, /\$\('space'\)\.classList\.toggle\('sel-fold', !!me && selFolds\(\)\);/);
  assert.match(fold, /if \(o && selFolds\(\)\) \{ ffCount = \{ shown: new Set\(/, 'the count says how many are drawn');
});

test('V12-9 picking a card moves the camera only when the card itself would be covered, by the least amount', async () => {
  const rv = fn(await app(), 'reveal');
  assert.doesNotMatch(rv, /ends/, 'v11 panned 157px to bring the other ends beside the pane');
  assert.match(rv, /revealRect\(\{ x: x0, y: b\.y, w: x1 - x0, h: Math\.min\(b\.h, 300\) \}\);/, 'v13 fix 1: the card with its own runs beside it');
});

test('V12-10 the caption over unlinked cards counts for the fit; Enter on a mark keeps the hover closed while the map redraws', async () => {
  const a = await app();
  assert.match(a, /const ftObstacles = \(\): Rect\[\] => \[[^\n]*\.\.\.loneRects\(\)\];/, 'v11: dagu at 1280, 「이은 선 없음 · 2」 half under the top box');
  assert.match(fn(a, 'loneRects'), /el\.offsetTop \+ el\.offsetHeight - hh/, 'as drawn: scaled from its bottom left');
  assert.match(a, /hoverStop\(HOVER_ENTER_HOLD\); pickLine\(edge\); requestAnimationFrame\(\(\) => hoverStop\(HOVER_ENTER_HOLD\)\);/);
});
