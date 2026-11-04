// The reading pane after cycle 5 (map spec 11.5, PART_READING 9절), its pure part: claims grouped by the record they quote (one
// rail per record, newest record first, topic order inside), the history in time order with what is still current and the fold
// beyond eight, the source rows (counts and the authors' evidence tags), and the person's 「이 해석이 틀림」 notes (kept apart
// from the project, per map and part, never touching a claim) with the handover's section.
import test from 'node:test';
import assert from 'node:assert/strict';
import { recordRails, historyEntries, foldHistory, sourceRows, shortReading, readDisputes, addDispute, dropDispute, disputesOf, disputeTitle, noteTime,
  disputeSection, withDisputes, structureKeep, DISPUTE_KEY, DISPUTE_HEAD, HANDOVER_END, ROLE_KEY, HISTORY_SHOWN } from '../dist/public/client/pane-view.js';

const C = (x) => ({ kind: 'reported', text: '', record: 'R1', quote: 'q', about: null, topic: null, evidence: null, when: null, where: null, before: null, ...x });
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const AT = { R1: '2026-11-03T09:00:00.000Z', R2: '2026-11-04T01:00:00.000Z', R3: null };

test('claims by record: newest record first, a record without a time last, each record in topic order keeping the claims\' order', () => {
  const claims = [
    C({ text: 'a-plan', record: 'R1', topic: 'plan' }), C({ text: 'b-status', record: 'R2', topic: 'status' }), C({ text: 'c-rule', record: 'R1', topic: 'rule' }),
    C({ text: 'd-status', record: 'R1', topic: 'status' }), C({ text: 'e', record: 'R3', topic: 'how' }), C({ text: 'f-status', record: 'R1', topic: 'status' })];
  const rails = recordRails(claims, id => AT[id] ?? null);
  assert.deepEqual(rails.map(r => r.record), ['R2', 'R1', 'R3']);
  assert.deepEqual(rails[1].claims.map(c => c.text), ['d-status', 'f-status', 'c-rule', 'a-plan'], 'status → rule → plan; the two status lines keep their order');
  assert.deepEqual(rails[1].topics.map(t => [t.topic, t.list.length]), [['status', 2], ['rule', 1], ['plan', 1]]);
  assert.equal(rails[2].at, null);
  // Every claim is in exactly one rail, its own record's: nothing moves to a neighbour, nothing reads without a record.
  assert.equal(rails.reduce((n, r) => n + r.claims.length, 0), claims.length);
  for (const r of rails) assert.ok(r.claims.every(c => c.record === r.record));
  // Equal times keep the order the records first came in; a topic the reading did not give is read from the kind.
  const tie = recordRails([C({ record: 'X' }), C({ record: 'Y' }), C({ record: 'X', kind: 'open', text: '모름' })], () => '2026-11-01T00:00:00Z');
  assert.deepEqual(tie.map(r => r.record), ['X', 'Y']);
  assert.deepEqual(tie[0].topics.map(t => t.topic), ['status', 'unknown']);
});

test('history: oldest reading first, its description before its claims, withdrawals with before, what is still current', () => {
  const history = [
    { reading: 'MR1', at: '2026-11-03T09:05:00Z', role: '심사 행을 읽어 판단한다', basis: [{ record: 'R1', quote: '심사' }],
      claims: [C({ text: 'J1 30 s', when: '11-02', evidence: 'report' }), C({ text: '돌고 있음', topic: 'status', record: 'R1', from: 3, to: 7 })] },
    { reading: 'MR2', at: '2026-11-04T01:10:00Z', role: null, basis: [],
      claims: [C({ text: 'J1 60 s', topic: 'withdrawn', before: 'J1 30 s', where: 'engine/config.py', record: 'R2' }), C({ text: '돌고 있음', topic: 'status', record: 'R2' })] }];
  const e = historyEntries(history, new Set(['MR1:1', 'MR2:0']), '심사 행을 읽어 판단한다');
  assert.deepEqual(e.map(x => x.key), ['MR1:role', 'MR1:0', 'MR1:1', 'MR2:0', 'MR2:1']);
  assert.deepEqual(e.map(x => x.current), [true, false, true, true, false]);
  assert.equal(e[0].what, 'role'); assert.deepEqual(e[0].quote, { record: 'R1', quote: '심사' });
  assert.equal(e[3].before, 'J1 30 s'); assert.equal(e[3].where, 'engine/config.py'); assert.equal(e[3].topic, 'withdrawn');
  assert.equal(e[1].before, null, 'before reads only on a withdrawal');
  assert.equal(e[1].when, '11-02'); assert.equal(e[1].evidence, 'report');
  assert.deepEqual(e[2].quote, { record: 'R1', quote: 'q', from: 3, to: 7 });
  // Out-of-order times are read in time order; equal times keep the readings' order.
  const swapped = historyEntries([{ ...history[1], at: '2026-11-01T00:00:00Z' }, history[0]], new Set(), null);
  assert.deepEqual(swapped.map(x => x.reading), ['MR2', 'MR2', 'MR1', 'MR1', 'MR1']);
  const tie = historyEntries([{ ...history[1], at: history[0].at }, history[0]], new Set(), null);
  assert.deepEqual(tie.map(x => x.reading), ['MR2', 'MR2', 'MR1', 'MR1', 'MR1']);
});

test('history folds beyond eight: the newest eight read, the earlier ones counted until unfolded', () => {
  const list = Array.from({ length: 11 }, (_, i) => i);
  assert.equal(HISTORY_SHOWN, 8);
  assert.deepEqual(foldHistory(list, false), { shown: [3, 4, 5, 6, 7, 8, 9, 10], hidden: 3 });
  assert.deepEqual(foldHistory(list, true), { shown: list, hidden: 0 });
  assert.deepEqual(foldHistory(list.slice(0, 8), false), { shown: list.slice(0, 8), hidden: 0 });
  assert.equal(shortReading('MR1'), 'MR1');
  assert.equal(shortReading('MR_0123456789abcdef'), 'MR_01234567…');
});

test('source rows: every record the reading rests on, newest first, with counts, the description, and the authors\' tags in order', () => {
  const current = [C({ record: 'R2', evidence: 'run' }), C({ record: 'R1', evidence: 'file' })];
  const history = [
    { reading: 'MR1', at: 'a', role: null, basis: [], claims: [C({ record: 'R1', evidence: 'report' }), C({ record: 'R1', evidence: 'file' }), C({ record: 'R1', quote: '[추정] 아마' }), C({ record: 'R3' })] },
    { reading: 'MR2', at: 'b', role: null, basis: [], claims: [C({ record: 'R2', evidence: 'run' }), C({ record: 'R2', evidence: 'unknown' })] }];
  const rows = sourceRows(current, history, [{ record: 'R4', quote: 'x' }, { record: 'R1', quote: 'y' }], id => ({ ...AT, R4: '2026-11-02T00:00:00Z' })[id] ?? null);
  assert.deepEqual(rows.map(r => r.record), ['R2', 'R1', 'R4', 'R3']);
  const [r2, r1, r4, r3] = rows;
  assert.deepEqual([r2.current, r2.said, r2.grades], [1, 2, ['run', 'unknown']]);
  // A tag read from the quote (claimEvidence) counts as the author's; an untagged claim is counted apart, never given a grade.
  assert.deepEqual([r1.current, r1.said, r1.grades, r1.untagged, r1.role], [1, 3, ['file', 'report', 'guess'], 0, true]);
  assert.deepEqual([r4.current, r4.said, r4.grades, r4.role], [0, 0, [], true]);
  assert.deepEqual([r3.current, r3.said, r3.untagged], [0, 1, 1]);
});

test('dispute notes: appended per map and part, read back after a reload, taken back per claim, never well-formed junk', () => {
  const s = memory();
  assert.deepEqual(readDisputes(s, 'E1'), {});
  assert.ok(addDispute(s, 'E1', 'A_engine', { claimKey: 'MR1:2', at: '2026-11-04T05:00:00.000Z', said: '하루 손실 5% 넘으면 멈춘다' }));
  assert.ok(addDispute(s, 'E1', 'A_engine', { claimKey: 'MR1:2', at: '2026-11-04T05:01:00.000Z', text: '  멈추지 않고 경보만 낸다 ', said: '하루 손실 5% 넘으면 멈춘다' }));
  assert.ok(addDispute(s, 'E1', 'A_engine', { claimKey: ROLE_KEY, at: '2026-11-04T05:02:00.000Z', said: '판단한다' }));
  assert.ok(addDispute(s, 'E2', 'A_engine', { claimKey: 'MR9:0', at: '2026-11-04T05:03:00.000Z' }));
  // A fresh read (as after a reload) sees the same notes; another map's notes are its own.
  const all = readDisputes(s, 'E1');
  assert.deepEqual(disputesOf(all, 'A_engine', 'MR1:2').map(n => n.text ?? null), [null, '멈추지 않고 경보만 낸다']);
  assert.equal(disputesOf(all, 'A_engine', ROLE_KEY).length, 1);
  assert.deepEqual(Object.keys(readDisputes(s, 'E2')), ['A_engine']);
  assert.ok(JSON.parse(s.getItem(DISPUTE_KEY)).E1, 'kept under its own key, apart from the project');
  // Junk is refused or dropped on read; a refused write changes nothing.
  assert.equal(addDispute(s, 'E1', 'A_engine', { claimKey: '', at: 'x' }), false);
  assert.equal(addDispute(s, 'E1', 'A_engine', { claimKey: 'k', at: '2026', text: 'x'.repeat(301) }), true, 'an over-long reason is left out, the mark stays');
  assert.equal(disputesOf(readDisputes(s, 'E1'), 'A_engine', 'k')[0].text, undefined);
  s.setItem(DISPUTE_KEY, JSON.stringify({ E3: { P: [{ claimKey: 'a', at: 't' }, { nope: 1 }, 'x'], Q: 'bad' }, E4: [1] }));
  assert.deepEqual(readDisputes(s, 'E3'), { P: [{ claimKey: 'a', at: 't' }] });
  assert.deepEqual(readDisputes(s, 'E4'), {});
  s.setItem(DISPUTE_KEY, '{not json');
  assert.deepEqual(readDisputes(s, 'E1'), {});
  // Taking back removes only that claim's notes; a part with none left goes.
  const t = memory();
  addDispute(t, 'E1', 'P', { claimKey: 'a', at: '2026-11-04T01:00:00Z' }); addDispute(t, 'E1', 'P', { claimKey: 'b', at: '2026-11-04T02:00:00Z' });
  assert.ok(dropDispute(t, 'E1', 'P', 'a'));
  assert.deepEqual(readDisputes(t, 'E1').P.map(n => n.claimKey), ['b']);
  dropDispute(t, 'E1', 'P', 'b');
  assert.deepEqual(readDisputes(t, 'E1'), {});
  // A storage that refuses writes is only a lost convenience.
  assert.equal(addDispute({ getItem: () => null, setItem: () => { throw new Error('full'); } }, 'E1', 'P', { claimKey: 'a', at: 't' }), false);
});

test('dispute chip title and the handover section: each time and reason; the section goes before the document\'s end line', () => {
  assert.equal(noteTime('2026-11-04T05:01:22.000Z'), '2026-11-04 05:01Z');
  assert.equal(disputeTitle([{ claimKey: 'a', at: '2026-11-04T05:00:00Z' }, { claimKey: 'a', at: '2026-11-04T05:01:00Z', text: '경보만' }]),
    '사람이 이 해석을 틀렸다고 표시함 · 원문과 주장은 그대로\n2026-11-04 05:00Z\n2026-11-04 05:01Z · 경보만');
  assert.deepEqual(disputeSection([]), []);
  const sec = disputeSection([{ part: '엔진', said: '하루 손실 5% 넘으면 멈춘다', at: '2026-11-04T05:01:00Z', text: '경보만 낸다', role: false },
    { part: '엔진', said: null, at: '2026-11-04T05:02:00Z', role: true }]);
  assert.equal(sec[0], DISPUTE_HEAD);
  assert.equal(sec[2], '- 엔진 · 주장: “하루 손실 5% 넘으면 멈춘다” · 2026-11-04 05:01Z 표시 · 이유: 경보만 낸다');
  assert.equal(sec[3], '- 엔진 · 설명: (지금 읽기에 없는 해석) · 2026-11-04 05:02Z 표시');
  const doc = ['# 인수인계', '본문', '', `${HANDOVER_END} · AF-1 ────────`].join('\n');
  const out = withDisputes(doc, sec).split('\n');
  assert.equal(out.at(-1), `${HANDOVER_END} · AF-1 ────────`, 'the end line stays last');
  assert.equal(out.indexOf(DISPUTE_HEAD), 3);
  assert.equal(withDisputes(doc, []), doc);
  assert.equal(withDisputes('짧은 글', sec).split('\n')[2], DISPUTE_HEAD);
});
/* ---------- map design v3 (slice S1): the panel's tabs, 구조's order, the way in, the width ---------- */
import { PANE_TABS, tabLabel, entryTab, tabKeyMove, STRUCTURE_ORDER, STRUCTURE_TITLE, structureSections, jumpChips, foldRows, PANE_SHOWN, behaviourSummary, cautionRows,
  unlinkedNames, listLabels, kindLead, evidenceList, evidenceCount, spanKey, EVIDENCE_ORDER, UNLINKED_HEAD, paneDefault, paneWidthFor, dragWidth, readPaneWidth, writePaneWidth,
  PANE_WIDTH_KEY, PANE_MIN, PANE_MAX } from '../dist/public/client/pane-view.js';

test('S1 tabs: 구조 | 근거 | 이력 as data, in that order; only the counted tabs carry their count above zero', () => {
  assert.deepEqual(PANE_TABS.map(t => [t.key, t.label]), [['structure', '구조'], ['evidence', '근거'], ['history', '이력']]);
  const [s, e, hi] = PANE_TABS;
  assert.equal(tabLabel(s, 9), '구조', '구조 has no count');
  assert.equal(tabLabel(e, 18), '근거 18');
  assert.equal(tabLabel(e, 0), '근거');
  assert.equal(tabLabel(hi, 6), '이력 6');
});

test('S1 the way in picks the first tab: a card → 구조, a rule or gate tab → 구조, a change tab or history → 이력, a citation or asking → 근거', () => {
  assert.equal(entryTab('card'), 'structure');
  assert.equal(entryTab('sign'), 'structure');
  assert.equal(entryTab('change'), 'history');
  assert.equal(entryTab('history'), 'history');
  assert.equal(entryTab('cite'), 'evidence');
  assert.equal(entryTab('ask'), 'evidence');
});

test('S1 ARIA tabs keys: ← → wrap, Home and End go to the ends, other keys do nothing', () => {
  assert.equal(tabKeyMove('structure', 'ArrowRight'), 'evidence');
  assert.equal(tabKeyMove('history', 'ArrowRight'), 'structure', 'wraps forward');
  assert.equal(tabKeyMove('structure', 'ArrowLeft'), 'history', 'wraps back');
  assert.equal(tabKeyMove('evidence', 'Home'), 'structure');
  assert.equal(tabKeyMove('evidence', 'End'), 'history');
  assert.equal(tabKeyMove('evidence', 'Enter'), null);
  assert.equal(tabKeyMove('evidence', 'ArrowDown'), null);
  assert.equal(tabKeyMove('evidence', 'ArrowRight', ['structure', 'evidence']), 'structure', 'the tab set is data: another set moves within itself');
});

// S9: 받는 것 · 내는 것 (was 계약) right under 하는 일, 조건 its own section after 동작, 연결 read as 안쪽 · 연결.
test('S1/S9 구조 reads 하는 일 → 확인 필요 → 받는 것 · 내는 것 → 동작 → 조건 → 규칙과 관문 → 안쪽 · 연결 → 어디에; absent sections left out; jump chips only for what is there', () => {
  assert.deepEqual(STRUCTURE_ORDER.map(k => STRUCTURE_TITLE[k]), ['하는 일', '확인 필요', '받는 것 · 내는 것', '동작', '조건', '규칙과 관문', '안쪽 · 연결', '어디에']);
  assert.deepEqual(structureSections({ where: 'W', rules: 'R', contract: 'C', behaviour: 'B', conditions: 'K', links: 'L' }), ['C', 'B', 'K', 'R', 'L', 'W']);
  assert.deepEqual(structureSections({ where: 'W', contract: null, behaviour: undefined }), ['W']);
  assert.deepEqual(jumpChips({ where: true, role: true, behaviour: 7, contract: 8, caution: 2, conditions: 2, rules: 2, links: true }).map(x => x.text), ['하는 일', '확인 2', '받는·내는 8', '동작 7', '조건 2', '규칙 2', '연결', '어디에']);
  assert.deepEqual(jumpChips({ role: true, behaviour: 0, where: true }).map(x => [x.key, x.text]), [['role', '하는 일'], ['behaviour', '동작'], ['where', '어디에']], 'a zero count reads the word alone; a missing section has no chip');
});

test('S1 a long list folds to its first rows; a kept row (the picked line or rule) is shown wherever it stands', () => {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.deepEqual(foldRows(rows, 3, false), { shown: [1, 2, 3], hidden: 7 });
  assert.deepEqual(foldRows(rows, 3, false, x => x === 9), { shown: [1, 2, 3, 9], hidden: 6 });
  assert.deepEqual(foldRows(rows, 3, true), { shown: rows, hidden: 0 });
  assert.deepEqual(foldRows([1, 2], 3, false), { shown: [1, 2], hidden: 0 });
  // S9: 동작 shows the first five steps (「+N 단계」), each side of 받는 것 · 내는 것 its first five lines.
  assert.equal(PANE_SHOWN.chain, 3); assert.equal(PANE_SHOWN.caution, 3); assert.equal(PANE_SHOWN.steps, 5); assert.equal(PANE_SHOWN.ports, 5); assert.equal(PANE_SHOWN.where, 4);
});

test('S1 동작 요약: the loop\'s unit and stop (with the program mark), four step names in row order with how many more, or 단계 기록 없음', () => {
  const steps = ['수집', '판정', '집행', '기록', '보고'].map(name => ({ name })), conds = [{ then: 'LINE_STALE이면 쉼', else: null }];
  const s = behaviourSummary({ unit: '행마다', stop: 'LINE_STALE이면 쉼', resume: null }, steps, [], conds);
  assert.deepEqual(s.loop.map(x => x.text), ['반복 행마다', '정지 LINE_STALE이면 쉼'], 'resume is left to 동작');
  assert.deepEqual(s.steps.map(x => x.name), ['수집', '판정', '집행', '기록']);
  assert.equal(s.more, 1); assert.equal(s.blank, null);
  const none = behaviourSummary(null, [], [], []);
  assert.equal(none.loop, null); assert.deepEqual(none.steps, []); assert.equal(none.blank, '단계 기록 없음');
  const prog = behaviourSummary({ unit: 'collect_cadence 300 s', stop: null, resume: null, program: true }, [{ name: 'a', program: true }], ['collect_cadence 300 s'], []);
  assert.deepEqual(prog.loop.map(x => [x.text, x.program]), [['반복 collect_cadence 300 s', true], ['정지 미상', false]]);
  assert.equal(prog.steps[0].program, true);
});

test('S1 확인 필요: only what the reading holds — unknown claims, a description resting on a taken-back report, lines on taken-back reports, another description, a replaced report', () => {
  const claims = [C({ text: '재개 조건을 확인하지 못함', topic: 'unknown' }), C({ text: '가동 중', topic: 'status' })];
  const rows = cautionRows({ claims, roleBasisRevised: true, revised: true, corrected: null, others: [{ text: '다른 설명', about: 'v2' }] }, 2);
  assert.deepEqual(rows.map(r => r.kind), ['unknown', 'revised-basis', 'revised-line', 'other-role', 'revised']);
  assert.equal(rows[0].claim, claims[0]); assert.equal(rows[0].text, '재개 조건을 확인하지 못함');
  assert.match(rows[2].text, /^선 2개/);
  assert.equal(rows[3].about, 'v2');
  assert.deepEqual(cautionRows({ claims: [C({ topic: 'status' })], roleBasisRevised: true, revised: false, corrected: { id: 'x', at: 't' }, others: [] }, 0), [], 'nothing made up; a corrected description has no taken-back basis');
});

test('S1 항목 근거 미연결: list names a line\'s payload says the same way are that line\'s; the rest read apart, with the kind\'s own words', () => {
  assert.equal(UNLINKED_HEAD, '목록으로만 적힌 값', 'S9: plain words (was 「항목 근거 미연결 추출값」)');
  assert.deepEqual(unlinkedNames(['calendar.json', '잔고 입출금', '`review` 행'], ['Calendar.JSON', 'review 행', null]), ['잔고 입출금']);
  assert.deepEqual(unlinkedNames(['a'], []), ['a']);
  assert.deepEqual(listLabels('ai'), { inputs: '맥락', outputs: '반환', fields: '필드', config: '기준' });
  assert.equal(listLabels('store').fields, '보관하는 칸');
  assert.equal(listLabels('external').inputs, '우리가 보내는 것');
  assert.deepEqual(listLabels(null), { inputs: '받는 것', outputs: '내는 것', fields: '필드', config: '설정' });
});

test('S1 계약\'s first rows by kind come only from what is there (the outside system\'s scope note is fixed)', () => {
  const none = { exits: [], manualRules: 0, targets: [] };
  assert.deepEqual(kindLead('external', none).map(x => [x.label, x.text]), [['내부', '기록 범위 밖']]);
  assert.deepEqual(kindLead('person', none), [], 'no rule kept by hand: no row');
  assert.deepEqual(kindLead('person', { ...none, manualRules: 2 }).map(x => x.text), ['2']);
  assert.deepEqual(kindLead('ai', { ...none, exits: ['통과', '거절', '통과', '보류', '재시도', '중단'] }).map(x => x.text), ['통과 · 거절 · 보류 · 재시도 +1']);
  assert.deepEqual(kindLead('timer', { ...none, targets: ['수집기'] }).map(x => [x.label, x.text]), [['기동하는 것', '수집기']]);
  assert.deepEqual(kindLead('compute', { exits: ['x'], manualRules: 3, targets: ['y'] }), []);
});

test('S1 근거 (the S2 seam): entries under 구조\'s section heads in 구조\'s order, every current claim once; the count is the distinct quoted spans', () => {
  const q = (t, from) => ({ record: 'P1', quote: t, ...(from !== undefined ? { from, to: from + t.length } : {}) });
  const rule = C({ text: '하루 상한 5만 원', topic: 'rule', quote: 'r', from: 50, to: 51 }), unknown = C({ text: '재개 미상', topic: 'unknown', quote: 'u' }), other = C({ text: '가동 중', topic: 'status', quote: 's' });
  const groups = evidenceList({
    roleBasis: [q('설명', 0)], state: { label: '운영 한 줄', quote: q('설명', 0) }, type: { label: '종류 · 루프·엔진', quote: null },
    relations: [{ id: 'r1', label: '받는 것 · 수집기', quote: q('선', 10) }, { id: 'r2', label: '내는 것 · 성적표', quote: null }],
    loop: { quote: q('반복', 20) }, steps: [{ name: '판정', quote: q('판정', 30) }], conditions: [{ when: 'LINE_STALE', quote: q('조건', 40) }],
    portMap: [{ port: 'review', step: '판정', direction: 'in', quote: q('포트', 45) }], fileRoles: [{ path: 'engine.py', quote: q('파일', 60) }],
    claims: [other, rule, unknown], rules: [rule] });
  assert.deepEqual(groups.map(g => g.section), ['role', 'caution', 'contract', 'behaviour', 'rules', 'where', 'other']);
  assert.deepEqual(EVIDENCE_ORDER, ['role', 'caution', 'contract', 'behaviour', 'rules', 'where', 'other']);
  assert.deepEqual(groups[0].entries.map(e => e.kind), ['role', 'state', 'type']);
  assert.deepEqual(groups[3].entries.map(e => e.kind), ['loop', 'step', 'condition', 'portmap']);
  assert.deepEqual(groups.flatMap(g => g.entries.filter(e => e.claim).map(e => e.claim.text)), ['재개 미상', '하루 상한 5만 원', '가동 중'], 'each claim once: unknown under 확인 필요, the rule under 규칙, the rest last');
  // spans: 설명 (role and state share it), 선, 반복, 판정, 조건, 포트, 파일, the rule's, the unknown's and the other claim's words
  assert.equal(evidenceCount(groups), 10);
  assert.equal(spanKey(q('a b', 3)), 'P1|3|6');
  assert.equal(spanKey({ record: 'P1', quote: ' a  b ' }), 'P1|a b');
  assert.deepEqual(evidenceList({ roleBasis: [], state: null, type: null, relations: [], loop: null, steps: [], conditions: [], portMap: [], fileRoles: [], claims: [], rules: [] }), []);
});

test('S1 width: clamp(384px, 29vw, 448px) by default, a dragged width within 360–600 that gives way before the map drops under 480px; kept per browser', () => {
  assert.equal(paneDefault(1280), 384); assert.equal(Math.round(paneDefault(1440)), 418); assert.equal(paneDefault(1920), 448);
  assert.equal(paneWidthFor(null, 1440), paneDefault(1440));
  assert.equal(paneWidthFor(520, 1920), 520);
  assert.equal(paneWidthFor(900, 1920), PANE_MAX); assert.equal(paneWidthFor(100, 1920), PANE_MIN);
  assert.equal(paneWidthFor(600, 1000), 520, 'the map keeps 480px');
  assert.equal(paneWidthFor(600, 800), 384, 'never under the default for the map\'s sake');
  assert.equal(paneWidthFor(360, 800), 360, 'narrower is always allowed');
  assert.equal(paneWidthFor(500, 700), 700, 'below 720px the pane is the window');
  assert.equal(dragWidth(400, 1000, 950), 450, 'dragging left widens');
  assert.equal(dragWidth(400, 1000, 1200), PANE_MIN); assert.equal(dragWidth(400, 1000, 0), PANE_MAX);
  const m = memory();
  assert.equal(readPaneWidth(m), null);
  assert.ok(writePaneWidth(m, 512.4)); assert.equal(m.getItem(PANE_WIDTH_KEY), '512'); assert.equal(readPaneWidth(m), 512);
  assert.ok(writePaneWidth(m, null)); assert.equal(readPaneWidth(m), null, 'reset: the default again');
  m.setItem(PANE_WIDTH_KEY, 'wide'); assert.equal(readPaneWidth(m), null, 'unreadable reads as none');
  m.setItem(PANE_WIDTH_KEY, '9000'); assert.equal(readPaneWidth(m), PANE_MAX);
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readPaneWidth(blocked), null); assert.equal(writePaneWidth(blocked, 500), false); assert.equal(readPaneWidth(null), null);
});

/* ---------- map-reading.12: 구조 lists the condition rows ---------- */
import { structureSummary, structureConditions } from '../dist/public/client/pane-view.js';
test('구조: the summary counts the conditions after the steps; each condition row with its words and the step it stands on, or 단계 미상', () => {
  assert.equal(structureSummary({ steps: 4, conditions: 3, loop: true, vars: 2 }), '단계 4 · 조건 3 · 반복 · 유지 상태 2');
  assert.equal(structureSummary({ steps: 0, conditions: 2, loop: false, vars: 0 }), '조건 2');
  assert.equal(structureSummary({ steps: 2, conditions: 0, loop: false, vars: 0 }), '단계 2');
  const steps = [{ name: '요청 받기', uses: [] }, { name: '점검', uses: ['clock.py'] }];
  const q = t => ({ record: 'P1', quote: t, from: 0, to: t.length });
  const conds = [{ when: '점검 결과 지연', then: '경보', else: '헬스 행', quote: q('a') }, { when: 'clock.py 응답 없음', then: '경보', else: null, quote: q('b') },
    { when: '경보 3회 연속', then: '소유자 호출', else: null, quote: q('c') }];
  const rows = structureConditions(conds, steps);
  assert.deepEqual(rows.map(x => [x.index, x.text, x.step]), [[0, '조건 점검 결과 지연 → 경보 · 아니면 → 헬스 행', '점검'], [1, '조건 clock.py 응답 없음 → 경보', '점검'], [2, '조건 경보 3회 연속 → 소유자 호출', null]]);
  assert.equal(rows[0].condition, conds[0], 'the row keeps its condition (its quote chip reads its row)');
  assert.deepEqual(structureConditions([], steps), []);
  assert.deepEqual(structureConditions(conds.slice(0, 1), []).map(x => x.step), [null], 'no steps: every condition 단계 미상');
});

test('구조 (map-reading.13): what the program filled in the loop and the kept state carries the program mark, the rest reads as before', () => {
  const conds = [{ when: 'quota.used >= quota.limit', then: 'QUOTA_REACHED, 오늘 조회 멈춤', else: null }];
  const k = structureKeep({ unit: 'collect_cadence 300 s', stop: 'QUOTA_REACHED, 오늘 조회 멈춤', resume: null, program: true },
    [{ name: 'quota.used', scope: null, readBy: [], changedBy: [], program: true }, { name: 'cursor', scope: 'sqlite', readBy: ['수집'], changedBy: ['저장'], program: false }],
    ['collect_cadence 300 s'], conds);
  assert.deepEqual(k.loop.map(x => [x.text, x.program]), [['반복 collect_cadence 300 s', true], ['정지 QUOTA_REACHED, 오늘 조회 멈춤', true], ['재개 미상', false]]);
  assert.deepEqual(k.vars.map(v => [v.name, v.scope, v.rw, v.program]), [['quota.used', null, '읽음 미상 · 바꿈 미상', true], ['cursor', 'sqlite', '읽음 수집 · 바꿈 저장', false]]);
  const model = structureKeep({ unit: '틱', stop: null, resume: null }, [{ name: 's', scope: null, readBy: [], changedBy: [] }], [], []);
  assert.deepEqual(model.loop.map(x => x.program), [false, false, false], 'a loop an earlier reading wrote is the model\'s');
  assert.equal(model.vars[0].program, false);
  assert.equal(structureKeep(null, [], [], []).loop, null);
});

/* ---------- map-reading.14: 어디에 with the 파일 지도 ---------- */
import { whereRows, fileRoleOf, enforcePlace, pathKey, WHERE_SHOWN } from '../dist/public/client/pane-view.js';
test('어디에: each file a 파일 지도 row gives a role as 경로 · 역할 (the part\'s files first), the rest as chips as before', () => {
  const q = (t, from) => ({ record: 'P1', quote: t, from, to: from + t.length });
  const roles = [
    { path: 'engine/rung.py', role: 'rung 고르기', quote: q('| engine/rung.py | rung 고르기 |', 100) },
    { path: 'engine/read.py', role: 'review 행 읽기', quote: q('| engine/read.py | review 행 읽기 |', 140) },
    { path: 'state/policy.db', role: '정책 저장', quote: q('| state/policy.db | 정책 저장 |', 180) },
  ];
  const w = whereRows(['`engine/read.py`', 'review.jsonl', 'engine/rung.py', null, 'review.jsonl', 'docs/'], roles);
  assert.deepEqual(w.roles.map(f => f.path), ['engine/read.py', 'engine/rung.py', 'state/policy.db'], 'the files\' order first, then the other rows');
  assert.deepEqual(w.plain, ['review.jsonl', 'docs/'], 'files without a role stay chips, each once');
  assert.deepEqual(whereRows(['a', 'b'], []), { roles: [], plain: ['a', 'b'] }, 'no 파일 지도: as before');
  assert.deepEqual(whereRows([], roles).roles.length, 3, 'rows on their own still list');
  assert.equal(whereRows(Array.from({ length: 12 }, (_, i) => `f${i}`), []).plain.length, WHERE_SHOWN);
  assert.equal(pathKey(' `./engine/read.py/` '), 'engine/read.py');
  assert.equal(pathKey('engine\\read.py'), 'engine/read.py');
});

test('a step\'s uses item names a 파일 지도 file: the path itself or held whole; never a piece of a longer name', () => {
  const roles = [{ path: 'engine/read.py', role: 'review 행 읽기', quote: { record: 'P1', quote: 'x' } }, { path: 'read.py', role: '짧은 것', quote: { record: 'P1', quote: 'y' } }];
  assert.equal(fileRoleOf('engine/read.py', roles)?.role, 'review 행 읽기');
  assert.equal(fileRoleOf('`engine/read.py`', roles)?.role, 'review 행 읽기');
  assert.equal(fileRoleOf('engine/read.py의 read_rows 함수', roles)?.role, 'review 행 읽기', 'held whole, the longest path wins');
  assert.equal(fileRoleOf('engine/read.py:read_rows', roles)?.role, 'review 행 읽기');
  assert.equal(fileRoleOf('see engine/read.py.', roles)?.role, 'review 행 읽기', 'a sentence\'s closing dot');
  assert.equal(fileRoleOf('read.py', roles)?.role, '짧은 것');
  assert.equal(fileRoleOf('engine/read.pyc', roles), null, 'a longer name');
  assert.equal(fileRoleOf('myengine/read.py', roles), null, 'engine/read.py joined to a letter, read.py to a slash: neither');
  assert.equal(fileRoleOf('J1', roles), null);
  assert.equal(fileRoleOf('engine/read.py', []), null);
});

test('보장: a code enforcement resting on a 파일 지도 row names that file as its place; any other kind or row names none', () => {
  const row = { record: 'P1', quote: '| engine/gate.py | LINE_STALE 거절 |', from: 200, to: 233 };
  const roles = [{ path: 'engine/gate.py', role: 'LINE_STALE 거절', quote: row }];
  assert.equal(enforcePlace({ kind: 'code', quote: { ...row, quote: '| engine/gate.py |  LINE_STALE 거절 |' } }, roles)?.path, 'engine/gate.py', 'spacing aside');
  assert.equal(enforcePlace({ kind: 'code', quote: { record: 'P1', quote: row.quote } }, roles)?.path, 'engine/gate.py', 'no span: the words decide');
  assert.equal(enforcePlace({ kind: 'gate', quote: row }, roles), null, 'not a code enforcement');
  assert.equal(enforcePlace({ kind: 'code', quote: null }, roles), null);
  assert.equal(enforcePlace({ kind: 'code', quote: { record: 'P1', quote: '다른 줄' } }, roles), null);
  assert.equal(enforcePlace({ kind: 'code', quote: { ...row, from: 10, to: 43 } }, roles), null, 'the same words elsewhere');
});
