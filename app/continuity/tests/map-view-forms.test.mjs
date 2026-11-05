// Spec forms v1 (보기틀) §1 with the F1b overrides (§6): the pure view-forms module. Eligibility and its reasons, the consistency checks,
// program steps off the line, forks with open ends, conditional and broken segments, loop brackets only for a whole contiguous body,
// jump lanes, exits, the state graph's circle, start and terminal marks, the stored choice and its fallbacks, and no overlaps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  lineOffer, stepLine, lineBoxes, overlaps, stateOffer, stateGraph, statesElsewhere, formStep, formLoop, chooseForm, defaultForm, nextForm,
  readForm, writeForm, formKeyOf, formSpots, loopLabel, parseStepRef, shortRef, FORM_KEY, LINE_FEW, LINE_FEW_REF, LINE_OLD, LINE_OWNER, LINE_DUP, LINE_ORDER,
  LINE_TARGET, LINE_RULE, STATE_FEW, FORK_TAG, FORK_OPEN, COND_TAG, APART_SPLIT, APART_NONE, APART_OUT, APART_UNREAD, NO_EVENT, STATE_TERMINAL, STATE_CAPTION, LINE_CAPTION
} from '../dist/public/client/view-forms.js';

// A cell given without its clauses is read as the record reading reads it: 「when → to/outcome」, or the whole clause as the outcome.
const clauses = cell => cell.split(/\s*;\s*/).filter(Boolean).map(c => { const a = c.search(/→|->/), when = a > 0 ? c.slice(0, a).trim() : null, after = a >= 0 ? c.slice(a).replace(/^(?:→|->)\s*/, '') : c;
  const to = [...after.matchAll(/(?:(B\d{1,3})\s*:\s*)?S(\d{1,3}[a-z]?)/g)].map(m => `${m[1] ?? 'B03'}:S${m[2]}`), outcome = after.replace(/(?:B\d{1,3}\s*:\s*)?S\d{1,3}[a-z]?/g, ' ').trim();
  return { when, to, max: null, outcome: outcome || null }; });
const step = (ref, name, extra = {}) => formStep({ recordRef: ref, name, does: extra.does ?? null, program: extra.program, alt: extra.alt ?? null, branch: extra.branch ?? (extra.cell ? clauses(extra.cell) : []), loopIds: extra.loopIds ?? [], when: extra.cell ?? null });
const order = (n, owner = 'B03') => Array.from({ length: n }, (_, i) => step(`${owner}:S${String(i + 1).padStart(2, '0')}`, `주문 단계 ${i + 1}`));
const loop = (ref, body, extra = {}) => formLoop({ recordRef: ref, parentRef: extra.parentRef ?? null, unit: extra.unit ?? null, count: extra.count ?? null, stop: extra.stop ?? null, body, bodyState: extra.bodyState ?? 'linked' });
const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const noOverlap = l => { const bs = lineBoxes(l); for (let i = 0; i < bs.length; i++) for (let k = i + 1; k < bs.length; k++) assert.ok(!overlaps(bs[i], bs[k]), `${bs[i].what} overlaps ${bs[k].what}`); };

test('FORM-1 line eligibility: three recorded steps of one owner pass; fewer, old rows without C-STEP IDs and another owner\'s IDs say why', () => {
  assert.deepEqual(lineOffer(order(3)), { ok: true, reason: LINE_RULE });
  assert.equal(lineOffer(order(2)).reason, LINE_FEW);
  // spec line fixes 1: refused for missing IDs only when no recorded step has one; two IDs and one ID-less step are too few stations.
  assert.equal(lineOffer([step(null, '옛 행 1'), step(null, '옛 행 2'), step(null, '옛 행 3')]).reason, LINE_OLD);
  assert.equal(lineOffer([...order(2), step(null, '옛 행')]).reason, LINE_FEW_REF);
  assert.equal(lineOffer([step('B03:S01', 'a'), step('B03:S02', 'b'), step('B07:S03', 'c')]).reason.split(' · ')[0], LINE_OWNER);
  assert.equal(lineOffer(order(3, 'B03'), 'B07').reason.split(' · ')[0], LINE_OWNER);
  assert.equal(lineOffer(order(3, 'B3'), 'B03').ok, true, 'B3 and B03 are one owner');
});

test('FORM-2 consistency checks: duplicate IDs, IDs out of row order (suffix ignored) and a branch to a missing step of the owner fail; never reordered', () => {
  assert.equal(lineOffer([...order(3), step('B03:S02', '다시')]).reason, `${LINE_DUP} · B03:S02`);
  assert.equal(lineOffer([step('B03:S01', 'a'), step('B03:S03', 'c'), step('B03:S02', 'b')]).reason, `${LINE_ORDER} · B03:S03 다음 B03:S02`);
  // Two alternative groups interleaved (S02a, S03a, S02b): not ascending in row order.
  const mixed = [step('B03:S01', 'a'), step('B03:S02a', 'x', { alt: { group: 'S02', branch: 'a' } }), step('B03:S03a', 'y', { alt: { group: 'S03', branch: 'a' } }), step('B03:S02b', 'z', { alt: { group: 'S02', branch: 'b' } })];
  assert.equal(lineOffer(mixed).reason.split(' · ')[0], LINE_ORDER);
  // A plain number then its alternative (S02, S02a) is not an alternative group.
  assert.equal(lineOffer([step('B03:S01', 'a'), step('B03:S02', 'b'), step('B03:S02a', 'c')]).reason.split(' · ')[0], LINE_ORDER);
  const bad = order(3); bad[1] = step('B03:S02', '검증', { branch: [{ when: '실패', to: ['B03:S09'], max: null, outcome: null }] });
  assert.equal(lineOffer(bad).reason, `${LINE_TARGET} · B03:S02 → B03:S09`);
  // Another owner's step and a group named without its letter are not missing.
  const ok = [step('B03:S01', 'a', { branch: [{ when: 'x', to: ['B11:S02', 'B03:S02'], max: null, outcome: null }] }), step('B03:S02a', 'b', { alt: { group: 'S02', branch: 'a' } }), step('B03:S02b', 'c', { alt: { group: 'S02', branch: 'b' } }), step('B03:S03', 'd')];
  assert.equal(lineOffer(ok).ok, true);
});

test('FORM-3 program-made steps are not stations and do not count toward eligibility; the line lists them as a count', () => {
  const steps = [step('B03:S01', 'a'), step(null, '프로그램 단계', { program: true }), step('B03:S02', 'b')];
  assert.equal(lineOffer(steps).reason, LINE_FEW, 'two recorded steps');
  const more = [...steps, step('B03:S03', 'c')];
  assert.equal(lineOffer(more).ok, true);
  const l = stepLine(more, [], []);
  assert.deepEqual(l.stations.map(s => s.index), [0, 2, 3]);
  assert.equal(l.program, 1);
  assert.ok(l.stations.every(s => s.kind === 'recorded'));
});

test('FORM-4 a fork: alternatives share a row side by side, carry 「조건에 따라 하나」 with their condition cells, end open, and the line resumes at col 0', () => {
  const steps = [step('B03:S01', '받기'), step('B03:S02a', '카드 결제', { alt: { group: 'S02', branch: 'a' }, cell: '카드면' }), step('B03:S02b', '계좌 이체', { alt: { group: 'S02', branch: 'b' }, cell: '계좌면' }), step('B03:S03', '영수증')];
  const l = stepLine(steps, [], [], { width: 640 });
  const [a, b, c, d] = l.stations;
  assert.equal(b.row, c.row); assert.deepEqual([b.col, c.col], [0, 1]); assert.equal(d.col, 0); assert.ok(d.row > b.row);
  assert.equal(l.forks.length, 1); assert.equal(l.forks[0].open, true); assert.equal(l.forks[0].tag.text, FORK_TAG);
  assert.match(l.forks[0].tag.tip, /\b2a: 카드면/); assert.deepEqual(l.stations.map(s => s.no), ['1', '2a', '2b', '3'], 'stations by number, never S01/S02a'); assert.equal(b.cond, '카드면');
  assert.equal(l.forks[0].gap.text, FORK_OPEN);
  // Open stubs from both branches; nothing joins them to S03.
  const stubs = l.segments.filter(s => s.open);
  assert.equal(stubs.length, 2);
  assert.ok(!l.segments.some(s => !s.open && (s.y1 === b.y || s.y1 === c.y) && s.y2 === d.y), 'no segment from a branch to the next row');
  // The split: the straight line to col 0 and a curve to col 1, both from the step before.
  assert.ok(l.segments.some(s => s.x1 === a.x && s.y1 === a.y && s.y2 === b.y));
  assert.ok(l.segments.some(s => s.curve && s.x2 === c.x && s.y2 === c.y));
  noOverlap(l);
});

test('FORM-5 a conditional clause dashes the segment after its step with 「조건에 따라」; an exit with no condition breaks it (an open stub, no connection)', () => {
  const steps = [step('B03:S01', '검사', { branch: [{ when: '재고 없음', to: [], max: null, outcome: '거부 E409' }], cell: '재고 없음 → 거부 E409' }),
    step('B03:S02', '포장', { branch: [{ when: null, to: [], max: null, outcome: '끝' }], cell: '→ 끝' }), step('B03:S03', '배송')];
  const l = stepLine(steps, [], []);
  const [a, b, c] = l.stations;
  const ab = l.segments.find(s => s.y1 === a.y && s.y2 === b.y);
  assert.equal(ab.kind, 'cond'); assert.match(ab.tip, /재고 없음/);
  assert.ok(l.tags.some(t => t.text === COND_TAG));
  assert.deepEqual(a.exits.map(e => [e.kind, e.text]), [['exit', '재고 없음 → 거부 E409']]);
  assert.ok(!l.segments.some(s => s.y1 === b.y && s.y2 === c.y), 'broken after the unconditional end');
  assert.ok(l.segments.some(s => s.y1 === b.y && s.open));
  assert.deepEqual(b.exits.map(e => e.kind), ['end']);
  // A clause written without an arrow is a condition note: dashed, never a break.
  const note = stepLine([step('B03:S01', 'a', { branch: [{ when: null, to: [], max: null, outcome: '값이 있을 때' }], cell: '값이 있을 때' }), step('B03:S02', 'b'), step('B03:S03', 'c')], [], []);
  assert.equal(note.segments.find(s => s.y1 === note.stations[0].y && !s.open).kind, 'cond');
  assert.deepEqual(note.stations[0].notes, ['값이 있을 때']);
  // An unconditional step to the very next row is the normal continuation: solid, no arc, no break.
  const plain = stepLine([step('B03:S01', 'a', { branch: [{ when: null, to: ['B03:S02'], max: null, outcome: null }], cell: '→ S02' }), step('B03:S02', 'b'), step('B03:S03', 'c')], [], []);
  assert.equal(plain.arcs.length, 0); assert.equal(plain.segments[0].kind, 'solid'); assert.ok(!plain.segments[0].open);
});

test('FORM-6 loop brackets only for the full contiguous body; partial bodies are listed apart with why; depth by nesting, the outer further left', () => {
  const steps = [step('B03:S01', 'a'), step('B03:S02', 'b', { loopIds: ['B03:L01'] }), step('B03:S03', 'c', { loopIds: ['B03:L02'] }), step('B03:S04', 'd', { loopIds: ['B03:L02'] }), step('B03:S05', 'e')];
  const loops = [loop('B03:L01', ['B03:S02', 'B03:S03', 'B03:S04'], { unit: '주문마다', count: '목록 끝까지', stop: '취소' }), loop('B03:L02', [], { parentRef: 'B03:L01', unit: '항목마다' })];
  const l = stepLine(steps, loops, []);
  assert.equal(l.brackets.length, 2);
  const outer = l.brackets.find(b => b.ref === 'B03:L01'), inner = l.brackets.find(b => b.ref === 'B03:L02');
  assert.ok(outer.depth > inner.depth); assert.ok(outer.x < inner.x);
  assert.equal(outer.label, '↻ 주문마다 · 목록 끝까지 · 끝: 취소');
  assert.equal(loopLabel({ ref: 'B03:L09', unit: null, count: null, stop: null }), '↻ 반복', 'never the row ID');
  assert.ok(outer.y1 < inner.y1 && outer.y2 > inner.y2);
  // Non-contiguous body: no bracket.
  const split = stepLine(steps, [loop('B03:L03', ['B03:S01', 'B03:S03'])], []);
  assert.equal(split.brackets.length, 0); assert.equal(split.loopsApart[0].why, APART_SPLIT);
  assert.match(split.loopsApart[0].text, /^반복의 일부 · 몸통이 떨어져 있음/);
  // A body step on another part (by the body list or by another part's step naming the loop): apart, the other part named.
  const other = stepLine(steps, [loop('B03:L04', ['B03:S02', 'B11:S01'])], [], { ownerNames: { B11: '결제 처리' } });
  assert.equal(other.brackets.length, 0); assert.deepEqual(other.loopsApart[0].parts, ['B11']);
  assert.match(other.loopsApart[0].text, /몸통이 ‘결제 처리’에도 있음/);
  const named = stepLine(steps, [loop('B03:L05', ['B03:S05'])], [], { elsewhere: [{ ref: 'B12:S03', loopIds: ['B03:L05'] }] });
  assert.equal(named.brackets.length, 0); assert.deepEqual(named.loopsApart[0].parts, ['B12']);
  // No body at all.
  const none = stepLine(steps, [loop('B03:L06', [], { bodyState: 'unexpanded' })], []);
  assert.equal(none.loopsApart[0].why, APART_NONE);
  // A body step of this owner that is not on the line (a missing row): spec line fixes 2 says part of the body is not on this map.
  const out = stepLine(steps, [loop('B03:L07', ['B03:S04', 'B03:S08'])], []);
  assert.equal(out.loopsApart[0].why, APART_UNREAD);
  // A loop the line does not touch is not listed.
  assert.equal(stepLine(steps, [loop('B20:L01', ['B20:S01'])], []).loopsApart.length, 0);
  noOverlap(l);
});

test('FORM-7 jumps: a branch to a step of this line is an arc (back when upward); lanes nest so nested and disjoint arcs never cross', () => {
  const steps = [step('B03:S01', 'a'), step('B03:S02', 'b'), step('B03:S03', 'c'),
    step('B03:S04', 'd', { branch: [{ when: '검증 실패', to: ['B03:S02'], max: '최대 3번', outcome: null }] }),
    step('B03:S05', 'e', { branch: [{ when: '다시', to: ['B03:S01'], max: null, outcome: null }] }), step('B03:S06', 'f'),
    step('B03:S07', 'g', { branch: [{ when: '건너뜀', to: ['B03:S09'], max: null, outcome: null }] }), step('B03:S08', 'h'), step('B03:S09', 'i')];
  const l = stepLine(steps, [], []);
  assert.equal(l.arcs.length, 3);
  const inner = l.arcs.find(a => a.label.startsWith('검증 실패')), outer = l.arcs.find(a => a.label.startsWith('다시')), fwd = l.arcs.find(a => a.label.startsWith('건너뜀'));
  assert.equal(inner.label, '검증 실패 → 단계 2 · 최대 3번'); assert.equal(inner.back, true); assert.equal(fwd.back, false);
  assert.ok(inner.lane < outer.lane, 'the nested (shorter) arc nearer the stations');
  assert.equal(fwd.lane, 0, 'a disjoint arc reuses the first lane');
  assert.equal(l.crossings, 0);
  // Labels sit in their own column and never overlap each other or a station.
  noOverlap(l);
  assert.ok(l.arcs.every(a => a.pill.x > a.x));
});

test('FORM-8 exits: a branch to another part\'s step and an outcome-only clause are tags beside the station, never arcs', () => {
  const steps = [step('B03:S01', 'a', { branch: [{ when: '승인 필요', to: ['B11:S02'], max: null, outcome: null }, { when: '인증 실패', to: [], max: null, outcome: '거부: E401' }] }), step('B03:S02', 'b'), step('B03:S03', 'c')];
  const l = stepLine(steps, [], []);
  assert.equal(l.arcs.length, 0);
  assert.deepEqual(l.stations[0].exits.map(e => e.text), ['승인 필요 → 다른 부분의 단계', '인증 실패 → 거부: E401']);
  assert.equal(stepLine(steps, [], [], { ownerNames: { B11: '결제 서버' } }).stations[0].exits[0].text, '승인 필요 → ‘결제 서버’의 단계', 'another part\'s step by the part');
  assert.equal(l.stations[0].exits[0].kind, 'out');
  // An unconditional jump out breaks the line after it.
  const u = stepLine([step('B03:S01', 'a', { branch: [{ when: null, to: ['B11:S01'], max: null, outcome: null }], cell: '→ B11:S01' }), step('B03:S02', 'b'), step('B03:S03', 'c')], [], []);
  assert.ok(!u.segments.some(s => s.y1 === u.stations[0].y && s.y2 === u.stations[1].y));
});

test('FORM-9 entries are terminal pills above the first station, not joined to it; the line\'s bottom is a plain end, never 「끝」', () => {
  const l = stepLine(order(3), [], [{ ref: 'N01', name: '/orders POST', kind: 'request' }, { ref: 'N02', name: 'order-cli', kind: null }]);
  assert.deepEqual(l.terminals.map(t => t.text), ['진입 · 요청 · /orders POST', '진입 · 방식 미상 · order-cli']);
  assert.ok(l.terminals.every(t => t.y + t.h <= l.stations[0].top));
  assert.ok(!l.segments.some(s => s.y1 < l.stations[0].y), 'no segment above the first station');
  const tail = l.segments.find(s => s.tail);
  assert.ok(tail && !/^끝$/.test(tail.tip) && tail.tip.includes('끝이라는 기록은 아님'));
  assert.equal(LINE_CAPTION, '기록에 적힌 실행 순서 · 실행 검증 아님 · 간격은 시간 아님');
});

test('FORM-10 geometry is deterministic, takes the view\'s width, grows only for what cannot be narrower, and stacks the extra content lines', () => {
  const steps = [step('B03:S01', 'a', { does: '주문을 읽는다' }), step('B03:S02', 'b'), step('B03:S03', 'c')];
  const a = stepLine(steps, [], [], { width: 700, extra: [0, 2, 0] }), b = stepLine(steps, [], [], { width: 700, extra: [0, 2, 0] });
  assert.deepEqual(a, b);
  assert.equal(a.width, 700);
  assert.ok(stepLine(steps, [], [], { width: 10 }).width > 10);
  const [s1, s2, s3] = a.stations;
  assert.equal(s2.y - s1.y, 84, 'a station with a does line takes 84');
  assert.equal(s2.h, 24 + 2 * 20); assert.equal(s3.y - s2.y, 24 + 40 + 40);
  assert.equal(stepLine(order(3), [], []).stations[1].y - stepLine(order(3), [], []).stations[0].y, 64);
  noOverlap(a);
});

test('FORM-11 no overlaps on a busy line: entries, nested loops, a fork, conditions, exits and jumps together', () => {
  const steps = [step('B03:S01', '주문 받기', { does: '요청 본문을 읽는다', branch: [{ when: '본문 없음', to: [], max: null, outcome: '400' }] }),
    step('B03:S02', '검증', { loopIds: ['B03:L01'] }), step('B03:S03a', '카드', { alt: { group: 'S03', branch: 'a' }, loopIds: ['B03:L01'], cell: '카드면' }),
    step('B03:S03b', '계좌', { alt: { group: 'S03', branch: 'b' }, loopIds: ['B03:L01'], cell: '계좌면' }), step('B03:S04', '저장', { loopIds: ['B03:L02'], branch: [{ when: '충돌', to: ['B03:S02'], max: '최대 2번', outcome: null }] }),
    step('B03:S05', '알림', { loopIds: ['B03:L02'], branch: [{ when: '외부', to: ['B12:S01'], max: null, outcome: null }] }), step('B03:S06', '응답')];
  const loops = [loop('B03:L01', [], { unit: '결제 시도마다' }), loop('B03:L02', [], { unit: '저장 재시도' }), loop('B03:L03', ['B03:S02', 'B03:S03a', 'B03:S03b', 'B03:S04', 'B03:S05'], { unit: '주문마다' })];
  const l = stepLine(steps, loops, [{ ref: 'N01', name: '주문 API', kind: 'request' }], { width: 760, extra: [1, 0, 0, 0, 2, 0, 0] });
  assert.ok(l.brackets.length >= 2);
  noOverlap(l);
  assert.ok(l.stations.every(s => s.right <= l.width && s.left >= 0));
  assert.ok(l.brackets.every(b => b.x >= 0));
});

test('FORM-12 state graph: eligibility, nodes in first-appearance order on a circle clockwise from the top, no first-state emphasis', () => {
  assert.equal(stateOffer([{ name: '대기', event: '받음', next: '처리' }]).reason, STATE_FEW);
  assert.equal(stateOffer([{ name: '대기', event: null, next: null }, { name: '처리', event: null, next: null }]).ok, false);
  const rows = [{ name: '대기', event: '주문 받음', next: '처리 중' }, { name: '처리 중', event: '완료', next: '완료됨' }, { name: '처리 중', event: '실패', next: '대기' }];
  assert.deepEqual(stateOffer(rows), { ok: true, reason: STATE_CAPTION });
  const g = stateGraph(rows), g2 = stateGraph(rows);
  assert.deepEqual(g, g2, 'deterministic');
  assert.deepEqual(g.nodes.map(n => n.name), ['대기', '처리 중', '완료됨']);
  const [a, b, c] = g.nodes;
  assert.ok(a.cy < b.cy && a.cy < c.cy, 'the first at the top'); assert.ok(b.cx > a.cx && c.cx < a.cx, 'clockwise');
  // Every state the same size class and style: the first one is not emphasised.
  assert.equal(a.h, b.h); assert.ok(!('first' in a));
  assert.ok(g.nodes.every(n => !n.start), 'no start mark without an initial word');
  for (let i = 0; i < g.nodes.length; i++) for (let k = i + 1; k < g.nodes.length; k++) assert.ok(!overlaps(g.nodes[i], g.nodes[k]));
});

test('FORM-13 state graph: only real transitions, mutual pairs bend apart, self-loops, 사건 미기재, terminal double outline, start only when explicit', () => {
  const rows = [{ name: '초기', event: null, next: '열림' }, { name: '열림', event: '닫기', next: '닫힘' }, { name: '닫힘', event: '열기', next: '열림' },
    { name: '열림', event: '갱신', next: '열림' }, { name: '닫힘', event: '폐기', next: '보관' }];
  const g = stateGraph(rows);
  assert.equal(g.edges.length, 5);
  assert.equal(g.edges.find(e => e.from === '초기').label, NO_EVENT);
  assert.ok(g.edges.find(e => e.from === '열림' && e.to === '열림').self);
  const ab = g.edges.find(e => e.from === '열림' && e.to === '닫힘'), ba = g.edges.find(e => e.from === '닫힘' && e.to === '열림');
  assert.notEqual(ab.d, ba.d);
  const ctrl = d => d.match(/Q(-?[\d.]+),(-?[\d.]+)/).slice(1).map(Number);
  const [n1, n2] = [g.nodes.find(n => n.name === '열림'), g.nodes.find(n => n.name === '닫힘')];
  const side = ([x, y]) => Math.sign((n2.cx - n1.cx) * (y - n1.cy) - (n2.cy - n1.cy) * (x - n1.cx));
  assert.notEqual(side(ctrl(ab.d)), side(ctrl(ba.d)), 'A→B and B→A on opposite sides');
  assert.deepEqual(g.nodes.filter(n => n.start).map(n => n.name), ['초기']);
  assert.deepEqual(g.nodes.filter(n => n.terminal).map(n => n.name), ['보관']);
  assert.equal(STATE_TERMINAL, '이 상태에서 나가는 전이 행이 없음 (끝이라는 기록은 아님)');
  // An event saying start marks its state too; nothing else does.
  assert.deepEqual(stateGraph([{ name: '대기', event: 'start', next: '실행' }, { name: '실행', event: '멈춤', next: '대기' }]).nodes.filter(n => n.start).map(n => n.name), ['대기']);
  // Pills cover no state and no other pill; everything is inside the frame.
  const boxes = [...g.nodes, ...g.edges.map(e => e.pill)];
  for (let i = 0; i < boxes.length; i++) for (let k = i + 1; k < boxes.length; k++) assert.ok(!overlaps(boxes[i], boxes[k]), `${boxes[i].name ?? boxes[i].text} / ${boxes[k].name ?? boxes[k].text}`);
  assert.ok(boxes.every(r => r.x >= 0 && r.y >= 0 && r.x + r.w <= g.width && r.y + r.h <= g.height));
  assert.deepEqual(statesElsewhere(rows, [{ part: 'p2', name: '문서 보관', rows: [{ name: '보관', event: null, next: '삭제' }] }, { part: 'p3', name: '다른 것', rows: [{ name: 'x', event: null, next: 'y' }] }]),
    [{ part: 'p2', name: '문서 보관', shared: ['보관'] }]);
});

test('FORM-14 default form, stored choice and V: 노선 when it passes, 상태 전이 only for a part with no steps, a stored usable choice kept, unknown or unusable falls back', () => {
  const pass = { ok: true, reason: '' }, fail = { ok: false, reason: 'x' };
  assert.equal(defaultForm({ line: pass, states: pass, steps: 4 }), 'line');
  assert.equal(defaultForm({ line: fail, states: pass, steps: 0 }), 'states');
  assert.equal(defaultForm({ line: fail, states: pass, steps: 2 }), 'list');
  assert.equal(chooseForm('list', { line: pass, states: fail, steps: 4 }), 'list');
  assert.equal(chooseForm('states', { line: pass, states: fail, steps: 4 }), 'line', 'an unusable stored form falls back');
  assert.equal(chooseForm('frame', { line: pass, states: fail, steps: 4 }), 'line', 'an unknown value falls back');
  assert.equal(nextForm('list', { line: pass, states: pass, steps: 4 }), 'line');
  assert.equal(nextForm('states', { line: pass, states: pass, steps: 4 }), 'list');
  assert.equal(nextForm('list', { line: fail, states: pass, steps: 4 }), 'states');
  const s = store(), k = formKeyOf('saved:abc', 'part-1');
  assert.equal(readForm(s, k), null);
  assert.equal(writeForm(s, k, 'states'), true); assert.equal(readForm(s, k), 'states');
  assert.equal(FORM_KEY, 'agentflow.studio.form.1');
  s.setItem(FORM_KEY, JSON.stringify({ [k]: 'bogus' })); assert.equal(readForm(s, k), null);
  s.setItem(FORM_KEY, '{broken'); assert.equal(readForm(s, k), null); assert.equal(writeForm(s, k, 'line'), true); assert.equal(readForm(s, k), 'line');
  writeForm(s, k, null); assert.equal(readForm(s, k), null);
  assert.equal(writeForm({ getItem: () => null, setItem: () => { throw new Error('full'); } }, k, 'line'), false);
});

test('FORM-15 the map\'s form spots: eligible parts only, the loopiest first, then states, steps, name', () => {
  const spots = formSpots([
    { part: 'a', name: '가', steps: order(3), states: [], loops: 0 },
    { part: 'b', name: '나', steps: order(4), states: [], loops: 2 },
    { part: 'c', name: '다', steps: order(1), states: [{ name: 'x', event: null, next: 'y' }, { name: 'y', event: null, next: 'x' }], loops: 0 },
    { part: 'd', name: '라', steps: order(2), states: [], loops: 5 }]);
  assert.deepEqual(spots.map(s => [s.part, s.forms]), [['b', ['line']], ['c', ['states']], ['a', ['line']]]);
});

test('FORM-16 step IDs read once: owner numbers normalised, suffix kept; the module holds no DOM and no layout calls', () => {
  assert.deepEqual(parseStepRef('B03:S04a'), { owner: 'B3', n: 4, sfx: 'a' });
  assert.equal(parseStepRef('S04'), null); assert.equal(shortRef('B03:S4b'), 'S04b');
  const src = readFileSync(new URL('../src/client/view-forms.ts', import.meta.url), 'utf8');
  assert.ok(!/document\.|querySelector|window\./.test(src));
  // The forms never use the word for a group box in identifiers (frame means a group box in this codebase).
  assert.ok(!/\bframe/i.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
});

test('FORM-17 the detail view\'s form code never lays out the map, never queries or marks map lines and boxes, and the card footer word is visual only', () => {
  const app = readFileSync(new URL('../dist/public/client/app.js', import.meta.url), 'utf8');
  const body = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(j, k + 1); } return ''; };
  for (const fn of ['storedForms', 'formInput', 'setDetailForm', 'formEntries', 'opsNoneChip']) {
    const b = body(fn);
    for (const bad of ['renderSpace(', 'relayout(', 'layoutScope(', 'routeEdges(', 'positionWorld(', 'fitView(', 'applyCamera(', "'.edge", '[data-box', "'data-box'"]) assert.ok(!b.includes(bad), `${fn} has ${bad}`);
  }
  // The forms' own elements carry their own classes (vf-, sl-, vg-), never the map's line or box hooks.
  const detail = body('renderDetail');
  // (a class token "edge" exactly; vg-edge and sl- classes are the forms' own)
  assert.ok(!/class: [`'](?:[^`']*\s)?edge[\s`'$]/.test(detail) &&!detail.includes("'data-box'") && !detail.includes("'data-drag'"));
  // Section 4.1 / override 10: a part with no operations record keeps the word for screen readers and its tip; the pane says it.
  const card = body('cardEl');
  // Moved by spec cards v2 §1/§4: the card draws no footer word at all; its ops words sit in the kind line behind the display setting
  // (and the 상태·공백 lens, 「운영 기록 없음」 as .ops-none); the pane's head says it as a line of its own.
  assert.ok(card.includes('ops-none') && card.includes('c-opsw') && !card.includes('c-short') && !card.includes("'c-ops'"));
  assert.ok(!body('opsLineEl').includes('운영 기록 없음 · 이 부분의 가동·멈춤을 말한 기록이 없음'), 'polish round fixes 2: no such line');
  const css = readFileSync(new URL('../dist/public/styles.css', import.meta.url), 'utf8');
  assert.ok(/\.node\.card \.c-opsw \{ display: none/.test(css) && /\.space\.show-ops \.node\.card \.c-opsw:not\(\.ops-none\), \.space\.show-ops-all \.node\.card \.c-opsw \{ display: inline/.test(css));
  assert.ok(!/\.edge\.spine[^{]*\{[^}]*stroke-width/.test(css.slice(css.indexOf('Hierarchy pass (spec forms v1'))), 'the spine is not thickened (override 8)');
});
