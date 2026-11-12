// Recipe .54 (ruling F6 Q1 「선후 불명확 + 충돌 → 설명 교체만 보류」 and the review of .53): a bound record never replaces a description another
// bound record gave when the order of their targets is unclear (a candidate instead); the v5.3 record ask asks for the base commit's date;
// the card line keeps only its own sentence's plan clause; a cut never drops a plan word; 구현 바뀜 notes only a real, whole change, once; a
// 대신함 whose successor the same table says is a part that goes on is held (생애 변경 보류).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as I from '../dist/public/shared/map-identity.js';
import * as T from '../dist/public/shared/record-table.js';
import * as R from '../dist/public/shared/report-ask.js';
import * as S from '../dist/public/shared/studio.js';
import * as X from '../dist/public/shared/record-excerpt.js';
import { cautionRows, replacedHint } from '../dist/public/client/pane-view.js';
import { roleLine } from '../dist/public/client/card-face.js';
import { parseProject, validateProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';

const pad = n => String(n).padStart(2, '0');
const A = 'AF5-53a1b2c3', A_BASIS = '53c0de1', B = 'AF5-53e1e2e3', B_BASIS = 'e5c0de3';
/** A page head; with a date, the head names its 기준 시점 as a reconstructed record's does. */
const headOf = (record, basis, n, date = null) => `〔기록 ${record} · 쪽 ${n} · 기준 ${basis} · 앞 쪽 ${n > 1 ? n - 1 : '—'}〕 성장 시험 기록 v5 (시험 세션${date ? ` · 기준 시점 ${date} 10:00:00 +0000` : ''} · 작성 2026-11-13)`;
const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
const ends = list => table('C-END', list.map(([t, w]) => [t, '끝남', w, '—', '—']));
const partRow = (id, name, impl = '구현됨', line = `${name}의 일`) => [id, name, '처리 · 계산', line, 'F01', impl, 'F01'];
const linkRow = (id, a, b, what) => [id, a, b, what, '호출마다', '—', '같은 프로세스', '정의된 관계', 'F01'];
const NAMES = ['수집기', '정리기', '저장소', '검색기', '알림기', '화면'];
const PAIRS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
const ledgers = [table('C-SRC', [['F01', 'src/', 'B01', '읽음', '코드'], ['F02', 'docs/', '전체', '읽음', '문서']]), table('C-EVID', [['E01', '보고', 'c0ffee2 커밋', '—', '옮김']])];
const identTable = (echo, rows) => [`C-IDENT ${T.IDENT_TABLE.title}`, ...(echo ? [`대장: ${echo}`] : []), T.headerLine(T.IDENT_TABLE), '|---|---|---|---|---|---|', ...rows.map((r, k) => `|ID${pad(k + 1)}|${r.join('|')}|`)].join('\n');
/** Page 1 of a record: ledgers, head, C-PART rows (lines from `lines`, 구현 상태 from `impl`), C-IDENT (given) and C-LINK. */
function page1({ record = A, basis = A_BASIS, date = null, names = NAMES, pairs = PAIRS, impl = () => '구현됨', lines = {}, ident = null } = {}) {
  return [headOf(record, basis, 1, date), ...ledgers, table('C-HEAD', T.HEAD_ITEMS.map((item, k) => [item, `값 ${k + 1}`, 'F01'])), 'C-SUMMARY 요약\n성장 시험 서비스 (F01).',
    table('C-PART', names.map((n, k) => partRow(`B${pad(k + 1)}`, n, impl(k), lines[k]))), ...(ident ? [identTable(ident.echo, ident.rows)] : []),
    ...(pairs.length ? [table('C-LINK', pairs.map(([a, b], k) => linkRow(`LN${pad(k + 1)}`, `B${pad(a + 1)}`, `B${pad(b + 1)}`, `자료 ${k + 1}`)))] : []),
    ends([['C-HEAD', '—'], ['C-PART', `B01–B${pad(names.length)}`], ...(ident ? [['C-IDENT', `ID01–ID${pad(ident.rows.length)}`]] : []), ...(pairs.length ? [['C-LINK', `LN01–LN${pad(pairs.length)}`]] : [])]), '완료 단계: 첫 구조 완료'].join('\n');
}
let hashes = 0; const meta = id => ({ id, at: '2026-11-13T04:00:00.000Z', model: 'stub', prompt: 'm7-000000000054', hash: (++hashes).toString(16).padStart(64, '0') });
function project(...pages) {
  let p = D.addArea({ ...D.createProject(), name: '성장 시험' }, '기존 부분', '사람이 만든 부분');
  for (const t of pages) p = D.pasteRecord(p, t, null).project;
  return parseProject(JSON.stringify(p));
}
const paste = (p, t) => parseProject(JSON.stringify(D.pasteRecord(p, t, null).project));
const ask7 = p => M.buildMapAsk(p, I.currentView(p, studioView(p)), [], undefined, M.MAP7_SCHEMA);
const at = (ask, words, rec) => { for (const r of ask.records) { if (rec && r.id !== rec) continue; const s = r.spans.find(x => x.t.trimStart().startsWith(words)); if (s) return s.s; } throw new Error(`no piece ${words}`); };
const recOf = (ask, words) => ask.records.find(r => M.askRecords(ask).get(r.id).text.includes(words)).id;
const newPart = (ref, name, basis, o = {}) => ({ ref, name, parent: null, role: `${name}의 일을 맡는다.`, roleAboutAt: null, roleReplaces: null, basis: [basis], claims: [], ...o });
const reply7 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const areaOf = (p, name) => p.space.areas.find(a => a.name === name && !a.archived)?.id;
const aliasOf = (inp, id) => [...inp.parts].find(([, v]) => v === id)?.[0];
const rowsById = r => Object.fromEntries((r.identity ?? []).map(x => [x.id, x]));
const roundTrip = p => assert.deepEqual(validateProject(JSON.parse(serializeProject(p))), JSON.parse(serializeProject(p)));
let n = 0; const empty = p => { const inp = ask7(p); return M.applyReading(p, inp, M.validateMapReply(reply7({}), inp.ask), meta(`R_g54e${++n}`, 'x')); };
/** The first reading of record A (its six parts and five lines); P01 is the person's part, P02…P07 these six. */
function firstRead(p) {
  const inp = ask7(p), ask = inp.ask;
  const wire = reply7({ parts: NAMES.map((x, k) => newPart(`new:b${k + 1}`, x, at(ask, `|B${pad(k + 1)}|`))),
    relations: PAIRS.map(([a, b], k) => ({ from: `new:b${a + 1}`, to: `new:b${b + 1}`, kind: 'flow', note: `자료 ${k + 1}`, at: at(ask, `|LN${pad(k + 1)}|`) })) });
  return M.applyReading(p, inp, M.validateMapReply(wire, ask), meta('R_g54a', 'a')).project;
}
const B_NAMES = ['수집 서비스', '정리기', '새 저장소', '검색기', '웹 화면'];
/** Record B, a later session's record against the roster: rows as given; its own C-LINK row LN01 B02→B03 (a row naming B02). */
const recordB = (p, rows, o = {}) => paste(p, page1({ record: B, basis: B_BASIS, names: B_NAMES, pairs: [[1, 2]], ident: { echo: I.mapRoster(p).head, rows }, ...o }));
/** One reading whose reply describes the part on `name` anew, resting on the piece starting with `words` of record B. */
function describe(p, name, words, role) {
  const inp = ask7(p), ask = inp.ask, rec = recOf(ask, '|B03|새 저장소|'), ref = aliasOf(inp, areaOf(p, name));
  const wire = reply7({ parts: [{ ref, name: null, parent: null, role, roleAboutAt: null, roleReplaces: null, basis: [at(ask, words, rec)], claims: [] }] });
  return M.applyReading(p, inp, M.validateMapReply(wire, ask), meta(`R_g54d${++n}`, 'd'));
}
import { HELD_ORDER_HINT } from '../dist/public/client/pane-view.js';
import { handoverText } from '../dist/public/shared/handover.js';

const C = 'AF5-54c4c4c4', C_BASIS = 'c4c0de4';
/** Record C, a third session's record against the roster of p: one C-PART row B01 (its line given) that its C-IDENT row binds to `pid`. */
const recordC = (p, pid, line, o = {}) => paste(p, page1({ record: C, basis: C_BASIS, names: ['정리 단계'], pairs: [], lines: { 0: line }, ident: { echo: I.mapRoster(p).head, rows: [[pid, '같음', 'B01', '—', 'F01']] }, ...o }));
/** One reading whose reply describes the part on `name` anew, resting on the piece starting with `words` of the record holding `inRec`. */
function describeIn(p, name, inRec, words, role) {
  const inp = ask7(p), ask = inp.ask, rec = recOf(ask, inRec), ref = aliasOf(inp, areaOf(p, name));
  const wire = reply7({ parts: [{ ref, name: null, parent: null, role, roleAboutAt: null, roleReplaces: null, basis: [at(ask, words, rec)], claims: [] }] });
  return M.applyReading(p, inp, M.validateMapReply(wire, ask), meta(`R_g54d${++n}`, 'd'));
}
/** Record A (dated 2020-11-18) read first, then record B (dated 2021-03-01) binding 정리기 (P03): its line 「정리기의 일」 is the current
 * description, from a record that bound the part. */
function boundByB() {
  const base = firstRead(project(page1({ date: '2020-11-18' })));
  return empty(recordB(base, [['P03', '같음', 'B02', '—', 'F01']], { date: '2021-03-01' })).project;
}

/* ---------- 1. ruling F6 Q1: 선후 불명확 + 충돌 → 설명 교체만 보류 ---------- */
test('G54-1 a bound record whose order against the record that gave the current description is unclear never replaces it: a candidate', () => {
  const pB = boundByB(), tidy = areaOf(pB, '정리기');
  assert.equal(M.partUnderstanding(pB, tidy).role, '정리기의 일', 'B\'s line replaced the plain first-reading description');
  // Record C, undated, binds the same part with other words: B's stays, C's is a candidate (held 'order'), never 이전 설명.
  const out = empty(recordC(pB, 'P03', '원문을 새 규칙으로 정리한다')), u = M.partUnderstanding(out.project, tidy);
  assert.equal(u.role, '정리기의 일');
  assert.deepEqual(u.others.filter(x => x.text === '원문을 새 규칙으로 정리한다').map(x => [x.held, x.replaced ?? null]), [['order', null]]);
  assert.deepEqual(cautionRows(u, 0).filter(r => r.text === '원문을 새 규칙으로 정리한다').map(r => [r.label, r.hint]), [['설명 후보', HELD_ORDER_HINT]]);
  assert.ok(!/정정/.test(HELD_ORDER_HINT));
  // Only the description change is held: C's identity row binds the part as usual.
  assert.deepEqual([rowsById(out.reading).ID01.state, rowsById(out.reading).ID01.op?.kind], ['reflected', 'bind']);
  // The model's words resting on C's bound row are held the same way.
  const said = describeIn(recordC(pB, 'P03', '원문을 새 규칙으로 정리한다'), '정리기', '|B01|정리 단계|', '|B01|정리 단계|', '새 규칙으로 원문을 정리해 넘긴다.');
  const v = M.partUnderstanding(said.project, tidy);
  assert.equal(v.role, '정리기의 일');
  assert.ok(v.others.some(x => x.text === '새 규칙으로 원문을 정리해 넘긴다.' && x.held === 'order' && !x.replaced), JSON.stringify(v.others));
  // The same date is no clearer: held.
  assert.equal(M.partUnderstanding(empty(recordC(pB, 'P03', '원문을 새 규칙으로 정리한다', { date: '2021-03-01' })).project, tidy).role, '정리기의 일');
  // A later date: C replaces B's, which reads 이전 설명 with C's target.
  const later = M.partUnderstanding(empty(recordC(pB, 'P03', '원문을 새 규칙으로 정리한다', { date: '2022-01-01' })).project, tidy);
  assert.equal(later.role, '원문을 새 규칙으로 정리한다');
  assert.deepEqual(later.others.filter(x => x.text === '정리기의 일').map(x => [x.replaced, x.target]), [['bound', '2022-01-01']]);
  // An earlier date: never replaces, and not a held candidate either (clearly older).
  const older = M.partUnderstanding(empty(recordC(pB, 'P03', '원문을 새 규칙으로 정리한다', { date: '2020-01-01' })).project, tidy);
  assert.equal(older.role, '정리기의 일');
  assert.deepEqual(older.others.filter(x => x.text === '원문을 새 규칙으로 정리한다').map(x => [x.held ?? null, x.replaced ?? null]), [[null, null]]);
  // The same words change nothing and are no candidate.
  assert.ok(!M.partUnderstanding(empty(recordC(pB, 'P03', '정리기의 일')).project, tidy).others.some(x => x.held));
});

test('G54-1a the first bound description still replaces the plain first-reading description, dated or not (the .52 fix)', () => {
  for (const [a, b] of [[null, null], ['2020-11-18', null], [null, '2015-12-20'], ['2020-11-18', '2020-11-18']]) {
    const base = firstRead(project(page1({ date: a })));
    const u = M.partUnderstanding(empty(recordB(base, [['P03', '같음', 'B02', '—', 'F01']], { date: b })).project, areaOf(base, '정리기'));
    assert.equal(u.role, '정리기의 일', `${a} / ${b}`);
    assert.ok(u.others.some(x => x.text === '정리기의 일을 맡는다.' && x.replaced === 'bound'), `${a} / ${b}`);
  }
});

test('G54-1b the v5.3 record ask asks for the base commit\'s date in C-HEAD; v5.1 is unchanged; a dated 기준 커밋 row gives the target', () => {
  const base = firstRead(project(page1())), ask = R.recordAskV5('AF5-12345678', I.mapRoster(base));
  assert.ok(ask.startsWith('[AgentFlow 기록 요청 v5.3]'));
  assert.ok(ask.includes('기준 커밋(브랜치 · sha · 기준 커밋 날짜(YYYY-MM-DD) · 매니페스트 판본)'));
  const v51 = R.recordAskV5('AF5-12345678');
  assert.ok(v51.includes('기준 커밋(브랜치 · sha · 매니페스트 판본)') && !v51.includes('기준 커밋 날짜'));
  assert.equal(R.TABLE_NOTES_V5['C-HEAD'].includes('기준 커밋 날짜'), false);
  // Record C's 기준 커밋 row names its date (as v5.3 asks): later than B's 2021-03-01, so it replaces; earlier, it does not.
  const pB = boundByB(), tidy = areaOf(pB, '정리기');
  const withBasis = date => { const t = page1({ record: C, basis: C_BASIS, names: ['정리 단계'], pairs: [], lines: { 0: '원문을 새 규칙으로 정리한다' }, ident: { echo: I.mapRoster(pB).head, rows: [['P03', '같음', 'B01', '—', 'F01']] } });
    assert.ok(t.includes('|기준 커밋|값 1|F01|')); return paste(pB, t.replace('|기준 커밋|값 1|F01|', `|기준 커밋|main · ${C_BASIS} · ${date}|F01|`)); };
  assert.equal(M.partUnderstanding(empty(withBasis('2022-01-01')).project, tidy).role, '원문을 새 규칙으로 정리한다');
  assert.equal(M.partUnderstanding(empty(withBasis('2020-01-01')).project, tidy).role, '정리기의 일');
});

/* ---------- 2. the card line: only its own sentence's plan clause ---------- */
test('G54-2 the card line never joins a later sentence\'s plan word onto the first sentence; its own plan clause is kept at the clause boundary', () => {
  const pieces = (line, first) => line.split('…').map(x => x.trim()).filter(Boolean).every(x => first.includes(x));
  for (const [text, want] of [
    ['들어온 문서를 OCR로 읽어 색인한다. 검색 화면은 계획이다.', '들어온 문서를 OCR로 읽어 색인한다.'],
    ['주문을 받아 검증하고 저장소에 오래 남긴다. 알림은 아직 예정.', '주문을 받아 검증하고 저장소에 오래 남긴다.'],
    ['매일 밤 예정 작업 목록을 읽어 보낸다.', '매일 밤 예정 작업 목록을 읽어 보낸다.'],
    ['사용자에게 메일을 보낸다.', '사용자에게 메일을 보낸다.'],
    // No clause boundary before the plan word: the first sentence whole, as before .53.
    ['소비 폴더의 문서를 읽어 색인하도록 계획되어 있는 처리 단계다.', '소비 폴더의 문서를 읽어 색인하도록 계획되어 있는 처리 단계다.'],
  ]) assert.equal(roleLine(text), want, text);
  // A plan clause after a comma: 「head… clause」, every piece the sentence's own words.
  const first = '문서를 받아 색인하고 태그를 붙이며, 메일 알림은 예정이다.', line = roleLine(`${first} 그 밖은 그대로다.`);
  assert.ok(line.endsWith('… 메일 알림은 예정이다.') && pieces(line, first), line);
  assert.equal(S.planClause(first), '메일 알림은 예정이다.');
  assert.equal(S.planClause('원문을 정리하도록 계획된 처리다.'), null);
  // A clause too wide for the line: the sentence whole.
  const wide = '문서를 받아, 메일 알림과 화면 알림을 함께 보내도록 계획되어 있는 단계다.';
  assert.equal(roleLine(wide), wide);
});

/* ---------- 3. a cut never drops the plan word ---------- */
test('G54-3 a plan ending wider than the room keeps at least its plan word, measured in the same unit, or the text stays uncut', () => {
  const t = '주문서를 받아 결제 서버로 넘기는 일은 예정되어 있는 다음 단계.';
  const cut = S.clipKeepPlan(t, 15, S.textWidth);
  assert.ok(/예정/.test(cut) && S.textWidth(cut) <= 15, cut);
  assert.ok(cut.split('…').map(x => x.trim()).filter(Boolean).every(x => t.includes(x)), cut);
  // The ending is measured in the width unit: 14 wide characters at most.
  assert.equal(S.planTail('aaaaaaaaaaaaaaa예정'), null);
  assert.equal(S.planTail('aaaaaaaaaaaaaaa예정', S.textWidth), 'aaaaaaaaaaaaaaa예정');
  assert.equal(S.planTail('가나다라마바사아자차카타파하예정', S.textWidth), null);
  assert.equal(S.planTail('aaaaaaaaaaaaaaaaaaaa 예정이다', S.textWidth), '예정이다');
  // Too narrow for even the plan word: uncut, never a plain cut that drops it.
  assert.equal(S.clipKeepPlan('가나다라마바 예정', 4, S.textWidth), '가나다라마바 예정');
  // Wide enough: as .53.
  assert.ok(S.clipKeepPlan('a'.repeat(80) + ' 예정', 20).endsWith('… 예정'));
});

/* ---------- 4, 5. 구현 바뀜: a real change, whole, once ---------- */
test('G54-4 구현 바뀜 to the name the map already knows (X → X) or a change already noted binds only', () => {
  const base = firstRead(project(page1())), store = areaOf(base, '저장소');
  // The B row's name is the part's own name: no change to note.
  let out = empty(paste(base, page1({ record: B, basis: B_BASIS, names: ['수집 서비스', '정리기', '저장소'], pairs: [], ident: { echo: I.mapRoster(base).head, rows: [['P04', '구현 바뀜', 'B03', 'c0ffee2 2026-10-03', 'E01']] } })));
  assert.deepEqual([rowsById(out.reading).ID01.state, rowsById(out.reading).ID01.op?.kind], ['reflected', 'bind']);
  assert.deepEqual(I.implementationChanges(out.project, store), []);
  assert.ok(!I.mapRoster(out.project).text.includes('지금 구현'));
  assert.deepEqual(cautionRows(M.partUnderstanding(out.project, store), 0).filter(r => r.kind === 'implementation'), []);
  // A real change, then a second record saying the same change again: noted once.
  out = empty(recordB(base, [['P04', '구현 바뀜', 'B03', 'c0ffee2 2026-10-03', 'E01']]));
  assert.equal(rowsById(out.reading).ID01.op?.kind, 'reimplement');
  const again = empty(paste(out.project, page1({ record: 'AF5-54d4d4d4', basis: 'd4c0de4', names: ['수집 서비스', '정리기', '새 저장소'], pairs: [], ident: { echo: I.mapRoster(out.project).head, rows: [['P04', '구현 바뀜', 'B03', 'c0ffee2 2026-10-03', 'E01']] } })));
  assert.equal(rowsById(again.reading).ID01.op?.kind, 'bind');
  assert.deepEqual(I.implementationChanges(again.project, store).map(x => [x.from, x.to]), [['저장소', '새 저장소']]);
});

test('G54-5 a partial 구현 바뀜 (바뀐 때 「일부: …」 or a B row only partly built) binds only and never reads as the part\'s implementation', () => {
  const base = firstRead(project(page1())), store = areaOf(base, '저장소');
  for (const [rows, o] of [[[['P04', '구현 바뀜', 'B03', '일부: 색인만 c0ffee2', 'E01']], {}], [[['P04', '구현 바뀜', 'B03', 'c0ffee2 2026-10-03', 'E01']], { impl: k => (k === 2 ? '일부 구현' : '구현됨') }]]) {
    const out = empty(recordB(base, rows, o)), d = rowsById(out.reading);
    assert.deepEqual([d.ID01.state, d.ID01.op?.kind], ['reflected', 'bind']);
    assert.deepEqual(I.implementationChanges(out.project, store), []);
    assert.ok(!/지금 구현/.test(I.mapRoster(out.project).text));
    assert.ok(!I.identityState(out.project).retired.has(store));
  }
});

/* ---------- 6. every cut of a role keeps its plan word ---------- */
test('G54-6 the over-budget role cut of the map ask, the roster detail and the handover role keep the plan ending', () => {
  const long = `${'원문을 규칙대로 정리하고 '.repeat(20)}저장소에 넘기도록 계획됨`;
  const ask = { parts: [{ id: 'P1', current: [], role: long, note: '' }], relations: [] };
  assert.equal(M.fitMap(ask, '', false, () => ask.parts[0].role.length <= 120), true);
  assert.ok(ask.parts[0].role.length <= 120 && ask.parts[0].role.endsWith('계획됨'), ask.parts[0].role);
  // The roster's detail line (역할) and the handover's 역할 line.
  const base = firstRead(project(page1()));
  const p = empty(recordB(base, [['P03', '같음', 'B02', '—', 'F01']], { lines: { 1: `${'원문을 규칙대로 정리하고 '.repeat(30)}저장소에 넘기도록 계획됨` } })).project, tidy = areaOf(base, '정리기');
  const detail = I.mapRoster(p, { detail: [tidy] }).entries.find(e => e.areaId === tidy).detail;
  assert.ok(/^역할: .{1,140}$/.test(detail) && detail.endsWith('계획됨'), detail);
  const doc = handoverText(p, { scope: null, code: 'ABC234', at: '2026-11-13T05:00:00.000Z' }), line = doc.split('\n').find(l => l.startsWith('- 역할: ') && l.includes('원문을 규칙대로'));
  assert.ok(line && line.endsWith('계획됨'), line);
});

/* ---------- 7. 대신함 whose successor is a part that goes on: held ---------- */
test('G54-7 a 대신함 whose successor B row the same table gives a part that goes on (같음 or 구현 바뀜) is held; the part is never retired', () => {
  const base = firstRead(project(page1())), store = areaOf(base, '저장소'), search = areaOf(base, '검색기');
  for (const answer of ['같음', '구현 바뀜']) {
    const out = empty(recordB(base, [['P04', '대신함', 'B03', 'c0ffee2 2026-10-03', 'E01'], ['P05', answer, 'B03', 'c0ffee2 2026-10-03', 'F01']])), d = rowsById(out.reading);
    assert.deepEqual([d.ID01.state, d.ID01.reason, d.ID01.op], ['held', 'identity', null], answer);
    assert.ok(!I.identityState(out.project).retired.has(store), answer);
    assert.ok(I.currentView(out.project, studioView(out.project)).parts.some(x => x.id === store), answer);
    assert.equal(d.ID02.state, 'reflected', answer);
    assert.ok([...I.identityBindings(out.project, X.v5Folds(out.project.pasted), new Map())].some(([k, v]) => k.endsWith('\u0000C-PART\u0000B03') && v === search), answer);
  }
  // A held 같음 row on that B row (no evidence) holds the 대신함 too: the record still says the part goes on.
  assert.equal(rowsById(empty(recordB(base, [['P04', '대신함', 'B03', 'c0ffee2 2026-10-03', 'E01'], ['P05', '같음', 'B03', '—', '추정']])).reading).ID01.state, 'held');
  // A successor that is a new part (a reading made it for the B row; no row of the table says a map part is it) still retires.
  let p = recordB(base, [['P06', '대신함', 'B05', 'c0ffee3 2026-10-04', 'E01']]);
  { const inp = ask7(p); p = M.applyReading(p, inp, M.validateMapReply(reply7({ parts: [newPart('new:w', '웹 화면', at(inp.ask, '|B05|웹 화면|'))] }), inp.ask), meta(`R_g54w${++n}`, 'w')).project; }
  const done = empty(p), web = areaOf(done.project, '웹 화면');
  assert.ok(web);
  assert.equal(I.identityState(done.project).retired.get(areaOf(base, '알림기'))?.successor, web);
});
