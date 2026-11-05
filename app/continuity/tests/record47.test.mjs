// Recipe .47: a 기록 v5 record goes to a map reading as its fold, never as its newest pastes cut at a length. A fictional 도서관 record of
// 30 parts written over five pages in four pastes: a first draft of page 1 replaced by the next paste, page 2 pasted again later
// (latest wins), a C-DROP, a 교체 row and a supplementary page. The ask carries Q1 first, no replaced or dropped text, every piece
// verbatim where it stands (quotes anchored), within the first-map bounds of the divided route; under the shared bounds it goes in page
// order and is read on from its cut; the reading's level and obligations are the whole record's; v4 and v3 asks are byte for byte .46's.
// No model is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as T from '../dist/public/shared/record-table.js';
import * as X from '../dist/public/shared/record-excerpt.js';
import * as J from '../dist/public/shared/map-job.js';
import * as Route from '../dist/public/shared/map-route.js';
import * as St from '../dist/public/shared/studio.js';
import { foldLevel } from '../dist/public/shared/record-reading.js';
import { validateProject } from '../dist/public/shared/validation.js';
import { planMapPartitions } from '../server/map-partition.mjs';
import * as P from '../server/map-pipeline.mjs';
import { goldenDigests } from './record47-golden.mjs';

/* ---------- the fictional record ---------- */
const pad = n => String(n).padStart(2, '0'), b = i => `B${pad(i)}`, f = i => `F${pad((i % 10) + 1)}`;
const head = (n, prev) => `〔기록 AF5-7d1e2f30 · 쪽 ${n} · 기준 c0ffee1 · 앞 쪽 ${prev ?? '—'}〕 도서관 기록 v5 (시험 세션, 2026-11-05 11:${pad(n)})`;
const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
const ends = (list, level) => `${table('C-END', list.map(([t, w]) => [t, '끝남', w, '—', '—']))}\n완료 단계: ${level}`;
const page1 = (draft = false) => [head(1),
  table('C-SRC', Array.from({ length: 10 }, (_, k) => [`F${pad(k + 1)}`, `src/area${k + 1}/`, b(k + 3), '읽음', `구역 ${k + 1}의 코드`])),
  table('C-EVID', [['E01', '파일', 'F01', 'main()', '대출 창구를 연다'], ['E02', '실행', 'rg -n "loan" src/', '1–3행', 'loan open'], ['E03', '보고', 'PR #12', '본문', '반납 알림을 붙인다']]),
  table('C-HEAD', T.HEAD_ITEMS.map((item, k) => [item, k === 7 ? '대출 신청과 반납 알림' : `값 ${k + 1}`, k % 2 ? '—' : 'F01'])),
  'C-SUMMARY 요약\n도서관 대출 서비스는 회원이 책을 빌리고 반납하면 알림을 보낸다 (F01).\n대출 창구가 서고 관리로 이어진다 (F02+E01).',
  table('C-PART', Array.from({ length: 30 }, (_, k) => { const i = k + 1;
    return [b(i), draft && i === 9 ? '초안 부분' : `도서관 부분 ${pad(i)}`, i === 1 ? '참여 · 사용자' : i === 2 ? '저장 · DB 테이블' : '처리 · 계산', `부분 ${pad(i)}이 맡은 일을 한 줄로 적는다`, f(i), '구현됨', f(i)]; })),
  ends([['C-HEAD', '—'], ['C-PART', 'B01–B30']], '진행 중'), '다음: C-GROUP'].join('\n');
const page2 = (later = false) => [head(2, 1),
  table('C-GROUP', [['GR01', '서버 프로세스', 'B03·B04·B05', '실행 위치', 'F01']]),
  table('C-LINK', [...Array.from({ length: 29 }, (_, k) => { const i = k + 1;
    return [`LN${pad(i)}`, b(i), b(i + 1), i === 7 ? (later ? '반납 알림' : '옛 반납 신호') : `넘김 ${pad(i)}`, '호출마다', '—', '같은 프로세스', '정의된 관계', f(i)]; }),
    ...(later ? [['LN30', 'B07', 'B13', '연체 표시', '사건 때', '—', '같은 프로세스', '정의된 관계', 'F08']] : [])]),
  table('C-LOOP', [['B05:L01', 'B05', '—', '책마다', '목록 끝까지', '목록 끝', '단계', 'F06']]),
  table('C-STATE', [['SM01', 'B03', '대출 전', '대출', '대출 중', 'F04']]),
  table('C-WITHDRAW', [['WD01', 'B04', '종이 카드', '전산 기록', '제거', '—', 'F05']]),
  table('C-STATUS', [['ST01', '전체', '유지 방침', '기능 개발', '—', '—', 'F01']]),
  table('C-CHECK', Object.entries(T.CHECK_ROWS).map(([id, name]) => [id, name, '없음', '—', 'rg -n x src/', 'F01'])),
  ends([['C-GROUP', 'GR01'], ['C-LINK', later ? 'LN01–LN30' : 'LN01–LN29'], ['C-LOOP', 'B05:L01'], ['C-STATE', 'SM01'], ['C-WITHDRAW', 'WD01'], ['C-STATUS', 'ST01'], ['C-CHECK', 'CK1–CK6']], '첫 구조 완료')].join('\n');
const steps = () => Array.from({ length: 30 }, (_, k) => k + 1).flatMap(i => [1, 2, 3, 4, 5, 6].map(s => [`${b(i)}:S${pad(s)}`, `단계 ${pad(i)}-${s}`,
  i === 5 && s === 3 ? '옛 단계 문구: 책 목록을 다시 읽는다' : `부분 ${pad(i)}의 ${s}번째 일을 하고 결과를 다음 단계로 넘긴다(시험용 설명: 대출 기록을 읽고 회원과 책의 상태를 확인한 뒤 고친다)`, `fn${i}_${s}()`, i === 5 ? 'B05:L01' : '—', '—', f(i)]));
const page3 = () => [head(3, 2), table('C-STEP', steps()),
  table('C-DATA', [['D01', '대출 기록', '저장', 'member, book, at', 'B03', 'B04', 'data/loans.json (덧붙임)', 'F04'], ['D02', '반납 알림', '메시지·신호', 'member, book', 'B07', 'B08', '—', 'F08']]),
  ends([['C-STEP', 'B01:S01–B30:S06'], ['C-DATA', 'D01–D02']], '첫 구조 완료')].join('\n');
const page4 = () => [head(4, 3),
  table('C-STEP', [['교체 B05:S03', '단계 05-3', '고친 단계 문구: 책 목록을 한 번만 읽는다', 'fn5_3()', 'B05:L01', '—', 'F06']]),
  table('C-COND', [1, 2, 3, 4].map(k => [`CD${pad(k)}`, b(k + 2), k === 3 ? '지울 조건 문구' : `조건 ${k}`, '참이면 진행', '거짓이면 멈춤', '실행 시', f(k)])),
  table('C-CHANGE', [['CH01', '2026-10-01', '작성: 메인테이너', '반납 알림', 'B07', '알림을 붙임', '최근', '—', '미확인', 'E03']]),
  table('C-RULE', [['RU01', 'B03', '한 사람이 열 권까지', '메인테이너 · 2026-09', '코드', 'src/area1/', 'F01']]),
  table('C-ENTRY', [['N01', 'main()', 'B01', '사용자', '명령', '—', 'F01']]),
  table('C-VARIANT', [['X01', 'K01', 'B08', '설정', '알림 켬', '배타', 'F08']]),
  table('C-CONTRACT', [['K01', 'B08', '회원 휴대폰', '푸시 · 나감', '본문 형식', '1.0', 'F08']]),
  table('C-ISSUE', [['IS01', 'B09', '연체 계산이 하루 늦다', '2026-10', 'F09'], ['IS02', 'B12', '알림 문구가 영어로 나간다', '2026-11', 'F03']]),
  table('C-GATE', [['GT01', 'B07', '알림 시험 통과', '배포', '—', '이번 주', 'F08']]),
  table('C-UNKNOWN', [['UN01', 'B10', '서고 동기화 주기', '설정 파일을 읽는다']]),
  table('C-DOUBT', [['DB01', 'B11', '반납 알림의 재시도', '추정']]),
  table('C-DROP', [['CD03', '잘못 쓴 조건', '앱 진단']]),
  ends([['C-STEP', 'B05:S03'], ['C-COND', 'CD01–CD04'], ['C-CHANGE', 'CH01'], ['C-RULE', 'RU01'], ['C-ENTRY', 'N01'], ['C-VARIANT', 'X01'], ['C-CONTRACT', 'K01'], ['C-ISSUE', 'IS01–IS02'], ['C-GATE', 'GT01'], ['C-UNKNOWN', 'UN01'], ['C-DOUBT', 'DB01']], '상세 완료')].join('\n');
const page5 = () => [head(5, 4),
  table('P1-02', [1, 2, 3].map(k => [`사슬 ${k}`, String(k), b(k + 2), '요청', '다음으로', `P1-02.${k}`, 'F01'])),
  ends([['P1-02', 'P1-02.1–P1-02.3']], '상세 완료')].join('\n');
/** The pastes, as pasted: a draft of page 1 (replaced next), pages 1–2, pages 3–4, page 2 again with page 5. */
const PASTES = () => [page1(true), `${page1()}\n\n${page2()}`, `${page3()}\n\n${page4()}`, `${page2(true)}\n\n${page5()}`];
/** Text that no longer stands: the draft's part name, page 2's first text, the replaced step, the dropped condition, the C-DROP table. */
const GONE = ['초안 부분', '옛 반납 신호', '옛 단계 문구', '지울 조건 문구', 'C-DROP', '잘못 쓴 조건'];

function project(texts = PASTES()) {
  let p = D.createProject(); p = { ...p, name: '도서관' };
  for (const t of texts) p = D.pasteRecord(p, t, null).project;
  return { ...p, pasted: p.pasted.map((r, i) => ({ ...r, at: new Date(Date.UTC(2026, 10, 5, 11, i)).toISOString() })) };
}
const OFFER = { model: 'deepseek-flash', prompt: 'm6-000000000000', laterPrompt: 'm7-000000000000',
  first: { model: 'x', prompt: 'm6-111111111111', ready: true, method: 'divided', monthlyUsd: 200, runUsd: 3, partitions: 24, partitionChars: 3500, deepseekMaxCalls: 48 },
  later: { model: 'x', prompt: 'm7-111111111111', ready: true, method: 'divided', monthlyUsd: 200, runUsd: 3, partitions: 12, partitionChars: 3500, deepseekMaxCalls: 24 } };
/** As the browser builds a first map on the divided route (map-run.ts prepared): built, routed, rebuilt within the route's bounds, fitted. */
function divided(p, limits) {
  const first = M.buildMapAsk(p, St.studioView(p), [], undefined, M.MAP6_SCHEMA), route = Route.mapRoute(first.ask, OFFER);
  assert.equal(route.route, 'divided-first');
  return { route, inp: Route.fitMapInput(M.buildMapAsk(p, St.studioView(p), [], undefined, M.MAP6_SCHEMA, limits ?? route.limits), route) };
}
const texts = inp => inp.ask.records.map(r => M.askRecords(inp.ask).get(r.id).text);
const aliasOf = (inp, head) => { const hit = inp.ask.records.flatMap(r => r.spans).filter(s => s.t.startsWith(head)); assert.equal(hit.length, 1, `${head}: ${hit.length}`); return hit[0].s; };
const meta = (id, n) => ({ id, at: '2026-11-05T03:00:00.000Z', model: 'stub', prompt: 'm6-000000000047', hash: n.repeat(64) });
const wireOf = inp => ({ summary: '도서관 대출 서비스의 첫 지도.', candidates: [], gaps: [], matches: [], material: [],
  parts: [{ ref: 'new:p03', name: '도서관 부분 03', parent: null, role: '대출을 받는다', roleAbout: null, roleReplaces: null, basis: [aliasOf(inp, '|B03|')], claims: [] }],
  relations: [] });
/** The queue of each table with rows, in the order the ask reads them (ledgers, page ends and the head apart). */
function queues(inp) {
  const out = [];
  for (const t of texts(inp)) for (const x of T.readRecordTables(t).tables) {
    const d = T.V5_TABLE_DEFS.get(x.id); if (!d || !x.rows.length || ['C-SRC', 'C-EVID', 'C-END', 'C-HEAD'].includes(x.id)) continue;
    out.push(d.queue);
  }
  return out;
}

test('R47-1 the divided first map sends the whole fold: Q1 first, page by page, no replaced or dropped text, every piece verbatim, within the first-map bounds', () => {
  const p = project(), { route, inp } = divided(p);
  assert.deepEqual([route.limits.records, route.limits.recordChars, route.limits.bytes, route.limits.spans, route.limits.partitions], [16, 48000, 163840, 960, 24]);
  assert.equal(inp.problem, null);
  // Four records, one per run of pages: page 1 (2nd paste), page 2 (4th paste: it replaced the 2nd's), pages 3–4 (3rd), page 5 (4th).
  const ids = p.pasted.map(r => r.id);
  assert.deepEqual([...inp.records.values()].map(r => ids.indexOf(r.id)), [1, 3, 2, 3]);
  assert.deepEqual(inp.ask.records.map(r => /접은 판\(쪽 ([\d·]+)\)/.exec(r.note)?.[1]), ['1', '2', '3·4', '5']);
  // The draft of page 1 holds no current page: nothing of it goes and it is no fresh record.
  assert.deepEqual(inp.coverage, { fresh: 3, sent: 4, partial: 0 });
  const all = texts(inp).join('\n');
  for (const gone of GONE) assert.ok(!all.includes(gone), gone);
  for (const kept of ['고친 단계 문구', '반납 알림', 'LN30', 'P1-02.3', '도서관 부분 30']) assert.ok(all.includes(kept), kept);
  // Q1 → Q2 → Q3, never back.
  const q = queues(inp); assert.deepEqual(q, [...q].sort((a, b) => a - b)); assert.deepEqual([...new Set(q)], [1, 2, 3]);
  // Every current row goes: the fold's rows (all but the ledgers no row cites) are each a line of the ask, as pasted.
  const fold = T.latestFold(p.pasted.map(r => r.text));
  for (const [t, rows] of fold.rows) if (t !== 'C-SRC' && t !== 'C-EVID') for (const r of rows) {
    const src = p.pasted.find(x => x.text.slice(r.row.from, r.row.to).length && [...inp.records.values()].some(y => y.id === x.id && y.pieces.some(z => z.from <= r.row.from && r.row.to <= z.to)));
    assert.ok(src, `${t} ${r.id}`);
  }
  // Each piece stands in its pasted text where it says, and the excerpt is the pieces joined by gap lines only.
  for (const r of inp.records.values()) assert.ok(X.piecesStand(p.pasted.find(x => x.id === r.id).text, r.total, r.text, r.pieces));
  assert.ok(all.includes(X.GAP_ROW), 'the replaced step stands as an empty row in its table');
  // Within the bounds: the server reads it as asked and cuts it into at most 24 partitions.
  M.validateMapAsk(inp.ask);
  assert.ok(new TextEncoder().encode(JSON.stringify(inp.ask)).length <= M.MAP_FIRST_BYTES);
  assert.ok(planMapPartitions(inp.ask, { targetChars: 3500, maxPartitions: 24 }).length <= 24);
  assert.ok(Route.withinRoute(inp.ask, route));
  // The job carries the pieces (map-input.2) and gives back exactly what was built.
  const wire = J.encodeMapInput(inp), back = J.decodeMapInput(JSON.parse(JSON.stringify(wire)));
  assert.equal(wire.version, 'map-input.2');
  assert.deepEqual([...back.records], [...inp.records]);
  const bad = JSON.parse(JSON.stringify(wire)); bad.records[0][1].pieces[1].at += 1;
  assert.throws(() => J.decodeMapInput(bad), /INVALID_INPUT/);
});

test('R47-2 quotes stay anchored: a reading on the fold stores each quote where it stands in its pasted text, map-reading.19, and the record is read', () => {
  const p = project(), { inp } = divided(p);
  const reply = M.validateMapReply(wireOf(inp), inp.ask), applied = M.applyReading(p, inp, reply, meta('R_record47', '7'));
  assert.equal(applied.reading.version, 'map-reading.19');
  assert.deepEqual(validateProject(applied.project), applied.project);
  // Every C-PART row is a part (the program's), each standing on its own row of the pasted text.
  const parts = applied.reading.parts;
  assert.equal(parts.length, 30);
  for (const x of parts) for (const q of x.basis) assert.equal(p.pasted.find(r => r.id === q.record).text.slice(q.from, q.to), q.quote);
  // One read interval per record of the ask (two for the 4th paste), the text's last run to its end.
  assert.deepEqual(applied.reading.records.map(r => [p.pasted.findIndex(x => x.id === r.id), r.to === r.total]), [[1, true], [3, false], [2, true], [3, true]]);
  // Nothing is fresh any more: the draft no current page holds is no record to read.
  assert.equal(M.buildMapAsk(applied.project, St.studioView(applied.project), [], undefined, M.MAP6_SCHEMA).problem, 'NOTHING_NEW');
});

test('R47-3 no anchored range of a v5 record crosses a gap line: the empty row where the replaced step stood, or a blank line', () => {
  const p = project(), { inp } = divided(p);
  const rec = inp.ask.records.find(r => r.spans.some(s => s.t === X.GAP_ROW)), i = rec.spans.findIndex(s => s.t === X.GAP_ROW);
  const across = `${rec.id}.${pad(i)}-${pad(i + 2)}`, text = M.askRecords(inp.ask).get(rec.id).text;
  const sp = M.askRecords(inp.ask).get(rec.id).spans;
  assert.ok(M.crossesGap(text, sp[i - 1].from, sp[i + 1].to));
  assert.ok(!M.crossesGap(text, sp[i - 1].from, sp[i - 1].to));
  const wire = wireOf(inp); wire.parts[0].claims = [{ key: 's1', kind: 'reported', text: '단계를 옮긴다.', at: across, about: null, replaces: null }];
  const r = M.validateMapReply(wire, inp.ask, { setAside: true });
  assert.deepEqual(M.readingExclusions(r).map(x => `${x.path}:${x.rule}`), ['parts[0].claims[0].at:reference']);
  // A v4 record's blank lines are its own: the rule is the v5 fold's only.
  assert.ok(!M.crossesGap('〔기록 AF4-1 · 덩이 1 · 기준 a〕 x 기록 v4\n\n| a |\n', 0, 30));
});

test('R47-4 what does not fit leaves out Q3 rows first, then the least connected Q2 rows, each named; Q1 always goes; the reading keeps the whole record\'s level and obligations', () => {
  const p = project(), whole = divided(p).inp, size = new TextEncoder().encode(JSON.stringify(whole.ask)).length;
  const limits = { ...divided(p).route.limits, bytes: size - 2500 }, { inp } = divided(p, limits);
  assert.equal(inp.problem, null);
  assert.ok(new TextEncoder().encode(JSON.stringify(inp.ask)).length <= limits.bytes);
  const all = texts(inp).join('\n'), notes = inp.ask.records.map(r => r.note).join(' ');
  // Q3 first: every supplementary row is left out, and said.
  assert.ok(!/\|P1-02\.\d\|/.test(all));
  assert.ok(/분량상 빼고 보낸 행 \d+개: .*P1-02 3행/.test(notes), notes);
  // Then Q2 rows (the least connected parts' first): some go, some are left and named; every Q1 row stays.
  const left = [...inp.records.values()].reduce((n, r) => n + r.left, 0);
  assert.ok(left > 3 && inp.coverage.partial > 0, JSON.stringify(inp.coverage));
  const fold = T.latestFold(p.pasted.map(r => r.text));
  for (const t of T.Q1_TABLES) for (const r of fold.rows.get(t) ?? []) assert.ok(all.includes(r.row.cells.map(c => c.raw).join('|').slice(0, 30)), `${t} ${r.id}`);
  const sent = (fold.rows.get('C-STEP') ?? []).filter(r => all.includes(`|${r.id}|`) || all.includes(`|교체 ${r.id}|`)).length;
  assert.ok(sent > 0 && sent < 180, String(sent));
  // The program reads the whole record: the reading's level and obligations are the fold of every pasted text, not of what went.
  const applied = M.applyReading(p, inp, M.validateMapReply(wireOf(inp), inp.ask), meta('R_record47b', '8'));
  const full = foldLevel(fold), askFold = foldLevel(T.foldPages(inp.ask.records.map(r => ({ record: r.id, text: M.askRecords(inp.ask).get(r.id).text })), 'newest-first')[0]);
  assert.deepEqual([applied.reading.level, applied.reading.obligations], [full.level, full.obligations]);
  assert.notDeepEqual(askFold.obligations, full.obligations, 'the ask alone would read another record');
  assert.deepEqual(validateProject(applied.project), applied.project);
});

test('R47-5 within the shared bounds the fold goes in page order, the last record cut at a line, and the next reading goes on from the cut', () => {
  const p = project(), inp = M.buildMapAsk(p, St.studioView(p), [], undefined, M.MAP6_SCHEMA);
  assert.equal(inp.problem, null);
  assert.ok(new TextEncoder().encode(JSON.stringify(inp.ask)).length <= M.MAP_BYTES);
  assert.deepEqual(inp.ask.records.map(r => /접은 판\(쪽 ([\d·]+)\)/.exec(r.note)?.[1]), ['1', '2', '3·4']);
  const last = [...inp.records.values()].at(-1), note = inp.ask.records.at(-1).note;
  assert.ok(/분량상 이 원문 (\d+)자부터\(행 \d+개\)는 다음 정리에서 읽음 · 이번에 보내지 못한 쪽: 5/.test(note), note);
  assert.ok(last.left > 0 && last.to < last.total && last.text.length <= M.MAP_RECORD_CHARS);
  for (const gone of GONE) assert.ok(!texts(inp).join('\n').includes(gone), gone);
  const applied = M.applyReading(p, inp, M.validateMapReply(wireOf(inp), inp.ask), meta('R_record47c', '9'));
  const next = M.buildMapAsk(applied.project, St.studioView(applied.project), [], undefined, M.MAP6_SCHEMA);
  // From the cut on: pages 3–4's rows past it, then page 5; none of the rows read before goes again.
  assert.equal(next.problem, null);
  const first = [...next.records.values()][0], nextText = texts(next).join('\n'), cutRow = p.pasted.find(r => r.id === last.id).text.slice(last.to).match(/\|B\d\d:S\d\d\|/)[0];
  assert.equal(first.id, last.id);
  assert.ok(nextText.includes(cutRow) && !nextText.includes('|B01:S01|'), cutRow);
  assert.ok(next.ask.records.some(r => /쪽 5/.test(r.note)));
});

test('R47-6 v4 and v3 asks are byte for byte what .46 built (golden), whatever bounds are given; the recipe is .47 and the contract map-reading.19', () => {
  const golden = JSON.parse(readFileSync(new URL('./fixtures/record47/v4-golden.json', import.meta.url), 'utf8')), mods = { D, M, S: St, J };
  assert.deepEqual(goldenDigests(mods), golden);
  assert.deepEqual(goldenDigests(mods, Route.mapRoute({ schemaVersion: M.MAP6_SCHEMA, parts: [], requests: [], priors: [] }, OFFER).limits), golden);
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.48', 'later-map-divided.48']);
});

test('R47-7 the bounds: a first map.6 ask may be a whole fold, every other ask keeps 64 KiB, four records and 12,000 characters each', () => {
  const p = project(), { inp } = divided(p), big = new TextEncoder().encode(JSON.stringify(inp.ask)).length;
  assert.ok(big > M.MAP_BYTES, String(big));
  M.validateMapAsk(inp.ask);
  // The same records asked as a later map (map.7: a part already on the map) are past the shared bounds.
  const later = { ...structuredClone(inp.ask), schemaVersion: M.MAP7_SCHEMA, parts: [{ id: 'P01', name: '도서관 부분 03', note: '', parentId: null, readAs: null, role: '', roleBy: null, roleAbout: null, current: [] }] };
  assert.throws(() => M.validateMapAsk(later), /INPUT_TOO_LARGE|INVALID/);
  // A host offering no divided first map routes it single, and refuses it past the shared bounds.
  const single = Route.mapRoute(inp.ask, { model: 'deepseek-flash', prompt: 'm6-000000000000' });
  assert.equal(single.route, 'single'); assert.ok(!Route.withinRoute(inp.ask, single));
  assert.deepEqual([M.askLimits(later).bytes, M.askLimits(inp.ask).bytes], [M.MAP_BYTES, M.MAP_FIRST_BYTES]);
});
