// v14 fix 2: the defects the second verify round of v14-merged found (the lit flow landing with no words, its context lines strong at rest,
// frames leaving cards in the fade over the tools, 흐름 framed off its row's start, the legend gone with the coverage line, names cut in the top
// box, the title's date line cut at 자세히, tags keeping their role while their name lost its bracket, type chips cut inside a word, kind
// lines past their tags) and the first reactions' 「a fan is no 주 흐름」. Each test fails on v14-merged fix 1 (7b0b9754). Fictional strings only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as C from '../dist/public/client/clear-rest.js';
import * as L from '../dist/public/client/map-labels.js';
import * as P from '../dist/public/client/plain-words.js';
import { switcherText, switcherForms } from '../dist/public/client/first-flow.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf('\n}\n', i)); };

test('V14F2-1 a lit line\'s other whole forms: its plain units (「 등」 when some went to the hover), without a bracket, its first unit, then its kind word', () => {
  // All code: only the kind word is left (at 쉽게); at 자세히 the words themselves first.
  assert.deepEqual(C.litForms('bakeOrder·saveDough·saveCrumb', true, '넘겨줌'), ['넘겨줌']);
  assert.equal(C.litForms('bakeOrder·saveDough', false, '넘겨줌')[0], 'bakeOrder·saveDough');
  // Plain units kept in order, the code ones left to the hover with 「 등」.
  const f = C.litForms('반죽 쓰기·읽기 · dough_row · 오븐 행', true, '넘겨줌');
  assert.equal(f[0], '반죽 쓰기·읽기 · 오븐 행 등');
  assert.ok(f.includes('반죽 쓰기·읽기 등'));
  assert.equal(f.at(-1), '넘겨줌');
  // A bracket's words go to the hover when the whole is too wide (the caller tries each in turn).
  assert.deepEqual(C.litForms('오븐 메시지(topic crust 등)', true, '넘겨줌').slice(0, 2), ['오븐 메시지(topic crust 등)', '오븐 메시지']);
  // Never a 「…」, never one side of an OR, never past LIT_FORM_MAX; a control line's channel word is no unit.
  for (const s of ['반죽 쓰기 또는 굽기', '아주 긴 반죽 배합 단계에서 넘기는 오븐 온도와 시간 기록 묶음', '기동 · bakeLoop', '굽기…']) for (const x of C.litForms(s, true, '넘겨줌')) {
    assert.ok(!x.includes('…') && !/또는/.test(x) && x.length <= C.LIT_FORM_MAX, x);
    assert.ok(!/^기동/.test(x), x);
  }
  assert.equal(C.litKindWord('control', '넘겨줌', true), '시작시킴');
  assert.equal(C.litKindWord('control', '넘겨줌', false), '제어');
  assert.equal(C.litKindWord('data', '넘겨줌', true), '넘겨줌');
});

test('V14F2-2 the page tries a lit line\'s forms until one has a place (beside a short run too), and a fan says its kind word once', async () => {
  const a = await app(), pr = fn(a, 'placeRestLabels');
  assert.match(pr, /litForms\(labelPlain\(lineFull\.get\(e\.key\) \?\? ''\) \?\? '', easy\(\), kindForm\.replace/);
  assert.match(pr, /for \(const f of forms\) \{\n        if \(carrier && f === kindForm\) \{ sharedTo = carrier; break; \}/);
  assert.match(pr, /if \(!litRest\) break;/);
  assert.match(pr, /const got = \[\.\.\.besideSpots\(pts, w, hh, 3 \* inv, 'long'\), \.\.\.midSpots\(pts, w, hh, 3 \* inv\), \.\.\.midSpots\(pts, w, hh, 12 \* inv\)\]/);
  assert.match(pr, /g\.classList\.add\(c\.isConnected && !dropped\.includes\(c\.dataset\.key!\) \? 'label-shared' : 'label-hidden'\)/);
  // The uncut words are kept per line for it.
  assert.match(a, /lineFull\.set\(e\.key, lineWord\(e, ch, relInfo, false\)\)/);
  assert.match(a, /world\.querySelectorAll\('\.edge\.label-hidden, \.edge\.label-shared'\)/);
});

test('V14F2-3 midSpots: centred beside each level or upright run however short, gap off it, the longest run first', () => {
  const pts = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 60 }];
  const r = L.midSpots(pts, 30, 10, 3);
  assert.equal(r.length, 4);
  // The upright run (60) first: right and left of its middle.
  assert.deepEqual(r[0], { x: 23, y: 25, w: 30, h: 10 });
  assert.deepEqual(r[1], { x: -13, y: 25, w: 30, h: 10 });
  // The level run (20, shorter than the label): above and below its middle.
  assert.deepEqual(r[2], { x: -5, y: -13, w: 30, h: 10 });
  assert.deepEqual(r[3], { x: -5, y: 3, w: 30, h: 10 });
});

test('V14F2-4 in the clear state only the main flow is strong: its context lines and their labels are quiet and counted with the quiet ones', async () => {
  const s = await css(), a = await app();
  assert.match(s, /#space\.cl-on #world \.edge:not\(\.ff-flow\):not\(\.on\):not\(\.near\)[^{]*\.edge-line \{ opacity: \.35; \}/);
  assert.ok(!/#space\.cl-on #world \.edge:not\(\.ff-flow\):not\(\.ff-ctx\)/.test(s), 'ff-ctx is no longer kept strong in the clear state');
  assert.match(s, /#space\.ff-on\.ff-rest:not\(\.cl-on\) \.world \.edge\.ff-ctx:not\(\.on\)/);
  assert.match(s, /:is\(\.edge-label:not\(\.fit-cond\), \.edge-count\):is\(:not\(\.ff-keep\), \.ff-ctxk\)/);
  assert.match(fn(a, 'clearRow'), /lit: g\.classList\.contains\('ff-flow'\) \|\| \(!on && g\.classList\.contains\('ff-ctx'\)\)/);
  assert.match(fn(a, 'markFocusLabels'), /el\.classList\.toggle\('ff-ctxk', !ffLensPicked && ks\.some\(k => keep\.has\(k\)\) && !ks\.some\(k => flowKeys\.has\(k\)\)\)/);
});

test('V14F2-5 a frame on the flow sets the short fade between rows of cards (zoom out a little, or down), and 흐름 reads from its row\'s start', async () => {
  const a = await app(), s = await css();
  assert.match(a, /if \(!explicit\) \{ sidesClear\(\); bottomClear\(\); \}/);
  assert.match(a, /const BOTTOM_SHRINK = 0\.8, BOTTOM_DROP = 48, FADE_TOP_PX = 12, FADE_END_PX = 2;/);
  const bc = fn(a, 'bottomClear');
  assert.match(bc, /for \(let k = k0; k >= Math\.max\(FIRST_FIT_MIN, k0 \* BOTTOM_SHRINK\) - 1e-9 && best\.n; k -= 0\.004\)/);
  assert.match(bc, /for \(let dy = 0; dy <= BOTTOM_DROP && best\.n; dy \+= 2\)/);
  assert.match(fn(a, 'bottomCut'), /z > ft && t < fe/);
  assert.match(s, /\.space:not\(\.cmp-foot\) > \.viewport \{ -webkit-mask-image: linear-gradient\(to bottom, #000 calc\(100% - var\(--dock-h, 58px\) - 12px\), transparent calc\(100% - var\(--dock-h, 58px\) \+ 2px\)\)/);
  const sc = fn(a, 'sidesClear');
  assert.match(sc, /if \(f && formPlace && formNow === 'flow' && camera\.x \+ x0 \* k0 < -0\.5\)/);
  assert.match(sc, /for \(let d = 0; d <= ROW_START_SLIDE; d \+= 2\) for \(const x of d \? \[base \+ d, base - d\] : \[base\]\) \{\n        if \(x \+ x0 \* k < 0 \|\| x \+ \(Number\.isFinite\(litEnd\) \? litEnd : f\.x \+ f\.w\) \* k > vpw - SAFE_SIDE \|\| cardCut\(x, k\)\) continue;/);
  assert.match(sc, /const litEnd = Math\.max\(-Infinity, \.\.\.\[\.\.\.\$\('world'\)\.querySelectorAll<HTMLElement>\(':scope > \.node\.ff-card'\)\]/, 'the flow\'s end is its lit cards\'');
  assert.match(sc, /const cardCut = \(x: number, k: number\) => cards\.some\(/, 'a lane wider than the window is no cut card');
});

test('V14F2-6 what stays outside the window or under the tools keeps a cue: how many and where, the whole map one press away', async () => {
  const a = await app(), oc = fn(a, 'offCue');
  assert.match(a, /clipAtEdge\(\); offCue\(\); \/\/ v14 fix 2/);
  assert.match(oc, /cue\.textContent = `화면 밖 카드 \$\{n\}개 · \$\{where\}`;/);
  assert.match(oc, /onclick: \(\) => fitView\(true, true\)/);
  assert.match(oc, /if \(o && !opening\.running\(\) && !growthCmp && !growthPast && !sp\.hidden\)/);
  // In the bottom row beside what stands there when it has room, never over the map's cards.
  assert.match(oc, /if \(right \+ 8 \+ cw <= sp\.clientWidth - SAFE_SIDE\)/);
});

test('V14F2-7 the shapes\' legend stays at 쉽게 when the coverage line gives way (on the caption\'s row)', async () => {
  const a = await app(), sy = fn(a, 'shapeYield'), s = await css();
  assert.match(sy, /if \(kinds && host\) \{ kinds\.classList\.add\('mk-in-row'\); host\.append\(kinds\); \}/);
  assert.match(sy, /el\.querySelector<HTMLElement>\(':scope > \.ft-clear'\) \?\? el\.querySelector<HTMLElement>\(':scope > \.ft-switch'\)/);
  assert.match(s, /\.space\.words-easy \.focus-top \.map-kinds\.mk-in-row \{ display: inline-flex; \}/);
});

test('V14F2-8 the top box\'s main flow says every name whole; a line too long gives way between names, never inside one', () => {
  const long = { a: '저장 묶음 직렬화 관문(SaveBundle)', b: 'ReadWriteDoughProxy·압축 워커', c: '자동 배정(매칭·inbox 태그)' };
  const e = { rule: 'summary', key: 'k', source: '기록이 설명한 흐름', text: null, parts: ['a', 'b', 'c'], steps: [['a'], ['b'], ['c']], chain: [['a'], ['b'], ['c']], lines: [], drawnLines: 2, more: 0, gaps: [] };
  const f = { rule: 'summary', kept: false, candidates: [e], index: 0, flow: e }, nm = id => long[id];
  const t = switcherText(f, nm);
  for (const n of Object.values(long)) assert.ok(t.includes(n), n);
  assert.ok(!/[^.]…[^ ]/.test(t.replace(/ … /g, ' ')), t);
  for (const form of switcherForms(f, nm)) for (const piece of form.split(/ → | · |: /)) assert.ok(piece === '…' || !piece.includes('…'), form);
});

test('V14F2-9 the title\'s own date line gives up its version, then its time, rather than a CSS 「…」 (as the basis line does)', async () => {
  const fb = fn(await app(), 'fitBasisLines');
  assert.match(fb, /'#world \.map-basis, #scope-sticky \.map-basis, #world \.map-when, #scope-sticky \.sticky-when'/);
});

test('V14F2-10 a tag\'s name takes its kind line\'s rows before it is shortened; a shortened name reads with no role (a person\'s mark stays)', async () => {
  const a = await app(), fc = fn(a, 'fitCards'), fk = fn(a, 'fitTagKind');
  assert.match(fc, /if \(!f\.full && rows > f\.lines\.length && rows > x\.lines\) \{ const g = fitTag\(x\.name, x\.width, rows, x\.measure, x\.px, x\.slack\); if \(g\.full\) f = g; \}/);
  assert.match(fc, /if \(left < TAG\.kindLh - 0\.5\) x\.el\.classList\.remove\('tag-kind'\);\n    fitTagKind\(x\.el, x\.width, left, !f\.full\);/);
  assert.match(fk, /role = ez && !nameOnly \? kd\.dataset\.role \?\? '' : ''/);
  assert.match(fk, /mark \|\| nameOnly \? \{ text: '', how: 'none' \}/);
});

test('V14F2-11 a kind line of marks alone is measured in the mark\'s type; with no row for it, the lifecycle word alone', async () => {
  const fk = fn(await app(), 'fitTagKind');
  assert.match(fk, /const preFit = \(t: string\) => wrapWords\(t, width, s => tagMeasure\(s, TAG\.kind, 600\) \* 1\.03 \+ 2\)\?\.length \?\? 99;/);
  assert.match(fk, /const dropMark = !shown && !!mark && !!life && preFit\(pre\) > rows/);
});

test('V14F2-12 a type chip at rest never shows a form squeezed inside a word (its plain label instead)', async () => {
  const pr = fn(await app(), 'placeRestLabels');
  assert.match(pr, /fillTypeChip\(chip, form\); if \(\[\.\.\.chip\.children\]\.some\(c => \(c as HTMLElement\)\.scrollWidth > \(c as HTMLElement\)\.clientWidth \+ 1\)\) \{ mine = \[\]; continue; \}/);
});

test('V14F2-13 at 쉽게 a recorded start\'s lines are said as its start\'s (「시작점: …」), never as 주 흐름; 자세히 keeps 먼저 볼 연결', async () => {
  P.setPlainLevel('easy');
  assert.equal(P.entryLead('주 흐름: 오븐 관리자에서 나가는 연결 3개 · 기록된 시작'), '시작점: 오븐 관리자에서 나가는 연결 3개 · 기록된 시작');
  assert.equal(P.entryLead('주 흐름만'), '주 흐름만');
  P.setPlainLevel('detail');
  assert.equal(P.entryLead('먼저 볼 연결: 오븐 관리자에서 나가는 연결 3개'), '먼저 볼 연결: 오븐 관리자에서 나가는 연결 3개');
  P.setPlainLevel('easy');
  assert.match(fn(await app(), 'plainTop'), /const entry = ffShown\(\)\?\.rule === 'entry', lead = \(t: string\) => \(entry \? entryLead\(t\) : t\);/);
});

test('V14F2-14 a card wholly under the fade\'s end steps out (not drawn, nothing under the tools), the cue counting it', async () => {
  const a = await app(), s = await css();
  assert.match(fn(a, 'clipAtEdge'), /c\.classList\.toggle\('dock-hid', q\.height > 0 && q\.top >= fe - 0\.5\);/);
  assert.match(s, /#world > :is\(\.node, \.ghost\)\.dock-hid \{ visibility: hidden; \}/);
});

test('V14F2-15 the landed map is looked at again for cards under the tools once its landing settled', async () => {
  const a = await app();
  assert.match(a, /landed: \(\) => \{ applyCamera\(\); requestAnimationFrame\(refitUnderBox\); window\.setTimeout\(clipAtEdge, LANDED_CLIP_MS\); \}/);
  assert.match(a, /const LANDED_CLIP_MS = 700;/);
});

test('V14F2-16 in the clear state the main flow\'s labels at the overview go before every lens\'s fit labels (which keep off them)', async () => {
  const pl = fn(await app(), 'placeLineLabels');
  assert.match(pl, /const litFirst = restLabels\(tier\) === 'counts' && \$\('space'\)\.classList\.contains\('cl-on'\)/);
  assert.ok(pl.indexOf('placeRestLabels(box, litFirst, clear);') < pl.indexOf('const fit = face === \'tag\' ? placeFitLabels('), 'the lit labels first');
  assert.match(pl, /blocks\.push\(\{ x, y, w: l\.offsetWidth \* inv, h: l\.offsetHeight \* inv \}\);/);
  assert.match(pl, /if \(litNow\.length && !litFirst\.length\) \{ placeRestLabels\(box, litNow, clear\);/);
});

test('V14F2-17 a lit line\'s cut words never end on an arrow, a comma or a colon pointing at what was cut', async () => {
  assert.ok(fn(await app(), 'litWords').includes(String.raw`.replace(/[\s·,:;→>-]+$/u, '')`));
});

test('V14F2-18 a name a box holds whole only on one more line takes a smaller type (never under WHOLE_MIN_PX), its lines as close as its type', async () => {
  const fc = fn(await app(), 'fitCards');
  assert.match(fc, /for \(let s = 0\.92; !f\.full && s \* x\.px >= WHOLE_MIN_PX - 1e-9; s -= 0\.04\) \{/);
  assert.match(fc, /const g = fitTag\(x\.name, x\.width \/ s, more, x\.measure, x\.px, x\.slack \/ s\);/);
  assert.match(fc, /if \(g\.full && \(g\.scale \?\? 1\) \* s \* x\.px >= WHOLE_MIN_PX - 1e-9\) \{ f = \{ \.\.\.g, scale: \(g\.scale \?\? 1\) \* s \}; lhScale = s; \}/);
  assert.match(fc, /const left = x\.boxH - 2 \* \(x\.compact \? TAG_COMPACT\.padY : TAG\.padY\) - f\.lines\.length \* lh \* lhScale;/);
});
