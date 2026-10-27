// Cycle 67 (C · reading pane and persistence): a group's inside relations read from the group, backups carry manual places,
// and folds/cameras are kept per project apart from the project data. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildExample, EXAMPLES } from '../dist/public/shared/studio-examples.js';
import { studioView } from '../dist/public/shared/studio.js';
import { insideEnds, relationGroups, relLabel } from '../dist/public/shared/relation-groups.js';
import { serializeBackup, serializeProject, readViewState, writeViewState, VIEW_KEY } from '../dist/public/shared/storage.js';
import { parseBackup, parseProject } from '../dist/public/shared/validation.js';

const data = JSON.parse(await readFile(new URL('../../../docs/cycles/2026-10-26-visual-experience-58/OSS_CASES.json', import.meta.url), 'utf8'));
const viewOf = id => studioView(buildExample(data.cases.find(c => c.spec.id === id).spec));
const byName = (v, name) => v.parts.find(p => p.name === name);
const descendants = (v, id) => { const out = new Set(), st = [...byName(v, id)?.childIds ?? v.parts.find(p => p.id === id).childIds]; while (st.length) { const x = st.pop(); if (!out.has(x)) { out.add(x); st.push(...v.parts.find(p => p.id === x).childIds); } } return out; };

test('C1 a group reads the stored relations of its inner parts that leave it, from the inner end; inner pairs are only counted', () => {
  const v = viewOf('oss-scikit-learn'), g = byName(v, '공용 전처리 정의'), inside = descendants(v, g.id);
  const { outside, within } = insideEnds(v, g.id);
  // The review's two dotted lines at the group: its inner parts' relations to the outside.
  assert.ok(outside.length >= 2, String(outside.length));
  const expected = v.relations.filter(r => inside.has(r.from) !== inside.has(r.to) && r.from !== g.id && r.to !== g.id);
  assert.deepEqual(outside.map(x => x.r.id).sort(), expected.map(r => r.id).sort());
  assert.equal(within, v.relations.filter(r => inside.has(r.from) && inside.has(r.to)).length);
  for (const x of outside) {
    assert.ok(inside.has(x.near) && !inside.has(x.far) && x.far !== g.id);
    assert.equal(x.out, x.r.from === x.near);
    // The stored relation itself, untouched.
    assert.deepEqual(x.r, v.relations.find(r => r.id === x.r.id));
  }
  // Grouped by verb and direction like a part's own relations; every relation in exactly one group.
  const groups = relationGroups(outside, '안쪽');
  assert.equal(groups.reduce((n, gr) => n + gr.list.length, 0), outside.length);
  for (const gr of groups) { const k = new Set(gr.list.map(x => `${x.r.kind}|${x.r.kind === 'related' ? '' : x.out}`)); assert.equal(k.size, 1); assert.equal(gr.label, relLabel(gr.list[0].r.kind, gr.list[0].out, '안쪽')); }
});

test('C1 a group without inner relations reads nothing, and the group\'s own relations stay its own', () => {
  const v = studioView(buildExample(EXAMPLES.find(e => e.id === 'salon')));
  for (const p of v.parts.filter(x => x.childIds.length)) {
    const { outside } = insideEnds(v, p.id);
    for (const x of outside) assert.ok(x.r.from !== p.id && x.r.to !== p.id);
  }
  const leaf = v.parts.find(x => !x.childIds.length);
  assert.deepEqual(insideEnds(v, leaf.id), { outside: [], within: 0 });
  assert.equal(relLabel('needs', true, '안쪽'), '안쪽이 필요로 함');
  assert.equal(relLabel('needs', false, '안쪽'), '안쪽을 필요로 함');
  assert.equal(relLabel('flow', false, '안쪽'), '안쪽에 넘겨줌');
  assert.equal(relLabel('needs', true, '범위'), '이 범위가 필요로 함');
  assert.equal(relLabel('related', true, '안쪽'), '관련');
});

const salonProject = () => buildExample(EXAMPLES.find(e => e.id === 'salon'));

test('C4 a backup carries manual places beside the project and reads them back; without places it is the plain project', () => {
  const p = salonProject(), [a, b] = p.space.areas;
  const positions = { __root: { [a.id]: { x: 120, y: -40.5 } }, [a.id]: { [b.id]: { x: 8, y: 16 } } };
  const raw = serializeBackup(p, positions), back = parseBackup(raw);
  assert.deepEqual(back.positions, positions);
  assert.equal(serializeProject(back.project), serializeProject(parseProject(serializeProject(p))));
  // No places (or only empty containers): exactly today's bytes, read as before.
  assert.equal(serializeBackup(p, null), serializeProject(p));
  assert.equal(serializeBackup(p, { __root: {} }), serializeProject(p));
  const plain = parseBackup(serializeProject(p));
  assert.equal(plain.positions, null);
  assert.equal(serializeProject(plain.project), serializeProject(back.project));
  // Places are checked on their own; a malformed one rejects the file and the project inside is never half-read.
  for (const bad of [[], { c: [] }, { c: { x: { x: 1 } } }, { c: { x: { x: 1, y: 'a' } } }, { c: { x: { x: 1, y: 2, z: 3 } } }, { c: { x: { x: 1e9, y: 0 } } }, null])
    assert.throws(() => parseBackup(JSON.stringify({ ...JSON.parse(serializeProject(p)), positions: bad })));
  // The project part still passes the project's own strict check.
  assert.throws(() => parseBackup(JSON.stringify({ ...JSON.parse(serializeProject(p)), extra: 1, positions })));
});

const memory = () => { const m = new Map(); return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } }; };

test('C4 folds and per-scope cameras are kept per project apart from the project data', () => {
  const s = memory();
  assert.deepEqual(readViewState(s, 'ex-salon'), { folds: {}, cameras: {} });
  const state = { folds: { booking: false, admin: true }, cameras: { '': { x: 12, y: -30, scale: 0.85 }, booking: { x: 0, y: 4, scale: 1.2 } } };
  assert.equal(writeViewState(s, 'ex-salon', state), true);
  assert.equal(writeViewState(s, 'P_other', { folds: { x: true }, cameras: {} }), true);
  assert.deepEqual(readViewState(s, 'ex-salon'), state);
  assert.deepEqual(readViewState(s, 'P_other'), { folds: { x: true }, cameras: {} });
  assert.deepEqual(Object.keys(JSON.parse(s.m.get(VIEW_KEY))), ['ex-salon', 'P_other']);
  // Malformed values read as nothing stored; a malformed entry keeps its well-formed parts only.
  s.setItem(VIEW_KEY, '{oops'); assert.deepEqual(readViewState(s, 'ex-salon'), { folds: {}, cameras: {} });
  s.setItem(VIEW_KEY, JSON.stringify({ p: { folds: { a: 'yes', b: false }, cameras: { '': { x: 1, y: 2, scale: 99 }, q: { x: 1, y: 2, scale: 1 } } } }));
  assert.deepEqual(readViewState(s, 'p'), { folds: { b: false }, cameras: { q: { x: 1, y: 2, scale: 1 } } });
  // Only the newest projects are kept; a refused write is a lost convenience, not an error.
  for (let i = 0; i < 70; i++) writeViewState(s, `P_${i}`, { folds: {}, cameras: {} });
  const kept = Object.keys(JSON.parse(s.m.get(VIEW_KEY)));
  assert.equal(kept.length, 60); assert.equal(kept.at(-1), 'P_69'); assert.ok(!kept.includes('p'));
  assert.equal(writeViewState({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } }, 'x', state), false);
});
