// Restore (after polish round fixes 2; spec-cards-v2 §4 and §7 'Conditional relations'): the pane states operations again (a
// recorded state's words, else the quiet 「운영 기록 없음」 line; the map still draws nothing for it), a conditional or optional line
// keeps a tiny text-free mark on the line at the mid and far tiers (the text pills stay hidden below 가까이), and the 상태·공백
// legend says what its faded cards are. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { restCue, CUE_PX, lineBadge, badgeForms } from '../dist/public/client/line-grammar.js';
import { cuePoints, nearestOn } from '../dist/public/client/map-labels.js';
import { lensFadeNote, STATE_FADE_NOTE, lensOffTopic, NO_RECORD } from '../dist/public/client/view-lens.js';

const src = readFileSync(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const body = (name) => { const i = src.indexOf(`function ${name}(`); return src.slice(i, src.indexOf('\n}\n', i)); };
const css = readFileSync(new URL('../dist/public/styles.css', import.meta.url), 'utf8');

test('RS-1 the pane head says operations: a recorded state in kindLine, else one quiet 「운영 기록 없음」 line (no ring glyph); hidden only beside the detail view', () => {
  const ops = body('opsLineEl');
  assert.ok(ops.includes("h('p', { class: 'pane-ops-line none'") && ops.includes("'운영 기록 없음 · 이 부분의 가동·멈춤을 말한 기록이 없음'"));
  assert.ok(body('kindLine').includes('pane-state pane-ops-line st-${s.state}'), 'a recorded state reads in its words');
  // Muted, an en dash before it: never the ring that is the map's 대기 dot.
  assert.match(css, /\.pane-ops-line\.none \{[^}]*color: var\(--text-3\)/);
  assert.match(css, /\.pane-ops-line\.none::before \{ content: '–';/);
  assert.ok(!/\.pane-ops-line\.none::before \{[^}]*border-radius: 50%/.test(css));
  assert.ok(css.includes('.space.detail-open .pane-ops-line.none { display: none; }'));
  // The ladder chips stay in 근거 (polish round fixes 2), not back in the head.
  assert.ok(!body('kindLine').includes('ladderLine(') && body('evidenceTab').includes('ladderLine(o.view, part)'));
  // The map itself still draws no 「운영 기록 없음」 (the card's ops word for it stays hidden under the 상태·공백 lens too).
  assert.ok(css.includes('.space.lens-state .node.card .c-opsw.ops-none { display: none; }'));
});

test('RS-2 a conditional or optional line carries a text-free mark at the mid, far and dot tiers; the pill at 가까이 or picked', () => {
  const cond = lineBadge([{ when: '캐시 없음', mode: 'design' }]), opt = lineBadge([{ optional: true }]), cad = lineBadge([{ cadence: '매일 00:30Z' }]);
  assert.equal(cond.kind, 'condition'); assert.equal(opt.kind, 'optional');
  for (const tier of ['mid', 'far', 'dots']) {
    assert.equal(restCue(cond, false, tier), 'condition', `condition at ${tier}`);
    assert.equal(restCue(opt, false, tier), 'optional', `선택 at ${tier}`);
    assert.equal(restCue(cad, false, tier), null, 'a cadence word is no condition');
  }
  // 가까이 or a picked line: the pill with its words, no mark.
  assert.equal(restCue(cond, false, 'near'), null); assert.equal(restCue(cond, true, 'mid'), null);
  assert.ok(badgeForms(cond, false, 'near').includes('조건'));
  // A bundle only partly conditional is still marked (its tip says 1/3).
  assert.equal(restCue(lineBadge([{ when: 'a' }, {}, {}]), false, 'mid'), 'condition');
  assert.equal(CUE_PX, 8);
  // The app draws it whenever the pill is skipped below 가까이, under every lens (시작·반복 included: nothing lens-gated).
  const pb = body('placeBadges');
  assert.match(pb, /if \(!on && tier !== 'near'\) \{ const cue = restCue\(b, on, tier\); if \(cue\) placeCue\(/);
  assert.ok(!/viewLens/.test(body('placeCue')), 'no lens turns the mark off');
  assert.ok(body('placeCue').includes("class: `edge-cue q-${cue}") && body('placeCue').includes("'data-cue': e.key"));
  // Text-free: the element carries no words of its own (the tip has them), and it joins the line's hover, pick and legend marks.
  assert.ok(!/h\('span', \{ class: `edge-cue[^)]*\), ['"`]/.test(body('placeCue')));
  assert.ok(src.includes(".edge-labels > [data-once], .edge-labels > [data-cue]'") && src.includes('lab.dataset.cue'));
  assert.ok(src.includes(".edge-labels > [data-cue=\"${CSS.escape(key)}\"]`).forEach(el => el.classList.add('near'))"));
  assert.ok(src.includes(".edge-cue[data-cue=\"${k}\"]`"), 'the legend dims and picks it with its line');
  assert.ok(src.includes("el.classList.contains('edge-cue')"), 'pointed at, the tip reads the condition\'s words');
  assert.match(css, /\.edge-labels > \.edge-cue \{ position: absolute; width: 8px; height: 8px; pointer-events: auto;[^}]*transform: scale\(var\(--inv, 1\)\)/);
  assert.match(css, /\.edge-cue\.q-condition::before \{[^}]*transform: rotate\(45deg\)/);
  assert.match(css, /\.edge-cue\.q-optional::before \{[^}]*dashed[^}]*border-radius: 50%/);
});

test('RS-3 the mark sits ON the line: its places are points of the polyline, the first runs from the start first', () => {
  const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 160 }, { x: 400, y: 160 }];
  const ps = cuePoints(pts, 12);
  assert.ok(ps.length > 0);
  for (const p of ps) { const q = nearestOn(pts, p); assert.ok(Math.hypot(q.x - p.x, q.y - p.y) < 1e-6, JSON.stringify(p)); }
  assert.equal(ps[0].y, 0, 'the first run from the port first');
  // A vertical run's places are on its x, not beside it.
  const v = cuePoints([{ x: 50, y: 0 }, { x: 50, y: 300 }], 12);
  assert.ok(v.length && v.every(p => p.x === 50));
  assert.equal(nearestOn([{ x: 0, y: 0 }], { x: 1, y: 1 }), null);
});

test('RS-4 the 상태·공백 legend says what its faded cards are, in plain words, open and folded', () => {
  assert.equal(STATE_FADE_NOTE, '흐린 카드: 운영 상태를 말한 기록이 없음');
  const P = (id, short) => ({ id, family: 'process', type: null, short, loop: false, unlinked: false, unmapped: 0 });
  const faded = lensOffTopic('state', [P('a', '가동 보고'), P('b', NO_RECORD), P('c', NO_RECORD)], []).size;
  const n = lensFadeNote('state', faded);
  assert.equal(n.text, '흐린 카드: 운영 상태를 말한 기록이 없음 · 2개');
  assert.match(n.tip, /멈춤이라는 뜻이 아님/);
  assert.equal(lensFadeNote('state', 0), null, 'nothing faded: no line');
  assert.equal(lensFadeNote('compose', 3), null, 'the other lenses fade nothing for this reason');
  const rl = body('renderLegend');
  assert.ok(rl.includes('lensFadeNote(viewLens, lensOffTopic(viewLens, lensPartsOf(o), lensLinesOf()).size)'));
  assert.ok(rl.includes('fadeEl(true)') && rl.includes('fadeEl(false)'), 'the folded chip and the open legend both say it');
  assert.ok(css.includes('.lg-fade-note {') && css.includes('.lg-chip-fade {'));
});
