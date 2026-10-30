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
