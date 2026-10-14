import { type Project } from './types.js';
import { ensure, parseProject, isLegacy, isPrevious } from './validation.js';
import { restore } from './domain.js';
export const STORAGE_KEY='agentflow.idea015.project.v1';
/** Untouched legacy values taken before a project.3 write replaces them. */
export const LEGACY_BACKUP_KEY='agentflow.idea015.project.v1.legacy-original';
export const V2_BACKUP_KEY='agentflow.idea015.project.v2.legacy-original';
export interface StorageLike { getItem(key:string):string|null; setItem(key:string,value:string):void }
/** Compact JSON: the same bytes are autosaved, downloaded as a recovery file and accepted by import. */
export function serializeProject(project:Project):string { return JSON.stringify(project); }
export function storageErrorCode(e:unknown):string {
  if(e instanceof Error && ['STORAGE_BLOCKED','STORAGE_DENIED','LEGACY_UNPRESERVED','STORAGE_CONFLICT','FILE_TOO_LARGE','LOCKS_UNAVAILABLE','TRASHED','ENTRY_MISSING'].includes(e.message)) return e.message;
  if(e instanceof Error && e.name==='ContextError') return 'INVALID_DATA';
  if(e && typeof e==='object' && 'name' in e && ['QuotaExceededError','NS_ERROR_DOM_QUOTA_REACHED'].includes(String(e.name))) return 'QUOTA';
  return 'WRITE_FAILED';
}
export class ProjectStore {
  private expected:string|null=null;
  private blocked:string|null=null;
  constructor(private storage:StorageLike,readonly key:string=STORAGE_KEY) {}
  private preserve(raw:string|null):void {
    if(raw===null)return;
    const key=isLegacy(raw)?LEGACY_BACKUP_KEY:isPrevious(raw)?V2_BACKUP_KEY:null;
    if(key!==null && this.storage.getItem(key)===null)this.storage.setItem(key,raw);
  }
  load():Project|null {
    try {
      this.expected=this.storage.getItem(this.key); if(this.expected === null) return null;
      const project=parseProject(this.expected);
      // Preserve exact v1/v2 bytes before the first v3 write. Failure never permits autosave.
      try {this.preserve(this.expected);}
      catch { this.blocked='LEGACY_UNPRESERVED'; return {...restore(project),notice:`${project.notice??''} 브라우저 안에 원본을 따로 보관하지 못해 자동 저장을 멈췄습니다. 복구 파일을 저장하세요.`}; }
      const restored=restore(project);
      return isLegacy(this.expected)||isPrevious(this.expected)?{...restored,notice:project.notice}:restored;
    }
    catch(e) { this.blocked='STORAGE_BLOCKED'; throw e; }
  }
  save(project:Project):void {
    ensure(this.blocked === null,this.blocked ?? undefined);
    // Write only bytes that a later load/import accepts: same size and validity checks as parseProject.
    const raw=serializeProject(project); parseProject(raw);
    // Do not overwrite another tab's work or corrupt data we could not read.
    ensure(this.storage.getItem(this.key)===this.expected,'STORAGE_CONFLICT');
    this.storage.setItem(this.key,raw); this.expected=raw;
  }
  /** Explicit recovery: preserve only the browser value being overwritten.
   * The selected recovery file already exists outside storage; do not duplicate it here. */
  replace(project:Project):void {
    const raw=serializeProject(project); parseProject(raw);
    try {this.preserve(this.storage.getItem(this.key));}
    catch {this.blocked='LEGACY_UNPRESERVED';ensure(false,'LEGACY_UNPRESERVED');}
    this.storage.setItem(this.key,raw); this.expected=raw; this.blocked=null;
  }
}
/** FLOW083 workspace: every saved project in ONE envelope key, written with one setItem inside a shared Web Lock.
 * Project payloads (and backup files) keep the existing format; the wrapper only adds entryId, active/trashed,
 * a lifecycle number (bumped by trash/restore) and a save sequence (bumped by each save) for stale-tab checks.
 * The pre-workspace key is migrated once and never written or removed. One setItem narrows partial writes;
 * the lock serialises this app's tabs. It is not a compare-and-swap against other writers. */
export const WORKSPACE_KEY='agentflow.idea015.workspace';
export const WORKSPACE_LOCK='agentflow.idea015.workspace';
export interface LockManagerLike { request(name:string,callback:()=>unknown):Promise<unknown> }
export interface WorkspaceEntry { entryId:string; state:'active'|'trashed'; lifecycle:number; seq:number; createdAt:string; trashedAt:string|null; origin:'legacy'|'new'|'import'; project:Project }
export interface Envelope { version:'agentflow.workspace.1'; migratedFromLegacy:boolean; entries:WorkspaceEntry[] }
/** What this tab last read and may write back. */
export interface EntryRef { entryId:string; lifecycle:number; seq:number }
const ENTRY_ID=/^E_[A-Za-z0-9-]{8,64}$/;
function parseEnvelope(raw:string,deep=true):Envelope {
  let value:Envelope;
  try {value=JSON.parse(raw) as Envelope;} catch {throw new Error('STORAGE_BLOCKED');}
  if(value?.version!=='agentflow.workspace.1'||typeof value.migratedFromLegacy!=='boolean'||!Array.isArray(value.entries))throw new Error('STORAGE_BLOCKED');
  const seen=new Set<string>();
  for(const e of value.entries) {
    if(typeof e?.entryId!=='string'||!ENTRY_ID.test(e.entryId)||seen.has(e.entryId)||!['active','trashed'].includes(e.state)||!['legacy','new','import'].includes(e.origin)
      ||!Number.isSafeInteger(e.lifecycle)||e.lifecycle<1||!Number.isSafeInteger(e.seq)||e.seq<1||typeof e.createdAt!=='string'||(e.trashedAt!==null&&typeof e.trashedAt!=='string'))throw new Error('STORAGE_BLOCKED');
    seen.add(e.entryId);
    // Writes re-check structure only; untouched payloads are written back as read, never repaired.
    if(deep)try {e.project=parseProject(serializeProject(e.project));} catch {throw new Error('STORAGE_BLOCKED');}
    else if(!e.project||typeof e.project!=='object')throw new Error('STORAGE_BLOCKED');
  }
  return value;
}
export class WorkspaceStore {
  /** Last envelope read; null = none stored yet (or unreadable: see readError). */
  envelope:Envelope|null=null;
  /** The stored envelope exists but cannot be read: it is never overwritten. */
  readError:string|null=null;
  /** The pre-workspace project while it is not (or could not be) migrated. Read-only. */
  legacy:{project:Project|null;error:string|null}|null=null;
  constructor(private storage:StorageLike,private locks:LockManagerLike|null,private newId:()=>string=()=>`E_${crypto.randomUUID()}`) {}
  get writable():boolean {return !!this.locks&&this.readError===null;}
  private now(){return new Date().toISOString();}
  private readLegacy() {
    const raw=this.storage.getItem(STORAGE_KEY);if(raw===null){this.legacy=null;return null;}
    try {const project=parseProject(raw);this.legacy={project,error:null};return {raw,project};}
    catch {this.legacy={project:null,error:'STORAGE_BLOCKED'};return null;}
  }
  /** Fresh read, no writes. The old key is only shown separately while no envelope recorded its migration. */
  read():Envelope|null {
    this.readError=null;this.envelope=null;
    try {
      const raw=this.storage.getItem(WORKSPACE_KEY);
      if(raw!==null){try{this.envelope=parseEnvelope(raw);}catch(e){this.readError=(e as Error).message;}}
      if(raw===null||this.readError!==null||!this.envelope?.migratedFromLegacy)this.readLegacy();else this.legacy=null;
    } catch {
      // Access refused (privacy setting, SecurityError): unknown is not empty, and readError keeps every write off.
      this.readError='STORAGE_DENIED';this.envelope=null;this.legacy=null;
    }
    return this.envelope;
  }
  private async locked<T>(change:(env:Envelope|null)=>{next:Envelope|null;result:T}):Promise<T> {
    if(!this.locks)throw new Error('LOCKS_UNAVAILABLE');
    if(this.readError)throw new Error(this.readError);
    return await this.locks.request(WORKSPACE_LOCK,()=>{
      const raw=this.storage.getItem(WORKSPACE_KEY),current=raw===null?null:parseEnvelope(raw,false);
      const {next,result}=change(current);
      if(next){this.storage.setItem(WORKSPACE_KEY,JSON.stringify(next));this.envelope=next;}
      return result;
    }) as T;
  }
  /** Read, and migrate the old key once when no envelope exists. The old key itself is never written. */
  async init():Promise<void> {
    this.read();
    if(this.envelope||this.readError||!this.legacy?.project||!this.locks)return;
    let failure:string|null=null;
    try {
      await this.locked(env=>{
        if(env)return {next:null,result:null}; // another tab migrated first
        const legacy=this.readLegacy();if(!legacy)return {next:null,result:null};
        // Same original-bytes guarantee as before for v1/v2 values, though the old key is no longer overwritten.
        const backup=isLegacy(legacy.raw)?LEGACY_BACKUP_KEY:isPrevious(legacy.raw)?V2_BACKUP_KEY:null;
        if(backup!==null&&this.storage.getItem(backup)===null){try{this.storage.setItem(backup,legacy.raw);}catch{throw new Error('LEGACY_UNPRESERVED');}}
        return {next:{version:'agentflow.workspace.1',migratedFromLegacy:true,entries:[{entryId:this.newId(),state:'active',lifecycle:1,seq:1,createdAt:this.now(),trashedAt:null,origin:'legacy',project:legacy.project}]},result:null};
      });
    } catch(e) {failure=storageErrorCode(e)==='INVALID_DATA'?'STORAGE_BLOCKED':storageErrorCode(e);}
    this.read();
    if(failure&&this.legacy)this.legacy.error=failure; // stays readable, explained, and never written
  }
  entries():WorkspaceEntry[] {return this.envelope?.entries??[];}
  /** Adds a project (new or an imported copy, payload unchanged). Completes only once the envelope is written. */
  async create(project:Project,origin:'new'|'import'):Promise<EntryRef> {
    const raw=serializeProject(project);parseProject(raw);
    return await this.locked(env=>{
      const base:Envelope=env??{version:'agentflow.workspace.1',migratedFromLegacy:false,entries:[]};
      const entry:WorkspaceEntry={entryId:this.newId(),state:'active',lifecycle:1,seq:1,createdAt:this.now(),trashedAt:null,origin,project:JSON.parse(raw) as Project};
      return {next:{...base,entries:[...base.entries,entry]},result:{entryId:entry.entryId,lifecycle:1,seq:1}};
    });
  }
  /** Autosave: only an existing, active entry in the lifecycle this tab opened, unchanged by any other tab. */
  async save(ref:EntryRef,project:Project):Promise<EntryRef> {
    const raw=serializeProject(project);parseProject(raw);
    return await this.locked(env=>{
      const entry=env?.entries.find(e=>e.entryId===ref.entryId);
      if(!env||!entry)throw new Error('ENTRY_MISSING');
      if(entry.state!=='active'||entry.lifecycle!==ref.lifecycle)throw new Error('TRASHED');
      if(entry.seq!==ref.seq)throw new Error('STORAGE_CONFLICT');
      const next:WorkspaceEntry={...entry,seq:entry.seq+1,project:JSON.parse(raw) as Project};
      return {next:{...env,entries:env.entries.map(e=>e.entryId===entry.entryId?next:e)},result:{entryId:entry.entryId,lifecycle:entry.lifecycle,seq:next.seq}};
    });
  }
  private async setState(entryId:string,state:'active'|'trashed'):Promise<void> {
    await this.locked(env=>{
      const entry=env?.entries.find(e=>e.entryId===entryId);if(!env||!entry)throw new Error('ENTRY_MISSING');
      if(entry.state===state)return {next:null,result:null};
      const next:WorkspaceEntry={...entry,state,lifecycle:entry.lifecycle+1,trashedAt:state==='trashed'?this.now():null};
      return {next:{...env,entries:env.entries.map(e=>e.entryId===entryId?next:e)},result:null};
    });
  }
  /** Trash/restore change the wrapper only (Project.revision untouched) and invalidate older tabs' saves. */
  trash(entryId:string){return this.setState(entryId,'trashed');}
  restoreEntry(entryId:string){return this.setState(entryId,'active');}
}
