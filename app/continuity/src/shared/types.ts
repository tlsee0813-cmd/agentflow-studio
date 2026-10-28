import type { FrozenRequest, StoredRequestMatch, RequestCorrection, ReplaceCorrection } from './request-return.js';
export const SCHEMA = 'idea015.project.13' as const;
/** project.12 had map readings up to map-reading.4 (candidates without a stated target): they stay as stored. */
export const V12_SCHEMA = 'idea015.project.12' as const;
/** project.11 had map readings whose quotes carry no position (map-reading.1–3): they stay as stored; no position is derived. */
export const V11_SCHEMA = 'idea015.project.11' as const;
/** project.10 had request matches without a stance and no withdrawal links: they read as unclassified reports (no backfill). */
export const V10_SCHEMA = 'idea015.project.10' as const;
export const V9_SCHEMA = 'idea015.project.9' as const;
/** project.8 had no map readings: it reads as none (readings=[]); nothing else changes. */
export const V8_SCHEMA = 'idea015.project.8' as const;
/** project.7 had no pasted records: it reads as none (pasted=[]); nothing else changes. */
export const V7_SCHEMA = 'idea015.project.7' as const;
export const V6_SCHEMA = 'idea015.project.6' as const;
/** project.5 had no area understanding and no export anchors: every area reads none, every export anchor=null (no backfill). */
export const V5_SCHEMA = 'idea015.project.5' as const;
/** project.4 had no background snapshots: every task and export reads background=null (nothing is backfilled). */
export const V4_SCHEMA = 'idea015.project.4' as const;
/** project.3 had no space; it is read as an empty one. */
export const V3_SCHEMA = 'idea015.project.3' as const;
export const PREVIOUS_SCHEMA = 'idea015.project.2' as const;
export const LEGACY_SCHEMA = 'idea015.project.1' as const;
export const RESULT_SCHEMA = 'agentflow.return.1' as const;
export const RESULT_BYTES = 131072;
export const RESULT_TEXT_LIMIT = 11000;
/** AREA17: return.1 plus one optional, already organised description of the area the returned task belongs to. */
export const RESULT2_SCHEMA = 'agentflow.return.2' as const;
export interface ResultFile {
  schemaVersion: typeof RESULT_SCHEMA | typeof RESULT2_SCHEMA; projectId: string; taskId: string; returnId: string;
  report: string; evidence: string | null;
  /** return.2 only (return.1 has no such key). */
  understanding?: UnderstandingInput | null;
}
/** AREA17: the area's current description up to and including this return, as organised OUTSIDE the app (research premise).
 * summary/changes are given as a description that does not change the user's intent; a change of intent goes in proposal only.
 * The app checks target, basis and duplicates; it does not check that the wording is right or compatible. No status field. */
export interface UnderstandingInput {
  version: 'understanding.1'; areaId: string; basedOn: number;
  summary: string; changes: string[]; proposal: string | null; origin: string;
}
/** AREA17: the user's own plan an area description is made for: the area name and idea text, how many times the project
 * purpose was written, the current revision of each user decision from this area's or unplaced work ('D3@2'), and for each such
 * task with user-written work values or a purpose correction one '<task id>:<sha256>' of those values. The fingerprint keeps
 * the stamp small and valid for any allowed text; the values themselves stay only in the task. */
export interface LegacyPlanStamp { name: string; note: string; brief: number; decisions: string[]; work: string[] }
export interface AncestorContext { id: string; name: string; note: string; revision: number }
/** plan.2 records reference context, not inherited work instructions. Legacy stamps are never backfilled. */
export interface ContextPlanStamp extends LegacyPlanStamp { version:'plan.2'; revision:number; ancestors:AncestorContext[] }
export type PlanStamp = LegacyPlanStamp | ContextPlanStamp;
/** AREA17: captured when a task is exported with a return file id: which area, which description revision went out, and the
 * user's plan at that moment. Older exports have none (null); nothing is estimated for them. */
export type ExportAnchor = { version: 'anchor.1'; areaId: string; understanding: number; stamp: LegacyPlanStamp }
  | { version:'anchor.2'; areaId:string; understanding:number; stamp:ContextPlanStamp };
export type HeldReason = 'no-anchor' | 'area-moved' | 'area-mismatch' | 'area-archived' | 'file-basis' | 'superseded' | 'plan-changed';
/** AREA17: one received or corrected description of an area. External text stays in the return file (single source);
 * a user correction keeps its own text. revision=null: received but held (never the current description). */
export interface UnderstandingEntry {
  by: 'external' | 'user'; at: string; revision: number | null;
  taskId: string | null; returnId: string | null;
  text: string | null; corrects: number | null;
  stamp: PlanStamp | null; held: HeldReason | null;
}
export interface AreaUnderstanding { revision: number; entries: UnderstandingEntry[] }
export const API_SCHEMA = 'idea022.context.7' as const;
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
/** value=null only when a user correction exists without a still-valid AI interpretation. */
export interface PreviousIntent {
  taskId:string; value:Intent|null; manualGoal:string|null; manualConditions:string|null;
}
export interface CurrentIntent extends PreviousIntent { value:Intent }
export interface Advice {
  // Absent in saved pre-AI055 advice. A new provider response must include it.
  intent?: Intent;
  understanding: string; scope: string; next: string; checks: string;
  question: Question | null; relatedBasisIds: string[]; reviewBasisIds: string[];
  suggestions: { text: string; why: string }[];
}
export interface WorkValues { understanding: string; scope: string; next: string; checks: string }
/** FLOW091-C: copy of the user's plan fixed when an explicit new request was submitted: the project purpose and the
 * area that request was written for (not the map selection). Background material, never an instruction, basis or
 * user decision. Later purpose/area edits, moves, re-organisation and exports never change it. Empty = null. */
export interface Background {
  version: 'background.1'; revision: number; brief: string | null;
  area: { id: string; name: string; note: string | null } | null;
}
/** Export metadata. The handoff text is derivable from stable IDs/revisions, so it is not copied again.
 * Exception: background, the copy actually sent (older records: null; not recovered from the current plan). */
export interface ExportRecord {
  at: string; method: 'clipboard' | 'download'; revision: number; chars: number; digest: string;
  work: WorkValues | null; aiExcluded: boolean; legacyText: string | null;
  returnId: string | null; background: Background | null;
  /** AREA17: only for a return-file export of a task in an area; null otherwise and for every older export. */
  anchor: ExportAnchor | null;
}
export interface Task {
  /** Purpose correction, stored apart from this task's own work fields (manual.*). goal=null (with conditions=null)
   * keeps only the revision that withholds older AI text, with no correction. intent-edit.1 came from the
   * unreleased AI055 candidate and is accepted on input only; parsing always converts it to intent-edit.2. */
  intentEdit?: {version:'intent-edit.1';revision:number}|{version:'intent-edit.2';revision:number;goal:string;conditions:string}|{version:'intent-edit.2';revision:number;goal:null;conditions:null};
  id: string; sourceIds: string[]; parentTaskId: string | null;
  advice: Advice | null; adviceRevision: number | null; mode: 'mock' | 'deepseek' | null;
  manual: { understanding: string | null; scope: string | null; next: string | null; checks: string | null };
  suggestions: { text: string; why: string }[] | null; handoffs: ExportRecord[];
  resultFile: { returnId: string; rawText: string } | null;
  /** FLOW091-C: a request's own capture; a return carries the copy of the task (or exact export) it returns to. */
  background: Background | null;
  /** FLOW090: the area of a request task. Absent = not placed. Returns follow their parent and never carry it. */
  areaId?: string;
}
/** FLOW090: the user's own plan of the product. Areas and relations are layout/plan data, not work records. */
export interface Area { id: string; name: string; note: string; archived: boolean; createdAt: string }
export type RelationKind = 'flow' | 'needs' | 'shares' | 'related';
export interface Relation { id: string; from: string; to: string; kind: RelationKind; note: string }
export interface Brief { text: string; at: string; previous: { text: string; at: string }[] }
/** Where the unsent request goes: null = continue the current work's area; {area:null} = no area; {area:id} = that area.
 * Part of the draft's meaning, so it is saved with the draft text (unlike the per-tab view). */
export interface DraftTarget { area: string | null }
/** FLOW090-B1: where the user put each area on the map (presentation data, versioned). Areas without a stored
 * position use a fixed default from their place in the list, so adding or archiving never moves anyone else. */
export interface Point { x: number; y: number }
export interface Layout { version: 'layout.1'; positions: Record<string, Point> }
/** Single parent hypothesis. Absent parent key = root; revision tracks explicit name/note/parent changes, not views. */
/** Places the person set by dragging, per container (a part id, or the layout's root key) and part id, relative to the
 * container. Kept apart from the project (browser storage), and carried by a backup file as its optional top-level 'positions'. */
export type ManualPositions = Record<string, Record<string, Point>>;
/** A backup file: the project's own bytes, plus the manual places when there are any. Without them it is a plain project. */
export interface Backup { project: Project; positions: ManualPositions | null }
/** How a project was last looked at in this browser (folds and per-scope cameras), apart from the project data. Keys are part
 * ids (for an example: its stable part keys); a camera's scope '' is the whole map. */
export interface ViewState { folds: Record<string, boolean>; cameras: Record<string, { x: number; y: number; scale: number }> }
export interface Containment { version:'containment.1'; parents:Record<string,string>; revisions:Record<string,number> }
/** understanding (AREA17): derived descriptions per area ID, kept apart from Area.note (the user's words). */
export interface Space { brief: Brief | null; areas: Area[]; relations: Relation[]; draftTarget: DraftTarget | null; layout: Layout; understanding: Record<string, AreaUnderstanding>; containment:Containment }
export interface Ticket { projectId: string; revision: number; requestId: string; taskId: string }
export interface Project {
  schemaVersion: typeof SCHEMA; id: string; revision: number; name: string;
  sources: Source[]; bases: Basis[]; tasks: Task[]; currentTaskId: string | null;
  draft: string; answerDraft: string; basisDraft: string; basisEdits: Record<string,string>; draftKind: 'request' | 'report' | 'evidence' | 'test_answer';
  pending: Ticket | null; notice: string | null; space: Space;
  /** Records the person pasted as they were (project.8). Not a source, task or return: nothing here is a request, a report of
   * a task or a decision, and a reading of one never writes back into the project. */
  pasted: PastedRecord[];
  /** Map readings (project.9): what was read from records into the map, oldest first. Derived understanding with its quotes,
   * kept apart from Area.note (the person's words) and from space.understanding (return.2 and its anchors). A reading only
   * ever added parts and relations; it never renamed, moved, archived or re-described an existing part. */
  readings: ReadingEntry[];
}
/** One pasted record: the text exactly as pasted, a stable id, when it was added here (not when it was written or which
 * version it is about) and, optionally, the part being looked at when it was pasted. That part is the reading's context only,
 * never a claim that the whole text is about it. */
export interface PastedRecord { id: string; text: string; at: string; context: string | null }
export const PASTED_TEXT_LIMIT = 60000;
/** What a reading says about a part, by its nature: what is wanted, what is only an idea, what an author reports was built,
 * what an author reports was checked, how something is described as it stands, a product decision left open, and evidence that
 * differs from the person's own description of the part. Never a status the app verified. */
export type ClaimKind = 'want' | 'idea' | 'reported' | 'checked' | 'describes' | 'open' | 'differs';
export const CLAIM_KINDS: readonly ClaimKind[] = ['want', 'idea', 'reported', 'checked', 'describes', 'open', 'differs'];
/** A quote of a record as it was sent: a pasted record id or a project source id. map-reading.4: also where it stands, [from, to)
 * in UTF-16 code units of the record's own text (the quote is exactly that slice); earlier readings have no position. */
export interface ReadingQuote { record: string; quote: string; from?: number; to?: number }
export interface ReadingClaim {
  kind: ClaimKind; text: string; record: string; quote: string;
  /** map-reading.4: where the quote stands in its record (see ReadingQuote). */
  from?: number; to?: number;
  /** Version, commit or time the record itself names for this claim (as written), else null. Never the arrival order. */
  about: string | null;
  /** An earlier claim of the same part this one supersedes, because the record says so. */
  replaces: { reading: string; index: number } | null;
}
export interface ReadingPart {
  areaId: string;
  /** This reading added the part; its name and parent as added (a later rename or move by the person is theirs). */
  created: { name: string; parentId: string | null } | null;
  /** The part's responsibility as read (one or two sentences), null when this reading says nothing new about it. */
  role: string | null;
  /** Version, commit or time the record names for that description (as written), else null. */
  roleAbout: string | null;
  /** The record's own words that this description supersedes the earlier one (a quote); without it a description never
   * replaces the current one, whatever version either names. */
  roleReplaces: ReadingQuote | null;
  basis: ReadingQuote[]; claims: ReadingClaim[];
}
export interface ReadingRelation { relationId: string; from: string; to: string; kind: RelationKind; quote: ReadingQuote }
/** What a candidate leaves undecided (map-reading.5): whose statement this is (attribution), whether two parts are one
 * (identity), whether a part is inside a parent (parent), or whether a statement holds (holds). An attribution or holds candidate
 * keeps the undecided statement itself (content, kind, version, exact quote): it is in no part's claims. areaIds name the
 * alternatives (attribution), the two parts (identity), the part then its parent (parent) or the part (holds). */
export type CandidateTarget = 'attribution' | 'identity' | 'parent' | 'holds';
export interface CandidateStatement { kind: ClaimKind; text: string; about: string | null; quote: ReadingQuote }
export interface ReadingCandidate { text: string; areaIds: string[]; quote: ReadingQuote | null;
  /** map-reading.5 only. */
  target?: CandidateTarget; statement?: CandidateStatement | null }
/** Something the reply proposed that was not applied, and why (kept so the next reading of the same input does not repeat it). */
export interface ReadingSkip { what: 'part' | 'relation'; name: string; reason: 'same-name' | 'archived' | 'removed' | 'exists' | 'parent-skipped' | 'material' }
/** map-reading.4: a passage the reading took as material inside the record (an example, a sample under test, another program's
 * words), not as this project's own: [from, to) of the record, with what it is. Nothing of the map rests on it alone. */
export interface ReadingMaterial { record: string; from: number; to: number; what: string }
export interface MapReading {
  version: 'map-reading.1' | 'map-reading.2' | 'map-reading.3' | 'map-reading.4' | 'map-reading.5'; id: string; at: string; model: string; prompt: string;
  /** SHA-256 of the request: the very same request is never sent or applied again. */
  hash: string;
  /** Records read, and which part of each went: characters [from, to) of total. A record's unsent tail is read by a later reading. */
  records: { id: string; from: number; to: number; total: number; digest?: string }[];
  summary: string; parts: ReadingPart[]; relations: ReadingRelation[]; candidates: ReadingCandidate[]; gaps: string[]; skipped: ReadingSkip[];
  /** map-reading.2/3 only: the request context actually sent, and correspondence saved in the same project write (map-reading.3:
   * each with its stance and the explicit withdrawal of an earlier match it carries). */
  requests?: FrozenRequest[]; matches?: StoredRequestMatch[];
  /** map-reading.4 only: each record's digest (textDigest of exactly [from, to) read) is in records; and what was read as material. */
  material?: ReadingMaterial[];
}
/** The person's own correction of a part's description as read (never Area.note, never a return.2 description): it names the
 * reading whose description it corrects. It holds that description only; later claims of later readings still come in. */
export interface ReadingCorrection { version: 'map-correction.1'; id: string; at: string; areaId: string; text: string; corrects: string | null }
export type ReadingEntry = MapReading | ReadingCorrection | RequestCorrection | ReplaceCorrection;
export const isMapReading = (e: ReadingEntry): e is MapReading => e.version === 'map-reading.1' || e.version === 'map-reading.2' || e.version === 'map-reading.3' || e.version === 'map-reading.4' || e.version === 'map-reading.5';
export const READINGS_LIMIT = 500;
export const PASTED_LIMIT = 500;
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
/** A bounded reference for this task's current area, not a decision, instruction or verified fact.
 * A user's description correction has no invented return/source; corrects names the prior local revision. */
export interface ContextAreaDescription {
  taskId: string; areaId: string; revision: number; by: 'external' | 'user'; corrects: number | null;
  source: { taskId: string; returnId: string; origin: string } | null;
  text: string;
}
export interface ContextRequest {
  schemaVersion: typeof API_SCHEMA; ticket: Ticket; projectName: string;
  sources: Source[]; bases: ContextBasis[]; appFacts: AppFacts; previousIntent: PreviousIntent|null;
  /** Only when previousIntent is a 'separate' interpretation: the nearest earlier non-separate one on this path. */
  purposeIntent: CurrentIntent|null;
  previousWork: (WorkValues & { taskId: string; aiTextExcluded: boolean; manualConditionFields: ('scope' | 'checks')[] }) | null;
  /** FLOW091-C: this task's fixed plan copy, as separate material (not a source, basis or decision). */
  background: Background | null;
  /** Optional for earlier valid context. Absence stays absent; never backfilled on the server. */
  currentAreaDescription?: ContextAreaDescription | null;
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
/* ---------- GUIDE097: area guidance. A separate, unsaved preview before the user's own request; never project data. ---------- */
/** guidance.2 (GUIDE098): the reply's proposal gains defaults. guidance.3 (GUIDE099): the request gains currentInstruction.
 * The version moves each time so a stale client and server refuse each other plainly. Never stored. */
export const GUIDE_SCHEMA = 'guidance.3' as const;
export interface GuideTicket { projectId: string; revision: number; requestId: string; areaId: string }
/** The user's reply to the one guidance question, sent back with that question. Not a basis until the user sends a request. */
export interface GuideAnswer { question: Question; text: string; disposition: Disposition }
/** Read-only material the preview may use. All user-written: purpose, this area, user decisions and this area's requests. */
export interface GuideRequest {
  schemaVersion: typeof GUIDE_SCHEMA; ticket: GuideTicket; projectName: string;
  brief: string | null; area: { id: string; name: string; note: string | null };
  /** Current values of confirmed/deferred/answered bases (user decisions), never shortened. */
  decisions: { id: string; text: string; status: Basis['status'] }[];
  /** Newest first: this area's own requests and the user's manual scope/checks for them. */
  areaWork: { taskId: string; request: string; scope: string | null; checks: string | null }[];
  answer: GuideAnswer | null;
  /** GUIDE099: what the user typed as the work to hand over or the condition to change now, verbatim; null when left empty.
   * Only ever the user's own input: never the area idea, an earlier request, an answer or an AI text. */
  currentInstruction: string | null;
}
/** A reviewable draft of the user's next request, not an instruction. open = points the user still has to decide (the draft
 * leaves them undecided). defaults = low-risk, reversible details the AI filled in as editable suggestions, never user decisions. */
export interface Proposal { goal: string; scope: string; checks: string; open: string[]; defaults: string[] }
/** Exactly one is non-null. After an answer the question is always null (one question at most). */
export interface GuideReply { question: Question | null; proposal: Proposal | null }
export interface GuideEnvelope { mode: 'mock' | 'deepseek'; ticket: GuideTicket; reply: GuideReply }
