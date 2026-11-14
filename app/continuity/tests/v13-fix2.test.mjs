// v13 fix 2 (the second review of v13-merged): the row of 흐름 holds only what the record links to it, pairs keep their 12px wherever the
// map is framed, a switch never stands still while the new form is drawn, 쉽게 hides code words on lines, the opening lands on the fit, the first flow stays above the tools. Each test fails on eccdbe5e. Fictional strings only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as F from '../dist/public/client/map-forms.js';
import * as R from '../dist/public/client/map-route.js';
import * as W from '../dist/public/client/word-level.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));
const card = (id, family, type = null, name = id, h = 80) => ({ id, name, w: 224, h, family, type, anchor: 40 });
const ORDERED = '기록이 설명한 흐름';

test('V13X2-1 흐름: a person who meets neither the row nor what stands by it is not at the row\'s end; level with the row only one that meets the end step', () => {
  const cards = [card('in', 'process'), card('mid', 'process'), card('out', 'store'),
    card('keeper', 'participant', 'person'), card('guest', 'participant', 'person'), card('lib', null, 'external'), card('who', 'participant', 'person'), card('tool', null, 'external')];
  const lines = [
    { from: 'in', to: 'mid', directed: true }, { from: 'mid', to: 'out', directed: true },
    { from: 'guest', to: 'keeper', directed: true }, // their one relation is with each other
    { from: 'lib', to: 'mid', directed: true }, // meets the row, not its first step
    { from: 'who', to: 'in', directed: true }, // meets the first step
    { from: 'out', to: 'tool', directed: true }];
  const p = F.flowPlace(cards, lines, { steps: [['in'], ['mid'], ['out']], rule: 'summary', source: ORDERED, text: 'in → mid → out' });
  const at = id => p.at.get(id), rowY = at('in').y;
  for (const id of ['keeper', 'guest']) {
    assert.notEqual(at(id).y, rowY, `${id} stands level with the row`);
    assert.ok(at(id).y > rowY, `${id} stands under the row, apart`);
  }
  assert.deepEqual([...p.apart].sort(), ['guest', 'keeper']);
  assert.equal(at('who').y, rowY, 'the person who meets the first step stands on the row, at its start');
  assert.ok(at('who').x < at('in').x);
  assert.notEqual(at('lib').y, rowY, 'an outside system meeting a middle step stands over or under the row, not on it');
  assert.equal(at('tool').y, rowY, 'what the last step meets stands at the row\'s end');
  const r = [...p.at].map(([id, a]) => ({ id, ...a }));
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) assert.ok(Math.abs(r[i].x - r[j].x) >= 224 || Math.abs(r[i].y - r[j].y) >= 80, `${r[i].id} over ${r[j].id}`);
});

test('V13X2-2 a hub\'s side that cannot hold its pairs pairGap apart sends ends toward partners above it to its top: every pair stands pairGap apart', () => {
  const box = (id, x, y, h = 104) => ({ id, x, y, w: 224, h, kind: 'node', depth: 0, container: 'root', kids: 0, head: 0, rel: { x, y } });
  const boxes = new Map([box('hub', 0, 600, 128), box('p1', 400, 0), box('p2', 400, 180), box('p3', 400, 360), box('q1', 400, 600), box('q2', 400, 800)].map(b => [b.id, b]));
  const E = (from, to, kind = 'flow') => ({ key: `${from}|${to}|${kind}`, from, to, kind, notes: [], ids: [`${from}${to}`], agg: false });
  const edges = ['p1', 'p2', 'p3', 'q1'].flatMap(p => [E('hub', p), E(p, 'hub', 'control')]).concat([E('hub', 'q2')]);
  const gap = 30, out = R.routeEdges(boxes, edges, { pairGap: gap });
  for (const p of ['p1', 'p2', 'p3', 'q1']) {
    const a = out.get(`hub|${p}|flow`).pts, b = out.get(`${p}|hub|control`).pts;
    assert.ok(Math.hypot(a[0].x - b.at(-1).x, a[0].y - b.at(-1).y) >= gap - 0.5, `hub ↔ ${p}: the two ends stand ${Math.hypot(a[0].x - b.at(-1).x, a[0].y - b.at(-1).y).toFixed(1)} apart`);
  }
  assert.ok([...out.values()].some(r => r.pts[0].y === 600 || r.pts.at(-1).y === 600), 'some ends meet the hub\'s top');
});

test('V13X2-3 a map opened on a camera kept from before routes its lines for that zoom (its pairs PAIR_PX apart there)', async () => {
  const a = await app();
  assert.match(a, /else if \(saved\) \{ camera = \{ \.\.\.saved \}; routeForZoom\(\); applyCamera\(\); \}/);
  const f = fn(a, 'routeForZoom');
  assert.match(f, /const want = Math\.max\(PAIR_PX \/ Math\.max\(camera\.k, 0\.05\), 12\);/);
  assert.match(f, /if \(Math\.abs\(want - routedGap\) <= 0\.75\) return;\n\s+pairGapNow = want; positionWorld\(\);/);
});

test('V13X2-4 a switch never routes on the page while its cards fly: the new form\'s lines are routed in a worker and kept by their input; its redraw draws the layout it flew to, its fit in a task of its own', async () => {
  const a = await app();
  // The worker routes exactly as the page would: the same router on the same input.
  let got = null; globalThis.postMessage = m => { got = m; };
  await import('../dist/public/client/route-worker.js');
  const box = (id, x, y) => ({ id, x, y, w: 224, h: 80, kind: 'node', depth: 0, container: 'root', kids: 0, head: 0, rel: { x, y } });
  const boxes = [box('a', 0, 0), box('b', 400, 0), box('c', 400, 200)];
  const edges = [{ key: 'a|b|flow', from: 'a', to: 'b', kind: 'flow', notes: [], ids: ['r1'], agg: false }, { key: 'b|a|control', from: 'b', to: 'a', kind: 'control', notes: [], ids: ['r2'], agg: false }, { key: 'a|c|flow', from: 'a', to: 'c', kind: 'flow', notes: [], ids: ['r3'], agg: false }];
  globalThis.onmessage({ data: { id: 7, jobs: [{ sig: 's', boxes: boxes.map(b => [b.id, b]), edges, opts: { pairGap: 30 }, c: 1 }] } });
  assert.equal(got.id, 7);
  assert.deepEqual(new Map(got.out[0].routes), R.routeEdges(new Map(boxes.map(b => [b.id, b])), edges, { pairGap: 30 }));
  delete globalThis.onmessage; delete globalThis.postMessage;
  // The page keeps routes by their input and draws from them.
  assert.match(a, /const routeSig = \(boxes: ReadonlyMap<string, Box>, edges: readonly Edge\[\], opts: [^\n]*\n\s+JSON\.stringify\(\[c, opts\.pairGap \?\? 0, opts\.pitch \?\? 0, \[\.\.\.boxes\.values\(\)\], edges\]\);/);
  assert.match(fn(a, 'routeKept'), /const sig = routeSig\(boxes, edges, opts, c\), had = routeMemo\.get\(sig\);\n\s+if \(had\) \{ keepRoutes\(sig, had\); return had; \}/);
  assert.match(fn(a, 'positionWorld'), /routeKept\(lay\.boxes, lay\.edges,[^\n]*routeKept\(lay\.boxes, sums,/);
  assert.match(fn(a, 'routeShown'), /routeKept\(lay\.boxes, set, \{ pairGap: pairGapNow, pitch: formPitch\(\) \}, c\)/);
  assert.match(fn(a, 'routeAhead'), /new Worker\(new URL\('\.\/route-worker\.js', import\.meta\.url\), \{ type: 'module' \}\)/);
  // The switch: the map's, the summary's and the shown set routed ahead for the frame it flies to; its redraw reuses the layout; the fit after.
  const sw = fn(a, 'setMapForm');
  assert.match(sw, /formLaid = lay;/);
  assert.match(sw, /const routed = routeAhead\(\[\{ boxes: lay\.boxes, edges: lay\.edges, opts: ahead, c: 1 \}, \{ boxes: lay\.boxes, edges: sumsAhead, opts: ahead, c: 1 \},/);
  assert.match(sw, /void routed\.then\(\(\) => \{ ready = true; land\(\); \}\);/);
  assert.match(sw, /\/\/ The fit in a task of its own[^\n]*\n\s+formTimers\.push\(window\.setTimeout\(\(\) => \{/);
  assert.match(fn(a, 'renderSpace'), /if \(!\(formSwitching && formLaid === lay && formLaid\.boxes\.size\)\) relayout\(o\);\n\s+formLaid = null;/);
  assert.match(fn(a, 'positionWorld'), /if \(formSwitching && rendering\) return;\n\s+routeShown\(\);/);
  assert.match(a, /syncLineMode\(\); markLines\(\); foldHubs\(\); routeShown\(\); if \(!formSwitching\) placeEdgeLabels\(\); renderFocusTop\(\);/);
  // The new frame from the old fit, routed a little wider apart (never narrower), and kept by the fit after the landing.
  assert.match(sw, /const k1 = Math\.max\(0\.05, fit0 \? fit0\.k \* room\(B\) \/ room\(B0\) : Math\.min\(cam0\.k \* 1\.6, room\(B\)\)\);/);
  assert.match(fn(a, 'pairRoute'), /if \(formLanding && routedGap >= want - 0\.75 && routedGap <= want \* FORM_ROUTE_WIDE\) return false;/);
  assert.match(a, /const FORM_ROUTE_UNDER = 0\.9, FORM_ROUTE_WIDE = 1\.4;/);
  // The worker starts and routes once while a map with 보기 is quiet (the first switch finds it ready).
  assert.match(fn(a, 'drawFormLanes'), /if \(sw && routeWorker === undefined\) window\.setTimeout\(warmRoutes, ROUTE_WARM_MS\);/);
  assert.match(fn(a, 'warmRoutes'), /void routeAhead\(\[\{ boxes: lay\.boxes, edges: lay\.edges\.slice\(0, 48\)/);
  // The 구성 arrangement a form is placed from is kept from the last layout while nothing it reads has changed.
  const bl = fn(a, 'baseLayout');
  assert.match(bl, /stamp = JSON\.stringify\(\[o\.key, scope, \[\.\.\.tempExpand\], \[\.\.\.previewExpand\], \[\.\.\.expandState\], \[\.\.\.budgetFolded\(o\)\], held, mapAspect\(\), words, !!planRows, !!o\.past\]\)/);
  assert.match(bl, /if \(formSwitching && !planRows && baseKept && baseKept\.view === o\.view && baseKept\.stamp === stamp\)/);
});

test('V13X2-5 쉽게: a joined name ending in a code word, a state flag in its past form and a type written as in code stay behind the line\'s cue; product names stay', () => {
  for (const t of ['Bind·BindFunc 처리기 등록', '결과 dict의 report', '요청 인터셉터 fulfilled 입력', 'initialized 전에만 등록', 'WebSocketManager 연결']) assert.equal(W.plainLabel(t), null, t);
  for (const t of ['GitHub PR 병합 요청', 'ClickHouse에 쓰기', 'PostgreSQL 저장', 'start 명령', '작업마다 cron 식', 'Bootstrap 안']) assert.equal(W.plainLabel(t), t, t);
});

test('V13X2-6 an opening lands on the map\'s own fit (never on a camera kept from an earlier visit)', async () => {
  const a = await app();
  assert.match(a, /if \(opening\.willPlay\(o\.key, openingVersion\(o\)\)\) fitView\(false\);\n\s+opening\.arrive\(o\.key, openingVersion\(o\), askedAt\);/);
  const { createOpening, SEEN_KEY } = await import('../dist/public/client/opening.js');
  const store = new Map();
  const host = { reduced: () => false, storage: () => ({ get: k => store.get(k) ?? null, set: (k, v) => store.set(k, v) }) };
  const op = createOpening(host);
  assert.equal(op.willPlay('m', 'v2'), true);
  store.set(SEEN_KEY, JSON.stringify({ m: 'v2' }));
  assert.equal(op.willPlay('m', 'v2'), false, 'seen');
  assert.equal(op.willPlay('m', 'v3'), true, 'a new version');
  assert.equal(createOpening({ ...host, reduced: () => true }).willPlay('m', 'v3'), false, 'reduced motion');
});

test('V13X2-7 a frame on the first flow keeps the flow\'s cards above the tools: a pan, else the title and the flow a little smaller; across, no empty margin', async () => {
  const a = await app();
  assert.match(fn(a, 'fitView'), /if \(!done\) frameView\(explicit, base \+ ftBox\('ft-under', camera, null\)\.h \+ 8\);\n\s+if \(!at\.whole\) focusOverDock\(\);/);
  const f = fn(a, 'focusOverDock');
  assert.match(f, /const dock = mapBottom\(\) - mapBottomInset\(\) - 8, fs = toScreen\(f\); if \(fs\.y \+ fs\.h <= dock\) return;/);
  assert.match(f, /if \(s0 \+ dy >= topY\) \{ camera = \{ \.\.\.camera, y: camera\.y \+ dy \}; return; \}/);
  assert.match(f, /const k = camera\.k \* room \/ span; if \(k < camera\.k \* FOCUS_SHRINK\) return;/);
  assert.match(f, /B\.w \* k <= vw - 2 \* SAFE_SIDE \? \(vw - B\.w \* k\) \/ 2 - B\.x \* k :/);
});

test('V13X2-8 a 보기 the record does not offer stays in sight and says why when pressed; the top box\'s rows wait for the typed sentence', async () => {
  const a = await app(), c = await css();
  assert.match(fn(a, 'formSwitchEl'), /'aria-disabled': String\(!ok\), title: tip, onclick: \(\) => \(ok \? setMapForm\(f\) : toast\(tip\)\)/);
  assert.doesNotMatch(fn(a, 'formSwitchEl'), /disabled: !ok/);
  assert.match(c, /\.map-forms \.vf-form:disabled, \.map-forms \.vf-form\.off \{ color: var\(--text-4\); background: transparent; border-style: dashed; cursor: help; \}/);
  assert.match(c, /#space\.op-land #focus-top > :not\(\.ft-sentence\), #space\.op-land:not\(\.op-type\) #focus-top \{ opacity: 0; \}/);
  const op = await readFile(new URL('../src/client/opening.ts', import.meta.url), 'utf8');
  assert.match(op, /if \(t > landMs\) host\.space\(\)\.classList\.add\('op-type'\);/);
  assert.match(op, /host\.space\(\)\.classList\.remove\('op-run', 'op-land', 'op-type'\);/);
});
