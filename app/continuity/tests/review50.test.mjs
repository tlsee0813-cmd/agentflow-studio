// Review of recipe .50: the honesty and deadlock/loss findings, each as the behaviour it must have now. Model-free: hand-written records
// and replies only.
// Identity: no automatic merge of two parts a record keeps apart (K1); a new part on its own row is never swallowed by a bound row it also
// quotes (K2) and only a creation binds a row (K11); retirement needs a time in effect and a built successor (K3); a roster hash that differs
// with no reading since, or a part a partial roster did not list, holds the row (K4); the roster or the request is no evidence (K5); a held
// correspondence is never dodged by a new P (K9). Ledger: parsed is not reflected (K6); a held row's release is bounded and needs the part's
// identity to change (K12, deadlock 4); a link waiting on an unsettled end is never spent to rejection (loss 3); an ask of re-sent rows is
// never stuck on NOTHING_READ (deadlock 2); a backlog derived from older readings goes only beside fresh text (budget) and a re-sent row of
// it is held when its name shares a word with a part (deadlock 7). Contract: count set-asides past a bound are grouped (deadlock 6); the
// facts never make a map TOO_LARGE (deadlock 1); 「일부 구현」 ends no unbuilt claim (12); a plain defect row justifies no withdrawal (K10); a
// v5.2 record's roster IDs are named against the ask's ids (deadlock 10).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as I from '../dist/public/shared/map-identity.js';
import * as T from '../dist/public/shared/record-table.js';
import * as X from '../dist/public/shared/record-excerpt.js';
import * as L from '../dist/public/shared/row-ledger.js';
import { encodeSpans } from '../dist/public/shared/evidence-span.js';
import { parseProject, validateProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';
import * as B from '../server/map-blueprint.mjs';

const pad = n => String(n).padStart(2, '0');
const A = 'AF5-50a1b2c3', A_BASIS = '50c0de1', BR = 'AF5-50e1e2e3', BR_BASIS = 'e0c0de3';
const headOf = (record, basis, n) => `〔기록 ${record} · 쪽 ${n} · 기준 ${basis} · 앞 쪽 ${n > 1 ? n - 1 : '—'}〕 검토 시험 기록 v5 (시험 세션, 2026-11-06 12:${pad(n)})`;
const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
const ends = list => table('C-END', list.map(([t, w]) => [t, '끝남', w, '—', '—']));
const partRow = (id, name, impl = '구현됨') => [id, name, '처리 · 계산', `${name}의 일`, 'F01', impl, 'F01'];
const linkRow = (id, a, b, what) => [id, a, b, what, '호출마다', '—', '같은 프로세스', '정의된 관계', 'F01'];
const NAMES = ['수집기', '정리기', '저장소', '검색기', '알림기', '화면'];
const PAIRS = NAMES.flatMap((_, a) => NAMES.map((_, b) => [a, b])).filter(([a, b]) => a !== b).slice(0, 16);
const EVID = extra => table('C-EVID', [['E01', '보고', 'c0ffee2 커밋', '—', '옮김'], ...extra]);
const identTable = (echo, rows) => [`C-IDENT ${T.IDENT_TABLE.title}`, ...(echo ? [`대장: ${echo}`] : []), T.headerLine(T.IDENT_TABLE), '|---|---|---|---|---|---|', ...rows.map((r, k) => `|ID${pad(k + 1)}|${r.join('|')}|`)].join('\n');
function page1({ record = A, basis = A_BASIS, names = NAMES, pairs = PAIRS, impl = () => '구현됨', ident = null, evid = [], extra = [], summary = '검토 시험 서비스 (F01).' } = {}) {
  return [headOf(record, basis, 1), table('C-SRC', [['F01', 'src/', 'B01', '읽음', '코드'], ['F02', 'docs/', '전체', '읽음', '문서']]), EVID(evid),
    table('C-HEAD', T.HEAD_ITEMS.map((item, k) => [item, `값 ${k + 1}`, 'F01'])), `C-SUMMARY 요약\n${summary}`,
    table('C-PART', names.map((n, k) => partRow(`B${pad(k + 1)}`, n, impl(k)))), ...(ident ? [identTable(ident.echo, ident.rows)] : []),
    ...(pairs.length ? [table('C-LINK', pairs.map(([a, b], k) => linkRow(`LN${pad(k + 1)}`, `B${pad(a + 1)}`, `B${pad(b + 1)}`, `자료 ${k + 1}`)))] : []),
    ...extra.map(([id, rows]) => table(id, rows)),
    ends([['C-HEAD', '—'], ['C-PART', `B01–B${pad(names.length)}`], ...(ident ? [['C-IDENT', `ID01–ID${pad(ident.rows.length)}`]] : []), ...(pairs.length ? [['C-LINK', `LN01–LN${pad(pairs.length)}`]] : []),
      ...extra.map(([id, rows]) => [id, `${rows[0][0]}–${rows.at(-1)[0]}`])]), '완료 단계: 첫 구조 완료'].join('\n');
}
let H = 0;
const meta = id => ({ id, at: '2026-11-06T04:00:00.000Z', model: 'stub', prompt: 'm7-000000000050', hash: (++H).toString(16).padStart(64, 'e') });
function project(...pages) {
  let p = D.addArea({ ...D.createProject(), name: '검토 시험' }, '기존 부분', '사람이 만든 부분');
  for (const t of pages) p = D.pasteRecord(p, t, null).project;
  return parseProject(JSON.stringify(p));
}
const paste = (p, t) => parseProject(JSON.stringify(D.pasteRecord(p, t, null).project));
const ask7 = p => M.buildMapAsk(p, I.currentView(p, studioView(p)), [], undefined, M.MAP7_SCHEMA);
const at = (ask, words, rec) => { for (const r of ask.records) { if (rec && r.id !== rec) continue; const s = r.spans.find(x => x.t.trimStart().startsWith(words)); if (s) return s.s; } throw new Error(`no piece ${words}`); };
const recOf = (ask, words) => ask.records.find(r => M.askRecords(ask).get(r.id).text.includes(words))?.id;
const newPart = (ref, name, basis, o = {}) => ({ ref, name, parent: null, role: `${name}의 일을 맡는다.`, roleAboutAt: null, roleReplaces: null, basis: Array.isArray(basis) ? basis : [basis], claims: [], ...o });
const oldPart = (ref, o = {}) => ({ ref, name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [], claims: [], ...o });
const claim = (where, key, text = '원문 행이 말하는 내용이다.') => ({ kind: 'describes', text, at: where, aboutAt: null, replaces: null, key });
const reply7 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const areaOf = (p, name) => p.space.areas.find(a => a.name === name && !a.archived)?.id;
const aliasOf = (inp, id) => [...inp.parts].find(([, v]) => v === id)?.[0];
const rowsById = r => Object.fromEntries((r.identity ?? []).map(x => [x.id, x]));
const ledgerOf = p => L.rowLedger(p, X.v5Folds(p.pasted));
const roundTrip = p => assert.deepEqual(validateProject(JSON.parse(serializeProject(p))), JSON.parse(serializeProject(p)));
/** The first reading of record A: its six parts on their rows and the sixteen lines. */
function firstRead(p) {
  const inp = ask7(p), ask = inp.ask;
  const wire = reply7({ parts: NAMES.map((n, k) => newPart(`new:b${k + 1}`, n, at(ask, `|B${pad(k + 1)}|`))),
    relations: PAIRS.map(([a, b], k) => ({ from: `new:b${a + 1}`, to: `new:b${b + 1}`, kind: 'flow', note: `자료 ${k + 1}`, at: at(ask, `|LN${pad(k + 1)}|`) })) });
  return M.applyReading(p, inp, M.validateMapReply(wire, ask), meta('R_rev50a')).project;
}
const B_NAMES = ['수집 서비스', '정돈 단계', '새 저장소', '찾기 색인', '웹 화면'];
const recordB = (echo, rows, o = {}) => page1({ record: BR, basis: BR_BASIS, names: B_NAMES, pairs: [], ident: { echo, rows }, ...o });
const applyEmpty = p => { const inp = ask7(p); return M.applyReading(p, inp, M.validateMapReply(reply7({}), inp.ask), meta('R_rev50e')); };
/** A reading of an earlier contract: the same reading with its stored row entries left out, as map-reading.19 (the ledger derives it). */
const asOlder = p => parseProject(JSON.stringify({ ...p, readings: p.readings.map(r => { if (r.version !== M.READING_CONTRACT) return r; const { rows, identity, ...rest } = r; return { ...rest, version: 'map-reading.19' }; }) }));

test('V50-1 (K1) two C-IDENT rows naming one B row never fold two parts that one record keeps on two rows of its own', () => {
  const base = firstRead(project(page1())), roster = I.mapRoster(base), collector = areaOf(base, '수집기'), sorter = areaOf(base, '정리기');
  const p = paste(base, recordB(roster.head, [[I.partNumber(base, collector), '같음', 'B01', '—', 'F01'], [I.partNumber(base, sorter), '같음', 'B01', '—', 'F01']]));
  const { project: q, reading } = applyEmpty(p), d = rowsById(reading);
  assert.deepEqual([d.ID01.state, d.ID01.reason, d.ID02.state, d.ID02.reason], ['held', 'identity', 'held', 'identity']);
  assert.ok(I.currentView(q, studioView(q)).parts.some(x => x.id === sorter) && I.identityState(q).folded.size === 0, 'nothing folded');
  roundTrip(q);
});

test('V50-2 (K2, K11) only a creation binds a C-PART row; a new part on its own row is made even when it also quotes a bound row', () => {
  const base = firstRead(project(page1())), roster = I.mapRoster(base), sorter = areaOf(base, '정리기');
  // K11: an existing part's basis quoting another row (B04 of record B) binds nothing.
  let p = paste(base, recordB(roster.head, []));
  let inp = ask7(p), ask = inp.ask, rec = recOf(ask, '|B04|찾기 색인|');
  p = M.applyReading(p, inp, M.validateMapReply(reply7({ parts: [oldPart(aliasOf(inp, sorter), { basis: [at(ask, '|B04|', rec)], claims: [claim(at(ask, '|B02|', rec), 's1', '정리기가 문서를 정돈한다.')] })] }), ask), meta('R_rev50k11')).project;
  const key = L.ledgerKey(`${BR}@${BR_BASIS}`, 'C-PART', 'B04');
  assert.equal(L.rowBindings(ledgerOf(p), () => true).get(key), undefined, 'B04 is bound to nothing');
  // K2: 찾기 색인 on its own row B04 that also quotes B02 (bound to 정리기 by record B's C-IDENT row) is made, with its own claim.
  const q0 = paste(base, recordB(roster.head, [[I.partNumber(base, sorter), '같음', 'B02', '—', 'F01']]));
  inp = ask7(q0); ask = inp.ask; rec = recOf(ask, '|B04|찾기 색인|');
  const wire = reply7({ parts: [newPart('new:i', '찾기 색인', [at(ask, '|B04|', rec), at(ask, '|B02|', rec)], { claims: [claim(at(ask, '|B04|', rec), 's1', '찾기 색인이 문서를 색인한다.')] })] });
  const applied = M.applyReading(q0, inp, M.validateMapReply(wire, ask), meta('R_rev50k2')), made = applied.created.map(id => applied.project.space.areas.find(a => a.id === id).name);
  assert.deepEqual(made, ['찾기 색인']);
  const index = areaOf(applied.project, '찾기 색인');
  assert.ok(M.partUnderstanding(applied.project, index).claims.some(c => c.text === '찾기 색인이 문서를 색인한다.'));
  assert.ok(!M.partUnderstanding(applied.project, sorter).claims.some(c => c.text === '찾기 색인이 문서를 색인한다.'));
  assert.equal(L.rowBindings(ledgerOf(applied.project), () => true).get(key), index, 'B04 is bound to the part made on it');
  roundTrip(applied.project);
});

test('V50-3 (K3) retirement needs the change in effect: a time it happened, and for 대신함 a successor said to be built in whole', () => {
  const base = firstRead(project(page1())), roster = I.mapRoster(base), alarm = areaOf(base, '알림기'), store = areaOf(base, '저장소');
  for (const when of ['—', '모름']) {
    const { project: q, reading } = applyEmpty(paste(base, recordB(roster.head, [[I.partNumber(base, alarm), '없어짐', '—', when, 'E01']])));
    assert.deepEqual([reading.identity[0].state, reading.identity[0].reason, reading.identity[0].op], ['rejected', 'unconfirmed', null], when);
    assert.ok(I.currentView(q, studioView(q)).parts.some(x => x.id === alarm));
  }
  const gone = applyEmpty(paste(base, recordB(roster.head, [[I.partNumber(base, alarm), '없어짐', '—', 'c0ffee3 2026-10-04', 'E01']])));
  assert.equal(gone.reading.identity[0].op?.kind, 'retire', 'with its time it retires');
  for (const [impl, reason] of [['일부 구현', 'partial'], ['미구현', 'planned']]) {
    const p = paste(base, recordB(roster.head, [[I.partNumber(base, store), '대신함', 'B03', 'c0ffee3 2026-10-04', 'E01']], { impl: k => k === 2 ? impl : '구현됨' }));
    const inp = ask7(p), ask = inp.ask, rec = recOf(ask, '|B03|새 저장소|');
    const x = M.applyReading(p, inp, M.validateMapReply(reply7({ parts: [newPart('new:s', '새 저장소', at(ask, '|B03|', rec))] }), ask), meta('R_rev50k3'));
    assert.deepEqual([x.reading.identity[0].state, x.reading.identity[0].reason], ['rejected', reason], impl);
    assert.ok(I.currentView(x.project, studioView(x.project)).parts.some(y => y.id === store), 'the predecessor stays current');
  }
});

test('V50-4 (K4) a roster hash that differs with no reading since holds every row; a partial roster holds a row on a part it did not list', () => {
  const base = firstRead(project(page1())), roster = I.mapRoster(base), alarm = areaOf(base, '알림기');
  const { reading } = applyEmpty(paste(base, recordB(roster.head.replace(roster.hash, 'deadbeef'), [[I.partNumber(base, alarm), '없어짐', '—', 'c0ffee3 2026-10-04', 'E01']])));
  assert.deepEqual([reading.identity[0].state, reading.identity[0].reason], ['held', 'roster']);
  // The person reparents a part between the ask and the reply: the hash differs and nothing is taken as current.
  const moved = parseProject(JSON.stringify(D.setAreaParent(base, alarm, areaOf(base, '화면'))));
  const m = applyEmpty(paste(moved, recordB(roster.head, [[I.partNumber(base, alarm), '없어짐', '—', 'c0ffee3 2026-10-04', 'E01']])));
  assert.deepEqual([m.reading.identity[0].state, m.reading.identity[0].reason], ['held', 'roster']);
  // The same roster, unchanged: the row applies.
  assert.equal(applyEmpty(paste(base, recordB(roster.head, [[I.partNumber(base, alarm), '없어짐', '—', 'c0ffee3 2026-10-04', 'E01']]))).reading.identity[0].op?.kind, 'retire');
  // A partial roster says how far it lists; a row past it is held.
  const part = I.mapRoster(base, { max: 215 });
  assert.equal(part.scope, 'partial'); assert.match(part.head, / · 목록 P01–P\d\d$/);
  const listed = Number(/목록 P01–P(\d\d)/.exec(part.head)[1]), past = `P${pad(listed + 1)}`, inside = 'P02';
  const f = X.v5Folds([{ id: 'k4', text: recordB(part.head, [[past, '같음', 'B01', '—', 'F01'], [inside, '같음', 'B02', '—', 'F01']]) }])[0];
  const d = I.decideIdentity(base, f, new Map());
  assert.deepEqual([d[0].state, d[0].reason], ['held', 'roster']); assert.equal(d[1].state, 'reflected');
});

test('V50-5 (K5) an evidence row whose source is the app\'s own roster or the request is no evidence: the row is a candidate (held)', () => {
  const base = firstRead(project(page1())), roster = I.mapRoster(base), sorter = areaOf(base, '정리기');
  for (const source of ['지도 대장(앱이 준 목록) 판 1', '기록 요청 본문']) {
    const text = recordB(roster.head, [[I.partNumber(base, sorter), '같음', 'B04', '—', 'E02']], { evid: [['E02', '보고', source, '—', '—']] });
    const d = I.decideIdentity(base, X.v5Folds([{ id: 'k5', text }])[0], new Map());
    assert.deepEqual([d[0].state, d[0].reason, d[0].evidence], ['held', 'identity', []], source);
  }
});

test('V50-6 (K6) a row only a reading field the app never shows stands on is rejected as unsupported, kept in the reading, never re-sent', () => {
  const p = firstRead(project(page1({ extra: [['C-CHECK', [['CK01', '시험 통과', '예', '—', 'npm test', 'F01']]]] })));
  const ck = ledgerOf(p).get(L.ledgerKey(`${A}@${A_BASIS}`, 'C-CHECK', 'CK01'));
  assert.deepEqual([ck.state, ck.reason, ck.detail], ['rejected', 'unsupported', 'checks']);
  assert.ok(p.readings.at(-1).checks.length > 0, 'the reading keeps what it read');
  assert.ok(!L.resendRows(ledgerOf(p), M.readEnds(p), new Map(p.pasted.map((x, i) => [x.id, i]))).some(x => x.table === 'C-CHECK'));
  assert.ok(L.SHOWN_READING_FIELDS.has('firstLines') && !L.SHOWN_READING_FIELDS.has('checks'));
  roundTrip(p);
});

test('V50-7 (K9) a new part on a row whose C-IDENT correspondence is held is held with that part, never made as a new P', () => {
  const base = firstRead(project(page1())), roster = I.mapRoster(base), sorter = areaOf(base, '정리기'), pid = I.partNumber(base, sorter);
  for (const [echo, cite] of [[null, 'F01'], [roster.head, '추정']]) {
    const p = paste(base, recordB(echo, [[pid, '같음', 'B02', '—', cite]]));
    const inp = ask7(p), ask = inp.ask, rec = recOf(ask, '|B02|정돈 단계|');
    const applied = M.applyReading(p, inp, M.validateMapReply(reply7({ parts: [newPart('new:t', '정돈 단계', at(ask, '|B02|', rec))] }), ask), meta('R_rev50k9'));
    assert.equal(applied.reading.identity[0].state, 'held'); assert.deepEqual(applied.created, [], 'no second P');
    const c = applied.reading.candidates.find(x => x.text.startsWith('‘정돈 단계’'));
    assert.ok(c && c.target === 'identity' && c.areaIds[0] === sorter && /C-IDENT/.test(c.text));
    const row = ledgerOf(applied.project).get(L.ledgerKey(`${BR}@${BR_BASIS}`, 'C-PART', 'B02'));
    assert.deepEqual([row.state, row.reason, row.with], ['held', 'identity', [sorter]]);
  }
});

test('V50-8 (K10) a change word said in the negative, or 「더는」 with a quality, justifies no withdrawal; a stated removal does', () => {
  for (const t of ['오래된 임시 파일이 삭제되지 않고 남는다', '임시 파일 정리가 더는 빠르지 않다', '제거하지 못했다', '교체 안 됨', 'the cache was not removed'])
    assert.equal(B.changeStated(t), false, t);
  for (const t of ['임시 파일 정리를 제거했다', '더 이상 쓰지 않는다', '저장 방식을 바꿨다', 'replaced by the queue', 'no longer used'])
    assert.equal(B.changeStated(t), true, t);
  const TEXT = ['〔기록 AF5-50c2c2c2 · 쪽 1 · 기준 50c0de2 · 앞 쪽 —〕 검토 기록 v5 (시험 세션, 2026-11-06 11:00)',
    table('C-PART', [['B01', '저장', '처리 · 저장', '문서를 저장한다', 'F01', '구현됨', 'F01']]),
    table('C-ISSUE', [['IS01', 'B01', '오래된 임시 파일이 삭제되지 않고 남는다', '모름', 'F01'], ['IS02', 'B01', '임시 파일 정리가 더는 빠르지 않다', '모름', 'F01'], ['IS03', 'B01', '임시 파일 삭제 단계를 제거했다', '모름', 'F01']])].join('\n');
  const ask = M.validateMapAsk({ schemaVersion: 'studio.map.7', project: { name: '검토', purpose: null }, relations: [], requests: [], priors: [],
    parts: [{ id: 'P01', name: '저장', note: '', parentId: null, readAs: null, role: '문서를 저장한다.', roleBy: 'reading', roleAbout: null,
      current: [{ key: 'C01', kind: 'describes', text: '저장이 끝나면 임시 파일을 삭제한다.', about: null }] }],
    records: [{ id: 'N01', kind: 'pasted', note: '', basis: '검토', ...encodeSpans('N01', TEXT) }] }, { route: 'divided' });
  const place = words => ask.records[0].spans.find(x => x.t.includes(words)).s;
  assert.deepEqual(['|IS01|', '|IS02|', '|IS03|'].map(w => B.correctionJustified({ part: 'P01', claim: 'C01', at: [place(w)] }, ask)), [false, false, true]);
  assert.equal(B.CONTAINMENT_VERSION, 'later-containment.2');
});

test('V50-9 (K12, deadlock 4) a held row is released only when its part\'s identity changes, and never past the transient send bound', () => {
  let p = firstRead(project(page1()));
  const sorter = areaOf(p, '정리기'), C = 'AF5-50cccccc', C_BASIS = 'cc0de12';
  p = paste(p, page1({ record: C, basis: C_BASIS, names: ['정리기 (작업)'], pairs: [] }));
  const key = L.ledgerKey(`${C}@${C_BASIS}`, 'C-PART', 'B01'), trail = [];
  for (let k = 0; k < 8; k++) {
    if (k) p = paste(p, page1({ record: `AF5-50ddd${k}${k}${k}`, basis: `d${k}c0de${k}`, names: [`기타 ${k}`], pairs: [] }));
    const inp = ask7(p), ask = inp.ask, alias = aliasOf(inp, sorter);
    const recC = recOf(ask, '|B01|정리기 (작업)|'), recK = k ? recOf(ask, `|B01|기타 ${k}|`) : null;
    const parts = [];
    if (recC) parts.push(newPart('new:w', '정리기 (작업)', at(ask, '|B01|', recC)));
    // Even readings write a claim on 정리기 (no change of what it is); odd ones its role (a change: the hold may lift, within the bound).
    if (recK) parts.push(oldPart(alias, k % 2 ? { role: `정리기가 일 ${k}을 맡는다.`, basis: [at(ask, '|B01|', recK)] } : { claims: [claim(at(ask, '|B01|', recK), `s${k}`, `정리기가 일 ${k}을 한다.`)] }));
    p = M.applyReading(p, inp, M.validateMapReply(reply7({ parts }), ask), meta(`R_rev50z${k}`)).project;
    const x = ledgerOf(p).get(key); trail.push(`${x.state}/${x.sent}`);
    assert.ok(x.sent <= L.RESEND_TRANSIENT_MAX, trail.join(' '));
  }
  const last = ledgerOf(p).get(key);
  assert.deepEqual([last.state, last.reason], ['held', 'identity'], trail.join(' '));
  assert.ok(!L.resendRows(ledgerOf(p), M.readEnds(p), new Map(p.pasted.map((x, i) => [x.id, i]))).some(x => x.record === `${C}@${C_BASIS}` && x.table === 'C-PART'));
});

test('V50-10 (loss 3) a link on a held end is held with it (depends) and is never spent to rejection; it goes once its end is placed', () => {
  let p = project(page1({ pairs: [[0, 5], [5, 1], [0, 1]] }));
  const inp = ask7(p), ask = inp.ask, own = [...inp.parts.keys()][0];
  // B06 (화면) is an identity question with the person's part; its two links wait on it.
  p = M.applyReading(p, inp, M.validateMapReply(reply7({ parts: NAMES.slice(0, 5).map((n, k) => newPart(`new:b${k + 1}`, n, at(ask, `|B${pad(k + 1)}|`))),
    relations: [{ from: 'new:b1', to: 'new:b2', kind: 'flow', note: '자료 3', at: at(ask, '|LN03|') }],
    candidates: [{ text: '화면이 기존 부분과 같은 대상인지 원문만으로 가를 수 없다.', target: 'identity', parts: [own, 'new:b1'], at: at(ask, '|B06|'), statement: null }] }), ask), meta('R_rev50l3')).project;
  const KEY = `${A}@${A_BASIS}`, row = id => ledgerOf(p).get(L.ledgerKey(KEY, 'C-LINK', id));
  assert.deepEqual(['LN01', 'LN02'].map(id => [row(id).state, row(id).reason]), [['held', 'depends'], ['held', 'depends']]);
  // Later readings write claims on the person's part: B06 stays held, and its links are never rejected.
  for (let k = 1; k <= 7; k++) {
    p = paste(p, `작업 보고 ${k}: 기존 부분의 설정을 조금 바꿨습니다.`);
    const a = ask7(p), plain = a.ask.records.find(r => M.askRecords(a.ask).get(r.id).text.startsWith('작업 보고'));
    p = M.applyReading(p, a, M.validateMapReply(reply7({ parts: [oldPart(aliasOf(a, p.space.areas[0].id), { claims: [claim(plain.spans[0].s, 's1', '기존 부분의 설정을 바꿨다.')] })] }), a.ask), meta(`R_rev50l3${k}`)).project;
    assert.ok(![...M.askRecords(a.ask).values()].some(x => x.text.includes('|LN01|')), 'never sent while its end is held');
  }
  assert.deepEqual(['LN01', 'LN02'].map(id => [row(id).state, row(id).reason, row(id).sent]), [['held', 'depends', 1], ['held', 'depends', 1]]);
  // resendRows: a link waiting on an end goes only when that end is placed, goes with it, or is unread.
  const base = { record: KEY, detail: null, to: [], with: [], paste: 'x', name: null, reading: 'R', stored: true, bound: null };
  const end = (state, startAt) => ({ ...base, table: 'C-PART', id: 'B06', state, reason: state === 'reflected' ? null : 'transient', sent: 1, start: startAt, end: startAt + 1, ends: [] });
  const link = { ...base, table: 'C-LINK', id: 'LN01', state: 'waiting', reason: 'unresolved-endpoint', sent: 4, start: 10, end: 11, ends: ['B06'] };
  const sent = endRow => L.resendRows(new Map([[L.ledgerKey(KEY, 'C-PART', 'B06'), endRow], [L.ledgerKey(KEY, 'C-LINK', 'LN01'), link]]), new Map([['x', 100]]), new Map([['x', 0]])).map(x => x.id);
  assert.deepEqual(sent(end('reflected', 1)), ['LN01']); assert.deepEqual(sent(end('waiting', 1)), ['B06', 'LN01']); assert.deepEqual(sent({ ...end('held', 1), reason: 'identity' }), []);
});

test('V50-11 (deadlock 2) an ask of rows sent again, answered with gaps only, is kept: the send counts move and the loop ends', () => {
  let p = project(page1({ pairs: NAMES.flatMap((_, a) => NAMES.map((_, b) => [a, b])).filter(([a, b]) => a !== b).slice(0, 18) }));
  { const inp = ask7(p), ask = inp.ask;
    p = M.applyReading(p, inp, M.validateMapReply(reply7({ parts: NAMES.map((n, k) => newPart(`new:b${k + 1}`, n, at(ask, `|B${pad(k + 1)}|`))),
      relations: PAIRS.map(([a, b], k) => ({ from: `new:b${a + 1}`, to: `new:b${b + 1}`, kind: 'flow', note: `자료 ${k + 1}`, at: at(ask, `|LN${pad(k + 1)}|`) })) }), ask), meta('R_rev50g0')).project; }
  const key = L.ledgerKey(`${A}@${A_BASIS}`, 'C-LINK', 'LN17'), seen = [];
  for (let k = 0; k < 5; k++) {
    const inp = ask7(p); if (inp.problem) { seen.push(inp.problem); break; }
    p = M.applyReading(p, inp, M.validateMapReply(reply7({ gaps: ['다시 보낸 행은 이미 본 표의 일부라 새로 정리할 것이 없다.'] }), inp.ask), meta(`R_rev50g${k + 1}`)).project;
    const x = ledgerOf(p).get(key); seen.push(`${x.state}/${x.sent}`);
  }
  assert.deepEqual(seen, ['waiting/2', 'rejected/3', 'NOTHING_NEW']);
});

test('V50-12 (budget) rows a former contract\'s reading left waiting go again only beside fresh text, never as an ask of their own', () => {
  const base = project(page1({ pairs: NAMES.flatMap((_, a) => NAMES.map((_, b) => [a, b])).filter(([a, b]) => a !== b).slice(0, 18) }));
  const inp = ask7(base), ask = inp.ask;
  const read = M.applyReading(base, inp, M.validateMapReply(reply7({ parts: NAMES.map((n, k) => newPart(`new:b${k + 1}`, n, at(ask, `|B${pad(k + 1)}|`))),
    relations: PAIRS.map(([a, b], k) => ({ from: `new:b${a + 1}`, to: `new:b${b + 1}`, kind: 'flow', note: `자료 ${k + 1}`, at: at(ask, `|LN${pad(k + 1)}|`) })) }), ask), meta('R_rev50b0')).project;
  assert.equal(ask7(read).problem, null, 'this contract\'s own waiting rows make an ask');
  const old = asOlder(read), led = ledgerOf(old), waiting = [...led.values()].filter(x => x.state === 'waiting');
  assert.ok(waiting.length >= 2 && waiting.every(x => !x.stored));
  assert.equal(ask7(old).problem, 'NOTHING_NEW', 'derived waiting rows alone make no paid reading');
  const fresh = paste(old, page1({ record: 'AF5-50f1f1f1', basis: 'f0c0de1', names: ['배달기'], pairs: [] })), next = ask7(fresh);
  assert.equal(next.problem, null);
  assert.ok(next.ask.records.some(r => /앞선 정리에서 반영되지 않아 다시 보낸 행 \d+개: C-LINK LN17/.test(r.note)), 'beside fresh text they go');
});

test('V50-13 (deadlock 7) a re-sent C-PART row of a former contract\'s backlog whose name shares a word with a part is held, never a second card', () => {
  const base = project(page1({ names: ['정합성 검사', '정합성 점검'], pairs: [] })), inp = ask7(base), ask = inp.ask;
  const read = M.applyReading(base, inp, M.validateMapReply(reply7({ parts: [newPart('new:a', '정합성 검사', at(ask, '|B01|'))] }), ask), meta('R_rev50d0')).project;
  const check = areaOf(read, '정합성 검사'), KEY = `${A}@${A_BASIS}`;
  const run = (p, label) => {
    const q = paste(p, page1({ record: 'AF5-50f2f2f2', basis: 'f0c0de2', names: ['배달기'], pairs: [] })), next = ask7(q);
    const rec = recOf(next.ask, '|B02|정합성 점검|'); assert.ok(rec, `${label}: B02 goes again`);
    return M.applyReading(q, next, M.validateMapReply(reply7({ parts: [newPart('new:b', '정합성 점검', at(next.ask, '|B02|', rec))] }), next.ask), meta(`R_rev50d${label}`));
  };
  const derived = run(asOlder(read), 'old');
  assert.deepEqual(derived.created, []); assert.ok(derived.reading.candidates.some(c => c.areaIds[0] === check && c.target === 'identity' && /같은 말/.test(c.text)));
  assert.equal(ledgerOf(derived.project).get(L.ledgerKey(KEY, 'C-PART', 'B02')).state, 'held');
  // A row this contract's own reading left waiting is no such backlog: the new part is made (names alone never hold it there).
  const own = run(read, 'own');
  assert.deepEqual(own.created.map(id => own.project.space.areas.find(a => a.id === id).name), ['정합성 점검']);
});

test('V50-14 (deadlock 6) items far past a count bound are named up to COUNT_NAMED_MAX, then grouped by list and record; the reading applies', () => {
  const p = project(page1()), inp = ask7(p), ask = inp.ask;
  for (const n of [40, 600]) {
    const rels = Array.from({ length: n }, (_, k) => { const [a, b] = PAIRS[k % 16]; return { from: `new:b${a + 1}`, to: `new:b${b + 1}`, kind: 'flow', note: `자료 ${k}`, at: at(ask, `|LN${pad((k % 16) + 1)}|`) }; });
    const reply = M.validateMapReply(reply7({ parts: NAMES.map((nm, k) => newPart(`new:b${k + 1}`, nm, at(ask, `|B${pad(k + 1)}|`))), relations: rels }), ask);
    const counts = M.readingExclusions(reply).filter(x => x.category === 'count');
    assert.ok(counts.length <= M.COUNT_NAMED_MAX + 1, `${n}: ${counts.length}`);
    assert.deepEqual(counts.slice(0, Math.min(M.COUNT_NAMED_MAX, n - 16)).map(x => x.path), Array.from({ length: Math.min(M.COUNT_NAMED_MAX, n - 16) }, (_, k) => `relations[${16 + k}]`));
    const applied = M.applyReading(p, inp, reply, meta(`R_rev50c${n}`)); roundTrip(applied.project);
  }
});

test('V50-15 (deadlock 1) the facts go last, part by part, so a map that fits without them is never TOO_LARGE for them', () => {
  const part = k => ({ id: `P${pad(k + 1)}`, name: `부분 ${k}`, note: '', parentId: null, readAs: null, role: '맡은 일', roleBy: 'reading', roleAbout: null, state: 'running', lastBasis: '8f5809d · 2020-11-18', files: ['src/a.py'], current: [] });
  const ask = { parts: Array.from({ length: 40 }, (_, k) => part(k)), relations: [] }, bare = structuredClone(ask);
  for (const x of bare.parts) { delete x.state; delete x.lastBasis; delete x.files; }
  const limit = JSON.stringify(bare).length + 200;
  assert.ok(M.fitMap(ask, '', true, () => JSON.stringify(ask).length <= limit));
  assert.ok(ask.parts.some(x => !Object.hasOwn(x, 'state')) && ask.parts.some(x => Object.hasOwn(x, 'state')), 'only as many as needed');
  assert.ok(ask.parts.every(x => ['state', 'lastBasis', 'files'].filter(k => Object.hasOwn(x, k)).length % 3 === 0), 'all three or none');
});

test('V50-16 (12) 「일부 구현」 ends no unbuilt state; 「구현됨」 of the same row does', () => {
  const p0 = project(page1({ names: ['수집기'], pairs: [], impl: () => '미구현' })), inp = ask7(p0);
  const first = M.applyReading(p0, inp, M.validateMapReply(reply7({ parts: [newPart('new:a', '수집기', at(inp.ask, '|B01|'))] }), inp.ask), meta('R_rev50u0')), area = areaOf(first.project, '수집기');
  assert.equal(M.partUnderstanding(first.project, area).stateRead.state, 'unbuilt');
  for (const [impl, want] of [['일부 구현', 'unbuilt'], ['구현됨', null]]) {
    const p = paste(first.project, page1({ names: ['수집기'], pairs: [], impl: () => impl })), a = ask7(p), rec = recOf(a.ask, '|B01|수집기|');
    const r = M.applyReading(p, a, M.validateMapReply(reply7({ parts: [oldPart(aliasOf(a, area), { claims: [claim(at(a.ask, '|B01|', rec), 's1', '수집기가 원문을 모은다.')] })] }), a.ask), meta(`R_rev50u${impl.length}`));
    assert.equal(M.partUnderstanding(r.project, area).stateRead?.state ?? null, want, impl);
  }
});

test('V50-17 (deadlock 10) a v5.2 record\'s P IDs are named in its note against the ask\'s own part ids', () => {
  const base = firstRead(project(page1())), roster = I.mapRoster(base), sorter = areaOf(base, '정리기'), pid = I.partNumber(base, sorter);
  const p = paste(base, recordB(roster.head, [[pid, '같음', 'B02', '—', 'F01']], { summary: `검토 시험 서비스, ${pid}와 겹칠 수 있음 (F01).` }));
  const inp = ask7(p), rec = inp.ask.records.find(r => M.askRecords(inp.ask).get(r.id).text.includes('겹칠 수 있음'));
  assert.ok(rec.note.includes(`이 기록의 Pxx는 기록 요청 대장 번호이며 이 요청의 부분 id가 아님: ${pid}=${aliasOf(inp, sorter)}`), rec.note);
  // A v5.1 record (no C-IDENT) says nothing of it.
  const q = paste(base, page1({ record: 'AF5-50f3f3f3', basis: 'f0c0de3', names: ['배달기'], pairs: [], summary: '배달 서비스, P03과 겹칠 수 있음 (F01).' }));
  assert.ok(ask7(q).ask.records.every(r => !r.note.includes('기록 요청 대장 번호')));
});

test('V50-18 (replay of the stage-4 save) rows sent again from pages already read never push the record\'s unread pages out of the ask', () => {
  // Page 1 read: with backlog, its B05 and B06 were placed nowhere (they wait); without, every part was placed. Pages 2 and 3 then come
  // unread, each a long run of link rows; under a tight byte bound the unread pages must go as far as they would with no backlog at all.
  const read = all => { const p0 = project(page1({ pairs: [] })), inp = ask7(p0);
    return M.applyReading(p0, inp, M.validateMapReply(reply7({ parts: NAMES.slice(0, all ? 6 : 4).map((n, k) => newPart(`new:b${k + 1}`, n, at(inp.ask, `|B${pad(k + 1)}|`))) }), inp.ask), meta(`R_rev50r${all ? 1 : 0}`)).project; };
  const later = (n, from, to) => [headOf(A, A_BASIS, n), table('C-PART', [partRow(`B${pad(5 + n)}`, `부분 ${n}`)]),
    table('C-LINK', Array.from({ length: to - from + 1 }, (_, k) => linkRow(`LN${pad(from + k)}`, `B${pad(1 + k % 6)}`, `B${pad(5 + n)}`, `자료 ${from + k}: ${'원문이 길게 설명하는 흐름 '.repeat(6)}`))),
    ends([['C-PART', `B${pad(5 + n)}`], ['C-LINK', `LN${pad(from)}–LN${pad(to)}`]]), '완료 단계: 첫 구조 완료'].join('\n');
  const grow = p => paste(paste(p, later(2, 1, 30)), later(3, 31, 60));
  const backlog = grow(read(false)), settled = grow(read(true)), late = p => new Set(p.pasted.slice(1).map(x => x.id));
  assert.deepEqual([...ledgerOf(backlog).values()].filter(x => x.state === 'waiting' && x.table === 'C-PART' && x.reading).map(x => x.id), ['B05', 'B06']);
  const unreadSent = (p, limits) => { const inp = M.buildMapAsk(p, I.currentView(p, studioView(p)), [], undefined, M.MAP7_SCHEMA, limits), ids = late(p);
    return { inp, chars: [...inp.records.values()].filter(r => ids.has(r.id)).reduce((s, r) => s + (r.to - Math.max(r.from, 0)), 0) }; };
  const wide = unreadSent(backlog, { records: 4, recordChars: 12000, bytes: M.MAP_BYTES });
  assert.ok(wide.inp.ask.records.some(r => /다시 보낸 행 2개: C-PART B05·B06/.test(r.note)), 'with room the waiting rows go again, named');
  const meta0 = new TextEncoder().encode(JSON.stringify({ ...wide.inp.ask, records: [] })).length;
  let tight = 0;
  for (let bytes = meta0 + 4000; bytes <= M.MAP_BYTES; bytes += 1500) {
    const limits = { records: 4, recordChars: 12000, bytes }, a = unreadSent(backlog, limits), b = unreadSent(settled, limits);
    assert.ok(a.chars >= b.chars, `${bytes} B: unread sent ${a.chars} with backlog, ${b.chars} without`);
    if (b.chars && !a.inp.ask.records.some(r => /다시 보낸 행/.test(r.note))) tight++;
  }
  assert.ok(tight > 0, 'some bound is tight enough that the backlog waits');
});
