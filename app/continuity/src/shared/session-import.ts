/* A session kept by Claude Code or Codex on this PC (server/sessions.mjs, sessions.1) turned into the text of one pasted record:
 * what the person asked and what the tool answered, in order, as they were written. Nothing is summarised or reworded; the
 * newest turns are kept when the whole session does not fit one record, and credential-like parts are hidden. */
import { PASTED_TEXT_LIMIT } from './types.js';
import { redactSecrets } from './secret.js';

export interface SessionTurn { role: 'user' | 'assistant'; at: string | null; text: string; files?: string[] }
export interface SessionSummary { id: string; tool: 'claude' | 'codex'; title: string | null; preview: string; cwd: string | null; branch: string | null; startedAt: string | null; updatedAt: string; bytes: number }
export interface SessionDetail { id: string; tool: 'claude' | 'codex'; label: string; title: string | null; cwd: string | null; branch: string | null; startedAt: string | null; turns: SessionTurn[]; omitted: number }
export const TOOL_NAME: Record<SessionDetail['tool'], string> = { claude: 'Claude Code', codex: 'Codex' };

const pad = (n: number) => String(n).padStart(2, '0');
/** Local date and time (the person's own clock), or '' when the record has none. */
export function stamp(at: string | null, withDate = false): string {
  const d = at ? new Date(at) : null; if (!d || Number.isNaN(d.getTime())) return '';
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withDate ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}` : time;
}
function block(t: SessionTurn, tool: string): string {
  const head = `── ${t.role === 'user' ? '사용자 요청' : `${tool} 답변`}${t.at ? ` · ${stamp(t.at)}` : ''} ──`;
  const files = t.role === 'assistant' && t.files?.length ? `\n(바꾼 파일: ${t.files.join(', ')})` : '';
  return `${head}\n${t.text}${files}`;
}

export interface SessionText { text: string; turns: number; left: number; redacted: number }
/** The record text of a session within `limit` characters: a header line, then whole turns, newest kept first and printed in order.
 * left counts the earlier turns not included (the server's own omissions too). A single newest turn longer than the room left is
 * cut at its end, never dropped. */
export function sessionText(s: SessionDetail, limit = PASTED_TEXT_LIMIT): SessionText {
  const tool = TOOL_NAME[s.tool];
  const where = [s.title, s.cwd ? `작업 폴더 ${s.cwd}` : null, s.branch ? `브랜치 ${s.branch}` : null, s.startedAt ? `${stamp(s.startedAt, true)} 시작` : null].filter(Boolean).join(' · ');
  const head = `[${tool} 세션 기록${where ? ` · ${where}` : ''}]`;
  const blocks = s.turns.map(t => { const r = redactSecrets(block(t, tool)); return { text: r.text, redacted: r.count }; });
  const note = (n: number) => (n ? `\n(앞의 대화 ${n}개는 기록 하나의 길이 제한으로 넣지 않았어요.)` : '');
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
  const text = [`${head}${note(left)}`, ...kept.map(b => b.text)].join('\n\n');
  return { text, turns: kept.length, left, redacted: kept.reduce((n, b) => n + b.redacted, 0) };
}

/** A sessions.1 listing as sent by the server, checked; anything malformed is left out. */
export function readSessionList(v: unknown): SessionSummary[] {
  const list = (v as { version?: unknown; sessions?: unknown })?.version === 'sessions.1' ? (v as { sessions: unknown }).sessions : null;
  if (!Array.isArray(list)) return [];
  const str = (x: unknown) => (typeof x === 'string' ? x : null);
  return list.filter(x => x && typeof x === 'object' && typeof x.id === 'string' && /^(claude|codex)-[0-9a-f]{24}$/.test(x.id) && typeof x.preview === 'string' && typeof x.updatedAt === 'string')
    .map(x => ({ id: x.id, tool: x.tool === 'codex' ? 'codex' : 'claude', title: str(x.title), preview: x.preview, cwd: str(x.cwd), branch: str(x.branch), startedAt: str(x.startedAt), updatedAt: x.updatedAt, bytes: Number(x.bytes) || 0 }));
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
  return { id: x.id, tool: x.tool === 'codex' ? 'codex' : 'claude', label: str(x.label) ?? '', title: str(x.title), cwd: str(x.cwd), branch: str(x.branch), startedAt: str(x.startedAt), turns, omitted: Number(x.omitted) || 0 };
}

/* ---------- automatic connection: a project bound to a working folder takes each session's new turns as records ---------- */
/** How far one session was taken: the time of the last turn taken (null when its turns carry none) and how many were taken. */
export interface SessionMark { lastAt: string | null; count: number; updatedAt: string }
/** The turns of a session not taken yet: after the mark's time, or past its count when the turns have no times. Without a mark,
 * the turns at or after `from` (all when null). The server's own omissions count as taken: they are older than what it sent. */
export function newTurns(s: SessionDetail, mark: SessionMark | null, from: string | null = null): SessionTurn[] {
  if (!mark) return from ? s.turns.filter(t => !t.at || t.at >= from) : s.turns;
  if (mark.lastAt) return s.turns.filter(t => !!t.at && t.at > mark.lastAt!);
  return s.turns.slice(Math.max(0, mark.count - s.omitted));
}
/** Record texts for these turns of one session, in order, each within `limit` characters and each with the session's header line,
 * so a long stretch becomes several records and no turn is left out (one turn longer than a record is cut at its end). */
export function sessionChunks(s: SessionDetail, turns: SessionTurn[], limit = PASTED_TEXT_LIMIT): string[] {
  const out: string[] = []; let rest = turns;
  while (rest.length) {
    // sessionText keeps the newest that fit; taking from the front, the earliest turns go first, each chunk as full as it can be.
    let n = rest.length;
    for (;;) {
      const got = sessionText({ ...s, turns: rest.slice(0, n), omitted: 0 }, limit);
      if (got.turns === n || n === 1) { out.push(got.text); rest = rest.slice(n); break; }
      n = Math.max(1, Math.min(n - 1, got.turns));
    }
  }
  return out;
}
/** When a session counts as settled: its file has not changed for this long, so a reply being written is not taken half-way. */
export const SETTLE_MS = 2 * 60 * 1000;
/** Automatic map readings of one project: at least this far apart, and at most this many a day (each is one paid AI call). */
export const AUTO_RUN_GAP_MS = 5 * 60 * 1000;
export const AUTO_RUNS_PER_DAY = 30;
/** When a project is first connected, sessions of its folder this recent are taken (newest ones, at most this many). */
export const BACKFILL_MS = 14 * 24 * 60 * 60 * 1000;
export const BACKFILL_SESSIONS = 10;
