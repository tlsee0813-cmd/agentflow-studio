// The scenario record (시나리오 기록 v2) read by the program alone: six tables → one scenario object, every ledger reference
// resolved, the spec's exclusion units, the computed pathStatus, and the scenario-reading.1 entry kept exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScenarioRecord, applyScenario, scenarioUnderstanding, SCENARIO_LIMITS } from '../dist/public/shared/scenario-record.js';
import { buildLedger, scenarioLedger, scenarioAskWithLedger, SCENARIO_RECORD_ASK } from '../dist/public/shared/report-ask.js';
import { createProject, addArea, addRelation, pasteRecord, removePastedRecord, recordReadIntoMap } from '../dist/public/shared/domain.js';
import { buildMapAsk, applyReading, validateMapReply, unreadRecords, scenarioReadRecords, MAP5_SCHEMA } from '../dist/public/shared/map-reading.js';
import { handoverText } from '../dist/public/shared/handover.js';
import { savedReading } from '../dist/public/client/digest-source.js';
import { studioView } from '../dist/public/shared/studio.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { isMapReading, isScenarioReading } from '../dist/public/shared/types.js';

/** Four parts (a collector, an engine with two steps and a rule, a store, an order runner with one step) and three relations. */
function fixture() {
  let p = createProject();
  for (const n of ['패킷 수집기', '판정 엔진', 'review 저장소', '주문 실행기']) p = addArea(p, n);
  const [c, e, s, o] = p.space.areas.map(a => a.id);
  p = addRelation(p, c, e, 'flow', '패킷을 넘김'); p = addRelation(p, e, s, 'flow', 'review 행을 씀'); p = addRelation(p, s, o, 'flow', '새 행을 읽음');
  const view = studioView(p), part = id => view.parts.find(x => x.id === id);
  const base = { typeRead: null, fields: [], inputs: [], outputs: [], steps: [], claims: [] };
  part(c).reading = { ...base, outputs: ['패킷'] };
  part(e).reading = { ...base, inputs: ['패킷'], outputs: ['review 행'], steps: [{ name: '봉투 검사', does: '동시·쪽 확인', uses: [] }, { name: '판정', does: 'GO/NO_GO', uses: [] }],
    claims: [{ kind: 'reported', text: '동시에 한 건만 집행한다', topic: 'rule' }] };
  part(s).reading = { ...base, typeRead: { type: 'store', quote: null, at: 'x' }, fields: ['watch', 'valid_until'], inputs: ['review 행'], outputs: ['review 행'] };
  part(o).reading = { ...base, inputs: ['review 행'], outputs: ['주문'], steps: [{ name: '주문 전송', does: null, uses: [] }] };
  const rel = view.relations[0];
  const mapReading = { version: 'map-reading.9', id: 'MR7', at: '2026-11-03T09:05:00.000Z', relations: [{ relationId: rel.id, from: rel.from, to: rel.to, kind: 'flow', quote: null, payload: '패킷' }] };
  return { p, view, ids: { c, e, s, o }, ledger: buildLedger(view, [mapReading]), plainLedger: buildLedger(view, []), mapReading };
}

const VERSION = 'MR7 · 2026-11-03T09:05:00.000Z';
/** A realistic answer: a designed path through the store with a branch (GO only; NO_GO leaves as an exit) and a wait on the store. */
function answer({ version = VERSION, kind = '설계 경로', v02Step = 'S01 봉투 검사', l03Relation = 'R03', extraGaps = [] } = {}) {
  return `시나리오 기록 v2 (감독 세션, 2026-11-04)

**① 기준과 목적**
| 시나리오 ID | 이름 | 관련 요청 ID 또는 원문 위치 | ID 대장 판본 | 설계 판본 | 현황 기준 시각 | 종류 | 실행 ID·실행 범위 또는 모름 | 선택 이유 | 근거 E |
|---|---|---|---|---|---|---|---|---|---|
| C01 | 패킷 한 건이 주문이 되기까지 | 모름 | ${version} | 설계 기록 v1 (a1b2c3d) | 2026-11-03 09:0xZ | ${kind} | 모름 | 설명 목적 | E01 |

**② 시작**
| 시작 ID | 촉발 사건 | 시작 대상 P/O/S | 시작 조건 원문·Q 참조 | 필요한 이전 상태 | 이 촉발이 다른 동작과 독립적인지 | 근거 E |
|---|---|---|---|---|---|---|
| T01 | 새 패킷 도착 | P01 · O01 | 패킷 크기 > 0 | 수집기 실행 중 | 독립 | E01 |

**③ 방문**
| 방문 V | 부분 P | 단계 S 또는 모름 | 포트 O 또는 모름 | 필요한 입력 A | 이 방문이 내놓는 출력 A | 관측 실행일 때 사건 식별자 | 근거 E |
|---|---|---|---|---|---|---|---|
| V01 | P01 | 모름 | O01 | 없음 | A02 패킷 | 없음 | E01 |
| V02 | P02 | ${v02Step} | O02 | A02 | 모름 | 없음 | E01 |
| V03 | P03 | 없음 | O04 | A01 | A01 | 없음 | E02 |
| V04 | P04 | S03 | O06 | A01 | 모름 | 없음 | E02, 보고 |

**④ 이어짐**
| 이어짐 L | 출발 V | 도착 V | 기존 연결 R | 뜻: next/branch/parallel/loop/wait | 조건 원문·Q 참조 | 반복 단위·합류 정책·재개 사건 중 해당 내용 | 근거 E |
|---|---|---|---|---|---|---|---|
| L01 | V01 | V02 | R01 | next | 없음 | 없음 | E01 |
| L02 | V02 | V03 | R02 | branch | \`verdict == 'GO'\` 그리고 Q01 | 없음 | E01 |
| L03 | V03 | V04 | ${l03Relation} | wait | 없음 | 재개 사건: review 행 추가(파일 감시) | E02 |

**⑤ 끝**
| 끝 ID | 도달 방문 V 또는 모름 | 설계가 내놓는 결과 | 바라는 결과·요청 참조 | 이탈·거절·중단 결과 | 마지막 확인 지점 | 두 결과의 차이·미정 | 근거 E |
|---|---|---|---|---|---|---|---|
| X01 | V04 | 주문 한 건 전송 | GO 판정일 때만 주문이 나간다 | NO_GO면 NONE_SIDE 쉼; 동시 초과면 STOP_NOT_RESIDENT | V04 주문 전송 | 체결 여부는 모름 | E01, E02 |

**⑥ 근거와 빈칸**
| E | 뒷받침하는 행·열 | 제공된 자료 종류: 파일/실행/보고 | 원문 자료·위치 | 판본·실행 ID | 정확 인용 또는 원문 미제공 | 명시적 내용/보고자 추정 |
|---|---|---|---|---|---|---|
| E01 | ③ V01–V02, ④ L01–L02 | 파일 | code/engine.py:120 | a1b2c3d | if verdict == 'GO': write_review(row) | 명시적 내용 |
| E02 | ③ V03–V04, ④ L03 | 보고 | 설계 기록 v1 4절 | 모름 | 원문 미제공 | 보고자 추정 |

| 대응 ID | 외부 연결 R | 경계 포트 O | 내부 단계 S | 들어감/나감 | 근거 E |
|---|---|---|---|---|---|
| M01 | R01 | O02 | S01 | 들어감 | E01 |

| G | 관련 P/O/S/R/V/Q | 모르는 내용 또는 충돌 | 관련 원문·E | 이유: 미언급/자료없음/대장없음/충돌/분량상한 | 확인하려면 필요한 자료 |
|---|---|---|---|---|---|
| G01 | P02 S01 S02 | S01 다음 S02의 순서를 잇는 연결이 대장에 없음 | E01 | 대장없음 | 엔진 내부 단계 연결 |
${extraGaps.join('\n')}`;
}

test('SCN-1 the ledger object is what the request text lists: ids, app targets and the version line', () => {
  const { view, ledger, mapReading } = fixture();
  const text = scenarioLedger(view, [mapReading]);
  assert.ok(scenarioAskWithLedger(view, [mapReading]).startsWith(SCENARIO_RECORD_ASK));
  for (const it of ledger.items) assert.ok(text.includes(`\n${it.line}`), it.line);
  assert.equal(ledger.version, 'MR7'); assert.equal(ledger.versionLine, VERSION); assert.equal(ledger.cut, 0); assert.equal(ledger.shown.length, ledger.items.length);
  assert.deepEqual(ledger.parts.map(p => p.id), ['P01', 'P02', 'P03', 'P04']);
  assert.deepEqual(ledger.artifacts.map(a => [a.id, a.name]), [['A01', 'review 저장소'], ['A02', '패킷']]);
  assert.deepEqual(ledger.steps.map(s => [s.id, s.name]), [['S01', '봉투 검사'], ['S02', '판정'], ['S03', '주문 전송']]);
  assert.deepEqual(ledger.ports.map(o => [o.id, o.direction, o.name]), [['O01', 'out', '패킷'], ['O02', 'in', '패킷'], ['O03', 'out', 'review 행'], ['O04', 'in', 'review 행'], ['O05', 'out', 'review 행'], ['O06', 'in', 'review 행'], ['O07', 'out', '주문']]);
  assert.deepEqual(ledger.rules.map(q => q.id), ['Q01']); assert.deepEqual(ledger.fields.map(f => [f.id, f.artifact, f.name]), [['F01', 'A01', 'watch'], ['F02', 'A01', 'valid_until']]);
});

test('SCN-2 a complete designed path: every reference resolved to the app target, one wait and one branch, evidence, a port map and a gap', () => {
  const { ledger, ids } = fixture();
  const r = parseScenarioRecord(answer(), ledger);
  assert.deepEqual(r.diagnostics, []); assert.equal(r.pathStatus, 'complete'); assert.equal(r.ledgerVersion, 'MR7');
  const { scenario, start, visits, links, end, evidence, portMaps, gaps, statements } = r.record;
  assert.equal(scenario.id, 'C01'); assert.equal(scenario.kind, 'designed'); assert.equal(scenario.requestRef, 'unknown'); assert.equal(scenario.runRef, 'unknown');
  assert.equal(scenario.reason, '설명 목적'); assert.deepEqual(scenario.evidence, ['E01']);
  assert.deepEqual(start.target, { part: { ref: 'P01', areaId: ids.c, name: '패킷 수집기' }, port: { ref: 'O01', name: '패킷', direction: 'out' }, step: null });
  assert.deepEqual(visits.map(v => [v.id, v.part.areaId]), [['V01', ids.c], ['V02', ids.e], ['V03', ids.s], ['V04', ids.o]]);
  // 모름 and 없음 stay distinct: an unknown step, no step; unknown output, no input.
  assert.equal(visits[0].step, 'unknown'); assert.equal(visits[2].step, null); assert.deepEqual(visits[0].in, []); assert.equal(visits[1].out, 'unknown');
  assert.deepEqual(visits[1].step, { ref: 'S01', name: '봉투 검사' }); assert.deepEqual(visits[3].step, { ref: 'S03', name: '주문 전송' });
  assert.deepEqual(visits[0].out, [{ ref: 'A02', name: '패킷' }]); assert.deepEqual(visits[2].in, [{ ref: 'A01', name: 'review 저장소' }]);
  assert.deepEqual(visits[3].evidence, ['E02']); assert.equal(visits[3].evidenceWord, 'report');
  assert.deepEqual(links.map(l => [l.id, l.from, l.to, l.kind, l.relation.ref, l.relation.along]), [['L01', 'V01', 'V02', 'next', 'R01', true], ['L02', 'V02', 'V03', 'branch', 'R02', true], ['L03', 'V03', 'V04', 'wait', 'R03', true]]);
  assert.deepEqual(links[1].rules.map(q => q.ref), ['Q01']); assert.equal(links[2].policy, '재개 사건: review 행 추가(파일 감시)'); assert.equal(links[0].condition, null);
  assert.equal(end.reached, 'V04'); assert.equal(end.lastConfirmedVisit, 'V04'); assert.deepEqual(end.exits, ['NO_GO면 NONE_SIDE 쉼', '동시 초과면 STOP_NOT_RESIDENT']);
  assert.equal(end.produced, '주문 한 건 전송'); assert.equal(end.desired, 'GO 판정일 때만 주문이 나간다');
  assert.deepEqual(evidence.map(e => [e.id, e.material, e.quote, e.stance]), [['E01', 'file', "if verdict == 'GO': write_review(row)", 'stated'], ['E02', 'report', null, 'guess']]);
  assert.equal(evidence[1].versionOrRun, 'unknown');
  assert.deepEqual(portMaps.map(m => [m.id, m.relation.ref, m.areaId, m.port.ref, m.step.ref, m.direction]), [['M01', 'R01', ids.e, 'O02', 'S01', 'in']]);
  assert.deepEqual(gaps.map(g => [g.id, g.refs, g.reason]), [['G01', ['P02', 'S01', 'S02'], 'not-in-ledger']]);
  assert.deepEqual(statements, []);
});

test('SCN-3 a visit with an unknown step: that visit and its two links are set aside, numbers stay, V01→V03 is not made, the path is partial', () => {
  const { ledger } = fixture();
  const r = parseScenarioRecord(answer({ v02Step: 'S09' }), ledger);
  assert.equal(r.pathStatus, 'partial');
  assert.deepEqual(r.record.visits.map(v => v.id), ['V01', 'V03', 'V04']);
  assert.deepEqual(r.record.links.map(l => [l.id, l.from, l.to]), [['L03', 'V03', 'V04']]);
  assert.ok(!r.record.links.some(l => l.from === 'V01' && l.to === 'V03'));
  assert.deepEqual(r.diagnostics.map(d => [d.path, d.rule, d.category]), [['visits[1]', 'contract', 'visit'], ['links[0]', 'contract', 'link'], ['links[1]', 'contract', 'link']]);
  assert.match(r.diagnostics[0].explanation, /S09는 대장에 없는 ID/); assert.match(r.diagnostics[1].explanation, /V02가 제외되어 함께 제외/);
  // A step of another part is a mismatch, not an unknown id.
  const other = parseScenarioRecord(answer({ v02Step: 'S03' }), ledger);
  assert.match(other.diagnostics[0].explanation, /S03는 P02의 단계가 아님/); assert.equal(other.pathStatus, 'partial');
  // The port map row still names S01 of P02: it does not depend on the visit and stays.
  assert.equal(r.record.portMaps.length, 1);
});

test('SCN-4 a link citing an unknown R: that link only; a wrong input: that input only', () => {
  const { ledger } = fixture();
  const r = parseScenarioRecord(answer({ l03Relation: 'R09' }), ledger);
  assert.equal(r.pathStatus, 'partial');
  assert.deepEqual(r.record.visits.map(v => v.id), ['V01', 'V02', 'V03', 'V04']); assert.deepEqual(r.record.links.map(l => l.id), ['L01', 'L02']);
  assert.deepEqual(r.diagnostics.map(d => [d.path, d.category]), [['links[2]', 'link']]); assert.match(r.diagnostics[0].explanation, /R09는 대장에 없는 ID/);
  // An R whose ends are other parts than the two visits' is a mismatch too.
  const wrong = parseScenarioRecord(answer({ l03Relation: 'R01' }), ledger);
  assert.deepEqual(wrong.record.links.map(l => l.id), ['L01', 'L02']); assert.match(wrong.diagnostics[0].explanation, /R01의 양 끝이 V03·V04의 부분과 다름/);
  // One wrong input among two: the visit keeps the good one; a visit whose only input is wrong reads its input as not known.
  const text = answer().replace('| V02 | P02 | S01 봉투 검사 | O02 | A02 |', '| V02 | P02 | S01 봉투 검사 | O02 | A02, A07 |').replace('| V03 | P03 | 없음 | O04 | A01 |', '| V03 | P03 | 없음 | O04 | review 행 |');
  const input = parseScenarioRecord(text, ledger);
  assert.equal(input.pathStatus, 'complete');
  assert.deepEqual(input.record.visits[1].in, [{ ref: 'A02', name: '패킷' }]); assert.equal(input.record.visits[2].in, 'unknown');
  assert.deepEqual(input.diagnostics.map(d => [d.path, d.category]), [['visits[1].in[1]', 'visit-input'], ['visits[2].in[0]', 'visit-input']]);
});

test('SCN-5 an identity error (no kind, a foreign ledger version, an observed run without a run id) rejects the whole path and keeps the end sentences', () => {
  const { ledger } = fixture();
  const r = parseScenarioRecord(answer({ kind: '' }), ledger);
  assert.equal(r.pathStatus, 'rejected'); assert.equal(r.record.scenario.kind, null);
  assert.deepEqual(r.diagnostics.map(d => [d.path, d.category]), [['scenario[0].kind', 'scenario']]);
  assert.deepEqual(r.record.statements.map(s => [s.kind, s.text]), [['produced', '주문 한 건 전송'], ['desired', 'GO 판정일 때만 주문이 나간다'], ['exit', 'NO_GO면 NONE_SIDE 쉼'], ['exit', '동시 초과면 STOP_NOT_RESIDENT']]);
  assert.deepEqual(r.record.statements[0].evidence, ['E01', 'E02']);
  assert.equal(parseScenarioRecord(answer({ version: 'MR6 · 2026-11-01T00:00:00.000Z' }), ledger).pathStatus, 'rejected');
  const observed = parseScenarioRecord(answer({ kind: '관측 실행' }), ledger);
  assert.equal(observed.pathStatus, 'rejected'); assert.equal(observed.diagnostics[0].path, 'scenario[0].runRef');
  // No visit left: rejected as well.
  const none = parseScenarioRecord(answer().replace(/\| V0\d \| P0\d \|/g, '| V01 | P09 |'), ledger);
  assert.equal(none.pathStatus, 'rejected'); assert.equal(none.record.visits.length, 0); assert.ok(none.diagnostics.some(d => d.path === 'visits' && d.category === 'scenario'));
});

test('SCN-6 the caps: past 16 visits, 20 links, 80 rows and 12,000 characters each is said; the rows past a cap are set aside', () => {
  const { ledger } = fixture();
  const visits = Array.from({ length: 17 }, (_, i) => `| V${String(i + 1).padStart(2, '0')} | ${i % 2 ? 'P02' : 'P01'} | 모름 | 모름 | 모름 | 모름 | 없음 | E01 |`);
  const links = Array.from({ length: 21 }, (_, i) => { const a = 1 + 2 * (i % 8), b = 2 + 2 * Math.floor(i / 8); return `| L${String(i + 1).padStart(2, '0')} | V${String(a).padStart(2, '0')} | V${String(b).padStart(2, '0')} | R01 | next | 없음 | 없음 | E01 |`; });
  const gaps = Array.from({ length: 45 }, (_, i) => `| G${String(i + 2).padStart(2, '0')} | P01 | ${'남은 갈래 '.repeat(30)} | E01 | 분량상한 | 다음 요청 |`);
  const base = answer({ extraGaps: gaps });
  const text = base.replace(/(\|---\|---\|---\|---\|---\|---\|---\|---\|\n)\| V01[\s\S]*?\n\n/, `$1${visits.join('\n')}\n\n`).replace(/(\| 이어짐 L[^\n]*\n[^\n]*\n)\| L01[\s\S]*?\n\n/, `$1${links.join('\n')}\n\n`);
  assert.ok(text.length > SCENARIO_LIMITS.chars);
  const r = parseScenarioRecord(text, ledger);
  const caps = r.diagnostics.filter(d => d.category === 'cap').map(d => d.path);
  assert.ok(caps.includes('record')); assert.ok(caps.includes('visits[16]')); assert.ok(caps.includes('links[20]'));
  assert.ok(caps.some(p => p.startsWith('gaps[')), caps.join(' '));
  assert.equal(r.record.visits.length, 16); assert.equal(r.record.links.length, 20);
  assert.equal(r.pathStatus, 'partial');
  const rows = 1 + 1 + 17 + 21 + 1 + 2 + 1 + 1 + 45; assert.equal(r.record.gaps.length + r.diagnostics.filter(d => d.category === 'cap' && d.path.startsWith('gaps[')).length, 46);
  assert.equal(r.diagnostics.filter(d => d.category === 'cap' && /^\w+\[\d+\]$/.test(d.path) && !/^(visits|links)/.test(d.path)).length, rows - SCENARIO_LIMITS.rows);
});

test('SCN-7 scenario-reading.1 is kept beside map readings, exactly: it round-trips, an unknown key or version is refused, its record cannot be taken out', () => {
  const { p: base, view, plainLedger, ids } = fixture();
  const { project: p, record } = pasteRecord(base, answer({ version: '지도 읽기 없음' }), null);
  const parsed = parseScenarioRecord(record.text, plainLedger);
  assert.equal(parsed.pathStatus, 'complete', JSON.stringify(parsed.diagnostics)); assert.equal(parsed.ledgerVersion, null);
  const q = applyScenario(p, record.id, parsed, { id: 'SC_1', at: '2026-11-04T01:00:00.000Z' });
  const entry = q.readings.at(-1);
  assert.equal(entry.version, 'scenario-reading.1'); assert.ok(isScenarioReading(entry)); assert.ok(!isMapReading(entry));
  assert.deepEqual(Object.keys(entry), ['version', 'id', 'at', 'record', 'ledgerVersion', 'pathStatus', 'scenario', 'diagnostics']);
  const back = parseProject(serializeProject(q));
  assert.deepEqual(back, q); assert.deepEqual(back.readings.at(-1), entry);
  const tamper = f => { const v = JSON.parse(serializeProject(q)); f(v.readings.at(-1)); return () => parseProject(JSON.stringify(v)); };
  assert.throws(tamper(e => { e.extra = 1; }));
  assert.throws(tamper(e => { e.scenario.visits[0].note = 'x'; }));
  assert.throws(tamper(e => { e.version = 'scenario-reading.2'; }));
  assert.throws(tamper(e => { e.scenario.links[0].to = 'V09'; }));
  assert.throws(tamper(e => { e.scenario.visits[0].evidence = ['E09']; }));
  assert.throws(tamper(e => { e.pathStatus = 'done'; }));
  assert.throws(tamper(e => { e.record = 'N_missing'; }));
  assert.throws(tamper(e => { e.ledgerVersion = 'MR7'; }));
  assert.throws(() => removePastedRecord(q, record.id), /RECORD_READ/);
  assert.throws(() => applyScenario(p, 'N_missing', parsed), /RECORD_MISSING/);
  // The client view: visits on their areas, steps and ports checked against what the map holds now (no map reading here: not current).
  const u = scenarioUnderstanding(q);
  assert.equal(u.id, 'SC_1'); assert.equal(u.pathStatus, 'complete');
  assert.deepEqual(u.byArea, { [ids.c]: ['V01'], [ids.e]: ['V02'], [ids.s]: ['V03'], [ids.o]: ['V04'] });
  assert.equal(u.visits[1].partName, '판정 엔진'); assert.equal(u.visits[1].partOnMap, true); assert.deepEqual(u.visits[1].step, { ref: 'S01', name: '봉투 검사', current: false });
  assert.ok(u.links.every(l => l.relationOnMap)); assert.equal(scenarioUnderstanding(q, 'SC_x'), null); assert.equal(scenarioUnderstanding(base), null);
  assert.equal(view.parts.length, 4);
  // A rejected reading is kept too; its understanding draws no path and keeps the end sentences.
  const { project: p2, record: r2 } = pasteRecord(q, answer({ version: '지도 읽기 없음', kind: '' }), null);
  const q2 = applyScenario(p2, r2.id, parseScenarioRecord(r2.text, plainLedger), { id: 'SC_2', at: '2026-11-04T01:01:00.000Z' });
  const u2 = scenarioUnderstanding(parseProject(serializeProject(q2)));
  assert.equal(u2.pathStatus, 'rejected'); assert.deepEqual(u2.visits, []); assert.deepEqual(u2.byArea, {}); assert.equal(u2.statements.length, 4);
});

test('SCN-8 a record a scenario reading has read is read for the map: the next map ask sends only the status record, then nothing; a later plain record is the only one unread', () => {
  const { p: base, plainLedger } = fixture();
  const { project: p1, record: scen } = pasteRecord(base, answer({ version: '지도 읽기 없음' }), null);
  const p2 = applyScenario(p1, scen.id, parseScenarioRecord(scen.text, plainLedger), { id: 'SC_8', at: '2026-11-04T02:00:00.000Z' });
  const { project: p3, record: status } = pasteRecord(p2, '현황 기록: 패킷 수집기는 매분 패킷을 모아 판정 엔진에 넘긴다. 판정 엔진은 GO일 때 review 행을 쓴다.', null);
  // Before any map reading: only the status record is unread and sent; the scenario record is not.
  assert.deepEqual(unreadRecords(p3, studioView(p3)).map(r => r.id), [status.id]);
  const inp = buildMapAsk(p3, studioView(p3), [], undefined, MAP5_SCHEMA);
  assert.equal(inp.problem, null); assert.equal(inp.coverage.fresh, 1);
  assert.deepEqual([...inp.records.values()].map(r => r.id), [status.id]); assert.equal(inp.ask.records.length, 1);
  assert.ok(!JSON.stringify(inp.ask).includes('시나리오 기록 v2'));
  const empty = { summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] };
  const applied = applyReading(p3, inp, validateMapReply(empty, inp.ask), { id: 'R_scn8', at: '2026-11-04T02:01:00.000Z', model: 'stub', prompt: 'm5-000000000000', hash: 'a'.repeat(64) });
  const q = applied.project;
  // One status record read by a map reading, one scenario record read by a scenario reading: nothing unread, nothing new to ask.
  assert.deepEqual(q.readings.filter(isMapReading).map(r => r.id), ['R_scn8']); assert.deepEqual(q.readings.filter(isScenarioReading).map(r => r.id), ['SC_8']);
  assert.deepEqual(q.readings.filter(isMapReading).flatMap(r => r.records.map(x => x.id)), [status.id]);
  assert.deepEqual([...scenarioReadRecords(q)], [scen.id]);
  assert.deepEqual(unreadRecords(q, studioView(q)), []);
  const again = buildMapAsk(q, studioView(q), [], undefined, MAP5_SCHEMA);
  assert.equal(again.problem, 'NOTHING_NEW'); assert.equal(again.coverage.fresh, 0); assert.equal(again.after, 'R_scn8');
  // Both records stay kept and protected; the scenario reading is never a map reading.
  assert.ok(recordReadIntoMap(q, scen.id)); assert.ok(recordReadIntoMap(q, status.id));
  assert.throws(() => removePastedRecord(q, scen.id), /RECORD_READ/); assert.throws(() => removePastedRecord(q, status.id), /RECORD_READ/);
  assert.ok(!isMapReading(q.readings.find(r => r.id === 'SC_8')));
  // The record list still lists the scenario record as a pasted record of its own, and the handover counts nothing unread.
  const listed = savedReading(studioView(q), null, q.pasted);
  assert.ok(listed.some(s => s.recordId === scen.id && s.kind === 'record')); assert.ok(listed.some(s => s.recordId === status.id));
  assert.ok(!handoverText(q, { scope: null, code: 'SCN234', at: '2026-11-04T03:00:00.000Z' }).includes('아직 지도에 담기지 않은 기록'));
  // A third plain record pasted later is the only one unread, and the only one the next map ask sends.
  const { project: r, record: third } = pasteRecord(q, '현황 기록: 주문 실행기가 review 행을 읽어 주문 한 건을 보냈다.', null);
  assert.deepEqual(unreadRecords(r, studioView(r)).map(x => x.id), [third.id]);
  const next = buildMapAsk(r, studioView(r), [], undefined, MAP5_SCHEMA);
  assert.equal(next.problem, null); assert.equal(next.coverage.fresh, 1); assert.deepEqual([...next.records.values()].map(x => x.id), [third.id]);
  assert.match(handoverText(r, { scope: null, code: 'SCN234', at: '2026-11-04T03:00:00.000Z' }), /아직 지도에 담기지 않은 기록이 1개/);
});
