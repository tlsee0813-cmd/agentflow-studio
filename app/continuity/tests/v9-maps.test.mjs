// v9 maps: the review of v8 on the eight maps (code under F7's 12px, a gap between code and its particle, conditions that left the map at
// 1280 and tips that read row IDs, labels the top line kept off after a pan, a hard-coded colour, names cut inside a token, 폐기 cut away,
// one-line sentences cut mid-clause). Each test fails on v8. Fictional strings only.
// No browser: the pure parts run as built; the DOM code is read from the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { conditionTip, lineBadge, joinsRun, tokenFit, condCuts, labelParts } from '../dist/public/client/line-grammar.js';
import { conditionRefWords, projectIdGloss, recordConditionRows, labelWords } from '../dist/public/client/plain-ids.js';
import { josa } from '../dist/public/shared/josa.js';
import { besideSpots, polylineHitsRect } from '../dist/public/client/map-labels.js';
import { PLAN_WORD, KEEP_WORD, clauseCuts, clipKeepPlan, textWidth } from '../dist/public/shared/studio.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const flow = () => readFile(new URL('../src/client/first-flow.ts', import.meta.url), 'utf8');
const rawCss = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const css = async () => (await rawCss()).replace(/\/\*[\s\S]*?\*\//g, '');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));

test('V9-1 code in a line label is at the label\'s own size (12px at rest), never smaller', async () => {
  const c = await css();
  assert.match(c, /\.edge-labels code\.lb-code, \.ff-note code\.lb-code \{ font-weight: 400; font-size: 1em; word-spacing: -\.2em; \}/);
  assert.doesNotMatch(c, /code\.lb-code[^{]*\{[^}]*font-size: \.9\d?em/, 'no smaller code (v8: .94em, 11.28px)');
  // The label it sits in is 12px at rest.
  assert.match(c, /\.space \.edge-labels > \.edge-label:not\(\.on\):not\(\.near\):not\(\.type-chip\):not\(\.revised\) \{ height: 16px; padding: 0 1px; font-size: 12px;/);
});

test('V9-2 no gap between code and the words that follow it with no space; the later run keeps its halo off the letter before it', async () => {
  const c = await css();
  assert.doesNotMatch(c, /lb-tight/, 'no margin after a run (v8: margin-right .3em split 「CLOUD_MODE 가」)');
  assert.doesNotMatch(c, /code\.lb-code[^{]*\{[^}]*margin-right/);
  assert.match(c, /\.edge-labels \.lb-join, \.ff-note \.lb-join \{ clip-path: inset\(-8px -8px -8px 0\); \}/, 'its halo clipped at its own left edge only');
  // Which runs join: no space between them.
  assert.equal(joinsRun('SETTING_MODE', '가 없고'), true);
  assert.equal(joinsRun('SKIP_A_CHECK', '…'), true);
  assert.equal(joinsRun('◇ ', 'SETTING_MODE'), false);
  assert.equal(joinsRun('flag_on', ' 일 때'), false);
  const ps = labelParts('SETTING_MODE가 없을 때');
  assert.ok(ps.length >= 2 && ps[0].code && !ps[1].code && joinsRun(ps[0].t, ps[1].t), JSON.stringify(ps));
  const fill = fn(await app(), 'fillLabel');
  assert.match(fill, /const join = i > 0 && joinsRun\(ps\[i - 1\]!\.t, p\.t\);/);
  assert.match(fill, /p\.code \? h\('code', \{ class: join \? 'lb-code lb-join' : 'lb-code' \}, p\.t\) : join \? h\('span', \{ class: 'lb-join' \}, p\.t\) : document\.createTextNode\(p\.t\)/);
});

test('V9-3 a card title\'s code colour is a token with a value for a dark page', async () => {
  const raw = await rawCss(), c = await css();
  assert.match(c, /\.node\.card \.c-name code\.nm-code \{ color: var\(--code-quiet\); \}/);
  assert.doesNotMatch(c, /\.node\.card \.c-name code\.nm-code \{ color: #/, 'no hard-coded colour');
  assert.match(c, /:root \{[^}]*--code-quiet: #526176;/);
  const dark = raw.slice(raw.indexOf('@media (prefers-color-scheme: dark) {'), raw.indexOf('* { box-sizing: border-box; }'));
  assert.match(dark, /:root\[data-theme="auto"\]:not\(\[data-theme="light"\]\) \{[^}]*--code-quiet: var\(--text-3\);/, 'auto with a dark system');
  assert.match(dark, /:root\[data-theme="dark"\] \{[^}]*--code-quiet: var\(--text-3\);/, 'dark chosen');
});

test('V9-4 a condition\'s tip reads the record\'s own words for its row IDs, and 「<line>과 같음」 that line\'s condition', async () => {
  const g = { ids: null, names: new Map([['CD07', 'len(items) == 0'], ['CD08', 'cfg.skipSetup()']]) };
  const lines = new Map([['LN21', '묶음 안이면 끝난 뒤'], ['LN22', 'LN21과 같음']]);
  assert.equal(conditionRefWords('CD07가 거짓일 때', g, lines), 'len(items) == 0이 거짓일 때', 'the particle follows the words, not the ID');
  assert.equal(conditionRefWords('LN21과 같음', g, lines), '묶음 안이면 끝난 뒤');
  assert.equal(conditionRefWords('LN22와 같음', g, lines), '묶음 안이면 끝난 뒤', 'followed through another line that points on');
  assert.equal(conditionRefWords('LN29과 같음', g, lines), null, 'a line the record does not hold: the words as written');
  assert.equal(conditionRefWords('설정 켜짐일 때', g, lines), '설정 켜짐일 때');
  // A condition row no part's reading kept still reads by its 조건 as the record wrote it (v8: 「조건: CD05」).
  const rec = 'C-COND 조건·거부·분기\n| 행 ID | 부분 | 조건 | 참이면 | 거짓이면 | 갈리는 때 | 근거 |\n|---|---|---|---|---|---|---|\n| CD05 | B07 | mode_raw && !opts.no_shell | 검사 | 다음 | 실행 시 | E06 |\n';
  const p = { pasted: [{ id: 'r1', text: rec }], readings: [] }, rows = recordConditionRows(p);
  assert.equal(rows.get('CD05'), 'mode_raw && !opts.no_shell');
  assert.equal(projectIdGloss(p, () => null).names.get('CD05'), undefined, 'for a tip only: the gloss of the map is as it was (its branch note picks the same condition)');
  assert.match(fn(await app(), 'tipGloss'), /names: new Map\(\[\.\.\.rows, \.\.\.g\.names\]\)/, 'the gloss\'s own names first');
  const g2 = { ids: null, names: rows };
  assert.equal(conditionRefWords('CD05', g2), 'mode_raw && !opts.no_shell');
  assert.equal(conditionRefWords('CD05가 참일 때', g2), 'mode_raw && !opts.no_shell이 참일 때');
  const plain = t => conditionRefWords(t, g, lines) ?? t;
  assert.equal(conditionTip('CD08이 거짓일 때', plain), '조건: cfg.skipSetup()이 거짓일 때');
  assert.equal(conditionTip('LN29과 같음', plain), '조건: LN29과 같음');
  assert.equal(conditionTip('CD08이 거짓일 때'), '조건: CD08이 거짓일 때', 'with no plain: as written (v8 always)');
  const b = lineBadge([{ when: 'LN21과 같음', mode: 'design' }], plain);
  assert.ok(b && b.tip.includes('조건: 묶음 안이면 끝난 뒤') && !b.tip.includes('LN21'), b?.tip);
  assert.deepEqual(b.words, ['LN21과 같음'], 'the words themselves stay as written');
  const a = await app();
  assert.match(a, /const badge = lineBadge\(e\.ids\.map\(id => relInfo\.get\(id\) \?\? \{\}\), condPlain\);/);
  assert.match(a, /conditionTip\(s\.when, condPlain\)/); assert.match(a, /conditionTip\(a\.when, condPlain\)/); assert.match(a, /x\.b\.words\.map\(w => conditionTip\(w, condPlain\)\)/);
  assert.doesNotMatch(a, /conditionTip\([^,()]+\)/, 'every tip resolves');
  assert.match(fn(a, 'placeFitLabels'), /cw\[0\] !== COND_UNSAID \? condWords\(cw\[0\]\) : null/, 'the fit label reads the same words');
  assert.match(fn(a, 'relationConds'), /\/\^\\\|\\s\*\(\[A-Z\]\{1,2\}\\d\{2,3\}\[a-z\]\?\)\\s\*\\\|\/\.exec\(x\.quote\?\.quote \?\? ''\)/);
});

test('V9-5 a condition finds room beside its line and in shorter cuts before it folds to its ◇ (1280: a run held between cards)', async () => {
  // A level run from (0,100) to (300,100), then down to (300,300).
  const pts = [{ x: 0, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }];
  const s = besideSpots(pts, 120, 16, 3);
  assert.ok(s.length >= 8, `${s.length} places`);
  assert.ok(s.some(r => r.y + r.h === 97) && s.some(r => r.y === 103), 'above and below the level run, 3 off it');
  assert.ok(s.some(r => r.x === 303) && s.some(r => r.x + r.w === 297), 'right and left of the upright run');
  assert.ok(s.every(r => !polylineHitsRect(pts, r, 1) || r.x + r.w > 296), 'off the line it labels (but where it turns)');
  // A run shorter than the chip holds none beside it.
  assert.equal(besideSpots([{ x: 0, y: 0 }, { x: 60, y: 0 }], 120, 16, 3).length, 0);
  // The last pass's shorter cuts, longest first, down to the first unit.
  assert.deepEqual(condCuts('SKIP_A_CHECK·SKIP_B_STEP이 없을 때'), ['SKIP_A_CHECK·SKIP_B_STEP이 없을…', 'SKIP_A_CHECK·SKIP_B_STEP이…', 'SKIP_A_CHECK…']);
  const place = fn(await app(), 'placeFitLabels');
  // F8 Q4 supersedes the shorter cuts: a condition is never cut (no 「…」 inside one); it stays whole or folds to its ◇.
  assert.ok(!place.includes('condCuts(base)') && place.includes('if (whole) forms.push([whole, true]);'), 'no cut condition on the map');
  assert.ok(/[(（[][^)）\]]*$/.test('(type이…') && !/[(（[][^)）\]]*$/.test('len(items) == 0가…'));
  assert.match(place, /if \(cond\) besideSpots\(pts, w, hh, 3 \* inv\)\.filter\(r => free\(r\) && !polylineHitsRect\(pts, r, 1\)\)/, 'beside: never over another line');
});

test('V9-6 a pan that takes the top line off a label\'s place places the labels again', async () => {
  const a = await app(), lines = fn(a, 'placeLineLabels');
  assert.ok(lines.includes('ftHeld = [];'), 'what the top line kept off is counted again at each placing');
  assert.match(lines, /const clear = \(r: Rect\) => \{ const hit = blocks\.find\(b => near\(r, b\)\); if \(hit && hit === ftr && ftHeld\.length < FT_HELD_MAX && !blocks\.some\(b => b !== ftr && near\(r, b\)\)\) ftHeld\.push\(r\); return !hit; \};/,
    'a place only the top line blocks is remembered');
  const cam = fn(a, 'applyCamera');
  assert.match(cam, /else if \(ftHeld\.length\) \{ clearTimeout\(ftRecheckAt\); ftRecheckAt = window\.setTimeout\(ftRecheck, FT_RECHECK_MS\); \}/, 'a camera move with no re-place of its own looks again once it rests');
  const re = fn(a, 'ftRecheck');
  assert.match(re, /const r = ftReserve\(\)/); assert.match(re, /if \(ftHeld\.some\(h => !r \|\| !over\(h, r\)\)\) placeEdgeLabels\(\);/);
});

test('V9-7 a name in the 먼저 볼 연결 line is cut between its units, never inside one', async () => {
  assert.equal(tokenFit('StreamHubManager·run_task', 16), 'StreamHubManager…', 'v8: 「StreamHubManag…」');
  assert.equal(tokenFit('ReadWriteStore·Snapshot·Log', 16), 'ReadWriteStore…', 'v8: 「ReadWriteStore·…」');
  assert.equal(tokenFit('스냅숏 {run_dir}/state.bin', 16), '스냅숏 {run_dir}/state.bin', 'v8: 「스냅숏 {run_dir}…」; one cut that keeps less than half: whole');
  assert.equal(tokenFit('질의·쓰기 분배 계층', 16), '질의·쓰기 분배 계층');
  for (const t of ['StreamHubManager·run_task', 'ReadWriteStore·Snapshot·Log', '아주 긴 이름의 부분 하나 둘 셋 넷 다섯 여섯']) {
    const c = tokenFit(t, 16); assert.ok(c === t || (c.endsWith('…') && !/[·,]…$/.test(c) && t.startsWith(c.slice(0, -1))), c);
  }
  // v14 fix 2: the names whole (switcherForms gives way between names, never inside one).
  assert.match(await flow(), /const at = \(id: string\) => name\(id\)\.replace\(\/\\s\+\/g, ' '\)\.trim\(\);/);
});

test('V9-8 the screen keeps 폐기 · 사용 중단 like plan words; a run\'s halt (중단) and what the model reads stay as they were', () => {
  for (const t of ['README에서 폐기 안내', '2025년 사용 중단', '배포 중단']) assert.ok(KEEP_WORD.test(t), t);
  for (const t of ['예외면 중단', '그 문서의 처리를 중단한다', '하강 중단']) assert.ok(!KEEP_WORD.test(t), t);
  // The model's material, the roster and the handover cut by the plan words alone (unchanged since recipe .54).
  for (const t of ['README에서 폐기 안내', '2025년 사용 중단']) assert.ok(!PLAN_WORD.test(t), t);
  const halt = '문서를 받아 파서를 고르고 처리하며, 처리 중 예외가 나면 그 문서의 처리를 중단한다.';
  assert.equal(clipKeepPlan(halt, 20, undefined, false, KEEP_WORD), clipKeepPlan(halt, 20), 'a halt is a plain cut');
  const s = '도구는 작은 모델을 학습하는 스크립트 묶음이고, 사용자가 명령줄에서 직접 돌리며 2024-03 안내문에서 폐기(후속 도구) 안내가 붙었다.';
  const { clauses, words } = clauseCuts(s, KEEP_WORD);
  assert.ok([...clauses, ...words].every(c => c.includes('폐기')), 'no cut leaves it out');
  const cut = clipKeepPlan(s, 40, undefined, false, KEEP_WORD);
  assert.ok(cut.includes('폐기(후속 도구) 안내') && [...cut].length <= 40, cut);
});

test('V9-10 a particle follows the words it stands after: digits read aloud, and an ID replaced by its words', () => {
  assert.equal(josa('v08', '으로/로'), '로'); assert.equal(josa('v01', '으로/로'), '로'); assert.equal(josa('v07', '으로/로'), '로');
  assert.equal(josa('v03', '으로/로'), '으로'); assert.equal(josa('v06', '으로/로'), '으로'); assert.equal(josa('v10', '으로/로'), '으로');
  const g = { names: new Map([['CD03', 'len(files) == 0'], ['CD01', 'pb.skipBootstrap()']]) };
  assert.equal(labelWords('CD03가 거짓일 때', g), 'len(files) == 0이 거짓일 때');
  assert.equal(labelWords('CD01이 거짓일 때', g), 'pb.skipBootstrap()이 거짓일 때');
});

test('V9-9 a one-line sentence is cut at a clause boundary or a whole word; its two lines come first wherever they stand clear', async () => {
  // A verb's joining 「…고」 is a clause boundary; a noun ending so (「보고」) is not.
  assert.ok(clauseCuts('도구는 방문자가 페이지에 짧은 스크립트를 넣고 직접 호스팅하거나 클라우드로 쓰는 분석 앱이다.').clauses.includes('도구는 방문자가 페이지에 짧은 스크립트를 넣고…'));
  assert.deepEqual(clauseCuts('도구는 실행 보고 결과를 모아 표로 내보낸다.').clauses, []);
  // The head kept before a plan word's clause ends on a whole word (the top line; v8: 「… 가…」 inside 「가중치로」).
  const s = '도구는 모델을 처음부터 학습하거나 공개 가중치로 미세조정하는 스크립트 묶음이고, 사용자가 직접 돌리며 2024-03 안내문에서 폐기 안내가 붙었다.';
  for (const n of [44, 48, 52, 56, 60]) {
    const out = clipKeepPlan(s, n, textWidth, true, KEEP_WORD), head = out.split('…')[0];
    assert.ok(out.includes('폐기'), out);
    assert.ok(!head || s.startsWith(head) && [' ', ','].includes(s[head.length]), `${n}: ${out}`);
  }
  const a = await app(), top = fn(a, 'placeFocusTop');
  // v11 (ruling F8 Q2): the top sentence is never on one line nor narrower: whole in up to three lines, the map making the room.
  assert.ok(!top.includes('FT_CAPS') && !top.includes("'ft-one'"), 'no narrower or one-line form');
  const fit = fn(a, 'fitView');
  assert.ok(!fit.includes('FT_CAPS'));
  // v10: each form by the give and the free height before the next is first-flow sentenceRoom's order (v10-maps V10-7).
  assert.match(fit, /const room = sentenceRoom\(FT_SAID, at\.k, least, /, 'each form by the give and the free height before the next');
  assert.doesNotMatch(fit, /for \(const form of FT_SAID\) if \(clear\(form, camera\.k\)\) \{ done = true; break; \} \}\n    if \(!done\) camera = \{ \.\.\.camera, y: y0 \};/, 'v8: one line at the first free step, before two lines at the next');
  assert.doesNotMatch(fn(a, 'syncFocusTop'), /keepPlanFit\(t, t\.dataset\.text/, 'v11: the top sentence is never cut');
});
