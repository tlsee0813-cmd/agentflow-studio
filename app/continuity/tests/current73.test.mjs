// AF-EXPERIENCE73: a later correction changes what reads as current, while every earlier report stays as history.
// Written replies (no AI call): contract, storage and regression evidence, not real AI quality or browser evidence.
// The sequential sample is the attached synthetic public-4e backup (one real DeepSeek reply to a synthetic correction).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as R from '../dist/public/shared/request-return.js';
import { studioView } from '../dist/public/shared/studio.js';
import { parseProject, parseBackup } from '../dist/public/shared/validation.js';
import { serializeBackup } from '../dist/public/shared/storage.js';

const SAMPLE = new URL('../../../docs/cycles/2026-10-26-visual-experience-59/request72-sequential-sample.json', import.meta.url);
const RAW = readFileSync(SAMPLE, 'utf8'), SAMPLE_RQ = 'RQ_efb368df-baa4-4668-ab7c-8e4f156daea8';
const raw = JSON.parse(RAW);
// The two follow-up records exactly as pasted (the RQ id is the one each test's own frozen request gets).
const REPORT71 = raw.pasted[1].text, CORRECTION72 = raw.pasted[2].text;
const Q = {
  input: 'feature/folder 브랜치에서 폴더 경로를 받아 바로 아래의 .md 파일 목록을 기존 단일 문서 변환기에 넘기는 입력 처리만 바꿨습니다.',
  main: 'main에는 병합하지 않았습니다.', pdf: '기존 단일 문서 한 개의 PDF 출력만 확인했다고 보고합니다.',
  none: '한 파일 실패 후 계속 처리와 파일별 성공·실패 결과 목록에 대한 구현·검사 근거는 이 보고에 제공하지 않습니다.',
  header: '합성 순차 정정 표본 72 — 테스트를 위해 작성했으며 실제 개발·검사 기록이 아닙니다.',
  withdraw: '실제로는 그 입력 처리를 구상만 했으며 아직 구현하지 않았습니다. feature/folder의 폴더 입력은 미구현 상태입니다. main에도 반영되지 않았습니다.',
  still: '한 파일 실패 후 계속 처리와 파일별 성공·실패 요약은 여전히 구현하지 않았습니다.'
};

let n = 0;
const meta = () => ({ id: `R_c73_${++n}`, at: new Date().toISOString(), model: 'stub', prompt: 'm3-000000000000', hash: String(n).padStart(64, 'c') });
const reply = matches => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches });
const m = (q, item, quote, opts = {}) => ({ record: 'N01', quote, text: `${quote.slice(0, 40)} 범위`, kind: 'reported', about: null, targets: item ? [{ requestId: q.id, itemId: item }] : [], why: '스텁 대응', stance: 'made', replaces: null, ...opts });
const ask = (p, scopes, selected) => M.buildMapAsk(p, studioView(p), scopes, selected);
const apply = (p, inp, r) => M.applyReading(p, inp, M.validateMapReply(r, inp.ask), meta());
const last = p => p.readings.filter(r => r.version.startsWith('map-reading.')).at(-1);
const item = (p, q, id) => R.itemReading(R.requestMatches(p), { requestId: q.id, itemId: id });
const priorOf = (inp, quote) => inp.ask.priors.find(x => x.quote === quote).key;
const round = p => parseProject(JSON.stringify(p));

function plan(p, area, titles = ['폴더 안 마크다운 문서 일괄 변환', '파일 하나가 실패해도 나머지 계속 처리', '마지막에 파일별 성공·실패 요약 표시']) {
  const evidence = [{ id: 'INTENT', kind: 'user', title: '원함', text: titles.join(' / '), basis: '사용자 초안' }];
  const analysis = { summary: '폴더', items: titles.map((title, i) => ({ id: `change_${i + 1}`, title, description: `${title}을 원함`, partIds: [area], refs: ['INTENT'], dependsOn: [] })), impacts: [], preserve: [], unknowns: [] };
  return C.requestSnapshot(C.createPlan(p.id, '기준', evidence[0].text, evidence, analysis));
}
/** 71: the partial report, read with stances (feature input made; main, PDF check and the rest unclear). */
function after71() {
  let p = D.addArea(D.createProject(), '폴더 일괄 처리', ''); const area = p.space.areas[0].id;
  const snap = plan(p, area), q = snap.scope;
  p = D.pasteRecord(p, REPORT71.replace(SAMPLE_RQ, snap.id), area).project;
  const inp = ask(p, [q]);
  p = apply(p, inp, reply([m(q, 'change_1', Q.input, { about: 'feature/folder 브랜치' }), m(q, 'change_1', Q.main, { stance: 'unclear' }),
    m(q, 'change_1', Q.pdf, { kind: 'checked', stance: 'made' }), m(q, 'change_2', Q.none, { kind: 'open', stance: 'unclear' }), m(q, 'change_3', Q.none, { kind: 'open', stance: 'unclear' })])).project;
  return { p, q, area, r71: last(p).id };
}
/** 72: the correction as the real reply read it (three not-made reports), with the explicit withdrawal of the 71 input claim. */
function correction72(p, q, opts = {}) {
  p = D.pasteRecord(p, CORRECTION72.replace(SAMPLE_RQ, q.id), null).project;
  const inp = ask(p, [q]), key = priorOf(inp, Q.input);
  const r = reply([m(q, null, Q.header, { stance: 'unclear' }), m(q, 'change_1', Q.withdraw, { stance: 'not-made', about: 'feature/folder', replaces: key, ...opts }),
    m(q, 'change_2', Q.still, { stance: 'not-made' }), m(q, 'change_3', Q.still, { stance: 'not-made' })]);
  return { p, inp, r, key };
}

test('73-A 71 partial report keeps its first reading: one change reported, the narrow PDF check is no progress, open items stay open', () => {
  const { p, q } = after71();
  assert.equal(R.requestComparison(p, last(p)), '원한 항목 3개 · 변경 보고 1개 · 변경 근거 아직 없는 항목 2개');
  assert.equal(item(p, q, 'change_1').state, 'made'); assert.equal(item(p, q, 'change_1').lead.match.quote, Q.input);
  assert.equal(last(p).version, 'map-reading.3'); assert.deepEqual(round(p), p);
});

test('73-B the actual correction: three not-made reports read as zero progress; the withdrawn claim leaves the current lead but stays as history', () => {
  let { p, q, r71 } = after71(); const c = correction72(p, q);
  assert.ok(c.inp.ask.priors.length >= 3 && c.inp.ask.priors.every(x => x.target.requestId === q.id && x.kind !== 'open'));
  M.validateMapAsk(c.inp.ask);
  p = apply(c.p, c.inp, c.r).project;
  assert.equal(R.requestComparison(p, last(p)), '원한 항목 3개 · 변경 보고 0개 · 미구현 보고 3개');
  const one = item(p, q, 'change_1');
  assert.equal(one.state, 'not-made'); assert.equal(one.lead.match.quote, Q.withdraw);
  assert.deepEqual(one.history.map(x => x.match.quote), [Q.input]); assert.equal(one.history[0].replacedBy.match.quote, Q.withdraw);
  // The 71 words are kept exactly, and the 'main 미병합' remark still stands (it never cancelled the feature report, nor is it cancelled).
  assert.ok(one.current.some(x => x.match.quote === Q.main)); assert.ok(p.pasted[0].text.includes(Q.input));
  assert.deepEqual(last(p).matches[1].replaces, { reading: r71, index: 0 });
  for (const id of ['change_2', 'change_3']) { assert.equal(item(p, q, id).state, 'not-made'); assert.equal(item(p, q, id).history.length, 0); }
  // backup and copy carry the same current reading
  const back = parseBackup(serializeBackup(p, null)).project; assert.deepEqual(back, p);
  assert.equal(R.requestComparison(back, last(back)), '원한 항목 3개 · 변경 보고 0개 · 미구현 보고 3개');
});

test('73-C a missed or doubtful withdrawal never reads as progress: not-made beside made is mixed, not a change report', () => {
  let { p, q } = after71();
  for (const opts of [{ replaces: null }, { stance: 'unclear', text: '정보만 남김' }]) {
    const c = correction72(p, q, opts), v = M.validateMapReply(c.r, c.inp.ask);
    assert.equal(v.matches[1].replaces, null, 'an unclear remark cannot take a report back');
    const done = M.applyReading(c.p, c.inp, v, meta()).project;
    const state = item(done, q, 'change_1').state;
    assert.equal(state, opts.stance === 'unclear' ? 'made' : 'mixed');
    assert.equal(item(done, q, 'change_1').history.length, 0);
    if (state === 'mixed') assert.match(R.requestComparison(done, last(done)), /변경 보고 0개 · 보고 엇갈림 1개/);
  }
});

test('73-D a general open remark does not cancel a report; checked made and open made are never progress', () => {
  let { p, q } = after71();
  p = D.pasteRecord(p, `요청문 ${q.id} 추가: 폴더 전체 변환은 확인했다고 보고하지 않습니다. 실패 후 계속 검사는 통과했습니다.`, null).project;
  const inp = ask(p, [q]);
  assert.throws(() => M.validateMapReply(reply([m(q, 'change_2', '폴더 전체 변환은 확인했다고 보고하지 않습니다', { kind: 'open', stance: 'made' })]), inp.ask), /INVALID_RESPONSE/);
  p = apply(p, inp, reply([m(q, 'change_1', '폴더 전체 변환은 확인했다고 보고하지 않습니다', { kind: 'open', stance: 'unclear' }),
    m(q, 'change_2', '실패 후 계속 검사는 통과했습니다', { kind: 'checked', stance: 'made' })])).project;
  assert.equal(item(p, q, 'change_1').state, 'made'); assert.equal(item(p, q, 'change_2').state, 'none');
  assert.equal(R.requestComparison(p, last(p)), '원한 항목 3개 · 변경 보고 1개 · 변경 근거 아직 없는 항목 2개');
});

test('73-E isolation: an older version arriving late, another RQ and another item are never withdrawn by a correction of one', () => {
  let p = D.addArea(D.createProject(), '폴더', ''); const area = p.space.areas[0].id;
  const one = plan(p, area).scope, two = plan(p, area, ['다른 요청의 폴더 감시', '다른 요청의 알림']).scope;
  p = D.pasteRecord(p, 'v2 보고: 폴더 입력을 구현했습니다. 다른 요청의 알림도 구현했습니다. 실패 후 계속도 구현했습니다.', null).project;
  let inp = ask(p, [one, two]);
  p = apply(p, inp, reply([m(one, 'change_1', '폴더 입력을 구현했습니다', { about: 'v2' }), m(two, 'change_2', '다른 요청의 알림도 구현했습니다'), m(one, 'change_2', '실패 후 계속도 구현했습니다')])).project;
  // A v1 note pasted later says not built: it names no v2 claim, so the v2 report stands (and v1 vs v2 is no clash).
  p = D.pasteRecord(p, 'v1 기준 기록: 폴더 입력은 아직 구현하지 않았습니다.', null).project;
  inp = ask(p, [one, two]); const key = priorOf(inp, '폴더 입력을 구현했습니다');
  const late = M.validateMapReply(reply([m(one, 'change_1', '폴더 입력은 아직 구현하지 않았습니다', { about: 'v1', stance: 'not-made', replaces: key })]), inp.ask);
  assert.equal(late.matches[0].replaces, null);
  // A withdrawal aimed at another RQ's item than the prior answers is made up: refused.
  assert.throws(() => M.validateMapReply(reply([m(two, 'change_1', '폴더 입력은 아직 구현하지 않았습니다', { stance: 'not-made', replaces: key })]), inp.ask), /INVALID_RESPONSE/);
  assert.throws(() => M.validateMapReply(reply([m(one, 'change_1', '폴더 입력은 아직 구현하지 않았습니다', { stance: 'not-made', replaces: 'M99' })]), inp.ask), /INVALID_RESPONSE/);
  p = M.applyReading(p, inp, late, meta()).project;
  assert.equal(item(p, one, 'change_1').state, 'made');
  // The v2 claim named explicitly: withdrawn for that one item only.
  p = D.pasteRecord(p, 'v2 정정: v2의 폴더 입력 구현 주장을 철회합니다. 아직 구현하지 않았습니다.', null).project;
  inp = ask(p, [one, two]);
  p = apply(p, inp, reply([m(one, 'change_1', 'v2의 폴더 입력 구현 주장을 철회합니다. 아직 구현하지 않았습니다.', { about: 'v2', stance: 'not-made', replaces: priorOf(inp, '폴더 입력을 구현했습니다') })])).project;
  assert.equal(item(p, one, 'change_1').history.length, 1); assert.equal(item(p, one, 'change_1').state, 'not-made', 'the v1 and v2 not-made notes both stand; nothing made is left');
  assert.equal(item(p, one, 'change_2').state, 'made'); assert.equal(item(p, two, 'change_2').state, 'made');
  assert.deepEqual(round(p), p);
});

test('73-F a correction by the person while the reading runs wins; an earlier confirmed target does not block a later withdrawal', () => {
  for (const act of ['exclude', 'retarget']) {
    let { p, q } = after71(); const c = correction72(p, q), x = R.requestMatches(c.p).find(x => x.match.quote === Q.input);
    const during = R.correctRequestMatch(c.p, x.reading, x.index, act === 'exclude' ? null : { requestId: q.id, itemId: 'change_2' });
    const done = M.applyReading(during, c.inp, M.validateMapReply(c.r, c.inp.ask), meta()).project;
    assert.equal(last(done).matches[1].replaces, null);
    const prior = R.requestMatches(done).find(x => x.match.quote === Q.input);
    assert.equal(prior.replacedBy, null); assert.equal(prior.excluded, act === 'exclude');
    if (act === 'retarget') assert.equal(item(done, q, 'change_2').state, 'mixed', 'the 71 claim now answers change_2 and is not silently withdrawn there');
  }
  // Confirmed by the person before the correction arrived: still withdrawable by an explicit record.
  let { p, q } = after71(); const x = R.requestMatches(p).find(x => x.match.quote === Q.input);
  p = R.correctRequestMatch(p, x.reading, x.index, { requestId: q.id, itemId: 'change_1' });
  const c = correction72(p, q); p = apply(c.p, c.inp, c.r).project;
  assert.equal(item(p, q, 'change_1').history.length, 1); assert.equal(item(p, q, 'change_1').state, 'not-made');
});

test('73-G reading the withdrawn passage again, excluding the withdrawing one, and old backups never bring the old claim back; unlinking is its own act', () => {
  let { p, q, r71 } = after71(); const c = correction72(p, q); p = apply(c.p, c.inp, c.r).project;
  // A stored replay of the 71 interval (as a re-comparison or a copy would read it) keeps the withdrawal.
  const old = p.readings.find(r => r.id === r71), replay = { ...structuredClone(old), id: 'R_replay73', hash: 'e'.repeat(64), parts: [], relations: [] };
  let again = round({ ...p, readings: [...p.readings, replay] });
  assert.equal(item(again, q, 'change_1').state, 'not-made'); assert.equal(item(again, q, 'change_1').history.length, 1);
  // Excluding the withdrawing passage takes it out of the request; the old claim does not quietly return.
  const w = R.requestMatches(p).find(x => x.match.quote === Q.withdraw);
  const excluded = round(R.correctRequestMatch(p, w.reading, w.index, null));
  assert.equal(item(excluded, q, 'change_1').state, 'none'); assert.equal(R.requestMatches(excluded).find(x => x.match.quote === Q.input).replacedBy !== null, true);
  // Undoing the link is the person's explicit act: both reports stand again, side by side.
  const undone = round(R.unlinkReplacement(p, w.reading, w.index));
  assert.equal(item(undone, q, 'change_1').state, 'mixed'); assert.equal(item(undone, q, 'change_1').history.length, 0);
  assert.throws(() => R.unlinkReplacement(undone, w.reading, w.index), /INVALID_REQUEST_CORRECTION/);
  assert.throws(() => R.unlinkReplacement(p, r71, 0), /INVALID_REQUEST_CORRECTION/);
});

test('73-H stored withdrawals are checked where they stand: tampered links, a project.10 claiming them and bad undo entries are refused', () => {
  let { p, q, r71 } = after71(); const c = correction72(p, q); p = apply(c.p, c.inp, c.r).project;
  const at = p.readings.length - 1;
  const bad = [
    x => { x.readings[at].matches[1].replaces = { reading: x.readings[at].id, index: 0 }; },
    x => { x.readings[at].matches[1].replaces = { reading: r71, index: 9 }; },
    x => { x.readings[at].matches[1].targets = [{ requestId: q.id, itemId: 'change_2' }]; },
    x => { x.readings[at].matches[1].stance = 'unclear'; },
    x => { x.readings[at].matches[2].replaces = { reading: r71, index: 0 }; },
    x => { x.readings[at].matches[1].replaces = { reading: r71, index: 2 }; x.readings[at].matches[1].kind = 'reported'; x.readings[at].matches[1].stance = 'not-made'; x.readings[at].matches[1].quote = x.readings[at].matches[1].quote; x.readings[at].matches[1].targets = [{ requestId: q.id, itemId: 'change_1' }]; },
    x => { delete x.readings[at].matches[1].stance; },
    x => { x.readings[at].version = 'map-reading.2'; },
    x => { x.schemaVersion = 'idea015.project.10'; },
    x => { x.readings.push({ version: 'replace-correction.1', id: 'Q_bad', at: new Date().toISOString(), reading: r71, index: 0 }); },
    x => { x.readings.push({ version: 'replace-correction.1', id: 'Q_bad', at: new Date().toISOString(), reading: x.readings[at].id, index: 1, extra: 1 }); }
  ];
  bad.forEach((mutate, i) => { const x = structuredClone(p); mutate(x); assert.throws(() => parseProject(JSON.stringify(x)), undefined, `case ${i}`); });
  // An unchanged project.10 reads as before (stance-less matches = unclassified), its bytes kept.
  const v10 = parseProject(RAW); assert.equal(v10.schemaVersion, 'idea015.project.12'); assert.deepEqual(v10.readings, raw.readings);
});

test('73-I the attached actual reply: no false progress, the newest correction leads, and evidence resting only on the withdrawn claim reads apart', () => {
  const p = parseProject(RAW), reading = last(p), q = reading.requests[0];
  assert.equal(R.requestComparison(p, reading), '원한 항목 3개 · 변경 보고 0개 · 미분류 보고 3개');
  const one = item(p, q, 'change_1'); assert.equal(one.state, 'unclassified'); assert.match(one.lead.match.text, /구상만/);
  const area = id => raw.space.areas.find(a => a.name === id).id, folder = area('폴더 입력');
  const u = M.partUnderstanding(p, folder);
  assert.equal(u.state, 'reported'); assert.equal(u.revised, true); assert.equal(M.stateLabel(u), '보고 정정됨');
  assert.ok(u.claims[0].replaces, 'the correcting claim reads first'); assert.equal(u.roleBasisRevised, true);
  assert.equal(u.role, raw.readings[1].parts[0].role, 'the designed role stays (identity kept)');
  const revised = M.revisedRelations(p);
  assert.deepEqual([...revised], ['L_1d4cc839-20a8-4bc7-bb9b-cc0669db4f54']);
  assert.equal(p.space.relations.length, 3, 'no relation is removed'); assert.equal(p.space.areas.filter(a => a.archived).length, 0);
  for (const name of ['변환기', '입력 경로 읽기', '내보내기']) assert.equal(M.partUnderstanding(p, area(name)).roleBasisRevised, false);
  assert.equal(M.stateLabel(M.partUnderstanding(p, area('변환기'))), '작업 보고 있음');
  // The person's own description is never marked as resting on a withdrawn report.
  assert.equal(M.partUnderstanding(D.correctReadingRole(p, folder, '폴더 입력은 아직 구상'), folder).roleBasisRevised, false);
});

test('73-J a description with independent evidence is not marked; only one resting wholly on the withdrawn passage is', () => {
  let p = D.createProject(); p = D.pasteRecord(p, '입력 처리를 바꿨습니다. 폴더 경로를 받는 화면은 따로 있습니다.', null).project;
  let inp = M.buildMapAsk(p, studioView(p));
  const A = '입력 처리를 바꿨습니다', B = '폴더 경로를 받는 화면은 따로 있습니다';
  p = M.applyReading(p, inp, M.validateMapReply({ summary: '', parts: [
    { ref: 'new:input', name: '입력', parent: null, role: '입력 처리', roleAbout: null, roleReplaces: null, basis: [{ record: 'N01', quote: A }], claims: [{ kind: 'reported', text: '입력 처리를 바꿨다', record: 'N01', quote: A, about: null, replaces: null }] },
    { ref: 'new:screen', name: '화면', parent: null, role: '입력 화면', roleAbout: null, roleReplaces: null, basis: [{ record: 'N01', quote: A }, { record: 'N01', quote: B }], claims: [] }],
    relations: [{ from: 'new:screen', to: 'new:input', kind: 'flow', note: '화면이 입력에 넘김', record: 'N01', quote: A }], candidates: [], gaps: [] }, inp.ask), meta()).project;
  p = D.pasteRecord(p, '정정: 앞의 입력 처리 변경 주장은 철회합니다. 아직 구현하지 않았습니다.', null).project;
  inp = M.buildMapAsk(p, studioView(p));
  p = M.applyReading(p, inp, M.validateMapReply({ summary: '', parts: [{ ref: 'P01', name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [],
    claims: [{ kind: 'reported', text: '입력 처리는 아직 구현하지 않았다', record: 'N01', quote: '아직 구현하지 않았습니다', about: null, replaces: 'C01' }] }], relations: [], candidates: [], gaps: [] }, inp.ask), meta()).project;
  const [input, screen] = p.space.areas.map(a => a.id);
  assert.equal(M.partUnderstanding(p, input).roleBasisRevised, true);
  assert.equal(M.partUnderstanding(p, screen).roleBasisRevised, false, 'one of its two quotes is independent');
  assert.equal(M.revisedRelations(p).size, 1);
});

test('73-K priors are bounded and travel within the UTF-8 budget; a map.3 ask with too many or unknown-target priors is refused', () => {
  let p = D.addArea(D.createProject(), '폴더', ''); const area = p.space.areas[0].id, q = plan(p, area).scope;
  const lines = Array.from({ length: 30 }, (_, i) => `항목 ${String(i).padStart(2, '0')} 입력 처리를 바꿨습니다 ${'가'.repeat(150)}`);
  p = D.pasteRecord(p, lines.join('\n'), null).project;
  let inp = ask(p, [q]);
  p = apply(p, inp, reply(lines.slice(0, 24).map(l => m(q, 'change_1', l.slice(0, 280))))).project;
  p = D.pasteRecord(p, '다음 보고: 새 원문입니다.', null).project;
  inp = ask(p, [q]);
  assert.ok(inp.ask.priors.length > 0 && inp.ask.priors.length <= M.MAP_PRIORS);
  assert.ok(new TextEncoder().encode(JSON.stringify(inp.ask)).length <= M.MAP_BYTES); M.validateMapAsk(inp.ask);
  const many = { ...inp.ask, priors: Array.from({ length: 25 }, (_, i) => ({ ...inp.ask.priors[0], key: `M${String(i + 1).padStart(2, '0')}` })) };
  assert.throws(() => M.validateMapAsk(many));
  assert.throws(() => M.validateMapAsk({ ...inp.ask, priors: [{ ...inp.ask.priors[0], target: { requestId: q.id, itemId: 'nope' } }] }));
  assert.throws(() => M.validateMapAsk({ ...inp.ask, schemaVersion: 'studio.map.2' }));
});

test('73-L labels: a work report and a part state never read as built', () => {
  assert.equal(M.CLAIM_LABEL.reported, '작업 보고'); assert.equal(M.STATE_LABEL.reported, '작업 보고 있음'); assert.equal(R.MATCH_LABEL.reported, '작업 보고');
  assert.equal(M.stateLabel({ state: 'checked', revised: true }), '보고 정정됨'); assert.equal(M.stateLabel({ state: 'want', revised: true }), '요구');
});

test('73-M scope identity is by whole identifiers: v1 is not v10, the same branch named two ways is one, main is not a feature branch', () => {
  const S = R.scopeRelation;
  assert.equal(S('v1', 'v10'), 'different'); assert.equal(S('v1.2', 'v1.20'), 'different'); assert.equal(S('abc1234', 'def5678'), 'different');
  assert.equal(S('feature/folder 브랜치', 'feature/folder의 폴더 입력'), 'same'); assert.equal(S('feature/folder@abc1234', 'feature/folder'), 'same');
  assert.equal(S('feature/folder 브랜치', 'main'), 'different'); assert.equal(S('feature/folder@abc1234', 'feature/folder@def5678'), 'different');
  assert.equal(S('단일 문서 검사 조건', 'v1'), 'unknown'); assert.equal(S(null, 'v1'), 'unknown');
  assert.equal(R.namesDifference('v10 보고: 다른 판입니다', 'v1', 'v10'), false); assert.equal(R.namesDifference('v1의 주장을 철회합니다', 'v1', 'v10'), true);
  // Only the identifier that differs counts: the shared branch of two commits points at neither commit.
  assert.equal(R.namesDifference('feature/folder@def5678 정정', 'feature/folder@abc1234', 'feature/folder@def5678'), false);
  assert.equal(R.namesDifference('abc1234의 주장을 철회합니다', 'feature/folder@abc1234', 'feature/folder@def5678'), true);
  assert.equal(R.separateLines('feature/folder@abc1234', 'feature/folder@def5678'), false); assert.equal(R.separateLines('v1', 'v10'), true); assert.equal(R.separateLines('main', 'feature/folder'), true);
});

/** One RQ, one positive report about `about`, then a later record; returns the ask for the later record and the prior's key. */
function scoped(about, later) {
  let p = D.addArea(D.createProject(), '폴더', ''); const area = p.space.areas[0].id, q = plan(p, area).scope;
  p = D.pasteRecord(p, `${about} 보고: 폴더 입력을 구현했습니다.`, null).project;
  p = apply(p, ask(p, [q]), reply([m(q, 'change_1', '폴더 입력을 구현했습니다', { about })])).project;
  p = D.pasteRecord(p, later, null).project;
  const inp = ask(p, [q]);
  return { p, q, inp, key: priorOf(inp, '폴더 입력을 구현했습니다') };
}
test('73-N the wire takes a withdrawal by scope identity: v1 never takes back v10; the same branch named otherwise does; a dropped one never leaves the old positive alone', () => {
  // v1 note against a v10 report: link dropped, and a different version's not-made leaves the v10 report standing.
  let s = scoped('v10', 'v1 기준: 폴더 입력은 아직 구현하지 않았습니다.');
  let v = M.validateMapReply(reply([m(s.q, 'change_1', '폴더 입력은 아직 구현하지 않았습니다', { about: 'v1', stance: 'not-made', replaces: s.key })]), s.inp.ask);
  assert.equal(v.matches[0].replaces, null);
  let done = M.applyReading(s.p, s.inp, v, meta()).project; assert.equal(item(done, s.q, 'change_1').state, 'made');
  // 'feature/folder 브랜치' then 'feature/folder의 폴더 입력' (the record does not repeat the first wording): one branch, the link holds.
  s = scoped('feature/folder 브랜치', '정정: feature/folder의 폴더 입력은 앞 보고와 달리 아직 구현하지 않았습니다.');
  const withdraw = '앞 보고와 달리 아직 구현하지 않았습니다';
  v = M.validateMapReply(reply([m(s.q, 'change_1', withdraw, { about: 'feature/folder의 폴더 입력', stance: 'not-made', replaces: s.key })]), s.inp.ask);
  assert.equal(v.matches[0].replaces, s.key);
  done = M.applyReading(s.p, s.inp, v, meta()).project; assert.equal(item(done, s.q, 'change_1').state, 'not-made'); assert.equal(item(done, s.q, 'change_1').history.length, 1);
  // The same correction without the link: the two read side by side (mixed), never the old positive alone.
  done = apply(s.p, s.inp, reply([m(s.q, 'change_1', withdraw, { about: 'feature/folder의 폴더 입력', stance: 'not-made' })])).project;
  assert.equal(item(done, s.q, 'change_1').state, 'mixed');
  // Not merged to main is another branch: the feature report stands.
  s = scoped('feature/folder', 'main 기록: 폴더 입력은 main에 아직 구현되지 않았습니다.');
  done = apply(s.p, s.inp, reply([m(s.q, 'change_1', '폴더 입력은 main에 아직 구현되지 않았습니다', { about: 'main', stance: 'not-made' })])).project;
  assert.equal(item(done, s.q, 'change_1').state, 'made');
});

test('73-O stored data follows the same scope rule: a v2→v1 link the wire would drop is refused when injected; one naming v2 is accepted', () => {
  for (const [later, ok] of [['v1 기준: 폴더 입력은 아직 구현하지 않았습니다.', false], ['v1 기준: v2의 폴더 입력 주장도 철회합니다. 폴더 입력은 아직 구현하지 않았습니다.', true]]) {
    const s = scoped('v2', later);
    const done = apply(s.p, s.inp, reply([m(s.q, 'change_1', '폴더 입력은 아직 구현하지 않았습니다', { about: 'v1', stance: 'not-made', replaces: ok ? s.key : null })])).project;
    const x = structuredClone(done), r = x.readings.at(-1), first = x.readings.find(e => e.version === 'map-reading.3');
    r.matches[0].replaces = { reading: first.id, index: 0 };
    if (ok) { assert.deepEqual(round(x).readings.at(-1).matches[0].replaces, { reading: first.id, index: 0 }); assert.equal(item(round(x), s.q, 'change_1').state, 'not-made'); }
    else assert.throws(() => parseProject(JSON.stringify(x)));
  }
});

test('73-P a withdrawn claim marks only its own part: claim 0 of another part in the same reading, and the same words used by another part, stay current', () => {
  let p = D.createProject(); p = D.pasteRecord(p, '입력 처리를 바꿨습니다. 출력 저장을 바꿨습니다.', null).project;
  let inp = M.buildMapAsk(p, studioView(p));
  const A = '입력 처리를 바꿨습니다', B = '출력 저장을 바꿨습니다';
  const claim = q => ({ kind: 'reported', text: `${q.slice(0, 5)} 보고`, record: 'N01', quote: q, about: null, replaces: null });
  p = M.applyReading(p, inp, M.validateMapReply({ summary: '', parts: [
    { ref: 'new:in', name: '입력', parent: null, role: '입력 처리', roleAbout: null, roleReplaces: null, basis: [{ record: 'N01', quote: A }], claims: [claim(A)] },
    { ref: 'new:out', name: '출력', parent: null, role: '출력 저장', roleAbout: null, roleReplaces: null, basis: [{ record: 'N01', quote: B }], claims: [claim(B)] },
    { ref: 'new:log', name: '기록', parent: null, role: '입력 처리 기록', roleAbout: null, roleReplaces: null, basis: [{ record: 'N01', quote: A }], claims: [] }],
    relations: [{ from: 'new:out', to: 'new:log', kind: 'flow', note: '출력이 기록에 넘김', record: 'N01', quote: B }], candidates: [], gaps: [] }, inp.ask), meta()).project;
  p = D.pasteRecord(p, '정정: 입력 처리 변경 주장은 철회합니다. 아직 구현하지 않았습니다.', null).project;
  inp = M.buildMapAsk(p, studioView(p));
  // P01 is 입력: its C01 is withdrawn. 출력's own claim is index 0 of the same reading too.
  p = M.applyReading(p, inp, M.validateMapReply({ summary: '', parts: [{ ref: 'P01', name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [],
    claims: [{ kind: 'reported', text: '입력 처리는 아직 구현하지 않았다', record: 'N01', quote: '아직 구현하지 않았습니다', about: null, replaces: 'C01' }] }], relations: [], candidates: [], gaps: [] }, inp.ask), meta()).project;
  const [input, output, log] = p.space.areas.map(a => a.id);
  assert.equal(M.partUnderstanding(p, input).roleBasisRevised, true);
  assert.equal(M.partUnderstanding(p, output).roleBasisRevised, false, 'claim 0 of another part is another claim');
  assert.equal(M.partUnderstanding(p, log).roleBasisRevised, false, 'the same words as another part\'s withdrawn claim are that part\'s own basis');
  assert.equal(M.revisedRelations(p).size, 0);
});

test('73-Q MAP3 tells the three replacement forms apart; a reply that mixes them is still refused, never repaired', async () => {
  const { MAP3_PROMPT } = await import('../server/map-prompt.mjs');
  assert.match(MAP3_PROMPT, /roleReplaces: 문자열이 아니라 원문 인용 객체 \{"record":"N01","quote":"원문 그대로"\}/);
  assert.match(MAP3_PROMPT, /claims\[\]\.replaces: 그 부분의 current 주장 키 문자열\("C01"/); assert.match(MAP3_PROMPT, /matches\[\]\.replaces: priors 키 문자열\("M01"/);
  const s = scoped('v2', 'v2 정정: 이제 폴더 경로를 받습니다.');
  const part = { ref: 'P01', name: null, parent: null, role: '폴더 경로를 받는 입력', roleAbout: null, roleReplaces: '이제 폴더 경로를 받습니다', basis: [{ record: 'N01', quote: '이제 폴더 경로를 받습니다' }], claims: [] };
  assert.throws(() => M.validateMapReply({ ...reply([]), parts: [part] }, s.inp.ask), /INVALID_RESPONSE/);
  assert.throws(() => M.validateMapReply(reply([m(s.q, 'change_1', '이제 폴더 경로를 받습니다', { replaces: 'C01' })]), s.inp.ask), /INVALID_RESPONSE/);
  assert.throws(() => M.validateMapReply(reply([m(s.q, 'change_1', '이제 폴더 경로를 받습니다', { replaces: { record: 'N01', quote: '이제 폴더 경로를 받습니다' } })]), s.inp.ask), /INVALID_RESPONSE/);
});

test('73-R another commit of the same branch: naming only the shared branch takes nothing back; the two read side by side; naming the old commit does', () => {
  for (const [later, holds] of [['feature/folder@def5678 정정: 폴더 입력은 아직 구현하지 않았습니다.', false], ['feature/folder@def5678 정정: abc1234의 폴더 입력 주장을 철회합니다. 폴더 입력은 아직 구현하지 않았습니다.', true]]) {
    const s = scoped('feature/folder@abc1234', later);
    const v = M.validateMapReply(reply([m(s.q, 'change_1', '폴더 입력은 아직 구현하지 않았습니다', { about: 'feature/folder@def5678', stance: 'not-made', replaces: s.key })]), s.inp.ask);
    assert.equal(v.matches[0].replaces, holds ? s.key : null);
    const done = M.applyReading(s.p, s.inp, v, meta()).project, one = item(done, s.q, 'change_1');
    assert.equal(one.state, holds ? 'not-made' : 'mixed'); assert.equal(one.history.length, holds ? 1 : 0);
    if (!holds) {
      // Injected into stored data, the link the wire dropped is refused the same way.
      const x = structuredClone(done); x.readings.at(-1).matches[0].replaces = { reading: x.readings.find(e => e.version === 'map-reading.3').id, index: 0 };
      assert.throws(() => parseProject(JSON.stringify(x)));
    }
  }
});

test('73-S a stored withdrawal is judged on the interval that was sent: a version named only in the unsent tail justifies nothing', () => {
  const tail = '\n꼬리의 관련 없는 문장: v2 문서 목록.';
  const s = scoped('v2', 'v1 기준: 폴더 입력은 아직 구현하지 않았습니다.\n' + '배경 설명을 그대로 둡니다.\n'.repeat(1000) + tail);
  const sent = s.inp.ask.records[0].text;
  assert.ok(!sent.includes('v2') && s.p.pasted.at(-1).text.includes('v2') && s.p.pasted.at(-1).text.length > sent.length);
  const v = M.validateMapReply(reply([m(s.q, 'change_1', '폴더 입력은 아직 구현하지 않았습니다', { about: 'v1', stance: 'not-made', replaces: s.key })]), s.inp.ask);
  assert.equal(v.matches[0].replaces, null);
  const done = M.applyReading(s.p, s.inp, v, meta()).project, x = structuredClone(done);
  x.readings.at(-1).matches[0].replaces = { reading: x.readings.find(e => e.version === 'map-reading.3').id, index: 0 };
  assert.throws(() => parseProject(JSON.stringify(x)), undefined, 'the full record names v2, but only in a tail this reading never sent');
});
