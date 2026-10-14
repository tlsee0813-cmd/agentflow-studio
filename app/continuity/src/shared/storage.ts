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
  if(e instanceof Error && ['STORAGE_BLOCKED','LEGACY_UNPRESERVED','STORAGE_CONFLICT','FILE_TOO_LARGE'].includes(e.message)) return e.message;
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
/** Which saved projects exist and whether each is in the trash. Project payloads stay byte-for-byte in their own keys.
 * The single pre-workspace key is listed in place as slot 'legacy': never moved, copied or removed here.
 * Every index write re-reads the stored index first, so a stale tab cannot restore what another tab trashed. */
export const WORKSPACE_KEY='agentflow.idea015.workspace.v1';
export interface WorkspaceSlot { slot:string; state:'active'|'trashed'; createdAt:string; trashedAt:string|null }
interface WorkspaceIndex { version:'agentflow.workspace.1'; slots:WorkspaceSlot[] }
export const slotKey=(slot:string):string=>slot==='legacy'?STORAGE_KEY:`${STORAGE_KEY}:${slot}`;
function parseIndex(raw:string|null):WorkspaceIndex {
  if(raw===null)return {version:'agentflow.workspace.1',slots:[]};
  const value=JSON.parse(raw) as WorkspaceIndex;
  ensure(value?.version==='agentflow.workspace.1'&&Array.isArray(value.slots),'INVALID_INDEX');
  const seen=new Set<string>();
  for(const s of value.slots){
    ensure(typeof s?.slot==='string'&&/^(legacy|W_[A-Za-z0-9-]{8,64})$/.test(s.slot)&&!seen.has(s.slot),'INVALID_INDEX');seen.add(s.slot);
    ensure(['active','trashed'].includes(s.state)&&typeof s.createdAt==='string'&&(s.trashedAt===null||typeof s.trashedAt==='string'),'INVALID_INDEX');
  }
  return value;
}
export class WorkspaceStore {
  private index:WorkspaceIndex={version:'agentflow.workspace.1',slots:[]};
  /** Set when the stored index is unreadable: it is never overwritten; the original key stays reachable. */
  blocked=false;
  constructor(private storage:StorageLike,private newId:()=>string=()=>`W_${crypto.randomUUID()}`) {}
  private now(){return new Date().toISOString();}
  load():WorkspaceSlot[] {
    try {this.index=parseIndex(this.storage.getItem(WORKSPACE_KEY));this.blocked=false;}
    catch {this.blocked=true;this.index={version:'agentflow.workspace.1',slots:[]};}
    if(!this.index.slots.some(s=>s.slot==='legacy')&&this.storage.getItem(STORAGE_KEY)!==null) {
      // Registered by key identity, so a second tab or a later load never lists it twice.
      try {this.mutate(index=>{if(!index.slots.some(s=>s.slot==='legacy'))index.slots.unshift({slot:'legacy',state:'active',createdAt:this.now(),trashedAt:null});});}
      catch {this.index.slots.unshift({slot:'legacy',state:'active',createdAt:this.now(),trashedAt:null});}
    }
    return this.slots();
  }
  slots():WorkspaceSlot[] {return this.index.slots.map(s=>({...s}));}
  private mutate(change:(index:WorkspaceIndex)=>void):void {
    ensure(!this.blocked,'STORAGE_BLOCKED');
    const fresh=parseIndex(this.storage.getItem(WORKSPACE_KEY));change(fresh);
    this.storage.setItem(WORKSPACE_KEY,JSON.stringify(fresh));this.index=fresh;
  }
  /** A fresh read: an older tab must not keep saving a project that another tab moved to the trash.
   * 'unlisted' = payload written but its listing failed earlier; the caller lists it again instead of copying it. */
  stateOf(slot:string):'active'|'trashed'|'unlisted' {
    const entry=parseIndex(this.storage.getItem(WORKSPACE_KEY)).slots.find(s=>s.slot===slot);
    return entry?entry.state:'unlisted';
  }
  /** The first project ever keeps the original key; every later one gets its own key. */
  newSlot():string {return !this.index.slots.some(s=>s.slot==='legacy')&&this.storage.getItem(STORAGE_KEY)===null?'legacy':this.newId();}
  /** Lists a slot whose payload is already written. Idempotent by slot identity. */
  register(slot:string):void {this.mutate(index=>{if(!index.slots.some(s=>s.slot===slot))index.slots.push({slot,state:'active',createdAt:this.now(),trashedAt:null});});}
  trash(slot:string):void {this.mutate(index=>{const e=index.slots.find(s=>s.slot===slot);ensure(e,'SLOT_MISSING');e.state='trashed';e.trashedAt=this.now();});}
  restoreSlot(slot:string):void {this.mutate(index=>{const e=index.slots.find(s=>s.slot===slot);ensure(e,'SLOT_MISSING');e.state='active';e.trashedAt=null;});}
  /** Read-only view for the project list. Unreadable payloads are reported, never repaired or rewritten. */
  peek(slot:string):Project|'unreadable'|null {
    const raw=this.storage.getItem(slotKey(slot));if(raw===null)return null;
    try {return parseProject(raw);} catch {return 'unreadable';}
  }
}
