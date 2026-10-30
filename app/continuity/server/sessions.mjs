// Local session records: the conversations Claude Code and Codex already keep on this PC, read so the person can bring one into a
// project without copying it by hand. Local Node server only (never the Worker or a static build): it reads the person's own files.
//   Claude Code: <CLAUDE_CONFIG_DIR or ~/.claude>/projects/<folder>/<session>.jsonl
//   Codex:       <CODEX_HOME or ~/.codex>/sessions/YYYY/MM/DD/rollout-*.jsonl
// Read only. Nothing is written, sent to a provider or kept here: the browser gets a session's turns when the person opens it, and
// what it keeps is what the person then saves through the ordinary paste box (with its own secret check).
// The browser never names a path: a session is asked for by an opaque id from the latest listing, so no request can reach a file
// outside these two folders. Only what the person typed and the tools' final replies are read (plus which files a reply changed);
// tool output, reasoning and injected context are left out.
import { createReadStream } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join, relative, isAbsolute, sep } from 'node:path';
import { ApiError } from '../../server/errors.mjs';

export const SESSION_VERSION = 'sessions.1';
export const SESSION_LIMITS = Object.freeze({ list: 60, headBytes: 256 * 1024, fileBytes: 64 * 1024 * 1024, turnChars: 20000, replyChars: 300000, preview: 160 });
const TOOL_LABEL = { claude: 'Claude Code', codex: 'Codex' };
export const SESSION_ID = /^(claude|codex)-[0-9a-f]{24}$/;

/** Text of a message content: a string, or the text parts of a list of blocks (tool calls, results and reasoning left out). */
function textOf(content, kinds) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(b => b && kinds.includes(b.type) && typeof b.text === 'string').map(b => b.text).join('\n\n');
}
const clip = (text, n) => (text.length > n ? `${text.slice(0, n)}\n…(이후 ${(text.length - n).toLocaleString()}자 생략)` : text);
/** What the person typed, without context a tool injects into the same message. Null when nothing typed is left. */
function typed(text) {
  let t = String(text).replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  // Claude Code slash commands are stored as tags: kept as the command the person typed; their local output is not a prompt.
  const cmd = /^<command-name>([^<]*)<\/command-name>/.exec(t.replace(/^<command-message>[\s\S]*?<\/command-message>\s*/, ''));
  if (cmd) { const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(t)?.[1]?.trim(); t = `${cmd[1].trim()}${args ? ` ${args}` : ''}`; }
  if (/^<(local-command-[a-z]+|command-message)>/.test(t)) return null;
  // Context a tool puts in a user message (Codex environment_context, user_instructions, AGENTS.md…), or any message that is one
  // whole tagged block, is not a prompt.
  if (/^(<user_instructions>|<environment_context>|<turn_context>|<instructions>|<permissions|# AGENTS\.md instructions)/i.test(t)) return null;
  if (/^<([a-z_-]+)(\s[^>]*)?>[\s\S]*<\/\1>$/i.test(t)) return null;
  return t || null;
}
const PATCH_FILE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm;
// The patch may sit inside JSON-encoded call arguments, where its line breaks are escaped.
const patchFiles = text => [...new Set([...String(text).replace(/\\n/g, '\n').matchAll(PATCH_FILE)].map(m => (m[1] ?? m[2]).trim().replace(/\\?"[,}\]]*$/, '')))];

/** Builds turns from (role, text, at, files) events: one user turn per prompt, then one reply with everything the tool said and
 * changed until the next prompt. */
function collector() {
  const turns = []; let reply = null;
  return {
    user(text, at) { const t = typed(text); if (!t) return; reply = null; turns.push({ role: 'user', at: at ?? null, text: t }); },
    reply(text, at, files = []) {
      const t = String(text ?? '').trim(); if (!t && !files.length) return;
      if (!reply) { reply = { role: 'assistant', at: at ?? null, text: '', files: [] }; turns.push(reply); }
      if (t) reply.text = reply.text ? `${reply.text}\n\n${t}` : t;
      for (const f of files) if (!reply.files.includes(f)) reply.files.push(f);
      if (at) reply.at = at;
    },
    turns
  };
}

/** Claude Code JSONL lines (each a JSON object) → meta and turns. Subagent (sidechain) lines and injected messages are left out. */
export function parseClaude(lines) {
  const c = collector(), meta = { cwd: null, branch: null, startedAt: null, title: null };
  for (const o of lines) {
    if (!o || typeof o !== 'object') continue;
    if (o.type === 'ai-title' && typeof o.aiTitle === 'string') meta.title = o.aiTitle;
    if (o.type === 'summary' && typeof o.summary === 'string' && !meta.title) meta.title = o.summary;
    if (o.isSidechain === true || (o.type !== 'user' && o.type !== 'assistant')) continue;
    if (typeof o.cwd === 'string' && !meta.cwd) meta.cwd = o.cwd;
    if (typeof o.gitBranch === 'string' && o.gitBranch && !meta.branch) meta.branch = o.gitBranch;
    const at = typeof o.timestamp === 'string' ? o.timestamp : null; if (at && !meta.startedAt) meta.startedAt = at;
    const content = o.message?.content;
    if (o.type === 'user') {
      if (o.isMeta === true || o.promptSource === 'system' || o.isCompactSummary === true) continue;
      if (Array.isArray(content) && content.some(b => b?.type === 'tool_result')) continue;
      c.user(textOf(content, ['text']), at);
    } else {
      const files = Array.isArray(content) ? content.filter(b => b?.type === 'tool_use' && ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(b.name))
        .map(b => b.input?.file_path ?? b.input?.notebook_path).filter(f => typeof f === 'string') : [];
      c.reply(textOf(content, ['text']), at, files);
    }
  }
  return { meta, turns: c.turns };
}

/** Codex rollout JSONL lines → meta and turns. Current files wrap each item ({type, payload}); early ones had the items bare. The
 * event stream (user_message / agent_message) is what the person saw; response items are read only when a file has no events. */
export function parseCodex(lines) {
  const meta = { cwd: null, branch: null, startedAt: null, title: null }, events = collector(), items = collector();
  let sawEvents = false;
  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') continue;
    const wrapped = typeof raw.type === 'string' && raw.payload && typeof raw.payload === 'object';
    const kind = wrapped ? raw.type : 'response_item', p = wrapped ? raw.payload : raw, at = typeof raw.timestamp === 'string' ? raw.timestamp : null;
    if (kind === 'session_meta' || (!wrapped && typeof raw.id === 'string' && typeof raw.instructions !== 'undefined')) {
      meta.cwd = typeof p.cwd === 'string' ? p.cwd : meta.cwd; meta.startedAt = typeof p.timestamp === 'string' ? p.timestamp : meta.startedAt;
      if (typeof p.git?.branch === 'string') meta.branch = p.git.branch;
      continue;
    }
    if (at && !meta.startedAt) meta.startedAt = at;
    if (kind === 'turn_context' && typeof p.cwd === 'string' && !meta.cwd) meta.cwd = p.cwd;
    if (kind === 'event_msg') {
      if (p.type === 'user_message' && typeof p.message === 'string') { sawEvents = true; events.user(p.message, at); }
      else if (p.type === 'agent_message' && typeof p.message === 'string') { sawEvents = true; events.reply(p.message, at); }
      continue;
    }
    if (kind !== 'response_item') continue;
    if (p.type === 'message' && p.role === 'user') items.user(textOf(p.content, ['input_text', 'text']), at);
    else if (p.type === 'message' && p.role === 'assistant') items.reply(textOf(p.content, ['output_text', 'text']), at);
    else if (p.type === 'custom_tool_call' || p.type === 'function_call') {
      const files = patchFiles(typeof p.input === 'string' ? p.input : typeof p.arguments === 'string' ? p.arguments : '');
      if (files.length) { events.reply('', at, files); items.reply('', at, files); }
    }
  }
  // A changed file seen before any event is kept with the events too (patches are only response items).
  return { meta, turns: sawEvents ? events.turns : items.turns };
}

async function readHead(path, bytes) {
  const h = await open(path, 'r');
  try { const buf = Buffer.alloc(bytes); const { bytesRead } = await h.read(buf, 0, bytes, 0); return buf.subarray(0, bytesRead).toString('utf8'); }
  finally { await h.close(); }
}
function jsonLines(text, partialLast) {
  const rows = text.split('\n'); if (partialLast) rows.pop();
  const out = []; for (const r of rows) { if (!r.trim()) continue; try { out.push(JSON.parse(r)); } catch { /* a damaged line is skipped */ } }
  return out;
}
async function readAll(path) {
  const out = [], rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const r of rl) { if (!r.trim()) continue; try { out.push(JSON.parse(r)); } catch { /* skipped */ } }
  return out;
}
async function dirs(path) { try { return (await readdir(path, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => join(path, d.name)); } catch { return []; } }
async function files(path, test) { try { return (await readdir(path, { withFileTypes: true })).filter(d => d.isFile() && test(d.name)).map(d => join(path, d.name)); } catch { return []; } }

/** The session files of each tool (no content read). Codex: sessions/YYYY/MM/DD only, the layout it writes. */
async function candidates(roots) {
  const out = [];
  if (roots.claude) for (const d of await dirs(join(roots.claude, 'projects'))) for (const f of await files(d, n => n.endsWith('.jsonl'))) out.push({ tool: 'claude', path: f });
  if (roots.codex) for (const y of await dirs(join(roots.codex, 'sessions'))) for (const m of await dirs(y)) for (const d of await dirs(m))
    for (const f of await files(d, n => /^rollout-.*\.jsonl$/.test(n))) out.push({ tool: 'codex', path: f });
  return out;
}
const shortPath = (file, cwd) => { if (!cwd || !isAbsolute(file)) return file; const r = relative(cwd, file); return r && !r.startsWith('..') && !isAbsolute(r) ? r.split(sep).join('/') : file; };

/**
 * The session service, or null when turned off (STUDIO_SESSIONS=off). roots default to the tools' own folders under the home
 * folder (CLAUDE_CONFIG_DIR / CODEX_HOME when set); a folder that does not exist simply lists nothing.
 */
export function openSessions({ env = process.env, home = homedir(), roots = null, limits = SESSION_LIMITS } = {}) {
  if (env.STUDIO_SESSIONS === 'off') return null;
  const where = roots ?? { claude: env.CLAUDE_CONFIG_DIR || join(home, '.claude'), codex: env.CODEX_HOME || join(home, '.codex') };
  let known = new Map(); // id -> { tool, path }
  const idOf = (tool, real) => `${tool}-${createHash('sha256').update(real).digest('hex').slice(0, 24)}`;

  async function list() {
    const found = [];
    for (const c of await candidates(where)) {
      try { const s = await stat(c.path); if (s.size > 0) found.push({ ...c, size: s.size, mtime: s.mtimeMs }); } catch { /* gone meanwhile */ }
    }
    found.sort((a, b) => b.mtime - a.mtime);
    const next = new Map(), out = [];
    for (const f of found) {
      if (out.length >= limits.list) break;
      let real; try { real = await realpath(f.path); } catch { continue; }
      let head; try { head = await readHead(real, limits.headBytes); } catch { continue; }
      const { meta, turns } = (f.tool === 'claude' ? parseClaude : parseCodex)(jsonLines(head, f.size > limits.headBytes));
      const first = turns.find(t => t.role === 'user'); if (!first) continue;
      const id = idOf(f.tool, real); next.set(id, { tool: f.tool, path: real });
      out.push({ id, tool: f.tool, title: meta.title ?? null, preview: first.text.replace(/\s+/g, ' ').slice(0, limits.preview), cwd: meta.cwd, branch: meta.branch,
        startedAt: meta.startedAt, updatedAt: new Date(f.mtime).toISOString(), bytes: f.size });
    }
    known = next;
    return { version: SESSION_VERSION, sessions: out };
  }

  async function read(id) {
    if (typeof id !== 'string' || !SESSION_ID.test(id)) throw new ApiError('SESSION_NOT_FOUND', 404);
    if (!known.has(id)) await list();
    const f = known.get(id); if (!f) throw new ApiError('SESSION_NOT_FOUND', 404);
    let size; try { size = (await stat(f.path)).size; } catch { throw new ApiError('SESSION_NOT_FOUND', 404); }
    if (size > limits.fileBytes) throw new ApiError('SESSION_TOO_LARGE', 413);
    const { meta, turns } = (f.tool === 'claude' ? parseClaude : parseCodex)(await readAll(f.path));
    // Newest first within the reply budget: the browser keeps the latest part when everything does not fit a record anyway.
    const kept = []; let used = 0;
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i], text = clip(t.text, limits.turnChars), files = (t.files ?? []).map(x => shortPath(x, meta.cwd));
      used += text.length + files.join('').length; if (used > limits.replyChars && kept.length) break;
      kept.unshift({ role: t.role, at: t.at, text, ...(t.role === 'assistant' ? { files } : {}) });
    }
    return { version: SESSION_VERSION, id, tool: f.tool, label: TOOL_LABEL[f.tool], title: meta.title, cwd: meta.cwd, branch: meta.branch, startedAt: meta.startedAt,
      turns: kept, omitted: turns.length - kept.length };
  }

  return { describe: () => ({ version: SESSION_VERSION, tools: Object.keys(where).filter(k => where[k]) }), list, read };
}
