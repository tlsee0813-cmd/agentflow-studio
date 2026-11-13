// Polish 6: the review of polish 5 (code labels, cut marks, the top sentence's record order). Each test failed on polish 5.
// Fictional records only. No browser: the label code is read from the source, the cut and the order run as built.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tokenCut, labelParts } from '../dist/public/client/line-grammar.js';
import { byTarget, summarySource } from '../dist/public/client/first-flow.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = async () => (await readFile(new URL('../public/styles.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const fillLabelSrc = a => a.slice(a.indexOf('function fillLabel('), a.indexOf('\n}\n', a.indexOf('function fillLabel(')));

test('P6-1 a code label counts its words at spaces (not at the letter s) and, fitting in no cut, goes to its line\'s hover', async () => {
  const a = await app(), f = fillLabelSrc(a);
  assert.match(f, /for \(let n = cutCount\(text\) - 1; n >= 1; n--\)/, 'polish 7: cuts counted in units (whitespace, a list\'s 「·」, a code run whole)');
  assert.doesNotMatch(f, /split\(\/s\+\/\)/, 'never at the letter s (「len(files) == 0 이면 건너뜀」 counted 2 words, 「REDIS_URL 있을 때」 1)');
  assert.match(f, /function fillLabel\(el: HTMLElement, text: string, full = text\): boolean \{/);
  assert.match(f, /return done\(false\);\n?$/, 'no cut fits (one word, or the first word already too wide): false, never left clipped');
  // Every caller that places a label leaves one that fits in no cut to its line's hover.
  assert.ok(a.includes('box.append(label); if (!fillLabel(label, cutWord, word)) { label.remove(); hidden.push(g); continue; }'), 'a rest label: removed, counted hidden');
  assert.ok(a.includes("!c.endsWith('…') ? '…' : ''}`; if (!fillLabel(el, text)) return;"), 'a fit label: that form gets no place');
  assert.ok(a.includes('filled = fillLabel(el, text); if (!filled) continue;') && a.includes('if (!spot && filled) {'), 'a badge: that form skipped, never forced clipped');
  assert.ok(a.includes('fits = fillLabel(label, text); if (!fits) return null;'), 'a selection\'s label: no place');
});

test('P6-2 one cut mark only, and never a cut that keeps only a lead (「기동 ·」) or a fragment', async () => {
  // polish 5: 「기동 ·…」 and 「원시…」 (then a second 「…」 from the [data-full] rule).
  assert.equal(tokenCut('기동 · bind된 Axios.prototype.request…', 1), null, 'the lead alone says nothing: hidden');
  assert.equal(tokenCut('기동 · bind된 Axios.prototype.request…', 2), '기동 · bind된…');
  assert.equal(tokenCut('원시 인자 → get_cli_arguments', 1), null);
  assert.equal(tokenCut('원시 인자 → get_cli_arguments', 3), '원시 인자…', 'no arrow left pointing at what was cut');
  assert.equal(tokenCut('len(files) == 0 이면 건너뜀', 1), 'len(files) == 0…', 'no operator left promising more (polish 7: nor an operand cut off)');
  assert.equal(tokenCut('hyperfine <command>... (src/main.rs main)', 1), 'hyperfine…', 'polish 7: the code run with spaces is one unit, never cut inside');
  assert.equal(tokenCut('Prisma 쓰기·읽기 · website_event …', 3), 'Prisma 쓰기·읽기…');
  assert.equal(tokenCut('Prisma 쓰기·읽기 · website_event …', 2), 'Prisma 쓰기…', 'polish 7: a list cut after its 「·」');
  for (const [t, n] of [['a_b c_d e_f', 2], ['기동 · 명령 python train.py', 4], ['run() == Err 일 때', 1]]) { const c = tokenCut(t, n); if (c && c !== t) assert.ok(!/(?:…|\.{3}).*…$/.test(c) && (c.match(/…/g) ?? []).length === 1, c); }
  // A label that ends on its own 「…」 takes no second one from styles.css.
  const a = await app(), c = await css();
  assert.match(fillLabelSrc(a), /el\.classList\.toggle\('self-cut', \/\(\?:…\|\\\.\{3\}\)\$\/\.test\(el\.textContent \?\? ''\)\)/);
  assert.match(c, /\.edge-labels > \.edge-label\.self-cut\[data-full\]::after \{ content: none; \}/);
  assert.match(fillLabelSrc(a), /if \(full !== text\) el\.dataset\.full = full; else delete el\.dataset\.full;/, 'a label shown whole holds no stale whole text (its tip, its mark)');
});

test('P6-3 every text a selection\'s label shows goes through fillLabel: no stale code chip classes on a plain label', async () => {
  const a = await app(), p = a.slice(a.indexOf('function placeLineLabels('), a.indexOf('function placeFitLabels('));
  assert.doesNotMatch(p, /label\.textContent = /, 'tryAt and the corrected-line mark never set the text past fillLabel');
  assert.ok(p.includes('fillLabel(label, REVISED_SHORT); label.classList.add(\'short\');'));
  assert.ok(p.includes('spot = fits ? along(w, hh).find(clear) ?? null : null;'), 'a corrected line whose words fit in no cut goes to its short mark');
  // The classes follow what is drawn: a cut that keeps no code is a plain label again.
  const f = fillLabelSrc(a);
  assert.match(f, /const draw = \(t: string\) => \{ const ps = labelParts\(t\), code = ps\.some\(p => p\.code\);\s+el\.classList\.toggle\('has-code', code\);/);
  assert.match(f, /if \(!code\) el\.classList\.remove\('has-code', 'is-code'\);/);
  assert.equal(labelParts('기동 · bind된…').some(p => p.code), false, 'the cut of 「기동 · bind된 Axios.prototype.request…」 is plain');
});

test('P6-4 the code has no dark chip under a dark system with Studio light (polish 7: no chip in any theme)', async () => {
  const c = await css();
  assert.doesNotMatch(c, /@media \(prefers-color-scheme: dark\) \{ \.edge-labels code\.lb-code/, 'no bare system-dark rule: Studio light under a dark system kept a dark chip');
  assert.doesNotMatch(c, /code\.lb-code \{[^}]*background: #/, 'polish 7: no filled ground in any theme');
});

test('P6-5 byTarget is a total order: the latest dated record speaks whatever the paste order; an undated one never outranks a dated one', () => {
  const recs = [{ id: 'A', target: '2026-03-01' }, { id: 'N', target: null }, { id: 'B', target: '2015-12-20' }];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const p of perms) {
    const order = byTarget(p.map(i => recs[i])).map(r => r.id);
    assert.deepEqual(order, ['N', 'B', 'A'], p.map(i => recs[i].id).join(' '));
  }
  const body = t => [{ text: t, from: 0 }];
  const full = { A: body('새 판이다.'), N: body('날짜 없는 판이다.'), B: body('옛 판이다.') };
  for (const p of perms) assert.equal(summarySource(p.map(i => ({ ...recs[i], body: full[recs[i].id] }))).record, 'A', p.join(''));
  // Paste order among the undated and among equal dates, as before.
  assert.deepEqual(byTarget([{ id: 'x' }, { id: 'y', target: null }]).map(r => r.id), ['x', 'y']);
  assert.deepEqual(byTarget([{ id: 'x', target: '2020-01-01' }, { id: 'y', target: '2020-01-01' }, { id: 'z', target: null }]).map(r => r.id), ['z', 'x', 'y']);
});

test('P6-6 a focus note is cut between tokens with one mark (never 「hyperfine <command> … …」); the code chip is regular weight', async () => {
  const a = await app();
  assert.match(a, /for \(let n = cutCount\(t1\) - 1; n >= 1 && nt\.scrollHeight > nt\.clientHeight \+ 1; n--\) \{ const c = tokenCut\(t1, n\); if \(c && \(!PLAN_WORD\.test\(t1\) \|\| PLAN_WORD\.test\(c\)\)\) fillLabel\(nt, c, t1\); \}/,
    'past its two lines: whole tokens off the end, a plan word kept');
  const shown = labelParts(tokenCut('hyperfine <command>... (src/main.rs main)', 1)).map(p => (p.code ? `[${p.t}]` : p.t)).join('');
  assert.equal(shown, 'hyperfine…', 'polish 7: the code run (spaces and all) is whole or not shown, one mark after the cut');
  const c = await css();
  assert.match(c, /\.edge-labels code\.lb-code, \.ff-note code\.lb-code \{[^}]*font-weight: inherit;/, 'polish 7 (F7 Q3): the weight of the words around it, never heavier');
});
