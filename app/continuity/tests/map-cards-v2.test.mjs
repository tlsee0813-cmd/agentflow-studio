// Spec cards v2 (information placement by intent): the card face at rest (§1), the hover surface (§2, §3, §7), the pane's explicit
// operations line (§4) and the display settings (§5). Pure modules first (card-face, hover-tip, card-family, card-budget), then
// source scans of the built client for what only the DOM shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { opsConflict, OP_VALUE_WORD, statusDot, opsSaid, roleLine, moreText, moreTip, namesOf, ioLine, readDisplay, writeDisplay, clearDisplayOverride, displayUnder, DISPLAY_KEY, DISPLAY_DEFAULT, DOT_LEGEND, DOT_WORD } from '../dist/public/client/card-face.js';
import { hoverMachine, placeTip, HOVER_OPEN_MS, HOVER_GRACE_MS, DIM_AFTER_MS } from '../dist/public/client/hover-tip.js';
import { cardTemplate, cardHeights, kindRows, nameRoomOf, NAME_ROOM, DOT_W, TOGGLE_W } from '../dist/public/client/card-family.js';
import { tierFit } from '../dist/public/client/card-budget.js';
import { legendItems } from '../dist/public/client/view-lens.js';
import { opsText } from '../dist/public/client/ops-line.js';

const facts = (x = {}) => ({ type: null, config: [], inputs: [], outputs: [], fields: [], loop: null, steps: [], conditions: [], ...x });
const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const app = () => readFileSync(new URL('../dist/public/client/app.js', import.meta.url), 'utf8');
const body = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); let d = 0; const j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(j, k + 1); } return ''; };

test('CARD-1 the status dot: a recorded operations state only, shape by kind; no dot for 작업 중, file evidence alone, a lifecycle chip or no record; a conflict is its own mark', () => {
  const run = statusDot({ state: 'running', when: '2026-11-04T08:08Z', grade: 'report' }, '08:08Z');
  assert.deepEqual(run, { kind: 'running', word: '가동 보고', line: '가동 보고 · 08:08Z · 보고 근거', grade: 'report' });
  assert.equal(statusDot({ state: 'stopped', when: null, grade: 'run' }).kind, 'stopped');
  assert.equal(statusDot({ state: 'stopped', when: null, grade: null }).line, '멈춤 보고 · 근거 꼬리표 없음');
  // 작업 중 mixes development and running: no dot, unless the record calls it waiting (an operations state): a ring.
  assert.equal(statusDot({ state: 'working', when: null, grade: 'report' }), null);
  // Cards v2 review M5: only when the record calls it an operations state in so many words (or beside an idle 운영 상태 row); a
  // development wait (「코드 리뷰 대기」) is no ring.
  assert.equal(statusDot({ state: 'working', when: null, grade: 'report', quote: '운영 상태: 대기 [보고]' }).kind, 'waiting');
  assert.equal(statusDot({ state: 'working', when: null, grade: 'report', quote: '기능 구현 작업 중 · 코드 리뷰 대기 [보고]' }), null);
  assert.equal(statusDot({ state: 'working', when: null, grade: 'report', quote: '작업 중 [보고]', ops: [{ value: 'idle' }] }).kind, 'waiting');
  // Review M1: a 유휴·대기 row alone decides nothing (record-reading 4.6), so it draws no dot (every surface says 운영 기록 없음).
  assert.equal(statusDot({ state: null, when: null, grade: null, ops: [{ value: 'idle' }] }), null, 'a 유휴·대기 row alone');
  // Never from file evidence alone; never doubling a lifecycle chip; never for no record or 모름.
  assert.equal(statusDot({ state: 'running', when: null, grade: 'file' }), null);
  assert.equal(statusDot({ state: 'retired', when: null, grade: 'report', life: '폐기' }), null);
  assert.equal(statusDot({ state: 'running', when: null, grade: 'report', life: '설계만' }), null);
  assert.equal(statusDot({ state: null, when: null, grade: null }), null);
  assert.equal(statusDot({ state: 'unknown', when: null, grade: 'report' }), null);
  // Records that disagree: the conflict mark, never one picked (even when the reading's state chose one).
  const c = statusDot({ state: 'running', when: null, grade: 'report', ops: [{ value: 'running' }, { value: 'stopped' }] });
  // Review: the rows in words (never the record's enum spelling).
  assert.equal(c.kind, 'conflict'); assert.equal(c.line, '운영 기록 충돌 · 실행 중 · 정지');
  // Review: rows for different stated ranges are two claims (each of its own range), never a conflict; rows on file evidence alone
  // make no mark either.
  assert.equal(statusDot({ state: 'running', when: null, grade: 'report', ops: [{ value: 'running', scope: 'API' }, { value: 'idle', scope: '배치' }] }).kind, 'running');
  assert.equal(statusDot({ state: 'running', when: null, grade: 'report', ops: [{ value: 'running', scope: 'API' }, { value: 'stopped', scope: ' API ' }] }).line, '운영 기록 충돌 · 실행 중(API) · 정지( API )');
  assert.equal(statusDot({ state: 'running', when: null, grade: 'file', ops: [{ value: 'running', grade: 'file' }, { value: 'stopped', grade: 'file' }] }), null);
  assert.equal(opsConflict([{ value: 'running', grade: 'file' }, { value: 'stopped', grade: 'report' }]).length, 2, 'one row on a report is enough');
  assert.equal(statusDot({ state: 'stopped', when: null, grade: 'report', ops: [{ value: 'stopped' }, { value: 'failed' }] }).kind, 'stopped', 'failed and stopped are one kind');
  // Never 멈춤 from age: an old running report stays a running report (the function reads no clock).
  assert.equal(statusDot({ state: 'running', when: '2020-01-01T00:00Z', grade: 'report' }).kind, 'running');
  assert.deepEqual(Object.values(DOT_WORD), ['가동 보고', '멈춤 보고', '대기 보고', '운영 기록 충돌']);
  assert.equal(DOT_LEGEND, '점: 기록된 운영 상태만 · 점 없음 = 상태 미확인');
  assert.equal(opsSaid('가동 보고', '08:08Z', 'report'), '가동 보고 · 기준 08:08Z · 보고 근거');
  assert.equal(opsSaid(null, null, null), null, 'no record: nothing in the hover (the pane says it)');
});

test('CARD-2 the role line, counted 「외 N」 and the hover card\'s inputs → outputs', () => {
  assert.equal(roleLine('  주문을 받아 검증한다. 그 뒤 저장소에 쓴다.'), '주문을 받아 검증한다.');
  assert.equal(roleLine('마침표 없는 설명'), '마침표 없는 설명');
  assert.equal(roleLine(''), null); assert.equal(roleLine(null), null);
  assert.equal(moreText(2), '외 2'); assert.equal(moreTip(2, '받는 것'), '받는 것 2개 더');
  assert.equal(namesOf(['a', 'b', 'c', 'd']), 'a · b 외 2'); assert.equal(namesOf(['a']), 'a');
  assert.equal(ioLine(['명령', '설정', '환경'], ['결과']), '받는 것 명령 · 설정 외 1\n내는 것 결과');
  assert.equal(ioLine([], ['결과']), '받는 것 미기록\n내는 것 결과');
  assert.equal(ioLine([], []), null);
});

test('CARD-3 display settings: defaults, a global default, an explicit per-project override, a cleared override, unreadable storage; lenses never write', () => {
  assert.deepEqual(DISPLAY_DEFAULT, { ops: false, values: false, labels: true, evidence: false });
  const kv = store();
  assert.deepEqual(readDisplay(kv, 'p1'), { settings: DISPLAY_DEFAULT, own: false });
  assert.ok(writeDisplay(kv, 'p1', { ...DISPLAY_DEFAULT, ops: true }, false));
  assert.deepEqual(readDisplay(kv, 'p2').settings.ops, true, 'not only: the global default');
  assert.ok(writeDisplay(kv, 'p2', { ...DISPLAY_DEFAULT, values: true }, true));
  assert.deepEqual(readDisplay(kv, 'p2'), { settings: { ...DISPLAY_DEFAULT, values: true }, own: true });
  assert.equal(readDisplay(kv, 'p1').settings.values, false, 'another project keeps the global default');
  assert.ok(clearDisplayOverride(kv, 'p2'));
  assert.deepEqual(readDisplay(kv, 'p2'), { settings: { ...DISPLAY_DEFAULT, ops: true }, own: false });
  // Writing the global default from a project with an override drops that override.
  writeDisplay(kv, 'p3', { ...DISPLAY_DEFAULT, evidence: true }, true); writeDisplay(kv, 'p3', { ...DISPLAY_DEFAULT, labels: false }, false);
  assert.deepEqual(readDisplay(kv, 'p3'), { settings: { ...DISPLAY_DEFAULT, labels: false }, own: false });
  assert.ok(kv.m.has(DISPLAY_KEY));
  // Unreadable, malformed or refusing storage reads as the defaults; a write that throws says so.
  const bad = { getItem: () => '{nope', setItem: () => { throw new Error('full'); } };
  assert.deepEqual(readDisplay(bad, 'p1').settings, DISPLAY_DEFAULT);
  assert.equal(writeDisplay(bad, 'p1', DISPLAY_DEFAULT, false), false);
  assert.deepEqual(readDisplay({ getItem: () => JSON.stringify({ global: { ops: 'yes', labels: false }, projects: { x: { values: 1 } } }) }, 'x').settings, { ...DISPLAY_DEFAULT, labels: false }, 'only booleans are read');
  assert.deepEqual(readDisplay(null, 'x').settings, DISPLAY_DEFAULT);
  // The 상태·공백 lens shows every card's ops word while it is on, without changing what is stored.
  const s = { ...DISPLAY_DEFAULT };
  assert.deepEqual(displayUnder(s, 'state'), { ...s, ops: true, opsAll: true });
  assert.deepEqual(displayUnder(s, 'compose'), { ...s, opsAll: false });
  assert.deepEqual(s, DISPLAY_DEFAULT);
});

test('CARD-4 the hover machine: 400 ms dwell, 150 ms grace, hoverable, Esc, one surface (a new target while open moves at once)', () => {
  assert.equal(HOVER_OPEN_MS, 400); assert.equal(HOVER_GRACE_MS, 150); assert.equal(DIM_AFTER_MS, HOVER_OPEN_MS);
  let now = 0; const jobs = [], log = [];
  const timers = { set: (fn, ms) => { jobs.push({ at: now + ms, fn, id: jobs.length + 1 }); return jobs.length; }, clear: id => { const j = jobs.find(x => x.id === id); if (j) j.fn = null; } };
  const run = ms => { now += ms; for (const j of jobs) if (j.fn && j.at <= now) { const f = j.fn; j.fn = null; f(); } };
  const m = hoverMachine({ show: t => log.push(`show ${t}`), hide: () => log.push('hide') }, timers);
  m.enter('A'); run(399); assert.deepEqual(log, [], 'nothing before the dwell'); run(1); assert.deepEqual(log, ['show A']);
  m.leave(); run(149); assert.equal(m.shown, true); m.tipEnter(); run(500); assert.equal(m.shown, true, 'persists while the pointer is on it');
  m.tipLeave(); run(150); assert.deepEqual(log, ['show A', 'hide']);
  // Passing over: a target left before the dwell never opens.
  m.enter('B'); run(200); m.leave(); run(500); assert.equal(log.length, 2);
  // One surface: a new target while one is open shows at once (no second dwell); back to the same target inside the grace keeps it.
  m.enter('C'); run(400); m.leave(); run(50); m.enter('D'); assert.deepEqual(log.slice(2), ['show C', 'show D']);
  m.leave(); run(100); m.enter('D'); run(300); assert.equal(m.shown, true); assert.equal(log.length, 4);
  m.dismiss(); assert.deepEqual(log.slice(4), ['hide'], 'Esc, a drag, a pan or a zoom closes it at once');
  m.enter('E', true); assert.deepEqual(log.slice(5), ['show E'], 'immediate (a confirmed target)');
});

test('CARD-5 anchored placement: beside a card (never over it, so never over its name), at a line point off its end cards, keeping its side', () => {
  const bounds = { x: 0, y: 0, w: 1000, h: 700 }, card = { x: 100, y: 100, w: 272, h: 160 }, size = { w: 240, h: 120 };
  const r = placeTip(card, size, bounds, 'beside');
  assert.equal(r.side, 'right'); assert.equal(r.x, 100 + 272 + 8); assert.equal(r.y, 100);
  const edge = placeTip({ x: 700, y: 100, w: 272, h: 160 }, size, bounds, 'beside');
  assert.equal(edge.side, 'left'); assert.ok(edge.x + size.w <= 700, 'flips to the left, off the card');
  // Kept on the side it took while it still fits (no flip on every move).
  assert.equal(placeTip(card, size, bounds, 'beside', [], 'below').side, 'below');
  // A line point: below-right of it, else elsewhere off the end cards.
  const ends = [{ x: 300, y: 300, w: 272, h: 160 }];
  const p = placeTip({ x: 290, y: 280, w: 0, h: 0 }, size, bounds, 'point', ends);
  const box = { x: p.x, y: p.y, w: size.w, h: size.h }, hit = a => box.x < a.x + a.w && a.x < box.x + box.w && box.y < a.y + a.h && a.y < box.y + box.h;
  assert.ok(!ends.some(hit), JSON.stringify(p));
  // Always inside the bounds.
  const corner = placeTip({ x: 980, y: 690, w: 0, h: 0 }, size, bounds, 'point');
  assert.ok(corner.x >= 0 && corner.x + size.w <= 1000 && corner.y >= 0 && corner.y + size.h <= 700);
});

test('CARD-6 the card face: no blank rows, no store relation counts, value rows only behind the setting, the role line and the foot in the heights', () => {
  const st = cardTemplate(facts({ type: 'store', writers: 2, readers: 1, inputs: ['행'], outputs: ['행'] }));
  assert.deepEqual(st.rows, [], 'no 「관계 쓰는 쪽 · 읽는 쪽」, no 「행 형식 ?」');
  assert.deepEqual(st.blanks, ['행 형식']); assert.deepEqual(st.contract, { kind: 'values', rows: [] });
  assert.equal(cardTemplate(facts({ type: 'store', inputs: ['행'], values: true })).contract.rows[0].label, '쓰기', 'the setting turns them back on');
  // A kind's blank gives its room to a row that says something (blanks: false keeps the rows).
  assert.deepEqual(kindRows(facts({ type: 'actor', outputs: ['주문 제출'] }), { blanks: false }), [{ label: '효과', value: '주문 제출', unlinked: true }]);
  // Pins stay (their line ends attach there) whatever the setting.
  assert.equal(cardTemplate(facts({ pins: { in: ['명령'], out: [] } })).contract.kind, 'pins');
  const plain = cardTemplate(facts({ type: 'compute' })), roled = cardTemplate(facts({ type: 'compute', role: '평균을 낸다.' })), footed = cardTemplate(facts({ type: 'compute', foot: true }));
  assert.equal(roled.role, '평균을 낸다.'); assert.equal(plain.role, null);
  assert.equal(cardHeights(roled, 1).rows - cardHeights(plain, 1).rows, 28, 'one line and its gap');
  assert.equal(cardHeights(plain, 1).bottom, 0); assert.equal(cardHeights(footed, 1).bottom, 28);
  assert.equal(cardTemplate(facts({ signs: true })).foot, true, 'signs sit in the foot');
  // The name keeps clear of the status dot's fixed place.
  assert.equal(nameRoomOf(false, false), NAME_ROOM); assert.equal(nameRoomOf(true, true), NAME_ROOM - TOGGLE_W - DOT_W);
});

test('CARD-7 the card budget: the role line takes the room the ops line took at 중간, right after the kind line; none at 개요; a card with no foot draws none', () => {
  const shape = x => ({ nameLines: 1, rows: 2, contract: 0, inner: 24, signs: 0, total: 200, status: 0, role: 1, foot: 1, ...x });
  const mid = tierFit(shape(), 0.77, 'mid');
  assert.equal(mid.role, true); assert.equal(mid.bottom, true);
  const tight = tierFit(shape({ total: 120 }), 0.77, 'mid');
  assert.equal(tight.role, true, 'before the rows and the inner line'); assert.equal(tight.rows, 0);
  assert.equal(tierFit(shape(), 0.54, 'far').role, false);
  assert.equal(tierFit(shape({ foot: 0 }), 0.77, 'mid').bottom, false);
  assert.equal(tierFit(shape({ foot: 0 }), 1, 'near').bottom, false);
  assert.equal(tierFit(shape(), 1, 'near').role, true);
  // Review B1: the sign chips sit in the foot, so they show whenever the foot does (near and 중간) and never take room of their own.
  for (const [k, t] of [[1, 'near'], [0.77, 'mid'], [0.62, 'mid']]) { const f = tierFit(shape({ signs: 1 }), k, t); assert.equal(f.signs, f.bottom, `${t} ${k}`); assert.equal(f.signs, true, `${t} ${k}`); }
  assert.equal(tierFit(shape({ signs: 1, foot: 0 }), 1, 'near').signs, false, 'no foot, no chips');
  assert.equal(tierFit(shape({ signs: 1 }), 0.54, 'far').signs, false);
  const without = tierFit(shape({ total: 150 }), 0.77, 'mid'), withSigns = tierFit(shape({ total: 150, signs: 1 }), 0.77, 'mid');
  assert.deepEqual({ ...withSigns, signs: false }, without, 'the chips cost nothing else');
});

test('CARD-9 review fixes: the legend marks, the record\'s own 모름, one word for a conflict, a placement that covers the least', () => {
  assert.equal(opsText('unknown', null), '상태 미상(기록)', 'reads apart from 운영 기록 없음');
  const parts = [{ id: 'a', short: '운영 기록 없음' }, { id: 'b', short: '상태 미상(기록)' }, { id: 'c', short: '운영 기록 충돌' }].map(x => ({ family: 'process', type: null, loop: false, unlinked: false, unmapped: 0, ...x }));
  const marks = Object.fromEntries(legendItems('state', parts, []).filter(x => x.id.startsWith('short-')).map(x => [x.label, x.sample.text]));
  // Polish round fixes 2: the record's 「모름」 in a reader's words; a part with no record is no legend item (it steps back on the map).
  assert.deepEqual(marks, { '운영 기록 충돌': '◇', '기록에 「모름」으로 적힘': '…' });
  assert.equal(OP_VALUE_WORD.idle, '유휴·대기');
  // Nothing clear anywhere: the side that covers the least (never simply the first side over a lit neighbour's name).
  const bounds = { x: 0, y: 0, w: 600, h: 400 }, card = { x: 200, y: 100, w: 200, h: 150 }, size = { w: 190, h: 140 };
  const right = { x: 400, y: 0, w: 200, h: 400 }, leftName = { x: 0, y: 100, w: 150, h: 20 };
  const p = placeTip(card, size, bounds, 'beside', [right, leftName, { x: 0, y: 260, w: 600, h: 140 }, { x: 0, y: 0, w: 600, h: 90 }]);
  assert.equal(p.side, 'left', JSON.stringify(p));
});

test('CARD-8 the built card and map: no ops footer, no c-short, no card title; the dot, ⤢ / ▸ N / 연결 N, § ◇ Δ, data-tip targets, line parts in the hover, the 표시 popover', () => {
  const src = app(), card = body(src, 'cardEl');
  for (const gone of ["'c-short", "class: 'c-ops'", 'title: extra.title', '내부 보기\')', "class: `ev ev-${ev}`, title"]) assert.ok(!card.includes(gone), gone);
  for (const here of ['c-dot', 'openOps(', "'⤢'", 'c-role', 'c-opsw', 'data-tip', 'c-state', 'moreText(']) assert.ok(card.includes(here), here);
  assert.ok(/el\.querySelectorAll\(["']\[title\]["']\)/.test(card), 'native titles left in a card read through the one tip');
  const space = body(src, 'renderSpace');
  assert.ok(space.includes('cardEnter(p)') && space.includes("'▸'") && space.includes('linksChip(p.id, true)'));
  assert.ok(!/cardEl\([^)]*\btitle,/.test(space), 'renderSpace passes no title to a typed card');
  assert.ok(body(src, 'signTabsEl').includes('SIGN_GLYPH') && /rule: '§', gate: '◇', change: 'Δ'/.test(src));
  // The hover: one machine, line parts are targets of the line, Esc first, no hover while dragging, panning or zooming.
  const hov = body(src, 'bindEdgeHints');
  for (const here of ['hoverMachine(', '.edge-labels > [data-key]', '[data-badge]', '[data-once]', "e.key === 'Escape' && hover?.shown", 'hoverStop(300)', 'placeTip(', 'DIM_AFTER_MS']) assert.ok(hov.includes(here), here);
  assert.ok(!hov.includes('pointermove'), 'the popup never follows the pointer');
  assert.ok(/'data-key': e\.key/.test(body(src, 'placeCounts')), 'the count chip joins its line');
  assert.ok(body(src, 'lineHit').includes('edge-labels'), 'a press on a label picks its line');
  // The pane: the operations line always, the blanks in words, the store's writers and readers by name.
  // Restore (spec-cards-v2 §4): the pane says 「운영 기록 없음」 as its quiet operations line (the map does not); records that disagree still read.
  assert.ok(body(src, 'opsLineEl').includes("'운영 기록 없음 · 이 부분의 가동·멈춤을 말한 기록이 없음'") && body(src, 'opsLineEl').includes("class: 'pane-ops-line none'") && body(src, 'opsLineEl').includes('하나로 고르지 않음'));
  assert.ok(body(src, 'blanksLine').includes('미기록'));
  assert.ok(body(src, 'storeLine').includes('nm(writerIds)') && !body(src, 'storeLine').includes('`쓰기 ${writers} · 읽기 ${readers}`'));
  assert.ok(body(src, 'kindLine').includes('pane-ops-line'));
  assert.ok(body(src, 'focusOpsLine').includes('.pane-ops-line'));
  // The 표시 popover sits in the toolbar after the lens switch and the first view's guide; four toggles and 「이 프로젝트에서만」.
  const html = readFileSync(new URL('../dist/public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="first-view"[^>]*><\/div>\s*<span class="display-wrap"><button type="button" id="display-toggle"[^>]*aria-controls="display-menu"/);
  assert.ok(body(src, 'renderDisplayMenu').includes('이 프로젝트에서만') && body(src, 'renderDisplayMenu').includes('DISPLAY_KEYS'));
  const css = readFileSync(new URL('../dist/public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.edge-labels > :is\(\.edge-label, \.edge-badge, \.edge-count, \.edge-once\) \{ pointer-events: auto/);
  assert.match(css, /\.edge-tip\.hoverable \{ pointer-events: auto; \}/);
  assert.match(css, /\.c-dot\.d-stopped::before \{[^}]*background: var\(--dot-stop\)/);
  assert.ok(!/animation[^;]*(pulse|blink)/i.test(css.slice(css.indexOf('Cards v2 (spec cards v2'))), 'no pulse, no blink');
  assert.match(css, /--dot-stop: #9c8a62/, 'stopped is grey-amber, not red');
  // Cards v2 review.
  assert.ok(card.includes('${signs ? 1 : 0},${extra.boxH}'), 'B1: the shape carries the sign chips (no literal 0)');
  assert.ok(/hoverLast\.el === x\.el/.test(hov) && body(src, 'renderSpace').includes('hoverStop()'), 'M6: a redraw drops the held target; a key is the same target only on the same element');
  assert.ok(hov.includes("$('viewport').getBoundingClientRect()") && hov.includes('.near-end, .near-self') && hov.includes('.c-head'), 'tips stay in the map area, off lit neighbours and names');
  assert.ok(hov.includes('hoverQuiet') && !hov.includes('누르면 출발 부분을 고르고'), 'a picked card keeps its tip shut; no click hint');
  assert.ok(!hov.includes('실선 · 채운 머리'), 'no stroke vocabulary in the line tip');
  assert.ok(hov.includes('conditionTip(s.when)') && body(src, 'relationLines').includes('(conditionWords(x.when))'), 'M3: each relation row says its condition (polish round: 「조건: …」, the form word left off)');
  assert.ok(body(src, 'cardIo').includes('relationEnds('), 'the hover card falls back to the lines the pane reads');
  assert.ok(body(src, 'fitCards').includes("'fit-auto'") && /\.node\.card\.fit-auto \{ height: auto !important/.test(css), 'cards below 가까이 at their content height');
  assert.ok(!/title: `양쪽으로/.test(body(src, 'placeCounts')) && !/title: `데이터 계약/.test(body(src, 'typeChipEl')), 'one hover surface: no native titles on line parts');
});

test('CARD-10 polish round (spec-cards-v2 §1): 포트 대응 미기록, 유지 상태 and the 프로그램 chips are off the card face and out of its height; each stays reachable', () => {
  // The pin area is its title and rows: unmapped lines add no height (contract.unmapped stays as data, for the pin head's tip).
  const pins = (unmapped) => facts({ type: 'loop', loop: { unit: '명령별', stop: null, resume: null }, pins: { in: ['명령 목록'], out: ['측정 결과'] }, unmapped });
  const t2 = cardTemplate(pins(2));
  assert.equal(t2.contract.unmapped, 2);
  assert.deepEqual(cardHeights(t2, 1), cardHeights(cardTemplate(pins(0)), 1));
  // A loop container's well has no kept-state compartment and is measured without one.
  const steps = Array.from({ length: 4 }, (_, i) => ({ name: `단계${i + 1}`, does: null }));
  const kept = cardTemplate(facts({ type: 'loop', loop: { unit: '명령마다', stop: null, resume: null }, steps, stateVars: 3 }));
  const none = cardTemplate(facts({ type: 'loop', loop: { unit: '명령마다', stop: null, resume: null }, steps }));
  assert.ok(kept.well); assert.equal(kept.well.state, null);
  assert.equal(cardHeights(kept, 1).total, cardHeights(none, 1).total);
  const src = app(), card = body(src, 'cardEl'), well = body(src, 'wellEl');
  assert.ok(!card.includes('c-cline') && !card.includes('포트 대응 미기록 ${c.unmapped}`)'), 'no unmapped line on the card');
  assert.ok(card.includes("'c-pin-head', ...(c.unmapped ?"), 'the pin head says the unmapped count in its tip');
  assert.ok(!/progChip|stepChip|prog-chip/.test(card) && !/progChip|stepChip|w-state/.test(well), 'no 프로그램 chip nor 유지 상태 compartment on the card');
  assert.ok(well.includes('PROGRAM_STEP_HINT') && well.includes('프로그램이 옮긴 값'), 'the provenance reads in the well rows\' and badges\' tips');
  // Reachable elsewhere: the lenses count unmapped lines and unlinked kept state; the pane and the detail view keep the chips.
  assert.ok(body(src, 'lensPartsOf').includes('(f?.stateVars ?? 0) > 0'));
  assert.ok(/stepChip\(\)/.test(body(src, 'renderDetail')) || /stepChip\(\)/.test(src.slice(src.indexOf('function renderDetail'))), 'the detail view keeps the program chip');
  // The detail view's side and the short expansion: no 「운영 기록 없음」 under the name (a recorded state's words stay); the map's pane keeps it.
  const css = readFileSync(new URL('../dist/public/styles.css', import.meta.url), 'utf8');
  // Polish round fixes 1: only the quiet line hides beside the detail view; a conflict note in the same block stays.
  assert.ok(css.includes('.space.detail-open .pane-ops-line.none { display: none; }') && !/\.space\.detail-open \.pane-ops-notes[^{]*\{ display: none/.test(css));
  assert.ok(card.includes("'data-tip': `${x.label} · 기록에서 프로그램이 옮긴 값`"), 'a program row says so in its tip');
  assert.ok(body(src, 'shortContent').includes("r.stateRead ? h('span', { class: 'xp-ops'"));
  // Restore (spec-cards-v2 §4): the map's pane still states it; only beside the detail view does the quiet line hide.
  assert.ok(body(src, 'opsLineEl').includes('운영 기록 없음 · 이 부분의 가동·멈춤을 말한 기록이 없음'), 'the map\'s pane states it');
  // The map head's basis line: the time and the version only; the rest in its tip.
  const basis = body(src, 'basisLine');
  assert.ok(basis.includes('`설계 근거 · ${last.basisAt ?? \'작성 시각 미상\'} · 판본 ${version}`') && basis.includes('운영: 보고된 상태 (기록 없음은 제공된 자료 기준)'));
});

test('CARD-11 polish round fixes 1: the 상태·공백 lens marks recorded states and keeps 「운영 기록 없음」 off the cards; framed ways in with their words; no ghost outline; ⤢ alone takes no foot; a short first screen', () => {
  const src = app(), card = body(src, 'cardEl'), css = readFileSync(new URL('../dist/public/styles.css', import.meta.url), 'utf8');
  // The lens: a recorded state takes the kind line whole, led by its mark; no record is the quiet 「–」 (its words hidden).
  assert.ok(card.includes("'data-mark'") && card.includes('OPS_MARK[dot.kind]') && card.includes("'c-opsw-t'"));
  assert.ok(css.includes('.space.lens-state .node.card .c-kind:has(> .c-opsw:not(.ops-none)) > :not(.c-opsw) { display: none; }'));
  assert.ok(css.includes('.space.lens-state .node.card .c-opsw.ops-none { display: none; }'));
  assert.ok(!css.includes('.space.lens-state:is(.tier-far, .tier-dots) .node.card .c-opsw::before { content: none; }'), 'the mark stays when zoomed out');
  // The ways in: 「안쪽 N ▸」 and 「상세 ⤢」 framed at rest, their words gone only at 개요; the head's 펼치기 is its own glyph.
  assert.ok(src.includes("'안쪽 '") && card.includes("'상세'") && card.includes("'⤢'"));
  assert.ok(!card.includes('제자리에 들어가면 펼치고'), 'a short ⤢ tip');
  assert.match(css, /\.node\.card \.c-entry \.c-enter \{ height: calc\(var\(--t-bottom, 28px\) - 6px\);[^}]*border-color: var\(--line\)/);
  assert.ok(src.includes('plusGlyph()') && src.includes('toggleButton(p, false, true)'));
  // No dashed ghost under a card; a card whose only way in is ⤢ has no foot row (its height has none either).
  assert.ok(css.includes('.node.card.fit-auto.fit-ghost::after { content: none; }'));
  assert.ok(card.includes('floatOpen') && card.includes("'c-entry c-corner'") && body(src, 'cardFactsOf').includes('foot: p.childIds.length > 0,'));
  // The first screen: 기록 정보 ▾ folds the title's meta lines; the toolbar's first view is a few words, its sentence the tip; the
  // opening view centres the first view's parts (else the main flow) when the map does not fit.
  assert.ok(src.includes("'기록 정보 ▾'") && css.includes('.map-title:not(.meta-open) > .map-meta { display: none; }'));
  assert.ok(body(src, 'renderFirstView').includes('`첫 보기 · ${'));
  assert.ok(body(src, 'fitView').includes('openFocus()') && body(src, 'openFocus').includes('lay.spine'));
  assert.ok(src.includes("'요청·보고 없음'") && !src.includes("none: ['기록 없음'"));
  // A pointed line reads apart: accent, its mates faded at once, raised in its layer.
  assert.ok(css.includes('.edge.near .edge-line { stroke: var(--accent); --lw: 2.5;') && css.includes('.space.line-near .edge:not(.near):not(.on) .edge-line { opacity: .3; }'));
  assert.ok(src.includes("space.classList.add('line-near')") && src.includes("space.classList.remove('line-near')"));
});
