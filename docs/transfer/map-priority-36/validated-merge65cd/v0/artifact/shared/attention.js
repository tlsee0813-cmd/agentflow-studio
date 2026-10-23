import { areaOf, isReturnTask, taskStatus, areaDescription, questionAnswered, questionApplicability } from './domain.js';
import { descendantAreas } from './hierarchy.js';
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
/** Self and active descendants, each question owned once by its real area/task. Relations do not duplicate signals. */
export function subtreeSignals(p, id) {
    const root = p.space.areas.find(a => a.id === id);
    if (!root)
        return [];
    const items = checkItems(p), seen = new Set();
    return [root, ...descendantAreas(p, id)].filter(a => !a.archived).map(a => {
        const own = items.filter(it => it.areaId === a.id), questions = [];
        // taskStatus is a work-view label: export/arrival can take precedence over a question there. A recorded question
        // keeps its own applicability and owner here even after exporting. This read-only projection creates no new task.
        for (const task of p.tasks) {
            if (isReturnTask(p, task) || !task.advice?.question || areaOf(p, task) !== a.id)
                continue;
            const sources = task.sourceIds.flatMap(id => { const s = p.sources.find(s => s.id === id); return s ? [s] : []; }), trial = sources.filter(s => s.kind === 'test_answer');
            // Exact reply provenance can preserve the original real-request question, but never a different question from
            // test-context reorganisation. Same-text questions share the existing task+text identity; no generation time is inferred.
            const syntheticReply = trial.length > 0 && sources[0]?.kind === 'request' && trial.every(s => s.replyTo === task.advice.question.text);
            if (trial.length && !syntheticReply)
                continue;
            const key = `${a.id}:${task.id}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            const applicability = questionApplicability(p, task), answered = questionAnswered(p, task), status = syntheticReply ? '시험 답변 기록 · 실제 답변 아님' : answered ? '답변 기록 있음' : applicability === 'active' ? (task.advice.question.kind === 'fact' ? '사실 확인 항목 있음' : '제품 선택 항목 있음') : '이전 질문 · 참고 기록';
            questions.push({ kind: 'decision', taskId: task.id, returnId: null, areaId: a.id, status, answered, applicability });
        }
        const d = areaDescription(p, a.id);
        return { areaId: a.id, questions, reports: own.filter(it => it.kind === 'report'), description: { current: d.current, held: d.held } };
    });
}
export function readingReasons(p, id, received) {
    const signals = subtreeSignals(p, id), questions = signals.flatMap(s => s.questions);
    const present = { 'open-question': questions.some(q => q.applicability === 'active' && !q.answered),
        held: signals.some(s => s.description.held.length > 0), stale: signals.some(s => !!s.description.current && !s.description.current.valid),
        updated: signals.some(s => received.has(s.areaId)) };
    const reasons = ['open-question', 'held', 'stale', 'updated'].filter(k => present[k]);
    return { reasons, records: reasons.length > 0 || questions.length > 0 || signals.some(s => !!s.description.current || s.reports.length > 0) };
}
