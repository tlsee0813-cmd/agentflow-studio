// 기록 요청 v4.1 (RECORD_ASKS_V4_KO.md 3.1–3.4, 4.8, 4.9): the request, the continuation the app builds from a pasted record's C-DONE, and
// the paste check of a v4 answer, on the fictional 책갈피 정리기 record (fixtures/record43).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../dist/public/shared/report-ask.js';
import * as T from '../dist/public/shared/record-table.js';
import { chunk } from './fixtures/record43/wire.mjs';

test('ASK-v4-1 the request names the 23 common tables and 19 supplementary tables with their header rows from the parser\'s own table definitions, the five sentences against invention, and the record ID twice', () => {
  const ask = R.recordAskV4('AF4-12345678');
  assert.ok(ask.startsWith('[AgentFlow 기록 요청 v4.1]'));
  assert.equal(T.V4_TABLES.length, 23); assert.equal(T.PROFILE_TABLES.length, 19);
  for (const t of T.V4_TABLES) { assert.ok(ask.includes(`\n${t.id} ${t.title}\n`), t.id); if (t.columns.length) assert.ok(ask.includes(`\n${T.headerLine(t)}\n`), t.id); }
  for (const t of T.PROFILE_TABLES) assert.ok(ask.includes(`\n${t.id} ${t.title} (${t.rows}행): ${t.columns.slice(0, -2).join(' | ')} — `), t.id);
  for (const s of R.NO_INVENTION) assert.ok(ask.includes(s));
  assert.equal(ask.split('AF4-12345678').length - 1, 2);
  assert.ok(R.recordAskV4().includes('기록 ID: {기록 ID}'));
  assert.match(R.newRecordId(), /^AF4-[0-9a-f]{8}$/);
  // v4.1: the 12,000 cap stays (no ~9,000 target), the counters, [=], compact pipes, more than one continuation, the focus line's 고른 보충 표 ID.
  assert.ok(ask.includes('덩이마다 12,000자를 넘기지 마') && !ask.includes('9,000'));
  assert.ok(ask.includes('LC_ALL=C.UTF-8 wc -m') && ask.includes('[=]') && ask.includes('「|a|b|」') && ask.includes('이어쓰기는 여러 번이어도 괜찮다') && ask.includes('고른 보충 표 ID'));
  assert.ok(ask.includes('릴리스 없음') && ask.includes('이슈 본문 미확인(#번호)') && ask.includes('단계 미기록(함수 이름)') && ask.includes(' 봇 /'));
  // Every row the request asks for parses: the parser knows each header row as written.
  for (const t of [...T.V4_TABLES, ...T.PROFILE_TABLES]) if (t.columns.length) {
    const rec = T.readRecordTables(`〔기록 AF4-1 · 덩이 1 · 기준 abc1234〕 x 기록 v4\n${t.id} ${t.title}\n${T.headerLine(t)}\n|${'---|'.repeat(t.columns.length)}`);
    assert.deepEqual(rec.diagnostics, [], t.id);
  }
});

test('ASK-v4-2 neither the request nor a continuation carries a word of the eight validation repositories or their answer tables', () => {
  const words = ['nanoGPT', 'nanogpt', 'hyperfine', 'axios', 'umami', 'pocketbase', 'dagu', 'gpt-researcher', 'shapez', '21종', '24개', '/api/send', 'iter', '프레임마다', 'Agent', 'timer', 'schema_version', 'mergeMap', '&& false', 'Karpathy', 'warmup'];
  const texts = [R.recordAskV4(), R.continuationAsk([chunk(1), chunk(2)]).text, R.continuationAsk([chunk(1)]).text];
  // A Latin word as a word (the request's own 「[AgentFlow …]」 header is no 「Agent」).
  const has = (text, w) => /^[A-Za-z]+$/.test(w) ? new RegExp(`(?<![A-Za-z])${w}(?![A-Za-z])`).test(text) : text.includes(w);
  for (const text of texts) for (const w of words) assert.ok(!has(text, w), w);
});

test('ASK-v4-3 the continuation: the tables C-DONE leaves (일부 작성, 분량상 이월) in chunk then table order with their header rows and notes, the next IDs, the same chunk head form, within 8,000', () => {
  const plan = R.continuationAsk([chunk(1), chunk(2)]);
  assert.deepEqual([plan.recordId, plan.basis, plan.project, plan.chunk], ['AF4-0c0ffee1', '9a8b7c6', '책갈피 정리기', 3]);
  assert.deepEqual(plan.tables.map(t => [t.id, t.state, t.remaining]), [['C-CHANGE', '일부 작성', '2026-09 이전 변화'], ['C-STEP', '일부 작성', 'B06의 나머지 단계'], ['P5-03', '분량상 이월', '표 전체']]);
  assert.equal(plan.next, '부분 B10 · 산출물 D04 · 변형 X04 · 진입 N04 · 외부 계약 K02 · 단계·반복은 부분마다 그다음 번호 · 보충 표는 「표 ID.{다음}」');
  assert.ok(plan.text.startsWith('[AgentFlow 기록 이어쓰기 요청 v4.1 · 기록 AF4-0c0ffee1 · 덩이 3]'));
  assert.ok(plan.text.includes('「〔기록 AF4-0c0ffee1 · 덩이 3 · 기준 9a8b7c6〕 책갈피 정리기 기록 v4 이어서 (쓴 세션, 날짜·시각)」'));
  assert.ok(plan.text.includes(`C-STEP 안의 단계 — 앞 덩이: 일부 작성 · 실은 범위: 중심 부분 B03·B06 · 이번에 쓸 범위: B06의 나머지 단계\n${T.headerLine(T.TABLE_DEFS.get('C-STEP'))}\n${R.TABLE_NOTES['C-STEP']}`));
  assert.ok(plan.text.includes('P5-03 실패·복구 (5행). 재시도·재개·보상·재실행을 가르고'));
  for (const s of R.NO_INVENTION) assert.ok(plan.text.includes(s));
  assert.ok(plan.text.length <= R.CONTINUATION_CHARS, String(plan.text.length));
  // A chunk the session answered: its own chunk head reads, and nothing it marks done is asked again.
  const three = ['〔기록 AF4-0c0ffee1 · 덩이 3 · 기준 9a8b7c6〕 책갈피 정리기 기록 v4 이어서 (시험 세션, 2026-11-05 10:00)', '경로 약속: @9a8b7c6 · S = src · D = data',
    'C-DONE 완료표', '| 표 ID | 작성 상태 | 수록 범위 | 남은 범위 |', '|---|---|---|---|', '| C-CHANGE | 작성 완료 | 2026-09 이전 | — |', '| C-STEP | 작성 완료 | B06 | — |', '| P5-03 | 작성 완료 | 2행 | 실패 처리 하나 더(S/sync.js) |'].join('\n');
  const after = R.continuationAsk([chunk(1), chunk(2), three]);
  assert.deepEqual([after.chunk, after.tables.map(t => [t.id, t.state, t.remaining])], [4, [['P5-03', '작성 완료', '실패 처리 하나 더(S/sync.js)']]], 'v4.1: 작성 완료 with a 남은 범위 continues');
});

test('ASK-v4-4 a missing chunk 2 asks for chunk 2 whole; past chunk 5, or with nothing left, no continuation', () => {
  const only = R.continuationAsk([chunk(1)]);
  assert.equal(only.chunk, 2);
  assert.deepEqual(only.tables.map(t => t.id), ['C-CHANGE', 'C-DATA', 'C-DESIGN', 'C-STEP', 'C-LOOP', 'C-COND', 'C-VARIANT', 'C-ENTRY', 'C-CONTRACT', 'C-FILES', 'P2-02', 'P4-02']);
  assert.equal(R.continuationAsk(['한 줄 메모']), null);
  const five = chunk(2).replace('덩이 2 ·', '덩이 5 ·');
  assert.equal(R.continuationAsk([chunk(1), five]), null);
});

test('ASK-v4-5 the paste check of a v4 answer: chunks split at their heads and counted in characters (never bytes), a missing chunk 2 and C-DONE flagged, row cells and passes read past the fixed value words', () => {
  const both = R.checkReport(`${chunk(1)}\n\n${chunk(2)}`);
  assert.equal(both.kind, 'record-v4');
  assert.deepEqual(both.chunks.map(c => [c.recordId, c.chunk, c.chars, c.limit, c.done, c.badRows]), [['AF4-0c0ffee1', 1, chunk(1).trimEnd().length, 12000, true, 0], ['AF4-0c0ffee1', 2, chunk(2).trimEnd().length, 12000, true, 0]]);
  assert.deepEqual([both.missing, both.cut, both.passesUnrun], [[], [], 0], '작성 완료 in C-DONE is no pass');
  const one = R.checkReport(chunk(1));
  assert.deepEqual(one.missing, ['덩이 2']);
  assert.ok(R.reportCheckLine(one).text.startsWith('기록 v4 점검 · 덩이 1개 · 1:'));
  const long = R.checkReport(`${chunk(1)}\n${'| 사용자 | 길게 [추정] |\n'.repeat(700)}`);
  assert.equal(long.cut.length, 1);
  const broken = R.checkReport(chunk(1).replace('| 정리 엔진 | grep', '| 정리 엔진 | a | b | grep'));
  assert.equal(broken.chunks[0].badRows, 1);
  assert.ok(R.reportCheckLine(broken).again.includes('&#124;'));
  // A v3 status report with a 경로 약속 line is still a status report (v4 chunks all have one).
  assert.equal(R.checkReport(['시험 현황 보고서 (v3 표 형식, 세션, 2026-11-05)', '경로 약속: S = src', '2. 부분', '| 이름 | 하는 일 | 꼬리표 |', '|---|---|---|',
    ...Array.from({ length: 6 }, (_, i) => `| 부분${i} | 일을 한다 길게 | [추정] |`)].join('\n')).kind, 'status');
});
