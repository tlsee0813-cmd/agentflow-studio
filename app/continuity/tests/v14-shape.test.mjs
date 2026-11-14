// v14 B (spec items 3 and 5): the map's shape fits the project, read from the record's facts only (what a card is to a reader, the build
// and release lane in every form, people at the flow's start, a recorded group of user roles together, the main flow chosen among the
// record's own candidates by what their cards are, the record's coverage said plainly), and the app's control words for everyone at 쉽게.
// Each test fails on v13 (no map-shape, no lane outside 흐름, no plain control words). Fictional strings only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as S from '../dist/public/client/map-shape.js';
import * as F from '../dist/public/client/map-forms.js';
import * as FF from '../dist/public/client/first-flow.js';
import * as P from '../dist/public/client/plain-words.js';
import * as W from '../dist/public/client/word-level.js';
import { layoutScope, ROOT } from '../dist/public/client/map-layout.js';
import { laneOfScope } from '../dist/public/client/map-regions.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const css = () => readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)));
const fc = (id, family = 'process', type = null, extra = {}) => ({ id, name: id, w: 224, h: 80, anchor: 40, family, type, ...extra });

test('V14B-1 what a card is to a reader comes from its type word, family, recorded role word and own name only', () => {
  const k = (name, type, family, familyRole = null) => S.shapeKind({ name, type, family, familyRole });
  assert.equal(k('메인테이너(누리)', 'person', 'participant'), 'crew');
  assert.equal(k('외부 기여자', null, 'participant', 'PR 작성'), 'crew', 'a contributor is never an outside system for its 외부');
  assert.equal(k('의존성 봇', null, 'participant', '의존성 갱신 봇'), 'crew');
  assert.equal(k('하늘', 'person', 'participant', '소유자·병합자'), 'crew', 'the recorded role word decides a name that says nothing');
  assert.equal(k('검사 실행기', null, 'participant', 'CI·릴리스 실행'), 'crew');
  assert.equal(k('별빛 날씨 API(외부)', null, 'participant', '자료 제공'), 'outside');
  assert.equal(k('배포처', 'external', 'participant', '외부 배포 대상'), 'outside');
  assert.equal(k('사용자 코드', null, 'participant', '호출자'), 'outside', 'someone else\'s code is no person');
  assert.equal(k('손님 클라이언트', null, 'participant', '미인증 요청자'), 'user');
  assert.equal(k('인증 레코드 사용자', null, 'participant', '인증된 요청자'), 'user', 'a 레코드 is no 코드');
  assert.equal(k('앱 관리자', 'person', 'participant', 'admin 사용자'), 'user');
  assert.equal(k('명령 해석기', null, 'participant', '해석기'), 'outside', 'a participant that names no person stands outside');
  assert.equal(k('릴리스 준비 작업', null, 'process'), 'part', 'a program part is never re-kinded');
  assert.equal(S.kindMark({ name: '의존성 봇', type: null, family: 'participant', familyRole: '의존성 갱신 봇' }), '자동 봇');
  assert.equal(S.kindMark({ name: '메인테이너', type: 'person', family: 'participant' }), '사람');
  assert.equal(S.kindMark({ name: '사용자 코드', type: null, family: 'participant' }), '외부 코드');
  assert.equal(S.kindMark({ name: '원격 서버', type: 'external', family: 'participant' }), '외부 시스템');
  assert.equal(S.kindMark({ name: '분배기', type: null, family: 'process' }), null);
  assert.deepEqual(S.KIND_LEGEND.map(x => x.word), ['사람', '외부 시스템', '프로그램 부분']);
});

test('V14B-2 the build and release lane: build names, every maintainer, contributor and bot, and what only they meet', () => {
  const cards = [
    { id: 'u', name: '쓰는 사람', type: 'person', family: 'participant' }, { id: 'core', name: '요청 처리기', type: null, family: 'process' },
    { id: 'm', name: '메인테이너', type: 'person', family: 'participant' }, { id: 'c', name: '기여자', type: 'person', family: 'participant' },
    { id: 'pub', name: '게시 작업', type: null, family: 'process' }, { id: 'reg', name: '꾸러미 저장소', type: 'external', family: 'participant' },
    { id: 'reg2', name: '내려받기 저장소', type: 'external', family: 'participant' }, { id: 'lonely', name: '번역자', type: 'person', family: 'participant' },
  ];
  const lines = [{ from: 'u', to: 'core' }, { from: 'c', to: 'm' }, { from: 'm', to: 'pub' }, { from: 'pub', to: 'reg' }, { from: 'pub', to: 'reg2' }, { from: 'reg2', to: 'u' }];
  const lane = S.laneIds(cards, lines);
  assert.deepEqual([...lane].sort(), ['c', 'lonely', 'm', 'pub', 'reg'], 'a registry the program\'s user also reads stays with the program');
});

test('V14B-3 흐름: the lane holds its cards even without a relation; a person who uses the product stands at the row\'s start', () => {
  const cards = ['a', 'b', 'c', 'd'].map(x => fc(x)).concat([fc('user', 'participant', 'person', { kind: 'user' }), fc('maint', 'participant', 'person', { kind: 'crew', lane: true }), fc('ext', 'participant', 'external', { kind: 'outside' })]);
  const lines = [{ from: 'a', to: 'b', directed: true }, { from: 'b', to: 'c', directed: true }, { from: 'c', to: 'd', directed: true }, { from: 'user', to: 'd', directed: true }, { from: 'd', to: 'ext', directed: true }];
  const p = F.flowPlace(cards, lines, { steps: [['a'], ['b'], ['c'], ['d']], rule: 'summary', source: '기록이 설명한 흐름', text: 'a → b → c → d' });
  const build = p.lanes.find(l => l.kind === 'build');
  assert.ok(build && build.ids.includes('maint'), 'the maintainer with no relation is in the lane');
  assert.ok(!p.lone.includes('maint'));
  assert.ok(p.at.get('user').x < p.at.get('a').x, 'the user meets the last step yet stands before the first');
  assert.ok(p.at.get('ext').x > p.at.get('d').x, 'an outside system stands at the end it meets');
  const rowBottom = Math.max(...['a', 'b', 'c', 'd', 'user', 'ext'].map(id => p.at.get(id).y + 80));
  assert.ok(p.at.get('maint').y > rowBottom, 'the lane is under everything');
});

test('V14B-4 층: the lane is its own caption under the bands, outside things in 외부, a recorded group of roles side by side', () => {
  const cards = [fc('p1'), fc('p2'), fc('s1', 'store', 'store'), fc('t1', 'trigger', 'timer'),
    fc('admin', 'participant', 'person', { kind: 'user', group: '역할 묶음' }), fc('guest', 'participant', 'person', { kind: 'user' }), fc('viewer', 'participant', null, { kind: 'user', group: '역할 묶음' }),
    fc('lib', 'participant', null, { kind: 'outside' }), fc('ci', 'process', null, { lane: true }), fc('m', 'participant', 'person', { kind: 'crew', lane: true })];
  const lines = [{ from: 'admin', to: 'p1', directed: true }, { from: 'guest', to: 'p2', directed: true }, { from: 'viewer', to: 'p2', directed: true }, { from: 'p1', to: 's1', directed: true }, { from: 'p2', to: 'lib', directed: true }, { from: 'm', to: 'ci', directed: true }, { from: 't1', to: 'p1', directed: true }];
  const p = F.layersPlace(cards, lines);
  const band = b => p.lanes.find(l => l.kind === 'band' && l.band === b);
  assert.deepEqual(band('participant').ids.slice().sort(), ['admin', 'guest', 'viewer']);
  assert.ok(band('external').ids.includes('lib'));
  assert.ok(!p.lanes.some(l => l.kind === 'band' && (l.ids.includes('m') || l.ids.includes('ci'))), 'no maintainer or CI in a family\'s band');
  const build = p.lanes.find(l => l.kind === 'build');
  assert.deepEqual(build.ids, ['m', 'ci'], 'in the order its own relations run');
  assert.equal(build.text, '만들고 배포하는 길');
  const lastBand = Math.max(...p.lanes.filter(l => l.kind === 'band').map(l => l.rect.y + l.rect.h));
  assert.ok(build.rect.y > lastBand, 'under the bands');
  const ids = band('participant').ids, ai = ids.indexOf('admin'), vi = ids.indexOf('viewer');
  assert.equal(Math.abs(ai - vi), 1, 'the recorded group stands together');
  const g = p.lanes.find(l => l.kind === 'group');
  assert.deepEqual(g && g.ids.slice().sort(), ['admin', 'viewer']);
  assert.equal(g.text, '역할 묶음');
});

test('V14B-5 the record\'s choice: the lane is no part of the program it counts; one 첫 구조 줄 line\'s order is offered, never chosen', () => {
  const twelve = [...'abcdefghijkl'].map((x, i) => fc(x, ['participant', 'process', 'store'][i % 3]));
  const head = { steps: [['a'], ['b'], ['c'], ['d']], rule: 'head', source: '기록의 첫 구조', text: 'a → b → c → d' };
  const c = F.formChoice(twelve, head);
  assert.ok(c.offered.includes('flow'));
  assert.notEqual(c.auto, 'flow');
  assert.match(c.why, /첫 구조 줄 하나가 말한 순서 4단계는 흐름에서 볼 수 있어요/);
  assert.equal(F.formChoice(twelve, { ...head, rule: 'summary' }).auto, 'flow');
  const withLane = twelve.concat([...'mnopqrst'].map(x => fc(x, 'process', null, { lane: true })));
  assert.match(F.formChoice(withLane, { ...head, rule: 'summary' }).why, /부품 12개 중 4개/, 'the lane\'s cards are not counted');
});

test('V14B-6 the main flow: a build or plumbing candidate gives way to a runtime one, a runtime one to one from a person who uses the product', () => {
  const f = { lane: new Set(['rel']), log: id => id === 'log', start: id => id === 'cli' };
  assert.equal(S.pathRank([['rel'], ['x']], f), 0);
  assert.equal(S.pathRank([['srv'], ['ws', 'log']], f), 1);
  assert.equal(S.pathRank([['srv'], ['ws']], f), 2);
  assert.equal(S.pathRank([['cli'], ['core']], f), 3);
  const r = x => x.r;
  assert.deepEqual(S.preferRuntime([[{ r: 1 }], [{ r: 2 }, { r: 3 }]], r), [1, 1], 'plumbing first: the highest later one');
  // v14 fix 1 (verify of v14: shapez kept its save path lit over the record's start at the person who plays): a path from a user goes first.
  assert.deepEqual(S.preferRuntime([[{ r: 2 }], [{ r: 3 }]], r), [1, 0], 'a path from a person who uses the product goes ahead of a runtime path');
  assert.deepEqual(S.preferRuntime([[{ r: 2 }], [{ r: 2 }]], r), [0, 0], 'among runtime paths the record\'s order of rules stands');
  assert.deepEqual(S.preferRuntime([[{ r: 0 }], [{ r: 0 }]], r), [0, 0]);
  // On the first view's own candidates: the plumbing 첫 구조 줄 gives way to the recorded start a person hands to.
  const parts = ['서버', '소켓', '기록 파일', '명령줄', '조사기'].map(n => ({ id: n, name: n, status: 'none', childIds: [], parentId: null }));
  parts[3].entryRows = [{ kind: 'command', name: '명령줄', order: 1 }];
  const lines = [{ id: 'l1', from: '서버', to: '소켓', channel: 'data' }, { id: 'l2', from: '서버', to: '기록 파일', channel: 'data' }, { id: 'l3', from: '명령줄', to: '조사기', channel: 'data' }];
  const inp = { parts, lines, headLines: ['서버 → 소켓 · 기록 파일'] };
  assert.equal(FF.firstFlow(inp).rule, 'head', 'without a rank the rules\' order alone');
  const ranked = FF.firstFlow({ ...inp, rank: c => S.pathRank(c.steps, { lane: new Set(), log: id => /기록 파일/.test(id), start: id => id === '명령줄' }) });
  assert.equal(ranked.rule, 'entry');
  assert.equal(ranked.flow.parts[0], '명령줄');
  const chain = F.recordedChain([{ rule: 'head', source: '기록의 첫 구조', text: 'a → b → c', steps: [['a'], ['b'], ['c']], drawnLines: 2 }, { rule: 'head', source: '기록의 첫 구조', text: 'p → q', steps: [['p'], ['q']], drawnLines: 1 }], x => x, '기록이 설명한 흐름', c => (c.steps[0][0] === 'a' ? 0 : 2));
  assert.deepEqual(chain.steps, [['p'], ['q']], 'an order through the lane is read only when no runtime order is');
});

test('V14B-7 a recorded group of user roles and the record\'s coverage, in the record\'s own words', () => {
  const rec = ['| GR01 | 화면 묶음 | B01·B02 | 실행 위치 | F01 |', '| GR02 | 내장 인증 사람 역할 | B05·B06·B07 | 참여자 | F02 |', '| GR03 | 저장소 사람 | B01·B02 | 참여자 | E04 |'].join('\n');
  assert.deepEqual(S.roleGroups(rec), [{ name: '내장 인증 사람 역할', members: ['B05', 'B06', 'B07'] }]);
  const head = ['| 읽은 범위 | src/의 수집 경로(tracker, send), 저장 분배(db), 인증(auth), docs/ 일부, git 이력 | F01 |', '| 못 읽은 범위 | ui/ 전부; 시험 실행 안 함 | E01 |'].join('\n');
  const cov = S.coverageOf([head]);
  assert.equal(cov.shown, '기록이 다룬 범위: 수집 경로, 저장 분배, 인증 외 · 못 읽은 곳 있음');
  assert.match(cov.unread, /ui\/ 전부/);
  assert.equal(S.coverageOf(['| 읽은 범위 | src/ 대부분, build.rs | F01 |\n| 못 읽은 범위 | tests/ | E01 |']).shown, '기록이 다룬 범위: 프로젝트 일부 · 못 읽은 곳 있음', 'no plain unit: no code words shown');
  assert.equal(S.coverageOf(['| 읽은 범위 | 전부 | F01 |\n| 못 읽은 범위 | 없음 | E01 |']), null, 'a record that left nothing out is not called partial');
});

test('V14B-8 the compose map (구성): the whole map\'s lane in rows under the program, in the order its relations run', () => {
  const part = (id, name, type, family, role = null) => ({ id, name, note: '', parentId: null, depth: 0, childIds: [], status: 'none', lastAt: null, recordIds: [], summary: null, changes: [], origin: null, proposal: null,
    reading: { typeRead: type ? { type } : null, familyRead: family ? { family, role, reason: null, unclear: false, quote: null, at: '' } : null, steps: [], loop: null } });
  const parts = [part('u', '쓰는 사람', 'person', 'participant'), part('a', '받기', null, 'process'), part('b', '처리', null, 'process'), part('s', '저장소', 'store', 'store'),
    part('m', '메인테이너', 'person', 'participant'), part('ci', '검사 워크플로', null, 'process'), part('pub', '게시 작업', null, 'process')];
  const rel = (id, from, to) => ({ id, from, to, kind: 'flow', note: '' });
  const v = { parts, roots: parts.map(p => p.id), records: [], relations: [rel('r1', 'u', 'a'), rel('r2', 'a', 'b'), rel('r3', 'b', 's'), rel('r4', 'm', 'pub'), rel('r5', 'ci', 'pub'), rel('r6', 'pub', 'a')] };
  assert.deepEqual(laneOfScope(v, v.roots), ['m', 'ci', 'pub']);
  const L = layoutScope(v, null, () => false, {});
  assert.deepEqual(L.lane, ['m', 'ci', 'pub']);
  const prog = ['u', 'a', 'b', 's'].map(id => L.boxes.get(id)), laneB = L.lane.map(id => L.boxes.get(id));
  assert.ok(Math.min(...laneB.map(b => b.y)) > Math.max(...prog.map(b => b.y + b.h)), 'under the program');
  const inside = layoutScope(v, 'a', () => false, {});
  assert.deepEqual(inside.lane ?? [], [], 'a part\'s inside has no lane');
  void ROOT;
});

test('V14B-9 the page: each card says what it is by shape and mark, the lane and the coverage are drawn in every form', async () => {
  const a = await app(), c = await css();
  assert.match(a, /return shapeCard\(o, p, el\) \/\* v14 B hook 6 \*\//);
  // v14 fix 1: the shape from map-shape cardShape (a release bot that is no person is dashed, V14F1-11).
  assert.match(fn(a, 'shapeCard'), /pk-\$\{cardShapeOf\(o, p\.id, k\)\}/);
  assert.match(c, /\.node\.card\.pk-person \{ border-radius: 24px; \}/);
  assert.match(c, /\.node\.card\.pk-outside \{ border-style: dashed;/);
  assert.match(fn(a, 'shownLanes'), /lay\.lane/, '구성 draws its lane too');
  assert.match(a, /shapeTopLine\(o, row\) \/\* v14 B hook 5 \*\//);
  assert.match(a, /kind: sh\.kinds\.get\(b\.id\) \?\? 'part', lane: sh\.lane\.has\(b\.id\), group: sh\.groups\.get\(b\.id\) \?\? null/);
  assert.match(a, /rank: scope === null \? \(rk =>/);
});

test('V14B-10 words for everyone: 쉽게 names the controls plainly, 자세히 keeps the earlier words, every tip names both', async () => {
  P.setPlainLevel('easy');
  assert.equal(P.easyWordOf('돌아와 읽기'), '그동안 바뀐 것');
  assert.equal(P.easyWordOf('변경 구상'), '바꿀 계획');
  assert.equal(P.easyWordOf('인수인계'), '다음 AI에게 넘길 글');
  assert.equal(P.easyWordOf('먼저 볼 연결'), '주 흐름');
  assert.equal(P.easyWordOf('근거 문장'), '이 요약의 근거');
  assert.deepEqual(P.EASY_FORM_WORD, { flow: '흐름 순서로', layers: '종류별로', compose: '연결 구조로' });
  assert.equal(P.EASY_FORM_SWITCH, '보기 방식');
  assert.equal(P.plainLead('먼저 볼 연결: 가 → 나', '먼저 볼 연결'), '주 흐름: 가 → 나');
  assert.equal(P.detailNote('변경 구상'), '자세히 보기의 이름: 변경 구상');
  P.setPlainLevel('detail');
  assert.equal(P.easyWordOf('돌아와 읽기'), '돌아와 읽기');
  assert.equal(P.detailNote('변경 구상'), '');
  P.setPlainLevel('easy');
  assert.equal(W.easyBand('참여'), '사람');
  assert.equal(W.easyBand('외부'), '외부 시스템');
  const a = await app();
  assert.match(fn(a, 'formSwitchEl'), /easy\(\) \? EASY_FORM_WORD\[f\] : MAP_FORM_WORD\[f\]/);
  assert.match(fn(a, 'formSwitchEl'), /자세히 보기의 이름: \$\{MAP_FORM_WORD\[f\]\}/);
  assert.match(fn(a, 'syncWords'), /setPlainLevel\(words\); plainHeader\(\);/);
  assert.match(fn(a, 'plainTop'), /\.ft-only, \.ft-all, \.ft-back/);
  const c = await css();
  assert.match(c, /\.app \{ grid-template-rows: auto 1fr; \}/, 'the bar wraps instead of laying a control over another');
  assert.match(c, /@media \(max-width: 1420px\) \{/);
});

test('V14B-11 흐름: a recorded group of user roles takes a column of its own, its caption room kept over the lane', () => {
  const cards = ['a', 'b', 'c', 'd'].map(x => fc(x)).concat(
    ['r1', 'r2', 'r3'].map(x => fc(x, 'participant', 'person', { kind: 'user', group: '사람 역할' })),
    ['o1', 'o2'].map(x => fc(x, 'participant', null, { kind: 'outside' })), [fc('m', 'participant', 'person', { kind: 'crew', lane: true })]);
  const lines = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['r1', 'a'], ['r2', 'a'], ['r3', 'a'], ['o1', 'a'], ['o2', 'a'], ['m', 'm2']].map(([from, to]) => ({ from, to, directed: true }));
  const p = F.flowPlace(cards, lines, { steps: [['a'], ['b'], ['c'], ['d']], rule: 'summary', source: '기록이 설명한 흐름', text: 'a → b → c → d' });
  const xs = new Set(['r1', 'r2', 'r3'].map(id => p.at.get(id).x));
  assert.equal(xs.size, 1, 'one column');
  for (const o of ['o1', 'o2']) assert.ok(!xs.has(p.at.get(o).x), 'no other card in the group\'s column');
  const g = p.lanes.find(l => l.kind === 'group');
  assert.deepEqual(g.ids.slice().sort(), ['r1', 'r2', 'r3']);
  const build = p.lanes.find(l => l.kind === 'build'), bottom = Math.max(...['r1', 'r2', 'r3', 'a', 'o1', 'o2'].map(id => p.at.get(id).y + 80));
  assert.ok(build.rect.y - bottom >= F.FLOW_LANE_GAP + F.FLOW_GROUP_ROOM - 1, 'the group\'s caption has room over the lane');
});

test('V14B-12 the page: the coverage line gives way before the sentence and leaves its cue; panes are named as their controls; band words stay in their room', async () => {
  const a = await app(), c = await css();
  assert.match(fn(a, 'placeFocusTop'), /if \(shapeYield\(el, \(\) => \{ ftPlace\(el, camera, ink\); return covers\(\); \}\)\) return; \/\/ v14 B hook 11/);
  assert.match(fn(a, 'placeFocusTop'), /el\.classList\.remove\('ft-nocover'\); \/\/ v14 B hook 11/);
  assert.match(fn(a, 'shapeTopLine'), /class: 'ft-cover-cue', title: said \}, COVERAGE_WORD/);
  assert.match(c, /\.focus-top\.ft-nocover \.ft-cover-cue \{ display: inline; \}/);
  assert.match(c, /\.form-lane\.band \.form-lane-word \{ max-width: calc\(122px \/ var\(--linv, var\(--inv, 1\)\)\); \}/);
  const rv = await readFile(new URL('../src/client/return-view.ts', import.meta.url), 'utf8');
  const hv = await readFile(new URL('../src/client/handover-view.ts', import.meta.url), 'utf8');
  const pv = await readFile(new URL('../src/client/plan-view.ts', import.meta.url), 'utf8');
  assert.match(rv, /h\('h2', \{ id: 'lens-title', title: detailNote\('돌아와 읽기'\) \|\| false \}, easyWordOf\('돌아와 읽기'\)/);
  assert.match(hv, /h\('h2', \{ id: 'handover-title', title: detailNote\('인수인계 문서'\) \|\| false \}, easyWordOf\('인수인계 문서'\)\)/);
  assert.equal((pv.match(/easyWordOf\('변경 구상'\)/g) ?? []).length, 4);
});
