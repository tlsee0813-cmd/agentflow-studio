// Beauty v4 review: what the v4 slice's review found, kept fixed. One stroke never covers relations whose condition, optional mark,
// timing or status differ (the ruling: a bundle is counted and never one representative over differing 조건·박자·상태); port marks read
// at full ink under 구성 (no foreground at rest) and step back to half ink only behind a lens's foreground; the boundary rule is never
// set on a line's upright run; the external tint is one value in every theme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeByChannel, relationSig } from '../dist/public/client/line-grammar.js';

const app = readFileSync(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('V4R-1 relations of one pair whose condition, optional mark or timing differ keep strokes of their own', () => {
  assert.ok(!/bundleSig/.test(app), 'no signature that keeps only the planned status');
  for (const fn of ['function grammarEdges', 'function lineGrain', 'function sumLines']) {
    const at = app.indexOf(fn); assert.ok(at >= 0, fn);
    assert.match(app.slice(at, at + 900), /sigFor\(said, notes\)/, `${fn} splits strokes by the full signature`);
  }
  const sig = { r1: relationSig({ when: 'validate_url 통과', optional: true }), r2: relationSig({ optional: true }), r3: relationSig({}), r4: relationSig({ cadence: '한 번' }), r5: relationSig({ cadence: '호출마다' }) };
  const e = (ids) => ({ key: 'a|b', from: 'a', to: 'b', kind: 'flow', notes: [], ids, agg: false });
  const out = mergeByChannel([e(['r1', 'r2', 'r3'])], () => 'data', () => null, false, id => sig[id]);
  assert.equal(out.length, 3, 'a conditional, an optional and an unconditional relation: three strokes');
  assert.equal(mergeByChannel([e(['r4', 'r5'])], () => 'data', () => null, false, id => sig[id]).length, 2, 'once and per call: two strokes');
});

test('V4R-2 port marks: full ink under 구성, half ink only behind a lens foreground, never fainter', () => {
  assert.match(app, /const bgLines = fgEnds\.size \? new Set/);
  const rules = [...css.matchAll(/\.edge-cue\.cue-bg[^{]*\{\s*opacity:\s*([\d.]+)/g)].map(m => Number(m[1]));
  assert.deepEqual(rules, [0.5], 'one rule steps a background mark back, to half ink');
  assert.ok(!/\.edge-cue\.cue-bg:not\(\.near\):not\(:hover\) \{ opacity/.test(css), 'no older rule left under it');
});

test('V4R-3 the boundary rule is never set on a line, and an external that only calls in has its rule on its own side', () => {
  const at = app.indexOf('function placeBands'), body = app.slice(at, at + 9000);
  assert.ok(!/\?\? cands\[0\]/.test(body), 'no fallback onto a line');
  assert.match(body, /rule\(left, 'l'\)/);
  assert.ok(!/:root\[data-theme="dark"\] \{ --ext-bg/.test(css), 'the external tint is one value (the cards stay light in every theme)');
});

test('V4R-4 the two lines of a pair running both ways between level cards never twist across each other at a port', async () => {
  const { routeEdges } = await import('../dist/public/client/map-route.js');
  const box = (id, x, y) => ({ id, x, y, w: 224, h: 80, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { x, y }, head: 0, face: 'unit', contact: 40, pins: {} });
  const crossings = (R) => { const segs = []; for (const r of R.values()) for (let i = 1; i < r.pts.length; i++) segs.push({ k: r.key, A: r.pts[i - 1], B: r.pts[i] });
    let c = 0; for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) { const s = segs[i], t = segs[j]; if (s.k === t.k) continue; const sh = Math.abs(s.A.y - s.B.y) < 0.5, th = Math.abs(t.A.y - t.B.y) < 0.5; if (sh === th) continue;
      const H = sh ? s : t, V = sh ? t : s; if (V.A.x > Math.min(H.A.x, H.B.x) + 0.5 && V.A.x < Math.max(H.A.x, H.B.x) - 0.5 && H.A.y > Math.min(V.A.y, V.B.y) + 0.5 && H.A.y < Math.max(V.A.y, V.B.y) - 0.5) c++; }
    return c; };
  for (const [x1, x2] of [[290, 310], [310, 290]]) {
    const boxes = new Map([['a', box('a', 0, 0)], ['b', box('b', 400, 0)]]);
    const e = (key, from, to, x) => ({ key, from, to, kind: 'flow', notes: [], ids: [key], agg: false, hint: { xs: [x], ys: [] } });
    const R = routeEdges(boxes, [e('ab', 'a', 'b', x1), e('ba', 'b', 'a', x2)]);
    assert.equal(crossings(R), 0, `tracks ${x1}/${x2}`);
  }
});
