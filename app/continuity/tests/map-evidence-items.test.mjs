// Map design v3 slice S2: the part's evidence numbered once (pane-view evidenceItems) — one item per cited span in 구조's reading
// order, the same span one number wherever it is cited, numbers that do not move with the tab, the lens, the view or the internal
// keys, and list values without a line of their own never numbered; the footnote marks, the 근거 분류 words, where a quote stands in
// its record, the way back from 근거, and the 「이 해석이 틀림」 reasons kept in the existing notes record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceItems, footText, footMarks, gradeLine, quotePlace, pushReturn, sameName, RETURN_MAX, ITEM_ORDER, ITEM_TITLE, ROLE_KEY,
  readDisputes, addDispute, disputeTitle, disputeSection, DISPUTE_KEY, DISPUTE_REASONS, DISPUTE_REASON_LABEL } from '../dist/public/client/pane-view.js';

const C = (x) => ({ kind: 'reported', text: '', record: 'R1', quote: 'q', about: null, topic: null, evidence: null, when: null, where: null, before: null, ...x });
const q = (t, from, record = 'R1') => ({ record, quote: t, ...(from !== undefined ? { from, to: from + t.length } : {}) });
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

/** A part with a little of everything, each passage at its own place unless said otherwise. */
function source(over = {}) {
  const rule = C({ text: '하루 상한 5만 원', topic: 'rule', quote: '[보고] 상한', from: 300, to: 308 });
  const unknown = C({ text: '재개 조건 미상', topic: 'unknown', quote: '[모름] 재개', from: 310, to: 317 });
  const status = C({ text: '가동 중', topic: 'status', quote: '[보고] 가동', from: 320, to: 326 });
  const plan = C({ text: '다음에 캐시', topic: 'plan', quote: '[추정] 캐시', from: 330, to: 336 });
  const steps = ['수집', '판정', '집행', '기록', '보고'].map((name, i) => ({ name, quote: q(`단계 ${name}`, 100 + i * 10) }));
  return {
    roleBasis: [q('[파일] 설명', 0)], roleText: '명령을 반복 실행한다',
    type: { label: '종류 · 루프·엔진', quote: q('종류', 10) }, state: { label: '운영 한 줄 · 가동 보고', quote: q('[보고] 상태', 20) },
    relations: [{ id: 'in1', label: '받는 것 · A', quote: q('선 A', 30), dir: 'in' }, { id: 'in2', label: '받는 것 · B', quote: q('선 B', 40), dir: 'in' },
      { id: 'out1', label: '내는 것 · C', quote: q('선 C', 50), dir: 'out' }, { id: 'with1', label: '함께 · 참조 · D', quote: q('선 D', 60), dir: 'with' },
      { id: 'drawn', label: '받는 것 · 사람이 그린 선', quote: null, dir: 'in' }],
    loop: { quote: q('반복 행마다', 90) }, steps, conditions: [{ when: 'LINE_STALE', quote: q('조건', 200) }],
    portMap: [{ port: 'review', step: '판정', direction: 'in', quote: q('포트', 210) }], fileRoles: [{ path: 'engine.py', quote: q('[파일] engine.py', 220) }],
    claims: [plan, status, rule, unknown], rules: [rule],
    ruleQuotes: c => (c === rule ? [{ key: 'anchor:0', label: '적용 위치 · 판정', quote: q('자리', 230) }] : []),
    ...over };
}

test('S2 order: one number per span in 구조\'s reading order — head, 하는 일, the chain (first ports, loop, first steps, outs), 확인 필요, 계약, 동작, 규칙, 연결, 어디에, the rest in topic order', () => {
  const book = evidenceItems(source());
  const by = k => book.thing.get(k)?.n ?? null;
  assert.deepEqual(['type', 'state', 'role:0'].map(by), [1, 2, 3], 'the kind word and the operations line head, then the description');
  assert.deepEqual(['relation:in1', 'relation:in2', 'loop', 'step:0', 'step:1', 'step:2', 'step:3', 'relation:out1'].map(by), [4, 5, 6, 7, 8, 9, 10, 11], 'the chain: 받는 것 → 동작 요약 (four steps) → 내는 것');
  assert.equal(by('claim:3'), 12, '확인 필요 (the unknown claim) after the chain');
  assert.deepEqual(['step:4', 'condition:0', 'portmap:0'].map(by), [13, 14, 15], '동작 past the chain: the fifth step, the condition and port rows');
  assert.deepEqual(['claim:2', 'claim:2|anchor:0'].map(by), [16, 17], 'a rule, then its place');
  assert.deepEqual(['relation:with1', 'file:engine.py'].map(by), [18, 19], '연결, then 어디에');
  assert.deepEqual(['claim:1', 'claim:0'].map(by), [20, 21], 'the rest in topic order: status before plan, whatever the claims\' own order');
  assert.deepEqual(book.items.map(x => x.n), book.items.map((_, i) => i + 1), 'numbers run 1..N without gaps');
  assert.deepEqual(book.groups.map(g => g.section), ['role', 'caution', 'contract', 'behaviour', 'rules', 'links', 'where', 'other']);
  assert.deepEqual(book.groups.find(g => g.section === 'contract').items.map(x => x.n), [4, 5, 11], 'a chain row is filed under 계약, in number order');
  assert.deepEqual(ITEM_ORDER, ['role', 'caution', 'contract', 'behaviour', 'rules', 'links', 'where', 'other']);
  assert.equal(ITEM_TITLE.links, '연결'); assert.equal(ITEM_TITLE.other, '그 밖의 기록된 말');
  assert.equal(book.thing.get('step:4').section, 'behaviour');
});

test('S2 dedup: the same span is one item with one number wherever it is cited, its uses counted; another place is another item', () => {
  const shared = q('[보고] 같은 줄', 500);
  const book = evidenceItems(source({ state: { label: '운영 한 줄', quote: shared }, steps: [{ name: '수집', quote: shared }, { name: '판정', quote: q('[보고] 같은 줄', 600) }] }));
  const a = book.thing.get('state'), b = book.thing.get('step:0'), c = book.thing.get('step:1');
  assert.equal(a, b, 'the operations line and the step quote the same span: one item');
  assert.equal(a.n, 2); assert.deepEqual(a.uses.map(u => u.thing), ['state', 'step:0']);
  assert.notEqual(c.n, a.n, 'the same words at another place are another span');
  // Without a place (an earlier reading), the record and the words (spacing aside) are the span.
  const loose = evidenceItems(source({ roleBasis: [{ record: 'R9', quote: '같은  말' }], type: { label: 't', quote: { record: 'R9', quote: ' 같은 말 ' } } }));
  assert.equal(loose.thing.get('type'), loose.thing.get('role:0'));
  assert.equal(loose.items.length, evidenceItems(source()).items.length - 1);
  // A chain row cited again in 계약 is still one use.
  assert.equal(book.thing.get('relation:in1').uses.length, 1);
});

test('S2 stability: the numbers depend on the reading only — not on internal keys, object identity or anything a tab, lens or view changes', () => {
  const one = evidenceItems(source()), two = evidenceItems(source({ claimRef: c => `other-key:${c.text}` }));
  const spans = b => b.items.map(x => [x.key, x.n]);
  assert.deepEqual(spans(two), spans(one), 'another internal key gives the same numbers');
  assert.deepEqual(spans(evidenceItems(JSON.parse(JSON.stringify({ ...source(), ruleQuotes: undefined })))).slice(0, 15), spans(one).slice(0, 15), 'fresh copies number the same spans the same');
  // The dispute keys are the stable ones (the claim's own key, the description's 'role', the row's kind and identity), never n.
  const refs = evidenceItems(source({ claimRef: c => `R:${c.text}` }));
  assert.equal(refs.thing.get('role:0').uses[0].ref, ROLE_KEY);
  assert.equal(refs.thing.get('step:1').uses[0].ref, 'step:판정');
  assert.equal(refs.thing.get('claim:2').uses[0].ref, 'R:하루 상한 5만 원');
  assert.equal(refs.thing.get('claim:2|anchor:0').uses[0].ref, 'R:하루 상한 5만 원|anchor:0');
  assert.equal(refs.thing.get('relation:in1').uses[0].ref, 'relation:in1');
  // The author's tag rides on the item: a claim's own, else one written in the passage.
  assert.equal(one.thing.get('role:0').grade, 'file');
  assert.equal(one.thing.get('type').grade, null);
  assert.equal(one.claim.get(source().claims[0]), undefined, 'claims are looked up by identity; a copy is not the same claim');
});

test('S2 values without a line of their own are never numbered: a line a person drew, a kind word with no passage, and list values (no item at all)', () => {
  const book = evidenceItems(source({ type: { label: '종류', quote: null } }));
  assert.equal(book.thing.get('relation:drawn'), undefined);
  assert.equal(book.thing.get('type'), undefined);
  assert.deepEqual(book.unquoted.map(u => [u.thing, u.section]), [['type', 'role'], ['relation:drawn', 'contract']]);
  assert.equal(book.thing.get('state').n, 1, 'the next cited thing takes the first number');
  // The builder takes no list values: inputs · outputs · fields · config and kept state have no passage to number.
  const listy = evidenceItems({ ...source(), inputs: ['잔고 입출금'], outputs: ['성적표'], config: ['하루 상한'] });
  assert.deepEqual(listy.items.map(x => x.key), evidenceItems(source()).items.map(x => x.key));
  assert.equal(sameName('`Review` 행', 'review  행'), true); assert.equal(sameName('review', 'reviews'), false);
  const empty = evidenceItems({ roleBasis: [], state: null, type: null, relations: [], loop: null, steps: [], conditions: [], portMap: [], fileRoles: [], claims: [], rules: [] });
  assert.deepEqual([empty.items, empty.groups, empty.unquoted], [[], [], []]);
});

test('S2 marks: 〔보고·7〕, 〔7〕 without a tag, two side by side, more folded to the first with +N', () => {
  assert.equal(footText({ n: 7, grade: 'report' }), '〔보고·7〕');
  assert.equal(footText({ n: 7, grade: null }), '〔7〕');
  const a = { n: 3, grade: 'report' }, b = { n: 4, grade: 'file' }, c = { n: 9, grade: null };
  assert.deepEqual(footMarks([b, a]).map(m => m.text), ['〔보고·3〕', '〔파일·4〕'], 'number order');
  assert.deepEqual(footMarks([a, b, c]).map(m => [m.text, m.item, m.more]), [['〔보고·3 +2〕', a, 2]]);
  assert.deepEqual(footMarks([c, null, undefined, c]).map(m => m.text), ['〔9〕'], 'the same item once; nothing for a missing one');
  assert.deepEqual(footMarks([]), []);
});

test('S2 근거 분류 keeps the author\'s tag apart from any check by the app; a quote\'s place is read from the record only when the words are there', () => {
  assert.equal(gradeLine('file'), '근거 분류: 파일 (작성 세션이 파일을 읽었다고 표시 · 앱 확인 없음)');
  assert.match(gradeLine('report'), /^근거 분류: 보고 \(.+ · 앱 확인 없음\)$/);
  assert.equal(gradeLine(null), '근거 분류: 꼬리표 없음 (작성 세션이 분류를 달지 않음 · 앱 확인 없음)');
  const text = ['# 설계 기록', '', '## 4절 연결', '', '| 보낸 쪽 | 받는 쪽 | 넘기는 것 |', '| --- | --- | --- |', '| 정보 층 | 엔진 | calendar.json |', '', '본문 줄'].join('\n');
  const at = text.indexOf('엔진 | calendar');
  assert.deepEqual(quotePlace(text, { record: 'R', quote: '엔진 | calendar.json', from: at, to: at + 18 }), { heading: '4절 연결', row: '정보 층' });
  assert.deepEqual(quotePlace(text, { record: 'R', quote: '본문 줄' }), { heading: '4절 연결', row: null }, 'no place kept: where the words first stand');
  assert.deepEqual(quotePlace(text, { record: 'R', quote: '없는 말' }), { heading: null, row: null });
  assert.deepEqual(quotePlace(text, { record: 'R', quote: '본문 줄', from: 0, to: 4 }).heading, '4절 연결', 'a stale place: found by the words instead');
  assert.deepEqual(quotePlace('| a |\n| --- |', { record: 'R', quote: '---' }), { heading: null, row: null }, 'a table rule is no row');
});

test('S2 the way back from 근거: the first point is kept while other passages are opened, at most five held', () => {
  let s = pushReturn([], 'first');
  for (let i = 0; i < 9; i++) s = pushReturn(s, `p${i}`);
  assert.equal(s[0], 'first'); assert.equal(s.length, RETURN_MAX);
  assert.deepEqual(pushReturn(['a'], 'b'), ['a', 'b']);
});

test('S2 「이 해석이 틀림」 reasons: four, kept in the same notes record (agentflow.studio.disputes.1) beside the line; an unknown reason reads as none', () => {
  assert.deepEqual(DISPUTE_REASONS.map(r => DISPUTE_REASON_LABEL[r]), ['원문과 다른 뜻으로 해석함', '다른 대상·구간을 근거로 연결함', '시점·판본·조건을 잘못 적용함', '원문 기록 자체가 사실과 다름']);
  const m = memory();
  assert.ok(addDispute(m, 'map', 'part', { claimKey: 'step:판정', at: '2026-11-04T10:00:00.000Z', reason: 'target', text: '다른 행', said: '단계 판정' }));
  assert.deepEqual(readDisputes(m, 'map').part, [{ claimKey: 'step:판정', at: '2026-11-04T10:00:00.000Z', text: '다른 행', said: '단계 판정', reason: 'target' }]);
  m.setItem(DISPUTE_KEY, JSON.stringify({ map: { part: [{ claimKey: 'k', at: '2026-11-04T10:00:00.000Z', reason: 'nonsense' }] } }));
  assert.deepEqual(readDisputes(m, 'map').part, [{ claimKey: 'k', at: '2026-11-04T10:00:00.000Z' }], 'notes kept before S2 (no reason) and unknown reasons read as none');
  assert.match(disputeTitle([{ claimKey: 'k', at: '2026-11-04T10:00:00.000Z', reason: 'meaning', text: '뜻이 다름' }]), /2026-11-04 10:00Z · 원문과 다른 뜻으로 해석함 · 뜻이 다름$/);
  const sec = disputeSection([{ part: '엔진', said: '단계 판정', at: '2026-11-04T10:00:00.000Z', role: false, reason: 'time', text: 'v2 기준' }, { part: '엔진', said: 'x', at: '2026-11-04T10:00:00.000Z', role: false }]);
  assert.equal(sec[2], '- 엔진 · 주장: “단계 판정” · 2026-11-04 10:00Z 표시 · 이유: 시점·판본·조건을 잘못 적용함 · v2 기준');
  assert.equal(sec[3], '- 엔진 · 주장: “x” · 2026-11-04 10:00Z 표시', 'a note without a reason reads as before');
});
