import { API_SCHEMA, SCHEMA, LEGACY_SCHEMA, TEXT_LIMIT, FILE_LIMIT, ITEM_LIMIT, type Advice, type Basis, type ContextRequest, type Envelope, type Project, type Source, type Ticket } from './types.js';
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
export function validateAdvice(v: unknown, basisIds: string[]): Advice {
  obj(v,['understanding','scope','next','checks','question','relatedBasisIds','reviewBasisIds','suggestions']);
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
  return {mode: v.mode as Envelope['mode'], ticket: {...v.ticket}, advice: validateAdvice(v.advice,req.bases.map(b=>b.id))};
}
function contextBasis(v: unknown) {
  obj(v,['id','text','status','sourceId','revision','previousVersions','partial']); id(v.id); text(v.text); id(v.sourceId); integer(v.revision); integer(v.previousVersions);
  ensure(STATUSES.includes(v.status as string)); ensure(typeof v.partial === 'boolean');
}
export function validateRequest(v: unknown): ContextRequest {
  obj(v,['schemaVersion','ticket','projectName','sources','bases','previousWork']); ensure(v.schemaVersion === API_SCHEMA); ticket(v.ticket); text(v.projectName,120);
  list(v.sources); list(v.bases); for (const s of v.sources) source(s); for (const b of v.bases) contextBasis(b);
  ensure(v.sources.length > 0); unique(v.sources as Source[]); unique(v.bases as {id:string}[]);
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
  const sources = new Map((v.sources as Source[]).map(s=>[s.id,s])); const bids = [...basisIds];
  const tasks=new Set<string>();
  for (const t of v.tasks) {
    obj(t,['id','sourceIds','parentTaskId','advice','adviceRevision','mode','manual','suggestions','handoffs']); id(t.id); list(t.sourceIds); ensure(t.sourceIds.length > 0);
    for (const s of t.sourceIds) ensure(sources.has(s as string)); ensure(new Set(t.sourceIds).size === t.sourceIds.length);
    if(t.parentTaskId !== null) ensure(tasks.has(t.parentTaskId as string)); // Ordered, acyclic.
    if(t.advice !== null) validateAdvice(t.advice,bids); ensure([null,'mock','deepseek'].includes(t.mode as null|string));
    // null with advice = imported from project.1, when the basis revision behind the advice was not recorded.
    if(t.adviceRevision !== null) { ensure(t.advice !== null); integer(t.adviceRevision); ensure((t.adviceRevision as number) <= (v.revision as number)); }
    obj(t.manual,['understanding','scope','next','checks']); for(const k of Object.keys(t.manual)) if(t.manual[k] !== null) text(t.manual[k],6000,true);
    if(t.suggestions !== null) { list(t.suggestions,8); for(const s of t.suggestions) {obj(s,['text','why']);text(s.text,2000,true);text(s.why,2000,true);} }
    list(t.handoffs); for(const h of t.handoffs) {
      obj(h,['at','method','revision','chars','digest','work','aiExcluded','legacyText']); date(h.at); ensure(['clipboard','download'].includes(h.method as string));
      integer(h.revision); ensure((h.revision as number) <= (v.revision as number)); integer(h.chars); ensure(typeof h.digest === 'string' && /^[0-9a-f]{8}$/.test(h.digest)); ensure(typeof h.aiExcluded === 'boolean');
      if(h.work !== null) { obj(h.work,['understanding','scope','next','checks']); for(const k of Object.keys(h.work)) text(h.work[k],6000,true); }
      if(h.legacyText !== null) text(h.legacyText,250000);
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
export const MIGRATION_NOTICE='이전 형식(project.1)에서 변환했습니다. 원래 저장 내용은 보관했고 기록은 지우지 않았습니다. 이전 AI 정리는 어느 기준 시점에 작성됐는지 알 수 없어 현재 작업문에서 제외합니다.';
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
  return {...v,schemaVersion:SCHEMA,bases,tasks,notice:MIGRATION_NOTICE};
}
export function isLegacy(raw: string): boolean { try { return (JSON.parse(raw) as {schemaVersion?:unknown})?.schemaVersion === LEGACY_SCHEMA; } catch { return false; } }
/** The single acceptance test for persisted bytes: autosave, recovery-file download and import all use it. */
export function parseProject(raw: string): Project {
  ensure(new TextEncoder().encode(raw).length <= FILE_LIMIT,'FILE_TOO_LARGE'); const v: unknown=JSON.parse(raw);
  const project=(v as {schemaVersion?:unknown})?.schemaVersion === LEGACY_SCHEMA ? migrateLegacy(v) : v;
  assertProject(project); return project; // Freshly parsed, not shared: no defensive copy needed.
}
