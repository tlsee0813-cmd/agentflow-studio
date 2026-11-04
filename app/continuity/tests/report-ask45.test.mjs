// 기록 요청 v5 (RECORD_ASKS_V5_KO.md 1, 7.4, 8.5, 9; sections 12 and 13 over the earlier ones): the base request, the page request the app
// builds from the folded record, the supplementary request after level 2, the paste check of a v5 answer, and the screens' copy nodes,
// on the fictional 물주기 record (fixtures/record45).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../dist/public/shared/report-ask.js';
import * as T from '../dist/public/shared/record-table.js';

const page = n => readFileSync(new URL(`./fixtures/record45/page${n}.txt`, import.meta.url), 'utf8');
const WORDS = ['nanoGPT', 'nanogpt', 'hyperfine', 'axios', 'umami', 'pocketbase', 'dagu', 'gpt-researcher', 'shapez', '21종', '24개', '/api/send', 'iter', '프레임마다', 'Agent', 'timer', 'schema_version', 'mergeMap', '&& false', 'Karpathy', 'warmup'];
const has = (text, w) => /^[A-Za-z]+$/.test(w) ? new RegExp(`(?<![A-Za-z])${w}(?![A-Za-z])`).test(text) : text.includes(w);

test('ASK-13 the base request: Q1 and Q2 header rows as the parser defines them, no supplementary table named, the five sentences against invention, the family criteria, explicit-ID cites (no 「=」), about 11K characters', () => {
  const ask = R.recordAskV5('AF5-12345678');
  assert.ok(ask.startsWith('[AgentFlow 기록 요청 v5]'));
  for (const id of [...T.Q1_TABLES, ...T.Q2_TABLES, ...T.PAGE_END_TABLES]) {
    const t = T.V5_TABLE_DEFS.get(id);
    assert.ok(ask.includes(`\n${t.id} ${t.title}\n`), id);
    if (t.columns.length) assert.ok(ask.includes(`\n${T.headerLine(t)}\n`), id);
  }
  assert.ok(ask.indexOf('\nC-CHECK 점검\n') < ask.indexOf('\nC-STEP 안의 단계\n'), 'the first structure before the detail');
  assert.deepEqual(ask.match(/P\d-\d{2}/g), null, 'no supplementary table ID');
  assert.ok(!/보충 표/.test(ask));
  for (const s of R.NO_INVENTION_V5) assert.ok(ask.includes(s));
  assert.ok(ask.includes(R.FAMILY_RULES) && ask.includes('평가기는 처리이고, 그 결과로 막는 부분이 관문이다') && ask.includes('시간 신호만 내는 스케줄러는 촉발'));
  assert.ok(ask.includes('「=」나 생략은 쓰지 않는다') && !ask.includes('[=]'));
  assert.ok(ask.includes('restore|reintroduc|rewrite|replace|migrat') && ask.includes('문서로만 폐기') && ask.includes('기능 일부(이름)') && ask.includes('공유: B05·B07') && ask.includes('자료마다(어떤 자료)'));
  for (const ck of ['CK1', 'CK2', 'CK3', 'CK4', 'CK5', 'CK6']) assert.ok(ask.includes(`\n${ck} `), ck);
  assert.ok(ask.includes('전수 조사라는 뜻이 아니다') && ask.includes('접근 가능한 이력에서 이 검색으로 찾지 못함'));
  assert.ok(ask.includes('「〔기록 AF5-12345678 · 쪽 {n} · 기준 {sha} · 앞 쪽 {n-1}〕'));
  assert.equal(ask.split('AF5-12345678').length - 1, 2);
  assert.match(R.newRecordIdV5(), /^AF5-[0-9a-f]{8}$/);
  assert.ok(ask.length > 9500 && ask.length <= 12000, String(ask.length));
  // Every header row the request asks for parses with no diagnostic.
  for (const id of [...T.Q1_TABLES, ...T.Q2_TABLES, ...T.PAGE_END_TABLES]) { const t = T.V5_TABLE_DEFS.get(id); if (!t.columns.length) continue;
    assert.deepEqual(T.readRecordTables(`〔기록 AF5-1 · 쪽 1 · 기준 abc1234 · 앞 쪽 —〕 x 기록 v5\n${t.id} ${t.title}\n${T.headerLine(t)}\n|${'---|'.repeat(t.columns.length)}`).diagnostics, [], id); }
});

test('ASK-12 (v5) neither the base, page nor supplementary request carries a word of the eight validation repositories or their answer tables', () => {
  const texts = [R.recordAskV5(), R.pageAsk([page(1)]).text, R.supplementaryAsk([page(1), page(2)]).text];
  for (const text of texts) for (const w of WORDS) assert.ok(!has(text, w), w);
});

test('ASK-14 the page request: the app\'s own remaining obligations, the rows written, the next IDs and only the tables still to write with the rules they need; never the whole base request', () => {
  const plan = R.pageAsk([page(1)]);
  assert.deepEqual([plan.recordId, plan.basis, plan.project, plan.page, plan.level], ['AF5-3b7e0c19', '9f2c1ab', '물주기', 2, 1]);
  assert.deepEqual(plan.tables, T.Q2_TABLES);
  assert.ok(plan.text.startsWith('[AgentFlow 기록 쪽 요청 v5 · 기록 AF5-3b7e0c19 · 쪽 2]'));
  assert.ok(plan.text.includes('「〔기록 AF5-3b7e0c19 · 쪽 2 · 기준 9f2c1ab · 앞 쪽 1〕 물주기 기록 v5 (쓴 세션, 날짜·시각)」'));
  assert.ok(plan.text.includes('- 예약 풀기 D01: 등록 요청') && plan.text.includes('- 단계 미전개 반복 C-LOOP B06:L01'));
  assert.ok(plan.text.includes('C-LINK LN01–LN09') && plan.text.includes('C-PART B01–B10'));
  assert.ok(/다음 ID: F08 · E05 · D01 · X01 · N01 · K01 · B11/.test(plan.text));
  assert.ok(!plan.text.includes(R.FAMILY_RULES), 'C-PART is written: its criteria are not repeated');
  assert.ok(plan.text.includes(R.HISTORY_SEARCH), 'C-CHANGE is still to write');
  for (const s of R.NO_INVENTION_V5) assert.ok(plan.text.includes(s));
  assert.ok(plan.text.length < R.recordAskV5().length);
  // A page that leaves C-LINK 이어짐 asks for C-LINK first; a family word outside the list asks for 「교체」 with the criteria.
  const open = R.pageAsk([page(1).replace('|C-LINK|끝남|LN01–LN09|', '|C-LINK|이어짐|LN01–LN09|')]);
  assert.equal(open.tables[0], 'C-LINK');
  const bad = R.pageAsk([page(1).replace('|B05|일정 계산기|처리 · 계산|', '|B05|일정 계산기|엔진|')]);
  assert.ok(bad.text.includes('- 고칠 것 C-PART B05: 표현군·역할이 고정 낱말 밖') && bad.text.includes(R.FAMILY_RULES));
  // A missing page asks for that page; level 2 asks no page.
  const gap = R.pageAsk([page(1), page(2).replace('쪽 2 · 기준 9f2c1ab · 앞 쪽 1', '쪽 3 · 기준 9f2c1ab · 앞 쪽 2')]);
  assert.equal(gap.page, 2); assert.ok(gap.text.includes('쪽 2이 앱에 없다'));
  assert.equal(R.pageAsk([page(1), page(2)]), null);
  assert.equal(R.pageAsk(['한 줄 메모']), null);
});

test('ASK-15 the supplementary request only after level 2, only the groups the record\'s gaps call for, a group the record wrote never asked again', () => {
  assert.equal(R.supplementaryAsk([page(1)]), null);
  const plan = R.supplementaryAsk([page(1), page(2)]);
  assert.deepEqual(plan.groups, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
  assert.ok(plan.text.includes('\nP4-02 상태 전이\n') && plan.text.includes('썼음 / 해당 없음 / 미조사 / 후속 필요'));
  const after = R.supplementaryAsk([page(1), page(2), page(3)]);
  assert.deepEqual(after.groups, ['P3', 'P4']);
  assert.ok(!after.text.includes('\nP1-02 처리 사슬\n') && after.page === 4);
});

test('ASK-16 the paste check of a v5 answer: pages split at their heads, counted in characters, a missing C-END, a family word outside the list, an unresolved cite and the app\'s own level', () => {
  const both = R.checkReport(`${page(1)}\n${page(2)}`);
  assert.equal(both.kind, 'record-v5');
  assert.deepEqual(both.pages.map(p => [p.recordId, p.page, p.chars <= p.limit, p.end, p.family, p.badRows, p.badCites]), [['AF5-3b7e0c19', 1, true, true, 0, 0, 0], ['AF5-3b7e0c19', 2, true, true, 0, 0, 0]]);
  assert.deepEqual([both.level, both.missing, both.cut, both.passesUnrun], [2, [], [], 0], '끝남 and 완료 단계 are no passes');
  assert.ok(R.reportCheckLine(both).text.startsWith('기록 v5 점검 · 쪽 2개 · 1:') && R.reportCheckLine(both).text.includes('앱이 센 완료: 상세 완료'));
  const broken = R.checkReport(page(1).replace('|B05|일정 계산기|처리 · 계산|', '|B05|일정 계산기|엔진|').replace('|LN04|B03|B04|화분 행|호출마다|—|네트워크|정의된 관계|F02|', '|LN04|B03|B04|화분 행|호출마다|—|네트워크|정의된 관계|F99|').replace(/C-END 쪽 끝[\s\S]*$/, ''));
  assert.deepEqual([broken.pages[0].family, broken.pages[0].badCites, broken.missing, broken.level], [1, 1, ['쪽 1 C-END'], 0]);
  const again = R.reportCheckLine(broken).again;
  assert.ok(again.includes('교체 B07') && again.includes('「=」 대신 ID'));
});

test('ASK-17 the screens\' status line of a pasted v5 record: 「첫 구조 · 상세 남음 N」 from the app\'s own count, then 상세 완료', async () => {
  const { recordStatusLine } = await import('../dist/public/client/record-asks.js');
  assert.equal(recordStatusLine([page(1)]), `첫 구조 · 상세 남음 ${T.Q2_TABLES.length}`);
  assert.equal(recordStatusLine([page(1), page(2)]), '상세 완료 · 기록 AF5-3b7e0c19 쪽 2개');
  assert.ok(recordStatusLine([page(1).replace('|C-LINK|끝남|LN01–LN09|', '|C-LINK|이어짐|LN01–LN09|')]).startsWith('첫 구조 진행 중 · 남은 의무 '));
  assert.equal(recordStatusLine(['한 줄 메모']), null);
});
