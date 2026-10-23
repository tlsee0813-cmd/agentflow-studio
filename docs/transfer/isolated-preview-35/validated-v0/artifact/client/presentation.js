import { currentWork, questionApplicability, handoffText, returnTargetId } from '../shared/domain.js';
import { digest, parseResultFile } from '../shared/validation.js';
export const sourceName = {
    request: '요청 원문', report: '구현자 보고 · 미검증', evidence: '관찰·검사 자료 · 미검증',
    answer: '사용자 답변', manual_decision: '사용자 기록', test_answer: '합성 시험자료 · 실제 요구 아님'
};
export function sourceOf(p, t) {
    return p.sources.find(s => s.id === t.sourceIds[0]);
}
export function shortText(text, length = 68) {
    const line = text.replace(/\s+/g, ' ').trim();
    return line.length > length ? `${line.slice(0, length)}…` : line;
}
export function taskTitle(p, t) {
    if (t.resultFile)
        return shortText(parseResultFile(t.resultFile.rawText).report);
    return shortText(sourceOf(p, t)?.text ?? '원문이 보존된 작업');
}
export function dateLabel(at) {
    const date = new Date(at);
    return Number.isNaN(date.getTime()) ? '시각 미확인' : new Intl.DateTimeFormat('ko-KR', {
        month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
}
export function basisDraftChanged(p, b) {
    return p.basisEdits[b.id] !== undefined && p.basisEdits[b.id] !== b.text;
}
/** Recorded project bases since this task's export; no relevance, semantic or result verdict. */
export function returnPreview(p, selectedId) {
    const empty = { kind: 'hidden', targetTaskId: null, targetTitle: null, exportedAt: null, exportRevision: null, recordedBases: null };
    if (p.draftKind !== 'report' && p.draftKind !== 'evidence')
        return empty;
    const targetId = returnTargetId(p, selectedId), target = p.tasks.find(t => t.id === targetId);
    if (!target)
        return { ...empty, kind: 'no-target' };
    return exportPreview(p, target, target.handoffs.at(-1));
}
/** File returns use their exact export; manual paste keeps its existing last-export preview. */
export function exportPreview(p, target, last) {
    const empty = { kind: 'hidden', targetTaskId: null, targetTitle: null, exportedAt: null, exportRevision: null, recordedBases: null };
    const preview = { ...empty, kind: 'no-export', targetTaskId: target.id, targetTitle: taskTitle(p, target) };
    if (!last)
        return preview;
    preview.exportedAt = last.at;
    preview.exportRevision = last.revision;
    // Imported records may be valid storage data but lack a reliable comparison timeline.
    if (last.legacyText !== null || !last.work || !Number.isSafeInteger(last.revision) || last.revision < 0 || last.revision > p.revision)
        return { ...preview, kind: 'unknown' };
    for (const b of p.bases) {
        let previous = -1;
        for (let i = 0; i <= b.history.length; i++) {
            const version = i < b.history.length ? b.history[i] : b;
            if (!Number.isSafeInteger(version.revision) || version.revision <= previous || version.revision > p.revision)
                return { ...preview, kind: 'unknown' };
            previous = version.revision;
        }
    }
    return { ...preview, kind: 'comparable', recordedBases: p.bases.filter(b => b.revision > last.revision) };
}
/** An export record is evidence of copying/saving, never of a running/completed task. */
export function exportNeedsRefresh(p, t) {
    const last = t.handoffs.at(-1);
    if (!last)
        return false;
    if (!last.work)
        return true; // Legacy exports have no comparable current-format snapshot.
    // Compare the complete delivered text (including suggestions), not just the four work fields.
    // Pin only the header revision: export bookkeeping and unsubmitted drafts change p.revision
    // without changing the handoff content. This shallow view never rewrites the saved project.
    const current = handoffText({ ...p, revision: last.revision }, t.id, last.returnId);
    return current.length !== last.chars || digest(current) !== last.digest;
}
export function stageOf(p, t) {
    if (!t)
        return { kind: 'empty', title: '아이디어에서, 첫 작업으로.', label: '시작하기', next: '만들고 싶은 것 또는 바꾸고 싶은 것을 적어 주세요.', step: 1 };
    if (p.pending?.taskId === t.id)
        return { kind: 'pending', title: '작업 문맥을 정리하고 있어요.', label: '정리 응답 대기', next: '요청 원문은 보관했습니다. 개발 작업을 실행하는 단계는 아닙니다.', step: 1 };
    if (questionApplicability(p, t) === 'active')
        return { kind: 'question', title: '이 한 가지만 알려주세요.', label: '답변이 필요해요', next: '답에 따라 달라지는 부분만 확인하고, 작업문으로 이어갑니다.', step: 1 };
    const w = currentWork(p, t);
    if (w.aiStale)
        return { kind: 'stale', title: '현재 기준으로 이어가세요.', label: w.changed === 'unknown' ? '기준 시점 확인 불가' : '기준 변경됨', next: '이전 AI 문구는 제외했습니다. 직접 다듬거나 이 입력만 다시 정리할 수 있어요.', step: 2 };
    if (!t.advice && !Object.values(t.manual).some(v => v?.trim()))
        return { kind: 'saved', title: '요청 원문은 남아 있어요.', label: '원문 보관됨', next: '다시 정리하거나, 아래에서 작업문을 직접 작성하세요.', step: 1 };
    if (t.handoffs.length && !exportNeedsRefresh(p, t))
        return { kind: 'exported', title: '돌아온 결과에서 이어가세요.', label: '작업문 내보냄', next: '사용 중인 도구에 작업문을 전달한 뒤, 받은 결과를 여기에 붙여넣으세요.', step: 3 };
    const returned = ['report', 'evidence'].includes(sourceOf(p, t)?.kind ?? '');
    // FLOW091: the report itself is kept under its original task; what is shown next is a draft to check it.
    const origin = p.tasks.findIndex(x => x.id === t.parentTaskId), at = origin >= 0 ? `작업 ${String(origin + 1).padStart(2, '0')}에` : '';
    return { kind: 'ready', title: returned ? `받은 보고를 ${at ? `${at} ` : ''}보관했어요. 이어서 후속 확인 작업문 초안이에요.` : '이제, 작업문을 전달하세요.', label: t.handoffs.length ? '내보낸 뒤 수정됨' : '작업문 준비됨', next: returned ? `보고 원문은 ${at || '받은 그대로'} 보관했고 앱에서 검증하지 않았어요. 아래는 그 보고를 확인하기 위한 후속 초안입니다. 구현 완료 판정은 아닙니다.` : '필요하면 직접 다듬고, 사용 중인 개발 도구에 복사해 전달하세요.', step: 2 };
}
export function workOrigin(t) {
    const manual = Object.values(t.manual).some(v => v !== null) || t.suggestions !== null;
    if (!t.mode)
        return manual ? '사용자 직접 작성' : '입력 원문 보존';
    return t.mode === 'mock' ? (manual ? '모의 제안 · 직접 수정 포함' : '모의 제안 · 규칙 기반')
        : (manual ? 'AI 제안 · 직접 수정 포함' : 'AI 제안 · 사용자 미확정');
}
/** FLOW090-B1-R1: the view that shows every card (measured boxes in plane units) inside a w x h map with a margin.
 * The scale goes as low as fitting needs; only the zoom buttons have a comfort floor. Never moves a card. */
export const FIT_MIN = 0.0005, ZOOM_MIN = 0.4, ZOOM_MAX = 1.6;
export function fitViewport(w, h, boxes, margin = 24) {
    if (!boxes.length)
        return { x: margin, y: margin, s: 1 };
    const minX = Math.min(...boxes.map(b => b.x)), minY = Math.min(...boxes.map(b => b.y));
    const bw = Math.max(...boxes.map(b => b.x + b.w)) - minX, bh = Math.max(...boxes.map(b => b.y + b.h)) - minY;
    const s = Math.max(FIT_MIN, Math.min(1.2, (w - 2 * margin) / bw, (h - 2 * margin) / bh));
    return { x: (w - bw * s) / 2 - minX * s, y: (h - bh * s) / 2 - minY * s, s };
}
