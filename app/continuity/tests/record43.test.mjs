// first-map-divided.43 (map-reading.18, RECORD_ASKS_V4_KO.md 4.3–4.6, 4.10): the program's reading of a 기록 v4 record (two chunks of the
// fictional 책갈피 정리기, fixtures/record43) with an author-written wire, and the golden reading of the KORU 11-03 v3 records
// (fixtures/koru43: .43 reads them as .42 did, a rule's decider aside). No model quality is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as S from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';
import { validateProject } from '../dist/public/shared/validation.js';
import * as B from '../server/map-blueprint.mjs';
import * as P from '../server/map-pipeline.mjs';
import { ofChunks, wire43 } from './fixtures/record43/wire.mjs';
import { goldenReadings, stripNew, stripFamily, normalizeIds } from './fixtures/koru43/golden.mjs';
import { stripEighteen } from './strip18.mjs';

const mods = { D, M, studioView };
const meta = (id, n) => ({ id, at: '2026-11-05T01:00:00.000Z', model: 'stub', prompt: 'm6-000000000043', hash: n.repeat(64) });
const read43 = () => { const f = ofChunks(mods); return { f, read: M.validateMapReply(wire43(f), f.ask, { setAside: true }) }; };
const byName = (read, name) => read.parts.find(p => p.name === name);
const head = q => q?.quote.slice(0, 20) ?? null;

test('.43 golden: the KORU 11-03 v3 status and design records (and the R4 hand-kept rules) read as .42 read them: same parts, claims, relations, loops and devices; only a rule\'s decidedBy is new', () => {
  const now = goldenReadings({ D, M, studioView, B }), then = JSON.parse(readFileSync(new URL('./fixtures/koru43/golden42.json', import.meta.url), 'utf8'));
  assert.deepEqual(normalizeIds(stripFamily(stripNew(now))), normalizeIds(stripNew(then)));
  // The hand-kept rules keep their person device, on the same row with the same words.
  const devices = r => r.stored.parts.flatMap(p => p.claims.flatMap(c => (c.enforcedBy ?? []).map(e => [e.kind, e.text, e.program])));
  assert.deepEqual(devices(now.r4), devices(then.r4));
  assert.deepEqual(devices(now.r4).filter(d => d[0] === 'person'), [['person', '소유자 10-24 [파일: docs/RUNBOOK.md]', true], ['person', '소유자 10-02 [파일: docs/RUNBOOK.md]', true]]);
  // decidedBy is stored for a v3 rule row's 누가 정했나·언제 (the device stays the .42 one).
  assert.deepEqual(now.r4.stored.parts[0].claims.map(c => c.decidedBy?.text), ['소유자 10-24', '소유자 10-30', '소유자 09-29']);
  assert.ok(Object.values(now).every(x => x.stored.version === 'map-reading.19'));
});

test('.43 parts: C-PART type (화면, 빌드·배포 자동화 too), 구현 상태, row ID and list items; C-GROUP 묶음 뜻; C-STATUS claims; the state derived (running only from 운영 상태 「실행 중」)', () => {
  const { read } = read43();
  assert.deepEqual(read.parts.map(p => [p.name, p.type, p.recordRef, p.implementation ?? null, p.state ?? null]), [
    ['사용자', 'person', 'B01', null, null], ['tidy 명령', 'compute', 'B02', 'built', null], ['정리 엔진', 'loop', 'B03', 'built', null],
    ['북마크 저장소', 'store', 'B04', 'built', null], ['내보내기 어댑터', 'actor', 'B05', 'built', null], ['동기화 데몬', 'loop', 'B06', 'partial', 'running'],
    ['웹 화면', 'screen', 'B07', 'unbuilt', 'unbuilt'], ['배포 작업', 'automation', 'B08', 'built', null], ['사용자 코드', 'external', 'B09', null, null]]);
  // The model's running on the library engine is never kept: implemented is not running.
  assert.equal(byName(read, '정리 엔진').state, null);
  assert.deepEqual([byName(read, '동기화 데몬').stateWhen, head(byName(read, '동기화 데몬').stateQuote)], ['2026-11-01 10:00', '| 동기화 데몬 | 운영 상태 | 실']);
  assert.deepEqual(byName(read, '내보내기 어댑터').members, { ...byName(read, '내보내기 어댑터').members, count: 2, ordered: false, items: ['HTML 내보내기', 'JSON 내보내기'] });
  assert.equal(byName(read, '내보내기 어댑터').groupAxis, 'members');
  assert.deepEqual(byName(read, 'tidy 명령').statusClaims.map(s => [s.dimension, s.value, s.scope, s.basis]), [['release', 'released', 'v2.0.0 · npm', null]]);
  assert.deepEqual(read.projectStatus.map(s => [s.target, s.dimension, s.value, s.successor]), [['전체', 'maintenance', 'ended', 'tidy2']]);
});

test('.43 loops, steps and branches: C-LOOP with stable IDs and a parent loop of another part; a step\'s row ID, loops, branch group, 조건·분기 clauses and model', () => {
  const { read } = read43(), engine = byName(read, '정리 엔진'), sync = byName(read, '동기화 데몬');
  assert.deepEqual(engine.loops.map(l => [l.recordRef, l.parentRef, l.parentPart, l.body, l.unit, l.count, l.stop]), [['B03:L01', null, null, ['B03:S02', 'B03:S03', 'B03:S03a', 'B03:S03b'], '북마크마다', 'len(items)', '목록 끝']]);
  assert.deepEqual(sync.loops.map(l => [l.recordRef, l.parentRef, l.parentPart]), [['B06:L01', 'B03:L01', '정리 엔진']]);
  assert.deepEqual([engine.loop.unit, engine.loop.stop, engine.loop.program], ['북마크마다', '목록 끝', true], 'the outermost loop is the part\'s loop too');
  assert.deepEqual(engine.steps.map(s => [s.recordRef, s.loopIds, s.alt, s.model]), [['B03:S01', [], null, null], ['B03:S02', ['B03:L01'], null, null],
    ['B03:S03a', ['B03:L01'], { group: 'S03', branch: 'a' }, null], ['B03:S03b', ['B03:L01'], { group: 'S03', branch: 'b' }, null], ['B03:S04', [], null, 'tidy-ranker']]);
  assert.deepEqual(engine.steps[2].branch, [{ when: 'dupes > max_dupes', to: ['B03:S04'], max: null, outcome: null }]);
  assert.deepEqual(engine.steps[4].branch, [{ when: '실패하면', to: ['B03:S01'], max: '최대 3번', outcome: null }]);
  assert.deepEqual(engine.conditions.map(c => c.phase), ['run']);
  assert.deepEqual(sync.conditions.map(c => [c.when, c.phase]), [['SYNC_ON || --sync', 'config']]);
});

test('.43 variants, entries and contracts: on the interface\'s owner with choice and exclusivity; an entry\'s consumer that is a part gets a control line, one that is none gets no made-up part (entry-consumer)', () => {
  const { read } = read43(), engine = byName(read, '정리 엔진');
  assert.deepEqual(engine.variants.map(v => [v.recordRef, v.interfaceRef, v.implementer, v.selector, v.condition, v.together, v.togetherScope]), [
    ['X01', 'K01', '내보내기 어댑터', { who: '사용자 설정', how: 'given', when: '호출마다' }, '--format=html', 'exclusive', '호출마다'],
    ['X02', 'K01', '내보내기 어댑터', { who: '사용자 설정', how: 'fallback', when: '호출마다' }, '--format=json', 'unknown', null]]);
  assert.deepEqual(byName(read, '사용자 코드').variants.map(v => [v.recordRef, v.implementer, v.together]), [['X03', 'user', 'combined']]);
  assert.deepEqual(engine.contracts.map(k => [k.recordRef, k.consumer, k.version]), [['K01', '사용자 코드—구체 대상 모름', '형식 판 2']]);
  assert.deepEqual(read.parts.flatMap(p => (p.entries ?? []).map(e => [p.name, e.recordRef, e.name, e.kind, e.order, e.consumer])), [
    ['tidy 명령', 'N01', 'tidy', 'command', null, '사용자'], ['정리 엔진', 'N03', 'import_bookmarks()', 'call', null, '사용자 코드'], ['동기화 데몬', 'N02', 'sync-daemon', 'resident', 1, '일정']]);
  // 사용자 → tidy 명령 is the record's own line already; 사용자 코드 → 정리 엔진 is the program's control line; 일정 is no part.
  assert.deepEqual(read.relations.filter(r => r.from === 'new:usercode').map(r => [r.to, r.channel, r.payload]), [['new:engine', 'control', 'import_bookmarks()']]);
  assert.equal(read.parts.length, 9);
  assert.deepEqual(read.recordDiagnostics.map(d => [d.category, d.table, d.column]), [['unknown-column', 'C-FILES', '비고'], ['unknown-table', 'C-FOO', null], ['entry-consumer', 'C-ENTRY', null]]);
});

test('.43 lines and claims: 조건·선택 (a variant), 경계, 박자, the D row and 통로; a v4 rule\'s device only from its 지키는 장치 column (the decider is never the keeper), a change\'s actors, contract change and release, a withdrawal\'s method', () => {
  const { read } = read43();
  assert.deepEqual(read.relations.slice(0, 4).map(r => [r.from, r.to, r.optional, r.variantRef, r.when, r.crosses, r.cadenceKind, r.payloadRef, r.via]), [
    ['new:user', 'new:cli', false, null, null, 'person', 'call', null, null], ['new:cli', 'new:engine', false, null, null, 'same', 'once', 'D01', null],
    ['new:engine', 'new:export', true, 'X01', null, 'same', 'end', 'D03', null], ['new:sync', 'new:store', true, null, 'SYNC_ON || --sync', 'network', 'periodic', 'D02', 'HTTPS /sync']]);
  const engine = byName(read, '정리 엔진'), [rule, change, withdrawn] = engine.claims;
  // The model wrote the decider as a person device: the table says 코드 at normalize_url().
  assert.deepEqual(rule.enforcedBy.map(e => [e.kind, e.text, e.program]), [['code', 'normalize_url()', true]]);
  assert.deepEqual([rule.decidedBy.text, rule.decidedBy.when], ['소유자 2026-09-01', '2026-09-01']);
  assert.deepEqual(byName(read, '북마크 저장소').claims[0].enforcedBy.map(e => [e.kind, e.text]), [['person', '소유자']], 'a person keeps it: the 지키는 장치 column says 사람');
  assert.deepEqual([byName(read, 'tidy 명령').claims[0].enforcedBy, byName(read, 'tidy 명령').claims[0].decidedBy ?? null], [[], null], '모름 makes no device');
  assert.deepEqual(change.actors, [{ role: 'request', kind: 'owner', name: null, ref: null }, { role: 'author', kind: 'contributor', name: 'han-dev', ref: null }, { role: 'merge', kind: 'maintainer', name: 'lee', ref: null }]);
  assert.deepEqual([change.mergedWhen, change.contractChange, change.shippedIn], ['2026-10-03', { kind: 'breaking', ref: 'K01' }, { kind: 'released', version: 'v2.0.0' }]);
  assert.deepEqual(byName(read, 'tidy 명령').claims[1].actors, [{ role: 'author', kind: 'bot', name: 'deps-bot', ref: null }]);
  assert.deepEqual([withdrawn.withdrawalMethod, withdrawn.contractChange], ['default', { kind: 'compatible', ref: 'K01' }]);
});

test('.43 the reading\'s own fields: basis scope, focus (never a fact), gates checked as none, coverage from C-DONE, artifacts with write modes, supplementary tables and an unknown table kept as written; stored as map-reading.18 exactly', () => {
  const { f, read } = read43();
  assert.equal(read.basisScope.text, '전체 클론, docs/ 안 읽음, 실행 안 함 [실행: git clone]');
  assert.deepEqual([read.focus.profiles, read.focus.tables], [['P4', 'P2'], ['P4-02', 'P2-02']]);
  assert.equal(read.gatesNone.reason, '열린 PR과 판본 경계 없음 [보고: 저장소 PR 목록 2026-11-05]');
  assert.deepEqual(read.coverage.filter(c => c.state !== 'done').map(c => [c.chunk, c.table, c.state, c.remaining]).sort((a, b) => a[0] - b[0]), [[1, 'C-CHANGE', 'partial', '2026-09 이전 변화'], [2, 'C-STEP', 'partial', 'B06의 나머지 단계'], [2, 'P5-03', 'deferred', '표 전체']]);
  assert.deepEqual(read.artifacts.map(a => [a.recordRef, a.kind, a.contractRef, a.where, a.writeMode, a.atomicScope, a.fieldsMore]), [['D01', 'internal', null, '메모리', null, null, null],
    ['D02', 'store', null, 'D/bookmarks.jsonl', 'atomic', '파일 하나', 2], ['D03', 'contract', 'K01', '메모리', null, null, null]]);
  assert.deepEqual(read.profileTables.map(t => [t.table, t.rows.map(r => r.recordRef), t.none?.text ?? null]), [['P4-02', ['P4-02.1'], null], ['P2-02', [], '플러그인 등록 함수 없음 [파일: S/]']]);
  assert.deepEqual(read.recordExtras.map(t => [t.table, t.header]), [['C-FOO', ['무엇', '근거']]]);
  assert.deepEqual(byName(read, '북마크 저장소').fileRoles.map(r => r.runtime), [true]);
  const applied = M.applyReading(f.project, f.input, read, meta('R_record43', '4'));
  assert.equal(applied.reading.version, 'map-reading.19');
  assert.deepEqual(validateProject(applied.project), applied.project);
  const stored = applied.reading, engine = stored.parts.find(p => p.recordRef === 'B03');
  assert.deepEqual([engine.loops.length, engine.variants.length, stored.coverage.length, stored.recordDiagnostics.length], [1, 2, 8, 3]);
  // Exact per version: a .17 entry holds none of these keys, and a .18 entry needs each of them.
  const raw = S.serializeProject(applied.project), bad = mutate => { const p = JSON.parse(raw); mutate(p.readings.at(-1)); return () => validateProject(p); };
  assert.throws(bad(r => { r.version = 'map-reading.17'; }));
  assert.throws(bad(r => { delete r.parts[0].loops; }));
  assert.throws(bad(r => { r.parts.find(p => p.recordRef === 'B06').statusClaims[0].value = 'busy'; }));
  assert.throws(bad(r => { r.parts.find(p => p.recordRef === 'B07').type = 'screen'; r.version = 'map-reading.17'; stripEighteen(r); }), 'a screen is a .18 type');
  const older = JSON.parse(raw), r17 = stripEighteen(older.readings.at(-1)); r17.version = 'map-reading.17';
  for (const p of r17.parts) if (p.type === 'screen' || p.type === 'automation') { p.type = null; p.typeQuote = null; }
  for (const p of r17.parts) for (const c of p.claims) c.enforcedBy = (c.enforcedBy ?? []).filter(e => !e.program || e.kind === 'code' || e.kind === 'person');
  assert.deepEqual(validateProject(older), older, 'a map-reading.17 entry keeps its shape');
});

test('.43 recipe and table prompts: first-map-divided.43; the plan prompt and render rules name the v4 table IDs; the plan reasons at medium by default', () => {
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.53', 'later-map-divided.53']);
  assert.ok(B.MAP_BLUEPRINT_PROMPT.includes('C-STEP 행 ID B03:S02의 B03은 C-PART 행 ID다'));
  assert.ok(P.RENDER_RULES.includes('C-RULE의 지키는 장치·장치 위치 열') && P.RENDER_RULES.includes('screen(화면)·automation(빌드·배포 자동화)'));
  assert.ok(P.GLOBAL_RULES.includes('C-SUMMARY 두 문장'));
});
