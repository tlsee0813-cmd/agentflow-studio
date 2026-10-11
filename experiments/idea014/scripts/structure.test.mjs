// Author-created structural fixtures. Not model output or customer/semantic evaluation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildBatch, initialRequest, followupRequest, checkRecord, requestContext } from './assemble.mjs';
import { validateCase, validateCases, validateResponse, validateText, validateAnswer } from './validate.mjs';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const cases = JSON.parse(read('../cases/existing-10.json'));
const clone = x => structuredClone(x);
const c = cases[1]; // DEV-02 is used only to exercise provenance of a direct request.
const base = (input = c) => ({
  schemaVersion: 'idea014.v2', route: 'proceed', focus: '작성자 구조검사 fixture',
  reason: '입력된 범위만 정리하는 형식 검사이며 모델 품질 검사가 아님.',
  evidence: [{ sourceId: input.request.id, quote: input.request.text.slice(0, 30) }],
  scene: null, decision: { state: 'not_needed', question: null, sourceId: null }, notes: [],
  next: '이 fixture는 실행하거나 고객에게 보내지 않는다.'
});
const note = (kind, sourceIds, text = '구조검사 메모') => ({ kind, text, sourceIds });
function fork(input = c) {
  const r = base(input); r.route = 'fork';
  r.decision = { state: 'open', question: '어느 표시 범위인가요? 직접 입력·모르겠음·보류도 가능합니다.', sourceId: input.request.id };
  r.scene = { axis: '대기 항목의 기본 목록 포함 여부', setup: '가정 장면: 아직 회신이 없는 항목 한 건.', action: '담당자가 같은 기본 목록을 연다.',
    alternatives: [
      { id: 'A', interpretation: '대기 항목 제외 제안', rationale: '현재 처리할 일에 집중', result: '대기 항목은 기본 목록에 표시하지 않는 안', tradeoff: '대기 항목 조회 경로는 따로 필요' },
      { id: 'B', interpretation: '대기 항목 포함 제안', rationale: '대기 상황도 함께 확인', result: '대기 항목을 기본 목록에 표시하는 안', tradeoff: '기본 목록에 항목이 더 남음' }
    ] };
  return r;
}
function needInfo(input = c) {
  const r = base(input); r.route = 'need_info';
  r.decision = { state: 'open', question: '자료 한 건을 확인할 수 있나요? 모르겠음·보류도 가능합니다.', sourceId: input.request.id };
  r.notes = [note('unknown', [input.request.id], '구조검사용 확인 항목')];
  return r;
}
const answer = (previous, origin = 'test_answer', kind = 'answer') => ({
  sourceId: 'F1', origin, providedBy: '구조검사 작성자 (실제 고객 아님)', kind,
  inReplyTo: previous.decision.question, text: '구조검사에만 사용할 명시적 답변.'
});
const putNotes = (...notes) => ({ ...base(), notes });

test('01: 기존 10사례의 원문과 입력 위치를 messages에서 보존한다', () => {
  validateCases(cases); assert.equal(cases.length, 10);
  const batch = buildBatch(cases); assert.equal(batch.length, 20);
  for (const row of batch) {
    const input = cases.find(x => x.caseId === row.caseId);
    assert.deepEqual(JSON.parse(row.messages[1].content), { turn: 'initial', case: input });
    assert.deepEqual(row.messages.map(m => m.role), ['system', 'user']);
  }
});
test('02: 두 전략은 같은 계약/고객 입력을 쓰며 준비된 20messages와 일치한다', () => {
  const common = read('../contracts/OUTPUT_CONTRACT.md').trim();
  const batch = buildBatch(cases);
  for (let i = 0; i < batch.length; i += 2) {
    const [a, b] = batch.slice(i, i + 2);
    assert.equal(a.messages[1].content, b.messages[1].content);
    for (const r of [a, b]) assert.equal(r.messages[0].content, read(`../prompts/${r.promptId}.md`).trim() + '\n\n' + common);
    assert.equal(a.promptId, i % 4 === 0 ? 'baseline' : 'enhanced');
  }
  const prepared = read('../requests/existing-20.jsonl').trim().split('\n').map(JSON.parse);
  assert.deepEqual(prepared, batch);
});
test('03: 별도 사례 병합을 지원하고 ID 중복을 거절한다 (추가 4개는 구조검사용 복제)', () => {
  const extension = Array.from({ length: 4 }, (_, i) => ({ ...clone(c), caseId: `CHECK-ONLY-${i}` }));
  assert.equal(buildBatch([...cases, ...extension]).length, 28);
  assert.throws(() => buildBatch([...cases, clone(c)]), /caseId 중복/);
});
test('04: 기대값/평가메모 유입과 잘못된 입력을 조용히 제거하지 않고 거절한다', () => {
  for (const extra of ['reviewer_notes', 'expected', 'meta']) assert.throws(() => initialRequest({ ...c, [extra]: 'DO_NOT_SEND' }, 'baseline'));
  const n = clone(c); n.request.expected = 'DO_NOT_SEND'; assert.throws(() => validateCase(n));
  const duplicate = clone(c); duplicate.context[0].id = duplicate.request.id; assert.throws(() => validateCase(duplicate));
  const locked = clone(c); locked.decisions[0].status = 'proposed'; assert.throws(() => validateCase(locked));
});
test('05: v1/누락/추가 필드/잘못된 인용 키/코드펜스를 수선하지 않는다', () => {
  assert.throws(() => validateResponse({ ...base(), schemaVersion: 'idea013.v1' }, c));
  const missing = base(); delete missing.decision.sourceId; assert.throws(() => validateResponse(missing, c));
  assert.throws(() => validateResponse({ ...base(), surprise: true }, c));
  const r = base(); r.evidence[0] = { sourceId: c.request.id, text: c.request.text }; assert.throws(() => validateResponse(r, c));
  assert.throws(() => validateText('```json\n' + JSON.stringify(base()) + '\n```', c));
});
test('06: DEV02 명시 요청은 requested/U1로 통과하며 D출처를 요구하지 않는다', () => {
  const r = putNotes(note('requested', [c.request.id], c.request.text));
  validateResponse(r, c);
  assert.throws(() => validateResponse(putNotes(note('confirmed', [c.request.id], c.request.text)), c), /confirmed/);
  assert.throws(() => validateResponse(putNotes(note('requested', [c.context[0].id])), c), /requested/);
});
test('07: confirmed는 이전 확정 하나만; 맥락/제안/여러 결정을 끼워 승격할 수 없다', () => {
  validateResponse(putNotes(note('confirmed', ['D1'])), c);
  for (const ids of [['C1'], ['D1', 'U1']]) assert.throws(() => validateResponse(putNotes(note('confirmed', ids)), c));
  const r = base(cases[5]); r.notes = [note('confirmed', ['D2'])]; assert.throws(() => validateResponse(r, cases[5]));
});
test('08: 요청 안의 배경도 context가 될 수 있고 자료는 confirmed가 아니다', () => {
  validateResponse(putNotes(note('context', ['U1', 'C1'])), c);
  const r = base(cases[5]); r.notes = [note('context', ['M1', 'M2'])]; validateResponse(r, cases[5]);
  r.notes = [note('confirmed', ['M1'])]; assert.throws(() => validateResponse(r, cases[5]));
  const unusual = clone(c); unusual.request.id = 'D_request';
  const p = base(unusual); p.notes = [note('requested', ['D_request'])]; validateResponse(p, unusual); // No prefix heuristics.
});
test('09: 현황 C+요청 U는 confirmed 충돌이 아니며 잠긴 D+U 충돌은 보존한다', () => {
  const input = cases[3], r = fork(input);
  r.notes = [note('conflict', ['D1', 'U1'])]; validateResponse(r, input);
  r.notes = [note('conflict', ['C1', 'U1'])]; assert.throws(() => validateResponse(r, input), /conflict/);
  const direct = base(input); direct.notes = [note('conflict', ['D1', 'U1'])]; assert.throws(() => validateResponse(direct, input), /미해결 conflict/);
});
test('10: 공통 행동은 한 번, 각 안의 대가는 필수이며 경로/대안 수를 확인한다', () => {
  validateResponse(fork(), c);
  const separate = fork(); separate.scene.alternatives[0].action = '다른 행동'; assert.throws(() => validateResponse(separate, c));
  const missing = fork(); delete missing.scene.alternatives[1].tradeoff; assert.throws(() => validateResponse(missing, c));
  const info = needInfo(); info.scene = fork().scene; assert.throws(() => validateResponse(info, c));
  const noUnknown = needInfo(); noUnknown.notes = []; assert.throws(() => validateResponse(noUnknown, c));
  const duplicate = fork(); duplicate.scene.alternatives[1].id = 'A'; assert.throws(() => validateResponse(duplicate, c));
});
test('11: 원문 부분 인용과 참조 ID는 계속 엄격하게 검사한다', () => {
  const r = base(); r.evidence[0].quote = '원문에 없는 표현'; assert.throws(() => validateResponse(r, c));
  r.evidence[0] = { sourceId: 'NOT_SUPPLIED', quote: c.request.text }; assert.throws(() => validateResponse(r, c));
  assert.throws(() => validateResponse(putNotes(note('unknown', ['NOT_SUPPLIED'])), c));
});
test('12: 실제 고객 답변이라는 표지의 구조를 처리하되 새 confirmed로 쓰지 않는다', () => {
  const a = answer(fork(), 'customer_answer'); // Protocol simulation, not a real customer answer.
  const r = putNotes(note('requested', ['F1'])); r.decision = { state: 'resolved', question: null, sourceId: 'F1' };
  validateResponse(r, c, a);
  r.notes = [note('confirmed', ['F1'])]; assert.throws(() => validateResponse(r, c, a));
});
test('13: 시험답변은 requested/context/confirmed/resolved로 승격할 수 없다', () => {
  const a = answer(fork());
  const r = putNotes(note('test_only', ['F1'])); r.decision = { state: 'test_only', question: null, sourceId: 'F1' };
  validateResponse(r, c, a);
  for (const kind of ['requested', 'context', 'confirmed']) assert.throws(() => validateResponse({ ...r, notes: [...r.notes, note(kind, ['F1'])] }, c, a));
  assert.throws(() => validateResponse({ ...r, notes: [] }, c, a));
  assert.throws(() => validateResponse({ ...r, decision: { ...r.decision, state: 'resolved' } }, c, a));
});
test('14: 보류/모르겠음은 deferred/출처/질문없음을 유지한다', () => {
  for (const kind of ['defer', 'unknown']) {
    const a = answer(needInfo(), 'test_answer', kind), r = needInfo();
    r.notes.push(note('test_only', ['F1'])); r.decision = { state: 'deferred', question: null, sourceId: 'F1' };
    validateResponse(r, c, a);
    assert.throws(() => validateResponse({ ...r, decision: { state: 'open', question: '재질문', sourceId: 'U1' } }, c, a));
  }
});
test('15: 한 번의 후속은 실제 문자열과 정확한 질문을 보존하며 답을 자동 생성하지 않는다', () => {
  const record = initialRequest(c, 'enhanced'), previous = fork(), raw = JSON.stringify(previous, null, 1) + '\n';
  const a = answer(previous), next = followupRequest(record, raw, a);
  assert.equal(next.messages[2].content, raw); assert.deepEqual(JSON.parse(next.messages[3].content).answer, a);
  requestContext(next);
  assert.throws(() => followupRequest(next, raw, a));
  assert.throws(() => followupRequest(record, raw, { ...a, inReplyTo: '다른 질문' }));
  assert.throws(() => followupRequest(record, raw, { ...a, text: '' }));
  assert.throws(() => validateAnswer(JSON.parse(read('../examples/followup-answer.template.json')), c));
  assert.throws(() => followupRequest(initialRequest(c, 'baseline'), JSON.stringify(base()), a));
});
test('16: 원본 요청 변조 거절, 입력 불변, 실패 기록에 의미판정 완료를 표시하지 않는다', () => {
  const before = clone(cases); buildBatch(cases); validateResponse(base(), c); assert.deepEqual(cases, before);
  const changed = initialRequest(c, 'baseline'); changed.messages[0].content += '\n변조';
  assert.equal(checkRecord(changed, JSON.stringify(base())).status, 'failed');
  const result = checkRecord(initialRequest(c, 'baseline'), 'not json');
  assert.equal(result.status, 'failed'); assert.equal(result.meaningReview, 'not_performed');
});
test('17: CLI는 실패 검사 보고서를 저장하고 기존 요청/보고서를 덮지 않는다', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'idea014-'));
  const cli = (...args) => spawnSync(process.execPath, [join(ROOT, 'scripts/assemble.mjs'), ...args], { cwd: ROOT, encoding: 'utf8' });
  try {
    const req = join(tmp, 'batch.jsonl'), raw = join(tmp, 'raw.txt'), out = join(tmp, 'check.json');
    assert.equal(cli('initial', '--cases', 'cases/existing-10.json', '--out', req).status, 0);
    const before = readFileSync(req);
    assert.equal(cli('initial', '--cases', 'cases/existing-10.json', '--out', req).status, 1);
    assert.deepEqual(readFileSync(req), before);
    writeFileSync(raw, 'broken JSON');
    const args = ['check', '--requests', req, '--id', 'IDEA014.DEV-02.baseline.t1', '--assistant', raw, '--out', out];
    assert.equal(cli(...args).status, 1); assert.equal(JSON.parse(readFileSync(out)).status, 'failed');
    const report = readFileSync(out); writeFileSync(raw, JSON.stringify(base()));
    assert.equal(cli(...args).status, 1); assert.deepEqual(readFileSync(out), report);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
test('18: 검증기 한계 명시 — 범위제한 전송은 검사하지만 본문 참/거짓·편향은 판정하지 않는다', () => {
  const previous = needInfo(), a = answer(previous, 'test_answer', 'unknown');
  a.text = '아직 모르겠습니다. 원인 판단은 보류하고 확인 항목만 남겨 주세요.';
  const followup = followupRequest(initialRequest(c, 'baseline'), JSON.stringify(previous), a);
  assert.equal(JSON.parse(followup.messages[3].content).answer.text, a.text);
  const unsupported = base();
  unsupported.next = '구조검사용 잘못된 주장: 실제 서비스가 검증 완료되었다.';
  // This passes shape/source validation intentionally: human review MUST reject the claim.
  validateResponse(unsupported, c);
});

// rev1: author-written fixtures reproducing the independent review's boundary.
// No API calls. They exercise the real assembler/validator, not a second validator.
const amendmentCase = (locked = false) => ({
  caseId: 'REV1-CHANGE',
  request: { id: 'U1', text: 'D1을 60일로 변경해줘. 기준일과 다른 결정은 그대로 둬.' },
  context: [{ id: 'C1', text: '요청자는 이 프로젝트의 유예 기간을 정하고 변경할 수 있는 소유자다.' }],
  decisions: [
    { id: 'D1', text: '유예 기간은 deleted_at 기준 30일이다.', status: 'confirmed', locked },
    { id: 'D2', text: '목록의 기본 정렬은 이름순으로 유지한다.', status: 'confirmed', locked: true }
  ], materials: []
});
function amendment(c, a = null) {
  const source = a ? { id: a.sourceId, text: a.text } : c.request;
  const r = base(c);
  r.focus = 'D1 유예 기간 변경';
  r.reason = '권한 있는 고객이 변경할 값과 범위를 명시했으므로 재승인하지 않는다.';
  r.evidence = [{ sourceId: source.id, quote: source.text }];
  r.notes = [
    note('confirmed', ['D1'], c.decisions[0].text),
    note('requested', [source.id], '유예 기간을 60일로 바꾸고 기준일과 다른 결정은 유지한다.'),
    note('change', ['D1', source.id], 'D1의 유예 기간 30일을 전체 대상에 60일로 변경 요청. deleted_at 기준과 D2는 유지하며 D1 원본은 남긴다.'),
    note('conflict', ['D1', source.id], 'D1의 30일과 새 60일의 차이는 고객의 명시 변경 관계로 기록한다.')
  ];
  if (a) r.decision = { state: 'resolved', question: null, sourceId: source.id };
  r.next = '유예 기간만 60일인 요구로 정리한다. 외부 실행은 하지 않는다.';
  return r;
}
function ambiguousChange() {
  const input = amendmentCase(true);
  input.request.text = 'D1의 30일은 너무 짧아. 유예를 더 넉넉하게 바꿔줘.';
  const r = needInfo(input);
  r.focus = 'D1에서 바꿀 유예 기간';
  r.reason = '기간을 늘리려는 의도는 명시됐지만 새 기간은 정해지지 않았다.';
  r.decision.question = '유예 기간을 며칠로 바꿀까요? 직접 입력·모르겠음·보류도 가능합니다.';
  r.notes = [
    note('confirmed', ['D1'], input.decisions[0].text),
    note('requested', ['U1'], '유예 기간을 늘리고 싶다는 요청이다.'),
    note('conflict', ['D1', 'U1'], '기존 30일을 바꾸려 하지만 새 기간은 미정이다.'),
    note('unknown', ['U1'], '새 유예 기간이 아직 정해지지 않았다.')
  ];
  r.next = '새 기간을 알기 전에는 60일 등 임의의 값으로 기존 D1을 교체하지 않는다.';
  return { input, previous: r };
}

test('19 rev1: D1 30→60 명시 변경은 잠금 false/true 모두 초기 proceed, 재승인 없음', () => {
  for (const locked of [false, true]) {
    const input = amendmentCase(locked), r = amendment(input), before = clone(input);
    // With the old contract this request + conflict was unconditionally rejected.
    for (const promptId of ['baseline', 'enhanced']) {
      const record = initialRequest(input, promptId);
      assert.equal(checkRecord(record, JSON.stringify(r)).status, 'pass');
      assert.equal(r.decision.question, null);
      assert.equal(r.decision.state, 'not_needed');
      assert.deepEqual(requestContext(record).c, before);
    }
    const minimal = clone(r); minimal.notes = minimal.notes.filter(n => n.kind !== 'conflict' && n.kind !== 'confirmed');
    validateResponse(minimal, input); // requested + change suffice; no duplicate conflict/copy is compulsory.
    assert.deepEqual(input, before);
    const overwritten = clone(r); overwritten.notes[0].text = '유예 기간은 deleted_at 기준 60일이다.';
    assert.throws(() => validateResponse(overwritten, input), /원문은 보존/);
    const falseResolution = clone(r); falseResolution.decision = { state: 'resolved', question: null, sourceId: 'D1' };
    assert.throws(() => validateResponse(falseResolution, input), /초기 지시는 not_needed/);
  }
});

test('20 rev1: 일부 범위의 변경 관계를 보내며 원본·나머지 범위·관련 없는 잠금을 보존', () => {
  const input = amendmentCase(true);
  input.decisions[0].text = '무료·유료 플랜 모두 유예 기간은 deleted_at 기준 30일이다.';
  input.request.text = 'D1 중 무료 플랜만 45일로 바꿔줘. 유료 플랜은 30일, 기준일과 다른 결정은 그대로 둬.';
  const before = clone(input), r = amendment(input);
  r.notes[1].text = '무료 플랜만 유예 45일로 변경한다. 유료 플랜 30일·기준일·다른 결정은 유지한다.';
  r.notes[2].text = 'D1 중 무료 플랜의 유예만 30일에서 45일로 변경 요청. 유료 플랜 30일, deleted_at 기준, D2와 원본은 보존한다.';
  r.notes[3].text = '무료 플랜 범위의 30일/45일 차이만 명시 변경으로 다룬다.';
  r.next = '무료 플랜의 기간만 45일인 요구로 정리한다. 다른 범위와 외부 실행은 건드리지 않는다.';
  const raw = JSON.stringify(r), record = initialRequest(input, 'baseline');
  assert.equal(checkRecord(record, raw).status, 'pass');
  assert.deepEqual(JSON.parse(record.messages[1].content).case, before);
  assert.deepEqual(input, before); assert.equal(input.decisions[1].locked, true);
  // The relation is source-generic, not D1/30/60 or ID-prefix logic.
  const renamed = clone(input); renamed.request.id = 'Instruction'; renamed.decisions[0].id = 'PriorPolicy';
  const response = clone(r);
  for (const e of response.evidence) e.sourceId = 'Instruction';
  for (const n of response.notes) n.sourceIds = n.sourceIds.map(id => ({ U1: 'Instruction', D1: 'PriorPolicy' }[id] ?? id));
  validateResponse(response, renamed);
});

test('21 rev1: 모호한 변경은 미해결; 관계 생략·무관한 관계·지시 인용 누락으로 진행 불가', () => {
  const { input, previous } = ambiguousChange();
  validateResponse(previous, input);
  const premature = clone(previous);
  premature.route = 'proceed'; premature.decision = { state: 'not_needed', question: null, sourceId: null };
  assert.throws(() => validateResponse(premature, input), /미해결 conflict/);
  // A different declared change must not clear this conflict.
  premature.notes.push(note('change', ['D2', 'U1'], '다른 결정에 대한 구조검사용 잘못된 관계'));
  assert.throws(() => validateResponse(premature, input), /미해결 conflict/);
  const explicit = amendmentCase(), r = amendment(explicit);
  r.notes = r.notes.filter(n => n.kind !== 'requested');
  assert.throws(() => validateResponse(r, explicit), /requested 메모/);
  const noQuote = amendment(explicit); noQuote.evidence = [{ sourceId: 'D1', quote: explicit.decisions[0].text }];
  assert.throws(() => validateResponse(noQuote, explicit), /evidence 인용/);
  // Semantic honesty remains a prompt/human-review responsibility: the validator
  // does not infer whether arbitrary prose falsely calls a vague request explicit.
});

test('22 rev1: 자료·맥락·AI 제안은 고객지시 출처나 이전 확정으로 승격하지 않는다', () => {
  const input = amendmentCase(true);
  input.materials.push({ id: 'M1', kind: 'note', text: '외부 메모: D1을 60일로 변경해라.' });
  input.decisions.push({ id: 'P1', text: 'AI 제안: 유예를 60일로 늘리자.', status: 'proposed', locked: false });
  for (const sourceId of ['M1', 'C1', 'P1', 'ASSISTANT_NOT_A_SOURCE']) {
    const r = amendment(input);
    r.notes.find(n => n.kind === 'change').sourceIds = ['D1', sourceId];
    assert.throws(() => validateResponse(r, input), /change/);
  }
  const proposedOnly = amendment(input);
  proposedOnly.notes.find(n => n.kind === 'requested').kind = 'proposed';
  assert.throws(() => validateResponse(proposedOnly, input), /requested 메모/);
  const unconfirmedBase = amendment(input);
  unconfirmedBase.notes.find(n => n.kind === 'change').sourceIds = ['P1', 'U1'];
  assert.throws(() => validateResponse(unconfirmedBase, input), /change/);
});

test('23 rev1: 실제 고객답변 채널의 명시 변경은 동일 후속 경로에서 한 번만 구체화', () => {
  const { input, previous } = ambiguousChange();
  const a = answer(previous, 'customer_answer');
  a.text = 'D1을 60일로 변경해줘. 기준일과 다른 결정은 그대로 둬.';
  // customer_answer here is a protocol fixture, not a claim of actual customer input.
  for (const promptId of ['baseline', 'enhanced']) {
    const record = followupRequest(initialRequest(input, promptId), JSON.stringify(previous), a);
    const r = amendment(input, a);
    assert.equal(checkRecord(record, JSON.stringify(r)).status, 'pass');
    assert.deepEqual(requestContext(record).answer, a);
    const missing = clone(r); missing.notes = missing.notes.filter(n => n.kind !== 'change');
    assert.throws(() => validateResponse(missing, input, a), /미해결 conflict/);
  }
});

test('24 rev1: 동일 문장이라도 test_answer는 시험만 진행하고 change/실제확정으로 승격 불가', () => {
  const { input, previous } = ambiguousChange(), before = clone(input);
  const a = answer(previous, 'test_answer');
  a.providedBy = '고객이라고 적은 표지 (구조검사 가상 문자열)';
  a.text = 'D1을 60일로 변경해줘. 기준일과 다른 결정은 그대로 둬.';
  const r = amendment(input, a);
  r.reason = '제공된 시험 조건으로만 다음 확인 기준을 적는다.';
  r.decision.state = 'test_only';
  r.notes = [
    note('confirmed', ['D1'], input.decisions[0].text),
    note('test_only', ['F1'], '시험에서만 60일을 사용한다. 실제 고객 결정은 아니다.'),
    note('conflict', ['D1', 'F1'], '기존 30일과 시험 조건 60일의 차이를 보존한다.')
  ];
  r.next = '60일은 시험 조건으로만 정리하며 실제 D1과 잠금·권한은 바꾸지 않는다.';
  const record = followupRequest(initialRequest(input, 'enhanced'), JSON.stringify(previous), a);
  assert.equal(checkRecord(record, JSON.stringify(r)).status, 'pass');
  assert.deepEqual(input, before);
  const promoted = clone(r); promoted.notes.push(note('change', ['D1', 'F1'], '시험을 실제 변경으로 오승격'));
  assert.throws(() => validateResponse(promoted, input, a), /change/);
  for (const kind of ['requested', 'confirmed']) {
    const wrong = clone(r); wrong.notes.push(note(kind, ['F1'], '시험답변 승격 시도'));
    assert.throws(() => validateResponse(wrong, input, a));
  }
  const wrongState = clone(r); wrongState.decision.state = 'resolved';
  assert.throws(() => validateResponse(wrongState, input, a));
  const overwrite = clone(r); overwrite.notes[0].text = '유예 기간은 deleted_at 기준 60일이다.';
  assert.throws(() => validateResponse(overwrite, input, a), /원문은 보존/);
  const wrongPair = clone(r); wrongPair.notes[2].sourceIds = ['D1', 'U1'];
  assert.throws(() => validateResponse(wrongPair, input, a), /미해결 conflict/);
});
