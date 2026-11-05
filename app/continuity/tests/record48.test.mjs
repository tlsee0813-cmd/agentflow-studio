// Recipe .48 (from the blind three-way judging of the .47 maps): the program's half of a v5 first map on fictional records — the
// 물주기 record (fixtures/record45) with its names and cells changed where a case needs it, and a 공방 예약 record of 30 parts and 50
// connection rows written here. Lines on rows whose part name holds 「·」 stand; the connection diagnostic names parts, not B IDs; the
// record's lines fit the 48 first-map lines one row at a time and model-only lines go first; a part's type comes from its 표현군·역할 by
// a fixed table (never invented); a claim's grade and date come from its own row's cites and cells. No model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as T from '../dist/public/shared/record-table.js';
import { studioView } from '../dist/public/shared/studio.js';
import { groupParentConflicts } from '../dist/public/shared/record-reading.js';
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
    table('C-STEP', [[`${b(2)}:S01`, '받기', '예약을 받는다', 'take()', '—', '—', 'F01']]),
    table('C-DATA', [['D01', '예약 행(bookings.db)', '저장', 'member, bench, at', b(1), b(11), 'db/bookings (덧붙임)', 'F01']]),
    table('C-END', [['C-PART', '끝남', 'B01–B30', '—', '—'], ['C-LINK', '끝남', 'LN01–LN50', '—', '—'], ['C-STEP', '끝남', 'B02:S01', '—', '—'], ['C-DATA', '끝남', 'D01', '—', '—']]),
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

test('R48-1 a part\'s type comes from its 표현군·역할 by the fixed table; a family whose role it does not map gives none and is said quietly; 미정 gives nothing', () => {
  const cases = [['저장 · 행 파일', 'store'], ['저장', 'store'], ['촉발 · 매일 일정', 'timer'], ['촉발 · 5분 주기 신호', 'timer'], ['촉발 · 배포 자동화', 'automation'], ['촉발 · 창 닫힘 신호', null],
    ['관문 · 인증', 'compute'], ['관문 · 사람 승인', 'person'], ['참여 · 회원', 'person'], ['참여 · 창고 문', null], ['참여 · 방문자', 'person'], ['참여 · 메인테이너', 'person'], ['참여 · 의존성 갱신 봇', 'external'],
    ['참여 · 결제 서비스', 'external'], ['참여 · 사용자 코드', 'external'], ['참여 · AI 세션', 'session'], ['처리 · 반복 실행 조정', 'loop'], ['처리 · 대기열 스케줄', 'loop'],
    ['처리 · 센서 값 수집', 'collector'], ['처리 · 속도 측정', 'collector'], ['처리 · AI 판단', 'ai'], ['처리 · LLM 요약', 'ai'], ['처리 · 목록 화면', 'screen'], ['처리 · 외부 호출', 'actor'],
    ['처리 · 작업 실행기', 'actor'], ['처리 · 값 변환', 'compute'], ['처리 · 입력 검증', 'compute'], ['처리 · 요청 처리', null], ['미정 · 서로 다른 역할 혼재(처리·저장)', null], ['그 밖', null]];
  for (const [cell, type] of cases) assert.equal(T.familyType(cell).type, type, cell);
  assert.deepEqual([T.familyType('처리 · 요청 처리').unmapped, T.familyType('미정 · 대상 범위 불명확').unmapped, T.familyType('그 밖').unmapped], [true, false, false]);
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
  assert.deepEqual([c('s3').evidence, c('s3').when], ['file', '실행 시'], 'a when the row writes stays');
  assert.deepEqual([c('s4').evidence, c('s4').when], ['report', null], 'a date the row does not write is not kept');
  assert.deepEqual([c('s5').evidence, c('s5').when], ['guess', null], 'a row citing only 추정 is a guess');
  // The cite-grade guard stands: a run-grade claim on a row citing a run E is kept as run; one past its row's cites is still left out.
  assert.equal(c('s6').evidence, 'run');
  const past = wire([part(f, 'new:push', '푸시 발송기', '|B07|푸시', { claims: [claim(f, 's7', '|RU01|', { topic: 'rule', kind: 'describes', evidence: 'run' })] })]);
  const r2 = M.validateMapReply(structuredClone(past), f.ask, { setAside: true });
  assert.ok(!r2.parts.flatMap(x => x.claims).some(x => x.key === 's7') && M.readingExclusions(r2).some(x => x.category === 'cite-grade'));
});

test('R48-5 a C-GROUP row whose 부모 is a part sets its children\'s parent; a parent the model gave is kept and said; no cycle; a 목록 row or a 부모 naming no part sets none', () => {
  const p1 = page(1).replace('|GR02|B07|B07: FCM 통로 · B07: APNs 통로|목록|F04|', '|GR02|B07|B07: FCM 통로 · B07: APNs 통로|목록|F04|\n|GR03|B03|B05·B09·B04|구성|F02|\n|GR04|B05|B03|구성|F02|');
  const f = ofPages([p1, page(2), page(3)]);
  const w = wire([part(f, 'new:app', '물주기 앱', '|B02|'), part(f, 'new:api', '화분 API', '|B03|'), part(f, 'new:login', '로그인 검사', '|B09|', { parent: 'new:app' })]);
  const read = M.validateMapReply(structuredClone(w), f.ask, { setAside: true }), of = name => read.parts.find(x => x.name === name), ref = name => of(name)?.ref;
  assert.equal(of('일정 계산기').parent, 'new:api', 'GR03: B05 under B03');
  assert.equal(of('급수 기록 DB').parent, 'new:api', 'GR03: B04 under B03');
  assert.equal(of('로그인 검사').parent, 'new:app', 'the model\'s own parent stays');
  assert.equal(of('화분 API').parent, null, 'GR04 would make B03 its own ancestor: none');
  assert.equal(of('매시 틱').parent, null, 'GR01\'s 부모 names no part');
  assert.equal(of('푸시 발송기').parent, null);
  assert.deepEqual(groupParentConflicts(M.askRecords(f.ask), read.parts), [`GR03: ${ref('로그인 검사')} → new:api (지도: new:app)`, `GR04: new:api → ${ref('일정 계산기')} (지도: 없음)`]);
});

test('R48-8 a rule a code device keeps (지키는 장치 코드 or 검사, with a file or run cite) describes what the code does; a rule people keep stays a want', () => {
  const p2 = page(2).replace('|RU01|B07|푸시 토큰을 기록하지 않음|메인테이너·2026-08|코드|server/push/redact.ts|F04|',
    '|RU01|B07|푸시 토큰을 기록하지 않음|메인테이너·2026-08|코드|server/push/redact.ts|F04|\n|RU02|B07|밤에는 사람이 발송을 멈춤|소유자·2026-09|사람|운영자|F04|\n|RU03|B07|발송 전 시험 통과|메인테이너·2026-10|검사+사람|ci.yml|추정|');
  const f = ofPages([page(1), p2, page(3)]);
  const w = wire([part(f, 'new:push', '푸시 발송기', '|B07|푸시', { claims: ['RU01', 'RU02', 'RU03'].map((id, k) => claim(f, `s${k + 1}`, `|${id}|`, { topic: 'rule', kind: 'want', evidence: null, when: null })) })]);
  const read = M.validateMapReply(structuredClone(w), f.ask, { setAside: true }), kind = key => read.parts.flatMap(x => x.claims).find(x => x.key === key)?.kind;
  assert.deepEqual([kind('s1'), kind('s2'), kind('s3')], ['describes', 'want', 'want'], 'code with a file cite describes; people keep RU02; RU03 cites only a guess');
});
