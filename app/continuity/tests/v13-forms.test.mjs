// v13 forms (spec 3): the whole map's 보기 — 흐름 · 층 · 구성. The record chooses (its order of steps, its families), the person may switch
// (V, the header's switcher, kept per map), the cards fly from where they are to their new places, and every line keeps a corridor of its
// own on the form's grid. Each test fails on v12 (no forms). Fictional strings only.
// No browser: the pure parts run as built; the DOM code that uses them is read from the source (the rendered pages are checked by the
// headless checker of this round).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as F from '../dist/public/client/map-forms.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const html = () => readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));
const card = (id, family, type = null, name = id, h = 80) => ({ id, name, w: 224, h, family, type, anchor: 40 });
const ORDERED = '기록이 설명한 흐름';

test('V13F-1 the record chooses the form: 흐름 for an order of four steps over a quarter of the cards, 층 for three families on twelve cards, else 구성', () => {
  const twelve = [...'abcdefghijkl'].map((x, i) => card(x, ['participant', 'process', 'store'][i % 3]));
  const four = { steps: [['a'], ['b'], ['c'], ['d']], rule: 'summary', source: ORDERED, text: 'a → b → c → d' };
  const flow = F.formChoice(twelve, four);
  assert.equal(flow.auto, 'flow');
  assert.deepEqual(flow.offered, ['flow', 'layers', 'compose']);
  assert.match(flow.why, /기록에 이어진 흐름 4단계가 부품 12개 중 4개를 지나서 흐름으로 보여 줍니다/);
  const three = F.formChoice(twelve, { ...four, steps: [['a'], ['b'], ['c']] });
  assert.equal(three.auto, 'layers', 'three steps: offered, not chosen');
  assert.ok(three.offered.includes('flow'));
  assert.match(three.why, /기록된 표현군이 3가지\(참여·처리·저장\)라 층으로 보여 줍니다 · 이어진 흐름 3단계는 흐름에서 볼 수 있어요/);
  const thin = F.formChoice(twelve.concat([...'mnopqrstuvwx'].map(x => card(x, 'process'))), four);
  assert.equal(thin.auto, 'layers', 'four steps over 4 of 24 cards: under a quarter');
  const small = F.formChoice(twelve.slice(0, 9), null);
  assert.equal(small.auto, 'compose');
  assert.deepEqual(small.offered, ['layers', 'compose']);
  assert.match(small.not.flow, /기록에 순서를 말한 흐름이 없어 흐름으로 펼치지 않아요/);
  const two = F.formChoice(twelve.map(c => ({ ...c, family: c.family === 'store' ? 'process' : c.family })), null);
  assert.deepEqual(two.offered, ['compose']);
  assert.match(two.not.layers, /2가지\(참여·처리\)뿐이라 층으로 나누지 않아요/);
});

test('V13F-2 the flow\'s order is only one the record states (a scenario, an ordered summary, a first-structure line with arrows); an entry\'s fan is none', () => {
  const rep = id => (id === 'inner' ? 'box' : id === 'gone' ? null : id);
  const cands = [
    { rule: 'entry', source: '기록된 시작', text: null, steps: [['s'], ['t', 'u', 'v', 'w']], drawnLines: 9 },
    { rule: 'summary', source: '요약에 나온 연결', text: 'a, b, c, d, e', steps: [['a'], ['b'], ['c'], ['d'], ['e']], drawnLines: 4 },
    { rule: 'head', source: '기록의 첫 구조', text: 'p 다음에 q 그리고 r', steps: [['p'], ['q'], ['r']], drawnLines: 2 },
    { rule: 'head', source: '기록의 첫 구조', text: 'x → inner → box → gone → y', steps: [['x'], ['inner'], ['box'], ['gone'], ['y']], drawnLines: 1 },
  ];
  const c = F.recordedChain(cands, rep, ORDERED);
  assert.deepEqual(c.steps, [['x'], ['box'], ['y']], 'a part drawn on its group stands once; a step not drawn is dropped');
  assert.equal(F.statesAnOrder(cands[1], ORDERED), false, 'name order is no order');
  assert.equal(F.statesAnOrder({ rule: 'summary', source: ORDERED, text: 'a b' }, ORDERED), true);
  assert.equal(F.statesAnOrder({ rule: 'scenario', source: '기록된 시나리오', text: null }, ORDERED), true);
  assert.equal(F.statesAnOrder(cands[0], ORDERED), false);
  assert.equal(F.recordedChain([cands[0], cands[1]], rep, ORDERED), null);
});

test('V13F-3 bands are the record\'s families in its words (참여 · 촉발 · 처리 · 저장 · 관문, 외부 for an outside system); a card of no family is never dropped', () => {
  assert.equal(F.bandOf({ family: 'participant', type: 'external' }), 'external');
  assert.equal(F.bandOf({ family: null, type: 'external' }), 'external');
  assert.equal(F.bandOf({ family: 'participant', type: 'person' }), 'participant');
  assert.equal(F.bandOf({ family: 'gate', type: null }), 'store');
  assert.equal(F.bandOf({ family: null, type: 'automation' }), 'trigger');
  assert.equal(F.bandOf({ family: null, type: null }), 'undecided');
  assert.equal(F.bandWord('store', [{ family: 'gate', type: null }, { family: 'store', type: null }]), '저장 · 관문');
  assert.equal(F.bandWord('store', [{ family: 'store', type: null }]), '저장');
  assert.deepEqual(F.familiesOn([card('a', 'participant'), card('b', 'gate'), card('c', null, 'external'), card('d', null)]), ['participant', 'gate', 'external']);
  const cards = [card('u', 'participant', 'person'), card('k', 'trigger'), card('w', 'process'), card('db', 'store'), card('cloud', null, 'external'), card('odd', null)];
  const lines = [{ from: 'u', to: 'w', directed: true }, { from: 'k', to: 'w', directed: true }, { from: 'w', to: 'db', directed: true }, { from: 'w', to: 'cloud', directed: true }];
  const p = F.layersPlace(cards, lines);
  assert.deepEqual(p.lanes.map(l => l.text), ['참여', '촉발', '처리', '저장', '외부', '미정']);
  const y = id => p.at.get(id).y;
  assert.ok(y('u') < y('k') && y('k') < y('w') && y('w') < y('db') && y('db') < y('cloud') && y('cloud') < y('odd'), 'top to bottom in the record\'s family order');
  assert.equal(p.at.size, cards.length);
});

test('V13F-4 층 orders a band to cross fewer lines, keeps every band on one grid of columns, and wraps a long band', () => {
  // Two people over two workers, wired crosswise in the given order.
  const cards = [card('p1', 'participant', 'person'), card('p2', 'participant', 'person'), card('w1', 'process'), card('w2', 'process'), card('s', 'store')];
  const lines = [{ from: 'p1', to: 'w2', directed: true }, { from: 'p2', to: 'w1', directed: true }, { from: 'w1', to: 's', directed: true }];
  const p = F.layersPlace(cards, lines, new Map([['p1', { x: 0, y: 0 }], ['p2', { x: 300, y: 0 }], ['w1', { x: 0, y: 200 }], ['w2', { x: 300, y: 200 }]]));
  const size = new Map(cards.map(c => [c.id, c]));
  assert.equal(F.crossings(p.at, size, lines), 0, 'v12 had no such form');
  const pitch = 224 + F.LAYER_GAP_X, xs = [...p.at.values()].map(q => q.x);
  assert.ok(xs.every(x => Math.abs(x / pitch - Math.round(x / pitch)) < 1e-6), 'every card on the grid');
  const many = [...Array(14)].map((_, i) => card(`m${i}`, 'process')).concat([card('a', 'participant'), card('b', 'store')]);
  const q = F.layersPlace(many, many.slice(0, 14).map(c => ({ from: 'a', to: c.id, directed: true })), new Map(), 1.8);
  const rows = new Set(many.slice(0, 14).map(c => q.at.get(c.id).y));
  assert.ok(rows.size >= 2, 'a band of fourteen wraps to the window\'s shape');
  // No two cards overlap.
  const r = [...q.at].map(([id, at]) => ({ ...at, w: 224, h: 80, id }));
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) assert.ok(r[i].x + r[i].w <= r[j].x || r[j].x + r[j].w <= r[i].x || r[i].y + r[i].h <= r[j].y || r[j].y + r[j].h <= r[i].y, `${r[i].id} over ${r[j].id}`);
});

test('V13F-5 흐름 lays the record\'s steps on one row left to right; what feeds a step above it, what it feeds below; people at the ends; build parts in their own lane', () => {
  const cards = [card('in', 'process'), card('mid', 'process'), card('out', 'process'), card('end', 'store'),
    card('feed', 'process'), card('sink', 'store'), card('who', 'participant', 'person'), card('pack', null, 'automation', '묶음 빌드'), card('keeper', 'participant', 'person'), card('alone', 'process')];
  const lines = [
    { from: 'in', to: 'mid', directed: true }, { from: 'mid', to: 'out', directed: true }, { from: 'out', to: 'end', directed: true },
    { from: 'feed', to: 'mid', directed: true }, { from: 'out', to: 'sink', directed: true }, { from: 'who', to: 'in', directed: true },
    { from: 'end', to: 'in', directed: true }, { from: 'keeper', to: 'pack', directed: true }];
  const p = F.flowPlace(cards, lines, { steps: [['in'], ['mid'], ['out'], ['end']], rule: 'summary', source: ORDERED, text: 'in → mid → out → end' });
  const at = id => p.at.get(id);
  assert.deepEqual(p.row, ['in', 'mid', 'out', 'end']);
  assert.ok(at('in').x < at('mid').x && at('mid').x < at('out').x && at('out').x < at('end').x);
  assert.ok(['in', 'mid', 'out', 'end'].every(id => at(id).y === at('in').y), 'one row');
  assert.ok(at('feed').y < at('mid').y && Math.abs(at('feed').x - at('mid').x) < 1, 'a feeder over its step');
  assert.ok(at('sink').y > at('out').y && Math.abs(at('sink').x - at('out').x) < 1, 'what the step feeds under it');
  assert.ok(at('who').x < at('in').x && at('who').y === at('in').y, 'the person at the row\'s start, on the row');
  const lane = p.lanes.find(l => l.kind === 'build');
  assert.equal(lane.text, F.BUILD_LANE_WORD);
  assert.deepEqual(lane.ids, ['keeper', 'pack'], 'a maintainer who only meets the build joins its lane, sources first');
  assert.ok(at('pack').y > Math.max(...['feed', 'sink', 'who', 'in'].map(id => at(id).y)), 'the lane under everything');
  assert.deepEqual(p.back, [{ from: 'end', to: 'in' }], 'the way back');
  assert.deepEqual(p.lone, ['alone']);
  assert.equal(F.BUILD_LANE_WORD, '만들고 배포하는 길');
  assert.ok(F.buildLike({ name: 'CI 검사', type: null }) && F.buildLike({ name: '패키지 레지스트리', type: null }) && !F.buildLike({ name: '주문 처리', type: null }));
});

test('V13F-6 every line keeps a corridor of its own: the last run before an arrowhead long, the way back under the row, nothing reserved on a broken grid', () => {
  const box = (id, x, y) => ({ id, x, y, w: 224, h: 80 });
  const pitch = 224 + 128;
  const boxes = [box('a', 0, 0), box('b', pitch, 0), box('c', 2 * pitch, 0), box('d', pitch, 200)];
  const plan = F.planChannels(boxes, [{ key: 'ab', from: 'a', to: 'b' }, { key: 'ca', from: 'c', to: 'a' }, { key: 'ad', from: 'a', to: 'd' }], new Set(['ca']));
  const ab = plan.get('ab');
  assert.equal(ab.xs.length, 1); assert.deepEqual(ab.ys, []);
  assert.ok(pitch - ab.xs[0] >= 128 - F.PLAN_MARGIN - 1e-6 - 0, 'into b from the far side of the gap');
  const ca = plan.get('ca');
  assert.equal(ca.ys.length, 1); assert.ok(ca.ys[0] > 80, 'the way back runs under the row');
  const ad = plan.get('ad');
  assert.equal(ad.ys.length, 0, 'down the gap beside them');
  assert.equal(F.planChannels([box('a', 0, 0), box('b', 100, 0)], [{ key: 'x', from: 'a', to: 'b' }]).size, 0, 'cards moved over each other: the router searches');
});

test('V13F-7 V cycles the offered forms only; a kept choice holds while the record still offers it', () => {
  assert.equal(F.nextMapForm('flow', ['flow', 'layers', 'compose']), 'layers');
  assert.equal(F.nextMapForm('compose', ['flow', 'layers', 'compose']), 'flow');
  assert.equal(F.nextMapForm('layers', ['layers', 'compose']), 'compose');
  assert.equal(F.nextMapForm('compose', ['compose']), 'compose');
  const c = { offered: ['layers', 'compose'], auto: 'layers' };
  assert.equal(F.formShown(c, 'compose'), 'compose');
  assert.equal(F.formShown(c, 'flow'), 'layers', 'a kept 흐름 the record no longer offers');
  assert.equal(F.formShown(c, null), 'layers');
  assert.deepEqual(F.MAP_FORM_WORD, { flow: '흐름', layers: '층', compose: '구성' });
  assert.equal(F.FORM_SWITCH_WORD, '보기');
});

test('V13F-8 the page: the form places the whole map\'s top cards through the same layout and router, beside the map\'s name in the header', async () => {
  const a = await app(), h = await html();
  assert.match(a, /lay = baseLayout\(o, held, tpls\); formRelayout\(o, held, tpls\) \/\* v13 forms hook 1 \*\//);
  assert.match(fn(a, 'formRelayout'), /const formApplies|formApplies\(o\)/);
  assert.match(a, /const formApplies = \(o: Opened\) => scope === null && !o\.past && o\.view\.parts\.length > 0;/, 'the whole map of the current version only');
  assert.match(fn(a, 'withHints'), /list = formFaces\(list\);/);
  assert.match(fn(a, 'formFaces'), /planChannels\(top,/);
  assert.match(fn(a, 'openRoom'), /lay\.channels\.size \|\| formPlace/);
  assert.match(h, /<div id="map-forms-host" class="map-forms-host" hidden><\/div>/);
  const sw = fn(a, 'formSwitchEl');
  assert.match(sw, /'aria-disabled': String\(!ok\), title: tip, onclick: \(\) => \(ok \? setMapForm\(f\) : toast\(tip\)\)/,'a form not offered stays in sight, disabled, saying why when pressed');
  assert.match(sw, /'aria-pressed': String\(on\)/);
  assert.match(a, /agentflow\.mapForm\.\$\{o\.key\}/);
  assert.match(fn(a, 'keptMapForm'), /try \{ const v = localStorage\.getItem/);
});

test('V13F-9 the switch flies: the cards from where they are drawn, the camera from where it stood, the lines out and back; skipped under reduced motion', async () => {
  const a = await app(), c = await css(), s = fn(a, 'setMapForm');
  assert.match(s, /if \(reducedMotion\(\) \|\| world\.hidden\) \{[^\n]*renderSpace\('keep'\); fitView\(false\);/);
  assert.match(s, /new DOMMatrixReadOnly\(getComputedStyle\(el\)\.transform\)/, 'a flight under way starts from where the card is');
  assert.match(s, /sp\.classList\.add\('form-lines-out'\)/);
  // v13 fix 1: the flight's layer starts where the camera stood (the map takes its place where it lands).
  assert.match(s, /layer\.style\.transform = `translate\(\$\{cam0\.x\}px, \$\{cam0\.y\}px\) scale\(\$\{cam0\.k\}\)`;/);
  assert.match(s, /formTimers\.forEach\(t => clearTimeout\(t\)\)/, 'a new switch interrupts the last');
  assert.match(a, /!formSwitching \/\* v13 forms hook 4/, 'no second slide under the flight');
  assert.match(c, /\.world\.form-flight\.flying > \[data-box\] \{ transition: transform \.52s/);
  assert.match(c, /@media \(prefers-reduced-motion: reduce\) \{ \.world\.form-flight\.flying, \.world\.form-flight\.flying > \[data-box\], #world\.animate\.form-cam \{ transition: none !important; \} \}/);
  assert.equal(F.FORM_FLY_MS, 520);
  assert.ok(F.FORM_FLY_MS >= 450 && F.FORM_FLY_MS <= 600);
  assert.match(a, /\(e\.key === 'v' \|\| e\.key === 'V'\)[^\n]*opened && !openState[^\n]*\n\s*if \(cycleMapForm\(\)\)/, 'V on the map');
});

test('V13F-10 a card moved in a form stays for this tab in that form, never in the 구성 map\'s stored places; 자동 배치 lets it go', async () => {
  const a = await app();
  assert.match(a, /const pos = formDragTarget\(o, drag\.container\) \?\? positionsOf\(o\); \/\/ v13 forms hook 9/);
  assert.match(a, /if \(formArrange\(o\)\) return; \/\/ v13 forms hook 10/);
  assert.match(fn(a, 'formArrange'), /formDrags\.delete\(k\)/);
});
