import type { FrozenRequest, StoredRequestMatch, RequestCorrection, ReplaceCorrection } from './request-return.js';
import { CONNECTOR_TEXT_LIMIT } from './connector-limits.js';
export const SCHEMA = 'idea015.project.14' as const;
/** project.13 had normal records of exactly four keys (no provided-source declaration): they stay as stored, nothing is derived. */
export const V13_SCHEMA = 'idea015.project.13' as const;
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
export interface ViewState { folds: Record<string, boolean>; cameras: Record<string, SavedCamera> }
/** A camera as saved: where and how large, and the window (inner width × height) it was saved in, when known; a window that
 * differs by a quarter or more fits the map instead of restoring it (a view saved small in a narrow window stays no fit elsewhere). */
export interface SavedCamera { x: number; y: number; scale: number; win?: [number, number] }
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
   * ever added parts and relations; it never renamed, moved, archived or re-described an existing part (recipe .50 step 5: but for the rename a
   * record's own C-IDENT row asks, map-identity.ts, which leaves a name the person gave as it is). */
  readings: ReadingEntry[];
}
/** One pasted record: the text exactly as pasted, a stable id, when it was added here (not when it was written or which
 * version it is about) and, optionally, the part being looked at when it was pasted. That part is the reading's context only,
 * never a claim that the whole text is about it. */
export interface PastedRecord { id: string; text: string; at: string; context: string | null;
  /** project.14: a provided file the person classified as code or as a check record, with the name, version and origin they
   * declared (null = not recorded). Absent = a record pasted as it came. The person's declaration, never an execution receipt. */
  evidence?: RecordEvidence }
export interface RecordEvidence { kind: 'code' | 'test'; name: string; version: string | null; origin: string | null }
export const PASTED_TEXT_LIMIT = CONNECTOR_TEXT_LIMIT;
/** What a reading says about a part, by its nature: what is wanted, what is only an idea, what an author reports was built,
 * what an author reports was checked, how something is described as it stands, a product decision left open, and evidence that
 * differs from the person's own description of the part. Never a status the app verified. */
export type ClaimKind = 'want' | 'idea' | 'reported' | 'checked' | 'describes' | 'open' | 'differs';
export const CLAIM_KINDS: readonly ClaimKind[] = ['want', 'idea', 'reported', 'checked', 'describes', 'open', 'differs'];
/** What a claim is about, as the reading classified it (map-reading.7), apart from its kind (who said it and how): the part's
 * present state, a change made to it, a rule it must keep (a requirement or a prohibition), a decision taken, a decision
 * withdrawn (before → the claim's text), a defect, something the record could not confirm, a plan, or how the part is built.
 * Earlier readings have none: the pane derives one from the kind and the words (claim-topic.ts). */
export type ClaimTopic = 'status' | 'change' | 'rule' | 'decision' | 'withdrawn' | 'defect' | 'unknown' | 'plan' | 'how';
export const CLAIM_TOPICS: readonly ClaimTopic[] = ['status', 'change', 'rule', 'decision', 'withdrawn', 'defect', 'unknown', 'plan', 'how'];
/** How the record's author knew it: the tag on the line ([파일] read now, [실행] run now, [보고]·[대화] someone else's words,
 * [추정] a guess, [모름] not known); null when the line carries none. The author's own grading, never the app's. */
export type EvidenceGrade = 'file' | 'run' | 'report' | 'guess' | 'unknown';
export const EVIDENCE_GRADES: readonly EvidenceGrade[] = ['file', 'run', 'report', 'guess', 'unknown'];
/** The state a record gives a part in its own words (the report's state column): running, being worked on, not built, stopped,
 * retired, not known. A record's word, never a status the app verified. */
export type PartState = 'running' | 'working' | 'unbuilt' | 'stopped' | 'retired' | 'unknown';
export const PART_STATES: readonly PartState[] = ['running', 'working', 'unbuilt', 'stopped', 'retired', 'unknown'];
/** Whether a relation is the record's design ([설계]: code or documents say so) or something it saw run ([관찰]). */
export type RelationMode = 'design' | 'observed';
export const RELATION_MODES: readonly RelationMode[] = ['design', 'observed'];
/** map-reading.8: the kind of thing a part is, in the record's own type word (its design record's type column): a collector of
 * streams, a computation, an AI judgement, a loop or engine, a timer or schedule, an actor that makes an effect outside (an order,
 * a call), a store (a row file, a queue), a person, an operating session, an external system. The record's word, never inferred
 * from a name; null when the record gives none (a neutral card). */
/** map-reading.18 (pipeline .43, RECORD_ASKS_V4_KO.md K12): and a screen (화면) and a build or deploy automation (빌드·배포 자동화); an
 * entry point, an adapter, an extension point, a contract or a signal is no type (C-ENTRY, C-VARIANT, C-CONTRACT say them). Stored only
 * in map-reading.18 entries. */
export type PartType = 'collector' | 'compute' | 'ai' | 'loop' | 'timer' | 'actor' | 'store' | 'person' | 'session' | 'external' | 'screen' | 'automation';
export const PART_TYPES: readonly PartType[] = ['collector', 'compute', 'ai', 'loop', 'timer', 'actor', 'store', 'person', 'session', 'external', 'screen', 'automation'];
/** The types a map-reading.17 entry or earlier may hold. */
export const PART_TYPES_17: readonly PartType[] = ['collector', 'compute', 'ai', 'loop', 'timer', 'actor', 'store', 'person', 'session', 'external'];
/* ---------- map-reading.18 (pipeline .43, RECORD_ASKS_V4_KO.md 4.3): what the program reads from a 기록 v4 record's tables, never the
 * model's words. Each is stored only in a map-reading.18 entry, every key present (null or [] where the records say nothing, as for
 * every v3 record). ---------- */
/** C-PART 구현 상태 (해당 없음 is null): whether the implementation is in the basis version; never that it works or passed. */
export type PartImplementation = 'built' | 'partial' | 'unbuilt' | 'removed' | 'unknown';
export const PART_IMPLEMENTATIONS: readonly PartImplementation[] = ['built', 'partial', 'unbuilt', 'removed', 'unknown'];
/** C-STATUS 상태 차원 and its fixed values (2.3). */
export type StatusDimension = 'release' | 'deploy' | 'activation' | 'maintenance' | 'operation';
export const STATUS_DIMENSION_KINDS: readonly StatusDimension[] = ['release', 'deploy', 'activation', 'maintenance', 'operation'];
export const STATUS_VALUE_KINDS: Readonly<Record<StatusDimension, readonly string[]>> = { release: ['released', 'unreleased', 'recalled', 'never', 'unknown'], deploy: ['deployed', 'undeployed', 'withdrawn', 'unknown'],
  activation: ['always', 'conditional', 'inactive', 'unknown'], maintenance: ['active', 'fixes', 'deprecated', 'ended', 'unknown'], operation: ['running', 'idle', 'stopped', 'failed', 'unknown'] };
/** A C-STATUS row of a part (or of the project, with the target it names): its dimension and value, the range or condition it holds in
 * (as written, null for —), the version, sha or time it stands on when not the record's basis (null for —), a successor written 「(후속: …)」
 * after the value, and the row. */
export interface ReadingStatusClaim { dimension: StatusDimension; value: string; scope: string | null; basis: string | null; successor: string | null; quote: ReadingQuote;
  /** map-reading.19 (a v5 C-STATUS row, 13.2): the range a part is off in: 기능 일부 · 기본 꺼짐, or unstated for an 비활성·조건부 row with no
   * range (read as 「범위 미기재」, never the whole part); null otherwise and on every v4 row. */
  scopeKind?: StatusScopeKind | null }
/* ---------- map-reading.19 (recipe .45, RECORD_ASKS_V5_KO.md 8.4 as sections 12 and 13 amend it): what the program reads from a 기록 v5
 * record's folded pages (record-table.ts foldPages, record-reading.ts record45), never the model's words. ---------- */
/** C-PART 표현군 (3.1): the five families; 미정 is null with its reason. Kept beside the part's type (the glyph's word), never in it. */
export type RecordFamily = 'participant' | 'process' | 'store' | 'trigger' | 'gate';
export const RECORD_FAMILIES: readonly RecordFamily[] = ['participant', 'process', 'store', 'trigger', 'gate'];
export type FamilyReason = 'thin' | 'mixed' | 'scope';
export const FAMILY_REASONS: readonly FamilyReason[] = ['thin', 'mixed', 'scope'];
/** One cite of a row's 근거 (2.4–2.5 as 12.2): the ID or word cited, its own grade (the ledger's; never merged), and what the ledger says. */
export type CiteGrade = 'file' | 'run' | 'report' | 'guess' | 'unknown';
export const CITE_GRADES: readonly CiteGrade[] = ['file', 'run', 'report', 'guess', 'unknown'];
export interface ReadingCite { ref: string; grade: CiteGrade; source: string | null; place: string | null; quote: string | null }
/** C-LINK 주장 성격 (12.2). */
export type ClaimNature = 'defined' | 'run-report' | 'run-observed' | 'guess';
export const CLAIM_NATURES: readonly ClaimNature[] = ['defined', 'run-report', 'run-observed', 'guess'];
/** A C-STATE row (13.6): a state of the part that decides its first structure, the event leaving it and the state it goes to. */
export interface ReadingPartState { name: string; event: string | null; next: string | null; quote: ReadingQuote }
export type LoopBodyState = 'linked' | 'unexpanded';
export type StatusScopeKind = 'feature' | 'default-off' | 'unstated';
export const STATUS_SCOPE_KINDS: readonly StatusScopeKind[] = ['feature', 'default-off', 'unstated'];
export type FoundBy = 'search' | 'recent' | 'changelog';
export const FOUND_BY: readonly FoundBy[] = ['search', 'recent', 'changelog'];
/** A folded page (4.4): its record ID and number, the page it says comes before, its hash, whether another text came for it. */
export interface ReadingPage { recordId: string; n: number; prev: number | null; hash: string; conflict: boolean }
/** A remaining obligation (12.1), computed by the app: a candidate (a missing link, a folder part) is never a confirmed error. */
export const OBLIGATION_KINDS = ['fix', 'reservation', 'table-skipped', 'table-open', 'table-next', 'loop-body', 'entry-unlinked', 'folder-part', 'page-gap', 'page-conflict'] as const;
export interface ReadingObligation { kind: typeof OBLIGATION_KINDS[number]; table: string | null; ref: string | null; text: string; candidate: boolean }
/** A C-END row (1.2): the table, its state word as written (끝남 · 이어짐 · 아직 · 해당 없음 · 확인 못함, or a supplementary group's), the rows it
 * says it wrote, the IDs it reserves and what is left, with the page. */
export interface ReadingPageEnd { recordId: string; page: number; table: string; state: string | null; written: string[]; reserved: string[]; remaining: string | null; quote: ReadingQuote }
/** A C-CHECK row (5.2, 12.6, 13.5): CK1–CK6, its result, the IDs it found, how it looked. */
export interface ReadingCheck { id: string; result: 'yes' | 'no' | 'unchecked' | null; found: string[]; method: string | null; quote: ReadingQuote }
/** A C-HEAD item (2.1): a default the record states (never a claim of the project). */
export interface ReadingDefault { item: string; value: string; quote: ReadingQuote }
export interface ReadingProjectStatus extends ReadingStatusClaim { target: string }
/** A C-LOOP row of the part owning it: its ID (B03:L01), the loop just outside it (another part's too: parentPart names that part as the
 * record does), the body steps it runs (B03:S04…, a range spelled out), what it repeats over, its count or keep-going condition and its
 * way out as written (null for —), and the row. */
export interface ReadingRecordLoop { recordRef: string; parentRef: string | null; parentPart: string | null; body: string[]; unit: string | null; count: string | null; stop: string | null; quote: ReadingQuote;
  /** map-reading.19 (a v5 C-LOOP row, 3.5): whether C-STEP rows name the loop (linked) or none does yet (unexpanded: the card shows the loop
   * badge and the 몸통 설명 only, no step made up), the 몸통 설명 as written, and the row's cites. Absent on a .18 entry. */
  bodyState?: LoopBodyState | null; bodyText?: string | null; cites?: ReadingCite[] }
/** C-PART 「항목 N · 순서 있음/없음」: a list part's items (count null for 「항목 여럿」; the items its C-GROUP 목록 row lists). */
export interface ReadingMembers { count: number | null; ordered: boolean | null; items: string[]; quote: ReadingQuote }
/** C-GROUP 묶음 뜻 of a part that is a parent there (설계 v3 §2.3; members: a list). */
export type GroupAxis = 'place' | 'composition' | 'participants' | 'boundary' | 'members';
export const GROUP_AXES: readonly GroupAxis[] = ['place', 'composition', 'participants', 'boundary', 'members'];
/** A C-VARIANT row on the part whose interface it implements: its ID (X01), the interface (a K ID, 「B03: 자리」 or a P2-02 row), the
 * implementing part (as the record names it; 「사용자 지정」 is user), who chooses, how (지정 · 우선순위로 첫 가능 항목 · 실패하면 다음) and
 * when, the choice condition, whether it may be used beside the others and in what range (「배타(호출마다)」), and the row. */
export type VariantChoice = 'given' | 'first-available' | 'fallback';
export const VARIANT_CHOICES: readonly VariantChoice[] = ['given', 'first-available', 'fallback'];
// map-reading.19 (a v5 C-VARIANT row, 13.4): per-data, a variant chosen per kind of data (「자료마다(어떤 자료)」).
export type VariantTogether = 'exclusive' | 'combined' | 'unknown' | 'per-data';
export const VARIANT_TOGETHER: readonly VariantTogether[] = ['exclusive', 'combined', 'unknown', 'per-data'];
export interface ReadingVariant { recordRef: string; interfaceRef: string; implementer: string; selector: { who: string | null; how: VariantChoice | null; when: string | null };
  condition: string | null; together: VariantTogether; togetherScope: string | null; quote: ReadingQuote }
/** A C-ENTRY row on the part owning the entry: its ID (N01), the entry as written, how it is called, its order (「1) 」 of a script run by
 * hand), who calls it (as written) and its contract (a K ID or null), with the row. A code part with no resident entry is called only. */
export type EntryKind = 'command' | 'call' | 'request' | 'message' | 'schedule' | 'resident' | 'script';
export const ENTRY_KINDS: readonly EntryKind[] = ['command', 'call', 'request', 'message', 'schedule', 'resident', 'script'];
export interface ReadingEntryPoint { recordRef: string; name: string; kind: EntryKind | null; order: number | null; consumer: string | null; contractRef: string | null; quote: ReadingQuote }
/** A C-CONTRACT row on the part providing it: its ID (K01), its outside consumer, its surface and direction, the data, response, exit or
 * error it promises and the format version it holds for (each as written, null for —), with the row. */
export interface ReadingContract { recordRef: string; consumer: string | null; surface: string | null; spec: string | null; version: string | null; quote: ReadingQuote }
/** A step's C-STEP 조건·분기 clause: the condition (as written, null when the clause is only an outcome), the steps it goes to (B03:S06), a
 * bound on going back (「최대 3번」) and the outcome or refusal code it names. */
export interface ReadingStepBranch { when: string | null; to: string[]; max: string | null; outcome: string | null }
/** C-LINK 박자 and 경계 (3.1). */
export type CadenceKind = 'once' | 'call' | 'each' | 'periodic' | 'event' | 'end';
export const CADENCE_KINDS: readonly CadenceKind[] = ['once', 'call', 'each', 'periodic', 'event', 'end'];
export type CrossKind = 'same' | 'child' | 'process' | 'network' | 'person';
export const CROSS_KINDS: readonly CrossKind[] = ['same', 'child', 'process', 'network', 'person'];
/** C-CHANGE 관련 주체·역할: each 「역할: 주체」 (a contributor's or maintainer's account, a bot's name, an issue number). */
export type ActorRole = 'request' | 'propose' | 'author' | 'review' | 'merge';
export const ACTOR_ROLES: readonly ActorRole[] = ['request', 'propose', 'author', 'review', 'merge'];
export type ActorKind = 'owner' | 'maintainer' | 'contributor' | 'bot' | 'issue' | 'unknown';
export const ACTOR_KINDS: readonly ActorKind[] = ['owner', 'maintainer', 'contributor', 'bot', 'issue', 'unknown'];
export interface ReadingActor { role: ActorRole; kind: ActorKind; name: string | null; ref: string | null }
export type ContractChangeKind = 'breaking' | 'compatible' | 'none' | 'unknown';
export const CONTRACT_CHANGE_KINDS: readonly ContractChangeKind[] = ['breaking', 'compatible', 'none', 'unknown'];
export interface ReadingContractChange { kind: ContractChangeKind; ref: string | null }
export type ShippedKind = 'released' | 'unreleased' | 'unknown';
export const SHIPPED_KINDS: readonly ShippedKind[] = ['released', 'unreleased', 'unknown'];
export interface ReadingShippedIn { kind: ShippedKind; version: string | null }
// map-reading.19 (a v5 C-WITHDRAW row, 5.1): doc-only, 문서로만 폐기 (deprecated in the documents, no warning when run).
export type WithdrawalMethod = 'revert' | 'remove' | 'deprecate' | 'move' | 'default' | 'rejected' | 'reintroduce' | 'doc-only';
export const WITHDRAWAL_METHODS: readonly WithdrawalMethod[] = ['revert', 'remove', 'deprecate', 'move', 'default', 'rejected', 'reintroduce', 'doc-only'];
/** Who decided a rule and when (C-RULE 정한 이·언제; a v3 record's 누가 정했나·언제), as written: never what keeps it. */
export interface ReadingDecider { text: string; when: string | null; quote: ReadingQuote }
/** C-COND 갈리는 때. */
export type ConditionPhase = 'run' | 'config' | 'build';
export const CONDITION_PHASES: readonly ConditionPhase[] = ['run', 'config', 'build'];
/** A C-DONE row of a chunk: the table, how far it was written (작성 완료 · 일부 작성 · 해당 없음 · 확인 못함 · 분량상 이월), what it holds and what
 * is left (as written, null for —), with the chunk's record ID and number. */
export type CoverageState = 'done' | 'partial' | 'na' | 'unchecked' | 'deferred';
export const COVERAGE_STATES: readonly CoverageState[] = ['done', 'partial', 'na', 'unchecked', 'deferred'];
export interface ReadingCoverage { recordId: string | null; chunk: number | null; table: string; state: CoverageState; included: string | null; remaining: string | null; quote: ReadingQuote }
/** A C-DATA row: its ID (D01), name, kind (외부 계약 · 내부 자료 · 저장 · 메시지·신호) and contract (K ID), its shape as written when it is no
 * field list, the 「그 밖 N개」 it leaves out, where it is and how it is written (덧붙임 · 통째 교체 · 원자 교체, with what changes at once). */
export type ArtifactKind = 'contract' | 'internal' | 'store' | 'message';
export const ARTIFACT_KINDS: readonly ArtifactKind[] = ['contract', 'internal', 'store', 'message'];
export type WriteMode = 'append' | 'replace' | 'atomic';
export const WRITE_MODES: readonly WriteMode[] = ['append', 'replace', 'atomic'];
export interface ReadingArtifact { recordRef: string | null; name: string; kind: ArtifactKind | null; contractRef: string | null; shape: string | null; fieldsMore: number | null;
  where: string | null; writeMode: WriteMode | null; atomicScope: string | null; quote: ReadingQuote;
  /** map-reading.19 (a v5 C-DATA row, 13.3): the parts that share it with no direction (「공유: B05·B07」), by name; [] otherwise. Absent on .18. */
  sharedBy?: string[] }
/** A supplementary table (P1-01…P6-04) kept as written: its header, its rows (cells, row ID) and its 「없음:」 line. Read into fields in .44. */
export interface ReadingProfileTable { table: string; header: string[]; rows: { cells: string[]; recordRef: string | null; quote: ReadingQuote }[]; none: { text: string; quote: ReadingQuote } | null }
/** A table whose ID the reader does not know, kept as written (never dropped). */
export interface ReadingRecordExtra { table: string; header: string[]; rows: { cells: string[]; quote: ReadingQuote }[] }
/** What the program noticed reading a record's tables (a row past its header's width, an unknown table or column, a left-out column, a
 * v4 record with no chunk head, an entry whose consumer is no part, a loop body its steps do not belong to, a variant with no owner):
 * fixed categories and places only, never the record's words. */
export const RECORD_DIAGNOSTIC_CATEGORIES = ['row-cells', 'unknown-table', 'unknown-column', 'missing-column', 'chunk-head', 'entry-consumer', 'loop-body', 'variant-owner',
  // .44 (review N1): a model type left out for a C-PART 유형 word outside the list; a model loop given way to the part's C-LOOP row.
  'type-word', 'loop-replaced',
  // Recipe .45 (map-reading.19, a 기록 v5 record): a page with no head, and what folding its pages found (record-table.ts foldPages).
  'page-head', 'page-conflict', 'page-gap', 'page-prev', 'duplicate-id', 'replace-unknown', 'id-reused', 'row-id', 'out-of-order', 'reserve-unused', 'dangling-ref',
  'ref-deleted', 'end-mismatch', 'level-mismatch', 'cite-missing', 'cite-equals', 'cite-unread', 'cite-word', 'grade-source', 'part-added', 'drop-unknown',
  // Recipe .45 (review N4): a model part standing on no C-PART row of a v5 record.
  'part-no-row'] as const;
export interface ReadingRecordDiagnostic { category: typeof RECORD_DIAGNOSTIC_CATEGORIES[number]; table: string | null; column: string | null; record: string; from: number; to: number }
/** The record's focus line (K4): which question groups the record answered more of first; never a fact of the project. */
export interface ReadingFocus { profiles: string[]; reason: string | null; tables: string[]; quote: ReadingQuote }
/** map-reading.8: what a line carries: data (a row, a stream, a result handed over), control (an instruction, a wake-up, a
 * schedule firing, a report that makes someone act) or uses (a reference, a dependency; nothing travels). The record's own
 * wording decides; null when it does not say. */
export type Channel = 'data' | 'control' | 'uses';
export const CHANNELS: readonly Channel[] = ['data', 'control', 'uses'];
/** map-reading.10 (the map design spec's fourth cycle, §5 and §8.3): how far a rule claim (topic 'rule') reaches: its part as a
 * whole, one step, port or field of it (named in scopeName as the record writes it), or the whole project. The record's word. */
export type RuleScope = 'part' | 'step' | 'port' | 'field' | 'project';
export const RULE_SCOPES: readonly RuleScope[] = ['part', 'step', 'port', 'field', 'project'];
/** map-reading.10: where a rule applies, on a line that places it: 'stated' when the record's own line names the place (a design
 * record's condition row that implements the rule), 'inferred' when the record gives the rule and a separate line gives the place. */
export type AnchorKind = 'stated' | 'inferred';
export const ANCHOR_KINDS: readonly AnchorKind[] = ['stated', 'inferred'];
/** map-reading.10: what keeps a rule: code (a condition row, its outcome as text), a gate line, a person's own rule; 'none' when the
 * record explicitly says nothing was designed for it (기록상 미설계), 'unknown' when the record names no device (장치 미상). An empty
 * list is the reading saying nothing about it (비어 있음). */
export type EnforcerKind = 'code' | 'gate' | 'person' | 'none' | 'unknown';
export const ENFORCER_KINDS: readonly EnforcerKind[] = ['code', 'gate', 'person', 'none', 'unknown'];
/** map-reading.10: what a withdrawal (topic 'withdrawn') took back, as its row says: a design decision, an implementation (what runs),
 * or a report (an earlier account corrected). */
export type WithdrawalKind = 'design' | 'implementation' | 'report';
export const WITHDRAWAL_KINDS: readonly WithdrawalKind[] = ['design', 'implementation', 'report'];
/** map-reading.10: a gate of the next-gate table (a plan claim): 'run' a condition of operation on the path, 'dev' a condition of
 * development or deployment beside it. */
export type GateKind = 'run' | 'dev';
export const GATE_KINDS: readonly GateKind[] = ['run', 'dev'];
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
  /** map-reading.7: what the claim is about (null: the reading did not say). */
  topic?: ClaimTopic | null;
  /** map-reading.7: the author's own evidence tag on the line (null: none). */
  evidence?: EvidenceGrade | null;
  /** map-reading.7: the time the record names for this (as written, e.g. "11-02 23:04Z"), else null. */
  when?: string | null;
  /** map-reading.7: the file, path, sha or place the record names for this (as written), else null. */
  where?: string | null;
  /** map-reading.7, topic 'withdrawn' only: the decision as it stood before (as written); the text says what stands now. */
  before?: string | null;
  /** map-reading.10, topic 'rule' only: how far the rule reaches and, for a step, port or field, its name as written (else null). */
  scope?: RuleScope | null; scopeName?: string | null;
  /** map-reading.10, topic 'rule' only: where it applies (up to four), each on the line that places it; [] when no line does. */
  anchors?: ReadingAnchor[];
  /** map-reading.10, topic 'rule' only: what keeps it (up to four); [] when the reading said nothing of it. */
  enforcedBy?: ReadingEnforcer[];
  /** map-reading.10, topic 'withdrawn' only: what the withdrawal took back (null: the row does not say). */
  withdrawalKind?: WithdrawalKind | null;
  /** map-reading.10, topic 'plan' only: a gate of operation or of development (null: not a gate, or not said). */
  gate?: GateKind | null;
  /** map-reading.18 (pipeline .43), topic 'rule' only: who decided the rule and when (its row's 정한 이·언제, a v3 row's 누가 정했나·언제); never a device. */
  decidedBy?: ReadingDecider | null;
  /** map-reading.18, a change claim on a v4 C-CHANGE row: who did what (요청 only when a request was written), the merge date of 「작성 / 병합」,
   * the contract change (깨짐 · 호환 · — · 모름) and the release it shipped in. */
  actors?: ReadingActor[]; mergedWhen?: string | null; contractChange?: ReadingContractChange | null; shippedIn?: ReadingShippedIn | null;
  /** map-reading.18, a withdrawal on a v4 C-WITHDRAW row: how it was taken back (되돌림 · 제거 · 폐기 예정 · 옮김 · 기본값 바꿈 · 채택 안 함 · 다시 도입). */
  withdrawalMethod?: WithdrawalMethod | null;
  /** map-reading.19 (a claim on a v5 row): that row's cites ([] for any other claim), and a change's 찾은 길 (검색 · 최근 · 변경 기록). */
  cites?: ReadingCite[]; foundBy?: FoundBy | null;
}
/** map-reading.10: a place a rule applies, as written (80), with the line that places it. map-reading.11 (pipeline .34): program,
 * on every anchor of such an entry: true when the program, not the model, put it there (a candidate by shared words between the rule
 * and a condition row of its part's 「조건·거부·분기」 table, always inferred; the UI labels it 프로그램 후보); absent before .11. */
export interface ReadingAnchor { kind: AnchorKind; text: string; quote: ReadingQuote; program?: boolean }
/** map-reading.10: a device keeping a rule, as written (80), with the line that names it (null only for 'unknown'). map-reading.15
 * (pipeline .40): program, on every device of such an entry: true when the program, not the model, put it there (the code device of a
 * 「조건·거부·분기」 row whose 참이면 refuses, where a place of the rule stands; always code on that row; the UI labels it 프로그램); absent
 * before .15. */
export interface ReadingEnforcer { kind: EnforcerKind; text: string; quote: ReadingQuote | null; program?: boolean }
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
  /** map-reading.7: the state the record gives the part in its own words, with when it says so and the line that says it. */
  state?: PartState | null; stateWhen?: string | null; stateQuote?: ReadingQuote | null;
  /** map-reading.7: the files, folders or units the record names as this part's (as written, up to six). */
  files?: string[];
  /** map-reading.8: the record's own type word for the part (PART_TYPES) and the line that says it; null when none. */
  type?: PartType | null; typeQuote?: ReadingQuote | null;
  /** map-reading.8: what the part receives and hands over, by the record's names of them (up to six each), the fields of its
   * rows when it is a store (up to twelve) and the settings the record lists for it (up to four), each as written.
   * map-reading.9: up to eight inputs, eight outputs, 24 fields and eight settings. */
  inputs?: string[]; outputs?: string[]; fields?: string[]; config?: string[];
  /** map-reading.9: the steps inside the part, one per row of the record's own table of inner steps (up to twelve, each on its row). */
  steps?: ReadingStep[];
  /** map-reading.9: how the part repeats, stops and resumes as the record says (each null when not said); null when none. */
  loop?: ReadingLoop | null;
  /** map-reading.9: the state the part keeps (up to eight), as the record names it. */
  stateVars?: ReadingStateVar[];
  /** map-reading.12: the part's condition rows (up to 24), one per row of the record's 「조건·거부·분기」 table, each on its row; [] when
   * the reading said none. They stand outside the claims (whose cap is twenty). */
  conditions?: ReadingCondition[];
  /** map-reading.14: the part's 「파일 지도」 rows (up to twelve): the row's path and 역할 한 줄 as written, each on its row; [] when the
   * reading said none. The files list (files) stays as it was. */
  fileRoles?: ReadingFileRole[];
  /** map-reading.18 (pipeline .43): the part's C-PART row ID (B03; resolves the record's own references only), its 구현 상태 with the row, its
   * list items, its C-GROUP 묶음 뜻 as a parent, its C-STATUS rows, C-LOOP rows, the C-VARIANT rows of its interfaces, its C-ENTRY rows and the
   * C-CONTRACT rows it provides. A v4 part's state is the program's (4.6: running only from 운영 상태 「실행 중」). */
  recordRef?: string | null; implementation?: PartImplementation | null; implementationQuote?: ReadingQuote | null; members?: ReadingMembers | null;
  groupAxis?: GroupAxis | null; groupAxisQuote?: ReadingQuote | null; statusClaims?: ReadingStatusClaim[]; loops?: ReadingRecordLoop[]; variants?: ReadingVariant[];
  entries?: ReadingEntryPoint[]; contracts?: ReadingContract[];
  /** map-reading.19 (recipe .45): the part's family (C-PART 표현군; a v4 or v3 type word read through the unambiguous words only), its role
   * word as written (a v4 type word kept when its family is unclear: familyUnclear, 「대응 불명확」), 미정's reason, and the row; whether
   * the part came 「추가」 after page 1; its C-STATE rows; its C-PART row's cites. Every key on a .19 entry; absent before. */
  family?: RecordFamily | null; familyRole?: string | null; familyReason?: FamilyReason | null; familyQuote?: ReadingQuote | null; familyUnclear?: boolean;
  added?: boolean; states?: ReadingPartState[]; cites?: ReadingCite[];
}
/** map-reading.14: a 「파일 지도」 row of a part: its path (120) and role (80) as written, with the row. */
export interface ReadingFileRole { path: string; role: string; quote: ReadingQuote;
  /** map-reading.18: true when the row's path says 「(실행 시)」 (a layout made at run time). */
  runtime?: boolean }
/** map-reading.12: a condition row of a part as written: its condition (80), what follows when it holds (60) and when it does not
 * (60, null when not said), with the row. */
export interface ReadingCondition { when: string; then: string; else: string | null; quote: ReadingQuote;
  /** map-reading.18: when it branches (C-COND 갈리는 때: run, config read, build), null when not said. */
  phase?: ConditionPhase | null }
/** map-reading.9: one step inside a part, as one row of the record's table of inner steps names it: its name, what it does (null
 * when the row says nothing), the files, functions or models it uses (up to four) and that row. The order, branches and loops
 * between steps are not read in this cycle (no relation between steps). */
export interface ReadingStep { name: string; does: string | null; uses: string[]; quote: ReadingQuote;
  /** map-reading.14 (pipeline .39): true when the program put it there (a piece of the part's own 3절 arrow chain where the records
   * give it no 4절 row; it does nothing and uses nothing as read; the UI labels it 프로그램); absent before .14. */
  program?: boolean;
  /** map-reading.17 (pipeline .42): the 조건·분기 cell of the step's own 「안의 단계」 row as written (120; null where the row has none,
   * a dash, or no such row), read by the program from the record, never the model's words; absent before .17. */
  when?: string | null;
  /** map-reading.18 (pipeline .43): the step's C-STEP row ID (B03:S02), the loops it runs in (C-STEP 소속 반복 ID, 「+」 for two), the branch
   * group it is one of (S04a: { group: 'S04', branch: 'a' }), its 조건·분기 cell read into clauses, and a model it uses (「모델: …」). */
  recordRef?: string | null; loopIds?: string[]; alt?: { group: string; branch: string } | null; branch?: ReadingStepBranch[]; model?: string | null;
  /** map-reading.19: the cites of the step's v5 C-STEP row ([] otherwise). */
  cites?: ReadingCite[] }
/** map-reading.9: the unit a part repeats, what stops it and what resumes it, each as written and on its own (null: not said),
 * with the line that says so. */
export interface ReadingLoop { unit: string | null; stop: string | null; resume: string | null; quote: ReadingQuote;
  /** map-reading.13 (pipeline .37): true when the program filled an item of the loop (a unit from the part's own cadence setting, a
   * stop or resume from one of its condition rows; the model's own items stay as read; the UI labels it 프로그램); absent before .13. */
  program?: boolean }
/** map-reading.9: a state a part keeps: its name, where it holds (null: not said), the steps or parts that read and change it. */
export interface ReadingStateVar { name: string; scope: string | null; readBy: string[]; changedBy: string[];
  /** map-reading.13 (pipeline .37): true when the program put it there (a dotted variable of a condition the records call kept state;
   * by name only: no scope, readers or changers); absent before .13. */
  program?: boolean }
/** map-reading.9: where the record explicitly maps a line of the map onto a port (an input or output name) and a step of the part
 * at that end ('in': the line's receiver, 'out': its sender), with the line that says so. Only explicit correspondences. */
export interface ReadingPortMap { relationId: string; areaId: string; port: string; step: string; direction: 'in' | 'out'; quote: ReadingQuote;
  /** map-reading.14 (pipeline .39): true when the program put it there (the one step of that end the records tie to the other end; its
   * quote is that step's row; the UI labels it 프로그램); absent before .14. */
  program?: boolean }
export interface ReadingRelation { relationId: string; from: string; to: string; kind: RelationKind; quote: ReadingQuote;
  /** map-reading.7: what is handed over (as the record names it), how often or when, and whether the record designed or saw it. */
  payload?: string | null; cadence?: string | null; mode?: RelationMode | null;
  /** map-reading.8: what the line carries (CHANNELS), as the record's wording says; null when it does not. */
  channel?: Channel | null;
  /** map-reading.13: the fields of the format artifact the line carries (a 산출물 row at HTTP, 메모리 or a request), up to 24 of 60
   * as written; [] when not said. The UI shows them on the line's chip, never as a node. */
  payloadFields?: string[];
  /** map-reading.18 (pipeline .43), a line on a v4 C-LINK row: its 조건·선택 as written (when; optional unless —; the variant it flows for),
   * its 경계, its 박자 word, the C-DATA row its 넘기는 것 names first (D03), the 통로 it goes by and the list item (「목록: 항목」) it stands for. */
  when?: string | null; optional?: boolean; variantRef?: string | null; crosses?: CrossKind | null; cadenceKind?: CadenceKind | null; payloadRef?: string | null; via?: string | null; member?: string | null;
  /** map-reading.19, a line on a v5 C-LINK row: its 주장 성격 (12.2; mode observed only for 실행 관측 with a run-grade cite) and the row's cites. */
  claimNature?: ClaimNature | null; cites?: ReadingCite[] }
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
/** A validator exclusion, not model text. The optional place names the original, unshortened source range. */
export const READING_EXCLUSION_RULES = ['settled-and-open', 'duplicate-target', 'duplicate-key', 'material-evidence', 'reference', 'length', 'source-kind', 'condition-form', 'condition-source', 'condition-length', 'contract'] as const;
export interface ReadingExclusion { path: string; rule: typeof READING_EXCLUSION_RULES[number]; category: string | null; explanation: string; record: string | null; from: number | null; to: number | null;
  /** Pipeline .38 (map-reading.13, optional): an input or output set aside as written (≤60, never secret-like), its record cell in
   * record/from/to; only on parts[i].inputs[j] and parts[i].outputs[j]. Exclusions without it keep their exact shape. */
  value?: string }
export interface MapReading {
  version: 'map-reading.1' | 'map-reading.2' | 'map-reading.3' | 'map-reading.4' | 'map-reading.5' | 'map-reading.6' | 'map-reading.7' | 'map-reading.8' | 'map-reading.9' | 'map-reading.10' | 'map-reading.11' | 'map-reading.12' | 'map-reading.13' | 'map-reading.14' | 'map-reading.15' | 'map-reading.16' | 'map-reading.17' | 'map-reading.18' | 'map-reading.19' | 'map-reading.20'; id: string; at: string; model: string; prompt: string;
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
  /** map-reading.6–7: durable exclusions; previous reading versions keep their exact original shape. map-reading.7: claims may
   * carry topic, evidence, when, where and before; parts state, stateWhen, stateQuote and files; relations payload, cadence and mode. */
  exclusions?: ReadingExclusion[];
  /** map-reading.8: the time the records themselves name as their basis ("2026-11-03 09:0xZ 기준") and the target version they
   * explicitly describe (a commit, a tag), each as written and only when a record says so; null otherwise (never the time the
   * record arrived, never a hash that merely appears). Parts carry type, typeQuote, inputs, outputs, fields and config; relations
   * carry channel. */
  basisAt?: string | null; basisVersion?: string | null;
  /** map-reading.9: the record's explicit correspondences of a line to a port and a step (parts carry steps, loop and stateVars).
   * map-reading.10: claims carry scope, scopeName, anchors, enforcedBy, withdrawalKind and gate. map-reading.11: each anchor carries
   * program (the program's candidate or the model's place). map-reading.12: parts carry conditions. map-reading.13: loops and kept
   * states carry program, relations payloadFields. map-reading.14: parts carry fileRoles, steps and port-map rows program. map-reading.15:
   * rule devices carry program, a reading holds up to 24 port-map rows and a program step's does may hold its name's tail.
   * map-reading.16: a part holds sixteen steps and twelve settings, and a program device may be a person on its row (a hand-kept rule).
   * map-reading.17: a summary runs to 360, a step name and a port-map row's step to 60, a cadence to 80, a file-map row's role to 120,
   * and a program device may be
   * unknown with no passage (a rule whose decider device was set aside, nothing else found). */
  portMap?: ReadingPortMap[];
  /** map-reading.18 (pipeline .43, a 기록 v4 record): what its C-BASIS says it read, its focus line, the C-STATUS rows of the project or of
   * a unit no part is, the C-GATE 「없음:」 line (no gate, checked), the C-DONE rows, the C-DATA rows, the supplementary tables as written,
   * the tables no reader knows and what the program noticed reading the tables. A v3 record leaves each null or []. */
  basisScope?: { text: string; quote: ReadingQuote } | null; focus?: ReadingFocus | null; projectStatus?: ReadingProjectStatus[]; gatesNone?: { reason: string; quote: ReadingQuote } | null;
  coverage?: ReadingCoverage[]; artifacts?: ReadingArtifact[]; profileTables?: ReadingProfileTable[]; recordExtras?: ReadingRecordExtra[]; recordDiagnostics?: ReadingRecordDiagnostic[];
  /** map-reading.19 (recipe .45, a 기록 v5 record): the level the app computed (0 · 1 첫 구조 · 2 상세; null with no v5 record), the folded pages,
   * the remaining obligations, the C-END rows, the C-CHECK rows, the C-HEAD defaults and its 첫 구조 줄 (neither a claim of the project). */
  level?: 0 | 1 | 2 | null; pages?: ReadingPage[]; obligations?: ReadingObligation[]; pageEnds?: ReadingPageEnd[]; checks?: ReadingCheck[]; defaults?: ReadingDefault[]; firstLines?: string[];
  /** map-reading.20 (recipe .50, row-ledger.ts): what this reading did with each row of a 기록 v5 record it sent or left out for room. Only a
   * reading that sent a v5 fold is .20; every earlier entry keeps its exact shape and is read by the same rule on the fly. */
  rows?: ReadingRow[];
  /** Recipe .50 step 5 (map-identity.ts, 기록 요청 v5.2): what this reading decided for each row of the C-IDENT tables of the v5 records it
   * sent (the record's own correspondence of the map's parts to its B rows, read by the program alone), with the operation a row applied:
   * rename, retire (with its successor) or fold (a map-made duplicate onto one canonical part). Only on a .20 reading that had such rows. */
  identity?: ReadingIdentityRow[];
}
/* ---------- Recipe .50 step 5 (Astra F5 Q2/Q3/Q6/Q7(5)): the C-IDENT table of a 기록 v5.2 record, as the program decided it. ---------- */
/** 대응: 같음 / 이름 바뀜 / 대신함 / 없어짐 / 모름; 나뉨 and 합침 are kept as written and are unsupported in .50. */
export const IDENTITY_ANSWERS = ['same', 'renamed', 'replaced', 'gone', 'unknown', 'split', 'merged'] as const;
export type IdentityAnswer = typeof IDENTITY_ANSWERS[number];
export const IDENTITY_OPS = ['bind', 'rename', 'retire', 'fold'] as const;
/** What a reflected row did: bind (the record's B row is that part), rename (the part's official name became `to`; `from` stays its old
 * name; renamed: the shown name changed too, false when the person's own name stays), retire (the part is no longer current, with its
 * successor part or null) or fold (areaId, a duplicate the map made, is the canonical part `into`; its references resolve there). */
export interface ReadingIdentityOp { kind: typeof IDENTITY_OPS[number]; areaId: string; successor: string | null; into: string | null; from: string | null; to: string | null; renamed: boolean }
export interface ReadingIdentityRow {
  /** The record (its fold key) and the row's own ID (ID01). */
  record: string; id: string;
  /** The map part as the row names it (P23; null when it names none), its 대응 (null when no fixed word) and its B ID (null for none). */
  map: string | null; answer: IdentityAnswer | null; part: string | null;
  state: RowState; reason: string | null;
  /** The part the row names as it resolves now (a folded duplicate resolves to its canonical part), null when none does. */
  areaId: string | null;
  /** The operation this reading applied on the row (null: none, or one an earlier reading applied already). */
  op: ReadingIdentityOp | null;
  /** 바뀐 때 as written (60), and the F and E IDs the row cites (up to eight). */
  when: string | null; evidence: string[];
  /** Where the row stands: the pasted text and its [from, to). */
  at: { record: string; from: number; to: number } }
/* ---------- map-reading.20 (recipe .50, Astra F5 Q5): the row-processing ledger. Every current row of a 기록 v5 record's tables (the ledgers
 * and the page frame aside) has a state per (record, table, row ID): reflected (the map items it became), waiting (why not yet), held (what
 * it conflicts with) or rejected (a concrete reason). Parsed is never reflected: a row inside a read interval with nothing on it waits. ---------- */
export const ROW_STATES = ['reflected', 'waiting', 'held', 'rejected'] as const;
export type RowState = typeof ROW_STATES[number];
/** Why a row is in its state (reflected has none). waiting: limit (an item on it past a bound, or the reading used its whole allowance),
 * budget (left out of the ask for room), unresolved-endpoint (a part it names has no reflected C-PART row yet), transient (sent and not
 * placed for no other reason, or an item on it set aside for its form), not-yet-sent; held: the candidate's target (identity, parent,
 * attribution, holds), depends (a row it names is held) or correction (recipe .50 step 2: an unmet correction obligation's unit stands on
 * it, map-blueprint.mjs holdCorrectionUnits); rejected: material (the reading kept it as material), depends (a row it names
 * was rejected) or unplaced (sent again as often as the ledger allows, never placed). */
export const ROW_REASONS: Readonly<Record<RowState, readonly string[]>> = Object.freeze({ reflected: [],
  waiting: ['limit', 'budget', 'unresolved-endpoint', 'transient', 'not-yet-sent'], held: ['identity', 'parent', 'attribution', 'holds', 'depends', 'correction', 'roster', 'revision'],
  // Recipe .50 step 5 (C-IDENT rows only): held roster (the map changed under the part since the record's roster, or the reply's roster line is
  // missing); rejected form, unknown-part, other-project, unsupported (나뉨·합침), undecided (모름), planned and partial (nothing is retired).
  // Review of .50: rejected unconfirmed (a C-IDENT retirement with no time it took effect, or a successor not said to be built) and, for any
  // row, unsupported (it stands only on a reading field the app never shows: kept in the reading, not reflected, not sent again).
  // Recipe .51: held revision (a final review's second revision verdict held the part the row stands on; the row goes once more), then
  // rejected revision (held so again: never sent a third time).
  rejected: ['material', 'depends', 'unplaced', 'form', 'unknown-part', 'other-project', 'unsupported', 'undecided', 'planned', 'partial', 'unconfirmed', 'revision'] });
/** What a reflected row became: a part (its basis or a field of it), one of its claims (index in this reading's part entry), a relation, or a
 * field of the reading itself (checks, projectStatus, …: id is the field's name). */
export interface ReadingRowTarget { kind: 'part' | 'claim' | 'relation' | 'reading'; id: string; index: number | null }
export interface ReadingRow { record: string; table: string; id: string; state: RowState; reason: string | null;
  /** The last exclusion category seen on the row (transient, unplaced), else null. */
  detail: string | null;
  /** How many readings have sent the row so far, this one included (a row left out for room is not sent). */
  sent: number;
  /** reflected: up to eight targets; held: the parts it conflicts with (up to four). Empty otherwise. */
  to: ReadingRowTarget[]; with: string[] }
/** The person's own correction of a part's description as read (never Area.note, never a return.2 description): it names the
 * reading whose description it corrects. It holds that description only; later claims of later readings still come in. */
export interface ReadingCorrection { version: 'map-correction.1'; id: string; at: string; areaId: string; text: string; corrects: string | null }
/* ---------- The scenario record (시나리오 기록 v2, spec §8.2–8.3) as the app read it, without any AI: scenario-reading.1. ---------- */
/** A cell as the record says it: its own words, '모름' (or an empty cell) as 'unknown', '없음' as null. */
export type ScenarioSaid = string | 'unknown' | null;
export type ScenarioKind = 'designed' | 'observed' | 'tour';
export const SCENARIO_KINDS: readonly ScenarioKind[] = ['designed', 'observed', 'tour'];
export type ScenarioLinkKind = 'next' | 'branch' | 'parallel' | 'loop' | 'wait';
export const SCENARIO_LINK_KINDS: readonly ScenarioLinkKind[] = ['next', 'branch', 'parallel', 'loop', 'wait'];
/** complete: no visit or link set aside and the last confirmed point is the visit the end reaches; partial: something set aside
 * or the path stops short of the end; rejected: the scenario's identity failed or no visit holds (no path is drawn). */
export type ScenarioPathStatus = 'complete' | 'partial' | 'rejected';
export const SCENARIO_PATH_STATUSES: readonly ScenarioPathStatus[] = ['complete', 'partial', 'rejected'];
/** Ledger references as resolved when the record was read: the ledger id the record wrote (P01, S03, …; it lives only in the
 * request text) and the app's own target behind it at that time (the area id, the step's or port's name, the relation id). */
export interface ScenarioPartRef { ref: string; areaId: string; name: string }
export interface ScenarioStepRef { ref: string; name: string }
export interface ScenarioPortRef { ref: string; name: string; direction: 'in' | 'out' }
export interface ScenarioArtifactRef { ref: string; name: string }
export interface ScenarioRuleRef { ref: string; areaId: string; text: string }
export interface ScenarioRelationRef { ref: string; relationId: string; along: boolean }
/** '보고' or '추정' written where an E id belongs (common rule 13). */
export type ScenarioEvidenceWord = 'report' | 'guess';
export interface ScenarioIdentity { id: string; name: ScenarioSaid; requestRef: ScenarioSaid; ledgerVersion: ScenarioSaid; designVersion: ScenarioSaid;
  basisAt: ScenarioSaid; kind: ScenarioKind | null; runRef: ScenarioSaid; reason: ScenarioSaid; evidence: string[]; evidenceWord: ScenarioEvidenceWord | null }
export interface ScenarioTarget { part: ScenarioPartRef; port: ScenarioPortRef | null; step: ScenarioStepRef | null }
export interface ScenarioStart { id: string; trigger: ScenarioSaid; target: ScenarioTarget | 'unknown' | null; condition: ScenarioSaid; rules: ScenarioRuleRef[];
  prior: ScenarioSaid; independent: ScenarioSaid; evidence: string[]; evidenceWord: ScenarioEvidenceWord | null }
export interface ScenarioVisit { id: string; part: ScenarioPartRef; step: ScenarioStepRef | 'unknown' | null; port: ScenarioPortRef | 'unknown' | null;
  in: ScenarioArtifactRef[] | 'unknown'; out: ScenarioArtifactRef[] | 'unknown'; event: ScenarioSaid; evidence: string[]; evidenceWord: ScenarioEvidenceWord | null }
/** relation null: a tour's reading order (투어 읽기 순서), never an execution line. along: the relation runs from → to as the link does. */
export interface ScenarioLink { id: string; from: string; to: string; relation: ScenarioRelationRef | null; kind: ScenarioLinkKind; condition: ScenarioSaid;
  rules: ScenarioRuleRef[]; policy: ScenarioSaid; evidence: string[]; evidenceWord: ScenarioEvidenceWord | null }
/** reached and lastConfirmedVisit: a visit of this record, or not known. lastConfirmed is the cell as written. */
export interface ScenarioEnd { id: string; reached: string | 'unknown' | null; produced: ScenarioSaid; desired: ScenarioSaid; exits: string[] | 'unknown';
  lastConfirmed: ScenarioSaid; lastConfirmedVisit: string | null; gap: ScenarioSaid; evidence: string[]; evidenceWord: ScenarioEvidenceWord | null }
export type ScenarioMaterial = 'file' | 'run' | 'report';
export type ScenarioStance = 'stated' | 'report' | 'guess';
export interface ScenarioEvidence { id: string; supports: ScenarioSaid; material: ScenarioMaterial; source: ScenarioSaid; versionOrRun: ScenarioSaid;
  /** The exact quote as written (≤240), null when the record says the original was not provided. */
  quote: string | null; stance: ScenarioStance }
export interface ScenarioPortMapRow { id: string; relation: ScenarioRelationRef; areaId: string; port: ScenarioPortRef; step: ScenarioStepRef; direction: 'in' | 'out'; evidence: string[] }
export type ScenarioGapReason = 'unmentioned' | 'no-material' | 'not-in-ledger' | 'conflict' | 'cap';
export const SCENARIO_GAP_REASONS: readonly ScenarioGapReason[] = ['unmentioned', 'no-material', 'not-in-ledger', 'conflict', 'cap'];
/** refs: the ledger and visit ids of the related cell that resolved; related: that cell as written. */
export interface ScenarioGap { id: string; refs: string[]; related: ScenarioSaid; what: ScenarioSaid; source: ScenarioSaid; reason: ScenarioGapReason; needed: ScenarioSaid }
/** When the path is rejected, the end's sentences that stand on their own (what the design produces, what is wanted, the exits). */
export interface ScenarioStatement { kind: 'produced' | 'desired' | 'exit'; text: string; evidence: string[] }
export interface ScenarioRecord { scenario: ScenarioIdentity | null; start: ScenarioStart | null; visits: ScenarioVisit[]; links: ScenarioLink[]; end: ScenarioEnd | null;
  evidence: ScenarioEvidence[]; portMaps: ScenarioPortMapRow[]; gaps: ScenarioGap[]; statements: ScenarioStatement[] }
/** A row, a cell or a reference the app set aside (the record itself stays as pasted). path names the table row as written
 * (visits[2] is the third row of the visit table), never a renumbered position. */
export interface ScenarioDiagnostic { path: string; rule: 'contract'; category: string; explanation: string }
export interface ScenarioReading { version: 'scenario-reading.1'; id: string; at: string;
  /** The pasted record read, and the ledger version (the map reading id) the record was read against (null: no map reading). */
  record: string; ledgerVersion: string | null; pathStatus: ScenarioPathStatus; scenario: ScenarioRecord; diagnostics: ScenarioDiagnostic[] }
export type ReadingEntry = MapReading | ReadingCorrection | RequestCorrection | ReplaceCorrection | ScenarioReading;
export const isMapReading = (e: ReadingEntry): e is MapReading => e.version === 'map-reading.1' || e.version === 'map-reading.2' || e.version === 'map-reading.3' || e.version === 'map-reading.4' || e.version === 'map-reading.5' || e.version === 'map-reading.6' || e.version === 'map-reading.7' || e.version === 'map-reading.8' || e.version === 'map-reading.9' || e.version === 'map-reading.10' || e.version === 'map-reading.11' || e.version === 'map-reading.12' || e.version === 'map-reading.13' || e.version === 'map-reading.14' || e.version === 'map-reading.15' || e.version === 'map-reading.16' || e.version === 'map-reading.17' || e.version === 'map-reading.18' || e.version === 'map-reading.19' || e.version === 'map-reading.20';
export const isScenarioReading = (e: ReadingEntry): e is ScenarioReading => e.version === 'scenario-reading.1';
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
