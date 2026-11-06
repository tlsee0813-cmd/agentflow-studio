// Recipe .48 (from the blind three-way judging of the .47 maps): the program's half of a v5 first map on fictional records — the
// 물주기 record (fixtures/record45) with its names and cells changed where a case needs it, and a 공방 예약 record of 30 parts and 50
// connection rows written here. Lines on rows whose part name holds 「·」 stand; the connection diagnostic names parts, not B IDs; the
// record's lines fit the 48 first-map lines one row at a time and model-only lines go first; a part's type comes from its 표현군·역할 by
// a fixed table (never invented); a claim's grade and date come from its own row's cites and cells. No model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as D from '../dist/public/shared/domain.js';
import * as J from '../dist/public/shared/map-job.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import * as M from '../dist/public/shared/map-reading.js';
import * as T from '../dist/public/shared/record-table.js';
import * as R from '../dist/public/shared/report-ask.js';
import { studioView } from '../dist/public/shared/studio.js';
import { groupParentConflicts } from '../dist/public/shared/record-reading.js';
import * as RR from '../dist/public/shared/record-reading.js';
import { validateProject } from '../dist/public/shared/validation.js';
import * as B from '../server/map-blueprint.mjs';

const page = n => readFileSync(new URL(`./fixtures/record45/page${n}.txt`, import.meta.url), 'utf8');
function ofPages(texts) {
  let project = D.createProject();
  for (const t of texts) project = D.pasteRecord(project, t, null).project;
  project = { ...project, pasted: project.pasted.map((r, i) => ({ ...r, at: new Date(Date.UTC(2026, 10, 5, 9, 0, i)).toISOString() })) };
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records.flatMap(r => r.spans);
  const at = head => { const hit = spans.filter(s => s.t.startsWith(head)); if (hit.length !== 1) throw new Error(`span ${head}: ${hit.length}`); return hit[0].s; };
  return { project, input, ask: input.ask, at };
}
const part = (f, ref, name, head, x = {}) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [f.at(head)], claims: [], ...x });
const claim = (f, key, head, x = {}) => ({ key, kind: 'reported', text: `원문 행을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null, ...x });
const line = (f, from, to, head, x = {}) => ({ from, to, kind: 'flow', note: '', at: f.at(head), channel: 'data', mode: 'design', ...x });
const wire = (parts, relations = []) => ({ summary: '', parts, relations, candidates: [], gaps: [], matches: [], material: [] });

/* ---------- the fictional 공방 예약 record: 30 parts, 10 stored hand-overs and 40 direct rows ---------- */
const pad = n => String(n).padStart(2, '0'), b = i => `B${pad(i)}`;
const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
/** Rows LN01–LN10 hand D01 (stored in B30) from B(k) to B(k+10); LN11–LN50 are direct rows between distinct pairs. */
const DIRECT = Array.from({ length: 40 }, (_, k) => [1 + (k % 20), 21 + Math.floor(k / 20) * 4 + (k % 4)]).map(([a, c], k) => [a, c === a ? c + 1 : c, k]);
function workshop() {
  const links = [...Array.from({ length: 10 }, (_, k) => [`LN${pad(k + 1)}`, b(k + 1), b(k + 11), 'D01 예약 행', '호출마다', '—', '같은 프로세스', '정의된 관계', 'F01']),
    ...DIRECT.map(([a, c], k) => [`LN${pad(k + 11)}`, b(a), b(c), `넘김 ${pad(k + 11)}`, '호출마다', '—', '같은 프로세스', '정의된 관계', 'F01'])];
  return ['〔기록 AF5-0a0b0c0d · 쪽 1 · 기준 abc1234 · 앞 쪽 —〕 공방 예약 기록 v5 (시험 세션, 2026-11-05 12:00)',
    table('C-SRC', [['F01', 'src/', '전체', '읽음', '예약 코드']]),
    table('C-EVID', [['E01', '실행', 'rg -n "book" src/', '1행', 'book ok']]),
    table('C-HEAD', T.HEAD_ITEMS.map((item, k) => [item, k === 7 ? '예약과 기록' : `값 ${k + 1}`, 'F01'])),
    'C-SUMMARY 요약\n공방 예약은 회원이 작업대를 예약하면 기록부에 남긴다 (F01).',
    table('C-PART', Array.from({ length: 30 }, (_, k) => { const i = k + 1;
      return [b(i), i === 30 ? '예약 기록부(bookings.db)' : `공방 부분 ${pad(i)}`, i === 30 ? '저장 · DB 테이블' : '처리 · 계산', `부분 ${pad(i)}의 일`, 'F01', '구현됨', 'F01']; })),
    table('C-LINK', links),
    // B02 runs 30 steps; S10–S20 are the body of its loop B02:L01 (in the middle, where a first-and-last cut falls).
    table('C-LOOP', [[`${b(2)}:L01`, b(2), '—', '예약마다', '대기열이 빌 때까지', '대기열 끝', 'S10–S20', 'F01']]),
    table('C-STEP', Array.from({ length: 30 }, (_, k) => [`${b(2)}:S${pad(k + 1)}`, k === 0 ? '받기' : `단계 ${pad(k + 1)}`, `예약 처리 ${pad(k + 1)}`, `step${k + 1}()`,
      k >= 9 && k <= 19 ? `${b(2)}:L01` : '—', '—', 'F01'])),
    table('C-DATA', [['D01', '예약 행(bookings.db)', '저장', 'member, bench, at', b(1), b(11), 'db/bookings (덧붙임)', 'F01']]),
    table('C-END', [['C-PART', '끝남', 'B01–B30', '—', '—'], ['C-LINK', '끝남', 'LN01–LN50', '—', '—'], ['C-LOOP', '끝남', 'B02:L01', '—', '—'], ['C-STEP', '끝남', 'B02:S01–B02:S30', '—', '—'], ['C-DATA', '끝남', 'D01', '—', '—']]),
    '완료 단계: 상세 완료'].join('\n');
}

test('R48-3 a recorded line between parts whose names hold 「·」 stands (no sender set-aside), and the connection rows of a v5 record name parts, never B IDs', () => {
  const p1 = page(1).replace('|B03|화분 API|', '|B03|화분·등록 API|').replace('|B09|로그인 검사|', '|B09|로그인·토큰 검사|');
  const f = ofPages([p1, page(2), page(3)]);
  const w = wire([part(f, 'new:app', '물주기 앱', '|B02|'), part(f, 'new:login', '로그인·토큰 검사', '|B09|'), part(f, 'new:api', '화분·등록 API', '|B03|')],
    [line(f, 'new:app', 'new:login', '|LN02|', { payload: 'D01 등록 요청' }), line(f, 'new:login', 'new:api', '|LN03|', { payload: 'D01 등록 요청' })]);
  const read = M.validateMapReply(structuredClone(w), f.ask, { setAside: true });
  assert.deepEqual(M.readingExclusions(read).filter(x => x.category === 'sender').map(x => x.path), [], 'no recorded line is set aside for its sender');
  assert.ok(read.relations.some(r => r.from === 'new:login' && r.to === 'new:api'), 'the line between two 「·」 names stands');
  const rows = B.connectionRows(f.ask);
  assert.ok(rows.some(([a, c]) => a === '물주기 앱' && c === '로그인·토큰 검사'), 'a row names its parts');
  assert.ok(!rows.some(([a, c]) => /^b\d{2}$/.test(a) || /^b\d{2}$/.test(c)), 'never a B ID');
  assert.ok(!rows.some(([a]) => a === '화분 api'), 'the current rows only: LN09, dropped, is no row');
});

test('R48-3 the record\'s lines fit the 48 first-map lines one row at a time: every row a line before any stored hand-over\'s second half; the rows past the cap are counted, never a silent zero', () => {
  const f = ofPages([workshop()]);
  const read = M.validateMapReply(wire([part(f, 'new:p01', '공방 부분 01', '|B01|'), part(f, 'new:p02', '공방 부분 02', '|B02|')]), f.ask, { setAside: true });
  assert.equal(read.relations.length, M.MAP6_RELATIONS);
  const ref = name => read.parts.find(x => x.name === name)?.ref, store = ref('예약 기록부(bookings.db)');
  // The ten stored rows: each has its writer half (B(k) → store); the reader halves come only after every row has a line.
  for (let k = 1; k <= 10; k++) assert.ok(read.relations.some(r => r.from === ref(`공방 부분 ${pad(k)}`) && r.to === store), `LN${pad(k)} writer half`);
  assert.equal(read.relations.filter(r => r.from === store).length, 0, 'no second half while a row has no line');
  const undrawn = B.undrawnRecordLines(read, f.ask);
  assert.equal(undrawn.rows, 50);
  assert.equal(undrawn.missing.length, 2, 'the two rows past 48 are named');
  assert.match(undrawn.missing[0], /^LN49 /);
});

test('R48-3 at the cap, the model\'s own line on no C-LINK, C-DATA or C-ENTRY row goes first so a recorded row is drawn; a line the record draws, or a part\'s last line, stays', () => {
  const f = ofPages([workshop()]);
  const read = M.validateMapReply(wire([part(f, 'new:p01', '공방 부분 01', '|B01|'), part(f, 'new:p02', '공방 부분 02', '|B02|')]), f.ask, { setAside: true });
  const busy = [...new Set(read.relations.map(r => r.from))].filter(x => read.relations.filter(r => r.from === x || r.to === x).length >= 3).slice(0, 2);
  const lines = [{ from: busy[0], to: busy[1], at: f.at(`|${b(2)}:S01|`) }, { from: busy[0], to: busy[1], at: f.at('|LN11|') }, { from: 'new:p02', to: 'new:lonely', at: f.at(`|${b(2)}:S01|`) }];
  assert.deepEqual(B.lineCapAway({ soft: read, keptLines: [0, 1, 2] }, lines, f.ask), [0], 'only the line on a step row with both ends kept elsewhere');
  const few = M.validateMapReply(wire([part(f, 'new:p01', '공방 부분 01', '|B01|')]), ofPages([page(1), page(2)]).ask, { setAside: true });
  assert.deepEqual(B.lineCapAway({ soft: few, keptLines: [0] }, lines, ofPages([page(1), page(2)]).ask), [], 'below the cap nothing goes');
});

test('R48-1 a part\'s type comes from its 표현군·역할 by the fixed table, confirmed by the record\'s structure (A7: a role word only proposes); a family whose role it does not map gives none and is said quietly; 미정 gives nothing', () => {
  const s = (x = {}) => ({ ...T.NO_STRUCTURE, ...x }), loop = s({ loopOwner: true }), time = s({ timeUnit: true }), out = s({ boundary: true }), block = s({ allowBlock: true });
  const cases = [['저장 · 행 파일', 'store'], ['저장', 'store'], ['촉발 · 매일 일정', 'timer'], ['촉발 · 5분 주기 신호', 'timer'], ['촉발 · 배포 자동화', 'automation'], ['촉발 · 창 닫힘 신호', null],
    // 「스케줄러」 may be an assigner: a timer only with a written time or cycle unit.
    ['촉발 · 스케줄러', null], ['촉발 · 스케줄러', 'timer', time],
    // A gate needs a recorded allow or block; a check alone is no type (the family says 관문). 승인·검토 by a token, a bot or CI is no person.
    ['관문 · 인증', null], ['관문 · 인증', 'compute', block], ['관문 · 사람 승인', 'person', block], ['관문 · 승인된 토큰만 통과', 'compute', block], ['관문 · 자동 검토 봇', 'compute', block], ['관문 · 코드 검토(CI)', 'compute', block],
    // A person is a person inside or outside (the role's last word); 「봇」 says nothing of the boundary; only an AI 세션 is a session.
    ['참여 · 회원', 'person'], ['참여 · 창고 문', null], ['참여 · 방문자', 'person'], ['참여 · 메인테이너', 'person'], ['참여 · 외부 기여자', 'person'], ['참여 · 외부 사용자', 'person'], ['참여 · 플러그인 작성자', 'person'],
    ['참여 · 의존성 갱신 봇', null], ['참여 · 의존성 갱신 봇', 'external', out], ['참여 · 결제 서비스', null], ['참여 · 결제 서비스', 'external', out], ['참여 · 외부 시스템', 'external'],
    ['참여 · 사용자 코드', 'external'], ['참여 · 임베딩 호출·사용자 실행기', 'external'], ['참여 · AI 세션', 'session'], ['참여 · 방문자 세션', null],
    // A loop only for a C-LOOP owner; collecting is a collector, measuring what it holds a computation; a screen and an actor by the role's head.
    ['처리 · 반복 실행 조정', null], ['처리 · 반복 실행 조정', 'loop', loop], ['처리 · 대기열 스케줄', 'loop', loop], ['처리 · 반복 계산', null, loop],
    ['처리 · 센서 값 수집', 'collector'], ['처리 · 속도 측정', 'compute'], ['처리 · AI 판단', 'ai'], ['처리 · LLM 요약', 'ai'], ['처리 · 목록 화면', 'screen'], ['처리 · 화면 자료 변환', 'compute'], ['처리 · 외부 호출', 'actor'],
    ['처리 · 작업 실행기', 'actor'], ['처리 · 값 변환', 'compute'], ['처리 · 입력 검증', 'compute'], ['처리 · 요청 처리', null], ['미정 · 서로 다른 역할 혼재(처리·저장)', null], ['그 밖', null]];
  for (const [cell, type, st] of cases) assert.equal(T.familyType(cell, st).type, type, `${cell} ${JSON.stringify(st ?? {})}`);
  // unmapped (the app could not map the role) apart from held (a type proposed and not confirmed, or types that compete) and 미정 (neither).
  assert.deepEqual([T.familyType('처리 · 요청 처리').unmapped, T.familyType('미정 · 대상 범위 불명확').unmapped, T.familyType('그 밖').unmapped], [true, false, false]);
  assert.deepEqual([T.familyType('처리 · 반복 실행 조정'), T.familyType('처리 · 반복 계산', loop)], [{ type: null, unmapped: false, held: 'loop?' }, { type: null, unmapped: false, held: 'loop|compute' }]);
  // On the 물주기 record: the gate is a check, a part whose role the table does not map stays untyped and is named (type-unmapped).
  const f = ofPages([page(1), page(2), page(3)]);
  const read = M.validateMapReply(wire([part(f, 'new:api', '화분 API', '|B03|')]), f.ask, { setAside: true }), of = name => read.parts.find(x => x.name === name);
  assert.deepEqual(['사용자', '물주기 앱', '화분 API', '급수 기록 DB', '일정 계산기', '매시 틱', '푸시 발송기', '푸시 게이트웨이', '로그인 검사', '설정 모음'].map(n => of(n)?.type ?? null),
    ['person', 'screen', null, 'store', 'compute', 'timer', 'actor', 'external', 'compute', null]);
  assert.equal(of('로그인 검사').family, 'gate', 'the family stays 관문');
  assert.ok(of('로그인 검사').typeQuote.quote.includes('|B09|'), 'the type stands on its row');
  assert.deepEqual(B.unmappedTypes(f.ask), ['B03 화분 API: 처리 · 요청 처리', 'B10 설정 모음: 처리 · 설정 읽기']);
});

test('R48-2 a claim on a v5 row takes its grade from the row\'s own cites (E → its grade, F → file) and its date from that same row, never the next row\'s', () => {
  const f = ofPages([page(1), page(2), page(3)]);
  const w = wire([part(f, 'new:push', '푸시 발송기', '|B07|푸시', { claims: [
    claim(f, 's1', '|CH01|', { topic: 'change', evidence: null, when: '2026-08-02' }),
    claim(f, 's2', '|RU01|', { topic: 'rule', kind: 'describes', evidence: null, when: null }),
    claim(f, 's3', '|CD01|', { topic: 'how', kind: 'describes', evidence: 'report', when: '실행 시' }),
    claim(f, 's4', '|GT01|', { topic: 'plan', kind: 'want', evidence: null, when: '2026-12' })] }),
  part(f, 'new:tick', '매시 틱', '|B06|', { claims: [claim(f, 's5', '|DB01|', { topic: 'unknown', kind: 'open', evidence: null, when: null }), claim(f, 's6', '|LN05|', { topic: 'how', kind: 'describes', evidence: 'run', when: null })] })]);
  const read = M.validateMapReply(structuredClone(w), f.ask, { setAside: true }), c = key => read.parts.flatMap(x => x.claims).find(x => x.key === key);
  assert.deepEqual([c('s1').evidence, c('s1').when], ['report', '2026-09-02'], 'CH01 cites E05 (보고) and is dated 2026-09-02, never CH02\'s 2026-08-02');
  assert.deepEqual([c('s2').evidence, c('s2').when], ['file', '2026-08'], 'RU01 cites F04 and was set 2026-08');
  // Review B1 fix: the ledger never raises a grade the reply gave (a report on a row citing a file read stays a report).
  assert.deepEqual([c('s3').evidence, c('s3').when], ['report', '실행 시'], 'a when the row writes stays; the reply\'s lower grade stays');
  assert.deepEqual([c('s4').evidence, c('s4').when], ['report', null], 'a date the row does not write is not kept');
  assert.deepEqual([c('s5').evidence, c('s5').when], ['guess', null], 'a row citing only 추정 is a guess');
  // The cite-grade guard stands: a run-grade claim on a row citing a run E is kept as run; one past its row's cites is still left out.
  assert.equal(c('s6').evidence, 'run');
  const past = wire([part(f, 'new:push', '푸시 발송기', '|B07|푸시', { claims: [claim(f, 's7', '|RU01|', { topic: 'rule', kind: 'describes', evidence: 'run' })] })]);
  const r2 = M.validateMapReply(structuredClone(past), f.ask, { setAside: true });
  assert.ok(!r2.parts.flatMap(x => x.claims).some(x => x.key === 's7') && M.readingExclusions(r2).some(x => x.category === 'cite-grade'));
});

test('R48-4 a part with more C-STEP rows than steps keeps its loop body: the reply\'s first-and-last cut gives way to the body rows (the program\'s, from their rows); the bound holds', () => {
  const f = ofPages([workshop()]), step = k => ({ name: k === 1 ? '받기' : `단계 ${pad(k)}`, does: `예약 처리 ${pad(k)}`, uses: [`step${k}()`], at: f.at(`|${b(2)}:S${pad(k)}|`) });
  const firstLast = [...Array.from({ length: 12 }, (_, k) => k + 1), ...Array.from({ length: 12 }, (_, k) => k + 19)];
  const read = M.validateMapReply(wire([part(f, 'new:p02', '공방 부분 02', '|B02|', { steps: firstLast.map(step) })]), f.ask, { setAside: true });
  const steps = read.parts.find(x => x.ref === 'new:p02').steps, names = steps.map(s => s.name);
  assert.equal(steps.length, 24);
  for (let k = 10; k <= 20; k++) assert.ok(names.includes(`단계 ${pad(k)}`), `loop body S${pad(k)} kept`);
  assert.deepEqual(steps.filter(s => s.program).map(s => s.name), ['단계 13', '단계 14', '단계 15', '단계 16', '단계 17', '단계 18'], 'the body rows the reply left out are the program\'s');
  assert.deepEqual(steps.filter(s => s.program).map(s => [s.does, s.uses]).slice(0, 1), [['예약 처리 13', []]], 'a program step uses nothing (map-reading.14); its row says the rest');
  assert.ok(names.includes('받기') && names.includes('단계 30'), 'the first and last rows stay');
  assert.deepEqual(names, [...names].sort((x, y) => (x === '받기' ? 1 : Number(x.slice(3))) - (y === '받기' ? 1 : Number(y.slice(3)))), 'in row order');
  // A part whose steps all fit (or a reply that already keeps the body) is left as written.
  const body = [...Array.from({ length: 23 }, (_, k) => k + 1), 30];
  const kept = M.validateMapReply(wire([part(f, 'new:p02', '공방 부분 02', '|B02|', { steps: body.map(step) })]), f.ask, { setAside: true }).parts.find(x => x.ref === 'new:p02').steps;
  assert.deepEqual(kept.filter(s => s.program).length, 0);
});

test('R48-4 a condition whose 거짓이면, or a step whose 하는 일, runs past its bound keeps the row with that cell alone written null (said); a 참이면 past its bound still sets the condition aside', () => {
  const longElse = '발송하고 다음 매시 틱까지 기다린 뒤 다시 계산한다 '.repeat(3).trim();
  const p2 = page(2).replace('|CD01|B07|now in quietHours|아침 7시로 미룸|발송|실행 시|F04|', `|CD01|B07|now in quietHours|아침 7시로 미룸|${longElse}|실행 시|F04|`);
  const f = ofPages([page(1), p2, page(3)]), longDoes = '화분의 마지막 급수 기록을 읽는다'.repeat(8);
  assert.ok(longElse.length > 60 && longDoes.length > 120);
  const w = wire([part(f, 'new:push', '푸시 발송기', '|B07|푸시', { conditions: [{ when: 'now in quietHours', then: '아침 7시로 미룸', else: longElse, at: f.at('|CD01|') }] }),
    part(f, 'new:calc', '일정 계산기', '|B05|', { steps: [{ name: '기록 읽기', does: longDoes, uses: ['loadHistory()'], at: f.at('|B05:S01|') }] }),
    part(f, 'new:login', '로그인 검사', '|B09|', { conditions: [{ when: '!token', then: '401 '.repeat(20), else: '다음', at: f.at('|CD02|') }] })]);
  const read = M.validateMapReply(structuredClone(w), f.ask, { setAside: true }), of = ref => read.parts.find(x => x.ref === ref);
  // (the program's P5-03 retry row stands after the reply's own condition)
  assert.deepEqual(of('new:push').conditions.map(c => [c.when, c.then, c.else]).slice(0, 1), [['now in quietHours', '아침 7시로 미룸', null]]);
  assert.deepEqual(of('new:calc').steps.map(s => [s.name, s.does]), [['기록 읽기', null]]);
  assert.deepEqual(of('new:login').conditions, []);
  const said = M.readingExclusions(read).map(x => [x.path, x.category]);
  assert.ok(said.some(([p, c]) => c === 'condition-else' && /^parts\[0\]\.conditions\[0\]\.else$/.test(p)), JSON.stringify(said));
  assert.ok(said.some(([p, c]) => c === 'step-does' && /^parts\[1\]\.steps\[0\]\.does$/.test(p)));
  assert.ok(said.some(([p, c]) => c === 'condition' && /^parts\[2\]\.conditions\[0\]$/.test(p)));
  assert.match(M.explainExclusion('parts[0].conditions[0].else', 'contract', 'condition-else'), /그 칸만 비우고 조건은 남겼어요/);
});

test('R48-5 a C-GROUP 구성 row whose 부모 is a part sets its children\'s parent over the model\'s (said); no cycle; a 실행 위치 row, a 목록 item or a 부모 naming no part sets none', () => {
  const p1 = page(1).replace('|GR02|B07|B07: FCM 통로 · B07: APNs 통로|목록|F04|', '|GR02|B07|B07: FCM 통로 · B07: APNs 통로|목록|F04|\n|GR03|B03|B05·B09·B04|구성|F02|\n|GR04|B05|B03|구성|F02|\n|GR05|B02|B07·B08|실행 위치|F02|');
  const f = ofPages([p1, page(2), page(3)]);
  const w = wire([part(f, 'new:app', '물주기 앱', '|B02|'), part(f, 'new:api', '화분 API', '|B03|'), part(f, 'new:login', '로그인 검사', '|B09|', { parent: 'new:app' })]);
  const read = M.validateMapReply(structuredClone(w), f.ask, { setAside: true }), of = name => read.parts.find(x => x.name === name), ref = name => of(name)?.ref;
  assert.equal(of('일정 계산기').parent, 'new:api', 'GR03: B05 under B03');
  assert.equal(of('급수 기록 DB').parent, 'new:api', 'GR03: B04 under B03');
  assert.equal(of('로그인 검사').parent, 'new:api', 'A7: a model parent never overrides an explicit group');
  assert.equal(of('화분 API').parent, null, 'GR04 would make B03 its own ancestor: none');
  assert.equal(of('매시 틱').parent, null, 'GR01\'s 부모 names no part');
  assert.equal(of('푸시 발송기').parent, null, 'GR05 is a place (실행 위치), never a parent');
  assert.deepEqual(groupParentConflicts(M.askRecords(f.ask), read.parts), [`GR03: ${ref('로그인 검사')} → new:api (모델 부모 new:app 대신)`, `GR04: new:api → ${ref('일정 계산기')} 순환 (지도: 없음)`]);
});

test('R48 fix: a child two 구성 rows give different parents takes neither (said), a row naming its own parent among its children is said, and 참여자 or 외부 rows set no parent', () => {
  const p1 = page(1).replace('|GR02|B07|B07: FCM 통로 · B07: APNs 통로|목록|F04|', '|GR02|B07|B07: FCM 통로 · B07: APNs 통로|목록|F04|\n|GR03|B03|B05·B03|구성|F02|\n|GR04|B02|B05|구성|F02|\n|GR05|B07|B08|외부|F02|\n|GR06|B02|B01|참여자|F01|');
  const f = ofPages([p1, page(2), page(3)]);
  const read = M.validateMapReply(wire([part(f, 'new:api', '화분 API', '|B03|')]), f.ask, { setAside: true }), of = name => read.parts.find(x => x.name === name);
  assert.equal(of('일정 계산기').parent, null, 'two parents: none picked by order');
  assert.equal(of('푸시 게이트웨이').parent, null, '외부 is a boundary, not containment');
  assert.equal(of('사용자').parent, null, '참여자 is who takes part, not containment');
  const said = groupParentConflicts(M.askRecords(f.ask), read.parts);
  assert.ok(said.includes('GR03: B03 안에 자기 자신'), JSON.stringify(said));
  assert.ok(said.some(x => x.startsWith(`${of('일정 계산기').ref}: 부모 둘 `)), JSON.stringify(said));
  // 외부 confirms the boundary of a bot or service: B08 (외부 시스템) stays external, and the 외부 row is the structure a type may stand on.
  assert.equal(of('푸시 게이트웨이').type, 'external');
});

test('R48-6 the first-map bounds are the divided route\'s alone: a first-map-sized ask reads there, and a preview executor\'s job of it is refused (413) before it is kept', async () => {
  // Three pages of the 공방 예약 record with 300 long steps: past the shared 64 KiB, within the first-map bounds.
  const head = (n, prev) => `〔기록 AF5-0a0b0c0e · 쪽 ${n} · 기준 abc1234 · 앞 쪽 ${prev ?? '—'}〕 공방 예약 기록 v5 (시험 세션, 2026-11-05 12:3${n})`;
  const stepPage = (n, from) => [head(n, n - 1), table('C-STEP', Array.from({ length: 150 }, (_, k) => { const i = from + Math.floor(k / 10), s = (k % 10) + 1;
    return [`${b(i)}:S${pad(s)}`, `단계 ${pad(i)}-${pad(s)}`, `작업대 예약 기록을 읽고 회원의 대기 순서를 확인한 뒤 다음 단계로 넘긴다(시험용 긴 설명 ${pad(i)}-${pad(s)})`, `step_${i}_${s}()`, '—', '—', 'F01']; })),
    table('C-END', [['C-STEP', '끝남', `${b(from)}:S01–${b(from + 14)}:S10`, '—', '—']]), '완료 단계: 상세 완료'].join('\n');
  const first = workshop().replace(/^〔[^〕]*〕[^\n]*/, head(1));
  let p = D.createProject(); for (const t of [first, stepPage(2, 1), stepPage(3, 16)]) p = D.pasteRecord(p, t, null).project;
  p = { ...p, pasted: p.pasted.map((r, i) => ({ ...r, at: new Date(Date.UTC(2026, 10, 5, 12, i)).toISOString() })) };
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA, { records: M.MAP_FIRST_RECORDS, recordChars: M.MAP_FIRST_RECORD_CHARS, bytes: M.MAP_FIRST_BYTES, spans: M.MAP_FIRST_SPANS });
  assert.ok(new TextEncoder().encode(JSON.stringify(inp.ask)).length > M.MAP_BYTES);
  M.validateMapAsk(inp.ask, { route: 'divided' });
  assert.throws(() => M.validateMapAsk(inp.ask), /INPUT_TOO_LARGE/, 'the shared bounds by default');
  assert.equal(J.decodeMapInput(JSON.parse(JSON.stringify(J.encodeMapInput(inp)))).ask.records.length, inp.ask.records.length, 'a job may carry it');
  // A preview host's job of it: refused at binding, never kept (the executor is never asked).
  const dir = mkdtempSync(join(tmpdir(), 'r48-jobs-')), jobs = await openMapJobs({ dir });
  try {
    const used = () => { throw new Error('the executor was used'); };
    const h = createStudioHandler({ env: {}, jobs, mapExecutor: { ready: () => true, model: 'x', describe: () => ({}), prepare: used, acquire: used, call: used } });
    const wire = J.encodeMapInput(inp), id = `MJ_${crypto.randomUUID()}`, cap = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
    const binding = { entryId: 'E_r4800000-01', projectId: p.id, lifecycle: 1, seq: 1, after: inp.after, schemaVersion: inp.ask.schemaVersion, prompt: await mapPromptId(), model: 'x', askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
    const res = await h(new Request('http://127.0.0.1/api/studio/jobs', { method: 'POST', headers: { 'x-agentflow-request': '1', 'x-studio-operation': cap, 'content-type': 'application/json' }, body: JSON.stringify({ version: 'map-job.1', id, binding, input: wire }) }));
    assert.equal(res.status, 413, JSON.stringify(await res.clone().json()));
    assert.equal((await res.json()).error?.code ?? 'INPUT_TOO_LARGE', 'INPUT_TOO_LARGE');
  } finally { await jobs.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('R48-7 the v5.1 ask names the role words the app reads as a type as examples (each one the table maps, with the structure A7 asks), allows a short own role, and a setting steering a step, within about 11.6K', () => {
  const ask = R.recordAskV5('AF5-12345678');
  assert.ok(ask.startsWith('[AgentFlow 기록 요청 v5.1]') && ask.length <= 11600, String(ask.length));
  assert.ok(ask.includes('앱이 유형으로 읽는 말의 예: 처리는 반복·실행 조정 / 수집 / AI 판단 / 화면 / 외부 호출 / 계산(변환·검증·측정), 참여는 사람(소유자·메인테이너·기여자) / 봇 / 외부 시스템 / AI 세션(제품 안의 것). 맞는 말이 없으면 짧은 자기 역할을 쓴다(앱은 그대로 둔다).'));
  assert.ok(ask.includes('「(기본값: 키=값)」'));
  const S = { ...T.NO_STRUCTURE, loopOwner: true, boundary: true };
  const words = { 처리: [['반복', 'loop'], ['실행 조정', 'loop'], ['수집', 'collector'], ['측정', 'compute'], ['AI 판단', 'ai'], ['화면', 'screen'], ['외부 호출', 'actor'], ['계산', 'compute'], ['변환', 'compute'], ['검증', 'compute']],
    참여: [['사람', 'person'], ['소유자', 'person'], ['메인테이너', 'person'], ['기여자', 'person'], ['봇', 'external'], ['외부 시스템', 'external'], ['AI 세션', 'session']] };
  for (const [family, list] of Object.entries(words)) for (const [w, type] of list) assert.equal(T.familyType(`${family} · ${w}`, S).type, type, `${family} · ${w}`);
  // A short own role the table does not know is kept as written (the family; no type, said as unmapped).
  assert.deepEqual(T.familyType('처리 · 대기열 정리'), { type: null, unmapped: true, held: null });
  // Nothing else of the ask changed: the same tables, the same header rows.
  for (const id of [...T.Q1_TABLES, ...T.Q2_TABLES]) assert.ok(ask.includes(`\n${T.headerLine(T.V5_TABLE_DEFS.get(id))}\n`) || !T.V5_TABLE_DEFS.get(id).columns.length, id);
});

test('R48 contract: every reading .48 makes is stored as map-reading.19 exactly (types, grades, dates, parents, program steps, blanked cells, the 48 lines)', () => {
  const meta = (id, n) => ({ id, at: '2026-11-05T05:00:00.000Z', model: 'stub', prompt: 'm6-000000000048', hash: n.repeat(64) });
  const p1 = page(1).replace('|GR02|B07|B07: FCM 통로 · B07: APNs 통로|목록|F04|', '|GR02|B07|B07: FCM 통로 · B07: APNs 통로|목록|F04|\n|GR03|B03|B05·B04|구성|F02|');
  const p2 = page(2).replace('|CD01|B07|now in quietHours|아침 7시로 미룸|발송|실행 시|F04|', `|CD01|B07|now in quietHours|아침 7시로 미룸|${'발송하고 다음 매시 틱까지 기다린 뒤 다시 계산한다 '.repeat(3).trim()}|실행 시|F04|`);
  const f = ofPages([p1, p2, page(3)]);
  const w = wire([part(f, 'new:api', '화분 API', '|B03|'), part(f, 'new:push', '푸시 발송기', '|B07|푸시', { claims: [claim(f, 's1', '|CH01|', { topic: 'change', evidence: null, when: '2026-08-02' }), claim(f, 's2', '|RU01|', { topic: 'rule', kind: 'want', evidence: null, when: null })],
    conditions: [{ when: 'now in quietHours', then: '아침 7시로 미룸', else: '발송하고 다음 매시 틱까지 기다린 뒤 다시 계산한다 '.repeat(3).trim(), at: f.at('|CD01|') }] })]);
  for (const [g, wr, name] of [[f, w, '물주기'], [ofPages([workshop()]), null, '공방']]) {
    const wire0 = wr ?? wire([part(g, 'new:p02', '공방 부분 02', '|B02|', { steps: [1, 2, 3, 28, 29, 30].map(k => ({ name: k === 1 ? '받기' : `단계 ${pad(k)}`, does: null, uses: [], at: g.at(`|${b(2)}:S${pad(k)}|`) })) })]);
    const read = M.validateMapReply(structuredClone(wire0), g.ask, { setAside: true });
    const applied = M.applyReading(g.project, g.input, read, meta(`R_record48_${name === '공방' ? 'b' : 'a'}`, name === '공방' ? '8' : '4'));
    assert.equal(applied.reading.version, 'map-reading.20', name);
    assert.deepEqual(validateProject(applied.project), applied.project, name);
  }
});

test('R48-8 a rule a code device keeps (지키는 장치 코드 or 검사, with a file or run cite) describes what the code does; a rule people keep stays a want', () => {
  const p2 = page(2).replace('|RU01|B07|푸시 토큰을 기록하지 않음|메인테이너·2026-08|코드|server/push/redact.ts|F04|',
    '|RU01|B07|푸시 토큰을 기록하지 않음|메인테이너·2026-08|코드|server/push/redact.ts|F04|\n|RU02|B07|밤에는 사람이 발송을 멈춤|소유자·2026-09|사람|운영자|F04|\n|RU03|B07|발송 전 시험 통과|메인테이너·2026-10|검사+사람|ci.yml|추정|');
  const f = ofPages([page(1), p2, page(3)]);
  const w = wire([part(f, 'new:push', '푸시 발송기', '|B07|푸시', { claims: ['RU01', 'RU02', 'RU03'].map((id, k) => claim(f, `s${k + 1}`, `|${id}|`, { topic: 'rule', kind: 'want', evidence: null, when: null })) })]);
  const read = M.validateMapReply(structuredClone(w), f.ask, { setAside: true }), kind = key => read.parts.flatMap(x => x.claims).find(x => x.key === key)?.kind;
  assert.deepEqual([kind('s1'), kind('s2'), kind('s3')], ['describes', 'want', 'want'], 'code with a file cite describes; people keep RU02; RU03 cites only a guess');
});

/* ---------- Recipe .48 review fixes (B1, B2) and the A7 points (lines by row, blanking, the ledger's two causes) ---------- */
const FILES = new Map([['F01', { id: 'F01', path: 'a.ts', read: 'read' }], ['F02', { id: 'F02', path: 'b.ts', read: 'read' }], ['F03', { id: 'F03', path: 'c.ts', read: 'unread' }]]);
const LEDGER = { files: FILES, evidence: new Map([['E01', { id: 'E01', grade: 'run', source: 'rg x', place: null, quote: null }], ['E49', { id: 'E49', grade: 'report', source: 'PR #1', place: null, quote: null }]]) };

test('R48 fix B1: 「추정(…)」 is one guess cite read before the 「+」 split; a file the cell marks unread is cited unknown; each cite keeps its own grade', () => {
  const grades = cell => T.readCites(cell, LEDGER).cites.map(x => [x.ref, x.grade]);
  assert.deepEqual(grades('추정(E01+F01)'), [['추정', 'guess']], 'the IDs inside the guess are what it rests on, never cites');
  assert.deepEqual(T.readCites('추정(E49+F01+F02)', LEDGER).cites[0].source, 'E49+F01+F02');
  assert.deepEqual(grades('추정(E49+F01) + F02'), [['추정', 'guess'], ['F02', 'file']]);
  assert.deepEqual(grades('F01+F02(안 읽음)'), [['F01', 'file'], ['F02', 'unknown']]);
  assert.deepEqual(T.readCites('F01+F02(안 읽음)', LEDGER).problems.map(p => p.kind), ['cite-unread']);
  assert.deepEqual(grades('F01+F03'), [['F01', 'file'], ['F03', 'unknown']], 'the ledger\'s own 안 읽음');
});

test('R48 fix B1: a row\'s grade is none (no cite), unresolved (a cite the app cannot read), mixed (graded beside guess or unknown: no grade) or its lowest grade', () => {
  const row = cell => { const got = T.readCites(cell, LEDGER); return RR.rowGrade({ cites: got.cites, citeProblems: got.problems.map(p => p.kind) }); };
  assert.deepEqual(row(''), { state: 'none', grade: null });
  assert.deepEqual(row('어딘가의 글'), { state: 'unresolved', grade: null });
  assert.deepEqual(row('E07'), { state: 'unresolved', grade: null }, 'an E neither ledger holds');
  assert.deepEqual(row('추정(E49+F01)'), { state: 'graded', grade: 'guess' });
  assert.deepEqual(row('F01+F02(안 읽음)'), { state: 'mixed', grade: null });
  assert.deepEqual(row('추정 + F01'), { state: 'mixed', grade: null });
  assert.deepEqual(row('F01+E49'), { state: 'graded', grade: 'report' }, 'the lowest of graded cites');
  assert.deepEqual(row('E01'), { state: 'graded', grade: 'run' });
  assert.deepEqual(row('F01+E01'), { state: 'graded', grade: 'file' });
  assert.deepEqual(row('모름 + 추정'), { state: 'graded', grade: 'unknown' });
});

test('R48 fix B1: on the read map the ledger only lowers or confirms: a guess row keeps a guess (never file), a mixed row sets nothing, an unconfirmed claim takes no report grade, and the two causes stay apart', () => {
  const p2 = page(2).replace('|DB01|B06|틱이 여러 인스턴스에서 겹쳐 도는지|추정(F03)|', '|DB01|B06|틱이 여러 인스턴스에서 겹쳐 도는지|추정(E04+F03)|')
    .replace('|RU01|B07|푸시 토큰을 기록하지 않음|메인테이너·2026-08|코드|server/push/redact.ts|F04|', '|RU01|B07|푸시 토큰을 기록하지 않음|메인테이너·2026-08|코드|server/push/redact.ts|F04+F05(안 읽음)|')
    .replace('|IS01|B05|시간대 바뀐 사용자 일정이 하루 밀림|이슈 #19|E05|', '|IS01|B05|시간대 바뀐 사용자 일정이 하루 밀림|이슈 #19|—|');
  const f = ofPages([page(1), p2, page(3)]);
  const w = wire([part(f, 'new:tick', '매시 틱', '|B06|', { claims: [claim(f, 's21', '|DB01|', { topic: 'unknown', kind: 'open', evidence: 'guess' }), claim(f, 's22', '|DB01|', { topic: 'unknown', kind: 'open', evidence: 'file', text: '원문 행을 옮긴다(g2) 두 번째.' })] }),
    part(f, 'new:push', '푸시 발송기', '|B07|푸시', { claims: [claim(f, 's23', '|RU01|', { topic: 'rule', kind: 'describes', evidence: null }), claim(f, 's24', '|CH02|', { topic: 'change', evidence: null, text: '무엇을 뺐는지는 확인하지 못했다.' })] }),
    part(f, 'new:calc', '일정 계산기', '|B05|', { claims: [claim(f, 's25', '|IS01|', { topic: 'defect', evidence: null })] })]);
  const read = M.validateMapReply(structuredClone(w), f.ask, { setAside: true }), c = key => read.parts.flatMap(x => x.claims).find(x => x.key === key);
  assert.equal(c('s21').evidence, 'guess', 'IS03-shaped: the guess stays a guess');
  assert.equal(c('s22'), undefined, 'a file grade on a guess row is past its cites: left out (cite-grade), never kept as file');
  assert.equal(c('s23').evidence, null, 'F04 beside an unread F05: no grade');
  assert.equal(c('s24').evidence, null, 'a claim that says it could not confirm takes no report grade from its row');
  assert.equal(c('s25').evidence, null);
  const gaps = B.ledgerGaps(read);
  assert.deepEqual(gaps.none, ['new:calc IS01']);
  assert.deepEqual(gaps.unresolved, ['new:push RU01 섞임']);
});

test('R48 fix B2: a claim\'s when the row writes word for word stays; the row\'s date phrase comes whole (pairs, ranges, qualifiers) only where the when is missing or not in the row', () => {
  assert.deepEqual(['2024-01-26 / 2024-02-27', '2023-07-13 – 2026-09-26', '2021-03-12~2022-06-20', '2026-10-27 이후', '2026-10-05(최근 2개)', '메인테이너·2026-08', '모름', '2026-01경 · PR #12 병합 뒤 다시 손본 날짜는 기록에 없음 (작성자 확인 필요)'].map(RR.datePhrase),
    ['2024-01-26 / 2024-02-27', '2023-07-13 – 2026-09-26', '2021-03-12~2022-06-20', '2026-10-27 이후', '2026-10-05(최근 2개)', '2026-08', null, '2026-01경']);
  const p2 = page(2).replace('|CH01|2026-09-02|', '|CH01|2026-08-02 / 2026-08-09|').replace('|IS01|B05|시간대 바뀐 사용자 일정이 하루 밀림|이슈 #19|E05|', '|IS01|B05|시간대 바뀐 사용자 일정이 하루 밀림|2026-10-27 이후|E05|');
  const f = ofPages([page(1), p2, page(3)]);
  const w = wire([part(f, 'new:push', '푸시 발송기', '|B07|푸시', { claims: [claim(f, 's31', '|CH01|', { topic: 'change', evidence: null, when: '2026-08-02 / 2026-08-09' }), claim(f, 's32', '|CH01|', { topic: 'change', evidence: null, when: null, text: '원문 행을 옮긴다(w2) 둘째.' }),
    claim(f, 's33', '|CH01|', { topic: 'change', evidence: null, when: '2026-08-02', text: '원문 행을 옮긴다(w3) 셋째.' })] }),
    part(f, 'new:calc', '일정 계산기', '|B05|', { claims: [claim(f, 's34', '|IS01|', { topic: 'defect', evidence: null, when: '2026-10-27' }), claim(f, 's35', '|IS01|', { topic: 'defect', evidence: null, when: '2026-11-01', text: '원문 행을 옮긴다(w5) 다섯째.' })] })]);
  const read = M.validateMapReply(structuredClone(w), f.ask, { setAside: true }), c = key => read.parts.flatMap(x => x.claims).find(x => x.key === key)?.when;
  assert.deepEqual([c('s31'), c('s32'), c('s33'), c('s34'), c('s35')], ['2026-08-02 / 2026-08-09', '2026-08-02 / 2026-08-09', '2026-08-02', '2026-10-27', '2026-10-27 이후'],
    'the merge date is never cut; a when the row writes stays as the model gave it; one the row does not write takes the row\'s phrase whole');
});

test('R48 fix (A7): each C-LINK row of a v5 record is kept, held or changed by its row ID (line-rows), never a silent zero', () => {
  const f = ofPages([workshop()]);
  const read = M.validateMapReply(wire([part(f, 'new:p01', '공방 부분 01', '|B01|'), part(f, 'new:p02', '공방 부분 02', '|B02|')]), f.ask, { setAside: true });
  const rows = B.recordLineRows(read, f.ask);
  assert.equal(rows.kept.length + rows.held.length + rows.changed.length, 50);
  assert.deepEqual(rows.held, ['LN49', 'LN50']);
  // A stored hand-over the cap left its writer half only (B(k) → the store, never on to B(k+10)) is changed, not kept.
  assert.deepEqual(rows.changed, Array.from({ length: 10 }, (_, k) => `LN${pad(k + 1)}`));
});

test('R48 fix (A7): a meaning field is never blanked: an overlong 하는 일 with a negation holds the step, a rule\'s broken scope holds the rule; a blanked 거짓이면 reads as incomplete in the pane', async () => {
  const f = ofPages([page(1), page(2), page(3)]), longNot = '화분의 마지막 급수 기록을 읽되 토큰이 없으면 저장하지 않는다 '.repeat(4).trim();
  assert.ok(longNot.length > 120);
  const w = wire([part(f, 'new:calc', '일정 계산기', '|B05|', { steps: [{ name: '기록 읽기', does: longNot, uses: [], at: f.at('|B05:S01|') }] }),
    part(f, 'new:push', '푸시 발송기', '|B07|푸시', { claims: [claim(f, 's41', '|RU01|', { topic: 'rule', kind: 'describes', evidence: null, scope: 'step' })] })]);
  const read = M.validateMapReply(structuredClone(w), f.ask, { setAside: true }), said = M.readingExclusions(read).map(x => [x.path, x.category]);
  assert.ok(!(read.parts.find(x => x.ref === 'new:calc').steps ?? []).some(s => s.name === '기록 읽기' && s.does === null), 'never kept with its negation blanked');
  assert.ok(said.some(([p, c]) => c === 'step-held' && p === 'parts[0].steps[0]'), JSON.stringify(said));
  assert.ok(!read.parts.flatMap(x => x.claims).some(x => x.key === 's41'), 'a step scope with no name is held, never read as the whole part\'s');
  assert.ok(said.some(([p, c]) => c === 'scope-held' && p === 'parts[1].claims[0]'), JSON.stringify(said));
  const SV = await import('../dist/public/client/steps-view.js');
  const cond = { when: 'now in quietHours', then: '아침 7시로 미룸', else: null, quote: { record: 'r', quote: 'q', from: 10, to: 30 } };
  assert.ok(SV.elseBlanked(cond.quote, [{ category: 'condition-else', record: 'r', from: 12, to: 28 }]));
  assert.ok(!SV.elseBlanked(cond.quote, [{ category: 'condition-else', record: 'r', from: 40, to: 50 }]));
  assert.deepEqual(SV.conditionLines({ ...cond, incomplete: true }), ['조건 now in quietHours → 아침 7시로 미룸', `아니면 → ${SV.ELSE_BLANKED}`]);
  assert.deepEqual(SV.conditionLines(cond), ['조건 now in quietHours → 아침 7시로 미룸'], 'a condition the record wrote no else for stays as it was');
});

test('R48 fix (review N4): the step cut keeps every reply step on a kept row (two steps the reply wrote on one row both stay), within the bound', () => {
  const f = ofPages([workshop()]), step = (k, name) => ({ name: name ?? (k === 1 ? '받기' : `단계 ${pad(k)}`), does: `예약 처리 ${pad(k)}`, uses: [`step${k}()`], at: f.at(`|${b(2)}:S${pad(k)}|`) });
  const firstLast = [...Array.from({ length: 12 }, (_, k) => step(k + 1)), step(12, '단계 12 확인'), ...Array.from({ length: 11 }, (_, k) => step(k + 20))];
  const steps = M.validateMapReply(wire([part(f, 'new:p02', '공방 부분 02', '|B02|', { steps: firstLast })]), f.ask, { setAside: true }).parts.find(x => x.ref === 'new:p02').steps;
  assert.equal(steps.length, 24);
  assert.ok(steps.some(s => s.name === '단계 12') && steps.some(s => s.name === '단계 12 확인'), 'both reply steps of S12 stay');
  for (let k = 10; k <= 20; k++) assert.ok(steps.some(s => s.name === `단계 ${pad(k)}`), `loop body S${pad(k)} kept`);
});
