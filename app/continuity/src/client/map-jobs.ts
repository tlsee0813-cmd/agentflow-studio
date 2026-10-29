/* AF100: the browser's side of durable map jobs. Before anything is sent, a reservation (operation id, retrieval capability and
 * what the job is bound to) is written under its own Web Lock in this address's storage, apart from projects and backups; an entry
 * that already has one reuses it, so a second click or another tab never makes a second job. The capability goes only in a
 * header. The job API itself is the local server's (/api/studio/jobs); nothing here retries as a new job. */
import { RUNTIME } from './runtime.js';
import { AskError } from './studio-api.js';
import type { StorageLike, LockManagerLike } from '../shared/storage.js';
import { validateBinding, JOB_ID, JOB_CAPABILITY, type MapJobBinding } from '../shared/map-job.js';

export const JOBS_KEY = 'agentflow.studio.map-jobs.1';
export const JOBS_LOCK = 'agentflow.studio.map-jobs';
export interface Reservation {
  id: string; cap: string; binding: MapJobBinding;
  /** The server said it accepted the job (a lost receipt leaves this false: the job is then looked up, never made anew). */
  receipt: boolean;
  /** The reading id saved to the project (its acknowledgement may still be owed). */
  applied: string | null;
  reservedAt: string;
}
export type JobState = 'accepted' | 'running' | 'ready' | 'failed' | 'cancelled' | 'interrupted';
export interface JobResult { model: string; prompt: string; askHash: string; wire: unknown; evidence: { index: string; ask: string }; reading: { id: string; at: string } }
export interface JobView { id: string; state: JobState; acked: 'applied' | 'discarded' | 'seen' | null; error: { code: string } | null; remote: string | null; input?: unknown; result?: JobResult }
/** answered: the server said so (a definite answer); otherwise the request may or may not have arrived. */
export class JobError extends AskError { constructor(code: string, readonly answered: boolean) { super(code); } }

const STATES: JobState[] = ['accepted', 'running', 'ready', 'failed', 'cancelled', 'interrupted'];
async function call(method: 'GET' | 'POST', path: string, cap: string, access: string, body?: string, signal?: AbortSignal): Promise<JobView> {
  if (RUNTIME.apiBase === null) throw new JobError('NO_SERVER', true);
  const headers: Record<string, string> = { 'X-AgentFlow-Request': '1', 'X-Studio-Operation': cap };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (access) headers['X-Studio-Access'] = access;
  let res: Response;
  try { res = await fetch(`${RUNTIME.apiBase ?? ''}/api/studio/jobs${path}`, { method, headers, ...(body !== undefined ? { body } : {}), credentials: 'same-origin', cache: 'no-store', ...(signal ? { signal } : {}) }); }
  catch { throw new JobError('NETWORK', false); }
  let data: { error?: { code?: unknown } } & Partial<JobView> | null = null;
  try { data = await res.json(); } catch { /* below */ }
  if (!res.ok) { const code = typeof data?.error?.code === 'string' ? data.error.code : null; throw new JobError(code ?? 'NETWORK', !!code && code !== 'INTERNAL_ERROR'); }
  if (!data || typeof data.id !== 'string' || !STATES.includes(data.state as JobState)) throw new JobError('NETWORK', false);
  return data as JobView;
}
export const jobApi = {
  submit: (payload: string, cap: string, access: string, signal?: AbortSignal) => call('POST', '', cap, access, payload, signal),
  get: (id: string, cap: string, access: string) => call('GET', `/${id}`, cap, access),
  cancel: (id: string, cap: string, access: string) => call('POST', `/${id}/cancel`, cap, access, '{}'),
  ack: (id: string, cap: string, access: string, outcome: 'applied' | 'discarded' | 'seen') => call('POST', `/${id}/ack`, cap, access, JSON.stringify({ outcome }))
};

const capability = () => { const b = crypto.getRandomValues(new Uint8Array(32)); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
function parse(raw: string | null): Reservation[] {
  if (raw === null) return [];
  const v = JSON.parse(raw) as { version?: unknown; ops?: unknown };
  if (v?.version !== 'map-jobs.1' || !Array.isArray(v.ops)) throw new Error('JOBS_UNREADABLE');
  return v.ops.map(o => {
    const r = o as Reservation;
    if (!r || typeof r.id !== 'string' || !JOB_ID.test(r.id) || typeof r.cap !== 'string' || !JOB_CAPABILITY.test(r.cap) || typeof r.receipt !== 'boolean' || (r.applied !== null && typeof r.applied !== 'string') || typeof r.reservedAt !== 'string') throw new Error('JOBS_UNREADABLE');
    validateBinding(r.binding); return r;
  });
}
/** Reservations of this address, written whole under one lock. Unreadable storage is never overwritten (JOBS_UNREADABLE). */
export class JobReservations {
  constructor(private kv: StorageLike, private locks: LockManagerLike | null) {}
  get usable(): boolean { return !!this.locks; }
  list(): Reservation[] { return parse(this.kv.getItem(JOBS_KEY)); }
  private async locked<T>(change: (ops: Reservation[]) => { next: Reservation[] | null; result: T }): Promise<T> {
    if (!this.locks) throw new Error('LOCKS_UNAVAILABLE');
    return await this.locks.request(JOBS_LOCK, () => {
      const { next, result } = change(this.list());
      if (next) this.kv.setItem(JOBS_KEY, JSON.stringify({ version: 'map-jobs.1', ops: next }));
      return result;
    }) as T;
  }
  /** The entry's reservation if it has one (reused), else a new one written before anything is sent. */
  reserve(binding: MapJobBinding): Promise<{ res: Reservation; reused: boolean }> {
    return this.locked<{ res: Reservation; reused: boolean }>(ops => {
      const had = ops.find(o => o.binding.entryId === binding.entryId);
      if (had) return { next: null, result: { res: had, reused: true } };
      const res: Reservation = { id: `MJ_${crypto.randomUUID()}`, cap: capability(), binding: { ...binding }, receipt: false, applied: null, reservedAt: new Date().toISOString() };
      return { next: [...ops, res], result: { res, reused: false } };
    });
  }
  update(id: string, patch: Partial<Pick<Reservation, 'receipt' | 'applied'>>): Promise<void> {
    return this.locked(ops => ops.some(o => o.id === id) ? { next: ops.map(o => o.id === id ? { ...o, ...patch } : o), result: undefined } : { next: null, result: undefined });
  }
  remove(id: string): Promise<void> {
    return this.locked(ops => ops.some(o => o.id === id) ? { next: ops.filter(o => o.id !== id), result: undefined } : { next: null, result: undefined });
  }
}
