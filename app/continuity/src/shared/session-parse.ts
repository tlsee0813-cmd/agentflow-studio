/* Reading Claude Code and Codex session files (JSONL) into turns: what the person typed and the tools' final replies, with the files
 * a reply changed. Pure, so the same reading serves the local server (server/sessions.mjs, from the tools' own folders) and the
 * browser (a folder the person picked, or one file they chose). Tool output, reasoning and injected context are left out.
 *   Claude Code: <~/.claude>/projects/<folder>/<session>.jsonl
 *   Codex:       <~/.codex>/sessions/YYYY/MM/DD/rollout-*.jsonl */
import type { SessionDetail, SessionSummary, SessionTurn } from './session-import.js';

export const SESSION_VERSION = 'sessions.1';
export const SESSION_LIMITS = Object.freeze({ list: 60, scan: 400, headBytes: 256 * 1024, fileBytes: 64 * 1024 * 1024, turnChars: 20000, replyChars: 300000, preview: 160 });
export type SessionLimits = typeof SESSION_LIMITS;
export const SESSION_ID = /^(claude|codex)-[0-9a-f]{24}$/;
export type SessionTool = 'claude' | 'codex';
const TOOL_LABEL: Record<SessionTool, string> = { claude: 'Claude Code', codex: 'Codex' };
export interface SessionMeta { cwd: string | null; branch: string | null; startedAt: string | null; title: string | null }
export interface ParsedSession { meta: SessionMeta; turns: SessionTurn[] }
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Text of a message content: a string, or the text parts of a list of blocks (tool calls, results and reasoning left out). */
function textOf(content: unknown, kinds: string[]): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(b => b && kinds.includes(b.type) && typeof b.text === 'string').map(b => b.text).join('\n\n');
}
const clip = (text: string, n: number) => (text.length > n ? `${text.slice(0, n)}\n…(이후 ${(text.length - n).toLocaleString()}자 생략)` : text);
/** What the person typed, without context a tool injects into the same message. Null when nothing typed is left. */
function typed(text: string): string | null {
  let t = String(text).replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  // Claude Code slash commands are stored as tags: kept as the command the person typed; their local output is not a prompt.
  const cmd = /^<command-name>([^<]*)<\/command-name>/.exec(t.replace(/^<command-message>[\s\S]*?<\/command-message>\s*/, ''));
  if (cmd) { const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(t)?.[1]?.trim(); t = `${cmd[1]!.trim()}${args ? ` ${args}` : ''}`; }
  if (/^<(local-command-[a-z]+|command-message)>/.test(t)) return null;
  // Context a tool puts in a user message (Codex environment_context, user_instructions, AGENTS.md…), or any message that is one
  // whole tagged block, is not a prompt.
  if (/^(<user_instructions>|<environment_context>|<turn_context>|<instructions>|<permissions|# AGENTS\.md instructions)/i.test(t)) return null;
  if (/^<([a-z_-]+)(\s[^>]*)?>[\s\S]*<\/\1>$/i.test(t)) return null;
  return t || null;
}
const PATCH_FILE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm;
// The patch may sit inside JSON-encoded call arguments, where its line breaks are escaped.
const patchFiles = (text: string) => [...new Set([...String(text).replace(/\\n/g, '\n').matchAll(PATCH_FILE)].map(m => (m[1] ?? m[2])!.trim().replace(/\\?"[,}\]]*$/, '')))];

/** Builds turns from (role, text, at, files) events: one user turn per prompt, then one reply with everything the tool said and
 * changed until the next prompt. */
function collector() {
  const turns: SessionTurn[] = []; let reply: (SessionTurn & { files: string[] }) | null = null;
  return {
    user(text: string, at: string | null) { const t = typed(text); if (!t) return; reply = null; turns.push({ role: 'user', at: at ?? null, text: t }); },
    reply(text: unknown, at: string | null, files: string[] = []) {
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
export function parseClaude(lines: unknown[]): ParsedSession {
  const c = collector(), meta: SessionMeta = { cwd: null, branch: null, startedAt: null, title: null };
  for (const o of lines as Row[]) {
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
        .map(b => b.input?.file_path ?? b.input?.notebook_path).filter((f): f is string => typeof f === 'string') : [];
      c.reply(textOf(content, ['text']), at, files);
    }
  }
  return { meta, turns: c.turns };
}

/** Codex rollout JSONL lines → meta and turns. Current files wrap each item ({type, payload}); early ones had the items bare. The
 * event stream (user_message / agent_message) is what the person saw; response items are read only when a file has no events. */
export function parseCodex(lines: unknown[]): ParsedSession {
  const meta: SessionMeta = { cwd: null, branch: null, startedAt: null, title: null }, events = collector(), items = collector();
  let sawEvents = false;
  for (const raw of lines as Row[]) {
    if (!raw || typeof raw !== 'object') continue;
    const wrapped = typeof raw.type === 'string' && raw.payload && typeof raw.payload === 'object';
    const kind = wrapped ? raw.type : 'response_item', p: Row = wrapped ? raw.payload : raw, at = typeof raw.timestamp === 'string' ? raw.timestamp : null;
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
export const parseSession = (tool: SessionTool, lines: unknown[]): ParsedSession => (tool === 'claude' ? parseClaude : parseCodex)(lines);

/** JSON lines of a file's text; a damaged line is skipped, and the last one too when the text was cut there (a head read). */
export function jsonLines(text: string, partialLast = false): unknown[] {
  const rows = text.split('\n'); if (partialLast) rows.pop();
  const out: unknown[] = []; for (const r of rows) { if (!r.trim()) continue; try { out.push(JSON.parse(r)); } catch { /* skipped */ } }
  return out;
}
/** Which tool wrote these lines, from their shape (a file chosen by hand carries no folder to tell). */
export function sniffTool(lines: unknown[]): SessionTool | null {
  for (const o of (lines as Row[]).slice(0, 50)) {
    if (!o || typeof o !== 'object') continue;
    if (typeof o.payload === 'object' && ['session_meta', 'response_item', 'event_msg', 'turn_context'].includes(o.type)) return 'codex';
    if (typeof o.instructions !== 'undefined' && typeof o.id === 'string') return 'codex';
    if ((o.type === 'user' || o.type === 'assistant') && o.message && typeof o.sessionId === 'string') return 'claude';
    if ((o.type === 'user' || o.type === 'assistant') && o.message) return 'claude';
  }
  return null;
}

/** Claude Code names a project's folder after its working folder, every character but letters and digits made '-'. */
export const claudeFolder = (cwd: string) => String(cwd).replace(/[^A-Za-z0-9]/g, '-');
/** Whether a session's working folder is the folder asked for or inside it. */
export function within(cwd: unknown, folder: string | null): boolean {
  if (typeof cwd !== 'string' || !folder) return false;
  const a = cwd.replace(/[\\/]+$/, ''), b = String(folder).replace(/[\\/]+$/, '');
  return a === b || a.startsWith(`${b}/`) || a.startsWith(`${b}\\`);
}
/** A changed file named relative to the session's working folder when it lies inside it (as the tool would show it). */
export function shortPath(file: string, cwd: string | null): string {
  if (!cwd) return file;
  const base = cwd.replace(/[\\/]+$/, '');
  if (!(file.startsWith(`${base}/`) || file.startsWith(`${base}\\`))) return file;
  return file.slice(base.length + 1).replace(/\\/g, '/');
}

/** A listing row of one parsed session head, or null when it holds no prompt. */
export function sessionSummary(id: string, tool: SessionTool, head: ParsedSession, updatedAt: string, bytes: number, limits: Pick<SessionLimits, 'preview'> = SESSION_LIMITS): SessionSummary | null {
  const first = head.turns.find(t => t.role === 'user'); if (!first) return null;
  return { id, tool, title: head.meta.title ?? null, preview: first.text.replace(/\s+/g, ' ').slice(0, limits.preview), cwd: head.meta.cwd, branch: head.meta.branch,
    startedAt: head.meta.startedAt, updatedAt, bytes };
}
/** A whole parsed session as sent to the page: newest turns within the reply budget (the earlier ones counted as omitted), each
 * turn clipped, changed files relative to the working folder. */
export function sessionDetail(id: string, tool: SessionTool, s: ParsedSession, limits: Pick<SessionLimits, 'turnChars' | 'replyChars'> = SESSION_LIMITS): SessionDetail & { version: string } {
  const kept: SessionTurn[] = []; let used = 0;
  for (let i = s.turns.length - 1; i >= 0; i--) {
    const t = s.turns[i]!, text = clip(t.text, limits.turnChars), files = (t.files ?? []).map(x => shortPath(x, s.meta.cwd));
    used += text.length + files.join('').length; if (used > limits.replyChars && kept.length) break;
    kept.unshift({ role: t.role, at: t.at, text, ...(t.role === 'assistant' ? { files } : {}) });
  }
  return { version: SESSION_VERSION, id, tool, label: TOOL_LABEL[tool], title: s.meta.title, cwd: s.meta.cwd, branch: s.meta.branch, startedAt: s.meta.startedAt,
    turns: kept, omitted: s.turns.length - kept.length };
}
/** An opaque session id from a stable name of its file (a real path on the server, a path inside the picked folder in the page). */
export async function sessionId(tool: SessionTool, name: string): Promise<string> {
  const bytes = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(name)));
  return `${tool}-${[...bytes.slice(0, 12)].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}
