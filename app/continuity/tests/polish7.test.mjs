// Polish 7: the code ruling (F7 Q3) on map labels and cards, and the cut review of polish 6 (a cut inside a code run with spaces, a fit
// label ending on an operator, a plain list cut mid-item by the CSS ellipsis). Each test fails on polish 6. Fictional strings only.
// No browser: the cut runs as built; the DOM code is read from the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { labelParts, tokenCut, cutUnits, cutCount, wholeWords } from '../dist/public/client/line-grammar.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = async () => (await readFile(new URL('../public/styles.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const show = t => labelParts(t).map(p => (p.code ? `[${p.t}]` : p.t)).join('');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));

test('P7-1 code is quiet monospace: the words\' size, weight and colour, the label\'s own halo, no chip, no border, no padding', async () => {
  const c = await css();
  const rule = c.match(/\.edge-labels code\.lb-code, \.ff-note code\.lb-code \{([^}]*)\}/)?.[1] ?? '';
  for (const want of ['font-size: 1em', 'font-weight: inherit', 'padding: 0', 'margin: 0', 'border: 0', 'background: none', 'color: inherit']) assert.ok(rule.includes(want), want);
  assert.ok(!/text-stroke/.test(rule), 'the halo is the label\'s own (inherited), never switched off inside the code');
  assert.doesNotMatch(c, /code\.lb-code \{[^}]*background: #/, 'no filled ground in any theme');
  assert.ok(rule.includes('font-variant-ligatures: none') && rule.includes('"liga" 0, "calt" 0'), 'the characters as written: a code font never draws 「!=」 as 「≠」');
  const name = c.match(/\.node\.card :is\(\.c-name, \.c-tag-name\) code\.nm-code[^{]*\{([^}]*)\}/)?.[1] ?? '';
  for (const want of ['font-size: 1em', 'font-weight: inherit', 'padding: 0', 'background: none']) assert.ok(name.includes(want), `card name code: ${want}`);
});

test('P7-2 an identifier in brackets after a plain-language card name goes to the pane\'s subtitle and the hover, unless it alone tells two cards apart', async () => {
  // Review of v7: the face's name lives in face-name.ts, shared by the card, the pane and the growth view.
  const a = await app(), fnm = await readFile(new URL('../src/client/face-name.ts', import.meta.url), 'utf8');
  assert.ok(fnm.includes("const NAME_IDENT = /^(.*[가-힣].*?)\\s*\\(([^()\\s]+)\\)$/;"), 'a bracketed identifier after words with Hangul');
  assert.ok(fn(a, 'faceName').includes('const counts = faceCounts(o.view.parts.map(x => x.name)); m = new Map(o.view.parts.map(x => [x.id, faceSplit(x.name, counts)]));'));
  assert.ok(fnm.includes('return s && (counts.get(s.plain) ?? 0) <= 1 ? { name: s.plain, ident: s.ident } : { name: name.trim(), ident: null };'), 'kept on the face when another card has the same plain name');
  assert.match(a, /h\('span', \{ class: 'hc-ident' \}, h\('code', \{ class: 'nm-code' \}, fn\.ident\)\)/, 'the hover (pointer and keyboard focus) reads it as written');
  assert.match(a, /h\('p', \{ class: 'pane-ident', title: '식별자 · 기록에 적힌 그대로' \}, h\('code', \{ class: 'nm-code' \}, faceName\(o, part\)\.ident!\)\)/, 'the pane\'s subtitle');
  assert.match(a, /'aria-label': \[p\.name, t\.kind/, 'the card\'s accessible name keeps the whole name');
  // A name that is only code keeps it, in quiet monospace (never a paraphrase); a bare capitalised word stays the name's own type.
  assert.match(fnm, /export const nameCode = \(t: string\): boolean => \{\n  let u = t\.replace\(/);
  assert.ok(fnm.includes("!/^[A-Z][A-Za-z0-9]*$/.test(u)"), 'PostgreSQL, GitHub, StateManager: names, not code');
  assert.ok(fnm.includes("let u = t.replace(/\\([A-Za-z][A-Za-z0-9 .-]*\\)/g, '');") && fnm.includes("u = u.replace(/^\\(+|\\)+$/g, '');"), 'a gloss in brackets (「Karpathy(karpathy)」) and a tag line\'s lone bracket (「Base)」) are no code');
  // The box was measured for the whole name: the face never needs more lines than that (layout unchanged).
  assert.match(a, /const nl = cardNameLines\(p, !!dot, !!r\.loop\), hs = cardHeights\(t, nl\), fn = faceName\(o, p\);/);
  assert.match(fn(a, 'faceNameNodes'), /if \(w \* 1\.06 \+ 2 > room \* \(lines > 1 \? 1\.85 : 1\)\) return breakable\(name\);/, 'monospace only where it keeps the measured lines');
  // v8 (V8-7): a name tag draws no monospace at all (its code read louder than the names around it).
  assert.doesNotMatch(fn(a, 'tagLineNodes'), /MONO/, 'a name tag\'s code in the tag\'s own type');
});

test('P7-3 a cut falls only between units: a code run with spaces is one (「(src/main.rs main)」, 「iter_num % log_interval == 0」)', () => {
  // polish 6: 「hyperfine <command>…」 cut the run 「<command>... (src/main.rs main)」.
  assert.deepEqual(cutUnits('hyperfine <command>... (src/main.rs main)'), ['hyperfine ', '<command>... (src/main.rs main)']);
  assert.equal(tokenCut('hyperfine <command>... (src/main.rs main)', 1), 'hyperfine…');
  // An expression is one run: its operands and joining words with it.
  assert.equal(show('iter_num % log_interval == 0 and master_process'), '[iter_num % log_interval == 0 and master_process]');
  assert.equal(show('output_style != Disabled'), '[output_style != Disabled]');
  assert.equal(show("args.report_type != 'detailed_report'"), "[args.report_type != 'detailed_report']");
  assert.equal(show('len(files) == 0가 거짓일 때'), '[len(files) == 0]가 거짓일 때', 'a Hangul ending after an operand stays words');
  assert.equal(cutCount('iter_num % log_interval == 0 and master_process'), 1, 'no cut inside: whole or not at all');
  assert.equal(wholeWords('iter_num % log_interval == 0 and master_process'), '', 'no short form cut out of it');
  // Words stay words; the rules of polish 5 and 6 hold.
  for (const t of ['넘겨줌 3', 'type이 event·identify·performance', '기동 · bind…']) assert.equal(labelParts(t).some(p => p.code), false, t);
  for (let n = 1; n < 6; n++) { const c = tokenCut('a_b c_d 그리고 e_f g_h 끝', n); if (c && c !== 'a_b c_d 그리고 e_f g_h 끝') assert.ok(['a_b c_d…', 'a_b c_d 그리고…', 'a_b c_d 그리고 e_f g_h…'].includes(c), c); }
});

test('P7-4 a cut never ends on an operator, and never trims one off a code run (pocketbase 「len(files) == …」)', async () => {
  assert.equal(wholeWords('len(files) == 0 이면 건너뜀', 18), 'len(files) == 0 이면');
  assert.equal(wholeWords('count >= 이면 다시', 9), 'count', 'a word operator at the end goes');
  assert.equal(tokenCut('p.config.Automigrate && 컬렉션 요청 성공', 1), null, 'the run ends on 「&&」: no cut there');
  assert.equal(tokenCut('p.config.Automigrate && 컬렉션 요청 성공', 2), 'p.config.Automigrate && 컬렉션…');
  for (const t of ['len(files) == 0가 거짓일 때', 'a == b 이고 c != d 일 때', 'x_y >= 3 그리고 끝']) for (let n = 1; n < cutCount(t); n++) { const c = tokenCut(t, n); if (c) assert.doesNotMatch(c, /[=<>!&|+*%^~?]\s*…$/, `${t} @${n}: ${c}`); }
  const a = await app(), fit = fn(a, 'fitCut');
  assert.match(fit, /const one = tokenCut\(s, 1\); if \(one !== null && one\.replace\(\/…\$\/, ''\)\.length <= n \+ 6\) return one;/, 'the first unit as tokenCut makes it, never a raw first token');
  assert.doesNotMatch(fit, /\/\^\\S\+\/\.exec\(s\)/, 'no raw first token (「len(files)」 then 「==」)');
});

test('P7-5 a plain list label is cut at its list separators, never by the CSS ellipsis mid-item (gpt-researcher 「질의·report_type·report_sou…」)', async () => {
  assert.deepEqual(cutUnits('질의·report_type·report_source·…'), ['질의·', 'report_type·', 'report_source·', '…']);
  assert.equal(tokenCut('질의·report_type·report_source·…', 2), '질의·report_type…');
  assert.equal(tokenCut('질의·report_type·report_source·…', 1), null, 'two characters say nothing');
  assert.equal(wholeWords('Poll·Heartbeat·Status 보고 보내기'), 'Poll·Heartbeat', 'a list\'s 「·」 never counts toward the room');
  const f = fn(await app(), 'fillLabel');
  assert.match(f, /el\.textContent = text; if \(text\.length < 9 \|\| !over\(\)\) return done\(true\);/, 'a plain label measured only when it may be cut');
  assert.match(f, /for \(let n = cutCount\(text\) - 1; n >= 1; n--\) \{ const c = tokenCut\(text, n\); if \(c === null\) continue; least = c; el\.textContent = c;/, 'plain labels cut between units too');
  assert.match(f, /el\.classList\.add\('wide-cut'\)/, 'the shortest such cut may take a little more room');
  assert.match(await css(), /\.edge-labels > \.edge-label\.wide-cut \{ max-width: 160px; \}/);
});

test('P7-6 a condition written as code reads as written on the first screen, or folds to its ◇, which pointer and keyboard open', async () => {
  const a = await app(), fit = fn(a, 'fitCut');
  // v8 (V8-1, V8-2): whole up to FIT_CODE_MAX, else cut between units (never 「iter_num %…」); folded to its ◇ only at the far zoom.
  assert.match(fit, /if \(cond && labelParts\(s\)\.some\(p => p\.code\)\) \{ const f = condForms\(s, fold\); return n >= 14 \? f\.long : f\.short; \}/);
  assert.ok(a.includes('c = fitCut(base, n, cond, fold)'), 'the fit labels say which are conditions');
  const fa = fn(a, 'foldAccess');
  assert.match(fa, /box\.removeAttribute\('aria-hidden'\);/);
  assert.match(fa, /el\.classList\.contains\('edge-cue'\) \|\| el\.classList\.contains\('b-condition'\)/, 'a condition\'s cue and badge');
  assert.match(fa, /const cut = !!el\.dataset\.full && el\.dataset\.full !== el\.textContent/, 'a label shown cut');
  assert.match(fa, /el\.tabIndex = 0; el\.setAttribute\('role', 'button'\); el\.setAttribute\('aria-label', `\$\{words\} · 눌러서 이 선 고르기`\);/);
  assert.ok(a.includes('function placeEdgeLabels() { placeLineLabels(); dropRowIds(); foldAccess();'), 'after every placement');
  assert.match(a, /if \(x && \(x\.kind !== 'line' \|\| fold\) && !quiet\(x\)\) enter\(x, fold\);/, 'focus opens the line\'s tip (dismissed by Esc, kept while pointed at: the hover machine)');
  assert.match(a, /const k = lineHit\(t\), edge = k \? edgeOf\(k\) : null; if \(edge\) \{ e\.preventDefault\(\); hoverStop\(\); pickLine\(edge\); \}/, 'Enter or Space picks the line, as a click does');
  assert.match(await css(), /\.edge-labels > \[role="button"\]:focus-visible \{ outline: 2px solid var\(--accent\);/);
});
