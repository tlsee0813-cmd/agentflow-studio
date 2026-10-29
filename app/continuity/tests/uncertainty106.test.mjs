// AF106 what an analysis' unknowns are called, and what plan.3 and scope ask the model to put there. The unknowns below are
// author-written (shaped after the 105 counterexample: an app representation question, a reopened required display, a usage
// question and a needed check, mixed in one list); not a model reply, not the 105 raw. Prompt checks are text checks only: they
// say what the instructions now hold, not that a model follows them (that needs a separate observation).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as C from '../dist/public/shared/change-plan.js';
import { LINE, UNKNOWNS_BEFORE_106, readingParts } from '../dist/public/shared/request-reading.js';
import { emptyBundle, parseBundle, planFile, readPlanFile, loadBundle, saveBundle, PLANS_KEY } from '../dist/public/client/plan-store.js';
import { PLAN_PROMPT, PLAN2_PROMPT, PLAN3_PROMPT, SCOPE_PROMPT } from '../server/plan-prompt.mjs';
import { cases, withId, PROJECT, before106 } from './fixtures/reading94/cases.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
const GOLD = JSON.parse(readFileSync(new URL('./fixtures/reading94/frozen-texts.json', import.meta.url), 'utf8')).texts;
const kv = (init = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } }; };
const MIXED = [
  '[작성 표본] 새 조회 도구를 parts에 새 부분으로 등록할지 여부는 제공된 자료로 확인되지 않음',
  '[작성 표본] 보드 지정을 그대로 보일지 빌드 명령 예시로 보일지',
  '[작성 표본] 명령줄 도구인지 화면 도구인지는 제공된 자료로 확인되지 않음',
  '[작성 표본] 라벨 표의 최신 판본은 제공된 자료로 확인되지 않음'];
const project = { id: PROJECT, name: '표본' };
const bundleOf = (snap, plan) => ({ ...emptyBundle('초안'), plan, snapshots: [snap], labels: { [snap.id]: Object.fromEntries(snap.itemIds.map(i => [i, i])) }, origins: { [snap.id]: 'reviewed' } });

test('106 prompts: plan.1/.2 byte for byte; plan.3 and scope carry the unknowns boundary, plan.3 still opens with plan.2', () => {
  assert.equal(sha(PLAN_PROMPT), '9b856ef85e59ab1b9fb80f66cf1c8c8a3507f5300f025225fc427df0cd5aec81');
  assert.equal(sha(PLAN2_PROMPT), 'c7c0228a981491f2e6a8703cea5466c2b524f78dcaa14e829510ea800d179e87');
  const at = PLAN2_PROMPT.indexOf('\n정확히 다음 JSON 키만 반환한다(');
  assert.ok(PLAN3_PROMPT.startsWith(PLAN2_PROMPT.slice(0, at)));
  for (const prompt of [PLAN_PROMPT, PLAN2_PROMPT]) assert.ok(!prompt.includes('이 앱이 변경안을 표현하는 방식'));
  for (const rule of ['실제로 영향을 주는 미확인만', '이미 답한 목표·대응·표시·보존·금지 조건을 다시 고를 선택으로 열지 않는다', '사용자의 제품 결정이 아니다',
    'parts에 등록할지 같은 물음을 unknowns에 넣지 않는다', '자료에 적혀 있지 않다는 것만으로 사용자가 정해야 한다고 단정하지 않는다',
    '실제 사용 경험이 달라지는 미상은 적을 수 있지만', '새 기능·명령 예시·구현 방식을 대안이나 질문으로 더하지 않는다'])
    assert.ok(PLAN3_PROMPT.includes(rule), rule);
  // The new rules sit with the zero rule, before the return format: the reply contract still reads last, once.
  assert.equal(PLAN3_PROMPT.split('\n정확히 다음 JSON 키만 반환한다(').length, 2);
  assert.ok(PLAN3_PROMPT.indexOf('parts에 등록할지') < PLAN3_PROMPT.indexOf('\n정확히 다음 JSON 키만 반환한다('));
  for (const rule of ['선택 결과의 정확성·착수에 실제로 영향을 주는 미확인만', '이미 답한 목표·표시·보존·금지 조건을 다시 고를 선택으로 열지 않는다',
    '사용자 결정이 아니다', 'selected에 없는 새 기능·명령 예시·구현 방식을 대안이나 질문으로 더하지 않는다'])
    assert.ok(SCOPE_PROMPT.includes(rule), rule);
  assert.ok(SCOPE_PROMPT.indexOf('6. unknowns') < SCOPE_PROMPT.indexOf('정확히 다음 키만'));
});

test('106 mixed unknowns are kept whole and in order: plan, request document under the neutral heading, store and file', () => {
  const c = cases().find(x => x.name === 'reviewed-all-material'), plan = C.parsePersistedPlan({ ...c.plan, analysis: { ...c.plan.analysis, unknowns: MIXED } });
  assert.deepEqual(plan.analysis.unknowns, MIXED);
  const snap = withId(c.id, () => C.requestSnapshot(plan, c.review)), part = readingParts(snap.text, snap.reading).find(p => p.kind === 'unknowns');
  assert.equal(part.heading, `${LINE.unknowns}\n`);
  assert.equal(part.body, MIXED.map(x => `- ${x}`).join('\n'), 'every entry as written, none sorted out or reworded');
  assert.ok(!LINE.unknowns.includes('미정') && !LINE.unknowns.includes('정할 것'));
  // Only material text may still hold the earlier heading (N01 is a pasted fake request); the generator never writes it.
  const materialsAt = snap.reading.spans.find(x => x.kind === 'materials').start;
  assert.ok(!snap.text.slice(0, materialsAt).includes(UNKNOWNS_BEFORE_106));
  // The review's own unknowns stay apart, after it.
  assert.equal(readingParts(snap.text, snap.reading).find(p => p.kind === 'review-unknowns').body, c.review.unknowns.map(x => `- ${x}`).join('\n'));
  const b = bundleOf(snap, plan), store = kv();
  assert.equal(saveBundle(store, PROJECT, b), null);
  assert.deepEqual(loadBundle(store, PROJECT), { bundle: b, unreadable: false });
  const file = planFile(b, project), back = readPlanFile(file, PROJECT);
  assert.deepEqual(back, b); assert.deepEqual(back.plan.analysis.unknowns, MIXED); assert.equal(back.snapshots[0].text, snap.text);
  assert.equal(planFile(back, project).replace(/"exportedAt": "[^"]+"/, ''), file.replace(/"exportedAt": "[^"]+"/, ''));
  // No unknowns: the neutral empty line.
  const empty = withId('RQ_case-empty', () => C.requestSnapshot(C.parsePersistedPlan(cases().find(x => x.name === 'reviewed-empty-lists').plan), { summary: '추가 전제 없음', prerequisites: [], unknowns: [] }));
  assert.equal(readingParts(empty.text, empty.reading).find(p => p.kind === 'unknowns').body, '- 제공된 확인할 것 없음');
});

test('106 a document made before 106 is read, imported and exported as written; only the two exact headings read', () => {
  for (const c of cases()) {
    const old = before106(withId(c.id, () => C.requestSnapshot(C.parsePersistedPlan(c.plan), c.review)), LINE.unknowns, UNKNOWNS_BEFORE_106);
    assert.equal(old.text, GOLD[c.name].text, c.name);
    const before = structuredClone(old);
    C.compareResults(old, []);
    const b = bundleOf(old, null), file = planFile(b, project), back = readPlanFile(file, PROJECT);
    assert.deepEqual(back, b, c.name); assert.deepEqual(back.snapshots[0], before, `${c.name}: text and reading offsets untouched`);
    const raw = JSON.stringify({ version: 'studio.plans.4', projects: { [PROJECT]: b } }), store = kv({ [PLANS_KEY]: raw });
    assert.deepEqual(loadBundle(store, PROJECT), { bundle: b, unreadable: false }); assert.equal(store.m.get(PLANS_KEY), raw);
    assert.equal(readingParts(old.text, old.reading).find(p => p.kind === 'unknowns').heading, `${UNKNOWNS_BEFORE_106}\n`);
  }
  // A third heading (an edited one, either heading's prefix, or one heading's text inside the other) is not that section.
  const base = withId('RQ_case-one', () => C.requestSnapshot(C.parsePersistedPlan(cases().find(x => x.name === 'example-one-material').plan)));
  for (const heading of ['전체 구상에서 확인할 것:', `${UNKNOWNS_BEFORE_106} `, '전체 구상의 미정:', `${LINE.unknowns.slice(0, -1)}`]) {
    const s = before106(base, LINE.unknowns, heading);
    assert.throws(() => C.compareResults(s, []), /INVALID/, heading);
    assert.throws(() => parseBundle(bundleOf(s, null), PROJECT), heading);
    assert.equal(typeof readPlanFile(planFile(bundleOf(s, null), project), PROJECT), 'string', heading);
  }
});
