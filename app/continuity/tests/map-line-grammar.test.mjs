// Map design v3 6 (S4a + S4b), the pure part: the line grammar (data solid + filled head, control dashed 6 4 + open head, a
// reference dotted + a port-less ear), the text badge made only from what the reading wrote (cadence words today; when /
// optional once the contract carries them), one stroke per pair, direction and channel (data and control never merged), the
// protected label order, and the port faces (a control line read as such: out of its card's bottom, in at the top, kept only for
// a route of few turns; a reference from its ear; first bends 16 from a port). No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lineStyle, lineWidth, lineBadge, mergeByChannel, multiWord, labelRank, portFaces, turnsOf, DASH, HEAD_PX, RANK, WIDTH_FLOOR, LABEL_MAX, BADGE_H, BADGE_H_ON, FACE_TURNS, badgeForms, overflowMark, isRelativeRef, conditionWords, conditionTip, COND_UNSAID, restLabels, restLabelShown, shortLabel, labelPx, BADGE_GLYPH, BADGE_CLIP, LABEL_SHORT } from '../dist/public/client/line-grammar.js';
import { resolveLabels, faceRoute, rounded } from '../dist/public/client/map-layout.js';
import { routeEdges, earY } from '../dist/public/client/map-route.js';

const box = (id, x, y, w = 272, h = 208, extra = {}) => ({ id, x, y, w, h, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { x, y }, head: 0, face: 'unit', contact: h / 2, pins: {}, ...extra });
const boxes = list => new Map(list.map(b => [b.id, b]));
const edge = (from, to, kind = 'flow', faces, ids = [`${from}${to}`]) => ({ key: `${from}|${to}|${kind}`, from, to, kind, notes: [], ids, agg: false, ...(faces ? { faces } : {}) });

test('LINE-1 the stroke and the head say the relation, never its colour: data, control, reference, shared use, plain relation', () => {
  assert.deepEqual(lineStyle('flow', 'data'), { stroke: 'solid', dash: [], head: 'filled', start: 'none' });
  // Beauty v2 B1 (the binding ruling): control is a SOLID line with an open head; a reference a faint long dash 8 5, direction kept.
  assert.deepEqual(lineStyle('flow', 'control'), { stroke: 'solid', dash: [], head: 'open', start: 'none' });
  assert.deepEqual(lineStyle('needs', 'uses'), { stroke: 'long', dash: [8, 5], head: 'ref', start: 'ear' });
  assert.deepEqual(lineStyle('shares', null), { stroke: 'long', dash: [8, 5], head: 'ear', start: 'ear' });
  assert.deepEqual(lineStyle('related', 'data'), { stroke: 'sparse', dash: [0, 8], head: 'dot', start: 'dot' }, 'a plain relation keeps its dots whatever its channel');
  // A channel the reading did not give: the kind's default (a flow hands data over, a need refers).
  assert.equal(lineStyle('flow', null).stroke, 'solid'); assert.equal(lineStyle('needs', null).stroke, 'long');
  // Every kind of relation is told apart by its stroke and head alone (greyscale, colour-blind).
  const sigs = [lineStyle('flow', 'data'), lineStyle('flow', 'control'), lineStyle('needs', 'uses'), lineStyle('shares', null), lineStyle('related', null)].map(s => `${s.stroke}|${s.head}|${s.start}`);
  assert.equal(new Set(sigs).size, sigs.length);
  assert.deepEqual([...DASH.control], []); assert.deepEqual([...DASH.uses], [8, 5]); assert.deepEqual([...DASH.related], [0, 8]);
  // Heads keep a least screen size (about 7–9 long, 5–7 wide) at every zoom.
  assert.deepEqual({ ...HEAD_PX }, { filled: 9, open: 10, ref: 9.5, ear: 6, dot: 4 });
});

// Beauty v2 B1 changed the widths: by the reading focus, never by tier or traffic (background 1–1.25, foreground 2–2.5, selected 3).
test('LINE-2 widths are screen pixels by the reading focus: background 1.15, foreground 2.25, pointed at 2.5, selected 3', () => {
  assert.equal(WIDTH_FLOOR, 1);
  for (const t of ['dots', 'far', 'mid', 'near', null]) { assert.equal(lineWidth(t, 'rest'), 1.15, String(t)); assert.equal(lineWidth(t, 'fg'), 2.25); }
  assert.equal(lineWidth('far', 'hover'), 2.5); assert.equal(lineWidth('far', 'selected'), 3); assert.equal(lineWidth('near', 'selected', 'uses'), 3);
});

test('LINE-3 the badge comes only from what the reading wrote of when the line flows; never from a name, a payload or a kind', () => {
  assert.equal(lineBadge([{}]), null, 'nothing said: no badge');
  assert.equal(lineBadge([{ cadence: null, mode: 'design' }]), null, 'a mode alone makes no badge (the basis line says the map is a design)');
  assert.equal(lineBadge([{ cadence: '   ' }]), null);
  // The record's words as written: a condition it put in the cadence column reads as it is.
  const b = lineBadge([{ cadence: "init_from='resume'", mode: 'design' }]);
  assert.deepEqual(b, { kind: 'cadence', short: "init_from='resume'", full: "init_from='resume' · 설계", tip: "박자 · 기록의 글자 그대로\n“init_from='resume'”\n코드·문서에서 읽은 흐름", words: ["init_from='resume'"], n: 1, unresolved: false, lead: "init_from='resume'", quiet: false });
  // Never parsed: '명령마다' stays the words, no beat kind is made of '마다'.
  assert.equal(lineBadge([{ cadence: '명령마다' }]).short, '명령마다');
  // A selected badge says at most 24 of the record's characters, then an ellipsis.
  const long = lineBadge([{ cadence: '가'.repeat(40) }]);
  assert.equal(long.full, `${'가'.repeat(23)}…`);
  // S7: a stroke of several relations reads the record's own words: the first and how many other wordings, or how many say any.
  assert.deepEqual(lineBadge([{ cadence: '명령마다' }, { cadence: '끝에 1회' }]), { kind: 'cadence', short: '명령마다 외 1', full: '명령마다 외 1', tip: '박자 · 기록의 글자 그대로\n“명령마다”\n“끝에 1회”', words: ['명령마다', '끝에 1회'], n: 2, unresolved: false, lead: '명령마다', quiet: false });
  assert.equal(lineBadge([{ cadence: '명령마다' }, {}]).short, '명령마다 (1/2)');
  assert.equal(lineBadge([{ cadence: '명령마다' }, { cadence: '명령마다' }]).short, '명령마다', 'the same words on every relation read once');
  // Once the contract carries them, a condition outranks an optional mark, which outranks cadence words.
  assert.equal(lineBadge([{ when: 'wandb_log면', cadence: 'eval_interval마다' }]).kind, 'condition');
  assert.equal(lineBadge([{ when: 'wandb_log면' }]).full, '조건', 'polish round: a condition is its cue; its words in the tip');
  assert.equal(lineBadge([{ when: 'wandb_log면' }]).tip, '조건 · 이 조건일 때만 흐름\n조건: wandb_log면');
  const opt = lineBadge([{ optional: true }]);
  assert.deepEqual([opt.kind, opt.short, opt.full, opt.n], ['optional', '선택', '선택', 1]);
  assert.equal(BADGE_H, 16); assert.equal(BADGE_H_ON, 20);
});

test('LINE-3b S7: a badge never reads the bare kind word; it falls back from its words to clipped words to the rhythm glyph', () => {
  const bare = /^박자( \d+)?$/;
  const cases = [[{ cadence: '호출마다', mode: 'design' }], [{ cadence: '명령마다' }, { cadence: '끝에 1회' }], [{ cadence: '명령마다' }, {}], [{ cadence: 'eval_interval 스텝마다 한 번씩' }], [{ cadence: '위 두 줄과 같음' }]];
  for (const rels of cases) {
    const b = lineBadge(rels);
    for (const on of [false, true]) for (const tier of [null, 'near', 'mid', 'far', 'dots']) for (const t of badgeForms(b, on, tier)) assert.ok(!bare.test(t), `${t} for ${JSON.stringify(rels)}`);
    assert.ok(!bare.test(b.short) && !bare.test(b.full));
  }
  // Selecting keeps the record's words first ('호출마다', never '박자'): full, then the rest form, then clipped, then the glyph.
  const call = lineBadge([{ cadence: '호출마다', mode: 'design' }]);
  assert.deepEqual(badgeForms(call, true), ['호출마다 · 설계', '호출마다', BADGE_GLYPH]);
  assert.deepEqual(badgeForms(call, false), ['호출마다', BADGE_GLYPH]);
  const longer = lineBadge([{ cadence: 'eval_interval 스텝마다 한 번씩' }]);
  assert.deepEqual(badgeForms(longer, false), ['eval_interval 스텝마다 한 번씩', 'eval_i…', BADGE_GLYPH]);
  assert.equal(badgeForms(longer, false)[1].length, BADGE_CLIP);
  assert.deepEqual(badgeForms(lineBadge([{ cadence: '명령마다' }, { cadence: '끝에 1회' }]), false), ['명령마다 외 1', BADGE_GLYPH]);
  assert.deepEqual(badgeForms(lineBadge([{ cadence: 'log_interval 스텝마다' }, { cadence: '끝에 1회' }]), false), ['log_interval 스텝마다 외 1', 'log_i… 외 1', BADGE_GLYPH]);
  // The overview keeps condition badges with their words; a cadence badge is its glyph there (its words in the tip and on selection).
  assert.deepEqual(badgeForms(call, false, 'far'), [BADGE_GLYPH]);
  assert.deepEqual(badgeForms(call, true, 'far'), ['호출마다 · 설계', '호출마다', BADGE_GLYPH]);
  assert.deepEqual(badgeForms(lineBadge([{ when: 'wandb_log면' }]), false, 'far'), ['조건'], 'polish round: the cue alone, never clipped words');
  assert.deepEqual(badgeForms(lineBadge([{ optional: true }]), true), ['선택']);
  assert.equal(overflowMark(3), '배지 +3'); // cards v2 §1: the marker says what it counts
  assert.equal(overflowMark(2, ['cadence', 'condition']), '조건·박자 +2'); // polish round fixes 1: it names the cues it gathers
});

test('LINE-3c S7: an unresolved reference of the record reads as written, marked unresolved; never resolved', () => {
  for (const t of ['위 두 줄과 같음', '위와 같음', '상동', '앞 행과 동일', 'same as above', '위 행과 마찬가지']) assert.ok(isRelativeRef(t), t);
  for (const t of ['명령마다', '호출마다', '위험할 때마다', '실행마다 1회', 'PR마다', '같은 배치마다 1회']) assert.ok(!isRelativeRef(t), t);
  const b = lineBadge([{ cadence: '위 두 줄과 같음', mode: 'design' }]);
  assert.equal(b.short, '위 두 줄과 같음', 'shown as written');
  assert.equal(b.unresolved, true);
  assert.match(b.tip, /상대 참조 \(풀지 않음\)/);
  assert.equal(lineBadge([{ cadence: '위와 같음' }, { cadence: '명령마다' }]).unresolved, false, 'one stroke with a real cadence is not marked');
});

test('LINE-6 S7: labels by zoom tier (5.5): counts at the overview, short labels in the middle, full near; sizes under the names', () => {
  assert.equal(restLabels('far'), 'counts'); assert.equal(restLabels('dots'), 'counts');
  assert.equal(restLabels('mid'), 'short'); assert.equal(restLabels('near'), 'full'); assert.equal(restLabels(null), 'full');
  assert.equal(restLabelShown('counts', { spine: true, path: true }), false);
  assert.equal(restLabelShown('short', { spine: true }), true); assert.equal(restLabelShown('short', { path: true }), true);
  assert.equal(restLabelShown('short', {}), true, 'the middle tier keeps every label, cut short');
  assert.equal(restLabelShown('full', {}), true);
  assert.equal(shortLabel('openwebtext 데이터셋 토큰 파일'), `${'openwebtext 데이터셋 토큰 파일'.slice(0, LABEL_SHORT - 1)}…`);
  assert.equal(shortLabel('GPT-2 가중치'), 'GPT-2 가중치');
  // On screen 11–14px, following the zoom a little; never over a card name's floor (14px) far out, never tiny near in.
  assert.equal(labelPx(0.4), 11); assert.equal(labelPx(1.6), 14);
  assert.ok(labelPx(1) > 12 && labelPx(1) < 13);
  for (let k = 0.2; k <= 1.6; k += 0.05) { const p = labelPx(k); assert.ok(p >= 11 && p <= 14); assert.ok(p <= Math.max(14, 15 * k), `label ${p} under the name at ${k}`); }
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
  assert.equal(multiWord(['결과', '설정', '로그']), '결과 · 설정 외 1');
  assert.equal(multiWord(['결과', '결과']), '결과');
  assert.equal(multiWord(['결과', null, '설정']), '결과 · 설정 외 1');
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

// Beauty v2 B2 changed this deliberately: every reference leaving one side stood on its ear's one point (the head band), so several
// references stacked there; the ruling's port order has every end take its place in the side's order, never two on one point.
test('LINE-8 a reference starts on its side in the side\'s order like any other end (its ear mark kept), never on another end\'s point', () => {
  const a = box('a', 0, 0, 272, 208, { ear: 23 }), b = box('b', 400, 0), c = box('c', 400, 300);
  const r = routeEdges(boxes([a, b, c]), [edge('a', 'b', 'needs', { a: 'ear', b: 'side' }), edge('a', 'c', 'flow'), edge('a', 'b', 'flow')]);
  const ref = r.get('a|b|needs'), ys = ['a|b|needs', 'a|c|flow', 'a|b|flow'].map(k => r.get(k).pts[0].y);
  assert.equal(ref.pts[0].x, a.x + a.w, 'it leaves the side');
  assert.equal(new Set(ys).size, 3, 'three ends, three points');
  assert.ok(r.get('a|c|flow').pts[0].y > Math.max(ref.pts[0].y, r.get('a|b|flow').pts[0].y), 'in the order of their other ends');
  assert.equal(earY(a), 23); assert.equal(earY(box('u', 0, 0, 200, 52)), 20, 'earY still says where an ear band is');
});

test('LINE-9 corners are rounded at 8', () => {
  const d = rounded([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
  assert.match(d, /L92,0 Q100,0 100,8/);
});

test('LINE-3d polish round (spec-cards-v2 §1): a condition or optional mark is a fixed cue, never cut, never lost; its words in the tip', () => {
  // The ask's form word the record copied in front of its condition is no part of the words.
  assert.equal(conditionWords('조건 그대로: not os.path.exists(input_file_path)'), 'not os.path.exists(input_file_path)');
  assert.equal(conditionWords('  조건 그대로 :  key in globals() '), 'key in globals()');
  assert.equal(conditionWords('wandb_log면'), 'wandb_log면');
  assert.equal(conditionWords('조건 그대로'), COND_UNSAID, 'the form word alone: conditional, words not in the record');
  assert.equal(conditionWords('  '), null); assert.equal(conditionWords(null), null);
  assert.equal(conditionTip('a > 0'), '조건: a > 0'); assert.equal(conditionTip(COND_UNSAID), `조건 · ${COND_UNSAID}`);
  const one = lineBadge([{ when: '조건 그대로: not os.path.exists(input_file_path)' }]);
  assert.deepEqual([one.kind, one.short, one.full], ['condition', '조건', '조건']);
  assert.ok(one.tip.includes('조건: not os.path.exists(input_file_path)') && !one.tip.includes('그대로'), one.tip);
  for (const on of [false, true]) for (const tier of [null, 'near', 'mid', 'far', 'dots']) assert.deepEqual(badgeForms(one, on, tier), ['조건'], `${on} ${tier}`);
  // A bare form word still reads conditional (never 선택, never no badge).
  const bare = lineBadge([{ when: '조건 그대로', optional: true }]);
  assert.equal(bare.kind, 'condition'); assert.ok(bare.tip.includes(COND_UNSAID));
  // A bundle only partly conditional says how many: it never reads wholly conditional, nor unconditional.
  const part = lineBadge([{ when: 'a' }, {}, { when: 'b' }]);
  assert.equal(part.short, '조건 2/3'); assert.deepEqual(badgeForms(part, false, 'mid'), ['조건 2/3', '조건']);
  assert.ok(part.tip.includes('조건: a\n조건: b') && part.tip.includes('관계 3개 중 2개에 기록됨'), part.tip);
  // 선택: the variant it flows for, in the tip, by its name.
  const opt = lineBadge([{ optional: true, variant: 'CPU 경로' }, {}]);
  assert.deepEqual([opt.kind, opt.short], ['optional', '선택 1/2']);
  assert.ok(opt.tip.startsWith('선택 · 늘 흐르지는 않음 · 그 변형일 때만\n변형 ‘CPU 경로’'), opt.tip);
  // Polish round fixes 1: only the optional relations' variants (a stale variant on a non-optional relation is never said).
  const stale = lineBadge([{ optional: true, variant: 'A' }, { optional: false, variant: 'B' }]);
  assert.ok(stale.tip.includes('변형 ‘A’') && !stale.tip.includes('‘B’'), stale.tip);
  // A condition that only points at another row: said as a relative reference, muted (.unres).
  const rel = lineBadge([{ when: '위와 같음' }]);
  assert.ok(rel.unresolved && rel.tip.split('\n')[0].endsWith('기록 안의 상대 참조 (풀지 않음)'), rel.tip);
  assert.equal(lineBadge([{ when: 'a > 0' }]).unresolved, false);
  assert.ok(lineBadge([{ optional: true }]).tip.startsWith('선택 · 늘 흐르지는 않음 (기록이 선택으로 적음)'));
});
