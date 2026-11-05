// Recipe .45 (map-reading.19, RECORD_ASKS_V5_KO.md 8.3–8.4 as 12 and 13 amend them): the program's reading of a 기록 v5 record (the
// fictional 물주기 record, fixtures/record45: page 1 the first structure, page 2 the detail, page 3 supplementary rows) with an author-written
// wire; the pipeline items of 13.7; the segment key set; the golden reading of the KORU 11-03 v3 records (as .44 read them, a family
// read from a typed part's type word aside). No model quality is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as S from '../dist/public/shared/storage.js';
import * as T from '../dist/public/shared/record-table.js';
import { studioView } from '../dist/public/shared/studio.js';
import { validateProject } from '../dist/public/shared/validation.js';
import * as B from '../server/map-blueprint.mjs';
import * as P from '../server/map-pipeline.mjs';
import { planMapPartitions } from '../server/map-partition.mjs';
import { familyOf, cardTemplate, undecidedChip, paneFamily } from '../dist/public/client/card-family.js';
import { goldenReadings, stripNew, stripFamily, normalizeIds } from './fixtures/koru43/golden.mjs';
import { stripNineteen } from './strip18.mjs';

const page = n => readFileSync(new URL(`./fixtures/record45/page${n}.txt`, import.meta.url), 'utf8');
const meta = (id, n) => ({ id, at: '2026-11-05T02:00:00.000Z', model: 'stub', prompt: 'm6-000000000045', hash: n.repeat(64) });
function ofPages(texts) {
  let project = D.createProject();
  for (const t of texts) project = D.pasteRecord(project, t, null).project;
  project = { ...project, pasted: project.pasted.map((r, i) => ({ ...r, at: new Date(Date.UTC(2026, 10, 5, 9, 0, i)).toISOString() })) };
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records.flatMap(r => r.spans);
  const at = head => { const hit = spans.filter(s => s.t.startsWith(head)); if (hit.length !== 1) throw new Error(`span ${head}: ${hit.length}`); return hit[0].s; };
  const has = head => spans.some(s => s.t.startsWith(head));
  return { project, input, ask: input.ask, at, has };
}
function wire45(f, extra = {}) {
  const part = (ref, name, head, x = {}) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [f.at(head)], claims: [], ...x });
  const claim = (key, head, x = {}) => ({ key, kind: 'reported', text: `원문 행을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null, ...x });
  const line = (from, to, head, x = {}) => ({ from, to, kind: 'flow', note: '', at: f.at(head), channel: 'data', mode: 'observed', ...x });
  const parts = [part('new:user', '사용자', '|B01|'), part('new:app', '물주기 앱', '|B02|'), part('new:api', '화분 API', '|B03|'),
    part('new:calc', '일정 계산기', '|B05|', { steps: !f.has('|B05:S01|') ? [] : [{ name: '기록 읽기', does: '마지막 급수 기록을 읽는다', uses: ['loadHistory()'], at: f.at('|B05:S01|') }, { name: '휴면 확인', does: '휴면이면 건너뜀', uses: ['isDormant()'], at: f.at('|B05:S02|') }] }),
    part('new:tick', '매시 틱', '|B06|'),
    part('new:push', '푸시 발송기', '|B07|푸시', { claims: [claim('s1', '|WD01|', { topic: 'withdrawn' }), ...(f.has('|CH02|') ? [claim('s2', '|CH02|', { topic: 'change' })] : [])] }),
    part('new:login', '로그인 검사', '|B09|'), part('new:cfg', 'config 모음', f.has('|B10|설정 모음|미정') ? '|B10|설정 모음|미정' : '|교체 B10|', { claims: [claim('s3', '|WD02|', { topic: 'withdrawn' })] }), ...(extra.parts ?? [])];
  const relations = [line('new:tick', 'new:calc', '|LN05|', { channel: 'control', payload: '깨우기' }), line('new:app', 'new:login', '|LN02|', { payload: 'D01 등록 요청' }), ...(extra.relations ?? [])];
  return { summary: '', parts, relations, candidates: [], gaps: [], matches: [], material: [] };
}
const read45 = (texts = [page(1), page(2), page(3)], extra) => { const f = ofPages(texts); return { f, read: M.validateMapReply(wire45(f, extra), f.ask, { setAside: true }) }; };
const byName = (read, name) => read.parts.find(p => p.name === name);

test('.45 golden: the KORU 11-03 v3 records read under .45 as .44 read them; a typed part only adds its family read from its type word (and a store, a timer, a person read plainly; a loop or an outside system kept as unclear)', () => {
  const now = goldenReadings({ D, M, studioView, B }), then = JSON.parse(readFileSync(new URL('./fixtures/koru43/golden44.json', import.meta.url), 'utf8'));
  assert.deepEqual(normalizeIds(stripFamily(stripNew(now))), normalizeIds(stripNew(then)));
  const fam = Object.values(now).flatMap(x => x.stored.parts.filter(p => p.type).map(p => [p.type, p.family, p.familyRole, p.familyUnclear]));
  assert.ok(fam.length > 0);
  for (const [type, family, role, unclear] of fam) {
    if (type === 'store') assert.deepEqual([family, role, unclear], ['store', '행 파일', false]);
    if (type === 'person') assert.deepEqual([family, role, unclear], ['participant', '사람', false]);
    if (type === 'loop' || type === 'external' || type === 'actor') assert.deepEqual([family, unclear], [null, true]);
  }
  assert.ok(Object.values(now).every(x => x.stored.version === 'map-reading.19' && x.stored.level === null && x.stored.pages.length === 0));
});

test('.45 parts are the program\'s: every C-PART row is a part (two the wire left out are added, one the wire named otherwise joins by its row), each with its family, role, 미정 reason, cites; the type only from a clear role', () => {
  const { read } = read45();
  // Recipe .48: a gate reads as a check (compute) by the family table; its family stays 관문.
  assert.deepEqual(read.parts.map(p => [p.name, p.recordRef, p.family, p.familyRole, p.type ?? null]), [
    ['사용자', 'B01', 'participant', '사용자', 'person'], ['물주기 앱', 'B02', 'process', '화면', 'screen'], ['화분 API', 'B03', 'process', '요청 처리', null],
    ['일정 계산기', 'B05', 'process', '계산', 'compute'], ['매시 틱', 'B06', 'trigger', '일정', 'timer'], ['푸시 발송기', 'B07', 'process', '외부 호출', 'actor'],
    ['로그인 검사', 'B09', 'gate', '인증', 'compute'], ['config 모음', 'B10', 'process', '설정 읽기', null], ['급수 기록 DB', 'B04', 'store', 'DB 테이블', 'store'], ['푸시 게이트웨이', 'B08', 'participant', '외부 시스템', 'external']]);
  assert.deepEqual(read.parts.slice(-2).map(p => [p.ref, p.basis.length, p.role]), [['new:rec-b04', 1, '화분과 급수 기록을 지닌다'], ['new:rec-b08', 1, '휴대폰으로 푸시를 전한다']]);
  assert.deepEqual(byName(read, '일정 계산기').cites.map(c => [c.ref, c.grade, c.source]), [['F03', 'file', 'server/schedule/']]);
  // Page 1 alone: B10 is 미정 with its reason, its loops unexpanded (no C-STEP row names them yet).
  const one = read45([page(1)]).read, cfg = byName(one, 'config 모음');
  assert.deepEqual([cfg.family, cfg.familyReason, cfg.familyRole], [null, 'mixed', null]);
  assert.deepEqual(byName(one, '매시 틱').loops.map(l => [l.recordRef, l.bodyState, l.body, l.bodyText]), [['B06:L01', 'unexpanded', [], 'B05의 단계']]);
  assert.deepEqual(one.level, 1);
  assert.equal(undecidedChip({ family: cfg.family, role: cfg.familyRole, reason: cfg.familyReason, unclear: false }), '미정: 서로 다른 역할 혼재');
});

test('.45 structure: loops linked to their C-STEP rows, C-STATE rows on their part, a C-GROUP 목록 row a list of items, a line\'s 주장 성격 (observed only for 실행 관측 with a run cite), shared data with no directed line', () => {
  const { read } = read45();
  assert.deepEqual(byName(read, '일정 계산기').loops.map(l => [l.recordRef, l.parentRef, l.bodyState, l.body]), [['B05:L01', 'B06:L01', 'linked', ['B05:S01', 'B05:S02', 'B05:S03', 'B05:S04']]]);
  assert.deepEqual(byName(read, '매시 틱').loops.map(l => [l.bodyState, l.body]), [['linked', ['B06:S01']]]);
  assert.deepEqual(byName(read, '물주기 앱').states.map(s => [s.name, s.event, s.next]), [['로그인 전', '로그인 성공', '목록 화면'], ['목록 화면', '토큰 만료', '로그인 전']]);
  assert.deepEqual(byName(read, '푸시 발송기').members, { ...byName(read, '푸시 발송기').members, count: 2, ordered: null, items: ['FCM 통로', 'APNs 통로'] });
  const line = (a, b) => read.relations.find(r => r.from === a && r.to === b);
  assert.deepEqual([line('new:tick', 'new:calc').mode, line('new:tick', 'new:calc').claimNature, line('new:tick', 'new:calc').cites.map(c => c.grade)], ['observed', 'run-observed', ['run']]);
  assert.deepEqual([line('new:app', 'new:login').mode, line('new:app', 'new:login').claimNature], ['design', 'defined'], 'a defined relation the model called observed is a design');
  const gw = line('new:push', 'new:rec-b08');
  assert.deepEqual([gw.mode, gw.claimNature, gw.cites.map(c => [c.ref, c.grade])], [null, 'run-report', [['E03', 'report']]], 'a run reported is no run observed');
  assert.ok(!read.relations.some(r => r.payloadRef === 'D03'), 'shared data draws no directed line');
  assert.deepEqual(read.artifacts.find(a => a.recordRef === 'D03').sharedBy, ['화분 API', '일정 계산기']);
  assert.deepEqual(byName(read, '급수 기록 DB').variants.map(v => [v.recordRef, v.together, v.togetherScope]), [['X02', 'per-data', '급수 기록만']]);
  assert.deepEqual(byName(read, '푸시 발송기').statusClaims.map(s => [s.value, s.scope, s.scopeKind]), [['inactive', '기본 꺼짐(PUSH_ENABLED=1)', 'default-off']]);
  assert.deepEqual(byName(read, 'config 모음').statusClaims.map(s => [s.value, s.scope, s.scopeKind]), [['inactive', null, 'unstated']], 'no range: never the whole part');
  const push = byName(read, '푸시 발송기');
  assert.deepEqual(push.claims.map(c => [c.topic, c.withdrawalMethod ?? null, c.foundBy ?? null, c.cites.map(x => x.ref)]), [['withdrawn', 'remove', null, ['E04']], ['change', null, 'search', ['E04']]]);
  assert.equal(byName(read, 'config 모음').claims[0].withdrawalMethod, 'doc-only');
  assert.deepEqual(byName(read, '일정 계산기').steps.map(s => [s.recordRef, s.cites.map(c => c.ref)]), [['B05:S01', ['F03']], ['B05:S02', ['F08']]]);
});

test('.45 the reading\'s own fields: level, pages, obligations, page ends, C-CHECK, C-HEAD defaults and first lines; stored as map-reading.19 exactly, a .18 entry kept as it was', () => {
  const { f, read } = read45();
  assert.deepEqual([read.level, read.pages.map(p => [p.n, p.prev, p.conflict])], [2, [[1, null, false], [2, 1, false], [3, 2, false]]]);
  assert.deepEqual(read.obligations.map(o => [o.kind, o.ref, o.candidate]), [['entry-unlinked', 'N02', true]]);
  assert.deepEqual(read.checks.map(c => [c.id, c.result]), [['CK1', 'yes'], ['CK2', 'yes'], ['CK3', 'no'], ['CK4', 'yes'], ['CK5', 'yes'], ['CK6', 'unchecked']]);
  assert.deepEqual(read.checks[0].found, ['B06', 'B06:L01']);
  assert.deepEqual(read.firstLines, ['매시 일정 계산과 푸시 발송', '화분 등록 요청']);
  assert.deepEqual(read.defaults.map(d => d.item), ['기준 커밋', '작성 시각', '읽은 범위', '못 읽은 범위', '클론', '실린 판본', '기본 행위자']);
  assert.equal(read.basisScope.text, 'server/ app/ README.md · 못 읽음: server/push/fcm.ts · 실행 안 함');
  assert.ok(read.pageEnds.some(e => e.page === 1 && e.table === 'C-LINK' && e.reserved.join() === 'D01,D02'));
  const applied = M.applyReading(f.project, f.input, read, meta('R_record45', '5'));
  assert.equal(applied.reading.version, 'map-reading.19');
  assert.deepEqual(validateProject(applied.project), applied.project);
  const raw = S.serializeProject(applied.project), bad = mutate => { const p = JSON.parse(raw); mutate(p.readings.at(-1)); return () => validateProject(p); };
  assert.throws(bad(r => { delete r.level; }));
  assert.throws(bad(r => { r.parts[0].family = 'engine'; }));
  assert.throws(bad(r => { r.relations[0].cites.push({ ref: 'E99', grade: 'measured', source: null, place: null, quote: null }); }));
  assert.throws(bad(r => { r.version = 'map-reading.18'; }), 'a .18 entry holds none of the .19 keys');
  const older = JSON.parse(raw), r18 = stripNineteen(older.readings.at(-1)); r18.version = 'map-reading.18';
  for (const p of r18.parts) { for (const v of p.variants ?? []) if (v.together === 'per-data') v.together = 'unknown'; for (const c of p.claims) if (c.withdrawalMethod === 'doc-only') c.withdrawalMethod = null; }
  assert.deepEqual(validateProject(older), older, 'a map-reading.18 entry keeps its shape');
});

test('.45 pipeline (13.7a): no maker × reader line from a D row a C-LINK row carries — the program draws none, and the combine sets a model\'s such line aside as a shortcut via C-LINK', () => {
  // D01 is made by the app and read by the API; the C-LINK rows carry it app → login → API, never app → API directly.
  const { read } = read45();
  assert.ok(!read.relations.some(r => r.from === 'new:app' && r.to === 'new:api'), 'no program line app → API from D01');
  const f = ofPages([page(1), page(2), page(3)]), at = f.at('|D01|');
  const wire = { relations: [{ from: 'new:app', to: 'new:api', kind: 'flow', note: '', at, channel: 'data', payload: '등록 요청' }, { from: 'new:app', to: 'new:login', kind: 'flow', note: '', at: f.at('|LN02|'), channel: 'data', payload: 'D01 등록 요청' }],
    parts: [{ ref: 'new:app', name: '물주기 앱' }, { ref: 'new:api', name: '화분 API' }, { ref: 'new:login', name: '로그인 검사' }] };
  // Review D1: D01 has one maker and one reader (no product): 13.7a leaves its line alone; the path the model draws through the login
  // check (app → login → API, both carrying D01) still makes it a shortcut (.42).
  assert.deepEqual(B.productLines(wire, f.ask), { merges: [], shortcuts: [], candidates: [] });
  const through = { ...wire, relations: [...wire.relations, { from: 'new:login', to: 'new:api', kind: 'flow', note: '', at: f.at('|LN03|'), channel: 'data', payload: 'D01 등록 요청' }] };
  assert.deepEqual(B.productLines(through, f.ask).shortcuts, [{ index: 0, via: 'new:login' }]);
  assert.ok(P.GLOBAL_RULES.includes('C-DATA 한 행의 만드는 부분과 읽는 부분을 짝지어 선을 만들지 않는다'));
});

test('.45 pipeline (13.7b): a line out of a store on a row that store does not send never takes the writer\'s condition; the writer\'s own half keeps it', () => {
  const p1 = page(1).replace('|LN04|B03|B04|화분 행|호출마다|—|', '|LN04|B03|B04|화분 행|호출마다|등록이 성공할 때만|');
  const { read } = read45([p1, page(2), page(3)], { parts: [], relations: [] });
  const f = ofPages([p1, page(2), page(3)]);
  const w = wire45(f, { parts: [{ ref: 'new:db', name: '급수 기록 DB', parent: null, role: 'DB의 책임', roleAbout: null, roleReplaces: null, basis: [f.at('|B04|')], claims: [] }],
    relations: [{ from: 'new:api', to: 'new:db', kind: 'flow', note: '', at: f.at('|LN04|'), channel: 'data', mode: 'design' }, { from: 'new:db', to: 'new:calc', kind: 'flow', note: '', at: f.at('|LN04|'), channel: 'data', mode: 'design' }] });
  const r = M.validateMapReply(w, f.ask, { setAside: true }), line = (a, b) => r.relations.find(x => x.from === a && x.to === b);
  assert.deepEqual([line('new:api', 'new:db').when, line('new:api', 'new:db').optional], ['등록이 성공할 때만', true]);
  assert.deepEqual([line('new:db', 'new:calc').when, line('new:db', 'new:calc').optional], [null, false]);
  assert.ok(read.parts.length > 0);
});

test('.45 pipeline (13.7c): supplementary rows land on their parts as the program\'s: P1-02 stages and P2-02 extension points as steps, P5-03 retries as conditions, P6-01 and P6-02 as settings', () => {
  const { read } = read45(), api = byName(read, '화분 API'), push = byName(read, '푸시 발송기');
  assert.deepEqual(api.steps.map(s => [s.name, s.does, s.program === true]), [['로그인 검사', '요청 헤더 → 토큰이 없으면 401로 멈춤', true], ['본문 검사', '{name, species} → 형식이 틀리면 400으로 멈춤', true]]);
  assert.deepEqual(push.steps.map(s => [s.name, s.does]), [['확장 접점: send(token, msg)', 'registerProvider() · 시작 시']]);
  assert.deepEqual(push.conditions.filter(c => /5xx/.test(c.when)).map(c => [c.when, c.then, c.else]), [['게이트웨이 5xx', '재시도: 3번, 1분 간격', '다음 매시 틱']]);
  assert.deepEqual(push.config, ['QUIET_HOURS=22-07', 'QUIET_HOURS ← 환경변수 23-06 (환경변수 > 기본값)']);
  assert.deepEqual(read.profileTables.map(t => t.table), ['P1-02', 'P2-02', 'P5-03', 'P6-01', 'P6-02']);
});

test('.45 pipeline (13.7d, e): one part-table row written as several parts, or a 목록 item written as a part, is list-split; a C-SUMMARY sentence draws no line', () => {
  const f = ofPages([page(1), page(2), page(3)]);
  const part = (ref, name, head) => ({ ref, name, parent: null, basis: [f.at(head)] });
  const wire = { parts: [part('new:user', '사용자', '|B01|'), part('new:user2', '사용자 2', '|B01|'), part('new:fcm', 'FCM 통로', '|GR02|'), part('new:push', '푸시 발송기', '|B07|푸시')] };
  assert.deepEqual(B.listSplitParts(wire, f.ask), [1, 2]);
  assert.ok(B.MAP_BLUEPRINT_PROMPT.includes('부분 표의 한 행(목록 한 줄, 기여자 목록 한 줄)은 부분 하나다'));
  const summary = f.ask.records.flatMap(r => r.spans).find(s => s.t.startsWith('매시 타이머가 일정 계산기를 깨우고'));
  const w = wire45(f, { relations: [{ from: 'new:tick', to: 'new:calc', kind: 'flow', note: '', at: summary.s, channel: 'control', mode: 'design' }] });
  const r = M.validateMapReply(w, f.ask, { setAside: true });
  assert.ok(M.readingExclusions(r).some(x => x.category === 'unrecorded' && /^relations\[2\]$/.test(x.path)), 'the summary sentence\'s line is set aside');
});

test('.45 segment key set: each segment carries only the B, F and E IDs it cites (a B with its name and one line), within MAP_RECORD_CHARS and MAP_BYTES on a 30-part record', () => {
  const rows = Array.from({ length: 30 }, (_, i) => { const n = String(i + 1).padStart(2, '0'); return `|B${n}|화분 부품 ${n}|처리 · 계산|부품 ${n}의 급수 단계를 맡는다|F${n}|구현됨|F${n}|`; });
  const files = Array.from({ length: 30 }, (_, i) => { const n = String(i + 1).padStart(2, '0'); return `|F${n}|server/part${n}/|B${n}|읽음|부품 ${n}|`; });
  const links = Array.from({ length: 29 }, (_, i) => { const a = String(i + 1).padStart(2, '0'), b = String(i + 2).padStart(2, '0'); return `|LN${a}|B${a}|B${b}|단계 결과|호출마다|—|같은 프로세스|정의된 관계|F${a}|`; });
  const text = ['〔기록 AF5-00000030 · 쪽 1 · 기준 abc1234 · 앞 쪽 —〕 큰 화분 기록 v5 (시험 세션, 2026-11-05 12:00)',
    'C-SRC 파일 장부', '|F ID|경로|속한 부분|읽음|역할|', '|---|---|---|---|---|', ...files,
    'C-PART 부분', '|행 ID|이름|표현군·역할|하는 일 한 줄|담당 F|구현 상태|근거|', '|---|---|---|---|---|---|---|', ...rows,
    'C-LINK 연결', '|행 ID|보내는 부분|받는 부분|넘기는 것|박자|조건·선택|경계|주장 성격|근거|', '|---|---|---|---|---|---|---|---|---|', ...links].join('\n');
  assert.ok(text.length <= M.MAP_RECORD_CHARS, String(text.length));
  const f = ofPages([text]), keys = P.keysOf(f.ask).keys;
  assert.equal(keys.length, 1); assert.equal(keys[0].parts.length, 30); assert.equal(keys[0].files.length, 30);
  assert.deepEqual(keys[0].parts[4], { id: 'B05', name: '화분 부품 05', does: '부품 05의 급수 단계를 맡는다' });
  const bytes = v => new TextEncoder().encode(JSON.stringify(v)).length;
  assert.ok(bytes(f.ask) + bytes(keys) <= M.MAP_BYTES, `${bytes(f.ask)} + ${bytes(keys)}`);
  // Each extraction partition: a closed set of the IDs its own spans cite, never the whole ledger.
  const parts = planMapPartitions(f.ask, { targetChars: 1500 });
  assert.ok(parts.length > 1);
  for (const part of parts) {
    const own = P.partitionKeysOf(f.ask, part).keys ?? [], said = new Set(part.records.flatMap(r => [r.lead, ...r.spans.map(s => s.t)]).join('\n').match(/(?<![A-Za-z0-9])[BFE]\d{1,3}(?!\d)/g) ?? []);
    for (const k of own) for (const x of [...k.parts, ...k.files, ...k.evidence]) assert.ok(said.has(x.id), x.id);
    assert.ok(own.every(k => k.parts.length < 30 || said.size >= 30));
  }
  // An ask with no v5 record carries no keys (its stage inputs stay as .44 sent them).
  assert.deepEqual(P.keysOf(ofPages(['오늘은 화분에 물을 줬다.']).ask), {});
});

test('.45 cards: the record family first (a gate in the trigger tint with its own glyph), the role word on the kind line for an untyped part, 「미정: 이유」 for a part with no family', () => {
  assert.equal(familyOf({ family: 'gate', type: null }), 'trigger'); assert.equal(familyOf({ family: 'store', type: 'compute' }), 'store'); assert.equal(familyOf({ family: null, type: 'timer' }), 'trigger');
  assert.equal(familyOf('person'), 'participant'); assert.equal(familyOf({ family: null, type: null }), 'neutral');
  const base = { type: null, config: [], inputs: [], outputs: [], fields: [], loop: null, steps: [], conditions: [] };
  const gate = cardTemplate({ ...base, family: { family: 'gate', role: '인증', reason: null, unclear: false } });
  assert.deepEqual([gate.family, gate.glyph, gate.kind, gate.undecided], ['trigger', 'gate', '인증', null]);
  const open = cardTemplate({ ...base, family: { family: null, role: null, reason: 'thin', unclear: false } });
  assert.deepEqual([open.family, open.kind, open.undecided], ['neutral', '미정: 책임 설명 부족', '미정: 책임 설명 부족']);
  const v4 = cardTemplate({ ...base, type: 'loop', family: { family: null, role: '루프·엔진', reason: null, unclear: true } });
  // Review N8: the card carries no 「대응 불명확」 chip (the pane head says it, undecidedChip).
  assert.deepEqual([v4.family, v4.kind, v4.undecided], ['process', '루프·엔진', null]);
  assert.equal(undecidedChip({ family: null, role: '루프·엔진', reason: null, unclear: true }), '대응 불명확: 루프·엔진');
});

test('.45 recipe: first-map-divided.45 and later-map-divided.45; the prompts read v5 records with their key sets', () => {
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.49', 'later-map-divided.49']);
  assert.ok(P.RENDER_RULES.includes('기록 v5(첫 줄이 「〔기록 … · 쪽 n · 기준 … · 앞 쪽 …〕」인 기록)') && B.MAP_BLUEPRINT_PROMPT.includes('INPUT 옆의 keys'));
  assert.ok(P.EXTRACTION_PROMPT.includes('input.keys'));
  assert.equal(T.recordVersion(page(1)), 'v5');
});

test('.45 with display slice S9: the pane head says the record family and role beside the kind word, 「미정: 이유」, or 「대응 불명확」 (the pane only, review N8)', () => {
  assert.deepEqual(paneFamily({ family: 'process', role: '실행 조정', reason: null, unclear: false }, null), { text: '표현군 처리 · 실행 조정', kind: 'family' });
  assert.deepEqual(paneFamily({ family: 'gate', role: '인증', reason: null, unclear: false }, '인증'), { text: '표현군 관문', kind: 'family' }, 'a role that repeats the kind word is left off');
  assert.deepEqual(paneFamily({ family: null, role: null, reason: 'mixed', unclear: false }), { text: '미정: 서로 다른 역할 혼재', kind: 'undecided' });
  assert.deepEqual(paneFamily({ family: null, role: '루프·엔진', reason: null, unclear: true }, '루프·엔진'), { text: '대응 불명확: 루프·엔진', kind: 'unclear' });
  assert.equal(paneFamily(null), null);
});
