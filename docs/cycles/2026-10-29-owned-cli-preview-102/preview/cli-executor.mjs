// AF102: a local preview executor for durable map jobs (app/continuity/server/map-jobs.mjs) that runs one installed CLI child.
// Node only, imported by this cycle's launcher (serve-preview.mjs), never by studio.mjs, index.mjs or the Worker.
// What it holds to (101 DESIGN.md):
// - the policy (binary path and SHA-256, version, argument template, model, reasoning, wrapper, deadlines, bounds) is the operator's
//   local file, read once; the browser can choose none of it. Each job is bound to its hash when it is accepted (prepare), and a
//   job is run only under the very policy it was bound to.
// - one child at a time, no queue, no retry. Admission is tied to the child's life, not to the job: a durable lease is written
//   before the child is started and removed only once the child is known to be gone (closed, and on POSIX its process group empty).
//   A lease left by an earlier process (Node ended abnormally, or a close never came) keeps every new job out, whatever its id,
//   until that is proven: on Linux by another boot, on POSIX by the recorded group being empty; otherwise only by the operator's
//   recorded attestation (reconcile-lease.mjs). Nothing is killed on a guess: no PID from a lease is ever signalled.
// - only a complete answer is returned: exit 0, the allowed events (no tool, error or unknown event), turn.completed, a final file
//   byte-equal to the last agent message, valid UTF-8 within bounds, JSON, and validateMapReply against the very ask, all decided
//   within verdictMs of the start; the final must exist before selectionMs. The answer is never repaired or filtered.
// Times are observed and returned (never the output); ready disk writes and OS teardown are not promised within verdictMs.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, unlink, open } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from '../../../../app/server/errors.mjs';
import { own, fileIo } from '../../../../app/continuity/server/map-jobs.mjs';
import { map6Prompt, MAP6_FIRST_PROMPT } from '../../../../app/continuity/server/map-prompt.mjs';
import { validateMapReply, MAP6_SCHEMA } from '../../../../app/continuity/dist/public/shared/map-reading.js';
import { captureCli, groupAlive, CAPTURE_LIMITS } from './cli-capture.mjs';

export const EXECUTOR_ID = 'codex-cli-preview.102';
export const WRAPPER = 'cli-wrapper.1';
export const LEASE_FORMAT = 'agentflow.cli-lease.1';
const FINAL_BYTES = 131072;
const sha = b => createHash('sha256').update(b).digest('hex');
const canon = v => JSON.stringify(v, Object.keys(v).sort());
const iso = () => new Date().toISOString();

/** The text a child reads on stdin: the same two messages the HTTP path sends (system prompt, then the input JSON), framed. */
export function wrap(ask) {
  return `${map6Prompt(ask)}\n\n----- INPUT -----\nINPUT JSON (자료):\n${JSON.stringify(ask)}\n`;
}
const isFirst = ask => ask?.schemaVersion === MAP6_SCHEMA && ask.parts.length === 0 && (ask.requests ?? []).length === 0 && (ask.priors ?? []).length === 0;

/** Checks a policy file's content; throws POLICY_INVALID with the field. */
export function readPolicy(v) {
  const bad = f => { throw Object.assign(new Error('POLICY_INVALID'), { field: f }); };
  const str = (x, re) => typeof x === 'string' && re.test(x);
  if (!v || typeof v !== 'object') bad('policy');
  if (v.executor !== EXECUTOR_ID) bad('executor');
  if (typeof v.exe !== 'string' || !v.exe || !/^([A-Za-z]:[\\/]|\/)/.test(v.exe)) bad('exe'); // absolute, run without a shell
  if (!str(v.binarySha256, /^[0-9a-f]{64}$/)) bad('binarySha256');
  if (!str(v.version, /^[\x20-\x7e]{1,120}$/)) bad('version');
  for (const k of ['versionArgs', 'args']) if (!Array.isArray(v[k]) || !v[k].every(a => typeof a === 'string' && a.length <= 400) || v[k].length > 64) bad(k);
  for (const p of ['{final}', '{cwd}', '{model}', '{reasoning}']) if (!v.args.some(a => a.includes(p))) bad(`args:${p}`);
  if (!str(v.model, /^[\w.-]{1,80}$/)) bad('model');
  if (!str(v.reasoning, /^[a-z]{1,20}$/)) bad('reasoning');
  if (!Number.isInteger(v.selectionMs) || !Number.isInteger(v.verdictMs) || v.selectionMs < 1 || v.verdictMs < v.selectionMs || v.verdictMs > 300000) bad('deadline');
  if (v.wrapper !== WRAPPER) bad('wrapper');
  return Object.freeze({ executor: v.executor, exe: v.exe, binarySha256: v.binarySha256, version: v.version, versionArgs: [...v.versionArgs], args: [...v.args],
    model: v.model, reasoning: v.reasoning, selectionMs: v.selectionMs, verdictMs: v.verdictMs, wrapper: v.wrapper,
    limits: { stdout: CAPTURE_LIMITS.stdout, stderr: CAPTURE_LIMITS.stderr, final: FINAL_BYTES }, concurrency: 1, queue: 0, retry: 0 });
}

async function readBounded(file, max) {
  let h; try {
    h = await open(file, 'r'); const b = Buffer.alloc(max + 1); let used = 0;
    for (;;) { const { bytesRead } = await h.read(b, used, b.length - used, null); used += bytesRead; if (used > max) throw new Error('FINAL_BOUND'); if (!bytesRead) break; }
    return b.subarray(0, used);
  } finally { await h?.close(); }
}
async function bootId() { if (process.platform !== 'linux') return null; try { return (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim(); } catch { return null; } }

/**
 * Opens the executor on its state folder (one owner at a time, held by the OS like the job store). It is ready only when the binary
 * at policy.exe has policy.binarySha256 and says policy.version; otherwise describe() says why and every job is refused.
 */
export async function openCliExecutor({ policy: raw, stateDir, spawnImpl, now = () => performance.now(), log = () => {}, termMs, closeMs, versionMs = 10000 }) {
  const policy = readPolicy(raw);
  const permissions = sha(JSON.stringify(policy.args)); // the argument template carries sandbox, config and tool settings
  const binding = Object.freeze({ executor: policy.executor, version: policy.version, binarySha256: policy.binarySha256, model: policy.model, reasoning: policy.reasoning,
    permissions, wrapper: policy.wrapper, prompt: sha(MAP6_FIRST_PROMPT).slice(0, 12), selectionMs: policy.selectionMs, verdictMs: policy.verdictMs,
    policy: sha(canon({ ...policy, limits: canon(policy.limits) })) });
  let problem = null, owner = null, boot = await bootId();
  let slot = null; // { id, lease, spawned, child } from acquire until the child is known gone
  let unsettled = null; // a lease this process cannot prove ended: { leaseId, why }
  const leaseFile = join(stateDir, 'lease.json'), runs = join(stateDir, 'runs');
  const write = lease => fileIo.writeAtomic(stateDir, 'lease.json', JSON.stringify({ format: LEASE_FORMAT, lease, sha256: sha(JSON.stringify(lease)) }));
  const archive = async (lease, why) => {
    await mkdir(join(stateDir, 'released'), { recursive: true, mode: 0o700 });
    await fileIo.writeAtomic(join(stateDir, 'released'), `${lease.leaseId}.json`, JSON.stringify({ lease, released: { why, at: iso() } }));
    await unlink(leaseFile).catch(e => { if (e?.code !== 'ENOENT') throw e; });
  };
  /** What a lease found on disk proves about its child. */
  async function reconcile() {
    let text; try { text = await readFile(leaseFile, 'utf8'); } catch (e) { if (e?.code === 'ENOENT') { unsettled = null; return; } unsettled = { leaseId: null, why: 'LEASE_UNREADABLE' }; return; }
    let file = null; try { file = JSON.parse(text); } catch { /* below */ }
    const lease = file?.format === LEASE_FORMAT && file.sha256 === sha(JSON.stringify(file.lease)) ? file.lease : null;
    if (!lease) { unsettled = { leaseId: null, why: 'LEASE_DAMAGED' }; return; }
    if (lease.attested) { await archive(lease, 'operator-attested'); unsettled = null; return; }
    if (boot && lease.boot && lease.boot !== boot) { await archive(lease, 'other-boot'); unsettled = null; return; }
    if (process.platform !== 'win32' && lease.platform === process.platform && Number.isSafeInteger(lease.pgid) && lease.boot === boot && !groupAlive(lease.pgid)) { await archive(lease, 'group-empty'); unsettled = null; return; }
    unsettled = { leaseId: lease.leaseId, why: lease.pgid ? 'CHILD_MAY_LIVE' : 'CHILD_UNKNOWN' };
  }
  try {
    await mkdir(stateDir, { recursive: true, mode: 0o700 }); await mkdir(runs, { recursive: true, mode: 0o700 });
    owner = await own(stateDir);
    if (owner.busy) problem = 'EXECUTOR_STATE_BUSY';
    else {
      await reconcile();
      // Leftover run folders of an earlier process hold no lease of their own; the lease above decides admission.
      const bin = await readFile(policy.exe).catch(() => null);
      if (!bin) problem = 'BINARY_MISSING';
      else if (sha(bin) !== policy.binarySha256) problem = 'BINARY_CHANGED';
      else {
        // --version is not a generation call; it confirms the binary says the version the policy was frozen with.
        const env = childEnv();
        const v = captureCli({ exe: policy.exe, args: policy.versionArgs, cwd: runs, input: '', env, selectionMs: versionMs, events: false, spawnImpl, termMs, closeMs });
        const out = await v.decision;
        if (out.reason || out.completion.code !== 0 || out.stdout.toString('utf8').trim() !== policy.version) problem = 'VERSION_CHANGED';
        // Its end is proven like any child's; one that does not end keeps the executor closed.
        if (!out.closed) problem = 'VERSION_PROBE_NOT_CLOSED'; else await v.settled;
      }
    }
  } catch (e) { problem ??= 'EXECUTOR_STATE_UNUSABLE'; log(`cli preview: state not usable (${e?.code ?? 'error'})`); }
  function childEnv() { const env = { ...process.env }; for (const k of Object.keys(env)) if (/^(DEEPSEEK_|STUDIO_)/.test(k)) delete env[k]; return env; }

  // A child whose job has ended but which is not known gone (no close yet) holds the slot as an unsettled one.
  const lingering = () => !!slot && slot.spawned && !slot.owner;
  const state = () => problem ? 'unavailable' : unsettled || lingering() ? 'unsettled' : slot ? 'busy' : 'ready';
  async function prepare(ask) {
    if (problem) throw new ApiError('EXECUTOR_UNAVAILABLE', 503);
    if (!isFirst(ask)) throw new ApiError('EXECUTOR_SCOPE', 409);
    if (unsettled && !slot) await reconcile();
    if (unsettled || lingering()) throw new ApiError('EXECUTOR_UNSETTLED', 503);
    return { ...binding };
  }
  /** Taken in the job store's single acceptance step; synchronous, so two jobs can never both pass. */
  function acquire(id) {
    if (problem) throw new ApiError('EXECUTOR_UNAVAILABLE', 503);
    if (unsettled || lingering()) throw new ApiError('EXECUTOR_UNSETTLED', 503);
    if (slot) throw new ApiError('EXECUTOR_BUSY', 409);
    const mine = { id, spawned: false, owner: true }; slot = mine;
    // Given back by the job when its call has ended; the slot itself stays held until the child is known gone.
    return () => { mine.owner = false; if (!mine.spawned && slot === mine) slot = null; };
  }
  /** Ends the slot once its child is gone: the lease is removed first; if that fails the slot is not reused in this process. */
  async function release(mine, lease, why) {
    try { await archive(lease, why); if (slot === mine) slot = null; }
    catch { unsettled = { leaseId: lease.leaseId, why: 'LEASE_NOT_REMOVED' }; if (slot === mine) slot = null; }
  }

  async function call(ask, signal, bound) {
    const t0 = now(), at = iso(), mine = slot;
    const observed = (o = {}) => ({ startedAt: at, ...o });
    const fail = (code, status, o, detail) => Object.assign(new ApiError(code, status), { observed: observed(o) }, detail ? { detail } : {});
    if (!mine || mine.spawned || mine.lease) throw fail('EXECUTOR_BUSY', 409);
    if (!bound || bound.policy !== binding.policy) { if (!mine.spawned && slot === mine) slot = null; throw fail('EXECUTOR_CHANGED', 409); }
    if (signal?.aborted) { if (slot === mine) slot = null; throw fail('CANCELLED', 499); }
    const leaseId = `L_${randomUUID()}`, dir = join(runs, leaseId), cwd = join(dir, 'cwd'), final = join(dir, 'final.txt');
    let lease = { leaseId, job: mine.id, policy: binding.policy, platform: process.platform, boot, pid: null, pgid: null, state: 'starting', at };
    try { await mkdir(cwd, { recursive: true, mode: 0o700 }); await write(lease); }
    catch { if (slot === mine) slot = null; await rm(dir, { recursive: true, force: true }).catch(() => {}); throw fail('EXECUTOR_LEASE_FAILED', 507); }
    mine.lease = lease; mine.spawned = true;
    const fill = a => a.replaceAll('{final}', final).replaceAll('{cwd}', cwd).replaceAll('{model}', policy.model).replaceAll('{reasoning}', policy.reasoning);
    let leaseWrite = Promise.resolve();
    const t1 = now() - t0; // lease and folder time, counted inside the selection window
    const run = captureCli({ exe: policy.exe, args: policy.args.map(fill), cwd, input: wrap(ask), env: childEnv(), signal, selectionMs: policy.selectionMs - (now() - t0),
      spawnImpl, now, termMs, closeMs,
      onSpawn: (pid, pgid) => { lease = { ...lease, pid, pgid, state: 'running' }; mine.lease = lease; leaseWrite = write(lease).catch(() => {}); } });
    // The slot is given back only when the child is gone; a close that never comes keeps it (and the lease) held.
    void run.settled.then(async s => { await leaseWrite; await release(mine, mine.lease, s.group === 'never-started' ? 'never-started' : 'closed'); await rm(dir, { recursive: true, force: true }).catch(() => {}); });
    const out = await run.decision;
    const o = { closedAtMs: out.closedAtMs === null ? null : t1 + out.closedAtMs, decidedAtMs: now() - t0, closed: out.closed, exit: out.completion.code ?? null, signal: out.completion.signal ?? null,
      reason: out.reason, events: out.events.length, usage: out.events.findLast(e => e.type === 'turn.completed')?.usage ?? null, stdoutBytes: out.stdoutBytesObserved, stderrBytes: out.stderrBytesObserved };
    if (out.reason === 'CANCELLED' || out.reason === 'SHUTDOWN') throw fail('CANCELLED', 499, o);
    if (out.reason === 'SELECTION_DEADLINE') throw fail('AI_TIMEOUT', 504, o);
    if (out.reason === 'TOOL_USE' || out.reason === 'ERROR_EVENT' || out.reason === 'UNKNOWN_EVENT' || out.reason === 'MALFORMED_EVENT' || out.reason === 'INVALID_UTF8') throw fail('AI_RESPONSE_REJECTED', 502, o, { rule: out.reason });
    if (out.reason) throw fail('AI_UNAVAILABLE', 503, o, { rule: out.reason });
    if (out.completion.code !== 0) throw fail('AI_RESPONSE_UNFINISHED', 502, o, { rule: 'EXIT' });
    if (!out.events.some(e => e.type === 'turn.completed')) throw fail('AI_RESPONSE_UNFINISHED', 502, o, { rule: 'NO_TURN_COMPLETED' });
    if (o.closedAtMs === null || o.closedAtMs > policy.selectionMs) throw fail('AI_TIMEOUT', 504, o);
    const message = out.events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message').at(-1)?.item?.text;
    let bytes;
    try { bytes = await readBounded(final, FINAL_BYTES); } catch (e) { throw fail('AI_RESPONSE_UNFINISHED', 502, o, { rule: e?.message === 'FINAL_BOUND' ? 'FINAL_BOUND' : 'NO_FINAL' }); }
    let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw fail('AI_RESPONSE_REJECTED', 502, o, { rule: 'FINAL_UTF8' }); }
    if (typeof message !== 'string' || !Buffer.from(message, 'utf8').equals(bytes)) throw fail('AI_RESPONSE_REJECTED', 502, o, { rule: 'FINAL_MISMATCH' });
    let wire;
    try { wire = JSON.parse(text); validateMapReply(wire, ask); }
    catch (e) { throw fail('INVALID_RESPONSE', 502, { ...o, finalSha256: sha(bytes), finalBytes: bytes.length }, e?.name === 'MapReplyError' ? { path: e.path, rule: e.rule, target: e.target } : { rule: 'JSON' }); }
    const verdictAtMs = now() - t0, verdict = { ...o, verdictAtMs, finalSha256: sha(bytes), finalBytes: bytes.length };
    if (verdictAtMs > policy.verdictMs) throw fail('AI_TIMEOUT', 504, verdict);
    if (signal?.aborted) throw fail('CANCELLED', 499, verdict);
    return { wire, observed: observed(verdict) };
  }

  return {
    id: EXECUTOR_ID, model: policy.model,
    ready: () => !problem,
    describe: () => ({ id: EXECUTOR_ID, model: policy.model, state: state(), problem: problem ?? unsettled?.why ?? (lingering() ? 'CHILD_NOT_CLOSED' : null), policy: binding.policy.slice(0, 12) }),
    prepare, acquire, call,
    /** Test and launcher view (no paths, no output). */
    held: () => ({ slot: slot ? { job: slot.id, spawned: slot.spawned, pid: slot.lease?.pid ?? null } : null, unsettled }),
    /** Shutdown after the job store's close (which aborted the calls): waits up to graceMs for a child to be gone, then lets the
     * state folder go. A child still alive keeps its lease on disk, so the next owner stays closed until it is proven gone. */
    async close({ graceMs = 4000 } = {}) {
      const end = Date.now() + graceMs; while (slot?.spawned && Date.now() < end) await new Promise(r => setTimeout(r, 25));
      await owner?.release?.();
    }
  };
}
