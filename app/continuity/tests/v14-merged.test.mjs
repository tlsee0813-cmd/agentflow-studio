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
  assert.match(fn(a, 'ftBox'), /if \(form\) \{ el\.classList\.add\(\.\.\.form\.split\(' '\)\); if \(form\.includes\('ft-nocover'\)\) fitSwitch\(el\); \}/);
  // The cue on the switcher's row: the row fitted again with it (at 자세히 its count made the row wrap and the sentence stepped back).
  assert.match(fn(a, 'shapeYield'), /el\.classList\.add\('ft-nocover'\); if \(basis\) el\.classList\.add\('ft-nobasis'\);\n[^\n]*\n  fitSwitch\(el\);\n  if \(!covers\(\)\) return true;\n[^\n]*\n  el\.classList\.remove\('ft-nocover', 'ft-nobasis'\); fitSwitch\(el\); return false;/); // v14 fix 2: the legend kept on a row
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
  assert.match(tail, /\.space \.node\.card\.pk-outside \{ --pk-w: max\(1px, calc\(1px \* min\(var\(--u, 1\), 2\.4\)\)\); border-style: dashed; border-radius: 10px; \}/);
  // Its extra width as an outline only while no other mark uses the outline (lit, picked, a plan's impact, the first view's emphasis, focus).
  assert.match(tail, /\.space \.node\.card\.pk-outside:not\(\.selected\):not\(\.lit\):not\(\.ff-card\):not\(\.ff-start\):not\(\.plan-impact\):not\(\.fv-emph\):not\(:focus-visible\) \{ outline: calc\(var\(--pk-w\) - 1px\) dashed [^;]+; outline-offset: calc\(-1 \* var\(--pk-w\)\); \}/);
  // Its extra width never takes the card's inner room (a border did: 「Kafka 브로커·소비자」 ran past its card at 780).
  assert.doesNotMatch(tail, /pk-outside[^{]*\{[^}]*border-width/);
  // The quiet state's own selector with .pk-outside: the dashed edge in a seen colour, never the page's own tone (--hair-2).
  assert.match(tail, /#space\.cl-on:not\(\.lt-sel\) #world > \.node:not\(\.ff-card\)[^{]*\.pk-outside \{ border-color: var\(--text-4\); \}/);
});

test('V14M-4 the bar stays on one row while its controls fit, measured (at 1280 the forced second row cost the map its whole fit)', async () => {
  const a = await app(), css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const b = fn(a, 'barRows');
  assert.match(b, /bar\.classList\.remove\('bar-two'\);/);
  assert.match(b, /two = kids\.some\(k => y\(k\)\.top - top > 12\);\n  bar\.classList\.toggle\('bar-two', two\); return two !== was;/);
  assert.match(fn(a, 'syncMapArea'), /^function syncMapArea\(\) \{\n  barRows\(\);/, 'measured before every fit');
  assert.match(fn(a, 'setBar'), /plainHeader\(\); \/\/ v14 B hook 8\n  barRows\(\);/);
  assert.match(fn(a, 'syncWords'), /plainHeader\(\); barRows\(\);/);
  // The second row by the measure only, never by the window's width alone.
  assert.doesNotMatch(css, /@media \(max-width: 1420px\) \{\n  \.bar:has\(#modebar:not\(\[hidden\]\)\) > \.context \{ flex: 1 0 calc\(100% - 44px\); \}/);
  assert.match(css, /\.bar\.bar-two > \.context \{ flex: 1 0 calc\(100% - 44px\); \}\n\.bar\.bar-two > \.modebar \{ order: 3; \}\n\.bar\.bar-two > :is\(#sync-pill, #ai-pill\) \{ order: 4; \}/);
  // Under 1420 px a little tighter: the folder pill's 「켜기」 stays in its tip and label.
  assert.match(css, /\.bar:has\(#modebar:not\(\[hidden\]\)\) #sync-pill > span > span \+ span \{ display: none; \}/);
});

test('V14M-5 a word-level switch on a map the person has not moved takes the fit again (the box\'s sentence keeps its room)', async () => {
  const set = fn(await app(), 'setWords');
  assert.match(set, /renderLegend\(\); renderSpace\('keep'\);\n[^\n]*\n[^\n]*\n    if \(!selected && !planView\.isOpen\(\) && \$\('lens'\)\.hidden && !mapMoved\) fitView\(false\);/);
});

test('V14M-6 the fit takes a frame for the sentence only where the box holds one (at 780 the box beside the title held none)', async () => {
  const a = await app();
  assert.match(a, /let ftBoxSaid = true;/);
  assert.match(fn(a, 'ftBox'), /ftBoxSaid = !sent \|\| !ftSaid\.some\(Boolean\) \|\| \(!sent\.hidden && !!sent\.textContent\);/);
  assert.ok(fn(a, 'fitView').includes("return (form === 'ft-under' || ftBoxSaid) && !ftCovers(b, camera, scene, inkAt(k));"));
});
