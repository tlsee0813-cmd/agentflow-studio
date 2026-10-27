// AF-UI67-FIX68: the four defects of the UI67 review. Places and views kept per workspace entry (an imported copy shares its
// project id with the original), places keys that cannot reach Object.prototype, the summary beside a selection keeping every
// other relation once, and a line that finds no one-corridor route still going round unrelated parts. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildExample, EXAMPLES } from '../dist/public/shared/studio-examples.js';
import { studioView } from '../dist/public/shared/studio.js';
import { serializeBackup, serializeProject, readEntryPositions, writeEntryPositions, POSITIONS_KEY, LEGACY_POSITIONS_KEY, WorkspaceStore, readViewState, writeViewState, cleanViewState, readEntryView, importCopy, VIEW_KEY, WORKSPACE_KEY } from '../dist/public/shared/storage.js';
import { parseBackup, cleanPositions, placeKey } from '../dist/public/shared/validation.js';
import { layoutScope, edgePath, summaryEdges, restSummary } from '../dist/public/client/map-layout.js';

const data = JSON.parse(await readFile(new URL('../../../docs/cycles/2026-10-26-visual-experience-58/OSS_CASES.json', import.meta.url), 'utf8'));
const viewOf = id => studioView(buildExample(data.cases.find(c => c.spec.id === id).spec));
const memory = () => { const m = new Map(); return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } }; };
const plain = v => JSON.parse(JSON.stringify(v));
const salon = () => buildExample(EXAMPLES.find(e => e.id === 'salon'));
const protoState = () => ({ names: Object.getOwnPropertyNames(Object.prototype).sort().join(','), toString: Object.prototype.toString, probe: ({}).x });

test('FIX68-1 an imported copy and its original keep their own places; the old project-keyed places move over once, untouched', async () => {
  const kv = memory(), p = salon(), [a, b] = p.space.areas;
  // Before: one record per project id (positions.1), as every entry of that project read it.
  const legacy = { root: { [a.id]: { x: 10, y: 20 } } };
  kv.setItem(LEGACY_POSITIONS_KEY, JSON.stringify({ [p.id]: legacy }));
  let n = 0; const store = new WorkspaceStore(kv, { request: async (_n, cb) => cb() }, () => `E_entry-${String(++n).padStart(4, "0")}`);
  await store.init();
  const orig = await store.create(p, 'new');
  // The original reads what it showed before.
  assert.deepEqual(plain(readEntryPositions(kv, orig.entryId, p.id)), legacy);
  // The person moves a part in the original: written under its entry.
  const moved = { root: { [a.id]: { x: 300, y: 40 } } };
  assert.equal(writeEntryPositions(kv, orig.entryId, moved), true);
  // A backup of the same project with the older places comes in as a new copy: same project id, its own entry and record.
  const backup = serializeBackup(p, { root: { [a.id]: { x: -50, y: -60 }, [b.id]: { x: 5, y: 6 } } });
  const { project, positions } = parseBackup(backup), copy = await store.create(project, 'import');
  assert.equal(project.id, p.id); assert.notEqual(copy.entryId, orig.entryId);
  writeEntryPositions(kv, copy.entryId, cleanPositions(positions));
  assert.deepEqual(plain(readEntryPositions(kv, orig.entryId, p.id)), moved, 'the original keeps the place set in it');
  assert.deepEqual(plain(readEntryPositions(kv, copy.entryId, p.id)), plain(positions), 'the copy has the places of its file');
  // Moving in the copy leaves the original; a fresh read (reload) tells them apart the same way.
  writeEntryPositions(kv, copy.entryId, { root: { [a.id]: { x: 1, y: 2 } } });
  const reload = memory(); for (const [k, v] of kv.m) reload.setItem(k, v);
  assert.deepEqual(plain(readEntryPositions(reload, orig.entryId, p.id)), moved);
  assert.deepEqual(plain(readEntryPositions(reload, copy.entryId, p.id)), { root: { [a.id]: { x: 1, y: 2 } } });
  // A plain (older) backup without places: the copy starts on the automatic layout, never on another entry's places.
  const old = parseBackup(serializeProject(p)); assert.equal(old.positions, null);
  const second = await store.create(old.project, 'import');
  writeEntryPositions(kv, second.entryId, cleanPositions(old.positions));
  assert.deepEqual(plain(readEntryPositions(kv, second.entryId, p.id)), {});
  assert.deepEqual(plain(readEntryPositions(kv, orig.entryId, p.id)), moved);
  // positions.1 is only read: its bytes are as they were.
  assert.equal(kv.getItem(LEGACY_POSITIONS_KEY), JSON.stringify({ [p.id]: legacy }));
  assert.deepEqual(Object.keys(JSON.parse(kv.getItem(POSITIONS_KEY))).sort(), [orig.entryId, copy.entryId, second.entryId].sort());
  // Folds and cameras are kept by the same entry key: one entry's view does not open the other's.
  writeViewState(kv, orig.entryId, { folds: { [a.id]: false }, cameras: { '': { x: 1, y: 2, scale: 1 } } });
  assert.deepEqual(readViewState(kv, copy.entryId), { folds: {}, cameras: {} });
  // Unreadable stores read as no places; a refused write is reported, not thrown.
  kv.setItem(POSITIONS_KEY, '{oops'); assert.deepEqual(plain(readEntryPositions(kv, 'E_x', 'P_none')), {});
  assert.equal(writeEntryPositions({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } }, 'E_1', moved), false);
});

test('FIX68-1 an import is added only once its own places and empty view are kept; a refused write adds nothing and changes nothing', async () => {
  const p = salon(), [a] = p.space.areas, older = { root: { [a.id]: { x: -50, y: -60 } } };
  // A browser store that refuses writes to one key on demand.
  const failing = () => { const kv = memory(), deny = new Set(); return { kv, deny, getItem: kv.getItem, setItem: (k, v) => { if (deny.has(k)) throw new Error('QuotaExceededError'); kv.setItem(k, v); } }; };
  const s = failing(); let n = 0;
  const store = new WorkspaceStore(s, { request: async (_n, cb) => cb() }, () => `E_entry-${String(++n).padStart(4, '0')}`);
  await store.init();
  const orig = await store.create(p, 'new'), mine = { root: { [a.id]: { x: 300, y: 40 } } };
  writeEntryPositions(s, orig.entryId, mine); writeViewState(s, orig.entryId, { folds: { [a.id]: false }, cameras: {} });
  const snapshot = () => [...s.kv.m].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  for (const denied of [POSITIONS_KEY, VIEW_KEY, WORKSPACE_KEY]) {
    const before = snapshot(), count = store.entries().length;
    s.deny.add(denied);
    await assert.rejects(importCopy(store, s, parseBackup(serializeBackup(p, older)).project, older), undefined, denied);
    s.deny.delete(denied);
    store.read();
    // Nothing added and every stored byte as it was (a view record written before a refused add may stay; it names no entry).
    assert.equal(store.entries().length, count, denied);
    const after = snapshot().split('\n').filter(l => !(denied === WORKSPACE_KEY && l.startsWith(`${VIEW_KEY}=`))).join('\n');
    assert.equal(after, before.split('\n').filter(l => !(denied === WORKSPACE_KEY && l.startsWith(`${VIEW_KEY}=`))).join('\n'), denied);
    assert.deepEqual(plain(readEntryPositions(s, orig.entryId, p.id)), mine);
  }
  // Allowed: the copy is added with the file's places and an empty view; the original keeps its own.
  const { ref, positions } = await importCopy(store, s, p, older);
  assert.deepEqual(plain(positions), older);
  assert.deepEqual(plain(readEntryPositions(s, ref.entryId, p.id)), older);
  assert.deepEqual(readEntryView(s, ref.entryId, p.id), { folds: {}, cameras: {} });
  assert.deepEqual(plain(readEntryPositions(s, orig.entryId, p.id)), mine);
  // An entry id is taken once.
  await assert.rejects(store.create(p, 'import', ref.entryId));
});

test('FIX68-1 views kept by project id (view.1 before entries) carry over to the entries that had them; an import starts empty', async () => {
  const kv = memory(), p = salon(), [a] = p.space.areas;
  const before = { folds: { [a.id]: false }, cameras: { '': { x: 12, y: -30, scale: 0.85 } } };
  kv.setItem(VIEW_KEY, JSON.stringify({ [p.id]: before, 'ex-salon': { folds: {}, cameras: {} } }));
  let n = 0; const store = new WorkspaceStore(kv, { request: async (_n, cb) => cb() }, () => `E_entry-${String(++n).padStart(4, '0')}`);
  await store.init();
  const orig = await store.create(p, 'new');
  assert.deepEqual(readEntryView(kv, orig.entryId, p.id), before, 'the existing entry opens with the view it had');
  const { ref } = await importCopy(store, kv, p, null);
  assert.deepEqual(readEntryView(kv, ref.entryId, p.id), { folds: {}, cameras: {} }, 'the import does not take it');
  // The entry keeps its own from its next write; the project-id record is only read.
  const later = { folds: {}, cameras: { '': { x: 1, y: 2, scale: 1 } } };
  writeViewState(kv, orig.entryId, later);
  assert.deepEqual(readEntryView(kv, orig.entryId, p.id), later);
  assert.deepEqual(readViewState(kv, p.id), before);
  assert.deepEqual(readEntryView(kv, ref.entryId, p.id), { folds: {}, cameras: {} });
});

test('FIX68-2 places keys that name an inherited property are refused; nothing reaches Object.prototype, valid places and older backups still read', () => {
  const before = protoState(), p = salon(), [a] = p.space.areas, base = JSON.parse(serializeProject(p));
  // The review's file: container '__proto__' holding a 'toString' part, written as raw JSON (own keys after JSON.parse).
  const attacks = [
    `{"__proto__":{"toString":{"x":1,"y":2}}}`,
    `{"root":{"toString":{"x":1,"y":2}}}`,
    `{"constructor":{"${a.id}":{"x":1,"y":2}}}`,
    `{"root":{"__proto__":{"x":1,"y":2}}}`,
    `{"root":{"${a.id}":{"x":1,"y":2,"__proto__":{"z":1}}}}`,
    `{"ro ot":{"${a.id}":{"x":1,"y":2}}}`
  ];
  for (const positions of attacks) {
    const raw = JSON.stringify(base).replace(/}$/, `,"positions":${positions}}`);
    assert.throws(() => parseBackup(raw), undefined, positions);
    // Even read straight from storage, the cleaner keeps only well-formed keys, in dictionaries with no prototype.
    const clean = cleanPositions(JSON.parse(positions));
    assert.equal(Object.getPrototypeOf(clean), null);
    for (const m of Object.values(clean)) assert.equal(Object.getPrototypeOf(m), null);
    assert.ok(!Object.keys(clean).some(k => !placeKey(k)));
  }
  // A stored record keyed by an entry named '__proto__' does not replace a prototype on read or write either.
  const kv = memory(); kv.setItem(POSITIONS_KEY, `{"__proto__":{"root":{"toString":{"x":1,"y":2}}},"E_1":{"root":{"${a.id}":{"x":3,"y":4}}}}`);
  assert.deepEqual(plain(readEntryPositions(kv, 'E_1', p.id)), { root: { [a.id]: { x: 3, y: 4 } } });
  assert.deepEqual(plain(readEntryPositions(kv, 'toString', p.id)), {});
  writeEntryPositions(kv, 'E_2', { root: { [a.id]: { x: 5, y: 6 } } });
  assert.deepEqual(plain(readEntryPositions(kv, 'E_1', p.id)), { root: { [a.id]: { x: 3, y: 4 } } });
  // Folds and cameras: an inherited name is not a part's key.
  const view = cleanViewState(JSON.parse(`{"folds":{"__proto__":true,"toString":false,"ok":true},"cameras":{"__proto__":{"x":1,"y":2,"scale":1},"":{"x":0,"y":0,"scale":1}}}`));
  assert.deepEqual(view, { folds: { ok: true }, cameras: { '': { x: 0, y: 0, scale: 1 } } });
  assert.equal(Object.getPrototypeOf(view.cameras), Object.prototype);
  // Object.prototype is as it was; ordinary objects still convert to strings.
  assert.deepEqual(protoState(), before);
  assert.equal(String({}), '[object Object]');
  // Valid places (ids and the root, negative and fractional points) and older backups without places read as before.
  const ok = { root: { [a.id]: { x: -120.5, y: 40 } }, [a.id]: { [p.space.areas[1].id]: { x: 0, y: 999999 } } };
  assert.deepEqual(parseBackup(serializeBackup(p, ok)).positions, ok);
  assert.deepEqual(plain(cleanPositions(ok)), ok);
  assert.equal(parseBackup(serializeProject(p)).positions, null);
});

/** Collector at 1280, top groups open: the review's selection. */
const collector = () => {
  const v = viewOf('oss-collector'), l = layoutScope(v, null, (_id, d) => d === 0, {}, undefined, undefined, 1280 / 668);
  return { v, l, id: name => v.parts.find(p => p.name === name).id };
};

test('FIX68-3 beside a selection the summary keeps every other relation once: the line of 12 holds the other 8, back to 12 on deselect', () => {
  const { v, l, id } = collector(), all = v.relations.map(r => r.id).sort();
  const rest = summaryEdges(l.boxes, l.edges);
  assert.deepEqual(rest.map(s => s.ids.length).sort((x, y) => x - y), [12, 20]);
  const check = sel => {
    const own = e => e.from === sel || e.to === sel, mine = l.edges.filter(own), beside = restSummary(l.boxes, l.edges, own);
    // Each relation reads once: on the selection's own line or in exactly one summary line, never both, none lost.
    const ids = [...mine.flatMap(e => e.ids), ...beside.flatMap(s => s.ids)];
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids.sort(), all);
    for (const s of beside) {
      // Same ends and kind as the line at rest (no new verb or direction), holding a subset of its relations.
      const was = rest.find(r => r.key === s.key);
      assert.ok(was, s.key); assert.equal(s.from, was.from); assert.equal(s.to, was.to); assert.equal(s.kind, was.kind);
      assert.ok(s.ids.every(r => was.ids.includes(r)));
      for (const r of s.ids) { const rel = v.relations.find(x => x.id === r); assert.equal(rel.kind, s.kind); }
    }
    return { mine, beside };
  };
  // The review's case: 수신 설정 ID's four relations are drawn one by one; the line of 12 keeps the other 8.
  const { mine, beside } = check(id('수신 설정 ID'));
  assert.equal(mine.flatMap(e => e.ids).length, 4);
  assert.deepEqual(beside.map(s => s.ids.length).sort((x, y) => x - y), [8, 20]);
  // Every part and group of the view: a group selection, a part with no relation, each of the others.
  for (const b of l.boxes.values()) check(b.id);
  // Deselected: the summary at rest again.
  assert.deepEqual(restSummary(l.boxes, l.edges, () => false).map(s => s.ids.length).sort((x, y) => x - y), [12, 20]);
});

/** Points along an edge path made of M, C, L and Q commands. */
function sample(d) {
  const t = d.match(/[MCLQ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g), pts = []; let i = 0, cur = null;
  const num = () => Number(t[i++]);
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M') { cur = { x: num(), y: num() }; pts.push(cur); continue; }
    const P = c === 'C' ? [cur, { x: num(), y: num() }, { x: num(), y: num() }, { x: num(), y: num() }] : c === 'Q' ? [cur, { x: num(), y: num() }, { x: num(), y: num() }] : [cur, { x: num(), y: num() }];
    for (let s = 1; s <= 20; s++) {
      const u = s / 20, w = 1 - u;
      pts.push(P.length === 4 ? { x: w ** 3 * P[0].x + 3 * w * w * u * P[1].x + 3 * w * u * u * P[2].x + u ** 3 * P[3].x, y: w ** 3 * P[0].y + 3 * w * w * u * P[1].y + 3 * w * u * u * P[2].y + u ** 3 * P[3].y }
        : P.length === 3 ? { x: w * w * P[0].x + 2 * w * u * P[1].x + u * u * P[2].x, y: w * w * P[0].y + 2 * w * u * P[1].y + u * u * P[2].y }
        : { x: w * P[0].x + u * P[1].x, y: w * P[0].y + u * P[1].y });
    }
    cur = P.at(-1);
  }
  return pts;
}
const under = (q, o, m = 2) => q.x > o.x + m && q.x < o.x + o.w - m && q.y > o.y + m && q.y < o.y + o.h - m;
const holds = (l, o, id) => { for (let c = id, g = 0; c && g < 64; c = l.boxes.get(c)?.container, g++) if (c === o.id) return true; return false; };
/** What a line passes under that is not its own: another part or group, or the head of a group around one of its ends. */
function crossed(l, e) {
  const a = l.boxes.get(e.from), b = l.boxes.get(e.to), r = edgePath(a, b, l.boxes.values()), pts = sample(r.d), out = [];
  for (const o of l.boxes.values()) {
    if (o === a || o === b) continue;
    if (holds(l, o, e.from) || holds(l, o, e.to)) { if (o.kind === 'frame' && o.head > 0 && pts.some(q => under(q, { x: o.x, y: o.y, w: o.w, h: o.head }))) out.push(`head ${o.id}`); continue; }
    if ((a.kind === 'frame' && holds(l, a, o.id)) || (b.kind === 'frame' && holds(l, b, o.id))) continue;
    if (pts.some(q => under(q, o))) out.push(o.id);
  }
  return { r, out };
}

test('FIX68-4 scikit-learn: 이름 기준 전처리 조합 → 수치 Pipeline no longer passes behind 범주 Pipeline; it leaves from the near side', () => {
  const v = viewOf('oss-scikit-learn'), named = (n, parent) => v.parts.find(p => p.name === n && (!parent || v.parts.find(q => q.id === p.parentId)?.name === parent));
  const from = named('전처리 조합', '이름으로 열 선택'), to = named('수치 Pipeline'), between = named('범주 Pipeline');
  for (const aspect of [1440 / 848, 1280 / 668]) {
    const l = layoutScope(v, null, (_id, d) => d === 0, {}, undefined, undefined, aspect), e = l.edges.find(x => x.from === from.id && x.to === to.id);
    assert.ok(e, 'the stored relation is drawn');
    const { r, out } = crossed(l, e), a = l.boxes.get(from.id);
    assert.deepEqual(out, [], `passes under ${out.join(', ')}`);
    assert.ok(!out.includes(between.id));
    assert.equal(r.clear, true);
    // Leaves 전처리 조합 on the side facing its partner, at its middle row (the near end is kept).
    const m = /^M(-?[\d.]+),(-?[\d.]+)/.exec(r.d);
    assert.equal(Number(m[1]), a.x + a.w); assert.equal(Number(m[2]), a.y + a.h / 2);
  }
});

test('FIX68-4 every OSS case and example, any scope and fold: no line or summary passes under a part, group or group head it does not belong to', () => {
  const views = [...data.cases.map(c => [c.spec.id, studioView(buildExample(c.spec))]), ...EXAMPLES.map(e => [e.id, studioView(buildExample(e))])];
  const bad = [];
  let lines = 0;
  for (const [name, v] of views) {
    for (const scope of [null, ...v.parts.filter(p => p.childIds.length >= 2).map(p => p.id)])
      for (const open of [(_id, d) => d === 0, (_id, d) => d <= 2, () => false])
        for (const aspect of [1280 / 668, 1440 / 848, 1]) {
          const l = layoutScope(v, scope, open, {}, undefined, undefined, aspect);
          for (const e of [...l.edges, ...(l.edges.length > 6 ? summaryEdges(l.boxes, l.edges) : [])]) {
            lines++; const { out } = crossed(l, e); if (out.length) bad.push(`${name} ${scope ?? '-'} ${e.key}: ${out.join(', ')}`);
          }
        }
  }
  assert.ok(lines > 2000, String(lines));
  assert.deepEqual(bad, []);
});
