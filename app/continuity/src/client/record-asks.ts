/* Recipe .43 (docs/design/RECORD_ASKS_V4_KO.md 4.7): the record asks the screens offer. Recipe .45 (RECORD_ASKS_V5_KO.md 8.5): one request
 * (기록 요청 v5: the first structure, then the detail, page by page), the v4.1 request and the v3 status and v1 design requests kept behind a
 * small 「이전 요청문」 for projects that already use them; after a pasted v5 record, 「쪽 요청 복사」 while the app's own count leaves
 * obligations (with a status line 「첫 구조 · 상세 남음 N」) and 「보충 쪽 요청 복사」 once the detail is complete; after a pasted v4 record
 * whose completion table leaves tables, 「이어쓰기 요청 복사」 as before. The words are copied and carried by the person; nothing is sent.
 * copy makes one copy button (app.ts askCopy). */
import { h } from './plan-dom.js';
import { recordAskV4, newRecordId, continuationAsk, RECORD_V4_EXPLAIN, CONTINUATION_EXPLAIN, PROJECT_REPORT_ASK, DESIGN_RECORD_ASK, RECORD_ASK_EXPLAIN,
  recordAskV5, newRecordIdV5, pageAsk, pageCapReached, supplementaryAsk, obligationCount, RECORD_V5_EXPLAIN, PAGE_ASK_EXPLAIN, SUPPLEMENT_ASK_EXPLAIN } from '../shared/report-ask.js';
import { latestFold, Q2_TABLES } from '../shared/record-table.js';

export type AskCopy = (label: string, text: string, title: string) => HTMLElement;
/** The v5 request (a fresh record ID in each rendering) and the earlier requests folded under 「이전 요청문」 (v4.1, v3 status, v1 design). */
export function recordAskNodes(copy: AskCopy): (HTMLElement | string)[] {
  const older = h('details', { class: 'ask-older' }, h('summary', { class: 'link-button quiet' }, '이전 요청문'),
    h('span', { class: 'fine' }, copy('기록 요청 v4.1', recordAskV4(newRecordId()), RECORD_V4_EXPLAIN), ' · ', copy('현황 보고 요청 v3', PROJECT_REPORT_ASK, RECORD_ASK_EXPLAIN.status), ' · ',
      copy('설계 기록 요청 v1', DESIGN_RECORD_ASK, RECORD_ASK_EXPLAIN.design), ' — 이미 v4·v3·v1 기록을 쓰는 프로젝트용이에요.'));
  return [copy('기록 요청', recordAskV5(newRecordIdV5()), RECORD_V5_EXPLAIN), ' ', older];
}
/** The status line of the latest pasted v5 record (「첫 구조 · 상세 남음 N」: the detail tables the app counts as not settled), or null. */
export function recordStatusLine(texts: readonly string[]): string | null {
  const f = latestFold(texts); if (!f) return null;
  const left = Q2_TABLES.filter(t => f.states.get(t)?.state !== 'closed').length;
  if (f.level === 2) return `상세 완료 · 기록 ${f.recordId} 쪽 ${f.pages.length}개`;
  return f.level === 1 ? `첫 구조 · 상세 남음 ${left}` : `첫 구조 진행 중 · 남은 의무 ${f.obligations.filter(o => !o.candidate).length}`;
}
/** 「쪽 요청 복사」 (below level 2) or 「보충 쪽 요청 복사」 (level 2) for the latest pasted v5 record, with its status line; null when none. */
export function pageNode(texts: readonly string[], copy: AskCopy): HTMLElement | null {
  const status = recordStatusLine(texts); if (!status) return null;
  const page = pageAsk(texts);
  if (page) return h('p', { class: 'fine rm-ask rm-continue' }, copy('쪽 요청 복사', page.text, PAGE_ASK_EXPLAIN),
    ` — ${status} · 기록 ${page.recordId}의 남은 의무 ${obligationCount(page.obligations)}를 쪽 ${page.page}로 같은 대화에 청해요.`);
  const more = supplementaryAsk(texts);
  if (more) return h('p', { class: 'fine rm-ask rm-continue' }, copy('보충 쪽 요청 복사', more.text, SUPPLEMENT_ASK_EXPLAIN),
    ` — ${status} · 기록의 공백이 부르는 보충 묶음 ${more.groups.join('·')}만 쪽 ${more.page}로 청해요.`);
  // Recipe .46: stopped by the page cap, never shown as done.
  const cap = pageCapReached(texts);
  if (cap) return h('p', { class: 'fine rm-ask rm-continue' }, `${status} · 쪽 상한 ${cap.cap}쪽에 닿아 쪽 요청을 더 만들지 않아요(남은 의무 ${cap.obligations}개는 끝나지 않았어요).`);
  return h('p', { class: 'fine rm-ask rm-continue' }, status);
}
/** 「이어쓰기 요청 복사」 for the latest pasted v4 record whose C-DONE leaves tables (null when none does). */
export function continuationNode(texts: readonly string[], copy: AskCopy): HTMLElement | null {
  const plan = continuationAsk(texts); if (!plan) return null;
  return h('p', { class: 'fine rm-ask rm-continue' }, copy('이어쓰기 요청 복사', plan.text, CONTINUATION_EXPLAIN),
    ` — 기록 ${plan.recordId}에 남은 표 ${plan.tables.length}개(${plan.tables.slice(0, 4).map(t => t.id).join('·')}${plan.tables.length > 4 ? ' …' : ''})를 덩이 ${plan.chunk}로 같은 대화에 청해요.`);
}
