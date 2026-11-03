// Model-free regressions for review-20261101 F1/F2 and durable diagnostics. No provider or browser is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as S from '../dist/public/shared/storage.js';
import { parseProject, parseBackup, validateProject } from '../dist/public/shared/validation.js';
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
/** A stored map-reading.9 entry in the exact shape of .8: the .9 keys of the reading and its parts removed. */
function stripNine(r) {
  delete r.portMap;
  for (const p of r.parts) for (const k of ['steps', 'loop', 'stateVars']) delete p[k];
  return r;
}
/** A stored map-reading.9 entry in the exact shape of .7: the .9 and .8 keys of the reading, its parts and its relations removed. */
function stripEight(r) {
  stripNine(r);
  for (const k of ['basisAt', 'basisVersion']) delete r[k];
  for (const p of r.parts) for (const k of ['type', 'typeQuote', 'inputs', 'outputs', 'fields', 'config']) delete p[k];
  for (const x of r.relations) delete x.channel;
  return r;
}
/** A stored map-reading.8 entry in the exact shape of .6 and earlier: the .7 and .8 keys of its claims, parts and relations removed. */
function stripSeven(r) {
  stripEight(r);
  for (const p of r.parts) { for (const k of ['state', 'stateWhen', 'stateQuote', 'files']) delete p[k]; for (const c of p.claims) for (const k of ['topic', 'evidence', 'when', 'where', 'before']) delete c[k]; }
  for (const x of r.relations) for (const k of ['payload', 'cadence', 'mode']) delete x[k];
  return r;
}

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
    assert.equal(applied.reading.version, 'map-reading.9');
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
    r.version = version; delete r.exclusions; stripSeven(r);
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

// ---- first-map-divided.6: the setAside option is opt-in, map.6 only; plain map.6 (browser, single-call Worker) is unchanged ----
function firstMap() {
  const p = D.pasteRecord(D.createProject(), '실제 기능은 파일을 저장합니다.\n예제 조건: sample/demo\n다른 기능은 파일을 읽습니다.', null).project;
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), at = inp.ask.records[0].spans.map(s => s.s);
  assert.ok(M.firstAsk(inp.ask));
  const claim = (key, a, extra = {}) => ({ kind: 'describes', text: '파일을 저장합니다.', at: a, about: null, replaces: null, key, ...extra });
  const reply = { summary: '파일 기능', relations: [], candidates: [], gaps: [], matches: [], material: [], parts: [{ ref: 'new:save', name: '저장', parent: null,
    role: '파일 저장', roleAbout: null, roleReplaces: null, basis: [at[0]], claims: [claim('s1', at[0]), claim('s2', 'N01.99')] }] };
  return { p, inp, ask: inp.ask, at, claim, reply };
}

test('divided set-aside: plain map.6 still refuses one bad claim whole; the option sets only that claim aside', () => {
  const f = firstMap();
  assert.throws(() => M.validateMapReply(structuredClone(f.reply), f.ask), e => e instanceof M.MapReplyError && e.path === 'parts[0].claims[1].at' && e.rule === 'reference');
  const got = M.validateMapReply(structuredClone(f.reply), f.ask, { setAside: true });
  assert.deepEqual(got.parts[0].claims.map(c => c.key), ['s1']);
  assert.deepEqual(errors(got), [['parts[0].claims[1].at', 'reference']]);
  // A count overflow is refused whole by plain map.6 (a plain INVALID_RESPONSE, as before) and read in part with the option.
  // .24: the first map's contract takes six claims per part; .32: sixteen (MAP6_CLAIMS), the seventeenth is over the count.
  assert.equal(M.MAP6_CLAIMS, 16);
  const sixteen = structuredClone(f.reply); sixteen.parts[0].claims = Array.from({ length: 16 }, (_, i) => f.claim(`s${i + 1}`, f.at[0]));
  assert.equal(M.validateMapReply(sixteen, f.ask).parts[0].claims.length, 16, 'plain map.6 reads sixteen claims of a part');
  // Stored as map-reading.9 with all sixteen (the project validator takes sixteen there; earlier entries keep eight).
  const kept = M.applyReading(f.p, f.inp, M.validateMapReply(structuredClone(sixteen), f.ask), meta('R_sixteen'));
  assert.deepEqual(validateProject(kept.project), kept.project);
  assert.equal(kept.project.readings.at(-1).parts[0].claims.length, 16);
  const many = structuredClone(f.reply); many.parts[0].claims = Array.from({ length: 17 }, (_, i) => f.claim(`s${i + 1}`, f.at[0]));
  assert.throws(() => M.validateMapReply(structuredClone(many), f.ask), e => !(e instanceof M.MapReplyError) && e.message === 'INVALID_RESPONSE');
  assert.deepEqual(M.validateMapReply(many, f.ask, { setAside: true }).parts[0].claims.length, 16);
  // map.7 ignores the option (it has its own soft policy); an earlier schema ignores it too.
  const later = fixture(), seven = M.validateMapReply(structuredClone(later.reply), later.inp.ask), opted = M.validateMapReply(structuredClone(later.reply), later.inp.ask, { setAside: true });
  assert.deepEqual(opted, seven); assert.deepEqual(M.readingExclusions(opted), M.readingExclusions(seven));
});

test('divided set-aside still refuses whole: an empty part, a part without basis, contradictions, secret-like text, nothing left', () => {
  const f = firstMap(), soft = v => M.validateMapReply(v, f.ask, { setAside: true });
  const cases = [
    r => { r.parts[0].claims = [f.claim('s1', 'N01.99')]; },
    r => { r.parts[0].basis = ['N01.99']; },
    r => { r.parts[0].claims[1] = f.claim('s1', f.at[2]); },
    r => { r.candidates = [{ target: 'holds', text: '미정', parts: ['new:save'], at: null, statement: { key: 's1', kind: 'idea', text: '미정 진술', at: f.at[2], about: null } }]; },
    r => { r.parts[0].role = 'sk-' + 'a'.repeat(40); },
    r => { r.parts[0].ref = 'P99'; },
    r => { delete r.summary; },
  ];
  for (const mutate of cases) { const r = structuredClone(f.reply); mutate(r); assert.throws(() => soft(r)); }
});

test('attachExclusions takes only checked fixed reasons for a first map.6 and keeps them through applyReading and reload', () => {
  const f = firstMap(), soft = M.validateMapReply(structuredClone(f.reply), f.ask, { setAside: true }), reasons = structuredClone(M.readingExclusions(soft));
  const clean = structuredClone(f.reply); clean.parts[0].claims.splice(1, 1);
  const reply = M.validateMapReply(clean, f.ask); assert.equal(M.readingExclusions(reply).length, 0);
  M.attachExclusions(reply, reasons, f.ask);
  const applied = M.applyReading(f.p, f.inp, reply, meta('R_divided-attach'));
  assert.deepEqual(applied.reading.exclusions, reasons);
  assert.deepEqual(parseProject(S.serializeProject(applied.project)).readings.at(-1).exclusions, reasons);
  const located = { path: 'material[0]', rule: 'material-evidence', category: null, explanation: '채택한 근거와 겹치는 예제·자료 표시를 제외했어요.', record: 'N01', from: 0, to: 5 };
  for (const bad of [
    [{ ...reasons[0], explanation: '다른 설명 sk-secret' }], [{ ...reasons[0], path: 'summary' }], [{ ...reasons[0], rule: 'unknown' }],
    [{ ...reasons[0], category: 'count' }], [{ ...reasons[0], extra: 1 }], [{ ...located, record: 'N09' }], [{ ...located, to: 10000 }],
    [{ ...located, from: 5, to: 5 }], [{ ...located, from: null }], Array(M.DIVIDED_EXCLUSIONS_MAX + 1).fill(reasons[0]), {}, null,
  ]) assert.throws(() => M.attachExclusions(M.validateMapReply(clean, f.ask), bad, f.ask));
  M.attachExclusions(M.validateMapReply(clean, f.ask), [located], f.ask);
  const later = fixture();
  assert.throws(() => M.attachExclusions(M.validateMapReply(structuredClone(later.reply), later.inp.ask), reasons, later.inp.ask), 'never for map.7');
});

// ---- map-reading.7 (first-map-divided.25): a claim's topic, tag, time, place and the decision before; a part's own state word
// with its line and its files; a relation's payload, cadence and mode. Optional on the wire, exact in storage. ----
function sevenReply(f) {
  const r = structuredClone(f.reply);
  r.parts[0].claims = [f.claim('s1', f.at[0], { topic: 'withdrawn', evidence: 'file', when: ' 11-02 23:04Z ', where: 'server/engine.mjs', before: '옛 결정 원문' }),
    f.claim('s2', f.at[0], { text: '지금 저장합니다.', topic: 'status', evidence: null, when: null })];
  Object.assign(r.parts[0], { state: 'running', stateAt: f.at[0], stateWhen: '11-02 22:10Z', files: ['server/engine.mjs', ' server/engine.mjs ', 'public/'] });
  r.parts.push({ ref: 'new:read', name: '읽기', parent: null, role: '파일 읽기', roleAbout: null, roleReplaces: null, basis: [f.at[2]], claims: [f.claim('s3', f.at[2], { text: '파일을 읽습니다.' })] });
  r.relations = [{ from: 'new:save', to: 'new:read', kind: 'flow', note: '', at: f.at[0], payload: '저장 파일', cadence: '매 저장마다', mode: 'design' }];
  return r;
}
const sevenOf = c => [c.topic, c.evidence, c.when, c.where, c.before];

test('map-reading.7: a map.6 reply with every new field is read, applied, stored (as map-reading.9) and read back', () => {
  const f = firstMap(), got = M.validateMapReply(sevenReply(f), f.ask);
  assert.equal(M.setAside(got).length, 0);
  assert.deepEqual(got.parts[0].claims.map(sevenOf), [['withdrawn', 'file', '11-02 23:04Z', 'server/engine.mjs', '옛 결정 원문'], ['status', null, null, null, null]]);
  assert.deepEqual([got.parts[0].state, got.parts[0].stateWhen, got.parts[0].files], ['running', '11-02 22:10Z', ['server/engine.mjs', 'public/']]);
  const applied = M.applyReading(f.p, f.inp, got, meta('R_seven_full'));
  assert.equal(applied.reading.version, 'map-reading.9');
  const [save, read] = applied.reading.parts, claim = save.claims[0];
  assert.deepEqual(save.stateQuote, { record: claim.record, quote: claim.quote, from: claim.from, to: claim.to }, 'anchored where it stands, like a claim');
  assert.deepEqual([save.state, save.stateWhen, save.files], ['running', '11-02 22:10Z', ['server/engine.mjs', 'public/']]);
  assert.deepEqual([read.state, read.stateWhen, read.stateQuote, read.files], [null, null, null, []]);
  assert.deepEqual(save.claims.map(sevenOf), [['withdrawn', 'file', '11-02 23:04Z', 'server/engine.mjs', '옛 결정 원문'], ['status', null, null, null, null]]);
  assert.deepEqual(read.claims.map(sevenOf), [[null, null, null, null, null]]);
  assert.deepEqual(applied.reading.relations.map(x => [x.payload, x.cadence, x.mode]), [['저장 파일', '매 저장마다', 'design']]);
  const u = M.partUnderstanding(applied.project, save.areaId);
  assert.deepEqual(u.stateRead, { state: 'running', when: '11-02 22:10Z', quote: save.stateQuote, at: meta().at });
  assert.deepEqual(u.files, ['server/engine.mjs', 'public/']);
  assert.equal(M.partUnderstanding(applied.project, read.areaId).stateRead, null);
  assert.deepEqual(validateProject(applied.project), applied.project);
  assert.deepEqual(parseProject(S.serializeProject(applied.project)).readings.at(-1), applied.reading);
});

test('map-reading.7: a line both designed and observed is one map line read twice', () => {
  const f = firstMap(), r = sevenReply(f);
  r.relations.push({ ...r.relations[0], at: f.at[2], payload: null, cadence: null, mode: 'observed' });
  const applied = M.applyReading(f.p, f.inp, M.validateMapReply(r, f.ask), meta('R_seven_twice'));
  assert.equal(applied.project.space.relations.length, 1);
  assert.deepEqual(applied.reading.relations.map(x => [x.relationId, x.mode]), [[applied.project.space.relations[0].id, 'design'], [applied.project.space.relations[0].id, 'observed']]);
  assert.deepEqual(applied.reading.skipped, []);
  assert.deepEqual(validateProject(applied.project), applied.project);
});

test('map-reading.7 lenient: a wrong field sets aside its claim or relation, and only the state or files of a part', () => {
  const f = firstMap(), r = sevenReply(f);
  r.parts[0].claims[1].topic = 'nope';
  r.parts[0].claims.push(f.claim('s4', f.at[0], { text: '세 번째 주장', topic: 'status', before: '옛것' }));
  delete r.parts[0].stateAt;
  r.parts[0].files = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  r.relations[0].mode = 'x';
  const got = M.validateMapReply(structuredClone(r), f.ask, { setAside: true });
  assert.deepEqual(got.parts.map(p => p.ref), ['new:save', 'new:read'], 'no part is set aside');
  assert.deepEqual(got.parts[0].claims.map(c => c.key), ['s1']);
  assert.deepEqual([got.parts[0].state, got.parts[0].stateQuote, got.parts[0].stateWhen, got.parts[0].files], [null, null, null, []]);
  assert.deepEqual(got.relations, []);
  const reasons = M.readingExclusions(got);
  assert.deepEqual(reasons.map(e => [e.path, e.rule, e.category]), [['parts[0].claims[1].topic', 'contract', 'topic'], ['parts[0].claims[2].before', 'contract', 'before'],
    ['parts[0].stateAt', 'contract', 'state-at'], ['parts[0].files', 'contract', 'files'], ['relations[0].mode', 'contract', 'mode']]);
  assert.match(reasons[2].explanation, /그 칸만/); assert.match(reasons[0].explanation, /제외했어요/);
  const applied = M.applyReading(f.p, f.inp, got, meta('R_seven_lenient'));
  assert.deepEqual(applied.reading.exclusions.map(e => e.path), reasons.map(e => e.path));
  assert.deepEqual(parseProject(S.serializeProject(applied.project)).readings.at(-1), applied.reading);
  // map.7 reads the same way (its parts are soft, yet a bad state still leaves the part and only that field out).
  const g = fixture();
  g.reply.parts[0].claims.push(g.claim(g.spans[2].s, 's2', { topic: 'nope' }));
  Object.assign(g.reply.parts[0], { state: 'gone', stateAt: g.spans[0].s, stateWhen: '11-02', files: ['x/'] });
  const seven = M.validateMapReply(g.reply, g.inp.ask);
  assert.deepEqual(seven.parts[0].claims.map(c => c.key), ['s1']);
  assert.deepEqual([seven.parts[0].state, seven.parts[0].stateWhen, seven.parts[0].files], [null, null, ['x/']]);
  assert.deepEqual(errors(seven), [['parts[0].claims[1].topic', 'contract'], ['parts[0].state', 'contract']]);
  assert.equal(M.applyReading(g.p, g.inp, seven, meta('R_seven_map7')).reading.version, 'map-reading.9');
});

test('map-reading.7 strict: plain map.6 refuses a reply with any wrong new field', () => {
  const f = firstMap();
  for (const mutate of [
    r => { r.parts[0].claims[1].topic = 'nope'; }, r => { r.parts[0].claims[1].evidence = 'paper'; }, r => { r.parts[0].claims[1].before = '옛것'; },
    r => { r.parts[0].claims[1].when = '가'.repeat(41); }, r => { r.parts[0].claims[1].where = '가'.repeat(121); }, r => { r.parts[0].claims[0].before = '  '; },
    r => { delete r.parts[0].stateAt; }, r => { r.parts[0].state = 'built'; }, r => { r.parts[0].stateAt = 'N01.99'; }, r => { r.parts[0].stateWhen = '가'.repeat(41); },
    r => { r.parts[1].stateWhen = '11-02'; }, r => { r.parts[1].stateAt = f.at[2]; },
    r => { r.parts[0].files = Array(7).fill('a'); }, r => { r.parts[0].files = ['가'.repeat(121)]; }, r => { r.parts[0].files = 'a'; }, r => { r.parts[0].files = ['a\u0001'] },
    r => { r.relations[0].mode = 'x'; }, r => { r.relations[0].payload = ''; }, r => { r.relations[0].cadence = '가'.repeat(41); },
    r => { r.relations[0].payload = `sk-${'A'.repeat(25)}`; },
  ]) {
    const r = sevenReply(f); mutate(r);
    assert.throws(() => M.validateMapReply(r, f.ask), undefined, String(mutate));
  }
});

test('map-reading.7: a reply without any new field still validates and stores every key as not said', () => {
  const f = firstMap(), r = structuredClone(f.reply); r.parts[0].claims.splice(1, 1);
  r.parts.push({ ref: 'new:read', name: '읽기', parent: null, role: '파일 읽기', roleAbout: null, roleReplaces: null, basis: [f.at[2]], claims: [f.claim('s3', f.at[2])] });
  r.relations = [{ from: 'new:save', to: 'new:read', kind: 'flow', note: '', at: f.at[0] }];
  const applied = M.applyReading(f.p, f.inp, M.validateMapReply(r, f.ask), meta('R_seven_plain'));
  assert.equal(applied.reading.version, 'map-reading.9');
  for (const p of applied.reading.parts) {
    assert.deepEqual([p.state, p.stateWhen, p.stateQuote, p.files], [null, null, null, []]);
    for (const c of p.claims) assert.deepEqual(sevenOf(c), [null, null, null, null, null]);
  }
  assert.deepEqual(applied.reading.relations.map(x => [x.payload, x.cadence, x.mode]), [[null, null, null]]);
  assert.equal(M.partUnderstanding(applied.project, applied.reading.parts[0].areaId).stateRead, null);
  assert.deepEqual(validateProject(applied.project), applied.project);
});

test('map-reading.7 storage is exact: unknown values, a missing key, and a .7 key on an earlier reading are refused', () => {
  const f = firstMap(), applied = M.applyReading(f.p, f.inp, M.validateMapReply(sevenReply(f), f.ask), meta('R_seven_store'));
  const raw = S.serializeProject(applied.project);
  for (const mutate of [
    r => { r.parts[0].claims[0].topic = 'nope'; }, r => { r.parts[0].claims[0].evidence = 'paper'; }, r => { r.parts[0].claims[1].before = '옛것'; },
    r => { r.parts[0].claims[0].when = '가'.repeat(41); }, r => { delete r.parts[0].claims[0].where; }, r => { r.parts[0].state = 'built'; },
    r => { r.parts[0].stateQuote = null; }, r => { r.parts[1].stateWhen = '11-02'; }, r => { r.parts[0].files = ['a', 'a']; }, r => { r.parts[0].files = Array(7).fill(0).map((_, i) => `f${i}`); },
    r => { delete r.parts[1].files; }, r => { r.relations[0].mode = 'x'; }, r => { r.relations[0].payload = '가'.repeat(81); }, r => { delete r.relations[0].cadence; },
    r => { r.parts[0].stateQuote = { ...r.parts[0].stateQuote, quote: 'x' }; },
    r => { r.version = 'map-reading.6'; },
    r => { r.version = 'map-reading.6'; stripSeven(r); r.parts[0].claims[0].topic = 'status'; },
  ]) {
    const bad = JSON.parse(raw); mutate(bad.readings.at(-1));
    assert.throws(() => parseProject(JSON.stringify(bad)), undefined, String(mutate));
    assert.throws(() => validateProject(bad), undefined, String(mutate));
  }
  const old = JSON.parse(raw); old.readings.at(-1).version = 'map-reading.6'; stripSeven(old.readings.at(-1));
  assert.deepEqual(validateProject(old), old, 'an earlier reading keeps its exact old shape');
});

// ---- map-reading.8 (first-map-divided.28): a part's type word with its line, what it receives and hands over, its row fields
// and settings; a relation's channel; the reply's basis time and target version. Optional on the wire, exact in storage. ----
function eightReply(f) {
  const r = sevenReply(f);
  Object.assign(r.parts[0], { type: 'store', typeAt: f.at[0], inputs: [' review 행 ', 'policy 행', 'review 행'], outputs: ['e=1 행'], fields: ['watch', 'allowed_side'], config: ['24 h 만료'] });
  r.relations[0].channel = 'data';
  r.basisAt = ' 2026-11-03T09:01:03Z '; r.basisVersion = '라이브 618df374';
  return r;
}
const eightOf = p => [p.type, p.inputs, p.outputs, p.fields, p.config];

test('map-reading.8: a map.6 reply with every new field is read, applied, stored (as map-reading.9) and read back', () => {
  const f = firstMap(), got = M.validateMapReply(eightReply(f), f.ask);
  assert.equal(M.setAside(got).length, 0);
  assert.deepEqual(eightOf(got.parts[0]), ['store', ['review 행', 'policy 행'], ['e=1 행'], ['watch', 'allowed_side'], ['24 h 만료']]);
  assert.deepEqual(eightOf(got.parts[1]), [null, [], [], [], []]);
  assert.deepEqual([got.relations[0].channel, got.basisAt, got.basisVersion], ['data', '2026-11-03T09:01:03Z', '라이브 618df374']);
  const applied = M.applyReading(f.p, f.inp, got, meta('R_eight_full'));
  assert.equal(applied.reading.version, 'map-reading.9');
  const [save, read] = applied.reading.parts, claim = save.claims[0];
  assert.deepEqual(save.typeQuote, { record: claim.record, quote: claim.quote, from: claim.from, to: claim.to }, 'anchored where it stands, like a state');
  assert.deepEqual(eightOf(save), ['store', ['review 행', 'policy 행'], ['e=1 행'], ['watch', 'allowed_side'], ['24 h 만료']]);
  assert.deepEqual([read.type, read.typeQuote, ...eightOf(read).slice(1)], [null, null, [], [], [], []]);
  assert.deepEqual(applied.reading.relations.map(x => x.channel), ['data']);
  assert.deepEqual([applied.reading.basisAt, applied.reading.basisVersion], ['2026-11-03T09:01:03Z', '라이브 618df374']);
  const u = M.partUnderstanding(applied.project, save.areaId);
  assert.deepEqual(u.typeRead, { type: 'store', quote: save.typeQuote, at: meta().at });
  assert.deepEqual([u.inputs, u.outputs, u.fields, u.config], [['review 행', 'policy 행'], ['e=1 행'], ['watch', 'allowed_side'], ['24 h 만료']]);
  assert.equal(M.partUnderstanding(applied.project, read.areaId).typeRead, null);
  assert.deepEqual(validateProject(applied.project), applied.project);
  assert.deepEqual(parseProject(S.serializeProject(applied.project)).readings.at(-1), applied.reading);
});

test('map-reading.8 lenient: a wrong field leaves out only that field of its part, sets aside its relation, or nulls the basis', () => {
  const f = firstMap(), r = eightReply(f);
  r.parts[0].type = 'engine';
  r.parts[0].inputs = Array(9).fill('a');
  r.parts[0].config = ['가'.repeat(81)];
  r.parts[1].typeAt = f.at[2];
  r.relations[0].channel = 'wire';
  r.basisAt = '가'.repeat(61); r.basisVersion = ' ';
  const got = M.validateMapReply(structuredClone(r), f.ask, { setAside: true });
  assert.deepEqual(got.parts.map(p => p.ref), ['new:save', 'new:read'], 'no part is set aside');
  assert.deepEqual(eightOf(got.parts[0]), [null, [], ['e=1 행'], ['watch', 'allowed_side'], []]);
  assert.equal(got.parts[0].typeQuote, null);
  assert.deepEqual(got.relations, []);
  assert.deepEqual([got.basisAt, got.basisVersion], [null, null]);
  const reasons = M.readingExclusions(got);
  assert.deepEqual(reasons.map(e => [e.path, e.rule, e.category]), [['parts[0].type', 'contract', 'type'], ['parts[0].inputs', 'contract', 'inputs'], ['parts[0].config[0]', 'contract', 'config'],
    ['parts[1].typeAt', 'contract', 'type-at'], ['relations[0].channel', 'contract', 'channel'], ['basisAt', 'contract', 'basis-at'], ['basisVersion', 'contract', 'basis-version']]);
  assert.match(reasons[0].explanation, /그 칸만/); assert.match(reasons[2].explanation, /항목 하나만/); assert.match(reasons[5].explanation, /기준 시각/);
  const applied = M.applyReading(f.p, f.inp, got, meta('R_eight_lenient'));
  assert.deepEqual(applied.reading.exclusions.map(e => e.path), reasons.map(e => e.path));
  assert.deepEqual([applied.reading.basisAt, applied.reading.basisVersion], [null, null]);
  assert.deepEqual(parseProject(S.serializeProject(applied.project)).readings.at(-1), applied.reading);
  // map.7 reads the same way.
  const g = fixture();
  Object.assign(g.reply.parts[0], { type: 'nope', typeAt: g.spans[0].s, outputs: ['x'] });
  g.reply.basisVersion = 'v2';
  const seven = M.validateMapReply(g.reply, g.inp.ask);
  assert.deepEqual([seven.parts[0].type, seven.parts[0].outputs, seven.basisVersion], [null, ['x'], 'v2']);
  assert.deepEqual(errors(seven), [['parts[0].type', 'contract']]);
});

test('map-reading.8 strict: plain map.6 refuses a reply with any wrong new field', () => {
  const f = firstMap();
  for (const mutate of [
    r => { r.parts[0].type = 'engine'; }, r => { delete r.parts[0].typeAt; }, r => { r.parts[0].typeAt = 'N01.99'; }, r => { r.parts[1].typeAt = f.at[2]; },
    r => { r.parts[0].inputs = Array(9).fill(0).map((_, i) => `i${i}`); }, r => { r.parts[0].outputs = ['가'.repeat(61)]; }, r => { r.parts[0].fields = 'watch'; }, r => { r.parts[0].config = ['']; }, r => { r.parts[0].fields = Array(25).fill(0).map((_, i) => `f${i}`); }, r => { r.parts[0].config = Array(9).fill(0).map((_, i) => `c ${i}`); },
    r => { r.relations[0].channel = 'wire'; }, r => { r.basisAt = '가'.repeat(61); }, r => { r.basisVersion = ''; }, r => { r.basisVersion = `sk-${'A'.repeat(25)}`; },
  ]) {
    const r = eightReply(f); mutate(r);
    assert.throws(() => M.validateMapReply(r, f.ask), undefined, String(mutate));
  }
});

test('map-reading.8: a reply without any new field stores every key as not said', () => {
  const f = firstMap(), r = structuredClone(f.reply); r.parts[0].claims.splice(1, 1);
  const applied = M.applyReading(f.p, f.inp, M.validateMapReply(r, f.ask), meta('R_eight_plain'));
  assert.equal(applied.reading.version, 'map-reading.9');
  assert.deepEqual([applied.reading.basisAt, applied.reading.basisVersion], [null, null]);
  for (const p of applied.reading.parts) assert.deepEqual([p.type, p.typeQuote, ...eightOf(p).slice(1)], [null, null, [], [], [], []]);
  const u = M.partUnderstanding(applied.project, applied.reading.parts[0].areaId);
  assert.deepEqual([u.typeRead, u.inputs, u.outputs, u.fields, u.config], [null, [], [], [], []]);
  assert.deepEqual(validateProject(applied.project), applied.project);
});

test('map-reading.8 storage is exact: unknown values, a missing key, and an .8 key on an earlier reading are refused', () => {
  const f = firstMap(), applied = M.applyReading(f.p, f.inp, M.validateMapReply(eightReply(f), f.ask), meta('R_eight_store'));
  const raw = S.serializeProject(applied.project);
  for (const mutate of [
    r => { r.parts[0].type = 'engine'; }, r => { r.parts[0].typeQuote = null; }, r => { r.parts[1].typeQuote = r.parts[0].typeQuote; }, r => { delete r.parts[0].inputs; }, r => { r.parts[0].inputs = ['a', 'a']; },
    r => { r.parts[0].fields = Array(25).fill(0).map((_, i) => `f${i}`); }, r => { r.parts[0].config = ['가'.repeat(81)]; }, r => { r.relations[0].channel = 'wire'; }, r => { delete r.relations[0].channel; },
    r => { r.basisAt = '가'.repeat(61); }, r => { delete r.basisVersion; }, r => { r.version = 'map-reading.7'; },
    r => { r.version = 'map-reading.7'; stripEight(r); r.parts[0].inputs = []; },
  ]) {
    const bad = JSON.parse(raw); mutate(bad.readings.at(-1));
    assert.throws(() => parseProject(JSON.stringify(bad)), undefined, String(mutate));
    assert.throws(() => validateProject(bad), undefined, String(mutate));
  }
  const old = JSON.parse(raw); old.readings.at(-1).version = 'map-reading.7'; stripEight(old.readings.at(-1));
  assert.deepEqual(validateProject(old), old, 'a map-reading.7 entry keeps its exact shape');
});

// ---- first-map-divided.29: the first map's contract takes 24 new parts; a version is never a setting; the divided reading's
// own checks of a quoted line (via-store, wrong-part, sender) explain themselves in the reading's saved reasons. ----
test('.29: plain map.6 reads (.31) 36 new parts (map.7 still sets aside the thirteenth) and refuses a version in config; the lenient readings blank that config alone', () => {
  const f = firstMap(), r = structuredClone(f.reply); r.parts[0].claims.splice(1, 1);
  const fresh = i => ({ ...structuredClone(r.parts[0]), ref: `new:u${i}`, name: `단위 ${i}`, claims: [f.claim(`s${i + 10}`, f.at[0])] });
  const wide = { ...structuredClone(r), parts: [r.parts[0], ...Array.from({ length: 35 }, (_, i) => fresh(i))] };
  assert.equal(M.validateMapReply(wide, f.ask).parts.length, 36);
  assert.equal(M.MAP6_NEW_PARTS, 36);
  assert.throws(() => M.validateMapReply({ ...wide, parts: [...wide.parts, fresh(40)] }, f.ask), undefined, 'a 37th part is past the bound');
  const applied = M.applyReading(f.p, f.inp, M.validateMapReply(wide, f.ask), meta('R_wide'));
  assert.equal(applied.created.length, 36);
  assert.deepEqual(validateProject(applied.project), applied.project);
  for (const version of ['618df374', '명세 136feaf0', 'sha 2 5d31b880', '라이브 618df374', '판본 v3', 'charter_sha 고정']) {
    const bad = structuredClone(r); bad.parts[0].config = ['레버리지 20', version];
    assert.throws(() => M.validateMapReply(structuredClone(bad), f.ask), undefined, version);
    const got = M.validateMapReply(bad, f.ask, { setAside: true });
    assert.deepEqual(got.parts[0].config, [], version);
    assert.deepEqual(M.readingExclusions(got).map(e => [e.path, e.rule, e.category]), [['parts[0].config', 'contract', 'config']], version);
  }
  for (const setting of ['레버리지 20', 'seed 20261101', 'j1_cadence 60 s', 'shadow 모드', 'TX:ACTIVE', '24 h 만료']) {
    const ok = structuredClone(r); ok.parts[0].config = [setting];
    assert.deepEqual(M.validateMapReply(ok, f.ask).parts[0].config, [setting], setting);
  }
  // map.7 blanks the list the same way.
  const g = fixture(); g.reply.parts[0].config = ['618df374'];
  const seven = M.validateMapReply(g.reply, g.inp.ask);
  assert.deepEqual([seven.parts[0].config, errors(seven)], [[], [['parts[0].config', 'contract']]]);
  const many = fixture();
  for (let i = 0; i < 13; i++) many.reply.parts.push({ ...many.part(`new:x${i}`, { name: `새 ${i}`, basis: [many.spans[0].s] }), claims: [many.claim(many.spans[0].s, `s${i + 20}`)] });
  assert.equal(M.validateMapReply(many.reply, many.inp.ask).parts.filter(p => p.ref.startsWith('new:')).length, 12);
});


test('.29: the divided checks set aside their item alone with a fixed reason that is applied, stored and read back', () => {
  const text = ['| 이름 | 한 줄 |', '|---|---|', '| 엔진 | 행 셋 |', '| 카드 러너 | 카드 |', '카드 러너 → 엔진: review.jsonl 행'].join('\n');
  const p = D.pasteRecord(D.createProject(), text, null).project;
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), at = head => inp.ask.records[0].spans.find(s => s.t.startsWith(head)).s;
  const claim = (key, a) => ({ kind: 'reported', text: '원문 행의 사실', at: a, about: null, replaces: null, key });
  const part = (ref, name, row, claims) => ({ ref, name, parent: null, role: `${name} 책임`, roleAbout: null, roleReplaces: null, basis: [row], claims });
  const reply = { summary: '엔진과 카드 러너', candidates: [], gaps: [], matches: [], material: [],
    parts: [part('new:engine', '엔진', at('| 엔진'), [claim('s1', at('| 엔진'))]), part('new:card', '카드 러너', at('| 카드'), [claim('s2', at('| 카드')), claim('s3', at('| 엔진'))])],
    relations: [{ from: 'new:card', to: 'new:engine', kind: 'flow', note: '', at: at('카드 러너 →'), payload: 'review.jsonl 행', channel: 'data' },
      { from: 'new:engine', to: 'new:card', kind: 'flow', note: '', at: at('카드 러너 →') },
      { from: 'new:card', to: 'new:engine', kind: 'flow', note: '', at: at('카드 러너 →'), payload: '카드 행', channel: 'data' }] };
  // Plain map.6 reads every item: the divided checks are the server's, on the divided route only.
  assert.equal(M.setAside(M.validateMapReply(structuredClone(reply), inp.ask)).length, 0);
  const got = M.validateMapReply(structuredClone(reply), inp.ask, { setAside: true }), reasons = M.readingExclusions(got);
  assert.deepEqual(reasons.map(e => [e.path, e.rule, e.category]), [['parts[1].claims[1]', 'contract', 'wrong-part'], ['relations[0]', 'contract', 'via-store'], ['relations[1]', 'contract', 'sender']]);
  for (const [i, words] of [/다른 부분의 표 행/, /보관소 부분을 거치지 않아/, /보내는 쪽과 다르거나/].entries()) assert.match(reasons[i].explanation, words);
  assert.deepEqual([got.parts[1].claims.map(c => c.key), got.relations.length], [['s2'], 1]);
  // The wire the server leaves (the set-aside items out) reads whole in the browser; the reasons ride along and survive storage.
  const wire = structuredClone(reply); wire.parts[1].claims.splice(1, 1); wire.relations = [reply.relations[2]];
  const plain = M.validateMapReply(wire, inp.ask);
  assert.equal(M.setAside(plain).length, 0);
  M.attachExclusions(plain, reasons, inp.ask);
  const applied = M.applyReading(p, inp, plain, meta('R_divided29'));
  const local = list => list.map(({ record, ...x }) => x);
  assert.deepEqual(local(applied.reading.exclusions), local(reasons));
  assert.ok(applied.reading.exclusions.every(x => x.record === p.pasted[0].id), 'the alias is stored as the record it names');
  assert.deepEqual(parseProject(S.serializeProject(applied.project)).readings.at(-1), applied.reading);
});

// ---- map-reading.9 (first-map-divided.30): a part's steps (each on its row of the inner-step table), its loop (unit, stop and
// resume, each its own claim) and the state it keeps; the reply's port map (a relation, a port of the part at that end, one of its
// steps, in or out). Optional on the wire, exact in storage. ----
function nineReply(f) {
  const r = eightReply(f);
  Object.assign(r.parts[0], { steps: [{ name: ' 저장 ', does: '파일을 쓴다', uses: ['save()', ' save() ', 'disk'], at: f.at[0] }, { name: '확인', does: null, at: f.at[2] }],
    loop: { unit: '분마다', stop: null, resume: ' 새 행 도착 시 ', at: f.at[0] },
    stateVars: [{ name: '저장 카운터', scope: '하루', readBy: ['확인'], changedBy: ['저장'] }] });
  Object.assign(r.parts[1], { inputs: ['저장 파일'], steps: [{ name: '읽기', does: '파일을 읽는다', uses: [], at: f.at[2] }] });
  r.portMap = [{ relation: 0, port: 'e=1 행', step: '저장', direction: 'out', at: f.at[0] }, { relation: 0, port: '저장 파일', step: '읽기', direction: 'in', at: f.at[2] }];
  return r;
}
const nineOf = p => [p.steps.map(s => [s.name, s.does, s.uses]), p.loop && [p.loop.unit, p.loop.stop, p.loop.resume], p.stateVars];
const rowsOf = list => list.map(m => [m.relation ?? m.relationId, m.port, m.step, m.direction]);
const nameList = (n, head) => Array.from({ length: n }, (_, i) => `${head}${i}`);

test('map-reading.9: a map.6 reply with steps, a loop, kept state and a port map is read, applied, stored and read back', () => {
  const f = firstMap(), got = M.validateMapReply(nineReply(f), f.ask);
  assert.equal(M.setAside(got).length, 0);
  const save = [[['저장', '파일을 쓴다', ['save()', 'disk']], ['확인', null, []]], ['분마다', null, '새 행 도착 시'], [{ name: '저장 카운터', scope: '하루', readBy: ['확인'], changedBy: ['저장'] }]];
  assert.deepEqual(nineOf(got.parts[0]), save);
  assert.deepEqual(nineOf(got.parts[1]), [[['읽기', '파일을 읽는다', []]], null, []]);
  assert.deepEqual(rowsOf(got.portMap), [[0, 'e=1 행', '저장', 'out'], [0, '저장 파일', '읽기', 'in']]);
  const applied = M.applyReading(f.p, f.inp, got, meta('R_nine_full'));
  assert.equal(applied.reading.version, 'map-reading.9');
  const [stored, read] = applied.reading.parts, line = applied.reading.relations[0];
  assert.deepEqual(nineOf(stored), save);
  assert.deepEqual(stored.steps[0].quote, stored.typeQuote, 'a step stands on its own row, anchored where it stands');
  assert.deepEqual(stored.loop.quote, stored.typeQuote);
  assert.deepEqual(applied.reading.portMap.map(m => [m.relationId, m.areaId, m.port, m.step, m.direction]),
    [[line.relationId, stored.areaId, 'e=1 행', '저장', 'out'], [line.relationId, read.areaId, '저장 파일', '읽기', 'in']]);
  const u = M.partUnderstanding(applied.project, stored.areaId), v = M.partUnderstanding(applied.project, read.areaId);
  assert.deepEqual([u.steps.map(s => [s.name, s.at]), u.loop && [u.loop.unit, u.loop.resume, u.loop.at], u.stateVars.map(s => s.name)],
    [[['저장', meta().at], ['확인', meta().at]], ['분마다', '새 행 도착 시', meta().at], ['저장 카운터']]);
  assert.deepEqual([rowsOf(u.portMap), rowsOf(v.portMap), v.loop], [[[line.relationId, 'e=1 행', '저장', 'out']], [[line.relationId, '저장 파일', '읽기', 'in']], null]);
  assert.deepEqual(validateProject(applied.project), applied.project);
  assert.deepEqual(parseProject(S.serializeProject(applied.project)).readings.at(-1), applied.reading);
});

test('map-reading.9 lenient: a wrong step, loop item, kept state or port-map row is set aside alone with a fixed reason', () => {
  const f = firstMap(), r = nineReply(f);
  r.parts[0].steps[1].at = 'N01.99';
  r.parts[0].steps.push({ name: '저장', does: '다시', at: f.at[2] });
  r.parts[0].loop.stop = '가'.repeat(61);
  r.parts[0].stateVars = [{ name: '넘침', readBy: nameList(5, 'r') }, { name: '남음' }];
  r.parts[1].loop = { unit: '매번', at: 'N01.99' };
  r.portMap.push({ relation: 5, port: 'e=1 행', step: '저장', direction: 'out', at: f.at[0] }, { relation: 0, port: '없는 포트', step: '저장', direction: 'out', at: f.at[0] },
    { relation: 0, port: '저장 파일', step: '확인', direction: 'in', at: f.at[2] }, { ...r.portMap[0] }, { relation: 0, port: '저장 파일', step: '읽기', direction: 'out', at: 'N01.99' });
  assert.throws(() => M.validateMapReply(structuredClone(r), f.ask), undefined, 'plain map.6 refuses');
  const got = M.validateMapReply(structuredClone(r), f.ask, { setAside: true }), reasons = M.readingExclusions(got);
  assert.deepEqual(reasons.map(e => [e.path, e.rule, e.category]), [['parts[0].steps[1]', 'contract', 'step'], ['parts[0].steps[2]', 'contract', 'step'],
    ['parts[0].loop.stop', 'contract', 'loop'], ['parts[0].stateVars[0]', 'contract', 'state-var'], ['parts[1].loop', 'contract', 'loop'],
    ['portMap[2]', 'contract', 'port-map'], ['portMap[3]', 'contract', 'port-map'], ['portMap[4]', 'contract', 'port-map'], ['portMap[5]', 'contract', 'port-map'], ['portMap[6]', 'contract', 'port-map']]);
  for (const [i, words] of [[0, /그 단계만/], [2, /그 칸만 비웠어요/], [3, /그 항목만/], [5, /그 대응만/]]) assert.match(reasons[i].explanation, words);
  assert.ok(reasons[1].record && reasons[5].record, 'a set-aside step and row keep where their line stands');
  assert.deepEqual(nineOf(got.parts[0]), [[['저장', '파일을 쓴다', ['save()', 'disk']]], ['분마다', null, '새 행 도착 시'], [{ name: '남음', scope: null, readBy: [], changedBy: [] }]]);
  assert.equal(got.parts[1].loop, null);
  assert.deepEqual(rowsOf(got.portMap), [[0, 'e=1 행', '저장', 'out'], [0, '저장 파일', '읽기', 'in']]);
  const applied = M.applyReading(f.p, f.inp, got, meta('R_nine_lenient'));
  assert.deepEqual(applied.reading.exclusions.map(e => e.path), reasons.map(e => e.path));
  assert.deepEqual(parseProject(S.serializeProject(applied.project)).readings.at(-1), applied.reading);
  // A wrong list is left out whole.
  const whole = nineReply(f); whole.parts[0].steps = nameList(13, 's').map(name => ({ name, at: f.at[0] })); whole.portMap = { relation: 0 };
  const left = M.validateMapReply(whole, f.ask, { setAside: true });
  assert.deepEqual([left.parts[0].steps, left.portMap, M.readingExclusions(left).map(e => [e.path, e.category])], [[], [], [['parts[0].steps', 'step'], ['portMap', 'port-map']]]);
  // map.7 reads the same way.
  const g = fixture();
  Object.assign(g.reply.parts[0], { steps: [{ name: '저장', at: 'N01.99' }, { name: '읽기', at: g.spans[2].s }], stateVars: [{ name: '' }] });
  const seven = M.validateMapReply(g.reply, g.inp.ask);
  assert.deepEqual([seven.parts[0].steps.map(s => s.name), seven.parts[0].stateVars, errors(seven)], [['읽기'], [], [['parts[0].steps[0]', 'contract'], ['parts[0].stateVars[0]', 'contract']]]);
});

test('map-reading.9 strict: plain map.6 refuses a reply with any wrong new field; the raised list bounds are read whole', () => {
  const f = firstMap();
  for (const mutate of [
    r => { r.parts[0].steps[0].at = 'N01.99'; }, r => { r.parts[0].steps = 'x'; }, r => { r.parts[0].steps = nameList(13, 's').map(name => ({ name, at: f.at[0] })); },
    r => { r.parts[0].steps[0].name = '가'.repeat(41); }, r => { delete r.parts[0].steps[0].at; }, r => { r.parts[0].steps[0].uses = nameList(5, 'u'); }, r => { r.parts[0].steps[1].name = '저장'; },
    r => { r.parts[0].loop.unit = ''; }, r => { delete r.parts[0].loop.at; }, r => { r.parts[0].loop.at = 'N01.99'; }, r => { r.parts[0].loop = 'x'; },
    r => { r.parts[0].stateVars[0].scope = '가'.repeat(41); }, r => { r.parts[0].stateVars = nameList(9, 'v').map(name => ({ name })); }, r => { r.parts[0].stateVars.push({ name: '저장 카운터' }); },
    r => { r.portMap[0].relation = 9; }, r => { r.portMap[0].port = '없음'; }, r => { r.portMap[0].step = '읽기'; }, r => { r.portMap[0].direction = 'up'; }, r => { r.portMap = {}; },
    r => { r.portMap = Array(13).fill(r.portMap[0]); }, r => { r.portMap.push({ ...r.portMap[0] }); }, r => { r.portMap[0].at = 'N01.99'; },
    r => { r.parts[0].inputs = nameList(9, 'i'); }, r => { r.parts[0].fields = nameList(25, 'f'); }, r => { r.parts[0].config = nameList(9, '설정 '); },
    r => { r.parts[0].steps[0].does = `sk-${'A'.repeat(25)}`; },
  ]) {
    const r = nineReply(f); mutate(r);
    assert.throws(() => M.validateMapReply(r, f.ask), undefined, String(mutate));
  }
  const wide = nineReply(f);
  Object.assign(wide.parts[0], { inputs: nameList(8, 'i'), outputs: ['e=1 행', ...nameList(7, 'o')], fields: nameList(24, 'f'), config: nameList(8, '설정 ') });
  const got = M.validateMapReply(wide, f.ask);
  assert.deepEqual([got.parts[0].inputs.length, got.parts[0].outputs.length, got.parts[0].fields.length, got.parts[0].config.length], [8, 8, 24, 8]);
  const applied = M.applyReading(f.p, f.inp, got, meta('R_nine_wide'));
  const u = M.partUnderstanding(applied.project, applied.reading.parts[0].areaId);
  assert.deepEqual([u.inputs.length, u.fields.length, u.config.length], [8, 24, 8]);
  assert.deepEqual(validateProject(applied.project), applied.project);
  // A loop that says none of its three items is no loop (its line is not read).
  const none = nineReply(f); none.parts[0].loop = { unit: null, stop: null, resume: null, at: 'N01.99' };
  assert.equal(M.validateMapReply(none, f.ask).parts[0].loop, null);
});

test('map-reading.9: a reply without any new field stores every key as not said', () => {
  const f = firstMap(), r = structuredClone(f.reply); r.parts[0].claims.splice(1, 1);
  const applied = M.applyReading(f.p, f.inp, M.validateMapReply(r, f.ask), meta('R_nine_plain'));
  assert.equal(applied.reading.version, 'map-reading.9');
  assert.deepEqual(applied.reading.portMap, []);
  for (const p of applied.reading.parts) assert.deepEqual([p.steps, p.loop, p.stateVars], [[], null, []]);
  const u = M.partUnderstanding(applied.project, applied.reading.parts[0].areaId);
  assert.deepEqual([u.steps, u.loop, u.stateVars, u.portMap], [[], null, [], []]);
  assert.deepEqual(validateProject(applied.project), applied.project);
});

test('map-reading.9 storage is exact: unknown values, a missing key, a .9 key on a .8 reading and the .8 bounds are refused', () => {
  const f = firstMap(), applied = M.applyReading(f.p, f.inp, M.validateMapReply(nineReply(f), f.ask), meta('R_nine_store'));
  const raw = S.serializeProject(applied.project);
  const excluded = (path, category) => ({ path, rule: 'contract', category, explanation: '-', record: null, from: null, to: null });
  for (const mutate of [
    r => { delete r.parts[0].steps; }, r => { r.parts[0].steps[0].name = ''; }, r => { r.parts[0].steps[0].uses = ['a', 'a']; }, r => { r.parts[0].steps[1].name = '저장'; },
    r => { r.parts[0].steps = nameList(13, 's').map(name => ({ ...r.parts[0].steps[0], name })); }, r => { r.parts[0].steps[0].quote = { ...r.parts[0].steps[0].quote, quote: 'x' }; },
    r => { r.parts[0].steps[0].extra = 1; }, r => { delete r.parts[1].loop; }, r => { r.parts[0].loop = { ...r.parts[0].loop, unit: null, resume: null }; }, r => { r.parts[0].loop.stop = '가'.repeat(61); },
    r => { delete r.parts[0].loop.quote; }, r => { r.parts[0].stateVars[0].readBy = ['a', 'a']; }, r => { r.parts[0].stateVars.push({ ...r.parts[0].stateVars[0] }); }, r => { delete r.parts[0].stateVars[0].scope; },
    r => { delete r.portMap; }, r => { r.portMap[0].areaId = r.parts[1].areaId; }, r => { r.portMap[0].step = '없음'; }, r => { r.portMap[0].port = '저장 파일'; }, r => { r.portMap[0].relationId = 'REL_none'; },
    r => { r.portMap[0].direction = 'up'; }, r => { r.portMap.push({ ...r.portMap[0] }); }, r => { r.portMap[0].quote = { ...r.portMap[0].quote, quote: 'x' }; },
    r => { r.parts[0].fields = nameList(25, 'f'); }, r => { r.parts[0].inputs = nameList(9, 'i'); },
    r => { r.version = 'map-reading.8'; },
    r => { r.version = 'map-reading.8'; stripNine(r); r.parts[0].steps = []; },
    r => { r.version = 'map-reading.8'; stripNine(r); r.portMap = []; },
    r => { r.version = 'map-reading.8'; stripNine(r); r.parts[0].fields = nameList(13, 'f'); },
    r => { r.version = 'map-reading.8'; stripNine(r); r.parts[0].inputs = nameList(7, 'i'); },
    r => { r.version = 'map-reading.8'; stripNine(r); r.exclusions = [excluded('portMap[0]', 'port-map')]; },
  ]) {
    const bad = JSON.parse(raw); mutate(bad.readings.at(-1));
    assert.throws(() => parseProject(JSON.stringify(bad)), undefined, String(mutate));
    assert.throws(() => validateProject(bad), undefined, String(mutate));
  }
  const old = JSON.parse(raw); old.readings.at(-1).version = 'map-reading.8'; stripNine(old.readings.at(-1));
  assert.deepEqual(validateProject(old), old, 'a map-reading.8 entry keeps its exact shape');
  const u = M.partUnderstanding(parseProject(JSON.stringify(old)), old.readings.at(-1).parts[0].areaId);
  assert.deepEqual([u.steps, u.loop, u.stateVars, u.portMap, u.inputs], [[], null, [], [], ['review 행', 'policy 행']], 'an earlier reading has no steps, loop, state or port map');
  const ok = JSON.parse(raw); ok.readings.at(-1).exclusions = [excluded('portMap[0]', 'port-map'), excluded('parts[0].steps[1]', 'step'), excluded('parts[0].loop.unit', 'loop')];
  assert.deepEqual(validateProject(ok), ok, 'a .9 reading may say where a step, a loop item or a row stood');
});
