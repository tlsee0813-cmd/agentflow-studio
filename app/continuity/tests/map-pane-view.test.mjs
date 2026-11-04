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
/* ---------- cycle 6: one order for the lens and the full reading ---------- */
import { paneSections, structureOpen, PANE_ORDER, PANE_TITLE } from '../dist/public/client/pane-view.js';

test('paneSections: the lens and the full reading lay their sections out in one order (원문 → 이유 → 이력 → 출처 묶음 → 어디에), absent ones left out; 구조 folded', () => {
  assert.deepEqual(PANE_ORDER.map(k => PANE_TITLE[k]), ['원문', '이유', '이력', '출처 묶음', '어디에']);
  assert.deepEqual(paneSections({ where: 'W', sources: 'S', why: 'Y', history: 'H', origin: 'O' }), ['O', 'Y', 'H', 'S', 'W']);
  assert.deepEqual(paneSections({ where: 'W', origin: null, why: 'Y', history: undefined }), ['Y', 'W']);
  assert.deepEqual(paneSections({}), []);
  assert.equal(structureOpen(false, false), false);
  assert.equal(structureOpen(true, false), true);
  assert.equal(structureOpen(false, true), true);
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
