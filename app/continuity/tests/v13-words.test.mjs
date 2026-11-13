// v13 C (words and regressions): the map's word level 「쉽게 · 자세히」 (spec item 4) and the three v12 regressions (spec item 5): the
// compare line and the tools covering cards, ◇ marks whose target met a card, the two lines of an opposite pair standing too close on a
// crowded side. Each test fails on v12-merged. Fictional strings only.
// No browser: the pure parts run as built; the DOM code that uses them is read from the source (the rendered pages are checked by the
// headless checker of this round).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as W from '../dist/public/client/word-level.js';
import * as M from '../dist/public/client/mark-room.js';
import * as R from '../dist/public/client/map-route.js';
import * as G from '../dist/public/client/growth-view.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const html = () => readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));
const kv = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m }; };

test('V13C-1 the word level is 쉽게 by default, kept on this browser, and a refusing browser never breaks it', () => {
  assert.equal(W.WORDS_DEFAULT, 'easy');
  assert.equal(W.readWords(kv()), 'easy');
  assert.equal(W.readWords(null), 'easy');
  const s = kv();
  assert.equal(W.writeWords(s, 'detail'), true);
  assert.equal(W.readWords(s), 'detail');
  assert.equal(W.readWords(kv({ [W.WORDS_KEY]: 'loud' })), 'easy', 'an unknown value reads as the default');
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(W.readWords(bad), 'easy');
  assert.equal(W.writeWords(bad, 'detail'), false);
  assert.deepEqual(W.WORDS_WORD, { easy: '쉽게', detail: '자세히' });
  assert.match(W.WORDS_TIP.easy, /◇/, 'the tip says where the moved words are');
});

test('V13C-2 a line label at 쉽게: plain words as written, a code parenthetical left out, code or an ID alone behind its cue', () => {
  const P = W.plainLabel;
  // Plain words, as written (English words that are not code stay: 「Bootstrap」, 「PR」, 「start」).
  for (const t of ['규칙 통과 시', '서버 시작 전', '작업마다 cron 식', 'Bootstrap 안', 'start 명령', 'PR(병합 요청)', '판정 참일 때(거짓이면 401)', '의존성 갱신 PR']) assert.equal(P(t), t, t);
  // A parenthetical that holds only code leaves; the words before it stay.
  assert.equal(P('기본 꺼짐(cloud.report)'), '기본 꺼짐');
  // No plain words left: behind the cue.
  for (const t of ['load_meta', 'real_data', 'npm run build', 'auth-with-oauth2', 'Backups.Cron != ""', 'SIGINT·SIGTERM', 'REDIS_URL 있을 때', 'publish_formats 값마다', 'doSave 조건 통과 시', 'LN13과 같음', 'run()이 Err']) assert.equal(P(t), null, t);
  assert.equal(W.hasCode('cfg.retry_max'), true);
  assert.equal(W.hasCode('오븐에서 꺼냄'), false);
  assert.equal(W.hasCode('F07 근거'), true, 'a record row ID');
});

test('V13C-3 the app\'s own words at 쉽게: plainer lens and legend names, counts behind the legend chip, a part\'s mark, no leaning phrase', () => {
  assert.equal(W.EASY_LENS.start, '시작과 반복');
  assert.equal(W.EASY_LENS.state, '상태와 모름');
  assert.equal(W.easyLegendChip('compose', ['참여자', '처리', '저장']), '역할 · 참여자 · 처리 ···');
  assert.equal(W.easyLegendChip('start', ['제어 선', '촉발·관문']), '시작과 반복 · 제어 선 · 시작 신호와 관문');
  assert.equal(W.easyKind('구성 · 안쪽 6'), '구성');
  assert.equal(W.easyKind('사람 · 실행 위치 · 안쪽 2'), '사람 · 실행 위치');
  assert.equal(W.partMark('person'), '사람');
  assert.equal(W.partMark('external'), '외부 시스템');
  assert.equal(W.partMark('store'), null);
  assert.equal(W.leansBack('따른 반죽 순서를 정한다.'), true);
  assert.equal(W.leansBack('반죽 순서를 정한다.'), false);
});

test('V13C-4 the switch: in the header beside the reading modes, one class on the space, the labels and tags placed again for it', async () => {
  const h = await html(), a = await app(), c = await css();
  assert.match(h, /<div id="modebar"[^>]*>\s*<div class="words-seg" role="radiogroup"[^>]*><button type="button" role="radio" data-words="easy" aria-checked="true">쉽게<\/button><button type="button" role="radio" data-words="detail" aria-checked="false">자세히<\/button><\/div>/);
  assert.doesNotMatch(h.slice(h.indexOf('class="controls"'), h.indexOf('class="controls"') + 4000), /words-seg/, 'not in the map\'s tool bar (it took the bar\'s room at 1280)');
  const sync = fn(a, 'syncWords'), set = fn(a, 'setWords');
  assert.match(sync, /classList\.toggle\('words-easy', easy\(\)\)/);
  assert.match(sync, /EASY_LENS\[b\.dataset\.lens \?\? ''\]/);
  assert.match(set, /writeWords\(kv, w\)/);
  assert.match(set, /renderLegend\(\); renderSpace\('keep'\);/);
  assert.match(a, /let words: WordLevel = readWords\(kv\);/);
  assert.match(c, /\.words-seg button\.on \{/);
});

test('V13C-5 쉽게 on the map: tags say the role (a person or an outside system marked), labels plain words, counts and port marks behind cues', async () => {
  const a = await app(), c = await css();
  const tag = fn(a, 'fitTagKind');
  assert.match(tag, /const ez = easy\(\), mark = ez \? kd\.dataset\.pmark \?\? '' : '', role = ez \? kd\.dataset\.role \?\? '' : ''/);
  assert.match(tag, /\[role, \.\.\.rolePhrases\(role\)\.filter\(x => !leansBack\(x\)\)\]\.filter\(x => !hasCode\(x\)\)\.find\(x => n\(x\) > 0\)/);
  assert.match(a, /'data-role': t\.role \?\? '', 'data-pmark': partMark\(r\.typeRead\?\.type\) \?\? ''/);
  assert.match(fn(a, 'placeFitLabels'), /const easyFull = easy\(\) \? plainLabel\(full\) : full;/);
  assert.match(fn(a, 'placeRestLabels'), /word = easy\(\) \? plainLabel\(word0\) \?\? '' : word0/);
  assert.match(fn(a, 'countOf'), /if \(easy\(\)\) return '';/);
  assert.match(fn(a, 'renderLegend'), /easy\(\) \? easyLegendChip\(viewLens, legendNow\.map\(i => i\.label\)\) : legendChip\(viewLens, legendNow\)/);
  for (const rule of ['.space.words-easy .node.card .c-kind-word', '.space.words-easy .node.card .c-contract.pins', '.space.words-easy .edge-labels > .edge-count::after', '.space.words-easy .edge-cue.q-stack .cue-n', '.space.words-easy #focus-top .ft-count', '.space.words-easy #focus-top .ft-basis.code .ft-basis-t'])
    assert.ok(c.includes(rule), rule);
  // 자세히 is the v12 map: every 쉽게 rule is under .words-easy, and the mark shows only there.
  assert.match(c, /\.c-pmark \{ display: none; \}/);
});

test('V13C-6 a mark\'s further places: every 3px of its own line short of its head, then just beside it, nearer first', () => {
  const at = d => ({ x: d, y: 0 }), inv = 2, s = 8 * inv;
  const { along, beside } = M.cueSpots(at, 100, inv, s, s);
  assert.equal(along[0].x + s / 2, 6 * inv);
  assert.equal(along[1].x - along[0].x, 3 * inv);
  assert.ok(along.at(-1).x + s / 2 <= 100 - M.CUE_HEAD_RUN * inv + 1e-9, 'never onto its head\'s run');
  assert.ok(beside.length > 0);
  const off = beside.map(r => Math.abs(r.y + s / 2));
  assert.equal(Math.min(...off), M.CUE_BESIDE[0] * inv);
  assert.ok(off[0] <= off.at(-1), 'the nearer offsets first');
});

test('V13C-7 a ◇\'s target is its whole drawn box; a mark that grows into 「조건 n」 over a card moves along its own line', async () => {
  const a = await app(), cue = fn(a, 'placeCue');
  assert.match(cue, /hitOf = \(r: Rect\): Rect => \(\{ x: r\.x - rim, y: r\.y \+ s \/ 2 - half, w: r\.w \+ 2 \* rim, h: 2 \* half \}\)/, 'v12 took a 24px square round the ◇ whatever the mark\'s width');
  assert.match(cue, /w: Math\.max\(s, c\.offsetWidth \* inv\)/);
  assert.match(cue, /const exOf = \(\) => \(exOnce \?\?= cueExtra\(path, s, ow, inv, len\)\);/); // v13 merge: walked once, only when needed
  assert.match(cue, /if \(!spot\) \{ const ex = exOf\(\);/);
  assert.match(cue, /if \(parts\.some\(o => touch\(hitOf\(sr\), o\)\)\) \{/);
  assert.match(cue, /same\.classList\.add\('stack-fold'\); tightCue\(same, s, parts\);/, 'no place: its 「조건 n」 folds rather than lie on a card');
  assert.match(cue, /box\.append\(el\); set\(el, spot\); tightCue\(el, s, parts\);/);
  assert.match(fn(a, 'tightCue'), /el\.style\.setProperty\('--hit', /, 'a target only as wide as the room round the mark');
  assert.match(await css(), /\.edge-labels > \.edge-cue\[data-tight\]::after \{ inset: var\(--hit, -8px\) !important; \}/);
});

test('V13C-8 a crowded side gives an opposite pair its gap: the others close toward 6.5 and the run reaches the corners first', () => {
  // Six ends a pitch apart on an 80-high side; the pair (ends 2 and 3) must stand 30 apart. v12 scaled the pair down to what the side had
  // left (16); now the other gaps close and the pair keeps its 30.
  const gaps = [0, 12, 12, 12, 12, 12], need = [0, 12, 12, 30, 12, 12];
  const fin = R.pairSpread(gaps, need, 80, 8);
  assert.equal(fin[3], 30);
  assert.ok(fin.reduce((x, y) => x + y, 0) <= 80 - 2 * R.PAIR_INSET + 1e-9);
  assert.ok(fin.every((g, i) => !i || g >= R.PAIR_SQUEEZE - 1e-9), 'never two on one point');
  // Room enough: as before (the others keep their pitch).
  assert.deepEqual(R.pairSpread([0, 12, 12], [0, 26, 12], 104, 8), [0, 26, 12]);
  assert.equal(R.pairSpread([0, 12], [0, 12], 80, 8), null);
});

test('V13C-9 comparing, the compare line and the tools stand in a footer under the map; the whole map stays whole; no pan loses a card', async () => {
  const a = await app(), c = await css();
  const foot = fn(a, 'syncCmpFooter');
  assert.match(foot, /\['#space > \.controls', '#growth-line', '#growth-past'\]/);
  assert.match(foot, /\$\('viewport'\)\.style\.bottom = `\$\{foot\}px`;/);
  assert.match(a, /const mapBottomInset = \(\) => cmpFoot \? 16 : BOTTOM/);
  assert.match(fn(a, 'syncMapArea'), /vp\.style\.bottom = `\$\{cmpFoot\}px`;/, 'v12 set the bottom to 0 on every sync');
  assert.match(fn(a, 'growthCompare'), /const whole = !growthCmp && !growthPast && wholeInView\(\);/);
  assert.match(fn(a, 'growthCompare'), /\} finally \{ cmpWholeFit\(whole\); say\.f\?\.\(\); \}/);
  const fit = fn(a, 'cmpWholeFit');
  assert.match(fit, /guideInPane = true; guide\.hidden = true;/, 'the guide goes to the pane before the zoom changes');
  assert.match(fit, /if \(\$\('world'\)\.querySelectorAll\('\.node\.tag-cut'\)\.length <= cut0\) return;/, 'a smaller zoom never cuts a name');
  assert.match(fn(a, 'growthClearGuide'), /const lose = !!d && cmpFoot > 0 && lostBy\(cards, view, growthBands\(fr\), d\[0\], d\[1\]\) > 0;/);
  assert.match(c, /\.space\.cmp-foot > \.viewport \{ -webkit-mask-image: linear-gradient\(to bottom, #000 calc\(100% - 12px\), transparent\)/, 'the fade that let the map pass under the tools would hide the bottom row');
  // lostBy: a card that reads whole and clear of the bands now, and would not after the move.
  const view = { x: 0, y: 0, w: 400, h: 300 }, bands = [{ x: 0, y: 260, w: 400, h: 40 }], cards = [{ x: 10, y: 200, w: 100, h: 40 }, { x: 200, y: 10, w: 100, h: 40 }];
  assert.equal(G.lostBy(cards, view, bands, 0, 30), 1);
  assert.equal(G.lostBy(cards, view, bands, 0, -10), 0);
});
