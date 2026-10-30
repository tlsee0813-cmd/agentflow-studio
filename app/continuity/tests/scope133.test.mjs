// AF133 the scope review reads a report, defect, request or repair plan at the time and version it was recorded. Wording checks of
// the instruction for three written boundaries: they say what it now holds, not that a model follows it (that needs a separate
// observation), and no model answer is written or checked here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PLAN_PROMPT, PLAN2_PROMPT, PLAN3_PROMPT, SCOPE_PROMPT } from '../server/plan-prompt.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
const at = s => { const i = SCOPE_PROMPT.indexOf(s); assert.ok(i >= 0, s); return i; };

test('133 plan instructions are byte for byte as before', () => {
  assert.equal(sha(PLAN_PROMPT), '9b856ef85e59ab1b9fb80f66cf1c8c8a3507f5300f025225fc427df0cd5aec81');
  assert.equal(sha(PLAN2_PROMPT), 'c7c0228a981491f2e6a8703cea5466c2b524f78dcaa14e829510ea800d179e87');
  assert.equal(sha(PLAN3_PROMPT), 'aacb45c30be76c620da3503ed806c809a520c772c36412982d7dff8b69443a7a');
});

test('133 scope: records bound to their time and version, in the evidence paragraph before the numbered rules', () => {
  const from = at('kind가 reading이면'), to = at('\n1. ');
  const rule = s => { const i = at(s); assert.ok(i > from && i < to, s); };
  rule('그것을 기록한 시점과 basis의 판본에 묶어 읽는다');
  // (1) a past defect and a repair still to be done: neither present absence nor present completion, in summary or prerequisites.
  rule('과거에 보고된 결함이나 앞으로 하겠다는 수리를 summary나 prerequisites에서 현재의 결여나 현재의 완성으로 단정하지 않는다');
  rule('수리 지시·계획은 실행되거나 해결됐다는 증거가 아니며, 완료 증거가 없다는 것도 아직 구현되지 않았다는 증거가 아니다');
  rule('선택 결과에 관련될 때만 unknowns에 남긴다'); rule('제공되지 않은 최신 코드를 안다고 가정하지 않는다');
  // (2) the target's code or check of the present version stating the lack: a minimal candidate within its scope.
  rule('현재 판본으로 보여 주는 코드나 검사가 결여를 명시하면, 그 대상·조건의 범위 안에서 최소 전제 후보의 근거가 된다');
  rule('결함 기록을 모두 과거 일로 치우지도 않는다');
  // (3) reports of different versions that disagree: not merged into one present state, nor settled as done or absent.
  rule('판본이 다른 보고가 서로 어긋나면 하나의 현재 상태로 합치거나 완료·부재로 확정하지 않는다');
  rule('summary와 prerequisites는 같은 확실성으로 쓴다');
  // 108's order of authority and the reply contract stay as they were.
  assert.ok(at('INPUT.selected가 이번에 맡길 결과의 집합을 정한다') < from);
  assert.equal(SCOPE_PROMPT.split('정확히 다음 키만').length, 2);
});
