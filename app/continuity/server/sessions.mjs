// Local session records: the conversations Claude Code and Codex already keep on this PC, read so the person can bring one into a
// project without copying it by hand. Local Node server only (never the Worker or a static build): it reads the person's own files.
//   Claude Code: <CLAUDE_CONFIG_DIR or ~/.claude>/projects/<folder>/<session>.jsonl
//   Codex:       <CODEX_HOME or ~/.codex>/sessions/YYYY/MM/DD/rollout-*.jsonl (and archived_sessions/rollout-*.jsonl)
// Read only. Nothing is written, sent to a provider or kept here: the browser gets a session's turns when it asks (the paste box's
// session list, or the automatic connection), and what it keeps it saves as an ordinary pasted record (with its own secret check).
// The browser never names a path: a session is asked for by an opaque id from the latest listing, so no request can reach a file
// outside these two folders. Only what the person typed and the tools' final replies are read (plus which files a reply changed);
// tool output, reasoning and injected context are left out (the reading itself is shared/session-parse.ts, also used by the page).
import { createReadStream } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { ApiError } from '../../server/errors.mjs';
import { SESSION_VERSION, SESSION_LIMITS, SESSION_ID, parseClaude, parseCodex, parseSession, sessionParser, pushLine, jsonLines, withSubagents, tailFolders, hasPrompt, atFolder, within, sessionSummary, sessionDetail, sessionKey, sessionId } from '../dist/public/shared/session-parse.js';

export { SESSION_LIMITS, SESSION_ID, parseClaude, parseCodex };

/** `bytes` bytes of a file from `from` on (its head, or its tail), as text. */
async function readRange(path, bytes, from = 0) {
  const h = await open(path, 'r');
  try { const buf = Buffer.alloc(bytes); const { bytesRead } = await h.read(buf, 0, bytes, from); return buf.subarray(0, bytesRead).toString('utf8'); }
  finally { await h.close(); }
}
/** What a listing knows of a file: its head (read further while no prompt is in it, but for a Codex subagent's rollout, which never
 * holds one), with the folders named at its end. */
async function readListed(tool, path, size, limits) {
  const { headBytes: head, promptBytes: more, tailBytes: tail } = limits;
  let parsed = parseSession(tool, jsonLines(await readRange(path, head), size > head));
  if (!hasPrompt(parsed) && size > head && !parsed.meta.parent) parsed = parseSession(tool, jsonLines(await readRange(path, more), size > more));
  if (size > head) for (const c of tailFolders(await readRange(path, tail, Math.max(0, size - tail)))) atFolder(parsed.meta, c);
  return parsed;
}
/** A whole session read in chunks, line by line, into the tool's parser: a file of hundreds of MB is never held whole. A line over
 * `cap` bytes (a damaged file, a huge paste) is skipped rather than built into a string past what Node can hold, and a failed read
 * fails this read only. Lines are split on the newline byte, which never occurs inside a UTF-8 character. */
async function readParsed(tool, path, cap = SESSION_LIMITS.lineBytes) {
  const parser = sessionParser(tool); let parts = [], size = 0;
  const add = b => { size += b.length; if (size > cap) parts = []; else if (b.length) parts.push(b); };
  const line = () => { if (size <= cap && parts.length) pushLine(parser, (parts.length === 1 ? parts[0] : Buffer.concat(parts)).toString('utf8')); parts = []; size = 0; };
  for await (const chunk of createReadStream(path)) {
    let from = 0;
    for (let nl = chunk.indexOf(10); nl >= 0; from = nl + 1, nl = chunk.indexOf(10, from)) { add(chunk.subarray(from, nl)); line(); }
    add(chunk.subarray(from));
  }
  line();
  return parser.done();
}
async function dirs(path) { try { return (await readdir(path, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => join(path, d.name)); } catch { return []; } }
async function files(path, test) { try { return (await readdir(path, { withFileTypes: true })).filter(d => d.isFile() && test(d.name)).map(d => join(path, d.name)); } catch { return []; } }

/** The session files of each tool (no content read). Codex: sessions/YYYY/MM/DD only, the layout it writes. Claude Code project
 * folders are all looked in, whatever the folder asked for: their names drop letter case and a session can move to another folder,
 * so only the lines tell where a session worked. */
async function candidates(roots) {
  const out = [];
  if (roots.claude) for (const d of await dirs(join(roots.claude, 'projects')))
    for (const f of await files(d, n => n.endsWith('.jsonl'))) out.push({ tool: 'claude', path: f });
  if (roots.codex) for (const y of await dirs(join(roots.codex, 'sessions'))) for (const m of await dirs(y)) for (const d of await dirs(m))
    for (const f of await files(d, n => /^rollout-.*\.jsonl$/.test(n))) out.push({ tool: 'codex', path: f });
  // A thread archived in Codex moves here with its id (one archived before a look took it is still taken; listed once by its id).
  if (roots.codex) for (const f of await files(join(roots.codex, 'archived_sessions'), n => /^rollout-.*\.jsonl$/.test(n))) out.push({ tool: 'codex', path: f });
  return out;
}

/**
 * The session service, or null when turned off (STUDIO_SESSIONS=off). roots default to the tools' own folders under the home
 * folder (CLAUDE_CONFIG_DIR / CODEX_HOME when set); a folder that does not exist simply lists nothing.
 * limits: any left out are SESSION_LIMITS.
 */
export function openSessions({ env = process.env, home = homedir(), roots = null, limits: given = SESSION_LIMITS } = {}) {
  if (env.STUDIO_SESSIONS === 'off') return null;
  const limits = { ...SESSION_LIMITS, ...given };
  const where = roots ?? { claude: env.CLAUDE_CONFIG_DIR || join(home, '.claude'), codex: env.CODEX_HOME || join(home, '.codex') };
  let known = new Map(); // id -> { tool, path }
  const threads = new Map(); // subagent file path -> { mtime, parent } (from its first lines)
  // Listed file path -> what its listing read gave ({ size, mtime, real, id, row, cwds }; row null with no prompt): auto-sync lists
  // every minute, and a file is read again only when its size or time changed (a prompt-less subagent file is not read each time).
  const heads = new Map();

  /** Newest first. folder: only sessions whose working folder is it or inside it (the files are read to know). */
  async function list(folder = null) {
    const found = [];
    for (const c of await candidates(where)) {
      try { const s = await stat(c.path); if (s.size > 0) found.push({ ...c, size: s.size, mtime: s.mtimeMs }); } catch { /* gone meanwhile */ }
    }
    found.sort((a, b) => b.mtime - a.mtime);
    const there = new Set(found.map(f => f.path)); for (const p of heads.keys()) if (!there.has(p)) heads.delete(p);
    const next = new Map(), out = [], scan = limits.scan; let sessions = 0, quiet = 0;
    // At most `scan` session files are opened, so a folder with no session left does not read a whole history. Files with no session
    // in them (Codex subagents' rollouts, Claude Code's agent-*.jsonl, one that cannot be read) do not use it up, as in the page: ten
    // times as many of them.
    for (const f of found) {
      if (out.length >= limits.list || sessions >= scan || quiet >= scan * 10) break;
      let h = heads.get(f.path);
      if (h?.size !== f.size || h.mtime !== f.mtime) {
        let real; try { real = await realpath(f.path); } catch { quiet++; continue; }
        let parsed; try { parsed = await readListed(f.tool, real, f.size, limits); } catch { quiet++; continue; }
        // An id is made from the session itself (sessionKey), as the page makes it; the one made from the file's path before is its alias.
        const id = await sessionId(f.tool, sessionKey(f.tool, parsed.meta, real)), base = sessionSummary(id, f.tool, parsed, new Date(f.mtime).toISOString(), f.size, limits);
        // An archived Codex thread lay in sessions/YYYY/MM/DD/ under the same name (its date is in it): that path's id is its alias too.
        const day = f.tool === 'codex' && basename(dirname(real)) === 'archived_sessions' ? /^rollout-(\d{4})-(\d{2})-(\d{2})T/.exec(basename(real)) : null;
        const aliases = [await sessionId(f.tool, real), ...(day ? [await sessionId(f.tool, join(dirname(dirname(real)), 'sessions', day[1], day[2], day[3], basename(real)))] : [])];
        h = { size: f.size, mtime: f.mtime, real, id, row: base && { ...base, aliases }, cwds: parsed.meta.cwds }; heads.set(f.path, h);
      }
      if (!h.row) { quiet++; continue; }
      // Two files of one session (a copy left behind): the newest one is the session, and only it counts against the scan.
      if (next.has(h.id)) continue;
      sessions++; known.set(h.id, { tool: f.tool, path: h.real }); next.set(h.id, { tool: f.tool, path: h.real });
      if (folder && !within(h.cwds, folder)) continue;
      out.push({ ...h.row });
    }
    // A folder listing adds to what is known (a session listed before stays readable); a whole listing replaces it.
    if (!folder) known = next;
    return { version: SESSION_VERSION, sessions: out };
  }

  /** Subagent files that name the session they work for in their first lines (read again only when they change). */
  async function parentOf(path, st, tool) {
    let t = threads.get(path);
    if (t?.mtime !== st.mtimeMs) {
      let head; try { head = jsonLines(await readRange(path, limits.headBytes), st.size > limits.headBytes); } catch { return null; }
      t = { mtime: st.mtimeMs, parent: tool === 'codex' ? parseSession('codex', head).meta.parent : head.find(o => typeof o?.sessionId === 'string')?.sessionId ?? null }; threads.set(path, t);
    }
    return t.parent;
  }
  /** The subagent sessions a session started (they begin after it; one that cannot be read is left out). Codex: rollouts naming it
   * as parent. Claude Code: transcripts kept beside it (<session>/subagents/*.jsonl), or, in earlier versions, agent-*.jsonl in its
   * project folder naming it by its sessionId. Only the files they changed are used. */
  async function subagents(tool, path, parsed) {
    const out = [], since = Date.parse(parsed.meta.startedAt ?? '') || 0, base = basename(path, '.jsonl');
    const own = tool === 'claude' ? await files(join(dirname(path), base, 'subagents'), n => n.endsWith('.jsonl')) : [];
    const near = tool === 'claude' ? await files(dirname(path), n => /^agent-.*\.jsonl$/.test(n) && n !== `${base}.jsonl`)
      : where.codex && parsed.meta.thread ? (await candidates({ codex: where.codex })).map(c => c.path) : [];
    for (const p of [...own, ...near]) {
      let st; try { st = await stat(p); } catch { continue; }
      if (st.mtimeMs < since || st.size > limits.fileBytes) continue;
      if (!own.includes(p) && (await parentOf(p, st, tool)) !== (tool === 'codex' ? parsed.meta.thread : base)) continue;
      try { out.push(await readParsed(tool, p, limits.lineBytes)); } catch { /* gone meanwhile */ }
    }
    return out;
  }

  /** since: only turns from that time on (what was taken before does not use up the reply budget). */
  async function read(id, { since = null } = {}) {
    if (typeof id !== 'string' || !SESSION_ID.test(id)) throw new ApiError('SESSION_NOT_FOUND', 404);
    if (!known.has(id)) await list();
    const f = known.get(id); if (!f) throw new ApiError('SESSION_NOT_FOUND', 404);
    let size; try { size = (await stat(f.path)).size; } catch { throw new ApiError('SESSION_NOT_FOUND', 404); }
    if (size > limits.fileBytes) throw new ApiError('SESSION_TOO_LARGE', 413);
    const parsed = await readParsed(f.tool, f.path, limits.lineBytes);
    return sessionDetail(id, f.tool, withSubagents(parsed, await subagents(f.tool, f.path, parsed)), limits, since);
  }

  return { describe: () => ({ version: SESSION_VERSION, tools: Object.keys(where).filter(k => where[k]) }), list, read };
}
