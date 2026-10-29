// AF100: durable map reading jobs, owned by the local Node server only (never imported by studio.mjs or the Worker).
// One file per job under <dir>/ops, written atomically (temporary file, fsync, rename, directory fsync where the OS allows it),
// each with the SHA-256 of its body. One process owns a store at a time: an OS-held exclusive name (a named pipe on Windows, an
// abstract socket on Linux) that the OS releases when the process dies; elsewhere a pid lock file, which is weaker.
// On opening, every job not yet ended is recorded as interrupted before anything is accepted: nothing is sent again, since
// whether the provider still works on it is not known. A ready result is kept until the browser says it was applied or
// discarded; then (and for failed, cancelled and interrupted jobs once seen) the job shrinks to a tombstone that is never
// deleted, so the same id never becomes a new call. A file that cannot be read is damaged: left as it is and refused by id.
// The capability is never stored (only its SHA-256) and never logged; the key never comes here.
import { mkdir, open, readdir, readFile, rename, unlink, writeFile, realpath, stat, link } from 'node:fs/promises';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { ApiError } from '../../server/errors.mjs';
import { validateSubmit, jobHash, JOB_ID, JOB_CAPABILITY, MAP_JOB_VERSION } from '../dist/public/shared/map-job.js';

export const JOB_FORMAT = 'agentflow.map-job.1';
/** A ready file holds the input (≤ inputBytes as re-serialised, never more than it came) and the reply wire (the provider's reply is
 * read up to 128 KiB) with a small envelope, so fileBytes is what a finished job can take; an active job reserves that much and a
 * ready place before it is accepted, so finishing never goes past readyUnacked or materialBytes. */
export const JOB_LIMITS = Object.freeze({ readyUnacked: 50, materialBytes: 32 * 1024 * 1024, fileBytes: 640 * 1024, inputBytes: 448 * 1024, records: 10000, body: 512 * 1024 });
const ACTIVE = new Set(['accepted', 'running']);
const ENDED = new Set(['failed', 'cancelled', 'interrupted']);
const ACCEPT = Symbol('acceptance');
const sha = text => createHash('sha256').update(text).digest('hex');
const now = () => new Date().toISOString();

/** Atomic replace of one file; injectable so tests can make a write fail at a chosen step. */
export const fileIo = {
  async writeAtomic(dir, name, text) {
    const tmp = join(dir, `${name}.${randomUUID()}.tmp`), target = join(dir, name);
    const handle = await open(tmp, 'wx', 0o600);
    try { await handle.writeFile(text, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    try { await renameRetry(tmp, target); } catch (e) { await unlink(tmp).catch(() => {}); throw e; }
    await syncDir(dir);
  }
};
async function renameRetry(from, to) {
  // Windows refuses a rename while another program (an indexer, antivirus) holds the target for a moment.
  for (let i = 0; ; i++) { try { return await rename(from, to); } catch (e) { if (i >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(e?.code)) throw e; await new Promise(r => setTimeout(r, 20 * (i + 1))); } }
}
async function syncDir(dir) {
  if (process.platform === 'win32') return; // directories cannot be opened for fsync there; NTFS journals the rename itself
  const h = await open(dir, 'r'); try { await h.sync(); } catch (e) { if (!['EINVAL', 'EISDIR', 'EPERM'].includes(e?.code)) throw e; } finally { await h.close(); }
}

/** The store's own identity, created once (hard link of a complete file: never seen half written, and only one creator wins).
 * Ownership is named after it rather than after a path, so two paths to the same directory (a symlink, a junction, a bind mount,
 * another drive letter or letter case) and two servers on different ports given the same directory still meet at one name. */
async function storeId(dir) {
  const file = join(dir, 'store.json');
  for (let i = 0; i < 20; i++) {
    try { const v = JSON.parse(await readFile(file, 'utf8')); if (v?.format === 'agentflow.map-store.1' && /^[0-9a-f-]{36}$/.test(v.id)) return v.id; throw new Error('STORE_DAMAGED'); }
    catch (e) {
      if (e?.message === 'STORE_DAMAGED') throw e;
      if (e?.code !== 'ENOENT') { await new Promise(r => setTimeout(r, 25)); continue; }
      const tmp = join(dir, `store.${randomUUID()}.tmp`);
      await writeFile(tmp, JSON.stringify({ format: 'agentflow.map-store.1', id: randomUUID(), createdAt: now() }), { flag: 'wx', mode: 0o600 });
      try { await link(tmp, file); } catch (l) { if (l?.code !== 'EEXIST') { await unlink(tmp).catch(() => {}); throw l; } }
      await unlink(tmp).catch(() => {}); await syncDir(dir);
    }
  }
  throw new Error('STORE_DAMAGED');
}
/** Exclusive ownership of a store by this process, released by the OS when it ends. AF102: also the preview executor's state. */
export async function own(dir) {
  const name = `agentflow-map-jobs-${(await storeId(dir)).replace(/-/g, '')}`;
  const path = process.platform === 'win32' ? `\\\\.\\pipe\\${name}` : process.platform === 'linux' ? `\0${name}` : null;
  if (path) {
    const server = createServer(s => s.destroy());
    const ok = await new Promise(res => { server.once('error', e => res(e?.code === 'EADDRINUSE' ? false : e)); server.listen(path, () => res(true)); });
    if (ok !== true) { if (ok === false) return { busy: true }; throw ok; }
    server.unref();
    return { busy: false, release: () => new Promise(r => server.close(() => r())), kind: process.platform === 'win32' ? 'named-pipe' : 'abstract-socket' };
  }
  const lock = join(dir, 'owner.lock');
  for (let i = 0; i < 2; i++) {
    try { await writeFile(lock, JSON.stringify({ pid: process.pid, at: now() }), { flag: 'wx', mode: 0o600 }); return { busy: false, release: () => unlink(lock).catch(() => {}), kind: 'pid-lock' }; }
    catch (e) {
      if (e?.code !== 'EEXIST') throw e;
      let pid = null; try { pid = JSON.parse(await readFile(lock, 'utf8')).pid; } catch { /* unreadable lock: treated as held */ }
      let alive = true; if (Number.isSafeInteger(pid)) { try { process.kill(pid, 0); } catch (k) { alive = k?.code === 'EPERM'; } }
      if (alive || i) return { busy: true };
      await unlink(lock).catch(() => {});
    }
  }
  return { busy: true };
}

/**
 * Opens (or creates) the store at dir and returns the job service. When the store cannot be owned or written, the service says so
 * (describe().durable is false with a problem) and every job route answers JOB_STORE_UNAVAILABLE; nothing falls back to memory.
 */
export async function openMapJobs({ dir, io = fileIo, limits = JOB_LIMITS, log = () => {} } = {}) {
  let problem = null, owner = null, opsDir = null, closed = false;
  const jobs = new Map(); // id -> { body } | { damaged: true }
  try {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const real = await realpath(dir); opsDir = join(real, 'ops');
    await mkdir(opsDir, { recursive: true, mode: 0o700 });
    owner = await own(real);
    if (owner.busy) problem = 'STORE_BUSY';
    else {
      for (const f of await readdir(opsDir)) {
        if (f.endsWith('.tmp')) { await unlink(join(opsDir, f)).catch(() => {}); continue; } // never renamed: never accepted
        const m = /^(MJ_[0-9a-f-]{36})\.json$/.exec(f); if (!m || !JOB_ID.test(m[1])) continue;
        let body = null;
        try {
          const raw = await readFile(join(opsDir, f), 'utf8'), file = JSON.parse(raw);
          if (file?.format === JOB_FORMAT && typeof file.sha256 === 'string' && sha(JSON.stringify(file.body)) === file.sha256 && file.body?.id === m[1]) body = file.body;
        } catch { body = null; }
        jobs.set(m[1], body ? { body, size: 0 } : { damaged: true });
      }
      // Probe the store is writable before taking any job, then end what a previous process left running.
      await io.writeAtomic(opsDir, 'probe.check', now()); await unlink(join(opsDir, 'probe.check')).catch(() => {});
      for (const [id, j] of jobs) if (j.body && ACTIVE.has(j.body.state)) await write(id, { ...strip(j.body), state: 'interrupted', remote: 'unknown', updatedAt: now() });
      for (const [id, j] of jobs) if (j.body) j.size = await stat(join(opsDir, `${id}.json`)).then(s => s.size, () => 0);
    }
  } catch (e) { problem = problem ?? 'STORE_UNWRITABLE'; log(`map jobs: store not usable (${e?.code ?? 'error'})`); }

  async function write(id, body) {
    // After close no write of this process reaches the store (a later owner may already be writing it).
    if (closed) throw new ApiError('JOB_STORE_UNAVAILABLE', 503);
    const text = JSON.stringify({ format: JOB_FORMAT, body, sha256: sha(JSON.stringify(body)) });
    if (Buffer.byteLength(text) > limits.fileBytes) throw new ApiError('JOB_STORE_FULL', 507);
    await io.writeAtomic(opsDir, `${id}.json`, text);
    jobs.set(id, { body, size: Buffer.byteLength(text) });
  }
  // A job's material (the private input and the result) is dropped once it can no longer be applied.
  function strip(body) { const { input: _i, result: _r, ...rest } = body; return rest; }
  const tomb = (body, acked) => ({ id: body.id, capHash: body.capHash, bindingHash: body.bindingHash, state: body.state, error: body.error ?? null,
    remote: body.remote ?? null, ...(body.execution ? { execution: body.execution } : {}), createdAt: body.createdAt, updatedAt: now(), acked, tomb: true });

  const chains = new Map();
  /** Every change of one job runs alone, in order: submit, finish, cancel and ack never interleave. */
  function serial(id, fn) {
    const prev = chains.get(id) ?? Promise.resolve(), next = prev.then(fn, fn);
    chains.set(id, next.catch(() => {})); return next;
  }
  const running = new Map(); // id -> { controller, release, failed }: from acceptance until its call has ended
  const failedHere = new Map(); // id -> error: finished but not kept (the store refused); said until seen, interrupted after a restart
  const executing = new Set(); // the calls in progress, owned so close() can wait for them
  const pending = new Set(); // `${id}:${capHash}` being accepted now: a read with that same capability is told so, any other gets 'not found'

  function view(id, body, full = false) {
    const lost = body.state === 'accepted' ? failedHere.get(id) : null;
    const state = lost ? 'failed' : body.state === 'accepted' && running.has(id) ? 'running' : body.state;
    const out = { version: MAP_JOB_VERSION, id, state, acked: body.acked?.outcome ?? null, binding: body.binding ?? null, bindingHash: body.bindingHash ?? null, createdAt: body.createdAt, updatedAt: body.updatedAt,
      error: lost ?? body.error ?? null, remote: body.remote ?? null, ...(body.execution ? { execution: body.execution } : {}) };
    if (full && state === 'ready' && !body.acked && body.result && body.input) Object.assign(out, { input: body.input, result: body.result });
    return out;
  }
  const capHashOf = cap => { if (typeof cap !== 'string' || !JOB_CAPABILITY.test(cap)) throw new ApiError('OPERATION_NOT_FOUND', 404); return sha(cap); };
  const sameHash = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  function find(id, cap) {
    if (!JOB_ID.test(id)) throw new ApiError('OPERATION_NOT_FOUND', 404);
    const j = jobs.get(id); if (!j) return null;
    if (j.damaged) throw new ApiError('OPERATION_DAMAGED', 409);
    if (!sameHash(j.body.capHash, capHashOf(cap))) throw new ApiError('OPERATION_NOT_FOUND', 404);
    return j.body;
  }
  /** Room for one more job as it will be when it ends: every active job already holds a ready place and a whole file. */
  function capacity() {
    let material = 0, places = 0;
    for (const j of jobs.values()) if (j.body && !j.body.tomb) {
      if (j.body.state === 'accepted') { places++; material += limits.fileBytes; }
      else if (j.body.state === 'ready' && !j.body.acked) { places++; material += j.size; }
    }
    if (jobs.size >= limits.records || places >= limits.readyUnacked || material + limits.fileBytes > limits.materialBytes) throw new ApiError('JOB_STORE_FULL', 507);
  }

  async function submit(raw, cap, run) {
    if (raw === null) throw new ApiError('INPUT_TOO_LARGE', 413);
    let parsed; try { parsed = JSON.parse(raw); } catch { throw new ApiError('INVALID_INPUT', 400); }
    const id = typeof parsed?.id === 'string' && JOB_ID.test(parsed.id) ? parsed.id : null;
    if (!id) throw new ApiError('INVALID_INPUT', 400);
    const capHash = capHashOf(cap);
    const key = `${id}:${capHash}`; pending.add(key);
    try {
      return await serial(id, async () => {
        let checked; try { checked = await validateSubmit(parsed); } catch { throw new ApiError('INVALID_INPUT', 400); }
        const { submit: s } = checked, bindingHash = await jobHash(s.binding), j = jobs.get(id);
        if (j?.damaged) throw new ApiError('OPERATION_DAMAGED', 409);
        if (j) {
          // The same job asked again (its receipt was lost): its state, never a second call. A cancel that came first holds.
          // Another capability is told nothing about this id (as for a read); the same capability with another body is a conflict.
          if (!sameHash(j.body.capHash, capHash)) throw new ApiError('OPERATION_NOT_FOUND', 404);
          if (j.body.bindingHash === null && j.body.state === 'cancelled') return { status: 200, value: view(id, j.body) };
          if (j.body.bindingHash !== bindingHash) throw new ApiError('OPERATION_CONFLICT', 409);
          return { status: 200, value: view(id, j.body) };
        }
        if (Buffer.byteLength(JSON.stringify(s.input)) > limits.inputBytes) throw new ApiError('INPUT_TOO_LARGE', 413);
        const prompt = await run.prompt();
        if (!run.configured()) throw new ApiError('AI_NOT_CONFIGURED', 503);
        if (s.binding.prompt !== prompt || s.binding.model !== run.model) throw new ApiError('PROMPT_CHANGED', 409);
        // AF102: an injected executor fixes what it will run (its identity, binary, permissions and deadline policy) now; the job
        // keeps that, never the settings of a later read or restart. Without one (DeepSeek) the job is as it was.
        const execution = run.prepare ? await run.prepare(checked.input.ask) : null;
        // One acceptance at a time across all ids: the entry check, the room check and the durable record are one step, so two
        // jobs of one entry (or the last free place) are never both accepted.
        return await serial(ACCEPT, async () => {
          for (const o of jobs.values()) if (o.body && !o.body.tomb && o.body.binding?.entryId === s.binding.entryId && o.body.state === 'accepted') throw new ApiError('ENTRY_BUSY', 409);
          capacity();
          // The call is owned by the job from here: the limiter is taken now and given back once, when the call has ended.
          const release = run.acquire(id);
          const body = { id, capHash, bindingHash, binding: s.binding, ...(execution ? { execution } : {}), state: 'accepted', createdAt: now(), updatedAt: now(), input: s.input };
          try { await write(id, body); } catch (e) { release(); throw e instanceof ApiError && e.code !== 'JOB_STORE_UNAVAILABLE' ? e : new ApiError('JOB_STORE_FAILED', 507); }
          const controller = new AbortController(); running.set(id, { controller, release });
          const done = execute(id, checked.input.ask, controller, run, execution).finally(() => executing.delete(done)); executing.add(done);
          return { status: 202, value: view(id, body) };
        });
      });
    } finally { pending.delete(key); }
  }

  async function execute(id, ask, controller, run, execution) {
    await Promise.resolve(); // the receipt is answered first; the call never waits on the connection that brought it
    let outcome;
    try { const out = await (execution ? run.call(ask, controller.signal, execution) : run.call(ask, controller.signal)); outcome = { ok: true, out, observed: out.observed }; }
    catch (e) { outcome = { ok: false, observed: e?.observed, error: e instanceof ApiError ? { code: e.code, ...(e.detail ? { detail: e.detail } : {}) } : { code: 'INTERNAL_ERROR' } }; }
    const live = running.get(id);
    try {
      await serial(id, async () => {
        const body = jobs.get(id)?.body;
        // Cancelled (durably) meanwhile, or this process closed: a late reply never turns it back into a result.
        if (closed || !body || body.state !== 'accepted') return;
        // AF102: what the executor observed (times, how the child ended; never its output) stays with the binding it ran under.
        const ran = body.execution && outcome.observed ? { ...body, execution: { ...body.execution, observed: outcome.observed } } : body;
        const failed = error => ({ ...strip(ran), state: 'failed', error, updatedAt: now() });
        const next = outcome.ok
          ? { ...ran, state: 'ready', updatedAt: now(), result: { model: outcome.out.model, prompt: body.binding.prompt, askHash: body.binding.askHash, wire: outcome.out.reply, evidence: outcome.out.evidence, reading: { id: `R_${randomUUID()}`, at: now() } } }
          : failed(outcome.error);
        try { await write(id, next); }
        catch (e) {
          // The result is not kept, so it is not shown. Said as failed (durably when the store still takes that much).
          const error = { code: e?.code === 'JOB_STORE_FULL' ? 'JOB_STORE_FULL' : 'JOB_STORE_FAILED' };
          try { await write(id, failed(error)); } catch { if (!closed) failedHere.set(id, error); }
        }
      });
    } finally { running.delete(id); live?.release(); }
  }

  async function cancel(id, cap) {
    const capHash = capHashOf(cap);
    return serial(id, async () => {
      const j = jobs.get(id); if (j?.damaged) throw new ApiError('OPERATION_DAMAGED', 409);
      if (!j) {
        // Cancelled before it was accepted (its receipt lost or not yet sent): a tombstone under this capability keeps a late
        // submission of the same id from ever calling.
        if (!JOB_ID.test(id)) throw new ApiError('OPERATION_NOT_FOUND', 404);
        if (jobs.size >= limits.records) throw new ApiError('JOB_STORE_FULL', 507);
        const body = { id, capHash, bindingHash: null, state: 'cancelled', createdAt: now(), updatedAt: now(), remote: 'not-sent', acked: null, tomb: true };
        try { await write(id, body); } catch (e) { throw e instanceof ApiError ? e : new ApiError('JOB_STORE_FAILED', 507); }
        return { status: 200, value: view(id, body) };
      }
      const body = find(id, cap), live = running.get(id);
      if (body.state !== 'accepted' || failedHere.has(id)) return { status: 200, value: view(id, body) };
      const next = { ...strip(body), state: 'cancelled', remote: 'unknown', updatedAt: now() };
      try { await write(id, next); } catch (e) { throw e instanceof ApiError ? e : new ApiError('JOB_STORE_FAILED', 507); }
      // Recorded first; only then is the call stopped (whether the provider stops working or charging is not known).
      live?.controller.abort();
      return { status: 200, value: view(id, next) };
    });
  }

  async function ack(id, cap, raw) {
    let outcome; try { outcome = JSON.parse(raw ?? '')?.outcome; } catch { outcome = null; }
    if (!['applied', 'discarded', 'seen'].includes(outcome)) throw new ApiError('INVALID_INPUT', 400);
    return serial(id, async () => {
      const body = find(id, cap); if (!body) throw new ApiError('OPERATION_NOT_FOUND', 404);
      const lost = failedHere.get(id);
      if (body.acked) { if (body.acked.outcome !== outcome) throw new ApiError('OPERATION_CONFLICT', 409); return { status: 200, value: view(id, body) }; }
      const ok = body.state === 'ready' ? outcome === 'applied' || outcome === 'discarded' : (ENDED.has(body.state) || (!!lost && body.state === 'accepted')) && outcome === 'seen';
      if (!ok) throw new ApiError('OPERATION_STATE', 409);
      const next = tomb(lost && body.state === 'accepted' ? { ...body, state: 'failed', error: lost } : body, { outcome, at: now() });
      try { await write(id, next); } catch (e) { throw e instanceof ApiError ? e : new ApiError('JOB_STORE_FAILED', 507); }
      failedHere.delete(id);
      return { status: 200, value: view(id, next) };
    });
  }

  async function status(id, cap) {
    const body = find(id, cap);
    if (!body) { if (pending.has(`${id}:${capHashOf(cap)}`)) throw new ApiError('OPERATION_ACCEPTING', 409); throw new ApiError('OPERATION_NOT_FOUND', 404); }
    return { status: 200, value: view(id, body, true) };
  }

  return {
    dir, owner: owner?.kind ?? null,
    describe: () => problem ? { version: MAP_JOB_VERSION, durable: false, problem } : { version: MAP_JOB_VERSION, durable: true },
    /** One job route. run: { configured(), prompt(), model, acquire(id), call(ask, signal) } from the studio handler. */
    async handle({ method, rest, cap, body }, run) {
      if (problem || closed) throw new ApiError('JOB_STORE_UNAVAILABLE', 503);
      if (rest.length === 0 && method === 'POST') return submit(body, cap, run);
      if (rest.length === 1 && method === 'GET') return status(rest[0], cap);
      if (rest.length === 2 && method === 'POST' && rest[1] === 'cancel') return cancel(rest[0], cap);
      if (rest.length === 2 && method === 'POST' && rest[1] === 'ack') return ack(rest[0], cap, body);
      throw new ApiError(['GET', 'POST'].includes(method) ? 'NOT_FOUND' : 'METHOD_NOT_ALLOWED', ['GET', 'POST'].includes(method) ? 404 : 405);
    },
    /** Shutdown: fenced first (no write of this process reaches the store after this), calls called off, then the calls and the
     * changes in progress are waited for (a call that ignores the abort for longer than graceMs no longer matters: it cannot
     * write), and only then is the ownership let go. */
    async close({ graceMs = 2000 } = {}) {
      closed = true;
      for (const r of running.values()) r.controller.abort();
      let timer; await Promise.race([Promise.allSettled([...executing]), new Promise(r => { timer = setTimeout(r, graceMs); })]); clearTimeout(timer);
      await Promise.allSettled([...chains.values()]);
      await owner?.release?.();
    },
    /** Test view of what this process holds (no material). */
    held: () => ({ running: running.size, executing: executing.size, failed: failedHere.size })
  };
}
