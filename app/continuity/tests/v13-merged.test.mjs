// v13 merged (forms × opening and light × words): what the three parts needed to work together. Each test fails on the three merges
// alone (b6f47c9b · 82b541bc · 284c4dbf). Fictional strings only.
// No browser: the pure parts run as built; the DOM code that uses them is read from the source (the rendered pages are checked by the
// headless checker of this round).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as M from '../dist/public/client/mark-room.js';
import * as W from '../dist/public/client/word-level.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));

test('V13M-1 a drawn line is walked from its own path data once (M, L, Q), its points found on that walk; any other command is left to the browser', () => {
  const w = M.pathWalk('M0,0 L100,0 L100,50');
  assert.ok(w);
  assert.equal(w.len, 150);
  assert.deepEqual(w.at(50), { x: 50, y: 0 });
  assert.deepEqual(w.at(125), { x: 100, y: 25 });
  assert.deepEqual(w.at(-5), { x: 0, y: 0 }, 'clamped at the start');
  assert.deepEqual(w.at(999), { x: 100, y: 50 }, 'clamped at the end');
  // A rounded corner (the router's Q): its length close to the arc's, its points on the curve's side of the corner.
  const q = M.pathWalk('M0,0 L92,0 Q100,0 100,8 L100,100');
  assert.ok(q);
  const exact = 92 + 92 + (Math.PI / 2) * 8;
  assert.ok(Math.abs(q.len - exact) < 0.6, `length ${q.len} vs ${exact}`);
  const mid = q.at(92 + (Math.PI / 4) * 8);
  assert.ok(mid.x > 94 && mid.x < 100 && mid.y > 0 && mid.y < 6, JSON.stringify(mid));
  // Negative and decimal numbers, commas or spaces between them.
  const n = M.pathWalk('M-480,460.5 L-472 460.5');
  assert.ok(n); assert.equal(n.len, 8);
  assert.equal(M.pathWalk('M0,0 C10,0 20,0 30,0'), null);
  assert.equal(M.pathWalk('M0,0 A5,5 0 0 1 10,0'), null);
  assert.equal(M.pathWalk(''), null);
});

test('V13M-2 a mark\'s further places come from the walk, and only when no place near its port served (the opening waited 3.5 s on them)', async () => {
  const src = await app(), cue = fn(src, 'placeCue');
  assert.match(src, /const cueExtra = [^\n]*pathWalk\(path\.getAttribute\('d'\)/);
  assert.match(cue, /const ex2 = spot \? null : exOf\(\);/, 'the last resort walks the line only when there is still no spot');
  assert.match(cue, /exOnce \?\?= cueExtra\(/, 'one walk per mark');
  assert.doesNotMatch(cue, /sp\.getPointAtLength/, 'the joined mark\'s move walks its line too');
});

test('V13M-3 at 쉽게 a script or key named with a colon is code (「build:docker」), a time of day is not', () => {
  assert.equal(W.codeToken('build:docker'), true);
  assert.equal(W.codeToken('db:migrate'), true);
  assert.equal(W.codeToken('10:30'), false);
  assert.equal(W.hasCode('build·build:docker 때'), true);
  assert.equal(W.plainLabel('build·build:docker 때'), null, 'its line keeps its ◇, its words in the hover');
  assert.equal(W.plainLabel('매일 10:30에 실행'), '매일 10:30에 실행');
  assert.equal(W.plainLabel('기본 꺼짐'), '기본 꺼짐');
});

test('V13M-4 층 at 쉽게: the band words in the legend\'s plain words, the lane counts behind the lane\'s tip (자세히 keeps both)', async () => {
  assert.equal(W.easyBand('촉발'), '시작 신호');
  assert.equal(W.easyBand('저장 · 관문'), '저장 · 관문');
  assert.equal(W.easyBand('참여'), '사람', 'v14 B: the 참여 band holds the people who use the product (V14B-10)');
  const src = await app(), lanes = fn(src, 'drawFormLanes');
  assert.match(lanes, /easy\(\) \? easyBand\(l\.text\) : l\.text/);
  assert.match(lanes, /title: l\.kind === 'band' \? `\$\{l\.text\} · 기록이 정한 표현군 · 부품 \$\{l\.count\}`/, 'the tip keeps the record\'s words and the count');
  assert.match(await css(), /\.space\.words-easy \.form-lane-n \{ display: none; \}/);
});

test('V13M-5 the opening plays in the record\'s 보기: a form\'s lanes are its stage from the start, only their counts (the last version\'s) wait for the landing', async () => {
  const s = await css();
  assert.match(s, /#space\.op-run #world > :not\(\.node\):not\(\.frame\):not\(\.edges\):not\(\.map-title\):not\(\.op-ghost\):not\(\.form-lane\),/);
  assert.match(s, /#space\.op-land #world > :not\(\.node\):not\(\.frame\):not\(\.edges\):not\(\.map-title\):not\(\.op-ghost\):not\(\.form-lane\),/);
  assert.match(s, /#space\.op-run #world > \.form-lane \.form-lane-n \{ visibility: hidden; \}/);
});

test('V13M-6 at 쉽게 the first view\'s chip names its lens as the lens button does (「첫 보기 · 시작과 반복」)', async () => {
  const src = await app();
  assert.match(src, /btn\('fv-why', `첫 보기 · \$\{\(easy\(\) \? EASY_LENS\[r\.lens\] : null\) \?\? LENSES\.find/);
  assert.equal(W.EASY_LENS.start, '시작과 반복');
});

test('V13M-7 a compare scene\'s guide is cleared from its settled size: a pan must leave nothing under it, a guide that grew is cleared again once', async () => {
  const src = await app(), g = fn(src, 'growthClearGuide');
  assert.match(g, /function growthClearGuide\(still = false, again = false\)/);
  assert.match(g, /const hits = \(dx: number, dy: number\) => blocks\.some\(/);
  assert.match(g, /if \(!hits\(0, 0\)\) \{ if \(!still\) cmpEdgeTidy\(cards, view, hits\); return; \}/);
  assert.match(g, /!still && !lose && !hits\(d\[0\], d\[1\]\)\) \{ camera = /, 'a pan that still leaves a card under the guide is no answer');
  assert.doesNotMatch(g, /if \(d && !d\[0\] && !d\[1\]\) return;/, 'no pan with something under the guide sends it to the pane');
  assert.match(g, /if \(!again\) \{ const h0 = el\.offsetHeight, w0 = el\.offsetWidth; requestAnimationFrame\(\(\) => requestAnimationFrame\(/);
  assert.match(g, /growthClearGuide\(still, true\)/);
});
