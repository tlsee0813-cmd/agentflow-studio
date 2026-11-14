// v14 A (spec 1, 2, 4): the landed map is the clear state (the main flow lit, the rest quiet and whole), every name whole at every width
// (the tag never cuts a name at its start or inside a word; the first view never lands where a tag cannot hold a name), and one opening for
// every map (it grows from cards; the skip hint on every opening). Each test fails on v13 (the module, the rules and the hooks are new).
// Fictional strings only. No browser: the pure parts run as built; the DOM wiring is read from the source (the frames are shot by this
// round's headless kit).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as O from '../dist/public/client/opening.js';
import * as T from '../dist/public/client/name-tag.js';
import * as C from '../dist/public/client/clear-rest.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf('\n}\n', i)); };
// Hangul 12, the ellipsis 9, anything else 7 (as growth-v12's measure).
const measure = s => [...s].reduce((n, c) => n + (/[ㄱ-힝]/.test(c) ? 12 : c === '…' ? 9 : c === '⋯' ? 9 : 7), 0);
const bare = s => s.replace(/\s+/g, '');

/* ---------- spec 2: whole names ---------- */
test('V14A-1 a tag never cuts a name at its start or inside a word: whole, whole smaller, first whole words, one whole word, 「⋯」', async () => {
  // Whole at the tag's type.
  assert.deepEqual(T.fitTag('워커', 80, 2, measure), { lines: ['워커'], full: true });
  // v13 drew 「…래스터 / 파서」 (its start left out): now the name whole at a smaller type (down to WHOLE_MIN_PX), never its end alone.
  const r = T.fitTag('Rasterkit 래스터 파서', 64, 2, measure, 12.5);
  assert.equal(r.full, true); assert.ok(r.scale < 1 && r.scale * 12.5 >= T.WHOLE_MIN_PX - 1e-9, `${r.scale}`);
  assert.equal(bare(r.lines.join('')), bare('Rasterkit 래스터 파서'));
  // Too long for that: its first whole words with 「…」 after them, never 「…tail」, never a word cut.
  const long = T.fitTag('보관소를 읽어 조건을 확인하고 주문을 요청하는 감시 루프', 70, 2, measure);
  assert.equal(long.full, false); assert.ok(long.lines.at(-1).endsWith('…') && !long.lines[0].startsWith('…'));
  assert.ok('보관소를 읽어 조건을 확인하고 주문을 요청하는 감시 루프'.startsWith(bare(long.lines.join('')).replace(/…$/, '').slice(0, 3)));
  // v13 drew 「tinypoem…」 and 「…데이터」: one word wider than every line stays whole at a smaller type (down to WORD_MIN_PX).
  const one = T.fitTag('tinypoemsampler', 90, 2, measure, 12.5);
  assert.deepEqual(one.lines, ['tinypoemsampler']); assert.equal(one.full, true); assert.ok(one.scale * 12.5 >= T.WORD_MIN_PX - 1e-9);
  const lead = T.fitTag('tinypoemsampler 데이터 묶음 파일', 96, 1, measure, 12.5);
  assert.ok(lead.lines[0].startsWith('tinypoemsampler'), lead.lines.join('|')); assert.equal(lead.full, false);
  // An identifier's words are one word for leaving out (never 「Flash…」 of 「FlashHouse」), though a line may still break where they meet.
  const ch = T.fitTag('FlashHouse 보관소 묶음', 40, 1, measure, 12.5);
  assert.ok(!/^Flash…/.test(ch.lines[0]), ch.lines.join('|'));
  assert.deepEqual(T.nameWords('FlashHouse 보관소·묶음 (Relayer)'), ['FlashHouse ', '보관소·', '묶음 ', '(Relayer)']);
  // A file name breaks before its extension only when nothing else keeps it whole; a first word may take the tag's side room (tight).
  const file = T.fitTag('presetloader.py', 70, 2, measure, 12.5);
  assert.equal(file.full, true); assert.deepEqual(file.lines, ['presetloader', '.py']);
  assert.deepEqual(T.fitTag('train.py', 90, 2, measure, 12.5).lines, ['train.py'], 'never broken when it fits');
  const tight = T.fitTag('tinypoemsampler', 80, 1, measure, 12.5, 6);
  assert.equal(tight.tight, true); assert.deepEqual(tight.lines, ['tinypoemsampler']);
  assert.match(fn(await app(), 'fitCards'), /slack: Math\.max\(0, w - 4 - room\.width\)/);
  // Nothing whole fits: 「⋯」 alone (the name in the card's hover and keyboard name).
  assert.deepEqual(T.fitTag('GrainStore', 20, 1, measure, 12.5), { lines: ['⋯'], full: false, none: true });
  // Whatever the room: what stands before 「…」 ends where a word of the name ends, and nothing starts with 「…」.
  for (const name of ['문서 소비기(Consumer)', 'Rasterkit 래스터 파서', '집 서버 FTP 수신 위치', '질의·쓰기 분배 계층', 'Updaterbot', 'trail-hopper 따라가기'])
    for (const w of [24, 40, 56, 70, 90]) for (const n of [1, 2]) {
      const f = T.fitTag(name, w, n, measure, 12.5), t = f.lines.join('');
      assert.ok(!t.startsWith('…'), `${name} ${w} ${n}: ${t}`);
      if (f.none) continue;
      const head = bare(t).replace(/…$/, '');
      assert.ok(bare(name).startsWith(head), `${name}: ${t}`);
      if (!f.full) { const words = T.nameWords(name); let acc = ''; const ends = new Set(words.map(x => (acc += x, bare(acc).replace(/[·/,]+$/, '')))); assert.ok(ends.has(head), `${name} ${w} ${n}: cut inside a word: ${f.lines.join('|')}`); }
      if (f.scale) assert.ok(f.scale * 12.5 >= T.WORD_MIN_PX - 1e-9);
    }
});

test('V14A-2 alike cut names are never told apart by a middle cut; the page draws a smaller type and 「⋯」 as fitTag says', async () => {
  const a = 'Barn Owl datasets openpages(외부)', b = 'Barn Owl transformers weights 가중치(외부)';
  const out = T.fitTags([{ id: 'a', name: a, width: 90, lines: 1 }, { id: 'b', name: b, width: 90, lines: 1 }], measure);
  for (const k of ['a', 'b']) { const t = out.get(k).lines.join(''); assert.ok(!/.…./.test(t), `${k}: ${t}`); assert.ok(!t.startsWith('…')); }
  const fc = fn(await app(), 'fitCards');
  assert.match(fc, /px: room\.compact \? TAG_COMPACT\.name : TAG\.name/);
  assert.match(fc, /if \(f\.scale && f\.scale < 1\) tn\.style\.setProperty\('font-size', `calc\(\$\{\(x\.px \* f\.scale\)\.toFixed\(2\)\}px \* var\(--u, 1\)\)`\); else tn\.style\.removeProperty\('font-size'\);/);
  assert.match(fc, /x\.el\.classList\.toggle\('tag-none', !!f\.none\);/);
});

test('V14A-3 the first view never lands under FIRST_FIT_MIN: a map too large opens on its focus, its sides between the cards, the title pan only with the focus', async () => {
  const a = await app(), fv = fn(a, 'frameView'), lk = fn(a, 'landK'), sf = fn(a, 'sideFrame'), tp = fn(a, 'titlePanKeeps');
  assert.match(fv, /const k = landK\(explicit, fit, k0, f, w, hgt\), onFocus = !explicit && !!f && k > fit \+ 1e-6;/);
  assert.match(fv, /if \(f && \(k >= OPEN_MIN \|\| onFocus\) && \(B\.w \* k > w \|\| B\.h \* k > hgt\)\) \{/);
  assert.match(fv, /const sd = onFocus \? sideFrame\(k, B, f, left, w\) : null, kk = sd\?\.k \?\? k;/);
  assert.match(lk, /if \(explicit \|\| !f \|\| fit >= FIRST_FIT_MIN \|\| k >= FIRST_FIT_MIN\) return k;/);
  assert.match(lk, /return Math\.max\(FIRST_FIT_MIN, Math\.min\(OPEN_MIN, w \/ Math\.max\(1, f\.w \+ 16\), hgt \/ Math\.max\(1, f\.h \+ 16\)\)\);/);
  assert.match(sf, /for \(let kk = k; kk >= FIRST_FIT_MIN - 1e-9; kk -= 0\.005\)/);
  assert.match(sf, /return z <= 0 \|\| a >= vpw \|\| \(a >= 0 && z <= vpw\);/, 'each card wholly in the window or wholly out of it');
  assert.match(tp, /return fs\.x \+ dx >= 0 && fs\.x \+ fs\.w \+ dx <= vw;/);
  assert.equal((a.match(/titlePanKeeps\(16 - (?:s|ti)\.x\)/g) ?? []).length, 2, 'both title pans ask first');
  // After the fit's last pans (the title, the focus over the tools): a side that still cuts a card pans or zooms out a little (never 전체 보기's).
  const fit = fn(a, 'fitView'), sc = fn(a, 'sidesClear');
  assert.match(fit, /  if \(!at\.whole\) focusOverDock\(\);\n  if \(!explicit\) sidesClear\(\);[^\n]*\n  if \(pairRoute\(explicit, animate\)\) return;/);
  assert.match(sc, /if \(!vpw \|\| !cutAt\(camera\.x, k0\)\) return;/, 'a frame with no cut is left as it is');
  assert.match(sc, /for \(let k = k0; k >= Math\.min\(k0, FIRST_FIT_MIN\) - 1e-9; k -= 0\.005\)/);
});

/* ---------- spec 1: the clear state ---------- */
test('V14A-4 the clear state\'s words, count and per-project choice', () => {
  const on = C.clearCaption(true, 34, 'summary');
  assert.equal(on.text, '진하게: 기록이 말한 주 흐름 · 다른 연결 34개는 옅게'); assert.equal(on.button, '모두 진하게');
  assert.equal(C.clearCaption(true, 0, 'entry').text, '진하게: 기록된 시작과 거기서 나가는 연결');
  const off = C.clearCaption(false, 34, 'summary'); assert.equal(off.button, '주 흐름만 진하게');
  // Relations, not strokes: a summary line holding three counts three; a relation also on a lit line is not quiet.
  assert.equal(C.quietCount([{ ids: ['r1'], lit: true }, { ids: ['r2', 'r3', 'r4'], lit: false }, { ids: ['r1', 'r5'], lit: false }]), 4);
  assert.equal(C.clearOn(true, false), true); assert.equal(C.clearOn(true, true), false); assert.equal(C.clearOn(false, false), false, 'no main flow: normal strength');
  const store = new Map(), get = k => store.get(k) ?? null, set = (k, v) => store.set(k, v);
  assert.equal(C.allStrongFor(C.readStrong(get), 'p1'), false);
  C.keepStrong(get, set, 'p1', true); assert.equal(C.allStrongFor(C.readStrong(get), 'p1'), true); assert.equal(C.allStrongFor(C.readStrong(get), 'p2'), false);
  C.keepStrong(get, set, 'p1', false); assert.equal(C.allStrongFor(C.readStrong(get), 'p1'), false);
  assert.doesNotThrow(() => C.keepStrong(() => { throw new Error('blocked'); }, () => { throw new Error('blocked'); }, 'p1', true));
  assert.deepEqual(C.readStrong(() => '[1]'), {});
});

test('V14A-5 the wiring: cl-on at rest with a lit flow, the caption under the switcher, the choice kept per project', async () => {
  const a = await app();
  assert.match(fn(a, 'syncLineMode'), /sp\.classList\.toggle\('cl-on', clearOn\(ff && !selected && !planView\.isOpen\(\) && !ffLensPicked && !scView && !growthCmp && !growthPast && !!ffShown\(\), allStrong\(\)\)\);/);
  assert.match(fn(a, 'renderFocusTop'), /el\.replaceChildren\(\.\.\.\[sentence, row, clearRow\(f\), basis, fullPanel\(\)\]/);
  const cr = fn(a, 'clearRow');
  assert.match(cr, /if \(!c \|\| scView \|\| growthCmp \|\| growthPast \|\| !sp\.classList\.contains\('ff-rest'\) \|\| ffLensPicked \|\| !ffActive\(\)\) return null;/);
  assert.match(cr, /onclick: \(\) => chooseStrong\(on\)/);
  assert.match(fn(a, 'chooseStrong'), /if \(st\) keepStrong\(st\.get, st\.set, o\.key, on\);\n  syncLineMode\(\); renderFocusTop\(\);/);
});

// WCAG contrast from the tokens the rules use (as V13-9).
const hex = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (x, y) => { const [p, q] = [lum(x), lum(y)].sort((m, n) => n - m); return (p + 0.05) / (q + 0.05); };
const mix = (x, y, p) => x.map((v, i) => Math.round(v * p + y[i] * (1 - p)));
const saturate = ([r, g, b], s) => [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]
  .reduce((out, k, i) => { out[Math.floor(i / 3)] += k * [r, g, b][i % 3]; return out; }, [0, 0, 0]).map(v => Math.max(0, Math.min(255, Math.round(v))));

test('V14A-6 the quiet rest: cards whole at 4.5:1 or more, lines thin at a third, verb labels to the hover, conditions kept', async () => {
  const s = await css(), v14 = s.slice(s.indexOf('/* ---------- v14 A (landing, names, opening)')); assert.ok(v14.length > 100);
  const card = /#space\.cl-on:not\(\.lt-sel\) #world > \.node:not\(\.ff-card\):not\(\.ff-start\)[^{]*:not\(:hover\):not\(:focus-visible\) \{ ([^}]*) \}/.exec(v14);
  assert.ok(card, 'the quiet card rule'); assert.doesNotMatch(card[1], /opacity|(?:^|; )color:/, 'never an opacity or a text colour on the card');
  assert.match(card[1], /filter: saturate\(\.5\); background-color: color-mix\(in srgb, var\(--surface\) 45%, var\(--bg\)\);/);
  const root = s.slice(s.indexOf(':root'), s.indexOf('}', s.indexOf(':root'))), tok = n => hex(new RegExp(`--${n}: (#[0-9a-f]{6})`, 'i').exec(root)[1]);
  const quiet = mix(tok('surface'), tok('bg'), 0.45);
  for (const t of ['text', 'text-2', 'text-3', 'text-4']) { const r = ratio(saturate(tok(t), 0.5), saturate(quiet, 0.5)); assert.ok(r >= 4.5, `--${t} ${r.toFixed(2)}`); }
  for (const f of ['participant', 'process', 'store', 'trigger', 'neutral']) { const r = ratio(saturate(tok(`fam-${f}-ink`), 0.5), saturate(quiet, 0.5)); assert.ok(r >= 4.5, `${f} ${r.toFixed(2)}`); }
  assert.match(v14, /#space\.cl-on #world \.edge:not\(\.ff-flow\):not\(\.ff-ctx\):not\(\.on\):not\(\.near\)[^{]*\{ --bw: 1; \}/);
  assert.match(v14, /#space\.cl-on #world \.edge:not\(\.ff-flow\):not\(\.ff-ctx\):not\(\.on\):not\(\.near\)[^{]*\.edge-line \{ opacity: \.35; \}/);
  assert.match(v14, /#space\.cl-on #world \.edge-labels > :is\(\.edge-label:not\(\.fit-cond\), \.edge-count\):not\(\.ff-keep\):not\(\.near\):not\(:hover\):not\(:focus-visible\) \{ visibility: hidden; \}/, 'a condition\'s words stay');
  assert.doesNotMatch(v14, /cl-on[^{]*\{[^}]*display: none/, 'nothing of the rest folded or hidden');
  assert.match(v14, /#space\.cl-on #world \.edge-labels > :not\(\.ff-keep\):not\(\.edge-cue\):not\(\.edge-label\):not\(\.near\):not\(:hover\) \{ opacity: 1; \}/, 'a badge on a quiet line keeps its words at 4.5:1 (v12 gave it .6)');
  assert.match(v14, /#space:not\(\.ff-rest\) \.focus-top \.ft-clear \{ display: none; \}/, 'a pick lights its own neighbourhood instead');
});

/* ---------- spec 4: one opening ---------- */
const boxes = [{ id: 'kitchen', container: null }, { id: 'oven', container: 'kitchen' }, { id: 'mixer', container: 'kitchen' }, { id: 'till', container: null }, { id: 'shelf', container: null }, { id: 'courier', container: null }];
const edges = [{ key: 'e1', ids: ['r1'], from: 'mixer', to: 'oven' }, { key: 'e2', ids: ['r2'], from: 'oven', to: 'shelf' }, { key: 'e3', ids: ['r3'], from: 'till', to: 'courier' }, { key: 'e4', ids: ['r9'], from: 'shelf', to: 'till' }];
const drawn = new Set(boxes.map(b => b.id));
const base = { boxes, edges, rep: id => (drawn.has(id) ? id : null), names: new Map(), versions: [], chain: null, chainRels: [], order: ['till', 'courier', 'kitchen', 'mixer', 'oven', 'shelf'] };

test('V14A-7 no recorded order but a lit main flow: the flow grows first in its lines\' direction, then the rest by the record\'s order', () => {
  const p = O.openingPlan({ ...base, flow: [['mixer'], ['oven']], flowLines: ['e1'] });
  assert.equal(p.kind, 'flow');
  assert.deepEqual(new Set(p.beats[0].show), new Set(['mixer', 'kitchen'])); assert.deepEqual(p.beats[0].lines, []);
  assert.deepEqual(p.beats[1].lines, ['e1'], 'the flow\'s line once both ends are there');
  assert.ok(p.beats.every(b => b.caption === O.FLOW_CAPTION));
  const rest = p.beats.slice(2); assert.ok(rest.length >= 1 && rest.length <= O.REST_BEATS);
  assert.ok(rest[0].show.includes('till'), 'the rest by the record\'s order: till first');
  assert.deepEqual(new Set(p.beats.at(-1).show), drawn); assert.deepEqual(new Set(p.beats.at(-1).lines), new Set(edges.map(e => e.key)));
  assert.ok(rest.every(b => b.ms === O.REST_STEP_MS));
  assert.ok(rest.every(b => b.dim.every(id => !['mixer', 'kitchen', 'oven'].includes(id))), 'the rest receded, the flow lit');
  for (const b of rest) assert.deepEqual(b.dimLines, b.lines.filter(k => k !== 'e1'), 'on every beat of the rest, its lines too (never full, then receded)');
  // The landed map is the clear state: the rest comes in quiet as it stays (never receded, then brought up).
  const q = O.openingPlan({ ...base, flow: [['mixer'], ['oven']], flowLines: ['e1'], quiet: true });
  assert.ok(q.beats.every(b => !b.dim || !b.dim.length) && q.beats.every(b => !b.dimLines || !b.dimLines.length));
});

test('V14A-8 neither: the cards grow in the record\'s order (never the whole map faded in at once); a chain\'s rest by that order too', () => {
  const p = O.openingPlan(base);
  assert.equal(p.kind, 'order'); assert.ok(p.beats.length >= 2, 'grows, not one fade');
  assert.deepEqual(p.beats[0].show.slice(0, 1), ['till']);
  assert.ok(p.beats.every(b => b.caption === O.ORDER_CAPTION && !b.dim));
  for (const b of p.beats.slice(0, -1)) for (const k of b.lines) { const e = edges.find(x => x.key === k); assert.ok(b.show.includes(e.from) && b.show.includes(e.to), `${k} before its cards`); }
  assert.deepEqual(new Set(p.beats.at(-1).show), drawn);
  assert.ok(p.end - O.OPEN_START_MS <= O.ORDER_MAX_MS + O.ORDER_STEP_MIN_MS);
  assert.deepEqual(O.recordOrder({ boxes, order: ['shelf', 'ghost', 'till'] }), ['shelf', 'till', 'kitchen', 'oven', 'mixer', 'courier']);
  // A recorded chain: its steps, then the rest by the record's order in a few beats.
  const c = O.openingPlan({ ...base, chain: [['mixer'], ['oven'], ['shelf']], chainRels: ['r1', 'r2'] });
  assert.equal(c.kind, 'chain');
  assert.deepEqual(c.beats.slice(0, 3).map(b => b.lines.length), [0, 1, 2]);
  assert.ok(c.beats[3].show.includes('till') && c.beats[3].caption === O.CHAIN_CAPTION);
  assert.deepEqual(new Set(c.beats.at(-1).show), drawn);
});

test('V14A-9 every opening says what it shows and how to skip it, for its first 1.5 s', async () => {
  assert.equal(O.SKIP_HINT, '아무 키나 누르면 바로 보기'); assert.equal(O.SKIP_HINT_MS, 1500);
  const src = await readFile(new URL('../src/client/opening.ts', import.meta.url), 'utf8');
  assert.match(src, /buildStrip\(plan\); \/\/ v14 A/); assert.doesNotMatch(src, /if \(plan\.kind !== 'fade'\) buildStrip/);
  assert.match(src, /skip\.textContent = SKIP_HINT;/);
  assert.match(src, /window\.setTimeout\(\(\) => skip\.classList\.add\('op-skip-gone'\), SKIP_HINT_MS\)/);
  assert.match(await css(), /\.op-skip\.op-skip-gone \{ opacity: 0; \}/);
  // The page gives the opening the record's order, the lit flow and the clear state.
  const a = await app();
  assert.match(a, /const order = \[\.\.\.new Set\(o\.view\.parts\.map\(p => drawnRep\(o, p\.id\)\)\.filter\(\(x\): x is string => !!x\)\)\];/);
  assert.match(a, /chainRels, order, flow, flowLines, quiet: \$\('space'\)\.classList\.contains\('cl-on'\) \};/);
});
