// Recipe .45 (RECORD_ASKS_V5_KO.md 1, 2, 4 as 12 and 13 amend them): the v5 tables, the ledgers and cites, and the fold of a record's
// pages, on the fictional 물주기 record (fixtures/record45: page 1 the first structure, page 2 the detail). No model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from '../dist/public/shared/record-table.js';

const page = n => readFileSync(new URL(`./fixtures/record45/page${n}.txt`, import.meta.url), 'utf8');
const fold = (...texts) => { const all = T.foldTexts(texts); assert.equal(all.length, 1, 'one record'); return all[0]; };
const ids = (f, table) => (f.rows.get(table) ?? []).map(r => r.id);
const diag = (f, category) => f.diagnostics.filter(d => d.category === category).map(d => d.ref);
const kinds = f => f.obligations.map(o => `${o.kind}:${o.table ?? ''}:${o.ref ?? ''}`);

test('V5-T1 the v5 tables: queues, row-ID prefixes, header rows that read with no diagnostic; v4 tables frozen as V4_TABLES; the page head and version', () => {
  assert.deepEqual(T.Q1_TABLES, ['C-HEAD', 'C-SUMMARY', 'C-PART', 'C-GROUP', 'C-LINK', 'C-LOOP', 'C-STATE', 'C-WITHDRAW', 'C-STATUS', 'C-CHECK']);
  assert.deepEqual(T.Q2_TABLES, ['C-STEP', 'C-DATA', 'C-COND', 'C-CHANGE', 'C-RULE', 'C-ENTRY', 'C-VARIANT', 'C-CONTRACT', 'C-ISSUE', 'C-GATE', 'C-UNKNOWN', 'C-DOUBT']);
  assert.deepEqual(T.PAGE_END_TABLES, ['C-SRC', 'C-EVID', 'C-DROP', 'C-END']);
  assert.equal(T.V4_TABLES.length, 23); assert.ok(T.V4_TABLES.some(t => t.id === 'C-DESIGN') && !T.COMMON_TABLES.some(t => t.id === 'C-DESIGN' || t.id === 'C-DONE' || t.id === 'C-BASIS' || t.id === 'C-FILES'));
  for (const t of T.COMMON_TABLES) if (t.id !== 'C-HEAD' && t.id !== 'C-SUMMARY' && t.id !== 'C-END') assert.ok(['행 ID', 'F ID', 'E ID'].includes(t.columns[0]), t.id);
  assert.ok(T.V5_TABLE_DEFS.get('C-LINK').columns.includes('주장 성격') && !T.V5_TABLE_DEFS.get('C-LINK').columns.includes('설계/관찰'));
  for (const t of [...T.COMMON_TABLES, ...T.PROFILE_TABLES]) if (t.columns.length) {
    const rec = T.readRecordTables(`〔기록 AF5-1 · 쪽 1 · 기준 abc1234 · 앞 쪽 —〕 x 기록 v5\n${t.id} ${t.title}\n${T.headerLine(T.V5_TABLE_DEFS.get(t.id))}\n|${'---|'.repeat(t.columns.length)}`);
    assert.deepEqual(rec.diagnostics, [], t.id);
  }
  const one = T.readRecordTables(page(1));
  assert.equal(one.version, 'v5');
  assert.deepEqual([one.page.recordId, one.page.n, one.page.prev, one.page.basis], ['AF5-3b7e0c19', 1, null, '9f2c1ab']);
  assert.deepEqual(one.diagnostics, []);
  assert.deepEqual(one.declared.map(x => x.level), [1]);
  assert.equal(T.readRecordTables(page(2)).page.prev, 1);
  // A pasted answer of two pages splits into one record per page.
  assert.deepEqual(T.splitRecordChunks(`${page(1)}\n${page(2)}`).map(t => T.readRecordTables(t).page.n), [1, 2]);
  // A v4 record still reads by the v4 tables (its C-PART 유형 column, its C-DONE).
  const v4 = T.readRecordTables('〔기록 AF4-1 · 덩이 1 · 기준 abc1234〕 x 기록 v4\nC-PART 부분\n| 이름 | 유형 | 하는 일 한 줄 | 담당 파일·폴더 | 구현 상태 | 행 ID | 근거 |\n|---|---|---|---|---|---|---|\n| 시계 | 타이머·일정 | 깨운다 | a/ | 구현됨 | B01 | [=] |');
  assert.deepEqual([v4.version, v4.diagnostics, v4.tables[0].dialect, v4.tables[0].rows[0].byColumn['유형']], ['v4', [], 'v4', '타이머·일정']);
});

test('V5-T2 the new words: 표현군·역할 (미정 with its reason), the role types that are clear only, v4 type words mapped only where unambiguous', () => {
  assert.deepEqual(T.readFamily('처리 · 실행 조정'), { word: '처리', family: 'process', role: '실행 조정', reason: null, ok: true });
  assert.deepEqual(T.readFamily('미정 · 서로 다른 역할 혼재(처리·저장)'), { word: '미정', family: null, role: null, reason: 'mixed', ok: true });
  assert.deepEqual(T.readFamily('촉발·빌드·배포 자동화').role, '빌드·배포 자동화');
  assert.equal(T.readFamily('엔진').ok, false); assert.equal(T.readFamily('').ok, false);
  assert.equal(T.fixedWord('외부 호출', T.ROLE_TYPES).value, 'actor'); assert.equal(T.fixedWord('실행 조정', T.ROLE_TYPES), null);
  assert.deepEqual(T.V4_TYPE_FAMILY['계산'], { family: 'process', role: '계산' });
  for (const w of ['루프·엔진', '봇', '외부 시스템', '집행·외부 호출']) assert.equal(T.V4_TYPE_FAMILY[w], null, w);
  assert.equal(T.fixedWord('문서로만 폐기', T.WITHDRAW_WORDS_V5).value, 'doc-only'); assert.equal(T.fixedWord('문서로만 폐기', T.WITHDRAW_WORDS), null, 'a v4 record reads as .44');
  assert.equal(T.fixedWord('자료마다(급수 기록만)', T.TOGETHER_WORDS_V5).value, 'per-data');
  assert.deepEqual(Object.keys(T.NATURE_WORDS), ['정의된 관계', '실행 보고', '실행 관측', '추정']);
  assert.deepEqual(T.expandIds('LN01–LN03, LN07'), ['LN01', 'LN02', 'LN03', 'LN07']);
  assert.deepEqual(T.expandIds('B06:S01, B05:S01–S04'), ['B06:S01', 'B05:S01', 'B05:S02', 'B05:S03', 'B05:S04']);
  assert.deepEqual(T.readReserved('D01 등록 요청 · D02 푸시 요청'), [{ id: 'D01', name: '등록 요청' }, { id: 'D02', name: '푸시 요청' }]);
});

test('V5-T3 cites resolve against the F and E ledgers, each keeping its own grade; 「=」 is no cite; a run whose source is no command is a report', () => {
  const f = fold(page(1), page(2)), link = id => f.byId.get(id);
  assert.deepEqual(link('LN05').cites.map(c => [c.ref, c.grade, c.source]), [['E02', 'run', 'rg -n "tick" logs/sample.log']]);
  assert.deepEqual(link('LN08').cites.map(c => [c.ref, c.grade, c.source, c.quote]), [['E03', 'report', 'PR #41', '「푸시가 게이트웨이까지 나간다」']]);
  assert.deepEqual(link('LN04').cites.map(c => [c.ref, c.grade, c.source]), [['F02', 'file', 'server/api/']]);
  assert.deepEqual(f.byId.get('B10').cites.map(c => [c.ref, c.grade, c.source]), [['추정', 'guess', 'F07']]);
  assert.deepEqual(f.head.get('첫 구조 줄').cites.map(c => [c.ref, c.grade]), [['F03', 'file'], ['F02', 'file']], 'two cites, two grades, never merged');
  assert.deepEqual(f.summary.map(s => s.cites.map(c => c.ref)), [['F01'], ['F03', 'E01']]);
  assert.equal(f.ledger.evidence.get('E06').grade, 'report'); assert.deepEqual(diag(f, 'grade-source'), ['E06']);
  const L = f.ledger;
  assert.deepEqual(T.readCites('=', L), { cites: [], problems: [{ kind: 'cite-equals', ref: '=' }] });
  assert.deepEqual(T.readCites('F07', L).problems, [{ kind: 'cite-unread', ref: 'F07' }]); assert.equal(T.readCites('F07', L).cites[0].grade, 'unknown');
  assert.deepEqual(T.readCites('F99+E02', L).problems, [{ kind: 'cite-missing', ref: 'F99' }]); assert.equal(T.readCites('F99+E02', L).cites[0].grade, 'run');
  assert.deepEqual(T.readCites('[보고: PR #3] 모름', L).cites.map(c => [c.ref, c.grade, c.source]), [['[보고]', 'report', 'PR #3'], ['모름', 'unknown', null]]);
  // A row written with 「=」 asks to be fixed: no cite, no grade.
  const eq = fold(page(1).replace('|LN04|B03|B04|화분 행|호출마다|—|네트워크|정의된 관계|F02|', '|LN04|B03|B04|화분 행|호출마다|—|네트워크|정의된 관계|=|'));
  assert.deepEqual([eq.byId.get('LN04').cites, diag(eq, 'cite-equals')], [[], ['LN04·=']]);
  assert.ok(kinds(eq).includes('fix:C-LINK:LN04·='));
});

test('V5-T4 the fold is idempotent: the same page again changes nothing, page order of pasting does not matter, another text for a page is a conflict (the first stays)', () => {
  const a = fold(page(1), page(2)), b = fold(page(2), page(1), page(1)), c = fold(page(1), page(2), page(2));
  const shape = f => JSON.stringify([...f.byId.keys(), f.level, kinds(f), f.diagnostics.map(d => d.category)]);
  assert.equal(shape(b), shape(a)); assert.equal(shape(c), shape(a));
  assert.equal(c.pages[1].repeated, 1);
  const other = page(1).replace('|B05|일정 계산기|처리 · 계산|', '|B05|일정 계산기|처리 · 일정 계산|');
  const x = fold(page(1), other);
  assert.deepEqual([x.pages.length, x.pages[0].conflict, x.conflicts.length, diag(x, 'page-conflict')], [1, true, 1, ['쪽 1']]);
  assert.equal(T.readFamily(x.byId.get('B05').row.byColumn['표현군·역할']).role, '계산', 'the first page received stands until the person says which');
  assert.ok(kinds(x).includes('page-conflict::쪽 1'));
  // A changed basis sha is another record, never folded into this one.
  const moved = page(2).replace('기준 9f2c1ab', '기준 0aa11bb');
  assert.equal(T.foldTexts([page(1), moved]).length, 2);
});

test('V5-T5 replace, delete and an ID written again: 교체 replaces the row, C-DROP removes it, a plain repeat keeps the first with duplicate-id', () => {
  const f = fold(page(1), page(2));
  assert.equal(T.readFamily(f.byId.get('B10').row.byColumn['표현군·역할']).family, 'process');
  assert.equal(f.byId.get('B10').mark, 'replace'); assert.deepEqual(ids(f, 'C-PART').at(-1), 'B10', 'a replaced row keeps its place');
  assert.ok(!f.byId.has('LN09') && f.deleted.has('LN09')); assert.deepEqual(ids(f, 'C-LINK'), ['LN01', 'LN02', 'LN03', 'LN04', 'LN05', 'LN06', 'LN07', 'LN08']);
  const again = page(2).replace('C-DROP 삭제', 'C-LINK 연결\n|행 ID|보내는 부분|받는 부분|넘기는 것|박자|조건·선택|경계|주장 성격|근거|\n|---|---|---|---|---|---|---|---|---|\n|LN01|B02|B01|알림|사건 때|—|사람|정의된 관계|F05|\nC-DROP 삭제');
  const g = fold(page(1), again);
  assert.deepEqual(diag(g, 'duplicate-id'), ['LN01']); assert.equal(g.byId.get('LN01').row.byColumn['보내는 부분'], 'B01', 'the first row stands');
  assert.equal(g.extras.filter(r => r.id === 'LN01').length, 1); assert.ok(kinds(g).includes('fix:C-LINK:LN01')); assert.equal(g.level, 1, 'a duplicate-id waits for level 2');
  // A deleted ID is never written again; a row naming it says ref-deleted.
  const reused = page(2).replace('|CD02|B09|!token|401|다음|실행 시|F06|', '|CD02|B09|LN09 결과|401|다음|실행 시|F06|');
  assert.deepEqual(fold(page(1), reused).diagnostics.filter(d => d.category === 'ref-deleted').length, 0, 'LN IDs are not references');
});

test('V5-T6 reservations: an ID the page points at before its row is written stays an obligation until a row holds it; one no row cites is dropped', () => {
  const one = fold(page(1));
  assert.deepEqual(one.reservations.map(r => [r.id, r.name]), [['D01', '등록 요청'], ['D02', '푸시 요청']]);
  assert.ok(kinds(one).includes('reservation::D01') && kinds(one).includes('reservation::D02'));
  assert.deepEqual(fold(page(1), page(2)).reservations, []);
  const unused = fold(page(1).replace('|C-LINK|끝남|LN01–LN09|D01 등록 요청 · D02 푸시 요청|—|', '|C-LINK|끝남|LN01–LN09|D01 등록 요청 · D09 없는 것|—|'));
  assert.deepEqual([diag(unused, 'reserve-unused'), unused.reservations.map(r => r.id), diag(unused, 'dangling-ref')], [['D09'], ['D01'], ['LN07→D02']]);
});

test('V5-T7 a table written before an earlier one is settled is recorded out-of-order and its rows are kept; a missing page stops the fold there', () => {
  const skipped = page(1).replace(/C-GROUP 묶음\n(?:\|.*\n)+/, '').replace('|C-GROUP|끝남|GR01–GR02|—|—|\n', '');
  const f = fold(skipped);
  assert.deepEqual(diag(f, 'out-of-order'), ['C-GROUP']); assert.equal(ids(f, 'C-LINK').length, 9, 'the rows are kept');
  assert.ok(kinds(f).includes('table-skipped:C-GROUP:')); assert.equal(f.level, 0);
  // A supplementary table before level 2 is out-of-order too, its rows kept.
  const early = page(1).replace('C-END 쪽 끝', 'P5-03 실패·복구\n| 작업·단계 ID | 실패 조건 | 재시도 조건·한도 | 복구 위치 | 중복·부분 성공 처리 | 행 ID | 근거 |\n|---|---|---|---|---|---|---|\n| B07 | 게이트웨이 5xx | 3번 | B07 | 모름 | P5-03.1 | F04 |\nC-END 쪽 끝');
  const e = fold(early);
  assert.deepEqual([diag(e, 'out-of-order'), ids(e, 'P5-03')], [['P5-03'], ['P5-03.1']]);
  // Page 3 with no page 2: held, the fold stops at page 1, the next page asked is page 2.
  const three = page(2).replace('쪽 2 · 기준 9f2c1ab · 앞 쪽 1', '쪽 3 · 기준 9f2c1ab · 앞 쪽 2');
  const g = fold(page(1), three);
  assert.deepEqual([g.pages.map(p => p.n), g.held.map(p => p.n), diag(g, 'page-gap')], [[1], [3], ['쪽 2']]);
  assert.ok(!g.byId.has('D01') && kinds(g).includes('page-gap::'));
});

test('V5-T8 the level and the remaining obligations are the app\'s: first structure after page 1, detail after page 2; core loops unexpanded, a missing link a candidate', () => {
  const one = fold(page(1)), both = fold(page(1), page(2));
  assert.equal(one.level, 1); assert.equal(both.level, 2);
  assert.deepEqual(one.obligations.filter(o => o.kind === 'loop-body').map(o => o.ref), ['B06:L01', 'B05:L01']);
  assert.deepEqual(one.obligations.filter(o => o.kind === 'table-next').map(o => o.table), T.Q2_TABLES);
  assert.deepEqual(both.obligations.map(o => [o.kind, o.ref, o.candidate]), [['entry-unlinked', 'N02', true]]);
  assert.deepEqual(diag(one, 'level-mismatch'), []); assert.deepEqual(diag(both, 'level-mismatch'), []);
  // A part with no fixed family word asks to be fixed and keeps the record at level 0.
  const bad = fold(page(1).replace('|B05|일정 계산기|처리 · 계산|', '|B05|일정 계산기|엔진|'));
  assert.deepEqual([bad.level, bad.obligations.filter(o => o.kind === 'fix').map(o => o.ref)], [0, ['B05']]);
  assert.deepEqual(diag(bad, 'level-mismatch'), ['1≠0'], 'the author\'s 완료 단계 is compared, never believed');
  // A page that leaves C-LINK 이어짐 keeps the record before level 1 with the table open.
  const cont = fold(page(1).replace('|C-LINK|끝남|LN01–LN09|', '|C-LINK|이어짐|LN01–LN09|').replace('|D01 등록 요청 · D02 푸시 요청|—|', '|D01 등록 요청 · D02 푸시 요청|B07부터|'));
  assert.deepEqual([cont.level, cont.obligations.find(o => o.kind === 'table-open')], [0, { kind: 'table-open', table: 'C-LINK', ref: null, text: 'B07부터', candidate: false }]);
  // CK6: a part held by one folder, three links and no step, unless C-CHECK CK6 names it, is a candidate.
  const ck6 = fold(page(1).replace('|CK6|폴더 하나 = 부분 하나|확인 못함|B03|', '|CK6|폴더 하나 = 부분 하나|없음|—|'));
  assert.deepEqual(ck6.obligations.filter(o => o.kind === 'folder-part').map(o => [o.ref, o.candidate]), [['B02', true], ['B03', true], ['B05', true]]);
  assert.deepEqual(one.obligations.filter(o => o.kind === 'folder-part').map(o => o.ref), ['B02', 'B05'], 'B03 is named by CK6');
  // A missing C-CHECK row is a fix of the first structure.
  const noCk = fold(page(1).replace(/\|CK4\|.*\n/, ''));
  assert.deepEqual([noCk.level, noCk.obligations.filter(o => o.table === 'C-CHECK').map(o => o.ref)], [0, ['CK4']]);
  // The end table's 쓴 행 is checked against the rows the page holds.
  const wrong = fold(page(1).replace('|C-STATE|끝남|SM01–SM02|', '|C-STATE|끝남|SM01–SM03|'));
  assert.deepEqual(diag(wrong, 'end-mismatch'), [null]);
});
