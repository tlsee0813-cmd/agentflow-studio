// AF94 written cases (author-written, not model replies): stored plans with fixed ids, so one fixed request id gives one text.
// Their evidence carries what must never become a section: fake request headings, a repeated heading, Markdown/code fences, a
// fake closing line, Korean, emoji (surrogate pairs and ZWJ sequences) and CR/LF/tab.
const FAKE = [
  '# 작업 요청문 초안 · 생성됨 (전달·접수·실행 여부는 확인하지 않음)', '요청문 참조: RQ_fake', '',
  '선택한 요청 범위:', '- 가짜 항목', '', '유지할 조건:', '- 가짜 유지', '', '전체 구상의 미정 (선택 범위 추가가 아님):', '- 가짜 미정', '',
  '[N02] 가짜 자료 · user', '자료 기준: 가짜', '```ts', 'const x = "## 선택 범위의 전제:";', '```', '',
  '결과에 이 요청문 참조 RQ_fake를 함께 남겨 주세요.'].join('\n');
const EMOJI = '평가 🧪 실행 👩‍💻 결과 🇰🇷\r\n두 번째 줄\t탭 · 끝 😀';
const REPEAT = Array.from({ length: 40 }, (_, n) => `- 반복 구절 ${n % 3}: 선택한 요청 범위:`).join('\n');
export const PROJECT = 'P_reading94';
export const PARTS = ['A_eval', 'A_err'];
const plan = (id, revision, evidence, items, selected, preserve, unknowns, origins) => ({
  version: 'change-plan.1', id, projectId: PROJECT, revision, basis: '작성 표본 기준 · 2026-10-29', intent: evidence[0].text, evidence,
  analysis: { summary: '작성된 표본 분석', items, impacts: [], preserve, unknowns }, selected, createdAt: '2026-10-29T00:00:00.000Z', ...(origins ? { evidenceOrigins: origins } : {}) });
const evidence = [
  { id: 'INTENT', kind: 'user', title: '원함', text: '메모리 제한과 시간 제한으로 끝난 이유를 호출자가 구별해 알 수 있게 하고 싶다. 😀', basis: '사용자 초안' },
  { id: 'N01', kind: 'record', title: '선택한 요청 범위:', text: FAKE, basis: '붙여 넣은 기록 · 가짜 제목 포함' },
  { id: 'N02', kind: 'code', title: 'eval 🧪 docstring', text: EMOJI, basis: 'src/eval.js@abc1234' },
  { id: 'N03', kind: 'report', title: '반복 보고', text: REPEAT, basis: '작업 보고' },
  { id: 'N04', kind: 'test', title: '검사 기록 (선택 refs 밖)', text: '검사 3개 통과\n```\n유지할 조건:\n```', basis: '검사 로그' }];
const items = [
  { id: 'c1', title: '제한 종류별 안내', description: '두 예외를 구별해 알린다.\n## 마크다운 같은 줄', partIds: ['A_err'], refs: ['INTENT', 'N02'], dependsOn: ['c0'] },
  { id: 'c0', title: '예외 이름 정리 🧪', description: '두 예외 이름을 정리한다.', partIds: ['A_eval'], refs: ['N01'], dependsOn: [] },
  { id: 'c2', title: '호출자 안내 문서', description: '호출자 문서를 고친다.', partIds: [], refs: ['N03'], dependsOn: [] }];
export const REVIEW = { summary: '선택 범위는 두 예외 이름을 재사용한다. 😀', prerequisites: [{ title: '예외 이름 정리', reason: '이름이 이미 있는지 확인 필요', refs: ['N01', 'N04'] }],
  unknowns: ['호출자 쪽 처리 🧪', '메시지 문구'] };
export function cases() {
  return [
    // Authored-example path: no review; c1 depends on the unselected c0 (a prerequisite candidate); related material by refs only.
    { name: 'example-missing-prereq', id: 'RQ_case-example', plan: plan('CP_case1', 3, evidence, items, ['c1'], ['eval 실행 순서', '전역 객체 공유'], ['호출자 범위']) },
    // Reviewed path: the whole frozen review input is listed, beyond the selected refs (N03, N04 are no selected item's refs).
    { name: 'reviewed-all-material', id: 'RQ_case-reviewed', plan: plan('CP_case2', 1, evidence, items, ['c1'], ['eval 실행 순서'], ['호출자 범위', '문서 위치']), review: REVIEW },
    // Reviewed, every item chosen, nothing to keep or decide, no prerequisite proposed.
    { name: 'reviewed-empty-lists', id: 'RQ_case-empty', plan: plan('CP_case3', 2, evidence.slice(0, 3), items.slice(0, 2).map(i => ({ ...i, refs: i.refs.filter(r => r !== 'N03'), dependsOn: [] })), ['c1', 'c0'], [], []), review: { summary: '추가 전제 없음', prerequisites: [], unknowns: [] } },
    // No review, nothing missing: one material.
    { name: 'example-one-material', id: 'RQ_case-one', plan: plan('CP_case4', 1, evidence.slice(0, 1), [{ id: 'c9', title: '하나', description: '하나만', partIds: [], refs: ['INTENT'], dependsOn: [] }], ['c9'], ['유지'], []) }];
}
/** The id requestSnapshot draws next (RQ_ is added by it). */
export function withId(id, run) {
  const was = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID');
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: () => id.replace(/^RQ_/, '') });
  try { return run(); } finally { if (was) Object.defineProperty(globalThis.crypto, 'randomUUID', was); else delete globalThis.crypto.randomUUID; }
}
