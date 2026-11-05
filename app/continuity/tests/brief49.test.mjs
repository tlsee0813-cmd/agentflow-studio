// Recipe .49 (brief-parts.1): a later map over its 30,000-byte budget is shrunk by relevance, never by leaving a part out. A growing-map
// test stopped at 50 parts and 61 relations: the map alone was still over the budget after the old step (claims to 2, roles to 120) and
// every later reading was refused TOO_LARGE. Now notes go to 300, then the parts the records to be sent do not name go brief (no note, no
// current, role to 60), relation notes shorten, then neighbours and at last named parts go brief; only a map whose names, parents and
// relations alone are over the budget is TOO_LARGE. Model-free: built asks, the validator and the rendered instructions.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as J from '../dist/public/shared/map-job.js';
import { studioView } from '../dist/public/shared/studio.js';
import { parseProject } from '../dist/public/shared/validation.js';
import * as P from '../server/map-prompt.mjs';
import * as Pipe from '../server/map-pipeline.mjs';

const bytes = v => new TextEncoder().encode(JSON.stringify(v)).length;
const mapBytes = ask => bytes({ ...ask, records: [], ...(ask.requests ? { requests: [] } : {}), ...(ask.priors ? { priors: [] } : {}) });
const name = i => `구성 요소 ${String(i).padStart(2, '0')}`;
const NOTE = i => `${name(i)}의 설명: `.padEnd(2000, '사용자가 직접 적은 긴 설명 문장이다. ');
const REL_NOTE = '관계 설명 '.padEnd(200, '이 두 부분 사이에 오가는 것에 대한 긴 설명. ');

/** 50 parts (every fifth a child of the one before it) with 2,000-character notes, 61 relations with 200-character notes, and one
 * pasted record that names 구성 요소 07 and 구성 요소 23 (the record the next reading sends). */
function grown() {
  let p = { ...D.createProject(), name: '자라는 지도' };
  for (let i = 1; i <= 50; i++) {
    const parent = i % 5 === 0 ? p.space.areas.at(-1).id : null;
    p = parent ? D.addChildArea(p, parent, name(i), NOTE(i)) : D.addArea(p, name(i), NOTE(i));
  }
  const ids = p.space.areas.map(a => a.id);
  const pairs = [];
  for (let i = 0; i < 49; i++) pairs.push([i, i + 1]);
  for (let i = 0; i < 12; i++) pairs.push([i * 4, (i * 4 + 9) % 50]);
  for (const [a, b] of pairs) p = D.addRelation(p, ids[a], ids[b], 'flow', REL_NOTE);
  p = D.pasteRecord(p, `작업 보고: ${name(7)}에서 받은 파일을 ${name(23)}가 정리하도록 바꿨습니다. 나머지는 그대로입니다.`, null).project;
  return parseProject(JSON.stringify(p));
}
const build = (p, schema = M.MAP7_SCHEMA) => M.buildMapAsk(p, studioView(p), [], undefined, schema);

test('49-1 a 50-part / 61-relation map with long notes now builds a later map.7 ask within META_BYTES and MAP_BYTES', () => {
  const p = grown(), view = studioView(p);
  assert.equal(view.parts.length, 50); assert.equal(view.relations.length, 61);
  // What the old step left: notes at 2,000 and relation notes at 200 (no claims or roles to shrink) — far over the budget.
  const old = { ...build(p).ask, records: [] };
  old.parts = old.parts.map(x => ({ ...x, note: view.parts.find(v => M.normName(v.name) === M.normName(x.name)).note, current: [], brief: undefined }));
  old.relations = old.relations.map(r => ({ ...r, note: REL_NOTE }));
  assert.ok(mapBytes(JSON.parse(JSON.stringify(old))) > M.META_BYTES, 'the old shrink could not fit this map');
  const inp = build(p), ask = inp.ask;
  assert.equal(inp.problem, null); assert.equal(ask.schemaVersion, M.MAP7_SCHEMA);
  assert.ok(mapBytes(ask) <= M.META_BYTES, `map ${mapBytes(ask)} B`); assert.ok(bytes(ask) <= M.MAP_BYTES, `ask ${bytes(ask)} B`);
  assert.equal(ask.records.length, 1); assert.deepEqual(inp.coverage, { fresh: 1, sent: 1, partial: 0 });
  M.validateMapAsk(ask); M.validateMapAsk(ask, { route: 'divided' });
  // Identity: every part keeps its alias, name and parent; every relation its ends and kind.
  assert.deepEqual(ask.parts.map(x => x.id), view.parts.map((_, i) => `P${String(i + 1).padStart(2, '0')}`));
  assert.deepEqual([...inp.parts].map(([a, id]) => [a, id]), view.parts.map((x, i) => [`P${String(i + 1).padStart(2, '0')}`, x.id]));
  const alias = new Map([...inp.parts].map(([a, id]) => [id, a]));
  assert.deepEqual(ask.parts.map(x => [x.name, x.parentId]), view.parts.map(x => [x.name, x.parentId ? alias.get(x.parentId) : null]));
  assert.deepEqual(ask.relations.map(r => [r.from, r.to, r.kind]), view.relations.map(r => [alias.get(r.from), alias.get(r.to), r.kind]));
  // Brief parts say so, and carry nothing of their note or claims; the named parts and their neighbours stay whole (notes cut to 300).
  const brief = ask.parts.filter(x => x.brief), whole = ask.parts.filter(x => !x.brief);
  assert.ok(brief.length > 0 && whole.length > 0, `${brief.length} brief`);
  for (const x of brief) assert.deepEqual([x.brief, x.note, x.current], [true, '', []]);
  for (const x of whole) { assert.equal(x.brief, undefined); assert.equal(x.note.length, M.BRIEF_NOTE); }
  const byName = n => ask.parts.find(x => x.name === n);
  const named = [byName(name(7)), byName(name(23))], tier = M.partRelevance(ask, ask.records[0].lead + ask.records[0].spans.map(s => s.t).join(''));
  for (const x of named) { assert.equal(x.brief, undefined, `${x.name} named by the record stays whole`); assert.equal(tier.get(x.id).tier, 2); }
  for (const x of ask.parts) if (tier.get(x.id).tier > 0) assert.equal(x.brief, undefined, `${x.name} (tier ${tier.get(x.id).tier}) stays whole`);
  // A neighbour of a named part (its relation's other end) is tier 1.
  const p07 = named[0].id; assert.ok(ask.relations.filter(r => r.from === p07 || r.to === p07).every(r => tier.get(r.from === p07 ? r.to : r.from).tier >= 1));
  // The job codec carries it unchanged (the server reads the very ask).
  assert.deepEqual(J.decodeMapInput(JSON.parse(JSON.stringify(J.encodeMapInput(inp)))).ask, ask);
});

test('49-2 the same project builds the same ask (deterministic), and map.6 (no brief contract) stays TOO_LARGE', () => {
  const p = grown(), a = build(p), b = build(parseProject(JSON.stringify(p)));
  assert.equal(JSON.stringify(a.ask), JSON.stringify(b.ask));
  const six = build(p, M.MAP6_SCHEMA);
  assert.equal(six.problem, 'TOO_LARGE', 'brief is a map.7 contract: an ask that goes as map.6 is never sent in short form');
  assert.ok(six.ask.parts.every(x => x.brief === undefined));
});

test('49-3 a map of names, parents and relations alone over the budget is still TOO_LARGE', () => {
  let p = { ...D.createProject(), name: '이름만 큰 지도' };
  for (let i = 0; i < 200; i++) p = D.addArea(p, `${String(i).padStart(3, '0')} ${'가'.repeat(56)}`);
  const ids = p.space.areas.map(a => a.id);
  for (let i = 0; i < 199; i++) p = D.addRelation(p, ids[i], ids[i + 1], 'needs', '짧은 설명');
  p = D.pasteRecord(p, '작업 보고: 아무 부분도 이름으로 말하지 않는 짧은 기록입니다.', null).project;
  p = parseProject(JSON.stringify(p));
  const inp = build(p);
  assert.equal(inp.problem, 'TOO_LARGE');
  assert.equal(inp.ask.parts.length, 200, 'nothing is left out of the map to make it fit');
  assert.ok(inp.ask.relations.every(r => r.note === ''), 'relation notes went last');
});

test('49-4 relevance: names and own words, shared words name nobody, ASCII words whole, neighbours one step', () => {
  const part = (id, name, extra = {}) => ({ id, name, note: '', parentId: null, readAs: null, role: '', roleBy: null, roleAbout: null, current: [], ...extra });
  const ask = { parts: [part('P01', '소비 감시자'), part('P02', '소비 파이프라인'), part('P03', 'REST API'), part('P04', '작업 실행기', { parentId: 'P01' }),
    part('P05', '메일 수집기', { current: [{ key: 'C01', kind: 'reported', text: 'mailbox_reader 모듈이 받은 메일을 넘긴다고 보고했다.', about: null }] }), part('P06', '검색 색인'), part('P07', 'Redis')],
    relations: [{ from: 'P03', to: 'P06', kind: 'flow', note: '' }] };
  const rel = t => Object.fromEntries([...M.partRelevance(ask, t)].map(([id, r]) => [id, r.tier]));
  assert.deepEqual(rel('소비 과정 전체를 다시 봤다.'), { P01: 0, P02: 0, P03: 0, P04: 0, P05: 0, P06: 0, P07: 0 }, '소비 is shared: it names no part');
  assert.deepEqual(rel('감시자가 파일을 보았다.'), { P01: 2, P02: 0, P03: 0, P04: 1, P05: 0, P06: 0, P07: 0 }, 'an own word names its part; a child is next to it');
  assert.equal(rel('rapid 모드로 돌렸다.').P03, 0, 'api is not in rapid'); assert.equal(rel('새 api 경로를 열었다.').P03, 2);
  assert.deepEqual([rel('API를 바꿨다.').P03, rel('API를 바꿨다.').P06], [2, 1], 'the other end of a relation is next to it');
  assert.equal(rel('mailbox_reader 설정을 고쳤다.').P05, 2, 'a code word of a current claim names its part');
  assert.equal(rel('REDIS 큐가 찼다.').P07, 2, 'names fold case'); assert.equal(rel('Redis가 멈췄다.').P07, 2, 'a Korean particle after an ASCII name');
  assert.equal(rel('redistribute 했다.').P07, 0, 'never inside a longer ASCII word');
  assert.deepEqual(M.partWords(ask.parts[2]), { names: ['rest api'], words: ['rest', 'api'] });
});

test('49-5 fitMap: claims and roles first, unnamed parts brief before named ones, fewest mentions first; stops as soon as it fits', () => {
  const claim = (k, t) => ({ key: k, kind: 'reported', text: t, about: null });
  const mk = () => ({ parts: Array.from({ length: 6 }, (_, i) => ({ id: `P0${i + 1}`, name: `부분${'가나다라마바'[i]}`, note: '', parentId: null, readAs: null,
    role: '역할 설명이 아주 길다. '.repeat(20).slice(0, 300), roleBy: 'reading', roleAbout: null,
    current: Array.from({ length: 6 }, (_, j) => claim(`C${i}${j}`, `주장 ${j}: `.padEnd(240, '긴 주장 문장. '))) })), relations: [] });
  const text = '부분가 부분가 부분나 를 고쳤다.';
  // A budget that the old step alone meets: nothing goes brief.
  let ask = mk(); const after1 = (() => { const a = mk(); for (const x of a.parts) { x.current = x.current.slice(0, 2); x.role = x.role.slice(0, 120); } return bytes(a); })();
  assert.ok(M.fitMap(ask, text, true, () => bytes(ask) <= after1)); assert.ok(ask.parts.every(x => !x.brief && x.current.length === 2 && x.role.length === 120));
  // Tighter: the unnamed parts go brief one by one (ask order), the named keep their claims.
  ask = mk(); const budget = after1 - 2000;
  assert.ok(M.fitMap(ask, text, true, () => bytes(ask) <= budget));
  const shortened = ask.parts.map(x => !!x.brief);
  assert.deepEqual(shortened.slice(0, 2), [false, false], 'the named parts keep their claims');
  const k = shortened.filter(Boolean).length;
  assert.ok(k >= 2 && k < 4, `${k} brief`); assert.deepEqual(shortened.slice(2), [0, 1, 2, 3].map(j => j < k), 'unnamed parts in ask order, as few as fit');
  for (const x of ask.parts.filter(x => x.brief)) { assert.deepEqual([x.note, x.current, x.role.length, x.roleBy], ['', [], M.BRIEF_ROLE, 'reading']); }
  // Tightest that still fits: the named parts go last, the less mentioned (부분나, once) before the more mentioned (부분가, twice).
  ask = mk(); const all = mk(); for (const x of all.parts) { x.current = []; x.role = x.role.slice(0, 60); x.brief = true; }
  all.parts[0].current = mk().parts[0].current.slice(0, 2); all.parts[0].role = mk().parts[0].role.slice(0, 120); delete all.parts[0].brief;
  const tight = bytes(all);
  assert.ok(M.fitMap(ask, text, true, () => bytes(ask) <= tight)); assert.deepEqual(ask.parts.map(x => !!x.brief), [false, true, true, true, true, true]);
  // Without the brief contract nothing goes brief and it does not fit.
  ask = mk(); assert.equal(M.fitMap(ask, text, false, () => bytes(ask) <= budget), false); assert.ok(ask.parts.every(x => !x.brief));
});

test('49-6 validation: brief is map.7 only, exactly true, with no note or current and a short role', () => {
  const ask = build(grown()).ask, i = ask.parts.findIndex(x => x.brief), bad = f => { const a = structuredClone(ask); f(a.parts[i], a); return a; };
  assert.ok(i >= 0); M.validateMapAsk(ask);
  for (const [why, f] of [['map.6', (_, a) => { a.schemaVersion = M.MAP6_SCHEMA; }], ['false', x => { x.brief = false; }], ['a note', x => { x.note = '설명'; }],
    ['a claim', x => { x.current = [{ key: 'C99', kind: 'reported', text: '주장', about: null }]; }], ['a long role', x => { x.role = '가'.repeat(61); x.roleBy = 'reading'; }]])
    assert.throws(() => M.validateMapAsk(bad(f)), /INVALID_INPUT/, why);
});

test('49-7 instructions: the brief-parts rule goes only with a brief part; the later recipes and m7 recipe are bumped', () => {
  const brief = build(grown()).ask, plain = structuredClone(brief);
  for (const x of plain.parts) delete x.brief;
  assert.equal(P.map7Prompt(brief), P.MAP7_PROMPT + P.MAP7_VOCABULARY + P.MAP7_BRIEF + P.map7Guidance(brief));
  assert.equal(P.map7Prompt(plain), P.MAP7_PROMPT + P.MAP7_VOCABULARY + P.map7Guidance(plain), 'an ask without a brief part renders as before');
  assert.equal(P.mapBriefRule(plain), ''); assert.equal(P.mapBriefRule(brief), P.MAP7_BRIEF);
  for (const said of ['"brief":true', '현재 유효한 기존 부분', 'name·readAs·부모(parentId)·relations', '새 부분으로 만들지 않는다', '없는 것', 'replaces나 corrections로 가리키지 않는다'])
    assert.ok(P.MAP7_BRIEF.includes(said), said);
  assert.ok(P.MAP7_RECIPE.startsWith('map7-recipe.4:') && P.MAP7_RECIPE.includes('brief-parts.1'));
  assert.deepEqual([Pipe.PIPELINE_RECIPE, Pipe.LATER_PIPELINE_RECIPE], ['first-map-divided.49', 'later-map-divided.49']);
});
