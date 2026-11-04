// Card families and templates (map design v3 3.1–3.6, 4.1): the family from the type word alone (AI 판단 is a process, a timer a
// trigger), the inside as a capability (never a family), a glyph per kind, at most three kind rows from the record's own fields with
// the kind's one defining blank, the contract area (list values by name, muted, until items carry their own lines; pins only for a
// model portMap row; the words 「항목 근거 미연결」 only in a tip and the panel, map design v3 0.1),
// the heights on an 8px grid, and lines that meet a pin only when a model portMap row ties them to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { familyOf, innerOf, kindWord, lifecycleOf, kindRows, contractOf, cardTemplate, cardHeights, timeBasis, FAMILY_WORD, KIND_ROWS, NAME_ROOM, CARD_W, GRID, UNLINKED_TIP } from '../dist/public/client/card-family.js';
import { GLYPH, glyphSvg } from '../dist/public/client/card-glyphs.js';
import { FAMILY_OF, TYPE_LABEL } from '../dist/public/shared/claim-topic.js';
import { opsCard, opsWord } from '../dist/public/client/ops-line.js';
import { routeEdges, pinOf } from '../dist/public/client/map-route.js';

const TYPES = ['collector', 'compute', 'ai', 'loop', 'timer', 'actor', 'store', 'person', 'session', 'external'];
const facts = (x = {}) => ({ type: null, config: [], inputs: [], outputs: [], fields: [], loop: null, steps: [], conditions: [], ...x });
const step = (does = null) => ({ does });

test('families: four and a neutral, from the type word alone; AI 판단 is a process, a timer a trigger, a loop a process', () => {
  assert.equal(familyOf('ai'), 'process'); assert.equal(familyOf('loop'), 'process'); assert.equal(familyOf('timer'), 'trigger');
  assert.equal(familyOf('store'), 'store'); for (const t of ['person', 'session', 'external']) assert.equal(familyOf(t), 'participant');
  for (const t of ['collector', 'compute', 'actor']) assert.equal(familyOf(t), 'process');
  assert.equal(familyOf(null), 'neutral'); assert.equal(familyOf(undefined), 'neutral');
  assert.deepEqual(new Set(Object.values(FAMILY_OF)), new Set(['participant', 'process', 'store', 'trigger']), 'no container family, no loop or timer family');
  // An inside, steps or a loop never change a family: a session with children stays a participant.
  for (const t of TYPES) assert.equal(familyOf(t, 7, true, 4), familyOf(t));
  assert.equal(familyOf(null, 9, true, 3), 'neutral');
  assert.deepEqual(Object.keys(FAMILY_WORD).sort(), ['neutral', 'participant', 'process', 'store', 'trigger']);
  assert.equal(FAMILY_WORD.trigger, '촉발·관문');
});

test('innerOf: the inside is a capability from the data (steps, loop, children), never from a name', () => {
  assert.equal(innerOf('loop', 1, false, 0), 'steps', 'a loop type with one step has an action well');
  assert.equal(innerOf('loop', 0, true, 0), null);
  assert.equal(innerOf('compute', 2, true, 0), 'steps', 'a type that may repeat, two steps and a recorded loop');
  assert.equal(innerOf('compute', 2, false, 0), 'list', 'steps without a loop: a list, no order or repeat given');
  assert.equal(innerOf('compute', 1, true, 0), null);
  assert.equal(innerOf('timer', 3, true, 0), 'list', 'a timer repeats nothing of its own (LOOP_TYPES): its steps are a list');
  assert.equal(innerOf(null, 2, true, 0), 'steps', 'a part with no type word may repeat');
  assert.equal(innerOf('session', 0, false, 3), 'composition');
  assert.equal(innerOf('loop', 4, true, 2), 'both');
  assert.equal(innerOf('person', 1, false, 0), null);
});

test('glyphs: one per kind, all different, inline SVG strokes with no fill; the composition mark is a badge of its own', () => {
  for (const t of [...TYPES, 'neutral', 'composition']) assert.ok(GLYPH[t] && /<(path|circle|rect)/.test(GLYPH[t]), t);
  assert.equal(new Set(Object.values(GLYPH)).size, Object.keys(GLYPH).length, 'kinds are told apart by shape (greyscale)');
  const s = glyphSvg('ai');
  assert.match(s, /viewBox="0 0 16 16"/); assert.match(s, /fill="none"/); assert.match(s, /stroke-width="1\.5"/); assert.match(s, /aria-hidden="true"/);
  assert.doesNotMatch(Object.values(GLYPH).join(''), /fill="#|stroke="#|style=/, 'no colour in a glyph: the tile carries the family colour');
  for (const t of TYPES) assert.equal(kindWord(t), TYPE_LABEL[t]);
  assert.equal(kindWord(null), '유형 미상');
});

test('lifecycle: 폐기 / 미구현 / 설계만 as the record wrote it, nothing for any other state', () => {
  assert.equal(lifecycleOf('retired'), '폐기'); assert.equal(lifecycleOf('unbuilt'), '미구현');
  assert.equal(lifecycleOf('unbuilt', '상태: 설계만 [보고]'), '설계만');
  for (const s of ['running', 'working', 'stopped', 'unknown', null, undefined]) assert.equal(lifecycleOf(s), null);
});

test('kind rows (3.4): at most three, only what the record says, with the kind\'s one defining blank', () => {
  // A loop: 반복 · 정지 · 재개; the unit missing is the blank 「반복 단위 ?」.
  assert.deepEqual(kindRows(facts({ type: 'loop', loop: { unit: '명령별', stop: '목록 끝', resume: null } })), [{ label: '반복', value: '명령별' }, { label: '정지', value: '목록 끝' }]);
  assert.deepEqual(kindRows(facts({ type: 'loop', loop: { unit: null, stop: null, resume: '재시작' } })), [{ label: '반복 단위', value: '?', blank: true }, { label: '재개', value: '재시작' }]);
  assert.deepEqual(kindRows(facts({ type: 'loop', config: ['폴링 60 s'] }))[0], { label: '반복', value: '폴링 60 s', unlinked: true }, 'a beat-like setting stands for the unit (a setting: no line of its own)');
  assert.deepEqual(kindRows(facts({ type: 'loop', loop: { unit: '60 s', stop: null, resume: null }, loopProgram: { unit: true, stop: false, resume: false } }))[0], { label: '반복', value: '60 s', program: true }, 'the program\'s unit keeps its chip');
  // A store: writers and readers counted from the relations, retention from config[0]; the blank by what is missing.
  assert.deepEqual(kindRows(facts({ type: 'store', writers: 1, readers: 2 })), [{ label: '관계', value: '쓰는 쪽 1 · 읽는 쪽 2' }, { label: '행 형식', value: '?', blank: true }]);
  assert.deepEqual(kindRows(facts({ type: 'store', fields: ['a'] })), [{ label: '보존 기간', value: '?', blank: true }]);
  assert.deepEqual(kindRows(facts({ type: 'store', fields: ['a'], config: ['30일'] })), [{ label: '설정', value: '30일', unlinked: true }], 'a setting is not called a retention');
  // A timer: up to two beats, the time basis when the schedule names one, the parts it starts; no schedule: 「일정 ?」.
  assert.deepEqual(kindRows(facts({ type: 'timer', config: ['매일 00:15Z', '5분마다', '매시 정각'], controlOut: ['수집기'] })),
    [{ label: '주기', value: '매일 00:15Z', unlinked: true }, { label: '주기', value: '5분마다', unlinked: true }, { label: '시간 기준', value: 'UTC', unlinked: true }]);
  assert.deepEqual(kindRows(facts({ type: 'timer', config: ['토큰 키'], controlOut: ['수집기', '정리', '보고', '알림'] })), [{ label: '일정', value: '?', blank: true }, { label: '대상', value: '수집기 · 정리 · +2' }]);
  // AI 판단: 맥락 · 기준 · 반환 (blank 「반환 형식 ?」), 출구 from the condition rows when there is room.
  assert.deepEqual(kindRows(facts({ type: 'ai', inputs: ['review 행'], config: ['rung 표'] })),
    [{ label: '맥락', value: 'review 행', unlinked: true }, { label: '기준', value: 'rung 표', unlinked: true }, { label: '반환 형식', value: '?', blank: true }]);
  assert.deepEqual(kindRows(facts({ type: 'ai', outputs: ['판정'], conditions: [{ then: '진입', else: null }, { then: '쉼', else: null }] })), [{ label: '반환', value: '판정', unlinked: true }, { label: '출구', value: '진입 · 쉼' }]);
  // An actor: its effect, and 「실패 대응 ?」 only beside an effect and only while nothing it says reads as failure handling.
  assert.deepEqual(kindRows(facts({ type: 'actor', outputs: ['주문 제출'] })), [{ label: '효과', value: '주문 제출', unlinked: true }, { label: '실패 대응', value: '?', blank: true }]);
  assert.deepEqual(kindRows(facts({ type: 'actor', outputs: ['주문 제출'], failureSaid: true })), [{ label: '효과', value: '주문 제출', unlinked: true }]);
  assert.deepEqual(kindRows(facts({ type: 'actor' })), [], 'no effect exit: no failure blank');
  // People, sessions, external systems, collectors, computations, neutral parts: rows from their own fields, no blank.
  assert.deepEqual(kindRows(facts({ type: 'person', personRules: 2, controlOut: ['집행자'] })), [{ label: '지키는 규칙', value: '2' }, { label: '결정', value: '집행자' }]);
  assert.deepEqual(kindRows(facts({ type: 'person' })), [], 'a person keeps only what is recorded');
  assert.deepEqual(kindRows(facts({ type: 'session', controlIn: ['소유자'], fileRoles: 3, config: ['--fast'] })), [{ label: '요청자', value: '소유자' }, { label: '다루는 파일', value: '3' }, { label: '설정', value: '--fast', unlinked: true }]);
  assert.deepEqual(kindRows(facts({ type: 'external', steps: [step(), step()] })), [{ label: '내부', value: '기록 범위 밖 · 단계 2' }]);
  assert.deepEqual(kindRows(facts({ type: 'collector', dataIn: ['거래소', '시세', '뉴스'], dataInCadence: ['1 s'] })), [{ label: '출처', value: '거래소 · 시세 · +1' }, { label: '박자', value: '1 s' }]);
  assert.deepEqual(kindRows(facts({ type: 'compute', steps: [step('평균을 낸다')], config: ['창 20'] })), [{ label: '계산', value: '평균을 낸다' }, { label: '설정', value: '창 20', unlinked: true }]);
  assert.deepEqual(kindRows(facts({ type: 'compute', steps: [step('a'), step('b')] })), [], 'more than one step: no 계산 row (the steps are the inside)');
  assert.deepEqual(kindRows(facts({ config: ['x'] })), [{ label: '설정', value: 'x', unlinked: true }]);
  // A collector's beat from its incoming line is the line's (linked); from a setting it is unlinked.
  assert.deepEqual(kindRows(facts({ type: 'collector', config: ['5분마다'] })), [{ label: '박자', value: '5분마다', unlinked: true }]);
  // Never more than three rows, never more than one blank, whatever the record holds.
  for (const t of [...TYPES, null]) for (const cfg of [[], ['5분마다'], ['5분마다', '매시', 'UTC 00:00']]) for (const o of [[], ['결과']]) {
    const rows = kindRows(facts({ type: t, config: cfg, outputs: o, inputs: ['a', 'b', 'c'], controlIn: ['x'], controlOut: ['y'], fileRoles: 2, personRules: 1, conditions: [{ then: 'z', else: null }], loop: { unit: null, stop: 's', resume: 'r' } }));
    assert.ok(rows.length <= KIND_ROWS, `${t}: ${rows.length}`);
    assert.ok(rows.filter(r => r.blank).length <= 1, `${t}: one blank at most`);
    for (const r of rows) assert.ok(r.label && r.value, `${t}: a row says something`);
  }
});

test('timeBasis: only a time the schedule writes in a zone', () => {
  assert.equal(timeBasis(['매일 00:15Z']), 'UTC'); assert.equal(timeBasis(['UTC 09:00']), 'UTC'); assert.equal(timeBasis(['09:00 KST']), 'KST');
  assert.equal(timeBasis(['5분마다']), null);
});

test('contract (3.3, principle 9, 0.1): list values by name until items carry their own lines; pins only for a model portMap row', () => {
  // Two names a side and '+N', a store's fields three; every name unlinked (the card draws it muted under a dotted rule).
  assert.deepEqual(contractOf(facts({ inputs: ['a', 'b', 'c'], outputs: ['x', 'y'] })), { kind: 'values', rows: [{ label: '받는 것', names: ['a', 'b'], more: 1 }, { label: '내는 것', names: ['x', 'y'], more: 0 }] });
  assert.deepEqual(contractOf(facts({ inputs: ['a'] })), { kind: 'values', rows: [{ label: '받는 것', names: ['a'], more: 0 }] });
  assert.deepEqual(contractOf(facts()), { kind: 'values', rows: [] }, 'nothing recorded: no rows on the card (the panel says the ports are not recorded), never two empty pins');
  assert.deepEqual(contractOf(facts({ type: 'store', inputs: ['r'], outputs: ['s'], fields: ['f1', 'f2', 'f3', 'f4', 'f5'] })),
    { kind: 'values', rows: [{ label: '쓰기', names: ['r'], more: 0 }, { label: '읽기', names: ['s'], more: 0 }, { label: '필드', names: ['f1', 'f2', 'f3'], more: 2 }] }, 'a store\'s columns are 쓰기 / 읽기, its fields three and +N');
  assert.deepEqual(contractOf(facts({ type: 'ai', inputs: ['행'], outputs: ['판정'] })).rows, [], 'AI 판단 names them in 맥락 and 반환 already');
  assert.deepEqual(contractOf(facts({ type: 'actor', inputs: ['주문'], outputs: ['제출'] })).rows, [{ label: '받는 것', names: ['주문'], more: 0 }], 'an actor\'s 효과 names its output already');
  // The words 「항목 근거 미연결」 never print on the card: only in a value's tip (and in the panel).
  for (const f of [facts({ inputs: ['a'], outputs: ['b'] }), facts({ type: 'store', fields: ['x'] }), facts()]) assert.doesNotMatch(JSON.stringify(cardTemplate(f)), /항목 근거 미연결|포트 미기록/);
  assert.equal(UNLINKED_TIP, '항목 근거 미연결 — 정리가 이 항목의 원문 줄을 따로 저장하지 않음');
  assert.deepEqual(contractOf(facts({ inputs: ['명령 목록'], outputs: ['측정 결과'], pins: { in: ['명령 목록'], out: [] }, unmapped: 2 })),
    { kind: 'pins', inTitle: '받는 것', outTitle: '내는 것', ins: ['명령 목록'], outs: [], unmapped: 2 });
  const many = contractOf(facts({ pins: { in: ['a', 'b', 'c', 'd', 'a'], out: ['x'] } }));
  assert.deepEqual(many.ins, ['a', 'b', 'c'], 'three a side, each once');
});

test('heights (3.8, 5.3): the near content on an 8px grid; the timer mock-up is 208; the name lines change the head only', () => {
  const timer = cardTemplate(facts({ type: 'timer', config: ['5분마다'], controlOut: ['수집기'] }));
  // 12 · head 52 · rows (2 × 20 + 12) · no contract (nothing recorded) · bottom 28 · 12 = 156 → 160.
  const h1 = cardHeights(timer, 1);
  assert.equal(h1.head, 52); assert.equal(h1.rows, 52); assert.equal(h1.contract, 0); assert.equal(h1.bottom, 28); assert.equal(h1.total % GRID, 0); assert.equal(h1.total, 160);
  const h2 = cardHeights(timer, 2);
  assert.equal(h2.head, 72); assert.equal(h2.total - h1.total >= 16, true);
  assert.equal(cardHeights(timer, 5).head, 72, 'two name lines at most');
  // Three rows: 12 + 52 + 72 + 28 + 12 = 176 (the mock-up's 208 held a contract line the record does not fill); value rows add 20 each
  // and their 12.
  assert.equal(cardHeights(cardTemplate(facts({ type: 'timer', config: ['5분마다', '매시 00:00Z'], controlOut: ['수집기'] })), 1).total, 176);
  assert.equal(cardHeights(cardTemplate(facts({ inputs: ['a'], outputs: ['b'] })), 1).contract, 2 * 20 + 12);
  // Pins: title 16 + rows 24 + 8; each pin's centre on its row; the contact point the pin rows' middle.
  const pinned = cardTemplate(facts({ type: 'loop', loop: { unit: '명령별', stop: null, resume: null }, pins: { in: ['명령 목록'], out: ['측정 결과', '요약'] }, unmapped: 0 }));
  const hp = cardHeights(pinned, 1), top = 1 + 12 + 52 + 32;
  assert.equal(hp.contract, 16 + 2 * 24 + 8);
  assert.deepEqual(hp.pins, { 'in:명령 목록': top + 16 + 12, 'out:측정 결과': top + 16 + 12, 'out:요약': top + 16 + 36 });
  assert.equal(hp.contact, top + (16 + 48) / 2);
  // The sign row and the inner line each add their own height.
  const plain = cardTemplate(facts()), signed = cardTemplate(facts({ signs: true })), stepped = cardTemplate(facts({ steps: [step(), step()] }));
  assert.ok(cardHeights(signed, 1).total >= cardHeights(plain, 1).total + 16);
  assert.equal(stepped.innerLine.text, '단계 2', 'a plain list: the row order reads in the tip, not on the line');
  assert.equal(cardHeights(stepped, 1).inner, 24);
  assert.equal(CARD_W, 272); assert.equal(NAME_ROOM, 212);
});

test('the inner line: steps in the record\'s row order, the loop\'s unit, the program\'s cut steps apart', () => {
  const t = cardTemplate(facts({ type: 'loop', loop: { unit: '명령별', stop: null, resume: null }, steps: [step(), { does: null, program: true }, step()] }));
  assert.equal(t.inner, 'steps'); assert.deepEqual(t.innerLine, { text: '단계 2 · 명령별', names: [], more: 2, program: 1 });
  // The first three recorded steps by name (each carries its quote), then how many more; the program's cut steps apart.
  const named = cardTemplate(facts({ type: 'compute', steps: ['파싱', '측정', '내보내기', '정리'].map(name => ({ name, does: null })).concat([{ name: '잘린', does: null, program: true }]) }));
  assert.deepEqual(named.innerLine, { text: '단계 4', names: ['파싱', '측정', '내보내기'], more: 1, program: 1 });
  assert.equal(cardTemplate(facts({ type: 'person' })).innerLine, null);
  assert.equal(cardTemplate(facts({ type: 'session', children: 2 })).inner, 'composition');
  assert.equal(cardTemplate(facts({ type: 'session', children: 2 })).family, 'participant', 'a session with children stays a participant');
});

test('the bottom line (3.2): 「보고」 stays in the words, the time short, no 「현재 미확인」 on the card', () => {
  assert.deepEqual(opsCard('running', '2026-11-04T08:01Z', '2026-11-04'), { text: '가동 보고 · 08:01Z', short: '가동 보고', tip: '가동 보고 · 2026-11-04T08:01Z · 현재 가동 여부 미확인' });
  assert.equal(opsCard(null, null, null).text, '운영 기록 없음');
  assert.equal(opsCard('retired', '10-31', null, '폐기').text, '폐기 보고 · 10-31');
  assert.equal(opsCard('unbuilt', null, null, '설계만').text, '설계만 보고');
  for (const s of ['running', 'working', 'stopped', 'unbuilt', 'retired']) assert.match(opsWord(s), /보고$/);
  assert.doesNotMatch(opsCard('running', '08:01Z', null).text, /현재/);
});

test('lines meet a pin only when a model portMap row ties them (pinOf), else the card-level contact point', () => {
  const card = (id, x, pins) => ({ id, x, y: 0, w: 272, h: 200, kind: 'node', depth: 0, container: 'root', kids: 0, head: 0, rel: { x, y: 0 }, face: 'unit', contact: 100, pins });
  const a = card('a', 0, {}), b = card('b', 500, { 'r1|in': 140 });
  const e1 = { key: 'a>b', from: 'a', to: 'b', kind: 'flow', notes: [], ids: ['r1'], agg: false };
  const e2 = { key: 'a>b2', from: 'a', to: 'b', kind: 'flow', notes: [], ids: ['r2'], agg: false };
  assert.equal(pinOf(b, e1, 'b'), 140, 'r1 is tied to the pin at 140');
  assert.equal(pinOf(b, e2, 'b'), undefined, 'r2 shares no tie: no pin, whatever its payload\'s name');
  assert.equal(pinOf(b, e1, 'a'), undefined, 'the pin ties the end it names (in), not the other');
  assert.equal(pinOf(b, { ...e1, key: 'sum:a>b' }, 'b'), undefined, 'a summary line never takes a pin');
  const boxes = new Map([['a', a], ['b', b]]), routed = routeEdges(boxes, [e1, e2]);
  const end = r => r.pts.at(-1);
  assert.equal(end(routed.get('a>b')).y, 140, 'the tied line ends at its pin');
  assert.notEqual(end(routed.get('a>b2')).y, 140, 'the other line does not');
  assert.ok(Math.abs(end(routed.get('a>b2')).y - 100) <= 24, 'it meets the card near its contact point');
  // Without pins or a contact, a box keeps its middle as before.
  const plain = { ...card('c', 900, undefined) }; delete plain.contact; delete plain.pins;
  const r3 = routeEdges(new Map([['a', a], ['c', plain]]), [{ key: 'a>c', from: 'a', to: 'c', kind: 'flow', notes: [], ids: ['r9'], agg: false }]);
  assert.equal(end(r3.get('a>c')).y, 100);
});
