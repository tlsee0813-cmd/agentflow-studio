// map-reading.13 on the map, the client's pure part (line-view): the 「프로그램」 mark on what the program carried over from the record
// (a loop's items told apart by where they came from, kept state, a rule's places), and a line's type chip (the format artifact's name
// with up to three fields, '+N' for the rest, giving way one field at a time), its data contract in the pane, and the picked line's block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAM_LABEL, PROGRAM_HINT, isProgram, ruleHasProgram, programLoopItems, loopSegments, typeChipForms, chipText, edgeFields, contractList, lineFacts, LINE_BLANKS, CHIP_FIELDS } from '../dist/public/client/line-view.js';
import { ruleView } from '../dist/public/client/signs-view.js';
import { loopLine } from '../dist/public/client/expansion.js';

const COND = [{ when: 'quota.used >= quota.limit', then: 'QUOTA_REACHED, 오늘 조회 멈춤', else: null }, { when: 'RESUME 신호', then: '다음 날 재개', else: '대기' }];

test('the program chip: its words, and only a value the contract marks program', () => {
  assert.equal(PROGRAM_LABEL, '프로그램');
  assert.equal(PROGRAM_HINT, '기록에서 프로그램이 옮긴 값 · 모델 답 아님');
  assert.equal(isProgram({ program: true }), true);
  for (const x of [{ program: false }, {}, null, undefined]) assert.equal(isProgram(x), false);
  assert.equal(ruleHasProgram({ anchors: [{ kind: 'inferred', program: false }, { kind: 'inferred', program: true }] }), true);
  assert.equal(ruleHasProgram({ anchors: [{ kind: 'stated' }] }), false);
  assert.equal(ruleHasProgram({}), false, 'a rule an earlier reading wrote carries no program place');
});

test('a loop\'s program items: a unit that is a setting verbatim, a stop or resume that is a condition outcome verbatim', () => {
  const cfg = ['j1_cadence 60 s', '618df374'];
  assert.deepEqual(programLoopItems({ unit: 'j1_cadence 60 s', stop: null, resume: null, program: true }, cfg, []), { unit: true, stop: false, resume: false }, 'the program loop from the cadence setting');
  assert.deepEqual(programLoopItems({ unit: '호가 틱마다', stop: 'QUOTA_REACHED, 오늘 조회 멈춤', resume: null, program: true }, cfg, COND), { unit: false, stop: true, resume: false }, 'the model\'s unit stays the model\'s; the stop the program added is marked');
  assert.deepEqual(programLoopItems({ unit: 'j1_cadence 60 s', stop: 'QUOTA_REACHED, 오늘 조회 멈춤', resume: '다음 날 재개', program: true }, cfg, COND), { unit: true, stop: true, resume: true });
  assert.deepEqual(programLoopItems({ unit: '틱', stop: '멈춤', resume: null, program: true }, cfg, COND), { unit: true, stop: true, resume: false }, 'none told apart: every item the loop says is marked, never shown as the model\'s');
  assert.deepEqual(programLoopItems({ unit: 'j1_cadence 60 s', stop: null, resume: null, program: false }, cfg, COND), { unit: false, stop: false, resume: false }, 'the model\'s loop, even when its unit is a setting');
  assert.deepEqual(programLoopItems({ unit: 'x', stop: null, resume: null }, cfg, COND), { unit: false, stop: false, resume: false }, 'before .13: no flag, the model\'s');
  assert.deepEqual(programLoopItems(null, cfg, COND), { unit: false, stop: false, resume: false });
});

test('the loop line in parts reads as loopLine; a program loop with only a unit keeps 정지 미상 · 재개 미상', () => {
  const loop = { unit: 'j1_cadence 60 s', stop: null, resume: null, program: true };
  const segs = loopSegments(loop, ['j1_cadence 60 s'], []);
  assert.deepEqual(segs.map(s => [s.key, s.text, s.program]), [['unit', '반복 j1_cadence 60 s', true], ['stop', '정지 미상', false], ['resume', '재개 미상', false]]);
  assert.equal(segs.map(s => s.text).join(' · '), loopLine(loop));
});

test('the type chip: the name with up to three fields and +N, then one field fewer each time down to the name', () => {
  const forms = typeChipForms('주문 요청', ['order_id', 'amount', 'currency', 'items', 'idempotency_key']);
  assert.equal(CHIP_FIELDS, 3);
  assert.deepEqual(forms.map(chipText), ['주문 요청 · order_id · amount · currency 필드 +2', '주문 요청 · order_id · amount 필드 +3', '주문 요청 · order_id 필드 +4', '주문 요청 필드 +5'] /* cards v2 §1: the count names its noun */);
  assert.deepEqual(typeChipForms('응답', ['status', 'tracking_no']).map(chipText), ['응답 · status · tracking_no', '응답 · status 필드 +1', '응답 필드 +2'], 'two fields: no count until one gives way');
  assert.deepEqual(typeChipForms('x', []).map(chipText), ['x']);
});

test('a drawn line\'s fields: only when its relations hand over one thing; each field once', () => {
  const said = new Map([['r1', { payload: '주문 요청', fields: ['order_id', 'amount'] }], ['r2', { payload: '주문 요청', fields: ['amount', 'currency'] }], ['r3', { payload: '응답', fields: ['status'] }], ['r4', { payload: null, fields: [] }]]);
  assert.deepEqual(edgeFields(['r1'], said), ['order_id', 'amount']);
  assert.deepEqual(edgeFields(['r1', 'r2'], said), ['order_id', 'amount', 'currency']);
  assert.deepEqual(edgeFields(['r1', 'r3'], said), [], 'two payloads: the label says neither, nor their fields');
  assert.deepEqual(edgeFields(['r4'], said), []);
  assert.deepEqual(edgeFields(['zz'], said), []);
});

test('the data contract in the pane and the picked line\'s block, blanks as their own words', () => {
  assert.deepEqual(contractList('주문 요청', ['order_id', 'amount']), { head: '데이터 계약 · 2 필드', name: '주문 요청', cells: ['order_id', 'amount'] });
  assert.equal(contractList('주문 요청', []), null);
  assert.deepEqual(lineFacts({ payload: '주문 요청', cadence: '주문마다', mode: 'design', channel: 'data', fields: ['a'] }).map(x => x.text), ['넘기는 것 · 주문 요청', '박자 · 주문마다', '방식 · 설계', '채널 · 데이터']);
  const blank = lineFacts({ payload: null, cadence: null, mode: null, channel: null, fields: [] });
  assert.deepEqual(blank.map(x => [x.text, x.blank]), [[LINE_BLANKS.payload, true], ['박자 미기재', true], [LINE_BLANKS.mode, true], [LINE_BLANKS.channel, true]]);
});

test('a rule\'s program place reads 프로그램, never 명시/해석', () => {
  const Q = q => ({ record: 'R1', quote: q });
  const v = ruleView({ scope: 'part', scopeName: null, enforcedBy: [], anchors: [{ kind: 'inferred', text: '환불 요청', quote: Q('a'), program: true }, { kind: 'inferred', text: '판단', quote: Q('b') }, { kind: 'stated', text: '판단', quote: Q('c'), program: false }] },
    { steps: ['판단'], inputs: [], outputs: [], fields: [] });
  assert.deepEqual(v.anchors.map(a => [a.label, a.program]), [['프로그램', true], ['해석', false], ['명시', false]]);
});
