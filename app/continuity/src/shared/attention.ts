import type { Project, Task } from './types.js';
import { areaOf, isReturnTask, taskStatus } from './domain.js';
/* SPATIAL102: the project's "확인할 일" — a read-only list computed from existing records, never stored.
 * Only two states with evidence in the record are counted; no completion rate, no guess about external tools. */
export type CheckItem = {
  kind: 'decision' | 'report';
  /** The request (or earlier return) the item belongs to; the read-only task screen opens this. */
  taskId: string;
  /** For a report: the return that arrived. */
  returnId: string | null;
  areaId: string | null;
  status: string;
};
const DECISION = new Set(['사실 확인 항목 있음', '제품 선택 항목 있음']);
const childOf = (p: Project, id: string) => p.tasks.filter(x => x.parentTaskId === id);
/** The user request a task belongs to (a return follows its parent; a follow-up return can return to a return). */
function rootRequest(p: Project, t: Task): Task {
  const seen = new Set<string>(); let cur = t;
  while (isReturnTask(p, cur) && cur.parentTaskId && !seen.has(cur.id)) {
    seen.add(cur.id); const up = p.tasks.find(x => x.id === cur.parentTaskId); if (!up) break; cur = up;
  }
  return cur;
}
/** A return the user has not acted on yet: nothing continues from it and no follow-up handoff was exported from it. */
const untouched = (p: Project, r: Task) => !r.handoffs.length && !childOf(p, r.id).length;
export function checkItems(p: Project): CheckItem[] {
  const out: CheckItem[] = [];
  for (const t of [...p.tasks].reverse()) {
    const status = taskStatus(p, t);
    if (status === '시험 문맥 · 실제 요구 아님') continue;
    // Only the latest return of a task counts; an older report is covered by the newer one.
    const latest = childOf(p, t.id).filter(x => isReturnTask(p, x)).at(-1);
    if (latest && untouched(p, latest)) {
      const kind = p.sources.find(s => s.id === latest.sourceIds[0])?.kind;
      out.push({kind: 'report', taskId: rootRequest(p, t).id, returnId: latest.id, areaId: areaOf(p, t),
        status: kind === 'evidence' ? '관찰·검사 자료 있음 · 앱 미검증' : '구현 보고 도착 · 앱 미검증'});
    }
    // The existing status rule decides an open question; a request the user already continued from is not waiting.
    if (!isReturnTask(p, t) && DECISION.has(status) && !childOf(p, t.id).some(x => !isReturnTask(p, x)))
      out.push({kind: 'decision', taskId: t.id, returnId: null, areaId: areaOf(p, t), status});
  }
  return out;
}
