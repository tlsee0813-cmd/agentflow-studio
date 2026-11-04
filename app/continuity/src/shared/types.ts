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
   * ever added parts and relations; it never renamed, moved, archived or re-described an existing part. */
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
export type PartType = 'collector' | 'compute' | 'ai' | 'loop' | 'timer' | 'actor' | 'store' | 'person' | 'session' | 'external';
export const PART_TYPES: readonly PartType[] = ['collector', 'compute', 'ai', 'loop', 'timer', 'actor', 'store', 'person', 'session', 'external'];
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
}
/** map-reading.14: a 「파일 지도」 row of a part: its path (120) and role (80) as written, with the row. */
export interface ReadingFileRole { path: string; role: string; quote: ReadingQuote }
/** map-reading.12: a condition row of a part as written: its condition (80), what follows when it holds (60) and when it does not
 * (60, null when not said), with the row. */
export interface ReadingCondition { when: string; then: string; else: string | null; quote: ReadingQuote }
/** map-reading.9: one step inside a part, as one row of the record's table of inner steps names it: its name, what it does (null
 * when the row says nothing), the files, functions or models it uses (up to four) and that row. The order, branches and loops
 * between steps are not read in this cycle (no relation between steps). */
export interface ReadingStep { name: string; does: string | null; uses: string[]; quote: ReadingQuote;
  /** map-reading.14 (pipeline .39): true when the program put it there (a piece of the part's own 3절 arrow chain where the records
   * give it no 4절 row; it does nothing and uses nothing as read; the UI labels it 프로그램); absent before .14. */
  program?: boolean;
  /** map-reading.17 (pipeline .42): the 조건·분기 cell of the step's own 「안의 단계」 row as written (120; null where the row has none,
   * a dash, or no such row), read by the program from the record, never the model's words; absent before .17. */
  when?: string | null }
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
  payloadFields?: string[] }
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
  version: 'map-reading.1' | 'map-reading.2' | 'map-reading.3' | 'map-reading.4' | 'map-reading.5' | 'map-reading.6' | 'map-reading.7' | 'map-reading.8' | 'map-reading.9' | 'map-reading.10' | 'map-reading.11' | 'map-reading.12' | 'map-reading.13' | 'map-reading.14' | 'map-reading.15' | 'map-reading.16' | 'map-reading.17'; id: string; at: string; model: string; prompt: string;
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
}
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
export const isMapReading = (e: ReadingEntry): e is MapReading => e.version === 'map-reading.1' || e.version === 'map-reading.2' || e.version === 'map-reading.3' || e.version === 'map-reading.4' || e.version === 'map-reading.5' || e.version === 'map-reading.6' || e.version === 'map-reading.7' || e.version === 'map-reading.8' || e.version === 'map-reading.9' || e.version === 'map-reading.10' || e.version === 'map-reading.11' || e.version === 'map-reading.12' || e.version === 'map-reading.13' || e.version === 'map-reading.14' || e.version === 'map-reading.15' || e.version === 'map-reading.16' || e.version === 'map-reading.17';
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
