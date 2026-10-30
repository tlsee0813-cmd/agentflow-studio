/* Reading Claude Code and Codex session files (JSONL) into turns: what the person typed and the tools' final replies, with the files
 * a reply changed. Pure, so the same reading serves the local server (server/sessions.mjs, from the tools' own folders) and the
 * browser (a folder the person picked, or one file they chose). Tool output, reasoning and injected context are left out.
 *   Claude Code: <~/.claude>/projects/<folder>/<session>.jsonl
 *   Codex:       <~/.codex>/sessions/YYYY/MM/DD/rollout-*.jsonl */
import type { SessionDetail, SessionSummary, SessionTurn } from './session-import.js';

export const SESSION_VERSION = 'sessions.1';
// fileBytes: a long agent session runs to hundreds of MB (tool output it never shows); it is read line by line, never held whole.
// headBytes is read to list a file; promptBytes when the head holds no prompt yet (a first prompt can carry pasted images);
// tailBytes from the end, for a working folder a long session moved to late.
export const SESSION_LIMITS = Object.freeze({ list: 60, scan: 400, headBytes: 256 * 1024, promptBytes: 8 * 1024 * 1024, tailBytes: 64 * 1024, fileBytes: 2 * 1024 * 1024 * 1024, turnChars: 20000, replyChars: 300000, preview: 160 });
export type SessionLimits = typeof SESSION_LIMITS;
export const SESSION_ID = /^(claude|codex)-[0-9a-f]{24}$/;
export type SessionTool = 'claude' | 'codex';
const TOOL_LABEL: Record<SessionTool, string> = { claude: 'Claude Code', codex: 'Codex' };
/** cwd: the working folder the session was last in; cwds: every one it worked in (a session can move to another folder).
 * thread / parent: Codex's own id of the session and, for a subagent it started, the id of the session that started it. */
export interface SessionMeta { cwd: string | null; cwds: string[]; branch: string | null; startedAt: string | null; title: string | null; thread: string | null; parent: string | null }
const newMeta = (): SessionMeta => ({ cwd: null, cwds: [], branch: null, startedAt: null, title: null, thread: null, parent: null });
export function atFolder(meta: SessionMeta, cwd: unknown) {
  if (typeof cwd !== 'string' || !cwd) return;
  meta.cwd = cwd; if (!meta.cwds.some(c => sameFolder(c, cwd))) meta.cwds.push(cwd);
}
/** changes: each time files were changed, with when (a subagent's are added to the session that started it). */
export interface ParsedSession { meta: SessionMeta; turns: SessionTurn[]; changes: FileChange[] }
interface FileChange { at: string | null; files: string[] }
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
  // Context a tool puts in a user message (Codex environment_context, user_instructions, AGENTS.md…) is not a prompt.
  if (/^(<user_instructions>|<environment_context>|<turn_context>|<instructions>|<permissions|# AGENTS\.md instructions)/i.test(t)) return null;
  // Whole tagged blocks at the start (one or several: <recommended_plugins>…</recommended_plugins><environment_context>…) are
  // context too; what is left after them is what was typed.
  for (let guard = 0; guard < 20; guard++) { const m = /^<([a-z_][\w-]*)(\s[^>]*)?>[\s\S]*?<\/\1>\s*/i.exec(t); if (!m) break; t = t.slice(m[0].length); }
  // Codex Desktop puts what it attached (browser state, files mentioned or pasted) under headings before '## My request:'.
  // The request may hold headings of its own, so it is everything after the first '## My request:'.
  const ask = t.indexOf('## My request:');
  if (ask >= 0 && /^#\s/.test(t)) t = t.slice(ask + '## My request:'.length).trim();
  return t || null;
}
const PATCH_FILE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm;
/** Files an apply_patch call changes: only the lines between its '*** Begin Patch' and '*** End Patch' (the patch may sit inside
 * JSON-encoded arguments, where its line breaks are escaped). A script that merely contains such text changes nothing here. */
function patchFiles(text: string): string[] {
  const t = String(text).replace(/\\r\\n|\\n/g, '\n').replace(/\\"/g, '"'), out: string[] = [];
  for (const block of t.matchAll(/\*\*\* Begin Patch\s*$([\s\S]*?)(?:^\*\*\* End Patch|$(?![\s\S]))/gm))
    for (const m of block[1]!.matchAll(PATCH_FILE)) { const f = (m[1] ?? m[2])!.trim().replace(/"[,}\]]*$/, ''); if (f && !out.includes(f)) out.push(f); }
  return out;
}
/** A tool call that applies a patch: Codex's apply_patch tool, or a shell call whose command is apply_patch. A script that runs
 * apply_patch among other things (Codex Desktop's exec) is not read: its FileChange item names the files. */
function patchCall(p: Row): string | null {
  const args = typeof p.input === 'string' ? p.input : typeof p.arguments === 'string' ? p.arguments : '';
  if (p.name === 'apply_patch') return args;
  if (typeof p.name === 'string' && /^(shell|local_shell|exec_command|container\.exec)$/.test(p.name) && /^\s*\{?\s*"?(command|cmd)"?\s*:\s*\[\s*"apply_patch"/.test(args)) return args;
  return null;
}

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
  const p = claudeParser(); for (const o of lines) p.push(o); return p.done();
}
/** The Claude Code reading, one line at a time (a long file is never held whole). */
export function claudeParser(): SessionParser {
  const c = collector(), meta = newMeta();
  const push = (o: Row) => {
    if (!o || typeof o !== 'object') return;
    if (o.type === 'ai-title' && typeof o.aiTitle === 'string') meta.title = o.aiTitle;
    if (o.type === 'summary' && typeof o.summary === 'string' && !meta.title) meta.title = o.summary;
    if (o.type === 'relocated') atFolder(meta, o.relocatedCwd);
    if (o.isSidechain === true || (o.type !== 'user' && o.type !== 'assistant')) return;
    atFolder(meta, o.cwd);
    if (typeof o.gitBranch === 'string' && o.gitBranch && !meta.branch) meta.branch = o.gitBranch;
    const at = typeof o.timestamp === 'string' ? o.timestamp : null; if (at && !meta.startedAt) meta.startedAt = at;
    const content = o.message?.content;
    if (o.type === 'user') {
      if (o.isMeta === true || o.promptSource === 'system' || o.isCompactSummary === true) return;
      if (Array.isArray(content) && content.some(b => b?.type === 'tool_result')) return;
      c.user(textOf(content, ['text']), at);
    } else {
      const files = Array.isArray(content) ? content.filter(b => b?.type === 'tool_use' && ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(b.name))
        .map(b => b.input?.file_path ?? b.input?.notebook_path).filter((f): f is string => typeof f === 'string') : [];
      c.reply(textOf(content, ['text']), at, files);
    }
  };
  return { push: o => push(o as Row), done: () => ({ meta, turns: c.turns, changes: [] }) };
}

/** What the person typed in a Codex user message. Codex Desktop tags each part of it (user.text, user.heartbeat,
 * environments.environment_context…): only typed text is kept, each part read on its own. */
function codexUserText(p: Row): string {
  const meta = p.internal_chat_message_metadata_passthrough, kinds = Array.isArray(meta?.content_item_kinds) ? meta.content_item_kinds : Array.isArray(p.content_item_kinds) ? p.content_item_kinds : null;
  if (!Array.isArray(p.content)) return textOf(p.content, ['input_text', 'text']);
  return p.content.map((b: Row, i: number) => (kinds && typeof kinds[i] === 'string' && kinds[i] !== 'user.text' ? null : typed(textOf([b], ['input_text', 'text']))))
    .filter((x: string | null): x is string => !!x).join('\n\n');
}
/** The files a Codex Desktop FileChange item changed: the keys of its changes, and where a moved file went. */
function changedFiles(item: Row): string[] {
  if (!item.changes || typeof item.changes !== 'object' || (item.status && item.status !== 'completed')) return [];
  const out: string[] = [];
  for (const [file, c] of Object.entries(item.changes as Record<string, Row>)) { out.push(file); if (typeof c?.move_path === 'string' && c.move_path) out.push(c.move_path); }
  return out;
}

/** Codex rollout JSONL lines → meta and turns. Current files wrap each item ({type, payload}); early ones had the items bare. The
 * event stream (user_message / agent_message) is what the person saw; response items are read only when a file has no events. */
export function parseCodex(lines: unknown[]): ParsedSession {
  const p = codexParser(); for (const o of lines) p.push(o); return p.done();
}
/** The Codex reading, one line at a time. */
export function codexParser(): SessionParser {
  const meta = newMeta(), events = collector(), items = collector(), changes: FileChange[] = [];
  let sawEvents = false;
  const changed = (at: string | null, files: string[]) => { if (!files.length) return; changes.push({ at, files }); events.reply('', at, files); items.reply('', at, files); };
  const push = (raw: Row) => {
    if (!raw || typeof raw !== 'object') return;
    const wrapped = typeof raw.type === 'string' && raw.payload && typeof raw.payload === 'object';
    const kind = wrapped ? raw.type : 'response_item', p: Row = wrapped ? raw.payload : raw, at = typeof raw.timestamp === 'string' ? raw.timestamp : null;
    if (kind === 'session_meta' || (!wrapped && typeof raw.id === 'string' && typeof raw.instructions !== 'undefined')) {
      atFolder(meta, p.cwd); meta.startedAt = typeof p.timestamp === 'string' ? p.timestamp : meta.startedAt;
      if (typeof p.git?.branch === 'string') meta.branch = p.git.branch;
      if (typeof p.id === 'string' && !meta.thread) meta.thread = p.id;
      const parent = p.parent_thread_id ?? p.source?.subagent?.thread_spawn?.parent_thread_id;
      if (typeof parent === 'string' && parent && !meta.parent) meta.parent = parent;
      return;
    }
    if (at && !meta.startedAt) meta.startedAt = at;
    if (kind === 'turn_context') atFolder(meta, p.cwd);
    if (kind === 'event_msg') {
      if (p.type === 'user_message' && typeof p.message === 'string') { sawEvents = true; events.user(p.message, at); }
      else if (p.type === 'agent_message' && typeof p.message === 'string') { sawEvents = true; events.reply(p.message, at); }
      else if (p.type === 'item_completed' && p.item?.type === 'FileChange') changed(at, changedFiles(p.item));
      return;
    }
    if (kind !== 'response_item') return;
    if (p.type === 'message' && p.role === 'user') items.user(codexUserText(p), at);
    else if (p.type === 'message' && p.role === 'assistant') items.reply(textOf(p.content, ['output_text', 'text']), at);
    else if (p.type === 'custom_tool_call' || p.type === 'function_call') {
      const args = patchCall(p); changed(at, args === null ? [] : patchFiles(args));
    }
  };
  // A changed file seen before any event is kept with the events too (patches are only response items).
  return { push: o => push(o as Row), done: () => ({ meta, turns: sawEvents ? events.turns : items.turns, changes }) };
}
export interface SessionParser { push(line: unknown): void; done(): ParsedSession }
export const parseSession = (tool: SessionTool, lines: unknown[]): ParsedSession => (tool === 'claude' ? parseClaude : parseCodex)(lines);
export const sessionParser = (tool: SessionTool): SessionParser => (tool === 'claude' ? claudeParser : codexParser)();
/** One JSON line into a parser (blank or damaged lines are skipped). */
export function pushLine(parser: SessionParser, line: string) { if (!line.trim()) return; try { parser.push(JSON.parse(line)); } catch { /* skipped */ } }

/** Working folders named in the last lines of a file (text read from somewhere inside it: its first, cut line is skipped). */
export function tailFolders(text: string): string[] {
  const out: string[] = [];
  for (const o of jsonLines(text.slice(text.indexOf('\n') + 1)) as Row[])
    for (const c of [o?.cwd, o?.relocatedCwd, o?.payload?.cwd]) if (typeof c === 'string' && c && !out.some(x => sameFolder(x, c))) out.push(c);
  return out;
}
/** Whether a parsed head holds a prompt (a listing row needs one). */
export const hasPrompt = (s: ParsedSession) => s.turns.some(t => t.role === 'user');

/** A session with the files its subagents changed, each put in the reply to the prompt that was running when it changed them
 * (a subagent's own messages are left out: the session that started it says what came of them). */
export function withSubagents(s: ParsedSession, subagents: ParsedSession[]): ParsedSession {
  const turns = s.turns.map(t => (t.role === 'assistant' ? { ...t, files: [...(t.files ?? [])] } : t));
  for (const c of subagents.flatMap(x => x.changes)) {
    let u = -1;
    for (let i = 0; i < turns.length; i++) if (turns[i]!.role === 'user' && (!c.at || !turns[i]!.at || turns[i]!.at! <= c.at)) u = i;
    if (u < 0) continue;
    let r = turns[u + 1];
    if (!r || r.role !== 'assistant') { r = { role: 'assistant', at: c.at, text: '', files: [] }; turns.splice(u + 1, 0, r); }
    for (const f of c.files) if (!r.files!.includes(f)) r.files!.push(f);
  }
  return { ...s, turns, changes: [...s.changes, ...subagents.flatMap(x => x.changes)] };
}

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
/** A folder path compared as Windows does when it is a Windows path (either separator, any letter case), else as written. */
function folderKey(path: string): string {
  const t = String(path).replace(/\\/g, '/').replace(/\/+$/, '');
  return /^[a-z]:(\/|$)/i.test(t) || t.startsWith('//') ? t.toLowerCase() : t;
}
const sameFolder = (a: string, b: string) => folderKey(a) === folderKey(b);
/** Whether a session's working folder (any of them, when it moved) is the folder asked for or inside it. */
export function within(cwd: unknown, folder: string | null): boolean {
  if (!folder) return false;
  const list = Array.isArray(cwd) ? cwd : [cwd], b = folderKey(folder);
  return list.some(c => typeof c === 'string' && (folderKey(c) === b || folderKey(c).startsWith(`${b}/`)));
}
/** A changed file named relative to the session's working folder when it lies inside it (as the tool would show it). */
export function shortPath(file: string, cwd: string | null): string {
  if (!cwd) return file;
  const f = file.replace(/\\/g, '/'), base = folderKey(cwd), key = folderKey(f);
  return key.startsWith(`${base}/`) ? f.slice(base.length + 1) : file;
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
    const t = s.turns[i]!, text = clip(t.text, limits.turnChars), files = [...new Set((t.files ?? []).map(x => shortPath(x, s.meta.cwds.find(c => shortPath(x, c) !== x) ?? s.meta.cwd)))];
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
