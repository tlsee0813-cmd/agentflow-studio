// The detail view's inside (map spec 4): the part's steps in the record's row order, each port with the steps the record
// explicitly maps it to (map-reading.9 portMap: 외부 관계 R → 입력 포트 O → 내부 단계 S; S → 출력 포트 → R), and a port mapped to
// none ending on the boundary with '진입 단계 미상' / '출구 단계 미상'. No link is guessed and steps are never joined to one
// another. And a step's consumers (spec 7): the lines the record maps out of it, else every line leaving the part, said so.
import test from 'node:test';
import assert from 'node:assert/strict';
import { detailChain, stepConsumers, unmappedMark, UNMAPPED_IN, UNMAPPED_OUT } from '../dist/public/client/steps-view.js';

const steps = [
  { name: '행 읽기', does: 'review.jsonl 새 행을 읽는다', uses: ['engine/read.py'] },
  { name: '판단', does: 'rung을 고른다', uses: ['engine/rung.py', 'J1'] },
  { name: '주문 요청', does: null, uses: [] },
];
const inputs = ['review 행', '정책 기동'], outputs = ['판단 행', '주문 요청'];
const pm = [
  { relationId: 'R2', port: 'review 행', step: '행 읽기', direction: 'in' },
  { relationId: 'R3', port: '판단 행', step: '판단', direction: 'out' },
  { relationId: 'R6', port: '주문 요청', step: '주문 요청', direction: 'out' },
];

test('mapped ports link to their steps; an unmapped port carries its blank; steps keep the record\'s order', () => {
  const c = detailChain(steps, pm, inputs, outputs);
  assert.deepEqual(c.rows.map(r => [r.index, r.name]), [[0, '행 읽기'], [1, '판단'], [2, '주문 요청']]);
  assert.deepEqual(c.links, [
    { port: 'review 행', step: 0, direction: 'in', relationIds: ['R2'] },
    { port: '판단 행', step: 1, direction: 'out', relationIds: ['R3'] },
    { port: '주문 요청', step: 2, direction: 'out', relationIds: ['R6'] },
  ]);
  assert.deepEqual(c.ports.in, [
    { port: 'review 행', direction: 'in', steps: [0], mark: null },
    { port: '정책 기동', direction: 'in', steps: [], mark: '진입 단계 미상' },
  ]);
  assert.deepEqual(c.ports.out.map(p => [p.port, p.steps, p.mark]), [['판단 행', [1], null], ['주문 요청', [2], null]]);
  assert.deepEqual(c.rows[0].ins, ['review 행']); assert.deepEqual(c.rows[1].outs, ['판단 행']);
  assert.deepEqual(c.rows[1].uses, ['engine/rung.py', 'J1']);
  assert.deepEqual(c.stray, []);
  // No link between steps: every link has a port at one end.
  assert.ok(c.links.every(l => typeof l.port === 'string' && l.port));
});

test('no mapping at all: every port ends on the boundary with its blank, both directions', () => {
  const c = detailChain(steps, [], inputs, outputs);
  assert.deepEqual(c.links, []);
  assert.ok(c.ports.in.every(p => p.mark === UNMAPPED_IN && !p.steps.length));
  assert.ok(c.ports.out.every(p => p.mark === UNMAPPED_OUT && !p.steps.length));
  assert.equal(UNMAPPED_IN, '진입 단계 미상'); assert.equal(UNMAPPED_OUT, '출구 단계 미상');
  assert.equal(unmappedMark('in'), '진입 단계 미상'); assert.equal(unmappedMark('out'), '출구 단계 미상');
  // No steps: the same blanks, no rows (the view then says '기록된 단계 없음 · 진입 단계 미상' once).
  const none = detailChain([], pm, inputs, outputs);
  assert.deepEqual(none.rows, []); assert.deepEqual(none.links, []);
  assert.equal(none.stray.length, 3, 'rows naming steps the part does not hold are set aside, never attached elsewhere');
});

test('rows naming an unknown step or port are set aside; two lines through the same port and step make one link', () => {
  const rows = [...pm,
    { relationId: 'R9', port: 'review 행', step: '행 읽기', direction: 'in' },
    { relationId: 'R2', port: 'review 행', step: '행 읽기', direction: 'in' },
    { relationId: 'R7', port: '없는 포트', step: '판단', direction: 'in' },
    { relationId: 'R8', port: '정책 기동', step: '없는 단계', direction: 'in' },
    { relationId: 'R5', port: '판단 행', step: '판단', direction: 'in' }, // an output name on the in side
  ];
  const c = detailChain(steps, rows, inputs, outputs);
  assert.deepEqual(c.links.find(l => l.port === 'review 행').relationIds, ['R2', 'R9']);
  assert.equal(c.links.length, 3);
  assert.deepEqual(c.stray.map(m => m.relationId), ['R7', 'R8', 'R5']);
  assert.equal(c.ports.in.find(p => p.port === '정책 기동').mark, '진입 단계 미상');
  // One port into two steps: both are its steps, in the record's order.
  const two = detailChain(steps, [{ relationId: 'R1', port: '정책 기동', step: '판단', direction: 'in' }, { relationId: 'R1', port: '정책 기동', step: '행 읽기', direction: 'in' }], inputs, outputs);
  assert.deepEqual(two.ports.in.find(p => p.port === '정책 기동').steps, [0, 1]);
});

test('stepConsumers: the lines mapped out of the step, else every line leaving the part (not mapped)', () => {
  const out = [{ relationId: 'R3', far: 'policy' }, { relationId: 'R6', far: 'actor' }];
  assert.deepEqual(stepConsumers('판단', pm, out), { mapped: true, list: [{ relationId: 'R3', far: 'policy', port: '판단 행' }] });
  assert.deepEqual(stepConsumers('주문 요청', pm, out), { mapped: true, list: [{ relationId: 'R6', far: 'actor', port: '주문 요청' }] });
  // A step the record maps nothing out of: every leaving line, with no port (which of them it feeds is not said).
  assert.deepEqual(stepConsumers('행 읽기', pm, out), { mapped: false, list: [{ relationId: 'R3', far: 'policy', port: null }, { relationId: 'R6', far: 'actor', port: null }] });
  // A mapped row whose line no longer leaves the part does not count as a mapping.
  assert.deepEqual(stepConsumers('판단', pm, [{ relationId: 'R6', far: 'actor' }]).mapped, false);
  assert.deepEqual(stepConsumers('판단', pm, []), { mapped: false, list: [] });
});
