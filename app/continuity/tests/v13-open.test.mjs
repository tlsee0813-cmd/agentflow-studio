// v13 A (spec 1, 2): the opening (a map comes into being from its recorded versions or its recorded chain, lands and is quiet), the
// selection light (a pick's rest recedes; hover at half strength; a lens the same way), the camera's flight for long jumps and the drag's
// glide. Each test fails on v12 (the modules, the hooks and the rules are new). Fictional strings only.
// No browser: the pure parts run as built; the DOM wiring is read from the source (the frames are shot by the headless kit of this round).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as O from '../dist/public/client/opening.js';
import * as F from '../dist/public/client/flight.js';
import * as L from '../dist/public/client/light.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const html = () => readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf('\n}\n', i)); };

/* ---------- a fictional bakery map, read four times ---------- */
// Boxes drawn now: a frame "kitchen" with oven and mixer inside, a till, a shelf, a courier (outside system). The record retired "old-oven"
// in v3 with oven as its successor, retired "flyer" in v4 with no successor, and renamed oven ("화덕" → "오븐") in v2.
const boxes = [{ id: 'kitchen', container: null }, { id: 'oven', container: 'kitchen' }, { id: 'mixer', container: 'kitchen' }, { id: 'till', container: null }, { id: 'shelf', container: null }, { id: 'courier', container: null }];
const edges = [{ key: 'e1', ids: ['r1'], from: 'mixer', to: 'oven' }, { key: 'e2', ids: ['r2'], from: 'oven', to: 'shelf' }, { key: 'e3', ids: ['r3'], from: 'till', to: 'courier' }, { key: 'e4', ids: ['r9'], from: 'shelf', to: 'till' }];
const drawn = new Set(boxes.map(b => b.id));
const rep = id => (drawn.has(id) ? id : null);
const names = new Map([['kitchen', '주방'], ['oven', '오븐'], ['mixer', '반죽기'], ['till', '계산대'], ['shelf', '진열대'], ['courier', '배달 대행']]);
const P = (id, name) => ({ id, name });
const versions = [
  { n: 1, parts: [P('kitchen', '주방'), P('mixer', '반죽기'), P('old-oven', '옛 화로'), P('flyer', '전단')], rels: [], retired: [] },
  { n: 2, parts: [P('kitchen', '주방'), P('mixer', '반죽기'), P('old-oven', '옛 화로'), P('flyer', '전단'), P('oven', '화덕'), P('shelf', '진열대')], rels: ['r1', 'r2'], retired: [] },
  { n: 3, parts: [P('kitchen', '주방'), P('mixer', '반죽기'), P('flyer', '전단'), P('oven', '오븐'), P('shelf', '진열대'), P('till', '계산대')], rels: ['r1', 'r2'], retired: [{ part: 'old-oven', name: '옛 화로', successor: 'oven' }] },
  { n: 4, parts: [P('kitchen', '주방'), P('mixer', '반죽기'), P('oven', '오븐'), P('shelf', '진열대'), P('till', '계산대'), P('courier', '배달 대행')], rels: ['r1', 'r2', 'r3'], retired: [{ part: 'flyer', name: '전단', successor: null }] },
];
const growthInput = { boxes, edges, rep, names, versions, chain: null, chainRels: [] };

test('V13-1 growth: every beat is one recorded version\'s whole state, in order, ending on the live map', () => {
  const plan = O.openingPlan(growthInput);
  assert.equal(plan.kind, 'growth');
  assert.deepEqual(plan.beats.map(b => b.version), [1, 2, 3, 4]);
  const [v1, v2, v3, v4] = plan.beats;
  // v1: the mixer and its frame; the old oven and the flyer have no place of their own (the old oven stands as an outline at its successor).
  assert.deepEqual(new Set(v1.show), new Set(['kitchen', 'mixer']));
  assert.deepEqual(v1.ghosts, [{ box: 'oven', part: 'old-oven', name: '옛 화로' }]);
  assert.equal(v1.caption, '기록을 읽은 판 v1 · 부품 4 · 지금 지도에 자리가 없는 부품 1', 'the flyer has no place now: counted, not drawn');
  // v2: the oven under the name the record gave it then; the outline still stands (the successor is there already: drawn around it).
  assert.deepEqual(v2.names, [['oven', '화덕']]);
  assert.equal(v2.ghosts.length, 1);
  assert.deepEqual(new Set(v2.lines), new Set(['e1', 'e2']), 'the version\'s relations, after its parts');
  // v3: renamed in place; the old oven dissolved into the oven on the version that retired it.
  assert.deepEqual(v3.names, []); assert.deepEqual(v3.ghosts, []);
  assert.ok(v3.show.includes('till') && !v3.show.includes('courier'));
  // v4: the live map: every box and line drawn now (a line no reading made, e4, is there).
  assert.deepEqual(new Set(v4.show), drawn); assert.deepEqual(new Set(v4.lines), new Set(edges.map(e => e.key)));
  assert.equal(v4.caption, '기록을 읽은 판 v4 · 부품 6');
  // The beats: 0.45–0.6 s each, the whole within 4.5 s with the landing.
  for (const b of plan.beats) assert.ok(b.ms >= O.BEAT_MIN_MS && b.ms <= O.BEAT_MAX_MS, `beat ${b.ms}`);
  assert.ok(O.openingLength(plan) <= O.OPEN_TOTAL_MS, `${O.openingLength(plan)}`);
});

test('V13-2 growth: more versions than the time holds are passed over (never blended); the first and last always shown', () => {
  const many = [];
  for (let n = 1; n <= 17; n++) many.push({ n, parts: [P('kitchen', '주방'), P('mixer', '반죽기'), ...(n >= 3 ? [P('oven', '오븐')] : []), ...(n >= 9 ? [P('shelf', '진열대')] : []), ...(n >= 12 ? [P('till', '계산대')] : []), ...(n >= 17 ? [P('courier', '배달 대행')] : [])],
    rels: [...(n >= 5 ? ['r1'] : []), ...(n >= 10 ? ['r2'] : []), ...(n >= 13 ? ['r3'] : []), ...(n >= 14 ? ['r9'] : [])], retired: [] });
  const plan = O.growthPlan({ ...growthInput, versions: many });
  const shown = plan.beats.map(b => b.version);
  assert.equal(shown[0], 1); assert.equal(shown.at(-1), 17);
  assert.deepEqual([...shown].sort((a, b) => a - b), shown, 'in the record\'s order');
  assert.ok(shown.length <= Math.floor(O.GROWTH_MAX_MS / O.BEAT_MIN_MS) + 1, `${shown.length} beats`);
  const states = O.versionStates({ ...growthInput, versions: many });
  // A version that changes nothing drawn is not a beat of its own (v2 is v1 again), and each beat equals its version's state exactly.
  assert.ok(!shown.includes(2));
  for (const b of plan.beats) { const s = states.find(x => x.n === b.version); assert.deepEqual(new Set(b.show), s.show); assert.deepEqual(new Set(b.lines), s.lines); }
  assert.deepEqual(plan.versions, many.map(v => v.n), 'the strip has every version as a tick');
  // A tight budget (the rebuild took time) gives fewer beats, never shorter ones.
  const tight = O.growthPlan({ ...growthInput, versions: many }, 3000);
  assert.ok(tight.beats.length < plan.beats.length && tight.beats.every(b => b.ms >= O.BEAT_MIN_MS || b.version === 17));
});

test('V13-3 one version: the recorded chain step by step (0.25 s each, 2.2 s at most), its lines once both ends are there, then the rest', () => {
  const inp = { ...growthInput, versions: [], chain: [['mixer'], ['oven'], ['shelf']], chainRels: ['r1', 'r2'] };
  const plan = O.openingPlan(inp);
  assert.equal(plan.kind, 'chain');
  assert.deepEqual(plan.beats.map(b => b.caption), Array(4).fill(O.CHAIN_CAPTION));
  assert.deepEqual(new Set(plan.beats[0].show), new Set(['mixer', 'kitchen']), 'a step with the frame it sits in');
  assert.deepEqual(plan.beats[0].lines, []); assert.deepEqual(plan.beats[1].lines, ['e1']); assert.deepEqual(new Set(plan.beats[2].lines), new Set(['e1', 'e2']));
  assert.deepEqual(new Set(plan.beats[3].show), drawn, 'then every other part and relation together');
  assert.equal(plan.beats[3].ms, O.REST_MS);
  for (const b of plan.beats.slice(0, -1)) assert.equal(b.ms, O.STEP_MS);
  const long = O.openingPlan({ ...inp, chain: Array.from({ length: 12 }, (_, i) => [['mixer', 'oven', 'shelf', 'till', 'courier', 'kitchen'][i % 6]]) });
  assert.ok(long.beats.slice(0, -1).reduce((s, b) => s + b.ms, 0) <= O.CHAIN_MAX_MS);
  // No recorded chain (or a chain of one step): everything fades in together, no caption.
  for (const chain of [null, [['mixer']]]) { const f = O.openingPlan({ ...inp, chain }); assert.equal(f.kind, 'fade'); assert.equal(f.beats.length, 1); assert.equal(f.beats[0].caption, null); assert.equal(f.beats[0].ms, O.FADE_MS); }
});

test('V13-4 the opening is remembered per project and version (a storage that fails plays it again), types and settles', () => {
  const store = new Map(), get = k => store.get(k) ?? null, set = (k, v) => store.set(k, v);
  assert.equal(O.seenNow(O.readSeen(get), 'p1', 'MR_9'), false);
  O.markSeen(get, set, 'p1', 'MR_9');
  assert.equal(O.seenNow(O.readSeen(get), 'p1', 'MR_9'), true);
  assert.equal(O.seenNow(O.readSeen(get), 'p1', 'MR_10'), false, 'a new version plays again');
  assert.equal(O.seenNow(O.readSeen(get), 'p2', 'MR_9'), false);
  assert.doesNotThrow(() => O.markSeen(() => { throw new Error('blocked'); }, () => { throw new Error('blocked'); }, 'p1', 'x'));
  assert.deepEqual(O.readSeen(() => 'not json'), {});
  assert.deepEqual(O.typedTexts(['가나다', '라마'], 4), ['가나다', '라']);
  assert.deepEqual(O.typedTexts(['가나다', '라마'], 99), ['가나다', '라마']);
  const c = { x: 100, y: 50, k: 0.5 }, s = O.settled(c, O.SETTLE_FROM, 1000, 800);
  assert.equal(s.k, 0.5 * 1.03); assert.deepEqual(O.settled(c, 1, 1000, 800), c);
  // The viewport's centre stays put under the settle.
  assert.ok(Math.abs((500 - s.x) / s.k - (500 - c.x) / c.k) < 1e-9);
});

test('V13-5 flight: the van Wijk–Nuij path goes out and back in for a far jump, lands exactly, in 0.5–0.8 s', () => {
  const vw = 1200, vh = 800, from = { x: 0, y: 0, k: 1 }, to = { x: -3000, y: -400, k: 1 };
  assert.equal(F.longJump(from, to, vw, vh), true);
  assert.equal(F.longJump(from, { x: -60, y: 0, k: 1 }, vw, vh), false, 'a short pan keeps the plain eased move');
  assert.equal(F.longJump(from, { x: 0, y: 0, k: 1.8 }, vw, vh), true, 'a large zoom change flies');
  const f = F.flightAt(from, to, vw, vh);
  assert.ok(f.ms >= F.FLIGHT_MIN_MS && f.ms <= F.FLIGHT_MAX_MS, `${f.ms}`);
  const mid = f.at(f.ms / 2), start = f.at(0);
  assert.ok(mid.k < 0.8, `zooms out on the way (${mid.k})`);
  assert.ok(Math.abs(start.x - from.x) < 1e-6 && Math.abs(start.k - 1) < 1e-9);
  assert.equal(f.at(f.ms), null, 'landed');
  const p = F.zoomPath(F.viewOf(from, vw, vh), F.viewOf(to, vw, vh)), end = F.camOf(p.at(1), vw, vh);
  assert.ok(Math.abs(end.x - to.x) < 1e-6 && Math.abs(end.y - to.y) < 1e-6 && Math.abs(end.k - 1) < 1e-9);
});

test('V13-6 glide: a let-go drag keeps its speed and slows by 0.92 a frame; a paused hand does not glide', () => {
  const trail = [{ t: 0, x: 0, y: 0 }, { t: 40, x: 20, y: 0 }, { t: 80, x: 40, y: 0 }];
  const v = F.releaseSpeed(trail, 85);
  assert.ok(Math.abs(v.vx - 0.5) < 1e-9 && v.vy === 0);
  assert.deepEqual(F.releaseSpeed(trail, 300), { vx: 0, vy: 0 }, 'held still before letting go');
  const s = F.inertiaStep({ vx: 1, vy: 0 }, 1000 / 60);
  assert.ok(Math.abs(s.vx - F.DECAY) < 1e-9);
});

test('V13-7 the motion controller: a long animated move flies frame by frame and any input stops it where it is', () => {
  let t = 0, queued = null, stop = null; const writes = []; let landed = 0;
  const m = F.createMotion({ write: c => writes.push(c), size: () => ({ w: 1200, h: 800 }), reduced: () => false, land: () => { landed++; },
    now: () => t, frame: cb => { queued = cb; return 1; }, cancel: () => { queued = null; }, listen: fn => { stop = fn; return () => { stop = null; }; } });
  assert.equal(m.take({ x: 0, y: 0, k: 1 }, false), false, 'a direct write');
  assert.equal(m.take({ x: -3000, y: 0, k: 1 }, true, false), false, 'a long move nobody asked to fly keeps the plain move');
  m.take({ x: 0, y: 0, k: 1 }, false);
  assert.equal(m.take({ x: -3000, y: 0, k: 1 }, true), true, 'a long jump flies');
  t = 200; queued(t); assert.ok(writes.length === 1 && writes[0].k < 1, 'a frame on the path');
  assert.equal(m.take({ x: -3000, y: 0, k: 1 }, false), true, 'the same target keeps flying (another sync of it)');
  stop(new Event('pointerdown'));
  assert.equal(m.flying(), false); assert.equal(landed, 1);
  const at = F.viewOf(m.shown(), 1200, 800); assert.ok(at.cx > 600 && at.cx < 3600 && m.shown().k < 1, 'stopped where it was, on the way');
  // Reduced motion: no flight.
  const r = F.createMotion({ write: () => {}, size: () => ({ w: 1200, h: 800 }), reduced: () => true, land: () => {}, frame: () => 1, cancel: () => {}, listen: () => () => {} });
  r.take({ x: 0, y: 0, k: 1 }, false); assert.equal(r.take({ x: -3000, y: 0, k: 1 }, true), false);
  assert.equal(r.glide({ vx: 2, vy: 0 }, () => {}), false);
  // A glide moves and decays until it is slow; input stops it.
  let moved = 0; t = 0;
  const g = F.createMotion({ write: () => {}, size: () => ({ w: 1200, h: 800 }), reduced: () => false, land: () => {}, now: () => t, frame: cb => { queued = cb; return 1; }, cancel: () => { queued = null; }, listen: fn => { stop = fn; return () => {}; } });
  assert.equal(g.glide({ vx: 1, vy: 0 }, dx => { moved += dx; }), true);
  for (let i = 1; i <= 5; i++) { t = i * 16.7; queued(t); }
  assert.ok(moved > 30 && g.gliding());
  stop(new Event('wheel')); assert.equal(g.gliding(), false);
});

test('V13-8 light: the receded copy is the rest picture less what stays lit, at a screen width that holds at any zoom', () => {
  assert.deepEqual(L.ghostKeys(['a', 'b', 'sum:x'], ['a', 'b', 'c'], new Set(['a'])), ['b', 'sum:x'], 'the picture seen at rest');
  assert.deepEqual(L.ghostKeys(null, ['a', 'b', 'sum:x'], new Set(['a'])), ['b'], 'no rest picture: each single line');
  assert.equal(L.perU(4, 2), 2);
  assert.equal(L.dashPerU('none', 2), 'none');
  assert.equal(L.dashPerU('8px, 4px', 2), 'calc(4 * var(--u) * 1px) calc(2 * var(--u) * 1px)');
  assert.equal(L.GHOST_OPACITY, 0.25); assert.equal(L.LIGHT_MS, 180);
});

// Contrast of the receded words on a receded card (WCAG relative luminance), from the tokens the rules use.
const hex = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, p) => a.map((v, i) => Math.round(v * p + b[i] * (1 - p)));
// saturate(s) as the filter spec defines it (feColorMatrix saturate).
const saturate = ([r, g, b], s) => [
  0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
].reduce((out, k, i) => { out[Math.floor(i / 3)] += k * [r, g, b][i % 3]; return out; }, [0, 0, 0]).map(v => Math.max(0, Math.min(255, Math.round(v))));

test('V13-9 receded words stay at 4.5:1 or more (a pick\'s rest, a hover\'s rest, a lens\'s off cards)', async () => {
  const s = await css(), root = s.slice(s.indexOf(':root'), s.indexOf('}', s.indexOf(':root')));
  const tok = n => hex(new RegExp(`--${n}: (#[0-9a-f]{6})`, 'i').exec(root)[1]);
  const surface = tok('surface'), bg = tok('bg');
  const v13 = s.slice(s.indexOf('/* ---------- v13 opening and light'));
  assert.match(v13, /#space\.lt-sel #world > \.node:not\(\.selected\):not\(\.related\)[^{]*\{ opacity: 1; filter: saturate\(\.5\); background-color: color-mix\(in srgb, var\(--surface\) 40%, var\(--bg\)\);/);
  assert.match(v13, /#space\.peek:not\(\.dim\) #world > \.node:not\(\.near-end\)[^{]*\{ opacity: 1; filter: saturate\(\.75\); background-color: color-mix\(in srgb, var\(--surface\) 70%, var\(--bg\)\);/, 'hover: the same at half strength (v12: opacity .45)');
  const receded = mix(surface, bg, 0.4), half = mix(surface, bg, 0.7);
  for (const t of ['text', 'text-2', 'text-3', 'text-4']) for (const [card, sat] of [[receded, 0.5], [half, 0.75]]) {
    const r = ratio(saturate(tok(t), sat), saturate(card, sat));
    assert.ok(r >= 4.5, `--${t} on a receded card: ${r.toFixed(2)}`);
  }
  // The family inks a card keeps under the light.
  for (const f of ['participant', 'process', 'store', 'trigger', 'neutral']) { const r = ratio(saturate(tok(`fam-${f}-ink`), 0.5), saturate(receded, 0.5)); assert.ok(r >= 4.5, `${f} ink ${r.toFixed(2)}`); }
  // No opacity on a receded card any more (it took its words under 4.5:1).
  assert.doesNotMatch(v13, /lt-sel[^{]*\.node[^{]*\{[^}]*opacity: 0?\.\d/);
});

test('V13-10 the wiring: the opening on a fresh map, a redraw ends it, 다시 보기 in the tools, the light in markSelection, the camera through the motion', async () => {
  const a = await app(), r = fn(a, 'render'), rs = fn(a, 'renderSpace'), ms = fn(a, 'markSelection'), cam = fn(a, 'applyCamera'), canvas = fn(a, 'bindCanvas');
  assert.match(r, /if \(fresh && !part && !scope && !o\.past && !planView\.isOpen\(\) && !returnView\.isOpen\(\) && o\.view\.parts\.length\) opening\.arrive\(o\.key, openingVersion\(o\), askedAt\);/, 'v13 fix 1: counted from the ask');
  assert.match(rs, /opening\.skip\(\); opening\.offer\(!scope && !o\.past && !growthCmp && !growthPast && o\.view\.parts\.length > 0\);/);
  assert.ok(rs.indexOf('opening.skip()') < rs.indexOf('fitView(false)'), 'before the fit measures the tools');
  assert.match(ms, /light\.before\(\$\('world'\), me\);/); assert.match(ms, /light\.after\(\$\('world'\), me, \$\('space'\)\.classList\.contains\('sel-fold'\)\);/);
  assert.match(cam, /const flies = motion\.take\(camera, animate && !opening\.running\(\), flyNext\); flyNext = false;/);
  // Only a jump the person asked for flies (a restore, a fit, a zoom keep the plain move: what reads the map after them reads it settled).
  for (const f of ['revealRect', 'growthReveal']) assert.match(fn(a, f), /flyNext = true; if \(dx \|\| dy\) \{ camera = \{ \.\.\.camera, x: camera\.x \+ dx, y: camera\.y \+ dy \}; applyCamera\(true\); \} flyNext = false;/, f);
  assert.doesNotMatch(fn(a, 'growthExit'), /flyNext/);
  assert.match(cam, /if \(!flies\) writeCamera\(camera\);/);
  assert.match(canvas, /motion\.glide\(v, \(dx, dy\) => \{ camera = \{ \.\.\.camera, x: camera\.x \+ dx, y: camera\.y \+ dy \}; applyCamera\(\); \}\);/);
  assert.match(a, /\$\('replay-open'\)\.addEventListener\('click'/);
  // The model is sent nothing new: the opening reads the versions the growth view reads (map-growth), never a prompt.
  assert.match(a, /import \{ versionAt \} from '\.\.\/shared\/map-growth\.js';/);
  const h = await html();
  assert.match(h, /<button type="button" id="replay-open" class="replay-open" title="[^"]*" hidden>[\s\S]*?<span>다시 보기<\/span><\/button>/);
  // In the top bar beside the project's name, never among the map's tools (a draft put it there: at 1280 the first view left the tools' row
  // and the fit shrank 69% → 63%).
  assert.ok(h.indexOf('id="replay-open"') > h.indexOf('id="scene-back"') && h.indexOf('id="replay-open"') < h.indexOf('id="modebar"'));
  assert.ok(!h.slice(h.indexOf('<div class="controls"'), h.indexOf('<div id="growth-line"')).includes('replay-open'));
  const s = await css(), v13 = s.slice(s.indexOf('/* ---------- v13 opening and light'));
  assert.match(v13, /#space\.op-run #world \{ pointer-events: none; \}/, 'nothing under the pointer while it plays: any press ends it');
  assert.match(v13, /\.lt-ghosts \{ opacity: \.25; pointer-events: none;/);
  assert.match(v13, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(v13, /#space #world\.arranging > \[data-box\]:not\(\.dragging\) \{ transition: left \.28s/, 'the arrange slide keeps its move');
});

test('V13-11 a lens recolours the cards by the same light (half their colour, never a grey contrast step)', async () => {
  const s = await css();
  assert.doesNotMatch(s, /lens-off[^{]*\{[^}]*grayscale/, 'v12: grayscale(1) contrast(.65) brightness(1.22) took quiet words under 4.5:1');
  assert.match(s, /\.space \.node\.lens-off:not\(\.selected\):not\(\.related\):not\(\.lg-pick\):not\(:hover\):not\(:focus-visible\) \{ opacity: 1; filter: saturate\(\.5\); \}/);
  assert.match(s, /#space #world > \.node\.lens-off:not\(\.selected\)[^{]*\{ background-color: color-mix\(in srgb, var\(--surface\) 40%, var\(--bg\)\); \}/);
});

test('V13-12 a type chip never takes a form its widest squeezes (v12 left 「Promise 이행 또는 AxiosError 거부」 and its fields cut inside a 258px chip)', async () => {
  const t = fn(await app(), 'placeTypeChip');
  assert.match(t, /fillTypeChip\(chip, form\);\n[^\n]*\n    if \(\[\.\.\.chip\.children\]\.some\(c => \(c as HTMLElement\)\.scrollWidth > \(c as HTMLElement\)\.clientWidth \+ 1\)\) continue;\n    const spot = labelSpots\(/);
});
