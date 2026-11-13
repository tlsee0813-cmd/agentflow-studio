// Ruling F8 Q6 ①–⑤ and the review of the v10 growth view (v11-growth): the count of parts the later map shows that the earlier did not says
// what it counts where the counts are first seen; the scene's two map buttons by what they are; the later records' word off a past card; the
// guide says the scene shown; leaving restores the state from just before, exactly, and says what it came to; the past view keeps the camera;
// hub chips on their own card only, off the legend chip; notes placed where the camera stops; nothing but plain line under the guide; a tab on
// its bottom edge only with room; old names at 12px; no label through the title chip; no title cut by the window's side. Each test fails on
// v10a-merged. Fictional rectangles and the anonymised growth fixture only; the DOM wiring is read from the source. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as G from '../dist/public/shared/map-growth.js';
import * as V from '../dist/public/client/growth-view.js';
import * as F from '../dist/public/client/first-flow.js';
import { growthFixture, fixtureProject } from './growth51-replay.mjs';

const read = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 2); };
const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const fixture = () => { const q = fixtureProject(growthFixture('track-a')), cs = G.changeSet(q, 4, 9); return { q, cs, scenes: V.changeScenes(cs) }; };
const namesOf = (p, a, b) => { const A = G.pastVersion(p, a).view, B = G.versionAt(p, b).view; return id => B.parts.find(x => x.id === id)?.name ?? A.parts.find(x => x.id === id)?.name ?? '부품'; };
/** The growing map's own part of app.ts (its words and wiring). */
const growthSrc = src => src.slice(src.indexOf('/* ---------- the growing map'), src.indexOf('/* ---------- coming back'));

test('V11-1 (F8 Q6 ①) 「v04에 없던 부품 표시 23개」 with what it counts, where the counts are first seen; the list is 「지도 표시 추가」; never 「처음 발견」 or 「새로 찾음」', async () => {
  const { q, cs, scenes } = fixture();
  const A = new Set(G.pastVersion(q, 4).view.parts.map(x => x.id)), B = G.versionAt(q, 9).view.parts.map(x => x.id);
  assert.equal(cs.counts.new, B.filter(id => !A.has(id)).length, 'the permanent part IDs on the later version and not on the earlier');
  const item = V.summaryItems(cs).find(i => i.key === 'new');
  assert.equal(item.text, `v04에 없던 부품 표시 ${cs.counts.new}개`);
  assert.equal(V.NEW_NOTE, '표시의 추가를 센 수입니다. 새로 개발됐는지는 이 숫자로 알 수 없습니다.');
  assert.equal(V.NEW_LIST, '지도 표시 추가');
  assert.equal(V.stepWord('new', 0, 23), '지도 표시 추가 1/23');
  assert.equal(V.tabKindWord('new'), '지도 표시 추가');
  const fresh = scenes.find(s => s.main.kind === 'new').main, nm = namesOf(q, 4, 9);
  assert.equal(V.sceneKind(fresh), '지도 표시 추가');
  assert.equal(V.sceneSentence(fresh, nm), `‘${nm(fresh.part)}’의 표시가 지도에 추가됐습니다.`);
  for (const b of ['처음 발견', '새로 찾']) assert.ok(V.GUIDE_BANNED.includes(b), b);
  const words = [V.guideText(V.guideOf(cs, scenes, nm)), ...scenes.flatMap(s => s.changes.flatMap(c => [V.sceneSentence(c, nm), V.sceneKind(c)]))];
  for (const w of words) for (const b of V.GUIDE_BANNED) assert.ok(!w.includes(b), `${b} in ${w}`);
  // The count stands in its own row of the compare line with its note (13px, the body's colour).
  const view = await read('src/client/growth-view.ts'), css = await read('public/styles.css');
  assert.match(fn(view, 'compareLine'), /h\('p', \{ class: 'gl-new' \}, item\(fresh\), h\('span', \{ class: 'gl-new-note' \}, NEW_NOTE\)\)/);
  assert.match(css, /\.gl-new-note \{[^}]*font-size: 13px;[^}]*color: var\(--text\);/);
  assert.doesNotMatch(growthSrc(await read('src/client/app.ts')), /'지도에 새로 표시'|새로 만들었다는 뜻이 아님/);
});

test('V11-2 (F8 Q6 ②) 「기준 지도 · v04」 and 「비교 지도 · v17」 under 「기록을 반영한 두 지도 비교」; no 「현재」 or 「지금」 in the scene, the past banner or the notes', async () => {
  assert.equal(V.mapWord('기준', 4), '기준 지도 · v04'); assert.equal(V.mapWord('비교', 17), '비교 지도 · v17');
  const app = await read('src/client/app.ts'), scene = fn(app, 'growthSceneEl'), own = growthSrc(app);
  assert.match(scene, /h\('p', \{ class: 'gs-maps-cap', id: 'gs-maps-cap' \}, '기록을 반영한 두 지도 비교'\)/);
  assert.match(scene, /btn\('gs-past', mapWord\('기준', c\.from\)/); assert.match(scene, /btn\('gs-now', mapWord\('비교', c\.to\)/);
  for (const w of ["'이전 모습'", "'현재 모습'", "'현재로'", '지금 지도', '지금 설명', "'지금'"]) assert.ok(!own.includes(w), w);
  const view = await read('src/client/growth-view.ts');
  for (const w of ["'현재로'", '현재 지도로', '지금 지도에', '이후 은퇴']) assert.ok(!view.includes(w), w);
  assert.equal(V.nowWord(true, true, '비교 지도 · v17'), '비교 지도 · v17로 돌아왔어요 · 고른 카드와 배율·위치는 기준 지도를 보기 전 그대로예요');
  // 1280: the whole names (their row wraps, never shortened).
  assert.match(await read('public/styles.css'), /\.gs-maps-row \.gs-b \{ white-space: nowrap; \}/);
});

test('V11-3 (F8 Q6 ③) the later records\' word stands off the past card in four wordings, never on its state mark; its note says first that the record confirms no stop and no successor running', async () => {
  assert.equal(V.followWord(V.followKind({ successor: 'b', named: null }, false), '옛 타이머', '새 감시기'), '후속 기록: 새 감시기가 옛 타이머를 대신함');
  assert.equal(V.followWord(V.followKind({ successor: null, named: 'z' }, false), '임시 도구', null), '후속 기록: 다른 부품이 임시 도구를 대신함');
  assert.equal(V.followWord(V.followKind({ successor: null, named: null }, false), '임시 도구', null), '후속 기록: 없어짐');
  assert.equal(V.followWord(V.followKind(null, true), '임시 도구', null), '후속 기록: 은퇴로 보고됨');
  assert.equal(V.followWord(V.followKind(null, false), '임시 도구', null), '비교 지도에 표시 없음');
  assert.equal(V.FOLLOW_NO_OPS, '이 기록으로 실행 중지나 후계의 가동 여부는 확인되지 않습니다.');
  const app = await read('src/client/app.ts'), marks = fn(app, 'drawGrowthMarks'), fm = fn(app, 'followMark');
  assert.doesNotMatch(marks, /이후 은퇴/);
  assert.match(fm, /h\('p', \{ class: 'gf-first' \}, said\.length \? said\[0\]! : FOLLOW_NO_OPS\)/);
  assert.match(fm, /s\.state === 'running' \|\| s\.state === 'working' \|\| s\.state === 'stopped'\)\)/, 'only a running state is evidence of running');
  // Off the card: a gap of 6px on screen, from the card's ends when wider; its note on the far side from the card.
  assert.match(fn(app, 'placeTabsNow'), /boxes, obstacles, 6 \/ camera\.k, 8 \/ camera\.k, 16 \/ camera\.k, 'ends'\)/);
  const card = { x: 100, y: 100, w: 120, h: 60 }, r = V.placeTabs([{ part: 'a', w: 200, h: 22 }], new Map([['a', card]]), [], 6, 8, 16, 'ends').get('a');
  assert.deepEqual(r, { x: 100, y: 72, w: 200, h: 22 }, 'from the card\'s left edge, 6 above it, never on it');
  assert.equal(meets(r, card), false);
  assert.match(await read('public/styles.css'), /\.world \.growth-follow \{[^}]*dashed/);
});

test('V11-4 (F8 Q6 ④) the guide says the scene shown: 「장면 n/N · 종류」, its change, its time and reason or the limit; the summary is its own fold; it follows the scene in the pane\'s frame', async () => {
  const { q, cs, scenes } = fixture(), nm = namesOf(q, 4, 9), say = n => V.plainName(n);
  scenes.forEach((s, i) => {
    const g = V.sceneGuide(s.main, i, scenes.length, nm, say, { when: null, reason: null }, 4);
    assert.ok(g.head.startsWith(`장면 ${i + 1}/${scenes.length} · `), g.head);
    assert.ok(g.s1.includes(`‘${nm(s.part)}’`), 'the scene\'s own part');
    for (const o of scenes) if (o.part !== s.part && nm(o.part) !== nm(s.part) && !(s.main.predecessor === o.part)) assert.ok(!g.s1.includes(`‘${nm(o.part)}’`), `never another scene's part: ${g.s1}`);
    for (const t of [g.s1, g.s2]) for (const b of V.GUIDE_BANNED) assert.ok(!t.includes(b), `${b} in ${t}`);
  });
  const p = { kind: 'succeed', part: 'b', predecessor: 'a', name: 'B' }, n = id => (id === 'a' ? '옛 타이머' : '새 감시기');
  assert.deepEqual(V.sceneGuide(p, 1, 5, n, say, { when: 'abc1234 2020-01-02', reason: null }, 4),
    { head: '장면 2/5 · 대체 기록', s1: '‘옛 타이머’를 ‘새 감시기’가 대신한다는 기록이 반영됐습니다.', s2: '바뀐 때는 기록에 ‘abc1234 2020-01-02’로 적혀 있고, 이유는 기록에 없습니다.' });
  assert.equal(V.sceneGuide(p, 0, 5, n, say, { when: null, reason: null }, 4).s2, '바뀐 때와 이유는 기록에 없고, 실행이 멈췄는지는 이 기록으로 확인되지 않습니다.');
  assert.equal(V.sceneGuide({ kind: 'new', part: 'b', name: 'B', since: 7, by: 'reading' }, 0, 3, n, say, { when: null, reason: null }, 4).s2, 'v07 지도에서 처음 표시됐으며, 새로 개발됐는지는 이 표시로 알 수 없습니다.');
  assert.equal(V.SUMMARY_FOLD, '전체 비교 요약'); assert.equal(V.GUIDE_LOADING, '이 장면의 설명을 불러오는 중');
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'renderGrowthPane'), /syncGuide\(\); syncMapArea\(\);\n\}/, 'the guide is redrawn with the pane, in the same frame');
  assert.match(fn(app, 'growthGuideEls'), /const sg = growthSceneGuide\(c\);/);
  assert.match(fn(app, 'growthGuideEls'), /h\('section', \{ class: 'gg-sum', 'aria-label': SUMMARY_FOLD \}/);
  assert.match(fn(app, 'growthSceneGuide'), /const list = f \? filterParts\(c, f\) : c\.scenes\.map\(s => s\.part\), i = list\.indexOf\(c\.scene\);|list = f \? filterParts\(c, f\) : c\.scenes\.map\(s => s\.part\), i = list\.indexOf\(c\.scene\)/, 'numbered as the pane numbers it');
});

test('V11-5 (F8 Q6 ⑤) leaving restores the panels, then the camera, exactly (0.1%, 1px) or by its centre when the area changed, never fitted; the three words', async () => {
  const saved = { x: -535.2, y: 154.2, k: 0.6 }, area = { w: 896, h: 668 };
  assert.deepEqual(V.restoreCamera(saved, area, { ...area }), { camera: saved, kind: 'exact' });
  const r = V.restoreCamera(saved, area, { w: 1056, h: 848 });
  assert.equal(r.kind, 'center'); assert.equal(r.camera.k, saved.k);
  const c0 = { x: (area.w / 2 - saved.x) / saved.k, y: (area.h / 2 - saved.y) / saved.k };
  assert.ok(Math.abs(r.camera.x + c0.x * r.camera.k - 1056 / 2) < 1e-9 && Math.abs(r.camera.y + c0.y * r.camera.k - 848 / 2) < 1e-9, 'the same map point at the centre');
  const anchor = { x: 400, y: 300 };
  assert.equal(V.restoreHeld(saved, { ...saved }, anchor), true);
  assert.equal(V.restoreHeld(saved, { ...saved, k: saved.k * 1.0009, x: saved.x - anchor.x * saved.k * 0.0009, y: saved.y - anchor.y * saved.k * 0.0009 }, anchor), true, 'within 0.1% and 1px');
  assert.equal(V.restoreHeld(saved, { ...saved, k: saved.k * 1.002 }, anchor), false, 'past 0.1%');
  assert.equal(V.restoreHeld(saved, { ...saved, x: saved.x + 1.5 }, anchor), false, 'past 1px');
  assert.deepEqual(V.RESTORE_WORD, { exact: '비교 전 배율과 위치로 돌아왔어요.', center: '비교 전 배율과 중심을 유지했어요.', failed: '지도로 돌아왔어요. 비교 전 위치는 복원하지 못했어요.' });
  const app = await read('src/client/app.ts'), ex = fn(app, 'growthExit');
  assert.match(ex, /r = restoreCamera\(before\.camera, before\.area \?\? area, area\);\n {4}camera = \{ \.\.\.r\.camera \}; applyCamera\(true\);/);
  assert.match(ex, /const kind = restoreHeld\(r\.camera, camera, anchor\) \? r\.kind : 'failed';/);
  assert.match(ex, /\}, RESTORE_SETTLE_MS\);/, 'said once the camera has settled');
  assert.match(fn(app, 'growthCompare'), /area: \{ w: \$\('viewport'\)\.clientWidth, h: \$\('viewport'\)\.clientHeight \} \};/);
  assert.doesNotMatch(ex, /fitView/);
});

test('V11-6 (F7, F8 Q6 ③) the past view keeps the camera and the scale; a scene\'s card out of sight has 「이전 부품 위치 보기」, which moves there only on request', async () => {
  const app = await read('src/client/app.ts'), gv = fn(app, 'growthView'), scene = fn(app, 'growthSceneEl');
  assert.doesNotMatch(gv, /growthReveal|keepInView|applyCamera|fitView/);
  assert.match(gv, /growthClearGuide\(true\);/, 'the guide goes to the pane\'s top rather than moving the map');
  assert.doesNotMatch(app, /function keepInView\(/);
  assert.match(scene, /main\.kind === 'retire' \? main\.part : pastMark\(sc, id => !!opened && !!drawnRep\(opened, id\)\)\) : null/, 'any scene\'s card, not only a 승계\'s');
  assert.match(scene, /growthAside \? '원래 위치로' : '이전 부품 위치 보기'/);
  assert.match(fn(app, 'growthClearGuide'), /if \(d && \(d\[0\] \|\| d\[1\]\) && !still\)/);
});

test('V11-7 (review of v10) a hub chip touches its own card only, never a row further, and keeps off the legend chip and the first-view line', async () => {
  const card = { x: 0, y: 0, w: 224, h: 80 }, w = 90, hh = 20, gap = 4, ring = { x: -gap, y: -gap, w: card.w + 2 * gap, h: card.h + 2 * gap };
  const spots = F.hubChipSpots(card, w, hh, gap), order = F.hubChipOrder(spots, w, hh, [], ring);
  for (const p of order) assert.ok(F.touchesCard({ x: p.x, y: p.y, w, h: hh }, ring), JSON.stringify(p));
  assert.equal(order.length, 6, 'the four edges and the two sides; the row-further places are gone');
  const legend = { x: card.x + card.w - w - 10, y: card.h, w: 200, h: 40 }, covered = F.hubChipOrder(spots, w, hh, [], ring, [legend]);
  assert.equal(meets({ ...covered[0], w, h: hh }, legend), false, 'a place under the legend chip after the rest');
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'chipsSeen'), /\['#focus-top', '#growth-line', '#growth-past', '#space > \.controls', '#line-key', '#first-view'\]/);
  assert.match(app, /const COVER_SEL = \[[^\]]*'#line-key', '#first-view'/);
});

test('V11-8 (review of v10) a note is placed against the cards where the camera stops (never mid-move), and never over one where a free place is', async () => {
  const app = await read('src/client/app.ts'), pt = fn(app, 'placeToast');
  assert.match(pt, /const cards = \[\.\.\.lay\.boxes\.values\(\)\]\.map\(b => toScreen\(/);
  assert.doesNotMatch(pt, /querySelectorAll<HTMLElement>\('#world \.node, #world \.ghost'\)\.\]?\.map\(e => e\.getBoundingClientRect\(\)\)/);
  const area = { x: 0, y: 0, w: 1000, h: 700 }, cards = [{ x: 300, y: 600, w: 300, h: 80 }, { x: 0, y: 500, w: 1000, h: 60 }];
  const at = V.toastSpot({ w: 320, h: 40 }, area, 620, cards);
  assert.equal(cards.some(c => meets({ ...at, w: 320, h: 40 }, c)), false);
});

test('V11-9 (review of v10: 「사건 때」 under the guide at 1280 104%) labels placed again after the guide\'s pan keep off the guide', async () => {
  const app = await read('src/client/app.ts'), fr = fn(app, 'ftReserve');
  assert.doesNotMatch(fr, /if \(!ftShown\(\) \|\| \$\('focus-top'\)\.classList\.contains\('growth-guide'\)\) return null;/);
  assert.match(fr, /if \(\$\('focus-top'\)\.classList\.contains\('growth-guide'\)\) \{/);
});

test('V11-10 (review of v10: the Tesseract tab on its bottom edge read as Tika\'s) the top edge first; the bottom only with 16px to every other card', () => {
  const b = { x: 0, y: 100, w: 224, h: 60 }, above = { x: 0, y: 40, w: 224, h: 52 }, boxes = (under) => new Map([['b', b], ['a', above], ['u', under]]);
  const obstacles = under => [{ id: 'a', ...above }, { id: 'u', ...under }, { id: 'b', ...b }];
  const near = { x: 0, y: 190, w: 224, h: 60 }, far = { x: 0, y: 200, w: 224, h: 60 };
  assert.equal(V.placeTabs([{ part: 'b', w: 60, h: 20 }], boxes(near), obstacles(near), 0, 8, 16).get('b'), null, 'the card under it is 10px off the tab');
  assert.deepEqual(V.placeTabs([{ part: 'b', w: 60, h: 20 }], boxes(far), obstacles(far), 0, 8, 16).get('b'), { x: 0, y: 160, w: 60, h: 20 }, '20px: the bottom edge');
  const open = new Map([['b', b]]);
  assert.deepEqual(V.placeTabs([{ part: 'b', w: 60, h: 20 }], open, [{ id: 'b', ...b }], 0, 8, 16).get('b'), { x: 0, y: 80, w: 60, h: 20 }, 'the top edge first');
});

test('V11-11 (review of v10: 「옛 이름」 at 11.8px at the 1280 fit) an old name reads at 12px on screen at least, else it is not drawn (its card\'s tab and the pane keep it)', async () => {
  const app = await read('src/client/app.ts'), po = fn(app, 'placeOldNames');
  assert.match(app, /const OLD_NAME_MIN = 12;/);
  assert.match(po, /px >= OLD_NAME_MIN - 0\.05/);
  assert.match(po, /const s = Math\.max\(inv, 1 \/ \(camera\.k \|\| 1\)\); el\.dataset\.s = String\(s\);/);
});

test('V11-12 (review of v10) no label reads through the title chip (looked at again where a moving camera stops); a title the window\'s side cuts steps back', async () => {
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'clipAtEdge'), /const st = document\.getElementById\('scope-sticky'\), sr = st && !st\.hidden && st\.offsetWidth \? st\.getBoundingClientRect\(\) : null;/);
  assert.match(fn(app, 'applyCamera'), /clearTimeout\(clipLate\); if \(animate\) clipLate = window\.setTimeout\(clipAtEdge, CAMERA_MOVE_MS\);/);
  assert.match(fn(app, 'updateSticky'), /const cutSide = ti\.x < -1 \|\| ti\.x \+ ti\.w > vp\.width \+ 1;/);
  assert.match(fn(app, 'updateSticky'), /classList\.toggle\('pinned', !st\.hidden \|\| underTop \|\| cutSide\)/);
});
