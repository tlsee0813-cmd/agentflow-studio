// Spec cards v2 (information placement by intent): the card face at rest (§1), the hover surface (§2, §3, §7), the pane's explicit
// operations line (§4) and the display settings (§5). Pure modules first (card-face, hover-tip, card-family, card-budget), then
// source scans of the built client for what only the DOM shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { statusDot, opsSaid, roleLine, moreText, moreTip, namesOf, ioLine, readDisplay, writeDisplay, clearDisplayOverride, displayUnder, DISPLAY_KEY, DISPLAY_DEFAULT, DOT_LEGEND, DOT_WORD } from '../dist/public/client/card-face.js';
import { hoverMachine, placeTip, HOVER_OPEN_MS, HOVER_GRACE_MS, DIM_AFTER_MS } from '../dist/public/client/hover-tip.js';
import { cardTemplate, cardHeights, kindRows, nameRoomOf, NAME_ROOM, DOT_W, TOGGLE_W } from '../dist/public/client/card-family.js';
import { tierFit } from '../dist/public/client/card-budget.js';

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
  assert.equal(statusDot({ state: 'working', when: null, grade: 'report', quote: '상태: 대기 중 [보고]' }).kind, 'waiting');
  assert.equal(statusDot({ state: null, when: null, grade: null, ops: [{ value: 'idle' }] }).kind, 'waiting', 'a 유휴·대기 row alone');
  // Never from file evidence alone; never doubling a lifecycle chip; never for no record or 모름.
  assert.equal(statusDot({ state: 'running', when: null, grade: 'file' }), null);
  assert.equal(statusDot({ state: 'retired', when: null, grade: 'report', life: '폐기' }), null);
  assert.equal(statusDot({ state: 'running', when: null, grade: 'report', life: '설계만' }), null);
  assert.equal(statusDot({ state: null, when: null, grade: null }), null);
  assert.equal(statusDot({ state: 'unknown', when: null, grade: 'report' }), null);
  // Records that disagree: the conflict mark, never one picked (even when the reading's state chose one).
  const c = statusDot({ state: 'running', when: null, grade: 'report', ops: [{ value: 'running' }, { value: 'stopped' }] });
  assert.equal(c.kind, 'conflict'); assert.match(c.line, /^운영 기록 충돌 · running · stopped/);
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
  assert.equal(ioLine(['명령', '설정', '환경'], ['결과']), '명령 · 설정 외 1 → 결과');
  assert.equal(ioLine([], ['결과']), '받는 것 미기록 → 결과');
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
  assert.ok(body(src, 'opsLineEl').includes('운영 기록 없음 · 이 부분의 가동·멈춤을 말한 기록이 없음') && body(src, 'opsLineEl').includes('하나로 고르지 않음'));
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
});
