// v8 maps: the review of v7 on the eight maps (top sentence at open, conditions that left the map, code that read louder than the words
// around it, titles in two fonts, sentences cut mid-clause). Each test fails on v7. Fictional strings only.
// No browser: the cuts run as built; the DOM code is read from the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { condForms, unquoteLabel, monoTitle, FIT_CODE_MAX } from '../dist/public/client/line-grammar.js';
import { clauseCuts } from '../dist/public/shared/studio.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = async () => (await readFile(new URL('../public/styles.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));
const OP_END = /[=<>!&|+*%^~?]\s*…$/;

test('V8-1 a condition written as code never vanishes at a readable zoom: whole, else cut between its units', () => {
  // v7: whole up to 32 characters or nothing; a whole form with no room left the line bare (「len(files) == 0가 거짓일 때」).
  const a = condForms('len(items) == 0가 거짓일 때');
  assert.equal(a.long, 'len(items) == 0가 거짓일 때');
  assert.ok(a.short && a.short.startsWith('len(items) == 0가') && a.short.endsWith('…'), a.short);
  // Longer than FIT_CODE_MAX: its longest cut between units (v7: no label at all).
  const b = condForms("deploy 작업은 env.repository == 'acme/widget'일 때");
  assert.equal(b.long, 'deploy 작업은…'); assert.equal(b.short, 'deploy 작업은…');
  // One unit: whole, never a cut inside the expression and never nothing.
  for (const t of ['mode_flag != Off', 'alpha_count % beta_interval == 0 and gamma_flag']) { const f = condForms(t); assert.equal(f.long, t); assert.equal(f.short, t); }
  // Never a cut that ends on an operator; every form within the label's room or whole.
  for (const t of ['p.cfg.Automigrate && 목록 요청 성공 && 바뀜 있음', 'x_y >= 3 그리고 z_w != 0 일 때만 다시 보냄']) {
    const f = condForms(t); for (const c of [f.long, f.short]) { assert.ok(c); assert.doesNotMatch(c, OP_END, c); assert.ok(c === t || c.length <= FIT_CODE_MAX + 1, c); }
  }
  // Folded to its ◇ only at the far zoom, and only when longer than FIT_CODE_MAX.
  assert.deepEqual(condForms("deploy 작업은 env.repository == 'acme/widget'일 때", true), { long: null, short: null });
  assert.equal(condForms('mode_flag != Off', true).long, 'mode_flag != Off');
});

test('V8-2 the fit labels use those forms, with a last pass over other lines, and fold only at the dot map', async () => {
  const a = await app(), fit = fn(a, 'fitCut'), place = fn(a, 'placeFitLabels');
  assert.match(fit, /if \(cond && labelParts\(s\)\.some\(p => p\.code\)\) \{ const f = condForms\(s, fold\); return n >= 14 \? f\.long : f\.short; \}/);
  assert.doesNotMatch(fit, /FIT_CODE_MAX \? s : null/, 'no fold at every zoom');
  // F8 Q4 supersedes the cut forms of a condition: it is said whole (condLabelWords, condLabelFits) or folds to its ◇.
  // v12: what a line sends is said whole too (never cut to 14 or 8 characters).
  // v13 C: the same forms over the label's words at the level shown (쉽게: its plain words; 자세히: all of them).
  assert.match(place, /const whole = easyFull === null \? null : cond \? condLabelWords\(easyFull\) : \/…\|\\\.\{3\}\/\.test\(easyFull\) \|\| \[\.\.\.easyFull\]\.length > COND_LABEL_CHARS \? null : easyFull;/);
  assert.match(place, /const easyFull = easy\(\) \? plainLabel\(full\) : full;/);
  // v10 (review of v9: lines ran through a label's text): the last pass keeps off other lines as well (its ◇ with its cue otherwise).
  assert.match(place, /ok = free;/, 'the last pass keeps off cards, heads, the title, labels and other lines');
  assert.match(place, /const free = \(r: Rect\) => clear\(r\) && inMap\(r\) && !lineUnder\(r, e\.key, drawn\);/, 'never past the map\'s drawn extent');
  assert.match(place, /said0 = unquoteLabel\(words \?\? restWord\(e\)\)/);
});

test('V8-3 a label keeps the straight quotes of code (「Store.Cron != ""」, v7 drew 「Store.Cron !=」)', () => {
  assert.equal(unquoteLabel('Store.Cron != ""'), 'Store.Cron != ""');
  assert.equal(unquoteLabel("mode == 'fast'"), "mode == 'fast'");
  assert.equal(unquoteLabel('「변형 ‘로컬 / 원격’」'), '변형 로컬 / 원격');
  assert.equal(unquoteLabel('"설정 켜짐"일 때'), '설정 켜짐일 때');
});

test('V8-4 a folded condition\'s ◇ carries an open cue (three dots), its place as wide as both', async () => {
  const a = await app(), cue = fn(a, 'placeCue');
  assert.ok(a.includes("const cueOpens = (b: LineBadge): boolean => b.kind === 'condition' && b.words.some(w => !!w && w !== '조건' && w !== COND_UNSAID);"));
  assert.match(cue, /ow = open \? s \+ CUE_OPEN_PX \* inv : s/);
  assert.match(cue, /open \? h\('span', \{ class: 'cue-open', 'aria-hidden': 'true' \}\) : null/);
  assert.match(a, /placeCue\(box, e, cue, beside, path, offParts, apart, offLabels, r => !lineUnder\(r, e\.key, shown\), set, cueOpens\(b\)\)/);
  const c = await css();
  assert.match(c, /\.edge-labels > \.edge-cue\.q-open \{ width: 15px; \}/);
  assert.match(c, /\.edge-cue \.cue-open \{ position: absolute;[^}]*radial-gradient/);
});

test('V8-5 the top line\'s place is kept free of notes and labels before they are placed (the sentence shows at open)', async () => {
  const a = await app(), marks = fn(a, 'placeFocusMarks'), labels = fn(a, 'placeLineLabels');
  const r = marks.indexOf('const ftr = ftReserve(); if (ftr) taken.push(ftr);'), m = marks.indexOf('const marks = shownMarkRects(world);'), put = marks.indexOf('const put = ');
  assert.ok(r > 0 && r < put && r < m, 'reserved before any note is put');
  assert.ok(labels.includes('const ftr = ftReserve(); if (ftr) blocks.push(ftr);'), 'no line label under it either');
  const res = fn(a, 'ftReserve');
  assert.match(res, /ftBox\(null, camera, k >= TITLE_FLOOR_K \? titleInk\(\) : null\)/, 'its whole form, beside the title when the title is in its rows');
  assert.match(res, /return \{ x: \(r\.x - camera\.x\) \/ k, y: \(r\.y - camera\.y\) \/ k, w: r\.w \/ k, h: r\.h \/ k \};/, 'in map units, as ftCovers reads it');
});

test('V8-6 a sentence the box cannot hold is cut at a clause boundary, else at a whole word, keeping a plan word', async () => {
  const t = '도구는 설정 파일로 정의한 작업을 한 실행 파일로 일정·재시도와 함께 돌리고, 상태를 외부 저장소 없이 파일에 두는 로컬 우선 엔진이며, 운영자는 명령줄·웹 화면으로 다룬다.';
  const { clauses, words } = clauseCuts(t);
  assert.deepEqual(clauses.slice(0, 2), ['도구는 설정 파일로 정의한 작업을 한 실행 파일로 일정·재시도와 함께 돌리고, 상태를 외부 저장소 없이 파일에 두는 로컬 우선 엔진이며…',
    '도구는 설정 파일로 정의한 작업을 한 실행 파일로 일정·재시도와 함께 돌리고…']);
  assert.ok(words.length > 5 && words.every(w => w.endsWith('…') && t.startsWith(w.slice(0, -1)) && [' ', ','].includes(t[w.length - 1])), 'whole words only');
  // Never ending on an arrow or inside a bracket it opened.
  for (const c of clauseCuts('근거 문장 핵심 흐름은 준비 → 자료 파일 → 학습 반복(배치 → 순전파·역전파 → 주기 평가) → 표본 생성이다.').words) assert.doesNotMatch(c, /[→(]\s*…$|\([^)]*…$/, c);
  assert.ok(!clauses.some(c => c.endsWith('명령줄·웹…')), 'never inside a clause');
  // A joining 「…며」 and 「…거나」 are boundaries; a noun ending in 고 (「보고」) is not.
  assert.ok(clauseCuts('도구는 모델을 처음부터 학습하거나 가중치로 조정하는 작은 스크립트 묶음이다.').clauses.includes('도구는 모델을 처음부터 학습하거나…'));
  assert.deepEqual(clauseCuts('도구는 실행 보고 결과를 모아 표로 내보낸다.').clauses, []);
  // A plan word is never cut away.
  const p = clauseCuts('도구는 파일을 읽어 색인하고, 결과를 표로 내보내며, 원격 저장은 나중에 붙일 계획이다.');
  assert.ok([...p.clauses, ...p.words].every(c => c.includes('계획')), 'only cuts that keep the plan word');
  const a = await app(), sync = fn(a, 'syncFocusTop');
  assert.ok(sync.indexOf('clauseFit(basis ?? t, t, t.dataset.text ??') > 0 && sync.indexOf('clauseFit(') < sync.indexOf('keepPlanFit(basis'), 'before the plan-word cut');
  // v10: the choice between a clause cut and a whole-word cut is first-flow topCut (v10-maps V10-5).
  assert.match(fn(a, 'clauseFit'), /const best = topCut\(clauses, words, c => \{ t\.textContent = c; return !over\(\); \}, most \? CLAUSE_KEEP : 0\);/);
  // The fit measures each form with the whole words, never with the cut a placed form shows (a cut sentence measured one line short).
  const box = fn(a, 'ftBox');
  assert.ok(box.indexOf("for (const [t] of cut) t.textContent = t.dataset.text ?? '';") < box.indexOf('const out = {') && box.indexOf('for (const [t, c] of cut) t.textContent = c;') > box.indexOf('const out = {'));
});

test('V8-7 one font per card title: monospace only for a title that is all code, 4 characters or more; none on a name tag', async () => {
  assert.equal(monoTitle('train_job.py 학습 실행기', [[0, 12]]), false, 'a title with words keeps its own type');
  assert.equal(monoTitle('모델 정의 (net.py)', [[7, 15]]), false);
  assert.equal(monoTitle('run_all.py', [[0, 10]]), true);
  assert.equal(monoTitle('cfg/*.py · run.py', [[0, 8], [11, 17]]), true, 'code and its 「·」 only');
  assert.equal(monoTitle('a.b', [[0, 3]]), false, 'under 4 characters');
  assert.equal(monoTitle('작업자', []), false);
  const a = await app();
  assert.match(fn(a, 'faceNameNodes'), /const spans = nameCodeSpans\(name\); if \(!monoTitle\(name, spans\)\) return breakable\(name\);/);
  const tag = fn(a, 'tagLineNodes');
  assert.doesNotMatch(tag, /MONO|codeNodes|nm-code/, 'a name tag never draws monospace');
  assert.match(tag, /return lines\.map\(l => h\('span', \{ class: 'c-tag-line' \}, l\)\);/);
});

test('V8-8 code reads no louder than the words around it: a title\'s code in the role line\'s colour, a label\'s at the regular weight', async () => {
  const c = await css();
  // v9 (review of v8): the colour is a token (--code-quiet, #526176); the code at the label's own size (F7's 12px); no gap before the
  // words that follow (the later run keeps its halo off the letter before it: v9-maps V9-1, V9-2, V9-3).
  assert.match(c, /\.node\.card \.c-name code\.nm-code \{ color: var\(--code-quiet\); \}/, 'the role line\'s colour, the title\'s size and weight');
  assert.match(c, /\.edge-labels code\.lb-code, \.ff-note code\.lb-code \{ font-weight: 400; font-size: 1em; word-spacing: -\.2em; \}/, 'its wide spaces no wider than the halo covers (its own line never shows through)');
  assert.match(c, /\.edge-labels \.lb-join, \.ff-note \.lb-join \{ clip-path: inset\(-8px -8px -8px 0\); \}/, 'the next words\' halo never covers its last letter');
  assert.match(fn(await app(), 'fillLabel'), /h\('code', \{ class: join \? 'lb-code lb-join' : 'lb-code' \}, p\.t\)/, 'only where words follow with no space');
});
