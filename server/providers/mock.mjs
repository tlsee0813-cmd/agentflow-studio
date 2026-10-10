import { REQUIREMENT_MAX_LENGTH } from '../../dist/public/shared/contracts.js';
import { storageQuestion } from '../../dist/public/shared/project.js';
import { validateResult } from '../../dist/public/shared/validation.js';
// Explicit demo fixture only. This is NOT an LLM and has no network path.
export function mockInterview(request) {
  const knownStorage = /이 브라우저|브라우저 한 곳|여러 기기|기기 간|multi.device/i.test(request.brief.idea + request.brief.constraints);
  const todo = /할\s?일|todo|task/i.test(request.brief.idea);
  const firstSource = request.sources.find(s => s.kind === 'customer-input' && s.text === JSON.stringify(request.brief))?.id;
  const answer = request.answers.at(-1);
  let question = null;
  if (request.stage === 'discover') {
    if (todo && !knownStorage) question = storageQuestion();
    else if (!todo) question = {
      id: 'Q-core-scene', topic: 'core-scene', text: '사용자가 처음 들어와서 가장 먼저 끝내야 할 일은 무엇인가요?',
      reason: '첫 화면부터 결과까지 연결할 핵심 장면을 정하면, 나중에 붙일 기능과 구별할 수 있어요.',
      example: '예: 정보를 찾아 비교하기, 내용을 기록하고 다시 확인하기. 직접 다른 장면을 적어도 좋아요.',
      options: [
        { id: 'find', label: '필요한 정보를 찾고 비교하기', consequence: '검색에서 비교·선택까지를 중심으로 요구를 정리합니다.' },
        { id: 'record', label: '내용을 기록하고 다시 확인하기', consequence: '입력에서 보관·조회까지를 중심으로 요구를 정리합니다.' }
      ], recommendation: null
    };
  }
  const summary = todo
    ? `개인 할 일의 등록·완료 처리를 중심으로 구상을 정리했습니다.${answer ? ` 고객 답변: ${answer.text}` : ''}`
    : `입력한 아이디어를 검토용 초안으로 유지합니다.${answer ? ` 핵심 장면 답변: ${answer.text}` : ''}`;
  const coreAnswer = request.answers.find(a => a.topic === 'core-scene' && a.disposition === 'answered');
  const coreText = `첫 핵심 장면을 구현한다: ${coreAnswer?.text ?? 'TBD: 고객의 첫 행동과 결과 확인 필요'}`;
  const coreAcceptance = coreAnswer?.optionId === 'record'
    ? '내용을 입력해 보관한 뒤 다시 조회하면 입력한 내용이 표시된다.'
    : coreAnswer?.optionId === 'find' ? '사용자가 조건에 맞는 정보를 찾아 두 대상을 비교하고 선택할 수 있다.'
      : 'TBD: 핵심 장면의 입력과 관찰할 결과를 확인한다.';
  const proposals = [{ key: 'core-flow', topic: 'core-scene', kind: 'functional',
    text: todo ? '사용자는 할 일을 등록하고 완료 여부를 바꿀 수 있다.'
      : coreText.length <= REQUIREMENT_MAX_LENGTH ? coreText
        : `첫 핵심 장면: 긴 직접 답변의 세부 해석이 필요하다. 원문 ${coreAnswer.text.length}자는 출처 ${coreAnswer.sourceId}에 전체 보존되어 있다. 모의 규칙은 이를 임의로 축약하지 않는다.`,
    acceptance: todo ? '할 일 1개를 등록한 뒤 완료 처리하면 목록에서 완료 상태가 구별된다.' : coreAcceptance,
    sourceIds: [firstSource, ...(!todo && coreAnswer ? [coreAnswer.sourceId] : [])] }];
  if (knownStorage && !answer) proposals.push({ key: 'data-scope', topic: 'storage', kind: 'constraint',
    text: /여러 기기|기기 간|multi.device/i.test(request.brief.idea + request.brief.constraints)
      ? '여러 기기에서 데이터를 이어서 사용하는 것으로 이해했다. 고객 확인이 필요하다.'
      : '이 브라우저에만 보관하는 것으로 이해했다. 고객 확인이 필요하다.',
    acceptance: 'TBD: 보관 범위에 관한 고객의 해석 확인 필요.', sourceIds: [firstSource] });
  return validateResult({ projectId: request.projectId, baseVersion: request.baseVersion, requestId: request.requestId,
    summary, question, proposals,
    ideas: todo ? [{ text: '완료된 할 일 접어 두기', problem: '완료 항목이 쌓이면 남은 일을 찾기 어렵습니다.',
      effect: '남은 작업을 빠르게 확인할 수 있습니다.', placement: 'future' }] : [],
    openItems: ['예외·취소·복구 흐름의 구체적인 완료 조건은 추가 확인이 필요합니다.',
      ...(request.brief.constraints ? ['입력된 제약의 해석과 측정 조건을 확인해야 합니다.'] : ['일정·예산·평가 조건은 아직 제공되지 않았습니다.'])]
  }, request);
}
