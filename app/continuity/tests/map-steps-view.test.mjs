// The detail view's inside (map spec 4): the part's steps in the record's row order, each port with the steps the record
// explicitly maps it to (map-reading.9 portMap: 외부 관계 R → 입력 포트 O → 내부 단계 S; S → 출력 포트 → R), and a port mapped to
// none ending on the boundary with '진입 단계 미상' / '출구 단계 미상'. No link is guessed and steps are never joined to one
// another. And a step's consumers (spec 7): the lines the record maps out of it, else every line leaving the part, said so.
import test from 'node:test';
import assert from 'node:assert/strict';
import { detailChain, detailSigns, stepConsumers, unmappedMark, UNMAPPED_IN, UNMAPPED_OUT } from '../dist/public/client/steps-view.js';

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

// Rule signs at their places (spec 5.1, map-reading.10): a chip on the step box, port or ledger cell a rule's scope name or an
// anchor names (by name only), a part rule at the boundary head, a project rule at the view head, a rule placed nowhere among the
// unplaced; a name the part does not hold places nothing.
const R = (x) => ({ kind: 'reported', text: '', quote: '', about: null, topic: 'rule', scope: null, scopeName: null, anchors: [], enforcedBy: [], withdrawalKind: null, gate: null, ...x });
const A = (text, kind = 'stated') => ({ kind, text, quote: { record: 'P1', quote: text, from: 0, to: text.length } });

test('sign chips: on steps by index, on ports per side, on ledger cells; heads for part and project; names found nowhere unplaced', () => {
  const chain = detailChain(steps, pm, inputs, outputs), fields = ['valid_until', 'rung'];
  const rules = [
    R({ text: 'stale 금지', scope: 'step', scopeName: '판단' }),
    R({ text: '상한', scope: 'port', scopeName: '주문 요청' }),
    R({ text: '기동만', scope: 'port', scopeName: '‘정책 기동’' }),
    R({ text: '만료', scope: 'field', scopeName: 'valid_until', anchors: [A('행 읽기 단계', 'inferred')] }), // a field rule's anchor naming a step: 자리 없음
    R({ text: '읽기 순서', scope: 'part', anchors: [A('행 읽기 단계', 'inferred')] }),
    R({ text: '돈 안전', scope: 'part' }),
    R({ text: '전체 원칙', scope: 'project' }),
    R({ text: '없는 단계', scope: 'step', scopeName: 'S04 review 읽기', anchors: [A('engine.py:120')] }),
    R({ text: '없는 필드', scope: 'field', scopeName: 'expires_at' }),
    R({ text: '범위 미정' }),
  ];
  const ds = detailSigns(chain, fields, rules), texts = (m) => [...m].map(([k, l]) => [k, l.map(r => r.text)]);
  assert.deepEqual(texts(ds.steps), [[1, ['stale 금지']], [0, ['읽기 순서']]]);
  assert.deepEqual(texts(ds.ports.in), [['정책 기동', ['기동만']]]);
  assert.deepEqual(texts(ds.ports.out), [['주문 요청', ['상한']]]); // the step of the same name is not a port's place
  assert.deepEqual(texts(ds.cells), [['valid_until', ['만료']]]);
  assert.deepEqual(ds.boundary.map(r => r.text), ['읽기 순서', '돈 안전']); // a part rule an anchor places is at both
  assert.deepEqual(ds.open.map(r => r.text), ['돈 안전']); // only the one with no precise place reads 세부 접점 미정
  assert.deepEqual(ds.project.map(r => r.text), ['전체 원칙']);
  assert.deepEqual(ds.unplaced.map(r => r.text), ['없는 단계', '없는 필드', '범위 미정']);
  // A part with no steps, ports or fields: every named rule is unplaced, the part and project rules keep their heads.
  const bare = detailSigns(detailChain([], [], [], []), [], rules);
  assert.equal(bare.steps.size + bare.ports.in.size + bare.ports.out.size + bare.cells.size, 0);
  assert.deepEqual([bare.boundary.length, bare.project.length, bare.unplaced.length], [2, 1, 7]);
});
/* ---------- cycle 6: a run gate's decision step and its exits (spec 5.2) ---------- */
import { decisionStep, decisionExits, EXIT_BLANK } from '../dist/public/client/steps-view.js';

test('decisionStep: the step the gate\'s words name (an anchor first, then the longest name its quote or text holds), else the first, said so; exits only as written', () => {
  const steps = [{ name: '행 읽기', does: 'review 행을 읽는다', uses: [] },
    { name: '판단', does: 'rung을 고른다', uses: ['engine/rung.py', '참이면 주문 요청', '거짓이면: NONE_SIDE 쉼'] },
    { name: '판단 기록', does: '참이면 policy 행, 거짓이면 쓰지 않음', uses: [] }];
  const named = decisionStep({ text: 'CALM이면 진입', quote: '실행 관문: 판단 단계에서 CALM이면 진입' }, steps);
  assert.deepEqual(named, { index: 1, name: '판단', matched: 'name', exits: [{ when: '참이면', text: '주문 요청' }, { when: '거짓이면', text: 'NONE_SIDE 쉼' }] });
  // The longest name the words hold wins ('판단 기록' over '판단'); its exits read from what it does, split at commas.
  const longer = decisionStep({ text: '판단 기록에서 거절', quote: '판단 기록에서 거절한다' }, steps);
  assert.deepEqual([longer.index, longer.exits.map(e => `${e.when} ${e.text}`)], [2, ['참이면 policy 행', '거짓이면 쓰지 않음']]);
  // An anchor naming a step exactly comes first, whatever the words.
  assert.equal(decisionStep({ text: '판단 기록', quote: '판단 기록', anchors: [{ text: '행 읽기' }] }, steps).index, 0);
  // Named nowhere: the first step, said so, with its exits as written (none: the view shows 출구 미상).
  const first = decisionStep({ text: '모의 체결 7일', quote: '모의 체결 7일이 검증되면' }, steps);
  assert.deepEqual([first.index, first.matched, first.exits], [0, 'first', []]);
  assert.equal(decisionStep({ text: 'x', quote: 'x' }, []), null);
  assert.equal(EXIT_BLANK, '출구 미상');
  assert.deepEqual(decisionExits({ does: null, uses: ['참이면', '참이면 진입', '참이면 진입'] }), [{ when: '참이면', text: '진입' }]);
});

/* ---------- map-reading.12: a part's condition rows on its steps ---------- */
import { conditionPlace, conditionPlacement, conditionLines, conditionOfQuote, CONDITION_BLANK, CONDITION_UNPLACED } from '../dist/public/client/steps-view.js';

test('conditionPlacement: a condition stands on the step its when (else its then) names, by name or uses, equal before held; else apart', () => {
  const st = [{ name: '행 읽기', uses: ['engine/read.py'] }, { name: '판단', uses: ['engine/rung.py', 'J1'] }, { name: '판단 기록', uses: [] }, { name: '주문 요청', uses: [] }];
  const c = (when, then, e = null) => ({ when, then, else: e });
  // Equal (the rule chips' placeName: quote marks, spacing, case, a kind word aside) on the when first.
  assert.deepEqual(conditionPlace(c('‘판단’ 단계', '쉼'), st), { step: 1, by: 'when', key: 'name', how: 'equal' });
  assert.deepEqual(conditionPlace(c('j1', '쉼'), st), { step: 1, by: 'when', key: 'uses', how: 'equal' });
  // Held: the longest name or uses item the words hold ('판단 기록' over '판단'); the when before the then.
  assert.deepEqual(conditionPlace(c('판단 기록이 비면', '주문 요청'), st), { step: 2, by: 'when', key: 'name', how: 'holds' });
  assert.deepEqual(conditionPlace(c('engine/read.py가 실패하면', '쉼'), st), { step: 0, by: 'when', key: 'uses', how: 'holds' });
  // The when names no step: the then does.
  assert.deepEqual(conditionPlace(c('allowed_side = NONE', '주문 요청'), st), { step: 3, by: 'then', key: 'name', how: 'equal' });
  // Named nowhere: no place (never by guess); a one-character name is never held inside other words.
  assert.equal(conditionPlace(c('LINE_STALE이면', '거절'), st), null);
  assert.equal(conditionPlace(c('a가 늦으면', '쉼'), [{ name: 'a', uses: [] }]), null);
  assert.deepEqual(conditionPlace(c('a', '쉼'), [{ name: 'a', uses: [] }]), { step: 0, by: 'when', key: 'name', how: 'equal' }, 'equal still places it');
  assert.equal(conditionPlace(c('판단', '쉼'), []), null);
  const list = [c('판단 결과가 CALM', '주문 요청', 'NONE_SIDE 쉼'), c('LINE_STALE이면', '거절'), c('J1이 늦으면', '판단 기록'), c('경보 3회', '소유자 호출')];
  const p = conditionPlacement(list, st);
  assert.deepEqual([...p.steps.keys()], [1]);
  assert.deepEqual(p.steps.get(1).map(x => x.index), [0, 2], 'each step keeps the conditions in their own order');
  assert.deepEqual(p.unplaced.map(x => x.index), [1, 3]);
  assert.equal(p.unplaced[0].place, null);
  assert.deepEqual(conditionLines(list[0]), ['조건 판단 결과가 CALM → 주문 요청', '아니면 → NONE_SIDE 쉼']);
  assert.deepEqual(conditionLines(list[1]), ['조건 LINE_STALE이면 → 거절'], 'no else written: no 아니면 line');
  assert.equal(CONDITION_BLANK, '단계 미상'); assert.equal(CONDITION_UNPLACED, '자리 없는 조건');
});

test('decisionStep with conditions (map-reading.12): the exits are the condition rows on the decision step; before .12 the words of the step', () => {
  const steps = [{ name: '행 읽기', does: null, uses: [] }, { name: '판단', does: '참이면 policy 행', uses: ['참이면 주문 요청', '거짓이면 NONE_SIDE 쉼'] }];
  const gate = { text: 'CALM이면 진입', quote: '판단 단계에서 CALM이면 진입' };
  const conds = [{ when: '판단 결과가 CALM', then: '주문 요청', else: 'NONE_SIDE 쉼' }, { when: '행 읽기 실패', then: '재시도', else: null }, { when: '판단 지연', then: '쉼', else: null }];
  const d = decisionStep(gate, steps, conds);
  assert.equal(d.source, 'conditions');
  assert.deepEqual(d.exits, [{ when: '판단 결과가 CALM', text: '주문 요청', condition: 0, branch: 'then' }, { when: '아니면', text: 'NONE_SIDE 쉼', condition: 0, branch: 'else' },
    { when: '판단 지연', text: '쉼', condition: 2, branch: 'then' }], 'only the conditions placed on 판단; its 참이면 words are not read');
  // A .12 reading with no condition on that step: no exits (the view reads 출구 미상), never the words of the step.
  assert.deepEqual(decisionStep(gate, steps, []).exits, []);
  assert.deepEqual(decisionStep(gate, steps, [conds[1]]).exits, []);
  // Older than .12 (no conditions): the fallback to what the step uses and does, the earlier shape unchanged.
  const old = decisionStep(gate, steps);
  assert.equal(old.source, undefined);
  assert.deepEqual(old.exits, [{ when: '참이면', text: '주문 요청' }, { when: '거짓이면', text: 'NONE_SIDE 쉼' }, { when: '참이면', text: 'policy 행' }]);
  assert.deepEqual(decisionStep(gate, steps, null), old);
});

test('conditionOfQuote: a rule anchor whose row is a condition row (same record and words, the same span when both carry one)', () => {
  const conds = [{ quote: { record: 'P1', quote: '| A | B |', from: 10, to: 19 } }, { quote: { record: 'P1', quote: 'LINE_STALE이면 거절한다', from: 40, to: 58 } }];
  assert.equal(conditionOfQuote({ record: 'P1', quote: 'LINE_STALE이면  거절한다', from: 40, to: 58 }, conds), 1);
  assert.equal(conditionOfQuote({ record: 'P1', quote: 'LINE_STALE이면 거절한다' }, conds), 1, 'no span on the anchor: the words decide');
  assert.equal(conditionOfQuote({ record: 'P1', quote: 'LINE_STALE이면 거절한다', from: 90, to: 108 }, conds), -1, 'the same words elsewhere in the record');
  assert.equal(conditionOfQuote({ record: 'P2', quote: '| A | B |', from: 10, to: 19 }, conds), -1);
  assert.equal(conditionOfQuote({ record: 'P1', quote: '| A |' }, conds), -1);
});
