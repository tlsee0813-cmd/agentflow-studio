// The status-report request a person carries to the AI session that knows their project: its sections, its evidence tags, its
// bounds, and the delta request built from a map's own names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROJECT_REPORT_ASK, CHAT_REPORT_ASK, REPORT_ASK_EXPLAIN, REPORT_TAGS, deltaReportAsk, checkReport, reportCheckLine, REPORT_FIRST_CHARS, ownLinesTemplate, OWN_LINES, reflectAsk, plannedNote,
  REPORT_ASK_VERSION, DESIGN_RECORD_ASK, DESIGN_RECORD_ASK_VERSION, SCENARIO_RECORD_ASK, SCENARIO_RECORD_ASK_VERSION, RECORD_ASK_EXPLAIN, scenarioLedger, scenarioAskWithLedger, LEDGER_MAX_CHARS } from '../dist/public/shared/report-ask.js';
import { buildExample, EXAMPLES } from '../dist/public/shared/studio-examples.js';
import { studioView } from '../dist/public/shared/studio.js';
import { scenarioRecordLike } from '../dist/public/client/scenario-view.js';

// The v3 status report's sections and header rows, as the KORU report of 2026-11-03 has them.
const V3_SECTIONS = ['0. 기준', '1. 한 줄 요약', '2. 부분', '3. 묶음', '4. 연결', '5. 최근 소유자 요청과 실제 변화', '6. 철회·변경', '7. 지켜야 할 것과 하지 않기로 한 것', '8. 오류·미해결·할 일', '9. 다음 관문', '10. 모르는 것', '11. 가장 자신 없는 것'];
const V3_HEADERS = ['| 오늘 날짜·시각 | 브랜치·커밋 sha | 파일을 읽을 수 있는지 | 이 대화의 앞부분이 요약됐는지 |', '| 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태 단어 | 상태의 기준 시각 | 꼬리표 |',
  '| 부모 이름 | 자식 이름들 |', '| 보내는 부분 | 받는 부분 | 넘기는 것 | 언제·얼마나 자주 | 설계/관찰 | 꼬리표 |', '| 날짜 | 원한 것 | 바뀐 부분 이름 | 실제로 바뀐 것 | 확인 방법 |',
  '| 부분 이름 | 옛 결정 | 지금 | 근거·날짜 |', '| 부분 이름 | 규칙 한 줄 | 누가 정했나·언제 |', '| 부분 이름 | 무엇이 | 언제부터·근거 |', '| 부분 이름 | 무엇이 확인되면 | 무엇을 한다 | 언제쯤 |',
  '| 부분 이름 | 무엇을 | 어떻게 확인할 수 있나 |', '| 부분 이름 | 내용 |'];
test('ASK-1 the full request (현황 보고 v3) asks for the twelve sections in order with the sample\'s table header rows, evidence tags, withdrawals, the next gate and unknowns', () => {
  assert.equal(REPORT_ASK_VERSION, 'v3'); assert.ok(PROJECT_REPORT_ASK.startsWith('[AgentFlow 현황 기록 요청 v3]'));
  let at = 0; for (const sec of V3_SECTIONS) { const i = PROJECT_REPORT_ASK.indexOf(`\n${sec}\n`, at); assert.ok(i > at, sec); at = i; }
  for (const row of V3_HEADERS) assert.ok(PROJECT_REPORT_ASK.includes(`\n${row}\n`), row);
  for (const must of ['돌고 있음/작업 중/미구현/멈춤/폐기/모름', '그 밖 | 없음', '철회·폐기·채택 안 함', '[가림]', '12,000자', '이 요청문은 옮기지']) assert.ok(PROJECT_REPORT_ASK.includes(must), must);
  for (const tag of REPORT_TAGS) assert.ok(PROJECT_REPORT_ASK.includes(tag), tag);
  // A pass is a quote unless the session ran it; no lower bound on length (a floor makes an AI fill the room); no example values.
  assert.match(PROJECT_REPORT_ASK, /\[실행\]이 아니면 모두 인용/);
  assert.doesNotMatch(PROJECT_REPORT_ASK, /이상 써|자 이상/);
  assert.ok(PROJECT_REPORT_ASK.length <= 2400, String(PROJECT_REPORT_ASK.length));
});

test('ASK-2 the chat-only request forbids the file and run tags and names who said done', () => {
  assert.ok(CHAT_REPORT_ASK.includes('[파일]·[실행]은 쓰지 마'));
  assert.ok(CHAT_REPORT_ASK.includes('누가 말했는지'));
  assert.ok(CHAT_REPORT_ASK.includes('[대화:'));
  assert.ok(CHAT_REPORT_ASK.length <= 1200, String(CHAT_REPORT_ASK.length));
  assert.ok(REPORT_ASK_EXPLAIN.includes('[가림]'));
});

test('ASK-3 the delta request carries the map\'s own part names and states, the last reading\'s gaps, and "still unknown" as an answer', () => {
  const v = studioView(buildExample(EXAMPLES.find(e => e.id === 'salon')));
  const text = deltaReportAsk(v, [], new Date('2026-11-03T10:00:00Z'));
  for (const id of v.roots) assert.ok(text.includes(`- ${v.parts.find(p => p.id === id).name} —`), id);
  assert.ok(text.includes('여전히 모름')); assert.ok(text.includes('확인 못 함')); assert.ok(text.includes('지난 기준: 2026-11-03'));
  const reading = { version: 'map-reading.6', id: 'R1', at: '2026-11-01T00:00:00.000Z', model: 'm', prompt: 'p', hash: 'h', records: [], summary: '', parts: [], relations: [], candidates: [{ text: '감시 조건이 바뀌었는지', areaIds: [], at: null, quotes: [] }], gaps: ['엔진의 6시간 기준선'], skipped: [] };
  const later = deltaReportAsk(v, [reading]);
  assert.ok(later.includes('- 엔진의 6시간 기준선')); assert.ok(later.includes('- 감시 조건이 바뀌었는지')); assert.ok(later.includes('지난 기준: 2026-11-01'));
  assert.ok(later.length <= 3000, String(later.length));
});

test('ASK-4 the report check counts tagged and untagged lines, passes nobody vouches for, missing sections and what the cut leaves out; a plain note is not checked', () => {
  assert.equal(checkReport('그냥 메모입니다. 통과했어요.'), null);
  const report = ['2. 부분(표)', '엔진 | 행을 합성한다 | code/engine.py | 돌고 있음 | [파일: code/engine.py]', '카드 러너 | 카드를 쓴다 | runner.py | 작업 중 [보고: ops 11-02]',
    '3. 연결', '카드 러너 → 엔진: review 행을 카드 박자마다 [설계]', '테스트가 모두 통과했다.', '검사 rc 0 [실행: npm test]', '5. 철회·변경', '옛 결정 → 지금 → 근거 [파일: STATE.md]',
    '8. 다음 관문', 'TX 라벨이 찍히면 → e=1 ON [추정]', '9. 모르는 것', '미니PC의 지금 상태 [모름]', '사이드카가 돌고 있는지 [모름]', '이 줄에는 꼬리표가 없습니다 정말로'].join('\n');
  const c = checkReport(report);
  assert.ok(c); assert.equal(c.untagged, 2); assert.equal(c.passesUnrun, 1); assert.deepEqual(c.missing, []); assert.deepEqual(c.cut, []);
  assert.ok(c.tagged >= 8);
  const line = reportCheckLine(c);
  assert.ok(line.text.startsWith('보고서 점검 ·')); assert.ok(line.again && line.again.includes('[보고: 출처]'));
  const long = `${'가'.repeat(REPORT_FIRST_CHARS + 10)}\n9. 모르는 것 [모름] [모름] [모름] [모름] [모름]\n`;
  const lc = checkReport(long); assert.ok(lc); assert.ok(lc.cut.includes('모르는 것')); assert.ok(lc.missing.includes('다음 관문'));
});

test('ASK-5 the person\'s own three lines come as a dated record of their own words', () => {
  const t = ownLinesTemplate(new Date('2026-11-03T12:00:00Z'));
  assert.ok(t.startsWith('[프로젝트 소유자가 직접 적음 · 2026-11-03]'));
  for (const l of OWN_LINES) assert.ok(t.includes(`${l}: `), l);
});

test('ASK-6 the understanding check lists the map\'s summary, parts, relations and gaps as numbered lines and asks only for corrections', () => {
  const v = studioView(buildExample(EXAMPLES.find(e => e.id === 'salon')));
  const text = reflectAsk(v, []);
  assert.ok(text.startsWith('[AgentFlow 이해 확인 요청'));
  for (const id of v.roots) assert.ok(text.includes(`부분 ${v.parts.find(p => p.id === id).name}`), id);
  assert.ok(/\n1\. /.test(text)); assert.ok(text.includes('틀린 줄만')); assert.ok(text.includes('확인 못 함'));
  assert.ok(text.length <= 12000, String(text.length));
  assert.equal(plannedNote('TX 라벨 확인 뒤 e=1 ON을 지시할 계획이다.'), true); assert.equal(plannedNote('review.jsonl 행을 카드 박자마다 넘긴다.'), false);
});

test('ASK-7 the design record request (설계 기록 v1) names the six tables with their columns, the type words, the path-alias line, the tags, [모름] for code not read, no invented step, no re-summary and the size cap', () => {
  assert.equal(DESIGN_RECORD_ASK_VERSION, 'v1'); assert.ok(DESIGN_RECORD_ASK.startsWith('[AgentFlow 설계 기록 요청 v1]'));
  const tables = [['1. 부분 유형', '| 이름 | 유형 | 한 줄 |'], ['2. 산출물', '| 이름 | 필드 | 만드는 부분 | 읽는 부분 | 있는 곳 | 꼬리표 |'], ['3. 부분별 설계', '| 이름 | 받는 산출물 | 안의 단계 | 내는 산출물 | 설정 | 꼬리표 |'],
    ['4. 안의 단계', '| 부분 이름 | 순번 | 단계 이름 | 하는 일 한 줄 | 쓰는 파일·함수·모델 | 조건·분기 | 꼬리표 |'], ['5. 조건·거부·분기', '| 부분 이름 | 조건 | 참이면 | 거짓이면 | 꼬리표 |'], ['6. 파일 지도', '| 경로 | 속한 부분 | 역할 한 줄 | 꼬리표 |']];
  let at = 0; for (const [title, row] of tables) { const i = DESIGN_RECORD_ASK.indexOf(`\n${title}\n${row}\n`, at); assert.ok(i > at, title); at = i; }
  assert.ok(DESIGN_RECORD_ASK.includes('사람 / 세션 / 루프·엔진 / 행 파일·저장소 / AI 판단 / 타이머·일정 / 계산 / 수집기 / 외부 시스템'));
  for (const w of ['사람', '세션', '루프', '엔진', '행 파일', '저장소', 'AI 판단', '타이머', '일정', '계산', '수집기', '외부 시스템']) assert.ok(DESIGN_RECORD_ASK.includes(w), w);
  for (const must of ['경로 약속: 별칭 = 경로', '「·」로 잇고', '괄호는 그대로', '실행 순서대로', '지어내거나', '현황 보고를 다시 요약하지 마', '코드를 읽지 않은 칸·줄은 [모름]', '12,000자', '생략한 것:', '[가림]', '이 요청문은 옮기지']) assert.ok(DESIGN_RECORD_ASK.includes(must), must);
  for (const tag of REPORT_TAGS) assert.ok(DESIGN_RECORD_ASK.includes(tag), tag);
  assert.doesNotMatch(DESIGN_RECORD_ASK, /이상 써|자 이상/);
  assert.ok(DESIGN_RECORD_ASK.length <= 2400, String(DESIGN_RECORD_ASK.length));
  assert.ok(RECORD_ASK_EXPLAIN.design.length > 0 && RECORD_ASK_EXPLAIN.status === REPORT_ASK_EXPLAIN);
});

test('ASK-8 the scenario record request (시나리오 기록 v2) is the map design spec §8.2 verbatim after one line about the attached ledger: the 14 common rules, the six groups ①–⑥ and the size caps', () => {
  assert.equal(SCENARIO_RECORD_ASK_VERSION, 'v2');
  const spec = readFileSync(new URL('../../../docs/design/MAP_DESIGN_SPEC_KO.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const end = '완결 경로 대신 정확한 부분 경로를 반환하라.';
  const from = spec.indexOf('> 목적은 현재 자료로'), to = spec.indexOf(end, from) + end.length;
  assert.ok(from > 0 && to > from);
  const block = spec.slice(from, to).split('\n').map(l => l.replace(/^> ?/, '')).join('\n');
  assert.ok(SCENARIO_RECORD_ASK.endsWith(block), 'spec §8.2 verbatim');
  const [head, line] = SCENARIO_RECORD_ASK.split('\n');
  assert.equal(head, '[AgentFlow 시나리오 기록 요청 v2]'); assert.match(line, /ID 대장.*붙어 있다/);
  for (let i = 1; i <= 14; i++) assert.match(SCENARIO_RECORD_ASK, new RegExp(`\\n${i}\\. `), `rule ${i}`);
  assert.doesNotMatch(SCENARIO_RECORD_ASK, /\n15\. /);
  for (const g of ['**① 기준과 목적**', '**② 시작**', '**③ 방문**', '**④ 이어짐**', '**⑤ 끝**', '**⑥ 근거와 빈칸**']) assert.ok(SCENARIO_RECORD_ASK.includes(g), g);
  for (const cap of ['시나리오 1개', '방문 최대 16개', '이어짐 최대 20개', '전체 표 데이터 행은 최대 80개', '12,000자 이내', '100자 이내', '240자 이내']) assert.ok(SCENARIO_RECORD_ASK.includes(cap), cap);
  assert.match(RECORD_ASK_EXPLAIN.scenario, /따로 붙여 넣어 보관/); assert.match(RECORD_ASK_EXPLAIN.scenario, /AI 없이 같은 대장과 맞춰 길로 읽어/); assert.doesNotMatch(RECORD_ASK_EXPLAIN.scenario, /아직 길로 읽지는/);
});

test('ASK-9 the ID ledger lists parts with their app ids, relations with what they hand over, stores and handed-over names, fields, ports, steps and rules, names the ledger version, and caps at 8,000 characters', () => {
  const v = studioView(buildExample(EXAMPLES.find(e => e.id === 'salon')));
  const plain = scenarioLedger(v, []);
  assert.ok(plain.startsWith('[ID 대장] 대장 판본: 지도 읽기 없음'));
  v.parts.forEach((p, i) => assert.ok(plain.includes(`\nP${String(i + 1).padStart(2, '0')} ${p.name} (${p.id})`), p.name));
  assert.ok(v.relations.length > 0);
  const name = id => v.parts.find(p => p.id === id).name;
  v.relations.forEach((r, i) => assert.ok(plain.includes(`\nR${String(i + 1).padStart(2, '0')} P`) && plain.includes(` ${name(r.from)} → P`) && plain.includes(` ${name(r.to)}: `), r.id));
  // A relation's own note is said on its R line but is a description, not a handed-over name: no A line from it.
  assert.ok(plain.includes(`: ${v.relations[0].note}`)); assert.doesNotMatch(plain, /\nA01 /);
  // A store part read with its fields, ports, steps and a rule; a reading that names a relation's payload; the version line.
  const store = v.parts[0], rel = v.relations[0];
  store.reading = { typeRead: { type: 'store', quote: null, at: 'x' }, fields: ['watch', 'valid_until'], inputs: ['패킷'], outputs: ['review 행'], steps: [{ name: '봉투 검사', does: '동시·쪽 확인', uses: [], quote: null, at: 'x' }],
    claims: [{ kind: 'reports', text: '노출은 잔고로만 조절한다', topic: 'rule' }, { kind: 'reports', text: '돌고 있다', topic: 'status' }] };
  const reading = { version: 'map-reading.9', id: 'MR7', at: '2026-11-03T09:05:00.000Z', model: 'm', prompt: 'p', hash: 'h', records: [], summary: '', parts: [], relations: [{ relationId: rel.id, from: rel.from, to: rel.to, kind: rel.kind, quote: null, payload: 'review.jsonl 행' }], candidates: [], gaps: [], skipped: [] };
  const text = scenarioAskWithLedger(v, [reading]);
  assert.ok(text.startsWith(SCENARIO_RECORD_ASK));
  for (const must of ['[ID 대장] 대장 판본: MR7 · 2026-11-03T09:05:00.000Z', `A01 ${store.name} (P01 저장소)`, ': review.jsonl 행\n', 'A02 review.jsonl 행 (R01', 'F01 A01 watch', 'F02 A01 valid_until', 'P01 받음: 패킷', 'P01 냄: review 행', 'S01 P01 봉투 검사: 동시·쪽 확인', 'Q01 P01: 노출은 잔고로만 조절한다']) assert.ok(text.includes(must), must);
  assert.ok(!text.includes('돌고 있다'));
  // The cap: many parts are listed up to 8,000 characters and the rest counted on one line; each item is one line.
  const many = { parts: Array.from({ length: 400 }, (_, i) => ({ id: `A_${i}`, name: `부분 ${'가'.repeat(30)} ${i}`, parentId: null, reading: null })), relations: [], roots: [], records: [] };
  const big = scenarioLedger(many, []);
  assert.ok(big.length <= LEDGER_MAX_CHARS, String(big.length)); assert.equal(LEDGER_MAX_CHARS, 8000);
  const m = /\n…대장 (\d+)개 생략$/.exec(big); assert.ok(m);
  assert.equal(big.split('\n').filter(l => /^P\d+ /.test(l)).length + Number(m[1]), 400);
});

test('ASK-10 the check reads a design record against its six tables, and skips header rows and the containment and unknowns rows of a status report', () => {
  const design = ['KORU 설계 기록 v1 (검토 세션)', '경로 약속: R = code/engine.py', '1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|', '| 엔진 | 루프·엔진 | 행 셋 → 집행 [파일: R] |',
    '2. 산출물', '| review 행 | watch·valid_until | 카드 러너 | 엔진 | race/ | [파일: R] |', '3. 부분별 설계', '| 엔진 | review 행 | 4절 | 주문 | 동시 1 | [파일: R] |',
    '4. 안의 단계', '| 엔진 | 1 | 봉투 검사 | 동시·쪽 | row_answer | — | [파일: R] |', '5. 조건·거부·분기', '| 엔진 | not watch | REVIEW_OFF | 다음 | [파일: R] |', '6. 파일 지도', '| code/engine.py | 엔진 | 루프 | [모름] |', '생략한 것: 없음'].join('\n');
  const d = checkReport(design); assert.ok(d);
  assert.equal(d.kind, 'design'); assert.deepEqual(d.missing, []); assert.equal(d.untagged, 0); assert.equal(d.tagged, 6);
  assert.ok(reportCheckLine(d).text.startsWith('설계 기록 점검 ·'));
  const status = ['X 현황 보고서 (v3 표 형식)', '2. 부분', '| 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태 단어 | 상태의 기준 시각 | 꼬리표 |', '|---|---|---|---|---|---|', '| 엔진 | 집행 | code/ | 돌고 있음 | 11-03 | [파일: code/] |',
    '3. 묶음', '| 부모 이름 | 자식 이름들 |', '|---|---|', '| 카드 러너 | 편집장 |', '4. 연결', '| 엔진 | 바이낸스 | 주문 | 수시 | 관찰 | [보고: ops 11-03] |', '6. 철회·변경', '| 엔진 | 옛것 | 지금 | [보고: 감독 10-31] |',
    '9. 다음 관문', '| 성적표 | 장이 나오면 | 읽는다 | 11-04 [추정] |', '10. 모르는 것', '| 엔진 | 08:49Z 뒤 실제 상태 | STATUS 첫 줄 |', '11. 가장 자신 없는 것', '| 엔진 | 돌고 있음은 인용이다 [추정] |'].join('\n');
  const c = checkReport(status); assert.ok(c);
  assert.equal(c.kind, 'status'); assert.equal(c.untagged, 0); assert.equal(c.tagged, 5); assert.deepEqual(c.missing, []);
});

test('ASK-11 on paste a scenario record (시나리오 기록 v2) is told apart by its tables: the paste box reads it as a path, while the report check leaves it alone', () => {
  // The request's own groups written back as tables (the header rows the scenario reader knows), as an AI answers it.
  const heads = SCENARIO_RECORD_ASK.split('\n').filter(l => /^\*\*[①②③④⑤]/.test(l)).map(l => l.split(' — ')[1]);
  assert.equal(heads.length, 5);
  const blocks = heads.map(h => [`| ${h} |`, `|${'---|'.repeat(h.split(' | ').length)}`, `| ${h.split(' | ').map(() => '모름').join(' | ')} |`].join('\n'));
  const tables = blocks.join('\n\n');
  assert.equal(scenarioRecordLike(tables), true);
  // The visit and link tables alone, as the bold headings may be dropped.
  assert.equal(scenarioRecordLike([blocks[2], blocks[3]].join('\n\n')), true);
  // A status report, a design record and the request itself (its groups as prose lines, no table) are not scenario records.
  assert.equal(scenarioRecordLike(SCENARIO_RECORD_ASK), false);
  assert.equal(scenarioRecordLike(PROJECT_REPORT_ASK), false); assert.equal(scenarioRecordLike(DESIGN_RECORD_ASK), false);
  assert.equal(scenarioRecordLike('| 이름 | 유형 | 한 줄 |\n|---|---|---|\n| 엔진 | 루프·엔진 | 집행 [파일: R] |'), false);
  assert.equal(checkReport(tables), null, 'no evidence tags: not checked as a report');
});

