// Local session records: the conversations Claude Code and Codex already keep on this PC, read so the person can bring one into a
// project without copying it by hand. Local Node server only (never the Worker or a static build): it reads the person's own files.
//   Claude Code: <CLAUDE_CONFIG_DIR or ~/.claude>/projects/<folder>/<session>.jsonl
//   Codex:       <CODEX_HOME or ~/.codex>/sessions/YYYY/MM/DD/rollout-*.jsonl
// Read only. Nothing is written, sent to a provider or kept here: the browser gets a session's turns when the person opens it, and
// what it keeps is what the person then saves through the ordinary paste box (with its own secret check).
// The browser never names a path: a session is asked for by an opaque id from the latest listing, so no request can reach a file
// outside these two folders. Only what the person typed and the tools' final replies are read (plus which files a reply changed);
// tool output, reasoning and injected context are left out (the reading itself is shared/session-parse.ts, also used by the page).
import { createReadStream } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ApiError } from '../../server/errors.mjs';
import { SESSION_VERSION, SESSION_LIMITS, SESSION_ID, parseClaude, parseCodex, parseSession, sessionParser, pushLine, jsonLines, withSubagents, tailFolders, hasPrompt, atFolder, claudeFolder, within, sessionSummary, sessionDetail, sessionKey } from '../dist/public/shared/session-parse.js';

export { SESSION_VERSION, SESSION_LIMITS, SESSION_ID, parseClaude, parseCodex, claudeFolder, within };

async function readHead(path, bytes, from = 0) {
  const h = await open(path, 'r');
  try { const buf = Buffer.alloc(bytes); const { bytesRead } = await h.read(buf, 0, bytes, from); return buf.subarray(0, bytesRead).toString('utf8'); }
  finally { await h.close(); }
}
/** What a listing knows of a file: its head (read further while no prompt is in it), with the folders named at its end. */
async function readListed(tool, path, size, limits) {
  let parsed = parseSession(tool, jsonLines(await readHead(path, limits.headBytes), size > limits.headBytes));
  const more = limits.promptBytes ?? SESSION_LIMITS.promptBytes, tail = limits.tailBytes ?? SESSION_LIMITS.tailBytes;
  if (!hasPrompt(parsed) && size > limits.headBytes) parsed = parseSession(tool, jsonLines(await readHead(path, more), size > more));
  if (size > limits.headBytes) for (const c of tailFolders(await readHead(path, tail, Math.max(0, size - tail)))) atFolder(parsed.meta, c);
  return parsed;
}
/** A whole session read line by line into the tool's parser: a file of hundreds of MB is never held whole. */
async function readParsed(tool, path) {
  const parser = sessionParser(tool), rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const r of rl) pushLine(parser, r);
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
  return out;
}

/**
 * The session service, or null when turned off (STUDIO_SESSIONS=off). roots default to the tools' own folders under the home
 * folder (CLAUDE_CONFIG_DIR / CODEX_HOME when set); a folder that does not exist simply lists nothing.
 */
export function openSessions({ env = process.env, home = homedir(), roots = null, limits = SESSION_LIMITS } = {}) {
  if (env.STUDIO_SESSIONS === 'off') return null;
  const where = roots ?? { claude: env.CLAUDE_CONFIG_DIR || join(home, '.claude'), codex: env.CODEX_HOME || join(home, '.codex') };
  let known = new Map(); // id -> { tool, path }
  const threads = new Map(); // Codex file path -> { mtime, parent } (from its first lines)
  // An id is made from the session itself (sessionKey), as the page makes it; the one made from the file's path before is its alias.
  const idOf = (tool, name) => `${tool}-${createHash('sha256').update(name).digest('hex').slice(0, 24)}`;

  /** Newest first. folder: only sessions whose working folder is it or inside it (the files are read to know). */
  async function list(folder = null) {
    const found = [];
    for (const c of await candidates(where)) {
      try { const s = await stat(c.path); if (s.size > 0) found.push({ ...c, size: s.size, mtime: s.mtimeMs }); } catch { /* gone meanwhile */ }
    }
    found.sort((a, b) => b.mtime - a.mtime);
    const next = new Map(), out = [];
    // At most `scan` newest files are opened, so a folder with no session left does not read a whole history.
    for (const f of found.slice(0, limits.scan ?? 400)) {
      if (out.length >= limits.list) break;
      let real; try { real = await realpath(f.path); } catch { continue; }
      let parsed; try { parsed = await readListed(f.tool, real, f.size, limits); } catch { continue; }
      const id = idOf(f.tool, sessionKey(f.tool, parsed.meta, real)), base = sessionSummary(id, f.tool, parsed, new Date(f.mtime).toISOString(), f.size, limits);
      // Two files of one session (a copy left behind): the newest one is the session.
      if (!base || next.has(id)) continue;
      const row = { ...base, aliases: [idOf(f.tool, real)] };
      known.set(id, { tool: f.tool, path: real }); next.set(id, { tool: f.tool, path: real });
      if (folder && !within(parsed.meta.cwds, folder)) continue;
      out.push(row);
    }
    // A folder listing adds to what is known (a session listed before stays readable); a whole listing replaces it.
    if (!folder) known = next;
    return { version: SESSION_VERSION, sessions: out };
  }

  /** The Codex subagent sessions a session started (their files name it as parent; they begin after it). */
  async function subagents(parsed) {
    const out = [], since = Date.parse(parsed.meta.startedAt ?? '') || 0;
    if (!where.codex || !parsed.meta.thread) return out;
    for (const c of await candidates({ codex: where.codex })) {
      let st; try { st = await stat(c.path); } catch { continue; }
      if (st.mtimeMs < since) continue;
      let t = threads.get(c.path);
      if (t?.mtime !== st.mtimeMs) {
        let head; try { head = await readHead(c.path, limits.headBytes); } catch { continue; }
        t = { mtime: st.mtimeMs, parent: parseSession('codex', jsonLines(head, st.size > limits.headBytes)).meta.parent }; threads.set(c.path, t);
      }
      if (t.parent === parsed.meta.thread && st.size <= limits.fileBytes) out.push(await readParsed('codex', c.path));
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
    const parsed = await readParsed(f.tool, f.path);
    return sessionDetail(id, f.tool, f.tool === 'codex' ? withSubagents(parsed, await subagents(parsed)) : parsed, limits, since);
  }

  return { describe: () => ({ version: SESSION_VERSION, tools: Object.keys(where).filter(k => where[k]) }), list, read };
}
