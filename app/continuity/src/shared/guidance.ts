import { GUIDE_SCHEMA, REQUEST_BYTES, type GuideAnswer, type GuideRequest, type GuideTicket, type Project, type Proposal } from './types.js';
import { ensure, validateGuideRequest } from './validation.js';
import { editDraft, isReturnTask, setDraftTarget, setKind } from './domain.js';
/* GUIDE097: the selected area's one-line idea → at most one question → a reviewable draft of the user's request.
 * Nothing here writes the project until the user adopts the draft; adoption fills only the existing request draft
 * (text, kind, area target), which then goes through the existing submit → organise → handoff path. */
const WORK_LIMIT = 5;
const jsonBytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
/** User-written material only: purpose, this area, user decisions, and this area's own requests with their manual scope/checks.
 * Decisions are never shortened; if the whole is too large, older area requests are left out first (listed in readOf). */
export function buildGuideRequest(p: Project, areaId: string, answer: GuideAnswer | null, requestId = `G_${crypto.randomUUID()}`): GuideRequest {
  const a = p.space.areas.find(x => x.id === areaId && !x.archived); ensure(a, 'AREA_MISSING');
  const ticket: GuideTicket = {projectId: p.id, revision: p.revision, requestId, areaId};
  const decisions = p.bases.filter(b => ['confirmed', 'deferred', 'answered'].includes(b.status)).map(b => ({id: b.id, text: b.text, status: b.status}));
  const areaWork = [...p.tasks].reverse().filter(t => t.areaId === areaId && !isReturnTask(p, t)).flatMap(t => {
    const s = p.sources.find(x => x.id === t.sourceIds[0]);
    return s && s.kind === 'request' ? [{taskId: t.id, request: s.text, scope: t.manual.scope, checks: t.manual.checks}] : [];
  }).slice(0, WORK_LIMIT);
  const req: GuideRequest = {schemaVersion: GUIDE_SCHEMA, ticket, projectName: p.name, brief: p.space.brief?.text ?? null,
    area: {id: a.id, name: a.name, note: a.note || null}, decisions, areaWork, answer: answer ? structuredClone(answer) : null};
  while (jsonBytes(req) > REQUEST_BYTES && req.areaWork.length) req.areaWork.pop();
  return validateGuideRequest(req);
}
/** What a reply was built from, apart from the ticket. A reply is applied only while this is unchanged. */
export function guideDigest(req: GuideRequest): string {
  const {ticket: _ticket, ...material} = req; return JSON.stringify(material);
}
/** Plain description of the material read, for the screen. */
export function readOf(req: GuideRequest): string[] {
  return [...(req.brief !== null ? ['프로젝트 목적'] : []), `영역 ‘${req.area.name}’${req.area.note !== null ? '의 구상' : ' (구상 미기재)'}`,
    ...(req.decisions.length ? [`사용자 결정 ${req.decisions.map(d => d.id).join(', ')}`] : []),
    ...(req.areaWork.length ? [`이 영역의 요청 ${req.areaWork.length}개${req.areaWork.some(w => w.scope !== null || w.checks !== null) ? '와 직접 고친 범위·완료 조건' : ''}`] : []),
    ...(req.answer ? [`질문 답변(${req.answer.disposition === 'provided' ? '답' : req.answer.disposition === 'unknown' ? '모름' : '보류'})`] : [])];
}
/** The draft request the user reviews and edits. Plain words; the user's edited text is what is sent. */
/** GUIDE097-R2: the user's answer is added whole, as its own section, so it reaches the request record (and every later handoff)
 * on adoption. The guidance memory is dropped then; the request source is the record. Nothing here shortens it. */
export function proposalText(areaName: string, p: Proposal, first = true, answer: GuideAnswer | null = null): string {
  return [`‘${areaName}’ 영역의 ${first ? '첫' : '다음'} 작업을 해 주세요.`, `목표: ${p.goal}`, `이번 범위: ${p.scope}`, `완료 조건: ${p.checks}`,
    ...(p.open.length ? [`아직 정하지 않은 것 (임의로 정하지 마세요): ${p.open.join(' / ')}`] : []),
    ...(answer ? ['', '안내 질문과 사용자 답변 원문:', `질문: ${answer.question.text}`,
      `답(${answer.disposition === 'provided' ? '사용자 답변' : answer.disposition === 'unknown' ? '사용자 모름' : '사용자 보류'}): ${answer.text}`] : [])].join('\n');
}
/** Adoption: the user's (possibly edited) text becomes the unsent request for this area. An unsent draft is never replaced. */
export function adoptProposal(p: Project, areaId: string, value: string): Project {
  ensure(!p.draft.trim(), 'DRAFT_IN_USE'); ensure(p.space.areas.some(a => a.id === areaId && !a.archived), 'AREA_MISSING');
  let n = p.draftKind === 'request' ? p : setKind(p, 'request');
  n = editDraft(n, value); return setDraftTarget(n, areaId);
}
