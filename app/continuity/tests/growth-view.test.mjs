// The growing map (ruling F6 Q4, Q5; map-growth.ts, growth-view.ts), its pure part: map versions rebuilt from the readings' prefix, the
// change set as the difference of the two ends (each kind; a part in two kinds counts in both, the parts total apart), the visit baseline,
// common parts at 0px in a past version, plain words for every row reason, the 미반영 rows of a fixture map, the person's edit log and its
// validation, and the line, tabs and their places. Fictional readings and the anonymised growth fixture only. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../dist/public/shared/map-growth.js';
import * as V from '../dist/public/client/growth-view.js';
import * as D from '../dist/public/shared/domain.js';
import { partAliases, identityState } from '../dist/public/shared/map-identity.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { serializeProject, cleanViewState } from '../dist/public/shared/storage.js';
import { layoutScope, ROOT } from '../dist/public/client/map-layout.js';
import { ROW_REASONS } from '../dist/public/shared/types.js';
import { growthFixture, fixtureProject } from './growth51-replay.mjs';

/* A fictional workshop map read five times:
 * v1 수집기 → 정리기 → 저장소 (정리기 and 저장소 in the group 처리 묶음), 옛 타이머 → 수집기
 * v2 새 감시기 → 수집기; 정리기 described anew (the record says it replaces the old description)
 * v3 저장소 renamed 기록 저장소; 옛 타이머 retired, 새 감시기 its successor; 정리기 reimplemented (옛 엔진 → 새 엔진)
 * v4 정리기 사본 (a duplicate the map made) and 임시 도구 appear
 * v5 정리기 사본 folded onto 정리기; 임시 도구 retired with no successor; the person corrects 수집기's description before it */
const T = d => `2026-10-0${d}T09:00:00.000Z`;
const made = (areaId, name, role, parentId = null) => ({ areaId, created: { name, parentId }, role, roleAbout: null, roleReplaces: null, basis: [], claims: [] });
const said = (areaId, role, replaces = false) => ({ areaId, created: null, role, roleAbout: null, roleReplaces: replaces ? { record: 'N1', quote: '이 설명으로 바꿈' } : null, basis: [], claims: [] });
const rel = (relationId, from, to, kind = 'flow') => ({ relationId, from, to, kind, quote: { record: 'N1', quote: '선' } });
const op = (o) => ({ successor: null, into: null, from: null, to: null, renamed: false, ...o });
const ident = (id, o, when = '2026-09-30') => ({ record: 'AF5-test@c0de', id, map: null, answer: null, part: 'B01', state: 'reflected', reason: null, areaId: o.areaId, op: op(o), when, evidence: ['E01'], at: { record: 'N1', from: 0, to: 4 } });
const reading = (n, parts, relations = [], identity = []) => ({ version: 'map-reading.20', id: `R${n}`, at: T(n), model: 'm', prompt: 'p', hash: `h${n}`, records: [], summary: '', parts, relations, candidates: [], gaps: [], skipped: [], identity });
function workshop() {
  const p = D.createProject();
  const areas = [['grp', '처리 묶음'], ['col', '수집기'], ['srt', '정리기'], ['sto', '기록 저장소'], ['tim', '옛 타이머'], ['wat', '새 감시기'], ['dup', '정리기 사본'], ['tmp', '임시 도구']];
  p.space.areas = areas.map(([id, name], i) => ({ id, name, note: '', archived: false, createdAt: T(1) }));
  for (const [id] of areas) p.space.containment.revisions[id] = 0;
  Object.assign(p.space.containment.parents, { srt: 'grp', sto: 'grp', dup: 'grp' });
  p.space.relations = [['L1', 'col', 'srt'], ['L2', 'srt', 'sto'], ['L3', 'tim', 'col'], ['L4', 'wat', 'col'], ['L5', 'dup', 'sto']].map(([id, from, to]) => ({ id, from, to, kind: 'flow', note: '' }));
  p.readings = [
    reading(1, [made('grp', '처리 묶음', null), made('col', '수집기', '자료를 모은다'), made('srt', '정리기', '모은 것을 고른다', 'grp'), made('sto', '저장소', '고른 것을 둔다', 'grp'), made('tim', '옛 타이머', '정해진 때에 수집기를 깨운다')],
      [rel('L1', 'col', 'srt'), rel('L2', 'srt', 'sto'), rel('L3', 'tim', 'col')]),
    reading(2, [made('wat', '새 감시기', '폴더를 지켜보다 수집기를 깨운다'), said('srt', '모은 것을 규칙대로 고르고 나눈다', true)], [rel('L4', 'wat', 'col')]),
    reading(3, [], [], [ident('ID01', { kind: 'rename', areaId: 'sto', from: '저장소', to: '기록 저장소', renamed: true }), ident('ID02', { kind: 'retire', areaId: 'tim', successor: 'wat' }, 'c0ffee1 2026-09-29'),
      ident('ID03', { kind: 'reimplement', areaId: 'srt', from: '옛 엔진', to: '새 엔진' })]),
    reading(4, [made('dup', '정리기 사본', '모은 것을 고른다', 'grp'), made('tmp', '임시 도구', '잠깐 쓰는 도구')], [rel('L5', 'dup', 'sto')]),
    { version: 'map-correction.1', id: 'M1', at: '2026-10-04T12:00:00.000Z', areaId: 'col', text: '자료를 모아 하루에 한 번 넘긴다', corrects: 'R1' },
    reading(5, [], [], [ident('ID04', { kind: 'fold', areaId: 'dup', into: 'srt' }), ident('ID05', { kind: 'retire', areaId: 'tmp' })])];
  return p;
}

test('GROWTH-1 versions: one per map reading, 1-based, labelled 「지도 v07」, a correction is no version', () => {
  const p = workshop(), vs = G.mapVersions(p);
  assert.deepEqual(vs.map(v => v.n), [1, 2, 3, 4, 5]);
  assert.equal(vs[4].end, p.readings.length, 'the last version ends after the correction before it');
  assert.equal(vs[3].end, 4);
  assert.equal(G.versionLabel(4), '지도 v04'); assert.equal(G.versionLabel(17), '지도 v17');
  assert.deepEqual(Object.values(G.GROWTH_WORDS).slice(0, 4), ['지도 버전', '지도 이력', '기록 대상 판본', '변경 계획']);
});

test('GROWTH-2 change set: each kind, the both-ends difference, a part in two kinds counted in both and the parts total apart', () => {
  const p = workshop(), cs = G.changeSet(p, 1, 3), by = k => cs.changes.filter(c => c.kind === k);
  assert.deepEqual(by('new').map(c => c.part), ['wat']);
  assert.equal(by('new')[0].since, 2, 'the version whose reading made it');
  assert.deepEqual(by('rename').map(c => [c.part, c.before, c.after]), [['sto', '저장소', '기록 저장소']]);
  assert.deepEqual(by('reimpl').map(c => [c.part, c.before, c.after]), [['srt', '옛 엔진', '새 엔진']]);
  assert.deepEqual(by('desc').map(c => [c.part, c.before, c.after, c.replaced]), [['srt', '모은 것을 고른다', '모은 것을 규칙대로 고르고 나눈다', 'stated']]);
  assert.deepEqual(by('retire').map(c => [c.part, c.successor]), [['tim', 'wat']]);
  assert.deepEqual(by('succeed').map(c => [c.part, c.predecessor]), [['wat', 'tim']]);
  assert.equal(by('succeed')[0].cite.when, 'c0ffee1 2026-09-29'); assert.deepEqual(by('succeed')[0].cite.evidence, ['E01']);
  assert.deepEqual({ new: cs.counts.new, succeed: cs.counts.succeed, reimpl: cs.counts.reimpl, desc: cs.counts.desc }, { new: 1, succeed: 1, reimpl: 1, desc: 1 });
  // 새 감시기 is new and the successor; 정리기 reimplemented and re-described: six changes on four parts.
  assert.equal(cs.changes.length, 6); assert.equal(cs.parts, 4);
  assert.deepEqual(cs.added.map(l => [l.from, l.to]), [['wat', 'col']]);
  assert.deepEqual(cs.removed.map(l => [l.from, l.to]), [['tim', 'col']], 'the retired part\'s line goes; its neighbours are never joined');
  // A description update is 설명, never 정정; nothing here is a person's correction.
  assert.equal(cs.counts.correct, 0);
});

test('GROWTH-3 change set: 중복 정리 2→1, a part made and retired between the two ends is in neither, the person\'s correction is 정정', () => {
  const p = workshop();
  const late = G.changeSet(p, 4, 5);
  assert.deepEqual(late.changes.filter(c => c.kind === 'dedupe').map(c => [c.part, c.others]), [['srt', ['dup']]]);
  assert.equal(V.tabWord(late.changes.find(c => c.kind === 'dedupe')), '중복 정리 2→1');
  assert.deepEqual(late.changes.filter(c => c.kind === 'retire').map(c => [c.part, c.successor]), [['tmp', null]]);
  assert.equal(late.counts.succeed, 0, 'a retirement with no successor names none');
  assert.deepEqual(late.changes.filter(c => c.kind === 'correct').map(c => c.part), ['col']);
  assert.deepEqual(late.removed, [], 'the duplicate\'s line reads as its canonical part\'s: the same line, not removed and added');
  const wide = G.changeSet(p, 3, 5);
  assert.equal(wide.changes.some(c => c.part === 'tmp' || c.part === 'dup'), false, 'made and gone between the ends: on neither');
  assert.equal(wide.counts.dedupe, 0); assert.equal(wide.counts.merge, 0, '통합 is never counted from a fold the map made');
  assert.equal(G.CHANGE_WORD.dedupe, '중복 정리'); assert.equal(G.CHANGE_WORD.desc, '설명'); assert.equal(G.CHANGE_WORD.correct, '정정');
});

test('GROWTH-4 a past version: later parts left out, past names, no future aliases, retired parts there before their retirement', () => {
  const p = workshop();
  const v2 = G.pastVersion(p, 2), names = new Map(v2.view.parts.map(x => [x.id, x.name]));
  assert.deepEqual([...names.keys()].sort(), ['col', 'grp', 'srt', 'sto', 'tim', 'wat']);
  assert.equal(names.get('sto'), '저장소', 'the name before the rename');
  assert.deepEqual(partAliases(v2.project, 'sto'), [], 'no alias from a later rename');
  assert.deepEqual(partAliases(p, 'sto').map(a => a.name), ['저장소']);
  assert.equal(identityState(v2.project).retired.size, 0, 'no later retirement applied');
  assert.equal(G.pastVersion(p, 3).view.parts.some(x => x.id === 'tim'), false);
  assert.deepEqual(G.pastVersion(p, 1).view.relations.map(r => r.id).sort(), ['L1', 'L2', 'L3']);
  // A name the person gave with no time is not dated after the fact (the record's name then, counted); a part the person made is there
  // only from its own time.
  const q = workshop(); q.space.areas.find(a => a.id === 'col').name = '우리 수집기';
  q.space.areas.push({ id: 'own', name: '손 메모', note: '', archived: false, createdAt: '2026-10-03T10:00:00.000Z' }); q.space.containment.revisions.own = 0;
  assert.equal(G.pastVersion(q, 2).view.parts.find(x => x.id === 'col').name, '수집기');
  assert.equal(G.pastVersion(q, 2).undated, 1);
  assert.equal(G.pastVersion(q, 2).view.parts.some(x => x.id === 'own'), false);
  assert.equal(G.pastVersion(q, 4).view.parts.some(x => x.id === 'own'), true);
  assert.equal(G.pastVersion(q, 4).applied, 1);
  assert.throws(() => G.pastVersion(p, 9));
});

test('GROWTH-5 the person\'s edits: undated ones left out and counted, logged ones applied by their time, the log validated and kept', () => {
  let p = workshop();
  // Before the log: an archive and a relation the person drew have no time.
  p.space.areas.find(a => a.id === 'tmp').archived = true; p.space.relations.push({ id: 'L9', from: 'col', to: 'sto', kind: 'needs', note: '' });
  let v = G.pastVersion(p, 4);
  assert.equal(v.view.parts.some(x => x.id === 'tmp'), true, 'an undated archive is not applied');
  assert.equal(v.view.relations.some(r => r.id === 'L9'), false, 'an undated relation is not drawn');
  assert.equal(v.undated, 2); assert.equal(v.applied, 0);
  // From now on: logged with sequence, time and before/after.
  p = workshop();
  p = D.addRelationByPerson(p, 'col', 'sto', 'needs', '참고');
  p = D.archiveAreaByPerson(p, 'tmp', true);
  p = D.setAreaParentByPerson(p, 'col', 'grp');
  p = D.removeRelationByPerson(p, 'L1');
  const e = p.edits.entries;
  assert.deepEqual(e.map(x => [x.seq, x.kind]), [[1, 'relation-add'], [2, 'archive'], [3, 'parent'], [4, 'relation-remove']]);
  assert.deepEqual([e[1].before, e[1].after], [false, true]); assert.deepEqual([e[2].before, e[2].after], [null, 'grp']);
  assert.equal(e[3].before.from, 'col'); assert.equal(e[3].after, null);
  assert.equal(D.archiveAreaByPerson(p, 'tmp', true).edits.entries.length, 4, 'a call that changes nothing logs nothing');
  // The log is newer than every reading: no version shows these edits (they came after), and none counts as undated.
  v = G.pastVersion(p, 5);
  assert.equal(v.view.relations.some(r => r.id === 'L1'), true); assert.equal(v.applied, 0); assert.equal(v.undated, 0);
  // Dated before a version: applied there.
  const early = structuredClone(p); for (const x of early.edits.entries) x.at = '2026-10-04T13:00:00.000Z'; early.edits.since = '2026-10-04T13:00:00.000Z';
  v = G.pastVersion(early, 5);
  assert.equal(v.view.relations.some(r => r.id === 'L1'), false); assert.equal(v.view.parts.some(x => x.id === 'tmp'), false);
  assert.equal(v.view.parts.find(x => x.id === 'col').parentId, 'grp'); assert.equal(v.applied, 4);
});

test('GROWTH-6 the edit log\'s validation: old data reads as before, a broken log is refused', () => {
  let p = D.createProject(); for (const n of ['수집기', '정리기', '저장소']) p = D.addArea(p, n);
  const [a, b, c] = p.space.areas.map(x => x.id); p = D.addRelation(p, a, b, 'flow');
  const plain = parseProject(serializeProject(p));
  assert.equal('edits' in plain, false, 'a project without edits keeps its exact shape');
  const q = D.setAreaParentByPerson(D.archiveAreaByPerson(D.addRelationByPerson(p, a, c, 'needs', '참고'), c, true), b, a);
  const back = parseProject(serializeProject(q));
  assert.deepEqual(back.edits, q.edits, 'stored and read back as it was');
  assert.deepEqual(back.edits.entries.map(x => [x.seq, x.kind]), [[1, 'relation-add'], [2, 'archive'], [3, 'parent']]);
  const bad = (f) => { const x = structuredClone(q); f(x); assert.throws(() => parseProject(serializeProject(x)), /INVALID_DATA/); };
  bad(x => { x.edits.entries[1].seq = 3; });
  bad(x => { x.edits.entries[1].at = '2020-01-01T00:00:00.000Z'; });
  bad(x => { x.edits.entries[1].target = 'A_nope'; });
  bad(x => { x.edits.entries[2].after = x.edits.entries[2].target; });
  bad(x => { x.edits.entries[1].before = true; });
  bad(x => { x.edits.entries[0].after.id = 'L_other'; });
  bad(x => { x.edits.entries[0].kind = 'rename'; });
  bad(x => { x.edits.version = 'human-edits.0'; });
  bad(x => { x.edits.entries[0].extra = 1; });
});

test('GROWTH-7 the baseline: fixed at the visit\'s start, a reload keeps it, a later visit takes what was shown, a first visit has none', () => {
  const now = Date.parse('2026-11-13T10:00:00.000Z');
  assert.deepEqual(G.visitBaseline(null, now), { base: null, continuing: false });
  const memo = G.growthMemo(null, 7, null, now - 5 * 60000);
  assert.deepEqual(memo, { seen: 7, at: '2026-11-13T09:55:00.000Z', base: null, pick: null });
  assert.deepEqual(G.visitBaseline({ seen: 9, at: '2026-11-13T09:55:00.000Z', base: 4, pick: null }, now), { base: 4, continuing: true }, 'a reload in the same visit keeps its baseline, whatever was read since');
  assert.deepEqual(G.visitBaseline({ seen: 9, at: '2026-11-13T08:00:00.000Z', base: 4, pick: 2 }, now), { base: 9, continuing: false }, 'the next visit compares with what the last one showed');
  assert.equal(G.compareBase(4, 7), 4); assert.equal(G.compareBase(7, 7), null); assert.equal(G.compareBase(null, 7), null); assert.equal(G.compareBase(9, 7), null);
  assert.equal(V.chipText(4, 7), '이전 방문 · 지도 v04 → 지도 v07');
  // Stored with the view, apart from the project; a broken memo reads as a first visit and the pick is kept apart.
  assert.deepEqual(cleanViewState({ folds: {}, cameras: {}, growth: { seen: 7, at: memo.at, base: 4, pick: 2 } }).growth, { seen: 7, at: memo.at, base: 4, pick: 2 });
  assert.equal(cleanViewState({ folds: {}, cameras: {}, growth: { seen: 0, at: memo.at, base: null, pick: null } }).growth, undefined);
  assert.equal(cleanViewState({ folds: {}, cameras: {} }).growth, undefined);
});

test('GROWTH-8 0px: the common parts of a past version keep their current places, its own parts move clear of them', () => {
  const p = workshop(), cur = G.pastVersion(p, 5).view, past = G.pastVersion(p, 2).view;
  const open = () => true, L1 = layoutScope(cur, null, open, {});
  const pins = {}; for (const b of L1.boxes.values()) if (b.kind !== 'ghost') (pins[b.container] ??= {})[b.id] = { x: Math.round(b.rel.x), y: Math.round(b.rel.y) };
  let L2 = layoutScope(past, null, open, pins);
  const fix = V.clearPastOnly([...L2.boxes.values()], new Set(Object.values(pins).flatMap(m => Object.keys(m))));
  const all = structuredClone(pins); for (const [c, m] of Object.entries(fix)) all[c] = { ...all[c], ...m };
  L2 = layoutScope(past, null, open, all);
  let common = 0;
  for (const [id, b] of L1.boxes) { const a = L2.boxes.get(id); if (!a || b.kind === 'ghost' || a.container !== b.container) continue; common++; assert.equal(Math.round(a.x), Math.round(b.x), id); assert.equal(Math.round(a.y), Math.round(b.y), id); }
  assert.ok(common >= 4, `common parts ${common}`);
  const only = [...L2.boxes.values()].filter(b => b.kind !== 'ghost' && !L1.boxes.has(b.id));
  assert.deepEqual(only.map(b => b.id), ['tim']);
  const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const b of only) for (const c of L2.boxes.values()) if (c.id !== b.id && c.kind === 'node') assert.equal(meets(b, c), false, `${b.id} over ${c.id}`);
  // clearPastOnly alone: only a loose box that meets a pinned one moves, under its container's boxes.
  const boxes = [{ id: 'a', container: ROOT, rel: { x: 0, y: 0 }, x: 0, y: 0, w: 100, h: 50, kind: 'node' }, { id: 'n', container: ROOT, rel: { x: 40, y: 20 }, x: 40, y: 20, w: 100, h: 50, kind: 'node' }, { id: 'f', container: ROOT, rel: { x: 400, y: 0 }, x: 400, y: 0, w: 100, h: 50, kind: 'node' }];
  assert.deepEqual(V.clearPastOnly(boxes, new Set(['a'])), { [ROOT]: { n: { x: 0, y: 82 } } });
});

test('GROWTH-9 plain words for every row reason, by state; 대기 · 보류 · 거절', () => {
  const all = G.allRowReasons();
  assert.equal(all.length, Object.values(ROW_REASONS).flat().length);
  for (const k of all) { const [s, r] = k.split(':'); const w = G.rowReasonWords(s, r); assert.ok(w && w !== '이유가 적히지 않음', k); assert.doesNotMatch(w, /[A-Za-z]/, k); }
  assert.equal(new Set(all.map(k => G.ROW_REASON_WORDS[k])).size, all.length, 'no two reasons read the same');
  assert.deepEqual(G.ROW_STATE_WORD, { waiting: '대기', held: '보류', rejected: '거절' });
  assert.equal(G.rowReasonWords('held', 'nothing-like-this'), '이유가 적히지 않음');
  assert.equal(G.plainCells(['B03 · B12·B15', '구성', 'F09+F04'], b => ({ B03: '수집기', B12: '정리기' })[b] ?? null), '수집기 · 정리기 · 구성');
});

test('GROWTH-10 미반영 on the anonymised growth map: the rows read up to a version that are not reflected, plain and sourced', () => {
  const p = fixtureProject(growthFixture('track-a')), vs = G.mapVersions(p);
  assert.equal(vs.length, 9);
  const last = G.unreflectedAt(p, 9), first = G.unreflectedAt(p, 1);
  assert.ok(last.length > 0 && first.length > 0);
  const order = { waiting: 0, held: 1, rejected: 2 };
  for (let i = 1; i < last.length; i++) assert.ok(order[last[i - 1].state] <= order[last[i].state], 'waiting, then held, then rejected');
  for (const x of last) {
    assert.ok(['waiting', 'held', 'rejected'].includes(x.state));
    assert.equal(x.words, G.rowReasonWords(x.state, x.reason));
    assert.doesNotMatch(x.tried, /(?<![A-Za-z0-9])(?:B|F|E|ID|CH)\d{2,3}(?!\d)/, `no row ID: ${x.tried}`);
    assert.ok(x.line >= 1 && p.pasted.some(t => t.id === x.paste));
  }
  // Only records read up to the version: version 1 read one record.
  const read1 = new Set(p.readings.slice(0, vs[0].end).flatMap(r => r.records?.map(x => x.id) ?? []));
  assert.ok(first.every(x => read1.has(x.paste)));
  const cs = G.changeSet(p, 4, 9);
  assert.ok(cs.counts.new > 0 && cs.added.length > 0);
  assert.match(V.summaryText(cs), /^지도 v04 → 지도 v09 · 새 \d+ · 연결 \+\d+/);
});

test('GROWTH-11 the line and the tabs: nonzero items in order, 설명 tabs only once picked, main word first and +N, no two tabs meet', () => {
  const p = workshop(), cs = G.changeSet(p, 1, 3);
  assert.equal(V.summaryText(cs), '지도 v01 → 지도 v03 · 새 1 · 이름 1 · 구현 1 · 승계 1 · 은퇴 1 · 연결 +1 −1 · 설명 1');
  assert.deepEqual(V.summaryItems(cs).map(i => i.key), ['new', 'rename', 'reimpl', 'succeed', 'retire', 'lines', 'desc']);
  const tabs = V.cardTabs(cs, false);
  assert.deepEqual(tabs.map(t => [t.part, t.word, t.more]), [['wat', '승계', 1], ['sto', '이름', 0], ['srt', '구현', 0]]);
  assert.equal(tabs.some(t => t.part === 'tim'), false, 'a retired part has no tab on the current map');
  assert.deepEqual(V.cardTabs(cs, true).find(t => t.part === 'srt').more, 1, 'with 설명 picked it counts');
  // Places: many cards in tight rows; tabs never meet each other or another card, and the ones with no room hide.
  const boxes = new Map(), obstacles = [], list = [];
  for (let i = 0; i < 24; i++) { const r = { x: (i % 6) * 240, y: Math.floor(i / 6) * 90, w: 224, h: 80 }; boxes.set(`p${i}`, r); obstacles.push({ id: `p${i}`, ...r }); list.push({ part: `p${i}`, w: 60 + (i % 3) * 30, h: 20 }); }
  const places = V.placeTabs(list, boxes, obstacles, 3), shown = [...places.values()].filter(Boolean);
  const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (let i = 0; i < shown.length; i++) { for (let j = i + 1; j < shown.length; j++) assert.equal(meets(shown[i], shown[j]), false); for (const o of obstacles) assert.equal(meets(shown[i], o), false); }
  assert.ok(shown.length >= 6, 'the top row has room above'); assert.ok(shown.length < 24, 'tight rows hide some');
  // A free card gets its tab right above it, left-aligned.
  assert.deepEqual(V.placeTabs([{ part: 'x', w: 40, h: 20 }], new Map([['x', { x: 100, y: 100, w: 200, h: 80 }]]), [], 2).get('x'), { x: 100, y: 78, w: 40, h: 20 });
});

test('GROWTH-12 the later end is the live map: a correction after the last map reading is 정정, a part archived with no log entry is archived', () => {
  const p = workshop();
  p.readings.push({ version: 'map-correction.1', id: 'M9', at: '2026-10-06T09:00:00.000Z', areaId: 'srt', text: '모은 것을 하루에 한 번 고른다', corrects: 'R2' });
  p.space.areas.find(a => a.id === 'wat').archived = true;
  const v = G.versionAt(p, 5);
  assert.equal(v.live, true); assert.equal(v.project, p, 'the project as it stands, not a rebuild');
  assert.equal(v.view.parts.find(x => x.id === 'srt').reading.role, '모은 것을 하루에 한 번 고른다');
  assert.equal(v.view.parts.some(x => x.id === 'wat'), false, 'archived now, with or without a log entry');
  assert.equal(G.versionAt(p, 4), G.pastVersion(p, 4), 'an earlier version is the rebuild');
  const late = G.changeSet(p, 4, 5);
  assert.deepEqual(late.changes.filter(c => c.kind === 'correct').map(c => [c.part, c.after]), [['col', '자료를 모아 하루에 한 번 넘긴다'], ['srt', '모은 것을 하루에 한 번 고른다']]);
  const wide = G.changeSet(p, 1, 5);
  assert.equal(wide.changes.some(c => c.part === 'wat'), false, 'a part archived now is no 새 part and no 승계 of the live map');
  assert.equal(wide.added.some(l => l.from === 'wat' || l.to === 'wat'), false);
});

test('GROWTH-13 a past version shows the record\'s name of the time and no note; the person\'s names and notes are logged from now on', () => {
  // No log: the person's name and note are undated edits (left out and counted).
  const q = workshop(), col = q.space.areas.find(a => a.id === 'col'); col.name = '우리 수집기'; col.note = '사람 메모';
  let v = G.pastVersion(q, 1), x = v.view.parts.find(y => y.id === 'col');
  assert.deepEqual([x.name, x.note, v.undated, v.applied], ['수집기', '', 2, 0]);
  assert.equal(G.pastVersion(q, 4).view.parts.find(y => y.id === 'sto').name, '기록 저장소', 'the record\'s own rename is the name of its time');
  // From now on the part form logs each that changed, with sequence, time, before and after.
  let p = D.editAreaByPerson(workshop(), 'col', '우리 수집기', '사람 메모');
  assert.deepEqual(p.edits.entries.map(e => [e.seq, e.kind, e.target, e.before, e.after]), [[1, 'name', 'col', '수집기', '우리 수집기'], [2, 'note', 'col', '', '사람 메모']]);
  assert.equal(p.space.areas.find(a => a.id === 'col').name, '우리 수집기');
  assert.equal(D.editAreaByPerson(p, 'col', '우리 수집기', '사람 메모').edits.entries.length, 2, 'nothing changed: nothing logged');
  p = D.editAreaByPerson(p, 'col', '우리 수집기', '고친 메모');
  assert.deepEqual(p.edits.entries.map(e => e.kind), ['name', 'note', 'note']);
  // Logged after every version: no version shows them, none is undated.
  v = G.pastVersion(p, 2); x = v.view.parts.find(y => y.id === 'col');
  assert.deepEqual([x.name, x.note, v.undated, v.applied], ['수집기', '', 0, 0]);
  // Dated between v1 and v2: applied from v2 on, not before.
  const early = structuredClone(p); early.edits.since = '2026-10-01T10:00:00.000Z'; for (const e of early.edits.entries) e.at = '2026-10-01T10:00:00.000Z';
  x = G.pastVersion(early, 2).view.parts.find(y => y.id === 'col');
  assert.deepEqual([x.name, x.note, G.pastVersion(early, 2).applied], ['우리 수집기', '고친 메모', 2]);
  assert.equal(G.pastVersion(early, 1).view.parts.find(y => y.id === 'col').name, '수집기');
  assert.equal(G.pastVersion(early, 1).undated, 0);
  // Stored and read back; a broken name or note entry is refused.
  let r = D.createProject(); for (const n of ['수집기', '정리기']) r = D.addArea(r, n);
  const id = r.space.areas[0].id; r = D.editAreaByPerson(r, id, '모으는 곳', '메모');
  assert.deepEqual(parseProject(serializeProject(r)).edits, r.edits);
  const bad = (f) => { const y = structuredClone(r); f(y); assert.throws(() => parseProject(serializeProject(y)), /INVALID_DATA/); };
  bad(y => { y.edits.entries[0].after = y.edits.entries[0].before; });
  bad(y => { y.edits.entries[0].after = 'ㄱ'.repeat(61); });
  bad(y => { y.edits.entries[1].after = 7; });
});

test('GROWTH-14 미반영 at the latest version holds the waiting rows of pasted records no reading has read yet, marked unread', () => {
  const p = fixtureProject(growthFixture('track-a')), vs = G.mapVersions(p);
  const read = new Set(p.readings.flatMap(r => r.records?.map(x => x.id) ?? [])), unreadPastes = p.pasted.filter(x => !read.has(x.id)).map(x => x.id);
  assert.ok(unreadPastes.length > 0);
  const last = G.unreflectedAt(p, vs.length), un = last.filter(x => x.unread);
  assert.ok(un.length > 0, 'the unread records\' rows are there');
  for (const x of un) { assert.ok(unreadPastes.includes(x.paste)); assert.equal(x.state, 'waiting'); assert.equal(x.words, '아직 읽지 않음'); }
  assert.ok(last.filter(x => !x.unread).every(x => read.has(x.paste)));
  // After the read records' waiting rows, before the held ones.
  const i = last.findIndex(x => x.unread), j = last.findLastIndex(x => x.unread);
  assert.ok(last.slice(0, i).every(x => x.state === 'waiting' && !x.unread)); assert.ok(last.slice(i, j + 1).every(x => x.unread));
  assert.equal(G.unreflectedAt(p, 4).some(x => x.unread), false, 'an earlier version reads only what was read up to it');
});

test('GROWTH-15 the scene\'s earlier description: a correction says the person changed it, a description update never does', () => {
  assert.equal(V.wasLabel('correct', null), '이전 설명 · 사람이 고친 설명으로 바뀜');
  assert.equal(V.wasLabel('correct', 'v2.0'), '이전 설명 · 사람이 고친 설명으로 바뀜');
  for (const w of [V.wasLabel('desc', null), V.wasLabel('desc', 'v2.0'), V.wasLabel(null, null)]) assert.doesNotMatch(w, /사람|고친|정정/);
  assert.doesNotMatch(V.wasLabel('correct', null), /새 설명|채택|갱신/);
});

test('GROWTH-16 a clock set back never stamps an edit before the one before it, and the project still loads', () => {
  let p = D.createProject(); for (const n of ['수집기', '정리기', '저장소']) p = D.addArea(p, n);
  const [a, b, c] = p.space.areas.map(x => x.id); p = D.addRelation(p, a, b, 'flow');
  const L = p.space.relations[0].id, Real = Date; let t = Date.parse('2026-11-13T10:00:00.000Z');
  globalThis.Date = class extends Real { constructor(...x) { super(...(x.length ? x : [t])); } static now() { return t; } };
  try {
    p = D.addRelationByPerson(p, a, c, 'needs'); t -= 60000; p = D.removeRelationByPerson(p, L); t -= 60000; p = D.editAreaByPerson(p, a, '모으는 곳', '');
  } finally { globalThis.Date = Real; }
  assert.deepEqual(p.edits.entries.map(e => e.at), ['2026-11-13T10:00:00.000Z', '2026-11-13T10:00:00.000Z', '2026-11-13T10:00:00.000Z']);
  assert.deepEqual(parseProject(serializeProject(p)).edits, p.edits);
});

test('GROWTH-17 a part the person made reads 「사람이 추가함」 with its time, never 「처음 읽힘」', () => {
  const p = workshop();
  p.space.areas.push({ id: 'own', name: '손으로 만든 부품', note: '', archived: false, createdAt: '2026-10-07T09:00:00.000Z' }); p.space.containment.revisions.own = 0;
  const cs = G.changeSet(p, 1, 5), own = cs.changes.find(c => c.part === 'own'), wat = cs.changes.find(c => c.part === 'wat' && c.kind === 'new');
  assert.deepEqual([own.kind, own.by, own.madeAt, own.since], ['new', 'person', '2026-10-07T09:00:00.000Z', null]);
  assert.match(V.newTitle(own, 1), /^사람이 추가함 · \d{4}/); assert.doesNotMatch(V.newTitle(own, 1), /읽힘/);
  assert.equal(wat.by, 'reading'); assert.equal(V.newTitle(wat, 1), '지도 v02에서 처음 읽힘');
});

test('GROWTH-18 a past version opens under the camera only when it shows at least half its cards, else it is fitted', () => {
  const area = { x: 16, y: 60, w: 1248, h: 560 }, card = (x, y) => ({ x, y, w: 134, h: 48 });
  assert.equal(V.pastKeepsCamera([card(-900, 100), card(-700, 300), card(1500, 200)], area), false, 'an empty canvas is no view');
  assert.equal(V.pastKeepsCamera([card(100, 100), card(-700, 300), card(1500, 200), card(1600, 200)], area), false, 'one of four');
  assert.equal(V.pastKeepsCamera([card(100, 100), card(300, 300), card(1500, 200)], area), true);
  assert.equal(V.pastKeepsCamera([], area), true);
});

test('GROWTH-19 a hub\'s 「다른 연결 N개」 chip never stands over a card\'s title, its own card\'s included', async () => {
  const { chipSpots } = await import('../dist/public/client/first-flow.js');
  // A short card whose title runs to its lower edge: the chip straddling that edge would cover the title's second line.
  const card = { x: 0, y: 0, w: 134, h: 48 }, title = { x: 22, y: 6, w: 100, h: 38 }, w = 80, hh = 20;
  const spots = [{ x: card.w - w - 10, y: card.h - hh / 2 }, { x: card.w - w - 10, y: -hh / 2 }, { x: 10, y: card.h - hh / 2 }, { x: card.w - w, y: card.h + 4 }];
  assert.deepEqual(chipSpots(spots, w, hh, [title]), [{ x: card.w - w, y: card.h + 4 }]);
  assert.deepEqual(chipSpots(spots, w, hh, [{ x: 22, y: 6, w: 100, h: 14 }]).slice(0, 1), [spots[0]], 'a one-line title leaves the card\'s lower edge free');
  assert.deepEqual(chipSpots(spots.slice(0, 1), w, hh, [title]), spots.slice(0, 1), 'with no clear place the chip still stands at its card');
});
