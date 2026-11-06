// Recipe .50 step 4 (row-binding.1, Astra F5 Q1/Q7(4)): a v5 row ID is its record's own; the row → part mapping is kept on the project
// (from the ledger) and sent with a later ask (records[].partRows); the app reads a new part on a bound C-PART row as that part; a later
// map's same-name net compares names with their bracketed qualifiers left out and raises a held identity candidate, never a merge, with
// the held part's relations kept as candidates; a part read as built ends an older unbuilt state. Model-free: hand-written replies and,
// when the growth run's artefacts are on this machine (AF_GROWTH_DIR), its stored asks and replies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as T from '../dist/public/shared/record-table.js';
import * as X from '../dist/public/shared/record-excerpt.js';
import * as L from '../dist/public/shared/row-ledger.js';
import * as J from '../dist/public/shared/map-job.js';
import { parseProject, validateProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';
import * as P from '../server/map-prompt.mjs';
import * as B from '../server/map-blueprint.mjs';
import { GROWTH, CASES, haveGrowth, rebuilt } from './identity50-replay.mjs';

const pad = n => String(n).padStart(2, '0');
const RECORD = 'AF5-50a1b2c3', BASIS = '50c0de1', KEY = `${RECORD}@${BASIS}`;
const headOf = (record, basis, n) => `〔기록 ${record} · 쪽 ${n} · 기준 ${basis} · 앞 쪽 ${n > 1 ? n - 1 : '—'}〕 묶기 시험 기록 v5 (시험 세션, 2026-11-06 11:${pad(n)})`;
const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
const ends = list => table('C-END', list.map(([t, w]) => [t, '끝남', w, '—', '—']));
const partRow = (id, name, impl = '구현됨') => [id, name, '처리 · 계산', `${name}의 일`, 'F01', impl, 'F01'];
const linkRow = (id, a, b, what) => [id, a, b, what, '호출마다', '—', '같은 프로세스', '정의된 관계', 'F01'];
const NAMES = ['수집기', '정리기', '저장소', '검색기', '알림기', '화면'];
const PAIRS = NAMES.flatMap((_, a) => NAMES.map((_, b) => [a, b])).filter(([a, b]) => a !== b).slice(0, 18);
/** Page 1 of a record: its ledgers and head, the given C-PART rows, C-LINK rows and two issue rows. */
function page1({ record = RECORD, basis = BASIS, names = NAMES, impl = () => '구현됨', pairs = PAIRS } = {}) {
  return [headOf(record, basis, 1), table('C-SRC', [['F01', 'src/', 'B01', '읽음', '코드']]), table('C-EVID', [['E01', '파일', 'F01', 'main()', '연다']]),
    table('C-HEAD', T.HEAD_ITEMS.map((item, k) => [item, `값 ${k + 1}`, 'F01'])), 'C-SUMMARY 요약\n묶기 시험 서비스 (F01).',
    table('C-PART', names.map((n, k) => partRow(`B${pad(k + 1)}`, n, impl(k)))),
    ...(pairs.length ? [table('C-LINK', pairs.map(([a, b], k) => linkRow(`LN${pad(k + 1)}`, `B${pad(a + 1)}`, `B${pad(b + 1)}`, `자료 ${k + 1}`)))] : []),
    table('C-ISSUE', [['IS01', 'B03', '저장이 가끔 늦음', '모름', 'F01'], ['IS02', 'B04', '검색이 느림', '모름', 'F01']]),
    ends([['C-HEAD', '—'], ['C-PART', `B01–B${pad(names.length)}`], ...(pairs.length ? [['C-LINK', `LN01–LN${pad(pairs.length)}`]] : []), ['C-ISSUE', 'IS01–IS02']]), '완료 단계: 첫 구조 완료'].join('\n');
}
/** Page 2: one more C-PART row (B07) and two C-LINK rows on it (B01 → B07, B07 → B06), naming page 1's parts by ID only. */
const page2 = name => [headOf(RECORD, BASIS, 2), table('C-PART', [partRow('B07', name)]),
  table('C-LINK', [linkRow('LN19', 'B01', 'B07', '자료 19'), linkRow('LN20', 'B07', 'B06', '자료 20')]),
  ends([['C-PART', 'B07'], ['C-LINK', 'LN19–LN20']]), '완료 단계: 첫 구조 완료'].join('\n');
const meta = (id, h) => ({ id, at: '2026-11-06T03:00:00.000Z', model: 'stub', prompt: 'm7-000000000050', hash: h.repeat(64) });
function project(...pages) {
  let p = D.addArea({ ...D.createProject(), name: '묶기 시험' }, '기존 부분', '사람이 만든 부분');
  for (const t of pages) p = D.pasteRecord(p, t, null).project;
  return parseProject(JSON.stringify(p));
}
const paste = (p, t) => parseProject(JSON.stringify(D.pasteRecord(p, t, null).project));
const ask7 = p => M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA);
/** The alias of a piece that opens with `words`, in the ask record `rec` (any when omitted). */
const at = (ask, words, rec) => { for (const r of ask.records) { if (rec && r.id !== rec) continue; const s = r.spans.find(x => x.t.trimStart().startsWith(words)); if (s) return s.s; } throw new Error(`no piece ${words}`); };
const newPart = (ref, name, basis, o = {}) => ({ ref, name, parent: null, role: `${name}의 일을 맡는다.`, roleAboutAt: null, roleReplaces: null, basis: [basis], claims: [], ...o });
const oldPart = (ref, o = {}) => ({ ref, name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [], claims: [], ...o });
const claim = (where, key, text = '원문 행이 말하는 내용이다.') => ({ kind: 'describes', text, at: where, aboutAt: null, replaces: null, key });
const reply7 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const rowsOf = r => Object.fromEntries((r.rows ?? []).map(x => [`${x.table} ${x.id}`, x]));
const ledgerOf = p => L.rowLedger(p, X.v5Folds(p.pasted));
const areaOf = (p, name) => p.space.areas.find(a => a.name === name && !a.archived)?.id;
const aliasOf = (inp, id) => [...inp.parts].find(([, v]) => v === id)?.[0];
/** The first reading of page 1: the six parts on their C-PART rows and the first sixteen lines (LN17, LN18 and the issues wait). */
function firstRead(p) {
  const inp = ask7(p), ask = inp.ask;
  const wire = reply7({ parts: NAMES.map((n, k) => newPart(`new:b${k + 1}`, n, at(ask, `|B${pad(k + 1)}|`))),
    relations: PAIRS.slice(0, 16).map(([a, b], k) => ({ from: `new:b${a + 1}`, to: `new:b${b + 1}`, kind: 'flow', note: `자료 ${k + 1}`, at: at(ask, `|LN${pad(k + 1)}|`) })) });
  return M.applyReading(p, inp, M.validateMapReply(wire, ask), meta('R_bind50a', 'a'));
}

test('B50-1 a v5 row ID is its record\'s own: two records\' B01 in one ask join their own parts', () => {
  const other = page1({ record: 'AF5-50d4e5f6', basis: 'd0c0de2', names: ['배달기'], impl: () => '미구현', pairs: [] });
  const p = project(page1({ names: ['수집기'], pairs: [] }), other), inp = ask7(p), ask = inp.ask;
  assert.equal(ask.records.length, 2, 'both records go');
  const recOf = record => ask.records.find(r => M.askRecords(ask).get(r.id).text.includes(record)).id;
  const a = recOf(RECORD), b = recOf('AF5-50d4e5f6');
  const reply = M.validateMapReply(reply7({ parts: [newPart('new:x', '수집기', at(ask, '|B01|', a)), newPart('new:y', '배달기', at(ask, '|B01|', b))] }), ask);
  const [x, y] = reply.parts;
  assert.deepEqual([x.recordRef, x.implementation, y.recordRef, y.implementation], ['B01', 'built', 'B01', 'unbuilt'], 'each part keeps its own record\'s row (.49 gave both record A\'s)');
  assert.equal(y.state, 'unbuilt'); assert.equal(x.state, null);
  // The ledger keeps them apart too.
  const applied = M.applyReading(p, inp, reply, meta('R_bind50r', '9')), led = ledgerOf(applied.project);
  const bx = led.get(L.ledgerKey(KEY, 'C-PART', 'B01')), by = led.get(L.ledgerKey('AF5-50d4e5f6@d0c0de2', 'C-PART', 'B01'));
  assert.deepEqual([bx.to[0].id, by.to[0].id], [areaOf(applied.project, '수집기'), areaOf(applied.project, '배달기')]);
  const bound = L.rowBindings(led, () => true);
  assert.equal(bound.get(L.ledgerKey(KEY, 'C-PART', 'B01')), areaOf(applied.project, '수집기'));
  assert.equal(bound.get(L.ledgerKey('AF5-50d4e5f6@d0c0de2', 'C-PART', 'B01')), areaOf(applied.project, '배달기'));
});

test('B50-2 the row → part mapping: one live part by its basis or fields; never two parts, a claim alone, an archived part or a name', () => {
  const row = (to, state = 'reflected') => ({ record: KEY, table: 'C-PART', id: 'B01', state, reason: state === 'reflected' ? null : 'transient', detail: null, sent: 1, to, with: [], paste: 'x', start: 0, end: 1, ends: [], name: '수집기', reading: 'R' });
  const of = (x, live = () => true) => L.rowBindings(new Map([[L.ledgerKey(KEY, 'C-PART', 'B01'), x]]), live).get(L.ledgerKey(KEY, 'C-PART', 'B01')) ?? null;
  assert.equal(of(row([{ kind: 'part', id: 'a1', index: null }, { kind: 'claim', id: 'a2', index: 0 }])), 'a1');
  assert.equal(of(row([{ kind: 'part', id: 'a1', index: null }, { kind: 'part', id: 'a2', index: null }])), null, 'two parts: no guess');
  assert.equal(of(row([{ kind: 'claim', id: 'a1', index: 0 }])), null, 'a claim quoting the row is no binding');
  assert.equal(of(row([{ kind: 'part', id: 'a1', index: null }]), id => id !== 'a1'), null, 'an archived part');
  assert.equal(of(row([], 'waiting')), null);
  assert.equal(of({ ...row([{ kind: 'part', id: 'a1', index: null }]), table: 'C-LINK' }), null, 'only C-PART rows bind');
});

test('B50-3 a later ask says what the B IDs of its records are on the map (partRows); map.6 and earlier asks are unchanged', () => {
  const first = firstRead(project(page1())), p = paste(first.project, page2('배달기')), inp = ask7(p), ask = inp.ask;
  const two = ask.records.find(r => M.askRecords(ask).get(r.id).text.includes('|B07|')), one = ask.records.find(r => r !== two);
  const id = n => aliasOf(inp, areaOf(p, n));
  // Page 2 names B01 and B06 by ID only: they are bound to their cards. B07's own C-PART row goes with it (named there, not yet bound).
  assert.deepEqual(two.partRows, [{ id: 'B01', name: '수집기', part: id('수집기') }, { id: 'B06', name: '화면', part: id('화면') }]);
  // Page 1's re-sent rows (LN17, LN18, IS01, IS02) cite bound parts whose C-PART rows do not go again.
  assert.ok(one.partRows.length >= 3 && one.partRows.every(x => x.part && NAMES.includes(x.name)), JSON.stringify(one.partRows));
  assert.ok(!M.askRecords(ask).get(one.id).text.split(/\r?\n/).some(l => l.startsWith('|B03|')), 'the bound C-PART row itself is not sent again');
  assert.doesNotThrow(() => M.validateMapAsk(structuredClone(ask)));
  const bad = mutate => { const q = structuredClone(ask); mutate(q.records.find(r => r.partRows)); return () => M.validateMapAsk(q); };
  assert.throws(bad(r => { r.partRows[0].part = 'P99'; }), 'a part of the ask');
  assert.throws(bad(r => { r.partRows.push(structuredClone(r.partRows[0])); }), 'each B once');
  assert.throws(bad(r => { r.partRows[0].id = 'LN01'; }));
  assert.throws(bad(r => { r.partRows[0].name = 'x'.repeat(61); }));
  assert.throws(bad(r => { r.partRows[0].extra = 1; }));
  assert.throws(() => { const q = structuredClone(ask); q.schemaVersion = M.MAP6_SCHEMA; return M.validateMapAsk(q); }, 'map.7 only');
  // A map.6 ask of the same project, and a job round trip.
  const six = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA);
  assert.ok(six.ask.records.every(r => !Object.hasOwn(r, 'partRows')));
  assert.deepEqual(J.decodeMapInput(J.encodeMapInput(inp)).ask, ask);
  assert.equal(M.ROW_BINDING, 'row-binding.1');
});

test('B50-4 a new part on a bound C-PART row is read as that part, by ID: nothing new is made, the row stays its part\'s', () => {
  const first = firstRead(project(page1()));
  // The person pastes page 1 again; the record now calls B01 「수집 서비스」 (no name likeness with 수집기).
  const p = paste(first.project, page1({ names: ['수집 서비스', ...NAMES.slice(1)] })), inp = ask7(p), ask = inp.ask, rec = ask.records.find(r => M.askRecords(ask).get(r.id).text.includes('수집 서비스')).id;
  const wire = reply7({ parts: [newPart('new:s', '수집 서비스', at(ask, '|B01|', rec), { claims: [claim(at(ask, '|B01|', rec), 's1', '수집 서비스가 원문을 모은다.')] }), newPart('new:k', '새 하위', at(ask, '|IS01|', rec), { parent: 'new:s' })] });
  const applied = M.applyReading(p, inp, M.validateMapReply(wire, ask), meta('R_bind50b', 'b'));
  const area = areaOf(p, '수집기');
  assert.ok(!applied.project.space.areas.some(a => a.name === '수집 서비스'), 'no duplicate');
  const entry = applied.reading.parts.find(x => x.areaId === area);
  assert.ok(entry && entry.created === null && entry.role === null && entry.claims.length === 1 && entry.basis.length === 1);
  assert.equal(applied.project.space.containment.parents[areaOf(applied.project, '새 하위')], area, 'a child of it goes under the part');
  const led = ledgerOf(applied.project), b01 = led.get(L.ledgerKey(KEY, 'C-PART', 'B01'));
  assert.deepEqual([b01.state, b01.to.find(t => t.kind === 'part').id], ['reflected', area]);
  assert.deepEqual(validateProject(JSON.parse(serializeProject(applied.project))), JSON.parse(serializeProject(applied.project)));
});

test('B50-5 names alike raise an identity candidate and hold the part with its relations; the hold lifts when that part changes', () => {
  // Unit: qualifiers in brackets left out, case and spacing folded; different qualifiers stay apart.
  for (const [a, b] of [['주기 일정', '주기 일정(작업 예약)'], ['Cache', 'cache'], ['작업 큐', '작업큐'], ['수집기', '수집기 (백그라운드)']]) assert.ok(M.likeNames(a, b), `${a} ~ ${b}`);
  for (const [a, b] of [['설정 (서버)', '설정 (클라이언트)'], ['웹 화면', '웹 API'], ['A', 'A (x)']]) assert.ok(!M.likeNames(a, b), `${a} ≁ ${b}`);
  const first = firstRead(project(page1())), p = paste(first.project, page2('수집기(백그라운드)')), inp = ask7(p), ask = inp.ask;
  const rec = ask.records.find(r => M.askRecords(ask).get(r.id).text.includes('|B07|')).id, ref = n => aliasOf(inp, areaOf(p, n));
  const wire = reply7({ parts: [newPart('new:bg', '수집기(백그라운드)', at(ask, '|B07|', rec))],
    relations: [{ from: ref('수집기'), to: 'new:bg', kind: 'flow', note: '자료 19', at: at(ask, '|LN19|', rec) }, { from: 'new:bg', to: ref('화면'), kind: 'flow', note: '자료 20', at: at(ask, '|LN20|', rec) }] });
  const applied = M.applyReading(p, inp, M.validateMapReply(wire, ask), meta('R_bind50c', 'c')), r = applied.reading;
  const near = areaOf(p, '수집기'), screen = areaOf(p, '화면');
  assert.equal(applied.created.length, 0, 'held, never created'); assert.equal(applied.project.space.areas.length, p.space.areas.length, 'never merged either');
  assert.deepEqual(r.skipped.filter(x => x.what === 'part'), [{ what: 'part', name: '수집기(백그라운드)', reason: 'same-name' }]);
  const [own, ...lines] = r.candidates;
  assert.ok(own.text.startsWith('‘수집기(백그라운드)’:') && own.target === 'identity' && own.areaIds[0] === near);
  assert.equal(lines.length, 2, 'its two relations are kept as candidates');
  assert.deepEqual(lines.map(c => c.areaIds), [[near], [near, screen]]);
  assert.ok(lines.every(c => c.target === 'identity' && c.quote.record && /관계/.test(c.text)));
  const rows = rowsOf(r);
  for (const id of ['C-PART B07', 'C-LINK LN19', 'C-LINK LN20']) assert.deepEqual([rows[id].state, rows[id].reason, rows[id].with[0]], ['held', 'identity', near], id);
  assert.deepEqual(validateProject(JSON.parse(serializeProject(applied.project))), JSON.parse(serializeProject(applied.project)));
  // Held rows are not sent again (the same conflict is not asked again) ...
  const next = ask7(applied.project), sent = [...M.askRecords(next.ask).values()].map(x => x.text).join('\n');
  assert.ok(!sent.includes('|B07|') && !sent.includes('|LN19|') && !sent.includes('|LN20|'));
  // ... until a later reading writes on the part they are held with: then they wait and go again.
  const changed = M.applyReading(applied.project, next, M.validateMapReply(reply7({ parts: [oldPart(aliasOf(next, near), { claims: [claim(at(next.ask, '|IS01|'), 's1')] })] }), next.ask), meta('R_bind50d', 'd'));
  const x = ledgerOf(changed.project).get(L.ledgerKey(KEY, 'C-PART', 'B07'));
  assert.deepEqual([x.state, x.reason, x.detail], ['waiting', 'transient', 'identity']);
  const again = [...M.askRecords(ask7(changed.project).ask).values()].map(y => y.text).join('\n');
  assert.ok(again.includes('|B07|') && again.includes('|LN19|') && again.includes('|LN20|'));
  // The first map keeps the exact rule only (a part named like a person's own part is made there).
  const fresh = project(page1({ names: ['기존 부분 (사본)'], pairs: [] })), six = M.buildMapAsk(fresh, studioView(fresh), [], undefined, M.MAP6_SCHEMA);
  assert.equal(six.ask.schemaVersion, M.MAP6_SCHEMA);
});

test('B50-6 a part read as built ends an older unbuilt state and the claims on that unbuilt row; a claim on another row stays', () => {
  const p0 = project(page1({ impl: k => k === 0 ? '미구현' : '구현됨' })), inp = ask7(p0), ask = inp.ask;
  const wire = reply7({ parts: NAMES.map((n, k) => newPart(`new:b${k + 1}`, n, at(ask, `|B${pad(k + 1)}|`), k === 0 ? { claims: [claim(at(ask, '|B01|'), 's1', '수집기는 아직 없다.'), claim(at(ask, '|LN01|'), 's2', '수집기가 정리기에 자료를 넘긴다.')] } : {})) });
  const first = M.applyReading(p0, inp, M.validateMapReply(wire, ask), meta('R_bind50e', 'e')), area = areaOf(first.project, '수집기');
  const before = M.partUnderstanding(first.project, area);
  assert.equal(before.stateRead.state, 'unbuilt'); assert.equal(before.claims.length, 2);
  // The record is pasted again with B01 built; the reply writes on the part by its id.
  const p = paste(first.project, page1()), inp2 = ask7(p), rec = inp2.ask.records.find(r => M.askRecords(inp2.ask).get(r.id).text.includes('|B01|')).id;
  const second = M.applyReading(p, inp2, M.validateMapReply(reply7({ parts: [oldPart(aliasOf(inp2, area), { claims: [claim(at(inp2.ask, '|B01|', rec), 's3', '수집기가 원문을 모은다.')] })] }), inp2.ask), meta('R_bind50f', 'f'));
  const entry = second.reading.parts.find(x => x.areaId === area);
  assert.equal(entry.implementation, 'built');
  const after = M.partUnderstanding(second.project, area);
  assert.equal(after.stateRead, null, 'built ends unbuilt and says nothing of running or checked');
  assert.deepEqual(after.claims.map(c => c.text).sort(), ['수집기가 원문을 모은다.', '수집기가 정리기에 자료를 넘긴다.'].sort(), 'the claim on the unbuilt row ended; the other stays');
  // The later ask says no state for it now.
  assert.equal(ask7(second.project).ask.parts.find(x => x.id === aliasOf(ask7(second.project), area))?.state ?? null, null);
});

test('B50-7 the later prompts say what partRows are; first-map texts unchanged; the recipes name row-binding.1', () => {
  const ask = ask7(paste(firstRead(project(page1())).project, page2('배달기'))).ask;
  const prompt = P.map7Prompt(ask);
  assert.ok(prompt.startsWith(P.MAP7_PROMPT + P.MAP7_COUNTS + P.MAP7_IDENTITY + P.MAP7_ROWS + P.MAP7_VOCABULARY));
  for (const said of ['records[].partRows', 'B ID는 기록마다 따로다', 'part가 있는 B는 그 부분이다', '앱은 그 부분으로 읽는다', '원문 근거가 아니다'])
    assert.ok(P.MAP7_ROWS.includes(said), said);
  assert.ok(B.LATER_BLUEPRINT_PROMPT.endsWith(B.LATER_ROW_RULES) && B.LATER_ROW_RULES.includes('INPUT.records[].partRows') && B.LATER_ROW_RULES.includes('그 B로 new: 부분을 세우지 않는다'));
  assert.ok(!B.MAP_BLUEPRINT_PROMPT.includes('row-binding') && !P.MAP6_FIRST_PROMPT.includes('row-binding') && !P.MAP7_PROMPT.includes('partRows'));
  assert.equal(B.ROW_BINDING_VERSION, 'row-binding.1');
  assert.ok(P.MAP7_RECIPE.startsWith('map7-recipe.8:') && P.MAP7_RECIPE.includes('row-binding.1'));
});

test('B50-R replay: R11\'s ask names R10\'s B IDs on the map, and R11\'s stored reply holds 주기 일정 and keeps 분류 모델 파일\'s relations', { skip: !haveGrowth() || !existsSync(join(GROWTH, 'runs/stage4-r3/job.json')) }, () => {
  const json = f => JSON.parse(readFileSync(join(GROWTH, f), 'utf8'));
  // (1) The R11 ask rebuilt from the state after R10: page 2-5 cite B IDs whose C-PART rows R10 read.
  const { project: p, input } = rebuilt(CASES[2]), rows = input.ask.records.flatMap(r => r.partRows ?? []);
  assert.equal(input.problem, null);
  const bound = rows.filter(x => x.part), open = rows.filter(x => !x.part);
  assert.ok(bound.length >= 8, `${bound.length} B IDs bound to R10's cards`);
  for (const x of bound) assert.equal(p.space.areas.find(a => a.id === input.parts.get(x.part)).name.length > 0, true);
  // Every B ID the sent pages cite is now resolvable in the ask: bound to its card, named in partRows, or its own C-PART row goes (sent
  // again: step 1); .49 sent page 2-5's IDs bare (B06, B33, B04 could not be named).
  const text = [...M.askRecords(input.ask).values()].map(r => r.text).join('\n'), lines = new Set(text.split(/\r?\n/).flatMap(l => /^\|\s*(B\d{1,3})\s*\|/.exec(l)?.[1] ?? []));
  const cited = [...new Set(text.match(/(?<![A-Za-z0-9])B\d{1,3}(?!\d)/g))], named = new Set(rows.map(x => x.id));
  assert.deepEqual(cited.filter(id => !lines.has(id) && !named.has(id)), [], 'no bare B ID');
  assert.ok(lines.has('B06') || named.has('B06'), 'B06 is named though page 1 is not sent again whole');
  assert.ok(new TextEncoder().encode(JSON.stringify(input.ask)).length <= M.MAP_BYTES);
  console.log(`R11 partRows: ${rows.length} (${bound.length} bound, ${open.length} by name): ${rows.slice(0, 12).map(x => `${x.id}=${x.part ?? 'null'} ${x.name}`).join(', ')}`);
  // (2) R11's stored reply applied under .50 on the ask it was written for.
  const p0 = parseProject(JSON.stringify(json('project/state-after-4.pre49.json'))), inp = J.decodeMapInput(json('runs/stage4-r3/input.json').input), job = json('runs/stage4-r3/job.json').body;
  const stored = json('project/state-after-4.json').readings.at(-1);
  const applied = M.applyReading(p0, inp, M.validateMapReply(structuredClone(job.result.wire), inp.ask), { id: stored.id, at: stored.at, model: stored.model, prompt: stored.prompt, hash: stored.hash });
  const r = applied.reading, made = applied.created.map(id => applied.project.space.areas.find(a => a.id === id).name);
  assert.ok(!made.includes('주기 일정'), `주기 일정 is held, not made a second time (made: ${made.join(', ')})`);
  const sched = r.candidates.find(c => c.text.startsWith('‘주기 일정’:'));
  const was = sched ? p0.space.areas.find(a => a.id === sched.areaIds[0]).name : '';
  assert.ok(sched && was !== '주기 일정' && M.likeNames('주기 일정', was), `held with the stage-3 part ${was}`);
  const model = r.candidates.filter(c => /‘분류 모델 파일’이\(가\) 기존 부분/.test(c.text));
  assert.equal(model.length, 3, '분류 모델 파일\'s three relations are candidates, not dropped');
  const held = (r.rows ?? []).filter(x => x.state === 'held' && x.reason === 'identity');
  console.log(`R11 under .50: made ${made.length} (${made.join(', ')}), candidates ${r.candidates.length}, rows held on identity ${held.length}: ${held.map(x => `${x.table} ${x.id}`).join(', ')}`);
  assert.deepEqual(validateProject(JSON.parse(serializeProject(applied.project))), JSON.parse(serializeProject(applied.project)));
});
