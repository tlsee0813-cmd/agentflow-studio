/* A session kept by Claude Code or Codex on this PC (server/sessions.mjs, sessions.1) turned into the text of one pasted record:
 * what the person asked and what the tool answered, in order, as they were written. Nothing is summarised or reworded; the
 * newest turns are kept when the whole session does not fit one record, and credential-like parts are hidden. */
import { PASTED_TEXT_LIMIT } from './types.js';
import { redactSecrets, secretLike } from './secret.js';
import { foldHandover } from './handover-mark.js';

export interface SessionTurn { role: 'user' | 'assistant'; at: string | null; text: string; files?: string[] }
/** aliases: ids the same session had before ids were made from the session itself (from its file's path): marks kept under one
 * of them still hold. */
export interface SessionSummary { id: string; tool: 'claude' | 'codex'; title: string | null; preview: string; cwd: string | null; branch: string | null; startedAt: string | null; updatedAt: string; bytes: number; aliases?: string[] }
/** omitted: earlier turns left out; rest (a reading from a time on): newer turns not sent yet, read from the new mark. */
export interface SessionDetail { id: string; tool: 'claude' | 'codex'; label: string; title: string | null; cwd: string | null; branch: string | null; startedAt: string | null; turns: SessionTurn[]; omitted: number; rest?: number }
export const TOOL_NAME: Record<SessionDetail['tool'], string> = { claude: 'Claude Code', codex: 'Codex' };

const pad = (n: number) => String(n).padStart(2, '0');
/** Local date and time (the person's own clock), or '' when the record has none. */
export function stamp(at: string | null, withDate = false): string {
  const d = at ? new Date(at) : null; if (!d || Number.isNaN(d.getTime())) return '';
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withDate ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}` : time;
}
/** A turn as taken into a record. cont: the rest of a reply whose start an earlier record already holds. */
export type TakenTurn = SessionTurn & { cont?: boolean };
/** Control characters a record cannot hold (terminal colour codes, an Office soft line break): a line break stays one. */
export const cleanText = (t: string) => t.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/[\u000b\u000c]/g, '\n').replace(/[\u0000-\u0008\u000e-\u001f\u007f]/g, '');
function block(t: TakenTurn, tool: string): string {
  const head = `── ${t.role === 'user' ? '사용자 요청' : `${tool} 답변${t.cont ? '(이어서)' : ''}`}${t.at ? ` · ${stamp(t.at)}` : ''} ──`;
  const files = t.role === 'assistant' && t.files?.length ? `\n(바꾼 파일: ${t.files.join(', ')})` : '';
  // A handover document the person pasted to start this session is already the project's own: one line names it instead.
  const text = t.role === 'user' ? foldHandover(t.text) : t.text;
  return `${head}${text ? `\n${text}` : ''}${files}`;
}

export interface SessionText { text: string; turns: number; left: number; redacted: number }
/** The record text of a session within `limit` characters: a header line, then whole turns, newest kept first and printed in order.
 * left counts the earlier turns not included (the server's own omissions too). A single newest turn longer than the room left is
 * cut at its end, never dropped. All of it, the header too (a folder or branch can look like a key), has credential-like parts
 * hidden and control characters taken out, so the text can always be kept as a record. */
export function sessionText(s: SessionDetail & { turns: TakenTurn[] }, limit = PASTED_TEXT_LIMIT): SessionText {
  const tool = TOOL_NAME[s.tool];
  const where = [s.title, s.cwd ? `작업 폴더 ${s.cwd}` : null, s.branch ? `브랜치 ${s.branch}` : null, s.startedAt ? `${stamp(s.startedAt, true)} 시작` : null, `세션 ${s.id}`].filter(Boolean).join(' · ');
  const top = redactSecrets(cleanText(`[${tool} 세션 기록${where ? ` · ${where}` : ''}]`).replace(/[\r\n]+/g, ' ')), head = top.text;
  const blocks = s.turns.map(t => { const r = redactSecrets(cleanText(block(t, tool))); return { text: r.text, redacted: r.count }; });
  const note = (n: number) => (n ? `\n(앞의 대화 ${n}개는 길이 제한으로 넣지 않았어요.)` : '');
  const kept: typeof blocks = [];
  let used = head.length + note(blocks.length + s.omitted).length;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]!, cost = b.text.length + 2;
    if (used + cost > limit) {
      if (!kept.length) { const room = Math.max(0, limit - used - 40); kept.unshift({ text: `${b.text.slice(0, room)}\n…(뒷부분 생략)`, redacted: b.redacted }); }
      break;
    }
    kept.unshift(b); used += cost;
  }
  const left = blocks.length - kept.length + s.omitted;
  let text = [`${head}${note(left)}`, ...kept.map(b => b.text)].join('\n\n'), cut = 0;
  // A turn cut at its end can end in what now looks like a key: hidden as well (shorter, so still within the limit).
  if (secretLike(text)) { const r = redactSecrets(text); text = r.text; cut = r.count; }
  return { text, turns: kept.length, left, redacted: top.count + cut + kept.reduce((n, b) => n + b.redacted, 0) };
}

/** A sessions.1 listing as sent by the server, checked; anything malformed is left out. */
export function readSessionList(v: unknown): SessionSummary[] {
  const list = (v as { version?: unknown; sessions?: unknown })?.version === 'sessions.1' ? (v as { sessions: unknown }).sessions : null;
  if (!Array.isArray(list)) return [];
  const str = (x: unknown) => (typeof x === 'string' ? x : null);
  const ID = /^(claude|codex)-[0-9a-f]{24}$/;
  return list.filter(x => x && typeof x === 'object' && typeof x.id === 'string' && ID.test(x.id) && typeof x.preview === 'string' && typeof x.updatedAt === 'string')
    .map(x => ({ id: x.id, tool: x.tool === 'codex' ? 'codex' : 'claude', title: str(x.title), preview: x.preview, cwd: str(x.cwd), branch: str(x.branch), startedAt: str(x.startedAt), updatedAt: x.updatedAt, bytes: Number(x.bytes) || 0,
      ...(Array.isArray(x.aliases) ? { aliases: x.aliases.filter((a: unknown): a is string => typeof a === 'string' && ID.test(a) && a !== x.id) } : {}) }));
}
/** One session as sent by the server, checked; null when it is not one. */
export function readSessionDetail(v: unknown): SessionDetail | null {
  const x = v as Record<string, unknown> | null;
  if (!x || x.version !== 'sessions.1' || typeof x.id !== 'string' || !Array.isArray(x.turns)) return null;
  const str = (y: unknown) => (typeof y === 'string' ? y : null);
  const turns: SessionTurn[] = [];
  for (const t of x.turns as Record<string, unknown>[]) {
    if (!t || (t.role !== 'user' && t.role !== 'assistant') || typeof t.text !== 'string') return null;
    turns.push({ role: t.role, at: str(t.at), text: t.text, ...(Array.isArray(t.files) ? { files: t.files.filter((f): f is string => typeof f === 'string') } : {}) });
  }
  return { id: x.id, tool: x.tool === 'codex' ? 'codex' : 'claude', label: str(x.label) ?? '', title: str(x.title), cwd: str(x.cwd), branch: str(x.branch), startedAt: str(x.startedAt), turns, omitted: Number(x.omitted) || 0, ...(Number(x.rest) > 0 ? { rest: Number(x.rest) } : {}) };
}

/* ---------- automatic connection: a project bound to a working folder takes each session's new turns as records ---------- */
/** How far one session was taken: the time of the last turn taken (null when its turns carry none) and how many were taken.
 * reply: when that last turn was a reply, how much of it was taken (its length, a checksum of it, the files it named), so a reply
 * that was still being written gives only what it gained when it is read again. A file joins a reply in no fixed place (a subagent's
 * changes come after the reply's own), so files are told by name; a mark kept before that holds their count. */
export interface SessionMark { lastAt: string | null; count: number; updatedAt: string; reply?: { chars: number; sum: string; files: string[] | number } }
/** A short checksum of a text (FNV-1a): whether a reply still starts with what was taken of it. */
export function textSum(t: string): string { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193); return (h >>> 0).toString(16); }
/** The turns of a session not taken yet: after the mark's time, or past its count when the turns have no times. Without a mark,
 * the turns at or after `from` (all when null). The server's own omissions count as taken: they are older than what it sent.
 * The reply taken last, when it went on since, comes first with only what it gained (cont). */
export function newTurns(s: SessionDetail, mark: SessionMark | null, from: string | null = null): TakenTurn[] {
  if (!mark) return from ? s.turns.filter(t => !t.at || t.at >= from) : s.turns;
  const lastAt = mark.lastAt, i = lastAt ? s.turns.findIndex(t => !!t.at && t.at >= lastAt) : mark.count - 1 - s.omitted;
  const after = lastAt ? s.turns.filter(t => !!t.at && t.at > lastAt) : s.turns.slice(Math.max(0, mark.count - s.omitted));
  const head = i >= 0 ? s.turns[i] : undefined, r = mark.reply;
  if (!head || head.role !== 'assistant' || !r) return after;
  // That reply is the first turn read from the mark on: at the mark's time, or later when its time moved with it (then only while
  // it still starts with what was taken). A reply cut at its length limit reads differently once it grew: its new files only.
  const same = head.text.length >= r.chars && textSum(head.text.slice(0, r.chars)) === r.sum;
  if (!same && lastAt && head.at !== lastAt) return after;
  const taken = r.files, more = same ? head.text.slice(r.chars).replace(/^\s+/, '') : '';
  const files = Array.isArray(taken) ? (head.files ?? []).filter(f => !taken.includes(f)) : (head.files ?? []).slice(taken);
  return [...(more || files.length ? [{ role: 'assistant' as const, at: head.at, text: more, files, cont: true }] : []), ...after.filter(t => t !== head)];
}
/** The mark once every turn of this reading is taken: its last time, and how much of its last turn when that is a reply. */
export function markAfter(s: SessionDetail, was: SessionMark | null, updatedAt: string): SessionMark {
  const last = s.turns.at(-1); if (!last) return was ? { ...was, updatedAt } : { lastAt: null, count: s.omitted, updatedAt };
  const lastAt = [...s.turns].reverse().find(t => t.at)?.at ?? was?.lastAt ?? null;
  return { lastAt, count: s.omitted + s.turns.length, updatedAt,
    ...(last.role === 'assistant' && (last.at ?? null) === lastAt ? { reply: { chars: last.text.length, sum: textSum(last.text), files: [...(last.files ?? [])] } } : {}) };
}
/** Turns after the mark that the reading left out (it sends the newest within its budget): the first record says how many. */
export function leftSince(s: SessionDetail, mark: SessionMark | null): number {
  if (!s.omitted || !mark) return s.omitted;
  if (!mark.lastAt) return Math.max(0, s.omitted - mark.count);
  // The turn taken last is the oldest one read from the mark on: when it was not sent, it is among the omitted.
  const first = s.turns.find(t => t.at)?.at;
  return first && first > mark.lastAt ? s.omitted - 1 : 0;
}
/** Record texts for these turns of one session, in order, each within `limit` characters and each with the session's header line,
 * so a long stretch becomes several records and no turn is left out (one turn longer than a record is cut at its end). left: turns
 * before these that were not read, said in the first. */
export function sessionChunks(s: SessionDetail, turns: TakenTurn[], limit = PASTED_TEXT_LIMIT, left = 0): string[] {
  const out: string[] = []; let rest = turns;
  while (rest.length) {
    // sessionText keeps the newest that fit; taking from the front, the earliest turns go first, each chunk as full as it can be.
    let n = rest.length;
    for (;;) {
      const got = sessionText({ ...s, turns: rest.slice(0, n), omitted: out.length ? 0 : left }, limit);
      if (got.turns === n || n === 1) { out.push(got.text); rest = rest.slice(n); break; }
      n = Math.max(1, Math.min(n - 1, got.turns));
    }
  }
  return out;
}
/** The line the paste box puts between what was in it and a session put after it: each side is kept as a record of its own (a
 * session's header is read at the start of a record only). Only this line cuts a draft: a header line quoted inside a conversation
 * (a record pasted into a session, a reply that writes the format) stays where it is. */
export const NEXT_RECORD = '──────── 다음 기록 ────────';
/** A draft cut at each NEXT_RECORD line, each part kept as a record of its own. One part when there is none. */
export function recordParts(text: string): string[] {
  // A draft with no such line is kept exactly as written.
  const cut = text.split(/^[ \t]*──────── 다음 기록 ────────[ \t]*$/m); if (cut.length === 1) return [text];
  const parts = cut.map(t => t.replace(/^\s*\n/, '').replace(/\s+$/, '')).filter(t => t.trim());
  return parts.length ? parts : [text];
}
/** When a session counts as settled: its file has not changed for this long, so a reply being written is not taken half-way. */
export const SETTLE_MS = 2 * 60 * 1000;
/** Automatic map readings of one project: at least this far apart, and at most this many a day (each is one paid AI call). */
export const AUTO_RUN_GAP_MS = 5 * 60 * 1000;
export const AUTO_RUNS_PER_DAY = 30;
/** When a project is first connected, sessions of its folder this recent are taken (newest ones, at most this many), each as one
 * record of its newest turns, so the first look stays small whatever the sessions hold. */
export const BACKFILL_MS = 14 * 24 * 60 * 60 * 1000;
export const BACKFILL_SESSIONS = 10;
