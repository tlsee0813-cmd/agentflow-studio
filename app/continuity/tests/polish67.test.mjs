// Cycle 67 polish: the visual system's contracts that a refactor of styles.css or index.html must keep. Contrast of the grey
// tokens on white, line emphasis by width, the help legend (four line kinds with their real end marks, the keyboard keys),
// the reading modes as one group, the map tools' groups, and the room a region asks for when the change preview keeps its
// current note above the change line. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope, mapLead, PLAN_LINE } from '../dist/public/client/map-layout.js';
import { buildConverterProject } from '../dist/public/client/plan-source.js';

const css = await readFile(new URL('../dist/public/styles.css', import.meta.url), 'utf8');
const html = await readFile(new URL('../dist/public/index.html', import.meta.url), 'utf8');
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const token = name => { const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(root); assert.ok(m, name); return m[1]; };
const lum = hex => { const c = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rule = sel => { const i = css.indexOf(`\n${sel} {`); assert.ok(i >= 0, sel); return css.slice(i, css.indexOf('}', i)); };
const width = sel => Number(/stroke-width:\s*([\d.]+)/.exec(rule(sel))[1]);

test('every text grey reads at 4.5:1 or more on white and on the canvas, and the greys keep their order', () => {
  const greys = ['text', 'text-2', 'text-3', 'text-4'].map(token);
  for (const g of greys) assert.ok(contrast(g, '#ffffff') >= 4.5, `${g} on white`);
  assert.ok(contrast(token('text-4'), token('bg')) >= 4.5, 'text-4 on the canvas');
  for (let i = 1; i < greys.length; i++) assert.ok(lum(greys[i]) > lum(greys[i - 1]), `${greys[i]} lighter than ${greys[i - 1]}`);
});

test('lines are stronger at rest than before and gain width, not only colour, on hover and selection', () => {
  assert.ok(lum(token('edge')) < lum('#b4bcc7'));
  const rest = width('.edge-line');
  assert.ok(width('.edge.near .edge-line') > rest && width('.edge.on .edge-line') > rest);
  // shares and related are told apart by their dots, not only by their end marks
  assert.notEqual(/stroke-dasharray:\s*([^;]+)/.exec(rule('.edge.k-shares .edge-line'))[1], /stroke-dasharray:\s*([^;]+)/.exec(rule('.edge.k-related .edge-line'))[1]);
});

test('the help is a legend: four line kinds with their end marks, and the keyboard keys', () => {
  const help = html.slice(html.indexOf('<div id="help"'), html.indexOf('<div id="edge-tip"'));
  const rows = help.match(/<li><svg[\s\S]*?<\/li>/g) ?? [];
  assert.equal(rows.length, 4);
  const [flow, needs, shares, related] = rows;
  for (const r of [flow, needs, shares]) { assert.match(r, /<circle class="m"/); assert.match(r, /<path class="m" d="M38\.5/); }
  assert.match(needs, /d-needs/); assert.match(shares, /d-shares/);
  assert.equal((related.match(/<circle class="m"/g) ?? []).length, 2, 'related: a dot at both ends, no arrow');
  assert.doesNotMatch(related, /<path class="m"/);
  for (const k of ['/', 'Enter', 'Space', 'Esc']) assert.ok(help.includes(`<kbd>${k}</kbd>`), k);
  for (const label of ['흐름 · 넘겨줌', '필요로 함', '함께 씀', '관련']) assert.ok(help.includes(label), label);
});

test('the reading modes are one segmented group and the home actions a primary and a secondary button', () => {
  assert.match(html, /<div class="mode-seg" role="group" aria-label="[^"]+"><button[^>]*id="return-entry"[^>]*>돌아와 읽기<\/button><button[^>]*id="plan-entry"[^>]*>변경 구상<\/button><\/div>/);
  assert.match(html, /id="new-open" class="primary"/);
  assert.match(html, /id="import" class="secondary"/);
});

test('map tools: icons on the zoom and help buttons, hairlines between groups, and 찾기 still lands before the zoom group', () => {
  const tools = html.slice(html.indexOf('<div class="controls"'), html.indexOf('<div id="help"'));
  for (const id of ['recent-toggle', 'zoom-out', 'zoom-in', 'zoom-fit', 'arrange', 'help-toggle']) assert.match(tools, new RegExp(`id="${id}"[^>]*>(?:(?!</button>)[\\s\\S])*<svg`), id);
  // app.ts inserts 찾기 before zoom-out's previous sibling: that sibling must be the first group's hairline
  assert.match(tools, /<span class="tool-sep" aria-hidden="true"><\/span>\s*<button type="button" id="zoom-out"/);
  assert.equal((tools.match(/class="tool-sep/g) ?? []).length, 4);
  assert.match(css, /\.tool-sep\.add-sep:has\(\+ \.add-part\[hidden\]\) \{ display: none; \}/);
});

test('a region asked for its two lines gets room for its current note and the change line under it', () => {
  const view = studioView(buildConverterProject());
  const region = view.parts.find(p => p.name === '내용·모양 보존');
  assert.ok(region && mapLead(view, region.id));
  const all = () => true, change = '변경 실패해도 나머지 계속';
  const head = planned => layoutScope(view, null, all, {}, undefined, planned).boxes.get(region.id).head;
  const one = head(new Map([[region.id, [change]]]));
  // plan-view's region hint: the note and the change, repeated to 120 characters
  const t = `${mapLead(view, region.id)} ${change}`, hint = t.length >= 120 ? t : t.padEnd(120, ` ${t}`);
  const two = head(new Map([[region.id, [change, hint]]]));
  assert.ok(two >= one);
  // name row (22) + paddings (12 + 14) + the note and the change line at 15px each with their gaps
  assert.ok(two - 12 - 22 - 14 >= 2 * PLAN_LINE + 3, `head ${two}`);
  // the preview CSS keeps the region's note and places the change line under it
  assert.match(css, /\.space\.preview \.region:is\(\.plan-direct, \.plan-impact\) > \.frame-head \.plan-note \{ grid-column: 2 \/ -1; grid-row: 3;/);
  assert.doesNotMatch(css, /\.space\.preview \.frame:is\(\.plan-direct, \.plan-impact\) > \.frame-head :is\(\.frame-meta, \.frame-note\)/);
});
