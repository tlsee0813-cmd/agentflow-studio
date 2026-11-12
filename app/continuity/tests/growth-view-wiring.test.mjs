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
  // One change colour; 미반영 alone in a quiet amber.
  assert.match(css, /\.gl-row \.gl-un \{ color: #8a641d; \}/);
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
  assert.match(fn(app, 'commit'), /if \(o\.past\) return '지난 지도 버전을 보는 중에는 바꿀 수 없어요\. 현재로 돌아와 주세요\.';/);
  assert.match(app, /if \(handle && o && !o\.past\) \{/);
  assert.match(fn(app, 'arrange'), /if \(!o \|\| o\.past\) return;/);
  assert.match(app, /\$\('add-part'\)\.hidden = o\.kind !== 'saved' \|\| !!o\.past;/);
  assert.match(app, /const mapRun = createMapRun\(\{\n  current: \(\) => liveOpened\(\),/);
  assert.match(app, /const autoSync = createAutoSync\(\{\n  current: \(\) => liveOpened\(\),/);
  assert.match(fn(app, 'mapApplied'), /if \(growthPast\) growthLeavePast\(false\);/);
  const view = fn(app, 'growthView');
  assert.match(view, /const pins = growthPast\?\.pins \?\? pinsOfLayout\(\)/);
  assert.match(view, /renderSpace\('keep'\);/, 'the camera stays');
  assert.match(fn(app, 'pinsOfLayout'), /\{ x: b\.rel\.x, y: b\.rel\.y \}/, 'pinned exactly (0px), container-relative');
  assert.match(app, /\.\.\.\(gp\?\.pins\[c\] \?\? \{\}\), \.\.\.\(gp\?\.extra\[c\] \?\? \{\}\) \};/);
  assert.match(app, /const fix = clearPastOnly\(\[\.\.\.lay\.boxes\.values\(\)\], pinned\);/);
});

test('GROWTH-W4 compare: tabs only while comparing, lit parts by the read-marks highlight, the exit restores lens, selection and camera', async () => {
  const app = await read('src/client/app.ts');
  const cmp = fn(app, 'growthCompare');
  assert.match(cmp, /const saved = growthCmp\?\.saved \?\? \{ lens: viewLens, selected, camera: \{ \.\.\.camera \}, scope \};/);
  const exit = fn(app, 'growthExit');
  assert.match(exit, /if \(viewLens !== c\.saved\.lens\) setLens\(c\.saved\.lens\);/);
  assert.match(exit, /camera = \{ \.\.\.c\.saved\.camera \}; applyCamera\(true\);/);
  assert.match(exit, /go\(o\.key, c\.saved\.selected, c\.saved\.scope\)/);
  assert.match(fn(app, 'growthPick'), /readMarks = c\.picked \?/);
  assert.match(fn(app, 'drawGrowthMarks'), /cardTabs\(c\.cs, c\.picked === 'desc'\)/, '설명 tabs only once picked');
  assert.match(fn(app, 'renderSpace'), /applyLens\(\);\n  drawGrowth\(\);/);
  assert.match(app, /if \(growthCmp && growthTabK && Math\.abs\(camera\.k - growthTabK\) \/ growthTabK > 0\.04\) requestAnimationFrame\(placeGrowthTabs\);/);
  assert.match(app, /const mapBottomInset = \(\) => BOTTOM \+ legendInset\(\) \+ \(\$\('space'\)\.classList\.contains\('growth-cmp'\) \|\| \$\('space'\)\.classList\.contains\('growth-in-past'\) \? 40 : 0\);/);
  // Removed lines are drawn on the earlier version's own drawing only; a retired part has no tab on the current map.
  const lit = fn(app, 'growthLit');
  assert.match(lit, /if \(growthPast\.n !== c\.from\) return null;/);
  assert.match(lit, /cls: 'growth-gone-line'/);
});

test('GROWTH-W5 the scene says only what the record says: its row, 바뀐 때 and cites, the reason or 「이유 기록 없음」, the earlier description', async () => {
  const app = await read('src/client/app.ts');
  const cite = fn(app, 'citeBlock'), scene = fn(app, 'growthSceneEl');
  assert.match(cite, /changeReason\(o\.project, c\.record, c\.part, c\.when\)/);
  assert.match(cite, /'이유 기록 없음'/);
  assert.match(cite, /showQuote\(paste\.id, paste\.text\.slice\(c\.place!\.from, c\.place!\.to\), c\.place!\.from\)/);
  assert.match(scene, /'이전 설명 · 같은 부품에 대한 새 설명이 채택됨'/);
  assert.match(scene, /'빠진 연결은 지금 지도에 그리지 않음 · 남은 부품끼리 잇지 않음 '/);
  assert.match(scene, /기록의 대응 행에서만 읽음/);
  assert.doesNotMatch(app.slice(app.indexOf('/* ---------- the growing map'), app.indexOf('/* ---------- coming back')), /합침|'통합'/, 'a fold the map made is 중복 정리');
});
