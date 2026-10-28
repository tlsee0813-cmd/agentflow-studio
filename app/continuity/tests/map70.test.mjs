// EXPERIENCE70: reading records into the map (studio.map.1, project.9). The replies below are written for the test (a stub, not a
// model): these check the contract, the one write and what it keeps, not reading quality. Samples: A a synthetic early CLI converter
// (requirement + author's report + folder idea, then a later report), B the record69 PC/device calibration record on a map with two
// parts named '보정', C a greeting, D the record69 Node-RED PR6019 author's text on an empty map (unedited), E long and stale input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { parseProject, parseBackup } from '../dist/public/shared/validation.js';
import { serializeProject, serializeBackup } from '../dist/public/shared/storage.js';
import { validatePlanAsk } from '../dist/public/shared/plan-api.js';
import { projectInput } from '../dist/public/client/plan-source.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { MAP_PROMPT } from '../server/map-prompt.mjs';
import { sample } from './understanding17-fixtures.mjs';

const text = (dir, name) => readFileSync(new URL(`./fixtures/${dir}/${name}`, import.meta.url), 'utf8');
const CLI = text('record70', 'synthetic-cli.txt'), CLI_LATER = text('record70', 'synthetic-cli-later.txt');
const CAL = text('record69', 'synthetic-calibration.txt'), PR6019 = text('record69', 'node-red-pr6019.txt');
let n = 0;
const meta = () => ({ id: `R_test${++n}`, at: new Date(Date.UTC(2026, 9, 28, 0, n)).toISOString(), model: 'stub', prompt: 'm1-000000000000', hash: String(n).padStart(64, '0') });
const paste = (p, t) => D.pasteRecord(p, t, null).project;
const ask = p => M.buildMapAsk(p, studioView(p));
const part = (ref, o = {}) => ({ ref, name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: [], ...o });
const fresh = (ref, name, quote, o = {}) => part(ref, { name, basis: [{ record: 'N01', quote }], ...o });
const claim = (kind, t, quote, o = {}) => ({ kind, text: t, record: 'N01', quote, about: null, replaces: null, ...o });
const reply = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], ...o });
function apply(p, r) { const inp = ask(p); return M.applyReading(p, inp, M.validateMapReply(r, inp.ask), meta()); }
const areaNamed = (p, name) => p.space.areas.find(a => a.name === name);

/* A: a first map from one record, then a later record, with the person's rename, place and plan text in between. */
function cliFirst() {
  const p = paste(D.rename(D.createProject(), '문서 변환기'), CLI);
  return apply(p, reply({ summary: '단일 마크다운 문서를 PDF로 바꾸는 명령과 표 보존 요구, 아직 정하지 않은 폴더 변환 구상이 보여요.', parts: [
    fresh('new:convert', '문서 변환 명령', '`mdconv convert input.md --to pdf` 명령을 만들었습니다', { role: '마크다운 문서를 PDF·docx로 바꾸는 명령줄 도구.', claims: [
      claim('want', '표가 깨지지 않아야 함', '표가 깨지면 안 되고'),
      claim('reported', 'PDF로 바꾸는 convert 명령을 만듦', '`mdconv convert input.md --to pdf` 명령을 만들었습니다'),
      claim('idea', '폴더째 변환 (방식 미정)', '나중엔 폴더째로 변환할 수 있으면 좋겠어요')] }),
    fresh('new:table', '표 보존', '본문과 표를 그대로 옮기는 변환을 구현했고', { parent: 'new:convert', role: '본문과 표를 원래 모양대로 옮긴다.', claims: [
      claim('checked', '표 보존 테스트 3개 통과(작성자 보고)', '표 보존 테스트 3개가 통과했습니다')] }),
    fresh('new:docx', 'docx 출력', 'docx 출력은 아직 만들지 않았습니다', { parent: 'new:convert', claims: [claim('want', 'docx로도 내보내기', '마크다운 문서를 PDF와 docx로 바꾸는')] })],
  relations: [{ from: 'new:docx', to: 'new:table', kind: 'needs', note: '같은 표 보존 규칙', record: 'N01', quote: '본문과 표를 그대로 옮기는 변환을 구현했고' }] }));
}

test('M70-A1 a first map: parts and relations rest on quotes; Area.note stays empty; one reading kept; no task, return or anchor made', () => {
  const { project: p, created, reading } = cliFirst();
  assert.equal(p.schemaVersion, 'idea015.project.13');
  assert.deepEqual(p.space.areas.map(a => [a.name, a.note]), [['문서 변환 명령', ''], ['표 보존', ''], ['docx 출력', '']]);
  assert.equal(created.length, 3); assert.equal(p.space.relations.length, 1); assert.equal(p.readings.length, 1);
  assert.deepEqual(p.tasks, []); assert.deepEqual(p.sources, []); assert.deepEqual(p.space.understanding, {});
  const v = studioView(p), conv = v.parts.find(x => x.name === '문서 변환 명령');
  // A part with no request of its own reads by what was read (not as a bare 'plan' dot); the idea stays an idea.
  assert.equal(conv.status, 'plan'); assert.equal(conv.reading.state, 'reported');
  assert.equal(v.parts.find(x => x.name === 'docx 출력').reading.state, 'want');
  assert.ok(conv.reading.claims.some(c => c.kind === 'idea' && c.text.includes('폴더')));
  assert.equal(reading.records[0].from, 0); assert.equal(reading.records[0].to, CLI.length);
  assert.deepEqual(parseProject(serializeProject(p)), p, 'project.9 round trip');
  const b = parseBackup(serializeBackup(p, null)); assert.deepEqual(b.project, p, 'backup round trip');
  assert.equal(ask(p).problem, 'NOTHING_NEW', 'a record read once is not sent again');
});

test('M70-A2 the next record updates the same ids after a rename, a move and a plan draft; nothing of the person\'s is rewritten', () => {
  let p = cliFirst().project;
  const conv = areaNamed(p, '문서 변환 명령').id, docx = areaNamed(p, 'docx 출력').id;
  p = D.editArea(p, conv, '변환기', '내 설명: 회사 문서용');
  p = D.moveArea(p, docx, { x: 900, y: 40 });
  p = D.editDraft(p, '폴더째 변환하고 싶어');
  p = paste(p, CLI_LATER);
  const inp = ask(p), sent = inp.ask.parts.find(x => inp.parts.get(x.id) === conv);
  // The renamed part goes with its own name, the name it was read as, and what was understood; the person's note as theirs.
  assert.equal(sent.name, '변환기'); assert.equal(sent.readAs, '문서 변환 명령'); assert.equal(sent.note, '내 설명: 회사 문서용'); assert.match(sent.role, /명령줄 도구/);
  assert.ok(sent.current.some(c => c.kind === 'reported'));
  assert.deepEqual(inp.ask.records.map(r => r.id), ['N01']); assert.equal(inp.ask.records[0].text, CLI_LATER);
  const pd = [...inp.parts].find(([, id]) => id === docx)[0], pc = [...inp.parts].find(([, id]) => id === conv)[0];
  const before = structuredClone(p.space);
  const after = M.applyReading(p, inp, M.validateMapReply(reply({ summary: 'docx 출력이 추가됐다는 보고가 있고 이미지 상대경로는 아직 확인되지 않았어요.', parts: [
    part(pd, { claims: [claim('reported', 'docx 출력을 추가함', 'docx 출력을 추가했습니다'), claim('checked', 'docx 표 테스트 2개 통과(작성자 보고)', 'docx 표 테스트 2개가 통과했고')] }),
    part(pc, { claims: [claim('open', '이미지 상대경로 확인 전', '이미지 상대경로는 아직 확인하지 않았어요'.slice(0, 0) || '이미지 상대경로는 아직 확인하지 않았습니다')] })] }), inp.ask), meta()).project;
  assert.deepEqual(after.space.areas, before.areas, 'names, notes, archive flags as the person left them');
  assert.deepEqual(after.space.layout, before.layout); assert.deepEqual(after.space.containment, before.containment); assert.deepEqual(after.space.relations, before.relations);
  assert.equal(after.draft, '폴더째 변환하고 싶어');
  const v = studioView(after);
  assert.equal(v.parts.find(x => x.id === docx).reading.state, 'reported');
  assert.ok(v.parts.find(x => x.id === conv).reading.claims.some(c => c.kind === 'open'));
  assert.equal(v.parts.find(x => x.id === conv).reading.claims.filter(c => c.kind === 'idea').length, 1, 'the earlier idea is still current: a record that says nothing of it is not a removal');
});

test('M70-A3 the person\'s correction holds the description only; later claims still come in; Area.note and return.2 untouched', () => {
  let p = cliFirst().project;
  const conv = areaNamed(p, '문서 변환 명령').id;
  p = D.correctReadingRole(p, conv, '사내 문서 변환용 CLI');
  assert.equal(areaNamed(p, '문서 변환 명령').note, '');
  p = paste(p, CLI_LATER);
  const inp = ask(p), pc = [...inp.parts].find(([, id]) => id === conv)[0], sent = inp.ask.parts.find(x => x.id === pc);
  assert.equal(sent.roleBy, 'person'); assert.equal(sent.role, '사내 문서 변환용 CLI');
  p = M.applyReading(p, inp, M.validateMapReply(reply({ parts: [part(pc, { role: 'PDF와 docx를 내보내는 명령', basis: [{ record: 'N01', quote: 'docx 출력을 추가했습니다' }],
    claims: [claim('reported', 'docx 출력을 추가함', 'docx 출력을 추가했습니다')] })] }), inp.ask), meta()).project;
  const u = studioView(p).parts.find(x => x.id === conv).reading;
  assert.equal(u.role, '사내 문서 변환용 CLI'); assert.ok(u.corrected); assert.equal(u.others[0].text, 'PDF와 docx를 내보내는 명령');
  assert.ok(u.claims.some(c => c.text === 'docx 출력을 추가함'));
  assert.deepEqual(p.space.understanding, {});
  assert.throws(() => D.correctReadingRole(D.addArea(D.createProject(), '빈 부분'), D.addArea(D.createProject(), '빈 부분').space.areas[0].id, 'x'));
});

/* B: same names under different parents. */
function calibration() {
  let p = D.addArea(D.createProject(), 'PC 앱', '사용자 PC에서 쓰는 설정 앱'); p = D.addArea(p, '장치 펌웨어', '측정 장치에 들어가는 펌웨어');
  const [pc, dev] = p.space.areas.map(a => a.id);
  p = D.addChildArea(p, pc, '보정', '측정값 입력 화면'); p = D.addChildArea(p, dev, '보정', '영점 오프셋 계산');
  const [pcCal, devCal] = p.space.areas.slice(2).map(a => a.id);
  return { p: paste(p, CAL), pc, dev, pcCal, devCal };
}
test('M70-B1 same name, different parents: claims go to each by id; a new part named like a sibling is not made and attaches nothing', () => {
  const { p, pc, pcCal, devCal } = calibration(), inp = ask(p), a = id => [...inp.parts].find(([, x]) => x === id)[0];
  const r = M.validateMapReply(reply({ parts: [
    part(a(pcCal), { claims: [claim('reported', '입력란이 소수점 둘째 자리까지 받음', '측정값 입력란이 소수점 둘째 자리까지 받도록 바꿨고')] }),
    part(a(devCal), { claims: [claim('reported', '영점 오프셋 계산식을 0.5% 보정 계수로 바꿈', '영점 오프셋 계산식을 0.5% 보정 계수로 바꿨습니다'), claim('open', '기존 출고분 적용 여부', '장치 쪽 새 계수를 기존 출고분에도 적용할지')] }),
    fresh('new:dup', '보정', "PC 앱의 '보정' 화면", { parent: a(pc) })] }), inp.ask);
  const out = M.applyReading(p, inp, r, meta()), v = studioView(out.project);
  assert.equal(out.project.space.areas.length, 4, 'no second 보정 under PC 앱');
  assert.equal(out.reading.skipped[0].reason, 'same-name');
  assert.deepEqual(out.reading.candidates[0].areaIds, [pcCal]);
  assert.equal(v.parts.find(x => x.id === pcCal).reading.claims.length, 1, 'the duplicate attaches nothing to the existing part');
  assert.ok(v.parts.find(x => x.id === devCal).reading.claims.some(c => c.kind === 'open'));
  assert.ok(!v.parts.find(x => x.id === pcCal).reading.claims.some(c => c.kind === 'open'), 'the device decision stays on the device part');
});
test('M70-B2 what the reply leaves as a candidate between parts is not also settled on one of them (same quote)', () => {
  const { p, pcCal, devCal } = calibration(), inp = ask(p), a = id => [...inp.parts].find(([, x]) => x === id)[0];
  const q = '보정 작업 정리입니다.';
  const out = M.applyReading(p, inp, M.validateMapReply(reply({ parts: [part(a(pcCal), { claims: [claim('describes', '보정 작업 정리', q)] })],
    candidates: [{ text: '어느 보정인지 원문만으로 가를 수 없어요', parts: [a(pcCal), a(devCal)], record: 'N01', quote: q }] }), inp.ask), meta());
  assert.equal(studioView(out.project).parts.find(x => x.id === pcCal).reading, null);
  assert.equal(out.reading.candidates.length, 1);
});

/* C: a greeting, and records that are not about the program. */
test('M70-C1 a greeting makes no part, keeps one reading with what material would help, and is not sent again', () => {
  const p = paste(D.createProject(), '안녕하세요! 오늘도 잘 부탁드려요.');
  const out = apply(p, reply({ gaps: ['만들려는 프로그램을 한두 문장으로, 또는 작업 AI의 보고를 붙여 주세요.'] }));
  assert.deepEqual(out.project.space.areas, []); assert.deepEqual(out.created, []); assert.equal(out.reading.gaps.length, 1);
  assert.equal(ask(out.project).problem, 'NOTHING_NEW');
});

/* D: a real author's report (Node-RED PR6019, unedited) on an empty map: a responsibility, not a file list. */
test('M70-D1 the PR6019 text: a part rests on the record, a test file stays a quote, reported checks keep their numbers', () => {
  const p = paste(D.createProject(), PR6019), inp = ask(p);
  assert.equal(inp.ask.records[0].text, PR6019);
  const out = M.applyReading(p, inp, M.validateMapReply(reply({ summary: 'MQTT 브로커 노드의 연결 동작이 action의 url을 항상 쓰도록 바뀌었다는 작성자 보고예요.', parts: [
    fresh('new:mqtt', 'MQTT 브로커 연결', 'Now a `url` in the action is always used', { role: 'MQTT 브로커 노드가 connect action으로 연결 주소를 정한다.', claims: [
      claim('reported', 'connect action의 url을 항상 사용', 'Now a `url` in the action is always used, as the help text describes'),
      claim('checked', '수정 후 4 passing, 28 pending(작성자 보고)', 'with the fix: 4 passing, 28 pending')] })] }), inp.ask), meta());
  assert.deepEqual(out.project.space.areas.map(a => a.name), ['MQTT 브로커 연결']);
  assert.ok(!out.project.space.areas.some(a => /spec\.js|mqtt\.js/.test(a.name)));
  assert.ok(studioView(out.project).parts[0].reading.claims.some(c => c.text.includes('4 passing, 28 pending')));
});

/* The contract: every quote in what was sent, known ids only, no unknown keys, no key-like words, a new role with its quote. */
test('M70-E1 reply refusals: quotes, ids, keys, parents, cycles, role without basis, replaces, key-like text, limits', () => {
  const { p, pcCal } = calibration(), inp = ask(p), a = [...inp.parts].find(([, x]) => x === pcCal)[0];
  const ok = reply({ parts: [part(a, { claims: [claim('reported', '바꿈', '측정값 입력란이 소수점 둘째 자리까지 받도록 바꿨고')] })] });
  assert.doesNotThrow(() => M.validateMapReply(ok, inp.ask));
  const bad = [
    reply({ parts: [part(a, { claims: [claim('reported', '바꿈', '원문에 없는 문장입니다')] })] }),
    reply({ parts: [part('P99', { claims: [claim('reported', '바꿈', '측정값 입력란이')] })] }),
    { ...ok, extra: 1 },
    reply({ parts: [{ ...part(a, { claims: [claim('reported', '바꿈', '측정값 입력란이')] }), extra: 1 }] }),
    reply({ parts: [part(a, { role: '근거 없는 새 설명' })] }),
    reply({ parts: [part(a, { role: '근거 없는 새 설명', claims: [claim('reported', '바꿈', '측정값 입력란이 소수점')] })] }),
    reply({ parts: [part('new:x', { name: '새것' })] }),
    reply({ parts: [fresh('new:a', 'A', '보정 작업 정리입니다', { parent: 'new:b' }), fresh('new:b', 'B', '보정 작업 정리입니다', { parent: 'new:a' })] }),
    reply({ parts: [fresh('new:a', 'A', '보정 작업 정리입니다', { parent: 'P77' })] }),
    reply({ parts: [part(a, { claims: [claim('reported', '바꿈', '측정값 입력란이', { replaces: 'C01' })] })] }),
    reply({ parts: [part(a, { claims: [claim('reported', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789', '측정값 입력란이')] })] }),
    reply({ parts: [part(a, { name: '바꾼 이름', claims: [claim('reported', '바꿈', '측정값 입력란이')] })] }),
    reply({ parts: [part(a, { claims: [claim('verified', '바꿈', '측정값 입력란이')] })] }),
    reply({ parts: Array.from({ length: 13 }, (_, i) => fresh(`new:p${i}`, `부분${i}`, '보정 작업 정리입니다')) })
  ];
  for (const [i, r] of bad.entries()) assert.throws(() => M.validateMapReply(r, inp.ask), /INVALID_RESPONSE/, `bad reply ${i}`);
  // A candidate may name a part this same reply adds; never an unknown one.
  const withNew = reply({ parts: [fresh('new:a', 'A 처리', '보정 작업 정리입니다')], candidates: [{ text: 'A 처리가 PC 쪽 보정과 같은 대상인지 원문으로 가를 수 없어요', parts: ['new:a', a], record: null, quote: null }] });
  const applied = M.applyReading(p, inp, M.validateMapReply(withNew, inp.ask), meta());
  assert.deepEqual(applied.reading.candidates[0].areaIds, [applied.created[0], pcCal]);
  assert.throws(() => M.validateMapReply({ ...withNew, candidates: [{ ...withNew.candidates[0], parts: ['new:zzz'] }] }, inp.ask), /INVALID_RESPONSE/);
  assert.throws(() => M.validateMapAsk({ ...inp.ask, extra: 1 }));
  assert.throws(() => M.validateMapAsk({ ...inp.ask, records: [] }));
});

test('M70-E2 a long record goes in part; its unread tail is read next time; quotes are checked against what was actually sent', () => {
  const body = Array.from({ length: 900 }, (_, i) => `줄 ${i}: 변환 처리 기록입니다.`).join('\n'), long = `[긴 기록]\n${body}\n마지막 줄: 꼬리 구간에서만 나오는 문장.`;
  let p = paste(D.createProject(), long);
  const first = ask(p), sent = first.ask.records[0];
  assert.ok(sent.text.length < long.length); assert.match(sent.note, /구간만 보냄/); assert.equal(first.coverage.partial, 1);
  assert.throws(() => M.validateMapReply(reply({ parts: [fresh('new:t', '꼬리', '꼬리 구간에서만 나오는 문장')] }), first.ask), /INVALID_RESPONSE/, 'a quote from the unsent tail is refused');
  p = M.applyReading(p, first, M.validateMapReply(reply({ parts: [fresh('new:h', '변환 처리', '줄 0: 변환 처리 기록입니다.')] }), first.ask), meta()).project;
  const second = ask(p);
  assert.equal(second.problem, null); assert.equal(second.ask.records[0].text, long.slice(p.readings[0].records[0].to, p.readings[0].records[0].to + second.ask.records[0].text.length));
  assert.match(second.ask.records[0].note, /앞 구간은 앞선 정리에서 읽음/);
  assert.throws(() => M.validateMapReply(reply({ parts: [fresh('new:x', '머리', '줄 0: 변환 처리 기록입니다.')] }), second.ask), /INVALID_RESPONSE/, 'the head was not sent this time');
});

test('M70-E3 not applied on a changed map: another reading meanwhile, the same request twice, a named part archived; edits meanwhile are kept', () => {
  let { p, pcCal } = calibration();
  const inp = ask(p), a = [...inp.parts].find(([, x]) => x === pcCal)[0];
  const r = M.validateMapReply(reply({ parts: [part(a, { claims: [claim('reported', '바꿈', '측정값 입력란이 소수점 둘째 자리까지 받도록 바꿨고')] })] }), inp.ask);
  const m = meta();
  // The person renames the part and pastes another record while the reading is out: applied on top, both kept.
  let during = D.editArea(p, pcCal, 'PC 보정', '측정값 입력 화면'); during = paste(during, '다른 기록: 저장 버튼 문구를 바꿨습니다.');
  const done = M.applyReading(during, inp, r, m).project;
  assert.equal(done.space.areas.find(x => x.id === pcCal).name, 'PC 보정'); assert.equal(done.pasted.length, 2);
  assert.throws(() => M.applyReading(done, inp, r, { ...m, id: 'R_other' }), /MAP_CHANGED/, 'another reading came first');
  assert.throws(() => M.applyReading({ ...p, readings: [{ ...done.readings[0] }] }, { ...inp, after: done.readings[0].id }, r, m), /ALREADY_APPLIED/);
  const archived = D.setAreaArchived(p, pcCal, true);
  assert.throws(() => M.applyReading(archived, inp, r, meta()), /MAP_CHANGED/);
});

test('M70-E4 archived parts and removed lines a reading made are not made again by a reply of the same shape', () => {
  let p = cliFirst().project;
  const docx = areaNamed(p, 'docx 출력').id, rel = p.space.relations[0].id;
  p = D.removeRelation(p, rel); p = D.setAreaArchived(p, docx, true);
  p = paste(p, CLI_LATER);
  const inp = ask(p), conv = [...inp.parts].find(([, id]) => id === areaNamed(p, '문서 변환 명령').id)[0], table = [...inp.parts].find(([, id]) => id === areaNamed(p, '표 보존').id)[0];
  const out = M.applyReading(p, inp, M.validateMapReply(reply({ parts: [fresh('new:docx', 'docx 출력', 'docx 출력을 추가했습니다', { parent: conv })],
    relations: [{ from: table, to: conv, kind: 'related', note: '', record: 'N01', quote: '같은 표 보존 규칙을 씁니다' }] }), inp.ask), meta());
  assert.equal(out.project.space.areas.filter(a => a.name === 'docx 출력').length, 1, 'only the archived one');
  assert.equal(out.reading.skipped[0].reason, 'archived');
  // A line of another kind or direction is new; the removed one (docx → 표 보존, needs) would not come back.
  assert.equal(out.project.space.relations.length, 1);
});

test('M70-E5 versions: a description is replaced only by the record\'s own words that it supersedes it; v1 after v2 never turns it back', () => {
  let p = paste(D.createProject(), '보드 v2: 전원 관리 칩이 바뀌었습니다. v2 문서 기준.');
  p = apply(p, reply({ parts: [fresh('new:pw', '전원', '전원 관리 칩이 바뀌었습니다', { role: 'v2 전원 관리', roleAbout: 'v2', claims: [claim('describes', '전원 관리 칩 사용', '전원 관리 칩이 바뀌었습니다', { about: 'v2' })] })] })).project;
  const id = p.space.areas[0].id, role = () => studioView(p).parts[0].reading;
  const again = (t, r) => { p = paste(p, t); const inp = ask(p), a = [...inp.parts][0][0]; p = M.applyReading(p, inp, M.validateMapReply(reply({ parts: [r(a)] }), inp.ask), meta()).project; };
  const sent = ask(paste(p, 'x 기록입니다 길게')).ask.parts[0];
  assert.deepEqual(sent.current.map(c => c.about), ['v2'], 'claim versions go with the request'); assert.equal(sent.roleAbout, 'v2');
  // The exact counterexample: v2 first, then a v1 document arriving later, naming another version, with no words of replacement.
  again('보드 v1 문서: 전원 관리 칩 없이 직접 공급합니다.', a => part(a, { role: 'v1 직접 공급', roleAbout: 'v1', basis: [{ record: 'N01', quote: '전원 관리 칩 없이 직접 공급합니다' }] }));
  assert.equal(role().role, 'v2 전원 관리', 'a differing version name is not a reason to replace'); assert.deepEqual(role().others.map(x => [x.text, x.about]), [['v1 직접 공급', 'v1']]);
  // Same version, later document, no words of replacement: kept apart as well.
  again('같은 v2 커밋의 추가 문서: 전원 관리 칩은 I2C로 설정합니다.', a => part(a, { role: 'v2 추가 문서의 설명', roleAbout: 'v2', basis: [{ record: 'N01', quote: '전원 관리 칩은 I2C로 설정합니다' }],
    claims: [claim('describes', '전원 관리 칩 사용', '전원 관리 칩은 I2C로 설정합니다', { about: 'v1' })] }));
  assert.equal(role().role, 'v2 전원 관리'); assert.equal(role().others[0].text, 'v2 추가 문서의 설명');
  assert.equal(role().claims.filter(c => c.text === '전원 관리 칩 사용').length, 2, 'same words, two versions: two claims');
  // Only the record's own words that it supersedes the earlier description replace it; the replaced one stays readable.
  again('보드 v3: 이제 전원 관리는 별도 모듈로 바뀌었습니다.', a => part(a, { role: 'v3 별도 모듈', roleAbout: 'v3', basis: [{ record: 'N01', quote: '전원 관리는 별도 모듈로 바뀌었습니다' }],
    roleReplaces: { record: 'N01', quote: '이제 전원 관리는 별도 모듈로 바뀌었습니다' } }));
  assert.equal(role().role, 'v3 별도 모듈'); assert.ok(role().others.some(x => x.text === 'v2 전원 관리'));
  assert.equal(p.space.areas.find(a => a.id === id).note, '');
  // The person's correction stays whatever a record says.
  p = D.correctReadingRole(p, id, '사용자가 고친 전원 설명');
  again('보드 v4: 이제 전원 관리는 다시 통합되었습니다.', a => part(a, { role: 'v4 통합', roleAbout: 'v4', basis: [{ record: 'N01', quote: '전원 관리는 다시 통합되었습니다' }],
    roleReplaces: { record: 'N01', quote: '이제 전원 관리는 다시 통합되었습니다' } }));
  assert.equal(role().role, '사용자가 고친 전원 설명'); assert.equal(role().others[0].text, 'v4 통합');
  // A replacement quote must be in what was sent.
  const inp = ask(paste(p, '보드 v5 문서입니다. 전원은 그대로입니다.'));
  assert.throws(() => M.validateMapReply(reply({ parts: [part([...inp.parts][0][0], { role: 'x', basis: [{ record: 'N01', quote: '전원은 그대로입니다' }], roleReplaces: { record: 'N01', quote: '원문에 없는 대체 문장' } })] }), inp.ask), /INVALID_RESPONSE/);
});

test('M70-E6 a reading of a part with a valid return.2 description leaves that description, its revision and anchors valid', () => {
  let { p, area, file } = sample(); p = D.importResultFile(p, JSON.stringify(file));
  const before = D.areaDescription(p, area).current, anchors = JSON.stringify(p.tasks.flatMap(t => t.handoffs.map(h => h.anchor)));
  p = paste(p, '작업 보고: 이 영역의 검색 결과 정렬을 바꿨습니다.');
  const inp = ask(p), a = [...inp.parts].find(([, id]) => id === area)[0];
  p = M.applyReading(p, inp, M.validateMapReply(reply({ parts: [part(a, { role: '검색 결과를 정렬해 보여 준다', basis: [{ record: 'N01', quote: '검색 결과 정렬을 바꿨습니다' }] })] }), inp.ask), meta()).project;
  const after = D.areaDescription(p, area).current;
  assert.equal(after.valid, true); assert.equal(after.summary, before.summary); assert.equal(after.entry.revision, before.entry.revision);
  assert.equal(JSON.stringify(p.tasks.flatMap(t => t.handoffs.map(h => h.anchor))), anchors);
  const v = studioView(p).parts.find(x => x.id === area);
  assert.equal(v.summary, before.summary, 'the received description still leads'); assert.equal(v.reading.role, '검색 결과를 정렬해 보여 준다');
});

test('M70-E7 project.8 reads as no readings; a bad reading is refused (unknown record, area, kind, replaced claim)', () => {
  const p = cliFirst().project, v8 = JSON.parse(serializeProject(p)); v8.schemaVersion = 'idea015.project.8'; delete v8.readings;
  const read = parseProject(JSON.stringify(v8)); assert.equal(read.schemaVersion, 'idea015.project.13'); assert.deepEqual(read.readings, []);
  assert.throws(() => parseProject(JSON.stringify({ ...v8, readings: [] })), 'a project.8 that already has the key is not repaired');
  for (const breakIt of [
    x => { x.readings[0].parts[0].claims[0].record = 'N_nope'; },
    x => { x.readings[0].parts[0].areaId = 'A_nope'; },
    x => { x.readings[0].parts[0].claims[0].kind = 'verified'; },
    x => { x.readings[0].parts[0].claims[0].replaces = { reading: x.readings[0].id, index: 0 }; },
    x => { x.readings[0].records[0].to = x.readings[0].records[0].total + 1; },
    x => { x.readings[0].extra = 1; }
  ]) { const x = JSON.parse(serializeProject(p)); breakIt(x); assert.throws(() => parseProject(JSON.stringify(x))); }
});

test('M70-P1 a change plan reads pasted records as records and what was read as reading, apart from user words and reports', () => {
  let p = cliFirst().project; p = paste(p, CLI_LATER);
  const inp = projectInput({ project: p, view: studioView(p) }, '폴더째 변환하고 싶어');
  assert.equal(inp.problem, null); validatePlanAsk(inp.ask);
  const kinds = inp.ask.evidence.map(e => [e.id, e.kind]);
  assert.deepEqual(kinds.filter(([, k]) => k === 'record').map(([id]) => id), ['N01', 'N02'], 'raw pasted text goes as record, never as user, report or test');
  assert.ok(kinds.some(([id, k]) => /^M\d+$/.test(id) && k === 'reading'));
  assert.equal(inp.ask.evidence.find(e => e.id === 'N02').text, CLI);
  assert.match(inp.ask.evidence.find(e => e.kind === 'reading').basis, /앱이 확인한 사실 아님/);
  assert.equal(inp.records.total, 2); assert.equal(inp.records.sent, 2);
});

test('M70-H1 HTTP: /api/studio/map validates both ways, keeps reasoning with a map budget of its own, and names its prompt', async () => {
  const { p } = calibration(), inp = ask(p), key = 'test-key-not-real-0123456789';
  let seen = null;
  const good = reply({ gaps: ['부족한 자료 예시'] });
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: key, DEEPSEEK_MODEL: 'm-ask', DEEPSEEK_PLAN_MODEL: 'm-plan' },
    fetchImpl: async (url, init) => { seen = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(good) } }] }), { status: 200 }); } });
  const post = body => new Request('https://studio.example/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1', origin: 'https://studio.example' }, body: JSON.stringify(body) });
  const status = await (await handle(new Request('https://studio.example/api/studio/status'))).json();
  assert.deepEqual(status.map, { model: 'm-plan', prompt: await mapPromptId() }); assert.match(status.map.prompt, /^m6-[0-9a-f]{12}$/);
  assert.equal((await handle(post({ ...inp.ask, extra: 1 }))).status, 400); assert.equal(seen, null);
  const r = await handle(post(inp.ask)); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { model: 'm-plan', reply: good });
  assert.equal(seen.messages[0].content, MAP_PROMPT); assert.equal(seen.thinking.type, 'enabled'); assert.equal(seen.reasoning_effort, 'low'); assert.equal(seen.max_tokens, 16384);
  const bad = createStudioHandler({ env: { DEEPSEEK_API_KEY: key }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply({ parts: [part('P01', { claims: [claim('reported', 'x', '없는 문장입니다')] })] })) } }] }), { status: 200 }) });
  assert.equal((await bad(post(inp.ask))).status, 502);
});

test('M70-Q1 a quote that only leaves out Markdown emphasis resolves to the one span of the record; anything else is still refused', () => {
  const md = '## Features\n- **Error handling**: try/catch/finally with stack traces\n- **Closures**: lexical scope\n- a*b stays an operator; 2 * 3 = 6\n- **Loops** and **Loops**';
  assert.equal(M.resolveQuote(md, 'Error handling: try/catch/finally with stack traces'), 'Error handling**: try/catch/finally with stack traces');
  assert.equal(M.resolveQuote(md, '**Error handling**: try/catch/finally'), '**Error handling**: try/catch/finally', 'exact still exact');
  assert.equal(M.resolveQuote(md, 'Closures:   lexical scope'), 'Closures**: lexical scope');
  assert.equal(M.resolveQuote(md, 'ab stays an operator'), null, 'an operator inside a word is not a mark');
  // Only paired strong emphasis the record really has: a single or unpaired star, operators and code are never set aside.
  assert.equal(M.resolveQuote('total = a * b', 'total = a b'), null, 'multiplication with spaces');
  assert.equal(M.resolveQuote('pointer = *value', 'pointer = value'), null, 'a pointer star');
  assert.equal(M.resolveQuote('x = 2 ** 3 ** 4', 'x = 2 3 4'), null, 'power operators');
  assert.equal(M.resolveQuote('y = a**b**c', 'y = abc'), null, 'stars inside a word');
  assert.equal(M.resolveQuote('call `**kwargs**` here', 'call `kwargs` here'), null, 'inline code keeps its stars');
  assert.equal(M.resolveQuote('```\nx **not emphasis** y\n```', 'x not emphasis y'), null, 'a fenced block keeps its stars');
  assert.equal(M.resolveQuote('```\ncode\n```\nx **is emphasis** y', 'x is emphasis y'), 'x **is emphasis** y', 'after the fence closes');
  assert.equal(M.resolveQuote('- __Closures__: lexical scope', 'Closures: lexical scope'), 'Closures__: lexical scope');
  assert.equal(M.resolveQuote('- **Retries**: up to 3 times', 'Retries: up to 4 times'), null, 'a changed number');
  assert.equal(M.resolveQuote('*Run* fast', 'Run fast'), null, 'single-star emphasis is not repaired (not needed)');
  assert.equal(M.resolveQuote('**very** very **very**', 'very very'), null, 'two overlapping places once marks are set aside');
  assert.equal(M.resolveQuote('**very** very **much**', 'very very'), 'very** very', 'one place');
  assert.equal(M.resolveQuote(md, 'Error handling: try/catch with stack traces'), null, 'pieces joined');
  assert.equal(M.resolveQuote(md, 'Error handling: try/catch/finally with stack trace and more'), null);
  assert.equal(M.resolveQuote(md, '2 * 3 = 7'), null, 'a changed number');
  assert.equal(M.resolveQuote('**Run** fast here\n__Run__ fast here', 'Run fast here'), null, 'two places once marks are set aside: ambiguous');
  // In a reply: the stored quote is the record's own span, found again exactly later.
  let p = paste(D.createProject(), md); const inp = ask(p);
  const r = M.validateMapReply(reply({ parts: [fresh('new:e', '오류 처리', 'Error handling: try/catch/finally with stack traces')] }), inp.ask);
  assert.equal(r.parts[0].basis[0].quote, 'Error handling**: try/catch/finally with stack traces');
  p = M.applyReading(p, inp, r, meta()).project;
  assert.ok(md.includes(p.readings[0].parts[0].basis[0].quote));
  assert.throws(() => M.validateMapReply(reply({ parts: [fresh('new:e', '연산', 'ab stays an operator')] }), inp.ask), /INVALID_RESPONSE/);
});

test('M70-P2 the plan\'s reading evidence carries the description\'s version, its quotes and the ids of the records quoted in the same request', () => {
  let p = paste(D.createProject(), '보드 v2: 전원 관리 칩이 바뀌었습니다. v2 문서 기준.');
  p = apply(p, reply({ parts: [fresh('new:pw', '전원', '전원 관리 칩이 바뀌었습니다', { role: 'v2 전원 관리', roleAbout: 'v2', claims: [claim('describes', '전원 관리 칩 사용', '전원 관리 칩이 바뀌었습니다', { about: 'v2' })] })] })).project;
  p = paste(p, '보드 v1 문서: 전원 관리 칩 없이 직접 공급합니다.');
  { const inp = ask(p), a = [...inp.parts][0][0]; p = M.applyReading(p, inp, M.validateMapReply(reply({ parts: [part(a, { role: 'v1 직접 공급', roleAbout: 'v1', basis: [{ record: 'N01', quote: '전원 관리 칩 없이 직접 공급합니다' }] })] }), inp.ask), meta()).project; }
  const inp = projectInput({ project: p, view: studioView(p) }, '전원 설명을 정리하고 싶어'), e = inp.ask.evidence.find(x => x.kind === 'reading');
  const n = inp.ask.evidence.find(x => x.kind === 'record' && x.text.startsWith('보드 v2')).id;
  assert.match(e.text, /설명 · v2 기준: v2 전원 관리 — “전원 관리 칩이 바뀌었습니다” \(N\d\d\)/);
  assert.ok(e.text.includes(`(${n})`), 'the quoted record\'s id in this request');
  assert.match(e.text, /다른 기록의 설명\(현재 설명을 대체한다는 근거 없음\) · v1: v1 직접 공급/);
  assert.match(e.text, /\[설명 · v2\] 전원 관리 칩 사용/);
});
