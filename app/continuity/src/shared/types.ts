export const SCHEMA = 'idea015.project.3' as const;
export const PREVIOUS_SCHEMA = 'idea015.project.2' as const;
export const LEGACY_SCHEMA = 'idea015.project.1' as const;
export const RESULT_SCHEMA = 'agentflow.return.1' as const;
export const RESULT_BYTES = 131072;
export const RESULT_TEXT_LIMIT = 11000;
export interface ResultFile {
  schemaVersion: typeof RESULT_SCHEMA; projectId: string; taskId: string; returnId: string;
  report: string; evidence: string | null;
}
export const API_SCHEMA = 'idea022.context.5' as const;
export const TEXT_LIMIT = 12000;
// One limit for the same compact JSON bytes: autosave, recovery file download and import.
export const FILE_LIMIT = 8_000_000;
// Element-count cap for every persisted/validated array, derived from FILE_LIMIT: an element written by
// this app serialises to well over FILE_LIMIT / ITEM_LIMIT = 80 bytes, so the byte limit is what binds real
// projects. The cap only bounds hand-crafted files; validation stays linear up to it.
export const ITEM_LIMIT = 100_000;
// AI request only. Local handoff, autosave and recovery files are not bound by it.
export const REQUEST_BYTES = 131072;
// Only when full context exceeds REQUEST_BYTES: older, never-edited requests may use marked excerpts.
export const EXCERPT_CHARS = 200;
export type SourceKind = 'request' | 'report' | 'evidence' | 'test_answer' | 'answer' | 'manual_decision';
export type Disposition = 'provided' | 'unknown' | 'deferred';
export interface Source {
  id: string; kind: SourceKind; text: string; at: string; taskId: string;
  replyTo: string | null; disposition: Disposition;
}
export interface BasisVersion { text: string; status: Basis['status']; sourceId: string; revision: number }
// No lock flag: nothing enforced one. AI output simply has no write path to bases.
export interface Basis {
  id: string; text: string; status: 'requested' | 'answered' | 'confirmed' | 'deferred';
  sourceId: string; revision: number; history: BasisVersion[];
}
export interface Question { kind: 'fact' | 'choice'; text: string; why: string; options: { label: string; consequence: string }[] }
// This type intentionally has NO source-kind, authority, status, completion or patch fields.
/** Versioned interpretation, never a write to user bases or an execution receipt. */
export interface Intent {
  version: 'intent.1'; relation: 'start'|'continue'|'revise'|'separate'|'uncertain';
  goal: string; conditions: string[]; retired: string[];
  basisRefs: {basisId:string;sourceId:string;revision:number}[];
}
export interface PreviousIntent {
  taskId:string; value:Intent; manualGoal:string|null; manualConditions:string|null;
}
export interface Advice {
  // Absent in saved pre-AI055 advice. A new provider response must include it.
  intent?: Intent;
  understanding: string; scope: string; next: string; checks: string;
  question: Question | null; relatedBasisIds: string[]; reviewBasisIds: string[];
  suggestions: { text: string; why: string }[];
}
export interface WorkValues { understanding: string; scope: string; next: string; checks: string }
/** Export metadata. The handoff text is derivable from stable IDs/revisions, so it is not copied again. */
export interface ExportRecord {
  at: string; method: 'clipboard' | 'download'; revision: number; chars: number; digest: string;
  work: WorkValues | null; aiExcluded: boolean; legacyText: string | null;
  returnId: string | null;
}
export interface Task {
  /** Purpose correction, stored apart from this task's own work fields (manual.*).
   * intent-edit.1 came from the unreleased AI055 candidate, which wrote the correction into manual.*. */
  intentEdit?: {version:'intent-edit.1';revision:number}|{version:'intent-edit.2';revision:number;goal:string;conditions:string};
  id: string; sourceIds: string[]; parentTaskId: string | null;
  advice: Advice | null; adviceRevision: number | null; mode: 'mock' | 'deepseek' | null;
  manual: { understanding: string | null; scope: string | null; next: string | null; checks: string | null };
  suggestions: { text: string; why: string }[] | null; handoffs: ExportRecord[];
  resultFile: { returnId: string; rawText: string } | null;
}
export interface Ticket { projectId: string; revision: number; requestId: string; taskId: string }
export interface Project {
  schemaVersion: typeof SCHEMA; id: string; revision: number; name: string;
  sources: Source[]; bases: Basis[]; tasks: Task[]; currentTaskId: string | null;
  draft: string; answerDraft: string; basisDraft: string; basisEdits: Record<string,string>; draftKind: 'request' | 'report' | 'evidence' | 'test_answer';
  pending: Ticket | null; notice: string | null;
}
export interface ContextBasis {
  id: string; text: string; status: Basis['status']; sourceId: string; revision: number;
  previousVersions: number; partial: boolean;
}
/** Read-only references to the supplied project's records; no intent/completion or durable-save claim. */
export interface PlanFact {
  basisId: string; sourceId: string; revision: number; status: Basis['status'];
  versionIndex: number; isCurrent: boolean;
  kind: 'input-retained' | 'basis-recorded' | 'version-only';
  previousRevision: number | null;
  /** Only actual text/status fields. null = comparison unavailable, [] = same values re-recorded. */
  changedFields: ('text' | 'status')[] | null;
}
export interface AppFacts {
  taskId: string; inputs: { sourceId: string; kind: SourceKind }[]; records: PlanFact[];
}
export interface ContextRequest {
  schemaVersion: typeof API_SCHEMA; ticket: Ticket; projectName: string;
  sources: Source[]; bases: ContextBasis[]; appFacts: AppFacts; previousIntent: PreviousIntent|null;
  previousWork: (WorkValues & { taskId: string; aiTextExcluded: boolean; manualConditionFields: ('scope' | 'checks')[] }) | null;
}
export interface Envelope { mode: 'mock' | 'deepseek'; ticket: Ticket; advice: Advice }
export const SOURCE_LABEL: Record<SourceKind, string> = {
  request: '사용자 요청 원문', report: '가져온 구현 보고 · 앱 미검증',
  evidence: '사용자가 가져온 관찰·검사 자료 · 앱 미검증', test_answer: '합성 시험답변 · 실제 요구 아님',
  answer: '사용자 답변', manual_decision: '사용자가 직접 기록·수정한 기준'
};
export const BASIS_LABEL: Record<Basis['status'], string> = {
  requested: '요청 원문 · 해석 미확정', answered: '사용자 답변 원문', confirmed: '사용자 확정', deferred: '사용자 보류'
};
