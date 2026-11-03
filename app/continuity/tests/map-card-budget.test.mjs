// The six-line budget of a collapsed unit card (map spec 2.1): the head (type word with the name, one or two name lines) and
// the operations line are always kept; under them 받는 것, 내는 것, one structural line and one setting. When the name takes
// more lines, the setting goes first, then 내는 것 folds into the 받는 것 line; the structural line, the operations line and
// the head are never dropped. And layoutScope's typed card: drawn at UNIT_W without its note, its room asked with its name's lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import { typedBudget, typedPx, typedLines, zoomLevel, entryKind, entryParts, loopBody, CADENCE, CARD_LINES, OVERVIEW_MAX, MID_MAX, LINE_H, LINE_GAP, CHIPS_H } from '../dist/public/client/card-budget.js';
import { createProject, addArea, addChildArea } from '../dist/public/shared/domain.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope, UNIT_W } from '../dist/public/client/map-layout.js';

test('a one-line name keeps every line: two port lines, the structure and the setting (six lines)', () => {
  assert.deepEqual(typedBudget(1, true, true, true, true), { io: 'both', body: true, set: true, chips: 'none', entry: false, lines: 6 });
  assert.deepEqual(typedBudget(1, false, true, false, false), { io: 'in', body: false, set: false, chips: 'none', entry: false, lines: 3 });
  assert.deepEqual(typedBudget(1, true, false, true, true), { io: 'out', body: true, set: true, chips: 'none', entry: false, lines: 5 });
  assert.deepEqual(typedBudget(1, false, false, false, false), { io: 'none', body: false, set: false, chips: 'none', entry: false, lines: 2 });
});

test('a two-line name drops the setting first, and only when the six lines are exceeded', () => {
  assert.deepEqual(typedBudget(2, true, true, true, true), { io: 'both', body: true, set: false, chips: 'none', entry: false, lines: 6 });
  // Without a setting the same card already fits: nothing is dropped.
  assert.deepEqual(typedBudget(2, false, true, true, true), { io: 'both', body: true, set: false, chips: 'none', entry: false, lines: 6 });
  assert.deepEqual(typedBudget(2, true, true, true, false), { io: 'both', body: false, set: true, chips: 'none', entry: false, lines: 6 });
  assert.deepEqual(typedBudget(2, true, true, false, true), { io: 'in', body: true, set: true, chips: 'none', entry: false, lines: 6 });
});

test('a longer name folds 내는 것 into the 받는 것 line after the setting; the structure and the operations line stay', () => {
  assert.deepEqual(typedBudget(3, true, true, true, true), { io: 'fold', body: true, set: false, chips: 'none', entry: false, lines: 6 });
  assert.deepEqual(typedBudget(3, false, true, true, false), { io: 'both', body: false, set: false, chips: 'none', entry: false, lines: 6 });
  // Nothing more can go: the head, the operations line and the structural line are never dropped.
  const tight = typedBudget(4, true, true, true, true);
  assert.equal(tight.body, true); assert.equal(tight.io, 'fold'); assert.equal(tight.set, false);
});

test('every budget holds at most six lines for one or two name lines, whatever the card records', () => {
  for (const nl of [1, 2]) for (const set of [false, true]) for (const i of [false, true]) for (const o of [false, true]) for (const b of [false, true]) {
    const r = typedBudget(nl, set, i, o, b);
    assert.ok(r.lines <= CARD_LINES, JSON.stringify({ nl, set, i, o, b, r }));
    assert.equal(r.body, b, 'the structural line is kept whenever there is one');
    if (!i || !o) assert.notEqual(r.io, 'fold');
  }
  assert.equal(typedBudget(0, false, false, false, false).lines, 2, 'a name takes one line at least');
});

test('layoutScope: a typed card is drawn at UNIT_W without its note, and its room is asked with its name lines', () => {
  let p = createProject();
  p = addArea(p, '짧은 이름', '두 줄에 걸치는 긴 설명 문장이 있어서 카드에 노트 줄이 생기는 부분이다. 그리고 더 이어진다.');
  p = addArea(p, '보관소를 읽어 조건을 확인하고 주문을 요청하는 감시 루프', '설명');
  p = addArea(p, '이름', '');
  const v = studioView(p), id = n => v.parts.find(x => x.name === n).id;
  const asked = new Map();
  const typed = new Set([id('짧은 이름'), id('보관소를 읽어 조건을 확인하고 주문을 요청하는 감시 루프'), id('이름')]);
  const extra = x => (typed.has(x) ? { room: nl => { asked.set(x, nl); return 50; } } : 0);
  const base = layoutScope(v, null, () => true, {}), L = layoutScope(v, null, () => true, {}, undefined, undefined, 1.6, extra);
  for (const x of typed) assert.equal(L.boxes.get(x).w >= UNIT_W, true, 'a typed card is at least UNIT_W wide');
  // Its note is not counted (it reads on selection): the short-named card is lower than its noted base plus the room.
  const s = id('짧은 이름');
  assert.ok(L.boxes.get(s).h < base.boxes.get(s).h + 50, 'the note lines are not counted');
  assert.equal(asked.get(s), 1);
  assert.equal(asked.get(id('보관소를 읽어 조건을 확인하고 주문을 요청하는 감시 루프')), 2, 'a long name is asked with its two lines');
  // A card that answers a number keeps the layout as before.
  const plain = layoutScope(v, null, () => true, {}, undefined, undefined, 1.6, () => 0);
  assert.deepEqual([...plain.boxes], [...base.boxes]);
});

// Group chips (연결 N, 안쪽 N) on a typed card with an inside: at the end of a one-line name they take no line; on a line of
// their own they count as one of the six, the setting and then 내는 것 giving way before them, and they are never dropped.
test('chips at the name take no line; chips on their own line count in the six and push the setting, then 내는 것, out', () => {
  assert.deepEqual(typedBudget(1, true, true, true, true, 'name'), { io: 'both', body: true, set: true, chips: 'name', entry: false, lines: 6 });
  assert.deepEqual(typedBudget(1, true, true, true, true, 'line'), { io: 'both', body: true, set: false, chips: 'line', entry: false, lines: 6 });
  assert.deepEqual(typedBudget(2, true, true, true, true, 'line'), { io: 'fold', body: true, set: false, chips: 'line', entry: false, lines: 6 });
  assert.deepEqual(typedBudget(2, false, true, false, false, 'line'), { io: 'in', body: false, set: false, chips: 'line', entry: false, lines: 5 });
  for (const nl of [1, 2]) for (const set of [false, true]) for (const i of [false, true]) for (const o of [false, true]) for (const b of [false, true]) {
    const r = typedBudget(nl, set, i, o, b, 'line');
    assert.ok(r.lines <= CARD_LINES, JSON.stringify({ nl, set, i, o, b, r }));
    assert.equal(r.chips, 'line', 'the chips line is never dropped');
  }
});

// The three zoom levels (spec 4): 개요 to 55% shown, 중간 to 85%, 상세 above; read as the percent the zoom tool shows.
test('zoom levels: 개요 ≤ 55%, 중간 56–85%, 상세 > 85% (as the zoom tool shows the percent)', () => {
  assert.equal(OVERVIEW_MAX, 55); assert.equal(MID_MAX, 85);
  for (const [k, lv] of [[0.4, 'overview'], [0.45, 'overview'], [0.55, 'overview'], [0.554, 'overview'], [0.556, 'mid'], [0.6, 'mid'], [0.7, 'mid'], [0.85, 'mid'],
    [0.854, 'mid'], [0.856, 'detail'], [0.9, 'detail'], [1, 'detail'], [1.6, 'detail']]) assert.equal(zoomLevel(k), lv, String(k));
});

test('a level keeps less of the same card: 개요 nothing under the operations line, 중간 the port lines, 상세 everything', () => {
  assert.deepEqual(typedBudget(1, true, true, true, true, 'none', 'overview'), { io: 'none', body: false, set: false, chips: 'none', entry: false, lines: 2 });
  assert.deepEqual(typedBudget(1, true, true, true, true, 'none', 'mid'), { io: 'both', body: false, set: false, chips: 'none', entry: false, lines: 4 });
  assert.deepEqual(typedBudget(1, true, true, true, true, 'none', 'detail'), typedBudget(1, true, true, true, true));
  // 중간 needs no fold where 상세 folds: the structure and the setting are not drawn there.
  assert.equal(typedBudget(2, true, true, true, true, 'line', 'mid').io, 'both');
  // The chips line stays at every level.
  assert.equal(typedBudget(2, false, true, true, true, 'line', 'overview').lines, 4);
});

test('the class → height mapping: each level gives the card the room of the lines it keeps', () => {
  const gap = 3, all = [true, true, true, true];
  const px = (lv, chips = 'none', body = 'store') => typedPx(typedBudget(1, ...all, chips, lv), body, gap);
  assert.equal(px('overview'), 0, '개요: no typed line under the operations line');
  assert.equal(px('mid'), gap + LINE_H * 2 + LINE_GAP, '중간: 받는 것 and 내는 것');
  assert.equal(px('detail'), gap + LINE_H + LINE_H + (LINE_H + 5) + LINE_H + 3 * LINE_GAP, '상세: ports, the ledger (its double rule) and the setting');
  assert.equal(px('detail', 'none', 'loop'), gap + LINE_H * 3 + (LINE_H + 2) + 3 * LINE_GAP, 'a loop frame is 2px taller');
  assert.ok(px('overview') < px('mid') && px('mid') < px('detail'));
  // A chips line adds its own height after the card's gap, at every level.
  assert.equal(px('overview', 'line'), gap + CHIPS_H);
  assert.equal(px('mid', 'line'), gap + LINE_H * 2 + LINE_GAP + gap + CHIPS_H);
  assert.equal(px('overview', 'name'), 0, 'chips at the name take no height');
});

test('layoutScope: a typed card with an inside asks without a chips line when its name keeps one line beside them, with one otherwise', () => {
  let p = createProject();
  p = addArea(p, '실행 묶음', ''); const short = p.space.areas.at(-1).id; p = addChildArea(p, short, '안쪽 하나');
  p = addArea(p, '거래소 주문과 결과를 모아 정산하고 장부를 다시 맞추는 아주 긴 이름의 실행 묶음', ''); const long = p.space.areas.at(-1).id; p = addChildArea(p, long, '안쪽 둘');
  const v = studioView(p), asked = new Map(), folded = () => false;
  const extra = (x, face) => (face === 'unit' ? { room: (nl, chipsLine) => { asked.set(x, { nl, chipsLine }); return chipsLine ? 25 : 0; } } : 0);
  const L = layoutScope(v, null, folded, {}, undefined, undefined, 1.6, extra);
  assert.equal(L.boxes.get(short).kind, 'node');
  assert.deepEqual(asked.get(short), { nl: 1, chipsLine: false });
  assert.equal(asked.get(long).chipsLine, true, 'a name that does not keep one line beside the chips gives them a line');
  // Drawn on one line (z-mid), every typed card is asked with one name line and keeps its chips at the name.
  asked.clear();
  const one = (x, face) => (face === 'unit' ? { oneLine: true, room: (nl, chipsLine) => { asked.set(x, { nl, chipsLine }); return 0; } } : 0);
  layoutScope(v, null, folded, {}, undefined, undefined, 1.6, one);
  assert.deepEqual(asked.get(long), { nl: 1, chipsLine: false });
});

// The entry line (spec 4, 열기): '구성 N · 기록된 단계 M · 설정 K · 필드 F' in totals, or '내부 미상' when the reading names nothing
// inside; an empty card (no reading) has none. It takes the setting's place when the six lines are tight, gives way only after
// 내는 것 folded, and reads at 중간 and 상세.
const counts = (x = {}) => ({ read: true, kids: 0, steps: 0, inputs: 0, outputs: 0, fields: 0, config: 0, ...x });
test('entry words: totals of what the card does not name in full; 내부 미상 apart from an empty card', () => {
  const most = { config: 1, fields: 3 };
  assert.equal(entryKind({ ...counts(), read: false }, most), 'none', 'no reading: an empty card, no entry');
  assert.deepEqual(entryParts({ ...counts(), read: false }, most), []);
  assert.equal(entryKind(counts(), most), 'unknown');
  assert.deepEqual(entryParts(counts(), most), ['내부 미상'], 'a reading that names nothing inside');
  // Everything named on the card already: no entry (the card is still opened by a double-click or Enter).
  assert.equal(entryKind(counts({ inputs: 2, outputs: 2, config: 1 }), most), 'none');
  assert.deepEqual(entryParts(counts({ kids: 4 }), most), ['구성 4']);
  assert.deepEqual(entryParts(counts({ kids: 4, steps: 7 }), most), ['구성 4', '기록된 단계 7'], 'the spec\'s own example');
  assert.deepEqual(entryParts(counts({ inputs: 1, fields: 12 }), most), ['필드 12'], 'twelve fields, three cells on the ledger');
  assert.deepEqual(entryParts(counts({ inputs: 1, config: 3, fields: 3 }), most), ['설정 3'], 'three cells name three fields in full');
  // What the card shows under its budget: a setting line given up (or 중간, which draws none) adds 설정 by its total.
  assert.deepEqual(entryParts(counts({ kids: 2, config: 1 }), { config: 0, fields: 0 }), ['구성 2', '설정 1']);
  assert.deepEqual(entryParts(counts({ inputs: 2, steps: 3 }), most), ['기록된 단계 3'], 'steps, once the contract carries them');
});

test('the entry line takes the setting\'s place when tight, gives way only after 내는 것 folded, and never past six lines', () => {
  // One name line: head, operations, both ports, the structure and the entry; the setting gives way to the entry.
  assert.deepEqual(typedBudget(1, true, true, true, true, 'none', 'detail', 'some'), { io: 'both', body: true, set: false, chips: 'none', entry: true, lines: 6 });
  // Room for both: no structure, so the setting and the entry both stay.
  assert.deepEqual(typedBudget(1, true, true, true, false, 'none', 'detail', 'some'), { io: 'both', body: false, set: true, chips: 'none', entry: true, lines: 6 });
  // Two name lines: 내는 것 folds before the entry goes.
  assert.deepEqual(typedBudget(2, true, true, true, true, 'none', 'detail', 'some'), { io: 'fold', body: true, set: false, chips: 'none', entry: true, lines: 6 });
  // A chips line on top of that: the entry is the last to go (the chips carry the way in).
  assert.deepEqual(typedBudget(2, true, true, true, true, 'line', 'detail', 'some'), { io: 'fold', body: true, set: false, chips: 'line', entry: false, lines: 6 });
  assert.equal(typedBudget(1, false, false, false, false, 'none', 'detail', 'unknown').entry, true, '내부 미상 reads on its own line');
  assert.equal(typedBudget(1, false, false, false, false, 'none', 'detail', 'unknown').lines, 3);
  for (const nl of [1, 2]) for (const set of [false, true]) for (const i of [false, true]) for (const o of [false, true]) for (const b of [false, true]) for (const chips of ['none', 'name', 'line']) for (const e of ['none', 'unknown', 'some']) {
    const r = typedBudget(nl, set, i, o, b, chips, 'detail', e);
    assert.ok(r.lines <= CARD_LINES, JSON.stringify({ nl, set, i, o, b, chips, e, r }));
    assert.equal(r.body, b, 'the structural line is never given up for the entry');
    if (e === 'none') assert.equal(r.entry, false);
    // The setting never stays while the entry is given up.
    if (e !== 'none' && r.set) assert.equal(r.entry, true);
  }
});

test('the entry line by zoom level: kept at 중간 and 상세, not at 개요; it adds one line of LINE_H', () => {
  assert.equal(typedBudget(1, true, true, true, true, 'none', 'overview', 'some').entry, false);
  assert.deepEqual(typedBudget(1, true, true, true, true, 'none', 'mid', 'some'), { io: 'both', body: false, set: false, chips: 'none', entry: true, lines: 5 });
  assert.equal(typedBudget(1, true, true, true, true, 'none', 'detail', 'none').entry, false);
  const gap = 3, with_ = typedBudget(1, false, true, true, false, 'none', 'detail', 'some'), without = typedBudget(1, false, true, true, false);
  assert.deepEqual(typedLines(with_, null), [LINE_H, LINE_H, LINE_H]);
  assert.equal(typedPx(with_, null, gap) - typedPx(without, null, gap), LINE_H + LINE_GAP);
});

// map-reading.9: the entry line counts the recorded steps ('기록된 단계 M') and the kept state ('유지 상태 S'); a part whose
// reading names only a loop or only kept state is not '내부 미상'. A loop card's body names the record's repeat unit first.
test('entry words with map-reading.9: 기록된 단계 M, 유지 상태 S, and a loop or kept state alone is not 내부 미상', () => {
  const most = { config: 1, fields: 3 };
  assert.deepEqual(entryParts(counts({ inputs: 1, outputs: 1, steps: 5 }), most), ['기록된 단계 5']);
  assert.deepEqual(entryParts(counts({ steps: 4, state: 2 }), most), ['기록된 단계 4', '유지 상태 2'], 'steps, then the kept state');
  assert.deepEqual(entryParts(counts({ kids: 3, steps: 12, state: 1, config: 4 }), most), ['구성 3', '기록된 단계 12', '유지 상태 1', '설정 4']);
  assert.equal(entryKind(counts({ loop: true }), most), 'none', 'a loop alone: the card names it, nothing to count');
  assert.notEqual(entryKind(counts({ loop: true }), most), 'unknown');
  assert.deepEqual(entryParts(counts({ state: 3 }), most), ['유지 상태 3']);
  // Earlier callers without the new counts read as before.
  assert.deepEqual(entryParts(counts({ inputs: 2, steps: 3 }), most), ['기록된 단계 3']);
  assert.deepEqual(entryParts(counts(), most), ['내부 미상']);
});

test('loopBody: the record\'s repeat unit first, else the first beat-like setting, 반복 단위 ? only when both are missing', () => {
  assert.deepEqual(loopBody('호가 틱마다', ['j1_cadence 60 s', '618df374']), { text: '반복 · 호가 틱마다', used: null }, 'the unit stands; the beat stays for the setting line');
  assert.deepEqual(loopBody(null, ['618df374', 'j1_cadence 60 s']), { text: '반복 · j1_cadence 60 s', used: 'j1_cadence 60 s' });
  assert.deepEqual(loopBody(undefined, ['감시 주기 0.2 s']), { text: '반복 · 감시 주기 0.2 s', used: '감시 주기 0.2 s' });
  assert.deepEqual(loopBody(null, ['618df374', '카드 폭 240']), { text: '반복 단위 ?', used: null }, 'no unit, no beat: the blank says so');
  assert.deepEqual(loopBody('', []), { text: '반복 단위 ?', used: null });
  assert.ok(CADENCE.test('60 s 폴링') && CADENCE.test('매 00:30Z') && !CADENCE.test('618df374'));
});
