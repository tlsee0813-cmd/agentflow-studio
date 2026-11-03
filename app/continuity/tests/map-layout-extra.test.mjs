// layoutScope's extra: the room a typed card needs past its own lines (map spec 2.1, the first terrain cycle). A unit or a row
// takes exactly what it is given and nothing else changes size; a list item never takes it; absent, the layout is as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, addArea, addChildArea } from '../dist/public/shared/domain.js';
import { studioView } from '../dist/public/shared/studio.js';
import { layoutScope } from '../dist/public/client/map-layout.js';

function project() {
  let p = createProject();
  p = addArea(p, '수집기', '시세를 받아 행으로 남긴다.');
  p = addArea(p, '보관소', '판단 행을 보관한다.');
  p = addArea(p, '실행 묶음', '');
  const group = p.space.areas.at(-1).id;
  p = addChildArea(p, group, '집행기');
  p = addArea(p, '목록 묶음', '');
  const list = p.space.areas.at(-1).id;
  for (let i = 0; i < 9; i++) p = addChildArea(p, list, `항목 ${i + 1}`);
  return p;
}
const v = studioView(project());
const id = name => v.parts.find(x => x.name === name).id;
const sizes = L => new Map([...L.boxes].map(([k, b]) => [k, { w: b.w, h: b.h, face: b.face, kind: b.kind }]));

test('a unit takes exactly its extra room; every other box keeps its size', () => {
  const base = layoutScope(v, null, () => true, {}), unit = id('보관소');
  const L = layoutScope(v, null, () => true, {}, undefined, undefined, 1.6, x => (x === unit ? 40 : 0));
  assert.equal(base.boxes.get(unit).face, 'unit');
  assert.equal(L.boxes.get(unit).h, base.boxes.get(unit).h + 40);
  assert.equal(L.boxes.get(unit).w, base.boxes.get(unit).w);
  const a = sizes(base), b = sizes(L);
  for (const [k, s] of a) if (k !== unit) assert.deepEqual(b.get(k), s, k);
});

test('a row takes it too, a list item never does, and the callback hears the face', () => {
  const row = id('집행기'), item = id('항목 1'), heard = new Map();
  const base = layoutScope(v, null, () => true, {});
  const L = layoutScope(v, null, () => true, {}, undefined, undefined, 1.6, (x, face) => { heard.set(x, face); return x === row || x === item ? 25 : 0; });
  assert.equal(base.boxes.get(row).face, 'row');
  assert.equal(L.boxes.get(row).h, base.boxes.get(row).h + 25);
  assert.equal(base.boxes.get(item).face, 'item');
  assert.equal(L.boxes.get(item).h, base.boxes.get(item).h);
  assert.equal(heard.get(row), 'row');
  assert.equal(heard.get(id('수집기')), 'unit');
  assert.equal(heard.has(item), false);
});

test('without the parameter nothing changes (the same boxes as a callback giving 0)', () => {
  const plain = layoutScope(v, null, () => true, {}), zero = layoutScope(v, null, () => true, {}, undefined, undefined, 1.6, () => 0);
  assert.deepEqual([...plain.boxes], [...zero.boxes]);
  assert.deepEqual(plain.bounds, zero.bounds);
  // A negative answer never takes room away.
  const neg = layoutScope(v, null, () => true, {}, undefined, undefined, 1.6, () => -30);
  assert.deepEqual([...neg.boxes], [...plain.boxes]);
});
