import type { Project, Requirement, Status } from './contracts.js';

export const STATUS_LABEL: Readonly<Record<Status, string>> = Object.freeze({
  confirmed: '확정', proposed: '제안', deferred: '보류', rejected: '제외'
});
const ORDER = ['confirmed', 'proposed', 'deferred', 'rejected'] as const;

/** Current decision view, derived on every render. Never parse AI prose into status.
 * The exact same Requirement objects supply summary groups and item cards.
 * This function does not write Project.summary, sources, versions or decisions.
 */
export function decisionSummary(state: Pick<Project, 'requirements'>) {
  const groups = ORDER.map(status => ({ status, label: STATUS_LABEL[status],
    items: state.requirements.filter(r => r.status === status) }));
  const reviewCount = state.requirements.filter(r => r.needsReview).length;
  const counts = groups.map(g => `${g.label} ${g.items.length}개`).join(' · ');
  return { groups, reviewCount,
    text: `${counts}. 제안과 보류는 확정한 요구가 아닙니다.${reviewCount ? ` 재검토가 필요한 요구 ${reviewCount}개는 아래 표시를 확인해 주세요.` : ''}` };
}

/** Origin and decision are independent. A customer's words can still be deferred. */
export function requirementOriginLabel(req: Pick<Requirement, 'origin' | 'status'>): string {
  if (req.origin === 'customer') return {
    confirmed: '고객 선택 / 확인 · 확정', proposed: '고객 발언 · 요구 해석 확인 전',
    deferred: '고객 발언 · 보류 (미확정)', rejected: '고객 결정 · 제외'
  }[req.status];
  const origin = req.origin === 'mock' ? '모의 해석' : 'AI 해석';
  const decision = { confirmed: '고객 확인', proposed: '제안 · 고객 미확정',
    deferred: '고객 보류 · 미확정', rejected: '고객 제외' }[req.status];
  return `${origin} · ${decision}`;
}
