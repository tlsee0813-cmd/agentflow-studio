// Recipe .43 (RECORD_ASKS_V4_KO.md 4.2, 4.9): the one table reader, on small neutral records written for this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/public/shared/record-table.js';
import * as M from '../dist/public/shared/map-reading.js';

test('.43 splitCells: 「&#124;」 and 「\\|」 stay inside their cell (read as 「|」), each cell keeps where it is written; backticks protect nothing', () => {
  const line = '| a &#124;&#124; b | c \\| d | `x|y` |';
  const cells = T.splitCells(line, 100);
  assert.deepEqual(cells.map(c => c.text), ['a || b', 'c | d', '`x', 'y`']);
  assert.deepEqual(cells.map(c => line.slice(c.from - 100, c.to - 100)), ['a &#124;&#124; b', 'c \\| d', '`x', 'y`']);
  assert.deepEqual(M.tableCells('| p | q \\| r |'), ['p', 'q | r']);
  assert.deepEqual(T.cellTexts('|a|b|'), ['a', 'b']);
});

test('.43 rowCells: a v3 「||」 that split a cell is joined again to fit the header; a single 「|」 is never joined (the row is no data, row-cells)', () => {
  const got = T.rowCells('| 엔진 | !ok || retry | 거부 | 다음 |', 0, 4);
  assert.deepEqual([got.cells.map(c => c.text), got.rejoined, got.over], [['엔진', '!ok || retry', '거부', '다음'], 1, false]);
  assert.deepEqual(T.rowCells('| 엔진 | %h | %s | 거부 | 다음 |', 0, 4).over, true);
  const v3 = ['설계 기록 v1 (시험)', '5. 조건·거부·분기', '| 부분 이름 | 조건 | 참이면 | 거짓이면 | 꼬리표 |', '|---|---|---|---|---|',
    '| 엔진 | !a || b | 거부 | 다음 | [파일: x] |', "| 엔진 | log '%h | %s' | 기록 | 다음 | [파일: x] | 남는 칸 |"].join('\n');
  const t = T.readRecordTables(v3);
  assert.deepEqual(t.byId.get('C-COND')[0].rows.map(r => r.byColumn['조건']), ['!a || b']);
  assert.deepEqual(t.diagnostics.map(d => d.category), ['row-cells']);
});

test('.43 table IDs: a v4 title line keys its table; 「없음:」 in place of a header; an unknown table and column are kept with diagnostics, a left-out column named', () => {
  const v4 = ['〔기록 AF4-00000001 · 덩이 1 · 기준 abc1234〕 시험 도구 기록 v4 (세션, 2026-11-05)', '경로 약속: @abc1234 · S = src',
    'C-PART 부분', '| 이름 | 유형 | 하는 일 한 줄 | 담당 파일·폴더 | 구현 상태 | 행 ID | 근거 | 메모 |', '|---|---|---|---|---|---|---|---|', '| 수집기 | 수집기 | 읽는다 | S/a | 구현됨 | B01 | [파일: S/a] | x |',
    'C-GATE 다음 관문', '없음: 열린 PR 없음 [보고: 목록]',
    'C-ISSUE 오류·미해결·할 일', '| 부분 | 무엇이 | 근거 |', '|---|---|---|', '| 수집기 | 느림 | [추정] |',
    'P7-01 새 표', '| 칸 |', '|---|', '| 값 |',
    '이번 기록의 초점: P1, P5 / 명령과 작업이 핵심 / P1-01·P5-03'].join('\n');
  const t = T.readRecordTables(v4);
  assert.equal(t.version, 'v4');
  assert.deepEqual([t.chunk.recordId, t.chunk.chunk, t.chunk.basis], ['AF4-00000001', 1, 'abc1234']);
  assert.deepEqual([t.promise.basis, t.promise.aliases.get('S')], ['abc1234', 'src']);
  assert.deepEqual([t.focus.profiles, t.focus.reason, t.focus.tables], [['P1', 'P5'], '명령과 작업이 핵심', ['P1-01', 'P5-03']]);
  const part = t.byId.get('C-PART')[0];
  assert.deepEqual([part.rows[0].byColumn['행 ID'], part.rows[0].extra], ['B01', { 메모: 'x' }]);
  assert.equal(t.byId.get('C-GATE')[0].none.text, '열린 PR 없음 [보고: 목록]');
  assert.deepEqual(t.byId.get('P7-01')[0].rows[0].cells.map(c => c.text), ['값']);
  assert.deepEqual(t.diagnostics.map(d => [d.category, d.table, d.column]), [['unknown-column', 'C-PART', '메모'], ['missing-column', 'C-ISSUE', '언제부터'], ['unknown-table', 'P7-01', null]]);
  // The v3 view of a v4 row: C-PART without its 행 ID.
  const rows = T.rowsOf(new Map([['N01', { text: v4 }]]), ['C-PART']);
  assert.deepEqual([rows[0].header, rows[0].cells], [['이름', '유형', '하는 일 한 줄', '담당 파일·폴더', '구현 상태', '근거', '메모'], ['수집기', '수집기', '읽는다', 'S/a', '구현됨', '[파일: S/a]', 'x']]);
});

test('.43 the v3 title map is anchored: 「오류·미해결」 is C-ISSUE and never eats another table; v3 and v1 records keep their headings', () => {
  const v3 = ['시험 현황 보고서 (v3 표 형식, 세션, 2026-11-05)', '1. 한 줄 요약', '도구다 [추정].', '8. 오류·미해결·할 일', '| 부분 이름 | 무엇이 | 언제부터·근거 |', '|---|---|---|', '| 엔진 | 느림 | [추정] |',
    '12. 오류 코드 목록', '| 코드 | 뜻 |', '|---|---|', '| E1 | 실패 |', '7. 지켜야 할 것과 하지 않기로 한 것', '| 부분 이름 | 규칙 한 줄 | 누가 정했나·언제 |', '|---|---|---|', '| 엔진 | 느리게 | 소유자 |'].join('\n');
  const t = T.readRecordTables(v3);
  assert.equal(t.version, 'v3-status');
  assert.deepEqual(t.tables.map(x => x.id), ['C-SUMMARY', 'C-ISSUE', '?3', 'C-RULE']);
  assert.deepEqual(t.byId.get('C-SUMMARY')[0].body.map(b => b.text), ['도구다 [추정].']);
  assert.deepEqual(t.byId.get('C-RULE')[0].rows[0].byColumn, { 부분: '엔진', '규칙 한 줄': '느리게', '정한 이·언제': '소유자' });
  assert.equal(T.recordVersion('시험 설계 기록 v1 (세션)\n경로 약속: S = src'), 'v1-design');
  assert.equal(T.recordVersion('경로 약속: S = src\n표'), null, 'a 경로 약속 line says no version');
  assert.equal(T.v3TableId('부분 유형'), 'C-PARTTYPE');
  assert.equal(T.v3TableId('오류 코드 목록'), null);
});

test('.43 chunks: a pasted answer splits at its chunk heads; one with no head is one text', () => {
  const one = '〔기록 AF4-1 · 덩이 1 · 기준 abc1234〕 x 기록 v4\nC-SUMMARY 요약\n가.', two = '〔기록 AF4-1 · 덩이 2 · 기준 abc1234〕 x 기록 v4\nC-FILES 파일 지도\n없음: 없음 [추정]';
  assert.deepEqual(T.splitRecordChunks(`앞말\n${one}\n\n${two}\n`), [`앞말\n${one}`, two]);
  assert.deepEqual(T.splitRecordChunks(one), [one]);
  assert.equal(T.chunkHead(two).chunk, 2);
});
