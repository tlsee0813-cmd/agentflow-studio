// Ruling F7 for the growing map's compare view, its pure part: the scene order (never an importance), the scene's words, the guide made only
// of the change ledger, 기록 반영 상태 (counts equal the list's rows; 대기·보류 apart from 거절; records not read yet apart), 구현 상태 from the
// structured implementation field only, names and code as the view says them, and a part the person made in a past version. Fictional
// readings and the anonymised growth fixture only. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../dist/public/shared/map-growth.js';
import * as V from '../dist/public/client/growth-view.js';
import * as D from '../dist/public/shared/domain.js';
import { growthFixture, fixtureProject } from './growth51-replay.mjs';

/* A fictional workshop map read five times (as in growth-view.test.mjs), with the records' structured implementation field:
 * v1 수집기 (미구현) → 정리기 (no field) → 저장소, 옛 타이머 → 수집기
 * v2 새 감시기 → 수집기; 정리기 described anew
 * v3 저장소 renamed 기록 저장소; 옛 타이머 retired, 새 감시기 its successor; 정리기 reimplemented (구현 바뀜: 옛 엔진 → 새 엔진); 수집기 구현됨
 * v4 정리기 사본 and 임시 도구 appear; 저장소's status claim says 실행 중 (가동, never 구현 상태)
 * v5 정리기 사본 folded onto 정리기; 임시 도구 retired with no successor; 정리기 구현됨 (정보 없음 → 구현됨); the person corrects 수집기 before it */
const T = d => `2026-10-0${d}T09:00:00.000Z`;
const Q = { record: 'N1', quote: '| B01 | 수집기 | 구현됨 |', from: 0, to: 4 };
const made = (areaId, name, role, parentId = null, more = {}) => ({ areaId, created: { name, parentId }, role, roleAbout: null, roleReplaces: null, basis: [], claims: [], ...more });
const said = (areaId, role, more = {}) => ({ areaId, created: null, role, roleAbout: null, roleReplaces: role ? { record: 'N1', quote: '이 설명으로 바꿈' } : null, basis: [], claims: [], ...more });
const rel = (relationId, from, to, kind = 'flow') => ({ relationId, from, to, kind, quote: { record: 'N1', quote: '선' } });
const op = (o) => ({ successor: null, into: null, from: null, to: null, renamed: false, ...o });
const ident = (id, o, when = '2026-09-30') => ({ record: 'AF5-test@c0de', id, map: null, answer: null, part: 'B01', state: 'reflected', reason: null, areaId: o.areaId, op: op(o), when, evidence: ['E01'], at: { record: 'N1', from: 0, to: 4 } });
const reading = (n, parts, relations = [], identity = []) => ({ version: 'map-reading.20', id: `R${n}`, at: T(n), model: 'm', prompt: 'p', hash: `h${n}`, records: [], summary: '', parts, relations, candidates: [], gaps: [], skipped: [], identity });
function workshop() {
  const areas = [['grp', '처리 묶음'], ['col', '수집기'], ['srt', '정리기'], ['sto', '기록 저장소'], ['tim', '옛 타이머'], ['wat', '새 감시기'], ['dup', '정리기 사본'], ['tmp', '임시 도구']];
  const p = D.createProject();
  p.space.areas = areas.map(([id, name]) => ({ id, name, note: '', archived: false, createdAt: T(1) }));
  for (const [id] of areas) p.space.containment.revisions[id] = 0;
  Object.assign(p.space.containment.parents, { srt: 'grp', sto: 'grp', dup: 'grp' });
  p.space.relations = [['L1', 'col', 'srt'], ['L2', 'srt', 'sto'], ['L3', 'tim', 'col'], ['L4', 'wat', 'col'], ['L5', 'dup', 'sto']].map(([id, from, to]) => ({ id, from, to, kind: 'flow', note: '' }));
  p.readings = [
    reading(1, [made('grp', '처리 묶음', null), made('col', '수집기', '자료를 모은다', null, { implementation: 'unbuilt', implementationQuote: Q }), made('srt', '정리기', '모은 것을 고른다', 'grp'), made('sto', '저장소', '고른 것을 둔다', 'grp'), made('tim', '옛 타이머', '정해진 때에 수집기를 깨운다')],
      [rel('L1', 'col', 'srt'), rel('L2', 'srt', 'sto'), rel('L3', 'tim', 'col')]),
    reading(2, [made('wat', '새 감시기', '폴더를 지켜보다 수집기를 깨운다'), said('srt', '모은 것을 규칙대로 고르고 나눈다')], [rel('L4', 'wat', 'col')]),
    reading(3, [said('col', null, { implementation: 'built', implementationQuote: Q })], [], [ident('ID01', { kind: 'rename', areaId: 'sto', from: '저장소', to: '기록 저장소', renamed: true }), ident('ID02', { kind: 'retire', areaId: 'tim', successor: 'wat' }, 'c0ffee1 2026-09-29'),
      ident('ID03', { kind: 'reimplement', areaId: 'srt', from: '옛 엔진', to: '새 엔진' })]),
    reading(4, [made('dup', '정리기 사본', '모은 것을 고른다', 'grp'), made('tmp', '임시 도구', '잠깐 쓰는 도구'),
      said('sto', null, { statusClaims: [{ dimension: 'operation', value: 'running', scope: null, basis: null, successor: null, quote: Q, scopeKind: null }] })], [rel('L5', 'dup', 'sto')]),
    { version: 'map-correction.1', id: 'M1', at: '2026-10-04T12:00:00.000Z', areaId: 'col', text: '자료를 모아 하루에 한 번 넘긴다', corrects: 'R1', error: true },
    reading(5, [said('srt', null, { implementation: 'built', implementationQuote: Q })], [], [ident('ID04', { kind: 'fold', areaId: 'dup', into: 'srt' }), ident('ID05', { kind: 'retire', areaId: 'tmp' })])];
  return p;
}
const namesOf = (p, a, b) => { const A = G.pastVersion(p, a).view, B = G.versionAt(p, b).view; return id => B.parts.find(x => x.id === id)?.name ?? A.parts.find(x => x.id === id)?.name ?? '부품'; };

test('F7-1 구현 상태: only the structured implementation field of the same part — 미구현 → 구현됨 is a change, 정보 없음 → 구현됨 is information added; 구현 바뀜, a description and 가동 never are', () => {
  assert.equal(G.implementationChange('unbuilt', 'built'), 'change');
  assert.equal(G.implementationChange(null, 'built'), 'add');
  assert.equal(G.implementationChange('unknown', 'built'), 'add', '모름 is no 미구현');
  assert.equal(G.implementationChange('built', 'built'), null);
  assert.equal(G.implementationChange('built', null), null, 'nothing said later is no change');
  assert.equal(G.implementationChange('unbuilt', 'unknown'), null);
  const p = workshop();
  assert.deepEqual(G.implementationAt({ readings: p.readings.slice(0, 1) }, 'col')?.value, 'unbuilt');
  assert.equal(G.implementationAt({ readings: p.readings.slice(0, 1) }, 'srt'), null, '정보 없음');
  let cs = G.changeSet(p, 1, 3), impl = cs.changes.filter(c => c.kind === 'impl');
  assert.deepEqual(impl.map(c => [c.part, c.before, c.after, c.impl.mode]), [['col', '미구현', '구현됨', 'change']]);
  assert.ok(cs.changes.some(c => c.kind === 'reimpl' && c.part === 'srt'), '구현 바뀜 stays its own kind');
  assert.equal(impl.some(c => c.part === 'srt'), false, 'a 구현 바뀜 answer and a new description are never a 구현 상태');
  cs = G.changeSet(p, 3, 5); impl = cs.changes.filter(c => c.kind === 'impl');
  assert.deepEqual(impl.map(c => [c.part, c.before, c.after, c.impl.mode]), [['srt', null, '구현됨', 'add']]);
  assert.equal(impl.some(c => c.part === 'sto'), false, '가동 (운영 상태) is never 구현 상태');
  const c = impl[0], nm = namesOf(p, 3, 5);
  assert.equal(V.sceneKind(c), '구현 정보 추가');
  assert.equal(V.sceneSentence(c, nm), '‘정리기’에 구현 정보 ‘구현됨’이 더해졌습니다. 구현됨은 가동 중이라는 뜻이 아닙니다.');
  const ch = G.changeSet(p, 1, 3).changes.find(x => x.kind === 'impl');
  assert.equal(V.sceneKind(ch), '구현 상태 변경 · 미구현 → 구현됨');
  assert.equal(V.sceneSentence(ch, namesOf(p, 1, 3)), '‘수집기’의 구현 상태가 ‘미구현’에서 ‘구현됨’으로 기록됐습니다.');
  assert.equal(G.CHANGE_WORD.impl, '구현 상태'); assert.equal(G.CHANGE_WORD.reimpl, '구현 바뀜');
});

test('F7-2 먼저 보여주는 순서: 정정 > 승계 > 후계 없는 은퇴 > 구현 상태 > 이름 > 설명 > 중복 정리 > 새, one scene per part, a 승계\'s retirement never its own scene, never called important', () => {
  assert.deepEqual(G.SCENE_ORDER, ['correct', 'succeed', 'retire', 'impl', 'reimpl', 'rename', 'desc', 'dedupe', 'merge', 'new']);
  const p = workshop();
  let scenes = V.changeScenes(G.changeSet(p, 1, 5));
  assert.deepEqual(scenes.map(s => [s.main.kind, s.part]), [['correct', 'col'], ['succeed', 'wat'], ['impl', 'srt'], ['rename', 'sto']]);
  assert.equal(scenes.some(s => s.part === 'tim'), false, 'the retirement inside the 승계');
  assert.deepEqual(scenes.find(s => s.part === 'wat').changes.map(c => c.kind), ['succeed', 'new']);
  assert.deepEqual(scenes.find(s => s.part === 'col').changes.map(c => c.kind), ['correct', 'impl']);
  scenes = V.changeScenes(G.changeSet(p, 4, 5));
  assert.deepEqual(scenes.map(s => [s.main.kind, s.part]), [['correct', 'col'], ['retire', 'tmp'], ['impl', 'srt']], 'a retirement with no successor is its own scene');
  assert.deepEqual(scenes.find(s => s.part === 'srt').changes.map(c => c.kind), ['impl', 'dedupe']);
  const words = [...scenes.flatMap(s => s.changes.map(V.sceneKind)), V.stepWord(null, 0, 3), V.stepWord('desc', 0, 9), V.stepWord('new', 4, 23)];
  for (const w of words) assert.doesNotMatch(w, /중요|핵심|주요|우선/);
  assert.deepEqual(words.slice(-3), ['변화 장면 1/3', '설명 변경 1/9', '지도 표시 추가 5/23']);
});

test('F7-3 a scene says the change as the ledger has it: 「기록된 승계」, 「옛 타이머 → 새 감시기」, one sentence, no evaluation, cause or made-up time', () => {
  const p = workshop(), cs = G.changeSet(p, 1, 5), nm = namesOf(p, 1, 5), s = cs.changes.find(c => c.kind === 'succeed');
  assert.equal(V.sceneKind(s), '기록된 승계');
  assert.equal(V.sceneTitle(s, nm), '옛 타이머 → 새 감시기');
  assert.equal(V.sceneSentence(s, nm), '‘새 감시기’가 ‘옛 타이머’를 대신한다는 기록이 반영됐습니다.');
  const r = G.changeSet(p, 4, 5).changes.find(c => c.kind === 'retire');
  assert.equal(V.sceneSentence(r, namesOf(p, 4, 5)), '‘임시 도구’가 은퇴했다는 기록이 반영됐습니다. 대신하는 부품은 기록에 없습니다.');
  assert.equal(V.sceneSentence(cs.changes.find(c => c.kind === 'rename'), nm), '‘저장소’의 이름이 ‘기록 저장소’로 바뀌었다는 기록이 반영됐습니다.');
  assert.equal(V.sceneSentence(cs.changes.find(c => c.kind === 'new'), nm), '‘새 감시기’의 표시가 지도에 추가됐습니다.');
  for (const c of [...cs.changes, ...G.changeSet(p, 4, 5).changes]) for (const t of [V.sceneSentence(c, nm), V.sceneKind(c), V.sceneTitle(c, nm)]) for (const b of V.GUIDE_BANNED) assert.ok(!t.includes(b), `${b} in ${t}`);
  assert.ok(V.GUIDE_BANNED.includes('개발됐습니다') && V.GUIDE_BANNED.includes('안정적') && V.GUIDE_BANNED.includes('이를 위해') && V.GUIDE_BANNED.includes('핵심'));
});

test('F7-4 the guide: 「지도 변화 · v01 → v03」 and the counts by kind made only of the change ledger, every count traced back, every fact a way in (v12: no scene\'s sentence)', () => {
  const p = workshop(), cs = G.changeSet(p, 1, 3), scenes = V.changeScenes(cs), nm = namesOf(p, 1, 3), g = V.guideOf(cs, scenes, nm);
  assert.equal(g.head, '지도 변화 · v01 → v03');
  // v12 (first user of v11, 2): the summary says the counts by kind, never a single scene's sentence first (growth-v12 V12-2).
  assert.equal(V.guideText(g), 'v01과 v03 사이에 승계 1건, 구현 상태 기록이 달라진 부품 1개, 구현이 바뀐 부품 1개, 이름이 달라진 부품 1개, 설명이 바뀐 부품 1개와 v01에 없던 부품 표시 1개가 있습니다.');
  assert.ok(g.sentences.length <= 2);
  const facts = g.sentences.flat().filter(x => x.fact);
  for (const x of facts) {
    assert.ok(x.to, `a fact is a way in: ${x.text}`);
    if (x.fact.count !== null) { assert.equal(x.fact.count, V.kindCount(cs, x.fact.kind), x.text); assert.ok(x.text.includes(String(x.fact.count))); }
    for (const id of x.fact.parts) { assert.ok(cs.changes.some(c => c.part === id || c.predecessor === id), id); assert.ok(x.text.includes(`‘${nm(id)}’`), nm(id)); }
  }
  assert.equal(facts.filter(x => x.fact.parts.length).length, 0, 'no named change: the counts only');
  assert.ok(facts.every(x => 'kind' in x.to), 'each count leads to its kind');
  for (const b of V.GUIDE_BANNED) assert.ok(!V.guideText(g).includes(b));
  assert.doesNotMatch(V.guideText(g), /대기|보류|후보|거절|중요|개발/, 'a held row or candidate is never a change; 새 is no new development');
  // More of the first kind: its total leads the second sentence; nothing changed: one plain sentence.
  const two = { ...cs, changes: [...cs.changes, { ...cs.changes.find(c => c.kind === 'succeed'), part: 'x2', predecessor: 'tim' }], counts: { ...cs.counts, succeed: 2 } };
  assert.match(V.guideText(V.guideOf(two, V.changeScenes(two), nm)), / 승계 2건, /);
  const none = { ...cs, changes: [], counts: Object.fromEntries(Object.keys(cs.counts).map(k => [k, 0])), added: [], removed: [] };
  assert.equal(V.guideText(V.guideOf(none, [], nm)), '두 지도 버전 사이에 반영된 구조 변화가 없습니다.');
});

test('F7-5 기록 반영 상태 on the anonymised growth map: 대기·보류 N equals its list\'s rows, 거절 apart, records not read yet apart, each row in one group', () => {
  const p = fixtureProject(growthFixture('track-a')), n = G.mapVersions(p).length, rows = G.unreflectedAt(p, n);
  const open = rows.filter(x => x.state === 'waiting' || x.state === 'held'), rej = rows.filter(x => x.state === 'rejected');
  assert.equal(open.length + rej.length, rows.length);
  const name = id => G.versionAt(p, n).view.parts.find(x => x.id === id)?.name ?? '부품';
  for (const set of [open, rej]) {
    const groups = G.reflectGroups(set, name), listed = groups.flatMap(g => g.rows);
    assert.equal(listed.length, set.length, 'the count is the list\'s rows');
    assert.equal(new Set(listed).size, set.length, 'each row in exactly one group');
    for (const g of groups) {
      assert.equal(g.byItem.reduce((a, x) => a + x.n, 0), g.rows.length);
      const t = V.groupTitle(g, name);
      if (g.kind === 'part') { assert.equal(t.title, `${name(g.part)}에 관한 미반영 기록 ${g.rows.length}행`); assert.ok(t.onMap); assert.ok(G.versionAt(p, n).view.parts.some(x => x.id === g.part), 'on the map by its ID'); }
      else assert.equal(t.onMap, false, '「이 부품은 현재 지도에 있습니다」 only for a part checked by its ID');
      assert.equal(t.sub, g.byItem.map(x => `${x.item} ${x.n}행`).join(' · ') + (g.kind === 'unplaced' ? ' · 이 부품은 아직 지도에 놓이지 않았습니다' : ''));
    }
  }
  assert.equal(V.waitingWord(open.length), `대기·보류 ${open.length}행`);
  const unread = G.unreadRecords(p), unreadIds = new Set(unread.map(x => x.paste));
  assert.ok(unread.length > 0);
  assert.equal(rows.some(x => unreadIds.has(x.paste)), false, 'a record not read yet is never 대기');
  // 「아직 지도에 놓이지 않음」 only for a part row whose part is not on the map.
  for (const x of rows) if (x.unplaced) { assert.equal(x.table, 'C-PART'); assert.equal(x.principal, null); }
});

test('F7-6 names and code as the growth view says them: a secondary identifier left for the detail, particles after the word, code runs kept whole and marked', () => {
  assert.equal(V.plainName('소비 폴더 감시기(document_consumer)'), '소비 폴더 감시기');
  assert.equal(V.auxName('소비 폴더 감시기(document_consumer)'), 'document_consumer');
  assert.equal(V.plainName('OCR 도구(pyocr 첫 도구)'), 'OCR 도구(pyocr 첫 도구)', 'a bracket in the person\'s words stays');
  assert.equal(V.plainName('Raster 래스터 파서'), 'Raster 래스터 파서');
  assert.equal(V.plainName('소비 폴더(CONSUMPTION_DIR)', ['소비 폴더(CONSUMPTION_DIR)', '소비 폴더(SCRATCH_DIR)']), '소비 폴더(CONSUMPTION_DIR)', 'the only thing that tells two apart stays');
  assert.equal(V.josa('cronjob', '을/를'), '을'); assert.equal(V.josa('소비 폴더 감시기', '이/가'), '가'); assert.equal(V.josa('운영자(설치·관리)', '이/가'), '가');
  assert.equal(V.josa('구현됨', '으로/로'), '으로'); assert.equal(V.josa('기록 저장소', '으로/로'), '로'); assert.equal(V.josa('23개', '이/가'), '가'); assert.equal(V.josa('1개', '과/와'), '와');
  const t = 'PRE_CONSUME_SCRIPT가 있으면 validateStatus(status)를 부르고 iter_num % 100 == 0일 때 Broker에 README.md를 남긴다';
  const pieces = V.codePieces(t);
  assert.equal(pieces.map(x => x.text).join(''), t, 'every character kept, in order');
  assert.deepEqual(pieces.filter(x => x.code).map(x => x.text), ['PRE_CONSUME_SCRIPT', 'validateStatus(status)', 'iter_num', 'README.md']);
  for (const w of ['Broker', 'OCR', 'Consumer', 'v04', 'WebSocket', 'DataStore']) assert.equal(V.isCode(w), false, w);
  for (const w of ['document_consumer', 'src/documents/parsers.py', 'getStatus', 'manage.py']) assert.equal(V.isCode(w), true, w);
});

test('F7-7 a part the person made shows, in an earlier version, the name and note it had then (a later logged edit reads as its before-value)', () => {
  const p = workshop();
  p.space.areas.push({ id: 'own', name: '고친 이름', note: '고친 메모', archived: false, createdAt: '2026-10-02T12:00:00.000Z' }); p.space.containment.revisions.own = 0;
  p.edits = { since: '2026-10-06T00:00:00.000Z', entries: [
    { seq: 1, kind: 'name', target: 'own', at: '2026-10-06T00:00:00.000Z', before: '처음 이름', after: '고친 이름' },
    { seq: 2, kind: 'note', target: 'own', at: '2026-10-06T00:00:00.000Z', before: '처음 메모', after: '고친 메모' }] };
  const x = G.pastVersion(p, 3).view.parts.find(y => y.id === 'own');
  assert.deepEqual([x.name, x.note], ['처음 이름', '처음 메모']);
  assert.equal(G.pastVersion(p, 1).view.parts.some(y => y.id === 'own'), false, 'made after version 1');
  // Logged before the version: the later value there.
  const early = structuredClone(p); for (const e of early.edits.entries) e.at = '2026-10-02T13:00:00.000Z'; early.edits.since = '2026-10-02T13:00:00.000Z';
  const y = G.pastVersion(early, 3).view.parts.find(z => z.id === 'own');
  assert.deepEqual([y.name, y.note], ['고친 이름', '고친 메모']);
});
