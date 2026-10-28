// AF80: a part's current description opens the passages it was read on (its own basis, PartUnderstanding.roleBasis). Written
// replies (no AI call); the record is the synthetic standard of role80-fixture.mjs. The DOM, focus and fold return are checked by
// studio_browser.py role80_flow; here: which passages, in what order, where, and when there are none.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { roleEvidence } from '../dist/public/client/role-evidence.js';
import { build80, RECORD80 } from './role80-fixture.mjs';

let n = 0;
const meta = () => ({ id: `R_r80_${++n}`, at: new Date(Date.UTC(2026, 9, 29, 1, n)).toISOString(), model: 'stub', prompt: 'm6-000000000000', hash: String(n).padStart(64, '9') });
const ask = (p, schema = M.MAP6_SCHEMA) => M.buildMapAsk(p, studioView(p), [], undefined, schema);
const piece = (inp, words, nth = 0) => inp.ask.records.flatMap(r => r.spans.filter(x => x.t.trimStart().startsWith(words)))[nth].s;
const reply = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const part = (ref, o = {}) => ({ ref, name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: [], ...o });
const apply = (p, inp, r) => M.applyReading(p, inp, M.validateMapReply(r, inp.ask), meta()).project;
const evidence = (p, id) => roleEvidence(id, M.partUnderstanding(p, id));
const text = (p, q) => p.pasted.find(r => r.id === q.record).text;

test('80-A a description with no claims opens its four passages in order, exactly; the fourth is no claim\'s quote', () => {
  const { project, eval: ev, limit } = build80(), u = M.partUnderstanding(project, ev), e = evidence(project, ev);
  assert.equal(u.claims.length, 0); assert.equal(e.count, 4);
  assert.deepEqual(e.items.map(x => x.quote.quote), ['def evaluate(self, code):\n        tree = Parser(code).parse()', 'unit = Compiler().compile(tree)', 'value = Machine(limits=self.limits).run(unit)', 'return self.to_host(value)']);
  for (const x of e.items) assert.equal(text(project, x.quote).slice(x.quote.from, x.quote.to), x.quote.quote);
  assert.equal(e.items[3].quote.from, RECORD80.indexOf('return self.to_host(value)'));
  const claimQuotes = new Set(project.space.areas.flatMap(a => M.partUnderstanding(project, a.id)?.claims.map(c => c.quote) ?? []));
  assert.ok(!claimQuotes.has(e.items[3].quote.quote), 'a current claim\'s quote cannot stand in for it');
  assert.equal(new Set(e.items.map(x => x.key)).size, 4); assert.ok(e.items[0].label.endsWith('…”') && e.items[3].label === '“return self.to_host(value)”');
  // One basis passage reads the same way (a count of 1); the requirement description keeps its basis, the narrower report its claim.
  const one = evidence(project, limit);
  assert.equal(one.count, 1); assert.equal(one.items[0].quote.quote, '요구: 실행 시간이 한도를 넘으면 평가를 멈춘다.');
  const c = M.partUnderstanding(project, limit).claims; assert.deepEqual(c.map(x => [x.kind, x.quote.startsWith('작업 보고:')]), [['reported', true]]);
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
});

test('80-B the same words at two places are two passages: both kept, the second exactly where it stands', () => {
  const t = '## 예문\n평가는 결과를 호스트 값으로 바꿔 돌려준다.\n\n## 설명\n평가는 결과를 호스트 값으로 바꿔 돌려준다.';
  const p = D.pasteRecord(D.createProject(), t, null).project, inp = ask(p);
  const out = apply(p, inp, reply({ parts: [part('new:eval', { name: '평가', role: '결과를 호스트 값으로 돌려준다.', basis: [piece(inp, '평가는', 1), piece(inp, '평가는', 0)] })] }));
  const e = evidence(out, out.space.areas[0].id);
  assert.equal(e.count, 2); assert.equal(e.items[0].quote.quote, e.items[1].quote.quote);
  assert.equal(e.items[0].quote.from, t.lastIndexOf('평가는')); assert.equal(e.items[1].quote.from, t.indexOf('평가는')); assert.notEqual(e.items[0].key, e.items[1].key);
});

test('80-C the person\'s correction shows no AI passage; a later description without its replacement keeps the first one\'s; an explicit one brings its own', () => {
  const { project: p0, eval: ev } = build80();
  const first = evidence(p0, ev).items.map(x => x.quote);
  // A later record describes the part differently, without saying it replaces the description: the current one and its basis stay.
  let p = D.pasteRecord(p0, '평가 경로 메모: 평가는 결과를 캐시에 담는다.', null).project;
  let inp = ask(p); const alias = [...inp.parts].find(([, x]) => x === ev)[0];
  const later = apply(p, inp, reply({ parts: [part(alias, { role: '결과를 캐시에 담는다.', basis: [piece(inp, '평가 경로 메모')] })] }));
  assert.equal(M.partUnderstanding(later, ev).role, '코드를 파싱·컴파일·실행한 뒤 결과를 호스트 값으로 돌려준다.');
  assert.deepEqual(evidence(later, ev).items.map(x => x.quote), first);
  // Explicit replacement (a later record says so): the new description, with its own basis only.
  const third = D.pasteRecord(later, '이제 평가 경로는 결과를 문자열로 돌려준다. 이전 방식은 제거했다.', null).project; inp = ask(third);
  const replaced = apply(third, inp, reply({ parts: [part(alias, { role: '결과를 문자열로 돌려준다.', roleReplaces: piece(inp, '이제 평가 경로는'), basis: [piece(inp, '이제 평가 경로는')] })] }));
  assert.deepEqual(evidence(replaced, ev).items.map(x => x.quote.quote), ['이제 평가 경로는 결과를 문자열로 돌려준다.']);
  // The person's correction: the corrected description has no AI passage attached to it.
  const corrected = D.correctReadingRole(replaced, ev, '평가 결과를 사람이 정한 형식으로 돌려준다.');
  assert.ok(M.partUnderstanding(corrected, ev).corrected); assert.equal(evidence(corrected, ev), null);
});

test('80-D an earlier reading\'s description keeps its quote without a made-up place; no description, no evidence', () => {
  const p = D.pasteRecord(D.createProject(), RECORD80, null).project, inp = M.buildMapAsk(p, studioView(p));
  const out = M.applyReading(p, inp, M.validateMapReply({ summary: '', parts: [{ ref: 'new:limit', name: '실행 한도', parent: null, role: '시간 한도를 넘으면 멈춘다.', roleAbout: null, roleReplaces: null,
    basis: [{ record: 'N01', quote: '요구: 실행 시간이 한도를 넘으면 평가를 멈춘다.' }], claims: [] }], relations: [], candidates: [], gaps: [] }, inp.ask), meta()).project;
  const e = evidence(out, out.space.areas[0].id);
  assert.equal(e.count, 1); assert.equal(e.items[0].quote.from, undefined, 'map-reading.1 stored no place; none is invented');
  assert.equal(roleEvidence('x', { role: null, corrected: null, roleBasis: [] }), null);
  assert.equal(roleEvidence('x', { role: '설명', corrected: null, roleBasis: [] }), null);
});
