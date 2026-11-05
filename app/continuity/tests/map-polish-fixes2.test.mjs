// Polish round fixes 2 (spec-cards-v2; the user: no 「운영 기록 없음」 on the map, nothing crammed onto one screen, show what is wanted
// where it is looked at): station numbers and condition words on the 노선, the skip tag's wording, a line tip that never covers its end
// card's name on a dense map, the 상태·공백 lens stepping back the parts with nothing to say, whole-word line labels, the whole-map
// name's second line, and the pane without the record's bookkeeping. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stepLine, formStep, skipWord, UNSTORED } from '../dist/public/client/view-forms.js';
import { placeTip } from '../dist/public/client/hover-tip.js';
import { lensOffTopic, legendItems, stateMark, NO_RECORD, legendChip } from '../dist/public/client/view-lens.js';
import { wholeWords } from '../dist/public/client/line-grammar.js';
import { tierFit } from '../dist/public/client/card-budget.js';

const step = (ref, name, x = {}) => formStep({ recordRef: ref, name, does: null, branch: x.branch ?? [], alt: x.alt ?? null, loopIds: x.loopIds ?? [], when: x.cell ?? null });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('PF2-1 the 노선 numbers its stations 1, 2, 3 and names a condition row by its words, never S01 or CD13', () => {
  const g = { ids: new Set(['CD13']), names: new Map([['CD13', '큐 이름이 처음 보임']]) };
  const steps = [step('B20:S01', '받기'), step('B20:S02', '새 큐', { branch: [{ when: null, to: [], max: null, outcome: 'CD13' }], cell: '→ CD13' }), step('B20:S05', '보내기'), step('B20:S06', '끝')];
  const l = stepLine(steps, [], [], { gloss: g });
  assert.deepEqual(l.stations.map(s => s.no), ['1', '2', '3', '4']);
  const ex = l.stations[1].exits;
  assert.equal(ex.length, 1); assert.equal(ex[0].text, '→ 조건 ‘큐 이름이 처음 보임’'); assert.match(ex[0].tip, /CD13/, 'the row ID stays in the tip');
  // A pointer to a condition row decides by that condition: the line after the station is conditional, never broken.
  assert.ok(!l.segments.some(s => s.open && s.y1 === l.stations[1].y), 'not an unconditional end');
  // With no gloss the outcome still reads as a condition, never as the bare ID.
  assert.equal(stepLine(steps, [], []).stations[1].exits[0].text, '→ 조건으로');
  for (const s of l.stations) for (const e of s.exits) assert.doesNotMatch(e.text, /\b(?:S\d{2}|CD\d{2}|B\d{2}:)/);
});

test('PF2-2 a skipped segment says the rows are in the record (only the map\'s stored steps lack them)', () => {
  assert.equal(skipWord(3), '기록에만 있는 단계 3개');
  assert.doesNotMatch(skipWord(3), /표에 없는|기록에 없는/);
  assert.doesNotMatch(UNSTORED, /표에 없는|기록에 없는/);
  const app = readFileSync(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  assert.ok(!app.includes('「사이 행 n개 없음」') && app.includes('「기록에만 있는 단계 n개」'));
});

test('PF2-3 a line tip on a dense map keeps off its end card\'s name: the other cards are a preference, never a reason to cover an end', () => {
  const bounds = { x: 0, y: 0, w: 1000, h: 700 }, size = { w: 300, h: 172 }, pt = { x: 500, y: 350, w: 0, h: 0 };
  const endCard = { x: 480, y: 120, w: 260, h: 140 }, endHead = { x: 480, y: 120, w: 260, h: 40 };
  // Cards everywhere else: no side is clear of them.
  const cards = [];
  for (let x = 0; x < 1000; x += 270) for (let y = 0; y < 700; y += 160) cards.push({ x, y, w: 250, h: 140 });
  const at = placeTip(pt, size, bounds, 'point', [endCard, endHead], null, 8, cards);
  const r = { x: at.x, y: at.y, ...size };
  assert.ok(!overlap(r, endHead) && !overlap(r, endCard), JSON.stringify(at));
  // A clear place still wins over one that covers another card.
  const free = placeTip(pt, size, bounds, 'point', [endCard], null, 8, [{ x: 600, y: 400, w: 200, h: 200 }]);
  assert.ok(!overlap({ x: free.x, y: free.y, ...size }, { x: 600, y: 400, w: 200, h: 200 }));
});

test('PF2-4 the 상태·공백 lens steps back the parts whose state no record says and marks the rest; its legend leads with what was recorded', () => {
  const P = (id, short, unlinked = false) => ({ id, family: 'process', type: null, short, loop: false, unlinked, unmapped: 3 });
  const parts = [P('a', '가동 보고'), P('b', NO_RECORD), P('c', NO_RECORD, true), P('d', '상태 미상(기록)')];
  assert.deepEqual([...lensOffTopic('state', parts, [])], ['b', 'c']);
  assert.equal(lensOffTopic('state', [P('x', NO_RECORD)], []).size, 0, 'never every card');
  assert.deepEqual(parts.map(stateMark), ['●', null, null, '…']);
  const items = legendItems('state', parts, []);
  assert.deepEqual(items.map(i => i.label), ['가동 보고', '기록에 「모름」으로 적힘', '확인이 필요한 부분']);
  assert.ok(!items.some(i => i.id === 'unmapped' || i.label === NO_RECORD));
  assert.equal(legendChip('state', items), '상태·공백 · 가동 보고 1 · 기록에 「모름」으로 적힘 1 · 외 1개');
});

test('PF2-5 a shortened line label keeps whole words or nothing (its words in the tip)', () => {
  assert.equal(wholeWords('기동 · 명령 torch.compile 실행'), '기동 · 명령');
  assert.equal(wholeWords('input.txt · train.bin 만들기'), 'input.txt');
  assert.equal(wholeWords('고정 질의 "Is AI good?"'), '고정 질의');
  assert.equal(wholeWords('Poll·Heartbeat 보내기'), 'Poll·Heartbeat'); assert.equal(wholeWords('Poll·Heartbeat·Status 보고 보내기'), 'Poll·Heartbeat');
  assert.equal(wholeWords('짧은 이름'), '짧은 이름');
  assert.equal(wholeWords('ExtremelyLongIdentifierName'), '', 'not even its first word: no label');
});

test('PF2-6 at the whole-map view a card\'s name takes its second line before the kind line when the box has room', () => {
  const shape = { nameLines: 1, rows: 0, contract: 0, inner: 0, signs: 0, total: 264, status: 0 };
  const f = tierFit(shape, 0.31, 'far');
  assert.equal(f.nameLines, 2);
  const css = readFileSync(new URL('../dist/public/styles.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.space:is(.tier-far, .tier-dots) .node.card :is(.glyph-tile, .c-loop-tab) { display: none; }'), 'nothing beside the name at the whole-map tiers');
  assert.ok(/\.w-badge \{ display: inline-block;[^}]*min-width: 0;/.test(css), 'a step-head chip draws its ellipsis');
});

test('PF2-7 the pane opens on what the part does: the quiet 「운영 기록 없음」 line (restored, spec §4), the record ladder in 근거; uses chips by name', () => {
  const src = readFileSync(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  const body = (name) => { const i = src.indexOf(`function ${name}(`); return src.slice(i, src.indexOf('\n}\n', i)); };
  assert.ok(body('opsLineEl').includes("'운영 기록 없음 · 이 부분의 가동·멈춤을 말한 기록이 없음'"));
  assert.ok(!body('kindLine').includes('ladderLine('), 'the ladder chips stay in 근거');
  assert.ok(body('evidenceTab').includes('ladderLine(o.view, part)'));
  assert.ok(src.includes("usesShown(face.uses).map(([u, said])"), 'a step\'s uses read by name, unnamed IDs left off');
  assert.ok(!src.includes("h('span', { class: 'dv-step-n sl-ref' }, shortRef(s.ref))") && src.includes("h('span', { class: 'dv-step-n sl-ref' }, s.no)"));
});
