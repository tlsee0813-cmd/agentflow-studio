// v11 text (ruling F8 Q2, Q5): the top box says the record's summary sentence whole in up to three lines (or another whole sentence of it,
// said to be part of it, or nothing, folded to 「요약 전문 보기」), with the way to the whole summary always in the box; a card's role takes one
// or two lines decided before the layout, broken between words only, else a phrase of it that reads on its own, else 「역할 전문 보기」; two
// heads of one kind say what the record says of each set. Each test fails on v10. Fictional strings only.
// No browser: the pure parts run as built; the DOM code that uses them is read from the source (the pages were checked headless apart).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as ff from '../dist/public/client/first-flow.js';
import * as face from '../dist/public/client/card-face.js';
import * as fam from '../dist/public/client/card-family.js';
import * as regions from '../dist/public/client/map-regions.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));
/** One unit per character: a line of width w holds w characters (spaces included). */
const chars = s => [...s].length;

test('V11-1 a summary source gives every sentence of its summary, in order', () => {
  const s = ff.summarySource([{ id: 'r1', target: null, body: [{ text: '도구는 상자를 받아 목록으로 정리한다(F01). 핵심 흐름은 입력 → 정리 → 출력이다(F02).', from: 0 }] }]);
  assert.ok(s, 'a source');
  assert.deepEqual(s.sentences.map(ff.shownSentence), ['도구는 상자를 받아 목록으로 정리한다.', '핵심 흐름은 입력 → 정리 → 출력이다.']);
});

test('V11-2 a clause that runs on never ends a sentence: 「…조사하고」, 「…엔진이며…」 are not whole', () => {
  assert.equal(ff.endsWhole('도구는 질문을 받아 문서를 조사하고'), false);
  assert.equal(ff.endsWhole('도구는 파일에 상태를 두는 엔진이며…'), false);
  assert.equal(ff.endsWhole('도구는 파일에 상태를 두는 엔진이며...'), false);
  assert.equal(ff.endsWhole('도구는 상자를 정리한다.'), true);
  assert.equal(ff.endsWhole('도구는 상자를 정리한다'), true);
  assert.equal(ff.endsWhole('도구는 상자를 정리한다(예: 큰 상자).'), true);
});

test('V11-3 the first sentence whole when it fits the box (three lines), whatever its length', () => {
  const first = '도구는 사용자가 준 상자를 여러 번 열어 무게와 크기를 재고 통계를 보여 주는 도구이며, 결과는 표로 내보낼 수 있다.';
  const it = ff.topIntro([first, '핵심 흐름은 입력 → 출력이다.'], t => chars(t) <= 3 * 40);
  assert.deepEqual(it, { kind: 'whole', text: first, index: 0 });
});

test('V11-4 a first sentence the box does not hold: a later whole sentence that stands alone, said to be part of the summary', () => {
  const first = '가'.repeat(200) + '다.';
  const it = ff.topIntro([first, '그리고 상자를 정리한다.', '핵심 흐름은 입력 → 출력이다.'], t => chars(t) <= 120);
  assert.equal(it.kind, 'part');
  assert.equal(it.text, '핵심 흐름은 입력 → 출력이다.', 'a sentence leaning on the one before it (「그리고 …」) is passed over');
  assert.equal(ff.INTRO_PART, '요약 일부 · 전문 보기');
});

test('V11-5 only a clause that runs on left: nothing is shown as the introduction (folded, a miss), never a finished or cut clause', () => {
  const first = '가'.repeat(200) + '다.';
  const it = ff.topIntro([first, '도구는 질문을 받아 문서를 조사하고'], t => chars(t) <= 120);
  assert.deepEqual(it, { kind: 'fold', text: null, index: -1 });
  assert.equal(ff.INTRO_FULL, '요약 전문 보기');
  // A first sentence that is itself a clause running on is never the introduction either, even when it fits.
  assert.equal(ff.topIntro(['도구는 문서를 조사하고'], () => true).kind, 'fold');
});

test('V11-6 the top box: the sentence chosen whole for its width (no clause cut, no one-line form, no narrower caps), at most 120px and three lines', async () => {
  const a = await app();
  assert.match(a, /const FT_MAX_H = 120, FT_LINES = 3;/);
  const intro = fn(a, 'ftIntro');
  assert.match(intro, /sent\.offsetHeight <= lh \* FT_LINES \+ 1 && el\.offsetHeight <= FT_MAX_H/);
  assert.match(intro, /topIntro\(ftSaid, fits\)/);
  assert.match(intro, /it\.kind === 'part' \? INTRO_PART : INTRO_FULL/);
  const sync = fn(a, 'syncFocusTop');
  assert.ok(!/keepPlanFit\(t, t\.dataset\.text/.test(sync), 'the sentence is never cut by the plan-word cut');
  assert.ok(sync.indexOf('ftIntro(el, sent)') < sync.indexOf('placeFocusTop(el)'), 'chosen before the box is placed, and again at its place');
  const place = fn(a, 'placeFocusTop');
  assert.ok(!place.includes("'ft-one'") && !place.includes('FT_CAPS'), 'never one line, never narrower');
  assert.ok(!a.includes('FT_CAPS_TWO') && !a.includes("ftBox('ft-one'"));
  assert.match(a, /const FT_SAID = \[null\] as const;/);
});

test('V11-7 the way to the whole summary is always in the box, a button (click and keyboard) that opens every sentence of it', async () => {
  const a = await app(), top = fn(a, 'renderFocusTop');
  assert.match(top, /h\('button', \{ type: 'button', class: 'ft-b ft-full-open', 'aria-expanded': String\(ftFullOpen\), 'aria-controls': 'ft-full'/);
  assert.match(top, /if \(full\) \{ if \(row\) row\.append\(full\); else row = h\('div', \{ class: 'ft-switch ft-ctl' \}, full\); \}/, 'on the control line, beside the switcher or alone');
  assert.match(top, /\.\.\.ftSaid\.flatMap\(x => \(x \? \[h\('p', \{ class: 'ft-full-s' \}, x\)\] : \[\]\)\)/, 'the panel holds every sentence');
  assert.match(top, /\(e as KeyboardEvent\)\.key === 'Escape'/, 'Escape closes it');
  const c = await css();
  assert.match(c, /\.focus-top \.ft-sentence \{[^}]*font-size: 14px; line-height: 22px;[^}]*display: block;/);
  assert.ok(!/\.focus-top \.ft-sentence \{[^}]*-webkit-line-clamp/.test(c), 'no clamp cuts the sentence');
  assert.match(c, /\.focus-top:not\(\.growth-guide\) \{ gap: 2px; padding: 5px 14px 5px; \}/);
});

test('V11-8 a role breaks between words only: a word wider than a line is no fit', () => {
  assert.deepEqual(face.wrapWords('상자를 받아 목록으로 정리한다', 10, chars), ['상자를 받아', '목록으로 정리한다']);
  assert.equal(face.wrapWords('아주긴식별자이름이하나', 6, chars), null);
});

test('V11-9 one line, else two (the card 104), else a phrase that keeps object and action, else 「역할 전문 보기」', () => {
  assert.deepEqual(face.roleFit('상자를 정리한다.', 20, 2, chars), { text: '상자를 정리한다.', lines: 1, kind: 'whole' });
  assert.deepEqual(face.roleFit('상자를 받아 목록으로 정리한다.', 12, 2, chars), { text: '상자를 받아 목록으로 정리한다.', lines: 2, kind: 'whole' });
  // A closing clause with its object and action, from the same words (never an ending changed, never a word added).
  const long = '입력 묶음과 설정 값을 받아 규칙을 확인하고 정리된 목록 파일을 만든다.';
  const r = face.roleFit(long, 12, 2, chars);
  assert.equal(r.kind, 'phrase'); assert.equal(r.text, '정리된 목록 파일을 만든다.'); assert.ok(long.endsWith(r.text));
  // A clause that only denies, doubts or adds is no role phrase; a plan or condition in the dropped words keeps the phrase out.
  assert.equal(face.roleFit('입력 묶음과 설정 값을 받아 규칙을 확인하고 흐름을 멈추지 않는다.', 12, 2, chars).kind, 'fold');
  assert.equal(face.roleFit('설정이 있으면 입력 묶음과 설정 값을 받고 정리된 목록 파일을 만든다.', 12, 2, chars).kind, 'fold');
  assert.equal(face.roleFit('나중에 바꿀 예정이며 입력 묶음과 설정 값을 받고 정리된 목록 파일을 만든다.', 12, 2, chars).text, face.ROLE_MORE);
  assert.equal(face.ROLE_MORE, '역할 전문 보기');
});

test('V11-10 a role word too long for its line: its closing run with the object and the action, never a cut word or a broken list', () => {
  assert.deepEqual(face.rolePhrases('큰 상자 목록 생성'), ['상자 목록 생성', '목록 생성']);
  assert.deepEqual(face.rolePhrases('A·B 요청 분배'), ['요청 분배'], 'the list stays whole or is dropped whole');
  assert.deepEqual(face.rolePhrases('규칙·필터를 식으로'), [], 'nothing reads on its own: no phrase');
  assert.deepEqual(face.rolePhrases('묶음 사이 변경 신호'), [], 'never a run that starts on a word that only relates, nor one with no action');
  assert.deepEqual(face.rolePhrases('빌드·시험 검사와 이슈 정리'), ['검사와 이슈 정리'], 'never the half after 와 alone (「이슈 정리」)');
  assert.equal(face.roleFit('규칙·필터를 식으로', 6, 1, chars).kind, 'fold');
  assert.deepEqual(face.roleFit('큰 상자 목록 생성', 8, 1, chars), { text: '상자 목록 생성', lines: 1, kind: 'phrase' });
});

test('V11-11 the card height follows the role lines decided before layout: 80, 104, 128 (two name lines and two role lines)', () => {
  const t = fam.cardTemplate({ type: 'process', family: null, config: [], inputs: [], outputs: [], fields: [], loop: null, steps: [], conditions: [], role: '상자를 정리한다.' });
  assert.equal(fam.cardHeights({ ...t, roleFit: { text: t.role, lines: 1, kind: 'whole' } }, 1).total, 80);
  assert.equal(fam.cardHeights({ ...t, roleFit: { text: t.role, lines: 2, kind: 'whole' } }, 1).total, 104);
  assert.equal(fam.cardHeights({ ...t, roleFit: { text: t.role, lines: 1, kind: 'whole' } }, 2).total, 104);
  assert.equal(fam.cardHeights({ ...t, roleFit: { text: t.role, lines: 2, kind: 'whole' } }, 2).total, fam.CARD_H_TALLER);
  assert.equal(fam.CARD_H_TALLER, 128);
});

test('V11-12 the card draws its role as measured, the overview tag never cuts its second line inside a word', async () => {
  const a = await app();
  assert.match(a, /const t = withRoleFit\(cardTemplate\(cardFactsOf\(o, p, r, said\)\)\); tpls\?\.set\(id, t\);/, 'measured once, before layout');
  assert.match(a, /roleFit\(t\.role, ROLE_BODY, ROLE_LINES, roleMeasure\)/);
  assert.match(fn(a, 'fitTagKind'), /for \(const p of rolePhrases\(kind\)\)/);
  // Fitted again for the zoom the fit settles on (a line fitted 2% larger ran past its box at 1280): within 0.5%.
  assert.match(fn(a, 'fitCards'), /Math\.abs\(k - tagAt\.k\) \/ Math\.max\(tagAt\.k, 0\.01\) < 0\.005 &&/);
  assert.match(a, /kd\.classList\.toggle\('tk-empty', !shown && !pre\)/, 'no empty second line');
  assert.match(a, /const tagKindW = \(s: string\) => tagMeasure\(s, TAG\.kind, 520\) \* 1\.03 \+ 1;/, 'measured with the margin the scaled type needs');
  assert.match(a, /h\('button', \{ type: 'button', class: 'c-role-text c-role-more'/, 'the way to the whole role is a button');
  const c = await css();
  assert.match(c, /\.space \.node\.card \.c-role\.two \{ height: 36px; \}/);
  assert.match(c, /\.space \.node\.card \.c-role:not\(\.revised\) \{ white-space: normal; word-break: keep-all; overflow-wrap: normal; text-overflow: clip; \}/);
  assert.match(c, /\.c-tag-kind\.tk2 \{[^}]*-webkit-line-clamp: 2;[^}]*word-break: keep-all;/);
});

test('V11-13 two heads of one kind: each says the recorded group that holds its set (the kind small), never a made-up word', () => {
  const recorded = [{ name: '화면 사용자 역할', axis: 'participants', members: ['a', 'b', 'c'] }, { name: '저장소 사람', axis: 'participants', members: ['d', 'e'] }];
  const r = regions.kindHeads([['a', 'b'], ['d', 'e']], recorded, '참여자', id => id);
  assert.deepEqual(r.heads, [{ text: '화면 사용자 역할', small: '참여자', how: 'named' }, { text: '저장소 사람', small: '참여자', how: 'named' }]);
  assert.equal(r.legend, false);
});

test('V11-14 a recorded place, a recorded set with no name, or nothing recorded: 「참여자 · place」, 「구성원: names」, the kind once in the legend', () => {
  const place = regions.kindHeads([['a'], ['d']], [{ name: '브라우저', axis: 'place', members: ['a'] }, { name: '서버', axis: 'place', members: ['d'] }], '참여자', id => id);
  assert.deepEqual(place.heads.map(x => x.text), ['참여자 · 브라우저', '참여자 · 서버']);
  const members = regions.kindHeads([['a', 'b'], ['d']], [{ name: 'B07', axis: 'participants', members: ['a', 'b'] }], '참여자', id => id.toUpperCase());
  assert.deepEqual(members.heads[0], { text: '참여자', small: '구성원: A, B', how: 'members' });
  assert.deepEqual(members.heads[1], { text: '참여자', small: null, how: 'plain' });
  const none = regions.kindHeads([['a', 'b'], ['d', 'e']], [], '참여자', id => id);
  assert.deepEqual(none, { heads: [null, null], legend: true }, 'split by the layout only: no head repeats on the map');
  assert.deepEqual(regions.kindHeads([['a', 'b']], [], '참여자', id => id).heads, [{ text: '참여자', small: null, how: 'plain' }], 'one head stays as it was');
});

test('V11-15 the map reads the record\'s groups with a label parent and places those heads', async () => {
  const a = await app();
  assert.match(fn(a, 'recordedSets'), /readRecordTables\(text\)\.byId\.get\('C-GROUP'\)/);
  assert.match(a, /const o = opened, kh = kindHeads\(sets\.map\(ps => ps\.map\(b => b\.id\)\), o \? recordedSets\(o\) : \[\], OUTSIDE_TITLE/);
  assert.match(a, /kindKey\(kh\.legend \? OUTSIDE_TITLE : null\);/);
});
