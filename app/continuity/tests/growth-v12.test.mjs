// The first user of the v11 growth view (v12-growth): a screen that is no scene says that screen and keeps none of the scene's marks; the
// whole comparison's summary is the counts by kind, never a scene's sentence; the lines' count says what it counts; the way back keeps the
// summary's fold and is measured by where the cards stand; every band is covered space for a pan; a scene lights only the lines its change
// is about; the relation-detail cue has its word in the legend and on hover; a tag name is cut between whole units only. Each test fails on
// v11-merged. Fictional rectangles and the anonymised growth fixture only; the DOM wiring is read from the source. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as G from '../dist/public/shared/map-growth.js';
import * as V from '../dist/public/client/growth-view.js';
import * as L from '../dist/public/client/view-lens.js';
import { fitTag } from '../dist/public/client/name-tag.js';
import { growthFixture, fixtureProject } from './growth51-replay.mjs';

const read = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 2); };
const fixture = () => { const q = fixtureProject(growthFixture('track-a')), cs = G.changeSet(q, 4, 9); return { q, cs, scenes: V.changeScenes(cs) }; };
const namesOf = (p, a, b) => { const A = G.pastVersion(p, a).view, B = G.versionAt(p, b).view; return id => B.parts.find(x => x.id === id)?.name ?? A.parts.find(x => x.id === id)?.name ?? '부품'; };

test('V12-1 (first user of v11, 1) 기록 반영 상태, a list and the 철회·변경 rows each say their own screen; the scene\'s tab, lines and mark go with its pane', async () => {
  assert.deepEqual(V.screenGuide({ pane: 'reflect', to: 17, waiting: 48, held: 18 }),
    { head: '기록 반영 상태 · v17 기준', s1: 'v17까지 읽은 기록의 행 가운데 지도에 아직 들어가지 않은 것은 대기 48행, 보류 18행입니다.', s2: '변화 집계와 따로 센 수이며, 할 일의 수가 아닙니다.' });
  assert.deepEqual(V.screenGuide({ pane: 'list', from: 4, to: 17, kind: 'succeed', n: 2 }),
    { head: '승계 목록 · v04 → v17', s1: 'v04와 v17 사이의 승계 2건을 목록으로 봅니다.', s2: '목록에서 하나를 누르면 그 변화 장면이 열립니다.' });
  assert.equal(V.screenGuide({ pane: 'lines', from: 4, to: 17, added: 56, removed: 4 }).s1, 'v17 지도에는 v04 지도에 없던 연결 표시가 56개 있고, v04 지도의 연결 표시 4개가 없습니다.');
  assert.equal(V.screenGuide({ pane: 'history', from: 4, n: 29 }).head, '기록된 철회·변경 29건');
  for (const x of [V.screenGuide({ pane: 'reflect', to: 9, waiting: 1, held: 0 }), V.screenGuide({ pane: 'history', from: 1, n: 3 })]) assert.doesNotMatch(`${x.s1} ${x.s2}`, /‘|반영됐습니다|장면 \d/, 'no scene\'s words');
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'growthGuideEls'), /const sg = growthSceneGuide\(c\) \?\? growthScreenGuide\(c\);/);
  assert.match(fn(app, 'growthScreenGuide'), /c\.pane === 'reflect' \? screenGuide\(\{ pane: 'reflect'/);
  assert.match(app, /const sceneShown = \(c: GrowthCmp\): string \| null => \(c\.pane === 'scene' \? c\.scene : null\);/);
  assert.match(fn(app, 'drawGrowthMarks'), /shownTabs\(c\.scenes, sceneShown\(c\), growthFilter\(c\)\)/);
  assert.match(fn(app, 'growthLit'), /at = sceneShown\(c\)/);
  assert.match(fn(app, 'followMark'), /const at = sceneShown\(c\)/);
  assert.match(fn(app, 'sceneMarks'), /const at = sceneShown\(c\); if \(!at\) return \[\];/);
  assert.match(fn(app, 'growthOpenPane'), /if \(pane === 'reflect' \|\| pane === 'history'\) readMarks = \[\];/);
});

test('V12-2 (first user of v11, 2) the whole comparison\'s summary is the counts by kind: no scene\'s sentence first, never the shown scene\'s sentence again', () => {
  const { q, cs, scenes } = fixture(), nm = namesOf(q, 4, 9), g = V.guideOf(cs, scenes, nm), text = V.guideText(g);
  assert.ok(text.startsWith('v04와 v09 사이에 '), text);
  assert.doesNotMatch(text, /‘|반영됐습니다/, 'no part named, no scene\'s sentence');
  scenes.forEach((s, i) => { const sg = V.sceneGuide(s.main, i, scenes.length, nm, n => V.plainName(n), { when: null, reason: null }, 4); assert.ok(!text.includes(sg.s1), `never a scene's sentence: ${sg.s1}`); });
  const kinds = g.sentences.flat().filter(x => x.fact).map(x => x.fact.kind);
  for (const k of G.SCENE_ORDER) assert.equal(kinds.includes(k), V.kindCount(cs, k) > 0, k);
  if (kinds.includes('new')) assert.equal(kinds.at(-1), 'new', '「v04에 없던 부품 표시」 last');
  for (const x of g.sentences.flat().filter(y => y.fact)) { assert.ok(x.text.includes(String(x.fact.count))); assert.ok('kind' in x.to); }
  for (const b of V.GUIDE_BANNED) assert.ok(!text.includes(b), b);
});

test('V12-3 (first user of v11, 3) 「연결 표시 +N −M」 with its own note beside the parts\' count: it counts what the maps show, not what was made', async () => {
  const { cs } = fixture(), it = V.summaryItems(cs).find(i => i.key === 'lines');
  assert.equal(it.text, `연결 표시${cs.added.length ? ` +${cs.added.length}` : ''}${cs.removed.length ? ` −${cs.removed.length}` : ''}`);
  assert.equal(V.linesWord(56, 4), '연결 표시 +56 −4');
  assert.equal(V.LINES_NOTE, '표시 차이 · 새로 만들었는지 모름', 'short enough to stand beside the parts\' count at 1280');
  const view = await read('src/client/growth-view.ts'), line = fn(view, 'compareLine');
  assert.match(line, /items = all\.filter\(i => i\.key !== 'new' && i\.key !== 'lines'\)/, 'not among the counts of the first row');
  assert.match(line, /lines \? h\('p', \{ class: 'gl-new gl-lines' \}, item\(lines\), h\('span', \{ class: 'gl-new-note' \}, LINES_NOTE\)\) : null/);
  assert.match(view, /lines: `비교 지도에만 있는 연결 표시\(\+\)와 기준 지도에만 있는 연결 표시\(−\) · \$\{LINES_NOTE\}`/, 'its tip says it too');
  const css = await read('public/styles.css');
  assert.match(css, /\.gl-notes \{ display: flex; flex-wrap: wrap;/, 'beside the parts\' count where the row has room');
});

test('V12-4 (first user of v11, 4) the summary opens over the map and never moves it; the way back sets the fold again and is measured by where the cards stand', async () => {
  const app = await read('src/client/app.ts'), css = await read('public/styles.css');
  assert.match(fn(app, 'growthGuideEls'), /onclick: \(\) => \{ c\.sumOpen = !c\.sumOpen; syncGuide\(\); \}/, 'toggling the fold redraws the guide only');
  assert.doesNotMatch(fn(app, 'syncGuide'), /growthClearGuide/, 'no pan from the fold');
  assert.match(fn(app, 'growthGuideEls'), /onclick: \(\) => \{ const t = x\.to!; if \(growthCmp\) growthCmp\.sumOpen = false;/, 'a clause followed closes the summary over the map');
  assert.match(css, /\.focus-top\.growth-guide > \.gg-sum \{ position: absolute;/, 'over the map, the guide\'s height kept');
  assert.match(fn(app, 'growthView'), /pastSum = !!growthCmp\?\.sumOpen; pastCards = cardsOnScreen\(\);/);
  const leave = fn(app, 'growthLeavePast');
  assert.match(leave, /if \(growthCmp\) growthCmp\.sumOpen = pastSum;/);
  assert.match(leave, /pastMoved = redraw && cardsWere \? cardsMoved\(cardsWere\) : 0;/);
  assert.match(fn(app, 'drawGrowth'), /sameCamera\(camera, was\) && pastMoved <= 1/, '「그대로」 only when the cards stand where they stood');
  const ex = fn(app, 'growthExit');
  assert.match(ex, /const moved = r\.kind === 'exact' \? cardsMoved\(before\.cards \?\? \{\}\) : 0, kind = restoreHeld\(r\.camera, camera, anchor\) && moved <= 1 \? r\.kind : 'failed';/);
  assert.match(fn(app, 'cardsMoved'), /Math\.abs\(a\.x - b\.x\), Math\.abs\(a\.y - b\.y\), Math\.abs\(a\.w - b\.w\)/);
});

test('V12-5 (first user of v11, 5) every band is covered space: the pan that clears the guide never pushes a card under the compare line, the tools or the legend chip when another clears it', async () => {
  const view = { x: 0, y: 0, w: 1000, h: 800 }, guide = { x: 0, y: 0, w: 300, h: 100 }, bottom = { x: 0, y: 700, w: 800, h: 100 };
  const A = { x: 100, y: 80, w: 100, h: 50 }, B = { x: 100, y: 640, w: 100, h: 50 }, cards = [A, B];
  // The v11 pan (guidePan) took the least move down, which put B under the bottom band.
  const old = V.guidePan(guide, cards, null, { x: 0, y: 100, w: 1000, h: 600 }, { x: 500, y: 400 });
  assert.ok(V.coveredBy({ ...B, x: B.x + old[0], y: B.y + old[1] }, view, [guide, bottom]), 'v11 covered B');
  const d = V.coverPan(cards, view, [guide, bottom], null, { x: 500, y: 400 }, guide);
  assert.equal(V.coveredCount(cards, view, [guide, bottom], d[0], d[1]), 0, `${d}`);
  assert.ok(!cards.some(c => c.x + d[0] < guide.x + guide.w && guide.x < c.x + c.w + d[0] && c.y + d[1] < guide.y + guide.h && guide.y < c.y + c.h + d[1]), 'the guide clear');
  // Nothing under the guide and nothing better: no move; nothing clears it within the caps: none (the guide goes to the pane's top).
  assert.deepEqual(V.coverPan([B], view, [guide, bottom], null, { x: 500, y: 400 }, guide), [0, 0]);
  assert.equal(V.coverPan([A, { x: 0, y: 0, w: 1000, h: 60 }], view, [guide], null, { x: 10, y: 10 }, guide), null);
  // Taking a readable card off the view is a loss too: here the sideways move would carry the right-hand card out, so the move is down.
  assert.deepEqual(V.coverPan([A, { x: 880, y: 300, w: 100, h: 50 }], view, [guide], null, { x: 500, y: 400 }, guide), [0, 21]);
  // Nothing under the guide: no move at all (F7: the camera stays), even with a card under the bottom band.
  assert.deepEqual(V.coverPan([{ x: 100, y: 680, w: 100, h: 50 }, { x: 100, y: 300, w: 100, h: 50 }], view, [guide, bottom], null, { x: 500, y: 400 }, guide), [0, 0]);
  // A card brought into sight: among the moves that bring it in, the one that loses fewest.
  const need = { card: { x: 100, y: 760, w: 100, h: 50 }, area: { x: 16, y: 100, w: 968, h: 590 } };
  const r = V.coverPan([need.card, { x: 400, y: 120, w: 100, h: 50 }], view, [guide, bottom], null, { x: 500, y: 400 }, null, undefined, need);
  assert.ok(V.readableInView({ ...need.card, x: need.card.x + r[0], y: need.card.y + r[1] }, need.area));
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'growthClearGuide'), /const d = coverPan\(cards, view, bands, kb && kb\.kind !== 'ghost' \? toScreen\(kb\) : null, \{ x: area\.w \/ 2, y: area\.h \/ 2 \}, r, blocks\);/);
  // v13 merge: the same test of what is under the guide, before a pan and after it (hits).
  assert.match(fn(app, 'growthClearGuide'), /const hits = \(dx: number, dy: number\) => blocks\.some\(b => b\.x \+ dx < r\.x \+ r\.w && r\.x < b\.x \+ dx \+ b\.w && b\.y \+ dy < r\.y \+ r\.h && r\.y < b\.y \+ dy \+ b\.h\);/);
  assert.match(fn(app, 'growthClearGuide'), /if \(!hits\(0, 0\)\) \{ if \(!still\) cmpEdgeTidy\(cards, view, hits\); return; \}/, 'no move unless something is under the guide');
  assert.match(fn(app, 'growthBands'), /\['growth-line', 'growth-past', 'line-key'\]/);
  assert.match(fn(app, 'growthReveal'), /coverPan\(cards, fr\(v\.getBoundingClientRect\(\)\), bands, null, \{ x: area\.w \/ 2, y: area\.h \/ 2 \}, null, cards, \{ card, area \}\)/);
  assert.match(app, /const center = \(\) => \{ const a = mapArea\(\); return \[a\.x \+ a\.w \/ 2, a\.y \+ a\.h \/ 2\] as const; \};/, 'the zoom buttons zoom about the free area\'s middle');
  // The folded legend chip takes its short form beside the tools before it stacks a row of its own over the map.
  const dock = fn(app, 'placeDock'), css = await read('public/styles.css');
  assert.match(dock, /if \(el === key && key\.classList\.contains\('folded'\) && x \+ el\.offsetWidth > limit\) key\.classList\.add\('lg-short'\);/);
  assert.match(app, /h\('span', \{ class: 'lg-chip-short' \}, '범례'\)/, 'its short form says what it opens (its whole words in its tip)');
  assert.match(css, /\.line-key\.lg-short :is\(\.lg-chip-text, \.lg-chip-fade\) \{ display: none; \}/);
});

test('V12-6 (first user of v11, 6) a scene lights only the lines its change is about; a rename, a description or an implementation state lights none unless asked', async () => {
  for (const k of ['succeed', 'retire', 'new', 'dedupe', 'merge']) assert.equal(V.litByScene({ kind: k }), true, k);
  for (const k of ['rename', 'desc', 'impl', 'reimpl', 'correct']) assert.equal(V.litByScene({ kind: k }), false, k);
  const { cs } = fixture();
  const rn = cs.changes.find(c => c.kind === 'rename' || c.kind === 'desc' || c.kind === 'impl');
  if (rn) assert.equal(V.litByScene(rn), false);
  assert.equal(V.linesHint(false, false), '이 변화는 연결에 관한 것이 아니라 지도에 밝히지 않음');
  assert.equal(V.LINES_LIGHT, '이 연결 지도에 밝히기');
  const app = await read('src/client/app.ts'), lit = fn(app, 'growthLit');
  assert.match(lit, /const lit = !!sc && !!main && \(litByScene\(main\) \|\| c\.litOn === sc\.part\);/);
  assert.match(lit, /: lit \? sceneLines\(sc!\.part\)\.flatMap\(d => d\.added\.map\(l => l\.id\)\) : \[\]/);
  assert.match(fn(app, 'growthSceneEl'), /c\.litOn = litNow \? null : part; drawGrowth\(\); renderGrowthPane\(\);/, 'lit on request from the scene');
  assert.match(fn(app, 'growthScene'), /if \(c\.scene !== part\) c\.litOn = null;/, 'each scene starts as its change says');
});

test('V12-7 (first user of v11, 7) 「···」 has its word: 「··· 관계 보기」 in the legend under the lenses that draw lines, and on its hover and keyboard name', async () => {
  const lines = [{ key: 'a', channel: 'data', badge: false, from: 'x', to: 'y', detail: true }, { key: 'b', channel: 'data', badge: false, from: 'x', to: 'z' }];
  for (const lens of ['compose', 'data', 'start']) {
    const it = L.legendItems(lens, [], lines).find(i => i.id === 'detail');
    assert.ok(it, lens); assert.equal(it.label, '관계 보기'); assert.deepEqual(it.sample, { kind: 'mark', text: '···' }); assert.equal(it.count, 1); assert.deepEqual(it.lines, ['a']);
  }
  assert.equal(L.legendItems('compose', [], lines.map(l => ({ ...l, detail: false }))).some(i => i.id === 'detail'), false, 'never for nothing drawn');
  assert.equal(L.detailTip('흐름'), '관계 보기 · 흐름 · 이름표를 놓을 자리가 없어 접힌 관계 · 누르면 양 끝과 방향·근거 보기');
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'detailCues'), /cue\.title = detailTip\(words\); cue\.setAttribute\('aria-label', detailTip\(words\)\);/);
  assert.match(fn(app, 'foldAccess'), /el\.classList\.contains\('q-detail'\) \? detailTip\(el\.dataset\.full \?\? words\) :/, 'its keyboard name kept when the labels are made reachable');
  assert.match(app, /detail: dk\.has\(e\.key\)/, 'the legend counts the lines that carry the cue');
  assert.match(app, /if \(sig !== detailSig\) \{ detailSig = sig; if \(opened\) renderLegend\(\); \}/, 'and follows the cues drawn');
});

test('V12-8 (first user of v11, 8: 「문서 소비…」, a first word cut at its middle) a tag name is cut between whole units only, the plain map\'s rule', () => {
  const measure = s => [...s].reduce((n, c) => n + (/[ㄱ-힝]/.test(c) ? 12 : c === '…' ? 9 : 7), 0);
  // v14 fix 1: the words before the bracket that ends the name read whole as its own (gloss), no 「…」 (V14F1-5).
  assert.deepEqual(fitTag('문서 소비기(Consumer)', 60, 1, measure).lines, ['문서 소비기']);
  assert.equal(fitTag('문서 소비기(Consumer)', 60, 1, measure).gloss, true);
  assert.deepEqual(fitTag('문서 소비기 묶음 처리 단계', 60, 1, measure).lines, ['문서…'], 'with no bracket, whole words then 「…」');
  // v14 A (spec 2): never 「…래스터」 (a name's start left out): its first word whole at a smaller type with 「…」 (V14A-1).
  assert.ok(!fitTag('Rasterkit 래스터 파서', 56, 2, measure).lines.join('').startsWith('…'));
  // v14 A (spec 2): whole at a smaller type before any cut.
  { const f = fitTag('자동 배정(매칭·inbox 태그)', 80, 2, measure); assert.ok(f.full && f.scale < 1, f.lines.join('|')); }
  // Whatever is cut, what stands before 「…」 ends where a word of the name ends (never 「소비…」 of 「소비기」).
  const names = ['문서 소비기(Consumer)', 'Rasterkit 래스터 파서', '집 서버 FTP 수신 위치', '로그인·인증 관문', '정기 일정(task_q Schedule)', '로컬 데이터베이스'];
  for (const name of names) for (const w of [40, 56, 70, 90]) for (const n of [1, 2]) {
    const f = fitTag(name, w, n, measure), t = f.lines.join(''), bare = s => s.replace(/\s+/g, '');
    // v14 A (spec 2): 「⋯」 when no whole word fits; a first word whole at a smaller type when its 「…」 cannot fit beside it.
    if (f.none) { assert.equal(t, '⋯'); continue; }
    // v14 fix 1: a gloss is the name's own words before the bracket that ends it, whole.
    if (!t.includes('…')) { if (f.full) assert.equal(bare(t), bare(name)); else if (f.gloss) assert.equal(bare(t), bare(name.replace(/\s*\([^()]*\)$/, ''))); else assert.ok(bare(name).startsWith(bare(t)) && /^[^\s·]+$/.test(t)); continue; }
    const [head, tail] = t.split('…').map(bare);
    // The place in the name where the shown start ends, and where the shown end begins: each at a unit's edge (a space, 「·」, a bracket, a
    // separator, or where an identifier's words meet).
    const at = k => { let seen = 0, i = 0; while (i < name.length && seen < k) { if (!/\s/.test(name[i])) seen++; i++; } return i; };
    const edge = i => i <= 0 || i >= name.length || /[\s·(/_,)]/.test(name[i]) || /[\s·(/_,)]/.test(name[i - 1]) || (/[a-z]/.test(name[i - 1]) && /[A-Z]/.test(name[i]));
    if (head) { assert.ok(bare(name).startsWith(head), `${name}: ${t}`); assert.ok(edge(at(head.length)), `${name} ${w} ${n}: cut inside a word: ${f.lines.join('|')}`); }
    if (tail) { assert.ok(bare(name).endsWith(tail), `${name}: ${t}`); assert.ok(edge(at(bare(name).length - tail.length)), `${name} ${w} ${n}: cut inside a word: ${f.lines.join('|')}`); }
  }
});
