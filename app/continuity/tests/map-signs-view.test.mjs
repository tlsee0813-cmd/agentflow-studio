// Signs on the map (spec §5–§7, cycle 4), the client's pure part: rules, gates and withdrawals told from a part's claims (the
// card's tabs), a rule row's explicit blanks, a change row's head (nature by the evidence tag, version, time) and its 이전 | 지금,
// the since-time filter (time spans, the after/before/unknown predicate, its summary, its per-map state), and the failure and
// recovery blanks only at an actor's exit and a store's write ports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isGate, signKind, partSigns, hasSigns, signTabs, ruleSaid, changeNature, changeHead, changeRow, timeSpan, sinceMatch, sinceCount, sinceSummary,
  readSince, writeSince, cleanSince, failureBlanks, RULE_BLANKS, BEFORE_BLANK, NATURE_UNKNOWN, SINCE_KEY, FAILURE_BLANK, RECOVERY_BLANK } from '../dist/public/client/signs-view.js';

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
  assert.deepEqual(RULE_BLANKS, { anchors: '적용 위치 미해결', design: '설계 대응 미상', check: '확인 검사 미상' });
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
  assert.deepEqual(changeRow(C({ text: 'J1 60 s', before: 'J1 30 s', quote: '[파일]' })), { head: '설계 변경 · 판본·시각 미상', before: 'J1 30 s', now: 'J1 60 s', beforeSaid: true });
  assert.deepEqual(changeRow(C({ text: '폐기', before: '  ' })), { head: `${NATURE_UNKNOWN} · 판본·시각 미상`, before: BEFORE_BLANK, now: '폐기', beforeSaid: false });
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
