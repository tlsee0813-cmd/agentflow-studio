// AF108 the scope review's order of authority: selected sets which results are asked for; intent's explicit conditions on those
// results hold although the short selected text leaves them out; other results of the whole idea stay unselected. Text checks of
// the instruction only: they say what it now holds, not that a model follows it (that needs a separate observation).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PLAN_PROMPT, PLAN2_PROMPT, PLAN3_PROMPT, SCOPE_PROMPT } from '../server/plan-prompt.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
const RETURN = '정확히 다음 키만 가진 JSON 객체로 반환한다. markdown 금지.\n{"summary":"...","prerequisites":[{"title":"최소 전제 후보","reason":"자료에서 부족하다고 판단한 이유","refs":["실제 근거 ID"]}],"unknowns":["미확인 또는 선택 설명과 원자료의 충돌"]}';

test('108 plan instructions are byte for byte as before', () => {
  assert.equal(sha(PLAN_PROMPT), '9b856ef85e59ab1b9fb80f66cf1c8c8a3507f5300f025225fc427df0cd5aec81');
  assert.equal(sha(PLAN2_PROMPT), 'c7c0228a981491f2e6a8703cea5466c2b524f78dcaa14e829510ea800d179e87');
  assert.equal(sha(PLAN3_PROMPT), 'aacb45c30be76c620da3503ed806c809a520c772c36412982d7dff8b69443a7a');
});

test('108 scope: selected sets the results, intent\'s explicit conditions on them hold, other results stay unselected', () => {
  const at = s => { const i = SCOPE_PROMPT.indexOf(s); assert.ok(i >= 0, s); return i; };
  // The opening says it once, before the numbered rules.
  const opening = ['INPUT.selected가 이번에 맡길 결과의 집합을 정한다', '짧게 줄인 것이며 완전한 명세가 아니다',
    'selected 설명에 반복되지 않아도 그 결과의 요구로 유효하다', 'selected 결과와 독립된 다른 결과는 이 규칙으로 되살리지 않는다'];
  for (const rule of opening) assert.ok(at(rule) < at('\n1. '), rule);
  assert.ok(!SCOPE_PROMPT.includes('INPUT.selected만 이번에 맡길 결과다'));
  // (a) a field the intent asked for, missing from the short selected text; (b) the unselected feature still out.
  assert.ok(at('제목·작성일 표시는 그 찾기의 요구이며 넣을지 다시 묻지 않는다') > at('3. 예:'));
  assert.ok(SCOPE_PROMPT.includes("'예약 발행'은 찾기의 전제가 아니며 선택하지 않은 결과로 남는다"));
  assert.ok(SCOPE_PROMPT.includes('전체 구상의 일괄 입력·계속 처리·새 실행 방식은 사용자가 이번에 선택하지 않았다면'));
  // (c) a real conflict or unknown stays, and is not decided either way; an omission is not a conflict.
  for (const rule of ['명시적으로 어긋나면 어느 쪽으로도 조용히 덮지 말고 그 충돌만 unknowns에 짚는다', '짧게 줄여 생략한 것은 충돌이 아니다', '알 수 없는 전제도 unknowns에 남긴다'])
    assert.ok(at(rule) > at('\n4. ') && at(rule) < at('\n5. '), rule);
  // Future change told by the material: already handled by the selected result's own rule, so not a new unknown or update task.
  assert.ok(at('앞으로 바뀔 수 있다고 적은 대상도') > at('\n6. '));
  assert.ok(SCOPE_PROMPT.includes('지금 선택의 새 미확인이나 필수 갱신 과제로 올리지 않는다'));
  // The reply contract reads last, once, as before.
  assert.ok(SCOPE_PROMPT.endsWith(RETURN)); assert.equal(SCOPE_PROMPT.split('정확히 다음 키만').length, 2);
});
