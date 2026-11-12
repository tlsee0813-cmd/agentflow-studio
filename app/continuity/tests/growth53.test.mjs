// Recipe .53 (ruling F6 Q1 and Q3): guards on the .52 bound description (a record about a clearly earlier target never replaces the current
// description; the description rests on the bound row or a row naming it; no state is promoted; the earlier one reads 「이전 설명」, never a
// 정정; a cut keeps a plan ending), 구현 바뀜 (기록 요청 v5.3: a bind with the implementation change noted, never a retirement) and names (a
// 같음 row's other name is an alias candidate, never a rename; an explicit 이름 바뀜 is never swallowed by the .52 bind rule).
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
let hashes = 0; const meta = id => ({ id, at: '2026-11-13T04:00:00.000Z', model: 'stub', prompt: 'm7-000000000053', hash: (++hashes).toString(16).padStart(64, '0') });
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
let n = 0; const empty = p => { const inp = ask7(p); return M.applyReading(p, inp, M.validateMapReply(reply7({}), inp.ask), meta(`R_g53e${++n}`, 'x')); };
/** The first reading of record A (its six parts and five lines); P01 is the person's part, P02…P07 these six. */
function firstRead(p) {
  const inp = ask7(p), ask = inp.ask;
  const wire = reply7({ parts: NAMES.map((x, k) => newPart(`new:b${k + 1}`, x, at(ask, `|B${pad(k + 1)}|`))),
    relations: PAIRS.map(([a, b], k) => ({ from: `new:b${a + 1}`, to: `new:b${b + 1}`, kind: 'flow', note: `자료 ${k + 1}`, at: at(ask, `|LN${pad(k + 1)}|`) })) });
  return M.applyReading(p, inp, M.validateMapReply(wire, ask), meta('R_g53a', 'a')).project;
}
const B_NAMES = ['수집 서비스', '정리기', '새 저장소', '검색기', '웹 화면'];
/** Record B, a later session's record against the roster: rows as given; its own C-LINK row LN01 B02→B03 (a row naming B02). */
const recordB = (p, rows, o = {}) => paste(p, page1({ record: B, basis: B_BASIS, names: B_NAMES, pairs: [[1, 2]], ident: { echo: I.mapRoster(p).head, rows }, ...o }));
/** One reading whose reply describes the part on `name` anew, resting on the piece starting with `words` of record B. */
function describe(p, name, words, role) {
  const inp = ask7(p), ask = inp.ask, rec = recOf(ask, '|B03|새 저장소|'), ref = aliasOf(inp, areaOf(p, name));
  const wire = reply7({ parts: [{ ref, name: null, parent: null, role, roleAboutAt: null, roleReplaces: null, basis: [at(ask, words, rec)], claims: [] }] });
  return M.applyReading(p, inp, M.validateMapReply(wire, ask), meta(`R_g53d${++n}`, 'd'));
}

/* ---------- Q1: guards on the bound description ---------- */
test('G53-1 (a) a bound record about a clearly earlier target never replaces the description; undated or later does, and says its target', () => {
  const base = firstRead(project(page1({ date: '2020-11-18' })));
  // Earlier: its line reads beside the current description as another description, never as the earlier one.
  let u = M.partUnderstanding(empty(recordB(base, [['P03', '같음', 'B02', '—', 'F01']], { date: '2015-12-20' })).project, areaOf(base, '정리기'));
  assert.equal(u.role, '정리기의 일을 맡는다.');
  assert.deepEqual(u.others.map(x => [x.text, x.replaced ?? false]), [['정리기의 일', false]]);
  // The model's words of that record do not replace it either.
  const old = recordB(base, [['P03', '같음', 'B02', '—', 'F01']], { date: '2015-12-20' });
  u = M.partUnderstanding(describe(old, '정리기', '|B02|', '옛 판의 정리 설명이다.').project, areaOf(base, '정리기'));
  assert.equal(u.role, '정리기의 일을 맡는다.');
  // Later: the record's line takes the card; the earlier description says which target took over.
  u = M.partUnderstanding(empty(recordB(base, [['P03', '같음', 'B02', '—', 'F01']], { date: '2021-03-01' })).project, areaOf(base, '정리기'));
  assert.equal(u.role, '정리기의 일');
  assert.deepEqual(u.others.map(x => [x.text, x.replaced, x.target]), [['정리기의 일을 맡는다.', 'bound', '2021-03-01']]);
  // Undated (incomparable): the .52 rule stands, no target said.
  u = M.partUnderstanding(empty(recordB(base, [['P03', '같음', 'B02', '—', 'F01']])).project, areaOf(base, '정리기'));
  assert.equal(u.role, '정리기의 일');
  assert.deepEqual(u.others.map(x => [x.replaced, x.target ?? null]), [['bound', null]]);
  // The same date is not clearly earlier.
  u = M.partUnderstanding(empty(recordB(base, [['P03', '같음', 'B02', '—', 'F01']], { date: '2020-11-18' })).project, areaOf(base, '정리기'));
  assert.equal(u.role, '정리기의 일');
});

test('G53-1b (a) the target is read from the C-HEAD rows when the head line names none; a commit string alone never orders', () => {
  const base = firstRead(project(page1({ date: '2020-11-18' })));
  // Record B with no date in its head: its C-HEAD 작성 시각 row names 기준 시점 (earlier: no replacement; later: replaced).
  const withIdent = date => { const t = page1({ record: B, basis: B_BASIS, names: B_NAMES, pairs: [[1, 2]], ident: { echo: I.mapRoster(base).head, rows: [['P03', '같음', 'B02', '—', 'F01']] } });
    assert.ok(t.includes('|작성 시각|값 2|F01|')); return paste(base, t.replace('|작성 시각|값 2|F01|', `|작성 시각|2026-11-13 작성 · 기준 시점 ${date} 10:00|F01|`)); };
  assert.equal(M.partUnderstanding(empty(withIdent('2015-12-20')).project, areaOf(base, '정리기')).role, '정리기의 일을 맡는다.');
  assert.equal(M.partUnderstanding(empty(withIdent('2022-01-01')).project, areaOf(base, '정리기')).role, '정리기의 일');
  // Basis shas that sort below the current one's change nothing by themselves (no date: the .52 rule).
  const z = firstRead(project(page1({ basis: 'fffffff' })));
  assert.equal(M.partUnderstanding(empty(paste(z, page1({ record: B, basis: '0000000', names: B_NAMES, pairs: [[1, 2]], ident: { echo: I.mapRoster(z).head, rows: [['P03', '같음', 'B02', '—', 'F01']] } }))).project, areaOf(z, '정리기')).role, '정리기의 일');
});

test('G53-2 (b) a description update promotes no state: the part read as planned stays planned, its state read and implementation unchanged', () => {
  const base = firstRead(project(page1({ impl: k => (k === 1 ? '미구현' : '구현됨'), lines: { 1: '원문을 정리하도록 계획된 처리다' } })));
  const id = areaOf(base, '정리기'), before = M.partUnderstanding(base, id);
  assert.equal(before.stateRead?.state, 'unbuilt', 'the record read the part as not built');
  // B binds the part and describes it, its own row still 미구현 (only the description is new).
  const p = recordB(base, [['P03', '같음', 'B02', '—', 'F01']], { impl: k => (k === 1 ? '미구현' : '구현됨'), lines: { 1: '원문을 규칙대로 정리한다' } });
  const out = describe(p, '정리기', '|B02|', '원문을 규칙대로 정리해 저장소에 넘긴다.'), u = M.partUnderstanding(out.project, id);
  assert.equal(u.role, '원문을 규칙대로 정리해 저장소에 넘긴다.');
  assert.deepEqual([u.stateRead?.state ?? null, u.state], [before.stateRead?.state ?? null, before.state]);
  // The bound line alone (no words of the model) neither.
  const q = M.partUnderstanding(empty(p).project, id);
  assert.equal(q.role, '원문을 규칙대로 정리한다');
  assert.deepEqual([q.stateRead?.state ?? null, q.state], [before.stateRead?.state ?? null, before.state]);
  // The bind's reading part list holds nothing for the part: its implementation is not read from the description.
  assert.ok(!empty(p).reading.parts.some(x => x.areaId === id && x.implementation === 'built'));
});

test('G53-3 (c) the model\'s description counts as bound only when it rests on the bound row or a row naming it', () => {
  const base = firstRead(project(page1()));
  const p = recordB(base, [['P03', '같음', 'B02', '—', 'F01']]);
  // A line of record B that does not name B02 (its C-HEAD row): another description beside the current one.
  let u = M.partUnderstanding(describe(p, '정리기', '|기준 커밋|', '기준 행을 읽은 설명이다.').project, areaOf(base, '정리기'));
  assert.notEqual(u.role, '기준 행을 읽은 설명이다.');
  assert.ok(u.others.some(x => x.text === '기준 행을 읽은 설명이다.' && !x.replaced));
  // Its C-LINK row naming B02 (a line of that part): bound.
  u = M.partUnderstanding(describe(p, '정리기', '|LN01|', '정리한 원문을 저장소에 넘긴다.').project, areaOf(base, '정리기'));
  assert.equal(u.role, '정리한 원문을 저장소에 넘긴다.');
  // The row of another B (B03, not bound to this part): not bound.
  u = M.partUnderstanding(describe(p, '정리기', '|B03|', '새 저장소 설명이다.').project, areaOf(base, '정리기'));
  assert.notEqual(u.role, '새 저장소 설명이다.');
});

test('G53-4 (d) the earlier description is 「이전 설명」 with the adopted or target wording, never 정정', () => {
  assert.equal(replacedHint(null), '같은 부품에 대한 새 설명이 채택됨');
  assert.equal(replacedHint('2021-03-01'), '대상 2021-03-01 기록의 설명으로 갱신됨');
  const rows = cautionRows({ claims: [], roleBasisRevised: false, revised: false, corrected: null, others: [{ text: '옛 설명', about: null, replaced: 'bound', target: '2021-03-01' }, { text: '앞 설명', about: null, replaced: 'stated' }, { text: '곁 설명', about: null }] }, 0);
  assert.deepEqual(rows.map(r => [r.label, r.hint]), [['이전 설명', '대상 2021-03-01 기록의 설명으로 갱신됨'], ['이전 설명', '같은 부품에 대한 새 설명이 채택됨'], ['다른 설명', '다른 기록의 설명 · 현재 설명을 대체한다는 근거 없음']]);
  assert.ok(rows.every(r => !/정정/.test(r.label + r.hint)), 'a description update is never called 정정');
  // On a real project: the bound update reads the same way.
  const base = firstRead(project(page1({ date: '2020-11-18' })));
  const u = M.partUnderstanding(empty(recordB(base, [['P03', '같음', 'B02', '—', 'F01']], { date: '2021-03-01' })).project, areaOf(base, '정리기'));
  assert.deepEqual(cautionRows(u, 0).filter(r => r.kind === 'other-role').map(r => [r.label, r.hint]), [['이전 설명', '대상 2021-03-01 기록의 설명으로 갱신됨']]);
});

test('G53-5 a cut description keeps its trailing plan word (계획 · 예정): the middle goes, never the ending', () => {
  const long = 'cronjob이 정해진 때 실행하면 소비 폴더의 PDF를 차례로 OCR하고 로컬 데이터베이스에 색인하도록 계획된 처리다.';
  assert.equal(S.planTail(long), '계획된 처리다.');
  const cut = S.clipKeepPlan(long, 30);
  assert.ok(cut.length <= 30 && cut.endsWith(' 계획된 처리다.') && cut.includes('…'), cut);
  assert.equal(S.clipKeepPlan('짧은 설명(예정)', 30), '짧은 설명(예정)');
  assert.ok(S.clipKeepPlan('a'.repeat(80) + ' 예정', 20).endsWith('… 예정'));
  // No plan word: the plain cut.
  assert.equal(S.clipKeepPlan('가'.repeat(40), 10), `${'가'.repeat(9)}…`);
  // A plan word far from the end is no ending.
  assert.equal(S.planTail('계획대로 만든 저장소가 원문을 오래 보관하고 내준다'), null);
  // The card line: the plan ending stays on it.
  assert.ok(/계획된 처리다\.$/.test(roleLine(long)), roleLine(long));
  assert.equal(roleLine('주문을 받아 검증한다. 그 뒤 저장소에 쓴다.'), '주문을 받아 검증한다.');
  assert.ok(roleLine('주문을 받아 검증하고 저장소에 오래 남긴다. 알림은 아직 예정.').endsWith('예정.'));
  // The roster's distinguisher and the bound line keep it too.
  const base = firstRead(project(page1()));
  const p = empty(recordB(base, [['P03', '같음', 'B02', '—', 'F01']], { lines: { 1: `${'원문을 규칙대로 정리하고 '.repeat(30)}저장소에 넘기도록 계획됨` } })).project;
  const u = M.partUnderstanding(p, areaOf(base, '정리기'));
  assert.ok(u.role.length <= 300 && u.role.endsWith('계획됨') && u.role.includes('…'), u.role);
  assert.ok(/\nP03 정리기 · — · [^\n]*… 계획됨/.test(I.mapRoster(p).text), I.mapRoster(p).text);
});

/* ---------- Q3 (1): 구현 바뀜 ---------- */
test('G53-6 구현 바뀜 binds the part and notes the implementation change; the part is never retired or renamed; 대신함 still retires', () => {
  const base = firstRead(project(page1())), store = areaOf(base, '저장소'), search = areaOf(base, '검색기');
  const p = recordB(base, [['P04', '구현 바뀜', 'B03', 'c0ffee2 2026-10-03', 'E01'], ['P07', '같음', 'B05', '—', 'F01'], ['P06', '대신함', 'B05', 'c0ffee3 2026-10-04', 'E01']]);
  const out = empty(p), d = rowsById(out.reading);
  assert.deepEqual([d.ID01.answer, d.ID01.state, d.ID01.op], ['reimplemented', 'reflected', { kind: 'reimplement', areaId: store, successor: null, into: null, from: '저장소', to: '새 저장소', renamed: false }]);
  const s = I.identityState(out.project);
  assert.ok(!s.retired.has(store) && !s.renames.has(store), 'not retired, not renamed');
  assert.equal(I.officialName(out.project, store), '저장소');
  assert.ok(I.currentView(out.project, studioView(out.project)).parts.some(x => x.id === store), 'still on the current map');
  assert.deepEqual(I.implementationChanges(out.project, store).map(x => [x.from, x.to, x.when]), [['저장소', '새 저장소', 'c0ffee2 2026-10-03']]);
  // B03 is that part (its C-PART row binds there, as a 같음 row's would): no second card for 새 저장소.
  assert.ok([...I.identityBindings(out.project, X.v5Folds(out.project.pasted), new Map())].some(([k, v]) => k.endsWith('\u0000C-PART\u0000B03') && v === store));
  // The pane and the roster say it.
  const u = M.partUnderstanding(out.project, store);
  assert.deepEqual(u.identityNotes.map(x => [x.kind, x.from, x.text, x.when]), [['implementation', '저장소', '새 저장소', 'c0ffee2 2026-10-03']]);
  assert.deepEqual(cautionRows(u, 0).filter(r => r.kind === 'implementation').map(r => [r.label, r.text, r.hint]), [['구현 바뀜', '저장소 → 새 저장소', '같은 부품의 구현이 바뀜 · 바뀐 때 c0ffee2 2026-10-03']]);
  assert.ok(I.mapRoster(out.project).text.includes(`\nP04 저장소 · — · 있음 · `) && I.mapRoster(out.project).text.includes('지금 구현 새 저장소'));
  assert.equal(u.stateRead?.state ?? null, M.partUnderstanding(base, store).stateRead?.state ?? null, 'no state from the change');
  // 대신함 on 알림기 (P06), its successor B05 (화면, by the same table's 같음 row) built, still retires it.
  assert.equal(s.retired.get(areaOf(base, '알림기'))?.successor, areaOf(base, '화면'));
  // Read again (the record sent again): the change is noted once.
  const again = empty(out.project);
  assert.equal(rowsById(again.reading).ID01.op?.kind, 'bind');
  assert.equal(I.implementationChanges(again.project, store).length, 1);
  roundTrip(again.project);
  // A change still planned binds and notes nothing.
  const planned = empty(recordB(base, [['P04', '구현 바뀜', 'B03', '계획: 다음 판', 'E01']]));
  assert.deepEqual([rowsById(planned.reading).ID01.state, rowsById(planned.reading).ID01.op?.kind], ['reflected', 'bind']);
  assert.equal(I.implementationChanges(planned.project, store).length, 0);
  // Held like 같음 without evidence; a part the same table calls 구현 바뀜 and 대신함 is held.
  assert.equal(rowsById(empty(recordB(base, [['P04', '구현 바뀜', 'B03', 'c0ffee2', '추정']])).reading).ID01.state, 'held');
  const both = rowsById(empty(recordB(base, [['P05', '구현 바뀜', 'B04', 'c0ffee2', 'E01'], ['P05', '대신함', 'B03', 'c0ffee2', 'E01']])).reading);
  assert.deepEqual([both.ID01.state, both.ID02.state], ['reflected', 'held']);
  assert.ok(!I.identityState(empty(recordB(base, [['P05', '구현 바뀜', 'B04', 'c0ffee2', 'E01']])).project).retired.has(search));
  // Unclear: a 구현 바뀜 row on a B row the same table gives another part (같음) is held, never a fold of the two parts; the 같음 row binds.
  const shared = empty(recordB(base, [['P04', '구현 바뀜', 'B03', 'c0ffee2 2026-10-03', 'E01'], ['P05', '같음', 'B03', '—', 'F01']])), sd = rowsById(shared.reading);
  assert.deepEqual([sd.ID01.state, sd.ID01.reason, sd.ID02.state, sd.ID02.op?.kind], ['held', 'identity', 'reflected', 'bind']);
  assert.equal(I.identityState(shared.project).folded.size, 0);
  assert.ok(!I.identityState(shared.project).retired.has(store));
});

test('G53-7 the record ask v5.3: 구현 바뀜 and when to use which answer; a v5.2 record reads as before', () => {
  const base = firstRead(project(page1())), ask = R.recordAskV5('AF5-12345678', I.mapRoster(base));
  assert.ok(ask.startsWith('[AgentFlow 기록 요청 v5.3]'));
  for (const w of ['구현 바뀜(같은 책임이 이어지고 그 일을 하는 구현·도구·서비스만 바뀜)', '같음이나 구현 바뀜이고, 엔진·라이브러리·서비스를 바꿨어도 대신함이 아니다',
    '대신함은 그 부분 자체가 끝나고 다른 것이 넘겨받았을 때만 쓴다', '새것이 더해졌다는 것만으로 옛것이 끝났다고 보지 않는다', '같음·이름 바뀜·구현 바뀜·대신함이면 B ID 하나'])
    assert.ok(ask.includes(w), w);
  assert.ok(R.recordAskV5('AF5-12345678').startsWith('[AgentFlow 기록 요청 v5.1]'), 'no map: v5.1');
  // A v5.2 record's rows (같음, 이름 바뀜, 없어짐) decide as in .52.
  const d = rowsById(empty(recordB(base, [['P02', '이름 바뀜', 'B01', 'c0ffee1 2026-10-02', 'F01'], ['P03', '같음', 'B02', '—', 'F01'], ['P04', '없어짐', '—', 'c0ffee2 2026-10-03', 'E01']])).reading);
  assert.deepEqual([d.ID01.op?.kind, d.ID02.op?.kind, d.ID03.op?.kind], ['rename', 'bind', 'retire']);
});

/* ---------- Q3 (2): names ---------- */
test('G53-8 a 같음 row whose B row has another name keeps it as an alias candidate with its reason; the part is never renamed', () => {
  const base = firstRead(project(page1())), coll = areaOf(base, '수집기');
  const out = empty(recordB(base, [['P02', '같음', 'B01', '—', 'F01']])), d = rowsById(out.reading);
  assert.deepEqual([d.ID01.state, d.ID01.op?.kind, d.ID01.name], ['reflected', 'bind', '수집 서비스']);
  assert.equal(out.project.space.areas.find(a => a.id === coll).name, '수집기');
  assert.equal(I.officialName(out.project, coll), '수집기');
  assert.deepEqual(I.nameCandidates(out.project, coll).map(x => x.name), ['수집 서비스']);
  const u = M.partUnderstanding(out.project, coll);
  assert.deepEqual(cautionRows(u, 0).filter(r => r.kind === 'other-name').map(r => [r.label, r.text, r.hint]), [['다른 이름', '수집 서비스', '기록이 같은 부품이라고 하며 이 이름으로 부름 · 공식 이름은 그대로(별칭 후보)']]);
  assert.ok(I.mapRoster(out.project).text.includes('\nP02 수집기 · — · 있음 · ') && I.mapRoster(out.project).text.includes('기록이 부른 이름 수집 서비스'));
  // A name alike (qualifiers in brackets aside) is no candidate; nor is the same name.
  const same = rowsById(empty(recordB(base, [['P03', '같음', 'B02', '—', 'F01']])).reading);
  assert.equal(same.ID01.name, undefined);
  roundTrip(out.project);
});

test('G53-9 an explicit 이름 바뀜 is never swallowed by the .52 bind rule: after another record\'s bind (or 구현 바뀜) since its roster, it renames', () => {
  const base = firstRead(project(page1())), old = I.mapRoster(base), tidy = areaOf(base, '정리기');
  for (const answer of ['같음', '구현 바뀜']) {
    // Record C binds P03 (or notes its implementation change) against the old roster and is read.
    // Its reading also makes a part of its B02 (the map changed since the old roster: its hash differs).
    let p = paste(base, page1({ record: 'AF5-53c3c3c3', basis: 'c0c0de8', names: ['정리 엔진', '새 부품'], pairs: [], ident: { echo: old.head, rows: [['P03', answer, 'B01', 'c0ffee5 2026-10-05', 'F01']] } }));
    { const inp = ask7(p); p = M.applyReading(p, inp, M.validateMapReply(reply7({ parts: [newPart('new:c2', '새 부품', at(inp.ask, '|B02|새 부품|'))] }), inp.ask), meta(`R_g53c${++n}`, 'c')).project; }
    assert.notEqual(I.mapRoster(p).hash, old.hash);
    assert.equal(rowsById(p.readings.at(-1)).ID01.op?.kind, answer === '같음' ? 'bind' : 'reimplement');
    // Record B, written against the same old roster, says 이름 바뀜 for P03 → its B02 정돈기.
    p = paste(p, page1({ record: B, basis: B_BASIS, names: ['수집 서비스', '정돈기'], pairs: [], ident: { echo: old.head, rows: [['P03', '이름 바뀜', 'B02', 'c0ffee6 2026-10-06', 'F01']] } }));
    const out = empty(p), d = rowsById(out.reading);
    assert.deepEqual([d.ID01.state, d.ID01.op?.kind, d.ID01.op?.to], ['reflected', 'rename', '정돈기'], answer);
    assert.equal(out.project.space.areas.find(a => a.id === tidy).name, '정돈기', answer);
  }
});
