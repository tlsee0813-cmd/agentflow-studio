// The status-report request a person carries to the AI session that knows their project: its sections, its evidence tags, its
// bounds, and the delta request built from a map's own names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT_REPORT_ASK, CHAT_REPORT_ASK, REPORT_ASK_EXPLAIN, REPORT_TAGS, deltaReportAsk, checkReport, reportCheckLine, REPORT_FIRST_CHARS } from '../dist/public/shared/report-ask.js';
import { buildExample, EXAMPLES } from '../dist/public/shared/studio-examples.js';
import { studioView } from '../dist/public/shared/studio.js';

test('ASK-1 the full request asks for the units, containment, arrows with what is handed over, evidence tags, withdrawals, the next gate and unknowns', () => {
  for (const must of ['부분(표)', '“A 안에 B·C”', 'A → B: 넘기는 것', '[설계]', '[관찰]', '옛 결정 → 지금 → 근거', '다음 관문', '모르는 것', '[가림]', '12,000자', '이 요청문은 옮기지']) assert.ok(PROJECT_REPORT_ASK.includes(must), must);
  for (const tag of REPORT_TAGS) assert.ok(PROJECT_REPORT_ASK.includes(tag), tag);
  // A pass is a quote unless the session ran it; no lower bound on length (a floor makes an AI fill the room); no example values.
  assert.match(PROJECT_REPORT_ASK, /\[실행\]이 아니면 모두 인용/);
  assert.doesNotMatch(PROJECT_REPORT_ASK, /이상 써|자 이상/);
  assert.ok(PROJECT_REPORT_ASK.length <= 2000, String(PROJECT_REPORT_ASK.length));
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
