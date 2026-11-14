// v14 merged (v14-shape then v14-land): the two parts working together. Each test fails on the plain merge of the two branches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));

test('V14M-1 the rows v14 added under the switcher never take the sentence\'s room in the box\'s height budget', async () => {
  // A's caption row (ft-clear) and B's coverage line (ft-cover) made the box 96px tall before its sentence: under FT_MAX_H (120) no
  // sentence fitted and umami and axios at 1440 landed with none.
  const f = fn(await app(), 'ftIntro');
  assert.match(f, /const added = \[\.\.\.el\.querySelectorAll<HTMLElement>\(':scope > \.ft-clear, :scope > \.ft-cover'\)\]\.reduce\(\(n, e\) => n \+ \(e\.offsetHeight \? e\.offsetHeight \+ 2 : 0\), 0\);/);
  assert.match(f, /el\.offsetHeight <= FT_MAX_H \+ added/);
});

test('V14M-2 the fit makes room for the sentence with the coverage line given way before it lets the sentence step back', async () => {
  const a = await app();
  assert.match(a, /const FT_FORMS = \['ft-nobasis', 'ft-nocover', 'ft-under'\];/);
  assert.match(a, /const FT_SAID = \[null, 'ft-nobasis', 'ft-nobasis ft-nocover'\] as const;/);
  // A form of two classes is put on as two classes (classList.add with a space throws).
  assert.match(fn(a, 'ftBox'), /if \(form\) el\.classList\.add\(\.\.\.form\.split\(' '\)\);/);
  // The box's own steps keep the same order: the basis line, then the coverage line with it, then the sentence.
  const p = fn(a, 'placeFocusTop');
  assert.ok(p.indexOf("el.classList.add('ft-nobasis')") < p.indexOf('shapeYield(') && p.indexOf('shapeYield(') < p.indexOf("el.classList.add('ft-under')"));
});

test('V14M-3 the card shapes hold on typed cards, at every zoom and in the quiet state', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const tail = css.slice(css.indexOf('v14 merged (B\'s shapes'));
  assert.ok(tail.length > 0 && css.indexOf('v14 merged (B\'s shapes') > css.indexOf('.space .node.card:is(.f-participant, .f-process, .f-store, .f-trigger, .f-neutral) { border-width: 1px; border-style: solid; border-radius: 10px;'),
    'after the typed cards\' own rule (which set every typed card square and solid over B\'s shapes)');
  // As specific as the typed cards' rule (.space .node.card + one class) and later: a person round at the ends, an outside system dashed.
  assert.match(tail, /\.space \.node\.card\.pk-person \{ border-radius: 24px; \}/);
  assert.match(tail, /\.space \.node\.card\.pk-outside \{ border-style: dashed; border-width: max\(1px, calc\(1px \* min\(var\(--u, 1\), 2\.4\)\)\);/);
  // The quiet state's own selector with .pk-outside: the dashed edge in a seen colour, never the page's own tone (--hair-2).
  assert.match(tail, /#space\.cl-on:not\(\.lt-sel\) #world > \.node:not\(\.ff-card\)[^{]*\.pk-outside \{ border-color: var\(--text-4\); \}/);
});
