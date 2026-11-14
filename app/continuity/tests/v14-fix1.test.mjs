// v14 fix 1: the defects the verify round of v14-merged found (a 보기 switch or a new window landing under the bars, the sentence lost, names
// cut or broken where an identifier's capitals meet, the lit flow with no words, the opening growing another chain, release bots drawn as
// people, the chip and the top box over the map's words, 흐름 framed off its row's start, a basis line cut). Each test fails on v14-merged.
// Fictional strings only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from '../dist/public/client/name-tag.js';
import * as S from '../dist/public/client/map-shape.js';
import * as O from '../dist/public/client/opening.js';
import { cleanViewState } from '../dist/public/shared/storage.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf('\n}\n', i)); };
// Hangul 12, the ellipsis 9, anything else 7.
const measure = s => [...s].reduce((n, c) => n + (/[ㄱ-힝]/.test(c) ? 12 : c === '…' || c === '⋯' ? 9 : 7), 0);

test('V14F1-1 a camera the fit set is the fit of its own window: another window fits the map again (a frame the person chose keeps the quarter)', async () => {
  const a = await app();
  // The kept camera says whether the fit set it; the stored view keeps that word (and nothing else new).
  assert.deepEqual(cleanViewState({ folds: {}, cameras: { '': { x: 1, y: 2, scale: 0.5, win: [1440, 900], fit: true } } }).cameras[''], { x: 1, y: 2, scale: 0.5, win: [1440, 900], fit: true });
  assert.deepEqual(cleanViewState({ folds: {}, cameras: { '': { x: 1, y: 2, scale: 0.5, win: [1440, 900], fit: 'yes' } } }).cameras[''], { x: 1, y: 2, scale: 0.5, win: [1440, 900] });
  assert.match(a, /const sameWindow = \(win\?: \[number, number\], fit\?: boolean\) => !win \|\| \(fit \? Math\.abs\(win\[0\] - window\.innerWidth\) <= FIT_WIN_PX && Math\.abs\(win\[1\] - window\.innerHeight\) <= FIT_WIN_PX/);
  assert.match(a, /const FIT_WIN_PX = 2;/);
  // Restored only as the window it was fitted in; every way the camera is kept says whether it is still the fit's.
  assert.match(a, /saved = kept && sameWindow\(kept\.win, kept\.fit\) \? kept : undefined;/);
  assert.ok(!/cameras\.set\(camKey\(opened, scope\), \{ \.\.\.camera, win: winSize\(\) \}\)/.test(a), 'every kept camera goes through keptCamera');
  assert.match(fn(a, 'flushView'), /cameras\.set\(camKey\(o, scope\), keptCamera\(\)\)/);
  // The fit marks the camera it set (both of its ways out).
  const fv = fn(a, 'fitView');
  assert.match(fv, /if \(pairRoute\(explicit, animate\)\) return; fitCam = \{ \.\.\.camera \}; applyCamera\(animate\); return; \}/);
  assert.match(fv, /fitCam = \{ \.\.\.camera \}; \/\/ v14 fix 1\n  applyCamera\(animate\);/);
});

test('V14F1-2 a frame on the flow keeps the top box\'s room above the map when one exists down to FIRST_FIT_MIN (the sentence is not lost)', async () => {
  const a = await app(), fv = fn(a, 'fitView'), sa = fn(a, 'sentenceAbove');
  assert.match(fv, /if \(!done && !at\.whole && !explicit\) \{ above = sentenceAbove\(clear, inkAt\); done = above; \}/);
  // The flow's own pan over the tools (which took the room back) runs only without it.
  assert.match(fv, /if \(!at\.whole && !above\) focusOverDock\(\);/);
  assert.match(sa, /for \(let k = cam0\.k; k >= FIRST_FIT_MIN - 1e-9; k -= SENTENCE_STEP\)/);
  assert.match(sa, /for \(const form of FT_SAID\)/);
  assert.match(sa, /const ny = r\.y \+ r\.h \+ 6 - Math\.min\(\.\.\.tops\) \* k; still = Math\.abs\(ny - y\) < 1; y = ny;/);
  assert.match(sa, /if \(!still \|\| y \+ \(f\.y \+ f\.h\) \* k > dock\) continue;/);
  assert.match(sa, /camera = cam0;\n  return false;/);
  // The box measured in a form puts back the switcher's words for the form it stands in (they wrapped 22px taller than measured).
  assert.match(fn(a, 'ftBox'), /el\.classList\.remove\(\.\.\.FT_FORMS\); el\.classList\.add\(\.\.\.was\); el\.style\.left = left; el\.style\.maxWidth = maxW;\n[^\n]*\n[^\n]*\n  fitSwitch\(el\);/);
  // A box that grew after the fit (its rest caption came after the opening) and now covers the map: fitted again, once per frame.
  const rf = fn(a, 'refitUnderBox');
  assert.match(a, /landed: \(\) => \{ applyCamera\(\); requestAnimationFrame\(refitUnderBox\);[^}]*\}/); // v14 fix 2: and a later look at the tools
  assert.match(rf, /boxWatch = new ResizeObserver\(/);
  assert.match(rf, /if \(!o \|\| !el \|\| !ftShown\(\) \|\| !isFitCam\(\) \|\| opening\.running\(\) \|\| formFlight \|\| formSwitching/);
  assert.match(rf, /if \(sig === refitFrom\) return;/);
  assert.match(rf, /refitFrom = sig; fitView\(false\);/);
  // A frame on the flow at FOCUS_OPEN_K (not OPEN_MIN): more of the map round the flow, every name whole there.
  assert.match(a, /const FOCUS_OPEN_K = 0\.45;/);
  assert.match(fn(a, 'frameView'), /\? Math\.max\(FIT_MIN, fit\) : Math\.max\(FOCUS_OPEN_K, fit\);/);
  // The box beside the map's title only where it holds a sentence there.
  assert.match(fn(a, 'ftPlace'), /if \(!sent\.hidden && sent\.textContent\) return;\n  el\.style\.left = ''; el\.style\.maxWidth = ''; ftIntro\(el, sent\);/);
});

test('V14F1-3 what stands at the bottom: the chip beside the guide line on one row, the map faded out up to the top of all of it', async () => {
  const a = await app(), c = await css(), pd = fn(a, 'placeDock');
  assert.match(pd, /key!\.dataset\.beside = '1'; key!\.style\.left = `\$\{ctl\.offsetLeft \+ fvW \+ 8\}px`;/);
  assert.match(pd, /space\.style\.setProperty\('--dock-h', `\$\{Math\.max\(0, Math\.round\(sb - Math\.min\(\.\.\.tops\)\)\)\}px`\)/);
  assert.match(a, /return k\?\.dataset\.beside \? Math\.max\(fvH, kH\) : fvH \+ kH;/);
  const tail = c.slice(c.indexOf('---------- v14 fix 1 ----------'));
  assert.match(tail, /\.space:not\(\.cmp-foot\) > \.viewport \{ -webkit-mask-image: linear-gradient\(to bottom, #000 calc\(100% - var\(--dock-h, 58px\) - 12px\), transparent calc\(100% - var\(--dock-h, 58px\) \+ 2px\)\);/); // v14 fix 2: the short fade
});

test('V14F1-4 the title chip never stands over a lane\'s words; the top box like the chip for the labels and marks (a condition slides clear of it)', async () => {
  const a = await app();
  assert.match(fn(a, 'updateSticky'), /\$\('world'\)\.querySelectorAll<HTMLElement>\(':scope > \.form-lane:not\(\[hidden\]\) \.form-lane-word'\)/);
  const ce = fn(a, 'clipAtEdge');
  assert.match(ce, /const fb = document\.getElementById\('focus-top'\), fr0 = fb && !fb\.hidden && fb\.offsetWidth \? fb\.getBoundingClientRect\(\) : null;/);
  assert.match(ce, /\|\| sr\.some\(q => r\.left < q\.right && q\.left < r\.right && r\.top < q\.bottom && q\.top < r\.bottom\);/);
  assert.match(fn(a, 'slideMark'), /if \(sr\.some\(q => hits\(box, q\)\)\) continue;/);
  // Looked at again whenever the box takes its form (its last row came after the marks were looked at).
  assert.match(fn(a, 'syncFocusTop'), /\n  clipAtEdge\(\);$/);
  // What stands at the bottom as well: marks under it slide or step back, a lane's words under it step back (its tip keeps them).
  assert.match(ce, /const sr = \[sr0, fr0, \.\.\.dock\]\.filter\(\(x\): x is DOMRect => !!x\);/);
  assert.match(ce, /lw\.classList\.toggle\('lane-cut', q\.width > 0 && dock\.some\(/);
  assert.match(await css(), /\.form-lane \.form-lane-word\.lane-cut \{ visibility: hidden; \}/);
  // And again where a 보기 switch's camera settles.
  assert.match(fn(a, 'landFormFlight'), /world\.classList\.remove\('animate', 'form-cam'\); clipAtEdge\(\); \}, FORM_SETTLE_MS\)/);
});

test('V14F1-5 a name never breaks where an identifier\'s capitals meet while anything else keeps it; a name ending in a bracket reads its own words whole (gloss), the side room before that', () => {
  // 「Postgre|SQL」, 「GPT|Researcher」, 「Pocket|Base」 at rest in v14: an identifier is one word; a run of capitals never breaks at all.
  for (const [name, w] of [['PostgreSQL 저장소', 60], ['GPTResearcher', 70], ['런처(PocketBase)', 56], ['ReadWriteProxy·압축 워커', 64], ['PostgreSQL', 40]]) {
    for (const n of [1, 2, 3]) {
      const joined = T.fitTag(name, w, n, measure, 12.5, 10).lines.join('|');
      assert.ok(!/Postgre\|SQL|GPT\|Researcher|Pocket\|Base/.test(joined), `${name} ${w} ${n}: ${joined}`);
    }
  }
  // Where the side room holds it whole, never broken there either.
  assert.deepEqual(T.fitTag('ReadWriteProxy·압축 워커', 64, 2, measure, 12.5, 24).lines, ['ReadWriteProxy·', '압축 워커']);
  // Only when nothing else gives the name, a break where a lower-case run meets a capitalised word (never 「⋯」 for 「WebSocketManager·run_agent」).
  const ws = T.fitTag('WebSocketManager·run_agent', 72, 3, measure, 12.5);
  assert.notEqual(ws.lines[0], '⋯'); assert.equal(ws.full, true); assert.match(ws.lines.join('|'), /^WebSocket\|Manager·/);
  // Narrower still: the first of two names joined by 「·」, whole, as its gloss (at 1280 and 780 it read 「⋯」).
  const ws2 = T.fitTag('WebSocketManager·run_agent', 60, 2, measure, 12.5);
  assert.deepEqual(ws2.lines, ['WebSocket', 'Manager']); assert.equal(ws2.gloss, true);
  // The bracket's words are the name's gloss: its own words whole, no 「…」 (the card's hover has the rest; the tag's dotted underline says so).
  assert.equal(T.glossHead('정기 일정(alpha_q 일정표)'), '정기 일정');
  assert.equal(T.glossHead('보관 그릇(외부, 선택)'), '보관 그릇');
  assert.equal(T.glossHead('(외부)'), null, 'nothing of its own before the bracket');
  assert.equal(T.glossHead('정기 일정'), null, 'no bracket ends it');
  assert.equal(T.glossHead('a(b) 다음'), null, 'a bracket inside the name is the name');
  const g = T.fitTag('정기 일정(alpha_q Schedule)', 60, 2, measure, 12.5);
  assert.deepEqual(g.lines, ['정기 일정']); assert.equal(g.gloss, true); assert.equal(g.full, false);
  // The whole name in the side room (no icon) goes before its gloss or a cut: 「ReadWriteProxy·압축 워커」 reads whole there.
  const t = T.fitTag('Writerproxy·압축 워커', 60, 2, measure, 12.5, 16);
  assert.equal(t.full, true); assert.equal(t.tight, true); assert.equal(t.lines.join(''), 'Writerproxy·압축 워커');
});

test('V14F1-6 the page marks a gloss tag (no tag-cut), with its dotted underline', async () => {
  const a = await app(), c = await css();
  assert.match(fn(a, 'fitCards'), /x\.el\.classList\.toggle\('tag-cut', !f\.full && !f\.gloss\); x\.el\.classList\.toggle\('tag-gloss', !!f\.gloss\);/);
  assert.match(c.slice(c.indexOf('---------- v14 fix 1 ----------')), /\.space\.face-tag \.node\.card\.tag-gloss \.c-tag-name \{ text-decoration: underline dotted;/);
});

test('V14F1-7 the main flow lit at rest says its relations at every tier, over quiet lines if it must, in whole words', async () => {
  const a = await app(), pl = fn(a, 'placeLineLabels'), pr = fn(a, 'placeRestLabels');
  // The overview (counts) keeps counts and conditions, and now the lit flow's labels first.
  assert.match(pl, /if \(mode === 'counts'\) \{\n[\s\S]*?const litNow = ffShown\(\) && ffActive\(\) && !selected \? \[\.\.\.world\.querySelectorAll<SVGGElement>\('\.edge\.ff-flow'\)\][\s\S]*?if \(litNow\.length && !litFirst\.length\) \{ placeRestLabels\(box, litNow, clear\);/); // v14 fix 2: unless placed first (clear state)
  // A lit line's label may stand over quiet lines (never a card, a head, the title or another label).
  assert.match(pr, /const litRest = g\.classList\.contains\('ff-flow'\) && \$\('space'\)\.classList\.contains\('cl-on'\) && !selected;/);
  assert.match(pr, /free = \(r: Rect\) => clear\(r\) && !lineUnder\(r, e\.key, litRest \? litShown : shown\);/);
  // Words already cut by the verb's own helper give way to their first whole words (never a 「…」 on the map).
  assert.match(pr, /const cutWord = litRest && cut0\.includes\('…'\) \? litWords\(cut0\) : cut0;/);
  const lw = fn(a, 'litWords');
  assert.match(lw, /if \(!head \|\| \/\(\?:\^\|\\s\)\(\?:또는\|혹은\|or\)\(\?:\\s\|\$\)\|\\\|\/i\.test\(head\)\) return '';/, 'never one side of an OR');
  assert.match(lw, /return w\.length >= 4 && !w\.includes\('…'\) \? w : '';/);
});

test('V14F1-8 the main flow: the longest run of drawn lines among runtime candidates, then one from a user; build and plumbing last', () => {
  const r = x => x.r, size = x => x.n;
  // Runtime candidates: the longer run goes first whatever its rule's place (nanogpt: the 첫 구조 줄's three steps over the summary's one line).
  assert.deepEqual(S.preferRuntime([[{ r: 3, n: 2 }], [{ r: 3, n: 3 }]], r, size), [1, 0]);
  // A fan out of one card (two layers) never takes a chain's place (dagu: 스케줄러 → 코디네이터 → 워커 over a command fan from the user).
  assert.deepEqual(S.preferRuntime([[{ r: 2, n: 3 }], [{ r: 3, n: 2 }]], r, size), [0, 0]);
  // As long: one from a person who uses the product first; as long and as high: the record's order.
  assert.deepEqual(S.preferRuntime([[{ r: 2, n: 2 }], [{ r: 3, n: 2 }]], r, size), [1, 0]);
  assert.deepEqual(S.preferRuntime([[{ r: 3, n: 2 }], [{ r: 3, n: 2 }]], r, size), [0, 0]);
  // Build and plumbing give way to any runtime candidate, however long.
  assert.deepEqual(S.preferRuntime([[{ r: 0, n: 5 }, { r: 1, n: 4 }], [{ r: 2, n: 2 }]], r, size), [1, 0]);
  assert.deepEqual(S.preferRuntime([[{ r: 0, n: 5 }], [{ r: 1, n: 2 }]], r, size), [1, 0]);
});

test('V14F1-9 the first view picks among the rules by the run of drawn lines (the candidates\' chain)', async () => {
  const ff = await readFile(new URL('../src/client/first-flow.ts', import.meta.url), 'utf8');
  assert.match(ff, /pick = preferRuntime\(lists, rank, c => c\.chain\.length\);/);
});

test('V14F1-10 the opening grows the main flow the landing lights, before a recorded chain', () => {
  const boxes = ['mixer', 'oven', 'shelf', 'till'].map(id => ({ id, container: null }));
  const edges = [{ key: 'e1', ids: ['r1'], from: 'mixer', to: 'oven' }, { key: 'e2', ids: ['r2'], from: 'oven', to: 'shelf' }, { key: 'e3', ids: ['r3'], from: 'shelf', to: 'till' }];
  const base = { boxes, edges, rep: id => id, names: new Map(boxes.map(b => [b.id, b.id])), versions: [], chainRels: ['r1', 'r2'] };
  const p = O.openingPlan({ ...base, chain: [['mixer'], ['oven'], ['shelf']], flow: [['shelf'], ['till']], flowLines: ['e3'] });
  assert.equal(p.kind, 'flow');
  assert.deepEqual(p.beats[0].show, ['shelf'], 'it grows from the lit flow\'s first card');
  // With nothing lit at rest the recorded chain still grows.
  assert.equal(O.openingPlan({ ...base, chain: [['mixer'], ['oven'], ['shelf']] }).kind, 'chain');
});

test('V14F1-11 a release bot that is no person is drawn as a service outside the program (dashed), never round under 「사람」', async () => {
  const k = c => S.cardShape(c);
  assert.equal(k({ name: '검사 자동화(GitHub Actions)', type: null, family: 'participant', familyRole: 'CI 실행' }), 'outside');
  assert.equal(k({ name: 'Travis CI', type: null, family: 'participant' }), 'outside');
  assert.equal(k({ name: 'CI·봇', type: null, family: 'participant' }), 'outside');
  assert.equal(k({ name: '메인테이너(누리)', type: 'person', family: 'participant' }), 'person');
  assert.equal(k({ name: '의존성 봇', type: 'person', family: 'participant' }), 'person', 'a person by its type word stays round');
  assert.equal(k({ name: '쓰는 사람', type: 'person', family: 'participant' }), 'person');
  assert.equal(k({ name: '원격 서버', type: 'external', family: 'participant' }), 'outside');
  assert.equal(k({ name: '분배기', type: null, family: 'process' }), 'part');
  // Its mark still says what it is; the page and the legend read the shape from cardShape.
  assert.equal(S.kindMark({ name: 'Travis CI', type: null, family: 'participant' }), '자동 봇');
  const a = await app();
  assert.match(fn(a, 'shapeCard'), /el\.classList\.add\(`pk-\$\{cardShapeOf\(o, p\.id, k\)\}`\);/);
  assert.match(fn(a, 'shapeTitleEls'), /const kinds = new Set\(\[\.\.\.shapeOf\(o\)\.kinds\.entries\(\)\]\.map\(\(\[id, k\]\) => cardShapeOf\(o, id, k\)\)\);/);
  assert.match(S.KIND_LEGEND.find(x => x.kind === 'outside').tip, /자동 봇/);
});

test('V14F1-12 흐름 reads from its row\'s start: its first view keeps the map\'s left edge with the flow', async () => {
  const fr = fn(await app(), 'frameView');
  assert.match(fr, /f = f0 && formPlace && formNow === 'flow' && f0\.x > B\.x \? \{ \.\.\.f0, x: B\.x, w: f0\.x \+ f0\.w - B\.x \} : f0;/);
  assert.match(fr, /const rowStart = formPlace && formNow === 'flow' \? Math\.min\(left - B\.x \* kk, left \+ w - \(f\.x \+ f\.w\) \* kk\) : null;/);
  assert.match(fn(await app(), 'sideFrame'), /const mid = formPlace && formNow === 'flow' \? left - B\.x \* kk : left \+ w \/ 2 - \(f\.x \+ f\.w \/ 2\) \* kk;/);
});

test('V14F1-13 a title\'s basis line gives up its version, then its time, rather than a 「…」 inside them', async () => {
  const a = await app(), fb = fn(a, 'fitBasisLines');
  assert.match(fn(a, 'fitCards'), /fitBasisLines\(\); \/\/ v14 fix 1/);
  assert.match(fb, /more\.textContent = full\.split\(' · 판본 '\)\[0\] \?\? ''; if \(over\(\)\) more\.textContent = '';/);
});
