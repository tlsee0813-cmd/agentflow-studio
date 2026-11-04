// Display slice S10 (Astra A6), its pure part: the map's first view — the lens, the emphasis, at most two 「안에」 previews and one guide
// line — chosen from the record's own focus (C-HEAD 첫 구조 줄) matched to the map's real structure by three minimal rules, never a kind,
// a ratio or a count; kept per map; a target that disappears drops alone. Fictional readings only. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { firstView, namedParts, nameStem, headQuote, recordOf, readFirstView, writeFirstView, lensChosen, keepExisting, differs, objectJosa, reasonText,
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
  assert.equal(none.lens, '구성'); assert.equal(none.reason.text, `첫 보기: 구성 · ${STRUCTURE_REASON}`);
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
  const group = { nameLines: 1, rows: 2, contract: 0, inner: 0, signs: 0, total: 176, status: 1, members: 1 };
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
