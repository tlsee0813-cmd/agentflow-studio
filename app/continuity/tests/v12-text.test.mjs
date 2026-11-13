// v12 text (the blind judges' round after v11: roles folded where words fit, a control line wrapped, a button that named a hidden part, kind
// lines cut at the card zoom, a head over a card its group does not list). A card's role reads whole or as a phrase of its own words far
// more often; the overview tag and the card's kind line say whole units or nothing, never 「역할 전문 보기」 in place of words; the control
// line stays on one line, cut between units; the basis line gives way before the summary sentence; the summary button names what the box
// shows; a kind head reaches its recorded members only. Each test fails on v11. Fictional strings only.
// No browser: the pure parts run as built; the DOM code that uses them is read from the source (the pages were checked headless apart).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as face from '../dist/public/client/card-face.js';
import * as fam from '../dist/public/client/card-family.js';
import * as ff from '../dist/public/client/first-flow.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));
const chars = s => [...s].length;

test('V12-1 a role sentence: a closing run after a link or an adverbial word, with its target and action, the same words in order', () => {
  // After 「…받아」 (a link) and after 「…화면에서」 (an adverbial word: 화면 is no condition).
  const s = '고객 화면에서 사용자 조작을 받아 주문 요청을 보낸다.';
  assert.deepEqual(face.rolePhrases(s), ['사용자 조작을 받아 주문 요청을 보낸다.', '주문 요청을 보낸다.']);
  assert.deepEqual(face.roleFit(s, 12, 2, chars), { text: '사용자 조작을 받아 주문 요청을 보낸다.', lines: 2, kind: 'phrase' });
  // A copula's own target (「…쿠키다」, 「…대상이다」) and a 「등」 that closes a list of examples.
  assert.ok(face.rolePhrases('장부 또는 상자에 있으며 정리 단계가 읽는 쿠키다.').includes('정리 단계가 읽는 쿠키다.'));
  assert.ok(face.rolePhrases('반죽과 소금 등 재료 파일을 실행 사이에 보관한다.').includes('재료 파일을 실행 사이에 보관한다.'));
  // Nouns that only end like a link or an adverb are no cut (「경고」, 「경로」): no phrase starts after them.
  assert.ok(!face.rolePhrases('보고서 경로 파일을 정리 단계에 넘긴다.').includes('파일을 정리 단계에 넘긴다.'));
});

test('V12-2 a phrase never leans on the dropped words, never drops a condition, a guess or one side of a list', () => {
  const ph = t => face.rolePhrases(t);
  // A first word that is a verb whose object was dropped (「바꾸고 …」) or an active modifier (「실행하는 …」).
  assert.ok(!ph('원문을 토큰으로 바꾸고 목록 파일을 만든다.').includes('바꾸고 목록 파일을 만든다.'));
  assert.ok(ph('원문을 토큰으로 바꾸고 목록 파일을 만든다.').includes('목록 파일을 만든다.'));
  assert.deepEqual(ph('사용자가 준 상자를 작업대로 실행하는 측정 대상이다.'), []);
  // A condition in the dropped words (「사용 시」, 「…있으면」, 「…때」), a doubt, a later clause that adds (「…도」), a comma in the run.
  assert.deepEqual(ph('상자 사용 시 예시 등 상자 메시지를 받는 외부 시스템이다.'), []);
  assert.deepEqual(ph('관리하고 상자가 켜지고 설정이 있으면 설정을 넘기며 아니면 빈 값을 넘긴다.').filter(x => x.startsWith('설정이 있으면')), []);
  assert.deepEqual(ph('상자를 읽고 결과를 반환하며 구 경로도 처리한다.').filter(x => x.includes('경로도')), []);
  assert.deepEqual(ph('상자 PR을 매월 최대 2개, 묶음 PR을 매일 연다.').filter(x => x.includes(',')), []);
  // A later clause keeps its words whole (a negation stays with it).
  assert.ok(ph('상자를 받아 목록을 만들고 흐름을 멈추지 않는다.').includes('목록을 만들고 흐름을 멈추지 않는다.'));
});

test('V12-3 a kind line too narrow: whole, a phrase, its leading units, the family word, else nothing: never 「역할 전문 보기」', () => {
  const fits = n => s => chars(s) <= n;
  assert.deepEqual(face.kindShort('상자 목록 생성', '처리', fits(20)), { text: '상자 목록 생성', how: 'whole' });
  assert.deepEqual(face.kindShort('큰 상자 목록 생성', '처리', fits(8)), { text: '상자 목록 생성', how: 'phrase' });
  assert.deepEqual(face.kindShort('사람 · 실행 위치 · 안쪽 2', null, fits(10)), { text: '사람 · 실행 위치', how: 'kind' });
  assert.deepEqual(face.kindShort('규칙·필터를 식으로', '처리', fits(4)), { text: '처리', how: 'kind' });
  assert.deepEqual(face.kindShort('규칙·필터를 식으로', null, fits(4)), { text: '', how: 'none' });
  for (const n of [1, 3, 6, 9]) assert.notEqual(face.kindShort('형식별 직렬화·파일 쓰기', '처리', fits(n)).text, face.ROLE_MORE);
});

test('V12-4 the record family word rides on a card whose kind line says the record\'s role word (and only there)', () => {
  const facts = { type: null, config: [], inputs: [], outputs: [], fields: [], loop: null, steps: [], conditions: [], role: '상자를 정리한다.' };
  assert.equal(fam.cardTemplate({ ...facts, family: { family: 'process', role: '상자 목록 생성', reason: null, unclear: false } }).familyWord, '처리');
  assert.equal(fam.cardTemplate({ ...facts, family: { family: 'store', role: '상자 보관', reason: null, unclear: false } }).familyWord, '저장');
  assert.equal(fam.cardTemplate({ ...facts, type: 'process', family: { family: 'process', role: '상자 목록 생성', reason: null, unclear: false } }).familyWord, null);
  assert.equal(fam.cardTemplate({ ...facts, family: null }).familyWord, null);
});

test('V12-5 the overview tag and the card\'s kind line fit by whole units (kindShort), a duplicated 미정 word said once', async () => {
  const a = await app();
  const tag = fn(a, 'fitTagKind');
  assert.match(tag, /kindShort\(kind, kd\.dataset\.fam \|\| null,/);
  assert.match(tag, /const kind = ez \? easyKind\(kd\.dataset\.kind\) : kd\.dataset\.kind/, 'v13 C: 자세히 keeps the v12 kind line');
  assert.doesNotMatch(tag, /ROLE_MORE/, 'the tag never says 「역할 전문 보기」 in place of words');
  assert.match(a, /'data-kind': t\.kind, 'data-fam': t\.familyWord \?\? '', 'data-role'/);
  const kl = fn(a, 'fitKindLines');
  assert.match(kl, /if \(to\) \{ to\.classList\.add\('kw-off'\); if \(!over\(\)\) continue; \}/, 'the successor gives way first, whole');
  assert.match(kl, /kindShort\(whole, word\.dataset\.fam \|\| null,/);
  assert.match(kl, /word\.dataset\.tip = `종류 · \$\{whole\}`/, 'a shortened kind word keeps its whole in its tip');
  assert.match(fn(a, 'fitCards'), /if \(face === 'card'\) fitKindLines\(\);/);
  assert.match(a, /h\('span', \{ class: 'c-kind' \}, partMark\(r\.typeRead\?\.type\) \? h\('span', \{ class: 'c-pmark' \}, partMark\(r\.typeRead\?\.type\)\) : null, t\.undecided && t\.kind === t\.undecided \? null :/);
  assert.match(a, /'data-tip': `유지 방침\$\{maint\.includes\(' → '\) \? ` · 후속 /, 'the policy chip\'s tip keeps the successor');
  assert.match(await css(), /\.node\.card \.c-kind \.kw-off \{ display: none; \}/);
});

test('V12-6 the switcher\'s forms for a one-line control line: cut between names, the basis and the view number kept, then the subject', () => {
  const P = (id, name, x = {}) => ({ id, name, ref: null, entries: [], states: [], entryRows: [], ...x });
  const parts = [P('a', '주문 창구'), P('b', '반죽 배합기'), P('c', '오븐 굽기 단계'), P('d', '판매 장부')];
  const lines = [{ id: 'l1', from: 'a', to: 'b', channel: 'data', payload: null, when: null }, { id: 'l2', from: 'b', to: 'c', channel: 'data', payload: null, when: null }, { id: 'l3', from: 'c', to: 'd', channel: 'data', payload: null, when: null }];
  const f = ff.firstFlow({ parts, lines, loops: [], scenarios: [], summaryFlow: '주문 창구 → 반죽 배합기 → 오븐 굽기 단계 → 판매 장부', headLines: [], kept: null });
  const name = id => parts.find(p => p.id === id)?.name ?? id;
  const forms = ff.switcherForms(f, name);
  assert.equal(forms[0], ff.switcherText(f, name));
  assert.deepEqual(forms.slice(1), [
    '먼저 볼 연결: 주문 창구 → 반죽 배합기 → 오븐 굽기 단계 → … · 기록이 설명한 흐름',
    '먼저 볼 연결: 주문 창구 → 반죽 배합기 → … · 기록이 설명한 흐름',
    '먼저 볼 연결: 주문 창구 → … · 기록이 설명한 흐름',
    '먼저 볼 연결: 주문 창구 → 반죽 배합기 → 오븐 굽기 단계 → 판매 장부',
    '먼저 볼 연결 · 기록이 설명한 흐름']);
  for (const x of forms) assert.doesNotMatch(x, /^·|·$|\s·\s*$/, 'no form starts or ends on a separator');
});

test('V12-7 the control line stays on one line; the basis line gives way before the sentence and stays in the summary panel', async () => {
  const a = await app(), c = await css();
  assert.match(a, /'data-forms': JSON\.stringify\(switcherForms\(f, name\)\)/);
  const sw = fn(a, 'fitSwitch');
  assert.match(sw, /for \(const t of forms\) \{ nm\.textContent = t; if \(one\(\)\) break; \}/);
  assert.match(sw, /d\.classList\.add\('ft-dot-off'\)/, 'still two lines: no line starts or ends on a separator');
  assert.match(c, /\.focus-top \.ft-dot\.ft-dot-off \{ display: none; \}/);
  assert.match(a, /const FT_FORMS = \['ft-nobasis', 'ft-under'\];/);
  assert.match(a, /const FT_SAID = \[null, 'ft-nobasis'\] as const;/, 'the fit tries the sentence without its basis line before stepping it back');
  assert.match(fn(a, 'placeFocusTop'), /el\.classList\.add\('ft-nobasis'\); ftPlace\(el, camera, ink\); if \(!covers\(\)\) return;[\s\S]*?el\.classList\.add\('ft-under'\)/);
  assert.match(c, /\.focus-top:is\(\.ft-nobasis, \.ft-under\) \.ft-basis \{ display: none; \}/, 'never a stepped-back sentence under a basis line that stays');
  assert.match(a, /\.\.\.\(ftBasisSaid \? \[h\('p', \{ class: 'ft-full-head ft-full-basis' \}/, 'the basis line\'s words in the summary panel');
});

test('V12-8 the way to the whole summary says what the box shows: 「요약 일부 · 전문 보기」 only beside a shown part', async () => {
  const a = await app(), b = fn(a, 'ftButtonWords');
  assert.match(b, /const shown = !!sent && !sent\.hidden && !el\.classList\.contains\('ft-under'\) && !!sent\.textContent;/);
  assert.match(b, /b\.textContent = shown && sent!\.dataset\.kind === 'part' \? INTRO_PART : INTRO_FULL;/);
  assert.match(fn(a, 'syncFocusTop'), /ftButtonWords\(el\);/);
  assert.match(fn(a, 'placeFocusTop'), /el\.classList\.add\('ft-under'\); ftPlace\(el, camera, ink\); ftButtonWords\(el\);/);
});

test('V12-9 a kind head reaches its recorded members only: a card after them in the column reads outside the group', async () => {
  const a = await app(), c = await css();
  assert.match(a, /const after = \[\.\.\.lay\.boxes\.values\(\)\]\.some\(b => !mine\.has\(b\.id\) && b\.kind !== 'ghost' && Math\.abs\(b\.x - x0\) < 4 && b\.y > last\.y && b\.y < nextHead\);/);
  assert.match(a, /if \(after\) world\.append\(h\('div', \{ class: 'band-reach'/);
  assert.match(a, /world\.querySelectorAll\('\.band-head, \.band-line, \.band-reach'\)\.forEach\(x => x\.remove\(\)\);/);
  assert.match(c, /\.band-reach \{ position: absolute;[^}]*border-left:[^}]*border-bottom:/);
});
