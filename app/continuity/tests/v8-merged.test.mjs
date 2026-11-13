// v8 merged: where v8 maps and v8 growth meet in the same place. Each test fails on either branch alone.
// No browser: the DOM code is read from the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = async () => (await readFile(new URL('../public/styles.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));

test('V8M-1 a folded condition keeps both: the open cue (three dots) at rest and 「조건 보기」 on hover, the word past the dots', async () => {
  const cue = fn(await app(), 'placeCue');
  // One element carries both (v8 maps: q-open and its dots; v8 growth: the word), never one in place of the other.
  assert.match(cue, /\$\{open \? ' q-open' : ''\}/);
  assert.match(cue, /open \? h\('span', \{ class: 'cue-open', 'aria-hidden': 'true' \}\) : null, h\('span', \{ class: 'cue-word', 'aria-hidden': 'true' \}, cue === 'condition' \? '조건 보기' : '선택 보기'\)/);
  const c = await css();
  // The dots run from 8.5px to 15.5px: the word (at 11px beside a bare ◇) starts past them beside an open cue.
  const dots = /\.edge-cue \.cue-open \{[^}]*left: ([\d.]+)px;[^}]*width: ([\d.]+)px;/.exec(c);
  assert.ok(dots, 'the open cue is drawn');
  const word = /\.edge-cue\.q-open \.cue-word \{ left: ([\d.]+)px; \}/.exec(c);
  assert.ok(word, 'the word beside an open cue has its own place');
  assert.ok(Number(word[1]) >= Number(dots[1]) + Number(dots[2]) + 2, `word at ${word[1]}px clears the dots`);
});
