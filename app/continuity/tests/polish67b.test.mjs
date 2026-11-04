// Cycle 67 polish: the visual system's contracts that a refactor of styles.css or index.html must keep. Contrast of the grey
// tokens on white, line emphasis by width, the help legend (the line channels with their real end marks, the keyboard keys),
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
// Map design v3 6.1: a line's width is its --lw in screen pixels (styles.css multiplies it by --u, one screen pixel in map units).
const width = sel => Number(/--lw:\s*([\d.]+)/.exec(rule(sel))[1]);

test('every text grey reads at 4.5:1 or more on white and on the canvas, and the greys keep their order', () => {
  const greys = ['text', 'text-2', 'text-3', 'text-4'].map(token);
  for (const g of greys) assert.ok(contrast(g, '#ffffff') >= 4.5, `${g} on white`);
  assert.ok(contrast(token('text-4'), token('bg')) >= 4.5, 'text-4 on the canvas');
  for (let i = 1; i < greys.length; i++) assert.ok(lum(greys[i]) > lum(greys[i - 1]), `${greys[i]} lighter than ${greys[i - 1]}`);
});

test('lines are stronger at rest than before and gain width, not only colour, on hover and selection', () => {
  assert.ok(lum(token('edge')) < lum('#b4bcc7'));
  const rest = width('.edge-line');
  assert.ok(rest >= 1.25, 'never under 1.25 on screen at rest');
  assert.ok(width('.edge.near .edge-line') > rest && width('.edge.on .edge-line') > rest);
  assert.equal(width('.edge.on .edge-line'), 3, 'selected 3px');
  assert.match(rule('.edge-line'), /stroke-width:\s*calc\(var\(--lw\) \* var\(--u, 1\) \* 1px\)/, 'screen pixels at every zoom');
  // a reference's dots and a plain relation's sparse dots are told apart by their dots, not only by their end marks
  const dash = sel => /stroke-dasharray:\s*([^;]+)/.exec(rule(sel))[1];
  assert.notEqual(dash('.edge.s-dotted .edge-line'), dash('.edge.s-sparse .edge-line'));
  assert.match(dash('.edge.s-dashed .edge-line'), /calc\(6px \* var\(--u, 1\)\) calc\(4px \* var\(--u, 1\)\)/, 'control dashed 6 4 on screen');
  assert.match(dash('.edge.s-dotted .edge-line'), /^0 calc\(4px/, 'a reference dotted 0 4');
});

// Map design v3 6.1: the legend reads the line grammar (data: solid, filled head; control: dashed, open V; reference: dotted
// from an ear to a small V; a shared use dotted with ears; a plain relation sparse dots with a dot at both ends) and the text badge.
test('the help is a legend: the line grammar with its end marks, the plain relation, the text badge, and the keyboard keys', () => {
  const help = html.slice(html.indexOf('<div id="help"'), html.indexOf('<div id="edge-tip"'));
  const rows = help.match(/<li><svg[\s\S]*?<\/li>/g) ?? [];
  assert.equal(rows.length, 6);
  const [data, control, uses, shares, related, badge] = rows;
  assert.match(data, /<path class="m" d="M38\.5[^"]*z"/, 'data: a filled head');
  assert.doesNotMatch(data, /d-control|d-uses/);
  assert.match(control, /d-control/); assert.match(control, /<path class="v" d="M39\.5/); assert.doesNotMatch(control, /class="m"/);
  assert.match(uses, /d-uses/); assert.match(uses, /<circle class="e"/, 'a reference: its ear'); assert.match(uses, /<path class="v"/);
  assert.equal((shares.match(/<circle class="e"/g) ?? []).length, 2, 'a shared use: an ear at both ends');
  assert.equal((related.match(/<circle class="m"/g) ?? []).length, 2, 'related: a dot at both ends, no arrow');
  assert.doesNotMatch(related, /<path class="m"/);
  assert.match(badge, /<rect class="b"/);
  for (const k of ['/', 'Enter', 'Space', 'Esc']) assert.ok(help.includes(`<kbd>${k}</kbd>`), k);
  for (const label of ['데이터', '채운 삼각, 실선', '제어·기동', '열린 V, 파선', '참조', '점렬', '관련', '철회', '계획된 연결', '함께 쓰는', '글자 배지', '색만으로 뜻을 싣지 않아요']) assert.ok(help.includes(label), label);
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
  // Map design v3 7.3: the lens switch is a group of its own (five segments), between the arrange and help groups.
  assert.equal((tools.match(/class="tool-sep/g) ?? []).length, 5);
  assert.match(tools, /<div class="lens-seg" role="radiogroup"[^>]*>(?:<button type="button" role="radio" data-lens="(compose|data|start|state|scenario)"[^>]*>[^<]+<\/button>){5}<\/div>/);
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
