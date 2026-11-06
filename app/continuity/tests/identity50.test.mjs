// Recipe .50 step 3 (Astra F5 Q1, Q7(3)): a part's identity apart from its claims' versions. The later prompts say that the map is this
// project's earlier understanding and that a commit or 판본 difference scopes claims, never identity; a later map.7 ask sends each part's
// role without its 「기준 X에서」 stamp and says what earlier readings found of it as fields of its own (part-facts.1: state, lastBasis,
// files). Model-free: hand-written replies and, when the growth run's artefacts are on this machine (AF_GROWTH_DIR), its stored states.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as T from '../dist/public/shared/record-table.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import * as P from '../server/map-prompt.mjs';
import * as B from '../server/map-blueprint.mjs';
import { LATER_MERGE_RULES, MERGE_RULES, RENDER_RULES } from '../server/map-pipeline.mjs';
import { CASES, haveGrowth, rebuilt, utf8, metaBytes } from './identity50-replay.mjs';

const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
const HEAD = '〔기록 AF5-50d3d3d3 · 쪽 1 · 기준 8f5809d1 · 앞 쪽 —〕 정체 시험 기록 v5 (재구성 세션 · 기준 시점 2020-11-18 23:02 +01:00 · 2026-11-06 작성)';
const PAGE = [HEAD, table('C-SRC', [['F01', 'src/documents/consumer.py', 'B01', '읽음', '코드'], ['F02', 'src/documents/tasks.py', 'B01', '읽음', '코드']]),
  table('C-EVID', [['E01', '파일', 'F01', 'main()', '연다']]), table('C-HEAD', T.HEAD_ITEMS.map((item, k) => [item, `값 ${k + 1}`, 'E01'])),
  table('C-PART', [['B01', '소비 파이프라인(Consumer)', '처리 · 실행 조정', '소비 작업을 검사·파싱·저장한다', 'F01+F02', '구현됨', 'F01'],
    ['B02', '주기 일정', '촉발 · 주기 일정', '정해진 때 작업을 낸다', 'F02', '미구현', 'F02']]),
  table('C-END', [['C-HEAD', '끝남', '—', '—', '—'], ['C-PART', '끝남', 'B01–B02', '—', '—']])].join('\n');
const meta = h => ({ id: `R_${crypto.randomUUID()}`, at: '2026-11-06T03:00:00.000Z', model: 'stub', prompt: 'm7-000000000050', hash: h.repeat(64) });
const ask7 = p => M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA);

/** A project whose reading wrote stamped roles (as the growth run's renderers did), a C-HEAD row as one role's about and four files for
 * one part, then a note pasted so that a next reading has something to read. */
function grown() {
  let p = D.addArea({ ...D.createProject(), name: '정체 시험' }, '사람 부분', '사람이 만든 부분');
  p = parseProject(JSON.stringify(D.pasteRecord(p, PAGE, null).project));
  const inp = ask7(p), ask = inp.ask;
  const at = words => { for (const r of ask.records) { const s = r.spans.find(x => x.t.includes(words)); if (s) return s.s; } throw new Error(words); };
  const wire = { summary: '', relations: [], candidates: [], gaps: [], matches: [], material: [], parts: [
    { ref: 'new:consumer', name: '소비 파이프라인(Consumer)', parent: null, role: '기준 8f5809d에서 소비 작업을 검사·파싱·저장한다.', roleAboutAt: at('|작성 시각|'), roleReplaces: null,
      basis: [at('|B01|')], claims: [], files: ['consumer.py', 'src/documents/consumer.py', 'src/documents/tasks.py', 'docker/'] },
    { ref: 'new:schedule', name: '주기 일정', parent: null, role: '기준 8f5809d의 일정이 정해진 때 작업을 낸다.', roleAboutAt: null, roleReplaces: null, basis: [at('|B02|')], claims: [] }] };
  const applied = M.applyReading(p, inp, M.validateMapReply(structuredClone(wire), ask), meta('a'));
  return parseProject(JSON.stringify(D.pasteRecord(applied.project, '다음 메모: 소비 파이프라인은 그대로다.', null).project));
}
const byName = (ask, name) => ask.parts.find(x => x.name === name);

test('I50-1 a role\'s basis stamp and a record head\'s basis', () => {
  for (const [role, out, sha] of [['기준 8f5809d에서 분류 모델을 보관한다.', '분류 모델을 보관한다.', '8f5809d'], ['기준 86d9c94의 actions 시험 작업은 돈다.', 'actions 시험 작업은 돈다.', '86d9c94'],
    ['기준 86d9c94에서는 큐 작업을 받는다.', '큐 작업을 받는다.', '86d9c94'], ['기준 8F5809D1에서 일정을 낸다.', '일정을 낸다.', '8f5809d'],
    ['855ee64의 docstring은 tif를 읽는다.', '855ee64의 docstring은 tif를 읽는다.', null], ['기준 시점 2020-11-18에서 돈다.', '기준 시점 2020-11-18에서 돈다.', null],
    ['소비 작업을 받아 저장한다.', '소비 작업을 받아 저장한다.', null], ['기준 8f5809d에서 ', '기준 8f5809d에서 ', null]])
    assert.deepEqual(M.unstampRole(role), { role: out, sha }, role);
  assert.equal(M.recordBasis(`${HEAD}\n…`), '8f5809d · 2020-11-18');
  assert.equal(M.recordBasis('〔기록 AF5-01526c39 · 쪽 2 · 기준 86d9c94 · 앞 쪽 1〕 paperless 기록 v5'), '86d9c94');
  assert.equal(M.recordBasis('〔기록 AF4-7c19e2a0 · 덩이 1 · 기준 4e1d9b2〕 이름 기록 v4 (기준 시점 2024-01-02)'), '4e1d9b2 · 2024-01-02');
  assert.equal(M.recordBasis('〔기록 AF4-7c19e2a0 · 덩이 1 · 기준 main〕 이름 기록 v4'), 'main');
  assert.equal(M.recordBasis('그냥 메모'), null);
});

test('I50-2 a later map.7 ask: roles without the stamp, a table-row about left out, state, lastBasis and files of each part; stored data and map.6 unchanged', () => {
  const p = grown(), inp = ask7(p), ask = inp.ask;
  assert.equal(inp.problem, null); assert.equal(ask.schemaVersion, M.MAP7_SCHEMA);
  const consumer = byName(ask, '소비 파이프라인(Consumer)'), schedule = byName(ask, '주기 일정'), person = byName(ask, '사람 부분');
  assert.deepEqual(Object.keys(consumer), ['id', 'name', 'note', 'parentId', 'readAs', 'role', 'roleBy', 'roleAbout', 'state', 'lastBasis', 'files', 'current']);
  assert.deepEqual([consumer.role, consumer.roleAbout, consumer.lastBasis], ['소비 작업을 검사·파싱·저장한다.', null, '8f5809d · 2020-11-18']);
  assert.deepEqual(consumer.files, ['src/documents/consumer.py', 'src/documents/tasks.py', 'docker/'], 'the bare name of a listed path goes once, as the path; three at most');
  assert.deepEqual([schedule.role, schedule.state, schedule.lastBasis, schedule.files], ['일정이 정해진 때 작업을 낸다.', 'unbuilt', '8f5809d · 2020-11-18', []]);
  assert.deepEqual([person.role, person.roleBy, person.state, person.lastBasis, person.files], ['', null, null, null, []]);
  assert.deepEqual(M.validateMapAsk(JSON.parse(JSON.stringify(ask)), { route: 'divided' }), ask);
  // The stored understanding keeps the reading's own words.
  const u = M.partUnderstanding(p, studioView(p).parts.find(x => x.name === '소비 파이프라인(Consumer)').id);
  assert.ok(u.role.startsWith('기준 8f5809d에서') && u.roleAbout.startsWith('|작성 시각|'));
  // A map.6 ask of the same project is built as before: no facts, the role as stored.
  const six = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA).ask;
  assert.ok(six.parts.every(x => !['state', 'lastBasis', 'files'].some(k => Object.hasOwn(x, k))));
  assert.equal(byName(six, '소비 파이프라인(Consumer)').role, u.role); assert.equal(byName(six, '소비 파이프라인(Consumer)').roleAbout, u.roleAbout);
});

test('I50-3 validation: the three facts go together on a map.7 part, within bounds; a stored map.7 ask without them stays valid; a brief part keeps them with one file', () => {
  const ask = ask7(grown()).ask, consumer = () => structuredClone(ask);
  const refused = (f, why) => { const a = consumer(); f(byName(a, '소비 파이프라인(Consumer)')); assert.throws(() => M.validateMapAsk(a), undefined, why); };
  refused(x => delete x.files, 'not all three'); refused(x => { x.state = 'built'; }, 'a state outside the list'); refused(x => { x.files = ['a', 'b', 'c', 'd']; }, 'four files');
  refused(x => { x.files = ['x'.repeat(61)]; }, 'a long file'); refused(x => { x.lastBasis = 'x'.repeat(41); }, 'a long basis'); refused(x => { x.lastBasis = ''; }, 'an empty basis');
  const six = consumer(); six.schemaVersion = M.MAP6_SCHEMA; assert.throws(() => M.validateMapAsk(six), undefined, 'map.6 has no facts');
  const old = consumer(); for (const x of old.parts) { delete x.state; delete x.lastBasis; delete x.files; }
  assert.deepEqual(M.validateMapAsk(structuredClone(old)), old, 'an ask stored before step 3 (a cached job) is still valid');
  // fitMap: a brief part keeps its state and lastBasis and its first file; the last step leaves every part's files out.
  const shrink = consumer();
  assert.ok(M.fitMap(shrink, '', true, () => shrink.parts.every(x => x.brief || (!x.note && !x.current.length && x.files.length <= M.BRIEF_FILES))));
  const c = byName(shrink, '소비 파이프라인(Consumer)');
  assert.deepEqual([c.brief, c.files, c.lastBasis], [true, ['src/documents/consumer.py'], '8f5809d · 2020-11-18']);
  assert.deepEqual(M.validateMapAsk(structuredClone(shrink)), shrink);
  const none = consumer();
  assert.equal(M.fitMap(none, '', true, () => false), false); assert.ok(none.parts.every(x => Array.isArray(x.files) && !x.files.length && Object.hasOwn(x, 'lastBasis')));
});

test('I50-4 the later prompts: a positive identity rule, version caution said of claims only, first-map texts byte for byte; the recipes name it', () => {
  // Plan: the one first-map line that put 판본 beside identity is said without it; the corrections line is said of claims.
  assert.ok(B.MAP_BLUEPRINT_PROMPT.includes('같은 이름만으로 다른 대상·판본을 합치지 않는다.'), 'the first-map plan as it was');
  assert.ok(!B.LATER_BLUEPRINT_PROMPT.includes('다른 대상·판본을 합치지') && !B.LATER_BLUEPRINT_PROMPT.includes('다른 판본·브랜치의 사실이'));
  for (const said of ['기준 커밋·판본의 차이는 대상의 차이가 아니다', '이 판본 문장은 current 주장의 대체에 관한 것이며 부분의 정체와 무관하다', '기존 부분의 정체(later-identity.1)',
    'INPUT.parts는 같은 프로젝트를 앞 기록들로 읽은 지금까지의 이해다', '기준 커밋·판본·작성 세션이 다르다는 것만으로 다른 대상이 되지 않는다',
    '파일·부모·구현 방식·이름이 바뀌어도 같은 책임을 이어 맡으면 같은 부분이다', '같은 코드로 도는 별개의 실행 단위', '이름이 비슷하다는 것만으로 합치지 않는다',
    '「기록 이름: …」', '새 부분을 만들어 비켜 가지 않는다', '효력 시점', '계획된 대체는 아무것도 없애지 않는다', 'C-ISSUE(오류·미해결)의 결함·문제 행은 철회가 아니다',
    '「구현됨」은 같은 기능·범위의 미구현 주장만 끝내며', 'lastBasis가 이번 기록의 기준과 다르다는 것은 시간이 흘렀다는 뜻'])
    assert.ok(B.LATER_BLUEPRINT_PROMPT.includes(said), said);
  assert.ok(B.LATER_BLUEPRINT_PROMPT.endsWith(B.LATER_IDENTITY_RULES + B.LATER_ROW_RULES), "step 4: the row-binding paragraph follows"); assert.equal(B.IDENTITY_VERSION, 'later-identity.1');
  // Render and global (the later merge rules) and the map.7 instructions.
  assert.ok(!LATER_MERGE_RULES.includes('구간·판본·프로젝트') && LATER_MERGE_RULES.includes('기준 커밋·판본의 차이는 부분의 정체가 아니라 주장의 범위(aboutAt)에 관한 것이다'));
  assert.ok(MERGE_RULES.includes('다른 구간의 같은 이름을 이름만으로 합치지 않는다') && !RENDER_RULES.includes('later-identity'), 'first-map rules untouched');
  const ask = ask7(grown()).ask, prompt = P.map7Prompt(ask);
  assert.ok(prompt.startsWith(P.MAP7_PROMPT + P.MAP7_COUNTS + P.MAP7_IDENTITY + P.MAP7_ROWS + P.MAP7_VOCABULARY));
  for (const said of ['위 「같은 대상인지는 이름만으로 정하지 않는다 …」 문장보다 우선한다', 'role·current 주장의 대체에 관한 것이며 부분의 정체에는 쓰지 않는다',
    'role·parentId·relations·files·readAs', '새 부분으로 비켜 가지 않고 candidates', '구현·가동·검증을 합친 판정이 아니다', 'at·basis·aboutAt으로 쓰지 않는다',
    'replaces의 근거가 아니다', '기준 머리말로 시작하지 않는다'])
    assert.ok(P.MAP7_IDENTITY.includes(said), said);
  assert.ok(P.MAP7_RECIPE.startsWith('map7-recipe.7:') && P.MAP7_RECIPE.includes('later-identity.1') && P.MAP7_RECIPE.includes('part-facts.1'));
  assert.equal(M.PART_FACTS, 'part-facts.1');
});

test('I50-R replay: the stage3-r1, R10 and R11 later asks rebuilt from the stored states carry unstamped roles and the parts\' facts within the byte budgets', { skip: !haveGrowth() }, t => {
  const rows = [];
  for (const c of CASES) {
    const { input, stored } = rebuilt(c), ask = input.ask;
    assert.equal(input.problem, null, c.run); assert.equal(ask.schemaVersion, M.MAP7_SCHEMA);
    assert.deepEqual(ask.parts.map(x => x.name), stored.parts.map(x => x.name), `${c.run}: the same parts, in the same order, under the same ids`);
    assert.deepEqual(M.validateMapAsk(JSON.parse(JSON.stringify(ask)), { route: 'divided' }), ask);
    assert.ok(utf8(ask) <= M.MAP_BYTES && metaBytes(ask) <= M.META_BYTES, `${c.run}: ${utf8(ask)} bytes, map ${metaBytes(ask)}`);
    assert.ok(!ask.parts.some(x => /^\s*기준\s+[0-9a-f]{7}/i.test(x.role)), `${c.run}: no role begins with a basis stamp`);
    assert.ok(!ask.parts.some(x => x.roleAbout?.trimStart().startsWith('|')), `${c.run}: no record table row as a role's about`);
    assert.ok(ask.parts.every(x => x.lastBasis !== null || x.roleBy !== 'reading'), `${c.run}: every part a reading described has its basis`);
    rows.push(`${c.run}: ${ask.parts.length} parts (${ask.parts.filter(x => x.brief).length} brief, stored ${stored.parts.filter(x => x.brief).length}), stamped roles ${stored.parts.filter(x => /^기준 [0-9a-f]{7}/.test(x.role)).length} -> 0, `
      + `row abouts ${stored.parts.filter(x => x.roleAbout?.startsWith('|')).length} -> 0, ${utf8(ask)} bytes (stored ${utf8(stored)}), map ${metaBytes(ask)} (stored ${metaBytes(stored)})`);
  }
  const s3 = rebuilt(CASES[0]).input.ask, r11 = rebuilt(CASES[2]).input.ask;
  assert.equal(byName(s3, 'paperless OCR·색인').lastBasis, '855ee64 · 2015-12-20');
  for (const [name, basis, file] of [['주기 일정(Django-Q Schedule)', '8f5809d · 2020-11-18', 'src/documents/migrations/1001_auto_20201109_1636.py'],
    ['분류 모델 파일', '8f5809d · 2020-11-18', 'DATA_DIR/classification_model.pickle'], ['소비 파이프라인(Consumer)', '8f5809d · 2020-11-18', 'src/documents/consumer.py'],
    ['소비 파이프라인', '86d9c94 · 2022-03-10', 'src/documents/consumer.py']]) {
    const x = byName(r11, name);
    assert.equal(x.lastBasis, basis, name); assert.ok(x.files.includes(file), `${name}: ${x.files}`);
  }
  assert.equal(byName(r11, '주기 일정(Django-Q Schedule)').role, '분류기 학습·색인 최적화·메일 확인 신호를 각각 매시·매일·10분에 발생시키는 일정이다.');
  assert.equal(byName(r11, '분류 모델 파일').role, '분류 모델을 pickle 파일로 보관한다.');
  t.diagnostic(rows.join('\n'));
});
