// What a card names past its kind rows (the entry words that read in 내부 보기's tip and the panel), the loop's repeat, the zoom
// levels, and layoutScope's typed card (map design v3 3.3, 5.3): CARD_W wide as a unit and as a row, its name on one line or two,
// its height its near content's from card-family, once, with its contact point and its pins on the box.
import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomLevel, zoomTier, tierText, tierFit, entryKind, entryParts, loopBody, CADENCE, TIER_W, TIER_DOTS, TIER_FAR, TIER_NEAR, TIER_HYST } from '../dist/public/client/card-budget.js';
import { cardTemplate, cardHeights, NAME_ROOM } from '../dist/public/client/card-family.js';
import { createProject, addArea, addChildArea } from '../dist/public/shared/domain.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope, CARD_W, UNIT_W, NODE_W } from '../dist/public/client/map-layout.js';

const facts = (x = {}) => ({ type: null, config: [], inputs: [], outputs: [], fields: [], loop: null, steps: [], conditions: [], ...x });
const typedExtra = (typed, asked = new Map(), t = cardTemplate(facts())) => (id, face) => (typed.has(id) && face !== 'item'
  ? { nameRoom: NAME_ROOM, shape: (nl, planned) => { asked.set(id, { nl, face }); const hs = cardHeights(t, nl, planned); return { h: hs.total, contact: hs.contact, pins: { 'r1|in': hs.contact } }; } } : 0);

test('layoutScope: a typed card is CARD_W wide without its note, as high as its template for its name lines, with its contact and pins', () => {
  let p = createProject();
  p = addArea(p, '짧은 이름', '두 줄에 걸치는 긴 설명 문장이 있어서 카드에 노트 줄이 생기는 부분이다. 그리고 더 이어진다.');
  p = addArea(p, '보관소를 읽어 조건을 확인하고 주문을 요청하는 감시 루프의 아주 긴 이름', '설명');
  p = addArea(p, '이름', '');
  const v = studioView(p), id = n => v.parts.find(x => x.name === n).id, asked = new Map();
  const typed = new Set(v.parts.map(x => x.id));
  const L = layoutScope(v, null, () => true, {}, undefined, undefined, 1.6, typedExtra(typed, asked));
  const t = cardTemplate(facts());
  for (const x of typed) {
    const b = L.boxes.get(x), nl = asked.get(x).nl;
    assert.equal(b.w, CARD_W, 'a typed card is CARD_W wide whatever its name');
    assert.equal(b.h, cardHeights(t, nl).total, 'its height is its template\'s for its name lines');
    assert.equal(b.contact, cardHeights(t, nl).contact);
    assert.deepEqual(b.pins, { 'r1|in': cardHeights(t, nl).contact });
  }
  assert.equal(asked.get(id('짧은 이름')).nl, 1);
  assert.equal(asked.get(id('보관소를 읽어 조건을 확인하고 주문을 요청하는 감시 루프의 아주 긴 이름')).nl, 2, 'a long name is asked with its two lines');
  // A card that answers a number keeps the layout as before (an untyped card: UNIT_W with a note, NODE_W without).
  const base = layoutScope(v, null, () => true, {}), plain = layoutScope(v, null, () => true, {}, undefined, undefined, 1.6, () => 0);
  assert.deepEqual([...plain.boxes], [...base.boxes]);
  assert.equal(base.boxes.get(id('짧은 이름')).w, UNIT_W);
  assert.equal(base.boxes.get(id('이름')).w, NODE_W);
  assert.equal(base.boxes.get(id('이름')).contact, undefined, 'an untyped card has no card-level contact of its own');
});

test('layoutScope: a row inside a group takes the same typed template (no bare rows), and a folded card with an inside too', () => {
  let p = createProject();
  p = addArea(p, '실행 묶음', ''); const g = p.space.areas.at(-1).id; p = addChildArea(p, g, '안쪽 하나'); p = addChildArea(p, g, '안쪽 둘');
  const v = studioView(p), asked = new Map(), typed = new Set(v.parts.map(x => x.id));
  const open = layoutScope(v, null, () => true, {}, undefined, undefined, 1.6, typedExtra(typed, asked));
  for (const k of v.parts.find(x => x.id === g).childIds) {
    assert.equal(open.boxes.get(k).face, 'row'); assert.equal(open.boxes.get(k).w >= CARD_W, true); assert.equal(asked.get(k).face, 'row');
  }
  const folded = layoutScope(v, null, () => false, {}, undefined, undefined, 1.6, typedExtra(typed, asked));
  assert.equal(folded.boxes.get(g).kind, 'node'); assert.equal(folded.boxes.get(g).w, CARD_W); assert.equal(asked.get(g).face, 'unit');
});

test('layoutScope: the change preview\'s lines under a typed card\'s name add to its head, and only to that card', () => {
  let p = createProject();
  p = addArea(p, '바뀌는 부분', ''); const a = p.space.areas.at(-1).id; p = addArea(p, '그대로인 부분', ''); const b = p.space.areas.at(-1).id;
  const v = studioView(p), typed = new Set([a, b]);
  const before = layoutScope(v, null, () => true, {}, undefined, undefined, 1.6, typedExtra(typed));
  const after = layoutScope(v, null, () => true, {}, undefined, new Map([[a, ['이름 바꿈']]]), 1.6, typedExtra(typed));
  assert.ok(after.boxes.get(a).h > before.boxes.get(a).h);
  assert.equal(after.boxes.get(b).h, before.boxes.get(b).h);
});

// The zoom tiers (map design v3 5.1): by the card's projected width p = 272 × k: 점 지도 < 82, 개요 < 160, 중간 < 240, 가까이 from 240,
// with ±6px of hysteresis on the screen width; a first view reads its tier without it.
const kOf = p => p / TIER_W;
test('zoom tiers: p 81/82, 159/160, 239/240 on a first view; 54% is 개요 (p = 147), 77% 중간, 100% 가까이', () => {
  assert.equal(TIER_W, 272); assert.deepEqual([TIER_DOTS, TIER_FAR, TIER_NEAR, TIER_HYST], [82, 160, 240, 6]);
  for (const [p, t] of [[81.8, 'dots'], [82.2, 'far'], [159.8, 'far'], [160.2, 'mid'], [239.8, 'mid'], [240.2, 'near']]) assert.equal(zoomTier(kOf(p)), t, `p ${p}`);
  for (const [k, t] of [[0.25, 'dots'], [0.4, 'far'], [0.54, 'far'], [0.6, 'mid'], [0.77, 'mid'], [0.89, 'near'], [1, 'near'], [1.6, 'near']]) assert.equal(zoomTier(k), t, `k ${k}`);
  // The way back's level reads the same edges.
  for (const [k, lv] of [[0.25, 'overview'], [0.54, 'overview'], [0.59, 'mid'], [0.77, 'mid'], [0.89, 'detail'], [1, 'detail']]) assert.equal(zoomLevel(k), lv, String(k));
});
test('zoom tiers: crossing an edge needs 6px more on screen, leaving it 6px less (hysteresis)', () => {
  // Going in from 개요: 160–165 stays 개요, 166 enters 중간.
  assert.equal(zoomTier(kOf(160.2), 'far'), 'far'); assert.equal(zoomTier(kOf(165.9), 'far'), 'far'); assert.equal(zoomTier(kOf(166.2), 'far'), 'mid');
  // Going out from 중간: down to 154 stays 중간, below it 개요.
  assert.equal(zoomTier(kOf(159), 'mid'), 'mid'); assert.equal(zoomTier(kOf(154.2), 'mid'), 'mid'); assert.equal(zoomTier(kOf(153.9), 'mid'), 'far');
  assert.equal(zoomTier(kOf(245), 'mid'), 'mid'); assert.equal(zoomTier(kOf(246.2), 'mid'), 'near');
  assert.equal(zoomTier(kOf(235), 'near'), 'near'); assert.equal(zoomTier(kOf(233.9), 'near'), 'mid');
  assert.equal(zoomTier(kOf(80), 'far'), 'far'); assert.equal(zoomTier(kOf(75.9), 'far'), 'dots'); assert.equal(zoomTier(kOf(87), 'dots'), 'dots'); assert.equal(zoomTier(kOf(88.2), 'dots'), 'far');
  // A big jump crosses every edge it passes, each by its own margin.
  assert.equal(zoomTier(1, 'dots'), 'near'); assert.equal(zoomTier(0.2, 'near'), 'dots'); assert.equal(zoomTier(kOf(200), 'dots'), 'mid');
});

// On-screen floors (5.2): a title never under 14px on 18px lines, body never under 12px on 16px lines; at 가까이 the lines keep
// their own heights. What does not fit a card's fixed box is hidden, never shrunk; the box itself never changes with the zoom.
test('tierText: the screen floors hold at every scale; 가까이 keeps the line heights', () => {
  for (const k of [0.2, 0.3, 0.42, 0.54, 0.6, 0.77, 0.87]) {
    const t = tierText(k, zoomTier(k));
    assert.ok(t.title * k >= 14 - 1e-9 && t.titleLh * k >= 18 - 1e-9, `title at ${k}`);
    assert.ok(t.kind * k >= 12 - 1e-9 && t.kindLh * k >= 16 - 1e-9 && t.row * k >= 12 - 1e-9 && t.rowLh * k >= 16 - 1e-9, `body at ${k}`);
  }
  const near = tierText(1, 'near'); assert.deepEqual([near.title, near.titleLh, near.kindLh, near.row, near.rowLh, near.bottom], [15, 20, 16, 13, 20, 28]);
  assert.equal(tierText(0.9, 'near').titleLh, 20, 'the lines keep their heights at 가까이');
  assert.ok(tierText(0.54, 'far').glyph * 0.54 >= 24 - 1e-9, 'the glyph reads 24px on screen at 개요');
});
const shape = (x = {}) => ({ nameLines: 1, rows: 3, contract: 32, inner: 24, signs: 24, total: 264, status: 1, ...x });
test('tierFit: 54% shows title, kind and short status only; 77% the head, the bottom line and the rows that fit; 100% everything', () => {
  const far = tierFit(shape(), 0.54, 'far');
  assert.deepEqual({ ...far, nameLines: undefined }, { nameLines: undefined, kind: true, status: true, rows: 0, contract: false, inner: false, signs: false, bottom: false });
  assert.ok(far.nameLines >= 1);
  const mid = tierFit(shape(), 0.77, 'mid');
  assert.equal(mid.kind, true); assert.equal(mid.bottom, true); assert.equal(mid.contract, false, 'the pins and names hide at 중간');
  assert.ok(mid.rows >= 1 && mid.rows <= 2, 'one or two kind rows');
  assert.equal(mid.status, false, 'the bottom line says the status at 중간');
  assert.deepEqual(tierFit(shape(), 1, 'near'), { nameLines: 1, kind: true, status: false, rows: 3, contract: true, inner: true, signs: true, bottom: true });
  // A small box at a small scale: the second name line and the status give way before the first line; nothing overflows.
  const tiny = tierFit(shape({ total: 136, rows: 0, inner: 0, signs: 0 }), 0.42, 'far');
  assert.equal(tiny.nameLines, 1);
  // The dot map keeps the head's fit too (its names show only for what is selected or focused, styles.css).
  assert.equal(tierFit(shape(), 0.25, 'dots').bottom, false);
});
test('tierFit: what is shown always fits the box (screen line floors × lines ≤ the box), at every tier and scale', () => {
  const PAD = 26;
  for (const total of [136, 144, 168, 192, 208, 264, 420]) for (const k of [0.2, 0.3, 0.42, 0.54, 0.59, 0.6, 0.66, 0.77, 0.87]) {
    const t = zoomTier(k), T = tierText(k, t), f = tierFit(shape({ total, rows: 3, status: 1 }), k, t);
    if (t === 'near') continue;
    let used = PAD + f.nameLines * T.titleLh + (f.kind ? T.kindLh : 0) + (f.status ? T.kindLh : 0);
    if (t === 'mid') used += T.gap + (f.bottom ? T.bottom : 0) + (f.inner ? Math.max(24, T.rowLh + 4) : 0) + (f.rows ? f.rows * T.rowLh + 12 : 0) + (f.signs ? Math.max(24, T.rowLh + 4) : 0);
    // The first name line is always kept, even in a box too small for it at this scale (it is cut, never shrunk).
    if (f.nameLines > 1 || f.kind || f.bottom) assert.ok(used <= total + 1e-6, JSON.stringify({ total, k, f, used }));
  }
});

// The entry words (spec 4, 열기): '구성 N · 기록된 단계 M · 설정 K · 필드 F' in totals, or '내부 미상' when the reading names nothing
// inside; an empty card (no reading) has none. They read in the tip of the card's 내부 보기 and in the panel.
const counts = (x = {}) => ({ read: true, kids: 0, steps: 0, inputs: 0, outputs: 0, fields: 0, config: 0, ...x });
test('entry words: totals of what the card does not name in full; 내부 미상 apart from an empty card', () => {
  const most = { config: 1, fields: 3 };
  assert.equal(entryKind({ ...counts(), read: false }, most), 'none', 'no reading: an empty card, no entry');
  assert.deepEqual(entryParts({ ...counts(), read: false }, most), []);
  assert.equal(entryKind(counts(), most), 'unknown');
  assert.deepEqual(entryParts(counts(), most), ['내부 미상'], 'a reading that names nothing inside');
  assert.equal(entryKind(counts({ inputs: 2, outputs: 2, config: 1 }), most), 'none');
  assert.deepEqual(entryParts(counts({ kids: 4 }), most), ['구성 4']);
  assert.deepEqual(entryParts(counts({ kids: 4, steps: 7 }), most), ['구성 4', '기록된 단계 7'], 'the spec\'s own example');
  assert.deepEqual(entryParts(counts({ inputs: 1, fields: 12 }), most), ['필드 12']);
  assert.deepEqual(entryParts(counts({ inputs: 1, config: 3, fields: 3 }), most), ['설정 3']);
  assert.deepEqual(entryParts(counts({ kids: 2, config: 1 }), { config: 0, fields: 0 }), ['구성 2', '설정 1']);
  assert.deepEqual(entryParts(counts({ inputs: 2, steps: 3 }), most), ['기록된 단계 3']);
  assert.deepEqual(entryParts(counts({ kids: 2, steps: 3, unplaced: 2 }), most), ['구성 2', '기록된 단계 3', '배치 미정 2']);
  assert.equal(entryKind(counts({ inputs: 2, outputs: 2, config: 1, unplaced: 1 }), most), 'some');
  assert.deepEqual(entryParts(counts({ inputs: 2, outputs: 2, config: 1, unplaced: 1 }), most), ['배치 미정 1']);
  assert.deepEqual(entryParts(counts({ unplaced: 3 }), most), ['내부 미상', '배치 미정 3'], 'nothing inside said, three rules unplaced');
  assert.deepEqual(entryParts(counts({ inputs: 2, outputs: 2, config: 1, unplaced: 0 }), most), []);
});

test('entry words with map-reading.9: 기록된 단계 M, 유지 상태 S, and a loop or kept state alone is not 내부 미상', () => {
  const most = { config: 1, fields: 3 };
  assert.deepEqual(entryParts(counts({ inputs: 1, outputs: 1, steps: 5 }), most), ['기록된 단계 5']);
  assert.deepEqual(entryParts(counts({ steps: 4, state: 2 }), most), ['기록된 단계 4', '유지 상태 2'], 'steps, then the kept state');
  assert.deepEqual(entryParts(counts({ kids: 3, steps: 12, state: 1, config: 4 }), most), ['구성 3', '기록된 단계 12', '유지 상태 1', '설정 4']);
  assert.equal(entryKind(counts({ loop: true }), most), 'none', 'a loop alone: the card names it, nothing to count');
  assert.notEqual(entryKind(counts({ loop: true }), most), 'unknown');
  assert.deepEqual(entryParts(counts({ state: 3 }), most), ['유지 상태 3']);
  assert.deepEqual(entryParts(counts({ inputs: 2, steps: 3 }), most), ['기록된 단계 3']);
  assert.deepEqual(entryParts(counts(), most), ['내부 미상']);
});

test('loopBody: the record\'s repeat unit first, else the first beat-like setting, 반복 단위 ? only when both are missing', () => {
  assert.deepEqual(loopBody('호가 틱마다', ['j1_cadence 60 s', '618df374']), { text: '반복 · 호가 틱마다', used: null, program: false });
  assert.deepEqual(loopBody(null, ['618df374', 'j1_cadence 60 s']), { text: '반복 · j1_cadence 60 s', used: 'j1_cadence 60 s', program: false });
  assert.deepEqual(loopBody(undefined, ['감시 주기 0.2 s']), { text: '반복 · 감시 주기 0.2 s', used: '감시 주기 0.2 s', program: false });
  assert.deepEqual(loopBody(null, ['618df374', '카드 폭 240']), { text: '반복 단위 ?', used: null, program: false }, 'no unit, no beat: the blank says so');
  assert.deepEqual(loopBody('', []), { text: '반복 단위 ?', used: null, program: false });
  assert.ok(CADENCE.test('60 s 폴링') && CADENCE.test('매 00:30Z') && !CADENCE.test('618df374'));
});

test('loopBody (map-reading.13): a program unit carries the program mark; a beat the card takes from the settings never does', () => {
  assert.deepEqual(loopBody('j1_cadence 60 s', ['j1_cadence 60 s'], true), { text: '반복 · j1_cadence 60 s', used: null, program: true });
  assert.deepEqual(loopBody('호가 틱마다', [], false), { text: '반복 · 호가 틱마다', used: null, program: false });
  assert.deepEqual(loopBody(null, ['j1_cadence 60 s'], true), { text: '반복 · j1_cadence 60 s', used: 'j1_cadence 60 s', program: false });
  assert.deepEqual(loopBody(null, [], true), { text: '반복 단위 ?', used: null, program: false });
});

test('entry words with conditions: 조건 K after 기록된 단계; alone they make an entry', () => {
  const most = { config: 1, fields: 3 };
  assert.deepEqual(entryParts(counts({ kids: 2, steps: 3, conditions: 4, state: 1, config: 3, unplaced: 1 }), most), ['구성 2', '기록된 단계 3', '조건 4', '유지 상태 1', '설정 3', '배치 미정 1']);
  assert.equal(entryKind(counts({ inputs: 2, outputs: 2, config: 1, conditions: 2 }), most), 'some');
  assert.deepEqual(entryParts(counts({ inputs: 2, outputs: 2, config: 1, conditions: 2 }), most), ['조건 2']);
  assert.equal(entryKind(counts({ conditions: 1 }), most), 'some', 'only conditions: not 내부 미상');
  assert.deepEqual(entryParts(counts({ conditions: 0, steps: 2 }), most), ['기록된 단계 2']);
  assert.deepEqual(entryParts(counts(), most), ['내부 미상']);
});

test('entry words (map-reading.14): the steps the program cut from the 3절 chain count apart, 기록된 단계 M (+P 프로그램)', () => {
  const most = { config: 1, fields: 3 };
  assert.deepEqual(entryParts(counts({ kids: 2, steps: 3, programSteps: 2 }), most), ['구성 2', '기록된 단계 3 (+2 프로그램)']);
  assert.deepEqual(entryParts(counts({ steps: 3, programSteps: 0 }), most), ['기록된 단계 3']);
  assert.deepEqual(entryParts(counts({ steps: 4 }), most), ['기록된 단계 4']);
  assert.equal(entryKind(counts({ programSteps: 3 }), most), 'some');
  assert.deepEqual(entryParts(counts({ programSteps: 3 }), most), ['기록된 단계 0 (+3 프로그램)']);
  assert.deepEqual(entryParts(counts({ programSteps: 1, unplaced: 1, conditions: 2 }), most), ['기록된 단계 0 (+1 프로그램)', '조건 2', '배치 미정 1']);
});
