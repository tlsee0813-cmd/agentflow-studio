import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJSON, write } from './transport.mjs';
const read = path => existsSync(path) ? readFileSync(path, 'utf8') : '(관찰되지 않음)';
const sections = parts => parts.join('\n\n').replace(/\|\n\n(?=\|)/g, '|\n');
export function fence(value, language = '') {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const marks = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map(x => x[0].length + 1)));
  return `${marks}${language}\n${text}\n${marks}`;
}
export function traceContext(c, before, request, after, providerText, handoff) {
  let body = null; try { body = JSON.parse(providerText); } catch { /* no upstream request */ }
  const sent = body?.messages?.map(m => m.content).join('\n') ?? '';
  const advice = after.tasks.find(t => t.id === request.ticket.taskId)?.advice;
  return {
    meaningReview: 'NOT_PERFORMED', note: '문자열 위치 관찰만. 미출현은 의미상 미전달/미준수의 증명이 아니다. previousWork 재진술과 부정문을 사람이 읽어야 한다.',
    bases: before.bases.map(b => ({ id: b.id, status: b.status, historyCount: b.history.length,
      localText: b.text, sentText: request.bases.find(x => x.id === b.id)?.text ?? null,
      partial: request.bases.find(x => x.id === b.id)?.partial ?? null })),
    probes: c.probes.map(probe => ({ ...probe,
      localBasisIds: before.bases.filter(b => b.text.includes(probe.literal)).map(b => b.id),
      sentBasisIds: request.bases.filter(b => b.text.includes(probe.literal)).map(b => b.id),
      sentSourceIds: request.sources.filter(s => s.text.includes(probe.literal)).map(s => s.id),
      literalInPreviousWork: JSON.stringify(request.previousWork).includes(probe.literal),
      literalInProviderMessages: sent.includes(probe.literal),
      literalInAdvice: JSON.stringify(advice ?? null).includes(probe.literal),
      literalInHandoff: handoff.includes(probe.literal),
    })),
  };
}
export function renderTurn(dir, c, result, trace, record = write) {
  let messages = '(제공업체로 전송되지 않음)';
  const providerFile = join(dir, 'request-provider.raw.json');
  if (existsSync(providerFile)) {
    const body = readJSON(providerFile);
    messages = body.messages.map(m => `### ${m.role}\n\n${fence(m.content)}`).join('\n\n');
  }
  const lines = [`# ${c.id} / ${result.turn} — ${result.stageId}`, `모드: **${result.mode === 'mock' ? '전송 대역 mock · 실모델 아님' : '실제 DeepSeek 경로'}**. 모든 고객·결과 보고·답변은 합성이다.`,
    `앱 반영: ${result.accepted ? '형식 검증 후 반영' : '실패 / 미반영'}; 오류: ${result.error ?? '없음'}. JSON 통과는 고객 효용 판정이 아니다.`,
    '## 수행한 고객 동작', fence(result.action),
    '## 실제 전송 문맥', 'provider가 만든 본문을 그대로 관찰했다. 정답·시나리오 허용 답변 목록은 전송하지 않았다. Authorization 및 응답 헤더는 기록하지 않는다.', messages,
    '## 제공업체 응답 관찰 기록',
    'EXPERIMENT_SECRET_ECHO는 제품 provider 오류와 구별되는 실험 관측 경계의 보호 오류다. 해당 응답은 receive 전에 차단하며 다음 단계/사례도 멈춘다. 민감 반향은 raw 파일에서도 전체 표식으로 숨기므로 바이트 완전 원문이 아니다. 응답을 고쳐 성공 처리하지 않는다.', '[외부 응답 관찰 기록](response-provider.raw.txt) · [앱 응답](response-app.raw.json) · [전송 메타데이터](transport.json)',
    'assistant content (의미 수정·코드펜스 제거·JSON 수리 없음; 민감 반향은 기록에서 숨김):', fence(read(join(dir, 'assistant.raw.txt'))),
    '## 제약 위치 — 자동 합격 판정 아님', fence(trace.probes, 'json'),
    '문자열이 안 보이면 동의어·요약 여부도 읽는다. 오래된 요청의 발췌 손실과 전달받은 조건의 모델 미반영을 구분한다.',
    '<details><summary>로컬 기준 전문 대 실제 전송 기준 (R2 추적)</summary>', fence(trace.bases, 'json'), '</details>',
    '## 최종 작업문 — 앱 handoffText 그대로', result.accepted ? '실행되거나 사용자 검증된 결과가 아니다.' : 'AI 실패 후 앱에 남은 원문/기본 안내다. 유효한 AI 작업문으로 평가하지 않는다.',
    fence(read(join(dir, 'handoff.md'))),
    '## 사람의 품질 관찰', ...c.observe.map(s => `- ${s}`), '자동 품질 점수 없음. 중요한 미정 값을 임의 확정·삭제·보류한 경우는 질문이 적어도 실패 사례로 기록한다.'];
  record(join(dir, 'review.md'), lines.join('\n\n'));
}
// Standalone report reads already protected records and does not obtain a credential.
export function renderRun(root, record = write) {
  const run = readJSON(join(root, 'run.json'));
  const lines = ['# IDEA016 — 고객 흐름 회수', `모드: **${run.mode}** / 합성고객 / 실제 사용자 조사 아님`,
    'mock은 도구 연결 검사만이며 baseline 품질 결과가 아니다. complete는 계획된 입력의 처리 상태일 뿐 고객 효용 합격이 아니다.',
    '질문에 답할 수 없으면 해당 사례를 중단해 둔다. provider 실패·중단된 inflight는 자동 재시도하지 않는다.',
    '| 사례 | 진행 상태 | 앱 요청 수 | 실제 외부 dispatch 수 | 자료 |', '|---|---|---:|---:|---|'];
  let requests = 0, real = 0;
  for (const id of run.caseIds) {
    const dir = join(root, id);
    if (!existsSync(join(dir, 'checkpoint.json'))) { lines.push(`| ${id} | not_started | 0 | 0 | 배치 중단 |`); continue; }
    const checkpoint = readJSON(join(dir, 'checkpoint.json')), c = readJSON(join(dir, 'case.json'));
    const turns = readdirSync(dir).filter(n => /^turn-\d+$/.test(n)).sort();
    let realCalls = 0;
    const body = [`# ${c.id} — ${c.title}`, c.purpose, `상태: **${checkpoint.phase}** / 품질: **미검토**`,
      '이 파일은 결과 색인이다. 각 회차 review.md에 실제 전송 문맥·응답·작업문이 함께 있다.',
      '| 회차 | 계획 단계 | 앱 반영 | 질문/오류 | 읽을 자료 |', '|---|---|---|---|---|'];
    for (const turn of turns) {
      const tdir = join(dir, turn);
      if (existsSync(join(tdir, 'transport.json'))) realCalls += readJSON(join(tdir, 'transport.json')).realDispatches;
      if (!existsSync(join(tdir, 'result.json'))) { body.push(`| ${turn} | 중단됨 | 미확인 | 재전송 금지 | 원본 보존 |`); continue; }
      const r = readJSON(join(tdir, 'result.json'));
      body.push(`| ${turn} | ${r.stageId} | ${r.accepted ? '반영' : '미반영'} | ${r.error ?? (r.question ? '질문 있음 (원문 확인)' : '없음')} | [흐름 전문](${turn}/review.md) |`);
    }
    body.push('\n## 관찰 기준', ...c.observe.map(s => `- ${s}`), '\n[마지막 작업문](final-handoff.md) · [최종 앱 상태](project-final.json)');
    if (checkpoint.phase === 'awaiting-answer') body.push('실제 질문은 마지막 회차의 pending-question.json에 있다. answer.template.json의 정확한 질문에 대해 허용 factIds만 선택한다. 답을 만들 수 없으면 그대로 미응답으로 둔다.');
    if (checkpoint.phase === 'budget-ended') body.push('최대 3회에 도달해 나머지 단계/질문을 실행하지 않았다. 완료·합격으로 해석하지 않는다.');
    record(join(dir, 'report.md'), sections(body), { replace: true });
    if (!existsSync(join(dir, 'human-review.md'))) record(join(dir, 'human-review.md'), `# ${id} 사람의 관찰 (미작성)\n\n판정: 미검토\n\n처음 바로 쓸 수 있었던 작업문과 근거 회차:\n\n불필요한 질문/사용자 수고 또는 위험한 생략:\n\n중요 조건의 보존·변경·보고 구분과 원문 근거:\n\n실패 원인: 입력 부족 / 전송 전 문맥 손실 / 받은 문맥 미반영 / 형식·전송 실패 / 미판정\n\n자동 점수 없음. 의미상 제약 전달 여부는 provider 문맥을 직접 읽어 확인한다.\n`);
    requests += checkpoint.turnCount; real += realCalls;
    lines.push(`| ${id} | ${checkpoint.phase} | ${checkpoint.turnCount} | ${realCalls} | [사례 보고서](${id}/report.md) |`);
  }
  lines.push(`기록된 앱 요청 ${requests}회 / 전송 메타데이터로 확인되는 실제 외부 dispatch ${real}회. inflight나 메타데이터 미기록 중단은 실제 호출 여부 미확인이며 0회라고 단정하지 않는다.`,
    '실제 모델의 반환 model·usage·finish_reason·실패 상태는 회차 transport.json/response-provider.raw.txt를 따른다. 가격 계산 없음. 고객 서비스의 구현·테스트를 여기서 실행하지 않는다.');
  record(join(root, 'REPORT.md'), sections(lines), { replace: true });
  return { mode: run.mode, appRequests: requests, observedRealDispatches: real, report: join(root, 'REPORT.md') };
}
