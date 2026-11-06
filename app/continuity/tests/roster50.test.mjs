// Recipe .50 step 5 (기록 요청 v5.2, Astra F5 Q1–Q3, Q5, Q6, Q7(5)): the map's roster in the record ask, the record's C-IDENT table read by
// the program alone (never sent), and its operations: bind, rename (old name kept, a person's name stays shown), retire with a successor
// (only in effect and whole), and folding a duplicate the map made onto one canonical part (its P ID still resolves). No model is called;
// the replay (AF_GROWTH_DIR) uses the stored states of the growth run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as I from '../dist/public/shared/map-identity.js';
import * as R from '../dist/public/shared/report-ask.js';
import * as T from '../dist/public/shared/record-table.js';
import * as X from '../dist/public/shared/record-excerpt.js';
import * as L from '../dist/public/shared/row-ledger.js';
import { parseProject, validateProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';
import * as P from '../server/map-prompt.mjs';

const GROWTH = process.env.AF_GROWTH_DIR ?? '';
const pad = n => String(n).padStart(2, '0');
const A = 'AF5-50a1b2c3', A_BASIS = '50c0de1', B = 'AF5-50e1e2e3', B_BASIS = 'e0c0de3';
const headOf = (record, basis, n) => `〔기록 ${record} · 쪽 ${n} · 기준 ${basis} · 앞 쪽 ${n > 1 ? n - 1 : '—'}〕 대장 시험 기록 v5 (시험 세션, 2026-11-06 12:${pad(n)})`;
const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
const ends = list => table('C-END', list.map(([t, w]) => [t, '끝남', w, '—', '—']));
const partRow = (id, name, impl = '구현됨') => [id, name, '처리 · 계산', `${name}의 일`, 'F01', impl, 'F01'];
const linkRow = (id, a, b, what) => [id, a, b, what, '호출마다', '—', '같은 프로세스', '정의된 관계', 'F01'];
const NAMES = ['수집기', '정리기', '저장소', '검색기', '알림기', '화면'];
const PAIRS = NAMES.flatMap((_, a) => NAMES.map((_, b) => [a, b])).filter(([a, b]) => a !== b).slice(0, 16);
const ledgers = [table('C-SRC', [['F01', 'src/', 'B01', '읽음', '코드'], ['F02', 'docs/', '전체', '읽음', '문서']]), table('C-EVID', [['E01', '보고', 'c0ffee2 커밋', '—', '옮김']])];
/** Page 1 of a record: ledgers, head, its C-PART rows, its C-LINK rows and, given a roster line and rows, its C-IDENT table right after C-PART. */
function page1({ record = A, basis = A_BASIS, names = NAMES, pairs = PAIRS, impl = () => '구현됨', ident = null } = {}) {
  return [headOf(record, basis, 1), ...ledgers, table('C-HEAD', T.HEAD_ITEMS.map((item, k) => [item, `값 ${k + 1}`, 'F01'])), 'C-SUMMARY 요약\n대장 시험 서비스 (F01).',
    table('C-PART', names.map((n, k) => partRow(`B${pad(k + 1)}`, n, impl(k)))), ...(ident ? [identTable(ident.echo, ident.rows)] : []),
    ...(pairs.length ? [table('C-LINK', pairs.map(([a, b], k) => linkRow(`LN${pad(k + 1)}`, `B${pad(a + 1)}`, `B${pad(b + 1)}`, `자료 ${k + 1}`)))] : []),
    ends([['C-HEAD', '—'], ['C-PART', `B01–B${pad(names.length)}`], ...(ident ? [['C-IDENT', `ID01–ID${pad(ident.rows.length)}`]] : []), ...(pairs.length ? [['C-LINK', `LN01–LN${pad(pairs.length)}`]] : [])]), '완료 단계: 첫 구조 완료'].join('\n');
}
/** A C-IDENT table: its title, the reply's copy of the roster line, its header and rows. */
const identTable = (echo, rows) => [`C-IDENT ${T.IDENT_TABLE.title}`, ...(echo ? [`대장: ${echo}`] : []), T.headerLine(T.IDENT_TABLE), '|---|---|---|---|---|---|', ...rows.map((r, k) => `|ID${pad(k + 1)}|${r.join('|')}|`)].join('\n');
/** A later page of a record that holds only a C-IDENT table. */
const identPage = (record, basis, n, echo, rows) => [headOf(record, basis, n), identTable(echo, rows), ends([['C-IDENT', `ID01–ID${pad(rows.length)}`]]), '완료 단계: 첫 구조 완료'].join('\n');
const meta = (id, h) => ({ id, at: '2026-11-06T04:00:00.000Z', model: 'stub', prompt: 'm7-000000000050', hash: h.repeat(64) });
function project(...pages) {
  let p = D.addArea({ ...D.createProject(), name: '대장 시험' }, '기존 부분', '사람이 만든 부분');
  for (const t of pages) p = D.pasteRecord(p, t, null).project;
  return parseProject(JSON.stringify(p));
}
const paste = (p, t) => parseProject(JSON.stringify(D.pasteRecord(p, t, null).project));
const ask7 = p => M.buildMapAsk(p, I.currentView(p, studioView(p)), [], undefined, M.MAP7_SCHEMA);
const at = (ask, words, rec) => { for (const r of ask.records) { if (rec && r.id !== rec) continue; const s = r.spans.find(x => x.t.trimStart().startsWith(words)); if (s) return s.s; } throw new Error(`no piece ${words}`); };
const recOf = (ask, words) => ask.records.find(r => M.askRecords(ask).get(r.id).text.includes(words)).id;
const newPart = (ref, name, basis, o = {}) => ({ ref, name, parent: null, role: `${name}의 일을 맡는다.`, roleAboutAt: null, roleReplaces: null, basis: [basis], claims: [], ...o });
const claim = (where, key, text = '원문 행이 말하는 내용이다.') => ({ kind: 'describes', text, at: where, aboutAt: null, replaces: null, key });
const reply7 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const areaOf = (p, name) => p.space.areas.find(a => a.name === name && !a.archived)?.id;
const pidOf = (p, name) => I.partNumber(p, areaOf(p, name));
const aliasOf = (inp, id) => [...inp.parts].find(([, v]) => v === id)?.[0];
const rowsById = r => Object.fromEntries((r.identity ?? []).map(x => [x.id, x]));
const roundTrip = p => assert.deepEqual(validateProject(JSON.parse(serializeProject(p))), JSON.parse(serializeProject(p)));
/** The first reading of record A: the six parts on their C-PART rows, the sixteen lines. P01 is the person's part, P02…P07 these six. */
function firstRead(p) {
  const inp = ask7(p), ask = inp.ask;
  const wire = reply7({ parts: NAMES.map((n, k) => newPart(`new:b${k + 1}`, n, at(ask, `|B${pad(k + 1)}|`))),
    relations: PAIRS.map(([a, b], k) => ({ from: `new:b${a + 1}`, to: `new:b${b + 1}`, kind: 'flow', note: `자료 ${k + 1}`, at: at(ask, `|LN${pad(k + 1)}|`) })) });
  return M.applyReading(p, inp, M.validateMapReply(wire, ask), meta('R_ros50a', 'a')).project;
}
/** Record B, a later session's record with the roster's C-IDENT rows: 수집 서비스 (renamed 수집기), 정리기, 새 저장소 (replaces 저장소), 검색기, 웹 화면. */
const B_NAMES = ['수집 서비스', '정리기', '새 저장소', '검색기', '웹 화면'];
const recordB = (echo, rows, o = {}) => page1({ record: B, basis: B_BASIS, names: B_NAMES, pairs: [], ident: { echo, rows }, ...o });

test('R50-1 the record ask: v5.1 unchanged without a map; v5.2 carries the roster and C-IDENT right after C-PART, whose header parses clean', () => {
  const plain = R.recordAskV5('AF5-12345678');
  assert.ok(plain.startsWith('[AgentFlow 기록 요청 v5.1]') && !plain.includes('C-IDENT') && !plain.includes('지도 대장'), 'no map: v5.1 as it was');
  assert.equal(R.RECORD_ASK_V5_VERSION, 'v5.1'); assert.equal(R.RECORD_ASK_V52_VERSION, 'v5.2');
  const p = firstRead(project(page1())), roster = I.mapRoster(p), ask = R.recordAskV5('AF5-12345678', roster);
  assert.ok(ask.startsWith('[AgentFlow 기록 요청 v5.2]'));
  assert.ok(ask.includes(`\n${roster.text}\n`) && roster.text.startsWith(`[대장] 프로젝트 ${p.id} · 판 1 · 해시 ${roster.hash} · P01–P07\n범위: 전체 7개\n`));
  const cpart = ask.indexOf('\nC-PART 부분\n'), ident = ask.indexOf('\nC-IDENT 지도 대응\n'), group = ask.indexOf('\nC-GROUP 묶음\n');
  assert.ok(cpart > 0 && cpart < ident && ident < group, 'C-IDENT right after C-PART');
  assert.ok(ask.includes(`\n${T.headerLine(T.IDENT_TABLE)}\n행 ID ID01. C-PART 바로 다음에`), 'its header and row-ID form');
  for (const w of ['같음', '이름 바뀜', '대신함', '없어짐', '모름', '「계획」', '「일부: 무엇」', '근거 없는 대응은 후보로만', '기준 커밋이 다르다는 것만으로 다른 대상이 아니고', 'git log --follow', 'P ID는 이 표에만 쓴다'])
    assert.ok(ask.includes(w), w);
  // Nothing else of the request changed: v5.2 is v5.1 with the roster section and the C-IDENT section added.
  const back = ask.replace('[AgentFlow 기록 요청 v5.2]', '[AgentFlow 기록 요청 v5.1]').replace(/\n\n지도 대장\n[\s\S]*?\n\n지어내지 마/, '\n\n지어내지 마').replace(/\n\nC-IDENT 지도 대응\n[\s\S]*?(?=\n\nC-GROUP)/, '');
  assert.equal(back, plain);
  assert.deepEqual(T.readRecordTables(`${headOf(B, B_BASIS, 1)}\nC-IDENT 지도 대응\n대장: ${roster.head}\n${T.headerLine(T.IDENT_TABLE)}\n|---|---|---|---|---|---|\n|ID01|P02|같음|B01|—|F01|`).diagnostics, []);
  // The roster line the reply copies is read back.
  const f = X.v5Folds([{ id: 'x', text: recordB(roster.head, [['P02', '같음', 'B02', '—', 'F01']]) }])[0];
  assert.deepEqual(I.rosterEcho(f.fold.rows.get('C-IDENT')), { project: p.id, revision: 1, hash: roster.hash, count: 7, listed: null });
  assert.equal(I.ROSTER_VERSION, 'map-roster.2');
});

test('R50-2 the roster stays within its budget: a 56-part map whole; a larger one cut to its first parts and says so', () => {
  const big = n => { let p = D.addArea({ ...D.createProject(), name: '큰 지도' }, '뿌리', ''); for (let i = 1; i < n; i++) p = D.addChildArea(p, p.space.areas[0].id, `부분 이름 ${String(i).padStart(3, '0')} 처리기`, ''); return parseProject(JSON.stringify(p)); };
  const r56 = I.mapRoster(big(56));
  assert.equal(r56.scope, 'full'); assert.equal(r56.shown, 56); assert.ok(r56.text.length <= I.ROSTER_CHARS, String(r56.text.length));
  assert.ok(r56.text.split('\n').includes('P02 부분 이름 001 처리기 · P01 안 · 있음'));
  const r200 = I.mapRoster(big(300));
  assert.equal(r200.scope, 'partial'); assert.ok(r200.text.length <= I.ROSTER_CHARS && r200.shown < 300 && r200.shown > 100, `${r200.shown} ${r200.text.length}`);
  assert.ok(r200.text.split('\n')[1].startsWith(`범위: 일부 ${r200.shown}/300개(P01–P${pad(r200.shown)}만; 나머지 부분은 C-IDENT에 쓰지 않는다)`));
  // Detail for the parts the session is about, within its own bound; the hash does not depend on it.
  const p = firstRead(project(page1())), withDetail = I.mapRoster(p, { detail: [areaOf(p, '수집기')] });
  assert.ok(withDetail.text.includes('\n  └ 역할: 수집기의 일을 맡는다.'), withDetail.text);
  assert.equal(withDetail.hash, I.mapRoster(p).hash);
  assert.equal(I.mapRoster(project()).entries.length, 1, 'a person-made part is on the roster too');
  assert.equal(I.mapRoster(parseProject(JSON.stringify(D.createProject()))), null, 'no map, no roster');
});

test('R50-3 C-IDENT is never sent; its 같음 and 이름 바뀜 rows bind B rows (partRows), its rows are decided and stored, rename keeps the old name and a person\'s name', () => {
  let p = firstRead(project(page1()));
  p = parseProject(JSON.stringify(D.editArea(p, areaOf(p, '화면'), '내 화면', '')));   // the person names 화면 their own way
  const roster = I.mapRoster(p);
  const rows = [['P02', '이름 바뀜', 'B01', 'c0ffee1 2026-10-02', 'F01'], ['P03', '같음', 'B02', '—', 'F01'], ['P04', '대신함', 'B03', 'c0ffee2 2026-10-03', 'E01'],
    ['P05', '모름', '—', '—', '모름'], ['P06', '없어짐', '—', 'c0ffee3 2026-10-04', 'E01'], ['P07', '이름 바뀜', 'B05', '—', 'F01'], ['P01', '같음', 'B04', '—', '추정'],
    ['P99', '같음', 'B02', '—', 'F01'], ['P03', '나뉨', 'B02', '—', 'F01'], ['P03', '바뀜', 'B02', '—', 'F01']];
  p = paste(p, recordB(roster.head, rows));
  const inp = ask7(p), ask = inp.ask, rec = recOf(ask, '|B03|새 저장소|');
  const sent = [...M.askRecords(ask).values()].map(r => r.text).join('\n');
  assert.ok(!sent.includes('C-IDENT 지도 대응') && !sent.includes('|ID01|') && !sent.includes('대장:'), 'the C-IDENT table is the program\'s, never sent');
  const rowsOfB = ask.records.find(r => r.id === rec).partRows;
  assert.deepEqual(rowsOfB, [{ id: 'B01', name: '수집 서비스', part: aliasOf(inp, areaOf(p, '수집기')) }, { id: 'B02', name: '정리기', part: aliasOf(inp, areaOf(p, '정리기')) },
    { id: 'B05', name: '웹 화면', part: aliasOf(inp, areaOf(p, '내 화면')) }], 'bound by the record\'s own table before any reading of it');
  // The reply makes a new part on each of B01, B03 and B05: B01 and B05 are read as their parts (not made); B03 is the successor.
  const wire = reply7({ parts: [newPart('new:c', '수집 서비스', at(ask, '|B01|', rec), { claims: [claim(at(ask, '|B01|', rec), 's1', '수집 서비스가 원문을 모은다.')] }),
    newPart('new:s', '새 저장소', at(ask, '|B03|', rec)), newPart('new:w', '웹 화면', at(ask, '|B05|', rec))] });
  const applied = M.applyReading(p, inp, M.validateMapReply(wire, ask), meta('R_ros50b', 'b')), q = applied.project, r = applied.reading;
  assert.deepEqual(applied.created.map(id => q.space.areas.find(a => a.id === id).name), ['새 저장소'], 'only the successor is new');
  const d = rowsById(r), succ = areaOf(q, '새 저장소');
  assert.deepEqual(Object.values(d).map(x => [x.id, x.state, x.reason, x.op?.kind ?? null]), [
    ['ID01', 'reflected', null, 'rename'], ['ID02', 'reflected', null, 'bind'], ['ID03', 'reflected', null, 'retire'], ['ID04', 'rejected', 'undecided', null],
    ['ID05', 'reflected', null, 'retire'], ['ID06', 'reflected', null, 'rename'], ['ID07', 'held', 'identity', null], ['ID08', 'rejected', 'unknown-part', null],
    ['ID09', 'rejected', 'unsupported', null], ['ID10', 'rejected', 'form', null]]);
  assert.deepEqual(d.ID01.op, { kind: 'rename', areaId: areaOf(p, '수집기'), successor: null, into: null, from: '수집기', to: '수집 서비스', renamed: true });
  assert.deepEqual([d.ID01.when, d.ID01.evidence, d.ID03.evidence, d.ID07.evidence], ['c0ffee1 2026-10-02', ['F01'], ['E01'], []]);
  // Rename: the same part, the official and shown name updated, the old name kept with its time and record.
  const collector = areaOf(p, '수집기');
  assert.equal(q.space.areas.find(a => a.id === collector).name, '수집 서비스');
  assert.deepEqual(I.partAliases(q, collector).map(x => [x.name, x.record]), [['수집기', `${B}@${B_BASIS}`]]);
  assert.ok(r.parts.find(x => x.areaId === collector).claims.some(c => c.text === '수집 서비스가 원문을 모은다.'), 'the new part\'s claim joined the part');
  // A name the person gave stays shown; the official name changed.
  const screen = areaOf(p, '내 화면');
  assert.deepEqual([q.space.areas.find(a => a.id === screen).name, I.officialName(q, screen), d.ID06.op.renamed], ['내 화면', '웹 화면', false]);
  // The ledger says each C-IDENT row's state; it never sends one again.
  const led = L.rowLedger(q, X.v5Folds(q.pasted)), key = id => L.ledgerKey(`${B}@${B_BASIS}`, 'C-IDENT', id);
  assert.deepEqual([led.get(key('ID03')).state, led.get(key('ID03')).to.map(t => t.id)], ['reflected', [areaOf(p, '저장소'), succ]]);
  assert.deepEqual([led.get(key('ID07')).state, led.get(key('ID07')).reason, led.get(key('ID07')).with], ['held', 'identity', [p.space.areas[0].id]]);
  assert.ok(!L.resendRows(led, M.readEnds(q), new Map(q.pasted.map((x, i) => [x.id, i]))).some(x => x.table === 'C-IDENT'));
  roundTrip(q);
  // The next ask's roster says what happened.
  const next = I.mapRoster(q).text;
  assert.ok(next.includes(`\nP02 수집 서비스 · — · 있음 · 수집기의 일을 맡는다. · 옛 이름 수집기`) && next.includes(`\nP04 저장소 · — · 대신함→P08`) && next.includes('\nP06 알림기 · — · 없어짐'), next);
});

test('R50-4 retire with a successor: the predecessor keeps its part, leaves the current map and its lines stay its own; partial and planned retire nothing', () => {
  const base = firstRead(project(page1())), roster = I.mapRoster(base);
  const run = (rows, makeSuccessor = true, h = 'c') => {
    const p = paste(base, recordB(roster.head, rows)), inp = ask7(p), ask = inp.ask, rec = recOf(ask, '|B03|새 저장소|');
    const wire = reply7({ parts: makeSuccessor ? [newPart('new:s', '새 저장소', at(ask, '|B03|', rec))] : [] });
    return M.applyReading(p, inp, M.validateMapReply(wire, ask), meta(`R_ros50${h}`, h));
  };
  const store = areaOf(base, '저장소');
  const { project: q, reading: r } = run([['P04', '대신함', 'B03', 'c0ffee2 2026-10-03', 'E01']]);
  const succ = areaOf(q, '새 저장소'), op = r.identity[0].op;
  assert.deepEqual([op.kind, op.areaId, op.successor], ['retire', store, succ]);
  assert.ok(q.space.areas.some(a => a.id === store && !a.archived), 'the predecessor keeps its part (never archived, never deleted)');
  assert.equal(M.partUnderstanding(q, store).stateRead.state, 'retired');
  const v = studioView(q), cur = I.currentView(q, v);
  assert.ok(v.parts.some(x => x.id === store) && !cur.parts.some(x => x.id === store), 'hidden from the current map, kept in the project');
  assert.ok(v.relations.some(x => x.from === store || x.to === store) && !cur.relations.some(x => x.from === store || x.to === store || x.from === succ || x.to === succ), 'its lines are not drawn and never move to the successor');
  assert.ok(!aliasOf(ask7(q), store), 'a later ask is made of the current map');
  // Planned and partial replacements, and a successor C-PART row that is not built, retire nothing.
  for (const [rows, reason, impl] of [[[['P04', '대신함', 'B03', '계획: 다음 판', 'E01']], 'planned'], [[['P04', '대신함', 'B03', '일부: 쓰기만', 'E01']], 'partial'], [[['P04', '없어짐', '—', '예정', 'E01']], 'planned'],
    [[['P04', '대신함', 'B03', 'c0ffee2', 'E01']], 'planned', k => k === 2 ? '미구현' : '구현됨']]) {
    const p = paste(base, recordB(roster.head, rows, impl ? { impl } : {})), inp = ask7(p), ask = inp.ask, rec = recOf(ask, '|B03|새 저장소|');
    const x = M.applyReading(p, inp, M.validateMapReply(reply7({ parts: [newPart('new:s', '새 저장소', at(ask, '|B03|', rec))] }), ask), meta('R_ros50d', 'd'));
    assert.deepEqual([x.reading.identity[0].state, x.reading.identity[0].reason], ['rejected', reason]);
    assert.ok(!I.identityState(x.project).retired.size && I.currentView(x.project, studioView(x.project)).parts.some(y => y.id === store));
  }
  // A successor whose B row is on no part yet waits for it; the next reading that places it retires the predecessor.
  const w = run([['P04', '대신함', 'B03', 'c0ffee2', 'E01']], false, 'e');
  assert.deepEqual([w.reading.identity[0].state, w.reading.identity[0].reason, I.identityState(w.project).retired.size], ['waiting', 'unresolved-endpoint', 0]);
  const inp2 = ask7(w.project), rec2 = recOf(inp2.ask, '|B03|새 저장소|');
  const w2 = M.applyReading(w.project, inp2, M.validateMapReply(reply7({ parts: [newPart('new:s', '새 저장소', at(inp2.ask, '|B03|', rec2))] }), inp2.ask), meta('R_ros50f', 'f'));
  assert.deepEqual([w2.reading.identity[0].state, w2.reading.identity[0].op?.successor], ['reflected', areaOf(w2.project, '새 저장소')]);
  roundTrip(w2.project);
});

test('R50-5 a duplicate the map made is folded onto one canonical part by evidence; its P ID and lines resolve there; names alike alone never fold', () => {
  // The map made two parts of one thing (record A's 수집기, record D's 수집 작업, a line of its own to the person's part).
  const D_REC = 'AF5-50d4d4d4', D_BASIS = 'd0c0de4';
  let p = firstRead(project(page1()));
  p = paste(p, page1({ record: D_REC, basis: D_BASIS, names: ['수집 작업'], pairs: [] }));
  { const inp = ask7(p), ask = inp.ask, rec = recOf(ask, '|B01|수집 작업|');
    const wire = reply7({ parts: [newPart('new:d', '수집 작업', at(ask, '|B01|', rec), { claims: [claim(at(ask, '|B01|', rec), 's1', '수집 작업이 원문을 받는다.')] })],
      relations: [{ from: 'new:d', to: aliasOf(inp, p.space.areas[0].id), kind: 'flow', note: '받은 원문', at: at(ask, '|B01|', rec) }] });
    p = M.applyReading(p, inp, M.validateMapReply(wire, ask), meta('R_ros50g', '1')).project; }
  const keep = areaOf(p, '수집기'), dup = areaOf(p, '수집 작업'), keepP = I.partNumber(p, keep), dupP = I.partNumber(p, dup);
  assert.deepEqual([keepP, dupP], ['P02', 'P08']);
  // A later record's table says both are its B01 (with evidence): the later is folded onto the earlier.
  p = paste(p, recordB(I.mapRoster(p).head, [[keepP, '같음', 'B01', '—', 'F01'], [dupP, '같음', 'B01', '—', 'F02']], { names: ['수집기', ...B_NAMES.slice(1)] }));
  const inp = ask7(p), applied = M.applyReading(p, inp, M.validateMapReply(reply7({}), inp.ask), meta('R_ros50h', '2')), q = applied.project, d = rowsById(applied.reading);
  assert.deepEqual([d.ID01.op.kind, d.ID02.op], ['bind', { kind: 'fold', areaId: dup, successor: null, into: keep, from: null, to: null, renamed: false }]);
  const s = I.identityState(q);
  assert.equal(I.canonicalPart(s, I.areaOfNumber(q, dupP)), keep, 'the old P ID resolves to the canonical part');
  assert.ok(q.space.areas.some(a => a.id === dup && !a.archived), 'nothing is deleted');
  const cur = I.currentView(q, studioView(q));
  assert.ok(!cur.parts.some(x => x.id === dup) && cur.relations.some(x => x.from === keep && x.to === q.space.areas[0].id), 'its line goes to the canonical part');
  assert.ok(M.partUnderstanding(q, keep).claims.some(c => c.text === '수집 작업이 원문을 받는다.'), 'its reading reads as the canonical part');
  const roster = I.mapRoster(q);
  assert.ok(roster.text.includes('\nP02 수집기 · — · 있음 · 수집기의 일을 맡는다. · 옛 ID P08') && !roster.text.includes('\nP08 '));
  // A later table naming the old P ID resolves to the canonical part.
  const f = X.v5Folds([{ id: 'y', text: page1({ record: 'AF5-50f0f0f0', basis: 'f0c0de5', names: ['수집기'], pairs: [], ident: { echo: roster.head, rows: [[dupP, '같음', 'B01', '—', 'F01']] } }) }])[0];
  assert.equal(I.decideIdentity(q, f, new Map())[0].areaId, keep);
  roundTrip(q);
  // Names alike alone never fold: two parts the map made with alike names stay two, and a table naming one of them only binds it.
  const G = 'AF5-50a9a9a9', G_BASIS = 'a0c0de6';
  let g = project(page1({ names: ['수집기'], pairs: [] }), page1({ record: G, basis: G_BASIS, names: ['수집기 (작업자)'], pairs: [] }));
  { const inp = ask7(g), ask = inp.ask, ra = recOf(ask, '|B01|수집기|'), rg = recOf(ask, '|B01|수집기 (작업자)|');
    g = M.applyReading(g, inp, M.validateMapReply(reply7({ parts: [newPart('new:a', '수집기', at(ask, '|B01|', ra)), newPart('new:b', '수집기 (작업자)', at(ask, '|B01|', rg))] }), ask), meta('R_ros50i', '3')).project; }
  assert.equal(I.identityState(g).folded.size, 0); assert.equal(I.currentView(g, studioView(g)).parts.length, 3);
  // The same record's page 2 says its B01 is P02 (수집기), the ledger binds it to the alike part P03: a duplicate the map made, folded by that evidence.
  g = paste(g, identPage(G, G_BASIS, 2, I.mapRoster(g).head, [['P02', '같음', 'B01', '—', 'F01']]));
  const gi = ask7(g), gx = M.applyReading(g, gi, M.validateMapReply(reply7({}), gi.ask), meta('R_ros50j', '4'));
  assert.deepEqual(gx.reading.identity[0].op, { kind: 'fold', areaId: areaOf(g, '수집기 (작업자)'), successor: null, into: areaOf(g, '수집기'), from: null, to: null, renamed: false });
});

test('R50-6 a map changed since the roster holds only the rows on the parts it changed; a reply without the roster line holds them all; another project\'s is rejected', () => {
  const base = firstRead(project(page1())), old = I.mapRoster(base);
  // Record C renames 정리기 (P03) after record B's roster was made.
  let p = paste(base, page1({ record: 'AF5-50c3c3c3', basis: 'c0c0de7', names: ['정돈기'], pairs: [], ident: { echo: old.head, rows: [['P03', '이름 바뀜', 'B01', '—', 'F01']] } }));
  { const inp = ask7(p); p = M.applyReading(p, inp, M.validateMapReply(reply7({}), inp.ask), meta('R_ros50k', '5')).project; }
  assert.equal(p.space.areas.find(a => a.id === areaOf(base, '정리기')).name, '정돈기');
  p = paste(p, recordB(old.head, [['P02', '이름 바뀜', 'B01', '—', 'F01'], ['P03', '같음', 'B02', '—', 'F01']]));
  const inp = ask7(p), r = M.applyReading(p, inp, M.validateMapReply(reply7({}), inp.ask), meta('R_ros50l', '6')).reading, d = rowsById(r);
  assert.deepEqual([[d.ID01.state, d.ID01.op?.kind], [d.ID02.state, d.ID02.reason]], [['reflected', 'rename'], ['held', 'roster']]);
  const f = rows => X.v5Folds([{ id: 'z', text: recordB(rows, [['P02', '같음', 'B02', '—', 'F01']]) }])[0];
  assert.deepEqual(I.decideIdentity(base, f(null), new Map()).map(x => [x.state, x.reason]), [['held', 'roster']], 'no roster line: held');
  assert.deepEqual(I.decideIdentity(base, f(old.head.replace(base.id, 'P_other')), new Map()).map(x => [x.state, x.reason]), [['rejected', 'other-project']]);
  assert.deepEqual(I.decideIdentity(base, f(old.head), new Map()).map(x => [x.state, x.op?.kind]), [['reflected', 'bind']]);
});

test('R50-7 v5 and v5.1 records read as before (no identity key); stored identity rows are validated; the recipes name map-roster.1', () => {
  const p = firstRead(project(page1()));
  const last = p.readings.at(-1);
  assert.equal(last.version, 'map-reading.20'); assert.ok(!Object.hasOwn(last, 'identity'), 'a reading of a record with no C-IDENT keeps the .20 shape');
  assert.equal(I.currentView(p, studioView(p)).parts.length, studioView(p).parts.length);
  // Stored rows are checked like every reading field.
  let q = paste(p, recordB(I.mapRoster(p).head, [['P03', '같음', 'B02', '—', 'F01'], ['P05', '모름', '—', '—', '모름']]));
  { const inp = ask7(q); q = M.applyReading(q, inp, M.validateMapReply(reply7({}), inp.ask), meta('R_ros50m', '7')).project; }
  const bad = mutate => { const x = JSON.parse(serializeProject(q)); mutate(x.readings.at(-1).identity); return () => validateProject(x); };
  assert.doesNotThrow(bad(() => {}));
  assert.throws(bad(rows => { rows[1].op = structuredClone(rows[0].op); }), 'an operation on a row that is not reflected');
  assert.throws(bad(rows => { rows[0].reason = 'roster'; }));
  assert.throws(bad(rows => { rows[0].op.kind = 'merge'; }));
  assert.throws(bad(rows => { rows[0].at.to = 10 ** 7; }));
  assert.throws(bad(rows => { rows.push(structuredClone(rows[0])); }), 'each row once');
  assert.throws(bad(rows => { rows[0].evidence = ['X1']; }));
  assert.ok(P.MAP7_RECIPE.startsWith('map7-recipe.9: later-identity.2') && P.MAP7_RECIPE.includes('map-roster.2') && P.MAP7_RECIPE.includes('map-roster.1'));
});

test('R50-R replay: the stored 56-part map\'s roster fits whole; a C-IDENT page folds the map\'s duplicate pipeline card and retires the stage-1 cron card', { skip: !GROWTH || !existsSync(join(GROWTH, 'project/state-after-4.json')) }, () => {
  const p = parseProject(readFileSync(join(GROWTH, 'project/state-after-4.json'), 'utf8')), roster = I.mapRoster(p), ask = R.recordAskV5('AF5-00000000', roster);
  assert.equal(roster.scope, 'full'); assert.ok(roster.text.length <= I.ROSTER_CHARS);
  const plain = R.recordAskV5('AF5-00000000');
  console.log(`roster: ${roster.entries.length} parts, ${roster.text.length} chars (${new TextEncoder().encode(roster.text).length} B); ask v5.1 ${plain.length} chars → v5.2 ${ask.length} chars`);
  // The stage-4 record's last page, and one more page of it with a C-IDENT table: its B17 (the pipeline row R10 made a second card of) is the
  // stage-3 card; the stage-1 cron card is replaced by its B13 (the folder watcher).
  const f = X.v5Folds(p.pasted).find(x => x.fold.byId.get('B17')?.row.byColumn['이름'] === '소비 파이프라인' && x.fold.byId.get('B13'));
  const core = n => M.nameCore(n).core, live = p.space.areas.filter(a => !a.archived);
  const pipes = live.filter(a => core(a.name) === core('소비 파이프라인')).sort((a, b) => p.space.areas.indexOf(a) - p.space.areas.indexOf(b));
  const cron = live.find(a => a.name === 'cronjob'), watcher = live.find(a => a.name === f.fold.byId.get('B13').row.byColumn['이름']);
  assert.ok(f && pipes.length === 2 && cron && watcher, `${pipes.map(a => a.name)} ${cron?.name} ${watcher?.name}`);
  const n = Math.max(...f.fold.pages.map(x => x.n)) + 1, [rid, basis] = f.key.split('@');
  // Review of .50 (K3): 대신함 with 바뀐 때 「모름」 shows no change in effect and retires nothing; with the time it happened it retires.
  const unsure = paste(p, identPage(rid, basis, n, roster.head, [[I.partNumber(p, pipes[0].id), '같음', 'B17', '—', 'F10'], [I.partNumber(p, cron.id), '대신함', 'B13', '모름', 'F12']]));
  { const inp = ask7(unsure), applied = M.applyReading(unsure, inp, M.validateMapReply(reply7({}), inp.ask), meta('R_ros50q', '7')), [, y] = applied.reading.identity;
    assert.deepEqual([y.state, y.reason, y.op], ['rejected', 'unconfirmed', null]); assert.ok(I.currentView(applied.project, studioView(applied.project)).parts.some(a => a.id === cron.id)); }
  const q0 = paste(p, identPage(rid, basis, n, roster.head, [[I.partNumber(p, pipes[0].id), '같음', 'B17', '—', 'F10'], [I.partNumber(p, cron.id), '대신함', 'B13', '8f5809d 2020-11-18', 'F12']]));
  const inp = ask7(q0), applied = M.applyReading(q0, inp, M.validateMapReply(reply7({}), inp.ask), meta('R_ros50r', '8')), q = applied.project, [x, y] = applied.reading.identity;
  console.log(`replay: ${x.id} ${x.state} ${x.op?.kind ?? ''}, ${y.id} ${y.state} ${y.reason ?? ''} ${y.op?.kind ?? ''}`);
  assert.deepEqual([x.op.kind, x.op.areaId, x.op.into], ['fold', pipes[1].id, pipes[0].id], 'the later duplicate is folded onto the stage-3 card');
  assert.deepEqual([y.op.kind, y.op.areaId, y.op.successor], ['retire', cron.id, watcher.id]);
  const cur = I.currentView(q, studioView(q));
  assert.ok(!cur.parts.some(a => a.id === pipes[1].id || a.id === cron.id) && cur.parts.length === studioView(q).parts.length - 2);
  roundTrip(q);
});
