import { type Project } from './types.js';
import { ensure, parseProject, isLegacy, MIGRATION_NOTICE } from './validation.js';
import { restore } from './domain.js';
export const STORAGE_KEY='agentflow.idea015.project.v1';
/** Untouched copy of a project.1 value taken before the first project.2 write replaces it. */
export const LEGACY_BACKUP_KEY='agentflow.idea015.project.v1.legacy-original';
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
  constructor(private storage:StorageLike) {}
  load():Project|null {
    try {
      this.expected=this.storage.getItem(STORAGE_KEY); if(this.expected === null) return null;
      const project=parseProject(this.expected);
      if(!isLegacy(this.expected)) return restore(project);
      // Never let the first project.2 write replace the only copy of a project.1 value.
      try { if(this.storage.getItem(LEGACY_BACKUP_KEY) === null) this.storage.setItem(LEGACY_BACKUP_KEY,this.expected); }
      catch { this.blocked='LEGACY_UNPRESERVED'; return {...restore(project),notice:`${MIGRATION_NOTICE} 브라우저 안에 원본을 따로 보관하지 못해 자동 저장을 멈췄습니다. 복구 파일을 저장하세요.`}; }
      return {...restore(project),notice:MIGRATION_NOTICE};
    }
    catch(e) { this.blocked='STORAGE_BLOCKED'; throw e; }
  }
  save(project:Project):void {
    ensure(this.blocked === null,this.blocked ?? undefined);
    // Write only bytes that a later load/import accepts: same size and validity checks as parseProject.
    const raw=serializeProject(project); parseProject(raw);
    // Do not overwrite another tab's work or corrupt data we could not read.
    ensure(this.storage.getItem(STORAGE_KEY)===this.expected,'STORAGE_CONFLICT');
    this.storage.setItem(STORAGE_KEY,raw); this.expected=raw;
  }
  /** Called only after a user reviewed an import and explicitly chose replacement. */
  replace(project:Project):void {
    const raw=serializeProject(project); parseProject(raw);
    this.storage.setItem(STORAGE_KEY,raw); this.expected=raw; this.blocked=null;
  }
}
