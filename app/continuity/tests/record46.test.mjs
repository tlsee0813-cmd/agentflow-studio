// Recipe .46 (from eight recording sessions that never reached the first structure): a row ID the request did not name (G01 for C-GROUP,
// ST01 for C-STATE) is taken as written and unique within its table; C-DROP takes a row away by its written ID; a later text for a page
// replaces the earlier one (latest wins); the page request lists every obligation by table and names each next ID with its table; the
// page cap is 20 and says so; the base request names every table's row-ID form. All on the fictional 물주기 record (fixtures/record45),
// rewritten here the way a session that guessed its prefixes writes it. No model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from '../dist/public/shared/record-table.js';
import * as R from '../dist/public/shared/report-ask.js';

const page = n => readFileSync(new URL(`./fixtures/record45/page${n}.txt`, import.meta.url), 'utf8');
const fold = (...texts) => { const all = T.foldTexts(texts); assert.equal(all.length, 1, 'one record'); return all[0]; };
const ids = (f, table) => (f.rows.get(table) ?? []).map(r => r.id);
const diag = (f, category) => f.diagnostics.filter(d => d.category === category).map(d => d.ref);
const fixes = f => f.obligations.filter(o => o.kind === 'fix');
// Page 1 as a session writes it that guessed its prefixes: C-GROUP G01·G02, C-STATE ST01·ST02 (C-STATUS's own prefix, so ST01 and ST02 stand
// in two tables).
const guessed = () => page(1).replace('|GR01|서버 프로세스', '|G01|서버 프로세스').replace('|GR02|B07|', '|G02|B07|').replace('|C-GROUP|끝남|GR01–GR02|', '|C-GROUP|끝남|G01–G02|')
  .replace('|SM01|B02|', '|ST01|B02|').replace('|SM02|B02|', '|ST02|B02|').replace('|C-STATE|끝남|SM01–SM02|', '|C-STATE|끝남|ST01–ST02|');
const DROP_HEAD = 'C-DROP 삭제\n|행 ID|이유|근거|\n|---|---|---|\n';
// Page 2 with drops: G02 bare, ST01 whose reason names C-STATE, ST02 bare (C-STATE wrote it outside its form), C-STATUS ST03 qualified, G02 again.
const dropping = () => page(2).replace(DROP_HEAD, `${DROP_HEAD}|G02|형식 밖 ID, GR02로 다시 씀|앱 진단|\n|ST01|C-STATE 행, SM01로 다시 씀|앱 진단|\n|ST02|형식 밖 ID|앱 진단|\n|C-STATUS ST03|대상이 겹침|추정|\n|G02|같은 줄 다시|앱 진단|\n`);

test('R46-1 a row ID outside its table\'s own form is taken as written, unique within its table, said once per table and prefix, never an obligation', () => {
  const f = fold(guessed());
  assert.equal(f.level, 1, 'the first structure stands with G01 and ST01');
  assert.deepEqual([ids(f, 'C-GROUP'), ids(f, 'C-STATE'), ids(f, 'C-STATUS')], [['G01', 'G02'], ['ST01', 'ST02'], ['ST01', 'ST02', 'ST03']]);
  assert.deepEqual(diag(f, 'row-id'), []); assert.deepEqual(diag(f, 'duplicate-id'), [], 'the same ID in two tables is two rows');
  assert.deepEqual(diag(f, 'row-id-prefix'), ['G01', 'ST01'], 'once per table and prefix');
  assert.ok(!fixes(f).length, JSON.stringify(fixes(f)));
  // One row per ID for the passes that look an ID up: the table whose own form it is; every row by its key.
  assert.equal(f.byId.get('ST01').table, 'C-STATUS'); assert.equal(f.byKey.get(T.rowKey('C-STATE', 'ST01')).row.byColumn['상태'], '로그인 전');
  // A cross-reference resolves by the ID as written (C-CHECK CK5 names WD01; nothing dangles).
  assert.deepEqual(diag(f, 'dangling-ref'), []);
  // The table's own form and the ledgers keep their rule: an ID of no form at all is still a fix; an F the ledger form misses too.
  const odd = fold(guessed().replace('|G02|B07|', '|그룹2|B07|').replace('|C-GROUP|끝남|G01–G02|', '|C-GROUP|끝남|G01|'));
  assert.deepEqual(fixes(odd).map(o => [o.table, o.ref, o.text]), [['C-GROUP', '그룹2', '행 ID가 없거나 형식 밖']]);
  assert.equal(odd.level, 0);
  assert.ok(T.rowIdTaken(T.V5_TABLE_DEFS.get('C-COND'), 'C01') && T.rowIdTaken(T.V5_TABLE_DEFS.get('C-STEP'), 'B03:S04a') && !T.rowIdTaken(T.V5_TABLE_DEFS.get('C-SRC'), 'S01'));
  // The paste check reads the same keys (a pass word on C-STATE's ST01 row is not C-STATUS's).
  assert.equal(R.checkReport(guessed()).level, 1);
});

test('R46-2 C-DROP takes a row away by its written ID: bare, qualified 「C-STATUS ST03」, the one its reason names, the one outside its form; again changes nothing', () => {
  const f = fold(guessed(), dropping());
  assert.deepEqual([ids(f, 'C-GROUP'), ids(f, 'C-STATE'), ids(f, 'C-STATUS')], [['G01'], [], ['ST01', 'ST02']]);
  assert.deepEqual([...f.dropped].map(([t, s]) => [t, [...s]]).sort(), [['C-GROUP', ['G02']], ['C-LINK', ['LN09']], ['C-STATE', ['ST01', 'ST02']], ['C-STATUS', ['ST03']]]);
  assert.deepEqual([diag(f, 'drop-unknown'), diag(f, 'drop-ambiguous')], [[], []]);
  assert.equal(f.level, 2);
  // A bare ID two tables hold off their own form is said (drop-ambiguous) and takes nothing.
  const two = guessed().replace('|WD01|B07|', '|ST01|B07|').replace('|C-WITHDRAW|끝남|WD01–WD02|', '|C-WITHDRAW|끝남|ST01, WD02|');
  const amb = fold(two, page(2).replace(DROP_HEAD, `${DROP_HEAD}|ST01|형식 밖 ID|앱 진단|\n`));
  assert.deepEqual([diag(amb, 'drop-ambiguous'), ids(amb, 'C-STATE'), ids(amb, 'C-WITHDRAW')], [['ST01'], ['ST01', 'ST02'], ['ST01', 'WD02']]);
  // A drop settles what was asked of its row: a duplicate ID written again on page 2 is no longer a fix once the row is dropped.
  const dup = page(2).replace('C-DROP 삭제', 'C-GROUP 묶음\n|행 ID|부모|자식들|묶음 뜻|근거|\n|---|---|---|---|---|\n|G01|B07|B07: 다른 통로|목록|F04|\nC-DROP 삭제');
  assert.ok(fixes(fold(guessed(), dup)).some(o => o.ref === 'G01'));
  const settled = fold(guessed(), dup, page(3).replace(/〔기록[^\n]*\n/, '〔기록 AF5-3b7e0c19 · 쪽 3 · 기준 9f2c1ab · 앞 쪽 2〕 물주기 기록 v5 (시험 세션, 2026-11-05 11:30)\n').replace(/(\n|^)(C-END 쪽 끝)/, `$1${DROP_HEAD}|C-GROUP G01|겹친 ID|앱 진단|\n$2`));
  assert.ok(!fixes(settled).some(o => o.ref === 'G01'), JSON.stringify(fixes(settled)));
});

test('R46-3 a later text for a page replaces the earlier one (latest wins), said once, the earlier kept in history; the same text again changes nothing', () => {
  // Pasted in turn: page 1 with guessed IDs, page 2 with its drops, then page 1 corrected (GR01·GR02, SM01·SM02).
  const f = fold(guessed(), dropping(), page(1));
  assert.deepEqual([f.pages.map(p => [p.n, p.record]), f.replaced.map(p => [p.n, p.record]), f.conflicts.length, diag(f, 'page-replaced')], [[[1, '#2'], [2, '#1']], [[1, '#0']], 0, ['쪽 1']]);
  assert.deepEqual([ids(f, 'C-GROUP'), ids(f, 'C-STATE'), ids(f, 'C-STATUS')], [['GR01', 'GR02'], ['SM01', 'SM02'], ['ST01', 'ST02']]);
  // The drops of rows only the earlier page 1 held say nothing; C-STATUS ST01 and ST02 are never taken for C-STATE's (C-STATUS ST03 is).
  assert.deepEqual([diag(f, 'drop-unknown'), diag(f, 'drop-ambiguous')], [[], []]);
  assert.equal(f.level, 2); assert.ok(!f.obligations.some(o => !o.candidate), JSON.stringify(f.obligations));
  // History: a row both texts hold stood on the earlier text first.
  assert.deepEqual(f.history.get(T.rowKey('C-PART', 'B05')).map(r => r.record), ['#0', '#2']);
  // The very same text again, even after another text, changes nothing (a re-sent page is no correction).
  const again = fold(guessed(), page(1), guessed());
  assert.deepEqual([again.pages[0].record, again.replaced.length, ids(again, 'C-GROUP')], ['#1', 1, ['GR01', 'GR02']]);
  assert.deepEqual([fold(page(1), page(1)).replaced.length, fold(page(1), page(1)).pages[0].repeated], [0, 1]);
  // A map ask lists its records newest first: the order says which text is later.
  const inputs = [{ record: 'N2', text: page(1) }, { record: 'N1', text: guessed() }];
  assert.deepEqual([T.foldPages(inputs, 'newest-first')[0].pages[0].record, T.foldPages(inputs)[0].pages[0].record], ['N2', 'N1']);
  // The page request says the replacement once: on the request after the text that replaced it.
  assert.ok(R.pageAsk([guessed(), page(1)]).text.includes('쪽 1은 나중에 온 글로 바꿔 읽었다'));
  assert.ok(!R.pageAsk([guessed(), page(1), page(1)]).text.includes('바꿔 읽었다'), 'the same text again replaces nothing');
});

test('R46-4 the page request lists every obligation, grouped by table with counts and why each table is open; each next ID with its table', () => {
  // Fifty C-LINK rows citing 「=」 (fifty fixes) besides the record's own obligations: more than the forty .45 listed.
  const rows = Array.from({ length: 50 }, (_, i) => `|LN${10 + i}|B05|B07|D02 푸시 요청|항목마다|—|같은 프로세스|정의된 관계|=|`).join('\n');
  const many = guessed().replace('|LN09|B03|B02|등록 결과|호출마다|—|네트워크|정의된 관계|F02|', `|LN09|B03|B02|등록 결과|호출마다|—|네트워크|정의된 관계|F02|\n${rows}`)
    .replace('|C-LINK|끝남|LN01–LN09|', '|C-LINK|끝남|LN01–LN59|').replace('|C-STATUS|끝남|ST01–ST03|', '|C-STATUS|이어짐|ST01–ST03|').replace('|C-STATUS|이어짐|ST01–ST03|—|—|', '|C-STATUS|이어짐|ST01–ST03|—|B10부터|');
  const f = fold(many), plan = R.pageAsk([many]);
  assert.ok(f.obligations.length > 60, String(f.obligations.length));
  assert.ok(plan.text.includes(`앱이 센 남은 의무 (${R.obligationCount(f.obligations)}, 첫 구조 미완료)`));
  const block = plan.text.split('앱이 센 남은 의무')[1].split('\n\n')[0], counts = [...block.matchAll(/^- (\S+) \((\d+)\):/gm)].map(m => Number(m[2]));
  assert.equal(counts.reduce((a, b) => a + b, 0), f.obligations.length, 'every obligation is counted in a group');
  assert.ok(block.includes('- C-LINK (50): 고칠 것 LN10–LN59(=): 「=」 인용(ID를 명시)'), block);
  assert.ok(block.includes('첫 구조를 막는 것: 안 닫힌 표 C-STATUS\n'), 'a cite fix does not hold the first structure');
  assert.ok(block.includes('- C-STATUS (1): 이어 쓸 표: 쪽 1 C-END 이어짐: B10부터'), block);
  assert.ok(block.includes('- C-STEP (1): 아직 안 쓴 표: 아직 안 씀'), block);
  assert.ok(plan.text.length < 12000, String(plan.text.length));
  // Each next ID names its table; C-SUMMARY takes no ID, so no bare SM01 stands for it.
  const next = /다음 ID: ([^\n]*)/.exec(plan.text)[1];
  assert.ok(next.startsWith('C-SRC F08 · C-EVID E05 · C-PART B11 · C-GROUP GR01 · C-LINK LN60 · C-STATE SM01 · C-WITHDRAW WD03 · C-STATUS ST04'), next);
  assert.ok(!/C-SUMMARY|C-STEP S01|C-LOOP L01/.test(next) && next.split(' · ').slice(0, -1).every(x => /^C-[A-Z]+ [A-Z]{1,2}\d{2}$/.test(x)), next);
});

test('R46-5 the page cap is 20 pages, and a record stopped by it says so (never done)', () => {
  const end = n => `〔기록 AF5-3b7e0c19 · 쪽 ${n} · 기준 9f2c1ab · 앞 쪽 ${n - 1}〕 물주기 기록 v5 (시험 세션, 2026-11-05 12:00)\nC-END 쪽 끝\n|표 ID|상태|쓴 행|예약|남은 것|\n|---|---|---|---|---|\n|C-STEP|아직|—|—|다음 쪽|\n완료 단계: 첫 구조 완료\n다음: C-STEP`;
  const upTo = k => [page(1), ...Array.from({ length: k - 1 }, (_, i) => end(i + 2))];
  assert.equal(R.PAGE_CAP, 20);
  assert.equal(R.pageAsk(upTo(12)).page, 13, '.45 stopped here');
  assert.equal(R.pageAsk(upTo(19)).page, 20); assert.equal(R.pageCapReached(upTo(19)), null);
  assert.equal(R.pageAsk(upTo(20)), null);
  assert.deepEqual(R.pageCapReached(upTo(20)), { page: 21, cap: 20, obligations: T.foldTexts(upTo(20))[0].obligations.filter(o => !o.candidate).length });
  assert.equal(R.pageCapReached([page(1), page(2)]), null, 'level 2 is no cap');
});

test('R46-6 the base request names every table\'s row-ID form (one line, and at each table), the short clarifications, about 11.5K characters', () => {
  const ask = R.recordAskV5('AF5-12345678');
  assert.ok(ask.length <= 11500, String(ask.length));
  assert.ok(ask.includes(R.ROW_ID_FORMS) && R.ROW_ID_FORMS.includes('C-GROUP GR01 · C-LINK LN01 · C-LOOP B03:L01 · C-STATE SM01 · C-WITHDRAW WD01 · C-STATUS ST01 · C-CHECK CK1'));
  for (const id of [...T.Q1_TABLES, ...T.Q2_TABLES, 'C-SRC', 'C-EVID']) {
    const t = T.V5_TABLE_DEFS.get(id), form = T.rowIdForm(t);
    if (!form) { assert.ok(['C-HEAD', 'C-SUMMARY'].includes(id), id); continue; }
    assert.ok(ask.includes(`\n${T.headerLine(t)}\n${['C-SRC', 'C-EVID'].includes(id) ? t.columns[0] : '행 ID'} ${form}.`), id);
    assert.ok(R.ROW_ID_FORMS.includes(`${id} ${form}`), id);
  }
  for (const s of ['끝은 C-END 표와 그 아래 두 줄', '처음 인용하는 C-SRC·C-EVID 행만', '사람이 할 때', '철회가 아닌 것(낱말만 맞은 것)은 C-CHANGE(찾은 길 검색)', '작성: A + 병합: B', '「앱 진단」',
    '「C-STATE ST01」', '해당 없음(남은 것에 이유).', '행 ID·머리 줄 없이 두 문장', '그 쪽 전체를 다시 쓴다: 나중 글이 앞 글을 통째로 대신한다', '옛 ID를 C-DROP',
    // Review N5: 「작성: A + 병합: B」 is said with 관련 주체·역할, never inside the date sentence; the ledgers' first column by its name.
    '병합: 모름), 비면 C-HEAD 기본 행위자', '\nF ID F01.', '\nE ID E01.']) assert.ok(ask.includes(s), s);
  assert.ok(!/날짜는[^.]*작성: A/.test(ask) && !ask.includes('행 ID F01.'));
  assert.equal(T.fixedWord('사람이 할 때', T.CADENCE_WORDS).value, 'event');
});

// Review B1 (probes A–C): a table whose row IDs other code reads as structure keeps its own form only; another form is a fix that names it.
const fixesOf = (f, table) => fixes(f).filter(o => o.table === table).map(o => [o.ref, o.text]);
const formFix = form => `행 ID가 형식 밖: 이 표는 ${form} 꼴만 받는다(다른 표가 이 ID를 구조로 읽는다). 그 꼴로 다시 쓰고 옛 ID는 C-DROP`;
test('R46-7 C-PART, C-LOOP, C-STEP (and C-CHECK, C-DATA, C-ENTRY, C-VARIANT, C-CONTRACT, the P tables) take their own row-ID form only', () => {
  // A: C-LOOP written L01·L02 holds the first structure with a fix naming the form, never a loop-body no C-STEP could ever settle.
  const loops = page(1).replace('|B06:L01|B06|—|', '|L01|B06|—|').replace('|B05:L01|B05|B06:L01|', '|L02|B05|L01|').replace('|C-LOOP|끝남|B06:L01, B05:L01|', '|C-LOOP|끝남|L01, L02|');
  const a = fold(loops);
  assert.deepEqual([a.level, ids(a, 'C-LOOP'), fixesOf(a, 'C-LOOP'), diag(a, 'row-id-prefix')], [0, [], [['L01', formFix('B03:L01')], ['L02', formFix('B03:L01')]], []]);
  const a2 = fold(loops, page(2));
  assert.equal(a2.level, 0); assert.ok(!a2.obligations.some(o => o.kind === 'loop-body'), JSON.stringify(a2.obligations));
  assert.ok(R.pageAsk([loops]).text.includes(`고칠 것 L01–L02: ${formFix('B03:L01')}`));
  // Page 1 sent again whole in its own form settles it.
  assert.equal(fold(loops, page(2), page(1)).level, 2);
  // B: C-PART rows written P01·P04·P06·P08 are no parts: each a fix (B01 꼴), the first structure held.
  let parts = page(1); for (const n of ['08', '06', '04', '01']) parts = parts.replace(`|B${n}|`, `|P${n}|`);
  const b = fold(parts);
  assert.deepEqual([b.level, ids(b, 'C-PART'), fixesOf(b, 'C-PART').map(x => x[0])], [0, ['B02', 'B03', 'B05', 'B07', 'B09', 'B10'], ['P01', 'P04', 'P06', 'P08']]);
  assert.ok(fixesOf(b, 'C-PART').every(x => x[1] === formFix('B01')));
  // C: C-STEP rows written S61·S51… never reach level 2 (the steps would stand on no part).
  const c = fold(page(1), page(2).replace(/\|B0([56]):S0(\d)\|/g, (m, p, s) => `|S${p}${s}|`));
  assert.deepEqual([c.level, ids(c, 'C-STEP'), fixesOf(c, 'C-STEP').map(x => x[0])], [1, [], ['S61', 'S51', 'S52', 'S53', 'S54']]);
  assert.ok(fixesOf(c, 'C-STEP').every(x => x[1] === formFix('B03:S01')));
  // The free tables keep taking any prefix; the structural ones and the ledgers do not.
  const def = id => T.V5_TABLE_DEFS.get(id);
  for (const [t, id] of [['C-GROUP', 'G01'], ['C-COND', 'C01'], ['C-STATE', 'ST01'], ['C-LINK', 'B03:L01'], ['C-DOUBT', 'Q1']]) assert.ok(T.rowIdTaken(def(t), id), `${t} ${id}`);
  for (const [t, id] of [['C-PART', 'P01'], ['C-LOOP', 'L01'], ['C-STEP', 'S01'], ['C-CHECK', 'C1'], ['C-DATA', 'DT01'], ['C-ENTRY', 'E01'], ['C-VARIANT', 'V01'], ['C-CONTRACT', 'C01'], ['C-SRC', 'S01'], ['C-EVID', 'EV1'], ['P4-02', 'P01']])
    assert.ok(!T.rowIdTaken(def(t), id), `${t} ${id}`);
  assert.ok(T.rowIdTaken(def('P4-02'), 'P4-02.1') && T.rowIdTaken(def('C-STEP'), 'B03:S04a'));
});

// Review B2 (probe p5): page 1 first written with C-STATE ST01·ST02 (outside its form), then corrected (SM01·SM02), then page 2 drops ST01.
const stateV1 = () => page(1).replace('|SM01|B02|', '|ST01|B02|').replace('|SM02|B02|', '|ST02|B02|').replace('|C-STATE|끝남|SM01–SM02|', '|C-STATE|끝남|ST01–ST02|');
const dropOn2 = row => page(2).replace(DROP_HEAD, `${DROP_HEAD}${row}\n`);
const page3 = row => page(3).replace(/〔기록[^\n]*\n/, '〔기록 AF5-3b7e0c19 · 쪽 3 · 기준 9f2c1ab · 앞 쪽 2〕 물주기 기록 v5 (시험 세션, 2026-11-05 11:30)\n').replace(/(\n|^)(C-END 쪽 끝)/, `$1${DROP_HEAD}${row}\n$2`);
test('R46-8 a table-qualified C-DROP always takes that table\'s row; a bare one an earlier text may have meant is skipped only when pasted before the correction, else a fix', () => {
  for (const row of ['|C-STATUS ST01|대상이 겹침|추정|', '|ST01|C-STATUS 대상이 겹침|추정|']) for (const list of [[stateV1(), page(1), dropOn2(row)], [page(1), dropOn2(row)]]) {
    const f = fold(...list);
    assert.deepEqual([ids(f, 'C-STATUS'), diag(f, 'drop-ambiguous'), diag(f, 'drop-unknown')], [['ST02', 'ST03'], [], []], row);
  }
  // Bare, written after the corrected page: which row it meant is a fix the session hears (not silence, not a guess).
  const bare = '|ST01|대상이 겹침|추정|', amb = fold(stateV1(), page(1), dropOn2(bare));
  assert.deepEqual([ids(amb, 'C-STATUS'), diag(amb, 'drop-ambiguous')], [['ST01', 'ST02', 'ST03'], ['ST01']]);
  assert.deepEqual(fixesOf(amb, 'C-DROP'), [['ST01', '어느 표의 행인지 모르는 C-DROP: 「C-STATE ST01」처럼 표 ID를 붙여 다시']]);
  assert.ok(amb.level < 2 && R.pageAsk([stateV1(), page(1), dropOn2(bare)]).text.includes('- C-DROP (1): 고칠 것 ST01: 어느 표의 행인지'));
  // With no earlier text the bare drop is C-STATUS's; pasted before the correction it meant the earlier C-STATE row (gone already).
  assert.deepEqual(ids(fold(page(1), dropOn2(bare)), 'C-STATUS'), ['ST02', 'ST03']);
  const before = fold(stateV1(), dropOn2(bare), page(1));
  assert.deepEqual([ids(before, 'C-STATUS'), diag(before, 'drop-ambiguous'), before.level], [['ST01', 'ST02', 'ST03'], [], 2]);
  // A later drop naming the table settles the fix: C-STATUS takes the row, C-STATE says it was the gone one.
  const settled = fold(stateV1(), page(1), dropOn2(bare), page3('|C-STATUS ST01|대상이 겹침|추정|'));
  assert.deepEqual([ids(settled, 'C-STATUS'), diag(settled, 'drop-ambiguous'), settled.level], [['ST02', 'ST03'], [], 2]);
  const kept = fold(stateV1(), page(1), dropOn2(bare), page3('|C-STATE ST01|형식 밖 ID|앱 진단|'));
  assert.deepEqual([ids(kept, 'C-STATUS'), diag(kept, 'drop-ambiguous'), kept.level], [['ST01', 'ST02', 'ST03'], [], 2]);
});

test('R46-9 review N2, N3, N7: a replaced page\'s row joins only its own key\'s history; its IDs are used; fixes outlive the diagnostic cap; one obligation count', () => {
  // N2 (probe F): ST03 left out of the corrected page 1 and written again on page 2 for another target is another row.
  const v2 = page(1).replace(/\|ST03\|[^\n]*\n/, '').replace('|C-STATUS|끝남|ST01–ST03|', '|C-STATUS|끝남|ST01–ST02|');
  const p2 = page(2).replace(DROP_HEAD, `C-STATUS 상태 주장\n|행 ID|대상|상태 차원|값|적용 범위·조건|기준|근거|\n|---|---|---|---|---|---|---|\n|추가 ST03|B09|운영 상태|모름|—|—|추정|\n${DROP_HEAD}`);
  const f = fold(page(1), v2, p2);
  assert.deepEqual(f.history.get(T.rowKey('C-STATUS', 'ST03')).map(r => [r.record, r.row.byColumn['대상']]), [['#2', 'B09']]);
  assert.deepEqual(f.history.get(T.rowKey('C-PART', 'B05')).map(r => r.record), ['#0', '#1'], 'the same page\'s row still stood on the earlier text first');
  assert.ok(/다음 ID: [^\n]*C-STATUS ST04/.test(R.pageAsk([page(1), v2]).text), 'ST03 was written (only the earlier text holds it)');
  // N3: three hundred quiet cite-word rows said before a cite fix leave the fix standing; more than 200 obligations are all counted.
  const quiet = Array.from({ length: 300 }, (_, i) => `|LN${100 + i}|B05|B07|D02 푸시 요청|항목마다|—|같은 프로세스|정의된 관계|설명|`).join('\n');
  const eq = Array.from({ length: 210 }, (_, i) => `|LN${400 + i}|B05|B07|D02 푸시 요청|항목마다|—|같은 프로세스|정의된 관계|=|`).join('\n');
  const at = '|LN09|B03|B02|등록 결과|호출마다|—|네트워크|정의된 관계|F02|';
  const crowd = fold(page(1).replace(at, `${at}\n${quiet}\n|LN400|B05|B07|D02 푸시 요청|항목마다|—|같은 프로세스|정의된 관계|F99|`));
  assert.ok(fixes(crowd).some(o => o.ref === 'LN400·F99'), 'the cite fix after 300 quiet diagnostics');
  assert.equal(crowd.diagnostics.length, 256);
  const many = fold(page(1).replace(at, `${at}\n${eq}`));
  assert.equal(fixes(many).filter(o => o.text.startsWith('「=」')).length, 210);
  // N7: the status line, the page request and the copy line say the same count: the obligations that are no candidate, the candidates apart.
  assert.equal(R.obligationCount([{ candidate: false }, { candidate: true }, { candidate: false }]), '2개 · 후보 1개');
  assert.equal(R.obligationCount([{ candidate: false }]), '1개');
});
