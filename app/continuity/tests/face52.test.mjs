// Recipe .52 (growth retest of .51: the card face stayed the first reading's plan line): a record whose own C-IDENT row binds a map part
// (같음 / 이름 바뀜, with evidence, against the roster) describes that part as it is now, so its description takes the card and the old one
// is kept as the earlier description; a row binding nothing, a description resting on another record's lines or on lines pasted before the
// current one's, and the person's correction never change it. M1: another record's bind changes nothing the roster said, so it holds no row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as I from '../dist/public/shared/map-identity.js';
import * as T from '../dist/public/shared/record-table.js';
import * as X from '../dist/public/shared/record-excerpt.js';
import * as L from '../dist/public/shared/row-ledger.js';
import { parseProject, validateProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';

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
const later = (p, rows, o = {}) => paste(p, recordB(I.mapRoster(p).head, rows, o));
/** Applies one reading whose reply describes the part on `name` anew from the B row `brow` of record B. */
function describe(p, name, brow, role) {
  const inp = ask7(p), ask = inp.ask, rec = recOf(ask, '|B03|새 저장소|'), ref = aliasOf(inp, areaOf(p, name));
  const wire = reply7({ parts: [{ ref, name: null, parent: null, role, roleAboutAt: null, roleReplaces: null, basis: [at(ask, `|${brow}|`, rec)], claims: [] }] });
  return M.applyReading(p, inp, M.validateMapReply(wire, ask), meta(`R_face52${brow}`, 'c'));
}

test('F52-1 a record that binds the part by its own C-IDENT row gives the card its description; the first one is kept as the earlier description', () => {
  const p = later(firstRead(project(page1())), [['P03', '같음', 'B02', '—', 'F01']]);
  const before = M.partUnderstanding(p, areaOf(p, '정리기'));
  assert.equal(before.role, '정리기의 일을 맡는다.');
  const out = describe(p, '정리기', 'B02', '원문을 규칙대로 정리해 저장소에 넘긴다.'), u = M.partUnderstanding(out.project, areaOf(p, '정리기'));
  assert.deepEqual(rowsById(out.reading).ID01.op?.kind, 'bind');
  assert.equal(u.role, '원문을 규칙대로 정리해 저장소에 넘긴다.');
  assert.equal(u.roleBound, out.reading.at);
  assert.deepEqual(u.others.map(x => [x.text, x.replaced ?? false]), [['정리기의 일', 'bound'], ['정리기의 일을 맡는다.', 'bound']], 'the earlier descriptions are kept, newest first: the C-PART line of the record, then the first reading');
  // The roster the next record is asked with shows the new description.
  assert.ok(I.mapRoster(out.project).text.includes('정리기 · — · 있음 · 원문을 규칙대로 정리해'));
  roundTrip(out.project);
});

test('F52-2 no bind, no change: a part the record does not bind keeps its description; the new one reads beside it', () => {
  const p = later(firstRead(project(page1())), [['P03', '같음', 'B02', '—', 'F01']]);
  // 검색기 (B04) has no C-IDENT row: the reply reads B04 as 검색기 by its name only.
  const out = describe(p, '검색기', 'B04', '검색어로 저장소를 찾는다.'), u = M.partUnderstanding(out.project, areaOf(p, '검색기'));
  assert.equal(u.role, '검색기의 일을 맡는다.');
  assert.equal(u.roleBound, null);
  assert.deepEqual(u.others.map(x => [x.text, x.replaced ?? false]), [['검색어로 저장소를 찾는다.', false]]);
});

test('F52-3 a bind held or rejected (no evidence, 모름) changes nothing; the person\'s correction always stays', () => {
  for (const row of [['P03', '같음', 'B02', '—', '추정'], ['P03', '모름', 'B02', '—', 'F01']]) {
    const p = later(firstRead(project(page1())), [row]);
    const u = M.partUnderstanding(describe(p, '정리기', 'B02', '원문을 정리한다.').project, areaOf(p, '정리기'));
    assert.deepEqual([u.role, u.roleBound], ['정리기의 일을 맡는다.', null], row.join(' '));
  }
  let p = firstRead(project(page1()));
  p = parseProject(JSON.stringify(D.correctReadingRole(p, areaOf(p, '정리기'), '사람이 쓴 설명이다.')));
  p = later(p, [['P03', '같음', 'B02', '—', 'F01']]);
  const u = M.partUnderstanding(describe(p, '정리기', 'B02', '원문을 정리한다.').project, areaOf(p, '정리기'));
  assert.deepEqual([u.role, u.roleBound, !!u.corrected], ['사람이 쓴 설명이다.', null, true]);
});

test('F52-4 (M1) another record\'s bind since the roster holds nothing; its rename still holds the row on that part', () => {
  const base = firstRead(project(page1())), old = I.mapRoster(base);
  for (const [answer, want] of [['같음', ['reflected', 'bind']], ['이름 바뀜', ['held', null]]]) {
    let p = paste(base, page1({ record: 'AF5-52c3c3c3', basis: 'c0c0de8', names: ['정돈기'], pairs: [], ident: { echo: old.head, rows: [['P03', answer, 'B01', '—', 'F01']] } }));
    { const inp = ask7(p); p = M.applyReading(p, inp, M.validateMapReply(reply7({}), inp.ask), meta('R_face52k', '5')).project; }
    p = paste(p, recordB(old.head, [['P03', '같음', 'B02', '—', 'F01']]));
    const inp = ask7(p), d = rowsById(M.applyReading(p, inp, M.validateMapReply(reply7({}), inp.ask), meta('R_face52l', '6')).reading);
    assert.deepEqual([d.ID01.state, d.ID01.op?.kind ?? null], want, answer);
  }
});

test('F52-5 (M2b) a reply that writes no description of a bound part: the card takes the record\'s own C-PART line, quoted from its row', () => {
  const p = later(firstRead(project(page1())), [['P03', '같음', 'B02', '—', 'F01']]);
  const inp = ask7(p), out = M.applyReading(p, inp, M.validateMapReply(reply7({}), inp.ask), meta('R_face52m', 'd'));
  const u = M.partUnderstanding(out.project, areaOf(p, '정리기'));
  assert.equal(u.role, '정리기의 일');
  assert.equal(u.roleBasis.length, 1); assert.ok(u.roleBasis[0].quote.startsWith('|B02|정리기|'), u.roleBasis[0].quote);
  assert.equal(out.project.pasted.find(x => x.id === u.roleBasis[0].record).text.slice(u.roleBasis[0].from, u.roleBasis[0].to), u.roleBasis[0].quote, 'the quote stands where it says');
  assert.deepEqual(u.others.map(x => [x.text, x.replaced ?? false]), [['정리기의 일을 맡는다.', 'bound']]);
  // A part the record does not bind keeps its description.
  assert.equal(M.partUnderstanding(out.project, areaOf(p, '검색기')).role, '검색기의 일을 맡는다.');
  roundTrip(out.project);
});

/* ---------- review of .52 ---------- */
let emptyN = 0; const empty = (p, id) => { const inp = ask7(p); return M.applyReading(p, inp, M.validateMapReply(reply7({}), inp.ask), meta(id, '0123456789'[emptyN++ % 10])); };

test('F52-6 the same record sent again (a later page, its bind re-decided) never puts its bare line back over the model\'s description', () => {
  let p = describe(later(firstRead(project(page1())), [['P03', '같음', 'B02', '—', 'F01']]), '정리기', 'B02', '원문을 규칙대로 정리해 저장소에 넘긴다.').project;
  p = paste(p, [headOf(B, B_BASIS, 2), table('C-LINK', [linkRow('LN01', 'B01', 'B02', '자료 가')]), ends([['C-LINK', 'LN01–LN01']]), '완료 단계: 첫 구조 완료'].join('\n'));
  const out = empty(p, 'R_face52r'), u = M.partUnderstanding(out.project, areaOf(p, '정리기'));
  assert.equal(rowsById(out.reading).ID01.op?.kind, 'bind', 'the bind is decided again');
  assert.equal(u.role, '원문을 규칙대로 정리해 저장소에 넘긴다.');
  assert.deepEqual(u.others.map(x => x.text), ['정리기의 일', '정리기의 일을 맡는다.'], 'no entry twice');
});

test('F52-7 a record whose roster never showed the current description (an older session read later) does not replace it', () => {
  const base = firstRead(project(page1())), echo = I.mapRoster(base).head;
  let p = paste(base, page1({ record: 'AF5-52aaaaaa', basis: 'aaaa111', names: ['정리 엔진'], pairs: [], ident: { echo, rows: [['P03', '같음', 'B01', '—', 'F01']] } }));
  p = empty(p, 'R_face52y').project;
  assert.equal(M.partUnderstanding(p, areaOf(base, '정리기')).role, '정리 엔진의 일');
  // Same roster (판 1), pasted afterwards: it never saw 「정리 엔진의 일」.
  p = paste(p, page1({ record: 'AF5-52bbbbbb', basis: 'bbbb000', names: ['옛 정리기'], pairs: [], ident: { echo, rows: [['P03', '같음', 'B01', '—', 'F01']] } }));
  const u = M.partUnderstanding(empty(p, 'R_face52x').project, areaOf(base, '정리기'));
  assert.equal(u.role, '정리 엔진의 일');
  // A record written against the roster that showed it. Recipe .54 (ruling F6 Q1 「선후 불명확 + 충돌 → 설명 교체만 보류」): the current
  // description came from another record that bound the part and neither record names a target date, so the order is unclear: its words are
  // a candidate (held 'order') and the description stays. Dated records replace by a clearly later target (growth54 G54-1).
  const now = I.mapRoster(p).head;
  const q = paste(p, page1({ record: 'AF5-52cccccc', basis: 'cccc222', names: ['새 정리기'], pairs: [], ident: { echo: now, rows: [['P03', '같음', 'B01', '—', 'F01']] } }));
  const held = M.partUnderstanding(empty(q, 'R_face52z').project, areaOf(base, '정리기'));
  assert.equal(held.role, '정리 엔진의 일');
  assert.ok(held.others.some(x => x.text === '새 정리기의 일' && x.held === 'order'), JSON.stringify(held.others));
  // Its own words are taken only over a description no record bound: on the first-read map, the same record replaces it.
  const fresh = paste(base, page1({ record: 'AF5-52cccccc', basis: 'cccc222', names: ['새 정리기'], pairs: [], ident: { echo, rows: [['P03', '같음', 'B01', '—', 'F01']] } }));
  assert.equal(M.partUnderstanding(empty(fresh, 'R_face52w').project, areaOf(base, '정리기')).role, '새 정리기의 일');
});

test('F52-8 one pasted text holding two records: a description resting on the unbound record\'s lines never takes the card', () => {
  const base = firstRead(project(page1()));
  const pc = page1({ record: 'AF5-52c9c9c9', basis: 'c9c0de9', names: ['정돈 모듈'], pairs: [] }), pb = recordB(I.mapRoster(base).head, [['P03', '같음', 'B02', '—', 'F01']]);
  for (const text of [`${pc}\n\n${pb}`, `${pb}\n\n${pc}`]) {
    const p = paste(base, text), inp = ask7(p), ask = inp.ask;
    const q = ask.records.flatMap(r => r.spans).find(x => x.t.includes('|B01|정돈 모듈|')).s;
    const wire = reply7({ parts: [{ ref: aliasOf(inp, areaOf(p, '정리기')), name: null, parent: null, role: '정돈 모듈 설명이다.', roleAboutAt: null, roleReplaces: null, basis: [q], claims: [] }] });
    const u = M.partUnderstanding(M.applyReading(p, inp, M.validateMapReply(wire, ask), meta('R_face52s', 'f')).project, areaOf(p, '정리기'));
    assert.notEqual(u.role, '정돈 모듈 설명이다.');
    assert.equal(u.role, '정리기의 일', 'the bound record\'s own line');
  }
});

test('F52-9 a part only the bind describes (never read before) gets the line and a history entry; the pane tells bound from stated', () => {
  const p = later(firstRead(project(page1())), [['P01', '같음', 'B05', '—', 'F01']]), out = empty(p, 'R_face52p');
  const u = M.partUnderstanding(out.project, areaOf(p, '기존 부분'));
  assert.deepEqual([u.role, u.history.length, u.history[0].reading], ['웹 화면의 일', 1, out.reading.id]);
  assert.ok(I.mapRoster(out.project).text.includes('\nP01 기존 부분 · — · 있음 · 웹 화면의 일'));
});
