// The scenario on the map (spec §3, cycle 3), the client's pure part: a pasted scenario record told from other records, each
// visit's badge on the card that stands for its part (visits of one part stacked in visit order, past two by count), visits with
// no place (끊긴 자리, outside the view), the first broken place of a partial path at the last valid visit before it, the path's
// relations, and the start and end heads' texts as the record said them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarioRecordLike, recordTables, recordRows, badgePlaces, brokenPlace, headTexts, pathRelations, visitLinks, linkTitle, visitNumber, scenarioLabel, scenarioResultLine, saidText } from '../dist/public/client/scenario-view.js';
import { parseScenarioRecord, applyScenario, scenarioUnderstanding, projectLedger } from '../dist/public/shared/scenario-record.js';
import { createProject, addArea, addRelation, pasteRecord } from '../dist/public/shared/domain.js';

/** Four parts through a store: a collector, an engine, the store, an order runner; three flow relations. */
function fixture() {
  let p = createProject();
  for (const n of ['패킷 수집기', '판정 엔진', 'review 저장소', '주문 실행기']) p = addArea(p, n);
  const [c, e, s, o] = p.space.areas.map(a => a.id);
  p = addRelation(p, c, e, 'flow', '패킷을 넘김'); p = addRelation(p, e, s, 'flow', 'review 행을 씀'); p = addRelation(p, s, o, 'flow', '새 행을 읽음');
  return { p, ids: { c, e, s, o }, rels: p.space.relations.map(r => r.id) };
}
const ROW = (cells) => `| ${cells.join(' | ')} |`;
/** A scenario record (v2) against a map with no map reading: four visits through the store, a wait on the store's reader. */
function record({ visits, links, end = ['X01', 'V04', '주문 한 건 전송', 'GO일 때만 주문이 나간다', 'NO_GO면 쉼; 동시 초과면 멈춤', 'V04 주문 전송', '체결 여부는 모름', 'E01'] } = {}) {
  const V = visits ?? [['V01', 'P01', '모름', '모름', '없음', '모름', '없음', 'E01'], ['V02', 'P02', '모름', '모름', '모름', '모름', '없음', 'E01'],
    ['V03', 'P03', '없음', '모름', '모름', '모름', '없음', 'E01'], ['V04', 'P04', '모름', '모름', '모름', '모름', '없음', 'E01']];
  const L = links ?? [['L01', 'V01', 'V02', 'R01', 'next', '없음', '없음', 'E01'], ['L02', 'V02', 'V03', 'R02', 'next', '없음', '없음', 'E01'],
    ['L03', 'V03', 'V04', 'R03', 'wait', '없음', '재개 사건: review 행 추가', 'E01']];
  return `시나리오 기록 v2

**① 기준과 목적**
| 시나리오 ID | 이름 | 관련 요청 ID 또는 원문 위치 | ID 대장 판본 | 설계 판본 | 현황 기준 시각 | 종류 | 실행 ID·실행 범위 또는 모름 | 선택 이유 | 근거 E |
|---|---|---|---|---|---|---|---|---|---|
| C01 | 패킷 한 건이 주문이 되기까지 | 모름 | 지도 읽기 없음 | 설계 기록 v1 | 모름 | 설계 경로 | 모름 | 설명 목적 | E01 |

**② 시작**
| 시작 ID | 촉발 사건 | 시작 대상 P/O/S | 시작 조건 원문·Q 참조 | 필요한 이전 상태 | 이 촉발이 다른 동작과 독립적인지 | 근거 E |
|---|---|---|---|---|---|---|
| T01 | 새 패킷 도착 | P01 | 없음 | 수집기 실행 중 | 독립 | E01 |

**③ 방문**
| 방문 V | 부분 P | 단계 S 또는 모름 | 포트 O 또는 모름 | 필요한 입력 A | 이 방문이 내놓는 출력 A | 관측 실행일 때 사건 식별자 | 근거 E |
|---|---|---|---|---|---|---|---|
${V.map(ROW).join('\n')}

**④ 이어짐**
| 이어짐 L | 출발 V | 도착 V | 기존 연결 R | 뜻: next/branch/parallel/loop/wait | 조건 원문·Q 참조 | 반복 단위·합류 정책·재개 사건 중 해당 내용 | 근거 E |
|---|---|---|---|---|---|---|---|
${L.map(ROW).join('\n')}

**⑤ 끝**
| 끝 ID | 도달 방문 V 또는 모름 | 설계가 내놓는 결과 | 바라는 결과·요청 참조 | 이탈·거절·중단 결과 | 마지막 확인 지점 | 두 결과의 차이·미정 | 근거 E |
|---|---|---|---|---|---|---|---|
${ROW(end)}

**⑥ 근거와 빈칸**
| E | 뒷받침하는 행·열 | 제공된 자료 종류: 파일/실행/보고 | 원문 자료·위치 | 판본·실행 ID | 정확 인용 또는 원문 미제공 | 명시적 내용/보고자 추정 |
|---|---|---|---|---|---|---|
| E01 | ③ 전체 | 파일 | code/engine.py:120 | a1b2c3d | if verdict == 'GO': write_review(row) | 명시적 내용 |
`;
}
function read(text, base = fixture()) {
  const { project, record: r } = pasteRecord(base.p, text, null);
  const parsed = parseScenarioRecord(r.text, projectLedger(project));
  const q = applyScenario(project, r.id, parsed, { id: 'SC_1', at: '2026-11-04T01:00:00.000Z' });
  return { ...base, q, parsed, entry: q.readings.at(-1), u: scenarioUnderstanding(q, 'SC_1'), text: r.text };
}
const same = id => id;

test('SV-1 a pasted scenario record is told by its tables (the visit and link tables, or four of the six groups), never a status report', () => {
  const text = record();
  assert.equal(scenarioRecordLike(text), true);
  assert.deepEqual([...recordTables(text)].sort(), ['end', 'evidence', 'links', 'scenario', 'start', 'visits']);
  // Visit and link tables alone are enough; four groups without them too.
  assert.equal(scenarioRecordLike(text.slice(text.indexOf('**③'), text.indexOf('**⑤'))), true);
  const noPath = text.replace(/\*\*③[\s\S]*?\*\*⑤/, '**⑤');
  assert.equal(scenarioRecordLike(noPath), true, 'scenario · start · end · evidence');
  assert.equal(scenarioRecordLike(noPath.replace(/\*\*② 시작\*\*[\s\S]*?\*\*⑤/, '**⑤')), false, 'three groups are not a record');
  // A status report's tables and a plain note are not.
  assert.equal(scenarioRecordLike('| 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태 단어 |\n|---|---|---|---|\n| 엔진 | 판정 | engine/ | 돌고 있음 |'), false);
  assert.equal(scenarioRecordLike('방문 V01 다음 이어짐 L01 — 표가 아닌 글'), false);
  // Rows as written, by table.
  assert.deepEqual(recordRows(text, 'visits').map(r => r[0]), ['V01', 'V02', 'V03', 'V04']);
  assert.deepEqual(recordRows(text, 'links').map(r => [r[1], r[2], r[4]]), [['V01', 'V02', 'next'], ['V02', 'V03', 'next'], ['V03', 'V04', 'wait']]);
});

test('SV-2 a badge per visited card from byArea, in visit order; a store keeps its own badge; the wait leaves its glyph on the destination with what resumes it', () => {
  const { u, ids, rels } = read(record());
  assert.equal(u.pathStatus, 'complete');
  const { places, gone, outside } = badgePlaces(u, same);
  assert.deepEqual(places.map(p => [p.box, p.shown.map(v => v.n), p.more]), [[ids.c, ['1'], 0], [ids.e, ['2'], 0], [ids.s, ['3'], 0], [ids.o, ['4'], 0]]);
  assert.deepEqual(gone, []); assert.deepEqual(outside, []);
  const four = places[3].visits[0];
  assert.deepEqual(four.glyphs.map(g => [g.kind, g.glyph, g.link]), [['wait', '⏳', 'L03']]);
  assert.match(four.glyphs[0].title, /대기 L03 \(V03→V04\) · 재개 사건: review 행 추가/);
  assert.match(four.title, /^방문 4 \(V04\) · 주문 실행기/);
  assert.deepEqual(places[1].visits[0].glyphs, [], 'a plain next leaves no glyph');
  assert.deepEqual(pathRelations(u), rels);
  assert.deepEqual(visitLinks(u, 'V03').into.map(l => l.id), ['L02']); assert.deepEqual(visitLinks(u, 'V03').out.map(l => l.id), ['L03']);
});

test('SV-3 repeated visits of one part stack on its one badge (1 · 3), past two by count (+N), never a range; folded parts share their drawn card', () => {
  const visits = [['V01', 'P02', '모름', '모름', '모름', '모름', '없음', 'E01'], ['V02', 'P03', '모름', '모름', '모름', '모름', '없음', 'E01'], ['V03', 'P02', '모름', '모름', '모름', '모름', '없음', 'E01'],
    ['V04', 'P02', '모름', '모름', '모름', '모름', '없음', 'E01'], ['V05', 'P02', '모름', '모름', '모름', '모름', '없음', 'E01']];
  const links = [['L01', 'V01', 'V02', 'R02', 'next', '없음', '없음', 'E01'], ['L02', 'V02', 'V03', 'R02', 'loop', '없음', '각 행마다', 'E01']];
  const { u, ids } = read(record({ visits, links, end: ['X01', 'V05', '모름', '모름', '모름', 'V05', '모름', 'E01'] }));
  const engine = badgePlaces(u, same).places.find(p => p.box === ids.e);
  assert.deepEqual(engine.visits.map(v => v.n), ['1', '3', '4', '5']);
  assert.deepEqual(engine.shown.map(v => v.n), ['1', '3']); assert.equal(engine.more, 2);
  assert.deepEqual(engine.visits[1].glyphs.map(g => g.glyph), ['↻']);
  // Two areas drawn as one card (the store folded into the engine's card): one badge, still in visit order.
  const folded = badgePlaces(u, id => (id === ids.s ? ids.e : id)).places;
  assert.equal(folded.length, 1); assert.deepEqual(folded[0].visits.map(v => v.id), ['V01', 'V02', 'V03', 'V04', 'V05']); assert.deepEqual(folded[0].areaIds.sort(), [ids.e, ids.s].sort());
});

test('SV-4 a visit whose part left the map has no badge (끊긴 자리); one outside the view has none here', () => {
  const r = read(record());
  const q = structuredClone(r.q); q.space.areas.find(a => a.id === r.ids.s).archived = true;
  const u = scenarioUnderstanding(q, 'SC_1');
  const lay = badgePlaces(u, id => (id === r.ids.o ? null : id));
  assert.deepEqual(lay.gone.map(v => v.id), ['V03']); assert.deepEqual(lay.outside.map(v => v.id), ['V04']);
  assert.deepEqual(lay.places.map(p => p.visits[0].id), ['V01', 'V02']);
  // The heads go to visits on the map only: the end head stands below the last one there.
  assert.equal(headTexts(u).endVisit, 'V04', 'V04 is on the map (only outside this view)');
});

test('SV-5 a partial path: the first set-aside visit breaks after the last valid visit before it (여기서 끊김 there); nothing is re-joined', () => {
  const visits = [['V01', 'P01', '모름', '모름', '없음', '모름', '없음', 'E01'], ['V02', 'P02', '모름', '모름', '모름', '모름', '없음', 'E01'],
    ['V03', 'P03', '없음', '모름', '모름', '모름', '없음', 'E01'], ['V04', 'P09', '모름', '모름', '모름', '모름', '없음', 'E01'], ['V05', 'P04', '모름', '모름', '모름', '모름', '없음', 'E01']];
  const links = [['L01', 'V01', 'V02', 'R01', 'next', '없음', '없음', 'E01'], ['L02', 'V02', 'V03', 'R02', 'next', '없음', '없음', 'E01'],
    ['L03', 'V03', 'V04', 'R03', 'wait', '없음', '재개 사건: review 행 추가', 'E01'], ['L04', 'V04', 'V05', 'R03', 'next', '없음', '없음', 'E01']];
  const { u, entry, text } = read(record({ visits, links, end: ['X01', 'V05', '주문 한 건 전송', '모름', '없음', 'V05', '모름', 'E01'] }));
  assert.equal(u.pathStatus, 'partial');
  assert.deepEqual(u.visits.map(v => v.id), ['V01', 'V02', 'V03', 'V05']); assert.deepEqual(u.links.map(l => l.id), ['L01', 'L02']);
  const b = brokenPlace(u, entry.diagnostics, text);
  assert.deepEqual([b.visit, b.kind, b.row, b.ref], ['V03', 'visit', 3, 'V04']); assert.match(b.explanation, /P09/);
  // The very first visit set aside: no valid visit before it (the start head says it).
  const first = read(record({ visits: [['V01', 'P09', '모름', '모름', '모름', '모름', '없음', 'E01'], ...visits.slice(1, 3)], links: links.slice(1, 2), end: ['X01', 'V03', '모름', '모름', '없음', 'V03', '모름', 'E01'] }));
  const fb = brokenPlace(first.u, first.entry.diagnostics, first.text);
  assert.deepEqual([fb.visit, fb.kind, fb.ref], [null, 'visit', 'V01']);
  // A complete path has none.
  const whole = read(record()); assert.equal(brokenPlace(whole.u, whole.entry.diagnostics, whole.text), null);
});

test('SV-6 a set-aside link breaks after its start visit; with nothing set aside, a path that stops short breaks at its last confirmed visit', () => {
  const links = [['L01', 'V01', 'V02', 'R01', 'next', '없음', '없음', 'E01'], ['L02', 'V02', 'V03', 'R02', 'next', '없음', '없음', 'E01'], ['L03', 'V03', 'V04', 'R09', 'wait', '없음', '없음', 'E01']];
  const r = read(record({ links }));
  assert.equal(r.u.pathStatus, 'partial');
  const b = brokenPlace(r.u, r.entry.diagnostics, r.text);
  assert.deepEqual([b.visit, b.kind, b.row, b.ref], ['V03', 'link', 2, 'L03']); assert.match(b.explanation, /R09/);
  // An earlier set-aside link wins over a later one, and a visit before a link at the same place.
  const two = read(record({ links: [links[0], ['L02', 'V02', 'V03', 'R09', 'next', '없음', '없음', 'E01'], links[2]] }));
  assert.equal(brokenPlace(two.u, two.entry.diagnostics, two.text).ref, 'L02');
  // Nothing set aside, but the last confirmed point is not the reached visit.
  const short = read(record({ end: ['X01', 'V04', '주문 한 건 전송', '모름', '없음', 'V03 저장소까지', '체결 여부는 모름', 'E01'] }));
  assert.equal(short.u.pathStatus, 'partial');
  const sb = brokenPlace(short.u, short.entry.diagnostics, short.text);
  assert.deepEqual([sb.visit, sb.kind, sb.row], ['V03', 'end', null]); assert.match(sb.explanation, /V03.*V04/);
  // The end head then stands below the last confirmed visit, and says the result is not reached.
  const heads = headTexts(short.u);
  assert.equal(heads.endVisit, 'V03'); assert.match(heads.short, /결과 도달은 확인되지 않음/);
});

test('SV-7 the heads: trigger and wanted result above, what the design produces, the exits and the gap below, each as the record said it', () => {
  const { u } = read(record());
  const heads = headTexts(u);
  assert.equal(heads.startVisit, 'V01'); assert.equal(heads.endVisit, 'V04'); assert.equal(heads.short, null);
  assert.deepEqual(heads.start, [{ label: '촉발', text: '새 패킷 도착' }, { label: '바라는 결과', text: 'GO일 때만 주문이 나간다' }]);
  assert.deepEqual(heads.end, [{ label: '설계가 내놓는 결과', text: '주문 한 건 전송' }, { label: '이탈 결과', text: 'NO_GO면 쉼 · 동시 초과면 멈춤' }, { label: '남은 차이', text: '체결 여부는 모름' }]);
  // 모름 and 없음 stay apart; nothing is copied from one head into another.
  const unknown = read(record({ end: ['X01', 'V04', '모름', '없음', '모름', 'V04', '없음', 'E01'] }));
  assert.deepEqual(headTexts(unknown.u).end.map(x => x.text), ['모름', '모름', '없음']); assert.equal(headTexts(unknown.u).start[1].text, '없음');
});

test('SV-8 the words: visit numbers, the selector line, the paste result line, a link title for a branch without a condition', () => {
  assert.equal(visitNumber('V01'), '1'); assert.equal(visitNumber('V12'), '12');
  assert.equal(scenarioLabel('패킷 한 건', 'designed', 'partial'), '패킷 한 건 · 설계 경로 · 부분');
  assert.equal(scenarioLabel('unknown', null, 'rejected'), '이름 모름 · 종류 모름 · 거절');
  assert.equal(scenarioResultLine('C01', 4, 3, 'partial'), '시나리오 C01 · 방문 4 · 이어짐 3 · 부분(partial)');
  assert.equal(saidText('unknown'), '모름'); assert.equal(saidText(null), '없음'); assert.equal(saidText('x'), 'x');
  assert.equal(linkTitle({ id: 'L02', from: 'V02', to: 'V03', kind: 'branch', condition: 'unknown', policy: null }), '분기 L02 (V02→V03) · 조건 미상');
  assert.equal(linkTitle({ id: 'L03', from: 'V03', to: 'V04', kind: 'wait', condition: null, policy: 'unknown' }), '대기 L03 (V03→V04) · 재개 조건 미상');
});
