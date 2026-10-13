import { ensure, parseProject, isLegacy, isPrevious } from './validation.js';
import { restore } from './domain.js';
export const STORAGE_KEY = 'agentflow.idea015.project.v1';
/** Untouched legacy values taken before a project.3 write replaces them. */
export const LEGACY_BACKUP_KEY = 'agentflow.idea015.project.v1.legacy-original';
export const V2_BACKUP_KEY = 'agentflow.idea015.project.v2.legacy-original';
/** Compact JSON: the same bytes are autosaved, downloaded as a recovery file and accepted by import. */
export function serializeProject(project) { return JSON.stringify(project); }
export function storageErrorCode(e) {
    if (e instanceof Error && ['STORAGE_BLOCKED', 'LEGACY_UNPRESERVED', 'STORAGE_CONFLICT', 'FILE_TOO_LARGE'].includes(e.message))
        return e.message;
    if (e instanceof Error && e.name === 'ContextError')
        return 'INVALID_DATA';
    if (e && typeof e === 'object' && 'name' in e && ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(String(e.name)))
        return 'QUOTA';
    return 'WRITE_FAILED';
}
export class ProjectStore {
    storage;
    expected = null;
    blocked = null;
    constructor(storage) {
        this.storage = storage;
    }
    preserve(raw) {
        if (raw === null)
            return;
        const key = isLegacy(raw) ? LEGACY_BACKUP_KEY : isPrevious(raw) ? V2_BACKUP_KEY : null;
        if (key !== null && this.storage.getItem(key) === null)
            this.storage.setItem(key, raw);
    }
    load() {
        try {
            this.expected = this.storage.getItem(STORAGE_KEY);
            if (this.expected === null)
                return null;
            const project = parseProject(this.expected);
            // Preserve exact v1/v2 bytes before the first v3 write. Failure never permits autosave.
            try {
                this.preserve(this.expected);
            }
            catch {
                this.blocked = 'LEGACY_UNPRESERVED';
                return { ...restore(project), notice: `${project.notice ?? ''} 브라우저 안에 원본을 따로 보관하지 못해 자동 저장을 멈췄습니다. 복구 파일을 저장하세요.` };
            }
            const restored = restore(project);
            return isLegacy(this.expected) || isPrevious(this.expected) ? { ...restored, notice: project.notice } : restored;
        }
        catch (e) {
            this.blocked = 'STORAGE_BLOCKED';
            throw e;
        }
    }
    save(project) {
        ensure(this.blocked === null, this.blocked ?? undefined);
        // Write only bytes that a later load/import accepts: same size and validity checks as parseProject.
        const raw = serializeProject(project);
        parseProject(raw);
        // Do not overwrite another tab's work or corrupt data we could not read.
        ensure(this.storage.getItem(STORAGE_KEY) === this.expected, 'STORAGE_CONFLICT');
        this.storage.setItem(STORAGE_KEY, raw);
        this.expected = raw;
    }
    /** Explicit recovery: preserve only the browser value being overwritten.
     * The selected recovery file already exists outside storage; do not duplicate it here. */
    replace(project) {
        const raw = serializeProject(project);
        parseProject(raw);
        try {
            this.preserve(this.storage.getItem(STORAGE_KEY));
        }
        catch {
            this.blocked = 'LEGACY_UNPRESERVED';
            ensure(false, 'LEGACY_UNPRESERVED');
        }
        this.storage.setItem(STORAGE_KEY, raw);
        this.expected = raw;
        this.blocked = null;
    }
}
