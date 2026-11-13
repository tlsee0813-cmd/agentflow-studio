// Review of the v9 growth view (v10-growth): old names readable beside their cards, hub chips on their own card and never alone, notes that go
// on the next action and keep off the cards, tabs on their own card's edge, nothing but plain line runs under the guide, a folded condition as
// its ◇, the past view and the way back, the same tab rule on every map, the title chip's 기록 정보, the sentence's two lines. Each test fails on
// v9-merged. Fictional rectangles and the anonymised growth fixture only; the DOM wiring is read from the source. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as G from '../dist/public/shared/map-growth.js';
import * as V from '../dist/public/client/growth-view.js';
import * as F from '../dist/public/client/first-flow.js';
import { restCue, lineBadge } from '../dist/public/client/line-grammar.js';
import { growthFixture, fixtureProject } from './growth51-replay.mjs';

const read = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 2); };
const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('V10-1 an old name its card cannot show whole stands beside the card, and a hub chip never covers it', async () => {
  // The card's texts as drawn (its name, its old name under it) are what a chip keeps off: the straddling places that meet the old name go.
  const card = { x: 0, y: 0, w: 224, h: 80 }, w = 120, hh = 34, oldName = { x: 12, y: 60, w: 200, h: 18 };
  const spots = [{ x: card.w - w - 16, y: card.h - hh / 2 }, { x: card.w - w - 16, y: -hh / 2 }, { x: card.w - w, y: card.h + 2.5 }];
  const got = F.chipSpots(spots, w, hh, [{ x: 12, y: 8, w: 60, h: 20 }, oldName], card);
  assert.equal(got.some(p => meets({ ...p, w, h: hh }, oldName)), false, 'never over the old name');
  assert.deepEqual(got[0], spots[1], 'the upper edge, where no text is');
  const app = await read('src/client/app.ts'), css = await read('public/styles.css');
  assert.match(fn(app, 'placeOldNames'), /spans\.forEach\(x => x\.classList\.add\('cut'\)\)/);
  assert.match(fn(app, 'placeOldNames'), /h\('div', \{ class: 'growth-oldname', 'data-part': card\.dataset\.part!/);
  assert.match(fn(app, 'placeGrowthTabs'), /placeOldNames\(\); placeTabsNow\(world\);\n {2}if \(world\.querySelector\('\.ff-fold-chip'\)\) placeFocusMarks\(\);/);
  assert.match(fn(app, 'placeFocusMarks'), /for \(const el of world\.querySelectorAll<HTMLElement>\('\.growth-tab:not\(\[hidden\]\)'\)\) taken\.push\(/);
  assert.match(fn(app, 'placeFocusMarks'), /const titles: Rect\[\] = !ffFolds\.size \? \[\] : \[\.\.\.cardTexts\(world\), \.\.\.oldNameRects\(world\)\];/);
  assert.ok(css.includes('.node.card .c-oldname.cut { display: none; }'));
  assert.ok(css.includes('.space.face-tag .node.card .c-tag-text:has(.c-tag-old:not(.cut)) .c-tag-kind { display: none; }'));
});

test('V10-2 a hub chip touches its own card, and shows only while that card is seen', async () => {
  const card = { x: 100, y: 100, w: 200, h: 80 }, w = 80, hh = 30;
  // A place a gap under the card is not its card's (the chip read as nobody's under the top bar): only touching places are kept.
  const spots = [{ x: 220, y: 192 }, { x: 220, y: 182.5 }, { x: 302, y: 150 }];
  assert.deepEqual(F.chipSpots(spots, w, hh, [], card), [{ x: 220, y: 182.5 }, { x: 302, y: 150 }]);
  assert.equal(F.touchesCard({ x: 220, y: 192, w, h: hh }, card), false);
  // Seen: inside the window and not under the covers (the top box, the bars).
  const view = { x: 0, y: 52, w: 1280, h: 668 }, top = { x: 16, y: 68, w: 860, h: 90 };
  assert.equal(F.cardSeen({ x: 300, y: 10, w: 134, h: 48 }, view, []), false, 'above the window but a sliver');
  assert.equal(F.cardSeen({ x: 300, y: 80, w: 134, h: 48 }, view, [top]), false, 'under the top box');
  assert.equal(F.cardSeen({ x: 300, y: 140, w: 134, h: 48 }, view, [top]), true, 'its lower part shows');
  const app = await read('src/client/app.ts'), css = await read('public/styles.css');
  assert.match(fn(app, 'placeFocusMarks'), /w, hh, titles, \{ x: b\.x, y: b\.y, w: b\.w, h: b\.h \}\), 260 \* inv, own\);/);
  assert.match(fn(app, 'chipsSeen'), /chip\.classList\.toggle\('ff-alone', !s \|\| !cardSeen\(/);
  assert.match(fn(app, 'applyCamera'), /updateSticky\(\); chipsSeen\(\);/);
  assert.ok(css.includes('.ff-fold-chip.ff-alone, .world .growth-oldname.ff-alone { visibility: hidden; }'));
});

test('V10-3 a growth note goes on the next action and never covers a card', async () => {
  // Its usual place covers a card: along its row first, then a row higher.
  const area = { x: 0, y: 160, w: 1000, h: 640 }, size = { w: 400, h: 40 };
  assert.deepEqual(V.toastSpot(size, area, 700, []), { x: 300, y: 700 });
  const card = { x: 340, y: 690, w: 120, h: 50 }, s = V.toastSpot(size, area, 700, [card]);
  assert.equal(meets({ ...s, ...size }, card), false); assert.equal(s.y, 700, 'the same row when it has room');
  const wide = { x: 0, y: 690, w: 1000, h: 50 }, u = V.toastSpot(size, area, 700, [wide]);
  assert.equal(meets({ ...u, ...size }, wide), false); assert.ok(u.y < 700, 'a row higher');
  const app = await read('src/client/app.ts');
  for (const f of ['growthScene', 'growthPick', 'growthOpenPane', 'zoomAt']) assert.match(fn(app, f), /\n {2}dropNote\(\);\n/, f);
  assert.match(fn(app, 'closeGrowthPane'), /dropNote\(\);/);
  assert.match(fn(app, 'growthView'), /dropNote\(\);/);
  assert.match(app, /\$\('zoom-fit'\)\.addEventListener\('click', \(\) => \{ mapMoved = true; dropNote\(\);/);
  // The changed baseline's note is said once the scene stands (opening it drops an earlier note, never this one).
  assert.match(fn(app, 'growthCompare'), /say\.f = \(\) => announceBase\(was, cmpNow\);[\s\S]*\n {2}\} finally \{ say\.f\?\.\(\); \}\n\}/);
  assert.match(fn(app, 'announceBase'), /note\(baseWord\(/);
  assert.match(fn(app, 'placeToast'), /toastSpot\(\{ w: r\.width, h: r\.height \}/);
});

test('V10-4 a tab sits on its own card\'s edge, inside its span, clearly nearer it than any other card', () => {
  // Two cards 30 apart: a tab above the lower card sat in the gap and read as the upper card's.
  const upper = { x: 100, y: 0, w: 200, h: 80 }, lower = { x: 100, y: 110, w: 200, h: 80 }, boxes = new Map([['a', upper], ['b', lower]]);
  const obstacles = [{ id: 'a', ...upper }, { id: 'b', ...lower }];
  const r = V.placeTabs([{ part: 'b', w: 60, h: 20 }], boxes, obstacles, 0, 14).get('b');
  assert.deepEqual(r, { x: 100, y: 190, w: 60, h: 20 }, 'on its lower edge, where no card is near');
  assert.ok(r.x >= lower.x && r.x + r.w <= lower.x + lower.w);
  // No edge clear of the others: hidden, never in a gap.
  const below = { x: 100, y: 200, w: 200, h: 80 };
  assert.equal(V.placeTabs([{ part: 'b', w: 60, h: 20 }], new Map([...boxes, ['c', below]]), [...obstacles, { id: 'c', ...below }], 0, 14).get('b'), null);
});

test('V10-5 nothing but plain line runs under the guide: no badge, label or line end', () => {
  const guide = { x: 0, y: 0, w: 600, h: 90 }, area = { x: 16, y: 98, w: 860, h: 500 }, cap = { x: 430, y: 250 };
  // A badge under it (「사건 때」): the guide pans clear of it.
  const badge = { x: 300, y: 70, w: 46, h: 16 };
  assert.deepEqual(V.guidePan(guide, V.guideBlocks([], [], []), null, area, cap), [0, 0]);
  const d = V.guidePan(guide, V.guideBlocks([], [badge], []), null, area, cap);
  assert.ok(d && (d[0] || d[1]), `${d}`);
  // A line that passes under it, visible on both sides: no move. One that ends under it (its arrowhead): a move.
  const through = [{ x: -50, y: 40 }, { x: 700, y: 40 }], ends = [{ x: 700, y: 200 }, { x: 700, y: 40 }, { x: 300, y: 40 }];
  assert.deepEqual(V.guidePan(guide, V.guideBlocks([], [], [through]), null, area, cap), [0, 0]);
  const e = V.guidePan(guide, V.guideBlocks([], [], [ends]), null, area, cap);
  assert.ok(e && (e[0] || e[1]), `${e}`);
});

test('V10-6 a folded condition reads as its ◇ with its open cue at every zoom, 가까이 too; a picked line keeps its pill', async () => {
  const cond = lineBadge([{ when: 'consume_file 작업이 있을 때' }]), opt = lineBadge([{ optional: true }]);
  assert.equal(restCue(cond, false, 'near'), 'condition');
  assert.equal(restCue(cond, true, 'near'), null);
  assert.equal(restCue(opt, false, 'near'), null, '선택 keeps its pill at 가까이');
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'placeBadges'), /if \(!on && \(tier !== 'near' \|\| b\.kind === 'condition'\)\) \{ const cue = restCue\(b, on, tier\);/);
});

test('V10-7 the past view keeps the scene\'s part (or the part it came from) on screen; coming back and leaving restore the camera exactly; a note says only what is so', async () => {
  assert.equal(V.exitWord(true, false), '비교를 끝냈어요 · 비교 전에 보던 위치로 돌아왔어요');
  assert.equal(V.exitWord(true, true), '비교를 끝냈어요 · 비교 전에 고른 카드와 보던 위치로 돌아왔어요');
  assert.equal(V.exitWord(false, false), '비교를 끝냈어요');
  assert.equal(V.nowWord(true, false), '현재 지도로 돌아왔어요 · 화면 위치는 이전 모습을 보기 전 그대로예요');
  assert.equal(V.nowWord(false, false), '현재 지도로 돌아왔어요');
  assert.equal(V.sameCamera({ x: 1, y: 2, k: 0.3 }, { x: 1.2, y: 2, k: 0.3 }), true);
  assert.equal(V.sameCamera({ x: 1, y: 2, k: 0.3 }, { x: 1, y: 2, k: 0.6 }), false);
  const app = await read('src/client/app.ts');
  const gv = fn(app, 'growthView');
  assert.match(gv, /if \(!growthPast\) \{ pastCam = \{ \.\.\.camera \}; pastSel = selected; \}/);
  assert.match(gv, /mark = sc \? pastMark\(sc, id => !!drawnRep\(past, id\)\) : null;\n {2}if \(mark\) growthReveal\(mark\); else keepInView\(\);\n {2}if \(growthCmp\?\.pane === 'scene'\) renderGrowthPane\(\);/);
  assert.match(fn(app, 'growthLeavePast'), /const back = pastCam; pastCam = null;\n {2}if \(back\) camera = \{ \.\.\.back \};/);
  const ex = fn(app, 'growthExit');
  assert.match(ex, /afterRender = back; go\(o\.key, c\.saved\.selected, c\.saved\.scope\);/);
  assert.match(ex, /note\(exitWord\(sameCamera\(camera, want\), !!sel && selected === sel\)\)/);
  assert.doesNotMatch(app, /window\.setTimeout\(back, 80\)/);
  assert.match(fn(app, 'render'), /const ar = afterRender; afterRender = null; ar\?\.\(\);/);
  assert.match(fn(app, 'drawGrowth'), /growthLeavePast\(\); note\(nowWord\(!!was && sameCamera\(camera, was\), !!sel && selected === sel\)\);/);
});

test('V10-8 the shown scene\'s card always has its tab, a 새 scene\'s too, on every map', () => {
  const q = fixtureProject(growthFixture('track-a')), cs = G.changeSet(q, 4, 9), scenes = V.changeScenes(cs);
  const fresh = scenes.find(s => s.main.kind === 'new'); assert.ok(fresh);
  const tabs = V.shownTabs(scenes, fresh.part, null);
  assert.deepEqual([tabs[0].part, tabs[0].on, tabs[0].word], [fresh.part, true, '새로 표시']);
  assert.equal(V.shownTabs(scenes, null, null).some(t => t.kind === 'new'), false, 'the quieter tabs still leave 새 out');
});

test('V10-9 while the map\'s own title is not drawn, its chip carries 「기록 정보 ▾」 and the record\'s time, and opens them', async () => {
  const app = await read('src/client/app.ts'), css = await read('public/styles.css');
  assert.match(app, /h\('button', \{ type: 'button', class: 'sticky-toggle', 'aria-expanded': String\(metaOpen\)/);
  assert.match(app, /!metaOpen && basis \? h\('span', \{ class: 'sticky-when', title: basis\.title \}, basis\.textContent\) : null/);
  assert.match(fn(app, 'updateSticky'), /st\.classList\.toggle\('with-meta', /);
  assert.match(fn(app, 'updateSticky'), /if \(st\.hidden && st\.querySelector\('\.sticky-when'\)\) \{ st\.hidden = false; st\.classList\.add\('tight'\); st\.hidden = covers\(\); \}/);
  assert.ok(css.includes('.scope-sticky .sticky-toggle { pointer-events: auto;'));
});

test('V10-10 the sentence\'s two lines: the map moves down within its free height at the frame\'s scale and a little smaller before one line', async () => {
  const fv = fn(await read('src/client/app.ts'), 'fitView');
  assert.match(fv, /for \(let k = at\.k; k >= least && !done; k -= 0\.004\) \{\n {6}at\.place\(k\); const y0 = camera\.y, B = drawnBounds\(\), slack = /);
});
