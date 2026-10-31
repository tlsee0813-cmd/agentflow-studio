/* Reading Claude Code and Codex session files (JSONL) into turns: what the person typed and the tools' final replies, with the files
 * a reply changed. Pure, so the same reading serves the local server (server/sessions.mjs, from the tools' own folders) and the
 * browser (a folder the person picked, or one file they chose). Tool output, reasoning and injected context are left out.
 *   Claude Code: <~/.claude>/projects/<folder>/<session>.jsonl
 *   Codex:       <~/.codex>/sessions/YYYY/MM/DD/rollout-*.jsonl */
import type { SessionDetail, SessionSummary, SessionTurn } from './session-import.js';
import { foldHandover, quoteReceived } from './handover-mark.js';
import { redactSecrets } from './secret.js';

export const SESSION_VERSION = 'sessions.1';
// fileBytes: a long agent session runs to hundreds of MB (tool output it never shows); it is read line by line, never held whole.
// headBytes is read to list a file; promptBytes when the head holds no prompt yet (a first prompt can carry pasted images);
// tailBytes from the end, for a working folder a long session moved to late. lineBytes: a longer line (a damaged file, a huge
// paste) is skipped whole rather than built into a string past what the runtime can hold; a turn is clipped far below it anyway.
export const SESSION_LIMITS = Object.freeze({ list: 60, scan: 400, headBytes: 256 * 1024, promptBytes: 8 * 1024 * 1024, tailBytes: 64 * 1024, fileBytes: 2 * 1024 * 1024 * 1024, lineBytes: 64 * 1024 * 1024, turnChars: 20000, replyChars: 300000, preview: 160 });
export type SessionLimits = typeof SESSION_LIMITS;
export const SESSION_ID = /^(claude|codex)-[0-9a-f]{24}$/;
export type SessionTool = 'claude' | 'codex';
/** Each tool's name as the person knows it: in record headers, the session list and a reading's label (sessionDetail). */
export const TOOL_NAME: Record<SessionTool, string> = { claude: 'Claude Code', codex: 'Codex' };
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
/** Tags Claude Code and Codex (CLI, IDE and Desktop) put in a user message with what was typed. Only these are context: a prompt
 * that starts with other markup (HTML, JSX, XML the person pasted) is kept as typed. */
const INJECTED = /^(system-reminder|command-[a-z]+|local-command-[a-z]+|bash-[a-z]+|user-prompt-submit-hook|user-memory-input|ide_[a-z_]+|task-notification|environment_context|user_instructions|turn_context|turn_aborted|user_action|user_shell_command|recommended_plugins|in-app-browser-context|image|skill|instructions|permissions)$/i;
/** Messages that are context as a whole (Codex environment, AGENTS.md and permissions), even when their block is not closed. */
const CONTEXT = /^(<(user_instructions|environment_context|turn_context|instructions|permissions)[\s>]|# AGENTS\.md instructions)/i;
const XML_CHAR: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const unxml = (t: string) => t.replace(/&(?:(lt|gt|amp|quot|apos)|#(\d{1,7})|#x([0-9a-f]{1,6}));/gi, (m, name: string | undefined, dec: string | undefined, hex: string | undefined) => {
  if (name) return XML_CHAR[name.toLowerCase()]!;
  const code = dec ? Number(dec) : parseInt(hex!, 16);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
});
/** A session a Claude project drives (one of its threads, or Remote Control on the person's computer) gets each message in a wake
 * envelope, after the project's <session-context nonce="…"> (closed by the same nonce) and before another Claude's <relay>:
 * <wake reason="…"><project …><thread …><message trigger="true" from="human" …>what they wrote</message></thread></project>
 * <system-note>…</system-note></wake>, the words escaped as XML. Only a message that shape is unwrapped: a prompt that merely
 * starts with a wake tag or a session-context, or goes on after one, is kept as typed. The end of the wake, or -1. */
const WAKE = /^<wake reason="[^"<>]*"[^<>]*>\s*<project\s[^<>]*>\s*<thread\s[^<>]*>/;
function wakeEnd(t: string): number {
  if (!WAKE.test(t)) return -1;
  // A relay after it can quote a wake tag of its own: the wake ends where the relay starts.
  const r = t.search(/<\/wake>\s*<relay\s/), tail = r >= 0 ? t.slice(r + 7).trim() : '';
  if (r >= 0 && tail.endsWith('</relay>')) return r;
  const e = t.lastIndexOf('</wake>'); return e >= 0 && !t.slice(e + 7).trim() ? e : -1;
}
/** What follows the project's context at the start of a message (closed by the tag with its own nonce), or null. */
function afterContext(t: string): string | null {
  const open = /^<session-context\s[^<>]*?\bnonce="([^"<>]*)"[^<>]*>/.exec(t); if (!open) return null;
  const shut = new RegExp(`</session-context\\s[^<>]*?\\bnonce="${open[1]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^<>]*>`).exec(t.slice(open[0].length));
  return shut ? t.slice(open[0].length + shut.index + shut[0].length).trim() : null;
}
/** The prompt in a wake: what the person wrote in the message that woke the session (others are shown with it as context). A wake
 * that carries none (a status, another Claude's message, a system note) is not a prompt. Read by position, so a long message is
 * read once whatever it holds. */
function woken(t: string, end: number): string | null {
  const said: string[] = [];
  for (let i = t.indexOf('<message'); i >= 0 && i < end; i = t.indexOf('<message', i + 1)) {
    const open = t.indexOf('>', i); if (open < 0 || open > end) break;
    const attrs = t.slice(i + 8, open);
    if (!/^(\s|$)/.test(attrs) || attrs.endsWith('/')) { i = open; continue; }
    const close = t.indexOf('</message>', open); if (close < 0 || close > end) break;
    if (/\strigger="true"/.test(attrs) && /\sfrom="human"/.test(attrs)) said.push(unxml(t.slice(open + 1, close)).trim());
    i = close;
  }
  return said.filter(Boolean).join('\n\n') || null;
}
const REMINDER_END = '</system-reminder>';
/** What the person typed, without context a tool injects into the same message. Null when nothing typed is left. */
function typed(text: string): string | null {
  // Reminders end where the last one closes: an opening tag after it is not searched to the end again for each one.
  const raw = String(text), last = raw.lastIndexOf(REMINDER_END) + REMINDER_END.length;
  let t = (last >= REMINDER_END.length ? raw.slice(0, last).replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '') + raw.slice(last) : raw).trim();
  // Claude Code slash commands are stored as tags: kept as the command the person typed; their local output is not a prompt.
  const cmd = /^<command-name>([^<]*)<\/command-name>/.exec(t.replace(/^<command-message>[\s\S]*?<\/command-message>\s*/, ''));
  if (cmd) {
    const a = t.indexOf('<command-args>'), b = a >= 0 ? t.indexOf('</command-args>', a) : -1, args = b >= 0 ? t.slice(a + 14, b).trim() : '';
    t = `${cmd[1]!.trim()}${args ? ` ${args}` : ''}`;
  }
  if (/^<(local-command-[a-z]+|command-message)>/.test(t)) return null;
  // Whole injected blocks at the start (one or several: <recommended_plugins>…</recommended_plugins><environment_context>…) are
  // context too; what is left after them is what was typed.
  for (let guard = 0; guard < 20; guard++) {
    const m = /^<([a-z_][\w-]*)(\s[^>]*)?>[\s\S]*?<\/\1(\s[^<>]*)?>\s*/i.exec(t); if (!m || !INJECTED.test(m[1]!)) break; t = t.slice(m[0].length);
  }
  const inWake = afterContext(t) ?? t, end = wakeEnd(inWake);
  if (end >= 0) return woken(inWake, end);
  // Context a tool puts in a user message of its own (Codex environment_context, user_instructions, AGENTS.md…) is not a prompt,
  // nor is a lone opening or closing tag a tool wraps an attachment in (Codex CLI's <image name=[Image #1]> … </image>).
  const lone = /^<\/?([a-z_][\w-]*)(\s[^>]*)?>$/i.exec(t);
  if (CONTEXT.test(t) || (lone && INJECTED.test(lone[1]!))) return null;
  // Codex Desktop and the IDE extension put what they attached (browser state, files mentioned or pasted, open tabs) under
  // headings before '## My request:' ('## My request for Codex:'). The request may hold headings of its own, so it is everything
  // after the first such line.
  const ask = /^## My request(?: for Codex)?:/m.exec(t);
  if (ask && /^#\s/.test(t)) t = t.slice(ask.index + ask[0].length).trim();
  return t || null;
}
const PATCH_FILE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm;
/** Files a patch changes: only the lines between its '*** Begin Patch' and '*** End Patch'. */
function patchFiles(text: string): string[] {
  const out: string[] = [];
  for (const block of String(text).matchAll(/\*\*\* Begin Patch\s*$([\s\S]*?)(?:^\*\*\* End Patch|$(?![\s\S]))/gm))
    for (const m of block[1]!.matchAll(PATCH_FILE)) { const f = (m[1] ?? m[2])!.trim().replace(/"[,}\]]*$/, ''); if (f && !out.includes(f)) out.push(f); }
  return out;
}
/** JSON string escapes undone, for arguments that are not whole JSON (a Windows path's backslash stays one backslash). */
const unescaped = (t: string) => t.replace(/\\(?:r\\n|[n"\\/t])/g, m => ({ '"': '"', '\\': '\\', '/': '/', t: '\t' } as Record<string, string>)[m.slice(-1)] ?? '\n');
/** The patch of a tool call that applies one: Codex's apply_patch tool (its raw input as it is, or JSON arguments), or a shell call
 * that runs apply_patch (a command list or string, a heredoc too, its arguments in any order). A script that runs apply_patch
 * among other things (Codex Desktop's exec) is not read: its FileChange item names the files; nor is a command that merely holds
 * patch text without running apply_patch. */
function patchText(p: Row): string | null {
  const name = typeof p.name === 'string' ? p.name : p.type === 'local_shell_call' ? 'local_shell' : '';
  if (name !== 'apply_patch' && !/^(shell|local_shell|shell_command|exec_command|container\.exec)$/.test(name)) return null;
  let text = typeof p.input === 'string' ? p.input : '', args: Row | null = p.action && typeof p.action === 'object' ? p.action : null;
  if (typeof p.input !== 'string' && !args && typeof p.arguments === 'string') try { args = JSON.parse(p.arguments); } catch { text = unescaped(p.arguments); }
  if (typeof p.input !== 'string' && args && typeof args === 'object') text = ['input', 'patch', 'command', 'cmd'].flatMap(k => args![k]).filter((x): x is string => typeof x === 'string').join('\n');
  return name === 'apply_patch' || /(^|[\s;&|(])apply_patch\b[\s\S]*\*\*\* Begin Patch/.test(text) ? text : null;
}

/** Builds turns from (role, text, at, files) events: one user turn per prompt (already read as typed), then one reply with
 * everything the tool said and changed until the next prompt. A reply keeps the time of its first piece, so it stays the same
 * turn while it grows (what was taken of it is known by that time). */
function collector() {
  const turns: SessionTurn[] = []; let reply: (SessionTurn & { files: string[] }) | null = null;
  return {
    user(t: string | null, at: string | null) { if (!t) return; reply = null; turns.push({ role: 'user', at: at ?? null, text: t }); },
    reply(text: unknown, at: string | null, files: string[] = []) {
      const t = String(text ?? '').trim(); if (!t && !files.length) return;
      if (!reply) { reply = { role: 'assistant', at: at ?? null, text: '', files: [] }; turns.push(reply); }
      if (t) reply.text = reply.text ? `${reply.text}\n\n${t}` : t;
      for (const f of files) if (!reply.files.includes(f)) reply.files.push(f);
      if (at && !reply.at) reply.at = at;
    },
    turns
  };
}

/** Claude Code JSONL lines (each a JSON object) → meta and turns. Subagent (sidechain) messages and injected ones are left out;
 * the files a subagent changed join the reply it worked for. */
export function parseClaude(lines: unknown[]): ParsedSession {
  const p = claudeParser(); for (const o of lines) p.push(o); return p.done();
}
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
const ISO_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/, DAY_MS = 24 * 60 * 60 * 1000, INTERRUPTED = /^\[Request interrupted by user[^\]]*\]$/;
/** The Claude Code reading, one line at a time (a long file is never held whole). */
export function claudeParser(): SessionParser {
  const c = collector(), meta = newMeta(), changes: FileChange[] = [], edits = new Map<string, FileChange>();
  const changed = (e: FileChange) => { changes.push(e); c.reply('', e.at, e.files); };
  let latest = ''; // the latest time a line was written with, in Claude Code's own form (so times compare as strings)
  const push = (o: Row) => {
    if (!o || typeof o !== 'object') return;
    const was = latest; if (typeof o.timestamp === 'string' && ISO_TIME.test(o.timestamp) && o.timestamp > latest) latest = o.timestamp;
    if (o.type === 'ai-title' && typeof o.aiTitle === 'string') meta.title = o.aiTitle;
    if (o.type === 'summary' && typeof o.summary === 'string' && !meta.title) meta.title = o.summary;
    if (o.type === 'relocated') atFolder(meta, o.relocatedCwd);
    // A branch (/branch, --fork-session, /fork) starts with a copy of the session it came from, each row naming where it came from:
    // what that session said is its own, not this one's.
    if (o.forkedFrom && typeof o.forkedFrom === 'object') return;
    if (o.type !== 'user' && o.type !== 'assistant' && !(o.type === 'attachment' && o.attachment?.type === 'queued_command')) return;
    const at = typeof o.timestamp === 'string' ? o.timestamp : null, content = o.message?.content, blocks: Row[] = Array.isArray(content) ? content.filter(b => b && typeof b === 'object') : [];
    // An edit counts once its result came back without an error: one the person refused, or that failed, changed nothing. A
    // subagent's edits count too (its own messages do not).
    for (const b of blocks) {
      const file = b.input?.file_path ?? b.input?.notebook_path, done = typeof b.tool_use_id === 'string' ? edits.get(b.tool_use_id) : undefined;
      if (o.type === 'assistant' && b.type === 'tool_use' && EDIT_TOOLS.includes(b.name) && typeof file === 'string') { if (typeof b.id === 'string') edits.set(b.id, { at, files: [file] }); else changed({ at, files: [file] }); }
      if (o.type === 'user' && b.type === 'tool_result' && done) { edits.delete(b.tool_use_id); if (b.is_error !== true && !/^\s*<tool_use_error>/.test(textOf(b.content, ['text']))) changed(done); }
    }
    if (o.isSidechain === true) return;
    atFolder(meta, o.cwd);
    if (typeof o.gitBranch === 'string' && o.gitBranch && !meta.branch) meta.branch = o.gitBranch;
    if (at && !meta.startedAt) meta.startedAt = at;
    if (o.type === 'attachment') {
      // What the person sends while the tool is still working is kept as a queued command, not a user message. A background
      // task's notice and messages from other sources are queued the same way, told apart by their mode, origin or isMeta. The
      // row keeps the time it was sent but is written when the tool reads it, after the work done meanwhile: it is timed just
      // after that work (each one read together a millisecond after the one before), so it stays in order and is not taken as
      // older than a mark set during the work. A time far from the line before (a clock set wrong) is left as it is.
      const q = o.attachment;
      if ((q.commandMode ?? 'prompt') !== 'prompt' || q.isMeta === true || (q.origin && q.origin.kind !== 'human')) return;
      const late = was && (!at || (ISO_TIME.test(at) && at <= was && Date.parse(was) - Date.parse(at) < DAY_MS));
      const when = late ? new Date(Date.parse(was) + 1).toISOString() : at;
      if (late && when! > latest) latest = when!;
      c.user(typed(textOf(q.prompt, ['text'])), when);
    } else if (o.type === 'user') {
      if (o.isMeta === true || o.promptSource === 'system' || o.isCompactSummary === true) return;
      if (blocks.some(b => b.type === 'tool_result')) return;
      // Pressing Esc leaves a row of Claude Code's own ('[Request interrupted by user]', '… for tool use'): not a request.
      const t = typed(textOf(content, ['text'])); if (t && INTERRUPTED.test(t)) return;
      c.user(t, at);
    } else c.reply(textOf(content, ['text']), at);
  };
  return { push: o => push(o as Row), done: () => ({ meta, turns: c.turns, changes }) };
}

/** What the person typed in a Codex user message. Codex Desktop tags each part of it (user.text, user.heartbeat,
 * environments.environment_context…): only typed text is kept, each part read on its own. */
function codexUserText(p: Row): string | null {
  const meta = p.internal_chat_message_metadata_passthrough, kinds = Array.isArray(meta?.content_item_kinds) ? meta.content_item_kinds : Array.isArray(p.content_item_kinds) ? p.content_item_kinds : null;
  if (!Array.isArray(p.content)) return typed(textOf(p.content, ['input_text', 'text']));
  return p.content.map((b: Row, i: number) => (kinds && typeof kinds[i] === 'string' && kinds[i] !== 'user.text' ? null : typed(textOf([b], ['input_text', 'text']))))
    .filter((x: string | null): x is string => !!x).join('\n\n') || null;
}
/** The files a Codex Desktop FileChange item changed: the keys of its changes, and where a moved file went. */
function changedFiles(item: Row): string[] {
  if (!item.changes || typeof item.changes !== 'object' || (item.status && item.status !== 'completed')) return [];
  const out: string[] = [];
  for (const [file, c] of Object.entries(item.changes as Record<string, Row>)) { out.push(file); if (typeof c?.move_path === 'string' && c.move_path) out.push(c.move_path); }
  return out;
}

/** Codex rollout JSONL lines → meta and turns. Current files wrap each item ({type, payload}); early ones had the items bare. The
 * CLI writes each prompt and reply twice, as an event (user_message / agent_message: what the person saw) and as a response item;
 * Codex Desktop and the IDE extension write response items only, and one thread can be continued in either. So each prompt is
 * read once, its reply from the events where the CLI wrote it and from the response items where it did not. */
export function parseCodex(lines: unknown[]): ParsedSession {
  const p = codexParser(); for (const o of lines) p.push(o); return p.done();
}
/** One prompt of a Codex file (null before the first) and what came after it: reply pieces from either stream, files changed. */
interface Piece { from: 'item' | 'event' | 'file'; text: string; at: string | null; files: string[] }
interface Stretch { user: SessionTurn | null; item: boolean; event: boolean; pieces: Piece[] }
const flat = (t: string) => t.replace(/\s+/g, ' ').trim();
/** The Codex reading, one line at a time. */
export function codexParser(): SessionParser {
  const meta = newMeta(), stretches: Stretch[] = [], changes: FileChange[] = [];
  const piece = (from: Piece['from'], text: string, at: string | null, files: string[] = []) => {
    if (!stretches.length) stretches.push({ user: null, item: false, event: false, pieces: [] });
    const x = { from, text, at, files }; stretches.at(-1)!.pieces.push(x); return x;
  };
  // The CLI writes a prompt as a response item and as an event, one right after the other: one prompt, in the event's words.
  const prompt = (text: string | null, at: string | null, event: boolean) => {
    if (!text) return;
    const s = stretches.at(-1), a = s?.user ? flat(s.user.text) : '', b = flat(text);
    if (s?.user && !s.pieces.length && (event ? s.item && !s.event : s.event && !s.item) && (a.includes(b) || b.includes(a))) {
      if (event) { s.event = true; s.user.text = text; } else s.item = true;
      return;
    }
    stretches.push({ user: { role: 'user', at, text }, item: !event, event, pieces: [] });
  };
  const changed = (at: string | null, files: string[]) => { if (!files.length) return null; const change = { at, files }; changes.push(change); return { change, piece: piece('file', '', at, files) }; };
  // A patch's files are held by its call until Codex says how it went: one the person declined, or that failed, changed nothing.
  const calls = new Map<string, { change: FileChange; piece: Piece }>();
  const outcome = (id: unknown, done: boolean) => {
    const c = typeof id === 'string' ? calls.get(id) : undefined; if (!c) return;
    calls.delete(id as string); if (done) return;
    c.piece.files = []; changes.splice(changes.indexOf(c.change), 1);
  };
  // A fork (and a subagent started with its parent's history) begins with a copy of the conversation it came from, each line
  // stamped when it was copied: none of it is this session's own. The copy ends at the fork's own settings line, or in files from
  // before Codex wrote one at the first pause (a copy is written at once). A paginated subagent names the first line of its own.
  let copy = false, copiedAt = NaN, ownFrom = -1;
  const push = (raw: Row) => {
    if (!raw || typeof raw !== 'object') return;
    const wrapped = typeof raw.type === 'string' && raw.payload && typeof raw.payload === 'object';
    const kind = wrapped ? raw.type : 'response_item', p: Row = wrapped ? raw.payload : raw, at = typeof raw.timestamp === 'string' ? raw.timestamp : null;
    if (copy) {
      const t = at ? Date.parse(at) : NaN;
      if (kind === 'event_msg' && p.type === 'thread_settings_applied' && p.thread_id === meta.thread) { copy = false; return; }
      if (Number.isFinite(t) && !(t - copiedAt > 1000)) { copiedAt = t; return; }
      copy = false;
    }
    if (kind === 'session_meta' || (!wrapped && typeof raw.id === 'string' && typeof raw.instructions !== 'undefined')) {
      // The first line of the session the copy came from (it names another thread) says nothing of this one.
      if (meta.thread && typeof p.id === 'string' && p.id !== meta.thread) { copy = true; copiedAt = at ? Date.parse(at) : NaN; return; }
      atFolder(meta, p.cwd); meta.startedAt = typeof p.timestamp === 'string' ? p.timestamp : meta.startedAt;
      if (typeof p.git?.branch === 'string') meta.branch = p.git.branch;
      if (typeof p.id === 'string' && !meta.thread) meta.thread = p.id;
      const parent = p.parent_thread_id ?? p.source?.subagent?.thread_spawn?.parent_thread_id;
      if (typeof parent === 'string' && parent && !meta.parent) meta.parent = parent;
      if (typeof p.forked_from_id === 'string' && p.forked_from_id) copy = true;
      if (typeof p.subagent_history_start_ordinal === 'number') ownFrom = p.subagent_history_start_ordinal;
      return;
    }
    if (typeof raw.ordinal === 'number' && raw.ordinal < ownFrom) return;
    if (at && !meta.startedAt) meta.startedAt = at;
    if (kind === 'turn_context') atFolder(meta, p.cwd);
    if (kind === 'event_msg') {
      if (p.type === 'user_message' && typeof p.message === 'string') prompt(typed(p.message), at, true);
      else if (p.type === 'agent_message' && typeof p.message === 'string') piece('event', p.message, at);
      else if (p.type === 'patch_apply_end') outcome(p.call_id, p.success !== false && (!p.status || p.status === 'completed'));
      else if (p.type === 'item_completed' && p.item?.type === 'FileChange') { outcome(p.item.id, !p.item.status || p.item.status === 'completed'); changed(at, changedFiles(p.item)); }
      return;
    }
    if (kind !== 'response_item') return;
    if (p.type === 'message' && p.role === 'user') prompt(codexUserText(p), at, false);
    else if (p.type === 'message' && p.role === 'assistant') piece('item', textOf(p.content, ['output_text', 'text']), at);
    else if (p.type === 'custom_tool_call' || p.type === 'function_call' || p.type === 'local_shell_call') {
      const patch = patchText(p), held = changed(at, patch === null ? [] : patchFiles(patch));
      if (held && typeof p.call_id === 'string') calls.set(p.call_id, held);
    }
  };
  const done = (): ParsedSession => {
    const c = collector();
    for (const s of stretches) {
      c.user(s.user?.text ?? null, s.user?.at ?? null);
      // The events where the CLI wrote the prompt; else the response items (a stray event does not hide them), or the events when
      // they are all there is. Changed files are kept from both (patches are only response items).
      const from = s.event || !s.pieces.some(x => x.from === 'item' && x.text.trim()) ? 'event' : 'item';
      for (const x of s.pieces) if (x.from === from || x.from === 'file') c.reply(x.text, x.at, x.files);
    }
    return { meta, turns: c.turns, changes };
  };
  return { push: o => push(o as Row), done };
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
 * (a subagent's own messages are left out: the session that started it says what came of them). A reply keeps the time of its
 * first piece, a subagent's change among them, so it stays the same turn whichever was written first. */
export function withSubagents(s: ParsedSession, subagents: ParsedSession[]): ParsedSession {
  const turns = s.turns.map(t => (t.role === 'assistant' ? { ...t, files: [...(t.files ?? [])] } : t));
  for (const c of subagents.flatMap(x => x.changes)) {
    let u = -1;
    for (let i = 0; i < turns.length; i++) if (turns[i]!.role === 'user' && (!c.at || !turns[i]!.at || turns[i]!.at! <= c.at)) u = i;
    if (u < 0) continue;
    let r = turns[u + 1];
    if (!r || r.role !== 'assistant') { r = { role: 'assistant', at: c.at, text: '', files: [] }; turns.splice(u + 1, 0, r); }
    // A reply keeps the time it had: a subagent's change that comes back late (an approval) must not move it before a mark.
    else if (c.at && !r.at) r.at = c.at;
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
    if ((o.type === 'user' || o.type === 'assistant') && o.message) return 'claude';
  }
  return null;
}

/** A folder path compared as Windows does when it is a Windows path (either separator, any letter case), else as written. */
const windows = (t: string) => /^[a-z]:(\/|$)/i.test(t) || t.startsWith('//');
function folderKey(path: string): string {
  const t = String(path).replace(/\\/g, '/').replace(/\/+$/, '');
  return windows(t) ? t.toLowerCase() : t;
}
export const sameFolder = (a: string, b: string) => folderKey(a) === folderKey(b);
/** Whether a session's working folder (any of them, when it moved) is the folder asked for or inside it. */
export function within(cwd: unknown, folder: string | null): boolean {
  if (!folder) return false;
  const list = Array.isArray(cwd) ? cwd : [cwd], b = folderKey(folder);
  return list.some(c => typeof c === 'string' && (folderKey(c) === b || folderKey(c).startsWith(`${b}/`)));
}
/** A changed file named relative to the session's working folder when it lies inside it (as the tool would show it). A relative
 * name a Windows session wrote with backslashes (a patch) is shown with '/', as the files made relative here are. */
export function shortPath(file: string, cwd: string | null): string {
  if (!cwd) return file;
  const f = file.replace(/\\/g, '/'), base = folderKey(cwd), key = folderKey(f);
  return key.startsWith(`${base}/`) ? f.slice(base.length + 1) : windows(base) && !/^([a-z]:|\/)/i.test(f) ? f : file;
}
/** A changed file as a session names it: from the first of its working folders that holds it, else from the one it was last in. */
export const changedPath = (file: string, s: { cwd: string | null; cwds?: string[] }) => shortPath(file, (s.cwds ?? []).find(c => shortPath(file, c) !== file) ?? s.cwd);

/** What names a session whatever folder its file was found through, or moved to (Codex archives old threads): Claude Code names
 * each file after its session id, Codex writes its thread id in the first line (an early file without one goes by its name). The
 * server and the page make the same id of it (sessionId), so marks taken through one hold for the other. */
export function sessionKey(tool: SessionTool, meta: Pick<SessionMeta, 'thread'>, fileName: string): string {
  const base = String(fileName).split(/[\\/]/).pop()!.replace(/\.jsonl$/i, '');
  return `${tool}:${tool === 'codex' && meta.thread ? meta.thread : base}`;
}

/** A listing row of one parsed session head, or null when it holds no prompt. The first prompt is shown as a record shows it: a
 * handover document it starts with named in words (so the person's own words follow), credential-like parts hidden. */
export function sessionSummary(id: string, tool: SessionTool, head: ParsedSession, updatedAt: string, bytes: number, limits: Pick<SessionLimits, 'preview'> = SESSION_LIMITS): SessionSummary | null {
  const first = head.turns.find(t => t.role === 'user'); if (!first) return null;
  // Only the start is shown: a huge first prompt is not weighed whole at each look.
  const preview = redactSecrets(quoteReceived(first.text).slice(0, 4000)).text.replace(/\s+/g, ' ').trim().slice(0, limits.preview);
  return { id, tool, title: head.meta.title ? redactSecrets(head.meta.title).text : null, preview, cwd: head.meta.cwd, branch: head.meta.branch,
    startedAt: head.meta.startedAt, updatedAt, bytes };
}
/** A whole parsed session as sent to the page: newest turns within the reply budget (the earlier ones counted as omitted), each
 * turn clipped, changed files relative to the working folder. since: only turns from that time on (a turn with no time is kept),
 * oldest first within the budget, so a reading from a mark goes on where it stopped: rest counts the newer turns not sent yet
 * (read again from the new mark); the first two are always sent, so such a reading always moves on. A handover document the person
 * pasted is folded to its one line before a prompt is clipped, so their own words after a long document are kept. */
export function sessionDetail(id: string, tool: SessionTool, s: ParsedSession, limits: Pick<SessionLimits, 'turnChars' | 'replyChars'> = SESSION_LIMITS, since: string | null = null): SessionDetail & { version: string } {
  const from = since ? Date.parse(since) : NaN;
  const turns = Number.isFinite(from) ? s.turns.filter(t => !t.at || !(Date.parse(t.at) < from)) : s.turns;
  const forward = Number.isFinite(from), kept: SessionTurn[] = []; let used = 0;
  for (let k = 0; k < turns.length; k++) {
    const t = turns[forward ? k : turns.length - 1 - k]!, text = clip(t.role === 'user' ? foldHandover(t.text) : t.text, limits.turnChars), files = [...new Set((t.files ?? []).map(x => changedPath(x, s.meta)))];
    used += text.length + files.join('').length;
    if (used > limits.replyChars && kept.length >= (forward ? 2 : 1)) {
      // A reading from a mark ends past the mark's own time and never between turns of one time: the next is read from the last time
      // it holds, and a turn at that time it did not hold would be taken as read.
      const last = kept.at(-1)!.at;
      if (!forward || (t.at !== last && !!last && Date.parse(last) > from)) break;
    }
    const turn = { role: t.role, at: t.at, text, ...(t.role === 'assistant' ? { files } : {}) };
    if (forward) kept.push(turn); else kept.unshift(turn);
  }
  return { version: SESSION_VERSION, id, tool, label: TOOL_NAME[tool], title: s.meta.title, cwd: s.meta.cwd, cwds: s.meta.cwds, branch: s.meta.branch, startedAt: s.meta.startedAt,
    turns: kept, omitted: forward ? 0 : turns.length - kept.length, ...(forward ? { rest: turns.length - kept.length } : {}) };
}
/** An opaque session id from a stable name: the session's own key (sessionKey), or for an alias its file's path (a real path on the
 * server, a path inside the picked folder in the page). The server and the page both make it here, so marks hold for either. */
export async function sessionId(tool: SessionTool, name: string): Promise<string> {
  const bytes = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(name)));
  return `${tool}-${[...bytes.slice(0, 12)].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}
