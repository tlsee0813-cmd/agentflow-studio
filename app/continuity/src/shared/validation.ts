import { API_SCHEMA, SCHEMA, V5_SCHEMA, V4_SCHEMA, V3_SCHEMA, PREVIOUS_SCHEMA, LEGACY_SCHEMA, RESULT_SCHEMA, RESULT2_SCHEMA, RESULT_BYTES, RESULT_TEXT_LIMIT, TEXT_LIMIT, FILE_LIMIT, ITEM_LIMIT, REQUEST_BYTES, type Intent, type Background, type ResultFile, type ExportRecord, type Task, type Advice, type Basis, type ContextBasis, type ContextRequest, type Envelope, type Project, type Source, type Ticket, type Question, GUIDE_SCHEMA, type GuideRequest, type GuideReply, type GuideEnvelope, type GuideTicket, type UnderstandingInput } from './types.js';
import {ROW_STATES,ROW_REASONS,type RowState,V6_SCHEMA,V7_SCHEMA,V8_SCHEMA,V9_SCHEMA,V10_SCHEMA,V11_SCHEMA,V12_SCHEMA,V13_SCHEMA,type ReadingEntry,type PastedRecord,READING_EXCLUSION_RULES,CLAIM_KINDS,CLAIM_TOPICS,EVIDENCE_GRADES,RULE_SCOPES,ANCHOR_KINDS,ENFORCER_KINDS,WITHDRAWAL_KINDS,GATE_KINDS,PART_STATES,PART_TYPES,PART_TYPES_17,PART_IMPLEMENTATIONS,STATUS_DIMENSION_KINDS,STATUS_VALUE_KINDS,GROUP_AXES,VARIANT_CHOICES,VARIANT_TOGETHER,ENTRY_KINDS,CADENCE_KINDS,CROSS_KINDS,ACTOR_ROLES,ACTOR_KINDS,CONTRACT_CHANGE_KINDS,SHIPPED_KINDS,WITHDRAWAL_METHODS,CONDITION_PHASES,COVERAGE_STATES,ARTIFACT_KINDS,WRITE_MODES,RECORD_DIAGNOSTIC_CATEGORIES,RECORD_FAMILIES,FAMILY_REASONS,CITE_GRADES,CLAIM_NATURES,STATUS_SCOPE_KINDS,FOUND_BY,OBLIGATION_KINDS,type StatusDimension,CHANNELS,RELATION_MODES,SCENARIO_KINDS,SCENARIO_LINK_KINDS,SCENARIO_PATH_STATUSES,SCENARIO_GAP_REASONS,READINGS_LIMIT,PASTED_TEXT_LIMIT,PASTED_LIMIT,type Area,type PlanStamp,type Point,type ManualPositions,type Backup} from './types.js';
import { validateFrozenRequest, validateStoredMatch, hasTarget, matchLedger, recordTextMap, type FrozenRequest, type StoredRequestMatch, type RecordText } from './request-return.js';
import { ANCHOR_QUOTE_MAX, textDigest } from './evidence-span.js';
import { validEvidence, recordIdentity } from './record-source.js';
import { secretLike } from './secret.js';
export class ContextError extends Error { constructor(code: string) { super(code); this.name = 'ContextError'; } }
export function ensure(condition: unknown, code = 'INVALID_DATA'): asserts condition { if (!condition) throw new ContextError(code); }
function obj(v: unknown, keys: string[]): asserts v is Record<string, unknown> {
  ensure(v !== null && typeof v === 'object' && !Array.isArray(v));
  ensure(Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)));
}
export function text(v: unknown, max = TEXT_LIMIT, empty = false): asserts v is string {
  ensure(typeof v === 'string' && v.length <= max && (empty || !!v.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v));
}
function list(v: unknown, max = ITEM_LIMIT): asserts v is unknown[] { ensure(Array.isArray(v) && v.length <= max); }
function integer(v: unknown) { ensure(Number.isSafeInteger(v) && (v as number) >= 0); }
function id(v: unknown) { text(v, 100); ensure(/^[A-Za-z0-9_-]+$/.test(v as string)); }
function date(v: unknown) { text(v, 30); ensure(Number.isFinite(Date.parse(v as string)) && new Date(v as string).toISOString() === v); }
function unique(items: {id: string}[]) { ensure(new Set(items.map(x => x.id)).size === items.length); }
/** The text a source stands for as a record (what a map reading is sent, quotes, stores and marks): a returned report or evidence
 * as received in its return file, without the app's own label prefix; any other source as it is. One choice for every reader. */
export function sourceText(tasks: readonly Task[], s: Source): string {
  const t = tasks.find(x => x.id === s.taskId);
  if (t?.resultFile && (s.kind === 'report' || s.kind === 'evidence')) { const f = parseResultFile(t.resultFile.rawText); return (s.kind === 'report' ? f.report : f.evidence) ?? s.text; }
  return s.text;
}
/** A file is untrusted data, not an authenticated execution receipt. Never repair/truncate it. */
export function parseResultFile(raw: string): ResultFile {
  ensure(typeof raw==='string' && new TextEncoder().encode(raw).length<=RESULT_BYTES,'RESULT_TOO_LARGE');
  ensure(!raw.startsWith('\uFEFF'),'INVALID_RESULT_FILE');
  const v:unknown=JSON.parse(raw);
  // AREA17: return.2 = return.1 + one required 'understanding' key (null or an organised area description).
  const two=!!v&&typeof v==='object'&&(v as {schemaVersion?:unknown}).schemaVersion===RESULT2_SCHEMA;
  obj(v,['schemaVersion','projectId','taskId','returnId','report','evidence',...(two?['understanding']:[])]);
  ensure(v.schemaVersion===RESULT_SCHEMA||two,'INVALID_RESULT_FILE');
  if(two&&v.understanding!==null)understandingInput(v.understanding);
  id(v.projectId); id(v.taskId); id(v.returnId);
  text(v.report,RESULT_TEXT_LIMIT); if(v.evidence!==null)text(v.evidence,RESULT_TEXT_LIMIT);
  return v as unknown as ResultFile;
}
/** AREA17 limits: a short current description, at most three key changes, one optional proposal. Never repaired. */
export const SUMMARY_LIMIT=2000, CHANGE_LIMIT=300, PROPOSAL_LIMIT=1000;
function understandingInput(v:unknown): asserts v is UnderstandingInput {
  obj(v,['version','areaId','basedOn','summary','changes','proposal','origin']);ensure(v.version==='understanding.1');
  id(v.areaId);integer(v.basedOn);text(v.summary,SUMMARY_LIMIT);list(v.changes,3);for(const c of v.changes)text(c,CHANGE_LIMIT);
  if(v.proposal!==null)text(v.proposal,PROPOSAL_LIMIT);text(v.origin,200);
}
/** Prefix is Studio metadata; the following external field remains character-for-character intact. */
export function resultSourceText(f:ResultFile, revision:number, kind:'report'|'evidence'):string {
  const prefix=`[Studio 연결 표지 — 외부 파일의 주장과 구분]\n이 자료는 작업 ${f.taskId}의 인계 ${f.returnId} / r${revision}에 대한 반환이다. 현재 조건 충족·사용자 결정·실제 완료를 뜻하지 않는다.\n[외부 ${kind} 원문]\n`;
  ensure(prefix.length<=TEXT_LIMIT-RESULT_TEXT_LIMIT);
  const value=f[kind]; ensure(value!==null); const result=prefix+value; text(result);return result;
}
function source(v: unknown): asserts v is Source {
  obj(v, ['id','kind','text','at','taskId','replyTo','disposition']); id(v.id); id(v.taskId); text(v.text); date(v.at);
  ensure(['request','report','evidence','test_answer','answer','manual_decision'].includes(v.kind as string));
  ensure(['provided','unknown','deferred'].includes(v.disposition as string));
  if (v.replyTo !== null) text(v.replyTo, 2000);
}
const STATUSES=['requested','answered','confirmed','deferred'];
function basis(v: unknown): asserts v is Basis {
  obj(v,['id','text','status','sourceId','revision','history']); id(v.id); text(v.text); id(v.sourceId); integer(v.revision);
  ensure(STATUSES.includes(v.status as string)); list(v.history);
  for (const h of v.history) { obj(h,['text','status','sourceId','revision']); text(h.text); id(h.sourceId); integer(h.revision); ensure(['requested','answered','confirmed','deferred'].includes(h.status as string)); }
}
/** FLOW091-C: a fixed plan copy. Same length limits as the plan itself; empty values are null, never placeholder words.
 * The area may since have been renamed, archived or moved: the copy does not refer to the current area list. */
export function background(v: unknown, maxRevision?: number): asserts v is Background {
  if(v===null)return;
  obj(v,['version','revision','brief','area']);ensure(v.version==='background.1');integer(v.revision);
  if(maxRevision!==undefined)ensure((v.revision as number)<=maxRevision);
  if(v.brief!==null)text(v.brief,TEXT_LIMIT);
  if(v.area!==null){obj(v.area,['id','name','note']);id(v.area.id);text(v.area.name,60);if(v.area.note!==null)text(v.area.note,2000);}
}
function ticket(v: unknown): asserts v is Ticket { obj(v,['projectId','revision','requestId','taskId']); id(v.projectId); integer(v.revision); id(v.requestId); id(v.taskId); }
export function validateIntent(v:unknown):Intent {
  obj(v,['version','relation','goal','conditions','retired','basisRefs']);
  ensure(v.version==='intent.1');ensure(['start','continue','revise','separate','uncertain'].includes(v.relation as string));text(v.goal,2000);
  for(const key of ['conditions','retired']) {list(v[key],12);for(const value of v[key] as unknown[])text(value,1000);}
  list(v.basisRefs);const seen=new Set<string>();
  for(const ref of v.basisRefs) {obj(ref,['basisId','sourceId','revision']);id(ref.basisId);id(ref.sourceId);integer(ref.revision);ensure(!seen.has(ref.basisId as string));seen.add(ref.basisId as string);}
  return structuredClone(v) as unknown as Intent;
}
function checkIntentRefs(value:Intent,bases:ContextBasis[]) {
  for(const ref of value.basisRefs)ensure(bases.some(b=>b.id===ref.basisId&&b.sourceId===ref.sourceId&&b.revision===ref.revision&&!b.partial));
}
/** Old eight-key advice remains readable; new wire responses use intent.1. */
export function validateAdvice(v: unknown, basisIds: string[], request?:ContextRequest): Advice {
  const hasIntent=!!v&&typeof v==='object'&&Object.hasOwn(v,'intent');
  obj(v,['understanding','scope','next','checks','question','relatedBasisIds','reviewBasisIds','suggestions',...(hasIntent?['intent']:[])]);
  if(request)ensure(hasIntent);
  if(hasIntent) {
    const value=validateIntent(v.intent);for(const ref of value.basisRefs)ensure(basisIds.includes(ref.basisId));
    if(request) {
      checkIntentRefs(value,request.bases);
      // Structural contradictions: an independent purpose replaces nothing; one sentence cannot be both kept and retired.
      ensure(value.relation!=='separate'||value.retired.length===0);
      const kept=new Set(value.conditions.map(c=>c.trim()));ensure(value.retired.every(r=>!kept.has(r.trim())));
      // All current user basis versions must be acknowledged, including unknown/deferred answers.
      for(const b of request.bases.filter(b=>request.appFacts.inputs.some(s=>s.sourceId===b.sourceId)))ensure(value.basisRefs.some(ref=>ref.basisId===b.id));
    }
  }
  for (const k of ['understanding','scope','next','checks']) text(v[k], 6000);
  for (const k of ['relatedBasisIds','reviewBasisIds']) {
    list(v[k]); const refs = v[k] as unknown[];
    ensure(new Set(refs).size === refs.length); for (const ref of refs) ensure(typeof ref === 'string' && basisIds.includes(ref));
  }
  list(v.suggestions, 8);
  for (const s of v.suggestions) { obj(s,['text','why']); text(s.text, 2000); text(s.why, 2000); }
  if (v.question !== null) question(v.question);
  return structuredClone(v) as unknown as Advice;
}
function question(q: unknown): asserts q is Question {
  obj(q,['kind','text','why','options']); ensure(['fact','choice'].includes(q.kind as string)); text(q.text, 2000); text(q.why, 2000); list(q.options, 3);
  ensure(q.kind !== 'fact' || q.options.length === 0);
  for (const o of q.options) { obj(o,['label','consequence']); text(o.label, 500); text(o.consequence, 1000); }
}
export function validateEnvelope(v: unknown, req: ContextRequest): Envelope {
  obj(v,['mode','ticket','advice']); ensure(['mock','deepseek'].includes(v.mode as string)); ticket(v.ticket);
  ensure(Object.keys(req.ticket).every(k => req.ticket[k as keyof Ticket] === (v.ticket as Ticket)[k as keyof Ticket]));
  return {mode: v.mode as Envelope['mode'], ticket: {...v.ticket}, advice: validateAdvice(v.advice,req.bases.map(b=>b.id),req)};
}
function contextBasis(v: unknown) {
  obj(v,['id','text','status','sourceId','revision','previousVersions','partial']); id(v.id); text(v.text); id(v.sourceId); integer(v.revision); integer(v.previousVersions);
  ensure(STATUSES.includes(v.status as string)); ensure(typeof v.partial === 'boolean');
}
/** Validate the projection's shape and all references available in this request. The server does not
 * have prior snapshot texts; this is not re-execution, provenance authentication or semantic checking. */
function appFacts(v: unknown, req: {ticket:Ticket;sources:Source[];bases:ContextBasis[]}) {
  obj(v,['taskId','inputs','records']); id(v.taskId); ensure(v.taskId===req.ticket.taskId);
  list(v.inputs); list(v.records);
  const sources=new Map(req.sources.map(s=>[s.id,s])),bases=new Map(req.bases.map(b=>[b.id,b]));
  const currentInputs=req.sources.filter(s=>s.taskId===req.ticket.taskId),inputIds=new Set<string>();
  for(const input of v.inputs) {
    obj(input,['sourceId','kind']); id(input.sourceId);
    const s=sources.get(input.sourceId as string);
    ensure(s && s.taskId===req.ticket.taskId && input.kind===s.kind && !inputIds.has(s.id));
    inputIds.add(s.id);
  }
  ensure(inputIds.size===currentInputs.length && currentInputs.every(s=>inputIds.has(s.id)));
  ensure(inputIds.size>0);
  const seen=new Set<string>(),currentRecords=new Set<string>();
  for(const f of v.records) {
    obj(f,['basisId','sourceId','revision','status','versionIndex','isCurrent','kind','previousRevision','changedFields']);
    id(f.basisId); id(f.sourceId); integer(f.revision); integer(f.versionIndex);
    ensure(STATUSES.includes(f.status as string)); ensure(typeof f.isCurrent==='boolean');
    ensure(['input-retained','basis-recorded','version-only'].includes(f.kind as string));
    const b=bases.get(f.basisId as string),s=sources.get(f.sourceId as string);
    ensure(b && s && inputIds.has(s.id));
    const index=f.versionIndex as number,revision=f.revision as number,key=`${b.id}:${index}`;
    ensure(!seen.has(key)); seen.add(key);
    ensure(index<=b.previousVersions && f.isCurrent===(index===b.previousVersions));
    ensure(revision<=req.ticket.revision);
    if(f.isCurrent) {
      ensure(revision===b.revision && f.sourceId===b.sourceId && f.status===b.status);
      currentRecords.add(b.id);
    } else if(f.kind!=='version-only') ensure(revision<b.revision);
    if(f.previousRevision===null) ensure(f.changedFields===null);
    else {
      integer(f.previousRevision);
      ensure(index>0 && (f.previousRevision as number)<revision && f.kind==='basis-recorded');
      list(f.changedFields,2);
      ensure(new Set(f.changedFields).size===f.changedFields.length);
      for(const k of f.changedFields) ensure(k==='text'||k==='status');
    }
    if(f.kind==='version-only') ensure(f.previousRevision===null);
    if(f.kind==='input-retained') {
      ensure(index===0 && f.previousRevision===null);
      ensure((s.kind==='request'&&f.status==='requested') || (s.kind==='answer'&&f.status==='answered'));
      if(f.isCurrent && s.kind==='request') ensure(!b.partial && b.text===s.text);
    }
    if(f.kind==='basis-recorded') {
      ensure((s.kind==='manual_decision' && ['confirmed','deferred'].includes(f.status as string)) ||
        (s.kind==='request' && index>0 && f.status!=='answered'));
      ensure(index===0 ? f.previousRevision===null : f.previousRevision!==null);
      if(f.isCurrent && s.kind==='manual_decision') ensure(!b.partial && b.text===s.text);
    }
  }
  // Current versions are present in full in this request, so their coverage can be checked exactly.
  for(const b of req.bases) if(inputIds.has(b.sourceId)) ensure(currentRecords.has(b.id));
}
/** Structural provenance only: neither these IDs nor source/origin/text authenticate the description's claims. */
function contextAreaDescription(v:unknown,t:Ticket) {
  if(v===null)return;
  obj(v,['taskId','areaId','revision','by','corrects','source','text']);id(v.taskId);id(v.areaId);
  ensure(v.taskId===t.taskId);integer(v.revision);ensure((v.revision as number)>0&&(v.revision as number)<=t.revision);
  text(v.text,SUMMARY_LIMIT);ensure(v.by==='external'||v.by==='user');
  if(v.by==='user') {
    ensure(v.source===null);integer(v.corrects);ensure((v.corrects as number)>=1&&v.corrects===(v.revision as number)-1);
  } else {
    ensure(v.corrects===null);obj(v.source,['taskId','returnId','origin']);id(v.source.taskId);id(v.source.returnId);text(v.source.origin,200);
  }
}
export function validateRequest(v: unknown): ContextRequest {
  // Earlier valid clients sent no description key. Keep their shape and bytes; never invent a null or current value.
  const hasDescription=!!v&&typeof v==='object'&&Object.hasOwn(v,'currentAreaDescription');
  obj(v,['schemaVersion','ticket','projectName','sources','bases','previousWork','appFacts','previousIntent','purposeIntent','background',...(hasDescription?['currentAreaDescription']:[])]); ensure(v.schemaVersion === API_SCHEMA); ticket(v.ticket); text(v.projectName,120);
  if(hasDescription)contextAreaDescription(v.currentAreaDescription,v.ticket as Ticket);
  background(v.background,(v.ticket as Ticket).revision);
  list(v.sources); list(v.bases); for (const s of v.sources) source(s); for (const b of v.bases) contextBasis(b);
  ensure(v.sources.length > 0); unique(v.sources as Source[]); unique(v.bases as {id:string}[]);
  if(v.previousIntent!==null) {
    obj(v.previousIntent,['taskId','value','manualGoal','manualConditions']);id(v.previousIntent.taskId);
    if(v.previousIntent.value===null)text(v.previousIntent.manualGoal,6000); // A correction only; no AI interpretation is implied.
    else checkIntentRefs(validateIntent(v.previousIntent.value),v.bases as ContextBasis[]);
    for(const key of ['manualGoal','manualConditions'])if(v.previousIntent[key]!==null)text(v.previousIntent[key],6000,true);
  }
  if(v.purposeIntent!==null) {
    ensure(v.previousIntent!==null&&(v.previousIntent as {value:{relation?:unknown}|null}).value?.relation==='separate');
    obj(v.purposeIntent,['taskId','value','manualGoal','manualConditions']);id(v.purposeIntent.taskId);
    const value=validateIntent(v.purposeIntent.value);ensure(value.relation!=='separate');checkIntentRefs(value,v.bases as ContextBasis[]);
    for(const key of ['manualGoal','manualConditions'])if(v.purposeIntent[key]!==null)text(v.purposeIntent[key],6000,true);
  }
  appFacts(v.appFacts,{ticket:v.ticket,sources:v.sources as Source[],bases:v.bases as ContextBasis[]});
  ensure(new TextEncoder().encode(JSON.stringify(v)).length<=REQUEST_BYTES,'CONTEXT_TOO_LARGE');
  // Bases carry current values; prior versions stay local. Old-request excerpts are budget-dependent.
  if (v.previousWork !== null) {
    obj(v.previousWork,['taskId','understanding','scope','next','checks','aiTextExcluded','manualConditionFields']); id(v.previousWork.taskId); ensure(typeof v.previousWork.aiTextExcluded === 'boolean');
    for (const k of ['understanding','scope','next','checks']) text(v.previousWork[k],6000,true);
    list(v.previousWork.manualConditionFields,2);
    ensure(new Set(v.previousWork.manualConditionFields).size===v.previousWork.manualConditionFields.length);
    for(const k of v.previousWork.manualConditionFields) ensure(k==='scope'||k==='checks');
  }
  return structuredClone(v) as unknown as ContextRequest;
}
/** Same checks as validateProject without the defensive copy; used on freshly parsed JSON. */
function assertProject(v: unknown): asserts v is Project {
  obj(v,['schemaVersion','id','revision','name','sources','bases','tasks','currentTaskId','draft','answerDraft','basisDraft','basisEdits','draftKind','pending','notice','space','pasted','readings']);
  ensure(v.schemaVersion === SCHEMA, 'UNSUPPORTED_SCHEMA'); id(v.id); integer(v.revision); text(v.name,120); text(v.draft,TEXT_LIMIT,true); text(v.answerDraft,TEXT_LIMIT,true); text(v.basisDraft,TEXT_LIMIT,true);
  ensure(['request','report','evidence','test_answer'].includes(v.draftKind as string)); if (v.notice !== null) text(v.notice,2000);
  list(v.sources); list(v.bases); list(v.tasks); for (const s of v.sources) source(s); for (const b of v.bases) basis(b);
  unique(v.sources as Source[]); unique(v.bases as Basis[]);
  ensure(v.basisEdits !== null && typeof v.basisEdits === 'object' && !Array.isArray(v.basisEdits));
  // Lookups use Map/Set so validation stays linear up to ITEM_LIMIT (no nested scans).
  const basisIds=new Set((v.bases as Basis[]).map(b=>b.id));
  for(const [key,value] of Object.entries(v.basisEdits as Record<string,unknown>)) { ensure(basisIds.has(key)); text(value,TEXT_LIMIT,true); }
  const sources = new Map((v.sources as Source[]).map(s=>[s.id,s])); const bids = [...basisIds],basisMap=new Map((v.bases as Basis[]).map(b=>[b.id,b]));
  const tasks=new Set<string>(),returns=new Map<string,{taskId:string;record:ExportRecord}>();
  const areaIds=space(v.space);
  pasted(v.pasted,areaIds);
  for (const t of v.tasks) {
    const optional=['intentEdit','areaId'].filter(k=>t&&typeof t==='object'&&Object.hasOwn(t,k));
    obj(t,['id','sourceIds','parentTaskId','advice','adviceRevision','mode','manual','suggestions','handoffs','resultFile','background',...optional]); id(t.id);
    background(t.background,v.revision as number); list(t.sourceIds); ensure(t.sourceIds.length > 0);
    for (const s of t.sourceIds) ensure(sources.has(s as string)); ensure(new Set(t.sourceIds).size === t.sourceIds.length);
    if(t.parentTaskId !== null) ensure(tasks.has(t.parentTaskId as string)); // Ordered, acyclic.
    if(t.areaId!==undefined) { // Only a request task is placed; a returned report follows its parent's area.
      ensure(typeof t.areaId==='string'&&areaIds.has(t.areaId));
      ensure(!['report','evidence'].includes(sources.get(t.sourceIds[0] as string)!.kind));
    }
    if(t.intentEdit!==undefined) {
      const legacy=!!t.intentEdit&&typeof t.intentEdit==='object'&&(t.intentEdit as {version?:unknown}).version==='intent-edit.1';
      obj(t.intentEdit,legacy?['version','revision']:['version','revision','goal','conditions']);ensure(legacy||t.intentEdit.version==='intent-edit.2');
      integer(t.intentEdit.revision);ensure((t.intentEdit.revision as number)<=(v.revision as number));
      if(!legacy&&t.intentEdit.goal===null)ensure(t.intentEdit.conditions===null);
      else if(!legacy){text(t.intentEdit.goal,6000);text(t.intentEdit.conditions,6000,true);}
    }
    if(t.advice !== null) {
      const advice=validateAdvice(t.advice,bids);
      for(const ref of advice.intent?.basisRefs??[]) {
        const b=basisMap.get(ref.basisId)!;
        ensure([b,...b.history].some(b=>b.sourceId===ref.sourceId&&b.revision===ref.revision));
        if(t.adviceRevision!==null)ensure(ref.revision<=(t.adviceRevision as number));
      }
    } ensure([null,'mock','deepseek'].includes(t.mode as null|string));
    // null with advice = imported from project.1, when the basis revision behind the advice was not recorded.
    if(t.adviceRevision !== null) { ensure(t.advice !== null); integer(t.adviceRevision); ensure((t.adviceRevision as number) <= (v.revision as number)); }
    obj(t.manual,['understanding','scope','next','checks']); for(const k of Object.keys(t.manual)) if(t.manual[k] !== null) text(t.manual[k],6000,true);
    if(t.suggestions !== null) { list(t.suggestions,8); for(const s of t.suggestions) {obj(s,['text','why']);text(s.text,2000,true);text(s.why,2000,true);} }
    list(t.handoffs); for(const h of t.handoffs) {
      obj(h,['at','method','revision','chars','digest','work','aiExcluded','legacyText','returnId','background','anchor']); date(h.at);background(h.background,v.revision as number);
      if(h.anchor!==null){ensure(h.returnId!==null);obj(h.anchor,['version','areaId','understanding','stamp']);ensure(h.anchor.version==='anchor.1'||h.anchor.version==='anchor.2');ensure(areaIds.has(h.anchor.areaId as string));integer(h.anchor.understanding);planStamp(h.anchor.stamp);
        ensure((h.anchor.version==='anchor.2')===Object.hasOwn(h.anchor.stamp as object,'version'));} ensure(['clipboard','download'].includes(h.method as string));
      integer(h.revision); ensure((h.revision as number) <= (v.revision as number)); integer(h.chars); ensure(typeof h.digest === 'string' && /^[0-9a-f]{8}$/.test(h.digest)); ensure(typeof h.aiExcluded === 'boolean');
      if(h.work !== null) { obj(h.work,['understanding','scope','next','checks']); for(const k of Object.keys(h.work)) text(h.work[k],6000,true); }
      if(h.legacyText !== null) text(h.legacyText,250000);
      if(h.returnId!==null) {
        id(h.returnId);ensure(h.work!==null && h.legacyText===null && !returns.has(h.returnId as string));
        returns.set(h.returnId as string,{taskId:t.id as string,record:h as unknown as ExportRecord});
      }
    }
    if(t.resultFile!==null) {
      obj(t.resultFile,['returnId','rawText']);id(t.resultFile.returnId);ensure(typeof t.resultFile.rawText==='string');
      const f=parseResultFile(t.resultFile.rawText),target=returns.get(f.returnId);
      ensure(target && tasks.has(target.taskId) && f.projectId===v.id && f.taskId===t.parentTaskId && f.taskId===target.taskId && f.returnId===t.resultFile.returnId);
      const kinds:('report'|'evidence')[]=f.evidence===null?['report']:['report','evidence'];
      for(const [index,kind] of kinds.entries()) {
        const s=sources.get(t.sourceIds[index] as string);
        ensure(s && s.taskId===t.id && s.kind===kind && s.replyTo===null && s.disposition==='provided' && s.text===resultSourceText(f,target.record.revision,kind));
      }
      // Later real answers/manual decisions on this task remain legal; never require an exact source count.
    }
    ensure(!tasks.has(t.id as string)); tasks.add(t.id as string);
  }
  for(const s of sources.values()) ensure(tasks.has(s.taskId));
  // Readings are checked once the tasks are: map-reading.4 against each record as read (a returned report as received), earlier
  // ones against the record as they stored it (Source.text), as before.
  // A code/test match rests on evidence: a project evidence source, or a provided source the person classified (project.14).
  const evidenceIds=new Set([...[...sources.values()].filter(s=>s.kind==='evidence').map(s=>s.id),...(v.pasted as PastedRecord[]).filter(r=>r.evidence).map(r=>r.id)]);
  readings(v.readings,areaIds,recordTextMap(v.pasted as PastedRecord[],[...sources.values()],v.tasks as Task[]),v.id as string,evidenceIds);
  understandingRefs(v.space as Record<string,unknown>,v.tasks as Task[],sources);
  // Imported reports or synthetic answers cannot masquerade as an authoritative decision.
  for(const b of v.bases as Basis[]) {
    ensure(/^D[1-9]\d*$/.test(b.id));
    for(const value of [...b.history,b]) {
      const s=sources.get(value.sourceId); ensure(s && ['request','manual_decision','answer'].includes(s.kind));
      if (value.status === 'confirmed' || value.status === 'deferred') ensure(['manual_decision','request'].includes(s.kind));
      if (value.status === 'requested') ensure(s.kind === 'request');
      if (value.status === 'answered') ensure(s.kind === 'answer');
      ensure(value.revision <= (v.revision as number));
    }
  }
  if(v.currentTaskId !== null) ensure(tasks.has(v.currentTaskId as string));
  if(v.pending !== null) { ticket(v.pending); ensure(v.pending.projectId === v.id && tasks.has((v.pending as Ticket).taskId) && v.pending.revision <= (v.revision as number)); }
}
/** FLOW090 plan data: the user's purpose text, areas and typed relations. Returns the area IDs. */
function space(v: unknown): Set<string> {
  obj(v,['brief','areas','relations','draftTarget','layout','understanding','containment']);
  if(v.brief!==null) {
    obj(v.brief,['text','at','previous']);text(v.brief.text,TEXT_LIMIT);date(v.brief.at);list(v.brief.previous,200);
    for(const old of v.brief.previous){obj(old,['text','at']);text(old.text,TEXT_LIMIT);date(old.at);}
  }
  list(v.areas,500);list(v.relations,2000);
  for(const a of v.areas){obj(a,['id','name','note','archived','createdAt']);id(a.id);text(a.name,60);text(a.note,2000,true);ensure(typeof a.archived==='boolean');date(a.createdAt);}
  unique(v.areas as {id:string}[]);const ids=new Set((v.areas as {id:string}[]).map(a=>a.id));
  containment(v.containment,v.areas as Area[]);
  for(const r of v.relations) {
    obj(r,['id','from','to','kind','note']);id(r.id);ensure(ids.has(r.from as string)&&ids.has(r.to as string)&&r.from!==r.to);
    ensure(['flow','needs','shares','related'].includes(r.kind as string));text(r.note,200,true);
  }
  unique(v.relations as {id:string}[]);
  if(v.draftTarget!==null){obj(v.draftTarget,['area']);ensure(v.draftTarget.area===null||ids.has(v.draftTarget.area as string));}
  obj(v.layout,['version','positions']);ensure(v.layout.version==='layout.1');
  const positions=v.layout.positions;ensure(!!positions&&typeof positions==='object'&&!Array.isArray(positions));
  for(const [key,point] of Object.entries(positions as Record<string,unknown>)) {
    ensure(ids.has(key));obj(point,['x','y']);
    for(const n of [point.x,point.y])ensure(Number.isSafeInteger(n)&&Math.abs(n as number)<=POSITION_LIMIT);
  }
  areaUnderstanding(v.understanding,ids);
  return ids;
}
/** Pasted records: text as pasted (any whitespace kept; control characters other than tab/newline refused, as everywhere),
 * unique ids, and a context that names an existing part or nothing. project.14: a provided source also has its exact declaration
 * (evidence). Unique by the same identity the domain adds with: a pasted text once; a provided source once per exact text and
 * declaration; the same bytes pasted and provided are two records. */
function pasted(v:unknown,areaIds:Set<string>) {
  list(v,PASTED_LIMIT);const seen=new Set<string>();
  for(const r of v){
    const typed=!!r&&typeof r==='object'&&Object.hasOwn(r,'evidence');
    obj(r,['id','text','at','context',...(typed?['evidence']:[])]);id(r.id);text(r.text,PASTED_TEXT_LIMIT);date(r.at);ensure(r.context===null||(typeof r.context==='string'&&areaIds.has(r.context)));
    if(typed)ensure(validEvidence(r.evidence));
    const key=recordIdentity(r as unknown as PastedRecord);ensure(!seen.has(key));seen.add(key);
  }
  unique(v as {id:string}[]);
}
/** Before project.14 a normal record had exactly its four keys and a text of its own. Every older input is held to that before it
 * is migrated, so no older-labelled file brings in a provided-source declaration (the final check alone would accept one). */
function legacyPasted(v:unknown) {
  const p=v as {pasted?:unknown};if(!p||typeof p!=='object'||!Object.hasOwn(p,'pasted'))return;
  list(p.pasted,PASTED_LIMIT);const texts=new Set<string>();
  for(const r of p.pasted){obj(r,['id','text','at','context']);ensure(typeof r.text==='string'&&!texts.has(r.text));texts.add(r.text as string);}
}
/** scenario-reading.1, exactly: every key, every enumeration, every reference inside the record (a link's visits, the end's
 * visits, each E id) and every part an area of the project. Relation ids may be gone (the person removed the line). Ledger ids
 * (P01, S03, …) are kept as written; the app's target behind each is what holds. */
export const SCENARIO_LIMITS={visits:16,links:20,rows:80,chars:12000,cell:600,quote:240,exits:8,diagnostics:400} as const;
export function validateScenarioReading(r:unknown,areaIds:Set<string>,recordIds:Set<string>,mapIds:Set<string>):void {
  obj(r,['version','id','at','record','ledgerVersion','pathStatus','scenario','diagnostics']);ensure(r.version==='scenario-reading.1');id(r.id);date(r.at);
  ensure(typeof r.record==='string'&&recordIds.has(r.record));ensure(r.ledgerVersion===null||typeof r.ledgerVersion==='string'&&mapIds.has(r.ledgerVersion));
  ensure(SCENARIO_PATH_STATUSES.includes(r.pathStatus as never));
  const said=(v:unknown)=>{if(v!==null)text(v,SCENARIO_LIMITS.cell);};
  const ref=(v:unknown,letter:string)=>ensure(typeof v==='string'&&new RegExp(`^${letter}\\d{2,3}$`).test(v));
  const own=(v:unknown)=>{text(v,40);};
  const name=(v:unknown)=>text(v,300);
  const word=(v:unknown)=>ensure(v===null||v==='report'||v==='guess');
  const evidenceIds=new Set<string>();
  const refs=(v:unknown)=>{list(v,16);for(const e of v as unknown[])ensure(typeof e==='string'&&evidenceIds.has(e));ensure(new Set(v as unknown[]).size===(v as unknown[]).length);};
  const part=(v:unknown)=>{obj(v,['ref','areaId','name']);ref(v.ref,'P');ensure(areaIds.has(v.areaId as string));name(v.name);};
  const step=(v:unknown)=>{obj(v,['ref','name']);ref(v.ref,'S');name(v.name);};
  const port=(v:unknown)=>{obj(v,['ref','name','direction']);ref(v.ref,'O');name(v.name);ensure(v.direction==='in'||v.direction==='out');};
  const rule=(v:unknown)=>{obj(v,['ref','areaId','text']);ref(v.ref,'Q');ensure(areaIds.has(v.areaId as string));text(v.text,300);};
  const relation=(v:unknown)=>{obj(v,['ref','relationId','along']);ref(v.ref,'R');id(v.relationId);ensure(typeof v.along==='boolean');};
  const arts=(v:unknown)=>{if(v==='unknown')return;list(v,16);for(const a of v as unknown[]){obj(a,['ref','name']);ref(a.ref,'A');name(a.name);}};
  const s=r.scenario;obj(s,['scenario','start','visits','links','end','evidence','portMaps','gaps','statements']);
  list(s.evidence,SCENARIO_LIMITS.rows);for(const e of s.evidence){obj(e,['id','supports','material','source','versionOrRun','quote','stance']);ref(e.id,'E');ensure(!evidenceIds.has(e.id as string));evidenceIds.add(e.id as string);
    said(e.supports);ensure(['file','run','report'].includes(e.material as string));said(e.source);said(e.versionOrRun);if(e.quote!==null)text(e.quote,SCENARIO_LIMITS.quote);ensure(['stated','report','guess'].includes(e.stance as string));}
  const c=s.scenario;if(c!==null){obj(c,['id','name','requestRef','ledgerVersion','designVersion','basisAt','kind','runRef','reason','evidence','evidenceWord']);own(c.id);
    for(const k of ['name','requestRef','ledgerVersion','designVersion','basisAt','runRef','reason'] as const)said(c[k]);ensure(c.kind===null||SCENARIO_KINDS.includes(c.kind as never));refs(c.evidence);word(c.evidenceWord);}
  if(s.start!==null){const t=s.start;obj(t,['id','trigger','target','condition','rules','prior','independent','evidence','evidenceWord']);own(t.id);said(t.trigger);said(t.condition);said(t.prior);said(t.independent);refs(t.evidence);word(t.evidenceWord);
    if(t.target!==null&&t.target!=='unknown'){obj(t.target,['part','port','step']);part(t.target.part);if(t.target.port!==null)port(t.target.port);if(t.target.step!==null)step(t.target.step);}
    list(t.rules,8);for(const q of t.rules)rule(q);}
  list(s.visits,SCENARIO_LIMITS.visits);const visits=new Set<string>();
  for(const x of s.visits){obj(x,['id','part','step','port','in','out','event','evidence','evidenceWord']);ref(x.id,'V');ensure(!visits.has(x.id as string));visits.add(x.id as string);
    part(x.part);if(x.step!==null&&x.step!=='unknown')step(x.step);if(x.port!==null&&x.port!=='unknown')port(x.port);arts(x.in);arts(x.out);said(x.event);refs(x.evidence);word(x.evidenceWord);}
  list(s.links,SCENARIO_LIMITS.links);const links=new Set<string>();
  for(const l of s.links){obj(l,['id','from','to','relation','kind','condition','rules','policy','evidence','evidenceWord']);ref(l.id,'L');ensure(!links.has(l.id as string));links.add(l.id as string);
    ensure(visits.has(l.from as string)&&visits.has(l.to as string));if(l.relation!==null)relation(l.relation);ensure(SCENARIO_LINK_KINDS.includes(l.kind as never));
    said(l.condition);said(l.policy);list(l.rules,8);for(const q of l.rules)rule(q);refs(l.evidence);word(l.evidenceWord);}
  if(s.end!==null){const e=s.end;obj(e,['id','reached','produced','desired','exits','lastConfirmed','lastConfirmedVisit','gap','evidence','evidenceWord']);own(e.id);
    ensure(e.reached===null||e.reached==='unknown'||visits.has(e.reached as string));ensure(e.lastConfirmedVisit===null||visits.has(e.lastConfirmedVisit as string));
    said(e.produced);said(e.desired);said(e.lastConfirmed);said(e.gap);if(e.exits!=='unknown'){list(e.exits,SCENARIO_LIMITS.exits);for(const x of e.exits)text(x,SCENARIO_LIMITS.cell);}refs(e.evidence);word(e.evidenceWord);}
  list(s.portMaps,SCENARIO_LIMITS.rows);for(const m of s.portMaps){obj(m,['id','relation','areaId','port','step','direction','evidence']);own(m.id);relation(m.relation);ensure(areaIds.has(m.areaId as string));port(m.port);step(m.step);ensure(m.direction==='in'||m.direction==='out');refs(m.evidence);}
  list(s.gaps,SCENARIO_LIMITS.rows);for(const g of s.gaps){obj(g,['id','refs','related','what','source','reason','needed']);ref(g.id,'G');list(g.refs,16);for(const x of g.refs)ensure(typeof x==='string'&&/^[POSRAFQV]\d{2,3}$/.test(x));
    said(g.related);said(g.what);said(g.source);said(g.needed);ensure(SCENARIO_GAP_REASONS.includes(g.reason as never));}
  list(s.statements,2+SCENARIO_LIMITS.exits);for(const x of s.statements){obj(x,['kind','text','evidence']);ensure(['produced','desired','exit'].includes(x.kind as string));text(x.text,SCENARIO_LIMITS.cell);refs(x.evidence);}
  // A rejected path keeps its end sentences apart; a path with no visit is never complete or partial; only a rejected one has statements.
  ensure(r.pathStatus==='rejected'||(s.visits as unknown[]).length>0&&c!==null&&c.kind!==null);ensure(r.pathStatus==='rejected'||(s.statements as unknown[]).length===0);
  list(r.diagnostics,SCENARIO_LIMITS.diagnostics);for(const d of r.diagnostics){obj(d,['path','rule','category','explanation']);text(d.path,160);ensure(d.rule==='contract');ensure(typeof d.category==='string'&&/^[a-z][a-z-]{0,39}$/.test(d.category));text(d.explanation,200);}
}
/* map-reading.18 (pipeline .43, RECORD_ASKS_V4_KO.md 4.3): the fields the program reads from a 기록 v4 record's tables, each key present
 * on every entry of that version (null or [] where the records say nothing, as for every v3 record); never on an earlier entry. */
const READING18_KEYS=['basisScope','focus','projectStatus','gatesNone','coverage','artifacts','profileTables','recordExtras','recordDiagnostics'];
const PART18_KEYS=['recordRef','implementation','implementationQuote','members','groupAxis','groupAxisQuote','statusClaims','loops','variants','entries','contracts'];
const STEP18_KEYS=['recordRef','loopIds','alt','branch','model'],CLAIM18_KEYS=['decidedBy','actors','mergedWhen','contractChange','shippedIn','withdrawalMethod'];
const RELATION18_KEYS=['when','optional','variantRef','crosses','cadenceKind','payloadRef','via','member'];
const said18=(v:unknown,max:number)=>{if(v!==null)text(v,max);};
const ref18=(v:unknown,re:RegExp)=>{ensure(typeof v==='string'&&re.test(v));};
const LOOP_REF=/^B\d{1,3}:L\d{1,3}$/,STEP_REF18=/^B\d{1,3}:S\d{1,3}[a-z]?$/;
/** map-reading.20 (recipe .50, row-ledger.ts): a reading's row entries: each (record, table, id) once, a known state with a reason it allows,
 * a send count, its targets (reflected only, up to eight) and the parts it conflicts with (held only, up to four). */
function readingRows(v:unknown,areaIds:Set<string>){
  list(v,2048);const seen=new Set<string>();
  for(const x of v as unknown[]){obj(x,['record','table','id','state','reason','detail','sent','to','with']);text(x.record,200);text(x.table,40);text(x.id,40);
    const key=JSON.stringify([x.record,x.table,x.id]);ensure(!seen.has(key));seen.add(key);ensure(ROW_STATES.includes(x.state as never));
    const reasons=ROW_REASONS[x.state as RowState];ensure(x.state==='reflected'?x.reason===null:reasons.includes(x.reason as string));
    ensure(x.detail===null||typeof x.detail==='string'&&/^[a-z][a-z-]{0,39}$/.test(x.detail));integer(x.sent);
    list(x.to,8);for(const g of x.to as unknown[]){obj(g,['kind','id','index']);ensure(['part','claim','relation','reading'].includes(g.kind as string));text(g.id,80);ensure(g.index===null||integer(g.index)===undefined);ensure((g.kind==='claim')===(g.index!==null));if(g.kind==='part'||g.kind==='claim')ensure(areaIds.has(g.id as string));}
    ensure(x.state==='reflected'?(x.to as unknown[]).length>0:(x.to as unknown[]).length===0);
    list(x.with,4);for(const a of x.with as unknown[])ensure(areaIds.has(a as string));ensure(x.state==='held'||(x.with as unknown[]).length===0);}
}
function status18(s:Record<string,unknown>,quote:(q:unknown)=>void,keys:string[],nineteen=false){
  obj(s,[...keys,...(nineteen?['scopeKind']:[])]);ensure(STATUS_DIMENSION_KINDS.includes(s.dimension as never));ensure(STATUS_VALUE_KINDS[s.dimension as StatusDimension].includes(s.value as string));
  said18(s.scope,120);said18(s.basis,60);said18(s.successor,60);quote(s.quote);
  // map-reading.19 (13.2): a part off in a feature only or by default; unstated only for an 비활성·조건부 row with no range.
  if(nineteen)ensure(s.scopeKind===null||STATUS_SCOPE_KINDS.includes(s.scopeKind as never)&&(s.scopeKind!=='unstated'||s.scope===null));
}
/* map-reading.19 (recipe .45, RECORD_ASKS_V5_KO.md 8.4 as 12 and 13 amend it): what the program reads from a 기록 v5 record's folded pages,
 * each key present on every entry of that version (null, false or [] where the records say nothing); never on an earlier entry. */
const READING19_KEYS=['level','pages','obligations','pageEnds','checks','defaults','firstLines'];
const PART19_KEYS=['family','familyRole','familyReason','familyQuote','familyUnclear','added','states','cites'];
/** A row's cites (2.4–2.5): each its ID or word and its own grade, never merged; six at most. */
function cites19(v:unknown){list(v,6);for(const c of v as unknown[]){obj(c,['ref','grade','source','place','quote']);text(c.ref,12);ensure(CITE_GRADES.includes(c.grade as never));said18(c.source,120);said18(c.place,80);said18(c.quote,200);
  for(const k of ['source','place','quote'] as const)ensure(c[k]===null||!secretLike(c[k] as string));}}
function part19(p:Record<string,unknown>,quote:(q:unknown)=>void){
  // A family stands on its row (familyQuote); 미정 is a null family with or without its reason; an unclear v4 word keeps its word.
  ensure(p.family===null||RECORD_FAMILIES.includes(p.family as never));ensure(p.familyReason===null||FAMILY_REASONS.includes(p.familyReason as never)&&p.family===null);
  said18(p.familyRole,40);ensure(typeof p.familyUnclear==='boolean'&&(!p.familyUnclear||p.family===null&&p.familyRole!==null));ensure(typeof p.added==='boolean');
  if(p.familyQuote===null)ensure(p.family===null&&p.familyRole===null&&p.familyReason===null&&!p.familyUnclear);else quote(p.familyQuote);
  list(p.states,5);for(const s of p.states as unknown[]){obj(s,['name','event','next','quote']);text(s.name,60);said18(s.event,80);said18(s.next,60);quote(s.quote);}
  cites19(p.cites);
}
function reading19(r:Record<string,unknown>,quote:(q:unknown)=>void){
  ensure(r.level===null||r.level===0||r.level===1||r.level===2);
  list(r.pages,16);for(const x of r.pages as unknown[]){obj(x,['recordId','n','prev','hash','conflict']);text(x.recordId,40);integer(x.n);if(x.prev!==null)integer(x.prev);ensure(typeof x.hash==='string'&&/^[0-9a-f]{16}$/.test(x.hash));ensure(typeof x.conflict==='boolean');}
  list(r.obligations,64);for(const o of r.obligations as unknown[]){obj(o,['kind','table','ref','text','candidate']);ensure(OBLIGATION_KINDS.includes(o.kind as never));said18(o.table,12);said18(o.ref,40);text(o.text,120);ensure(typeof o.candidate==='boolean');}
  list(r.pageEnds,128);for(const e of r.pageEnds as unknown[]){obj(e,['recordId','page','table','state','written','reserved','remaining','quote']);text(e.recordId,40);integer(e.page);ensure(typeof e.table==='string'&&/^(?:C-[A-Z]{2,12}|P\d(?:-\d{2})?)$/.test(e.table));
    said18(e.state,20);list(e.written,64);for(const w of e.written as unknown[])text(w,16);list(e.reserved,16);for(const w of e.reserved as unknown[])text(w,16);said18(e.remaining,120);quote(e.quote);}
  list(r.checks,6);for(const c of r.checks as unknown[]){obj(c,['id','result','found','method','quote']);ensure(typeof c.id==='string'&&/^CK\d{1,2}$/.test(c.id));ensure(c.result===null||['yes','no','unchecked'].includes(c.result as string));
    list(c.found,16);for(const f of c.found as unknown[])text(f,16);said18(c.method,120);quote(c.quote);}
  list(r.defaults,9);for(const d of r.defaults as unknown[]){obj(d,['item','value','quote']);text(d.item,20);text(d.value,120);ensure(!secretLike(d.value as string));quote(d.quote);}
  list(r.firstLines,3);for(const x of r.firstLines as unknown[])text(x,80);
}
function part18(p:Record<string,unknown>,quote:(q:unknown)=>void,nineteen=false){
  if(p.recordRef!==null)ref18(p.recordRef,/^B\d{1,3}$/);
  ensure(p.implementation===null?p.implementationQuote===null:PART_IMPLEMENTATIONS.includes(p.implementation as never));if(p.implementation!==null)quote(p.implementationQuote);
  if(p.members!==null){const m=p.members as Record<string,unknown>;obj(m,['count','ordered','items','quote']);ensure(m.count===null||integer(m.count)===undefined);ensure(m.ordered===null||typeof m.ordered==='boolean');list(m.items,24);for(const x of m.items as unknown[])text(x,60);quote(m.quote);}
  ensure(p.groupAxis===null?p.groupAxisQuote===null:GROUP_AXES.includes(p.groupAxis as never));if(p.groupAxis!==null)quote(p.groupAxisQuote);
  list(p.statusClaims,8);for(const s of p.statusClaims as unknown[])status18(s as Record<string,unknown>,quote,['dimension','value','scope','basis','successor','quote'],nineteen);
  list(p.loops,8);for(const l of p.loops as unknown[]){obj(l,['recordRef','parentRef','parentPart','body','unit','count','stop','quote',...(nineteen?['bodyState','bodyText','cites']:[])]);ref18(l.recordRef,LOOP_REF);if(l.parentRef!==null)ref18(l.parentRef,LOOP_REF);ensure(l.parentRef!==null||l.parentPart===null);said18(l.parentPart,60);
    list(l.body,16);for(const b of l.body as unknown[])ref18(b,STEP_REF18);said18(l.unit,80);said18(l.count,120);said18(l.stop,120);quote(l.quote);
    // map-reading.19 (3.5): a v5 loop is linked to its steps or unexpanded (no body); a v4 loop says neither.
    if(nineteen){ensure(l.bodyState===null||l.bodyState==='linked'&&(l.body as unknown[]).length>0||l.bodyState==='unexpanded'&&(l.body as unknown[]).length===0);said18(l.bodyText,120);cites19(l.cites);}}
  ensure(new Set((p.loops as {recordRef:string}[]).map(l=>l.recordRef)).size===(p.loops as unknown[]).length);
  list(p.variants,12);for(const v of p.variants as unknown[]){obj(v,['recordRef','interfaceRef','implementer','selector','condition','together','togetherScope','quote']);ref18(v.recordRef,/^X\d{1,3}$/);text(v.interfaceRef,80);text(v.implementer,60);
    const s=v.selector as Record<string,unknown>;obj(s,['who','how','when']);said18(s.who,40);ensure(s.how===null||VARIANT_CHOICES.includes(s.how as never));said18(s.when,40);said18(v.condition,120);ensure(VARIANT_TOGETHER.includes(v.together as never));said18(v.togetherScope,60);quote(v.quote);}
  list(p.entries,12);for(const e of p.entries as unknown[]){obj(e,['recordRef','name','kind','order','consumer','contractRef','quote']);ref18(e.recordRef,/^N\d{1,3}$/);text(e.name,120);ensure(e.kind===null||ENTRY_KINDS.includes(e.kind as never));
    if(e.order!==null)integer(e.order);said18(e.consumer,80);if(e.contractRef!==null)ref18(e.contractRef,/^K\d{1,3}$/);quote(e.quote);}
  list(p.contracts,8);for(const k of p.contracts as unknown[]){obj(k,['recordRef','consumer','surface','spec','version','quote']);ref18(k.recordRef,/^K\d{1,3}$/);said18(k.consumer,80);said18(k.surface,120);said18(k.spec,200);said18(k.version,60);quote(k.quote);}
}
function step18(s:Record<string,unknown>){
  if(s.recordRef!==null)ref18(s.recordRef,STEP_REF18);list(s.loopIds,4);for(const l of s.loopIds as unknown[])ref18(l,LOOP_REF);
  if(s.alt!==null){const a=s.alt as Record<string,unknown>;obj(a,['group','branch']);ref18(a.group,/^S\d{1,3}$/);ref18(a.branch,/^[a-z]$/);}
  list(s.branch,4);for(const b of s.branch as unknown[]){obj(b,['when','to','max','outcome']);said18(b.when,120);list(b.to,4);for(const t of b.to as unknown[])ref18(t,STEP_REF18);said18(b.max,20);said18(b.outcome,80);}
  said18(s.model,60);
}
function claim18(c:Record<string,unknown>,quote:(q:unknown)=>void){
  if(c.decidedBy!==null){const d=c.decidedBy as Record<string,unknown>;ensure(c.topic==='rule');obj(d,['text','when','quote']);text(d.text,80);said18(d.when,40);quote(d.quote);}
  list(c.actors,6);for(const a of c.actors as unknown[]){obj(a,['role','kind','name','ref']);ensure(ACTOR_ROLES.includes(a.role as never)&&ACTOR_KINDS.includes(a.kind as never));said18(a.name,60);if(a.ref!==null)ref18(a.ref,/^#\d{1,9}$/);}
  ensure((c.actors as unknown[]).length===0&&c.mergedWhen===null&&c.shippedIn===null||c.topic==='change');said18(c.mergedWhen,40);
  if(c.contractChange!==null){const k=c.contractChange as Record<string,unknown>;ensure(c.topic==='change'||c.topic==='withdrawn');obj(k,['kind','ref']);ensure(CONTRACT_CHANGE_KINDS.includes(k.kind as never));said18(k.ref,80);}
  if(c.shippedIn!==null){const s=c.shippedIn as Record<string,unknown>;obj(s,['kind','version']);ensure(SHIPPED_KINDS.includes(s.kind as never));said18(s.version,60);ensure(s.kind==='released'||s.version===null);}
  ensure(c.withdrawalMethod===null||WITHDRAWAL_METHODS.includes(c.withdrawalMethod as never)&&c.topic==='withdrawn');
}
function relation18(x:Record<string,unknown>){
  said18(x.when,120);ensure(typeof x.optional==='boolean'&&(x.optional||x.when===null&&x.variantRef===null));if(x.variantRef!==null)ref18(x.variantRef,/^X\d{1,3}$/);
  ensure(x.crosses===null||CROSS_KINDS.includes(x.crosses as never));ensure(x.cadenceKind===null||CADENCE_KINDS.includes(x.cadenceKind as never));
  if(x.payloadRef!==null)ref18(x.payloadRef,/^D\d{1,3}$/);said18(x.via,80);said18(x.member,60);
}
function reading18(r:Record<string,unknown>,quote:(q:unknown)=>void,records:Map<string,string>,read:{id:string;from:number;to:number}[],nineteen=false){
  const quoted=(v:unknown,keys:[string,number][])=>{if(v===null)return;const o=v as Record<string,unknown>;obj(o,[...keys.map(([k])=>k),'quote']);for(const [k,n] of keys)text(o[k],n);quote(o.quote);};
  quoted(r.basisScope,[['text',200]]);quoted(r.gatesNone,[['reason',200]]);
  if(r.focus!==null){const f=r.focus as Record<string,unknown>;obj(f,['profiles','reason','tables','quote']);list(f.profiles,6);for(const x of f.profiles as unknown[])ref18(x,/^P[1-6]$/);said18(f.reason,200);list(f.tables,19);for(const x of f.tables as unknown[])ref18(x,/^P[1-6]-0[1-9]$/);quote(f.quote);}
  list(r.projectStatus,16);for(const s of r.projectStatus as unknown[]){status18(s as Record<string,unknown>,quote,['target','dimension','value','scope','basis','successor','quote'],nineteen);text((s as Record<string,unknown>).target,80);}
  list(r.coverage,128);for(const c of r.coverage as unknown[]){obj(c,['recordId','chunk','table','state','included','remaining','quote']);said18(c.recordId,40);if(c.chunk!==null)integer(c.chunk);ref18(c.table,/^(?:C-[A-Z]{2,12}|P\d-\d{2})$/);
    ensure(COVERAGE_STATES.includes(c.state as never));said18(c.included,120);said18(c.remaining,200);quote(c.quote);}
  list(r.artifacts,48);for(const a of r.artifacts as unknown[]){obj(a,['recordRef','name','kind','contractRef','shape','fieldsMore','where','writeMode','atomicScope','quote',...(nineteen?['sharedBy']:[])]);if(nineteen){list(a.sharedBy,8);for(const s of a.sharedBy as unknown[])text(s,60);}if(a.recordRef!==null)ref18(a.recordRef,/^D\d{1,3}$/);text(a.name,80);
    ensure(a.kind===null||ARTIFACT_KINDS.includes(a.kind as never));if(a.contractRef!==null)ref18(a.contractRef,/^K\d{1,3}$/);said18(a.shape,120);if(a.fieldsMore!==null)integer(a.fieldsMore);said18(a.where,120);
    ensure(a.writeMode===null||WRITE_MODES.includes(a.writeMode as never));said18(a.atomicScope,120);quote(a.quote);}
  const table=(t:Record<string,unknown>,profile:boolean)=>{obj(t,['table','header','rows',...(profile?['none']:[])]);text(t.table,12);list(t.header,12);for(const h of t.header as unknown[])text(h,40);list(t.rows,12);
    for(const x of t.rows as unknown[]){obj(x,['cells',...(profile?['recordRef']:[]),'quote']);list(x.cells,12);for(const c of x.cells as unknown[])text(c,200,true);if(profile&&x.recordRef!==null)ref18(x.recordRef,/^P\d-\d{2}\.\d{1,3}$/);quote(x.quote);}
    if(profile&&t.none!==null){const n=t.none as Record<string,unknown>;obj(n,['text','quote']);text(n.text,200);quote(n.quote);}};
  list(r.profileTables,24);for(const t of r.profileTables as unknown[]){table(t as Record<string,unknown>,true);ref18((t as Record<string,unknown>).table,/^P[1-6]-0[1-9]$/);}
  list(r.recordExtras,8);for(const t of r.recordExtras as unknown[])table(t as Record<string,unknown>,false);
  list(r.recordDiagnostics,64);for(const d of r.recordDiagnostics as unknown[]){obj(d,['category','table','column','record','from','to']);ensure(RECORD_DIAGNOSTIC_CATEGORIES.includes(d.category as never));said18(d.table,12);said18(d.column,40);
    ensure(records.has(d.record as string));integer(d.from);integer(d.to);ensure((d.from as number)<(d.to as number)&&read.some(y=>y.id===d.record&&y.from<=(d.from as number)&&(d.to as number)<=y.to));}
}
/** Map readings: every part a known area, every quote of a known record (a pasted record or a source), every claim a known
 * kind, and a claim replaced only by a later one of the same area. Relation ids may be gone (the person removed the line). */
function readings(v:unknown,areaIds:Set<string>,texts:Map<string,RecordText>,projectId:string,materialIds:Set<string>) {
  list(v,READINGS_LIMIT);const seen=new Map<string,Map<string,number>>(),hashes=new Set<string>();
  const raw=new Map([...texts].map(([k,t])=>[k,t.raw] as const)),asRead=new Map([...texts].map(([k,t])=>[k,t.read] as const));
  let records=raw;
  // map-reading.4: a quote is exactly the slice [from, to) of its record, inside an interval that reading was sent.
  let four=false,read:{id:string;from:number;to:number}[]=[];
  const at=(record:unknown,quote:unknown,from:unknown,to:unknown)=>{integer(from);integer(to);ensure((from as number)<(to as number)&&records.get(record as string)!.slice(from as number,to as number)===quote&&read.some(x=>x.id===record&&x.from<=(from as number)&&(to as number)<=x.to));};
  const quote=(q:unknown)=>{obj(q,['record','quote',...(four?['from','to']:[])]);ensure(records.has(q.record as string));text(q.quote,four?ANCHOR_QUOTE_MAX:300);if(four)at(q.record,q.quote,q.from,q.to);};
  const entries=new Set<string>();
  const requestReadings=new Map<string,{requests:FrozenRequest[];matches:StoredRequestMatch[]}>();
  for(const r of v as unknown[]){
    if(!!r&&typeof r==='object'&&(r as {version?:unknown}).version==='request-correction.1'){
      obj(r,['version','id','at','reading','index','target']);id(r.id);date(r.at);ensure(!entries.has(r.id as string));entries.add(r.id as string);integer(r.index);
      const original=requestReadings.get(r.reading as string);ensure(original&&original.matches[r.index as number]);
      if(r.target!==null){obj(r.target,['requestId','itemId']);ensure(hasTarget(original.requests,r.target as unknown as {requestId:string;itemId:string}));}continue;
    }
    if(!!r&&typeof r==='object'&&(r as {version?:unknown}).version==='replace-correction.1'){
      // Whether the link it undoes holds where it stands is the ledger's (below).
      obj(r,['version','id','at','reading','index']);id(r.id);date(r.at);ensure(!entries.has(r.id as string));entries.add(r.id as string);integer(r.index);
      ensure(!!requestReadings.get(r.reading as string)?.matches[r.index as number]?.replaces);continue;
    }
    if(!!r&&typeof r==='object'&&(r as {version?:unknown}).version==='scenario-reading.1'){
      // A scenario record as read: a pasted record of this project, read against a ledger of an earlier map reading (or none).
      validateScenarioReading(r,areaIds,new Set([...texts.keys()]),new Set(seen.keys()));ensure(!entries.has((r as {id:string}).id));entries.add((r as {id:string}).id);continue;
    }
    if(!!r&&typeof r==='object'&&(r as {version?:unknown}).version==='map-correction.1'){
      obj(r,['version','id','at','areaId','text','corrects']);id(r.id);ensure(!entries.has(r.id as string));entries.add(r.id as string);date(r.at);
      ensure(areaIds.has(r.areaId as string));text(r.text,300);ensure(r.corrects===null||seen.has(r.corrects as string));continue;
    }
    const version=!!r&&typeof r==='object'?(r as {version?:unknown}).version:null;
    const twenty=version==='map-reading.20',nineteen=twenty||version==='map-reading.19',eighteen=nineteen||version==='map-reading.18',seventeen=eighteen||version==='map-reading.17',sixteen=seventeen||version==='map-reading.16',fifteen=sixteen||version==='map-reading.15',fourteen=fifteen||version==='map-reading.14',thirteen=fourteen||version==='map-reading.13',twelve=thirteen||version==='map-reading.12',eleven=twelve||version==='map-reading.11',ten=eleven||version==='map-reading.10',nine=ten||version==='map-reading.9',eight=nine||version==='map-reading.8',seven=eight||version==='map-reading.7',six=seven||version==='map-reading.6',five=six||version==='map-reading.5';four=five||version==='map-reading.4';const three=four||version==='map-reading.3',two=three||version==='map-reading.2';records=four?asRead:raw;
    obj(r,['version','id','at','model','prompt','hash','records','summary','parts','relations','candidates','gaps','skipped',...(two?['requests','matches']:[]),...(four?['material']:[]),...(six?['exclusions']:[]),...(eight?['basisAt','basisVersion']:[]),...(nine?['portMap']:[]),...(eighteen?READING18_KEYS:[]),...(nineteen?READING19_KEYS:[]),...(twenty?['rows']:[])]);ensure(r.version==='map-reading.1'||two);
    // map-reading.20 (recipe .50): the rows of a v5 record this reading sent or left out for room, each once, with its state.
    if(twenty)readingRows(r.rows,areaIds);
    // map-reading.8: the records' own basis time and target version, as written, or null.
    if(eight){if(r.basisAt!==null)text(r.basisAt,60);if(r.basisVersion!==null)text(r.basisVersion,60);}
    id(r.id);ensure(!entries.has(r.id as string));entries.add(r.id as string);date(r.at);text(r.model,80);text(r.prompt,40);ensure(typeof r.hash==='string'&&/^[0-9a-f]{64}$/.test(r.hash)&&!hashes.has(r.hash));hashes.add(r.hash as string);
    list(r.records,16);ensure((r.records as unknown[]).length>0);for(const x of r.records){obj(x,['id','from','to','total',...(four?['digest']:[])]);ensure(records.has(x.id as string));integer(x.from);integer(x.to);integer(x.total);ensure((x.from as number)<(x.to as number)&&(x.to as number)<=(x.total as number));
      // The digest names exactly the text read: the record is the one this reading was made of, its whole length too.
      if(four)ensure(records.get(x.id as string)!.length===x.total&&x.digest===textDigest(records.get(x.id as string)!.slice(x.from as number,x.to as number)));}
    read=r.records as {id:string;from:number;to:number}[];
    // map-reading.17 (pipeline .42): a summary of 360 (earlier entries 200).
    text(r.summary,seventeen?360:200,true);list(r.parts,64);const claims=new Map<string,number>(),parts=new Set<string>();
    for(const p of r.parts){
      obj(p,['areaId','created','role','roleAbout','roleReplaces','basis','claims',...(seven?['state','stateWhen','stateQuote','files']:[]),...(eight?['type','typeQuote','inputs','outputs','fields','config']:[]),...(nine?['steps','loop','stateVars']:[]),...(twelve?['conditions']:[]),...(fourteen?['fileRoles']:[]),...(eighteen?PART18_KEYS:[]),...(nineteen?PART19_KEYS:[])]);if(p.roleAbout!==null){ensure(p.role!==null);text(p.roleAbout,80);}
      // map-reading.18 (pipeline .43): the part's own v4 table fields (record-reading.ts), each on its row; a screen or automation type.
      if(eighteen)part18(p,quote,nineteen);if(nineteen)part19(p,quote);
      // map-reading.8: the record's own type word with its passage (none: both null), and the part's interface, fields and settings.
      // map-reading.9 holds eight inputs and outputs, 24 fields and eight settings; a map-reading.8 entry keeps its six, twelve and four.
      // map-reading.16 (pipeline .41): twelve settings.
      // Pipeline .31: a map-reading.9 field item may run to 60 (40 before; every earlier entry still reads).
      const unique=(v:unknown)=>ensure(new Set(v as unknown[]).size===(v as unknown[]).length);
      if(eight){ensure(p.type===null||(eighteen?PART_TYPES:PART_TYPES_17).includes(p.type as never));if(p.type===null)ensure(p.typeQuote===null);else quote(p.typeQuote);
        for(const [k,n,len] of [['inputs',nine?8:6,60],['outputs',nine?8:6,60],['fields',nine?24:12,nine?60:40],['config',sixteen?12:nine?8:4,80]] as const){list(p[k],n);for(const f of p[k] as unknown[])text(f,len);unique(p[k]);}}
      // map-reading.9: the part's steps (each on its row), its loop (at least one of unit, stop, resume, on its line) and kept state.
      if(nine){
        // map-reading.14: every step says whether the program put it there (a program step does nothing and uses nothing).
        // map-reading.16 (pipeline .41): sixteen steps (earlier entries twelve).
        // map-reading.17 (pipeline .42): a step name of 60 (earlier entries 40).
        // map-reading.17: 24 steps, each with its row's 조건·분기 cell (when: 120 or null).
        list(p.steps,seventeen?24:sixteen?16:12);for(const s of p.steps as unknown[]){obj(s,['name','does','uses','quote',...(fourteen?['program']:[]),...(seventeen?['when']:[]),...(eighteen?STEP18_KEYS:[]),...(nineteen?['cites']:[])]);if(eighteen)step18(s);if(nineteen)cites19(s.cites);text(s.name,seventeen?60:40);if(seventeen&&s.when!==null)text(s.when,120);if(s.does!==null)text(s.does,120);list(s.uses,4);for(const u of s.uses as unknown[])text(u,60);unique(s.uses);quote(s.quote);
          // map-reading.15: a program step's does may hold its name's parenthesised tail (it still uses nothing).
          if(fourteen)ensure(typeof s.program==='boolean'&&(!s.program||(fifteen||s.does===null)&&(s.uses as unknown[]).length===0));}
        unique((p.steps as {name:unknown}[]).map(s=>s.name));
        // map-reading.13: every loop and kept state says whether the program put it there (a program state names nothing but itself).
        if(p.loop!==null){obj(p.loop,['unit','stop','resume','quote',...(thirteen?['program']:[])]);for(const k of ['unit','stop','resume'] as const)if(p.loop[k]!==null)text(p.loop[k],60);ensure(p.loop.unit!==null||p.loop.stop!==null||p.loop.resume!==null);quote(p.loop.quote);if(thirteen)ensure(typeof p.loop.program==='boolean');}
        list(p.stateVars,8);for(const s of p.stateVars as unknown[]){obj(s,['name','scope','readBy','changedBy',...(thirteen?['program']:[])]);text(s.name,40);if(s.scope!==null)text(s.scope,40);for(const k of ['readBy','changedBy'] as const){list(s[k],4);for(const u of s[k] as unknown[])text(u,40);unique(s[k]);}
          if(thirteen)ensure(typeof s.program==='boolean'&&(!s.program||s.scope===null&&(s.readBy as unknown[]).length===0&&(s.changedBy as unknown[]).length===0));}
        unique((p.stateVars as {name:unknown}[]).map(s=>s.name));
      }
      // map-reading.12: the part's condition rows (up to 24), each its condition, outcome and other outcome as written, on its own row, once.
      if(twelve){list(p.conditions,24);for(const c of p.conditions as unknown[]){obj(c,['when','then','else','quote',...(eighteen?['phase']:[])]);if(eighteen)ensure(c.phase===null||CONDITION_PHASES.includes(c.phase as never));text(c.when,80);text(c.then,60);if(c.else!==null)text(c.else,60);quote(c.quote);}
        unique((p.conditions as {quote:{record:unknown;from:unknown;to:unknown}}[]).map(c=>JSON.stringify([c.quote.record,c.quote.from,c.quote.to])));}
      // map-reading.14: the part's file-map rows (up to twelve), each its path (120) and role (80) as written, on its own row, each path once.
      // map-reading.17 (pipeline .42): a role of 120 (earlier entries 80).
      if(fourteen){list(p.fileRoles,12);for(const f of p.fileRoles as unknown[]){obj(f,['path','role','quote',...(eighteen?['runtime']:[])]);if(eighteen)ensure(typeof f.runtime==='boolean');text(f.path,120);text(f.role,seventeen?120:80);quote(f.quote);}
        unique((p.fileRoles as {path:unknown}[]).map(f=>f.path));}
      if(p.roleReplaces!==null){ensure(p.role!==null&&p.created===null);quote(p.roleReplaces);}ensure(areaIds.has(p.areaId as string)&&!parts.has(p.areaId as string));parts.add(p.areaId as string);
      if(p.created!==null){obj(p.created,['name','parentId']);text(p.created.name,60);ensure(p.created.parentId===null||areaIds.has(p.created.parentId as string));}
      if(p.role!==null)text(p.role,300);list(p.basis,4);for(const q of p.basis)quote(q);ensure(p.created===null||(p.basis as unknown[]).length>0);
      // map-reading.7: the record's own state word for the part, with its passage and when (none: all null), and its files.
      if(seven){ensure(p.state===null||PART_STATES.includes(p.state as never));if(p.state===null)ensure(p.stateWhen===null&&p.stateQuote===null);else{quote(p.stateQuote);if(p.stateWhen!==null)text(p.stateWhen,40);}
        list(p.files,6);for(const f of p.files)text(f,120);ensure(new Set(p.files).size===(p.files as unknown[]).length);}
      // Pipeline .32: a map-reading.9 entry holds sixteen claims per part (the first map's contract, MAP6_CLAIMS); earlier ones eight.
      // Pipeline .33: a map-reading.10 entry holds twenty (.11 too).
      list(p.claims,ten?20:nine?16:8);(p.claims as unknown[]).forEach((c,i)=>{
        obj(c,['kind','text','record','quote',...(four?['from','to']:[]),'about','replaces',...(seven?['topic','evidence','when','where','before']:[]),...(ten?['scope','scopeName','anchors','enforcedBy','withdrawalKind','gate']:[]),...(eighteen?CLAIM18_KEYS:[]),...(nineteen?['cites','foundBy']:[])]);if(eighteen)claim18(c,quote);if(nineteen){cites19(c.cites);ensure(c.foundBy===null||FOUND_BY.includes(c.foundBy as never)&&c.topic==='change');}
        // map-reading.10: a rule's scope (a step, port or field named, a part or the project not), places and devices, each once, on
        // their passages (a device's passage null only for unknown; no none or unknown beside a device, no unknown beside a none); a
        // withdrawal's kind; a gate's kind. Each only on a claim of its own topic.
        if(ten){
          ensure(c.scope===null||RULE_SCOPES.includes(c.scope as never));const named=c.scope==='step'||c.scope==='port'||c.scope==='field';
          if(named)text(c.scopeName,40);else ensure(c.scopeName===null);
          // map-reading.11: every place says whether the program put it there (a program candidate is always inferred).
          list(c.anchors,4);for(const a of c.anchors as unknown[]){obj(a,['kind','text','quote',...(eleven?['program']:[])]);ensure(ANCHOR_KINDS.includes(a.kind as never));text(a.text,80);quote(a.quote);if(eleven)ensure(typeof a.program==='boolean'&&(!a.program||a.kind==='inferred'));}
          ensure(new Set((c.anchors as {text:string;quote:{record:string;from:number;to:number}}[]).map(a=>JSON.stringify([a.text,a.quote.record,a.quote.from,a.quote.to]))).size===(c.anchors as unknown[]).length);
          // map-reading.15: every device says whether the program put it there (a program device is code, on its row). map-reading.16: or a
          // person (a hand-kept rule's 누가 정했나 cell), on its row.
          list(c.enforcedBy,4);for(const e of c.enforcedBy as unknown[]){obj(e,['kind','text','quote',...(fifteen?['program']:[])]);ensure(ENFORCER_KINDS.includes(e.kind as never));text(e.text,80);if(e.quote===null)ensure(e.kind==='unknown');else quote(e.quote);
            // map-reading.17: or unknown with no passage (a rule whose decider device was set aside).
            if(fifteen)ensure(typeof e.program==='boolean'&&(!e.program||(e.kind==='code'||sixteen&&e.kind==='person'||eighteen&&(e.kind==='gate'||e.kind==='none'))&&e.quote!==null||seventeen&&e.kind==='unknown'&&e.quote===null));}
          const devices=c.enforcedBy as {kind:string;text:string}[],rank=(k:string)=>k==='none'?1:k==='unknown'?0:2,top=Math.max(-1,...devices.map(e=>rank(e.kind)));
          ensure(new Set(devices.map(e=>JSON.stringify([e.kind,e.text]))).size===devices.length&&devices.every(e=>rank(e.kind)===2||rank(e.kind)===top));
          ensure(c.topic==='rule'||c.scope===null&&(c.anchors as unknown[]).length===0&&devices.length===0);
          ensure(c.withdrawalKind===null||WITHDRAWAL_KINDS.includes(c.withdrawalKind as never)&&c.topic==='withdrawn');
          ensure(c.gate===null||GATE_KINDS.includes(c.gate as never)&&c.topic==='plan');
        }
        // map-reading.7: what the claim is about, its tag, when and where as written; the decision before for a withdrawal only.
        if(seven){ensure(c.topic===null||CLAIM_TOPICS.includes(c.topic as never));ensure(c.evidence===null||EVIDENCE_GRADES.includes(c.evidence as never));if(c.when!==null)text(c.when,40);if(c.where!==null)text(c.where,120);if(c.before!==null){text(c.before,120);ensure(c.topic==='withdrawn');}}ensure(CLAIM_KINDS.includes(c.kind as never));text(c.text,240);quote({record:c.record,quote:c.quote,...(four?{from:c.from,to:c.to}:{})});
        if(c.about!==null)text(c.about,80);
        if(c.replaces!==null){obj(c.replaces,['reading','index']);integer(c.replaces.index);const n=seen.get(c.replaces.reading as string)?.get(p.areaId as string);ensure(n!==undefined&&(c.replaces.index as number)<n);}
      });
      claims.set(p.areaId as string,(p.claims as unknown[]).length);
    }
    // map-reading.9: a first map holds 48 relations (earlier readings 32).
    // map-reading.13: every relation holds the fields of the format artifact it carries (up to 24 of 60, each once; [] when not said).
    list(r.relations,nine?48:32);for(const x of r.relations){obj(x,['relationId','from','to','kind','quote',...(seven?['payload','cadence','mode']:[]),...(eight?['channel']:[]),...(thirteen?['payloadFields']:[]),...(eighteen?RELATION18_KEYS:[]),...(nineteen?['claimNature','cites']:[])]);if(eighteen)relation18(x);if(nineteen){ensure(x.claimNature===null||CLAIM_NATURES.includes(x.claimNature as never));cites19(x.cites);}if(seven){if(x.payload!==null)text(x.payload,80);if(x.cadence!==null)text(x.cadence,seventeen?80:40);ensure(x.mode===null||RELATION_MODES.includes(x.mode as never));}if(eight)ensure(x.channel===null||CHANNELS.includes(x.channel as never));
      if(thirteen){list(x.payloadFields,24);for(const f of x.payloadFields as unknown[])text(f,60);ensure(new Set(x.payloadFields as unknown[]).size===(x.payloadFields as unknown[]).length);}id(x.relationId);ensure(areaIds.has(x.from as string)&&areaIds.has(x.to as string)&&x.from!==x.to);ensure(['flow','needs','shares','related'].includes(x.kind as string));quote(x.quote);}
    // map-reading.9: each port-map row names a relation of this reading, the part at its end by direction (in: the receiver, out: the
    // sender) as this reading kept it, an input or output name and a step of that part, once each, on its own passage.
    // map-reading.14: every row says whether the program put it there.
    // map-reading.15: up to 24 rows (the program's beside the model's twelve).
    if(nine){list(r.portMap,fifteen?24:12);const rows=new Set<string>();for(const m of r.portMap as unknown[]){obj(m,['relationId','areaId','port','step','direction','quote',...(fourteen?['program']:[])]);if(fourteen)ensure(typeof m.program==='boolean');
      ensure(m.direction==='in'||m.direction==='out');text(m.port,40);text(m.step,seventeen?60:40);quote(m.quote);
      const line=(r.relations as {relationId:unknown;from:unknown;to:unknown}[]).find(x=>x.relationId===m.relationId);ensure(!!line&&m.areaId===(m.direction==='in'?line!.to:line!.from));
      const part=(r.parts as {areaId:unknown;steps:{name:unknown}[];inputs:unknown[];outputs:unknown[]}[]).find(x=>x.areaId===m.areaId);
      ensure(!!part&&part!.steps.some(s=>s.name===m.step)&&(m.direction==='in'?part!.inputs:part!.outputs).includes(m.port));
      const key=JSON.stringify([m.relationId,m.port,m.step,m.direction]);ensure(!rows.has(key));rows.add(key);}}
    // map-reading.5: each candidate says what it leaves undecided; an undecided statement is kept in it, exact where it stands.
    if(five){list(r.candidates,twenty?32:16);}if(five)for(const c of r.candidates as unknown[]){obj(c,['text','areaIds','quote','target','statement']);ensure(['attribution','identity','parent','holds'].includes(c.target as string));
      const held=c.target==='attribution'||c.target==='holds';ensure(held?c.statement!==null:c.statement===null);list(c.areaIds,c.target==='holds'?1:2);
      if(c.statement!==null){obj(c.statement,['kind','text','about','quote']);ensure(CLAIM_KINDS.includes(c.statement.kind as never));text(c.statement.text,240);if(c.statement.about!==null)text(c.statement.about,80);quote(c.statement.quote);}}
    // map-reading.20 (recipe .50 step 4): 32 candidates (a held part's relations among them); earlier entries 16.
    list(r.candidates,twenty?32:16);for(const c of r.candidates){obj(c,['text','areaIds','quote',...(five?['target','statement']:[])]);text(c.text,240);list(c.areaIds,2);for(const a of c.areaIds)ensure(areaIds.has(a as string));if(c.quote!==null)quote(c.quote);}
    // map-reading.18 (pipeline .43): the reading's own fields from v4 records (record-reading.ts).
    if(eighteen)reading18(r,quote,records,read,nineteen);if(nineteen)reading19(r,quote);
    list(r.gaps,2);for(const g of r.gaps)text(g,160);
    list(r.skipped,64);for(const x of r.skipped){obj(x,['what','name','reason']);ensure(['part','relation'].includes(x.what as string));text(x.name,200);ensure(['same-name','archived','removed','exists','parent-skipped',...(four?['material']:[])].includes(x.reason as string));}
    if(four){list(r.material,8);for(const x of r.material){obj(x,['record','from','to','what']);ensure(records.has(x.record as string));text(x.what,120);integer(x.from);integer(x.to);ensure((x.from as number)<(x.to as number)&&read.some(y=>y.id===x.record&&y.from<=(x.from as number)&&(x.to as number)<=y.to));}}
    if(six){list(r.exclusions,512);for(const x of r.exclusions){
      // pipeline .38 (map-reading.13): an io item's exclusion may carry the value it set aside (≤60, never secret-like), as stored.
      const valued=thirteen&&!!x&&typeof x==='object'&&Object.hasOwn(x,'value');
      obj(x,['path','rule','category','explanation','record','from','to',...(valued?['value']:[])]);text(x.path,160);
      if(valued){text(x.value,60);ensure(/^parts\[\d+\]\.(inputs|outputs)\[\d+\]$/.test(x.path as string)&&!secretLike(x.value as string));}ensure((twelve?/^(parts|relations|candidates|gaps|matches|material|basisAt|basisVersion|portMap)(\[\d+\])?(\.(claims|basis|statement|steps|stateVars|loop|conditions)(\[\d+\])?)?(\.[A-Za-z]+(\[\d+\])?)?$/:nine?/^(parts|relations|candidates|gaps|matches|material|basisAt|basisVersion|portMap)(\[\d+\])?(\.(claims|basis|statement|steps|stateVars|loop)(\[\d+\])?)?(\.[A-Za-z]+(\[\d+\])?)?$/:/^(parts|relations|candidates|gaps|matches|material|basisAt|basisVersion)(\[\d+\])?(\.(claims|basis|statement)(\[\d+\])?)?(\.[A-Za-z]+)?$/).test(x.path as string));text(x.explanation,160);
      ensure(READING_EXCLUSION_RULES.includes(x.rule as never));ensure(x.category===null||typeof x.category==='string'&&/^[a-z][a-z-]{0,39}$/.test(x.category));
      if(x.record===null)ensure(x.from===null&&x.to===null);else{ensure(records.has(x.record as string));integer(x.from);integer(x.to);ensure((x.from as number)<(x.to as number)&&read.some(y=>y.id===x.record&&y.from<=(x.from as number)&&(x.to as number)<=y.to));}
    }}
    if(two){
      list(r.requests,8);const requests=(r.requests as unknown[]).map(validateFrozenRequest);ensure(requests.every(q=>q.projectId===projectId)&&new Set(requests.map(q=>q.id)).size===requests.length);
      list(r.matches,24);const matches=(r.matches as unknown[]).map(m=>validateStoredMatch(m,requests,r.records as {id:string;from:number;to:number}[],records,materialIds,three,four?ANCHOR_QUOTE_MAX:300));
      requestReadings.set(r.id as string,{requests,matches});
    }
    seen.set(r.id as string,claims);
  }
  // Every withdrawal names an earlier match that, where it stands, answers the very same frozen item; nothing is taken back twice.
  ensure(!matchLedger(v as ReadingEntry[],texts).invalid);
}
export const POSITION_LIMIT=200000;
function planStamp(v:unknown) {
  const two=!!v&&typeof v==='object'&&Object.hasOwn(v,'version');
  obj(v,['name','note','brief','decisions','work',...(two?['version','revision','ancestors']:[])]);text(v.name,60);text(v.note,2000,true);integer(v.brief);list(v.decisions,ITEM_LIMIT);list(v.work,ITEM_LIMIT);
  if(two){ensure(v.version==='plan.2');integer(v.revision);list(v.ancestors,500);const seen=new Set<string>();for(const a of v.ancestors){obj(a,['id','name','note','revision']);id(a.id);text(a.name,60);text(a.note,2000,true);integer(a.revision);ensure(!seen.has(a.id as string));seen.add(a.id as string);}}
  // One fixed-length entry per task with user-written work values or a purpose correction: '<task id>:<sha256>'. Never the
  // values themselves, so an allowed text (any quotes or backslashes, up to its own limit) cannot make the stamp invalid.
  for(const w of v.work)ensure(typeof w==='string'&&/^[A-Za-z0-9_-]{1,100}:[0-9a-f]{64}$/.test(w));ensure(new Set(v.work).size===v.work.length);
  for(const d of v.decisions)ensure(typeof d==='string'&&/^D[1-9]\d*@\d+$/.test(d));ensure(new Set(v.decisions).size===v.decisions.length);
}
/** One parent, explicit stable ids, ordered acyclic forest; inactive historical links remain readable. */
function containment(v:unknown,areas:Area[]) {
  obj(v,['version','parents','revisions']);ensure(v.version==='containment.1');
  ensure(!!v.parents&&typeof v.parents==='object'&&!Array.isArray(v.parents));ensure(!!v.revisions&&typeof v.revisions==='object'&&!Array.isArray(v.revisions));
  const byId=new Map(areas.map(a=>[a.id,a])),parents=v.parents as Record<string,unknown>,revisions=v.revisions as Record<string,unknown>;
  ensure(Object.keys(revisions).length===areas.length);
  for(const a of areas){ensure(Object.hasOwn(revisions,a.id));integer(revisions[a.id]);}
  for(const [child,parent] of Object.entries(parents)){ensure(byId.has(child)&&typeof parent==='string'&&byId.has(parent)&&child!==parent);if(!byId.get(child)!.archived)ensure(!byId.get(parent as string)!.archived);}
  for(const a of areas){const seen=new Set<string>();let id:string|undefined=a.id;while(id){ensure(!seen.has(id));seen.add(id);id=parents[id] as string|undefined;}}
}
const HELD=['no-anchor','area-moved','area-mismatch','area-archived','file-basis','superseded','plan-changed'];
/** AREA17 shape: per area, a revision counter and its entries in arrival order. Exactly one entry holds each applied revision
 * 1..revision, in increasing order; held entries have no revision and no stamp. References are checked after the tasks. */
function areaUnderstanding(v:unknown,ids:Set<string>) {
  ensure(!!v&&typeof v==='object'&&!Array.isArray(v));
  for(const [areaId,state] of Object.entries(v as Record<string,unknown>)) {
    ensure(ids.has(areaId));obj(state,['revision','entries']);integer(state.revision);list(state.entries,ITEM_LIMIT);
    let last=0;
    for(const e of state.entries) {
      obj(e,['by','at','revision','taskId','returnId','text','corrects','stamp','held']);date(e.at);ensure(e.by==='external'||e.by==='user');
      if(e.revision===null){ensure(e.by==='external'&&e.stamp===null&&HELD.includes(e.held as string));}
      else {integer(e.revision);ensure((e.revision as number)===last+1&&e.held===null);last=e.revision as number;planStamp(e.stamp);}
      if(e.by==='external'){id(e.taskId);id(e.returnId);ensure(e.text===null&&e.corrects===null);}
      else {ensure(e.taskId===null&&e.returnId===null&&e.revision!==null);text(e.text,SUMMARY_LIMIT);integer(e.corrects);ensure((e.corrects as number)>=1&&(e.corrects as number)===(e.revision as number)-1);}
    }
    ensure(last===state.revision);
  }
}
/** External entries point at a received return task whose own return.2 file carries an organised description. An applied
 * one must describe the area it is filed under; one task is filed once. */
function understandingRefs(space:Record<string,unknown>,tasks:Task[],sources:Map<string,Source>) {
  const byId=new Map(tasks.map(t=>[t.id,t])),seen=new Set<string>();
  const states=space.understanding as Project['space']['understanding'];
  const context=space.containment as Project['space']['containment'];
  const checkStamp=(stamp:PlanStamp|null,areaId:string)=>{if(!stamp||!('version' in stamp))return;ensure(stamp.revision<=context.revisions[areaId]!);for(const a of stamp.ancestors)ensure(a.id!==areaId&&Object.hasOwn(context.revisions,a.id)&&a.revision<=context.revisions[a.id]!);};
  for(const t of tasks)for(const h of t.handoffs)if(h.anchor)checkStamp(h.anchor.stamp,h.anchor.areaId);
  for(const t of tasks)for(const h of t.handoffs)if(h.anchor)ensure(h.anchor.understanding<=(states[h.anchor.areaId]?.revision??0));
  for(const [areaId,state] of Object.entries(states)) {
    for(const e of state.entries) {
      checkStamp(e.stamp,areaId);
      if(e.by!=='external')continue;
      const t=byId.get(e.taskId!);ensure(t&&t.resultFile&&!seen.has(t.id)&&['report','evidence'].includes(sources.get(t.sourceIds[0]!)?.kind??''));seen.add(t.id);
      const f=parseResultFile(t.resultFile.rawText);ensure(f.returnId===e.returnId&&!!f.understanding);
      if(e.revision!==null){
        const parent=byId.get(t.parentTaskId!),record=parent?.handoffs.find(h=>h.returnId===f.returnId),anchor=record?.anchor;
        ensure(f.understanding.areaId===areaId&&anchor&&anchor.areaId===areaId&&f.understanding.basedOn===anchor.understanding&&anchor.understanding<e.revision);
        ensure(JSON.stringify(e.stamp)===JSON.stringify(anchor.stamp));
        // History: an applied external description follows exactly the revision its export carried, or a revised interpretation of
        // that same export (same returnId) directly before it. Anything in between (a user correction, another return) means it
        // was never applicable; a file claiming otherwise contradicts its own history.
        const prev=state.entries.find(x=>x.revision===e.revision!-1);
        ensure(anchor.understanding===e.revision-1||!!prev&&prev.by==='external'&&prev.returnId===e.returnId);
      }
    }
  }
}
/** The project.4/5 shape of an empty space (project.6 adds 'understanding' in migrateV5). */
export const EMPTY_SPACE=()=>({brief:null,areas:[],relations:[],draftTarget:null,layout:{version:'layout.1' as const,positions:{}}});
export function validateProject(v: unknown): Project { assertProject(v); return structuredClone(v); }
/** Identity check for an exported text (FNV-1a, 32 bit). Not a signature or security control. */
export function digest(value: string): string {
  let h=0x811c9dc5; for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,0x01000193);} return (h>>>0).toString(16).padStart(8,'0');
}
/** AREA17: SHA-256 (FIPS 180-4) of the UTF-8 bytes, hex. Synchronous and dependency-free so the shared code computes the same
 * fixed-length fingerprint in the browser and in Node. Used where an exact-equality check must not grow with the text. */
const K256=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
export function sha256(value:string):string {
  const data=new TextEncoder().encode(value),n=((data.length+9+63)>>6)<<6,m=new Uint8Array(n);m.set(data);m[data.length]=0x80;
  const bits=data.length*8;new DataView(m.buffer).setUint32(n-4,bits>>>0);new DataView(m.buffer).setUint32(n-8,Math.floor(bits/0x100000000));
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64),view=new DataView(m.buffer);
  const r=(x:number,k:number)=>(x>>>k)|(x<<(32-k));
  for(let off=0;off<n;off+=64) {
    for(let i=0;i<16;i++)w[i]=view.getUint32(off+i*4);
    for(let i=16;i<64;i++){const a=w[i-15]!,b=w[i-2]!;w[i]=(w[i-16]!+(r(a,7)^r(a,18)^(a>>>3))+w[i-7]!+(r(b,17)^r(b,19)^(b>>>10)))>>>0;}
    let [a,b,c,d,e,f,g,k]=h as [number,number,number,number,number,number,number,number];
    for(let i=0;i<64;i++){
      const t1=(k+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+K256[i]!+w[i]!)>>>0,t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      k=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,k].forEach((x,i)=>{h[i]=(h[i]!+x)>>>0;});
  }
  return h.map(x=>x.toString(16).padStart(8,'0')).join('');
}
export const MIGRATION_NOTICE='이전 형식(project.1)에서 변환했습니다. 기록은 지우지 않았습니다. 이전 AI 정리는 어느 기준 시점에 작성됐는지 알 수 없어 현재 작업문에서 제외합니다.';
export const V2_MIGRATION_NOTICE='이전 형식(project.2)을 최신 형식으로 변환했습니다. 기록은 유지하며 과거 내보내기에 파일 식별자를 만들지 않습니다.';
/** project.1 -> project.2. Nothing user-authored is dropped: old export texts move to legacyText. */
export function migrateLegacy(v: unknown): unknown {
  obj(v,['schemaVersion','id','revision','name','sources','bases','tasks','currentTaskId','draft','answerDraft','basisDraft','basisEdits','draftKind','pending','notice']);
  ensure(v.schemaVersion === LEGACY_SCHEMA); list(v.bases); list(v.tasks);
  const bases=v.bases.map(b=>{ obj(b,['id','text','status','sourceId','locked','revision','history']); ensure(typeof b.locked === 'boolean'); const {locked:_unused,...rest}=b; return rest; });
  const tasks=v.tasks.map(t=>{
    obj(t,['id','sourceIds','parentTaskId','advice','mode','manual','suggestions','handoffs']); list(t.handoffs);
    const handoffs=t.handoffs.map(h=>{ obj(h,['at','text','revision','method']); text(h.text,250000);
      return {at:h.at,method:h.method,revision:h.revision,chars:h.text.length,digest:digest(h.text),work:null,aiExcluded:false,legacyText:h.text}; });
    return {...t,adviceRevision:null,handoffs};
  });
  return migrateV2({...v,schemaVersion:PREVIOUS_SCHEMA,bases,tasks,notice:MIGRATION_NOTICE},MIGRATION_NOTICE);
}
export function isLegacy(raw: string): boolean { try { return (JSON.parse(raw) as {schemaVersion?:unknown})?.schemaVersion === LEGACY_SCHEMA; } catch { return false; } }
export function isPrevious(raw:string):boolean {try{return JSON.parse(raw)?.schemaVersion===PREVIOUS_SCHEMA;}catch{return false;}}
function migrateV2(v:unknown, notice=V2_MIGRATION_NOTICE):unknown {
  obj(v,['schemaVersion','id','revision','name','sources','bases','tasks','currentTaskId','draft','answerDraft','basisDraft','basisEdits','draftKind','pending','notice']);
  ensure(v.schemaVersion===PREVIOUS_SCHEMA);list(v.tasks);
  const tasks=v.tasks.map(t=>{
    obj(t,['id','sourceIds','parentTaskId','advice','adviceRevision','mode','manual','suggestions','handoffs']);list(t.handoffs);
    const handoffs=t.handoffs.map(h=>{obj(h,['at','method','revision','chars','digest','work','aiExcluded','legacyText']);return {...h,returnId:null};});
    return {...t,resultFile:null,handoffs};
  });
  return migrateV4({...v,schemaVersion:V4_SCHEMA,tasks,notice,space:EMPTY_SPACE()});
}
/** project.3 -> project.4: nothing changes but an empty plan space (no areas are invented). */
function migrateV3(v:unknown):unknown {
  obj(v,['schemaVersion','id','revision','name','sources','bases','tasks','currentTaskId','draft','answerDraft','basisDraft','basisEdits','draftKind','pending','notice']);ensure(v.schemaVersion===V3_SCHEMA);
  return migrateV4({...v,schemaVersion:V4_SCHEMA,space:EMPTY_SPACE()});
}
/** project.4 -> project.5: no task or export had a background copy. They read null; the current plan is never backfilled. */
function migrateV4(v:unknown):unknown {
  const p=v as {schemaVersion?:unknown;tasks?:unknown;space?:unknown};ensure(p&&p.schemaVersion===V4_SCHEMA);list(p.tasks);
  // The unreleased first project.4 candidate had no draft target ('follow the current work') and no stored positions.
  const space=p.space as Record<string,unknown>|undefined;
  if(space&&typeof space==='object'){if(!Object.hasOwn(space,'draftTarget'))space.draftTarget=null;if(!Object.hasOwn(space,'layout'))space.layout={version:'layout.1',positions:{}};}
  const tasks=p.tasks.map(t=>{
    ensure(t!==null&&typeof t==='object'&&!Array.isArray(t)&&!Object.hasOwn(t,'background'));const task=t as Record<string,unknown>;list(task.handoffs);
    return {...task,background:null,handoffs:task.handoffs.map(h=>{ensure(h!==null&&typeof h==='object'&&!Array.isArray(h)&&!Object.hasOwn(h,'background'));return {...h as object,background:null};})};
  });
  return migrateV5({...p,schemaVersion:V5_SCHEMA,tasks});
}
/** project.5 -> project.6 (AREA17): no area has a derived description and no export has an anchor. Nothing is backfilled:
 * the plan at the time of an older export is unknown, so a later return.2 to it is held, never applied by estimate. */
function migrateV5(v:unknown):unknown {
  const p=v as {schemaVersion?:unknown;tasks?:unknown;space?:unknown};ensure(p&&p.schemaVersion===V5_SCHEMA);list(p.tasks);
  ensure(!!p.space&&typeof p.space==='object'&&!Array.isArray(p.space)&&!Object.hasOwn(p.space,'understanding'));
  const tasks=p.tasks.map(t=>{
    ensure(t!==null&&typeof t==='object'&&!Array.isArray(t));const task=t as Record<string,unknown>;list(task.handoffs);
    return {...task,handoffs:task.handoffs.map(h=>{ensure(h!==null&&typeof h==='object'&&!Array.isArray(h)&&!Object.hasOwn(h,'anchor'));return {...h as object,anchor:null};})};
  });
  return migrateV6({...p,schemaVersion:V6_SCHEMA,tasks,space:{...p.space as object,understanding:{}}});
}
/** A flat v6 project has no inclusion context. Old anchors/stamps remain byte-shaped as recorded, never upgraded. */
function migrateV6(v:unknown):unknown {
  const p=v as {schemaVersion?:unknown;space?:unknown;tasks?:unknown};ensure(p&&p.schemaVersion===V6_SCHEMA);list(p.tasks);
  ensure(!!p.space&&typeof p.space==='object'&&!Array.isArray(p.space)&&!Object.hasOwn(p.space,'containment'));
  const space=p.space as Record<string,unknown>;list(space.areas,500);
  // v6 never carried the new context format: migration must not repair a mislabeled v7 document.
  for(const t of p.tasks){ensure(!!t&&typeof t==='object'&&!Array.isArray(t));const task=t as Record<string,unknown>;list(task.handoffs);for(const h of task.handoffs){ensure(!!h&&typeof h==='object'&&!Array.isArray(h));const a=(h as Record<string,unknown>).anchor;if(a!==null){obj(a,['version','areaId','understanding','stamp']);ensure(a.version==='anchor.1');planStamp(a.stamp);ensure(!Object.hasOwn(a.stamp as object,'version'));}}}
  ensure(!!space.understanding&&typeof space.understanding==='object'&&!Array.isArray(space.understanding));
  for(const state of Object.values(space.understanding as Record<string,unknown>)){obj(state,['revision','entries']);list(state.entries);for(const entry of state.entries){ensure(!!entry&&typeof entry==='object'&&!Array.isArray(entry));const stamp=(entry as Record<string,unknown>).stamp;if(stamp!==null){planStamp(stamp);ensure(!Object.hasOwn(stamp as object,'version'));}}}
  const revisions=Object.fromEntries((space.areas as {id:unknown}[]).map(a=>{id(a.id);return [a.id,0];}));
  return migrateV7({...p,schemaVersion:V7_SCHEMA,space:{...space,containment:{version:'containment.1',parents:{},revisions}}});
}
/** project.7 had no pasted records: it reads as none. Its own keys and bytes are kept as they were. */
function migrateV7(v:unknown):unknown {
  const p=v as {schemaVersion?:unknown};ensure(!!p&&typeof p==='object'&&!Array.isArray(p)&&p.schemaVersion===V7_SCHEMA&&!Object.hasOwn(p,'pasted'));
  return migrateV8({...p,schemaVersion:V8_SCHEMA,pasted:[]});
}
/** project.8 had no map readings: it reads as none. Its own keys and bytes are kept as they were. */
function migrateV8(v:unknown):unknown {
  const p=v as {schemaVersion?:unknown};ensure(!!p&&typeof p==='object'&&!Array.isArray(p)&&p.schemaVersion===V8_SCHEMA&&!Object.hasOwn(p,'readings'));
  return {...p,schemaVersion:SCHEMA,readings:[]};
}
/** project.9 has only the original map readings and role corrections. No request context is invented. */
function migrateV9(v:unknown):unknown {
  const p=v as {schemaVersion?:unknown;readings?:unknown};ensure(p&&p.schemaVersion===V9_SCHEMA);list(p.readings,READINGS_LIMIT);
  for(const r of p.readings)ensure(!!r&&typeof r==='object'&&['map-reading.1','map-correction.1'].includes((r as {version:string}).version));
  return {...p,schemaVersion:SCHEMA};
}
/** project.12 has map readings up to map-reading.4 (candidates without a stated target): they stay as stored. */
function migrateV12(v:unknown):unknown {
  const p=v as {schemaVersion?:unknown;readings?:unknown};ensure(p&&p.schemaVersion===V12_SCHEMA);list(p.readings,READINGS_LIMIT);
  for(const r of p.readings)ensure(!!r&&typeof r==='object'&&['map-reading.1','map-reading.2','map-reading.3','map-reading.4','map-correction.1','request-correction.1','replace-correction.1'].includes((r as {version:string}).version));
  return {...p,schemaVersion:SCHEMA};
}
/** project.11 has map readings without positions (map-reading.1–3): they stay as stored, and no position is derived for them. */
function migrateV11(v:unknown):unknown {
  const p=v as {schemaVersion?:unknown;readings?:unknown};ensure(p&&p.schemaVersion===V11_SCHEMA);list(p.readings,READINGS_LIMIT);
  for(const r of p.readings)ensure(!!r&&typeof r==='object'&&['map-reading.1','map-reading.2','map-reading.3','map-correction.1','request-correction.1','replace-correction.1'].includes((r as {version:string}).version));
  return {...p,schemaVersion:SCHEMA};
}
/** project.10 has request matches without stances and no withdrawal links: they stay as stored and read as unclassified. */
function migrateV10(v:unknown):unknown {
  const p=v as {schemaVersion?:unknown;readings?:unknown};ensure(p&&p.schemaVersion===V10_SCHEMA);list(p.readings,READINGS_LIMIT);
  for(const r of p.readings)ensure(!!r&&typeof r==='object'&&['map-reading.1','map-reading.2','map-correction.1','request-correction.1'].includes((r as {version:string}).version));
  return {...p,schemaVersion:SCHEMA};
}
/** project.13 has normal records of four keys only (checked before every migration): they stay as stored. */
function migrateV13(v:unknown):unknown {
  const p=v as {schemaVersion?:unknown};ensure(!!p&&typeof p==='object'&&!Array.isArray(p)&&p.schemaVersion===V13_SCHEMA);
  return {...p,schemaVersion:SCHEMA};
}
/** The single acceptance test for persisted bytes: autosave, recovery-file download and import all use it. */
/** intent-edit.1 (unreleased AI055 candidate) kept the correction in manual.*, where any later work edit
 * would rewrite it. Every one is converted on the first parse, so no later parse reads manual.* again:
 * a non-blank goal is copied out; otherwise no goal is invented (goal=null) and only the revision that
 * withholds the older AI text and question is kept. manual.* stays as written. The result is revalidated. */
function convertIntentEdits(p:Project):Project {
  let converted=false;
  for(const t of p.tasks) {
    const e=t.intentEdit,goal=t.manual.understanding;
    if(e?.version!=='intent-edit.1')continue;
    t.intentEdit=goal!==null&&goal.trim()?{version:'intent-edit.2',revision:e.revision,goal,conditions:t.manual.scope??''}
      :{version:'intent-edit.2',revision:e.revision,goal:null,conditions:null};
    converted=true;
  }
  if(converted)assertProject(p);
  return p;
}
export function parseProject(raw: string): Project {
  ensure(new TextEncoder().encode(raw).length <= FILE_LIMIT,'FILE_TOO_LARGE'); const v: unknown=JSON.parse(raw);
  const schema=(v as {schemaVersion?:unknown})?.schemaVersion;
  if([LEGACY_SCHEMA,PREVIOUS_SCHEMA,V3_SCHEMA,V4_SCHEMA,V5_SCHEMA,V6_SCHEMA,V7_SCHEMA,V8_SCHEMA,V9_SCHEMA,V10_SCHEMA,V11_SCHEMA,V12_SCHEMA,V13_SCHEMA].includes(schema as never))legacyPasted(v);
  const project=schema===LEGACY_SCHEMA ? migrateLegacy(v) : schema===PREVIOUS_SCHEMA ? migrateV2(v) : schema===V3_SCHEMA ? migrateV3(v) : schema===V4_SCHEMA ? migrateV4(v) : schema===V5_SCHEMA ? migrateV5(v) : schema===V6_SCHEMA ? migrateV6(v) : schema===V7_SCHEMA ? migrateV7(v) : schema===V8_SCHEMA ? migrateV8(v) : schema===V9_SCHEMA ? migrateV9(v) : schema===V10_SCHEMA ? migrateV10(v) : schema===V11_SCHEMA ? migrateV11(v) : schema===V12_SCHEMA ? migrateV12(v) : schema===V13_SCHEMA ? migrateV13(v) : v;
  assertProject(project); return convertIntentEdits(project); // Freshly parsed, not shared: no defensive copy needed.
}

/** A key of a places dictionary: a part id or the map's root, in the id alphabet, and never a name an ordinary object
 * inherits ('__proto__', 'toString', 'constructor'…): writing one of those through a plain object reaches Object.prototype. */
export function placeKey(k: string): boolean { return k.length <= 200 && /^[A-Za-z0-9_-]+$/.test(k) && !(k in Object.prototype); }
const placePoint = (p: unknown): p is Point => {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  const keys = Object.keys(p), x = (p as Point).x, y = (p as Point).y;
  return keys.length === 2 && Object.hasOwn(p, 'x') && Object.hasOwn(p, 'y') && Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 1e6 && Math.abs(y) < 1e6;
};
/** Manual places as a backup carries them: containers of parts, each part at a finite point. Nothing else is accepted. */
export function assertPositions(v: unknown): asserts v is ManualPositions {
  ensure(!!v && typeof v === 'object' && !Array.isArray(v));
  const containers = Object.entries(v as Record<string, unknown>); ensure(containers.length <= ITEM_LIMIT);
  for (const [c, m] of containers) {
    ensure(placeKey(c) && !!m && typeof m === 'object' && !Array.isArray(m));
    for (const [id, p] of Object.entries(m as Record<string, unknown>)) ensure(placeKey(id) && placePoint(p));
  }
}
/** Places read from browser storage or an accepted backup, as dictionaries with no prototype: only well-formed keys and
 * points are kept, and a malformed value reads as no places. */
export function cleanPositions(v: unknown): ManualPositions {
  const out = Object.create(null) as ManualPositions;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [c, m] of Object.entries(v as Record<string, unknown>)) {
    if (!placeKey(c) || !m || typeof m !== 'object' || Array.isArray(m)) continue;
    for (const [id, p] of Object.entries(m as Record<string, unknown>)) {
      if (!placeKey(id) || !placePoint(p)) continue;
      (out[c] ??= Object.create(null) as Record<string, Point>)[id] = { x: p.x, y: p.y };
    }
  }
  return out;
}
/** A backup file in either shape: a plain project (as before), or the same project with its manual places as an extra top-level
 * 'positions'. The project part passes the same parseProject as every other persisted byte; the places are checked apart. */
export function parseBackup(raw: string): Backup {
  ensure(new TextEncoder().encode(raw).length <= FILE_LIMIT, 'FILE_TOO_LARGE');
  const v: unknown = JSON.parse(raw);
  if (!v || typeof v !== 'object' || Array.isArray(v) || !Object.hasOwn(v, 'positions')) return { project: parseProject(raw), positions: null };
  const { positions, ...rest } = v as Record<string, unknown>;
  assertPositions(positions);
  return { project: parseProject(JSON.stringify(rest)), positions };
}

/* ---------- GUIDE097 ---------- */
function guideTicket(v: unknown): asserts v is GuideTicket { obj(v,['projectId','revision','requestId','areaId']); id(v.projectId); integer(v.revision); id(v.requestId); id(v.areaId); }
const GUIDE_WORK = 5;
/** Shape and size of the guidance material. It carries no sources, tasks or bases to write back. */
export function validateGuideRequest(v: unknown): GuideRequest {
  obj(v,['schemaVersion','ticket','projectName','brief','area','decisions','areaWork','answer','currentInstruction']); ensure(v.schemaVersion===GUIDE_SCHEMA);
  if(v.currentInstruction!==null)text(v.currentInstruction); // Same limit as a request draft; blank means none (null), never ''.
  guideTicket(v.ticket); text(v.projectName,120); if(v.brief!==null)text(v.brief);
  obj(v.area,['id','name','note']); id(v.area.id); text(v.area.name,60); if(v.area.note!==null)text(v.area.note,2000);
  ensure(v.area.id===(v.ticket as GuideTicket).areaId);
  list(v.decisions); const ids=new Set<string>();
  for(const d of v.decisions) { obj(d,['id','text','status']); id(d.id); text(d.text); ensure(['confirmed','deferred','answered'].includes(d.status as string)); ensure(!ids.has(d.id as string)); ids.add(d.id as string); }
  list(v.areaWork,GUIDE_WORK);
  for(const w of v.areaWork) { obj(w,['taskId','request','scope','checks']); id(w.taskId); text(w.request); if(w.scope!==null)text(w.scope,6000,true); if(w.checks!==null)text(w.checks,6000,true); } // Blank manual values are valid, as in editTask.
  if(v.answer!==null) { obj(v.answer,['question','text','disposition']); question(v.answer.question); text(v.answer.text); ensure(['provided','unknown','deferred'].includes(v.answer.disposition as string)); }
  ensure(new TextEncoder().encode(JSON.stringify(v)).length<=REQUEST_BYTES,'CONTEXT_TOO_LARGE');
  return structuredClone(v) as unknown as GuideRequest;
}
/** Exactly one of question/proposal. Once the question is answered only a proposal is accepted: at most one question. */
export function validateGuideReply(v: unknown, req: GuideRequest): GuideReply {
  obj(v,['question','proposal']); ensure((v.question===null)!==(v.proposal===null));
  if(v.question!==null) { ensure(req.answer===null); question(v.question); }
  if(v.proposal!==null) {
    const p=v.proposal; obj(p,['goal','scope','checks','open','defaults']); text(p.goal,2000); text(p.scope,2000); text(p.checks,2000);
    list(p.open,6); for(const o of p.open) text(o,500);
    list(p.defaults,6); for(const d of p.defaults) text(d,500);
    // One point is either still the user's to decide (open) or an editable suggestion (defaults), never both.
    const undecided=new Set((p.open as string[]).map(o=>o.trim()));ensure((p.defaults as string[]).every(d=>!undecided.has(d.trim())));
  }
  return structuredClone(v) as unknown as GuideReply;
}
export function validateGuideEnvelope(v: unknown, req: GuideRequest): GuideEnvelope {
  obj(v,['mode','ticket','reply']); ensure(['mock','deepseek'].includes(v.mode as string)); guideTicket(v.ticket);
  ensure(Object.keys(req.ticket).every(k=>req.ticket[k as keyof GuideTicket]===(v.ticket as GuideTicket)[k as keyof GuideTicket]));
  return {mode:v.mode as GuideEnvelope['mode'],ticket:{...v.ticket},reply:validateGuideReply(v.reply,req)};
}
