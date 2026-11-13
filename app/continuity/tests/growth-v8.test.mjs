// Review of the v7 growth view (v8-growth): the nine review findings and the first user's misreadings (a–k). Each test fails on v7-merged.
// Fictional readings and the anonymised growth fixture only; the DOM wiring is read from the source. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as G from '../dist/public/shared/map-growth.js';
import * as V from '../dist/public/client/growth-view.js';
import * as D from '../dist/public/shared/domain.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { serializeProject } from '../dist/public/shared/storage.js';
import { growthFixture, fixtureProject } from './growth51-replay.mjs';

const read = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 2); };
const T = d => `2026-10-0${d}T09:00:00.000Z`;
const Q = { record: 'N1', quote: '| B01 | 수집기 | 구현됨 |', from: 0, to: 4 };
const made = (areaId, name, role, parentId = null, more = {}) => ({ areaId, created: { name, parentId }, role, roleAbout: null, roleReplaces: null, basis: [], claims: [], ...more });
const said = (areaId, role, more = {}) => ({ areaId, created: null, role, roleAbout: null, roleReplaces: role ? { record: 'N1', quote: '이 설명으로 바꿈' } : null, basis: [], claims: [], ...more });
const rel = (relationId, from, to, kind = 'flow') => ({ relationId, from, to, kind, quote: { record: 'N1', quote: '선' } });
const op = (o) => ({ successor: null, into: null, from: null, to: null, renamed: false, ...o });
const ident = (id, o, when = '2026-09-30') => ({ record: 'AF5-test@c0de', id, map: null, answer: null, part: 'B01', state: 'reflected', reason: null, areaId: o.areaId, op: op(o), when, evidence: ['E01'], at: { record: 'N1', from: 0, to: 4 } });
const reading = (n, parts, relations = [], identity = [], more = {}) => ({ version: 'map-reading.20', id: `R${n}`, at: T(n), model: 'm', prompt: 'p', hash: `h${n}`, records: [], summary: '', parts, relations, candidates: [], gaps: [], skipped: [], identity, ...more });
/* The fictional workshop of growth-f7.test.mjs, its correction left to each test. */
function workshop(correction) {
  const areas = [['grp', '처리 묶음'], ['col', '수집기'], ['srt', '정리기'], ['sto', '기록 저장소'], ['tim', '옛 타이머'], ['wat', '새 감시기'], ['dup', '정리기 사본'], ['tmp', '임시 도구']];
  const p = D.createProject();
  p.space.areas = areas.map(([id, name]) => ({ id, name, note: '', archived: false, createdAt: T(1) }));
  for (const [id] of areas) p.space.containment.revisions[id] = 0;
  Object.assign(p.space.containment.parents, { srt: 'grp', sto: 'grp', dup: 'grp' });
  p.space.relations = [['L1', 'col', 'srt'], ['L2', 'srt', 'sto'], ['L3', 'tim', 'col'], ['L4', 'wat', 'col'], ['L5', 'dup', 'sto']].map(([id, from, to]) => ({ id, from, to, kind: 'flow', note: '' }));
  p.readings = [
    reading(1, [made('grp', '처리 묶음', null), made('col', '수집기', '자료를 모은다', null, { implementation: 'unbuilt', implementationQuote: Q }), made('srt', '정리기', '모은 것을 고른다', 'grp'), made('sto', '저장소', '고른 것을 둔다', 'grp'), made('tim', '옛 타이머', '정해진 때에 수집기를 깨운다')],
      [rel('L1', 'col', 'srt'), rel('L2', 'srt', 'sto'), rel('L3', 'tim', 'col')], [], { basisAt: '2026-09-01' }),
    reading(2, [made('wat', '새 감시기', '폴더를 지켜보다 수집기를 깨운다'), said('srt', '모은 것을 규칙대로 고르고 나눈다')], [rel('L4', 'wat', 'col')], [], { basisVersion: 'v2.0' }),
    reading(3, [said('col', null, { implementation: 'built', implementationQuote: Q })], [], [ident('ID01', { kind: 'rename', areaId: 'sto', from: '저장소', to: '기록 저장소', renamed: true }), ident('ID02', { kind: 'retire', areaId: 'tim', successor: 'wat' }, 'c0ffee1 2026-09-29'),
      ident('ID03', { kind: 'reimplement', areaId: 'srt', from: '옛 엔진', to: '새 엔진' })]),
    reading(4, [made('dup', '정리기 사본', '모은 것을 고른다', 'grp'), made('tmp', '임시 도구', '잠깐 쓰는 도구')], [rel('L5', 'dup', 'sto')]),
    ...(correction ? [{ version: 'map-correction.1', id: 'M1', at: '2026-10-04T12:00:00.000Z', areaId: 'col', text: '자료를 모아 하루에 한 번 넘긴다', corrects: 'R1', ...correction }] : []),
    // The record retires 임시 도구 for 옛 타이머, which is itself retired (not on the map): a successor off the map.
    reading(5, [said('srt', null, { implementation: 'built', implementationQuote: Q })], [], [ident('ID04', { kind: 'fold', areaId: 'dup', into: 'srt' }), ident('ID05', { kind: 'retire', areaId: 'tmp', successor: 'tim' })])];
  return p;
}
const namesOf = (p, a, b) => { const A = G.pastVersion(p, a).view, B = G.versionAt(p, b).view; return id => B.parts.find(x => x.id === id)?.name ?? A.parts.find(x => x.id === id)?.name ?? '부품'; };

test('V8-1 the guide is never stepped back or cut to one line: the box stays whole, at any camera', async () => {
  const app = await read('src/client/app.ts'), css = await read('public/styles.css');
  const place = fn(app, 'placeFocusTop');
  // v11 (ruling F8 Q2): the top box has no one-line form any more; the stepped-back form is the only one, never in guide mode.
  const guard = place.indexOf("if (el.classList.contains('growth-guide')) return;"), under = place.indexOf("el.classList.add('ft-under')");
  assert.ok(guard > 0 && guard < under && !place.includes("'ft-one'"), 'in guide mode the forms are never applied, whatever the camera puts under it');
  assert.doesNotMatch(css, /\.focus-top\.growth-guide\.ft-one/, 'no one-line form of the guide');
  const rule = css.match(/\.focus-top\.growth-guide \.gg-text \{([^}]*)\}/)?.[1] ?? '';
  assert.match(rule, /-webkit-line-clamp: none;/); assert.match(rule, /overflow: visible;/);
  // Entering compare zoomed in: the guide stays whole and the camera pans the cards clear of it (first user, k).
  assert.match(fn(app, 'growthScene'), /growthReveal\(part\);\n  growthClearGuide\(\);/);
  // Review of v8: a pan sideways or up and down (guidePan, V9-K), never a zoom; else the guide goes to the pane's top.
  const clear = fn(app, 'growthClearGuide');
  assert.match(clear, /camera = \{ \.\.\.camera, x: camera\.x \+ d\[0\], y: camera\.y \+ d\[1\] \}; applyCamera\(true\);/, 'a pan, never a zoom');
  assert.match(clear, /guideInPane = true; el\.hidden = true; syncMapArea\(\); renderGrowthPane\(\);/);
});

test('V8-2 기록 반영 상태: a record\'s part row is a map part by its name or by the one B its reflected rows share; 「아직 지도에 놓이지 않음」 only when no map part can be it; a row about one such part is in that part\'s group', () => {
  const p = fixtureProject(growthFixture('track-a')), n = G.mapVersions(p).length, rows = G.unreflectedAt(p, n), view = G.versionAt(p, n).view;
  const core = t => t.normalize('NFKC').toLowerCase().replace(/[(（[［][^()（）[\]［］]*[)）\]］]/g, ' ').replace(/\s+/g, '');
  const mapCores = new Set(view.parts.map(x => core(x.name)));
  for (const x of rows) if (x.unplaced) assert.equal(mapCores.has(core(x.tried)), false, `a part row named as a map part is never 「아직 지도에 놓이지 않음」: ${x.tried}`);
  // v7 said 「아직 지도에 놓이지 않음」 for 관리 명령 모음 and 릴리스 스크립트, both on the map: now their rows are those parts'.
  for (const name of ['관리 명령 모음', '릴리스 스크립트']) {
    const row = rows.find(x => x.table === 'C-PART' && x.tried === name), part = view.parts.find(x => x.name === name);
    assert.ok(row && part, name); assert.equal(row.unplaced, false); assert.equal(row.principal, part.id);
  }
  // A row that names one record part no map part can be is that part's (never 대상 미확정); a row naming none is about the whole record.
  const open = rows.filter(x => x.state !== 'rejected'), groups = G.reflectGroups(open, id => view.parts.find(x => x.id === id)?.name ?? '부품');
  for (const g of groups) {
    if (g.kind === 'unsettled') for (const x of g.rows) assert.ok(!x.pending, 'a row about one part not on the map is that part\'s');
    if (g.kind === 'unplaced') { assert.ok(g.name); assert.ok(g.rows.every(x => x.pending && x.pending.name === g.name)); assert.equal(V.groupTitle(g, () => '').title, `${g.name}에 관한 미반영 기록 ${g.rows.length}행`); }
    if (g.kind === 'whole') assert.ok(g.rows.every(x => x.named === 0 && !x.parts.length));
  }
  const pipe = groups.find(g => g.kind === 'unplaced' && g.name === '소비 파이프라인(Consumer)');
  assert.ok(pipe && pipe.rows.length > 1 && pipe.rows.some(x => x.table === 'C-PART') && pipe.rows.some(x => x.table === 'C-STEP'), 'the part row and its steps together');
  assert.ok(groups.filter(g => g.kind === 'unsettled').reduce((a, g) => a + g.rows.length, 0) < 20, 'v7 left 152 open rows 대상 미확정');
});

test('V8-3 a read record\'s rows not yet sent read 「읽은 기록에 있지만 아직 지도에 보내지 않음」, never 「아직 읽지 않음」', () => {
  const p = fixtureProject(growthFixture('track-a')), rows = G.unreflectedAt(p, G.mapVersions(p).length);
  assert.ok(rows.some(x => x.reason === 'not-yet-sent'));
  for (const x of rows) { assert.doesNotMatch(x.words, /아직 읽지 않음/); if (x.reason === 'not-yet-sent') assert.equal(x.words, '읽은 기록에 있지만 아직 지도에 보내지 않음'); }
  assert.equal(G.rowReasonWords('waiting', 'not-yet-sent'), '읽은 기록에 있지만 아직 지도에 보내지 않음');
});

test('V8-4 every name the growth view says is the card face\'s: one helper for scene titles, lists, the guide and group titles', async () => {
  // A bracket of plain words is the name's own on the card, so it is in the growth view too; only a code identifier goes to the detail.
  assert.equal(V.plainName('문서 소비기(Consumer)'), '문서 소비기(Consumer)');
  assert.equal(V.plainName('작업 큐·실행기(Django Q qcluster + Redis)'), '작업 큐·실행기(Django Q qcluster + Redis)');
  assert.equal(V.plainName('소비 폴더 감시기(document_consumer)'), '소비 폴더 감시기');
  assert.equal(V.auxName('문서 소비기(Consumer)'), null);
  const view = await read('src/client/growth-view.ts'), app = await read('src/client/app.ts');
  assert.match(view, /import \{ faceSplit, facePlain, faceCounts as faceCountsOf \} from '\.\/face-name\.js';/);
  assert.match(fn(app, 'faceName'), /faceSplit\(x\.name, counts\)/, 'the card face goes by the same helper');
  assert.match(fn(app, 'growthReflectEl'), /return heldName\(sceneName\(id\), rep && rep !== id \? sceneName\(rep\) : null\);/, 'group titles (review of v8: the folded card it is drawn in)');
  assert.match(fn(app, 'growthListEl'), /sceneTitle\(x, sceneName, sceneSay\)/, 'lists');
  assert.match(fn(app, 'growthSceneEl'), /h\('h2', \{ id: 'lens-title' \}, sceneTitle\(main, sceneName, sceneSay\)\)/, 'scene titles');
  // A rename's before and after are names as text: said as the face says them.
  const c = { kind: 'rename', part: 'x', name: '문서 소비기(document_consumer)', before: '옛 소비기(old_consumer)', after: '문서 소비기(document_consumer)' };
  assert.equal(V.sceneTitle(c, () => '문서 소비기'), '옛 소비기 → 문서 소비기');
});

test('V8-5 a commit carries its kind: 「기록 대상 판본」 for a version the records name, 「기록 대상 날짜」 for a basis time', async () => {
  const p = workshop(null), vs = G.mapVersions(p);
  assert.deepEqual(vs.slice(0, 3).map(v => [v.target, v.targetKind]), [['2026-09-01', 'date'], ['v2.0', 'version'], [null, null]]);
  assert.equal(G.targetWord('date'), '기록 대상 날짜'); assert.equal(G.targetWord('version'), '기록 대상 판본');
  const scene = fn(await read('src/client/app.ts'), 'growthSceneEl');
  assert.match(scene, /target \? h\('dt', \{\}, tw\) : null/); assert.doesNotMatch(scene, /'기록 대상 날짜'/, 'never a fixed 날짜');
});

test('V8-6 a row\'s cells keep S3, H2, K8s and E2E; only the record\'s own row IDs go, and a part row\'s ID read as its name takes its own particle', () => {
  const ids = new Set(['B07', 'B08', 'LN05', 'F01']), names = { B07: '메일 수집기', B08: '저장소' };
  assert.equal(G.plainCells(['B07이 S3에 올리고 B08을 부른다', 'K8s·E2E 검사, H2 저장', 'LN05 (F01)'], b => names[b] ?? null, ids), '메일 수집기가 S3에 올리고 저장소를 부른다 · K8s · E2E 검사 · H2 저장');
  assert.equal(G.plainCells(['B08으로 넘김 · B07과 B08은 따로'], b => names[b] ?? null, ids), '저장소로 넘김 · 메일 수집기와 저장소는 따로');
  assert.equal(G.plainCells(['폴더는 B08의 셋 중 하나'], b => names[b] ?? null, ids), '폴더는 저장소의 셋 중 하나', 'a particle that is no pair stays');
  assert.equal(G.plainCells(['B99 · ID7 그대로'], b => names[b] ?? null, ids), 'B99 · ID7 그대로', 'what is not the record\'s own row ID stays as written');
});

test('V8-7 a retirement whose recorded successor is off the map keeps it: 「대신하는 부품은 지금 지도에 없습니다」', () => {
  const p = workshop({ error: true }), cs = G.changeSet(p, 4, 5), r = cs.changes.find(c => c.kind === 'retire');
  assert.equal(r.part, 'tmp'); assert.equal(r.successor, null); assert.equal(r.named, 'tim');
  assert.equal(V.sceneSentence(r, namesOf(p, 4, 5)), '‘임시 도구’가 은퇴했다는 기록이 반영됐습니다. 대신하는 부품은 지금 지도에 없습니다.');
  assert.equal(V.sceneKind(r), '기록된 은퇴 · 대신하는 부품은 지금 지도에 없음');
  assert.ok(V.changeScenes(cs).some(s => s.part === 'tmp'), 'still its own scene (no 승계 holds it)');
});

test('V8-8 re-entering a range seen before: a selected part with a change wins over the remembered scene, the filter and camera kept', async () => {
  const cmp = fn(await read('src/client/app.ts'), 'growthCompare');
  assert.match(cmp, /const want = focus \?\? saved\.selected;/);
  assert.match(cmp, /if \(memo\) \{ camera = \{ \.\.\.memo\.camera \}; applyCamera\(\); if \(memo\.picked === 'new' \|\| memo\.picked === 'desc'\) c\.picked = memo\.picked; \}\n    growthScene\(want\); return;/);
});

test('V8-9 정정 is an error or a withdrawal said so: the record\'s 철회 rows and the person\'s correction marked so; a plain rewrite is 설명 변경 by the person', () => {
  // The person's plain rewrite.
  let p = workshop({}), cs = G.changeSet(p, 1, 5);
  assert.equal(cs.counts.correct, 0);
  const d = cs.changes.find(c => c.kind === 'desc' && c.part === 'col');
  assert.equal(d.by, 'person'); assert.equal(d.after, '자료를 모아 하루에 한 번 넘긴다');
  assert.equal(V.sceneKind(d), '설명 변경 · 사람이 새로 씀'); assert.equal(V.sceneSentence(d, namesOf(p, 1, 5)), '‘수집기’의 설명을 사람이 새로 썼습니다.');
  assert.equal(V.wasLabel('desc', null, 'person'), '이전 설명 · 사람이 새로 쓴 설명으로 바뀜');
  // Marked as fixing an error: 정정.
  p = workshop({ error: true }); cs = G.changeSet(p, 1, 5);
  assert.deepEqual(cs.changes.filter(c => c.kind === 'correct').map(c => [c.part, c.by]), [['col', 'person']]);
  assert.equal(cs.changes.some(c => c.kind === 'desc' && c.part === 'col'), false);
  // The record's own 철회 row, taking back a claim the map had on that part (review of v8: only that is a 정정).
  p = workshop(null);
  p.readings[0].parts.find(x => x.areaId === 'sto').claims.push({ kind: 'describes', text: '고른 것을 옛 압축 저장으로 둔다', record: 'N1', quote: '| 저장소 | 옛 압축 저장 |', about: null, replaces: null });
  p.readings.push(reading(6, [said('sto', null, { claims: [{ kind: 'describes', text: '옛 압축 저장을 철회했다', record: 'N1', quote: '| 철회 | 옛 압축 |', about: null, replaces: null, topic: 'withdrawn', before: '옛 압축 저장' }] })]));
  cs = G.changeSet(p, 5, 6);
  const w = cs.changes.find(c => c.kind === 'correct');
  assert.equal(w.part, 'sto'); assert.equal(w.by, 'record'); assert.deepEqual(w.withdrawn.map(x => [x.before, x.text]), [['옛 압축 저장', '옛 압축 저장을 철회했다']]);
  assert.equal(V.sceneKind(w), '정정 · 기록이 적은 철회'); assert.equal(V.sceneSentence(w, namesOf(p, 5, 6)), '기록이 ‘기록 저장소’에 대한 철회를 적었습니다.');
  assert.equal(G.changeSet(p, 4, 5).counts.correct, 0, 'not before it was read');
  // The mark is stored and read back; anything but true is refused.
  const q = fixtureProject(growthFixture('track-a')), id = G.versionAt(q, G.mapVersions(q).length).view.parts.find(x => x.reading?.role && !q.space.areas.find(a => a.id === x.id)?.archived).id;
  const fixed = D.correctReadingRole(q, id, '자료를 모아 넘긴다', true), plain = D.correctReadingRole(q, id, '자료를 모아 넘긴다');
  assert.equal(fixed.readings.at(-1).error, true); assert.equal('error' in plain.readings.at(-1), false);
  assert.equal(parseProject(serializeProject(fixed)).readings.at(-1).error, true);
  const bad = structuredClone(fixed); bad.readings.at(-1).error = false;
  assert.throws(() => parseProject(serializeProject(bad)), /INVALID_DATA/);
});

test('V8-10 first user (a, b, c, d, e): the scene count says why it differs from the items; 「새로 표시」 on the card; 「처음 표시됨」; plain words for what happens next; a neutral 대기·보류', async () => {
  const p = workshop({ error: true }), cs = G.changeSet(p, 1, 5), scenes = V.changeScenes(cs);
  assert.ok(V.kindTotal(cs) > scenes.length);
  assert.equal(V.sceneWhy(cs, scenes), `장면은 부품마다 하나 · 변화 ${V.kindTotal(cs)}건이 부품 ${scenes.length}개에 있어 한 부품의 여러 변화는 한 장면에 함께 보임`);
  assert.equal(V.sceneWhy({ ...cs, changes: [], counts: Object.fromEntries(Object.keys(cs.counts).map(k => [k, 0])) }, []), null);
  assert.match(fn(await read('src/client/app.ts'), 'growthSceneEl'), /const sceneWhyLine = f \? null : sceneWhy\(c\.cs, c\.scenes\);/);
  assert.equal(V.tabKindWord('new'), '새로 표시'); assert.equal(V.tabWord(cs.changes.find(c => c.kind === 'new')), '새로 표시');
  const wat = cs.changes.find(c => c.kind === 'new' && c.part === 'wat');
  assert.equal(V.newTitle(wat, 1), '지도 v02에서 처음 표시됨');
  for (const k of ['waiting:transient', 'waiting:budget', 'rejected:unplaced', 'rejected:revision']) assert.doesNotMatch(G.ROW_REASON_WORDS[k], /보냈지만|보냄|보내지 않음/, k);
  assert.equal(G.ROW_REASON_WORDS['waiting:transient'], '지도에 아직 들어가지 않아 다음 읽기에 다시 넣음');
  assert.match(await read('public/styles.css'), /\.gl-row \.gl-un \{ color: var\(--text-2\); \}/);
});

test('V8-11 first user (f, g, h): a description\'s change shows 이전 설명 / 지금 설명 first, then 구현 상태 and 바뀐 직접 연결, and says what each date means; the pill offers instead of 「안 됨」; 「이름 1」 opens its scene on the rename', async () => {
  const app = await read('src/client/app.ts'), scene = fn(app, 'growthSceneEl');
  assert.ok(scene.indexOf('pair,') < scene.indexOf("h('dl', { class: 'gs-dl' },\n          h('dt', {}, '시점')"), 'the two descriptions before 시점');
  assert.match(scene, /`이전 설명 · \$\{versionLabel\(c\.from\)\}`/); assert.match(scene, /`지금 설명 · \$\{versionLabel\(c\.to\)\}`/);
  assert.match(scene, /\.\.\.\(descFirst \? \[implEl, linesEl, flistEl, alsoEl, wdEl, citesEl, descEl, histEl\] :/);
  assert.match(scene, /시점은 기록이 적은 바뀐 때 · \$\{tw\}\$\{josa\(tw, '은\/는'\)\} 그 기록이 다룬 대상의/, '기록 대상 판본은 · 기록 대상 날짜는');
  const sync = await read('src/client/auto-sync.ts');
  assert.doesNotMatch(sync, /' 안 됨'/); assert.match(sync, /' 켜기'/);
  assert.match(fn(app, 'growthPick'), /growthScene\(list\[0\]!\.part, k\); return;/);
  assert.match(scene, /\(c\.sceneKind && sc\.changes\.find\(x => x\.kind === c\.sceneKind\)\)/, 'the scene shows the change it was entered for');
});

test('V8-12 first user (i, j): leaving says what stayed and past/current keeps the card in view; a folded ◇ says 「조건 보기」; a label the pane edge would cut steps back', async () => {
  const app = await read('src/client/app.ts'), css = await read('public/styles.css');
  // v10: what it says is only what is so (growth-view exitWord, nowWord; growth-v10 V10-7).
  assert.match(fn(app, 'growthExit'), /note\(exitWord\(/);
  assert.equal(V.exitWord(true, true), '비교를 끝냈어요 · 비교 전에 고른 카드와 보던 위치로 돌아왔어요');
  assert.match(fn(app, 'drawGrowth'), /growthLeavePast\(\); note\(nowWord\(/);
  assert.match(fn(app, 'growthView'), /keepInView\(\);/); assert.match(fn(app, 'growthLeavePast'), /else keepInView\(\);/);
  assert.match(fn(app, 'placeCue'), /h\('span', \{ class: 'cue-word', 'aria-hidden': 'true' \}, cue === 'condition' \? '조건 보기' : '선택 보기'\)/);
  assert.match(css, /\.edge-cue:is\(:hover, :focus-visible, \.near\) \.cue-word \{ display: block; \}/);
  assert.match(fn(app, 'clipAtEdge'), /el\.classList\.toggle\('edge-cut'/);
  assert.match(css, /\.edge-labels > \.edge-cut \{ visibility: hidden; \}/);
  assert.match(fn(app, 'applyCamera'), /clipAtEdge\(\);/);
});
