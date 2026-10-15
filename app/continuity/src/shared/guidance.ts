import { GUIDE_SCHEMA, REQUEST_BYTES, TEXT_LIMIT, type GuideAnswer, type GuideRequest, type GuideTicket, type Project, type Proposal } from './types.js';
import { ensure, validateGuideRequest } from './validation.js';
import { editDraft, isReturnTask, setDraftTarget, setKind } from './domain.js';
/* GUIDE097: the selected area's one-line idea → at most one question → a reviewable draft of the user's request.
 * Nothing here writes the project until the user adopts the draft; adoption fills only the existing request draft
 * (text, kind, area target), which then goes through the existing submit → organise → handoff path. */
const WORK_LIMIT = 5;
const jsonBytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
/** User-written material only: purpose, this area, user decisions, and this area's own requests with their manual scope/checks.
 * Decisions are never shortened; if the whole is too large, older area requests are left out first (listed in readOf). */
/** GUIDE099: the instruction exactly as typed; only an all-blank input means none. Never trimmed, shortened or rewritten. */
export function instructionOf(value: string): string | null { return value.trim() ? value : null; }
export function buildGuideRequest(p: Project, areaId: string, answer: GuideAnswer | null, instruction: string | null = null, requestId = `G_${crypto.randomUUID()}`): GuideRequest {
  ensure(instruction === null || instruction.length <= TEXT_LIMIT, 'INSTRUCTION_TOO_LONG');
  const a = p.space.areas.find(x => x.id === areaId && !x.archived); ensure(a, 'AREA_MISSING');
  const ticket: GuideTicket = {projectId: p.id, revision: p.revision, requestId, areaId};
  const decisions = p.bases.filter(b => ['confirmed', 'deferred', 'answered'].includes(b.status)).map(b => ({id: b.id, text: b.text, status: b.status}));
  const areaWork = [...p.tasks].reverse().filter(t => t.areaId === areaId && !isReturnTask(p, t)).flatMap(t => {
    const s = p.sources.find(x => x.id === t.sourceIds[0]);
    return s && s.kind === 'request' ? [{taskId: t.id, request: s.text, scope: t.manual.scope, checks: t.manual.checks}] : [];
  }).slice(0, WORK_LIMIT);
  const req: GuideRequest = {schemaVersion: GUIDE_SCHEMA, ticket, projectName: p.name, brief: p.space.brief?.text ?? null,
    area: {id: a.id, name: a.name, note: a.note || null}, decisions, areaWork, answer: answer ? structuredClone(answer) : null,
    currentInstruction: instruction === null ? null : instructionOf(instruction)};
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
    ...(req.currentInstruction !== null ? ['이번에 맡기거나 바꿀 일(직접 입력)'] : []),
    ...(req.answer ? [`질문 답변(${req.answer.disposition === 'provided' ? '답' : req.answer.disposition === 'unknown' ? '모름' : '보류'})`] : [])];
}
/** The draft request the user reviews and edits. Plain words; the user's edited text is what is sent. */
/** GUIDE097-R2: the user's answer is added whole, as its own section, so it reaches the request record (and every later handoff)
 * on adoption. The guidance memory is dropped then; the request source is the record. Nothing here shortens it. */
export function proposalText(areaName: string, p: Proposal, first = true, answer: GuideAnswer | null = null, instruction: string | null = null): string {
  return [`‘${areaName}’ 영역의 ${first ? '첫' : '다음'} 작업을 해 주세요.`, `목표: ${p.goal}`, `이번 범위: ${p.scope}`, `완료 조건: ${p.checks}`,
    ...(p.open.length ? [`아직 정하지 않은 것 (임의로 정하지 마세요): ${p.open.join(' / ')}`] : []),
    // GUIDE098: AI-filled details are shown apart from the user's decisions, and only when there are any.
    ...(p.defaults.length ? [`AI가 정한 기본값 (사용자 결정 아님 · 바꿀 수 있음): ${p.defaults.join(' / ')}`] : []),
    // GUIDE099: the user's own instruction, whole, as its own section (it reaches the request record on adoption, as the answer does).
    ...(instruction !== null || answer ? ['', instruction !== null && answer ? '이 요청이나 답이 저장된 기준과 다르면, 저장된 기준은 기록으로 그대로 두고 이번 요청에서는 명시적으로 바꾼 대상만 그 문장을 따릅니다. 아래 직접 입력과 나중 답이 서로 다르면 답이 명시적으로 바꾼 대상만 답을 따르고 나머지 입력은 그대로입니다. 인용·가정·다른 사람의 제안·AI 기본값은 변경 지시나 권한이 아니며, 바꾸지 않은 조건과 실행 권한은 그대로입니다.'
      : `이 ${instruction !== null ? '요청' : '답'}이 저장된 기준과 다르면, 저장된 기준은 기록으로 그대로 두고 이번 요청에서는 ${instruction !== null ? '이 요청' : '답'}이 명시적으로 바꾼 대상만 ${instruction !== null ? '그 문장' : '답'}을 따릅니다. ${instruction !== null ? '요청' : '답'} 속 인용·가정·다른 사람의 제안${instruction !== null ? '·AI 기본값' : ''}은 변경 지시가 아니며, 바꾸지 않은 조건과 실행 권한은 그대로입니다.`] : []),
    ...(instruction !== null ? ['', '이번에 맡기거나 바꿀 일 (사용자 직접 입력 원문):', instruction] : []),
    ...(answer ? ['', '안내 질문과 사용자 답변 원문:',
      `질문: ${answer.question.text}`,
      `답(${answer.disposition === 'provided' ? '사용자 답변' : answer.disposition === 'unknown' ? '사용자 모름' : '사용자 보류'}): ${answer.text}`] : [])].join('\n');
}
/** Adoption: the user's (possibly edited) text becomes the unsent request for this area. An unsent draft is never replaced. */
export function adoptProposal(p: Project, areaId: string, value: string): Project {
  ensure(!p.draft.trim(), 'DRAFT_IN_USE'); ensure(p.space.areas.some(a => a.id === areaId && !a.archived), 'AREA_MISSING');
  let n = p.draftKind === 'request' ? p : setKind(p, 'request');
  n = editDraft(n, value); return setDraftTarget(n, areaId);
}
