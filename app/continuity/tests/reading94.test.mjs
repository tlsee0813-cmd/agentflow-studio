// AF94 request reading: written cases (fixtures/reading94, author-written, not model replies). Contract/storage evidence only,
// not browser or real AI quality evidence. The golden texts were made by the fa7ba63 (pre-94) generator with the same fixed ids.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as C from '../dist/public/shared/change-plan.js';
import { validateReading, readingParts, frozenReading, READING_VERSION } from '../dist/public/shared/request-reading.js';
import { emptyBundle, parseBundle, planFile, readPlanFile, loadBundle, saveBundle, setAside, PLANS_KEY, UNREADABLE_KEY } from '../dist/public/client/plan-store.js';
import { cases, withId, PROJECT, REVIEW } from './fixtures/reading94/cases.mjs';

const GOLD = JSON.parse(readFileSync(new URL('./fixtures/reading94/frozen-texts.json', import.meta.url), 'utf8')).texts;
const made = name => { const c = cases().find(x => x.name === name); return withId(c.id, () => C.requestSnapshot(C.parsePersistedPlan(c.plan), c.review)); };
const kv = (init = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } }; };
const valid = s => { C.compareResults(s, []); return s; };
const kinds = s => s.reading.spans.map(x => (x.kind === 'material' ? `material:${x.ref}` : x.kind));
const bundleOf = (snap, origin) => ({ ...emptyBundle('초안'), snapshots: [snap], labels: { [snap.id]: Object.fromEntries(snap.itemIds.map(i => [i, i])) }, origins: { [snap.id]: origin } });

test('94 same plan, id and review give the pre-94 text exactly; its sections join back to that text', () => {
  for (const c of cases()) {
    const s = made(c.name);
    assert.equal(s.text, GOLD[c.name].text, c.name);
    assert.equal(s.reading.version, READING_VERSION);
    assert.equal(readingParts(s.text, s.reading).map(p => p.heading + p.body + p.gap).join(''), s.text, c.name);
    assert.equal(s.reading.spans.map(x => s.text.slice(x.start, x.end)).join(''), s.text);
    valid(s);
  }
});

test('94 sections are the ones written: material headings, repeated lines, Markdown, emoji and a pasted request make none', () => {
  assert.deepEqual(kinds(made('example-missing-prereq')), ['head', 'selected', 'excluded', 'prerequisites', 'preserve', 'unknowns', 'materials', 'material:INTENT', 'material:N01', 'material:N02', 'closing']);
  const reviewed = made('reviewed-all-material');
  assert.deepEqual(kinds(reviewed), ['head', 'selected', 'excluded', 'prerequisites', 'preserve', 'unknowns', 'review-unknowns', 'materials', 'material:INTENT', 'material:N01', 'material:N02', 'material:N03', 'material:N04', 'closing']);
  const parts = readingParts(reviewed.text, reviewed.reading), byRef = Object.fromEntries(parts.filter(p => p.material).map(p => [p.material.ref, p]));
  // N01's title is itself a generated heading and its text a whole fake request: one material, read as material.
  assert.equal(byRef.N01.material.title, '선택한 요청 범위:'); assert.ok(byRef.N01.body.includes('결과에 이 요청문 참조 RQ_fake'));
  assert.equal(byRef.N02.material.title, 'eval 🧪 docstring'); assert.ok(byRef.N02.body.endsWith('끝 😀'));
  assert.equal(byRef.N03.body.split('\n').filter(l => l.includes('선택한 요청 범위:')).length, 40);
  // The review's whole input is listed, not only the selected item's refs (INTENT, N02).
  assert.deepEqual(reviewed.scope.items.flatMap(i => i.sources.map(x => x.id)), ['INTENT', 'N02']);
  const sec = k => parts.find(p => p.kind === k);
  assert.equal(sec('selected').heading, '선택한 요청 범위:\n'); assert.ok(sec('selected').body.startsWith('- 제한 종류별 안내\n'));
  assert.ok(sec('prerequisites').body.startsWith(`선택 범위 재검토: ${REVIEW.summary}`));
  assert.ok(sec('excluded').body.includes('- 예외 이름 정리 🧪') && sec('excluded').body.includes('- 호출자 안내 문서'));
  assert.equal(sec('closing').body, reviewed.text.slice(reviewed.text.lastIndexOf('\n') + 1));
  // Without a review: the related material only (refs of the selection and of the missing prerequisite c0 → N01).
  assert.deepEqual(made('example-missing-prereq').reading.spans.filter(x => x.ref).map(x => x.ref), ['INTENT', 'N01', 'N02']);
  assert.deepEqual(kinds(made('reviewed-empty-lists')).filter(k => !k.startsWith('material:')), ['head', 'selected', 'excluded', 'prerequisites', 'preserve', 'unknowns', 'review-unknowns', 'materials', 'closing']);
});

test('94 a reading out of place is refused whole, never trimmed or repaired', () => {
  const base = made('reviewed-all-material'), at = k => base.reading.spans.findIndex(x => (x.kind === 'material' ? `material:${x.ref}` : x.kind) === k);
  const emoji = base.text.indexOf('🧪', base.reading.spans[at('material:N02')].start);
  const broken = {
    overlap: r => { r.spans[2].start -= 1; },
    gap: r => { r.spans[2].start += 1; },
    'past the end': r => { r.spans.at(-1).end += 1; },
    'short of the end': r => { r.spans.at(-1).end -= 1; },
    'not an integer': r => { r.spans[3].end += 0.5; r.spans[4].start += 0.5; },
    'a string offset': r => { r.spans[1].start = String(r.spans[1].start); },
    'empty span': r => { r.spans.splice(1, 0, { kind: 'selected', start: 0, end: 0 }); },
    'order swapped': r => { const [a, b] = [r.spans[4], r.spans[5]]; [a.kind, b.kind] = [b.kind, a.kind]; },
    'section missing': r => { r.spans[1].end = r.spans[2].end; r.spans.splice(2, 1); },
    'section twice': r => { r.spans[2].kind = 'selected'; },
    'review-unknowns dropped into unknowns': r => { r.spans[5].end = r.spans[6].end; r.spans.splice(6, 1); },
    'material split at its fake heading': r => { const m = r.spans[at('material:N01')], cut = base.text.indexOf('[N02] 가짜 자료', m.start); r.spans.splice(at('material:N01') + 1, 0, { kind: 'material', start: cut, end: m.end, ref: 'N02x', source: 'user', title: '가짜 자료', basis: '가짜', length: m.end - 2 - (cut + '[N02] 가짜 자료 · user\n자료 기준: 가짜\n'.length) }); m.end = cut; },
    'material ref twice': r => { r.spans[at('material:N03')].ref = 'N02'; },
    'material ref not its own': r => { r.spans[at('material:N03')].ref = 'N05'; },
    'material kind changed': r => { r.spans[at('material:N03')].source = 'code'; },
    'title not its own': r => { r.spans[at('material:N03')].title = '반복 보고 '; },
    'basis not its own': r => { r.spans[at('material:N03')].basis = '다른 기준'; },
    'length one short': r => { r.spans[at('material:N03')].length -= 1; },
    'length one long': r => { r.spans[at('material:N03')].length += 1; },
    'length not an integer': r => { r.spans[at('material:N03')].length += 0.5; },
    'title empty': r => { r.spans[at('material:N03')].title = ''; },
    'material keys of .1': r => { const m = r.spans[at('material:N03')]; delete m.title; delete m.basis; delete m.length; m.titleEnd = m.start + 10; },
    'version .1': r => { r.version = 'request-reading.1'; },
    'boundary inside an emoji (title)': r => { const m = r.spans[at('material:N02')]; m.title = base.text.slice(m.start + 6, emoji + 1); },
    'boundary inside an emoji': r => { r.spans[at('material:N02')].end = emoji + 1; r.spans[at('material:N03')].start = emoji + 1; },
    'a selected source not listed': r => { r.spans.splice(at('material:N02'), 1); r.spans[at('material:N01')].end = r.spans[at('material:N01') + 1].start; },
    'no material at all': r => { const first = at('material:INTENT'); r.spans[first - 1].end = r.spans.at(-2).end; r.spans.splice(first, r.spans.length - 1 - first); },
    'extra key': r => { r.spans[0].note = 'x'; },
    'extra top key': r => { r.text = 'x'; },
    'version': r => { r.version = 'request-reading.3'; },
    'not a list': r => { r.spans = {}; },
  };
  for (const [name, breakIt] of Object.entries(broken)) {
    const s = structuredClone(base); breakIt(s.reading);
    assert.throws(() => C.compareResults(s, []), /INVALID/, name);
    assert.throws(() => parseBundle(bundleOf(s, 'reviewed'), PROJECT), name);
  }
  // The text and its frozen neighbours bind the reading: a different head, selection or closing is refused.
  const text = {
    'basis changed': s => { s.basis = '다른 기준'; s.scope.basis = '다른 기준'; },
    'selected item retitled in scope': s => { s.scope.items[0].title = '다른 제목'; },
    'one more character in a material': s => { const i = s.text.indexOf('두 번째 줄'); s.text = s.text.slice(0, i) + '!' + s.text.slice(i); },
    'reading without its scope': s => { delete s.scope; },
    'closing names another request': s => { s.text = s.text.replace(/결과에 이 요청문 참조 RQ_case-reviewed를/, '결과에 이 요청문 참조 RQ_case-reviewee를'); },
  };
  for (const [name, change] of Object.entries(text)) { const s = structuredClone(base); change(s); assert.throws(() => C.compareResults(s, []), name); }
  // A reading is ranges and checked lines, not a checksum of the material it lists: a same-length change inside material text is
  // still the same structure (the text itself is the one body and is what is shown and copied).
  const same = structuredClone(base), i = same.text.indexOf('두 번째 줄'); same.text = same.text.slice(0, i) + '세' + same.text.slice(i + 1);
  assert.doesNotThrow(() => C.compareResults(same, []));
  // frozenReading records lines as written; validating against another text of the same length still fails on its headings.
  const lines = base.text.split('\n'), r = frozenReading(lines, [{ kind: 'head', line: 0 }]);
  assert.throws(() => validateReading(r, { ...base, items: base.scope.items, sources: [] }));
});

test('94 a later plan never rewrites an earlier document or its reading', () => {
  const c = cases().find(x => x.name === 'reviewed-all-material'), plan = C.parsePersistedPlan(c.plan);
  const snap = withId(c.id, () => C.requestSnapshot(plan, c.review)), before = structuredClone(snap);
  const revised = C.revisePlan(C.selectItems(plan, ['c1', 'c2']), { ...plan.analysis, items: plan.analysis.items.map(i => ({ ...i, title: `${i.title} (고침)` })), preserve: ['새 유지'] });
  const next = C.requestSnapshot(revised, c.review);
  assert.notEqual(next.text, snap.text); assert.deepEqual(snap, before); valid(snap); valid(next);
  const b = { ...bundleOf(snap, 'reviewed'), snapshots: [snap, next], labels: { [snap.id]: {}, [next.id]: {} }, origins: { [snap.id]: 'reviewed', [next.id]: 'reviewed' } };
  const back = parseBundle(JSON.parse(JSON.stringify(b)), PROJECT); assert.deepEqual(back.snapshots[0], before);
  assert.equal(back.snapshots[0].text, GOLD['reviewed-all-material'].text);
});

test('94 storage: .4 keeps readings through save, reload, file; .1-.3 never carried one and a mixed older store stays as it was', () => {
  const snap = made('reviewed-all-material'), b = bundleOf(snap, 'reviewed');
  const store = kv(); assert.equal(saveBundle(store, PROJECT, b), null);
  const env = JSON.parse(store.m.get(PLANS_KEY)); assert.equal(env.version, 'studio.plans.4'); assert.equal(Object.hasOwn(env, 'legacy'), false);
  assert.deepEqual(loadBundle(store, PROJECT), { bundle: b, unreadable: false });
  const file = planFile(b, { id: PROJECT, name: '표본' }); assert.equal(JSON.parse(file).format, 'agentflow.change-plan-file.4');
  assert.deepEqual(readPlanFile(file, PROJECT), b); assert.equal(readPlanFile(file, PROJECT).snapshots[0].text, snap.text);
  for (const format of ['agentflow.change-plan-file.3', 'agentflow.change-plan-file.2', 'agentflow.change-plan-file.1', 'toString', '__proto__'])
    assert.equal(typeof readPlanFile(JSON.stringify({ ...JSON.parse(file), format }), PROJECT), 'string', format);
  // A pre-94 document (no reading) in a .3 file reads as it was.
  const old = structuredClone(b); delete old.snapshots[0].reading;
  assert.deepEqual(readPlanFile(JSON.stringify({ ...JSON.parse(file), format: 'agentflow.change-plan-file.3', bundle: old }), PROJECT), old);
  // Mixed older store: .3 envelope with a .2-marked entry, a .3 entry claiming a reading (refused by its own version), a valid .3
  // entry with a pre-94 document. Saving another project moves it to .4; nothing refused becomes valid, nothing is rewritten.
  const claimed = structuredClone(b), legacyOk = { ...emptyBundle('이전 초안') }; delete legacyOk.authoring;
  claimed.snapshots[0].scope.projectId = 'P_claimed'; // its own project: under .4 rules it reads, so only its version refuses it
  assert.equal(parseBundle(claimed, 'P_claimed').snapshots[0].reading.spans.length, snap.reading.spans.length);
  const raw = { version: 'studio.plans.3', projects: { P_two: legacyOk, P_claimed: claimed, [PROJECT]: old }, legacy: { P_two: 'studio.plans.2' } };
  const mixed = kv({ [PLANS_KEY]: JSON.stringify(raw) });
  assert.equal(loadBundle(mixed, 'P_claimed').unreadable, true);
  assert.deepEqual(loadBundle(mixed, PROJECT).bundle, old); assert.deepEqual(loadBundle(mixed, 'P_two').bundle, legacyOk);
  assert.equal(saveBundle(mixed, 'P_new', emptyBundle('새')), null);
  const up = JSON.parse(mixed.m.get(PLANS_KEY));
  assert.equal(up.version, 'studio.plans.4'); assert.deepEqual(up.legacy, { P_two: 'studio.plans.2', P_claimed: 'studio.plans.3', [PROJECT]: 'studio.plans.3' });
  assert.deepEqual(up.projects.P_claimed, claimed); assert.deepEqual(up.projects[PROJECT], old); assert.deepEqual(up.projects.P_two, legacyOk);
  assert.equal(loadBundle(mixed, 'P_claimed').unreadable, true, 'still refused under .3 after the envelope moved to .4');
  assert.deepEqual(loadBundle(mixed, PROJECT).bundle, old);
  // Writing that project ends its marker; its document keeps no reading (never backfilled), a new one can carry one.
  assert.equal(saveBundle(mixed, PROJECT, { ...old, snapshots: [...old.snapshots, made('example-one-material')], origins: { ...old.origins, 'RQ_case-one': 'example' }, labels: old.labels }), null);
  const after = JSON.parse(mixed.m.get(PLANS_KEY)); assert.deepEqual(after.legacy, { P_two: 'studio.plans.2', P_claimed: 'studio.plans.3' });
  const loaded = loadBundle(mixed, PROJECT).bundle; assert.equal(Object.hasOwn(loaded.snapshots[0], 'reading'), false); assert.ok(loaded.snapshots[1].reading);
  // A .3 envelope may not mark .3 itself; a .4 one may, but only for its own entries.
  for (const legacy of [{ P_two: 'studio.plans.3' }]) assert.equal(loadBundle(kv({ [PLANS_KEY]: JSON.stringify({ ...raw, legacy }) }), 'P_two').unreadable, true);
  assert.equal(loadBundle(kv({ [PLANS_KEY]: JSON.stringify({ version: 'studio.plans.4', projects: {}, legacy: { P_x: 'studio.plans.3' } }) }), 'P_x').unreadable, true);
  assert.equal(loadBundle(kv({ [PLANS_KEY]: JSON.stringify({ version: 'studio.plans.4', projects: { P_x: claimed }, legacy: { P_x: 'studio.plans.4' } }) }), 'P_x').unreadable, true);
  // Setting the refused entry aside keeps its raw text first, then clears it and its marker.
  assert.equal(setAside(mixed, 'P_claimed'), null);
  assert.deepEqual(JSON.parse(JSON.parse(mixed.m.get(UNREADABLE_KEY)).at(-1).raw), claimed);
  assert.deepEqual(JSON.parse(mixed.m.get(PLANS_KEY)).legacy, { P_two: 'studio.plans.2' });
});

test('94 a malformed reading in a .4 store or file is refused whole: raw kept, no document shown as its plain text instead', () => {
  const snap = made('reviewed-all-material'), b = bundleOf(snap, 'reviewed');
  const bad = structuredClone(b); bad.snapshots[0].reading.spans[3].end -= 1; bad.snapshots[0].reading.spans[4].start -= 1;
  const raw = JSON.stringify({ version: 'studio.plans.4', projects: { [PROJECT]: bad } }), store = kv({ [PLANS_KEY]: raw });
  const loaded = loadBundle(store, PROJECT); assert.equal(loaded.unreadable, true); assert.deepEqual(loaded.bundle.snapshots, []);
  assert.equal(store.m.get(PLANS_KEY), raw);
  assert.equal(typeof readPlanFile(planFile(bad, { id: PROJECT, name: '표본' }), PROJECT), 'string');
  // Dropping the reading of a .4 document is a pre-94 shape: still read, as its plain text (never given a reading back).
  const plain = structuredClone(b); delete plain.snapshots[0].reading;
  assert.equal(Object.hasOwn(parseBundle(plain, PROJECT).snapshots[0], 'reading'), false);
});

// DELTA1 C1 (independent review's material probe): the official reviewed-all-material text kept as is, only its reading changed.
// INTENT is stretched to the fake '[N02] 가짜 자료 · user' heading inside N01 (849), N01 is dropped and N02 starts there as a
// user material, its end and every other range kept. Its pieces still join to the same text; it must be refused at every boundary.
test('94 DELTA1 a material list re-cut at a heading inside material text is refused at the snapshot, bundle, file and store', () => {
  const base = made('reviewed-all-material'), at = (r, ref) => r.spans.findIndex(x => x.ref === ref);
  const cut = base.text.indexOf('[N02] 가짜 자료 · user', base.reading.spans[at(base.reading, 'N01')].start);
  assert.equal(cut, 849, 'the probe\'s offset');
  const fakeHead = '[N02] 가짜 자료 · user\n자료 기준: 가짜\n';
  const recut = (r, n02) => {
    const intent = r.spans[at(r, 'INTENT')], n2 = r.spans[at(r, 'N02')];
    intent.end = cut; r.spans.splice(at(r, 'N01'), 1);
    Object.assign(n2, { start: cut }, n02(n2));
  };
  const variants = {
    // the probe itself, in this version's fields: N02 named and typed as the fake heading says, INTENT and N02 lengths as frozen
    'probe: fake title/kind/basis': r => recut(r, () => ({ source: 'user', title: '가짜 자료', basis: '가짜' })),
    'probe: lengths made to fit the cut': r => { recut(r, n2 => ({ source: 'user', title: '가짜 자료', basis: '가짜', length: n2.end - 2 - (cut + fakeHead.length) }));
      const intent = r.spans[at(r, 'INTENT')]; intent.length = cut - 2 - (intent.start + `[INTENT] ${intent.title} · user\n자료 기준: ${intent.basis}\n`.length); },
    'probe: N02 keeps its frozen name': r => recut(r, () => ({})),
    'N01 folded into INTENT': r => { const i = at(r, 'INTENT'); r.spans[i].end = r.spans[i + 2].start; r.spans.splice(i + 1, 1); },
    'all material folded into one': r => { const i = at(r, 'INTENT'); r.spans[i].end = r.spans.at(-1).start; r.spans.splice(i + 1, r.spans.length - 2 - i); },
  };
  const project = { id: PROJECT, name: '표본' };
  for (const [name, change] of Object.entries(variants)) {
    const s = structuredClone(base); change(s.reading);
    assert.equal(s.reading.spans.map(x => s.text.slice(x.start, x.end)).join(''), s.text, `${name}: still the same text`);
    assert.throws(() => validateReading(s.reading, { ...s, items: s.scope.items, sources: s.scope.items.flatMap(i => i.sources) }), name);
    assert.throws(() => C.compareResults(s, []), name);
    const b = bundleOf(s, 'reviewed');
    assert.throws(() => parseBundle(b, PROJECT), name);
    assert.equal(typeof readPlanFile(planFile(b, project), PROJECT), 'string', name);
    const raw = JSON.stringify({ version: 'studio.plans.4', projects: { [PROJECT]: b } }), store = kv({ [PLANS_KEY]: raw });
    assert.equal(loadBundle(store, PROJECT).unreadable, true, name); assert.equal(store.m.get(PLANS_KEY), raw, name);
  }
  // The listed materials are the review's whole input as frozen: id, kind, title, basis and length each, in order.
  assert.deepEqual(base.reading.spans.filter(x => x.kind === 'material').map(({ ref, source, title, basis, length }) => [ref, source, title, basis, length]),
    cases().find(c => c.name === 'reviewed-all-material').plan.evidence.map(e => [e.id, e.kind, e.title, e.basis, e.text.length]));
});

// DELTA1 C2 (independent review's store probe): project keys that are names on Object.prototype.
test('94 DELTA1 project keys toString, constructor and __proto__ are ordinary entries: own markers only, no default to .4', () => {
  const ids = ['toString', 'constructor', '__proto__'];
  const memo = new Map(), claimed = id => { if (!memo.has(id)) { const b = bundleOf(made('reviewed-all-material'), 'reviewed'); b.snapshots[0].scope.projectId = id; memo.set(id, b); } return structuredClone(memo.get(id)); };
  for (const id of ids) assert.equal(parseBundle(claimed(id), id).snapshots.length, 1, `${id}: read under .4 rules`);
  // A .3 envelope (no markers) holding a reading under each key: refused by its own version, before and after a sibling's save.
  const projects = Object.fromEntries(ids.map(id => [id, claimed(id)])), plain = { ...emptyBundle('구판 초안') }; delete plain.authoring;
  const raw3 = JSON.stringify({ version: 'studio.plans.3', projects: { ...projects, P_sib: plain } });
  assert.ok(raw3.includes('"__proto__":{'), 'the probe key is in the stored JSON');
  const store = kv({ [PLANS_KEY]: raw3 });
  for (const id of ids) assert.equal(loadBundle(store, id).unreadable, true, `${id} under .3`);
  assert.deepEqual(loadBundle(store, 'P_sib').bundle, plain);
  assert.equal(saveBundle(store, 'P_new', emptyBundle('새')), null);
  const up = JSON.parse(store.m.get(PLANS_KEY));
  assert.deepEqual(Object.entries(up.legacy).sort(), [...ids, 'P_sib'].map(id => [id, 'studio.plans.3']).sort());
  for (const id of ids) { assert.equal(loadBundle(store, id).unreadable, true, `${id} after the envelope moved to .4`); assert.deepEqual(up.projects[id], projects[id]); }
  assert.deepEqual(loadBundle(store, 'P_sib').bundle, plain); assert.equal(loadBundle(store, 'P_new').unreadable, false);
  // A save of a sibling again keeps every marker; the envelope stays readable.
  assert.equal(saveBundle(store, 'P_sib', { ...plain, draft: '고침' }), null);
  for (const id of ids) assert.equal(loadBundle(store, id).unreadable, true, `${id} after a second save`);
  assert.equal(loadBundle(store, 'P_sib').unreadable, false); assert.equal(loadBundle(store, 'P_new').unreadable, false);
  // Written by .4 under those keys: kept as own entries, read back, and their markers end on write.
  const fresh = kv();
  for (const id of ids) assert.equal(saveBundle(fresh, id, claimed(id)), null);
  for (const id of ids) assert.deepEqual(loadBundle(fresh, id), { bundle: claimed(id), unreadable: false }, id);
  assert.deepEqual(Object.keys(JSON.parse(fresh.m.get(PLANS_KEY)).projects).sort(), [...ids].sort());
  assert.equal(saveBundle(store, '__proto__', claimed('__proto__')), null);
  assert.equal(loadBundle(store, '__proto__').unreadable, false); assert.equal(Object.hasOwn(JSON.parse(store.m.get(PLANS_KEY)).legacy, '__proto__'), false);
  // Absent keys under those names read as nothing kept, not as an inherited entry.
  for (const id of ids) assert.deepEqual(loadBundle(kv({ [PLANS_KEY]: JSON.stringify({ version: 'studio.plans.4', projects: {} }) }), id), { bundle: emptyBundle(), unreadable: false });
  // Ordinary .1/.2/.3 entries still read by their own version; a marker that is not a version is not read.
  const marked = v => kv({ [PLANS_KEY]: JSON.stringify({ version: 'studio.plans.4', projects: { toString: claimed('toString') }, legacy: { toString: v } }) });
  for (const v of ['studio.plans.1', 'studio.plans.2', 'studio.plans.3', 'studio.plans.4', {}, null]) assert.equal(loadBundle(marked(v), 'toString').unreadable, true, String(v));
  assert.equal(loadBundle(kv({ [PLANS_KEY]: JSON.stringify({ version: 'studio.plans.2', projects: { constructor: plain } }) }), 'constructor').unreadable, false);
});
