// Signs on the map (spec §5–§7, cycle 4), the client's pure part: rules, gates and withdrawals told from a part's claims (the
// card's tabs), a rule row's explicit blanks, a change row's head (nature by the evidence tag, version, time) and its 이전 | 지금,
// the since-time filter (time spans, the after/before/unknown predicate, its summary, its per-map state), and the failure and
// recovery blanks only at an actor's exit and a store's write ports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isGate, signKind, partSigns, hasSigns, signTabs, ruleSaid, changeNature, changeGuessed, changeHead, changeRow, timeSpan, sinceMatch, sinceCount, sinceSummary,
  readSince, writeSince, cleanSince, failureBlanks, fromContract, gateKind, gateSplit, gateSplitLine, placeName, matchPlaces, rulePlacement, ruleSigns, unplacedCount, ruleView,
  RULE_BLANKS, BEFORE_BLANK, NATURE_UNKNOWN, SINCE_KEY, FAILURE_BLANK, RECOVERY_BLANK } from '../dist/public/client/signs-view.js';

const C = (x) => ({ kind: 'reported', text: '', quote: '', about: null, topic: null, evidence: null, when: null, where: null, before: null, ...x });
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('rules, gates and withdrawals: a rule topic, a plan with 관문 or a condition, a withdrawn topic; nothing else', () => {
  assert.equal(signKind(C({ topic: 'rule', text: '지출 상한은 하루 20 USDT 이하' })), 'rule');
  assert.equal(signKind(C({ topic: 'withdrawn', text: 'J1 60 s', before: 'J1 30 s' })), 'change');
  assert.equal(signKind(C({ topic: 'plan', text: '다음 관문: 소유자 승인' })), 'gate');
  assert.equal(signKind(C({ topic: 'plan', text: '검증되면 실주문으로 넘어간다' })), 'gate');
  assert.equal(signKind(C({ topic: 'plan', text: 'allowed_side가 NONE이 아니고 CALM이면 진입' })), 'gate');
  // A plan without a condition, and '이면서' (not a condition), are not gates; a condition outside a plan is not one either.
  assert.equal(signKind(C({ topic: 'plan', text: '다음 묶음에서 정산기를 만든다' })), null);
  assert.equal(isGate(C({ topic: 'plan', text: '감시 루프이면서 기록기' })), false);
  assert.equal(signKind(C({ topic: 'status', text: '검증되면 넘어간다고 보고됐다' })), null);
  // Without a topic, the words decide as claimTopic does (a bound reads as a rule).
  assert.equal(signKind(C({ kind: 'reported', text: '주문 금액은 10 USDT 이하여야 한다' })), 'rule');
});

test('a part\'s signs keep the claims\' order; the tabs read 규칙 N · 관문 M · 변경 K, only those with a count', () => {
  const claims = [C({ topic: 'withdrawn', text: 'a' }), C({ topic: 'rule', text: 'r1' }), C({ topic: 'status', text: 's' }), C({ topic: 'rule', text: 'r2' }), C({ topic: 'plan', text: '통과하면 관문 2' })];
  const sg = partSigns(claims);
  assert.deepEqual(sg.rules.map(c => c.text), ['r1', 'r2']);
  assert.deepEqual(sg.gates.map(c => c.text), ['통과하면 관문 2']);
  assert.deepEqual(sg.changes.map(c => c.text), ['a']);
  assert.equal(hasSigns(sg), true);
  assert.deepEqual(signTabs(sg).map(t => t.text), ['규칙 2', '관문 1', '변경 1']);
  assert.deepEqual(signTabs(partSigns([C({ topic: 'withdrawn', text: 'x' })])).map(t => t.text), ['변경 1']);
  assert.equal(hasSigns(partSigns([C({ topic: 'status', text: 's' })])), false);
  assert.deepEqual(signTabs(partSigns([])), []);
});

test('a rule row: its time, place and tag as written, blanks said; the three contract fields are explicit blanks', () => {
  assert.deepEqual(ruleSaid(C({ when: '11-02 23:04Z', where: 'policy.md §3', quote: '[파일] 상한 20' })), { when: '11-02 23:04Z', where: 'policy.md §3', evidence: '파일' });
  assert.deepEqual(ruleSaid(C({})), { when: '시각 미기재', where: '자리 미기재', evidence: null });
  assert.deepEqual(RULE_BLANKS, { anchors: '적용 위치 미해결', design: '설계 대응 미상', check: '확인 검사 미상', enforce: '보장 위치 미확인', scope: '범위 미정', nowhere: '자리 없음' });
});

test('a change: its nature by the evidence tag (provisional), its version and time in the head, 이전 | 지금', () => {
  assert.equal(changeNature(C({ quote: '[파일 engine.py] J1 60 s' })), 'design');
  assert.equal(changeNature(C({ quote: '[실행] 재시작 후 60 s' })), 'implementation');
  assert.equal(changeNature(C({ quote: '[보고] 감독 세션이 정정' })), 'report');
  assert.equal(changeNature(C({ evidence: 'run', quote: '[보고]' })), 'implementation'); // the reading's own grade first
  assert.equal(changeNature(C({ quote: '무표시' })), null);
  assert.equal(changeHead(C({ quote: '[파일]', about: 'v3', when: '11-02 23:04Z' })), '설계 변경 · 판본 v3 · 11-02 23:04Z');
  assert.equal(changeHead(C({ quote: '[보고]', when: '11-03 08:49Z' })), '보고 정정 · 11-03 08:49Z');
  // A time that is also the 'about' is read once.
  assert.equal(changeHead(C({ quote: '[실행]', about: '11-03', when: '11-03' })), '구현 변화 · 11-03');
  assert.equal(changeHead(C({})), `${NATURE_UNKNOWN} · 판본·시각 미상`);
  assert.deepEqual(changeRow(C({ text: 'J1 60 s', before: 'J1 30 s', quote: '[파일]' })), { head: '설계 변경 · 판본·시각 미상', before: 'J1 30 s', now: 'J1 60 s', beforeSaid: true, guessed: true });
  assert.deepEqual(changeRow(C({ text: '폐기', before: '  ' })), { head: `${NATURE_UNKNOWN} · 판본·시각 미상`, before: BEFORE_BLANK, now: '폐기', beforeSaid: false, guessed: false });
});

test('time spans: a minute, a second, a whole day; a clock time on the basis day; offsets; the basis year for a date alone', () => {
  const ref = '2026-11-03T09:01:03Z', at = (s) => Date.parse(s);
  assert.deepEqual(timeSpan('2026-11-03T08:49Z'), { from: at('2026-11-03T08:49:00Z'), to: at('2026-11-03T08:50:00Z') });
  assert.deepEqual(timeSpan(ref), { from: at(ref), to: at(ref) + 1000 });
  assert.deepEqual(timeSpan('11-02 23:04Z', ref), { from: at('2026-11-02T23:04:00Z'), to: at('2026-11-02T23:05:00Z') });
  assert.deepEqual(timeSpan('11-02', ref), { from: at('2026-11-02T00:00:00Z'), to: at('2026-11-03T00:00:00Z') });
  assert.deepEqual(timeSpan('09:30Z', ref), { from: at('2026-11-03T09:30:00Z'), to: at('2026-11-03T09:31:00Z') });
  assert.deepEqual(timeSpan('2026-11-03 18:00+09:00'), { from: at('2026-11-03T09:00:00Z'), to: at('2026-11-03T09:01:00Z') });
  assert.equal(timeSpan('09:30Z'), null); // a clock time with no day to read it on
  for (const bad of [null, '', '618df374', 'v3', '13-40', '어제']) assert.equal(timeSpan(bad, ref), null, String(bad));
});

test('since: after only when the whole span is later; at or before; unknown without a time or across it', () => {
  const ref = '2026-11-03T09:01:03Z', since = timeSpan(ref, ref);
  assert.equal(sinceMatch('11-03 09:30Z', since, ref), 'after');
  assert.equal(sinceMatch('11-04', since, ref), 'after');
  assert.equal(sinceMatch('11-02 23:04Z', since, ref), 'before');
  assert.equal(sinceMatch(ref, since, ref), 'before'); // the basis itself is not after it
  assert.equal(sinceMatch('11-03', since, ref), 'unknown'); // that whole day spans the time
  assert.equal(sinceMatch(null, since, ref), 'unknown');
  assert.equal(sinceMatch('618df374', since, ref), 'unknown');
  // A claim's time is its own when, else its about when that reads as a time.
  assert.deepEqual(sinceCount([C({ when: '11-03 10:00Z' }), C({ about: '11-04 00:00Z' }), C({ when: '11-01' }), C({})], since, ref), { after: 2, unknown: 1 });
  assert.equal(sinceSummary(2, 1), '조건에 맞는 기록 2 · 작성 시각 미상 1');
  assert.equal(sinceSummary(0, 0), '조건에 맞는 기록 없음');
});

test('the filter\'s state per map outlives a reload; a malformed value reads as off; off with no time leaves no record', () => {
  const s = memory();
  assert.deepEqual(readSince(s, 'a'), { on: false, at: null });
  assert.equal(writeSince(s, 'a', { on: true, at: null }), true);
  assert.equal(writeSince(s, 'b', { on: false, at: ' 11-03 09:00Z ' }), true);
  assert.deepEqual(readSince(s, 'a'), { on: true, at: null });
  assert.deepEqual(readSince(s, 'b'), { on: false, at: '11-03 09:00Z' });
  writeSince(s, 'a', { on: false, at: null });
  assert.deepEqual(Object.keys(JSON.parse(s.getItem(SINCE_KEY))), ['b']);
  s.setItem(SINCE_KEY, '{"a":{"on":"yes","at":5},"__proto__":{"on":true}}');
  assert.deepEqual(readSince(s, 'a'), { on: false, at: null });
  assert.deepEqual(readSince(s, 'constructor'), { on: false, at: null });
  s.setItem(SINCE_KEY, 'not json'); assert.deepEqual(readSince(s, 'a'), { on: false, at: null });
  assert.deepEqual(cleanSince([1]), { on: false, at: null });
  assert.equal(writeSince({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, 'a', { on: true, at: null }), false);
});

test('failure and recovery blanks: only at an actor\'s exit and a store\'s write ports, each when nothing speaks of it', () => {
  assert.deepEqual(failureBlanks('actor', ['거래소에 주문을 낸다']), { at: 'exit', failure: true, recovery: true });
  assert.deepEqual(failureBlanks('store', ['행을 보관한다']), { at: 'write', failure: true, recovery: true });
  assert.deepEqual(failureBlanks('actor', ['주문 실패 시 3회 재시도']), { at: 'exit', failure: false, recovery: true });
  assert.deepEqual(failureBlanks('store', [null, '다음 세션 시작에 재개']), { at: 'write', failure: true, recovery: false });
  assert.equal(failureBlanks('actor', ['실패하면 멈추고', '수동으로 복구']), null);
  for (const t of ['collector', 'compute', 'ai', 'loop', 'timer', 'person', 'session', 'external', null, undefined]) assert.equal(failureBlanks(t, []), null, String(t));
  assert.equal(FAILURE_BLANK, '실패 대응 미제공'); assert.equal(RECOVERY_BLANK, '복구 설명 미제공');
});

// map-reading.10: every claim of such a reading carries the contract's keys (null or [] when unsaid).
const T = (x) => C({ scope: null, scopeName: null, anchors: [], enforcedBy: [], withdrawalKind: null, gate: null, ...x });
const Q = (quote) => ({ record: 'P1', quote, from: 0, to: quote.length });

test('contract first: a .10 plan is a gate only when its gate is said (run/dev); the words decide only for an earlier reading (추정)', () => {
  assert.equal(fromContract(T({})), true); assert.equal(fromContract(C({})), false);
  assert.equal(signKind(T({ topic: 'plan', text: '소유자 승인 후 실주문', gate: 'dev' })), 'gate');
  assert.equal(signKind(T({ topic: 'plan', text: 'allowed_side ≠ NONE', gate: 'run' })), 'gate');
  // The same words that made an earlier reading's plan a gate do not, once the contract says gate null.
  assert.equal(signKind(T({ topic: 'plan', text: '다음 관문: 검증되면 넘어간다' })), null);
  assert.equal(signKind(C({ topic: 'plan', text: '다음 관문: 검증되면 넘어간다' })), 'gate');
  assert.deepEqual(gateKind(T({ topic: 'plan', text: 'x', gate: 'run' })), { kind: 'run', guessed: false });
  assert.deepEqual(gateKind(C({ topic: 'plan', text: '검증되면' })), { kind: null, guessed: true });
  const gates = [T({ topic: 'plan', text: 'a', gate: 'run' }), T({ topic: 'plan', text: 'b', gate: 'dev' }), T({ topic: 'plan', text: 'c', gate: 'run' }), C({ topic: 'plan', text: '관문 d' })];
  const sp = gateSplit(gates);
  assert.deepEqual([sp.run.map(g => g.text), sp.dev.map(g => g.text), sp.guessed.map(g => g.text)], [['a', 'c'], ['b'], ['관문 d']]);
  assert.equal(gateSplitLine(sp), '실행 2 · 개발 1 · 종류 미상 1 (추정)');
  assert.equal(gateSplitLine(gateSplit(gates.slice(0, 2))), '실행 1 · 개발 1');
  assert.deepEqual(signTabs(partSigns(gates)).map(t => t.text), ['관문 4']);
});

test('contract first: a withdrawal\'s nature is its withdrawalKind; the evidence tag only when it is null (추정)', () => {
  assert.equal(changeNature(T({ withdrawalKind: 'report', quote: '[파일] engine.py' })), 'report');
  assert.equal(changeGuessed(T({ withdrawalKind: 'report', quote: '[파일]' })), false);
  assert.equal(changeNature(T({ withdrawalKind: null, quote: '[실행] 재시작' })), 'implementation');
  assert.equal(changeGuessed(T({ withdrawalKind: null, quote: '[실행] 재시작' })), true);
  assert.equal(changeHead(T({ withdrawalKind: 'implementation', about: 'v4', when: '11-03 09:30Z', quote: '[보고]' })), '구현 변화 · 판본 v4 · 11-03 09:30Z');
  assert.equal(changeRow(T({ topic: 'withdrawn', withdrawalKind: 'design', text: 'J1 60 s', before: 'J1 30 s' })).guessed, false);
});

const places = { steps: ['행 읽기', '판단', '주문 요청'], inputs: ['review 행', '정책 기동'], outputs: ['판단 행', '주문 요청'], fields: ['valid_until', 'rung', 'side'] };

test('place names match by name only: quotes, spacing, case and one kind word aside; nothing else', () => {
  assert.equal(placeName('  ‘판단’ 단계 '), '판단');
  assert.equal(placeName('필드 valid_until'), 'valid_until');
  assert.equal(placeName('Step  Review'), 'review');
  assert.equal(placeName('단계'), '단계'); // a kind word alone stays itself
  assert.deepEqual(matchPlaces('판단', places), [{ kind: 'step', name: '판단' }]);
  assert.deepEqual(matchPlaces('“판단 결과”', places), []); // a longer name is another name, never a near match
  assert.deepEqual(matchPlaces('주문 요청', places), [{ kind: 'step', name: '주문 요청' }, { kind: 'out', name: '주문 요청' }]);
  assert.deepEqual(matchPlaces('주문 요청', places, ['in', 'out']), [{ kind: 'out', name: '주문 요청' }]);
  assert.deepEqual(matchPlaces('engine/rung.py:120 조건 행', places), []);
  assert.deepEqual(matchPlaces('', places), []);
});

test('a rule\'s place: a named scope found among its kind, anchors among all places; a part rule at the boundary, a project rule at the head', () => {
  const step = rulePlacement(T({ topic: 'rule', scope: 'step', scopeName: '판단', anchors: [{ kind: 'stated', text: 'engine.py 조건 행', quote: Q('x') }] }), places);
  assert.deepEqual(step.places, [{ kind: 'step', name: '판단' }]);
  assert.equal(step.scopeFound, true); assert.equal(step.head, null); assert.equal(step.unplaced, false);
  assert.deepEqual(step.anchors.map(a => a.places), [[]]); // that anchor names no place: 자리 없음
  // A port scope looks at ports only (the step of the same name is not its place); a field scope at the fields.
  assert.deepEqual(rulePlacement(T({ scope: 'port', scopeName: '주문 요청' }), places).places, [{ kind: 'out', name: '주문 요청' }]);
  // Its anchor of the same name stays with the port too (a port rule never lands on the step called 주문 요청).
  assert.deepEqual(rulePlacement(T({ scope: 'port', scopeName: '주문 요청', anchors: [{ kind: 'stated', text: '주문 요청', quote: Q('q') }] }), places).places, [{ kind: 'out', name: '주문 요청' }]);
  assert.deepEqual(rulePlacement(T({ scope: 'field', scopeName: '‘valid_until’' }), places).places, [{ kind: 'field', name: 'valid_until' }]);
  // Not found: drawn nowhere precise, never at a near name.
  const lost = rulePlacement(T({ scope: 'step', scopeName: 'S04 review 읽기' }), places);
  assert.deepEqual([lost.places, lost.scopeFound, lost.head, lost.unplaced], [[], false, 'unplaced', true]);
  // A part rule: the boundary; an anchor naming a field adds that place too (and then it is placed).
  const part = rulePlacement(T({ scope: 'part', anchors: [{ kind: 'inferred', text: 'rung 필드', quote: Q('y') }] }), places);
  assert.deepEqual([part.places, part.head, part.unplaced], [[{ kind: 'field', name: 'rung' }], 'boundary', false]);
  assert.deepEqual([rulePlacement(T({ scope: 'part' }), places).head, rulePlacement(T({ scope: 'part' }), places).unplaced], ['boundary', true]);
  assert.deepEqual([rulePlacement(T({ scope: 'project' }), places).head, rulePlacement(T({ scope: 'project' }), places).unplaced], ['project', false]);
  assert.deepEqual([rulePlacement(T({ scope: null }), places).head, rulePlacement(T({ scope: null }), places).unplaced], ['unplaced', true]);
  // An earlier reading's rule: part-wide as before, placed nowhere precise.
  const old = rulePlacement(C({ topic: 'rule' }), places);
  assert.deepEqual([old.legacy, old.head, old.unplaced], [true, 'boundary', true]);
  const rules = [T({ text: 'a', scope: 'step', scopeName: '판단' }), T({ text: 'b', scope: 'part' }), T({ text: 'c', scope: 'project' }), T({ text: 'd', scope: 'field', scopeName: 'rung' }), T({ text: 'e', scope: 'step', scopeName: '판단' }), T({ text: 'f', scope: 'step', scopeName: '없는 단계' })];
  const sg = ruleSigns(rules, places);
  assert.deepEqual([...sg.at].map(([k, l]) => [k, l.map(r => r.text)]), [['step|판단', ['a', 'e']], ['field|rung', ['d']]]);
  assert.deepEqual([sg.boundary, sg.project, sg.unplaced].map(l => l.map(r => r.text)), [['b'], ['c'], ['f']]);
  assert.equal(unplacedCount(rules, places), 2); // b (part, no anchor) and f (named nowhere); the project rule is placed at the head
});

test('a rule row: scope words, anchors with 명시/해석 and their quotes or 자리 없음, devices and the blanks they leave', () => {
  const v = ruleView(T({ topic: 'rule', scope: 'step', scopeName: '판단', anchors: [{ kind: 'stated', text: '판단', quote: Q('조건 행') }, { kind: 'inferred', text: 'S09', quote: Q('S09') }],
    enforcedBy: [{ kind: 'code', text: 'LINE_STALE에서 거절', quote: Q('LINE_STALE') }] }), places);
  assert.deepEqual(v.scope, { text: '범위 · 단계 ‘판단’', blank: false, hint: '이 부분의 단계 ‘판단’에 미치는 규칙' });
  assert.deepEqual(v.anchors.map(a => [a.text, a.label, a.nowhere, a.quote.quote]), [['판단', '명시', false, '조건 행'], ['S09', '해석', true, 'S09']]);
  assert.equal(v.anchorsBlank, null);
  assert.deepEqual(v.enforce.map(e => e.line), ['코드 · LINE_STALE에서 거절']);
  assert.deepEqual([v.enforceBlank, v.design, v.check], [null, null, '확인 검사 미상']);
  const scopes = [['part', null, '범위 · 부분 전체'], ['project', null, '범위 · 프로젝트 전체'], ['port', '정책 기동', '범위 · 포트 ‘정책 기동’'], ['field', 'rung', '범위 · 필드 ‘rung’'], ['step', '없음', '범위 · 단계 ‘없음’ · 자리 없음'], [null, null, '범위 미정']];
  for (const [scope, scopeName, text] of scopes) assert.equal(ruleView(T({ scope, scopeName }), places).scope.text, text, String(scope));
  // No anchor, no device: the explicit blanks.
  const blank = ruleView(T({ scope: 'part' }), places);
  assert.deepEqual([blank.anchorsBlank, blank.enforceBlank, blank.design, blank.check], ['적용 위치 미해결', '보장 위치 미확인', '설계 대응 미상', '확인 검사 미상']);
  // A gate covers 확인 검사, 기록상 미설계 answers 설계 대응; 장치 미상 answers neither.
  const gate = ruleView(T({ scope: 'part', enforcedBy: [{ kind: 'gate', text: '운영 관문 2', quote: Q('g') }, { kind: 'person', text: '소유자', quote: Q('p') }] }), places);
  assert.deepEqual([gate.enforce.map(e => e.line), gate.design, gate.check], [['관문 · 운영 관문 2', '사람 · 소유자'], '설계 대응 미상', null]);
  const none = ruleView(T({ scope: 'part', enforcedBy: [{ kind: 'none', text: '설계 없음', quote: Q('n') }] }), places);
  assert.deepEqual([none.enforce.map(e => e.line), none.design, none.check], [['기록상 미설계'], null, '확인 검사 미상']);
  const unknown = ruleView(T({ scope: 'part', enforcedBy: [{ kind: 'unknown', text: '장치 미상', quote: null }] }), places);
  assert.deepEqual([unknown.enforce.map(e => [e.line, e.quote]), unknown.design, unknown.check], [[['장치 미상', null]], '설계 대응 미상', '확인 검사 미상']);
  // An earlier reading's rule keeps its old part-wide line and the three blanks.
  const old = ruleView(C({ topic: 'rule' }), places, '정책 엔진');
  assert.deepEqual([old.legacy, old.scope.text, old.anchorsBlank, old.enforceBlank, old.design, old.check], [true, '범위 · ‘정책 엔진’ 전체 · 세부 접점 미정', '적용 위치 미해결', null, '설계 대응 미상', '확인 검사 미상']);
});
/* ---------- cycle 6: the map title's 전체 규칙 N · 배치 미정 K and its list (spec 5.1) ---------- */
import { projectRuleList, projectRuleEntry, RULE_ROW_LABEL } from '../dist/public/client/signs-view.js';

test('projectRuleList: project rules and unplaced rules counted across parts, each part\'s head and unplaced rules listed by part in the map\'s order', () => {
  const places = { steps: ['판단'], inputs: ['주문 요청'], outputs: [], fields: ['valid_until'] };
  const R = x => ({ scope: null, scopeName: null, anchors: [], enforcedBy: [], ...x });
  const parts = [
    { id: 'A', name: '엔진', places, rules: [R({ text: 'p', scope: 'project' }), R({ text: 's', scope: 'step', scopeName: '판단' }), R({ text: 'w', scope: 'part' }), R({ text: 'n', scope: 'step', scopeName: '없는 단계' })] },
    { id: 'B', name: '보관소', places, rules: [R({ text: 'f', scope: 'field', scopeName: 'valid_until' })] },
    { id: 'C', name: '집행기', places, rules: [R({ text: 'a', scope: 'part', anchors: [{ kind: 'inferred', text: '주문 요청', quote: { record: 'r', quote: 'q' } }] }), { text: 'legacy' }] }];
  const l = projectRuleList(parts);
  // Unplaced: the part rule with no place, the step named nowhere, and the earlier reading's part-wide rule; the anchored part rule is placed.
  assert.deepEqual([l.project, l.unplaced], [1, 3]);
  assert.deepEqual(l.groups.map(g => [g.part, g.name, g.rows.map(r => `${r.claim.text}:${r.kind}`)]), [
    ['A', '엔진', ['p:project', 'w:part', 'n:unplaced']],
    ['C', '집행기', ['a:part', 'legacy:part']]]);
  assert.equal(projectRuleEntry(l), '전체 규칙 1 · 배치 미정 3');
  assert.equal(projectRuleEntry({ project: 2, unplaced: 0 }), '전체 규칙 2');
  assert.deepEqual(RULE_ROW_LABEL, { project: '프로젝트 전체', part: '부분 전체', unplaced: '배치 미정' });
  assert.deepEqual(projectRuleList([]), { project: 0, unplaced: 0, groups: [] });
});
