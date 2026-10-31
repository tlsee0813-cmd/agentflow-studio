/* AF100: the browser's side of durable map jobs. Before anything is sent, a reservation (operation id, retrieval capability and
 * what the job is bound to) is written under its own Web Lock in this address's storage, apart from projects and backups; an entry
 * that already has one reuses it, so a second click or another tab never makes a second job. The capability goes only in a
 * header. The job API itself is the local server's (/api/studio/jobs); nothing here retries as a new job. */
import { RUNTIME } from './runtime.js';
import { AskError } from './studio-api.js';
import { validateBinding, jobHash, JOB_ID, JOB_CAPABILITY } from '../shared/map-job.js';
export const JOBS_KEY = 'agentflow.studio.map-jobs.1';
export const JOBS_LOCK = 'agentflow.studio.map-jobs';
const BINDING_KEYS = ['entryId', 'projectId', 'lifecycle', 'seq', 'after', 'schemaVersion', 'prompt', 'model', 'askHash', 'inputHash'];
/** The server's answer is about this very job: its id, and the binding it keeps (whole, and by the hash it was accepted under).
 * A pre-acceptance cancel has no binding: only that end is accepted without one. */
export async function sameJob(v, r) {
    if (v.id !== r.id)
        return false;
    if (v.bindingHash === null)
        return v.binding === null && v.state === 'cancelled' && v.remote === 'not-sent';
    if (v.bindingHash !== await jobHash(r.binding))
        return false;
    return v.binding === null || BINDING_KEYS.every(k => v.binding[k] === r.binding[k]);
}
/** answered: the server said so (a definite answer); otherwise the request may or may not have arrived. */
export class JobError extends AskError {
    answered;
    constructor(code, answered) {
        super(code);
        this.answered = answered;
    }
}
const STATES = ['accepted', 'running', 'ready', 'failed', 'cancelled', 'interrupted'];
async function call(method, path, cap, access, body, signal) {
    if (RUNTIME.apiBase === null)
        throw new JobError('NO_SERVER', true);
    const headers = { 'X-AgentFlow-Request': '1', 'X-Studio-Operation': cap };
    if (body !== undefined)
        headers['Content-Type'] = 'application/json';
    if (access)
        headers['X-Studio-Access'] = access;
    let res;
    try {
        res = await fetch(`${RUNTIME.apiBase ?? ''}/api/studio/jobs${path}`, { method, headers, ...(body !== undefined ? { body } : {}), credentials: 'same-origin', cache: 'no-store', ...(signal ? { signal } : {}) });
    }
    catch {
        throw new JobError('NETWORK', false);
    }
    let data = null;
    try {
        data = await res.json();
    }
    catch { /* below */ }
    if (!res.ok) {
        const code = typeof data?.error?.code === 'string' ? data.error.code : null;
        throw new JobError(code ?? 'NETWORK', !!code && code !== 'INTERNAL_ERROR');
    }
    if (!data || typeof data.id !== 'string' || !STATES.includes(data.state))
        throw new JobError('NETWORK', false);
    return data;
}
export const jobApi = {
    submit: (payload, cap, access, signal) => call('POST', '', cap, access, payload, signal),
    get: (id, cap, access) => call('GET', `/${id}`, cap, access),
    cancel: (id, cap, access) => call('POST', `/${id}/cancel`, cap, access, '{}'),
    ack: (id, cap, access, outcome) => call('POST', `/${id}/ack`, cap, access, JSON.stringify({ outcome }))
};
const capability = () => { const b = crypto.getRandomValues(new Uint8Array(32)); let s = ''; for (const x of b)
    s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
function parse(raw) {
    if (raw === null)
        return [];
    const v = JSON.parse(raw);
    if (v?.version !== 'map-jobs.1' || !Array.isArray(v.ops))
        throw new Error('JOBS_UNREADABLE');
    return v.ops.map(o => {
        const r = o;
        if (!r || typeof r.id !== 'string' || !JOB_ID.test(r.id) || typeof r.cap !== 'string' || !JOB_CAPABILITY.test(r.cap) || typeof r.receipt !== 'boolean' || (r.applied !== null && typeof r.applied !== 'string') || typeof r.reservedAt !== 'string'
            || ![undefined, null, 'discarded', 'seen'].includes(r.outcome))
            throw new Error('JOBS_UNREADABLE');
        validateBinding(r.binding);
        return r;
    });
}
/** Reservations of this address, written whole under one lock. Unreadable storage is never overwritten (JOBS_UNREADABLE). */
export class JobReservations {
    kv;
    locks;
    persistent;
    /** kv must be this address's persistent storage itself: a read or write that fails throws (never read as empty, never kept in
     * memory instead). persistent=false (no such storage in this page) makes it unusable, so nothing is sent. */
    constructor(kv, locks, persistent = true) {
        this.kv = kv;
        this.locks = locks;
        this.persistent = persistent;
    }
    get usable() { return !!this.locks && this.persistent; }
    list() { return parse(this.kv.getItem(JOBS_KEY)); }
    async locked(change) {
        if (!this.locks)
            throw new Error('LOCKS_UNAVAILABLE');
        return await this.locks.request(JOBS_LOCK, () => {
            const { next, result } = change(this.list());
            if (next)
                this.kv.setItem(JOBS_KEY, JSON.stringify({ version: 'map-jobs.1', ops: next }));
            return result;
        });
    }
    /** A new job id with this page's hold on it: taken before the reservation exists (nobody else knows the id yet) and kept while
     * this page is sending it. Another page tells an orphan (its page gone, a reload) from one still being sent by this lock. */
    newId() { return `MJ_${crypto.randomUUID()}`; }
    hold(id) {
        return new Promise((granted, fail) => {
            let release;
            const done = new Promise(r => { release = r; });
            if (!this.locks) {
                fail(new Error('LOCKS_UNAVAILABLE'));
                return;
            }
            this.locks.request(`${JOBS_LOCK}:${id}`, () => { granted(release); return done; }).catch(fail);
        });
    }
    /** fn runs only while no page holds the job (its sender is gone); otherwise nothing is done (undefined). */
    async orphan(id, fn) {
        if (!this.locks)
            return undefined;
        return await this.locks.request(`${JOBS_LOCK}:${id}`, { ifAvailable: true }, lock => lock ? fn() : undefined);
    }
    /** The entry's reservation if it has one (reused), else a new one under id, written before anything is sent. */
    reserve(binding, id = this.newId()) {
        return this.locked(ops => {
            // A reservation whose reading is saved, or that was let go, only owes its acknowledgement: it never holds the entry.
            const had = ops.find(o => o.binding.entryId === binding.entryId && !o.applied && !o.outcome);
            if (had)
                return { next: null, result: { res: had, reused: true } };
            const res = { id, cap: capability(), binding: { ...binding }, receipt: false, applied: null, outcome: null, reservedAt: new Date().toISOString() };
            return { next: [...ops, res], result: { res, reused: false } };
        });
    }
    update(id, patch) {
        return this.locked(ops => ops.some(o => o.id === id) ? { next: ops.map(o => o.id === id ? { ...o, ...patch } : o), result: undefined } : { next: null, result: undefined });
    }
    remove(id) {
        return this.locked(ops => ops.some(o => o.id === id) ? { next: ops.filter(o => o.id !== id), result: undefined } : { next: null, result: undefined });
    }
}
