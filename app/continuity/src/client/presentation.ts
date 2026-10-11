/** UI-only projections. No stored fields, state transitions, provider guesses or execution status. */
import type { Project, Task, Source, Basis } from '../shared/types.js';
import { currentWork, questionAnswered, handoffText } from '../shared/domain.js';
import { digest } from '../shared/validation.js';

export const sourceName: Record<Source['kind'], string> = {
  request: '요청 원문', report: '구현자 보고 · 미검증', evidence: '관찰·검사 자료 · 미검증',
  answer: '사용자 답변', manual_decision: '사용자 기록', test_answer: '합성 시험자료 · 실제 요구 아님'
};
export function sourceOf(p: Project, t: Task): Source | undefined {
  return p.sources.find(s => s.id === t.sourceIds[0]);
}
export function shortText(text: string, length = 68): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > length ? `${line.slice(0, length)}…` : line;
}
export function taskTitle(p: Project, t: Task): string {
  return shortText(sourceOf(p, t)?.text ?? '원문이 보존된 작업');
}
export function dateLabel(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? '시각 미확인' : new Intl.DateTimeFormat('ko-KR', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
}
export function basisDraftChanged(p: Project, b: Basis): boolean {
  return p.basisEdits[b.id] !== undefined && p.basisEdits[b.id] !== b.text;
}
/** An export record is evidence of copying/saving, never of a running/completed task. */
export function exportNeedsRefresh(p: Project, t: Task): boolean {
  const last = t.handoffs.at(-1);
  if (!last) return false;
  if (!last.work) return true; // Legacy exports have no comparable current-format snapshot.
  // Compare the complete delivered text (including suggestions), not just the four work fields.
  // Pin only the header revision: export bookkeeping and unsubmitted drafts change p.revision
  // without changing the handoff content. This shallow view never rewrites the saved project.
  const current = handoffText({ ...p, revision: last.revision }, t.id);
  return current.length !== last.chars || digest(current) !== last.digest;
}
export interface Stage {
  kind: 'empty' | 'pending' | 'question' | 'stale' | 'saved' | 'ready' | 'exported';
  title: string; label: string; next: string; step: 1 | 2 | 3;
}
export function stageOf(p: Project, t: Task | null): Stage {
  if (!t) return { kind: 'empty', title: '아이디어에서, 첫 작업으로.', label: '시작하기', next: '만들고 싶은 것 또는 바꾸고 싶은 것을 적어 주세요.', step: 1 };
  if (p.pending?.taskId === t.id) return { kind: 'pending', title: '작업 문맥을 정리하고 있어요.', label: '정리 응답 대기', next: '요청 원문은 보관했습니다. 개발 작업을 실행하는 단계는 아닙니다.', step: 1 };
  if (t.advice?.question && !questionAnswered(p, t)) return { kind: 'question', title: '이 한 가지만 알려주세요.', label: '답변이 필요해요', next: '답에 따라 달라지는 부분만 확인하고, 작업문으로 이어갑니다.', step: 1 };
  const w = currentWork(p, t);
  if (w.aiStale) return { kind: 'stale', title: '바뀐 기준으로 이어가세요.', label: '기준 변경됨', next: '이전 AI 문구는 제외했습니다. 직접 다듬거나 이 입력만 다시 정리할 수 있어요.', step: 2 };
  if (!t.advice && !Object.values(t.manual).some(v => v?.trim())) return { kind: 'saved', title: '요청 원문은 남아 있어요.', label: '원문 보관됨', next: '다시 정리하거나, 아래에서 작업문을 직접 작성하세요.', step: 1 };
  if (t.handoffs.length && !exportNeedsRefresh(p, t)) return { kind: 'exported', title: '돌아온 결과에서 이어가세요.', label: '작업문 내보냄', next: '사용 중인 도구에 작업문을 전달한 뒤, 받은 결과를 여기에 붙여넣으세요.', step: 3 };
  const returned = ['report', 'evidence'].includes(sourceOf(p, t)?.kind ?? '');
  return { kind: 'ready', title: returned ? '보고를 다음 작업으로 이었어요.' : '이제, 작업문을 전달하세요.', label: t.handoffs.length ? '내보낸 뒤 수정됨' : '작업문 준비됨', next: returned ? '아래는 가져온 자료를 바탕으로 한 후속 제안입니다. 구현 완료 판정은 아닙니다.' : '필요하면 직접 다듬고, 사용 중인 개발 도구에 복사해 전달하세요.', step: 2 };
}

export function workOrigin(t: Task): string {
  const manual = Object.values(t.manual).some(v => v !== null) || t.suggestions !== null;
  if (!t.mode) return manual ? '사용자 직접 작성' : '입력 원문 보존';
  return t.mode === 'mock' ? (manual ? '모의 제안 · 직접 수정 포함' : '모의 제안 · 규칙 기반')
    : (manual ? 'AI 제안 · 직접 수정 포함' : 'AI 제안 · 사용자 미확정');
}
