// Map design v3 7 (S5), the pure part: five lenses (구성과 역할 · 데이터 이동 · 시작과 반복 · 상태와 공백 · 시나리오) as emphasis only, the
// legend as the lens's filter (click = select, ⋯ = dim / hide / solo / show all, a head counting what is hidden and dimmed), the
// keys (Alt+1…5, [ ]), the per-map view record, and that switching lens never lays out, routes or re-places a label. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LENSES, DEFAULT_LENS, NO_FILTER, LENS_KEY, lensDef, stepLens, lensLook, lensClasses, legendItems, legendApply, legendHead, legendMarks, lensKey, readLensRecord, writeLensRecord } from '../dist/public/client/view-lens.js';

const part = (id, family, extra = {}) => ({ id, family, type: null, short: '운영 기록 없음', loop: false, unlinked: false, unmapped: 0, ...extra });
const line = (key, channel, extra = {}) => ({ key, channel, badge: false, from: 'a', to: 'b', ...extra });
const PARTS = [part('p1', 'process', { short: '가동 보고', loop: true, unmapped: 2 }), part('p2', 'store', { unlinked: true }), part('p3', 'trigger', { short: '폐기' }), part('p4', 'process', { short: '가동 보고' }), part('p5', 'participant')];
const LINES = [line('d1', 'data', { badge: true }), line('d2', 'data'), line('c1', 'control', { badge: true }), line('u1', 'uses'), line('r1', null), line('sum:x', 'data', { sum: true, badge: true })];

test('LENS-1 five lenses, by name, question and key; the default reads the composition', () => {
  assert.deepEqual(LENSES.map(l => l.name), ['구성과 역할', '데이터 이동', '시작과 반복', '상태와 공백', '시나리오']);
  assert.deepEqual(LENSES.map(l => l.key), ['Alt+1', 'Alt+2', 'Alt+3', 'Alt+4', 'Alt+5']);
  assert.equal(DEFAULT_LENS, 'compose'); assert.equal(lensDef('state').asks, '무엇이 보고됐고 무엇을 모르나');
  assert.equal(stepLens('compose', 1), 'data'); assert.equal(stepLens('compose', -1), 'scenario');
  assert.equal(stepLens('state', 1, id => id !== 'scenario'), 'compose', '시나리오 without a record is skipped');
});

test('LENS-2 a lens only emphasises: each channel\'s opacity and the families it lifts (7.1); nothing is hidden, nothing has a place', () => {
  assert.deepEqual(lensLook('compose').lines, { data: 1, control: 1, uses: 1, related: 1 });
  assert.deepEqual(lensLook('data').lines, { data: 1, control: 0.35, uses: 0.2, related: 0.2 });
  assert.deepEqual(lensLook('start').lines, { data: 0.35, control: 1, uses: 0.35, related: 0.2 });
  assert.deepEqual(lensLook('state').lines, { data: 0.3, control: 0.3, uses: 0.3, related: 0.3 });
  assert.deepEqual(lensClasses('data'), ['lens-data', 'lens-lift-store']);
  assert.deepEqual(lensClasses('start'), ['lens-start', 'lens-lift-trigger']);
  for (const l of LENSES) {
    const look = lensLook(l.id);
    for (const v of Object.values(look.lines)) assert.ok(v > 0 && v <= 1, `${l.id}: dimmed, never hidden`);
    assert.ok(!['x', 'y', 'w', 'h', 'left', 'top', 'width', 'height', 'zoom'].some(k => k in look), 'no geometry in a lens');
  }
});

test('LENS-3 the legend lists what the map draws, counted; nothing it does not have', () => {
  const compose = legendItems('compose', PARTS, LINES);
  assert.deepEqual(compose.map(i => [i.label, i.count]), [['참여자', 1], ['처리', 2], ['저장', 1], ['촉발·관문', 1]], 'no 중립 row: the map has none');
  assert.deepEqual(compose.find(i => i.id === 'family-process').parts, ['p1', 'p4']);
  const data = legendItems('data', PARTS, LINES);
  assert.deepEqual(data.map(i => [i.id, i.count]), [['line-data', 2], ['family-store', 1], ['badge', 2], ['unmapped', 2]]);
  assert.deepEqual(data.find(i => i.id === 'line-data').lines, ['d1', 'd2', 'sum:x'], 'a summary line is outlined with its item, never counted');
  const start = legendItems('start', PARTS, LINES);
  assert.deepEqual(start.map(i => [i.id, i.count]), [['line-control', 1], ['family-trigger', 1], ['loop', 1], ['badge', 2]]);
  const state = legendItems('state', PARTS, LINES);
  assert.deepEqual(state.map(i => [i.label, i.count]), [['가동 보고', 2], ['폐기', 1], ['운영 기록 없음', 2], ['항목 근거 미연결', 1], ['포트 대응 미기록', 2]]);
  assert.deepEqual(legendItems('scenario', PARTS, LINES), [], 'a path reads in the scenario strip');
  assert.deepEqual(legendItems('data', [], []), [], 'an empty map lists nothing');
});

test('LENS-4 the legend as a filter: click selects (again lets go), the menu dims, hides, solos and shows all; the head counts', () => {
  const items = legendItems('compose', PARTS, LINES);
  let s = legendApply(NO_FILTER, { do: 'pick', id: 'family-store' }, items);
  assert.equal(s.picked, 'family-store');
  assert.equal(legendApply(s, { do: 'pick', id: 'family-store' }, items).picked, null, 'again: let go');
  s = legendApply(s, { do: 'dim', id: 'family-process' }, items);
  s = legendApply(s, { do: 'hide', id: 'family-trigger' }, items);
  assert.equal(legendHead(s), '숨김 1 · 흐림 1');
  assert.equal(legendApply(s, { do: 'hide', id: 'family-trigger' }, items).mode['family-trigger'], undefined, 'hide again: shown');
  const m = legendMarks(s, items);
  assert.deepEqual([...m.picked], ['p2']); assert.deepEqual([...m.dim].sort(), ['p1', 'p4']); assert.deepEqual([...m.hide], ['p3']);
  const solo = legendApply(s, { do: 'solo', id: 'family-store' }, items);
  assert.equal(solo.picked, 'family-store');
  assert.deepEqual(Object.keys(solo.mode).sort(), ['family-participant', 'family-process', 'family-trigger']);
  assert.ok(Object.values(solo.mode).every(v => v === 'hide'));
  assert.deepEqual(legendApply(solo, { do: 'all' }, items).mode, {}, '모두 보기');
  assert.deepEqual(legendApply(solo, { do: 'clear' }, items), NO_FILTER, 'Esc');
  assert.equal(legendHead(NO_FILTER), '');
  // A line item marks its lines by key.
  const dm = legendMarks(legendApply(NO_FILTER, { do: 'pick', id: 'line-control' }, legendItems('start', PARTS, LINES)), legendItems('start', PARTS, LINES));
  assert.deepEqual([...dm.picked], ['line:c1']);
});

test('LENS-5 keys: Alt+1…5 pick a lens, [ and ] step, nothing else (Ctrl, plain digits, an unusable lens)', () => {
  assert.equal(lensKey({ key: '2', altKey: true }, 'compose'), 'data');
  assert.equal(lensKey({ key: '5', altKey: true }, 'compose', id => id !== 'scenario'), null);
  assert.equal(lensKey({ key: ']', altKey: false }, 'data'), 'start');
  assert.equal(lensKey({ key: '[', altKey: false }, 'data'), 'compose');
  assert.equal(lensKey({ key: '1', altKey: false }, 'data'), null, '1 is the zoom\'s 100%');
  assert.equal(lensKey({ key: '2', altKey: true, ctrlKey: true }, 'compose'), null);
});

test('LENS-6 the view record per map: lens and legend kept, a broken or missing record reads as the default', () => {
  const raw = writeLensRecord(null, 'map-a', { lens: 'state', legend: { picked: 'short-폐기', mode: { unlinked: 'hide', x: 'dim' } } });
  assert.deepEqual(readLensRecord(raw, 'map-a'), { lens: 'state', legend: { picked: 'short-폐기', mode: { unlinked: 'hide', x: 'dim' } } });
  assert.deepEqual(readLensRecord(raw, 'map-b'), { lens: 'compose', legend: NO_FILTER });
  assert.deepEqual(readLensRecord('{oops', 'map-a'), { lens: 'compose', legend: NO_FILTER });
  assert.deepEqual(readLensRecord(JSON.stringify({ 'map-a': { lens: 'odd', legend: { mode: { a: 'gone' } } } }), 'map-a'), { lens: 'compose', legend: NO_FILTER });
  const two = writeLensRecord(raw, 'map-b', { lens: 'data', legend: NO_FILTER });
  assert.equal(readLensRecord(two, 'map-a').lens, 'state', 'another map\'s record is kept');
  assert.equal(writeLensRecord('[1,2]', 'm', { lens: 'data', legend: NO_FILTER }), JSON.stringify({ m: { lens: 'data', legend: NO_FILTER } }));
  assert.equal(LENS_KEY, 'agentflow.studio.lens.1');
});

test('LENS-7 switching lens or using the legend never lays out, routes or re-places a label (principle 4, 6.3)', async () => {
  const app = await readFile(new URL('../dist/public/client/app.js', import.meta.url), 'utf8');
  const body = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(j, k + 1); } return ''; };
  for (const fn of ['setLens', 'applyLens', 'applyLegendMarks', 'legendAct', 'legendHover', 'renderLegend']) {
    const b = body(fn);
    for (const call of ['renderSpace(', 'relayout(', 'layoutScope(', 'routeEdges(', 'positionWorld(', 'placeEdgeLabels(', 'placeLineLabels(', 'fitView(', 'applyCamera(']) assert.ok(!b.includes(call), `${fn} calls ${call}`);
  }
});
