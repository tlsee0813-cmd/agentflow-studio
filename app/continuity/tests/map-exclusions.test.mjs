// Model-free regressions for review-20261101 F1/F2 and durable diagnostics. No provider or browser is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as S from '../dist/public/shared/storage.js';
import { parseProject, parseBackup } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import { emptyBundle } from '../dist/public/client/plan-store.js';
import * as K from './condition116-case.mjs';

const meta = (id = 'R_exclusions') => ({ id, at: '2026-11-01T01:00:00.000Z', model: 'stub', prompt: 'm7-000000000001', hash: 'e'.repeat(64) });
function fixture(text = '실제 기능은 파일을 저장합니다.\n예제 조건: sample/demo\n다른 기능은 파일을 읽습니다.', schema = M.MAP7_SCHEMA) {
  let p = D.addArea(D.createProject(), '파일', '사람이 남긴 설명');
  p = D.pasteRecord(p, text, null).project;
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, schema), spans = inp.ask.records[0].spans;
  const claim = (at, key = 's1', extra = {}) => ({ kind: 'describes', text: '파일을 저장합니다.', at, ...(schema === M.MAP7_SCHEMA ? { aboutAt: null } : { about: null }), replaces: null, key, ...extra });
  const part = (ref = 'P01', extra = {}) => ({ ref, name: null, parent: null, role: null, ...(schema === M.MAP7_SCHEMA ? { roleAboutAt: null } : { roleAbout: null }), roleReplaces: null, basis: [], claims: [], ...extra });
  const reply = { summary: '파일 기능', parts: [part('P01', { claims: [claim(spans[0].s)] })], relations: [], candidates: [], gaps: [], matches: [], material: [{ at: spans[1].s, what: '예제 조건' }] };
  return { p, inp, spans, claim, part, reply };
}
const errors = reply => M.setAside(reply).map(e => [e.path, e.rule]);

test('F1 rejected claim rolls back a condition before material conflict checks', () => {
  const f = fixture(), baseline = M.validateMapReply(structuredClone(f.reply), f.inp.ask);
  f.reply.parts[0].claims.push(f.claim(f.spans[0].s, 's2', { aboutAt: f.spans[1].s, replaces: 'C99' }));
  const got = M.validateMapReply(f.reply, f.inp.ask);
  assert.deepEqual(got.material, baseline.material);
  assert.deepEqual(got.parts[0].claims.map(c => c.key), ['s1']);
  assert.deepEqual(errors(got), [['parts[0].claims[1].replaces', 'contract']]);
});

test('F1 a later rejected parent discards its successfully parsed role condition', () => {
  const f = fixture();
  f.reply.parts.push(f.part('new:lost', { name: '사라질 부분', parent: 'new:missing', role: '설명', basis: [f.spans[0].s], roleAboutAt: f.spans[1].s }));
  const got = M.validateMapReply(f.reply, f.inp.ask);
  assert.equal(got.material.length, 1);
  assert.deepEqual(got.parts.map(p => p.ref), ['P01']);
  assert.deepEqual(errors(got), [['parts[1].parent', 'contract']]);
});

test('F1 a later rejected candidate drops its condition and preserves original item paths', () => {
  const f = fixture(), candidate = key => ({ text: '성립 여부', target: 'holds', parts: ['P01'], at: null,
    statement: { key, kind: 'describes', text: '파일을 저장합니다.', at: f.spans[0].s, aboutAt: f.spans[1].s } });
  f.reply.candidates = [{ ...candidate('s2'), parts: ['P99'] }, candidate('s1')];
  const got = M.validateMapReply(f.reply, f.inp.ask);
  assert.equal(got.material.length, 1); assert.equal(got.candidates.length, 0);
  assert.deepEqual(errors(got), [['candidates[0].parts', 'reference'], ['candidates[1].statement.key', 'settled-and-open']]);
});

test('F1 a match failing after its condition is parsed leaves no ghost condition', () => {
  const mods = { D, M, C, S, studioView, emptyBundle }, c = K.conditionProject(mods), inp = M.buildMapAsk(c.project, studioView(c.project), [c.rq], c.rq.id, M.MAP7_SCHEMA);
  const reply = K.replyFor7(inp.ask, inp.records), a = K.aliases(inp.ask, inp.records);
  reply.matches.push({ ...reply.matches[0], aboutAt: K.piece(inp.ask, a.report, '조건: sample/demo'), replaces: 'M99' });
  const got = M.validateMapReply(reply, inp.ask);
  assert.equal(got.material.length, 1); assert.equal(got.matches.length, 4);
  assert.deepEqual(errors(got), [['matches[4].replaces', 'contract']]);
});

test('F2 a 1087-character citation with the sole supporting sentence last is excluded, never clipped', () => {
  const support = '실제 기능은 실패한 결제를 자동으로 재시도합니다.', background = '배경 설명은 기능 동작을 단정하지 않습니다.\n';
  const text = (background.repeat(60)).slice(0, 1087 - support.length - 1) + '\n' + support;
  assert.equal(text.length, 1087);
  for (const schema of [M.MAP6_SCHEMA, M.MAP7_SCHEMA]) {
    const f = fixture(text, schema), whole = `${f.spans[0].s}-${f.spans.at(-1).s.split('.')[1]}`;
    f.reply.material = []; f.reply.parts[0].claims.push(f.claim(whole, 's2', { text: '실패한 결제를 자동으로 재시도합니다.' }));
    const got = M.validateMapReply(f.reply, f.inp.ask);
    assert.deepEqual(got.parts[0].claims.map(c => c.key), ['s1']);
    assert.deepEqual(errors(got), [['parts[0].claims[1].at', 'length']]);
    const applied = M.applyReading(f.p, f.inp, got, meta()), x = applied.reading.exclusions[0];
    assert.equal(applied.reading.version, 'map-reading.6');
    assert.deepEqual([x.path, x.rule, x.category, x.record, x.from, x.to], ['parts[0].claims[1].at', 'length', null, f.p.pasted[0].id, 0, 1087]);
    assert.match(x.explanation, /600/);
    assert.ok(!JSON.stringify(x).includes(support));
    const reloaded = parseProject(S.serializeProject(applied.project));
    assert.deepEqual(reloaded.readings.at(-1).exclusions, applied.reading.exclusions);
    assert.deepEqual(parseBackup(S.serializeBackup(reloaded, null)).project, reloaded);
    assert.deepEqual(reloaded.space.areas, f.p.space.areas, 'existing areas and the person\'s own description survive');
  }
});

test('diagnostics contain no rejected secret target and require valid locations on import', () => {
  const f = fixture(), secret = `sk-${'A'.repeat(25)}`;
  f.reply.parts[0].claims.push(f.claim(f.spans[0].s, secret));
  const applied = M.applyReading(f.p, f.inp, M.validateMapReply(f.reply, f.inp.ask), meta());
  const raw = S.serializeProject(applied.project); assert.ok(!raw.includes(secret));
  assert.equal(applied.reading.exclusions[0].rule, 'reference');
  for (const mutate of [x => { x.to = 99999; }, x => { delete x.explanation; }, x => { x.record = null; }, x => { x.path = 'raw.secret'; }]) {
    const bad = JSON.parse(raw); mutate(bad.readings.at(-1).exclusions[0]); assert.throws(() => parseProject(JSON.stringify(bad)));
  }
});

test('map.6 excludes descendants of an overlong-basis parent with their original paths, rather than consuming them silently', () => {
  const text = '실제 기능은 파일을 저장합니다.\n' + '배경 설명은 기능 동작을 단정하지 않습니다.\n'.repeat(44), f = fixture(text, M.MAP6_SCHEMA);
  const whole = `${f.spans[0].s}-${f.spans.at(-1).s.split('.')[1]}`;
  assert.ok(text.length > 600);
  f.reply.material = [];
  f.reply.parts.push(f.part('new:lost', { name: 'lostparent', basis: [whole] }),
    f.part('new:child', { name: 'validchild', parent: 'new:lost', basis: [f.spans[0].s] }),
    f.part('new:grandchild', { name: 'validgrandchild', parent: 'new:child', basis: [f.spans[0].s] }));
  f.reply.relations.push({ from: 'new:child', to: 'P01', kind: 'related', note: '', at: f.spans[0].s });
  f.reply.candidates.push({ text: '같은 부분인지 미정', target: 'identity', parts: ['new:lost', 'P01'], at: null, statement: null });
  const got = M.validateMapReply(f.reply, f.inp.ask);
  assert.deepEqual(got.parts.map(p => p.ref), ['P01']);
  assert.deepEqual(errors(got), [['parts[1].basis[0]', 'length'], ['parts[2].parent', 'contract'], ['parts[3].parent', 'contract'],
    ['relations[0]', 'contract'], ['candidates[0].parts', 'contract']]);
  const applied = M.applyReading(f.p, f.inp, got, meta()), saved = parseProject(S.serializeProject(applied.project));
  assert.deepEqual(applied.created, []); assert.deepEqual(saved.space.areas, f.p.space.areas);
  assert.deepEqual(saved.readings.at(-1).exclusions.map(x => x.path), errors(got).map(x => x[0]));
  assert.equal(saved.readings.at(-1).exclusions[1].record, f.p.pasted[0].id);
  assert.deepEqual(saved.readings.at(-1).exclusions.slice(3).map(x => x.category), ['parent-skipped', 'parent-skipped']);
});

test('map.6 still places a valid child before its surviving parent and refuses unknown parents or cycles', () => {
  const f = fixture(undefined, M.MAP6_SCHEMA), at = f.spans[0].s; f.reply.material = [];
  f.reply.parts.push(f.part('new:child', { name: 'child', parent: 'new:parent', basis: [at] }), f.part('new:parent', { name: 'parent', basis: [at] }));
  const applied = M.applyReading(f.p, f.inp, M.validateMapReply(f.reply, f.inp.ask), meta());
  const parent = applied.project.space.areas.find(a => a.name === 'parent'), child = applied.project.space.areas.find(a => a.name === 'child');
  assert.equal(applied.created.length, 2); assert.equal(applied.project.space.containment.parents[child.id], parent.id);
  assert.deepEqual(applied.reading.exclusions, []);
  const unknown = structuredClone(f.reply); unknown.parts[1].parent = 'new:missing'; assert.throws(() => M.validateMapReply(unknown, f.inp.ask));
  const cycle = structuredClone(f.reply); cycle.parts[2].parent = 'new:child'; assert.throws(() => M.validateMapReply(cycle, f.inp.ask));
});

test('map-reading.4 and .5 import/export keep their exact prior shape', () => {
  const f = fixture(), applied = M.applyReading(f.p, f.inp, M.validateMapReply(f.reply, f.inp.ask), meta());
  for (const version of ['map-reading.4', 'map-reading.5']) {
    const old = JSON.parse(S.serializeProject(applied.project)), r = old.readings.at(-1);
    r.version = version; delete r.exclusions;
    assert.deepEqual(parseProject(JSON.stringify(old)), old);
    assert.deepEqual(parseBackup(S.serializeBackup(old, null)).project, old);
    assert.ok(!Object.hasOwn(parseProject(JSON.stringify(old)).readings.at(-1), 'exclusions'));
  }
});

test('reload history keeps older exclusions after another reading and opens the exact stored source range', async () => {
  const f = fixture();
  f.reply.parts[0].claims.push(f.claim(f.spans[0].s, 's2', { replaces: 'C99' }));
  let p = M.applyReading(f.p, f.inp, M.validateMapReply(f.reply, f.inp.ask), meta()).project;
  p = D.pasteRecord(p, '새 기록은 파일 이름을 표시한다고 설명합니다.', null).project;
  const later = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA), at = later.ask.records[0].spans[0].s;
  const wire = { ...f.reply, parts: [f.part('P01', { claims: [f.claim(at)] })], material: [] };
  p = M.applyReading(p, later, M.validateMapReply(wire, later.ask), { ...meta('R_after_exclusion'), hash: 'd'.repeat(64) }).project;
  const reloaded = parseBackup(S.serializeBackup(p, null)).project, last = reloaded.readings.at(-1);
  assert.deepEqual(last.exclusions, []);
  const { mapExclusionHistory } = await import('../dist/public/client/return-view.js');
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.events = {}; }
    setAttribute(k, v) { this.attrs[k] = v; }
    addEventListener(k, v) { this.events[k] = v; }
    append(c) { this.children.push(c); }
    get textContent() { return this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); }
  }
  const oldDocument = globalThis.document, calls = [];
  try {
    globalThis.document = { createElement: tag => new Element(tag) };
    const history = mapExclusionHistory(reloaded, (...args) => calls.push(args));
    assert.ok(history.textContent.includes('parts[0].claims[1].replaces'));
    assert.ok(history.textContent.includes('contract / replaces'));
    assert.ok(history.textContent.includes('자동으로 다시 읽히지는'));
    const flatten = el => [el, ...el.children.filter(c => c instanceof Element).flatMap(flatten)];
    const buttons = flatten(history).filter(el => el.tag === 'button'); assert.equal(buttons.length, 1); buttons[0].events.click();
    const x = reloaded.readings[0].exclusions[0];
    assert.deepEqual(calls, [[x.record, f.p.pasted[0].text.slice(x.from, x.to), x.from]]);
    const missing = { ...reloaded, pasted: [] }, missingHistory = mapExclusionHistory(missing, () => assert.fail('missing source must not open'));
    assert.equal(flatten(missingHistory).filter(el => el.tag === 'button').length, 0);
  } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; }
});
