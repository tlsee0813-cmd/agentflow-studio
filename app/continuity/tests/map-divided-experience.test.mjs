// Author-written synthetic records and wire replies. These are acceptance/regression checks for application semantics,
// provenance and saved state; they are NOT model-generation quality evidence and perform no provider calls.
// The same lifecycles use map.6 and the later map.7 condition wire (whose first reading remains map.6).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as R from '../dist/public/shared/request-return.js';
import { studioView } from '../dist/public/shared/studio.js';
import { parseProject } from '../dist/public/shared/validation.js';

let serial = 0;
const meta = () => { const n = ++serial; return { id: `R_divided_${n}`, at: '2026-11-02T01:00:00.000Z', model: 'synthetic-wire', prompt: 'm6-000000000000', hash: n.toString(16).padStart(64, '0') }; };
const reply = values => ({ summary: '[Synthetic] lifecycle regression', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...values });
const ask = (p, schema, scopes = [], selected) => M.buildMapAsk(p, studioView(p), scopes, selected, schema);
const apply = (p, inp, raw) => M.applyReading(p, inp, M.validateMapReply(raw, inp.ask), meta());
const seven = inp => inp.ask.schemaVersion === M.MAP7_SCHEMA;
const partAlias = (inp, id) => [...inp.parts].find(([, area]) => area === id)[0];
function piece(inp, prefix) {
  const found = inp.ask.records.flatMap(r => r.spans).filter(s => s.t.trimStart().startsWith(prefix));
  assert.equal(found.length, 1, `fixture needs one sent piece: ${prefix}`); return found[0].s;
}
function condition(inp, at, role = false) {
  const text = at === null ? null : inp.ask.records.flatMap(r => r.spans).find(s => s.s === at).t.trim();
  return { [role ? (seven(inp) ? 'roleAboutAt' : 'roleAbout') : (seven(inp) ? 'aboutAt' : 'about')]: seven(inp) ? at : text };
}
const part = (inp, ref, values = {}) => ({ ref, name: null, parent: null, role: null, ...condition(inp, null, true), roleReplaces: null, basis: [], claims: [], ...values });
const claim = (inp, key, kind, text, at, values = {}) => ({ key, kind, text, at, ...condition(inp, null), replaces: null, ...values });
const match = (inp, q, at, kind, stance, text, values = {}) => ({ at, kind, stance, text, ...condition(inp, null), targets: [{ requestId: q.id, itemId: 'I1' }], why: '[Synthetic] the quoted passage concerns this frozen item', replaces: null, ...values });
function paste(p, text, date = '2026-01-02T00:00:00.000Z') {
  const out = D.pasteRecord(p, text, null); out.project.pasted.find(r => r.id === out.record.id).at = date; return out.project;
}
function plan(p, area, description) {
  const evidence = [{ id: 'INTENT', kind: 'user', title: '사용자 요구', text: description, basis: '이 테스트의 사용자 초안' }];
  return C.createPlan(p.id, '합성 인수검증 기준', description, evidence, {
    summary: '연속 처리 요구', items: [{ id: 'I1', title: '실패 후 계속', description, partIds: [area], refs: ['INTENT'], dependsOn: [] }], impacts: [], preserve: ['원문과 성공 결과 보존'], unknowns: []
  });
}
function freeze(plan, date = '2026-01-01T00:00:00.000Z') {
  const snap = C.requestSnapshot(plan); snap.createdAt = date; snap.scope.createdAt = date; return snap.scope;
}
function roundtrip(p) { const copy = parseProject(JSON.stringify(p)); assert.deepEqual(copy, p); return copy; }
function exactOrigins(p) {
  const text = new Map(p.pasted.map(r => [r.id, r.text]));
  for (const r of p.readings.filter(x => x.version.startsWith('map-reading.'))) {
    const quotes = [...r.parts.flatMap(x => [...x.basis, ...x.claims]), ...(r.matches ?? [])];
    for (const q of quotes) assert.equal(text.get(q.record).slice(q.from, q.to), q.quote, 'every saved quote still points to its own original bytes');
  }
}

for (const schema of [M.MAP6_SCHEMA, M.MAP7_SCHEMA]) {
  test(`${schema}: first requirement and plan, scoped implementation/check report, then explicit withdrawal preserve their distinct history`, () => {
    const initial = '요구: 파일 하나가 실패해도 다음 파일은 계속 변환해야 합니다.\n계획: 실패 목록은 마지막에 별도로 보여 주겠습니다.';
    let p = paste(D.createProject(), initial, '2025-12-31T00:00:00.000Z');
    let inp = ask(p, schema);
    assert.equal(inp.ask.schemaVersion, M.MAP6_SCHEMA, 'first reading uses the supported first-map recipe');
    const first = apply(p, inp, reply({ parts: [part(inp, 'new:batch', {
      name: '연속 변환', role: '파일별 실패를 분리하는 변환 흐름', basis: [piece(inp, '요구:')], claims: [
        claim(inp, 's1', 'want', '한 파일이 실패해도 나머지를 계속 변환하기를 원함', piece(inp, '요구:')),
        claim(inp, 's2', 'idea', '실패 목록을 마지막에 따로 표시할 계획', piece(inp, '계획:'))]
    })] }));
    p = first.project; const area = first.created[0], originalReading = structuredClone(first.reading);
    const q = freeze(plan(p, area, '파일 하나가 실패해도 다음 파일을 계속 변환한다.'));
    assert.deepEqual(M.partUnderstanding(p, area).claims.map(c => c.kind).sort(), ['idea', 'want']);
    assert.equal(R.itemReading(R.requestMatches(p), { requestId: q.id, itemId: 'I1' }).state, 'none', 'a plan is not an implementation report');

    const report = `작업 보고 (${q.id}): 실패한 파일 다음 파일도 계속 처리하도록 구현했습니다.\n조건: release/1.0\n검사 보고: 단일 파일 검사 3개가 통과했습니다.`;
    p = paste(p, report); inp = ask(p, schema, [q]);
    assert.equal(inp.ask.schemaVersion, schema);
    p = apply(p, inp, reply({ parts: [part(inp, partAlias(inp, area), { claims: [
      claim(inp, 's1', 'reported', '실패 후 계속 처리를 구현했다고 보고함', piece(inp, '작업 보고'), condition(inp, piece(inp, '조건:'))),
      claim(inp, 's2', 'checked', '단일 파일 검사 3개 통과를 보고함', piece(inp, '검사 보고'))] })], matches: [
      match(inp, q, piece(inp, '작업 보고'), 'reported', 'made', '실패 후 계속 구현 보고', condition(inp, piece(inp, '조건:'))),
      match(inp, q, piece(inp, '검사 보고'), 'checked', 'unclear', '단일 파일 검사만 통과했다고 보고함')]
    })).project;
    const reportReading = structuredClone(p.readings.at(-1));
    assert.equal(R.itemReading(R.requestMatches(p), { requestId: q.id, itemId: 'I1' }).state, 'made');
    p = paste(p, `정정 (${q.id}): release/1.0의 실패 후 계속 구현 보고를 철회합니다. 아직 구현되지 않았습니다.`, '2026-01-03T00:00:00.000Z');
    inp = ask(p, schema, [q]);
    const previousClaim = inp.ask.parts.find(x => x.id === partAlias(inp, area)).current.find(c => c.kind === 'reported').key;
    const previousMatch = inp.ask.priors.find(m => m.kind === 'reported').key;
    p = apply(p, inp, reply({ parts: [part(inp, partAlias(inp, area), { claims: [claim(inp, 's1', 'reported', '이전 구현 보고를 철회하고 미구현이라고 정정함', piece(inp, '정정'), { replaces: previousClaim })] })], matches: [
      match(inp, q, piece(inp, '정정'), 'reported', 'not-made', '이전 구현 보고를 철회함', { replaces: previousMatch })]
    })).project;
    const result = R.itemReading(R.requestMatches(p), { requestId: q.id, itemId: 'I1' });
    assert.equal(result.state, 'not-made'); assert.equal(result.history.length, 1);
    assert.equal(result.history[0].match.quote, reportReading.matches[0].quote);
    const u = M.partUnderstanding(p, area);
    assert.equal(u.revised, true); assert.ok(u.claims.some(c => c.kind === 'want')); assert.ok(u.claims.some(c => c.kind === 'idea'));
    assert.ok(u.claims.some(c => c.kind === 'checked'), 'the unrelated single-file check is retained with its limited scope');
    assert.ok(!u.claims.some(c => c.text === '실패 후 계속 처리를 구현했다고 보고함'));
    assert.deepEqual(p.readings.find(r => r.id === originalReading.id), originalReading);
    assert.deepEqual(p.readings.find(r => r.id === reportReading.id), reportReading, 'withdrawal never rewrites the received report');
    assert.deepEqual(p.pasted.map(r => r.text).slice(0, 2), [initial, report]);
    exactOrigins(p); roundtrip(p);
  });

  test(`${schema}: a correction arriving after the user edits role/name/note/basis keeps those edits and all prior evidence`, () => {
    const original = '책임: 변환기는 성공 결과를 모으는 부분입니다.\n이전 보고: 실패 후에도 다음 파일을 처리했습니다.';
    let p = paste(D.createProject(), original);
    let inp = ask(p, schema);
    const first = apply(p, inp, reply({ parts: [part(inp, 'new:convert', {
      name: '변환기', role: '성공 결과를 모으는 부분', basis: [piece(inp, '책임:')], claims: [claim(inp, 's1', 'reported', '실패 후에도 처리했다고 보고함', piece(inp, '이전 보고:'))]
    })] }));
    p = first.project; const area = first.created[0], firstSaved = structuredClone(first.reading);
    p = paste(p, '책임 정정: 이전 설명 대신 실패 목록을 만드는 부분입니다.\n보고 정정: 이전의 실패 후 처리 보고는 잘못됐습니다. 아직 중단됩니다.', '2026-01-03T00:00:00.000Z');
    inp = ask(p, schema);
    const roleAt = piece(inp, '책임 정정:'), claimAt = piece(inp, '보고 정정:');
    const oldClaim = inp.ask.parts[0].current.find(c => c.kind === 'reported').key;
    // Decode while the ask still says roleBy:reading. A user correction happens before the completed reading is applied.
    const decoded = M.validateMapReply(reply({ parts: [part(inp, partAlias(inp, area), {
      role: '실패 목록을 만드는 부분', basis: [roleAt], roleReplaces: roleAt,
      claims: [claim(inp, 's1', 'reported', '이전 처리 보고를 정정하고 아직 중단된다고 보고함', claimAt, { replaces: oldClaim })]
    })] }), inp.ask);
    p = D.correctReadingRole(p, area, '사용자 확정: 성공 결과와 실패 목록의 보존 경계');
    p = D.editArea(p, area, '사용자 이름', '사용자가 직접 보존한 메모');
    p = D.submit(D.editDraft(p, '성공 결과를 유지하는 변환기를 원합니다.'), undefined, area);
    p = D.recordBasis(p, '성공 결과는 실패와 관계없이 유지한다.', 'confirmed', p.bases[0].id);
    const manualCorrection = structuredClone(p.readings.at(-1)), basis = structuredClone(p.bases), pasted = structuredClone(p.pasted), tasks = structuredClone(p.tasks), sources = structuredClone(p.sources);
    const before = JSON.stringify(p);
    const out = M.applyReading(p, inp, decoded, meta());
    assert.equal(JSON.stringify(p), before, 'applying creates the next project without mutating the input');
    p = out.project;
    const u = M.partUnderstanding(p, area);
    assert.equal(u.role, '사용자 확정: 성공 결과와 실패 목록의 보존 경계');
    assert.equal(u.corrected.id, manualCorrection.id); assert.deepEqual(u.roleBasis, []);
    assert.ok(u.others.some(r => r.text === '실패 목록을 만드는 부분'), 'the later reading stays visible apart from the user role');
    assert.equal(p.space.areas.find(a => a.id === area).name, '사용자 이름');
    assert.equal(p.space.areas.find(a => a.id === area).note, '사용자가 직접 보존한 메모');
    assert.deepEqual(p.bases, basis); assert.deepEqual(p.pasted, pasted);
    assert.equal(p.bases[0].history.length, 1, 'the explicit user basis revision retains its old request value');
    assert.deepEqual(p.readings.find(r => r.id === firstSaved.id), firstSaved);
    assert.ok(u.history.some(h => h.claims.some(c => c.text === '실패 후에도 처리했다고 보고함')));
    assert.ok(!u.claims.some(c => c.text === '실패 후에도 처리했다고 보고함'));
    assert.ok(u.claims.some(c => c.replaces?.reading === firstSaved.id));
    assert.deepEqual(p.tasks, tasks); assert.deepEqual(p.sources, sources);
    exactOrigins(p); roundtrip(p);
  });

  test(`${schema}: greenfield request revision never inherits an older implementation or passing-check report`, () => {
    let p = paste(D.createProject(), '새 제품 요구: 문서 변환기는 실패한 문서 다음에도 계속 처리해야 합니다.', '2025-12-31T00:00:00.000Z');
    let inp = ask(p, schema);
    const first = apply(p, inp, reply({ parts: [part(inp, 'new:product', { name: '새 변환기', basis: [piece(inp, '새 제품 요구:')], claims: [
      claim(inp, 's1', 'want', '실패 후에도 계속 처리하는 새 변환기를 원함', piece(inp, '새 제품 요구:'))]
    })] }));
    p = first.project; const area = first.created[0], originalPlan = plan(p, area, '마크다운 파일 하나가 실패해도 다음 파일을 처리한다.'), q1 = freeze(originalPlan);
    const report = `구현 보고 (${q1.id}): 마크다운 파일의 실패 후 계속 처리를 구현했습니다.\n조건: release/1.0`;
    const oldCheck = '검사 보고: 마크다운 변환 검사 5개가 통과했습니다.\n검사 조건: release/1.0';
    p = paste(p, report); p = paste(p, oldCheck); inp = ask(p, schema, [q1]);
    p = apply(p, inp, reply({ matches: [
      match(inp, q1, piece(inp, '구현 보고'), 'reported', 'made', '마크다운 처리 구현 보고', condition(inp, piece(inp, '조건:'))),
      match(inp, q1, piece(inp, '검사 보고'), 'checked', 'unclear', '마크다운 검사 5개 통과 보고', condition(inp, piece(inp, '검사 조건:')))]
    })).project;
    const oldReading = structuredClone(p.readings.at(-1));
    const nextPlan = C.revisePlan(originalPlan, { ...originalPlan.analysis, items: [{ ...originalPlan.analysis.items[0], description: '이미지 OCR이 실패해도 다음 이미지의 OCR과 변환을 계속한다.' }] });
    const q2 = freeze(nextPlan, '2026-01-03T00:00:00.000Z');
    assert.equal(q1.items[0].id, q2.items[0].id); assert.notEqual(q1.id, q2.id); assert.equal(q2.planRevision, q1.planRevision + 1);
    assert.equal(R.itemReading(R.requestMatches(p), { requestId: q2.id, itemId: 'I1' }).state, 'none');
    // Different requests occur in separate original records, so each record's explicit RQ has one meaning.
    p = paste(p, `요구 변경 (${q2.id}): 이미지 OCR 실패 후 계속 처리도 필요합니다. 아직 구현하지 않았습니다.`, '2026-01-04T00:00:00.000Z');
    p = paste(p, `검사 재보고 (${q1.id}): release/1.0의 기존 마크다운 검사 5개 통과 결과만 다시 전합니다.`, '2026-01-04T00:00:01.000Z');
    inp = ask(p, schema, [q1, q2]);
    p = apply(p, inp, reply({ matches: [
      match(inp, q2, piece(inp, '요구 변경'), 'open', 'not-made', '이미지 OCR 추가 요구는 아직 미구현'),
      match(inp, q1, piece(inp, '검사 재보고'), 'checked', 'unclear', '기존 마크다운 검사 결과의 재보고')]
    })).project;
    const all = R.requestMatches(p), newer = R.itemReading(all, { requestId: q2.id, itemId: 'I1' });
    assert.equal(newer.state, 'not-made'); assert.equal(newer.current.length, 1);
    assert.ok(newer.current.every(m => !['checked', 'test'].includes(m.match.kind)));
    assert.equal(R.itemReading(all, { requestId: q1.id, itemId: 'I1' }).state, 'made');
    assert.deepEqual(p.readings.find(r => r.id === oldReading.id), oldReading);
    assert.equal(oldReading.requests[0].planRevision, q1.planRevision); assert.ok(oldReading.requests[0].items[0].description.includes('마크다운'));
    // Even explicit recovery cannot turn a record imported before RQ2 existed into evidence for RQ2.
    const recovery = ask(p, schema, [q1, q2], q2.id), raw = reply({ matches: [match(recovery, q2, piece(recovery, '검사 보고'), 'checked', 'unclear', 'forbidden old-pass promotion')] });
    assert.throws(() => M.validateMapReply(raw, recovery.ask), e => e.message === 'INVALID_RESPONSE' && (!seven(recovery) || e.target === 'target-time'), 'the unnamed old check is refused by time, independently of an explicit RQ label');
    assert.equal(p.pasted.find(r => r.text === report).text, report);
    assert.equal(p.pasted.find(r => r.text === oldCheck).text, oldCheck);
    exactOrigins(p); roundtrip(p);
  });
}
