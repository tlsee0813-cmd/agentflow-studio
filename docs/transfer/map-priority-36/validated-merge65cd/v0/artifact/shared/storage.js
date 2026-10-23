import { ensure, parseProject, isLegacy, isPrevious } from './validation.js';
import { restore } from './domain.js';
export const STORAGE_KEY = 'agentflow.idea015.project.v1';
/** Untouched legacy values taken before a project.3 write replaces them. */
export const LEGACY_BACKUP_KEY = 'agentflow.idea015.project.v1.legacy-original';
export const V2_BACKUP_KEY = 'agentflow.idea015.project.v2.legacy-original';
/** Compact JSON: the same bytes are autosaved, downloaded as a recovery file and accepted by import. */
export function serializeProject(project) { return JSON.stringify(project); }
export function storageErrorCode(e) {
    if (e instanceof Error && ['STORAGE_BLOCKED', 'STORAGE_DENIED', 'LEGACY_UNPRESERVED', 'STORAGE_CONFLICT', 'FILE_TOO_LARGE', 'LOCKS_UNAVAILABLE', 'TRASHED', 'ENTRY_MISSING'].includes(e.message))
        return e.message;
    if (e instanceof Error && e.name === 'ContextError')
        return 'INVALID_DATA';
    if (e && typeof e === 'object' && 'name' in e && ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(String(e.name)))
        return 'QUOTA';
    return 'WRITE_FAILED';
}
export class ProjectStore {
    storage;
    key;
    expected = null;
    blocked = null;
    constructor(storage, key = STORAGE_KEY) {
        this.storage = storage;
        this.key = key;
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
            this.expected = this.storage.getItem(this.key);
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
        ensure(this.storage.getItem(this.key) === this.expected, 'STORAGE_CONFLICT');
        this.storage.setItem(this.key, raw);
        this.expected = raw;
    }
    /** Explicit recovery: preserve only the browser value being overwritten.
     * The selected recovery file already exists outside storage; do not duplicate it here. */
    replace(project) {
        const raw = serializeProject(project);
        parseProject(raw);
        try {
            this.preserve(this.storage.getItem(this.key));
        }
        catch {
            this.blocked = 'LEGACY_UNPRESERVED';
            ensure(false, 'LEGACY_UNPRESERVED');
        }
        this.storage.setItem(this.key, raw);
        this.expected = raw;
        this.blocked = null;
    }
}
/** FLOW083 workspace: every saved project in ONE envelope key, written with one setItem inside a shared Web Lock.
 * Project payloads (and backup files) keep the existing format; the wrapper only adds entryId, active/trashed,
 * a lifecycle number (bumped by trash/restore) and a save sequence (bumped by each save) for stale-tab checks.
 * The pre-workspace key is migrated once and never written or removed. One setItem narrows partial writes;
 * the lock serialises this app's tabs. It is not a compare-and-swap against other writers. */
export const WORKSPACE_KEY = 'agentflow.idea015.workspace';
export const WORKSPACE_LOCK = 'agentflow.idea015.workspace';
const ENTRY_ID = /^E_[A-Za-z0-9-]{8,64}$/;
function parseEnvelope(raw, deep = true) {
    let value;
    try {
        value = JSON.parse(raw);
    }
    catch {
        throw new Error('STORAGE_BLOCKED');
    }
    if (value?.version !== 'agentflow.workspace.1' || typeof value.migratedFromLegacy !== 'boolean' || !Array.isArray(value.entries))
        throw new Error('STORAGE_BLOCKED');
    const seen = new Set();
    for (const e of value.entries) {
        if (typeof e?.entryId !== 'string' || !ENTRY_ID.test(e.entryId) || seen.has(e.entryId) || !['active', 'trashed'].includes(e.state) || !['legacy', 'new', 'import'].includes(e.origin)
            || !Number.isSafeInteger(e.lifecycle) || e.lifecycle < 1 || !Number.isSafeInteger(e.seq) || e.seq < 1 || typeof e.createdAt !== 'string' || (e.trashedAt !== null && typeof e.trashedAt !== 'string'))
            throw new Error('STORAGE_BLOCKED');
        seen.add(e.entryId);
        // Writes re-check structure only; untouched payloads are written back as read, never repaired.
        if (deep)
            try {
                e.project = parseProject(serializeProject(e.project));
            }
            catch {
                throw new Error('STORAGE_BLOCKED');
            }
        else if (!e.project || typeof e.project !== 'object')
            throw new Error('STORAGE_BLOCKED');
    }
    return value;
}
export class WorkspaceStore {
    storage;
    locks;
    newId;
    /** Last envelope read; null = none stored yet (or unreadable: see readError). */
    envelope = null;
    /** The stored envelope exists but cannot be read: it is never overwritten. */
    readError = null;
    /** The pre-workspace project while it is not (or could not be) migrated. Read-only. */
    legacy = null;
    constructor(storage, locks, newId = () => `E_${crypto.randomUUID()}`) {
        this.storage = storage;
        this.locks = locks;
        this.newId = newId;
    }
    get writable() { return !!this.locks && this.readError === null; }
    now() { return new Date().toISOString(); }
    readLegacy() {
        const raw = this.storage.getItem(STORAGE_KEY);
        if (raw === null) {
            this.legacy = null;
            return null;
        }
        try {
            const project = parseProject(raw);
            this.legacy = { project, error: null };
            return { raw, project };
        }
        catch {
            this.legacy = { project: null, error: 'STORAGE_BLOCKED' };
            return null;
        }
    }
    /** Fresh read, no writes. The old key is only shown separately while no envelope recorded its migration. */
    read() {
        this.readError = null;
        this.envelope = null;
        try {
            const raw = this.storage.getItem(WORKSPACE_KEY);
            if (raw !== null) {
                try {
                    this.envelope = parseEnvelope(raw);
                }
                catch (e) {
                    this.readError = e.message;
                }
            }
            if (raw === null || this.readError !== null || !this.envelope?.migratedFromLegacy)
                this.readLegacy();
            else
                this.legacy = null;
        }
        catch {
            // Access refused (privacy setting, SecurityError): unknown is not empty, and readError keeps every write off.
            this.readError = 'STORAGE_DENIED';
            this.envelope = null;
            this.legacy = null;
        }
        return this.envelope;
    }
    async locked(change) {
        if (!this.locks)
            throw new Error('LOCKS_UNAVAILABLE');
        if (this.readError)
            throw new Error(this.readError);
        return await this.locks.request(WORKSPACE_LOCK, () => {
            const raw = this.storage.getItem(WORKSPACE_KEY), current = raw === null ? null : parseEnvelope(raw, false);
            const { next, result } = change(current);
            if (next) {
                this.storage.setItem(WORKSPACE_KEY, JSON.stringify(next));
                this.envelope = next;
            }
            return result;
        });
    }
    /** Read, and migrate the old key once when no envelope exists. The old key itself is never written. */
    async init() {
        this.read();
        if (this.envelope || this.readError || !this.legacy?.project || !this.locks)
            return;
        let failure = null;
        try {
            await this.locked(env => {
                if (env)
                    return { next: null, result: null }; // another tab migrated first
                const legacy = this.readLegacy();
                if (!legacy)
                    return { next: null, result: null };
                // Same original-bytes guarantee as before for v1/v2 values, though the old key is no longer overwritten.
                const backup = isLegacy(legacy.raw) ? LEGACY_BACKUP_KEY : isPrevious(legacy.raw) ? V2_BACKUP_KEY : null;
                if (backup !== null && this.storage.getItem(backup) === null) {
                    try {
                        this.storage.setItem(backup, legacy.raw);
                    }
                    catch {
                        throw new Error('LEGACY_UNPRESERVED');
                    }
                }
                return { next: { version: 'agentflow.workspace.1', migratedFromLegacy: true, entries: [{ entryId: this.newId(), state: 'active', lifecycle: 1, seq: 1, createdAt: this.now(), trashedAt: null, origin: 'legacy', project: legacy.project }] }, result: null };
            });
        }
        catch (e) {
            failure = storageErrorCode(e) === 'INVALID_DATA' ? 'STORAGE_BLOCKED' : storageErrorCode(e);
        }
        this.read();
        if (failure && this.legacy)
            this.legacy.error = failure; // stays readable, explained, and never written
    }
    entries() { return this.envelope?.entries ?? []; }
    /** Adds a project (new or an imported copy, payload unchanged). Completes only once the envelope is written. */
    async create(project, origin) {
        const raw = serializeProject(project);
        parseProject(raw);
        return await this.locked(env => {
            const base = env ?? { version: 'agentflow.workspace.1', migratedFromLegacy: false, entries: [] };
            const entry = { entryId: this.newId(), state: 'active', lifecycle: 1, seq: 1, createdAt: this.now(), trashedAt: null, origin, project: JSON.parse(raw) };
            return { next: { ...base, entries: [...base.entries, entry] }, result: { entryId: entry.entryId, lifecycle: 1, seq: 1 } };
        });
    }
    /** Autosave: only an existing, active entry in the lifecycle this tab opened, unchanged by any other tab. */
    async save(ref, project) {
        const raw = serializeProject(project);
        parseProject(raw);
        return await this.locked(env => {
            const entry = env?.entries.find(e => e.entryId === ref.entryId);
            if (!env || !entry)
                throw new Error('ENTRY_MISSING');
            if (entry.state !== 'active' || entry.lifecycle !== ref.lifecycle)
                throw new Error('TRASHED');
            if (entry.seq !== ref.seq)
                throw new Error('STORAGE_CONFLICT');
            const next = { ...entry, seq: entry.seq + 1, project: JSON.parse(raw) };
            return { next: { ...env, entries: env.entries.map(e => e.entryId === entry.entryId ? next : e) }, result: { entryId: entry.entryId, lifecycle: entry.lifecycle, seq: next.seq } };
        });
    }
    async setState(entryId, state) {
        await this.locked(env => {
            const entry = env?.entries.find(e => e.entryId === entryId);
            if (!env || !entry)
                throw new Error('ENTRY_MISSING');
            if (entry.state === state)
                return { next: null, result: null };
            const next = { ...entry, state, lifecycle: entry.lifecycle + 1, trashedAt: state === 'trashed' ? this.now() : null };
            return { next: { ...env, entries: env.entries.map(e => e.entryId === entryId ? next : e) }, result: null };
        });
    }
    /** Trash/restore change the wrapper only (Project.revision untouched) and invalidate older tabs' saves. */
    trash(entryId) { return this.setState(entryId, 'trashed'); }
    restoreEntry(entryId) { return this.setState(entryId, 'active'); }
}
