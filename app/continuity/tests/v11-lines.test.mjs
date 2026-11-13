// v11 lines (ruling F8 Q1, Q3, Q4 and the v10a defects): the opening view is a static focus (the view's lines, every other relation folded
// and counted, one press away), a condition on the map is whole and short or its ◇, a label with no room leaves a relation-detail cue, a
// cue gives way only to its own condition's words, and a new view is laid out at one zoom whatever map came before. Each test fails on
// v10a. Fictional strings only.
// No browser: the pure parts run as built; the DOM code that uses them is read from the source (the rendered pages are checked by the
// headless checker of this round).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as FF from '../dist/public/client/first-flow.js';
import * as LG from '../dist/public/client/line-grammar.js';
import * as VL from '../dist/public/client/view-lens.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));

test('V11-1 the static focus folds every relation outside the view, counts n/N, and gives each focus card its own folded count', () => {
  assert.equal(typeof FF.focusFold, 'function', 'v10a folded only the lines of a card with six or more (hub fold)');
  // The view: oven → shelf (one line). The oven also feeds a till (two relations on one stroke) and a bin; the shelf feeds the bin; a
  // line between two other cards (mixer → till) touches no focus card.
  const lines = [
    { key: 'v', from: 'oven', to: 'shelf', ids: ['r1'], flow: true },
    { key: 'a', from: 'oven', to: 'till', ids: ['r2', 'r3'], flow: false },
    { key: 'b', from: 'oven', to: 'bin', ids: ['r4'], flow: false },
    { key: 'c', from: 'shelf', to: 'bin', ids: ['r5'], flow: false },
    { key: 'd', from: 'mixer', to: 'till', ids: ['r6'], flow: false },
  ];
  const f = FF.focusFold(['oven', 'shelf'], lines);
  assert.deepEqual([...f.hide].sort(), ['a', 'b', 'c', 'd'], 'every line outside the view is folded, near a focus card or not (v10a: a two-line card kept them)');
  assert.deepEqual([f.shown, f.total], [1, 6], 'unique relations: 1 of 6');
  assert.equal(f.byCard.get('oven'), 3, 'its own folded relations (two on one stroke count two)');
  assert.equal(f.byCard.get('shelf'), 1);
  assert.ok(!f.byCard.has('mixer') && !f.byCard.has('bin'), 'only focus cards carry 「다른 연결 k개」');
  // Opened: the oven's lines come back in place (the shelf's line to the bin with them stays folded: it is the shelf's, not opened).
  const o = FF.focusFold(['oven', 'shelf'], lines, new Set(['oven']));
  assert.deepEqual([...o.hide].sort(), ['c', 'd']);
  assert.equal(o.opened.get('oven'), 3);
  assert.equal(o.byCard.get('shelf'), 1);
  assert.deepEqual([o.shown, o.total], [4, 6]);
  assert.equal(FF.shownWord(4, 6), '표시 4/6');
  assert.equal(FF.allWord(6), '전체 관계 6개 보기');
});

test('V11-2 a recorded set of more lines than the foreground target is said as such and never cut', () => {
  const c = { rule: 'head', key: 'head:x', source: FF.FLOW_SOURCE.head, name: '첫 구조 줄', text: 'x', parts: ['a', 'b'], steps: [['a'], ['b']], lines: [], gaps: [], context: [], soft: false,
    start: null, end: null, ends: ['a', 'b'], chain: [['a'], ['b'], ['c']], more: 0, drawnLines: FF.FOCUS_FG_MAX + 5, branch: null };
  const f = { rule: 'head', kept: false, candidates: [c], index: 0, flow: c };
  assert.equal(FF.switcherText(f), `${FF.FLOW_CONTROL}: 기록된 연결 11개 · ${FF.FLOW_SOURCE.head}`);
  // At or under the target the lines are said along their run, as before.
  assert.equal(FF.switcherText({ ...f, flow: { ...c, drawnLines: 2 }, candidates: [{ ...c, drawnLines: 2 }] }), `${FF.FLOW_CONTROL}: a → b → c · ${FF.FLOW_SOURCE.head}`);
});

test('V11-3 a condition label is the record\'s words whole, at most 24 characters, 160px, one line and 12px on screen; else its ◇', () => {
  assert.equal(typeof LG.condLabelWords, 'function', 'v10a cut long conditions with 「…」');
  assert.equal(LG.condLabelWords('오븐이 예열됐을 때'), '오븐이 예열됐을 때');
  assert.equal(LG.condLabelWords('batch_size > 0'), 'batch_size > 0', 'code reads as written');
  assert.equal(LG.condLabelWords('(rack_temp < best_temp or always_cool)'), null, 'too long: ◇ (never one OR branch, never a cut bracket)');
  assert.equal(LG.condLabelWords('오븐이 예열되면…'), null, 'never a condition already cut');
  assert.equal(LG.condLabelWords('조건'), null);
  assert.equal(LG.condLabelWords(LG.COND_UNSAID), null);
  assert.equal(LG.condLabelWords('가'.repeat(24)), '가'.repeat(24));
  assert.equal(LG.condLabelWords('가'.repeat(25)), null);
  assert.ok(LG.condLabelFits({ widthPx: 150, heightPx: 16, fontPx: 12, linePx: 16 }));
  assert.ok(!LG.condLabelFits({ widthPx: 161, heightPx: 16, fontPx: 12, linePx: 16 }), 'wider than 160px');
  assert.ok(!LG.condLabelFits({ widthPx: 100, heightPx: 32, fontPx: 12, linePx: 16 }), 'two lines');
  assert.ok(!LG.condLabelFits({ widthPx: 100, heightPx: 14, fontPx: 10.5, linePx: 14 }), 'smaller than 12px on screen');
});

test('V11-4 the page says a condition whole or folds it to its ◇: no cut forms, and the branch note only when whole and short', async () => {
  const a = await app(), fit = fn(a, 'placeFitLabels'), marks = fn(a, 'placeFocusMarks');
  assert.ok(!fit.includes('condCuts(base)'), 'v10a tried every shorter cut of a condition');
  assert.match(fit, /const whole = cond \? condLabelWords\(full\) : /);
  assert.match(fit, /condLabelFits\(\{ widthPx: el\.offsetWidth \* s, heightPx: el\.offsetHeight \* s, fontPx: parseFloat\(cs\.fontSize\) \* s/);
  assert.match(fit, /if \(el\.textContent !== text \|\|/, 'a label the page would cut is no label');
  assert.match(marks, /if \(br && pts && pts\.length > 1 && condLabelWords\(br\.text\)\) \{/, 'the 갈림 note never carries a cut condition');
});

test('V11-5 a condition never vanishes: its ◇ gives way only to a label saying its own condition, for every line it stands for', async () => {
  const a = await app(), lab = fn(a, 'placeLineLabels');
  assert.match(lab, /const ls = \[\.\.\.fit\]\.filter\(\(\[, f\]\) => cue \? also\.every\(x => f\.conds\.has\(x\)\) : /, 'v10a: a ◇ under another line\'s label took display:none');
  assert.ok(!/edge-cue'\) \? f\.conds\.has\(k\) : f\.keys\.has\(k\)\) \|\| \(Number\.isFinite/.test(lab));
});

test('V11-6 a label with no room leaves a relation-detail cue; a badge with no clear place folds to its mark, never over another line', async () => {
  const a = await app(), lab = fn(a, 'placeLineLabels'), dc = fn(a, 'detailCues'), badges = fn(a, 'placeBadges'), cue = fn(a, 'placeCue');
  assert.ok(dc.length > 0, 'v10a: 「config 또는」, 「공유 링크 열기」 left the map with nothing in their place');
  assert.match(lab, /detailCues\(box, blocks, drawn, fit\);/);
  assert.match(dc, /\.edge\.label-hidden/);
  assert.match(dc, /placeCue\(box, e, 'detail'/);
  // v12-growth (first user of v11, 7): its title and keyboard name say what it opens too (growth-v12 V12-7).
  assert.match(dc, /cue\.dataset\.full = words; cue\.title = detailTip\(words\); cue\.setAttribute\('aria-label', detailTip\(words\)\); if \(lens\) cue\.dataset\.lens = lens;/, 'its words for its hover and keyboard name; a lens label\'s cue under that lens');
  assert.match(cue, /cue === 'detail' \? '관계 보기'/);
  assert.ok(!badges.includes("el.classList.add('forced')"), 'v10a forced a badge over other lines and labels');
  assert.match(badges, /placeCue\(box, e, b\.kind === 'condition' \? 'condition' : b\.kind === 'optional' \? 'optional' : 'detail'/);
  assert.doesNotMatch(badges, /\?\? f\.spots\.find\(clear\) \?\? null;/, 'never a place with another line under it');
  const s = await css();
  assert.match(s, /\.edge-labels > \.edge-cue::after \{ inset: -8px; \}/, 'a 24 × 24 target around the 8px mark');
});

test('V11-7 the page folds by the static focus, routes the drawn lines among themselves, and says the count with 전체 관계 N개 보기', async () => {
  const a = await app(), fold = fn(a, 'foldHubs'), route = fn(a, 'routeShown'), top = fn(a, 'renderFocusTop'), marks = fn(a, 'placeFocusMarks');
  // v12: the static focus is the person's choice (「먼저 볼 연결만」, ffOnly) and gives every card its chip (V12-1, V12-2).
  assert.match(fold, /const fold = focusFold\(cards, ls, ffOpen, true\);/, 'v10a: hubFolds (six or more lines only)');
  assert.match(fold, /if \(!o \|\| !f \|\| !ffActive\(\) \|\| ffLensPicked \|\| !ffOnly\(\)\) return;/, 'a lens the person picks shows its subject over the whole map');
  assert.match(route, /const folding = !!ffFold && ffActive\(\)/);
  assert.match(route, /: folding \? \[\.\.\.world\.querySelectorAll<SVGGElement>\('\.edge:not\(\.sum\)'\)\]\.filter\(g => !out\(g\)\) : \[\];/);
  assert.match(top, /shownWord\(ffCount\.shown, ffCount\.total\)/);
  assert.match(top, /btn\('ft-all', ALL_RELATIONS_WORD, `관계 \$\{ffCount\.total\}개를 모두 그리고/, 'v12: 「전체 관계」 beside 「먼저 볼 연결만」');
  assert.match(top, /기록에 \$\{FLOW_CONTROL\}의 근거가 없어 모든 관계를 그렸어요/, 'a map with no basis starts with every relation and says so');
  assert.match(marks, /\|\| id === selected\) continue;/, 'a picked card shows all its direct relations: no chip');
  assert.match(a, /sp\.classList\.toggle\('ff-all', !!o && !any && !scope && !scView && !!o\.view\.parts\.length\);/);
  const s = await css();
  assert.match(s, /\.space \.world \.edge\.on:not\(\.picked\) \{ --bw: 2\.25; \}/, 'a picked card\'s direct relations 2.25px (a picked line 3px)');
  assert.match(s, /#space\.ff-all\.lens-compose \.world \.edge:not\(\.on\)[^{]*\{ --bw: 1\.15; \}/, '전체 관계 at 1.15px');
  assert.match(s, /\.edge\.agg\.on \.edge-line \{ stroke: var\(--accent\);/, 'a picked aggregate line at 3:1 or more (v10a #a9b8f5: 1.8:1)');
});

test('V11-8 a new view is laid out at one zoom whatever map came before (the same map in the same window always fits the same)', async () => {
  const a = await app(), rs = fn(a, 'renderSpace');
  const at = rs.indexOf("if (cameraMode !== 'keep') { camera = { x: 0, y: 0, k: 1 };"), lay = rs.indexOf('relayout(o);');
  assert.ok(at > 0 && at < lay, 'v10a laid out a new map at the zoom the map before left on the page');
  assert.match(rs, /syncZoom\(1, true\); \}\n  relayout\(o\);/);
});

test('V11-9 the legend names the condition mark (「◇ 조건 보기」) and counts the lines that carry one', () => {
  const lines = [{ key: 'x', channel: 'data', badge: true, cond: true, from: 'a', to: 'b' }, { key: 'y', channel: 'data', badge: false, from: 'b', to: 'c' }, { key: 's', channel: 'data', badge: true, cond: true, from: 'a', to: 'c', sum: true }];
  for (const lens of ['compose', 'data', 'start']) {
    const it = VL.legendItems(lens, [], lines).find(x => x.id === 'cond');
    assert.ok(it, `${lens}: v10a had no such item`);
    assert.deepEqual([it.label, it.sample, it.count, it.lines], [VL.COND_ITEM, { kind: 'mark', text: '◇' }, 1, ['x']]);
  }
  assert.equal(VL.COND_ITEM, '조건 보기');
});

test('V11-10 the static focus routes its own few lines at twice the map\'s pitch: a pair\'s two lines and their ports stand apart', async () => {
  const R = await import('../dist/public/client/map-route.js');
  assert.equal(typeof R.routeAtScale, 'function', 'v10a routed the focus lines at the map\'s pitch (6 screen px at a half-size fit)');
  const box = (id, x, y) => ({ id, x, y, w: 224, h: 80, kind: 'node', depth: 0, container: '', kids: 0, head: 0, rel: { x, y } });
  const boxes = new Map([['a', box('a', 0, 0)], ['b', box('b', 400, 120)]]);
  const edges = [{ key: 'ab', from: 'a', to: 'b', kind: 'flow', notes: [], ids: ['r1'], agg: false }, { key: 'ba', from: 'b', to: 'a', kind: 'flow', notes: [], ids: ['r2'], agg: false }];
  const apart = m => { const p = m.get('ab').pts, q = m.get('ba').pts; return Math.abs(p[0].y - q.at(-1).y); };
  const one = R.routeEdges(boxes, edges), half = R.routeAtScale(boxes, edges, R.FOCUS_ROUTE_SCALE);
  assert.ok(apart(half) >= 2 * apart(one) - 0.5 && apart(half) >= 24, `ports ${apart(one)} → ${apart(half)} map units apart`);
  // The routes still meet their cards' sides, read back at full size.
  const p = half.get('ab').pts;
  assert.ok(Math.abs(p[0].x - 224) < 0.5 && Math.abs(p.at(-1).x - 400) < 0.5, JSON.stringify(p));
  assert.match(half.get('ab').d, /^M224,/);
  // At scale 1 it is the map's own routing.
  assert.deepEqual([...R.routeAtScale(boxes, edges, 1)].map(([k, r]) => [k, r.d]), [...one].map(([k, r]) => [k, r.d]));
  const src = await app();
  // Taken only when no worse a drawing than the map's own pitch (crossings, detours, length): here it is.
  assert.deepEqual([...R.focusRoutes(boxes, edges)].map(([k, r]) => [k, r.d]), [...half].map(([k, r]) => [k, r.d]));
  assert.equal(R.FOCUS_ROUTE_LONGER, 1.15);
  assert.ok(src.includes('focusRoutes(lay.boxes, set, c, { pairGap: pairGapNow })'));
  assert.match(src, /const c = folding && !selected && !scView && set\.length <= FOCUS_ROUTE_MAX \? FOCUS_ROUTE_SCALE : 1;/, 'one fixed scale: a route that followed the zoom would move the fit that reads it');
});
