// Map hygiene (beauty v1): direction-independent fixes. Layout and text rules only; no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { outside, routeCost, ROUTE_TURN, NODE_W, NODE_H, edgePath } from '../dist/public/client/map-layout.js';
import { routeEdges } from '../dist/public/client/map-route.js';
import { wholeWords } from '../dist/public/client/line-grammar.js';
import { labelSpots } from '../dist/public/client/map-labels.js';

const box = (id, x, y, w = NODE_W, h = NODE_H) => ({ id, x, y, w, h, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { x, y }, head: 0, face: 'unit' });

test('HYG-1 the route cost: a turn is cheaper than before, and a run off the span of its ends costs by how far off it lies', () => {
  assert.ok(ROUTE_TURN < 400);
  const span = { x0: 0, x1: 400, y0: 0, y1: 100 };
  assert.equal(outside(span, 0, 50, 400, 50), 0, 'inside: nothing');
  assert.equal(outside(span, 0, 200, 400, 200), 400, 'a run far past the span costs its whole length');
  assert.ok(outside(span, 0, 102, 400, 102) < 40, 'just past a port row: little');
  assert.equal(outside(span, 300, 50, 500, 50), 100, 'the part past the end along the run');
  // A two-turn run round the outside costs more than a four-turn way between the ends.
  const round = [{ x: 0, y: 50 }, { x: 20, y: 50 }, { x: 20, y: -200 }, { x: 600, y: -200 }, { x: 600, y: 0 }];
  const through = [{ x: 0, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 20 }, { x: 450, y: 20 }, { x: 450, y: 0 }, { x: 600, y: 0 }];
  assert.ok(routeCost(through) < routeCost(round));
});

test('HYG-2 a control line between two cards on one row keeps its sides (no climb over the map into a top port)', () => {
  const a = box('a', 0, 0), b = box('b', 900, 0), mid = box('m', 400, -40, NODE_W, 200);
  const e = { key: 'a|b|flow', from: 'a', to: 'b', kind: 'flow', notes: [], ids: ['ab'], agg: false, faces: { a: 'bottom', b: 'top' } };
  const r = routeEdges(new Map([a, b, mid].map(x => [x.id, x])), [e]).get(e.key);
  assert.ok(r.faces === undefined || (r.faces.b !== 'top'), JSON.stringify(r.faces));
  // Below it, the face rule still holds.
  const c = box('c', 600, 400), f = { ...e, key: 'a|c|flow', to: 'c' };
  const r2 = routeEdges(new Map([a, c].map(x => [x.id, x])), [f]).get(f.key);
  assert.deepEqual(r2.faces, { a: 'bottom', b: 'top' });
});

test('HYG-3 a middle-tier label is cut on whole words and never ends on an open bracket or promising punctuation', () => {
  assert.equal(wholeWords('fs-job {type, payload} 보냄'), 'fs-job');
  assert.equal(wholeWords('JSON 응답(token, user) 반환'), 'JSON 응답');
  assert.equal(wholeWords('경고 문구(stderr, 종료 코드)'), '경고 문구');
  assert.equal(wholeWords('인터셉터 핸들러(use 등록)'), '인터셉터 핸들러');
  assert.equal(wholeWords('기동 · 명령 torch.compile 실행'), '기동 · 명령');
  assert.equal(wholeWords('발행 layout → 보고서 파일 저장'), '발행 layout', 'no arrow left pointing at what was cut');
  for (const t of ['설정: 값 읽기 그리고 쓰기 순서', 'a, b, c, d, e, f, g, h', '명령 / 응답 / 기록 / 정리']) assert.doesNotMatch(wholeWords(t), /[,:;/(\[{·-]$/, t);
});

test('HYG-4 places beside a vertical run say so, so a level run is taken first across all labels', () => {
  const v = labelSpots([{ x: 0, y: 0 }, { x: 0, y: 300 }], 60, 16, 'long');
  assert.ok(v.length && v.every(s => s.beside === true));
  const hz = labelSpots([{ x: 0, y: 0 }, { x: 300, y: 0 }], 60, 16, 'long');
  assert.ok(hz.length && hz.every(s => !s.beside));
});

test('HYG-5 styles: one dock width, a text floor, quiet fades, regions with a body, plain card rows', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const tail = css.slice(css.indexOf('/* ---------- map hygiene (beauty v1)'));
  assert.ok(tail.length > 100);
  assert.match(tail, /\.controls \.fv \{ position: absolute; left: calc\(100% \+ 8px\)/, 'the guide line sits beside the dock, never widening it');
  // Review fixes (the earlier pins changed on purpose): the title under the floor is unseen but keeps its 「기록 정보 ▾」 in the tab
  // order (opacity, as a pinned title; not visibility); an off-lens card is solid (no dot grid through it) and keeps its greys in
  // order (a contrast step instead of flattened greys at .6); the region's colours are tokens, with no dark fill under light cards;
  // the region name keeps the size its head was measured for.
  assert.match(tail, /\.space\.title-floor #world > \.map-title:not\(:focus-within\) \{ opacity: 0; \}/);
  assert.doesNotMatch(tail, /title-floor[^{]*\{[^}]*visibility: hidden/);
  assert.match(tail, /\.node\.lens-off[^{]*\{ opacity: 1; filter: grayscale\(1\) contrast\(\.65\) brightness\(1\.22\); \}/);
  assert.doesNotMatch(tail, /lens-off[^{]*\{[^}]*--text-[234]:/, 'no flattened greys under the fade');
  assert.match(tail, /--region-bg: #e9ecf1;/);
  assert.match(tail, /\.frame\.region:where\(\*\) \{ background: var\(--region-bg\);/);
  assert.doesNotMatch(tail, /data-theme="dark"\][^{]*\.frame\.region/, 'no dark region under light cards');
  assert.doesNotMatch(tail.replace(/\/\*[\s\S]*?\*\//g, ''), /\.(?:frame-name|band-head)[^{]*\{[^}]*color: #/, 'region and band colours from tokens');
  assert.doesNotMatch(tail, /\.frame-head \.frame-name \{[^}]*font-size/, 'the region name keeps the size its head was measured for');
  assert.doesNotMatch(tail, /caption-floor/, 'the 「이은 선 없음」 caption keeps a readable size instead of hiding');
  assert.doesNotMatch(tail.replace(/\/\*[\s\S]*?\*\//g, ''), /\.frame[^{]*\{[^}]*dashed/, 'no dashed region frames');
  // Beauty v2 review (M3): the foot row (.c-bottom) left the card face in beauty v2 A2; its rules went with it.
  assert.ok(!/\.c-bottom\b/.test(tail.replace(/\/\*[\s\S]*?\*\//g, '')));
  const app = await readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  assert.ok(app.includes('const BOTTOM = 88;') && app.includes('const SAFE_TOP = 64, SAFE_SIDE = 32;'), 'the safe area');
  assert.ok(app.includes('legendOpenNow = chosen ?? false;'), 'the legend starts as its chip');
});

test('HYG-6 review fixes: a corridor round a card takes the middle of the gap, not a row squeezed along the card', () => {
  const a = box('a', 0, 0), b = box('b', 600, 0), m = box('m', 300, -20, 120, 200);
  const r = edgePath(a, b, [a, b, m]);
  assert.ok(r.clear);
  const runs = r.pts.slice(1).map((q, i) => [r.pts[i], q]).filter(([p, q]) => Math.abs(p.y - q.y) < 0.01 && Math.min(p.x, q.x) < m.x + m.w && Math.max(p.x, q.x) > m.x);
  assert.ok(runs.length, JSON.stringify(r.pts));
  for (const [p] of runs) assert.ok(Math.min(Math.abs(p.y - m.y), Math.abs(p.y - (m.y + m.h))) >= 12, `the run past the card keeps its room: y ${p.y}`);
});

test('HYG-7 review fixes in the client: the best-pan search, head merging, the dock order', async () => {
  const app = await readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  // The pan search's range keeps the focus where it was framed: inside the safe area when it fits (min of the two focus bounds as the
  // lower limit, max as the upper), filling it otherwise. It was written the other way round and returned only the current pan.
  assert.ok(app.includes('Math.max(start + room - (lo + size) * k, Math.min(f0, f1)), max = Math.min(start - lo * k, Math.max(f0, f1))'));
  // A merged head comes back as markLines gave it (a wait step's open head), markLines clears the merge, and a legend action re-merges.
  assert.ok(app.includes("line.setAttribute('marker-end', el.dataset.mergedHead ?? 'none')"));
  assert.ok(/line\.setAttribute\('marker-end', mark\(head\)\); el\.classList\.remove\('head-merged'\)/.test(app));
  assert.ok(app.includes('applyLegendMarks(); mergeHeads(); renderLegend();'));
  // The kept head is the most prominent line's, not the first in the document.
  assert.ok(app.includes('cands.sort((p, q) => q.w - p.w);'));
  // A fit without the title stays under the title floor, so the title it left out of the frame is not drawn.
  assert.ok(app.includes('fit = Math.min(fitOf(nb), TITLE_FLOOR_K - 0.001)'));
  // The folded legend chip sits right after the lens buttons.
  assert.ok(app.includes("key!.classList.contains('folded') ? [key, fv] : [fv, key]"));
});
