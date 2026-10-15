import { areaOf, isReturnTask, taskStatus } from './domain.js';
const DECISION = new Set(['사실 확인 항목 있음', '제품 선택 항목 있음']);
const childOf = (p, id) => p.tasks.filter(x => x.parentTaskId === id);
/** The user request a task belongs to (a return follows its parent; a follow-up return can return to a return). */
export function rootRequest(p, t) {
    const seen = new Set();
    let cur = t;
    while (isReturnTask(p, cur) && cur.parentTaskId && !seen.has(cur.id)) {
        seen.add(cur.id);
        const up = p.tasks.find(x => x.id === cur.parentTaskId);
        if (!up)
            break;
        cur = up;
    }
    return cur;
}
/** SPATIAL102-R1: the return a check item points to, only while it is still a return of that request (directly or
 * through follow-up handoffs). A missing id, a non-return or another request's return gives null: never another report. */
export function pointedReturn(p, taskId, returnId) {
    const r = p.tasks.find(x => x.id === returnId);
    return r && isReturnTask(p, r) && rootRequest(p, r).id === taskId ? r : null;
}
/** The chain from the request to that return (request, earlier returns, the return), for where-it-belongs on screen. */
export function returnPath(p, r) {
    const path = [r], seen = new Set([r.id]);
    let cur = r;
    while (isReturnTask(p, cur) && cur.parentTaskId && !seen.has(cur.parentTaskId)) {
        const up = p.tasks.find(x => x.id === cur.parentTaskId);
        if (!up)
            break;
        path.unshift(up);
        seen.add(up.id);
        cur = up;
    }
    return path;
}
/** A return the user has not acted on yet: nothing continues from it and no follow-up handoff was exported from it. */
const untouched = (p, r) => !r.handoffs.length && !childOf(p, r.id).length;
export function checkItems(p) {
    const out = [];
    for (const t of [...p.tasks].reverse()) {
        const status = taskStatus(p, t);
        if (status === '시험 문맥 · 실제 요구 아님')
            continue;
        // Only the latest return of a task counts; an older report is covered by the newer one.
        const latest = childOf(p, t.id).filter(x => isReturnTask(p, x)).at(-1);
        if (latest && untouched(p, latest)) {
            const kind = p.sources.find(s => s.id === latest.sourceIds[0])?.kind;
            out.push({ kind: 'report', taskId: rootRequest(p, t).id, returnId: latest.id, areaId: areaOf(p, t),
                status: kind === 'evidence' ? '관찰·검사 자료 있음 · 앱 미검증' : '구현 보고 도착 · 앱 미검증' });
        }
        // The existing status rule decides an open question; a request the user already continued from is not waiting.
        if (!isReturnTask(p, t) && DECISION.has(status) && !childOf(p, t.id).some(x => !isReturnTask(p, x)))
            out.push({ kind: 'decision', taskId: t.id, returnId: null, areaId: areaOf(p, t), status });
    }
    return out;
}
