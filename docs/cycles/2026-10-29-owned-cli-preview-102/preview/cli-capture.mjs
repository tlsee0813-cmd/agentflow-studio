// AF102: one CLI child, captured byte for byte. Lineage: AF96 experience96-cli-capture.mjs (raw buffers, fatal streaming UTF-8,
// stdout/stderr bounds, tool-event stop, one decision path). New here, the end of the child's life is its own boundary:
// - an AbortSignal (the job's cancel or the server's shutdown) and the selection deadline both stop the child; nothing is started
//   when either has already passed;
// - on POSIX the child leads its own process group. It is signalled (with its group) only while the leader has not been reaped:
//   until its exit is seen, its pid and group id cannot belong to anyone else. After that no signal is sent by number at all;
//   the group is only probed (kill 0), and a member left in it keeps the child "not gone" (fail closed, never killed on a guess);
// - the decision comes by decideMs at the latest, closed or not (closed:false); `settled` resolves only once the child is gone
//   (closed, and on POSIX its group empty), so the caller keeps its slot and lease until then;
// - verify(pid), when given, runs before any input is written (the executable image check); a refusal stops the child unfed.
// Nothing here parses the model's answer; the caller decides on the returned bytes.
import { spawn } from 'node:child_process';

export const CAPTURE_LIMITS = Object.freeze({ stdout: 524288, stderr: 131072 });
const POSIX = process.platform !== 'win32';
/** True while any process of the group lives, or might (EPERM: someone's process, so not proven gone). Only a probe, never a signal. */
export function groupAlive(pgid) {
  if (!POSIX || !Number.isSafeInteger(pgid) || pgid <= 1) return true;
  try { process.kill(-pgid, 0); return true; } catch (e) { return e?.code !== 'ESRCH'; }
}

/**
 * Runs exe with args, writes input to stdin and decides once: closed normally, or stopped (abort, deadline, bounds, malformed or
 * tool events, invalid UTF-8, image refused, spawn error) and then closed or given up on, never later than decideMs.
 * onSpawn(pid, pgid) is called once the OS gave the child a pid (before any input is written).
 */
export function captureCli({ exe, args, cwd, input, env, signal, selectionMs, decideMs = selectionMs + 1000, termMs = 1500, closeMs = 3000, limits = CAPTURE_LIMITS,
  allowedItems = ['agent_message', 'reasoning'], allowedEvents = ['thread.started', 'turn.started', 'item.started', 'item.updated', 'item.completed', 'turn.completed'],
  events: parse = true, onSpawn = () => {}, verify = null, spawnImpl = spawn, now = () => performance.now() }) {
  const began = now(), events = [], stdout = [], stderr = [], decoder = new TextDecoder('utf-8', { fatal: true });
  let decide, settle; const decision = new Promise(r => { decide = r; }), settled = new Promise(r => { settle = r; });
  const blank = { events, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), completion: {}, closed: true, started: false, pid: null, pgid: null, elapsedMs: 0, closedAtMs: null, stdoutBytesObserved: 0, stderrBytesObserved: 0 };
  // Nothing starts once the job was called off or its selection time is spent.
  if (signal?.aborted || selectionMs <= 0) { decide({ ...blank, reason: signal?.aborted ? 'CANCELLED' : 'SELECTION_DEADLINE' }); settle({ closed: true, group: 'never-started' }); return { decision, settled, pid: null, pgid: null }; }
  let outBytes = 0, errBytes = 0, pending = '', reason = null, exited = false, closed = false, decided = false, completion = {}, timer, decideTimer, termTimer, closeTimer, closedAt = null, probe = null, signalled = 0, skipped = 0;
  const child = spawnImpl(exe, args, { cwd, env, windowsHide: true, detached: POSIX, stdio: ['pipe', 'pipe', 'pipe'] });
  const pgid = POSIX && Number.isSafeInteger(child.pid) ? child.pid : null;
  const signalTree = sig => {
    if (exited) { skipped++; return; } // reaped (or about to be): its number is no longer proof of who it names
    try { if (pgid) process.kill(-pgid, sig); else child.kill(sig); signalled++; } catch { /* already gone */ }
  };
  const result = () => ({ events, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), completion, reason, closed, started: true, pid: child.pid ?? null, pgid,
    elapsedMs: now() - began, closedAtMs: closedAt, stdoutBytesObserved: outBytes, stderrBytesObserved: errBytes, signals: { sent: signalled, skippedAfterExit: skipped } });
  const finish = () => { if (decided) return; decided = true; clearTimeout(timer); clearTimeout(decideTimer); clearTimeout(closeTimer); signal?.removeEventListener('abort', onAbort); decide(result()); };
  // Gone: closed (stdio drained, exit seen) and, on POSIX, no member left in its group (probed only).
  const gone = () => {
    if (!closed) return;
    if (!pgid || !groupAlive(pgid)) { clearInterval(probe); clearTimeout(termTimer); settle({ closed: true, group: pgid ? 'empty' : 'not-tracked' }); return; }
    if (!probe) { probe = setInterval(gone, 50); probe.unref?.(); }
  };
  const stop = why => {
    if (decided) return; reason ??= why;
    const left = Math.max(0, decideMs - (now() - began));
    if (!closeTimer) closeTimer = setTimeout(() => { if (!closed) for (const s of [child.stdin, child.stdout, child.stderr]) s?.destroy(); finish(); }, Math.min(closeMs, left));
    signalTree('SIGTERM');
    if (!termTimer) { termTimer = setTimeout(() => signalTree('SIGKILL'), termMs); termTimer.unref?.(); }
  };
  const onAbort = () => stop('CANCELLED');
  const line = value => {
    if (!value.trim()) return;
    let e; try { e = JSON.parse(value); if (!e || typeof e !== 'object' || typeof e.type !== 'string') throw Error(); } catch { stop('MALFORMED_EVENT'); return; }
    events.push(e);
    if (!allowedEvents.includes(e.type)) { stop(e.type === 'error' || e.type === 'turn.failed' ? 'ERROR_EVENT' : 'UNKNOWN_EVENT'); return; }
    const type = e.item?.type; if (e.item !== undefined && (typeof type !== 'string' || !allowedItems.includes(type))) stop('TOOL_USE');
  };
  child.once('exit', () => { exited = true; });
  if (typeof child.pid === 'number') onSpawn(child.pid, pgid);
  timer = setTimeout(() => stop('SELECTION_DEADLINE'), selectionMs);
  // The hard bound of the decision: whatever is still open then, the child is decided on (closed:false if no close came).
  decideTimer = setTimeout(() => { stop('SELECTION_DEADLINE'); finish(); }, Math.max(0, decideMs));
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
  child.once('close', (code, sig) => {
    closed = true; exited = true; closedAt = now() - began; completion = { ...completion, code, signal: sig };
    if (!reason) { try { pending += decoder.decode(); if (pending && parse) line(pending); } catch { reason = 'INVALID_UTF8'; } }
    gone(); finish();
  });
  if (!verify) child.stdin.end(input);
  // The check counts only if the leader was still unreaped when it finished (else its /proc entry may have named another process).
  else if (typeof child.pid === 'number') Promise.resolve().then(() => verify(child.pid)).then(() => { if (exited) stop('IMAGE_UNVERIFIED'); else if (!decided && !reason) child.stdin.end(input); }, () => stop(exited ? 'IMAGE_UNVERIFIED' : 'IMAGE_CHANGED'));
  return { decision, settled, pid: child.pid ?? null, pgid };
}
