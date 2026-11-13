// Review of the v8 growth view (v9-growth): 정정 only for a withdrawn claim of that part, a live part before a retired one, never-sent rows
// unknown, the first user's misreadings (a–j) and the guide over dense views (k). Each test fails on v8-merged.
// Fictional readings and the anonymised growth fixture only; the DOM wiring is read from the source. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as G from '../dist/public/shared/map-growth.js';
import * as V from '../dist/public/client/growth-view.js';
import * as D from '../dist/public/shared/domain.js';
import { growthFixture, fixtureProject } from './growth51-replay.mjs';

const read = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 2); };
const T = d => `2026-10-0${d}T09:00:00.000Z`;
const Q = { record: 'N1', quote: '| B01 | 수집기 | 구현됨 |', from: 0, to: 4 };
const made = (areaId, name, role, parentId = null, more = {}) => ({ areaId, created: { name, parentId }, role, roleAbout: null, roleReplaces: null, basis: [], claims: [], ...more });
const said = (areaId, role, more = {}) => ({ areaId, created: null, role, roleAbout: null, roleReplaces: role ? { record: 'N1', quote: '이 설명으로 바꿈' } : null, basis: [], claims: [], ...more });
const rel = (relationId, from, to, kind = 'flow') => ({ relationId, from, to, kind, quote: { record: 'N1', quote: '선' } });
const op = (o) => ({ successor: null, into: null, from: null, to: null, renamed: false, ...o });
const ident = (id, o, when = '2026-09-30', more = {}) => ({ record: 'AF5-test@c0de', id, map: null, answer: null, part: 'B01', state: 'reflected', reason: null, areaId: o.areaId, op: op(o), when, evidence: ['E01'], at: { record: 'N1', from: 0, to: 4 }, ...more });
const reading = (n, parts, relations = [], identity = [], more = {}) => ({ version: 'map-reading.20', id: `R${n}`, at: T(n), model: 'm', prompt: 'p', hash: `h${n}`, records: [], summary: '', parts, relations, candidates: [], gaps: [], skipped: [], identity, ...more });
/* The fictional workshop of growth-f7 and growth-v8. */
function workshop() {
  const areas = [['grp', '처리 묶음'], ['col', '수집기'], ['srt', '정리기'], ['sto', '기록 저장소'], ['tim', '옛 타이머'], ['wat', '새 감시기'], ['dup', '정리기 사본'], ['tmp', '임시 도구']];
  const p = D.createProject();
  p.space.areas = areas.map(([id, name]) => ({ id, name, note: '', archived: false, createdAt: T(1) }));
  for (const [id] of areas) p.space.containment.revisions[id] = 0;
  Object.assign(p.space.containment.parents, { srt: 'grp', sto: 'grp', dup: 'grp' });
  p.space.relations = [['L1', 'col', 'srt'], ['L2', 'srt', 'sto'], ['L3', 'tim', 'col'], ['L4', 'wat', 'col'], ['L5', 'dup', 'sto']].map(([id, from, to]) => ({ id, from, to, kind: 'flow', note: '' }));
  p.readings = [
    reading(1, [made('grp', '처리 묶음', null), made('col', '수집기', '자료를 모은다', null, { implementation: 'unbuilt', implementationQuote: Q }), made('srt', '정리기', '모은 것을 고른다', 'grp'),
      made('sto', '저장소', '고른 것을 둔다', 'grp', { claims: [{ kind: 'describes', text: '고른 것을 옛 압축 저장으로 둔다', record: 'N1', quote: '| 저장소 | 옛 압축 저장 |', about: null, replaces: null }] }), made('tim', '옛 타이머', '정해진 때에 수집기를 깨운다')],
      [rel('L1', 'col', 'srt'), rel('L2', 'srt', 'sto'), rel('L3', 'tim', 'col')], [], { basisAt: '2026-09-01' }),
    reading(2, [made('wat', '새 감시기', '폴더를 지켜보다 수집기를 깨운다'), said('srt', '모은 것을 규칙대로 고르고 나눈다')], [rel('L4', 'wat', 'col')], [], { basisVersion: 'v2.0' }),
    reading(3, [said('col', null, { implementation: 'built', implementationQuote: Q })], [], [ident('ID01', { kind: 'rename', areaId: 'sto', from: '저장소', to: '기록 저장소', renamed: true }), ident('ID02', { kind: 'retire', areaId: 'tim', successor: 'wat' }, 'c0ffee1 2026-09-29'),
      ident('ID03', { kind: 'reimplement', areaId: 'srt', from: '옛 엔진', to: '새 엔진' })]),
    reading(4, [made('dup', '정리기 사본', '모은 것을 고른다', 'grp'), made('tmp', '임시 도구', '잠깐 쓰는 도구')], [rel('L5', 'dup', 'sto')]),
    reading(5, [said('srt', null, { implementation: 'built', implementationQuote: Q })], [], [ident('ID04', { kind: 'fold', areaId: 'dup', into: 'srt' }), ident('ID05', { kind: 'retire', areaId: 'tmp', successor: 'tim' })])];
  return p;
}
/** A record's 철회·변경 row as a reading reads it (C-WITHDRAW: 옛 결정 → 지금, 방식). */
const wd = (text, before, method, more = {}) => ({ kind: 'describes', text, record: 'N1', quote: `| WD | ${before} | ${method} |`, about: null, replaces: null, topic: 'withdrawn', before, withdrawalMethod: method, ...more });

test('V9-1 정정 is a withdrawal of a claim the earlier map had on that very part; the record\'s other 철회·변경 rows are project history listed apart (never on a card or in the scene order); 옮김 is never 철회', async () => {
  const p = workshop();
  p.readings.push(reading(6, [
    // Project history read on 수집기: 리마인더 앱 was never a claim of 수집기 on the map.
    said('col', null, { claims: [wd('기준 abc에서 리마인더 앱은 제거됐다', '리마인더 앱', 'remove'), wd('Python 3.6 지원이 제거됐다', 'Python 3.6 지원', 'remove')] }),
    // 기록 저장소's own claim (옛 압축 저장) taken back: a 정정; the same claim moved elsewhere: an 옮김, never a 철회.
    said('sto', null, { claims: [wd('옛 압축 저장을 되돌렸다', '옛 압축 저장', 'revert'), wd('옛 압축 저장을 다른 묶음으로 옮겼다', '옛 압축 저장 위치', 'move')] })]));
  const cs = G.changeSet(p, 5, 6);
  assert.deepEqual(cs.changes.filter(c => c.kind === 'correct').map(c => [c.part, c.by, c.withdrawn.map(w => w.text)]), [['sto', 'record', ['옛 압축 저장을 되돌렸다']]]);
  assert.deepEqual(cs.history.map(r => [r.part, r.method, r.before]).sort(), [['col', 'remove', 'Python 3.6 지원'], ['col', 'remove', '리마인더 앱'], ['sto', 'move', '옛 압축 저장 위치']]);
  const scenes = V.changeScenes(cs);
  assert.equal(scenes.some(s => s.part === 'col'), false, 'history rows are never a scene');
  assert.equal(V.shownTabs(scenes, null, null).some(t => t.part === 'col'), false, 'and never a card tab');
  assert.equal(V.summaryItems(cs).some(i => i.key === 'correct' && i.count !== 1), false);
  // The rule by itself: a claim the record says it supersedes counts too; an 옮김 never does.
  const ux = G.versionAt(p, 6).view.parts.find(x => x.id === 'sto').reading, A = G.pastVersion(p, 5).project;
  assert.equal(G.partClaimWithdrawal({ before: '리마인더 앱', replaces: null, withdrawalMethod: 'remove' }, A, 'sto', ux), false);
  assert.equal(G.partClaimWithdrawal({ before: null, replaces: { reading: 'R1', index: 0 }, withdrawalMethod: 'remove' }, A, 'sto', ux), true);
  assert.equal(G.partClaimWithdrawal({ before: '옛 압축 저장', replaces: null, withdrawalMethod: 'move' }, A, 'sto', ux), false);
  assert.equal(G.METHOD_WORD.move, '옮김'); assert.equal(G.historyWord(3), '기록된 철회·변경 3건'); assert.equal(V.historyShort(3), '철회·변경 3건');
  // The anonymised growth map: its 철회·변경 rows (one an 옮김 of the mail schedule) withdraw no claim of their parts: no 정정, no 정정 scene.
  const q = fixtureProject(growthFixture('track-a')), fx = G.changeSet(q, 4, 9);
  assert.equal(fx.counts.correct, 0); assert.ok(fx.history.length > 0);
  assert.ok(fx.history.some(r => r.method === 'move'));
  assert.notEqual(V.changeScenes(fx)[0].main.kind, 'correct');
  assert.doesNotMatch(V.guideText(V.guideOf(fx, V.changeScenes(fx), id => id)), /철회/);
  // On screen: apart at the line's right end and in the pane, by its 방식.
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'growthHistoryEl'), /historyList\(rows, true\)/);
  assert.match(fn(app, 'historyList'), /x\.method \? METHOD_WORD\[x\.method\] : '방식 기록 없음'/);
  assert.match(fn(app, 'growthSceneEl'), /const histRows = c\.cs\.history\.filter\(x => x\.part === part\);/);
  assert.match(await read('src/client/growth-view.ts'), /class: `gl-hist\$\{picked === 'history' \? ' on' : ''\}`/);
});

test('V9-2 a record\'s part row binds to a live part first: an identity row onto a retired part never blocks the name that matches a part on the map', () => {
  const p = fixtureProject(growthFixture('track-a')), n = G.mapVersions(p).length;
  const before = G.unreflectedAt(p, n), row = before.find(x => x.table === 'C-PART' && x.tried === '관리 명령 모음');
  assert.ok(row?.principal, 'bound by its name');
  // The record's identity row says that part row retired a part that is off the map now.
  const q = fixtureProject(growthFixture('track-a'));
  q.space.areas.push({ id: 'gone', name: '옛 관리 명령', note: '', archived: true, createdAt: T(1) }); q.space.containment.revisions.gone = 0;
  const last = q.readings.filter(r => r.version?.startsWith('map-reading')).at(-1);
  last.identity = [...last.identity ?? [], ident('ID99', { kind: 'retire', areaId: 'gone' }, '2026-09-30', { record: row.record, part: row.id })];
  const after = G.unreflectedAt(q, n).find(x => x.table === 'C-PART' && x.id === row.id && x.record === row.record);
  assert.equal(after.principal, row.principal, 'the live part, never the retired one');
  // With no live part to match, the retired part still holds it (never 「아직 지도에 놓이지 않음」).
  const r2 = fixtureProject(growthFixture('track-a'));
  r2.space.areas.push({ id: 'gone', name: '옛 관리 명령', note: '', archived: true, createdAt: T(1) }); r2.space.containment.revisions.gone = 0;
  const pipe = before.find(x => x.table === 'C-PART' && x.unplaced);
  const l2 = r2.readings.filter(r => r.version?.startsWith('map-reading')).at(-1);
  l2.identity = [...l2.identity ?? [], ident('ID98', { kind: 'retire', areaId: 'gone' }, '2026-09-30', { record: pipe.record, part: pipe.id })];
  const held = G.unreflectedAt(r2, n).find(x => x.table === 'C-PART' && x.id === pipe.id && x.record === pipe.record);
  assert.equal(held.unplaced, false); assert.equal(held.principal, null);
});

test('V9-3 a part row never sent to the map is unknown: neither 「현재 지도에 있습니다」 nor 「아직 지도에 놓이지 않았습니다」', () => {
  const rows = [{ state: 'waiting', reason: 'not-yet-sent', words: '', record: 'R', table: 'C-STEP', id: 'S1', tried: '단계', item: '단계', title: '단계', parts: [], principal: null, related: [], unplaced: false,
    pending: { b: 'B09', name: '보내지 않은 부분', sure: false }, named: 1, paste: 'P', start: 0, end: 1, line: 1 }];
  const [g] = G.reflectGroups(rows, () => '');
  assert.equal(g.kind, 'unplaced'); assert.equal(g.sure, false);
  const t = V.groupTitle(g, () => '');
  assert.equal(t.title, '보내지 않은 부분에 관한 미반영 기록 1행'); assert.doesNotMatch(t.sub, /놓이지 않았습니다/); assert.equal(t.onMap, false);
  const sent = G.reflectGroups([{ ...rows[0], pending: { ...rows[0].pending, sure: true } }], () => '')[0];
  assert.match(V.groupTitle(sent, () => '').sub, /이 부품은 아직 지도에 놓이지 않았습니다$/);
  // On the growth map: every 「아직 지도에 놓이지 않음」 row is a part row that was sent.
  const p = fixtureProject(growthFixture('track-a')), un = G.unreflectedAt(p, G.mapVersions(p).length);
  for (const x of un) if (x.unplaced) assert.equal(x.pending.sure, true);
  assert.ok(un.some(x => x.unplaced));
});

test('V9-4a each card\'s tab is its own first kind by the F7 order: project history never makes a card 정정; an implementation change reads 구현 상태', () => {
  const p = workshop();
  p.readings[2].parts[0].claims = [wd('ngx 화면 틀을 되돌렸다', '브라우저 뷰어만', 'revert'), wd('예전 틀을 다시 쓴다', 'ng 화면 틀', 'reintroduce')];
  const cs = G.changeSet(p, 1, 3), scenes = V.changeScenes(cs), col = scenes.find(s => s.part === 'col');
  assert.equal(col.main.kind, 'impl');
  assert.equal(V.shownTabs(scenes, 'col', null)[0].word, '구현 상태');
  assert.equal(cs.counts.correct, 0); assert.equal(cs.history.length, 2);
  // A renamed card's tab is its rename when nothing comes first.
  assert.equal(V.shownTabs(scenes, 'sto', null)[0].word, '이름');
});

test('V9-4b 「+N」 is how many other kinds of change the card has: said in the tab\'s tooltip, and the pane says the same number', async () => {
  const p = workshop(), cs = G.changeSet(p, 1, 3), scenes = V.changeScenes(cs), t = V.shownTabs(scenes, 'srt', null)[0];
  assert.equal(t.more, V.otherKinds(t.changes)); assert.ok(t.more > 0);
  assert.equal(V.tabTip(t), `${t.word} · +${t.more}: 이 카드의 다른 변화 ${t.more}가지 (${[...new Set(t.changes.filter(c => c.kind !== t.kind).map(c => c.kind))].map(V.tabKindWord).join(' · ')}) · 눌러서 이 변화 장면 보기`);
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'drawGrowthMarks'), /t\.on, tabTip\(t\), \(\) => growthScene\(t\.part\)\)/);
  assert.match(fn(app, 'growthSceneEl'), /`이 카드의 다른 변화 \$\{otherKinds\(sc\.changes\)\}가지`/);
});

test('V9-4c a renamed card says its old name small under its title while comparing (the full card and the zoomed-out tag)', async () => {
  assert.equal(V.oldNameWord('문서 OCR·색인'), '옛 이름 문서 OCR·색인');
  assert.equal(V.oldNameWord('옛 소비기(old_consumer)'), '옛 이름 옛 소비기');
  const app = await read('src/client/app.ts'), css = await read('public/styles.css'), marks = fn(app, 'drawGrowthMarks');
  assert.match(marks, /if \(!growthPast\) for \(const x of c\.cs\.changes\) if \(x\.kind === 'rename' && x\.before\) \{/);
  assert.match(marks, /\[\['\.c-title', 'c-oldname'\], \['\.c-tag-text', 'c-oldname c-tag-old'\]\]/);
  assert.match(marks, /world\.querySelectorAll\('\.c-oldname'\)\.forEach\(e => e\.remove\(\)\);/);
  assert.match(css, /\.node\.card \.c-title:has\(\.c-oldname\) \.c-kind \{ display: none; \}/);
  assert.match(css, /\.space\.face-tag \.node\.card \.c-tag-text:has\(\.c-tag-old\) \.c-tag-kind \{ display: none; \}/, 'over the tag face\'s own kind line');
});

test('V9-4d every count on the compare line that opens a scene or a list reads as a button, as the two filters do', async () => {
  const css = await read('public/styles.css');
  assert.match(css, /\.gl-row \.gl-item \{ border: 1px solid var\(--line\); height: 22px; padding: 0 7px; \}/);
  assert.match(css, /\.gl-row \.gl-end \{ flex: none; display: flex; align-items: center; gap: 1px; position: sticky; right: 0;/, 'the right end never leaves the line');
});

test('V9-4e the 구현 상태 scene names its kind with both ends and says 「운영 상태 기록 없음」 when the records give none', async () => {
  const p = workshop();
  const ch = G.changeSet(p, 1, 3).changes.find(x => x.kind === 'impl'), add = G.changeSet(p, 3, 5).changes.find(x => x.kind === 'impl');
  assert.equal(V.sceneKind(ch), '구현 상태 변경 · 미구현 → 구현됨'); assert.equal(V.sceneKind(add), '구현 정보 추가');
  assert.equal(V.sceneTitle(ch, id => (id === 'col' ? '수집기' : id)), '수집기', 'the title names the part');
  const scene = fn(await read('src/client/app.ts'), 'growthSceneEl');
  assert.match(scene, /h\('h3', \{\}, sceneKind\(impl\)\)/);
  assert.match(scene, /h\('dt', \{\}, '운영 상태'\), h\('dd', \{\}, opsOn \?/); assert.match(scene, /'운영 상태 기록 없음'/);
});

test('V9-4f 「비교를 끝냈어요」 only once the comparison really closed; a baseline change is said with the numbers counted again; notes go by themselves in a few seconds, above the tools', async () => {
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'growthExit'), /if \(!growthCmp && \$\('growth-line'\)\.hidden\) toast\(EXIT_HINT\);/);
  const cmp = fn(app, 'growthCompare');
  assert.match(cmp, /if \(toastText === EXIT_HINT \|\| toastText === NOW_HINT\) dropToast\(\);/);
  assert.match(cmp, /lastCmp = growthCmp; announceBase\(was, growthCmp\);/);
  assert.match(fn(app, 'announceBase'), /toast\(baseWord\(was\.from, c\.from, kindTotal\(c\.cs\), same\)\);/);
  assert.equal(V.baseWord(4, 5, 36, true), '비교 기준을 지도 v04에서 지도 v05로 바꿨어요 · 변화 36건을 지도 v05 기준으로 다시 셌어요 · 지도 v04 기준과 같은 결과예요');
  assert.equal(V.baseWord(5, 4, 30, false), '비교 기준을 지도 v05에서 지도 v04로 바꿨어요 · 변화 30건을 지도 v04 기준으로 다시 셌어요');
  assert.ok(V.TOAST_MS >= 3000 && V.TOAST_MS <= 5000);
  assert.match(fn(app, 'toast'), /placeToast\(t\); toastTimer = window\.setTimeout\(\(\) => \{ t\.hidden = true; toastText = null; \}, TOAST_MS\);/);
  assert.match(fn(app, 'drawGrowth'), /if \(!\$\('toast'\)\.hidden\) placeToast\(\$\('toast'\)\);/);
  // Above every bar at the bottom: a 720px window with the tools at 622 and the compare line at 672.
  assert.equal(V.toastBottom(720, [622, 672]), 108); assert.equal(V.toastBottom(720, []), 72);
});

test('V9-4g the past view keeps the scene\'s card outlined: that part, or the part it came from by identity', async () => {
  const p = workshop(), scenes = V.changeScenes(G.changeSet(p, 1, 3)), succ = scenes.find(s => s.main.kind === 'succeed');
  assert.equal(V.pastMark(succ, id => id === 'tim'), 'tim', 'the successor was not there then: its predecessor');
  assert.equal(V.pastMark(succ, () => true), 'wat');
  assert.equal(V.pastMark(succ, () => false), null); assert.equal(V.pastMark(undefined, () => true), null);
  const app = await read('src/client/app.ts'), css = await read('public/styles.css');
  assert.match(fn(app, 'applyReadMarks'), /growthPast && c\?\.scene && o \? \[pastMark\(c\.scenes\.find\(s => s\.part === c\.scene\), id => !!drawnRep\(o, id\)\)\]/);
  assert.match(css, /#space\.growth-in-past \.world \.node\.read-mark, #space\.growth-in-past \.world \.frame\.read-mark \{ border-color: var\(--accent\);/);
});

test('V9-4h a scene lights only its own card\'s changed lines; the whole set only while the 연결 item is picked (the past view too)', async () => {
  const app = await read('src/client/app.ts'), lit = fn(app, 'growthLit');
  assert.match(lit, /const ids = all \? c\.cs\.removed\.map\(l => l\.id\) : c\.scene \? sceneLines\(c\.scene\)\.flatMap\(d => d\.removed\.map\(l => l\.id\)\) : \[\];/, 'never every removed line by itself');
  assert.match(lit, /const ends = all \|\| !sc \|\| !o \? null : new Set\(/);
  assert.match(fn(app, 'drawGrowthMarks'), /\(!lit\.ends \|\| lit\.ends\.has\(g\.dataset\.from \?\? ''\) \|\| lit\.ends\.has\(g\.dataset\.to \?\? ''\)\)/);
});

test('V9-4i 기록 반영 상태 names a group\'s part as the map shows it: its own card, or the folded card it is drawn inside', async () => {
  assert.equal(V.heldName('관리 화면', 'Django 실행 틀'), 'Django 실행 틀 안의 관리 화면');
  assert.equal(V.heldName('관리 화면', null), '관리 화면'); assert.equal(V.heldName('관리 화면', '관리 화면'), '관리 화면');
  const g = { key: 'P', part: 'x', kind: 'part', rows: [{}], name: null, sure: false, byItem: [{ item: '연결', n: 1 }] };
  assert.equal(V.groupTitle(g, () => V.heldName('관리 화면', 'Django 실행 틀')).title, 'Django 실행 틀 안의 관리 화면에 관한 미반영 기록 1행');
  assert.match(fn(await read('src/client/app.ts'), 'growthReflectEl'), /const rep = opened \? drawnRep\(opened, id\) : null; return heldName\(sceneName\(id\), rep && rep !== id \? sceneName\(rep\) : null\);/);
});

test('V9-4j every tab touches its own card: on its top edge, else its bottom edge, never beside it or a row apart', () => {
  const card = { x: 100, y: 100, w: 200, h: 80 }, boxes = new Map([['x', card]]);
  // A card right above (no room for a tab there): the tab goes on the bottom edge, inside the card's span.
  const above = [{ id: 'up', x: 100, y: 10, w: 200, h: 86 }];
  const r = V.placeTabs([{ part: 'x', w: 40, h: 20 }], boxes, above, 2).get('x');
  assert.deepEqual(r, { x: 100, y: 182, w: 40, h: 20 });
  // No room above or below: hidden, never floating beside the card.
  const both = [...above, { id: 'down', x: 100, y: 184, w: 200, h: 80 }];
  assert.equal(V.placeTabs([{ part: 'x', w: 40, h: 20 }], boxes, both, 2).get('x'), null);
});

test('V9-5 the guide over a dense view: the least pan sideways or up and down that leaves no card under it, the scene\'s card kept readable; else the guide goes to the pane\'s top', async () => {
  const guide = { x: 0, y: 0, w: 600, h: 90 }, area = { x: 16, y: 98, w: 860, h: 500 };
  // Nothing under it: no move.
  assert.deepEqual(V.guidePan(guide, [{ x: 50, y: 120, w: 200, h: 80 }], null, area, { x: 430, y: 250 }), [0, 0]);
  // A card under it with room below: down.
  const d = V.guidePan(guide, [{ x: 50, y: 60, w: 200, h: 80 }], null, area, { x: 430, y: 250 });
  assert.ok(d && d[1] > 0 && d[0] === 0);
  // Cards in a column under it and a card right below: sideways clears it where up/down cannot.
  const col = [{ x: 400, y: 40, w: 180, h: 80 }, { x: 400, y: 125, w: 180, h: 80 }, { x: 400, y: 210, w: 180, h: 80 }, { x: 400, y: 295, w: 180, h: 80 }, { x: 400, y: -45, w: 180, h: 80 }, { x: 400, y: -130, w: 180, h: 80 }];
  const s = V.guidePan(guide, col, null, area, { x: 430, y: 120 });
  assert.ok(s && s[0] > 0, `sideways: ${s}`);
  // The scene's card stays readable: a pan that would push it out is never taken; with none left, null (the pane's top).
  assert.equal(V.guidePan(guide, col, { x: 400, y: 125, w: 180, h: 80 }, { x: 16, y: 98, w: 600, h: 500 }, { x: 430, y: 120 }), null);
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'renderGrowthPane'), /if \(guideInPane\) content\.find\(e => e\.classList\.contains\('lens-body'\)\)\?\.prepend\(h\('div', \{ class: 'gg-pane', role: 'note' \}, \.\.\.growthGuideEls\(c\)\)\);/);
  assert.match(fn(app, 'closeGrowthPane'), /guideBack\(\);/);
  assert.match(fn(app, 'growthExit'), /growthCmp = null; guideInPane = false;/);
});
