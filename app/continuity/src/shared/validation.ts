import { API_SCHEMA, SCHEMA, PREVIOUS_SCHEMA, LEGACY_SCHEMA, RESULT_SCHEMA, RESULT_BYTES, RESULT_TEXT_LIMIT, TEXT_LIMIT, FILE_LIMIT, ITEM_LIMIT, REQUEST_BYTES, type Intent, type ResultFile, type ExportRecord, type Task, type Advice, type Basis, type ContextBasis, type ContextRequest, type Envelope, type Project, type Source, type Ticket } from './types.js';
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
/** A file is untrusted data, not an authenticated execution receipt. Never repair/truncate it. */
export function parseResultFile(raw: string): ResultFile {
  ensure(typeof raw==='string' && new TextEncoder().encode(raw).length<=RESULT_BYTES,'RESULT_TOO_LARGE');
  ensure(!raw.startsWith('\uFEFF'),'INVALID_RESULT_FILE');
  const v:unknown=JSON.parse(raw);
  obj(v,['schemaVersion','projectId','taskId','returnId','report','evidence']);
  ensure(v.schemaVersion===RESULT_SCHEMA,'INVALID_RESULT_FILE');
  id(v.projectId); id(v.taskId); id(v.returnId);
  text(v.report,RESULT_TEXT_LIMIT); if(v.evidence!==null)text(v.evidence,RESULT_TEXT_LIMIT);
  return v as unknown as ResultFile;
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
  if (v.question !== null) {
    const q = v.question; obj(q,['kind','text','why','options']); ensure(['fact','choice'].includes(q.kind as string)); text(q.text, 2000); text(q.why, 2000); list(q.options, 3);
    ensure(q.kind !== 'fact' || q.options.length === 0);
    for (const o of q.options) { obj(o,['label','consequence']); text(o.label, 500); text(o.consequence, 1000); }
  }
  return structuredClone(v) as unknown as Advice;
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
export function validateRequest(v: unknown): ContextRequest {
  obj(v,['schemaVersion','ticket','projectName','sources','bases','previousWork','appFacts','previousIntent']); ensure(v.schemaVersion === API_SCHEMA); ticket(v.ticket); text(v.projectName,120);
  list(v.sources); list(v.bases); for (const s of v.sources) source(s); for (const b of v.bases) contextBasis(b);
  ensure(v.sources.length > 0); unique(v.sources as Source[]); unique(v.bases as {id:string}[]);
  if(v.previousIntent!==null) {
    obj(v.previousIntent,['taskId','value','manualGoal','manualConditions']);id(v.previousIntent.taskId);
    if(v.previousIntent.value===null)text(v.previousIntent.manualGoal,6000); // A correction only; no AI interpretation is implied.
    else checkIntentRefs(validateIntent(v.previousIntent.value),v.bases as ContextBasis[]);
    for(const key of ['manualGoal','manualConditions'])if(v.previousIntent[key]!==null)text(v.previousIntent[key],6000,true);
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
  obj(v,['schemaVersion','id','revision','name','sources','bases','tasks','currentTaskId','draft','answerDraft','basisDraft','basisEdits','draftKind','pending','notice']);
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
  for (const t of v.tasks) {
    obj(t,['id','sourceIds','parentTaskId','advice','adviceRevision','mode','manual','suggestions','handoffs','resultFile',...(t&&typeof t==='object'&&Object.hasOwn(t,'intentEdit')?['intentEdit']:[])]); id(t.id); list(t.sourceIds); ensure(t.sourceIds.length > 0);
    for (const s of t.sourceIds) ensure(sources.has(s as string)); ensure(new Set(t.sourceIds).size === t.sourceIds.length);
    if(t.parentTaskId !== null) ensure(tasks.has(t.parentTaskId as string)); // Ordered, acyclic.
    if(t.intentEdit!==undefined) {
      const legacy=!!t.intentEdit&&typeof t.intentEdit==='object'&&(t.intentEdit as {version?:unknown}).version==='intent-edit.1';
      obj(t.intentEdit,legacy?['version','revision']:['version','revision','goal','conditions']);ensure(legacy||t.intentEdit.version==='intent-edit.2');
      integer(t.intentEdit.revision);ensure((t.intentEdit.revision as number)<=(v.revision as number));
      if(!legacy){text(t.intentEdit.goal,6000);text(t.intentEdit.conditions,6000,true);}
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
      obj(h,['at','method','revision','chars','digest','work','aiExcluded','legacyText','returnId']); date(h.at); ensure(['clipboard','download'].includes(h.method as string));
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
export function validateProject(v: unknown): Project { assertProject(v); return structuredClone(v); }
/** Identity check for an exported text (FNV-1a, 32 bit). Not a signature or security control. */
export function digest(value: string): string {
  let h=0x811c9dc5; for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,0x01000193);} return (h>>>0).toString(16).padStart(8,'0');
}
export const MIGRATION_NOTICE='이전 형식(project.1)에서 변환했습니다. 기록은 지우지 않았습니다. 이전 AI 정리는 어느 기준 시점에 작성됐는지 알 수 없어 현재 작업문에서 제외합니다.';
export const V2_MIGRATION_NOTICE='이전 형식(project.2)을 project.3으로 변환했습니다. 기록은 유지하며 과거 내보내기에 파일 식별자를 만들지 않습니다.';
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
  return {...v,schemaVersion:SCHEMA,tasks,notice};
}
/** The single acceptance test for persisted bytes: autosave, recovery-file download and import all use it. */
/** intent-edit.1 (unreleased AI055 candidate) kept the correction in manual.*, where any later work edit
 * would rewrite it. Copy it out once so ordinary edits never change the purpose; manual.* stays as written.
 * An empty legacy correction had nothing to keep and is dropped. */
function convertIntentEdits(p:Project):Project {
  for(const t of p.tasks) {
    if(t.intentEdit?.version!=='intent-edit.1')continue;
    const goal=t.manual.understanding;
    if(goal===null||goal==='')delete t.intentEdit;
    else t.intentEdit={version:'intent-edit.2',revision:t.intentEdit.revision,goal,conditions:t.manual.scope??''};
  }
  return p;
}
export function parseProject(raw: string): Project {
  ensure(new TextEncoder().encode(raw).length <= FILE_LIMIT,'FILE_TOO_LARGE'); const v: unknown=JSON.parse(raw);
  const schema=(v as {schemaVersion?:unknown})?.schemaVersion;
  const project=schema===LEGACY_SCHEMA ? migrateLegacy(v) : schema===PREVIOUS_SCHEMA ? migrateV2(v) : v;
  assertProject(project); return convertIntentEdits(project); // Freshly parsed, not shared: no defensive copy needed.
}
