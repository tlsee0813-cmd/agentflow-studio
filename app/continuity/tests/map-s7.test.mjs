// Display slice S7 (the fresh-eyes critique of the merged map, 2026-11-04), its pure parts: an untyped part with recorded steps or a
// loop is drawn by its structure and says what is recorded, never a type made up for it (critique 1–2); names break at separators
// (10); one footnote per group for an item its rows all cite (4); the outside partners' columns of a part's inside never share an x
// (6, nanoGPT 「학습」); 전체 보기 measures what is drawn (12). The badges, the labels by tier and the legend are in
// map-line-grammar and map-view-lens. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kindLabel, kindWord, structuralOf, nameBreaks, cardTemplate } from '../dist/public/client/card-family.js';
import { hoistMarks } from '../dist/public/client/pane-view.js';
import { endColumnX, unionRect, layoutScope, ghostId } from '../dist/public/client/map-layout.js';
import { createProject, addArea, addChildArea, addRelation } from '../dist/public/shared/domain.js';
import { studioView } from '../dist/public/shared/studio.js';

const facts = (x = {}) => ({ type: null, config: [], inputs: [], outputs: [], fields: [], loop: null, steps: [], conditions: [], ...x });

test('S7-1 an untyped part with recorded steps or a loop: 「유형 미기록 · 단계 N」 and a structural outline; never a type', () => {
  assert.equal(kindLabel(null, 6, false), '유형 미기록 · 단계 6');
  assert.equal(kindLabel(null, 0, true), '유형 미기록 · 반복');
  assert.equal(kindLabel(null, 0, false), '유형 미상', 'nothing recorded inside: as before');
  assert.equal(kindLabel('compute', 6, true), '계산', 'a recorded type reads as itself');
  assert.equal(kindWord(null), '유형 미상');
  assert.equal(structuralOf(null, 3, false), true); assert.equal(structuralOf(null, 0, true), true);
  assert.equal(structuralOf(null, 0, false), false); assert.equal(structuralOf('loop', 3, true), false, 'a typed part is drawn by its family');
  const t = cardTemplate(facts({ steps: [{ name: 'a', does: null }, { name: 'b', does: null }, { name: 'c', does: null, program: true }] }));
  assert.equal(t.family, 'neutral', 'the family stays neutral: nothing is guessed');
  assert.equal(t.glyph, 'neutral');
  assert.equal(t.structural, true);
  assert.equal(t.kind, '유형 미기록 · 단계 2', 'the steps the record holds (the program\'s cut steps apart, as the inner line counts them)');
  const plain = cardTemplate(facts());
  assert.equal(plain.structural, false); assert.equal(plain.kind, '유형 미상');
  const loopOnly = cardTemplate(facts({ loop: { unit: '행마다', stop: null, resume: null } }));
  assert.equal(loopOnly.kind, '유형 미기록 · 반복'); assert.equal(loopOnly.structural, true);
  assert.equal(cardTemplate(facts({ type: 'loop', steps: [{ name: 'a', does: null }] })).structural, false);
});

test('S7-2 a name breaks only after a separator or at its spaces, never inside a word; joined it is the name', () => {
  assert.deepEqual(nameBreaks('CancelToken·signal'), ['CancelToken·', 'signal']);
  assert.deepEqual(nameBreaks('train.bin/val.bin'), ['train.', 'bin/', 'val.', 'bin']);
  assert.deepEqual(nameBreaks('sample.py'), ['sample.', 'py']);
  assert.deepEqual(nameBreaks('adapters'), ['adapters']);
  assert.deepEqual(nameBreaks('wandb'), ['wandb']);
  assert.deepEqual(nameBreaks('main::run'), ['main:', ':', 'run']);
  assert.deepEqual(nameBreaks('데이터 준비'), ['데이터 준비'], 'a space is already a break');
  assert.deepEqual(nameBreaks('a- b'), ['a- b'], 'no break before a space (the space is one)');
  for (const n of ['CancelToken·signal', 'train.bin/val.bin', 'main::run', 'openwebtext 데이터', 'x_y-z', '']) assert.equal(nameBreaks(n).join(''), n);
});

test('S7-3 footnotes: an item two rows of a group cite is marked once at the group head; a row keeps the marks only it has', () => {
  // main::run: eight rows citing 〔파일·2〕, one also 〔보고·5〕.
  const eight = Array.from({ length: 8 }, (_, i) => (i === 3 ? [2, 5] : [2]));
  assert.deepEqual(hoistMarks(eight), { head: [2], rows: eight.map((_, i) => (i === 3 ? [5] : [])) });
  assert.deepEqual(hoistMarks([[3], [4], [5]]), { head: [], rows: [[3], [4], [5]] }, 'distinct marks stay on their rows');
  assert.deepEqual(hoistMarks([[7, 3], [3, 7], [9]]), { head: [3, 7], rows: [[], [], [9]] }, 'in number order');
  assert.deepEqual(hoistMarks([[4]]), { head: [], rows: [[4]] }, 'one row: nothing to merge');
  assert.deepEqual(hoistMarks([[4, 4], []]), { head: [], rows: [[4, 4], []] }, 'one row citing twice is still one row');
  assert.deepEqual(hoistMarks([]), { head: [], rows: [] });
});

test('S7-4 the outside partners\' columns never share an x: with neither side free, a column goes past everything placed (nanoGPT 학습)', () => {
  // The inside: 'a' at 400 (the part both columns meet), 'b' at 0 (blocking a's left side).
  const a = { x: 400, y: 0, w: 272, h: 200 }, b = { x: 0, y: 0, w: 272, h: 200 };
  const colIn = endColumnX({ out: false, near: [a], colW: 150, y: 0, colH: 120, taken: [a, b], fallbackX: -90 });
  assert.deepEqual(colIn, { x: 762, found: true }, 'incoming: its left is taken, so beside a on the right');
  const inGhost = { x: 762, y: 0, w: 150, h: 40 }, inHead = { x: 762, y: -20, w: 150, h: 20 };
  const colOut = endColumnX({ out: true, near: [a], colW: 150, y: 0, colH: 120, taken: [a, b, inGhost, inHead], fallbackX: 672 + 90 });
  assert.equal(colOut.found, false);
  assert.ok(colOut.x >= 762 + 150 + 24, `outgoing column at ${colOut.x} clear of the incoming one (762–912)`);
  assert.equal(colOut.x, 912 + 90);
  // Before S7 the outgoing fallback was the scope's maxX + 90 = 762: the incoming column's x.
  assert.notEqual(colOut.x, colIn.x);
  // A free side is still taken first, as before (outgoing right first, incoming left first).
  assert.deepEqual(endColumnX({ out: true, near: [a], colW: 150, y: 0, colH: 120, taken: [a], fallbackX: 762 }), { x: 762, found: true });
  assert.deepEqual(endColumnX({ out: false, near: [a], colW: 150, y: 0, colH: 120, taken: [a], fallbackX: -90 }), { x: 160, found: true });
  assert.deepEqual(endColumnX({ out: false, near: [], colW: 150, y: 0, colH: 120, taken: [], fallbackX: -90 }), { x: -240, found: false });
});

/** A part with an inside whose own parts meet partners outside on both sides (as nanoGPT's 학습: data in from outside, results out). */
function inside() {
  let p = createProject();
  for (const n of ['데이터', '체크포인트', '로그']) p = addArea(p, n, '');
  p = addArea(p, '학습', '');
  const scope = p.space.areas.at(-1).id;
  for (const n of ['준비', '루프', '평가']) p = addChildArea(p, scope, n);
  const id = n => p.space.areas.find(a => a.name === n).id;
  p = addRelation(p, id('데이터'), id('루프'), 'flow');
  p = addRelation(p, id('준비'), id('루프'), 'flow');
  p = addRelation(p, id('루프'), id('평가'), 'flow');
  p = addRelation(p, id('루프'), id('체크포인트'), 'flow');
  p = addRelation(p, id('평가'), id('로그'), 'flow');
  p = addRelation(p, id('데이터'), id('평가'), 'flow');
  return { p, scope, id };
}
const overlap = (r, s, m = 0) => r.x < s.x + s.w + m && s.x < r.x + r.w + m && r.y < s.y + s.h + m && s.y < r.y + r.h + m;

test('S7-5 inside a part, the incoming and the outgoing columns and their heads never overlap, wherever its parts were placed', () => {
  const { p, scope, id } = inside(), v = studioView(p);
  // As stored places can put them: the part the lines meet with another one left of it (its left side taken), and as arranged.
  const layouts = [{}, { [scope]: { [id('준비')]: { x: 0, y: 0 }, [id('루프')]: { x: 330, y: 0 }, [id('평가')]: { x: 330, y: 260 } } },
    { [scope]: { [id('평가')]: { x: 0, y: 0 }, [id('루프')]: { x: 320, y: 0 }, [id('준비')]: { x: 0, y: 240 } } }];
  for (const pos of layouts) {
    const L = layoutScope(v, scope, () => true, pos), ghosts = [...L.boxes.values()].filter(b => b.kind === 'ghost');
    assert.ok(ghosts.length >= 2, 'partners on both sides');
    const inX = new Set(L.heads.filter(h => h.key.startsWith('in|')).map(h => h.x)), outX = new Set(L.heads.filter(h => h.key.startsWith('out|')).map(h => h.x));
    for (const x of inX) assert.ok(!outX.has(x), `in and out columns share x ${x} (${JSON.stringify(pos)})`);
    const all = [...ghosts, ...L.heads];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!overlap(all[i], all[j]), `${JSON.stringify(all[i])} over ${JSON.stringify(all[j])}`);
    for (const g of ghosts) for (const b of L.boxes.values()) if (b.kind === 'node') assert.ok(!overlap(g, b), `${g.id} over ${b.id}`);
    assert.ok(L.boxes.has(ghostId(id('데이터'))) && L.boxes.has(ghostId(id('로그'))));
  }
});

test('S7-6 전체 보기 measures what is drawn: the union of the layout\'s bounds and every drawn element', () => {
  assert.deepEqual(unionRect([{ x: 0, y: 0, w: 100, h: 50 }, { x: 80, y: -20, w: 60, h: 10 }, { x: -10, y: 40, w: 5, h: 30 }]), { x: -10, y: -20, w: 150, h: 90 });
  assert.deepEqual(unionRect([{ x: 5, y: 5, w: 0, h: 0 }]), { x: 5, y: 5, w: 0, h: 0 });
  assert.equal(unionRect([]), null);
  assert.deepEqual(unionRect([{ x: NaN, y: 0, w: 1, h: 1 }, { x: 1, y: 2, w: 3, h: 4 }]), { x: 1, y: 2, w: 3, h: 4 }, 'an unmeasured element is left out');
});
