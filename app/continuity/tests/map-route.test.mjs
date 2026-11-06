// The lines routed together (map-route): ports spread along a side in the order of the other ends, parallel runs in one gap sit
// apart, the quick shape follows a moved part continuously, and nothing routed together passes under a box it does not belong
// to on the OSS cases. Layout only; no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildExample, EXAMPLES } from '../dist/public/shared/studio-examples.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope, summaryEdges, NODE_W, NODE_H, LANE_CLEAR } from '../dist/public/client/map-layout.js';
import { routeEdges, TRACK_GAP, PORT_MIN, mixPath } from '../dist/public/client/map-route.js';

const data = JSON.parse(await readFile(new URL('../../../docs/cycles/2026-10-26-visual-experience-58/OSS_CASES.json', import.meta.url), 'utf8'));
const viewOf = id => studioView(buildExample(data.cases.find(c => c.spec.id === id).spec));
const box = (id, x, y, w = NODE_W, h = NODE_H) => ({ id, x, y, w, h, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { x, y }, head: 0, face: 'unit' });
const edge = (from, to, kind = 'flow') => ({ key: `${from}|${to}|${kind}`, from, to, kind, notes: [], ids: [`${from}${to}`], agg: false });
const boxes = list => new Map(list.map(b => [b.id, b]));
const start = r => r.pts[0], end = r => r.pts.at(-1);

test('ROUTE-1 three lines into one part meet its side at three ports, top to bottom in the order of where they come from', () => {
  const a = box('a', 0, 0), b = box('b', 0, 120), c = box('c', 0, 240), t = box('t', 400, 120);
  const r = routeEdges(boxes([a, b, c, t]), [edge('c', 't'), edge('a', 't'), edge('b', 't')]);
  const ys = ['a', 'b', 'c'].map(id => end(r.get(`${id}|t|flow`)).y);
  assert.ok(ys[0] < ys[1] && ys[1] < ys[2], `ports in the order of the sources: ${ys}`);
  assert.ok(ys.every(y => y > t.y + 4 && y < t.y + t.h - 4), 'every port on the side');
  assert.ok(ys[1] - ys[0] >= PORT_MIN && ys[2] - ys[1] >= PORT_MIN);
  assert.equal((ys[0] + ys[2]) / 2, t.y + t.h / 2, 'centred on the side');
  for (const id of ['a', 'b', 'c']) assert.equal(end(r.get(`${id}|t|flow`)).x, t.x, 'meets the left side');
  // One line alone keeps the middle of its side.
  const one = routeEdges(boxes([a, t]), [edge('a', 't')]).get('a|t|flow');
  assert.equal(start(one).y, a.y + a.h / 2); assert.equal(end(one).y, t.y + t.h / 2);
});

test('ROUTE-2 lines that share one gap run side by side, never on top of each other, and their runs still touch no other box', () => {
  const a = box('a', 0, 0), b = box('b', 0, 200), c = box('c', 400, 200), d = box('d', 400, 0);
  // a → c goes down and b → d goes up through the same gap: two vertical runs on the gap's middle line without nudging.
  const r = routeEdges(boxes([a, b, c, d]), [edge('a', 'c'), edge('b', 'd')]);
  const vx = key => { const p = r.get(key).pts; return p[1].x; };
  assert.notEqual(vx('a|c|flow'), vx('b|d|flow'));
  assert.ok(Math.abs(vx('a|c|flow') - vx('b|d|flow')) >= TRACK_GAP - 0.01);
  for (const x of r.values()) assert.equal(x.pts.length, 4, 'the plain shape');
  // The paths say the same: the two vertical runs are at different x.
  assert.notEqual(r.get('a|c|flow').d, r.get('b|d|flow').d);
});

test('ROUTE-3 the quick shape moves with a dragged part continuously: a small move changes the line a little, never its kind', () => {
  const a = box('a', 0, 0), t = box('t', 400, 100), mid = box('m', 200, 40);
  const at = dy => routeEdges(boxes([a, { ...t, y: 100 + dy }, mid]), [edge('a', 't')], { quick: true }).get('a|t|flow');
  const r0 = at(0), r1 = at(3);
  assert.equal(r0.pts.length, r1.pts.length);
  assert.ok(r0.pts.every((p, i) => Math.abs(p.x - r1.pts[i].x) <= 3 && Math.abs(p.y - r1.pts[i].y) <= 3));
  // The full route goes round the part between them; the quick one does not (it is the drag's shape).
  const full = routeEdges(boxes([a, t, mid]), [edge('a', 't')]).get('a|t|flow');
  assert.ok(full.clear);
});

test('ROUTE-4 a mixed path between two sampled shapes starts at the first and ends at the second', () => {
  const from = [{ x: 0, y: 0 }, { x: 10, y: 0 }], to = [{ x: 0, y: 10 }, { x: 10, y: 10 }];
  assert.equal(mixPath(from, to, 0), 'M0.0,0.0 L10.0,0.0');
  assert.equal(mixPath(from, to, 1), 'M0.0,10.0 L10.0,10.0');
  assert.equal(mixPath(from, to, 0.5), 'M0.0,5.0 L10.0,5.0');
});

/** Points along an edge path made of M, L and Q commands (what the router writes). */
function sample(d) {
  const t = d.match(/[MLQ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g), pts = []; let i = 0, cur = null;
  const num = () => Number(t[i++]);
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M') { cur = { x: num(), y: num() }; pts.push(cur); continue; }
    const P = c === 'Q' ? [cur, { x: num(), y: num() }, { x: num(), y: num() }] : [cur, { x: num(), y: num() }];
    for (let s = 1; s <= 20; s++) {
      const u = s / 20, v = 1 - u;
      pts.push(P.length === 3 ? { x: v * v * P[0].x + 2 * v * u * P[1].x + u * u * P[2].x, y: v * v * P[0].y + 2 * v * u * P[1].y + u * u * P[2].y } : { x: v * P[0].x + u * P[1].x, y: v * P[0].y + u * P[1].y });
    }
    cur = P.at(-1);
  }
  return pts;
}
test('ROUTE-5 every OSS case and example, routed together: no line passes under a box it does not belong to, and no two lines share a run', () => {
  const views = [...data.cases.map(c => [c.spec.id, studioView(buildExample(c.spec))]), ...EXAMPLES.map(e => [e.id, studioView(buildExample(e))])];
  const bad = [], shared = []; let lines = 0;
  for (const [name, v] of views) for (const scope of [null]) for (const open of [(_id, d) => d === 0, () => false]) {
    const l = layoutScope(v, scope, open, {}, undefined, undefined, 1440 / 848), all = [...l.boxes.values()], byId = l.boxes;
    const within = (o, f) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
    for (const set of [l.edges, l.edges.length > 6 ? summaryEdges(l.boxes, l.edges) : []]) {
      const routed = routeEdges(l.boxes, set);
      for (const e of set) {
        const r = routed.get(e.key), a = byId.get(e.from), b = byId.get(e.to); lines++;
        const blocks = all.filter(o => o !== a && o !== b && !(o.kind === 'frame' && (within(a, o) || within(b, o))) && !(a.kind === 'frame' && within(o, a)) && !(b.kind === 'frame' && within(o, b)));
        for (const q of sample(r.d)) { const o = blocks.find(o => q.x > o.x + 2 && q.x < o.x + o.w - 2 && q.y > o.y + 2 && q.y < o.y + o.h - 2); if (o) { bad.push(`${name} ${e.key} under ${o.id}`); break; } }
      }
      // Two lines of one set never share a vertical run (same x, overlapping extent) away from their ports, wherever the gap
      // between the boxes on either side has room for two runs (a list's 18px columns have not).
      const runs = [...routed.values()].flatMap(r => r.pts.slice(1, -2).map((p, i) => ({ key: r.key, p, q: r.pts[i + 2] })).filter(s => Math.abs(s.p.x - s.q.x) < 0.01));
      const corridor = (x, lo, hi) => {
        const beside = all.filter(o => o.kind !== 'frame' && o.y < hi && lo < o.y + o.h);
        const left = Math.max(-Infinity, ...beside.filter(o => o.x + o.w <= x + 0.5).map(o => o.x + o.w)), right = Math.min(Infinity, ...beside.filter(o => o.x >= x - 0.5).map(o => o.x));
        return right - left;
      };
      for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
        const s = runs[i], t = runs[j]; if (s.key === t.key || Math.abs(s.p.x - t.p.x) > 0.5) continue;
        const lo = Math.max(Math.min(s.p.y, s.q.y), Math.min(t.p.y, t.q.y)), hi = Math.min(Math.max(s.p.y, s.q.y), Math.max(t.p.y, t.q.y));
        if (hi - lo > 2 && corridor(s.p.x, lo, hi) >= 2 * TRACK_GAP + 4) shared.push(`${name} ${s.key} / ${t.key} at x=${s.p.x}`);
      }
    }
  }
  assert.ok(lines > 100, String(lines));
  assert.deepEqual(bad, []);
  assert.deepEqual(shared, []);
});

// Maps of the shape a first map often has: a spine of five steps, relations that skip two columns, one that runs back, a region
// with rows linked from outside, two regions a flow crosses between, and a few unlinked parts.
const P = (key, name, note = '', parent) => ({ key, name, note, ...(parent ? { parent } : {}) });
const SHAPES = [
  { id: 'chain', name: '정산 흐름', brief: '시험용 지도', records: [],
    parts: [P('s1', '접수 창구', '처음.'), P('s2', '심사', '본다.'), P('s3', '승인', '정한다.'), P('s4', '집행', '한다.'), P('s5', '정산', '끝.'),
      P('mid', '공통 규칙', '규칙 묶음.'), P('r1', '한도 규칙', '', 'mid'), P('r2', '예외 규칙', '', 'mid'), P('r3', '감사 규칙', '', 'mid'),
      P('hist', '이력'), P('cal', '달력'), P('people', '담당자'), P('fx', '환율')],
    relations: [['s1', 's2', 'flow', ''], ['s2', 's3', 'flow', ''], ['s3', 's4', 'flow', ''], ['s4', 's5', 'flow', ''], ['s1', 's4', 'flow', ''], ['s2', 's5', 'needs', ''],
      ['s5', 's1', 'flow', ''], ['s3', 'r1', 'needs', ''], ['s3', 'r2', 'needs', ''], ['s4', 'r3', 'needs', ''], ['s5', 'fx', 'needs', '']] },
  { id: 'cross', name: '앱과 서버', brief: '시험용 지도', records: [],
    parts: [P('client', '클라이언트', '앱.'), P('view', '보기', '', 'client'), P('ctrl', '조작', '', 'client'), P('sync', '동기화', '', 'client'),
      P('server', '서버', '원격.'), P('gate', '관문', '', 'server'), P('logic', '논리', '', 'server'), P('save', '저장', '', 'server'), P('push', '푸시', '', 'server'), P('audit', '감사', '', 'server'),
      P('ext', '외부 결제'), P('ops', '운영 도구'), P('docs', '문서'), P('test', '시험')],
    relations: [['ctrl', 'sync', 'flow', ''], ['sync', 'gate', 'flow', ''], ['gate', 'logic', 'flow', ''], ['logic', 'save', 'flow', ''], ['save', 'push', 'flow', ''],
      ['push', 'view', 'flow', ''], ['logic', 'ext', 'needs', ''], ['ctrl', 'logic', 'needs', ''], ['gate', 'audit', 'flow', ''], ['ops', 'server', 'needs', '']] },
  { id: 'three', name: '세 영역', brief: '시험용 지도', records: [],
    parts: [P('front', '프런트엔드', '브라우저 쪽.'), P('page', '페이지', '', 'front'), P('store', '상태 저장', '', 'front'),
      P('back', '백엔드', '서버 쪽.'), P('ctl', '컨트롤러', '', 'back'), P('svc', '서비스', '', 'back'), P('repo', '저장 계층', '', 'back'),
      P('data', '데이터', '보관.'), P('pg', 'Postgres', '', 'data'), P('s3', '파일 저장', '', 'data'),
      P('queue', '작업 큐', '비동기 작업.'), P('worker', '작업자', '큐를 비운다.'), P('readme', '안내 문서'), P('env', '환경 변수')],
    relations: [['page', 'store', 'flow', ''], ['store', 'ctl', 'flow', ''], ['ctl', 'svc', 'flow', ''], ['svc', 'repo', 'flow', ''], ['repo', 'pg', 'flow', ''],
      ['svc', 'queue', 'flow', ''], ['queue', 'worker', 'flow', ''], ['worker', 's3', 'flow', ''], ['page', 'svc', 'needs', ''], ['pg', 'page', 'flow', '']] },
];
const shaped = () => SHAPES.map(spec => {
  const p = buildExample(spec), v = studioView(p), key = new Map(v.parts.map(x => [x.id, spec.parts[p.space.areas.findIndex(a => a.id === x.id)].key]));
  const l = layoutScope(v, null, (_id, d) => d === 0, {}, undefined, undefined, 1440 / 848);
  const name = id => key.get(id) ?? id, label = e => `${spec.id} ${name(e.from)}→${name(e.to)}`;
  return { spec, l, routed: routeEdges(l.boxes, l.edges), label };
});
const runsOf = pts => pts.slice(1).map((q, i) => ({ a: pts[i], b: q }));

test('ROUTE-6 a line between two level parts is straight even where a busy side spreads its ports: the spine reads as one line, not a stair', () => {
  // a → b on one row; a's right side also holds a line that skips b (to c) and one that comes back from c, so its ports spread.
  const a = box('a', 0, 0), b = box('b', 300, 0), c = box('c', 600, 0), low = box('low', 300, 160);
  const r = routeEdges(boxes([a, b, c, low]), [edge('a', 'b'), edge('a', 'c'), edge('c', 'a')]);
  const ab = r.get('a|b|flow').pts;
  assert.equal(ab.length, 2, `straight: ${JSON.stringify(ab)}`);
  assert.equal(ab[0].y, ab[1].y);
  // The ports on a's right side stay apart (the moved end is b's, whose side holds this one line).
  const ys = ['a|b|flow', 'a|c|flow'].map(k => start(r.get(k)).y).concat(end(r.get('c|a|flow')).y);
  assert.equal(new Set(ys).size, 3, `three ports: ${ys}`);
  for (let i = 0; i < ys.length; i++) for (let j = i + 1; j < ys.length; j++) assert.ok(Math.abs(ys[i] - ys[j]) >= PORT_MIN - 0.01);
  // A port never moves off its side: a line whose level lies outside the other side stays bent.
  const tall = box('t', 300, -200, NODE_W, NODE_H), r2 = routeEdges(boxes([a, tall]), [edge('a', 't')]).get('a|t|flow');
  assert.equal(r2.pts.length, 4);
  // On first maps: every spine step between two level parts is one straight run.
  let n = 0;
  for (const { l, routed, label } of shaped()) for (const e of l.edges.filter(e => e.spine)) {
    const A = l.boxes.get(e.from), B = l.boxes.get(e.to), pts = routed.get(e.key).pts;
    // Beauty v3 (A.7): parts are levelled on their line-contact rows (an 80- and a 104-high card share a row), so "level" is read there.
    if (A.kind !== 'node' || B.kind !== 'node' || Math.abs(A.y + (A.contact ?? A.h / 2) - (B.y + (B.contact ?? B.h / 2))) > 1) continue;
    assert.equal(pts.length, 2, `${label(e)} ${JSON.stringify(pts)}`); n++;
  }
  // Beauty v3: the layered layout's polish may pull a spine part toward its other partners (a long line and a line back pull the chain's
  // fourth step off its row here), so three level steps are sampled, not four.
  assert.ok(n >= 3, String(n));
});

test('ROUTE-7 every routed line is orthogonal with no repeated points: a run of no length is never nudged into a slanted line', () => {
  const views = [...data.cases.map(c => [c.spec.id, studioView(buildExample(c.spec))]), ...EXAMPLES.map(e => [e.id, studioView(buildExample(e))])];
  const bad = [];
  const check = (name, routed) => { for (const r of routed.values()) for (const { a, b } of runsOf(r.pts)) {
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    if ((dx > 0.01 && dy > 0.01) || dx + dy < 0.5) { bad.push(`${name} ${r.key} ${JSON.stringify(r.pts)}`); break; }
  } };
  for (const [name, v] of views) for (const open of [(_id, d) => d === 0, () => false]) {
    const l = layoutScope(v, null, open, {}, undefined, undefined, 1440 / 848);
    check(name, routeEdges(l.boxes, l.edges));
  }
  for (const { spec, routed } of shaped()) check(spec.id, routed);
  assert.deepEqual(bad, []);
});

test('ROUTE-8 no run lies along the edge of a box it does not belong to, nor along the border of a region around its ends', () => {
  const bad = [];
  for (const { l, routed, label } of shaped()) {
    const all = [...l.boxes.values()], byId = l.boxes;
    const within = (o, f) => { for (let c = o.container, g = 0; c && g < 64; c = byId.get(c)?.container ?? '', g++) if (c === f.id) return true; return false; };
    for (const e of l.edges) {
      const a = byId.get(e.from), b = byId.get(e.to), runs = runsOf(routed.get(e.key).pts);
      const others = all.filter(o => o !== a && o !== b && !(o.kind === 'frame' && (within(a, o) || within(b, o))) && !(a.kind === 'frame' && within(o, a)) && !(b.kind === 'frame' && within(o, b)));
      const rims = all.filter(o => o.kind === 'frame' && o !== a && o !== b && (within(a, o) || within(b, o)));
      for (const { a: p, b: q } of runs) {
        const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y), m = LANE_CLEAR - 0.5;
        const near = others.find(o => x1 > o.x - m && x0 < o.x + o.w + m && y1 > o.y - m && y0 < o.y + o.h + m);
        if (near) bad.push(`${label(e)} along ${near.id}`);
        const horiz = y1 - y0 < 0.01;
        const rim = rims.find(o => horiz
          ? Math.min(x1, o.x + o.w) - Math.max(x0, o.x) > 10 && (Math.abs(p.y - o.y) < m || Math.abs(p.y - o.y - o.h) < m)
          : Math.min(y1, o.y + o.h) - Math.max(y0, o.y) > 10 && (Math.abs(p.x - o.x) < m || Math.abs(p.x - o.x - o.w) < m));
        if (rim) bad.push(`${label(e)} on the border of ${rim.id}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
