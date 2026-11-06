// Recipe .50 (map-reading.20, Astra F5 Q5 and Q7 step 1): the row-processing ledger, the later contract aligned at sixteen relations and
// six claims with every item past a bound named, later maps carrying set-aside reasons, and a replay of a stored growth-run reading.
// Model-free: hand-written replies and, when the run's artefacts are on this machine (AF_GROWTH_DIR), a stored reply.
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

const pad = n => String(n).padStart(2, '0');
const head = n => `〔기록 AF5-50a1b2c3 · 쪽 ${n} · 기준 50c0de1 · 앞 쪽 ${n > 1 ? n - 1 : '—'}〕 원장 시험 기록 v5 (시험 세션, 2026-11-06 10:${pad(n)})`;
const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
const ends = list => table('C-END', list.map(([t, w]) => [t, '끝남', w, '—', '—']));
const NAMES = ['수집기', '정리기', '저장소', '검색기', '알림기', '화면'];
// Eighteen distinct ordered pairs of the six parts (LN01-LN18).
const PAIRS = NAMES.flatMap((_, a) => NAMES.map((_, b) => [a, b])).filter(([a, b]) => a !== b).slice(0, 18);
const PAGE = [head(1), table('C-SRC', [['F01', 'src/', 'B01', '읽음', '코드']]), table('C-EVID', [['E01', '파일', 'F01', 'main()', '연다']]),
  table('C-HEAD', T.HEAD_ITEMS.map((item, k) => [item, `값 ${k + 1}`, 'F01'])), 'C-SUMMARY 요약\n원장 시험 서비스 (F01).',
  table('C-PART', NAMES.map((n, k) => [`B${pad(k + 1)}`, n, '처리 · 계산', `${n}의 일`, 'F01', '구현됨', 'F01'])),
  table('C-LINK', PAIRS.map(([a, b], k) => [`LN${pad(k + 1)}`, `B${pad(a + 1)}`, `B${pad(b + 1)}`, `자료 ${k + 1}`, '호출마다', '—', '같은 프로세스', '정의된 관계', 'F01'])),
  table('C-ISSUE', [['IS01', 'B03', '저장이 가끔 늦음', '모름', 'F01'], ['IS02', 'B04', '검색이 느림', '모름', 'F01']]),
  ends([['C-HEAD', '—'], ['C-PART', 'B01–B06'], ['C-LINK', 'LN01–LN18'], ['C-ISSUE', 'IS01–IS02']]), '완료 단계: 첫 구조 완료'].join('\n');
const meta = (id, h) => ({ id, at: '2026-11-06T02:00:00.000Z', model: 'stub', prompt: 'm7-000000000050', hash: h.repeat(64) });

/** A project with one part of its own (so a reading is a later map.7) and the v5 page pasted. */
function project() {
  let p = D.addArea({ ...D.createProject(), name: '원장 시험' }, '기존 부분', '사람이 만든 부분');
  p = D.pasteRecord(p, PAGE, null).project;
  return parseProject(JSON.stringify(p));
}
const ask7 = p => M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA);
const at = (ask, words) => { for (const r of ask.records) { const s = r.spans.find(x => x.t.trimStart().startsWith(words)); if (s) return s.s; } throw new Error(`no piece ${words}`); };
const part = (ask, k, o = {}) => ({ ref: `new:b${k + 1}`, name: NAMES[k], parent: null, role: `${NAMES[k]}의 일을 맡는다.`, roleAboutAt: null, roleReplaces: null, basis: [at(ask, `|B${pad(k + 1)}|`)], claims: [], ...o });
const line = (ask, k) => { const [a, b] = PAIRS[k]; return { from: `new:b${a + 1}`, to: `new:b${b + 1}`, kind: 'flow', note: `자료 ${k + 1}`, at: at(ask, `|LN${pad(k + 1)}|`) }; };
const claim = (where, key) => ({ kind: 'describes', text: '원문 행이 말하는 내용이다.', at: where, aboutAt: null, replaces: null, key });
const reply7 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const rowsOf = r => Object.fromEntries((r.rows ?? []).map(x => [`${x.table} ${x.id}`, x]));
const ledgerOf = p => L.rowLedger(p, X.v5Folds(p.pasted));

test('L50-1 the later contract takes sixteen relations and six claims; each item past them is set aside on its own, with its row', () => {
  assert.deepEqual([M.MAP7_RELATIONS, M.MAP7_CLAIMS], [16, 6]);
  const p = project(), inp = ask7(p), ask = inp.ask;
  assert.equal(ask.schemaVersion, M.MAP7_SCHEMA);
  // Seven claims on the first part (rows LN01-LN07), eighteen relations (rows LN01-LN18).
  const claims = Array.from({ length: 7 }, (_, j) => claim(at(ask, `|LN${pad(j + 1)}|`), `s${j + 1}`));
  const wire = reply7({ parts: NAMES.map((_, k) => part(ask, k, k === 0 ? { claims } : {})), relations: PAIRS.map((_, k) => line(ask, k)) });
  const reply = M.validateMapReply(structuredClone(wire), ask);
  assert.equal(reply.relations.length, 16); assert.equal(reply.parts[0].claims.length, 6);
  const ex = M.readingExclusions(reply).filter(x => x.category === 'count');
  assert.deepEqual(ex.map(x => x.path), ['parts[0].claims[6]', 'relations[16]', 'relations[17]']);
  for (const x of ex) assert.equal(x.explanation, '허용 개수를 넘어 이 항목을 이번 정리에서 제외했어요.');
  // Each one says where it stood: the row its item quoted.
  const text = M.askRecords(ask).get(ex[0].record).text;
  assert.deepEqual(ex.map(x => text.slice(x.from, x.to).match(/^\|(LN\d\d)\|/)?.[1]), ['LN07', 'LN17', 'LN18']);
  // The prompt says so (right after the base text, which stays as it was), and the recipe is bumped.
  assert.ok(P.map7Prompt(ask).startsWith(P.MAP7_PROMPT + P.MAP7_COUNTS) && P.MAP7_COUNTS.includes('claims는 최대 6개, relations는 최대 16개'));
  assert.ok(P.MAP7_RECIPE.startsWith('map7-recipe.6:'), 'step 3 bumped it again (later-identity.1)');
  // A first map (map.6) keeps its own bounds.
  assert.deepEqual([M.MAP6_RELATIONS, M.MAP6_CLAIMS], [48, 20]);
});

test('L50-2 every row a reading sent gets a state, stored as map-reading.20; older entries and projects load unchanged', () => {
  const p = project(), inp = ask7(p), ask = inp.ask;
  const wire = reply7({ parts: NAMES.map((_, k) => part(ask, k, k === 2 ? { claims: [claim(at(ask, '|IS01|'), 's1')] } : {})), relations: PAIRS.slice(0, 18).map((_, k) => line(ask, k)),
    material: [{ at: at(ask, '|IS02|'), what: '다른 프로그램의 예문' }] });
  const reply = M.validateMapReply(structuredClone(wire), ask), applied = M.applyReading(p, inp, reply, meta('R_ledger50a', 'a'));
  assert.equal(applied.reading.version, 'map-reading.20');
  const rows = rowsOf(applied.reading);
  for (let k = 1; k <= 6; k++) assert.deepEqual([rows[`C-PART B${pad(k)}`].state, rows[`C-PART B${pad(k)}`].to[0].kind], ['reflected', 'part']);
  for (let k = 1; k <= 16; k++) assert.equal(rows[`C-LINK LN${pad(k)}`].to[0].kind, 'relation', `LN${pad(k)}`);
  // Past the sixteen relations: waiting on the limit, never silently cut. The issue row became a claim; the material one is rejected.
  for (const k of [17, 18]) assert.deepEqual([rows[`C-LINK LN${k}`].state, rows[`C-LINK LN${k}`].reason], ['waiting', 'limit']);
  assert.deepEqual(rows['C-ISSUE IS01'].to, [{ kind: 'claim', id: applied.reading.parts.find(x => x.created?.name === NAMES[2]).areaId, index: 0 }]);
  assert.deepEqual([rows['C-ISSUE IS02'].state, rows['C-ISSUE IS02'].reason], ['rejected', 'material']);
  assert.ok(Object.values(rows).every(x => x.sent === 1));
  // Stored exactly; a .19 entry holds no rows and a .20 entry needs them well formed.
  const raw = serializeProject(applied.project);
  assert.deepEqual(validateProject(JSON.parse(raw)), JSON.parse(raw));
  const bad = mutate => { const q = JSON.parse(raw); mutate(q.readings.at(-1)); return () => validateProject(q); };
  assert.throws(bad(r => { r.version = 'map-reading.19'; }));
  assert.throws(bad(r => { r.rows[0].state = 'parsed'; }));
  assert.throws(bad(r => { r.rows[0].reason = 'limit'; }), 'reflected has no reason');
  assert.throws(bad(r => { r.rows.push(structuredClone(r.rows[0])); }), 'each row once');
  assert.throws(bad(r => { const x = r.rows.find(y => y.state === 'waiting'); x.reason = 'later'; }));
  // A project written before .50 (its readings .19) loads byte for byte and is read by the same rule.
  const old = JSON.parse(raw), r19 = old.readings.at(-1); r19.version = 'map-reading.19'; delete r19.rows;
  assert.deepEqual(validateProject(structuredClone(old)), old);
  const derived = ledgerOf(parseProject(JSON.stringify(old))), stored = ledgerOf(applied.project);
  for (const [k, x] of stored) assert.deepEqual([derived.get(k).state, derived.get(k).reason], [x.state, x.reason], k);
  // A reading of no v5 record stays map-reading.19 exactly.
  let q = D.addArea(D.createProject(), '부분', ''); q = D.pasteRecord(q, '보고: 부분이 파일을 저장한다.', null).project;
  const plain = M.buildMapAsk(q, studioView(q), [], undefined, M.MAP7_SCHEMA), pr = M.validateMapReply(reply7({ parts: [{ ref: 'P01', name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [], claims: [claim(plain.ask.records[0].spans[0].s, 's1')] }] }), plain.ask);
  const pa = M.applyReading(q, plain, pr, meta('R_ledger50plain', 'b'));
  assert.equal(pa.reading.version, 'map-reading.19'); assert.ok(!Object.hasOwn(pa.reading, 'rows'));
});

test('L50-3 what was read no longer hides a row that was sent but not placed: it goes again, named, and a quote on it is fresh', () => {
  const p = project(), inp = ask7(p), ask = inp.ask;
  const first = M.applyReading(p, inp, M.validateMapReply(reply7({ parts: NAMES.map((_, k) => part(ask, k)), relations: PAIRS.map((_, k) => line(ask, k)) }), ask), meta('R_ledger50b', 'c'));
  // Before .50 the page counted as read: nothing new. Now LN17, LN18 (limit) and the issue rows (transient) go again, and nothing placed.
  const again = ask7(first.project);
  assert.equal(again.problem, null); assert.equal(again.coverage.fresh, 1);
  const note = again.ask.records[0].note, sent = M.askRecords(again.ask).get(again.ask.records[0].id).text;
  assert.ok(/앞선 정리에서 반영되지 않아 다시 보낸 행 4개: C-LINK LN17·LN18, C-ISSUE IS01·IS02/.test(note), note);
  for (const id of ['LN17', 'LN18', 'IS01', 'IS02']) assert.ok(sent.includes(`|${id}|`), id);
  for (const id of ['B01', 'LN01', 'LN16']) assert.ok(!sent.split(/\r?\n/).some(l => l.startsWith(`|${id}|`)), `${id} was placed: never again`);
  assert.ok(sent.includes('|F01|'), 'with the ledger rows they cite');
  // The reply draws the two lines on the existing parts: their quotes are fresh (inside the earlier read interval) and the rows reflected.
  const ids = new Map(first.project.space.areas.map(a => [a.name, a.id])), alias = new Map([...again.parts].map(([k, v]) => [v, k]));
  const ref = n => alias.get(ids.get(NAMES[n]));
  const lines = [16, 17].map(k => ({ from: ref(PAIRS[k][0]), to: ref(PAIRS[k][1]), kind: 'flow', note: `자료 ${k + 1}`, at: at(again.ask, `|LN${k + 1}|`) }));
  const second = M.applyReading(first.project, again, M.validateMapReply(reply7({ relations: lines }), again.ask), meta('R_ledger50c', 'd'));
  assert.equal(second.reading.relations.length, 2);
  const rows = rowsOf(second.reading);
  assert.deepEqual([rows['C-LINK LN17'].state, rows['C-LINK LN18'].state, rows['C-LINK LN17'].sent], ['reflected', 'reflected', 2]);
  assert.deepEqual([rows['C-ISSUE IS01'].state, rows['C-ISSUE IS01'].reason, rows['C-ISSUE IS01'].sent], ['waiting', 'transient', 2]);
  const led = ledgerOf(second.project);
  assert.ok([...led.values()].filter(x => x.table === 'C-PART' || x.table === 'C-LINK').every(x => x.state === 'reflected'));
});

test('L50-4 re-sending is bounded: a row sent three times and never placed is rejected (unplaced) and never goes again', () => {
  let p = project(), inp = ask7(p);
  p = M.applyReading(p, inp, M.validateMapReply(reply7({ parts: NAMES.map((_, k) => part(inp.ask, k)), relations: PAIRS.slice(0, 16).map((_, k) => line(inp.ask, k)) }), inp.ask), meta('R_ledger50d', '1')).project;
  const seen = [];
  for (const h of ['2', '3', '4']) {
    const next = ask7(p); if (next.problem) { seen.push(next.problem); break; }
    seen.push(M.askRecords(next.ask).get(next.ask.records[0].id).text.match(/\|(LN\d\d|IS\d\d)\|/g).join(''));
    p = M.applyReading(p, next, M.validateMapReply(reply7({}), next.ask), meta(`R_ledger50${h}`, h)).project;
  }
  assert.deepEqual(seen, ['|LN17||LN18||IS01||IS02|', '|LN17||LN18||IS01||IS02|', 'NOTHING_NEW']);
  const led = ledgerOf(p), x = k => led.get(L.ledgerKey('AF5-50a1b2c3@50c0de1', ...k.split(' ')));
  assert.deepEqual([x('C-ISSUE IS01').state, x('C-ISSUE IS01').reason, x('C-ISSUE IS01').sent], ['rejected', 'unplaced', 3]);
  assert.deepEqual([x('C-LINK LN17').state, x('C-LINK LN17').reason], ['rejected', 'unplaced']);
  assert.deepEqual(validateProject(JSON.parse(serializeProject(p))), JSON.parse(serializeProject(p)));
});

test('L50-5 a row an undecided candidate stands on is held with the parts it names; rows naming a held part wait on it, then follow it', () => {
  const p = project(), inp = ask7(p), ask = inp.ask, own = [...inp.parts.keys()][0];
  // B06 is not placed: a candidate asks whether it is the person's own part; LN rows naming B06 cannot be drawn.
  const wire = reply7({ parts: NAMES.slice(0, 5).map((_, k) => part(ask, k)),
    relations: PAIRS.map((pr, k) => [pr, k]).filter(([[a, b]]) => a !== 5 && b !== 5).slice(0, 16).map(([, k]) => line(ask, k)),
    candidates: [{ text: '화면이 기존 부분과 같은 대상인지 원문만으로 가를 수 없다.', target: 'identity', parts: [own, 'new:b1'], at: at(ask, '|B06|'), statement: null }] });
  const applied = M.applyReading(p, inp, M.validateMapReply(wire, ask), meta('R_ledger50e', 'e')), rows = rowsOf(applied.reading);
  assert.deepEqual([rows['C-PART B06'].state, rows['C-PART B06'].reason], ['held', 'identity']);
  assert.equal(rows['C-PART B06'].with.length, 2);
  const dependent = PAIRS.findIndex(([a, b]) => a === 5 || b === 5), id = `C-LINK LN${pad(dependent + 1)}`;
  assert.deepEqual([rows[id].state, rows[id].reason], ['waiting', 'unresolved-endpoint']);
  const led = ledgerOf(applied.project), x = led.get(L.ledgerKey('AF5-50a1b2c3@50c0de1', 'C-LINK', `LN${pad(dependent + 1)}`));
  assert.deepEqual([x.state, x.reason, x.with], ['held', 'depends', rows['C-PART B06'].with], 'the ledger carries the held part to the rows on it');
  // Held rows never go again (the same conflict is not asked again); waiting ones do.
  const next = ask7(applied.project), sent = next.problem ? '' : M.askRecords(next.ask).get(next.ask.records[0].id).text;
  assert.ok(!sent.includes('|B06|') && !sent.includes(`|LN${pad(dependent + 1)}|`));
});

test('L50-6 a later map carries the server\'s set-aside reasons to the browser (attachExclusions takes map.7 under the same checks)', () => {
  const p = project(), inp = ask7(p), ask = inp.ask, rec = ask.records[0].id;
  const reply = M.validateMapReply(reply7({ parts: [part(ask, 0)] }), ask);
  const reason = { path: 'parts[0].claims', rule: 'contract', category: 'count', explanation: M.explainExclusion('parts[0].claims', 'contract', 'count'), record: rec, from: 0, to: 5 };
  M.attachExclusions(reply, [reason], ask);
  assert.deepEqual(M.readingExclusions(reply)[0], reason);
  for (const bad of [[{ ...reason, explanation: '아무 말' }], [{ ...reason, record: 'N09' }], [{ ...reason, rule: 'unknown' }]]) assert.throws(() => M.attachExclusions(M.validateMapReply(reply7({ parts: [part(ask, 0)] }), ask), bad, ask));
  // A job's result round trip: the input decodes and the reading keeps the reason where it stood.
  const wire = J.decodeMapInput(J.encodeMapInput(inp)), applied = M.applyReading(p, wire, reply, meta('R_ledger50f', 'f'));
  assert.ok(applied.reading.exclusions.some(x => x.path === 'parts[0].claims' && x.category === 'count'));
});

// The growth run's stored artefacts (a reading made on a later page of a v5 record, recipe .49): replayed under .50 when present.
const GROWTH = process.env.AF_GROWTH_DIR ?? '';
test('L50-R replay: a stored later reading keeps its sixteen relations under .50, each row gets a state, and the unplaced part rows go again', { skip: !GROWTH || !existsSync(join(GROWTH, 'runs/stage4-r3/job.json')) }, () => {
  const json = f => JSON.parse(readFileSync(join(GROWTH, f), 'utf8'));
  const p = parseProject(JSON.stringify(json('project/state-after-4.pre49.json'))), inp = J.decodeMapInput(json('runs/stage4-r3/input.json').input), job = json('runs/stage4-r3/job.json').body;
  const stored = json('project/state-after-4.json').readings.at(-1);
  const reply = M.validateMapReply(structuredClone(job.result.wire), inp.ask);
  assert.equal(job.result.wire.relations.length, 16); assert.equal(reply.relations.length, 16, 'none cut by position (.49 kept twelve)');
  const applied = M.applyReading(p, inp, reply, { id: stored.id, at: stored.at, model: stored.model, prompt: stored.prompt, hash: stored.hash });
  assert.ok(applied.reading.relations.length > stored.relations.length, `${applied.reading.relations.length} lines drawn (.49: ${stored.relations.length})`);
  assert.equal(applied.reading.version, 'map-reading.20');
  const led = ledgerOf(applied.project), parts = [...led.values()].filter(x => x.table === 'C-PART' && x.record === applied.reading.rows[0].record);
  assert.ok(parts.length >= 30 && parts.every(x => ['reflected', 'waiting', 'held', 'rejected'].includes(x.state)));
  const waiting = parts.filter(x => x.state === 'waiting').map(x => x.id);
  assert.ok(waiting.length > 0);
  const next = ask7(applied.project);
  assert.equal(next.problem, null);
  assert.ok(new TextEncoder().encode(JSON.stringify(next.ask)).length <= M.MAP_BYTES);
  const all = [...M.askRecords(next.ask).values()].map(r => r.text).join('\n');
  for (const id of waiting.slice(0, 8)) assert.ok(all.includes(`| ${id} |`) || all.includes(`|${id}|`), `${id} goes again`);
});
