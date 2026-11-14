// Beauty v2 「읽히는 첫 전체 화면」 (cards, symbols, far view, framing): two card sizes, one status mark and one way in, the far view's
// name tags (names never under 12px on screen, identifiable, switched with hysteresis), and a first view that is the whole map
// wherever its tags read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardFace, fitTag, fitTags, tagRoom, linesNeeded, distinguishing, FACE_K, FACE_HYST, TAG, TAG_COMPACT, CARD_NAME_PX, NAME_FLOOR_PX } from '../dist/public/client/name-tag.js';
import { cardTemplate, cardHeights, CARD_W, CARD_H, CARD_H_TALL, CONTACT_Y } from '../dist/public/client/card-family.js';

const app = () => readFileSync(new URL('../dist/public/client/app.js', import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../dist/public/styles.css', import.meta.url), 'utf8');
const body = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); let d = 0; const j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(j, k + 1); } return ''; };
/** A fixed-width measure: 7px a Latin character, 12px a Hangul one (about the tag's 12.5px type). */
const measure = s => [...s].reduce((n, c) => n + (/[ㄱ-힝]/.test(c) ? 12 : c === '…' ? 9 : 7), 0);
const facts = (x = {}) => ({ type: null, config: [], inputs: [], outputs: [], fields: [], loop: null, steps: [], conditions: [], ...x });

// Beauty v2 review (H3): the card face turns to the tag below 0.9, not 0.8: its lines are spaced for 8 screen px at 0.9 (map-route
// CROWD, PORT_FLOOR), so the card face is never drawn further out than that. The way back needs 10%.
test('BV2-1 the face: the card from 0.9 (its name 13.5px or more, its lines spaced for that zoom), else the name tag; 10% back, so no flicker', () => {
  assert.equal(FACE_K, 0.9); assert.ok(FACE_K >= NAME_FLOOR_PX / CARD_NAME_PX); assert.ok(FACE_HYST >= 1.1 && FACE_HYST <= 1.15, 'hysteresis 10-15%');
  assert.equal(cardFace(0.89), 'tag'); assert.equal(cardFace(0.9), 'card');
  assert.equal(cardFace(0.95, 'tag'), 'tag', 'the way back needs 10% more'); assert.equal(cardFace(1, 'tag'), 'card');
  assert.equal(cardFace(0.91, 'card'), 'card'); assert.equal(cardFace(0.89, 'card'), 'tag');
  // Whatever the face, a name never reads under 12px on screen.
  for (let k = 0.2; k <= 1.6; k += 0.01) for (const prev of [null, 'tag', 'card']) {
    const f = cardFace(k, prev), px = f === 'card' ? CARD_NAME_PX * k : Math.min(TAG.name, TAG_COMPACT.name);
    assert.ok(px >= NAME_FLOOR_PX - 1e-9, `${k.toFixed(2)} ${prev} ${f} ${px}`);
  }
});

test('BV2-2 a tag fits its name in its lines, cut at the end with 「…」, broken at separators, spaces and before a bracket', () => {
  assert.deepEqual(fitTag('워커', 80, 2, measure), { lines: ['워커'], full: true });
  const two = fitTag('메인테이너(Yota Hamada)', 80, 2, measure);
  // v14 A (spec 2): whole at a smaller type rather than cut; the word before the bracket is never split (「메인테이너(Y|ota」).
  assert.ok(two.full && two.lines[0].startsWith('메인테이너') && !two.lines[0].endsWith('(Y'), two.lines.join('|'));
  const cut = fitTag('보관소를 읽어 조건을 확인하고 주문을 요청하는 감시 루프', 70, 2, measure);
  assert.equal(cut.lines.length, 2); assert.equal(cut.full, false); assert.ok(cut.lines[1].endsWith('…'));
  for (const l of cut.lines) assert.ok(measure(l) * (cut.scale ?? 1) <= 70, l); // v14 A: at the type it is drawn at
  // Beauty v2 review (M4): an identifier breaks where its words meet, never inside one: 'ReadWrite|Proxy·압축 |워커' (three lines where the
  // old character break made two with 'ReadWriteProx|y').
  assert.equal(linesNeeded('ReadWriteProxy·압축 워커', 90, measure), 3);
  assert.deepEqual(fitTag('GPTResearcher', 80, 2, measure).lines, ['GPT', 'Researcher']);
  assert.deepEqual(fitTag('WebSocketManager·run_agent', 90, 3, measure).lines, ['WebSocket', 'Manager·run_', 'agent']);
  // v14 A (spec 2): never cut at its start or inside a word (v12 drew 「…데이터」 and 「tinyshak…」): a first word wider than a line stays whole
  // at a smaller type (down to WORD_MIN_PX), else 「⋯」 alone; the name in the card's hover and keyboard name (V14A-1).
  const long = fitTag('tinyshakespeare 데이터', 70, 2, measure);
  assert.ok(!long.lines.join('').startsWith('…') && !/tinyshak…/.test(long.lines.join('')), long.lines.join('|'));
  assert.ok(['tinyshakespeare', '⋯'].includes(fitTag('tinyshakespeare', 70, 2, measure).lines[0]));
  assert.ok(fitTag('가나다라마바사아자차', 60, 2, measure).lines.every(l => measure(l) <= 60));
  // The last line reads the rest of the name as written (no space put where it had a separator).
  assert.deepEqual(fitTag('CancelToken·signal·abort·timeout', 95, 2, measure).lines, ['CancelToken·', 'signal·abort…']);
});

test('BV2-3 identifiable: names that would read alike keep the part that tells them apart (v14: never by a middle cut, V14A-2)', () => {
  const a = 'Hugging Face datasets openwebtext(외부)', b = 'Hugging Face transformers GPT-2 가중치(외부)';
  assert.equal(distinguishing(a, [b]), 'Hugging…datasets openwebtext(외부)');
  const out = fitTags([{ id: 'a', name: a, width: 90, lines: 1 }, { id: 'b', name: b, width: 90, lines: 1 }], measure);
  // v14 A (spec 2): a tag is never cut in its middle to tell two apart; each starts as its name starts (the whole in its hover).
  for (const [k, n] of [['a', a], ['b', b]]) assert.ok(n.replace(/\s+/g, '').startsWith(out.get(k).lines.join('').replace(/…$/, '').replace(/\s+/g, '')));
  // Names that differ early are left as they are; the same name twice stays alike (nothing tells them apart).
  assert.equal(distinguishing('viewer 사용자', ['manager 사용자']), 'viewer 사용자');
  const same = fitTags([{ id: 'x', name: '같은 이름의 아주 긴 부분', width: 40, lines: 1 }, { id: 'y', name: '같은 이름의 아주 긴 부분', width: 40, lines: 1 }], measure);
  assert.equal(same.get('x').lines.join(), same.get('y').lines.join());
});

test('BV2-4 the tag\'s room: the icon gives way first; the compact type only when it gives the name a line; a lifecycle word keeps its line', () => {
  const need = (w, px) => (w < 100 ? 2 : 1);
  assert.equal(tagRoom(200, 60, need).icon, true); assert.equal(tagRoom(80, 60, need).icon, false);
  // 80 × 0.36 = 28.8px high: the 14px lines give one, the compact 13px lines two.
  const low = tagRoom(224 * 0.36, 80 * 0.36, need);
  assert.equal(low.compact, true); assert.equal(low.lines, 2);
  const roomy = tagRoom(224 * 0.6, 80 * 0.6, need);
  assert.equal(roomy.compact, false); assert.equal(roomy.kind, true, 'a line left: the kind line');
  const life = tagRoom(224 * 0.5, 80 * 0.5, () => 2, true);
  assert.equal(life.kind, true); assert.equal(life.lines, 1, 'the lifecycle word keeps the kind line');
});

test('BV2-5 two card sizes: the width never grows with a name; the tall size for a second name line beside a role; one contact row', () => {
  assert.equal(CARD_W, 224); assert.deepEqual([CARD_H, CARD_H_TALL], [80, 104]); assert.equal(CONTACT_Y, 40);
  const plain = cardTemplate(facts({ type: 'compute' })), roled = cardTemplate(facts({ type: 'compute', role: '평균을 낸다.' }));
  assert.equal(cardHeights(plain, 2).total, 80); assert.equal(cardHeights(roled, 2).total, 104);
  assert.equal(cardHeights(plain, 1).contact, cardHeights(roled, 2).contact, 'lines between a short and a tall card run straight');
  // A loop container keeps its form on request: its well is drawn when it is open (wellShown), and then grows the card.
  const steps = Array.from({ length: 5 }, (_, i) => ({ name: `s${i}`, does: null })), loop = { unit: '매 틱', stop: null, resume: null };
  const shut = cardTemplate(facts({ type: 'loop', loop, steps, wellShown: false })), shown = cardTemplate(facts({ type: 'loop', loop, steps, wellShown: true, wellOpen: true }));
  assert.equal(shut.container, true); assert.equal(shut.well, null); assert.equal(cardHeights(shut, 1).total, 80);
  assert.ok(shown.well && cardHeights(shown, 1).total > 104);
});

test('BV2-6 the built map: the face switch on the camera, the tag fit, the symbol budget and the first view at the whole map', () => {
  const src = app(), style = css();
  const cam = body(src, 'applyCamera');
  // Polish 5: the zoom's page state moved to syncZoom (applyCamera calls it; a fit calls it fresh, without hysteresis).
  assert.ok(cam.includes('syncZoom(camera.k)'));
  const zoom = body(src, 'syncZoom');
  assert.ok(zoom.includes('cardFace(k, fresh ? null : face)') && zoom.includes("'face-tag'") && zoom.includes("'face-card'"));
  assert.ok(body(src, 'renderSpace').includes('face = null'), 'a new view reads its face without hysteresis');
  const fit = body(src, 'fitCards');
  assert.ok(fit.includes('tagRoom(') && fit.includes('fitTags(') && fit.includes("'.c-tag-name'"));
  // The face never relayouts: fitCards writes only inside the boxes (no relayout, no renderSpace).
  assert.ok(!fit.includes('relayout(') && !fit.includes('renderSpace('));
  const card = body(src, 'cardEl');
  assert.ok(card.includes("class: 'c-tag'") && card.includes("'data-mark': mark"));
  // One status mark: the dot, else the loop's ↻ (a container's ↻ opens its well in place).
  assert.ok(style.includes('.space .node.card[data-mark="dot"] .c-loop-tab { display: none; }') && style.includes('.space .node.card[data-mark="loop"] .c-state { display: none; }'));
  assert.ok(card.includes('toggleWell(p.id)') && body(src, 'cardFactsOf').includes('wellShown: wellOpen.has('));
  // One decoration: the family's thin left stripe; no shadow at rest; the old far tint and family outline are gone.
  assert.ok(style.includes('.space .node.card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;'));
  assert.ok(style.includes('.space .node.card:not(.selected):not(.grp) { box-shadow: none; }'));
  assert.ok(!style.includes('.space:is(.tier-far, .tier-dots) .node.card:not(.life) { background: var(--fam-strip); }'));
  // The way in: hidden at rest, shown on hover, selection and keyboard focus (opacity, so it stays in the tab order).
  assert.ok(/\.c-go-at \{ opacity: 0; pointer-events: none; \}/.test(style) && !/\.c-go-at \{[^}]*visibility: hidden/.test(style));
  // The hover card reads what left the face: the kind rows and the inner line.
  assert.ok(body(src, 'bindEdgeHints').includes("class: 'hc-row'"));
  // A4: the first view is the whole map where its tags read (FIRST_FIT_MIN); further out its focus at OPEN_MIN.
  const fv = body(src, 'fitView') + body(src, 'frameView');
  assert.ok(/const FIRST_FIT_MIN = 0\.3\d;/.test(src) && fv.includes('fit >= FIRST_FIT_MIN'));
});
