// Display slice S10 (Astra A6), its pure part: the map's first view — the lens, the emphasis, at most two 「안에」 previews and one guide
// line — chosen from the record's own focus (C-HEAD 첫 구조 줄) matched to the map's real structure by three minimal rules, never a kind,
// a ratio or a count; kept per map; a target that disappears drops alone. Fictional readings only. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { firstView, firstViewStep, namedParts, nameStem, headQuote, recordOf, readFirstView, writeFirstView, lensChosen, keepExisting, differs, objectJosa, reasonText,
  FIRST_VIEW_KEY, FIRST_LENS_NAME, STRUCTURE_REASON } from '../dist/public/client/first-view.js';
import { tierFit } from '../dist/public/client/card-budget.js';

// A fictional bakery-order project: an order desk, a dough mixer that repeats per batch, an oven queue, a ledger and a tasting gate.
const P = (id, name, x = {}) => ({ id, name, ref: null, group: false, loop: false, humanGate: false, entries: [], states: [], ...x });
const L = (id, from, to, channel, payload = null) => ({ id, from, to, channel, payload });
const PARTS = [
  P('a1', '주문 창구', { ref: 'B01', entries: ['request'] }),
  P('a2', '반죽 배합기', { ref: 'B02', loop: true }),
  P('a3', '오븐 대기열', { ref: 'B03', group: true, states: ['예열 중'] }),
  P('a4', '판매 장부', { ref: 'B04' }),
  P('a5', '시식 관문', { ref: 'B05', humanGate: true }),
  P('a6', '일정 알림', { ref: 'B06', entries: ['schedule'] })];
const LINES = [
  L('r1', 'a1', 'a2', 'data', '주문서'),
  L('r2', 'a2', 'a3', 'data', '반죽 묶음'),
  L('r3', 'a3', 'a4', 'data', '판매 기록'),
  L('r4', 'a6', 'a2', 'control', null),
  L('r5', 'a2', 'a3', 'control', null),
  L('r6', 'a5', 'a4', 'uses', null)];
const LOOPS = [{ owner: 'a2', ref: 'B02:L01', parentPart: null, unit: '반죽 한 판' }];
const QUOTE = { record: 'rec-1', quote: '| 첫 구조 줄 | … | 추정 |', from: 10 };
const view = (firstLines, x = {}) => firstView({ firstLines, parts: PARTS, lines: LINES, loops: LOOPS, quote: QUOTE, ...x });

test('S10-1 a line naming a data transform with that data line between its parts opens 데이터 이동, emphasising those parts and lines', () => {
  const v = view(['주문 창구가 받은 주문서를 반죽 배합기로 넘긴다']);
  assert.equal(v.lens, '데이터 이동'); assert.equal(v.lensId, 'data'); assert.equal(v.basis, 'record');
  assert.deepEqual(v.emphasis, { parts: ['a1', 'a2'], lines: ['r1'] });
  assert.equal(v.reason.text, "첫 보기: 데이터 이동 · 기록의 '주문 창구가 받은 주문서를 반죽 배합기로…'를 중심으로");
  assert.deepEqual(v.reason.quoteRef, QUOTE, 'the reason opens the record row it rests on');
  assert.deepEqual(v.previews, ['a2'], 'the loop in focus shows its preview first');
  assert.deepEqual(v.alternatives, []);
});

test('S10-2 a line naming a start, coordination or loop with that control line or loop scope opens 시작과 반복', () => {
  const v = view(['일정 알림이 반죽 배합기를 깨워 시작시킨다']);
  assert.equal(v.lens, '시작과 반복'); assert.deepEqual(v.emphasis, { parts: ['a6', 'a2'], lines: ['r4'] });
  // A loop scope alone: the part names a repeat and owns a C-LOOP row (no control line among the named parts).
  const loop = view(['반죽 배합기는 반죽 한 판마다 반복한다']);
  assert.equal(loop.lens, '시작과 반복'); assert.deepEqual(loop.emphasis.parts, ['a2']); assert.deepEqual(loop.reason.loops, ['B02:L01']);
  // A loop named by its record ID (B02:L01) maps to its owner.
  assert.deepEqual(namedParts('B02:L01 반복이 중심', PARTS, LOOPS), { parts: ['a2'], loops: ['B02:L01'] });
  // A starting entry (C-ENTRY schedule) on a named part counts; a human gate counts only when the line names a person stepping in.
  assert.equal(view(['일정 알림이 하루 일정을 시작한다']).lens, '시작과 반복');
  assert.equal(view(['시식 관문에서 사람이 승인한다']).lens, '시작과 반복');
  assert.equal(view(['시식 관문이 맛을 본다']).lens, '구성', 'a gate part alone is no approval relation');
});

test('S10-3 the words without the relation, or the relation without the words, open 구성 (the rule needs both)', () => {
  // Data words, but between 일정 알림 and 반죽 배합기 there is only a control line.
  const a = view(['일정 알림이 반죽 배합기로 자료를 넘긴다']);
  assert.equal(a.lens, '구성'); assert.deepEqual(a.emphasis.parts, ['a6', 'a2'], '구성 still emphasises the parts the line names');
  assert.match(a.reason.text, /^첫 보기: 구성 · 기록의 '/);
  // Parts named, no flow word at all: 구성, with the lines between them (any channel) emphasised.
  const b = view(['시식 관문과 판매 장부']);
  assert.equal(b.lens, '구성'); assert.deepEqual(b.emphasis, { parts: ['a5', 'a4'], lines: ['r6'] });
  // A name the line repeats inside another word is not taken for a verb: 「주문 창구」 holds no 「주문」 transform word here.
  assert.equal(view(['주문 창구']).lens, '구성');
});

test('S10-4 mixed: one line naming both, or two lines of equal standing, open 구성 with at most two foci offered', () => {
  const one = view(['반죽 배합기가 반죽 묶음을 오븐 대기열로 넘기고 실행을 시작시킨다']);
  assert.equal(one.lens, '구성'); assert.equal(one.alternatives.length, 2);
  assert.deepEqual(one.alternatives.map(a => a.lens), ['data', 'start']);
  assert.deepEqual(one.alternatives[0].lines, ['r2']); assert.deepEqual(one.alternatives[1].lines, ['r5']);
  assert.deepEqual(one.emphasis.parts, ['a2', 'a3']);
  const two = view(['주문 창구가 주문서를 반죽 배합기로 넘긴다', '일정 알림이 반죽 배합기를 시작시킨다', '오븐 대기열이 판매 기록을 판매 장부에 저장한다']);
  assert.equal(two.lens, '구성', 'two foci of equal standing: no single kind');
  assert.ok(two.alternatives.length <= 2);
  assert.deepEqual(two.alternatives.map(a => [a.lens, a.index]), [['data', 0], ['start', 1]]);
  assert.deepEqual(two.previews.length <= 2, true);
  // One decisive line and one that only names parts: the decisive one leads, the other is offered.
  const lead = view(['시식 관문과 판매 장부', '오븐 대기열이 판매 기록을 판매 장부에 저장한다']);
  assert.equal(lead.lens, '데이터 이동'); assert.equal(lead.focus.index, 1); assert.deepEqual(lead.alternatives.map(a => a.index), [0]);
});

test('S10-5 weak: lines naming no real part fall back to the structure, and only an unambiguous one says so', () => {
  const weak = view(['이 프로젝트의 핵심 흐름', '모든 것이 중요하다']);
  assert.equal(weak.lens, '구성'); assert.equal(weak.reason, null, 'data and control lines both drawn: nothing to say');
  assert.deepEqual(weak.emphasis, { parts: [], lines: [] }); assert.equal(weak.basis, 'none');
});

test('S10-6 a v4 or v3 map (no first lines): 구성 and no guide line, unless the structure alone is unambiguous', () => {
  const v4 = firstView({ firstLines: [], parts: PARTS, lines: LINES, loops: LOOPS });
  assert.equal(v4.lens, '구성'); assert.equal(v4.reason, null); assert.deepEqual(v4.previews, []);
  const onlyData = firstView({ firstLines: [], parts: PARTS.map(p => ({ ...p, loop: false })), lines: LINES.filter(l => l.channel === 'data') });
  assert.equal(onlyData.lens, '데이터 이동'); assert.equal(onlyData.reason.text, `첫 보기: 데이터 이동 · ${STRUCTURE_REASON}`);
  assert.equal(onlyData.reason.quoteRef, null); assert.deepEqual(onlyData.emphasis, { parts: [], lines: [] }, 'nothing named, nothing emphasised');
  const onlyStart = firstView({ firstLines: [], parts: PARTS, lines: LINES.filter(l => l.channel === 'control') });
  assert.equal(onlyStart.lens, '시작과 반복');
  const none = firstView({ firstLines: [], parts: PARTS.map(p => ({ ...p, loop: false })), lines: [L('u', 'a1', 'a4', 'uses')] });
  assert.equal(firstView({ firstLines: [], parts: PARTS, lines: [L('u', 'a1', 'a4', 'uses')] }).lens, '시작과 반복', 'a part with a recorded loop is a start structure');
  assert.equal(none.lens, '구성'); assert.equal(none.reason, null, '구성 by the structure is the default: nothing to say (review N5)');
  assert.equal(firstView({ firstLines: [], parts: [], lines: [] }).reason, null, 'an empty map says nothing');
});

test('S10-7 a target that disappears drops alone: never a substitute, the lens and guide line stay', () => {
  const rec = recordOf(view(['주문 창구가 받은 주문서를 반죽 배합기로 넘긴다']), 'auto');
  const kept = keepExisting(rec, new Set(['a1', 'a3']), new Set(['r2']));
  assert.deepEqual(kept.parts, ['a1']); assert.deepEqual(kept.lines, []); assert.deepEqual(kept.previews, []);
  assert.equal(kept.lens, 'data'); assert.equal(kept.reason, rec.reason); assert.equal(kept.line, rec.line);
  // The recommendation read again without the part offers itself (「추천 첫 보기로」), never switching on its own.
  const after = firstView({ firstLines: ['주문 창구가 받은 주문서를 반죽 배합기로 넘긴다'], parts: PARTS.filter(p => p.id !== 'a2'), lines: LINES.filter(l => l.from !== 'a2' && l.to !== 'a2') });
  assert.equal(after.lens, '구성'); assert.deepEqual(after.emphasis.parts, ['a1']);
  assert.equal(differs(kept, 'data', after), true);
});

test('S10-8 names: a longer name wins where both stand, a record ID or a C-STATE name maps to its part, a one-letter name never matches', () => {
  const parts = [P('x1', '오븐'), P('x2', '오븐 대기열'), P('x3', 'Q'), P('x4', '장부', { ref: 'B09', states: ['마감됨'] })];
  assert.deepEqual(namedParts('오븐 대기열이 Q를 본다', parts).parts, ['x2']);
  assert.deepEqual(namedParts('오븐과 오븐 대기열', parts).parts, ['x1', 'x2']);
  assert.deepEqual(namedParts('B09가 마감됨', parts).parts, ['x4']);
  assert.deepEqual(namedParts('B090 아님', parts).parts, []);
  // A Korean name read as the work it names (its last syllable off, three characters or more left): 「일정 계산기」 as 「일정 계산」.
  const plant = [P('w1', '일정 계산기'), P('w2', '푸시 발송기'), P('w3', '매시 틱'), P('w4', '창')];
  assert.equal(nameStem('일정 계산기'), '일정 계산'); assert.equal(nameStem('매시 틱'), null); assert.equal(nameStem('Runner'), null);
  assert.deepEqual(namedParts('매시 일정 계산과 푸시 발송', plant).parts, ['w1', 'w2']);
  const lp = firstView({ firstLines: ['매시 일정 계산과 푸시 발송'], parts: plant.map(p => (p.id === 'w1' ? { ...p, loop: true } : p)), lines: [L('d', 'w1', 'w2', 'data', 'D02 푸시 요청'), L('c', 'w3', 'w1', 'control')], loops: [{ owner: 'w1', ref: 'B05:L01' }] });
  assert.equal(lp.lens, '시작과 반복', '「매시」 names a repeat and the calculator owns a loop; 「발송」 is no data word once the name is taken out');
  assert.deepEqual(lp.reason.loops, ['B05:L01']);
  // A part called with a verb-like name names no verb: the words are read without the names.
  const reader = [P('y1', 'Reader'), P('y2', 'Sink')];
  assert.equal(firstView({ firstLines: ['Reader and Sink'], parts: reader, lines: [L('z', 'y1', 'y2', 'data')] }).lens, '구성');
  assert.equal(firstView({ firstLines: ['Reader → Sink'], parts: reader, lines: [L('z', 'y1', 'y2', 'data')] }).lens, '데이터 이동', 'a chain names a flow; the line between says which');
});

test('S10-9 previews: at most two focused groups or loops, in the line\'s order', () => {
  const parts = [P('g1', '첫 묶음', { group: true }), P('g2', '둘째 묶음', { group: true }), P('g3', '셋째 묶음', { group: true })];
  const v = firstView({ firstLines: ['첫 묶음 둘째 묶음 셋째 묶음'], parts, lines: [] });
  assert.deepEqual(v.previews, ['g1', 'g2']);
});

test('S10-10 the guide line\'s words: 을/를 by the last syllable, the line cut to 24 with its whole kept', () => {
  assert.equal(objectJosa('실행기'), '를'); assert.equal(objectJosa('반복문'), '을'); assert.equal(objectJosa('Runner'), '을(를)');
  assert.equal(reasonText('start', '명령을 나누는 실행기'), "첫 보기: 시작과 반복 · 기록의 '명령을 나누는 실행기'를 중심으로");
  assert.deepEqual(Object.values(FIRST_LENS_NAME), ['구성', '데이터 이동', '시작과 반복']);
  const long = view(['주문 창구가 받은 주문서를 반죽 배합기로 넘긴다']);
  assert.equal(long.reason.line, '주문 창구가 받은 주문서를 반죽 배합기로 넘긴다', 'the whole line for the tip and the popover');
});

test('S10-11 the C-HEAD row is found as written (the newest record holding one), to open as the evidence', () => {
  const text = '〔기록 R1 · 쪽 1〕\n| 항목 | 값 | 근거 |\n| 기준 커밋 | main · abc | F01 |\n  | 첫 구조 줄 | 주문서가 반죽 배합기로 · 일정이 배합을 시작 | 추정 |\n';
  const q = headQuote([{ id: 'old', text: '| 첫 구조 줄 | 예전 | 모름 |' }, { id: 'new', text }]);
  assert.equal(q.record, 'new'); assert.equal(q.quote, '| 첫 구조 줄 | 주문서가 반죽 배합기로 · 일정이 배합을 시작 | 추정 |');
  assert.equal(text.slice(q.from, q.from + q.quote.length), q.quote);
  assert.equal(headQuote([{ id: 'r', text: '| 교체 항목 첫 구조 줄 | 새 줄 | F02 |' }]).quote, '| 교체 항목 첫 구조 줄 | 새 줄 | F02 |');
  assert.equal(headQuote([{ id: 'r', text: '첫 구조 줄 없음' }]), null);
});

test('S10-12 kept per map: the record reads back, a broken store starts over, a lens the person chose is seen as chosen', () => {
  const rec = recordOf(view(['일정 알림이 반죽 배합기를 깨워 시작시킨다']), 'auto');
  const raw = writeFirstView(null, 'map-1', rec);
  assert.deepEqual(readFirstView(raw, 'map-1'), rec); assert.equal(readFirstView(raw, 'map-2'), null);
  assert.equal(readFirstView('{broken', 'map-1'), null); assert.ok(readFirstView(writeFirstView('{broken', 'map-3', rec), 'map-3'));
  assert.equal(FIRST_VIEW_KEY, 'agentflow.studio.firstview.1');
  assert.equal(lensChosen(JSON.stringify({ 'map-1': { lens: 'state' } }), 'map-1'), true);
  assert.equal(lensChosen(JSON.stringify({ 'map-1': { lens: 'state' } }), 'map-2'), false); assert.equal(lensChosen('{', 'map-1'), false);
  // An offered focus is the person's: its own lens, parts, lines and previews.
  const v = view(['반죽 배합기가 반죽 묶음을 오븐 대기열로 넘기고 실행을 시작시킨다']), pick = recordOf(v, 'person', v.alternatives[1]);
  assert.deepEqual([pick.lens, pick.by, pick.lines], ['start', 'person', ['r5']]);
  assert.equal(differs(recordOf(v, 'auto'), 'compose', v), false); assert.equal(differs({ ...recordOf(v, 'auto'), off: true }, 'compose', v), true);
  assert.equal(differs(recordOf(v, 'auto'), 'data', v), true, 'another lens than the recommendation offers it again');
});

test('S10-13 the preview and Alt-mode only use the card\'s own box: at 개요 one row when it fits, nothing when it does not', () => {
  // The head first: its status and the name's second line (a 176 box holds no more at 0.54), then the preview in what is left (220).
  assert.deepEqual(tierFit({ nameLines: 1, rows: 2, contract: 0, inner: 0, signs: 0, total: 176, status: 1, members: 1 }, 0.54, 'far', { preview: true }), tierFit({ nameLines: 1, rows: 2, contract: 0, inner: 0, signs: 0, total: 176, status: 1, members: 1 }, 0.54, 'far'));
  const group = { nameLines: 1, rows: 2, contract: 0, inner: 0, signs: 0, total: 220, status: 1, members: 1 };
  const plain = tierFit(group, 0.54, 'far'), pre = tierFit(group, 0.54, 'far', { preview: true });
  assert.equal(plain.rows, 0); assert.equal(pre.rows, 1, 'the 안에 row shows first');
  assert.equal(tierFit(group, 0.54, 'far', { alt: true }).rows, 0, 'an emphasised group that is no preview keeps its 안에 row back (two previews at most)');
  assert.equal(tierFit({ ...group, total: 96 }, 0.54, 'far', { preview: true }).rows, 0, 'no room: nothing added');
  assert.equal(tierFit(group, 0.25, 'dots', { preview: true }).rows, 0, 'the dot map keeps the head only');
  // A loop container has no 안에 row: its preview is its inner line (its steps and unit), when it fits.
  const loopCard = { nameLines: 1, rows: 0, contract: 0, inner: 88, signs: 0, total: 192, status: 1 };
  assert.deepEqual([tierFit(loopCard, 0.54, 'far').inner, tierFit(loopCard, 0.54, 'far', { preview: true }).inner], [false, true]);
  assert.equal(tierFit(loopCard, 0.54, 'far', { preview: true }).nameLines, 2, 'the name\'s second line comes before the preview');
  assert.equal(tierFit({ ...loopCard, total: 104 }, 0.54, 'far', { preview: true }).inner, false);
  // 중간: Alt-mode gives the kind rows and values the room before the inner line and the second name line.
  const card = { nameLines: 2, rows: 2, contract: 40, inner: 24, signs: 0, total: 200, status: 0, vals: 2 };
  const mid = tierFit(card, 0.7, 'mid'), alt = tierFit(card, 0.7, 'mid', { alt: true });
  assert.ok(alt.rows + alt.vals >= mid.rows + mid.vals, `${JSON.stringify(mid)} → ${JSON.stringify(alt)}`);
  // Neither costs the head (review B1, B2): at 개요 the short status a plain card shows stays, the preview yields first, then the name's
  // second line; at 중간 an emphasised name keeps every line the plain card shows. Swept over shapes and scales, never only one case.
  for (const total of [96, 120, 150, 176, 192, 220]) for (const nameLines of [1, 2]) for (const rows of [0, 1, 2]) for (const inner of [0, 88])
    for (const status of [0, 1]) for (const members of [0, 1]) for (const vals of [0, 2]) {
      const c = { nameLines, rows, contract: vals ? 40 : 0, inner, signs: 0, total, status, members, vals };
      for (const k of [0.32, 0.36, 0.4, 0.44, 0.48, 0.52, 0.56]) {
        const p0 = tierFit(c, k, 'far');
        for (const pri of [{ preview: true }, { alt: true }, { preview: true, alt: true }]) {
          const f = tierFit(c, k, 'far', pri), at = `far k=${k} ${JSON.stringify(c)} ${JSON.stringify(pri)}`;
          assert.equal(f.status, p0.status, `status stays: ${at}`); assert.equal(f.nameLines, p0.nameLines, `name lines stay: ${at}`);
          assert.equal(f.kind, p0.kind, at);
        }
      }
      for (const k of [0.6, 0.65, 0.7, 0.75, 0.8, 0.85]) {
        const p0 = tierFit(c, k, 'mid'), f = tierFit(c, k, 'mid', { alt: true }), at = `mid k=${k} ${JSON.stringify(c)}`;
        assert.ok(f.nameLines >= p0.nameLines, `the emphasised name reads as fully: ${at} ${JSON.stringify(p0)} → ${JSON.stringify(f)}`);
        assert.ok(f.rows + f.vals >= p0.rows + p0.vals, `Alt-mode rows: ${at}`);
        assert.equal(f.bottom, p0.bottom, at);
      }
    }
  // The review's own shapes: k 0.40 and 0.48 at 개요 (status), 0.70 and 0.80 at 중간 (both name lines).
  const calc = { nameLines: 1, rows: 0, contract: 0, inner: 88, signs: 0, total: 192, status: 1 };
  for (const k of [0.4, 0.48]) assert.equal(tierFit(calc, k, 'far', { preview: true, alt: true }).status, true);
  const two = { nameLines: 2, rows: 2, contract: 40, inner: 0, signs: 0, total: 150, status: 0, vals: 2 };
  for (const k of [0.7, 0.8]) assert.equal(tierFit(two, k, 'mid', { alt: true }).nameLines, 2);
  assert.deepEqual(tierFit(card, 1, 'near', { alt: true, preview: true }), tierFit(card, 1, 'near'), '가까이 shows everything either way');
});

test('S10-14 never hides, never solos, never colours by importance; the guide line sits beside the lens switch', async () => {
  const src = await readFile(new URL('../src/client/first-view.ts', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\bsolo\b|'hide'|legendAct|\bratio\b|\bshare\b|count\(/,'the pure part never filters and never counts shares');
  const app = await readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  const block = app.slice(app.indexOf('/* ---------- the first view (display slice S10'), app.indexOf('/** What the legend counts of the drawn parts'));
  assert.ok(block.length > 1000);
  assert.doesNotMatch(block, /legendAct\(|do: 'solo'|do: 'hide'|\.lg-hide|camera\s*=|fitView\(|select\(/, 'no legend filter, no camera, no selection');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<div class="lens-seg"[\s\S]*?<\/div>\s*<div id="first-view" class="fv" role="group" aria-label="첫 보기" hidden><\/div>/);
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const emph = css.split('\n').filter(l => /fv-emph/.test(l)).join('\n');
  assert.doesNotMatch(emph, /accent|--ok|--warn|--bad|--fam-|display:\s*none|width:\s*\d|height:\s*\d/, 'a neutral border and stroke only; no size, no hide');
});

test('S10-15 create → paste → map: an empty map records nothing and the first draw with parts is the first visit, once (review B3)', () => {
  // The project is made and opened before any record: its map has no parts.
  const empty = firstView({ firstLines: [], parts: [], lines: [] });
  let st = firstViewStep({ kept: null, chosen: false, pending: true, hasParts: false }, empty);
  assert.deepEqual(st, { rec: null, pending: true, apply: false }, 'nothing written for an empty map');
  // Drawn again while still empty (a scope, a pane): still waiting.
  st = firstViewStep({ kept: st.rec, chosen: false, pending: st.pending, hasParts: false }, empty);
  assert.equal(st.pending, true);
  // The first record pasted and applied: the map now has parts, and the first view comes, by its own reading.
  const v = view(['일정 알림이 반죽 배합기를 깨워 시작시킨다']);
  st = firstViewStep({ kept: st.rec, chosen: false, pending: st.pending, hasParts: true }, v);
  assert.equal(st.apply, true); assert.equal(st.pending, false);
  assert.deepEqual([st.rec.lens, st.rec.by, st.rec.parts, st.rec.reason], ['start', 'auto', ['a6', 'a2'], v.reason.text]);
  // A later record changes the recommendation: the map already had parts and is being read, so nothing switches.
  const later = view(['주문 창구가 받은 주문서를 반죽 배합기로 넘긴다']);
  const again = firstViewStep({ kept: st.rec, chosen: false, pending: st.pending, hasParts: true }, later);
  assert.equal(again.apply, false); assert.equal(again.rec, st.rec);
  // The person chose a lens while the map was empty: their choice stands, no first view is applied over it.
  const chose = firstViewStep({ kept: null, chosen: true, pending: true, hasParts: true }, v);
  assert.deepEqual(chose, { rec: null, pending: false, apply: false });
  // A map opened with parts and nothing kept: the first visit at once; a kept record is restored, never re-applied.
  assert.equal(firstViewStep({ kept: null, chosen: false, pending: true, hasParts: true }, v).apply, true);
  const kept = recordOf(v, 'person');
  assert.deepEqual(firstViewStep({ kept, chosen: false, pending: true, hasParts: true }, later), { rec: kept, pending: false, apply: false });
  // A draw that is not a first visit (pending false, nothing kept: the person's own lens, or the emphasis was never offered) adds none.
  assert.equal(firstViewStep({ kept: null, chosen: false, pending: false, hasParts: true }, v).apply, false);
});

test('S10-16 a beat names its trigger and the loop over time, never an unrelated per-item loop (review N2)', () => {
  // The fictional watering map: 매시 틱 (a trigger, its own loop 매시 정각) wakes 일정 계산기 (its loop 화분마다), which hands 푸시 발송기 a request.
  const parts = [P('t', '매시 틱', { ref: 'B06', trigger: true, entries: ['schedule'], loop: true }), P('c', '일정 계산기', { ref: 'B05', loop: true }), P('p', '푸시 발송기', { ref: 'B07' }), P('u', '사용자', { ref: 'B01' })];
  const lines = [L('ln5', 't', 'c', 'control', '깨우기'), L('ln6', 'c', 'p', 'data', 'D02 푸시 요청'), L('ln2', 'u', 'c', 'control')];
  const loops = [{ owner: 't', ref: 'B06:L01', unit: '매시 정각' }, { owner: 'c', ref: 'B05:L01', parentPart: 'B06:L01', unit: '화분마다' }];
  const v = firstView({ firstLines: ['매시 일정 계산과 푸시 발송'], parts, lines, loops });
  assert.equal(v.lens, '시작과 반복');
  assert.deepEqual(v.emphasis, { parts: ['t', 'c', 'p'], lines: ['ln5'] }, 'where it starts: the trigger and its control line, never a non-trigger controller');
  assert.deepEqual(v.reason.loops, ['B06:L01'], '「매시」 is the beat loop, not 「화분마다」');
  // The per-item loop counts when the line says so: its unit, or a loop word that is no beat.
  assert.deepEqual(firstView({ firstLines: ['화분마다 일정 계산'], parts, lines, loops }).reason.loops, ['B05:L01']);
  assert.deepEqual(firstView({ firstLines: ['일정 계산기가 반복한다'], parts, lines, loops }).reason.loops, ['B05:L01']);
  // A loop with no written unit is not known to be over items: a beat still names it.
  assert.deepEqual(firstView({ firstLines: ['매시 일정 계산'], parts, lines, loops: [{ owner: 'c', ref: 'B05:L01' }] }).reason.loops, ['B05:L01']);
  // The start already among the named parts: no neighbour added.
  assert.deepEqual(firstView({ firstLines: ['매시 틱이 일정 계산기를 깨운다'], parts, lines, loops }).emphasis.parts, ['t', 'c']);
  // A loop line that names no start (only a repeat over items) adds no trigger.
  assert.deepEqual(firstView({ firstLines: ['일정 계산기는 화분마다 반복한다'], parts, lines, loops }).emphasis.parts, ['c']);
  // A data reading of the same line never takes the trigger.
  const d = firstView({ firstLines: ['일정 계산기가 푸시 요청을 푸시 발송기로 넘긴다'], parts, lines, loops });
  assert.equal(d.lens, '데이터 이동'); assert.deepEqual(d.emphasis.parts, ['c', 'p']);
});

test('S10-17 a name written without its spaces is taken out before the words are read (review N9)', () => {
  const parts = [P('c', '일정 계산기'), P('p', '푸시 발송기')];
  // 「일정」 inside the name is no 일정 (schedule) word once 「일정계산기」 is taken out: no start reading from the name itself.
  assert.equal(firstView({ firstLines: ['일정계산기와 푸시발송기'], parts, lines: [L('x', 'c', 'p', 'control')] }).lens, '구성');
  assert.equal(firstView({ firstLines: ['일정 계산기와 푸시 발송기'], parts, lines: [L('x', 'c', 'p', 'control')] }).lens, '구성');
});

test('S10-18 the emphasis keeps the family edge and never thins a selected or summary line (review N1, N6)', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*fv-emph[^{}]*)\{([^}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
  const cards = rules.filter(r => /\.(node|frame)\.fv-emph/.test(r.sel));
  assert.ok(cards.length >= 1);
  for (const r of cards) {
    assert.doesNotMatch(r.body, /border|box-shadow/, `the family border and a lens's lift stay: ${r.sel}`);
    assert.match(r.body, /outline:/); assert.match(r.body, /outline-offset:/, 'a halo apart from the edge');
    for (const one of r.sel.split(',')) assert.ok(one.includes(':not(:focus-visible)'), `the keyboard focus ring wins over the halo: ${one.trim()}`);
  }
  for (const r of rules.filter(x => /--lw/.test(x.body))) for (const not of ['.on', '.agg', '.sum', '.s-dotted', '.s-sparse'])
    assert.ok(r.sel.includes(`:not(${not})`), `a firmer stroke never on ${not}: ${r.sel}`);
});
