// What a group means and where the scope's outside roles sit (map design v3 2.1–2.3, slice S7, display only): a group's axis from
// what the record says of its children (never a name alone, never 실행 위치 guessed), the 참여자 band on the left, the external
// systems behind the system boundary on the right, the 실행 위치 미기록 shelf under everything with 「원문 분류」 kept; an executor
// stays inside whatever its type, and nothing is banded when it would leave the middle empty.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupAxis, bandsOf, filedUnder, executes, AXIS_WORD, SHELF_TITLE, OUTSIDE_TITLE, BOUNDARY_TITLE } from '../dist/public/client/map-regions.js';
import { layoutScope } from '../dist/public/client/map-layout.js';

const reading = (type, state = null, x = {}) => ({ typeRead: type ? { type, quote: null, at: 'r' } : null, stateRead: state ? { state, when: null, quote: null, at: 'r' } : null, steps: [], loop: null, ...x });
function view(spec, rels = []) {
  const parts = spec.map(([id, name, parent, r]) => ({ id, name, note: '', parentId: parent ?? null, depth: parent ? 1 : 0, childIds: [], status: 'plan', lastAt: null, recordIds: [], summary: null, changes: [], origin: null, proposal: null, reading: r ?? null }));
  const byId = new Map(parts.map(p => [p.id, p]));
  for (const p of parts) if (p.parentId) byId.get(p.parentId).childIds.push(p.id);
  return { parts, roots: parts.filter(p => !p.parentId).map(p => p.id), relations: rels.map(([from, to, kind = 'flow'], i) => ({ id: `R${i}`, from, to, kind, note: '' })), records: [] };
}

test('groupAxis: participants, boundary, lifecycle, composition from the children; nothing from a name alone', () => {
  const v = view([
    ['P', '사람들', null, null], ['p1', '운영자', 'P', reading('person')], ['p2', '봇', 'P', reading('session')],
    ['X', '외부', null, null], ['x1', '거래소', 'X', reading('external')], ['x2', '이름만', 'X', null],
    ['L', '폐기', null, null], ['l1', '옛 수집기', 'L', reading('collector', 'retired')], ['l2', '옛 판단', 'L', reading('ai', 'unbuilt')],
    ['E', '엔진', null, reading('loop')], ['e1', '단계', 'E', reading('compute')],
    ['N', '외부', null, null], ['n1', '내 수집기', 'N', reading('collector')],
    ['M', '설계만', null, null], ['m1', '가동 중', 'M', reading('compute', 'running')],
    ['core', '본체', null, reading('compute')],
  ], [['p1', 'core'], ['x1', 'core'], ['core', 'x1']]);
  assert.equal(groupAxis(v, 'P'), 'participants', 'people whose lines only leave them');
  assert.equal(groupAxis(v, 'X'), 'boundary', 'named 외부, its typed children external (one left untyped stays with them)');
  assert.equal(groupAxis(v, 'L'), 'lifecycle', 'named with a lifecycle word, every child retired or unbuilt');
  assert.equal(groupAxis(v, 'E'), 'composition', 'a typed part whose inside is shown');
  assert.equal(groupAxis(v, 'N'), null, 'named 외부 but its child is ours: no axis from the name');
  assert.equal(groupAxis(v, 'M'), null, 'named 설계만 but a child runs: not a lifecycle group');
  assert.equal(groupAxis(v, 'core'), null, 'no children: no group');
  // A participants group the rest flows into is not outside.
  const fed = view([['P', '사람들', null, null], ['p1', '운영자', 'P', reading('person')], ['core', '본체', null, reading('compute')]], [['core', 'p1']]);
  assert.equal(groupAxis(fed, 'P'), null);
  assert.deepEqual(AXIS_WORD, { participants: '참여자', boundary: '시스템 경계', lifecycle: '실행 위치 미기록', composition: '구성' });
  assert.equal(SHELF_TITLE, '실행 위치 미기록'); assert.equal(OUTSIDE_TITLE, '참여자'); assert.equal(BOUNDARY_TITLE, '시스템 경계 · 기록 기준');
});

test('bandsOf: outside roles left, external systems right, lifecycle groups on the shelf; executors stay inside', () => {
  const v = view([
    ['u', '사용자', null, reading('person')], ['s', '운영 세션', null, reading('session')],
    ['ci', 'CI', null, reading('external', null, { steps: [{ name: '빌드', does: null, uses: [] }] })],
    ['bot', 'dependabot', null, reading('external')], ['run', '실행기', null, reading('compute')], ['old', 'relative_speed', null, reading('compute', 'retired')],
    ['L', '폐기', null, null], ['l1', '옛 수집기', 'L', reading('collector', 'retired')], ['n', '이름만', null, null],
  ], [['u', 'run'], ['run', 'ci']]);
  const b = bandsOf(v, v.roots);
  assert.deepEqual(Object.fromEntries(b), { u: 'outside', s: 'outside', bot: 'boundary', L: 'shelf' });
  assert.equal(executes(v.parts.find(p => p.id === 'ci')), true, 'CI the record says runs steps is the system\'s executor');
  assert.equal(b.has('old'), false, 'a retired part the record placed at the top stays where it is (its card says 폐기)');
  assert.equal(b.has('n'), false, 'no type word: no band');
  // Nothing is banded when it would leave the middle empty.
  const people = view([['a', '사람 1', null, reading('person')], ['b', '사람 2', null, reading('person')]]);
  assert.equal(bandsOf(people, people.roots).size, 0);
  assert.equal(filedUnder(v, 'l1'), '폐기', 'the shelf\'s card keeps 「원문 분류: 폐기」');
  assert.equal(filedUnder(v, 'run'), null);
});

// Beauty v3 (B, the ruling Q1 참여자·외부 띠): the fixed far-left and far-right columns are released; a participant sits next to what
// it starts, keeping its kind marks; the shelf stays under everything. Beauty v4 (P2): an external system takes its connected block's
// last column (after every part of the system, stacked by its lines), so one rule between them reads as the system boundary.
test('layout: a participant sits just before what it starts, an external system in its block’s last column; the shelf under everything', () => {
  const v = view([
    ['u', '사용자', null, reading('person')], ['run', '실행기', null, reading('compute')], ['out', '결과 파일', null, reading('store')],
    ['bot', '알림 서비스', null, reading('external')] /* v14 B: a bot of the release stands in the release lane (V14B-2), so the outside system here is a service */, ['L', '폐기', null, null], ['l1', '옛 수집기', 'L', reading('collector', 'retired')],
  ], [['u', 'run'], ['run', 'out'], ['run', 'bot']]);
  const L = layoutScope(v, null, () => true, {}), box = id => L.boxes.get(id);
  assert.deepEqual(L.bands, { outside: ['u'], boundary: ['bot'], shelf: ['L'] });
  assert.ok(box('u').x + box('u').w < box('run').x, 'the participant reads before the part it starts');
  assert.ok(box('bot').x > box('run').x + box('run').w, 'the external system reads after the part that feeds it');
  assert.ok(box('bot').x > box('out').x + box('out').w, 'past every part of the system: the block’s last column (P2)');
  const bottom = Math.max(...['u', 'run', 'out', 'bot'].map(id => box(id).y + box(id).h));
  assert.ok(box('L').y > bottom, 'the shelf is under everything');
  assert.ok(box('run').x < box('out').x, 'the middle reads left to right along its lines');
  // A place the person set wins over the band.
  const P = layoutScope(v, null, () => true, { root: { bot: { x: 0, y: 0 } } });
  assert.equal(P.boxes.get('bot').x, 0);
  // Without readings nothing is banded and the arrangement is as before.
  const bare = view([['a', 'A', null, null], ['b', 'B', null, null]], [['a', 'b']]);
  assert.deepEqual(layoutScope(bare, null, () => true, {}).bands, { outside: [], boundary: [], shelf: [] });
});
