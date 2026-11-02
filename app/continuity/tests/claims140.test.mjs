// AF140: a part's current claims are all of them. partUnderstanding no longer cuts the claims that still stand to 12; what is
// current (replaces, dedup, newest first, a replacing claim first), the state and the readers that take fewer (the map ask's 6
// current claims) are as before. Model-free, author-written fixture (part140-case.mjs); not a model's reading.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as S from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { FEATURES, LIMITS, build } from './part140-case.mjs';

const mods = { D, M, S, studioView };
const said = f => `[스텁] ${f}을(를) 지원 대상으로 설명한다`;

test('140-1 thirteen standing claims over four readings all read: none cut, the first reading\'s first included, newest first', () => {
  const { project, engine } = build(mods), u = M.partUnderstanding(parseProject(JSON.stringify(project)), engine);
  assert.equal(u.claims.length, 13);
  assert.deepEqual(new Set(u.claims.map(c => c.text)), new Set([...FEATURES.map(said), `[스텁] ${LIMITS.slice(4)}`]));
  // Newest first: the limitation (read last) leads; the first reading's first claim, the one a cut to 12 left out, is last.
  assert.equal(u.claims[0].text, `[스텁] ${LIMITS.slice(4)}`); assert.equal(u.claims.at(-1).text, said(FEATURES[0]));
  assert.equal(u.history.length, 4); assert.equal(u.state, 'describes');
});

test('140-2 what is current is unchanged: a replaced claim leaves, a repeated one is one, the replacing one leads; the map ask sends the same 6', () => {
  let { project: p, engine } = build(mods); p = parseProject(JSON.stringify(p));
  const before = M.partUnderstanding(p, engine).claims;
  p = D.pasteRecord(p, '정정: 메모리 사용 상한과 실행 시간 제한은 문서에만 있고 실제로는 설정할 수 없다.\n지원: Promise와 async/await을(를) 지원 대상으로 설명한다.', null).project;
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), at = w => inp.ask.records.flatMap(r => r.spans).find(s => s.t.trimStart().startsWith(w)).s;
  const ask = inp.ask.parts.find(x => x.name === 'micro-javascript');
  // The ask's current claims are the first 6 of the reading's own order (as before: the first 6 of the first 12).
  assert.deepEqual(ask.current.map(c => c.text), before.slice(0, 6).map(c => c.text));
  const target = ask.current.find(c => c.text === said(FEATURES[10])); assert.ok(target, 'the claim to replace is among the 6 sent');
  const reply = { summary: '[스텁] 정정', candidates: [], gaps: [], matches: [], material: [], relations: [], parts: [{ ref: ask.id, name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: [
    { kind: 'describes', text: '[스텁] 메모리·시간 제한은 문서에만 있고 실제로는 설정할 수 없다', at: at('정정:'), about: null, replaces: target.key, key: 's1' },
    { kind: 'describes', text: said(FEATURES[7]), at: at('지원: Promise'), about: null, replaces: null, key: 's2' }] }] };
  p = M.applyReading(p, inp, M.validateMapReply(reply, inp.ask), { id: 'R_part140_fix', at: new Date(Date.now() + 99).toISOString(), model: 'stub', prompt: 'm6-000000000140', hash: '9'.repeat(64) }).project;
  const u = M.partUnderstanding(p, engine);
  assert.equal(u.claims.length, 13, '13 - 1 replaced + 1 replacing; the repeated words are one claim');
  assert.equal(u.claims[0].text, '[스텁] 메모리·시간 제한은 문서에만 있고 실제로는 설정할 수 없다'); assert.ok(u.claims[0].replaces);
  assert.equal(u.claims.some(c => c.text === said(FEATURES[10])), false, 'the replaced claim is history only');
  assert.equal(u.claims.filter(c => c.text === said(FEATURES[7])).length, 1);
  assert.equal(u.revised, false); assert.equal(u.history.length, 5);
});

// Synthetic normal wires, applied through the same contract as a later reading. No model or provider is involved.
const positive = '파일 저장을 구현했다고 보고함';
const claimWire = (key, kind, at, about, replaces = null, text = positive) => ({ key, kind, text, at, about, replaces });
const emptyWire = () => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] });
let withdrawalSequence = 0;
function applyWithdrawalWire(project, input, wire) {
  const n = ++withdrawalSequence;
  return M.applyReading(project, input, M.validateMapReply(wire, input.ask), {
    id: `R_withdraw140_${n}`, at: '2026-11-02T00:00:00.000Z', model: 'synthetic-wire', prompt: 'm6-000000000140', hash: n.toString(16).padStart(64, '0')
  });
}
const inputFor = project => M.buildMapAsk(project, studioView(project), [], undefined, M.MAP7_SCHEMA);
function span(input, prefix) {
  const got = input.ask.records.flatMap(record => record.spans).filter(s => s.t.trimStart().startsWith(prefix));
  assert.equal(got.length, 1, `one fixture span: ${prefix}`); return got[0].s;
}
function duplicateWithdrawal() {
  const firstText = '첫 보고: v1 파일 저장을 구현했다고 보고합니다.\n다른 판본: v2 파일 저장을 구현했다고 보고합니다.\n검사 보고: v1 파일 저장 동작 검사가 통과했다고 보고합니다.\n다른 부분 보고: v1 파일 저장을 구현했다고 보고합니다.';
  let p = D.pasteRecord(D.createProject(), firstText, null).project, input = inputFor(p);
  const firstWire = { ...emptyWire(), parts: [
    { ref: 'new:save', name: '저장', parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [span(input, '첫 보고:')], claims: [
      claimWire('s1', 'reported', span(input, '첫 보고:'), 'v1'),
      claimWire('s2', 'reported', span(input, '다른 판본:'), 'v2'),
      claimWire('s3', 'checked', span(input, '검사 보고:'), 'v1')] },
    { ref: 'new:other', name: '별도 저장', parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [span(input, '다른 부분 보고:')],
      claims: [claimWire('s4', 'reported', span(input, '다른 부분 보고:'), 'v1')] }
  ] };
  const first = applyWithdrawalWire(p, input, firstWire); p = first.project;
  const [area, other] = first.created;
  const duplicateText = 'v1\n재보고: 파일 저장을 구현했다고 다시 보고합니다.';
  p = D.pasteRecord(p, duplicateText, null).project; input = inputFor(p);
  const alias = [...input.parts].find(([, id]) => id === area)[0];
  const duplicate = applyWithdrawalWire(p, input, { ...emptyWire(), parts: [{ ref: alias, name: null, parent: null, role: null,
    roleAboutAt: null, roleReplaces: null, basis: [], claims: [{ key: 's1', kind: 'reported', text: '파일  저장을  구현했다고 보고함',
      at: span(input, '재보고:'), aboutAt: span(input, 'v1'), replaces: null }] }] });
  p = duplicate.project;
  const before = M.partUnderstanding(p, area), originals = structuredClone(p.readings);
  assert.equal(before.claims.filter(c => c.kind === 'reported' && c.about === 'v1').length, 1);
  assert.equal(before.claims.find(c => c.kind === 'reported' && c.about === 'v1').reading, duplicate.reading.id, 'newest normalized duplicate owns the current claim');
  const correctionText = 'v1\n정정: 첫 보고와 재보고의 파일 저장 구현 주장을 모두 철회합니다.\n파일 저장은 아직 미구현입니다.';
  p = D.pasteRecord(p, correctionText, null).project; input = inputFor(p);
  const current = input.ask.parts.find(part => part.id === alias).current;
  const target = current.find(c => c.kind === 'reported' && c.about === 'v1'); assert.ok(target);
  assert.equal(current.filter(c => c.kind === 'reported' && c.about === 'v1').length, 1, 'only the current duplicate has a target key');
  const correction = applyWithdrawalWire(p, input, { ...emptyWire(), parts: [{ ref: alias, name: null, parent: null, role: null,
    roleAboutAt: null, roleReplaces: null, basis: [], claims: [{ key: 's1', kind: 'reported', text: '두 구현 보고를 철회하며 파일 저장은 아직 미구현이라고 보고함',
      at: span(input, '정정:') + '-' + span(input, '파일 저장은').split('.')[1], aboutAt: span(input, 'v1'), replaces: target.key }] }] });
  return { project: correction.project, area, other, first, duplicate, correction, originals, texts: [firstText, duplicateText, correctionText] };
}

test('140-3 withdrawing the latest normalized duplicate cannot revive an older report; other part, kind and version stay current', () => {
  const f = duplicateWithdrawal(), p = f.project, u = M.partUnderstanding(p, f.area);
  assert.equal(u.claims.some(c => c.kind === 'reported' && c.about === 'v1' && c.text.replace(/\s+/g, ' ') === positive), false);
  assert.ok(u.claims.some(c => c.replaces?.reading === f.duplicate.reading.id));
  assert.ok(u.claims.some(c => c.kind === 'reported' && c.about === 'v2' && c.text === positive), 'same words about another version remain current');
  assert.ok(u.claims.some(c => c.kind === 'checked' && c.about === 'v1' && c.text === positive), 'another kind is not the withdrawn report');
  assert.ok(M.partUnderstanding(p, f.other).claims.some(c => c.kind === 'reported' && c.about === 'v1' && c.text === positive), 'another part keeps its own report');
  assert.deepEqual(p.readings.slice(0, 2), f.originals, 'prior readings are never rewritten');
  assert.deepEqual(p.pasted.map(r => r.text), f.texts, 'every received original is preserved');
  assert.equal(u.history.length, 3); assert.equal(u.history[0].claims[0].text, positive);
  assert.equal(u.history[1].claims[0].text, '파일  저장을  구현했다고 보고함');
  const probe = D.pasteRecord(p, '추가 자료: 보관한 과거 근거를 다시 확인합니다.', null).project;
  const nextInput = inputFor(probe), next = nextInput.ask.parts.find(part => part.id === [...nextInput.parts].find(([, id]) => id === f.area)[0]);
  assert.equal(next.current.some(c => c.kind === 'reported' && c.about === 'v1' && c.text.replace(/\s+/g, ' ') === positive), false, 'the next request cannot inherit the hidden positive report');
  assert.deepEqual(parseProject(S.serializeProject(p)), p);
});

test('140-4 a fresh assertion after withdrawal owns the current semantic key without reviving its historical duplicates', () => {
  const f = duplicateWithdrawal(), before = structuredClone(f.project.readings);
  const p = D.pasteRecord(f.project, 'v1\n새 보고: 철회 이후 파일 저장을 새로 구현했다고 보고합니다.', null).project, input = inputFor(p);
  const alias = [...input.parts].find(([, id]) => id === f.area)[0];
  const next = applyWithdrawalWire(p, input, { ...emptyWire(), parts: [{ ref: alias, name: null, parent: null, role: null,
    roleAboutAt: null, roleReplaces: null, basis: [], claims: [{ key: 's1', kind: 'reported', text: positive,
      at: span(input, '새 보고:'), aboutAt: span(input, 'v1'), replaces: null }] }] });
  const claims = M.partUnderstanding(next.project, f.area).claims.filter(c => c.kind === 'reported' && c.about === 'v1' && c.text === positive);
  assert.equal(claims.length, 1); assert.equal(claims[0].reading, next.reading.id);
  assert.equal(claims[0].record, next.project.pasted.at(-1).id, 'new evidence, rather than an old hidden duplicate, restores the assertion');
  assert.deepEqual(next.project.readings.slice(0, 3), before);
  assert.deepEqual(parseProject(S.serializeProject(next.project)), next.project);
});
