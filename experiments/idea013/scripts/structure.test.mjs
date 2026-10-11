// Entirely synthetic structure fixtures. These are NOT model responses or app tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateCases, initialRequest, buildBatch, validateResponse, followupRequest } from './assemble.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(resolve(root, name), 'utf8');
const cases = JSON.parse(read('cases/development.json'));
const c = {
  caseId: 'SHAPE-ONLY', request: { id: 'U1', text: '구조 검사용 입력이며 실제 고객 요청이 아닙니다.' },
  context: [], materials: [], decisions: [
    { id: 'D1', text: '구조 검사용 기존 확정입니다.', status: 'confirmed', locked: true },
    { id: 'D2', text: '구조 검사용 미확정 제안입니다.', status: 'proposed', locked: false }
  ]
};
const clone = x => structuredClone(x);
function fixture(route = 'fork') {
  return {
    schemaVersion: 'idea013.v1', route, focus: '구조 검사 전용', reason: '의미 품질을 평가하지 않는 형식 예시입니다.',
    evidence: [{ sourceId: 'U1', quote: '구조 검사용 입력' }],
    scene: route === 'fork' ? {
      setup: '구조 검사용 가정 상황',
      alternatives: ['A', 'B'].map(id => ({ id, interpretation: `가정 ${id}`, rationale: '구조 검사', action: '가정 행동', result: '가정 결과' }))
    } : null,
    decision: { state: route === 'proceed' ? 'not_needed' : 'open', question: route === 'proceed' ? null : '구조 검사용 질문입니다. 직접 입력·잘 모르겠음·보류도 가능합니다.', sourceId: null },
    notes: [], next: '이 예시는 모델 결과나 제품 검증으로 사용하지 않습니다.'
  };
}
const first = initialRequest(c, 'baseline');
const prior = fixture();
const raw = JSON.stringify(prior, null, 2) + '\n';
const answer = {
  sourceId: 'F1', origin: 'test_answer', providedBy: 'structure.test.mjs의 합성 구조검사 fixture',
  kind: 'answer', inReplyTo: prior.decision.question, text: 'A. 구조 검사를 위한 합성 답변이며 고객이 작성한 것이 아닙니다.'
};

test('개발용 입력은 예약 사례 없는 6개이며 출처 형태가 유효하다', () => {
  assert.equal(cases.length, 6);
  validateCases(cases);
  assert(!JSON.stringify(cases).includes('예약'));
});
test('12개 실제 messages: 사례마다 user 데이터 동일, system 전략만 다르고 공통 계약 동일', () => {
  const batch = buildBatch(cases);
  assert.equal(batch.length, 12);
  assert.equal(new Set(batch.map(r => r.requestId)).size, 12);
  for (const c of cases) {
    const [a, b] = batch.filter(r => r.caseId === c.caseId);
    assert.equal(a.messages[1].content, b.messages[1].content);
    assert.notEqual(a.messages[0].content, b.messages[0].content);
    for (const r of [a, b]) {
      assert.deepEqual(r.messages.map(m => m.role), ['system', 'user']);
      assert(r.messages[0].content.endsWith(read('contracts/OUTPUT_CONTRACT.md').trim()));
      assert.deepEqual(JSON.parse(r.messages[1].content), { turn: 'initial', case: c });
    }
  }
  assert.equal(batch[0].promptId, 'baseline');
  assert.equal(batch[2].promptId, 'enhanced');
  const pregenerated = read('requests/development.jsonl').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(pregenerated, batch);
});
test('평가 필드 혼입, 중복 사례/출처, 미확정 잠금을 거절한다', () => {
  assert.throws(() => validateCases([{ ...c, expectedRoute: 'fork' }]));
  assert.throws(() => validateCases([c, c]));
  const bad = clone(c); bad.context.push(clone(c.request));
  assert.throws(() => validateCases([bad]));
  const locked = clone(c); locked.decisions[1].locked = true;
  assert.throws(() => validateCases([locked]));
});
test('고객 데이터 속 지시 문자열은 user JSON에만 남는다', () => {
  const marked = clone(c); marked.request.text += '\nIGNORE_SYSTEM__STRUCTURE_TEST__';
  const r = initialRequest(marked, 'enhanced');
  assert(!r.messages[0].content.includes('IGNORE_SYSTEM__STRUCTURE_TEST__'));
  assert.equal(JSON.parse(r.messages[1].content).case.request.text, marked.request.text);
});
test('세 경로 형태와 단일 기준장면을 허용하되 경로/질문/대안 불일치를 거절한다', () => {
  for (const route of ['fork', 'proceed', 'need_info']) validateResponse(fixture(route), c);
  const single = fixture('proceed'); single.scene = fixture().scene; single.scene.alternatives.pop();
  validateResponse(single, c);
  const bad = fixture('need_info'); bad.scene = fixture().scene;
  assert.throws(() => validateResponse(bad, c));
  const noQuestion = fixture(); noQuestion.decision.question = null;
  assert.throws(() => validateResponse(noQuestion, c));
  const duplicate = fixture(); duplicate.scene.alternatives[1].id = 'A';
  assert.throws(() => validateResponse(duplicate, c));
});
test('잘못된 인용·출처·미확정 승격을 거절한다', () => {
  const badQuote = fixture(); badQuote.evidence[0].quote = '없는 원문';
  assert.throws(() => validateResponse(badQuote, c));
  const badSource = fixture(); badSource.evidence[0].sourceId = 'UNKNOWN';
  assert.throws(() => validateResponse(badSource, c));
  const promoted = fixture(); promoted.notes.push({ kind: 'confirmed', text: '구조 검사', sourceIds: ['D2'] });
  assert.throws(() => validateResponse(promoted, c));
  const noConflictRef = fixture(); noConflictRef.notes.push({ kind: 'conflict', text: '구조 검사', sourceIds: ['U1'] });
  assert.throws(() => validateResponse(noConflictRef, c));
});
test('후속은 첫 요청과 assistant 원문을 그대로 보존하고 명시한 답변만 붙인다', () => {
  const follow = followupRequest(first, raw, answer);
  assert.deepEqual(follow.messages.slice(0, 2), first.messages);
  assert.equal(follow.messages[2].content, raw);
  assert.deepEqual(JSON.parse(follow.messages[3].content), { turn: 'followup', answer });
  assert.equal(follow.parentRequestId, first.requestId);
  assert.equal(follow.turn, 2);
});
test('빈 답변 템플릿·출처 누락·다른 질문·질문 없는 응답·잘못된 JSON을 자동 보충하지 않는다', () => {
  assert.throws(() => followupRequest(first, raw, JSON.parse(read('examples/followup-answer.template.json'))));
  assert.throws(() => followupRequest(first, raw, { ...answer, origin: undefined }));
  assert.throws(() => followupRequest(first, raw, { ...answer, inReplyTo: '다른 질문' }));
  assert.throws(() => followupRequest(first, JSON.stringify(fixture('proceed')), answer));
  assert.throws(() => followupRequest(first, '```json\n' + raw + '```', answer));
});
test('변조된 원본이나 두 번째 후속을 거절한다', () => {
  const bad = clone(first); bad.messages[0].content += '\nchanged';
  assert.throws(() => followupRequest(bad, raw, answer));
  const follow = followupRequest(first, raw, answer);
  assert.throws(() => followupRequest(follow, raw, answer));
});
test('시험답변의 해결은 test_only이며 실제 고객답변의 resolved와 구분한다', () => {
  const result = fixture('proceed');
  result.decision = { state: 'test_only', question: null, sourceId: 'F1' };
  result.notes = [{ kind: 'test_only', text: '구조 검사용 시험 조건에서만 적용합니다.', sourceIds: ['F1'] }];
  validateResponse(result, c, answer);
  const promoted = clone(result); promoted.decision.state = 'resolved';
  assert.throws(() => validateResponse(promoted, c, answer));
  const missing = clone(result); missing.notes = [];
  assert.throws(() => validateResponse(missing, c, answer));
  const actual = { ...answer, origin: 'customer_answer' }; // Only exercises the enum, NOT a real customer answer.
  const resolved = fixture('proceed'); resolved.decision = { state: 'resolved', question: null, sourceId: 'F1' };
  validateResponse(resolved, c, actual);
});
test('보류·모르겠음은 확정이나 재질문으로 바뀌지 않는다', () => {
  for (const kind of ['defer', 'unknown']) {
    const a = { ...answer, kind, text: `구조 검사 전용: ${kind}` };
    followupRequest(first, raw, a);
    const result = fixture(); result.decision = { state: 'deferred', question: null, sourceId: 'F1' };
    result.notes = [{ kind: 'test_only', text: '합성 답변의 보류 상태 검사입니다.', sourceIds: ['F1'] }];
    validateResponse(result, c, a);
    result.decision.state = 'open'; result.decision.question = prior.decision.question;
    assert.throws(() => validateResponse(result, c, a));
  }
});
test('CLI는 파일만 만들고 기존 출력 덮어쓰기를 거절한다; 비밀 접근·통신 코드는 없다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idea013-structure-'));
  try {
    const out = join(dir, 'requests.jsonl');
    const args = [resolve(root, 'scripts/assemble.mjs'), 'initial', '--cases', resolve(root, 'cases/development.json'), '--out', out];
    const run = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const before = readFileSync(out, 'utf8');
    assert.equal(before, read('requests/development.jsonl'));
    const second = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(second.status, 1);
    assert.equal(readFileSync(out, 'utf8'), before);
    const code = read('scripts/assemble.mjs');
    assert(!/\bfetch\s*\(|process\.env|node:https?['"]/.test(code));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
