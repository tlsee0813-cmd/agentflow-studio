// AF102: one CLI child, captured byte for byte. Lineage: AF96 experience96-cli-capture.mjs (raw buffers, fatal streaming UTF-8,
// stdout/stderr bounds, tool-event stop, one decision path). New here, the end of the child's life is its own boundary:
// - an AbortSignal (the job's cancel or the server's shutdown) and the selection deadline both stop the child;
// - on POSIX the child leads its own process group, so a stop reaches what it started, and its end is told by the group being
//   empty (a group id is not reused while any member lives, so neither the signal nor the probe can hit another program);
// - a missing close never reads as ended: `settled` resolves only when the child (and, on POSIX, its group) is gone, and the
//   decision returns without it (closed:false), so the caller keeps the slot held.
// Nothing here parses the model's answer; the caller decides on the returned bytes.
import { spawn } from 'node:child_process';

export const CAPTURE_LIMITS = Object.freeze({ stdout: 524288, stderr: 131072 });
const POSIX = process.platform !== 'win32';
/** True while any process of the group lives (or might: EPERM is someone's process, so not proven gone). */
export function groupAlive(pgid) {
  if (!POSIX || !Number.isSafeInteger(pgid) || pgid <= 1) return true;
  try { process.kill(-pgid, 0); return true; } catch (e) { return e?.code !== 'ESRCH'; }
}

/**
 * Runs exe with args, writes input to stdin and returns once a decision is made: closed normally, or stopped (abort, deadline,
 * bounds, malformed or tool events, invalid UTF-8, spawn error) and then closed or given up on after closeMs.
 * onSpawn(pid) is called once the OS gave the child a pid (before any output is read).
 */
export function captureCli({ exe, args, cwd, input, env, signal, selectionMs, termMs = 1500, closeMs = 3000, limits = CAPTURE_LIMITS,
  allowedItems = ['agent_message', 'reasoning'], allowedEvents = ['thread.started', 'turn.started', 'item.started', 'item.updated', 'item.completed', 'turn.completed'],
  events: parse = true, onSpawn = () => {}, spawnImpl = spawn, now = () => performance.now() }) {
  const began = now(), events = [], stdout = [], stderr = [], decoder = new TextDecoder('utf-8', { fatal: true });
  let outBytes = 0, errBytes = 0, pending = '', reason = null, exited = false, closed = false, decided = false, completion = {}, timer, termTimer, closeTimer, closedAt = null;
  let decide, settle; const decision = new Promise(r => { decide = r; }), settled = new Promise(r => { settle = r; });
  const child = spawnImpl(exe, args, { cwd, env, windowsHide: true, detached: POSIX, stdio: ['pipe', 'pipe', 'pipe'] });
  const pgid = POSIX && Number.isSafeInteger(child.pid) ? child.pid : null;
  const signalTree = sig => {
    // Only while the group can still be ours: before the leader was reaped, or while any member of its group lives.
    try { if (pgid && (!exited || groupAlive(pgid))) process.kill(-pgid, sig); else if (!exited) child.kill(sig); } catch { /* already gone */ }
  };
  const result = () => ({ events, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), completion, reason, closed, pid: child.pid ?? null, pgid,
    elapsedMs: now() - began, closedAtMs: closedAt, stdoutBytesObserved: outBytes, stderrBytesObserved: errBytes });
  const finish = () => { if (decided) return; decided = true; clearTimeout(timer); clearTimeout(closeTimer); signal?.removeEventListener('abort', onAbort); decide(result()); };
  // Gone means closed (stdio drained, exit seen) and, on POSIX, no member of its group left.
  let probe = null;
  const gone = () => {
    if (!closed) return;
    if (!pgid || !groupAlive(pgid)) { clearInterval(probe); clearTimeout(termTimer); settle({ closed: true, group: pgid ? 'empty' : 'not-tracked' }); return; }
    if (!probe) { probe = setInterval(gone, 50); probe.unref?.(); signalTree('SIGKILL'); }
  };
  const stop = why => {
    if (decided) return; reason ??= why;
    if (!closeTimer) closeTimer = setTimeout(() => { if (!closed) { for (const s of [child.stdin, child.stdout, child.stderr]) s?.destroy(); } finish(); }, closeMs);
    signalTree('SIGTERM');
    if (!termTimer) { termTimer = setTimeout(() => { if (!closed || (pgid && groupAlive(pgid))) signalTree('SIGKILL'); }, termMs); termTimer.unref?.(); }
  };
  const onAbort = () => stop(signal.reason?.code === 'SHUTDOWN' ? 'SHUTDOWN' : 'CANCELLED');
  const line = value => {
    if (!value.trim()) return;
    let e; try { e = JSON.parse(value); if (!e || typeof e !== 'object' || typeof e.type !== 'string') throw Error(); } catch { stop('MALFORMED_EVENT'); return; }
    events.push(e);
    if (!allowedEvents.includes(e.type)) { stop(e.type === 'error' || e.type === 'turn.failed' ? 'ERROR_EVENT' : 'UNKNOWN_EVENT'); return; }
    const type = e.item?.type; if (e.item !== undefined && (typeof type !== 'string' || !allowedItems.includes(type))) stop('TOOL_USE');
  };
  if (typeof child.pid === 'number') onSpawn(child.pid, pgid);
  timer = setTimeout(() => stop('SELECTION_DEADLINE'), Math.max(0, selectionMs));
  if (signal?.aborted) onAbort(); else signal?.addEventListener('abort', onAbort, { once: true });
  child.stdout.on('data', bytes => {
    if (decided || reason) return; outBytes += bytes.length; if (outBytes > limits.stdout) { stop('STDOUT_BOUND'); return; } stdout.push(bytes);
    try { pending += decoder.decode(bytes, { stream: true }); } catch { stop('INVALID_UTF8'); return; }
    if (!parse) return; // raw output only (a --version probe): kept and bounded, not read as events
    const lines = pending.split('\n'); pending = lines.pop(); for (const value of lines) { if (reason) break; line(value); }
  });
  child.stderr.on('data', bytes => { if (decided || reason) return; errBytes += bytes.length; if (errBytes > limits.stderr) { stop('STDERR_BOUND'); return; } stderr.push(bytes); });
  child.stdin.on('error', () => stop('STDIN_ERROR'));
  child.once('error', e => { completion = { ...completion, spawnError: e?.code ?? e?.name ?? 'error' }; if (typeof child.pid !== 'number') { closed = true; reason ??= 'SPAWN_ERROR'; settle({ closed: true, group: 'never-started' }); finish(); } else stop('SPAWN_ERROR'); });
  child.once('exit', () => { exited = true; });
  child.once('close', (code, sig) => {
    closed = true; exited = true; closedAt = now() - began; completion = { ...completion, code, signal: sig };
    if (!reason) { try { pending += decoder.decode(); if (pending && parse) line(pending); } catch { reason = 'INVALID_UTF8'; } }
    gone(); finish();
  });
  child.stdin.end(input);
  return { decision, settled, pid: child.pid ?? null, pgid };
}
