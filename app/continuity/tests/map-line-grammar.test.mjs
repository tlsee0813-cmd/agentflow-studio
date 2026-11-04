// Map design v3 6 (S4a + S4b), the pure part: the line grammar (data solid + filled head, control dashed 6 4 + open head, a
// reference dotted + a port-less ear), the text badge made only from what the reading wrote (cadence words today; when /
// optional once the contract carries them), one stroke per pair, direction and channel (data and control never merged), the
// protected label order, and the port faces (a control line read as such: out of its card's bottom, in at the top, kept only for
// a route of few turns; a reference from its ear; first bends 16 from a port). No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lineStyle, lineWidth, lineBadge, mergeByChannel, multiWord, labelRank, portFaces, turnsOf, DASH, HEAD_PX, RANK, WIDTH_FLOOR, LABEL_MAX, BADGE_H, BADGE_H_ON, FACE_TURNS } from '../dist/public/client/line-grammar.js';
import { resolveLabels, faceRoute, rounded } from '../dist/public/client/map-layout.js';
import { routeEdges, earY } from '../dist/public/client/map-route.js';

const box = (id, x, y, w = 272, h = 208, extra = {}) => ({ id, x, y, w, h, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { x, y }, head: 0, face: 'unit', contact: h / 2, pins: {}, ...extra });
const boxes = list => new Map(list.map(b => [b.id, b]));
const edge = (from, to, kind = 'flow', faces, ids = [`${from}${to}`]) => ({ key: `${from}|${to}|${kind}`, from, to, kind, notes: [], ids, agg: false, ...(faces ? { faces } : {}) });

test('LINE-1 the stroke and the head say the relation, never its colour: data, control, reference, shared use, plain relation', () => {
  assert.deepEqual(lineStyle('flow', 'data'), { stroke: 'solid', dash: [], head: 'filled', start: 'none' });
  assert.deepEqual(lineStyle('flow', 'control'), { stroke: 'dashed', dash: [6, 4], head: 'open', start: 'none' });
  assert.deepEqual(lineStyle('needs', 'uses'), { stroke: 'dotted', dash: [0, 4], head: 'ref', start: 'ear' });
  assert.deepEqual(lineStyle('shares', null), { stroke: 'dotted', dash: [0, 4], head: 'ear', start: 'ear' });
  assert.deepEqual(lineStyle('related', 'data'), { stroke: 'sparse', dash: [0, 8], head: 'dot', start: 'dot' }, 'a plain relation keeps its dots whatever its channel');
  // A channel the reading did not give: the kind's default (a flow hands data over, a need refers).
  assert.equal(lineStyle('flow', null).stroke, 'solid'); assert.equal(lineStyle('needs', null).stroke, 'dotted');
  // Every kind of relation is told apart by its stroke and head alone (greyscale, colour-blind).
  const sigs = [lineStyle('flow', 'data'), lineStyle('flow', 'control'), lineStyle('needs', 'uses'), lineStyle('shares', null), lineStyle('related', null)].map(s => `${s.stroke}|${s.head}|${s.start}`);
  assert.equal(new Set(sigs).size, sigs.length);
  assert.deepEqual([...DASH.control], [6, 4]); assert.deepEqual([...DASH.uses], [0, 4]); assert.deepEqual([...DASH.related], [0, 8]);
  assert.deepEqual({ ...HEAD_PX }, { filled: 9, open: 10, ref: 8, ear: 6, dot: 4 });
});

test('LINE-2 widths are screen pixels: never under 1.25 at rest, 1.5 nearer, 2 pointed at, 3 selected (a reference 2.5)', () => {
  assert.equal(WIDTH_FLOOR, 1.25);
  for (const t of ['dots', 'far', 'mid', 'near', null]) assert.ok(lineWidth(t, 'rest') >= WIDTH_FLOOR, String(t));
  assert.equal(lineWidth('far', 'rest'), 1.25); assert.equal(lineWidth('mid', 'rest'), 1.5); assert.equal(lineWidth('near', 'rest'), 1.5);
  assert.equal(lineWidth('far', 'hover'), 2); assert.equal(lineWidth('far', 'selected'), 3); assert.equal(lineWidth('near', 'selected', 'uses'), 2.5);
});

test('LINE-3 the badge comes only from what the reading wrote of when the line flows; never from a name, a payload or a kind', () => {
  assert.equal(lineBadge([{}]), null, 'nothing said: no badge');
  assert.equal(lineBadge([{ cadence: null, mode: 'design' }]), null, 'a mode alone makes no badge (the basis line says the map is a design)');
  assert.equal(lineBadge([{ cadence: '   ' }]), null);
  // The record's words as written: a condition it put in the cadence column reads as it is.
  const b = lineBadge([{ cadence: "init_from='resume'", mode: 'design' }]);
  assert.deepEqual(b, { kind: 'cadence', short: "init_from='resume'", full: "박자 · init_from='resume' · 설계", n: 1 });
  // Never parsed: '명령마다' stays the words, no beat kind is made of '마다'.
  assert.equal(lineBadge([{ cadence: '명령마다' }]).short, '명령마다');
  // A selected badge says at most 24 of the record's characters, then an ellipsis.
  const long = lineBadge([{ cadence: '가'.repeat(40) }]);
  assert.equal(long.full, `박자 · ${'가'.repeat(23)}…`);
  // A stroke of several relations whose words differ, or some of which say none: how many say any, none as the stroke's.
  assert.deepEqual(lineBadge([{ cadence: '명령마다' }, { cadence: '끝에 1회' }]), { kind: 'cadence', short: '박자 2', full: '박자 2 / 2 · 선택하면 관계마다', n: 2 });
  assert.equal(lineBadge([{ cadence: '명령마다' }, {}]).short, '박자 1');
  assert.equal(lineBadge([{ cadence: '명령마다' }, { cadence: '명령마다' }]).short, '명령마다', 'the same words on every relation read once');
  // Once the contract carries them, a condition outranks an optional mark, which outranks cadence words.
  assert.equal(lineBadge([{ when: 'wandb_log면', cadence: 'eval_interval마다' }]).kind, 'condition');
  assert.equal(lineBadge([{ when: 'wandb_log면' }]).full, '조건 · wandb_log면');
  assert.deepEqual(lineBadge([{ optional: true }]), { kind: 'optional', short: '선택', full: '선택 · 선택', n: 1 });
  assert.equal(BADGE_H, 16); assert.equal(BADGE_H_ON, 20);
});

test('LINE-4 one stroke per pair, direction and channel: a flow and a need of one channel share it, data and control never do', () => {
  const ch = { r1: 'data', r2: 'control', r3: 'data', r4: 'data', r5: 'uses' };
  const chanOf = id => ch[id] ?? null, noteOf = id => `note ${id}`;
  const edges = [
    { key: 'a|b|flow', from: 'a', to: 'b', kind: 'flow', notes: ['n1', 'n2'], ids: ['r1', 'r2'], agg: false },
    { key: 'a|b|needs', from: 'a', to: 'b', kind: 'needs', notes: [], ids: ['r3'], agg: false },
    { key: 'b|a|flow', from: 'b', to: 'a', kind: 'flow', notes: [], ids: ['r4'], agg: false },
    { key: 'a|b|shares', from: 'a', to: 'b', kind: 'shares', notes: [], ids: ['r5'], agg: false },
    { key: 'a|b|related', from: 'a', to: 'b', kind: 'related', notes: [], ids: ['r6'], agg: false }];
  const out = mergeByChannel(edges, chanOf, noteOf), by = new Map(out.map(e => [e.ids.join(','), e]));
  assert.deepEqual(out.map(e => e.ids.join(',')).sort(), ['r1,r3', 'r2', 'r4', 'r5', 'r6']);
  assert.equal(by.get('r1,r3').kind, 'flow', 'the merged stroke keeps its first line\'s kind');
  assert.deepEqual(by.get('r1,r3').notes, ['note r1'], 'a split line keeps each relation\'s own note');
  assert.equal(by.get('r2').key, 'a|b|flow~control', 'control split off the data stroke');
  assert.notEqual(by.get('r1,r3').key, by.get('r2').key);
  assert.equal(by.get('r4').from, 'b', 'the other direction is its own stroke');
  // A summary keeps a stable key whatever relations it is left with.
  const s1 = mergeByChannel([{ key: 'sum:a|b|flow', from: 'a', to: 'b', kind: 'flow', notes: [], ids: ['r1', 'r2'], agg: true }], chanOf, noteOf, true);
  const s2 = mergeByChannel([{ key: 'sum:a|b|flow', from: 'a', to: 'b', kind: 'flow', notes: [], ids: ['r1'], agg: true }], chanOf, noteOf, true);
  assert.equal(s1.find(e => e.ids.includes('r1')).key, s2[0].key);
  assert.ok(s1.every(e => e.key.startsWith('sum:')));
  // The label of a stroke handing over different things.
  assert.equal(multiWord(['결과', '설정', '로그']), '결과 · 설정 +1');
  assert.equal(multiWord(['결과', '결과']), '결과');
  assert.equal(multiWord(['결과', null, '설정']), '결과 · 설정 +1');
  assert.equal(multiWord([null, null]), null);
});

test('LINE-5 the protected label order: the selected or path line, the spine, a named line, the rest; a higher rank keeps its place', () => {
  assert.equal(labelRank({ selected: true, spine: true }), RANK.selected);
  assert.equal(labelRank({ spine: true, said: true }), RANK.spine);
  assert.equal(labelRank({ said: true }), RANK.said);
  assert.equal(labelRank({}), RANK.other);
  assert.ok(RANK.selected < RANK.badge && RANK.badge < RANK.spine && RANK.spine < RANK.said && RANK.said < RANK.other);
  // Two labels that would touch: the higher rank keeps its place even when the other's place is its first.
  const { kept, dropped } = resolveLabels([{ key: 'low', x: 0, y: 0, w: 60, h: 18, dist: 0, rank: RANK.other }, { key: 'spine', x: 10, y: 0, w: 60, h: 18, dist: 3, rank: RANK.spine }]);
  assert.deepEqual(kept.map(k => k.key), ['spine']); assert.deepEqual(dropped, ['low']);
  // Without ranks the old rule (nearer its own end wins) holds.
  assert.deepEqual(resolveLabels([{ key: 'a', x: 0, y: 0, w: 60, h: 18, dist: 1 }, { key: 'b', x: 10, y: 0, w: 60, h: 18, dist: 0 }]).kept.map(k => k.key), ['b']);
  assert.equal(LABEL_MAX, 120);
});

test('LINE-6 port faces: only a control channel the reading gave takes the bottom and the top; a reference starts at its ear', () => {
  assert.deepEqual(portFaces('flow', 'control', true), { a: 'bottom', b: 'top' });
  assert.deepEqual(portFaces('flow', 'control', false), { a: 'side', b: 'side' }, 'a default channel keeps its sides');
  assert.deepEqual(portFaces('flow', 'data', true), { a: 'side', b: 'side' });
  assert.deepEqual(portFaces('needs', 'uses', true), { a: 'ear', b: 'side' });
  assert.deepEqual(portFaces('shares', null, false), { a: 'ear', b: 'ear' });
  assert.deepEqual(portFaces('related', 'control', true), { a: 'side', b: 'side' });
});

test('LINE-7 a control line leaves its card\'s bottom and comes in at the top when the route turns little; else it keeps the sides', () => {
  // The target lies below and to the right: down, across, down (two turns) — the faces hold.
  const a = box('a', 0, 0), b = box('b', 400, 320), faces = { a: 'bottom', b: 'top' };
  const r = routeEdges(boxes([a, b]), [edge('a', 'b', 'flow', faces)]).get('a|b|flow');
  assert.deepEqual(r.faces, faces);
  const [p0, p1] = r.pts, [q1, q0] = r.pts.slice(-2);
  assert.equal(p0.y, a.y + a.h, 'out of the bottom'); assert.equal(q0.y, b.y, 'in at the top');
  assert.ok(Math.abs(p0.x - (a.x + a.w / 3)) < 0.5 && Math.abs(q0.x - (b.x + b.w / 3)) < 0.5, 'at the head\'s left third');
  assert.ok(Math.abs(p1.y - p0.y) + Math.abs(p1.x - p0.x) >= 16, 'first bend 16 from the port');
  assert.ok(Math.abs(q1.y - q0.y) + Math.abs(q1.x - q0.x) >= 16, 'last bend 16 from the port');
  assert.ok(turnsOf(r.pts) <= FACE_TURNS);
  // Side by side on one row: the top of the target is behind it, so the line keeps the sides (its dash and open head say it).
  const c = box('c', 400, 0), side = routeEdges(boxes([a, c]), [edge('a', 'c', 'flow', faces)]).get('a|c|flow');
  assert.deepEqual(side.faces, { a: 'side', b: 'side' });
  assert.equal(side.pts[0].x, a.x + a.w); assert.equal(side.pts.at(-1).x, c.x);
  // Two control lines into one top spread round its left third, in the order of their sources.
  const l = box('l', -300, 0), m = box('m', 300, 0), t = box('t', 0, 400);
  const two = routeEdges(boxes([l, m, t]), [edge('m', 't', 'flow', faces), edge('l', 't', 'flow', faces)]);
  const xl = two.get('l|t|flow').pts.at(-1).x, xm = two.get('m|t|flow').pts.at(-1).x;
  assert.ok(xl < xm && xm - xl >= 12 - 0.01, `${xl} ${xm}`);
  // A face route never passes under another card.
  const wall = box('w', 150, 150, 272, 120);
  const round = routeEdges(boxes([a, b, wall]), [edge('a', 'b', 'flow', faces)]).get('a|b|flow');
  const hits = round.pts.slice(1).some((p, i) => { const q = round.pts[i]; return Math.max(p.x, q.x) > wall.x && Math.min(p.x, q.x) < wall.x + wall.w && Math.max(p.y, q.y) > wall.y && Math.min(p.y, q.y) < wall.y + wall.h; });
  assert.equal(hits, false);
  // faceRoute itself: null when its lead is shut (a card right under the port).
  const lid = box('lid', 0, 214, 272, 40);
  assert.equal(faceRoute(a, b, [a, b, lid], { face: 'bottom', at: 90 }, { face: 'top', at: 490 }), null);
});

test('LINE-8 a reference starts at its ear (the head band of the side it leaves), never spread with the side\'s other lines', () => {
  const a = box('a', 0, 0, 272, 208, { ear: 23 }), b = box('b', 400, 0), c = box('c', 400, 300);
  const r = routeEdges(boxes([a, b, c]), [edge('a', 'b', 'needs', { a: 'ear', b: 'side' }), edge('a', 'c', 'flow'), edge('a', 'b', 'flow')]);
  const ref = r.get('a|b|needs');
  assert.equal(ref.pts[0].y, 23, 'the ear'); assert.equal(ref.pts[0].x, a.x + a.w);
  assert.equal(earY(a), 23); assert.equal(earY(box('u', 0, 0, 200, 52)), 20, 'an untyped card: the head band, at most halfway');
  assert.ok(r.get('a|c|flow').pts[0].y !== 23 && r.get('a|b|flow').pts[0].y !== 23, 'the data lines spread round the contact point');
});

test('LINE-9 corners are rounded at 8', () => {
  const d = rounded([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
  assert.match(d, /L92,0 Q100,0 100,8/);
});
