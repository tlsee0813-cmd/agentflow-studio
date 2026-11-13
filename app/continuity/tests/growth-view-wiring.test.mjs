// The growing map's wiring in the app (ruling F6 Q4, Q5): the entry lives in the existing tools (no always-on band), the compare line is
// 32px under the lens bar and the tabs 20px on screen outside the cards' boxes, the baseline is read at the visit's start and written as the
// version shown, a past version is read-only (no save, drag, arrange, new part or reading lands on it), common parts are pinned and the camera
// stays, the comparison's exit restores the lens, the selection and the camera, and the scene says only what the record says. Source reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 2); };

test('GROWTH-W1 the entry: 「지도 이력」 and the quiet chip in the existing tools; the line and the banner apart; no 52px band', async () => {
  const html = await read('public/index.html'), css = await read('public/styles.css');
  const controls = html.slice(html.indexOf('<div class="controls"'), html.indexOf('<div id="help"'));
  assert.match(controls, /id="growth-history"[^>]*>지도 이력</);
  assert.match(controls, /id="growth-chip"[^>]*hidden/);
  assert.match(html, /<div id="growth-line" class="growth-line" hidden><\/div>/);
  assert.match(html, /<div id="growth-past" class="growth-past" hidden><\/div>/);
  const own = css.slice(css.indexOf('/* ---------- The growing map'));
  assert.ok(own.length > 1000);
  assert.doesNotMatch(own, /52px/, 'no always-on band');
  assert.match(css, /\.growth-line \{[^}]*height: 32px;/);
  assert.match(css, /\.space\.growth-cmp > \.controls \{ bottom: calc\(var\(--s-4\) \+ 40px\); \}/, 'the tools step up; the line sits under the lens bar');
  assert.match(css, /\.space\.growth-in-past > \.controls \{ bottom: calc\(var\(--s-4\) \+ 40px\); \}/, 'the past view\'s banner takes the same place');
  assert.match(css, /\.gp-row \{[^}]*height: 32px;/);
  assert.match(css, /\.world \.growth-tab \{[^}]*height: calc\(20px \* var\(--u, 1\)\);[^}]*font-size: calc\(12px \* var\(--u, 1\)\);/);
  // One change colour; 대기·보류 in a neutral grey (review of v7: never read as a warning).
  assert.match(css, /\.gl-row \.gl-un \{ color: var\(--text-2\); \}/);
});

test('GROWTH-W2 the baseline: read when the map opens, kept for the visit, written back as the version shown (the live map, never a past one)', async () => {
  const app = await read('src/client/app.ts');
  assert.match(fn(app, 'loadView'), /growthLoad\(o, v\);/);
  assert.match(fn(app, 'flushView'), /const gm = growthMemoOf\(o\);\n  writeViewState\(kv, viewKeyOf\(o\), \{ folds, cameras: cams, \.\.\.\(gm \? \{ growth: gm \} : \{\}\) \}\);/);
  const memo = fn(app, 'growthMemoOf');
  assert.match(memo, /const live = growthPast && growthPast\.live\.key === o\.key \? growthPast\.live : o/);
  assert.match(memo, /growthMemo\(growthVisit\.base, n, growthVisit\.pick, Date\.now\(\)\)/);
  assert.match(fn(app, 'growthLoad'), /visitBaseline\(v\.growth, Date\.now\(\)\)/);
  // The picked baseline is remembered apart from the visit's.
  assert.match(fn(app, 'renderGrowthEntry'), /growthVisit\.pick = k; saveViewSoon\(\); growthCompare\(k\);/);
  assert.match(fn(app, 'renderGrowthEntry'), /chip\.hidden = base === null \|\| !!growthCmp \|\| !!growthPast;/);
});

test('GROWTH-W3 a past version is read-only and drawn where the current map is: no save, drag, arrange, new part or reading lands on it', async () => {
  const app = await read('src/client/app.ts');
  assert.match(app.slice(app.indexOf('interface Opened {'), app.indexOf('interface Answer')), /\n  past\?: number \}/);
  assert.match(fn(app, 'commit'), /if \(o\.past\) return '지난 지도 버전을 보는 중에는 바꿀 수 없어요\. 아래 줄의 버튼으로 비교 지도나 마지막 지도 버전에 돌아와 주세요.';/);
  assert.match(app, /if \(handle && o && !o\.past\) \{/);
  assert.match(fn(app, 'arrange'), /if \(!o \|\| o\.past\) return;/);
  assert.match(app, /\$\('add-part'\)\.hidden = o\.kind !== 'saved' \|\| !!o\.past;/);
  assert.match(app, /const mapRun = createMapRun\(\{\n  current: \(\) => liveOpened\(\),/);
  assert.match(app, /const autoSync = createAutoSync\(\{\n  current: \(\) => liveOpened\(\),/);
  assert.match(fn(app, 'mapApplied'), /if \(growthPast\) growthLeavePast\(false\);/);
  const view = fn(app, 'growthView');
  assert.match(view, /const pins = growthPast\?\.pins \?\? pinsOfLayout\(\)/);
  assert.match(view, /renderSpace\('keep'\);/, 'the camera stays');
  assert.doesNotMatch(view, /fitView|pastKeepsCamera/, 'F7: the same camera, never fitted');
  assert.match(view, /if \(growthCmp\?\.pane === 'scene'\) renderGrowthPane\(\);/, 'a scene open stays open over its 이전 모습');
  assert.match(fn(app, 'pinsOfLayout'), /\{ x: b\.rel\.x, y: b\.rel\.y \}/, 'pinned exactly (0px), container-relative');
  assert.match(app, /\.\.\.\(gp\?\.pins\[c\] \?\? \{\}\), \.\.\.\(gp\?\.extra\[c\] \?\? \{\}\) \};/);
  assert.match(app, /const fix = clearPastOnly\(\[\.\.\.lay\.boxes\.values\(\)\], pinned\);/);
});

test('GROWTH-W4 compare: tabs only while comparing, lit parts by the read-marks highlight, the exit restores lens, selection and camera', async () => {
  const app = await read('src/client/app.ts');
  const cmp = fn(app, 'growthCompare');
  assert.match(cmp, /const saved = growthCmp\?\.saved \?\? \{ lens: viewLens, selected, camera: \{ \.\.\.camera \}, scope, area: /);
  const exit = fn(app, 'growthExit');
  assert.match(exit, /if \(viewLens !== c\.saved\.lens\) setLens\(c\.saved\.lens\);/);
  // v11 (F8 Q6 ⑤): the camera from just before the comparison, by restoreCamera (growth-v11 V11-5).
  assert.match(exit, /const before = c\.saved;/); assert.match(exit, /camera = \{ \.\.\.r\.camera \}; applyCamera\(true\);/);
  assert.match(exit, /go\(o\.key, c\.saved\.selected, c\.saved\.scope\)/);
  assert.match(fn(app, 'growthPick'), /if \(k === 'new' \|\| k === 'desc'\) \{ const list = filterParts\(c, k\);/, 'the two filters step through their parts');
  // v12 (first user of v11, 1): the scene's tab only while its scene is the pane's (growth-v12 V12-1).
  assert.match(fn(app, 'drawGrowthMarks'), /shownTabs\(c\.scenes, sceneShown\(c\), growthFilter\(c\)\)/, 'at most three tabs; 새 and 설명 only as a filter\'s');
  assert.match(fn(app, 'renderSpace'), /applyLens\(\);\n  drawGrowth\(\);/);
  assert.match(app, /if \(growthCmp && growthTabK && Math\.abs\(camera\.k - growthTabK\) \/ growthTabK > 0\.04\) requestAnimationFrame\(placeGrowthTabs\);/);
  // v11 (F8 Q6 ①): the compare line's own height (its second row with the count of parts the later map shows).
  assert.match(app, /const mapBottomInset = \(\) => BOTTOM \+ legendInset\(\) \+ \(\$\('space'\)\.classList\.contains\('growth-cmp'\) \? \(\$\('growth-line'\)\.offsetHeight \|\| 32\) \+ 8 :/);
  // Removed lines are drawn on the earlier version's own drawing only; a retired part has no tab on the current map.
  const lit = fn(app, 'growthLit');
  assert.match(lit, /if \(growthPast\.n !== c\.from\) return null;/);
  assert.match(lit, /cls: 'growth-gone-line'/);
});

test('GROWTH-W5 the scene says only what the record says: its row, 바뀐 때 and cites, the reason or 「이유 기록 없음」, the earlier description', async () => {
  const app = await read('src/client/app.ts');
  const scene = fn(app, 'growthSceneEl');
  assert.match(scene, /changeReason\(o\.project, main\.cite\.record, main\.cite\.part, main\.cite\.when\)/);
  assert.match(scene, /'이유 기록 없음'/); assert.match(scene, /'변경 시점 기록 없음'/);
  assert.match(fn(app, 'changeQuote'), /t\.text\.slice\(x\.cite\.place\.from, x\.cite\.place\.to\)/, '원문 is the row as written');
  assert.ok(scene.includes("wasLabel(corr ? 'correct' : desc ? 'desc' : null"), "the earlier description says which took it over: a correction or a description update");
  assert.ok(scene.includes("x.kind === 'new' ? newTitle(x, c.from)"), "a part the person added never reads 처음 읽힘");
  assert.match(scene, /'빠진 연결은 비교 지도에 그리지 않음 · 남은 부품끼리 잇지 않음 · 바뀐 연결이 모두 이 변화 때문이라는 뜻은 아님'/);
  assert.doesNotMatch(app.slice(app.indexOf('/* ---------- the growing map'), app.indexOf('/* ---------- coming back')), /합침|'통합'/, 'a fold the map made is 중복 정리');
});

test('GROWTH-W6 the person\'s name and note go through the log; the comparison follows the live map; the 미반영 panel says 기록, not 읽은 기록', async () => {
  const app = await read('src/client/app.ts');
  assert.ok(fn(app, 'editForm').includes("editAreaByPerson(o.project, part.id, name.value, note.value)"));
  assert.equal(/(?<![A-Za-z])editArea\(/.test(app), false, 'no unlogged name or note edit from the app');
  assert.ok(fn(app, 'drawGrowth').includes("growthCmp.proj !== live.project"), "a correction or edit after the last reading redraws the comparison");
  const un = fn(app, 'growthReflectEl');
  assert.match(un, /`아직 읽지 않은 기록 \$\{unread\}개`/, 'records not read yet counted apart');
  assert.match(un, /`대기 \$\{nW\}행 · 보류 \$\{open\.length - nW\}행`/); assert.match(un, /`거절 \$\{rej\.length\}행`/);
  assert.match(un, /`기록 반영 상태 · \$\{versionLabel\(c\.to\)\} 기준`/);
  assert.doesNotMatch(un, /정리된 거절/);
  const view = await read('src/client/growth-view.ts');
  assert.doesNotMatch(view, /unread/, 'no row of a record not read yet');
  assert.ok(fn(app, 'placeFocusMarks').includes('put(chip, (w, hh) => [...hubChipOrder(hubChipSpots('), 'a hub chip\'s places leave out every card title');
});

test('GROWTH-W7 F7: a new range opens on its first scene, a range seen comes back as it was left, a part entered for comes first; the camera moves only for a card out of sight, never fits', async () => {
  const app = await read('src/client/app.ts'), cmp = fn(app, 'growthCompare');
  assert.match(cmp, /const want = focus \?\? saved\.selected;\n  if \(want && c\.scenes\.some\(s => s\.part === want\)\) \{/, 'a part entered for (or selected) comes first');
  assert.match(cmp, /const cs = changeSet\(o\.project, from, to\), memo = growthRanges\.get\(rangeKey\(o\.key, from, to\)\);/);
  assert.match(cmp, /camera = \{ \.\.\.memo\.camera \}; applyCamera\(\);/);
  assert.match(cmp, /if \(c\.scenes\[0\]\) growthScene\(c\.scenes\[0\]\.part\);/, 'on the current map: never the past one by itself');
  assert.match(cmp, /renderSpace\('keep'\);/);
  assert.match(fn(app, 'growthExit'), /rememberRange\(c\);/);
  assert.match(fn(app, 'growthScene'), /growthReveal\(part\);/);
  // v12 (first user of v11, 5): among the pans that bring the card into sight, the one that puts the fewest readable cards under a band (growth-v12 V12-5).
  assert.match(fn(app, 'growthReveal'), /\[lx, ly\] = leastPan\(card, area\); if \(!lx && !ly\) return;/);
  assert.match(fn(app, 'growthReveal'), /if \(dx \|\| dy\) \{ camera = \{ \.\.\.camera, x: camera\.x \+ dx, y: camera\.y \+ dy \}; applyCamera\(true\); \}/, 'a pan, never a zoom');
  const own = app.slice(app.indexOf('/* ---------- the growing map'), app.indexOf('/* ---------- coming back'));
  assert.doesNotMatch(own, /fitView\(|setInterval|autoplay/, 'never fitted, never played by itself');
  // The scene's controls and its 1/N.
  const scene = fn(app, 'growthSceneEl');
  // v11 (F8 Q6 ②): 「기준 지도 · v04」 and 「비교 지도 · v17」 under 「기록을 반영한 두 지도 비교」 (growth-v11 V11-2).
  for (const w of ["mapWord('기준', c.from)", "mapWord('비교', c.to)", "'기록을 반영한 두 지도 비교'", "'이전 변화'", "'다음 변화'", "'원문'", "'이전 부품 위치 보기'", "'원래 위치로'"]) assert.ok(scene.includes(w), w);
  assert.match(scene, /stepWord\(f, Math\.max\(0, i\), list\.length\)/);
  // The guide in the top box's place, only while comparing (review of v8: or at the pane's top when no pan clears the map's top for it).
  assert.match(fn(app, 'renderFocusTop'), /if \(gc\) \{ delete el\.dataset\.guide; syncGuide\(\); el\.hidden = guideInPane; syncFocusTop\(\); return; \}/);
  assert.match(fn(app, 'growthGuideEls'), /guideOf\(c\.cs, c\.scenes, sceneName, sceneSay\)/);
  // 대기·보류 at the line's end: the waiting and held rows only.
  assert.match(fn(app, 'drawGrowth'), /growthUnreflected\(\)\?\.filter\(x => x\.state !== 'rejected'\)\.length/);
  // Code the growth view shows: quiet monospace, never bold, filled or bordered; 12px.
  const css = await read('public/styles.css'), code = css.slice(css.indexOf('.g-code {'), css.indexOf('}', css.indexOf('.g-code {')));
  assert.match(code, /font-size: 12px;/); assert.match(code, /font-weight: inherit;/); assert.match(code, /background: none;/); assert.match(code, /border: 0;/); assert.match(code, /padding: 0;/);
});

test('GROWTH-W8 the first screen keeps the map\'s own title and its sentence: a frame on the first flow pans the title in, a whole frame finds room at its own scale, the one-line top box may stand narrower', async () => {
  const app = await read('src/client/app.ts'), fit = fn(app, 'fitView');
  assert.match(fit, /if \(s && s\.x < 16\) camera = \{ \.\.\.camera, x: camera\.x \+ \(16 - s\.x\) \};/, 'the title in sight whole');
  assert.doesNotMatch(fit, /out <= whole \? -out : whole/, 'never pushed out at the left');
  // v11 (ruling F8 Q2): never on one line: in conflict the title is kept and the map moves down under the whole box.
  assert.match(fit, /const r = ftBox\(null, camera, inkAt\(camera\.k\)\)/, 'in conflict: the title kept and the box whole');
  // v10: the room at the same scale first, then with the give, is first-flow sentenceRoom's order (v10-maps V10-7).
  assert.match(fit, /sentenceRoom\(FT_SAID, at\.k, least, \(form, k, d\) => \{ at\.place\(k\); camera = \{ \.\.\.camera, y: camera\.y \+ d \}; return clear\(form, k\); \}, k => \{ at\.place\(k\); return mapSlack\(\); \}\)/, 'room at the same scale first');
  assert.match(fit, /\(at\.k >= TITLE_FLOOR_K && a2\.k < TITLE_FLOOR_K\)\) break;/, 'a smaller frame never drops the title');
  // Merge v7: polish 5 moved the forms from syncFocusTop to placeFocusTop.
  // v11 (ruling F8 Q2): no narrower one-line form; under the map the sentence steps back and the way to the whole summary stays.
  assert.match(fn(app, 'placeFocusTop'), /if \(!covers\(\)\) return;[\s\S]*el\.classList\.add\('ft-under'\); ftPlace\(el, camera, ink\);/);
});
