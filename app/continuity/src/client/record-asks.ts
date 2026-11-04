/* Recipe .43 (docs/design/RECORD_ASKS_V4_KO.md 4.7): the record asks the screens offer. One request (기록 요청 v4.1: current state and design,
 * answered in two chunks), the v3 status and v1 design requests kept behind a small 「이전 요청문」 for projects that already use them, and,
 * after a pasted v4 record whose completion table leaves tables, 「이어쓰기 요청 복사」 for the same session. The words are copied and
 * carried by the person; nothing is sent. copy makes one copy button (app.ts askCopy). */
import { h } from './plan-dom.js';
import { recordAskV4, newRecordId, continuationAsk, RECORD_V4_EXPLAIN, CONTINUATION_EXPLAIN, PROJECT_REPORT_ASK, DESIGN_RECORD_ASK, RECORD_ASK_EXPLAIN } from '../shared/report-ask.js';

export type AskCopy = (label: string, text: string, title: string) => HTMLElement;
/** The v4 request (a fresh record ID in each rendering) and the earlier requests folded under 「이전 요청문」. */
export function recordAskNodes(copy: AskCopy): (HTMLElement | string)[] {
  const older = h('details', { class: 'ask-older' }, h('summary', { class: 'link-button quiet' }, '이전 요청문'),
    h('span', { class: 'fine' }, copy('현황 보고 요청 v3', PROJECT_REPORT_ASK, RECORD_ASK_EXPLAIN.status), ' · ', copy('설계 기록 요청 v1', DESIGN_RECORD_ASK, RECORD_ASK_EXPLAIN.design),
      ' — 이미 v3·v1 기록을 쓰는 프로젝트용이에요.'));
  return [copy('기록 요청', recordAskV4(newRecordId()), RECORD_V4_EXPLAIN), ' ', older];
}
/** 「이어쓰기 요청 복사」 for the latest pasted v4 record whose C-DONE leaves tables (null when none does). */
export function continuationNode(texts: readonly string[], copy: AskCopy): HTMLElement | null {
  const plan = continuationAsk(texts); if (!plan) return null;
  return h('p', { class: 'fine rm-ask rm-continue' }, copy('이어쓰기 요청 복사', plan.text, CONTINUATION_EXPLAIN),
    ` — 기록 ${plan.recordId}에 남은 표 ${plan.tables.length}개(${plan.tables.slice(0, 4).map(t => t.id).join('·')}${plan.tables.length > 4 ? ' …' : ''})를 덩이 ${plan.chunk}로 같은 대화에 청해요.`);
}
