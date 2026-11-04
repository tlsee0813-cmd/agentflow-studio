// What a card names past its kind rows (the entry words that read in 내부 보기's tip and the panel), the loop's repeat, the zoom
// levels, and layoutScope's typed card (map design v3 3.3, 5.3): CARD_W wide as a unit and as a row, its name on one line or two,
// its height its near content's from card-family, once, with its contact point and its pins on the box.
import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomLevel, entryKind, entryParts, loopBody, CADENCE, OVERVIEW_MAX, MID_MAX } from '../dist/public/client/card-budget.js';
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

// The three zoom levels (spec 4): 개요 to 55% shown, 중간 to 85%, 상세 above; read as the percent the zoom tool shows.
test('zoom levels: 개요 ≤ 55%, 중간 56–85%, 상세 > 85% (as the zoom tool shows the percent)', () => {
  assert.equal(OVERVIEW_MAX, 55); assert.equal(MID_MAX, 85);
  for (const [k, lv] of [[0.4, 'overview'], [0.45, 'overview'], [0.55, 'overview'], [0.554, 'overview'], [0.556, 'mid'], [0.6, 'mid'], [0.7, 'mid'], [0.85, 'mid'],
    [0.854, 'mid'], [0.856, 'detail'], [0.9, 'detail'], [1, 'detail'], [1.6, 'detail']]) assert.equal(zoomLevel(k), lv, String(k));
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
