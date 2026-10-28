// AF-UI83: reading the inside of a part at its boundary, on the context75 micro-javascript backup (the d971 reading as stored; no
// new call). Inside 'JSContext.eval 평가 API': the scope itself is the end of its relation with its own pipeline, and '오류 처리'
// is a real part outside. Geometry uses a measure whose boundary caption is wider than a 12.5px note would suggest, as the
// Windows system font draws it; the browser scene was checked by eye in both fonts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBackup } from '../dist/public/shared/validation.js';
import { editArea } from '../dist/public/shared/domain.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope, ghostId, headNeed, HEAD_TRACK, SELF_HEAD, textWidth } from '../dist/public/client/map-layout.js';

const { project } = parseBackup(readFileSync(new URL('./fixtures/context75/micro-javascript-backup.json', import.meta.url), 'utf8'));
const id = name => project.space.areas.find(a => a.name === name).id;
const API = id('JSContext.eval 평가 API'), PIPE = id('평가 실행 파이프라인'), ERR = id('오류 처리');
/** A caption font wider than the note proxy (semibold, tracked), as on the PC that showed two lines. */
const wide = (t, kind) => textWidth(t) * (kind === 'where' ? 1.02 : kind === 'note' ? 0.9 : 1);

test('U83-1 a boundary caption is as wide and as tall as its own font draws it, and the card under it starts below it', () => {
  const L = layoutScope(studioView(project), API, () => true, {}, wide);
  assert.ok(L.heads.length >= 2);
  for (const h of L.heads) {
    const need = headNeed(h.text, wide);
    assert.ok(Math.abs(need - (wide(h.text, 'where') + HEAD_TRACK * [...h.text].length + 2)) < 1e-9, 'measured in the caption font with its tracking');
    if (need <= 300) { assert.ok(h.w >= need, `'${h.text}' fits its column on one line: ${h.w} < ${need}`); assert.equal(h.h, 20); }
    const under = [...L.boxes.values()].filter(b => b.kind === 'ghost' && b.x >= h.x - 0.5 && b.x <= h.x + h.w && b.y >= h.y).sort((a, b) => a.y - b.y)[0];
    assert.ok(under && under.y >= h.y + h.h, `card under '${h.text}' starts below it`);
  }
});

test("U83-2 the scope itself reads as this scope's boundary; a part outside, even one with the same name, stays outside", () => {
  const v = studioView(project), L = layoutScope(v, API, () => true, {});
  const self = L.heads.find(h => h.text === SELF_HEAD), out = L.heads.find(h => h.text.startsWith('밖 · '));
  assert.ok(self && L.boxes.has(ghostId(API)) && L.boxes.get(ghostId(API)).y >= self.y + self.h, 'the scope end sits under 이 범위');
  assert.ok(out && L.boxes.has(ghostId(ERR)), '오류 처리 stays outside');
  // The relation between the scope and its own pipeline is kept as stored: one line, from the scope's end to the pipeline.
  const e = L.edges.filter(x => x.ids.includes(v.relations.find(r => r.from === API && r.to === PIPE).id));
  assert.deepEqual(e.map(x => [x.from, x.to, x.kind]), [[ghostId(API), PIPE, 'flow']]);
  // Same name, other id: outside, not '이 범위'.
  const twin = studioView(editArea(project, ERR, 'JSContext.eval 평가 API', '')), T = layoutScope(twin, API, () => true, {});
  const runOf = gid => T.heads.filter(h => h.x <= T.boxes.get(gid).x + 0.5 && T.boxes.get(gid).x <= h.x + h.w && h.y <= T.boxes.get(gid).y).sort((a, b) => b.y - a.y)[0]?.text;
  assert.equal(runOf(ghostId(API)), SELF_HEAD);
  assert.match(runOf(ghostId(ERR)), /^밖 · /);
  assert.equal(T.edges.length, L.edges.length, 'renaming changes no line');
});

// AF-UI83-DELTA2: a long caption reserves the lines it really breaks into. long-context.json (root's synthetic stress copy of the
// context75 backup, not an OSS structure or a model answer): five ancestors of sixteen W each over an outside target. With a caption
// font of 10px per character (+0.44px tracking), in its 300px column:
//   '밖 · W×16'          20 characters = 208.8px  fits;  '… › W×16' would be 396.7px  → the next ancestor takes a new line
//   '› W×16'             18 characters = 187.9px  fits;  '… › W×16' would be 375.8px  → again a new line
// so five lines, one ancestor each. The total width (96 characters, 1002px) over 300px suggests four: the room left at each line's
// end, where the next word does not fit, is what a total misses.
import { captionLines } from '../dist/public/client/map-layout.js';
const LONG = parseBackup(readFileSync(new URL('./fixtures/boundary83/long-context.json', import.meta.url), 'utf8')).project;
const TARGET = 'A_4e6562bf-b303-4bb2-9991-868d36fa6111';
const ten = (t, kind) => (kind === 'where' ? [...t].length * 10 : textWidth(t));

test('U83-3 a long boundary caption keeps the lines it breaks into at word ends, and the target card starts under them', () => {
  const L = layoutScope(studioView(LONG), API, () => true, {}, ten), W16 = 'W'.repeat(16);
  const head = L.heads.find(h => h.text.includes(W16));
  assert.equal(head.text, `밖 · ${Array(5).fill(W16).join(' › ')}`, 'the whole caption, nothing cut');
  assert.equal(head.w, 300);
  assert.equal(head.h, 4 + 5 * 16, 'five lines, one ancestor each');
  const target = L.boxes.get(ghostId(TARGET));
  assert.ok(target.y >= head.y + head.h, `target at ${target.y} under the caption ending at ${head.y + head.h}`);
  // Where words do share a line, they still do; a run longer than a whole line breaks inside it (overflow-wrap: anywhere).
  assert.equal(captionLines('밖 · ab › cd', 300, ten), 1);
  assert.equal(captionLines('W'.repeat(40), 300, ten), 2, '40 characters, 417.6px: one run over two lines');
});
