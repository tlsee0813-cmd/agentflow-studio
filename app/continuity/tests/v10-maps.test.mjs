// v10 maps: the review of v9 on the eight maps (a label a condition's new place took off the map and a basis line cut at a verb's 「…고」,
// a one-line top sentence with free height under the map at 1280, labels on arrowheads and under a bundle, hub chips across their card's
// edge, lines through a label's text). Each test fails on v9. Fictional strings only.
// No browser: the pure parts run as built (each decision the page makes is one of them); the DOM code that uses them is read from the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveLabels } from '../dist/public/client/map-layout.js';
import { labelSpots, endZones, dockSlack } from '../dist/public/client/map-labels.js';
import { hubChipSpots, chipSpots, topCut, CLAUSE_KEEP, sentenceRoom } from '../dist/public/client/first-flow.js';
import { clauseCuts, KEEP_WORD } from '../dist/public/shared/studio.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));
const meet = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('V10-1 a label left with no place takes it when the condition in its way has another place of its own', () => {
  // A condition (rank 0) whose nearest place sits on the only place of a plain label (rank 1), and a second place of its own further off.
  const cond1 = { key: 'c', x: 100, y: 100, w: 80, h: 16, dist: 35, rank: 0 }, cond2 = { key: 'c', x: 100, y: 200, w: 80, h: 16, dist: 60, rank: 0 };
  const label = { key: 'l', x: 150, y: 100, w: 60, h: 16, dist: 0, rank: 1 };
  const { kept, dropped } = resolveLabels([cond1, cond2, label]);
  assert.deepEqual(dropped, [], 'both read (v9: the plain label was left off the map)');
  assert.ok(kept.includes(cond2) && kept.includes(label) && !kept.includes(cond1), JSON.stringify(kept));
  // A move never takes a third label off: with the condition's other place taken, the plain label stays off.
  const other = { key: 'o', x: 100, y: 200, w: 80, h: 16, dist: 0, rank: 0 };
  const r2 = resolveLabels([cond1, cond2, label, other]);
  assert.deepEqual(r2.dropped, ['l']);
  assert.ok(r2.kept.includes(cond1) && r2.kept.includes(other));
  // The protected order still decides who keeps a place first.
  assert.deepEqual(resolveLabels([{ ...cond1 }, { ...label }]).dropped, ['l']);
});

test('V10-2 an end mark keeps its room: a label place by the tip meets it, one further along does not; a start dot keeps none', () => {
  // A level line arriving leftwards at a card's right edge (x 200), at 50%: a 9px head is 18 map units, plus 3px (6 units) of room.
  const pts = [{ x: 400, y: 100 }, { x: 200, y: 100 }];
  const [z] = endZones(pts, 9, 0, 0.5);
  assert.ok(z.x <= 194 && z.x + z.w >= 218 && z.y <= 85 && z.y + z.h >= 115, JSON.stringify(z));
  assert.equal(endZones(pts, 9, 0, 0.5).length, 1, 'a start shown only on hover (the dot) keeps no room');
  assert.equal(endZones(pts, 9, 6, 0.5).length, 2, 'an ear at the start does');
  // labelSpots gives the tip's end of the last run no clearance (a port, not a corner): on a short last run its places meet the head.
  const short = [{ x: 290, y: 100 }, { x: 200, y: 100 }], [zs] = endZones(short, 9, 0, 0.5);
  assert.ok(labelSpots(short, 60, 16, 'end').every(r => meet(r, zs)), 'v9 set such a label on the head');
  assert.ok(labelSpots(pts, 60, 16, 'end').some(r => !meet(r, z)), 'on a longer run a place further along stays');
  // Upright, arriving downwards: the zone runs up from the tip.
  const [u] = endZones([{ x: 50, y: 0 }, { x: 50, y: 300 }], 10, 0, 1);
  assert.ok(u.y + u.h >= 303 && u.y <= 287 && u.x <= 42 && u.x + u.w >= 58, JSON.stringify(u));
});

test('V10-3 the page keeps every label off the end marks and off other lines (no loose pass over them)', async () => {
  const src = await app(), lab = fn(src, 'placeLineLabels'), fit = fn(src, 'placeFitLabels'), marks = fn(src, 'placeFocusMarks');
  assert.match(lab, /blocks\.push\(\.\.\.headZones\(shownLines\(\)\)\);/, 'labels, badges, counts and cues keep off the heads');
  assert.match(marks, /taken\.push\(\.\.\.headZones\(shownNow\)\);/, 'the notes and hub chips too');
  assert.doesNotMatch(fit, /loosely/, 'v9: a condition\'s last pass was set over other lines');
  assert.match(fit, /ok = free;/);
  assert.match(fit, /const free = \(r: Rect\) => clear\(r\) && inMap\(r\) && !lineUnder\(r, e\.key, drawn\);/);
});

test('V10-4 a hub chip stands off its card\'s edge, under it at the right first, never across the edge', () => {
  const card = { x: 300, y: 200, w: 160, h: 60 }, w = 70, hh = 16, gap = 4;
  const spots = hubChipSpots(card, w, hh, gap);
  assert.deepEqual(spots[0], { x: card.x + card.w - w, y: card.y + card.h + gap });
  for (const p of spots) {
    const r = { x: p.x, y: p.y, w, h: hh };
    // Never across the card's border: wholly outside it, at least gap off.
    assert.ok(!meet(r, { x: card.x - gap + 0.01, y: card.y - gap + 0.01, w: card.w + 2 * gap - 0.02, h: card.h + 2 * gap - 0.02 }), JSON.stringify(p));
  }
  // Merged with v10-growth: the off-edge places are kept to the ones touching the card's ring one gap out (the row-further ones go).
  const ring = { x: card.x - gap, y: card.y - gap, w: card.w + 2 * gap, h: card.h + 2 * gap }, kept = chipSpots(spots, w, hh, [], ring);
  assert.deepEqual(kept, spots.slice(0, 6), 'under, over and beside its card; never a row further');
  return app().then(src => assert.match(fn(src, 'placeFocusMarks'), /chipSpots\(hubChipSpots\(b, w, hh, g\), w, hh, titles, ring\)/));
});

test('V10-5 the basis line keeps its whole-word cut when a verb\'s 「…고」 clause would keep far less', () => {
  const text = '/x의 시작 명령이 종류별 실행기로 나뉘고 진행 기록이 같은 통로와 출력 폴더로 흐르는 서버 경계를 말한다';
  const { clauses, words } = clauseCuts(text, KEEP_WORD);
  assert.ok(clauses.some(c => /나뉘고…?$/.test(c)), 'v9: a verb\'s 「…고」 ends a clause (kept)');
  const fits = t => [...t].length <= 50;
  const basis = topCut(clauses, words, fits, CLAUSE_KEEP);
  assert.ok(!/나뉘고…?$/.test(basis) && /흐르는/.test(basis), basis);
  // The sentence (keep 0) keeps its clause cut first, as in v9.
  assert.match(topCut(clauses, words, fits, 0), /나뉘고…?$/);
  // A clause cut nearly as long as the word cut wins.
  const t2 = '사용자가 문서를 올리면 서버가 색인을 만들고, 검색 화면이 결과를 보여 준다';
  const c2 = clauseCuts(t2, KEEP_WORD), cut = topCut(c2.clauses, c2.words, t => [...t].length <= 30, CLAUSE_KEEP);
  assert.match(cut, /만들고,?…?$/, cut);
  assert.equal(topCut([], [], () => false), null);
});

test('V10-6 the free height under the map is measured per column: only what sits under a part of the map holds it up', () => {
  // A window 720 high; the tools (x 16–730, top 662); the map's low corner (x 119–324, bottom 628) over them, the rest ending at 572.
  const content = [{ x: 119, y: 600, w: 205, h: 28 }, { x: 400, y: 160, w: 800, h: 412 }], tools = { x: 16, y: 662, w: 714, h: 44 };
  assert.equal(dockSlack(content, [tools], 720), 26, 'v9 kept the whole row (88) under the whole map: 720 − 88 − 628 = 4');
  // An obstacle under no part of the map holds nothing up; a part already beside an obstacle's top holds the move at 0.
  assert.equal(dockSlack([{ x: 400, y: 160, w: 300, h: 412 }], [{ x: 16, y: 613, w: 240, h: 40 }], 720), 720 - 8 - 572);
  assert.equal(dockSlack([{ x: 100, y: 600, w: 50, h: 40 }], [{ x: 16, y: 613, w: 240, h: 40 }], 720), 0);
});

test('V10-7 a top sentence that needs two lines renders on two lines when the map can move down (modelled render, the page\'s planner)', () => {
  // The page decides with sentenceRoom; here the render it decides on is modelled: the sentence wraps at the box's width (word-keep, 19px
  // characters of 16px), the box grows 26px a line under 76px of rows, and the map hangs from its title (y 87) at its scale.
  const sentence = '가상 도구는 기록 묶음을 받아 단계마다 나눠 처리하고 결과를 한 화면에 모아 보여 주며 사람이 고친 내용을 다음 실행에 다시 넣는다.';
  const lines = (width, max) => { let n = 1, at = 0; for (const word of sentence.split(' ')) { const w = [...word].length * 16 + 5; if (at && at + w > width) { n++; at = 0; } at += w; } return Math.min(n, max); };
  const forms = [{ name: 'two', max: 2 }, { name: 'one', max: 1 }], top = 68, k0 = 0.4;
  const box = f => top + 76 + 26 * lines(736, f.max) + 6;
  const map = (k, d) => ({ top: 87 + (167 - 87) * (k / k0) + d, bottom: 87 + (628 - 87) * (k / k0) + d });
  const clear = (f, k, d) => box(f) < map(k, d).top;
  const tools = { x: 16, y: 662, w: 714, h: 44 };
  const slackNow = k => dockSlack([{ x: 119, y: map(k, 0).bottom - 28, w: 205, h: 28 }, { x: 400, y: 160, w: 800, h: map(k, 0).bottom - 56 - 160 }], [tools], 720);
  const room = sentenceRoom(forms, k0, k0 - 0.03, clear, slackNow);
  assert.ok(room, 'a form finds room');
  assert.equal(lines(736, room.form.max), 2, `rendered on two lines (${room.form.name} at ${room.k.toFixed(3)}, ${room.d}px down)`);
  assert.ok(room.d > 0 && room.k >= k0 - 0.03, 'by moving the map down, within the give ' + JSON.stringify(room));
  // v9's free height (the dock's whole row under the whole map) leaves only the one cut line.
  const v9 = sentenceRoom(forms, k0, k0 - 0.03, clear, k => 720 - 88 - map(k, 0).bottom);
  assert.equal(v9?.form.name ?? 'one', 'one');
});

test('V10-8 the page uses those decisions: the fit plans the sentence with sentenceRoom over mapSlack, the basis line with topCut', async () => {
  const src = await app();
  assert.match(fn(src, 'fitView'), /sentenceRoom\(FT_SAID, at\.k, least, /);
  assert.match(fn(src, 'mapSlack'), /return dockSlack\(content, obstacles, mapBottom\(\), 8\);/);
  assert.match(fn(src, 'clauseFit'), /topCut\(clauses, words, c => \{ t\.textContent = c; return !over\(\); \}, most \? CLAUSE_KEEP : 0\)/);
  assert.match(fn(src, 'syncFocusTop'), /clauseFit\(basis \?\? t, t, t\.dataset\.text \?\? '', !!basis\)/);
});
